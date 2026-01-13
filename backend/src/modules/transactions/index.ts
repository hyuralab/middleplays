import { Elysia } from 'elysia'
import { requireAuth } from '@/middlewares/auth'
import { idempotencyPlugin, cacheIdempotentResponse, checkUserRateLimit } from '@/plugins/idempotency'
import {
  createPurchaseSchema,
  createPurchaseResponseSchema,
} from './model'
import {
  createPurchase
} from './service'

export const transactionsModule = new Elysia({ prefix: '/transactions', name: 'transactions-module' })
  .use(idempotencyPlugin)
  .use(requireAuth) // All routes in this module require authentication

  // ==================== CREATE NEW PURCHASE ====================
  .post(
    '/purchase',
    async ({ userId, body, set, idempotencyKey }) => {
      try {
        // Rate limit: max 1 purchase per 5 seconds per user
        await checkUserRateLimit(userId!, '/purchase', 1, 5)

        const result = await createPurchase(userId!, body);
        
        set.status = 201; // 201 Created
        const response = {
          success: true,
          data: {
            transactionId: result.transactionId,
            paymentUrl: result.paymentUrl,
            expiresAt: result.expiresAt,
          },
        }

        // Cache for idempotency
        await cacheIdempotentResponse(idempotencyKey, 201, response)
        return response
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        
        if (errorMessage.includes('no longer available') || errorMessage.includes('not available')) {
          set.status = 400
          return {
            success: false,
            error: 'Bad Request',
            message: 'This account is no longer available for purchase.',
          }
        }
        
        if (errorMessage.includes('cannot purchase your own')) {
          set.status = 400
          return {
            success: false,
            error: 'Bad Request',
            message: 'You cannot purchase your own posting.',
          }
        }
        
        throw error
      }
    },
    {
      body: createPurchaseSchema,
      detail: {
        tags: ['Transactions'],
        summary: 'Initiate a purchase for a game account',
        description: 'Creates a transaction record and returns a payment link from the payment gateway.',
      },
    }
  )
