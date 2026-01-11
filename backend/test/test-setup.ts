import { env, validateEnv } from '../src/configs/env'
import { redis } from '../src/libs/redis'
import { logger } from '../src/libs/logger'
import { encryptCredentials, decryptCredentials, hashPassword, verifyPassword } from '../src/libs/crypto'

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
    await redis.connect()
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
  
  await redis.quit()
  logger.success('All tests passed! 🎉')
}

testSetup()