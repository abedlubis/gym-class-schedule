<script setup lang="ts">
import type { ActiveFilters } from '@/types/schedule'

const props = defineProps<{
  resultCount: number
  filters: ActiveFilters
}>()

const emit = defineEmits<{
  setTimeRange: [range: ActiveFilters['timeRange']]
  toggleLesMills: []
  openDrawer: []
}>()

function resetToAll() {
  emit('setTimeRange', 'all')
  if (props.filters.lesMillsOnly) emit('toggleLesMills')
}
</script>

<template>
  <header class="mb-8 border-b border-[#1C0A40] pb-6">
    <div class="flex items-start justify-between gap-4">
      <div>
        <p class="mb-1 text-xs font-semibold uppercase tracking-widest text-[#5A3E80]">
          Jakarta · April 2026
        </p>
        <h1 class="font-display text-3xl font-bold tracking-tight text-[#EDE8FF]">
          AF Class Schedule
        </h1>
        <p class="mt-1 text-sm text-[#8B6CB0]">Browse and filter group fitness classes</p>
      </div>
      <div class="flex items-center gap-2">
        <span class="tabular-nums text-sm text-[#8B6CB0]">
          <span class="font-semibold text-[#EDE8FF]">{{ resultCount }}</span> classes
        </span>
        <!-- Mobile filter trigger -->
        <button
          class="flex items-center gap-1.5 rounded-full border border-[#200C48] px-3 py-1.5 text-xs text-[#8B6CB0] transition-colors hover:border-[#2E1565] hover:text-[#EDE8FF] lg:hidden"
          @click="emit('openDrawer')"
        >
          <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z"
            />
          </svg>
          Filters
        </button>
      </div>
    </div>

    <!-- Quick filters -->
    <div class="mt-5 flex flex-wrap gap-2">
      <button
        class="rounded-full px-3.5 py-1.5 text-xs font-medium transition-all"
        :class="
          filters.timeRange === 'all' && !filters.lesMillsOnly
            ? 'bg-[#46019A] text-white'
            : 'border border-[#200C48] text-[#8B6CB0] hover:border-[#2E1565] hover:text-[#B89AE0]'
        "
        @click="resetToAll()"
      >
        All week
      </button>
      <button
        class="rounded-full px-3.5 py-1.5 text-xs font-medium transition-all"
        :class="
          filters.timeRange === 'morning'
            ? 'bg-[#46019A] text-white'
            : 'border border-[#200C48] text-[#8B6CB0] hover:border-[#2E1565] hover:text-[#B89AE0]'
        "
        @click="emit('setTimeRange', 'morning')"
      >
        Morning
      </button>
      <button
        class="rounded-full px-3.5 py-1.5 text-xs font-medium transition-all"
        :class="
          filters.timeRange === 'evening' || filters.timeRange === 'after_work'
            ? 'bg-[#46019A] text-white'
            : 'border border-[#200C48] text-[#8B6CB0] hover:border-[#2E1565] hover:text-[#B89AE0]'
        "
        @click="emit('setTimeRange', 'evening')"
      >
        Evening
      </button>
      <button
        class="rounded-full px-3.5 py-1.5 text-xs font-medium transition-all"
        :class="
          filters.lesMillsOnly
            ? 'border border-amber-400/40 bg-amber-400/15 text-amber-400'
            : 'border border-[#200C48] text-[#8B6CB0] hover:border-amber-400/30 hover:text-amber-400'
        "
        @click="emit('toggleLesMills')"
      >
        LesMills
      </button>
    </div>
  </header>
</template>
