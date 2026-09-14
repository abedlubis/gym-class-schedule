import { computed, reactive, toValue, type MaybeRefOrGetter } from 'vue'
import type {
  ActiveFilters,
  ClassOccurrence,
  DayGroup,
} from '@/types/schedule'
import { buildSearchBlob, groupClassesByDay, matchesTimeRange } from '@/utils/schedule'

export type ArrayFilterKey = 'families' | 'categories' | 'instructors' | 'programmes'

export function createEmptyFilters(): ActiveFilters {
  return {
    search: '',
    families: [],
    categories: [],
    instructors: [],
    programmes: [],
    weekdays: [],
    timeRange: 'all',
  }
}

/**
 * Takes a getter, not a plain value.
 *
 * The v1 version accepted a plain object, which meant the search index was
 * computed once at setup and never recomputed. That was harmless while the data
 * was a build-time JSON import and silently broken the moment it became a
 * fetch. `toValue` makes the index track whatever source is passed in.
 */
export function useScheduleFilters(source: MaybeRefOrGetter<ClassOccurrence[]>) {
  const filters = reactive<ActiveFilters>(createEmptyFilters())

  const searchIndex = computed(() =>
    toValue(source).map((cls) => ({ cls, blob: buildSearchBlob(cls) })),
  )

  const filteredClasses = computed((): ClassOccurrence[] => {
    let results = searchIndex.value

    const q = filters.search.trim().toLowerCase()
    if (q) results = results.filter(({ blob }) => blob.includes(q))

    if (filters.families.length) {
      const set = new Set(filters.families)
      results = results.filter(({ cls }) => cls.family !== null && set.has(cls.family))
    }

    if (filters.categories.length) {
      const set = new Set(filters.categories)
      results = results.filter(({ cls }) => set.has(cls.category.slug))
    }

    if (filters.instructors.length) {
      const set = new Set(filters.instructors)
      results = results.filter(({ cls }) => cls.instructors.some((i) => set.has(i)))
    }

    if (filters.programmes.length) {
      const set = new Set(filters.programmes)
      results = results.filter(({ cls }) => cls.programme !== null && set.has(cls.programme))
    }

    if (filters.weekdays.length) {
      const set = new Set(filters.weekdays)
      results = results.filter(({ cls }) =>
        set.has(new Date(`${cls.date}T00:00:00Z`).getUTCDay()),
      )
    }

    if (filters.timeRange !== 'all') {
      results = results.filter(({ cls }) =>
        matchesTimeRange(cls.start_time, filters.timeRange),
      )
    }

    return results.map(({ cls }) => cls)
  })

  const groupedByDay = computed((): DayGroup[] => groupClassesByDay(filteredClasses.value))
  const resultCount = computed(() => filteredClasses.value.length)

  const hasActiveFilters = computed(
    () =>
      filters.search.trim() !== '' ||
      filters.families.length > 0 ||
      filters.categories.length > 0 ||
      filters.instructors.length > 0 ||
      filters.programmes.length > 0 ||
      filters.weekdays.length > 0 ||
      filters.timeRange !== 'all',
  )

  function resetFilters() {
    Object.assign(filters, createEmptyFilters())
  }

  function toggleArrayFilter(key: ArrayFilterKey, value: string) {
    const arr = filters[key]
    const idx = arr.indexOf(value)
    if (idx === -1) arr.push(value)
    else arr.splice(idx, 1)
  }

  function toggleWeekday(weekday: number) {
    const idx = filters.weekdays.indexOf(weekday)
    if (idx === -1) filters.weekdays.push(weekday)
    else filters.weekdays.splice(idx, 1)
  }

  return {
    filters,
    filteredClasses,
    groupedByDay,
    resultCount,
    hasActiveFilters,
    resetFilters,
    toggleArrayFilter,
    toggleWeekday,
  }
}
