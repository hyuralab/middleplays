import postgres from 'postgres'
import fs from 'fs'
import path from 'path'

const connectionUrl = process.env.DATABASE_URL || 'postgresql://postgresql:Hyura_01@localhost:5432/middleplays'

const sql = postgres(connectionUrl)

// Migration tracking table
const MIGRATIONS_TABLE = '_migrations'

interface Migration {
  name: string
  executed_at: Date
}

async function createMigrationsTable() {
  try {
    await sql`SET search_path TO public`
    await sql`GRANT ALL ON SCHEMA public TO postgresql`
    await sql`
      CREATE TABLE IF NOT EXISTS ${sql(MIGRATIONS_TABLE)} (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `
    console.log('✓ Migrations table ready')
  } catch (error) {
    console.error('Error creating migrations table:', error)
    throw error
  }
}

async function getExecutedMigrations(): Promise<Set<string>> {
  try {
    const migrations = await sql<Migration[]>`SELECT name FROM ${sql(MIGRATIONS_TABLE)}`
    return new Set(migrations.map((m) => m.name))
  } catch {
    return new Set()
  }
}

async function executeMigration(name: string, content: string) {
  try {
    // Split by --> statement-breakpoint separator or just execute the whole thing
    const statements = content
      .split('-->')
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0 && !stmt.startsWith('statement-breakpoint'))

    for (const statement of statements) {
      if (statement.length > 0) {
        await sql.unsafe(statement)
      }
    }

    await sql`INSERT INTO ${sql(MIGRATIONS_TABLE)} (name) VALUES (${name})`
    console.log(`✓ ${name}`)
  } catch (error) {
    console.error(`✗ ${name}:`, error)
    throw error
  }
}

async function migrate() {
  try {
    console.log('🚀 Starting database migrations...\n')

    await createMigrationsTable()

    const migrationsDir = path.join(import.meta.dir, '../../migrations')
    const executedMigrations = await getExecutedMigrations()

    // Get all .sql files sorted by name
    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort()

    if (files.length === 0) {
      console.log('No migrations found.')
      await sql.end()
      process.exit(0)
    }

    let migratedCount = 0
    for (const file of files) {
      if (!executedMigrations.has(file)) {
        const filePath = path.join(migrationsDir, file)
        const content = fs.readFileSync(filePath, 'utf-8')
        await executeMigration(file, content)
        migratedCount++
      }
    }

    console.log(`\n✅ Migration complete! (${migratedCount} new migrations applied)`)
    await sql.end()
    process.exit(0)
  } catch (error) {
    console.error('❌ Migration failed:', error)
    await sql.end()
    process.exit(1)
  }
}

migrate()
