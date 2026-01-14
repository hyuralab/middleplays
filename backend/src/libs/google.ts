import { env } from '@/configs/env'
import { logger } from './logger'

/**
 * Interface for Google OAuth token payload
 */
export interface GoogleTokenPayload {
  iss: string
  azp: string
  aud: string
  sub: string // Google ID (unique identifier)
  email: string
  email_verified: boolean
  name: string
  picture: string // Avatar URL
  given_name: string
  family_name: string
  iat: number
  exp: number
}

/**
 * Interface for verified Google user data
 */
export interface VerifiedGoogleUser {
  googleId: string
  email: string
  name: string
  avatarUrl: string
}

/**
 * Verify Google OAuth token (ID token)
 * In production, you should verify the signature using Google's public keys
 * For now, we'll do basic validation
 */
export async function verifyGoogleToken(token: string): Promise<VerifiedGoogleUser> {
  try {
    if (!token) {
      throw new Error('No token provided')
    }

    // Decode the token (basic JWT decode without verification for now)
    // In production, use google-auth-library to verify signature
    const parts = token.split('.')
    if (parts.length !== 3) {
      throw new Error('Invalid token format')
    }

    // Decode payload (second part)
    const payloadPart = parts[1]
    if (!payloadPart) {
      throw new Error('Invalid token format')
    }

    const decoded = JSON.parse(
      Buffer.from(payloadPart, 'base64').toString('utf-8')
    ) as GoogleTokenPayload

    // Validate required fields
    if (!decoded.sub || !decoded.email || !decoded.name) {
      throw new Error('Missing required fields in token')
    }

    // Check token expiration
    if (decoded.exp * 1000 < Date.now()) {
      throw new Error('Token has expired')
    }

    logger.info(`Google token verified for user: ${decoded.email}`)

    return {
      googleId: decoded.sub,
      email: decoded.email,
      name: decoded.name,
      avatarUrl: decoded.picture || '',
    }
  } catch (error) {
    logger.error('Failed to verify Google token', error)
    throw error instanceof Error 
      ? error 
      : new Error('Failed to verify Google token')
  }
}

/**
 * NOTE: For production, you should implement proper JWT verification using:
 * 
 * import { OAuth2Client } from 'google-auth-library'
 * 
 * const client = new OAuth2Client(
 *   env.GOOGLE_CLIENT_ID,
 *   env.GOOGLE_CLIENT_SECRET,
 *   env.GOOGLE_REDIRECT_URI
 * )
 * 
 * export async function verifyGoogleToken(token: string) {
 *   const ticket = await client.verifyIdToken({
 *     idToken: token,
 *     audience: env.GOOGLE_CLIENT_ID
 *   })
 *   
 *   const payload = ticket.getPayload()
 *   return {
 *     googleId: payload.sub,
 *     email: payload.email,
 *     name: payload.name,
 *     avatarUrl: payload.picture || ''
 *   }
 * }
 */
