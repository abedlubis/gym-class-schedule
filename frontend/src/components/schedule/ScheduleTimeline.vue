<script setup lang="ts">
import Skeleton from 'primevue/skeleton'
import type { ClassOccurrence } from '@/types/schedule'
import ClassRow from './ClassRow.vue'
import EmptyState from './EmptyState.vue'

defineProps<{ classes: ClassOccurrence[]; loading?: boolean }>()
defineEmits<{ clearFilters: []; open: [cls: ClassOccurrence] }>()
</script>

<template>
  <div class="min-w-0 flex-1">
    <div v-if="loading" class="space-y-2" aria-busy="true" aria-label="Loading classes">
      <div v-for="i in 6" :key="i" class="flex gap-3 py-3">
        <Skeleton class="h-10 w-14 shrink-0" />
        <div class="flex-1 space-y-2">
          <Skeleton class="h-3 w-24" />
          <Skeleton class="h-4 w-40" />
          <Skeleton class="h-3 w-32" />
        </div>
      </div>
    </div>

    <div v-else-if="classes.length" class="divide-y divide-line/50">
      <ClassRow v-for="cls in classes" :key="cls.id" :cls="cls" @open="$emit('open', $event)" />
    </div>

    <EmptyState
      v-else
      title="No classes on this day"
      message="Try another day, or clear the filters."
      @clear-filters="$emit('clearFilters')"
    />
  </div>
</template>
