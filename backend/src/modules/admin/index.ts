import { Elysia } from 'elysia'
import { authMiddleware } from '@/middlewares/auth'
import { logger } from '@/libs/logger'
import {
  getDashboardOverview,
  getRevenueOverTime,
  getTransactionVolume,
  getTransactionDistribution,
  getPaymentStatusDistribution,
  getUserRegistrationTrend,
  getUserRoleDistribution,
  getUserLoginMethodDistribution,
  getTopSellersByVolume,
  getTopRatedSellers,
  getSellerTrustLevelDistribution,
  getSellersByRatingDistribution,
  getSellersWithDisputes,
  getPostingsByGame,
  getGamePopularity,
  getReviewRatingDistribution,
  getSellerAverageRatings,
  compareMonthlyRevenue,
  compareMonthlyTransactions,
  listUsers,
  searchUsers,
  getUserDetails,
  listTransactions,
  getTransactionDetails,
  getSystemHealth,
} from './service'

export const adminModule = new Elysia({ prefix: '/admin', name: 'admin' })
  .use(authMiddleware)
  .guard(
    {
      beforeHandle({ user, set }) {
        if (!user || (user as any).role !== 'admin') {
          set.status = 403
          throw new Error('Forbidden: Admin access required')
        }
      },
    },
    (app) =>
      app
        // ==================== DASHBOARD ====================
        .get(
          '/dashboard/overview',
          async () => {
            try {
              const data = await getDashboardOverview()
              return { success: true, data }
            } catch (error) {
              logger.error('Failed to get dashboard overview', error)
              throw error
            }
          },
          {
            detail: {
              tags: ['Admin - Dashboard'],
              summary: 'Get dashboard overview with all key metrics',
              description: 'Returns comprehensive dashboard data with user, transaction, seller, game, review, and revenue metrics',
            },
          }
        )

        // ==================== REVENUE ANALYTICS ====================
        .get(
          '/analytics/revenue-over-time',
          async ({ query }: any) => {
            try {
              const data = await getRevenueOverTime(query.interval, query.limit)
              return { success: true, data }
            } catch (error) {
              logger.error('Failed to get revenue over time', error)
              throw error
            }
          },
          {
            detail: {
              tags: ['Admin - Analytics'],
              summary: 'Get revenue over time',
            },
          }
        )

        .get(
          '/analytics/transaction-volume',
          async ({ query }: any) => {
            try {
              const data = await getTransactionVolume(query.interval, query.limit)
              return { success: true, data }
            } catch (error) {
              logger.error('Failed to get transaction volume', error)
              throw error
            }
          },
          {
            detail: {
              tags: ['Admin - Analytics'],
              summary: 'Get transaction volume over time',
            },
          }
        )

        .get(
          '/analytics/transaction-distribution',
          async () => {
            try {
              const data = await getTransactionDistribution()
              return { success: true, data }
            } catch (error) {
              logger.error('Failed to get transaction distribution', error)
              throw error
            }
          },
          {
            detail: {
              tags: ['Admin - Analytics'],
              summary: 'Get transaction status distribution',
            },
          }
        )

        .get(
          '/analytics/payment-distribution',
          async () => {
            try {
              const data = await getPaymentStatusDistribution()
              return { success: true, data }
            } catch (error) {
              logger.error('Failed to get payment distribution', error)
              throw error
            }
          },
          {
            detail: {
              tags: ['Admin - Analytics'],
              summary: 'Get payment status distribution',
            },
          }
        )

        // ==================== USER ANALYTICS ====================
        .get(
          '/analytics/user-registration',
          async ({ query }: any) => {
            try {
              const data = await getUserRegistrationTrend(query.interval, query.limit)
              return { success: true, data }
            } catch (error) {
              logger.error('Failed to get user registration trend', error)
              throw error
            }
          },
          {
            detail: {
              tags: ['Admin - Analytics'],
              summary: 'Get user registration trend',
            },
          }
        )

        .get(
          '/analytics/user-roles',
          async () => {
            try {
              const data = await getUserRoleDistribution()
              return { success: true, data }
            } catch (error) {
              logger.error('Failed to get user role distribution', error)
              throw error
            }
          },
          {
            detail: {
              tags: ['Admin - Analytics'],
              summary: 'Get user role distribution',
            },
          }
        )

        .get(
          '/analytics/user-login-methods',
          async () => {
            try {
              const data = await getUserLoginMethodDistribution()
              return { success: true, data }
            } catch (error) {
              logger.error('Failed to get user login method distribution', error)
              throw error
            }
          },
          {
            detail: {
              tags: ['Admin - Analytics'],
              summary: 'Get user login method distribution',
            },
          }
        )

        // ==================== SELLER ANALYTICS ====================
        .get(
          '/analytics/top-sellers-volume',
          async ({ query }: any) => {
            try {
              const data = await getTopSellersByVolume(query.limit || 10)
              return { success: true, data }
            } catch (error) {
              logger.error('Failed to get top sellers by volume', error)
              throw error
            }
          },
          {
            detail: {
              tags: ['Admin - Analytics'],
              summary: 'Get top sellers by sales volume',
            },
          }
        )

        .get(
          '/analytics/top-rated-sellers',
          async ({ query }: any) => {
            try {
              const data = await getTopRatedSellers(query.limit || 10)
              return { success: true, data }
            } catch (error) {
              logger.error('Failed to get top rated sellers', error)
              throw error
            }
          },
          {
            detail: {
              tags: ['Admin - Analytics'],
              summary: 'Get top rated sellers',
            },
          }
        )

        .get(
          '/analytics/seller-trust-levels',
          async () => {
            try {
              const data = await getSellerTrustLevelDistribution()
              return { success: true, data }
            } catch (error) {
              logger.error('Failed to get seller trust level distribution', error)
              throw error
            }
          },
          {
            detail: {
              tags: ['Admin - Analytics'],
              summary: 'Get seller trust level distribution',
            },
          }
        )

        .get(
          '/analytics/seller-disputes',
          async ({ query }: any) => {
            try {
              const data = await getSellersWithDisputes(query.limit || 20)
              return { success: true, data }
            } catch (error) {
              logger.error('Failed to get sellers with disputes', error)
              throw error
            }
          },
          {
            detail: {
              tags: ['Admin - Analytics'],
              summary: 'Get sellers with disputes',
            },
          }
        )

        // ==================== REVIEW ANALYTICS ====================
        .get(
          '/analytics/review-ratings',
          async () => {
            try {
              const data = await getReviewRatingDistribution()
              return { success: true, data }
            } catch (error) {
              logger.error('Failed to get review rating distribution', error)
              throw error
            }
          },
          {
            detail: {
              tags: ['Admin - Analytics'],
              summary: 'Get review rating distribution',
            },
          }
        )

        // ==================== TREND COMPARISONS ====================
        .get(
          '/analytics/compare-monthly-revenue',
          async () => {
            try {
              const data = await compareMonthlyRevenue()
              return { success: true, data }
            } catch (error) {
              logger.error('Failed to compare monthly revenue', error)
              throw error
            }
          },
          {
            detail: {
              tags: ['Admin - Analytics'],
              summary: 'Compare monthly revenue (this month vs last month)',
            },
          }
        )

        .get(
          '/analytics/compare-monthly-transactions',
          async () => {
            try {
              const data = await compareMonthlyTransactions()
              return { success: true, data }
            } catch (error) {
              logger.error('Failed to compare monthly transactions', error)
              throw error
            }
          },
          {
            detail: {
              tags: ['Admin - Analytics'],
              summary: 'Compare monthly transactions (this month vs last month)',
            },
          }
        )

        // ==================== USER MANAGEMENT ====================
        .get(
          '/users',
          async ({ query }: any) => {
            try {
              const data = await listUsers(query.page, query.limit)
              return { success: true, data: data.data, pagination: data.pagination }
            } catch (error) {
              logger.error('Failed to list users', error)
              throw error
            }
          },
          {
            detail: {
              tags: ['Admin - User Management'],
              summary: 'List all users with pagination',
            },
          }
        )

        .get(
          '/users/search',
          async ({ query }: any) => {
            try {
              const data = await searchUsers(query.query, query.page, query.limit)
              return { success: true, data: data.data, pagination: data.pagination }
            } catch (error) {
              logger.error('Failed to search users', error)
              throw error
            }
          },
          {
            detail: {
              tags: ['Admin - User Management'],
              summary: 'Search users by email or username',
            },
          }
        )

        .get(
          '/users/:userId',
          async ({ params }: any) => {
            try {
              const data = await getUserDetails(Number(params.userId))
              if (!data) {
                throw new Error('User not found')
              }
              return { success: true, data }
            } catch (error) {
              logger.error(`Failed to get user details`, error)
              throw error
            }
          },
          {
            detail: {
              tags: ['Admin - User Management'],
              summary: 'Get user details with stats',
            },
          }
        )

        // ==================== TRANSACTION MANAGEMENT ====================
        .get(
          '/transactions',
          async ({ query }: any) => {
            try {
              const data = await listTransactions(query.page, query.limit, query.status, query.paymentStatus)
              return { success: true, data: data.data, pagination: data.pagination }
            } catch (error) {
              logger.error('Failed to list transactions', error)
              throw error
            }
          },
          {
            detail: {
              tags: ['Admin - Transaction Management'],
              summary: 'List transactions with filters',
            },
          }
        )

        .get(
          '/transactions/:transactionId',
          async ({ params }: any) => {
            try {
              const data = await getTransactionDetails(Number(params.transactionId))
              if (!data) {
                throw new Error('Transaction not found')
              }
              return { success: true, data }
            } catch (error) {
              logger.error(`Failed to get transaction details`, error)
              throw error
            }
          },
          {
            detail: {
              tags: ['Admin - Transaction Management'],
              summary: 'Get transaction details',
            },
          }
        )

        // ==================== SYSTEM HEALTH ====================
        .get(
          '/system/health',
          async () => {
            try {
              const data = await getSystemHealth()
              return { success: true, data }
            } catch (error) {
              logger.error('Failed to get system health', error)
              throw error
            }
          },
          {
            detail: {
              tags: ['Admin - System'],
              summary: 'Get system health metrics',
            },
          }
        )
        .onError(({ code, error, set }) => {
          if (code === 'VALIDATION') {
            set.status = 400
            return { success: false, error: 'Validation failed' }
          }
          const errorMsg = error instanceof Error ? error.message : 'Internal server error'
          if (errorMsg.includes('Admin access required')) {
            set.status = 403
            return { success: false, error: errorMsg }
          }
          if (errorMsg.includes('not found')) {
            set.status = 404
            return { success: false, error: errorMsg }
          }
          set.status = 500
          return { success: false, error: 'Internal server error' }
        })
  )
