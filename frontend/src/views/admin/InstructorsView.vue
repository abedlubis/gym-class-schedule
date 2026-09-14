<script setup lang="ts">
import { ref, watch } from 'vue'
import { adminFetch, adminList, type Paged } from '@/api/admin'
import { ApiError } from '@/api/client'
import AdminShell from '@/components/admin/AdminShell.vue'
import DataTable from '@/components/admin/DataTable.vue'

type Instructor = {
  id: string
  name: string
  status: string
  clubs: string[]
  slot_count: number
}

const result = ref<Paged<Instructor> | null>(null)
const loading = ref(true)
const page = ref(1)
const query = ref('')
const newName = ref('')
const banner = ref('')
const confirmMessage = ref('')

async function load() {
  loading.value = true
  result.value = await adminList<Instructor>('/admin/instructors', {
    page: page.value,
    limit: 20,
    q: query.value || undefined,
  })
  loading.value = false
}

watch([page, query], load, { immediate: true })

async function create(force = false) {
  if (!newName.value.trim()) return
  banner.value = ''
  try {
    await adminFetch('/admin/instructors', {
      method: 'POST',
      body: JSON.stringify({ name: newName.value.trim(), force }),
    })
    newName.value = ''
    confirmMessage.value = ''
    await load()
  } catch (err) {
    // The duplicate-nickname guard. Nicknames are treated as one person
    // everywhere, so this is where two different coaches would silently merge.
    if (err instanceof ApiError && err.code === 'DUPLICATE_INSTRUCTOR') {
      confirmMessage.value = err.message
    } else {
      banner.value = err instanceof ApiError ? err.message : 'Could not add this instructor'
    }
  }
}

async function remove(row: Instructor) {
  if (!confirm(`Delete ${row.name}?`)) return
  try {
    await adminFetch(`/admin/instructors/${row.id}`, { method: 'DELETE' })
    await load()
  } catch (err) {
    banner.value = err instanceof ApiError ? err.message : 'Could not delete this instructor'
  }
}
</script>

<template>
  <AdminShell>
    <h1 class="text-[20px] font-semibold text-ink">Instructors</h1>

    <div class="mt-4 flex flex-wrap gap-2">
      <input
        v-model="query"
        type="search"
        placeholder="Search by name"
        aria-label="Search instructors"
        class="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-[14px] lg:max-w-xs"
        @input="page = 1"
      />
      <input
        v-model="newName"
        placeholder="New instructor name"
        aria-label="New instructor name"
        class="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-[14px] lg:max-w-xs"
        @keyup.enter="create()"
      />
      <button class="rounded-lg bg-primary px-3.5 py-2 text-[14px] font-semibold text-white" @click="create()">
        Add
      </button>
    </div>

    <div
      v-if="confirmMessage"
      class="mt-3 rounded-lg border border-[#E0B25C] bg-[#FDF4E3] px-3 py-2.5 text-[13px] text-[#7A4A00]"
    >
      {{ confirmMessage }}
      <div class="mt-2 flex gap-2">
        <button class="rounded bg-primary px-2.5 py-1 text-[12px] font-semibold text-white" @click="create(true)">
          Yes, add anyway
        </button>
        <button class="rounded px-2.5 py-1 text-[12px] underline" @click="confirmMessage = ''">
          Cancel
        </button>
      </div>
    </div>

    <p v-if="banner" role="alert" class="mt-3 rounded-lg bg-[#FBEDED] px-3 py-2 text-[13px] text-[#8A2C2C]">
      {{ banner }}
    </p>

    <div class="mt-4">
      <DataTable
        :rows="result?.data ?? []"
        :columns="[
          { key: 'name', label: 'Name' },
          { key: 'clubs', label: 'Studios' },
          { key: 'slots', label: 'Classes' },
        ]"
        :loading="loading"
        :total="result?.meta.total"
        :page="result?.meta.page"
        :limit="result?.meta.limit"
        @change-page="page = $event"
      >
        <template #row="{ row }">
          <td class="px-4 py-2.5 font-medium text-ink">{{ (row as Instructor).name }}</td>
          <td class="px-4 py-2.5 text-ink-muted">
            {{ (row as Instructor).clubs.join(', ') || '—' }}
          </td>
          <td class="tnum px-4 py-2.5 text-ink-muted">{{ (row as Instructor).slot_count }}</td>
          <td class="px-4 py-2.5 text-right">
            <button
              class="text-[13px] text-ink-muted hover:text-[#8A2C2C]"
              @click="remove(row as Instructor)"
            >
              Delete
            </button>
          </td>
        </template>
      </DataTable>
    </div>
  </AdminShell>
</template>
