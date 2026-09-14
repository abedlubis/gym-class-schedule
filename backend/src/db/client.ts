import { existsSync } from 'node:fs'
import { attachDatabasePool } from '@vercel/functions'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema.js'

/**
 * Load .env when running locally.
 *
 * tsx does not read .env on its own, and on Vercel the platform injects
 * environment variables directly — so this is the one place that needs to
 * bridge the gap. `process.loadEnvFile` is built into Node 20.12+ and 22+, so
 * no dotenv dependency.
 */
if (!process.env.VERCEL && existsSync('.env')) {
  try {
    process.loadEnvFile('.env')
  } catch {
    // A malformed .env should not take down a deployment that does not need it.
  }
}

/**
 * Two connection strings, on purpose.
 *
 * DATABASE_URL is Neon's pooled string (hostname contains `-pooler`) and routes
 * through PgBouncer in transaction mode — right for serverless request handling.
 * DIRECT_URL opens a session straight to Postgres and is required for schema
 * migrations, which fail through a transaction-mode pooler.
 *
 * Scripts that need a session (migrate, seed) set DB_DIRECT=1.
 */
const direct = process.env.DB_DIRECT === '1'
const url = direct ? (process.env.DIRECT_URL ?? process.env.DATABASE_URL) : process.env.DATABASE_URL

if (!url) {
  const name = direct ? 'DIRECT_URL' : 'DATABASE_URL'
  throw new Error(
    [
      `${name} is not set.`,
      '',
      'Locally: copy .env.example to .env and fill in both connection strings',
      'from your Neon dashboard — DATABASE_URL is the pooled one (the hostname',
      'contains "-pooler"), DIRECT_URL is the plain one.',
      '',
      'On Vercel: set them under Settings → Environment Variables.',
    ].join('\n'),
  )
}

const pool = new Pool({
  connectionString: url,
  max: Number(process.env.PG_POOL_MAX ?? (direct ? 1 : 10)),
})

/**
 * On Vercel this hands the connection lifecycle to the platform: the first
 * request opens a TCP connection, later requests reuse it, and idle connections
 * close cleanly before the function is suspended. Outside Vercel it is a no-op,
 * so local dev and tests behave the same.
 */
attachDatabasePool(pool)

export const db = drizzle(pool, { schema })
export const close = () => pool.end()
