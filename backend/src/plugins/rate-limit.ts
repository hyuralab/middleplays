import { Elysia } from 'elysia'
import { redis } from '@/libs/redis'
import { logger } from '@/libs/logger'

interface RateLimitOptions {
  max: number // Max requests
  window: number // Time window in seconds
}

export const rateLimitPlugin = new Elysia({ name: 'rate-limit' }).derive(
  () => ({
    checkRateLimit: async (key: string, options: RateLimitOptions) => {
      const { max, window } = options
      const redisKey = `ratelimit:${key}`

      try {
        const current = await redis.incr(redisKey)

        if (current === 1) {
          await redis.expire(redisKey, window)
        }

        if (current > max) {
          throw new Error('Too many requests. Please try again later.')
        }

        return {
          current,
          remaining: Math.max(0, max - current),
          reset: await redis.ttl(redisKey),
        }
      } catch (error) {
        // If Redis fails, allow request (fail open)
        logger.warn('Rate limit check failed, allowing request', { error })
        return { current: 0, remaining: max, reset: window }
      }
    },
  })
)

// Global rate limit middleware
export const globalRateLimit = new Elysia({ name: 'global-rate-limit' })
  .use(rateLimitPlugin)
  .onBeforeHandle(async ({ request, checkRateLimit }) => {
    const ip = request.headers.get('x-forwarded-for') || 'unknown'

    try {
      await checkRateLimit(`global:${ip}`, {
        max: 100, // 100 requests
        window: 60, // per 60 seconds
      })
    } catch (error) {
      // If rate limit exceeded, error will be thrown and caught by error handler
      throw error
    }
  })