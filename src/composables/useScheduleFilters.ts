import { reactive, computed } from 'vue'
import type { ScheduleDataset, ScheduleClass, ActiveFilters, DayGroup } from '@/types/schedule'
import { buildSearchBlob, matchesTimeRange, groupClassesByDay, getWeekdayKey } from '@/utils/schedule'

export function useScheduleFilters(dataset: ScheduleDataset) {
  const filters = reactive<ActiveFilters>({
    search: '',
    locations: [],
    categories: [],
    instructors: [],
    tags: [],
    dayKeys: [],
    timeRange: 'all',
    lesMillsOnly: false,
  })

  // Build search index once — recomputed only if dataset changes
  const searchIndex = computed(() =>
    dataset.classes.map((cls) => ({
      cls,
      blob: buildSearchBlob(cls),
      weekday: getWeekdayKey(cls.datetime),
    }))
  )

  const filteredClasses = computed((): ScheduleClass[] => {
    let results = searchIndex.value

    if (filters.search.trim()) {
      const q = filters.search.trim().toLowerCase()
      results = results.filter(({ blob }) => blob.includes(q))
    }

    if (filters.locations.length) {
      const set = new Set(filters.locations)
      results = results.filter(({ cls }) => set.has(cls.location))
    }

    if (filters.categories.length) {
      const set = new Set(filters.categories)
      results = results.filter(({ cls }) => set.has(cls.category))
    }

    if (filters.instructors.length) {
      const set = new Set(filters.instructors)
      results = results.filter(({ cls }) => cls.instructor.some((i) => set.has(i)))
    }

    if (filters.tags.length) {
      const set = new Set(filters.tags)
      results = results.filter(({ cls }) => cls.tags.some((t) => set.has(t)))
    }

    if (filters.dayKeys.length) {
      const set = new Set(filters.dayKeys)
      results = results.filter(({ weekday }) => set.has(weekday))
    }

    if (filters.timeRange !== 'all') {
      results = results.filter(({ cls }) => matchesTimeRange(cls.datetime, filters.timeRange))
    }

    if (filters.lesMillsOnly) {
      results = results.filter(({ cls }) => cls.tags.includes('LesMills'))
    }

    return results
      .map(({ cls }) => cls)
      .sort((a, b) => a.datetime.localeCompare(b.datetime))
  })

  const groupedByDay = computed((): DayGroup[] => groupClassesByDay(filteredClasses.value))

  const resultCount = computed(() => filteredClasses.value.length)

  const hasActiveFilters = computed(
    () =>
      filters.search.trim() !== '' ||
      filters.locations.length > 0 ||
      filters.categories.length > 0 ||
      filters.instructors.length > 0 ||
      filters.tags.length > 0 ||
      filters.dayKeys.length > 0 ||
      filters.timeRange !== 'all' ||
      filters.lesMillsOnly,
  )

  function resetFilters() {
    filters.search = ''
    filters.locations = []
    filters.categories = []
    filters.instructors = []
    filters.tags = []
    filters.dayKeys = []
    filters.timeRange = 'all'
    filters.lesMillsOnly = false
  }

  function toggleArrayFilter(
    key: 'locations' | 'categories' | 'instructors' | 'tags' | 'dayKeys',
    value: string,
  ) {
    const arr = filters[key]
    const idx = arr.indexOf(value)
    if (idx === -1) arr.push(value)
    else arr.splice(idx, 1)
  }

  return {
    filters,
    filteredClasses,
    groupedByDay,
    resultCount,
    hasActiveFilters,
    filterOptions: dataset.filters,
    resetFilters,
    toggleArrayFilter,
  }
}
