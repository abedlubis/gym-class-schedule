import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import * as s from '../src/db/schema.js'
import { importSeed } from '../src/db/seed/import.js'

export async function seededDb() {
  const pg = new PGlite()
  const db = drizzle(pg, { schema: s })
  const ddl = readFileSync('./drizzle/0000_init.sql', 'utf8')
  for (const stmt of ddl.split('--> statement-breakpoint')) {
    if (stmt.trim()) await pg.exec(stmt)
  }
  const stats = await importSeed(db as never)
  return { db, stats }
}
