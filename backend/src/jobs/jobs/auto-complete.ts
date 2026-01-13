import { Job } from 'bullmq'
import { db } from '@/db'
import { logger } from '@/libs/logger'

/**
 * Auto-complete transactions after delivery confirmed
 */
export async function processAutoComplete(job: Job) {
  try {
    logger.info('Processing auto-complete job', { jobId: job.id })

    // Find and auto-complete unconfirmed transactions after 3 days
    const result = await db`
      UPDATE transactions
      SET status = 'completed', updated_at = NOW()
      WHERE status = 'processing'
      AND created_at < NOW() - INTERVAL '3 days'
      RETURNING id, buyer_id
    `

    logger.info(`Auto-completed ${result.length} transactions`)
    return { completedCount: result.length }
  } catch (error) {
    logger.error('Auto-complete job failed', error)
    throw error
  }
}
