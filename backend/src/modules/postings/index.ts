import { Elysia } from 'elysia'
import { Type } from '@sinclair/typebox'
import { requireVerifiedSeller, requireAuth } from '@/middlewares/auth'
import { uploadImage, isValidImage } from '@/libs/image-upload'
import {
  createPostingSchema,
  createPostingResponseSchema,
  listPostingsQuerySchema,
  listPostingsResponseSchema,
} from './model'
import {
  createPosting,
  listPostings,
} from './service'

// Protected sub-module for POST /postings (create)
const createPostingRoute = new Elysia()
  .use(requireVerifiedSeller)
  .post(
    '/',
    async ({ isVerifiedSeller, sellerUser, body, set }) => {
      if (!isVerifiedSeller || !sellerUser) {
        set.status = 403
        throw new Error('Access denied. Verified seller account required.')
      }
      
      // Process cover image if provided
      let coverImageUrl: string | null = null
      if (body.cover_image_file) {
        try {
          const buffer = await body.cover_image_file.arrayBuffer()
          const uint8Array = new Uint8Array(buffer)
          
          // Validate it's actually an image
          const isValid = await isValidImage(Buffer.from(uint8Array))
          if (!isValid) {
            set.status = 400
            throw new Error('Invalid image file. Please upload a valid image (JPEG, PNG, GIF, etc.)')
          }

          // Upload and get URL
          coverImageUrl = await uploadImage(
            Buffer.from(uint8Array),
            body.cover_image_file.name || 'cover_image'
          )
        } catch (error) {
          set.status = 400
          throw error instanceof Error ? error : new Error('Failed to upload image')
        }
      }

      // Create posting with image URL
      const postingData = {
        ...body,
        cover_image_url: coverImageUrl,
      }

      const newPosting = await createPosting(sellerUser.id, postingData)
      set.status = 201
      return {
        success: true,
        data: {
          id: (newPosting as any).id,
          cover_image_url: coverImageUrl,
        },
      }
    },
    {
      // Accept both form data and JSON
      body: Type.Object({
        game_id: Type.Number({ minimum: 1 }),
        account_identifier: Type.String({ minLength: 1, maxLength: 255 }),
        price: Type.Number({ minimum: 1000 }),
        description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        field_values: Type.Optional(Type.Record(Type.String(), Type.Any())),
        cover_image_file: Type.Optional(Type.Any()), // File object
      }),
      response: createPostingResponseSchema,
      detail: {
        tags: ['Postings'],
        summary: 'Create a new game account posting',
        description: 'Creates a new posting for selling a game account. Requires verified seller status. Supports optional cover image upload.',
      },
    }
  )

export const postingsModule = new Elysia({ prefix: '/postings', name: 'postings-module' })
  // Define protected routes first in sub-module
  .use(createPostingRoute)
  
  // Public routes - list postings
  .get(
    '/',
    async ({ query, set }) => {
      const result = await listPostings(query);
      set.status = 200;
      return {
        success: true,
        data: result.data,
        pagination: result.pagination,
      }
    },
    {
      query: listPostingsQuerySchema,
      response: listPostingsResponseSchema,
      detail: {
        tags: ['Postings'],
        summary: 'List, search, and filter game account postings',
      },
    }
  )