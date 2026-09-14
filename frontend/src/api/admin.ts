import { ApiError } from './client'

const BASE = (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/$/, '')

function csrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)af_csrf=([^;]+)/)
  return match?.[1] ?? ''
}

/**
 * Admin calls always send cookies and, on mutations, the double-submit CSRF
 * header. Sign-in is the one mutation that does not — a first visit has no
 * token yet, so the server checks Origin there instead.
 */
export async function adminFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T | null> {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.method && init.method !== 'GET') {
    headers.set('Content-Type', 'application/json')
    const token = csrfToken()
    if (token) headers.set('X-CSRF-Token', token)
  }

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  })

  if (res.status === 204) return null
  const body = (await res.json().catch(() => null)) as
    | { data?: T; meta?: unknown; error?: { code: string; message: string; details?: unknown } }
    | null

  if (!res.ok) {
    throw new ApiError(
      body?.error?.message ?? `Request failed (${res.status})`,
      res.status,
      body?.error?.code,
    )
  }
  return (body?.data ?? body) as T
}

export type Paged<T> = { data: T[]; meta: { page: number; limit: number; total: number } }

export const adminList = <T>(path: string, params: Record<string, string | number | undefined> = {}) => {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, String(v))
  }
  return adminFetch<Paged<T>>(`${path}${qs.size ? `?${qs}` : ''}`) as Promise<Paged<T>>
}
