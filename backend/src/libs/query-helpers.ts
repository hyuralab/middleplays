/**
 * Common database query helpers to reduce code duplication
 * Used across all service modules
 */

import { db } from '@/db'
import { logger } from '@/libs/logger'

/**
 * Fetch single record and throw if not found
 */
export async function fetchOne<T>(
  query: any,
  errorMessage: string,
  logContext?: string
): Promise<T> {
  try {
    const result = await query as any
    if (!result || result.length === 0) {
      throw new Error(errorMessage)
    }
    return result[0]
  } catch (error) {
    if (error instanceof Error && error.message === errorMessage) {
      throw error
    }
    if (logContext) {
      logger.error(logContext, error)
    }
    throw error
  }
}

/**
 * Fetch multiple records and ensure not empty
 */
export async function fetchMany<T>(
  query: any,
  errorMessage: string,
  allowEmpty: boolean = false,
  logContext?: string
): Promise<T[]> {
  try {
    const result = await query as any
    if (!allowEmpty && (!result || result.length === 0)) {
      throw new Error(errorMessage)
    }
    return result || []
  } catch (error) {
    if (error instanceof Error && error.message === errorMessage) {
      throw error
    }
    if (logContext) {
      logger.error(logContext, error)
    }
    throw error
  }
}

/**
 * Fetch single user by ID with common fields
 */
export async function getUserById(userId: number | string) {
  return fetchOne(
    db`SELECT id, email, role, is_verified, created_at FROM users WHERE id = ${userId}`,
    'User not found',
    `Failed to fetch user ${userId}`
  )
}

/**
 * Fetch user with name
 */
export async function getUserName(userId: number) {
  return fetchOne(
    db`SELECT id, google_name FROM users WHERE id = ${userId}` as any,
    'User not found',
    `Failed to fetch user name for ${userId}`
  )
}

/**
 * Count records with WHERE clause
 */
export async function countRecords(tableName: string, whereClause: any): Promise<number> {
  try {
    const result = await db.unsafe(`SELECT COUNT(*) as total FROM ${tableName} WHERE ${whereClause}`) as any
    return Number(result[0]?.total || 0)
  } catch (error) {
    logger.error(`Failed to count records in ${tableName}`, error)
    return 0
  }
}

/**
 * Check if record exists
 */
export async function recordExists(query: any): Promise<boolean> {
  try {
    const result = await query as any
    return result && result.length > 0
  } catch (error) {
    logger.error('Failed to check record existence', error)
    return false
  }
}

/**
 * Validate transaction exists and get details
 */
export async function getTransaction(transactionId: number) {
  return fetchOne(
    db`SELECT id, buyer_id, seller_id, status, payment_status FROM transactions WHERE id = ${transactionId}`,
    'Transaction not found',
    `Failed to fetch transaction ${transactionId}`
  )
}

/**
 * Validate game exists and is active
 */
export async function getActiveGame(gameId: number) {
  return fetchOne(
    db`SELECT id, name, is_active FROM games WHERE id = ${gameId} AND is_active = true`,
    'Game not found or inactive',
    `Failed to fetch active game ${gameId}`
  )
}

/**
 * Validate review exists
 */
export async function getReview(reviewId: number) {
  return fetchOne(
    db`SELECT id, transaction_id, reviewer_id, reviewed_user_id FROM reviews WHERE id = ${reviewId}`,
    'Review not found',
    `Failed to fetch review ${reviewId}`
  )
}

/**
 * Validate posting exists and is available
 */
export async function getActivePosting(postingId: number) {
  return fetchOne(
    db`SELECT id, seller_id, price, status, account_identifier FROM game_accounts WHERE id = ${postingId} AND status = 'active'`,
    'Posting not found or no longer available',
    `Failed to fetch active posting ${postingId}`
  )
}

/**
 * Parse pagination params with safe defaults
 */
export function parsePagination(page?: number | string, limit?: number | string, maxLimit: number = 100) {
  const p = Math.max(1, Number(page) || 1)
  const l = Math.min(Math.max(1, Number(limit) || 20), maxLimit)
  const offset = (p - 1) * l
  return { page: p, limit: l, offset }
}

/**
 * Calculate pagination metadata
 */
export function calculatePagination(page: number, limit: number, total: number) {
  const totalPages = Math.ceil(total / limit)
  const hasNext = page < totalPages
  const hasPrev = page > 1

  return {
    page,
    limit,
    total,
    totalPages,
    hasNext,
    hasPrev,
  }
}

/**
 * Safe SQL LIKE search with wildcards
 */
export function buildLikeSearch(searchTerm: string): string {
  return `%${searchTerm.replace(/[%_]/g, '\\$&')}%`
}

/**
 * Build WHERE clause from filter object dynamically
 */
export function buildWhereClause(filters: Record<string, any>): string {
  const clauses = Object.entries(filters)
    .filter(([_, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key} IN (${value.map((v) => `'${v}'`).join(',')})`
      }
      if (typeof value === 'string') {
        return `${key} = '${value.replace(/'/g, "''")}'`
      }
      return `${key} = ${value}`
    })

  return clauses.length > 0 ? clauses.join(' AND ') : '1=1'
}

/**
 * Safe ORDER BY builder
 */
export function buildOrderBy(sortBy: string = 'created_at', direction: 'ASC' | 'DESC' = 'DESC'): string {
  // Whitelist allowed sort fields to prevent SQL injection
  const allowed = ['id', 'created_at', 'updated_at', 'name', 'price', 'rating', 'total']
  const field = allowed.includes(sortBy) ? sortBy : 'created_at'
  const dir = direction === 'ASC' ? 'ASC' : 'DESC'
  return `${field} ${dir}`
}

