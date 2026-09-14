<script setup lang="ts" generic="T extends { id: string }">
defineProps<{
  rows: T[]
  columns: { key: string; label: string; class?: string }[]
  loading?: boolean
  total?: number
  page?: number
  limit?: number
  emptyMessage?: string
}>()

defineEmits<{ changePage: [page: number] }>()
</script>

<template>
  <div class="overflow-hidden rounded-xl bg-surface ring-1 ring-line/70">
    <table class="w-full text-left text-[14px]">
      <thead class="border-b border-line/70 text-[12px] font-semibold text-ink-muted">
        <tr>
          <th v-for="col in columns" :key="col.key" class="px-4 py-2.5" :class="col.class">
            {{ col.label }}
          </th>
          <th class="w-10 px-4 py-2.5"><span class="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody class="divide-y divide-line/50">
        <tr v-if="loading">
          <td :colspan="columns.length + 1" class="px-4 py-8 text-center text-ink-muted">
            Loading…
          </td>
        </tr>
        <tr v-else-if="!rows.length">
          <td :colspan="columns.length + 1" class="px-4 py-10 text-center text-ink-muted">
            {{ emptyMessage ?? 'Nothing here yet.' }}
          </td>
        </tr>
        <tr v-for="row in rows" :key="row.id" class="hover:bg-bg/60">
          <slot name="row" :row="row" />
        </tr>
      </tbody>
    </table>

    <div
      v-if="total && limit && total > limit"
      class="flex items-center justify-between border-t border-line/70 px-4 py-2.5 text-[13px] text-ink-muted"
    >
      <span class="tnum">
        {{ (page! - 1) * limit + 1 }}–{{ Math.min(page! * limit, total) }} of {{ total }}
      </span>
      <div class="flex gap-1">
        <button
          class="rounded px-2 py-1 disabled:opacity-40"
          :disabled="page === 1"
          @click="$emit('changePage', page! - 1)"
        >
          Previous
        </button>
        <button
          class="rounded px-2 py-1 disabled:opacity-40"
          :disabled="page! * limit >= total"
          @click="$emit('changePage', page! + 1)"
        >
          Next
        </button>
      </div>
    </div>
  </div>
</template>
