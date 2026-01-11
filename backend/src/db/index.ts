import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL!

if (!connectionString) {
    throw new Error('DATABASE_URL is not defined in environment variables')
}

// Query client (for regular queries)
const queryClient = postgres(connectionString, {
    max: 10, // connection pool size
    idle_timeout: 20,
    connect_timeout: 10
})

export const db = drizzle(queryClient, {schema})

// Migration client (for running migrations only)
export const migrationClient = postgres(connectionString, {
    max: 1
})

// Graceful shutdown
process.on('SIGINT', async () => {
    await queryClient.end()
    process.exit(0)
})