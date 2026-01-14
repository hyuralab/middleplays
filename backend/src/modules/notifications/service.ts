import { db } from '@/db'
import { logger } from '@/libs/logger'

export type NotificationType = 
  | 'transaction_pending'
  | 'payment_confirmed'
  | 'transaction_completed'
  | 'transaction_dispute_opened'
  | 'posting_sold'
  | 'posting_expired'
  | 'review_received'
  | 'disbursement_completed'
  | 'disbursement_failed'

export interface NotificationData {
  userId: number
  type: NotificationType
  title: string
  message: string
  relatedId?: number
}

/**
 * Send notification to user (in-app only)
 */
export async function sendNotification(data: NotificationData): Promise<number> {
  try {
    const result = await db`
      INSERT INTO notifications (user_id, type, title, message, related_id, created_at, updated_at)
      VALUES (
        ${data.userId},
        ${data.type},
        ${data.title},
        ${data.message},
        ${data.relatedId || null},
        NOW(),
        NOW()
      )
      RETURNING id
    ` as any

    const notificationId = result[0]?.id

    logger.info(`Notification created: ${notificationId} for user ${data.userId} (${data.type})`)

    return notificationId
  } catch (error) {
    logger.error('Failed to send notification', error)
    throw new Error('Notification failed')
  }
}

/**
 * Get user's notifications (paginated)
 */
export async function getUserNotifications(userId: number, limit: number = 20, offset: number = 0) {
  try {
    const notifications = await db`
      SELECT id, user_id, type, title, message, related_id, is_read, created_at, updated_at
      FROM notifications
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    ` as any

    const countResult = await db`
      SELECT COUNT(*) as total
      FROM notifications
      WHERE user_id = ${userId}
    ` as any

    return {
      data: notifications || [],
      total: countResult[0]?.total || 0,
      limit,
      offset,
    }
  } catch (error) {
    logger.error('Failed to fetch notifications', error)
    throw new Error('Failed to fetch notifications')
  }
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(userId: number): Promise<number> {
  try {
    const result = await db`
      SELECT COUNT(*) as unread
      FROM notifications
      WHERE user_id = ${userId} AND is_read = false
    ` as any

    return result[0]?.unread || 0
  } catch (error) {
    logger.error('Failed to get unread count', error)
    return 0
  }
}

/**
 * Mark notification as read
 */
export async function markAsRead(notificationId: number, userId: number): Promise<boolean> {
  try {
    const result = await db`
      UPDATE notifications
      SET is_read = true, updated_at = NOW()
      WHERE id = ${notificationId} AND user_id = ${userId}
      RETURNING id
    ` as any

    if (!result || result.length === 0) {
      return false
    }

    logger.info(`Notification ${notificationId} marked as read`)
    return true
  } catch (error) {
    logger.error('Failed to mark notification as read', error)
    throw new Error('Failed to update notification')
  }
}

/**
 * Mark all notifications as read
 */
export async function markAllAsRead(userId: number): Promise<number> {
  try {
    const result = await db`
      UPDATE notifications
      SET is_read = true, updated_at = NOW()
      WHERE user_id = ${userId} AND is_read = false
      RETURNING id
    ` as any

    const count = result?.length || 0
    logger.info(`Marked ${count} notifications as read for user ${userId}`)
    return count
  } catch (error) {
    logger.error('Failed to mark all as read', error)
    throw new Error('Failed to update notifications')
  }
}

/**
 * Delete notification
 */
export async function deleteNotification(notificationId: number, userId: number): Promise<boolean> {
  try {
    const result = await db`
      DELETE FROM notifications
      WHERE id = ${notificationId} AND user_id = ${userId}
      RETURNING id
    ` as any

    if (!result || result.length === 0) {
      return false
    }

    logger.info(`Notification ${notificationId} deleted`)
    return true
  } catch (error) {
    logger.error('Failed to delete notification', error)
    throw new Error('Failed to delete notification')
  }
}

/**
 * Delete all notifications for user
 */
export async function deleteAllNotifications(userId: number): Promise<number> {
  try {
    const result = await db`
      DELETE FROM notifications
      WHERE user_id = ${userId}
      RETURNING id
    ` as any

    const count = result?.length || 0
    logger.info(`Deleted ${count} notifications for user ${userId}`)
    return count
  } catch (error) {
    logger.error('Failed to delete all notifications', error)
    throw new Error('Failed to delete notifications')
  }
}

/**
 * Helper: Create transaction pending notification
 */
export async function notifyTransactionPending(sellerId: number, transactionId: number, buyerName: string) {
  return sendNotification({
    userId: sellerId,
    type: 'transaction_pending',
    title: 'New Order Received',
    message: `${buyerName} bought your listing. Waiting for payment.`,
    relatedId: transactionId,
  })
}

/**
 * Helper: Create payment confirmed notification
 */
export async function notifyPaymentConfirmed(buyerId: number, sellerId: number, transactionId: number) {
  // Notify buyer
  await sendNotification({
    userId: buyerId,
    type: 'payment_confirmed',
    title: 'Payment Confirmed',
    message: 'Your payment has been received. Seller will process your order soon.',
    relatedId: transactionId,
  })

  // Notify seller
  return sendNotification({
    userId: sellerId,
    type: 'payment_confirmed',
    title: 'Payment Received',
    message: 'Payment received from buyer. You can now proceed with the order.',
    relatedId: transactionId,
  })
}

/**
 * Helper: Create transaction completed notification
 */
export async function notifyTransactionCompleted(sellerId: number, transactionId: number) {
  return sendNotification({
    userId: sellerId,
    type: 'transaction_completed',
    title: 'Order Completed',
    message: 'Buyer confirmed order received. Transaction complete.',
    relatedId: transactionId,
  })
}

/**
 * Helper: Create dispute opened notification
 */
export async function notifyDisputeOpened(sellerId: number, disputeId: number, buyerName: string) {
  return sendNotification({
    userId: sellerId,
    type: 'transaction_dispute_opened',
    title: 'Dispute Opened',
    message: `${buyerName} opened a dispute. Please review and respond.`,
    relatedId: disputeId,
  })
}

/**
 * Helper: Create posting sold notification
 */
export async function notifyPostingSold(sellerId: number, postingId: number, postingTitle: string) {
  return sendNotification({
    userId: sellerId,
    type: 'posting_sold',
    title: 'Posting Sold',
    message: `Your listing "${postingTitle}" has been sold.`,
    relatedId: postingId,
  })
}

/**
 * Helper: Create posting expired notification
 */
export async function notifyPostingExpired(sellerId: number, postingId: number, postingTitle: string) {
  return sendNotification({
    userId: sellerId,
    type: 'posting_expired',
    title: 'Posting Expired',
    message: `Your listing "${postingTitle}" has expired and is no longer active.`,
    relatedId: postingId,
  })
}

/**
 * Helper: Create review received notification
 */
export async function notifyReviewReceived(sellerId: number, reviewId: number, rating: number) {
  return sendNotification({
    userId: sellerId,
    type: 'review_received',
    title: 'New Review',
    message: `You received a ${rating}-star review from a buyer.`,
    relatedId: reviewId,
  })
}

/**
 * Helper: Create disbursement completed notification
 */
export async function notifyDisbursementCompleted(sellerId: number, amount: number) {
  return sendNotification({
    userId: sellerId,
    type: 'disbursement_completed',
    title: 'Disbursement Completed',
    message: `Rp${amount.toLocaleString('id-ID')} has been transferred to your bank account.`,
  })
}

/**
 * Helper: Create disbursement failed notification
 */
export async function notifyDisbursementFailed(sellerId: number, amount: number, reason: string) {
  return sendNotification({
    userId: sellerId,
    type: 'disbursement_failed',
    title: 'Disbursement Failed',
    message: `Disbursement of Rp${amount.toLocaleString('id-ID')} failed: ${reason}`,
  })
}
