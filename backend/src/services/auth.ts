import { and, eq, gt, sql } from 'drizzle-orm'
import type { PgDatabase } from 'drizzle-orm/pg-core'
import * as s from '../db/schema.js'
import { hashPassword, newToken, verifyPassword } from '../lib/crypto.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = PgDatabase<any, any, any>

export const SESSION_COOKIE = 'af_session'
export const CSRF_COOKIE = 'af_csrf'
export const CSRF_HEADER = 'x-csrf-token'

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // sliding
const SESSION_MAX_MS = 30 * 24 * 60 * 60 * 1000 // hard cap

export type SessionUser = {
  id: string
  email: string
  name: string | null
  role: 'admin' | 'editor'
}

export async function createAdmin(
  db: Db,
  input: { email: string; password: string; name?: string },
) {
  const passwordHash = await hashPassword(input.password)
  const [row] = await db
    .insert(s.adminUsers)
    .values({
      email: input.email.toLowerCase().trim(),
      passwordHash,
      name: input.name ?? null,
    })
    .returning({ id: s.adminUsers.id, email: s.adminUsers.email })
  return row
}

/**
 * Returns a session or null. Never distinguishes "no such user" from "wrong
 * password" — the caller has one generic message for both, so the endpoint
 * cannot be used to enumerate accounts.
 */
export async function login(
  db: Db,
  input: { email: string; password: string; userAgent?: string; ip?: string },
): Promise<{ token: string; csrf: string; user: SessionUser } | null> {
  const email = input.email.toLowerCase().trim()
  const [user] = await db
    .select()
    .from(s.adminUsers)
    .where(and(eq(s.adminUsers.email, email), eq(s.adminUsers.status, 'active')))
    .limit(1)

  // Hash anyway when the user is missing, so a wrong email and a wrong password
  // take the same wall-clock time.
  const hash = user?.passwordHash ?? (await hashPassword(newToken(16)))
  const ok = await verifyPassword(input.password, hash)
  if (!user || !ok) return null

  const token = newToken()
  const csrf = newToken(24)
  await db.insert(s.sessions).values({
    id: token,
    adminUserId: user.id,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    userAgent: input.userAgent ?? null,
    ip: input.ip ?? null,
  })
  await db
    .update(s.adminUsers)
    .set({ lastLoginAt: new Date() })
    .where(eq(s.adminUsers.id, user.id))

  return {
    token,
    csrf,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  }
}

export async function resolveSession(db: Db, token: string): Promise<SessionUser | null> {
  const [row] = await db
    .select({
      sessionId: s.sessions.id,
      createdAt: s.sessions.createdAt,
      id: s.adminUsers.id,
      email: s.adminUsers.email,
      name: s.adminUsers.name,
      role: s.adminUsers.role,
      status: s.adminUsers.status,
    })
    .from(s.sessions)
    .innerJoin(s.adminUsers, eq(s.adminUsers.id, s.sessions.adminUserId))
    .where(and(eq(s.sessions.id, token), gt(s.sessions.expiresAt, new Date())))
    .limit(1)

  if (!row || row.status !== 'active') return null

  // Hard cap regardless of activity: a session that has been slid forward for a
  // month is revoked rather than renewed forever.
  if (Date.now() - row.createdAt.getTime() > SESSION_MAX_MS) {
    await logout(db, token)
    return null
  }

  await db
    .update(s.sessions)
    .set({ lastSeenAt: new Date(), expiresAt: new Date(Date.now() + SESSION_TTL_MS) })
    .where(eq(s.sessions.id, token))

  return { id: row.id, email: row.email, name: row.name, role: row.role }
}

export async function logout(db: Db, token: string) {
  await db.delete(s.sessions).where(eq(s.sessions.id, token))
}

export async function purgeExpiredSessions(db: Db) {
  await db.execute(sql`delete from sessions where expires_at < now()`)
}
