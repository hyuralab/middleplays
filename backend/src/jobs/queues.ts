import { Queue } from 'bullmq'
import { logger } from '@/libs/logger'
import Redis from 'ioredis'

// Create separate Redis connection for BullMQ (with required options)
const bullRedis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
  enableOfflineQueue: true,
})

// Job queues for async task processing
export const autoExpireQueue = new Queue('auto-expire', { connection: bullRedis as any })
export const autoCompleteQueue = new Queue('auto-complete', { connection: bullRedis as any })
export const disbursementQueue = new Queue('disbursement', { connection: bullRedis as any })
export const notificationQueue = new Queue('send-notification', { connection: bullRedis as any })
export const autoResolveDisputesQueue = new Queue('auto-resolve-disputes', { connection: bullRedis as any })
export const deleteExpiredCredentialsQueue = new Queue('delete-expired-credentials', { connection: bullRedis as any })

logger.info('BullMQ queues initialized')

