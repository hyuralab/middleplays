import { db } from '@/db'
import { users, userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { hashPassword, verifyPassword } from '@/libs/crypto'
import { logger } from '@/libs/logger'
import type { RegisterRequest, LoginRequest } from './model'
import { emailExists, normalizeEmail } from './utils'
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

  // Create user and profile in transaction
  const result = await db.transaction(async (tx) => {
    // Insert user
    const [newUser] = await tx
      .insert(users)
      .values({
        email: normalizedEmail,
        passwordHash,
        role: 'user',
        isEmailVerified: false,
      })
      .returning()

    // Create user profile
    await tx.insert(userProfiles).values({
      userId: newUser.id,
      fullName: data.fullName || null,
      phone: data.phone || null,
      balance: '0',
      totalSales: 0,
      totalPurchases: 0,
      rating: '0',
    })

    return newUser
  })

  logger.info(`User registered: ${result.email}`)

  return {
    id: result.id,
    email: result.email,
    role: result.role,
    isEmailVerified: result.isEmailVerified,
  }
}

/**
 * Login user
 */
export async function loginUser(data: LoginRequest) {
  const normalizedEmail = normalizeEmail(data.email)

  // Find user by email
  const user = await db.query.users.findFirst({
    where: eq(users.email, normalizedEmail),
    with: {
      profile: true,
    },
  })

  if (!user) {
    throw new Error('Invalid email or password')
  }

  // Verify password
  const isValid = await verifyPassword(data.password, user.passwordHash)
  if (!isValid) {
    throw new Error('Invalid email or password')
  }

  logger.info(`User logged in: ${user.email}`)

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
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
    const user = await db.query.users.findFirst({
      where: eq(users.id, payload.userId),
    })

    if (!user) {
      throw new Error('User not found')
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
    }
  } catch (error) {
    logger.error('Refresh token verification failed', error)
    throw new Error('Invalid refresh token')
  }
}

/**
 * Verify email (placeholder for future implementation)
 */
export async function verifyEmail(token: string) {
  // TODO: Implement email verification logic
  // For now, just return success message
  logger.info('Email verification requested', { token })
  throw new Error('Email verification not yet implemented')
}
