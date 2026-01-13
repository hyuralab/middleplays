import { Worker } from 'bullmq'
import { logger } from '@/libs/logger'
import Redis from 'ioredis'
import { processAutoExpire } from './jobs/auto-expire'
import { processAutoComplete } from './jobs/auto-complete'
import { processDisbursement } from './jobs/disbursement'
import { processSendNotification } from './jobs/send-notification'

// Create separate Redis connection for BullMQ workers
const bullRedis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
  enableOfflineQueue: true,
})

// Initialize workers for each queue
export const autoExpireWorker = new Worker('auto-expire', processAutoExpire, {
  connection: bullRedis as any,
  concurrency: 5,
})

export const autoCompleteWorker = new Worker('auto-complete', processAutoComplete, {
  connection: bullRedis as any,
  concurrency: 5,
})

export const disbursementWorker = new Worker('disbursement', processDisbursement, {
  connection: bullRedis as any,
  concurrency: 3,
})

export const notificationWorker = new Worker('send-notification', processSendNotification, {
  connection: bullRedis as any,
  concurrency: 10,
})

// Attach event handlers
;[autoExpireWorker, autoCompleteWorker, disbursementWorker, notificationWorker].forEach((worker) => {
  worker.on('completed', (job) => {
    logger.info(`Job ${job.id} completed in queue ${job.queueName}`)
  })

  worker.on('failed', (job, err) => {
    logger.error(`Job ${job?.id} failed in queue ${job?.queueName}`, err)
  })

  worker.on('error', (err) => {
    logger.error(`Worker error in ${worker.name}`, err)
  })
})

logger.info('BullMQ workers initialized')
