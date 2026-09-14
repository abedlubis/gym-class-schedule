import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import type { MiddlewareHandler } from 'hono'
import { CSRF_COOKIE, CSRF_HEADER, SESSION_COOKIE, resolveSession } from '../services/auth.js'
import { timingSafeEqual } from '../lib/crypto.js'
import type { Env } from '../types.js'

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS'])

export function cookieOptions(maxAgeSeconds: number, httpOnly = true) {
  return {
    httpOnly,
    // SameSite=Lax plus an explicit Origin check. Strict would break the
    // ordinary case of following a link into the admin.
    sameSite: 'Lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSeconds,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function issueSessionCookies(c: any, token: string, csrf: string) {
  setCookie(c, SESSION_COOKIE, token, cookieOptions(7 * 24 * 3600))
  // The CSRF companion is deliberately readable by script — that is the whole
  // point of double-submit. It is not a credential on its own.
  setCookie(c, CSRF_COOKIE, csrf, cookieOptions(7 * 24 * 3600, false))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function clearSessionCookies(c: any) {
  deleteCookie(c, SESSION_COOKIE, { path: '/' })
  deleteCookie(c, CSRF_COOKIE, { path: '/' })
}

/**
 * Every /admin route re-checks the session server-side. The route guard in the
 * Vue app is UX; this is the security boundary.
 */
export const requireSession: MiddlewareHandler<Env> = async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE)
  if (!token) return unauthorized(c)

  const user = await resolveSession(c.var.db, token)
  if (!user) {
    clearSessionCookies(c)
    return unauthorized(c)
  }

  c.set('user', user)
  c.set('sessionToken', token)
  await next()
}

/**
 * Origin allowlist only.
 *
 * Used on sign-in, which cannot use double-submit: a first-time visitor has no
 * CSRF cookie yet, so requiring one makes logging in impossible. Login-CSRF is
 * covered by this Origin check plus SameSite=Lax on the cookies that get set.
 */
export const requireOrigin: MiddlewareHandler<Env> = async (c, next) => {
  if (SAFE.has(c.req.method)) return next()
  const origin = c.req.header('origin')
  const allowed = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
  if (origin && allowed.length && !allowed.includes(origin)) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Origin not allowed' } }, 403)
  }
  await next()
}

/** Double-submit token on every mutation that acts on an existing session. */
export const requireCsrf: MiddlewareHandler<Env> = async (c, next) => {
  if (SAFE.has(c.req.method)) return next()

  const origin = c.req.header('origin')
  const allowed = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
  if (origin && allowed.length && !allowed.includes(origin)) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Origin not allowed' } }, 403)
  }

  const header = c.req.header(CSRF_HEADER)
  const cookie = getCookie(c, CSRF_COOKIE)
  if (!header || !cookie || !timingSafeEqual(header, cookie)) {
    return c.json(
      { error: { code: 'FORBIDDEN', message: 'Missing or invalid CSRF token' } },
      403,
    )
  }
  await next()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function unauthorized(c: any) {
  return c.json({ error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }, 401)
}
