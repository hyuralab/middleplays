import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'

// Config & validation
import { env, validateEnv } from '@/configs/env'

// Plugins
import { jwtPlugin } from '@/plugins/jwt'
import { errorHandler } from '@/plugins/error-handler'
import { globalRateLimit } from '@/plugins/rate-limit'

// Database & Redis
import { db } from '@/db'
import { redis } from '@/libs/redis'
import { logger } from '@/libs/logger'

// Modules (will be implemented later)
// import { authModule } from '@/modules/auth'
// import { usersModule } from '@/modules/users'
// import { gamesModule } from '@/modules/games'
// import { postingsModule } from '@/modules/postings'
// import { transactionsModule } from '@/modules/transactions'

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
  .get('/health', () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  }))

  // API info
  .get('/', () => ({
    name: 'Game Store API',
    version: '1.0.0',
    docs: '/health',
  }))

  // Mount modules (commented out until implemented)
  // .use(authModule)
  // .use(usersModule)
  // .use(gamesModule)
  // .use(postingsModule)
  // .use(transactionsModule)

  .listen(env.PORT)

// Startup logs
logger.success(`🦊 Elysia running at http://${app.server?.hostname}:${app.server?.port}`)
logger.info(`Environment: ${env.NODE_ENV}`)
logger.info(`Database: Connected`)

// Connect Redis
redis
  .connect()
  .then(() => logger.success('Redis: Connected'))
  .catch((err) => logger.error('Redis connection failed', err))

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing server...')
  await redis.quit()
  process.exit(0)
})

process.on('SIGINT', async () => {
  logger.info('SIGINT received, closing server...')
  await redis.quit()
  process.exit(0)
})

export type App = typeof app