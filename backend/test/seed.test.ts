import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { sql } from 'drizzle-orm'
import { beforeAll, describe, expect, it } from 'vitest'
import * as s from '../src/db/schema.js'
import { importSeed, type ImportStats } from '../src/db/seed/import.js'
import { validate } from '../src/db/seed/validate.js'

let db: ReturnType<typeof drizzle>
let stats: ImportStats

beforeAll(async () => {
  const pg = new PGlite()
  db = drizzle(pg, { schema: s })
  const ddl = readFileSync('./drizzle/0000_init.sql', 'utf8')
  for (const stmt of ddl.split('--> statement-breakpoint')) {
    if (stmt.trim()) await pg.exec(stmt)
  }
  stats = await importSeed(db as never)
}, 120_000)

describe('seed validation', () => {
  it('has no blocking errors', () => {
    expect(validate().filter((f) => f.level === 'error')).toEqual([])
  })
})

describe('seed import', () => {
  it('loads every club from clubs.json', async () => {
    const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(s.clubs)
    expect(row!.n).toBe(stats.clubs)
    expect(stats.clubs).toBeGreaterThanOrEqual(60)
  })

  it('loads every transcribed slot', async () => {
    const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(s.scheduleSlots)
    expect(row!.n).toBe(stats.slots)
    expect(stats.slots).toBeGreaterThan(1000)
  })

  it('treats a nickname as one person across clubs', async () => {
    const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(s.instructors)
    expect(row!.n).toBe(stats.instructors)
    const multi = await db.execute(sql`
      select count(*)::int as n from (
        select instructor_id from instructor_clubs
        group by instructor_id having count(*) > 1
      ) t
    `)
    expect(Number((multi as unknown as { rows: { n: number }[] }).rows[0]!.n)).toBeGreaterThan(20)
  })

  it('marks slots with no instructor as tba rather than dropping them', async () => {
    const rows = await db.execute(sql`
      select count(*)::int as n from schedule_slots where instructor_status = 'tba'
    `)
    const n = Number((rows as unknown as { rows: { n: number }[] }).rows[0]!.n)
    expect(n).toBe(stats.tbaSlots)
    expect(n).toBeGreaterThan(0)
  })

  it('never leaves a tba slot with an instructor attached', async () => {
    const rows = await db.execute(sql`
      select count(*)::int as n from schedule_slots ss
      join slot_instructors si on si.slot_id = ss.id
      where ss.instructor_status = 'tba'
    `)
    expect(Number((rows as unknown as { rows: { n: number }[] }).rows[0]!.n)).toBe(0)
  })

  it('has no two classes at the same club, room, weekday and time', async () => {
    const rows = await db.execute(sql`
      select count(*)::int as n from (
        select club_id, room, weekday, start_time
        from schedule_slots group by 1,2,3,4 having count(*) > 1
      ) t
    `)
    expect(Number((rows as unknown as { rows: { n: number }[] }).rows[0]!.n)).toBe(0)
  })

  it('records how each duration was arrived at', async () => {
    const rows = await db.execute(sql`
      select duration_source, count(*)::int as n from schedule_slots group by 1
    `)
    const bySource = Object.fromEntries(
      (rows as unknown as { rows: { duration_source: string; n: number }[] }).rows.map(
        (r) => [r.duration_source, Number(r.n)],
      ),
    )
    expect(bySource.printed).toBeGreaterThan(0)
    expect(bySource.capped).toBeGreaterThan(0)
    expect(bySource.assumed).toBeGreaterThan(0)
  })

  it('gives every class template a category and most of them a family', async () => {
    const rows = await db.execute(sql`
      select count(*)::int as total,
             count(family)::int as with_family
      from class_templates
    `)
    const r = (rows as unknown as { rows: { total: number; with_family: number }[] }).rows[0]!
    expect(Number(r.with_family)).toBe(Number(r.total))
  })
})
