# AF Class Schedule — Backend

Standalone. Runs on its own; the frontend talks to it over HTTP only.

**Classification: INTERNAL**

Hono + Drizzle + Postgres. Public read API, admin CRUD, session auth. 49 tests.

## Setup

```bash
npm install
cp .env.example .env        # then fill in DATABASE_URL and DIRECT_URL
npm run db:generate         # only after changing src/db/schema.ts
npm run db:migrate
npm run seed:validate       # report problems; exits non-zero on errors
npm run seed:import         # wipes and reloads from src/db/seed/sources
npm run seed:admin          # creates the first admin from ADMIN_SEED_*
npm run dev                 # :8787
npm test                    # runs everything against PGlite, no server needed
```

## Endpoints

| Method | Path | Auth |
|---|---|---|
| GET | `/health` | — |
| GET | `/api/v1/clubs` · `/schedule` · `/filters` | — |
| POST | `/api/v1/auth/login` · `/logout` | Origin check / session |
| GET | `/api/v1/auth/me` | session |
| GET POST PATCH DELETE | `/api/v1/admin/slots` | session + CSRF |
| POST | `/api/v1/admin/slots/:id/duplicate` | session + CSRF |
| GET POST PATCH DELETE | `/api/v1/admin/instructors` | session + CSRF |
| GET PATCH DELETE | `/api/v1/admin/clubs` | session + CSRF |
| GET | `/api/v1/admin/class-templates` | session + CSRF |
| GET PATCH | `/api/v1/admin/categories` | session + CSRF |
| GET | `/api/v1/admin/version` · POST `/publish` | session + CSRF |

## Auth design

- Opaque session id in an httpOnly, SameSite=Lax cookie; the session row lives in
  Postgres, so revoking is a `DELETE`. Chosen over a JWT, which cannot be revoked
  and is readable by any XSS.
- argon2id via WASM (`hash-wasm`) rather than a native binding — native builds
  are the first thing to break on a free tier.
- Sliding 7-day expiry with a hard 30-day cap.
- **Sign-in uses an Origin check, not double-submit.** A first-time visitor has
  no CSRF cookie, so requiring one makes logging in impossible. Every other
  mutation requires the double-submit header.
- Login is rate limited to 5 attempts per 15 minutes per IP+email, and returns
  one generic message for every failure so it cannot enumerate accounts.
- The Vue route guard is UX. `requireSession` on the server is the boundary.

## Layout

```
drizzle/0000_init.sql        generated migration — 11 tables
src/db/schema.ts             Drizzle schema, the single source of truth
src/db/client.ts             postgres-js connection
src/db/migrate.ts            applies drizzle/ to DATABASE_URL
src/db/seed/load.ts          Zod schemas + loaders for the source JSON
src/db/seed/validate.ts      pre-insert report (errors block the import)
src/db/seed/import.ts        truncate-and-reload importer
src/db/seed/sources/*.json   57 transcribed club timetables + reference data
test/seed.test.ts            migration + import + invariants, on PGlite
```

## Schema notes

- `weekday` is 0=Sunday … 6=Saturday, matching JS `getDay()`. Slots store a
  weekday and a local `start_time`, never an absolute datetime.
- `schedule_slots.instructor_status` is `confirmed` or `tba`. Studios publish
  timetables before naming an instructor; that is the club's answer, not a gap.
- `schedule_slots.duration_source` records `printed` / `capped` / `assumed`, so
  a later reader can tell a measured duration from the 60-minute default.
- `class_templates.family` groups the different names branches use for the same
  class. The public filter offers families; the card shows the club's own name.
- `uq_slots_club_room_slot` prevents two classes in one room at one time.

## Deliberate omissions

- **No `tags` table.** The design doc has one, but zero transcribed slots carry
  tags. Adding it when there is data is a one-line migration.
- **No `slot_exceptions`.** Phase 2.
- **The importer truncates.** Correct while the seed files are the only source
  of truth; becomes an upsert once the admin can create slots.

## Deploying to Vercel

Hono deploys to Vercel with zero configuration — `api/index.ts` default-exports
the app and Vercel turns every route into a Vercel Function on Fluid compute.
`vercel.json` rewrites all paths to that function. `src/server.ts` stays for
local development.

### Database

Neon gives two connection strings and both are needed:

| Variable | String | Used by |
|---|---|---|
| `DATABASE_URL` | pooled (`-pooler` in the hostname) | the running API |
| `DIRECT_URL` | direct | `db:migrate`, `seed:import`, `seed:admin` |

The pooled string goes through PgBouncer in transaction mode, which is right for
serverless request handling and **wrong for migrations** — Drizzle Kit errors
through it. The three scripts above set `DB_DIRECT=1`, which switches the client
to `DIRECT_URL`.

`attachDatabasePool` from `@vercel/functions` hands the connection lifecycle to
the platform: the first request opens a TCP connection, later requests reuse it,
and idle connections close before the function is suspended. Outside Vercel it
is a no-op.

### Troubleshooting

**`DATABASE_URL is not set` / `DIRECT_URL is not set`** — `.env` is missing or
not filled in. Copy `.env.example` to `.env` and paste both Neon connection
strings. The scripts read `.env` themselves via Node's built-in
`process.loadEnvFile`, so no `dotenv` and no shell prefix is needed, on any OS.

**The scripts set `DB_DIRECT` themselves.** They used to rely on a
`DB_DIRECT=1 tsx ...` prefix in package.json, which is not valid syntax in
PowerShell or cmd — on Windows the variable was silently never set and the
script reached for the pooled URL instead.

### Running migrations and seeding

These run from your machine against `DIRECT_URL`, not as part of a deploy:

```bash
npm run db:migrate
npm run seed:import
npm run seed:admin      # then delete ADMIN_SEED_* from your environment
```

### Two things that change on serverless

1. **The login rate limiter is per-instance.** It keeps its counter in memory,
   so across cold starts "5 attempts per 15 minutes" becomes 5 per instance.
   Accepted for now — it guards a login only the owner uses. Upstash Redis has a
   free tier if that stops being true.
2. **`CORS_ORIGINS` can be empty in production** if the frontend proxies
   `/api/*` to this service. Keep it set for local development, where the two
   run on different ports.
