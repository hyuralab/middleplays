import { Elysia } from 'elysia'
import { logger } from '@/libs/logger'

export const errorHandler = new Elysia({ name: 'error-handler' })
  .onError(({ code, error, set }) => {
    logger.error(`[${code}] ${error.message}`, {
      stack: error.stack,
    })

    switch (code) {
      case 'VALIDATION':
        set.status = 400
        return {
          success: false,
          error: 'Validation Error',
          message: error.message,
        }

      case 'NOT_FOUND':
        set.status = 404
        return {
          success: false,
          error: 'Not Found',
          message: error.message,
        }

      case 'PARSE':
        set.status = 400
        return {
          success: false,
          error: 'Parse Error',
          message: 'Invalid request body',
        }

      case 'INTERNAL_SERVER_ERROR':
        set.status = 500
        return {
          success: false,
          error: 'Internal Server Error',
          message: 'An unexpected error occurred',
        }

      case 'UNKNOWN':
      default:
        set.status = 500
        return {
          success: false,
          error: 'Server Error',
          message: error.message,
        }
    }
  })