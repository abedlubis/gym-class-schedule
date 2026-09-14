import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { ActiveFilters, TimeRange } from '@/types/schedule'

const LIST_KEYS = ['families', 'categories', 'instructors', 'programmes'] as const
const TIME_RANGES: TimeRange[] = ['all', 'morning', 'afternoon', 'evening']

function asArray(value: unknown): string[] {
  if (typeof value === 'string' && value) return value.split(',').filter(Boolean)
  return []
}

/**
 * Keeps filter state in the query string.
 *
 * Worth the ~60 lines: it makes a filtered view shareable and survives a
 * refresh, which for a schedule people check on a phone is the difference
 * between "send me the link" and "open the app and redo my filters".
 */
export function useUrlFilters(filters: ActiveFilters, extra: { club?: string; week?: string }) {
  const route = useRoute()
  const router = useRouter()
  let applying = false

  function readFromUrl() {
    applying = true
    const q = route.query
    filters.search = typeof q.q === 'string' ? q.q : ''
    for (const key of LIST_KEYS) filters[key] = asArray(q[key])
    filters.weekdays = asArray(q.days)
      .map(Number)
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    filters.timeRange = TIME_RANGES.includes(q.time as TimeRange)
      ? (q.time as TimeRange)
      : 'all'
    applying = false
  }

  function writeToUrl() {
    if (applying) return
    const query: Record<string, string> = {}
    if (filters.search.trim()) query.q = filters.search.trim()
    for (const key of LIST_KEYS) {
      if (filters[key].length) query[key] = filters[key].join(',')
    }
    if (filters.weekdays.length) query.days = [...filters.weekdays].sort().join(',')
    if (filters.timeRange !== 'all') query.time = filters.timeRange
    if (extra.club) query.club = extra.club
    if (extra.week) query.week = extra.week

    const current = JSON.stringify(route.query)
    if (JSON.stringify(query) !== current) {
      router.replace({ query }).catch(() => {})
    }
  }

  readFromUrl()
  watch(() => JSON.stringify(filters), writeToUrl, { flush: 'post' })
  watch(() => route.query.club, readFromUrl)

  return { readFromUrl, writeToUrl }
}
