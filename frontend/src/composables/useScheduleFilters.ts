import { computed, reactive, toValue, type MaybeRefOrGetter } from 'vue'
import type { ActiveFilters, ClassOccurrence } from '@/types/schedule'
import { buildSearchBlob, matchesTimeRange } from '@/utils/schedule'

export type ArrayFilterKey = 'families' | 'categories' | 'instructors' | 'programmes'

export function createEmptyFilters(): ActiveFilters {
  return {
    search: '',
    families: [],
    categories: [],
    instructors: [],
    programmes: [],
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
export type IndexedClass = { cls: ClassOccurrence; blob: string }

export function indexClasses(classes: ClassOccurrence[]): IndexedClass[] {
  return classes.map((cls) => ({ cls, blob: buildSearchBlob(cls) }))
}

/**
 * Pure and exported so the day-strip counts can run the same filters over the
 * whole week without standing up a second reactive composable.
 */
export function applyFilters(
  indexed: IndexedClass[],
  filters: ActiveFilters,
): ClassOccurrence[] {
  let results = indexed

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

  if (filters.timeRange !== 'all') {
    results = results.filter(({ cls }) => matchesTimeRange(cls.start_time, filters.timeRange))
  }

  return results.map(({ cls }) => cls)
}

export function useScheduleFilters(source: MaybeRefOrGetter<ClassOccurrence[]>) {
  const filters = reactive<ActiveFilters>(createEmptyFilters())

  const searchIndex = computed(() => indexClasses(toValue(source)))

  const filteredClasses = computed((): ClassOccurrence[] =>
    applyFilters(searchIndex.value, filters),
  )


  const resultCount = computed(() => filteredClasses.value.length)

  const hasActiveFilters = computed(
    () =>
      filters.search.trim() !== '' ||
      filters.families.length > 0 ||
      filters.categories.length > 0 ||
      filters.instructors.length > 0 ||
      filters.programmes.length > 0 ||
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

  return {
    filters,
    filteredClasses,
    resultCount,
    hasActiveFilters,
    resetFilters,
    toggleArrayFilter,
  }
}
