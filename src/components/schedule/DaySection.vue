<script setup lang="ts">
import type { DayGroup } from '@/types/schedule'
import ClassCard from './ClassCard.vue'

defineProps<{ group: DayGroup }>()
</script>

<template>
  <section>
    <!-- Sticky day header -->
    <div class="sticky top-0 z-10 mb-3 flex items-center gap-3 bg-[#09030F] py-3">
      <div>
        <span class="text-xs font-semibold uppercase tracking-widest text-[#5A3E80]">
          {{ group.shortLabel.split(' ')[0] }}
        </span>
        <h2 class="text-base font-semibold text-[#EDE8FF]">{{ group.label }}</h2>
      </div>
      <div class="h-px flex-1 bg-[#1C0A40]" />
      <span class="text-xs tabular-nums text-[#5A3E80]">{{ group.classes.length }} classes</span>
    </div>

    <!-- Cards -->
    <div class="space-y-3 px-4 pb-8">
      <ClassCard v-for="cls in group.classes" :key="cls.id" :cls="cls" />
    </div>
  </section>
</template>
