<script setup lang="ts">
import { computed } from 'vue'
import Skeleton from 'primevue/skeleton'
import type { ClassOccurrence } from '@/types/schedule'
import { groupClassesByTime, shortClubName } from '@/utils/schedule'
import EmptyState from './EmptyState.vue'

const props = defineProps<{ classes: ClassOccurrence[]; loading?: boolean }>()
defineEmits<{ open: [cls: ClassOccurrence]; clearFilters: [] }>()

const groups = computed(() => groupClassesByTime(props.classes))
</script>

<template>
  <div v-if="loading" class="space-y-3" aria-busy="true" aria-label="Loading classes">
    <div v-for="i in 6" :key="i" class="flex gap-3">
      <Skeleton class="h-5 w-12 shrink-0" />
      <div class="flex flex-1 flex-wrap gap-1.5">
        <Skeleton v-for="j in (i % 3) + 2" :key="j" class="h-7 w-32" />
      </div>
    </div>
  </div>

  <div v-else-if="groups.length" class="divide-y divide-line/50">
    <!--
      One row per start time, every branch running at that time on it. With ~58
      studios a single day holds well over a hundred classes; a card each is
      unreadable, and the question being asked is "what is on at 7am" rather
      than "tell me about this one class".
    -->
    <div v-for="group in groups" :key="group.time" class="flex gap-3 py-2.5">
      <div class="w-[52px] shrink-0 pt-0.5 text-right">
        <span class="tnum text-[14px] font-semibold leading-none text-ink">
          {{ group.time }}
        </span>
      </div>

      <div class="w-px shrink-0 bg-primary/25" aria-hidden="true" />

      <ul class="flex flex-1 flex-wrap gap-1.5">
        <li v-for="cls in group.classes" :key="cls.id">
          <button
            type="button"
            class="flex max-w-full cursor-pointer items-center gap-1.5 rounded-lg bg-surface py-1 pl-2 pr-2.5 text-left ring-1 ring-line/70 transition-colors hover:ring-primary"
            @click="$emit('open', cls)"
          >
            <span
              class="h-1.5 w-1.5 shrink-0 rounded-full"
              :style="{ background: cls.category.color }"
              aria-hidden="true"
            />
            <span class="truncate text-[13px] font-medium leading-tight text-ink">
              {{ cls.class_name }}
            </span>
            <span class="truncate text-[12px] leading-tight text-ink-muted/80">
              {{ shortClubName(cls.club.name) }}
            </span>
          </button>
        </li>
      </ul>
    </div>
  </div>

  <EmptyState
    v-else
    title="No classes on this day"
    message="Try another day, another studio, or clear the filters."
    @clear-filters="$emit('clearFilters')"
  />
</template>
