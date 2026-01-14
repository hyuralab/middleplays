import { db } from '@/db'
import { TransactionStatus, PaymentStatus } from '@/types'
import { logger } from '@/libs/logger'
import { calculateFees } from './utils'
import type { CreatePurchaseRequest } from './model'
import { xenditClient } from '@/libs/xendit'
import { fetchOne, fetchMany, getUserName } from '@/libs/query-helpers'
import {
  notifyTransactionPending,
  notifyPaymentConfirmed,
  notifyTransactionCompleted,
} from '@/modules/notifications/service'

/**
 * Creates a new purchase transaction for a game account.
 */
export async function createPurchase(buyerId: number, data: CreatePurchaseRequest) {
  const { gameAccountId } = data

  try {
    const result = await db.begin(async (tx: any) => {
      // 1. Find and lock the account posting
      const posting = await fetchOne(
        tx`
          SELECT id, seller_id, price, account_identifier, status
          FROM game_accounts 
          WHERE id = ${gameAccountId} AND status = 'active'
          FOR UPDATE
        `,
        'This account is no longer available for purchase.',
        'Failed to find game account'
      ) as any

      // 2. Validate the purchase
      if (posting.seller_id === buyerId) {
        throw new Error('You cannot purchase your own posting.')
      }

      const buyer = await fetchOne(
        tx`SELECT id, email FROM users WHERE id = ${buyerId}`,
        'Buyer account not found.',
        'Failed to find buyer'
      ) as any

      // 3. Calculate fees
      const price = Number(posting.price)
      const fees = calculateFees(price)

      // 4. Create the transaction record
      const newTransaction = await fetchOne(
        tx`
          INSERT INTO transactions (
            buyer_id, seller_id, game_account_id,
            item_price, platform_fee_percentage, platform_fee_amount,
            disbursement_fee, total_buyer_paid, seller_received,
            status, payment_status, created_at, updated_at
          ) VALUES (
            ${buyerId}, ${posting.seller_id}, ${gameAccountId},
            ${fees.itemPrice}, 3.00, ${fees.platformFeeAmount},
            ${fees.disbursementFee}, ${fees.totalBuyerPaid}, ${fees.sellerReceived},
            'pending', 'pending', NOW(), NOW()
          )
          RETURNING id, buyer_id, seller_id
        `,
        'Failed to create transaction record.',
        'Transaction INSERT failed'
      ) as any

      // 5. Update the game account status to prevent double-selling
      await tx`
        UPDATE game_accounts
        SET status = 'sold', updated_at = NOW()
        WHERE id = ${gameAccountId}
      `

      logger.info(`Marked game account ${gameAccountId} as 'sold' pending payment.`)

      // 6. Create an invoice with Xendit
      const xenditInvoice = await xenditClient.createInvoice({
        external_id: newTransaction.id,
        amount: fees.totalBuyerPaid,
        payer_email: buyer.email,
        description: `Purchase of ${posting.account_identifier}`,
      })

      if (!xenditInvoice.invoice_url) {
        throw new Error('Failed to create payment link.')
      }

      // 7. Update transaction with payment gateway reference
      await tx`
        UPDATE transactions
        SET 
          payment_gateway_ref = ${xenditInvoice.id},
          expires_at = NOW() + INTERVAL '1 hour'
        WHERE id = ${newTransaction.id}
      `

      return {
        transactionId: newTransaction.id,
        sellerId: newTransaction.seller_id,
        paymentUrl: xenditInvoice.invoice_url,
        expiresAt: new Date(Date.now() + 3600 * 1000),
      }
    })

    // Send transaction pending notification to seller
    try {
      const sellerData = await db`SELECT google_name FROM users WHERE id = ${result.sellerId}` as any
      await notifyTransactionPending(
        result.transactionId,
        result.sellerId,
        sellerData?.[0]?.google_name || 'A seller'
      )
    } catch (notifError) {
      logger.error('Failed to send notification', notifError)
      // Don't fail the transaction if notification fails
    }

    logger.info(`Purchase initiated for transaction ID: ${result.transactionId}`)
    return result
  } catch (error) {
    logger.error('Purchase creation failed', error)
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Failed to initiate purchase. Please try again.')
  }
}

/**
 * Webhook handler for successful payment from Xendit
 */
export async function handlePaymentSuccess(xenditInvoiceId: string) {
  try {
    // Find transaction by payment_gateway_ref
    const txn = await fetchOne(
      db`
        SELECT id, buyer_id, seller_id, total_buyer_paid FROM transactions
        WHERE payment_gateway_ref = ${xenditInvoiceId}
      `,
      'Transaction not found',
      'Failed to find transaction by payment_gateway_ref'
    ) as any

    // Update transaction status to paid
    await db`
      UPDATE transactions
      SET payment_status = 'paid', status = 'processing', updated_at = NOW()
      WHERE id = ${txn.id}
    `

    logger.info(`Payment confirmed for transaction ${txn.id}`)

    // Send payment confirmed notifications
    try {
      await notifyPaymentConfirmed(txn.buyer_id, txn.seller_id, txn.id)
    } catch (notifError) {
      logger.error('Failed to send payment notification', notifError)
      // Don't fail if notification fails
    }

    return { success: true, transactionId: txn.id }
  } catch (error) {
    logger.error('Payment success handler failed', error)
    throw error
  }
}

/**
 * Mark transaction as completed (when buyer confirmed receipt)
 */
export async function completeTransaction(transactionId: number) {
  try {
    const txn = await fetchOne(
      db`
        UPDATE transactions
        SET status = 'completed', completed_at = NOW(), updated_at = NOW()
        WHERE id = ${transactionId}
        RETURNING *
      `,
      'Transaction not found',
      'Failed to complete transaction'
    ) as any

    logger.info(`Transaction ${transactionId} completed`)

    // Send transaction completed notification to seller
    try {
      await notifyTransactionCompleted(txn.seller_id, txn.id)
    } catch (notifError) {
      logger.error('Failed to send completion notification', notifError)
      // Don't fail if notification fails
    }

    return txn
  } catch (error) {
    logger.error('Transaction completion failed', error)
    throw error
  }
}

/**
 * Get transaction details
 */
export async function getTransaction(transactionId: number) {
  try {
    const result = await fetchOne(
      db`
        SELECT 
          t.id, t.buyer_id, t.seller_id, t.game_account_id,
          t.item_price, t.platform_fee_percentage, t.platform_fee_amount,
          t.disbursement_fee, t.total_buyer_paid, t.seller_received,
          t.payment_method, t.payment_status, t.status,
          t.expires_at, t.completed_at, t.created_at, t.updated_at,
          b.email as buyer_email, b.username as buyer_username,
          s.email as seller_email, s.username as seller_username,
          ga.account_identifier, ga.price as listing_price
        FROM transactions t
        LEFT JOIN users b ON t.buyer_id = b.id
        LEFT JOIN users s ON t.seller_id = s.id
        LEFT JOIN game_accounts ga ON t.game_account_id = ga.id
        WHERE t.id = ${transactionId}
      `,
      'Transaction not found',
      `Failed to get transaction ${transactionId}`
    ) as any
    return result
  } catch (error) {
    logger.error(`Failed to get transaction ${transactionId}`, error)
    throw error
  }
}

/**
 * Fetch credentials for completed transaction (buyer only)
 * Credentials expire 10 minutes after first access
 * All credentials auto-deleted after 1 hour
 */
export async function fetchCredentials(transactionId: number, buyerId: number) {
  try {
    // 1. Verify transaction exists and buyer is the one who purchased
    const txn = await fetchOne(
      db`
        SELECT t.id, t.buyer_id, t.seller_id, t.status, t.payment_status,
               t.credentials_first_accessed_at, t.credentials_expires_at,
               ga.account_identifier, ga.field_values
        FROM transactions t
        LEFT JOIN game_accounts ga ON t.game_account_id = ga.id
        WHERE t.id = ${transactionId} AND t.buyer_id = ${buyerId}
      ` as any,
      'Transaction not found or you are not the buyer',
      'Failed to find transaction for credentials'
    ) as any

    // 2. Check if transaction is completed
    if (txn.status !== 'completed') {
      throw new Error('Credentials only available after transaction is completed')
    }

    // 3. Check if already accessed and still valid
    const now = new Date()
    if (txn.credentials_expires_at && new Date(txn.credentials_expires_at) > now) {
      // Already accessed and still valid - just return credentials
      logger.info(`Credentials re-accessed for transaction ${transactionId}`)
      return {
        transactionId,
        accountIdentifier: txn.account_identifier,
        credentials: txn.field_values || {},
        expiresAt: txn.credentials_expires_at,
        minutesRemaining: Math.floor((new Date(txn.credentials_expires_at).getTime() - now.getTime()) / 60000),
      }
    }

    // 4. First access or expired - create new access record
    const expiresAt = new Date(now.getTime() + 10 * 60000) // 10 minutes from now

    await db`
      INSERT INTO credential_access (transaction_id, buyer_id, expires_at, accessed_at)
      VALUES (${transactionId}, ${buyerId}, ${expiresAt}, NOW())
    `

    // 5. Update transaction to track first access
    await db`
      UPDATE transactions
      SET credentials_first_accessed_at = NOW(), credentials_expires_at = ${expiresAt}
      WHERE id = ${transactionId}
    `

    logger.info(`Credentials first accessed for transaction ${transactionId}. Expires at: ${expiresAt}`)

    return {
      transactionId,
      accountIdentifier: txn.account_identifier,
      credentials: txn.field_values || {},
      expiresAt: expiresAt.toISOString(),
      minutesRemaining: 10,
      warning: 'Credentials will expire in 10 minutes. Please save them now.',
    }
  } catch (error) {
    logger.error(`Failed to fetch credentials for transaction ${transactionId}`, error)
    throw error
  }
}

/**
 * Auto-delete credentials older than 1 hour (for privacy)
 */
export async function deleteExpiredCredentials() {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

    const result = await db`
      DELETE FROM credential_access
      WHERE accessed_at < ${oneHourAgo}
      RETURNING id
    ` as any

    const deletedCount = result?.length || 0

    if (deletedCount > 0) {
      logger.info(`Deleted ${deletedCount} expired credential access records`)
    }

    // Also clear credentials_expires_at for transactions older than 1 hour
    await db`
      UPDATE transactions
      SET credentials_expires_at = NULL
      WHERE credentials_first_accessed_at IS NOT NULL
        AND credentials_first_accessed_at < ${oneHourAgo}
    `

    return deletedCount
  } catch (error) {
    logger.error('Failed to delete expired credentials', error)
    throw error
  }
}
