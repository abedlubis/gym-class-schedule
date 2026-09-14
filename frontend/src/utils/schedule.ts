import type { ClassOccurrence, TimeRange } from '@/types/schedule'

const DAY_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/**
 * Dates are plain YYYY-MM-DD strings and are parsed as UTC on purpose. Using
 * `new Date('2026-09-07')` in local time shifts the day for anyone west of
 * Greenwich, which would silently mislabel a whole column.
 */
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay()
}

export function formatDayLabel(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  return `${DAY_LONG[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTH[d.getUTCMonth()]}`
}

export function formatShortDay(date: string): string {
  return DAY_SHORT[weekdayOf(date)] ?? ''
}

export function dayOfMonth(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDate()
}

export function weekdayLabel(weekday: number): string {
  return DAY_SHORT[weekday] ?? ''
}

export function hourOf(time: string): number {
  return Number(time.slice(0, 2))
}

export function matchesTimeRange(time: string, range: TimeRange): boolean {
  if (range === 'all') return true
  const h = hourOf(time)
  if (range === 'morning') return h < 12
  if (range === 'afternoon') return h >= 12 && h < 17
  return h >= 17
}

export function buildSearchBlob(cls: ClassOccurrence): string {
  return [
    cls.class_name,
    cls.family ?? '',
    cls.programme ?? '',
    cls.category.label,
    cls.club.name,
    ...cls.instructors,
  ]
    .join(' ')
    .toLowerCase()
}


export function formatInstructors(cls: ClassOccurrence): string {
  if (cls.instructor_status === 'tba' || cls.instructors.length === 0) {
    return 'Instructor TBA'
  }
  return cls.instructors.join(' & ')
}

/**
 * Today's date as YYYY-MM-DD in a given IANA timezone.
 *
 * en-CA formats as YYYY-MM-DD and is stable. Computed in the club's timezone,
 * not the browser's: a member in Denpasar (WITA) is an hour ahead of Jakarta
 * and late at night that is a different calendar day.
 */
export function todayIn(timezone = 'Asia/Jakarta', now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function isToday(date: string, timezone = 'Asia/Jakarta'): boolean {
  return date === todayIn(timezone)
}

/** "Today", "Tomorrow", or the weekday name. */
export function relativeDayLabel(date: string, timezone = 'Asia/Jakarta'): string {
  const today = todayIn(timezone)
  if (date === today) return 'Today'
  const d = new Date(`${today}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  if (date === d.toISOString().slice(0, 10)) return 'Tomorrow'
  return formatDayLabel(date).split(',')[0] ?? ''
}

/**
 * Groups one day's classes by start time.
 *
 * This is the shape the all-studios view needs: at 07:00 on a Monday there may
 * be a dozen classes across a dozen branches, and one card each is unreadable.
 * One row per time, every class on it.
 */
export interface TimeGroup {
  time: string
  classes: ClassOccurrence[]
}

export function groupClassesByTime(classes: ClassOccurrence[]): TimeGroup[] {
  const byTime = new Map<string, ClassOccurrence[]>()
  for (const cls of classes) {
    if (!byTime.has(cls.start_time)) byTime.set(cls.start_time, [])
    byTime.get(cls.start_time)!.push(cls)
  }
  return [...byTime.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, items]) => ({
      time,
      classes: items.sort(
        (a, b) =>
          a.club.name.localeCompare(b.club.name) || a.class_name.localeCompare(b.class_name),
      ),
    }))
}

/** Drops the "AF " prefix — every branch has it, so it is noise in a chip. */
export function shortClubName(name: string): string {
  return name.replace(/^AF\s+/i, '')
}
