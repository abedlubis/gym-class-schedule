<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Select from 'primevue/select'
import Skeleton from 'primevue/skeleton'
import { fetchClubs, fetchFilters, fetchSchedule } from '@/api/schedule'
import { ApiError } from '@/api/client'
import type {
  ClassOccurrence,
  Club,
  FilterOptions,
  ScheduleResult,
  TimeRange,
} from '@/types/schedule'
import {
  applyFilters,
  indexClasses,
  useScheduleFilters,
  type ArrayFilterKey,
} from '@/composables/useScheduleFilters'
import { useUrlFilters } from '@/composables/useUrlFilters'
import { formatDayLabel, relativeDayLabel, todayIn } from '@/utils/schedule'
import AppShell from '@/components/app/AppShell.vue'
import DayStrip from '@/components/schedule/DayStrip.vue'
import FilterPanel from '@/components/schedule/FilterPanel.vue'
import FilterDrawer from '@/components/schedule/FilterDrawer.vue'
import ScheduleTimeline from '@/components/schedule/ScheduleTimeline.vue'
import TimeRowList from '@/components/schedule/TimeRowList.vue'
import ActiveFilterChips from '@/components/schedule/ActiveFilterChips.vue'
const ClassDetail = defineAsyncComponent(
  () => import('@/components/schedule/ClassDetail.vue'),
)

const route = useRoute()
const router = useRouter()

const clubs = ref<Club[]>([])
const clubsLoading = ref(true)
const options = ref<FilterOptions | null>(null)
const schedule = ref<ScheduleResult | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const drawerOpen = ref(false)
const detail = ref<ClassOccurrence | null>(null)

const selectedClub = computed(() => (route.query.club as string) ?? '')
const timezone = computed(() => schedule.value?.meta.timezone ?? 'Asia/Jakarta')

/**
 * The page always opens on today.
 *
 * There is no "all days" view. A week of every studio at once is not something
 * anyone can read, and the question a member actually asks — standing in a
 * lobby, deciding whether to train — is "what is on now".
 */
const selectedDate = ref<string>((route.query.date as string) ?? todayIn())

const classes = computed(() => schedule.value?.classes ?? [])
const dayClasses = computed(() => classes.value.filter((c) => c.date === selectedDate.value))

const {
  filters,
  filteredClasses,
  resultCount,
  hasActiveFilters,
  resetFilters,
  toggleArrayFilter,
} = useScheduleFilters(dayClasses)

const weekIndex = computed(() => indexClasses(classes.value))
const allFilteredThisWeek = computed(() => applyFilters(weekIndex.value, filters))

useUrlFilters(filters, { club: selectedClub.value })

const weekDates = computed(() => {
  const start = schedule.value?.meta.week_start
  if (!start) return []
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${start}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + i)
    return d.toISOString().slice(0, 10)
  })
})

/**
 * Day-strip counts apply the same filters as the list, across every day of the
 * week — so the number on a day matches what tapping it actually shows.
 */
const countsByDate = computed(() => {
  const out: Record<string, number> = {}
  for (const c of allFilteredThisWeek.value) out[c.date] = (out[c.date] ?? 0) + 1
  return out
})

const clubOptions = computed(() => [
  { label: 'All studios', value: '' },
  ...clubs.value.map((c) => ({ label: c.name, value: c.slug })),
])

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
      fetchSchedule({ club: selectedClub.value || undefined, week: selectedDate.value }, ctrl.signal),
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
  .finally(() => (clubsLoading.value = false))

// Refetch only when the club changes or the chosen day falls outside the loaded
// week. Moving between days inside a week is instant — no network round trip,
// because the API already returned all seven days.
watch(
  [selectedClub, selectedDate],
  ([club, date], previous) => {
    const clubChanged = !previous || previous[0] !== club
    if (clubChanged || !weekDates.value.includes(date)) load()
  },
  { immediate: true },
)

function selectClub(slug: string) {
  router.replace({ query: { ...route.query, club: slug || undefined } })
}

// The chosen day lives in the URL too, so a shared link opens on the same day
// rather than snapping back to today.
watch(selectedDate, (date) => {
  const isToday = date === todayIn(timezone.value)
  router.replace({ query: { ...route.query, date: isToday ? undefined : date } })
})

function shiftWeek(delta: number) {
  const d = new Date(`${selectedDate.value}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + delta * 7)
  selectedDate.value = d.toISOString().slice(0, 10)
}

function jumpToToday() {
  selectedDate.value = todayIn(timezone.value)
}

const isOnToday = computed(() => selectedDate.value === todayIn(timezone.value))
const setTimeRange = (r: TimeRange) => (filters.timeRange = r)
const removeArray = (k: ArrayFilterKey, v: string) => toggleArrayFilter(k, v)
</script>

<template>
  <AppShell>
    <template #header-actions>
      <div class="ml-auto flex items-center gap-2 lg:ml-4">
        <Skeleton v-if="clubsLoading" class="h-9 w-36" />
        <Select
          v-else
          :model-value="selectedClub"
          :options="clubOptions"
          option-label="label"
          option-value="value"
          filter
          filter-placeholder="Search studios"
          aria-label="Studio"
          class="max-w-[46vw] lg:max-w-none"
          @update:model-value="selectClub"
        />

        <button
          class="relative cursor-pointer rounded-lg border border-line bg-surface px-3 py-2 text-[13px] font-medium text-ink lg:hidden"
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
            class="cursor-pointer rounded-lg px-1.5 py-1 text-[18px] leading-none text-ink-muted hover:text-ink"
            aria-label="Previous week"
            @click="shiftWeek(-1)"
          >
            ‹
          </button>

          <button
            v-if="!isOnToday"
            class="cursor-pointer rounded-full bg-primary/10 px-3 py-1 text-[12px] font-semibold text-primary"
            @click="jumpToToday"
          >
            Back to today
          </button>
          <p v-else class="text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
            Today
          </p>

          <button
            class="cursor-pointer rounded-lg px-1.5 py-1 text-[18px] leading-none text-ink-muted hover:text-ink"
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
          :timezone="timezone"
          @select="selectedDate = $event"
        />
      </div>
    </template>

    <div class="flex items-baseline justify-between">
      <h1 class="font-display text-[20px] font-bold text-ink">
        {{ relativeDayLabel(selectedDate, timezone) }}
        <span class="font-sans text-[14px] font-normal text-ink-muted">
          {{ formatDayLabel(selectedDate) }}
        </span>
      </h1>
      <p class="tnum shrink-0 text-[13px] text-ink-muted" aria-live="polite">
        {{ loading ? '…' : `${resultCount} ${resultCount === 1 ? 'class' : 'classes'}` }}
      </p>
    </div>

    <p
      v-if="schedule?.meta.club?.schedule_stale"
      class="mt-3 rounded-xl border border-[#E0B25C] bg-[#FDF4E3] px-3.5 py-2.5 text-[13px] text-[#7A4A00]"
    >
      This studio has not published a new timetable in a while. Check their
      Instagram before travelling.
    </p>

    <p
      v-if="schedule?.meta.club?.data_gap_note"
      class="mt-3 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[13px] text-ink-muted"
    >
      {{ schedule.meta.club.data_gap_note }}
    </p>

    <ActiveFilterChips
      class="mt-3"
      :filters="filters"
      :has-active-filters="hasActiveFilters"
      @remove-array="removeArray"
      @clear-search="filters.search = ''"
      @clear-time-range="filters.timeRange = 'all'"
      @clear="resetFilters"
    />

    <div
      v-if="error"
      class="mt-4 rounded-[--radius-card] border border-[#E2B4B4] bg-[#FBEDED] px-4 py-6 text-center"
    >
      <p class="text-[14px] text-[#8A2C2C]">{{ error }}</p>
      <button
        class="mt-3 cursor-pointer rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-white"
        @click="load()"
      >
        Try again
      </button>
    </div>

    <div v-else class="mt-4 flex gap-10">
      <aside class="hidden w-60 shrink-0 lg:block">
        <FilterPanel
          v-model:search="filters.search"
          :filters="filters"
          :options="options"
          :has-active-filters="hasActiveFilters"
          @toggle-array="toggleArrayFilter"
          @set-time-range="setTimeRange"
          @reset="resetFilters"
        />
      </aside>

      <div class="min-w-0 flex-1">
        <!--
          Two shapes for two questions. With a studio chosen the list is
          detailed — instructor and duration matter. Across all studios the only
          readable form is one row per time with every branch on it.
        -->
        <ScheduleTimeline
          v-if="selectedClub"
          :classes="filteredClasses"
          :loading="loading"
          @clear-filters="resetFilters"
          @open="detail = $event"
        />
        <TimeRowList
          v-else
          :classes="filteredClasses"
          :loading="loading"
          @clear-filters="resetFilters"
          @open="detail = $event"
        />
      </div>
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
