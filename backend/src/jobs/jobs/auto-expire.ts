import { Job } from 'bullmq'
import { db } from '@/db'
import { logger } from '@/libs/logger'

/**
 * Auto-expire postings after 7 days if no sale
 * Also revert 'sold' postings back to 'active' if transaction expires
 */
export async function processAutoExpire(job: Job) {
  try {
    logger.info('Processing auto-expire job', { jobId: job.id })

    // 1. Find and expire old active postings (after 7 days)
    const expiredPostings = await db`
      UPDATE game_accounts
      SET status = 'expired'
      WHERE status = 'active'
      AND created_at < NOW() - INTERVAL '7 days'
      RETURNING id, game_id
    `

    logger.info(`Auto-expired ${expiredPostings.length} old postings`)

    // 2. Revert 'sold' postings back to 'active' if transaction expired without payment
    // If transaction expires (1 hour payment window), posting should be available for sale again
    const revertedPostings = await db`
      UPDATE game_accounts ga
      SET status = 'active', updated_at = NOW()
      WHERE ga.status = 'sold'
      AND EXISTS (
        SELECT 1 FROM transactions t
        WHERE t.game_account_id = ga.id
        AND t.status IN ('pending', 'failed')
        AND t.payment_status = 'pending'
        AND t.expires_at < NOW()
      )
      RETURNING ga.id
    `

    if (revertedPostings.length > 0) {
      logger.info(`Reverted ${revertedPostings.length} postings with expired transactions`)
    }

    return { 
      expiredCount: expiredPostings.length,
      revertedCount: revertedPostings.length,
    }
  } catch (error) {
    logger.error('Auto-expire job failed', error)
    throw error
  }
}
