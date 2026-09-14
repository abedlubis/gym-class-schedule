<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { fetchClubs } from '@/api/schedule'
import type { Club } from '@/types/schedule'
import AppShell from '@/components/app/AppShell.vue'

const router = useRouter()
const clubs = ref<Club[]>([])
const query = ref('')
const loading = ref(true)

fetchClubs()
  .then((c) => (clubs.value = c))
  .catch(() => {})
  .finally(() => (loading.value = false))

const grouped = computed(() => {
  const q = query.value.trim().toLowerCase()
  const matched = q
    ? clubs.value.filter((c) =>
        `${c.name} ${c.city} ${c.region}`.toLowerCase().includes(q),
      )
    : clubs.value
  const byRegion = new Map<string, Club[]>()
  for (const c of matched) {
    if (!byRegion.has(c.region)) byRegion.set(c.region, [])
    byRegion.get(c.region)!.push(c)
  }
  return [...byRegion.entries()]
})

function open(club: Club) {
  router.push({ path: '/', query: { club: club.slug } })
}
</script>

<template>
  <AppShell>
    <h1 class="font-display text-[26px] font-bold text-ink">Studios</h1>
    <p class="mt-1 max-w-[50ch] text-[14px] text-ink-muted">
      Every Anytime Fitness club in Indonesia, grouped by area. Pick one to see
      its week.
    </p>

    <input
      v-model="query"
      type="search"
      placeholder="Search by club or area"
      aria-label="Search studios"
      class="mt-4 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-muted/50 focus:border-primary focus:outline-none lg:max-w-sm"
    />

    <div v-if="loading" class="mt-6 space-y-2">
      <div v-for="i in 8" :key="i" class="h-14 animate-pulse rounded-xl bg-surface/70" />
    </div>

    <div v-else class="mt-6 space-y-7">
      <section v-for="[region, list] in grouped" :key="region">
        <h2 class="font-display text-[13px] font-bold uppercase tracking-wide text-ink-muted">
          {{ region }}
        </h2>
        <ul class="mt-2 divide-y divide-line/50 overflow-hidden rounded-[--radius-card] bg-surface">
          <li v-for="club in list" :key="club.slug">
            <button
              class="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-bg/60"
              @click="open(club)"
            >
              <div class="min-w-0 flex-1">
                <p class="truncate text-[15px] font-semibold text-ink">{{ club.name }}</p>
                <p class="tnum mt-0.5 text-[12px] text-ink-muted">
                  <template v-if="club.class_count">
                    {{ club.class_count }} classes a week
                  </template>
                  <template v-else>
                    No schedule yet — know it? Send it over.
                  </template>
                  <template v-if="club.schedule_stale"> · may be out of date</template>
                </p>
              </div>
              <span class="text-ink-muted/40" aria-hidden="true">›</span>
            </button>
          </li>
        </ul>
      </section>

      <p v-if="!grouped.length" class="text-[14px] text-ink-muted">
        No studio matches “{{ query }}”.
      </p>
    </div>
  </AppShell>
</template>
