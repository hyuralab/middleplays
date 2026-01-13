// Notifications module - to be implemented with BullMQ in next session
// Stub structure for type safety
import { Type, Static } from '@sinclair/typebox'

export const notificationSchema = Type.Object({
  id: Type.Number(),
  userId: Type.Number(),
  type: Type.String(),
  title: Type.String(),
  message: Type.String(),
  relatedId: Type.Optional(Type.Number()),
  isRead: Type.Boolean(),
  createdAt: Type.Date(),
})

export type Notification = Static<typeof notificationSchema>
