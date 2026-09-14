<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import type { ActiveFilters, FilterOptions, TimeRange } from '@/types/schedule'
import type { ArrayFilterKey } from '@/composables/useScheduleFilters'
import FilterPanel from './FilterPanel.vue'

const props = defineProps<{
  open: boolean
  filters: ActiveFilters
  options: FilterOptions | null
  hasActiveFilters: boolean
  resultCount: number
}>()

const emit = defineEmits<{
  close: []
  toggleArray: [key: ArrayFilterKey, value: string]
  setTimeRange: [range: TimeRange]
  reset: []
}>()

const search = defineModel<string>('search', { default: '' })

// Escape to close and a body scroll lock — both missing in v1, and both are
// the difference between a sheet that feels native and one that does not.
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

watch(
  () => props.open,
  (open) => {
    document.body.style.overflow = open ? 'hidden' : ''
    if (open) window.addEventListener('keydown', onKeydown)
    else window.removeEventListener('keydown', onKeydown)
  },
)

onBeforeUnmount(() => {
  document.body.style.overflow = ''
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="open"
        class="fixed inset-0 z-40 bg-ink/40 lg:hidden"
        @click="$emit('close')"
      />
    </Transition>
    <Transition name="slide-up">
      <div
        v-if="open"
        class="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] lg:hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
      >
        <div class="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />

        <FilterPanel
          v-model:search="search"
          :filters="filters"
          :options="options"
          :has-active-filters="hasActiveFilters"
          @toggle-array="(k, v) => $emit('toggleArray', k, v)"
          @set-time-range="(r) => $emit('setTimeRange', r)"
          @reset="$emit('reset')"
        />

        <button
          class="sticky bottom-0 mt-6 w-full rounded-xl bg-primary py-3 text-[14px] font-semibold text-white"
          @click="$emit('close')"
        >
          Show {{ resultCount }} {{ resultCount === 1 ? 'class' : 'classes' }}
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from,
.fade-leave-to { opacity: 0; }
.slide-up-enter-active,
.slide-up-leave-active { transition: transform 0.25s ease; }
.slide-up-enter-from,
.slide-up-leave-to { transform: translateY(100%); }
</style>
