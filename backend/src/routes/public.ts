import { Hono } from 'hono'
import { z } from 'zod'
import { getFilters, getSchedule, listClubs } from '../services/schedule.js'
import { isIsoDate } from '../lib/week.js'
import type { Env } from '../types.js'

const querySchema = z.object({
  club: z.string().min(1).optional(),
  week: z.string().refine(isIsoDate, 'expected YYYY-MM-DD').optional(),
  status: z.enum(['open', 'presale', 'coming_soon', 'closed', 'all']).optional(),
})

export const publicRoutes = new Hono<Env>()

publicRoutes.get('/clubs', async (c) => {
  const parsed = querySchema.safeParse(c.req.query())
  if (!parsed.success) return badRequest(c, parsed.error)
  const data = await listClubs(c.var.db, { status: parsed.data.status })
  return c.json({ data, meta: { total: data.length } })
})

publicRoutes.get('/schedule', async (c) => {
  const parsed = querySchema.safeParse(c.req.query())
  if (!parsed.success) return badRequest(c, parsed.error)
  try {
    const result = await getSchedule(c.var.db, parsed.data)
    return c.json({ data: result, meta: { total: result.meta.class_count } })
  } catch (err) {
    if ((err as { status?: number }).status === 404) {
      return c.json(
        { error: { code: 'NOT_FOUND', message: (err as Error).message } },
        404,
      )
    }
    throw err
  }
})

publicRoutes.get('/filters', async (c) => {
  const parsed = querySchema.safeParse(c.req.query())
  if (!parsed.success) return badRequest(c, parsed.error)
  const data = await getFilters(c.var.db, parsed.data.club)
  return c.json({ data })
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function badRequest(c: any, error: z.ZodError) {
  return c.json(
    {
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Invalid query parameters',
        details: error.issues.map((i) => ({
          field: i.path.join('.'),
          issue: i.message,
        })),
      },
    },
    422,
  )
}
