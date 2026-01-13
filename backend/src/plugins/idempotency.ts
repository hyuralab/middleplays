import { Elysia } from 'elysia'
import { redisHelpers } from '@/libs/redis'
import { logger } from '@/libs/logger'

interface CachedResponse {
  status: number
  body: any
}

/**
 * Idempotency middleware - prevents duplicate requests
 * Client sends: idempotency-key header
 */
export const idempotencyPlugin = new Elysia({ name: 'idempotency' })
  .derive({ as: 'global' }, async ({ request }) => {
    const idempotencyKey = request.headers.get('idempotency-key')
    return { idempotencyKey: idempotencyKey || null }
  })
  .onBeforeHandle({ as: 'global' }, async ({ request, idempotencyKey, set }) => {
    if (!['POST', 'PUT'].includes(request.method) || !idempotencyKey) return

    const cacheKey = `idempotent:${idempotencyKey}`
    const cachedResponse = await redisHelpers.getCache<CachedResponse>(cacheKey)

    if (cachedResponse) {
      logger.info(`Returning cached response for idempotency-key: ${idempotencyKey}`)
      set.status = cachedResponse.status
      return cachedResponse.body
    }
  })

export async function cacheIdempotentResponse(
  idempotencyKey: string | null,
  status: number,
  body: any,
) {
  if (idempotencyKey) {
    const cacheKey = `idempotent:${idempotencyKey}`
    await redisHelpers.setCache(cacheKey, { status, body }, 3600)
    logger.debug(`Cached idempotent response for key: ${idempotencyKey}`)
  }
}

/**
 * Per-user rate limiting for sensitive endpoints
 */
export async function checkUserRateLimit(
  userId: number,
  endpoint: string,
  limit: number = 1,
  window: number = 5
): Promise<void> {
  const key = `ratelimit:user:${userId}:${endpoint}`
  const script = `
    local current = redis.call('INCR', KEYS[1])
    if current == 1 then
      redis.call('EXPIRE', KEYS[1], ARGV[1])
    end
    return current
  `
  
  try {
    const redis = await import('@/libs/redis').then(m => m.redis)
    const current = await redis.eval(script, 1, key, window.toString()) as number

    if (current > limit) {
      throw new Error(`Too many requests. Please try again in ${window} seconds.`)
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('Too many requests')) {
      throw error
    }
    logger.warn('Rate limit check failed, allowing request', error)
  }
}
