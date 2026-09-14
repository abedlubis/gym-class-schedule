/**
 * Week arithmetic, done on calendar dates rather than instants.
 *
 * Slots are stored as a weekday plus a local wall-clock time, so materialising
 * a week is pure date arithmetic — no UTC conversion anywhere. The only place a
 * timezone matters is deciding which week "now" falls in, because a club in
 * Denpasar (WITA) can be a day ahead of the server.
 */

export type IsoDate = string // YYYY-MM-DD

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function isIsoDate(value: string): value is IsoDate {
  return DATE_RE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
}

/** Today's calendar date in the given IANA timezone. */
export function todayIn(timezone: string, now: Date = new Date()): IsoDate {
  // en-CA formats as YYYY-MM-DD, which is what we want and is stable.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/** 0 = Sunday … 6 = Saturday, matching JS getDay() and our weekday column. */
export function weekdayOf(date: IsoDate): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay()
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * The Monday of the ISO week containing `date`.
 *
 * Monday, not Sunday: the original dataset sorted by raw date and produced a
 * Wed→Tue timeline, which is the bug this fixes. Members think in Mon–Sun.
 */
export function weekStartOf(date: IsoDate): IsoDate {
  const dow = weekdayOf(date) // 0=Sun
  const offset = dow === 0 ? -6 : 1 - dow
  return addDays(date, offset)
}

export function currentWeekStart(timezone: string, now?: Date): IsoDate {
  return weekStartOf(todayIn(timezone, now))
}

/** The seven dates of the week beginning at `weekStart`, Monday first. */
export function weekDates(weekStart: IsoDate): IsoDate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}

/** "07:00:00" (Postgres time) or "07:00" → "07:00". */
export function hhmm(time: string): string {
  return time.slice(0, 5)
}

export function addMinutes(time: string, minutes: number): string {
  const [h = 0, m = 0] = hhmm(time).split(':').map(Number)
  const total = h * 60 + m + minutes
  const hh = Math.floor(total / 60) % 24
  const mm = total % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

/**
 * Whether a slot is in force on a given date.
 *
 * A slot with no effective_from is treated as always in force — several clubs
 * publish timetables with no date printed on them at all.
 */
export function isEffectiveOn(
  date: IsoDate,
  effectiveFrom: string | null,
  effectiveTo: string | null,
): boolean {
  if (effectiveFrom && date < effectiveFrom) return false
  if (effectiveTo && date > effectiveTo) return false
  return true
}
