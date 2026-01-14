import { Elysia, t } from 'elysia'
import { jwtPlugin } from '@/plugins/jwt'
import { rateLimitPlugin } from '@/plugins/rate-limit'
import { logger } from '@/libs/logger'
import {
  googleLoginRequestSchema,
  refreshTokenRequestSchema,
  googleAuthResponseSchema,
  refreshTokenResponseSchema,
} from './model'
import { googleLoginUser, verifyRefreshToken } from './service'

export const authModule = new Elysia({ prefix: '/auth', name: 'auth' })
  .use(jwtPlugin)
  .use(rateLimitPlugin)

  // ==================== GOOGLE LOGIN ====================
  .post(
    '/google-login',
    async ({ body, jwt, jwtRefresh, checkRateLimit, request, set }) => {
      try {
        // Rate limiting for Google login
        const ip = request.headers.get('x-forwarded-for') || 'unknown'
        await checkRateLimit(`google-login:${ip}`, {
          max: 10, // 10 login attempts
          window: 900, // per 15 minutes
        })

        // Google login with auto-user-creation
        const user = await googleLoginUser(body.googleToken)

        // Generate tokens
        const accessToken = await jwt.sign({ userId: user.id, type: 'access' })
        const refreshToken = await jwtRefresh.sign({ userId: user.id, type: 'refresh' })

        logger.info(`User logged in with Google: ${user.email}`)

        return {
          success: true,
          data: {
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              avatarUrl: user.avatarUrl,
              role: user.role,
            },
            accessToken,
            refreshToken,
          },
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)

        if (errorMessage.includes('Invalid Google token')) {
          set.status = 401
          return {
            success: false,
            error: 'Unauthorized',
            message: 'Invalid or expired Google token',
          }
        }

        logger.error('Google login error', error)
        throw error
      }
    },
    {
      body: googleLoginRequestSchema,
      response: googleAuthResponseSchema,
      detail: {
        tags: ['Auth'],
        summary: 'Login with Google OAuth',
        description: 'Authenticate with Google OAuth token. Auto-creates user on first login.',
      },
    }
  )

  // ==================== REFRESH TOKEN ====================
  .post(
    '/refresh',
    async ({ body, jwtRefresh, jwt }) => {
      // Verify refresh token
      const user = await verifyRefreshToken(body.refreshToken, jwtRefresh as any)

      // Generate new access token
      const accessToken = await jwt.sign({ userId: user.id, type: 'access' })

      logger.info(`Token refreshed for user: ${user.email}`)

      return {
        success: true,
        data: {
          accessToken,
        },
      }
    },
    {
      body: refreshTokenRequestSchema,
      response: refreshTokenResponseSchema,
      detail: {
        tags: ['Auth'],
        summary: 'Refresh access token',
        description: 'Get new access token using refresh token',
      },
    }
  )
