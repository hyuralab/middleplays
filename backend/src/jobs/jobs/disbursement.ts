import { Job } from 'bullmq'
import { db } from '@/db'
import { logger } from '@/libs/logger'

/**
 * Process seller disbursement (payout to seller accounts)
 */
export async function processDisbursement(job: Job) {
  try {
    const { sellerId, transactionId } = job.data
    logger.info('Processing disbursement', { jobId: job.id, sellerId, transactionId })

    // Mark disbursement as processing
    const result = await db`
      UPDATE transactions
      SET status = 'disbursed', updated_at = NOW()
      WHERE id = ${transactionId}
      AND seller_id = ${sellerId}
      RETURNING id, amount
    `

    if (!result || result.length === 0) {
      throw new Error('Transaction not found or unauthorized')
    }

    logger.info(`Disbursement processed for transaction ${transactionId}`)
    return { disbursed: true, transactionId }
  } catch (error) {
    logger.error('Disbursement job failed', error)
    throw error
  }
}
