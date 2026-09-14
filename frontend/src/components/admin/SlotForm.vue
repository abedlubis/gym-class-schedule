<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { adminFetch, adminList } from '@/api/admin'
import { ApiError } from '@/api/client'

type Option = { id: string; name: string }
type ClubOption = Option & { slug: string }
type Slot = {
  id: string
  weekday: number
  start_time: string
  duration_min: number
  room: string | null
  status: 'active' | 'paused'
  effective_from: string | null
  club: { id: string; name: string }
  class_template: { id: string; name: string }
  instructors: Option[]
}

const props = defineProps<{ slot: Slot | null; open: boolean }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const DAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
]

const clubs = ref<ClubOption[]>([])
const templates = ref<(Option & { defaultDurationMin: number })[]>([])
const instructors = ref<Option[]>([])
const error = ref('')
const busy = ref(false)

const form = ref({
  club_id: '',
  class_template_id: '',
  weekday: 1,
  start_time: '07:00',
  duration_min: 60,
  room: '',
  status: 'active' as 'active' | 'paused',
  effective_from: '',
  instructor_ids: [] as string[],
})

adminList<ClubOption>('/admin/clubs', { limit: 100 }).then((r) => {
  clubs.value = r.data
  // The slot/create watcher below may already have set club_id before this
  // resolves; make sure the instructor list catches up once clubs are known.
  if (form.value.club_id) loadInstructors(form.value.club_id)
})
adminList<Option & { defaultDurationMin: number }>('/admin/class-templates', {
  limit: 100,
}).then((r) => (templates.value = r.data))

/**
 * Instructors teach at a handful of clubs (see instructor_clubs), so the
 * picker is scoped per club instead of showing all ~477 names. Stale
 * selections from a previous club are dropped since they wouldn't apply here.
 */
async function loadInstructors(clubId: string) {
  const club = clubs.value.find((c) => c.id === clubId)
  if (!club) return
  const r = await adminList<Option>('/admin/instructors', { limit: 100, club: club.slug })
  instructors.value = r.data
  const valid = new Set(r.data.map((i) => i.id))
  form.value.instructor_ids = form.value.instructor_ids.filter((id) => valid.has(id))
}

watch(
  () => form.value.club_id,
  (clubId) => {
    if (clubId) loadInstructors(clubId)
  },
)

watch(
  () => props.slot,
  (slot) => {
    error.value = ''
    form.value = slot
      ? {
          club_id: slot.club.id,
          class_template_id: slot.class_template.id,
          weekday: slot.weekday,
          start_time: slot.start_time,
          duration_min: slot.duration_min,
          room: slot.room ?? '',
          status: slot.status,
          effective_from: slot.effective_from ?? '',
          instructor_ids: slot.instructors.map((i) => i.id),
        }
      : {
          club_id: clubs.value[0]?.id ?? '',
          class_template_id: '',
          weekday: 1,
          start_time: '07:00',
          duration_min: 60,
          room: '',
          status: 'active',
          effective_from: '',
          instructor_ids: [],
        }
  },
  { immediate: true },
)

const isTba = computed(() => form.value.instructor_ids.length === 0)

async function save() {
  busy.value = true
  error.value = ''
  const payload = {
    ...form.value,
    room: form.value.room || null,
    effective_from: form.value.effective_from || null,
  }
  try {
    if (props.slot) {
      await adminFetch(`/admin/slots/${props.slot.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
    } else {
      await adminFetch('/admin/slots', { method: 'POST', body: JSON.stringify(payload) })
    }
    emit('saved')
    emit('close')
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Could not save this class'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-40 bg-ink/40" @click="$emit('close')" />
    <div
      v-if="open"
      role="dialog"
      aria-modal="true"
      aria-label="Class details"
      class="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-surface shadow-xl"
    >
      <header class="flex items-center justify-between border-b border-line/70 px-5 py-3">
        <h2 class="text-[16px] font-semibold text-ink">
          {{ slot ? 'Edit class' : 'Add class' }}
        </h2>
        <button class="text-[20px] leading-none text-ink-muted" aria-label="Close" @click="$emit('close')">
          ×
        </button>
      </header>

      <div class="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <label class="block">
          <span class="mb-1 block text-[13px] font-medium text-ink-muted">Studio</span>
          <select v-model="form.club_id" class="w-full rounded-lg border border-line bg-bg px-3 py-2 text-[14px]">
            <option v-for="c in clubs" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </label>

        <label class="block">
          <span class="mb-1 block text-[13px] font-medium text-ink-muted">Class</span>
          <select
            v-model="form.class_template_id"
            class="w-full rounded-lg border border-line bg-bg px-3 py-2 text-[14px]"
          >
            <option value="" disabled>Pick a class</option>
            <option v-for="t in templates" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>
        </label>

        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="mb-1 block text-[13px] font-medium text-ink-muted">Day</span>
            <select v-model.number="form.weekday" class="w-full rounded-lg border border-line bg-bg px-3 py-2 text-[14px]">
              <option v-for="d in DAYS" :key="d.value" :value="d.value">{{ d.label }}</option>
            </select>
          </label>
          <label class="block">
            <span class="mb-1 block text-[13px] font-medium text-ink-muted">Starts</span>
            <input v-model="form.start_time" type="time" class="tnum w-full rounded-lg border border-line bg-bg px-3 py-2 text-[14px]" />
          </label>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="mb-1 block text-[13px] font-medium text-ink-muted">Minutes</span>
            <input v-model.number="form.duration_min" type="number" min="5" max="300" class="tnum w-full rounded-lg border border-line bg-bg px-3 py-2 text-[14px]" />
          </label>
          <label class="block">
            <span class="mb-1 block text-[13px] font-medium text-ink-muted">Room</span>
            <input v-model="form.room" placeholder="Optional" class="w-full rounded-lg border border-line bg-bg px-3 py-2 text-[14px]" />
          </label>
        </div>

        <fieldset>
          <legend class="mb-1 text-[13px] font-medium text-ink-muted">Instructors</legend>
          <div class="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-line bg-bg p-2">
            <label
              v-for="i in instructors"
              :key="i.id"
              class="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-[14px] hover:bg-surface"
            >
              <input v-model="form.instructor_ids" type="checkbox" :value="i.id" class="accent-[--color-primary]" />
              {{ i.name }}
            </label>
          </div>
          <p v-if="isTba" class="mt-1 text-[12px] text-ink-muted">
            No instructor selected — this class will show as “Instructor TBA”, which
            is a normal state, not an error.
          </p>
        </fieldset>

        <label class="block">
          <span class="mb-1 block text-[13px] font-medium text-ink-muted">Effective from</span>
          <input v-model="form.effective_from" type="date" class="tnum w-full rounded-lg border border-line bg-bg px-3 py-2 text-[14px]" />
        </label>

        <fieldset>
          <legend class="mb-1 text-[13px] font-medium text-ink-muted">Status</legend>
          <div class="flex gap-2">
            <button
              v-for="option in (['active', 'paused'] as const)"
              :key="option"
              type="button"
              class="flex-1 rounded-lg px-3 py-2 text-[13px] font-medium capitalize"
              :class="form.status === option ? 'bg-primary text-white' : 'bg-bg text-ink-muted'"
              @click="form.status = option"
            >
              {{ option }}
            </button>
          </div>
        </fieldset>

        <p v-if="error" role="alert" class="rounded-lg bg-[#FBEDED] px-3 py-2 text-[13px] text-[#8A2C2C]">
          {{ error }}
        </p>
      </div>

      <footer class="flex gap-2 border-t border-line/70 px-5 py-3">
        <button class="flex-1 rounded-lg border border-line py-2.5 text-[14px] font-medium text-ink" @click="$emit('close')">
          Cancel
        </button>
        <button
          :disabled="busy || !form.class_template_id"
          class="flex-1 rounded-lg bg-primary py-2.5 text-[14px] font-semibold text-white disabled:opacity-60"
          @click="save"
        >
          {{ busy ? 'Saving…' : 'Save class' }}
        </button>
      </footer>
    </div>
  </Teleport>
</template>
