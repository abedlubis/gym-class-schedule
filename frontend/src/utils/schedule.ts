import type { ClassOccurrence, DayGroup, TimeRange } from '@/types/schedule'

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

export function groupClassesByDay(classes: ClassOccurrence[]): DayGroup[] {
  const byDate = new Map<string, ClassOccurrence[]>()
  for (const cls of classes) {
    if (!byDate.has(cls.date)) byDate.set(cls.date, [])
    byDate.get(cls.date)!.push(cls)
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, items]) => ({
      date,
      weekday: weekdayOf(date),
      label: formatDayLabel(date),
      shortLabel: formatShortDay(date),
      classes: items.sort((a, b) => a.start_time.localeCompare(b.start_time)),
    }))
}

export function formatInstructors(cls: ClassOccurrence): string {
  if (cls.instructor_status === 'tba' || cls.instructors.length === 0) {
    return 'Instructor TBA'
  }
  return cls.instructors.join(' & ')
}
