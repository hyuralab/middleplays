import { Elysia } from 'elysia'
import { requireAuth } from '@/middlewares/auth'
import {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
} from './service'
import {
  successResponse,
  getUserId,
  handleRoute,
  getQueryParam,
  logSuccess,
} from '@/libs/route-helpers'

export const notificationsModule = new Elysia({ prefix: '/notifications', name: 'notifications' })
  .use(requireAuth)

  // ==================== GET NOTIFICATIONS ====================
  .get(
    '/',
    handleRoute(async (context: any) => {
      const userId = getUserId(context)
      const limit = getQueryParam(context.query, 'limit', 20, 'number')
      const offset = getQueryParam(context.query, 'offset', 0, 'number')

      const result = await getUserNotifications(userId, Math.min(limit, 100), offset)
      logSuccess('Fetched notifications', { userId, limit, offset, total: result.total })

      return {
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          limit,
          offset,
          hasMore: offset + limit < result.total,
        },
      }
    }),
    {
      detail: {
        tags: ['Notifications'],
        summary: 'Get user notifications',
        description: 'Fetch paginated notifications for authenticated user',
      },
    }
  )

  // ==================== GET UNREAD COUNT ====================
  .get(
    '/unread/count',
    handleRoute(async (context: any) => {
      const userId = getUserId(context)
      const unread = await getUnreadCount(userId)
      logSuccess('Got unread count', { userId, unread })

      return successResponse({ unread })
    }),
    {
      detail: {
        tags: ['Notifications'],
        summary: 'Get unread notification count',
      },
    }
  )

  // ==================== MARK AS READ ====================
  .put(
    '/:notificationId/read',
    handleRoute(async (context: any) => {
      const userId = getUserId(context)
      const notificationId = Number(context.params.notificationId)

      await markAsRead(notificationId, userId)
      logSuccess('Marked notification as read', { notificationId, userId })

      return successResponse({ message: 'Notification marked as read' })
    }),
    {
      detail: {
        tags: ['Notifications'],
        summary: 'Mark notification as read',
      },
    }
  )

  // ==================== MARK ALL AS READ ====================
  .put(
    '/read/all',
    handleRoute(async (context: any) => {
      const userId = getUserId(context)

      await markAllAsRead(userId)
      logSuccess('Marked all notifications as read', { userId })

      return successResponse({ message: 'All notifications marked as read' })
    }),
    {
      detail: {
        tags: ['Notifications'],
        summary: 'Mark all notifications as read',
      },
    }
  )

  // ==================== DELETE NOTIFICATION ====================
  .delete(
    '/:notificationId',
    handleRoute(async (context: any) => {
      const userId = getUserId(context)
      const notificationId = Number(context.params.notificationId)

      await deleteNotification(notificationId, userId)
      logSuccess('Deleted notification', { notificationId, userId })

      return successResponse({ message: 'Notification deleted' })
    }),
    {
      detail: {
        tags: ['Notifications'],
        summary: 'Delete a notification',
      },
    }
  )

  // ==================== DELETE ALL NOTIFICATIONS ====================
  .delete(
    '/delete/all',
    handleRoute(async (context: any) => {
      const userId = getUserId(context)

      await deleteAllNotifications(userId)
      logSuccess('Deleted all notifications', { userId })

      return successResponse({ message: 'All notifications deleted' })
    }),
    {
      detail: {
        tags: ['Notifications'],
        summary: 'Delete all notifications',
      },
    }
  )
