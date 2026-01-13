import { Type, Static } from '@sinclair/typebox'

// Schema untuk create posting
export const createPostingSchema = Type.Object({
  game_id: Type.Number({ minimum: 1 }),
  account_identifier: Type.String({ minLength: 1, maxLength: 255 }),
  price: Type.Number({ minimum: 1000, description: "Price in IDR" }),
  description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  field_values: Type.Optional(Type.Record(Type.String(), Type.Any())),
  cover_image_url: Type.Optional(Type.Union([Type.String(), Type.Null()])),
})

export type CreatePostingRequest = Static<typeof createPostingSchema>

// Schema untuk list postings query
export const listPostingsQuerySchema = Type.Object({
  page: Type.Optional(Type.Number({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100, default: 20 })),
  game_id: Type.Optional(Type.Number({ minimum: 1 })),
  seller_id: Type.Optional(Type.Number({ minimum: 1 })),
  minPrice: Type.Optional(Type.Number({ minimum: 0 })),
  maxPrice: Type.Optional(Type.Number({ minimum: 0 })),
  sortBy: Type.Optional(Type.Union([
    Type.Literal('newest'),
    Type.Literal('oldest'),
    Type.Literal('price_asc'),
    Type.Literal('price_desc'),
  ])),
  search: Type.Optional(Type.String()),
})

export type ListPostingsQuery = Static<typeof listPostingsQuerySchema>
// Response schemas
export const createPostingResponseSchema = Type.Object({
  success: Type.Boolean(),
  data: Type.Object({
    id: Type.Number(),
    cover_image_url: Type.Union([Type.String(), Type.Null()]),
  }),
})

export const listPostingsResponseSchema = Type.Object({
  success: Type.Boolean(),
  data: Type.Array(Type.Object({
    id: Type.Number(),
    account_identifier: Type.String(),
    price: Type.Number(),
    description: Type.Union([Type.String(), Type.Null()]),
    status: Type.String(),
    created_at: Type.String(),
    game_name: Type.String(),
    seller_id: Type.Number(),
    seller_username: Type.String(),
    seller_full_name: Type.Union([Type.String(), Type.Null()]),
    seller_avatar_url: Type.Union([Type.String(), Type.Null()]),
    seller_rating: Type.Union([Type.Number(), Type.Null()]),
  })),
  pagination: Type.Object({
    page: Type.Number(),
    limit: Type.Number(),
    total: Type.Number(),
    totalPages: Type.Number(),
  }),
})