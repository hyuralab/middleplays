import { Type, Static } from '@sinclair/typebox'

// ==================== DASHBOARD SCHEMAS ====================

export const dashboardOverviewSchema = Type.Object({
  users: Type.Object({
    total_users: Type.Number(),
    admin_count: Type.Number(),
  }),
  transactions: Type.Object({
    completed_count: Type.Number(),
    pending_count: Type.Number(),
    total_volume: Type.Union([Type.Number(), Type.Null()]),
    avg_transaction: Type.Union([Type.Number(), Type.Null()]),
  }),
  sellers: Type.Object({
    active_sellers: Type.Number(),
    avg_rating: Type.Union([Type.Number(), Type.Null()]),
    max_rating: Type.Union([Type.Number(), Type.Null()]),
    min_rating: Type.Union([Type.Number(), Type.Null()]),
  }),
  games: Type.Object({
    total_games: Type.Number(),
    active_games: Type.Number(),
  }),
  reviews: Type.Object({
    total_reviews: Type.Number(),
    avg_rating: Type.Union([Type.Number(), Type.Null()]),
    highest_rating: Type.Union([Type.Number(), Type.Null()]),
    lowest_rating: Type.Union([Type.Number(), Type.Null()]),
  }),
  revenue: Type.Object({
    total_revenue: Type.Union([Type.Number(), Type.Null()]),
    avg_fee: Type.Union([Type.Number(), Type.Null()]),
    disbursement_total: Type.Union([Type.Number(), Type.Null()]),
  }),
  generatedAt: Type.String(),
})

export const timeSeriesDataSchema = Type.Array(
  Type.Object({
    date: Type.String(),
    value: Type.Number(),
  })
)

export const distributionSchema = Type.Array(
  Type.Object({
    category: Type.String(),
    value: Type.Number(),
  })
)

export const trendComparisonSchema = Type.Object({
  current: Type.Number(),
  previous: Type.Number(),
  change: Type.Number(),
  changePercent: Type.Number(),
})

// ==================== USER MANAGEMENT SCHEMAS ====================

export const userListSchema = Type.Object({
  id: Type.Number(),
  email: Type.String(),
  username: Type.String(),
  role: Type.String(),
  created_at: Type.Date(),
})

export const userListResponseSchema = Type.Object({
  data: Type.Array(userListSchema),
  pagination: Type.Object({
    page: Type.Number(),
    limit: Type.Number(),
    total: Type.Number(),
    totalPages: Type.Number(),
    offset: Type.Number(),
  }),
})

export const userDetailsSchema = Type.Object({
  id: Type.Number(),
  email: Type.String(),
  username: Type.String(),
  role: Type.String(),
  login_method: Type.String(),
  created_at: Type.Date(),
  full_name: Type.Union([Type.String(), Type.Null()]),
  phone: Type.Union([Type.String(), Type.Null()]),
  avatar_url: Type.Union([Type.String(), Type.Null()]),
  city: Type.Union([Type.String(), Type.Null()]),
  country: Type.Union([Type.String(), Type.Null()]),
  total_sales: Type.Union([Type.Number(), Type.Null()]),
  successful_transactions: Type.Union([Type.Number(), Type.Null()]),
  average_rating: Type.Union([Type.Number(), Type.Null()]),
  trust_level: Type.Union([Type.String(), Type.Null()]),
})

// ==================== TRANSACTION SCHEMAS ====================

export const transactionListSchema = Type.Object({
  id: Type.Number(),
  buyer_id: Type.Number(),
  seller_id: Type.Number(),
  total_buyer_paid: Type.Number(),
  platform_fee_amount: Type.Number(),
  status: Type.String(),
  payment_status: Type.String(),
  created_at: Type.Date(),
})

export const transactionListResponseSchema = Type.Object({
  data: Type.Array(transactionListSchema),
  pagination: Type.Object({
    page: Type.Number(),
    limit: Type.Number(),
    total: Type.Number(),
    totalPages: Type.Number(),
    offset: Type.Number(),
  }),
})

export const transactionDetailsSchema = Type.Object({
  id: Type.Number(),
  buyer_id: Type.Number(),
  seller_id: Type.Number(),
  buyer_email: Type.Union([Type.String(), Type.Null()]),
  buyer_username: Type.Union([Type.String(), Type.Null()]),
  seller_email: Type.Union([Type.String(), Type.Null()]),
  seller_username: Type.Union([Type.String(), Type.Null()]),
  account_identifier: Type.Union([Type.String(), Type.Null()]),
  total_buyer_paid: Type.Number(),
  platform_fee_amount: Type.Number(),
  status: Type.String(),
  payment_status: Type.String(),
  created_at: Type.Date(),
})

// ==================== SYSTEM HEALTH SCHEMAS ====================

export const systemHealthSchema = Type.Object({
  databaseStatus: Type.String(),
  tablesCount: Type.Number(),
  indexesCount: Type.Number(),
  timestamp: Type.String(),
})

// ==================== QUERY PARAMETERS SCHEMAS ====================

export const paginationQuerySchema = Type.Object({
  page: Type.Optional(Type.Number({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100, default: 20 })),
})

export const userSearchQuerySchema = Type.Object({
  query: Type.String({ minLength: 1 }),
  page: Type.Optional(Type.Number({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100, default: 20 })),
})

export const transactionFilterQuerySchema = Type.Object({
  page: Type.Optional(Type.Number({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100, default: 20 })),
  status: Type.Optional(
    Type.Union([
      Type.Literal('pending'),
      Type.Literal('paid'),
      Type.Literal('processing'),
      Type.Literal('completed'),
      Type.Literal('disputed'),
      Type.Literal('refunded'),
      Type.Literal('cancelled'),
    ])
  ),
  paymentStatus: Type.Optional(
    Type.Union([
      Type.Literal('pending'),
      Type.Literal('paid'),
      Type.Literal('failed'),
      Type.Literal('expired'),
    ])
  ),
})

export const timeSeriesQuerySchema = Type.Object({
  interval: Type.Optional(Type.Union([Type.Literal('day'), Type.Literal('week'), Type.Literal('month')], { default: 'day' })),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 365, default: 30 })),
})

// ==================== ADMIN RESPONSE WRAPPERS ====================

export const adminSuccessResponseSchema = (dataSchema: any) =>
  Type.Object({
    success: Type.Literal(true),
    data: dataSchema,
  })

export const adminErrorResponseSchema = Type.Object({
  success: Type.Literal(false),
  error: Type.String(),
  code: Type.Optional(Type.String()),
  timestamp: Type.String(),
})
