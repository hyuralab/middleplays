import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'

// Config & validation
import { env, validateEnv } from '@/configs/env'

// Plugins
import { jwtPlugin } from '@/plugins/jwt'
import { errorHandler } from '@/plugins/error-handler'
import { globalRateLimit } from '@/plugins/rate-limit'

// Database & Redis
import { db, closeDatabase, checkDbConnection } from '@/db'
import { redis } from '@/libs/redis'
import { logger } from '@/libs/logger'

// Jobs & Workers (optional, can be disabled)
let autoExpireWorker: any, autoCompleteWorker: any, disbursementWorker: any, notificationWorker: any, autoResolveDisputesWorker: any, deleteExpiredCredentialsWorker: any

// Modules
import { authModule } from '@/modules/auth'
import { usersModule } from '@/modules/users'
import { gamesModule } from '@/modules/games'
import { postingsModule } from '@/modules/postings'
import { transactionsModule } from '@/modules/transactions'
import { reviewsModule } from '@/modules/reviews'
import { adminModule } from '@/modules/admin'

// Validate environment on startup
validateEnv()

const app = new Elysia()
  // Global plugins
  .use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
    })
  )
  .use(errorHandler)
  .use(jwtPlugin)
  .use(globalRateLimit)

  // Decorate context with db & redis
  .decorate('db', db)
  .decorate('redis', redis)

  // Health check
  .get('/health', async () => {
    const dbOk = await checkDbConnection()
    const redisOk = redis.status === 'ready'
    
    return {
      status: dbOk && redisOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
      services: {
        database: dbOk ? 'ok' : 'error',
        redis: redisOk ? 'ok' : 'error',
      },
    }
  })

  // API info
  .get('/', () => ({
    name: 'Game Store API',
    version: '1.0.0',
    docs: '/health',
  }))

  // Static file serving for uploads
  .get('/uploads/images/:filename', async ({ params }) => {
    const { readFile } = await import('fs/promises')
    const { join } = await import('path')
    
    try {
      // Validate filename to prevent directory traversal
      if (params.filename.includes('..') || params.filename.includes('/')) {
        throw new Error('Invalid filename')
      }
      
      const filepath = join(process.cwd(), 'public', 'uploads', 'images', params.filename)
      const file = await readFile(filepath)
      
      return new Response(file, {
        headers: {
          'Content-Type': 'image/webp',
          'Cache-Control': 'public, max-age=31536000', // 1 year cache for versioned URLs
        },
      })
    } catch (error) {
      return new Response('File not found', { status: 404 })
    }
  })

  // Mount modules
  .use(authModule)
  .use(usersModule)
  .use(gamesModule)
  .use(postingsModule)
  .use(transactionsModule)
  .use(reviewsModule)
  .use(adminModule)

  .listen(env.PORT)

// Startup logs
logger.success(`🦊 Elysia running at http://${app.server?.hostname}:${app.server?.port}`)
logger.info(`Environment: ${env.NODE_ENV}`)
logger.info(`Database: Connected`)

// Connect Redis with proper error handling
redis
  .connect()
  .then(async () => {
    logger.success('Redis: Connected')
    // Lazy load BullMQ workers only if Redis is ready
    try {
      const { autoExpireWorker: aew, autoCompleteWorker: acw, disbursementWorker: dw, notificationWorker: nw, autoResolveDisputesWorker: ardw, deleteExpiredCredentialsWorker: decw } = require('@/jobs/workers')
      const { deleteExpiredCredentialsQueue } = require('@/jobs/queues')
      
      autoExpireWorker = aew
      autoCompleteWorker = acw
      disbursementWorker = dw
      notificationWorker = nw
      autoResolveDisputesWorker = ardw
      deleteExpiredCredentialsWorker = decw
      logger.success('BullMQ workers: Initialized')

      // Schedule delete-expired-credentials to run every 30 minutes
      try {
        // Remove existing repeating jobs first
        const existingJobs = await deleteExpiredCredentialsQueue.getRepeatableJobs()
        for (const job of existingJobs) {
          if (job.name === 'delete-expired-credentials') {
            await deleteExpiredCredentialsQueue.removeRepeatableByKey(job.key)
          }
        }
        
        // Add new repeating job every 30 minutes
        await deleteExpiredCredentialsQueue.add(
          'delete-expired-credentials',
          {},
          {
            repeat: { pattern: '*/30 * * * *' }, // Every 30 minutes
            removeOnComplete: true,
            removeOnFail: false,
          }
        )
        logger.info('Scheduled delete-expired-credentials job (every 30 minutes)')
      } catch (error) {
        logger.warn('Failed to schedule delete-expired-credentials job', error)
      }
    } catch (error) {
      logger.warn('BullMQ workers failed to initialize', error)
    }
  })
  .catch((err) => {
    logger.error('Redis connection failed', err)
    // In production, you might want to exit if Redis is critical
    if (env.NODE_ENV === 'production') {
      logger.warn('Continuing without Redis (rate limiting disabled)')
    }
  })

// Graceful shutdown handler (consolidated)
async function gracefulShutdown(signal: string) {
  logger.info(`${signal} received, closing server...`)
  
  try {
    // Close BullMQ workers if initialized
    if (autoExpireWorker || autoCompleteWorker || disbursementWorker || notificationWorker || autoResolveDisputesWorker || deleteExpiredCredentialsWorker) {
      const workers = [autoExpireWorker, autoCompleteWorker, disbursementWorker, notificationWorker, autoResolveDisputesWorker, deleteExpiredCredentialsWorker].filter(Boolean)
      await Promise.all(workers.map((w) => w?.close?.()))
      logger.success('BullMQ workers closed')
    }
    
    // Close Redis connection
    await redis.quit()
    logger.success('Redis connection closed')
    
    // Close database connection
    await closeDatabase()
    logger.success('Database connection closed')
    
    process.exit(0)
  } catch (error) {
    logger.error('Error during shutdown', error)
    process.exit(1)
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

export type App = typeof app

export function createApp() {
  return app
}