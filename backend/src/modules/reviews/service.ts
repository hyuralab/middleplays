import { db } from '@/db'
import { logger } from '@/libs/logger'
import type { CreateReviewRequest, AddReviewResponseRequest, ListReviewsQuery } from './model'

/**
 * Create a new review for a transaction
 */
export async function createReview(reviewerId: number, data: CreateReviewRequest) {
  try {
    const result = await db.begin(async (tx: any) => {
      // 1. Verify transaction exists and is completed
      const txns = await tx`
        SELECT id, buyer_id, seller_id, status FROM transactions WHERE id = ${data.transactionId}
      `

      if (!txns || txns.length === 0) {
        throw new Error('Transaction not found')
      }

      const txn = txns[0]

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
      const existingReviews = await tx`
        SELECT id FROM reviews 
        WHERE transaction_id = ${data.transactionId} AND reviewer_id = ${reviewerId}
      `

      if (existingReviews && existingReviews.length > 0) {
        throw new Error('You have already reviewed this transaction')
      }

      // 2. Create the review
      const newReview = await tx`
        INSERT INTO reviews (
          transaction_id, reviewer_id, reviewed_user_id, 
          rating, comment, created_at, updated_at
        ) VALUES (
          ${data.transactionId}, ${reviewerId}, ${reviewedUserId},
          ${data.rating}, ${data.comment || null}, NOW(), NOW()
        )
        RETURNING *
      `

      if (!newReview || newReview.length === 0) {
        throw new Error('Failed to create review')
      }

      const review = newReview[0]

      // 3. Update seller stats (recalculate average rating)
      const sellerReviews = await tx`
        SELECT AVG(rating)::numeric as avg_rating, COUNT(*) as review_count
        FROM reviews WHERE reviewed_user_id = ${reviewedUserId}
      `

      if (sellerReviews && sellerReviews.length > 0) {
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
    const reviews = await db`
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
    `

    const reviewsWithResponses = await Promise.all(
      (reviews || []).map(async (review: any) => {
        const responses = await db`
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
        `

        return {
          ...review,
          responses: (responses || []).map(r => ({
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
    // Build order by SQL based on sortBy parameter
    let reviews: any[] = []
    
    if (sortBy === 'oldest') {
      reviews = await db`
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
        ORDER BY r.created_at ASC
        LIMIT ${limit} OFFSET ${offset}
      `
    } else if (sortBy === 'highest_rating') {
      reviews = await db`
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
        ORDER BY r.rating DESC
        LIMIT ${limit} OFFSET ${offset}
      `
    } else if (sortBy === 'lowest_rating') {
      reviews = await db`
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
        ORDER BY r.rating ASC
        LIMIT ${limit} OFFSET ${offset}
      `
    } else {
      // newest (default)
      reviews = await db`
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
        ORDER BY r.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
    }

    const countResult = await db`SELECT COUNT(*) as total FROM reviews WHERE reviewed_user_id = ${userId}`

    const total = parseInt(countResult[0]?.total || '0', 10)
    const totalPages = Math.ceil(total / limit)

    const reviewsWithResponses = await Promise.all(
      (reviews || []).map(async (review: any) => {
        const responses = await db`
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
        `

        return {
          id: review.id,
          transactionId: review.transaction_id,
          reviewerId: review.reviewer_id,
          reviewerName: review.reviewer_full_name || review.reviewer_username,
          reviewerAvatar: review.reviewer_avatar_url,
          reviewedUserId: review.reviewed_user_id,
          rating: review.rating,
          comment: review.comment,
          responses: (responses || []).map(r => ({
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
    const reviews = await db`
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
    `

    if (!reviews || reviews.length === 0) {
      throw new Error('Review not found')
    }

    const review = reviews[0] as any

    const responses = await db`
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
    `

    return {
      id: review.id,
      transactionId: review.transaction_id,
      reviewerId: review.reviewer_id,
      reviewerName: review.reviewer_full_name || review.reviewer_username,
      reviewerAvatar: review.reviewer_avatar_url,
      reviewedUserId: review.reviewed_user_id,
      rating: review.rating,
      comment: review.comment,
      responses: (responses || []).map(r => ({
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
      const reviews = await tx`SELECT reviewed_user_id FROM reviews WHERE id = ${reviewId}`

      if (!reviews || reviews.length === 0) {
        throw new Error('Review not found')
      }

      const review = reviews[0]

      // Only the reviewed user can respond to a review
      if (responderId !== review.reviewed_user_id) {
        throw new Error('Only the reviewed user can respond to this review')
      }

      // Check if already responded
      const existingResponse = await tx`
        SELECT id FROM review_responses 
        WHERE review_id = ${reviewId} AND responder_id = ${responderId}
      `

      if (existingResponse && existingResponse.length > 0) {
        throw new Error('You have already responded to this review')
      }

      // Add response
      const newResponse = await tx`
        INSERT INTO review_responses (
          review_id, responder_id, response, created_at, updated_at
        ) VALUES (
          ${reviewId}, ${responderId}, ${data.responseText}, NOW(), NOW()
        )
        RETURNING *
      `

      if (!newResponse || newResponse.length === 0) {
        throw new Error('Failed to add response')
      }

      return newResponse[0]
    })

    logger.info(`Review response added: review ${reviewId} by user ${responderId}`)
    return result
  } catch (error) {
    logger.error('Failed to add review response', error)
    throw error
  }
}
