<script setup lang="ts">
import type { ScheduleClass } from '@/types/schedule'
import { getTimeFromISO, CATEGORY_COLOR } from '@/utils/schedule'

const props = defineProps<{ cls: ScheduleClass }>()

const time = getTimeFromISO(props.cls.datetime)
const colors = CATEGORY_COLOR[props.cls.category] ?? {
  text: '#94a3b8',
  bg: 'rgba(148,163,184,0.12)',
}
</script>

<template>
  <div
    class="flex gap-4 rounded-2xl border border-[#200C48] bg-[#100520] p-4 transition-all duration-200 hover:border-[#2E1565] hover:bg-[#160830] group"
    style="margin: 10px"
  >
    <!-- Time column -->
    <div class="flex w-14 shrink-0 flex-col items-end pt-0.5">
      <span class="font-mono text-sm font-semibold text-[#EDE8FF]">{{ time }}</span>
    </div>

    <!-- Divider -->
    <div class="w-px self-stretch bg-[#200C48] group-hover:bg-[#2E1565] transition-colors" />

    <!-- Content -->
    <div class="min-w-0 flex-1 space-y-2">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 class="text-[15px] font-semibold leading-tight text-[#EDE8FF]">
            {{ cls.class_name }}
          </h3>
          <p class="mt-0.5 text-sm text-[#8B6CB0]">{{ cls.instructor.join(' · ') }}</p>
        </div>
        <span
          class="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium"
          :style="{ color: colors.text, background: colors.bg }"
        >
          {{ cls.category }}
        </span>
      </div>

      <div class="flex items-center gap-1.5 text-xs text-[#6E5295]">
        <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        <span>{{ cls.location }}</span>
      </div>

      <!-- Tags -->
      <div v-if="cls.tags.length" class="flex flex-wrap gap-1.5">
        <span
          v-for="tag in cls.tags"
          :key="tag"
          class="rounded-full px-2 py-0.5 text-[11px] font-medium"
          :class="
            tag === 'LesMills'
              ? 'bg-amber-400/15 text-amber-400 ring-1 ring-amber-400/30'
              : 'bg-[#200C48] text-[#7A5EA8]'
          "
        >
          {{ tag }}
        </span>
      </div>
    </div>
  </div>
</template>
