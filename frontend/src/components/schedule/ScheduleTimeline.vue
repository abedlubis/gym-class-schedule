<script setup lang="ts">
import type { ClassOccurrence, DayGroup } from '@/types/schedule'
import DaySection from './DaySection.vue'
import EmptyState from './EmptyState.vue'

defineProps<{ groups: DayGroup[]; showClub?: boolean; loading?: boolean }>()
defineEmits<{ clearFilters: []; open: [cls: ClassOccurrence] }>()
</script>

<template>
  <div class="min-w-0 flex-1">
    <div v-if="loading" class="space-y-2" aria-busy="true">
      <div v-for="i in 6" :key="i" class="h-[74px] animate-pulse rounded-xl bg-surface/70" />
    </div>

    <div v-else-if="groups.length" class="space-y-6">
      <DaySection
        v-for="group in groups"
        :key="group.date"
        :group="group"
        :show-club="showClub"
        @open="$emit('open', $event)"
      />
    </div>

    <EmptyState v-else @clear-filters="$emit('clearFilters')" />
  </div>
</template>
