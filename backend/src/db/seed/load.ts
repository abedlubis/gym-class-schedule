import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

export const SOURCES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'sources')

/** Files in sources/ that are reference data rather than a club timetable. */
const NON_CLUB_FILES = new Set(['clubs.json', 'class-templates.json'])

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'expected HH:MM')
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD')

export const slotSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  start_time: time,
  class_name: z.string().min(1),
  programme: z.string().nullable(),
  category: z.string().min(1),
  family: z.string().nullable().optional(),
  instructors: z.array(z.string().min(1)),
  duration_min: z.number().int().positive(),
  instructor_status: z.enum(['confirmed', 'tba']).optional(),
  instructor_note: z.string().nullable().optional(),
  _duration_source: z.string().optional(),
  _note: z.string().optional(),
  _review: z.string().optional(),
})

export const clubScheduleSchema = z.object({
  _meta: z.object({
    instagram_handle: z.string().optional(),
    extracted_at: z.string().optional(),
    graphic_title: z.string().optional(),
    source: z.string().optional(),
    post_date: z.string().optional(),
  }),
  club: z.object({
    slug: z.string().min(1),
    name: z.string().min(1),
    aliases: z.array(z.string()).default([]),
  }),
  schedule: z.object({
    effective_from: isoDate.nullable(),
    timezone: z.string().default('Asia/Jakarta'),
    default_duration_min: z.number().int().positive().default(60),
    slot_count: z.number().int().nonnegative(),
    complete: z.boolean().default(true),
    note: z.string().optional(),
    staleness_warning: z
      .object({ severity: z.string(), detail: z.string(), user_facing: z.string() })
      .optional(),
    known_gap: z
      .object({ type: z.string(), user_facing: z.string() })
      .passthrough()
      .optional(),
  }),
  slots: z.array(slotSchema),
})

export const clubsFileSchema = z.object({
  clubs: z.array(
    z.object({
      slug: z.string(),
      name: z.string(),
      aliases: z.array(z.string()).default([]),
      city: z.string(),
      region: z.string(),
      status: z.enum(['open', 'presale', 'coming_soon', 'closed']),
      timezone: z.string(),
      instagram_handle: z.string().nullable(),
      instagram_url: z.string().nullable().optional(),
      instagram_verified: z.boolean().nullable().optional(),
      af_club_code: z.string().nullable(),
      address: z.string().nullable(),
      postal_code: z.string().nullable().optional(),
      official_url: z.string().nullable(),
      schedule_source_url: z.string().nullable().optional(),
      schedule_captured_at: z.string().nullable().optional(),
      alternate_handles: z.array(z.string()).optional(),
      schedule_excluded: z.object({ reason: z.string() }).passthrough().optional(),
    }),
  ),
})

export const templatesFileSchema = z.object({
  categories: z.array(
    z.object({ slug: z.string(), label: z.string(), color_hex: z.string() }),
  ),
  class_templates: z.array(
    z.object({
      name: z.string(),
      category: z.string(),
      programme: z.string().nullable(),
      family: z.string().nullable(),
      default_duration_min: z.number().int().positive(),
      occurrences: z.number().int().nonnegative(),
    }),
  ),
})

export type ClubSchedule = z.infer<typeof clubScheduleSchema>
export type SeedSlot = z.infer<typeof slotSchema>
export type ClubsFile = z.infer<typeof clubsFileSchema>
export type TemplatesFile = z.infer<typeof templatesFileSchema>

function read(file: string): unknown {
  return JSON.parse(readFileSync(join(SOURCES_DIR, file), 'utf8'))
}

export function loadReference(): { clubs: ClubsFile; templates: TemplatesFile } {
  return {
    clubs: clubsFileSchema.parse(read('clubs.json')),
    templates: templatesFileSchema.parse(read('class-templates.json')),
  }
}

export function loadClubSchedules(): { file: string; data: ClubSchedule }[] {
  return readdirSync(SOURCES_DIR)
    .filter((f) => f.endsWith('.json') && !NON_CLUB_FILES.has(f))
    .sort()
    .map((file) => ({ file, data: clubScheduleSchema.parse(read(file)) }))
}

/** Stable, collision-free slug for names like "Let's Dance" or "K-Pop Cardio". */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

export function durationSourceOf(slot: SeedSlot): 'printed' | 'capped' | 'assumed' {
  const raw = slot._duration_source ?? ''
  if (raw.startsWith('printed')) return 'printed'
  if (raw.startsWith('capped')) return 'capped'
  return 'assumed'
}
