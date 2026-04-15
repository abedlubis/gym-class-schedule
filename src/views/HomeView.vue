<script setup lang="ts">
import { ref } from 'vue'
import scheduleData from '@/data/schedule.json'
import type { ScheduleDataset, ActiveFilters } from '@/types/schedule'
import { useScheduleFilters } from '@/composables/useScheduleFilters'
import ScheduleHeader from '@/components/schedule/ScheduleHeader.vue'
import FilterSidebar from '@/components/schedule/FilterSidebar.vue'
import FilterDrawer from '@/components/schedule/FilterDrawer.vue'
import ScheduleTimeline from '@/components/schedule/ScheduleTimeline.vue'
import ActiveFilterChips from '@/components/schedule/ActiveFilterChips.vue'

const dataset = scheduleData as ScheduleDataset

const {
  filters,
  groupedByDay,
  resultCount,
  hasActiveFilters,
  filterOptions,
  resetFilters,
  toggleArrayFilter,
} = useScheduleFilters(dataset)

const drawerOpen = ref(false)

function setTimeRange(range: ActiveFilters['timeRange']) {
  filters.timeRange = range
}

function toggleLesMills() {
  filters.lesMillsOnly = !filters.lesMillsOnly
}

function removeFilter(key: keyof ActiveFilters, value?: string) {
  if (key === 'timeRange') {
    filters.timeRange = 'all'
  } else if (key === 'lesMillsOnly') {
    filters.lesMillsOnly = false
  } else if (value !== undefined && Array.isArray(filters[key])) {
    toggleArrayFilter(key as 'locations' | 'categories' | 'instructors' | 'tags' | 'dayKeys', value)
  }
}
</script>

<template>
  <div class="min-h-screen bg-[#09030F] px-4 py-8 sm:px-6 lg:px-8">
    <div class="mx-auto max-w-6xl">
      <ScheduleHeader
        :result-count="resultCount"
        :filters="filters"
        @set-time-range="setTimeRange"
        @toggle-les-mills="toggleLesMills"
        @open-drawer="drawerOpen = true"
      />

      <ActiveFilterChips
        :filters="filters"
        :has-active-filters="hasActiveFilters"
        @remove="removeFilter"
        @clear="resetFilters"
      />

      <div class="flex gap-10">
        <!-- Sidebar (desktop only) -->
        <FilterSidebar
          class="hidden lg:flex"
          :filters="filters"
          :filter-options="filterOptions"
          :has-active-filters="hasActiveFilters"
          @toggle-array="toggleArrayFilter"
          @set-time-range="setTimeRange"
          @toggle-les-mills="toggleLesMills"
          @reset="resetFilters"
        />

        <!-- Timeline -->
        <ScheduleTimeline
          :groups="groupedByDay"
          @clear-filters="resetFilters"
        />
      </div>
    </div>

    <!-- Mobile filter drawer -->
    <FilterDrawer
      :open="drawerOpen"
      :filters="filters"
      :filter-options="filterOptions"
      :has-active-filters="hasActiveFilters"
      :result-count="resultCount"
      @close="drawerOpen = false"
      @toggle-array="toggleArrayFilter"
      @set-time-range="setTimeRange"
      @toggle-les-mills="toggleLesMills"
      @reset="resetFilters"
    />
  </div>
</template>
