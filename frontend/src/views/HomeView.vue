<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchClubs, fetchFilters, fetchSchedule } from '@/api/schedule'
import { ApiError } from '@/api/client'
import type {
  ClassOccurrence,
  Club,
  FilterOptions,
  ScheduleResult,
  TimeRange,
} from '@/types/schedule'
import { useScheduleFilters, type ArrayFilterKey } from '@/composables/useScheduleFilters'
import { useUrlFilters } from '@/composables/useUrlFilters'
import AppShell from '@/components/app/AppShell.vue'
import DayStrip from '@/components/schedule/DayStrip.vue'
import FilterPanel from '@/components/schedule/FilterPanel.vue'
import FilterDrawer from '@/components/schedule/FilterDrawer.vue'
import ScheduleTimeline from '@/components/schedule/ScheduleTimeline.vue'
import ActiveFilterChips from '@/components/schedule/ActiveFilterChips.vue'
import ClassDetail from '@/components/schedule/ClassDetail.vue'

const route = useRoute()
const router = useRouter()

const clubs = ref<Club[]>([])
const options = ref<FilterOptions | null>(null)
const schedule = ref<ScheduleResult | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const drawerOpen = ref(false)
const selectedDate = ref<string | null>(null)
const detail = ref<ClassOccurrence | null>(null)

const selectedClub = computed(() => (route.query.club as string) ?? '')
const week = computed(() => (route.query.week as string) ?? '')
const classes = computed(() => schedule.value?.classes ?? [])

const {
  filters,
  filteredClasses,
  groupedByDay,
  resultCount,
  hasActiveFilters,
  resetFilters,
  toggleArrayFilter,
  toggleWeekday,
} = useScheduleFilters(classes)

useUrlFilters(filters, { club: selectedClub.value, week: week.value })

const weekDates = computed(() => {
  const start = schedule.value?.meta.week_start
  if (!start) return []
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${start}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + i)
    return d.toISOString().slice(0, 10)
  })
})

const countsByDate = computed(() => {
  const out: Record<string, number> = {}
  for (const c of filteredClasses.value) out[c.date] = (out[c.date] ?? 0) + 1
  return out
})

/**
 * Mobile shows one selected day; desktop scrolls the whole week with the day
 * strip acting as an anchor. There is room for a week on a large screen, and
 * scanning one is the thing a desktop visitor came for.
 */
const visibleGroups = computed(() =>
  selectedDate.value
    ? groupedByDay.value.filter((g) => g.date === selectedDate.value)
    : groupedByDay.value,
)

const alsoThisWeek = computed(() => {
  const cls = detail.value
  if (!cls) return []
  return classes.value.filter(
    (c) => c.class_name === cls.class_name && c.club.slug === cls.club.slug && c.id !== cls.id,
  )
})

const detailClub = computed(
  () => clubs.value.find((c) => c.slug === detail.value?.club.slug) ?? null,
)

let inFlight: AbortController | null = null

async function load() {
  inFlight?.abort()
  const ctrl = new AbortController()
  inFlight = ctrl
  loading.value = true
  error.value = null
  try {
    const [s, f] = await Promise.all([
      fetchSchedule(
        { club: selectedClub.value || undefined, week: week.value || undefined },
        ctrl.signal,
      ),
      fetchFilters(selectedClub.value || undefined, ctrl.signal),
    ])
    schedule.value = s
    options.value = f
  } catch (err) {
    if ((err as Error).name === 'AbortError') return
    error.value =
      err instanceof ApiError ? err.message : 'The schedule did not load. Try again.'
  } finally {
    if (inFlight === ctrl) loading.value = false
  }
}

fetchClubs()
  .then((c) => (clubs.value = c))
  .catch(() => {})

watch([selectedClub, week], load, { immediate: true })

function selectClub(slug: string) {
  selectedDate.value = null
  router.replace({ query: { ...route.query, club: slug || undefined, week: undefined } })
}

function shiftWeek(delta: number) {
  const base = schedule.value?.meta.week_start
  if (!base) return
  const d = new Date(`${base}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + delta * 7)
  selectedDate.value = null
  router.replace({ query: { ...route.query, week: d.toISOString().slice(0, 10) } })
}

const setTimeRange = (r: TimeRange) => (filters.timeRange = r)
const removeArray = (k: ArrayFilterKey, v: string) => toggleArrayFilter(k, v)
</script>

<template>
  <AppShell>
    <template #header-actions>
      <div class="ml-auto flex items-center gap-2 lg:ml-4">
        <select
          :value="selectedClub"
          aria-label="Club"
          class="max-w-[46vw] truncate rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] font-medium text-ink focus:border-primary focus:outline-none lg:max-w-none"
          @change="selectClub(($event.target as HTMLSelectElement).value)"
        >
          <option value="">All studios</option>
          <option v-for="c in clubs" :key="c.slug" :value="c.slug">{{ c.name }}</option>
        </select>

        <button
          class="relative rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] font-medium text-ink lg:hidden"
          @click="drawerOpen = true"
        >
          Filters
          <span
            v-if="hasActiveFilters"
            class="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary"
          />
        </button>
      </div>
    </template>

    <template #header-extra>
      <div class="mx-auto max-w-6xl px-4 pb-3 lg:px-8">
        <div class="flex items-center justify-between pb-2">
          <button
            class="rounded-lg px-1.5 py-1 text-[18px] leading-none text-ink-muted hover:text-ink"
            aria-label="Previous week"
            @click="shiftWeek(-1)"
          >
            ‹
          </button>
          <p class="tnum text-[13px] font-medium text-ink-muted" aria-live="polite">
            {{ resultCount }} {{ resultCount === 1 ? 'class' : 'classes' }}
          </p>
          <button
            class="rounded-lg px-1.5 py-1 text-[18px] leading-none text-ink-muted hover:text-ink"
            aria-label="Next week"
            @click="shiftWeek(1)"
          >
            ›
          </button>
        </div>
        <DayStrip
          :dates="weekDates"
          :selected="selectedDate"
          :counts="countsByDate"
          @select="selectedDate = $event"
        />
      </div>
    </template>

    <p
      v-if="schedule?.meta.club?.schedule_stale"
      class="mb-4 rounded-xl border border-[#E0B25C] bg-[#FDF4E3] px-3.5 py-2.5 text-[13px] text-[#7A4A00]"
    >
      This studio has not published a new timetable in a while. Check their
      Instagram before travelling.
    </p>

    <p
      v-if="schedule?.meta.club?.data_gap_note"
      class="mb-4 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[13px] text-ink-muted"
    >
      {{ schedule.meta.club.data_gap_note }}
    </p>

    <ActiveFilterChips
      :filters="filters"
      :has-active-filters="hasActiveFilters"
      @remove-array="removeArray"
      @remove-weekday="toggleWeekday"
      @clear-search="filters.search = ''"
      @clear-time-range="filters.timeRange = 'all'"
      @clear="resetFilters"
    />

    <div
      v-if="error"
      class="rounded-[--radius-card] border border-[#E2B4B4] bg-[#FBEDED] px-4 py-6 text-center"
    >
      <p class="text-[14px] text-[#8A2C2C]">{{ error }}</p>
      <button
        class="mt-3 rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-white"
        @click="load()"
      >
        Try again
      </button>
    </div>

    <div v-else class="flex gap-10">
      <aside class="hidden w-60 shrink-0 lg:block">
        <FilterPanel
          v-model:search="filters.search"
          :filters="filters"
          :options="options"
          :has-active-filters="hasActiveFilters"
          @toggle-array="toggleArrayFilter"
          @toggle-weekday="toggleWeekday"
          @set-time-range="setTimeRange"
          @reset="resetFilters"
        />
      </aside>

      <ScheduleTimeline
        :groups="visibleGroups"
        :loading="loading"
        :show-club="!selectedClub"
        @clear-filters="resetFilters"
        @open="detail = $event"
      />
    </div>

    <FilterDrawer
      v-model:search="filters.search"
      :open="drawerOpen"
      :filters="filters"
      :options="options"
      :has-active-filters="hasActiveFilters"
      :result-count="resultCount"
      @close="drawerOpen = false"
      @toggle-array="toggleArrayFilter"
      @toggle-weekday="toggleWeekday"
      @set-time-range="setTimeRange"
      @reset="resetFilters"
    />

    <ClassDetail
      :cls="detail"
      :club="detailClub"
      :also-this-week="alsoThisWeek"
      @close="detail = null"
      @open="detail = $event"
    />
  </AppShell>
</template>
