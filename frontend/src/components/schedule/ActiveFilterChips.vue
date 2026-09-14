<script setup lang="ts">
import { computed } from 'vue'
import type { ActiveFilters } from '@/types/schedule'
import type { ArrayFilterKey } from '@/composables/useScheduleFilters'

const props = defineProps<{ filters: ActiveFilters; hasActiveFilters: boolean }>()

const emit = defineEmits<{
  removeArray: [key: ArrayFilterKey, value: string]
  clearSearch: []
  clearTimeRange: []
  clear: []
}>()

type Chip = { label: string; remove: () => void }

const chips = computed<Chip[]>(() => {
  const out: Chip[] = []
  const f = props.filters
  if (f.search.trim()) {
    out.push({ label: `“${f.search.trim()}”`, remove: () => emit('clearSearch') })
  }
  for (const key of ['families', 'categories', 'programmes', 'instructors'] as const) {
    for (const value of f[key]) {
      out.push({ label: value, remove: () => emit('removeArray', key, value) })
    }
  }
  if (f.timeRange !== 'all') {
    out.push({ label: f.timeRange, remove: () => emit('clearTimeRange') })
  }
  return out
})
</script>

<template>
  <div v-if="hasActiveFilters" class="mb-4 flex flex-wrap items-center gap-2">
    <button
      v-for="chip in chips"
      :key="chip.label"
      class="flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-[12px] text-ink ring-1 ring-line/70 hover:ring-primary"
      @click="chip.remove()"
    >
      {{ chip.label }}
      <span aria-hidden="true" class="opacity-50">×</span>
      <span class="sr-only">Remove filter</span>
    </button>
    <button class="text-[12px] text-ink-muted underline underline-offset-2 hover:text-primary" @click="$emit('clear')">
      Clear all
    </button>
  </div>
</template>
