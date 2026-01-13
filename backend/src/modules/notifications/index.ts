import { Elysia } from 'elysia'
import { logger } from '@/libs/logger'

// Notifications module - to be implemented with BullMQ in next session
export const notificationsModule = new Elysia({ prefix: '/notifications', name: 'notifications-module' })
  .get('/', async () => {
    return {
      success: true,
      message: 'Notifications module placeholder - coming soon with BullMQ integration'
    }
  })
  .onError(({ error }) => {
    logger.error('Notifications error:', error)
    return {
      success: false,
      error: 'Notifications service error'
    }
  })
