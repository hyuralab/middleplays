import { Type, Static } from '@sinclair/typebox'

// ==================== SCHEMAS ====================

export const notificationSchema = Type.Object({
  id: Type.Number(),
  user_id: Type.Number(),
  type: Type.String(),
  title: Type.String(),
  message: Type.String(),
  related_id: Type.Union([Type.Number(), Type.Null()]),
  is_read: Type.Boolean(),
  created_at: Type.Date(),
  updated_at: Type.Date(),
})

export const getNotificationsResponseSchema = Type.Object({
  success: Type.Boolean(),
  data: Type.Array(notificationSchema),
  pagination: Type.Object({
    total: Type.Number(),
    limit: Type.Number(),
    offset: Type.Number(),
    hasMore: Type.Boolean(),
  }),
})

export const getUnreadCountResponseSchema = Type.Object({
  success: Type.Boolean(),
  data: Type.Object({
    unread: Type.Number(),
  }),
})

export const markAsReadResponseSchema = Type.Object({
  success: Type.Boolean(),
  message: Type.String(),
})

export const markAllAsReadResponseSchema = Type.Object({
  success: Type.Boolean(),
  data: Type.Object({
    marked: Type.Number(),
  }),
})

export const deleteNotificationResponseSchema = Type.Object({
  success: Type.Boolean(),
  message: Type.String(),
})

// ==================== TYPES ====================

export type Notification = Static<typeof notificationSchema>
export type GetNotificationsResponse = Static<typeof getNotificationsResponseSchema>
export type GetUnreadCountResponse = Static<typeof getUnreadCountResponseSchema>
export type MarkAsReadResponse = Static<typeof markAsReadResponseSchema>
export type MarkAllAsReadResponse = Static<typeof markAllAsReadResponseSchema>
export type DeleteNotificationResponse = Static<typeof deleteNotificationResponseSchema>
