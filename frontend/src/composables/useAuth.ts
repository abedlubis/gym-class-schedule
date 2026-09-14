import { readonly, ref } from 'vue'
import { adminFetch } from '@/api/admin'
import { ApiError } from '@/api/client'

export type AdminUser = { id: string; email: string; name: string | null; role: string }

// Module-level state: one session per tab, shared by every admin screen.
const user = ref<AdminUser | null>(null)
const checked = ref(false)

export function useAuth() {
  async function refresh() {
    try {
      user.value = await adminFetch<AdminUser>('/auth/me')
    } catch {
      user.value = null
    } finally {
      checked.value = true
    }
    return user.value
  }

  async function signIn(email: string, password: string) {
    try {
      user.value = await adminFetch<AdminUser>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      return { ok: true as const }
    } catch (err) {
      // The server returns one message for every failure. Passing it straight
      // through keeps the UI from accidentally becoming more specific.
      return {
        ok: false as const,
        message:
          err instanceof ApiError ? err.message : 'Could not reach the sign-in service',
      }
    }
  }

  async function signOut() {
    await adminFetch('/auth/logout', { method: 'POST' }).catch(() => {})
    user.value = null
  }

  return { user: readonly(user), checked: readonly(checked), refresh, signIn, signOut }
}
