import { describe, expect, it } from 'vitest'
import {
  addMinutes,
  currentWeekStart,
  isEffectiveOn,
  todayIn,
  weekDates,
  weekStartOf,
  weekdayOf,
} from '../src/lib/week.js'

describe('week arithmetic', () => {
  it('starts weeks on Monday', () => {
    expect(weekStartOf('2026-09-13')).toBe('2026-09-07') // a Sunday
    expect(weekStartOf('2026-09-07')).toBe('2026-09-07') // the Monday itself
    expect(weekStartOf('2026-09-12')).toBe('2026-09-07') // a Saturday
  })

  it('returns seven consecutive dates, Monday first', () => {
    const dates = weekDates('2026-09-07')
    expect(dates).toHaveLength(7)
    expect(dates[0]).toBe('2026-09-07')
    expect(dates[6]).toBe('2026-09-13')
    expect(weekdayOf(dates[0]!)).toBe(1) // Monday
    expect(weekdayOf(dates[6]!)).toBe(0) // Sunday
  })

  it('crosses month and year boundaries', () => {
    expect(weekDates('2026-12-28')[6]).toBe('2027-01-03')
    expect(weekStartOf('2027-01-01')).toBe('2026-12-28')
  })

  it('reads today in the club timezone, not the server timezone', () => {
    // 23:30 UTC on the 12th is already the 13th in Jakarta (+07) and Bali (+08).
    const late = new Date('2026-09-12T23:30:00Z')
    expect(todayIn('UTC', late)).toBe('2026-09-12')
    expect(todayIn('Asia/Jakarta', late)).toBe('2026-09-13')
    expect(todayIn('Asia/Makassar', late)).toBe('2026-09-13')
  })

  it('puts a Bali club in the right week when the server is a day behind', () => {
    const late = new Date('2026-09-13T23:30:00Z') // Sunday UTC, Monday in WITA
    expect(currentWeekStart('UTC', late)).toBe('2026-09-07')
    expect(currentWeekStart('Asia/Makassar', late)).toBe('2026-09-14')
  })

  it('adds minutes without rolling into nonsense', () => {
    expect(addMinutes('07:00', 60)).toBe('08:00')
    expect(addMinutes('19:35', 45)).toBe('20:20')
    expect(addMinutes('23:30', 60)).toBe('00:30')
    expect(addMinutes('07:00:00', 30)).toBe('07:30')
  })

  it('treats a slot with no effective_from as always in force', () => {
    expect(isEffectiveOn('2026-01-01', null, null)).toBe(true)
    expect(isEffectiveOn('2026-08-31', '2026-09-01', null)).toBe(false)
    expect(isEffectiveOn('2026-09-01', '2026-09-01', null)).toBe(true)
    expect(isEffectiveOn('2026-09-30', '2026-09-01', '2026-09-15')).toBe(false)
  })
})
