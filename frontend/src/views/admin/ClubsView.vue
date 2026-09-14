<script setup lang="ts">
import { ref, watch } from 'vue'
import { adminFetch, adminList, type Paged } from '@/api/admin'
import AdminShell from '@/components/admin/AdminShell.vue'
import DataTable from '@/components/admin/DataTable.vue'

type Club = {
  id: string
  name: string
  slug: string
  region: string
  city: string
  status: string
  scheduleStale: boolean
  instagramHandle: string | null
  dataGapNote: string | null
}

const result = ref<Paged<Club> | null>(null)
const loading = ref(true)
const page = ref(1)
const query = ref('')

async function load() {
  loading.value = true
  result.value = await adminList<Club>('/admin/clubs', {
    page: page.value,
    limit: 25,
    q: query.value || undefined,
  })
  loading.value = false
}

watch([page, query], load, { immediate: true })

async function toggleStale(row: Club) {
  await adminFetch(`/admin/clubs/${row.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ scheduleStale: !row.scheduleStale }),
  })
  await load()
}
</script>

<template>
  <AdminShell>
    <h1 class="text-[20px] font-semibold text-ink">Studios</h1>
    <p class="mt-1 max-w-[60ch] text-[14px] text-ink-muted">
      Marking a studio out of date puts a warning on its public schedule. Use it
      when a club stops publishing.
    </p>

    <input
      v-model="query"
      type="search"
      placeholder="Search studios"
      aria-label="Search studios"
      class="mt-4 w-full rounded-lg border border-line bg-surface px-3 py-2 text-[14px] lg:max-w-xs"
      @input="page = 1"
    />

    <div class="mt-4">
      <DataTable
        :rows="result?.data ?? []"
        :columns="[
          { key: 'name', label: 'Studio' },
          { key: 'region', label: 'Area' },
          { key: 'status', label: 'Status' },
          { key: 'ig', label: 'Instagram' },
        ]"
        :loading="loading"
        :total="result?.meta.total"
        :page="result?.meta.page"
        :limit="result?.meta.limit"
        @change-page="page = $event"
      >
        <template #row="{ row }">
          <td class="px-4 py-2.5 font-medium text-ink">{{ (row as Club).name }}</td>
          <td class="px-4 py-2.5 text-ink-muted">{{ (row as Club).region }}</td>
          <td class="px-4 py-2.5">
            <span class="rounded-full bg-bg px-2 py-0.5 text-[12px] capitalize text-ink-muted">
              {{ (row as Club).status.replace('_', ' ') }}
            </span>
            <span
              v-if="(row as Club).scheduleStale"
              class="ml-1 rounded-full bg-[#FDF4E3] px-2 py-0.5 text-[12px] text-[#7A4A00]"
            >
              out of date
            </span>
          </td>
          <td class="px-4 py-2.5 text-ink-muted">
            {{ (row as Club).instagramHandle ?? '—' }}
          </td>
          <td class="px-4 py-2.5 text-right">
            <button class="text-[13px] text-ink-muted hover:text-primary" @click="toggleStale(row as Club)">
              {{ (row as Club).scheduleStale ? 'Mark current' : 'Mark out of date' }}
            </button>
          </td>
        </template>
      </DataTable>
    </div>
  </AdminShell>
</template>
