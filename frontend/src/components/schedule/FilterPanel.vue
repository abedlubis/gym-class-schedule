<script setup lang="ts">
import type { ActiveFilters, FilterOptions, TimeRange } from '@/types/schedule'
import type { ArrayFilterKey } from '@/composables/useScheduleFilters'
import { weekdayLabel } from '@/utils/schedule'

defineProps<{
  filters: ActiveFilters
  options: FilterOptions | null
  hasActiveFilters: boolean
}>()

defineEmits<{
  toggleArray: [key: ArrayFilterKey, value: string]
  toggleWeekday: [weekday: number]
  setTimeRange: [range: TimeRange]
  reset: []
}>()

/**
 * The v1 sidebar bound its search box to a local ref that was never emitted, so
 * typing in it did nothing at all. `defineModel` wires it to the parent's
 * filter state, and the same component now serves desktop and mobile — which is
 * also why the two could previously hold different search terms.
 */
const search = defineModel<string>('search', { default: '' })

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: 'all', label: 'Any time' },
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
]

// 1..6,0 so the strip reads Monday-first like the timeline.
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0]
</script>

<template>
  <div class="w-full space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="text-[14px] font-semibold text-ink">Filters</h2>
      <button
        v-if="hasActiveFilters"
        class="text-xs text-ink-muted underline hover:text-ink"
        @click="$emit('reset')"
      >
        Reset
      </button>
    </div>

    <div>
      <label for="schedule-search" class="mb-1.5 block text-[12px] font-medium text-ink-muted">
        Search
      </label>
      <input
        id="schedule-search"
        v-model="search"
        type="search"
        placeholder="Class, instructor…"
        class="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted/50 focus:border-primary focus:outline-none"
      />
    </div>

    <fieldset>
      <legend class="mb-1.5 text-[12px] font-medium text-ink-muted">Day</legend>
      <div class="flex gap-1">
        <button
          v-for="d in WEEKDAYS"
          :key="d"
          type="button"
          :aria-pressed="filters.weekdays.includes(d)"
          class="h-8 flex-1 rounded-md text-[12px] font-medium transition"
          :class="
            filters.weekdays.includes(d)
              ? 'bg-primary text-ink'
              : 'bg-surface text-ink-muted hover:text-ink'
          "
          @click="$emit('toggleWeekday', d)"
        >
          {{ weekdayLabel(d).charAt(0) }}
        </button>
      </div>
    </fieldset>

    <fieldset>
      <legend class="mb-1.5 text-[12px] font-medium text-ink-muted">Time</legend>
      <div class="grid grid-cols-2 gap-1">
        <button
          v-for="r in TIME_RANGES"
          :key="r.value"
          type="button"
          :aria-pressed="filters.timeRange === r.value"
          class="rounded-md px-2 py-1.5 text-xs transition"
          :class="
            filters.timeRange === r.value
              ? 'bg-primary text-ink'
              : 'bg-surface text-ink-muted hover:text-ink'
          "
          @click="$emit('setTimeRange', r.value)"
        >
          {{ r.label }}
        </button>
      </div>
    </fieldset>

    <fieldset v-if="options?.families.length">
      <legend class="mb-1.5 text-[12px] font-medium text-ink-muted">Class type</legend>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="f in options.families"
          :key="f.name"
          type="button"
          :aria-pressed="filters.families.includes(f.name)"
          class="rounded-full px-2.5 py-1 text-xs transition"
          :class="
            filters.families.includes(f.name)
              ? 'bg-primary text-ink'
              : 'bg-surface text-ink-muted hover:text-ink'
          "
          @click="$emit('toggleArray', 'families', f.name)"
        >
          {{ f.name }}
          <span class="opacity-50">{{ f.count }}</span>
        </button>
      </div>
    </fieldset>

    <fieldset v-if="options?.categories.length">
      <legend class="mb-1.5 text-[12px] font-medium text-ink-muted">Category</legend>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="c in options.categories"
          :key="c.slug"
          type="button"
          :aria-pressed="filters.categories.includes(c.slug)"
          class="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition"
          :class="
            filters.categories.includes(c.slug)
              ? 'bg-primary text-ink'
              : 'bg-surface text-ink-muted hover:text-ink'
          "
          @click="$emit('toggleArray', 'categories', c.slug)"
        >
          <span class="h-2 w-2 rounded-full" :style="{ background: c.color }" />
          {{ c.label }}
        </button>
      </div>
    </fieldset>

    <fieldset v-if="options?.programmes.length">
      <legend class="mb-1.5 text-[12px] font-medium text-ink-muted">Programme</legend>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="p in options.programmes"
          :key="p.name"
          type="button"
          :aria-pressed="filters.programmes.includes(p.name)"
          class="rounded-full px-2.5 py-1 text-xs transition"
          :class="
            filters.programmes.includes(p.name)
              ? 'bg-primary text-ink'
              : 'bg-surface text-ink-muted hover:text-ink'
          "
          @click="$emit('toggleArray', 'programmes', p.name)"
        >
          {{ p.name }}
        </button>
      </div>
    </fieldset>

    <fieldset v-if="options?.instructors.length">
      <legend class="mb-1.5 text-[12px] font-medium text-ink-muted">
        Instructor
        <span class="opacity-60">({{ options.instructors.length }})</span>
      </legend>
      <div class="max-h-56 space-y-1 overflow-y-auto pr-1">
        <label
          v-for="i in options.instructors"
          :key="i.name"
          class="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm text-ink-muted hover:bg-surface"
        >
          <input
            type="checkbox"
            class="accent-[--color-primary]"
            :checked="filters.instructors.includes(i.name)"
            @change="$emit('toggleArray', 'instructors', i.name)"
          />
          <span class="truncate">{{ i.name }}</span>
          <span class="ml-auto text-xs text-ink-muted/50">{{ i.count }}</span>
        </label>
      </div>
    </fieldset>
  </div>
</template>
