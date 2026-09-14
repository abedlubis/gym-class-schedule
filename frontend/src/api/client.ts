const BASE = (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

interface Envelope<T> {
  data: T
  error?: { code: string; message: string }
}

export async function apiGet<T>(
  path: string,
  params: Record<string, string | undefined> = {},
  signal?: AbortSignal,
): Promise<T> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v)
  const url = `${BASE}${path}${qs.size ? `?${qs}` : ''}`

  let res: Response
  try {
    res = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err
    throw new ApiError('Could not reach the schedule service', 0)
  }

  const body = (await res.json().catch(() => null)) as Envelope<T> | null
  if (!res.ok || !body) {
    throw new ApiError(
      body?.error?.message ?? `Request failed (${res.status})`,
      res.status,
      body?.error?.code,
    )
  }
  return body.data
}
