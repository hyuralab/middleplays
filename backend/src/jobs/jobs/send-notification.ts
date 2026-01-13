import { Job } from 'bullmq'
import { logger } from '@/libs/logger'

/**
 * Send push/email notifications to users
 */
export async function processSendNotification(job: Job) {
  try {
    const { userId, type, message, data } = job.data
    logger.info('Processing notification', { jobId: job.id, userId, type })

    // TODO: Integrate with push notification service (FCM, OneSignal, etc)
    // For now, just log
    logger.info(`Notification sent to user ${userId}: ${message}`)

    return { sent: true, userId, type }
  } catch (error) {
    logger.error('Send notification job failed', error)
    throw error
  }
}
