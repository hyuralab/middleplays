import { Elysia } from 'elysia'
import { Type } from '@sinclair/typebox'
import { requireAuth } from '@/middlewares/auth'
import { idempotencyPlugin, cacheIdempotentResponse, checkUserRateLimit } from '@/plugins/idempotency'
import { env } from '@/configs/env'
import { verifyXenditSignature, validateXenditWebhookPayload } from '@/libs/xendit-verify'
import {
  createPurchaseSchema,
  createPurchaseResponseSchema,
} from './model'
import {
  createPurchase,
  fetchCredentials,
  handlePaymentSuccess,
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
        await checkUserRateLimit(Number(userId!), '/purchase', 1, 5)

        const result = await createPurchase(Number(userId!), body);
        
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

  // ==================== FETCH CREDENTIALS ====================
  .get(
    '/:transactionId/credentials',
    async ({ userId, params, set }) => {
      try {
        const transactionId = parseInt(params.transactionId)
        
        if (!userId) {
          set.status = 401
          return { success: false, error: 'Unauthorized' }
        }

        const result = await fetchCredentials(transactionId, Number(userId!))
        
        set.status = 200
        return {
          success: true,
          data: result,
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)

        if (errorMessage.includes('not found') || errorMessage.includes('not the buyer')) {
          set.status = 404
          return {
            success: false,
            error: 'Not Found',
            message: 'Transaction not found or you are not the buyer.',
          }
        }

        if (errorMessage.includes('only available after')) {
          set.status = 400
          return {
            success: false,
            error: 'Bad Request',
            message: 'Credentials only available after transaction is completed.',
          }
        }

        throw error
      }
    },
    {
      detail: {
        tags: ['Transactions'],
        summary: 'Fetch account credentials (after purchase completion)',
        description: 'Get credentials for a completed transaction. Credentials expire 10 minutes after first access. Returns error if transaction not completed.',
      },
    }
  )

  // ==================== XENDIT WEBHOOK ====================
  .post(
    '/webhook/xendit',
    async ({ body, set, request }) => {
      try {
        // Get signature from header
        const signature = request.headers.get('x-xendit-webhook-token')
        const payload = JSON.stringify(body)

        // Verify webhook is from Xendit (prevents replay attacks)
        if (!verifyXenditSignature(signature, payload, env.XENDIT_SECRET_KEY || '')) {
          set.status = 401
          return {
            success: false,
            error: 'Unauthorized',
            message: 'Invalid webhook signature',
          }
        }

        // Validate webhook payload structure
        if (!validateXenditWebhookPayload(body)) {
          set.status = 400
          return {
            success: false,
            error: 'Bad Request',
            message: 'Invalid webhook payload',
          }
        }

        // Only process successful payment webhooks
        const invoice = body as any
        if (invoice.status !== 'PAID') {
          set.status = 200
          return { success: true, message: 'Webhook received but not a payment' }
        }

        // Process payment
        await handlePaymentSuccess(invoice.id)

        set.status = 200
        return {
          success: true,
          message: 'Payment processed successfully',
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error('Xendit webhook error:', errorMessage)
        // Return 200 so Xendit doesn't retry - we log the error for manual review
        set.status = 200
        return {
          success: false,
          message: 'Webhook processing failed, check logs',
        }
      }
    },
    {
      body: Type.Object({
        invoiceId: Type.String(),
      }),
      detail: {
        tags: ['Transactions'],
        summary: 'Xendit payment webhook',
        description: 'Receives payment notifications from Xendit. Signature-verified. Do not call manually.',
      },
    }
  )
