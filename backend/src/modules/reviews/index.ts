import { Elysia } from 'elysia'
import { requireAuth } from '@/middlewares/auth'
import {
  createReviewSchema,
  createReviewResponseSchema,
  listReviewsQuerySchema,
  listReviewsResponseSchema,
  getReviewResponseSchema,
  addResponseResponseSchema,
  addReviewResponseSchema,
} from './model'
import {
  createReview,
  getReviewsByTransaction,
  getReviewsByUser,
  getReviewById,
  addReviewResponse,
} from './service'

// Protected route for creating reviews
const createReviewRoute = new Elysia()
  .use(requireAuth)
  .post(
    '/',
    async ({ userId, body, set }) => {
      try {
        const review = await createReview(Number(userId!), body)
        set.status = 201
        return {
          success: true,
          data: {
            id: review.id,
          },
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)

        if (errorMessage.includes('Transaction not found')) {
          set.status = 404
          throw new Error('Transaction not found')
        }

        if (errorMessage.includes('Can only review completed')) {
          set.status = 400
          throw new Error('Can only review completed transactions')
        }

        if (errorMessage.includes('already reviewed')) {
          set.status = 400
          throw new Error('You have already reviewed this transaction')
        }

        if (errorMessage.includes('participated in')) {
          set.status = 403
          throw new Error('You can only review transactions you participated in')
        }

        throw error
      }
    },
    {
      body: createReviewSchema,
      response: createReviewResponseSchema,
      detail: {
        tags: ['Reviews'],
        summary: 'Create a review for a completed transaction',
        description: 'Only available for buyer or seller after transaction is completed',
      },
    }
  )

// Protected route for adding responses
const addResponseRoute = new Elysia()
  .use(requireAuth)
  .post(
    '/:reviewId/responses',
    async ({ params, userId, body, set }) => {
      try {
        await addReviewResponse(Number(params.reviewId), Number(userId!), body)
        set.status = 201
        return {
          success: true,
          message: 'Response added successfully',
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)

        if (errorMessage.includes('Review not found')) {
          set.status = 404
          throw new Error('Review not found')
        }

        if (errorMessage.includes('Only the reviewed user')) {
          set.status = 403
          throw new Error('Only the reviewed user can respond to this review')
        }

        if (errorMessage.includes('already responded')) {
          set.status = 400
          throw new Error('You have already responded to this review')
        }

        throw error
      }
    },
    {
      body: addReviewResponseSchema,
      response: addResponseResponseSchema,
      detail: {
        tags: ['Reviews'],
        summary: 'Add a response to a review',
        description: 'Only the reviewed user can respond to reviews',
      },
    }
  )

export const reviewsModule = new Elysia({ prefix: '/reviews', name: 'reviews-module' })
  // Protected routes
  .use(createReviewRoute)
  .use(addResponseRoute)

  // ==================== GET REVIEW BY ID (PUBLIC) ====================
  .get(
    '/:reviewId',
    async ({ params, set }) => {
      try {
        const review = await getReviewById(Number(params.reviewId))
        set.status = 200
        return {
          success: true,
          data: review,
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)

        if (errorMessage.includes('not found')) {
          set.status = 404
          throw new Error('Review not found')
        }

        throw error
      }
    },
    {
      detail: {
        tags: ['Reviews'],
        summary: 'Get a specific review with responses',
      },
    }
  )

  // ==================== GET REVIEWS FOR TRANSACTION (PUBLIC) ====================
  .get(
    '/transaction/:transactionId',
    async ({ params, set }) => {
      try {
        const reviews = await getReviewsByTransaction(Number(params.transactionId))
        set.status = 200
        return {
          success: true,
          data: reviews,
        }
      } catch (error) {
        throw error
      }
    },
    {
      detail: {
        tags: ['Reviews'],
        summary: 'Get all reviews for a specific transaction',
      },
    }
  )

  // ==================== GET USER REVIEWS (SELLER RATINGS) (PUBLIC) ====================
  .get(
    '/user/:userId',
    async ({ params, query, set }) => {
      try {
        const result = await getReviewsByUser(Number(params.userId), query)
        set.status = 200
        return {
          success: true,
          data: result.data,
          pagination: result.pagination,
        }
      } catch (error) {
        throw error
      }
    },
    {
      query: listReviewsQuerySchema,
      response: listReviewsResponseSchema,
      detail: {
        tags: ['Reviews'],
        summary: 'Get all reviews about a specific user (seller ratings)',
        description: 'Get paginated reviews about a seller to see their rating history',
      },
    }
  )
