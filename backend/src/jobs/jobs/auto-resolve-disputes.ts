import { autoResolveExpiredDisputes } from '@/modules/disputes/service'
import { logger } from '@/libs/logger'

/**
 * Auto-resolve disputes that have reached 30-day deadline
 * Runs daily at 2 AM
 */
export async function autoResolveDisputesJob() {
  try {
    logger.info('Starting auto-resolve disputes job...')
    
    const result = await autoResolveExpiredDisputes()
    
    logger.success(`Auto-resolve job completed: ${result.count} disputes resolved`)
    
    return {
      success: true,
      resolvedCount: result.count,
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    logger.error('Auto-resolve disputes job failed:', error)
    throw error
  }
}
