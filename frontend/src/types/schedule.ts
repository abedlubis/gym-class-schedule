/** Mirrors the API contract in apps/api/src/services/schedule.ts. */

export interface CategoryRef {
  slug: string
  label: string
  color: string
}

export interface ClubRef {
  slug: string
  name: string
}

/**
 * One dated occurrence of a recurring slot. The API materialises these for a
 * single ISO week, so the frontend does no date arithmetic at all.
 */
export interface ClassOccurrence {
  id: string
  slot_id: string
  date: string
  start_time: string
  end_time: string
  duration_min: number
  duration_source: 'printed' | 'capped' | 'assumed'
  class_name: string
  family: string | null
  programme: string | null
  category: CategoryRef
  instructors: string[]
  /** Studios publish timetables before naming an instructor. Show "TBA". */
  instructor_status: 'confirmed' | 'tba'
  club: ClubRef
  note: string | null
}

export interface Club {
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

export interface ScheduleMeta {
  club: Club | null
  clubs: string[]
  timezone: string
  week_start: string
  week_end: string
  class_count: number
}

export interface ScheduleResult {
  meta: ScheduleMeta
  classes: ClassOccurrence[]
}

export interface CountedOption {
  name: string
  count: number
}

export interface FilterOptions {
  categories: (CategoryRef & { count: number })[]
  families: CountedOption[]
  class_names: CountedOption[]
  programmes: CountedOption[]
  instructors: CountedOption[]
}

export type TimeRange = 'all' | 'morning' | 'afternoon' | 'evening'

export interface ActiveFilters {
  search: string
  /** Class families ("Yoga", "Dance") — branches name the same class differently. */
  families: string[]
  categories: string[]
  instructors: string[]
  programmes: string[]
  timeRange: TimeRange
}

