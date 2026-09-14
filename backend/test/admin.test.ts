import { beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { createAdmin } from '../src/services/auth.js'
import { getVersion } from '../src/services/admin.js'
import { seededDb } from './helpers.js'

let db: Awaited<ReturnType<typeof seededDb>>['db']
let app: ReturnType<typeof createApp>

const EMAIL = 'owner@example.test'
const PASSWORD = 'correct-horse-battery'

/** Cookies survive between calls the way a browser would keep them. */
class Agent {
  cookies = new Map<string, string>()
  constructor(private app: ReturnType<typeof createApp>) {}

  get csrf() {
    return this.cookies.get('af_csrf') ?? ''
  }

  async request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers)
    if (this.cookies.size) {
      headers.set(
        'cookie',
        [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
      )
    }
    if (init.method && init.method !== 'GET') {
      headers.set('content-type', 'application/json')
      if (this.csrf) headers.set('x-csrf-token', this.csrf)
    }
    const res = await this.app.request(path, { ...init, headers })
    for (const raw of res.headers.getSetCookie?.() ?? []) {
      const [pair] = raw.split(';')
      const [k, v] = pair!.split('=')
      if (v === '' || raw.includes('Max-Age=0')) this.cookies.delete(k!)
      else this.cookies.set(k!, v!)
    }
    return res
  }
}

beforeAll(async () => {
  ;({ db } = await seededDb())
  app = createApp(db)
  await createAdmin(db as never, { email: EMAIL, password: PASSWORD })
}, 180_000)

describe('auth', () => {
  it('rejects a wrong password with the same message as an unknown email', async () => {
    const a = new Agent(app)
    await a.request('/api/v1/auth/me')
    const wrongPw = await a.request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: EMAIL, password: 'nope' }),
    })
    const noUser = await a.request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'ghost@example.test', password: 'nope' }),
    })
    expect(wrongPw.status).toBe(401)
    expect(noUser.status).toBe(401)
    const [a1, b1] = await Promise.all([wrongPw.json(), noUser.json()])
    expect((a1 as { error: { message: string } }).error.message).toBe(
      (b1 as { error: { message: string } }).error.message,
    )
  })

  it('refuses the admin API without a session', async () => {
    expect((await app.request('/api/v1/admin/slots')).status).toBe(401)
    expect((await app.request('/api/v1/auth/me')).status).toBe(401)
  })

  it('signs in and out', async () => {
    const a = new Agent(app)
    const res = await a.request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    })
    expect(res.status).toBe(200)
    expect(a.cookies.get('af_session')).toBeTruthy()
    expect(a.cookies.get('af_csrf')).toBeTruthy()

    expect((await a.request('/api/v1/auth/me')).status).toBe(200)
    await a.request('/api/v1/auth/logout', { method: 'POST' })
    expect(a.cookies.get('af_session')).toBeUndefined()
    expect((await a.request('/api/v1/auth/me')).status).toBe(401)
  })

  it('rejects a mutation with no CSRF header even with a valid session', async () => {
    const a = new Agent(app)
    await a.request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    })
    const res = await app.request('/api/v1/admin/instructors', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `af_session=${a.cookies.get('af_session')}`,
      },
      body: JSON.stringify({ name: 'Sneaky' }),
    })
    expect(res.status).toBe(403)
  })

  it('rate limits repeated failures', async () => {
    const a = new Agent(app)
    let last = 0
    for (let i = 0; i < 8; i++) {
      const res = await a.request('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'brute@example.test', password: `x${i}` }),
      })
      last = res.status
    }
    expect(last).toBe(429)
  })
})

describe('admin CRUD', () => {
  let a: Agent

  beforeAll(async () => {
    a = new Agent(app)
    await a.request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    })
  })

  const json = async (path: string, init?: RequestInit) => {
    const res = await a.request(path, init)
    return { status: res.status, body: res.status === 204 ? null : await res.json() }
  }

  it('lists slots with paging and a club filter', async () => {
    const all = await json('/api/v1/admin/slots?limit=5')
    expect(all.status).toBe(200)
    expect((all.body as { data: unknown[] }).data).toHaveLength(5)
    expect((all.body as { meta: { total: number } }).meta.total).toBeGreaterThan(900)

    const one = await json('/api/v1/admin/slots?club=setiabudi-one&limit=100')
    expect((one.body as { meta: { total: number } }).meta.total).toBe(22)
  })

  it('caps limit at 100 however much is asked for', async () => {
    const res = await json('/api/v1/admin/slots?limit=9999')
    expect((res.body as { data: unknown[] }).data.length).toBeLessThanOrEqual(100)
  })

  it('warns instead of silently merging a duplicate instructor nickname', async () => {
    const res = await json('/api/v1/admin/instructors', {
      method: 'POST',
      body: JSON.stringify({ name: 'Ilanda' }),
    })
    expect(res.status).toBe(409)
    const body = res.body as { error: { code: string; details: { clubs: string[] } } }
    expect(body.error.code).toBe('DUPLICATE_INSTRUCTOR')
    expect(body.error.details.clubs.length).toBeGreaterThan(0)
  })

  it('creates the instructor anyway when told it is the same person', async () => {
    const res = await json('/api/v1/admin/instructors', {
      method: 'POST',
      body: JSON.stringify({ name: 'Ilanda', force: true }),
    })
    expect(res.status).toBe(201)
  })

  it('refuses to delete an instructor who still teaches', async () => {
    const list = await json('/api/v1/admin/instructors?q=Ilanda')
    const busy = (list.body as { data: { id: string; slot_count: number }[] }).data.find(
      (i) => i.slot_count > 0,
    )!
    const res = await json(`/api/v1/admin/instructors/${busy.id}`, { method: 'DELETE' })
    expect(res.status).toBe(409)
  })

  it('rejects a slot that clashes with an existing one', async () => {
    const list = await json('/api/v1/admin/slots?club=setiabudi-one&limit=1')
    const slot = (list.body as { data: Record<string, never>[] }).data[0] as unknown as {
      club: { id: string }
      class_template: { id: string }
      weekday: number
      start_time: string
    }
    const res = await json('/api/v1/admin/slots', {
      method: 'POST',
      body: JSON.stringify({
        club_id: slot.club.id,
        class_template_id: slot.class_template.id,
        weekday: slot.weekday,
        start_time: slot.start_time,
      }),
    })
    expect(res.status).toBe(409)
    expect((res.body as { error: { code: string } }).error.code).toBe('SLOT_CLASH')
  })

  it('creates, duplicates and deletes a slot', async () => {
    const list = await json('/api/v1/admin/slots?club=setiabudi-one&limit=1')
    const ref = (list.body as { data: unknown[] }).data[0] as {
      club: { id: string }
      class_template: { id: string }
    }

    const created = await json('/api/v1/admin/slots', {
      method: 'POST',
      body: JSON.stringify({
        club_id: ref.club.id,
        class_template_id: ref.class_template.id,
        weekday: 0,
        start_time: '06:15',
      }),
    })
    expect(created.status).toBe(201)
    const id = (created.body as { data: { id: string } }).data.id

    const dup = await json(`/api/v1/admin/slots/${id}/duplicate`, {
      method: 'POST',
      body: JSON.stringify({ weekday: 0, start_time: '06:45' }),
    })
    expect(dup.status).toBe(201)

    expect((await json(`/api/v1/admin/slots/${id}`, { method: 'DELETE' })).status).toBe(204)
    const dupId = (dup.body as { data: { id: string } }).data.id
    expect((await json(`/api/v1/admin/slots/${dupId}`, { method: 'DELETE' })).status).toBe(204)
  })

  it('marks a slot TBA when its instructors are removed', async () => {
    const list = await json('/api/v1/admin/slots?club=setiabudi-one&limit=1')
    const slot = (list.body as { data: { id: string }[] }).data[0]!
    await json(`/api/v1/admin/slots/${slot.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ instructor_ids: [] }),
    })
    const after = await json('/api/v1/admin/slots?club=setiabudi-one&limit=1')
    expect(
      (after.body as { data: { instructor_status: string }[] }).data[0]!.instructor_status,
    ).toBe('tba')
  })

  it('tracks unpublished changes and clears them on publish', async () => {
    const before = await getVersion(db as never)
    expect(before.unpublished).toBeGreaterThan(0)
    const res = await json('/api/v1/admin/publish', { method: 'POST' })
    expect((res.body as { data: { unpublished: number } }).data.unpublished).toBe(0)
  })

  it('refuses to delete a club that still has classes', async () => {
    const clubs = await json('/api/v1/admin/clubs?q=Setiabudi')
    const club = (clubs.body as { data: { id: string }[] }).data[0]!
    const res = await json(`/api/v1/admin/clubs/${club.id}`, { method: 'DELETE' })
    expect(res.status).toBe(409)
  })

  it('422s on a malformed slot body', async () => {
    const res = await json('/api/v1/admin/slots', {
      method: 'POST',
      body: JSON.stringify({ club_id: 'not-a-uuid', weekday: 9, start_time: '25:00' }),
    })
    expect(res.status).toBe(422)
    expect((res.body as { error: { code: string } }).error.code).toBe('VALIDATION_FAILED')
  })
})
