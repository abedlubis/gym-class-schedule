<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue'
import type { ClassOccurrence, Club } from '@/types/schedule'
import { formatDayLabel, formatInstructors } from '@/utils/schedule'

const props = defineProps<{
  cls: ClassOccurrence | null
  club: Club | null
  alsoThisWeek: ClassOccurrence[]
}>()

const emit = defineEmits<{ close: []; open: [cls: ClassOccurrence] }>()

const instructors = computed(() => (props.cls ? formatInstructors(props.cls) : ''))

const instagramUrl = computed(() =>
  props.club?.instagram_handle
    ? `https://www.instagram.com/${props.club.instagram_handle}`
    : null,
)

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

watch(
  () => props.cls,
  (cls) => {
    document.body.style.overflow = cls ? 'hidden' : ''
    if (cls) window.addEventListener('keydown', onKeydown)
    else window.removeEventListener('keydown', onKeydown)
  },
)

onBeforeUnmount(() => {
  document.body.style.overflow = ''
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="cls" class="fixed inset-0 z-40 bg-ink/40" @click="$emit('close')" />
    </Transition>

    <Transition name="sheet">
      <div
        v-if="cls"
        role="dialog"
        aria-modal="true"
        :aria-label="cls.class_name"
        class="fixed z-50 flex flex-col bg-surface
               inset-x-0 bottom-0 max-h-[88vh] rounded-t-3xl
               lg:inset-y-0 lg:left-auto lg:right-0 lg:max-h-none lg:w-[420px] lg:rounded-none lg:border-l lg:border-line"
      >
        <div class="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-line lg:hidden" />

        <div class="overflow-y-auto px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4">
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
              class="ml-auto rounded-full px-2 py-1 text-[20px] leading-none text-ink-muted hover:text-ink"
              aria-label="Close"
              @click="$emit('close')"
            >
              ×
            </button>
          </div>

          <h2 class="mt-1 font-display text-[28px] font-bold leading-tight text-ink">
            {{ cls.class_name }}
          </h2>

          <p class="tnum mt-2 text-[15px] text-ink">
            {{ formatDayLabel(cls.date) }} · {{ cls.start_time }}–{{ cls.end_time }}
          </p>
          <p
            class="mt-0.5 text-[14px]"
            :class="cls.instructor_status === 'tba' ? 'italic text-ink-muted/60' : 'text-ink-muted'"
          >
            {{ instructors }}
          </p>

          <div class="mt-5 border-t border-line/60 pt-4">
            <p class="text-[15px] font-semibold text-ink">{{ cls.club.name }}</p>
            <p v-if="club" class="mt-0.5 text-[13px] text-ink-muted">
              {{ club.region }}, {{ club.city }}
            </p>
            <a
              v-if="instagramUrl"
              :href="instagramUrl"
              target="_blank"
              rel="noopener"
              class="mt-3 inline-flex rounded-lg border border-line px-3 py-2 text-[13px] font-medium text-ink hover:border-primary hover:text-primary"
            >
              Open the studio on Instagram
            </a>
          </div>

          <div v-if="alsoThisWeek.length" class="mt-5 border-t border-line/60 pt-4">
            <p class="text-[13px] font-semibold text-ink">
              {{ cls.class_name }} also runs this week
            </p>
            <div class="mt-2 flex flex-wrap gap-1.5">
              <button
                v-for="other in alsoThisWeek"
                :key="other.id"
                class="tnum rounded-lg bg-bg px-2.5 py-1.5 text-[12px] text-ink-muted hover:text-ink"
                @click="$emit('open', other)"
              >
                {{ formatDayLabel(other.date).split(',')[0] }} {{ other.start_time }}
              </button>
            </div>
          </div>

          <!-- Provenance sits where someone decides whether to trust a time, not
               buried in a footer. Showing up to an empty studio is the one
               failure this app cannot recover from. -->
          <div class="mt-5 border-t border-line/60 pt-4 text-[12px] leading-relaxed text-ink-muted/80">
            <p>
              Taken from {{ cls.club.name }}'s own timetable post.
              <template v-if="club?.schedule_effective_from">
                Effective {{ club.schedule_effective_from }}.
              </template>
            </p>
            <p v-if="club?.schedule_stale" class="mt-1.5 font-medium text-[#9A5B00]">
              This club has not published a new timetable in a while — check their
              Instagram before travelling.
            </p>
            <p v-if="club?.data_gap_note" class="mt-1.5">{{ club.data_gap_note }}</p>
            <p v-if="cls.duration_source === 'assumed'" class="mt-1.5">
              Duration is not printed on the timetable; 60 minutes assumed.
            </p>
            <p v-if="cls.note" class="mt-1.5">{{ cls.note }}</p>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from,
.fade-leave-to { opacity: 0; }

.sheet-enter-active,
.sheet-leave-active { transition: transform 0.26s cubic-bezier(0.32, 0.72, 0, 1); }
.sheet-enter-from,
.sheet-leave-to { transform: translateY(100%); }

@media (min-width: 1024px) {
  .sheet-enter-from,
  .sheet-leave-to { transform: translateX(100%); }
}
</style>
