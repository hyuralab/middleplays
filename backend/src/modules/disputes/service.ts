import { db } from '@/db'
import { logger } from '@/libs/logger'
import {
  generateDisputeId,
  getAutoResolutionDate,
  calculateRefundAmount,
} from './utils'
import { notifyDisputeOpened } from '@/modules/notifications/service'
import type {
  CreateDisputeRequest,
  AddDisputeMessageRequest,
  ResolveDisputeRequest,
  DisputeRecord,
  DisputeMessage,
} from './model'

/**
 * Create a new dispute for a transaction
 */
export async function createDispute(
  buyerId: number,
  data: CreateDisputeRequest
): Promise<DisputeRecord> {
  try {
    const disputeId = generateDisputeId()
    const autoResolveDate = getAutoResolutionDate()

    const result = await db.begin(async (tx: any) => {
      // 1. Verify transaction exists and belongs to buyer
      const txns = await tx`
        SELECT id, buyer_id, seller_id, total_buyer_paid, platform_fee_amount, status
        FROM transactions
        WHERE id = ${data.transactionId} AND buyer_id = ${buyerId}
      `

      if (!txns || txns.length === 0) {
        throw new Error('Transaction not found or you are not the buyer.')
      }

      const txn = txns[0]

      // 2. Check if dispute already exists for this transaction
      const existingDisputes = await tx`
        SELECT id FROM disputes
        WHERE transaction_id = ${data.transactionId}
        AND status != 'closed'
      `

      if (existingDisputes && existingDisputes.length > 0) {
        throw new Error('An active dispute already exists for this transaction.')
      }

      // 3. Create the dispute record
      const disputes = await tx`
        INSERT INTO disputes (
          id, transaction_id, buyer_id, seller_id,
          reason, description, status, evidence_urls,
          auto_resolve_at, created_at, updated_at
        ) VALUES (
          ${disputeId}, ${data.transactionId}, ${buyerId}, ${txn.seller_id},
          ${data.reason}, ${data.description}, 'open', ${data.evidence || []},
          ${autoResolveDate}, NOW(), NOW()
        )
        RETURNING *
      `

      if (!disputes || disputes.length === 0) {
        throw new Error('Failed to create dispute.')
      }

      logger.info(`Dispute created: ${disputeId} for transaction ${data.transactionId}`)

      return disputes[0]
    })

    // Send dispute opened notification to seller
    try {
      const buyer = await db`SELECT google_name FROM users WHERE id = ${result.buyer_id}` as any
      await notifyDisputeOpened(result.seller_id, result.id, buyer?.[0]?.google_name || 'A buyer')
    } catch (notifError) {
      logger.error('Failed to send dispute notification', notifError)
      // Don't fail if notification fails
    }

    return result
  } catch (error) {
    logger.error('Error creating dispute:', error)
    throw error
  }
}

/**
 * Get dispute details with messages
 */
export async function getDisputeDetail(disputeId: string, userId: number) {
  try {
    // Verify user is involved in dispute
    const disputes = await db`
      SELECT * FROM disputes WHERE id = ${disputeId}
      AND (buyer_id = ${userId} OR seller_id = ${userId})
    `

    if (!disputes || disputes.length === 0) {
      throw new Error('Dispute not found or access denied.')
    }

    const dispute = disputes[0] as DisputeRecord

    // Get messages
    const messages = await db`
      SELECT dm.*, u.google_name as sender_name
      FROM dispute_messages dm
      JOIN users u ON u.id = dm.sender_id
      WHERE dm.dispute_id = ${disputeId}
      ORDER BY dm.created_at ASC
    `

    // Get buyer and seller info
    const buyerResult = await db`SELECT id, google_name FROM users WHERE id = ${dispute.buyer_id}`
    const sellerResult = await db`SELECT id, google_name FROM users WHERE id = ${dispute.seller_id}`

    const buyer = buyerResult?.[0]
    const seller = sellerResult?.[0]

    return {
      ...dispute,
      buyerName: buyer?.google_name || 'Unknown',
      sellerName: seller?.google_name || 'Unknown',
      messages: messages || [],
    }
  } catch (error) {
    logger.error('Error getting dispute detail:', error)
    throw error
  }
}

/**
 * List disputes for a user with pagination
 */
export async function listDisputes(
  userId: number,
  filters?: {
    status?: string
    reason?: string
    page?: number
    limit?: number
  }
) {
  try {
    const page = filters?.page || 1
    const limit = filters?.limit || 10
    const offset = (page - 1) * limit

    // Build query with filters
    let countQuery = db`SELECT COUNT(*) as count FROM disputes WHERE (buyer_id = ${userId} OR seller_id = ${userId})`
    let listQuery = db`
      SELECT d.*, u1.name as buyer_name, u2.name as seller_name
      FROM disputes d
      JOIN users u1 ON u1.id = d.buyer_id
      JOIN users u2 ON u2.id = d.seller_id
      WHERE (d.buyer_id = ${userId} OR d.seller_id = ${userId})
    `

    if (filters?.status) {
      countQuery = db`${countQuery} AND status = ${filters.status}`
      listQuery = db`${listQuery} AND d.status = ${filters.status}`
    }

    if (filters?.reason) {
      countQuery = db`${countQuery} AND reason = ${filters.reason}`
      listQuery = db`${listQuery} AND d.reason = ${filters.reason}`
    }

    const [countResult, disputes] = await Promise.all([
      countQuery,
      db`${listQuery} ORDER BY d.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
    ])

    const total = countResult?.[0]?.count || 0
    const pages = Math.ceil(total / limit)

    return {
      disputes: disputes || [],
      pagination: {
        page,
        limit,
        total,
        pages,
      },
    }
  } catch (error) {
    logger.error('Error listing disputes:', error)
    throw error
  }
}

/**
 * Add a message to dispute thread
 */
export async function addDisputeMessage(
  disputeId: string,
  userId: number,
  data: AddDisputeMessageRequest
): Promise<DisputeMessage> {
  try {
    const result = await db.begin(async (tx: any) => {
      // 1. Verify dispute exists and user is involved
      const disputes = await tx`
        SELECT * FROM disputes WHERE id = ${disputeId}
        AND (buyer_id = ${userId} OR seller_id = ${userId})
      `

      if (!disputes || disputes.length === 0) {
        throw new Error('Dispute not found or access denied.')
      }

      // 2. Check dispute is not closed/auto-resolved
      const dispute = disputes[0]
      if (dispute.status === 'closed' || dispute.status === 'auto_resolved') {
        throw new Error('Cannot add messages to closed dispute.')
      }

      // 3. Create message
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`
      const messages = await tx`
        INSERT INTO dispute_messages (
          id, dispute_id, sender_id, message, attachments, created_at
        ) VALUES (
          ${messageId}, ${disputeId}, ${userId}, ${data.message}, ${data.attachments || []}, NOW()
        )
        RETURNING *
      `

      if (!messages || messages.length === 0) {
        throw new Error('Failed to add message.')
      }

      logger.info(`Message added to dispute ${disputeId}`)

      return messages[0]
    })

    return result
  } catch (error) {
    logger.error('Error adding dispute message:', error)
    throw error
  }
}

/**
 * Resolve a dispute
 */
export async function resolveDispute(
  disputeId: string,
  adminId: number,
  data: ResolveDisputeRequest
) {
  try {
    const result = await db.begin(async (tx: any) => {
      // 1. Get dispute and related transaction
      const disputes = await tx`
        SELECT d.*, t.buyer_id, t.seller_id, t.total_buyer_paid, t.platform_fee_amount
        FROM disputes d
        JOIN transactions t ON t.id = d.transaction_id
        WHERE d.id = ${disputeId}
        FOR UPDATE
      `

      if (!disputes || disputes.length === 0) {
        throw new Error('Dispute not found.')
      }

      const dispute = disputes[0]

      if (dispute.status === 'closed' || dispute.status === 'auto_resolved') {
        throw new Error('This dispute is already resolved.')
      }

      // 2. Calculate refund amounts if needed
      let buyerRefund = 0
      let sellerRefund = 0

      if (data.resolution === 'refund_buyer') {
        const refunds = calculateRefundAmount(
          dispute.total_buyer_paid,
          dispute.platform_fee_amount,
          data.refundPercentage || 100
        )
        buyerRefund = refunds.buyerRefund
        sellerRefund = refunds.sellerRefund
      } else if (data.resolution === 'partial_refund' && data.refundPercentage) {
        const refunds = calculateRefundAmount(
          dispute.total_buyer_paid,
          dispute.platform_fee_amount,
          data.refundPercentage
        )
        buyerRefund = refunds.buyerRefund
        sellerRefund = refunds.sellerRefund
      }

      // 3. Update dispute status
      const updatedDisputes = await tx`
        UPDATE disputes
        SET
          status = 'resolved',
          resolution = ${data.resolution},
          refund_percentage = ${data.refundPercentage || null},
          notes = ${data.notes || null},
          resolved_at = NOW(),
          updated_at = NOW()
        WHERE id = ${disputeId}
        RETURNING *
      `

      if (!updatedDisputes || updatedDisputes.length === 0) {
        throw new Error('Failed to resolve dispute.')
      }

      // 4. Create refund transaction if applicable
      if (buyerRefund > 0) {
        await tx`
          INSERT INTO refunds (
            dispute_id, buyer_id, seller_id,
            buyer_refund_amount, seller_refund_amount,
            status, created_at
          ) VALUES (
            ${disputeId}, ${dispute.buyer_id}, ${dispute.seller_id},
            ${buyerRefund}, ${sellerRefund},
            'pending', NOW()
          )
        `

        logger.info(`Refund created for dispute ${disputeId}: buyer=${buyerRefund}, seller=${sellerRefund}`)
      }

      logger.info(`Dispute resolved: ${disputeId} with resolution: ${data.resolution}`)

      return updatedDisputes[0]
    })

    return result
  } catch (error) {
    logger.error('Error resolving dispute:', error)
    throw error
  }
}

/**
 * Auto-resolve disputes older than 30 days
 */
export async function autoResolveExpiredDisputes() {
  try {
    const expiredDisputes = await db`
      SELECT * FROM disputes
      WHERE status = 'open' OR status = 'in_review'
      AND auto_resolve_at <= NOW()
    `

    if (!expiredDisputes || expiredDisputes.length === 0) {
      logger.info('No expired disputes to auto-resolve')
      return { count: 0 }
    }

    for (const dispute of expiredDisputes) {
      await db.begin(async (tx: any) => {
        // Refund buyer in full as auto-resolution
        const transactions = await tx`
          SELECT * FROM transactions WHERE id = ${dispute.transaction_id}
        `

        if (transactions && transactions.length > 0) {
          const txn = transactions[0]

          const refunds = calculateRefundAmount(
            txn.total_buyer_paid,
            txn.platform_fee_amount,
            100
          )

          await tx`
            INSERT INTO refunds (
              dispute_id, buyer_id, seller_id,
              buyer_refund_amount, seller_refund_amount,
              status, created_at
            ) VALUES (
              ${dispute.id}, ${dispute.buyer_id}, ${dispute.seller_id},
              ${refunds.buyerRefund}, ${refunds.sellerRefund},
              'pending', NOW()
            )
          `
        }

        // Mark dispute as auto-resolved
        await tx`
          UPDATE disputes
          SET
            status = 'auto_resolved',
            resolution = 'auto_resolved',
            resolved_at = NOW(),
            updated_at = NOW()
          WHERE id = ${dispute.id}
        `

        logger.info(`Dispute auto-resolved: ${dispute.id}`)
      })
    }

    logger.info(`Auto-resolved ${expiredDisputes.length} expired disputes`)
    return { count: expiredDisputes.length }
  } catch (error) {
    logger.error('Error auto-resolving disputes:', error)
    throw error
  }
}
