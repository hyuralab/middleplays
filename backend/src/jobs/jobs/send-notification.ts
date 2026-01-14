import { Job } from 'bullmq'
import { logger } from '@/libs/logger'

/**
 * Process notification job
 * Currently logs notifications only (in-app only, no email)
 */
export async function processSendNotification(job: Job) {
  try {
    const { notificationId, type } = job.data

    logger.info(`[NOTIFICATION] Job ${job.id}: ${type} (notification: ${notificationId})`)

    return {
      success: true,
      notificationId,
      type,
      timestamp: new Date(),
    }
  } catch (error) {
    logger.error(`Notification job failed: ${job.id}`, error)
    throw error
  }
}
