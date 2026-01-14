import { db } from '@/db'
import { logger } from '@/libs/logger'
import { verifyGoogleToken, type VerifiedGoogleUser } from '@/libs/google'
import type { JWTPayloadSpec } from '@elysiajs/jwt'

interface JWTPayload extends JWTPayloadSpec {
  userId: string
  type: 'access' | 'refresh'
}

/**
 * Google OAuth login - auto-create user if not exists
 */
export async function googleLoginUser(googleToken: string) {
  try {
    // Verify and extract Google user data
    const googleUser = await verifyGoogleToken(googleToken)

    // Try to find existing user by google_id
    let user: any = null
    const existingUsers = await db`
      SELECT id, email, role, google_id, google_name, google_avatar_url
      FROM users
      WHERE google_id = ${googleUser.googleId}
    `

    if (existingUsers && existingUsers.length > 0) {
      // User exists, just return
      user = existingUsers[0]
      logger.info(`Google user logged in: ${user.email}`)
      return {
        id: user.id,
        email: user.email,
        role: user.role,
        googleId: user.google_id,
        name: user.google_name,
        avatarUrl: user.google_avatar_url,
      }
    }

    // User doesn't exist, create new one
    const result = await db.begin(async (tx: any) => {
      // Extract username from email
      const username = googleUser.email.split('@')[0]

      // Insert new user with Google info
      const users = await tx`
        INSERT INTO users (
          username, 
          email, 
          google_id, 
          google_name, 
          google_avatar_url, 
          role, 
          login_method
        )
        VALUES (
          ${username},
          ${googleUser.email},
          ${googleUser.googleId},
          ${googleUser.name},
          ${googleUser.avatarUrl || null},
          'user',
          'google'
        )
        RETURNING id, email, role, google_id, google_name, google_avatar_url
      `

      if (!users || users.length === 0) {
        throw new Error('Failed to create user')
      }

      const newUser = users[0]

      // Create user profile with name from Google
      await tx`
        INSERT INTO user_profiles (user_id, full_name)
        VALUES (${newUser.id}, ${googleUser.name || null})
      `

      // Create seller_stats (for consistency)
      await tx`
        INSERT INTO seller_stats (user_id, trust_level)
        VALUES (${newUser.id}, 'new')
      `

      return newUser
    })

    logger.info(`New Google user created and logged in: ${result.email}`)

    return {
      id: result.id,
      email: result.email,
      role: result.role,
      googleId: result.google_id,
      name: result.google_name,
      avatarUrl: result.google_avatar_url,
    }
  } catch (error) {
    logger.error('Google login failed', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (errorMessage.includes('Invalid') || errorMessage.includes('expired')) {
      throw new Error('Invalid Google token')
    }
    throw new Error('Google login failed')
  }
}

/**
 * Verify refresh token and get user
 */
export async function verifyRefreshToken(
  token: string,
  jwtRefresh: { verify: (token: string) => Promise<JWTPayload | false> }
) {
  try {
    const payload = (await jwtRefresh.verify(token)) as unknown as JWTPayload | false

    if (!payload || payload.type !== 'refresh') {
      throw new Error('Invalid refresh token')
    }

    // Verify user still exists
    const users = await db`SELECT id, email, role FROM users WHERE id = ${payload.userId}`

    if (!users || users.length === 0) {
      throw new Error('User not found')
    }

    const user = users[0] as any

    return {
      id: user.id,
      email: user.email,
      role: user.role,
    }
  } catch (error) {
    logger.error('Refresh token verification failed', error)
    throw new Error('Invalid refresh token')
  }
}