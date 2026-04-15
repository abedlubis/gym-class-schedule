<script setup lang="ts">
import type { ActiveFilters } from '@/types/schedule'

const props = defineProps<{
  filters: ActiveFilters
  hasActiveFilters: boolean
}>()

const emit = defineEmits<{
  remove: [key: keyof ActiveFilters, value?: string]
  clear: []
}>()

const TIME_LABELS: Record<string, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  after_work: 'After Work',
}
</script>

<template>
  <div v-if="hasActiveFilters" class="flex flex-wrap items-center gap-2 px-1 pb-4">
    <!-- Array filters -->
    <template
      v-for="key in ['locations', 'categories', 'instructors', 'tags', 'dayKeys'] as const"
      :key="key"
    >
      <button
        v-for="val in filters[key] as string[]"
        :key="`${key}-${val}`"
        class="flex items-center gap-1.5 rounded-full border border-[#2E1565] bg-[#160830] px-3 py-1 text-xs text-[#B89AE0] transition-colors hover:border-[#5A3E80] hover:text-[#EDE8FF]"
        @click="emit('remove', key, val)"
      >
        <span>{{ val }}</span>
        <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </template>

    <!-- Time range -->
    <button
      v-if="filters.timeRange !== 'all'"
      class="flex items-center gap-1.5 rounded-full border border-[#2E1565] bg-[#160830] px-3 py-1 text-xs text-[#B89AE0] transition-colors hover:border-[#5A3E80] hover:text-[#EDE8FF]"
      @click="emit('remove', 'timeRange')"
    >
      <span>{{ TIME_LABELS[filters.timeRange] ?? filters.timeRange }}</span>
      <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    </button>

    <!-- LesMills -->
    <button
      v-if="filters.lesMillsOnly"
      class="flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs text-amber-400 transition-colors hover:bg-amber-400/20"
      @click="emit('remove', 'lesMillsOnly')"
    >
      <span>LesMills</span>
      <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    </button>

    <!-- Clear all -->
    <button
      class="ml-1 text-xs text-[#5A3E80] underline underline-offset-2 transition-colors hover:text-[#8B6CB0]"
      @click="emit('clear')"
    >
      Clear all
    </button>
  </div>
</template>
