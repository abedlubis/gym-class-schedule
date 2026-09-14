<script setup lang="ts">
import type { ClassOccurrence, DayGroup } from '@/types/schedule'
import ClassRow from './ClassRow.vue'

defineProps<{ group: DayGroup; showClub?: boolean }>()
defineEmits<{ open: [cls: ClassOccurrence] }>()
</script>

<template>
  <section>
    <h2
      class="sticky top-0 z-10 flex items-baseline gap-2 bg-bg/95 py-2 font-display text-[13px] font-bold uppercase tracking-wide text-ink backdrop-blur"
    >
      {{ group.label }}
      <span class="tnum font-sans text-[12px] font-normal normal-case text-ink-muted/60">
        {{ group.classes.length }}
      </span>
    </h2>

    <div class="divide-y divide-line/50">
      <ClassRow
        v-for="cls in group.classes"
        :key="cls.id"
        :cls="cls"
        :show-club="showClub"
        @open="$emit('open', $event)"
      />
    </div>
  </section>
</template>
