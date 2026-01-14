import { Type, Static } from '@sinclair/typebox'

// ==================== ENUMS ====================

export const DisputeStatusEnum = Type.Union([
  Type.Literal('open'),
  Type.Literal('in_review'),
  Type.Literal('resolved'),
  Type.Literal('auto_resolved'),
  Type.Literal('closed'),
])

export const DisputeReasonEnum = Type.Union([
  Type.Literal('account_not_received'),
  Type.Literal('incorrect_account'),
  Type.Literal('account_banned'),
  Type.Literal('seller_unresponsive'),
  Type.Literal('other'),
])

export const ResolutionTypeEnum = Type.Union([
  Type.Literal('refund_buyer'),
  Type.Literal('in_favor_seller'),
  Type.Literal('partial_refund'),
  Type.Literal('auto_resolved'),
])

// ==================== REQUEST SCHEMAS ====================

export const createDisputeSchema = Type.Object({
  transactionId: Type.String({ minLength: 1 }),
  reason: DisputeReasonEnum,
  description: Type.String({ minLength: 10, maxLength: 1000 }),
  evidence: Type.Optional(Type.Array(Type.String({ format: 'uri' }), { maxItems: 5 })),
})

export const addDisputeMessageSchema = Type.Object({
  message: Type.String({ minLength: 1, maxLength: 1000 }),
  attachments: Type.Optional(Type.Array(Type.String({ format: 'uri' }), { maxItems: 3 })),
})

export const resolveDisputeSchema = Type.Object({
  resolution: ResolutionTypeEnum,
  refundPercentage: Type.Optional(Type.Number({ minimum: 0, maximum: 100 })),
  notes: Type.Optional(Type.String({ maxLength: 500 })),
})

export const listDisputesQuerySchema = Type.Object({
  status: Type.Optional(DisputeStatusEnum),
  reason: Type.Optional(DisputeReasonEnum),
  page: Type.Optional(Type.Number({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100, default: 10 })),
})

// ==================== RESPONSE SCHEMAS ====================

export const disputeMessageSchema = Type.Object({
  id: Type.String(),
  senderId: Type.Number(),
  senderName: Type.String(),
  message: Type.String(),
  attachments: Type.Array(Type.String({ format: 'uri' })),
  createdAt: Type.Date(),
})

export const disputeDetailSchema = Type.Object({
  id: Type.String(),
  transactionId: Type.String(),
  buyerId: Type.Number(),
  buyerName: Type.String(),
  sellerId: Type.Number(),
  sellerName: Type.String(),
  reason: DisputeReasonEnum,
  description: Type.String(),
  status: DisputeStatusEnum,
  resolution: Type.Optional(ResolutionTypeEnum),
  refundPercentage: Type.Optional(Type.Number()),
  notes: Type.Optional(Type.String()),
  evidenceUrls: Type.Array(Type.String({ format: 'uri' })),
  messages: Type.Array(disputeMessageSchema),
  createdAt: Type.Date(),
  resolvedAt: Type.Optional(Type.Date()),
  autoResolveAt: Type.Date(),
})

export const createDisputeResponseSchema = Type.Object({
  success: Type.Boolean(),
  data: disputeDetailSchema,
})

export const listDisputesResponseSchema = Type.Object({
  success: Type.Boolean(),
  data: Type.Array(Type.Omit(disputeDetailSchema, ['messages'])),
  pagination: Type.Object({
    page: Type.Number(),
    limit: Type.Number(),
    total: Type.Number(),
    pages: Type.Number(),
  }),
})

export const resolveDisputeResponseSchema = Type.Object({
  success: Type.Boolean(),
  data: disputeDetailSchema,
})

// ==================== TYPES ====================

export type DisputeStatus = Static<typeof DisputeStatusEnum>
export type DisputeReason = Static<typeof DisputeReasonEnum>
export type ResolutionType = Static<typeof ResolutionTypeEnum>

export type CreateDisputeRequest = Static<typeof createDisputeSchema>
export type AddDisputeMessageRequest = Static<typeof addDisputeMessageSchema>
export type ResolveDisputeRequest = Static<typeof resolveDisputeSchema>
export type ListDisputesQuery = Static<typeof listDisputesQuerySchema>

export interface DisputeRecord {
  id: string
  transaction_id: string
  buyer_id: number
  seller_id: number
  reason: DisputeReason
  description: string
  status: DisputeStatus
  resolution: ResolutionType | null
  refund_percentage: number | null
  notes: string | null
  evidence_urls: string[] | null
  created_at: Date
  resolved_at: Date | null
  auto_resolve_at: Date
  updated_at: Date
}

export interface DisputeMessage {
  id: string
  dispute_id: string
  sender_id: number
  message: string
  attachments: string[] | null
  created_at: Date
}
