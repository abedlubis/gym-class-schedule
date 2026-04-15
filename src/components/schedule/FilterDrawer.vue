<script setup lang="ts">
import type { ActiveFilters, ScheduleFiltersData } from '@/types/schedule'
import FilterSidebar from './FilterSidebar.vue'

defineProps<{
  open: boolean
  filters: ActiveFilters
  filterOptions: ScheduleFiltersData
  hasActiveFilters: boolean
  resultCount: number
}>()

const emit = defineEmits<{
  close: []
  toggleArray: [key: 'locations' | 'categories' | 'instructors' | 'tags' | 'dayKeys', value: string]
  setTimeRange: [range: ActiveFilters['timeRange']]
  toggleLesMills: []
  reset: []
}>()
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <Transition name="fade">
      <div
        v-if="open"
        class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        @click="emit('close')"
      />
    </Transition>

    <!-- Drawer -->
    <Transition name="slide-up">
      <div
        v-if="open"
        class="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-[#200C48] bg-[#09030F] p-6"
      >
        <!-- Handle -->
        <div class="mx-auto mb-5 h-1 w-10 rounded-full bg-[#200C48]" />

        <!-- Header -->
        <div class="mb-5 flex items-center justify-between">
          <span class="text-sm font-semibold text-[#EDE8FF]">Filters</span>
          <button class="text-xs text-[#8B6CB0] hover:text-[#EDE8FF]" @click="emit('close')">
            Done · {{ resultCount }} classes
          </button>
        </div>

        <FilterSidebar
          :filters="filters"
          :filter-options="filterOptions"
          :has-active-filters="hasActiveFilters"
          class="w-full"
          @toggle-array="(k, v) => emit('toggleArray', k, v)"
          @set-time-range="(r) => emit('setTimeRange', r)"
          @toggle-les-mills="emit('toggleLesMills')"
          @reset="emit('reset')"
        />

        <div class="mt-6 pb-safe">
          <button
            class="w-full rounded-xl bg-[#46019A] py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            @click="emit('close')"
          >
            Show {{ resultCount }} classes
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}
</style>
