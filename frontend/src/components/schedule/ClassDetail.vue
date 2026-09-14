<script setup lang="ts">
import { computed } from 'vue'
import Dialog from 'primevue/dialog'
import type { ClassOccurrence, Club } from '@/types/schedule'
import { formatDayLabel, formatInstructors, shortClubName } from '@/utils/schedule'

const props = defineProps<{
  cls: ClassOccurrence | null
  club: Club | null
  alsoThisWeek: ClassOccurrence[]
}>()

const emit = defineEmits<{ close: []; open: [cls: ClassOccurrence] }>()

/**
 * PrimeVue's Dialog rather than a hand-rolled teleport. It brings the parts
 * that are tedious and easy to get subtly wrong — focus trap, focus restore on
 * close, `aria-modal`, Escape handling, scroll lock, z-index stacking — while
 * every visual decision still comes from the pass-through classes in
 * plugins/primevue.ts.
 */
const visible = computed({
  get: () => props.cls !== null,
  set: (v: boolean) => {
    if (!v) emit('close')
  },
})

const instructors = computed(() => (props.cls ? formatInstructors(props.cls) : ''))

const instagramUrl = computed(() =>
  props.club?.instagram_handle
    ? `https://www.instagram.com/${props.club.instagram_handle}`
    : null,
)
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    dismissable-mask
    :draggable="false"
    :aria-label="cls?.class_name ?? 'Class details'"
  >
    <div v-if="cls" class="px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4">
      <div class="mx-auto mb-4 h-1 w-10 rounded-full bg-line lg:hidden" />

      <div class="flex items-center gap-2">
        <span
          class="h-2.5 w-2.5 rounded-full"
          :style="{ background: cls.category.color }"
          aria-hidden="true"
        />
        <span class="text-[13px] text-accent">{{ cls.category.label }}</span>
        <span
          v-if="cls.programme"
          class="rounded-full bg-primary/8 px-2 py-0.5 text-[11px] font-medium text-primary"
        >
          {{ cls.programme }}
        </span>
        <button
          class="ml-auto cursor-pointer rounded-full px-2 py-1 text-[20px] leading-none text-ink-muted hover:text-ink"
          aria-label="Close"
          @click="emit('close')"
        >
          ×
        </button>
      </div>

      <h2 class="mt-1 font-display text-[28px] font-bold leading-tight text-ink">
        {{ cls.class_name }}
      </h2>

      <dl class="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[14px]">
        <dt class="text-ink-muted">When</dt>
        <dd class="tnum text-ink">
          {{ formatDayLabel(cls.date) }}, {{ cls.start_time }}–{{ cls.end_time }}
        </dd>

        <dt class="text-ink-muted">Duration</dt>
        <dd class="tnum text-ink">{{ cls.duration_min }} minutes</dd>

        <dt class="text-ink-muted">Instructor</dt>
        <dd :class="cls.instructor_status === 'tba' ? 'italic text-ink-muted' : 'text-ink'">
          {{ instructors }}
        </dd>

        <dt class="text-ink-muted">Studio</dt>
        <dd class="text-ink">
          {{ shortClubName(cls.club.name) }}
          <span v-if="club" class="block text-[13px] text-ink-muted">
            {{ club.region }}, {{ club.city }}
          </span>
        </dd>
      </dl>

      <a
        v-if="instagramUrl"
        :href="instagramUrl"
        target="_blank"
        rel="noopener"
        class="mt-4 inline-flex cursor-pointer rounded-lg border border-line px-3 py-2 text-[13px] font-medium text-ink hover:border-primary hover:text-primary"
      >
        Open the studio on Instagram
      </a>

      <div v-if="alsoThisWeek.length" class="mt-5 border-t border-line/60 pt-4">
        <p class="text-[13px] font-semibold text-ink">
          {{ cls.class_name }} also runs this week
        </p>
        <div class="mt-2 flex flex-wrap gap-1.5">
          <button
            v-for="other in alsoThisWeek"
            :key="other.id"
            class="tnum cursor-pointer rounded-lg bg-bg px-2.5 py-1.5 text-[12px] text-ink-muted hover:text-ink"
            @click="emit('open', other)"
          >
            {{ formatDayLabel(other.date).split(',')[0] }} {{ other.start_time }}
          </button>
        </div>
      </div>

      <!-- Provenance sits where someone decides whether to trust a time.
           Showing up to an empty studio is the failure this app cannot recover
           from. -->
      <div class="mt-5 border-t border-line/60 pt-4 text-[12px] leading-relaxed text-ink-muted/80">
        <p>
          Taken from {{ shortClubName(cls.club.name) }}'s own timetable post.
          <template v-if="club?.schedule_effective_from">
            Effective {{ club.schedule_effective_from }}.
          </template>
        </p>
        <p v-if="club?.schedule_stale" class="mt-1.5 font-medium text-[#9A5B00]">
          This studio has not published a new timetable in a while — check their
          Instagram before travelling.
        </p>
        <p v-if="club?.data_gap_note" class="mt-1.5">{{ club.data_gap_note }}</p>
        <p v-if="cls.duration_source === 'assumed'" class="mt-1.5">
          Duration is not printed on the timetable; 60 minutes assumed.
        </p>
        <p v-if="cls.note" class="mt-1.5">{{ cls.note }}</p>
      </div>
    </div>
  </Dialog>
</template>
