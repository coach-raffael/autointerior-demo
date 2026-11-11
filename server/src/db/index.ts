import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import * as schema from './schema.js'

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>
export { schema }

const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../drizzle')

/**
 * Opens the database and applies pending migrations.
 * - DATABASE_URL set → PostgreSQL (production)
 * - otherwise        → embedded PGlite in `dataDir` (dev, demo) or in memory (`:memory:`, tests)
 */
export async function openDb(opts: { databaseUrl?: string; pgliteDir?: string }): Promise<{ db: DB; close: () => Promise<void> }> {
  if (opts.databaseUrl) {
    const { Pool } = (await import('pg')).default
    const { drizzle } = await import('drizzle-orm/node-postgres')
    const { migrate } = await import('drizzle-orm/node-postgres/migrator')
    const pool = new Pool({ connectionString: opts.databaseUrl, max: 10 })
    const db = drizzle(pool, { schema })
    await migrate(db, { migrationsFolder })
    return { db: db as unknown as DB, close: () => pool.end() }
  }
  const { PGlite } = await import('@electric-sql/pglite')
  const { drizzle } = await import('drizzle-orm/pglite')
  const { migrate } = await import('drizzle-orm/pglite/migrator')
  const dir = opts.pgliteDir ?? ':memory:'
  if (dir !== ':memory:') fs.mkdirSync(dir, { recursive: true })
  const client = dir === ':memory:' ? new PGlite() : new PGlite(dir)
  const db = drizzle(client, { schema })
  await migrate(db, { migrationsFolder })
  return { db: db as unknown as DB, close: () => client.close() }
}
