import { Elysia } from 'elysia'
import { requireAuth } from '@/middlewares/auth'
import {
  userProfileResponseSchema,
  updateProfileSchema,
  genericSuccessResponseSchema,
} from './model'
import {
  getUserProfile,
  updateUserProfile,
} from './service'

export const usersModule = new Elysia({ prefix: '/users', name: 'users-module' })
  .use(requireAuth) // All routes in this module require authentication

  // ==================== GET CURRENT USER PROFILE ====================
  .get(
    '/me',
    async ({ userId, set }) => {
      // userId is guaranteed to be present by requireAuth middleware
      const userProfile = await getUserProfile(userId!);
      
      set.status = 200;
      return {
        success: true,
        data: {
          id: userProfile.id,
          email: userProfile.email,
          role: userProfile.role,
          isVerified: userProfile.isVerified,
          createdAt: userProfile.createdAt,
          profile: {
            fullName: userProfile.profile.fullName,
            phone: userProfile.profile.phone,
            avatarUrl: userProfile.profile.avatarUrl,
            bio: userProfile.profile.bio,
            city: userProfile.profile.city,
            country: userProfile.profile.country,
          },
        },
      }
    },
    {
      response: userProfileResponseSchema,
      detail: {
        tags: ['Users'],
        summary: "Get the current authenticated user's profile",
      },
    }
  )

  // ==================== UPDATE CURRENT USER PROFILE ====================
  .put(
    '/me',
    async ({ userId, body, set }) => {
      await updateUserProfile(Number(userId!), body);
      set.status = 200;
      return {
        success: true,
        message: 'Profile updated successfully.',
      }
    },
    {
      body: updateProfileSchema,
      response: genericSuccessResponseSchema,
      detail: {
        tags: ['Users'],
        summary: "Update the current user's profile",
      },
    }
  )
