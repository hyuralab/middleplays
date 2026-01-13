import postgres from 'postgres'
import { logger } from '@/libs/logger'

const connectionString = process.env.DATABASE_URL!

if (!connectionString) {
    throw new Error('DATABASE_URL is not defined in environment variables')
}

// Raw SQL client with optimized connection pool
export const db = postgres(connectionString, {
    max: 50,  // ← Increased from 10 to handle 1-2k concurrent
    idle_timeout: 30,  // ← Increased from 20
    connect_timeout: 15,  // ← Increased from 10
    max_lifetime: 600,  // ← Connection expires after 10 min
    
    onnotice: (notice) => {
        if (notice.severity !== 'NOTICE') {
            logger.warn('PostgreSQL notice:', notice.message)
        }
    },
})

// Helper function to check database connection
export async function checkDbConnection(): Promise<boolean> {
  try {
    await db`SELECT 1`
    return true
  } catch (error) {
    logger.error('Database connection failed:', error)
    return false
  }
}

// Graceful shutdown helper
export async function closeDatabase() {
  await db.end()
}