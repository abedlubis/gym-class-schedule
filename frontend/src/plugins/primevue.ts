import type { App } from 'vue'
import PrimeVue from 'primevue/config'

/**
 * PrimeVue in **unstyled** mode.
 *
 * Vuetify was the other option and was rejected: it is Material Design, so
 * adopting it means adopting Material's shapes, elevation and motion, and the
 * AF palette ends up fighting the theme on every surface. Unstyled PrimeVue
 * gives the opposite trade — we take the behaviour (focus traps, ARIA wiring,
 * keyboard handling, portal management) and keep every pixel of the existing
 * Tailwind design.
 *
 * The pass-through object below is the entire "theme". It is Tailwind classes
 * built from the same tokens as the rest of the app, so nothing new enters the
 * palette.
 */
const surface = 'bg-surface text-ink'
const line = 'border border-line'

export const pt = {
  dialog: {
    mask: 'fixed inset-0 z-40 bg-ink/40 backdrop-blur-[1px]',
    root: [
      'fixed z-50 flex flex-col bg-surface outline-none',
      'inset-x-0 bottom-0 max-h-[88dvh] rounded-t-3xl',
      'lg:inset-y-0 lg:left-auto lg:right-0 lg:max-h-none lg:w-[420px] lg:rounded-none lg:border-l lg:border-line',
    ].join(' '),
    header: 'hidden',
    content: 'flex-1 overflow-y-auto',
  },
  select: {
    root: `inline-flex items-center gap-2 rounded-lg ${line} ${surface} px-3 py-2 text-[14px] cursor-pointer data-[p-focus=true]:border-primary`,
    label: 'truncate',
    dropdown: 'ml-auto text-ink-muted',
    overlay: `z-50 mt-1 overflow-hidden rounded-xl ${line} ${surface} shadow-lg`,
    listContainer: 'max-h-72 overflow-y-auto',
    list: 'p-1',
    option: [
      'cursor-pointer rounded-lg px-3 py-2 text-[14px] text-ink',
      'data-[p-focus=true]:bg-bg data-[p-selected=true]:bg-primary/10 data-[p-selected=true]:text-primary',
    ].join(' '),
    pcFilterContainer: { root: 'p-2 pb-0' },
    pcFilter: {
      root: `w-full rounded-lg ${line} bg-bg px-3 py-2 text-[14px] text-ink outline-none focus:border-primary`,
    },
    emptyMessage: 'px-3 py-6 text-center text-[13px] text-ink-muted',
  },
  skeleton: {
    root: 'animate-pulse rounded-lg bg-line/40',
  },
}

export function installPrimeVue(app: App) {
  app.use(PrimeVue, {
    unstyled: true,
    pt,
    ripple: false,
    license: import.meta.env.VITE_PRIMEUI_LICENSE_KEY,
  })
}
