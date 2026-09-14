<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import { computed } from 'vue'

const route = useRoute()
const active = computed(() => route.name)

const TABS = [
  { name: 'schedule', to: '/', label: 'Schedule' },
  { name: 'studios', to: '/studios', label: 'Studios' },
] as const
</script>

<template>
  <div class="min-h-dvh pb-[calc(64px+env(safe-area-inset-bottom))] lg:pb-0">
    <header
      class="sticky top-0 z-30 border-b border-line/70 bg-surface/95 backdrop-blur"
    >
      <div class="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 lg:px-8">
        <RouterLink to="/" class="flex items-baseline gap-2">
          <span class="font-display text-[20px] font-bold tracking-tight text-wordmark">AF</span>
          <span class="text-[13px] font-medium text-ink-muted">Class Schedule</span>
        </RouterLink>

        <nav class="ml-auto hidden gap-1 lg:flex">
          <RouterLink
            v-for="tab in TABS"
            :key="tab.name"
            :to="tab.to"
            class="rounded-lg px-3 py-1.5 text-[14px] font-medium transition-colors"
            :class="
              active === tab.name
                ? 'bg-primary/10 text-primary'
                : 'text-ink-muted hover:text-ink'
            "
          >
            {{ tab.label }}
          </RouterLink>
        </nav>

        <slot name="header-actions" />
      </div>
      <slot name="header-extra" />
    </header>

    <main class="mx-auto max-w-6xl px-4 py-4 lg:px-8 lg:py-8">
      <slot />
    </main>

    <!-- Two tabs, not five. There is no profile and no saved list yet, and
         padding a nav bar with dead tabs is the fastest way to make a small app
         feel like a fake one. -->
    <nav
      class="fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      aria-label="Sections"
    >
      <div class="flex">
        <RouterLink
          v-for="tab in TABS"
          :key="tab.name"
          :to="tab.to"
          class="flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-medium transition-colors"
          :class="active === tab.name ? 'text-primary' : 'text-ink-muted/70'"
        >
          <span
            class="h-1 w-6 rounded-full transition-colors"
            :class="active === tab.name ? 'bg-primary' : 'bg-transparent'"
            aria-hidden="true"
          />
          {{ tab.label }}
        </RouterLink>
      </div>
    </nav>
  </div>
</template>
