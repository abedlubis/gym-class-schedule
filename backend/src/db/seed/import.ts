import { sql } from 'drizzle-orm'
import type { PgDatabase } from 'drizzle-orm/pg-core'
import * as s from '../schema.js'
import {
  durationSourceOf,
  loadClubSchedules,
  loadReference,
  slugify,
} from './load.js'
import { validate } from './validate.js'

export type ImportStats = {
  clubs: number
  aliases: number
  categories: number
  templates: number
  instructors: number
  instructorClubs: number
  slots: number
  slotInstructors: number
  tbaSlots: number
  skippedClubs: string[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = PgDatabase<any, any, any>

/**
 * Wipes and reloads every table this importer owns.
 *
 * Deliberately destructive: the seed files are the source of truth for the
 * initial load, and a partial merge would leave orphaned slots behind when a
 * club republishes a timetable. Admin-created data does not live here yet; once
 * it does, this becomes an upsert keyed on (club, weekday, start_time).
 */
export async function importSeed(db: Db): Promise<ImportStats> {
  const errors = validate().filter((f) => f.level === 'error')
  if (errors.length > 0) {
    throw new Error(
      `Refusing to import: ${errors.length} validation error(s). Run seed:validate.`,
    )
  }

  const { clubs: clubsFile, templates } = loadReference()
  const schedules = loadClubSchedules()

  const stats: ImportStats = {
    clubs: 0,
    aliases: 0,
    categories: 0,
    templates: 0,
    instructors: 0,
    instructorClubs: 0,
    slots: 0,
    slotInstructors: 0,
    tbaSlots: 0,
    skippedClubs: [],
  }

  await db.execute(sql`
    truncate table
      ${s.slotInstructors}, ${s.scheduleSlots}, ${s.instructorClubs},
      ${s.instructors}, ${s.classTemplates}, ${s.categories},
      ${s.clubAliases}, ${s.clubs}
    restart identity cascade
  `)

  /* -------------------------------------------------------------- clubs */

  const scheduleBySlug = new Map(schedules.map((x) => [x.data.club.slug, x.data]))

  const clubRows = clubsFile.clubs.map((c) => {
    const sched = scheduleBySlug.get(c.slug)
    return {
      afClubCode: c.af_club_code,
      slug: c.slug,
      name: c.name,
      city: c.city,
      region: c.region,
      address: c.address,
      postalCode: c.postal_code ?? null,
      status: c.status,
      timezone: c.timezone,
      instagramHandle: c.instagram_handle,
      instagramVerified: c.instagram_verified ?? null,
      officialUrl: c.official_url,
      scheduleSourceUrl: c.schedule_source_url ?? null,
      scheduleEffectiveFrom: sched?.schedule.effective_from ?? null,
      scheduleCapturedAt: c.schedule_captured_at ?? null,
      scheduleStale: Boolean(sched?.schedule.staleness_warning),
      dataGapNote:
        sched?.schedule.known_gap?.user_facing ??
        c.schedule_excluded?.reason ??
        null,
    }
  })

  const insertedClubs = await db
    .insert(s.clubs)
    .values(clubRows)
    .returning({ id: s.clubs.id, slug: s.clubs.slug })
  stats.clubs = insertedClubs.length
  const clubId = new Map(insertedClubs.map((c) => [c.slug, c.id]))

  const aliasRows = clubsFile.clubs.flatMap((c) =>
    [...new Set(c.aliases)].map((alias) => ({ clubId: clubId.get(c.slug)!, alias })),
  )
  if (aliasRows.length) {
    await db.insert(s.clubAliases).values(aliasRows)
    stats.aliases = aliasRows.length
  }

  /* --------------------------------------------------------- categories */

  const insertedCats = await db
    .insert(s.categories)
    .values(
      templates.categories.map((c, i) => ({
        slug: c.slug,
        label: c.label,
        colorHex: c.color_hex,
        sortOrder: i,
      })),
    )
    .returning({ id: s.categories.id, slug: s.categories.slug })
  stats.categories = insertedCats.length
  const categoryId = new Map(insertedCats.map((c) => [c.slug, c.id]))

  /* ----------------------------------------------------- class templates */

  const insertedTemplates = await db
    .insert(s.classTemplates)
    .values(
      templates.class_templates.map((t) => ({
        slug: slugify(t.name),
        name: t.name,
        categoryId: categoryId.get(t.category)!,
        family: t.family,
        programme: t.programme,
        defaultDurationMin: t.default_duration_min,
      })),
    )
    .returning({ id: s.classTemplates.id, name: s.classTemplates.name })
  stats.templates = insertedTemplates.length
  const templateId = new Map(insertedTemplates.map((t) => [t.name, t.id]))

  /* ---------------------------------------------------------- instructors */

  // One row per nickname, globally. An instructor teaching at six branches is
  // one person here and six rows in instructor_clubs.
  const nameToClubs = new Map<string, Set<string>>()
  for (const { data } of schedules) {
    for (const slot of data.slots) {
      for (const name of slot.instructors) {
        if (!nameToClubs.has(name)) nameToClubs.set(name, new Set())
        nameToClubs.get(name)!.add(data.club.slug)
      }
    }
  }

  const instructorNames = [...nameToClubs.keys()].sort()
  const insertedInstructors = instructorNames.length
    ? await db
        .insert(s.instructors)
        .values(
          instructorNames.map((name) => ({ slug: slugify(name), name })),
        )
        .returning({ id: s.instructors.id, name: s.instructors.name })
    : []
  stats.instructors = insertedInstructors.length
  const instructorId = new Map(insertedInstructors.map((i) => [i.name, i.id]))

  const icRows = [...nameToClubs.entries()].flatMap(([name, clubSlugs]) =>
    [...clubSlugs].map((slug) => ({
      instructorId: instructorId.get(name)!,
      clubId: clubId.get(slug)!,
    })),
  )
  if (icRows.length) {
    await db.insert(s.instructorClubs).values(icRows)
    stats.instructorClubs = icRows.length
  }

  /* --------------------------------------------------------------- slots */

  for (const { data } of schedules) {
    const cid = clubId.get(data.club.slug)
    if (!cid) {
      stats.skippedClubs.push(data.club.slug)
      continue
    }

    const rows = data.slots.map((slot) => ({
      clubId: cid,
      classTemplateId: templateId.get(slot.class_name)!,
      weekday: slot.weekday,
      startTime: `${slot.start_time}:00`,
      durationMin: slot.duration_min,
      durationSource: durationSourceOf(slot),
      instructorStatus: slot.instructors.length === 0 ? ('tba' as const) : ('confirmed' as const),
      instructorNote: slot.instructor_note ?? null,
      note: slot._note ?? slot._review ?? null,
      effectiveFrom: data.schedule.effective_from,
    }))

    const inserted = await db
      .insert(s.scheduleSlots)
      .values(rows)
      .returning({ id: s.scheduleSlots.id })
    stats.slots += inserted.length

    const links: { slotId: string; instructorId: string }[] = []
    data.slots.forEach((slot, i) => {
      if (slot.instructors.length === 0) {
        stats.tbaSlots++
        return
      }
      for (const name of slot.instructors) {
        links.push({ slotId: inserted[i]!.id, instructorId: instructorId.get(name)! })
      }
    })
    if (links.length) {
      await db.insert(s.slotInstructors).values(links)
      stats.slotInstructors += links.length
    }
  }

  await db
    .insert(s.scheduleVersion)
    .values({ id: 1, version: 1, publishedVersion: 0 })
    .onConflictDoNothing()

  return stats
}

/* -------------------------------------------------------------------- CLI */

async function main() {
  process.env.DB_DIRECT = '1'
  const { db, close } = await import('../client.js')
  try {
    const stats = await importSeed(db)
    console.table({
      clubs: stats.clubs,
      aliases: stats.aliases,
      categories: stats.categories,
      'class templates': stats.templates,
      instructors: stats.instructors,
      'instructor↔club links': stats.instructorClubs,
      slots: stats.slots,
      'slot↔instructor links': stats.slotInstructors,
      'slots awaiting an instructor': stats.tbaSlots,
    })
    if (stats.skippedClubs.length) {
      console.log('Skipped (no club row):', stats.skippedClubs.join(', '))
    }
  } finally {
    await close()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main()
