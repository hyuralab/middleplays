import { db } from '@/db'
import { LoginMethod, UserRole } from '@/types'
import { hashPassword, verifyPassword, hashToken } from '@/libs/crypto'
import { logger } from '@/libs/logger'
import type { RegisterRequest, LoginRequest } from './model'
import { emailExists, normalizeEmail, createEmailVerificationToken } from './utils'
import type { JWTPayloadSpec } from '@elysiajs/jwt'

interface JWTPayload extends JWTPayloadSpec {
  userId: string
  type: 'access' | 'refresh'
}

/**
 * Register new user
 */
export async function registerUser(data: RegisterRequest) {
  const normalizedEmail = normalizeEmail(data.email)

  // Check if email already exists
  if (await emailExists(normalizedEmail)) {
    throw new Error('Email already registered')
  }

  // Hash password
  const passwordHash = await hashPassword(data.password)

  try {
    const result = await db.begin(async (tx: any) => {
      // Insert user
      const users = await tx`
        INSERT INTO users (username, email, password_hash, role, is_verified, login_method)
        VALUES (${normalizedEmail.split('@')[0]}, ${normalizedEmail}, ${passwordHash}, 'user', false, 'email')
        RETURNING id, email, role, is_verified
      `
      
      if (!users || users.length === 0) {
        throw new Error('Failed to create user')
      }

      const newUser = users[0]

      // Create user profile
      await tx`
        INSERT INTO user_profiles (user_id, full_name, phone)
        VALUES (${newUser.id}, ${data.fullName || null}, ${data.phone || null})
      `

      // Create seller_stats (even if user, for consistency)
      await tx`
        INSERT INTO seller_stats (user_id, trust_level)
        VALUES (${newUser.id}, 'new')
      `

      return newUser
    })

    logger.info(`User registered: ${result.email}`)

    // Generate and "send" verification email (mock)
    try {
      const verificationToken = await createEmailVerificationToken(result.id)
      // In a real app, you'd send an email via a job queue (e.g., BullMQ)
      // For this project, we'll log it for demonstration purposes.
      logger.info(`
      ================================================
      VIRTUAL EMAIL - PLEASE VERIFY YOUR EMAIL
      ------------------------------------------------
      To: ${result.email}
      Verification Token: ${verificationToken}
      (This would typically be a link in an email)
      ================================================
    `)
    } catch (emailError) {
      logger.error(`Failed to send verification email for ${result.email}`, emailError)
      // We don't block the registration process if email sending fails.
      // The user can request a new verification email later.
    }

    return {
      id: result.id,
      email: result.email,
      role: result.role,
      isEmailVerified: result.is_verified,
    }
  } catch (error) {
    // ✅ Handle PostgreSQL unique constraint violation
    if (error instanceof Error) {
      if (error.message.includes('unique constraint') || 
          error.message.includes('duplicate key')) {
        throw new Error('Email already registered')
      }
    }
    
    logger.error('Registration failed', error)
    throw new Error('Registration failed. Please try again.')
  }
}

/**
 * Login user
 */
export async function loginUser(data: LoginRequest) {
  const normalizedEmail = normalizeEmail(data.email)

  // Find user by email
  const users = await db`SELECT id, email, password_hash, role, is_verified FROM users WHERE email = ${normalizedEmail}`

  if (!users || users.length === 0) {
    throw new Error('Invalid email or password')
  }

  const user = users[0] as any

  // Verify password
  const isValid = await verifyPassword(data.password, user.password_hash)
  if (!isValid) {
    throw new Error('Invalid email or password')
  }

  logger.info(`User logged in: ${user.email}`)

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    isEmailVerified: user.is_verified,
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
    const users = await db`SELECT id, email, role, is_verified FROM users WHERE id = ${payload.userId}`

    if (!users || users.length === 0) {
      throw new Error('User not found')
    }

    const user = users[0] as any

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isEmailVerified: user.is_verified,
    }
  } catch (error) {
    logger.error('Refresh token verification failed', error)
    throw new Error('Invalid refresh token')
  }
}

/**
 * Verify email using the provided token.
 */
export async function verifyEmail(token: string) {
  if (!token || typeof token !== 'string') {
    throw new Error('Verification token is required.');
  }

  const hashedToken = hashToken(token);

  try {
    const result = await db.begin(async (tx: any) => {
      // Find the token
      const tokens = await tx`
        SELECT id, user_id, expires_at 
        FROM email_verification_tokens 
        WHERE token = ${hashedToken}
      `

      if (!tokens || tokens.length === 0) {
        throw new Error('Invalid or expired verification token.');
      }

      const verificationToken = tokens[0]

      // Check if token is expired
      if (new Date() > new Date(verificationToken.expires_at)) {
        // Clean up expired token
        await tx`DELETE FROM email_verification_tokens WHERE id = ${verificationToken.id}`
        throw new Error('Invalid or expired verification token.');
      }

      // Update user's verification status
      const updatedUsers = await tx`
        UPDATE users 
        SET is_verified = true, updated_at = NOW()
        WHERE id = ${verificationToken.user_id}
        RETURNING id, email
      `
      
      if (!updatedUsers || updatedUsers.length === 0) {
        // This should not happen if the foreign key is set up correctly
        throw new Error('Failed to find user for verification.');
      }

      // Delete the used token
      await tx`DELETE FROM email_verification_tokens WHERE id = ${verificationToken.id}`

      return updatedUsers[0];
    });

    logger.info(`Email verified for user: ${result.email}`);
    return { success: true, message: 'Email verified successfully.' };

  } catch (error) {
    logger.error('Email verification failed', error);
    // Re-throw specific, safe errors to the user
    if (error instanceof Error && error.message.includes('token')) {
      throw error;
    }
    // Generic error for other unexpected issues
    throw new Error('Email verification failed. Please try again.');
  }
}