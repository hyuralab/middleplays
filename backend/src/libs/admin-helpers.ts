/**
 * Reuseable admin dashboard helpers - Dynamic, flexible, production-ready
 * Consolidates ALL stats calculation, filtering, sorting, aggregation patterns
 */

import { db } from '@/db'
import { logger } from '@/libs/logger'

// ==================== GENERIC STATS BUILDER ====================

interface AggregationConfig {
  table: string
  aggregations: {
    [key: string]: {
      type: 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX'
      column: string
      alias: string
    }
  }
  where?: string
  groupBy?: string
}

/**
 * Generic aggregation query builder - works for ANY stats calculation
 */
export async function getAggregatedStats(config: AggregationConfig): Promise<any> {
  try {
    const aggregations = Object.values(config.aggregations)
      .map(agg => `${agg.type}(${agg.column})::numeric AS ${agg.alias}`)
      .join(', ')

    const groupByClause = config.groupBy ? `GROUP BY ${config.groupBy}` : ''
    const whereClause = config.where ? `WHERE ${config.where}` : ''

    const query = `
      SELECT ${aggregations}
      FROM ${config.table}
      ${whereClause}
      ${groupByClause}
    `

    const result = await db.unsafe(query) as any
    return result.length > 0 ? result[0] : null
  } catch (error) {
    logger.error(`Failed to get aggregated stats from ${config.table}`, error)
    throw error
  }
}

// ==================== GENERIC DASHBOARD STATS ====================

interface DashboardStatsConfig {
  tables: string[]
  metrics: {
    [key: string]: {
      table: string
      type: 'COUNT' | 'SUM' | 'AVG'
      column?: string
      where?: string
      alias: string
    }
  }
}

/**
 * Get multiple dashboard stats in parallel - highly efficient
 */
export async function getDashboardStats(config: DashboardStatsConfig): Promise<any> {
  try {
    const queries = Object.entries(config.metrics).map(([key, metric]) => {
      const countPart = metric.type === 'COUNT' ? 'COUNT(*)' : `${metric.type}(${metric.column})`
      const whereClause = metric.where ? `WHERE ${metric.where}` : ''
      
      return db.unsafe(`
        SELECT ${countPart}::numeric AS value
        FROM ${metric.table}
        ${whereClause}
      `) as any
    })

    const results = await Promise.all(queries)
    const stats: Record<string, any> = {}

    Object.entries(config.metrics).forEach(([ key], index) => {
      stats[key] = results[index]?.[0]?.value || 0
    })

    return stats
  } catch (error) {
    logger.error('Failed to get dashboard stats', error)
    throw error
  }
}

// ==================== GENERIC TIME-SERIES DATA ====================

interface TimeSeriesConfig {
  table: string
  dateColumn: string
  aggregateColumn?: string
  aggregationType: 'COUNT' | 'SUM' | 'AVG'
  interval: 'day' | 'week' | 'month'
  where?: string
  limit?: number
}

/**
 * Get time-series data (revenue over time, sales over time, etc) - works for ANY metric
 */
export async function getTimeSeriesData(config: TimeSeriesConfig): Promise<any[]> {
  try {
    const aggregateExpr = config.aggregateColumn 
      ? `${config.aggregationType}(${config.aggregateColumn})::numeric`
      : 'COUNT(*)::numeric'

    const intervalMap = {
      day: 'DATE',
      week: "DATE_TRUNC('week', %s)",
      month: "DATE_TRUNC('month', %s)",
    }

    const dateExpr = config.interval === 'day' 
      ? `DATE(${config.dateColumn})`
      : intervalMap[config.interval]?.replace('%s', config.dateColumn) || `DATE(${config.dateColumn})`

    const whereClause = config.where ? `AND ${config.where}` : ''

    const query = `
      SELECT 
        ${dateExpr} AS date,
        ${aggregateExpr} AS value
      FROM ${config.table}
      WHERE ${config.dateColumn} IS NOT NULL ${whereClause}
      GROUP BY ${dateExpr}
      ORDER BY date DESC
      ${config.limit ? `LIMIT ${config.limit}` : ''}
    `

    const result = await db.unsafe(query) as any
    return result || []
  } catch (error) {
    logger.error('Failed to get time series data', error)
    throw error
  }
}

// ==================== GENERIC TOP ITEMS ====================

interface TopItemsConfig {
  table: string
  selectColumns: string[]
  orderByColumn: string
  orderDirection: 'ASC' | 'DESC'
  where?: string
  limit?: number
  joinClauses?: string[]
}

/**
 * Get top N items (top sellers, top games, top earners, etc) - completely dynamic
 */
export async function getTopItems(config: TopItemsConfig): Promise<any[]> {
  try {
    const selectClause = config.selectColumns.join(', ')
    const whereClause = config.where ? `WHERE ${config.where}` : ''
    const joinClause = config.joinClauses?.join(' ') || ''
    const limit = config.limit || 10

    const query = `
      SELECT ${selectClause}
      FROM ${config.table}
      ${joinClause}
      ${whereClause}
      ORDER BY ${config.orderByColumn} ${config.orderDirection}
      LIMIT ${limit}
    `

    const result = await db.unsafe(query) as any
    return result || []
  } catch (error) {
    logger.error('Failed to get top items', error)
    throw error
  }
}

// ==================== GENERIC DISTRIBUTION ====================

interface DistributionConfig {
  table: string
  groupByColumn: string
  countColumn?: string
  where?: string
}

/**
 * Get distribution data (transactions by status, users by role, etc)
 */
export async function getDistribution(config: DistributionConfig): Promise<any[]> {
  try {
    const countExpr = config.countColumn ? `COUNT(${config.countColumn})` : 'COUNT(*)'
    const whereClause = config.where ? `WHERE ${config.where}` : ''

    const query = `
      SELECT 
        ${config.groupByColumn} AS category,
        ${countExpr}::numeric AS value
      FROM ${config.table}
      ${whereClause}
      GROUP BY ${config.groupByColumn}
      ORDER BY value DESC
    `

    const result = await db.unsafe(query) as any
    return result || []
  } catch (error) {
    logger.error('Failed to get distribution', error)
    throw error
  }
}

// ==================== GENERIC TREND COMPARISON ====================

/**
 * Compare metrics between time periods (this month vs last month, etc)
 */
export async function compareTrends(
  currentQuery: string,
  previousQuery: string
): Promise<{ current: number; previous: number; change: number; changePercent: number }> {
  try {
    const [currentResult, previousResult] = await Promise.all([
      db.unsafe(currentQuery) as any,
      db.unsafe(previousQuery) as any,
    ])

    const current = Number(currentResult?.[0]?.value || 0)
    const previous = Number(previousResult?.[0]?.value || 0)
    const change = current - previous
    const changePercent = previous === 0 ? 0 : (change / previous) * 100

    return { current, previous, change, changePercent }
  } catch (error) {
    logger.error('Failed to compare trends', error)
    throw error
  }
}

// ==================== GENERIC PAGINATION QUERY ====================

interface PaginatedQueryConfig {
  table: string
  selectColumns?: string[]
  where?: string
  orderBy?: string
  page: number
  limit: number
  joinClauses?: string[]
}

/**
 * Generic paginated query - works for ANY list with filtering
 */
export async function getPaginatedData(config: PaginatedQueryConfig): Promise<{
  data: any[]
  pagination: { page: number; limit: number; total: number; totalPages: number; offset: number }
}> {
  try {
    const selectClause = config.selectColumns?.join(', ') || '*'
    const whereClause = config.where ? `WHERE ${config.where}` : ''
    const orderClause = config.orderBy || 'id DESC'
    const joinClause = config.joinClauses?.join(' ') || ''

    const offset = (config.page - 1) * config.limit

    // Get data
    const dataQuery = `
      SELECT ${selectClause}
      FROM ${config.table}
      ${joinClause}
      ${whereClause}
      ORDER BY ${orderClause}
      LIMIT ${config.limit} OFFSET ${offset}
    `

    // Get total count
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM ${config.table}
      ${joinClause}
      ${whereClause}
    `

    const [dataResult, countResult] = await Promise.all([
      db.unsafe(dataQuery) as any,
      db.unsafe(countQuery) as any,
    ])

    const total = Number(countResult?.[0]?.total || 0)
    const totalPages = Math.ceil(total / config.limit)

    return {
      data: dataResult || [],
      pagination: {
        page: config.page,
        limit: config.limit,
        total,
        totalPages,
        offset,
      },
    }
  } catch (error) {
    logger.error('Failed to get paginated data', error)
    throw error
  }
}

// ==================== REUSEABLE SPECIFIC HELPERS ====================

/**
 * Get user metrics - active users, new users, etc
 */
export async function getUserMetrics(): Promise<any> {
  return getAggregatedStats({
    table: 'users',
    aggregations: {
      total: { type: 'COUNT', column: '*', alias: 'total_users' },
      admins: {
        type: 'COUNT',
        column: "CASE WHEN role = 'admin' THEN 1 END",
        alias: 'admin_count',
      },
    },
  })
}

/**
 * Get transaction metrics - volume, revenue, etc
 */
export async function getTransactionMetrics(): Promise<any> {
  return getAggregatedStats({
    table: 'transactions',
    aggregations: {
      completed: { type: 'COUNT', column: "CASE WHEN status = 'completed' THEN 1 END", alias: 'completed_count' },
      pending: { type: 'COUNT', column: "CASE WHEN status = 'pending' THEN 1 END", alias: 'pending_count' },
      totalVolume: { type: 'SUM', column: 'total_buyer_paid', alias: 'total_volume' },
      avgTransaction: { type: 'AVG', column: 'total_buyer_paid', alias: 'avg_transaction' },
    },
  })
}

/**
 * Get seller metrics - active sellers, rating distribution
 */
export async function getSellerMetrics(): Promise<any> {
  return getAggregatedStats({
    table: 'seller_stats',
    aggregations: {
      activeSellers: { type: 'COUNT', column: 'CASE WHEN total_sales > 0 THEN 1 END', alias: 'active_sellers' },
      avgRating: { type: 'AVG', column: 'average_rating', alias: 'avg_rating' },
      maxRating: { type: 'MAX', column: 'average_rating', alias: 'max_rating' },
      minRating: { type: 'MIN', column: 'average_rating', alias: 'min_rating' },
    },
  })
}

/**
 * Get game metrics - active games, posting count
 */
export async function getGameMetrics(): Promise<any> {
  return getAggregatedStats({
    table: 'games',
    aggregations: {
      totalGames: { type: 'COUNT', column: '*', alias: 'total_games' },
      activeGames: { type: 'COUNT', column: 'CASE WHEN is_active = true THEN 1 END', alias: 'active_games' },
    },
  })
}

/**
 * Get review metrics - average ratings, review volume
 */
export async function getReviewMetrics(): Promise<any> {
  return getAggregatedStats({
    table: 'reviews',
    aggregations: {
      totalReviews: { type: 'COUNT', column: '*', alias: 'total_reviews' },
      avgRating: { type: 'AVG', column: 'rating', alias: 'avg_rating' },
      highestRating: { type: 'MAX', column: 'rating', alias: 'highest_rating' },
      lowestRating: { type: 'MIN', column: 'rating', alias: 'lowest_rating' },
    },
  })
}

/**
 * Get revenue breakdown - platform fees, disbursements
 */
export async function getRevenueMetrics(): Promise<any> {
  return getAggregatedStats({
    table: 'transactions',
    where: "status = 'completed'",
    aggregations: {
      totalRevenue: { type: 'SUM', column: 'platform_fee_amount', alias: 'total_revenue' },
      avgFee: { type: 'AVG', column: 'platform_fee_amount', alias: 'avg_fee' },
      disbursementTotal: { type: 'SUM', column: 'disbursement_fee', alias: 'disbursement_total' },
    },
  })
}
