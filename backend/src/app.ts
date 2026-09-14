import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { etag } from 'hono/etag'
import { publicRoutes } from './routes/public.js'
import { authRoutes } from './routes/auth.js'
import { adminRoutes } from './routes/admin.js'
import { DomainError } from './services/admin.js'
import { ZodError } from 'zod'
import type { Env } from './types.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createApp(db: any) {
  const app = new Hono<Env>()

  const origins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)

  app.use('*', secureHeaders())
  app.use('*', async (c, next) => {
    c.set('db', db)
    await next()
  })

  // Named origins only. The admin path sends credentials, so "*" is not an
  // option, and a permissive public rule would quietly become the admin rule.
  app.use(
    '/api/*',
    cors({
      origin: (origin) => (origins.includes(origin) ? origin : origins[0] ?? ''),
      credentials: true,
    }),
  )

  app.get('/health', async (c) => {
    try {
      await db.execute('select 1')
      return c.json({ status: 'ok' })
    } catch (err) {
      // Logged (message only, never the connection string) so a degraded
      // health check leaves a trace in Vercel's runtime logs instead of
      // failing silently.
      console.error(
        JSON.stringify({
          at: 'health-check',
          message: err instanceof Error ? err.message : String(err),
        }),
      )
      return c.json({ status: 'degraded' }, 503)
    }
  })

  // Public reads are immutable for a minute and revalidate cheaply. Once the
  // publish step lands (see design doc §4) the public app reads static JSON
  // and these endpoints only feed that render.
  app.use('/api/v1/*', etag())
  app.use('/api/v1/*', async (c, next) => {
    await next()
    if (c.req.method === 'GET') {
      c.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
    }
  })

  app.route('/api/v1', publicRoutes)
  app.route('/api/v1/auth', authRoutes)

  // Admin responses are never cached and never shared.
  app.use('/api/v1/admin/*', async (c, next) => {
    await next()
    c.header('Cache-Control', 'no-store')
  })
  app.route('/api/v1/admin', adminRoutes)

  app.notFound((c) =>
    c.json({ error: { code: 'NOT_FOUND', message: 'No such endpoint' } }, 404),
  )

  app.onError((err, c) => {
    if (err instanceof DomainError) {
      return c.json(
        { error: { code: err.code, message: err.message, details: err.details } },
        err.status as 400,
      )
    }
    if (err instanceof ZodError) {
      return c.json(
        {
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Check the highlighted fields',
            details: err.issues.map((i) => ({
              field: i.path.join('.'),
              issue: i.message,
            })),
          },
        },
        422,
      )
    }
    const ref = crypto.randomUUID()
    console.error(JSON.stringify({ ref, path: c.req.path, message: err.message }))
    return c.json(
      { error: { code: 'INTERNAL', message: 'Something went wrong', ref } },
      500,
    )
  })

  return app
}
