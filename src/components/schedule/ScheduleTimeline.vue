<script setup lang="ts">
import type { DayGroup } from '@/types/schedule'
import DaySection from './DaySection.vue'
import EmptyState from './EmptyState.vue'

defineProps<{ groups: DayGroup[] }>()
defineEmits<{ clearFilters: [] }>()
</script>

<template>
  <main class="min-w-0 flex-1">
    <EmptyState v-if="!groups.length" @clear="$emit('clearFilters')" />
    <div v-else class="space-y-2">
      <DaySection v-for="group in groups" :key="group.key" :group="group" />
    </div>
  </main>
</template>
