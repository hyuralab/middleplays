import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'
import { env } from '@/configs/env'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const TAG_LENGTH = 16
const KEY_LENGTH = 32

// Derive key from secret
function deriveKey(secret: string, salt: string): Buffer {
  return scryptSync(secret, salt, KEY_LENGTH)
}

/**
 * Encrypt credentials (email/password for game accounts)
 * Returns format: iv:authTag:encrypted
 */
export async function encryptCredentials(plaintext: string): Promise<string> {
  const iv = randomBytes(IV_LENGTH)
  const key = deriveKey(env.CREDENTIAL_ENCRYPTION_KEY, env.CREDENTIAL_ENCRYPTION_SALT)
  
  const cipher = createCipheriv(ALGORITHM, key, iv)
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  const authTag = cipher.getAuthTag()
  
  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

/**
 * Decrypt credentials
 */
export async function decryptCredentials(encryptedData: string): Promise<string> {
  const parts = encryptedData.split(':')
  
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format')
  }
  
  // ✅ FIX: Explicit type assertion after validation
  const ivHex = parts[0]!
  const authTagHex = parts[1]!
  const encrypted = parts[2]!
  
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const key = deriveKey(env.CREDENTIAL_ENCRYPTION_KEY, env.CREDENTIAL_ENCRYPTION_SALT)
  
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}

/**
 * Generate random ID (for transaction IDs, etc)
 */
export function generateId(length = 12): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const randomValues = randomBytes(length)
  
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i]! % chars.length]  // ✅ FIX: Add !
  }
  
  return result
}

/**
 * Hash password using Bun's built-in password hasher
 */
export async function hashPassword(password: string): Promise<string> {
  return await Bun.password.hash(password, {
    algorithm: 'argon2id',
    memoryCost: 65536, // 64 MB
    timeCost: 3,
  })
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await Bun.password.verify(password, hash)
}