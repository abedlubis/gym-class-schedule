<script setup lang="ts">
defineEmits<{ clear: [] }>()
</script>

<template>
  <div class="flex flex-col items-center justify-center py-24 text-center">
    <div class="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#100520] text-[#5A3E80]">
      <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
    <h3 class="mb-1 text-sm font-semibold text-[#8B6CB0]">No classes found</h3>
    <p class="mb-5 text-xs text-[#5A3E80]">Try removing a few filters.</p>
    <button
      class="rounded-full border border-[#200C48] px-4 py-1.5 text-xs text-[#8B6CB0] transition-colors hover:border-[#2E1565] hover:text-[#EDE8FF]"
      @click="$emit('clear')"
    >
      Clear filters
    </button>
  </div>
</template>
