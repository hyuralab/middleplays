import { Job } from 'bullmq'
import { db } from '@/db'
import { logger } from '@/libs/logger'

/**
 * Auto-expire postings after 7 days if no sale
 */
export async function processAutoExpire(job: Job) {
  try {
    logger.info('Processing auto-expire job', { jobId: job.id })

    // Find and expire old postings
    const result = await db`
      UPDATE game_accounts
      SET status = 'expired'
      WHERE status = 'active'
      AND created_at < NOW() - INTERVAL '7 days'
      RETURNING id, game_id
    `

    logger.info(`Auto-expired ${result.length} postings`)
    return { expiredCount: result.length }
  } catch (error) {
    logger.error('Auto-expire job failed', error)
    throw error
  }
}
