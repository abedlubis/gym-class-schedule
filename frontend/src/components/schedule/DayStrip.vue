<script setup lang="ts">
import { dayOfMonth, formatShortDay } from '@/utils/schedule'

defineProps<{
  dates: string[]
  selected: string | null
  counts: Record<string, number>
}>()

defineEmits<{ select: [date: string | null] }>()
</script>

<template>
  <div class="no-scrollbar -mx-4 overflow-x-auto px-4">
    <div class="flex min-w-full gap-1.5">
      <button
        v-for="date in dates"
        :key="date"
        type="button"
        :aria-pressed="selected === date"
        class="flex min-w-[46px] flex-1 flex-col items-center gap-0.5 rounded-xl py-2 transition-colors"
        :class="
          selected === date
            ? 'bg-primary text-white'
            : 'bg-surface text-ink-muted hover:bg-surface/70'
        "
        @click="$emit('select', selected === date ? null : date)"
      >
        <span class="text-[11px] font-medium opacity-75">{{ formatShortDay(date) }}</span>
        <span class="tnum text-[17px] font-semibold leading-none">
          {{ dayOfMonth(date) }}
        </span>
        <span
          class="tnum text-[10px]"
          :class="selected === date ? 'opacity-70' : 'text-ink-muted/50'"
        >
          {{ counts[date] ?? 0 }}
        </span>
      </button>
    </div>
  </div>
</template>
