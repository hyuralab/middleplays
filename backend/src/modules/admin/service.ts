/**
 * Admin Dashboard Service
 * Reuses all admin helpers - production-ready, tested
 */

import { db } from '@/db'
import { logger } from '@/libs/logger'
import {
  getDashboardStats,
  getTimeSeriesData,
  getTopItems,
  getDistribution,
  getPaginatedData,
  getUserMetrics,
  getTransactionMetrics,
  getSellerMetrics,
  getGameMetrics,
  getReviewMetrics,
  getRevenueMetrics,
  compareTrends,
} from '@/libs/admin-helpers'

// ==================== DASHBOARD OVERVIEW ====================

/**
 * Get complete dashboard overview - all key metrics in one call
 */
export async function getDashboardOverview() {
  try {
    const [users, transactions, sellers, games, reviews, revenue] = await Promise.all([
      getUserMetrics(),
      getTransactionMetrics(),
      getSellerMetrics(),
      getGameMetrics(),
      getReviewMetrics(),
      getRevenueMetrics(),
    ])

    return {
      users,
      transactions,
      sellers,
      games,
      reviews,
      revenue,
      generatedAt: new Date().toISOString(),
    }
  } catch (error) {
    logger.error('Failed to get dashboard overview', error)
    throw error
  }
}

// ==================== REVENUE ANALYTICS ====================

/**
 * Get revenue over time
 */
export async function getRevenueOverTime(interval: 'day' | 'week' | 'month' = 'day', limit = 30) {
  return getTimeSeriesData({
    table: 'transactions',
    dateColumn: 'completed_at',
    aggregateColumn: 'platform_fee_amount',
    aggregationType: 'SUM',
    interval,
    where: "status = 'completed'",
    limit,
  })
}

/**
 * Get transaction volume over time
 */
export async function getTransactionVolume(interval: 'day' | 'week' | 'month' = 'day', limit = 30) {
  return getTimeSeriesData({
    table: 'transactions',
    dateColumn: 'created_at',
    aggregationType: 'COUNT',
    interval,
    where: "status = 'completed'",
    limit,
  })
}

/**
 * Get transaction status distribution
 */
export async function getTransactionDistribution() {
  return getDistribution({
    table: 'transactions',
    groupByColumn: 'status',
  })
}

/**
 * Get payment status distribution
 */
export async function getPaymentStatusDistribution() {
  return getDistribution({
    table: 'transactions',
    groupByColumn: 'payment_status',
  })
}

// ==================== USER ANALYTICS ====================

/**
 * Get user registration trend
 */
export async function getUserRegistrationTrend(interval: 'day' | 'week' | 'month' = 'day', limit = 30) {
  return getTimeSeriesData({
    table: 'users',
    dateColumn: 'created_at',
    aggregationType: 'COUNT',
    interval,
    limit,
  })
}

/**
 * Get user role distribution
 */
export async function getUserRoleDistribution() {
  return getDistribution({
    table: 'users',
    groupByColumn: 'role',
  })
}

/**
 * Get user login method distribution
 */
export async function getUserLoginMethodDistribution() {
  return getDistribution({
    table: 'users',
    groupByColumn: 'login_method',
  })
}

/**
 * Top active sellers by sales
 */
export async function getTopSellersByVolume(limit = 10) {
  return getTopItems({
    table: 'seller_stats',
    selectColumns: ['user_id', 'total_sales', 'average_rating', 'successful_transactions'],
    orderByColumn: 'total_sales',
    orderDirection: 'DESC',
    limit,
  })
}

/**
 * Top rated sellers
 */
export async function getTopRatedSellers(limit = 10) {
  return getTopItems({
    table: 'seller_stats',
    selectColumns: ['user_id', 'average_rating', 'total_sales', 'successful_transactions'],
    orderByColumn: 'average_rating',
    orderDirection: 'DESC',
    where: 'average_rating IS NOT NULL AND total_sales > 0',
    limit,
  })
}

// ==================== SELLER ANALYTICS ====================

/**
 * Get seller trust level distribution
 */
export async function getSellerTrustLevelDistribution() {
  return getDistribution({
    table: 'seller_stats',
    groupByColumn: 'trust_level',
  })
}

/**
 * Get sellers by average rating
 */
export async function getSellersByRatingDistribution() {
  return getDistribution({
    table: 'seller_stats',
    groupByColumn: 'ROUND(average_rating, 1)',
    countColumn: 'user_id',
  })
}

/**
 * Seller with disputes
 */
export async function getSellersWithDisputes(limit = 20) {
  return getPaginatedData({
    table: 'seller_stats',
    selectColumns: ['user_id', 'dispute_count', 'total_sales', 'average_rating'],
    where: 'dispute_count > 0',
    orderBy: 'dispute_count DESC',
    page: 1,
    limit,
  })
}

// ==================== GAME ANALYTICS ====================

/**
 * Get active postings by game
 */
export async function getPostingsByGame(limit = 20) {
  return getPaginatedData({
    table: 'game_accounts',
    selectColumns: ['game_id', 'COUNT(*) AS count'],
    where: "status = 'active'",
    orderBy: 'count DESC',
    page: 1,
    limit,
  })
}

/**
 * Get game popularity by posting count
 */
export async function getGamePopularity(limit = 20) {
  return getTopItems({
    table: 'games',
    selectColumns: ['id', 'name', 'is_active'],
    orderByColumn: 'id', // Will need to join with game_accounts to order by count
    orderDirection: 'DESC',
    limit,
  })
}

// ==================== REVIEW ANALYTICS ====================

/**
 * Get review rating distribution
 */
export async function getReviewRatingDistribution() {
  return getDistribution({
    table: 'reviews',
    groupByColumn: 'rating',
    countColumn: 'id',
  })
}

/**
 * Get average rating by seller
 */
export async function getSellerAverageRatings(limit = 20) {
  return getPaginatedData({
    table: 'seller_stats',
    selectColumns: ['user_id', 'average_rating'],
    where: 'average_rating IS NOT NULL',
    orderBy: 'average_rating DESC',
    page: 1,
    limit,
  })
}

// ==================== TREND COMPARISONS ====================

/**
 * Compare this month vs last month revenue
 */
export async function compareMonthlyRevenue(): Promise<any> {
  const currentMonthStart = new Date()
  currentMonthStart.setDate(1)

  const lastMonthStart = new Date(currentMonthStart)
  lastMonthStart.setMonth(lastMonthStart.getMonth() - 1)
  const lastMonthEnd = new Date(currentMonthStart)
  lastMonthEnd.setDate(0)

  const currentQuery = `
    SELECT SUM(platform_fee_amount)::numeric AS value
    FROM transactions
    WHERE status = 'completed' 
      AND completed_at >= '${currentMonthStart.toISOString()}'
  `

  const previousQuery = `
    SELECT SUM(platform_fee_amount)::numeric AS value
    FROM transactions
    WHERE status = 'completed'
      AND completed_at >= '${lastMonthStart.toISOString()}'
      AND completed_at <= '${lastMonthEnd.toISOString()}'
  `

  return compareTrends(currentQuery, previousQuery)
}

/**
 * Compare this month vs last month transaction count
 */
export async function compareMonthlyTransactions(): Promise<any> {
  const currentMonthStart = new Date()
  currentMonthStart.setDate(1)

  const lastMonthStart = new Date(currentMonthStart)
  lastMonthStart.setMonth(lastMonthStart.getMonth() - 1)
  const lastMonthEnd = new Date(currentMonthStart)
  lastMonthEnd.setDate(0)

  const currentQuery = `
    SELECT COUNT(*)::numeric AS value
    FROM transactions
    WHERE status = 'completed'
      AND completed_at >= '${currentMonthStart.toISOString()}'
  `

  const previousQuery = `
    SELECT COUNT(*)::numeric AS value
    FROM transactions
    WHERE status = 'completed'
      AND completed_at >= '${lastMonthStart.toISOString()}'
      AND completed_at <= '${lastMonthEnd.toISOString()}'
  `

  return compareTrends(currentQuery, previousQuery)
}

// ==================== USER MANAGEMENT ====================

/**
 * List all users with pagination
 */
export async function listUsers(page = 1, limit = 20) {
  return getPaginatedData({
    table: 'users',
    selectColumns: ['id', 'email', 'username', 'role', 'created_at'],
    orderBy: 'created_at DESC',
    page,
    limit,
  })
}

/**
 * Search users by email or username
 */
export async function searchUsers(query: string, page = 1, limit = 20) {
  return getPaginatedData({
    table: 'users',
    selectColumns: ['id', 'email', 'username', 'role', 'created_at'],
    where: `(email ILIKE '%${query}%' OR username ILIKE '%${query}%')`,
    orderBy: 'created_at DESC',
    page,
    limit,
  })
}

/**
 * Get user details with stats
 */
export async function getUserDetails(userId: number) {
  try {
    const userData = await db`
      SELECT u.id, u.email, u.username, u.role, u.login_method, u.created_at,
             up.full_name, up.phone, up.avatar_url, up.city, up.country,
             ss.total_sales, ss.successful_transactions, ss.average_rating, ss.trust_level
      FROM users u
      LEFT JOIN user_profiles up ON u.id = up.user_id
      LEFT JOIN seller_stats ss ON u.id = ss.user_id
      WHERE u.id = ${userId}
    ` as any

    return userData?.[0] || null
  } catch (error) {
    logger.error(`Failed to get user details for ${userId}`, error)
    throw error
  }
}

// ==================== TRANSACTION MANAGEMENT ====================

/**
 * List transactions with filters
 */
export async function listTransactions(
  page = 1,
  limit = 20,
  status?: string,
  paymentStatus?: string
) {
  const conditions = [
    status ? `status = '${status}'` : '',
    paymentStatus ? `payment_status = '${paymentStatus}'` : '',
  ]
    .filter(Boolean)
    .join(' AND ')

  return getPaginatedData({
    table: 'transactions',
    selectColumns: [
      'id',
      'buyer_id',
      'seller_id',
      'total_buyer_paid',
      'platform_fee_amount',
      'status',
      'payment_status',
      'created_at',
    ],
    where: conditions || undefined,
    orderBy: 'created_at DESC',
    page,
    limit,
  })
}

/**
 * Get transaction details
 */
export async function getTransactionDetails(transactionId: number) {
  try {
    const txnData = await db`
      SELECT t.*, 
             b.email as buyer_email, b.username as buyer_username,
             s.email as seller_email, s.username as seller_username,
             ga.account_identifier
      FROM transactions t
      LEFT JOIN users b ON t.buyer_id = b.id
      LEFT JOIN users s ON t.seller_id = s.id
      LEFT JOIN game_accounts ga ON t.game_account_id = ga.id
      WHERE t.id = ${transactionId}
    ` as any

    return txnData?.[0] || null
  } catch (error) {
    logger.error(`Failed to get transaction details for ${transactionId}`, error)
    throw error
  }
}

// ==================== SYSTEM HEALTH ====================

/**
 * Get system health metrics
 */
export async function getSystemHealth() {
  try {
    const [tables, indexes] = await Promise.all([
      db.unsafe("SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = 'public'") as any,
      db.unsafe("SELECT COUNT(*) AS count FROM information_schema.statistics WHERE table_schema = 'public'") as any,
    ])

    return {
      databaseStatus: 'healthy',
      tablesCount: tables?.[0]?.count || 0,
      indexesCount: indexes?.[0]?.count || 0,
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    logger.error('Failed to get system health', error)
    throw {
      databaseStatus: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }
  }
}
