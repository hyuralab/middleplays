import { db } from '@/db'
import { logger } from '@/libs/logger'
import { fetchOne, fetchMany } from '@/libs/query-helpers'
import { notifyReviewReceived } from '@/modules/notifications/service'
import type { CreateReviewRequest, AddReviewResponseRequest, ListReviewsQuery } from './model'

/**
 * Create a new review for a transaction
 */
export async function createReview(reviewerId: number, data: CreateReviewRequest) {
  try {
    const result = await db.begin(async (tx: any) => {
      // 1. Verify transaction exists and is completed
      const txn = await fetchOne(
        tx`SELECT id, buyer_id, seller_id, status FROM transactions WHERE id = ${data.transactionId}`,
        'Transaction not found',
        'Failed to find transaction for review'
      ) as any

      // Only allow reviews on completed transactions
      if (txn.status !== 'completed') {
        throw new Error('Can only review completed transactions')
      }

      // Check if reviewer is buyer or seller
      if (reviewerId !== txn.buyer_id && reviewerId !== txn.seller_id) {
        throw new Error('You can only review transactions you participated in')
      }

      // Determine reviewed user (the other party)
      const reviewedUserId = reviewerId === txn.buyer_id ? txn.seller_id : txn.buyer_id

      // Check if review already exists
      const existingReviews = await fetchMany(
        tx`SELECT id FROM reviews WHERE transaction_id = ${data.transactionId} AND reviewer_id = ${reviewerId}`,
        '',
        true // allowEmpty
      )

      if (existingReviews.length > 0) {
        throw new Error('You have already reviewed this transaction')
      }

      // 2. Create the review
      const review = await fetchOne(
        tx`
          INSERT INTO reviews (
            transaction_id, reviewer_id, reviewed_user_id, 
            rating, comment, created_at, updated_at
          ) VALUES (
            ${data.transactionId}, ${reviewerId}, ${reviewedUserId},
            ${data.rating}, ${data.comment || null}, NOW(), NOW()
          )
          RETURNING *
        `,
        'Failed to create review',
        'Failed to insert review'
      ) as any

      // 3. Update seller stats (recalculate average rating)
      const sellerReviews = await fetchMany(
        tx`
          SELECT AVG(rating)::numeric as avg_rating, COUNT(*) as review_count
          FROM reviews WHERE reviewed_user_id = ${reviewedUserId}
        `,
        '',
        false
      ) as any[]

      if (sellerReviews.length > 0) {
        const avgRating = Number(sellerReviews[0].avg_rating) || 0
        const reviewCount = sellerReviews[0].review_count || 0

        await tx`
          UPDATE seller_stats
          SET 
            average_rating = ${avgRating},
            updated_at = NOW()
          WHERE user_id = ${reviewedUserId}
        `

        logger.info(`Updated seller stats for user ${reviewedUserId}: avg_rating=${avgRating.toFixed(2)}, count=${reviewCount}`)
      }

      return review
    })

    logger.info(`Review created: ID ${result.id} by user ${reviewerId}`)

    // Send review received notification to reviewed user
    try {
      await notifyReviewReceived(result.reviewed_user_id, result.id, result.rating)
    } catch (notifError) {
      logger.error('Failed to send review notification', notifError)
      // Don't fail if notification fails
    }

    return result
  } catch (error) {
    logger.error('Failed to create review', error)
    throw error
  }
}

/**
 * Get reviews for a specific transaction
 */
export async function getReviewsByTransaction(transactionId: number) {
  try {
    const reviews = await fetchMany(
      db`
        SELECT
          r.id, r.transaction_id, r.reviewer_id, r.reviewed_user_id,
          r.rating, r.comment, r.created_at, r.updated_at,
          u.username as reviewer_username,
          up.full_name as reviewer_full_name,
          up.avatar_url as reviewer_avatar_url
        FROM reviews r
        LEFT JOIN users u ON r.reviewer_id = u.id
        LEFT JOIN user_profiles up ON u.id = up.user_id
        WHERE r.transaction_id = ${transactionId}
        ORDER BY r.created_at DESC
      `,
      'No reviews found',
      true
    ) as any[]

    const reviewsWithResponses = await Promise.all(
      reviews.map(async (review: any) => {
        const responses = await fetchMany(
          db`
            SELECT
              rr.id, rr.responder_id, rr.response, rr.created_at,
              u.username as responder_username,
              up.full_name as responder_full_name,
              up.avatar_url as responder_avatar_url
            FROM review_responses rr
            LEFT JOIN users u ON rr.responder_id = u.id
            LEFT JOIN user_profiles up ON u.id = up.user_id
            WHERE rr.review_id = ${review.id}
            ORDER BY rr.created_at ASC
          `,
          '',
          true
        ) as any[]

        return {
          ...review,
          responses: responses.map(r => ({
            id: r.id,
            responderId: r.responder_id,
            responderName: r.responder_full_name || r.responder_username,
            responderAvatar: r.responder_avatar_url,
            responseText: r.response,
            createdAt: r.created_at,
          })),
        }
      })
    )

    return reviewsWithResponses
  } catch (error) {
    logger.error(`Failed to get reviews for transaction ${transactionId}`, error)
    throw new Error('Could not fetch reviews')
  }
}

/**
 * Get all reviews about a user (seller profile reviews)
 */
export async function getReviewsByUser(userId: number, query: ListReviewsQuery) {
  const { page = 1, limit = 20, sortBy = 'newest' } = query
  const offset = (page - 1) * limit

  try {
    // Build order by clause based on sortBy parameter
    let orderClause = 'r.created_at DESC'
    if (sortBy === 'oldest') orderClause = 'r.created_at ASC'
    else if (sortBy === 'highest_rating') orderClause = 'r.rating DESC'
    else if (sortBy === 'lowest_rating') orderClause = 'r.rating ASC'

    // Single query with dynamic order by (no SQL injection - params are safe)
    const reviews = await fetchMany(
      db.unsafe(`
        SELECT
          r.id, r.transaction_id, r.reviewer_id, r.reviewed_user_id,
          r.rating, r.comment, r.created_at, r.updated_at,
          u.username as reviewer_username,
          up.full_name as reviewer_full_name,
          up.avatar_url as reviewer_avatar_url
        FROM reviews r
        LEFT JOIN users u ON r.reviewer_id = u.id
        LEFT JOIN user_profiles up ON u.id = up.user_id
        WHERE r.reviewed_user_id = ${userId}
        ORDER BY ${orderClause}
        LIMIT ${limit} OFFSET ${offset}
      `) as any,
      'No reviews found',
      true
    ) as any[]

    const countResult = await fetchMany(
      db`SELECT COUNT(*) as total FROM reviews WHERE reviewed_user_id = ${userId}`,
      '',
      false
    ) as any[]

    const total = parseInt(countResult[0]?.total || '0', 10)
    const totalPages = Math.ceil(total / limit)

    const reviewsWithResponses = await Promise.all(
      reviews.map(async (review: any) => {
        const responses = await fetchMany(
          db`
            SELECT
              rr.id, rr.responder_id, rr.response, rr.created_at,
              u.username as responder_username,
              up.full_name as responder_full_name,
              up.avatar_url as responder_avatar_url
            FROM review_responses rr
            LEFT JOIN users u ON rr.responder_id = u.id
            LEFT JOIN user_profiles up ON u.id = up.user_id
            WHERE rr.review_id = ${review.id}
            ORDER BY rr.created_at ASC
          `,
          '',
          true
        ) as any[]

        return {
          id: review.id,
          transactionId: review.transaction_id,
          reviewerId: review.reviewer_id,
          reviewerName: review.reviewer_full_name || review.reviewer_username,
          reviewerAvatar: review.reviewer_avatar_url,
          reviewedUserId: review.reviewed_user_id,
          rating: review.rating,
          comment: review.comment,
          responses: responses.map(r => ({
            id: r.id,
            responderId: r.responder_id,
            responderName: r.responder_full_name || r.responder_username,
            responderAvatar: r.responder_avatar_url,
            responseText: r.response,
            createdAt: r.created_at,
          })),
          createdAt: review.created_at,
          updatedAt: review.updated_at,
        }
      })
    )

    return {
      data: reviewsWithResponses,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    }
  } catch (error) {
    logger.error(`Failed to get reviews for user ${userId}`, error)
    throw new Error('Could not fetch user reviews')
  }
}

/**
 * Get single review with responses
 */
export async function getReviewById(reviewId: number) {
  try {
    const review = await fetchOne(
      db`
        SELECT
          r.id, r.transaction_id, r.reviewer_id, r.reviewed_user_id,
          r.rating, r.comment, r.created_at, r.updated_at,
          u.username as reviewer_username,
          up.full_name as reviewer_full_name,
          up.avatar_url as reviewer_avatar_url
        FROM reviews r
        LEFT JOIN users u ON r.reviewer_id = u.id
        LEFT JOIN user_profiles up ON u.id = up.user_id
        WHERE r.id = ${reviewId}
      `,
      'Review not found',
      `Failed to get review ${reviewId}`
    ) as any

    const responses = await fetchMany(
      db`
        SELECT
          rr.id, rr.responder_id, rr.response, rr.created_at,
          u.username as responder_username,
          up.full_name as responder_full_name,
          up.avatar_url as responder_avatar_url
        FROM review_responses rr
        LEFT JOIN users u ON rr.responder_id = u.id
        LEFT JOIN user_profiles up ON u.id = up.user_id
        WHERE rr.review_id = ${reviewId}
        ORDER BY rr.created_at ASC
      `,
      '',
      true
    ) as any[]

    return {
      id: review.id,
      transactionId: review.transaction_id,
      reviewerId: review.reviewer_id,
      reviewerName: review.reviewer_full_name || review.reviewer_username,
      reviewerAvatar: review.reviewer_avatar_url,
      reviewedUserId: review.reviewed_user_id,
      rating: review.rating,
      comment: review.comment,
      responses: responses.map(r => ({
        id: r.id,
        responderId: r.responder_id,
        responderName: r.responder_full_name || r.responder_username,
        responderAvatar: r.responder_avatar_url,
        responseText: r.response,
        createdAt: r.created_at,
      })),
      createdAt: review.created_at,
      updatedAt: review.updated_at,
    }
  } catch (error) {
    logger.error(`Failed to get review ${reviewId}`, error)
    throw error
  }
}

/**
 * Add response to a review
 */
export async function addReviewResponse(reviewId: number, responderId: number, data: AddReviewResponseRequest) {
  try {
    const result = await db.begin(async (tx: any) => {
      // Verify review exists
      const review = await fetchOne(
        tx`SELECT reviewed_user_id FROM reviews WHERE id = ${reviewId}`,
        'Review not found',
        'Failed to find review for response'
      ) as any

      // Only the reviewed user can respond to a review
      if (responderId !== review.reviewed_user_id) {
        throw new Error('Only the reviewed user can respond to this review')
      }

      // Check if already responded
      const existingResponse = await fetchMany(
        tx`SELECT id FROM review_responses WHERE review_id = ${reviewId} AND responder_id = ${responderId}`,
        '',
        true
      )

      if (existingResponse.length > 0) {
        throw new Error('You have already responded to this review')
      }

      // Add response
      const newResponse = await fetchOne(
        tx`
          INSERT INTO review_responses (
            review_id, responder_id, response, created_at, updated_at
          ) VALUES (
            ${reviewId}, ${responderId}, ${data.responseText}, NOW(), NOW()
          )
          RETURNING *
        `,
        'Failed to add response',
        'Failed to insert response'
      ) as any

      return newResponse
    })

    logger.info(`Review response added: review ${reviewId} by user ${responderId}`)
    return result
  } catch (error) {
    logger.error('Failed to add review response', error)
    throw error
  }
}
