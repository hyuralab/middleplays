import { Type, Static } from '@sinclair/typebox'

// ==================== SCHEMAS ====================

export const createReviewSchema = Type.Object({
  transactionId: Type.Number({ minimum: 1 }),
  rating: Type.Number({
    minimum: 1,
    maximum: 5,
    description: 'Rating from 1 to 5 stars',
  }),
  comment: Type.Optional(Type.String({
    minLength: 0,
    maxLength: 500,
  })),
})

export const addReviewResponseSchema = Type.Object({
  responseText: Type.String({
    minLength: 1,
    maxLength: 500,
    description: 'Response from the reviewed user',
  }),
})

export const listReviewsQuerySchema = Type.Object({
  userId: Type.Optional(Type.Number({ minimum: 1 })),
  sortBy: Type.Optional(Type.Union([
    Type.Literal('newest'),
    Type.Literal('oldest'),
    Type.Literal('highest_rating'),
    Type.Literal('lowest_rating'),
  ])),
  page: Type.Optional(Type.Number({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 50, default: 20 })),
})

// ==================== RESPONSE SCHEMAS ====================

export const reviewResponseSchema = Type.Object({
  id: Type.Number(),
  transactionId: Type.Number(),
  reviewerId: Type.Number(),
  reviewerName: Type.Union([Type.String(), Type.Null()]),
  reviewerAvatar: Type.Union([Type.String(), Type.Null()]),
  reviewedUserId: Type.Number(),
  rating: Type.Number(),
  comment: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.Date(),
  updatedAt: Type.Date(),
})

export const reviewDetailResponseSchema = Type.Object({
  id: Type.Number(),
  transactionId: Type.Number(),
  reviewerId: Type.Number(),
  reviewerName: Type.Union([Type.String(), Type.Null()]),
  reviewerAvatar: Type.Union([Type.String(), Type.Null()]),
  reviewedUserId: Type.Number(),
  rating: Type.Number(),
  comment: Type.Union([Type.String(), Type.Null()]),
  responses: Type.Array(Type.Object({
    id: Type.Number(),
    responderId: Type.Number(),
    responderName: Type.Union([Type.String(), Type.Null()]),
    responderAvatar: Type.Union([Type.String(), Type.Null()]),
    responseText: Type.String(),
    createdAt: Type.Date(),
  })),
  createdAt: Type.Date(),
  updatedAt: Type.Date(),
})

export const listReviewsResponseSchema = Type.Object({
  success: Type.Boolean(),
  data: Type.Array(reviewResponseSchema),
  pagination: Type.Object({
    page: Type.Number(),
    limit: Type.Number(),
    total: Type.Number(),
    totalPages: Type.Number(),
  }),
})

export const createReviewResponseSchema = Type.Object({
  success: Type.Boolean(),
  data: Type.Object({
    id: Type.Number(),
  }),
})

export const getReviewResponseSchema = Type.Object({
  success: Type.Boolean(),
  data: reviewDetailResponseSchema,
})

export const addResponseResponseSchema = Type.Object({
  success: Type.Boolean(),
  message: Type.String(),
})

// ==================== TYPES ====================

export type CreateReviewRequest = Static<typeof createReviewSchema>
export type AddReviewResponseRequest = Static<typeof addReviewResponseSchema>
export type ListReviewsQuery = Static<typeof listReviewsQuerySchema>
