<script setup lang="ts">
import { ref } from 'vue'
import type { ActiveFilters, ScheduleFiltersData } from '@/types/schedule'
import { WEEKDAY_OPTIONS, CATEGORY_COLOR } from '@/utils/schedule'

defineProps<{
  filters: ActiveFilters
  filterOptions: ScheduleFiltersData
  hasActiveFilters: boolean
}>()

const emit = defineEmits<{
  toggleArray: [key: 'locations' | 'categories' | 'instructors' | 'tags' | 'dayKeys', value: string]
  setTimeRange: [range: ActiveFilters['timeRange']]
  toggleLesMills: []
  reset: []
}>()

const searchModel = ref('')

const TIME_OPTIONS: { value: ActiveFilters['timeRange']; label: string }[] = [
  { value: 'all', label: 'Any time' },
  { value: 'morning', label: 'Morning (before 12:00)' },
  { value: 'afternoon', label: 'Afternoon (12–18)' },
  { value: 'evening', label: 'Evening (after 18:00)' },
]
</script>

<template>
  <aside class="flex w-64 shrink-0 flex-col gap-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <span class="text-xs font-semibold uppercase tracking-widest text-[#5A3E80]">Filters</span>
      <button
        v-if="hasActiveFilters"
        class="text-xs text-[#5A3E80] underline underline-offset-2 hover:text-[#8B6CB0]"
        @click="emit('reset')"
      >
        Clear all
      </button>
    </div>

    <!-- Search -->
    <div>
      <label class="mb-1.5 block text-xs font-medium text-[#5A3E80]">Search</label>
      <input
        v-model="searchModel"
        type="text"
        placeholder="Class, instructor, location…"
        class="w-full rounded-xl border border-[#200C48] bg-[#100520] px-3 py-2 text-sm text-[#EDE8FF] placeholder-[#5A3E80] outline-none transition-colors focus:border-[#2E1565] focus:ring-1 focus:ring-[#46019A]"
      />
    </div>

    <!-- Day -->
    <div>
      <label class="mb-2 block text-xs font-medium text-[#5A3E80]">Day</label>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="day in WEEKDAY_OPTIONS"
          :key="day.key"
          class="rounded-lg px-2.5 py-1 text-xs font-medium transition-all"
          :class="
            filters.dayKeys.includes(day.key)
              ? 'bg-[#46019A] text-white'
              : 'border border-[#200C48] text-[#8B6CB0] hover:border-[#2E1565] hover:text-[#B89AE0]'
          "
          @click="emit('toggleArray', 'dayKeys', day.key)"
        >
          {{ day.label }}
        </button>
      </div>
    </div>

    <!-- Time range -->
    <div>
      <label class="mb-2 block text-xs font-medium text-[#5A3E80]">Time</label>
      <div class="space-y-1">
        <button
          v-for="opt in TIME_OPTIONS"
          :key="opt.value"
          class="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors"
          :class="
            filters.timeRange === opt.value
              ? 'bg-[#200C48] text-[#EDE8FF]'
              : 'text-[#8B6CB0] hover:bg-[#100520] hover:text-[#B89AE0]'
          "
          @click="emit('setTimeRange', opt.value)"
        >
          <span
            class="h-1.5 w-1.5 rounded-full"
            :class="filters.timeRange === opt.value ? 'bg-[#9F6EF5]' : 'bg-[#200C48]'"
          />
          {{ opt.label }}
        </button>
      </div>
    </div>

    <!-- Location -->
    <div>
      <label class="mb-2 block text-xs font-medium text-[#5A3E80]">Location</label>
      <div class="space-y-1">
        <label
          v-for="loc in filterOptions.locations"
          :key="loc"
          class="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors hover:bg-[#100520]"
          :class="filters.locations.includes(loc) ? 'text-[#EDE8FF]' : 'text-[#8B6CB0]'"
        >
          <span
            class="flex h-4 w-4 items-center justify-center rounded border transition-colors"
            :class="
              filters.locations.includes(loc)
                ? 'border-[#9F6EF5] bg-[#9F6EF5]/20'
                : 'border-[#200C48]'
            "
          >
            <svg
              v-if="filters.locations.includes(loc)"
              class="h-2.5 w-2.5 text-[#9F6EF5]"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fill-rule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clip-rule="evenodd"
              />
            </svg>
          </span>
          <input
            type="checkbox"
            class="sr-only"
            :checked="filters.locations.includes(loc)"
            @change="emit('toggleArray', 'locations', loc)"
          />
          {{ loc }}
        </label>
      </div>
    </div>

    <!-- Category -->
    <div>
      <label class="mb-2 block text-xs font-medium text-[#5A3E80]">Category</label>
      <div class="space-y-1">
        <label
          v-for="cat in filterOptions.categories"
          :key="cat"
          class="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors hover:bg-[#100520]"
          :class="filters.categories.includes(cat) ? 'text-[#EDE8FF]' : 'text-[#8B6CB0]'"
        >
          <span
            class="h-2 w-2 rounded-full"
            :style="{ background: CATEGORY_COLOR[cat]?.text ?? '#7A5EA8' }"
          />
          <input
            type="checkbox"
            class="sr-only"
            :checked="filters.categories.includes(cat)"
            @change="emit('toggleArray', 'categories', cat)"
          />
          {{ cat }}
        </label>
      </div>
    </div>

    <!-- Instructor -->
    <div>
      <label class="mb-2 block text-xs font-medium text-[#5A3E80]">Instructor</label>
      <div class="space-y-1">
        <label
          v-for="inst in filterOptions.instructors"
          :key="inst"
          class="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors hover:bg-[#100520]"
          :class="filters.instructors.includes(inst) ? 'text-[#EDE8FF]' : 'text-[#8B6CB0]'"
        >
          <span
            class="flex h-4 w-4 items-center justify-center rounded border transition-colors"
            :class="
              filters.instructors.includes(inst)
                ? 'border-[#9F6EF5] bg-[#9F6EF5]/20'
                : 'border-[#200C48]'
            "
          >
            <svg
              v-if="filters.instructors.includes(inst)"
              class="h-2.5 w-2.5 text-[#9F6EF5]"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fill-rule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clip-rule="evenodd"
              />
            </svg>
          </span>
          <input
            type="checkbox"
            class="sr-only"
            :checked="filters.instructors.includes(inst)"
            @change="emit('toggleArray', 'instructors', inst)"
          />
          {{ inst }}
        </label>
      </div>
    </div>

    <!-- LesMills toggle -->
    <div>
      <label class="mb-2 block text-xs font-medium text-[#5A3E80]">Programme</label>
      <button
        class="flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-xs transition-all"
        :class="
          filters.lesMillsOnly
            ? 'border-amber-400/40 bg-amber-400/10 text-amber-400'
            : 'border-[#200C48] text-[#8B6CB0] hover:border-[#2E1565]'
        "
        @click="emit('toggleLesMills')"
      >
        <span class="font-medium">LesMills only</span>
        <span
          class="flex h-5 w-9 items-center rounded-full transition-colors"
          :class="filters.lesMillsOnly ? 'bg-amber-400/30' : 'bg-[#200C48]'"
        >
          <span
            class="h-3.5 w-3.5 rounded-full transition-transform"
            :class="
              filters.lesMillsOnly ? 'translate-x-5 bg-amber-400' : 'translate-x-0.5 bg-[#5A3E80]'
            "
          />
        </span>
      </button>
    </div>
  </aside>
</template>
