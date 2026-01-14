import { env, validateEnv } from '../src/configs/env'
import { redis } from '../src/libs/redis'
import { logger } from '../src/libs/logger'
import { encryptCredentials, decryptCredentials, hashPassword, verifyPassword } from '../src/libs/crypto'
import { createApp } from '../src/index'
import { db } from '../src/db'

let app: any = null

export function getApp() {
  if (!app) {
    app = createApp()
  }
  return app
}

export async function clearRateLimits() {
  try {
    // Get all keys matching rate-limit pattern and delete them
    const keys = await redis.keys('ratelimit:*')
    if (keys.length > 0) {
      await redis.del(...keys)
    }
  } catch (error) {
    logger.warn('Failed to clear rate limits', error)
  }
}

export async function clearDatabase() {
  try {
    // Truncate all tables in correct order (respecting foreign keys)
    await db`TRUNCATE TABLE reviews, favorites, notifications CASCADE`
    await db`TRUNCATE TABLE credential_access, disputes, transactions CASCADE`
    await db`TRUNCATE TABLE game_accounts, games CASCADE`
    await db`TRUNCATE TABLE email_verification_tokens, user_profiles, users CASCADE`
  } catch (error) {
    logger.warn('Failed to clear database', error)
  }
}

async function testSetup() {
  logger.info('Testing setup...')
  
  // Test 1: Environment validation
  try {
    validateEnv()
    logger.success('Environment validation passed')
  } catch (error) {
    logger.error('Environment validation failed', error)
    process.exit(1)
  }
  
  // Test 2: Redis connection
  try {
    await redis.ping()
    logger.success('Redis connection successful')
  } catch (error) {
    logger.error('Redis connection failed', error)
  }
  
  // Test 3: Encryption/Decryption
  try {
    const testData = JSON.stringify({ email: 'test@game.com', password: 'secret123' })
    const encrypted = await encryptCredentials(testData)
    const decrypted = await decryptCredentials(encrypted)
    
    if (testData === decrypted) {
      logger.success('Encryption/Decryption working')
    } else {
      throw new Error('Decryption mismatch')
    }
  } catch (error) {
    logger.error('Encryption test failed', error)
  }
  
  // Test 4: Password hashing
  try {
    const password = 'testPassword123'
    const hash = await hashPassword(password)
    const isValid = await verifyPassword(password, hash)
    
    if (isValid) {
      logger.success('Password hashing working')
    } else {
      throw new Error('Password verification failed')
    }
  } catch (error) {
    logger.error('Password hashing test failed', error)
  }
  
  logger.success('Test setup complete! 🎉')
}

testSetup().catch(console.error)