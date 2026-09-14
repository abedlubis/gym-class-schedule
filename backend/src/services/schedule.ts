import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import type { PgDatabase } from 'drizzle-orm/pg-core'
import * as s from '../db/schema.js'
import {
  addMinutes,
  currentWeekStart,
  hhmm,
  isEffectiveOn,
  weekDates,
  weekStartOf,
  type IsoDate,
} from '../lib/week.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = PgDatabase<any, any, any>

export type ClassOccurrence = {
  id: string
  slot_id: string
  date: IsoDate
  start_time: string
  end_time: string
  duration_min: number
  duration_source: 'printed' | 'capped' | 'assumed'
  class_name: string
  family: string | null
  programme: string | null
  category: { slug: string; label: string; color: string }
  instructors: string[]
  instructor_status: 'confirmed' | 'tba'
  club: { slug: string; name: string }
  note: string | null
}

export type ClubSummary = {
  slug: string
  name: string
  city: string
  region: string
  timezone: string
  status: string
  instagram_handle: string | null
  schedule_effective_from: string | null
  schedule_stale: boolean
  data_gap_note: string | null
  class_count?: number
}

export async function listClubs(
  db: Db,
  opts: { status?: string } = {},
): Promise<ClubSummary[]> {
  const status = opts.status ?? 'open'
  const rows = await db
    .select({
      id: s.clubs.id,
      slug: s.clubs.slug,
      name: s.clubs.name,
      city: s.clubs.city,
      region: s.clubs.region,
      timezone: s.clubs.timezone,
      status: s.clubs.status,
      instagramHandle: s.clubs.instagramHandle,
      effectiveFrom: s.clubs.scheduleEffectiveFrom,
      stale: s.clubs.scheduleStale,
      gap: s.clubs.dataGapNote,
    })
    .from(s.clubs)
    .where(status === 'all' ? undefined : eq(s.clubs.status, status as 'open'))
    .orderBy(asc(s.clubs.region), asc(s.clubs.sortOrder), asc(s.clubs.name))

  // A grouped count rather than a correlated subquery in the projection.
  // Drizzle renders the correlated form against an aliased outer table and it
  // silently returned 0 for every club — the kind of bug that looks like a data
  // problem, so it gets its own test.
  const counts = await db
    .select({
      clubId: s.scheduleSlots.clubId,
      n: sql<number>`count(*)::int`,
    })
    .from(s.scheduleSlots)
    .where(eq(s.scheduleSlots.status, 'active'))
    .groupBy(s.scheduleSlots.clubId)

  const countByClub = new Map(counts.map((c) => [c.clubId, Number(c.n)]))

  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    city: r.city,
    region: r.region,
    timezone: r.timezone,
    status: r.status,
    instagram_handle: r.instagramHandle,
    schedule_effective_from: r.effectiveFrom,
    schedule_stale: r.stale,
    data_gap_note: r.gap,
    class_count: countByClub.get(r.id) ?? 0,
  }))
}

export type ScheduleResult = {
  meta: {
    club: ClubSummary | null
    clubs: string[]
    timezone: string
    week_start: IsoDate
    week_end: IsoDate
    class_count: number
  }
  classes: ClassOccurrence[]
}

/**
 * Expands recurring slots into dated occurrences for one ISO week.
 *
 * Done server-side on purpose: it keeps one definition of "this week" and
 * leaves the frontend with no date arithmetic to get wrong. Times come back as
 * wall-clock strings plus a date, never as UTC instants — a 07:00 class in
 * Jakarta reads 07:00 to a member in Denpasar, which is the only reading that
 * makes sense on a gym timetable.
 */
export async function getSchedule(
  db: Db,
  opts: { club?: string; week?: IsoDate; now?: Date } = {},
): Promise<ScheduleResult> {
  const clubs = await listClubs(db, { status: 'all' })
  const target = opts.club ? clubs.find((c) => c.slug === opts.club) : undefined
  if (opts.club && !target) {
    throw Object.assign(new Error(`Unknown club "${opts.club}"`), { status: 404 })
  }

  const timezone = target?.timezone ?? 'Asia/Jakarta'
  const weekStart = opts.week ? weekStartOf(opts.week) : currentWeekStart(timezone, opts.now)
  const dates = weekDates(weekStart)

  const conditions = [eq(s.scheduleSlots.status, 'active')]
  if (target) {
    const ids = await db
      .select({ id: s.clubs.id })
      .from(s.clubs)
      .where(eq(s.clubs.slug, target.slug))
    conditions.push(inArray(s.scheduleSlots.clubId, ids.map((r) => r.id)))
  }

  const rows = await db
    .select({
      slotId: s.scheduleSlots.id,
      weekday: s.scheduleSlots.weekday,
      startTime: s.scheduleSlots.startTime,
      durationMin: s.scheduleSlots.durationMin,
      durationSource: s.scheduleSlots.durationSource,
      instructorStatus: s.scheduleSlots.instructorStatus,
      note: s.scheduleSlots.note,
      effectiveFrom: s.scheduleSlots.effectiveFrom,
      effectiveTo: s.scheduleSlots.effectiveTo,
      className: s.classTemplates.name,
      family: s.classTemplates.family,
      programme: s.classTemplates.programme,
      categorySlug: s.categories.slug,
      categoryLabel: s.categories.label,
      categoryColor: s.categories.colorHex,
      clubSlug: s.clubs.slug,
      clubName: s.clubs.name,
    })
    .from(s.scheduleSlots)
    .innerJoin(s.classTemplates, eq(s.classTemplates.id, s.scheduleSlots.classTemplateId))
    .innerJoin(s.categories, eq(s.categories.id, s.classTemplates.categoryId))
    .innerJoin(s.clubs, eq(s.clubs.id, s.scheduleSlots.clubId))
    .where(and(...conditions))
    .orderBy(asc(s.scheduleSlots.weekday), asc(s.scheduleSlots.startTime))

  const slotIds = rows.map((r) => r.slotId)
  const instructorRows = slotIds.length
    ? await db
        .select({ slotId: s.slotInstructors.slotId, name: s.instructors.name })
        .from(s.slotInstructors)
        .innerJoin(s.instructors, eq(s.instructors.id, s.slotInstructors.instructorId))
        .where(inArray(s.slotInstructors.slotId, slotIds))
        .orderBy(asc(s.instructors.name))
    : []

  const instructorsBySlot = new Map<string, string[]>()
  for (const r of instructorRows) {
    if (!instructorsBySlot.has(r.slotId)) instructorsBySlot.set(r.slotId, [])
    instructorsBySlot.get(r.slotId)!.push(r.name)
  }

  const classes: ClassOccurrence[] = []
  for (const date of dates) {
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay()
    for (const r of rows) {
      if (r.weekday !== dow) continue
      if (!isEffectiveOn(date, r.effectiveFrom, r.effectiveTo)) continue
      const start = hhmm(r.startTime)
      classes.push({
        id: `${r.slotId}:${date}`,
        slot_id: r.slotId,
        date,
        start_time: start,
        end_time: addMinutes(start, r.durationMin),
        duration_min: r.durationMin,
        duration_source: r.durationSource,
        class_name: r.className,
        family: r.family,
        programme: r.programme,
        category: {
          slug: r.categorySlug,
          label: r.categoryLabel,
          color: r.categoryColor,
        },
        instructors: instructorsBySlot.get(r.slotId) ?? [],
        instructor_status: r.instructorStatus,
        club: { slug: r.clubSlug, name: r.clubName },
        note: r.note,
      })
    }
  }

  classes.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.start_time.localeCompare(b.start_time) ||
      a.club.name.localeCompare(b.club.name) ||
      a.class_name.localeCompare(b.class_name),
  )

  return {
    meta: {
      club: target ?? null,
      clubs: clubs.filter((c) => (c.class_count ?? 0) > 0).map((c) => c.slug),
      timezone,
      week_start: weekStart,
      week_end: dates[6]!,
      class_count: classes.length,
    },
    classes,
  }
}

export type Filters = {
  categories: { slug: string; label: string; color: string; count: number }[]
  families: { name: string; count: number }[]
  class_names: { name: string; count: number }[]
  programmes: { name: string; count: number }[]
  instructors: { name: string; count: number }[]
}

/**
 * Filter options derived from the data rather than hand-maintained.
 *
 * The v1 dataset kept a `filters` block in the JSON that had to be edited by
 * hand alongside the classes; deriving it removes the drift risk permanently.
 */
export async function getFilters(db: Db, clubSlug?: string): Promise<Filters> {
  const where = clubSlug ? sql`and c.slug = ${clubSlug}` : sql``
  const base = sql`
    from schedule_slots ss
    join class_templates ct on ct.id = ss.class_template_id
    join categories cat on cat.id = ct.category_id
    join clubs c on c.id = ss.club_id
    where ss.status = 'active' ${where}
  `

  const rowsOf = async <T>(q: ReturnType<typeof sql>): Promise<T[]> => {
    const res = await db.execute(q)
    return (res as unknown as { rows: T[] }).rows ?? (res as unknown as T[])
  }

  const categories = await rowsOf<{ slug: string; label: string; color_hex: string; n: number }>(sql`
    select cat.slug, cat.label, cat.color_hex, count(*)::int as n ${base}
    group by 1,2,3 order by n desc, cat.label
  `)
  const families = await rowsOf<{ family: string; n: number }>(sql`
    select ct.family, count(*)::int as n ${base} and ct.family is not null
    group by 1 order by n desc, ct.family
  `)
  const classNames = await rowsOf<{ name: string; n: number }>(sql`
    select ct.name, count(*)::int as n ${base} group by 1 order by n desc, ct.name
  `)
  const programmes = await rowsOf<{ programme: string; n: number }>(sql`
    select ct.programme, count(*)::int as n ${base} and ct.programme is not null
    group by 1 order by n desc, ct.programme
  `)
  const instructors = await rowsOf<{ name: string; n: number }>(sql`
    select i.name, count(*)::int as n
    from slot_instructors si
    join instructors i on i.id = si.instructor_id
    join schedule_slots ss on ss.id = si.slot_id
    join clubs c on c.id = ss.club_id
    where ss.status = 'active' ${where}
    group by 1 order by n desc, i.name
  `)

  return {
    categories: categories.map((r) => ({
      slug: r.slug,
      label: r.label,
      color: r.color_hex,
      count: Number(r.n),
    })),
    families: families.map((r) => ({ name: r.family, count: Number(r.n) })),
    class_names: classNames.map((r) => ({ name: r.name, count: Number(r.n) })),
    programmes: programmes.map((r) => ({ name: r.programme, count: Number(r.n) })),
    instructors: instructors.map((r) => ({ name: r.name, count: Number(r.n) })),
  }
}
