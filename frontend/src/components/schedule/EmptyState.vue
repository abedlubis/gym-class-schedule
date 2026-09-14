<script setup lang="ts">
defineProps<{ title?: string; message?: string; action?: string }>()
defineEmits<{ clearFilters: [] }>()
</script>

<template>
  <div class="rounded-[--radius-card] border border-dashed border-line bg-surface/50 px-6 py-14 text-center">
    <p class="text-[16px] font-semibold text-ink">
      {{ title ?? 'Nothing scheduled here' }}
    </p>
    <p class="mx-auto mt-1 max-w-[34ch] text-[13px] text-ink-muted">
      {{ message ?? 'Widen the filters or pick another day to see more classes.' }}
    </p>
    <button
      class="mt-4 rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90"
      @click="$emit('clearFilters')"
    >
      {{ action ?? 'Clear filters' }}
    </button>
  </div>
</template>
