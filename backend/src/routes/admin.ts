import { Hono } from 'hono'
import { z } from 'zod'
import { requireCsrf, requireSession } from '../middleware/auth.js'
import * as svc from '../services/admin.js'
import type { Env } from '../types.js'

const uuid = z.string().uuid()
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const listQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  q: z.string().optional(),
  club: z.string().optional(),
  weekday: z.coerce.number().int().min(0).max(6).optional(),
  status: z.string().optional(),
  sort: z.string().optional(),
})

const slotBody = z.object({
  club_id: uuid,
  class_template_id: uuid,
  weekday: z.number().int().min(0).max(6),
  start_time: hhmm,
  duration_min: z.number().int().positive().max(300).optional(),
  room: z.string().max(60).nullable().optional(),
  instructor_ids: z.array(uuid).optional(),
  status: z.enum(['active', 'paused']).optional(),
  effective_from: isoDate.nullable().optional(),
  effective_to: isoDate.nullable().optional(),
  note: z.string().max(500).nullable().optional(),
})

export const adminRoutes = new Hono<Env>()

// Order matters: the session check runs before the CSRF check so an expired
// session reads as 401 rather than a confusing 403.
adminRoutes.use('*', requireSession)
adminRoutes.use('*', requireCsrf)

adminRoutes.get('/version', async (c) => c.json({ data: await svc.getVersion(c.var.db) }))
adminRoutes.post('/publish', async (c) => c.json({ data: await svc.markPublished(c.var.db) }))

/* ------------------------------------------------------------------- slots */

adminRoutes.get('/slots', async (c) =>
  c.json(await svc.listSlots(c.var.db, parseQuery(c))),
)

adminRoutes.post('/slots', async (c) => {
  const body = slotBody.parse(await c.req.json())
  return c.json({ data: await svc.createSlot(c.var.db, body) }, 201)
})

adminRoutes.patch('/slots/:id', async (c) => {
  const body = slotBody.partial().parse(await c.req.json())
  return c.json({ data: await svc.updateSlot(c.var.db, uuid.parse(c.req.param('id')), body) })
})

adminRoutes.post('/slots/:id/duplicate', async (c) => {
  const body = z
    .object({ weekday: z.number().int().min(0).max(6), start_time: hhmm })
    .parse(await c.req.json())
  return c.json(
    { data: await svc.duplicateSlot(c.var.db, uuid.parse(c.req.param('id')), body) },
    201,
  )
})

adminRoutes.delete('/slots/:id', async (c) => {
  await svc.deleteSlot(c.var.db, uuid.parse(c.req.param('id')))
  return c.body(null, 204)
})

/* ------------------------------------------------------------- instructors */

adminRoutes.get('/instructors', async (c) =>
  c.json(await svc.listInstructors(c.var.db, parseQuery(c))),
)

adminRoutes.post('/instructors', async (c) => {
  const body = z
    .object({ name: z.string().min(1).max(80), force: z.boolean().optional() })
    .parse(await c.req.json())
  return c.json({ data: await svc.createInstructor(c.var.db, body) }, 201)
})

adminRoutes.patch('/instructors/:id', async (c) => {
  const body = z
    .object({
      name: z.string().min(1).max(80).optional(),
      status: z.enum(['active', 'archived']).optional(),
    })
    .parse(await c.req.json())
  return c.json({
    data: await svc.updateInstructor(c.var.db, uuid.parse(c.req.param('id')), body),
  })
})

adminRoutes.delete('/instructors/:id', async (c) => {
  await svc.deleteInstructor(c.var.db, uuid.parse(c.req.param('id')))
  return c.body(null, 204)
})

/* ---------------------------------------------------------- reference data */

adminRoutes.get('/clubs', async (c) => c.json(await svc.listClubsAdmin(c.var.db, parseQuery(c))))

adminRoutes.patch('/clubs/:id', async (c) => {
  const body = (await c.req.json()) as Record<string, unknown>
  return c.json({ data: await svc.updateClub(c.var.db, uuid.parse(c.req.param('id')), body) })
})

adminRoutes.delete('/clubs/:id', async (c) => {
  await svc.deleteClub(c.var.db, uuid.parse(c.req.param('id')))
  return c.body(null, 204)
})

adminRoutes.get('/class-templates', async (c) =>
  c.json(await svc.listTemplates(c.var.db, parseQuery(c))),
)

adminRoutes.get('/categories', async (c) => c.json(await svc.listCategories(c.var.db)))

adminRoutes.patch('/categories/:id', async (c) => {
  const body = z
    .object({
      label: z.string().min(1).max(40).optional(),
      colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    })
    .parse(await c.req.json())
  return c.json({
    data: await svc.updateCategory(c.var.db, uuid.parse(c.req.param('id')), body),
  })
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseQuery(c: any) {
  return listQuery.parse(c.req.query())
}
