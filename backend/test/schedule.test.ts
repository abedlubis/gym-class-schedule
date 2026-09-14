import { beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { getFilters, getSchedule, listClubs } from '../src/services/schedule.js'
import { seededDb } from './helpers.js'

let db: Awaited<ReturnType<typeof seededDb>>['db']
let app: ReturnType<typeof createApp>

beforeAll(async () => {
  ;({ db } = await seededDb())
  app = createApp(db)
}, 120_000)

const WEEK = '2026-09-07' // a Monday

describe('getSchedule', () => {
  it('materialises a full Monday-to-Sunday week for one club', async () => {
    const res = await getSchedule(db as never, { club: 'setiabudi-one', week: WEEK })
    expect(res.meta.week_start).toBe('2026-09-07')
    expect(res.meta.week_end).toBe('2026-09-13')
    expect(res.classes.length).toBe(22) // every slot occurs exactly once a week
    expect(new Set(res.classes.map((c) => c.club.slug))).toEqual(
      new Set(['setiabudi-one']),
    )
  })

  it('sorts chronologically, so the timeline reads Monday first', async () => {
    const res = await getSchedule(db as never, { club: 'setiabudi-one', week: WEEK })
    const keys = res.classes.map((c) => `${c.date} ${c.start_time}`)
    expect([...keys]).toEqual([...keys].sort())
    expect(res.classes[0]!.date).toBe('2026-09-07')
  })

  it('accepts any date in a week and snaps to that week', async () => {
    const mon = await getSchedule(db as never, { club: 'cikini', week: '2026-09-07' })
    const sun = await getSchedule(db as never, { club: 'cikini', week: '2026-09-13' })
    expect(sun.meta.week_start).toBe(mon.meta.week_start)
    expect(sun.classes.length).toBe(mon.classes.length)
  })

  it('computes an end time from the duration', async () => {
    const res = await getSchedule(db as never, { club: 'puri-indah-cni', week: WEEK })
    const first = res.classes.find((c) => c.start_time === '08:30')!
    expect(first.end_time).toBe('09:30')
    expect(first.duration_source).toBe('printed')
  })

  it('hides slots that are not yet in force', async () => {
    // Setiabudi One's timetable is effective 2026-09-01.
    const before = await getSchedule(db as never, {
      club: 'setiabudi-one',
      week: '2026-08-17',
    })
    const after = await getSchedule(db as never, { club: 'setiabudi-one', week: WEEK })
    expect(before.classes).toHaveLength(0)
    expect(after.classes.length).toBeGreaterThan(0)
  })

  it('returns every club when none is named', async () => {
    const res = await getSchedule(db as never, { week: WEEK })
    expect(new Set(res.classes.map((c) => c.club.slug)).size).toBeGreaterThan(40)
  })

  it('carries TBA through instead of inventing an instructor', async () => {
    const res = await getSchedule(db as never, { club: 'gandaria', week: WEEK })
    expect(res.classes.length).toBeGreaterThan(0)
    expect(res.classes.every((c) => c.instructor_status === 'tba')).toBe(true)
    expect(res.classes.every((c) => c.instructors.length === 0)).toBe(true)
  })

  it('rejects an unknown club rather than returning an empty week', async () => {
    await expect(
      getSchedule(db as never, { club: 'not-a-club', week: WEEK }),
    ).rejects.toThrow(/Unknown club/)
  })
})

describe('listClubs', () => {
  it('counts classes per club', async () => {
    const clubs = await listClubs(db as never)
    const total = clubs.reduce((a, c) => a + (c.class_count ?? 0), 0)
    expect(total).toBeGreaterThan(900)
    expect(clubs.find((c) => c.slug === 'setiabudi-one')!.class_count).toBe(22)
    // Denpasar is WITA, and sits first alphabetically by region — it caught a
    // correlated-subquery bug that returned 0 for every club.
    expect(clubs.find((c) => c.slug === 'living-world-denpasar')!.class_count).toBe(21)
  })

  it('surfaces the flags the UI warns on', async () => {
    const clubs = await listClubs(db as never, { status: 'all' })
    expect(clubs.filter((c) => c.schedule_stale).length).toBeGreaterThan(0)
    expect(clubs.filter((c) => c.data_gap_note).length).toBeGreaterThan(0)
  })
})

describe('getFilters', () => {
  it('derives options from the data', async () => {
    const f = await getFilters(db as never)
    expect(f.categories.length).toBeGreaterThan(5)
    expect(f.families.length).toBeGreaterThan(5)
    expect(f.instructors.length).toBeGreaterThan(400)
    expect(f.programmes.map((p) => p.name)).toContain('LesMills')
  })

  it('scopes to one club when asked', async () => {
    const all = await getFilters(db as never)
    const one = await getFilters(db as never, 'setiabudi-one')
    expect(one.instructors.length).toBeLessThan(all.instructors.length)
    expect(one.instructors.length).toBeGreaterThan(0)
  })
})

describe('http layer', () => {
  it('serves the schedule', async () => {
    const res = await app.request(`/api/v1/schedule?club=setiabudi-one&week=${WEEK}`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { data: { classes: unknown[] } }
    expect(body.data.classes).toHaveLength(22)
    expect(res.headers.get('cache-control')).toContain('max-age=60')
  })

  it('422s on a malformed week', async () => {
    const res = await app.request('/api/v1/schedule?week=next-tuesday')
    expect(res.status).toBe(422)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('VALIDATION_FAILED')
  })

  it('404s on an unknown club', async () => {
    const res = await app.request('/api/v1/schedule?club=nope')
    expect(res.status).toBe(404)
  })

  it('lists only open clubs by default', async () => {
    const res = await app.request('/api/v1/clubs')
    const body = (await res.json()) as { data: { status: string }[] }
    expect(body.data.every((c) => c.status === 'open')).toBe(true)
  })

  it('reports health', async () => {
    expect((await app.request('/health')).status).toBe(200)
  })
})
