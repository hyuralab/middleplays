import { Job } from 'bullmq'
import { logger } from '@/libs/logger'
import { deleteExpiredCredentials } from '@/modules/transactions/service'

/**
 * Auto-delete credentials older than 1 hour
 * Runs every 30 minutes for privacy protection
 */
export async function processDeleteExpiredCredentials(job: Job) {
  try {
    logger.info('Starting credential cleanup job...')

    const deletedCount = await deleteExpiredCredentials()

    logger.info(`Credential cleanup completed. Deleted ${deletedCount} expired access records.`)

    return {
      success: true,
      deletedCount,
      timestamp: new Date(),
    }
  } catch (error) {
    logger.error('Credential cleanup job failed', error)
    throw error
  }
}
