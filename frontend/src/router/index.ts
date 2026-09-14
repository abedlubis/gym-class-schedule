import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import { useAuth } from '@/composables/useAuth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'schedule', component: HomeView },
    { path: '/studios', name: 'studios', component: () => import('@/views/StudiosView.vue') },

    {
      path: '/admin/login',
      name: 'admin-login',
      component: () => import('@/views/admin/LoginView.vue'),
    },
    { path: '/admin', redirect: '/admin/slots' },
    {
      path: '/admin/slots',
      name: 'admin-slots',
      component: () => import('@/views/admin/SlotsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admin/instructors',
      name: 'admin-instructors',
      component: () => import('@/views/admin/InstructorsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admin/clubs',
      name: 'admin-clubs',
      component: () => import('@/views/admin/ClubsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admin/classes',
      name: 'admin-classes',
      component: () => import('@/views/admin/ClassTypesView.vue'),
      meta: { requiresAuth: true },
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

/**
 * Convenience only. The API re-checks the session on every /admin request, so
 * this guard decides what to render, never what is allowed.
 */
router.beforeEach(async (to) => {
  if (!to.meta.requiresAuth) return true
  const { user, checked, refresh } = useAuth()
  if (!checked.value) await refresh()
  if (user.value) return true
  return { name: 'admin-login', query: { next: to.fullPath } }
})

export default router
