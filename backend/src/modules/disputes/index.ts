import { Elysia } from 'elysia'
import { requireAuth } from '@/middlewares/auth'
import { idempotencyPlugin, cacheIdempotentResponse, checkUserRateLimit } from '@/plugins/idempotency'
import {
  createDisputeSchema,
  addDisputeMessageSchema,
  listDisputesQuerySchema,
  resolveDisputeSchema,
  type DisputeRecord,
} from './model'
import {
  createDispute,
  getDisputeDetail,
  listDisputes,
  addDisputeMessage,
  resolveDispute,
} from './service'

export const disputesModule = new Elysia({ prefix: '/disputes', name: 'disputes-module' })
  .use(idempotencyPlugin)
  .use(requireAuth)

  // ==================== CREATE DISPUTE ====================
  .post(
    '/',
    async ({ userId, body, set, idempotencyKey }) => {
      try {
        const userIdNum = Number(userId)
        await checkUserRateLimit(userIdNum, 'create_dispute', 5, 3600)
        const dispute = await createDispute(userIdNum, body)

        set.status = 201
        const response = {
          success: true,
          data: {
            id: dispute.id,
            transactionId: dispute.transaction_id,
            buyerId: dispute.buyer_id,
            buyerName: '',
            sellerId: dispute.seller_id,
            sellerName: '',
            reason: dispute.reason,
            description: dispute.description,
            status: dispute.status,
            resolution: dispute.resolution,
            refundPercentage: dispute.refund_percentage,
            notes: dispute.notes,
            evidenceUrls: dispute.evidence_urls || [],
            messages: [],
            createdAt: dispute.created_at,
            resolvedAt: dispute.resolved_at,
            autoResolveAt: dispute.auto_resolve_at,
          },
        }

        await cacheIdempotentResponse(idempotencyKey, 201, response)
        return response
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        if (errorMessage.includes('not found')) {
          set.status = 404
          return {
            success: false,
            error: 'Not Found',
            message: 'Transaction not found.',
          }
        }
        if (errorMessage.includes('already exists')) {
          set.status = 409
          return {
            success: false,
            error: 'Conflict',
            message: 'An active dispute already exists for this transaction.',
          }
        }
        throw error
      }
    },
    {
      body: createDisputeSchema,
      detail: {
        tags: ['Disputes'],
        summary: 'Create a new dispute',
        description: 'Initiate a dispute for a transaction with reason and evidence.',
      },
    }
  )

  // ==================== GET DISPUTE DETAILS ====================
  .get(
    '/:disputeId',
    async ({ userId, params, set }) => {
      try {
        const userIdNum = Number(userId)
        const disputeData = await getDisputeDetail(params.disputeId, userIdNum)
        const dispute = disputeData as unknown as (DisputeRecord & { buyerName: string; sellerName: string; messages: any[] })

        const response = {
          success: true,
          data: {
            id: dispute.id,
            transactionId: dispute.transaction_id,
            buyerId: dispute.buyer_id,
            buyerName: dispute.buyerName,
            sellerId: dispute.seller_id,
            sellerName: dispute.sellerName,
            reason: dispute.reason,
            description: dispute.description,
            status: dispute.status,
            resolution: dispute.resolution,
            refundPercentage: dispute.refund_percentage,
            notes: dispute.notes,
            evidenceUrls: dispute.evidence_urls || [],
            messages: dispute.messages.map((m: any) => ({
              id: m.id,
              senderId: m.sender_id,
              senderName: m.sender_name,
              message: m.message,
              attachments: m.attachments || [],
              createdAt: m.created_at,
            })),
            createdAt: dispute.created_at,
            resolvedAt: dispute.resolved_at,
            autoResolveAt: dispute.auto_resolve_at,
          },
        }
        return response
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        if (errorMessage.includes('not found') || errorMessage.includes('access denied')) {
          set.status = 404
          return {
            success: false,
            error: 'Not Found',
            message: 'Dispute not found.',
          }
        }
        throw error
      }
    },
    {
      detail: {
        tags: ['Disputes'],
        summary: 'Get dispute details',
        description: 'Retrieve full dispute details including all messages.',
      },
    }
  )

  // ==================== LIST DISPUTES ====================
  .get(
    '/',
    async ({ userId, query }) => {
      const userIdNum = Number(userId)
      const { status, reason, page = 1, limit = 10 } = query
      const result = await listDisputes(userIdNum, {
        status: status as string | undefined,
        reason: reason as string | undefined,
        page: Number(page),
        limit: Number(limit),
      })

      return {
        success: true,
        data: result.disputes.map((d: any) => ({
          id: d.id,
          transactionId: d.transaction_id,
          buyerId: d.buyer_id,
          buyerName: d.buyer_name,
          sellerId: d.seller_id,
          sellerName: d.seller_name,
          reason: d.reason,
          description: d.description,
          status: d.status,
          resolution: d.resolution,
          refundPercentage: d.refund_percentage,
          notes: d.notes,
          evidenceUrls: d.evidence_urls || [],
          createdAt: d.created_at,
          resolvedAt: d.resolved_at,
          autoResolveAt: d.auto_resolve_at,
        })),
        pagination: result.pagination,
      }
    },
    {
      query: listDisputesQuerySchema,
      detail: {
        tags: ['Disputes'],
        summary: 'List disputes',
        description: 'Get all disputes where user is involved, with optional filters.',
      },
    }
  )

  // ==================== ADD DISPUTE MESSAGE ====================
  .post(
    '/:disputeId/messages',
    async ({ userId, params, body, set, idempotencyKey }) => {
      try {
        const userIdNum = Number(userId)
        await checkUserRateLimit(userIdNum, `dispute_msg_${params.disputeId}`, 30, 3600)
        const message = await addDisputeMessage(params.disputeId, userIdNum, body)

        set.status = 201
        const response = {
          success: true,
          data: {
            id: message.id,
            senderId: message.sender_id,
            senderName: '',
            message: message.message,
            attachments: message.attachments || [],
            createdAt: message.created_at,
          },
        }

        await cacheIdempotentResponse(idempotencyKey, 201, response)
        return response
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        if (errorMessage.includes('not found') || errorMessage.includes('access denied')) {
          set.status = 404
          return {
            success: false,
            error: 'Not Found',
            message: 'Dispute not found.',
          }
        }
        if (errorMessage.includes('closed')) {
          set.status = 409
          return {
            success: false,
            error: 'Conflict',
            message: 'Cannot add messages to closed dispute.',
          }
        }
        throw error
      }
    },
    {
      body: addDisputeMessageSchema,
      detail: {
        tags: ['Disputes'],
        summary: 'Add message to dispute',
        description: 'Add evidence, arguments, or responses to dispute thread.',
      },
    }
  )

  // ==================== RESOLVE DISPUTE (ADMIN ONLY) ====================
  .patch(
    '/:disputeId',
    async ({ userId, params, body, set }) => {
      try {
        const userIdNum = Number(userId)
        const dispute = await resolveDispute(params.disputeId, userIdNum, body)

        const response = {
          success: true,
          data: {
            id: dispute.id,
            transactionId: dispute.transaction_id,
            buyerId: dispute.buyer_id,
            buyerName: '',
            sellerId: dispute.seller_id,
            sellerName: '',
            reason: dispute.reason,
            description: dispute.description,
            status: dispute.status,
            resolution: dispute.resolution,
            refundPercentage: dispute.refund_percentage,
            notes: dispute.notes,
            evidenceUrls: dispute.evidence_urls || [],
            messages: [],
            createdAt: dispute.created_at,
            resolvedAt: dispute.resolved_at,
            autoResolveAt: dispute.auto_resolve_at,
          },
        }
        return response
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        if (errorMessage.includes('not found')) {
          set.status = 404
          return {
            success: false,
            error: 'Not Found',
            message: 'Dispute not found.',
          }
        }
        if (errorMessage.includes('already resolved')) {
          set.status = 409
          return {
            success: false,
            error: 'Conflict',
            message: 'This dispute is already resolved.',
          }
        }
        throw error
      }
    },
    {
      body: resolveDisputeSchema,
      detail: {
        tags: ['Disputes'],
        summary: 'Resolve dispute (Admin)',
        description: 'Admin endpoint to resolve dispute with decision and optional refund.',
      },
    }
  )

