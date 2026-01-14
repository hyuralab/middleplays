/**
 * Universal Route Handlers & Response Helpers
 * Provides reuseable patterns for consistent error handling, responses, and status codes
 * across all modules without over-engineering
 */

import { logger } from '@/libs/logger'
import type { Context } from 'elysia'

// ==================== RESPONSE HELPERS ====================

/**
 * Build success response with consistent format
 */
export function successResponse(data: any, pagination?: any) {
  return {
    success: true,
    data,
    ...(pagination && { pagination }),
  }
}

/**
 * Build paginated response
 */
export function paginatedResponse(data: any[], page: number, limit: number, total: number) {
  const totalPages = Math.ceil(total / limit)
  return {
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  }
}

/**
 * Build error response
 */
export function errorResponse(error: unknown, status: number = 500) {
  const message = error instanceof Error ? error.message : String(error)
  return { success: false, error: message, status }
}

// ==================== STATUS CODE MAPPERS ====================

/**
 * Map error message to appropriate HTTP status code
 */
export function getErrorStatus(errorMessage: string): number {
  if (errorMessage.includes('not found') || errorMessage.includes('No such')) {
    return 404
  }
  if (
    errorMessage.includes('not owned') ||
    errorMessage.includes('forbidden') ||
    errorMessage.includes('Unauthorized') ||
    errorMessage.includes('cannot')
  ) {
    return 403
  }
  if (
    errorMessage.includes('already') ||
    errorMessage.includes('duplicate') ||
    errorMessage.includes('exists')
  ) {
    return 400
  }
  if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
    return 400
  }
  return 500
}

// ==================== ROUTE HANDLER WRAPPERS ====================

/**
 * Wrap async route handlers with automatic error handling and logging
 * Returns error in response format, handles status codes based on error type
 */
export function handleRoute(handler: (context: any) => Promise<any>) {
  return async (context: any) => {
    try {
      return await handler(context)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const status = getErrorStatus(errorMessage)

      logger.error(`Route error [${status}]: ${errorMessage}`, error)

      context.set.status = status
      return {
        success: false,
        error: errorMessage,
      }
    }
  }
}

/**
 * Wrap route handler that requires authorization
 */
export function requireAuthRoute(handler: (context: any) => Promise<any>) {
  return handleRoute(async (context: any) => {
    const userId = (context as any).userId
    if (!userId) {
      context.set.status = 401
      throw new Error('Unauthorized: Please login')
    }
    return handler(context)
  })
}

/**
 * Wrap route handler that returns paginated data
 */
export function paginatedRoute(handler: (context: any) => Promise<{ data: any[]; total: number }>) {
  return handleRoute(async (context: any) => {
    const query = (context as any).query || {}
    const page = Number(query.page) || 1
    const limit = Math.min(Number(query.limit) || 20, 100) // Cap at 100

    const { data, total } = await handler(context)
    return paginatedResponse(data, page, limit, total)
  })
}

// ==================== VALIDATION HELPERS ====================

/**
 * Check if user owns resource (e.g., posting, profile)
 * Throws error if not owner
 */
export function validateOwnership(userId: number, ownerId: number, resource: string = 'resource') {
  if (userId !== ownerId) {
    throw new Error(`Forbidden: You do not own this ${resource}`)
  }
}

/**
 * Check if user is admin
 * Throws error if not admin
 */
export function validateAdmin(userRole: string) {
  if (userRole !== 'admin') {
    throw new Error('Forbidden: Admin access required')
  }
}

/**
 * Validate required fields in object
 */
export function validateRequired(obj: Record<string, any>, fields: string[]) {
  const missing = fields.filter((f) => !obj[f])
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`)
  }
}

// ==================== CONTEXT HELPERS ====================

/**
 * Safely get user ID from context
 */
export function getUserId(context: any): number {
  const userId = (context as any).userId
  if (!userId) {
    throw new Error('Unauthorized: User not authenticated')
  }
  return Number(userId)
}

/**
 * Safely get user from context with role
 */
export function getUser(context: any): { id: number; role: string } {
  const userId = (context as any).userId
  const user = (context as any).user

  if (!userId || !user) {
    throw new Error('Unauthorized: User not authenticated')
  }

  return {
    id: Number(userId),
    role: (user as any).role || 'user',
  }
}

/**
 * Safely get query parameter with type coercion
 */
export function getQueryParam(
  query: Record<string, any>,
  key: string,
  defaultValue: any = null,
  type: 'string' | 'number' | 'boolean' = 'string'
) {
  const value = query[key] ?? defaultValue

  if (value === null || value === undefined) {
    return defaultValue
  }

  if (type === 'number') {
    return Number(value)
  }

  if (type === 'boolean') {
    return value === 'true' || value === true
  }

  return String(value)
}

// ==================== TRANSACTION HELPERS ====================

/**
 * Execute operation in database transaction with error handling
 */
export async function withTransaction(db: any, handler: (tx: any) => Promise<any>) {
  try {
    return await db.begin((tx: any) => handler(tx))
  } catch (error) {
    logger.error('Transaction failed', error)
    throw error
  }
}

// ==================== LOGGING HELPERS ====================

/**
 * Log operation success with details
 */
export function logSuccess(operation: string, details?: Record<string, any>) {
  logger.info(`✓ ${operation}`, details)
}

/**
 * Log operation failure with error details
 */
export function logError(operation: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  logger.error(`✗ ${operation}: ${message}`, error)
}
