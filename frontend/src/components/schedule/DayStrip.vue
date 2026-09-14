<script setup lang="ts">
import { dayOfMonth, formatShortDay, isToday } from '@/utils/schedule'

defineProps<{
  dates: string[]
  selected: string
  counts: Record<string, number>
  timezone?: string
}>()

defineEmits<{ select: [date: string] }>()
</script>

<template>
  <div class="no-scrollbar -mx-4 overflow-x-auto px-4">
    <div class="flex min-w-full gap-1.5">
      <!--
        A day is always selected — the page opens on today. There is no
        "all days" state: a week of every studio at once is not a view anyone
        can read, and the question is always "what is on today".
      -->
      <button
        v-for="date in dates"
        :key="date"
        type="button"
        :aria-pressed="selected === date"
        :aria-label="`${formatShortDay(date)} ${dayOfMonth(date)}, ${counts[date] ?? 0} classes`"
        class="flex min-w-[46px] flex-1 cursor-pointer flex-col items-center gap-0.5 rounded-xl py-2 transition-colors"
        :class="
          selected === date
            ? 'bg-primary text-white'
            : 'bg-surface text-ink-muted hover:bg-surface/70'
        "
        @click="$emit('select', date)"
      >
        <span class="text-[11px] font-medium opacity-75">
          {{ formatShortDay(date) }}
        </span>
        <span class="tnum text-[17px] font-semibold leading-none">
          {{ dayOfMonth(date) }}
        </span>
        <span
          class="tnum text-[10px]"
          :class="selected === date ? 'opacity-70' : 'text-ink-muted/50'"
        >
          {{ counts[date] ?? 0 }}
        </span>
        <span
          v-if="isToday(date, timezone)"
          class="h-1 w-1 rounded-full"
          :class="selected === date ? 'bg-white' : 'bg-primary'"
          aria-hidden="true"
        />
        <span v-else class="h-1 w-1" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>
