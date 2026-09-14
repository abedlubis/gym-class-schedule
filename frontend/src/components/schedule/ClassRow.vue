<script setup lang="ts">
import { computed } from 'vue'
import type { ClassOccurrence } from '@/types/schedule'
import { formatInstructors } from '@/utils/schedule'

const props = defineProps<{ cls: ClassOccurrence; showClub?: boolean }>()
defineEmits<{ open: [cls: ClassOccurrence] }>()

const isTba = computed(() => props.cls.instructor_status === 'tba')
const instructors = computed(() => formatInstructors(props.cls))
</script>

<template>
  <button
    type="button"
    class="group flex w-full items-stretch gap-0 text-left"
    @click="$emit('open', cls)"
  >
    <!-- The time rail. AF prints a purple vertical time column down the left of
         every timetable graphic; borrowing it makes the app read as the same
         artefact and gives the list a spine to scan. -->
    <div class="flex w-[68px] shrink-0 flex-col items-end pr-3 pt-3 text-right">
      <span class="tnum text-[15px] font-semibold leading-none text-ink">
        {{ cls.start_time }}
      </span>
      <span class="tnum mt-1 text-[11px] leading-none text-ink-muted/55">
        {{ cls.duration_min }} min
      </span>
    </div>

    <div class="w-px shrink-0 bg-line/70" aria-hidden="true" />

    <div
      class="min-w-0 flex-1 rounded-r-[--radius-card] py-3 pl-4 pr-3 transition-colors group-hover:bg-surface"
    >
      <div class="flex items-center gap-2">
        <span
          class="h-2 w-2 shrink-0 rounded-full"
          :style="{ background: cls.category.color }"
          aria-hidden="true"
        />
        <span class="truncate text-[12px] text-accent">{{ cls.category.label }}</span>
        <span
          v-if="cls.programme"
          class="ml-auto shrink-0 rounded-full bg-primary/8 px-2 py-0.5 text-[11px] font-medium text-primary"
        >
          {{ cls.programme }}
        </span>
      </div>

      <h3 class="mt-0.5 truncate text-[17px] font-semibold leading-snug text-ink">
        {{ cls.class_name }}
      </h3>

      <p
        class="mt-0.5 truncate text-[13px]"
        :class="isTba ? 'italic text-ink-muted/50' : 'text-ink-muted'"
      >
        {{ instructors }}<template v-if="showClub"> · {{ cls.club.name }}</template>
      </p>
    </div>
  </button>
</template>
