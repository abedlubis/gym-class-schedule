<script setup lang="ts">
import { ref, watch } from 'vue'
import { adminFetch, adminList, type Paged } from '@/api/admin'
import { ApiError } from '@/api/client'
import AdminShell from '@/components/admin/AdminShell.vue'
import DataTable from '@/components/admin/DataTable.vue'
import SlotForm from '@/components/admin/SlotForm.vue'

type Slot = {
  id: string
  weekday: number
  start_time: string
  duration_min: number
  room: string | null
  status: 'active' | 'paused'
  instructor_status: 'confirmed' | 'tba'
  effective_from: string | null
  club: { id: string; name: string }
  class_template: { id: string; name: string; color: string }
  instructors: { id: string; name: string }[]
}

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const shell = ref<InstanceType<typeof AdminShell> | null>(null)
const result = ref<Paged<Slot> | null>(null)
const loading = ref(true)
const page = ref(1)
const query = ref('')
const club = ref('')
const clubs = ref<{ id: string; slug: string; name: string }[]>([])
const editing = ref<Slot | null>(null)
const formOpen = ref(false)
const banner = ref('')

adminList<{ id: string; slug: string; name: string }>('/admin/clubs', { limit: 100 }).then(
  (r) => (clubs.value = r.data),
)

async function load() {
  loading.value = true
  result.value = await adminList<Slot>('/admin/slots', {
    page: page.value,
    limit: 20,
    q: query.value || undefined,
    club: club.value || undefined,
  })
  loading.value = false
}

watch([page, query, club], load, { immediate: true })

function add() {
  editing.value = null
  formOpen.value = true
}

function edit(slot: Slot) {
  editing.value = slot
  formOpen.value = true
}

async function afterSave() {
  await load()
  await shell.value?.loadVersion()
}

async function duplicate(slot: Slot) {
  try {
    await adminFetch(`/admin/slots/${slot.id}/duplicate`, {
      method: 'POST',
      body: JSON.stringify({ weekday: slot.weekday, start_time: slot.start_time }),
    })
    await afterSave()
  } catch (err) {
    // Duplicating onto the same day always clashes — that is the point of the
    // guard, so say what to do rather than just failing.
    banner.value =
      err instanceof ApiError
        ? `${err.message}. Open the copy and move it to another day or time.`
        : 'Could not duplicate this class'
  }
}

async function remove(slot: Slot) {
  if (!confirm(`Delete ${slot.class_template.name} on ${DAY[slot.weekday]} ${slot.start_time}?`)) {
    return
  }
  try {
    await adminFetch(`/admin/slots/${slot.id}`, { method: 'DELETE' })
    await afterSave()
  } catch (err) {
    banner.value = err instanceof ApiError ? err.message : 'Could not delete this class'
  }
}

async function togglePause(slot: Slot) {
  await adminFetch(`/admin/slots/${slot.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: slot.status === 'active' ? 'paused' : 'active' }),
  })
  await afterSave()
}
</script>

<template>
  <AdminShell ref="shell">
    <div class="flex flex-wrap items-center gap-3">
      <h1 class="text-[20px] font-semibold text-ink">Schedule</h1>
      <button
        class="ml-auto rounded-lg bg-primary px-3.5 py-2 text-[14px] font-semibold text-white"
        @click="add"
      >
        Add class
      </button>
    </div>

    <div class="mt-4 flex flex-wrap gap-2">
      <select
        v-model="club"
        class="rounded-lg border border-line bg-surface px-3 py-2 text-[14px]"
        aria-label="Studio"
        @change="page = 1"
      >
        <option value="">All studios</option>
        <option v-for="c in clubs" :key="c.slug" :value="c.slug">{{ c.name }}</option>
      </select>
      <input
        v-model="query"
        type="search"
        placeholder="Search class or studio"
        aria-label="Search"
        class="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-[14px] lg:max-w-xs"
        @input="page = 1"
      />
    </div>

    <p v-if="banner" role="alert" class="mt-3 rounded-lg bg-[#FBEDED] px-3 py-2 text-[13px] text-[#8A2C2C]">
      {{ banner }}
      <button class="ml-2 underline" @click="banner = ''">Dismiss</button>
    </p>

    <div class="mt-4">
      <DataTable
        :rows="result?.data ?? []"
        :columns="[
          { key: 'day', label: 'Day' },
          { key: 'time', label: 'Time' },
          { key: 'class', label: 'Class' },
          { key: 'studio', label: 'Studio' },
          { key: 'instructor', label: 'Instructor' },
          { key: 'status', label: 'Status' },
        ]"
        :loading="loading"
        :total="result?.meta.total"
        :page="result?.meta.page"
        :limit="result?.meta.limit"
        empty-message="No classes match. Try a different studio or search."
        @change-page="page = $event"
      >
        <template #row="{ row }">
          <td class="px-4 py-2.5 text-ink-muted">{{ DAY[(row as Slot).weekday] }}</td>
          <td class="tnum px-4 py-2.5 text-ink">
            {{ (row as Slot).start_time }}
            <span class="text-ink-muted/60">· {{ (row as Slot).duration_min }}m</span>
          </td>
          <td class="px-4 py-2.5">
            <span class="inline-flex items-center gap-2">
              <span class="h-2 w-2 rounded-full" :style="{ background: (row as Slot).class_template.color }" />
              {{ (row as Slot).class_template.name }}
            </span>
          </td>
          <td class="px-4 py-2.5 text-ink-muted">{{ (row as Slot).club.name }}</td>
          <td class="px-4 py-2.5">
            <span v-if="(row as Slot).instructors.length" class="text-ink-muted">
              {{ (row as Slot).instructors.map((i) => i.name).join(', ') }}
            </span>
            <span v-else class="italic text-ink-muted/60">TBA</span>
          </td>
          <td class="px-4 py-2.5">
            <span
              class="rounded-full px-2 py-0.5 text-[12px]"
              :class="
                (row as Slot).status === 'active'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-bg text-ink-muted'
              "
            >
              {{ (row as Slot).status }}
            </span>
          </td>
          <td class="px-4 py-2.5 text-right">
            <div class="flex justify-end gap-2 text-[13px]">
              <button class="text-ink-muted hover:text-primary" @click="edit(row as Slot)">Edit</button>
              <button class="text-ink-muted hover:text-primary" @click="duplicate(row as Slot)">Copy</button>
              <button class="text-ink-muted hover:text-primary" @click="togglePause(row as Slot)">
                {{ (row as Slot).status === 'active' ? 'Pause' : 'Resume' }}
              </button>
              <button class="text-ink-muted hover:text-[#8A2C2C]" @click="remove(row as Slot)">Delete</button>
            </div>
          </td>
        </template>
      </DataTable>
    </div>

    <SlotForm :slot="editing" :open="formOpen" @close="formOpen = false" @saved="afterSave" />
  </AdminShell>
</template>
