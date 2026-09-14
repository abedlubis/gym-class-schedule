<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { adminFetch } from '@/api/admin'
import { useAuth } from '@/composables/useAuth'

const route = useRoute()
const router = useRouter()
const { user, signOut } = useAuth()

const version = ref<{ unpublished: number } | null>(null)
const publishing = ref(false)
const published = ref(false)

const NAV = [
  { to: '/admin/slots', label: 'Schedule' },
  { to: '/admin/instructors', label: 'Instructors' },
  { to: '/admin/clubs', label: 'Studios' },
  { to: '/admin/classes', label: 'Class types' },
]

async function loadVersion() {
  version.value = await adminFetch<{ unpublished: number }>('/admin/version').catch(() => null)
}

async function publish() {
  publishing.value = true
  await adminFetch('/admin/publish', { method: 'POST' }).catch(() => {})
  await loadVersion()
  publishing.value = false
  published.value = true
  setTimeout(() => (published.value = false), 2500)
}

async function leave() {
  await signOut()
  router.replace('/admin/login')
}

onMounted(loadVersion)
defineExpose({ loadVersion })
</script>

<template>
  <div class="flex min-h-dvh">
    <aside class="hidden w-56 shrink-0 border-r border-line/70 bg-surface p-4 lg:block">
      <p class="font-display text-[18px] font-bold text-wordmark">AF</p>
      <p class="text-[12px] text-ink-muted">Schedule admin</p>

      <nav class="mt-5 space-y-0.5">
        <RouterLink
          v-for="item in NAV"
          :key="item.to"
          :to="item.to"
          class="block rounded-lg px-3 py-2 text-[14px] font-medium transition-colors"
          :class="
            route.path.startsWith(item.to)
              ? 'bg-primary/10 text-primary'
              : 'text-ink-muted hover:text-ink'
          "
        >
          {{ item.label }}
        </RouterLink>
      </nav>

      <!-- Always visible. A schedule edit that was never published is the most
           likely way this whole system fails silently. -->
      <div class="mt-6 rounded-xl bg-bg p-3">
        <p class="text-[12px] text-ink-muted">
          <template v-if="version?.unpublished">
            {{ version.unpublished }} change{{ version.unpublished === 1 ? '' : 's' }}
            not published yet
          </template>
          <template v-else-if="published">Published.</template>
          <template v-else>Everything is published.</template>
        </p>
        <button
          v-if="version?.unpublished"
          :disabled="publishing"
          class="mt-2 w-full rounded-lg bg-primary py-1.5 text-[13px] font-semibold text-white disabled:opacity-60"
          @click="publish"
        >
          {{ publishing ? 'Publishing…' : 'Publish' }}
        </button>
      </div>

      <div class="mt-6 border-t border-line/70 pt-3 text-[12px] text-ink-muted">
        <p class="truncate">{{ user?.email }}</p>
        <button class="mt-1 underline underline-offset-2 hover:text-ink" @click="leave">
          Sign out
        </button>
      </div>
    </aside>

    <div class="min-w-0 flex-1">
      <header class="flex items-center gap-3 border-b border-line/70 bg-surface px-4 py-3 lg:hidden">
        <RouterLink
          v-for="item in NAV"
          :key="item.to"
          :to="item.to"
          class="text-[13px] font-medium"
          :class="route.path.startsWith(item.to) ? 'text-primary' : 'text-ink-muted'"
        >
          {{ item.label }}
        </RouterLink>
        <button class="ml-auto text-[13px] text-ink-muted underline" @click="leave">
          Sign out
        </button>
      </header>

      <main class="p-4 lg:p-8"><slot /></main>
    </div>
  </div>
</template>
