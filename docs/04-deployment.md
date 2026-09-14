# Deployment

**Classification: INTERNAL**
Status: configured, **not yet deployed**.

---

## Shape

One Git repository, two Vercel projects.

| Project | Root Directory | Serves |
|---|---|---|
| existing (currently serving the old dummy app) | `frontend` | static site |
| new | `backend` | API as Vercel Functions |

The repository that already exists on GitHub should be reused rather than
replaced — it keeps the history and the Vercel project link. Restructure to
`frontend/` + `backend/` on a branch, then change Root Directory in the existing
project's settings.

## Order

```
1. branch, restructure, push
2. create the backend project, Root Directory = backend, add env vars, deploy
3. copy its domain into frontend/vercel.json (replace REPLACE-ME-backend...)
4. existing project → Settings → Root Directory = frontend
5. from a laptop: npm run db:migrate && npm run seed:import && npm run seed:admin
6. delete ADMIN_SEED_* from the environment
```

Step 5 runs from a developer machine against `DIRECT_URL`. It is not part of any
deploy.

## The rewrite is the important part

`frontend/vercel.json` proxies `/api/*` to the backend project so the browser
only ever sees one origin.

This is not cosmetic. Admin auth is cookie-based, and Safari and Chrome block
third-party cookies — **a cross-origin admin login works on a laptop and fails
silently on a phone.** Same-origin also means `CORS_ORIGINS` can be empty in
production.

The second rewrite is the SPA fallback. Without it, opening `/studios` or
`/admin/slots` directly returns 404 and only the root path resolves. It looks
like a routing bug in the app rather than a hosting gap.

Do not put `comment` keys inside `vercel.json` — Vercel validates the file
against a schema and unknown properties can fail the build.

## Database

Neon, free tier. Two connection strings, both required:

| Variable | String | Used by |
|---|---|---|
| `DATABASE_URL` | pooled (`-pooler` in the hostname) | the running API |
| `DIRECT_URL` | direct | `db:migrate`, `seed:import`, `seed:admin` |

The pooled string runs through PgBouncer in transaction mode — right for
serverless request handling and **wrong for migrations**, which error through it.
The three scripts set `DB_DIRECT=1` themselves, so it is not possible to forget.

`attachDatabasePool` from `@vercel/functions` hands connection lifecycle to the
platform. Outside Vercel it is a no-op, so local and CI behave the same.

## Free-tier facts that shaped this

Verified September 2026; re-check before relying on them.

- Hono deploys to Vercel with zero configuration; routes become Vercel Functions
  on Fluid compute, which brings cold starts to roughly 115 ms.
- Neon's free tier autosuspends when idle, so the first request after a quiet
  period pays a wake-up delay.
- Render's free web services spin down after inactivity with a cold start of
  roughly a minute — the reason the public read path was designed to be static
  rather than live.

## Known compromises

**The login rate limiter is per-instance.** In-memory, so across cold starts
"5 attempts per 15 minutes" becomes 5 per instance. Accepted; Upstash Redis has
a free tier if it stops being acceptable.

**The publish/snapshot renderer is not written.** The design calls for admin
writes to render static JSON per club per week, which the public app fetches
directly. The version counter, the unpublished-changes banner and the publish
endpoint all exist; the renderer does not. Until it does, the public app reads
the live API.

## Before making it public

The data is transcribed from Anytime Fitness's own Instagram posts. Minimum
before promoting the link:

- a visible "unofficial, not affiliated with Anytime Fitness" line
- per-club last-updated dates (the data supports this already)
- a link out to each studio's Instagram as the source of truth

The class detail sheet already carries the source link and the stale warning.
