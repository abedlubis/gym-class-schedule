import { and, asc, desc, eq, ilike, ne, or, sql, type SQL } from 'drizzle-orm'
import type { PgDatabase } from 'drizzle-orm/pg-core'
import * as s from '../db/schema.js'
import { slugify } from '../db/seed/load.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = PgDatabase<any, any, any>

export class DomainError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message)
  }
}

export type ListParams = {
  page?: number
  limit?: number
  q?: string
  club?: string
  weekday?: number
  status?: string
  sort?: string
}

/** limit is capped server-side; a client asking for 10,000 rows gets 100. */
function paging(p: ListParams) {
  const page = Math.max(1, p.page ?? 1)
  const limit = Math.min(100, Math.max(1, p.limit ?? 20))
  return { page, limit, offset: (page - 1) * limit }
}

/**
 * Any mutation bumps the counter the admin banner and the publish step read.
 * A schedule edit that was never published is the most likely way this system
 * fails silently, so the count is always visible rather than inferred.
 */
export async function bumpVersion(db: Db) {
  await db.execute(sql`
    insert into schedule_version (id, version, published_version, updated_at)
    values (1, 1, 0, now())
    on conflict (id) do update set version = schedule_version.version + 1, updated_at = now()
  `)
}

export async function getVersion(db: Db) {
  const rows = await db.execute(sql`
    select version, published_version from schedule_version where id = 1
  `)
  const row = (rows as unknown as { rows: { version: number; published_version: number }[] })
    .rows[0]
  return {
    version: Number(row?.version ?? 0),
    published_version: Number(row?.published_version ?? 0),
    unpublished: Number(row?.version ?? 0) - Number(row?.published_version ?? 0),
  }
}

export async function markPublished(db: Db) {
  await db.execute(sql`
    update schedule_version set published_version = version, updated_at = now() where id = 1
  `)
  return getVersion(db)
}

/* --------------------------------------------------------------- instructors */

export async function listInstructors(db: Db, p: ListParams) {
  const { page, limit, offset } = paging(p)
  const filters: SQL[] = []
  if (p.q) filters.push(ilike(s.instructors.name, `%${p.q}%`))
  if (p.status && p.status !== 'all') {
    filters.push(eq(s.instructors.status, p.status as 'active'))
  }
  const where = filters.length ? and(...filters) : undefined

  const rows = await db
    .select({
      id: s.instructors.id,
      name: s.instructors.name,
      slug: s.instructors.slug,
      status: s.instructors.status,
    })
    .from(s.instructors)
    .where(where)
    .orderBy(asc(s.instructors.name))
    .limit(limit)
    .offset(offset)

  const counts = await db
    .select({ instructorId: s.slotInstructors.instructorId, n: sql<number>`count(*)::int` })
    .from(s.slotInstructors)
    .groupBy(s.slotInstructors.instructorId)
  const slotCount = new Map(counts.map((c) => [c.instructorId, Number(c.n)]))

  const clubRows = await db
    .select({ instructorId: s.instructorClubs.instructorId, name: s.clubs.name })
    .from(s.instructorClubs)
    .innerJoin(s.clubs, eq(s.clubs.id, s.instructorClubs.clubId))
    .orderBy(asc(s.clubs.name))
  const clubsByInstructor = new Map<string, string[]>()
  for (const r of clubRows) {
    if (!clubsByInstructor.has(r.instructorId)) clubsByInstructor.set(r.instructorId, [])
    clubsByInstructor.get(r.instructorId)!.push(r.name)
  }

  const [total] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(s.instructors)
    .where(where)

  return {
    data: rows.map((r) => ({
      ...r,
      clubs: clubsByInstructor.get(r.id) ?? [],
      slot_count: slotCount.get(r.id) ?? 0,
    })),
    meta: { page, limit, total: Number(total?.n ?? 0) },
  }
}

/**
 * Creating an instructor whose name already exists is refused with the clubs
 * that person already teaches at, so the admin can confirm rather than silently
 * merging two coaches who share a nickname.
 */
export async function createInstructor(db: Db, input: { name: string; force?: boolean }) {
  const name = input.name.trim()
  const [existing] = await db
    .select({ id: s.instructors.id })
    .from(s.instructors)
    .where(eq(s.instructors.name, name))
    .limit(1)

  if (existing && !input.force) {
    const clubs = await db
      .select({ name: s.clubs.name })
      .from(s.instructorClubs)
      .innerJoin(s.clubs, eq(s.clubs.id, s.instructorClubs.clubId))
      .where(eq(s.instructorClubs.instructorId, existing.id))
    throw new DomainError(
      `${name} already teaches at ${clubs.map((c) => c.name).join(', ') || 'no clubs yet'}. Same person?`,
      409,
      'DUPLICATE_INSTRUCTOR',
      { existing_id: existing.id, clubs: clubs.map((c) => c.name) },
    )
  }
  if (existing) return existing

  const [row] = await db
    .insert(s.instructors)
    .values({ name, slug: slugify(name) })
    .returning({ id: s.instructors.id, name: s.instructors.name })
  await bumpVersion(db)
  return row
}

export async function updateInstructor(
  db: Db,
  id: string,
  patch: { name?: string; status?: 'active' | 'archived' },
) {
  if (patch.name) {
    const [clash] = await db
      .select({ id: s.instructors.id })
      .from(s.instructors)
      .where(and(eq(s.instructors.name, patch.name.trim()), ne(s.instructors.id, id)))
      .limit(1)
    if (clash) {
      throw new DomainError('Another instructor already uses that name', 409, 'CONFLICT')
    }
  }
  const [row] = await db
    .update(s.instructors)
    .set({
      ...(patch.name ? { name: patch.name.trim(), slug: slugify(patch.name) } : {}),
      ...(patch.status ? { status: patch.status } : {}),
      updatedAt: new Date(),
    })
    .where(eq(s.instructors.id, id))
    .returning()
  if (!row) throw new DomainError('Instructor not found', 404, 'NOT_FOUND')
  await bumpVersion(db)
  return row
}

export async function deleteInstructor(db: Db, id: string) {
  const [{ n } = { n: 0 }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(s.slotInstructors)
    .where(eq(s.slotInstructors.instructorId, id))
  if (Number(n) > 0) {
    throw new DomainError(
      `Still teaching ${n} class${Number(n) === 1 ? '' : 'es'}. Reassign those first.`,
      409,
      'IN_USE',
    )
  }
  await db.delete(s.instructorClubs).where(eq(s.instructorClubs.instructorId, id))
  await db.delete(s.instructors).where(eq(s.instructors.id, id))
  await bumpVersion(db)
}

/* -------------------------------------------------------------------- slots */

export type SlotInput = {
  club_id: string
  class_template_id: string
  weekday: number
  start_time: string
  duration_min?: number
  room?: string | null
  instructor_ids?: string[]
  status?: 'active' | 'paused'
  effective_from?: string | null
  effective_to?: string | null
  note?: string | null
}

export async function listSlots(db: Db, p: ListParams) {
  const { page, limit, offset } = paging(p)
  const filters: SQL[] = []
  if (p.club) {
    const [club] = await db
      .select({ id: s.clubs.id })
      .from(s.clubs)
      .where(eq(s.clubs.slug, p.club))
      .limit(1)
    if (!club) throw new DomainError('Unknown club', 404, 'NOT_FOUND')
    filters.push(eq(s.scheduleSlots.clubId, club.id))
  }
  if (p.weekday !== undefined) filters.push(eq(s.scheduleSlots.weekday, p.weekday))
  if (p.status && p.status !== 'all') {
    filters.push(eq(s.scheduleSlots.status, p.status as 'active'))
  }
  if (p.q) {
    const like = `%${p.q}%`
    filters.push(or(ilike(s.classTemplates.name, like), ilike(s.clubs.name, like))!)
  }
  const where = filters.length ? and(...filters) : undefined

  const rows = await db
    .select({
      id: s.scheduleSlots.id,
      weekday: s.scheduleSlots.weekday,
      startTime: s.scheduleSlots.startTime,
      durationMin: s.scheduleSlots.durationMin,
      status: s.scheduleSlots.status,
      instructorStatus: s.scheduleSlots.instructorStatus,
      room: s.scheduleSlots.room,
      effectiveFrom: s.scheduleSlots.effectiveFrom,
      effectiveTo: s.scheduleSlots.effectiveTo,
      note: s.scheduleSlots.note,
      clubId: s.clubs.id,
      clubSlug: s.clubs.slug,
      clubName: s.clubs.name,
      templateId: s.classTemplates.id,
      className: s.classTemplates.name,
      categoryColor: s.categories.colorHex,
    })
    .from(s.scheduleSlots)
    .innerJoin(s.clubs, eq(s.clubs.id, s.scheduleSlots.clubId))
    .innerJoin(s.classTemplates, eq(s.classTemplates.id, s.scheduleSlots.classTemplateId))
    .innerJoin(s.categories, eq(s.categories.id, s.classTemplates.categoryId))
    .where(where)
    .orderBy(
      asc(s.scheduleSlots.weekday),
      asc(s.scheduleSlots.startTime),
      asc(s.clubs.name),
    )
    .limit(limit)
    .offset(offset)

  const ids = rows.map((r) => r.id)
  const links = ids.length
    ? await db
        .select({
          slotId: s.slotInstructors.slotId,
          id: s.instructors.id,
          name: s.instructors.name,
        })
        .from(s.slotInstructors)
        .innerJoin(s.instructors, eq(s.instructors.id, s.slotInstructors.instructorId))
        .orderBy(asc(s.instructors.name))
    : []
  const byslot = new Map<string, { id: string; name: string }[]>()
  for (const l of links) {
    if (!ids.includes(l.slotId)) continue
    if (!byslot.has(l.slotId)) byslot.set(l.slotId, [])
    byslot.get(l.slotId)!.push({ id: l.id, name: l.name })
  }

  const [total] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(s.scheduleSlots)
    .innerJoin(s.clubs, eq(s.clubs.id, s.scheduleSlots.clubId))
    .innerJoin(s.classTemplates, eq(s.classTemplates.id, s.scheduleSlots.classTemplateId))
    .where(where)

  return {
    data: rows.map((r) => ({
      id: r.id,
      weekday: r.weekday,
      start_time: r.startTime.slice(0, 5),
      duration_min: r.durationMin,
      status: r.status,
      instructor_status: r.instructorStatus,
      room: r.room,
      effective_from: r.effectiveFrom,
      effective_to: r.effectiveTo,
      note: r.note,
      club: { id: r.clubId, slug: r.clubSlug, name: r.clubName },
      class_template: { id: r.templateId, name: r.className, color: r.categoryColor },
      instructors: byslot.get(r.id) ?? [],
    })),
    meta: { page, limit, total: Number(total?.n ?? 0) },
  }
}

async function assertNoClash(
  db: Db,
  input: { club_id: string; room?: string | null; weekday: number; start_time: string },
  excludeId?: string,
) {
  const filters: SQL[] = [
    eq(s.scheduleSlots.clubId, input.club_id),
    eq(s.scheduleSlots.weekday, input.weekday),
    eq(s.scheduleSlots.startTime, `${input.start_time}:00`),
  ]
  if (excludeId) filters.push(ne(s.scheduleSlots.id, excludeId))
  const [clash] = await db
    .select({ id: s.scheduleSlots.id, name: s.classTemplates.name })
    .from(s.scheduleSlots)
    .innerJoin(s.classTemplates, eq(s.classTemplates.id, s.scheduleSlots.classTemplateId))
    .where(and(...filters))
    .limit(1)

  // Surfaced as a 409 from the server, not only as a hint in the form — the
  // partial unique index would reject it anyway, and a generic database error
  // would be useless to whoever is filling the form in.
  if (clash) {
    throw new DomainError(
      `${clash.name} already runs at ${input.start_time} on that day`,
      409,
      'SLOT_CLASH',
    )
  }
}

export async function createSlot(db: Db, input: SlotInput) {
  await assertNoClash(db, input)
  const instructorIds = input.instructor_ids ?? []
  const [row] = await db
    .insert(s.scheduleSlots)
    .values({
      clubId: input.club_id,
      classTemplateId: input.class_template_id,
      weekday: input.weekday,
      startTime: `${input.start_time}:00`,
      durationMin: input.duration_min ?? 60,
      durationSource: 'assumed',
      room: input.room ?? null,
      instructorStatus: instructorIds.length ? 'confirmed' : 'tba',
      status: input.status ?? 'active',
      effectiveFrom: input.effective_from ?? null,
      effectiveTo: input.effective_to ?? null,
      note: input.note ?? null,
    })
    .returning({ id: s.scheduleSlots.id })

  await linkInstructors(db, row!.id, instructorIds, input.club_id)
  await bumpVersion(db)
  return row
}

export async function updateSlot(db: Db, id: string, patch: Partial<SlotInput>) {
  const [current] = await db
    .select()
    .from(s.scheduleSlots)
    .where(eq(s.scheduleSlots.id, id))
    .limit(1)
  if (!current) throw new DomainError('Slot not found', 404, 'NOT_FOUND')

  const next = {
    club_id: patch.club_id ?? current.clubId,
    room: patch.room !== undefined ? patch.room : current.room,
    weekday: patch.weekday ?? current.weekday,
    start_time: patch.start_time ?? current.startTime.slice(0, 5),
  }
  await assertNoClash(db, next, id)

  const instructorIds = patch.instructor_ids
  await db
    .update(s.scheduleSlots)
    .set({
      clubId: next.club_id,
      classTemplateId: patch.class_template_id ?? current.classTemplateId,
      weekday: next.weekday,
      startTime: `${next.start_time}:00`,
      durationMin: patch.duration_min ?? current.durationMin,
      room: next.room,
      status: patch.status ?? current.status,
      effectiveFrom:
        patch.effective_from !== undefined ? patch.effective_from : current.effectiveFrom,
      effectiveTo: patch.effective_to !== undefined ? patch.effective_to : current.effectiveTo,
      note: patch.note !== undefined ? patch.note : current.note,
      ...(instructorIds
        ? { instructorStatus: instructorIds.length ? ('confirmed' as const) : ('tba' as const) }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(s.scheduleSlots.id, id))

  if (instructorIds) await linkInstructors(db, id, instructorIds, next.club_id)
  await bumpVersion(db)
  return { id }
}

export async function deleteSlot(db: Db, id: string) {
  await db.delete(s.slotInstructors).where(eq(s.slotInstructors.slotId, id))
  const deleted = await db
    .delete(s.scheduleSlots)
    .where(eq(s.scheduleSlots.id, id))
    .returning({ id: s.scheduleSlots.id })
  if (!deleted.length) throw new DomainError('Slot not found', 404, 'NOT_FOUND')
  await bumpVersion(db)
}

/** Most new slots are an existing one moved to another day. */
export async function duplicateSlot(db: Db, id: string, patch: { weekday: number; start_time: string }) {
  const [current] = await db
    .select()
    .from(s.scheduleSlots)
    .where(eq(s.scheduleSlots.id, id))
    .limit(1)
  if (!current) throw new DomainError('Slot not found', 404, 'NOT_FOUND')

  const links = await db
    .select({ id: s.slotInstructors.instructorId })
    .from(s.slotInstructors)
    .where(eq(s.slotInstructors.slotId, id))

  return createSlot(db, {
    club_id: current.clubId,
    class_template_id: current.classTemplateId,
    weekday: patch.weekday,
    start_time: patch.start_time,
    duration_min: current.durationMin,
    room: current.room,
    instructor_ids: links.map((l) => l.id),
    status: current.status,
    effective_from: current.effectiveFrom,
    effective_to: current.effectiveTo,
  })
}

async function linkInstructors(db: Db, slotId: string, ids: string[], clubId: string) {
  await db.delete(s.slotInstructors).where(eq(s.slotInstructors.slotId, slotId))
  if (!ids.length) return
  await db.insert(s.slotInstructors).values(ids.map((id) => ({ slotId, instructorId: id })))
  // Teaching a class at a club implies working there.
  for (const instructorId of ids) {
    await db
      .insert(s.instructorClubs)
      .values({ instructorId, clubId })
      .onConflictDoNothing()
  }
}

/* ------------------------------------------------------------- reference data */

export async function listClubsAdmin(db: Db, p: ListParams) {
  const { page, limit, offset } = paging(p)
  const where = p.q ? ilike(s.clubs.name, `%${p.q}%`) : undefined
  const rows = await db
    .select()
    .from(s.clubs)
    .where(where)
    .orderBy(asc(s.clubs.region), asc(s.clubs.name))
    .limit(limit)
    .offset(offset)
  const [total] = await db.select({ n: sql<number>`count(*)::int` }).from(s.clubs).where(where)
  return { data: rows, meta: { page, limit, total: Number(total?.n ?? 0) } }
}

export async function listTemplates(db: Db, p: ListParams) {
  const { page, limit, offset } = paging(p)
  const where = p.q ? ilike(s.classTemplates.name, `%${p.q}%`) : undefined
  const rows = await db
    .select({
      id: s.classTemplates.id,
      name: s.classTemplates.name,
      family: s.classTemplates.family,
      programme: s.classTemplates.programme,
      defaultDurationMin: s.classTemplates.defaultDurationMin,
      status: s.classTemplates.status,
      category: s.categories.label,
      color: s.categories.colorHex,
    })
    .from(s.classTemplates)
    .innerJoin(s.categories, eq(s.categories.id, s.classTemplates.categoryId))
    .where(where)
    .orderBy(asc(s.classTemplates.name))
    .limit(limit)
    .offset(offset)
  const [total] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(s.classTemplates)
    .where(where)
  return { data: rows, meta: { page, limit, total: Number(total?.n ?? 0) } }
}

export async function listCategories(db: Db) {
  const data = await db.select().from(s.categories).orderBy(asc(s.categories.sortOrder))
  return { data, meta: { total: data.length } }
}

export async function updateCategory(
  db: Db,
  id: string,
  patch: { label?: string; colorHex?: string },
) {
  const [row] = await db.update(s.categories).set(patch).where(eq(s.categories.id, id)).returning()
  if (!row) throw new DomainError('Category not found', 404, 'NOT_FOUND')
  await bumpVersion(db)
  return row
}

export async function deleteClub(db: Db, id: string) {
  const [{ n } = { n: 0 }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(s.scheduleSlots)
    .where(eq(s.scheduleSlots.clubId, id))
  if (Number(n) > 0) {
    throw new DomainError(
      `${n} class${Number(n) === 1 ? '' : 'es'} still scheduled here. Remove them first.`,
      409,
      'IN_USE',
    )
  }
  await db.delete(s.clubAliases).where(eq(s.clubAliases.clubId, id))
  await db.delete(s.instructorClubs).where(eq(s.instructorClubs.clubId, id))
  await db.delete(s.clubs).where(eq(s.clubs.id, id))
  await bumpVersion(db)
}

export async function updateClub(
  db: Db,
  id: string,
  patch: Record<string, unknown>,
) {
  const allowed = [
    'name',
    'city',
    'region',
    'address',
    'status',
    'timezone',
    'instagramHandle',
    'instagramVerified',
    'officialUrl',
    'scheduleSourceUrl',
    'scheduleEffectiveFrom',
    'scheduleStale',
    'dataGapNote',
    'sortOrder',
  ] as const
  const set: Record<string, unknown> = { updatedAt: new Date() }
  for (const key of allowed) if (key in patch) set[key] = patch[key]
  const [row] = await db.update(s.clubs).set(set).where(eq(s.clubs.id, id)).returning()
  if (!row) throw new DomainError('Club not found', 404, 'NOT_FOUND')
  await bumpVersion(db)
  return row
}

export const _desc = desc
