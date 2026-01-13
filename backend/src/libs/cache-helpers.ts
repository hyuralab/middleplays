import { redisHelpers } from './redis'
import { db } from '@/db'
import { logger } from './logger'

// Cache strategies with different TTLs
export const CACHE_TTL = {
  GAME: 86400,  // 24 hours
  SELLER_STATS: 600,  // 10 minutes
  USER_PROFILE: 3600,  // 1 hour
}

// Cache game data
export async function getCachedGame(gameId: number) {
  const cacheKey = `game:${gameId}`
  
  const cached = await redisHelpers.getCache(cacheKey)
  if (cached) {
    logger.debug(`Cache hit: game ${gameId}`)
    return cached
  }
  
  const games = await db`SELECT * FROM games WHERE id = ${gameId} AND is_active = true`
  if (!games || games.length === 0) throw new Error('Game not found')
  
  const game = games[0]
  await redisHelpers.setCache(cacheKey, game, CACHE_TTL.GAME)
  return game
}

// Cache seller stats
export async function getCachedSellerStats(sellerId: number) {
  const cacheKey = `seller_stats:${sellerId}`
  
  const cached = await redisHelpers.getCache(cacheKey)
  if (cached) {
    logger.debug(`Cache hit: seller_stats ${sellerId}`)
    return cached
  }
  
  const stats = await db`SELECT * FROM seller_stats WHERE user_id = ${sellerId}`
  if (!stats || stats.length === 0) {
    const newStats = await db`
      INSERT INTO seller_stats (user_id) VALUES (${sellerId})
      RETURNING *
    `
    const stat = newStats[0]!
    await redisHelpers.setCache(cacheKey, stat, CACHE_TTL.SELLER_STATS)
    return stat
  }
  
  const stat = stats[0]
  await redisHelpers.setCache(cacheKey, stat, CACHE_TTL.SELLER_STATS)
  return stat
}

// Invalidate caches
export async function invalidateGameCache(gameId: number) {
  await redisHelpers.deleteCache(`game:${gameId}`)
}

export async function invalidateSellerCache(sellerId: number) {
  await redisHelpers.deleteCache(`seller_stats:${sellerId}`)
  await redisHelpers.deleteCache(`profile:${sellerId}`)
}
