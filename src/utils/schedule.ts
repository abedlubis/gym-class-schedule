import type { ScheduleClass, DayGroup, TimeRange } from '@/types/schedule'

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

export function getTimeFromISO(iso: string): string {
  const match = iso.match(/T(\d{2}:\d{2})/)
  return match?.[1] ?? ''
}

export function getDateFromISO(iso: string): string {
  return iso.slice(0, 10)
}

export function getHourFromISO(iso: string): number {
  const match = iso.match(/T(\d{2})/)
  return match ? parseInt(match[1]!, 10) : 0
}

export function getWeekdayKey(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number) as [number, number, number]
  return WEEKDAYS[new Date(year, month - 1, day).getDay()]!
}

export function formatDayLabel(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number) as [number, number, number]
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

export function formatDayShort(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number) as [number, number, number]
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
  })
}

export function matchesTimeRange(iso: string, range: TimeRange): boolean {
  const hour = getHourFromISO(iso)
  switch (range) {
    case 'morning': return hour < 12
    case 'afternoon': return hour >= 12 && hour < 18
    case 'evening':
    case 'after_work': return hour >= 18
    default: return true
  }
}

export function buildSearchBlob(cls: ScheduleClass): string {
  return [
    cls.class_name,
    cls.location,
    cls.category,
    getWeekdayKey(cls.datetime),
    ...cls.instructor,
    ...cls.tags,
  ].join(' ').toLowerCase()
}

export function groupClassesByDay(classes: ScheduleClass[]): DayGroup[] {
  const map = new Map<string, ScheduleClass[]>()
  for (const cls of classes) {
    const key = getDateFromISO(cls.datetime)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(cls)
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, dayClasses]) => ({
      key,
      label: formatDayLabel(dayClasses[0]!.datetime),
      shortLabel: formatDayShort(dayClasses[0]!.datetime),
      classes: dayClasses,
    }))
}

export const CATEGORY_COLOR: Record<string, { text: string; bg: string }> = {
  yoga:           { text: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
  dance:          { text: '#f472b6', bg: 'rgba(244,114,182,0.12)' },
  strength:       { text: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  hiit:           { text: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  'martial-cardio': { text: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  pilates:        { text: '#22d3ee', bg: 'rgba(34,211,238,0.12)' },
  cycling:        { text: '#fb923c', bg: 'rgba(251,146,60,0.12)' },
  cardio:         { text: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  hybrid:         { text: '#818cf8', bg: 'rgba(129,140,248,0.12)' },
}

export const WEEKDAY_OPTIONS = [
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday', label: 'Thu' },
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' },
  { key: 'sunday', label: 'Sun' },
]
