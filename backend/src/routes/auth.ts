import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { z } from 'zod'
import { RateLimiter } from '../lib/rate-limit.js'
import { login, logout, SESSION_COOKIE } from '../services/auth.js'
import {
  clearSessionCookies,
  issueSessionCookies,
  requireCsrf,
  requireOrigin,
  requireSession,
} from '../middleware/auth.js'
import type { Env } from '../types.js'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

// 5 attempts per 15 minutes, keyed on IP + email so one attacker cannot lock
// out the real owner by hammering their address from elsewhere.
const limiter = new RateLimiter(5, 15 * 60 * 1000)

export const authRoutes = new Hono<Env>()

authRoutes.post('/login', requireOrigin, async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      { error: { code: 'VALIDATION_FAILED', message: 'Email and password are required' } },
      422,
    )
  }

  const ip =
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? c.req.header('x-real-ip') ?? 'local'
  const key = `${ip}:${parsed.data.email.toLowerCase()}`
  const { allowed, retryAfter } = limiter.check(key)
  if (!allowed) {
    c.header('Retry-After', String(retryAfter))
    return c.json(
      { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Try again later.' } },
      429,
    )
  }

  const result = await login(c.var.db, {
    email: parsed.data.email,
    password: parsed.data.password,
    userAgent: c.req.header('user-agent'),
    ip,
  })

  // One message for every failure mode — wrong email, wrong password, disabled
  // account. Anything more specific turns this into an account enumerator.
  if (!result) {
    return c.json(
      { error: { code: 'UNAUTHORIZED', message: 'Email or password is incorrect' } },
      401,
    )
  }

  limiter.reset(key)
  issueSessionCookies(c, result.token, result.csrf)
  return c.json({ data: result.user })
})

authRoutes.post('/logout', requireCsrf, async (c) => {
  const token = getCookie(c, SESSION_COOKIE)
  if (token) await logout(c.var.db, token)
  clearSessionCookies(c)
  return c.json({ data: { ok: true } })
})

authRoutes.get('/me', requireSession, (c) => c.json({ data: c.var.user }))
