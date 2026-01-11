import Redis from 'ioredis'
import { env } from '@/configs/env'

export const redis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000)
    return delay
  },
  lazyConnect: true, // Don't connect immediately
})

// Connection event handlers
redis.on('connect', () => {
  console.log('✅ Redis connected')
})

redis.on('ready', () => {
  console.log('✅ Redis ready')
})

redis.on('error', (err) => {
  console.error('❌ Redis error:', err.message)
})

redis.on('close', () => {
  console.log('⚠️  Redis connection closed')
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('⏳ Closing Redis connection...')
  await redis.quit()
  console.log('✅ Redis connection closed')
})

// Helper functions
export const redisHelpers = {
  // Cache with expiry
  async setCache(key: string, value: any, ttlSeconds = 3600) {
    await redis.setex(key, ttlSeconds, JSON.stringify(value))
  },
  
  async getCache<T>(key: string): Promise<T | null> {
    const data = await redis.get(key)
    return data ? JSON.parse(data) : null
  },
  
  async deleteCache(key: string) {
    await redis.del(key)
  },
  
  async deleteCachePattern(pattern: string) {
    const keys = await redis.keys(pattern)
    if (keys.length > 0) {
      await redis.del(...keys)
    }
  },
}