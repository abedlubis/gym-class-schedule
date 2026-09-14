# AF Class Schedule — project handoff

**Classification: INTERNAL**
Packaged 13 September 2026. Everything needed to continue the project.

---

## Read this first if you are an AI assistant picking this up

The project is **built and tested, not yet deployed**. Do not re-plan it. Read
`docs/02-decisions.md` before proposing any architectural change — most of the
obvious suggestions were already considered and rejected for reasons that are
recorded there.

Three things that are easy to get wrong and are non-negotiable:

1. **Slots are recurring, not dated.** A slot stores `weekday` (0=Sunday) plus a
   local `start_time`. The API expands them into a dated Monday-to-Sunday week.
   Never store absolute datetimes.
2. **"Instructor TBA" is a real state, not missing data.** 38 slots have no
   instructor because the studio has not decided yet. Do not treat this as a
   validation error or try to fill it in.
3. **Stale data is the project's main risk, not a technical one.** The whole
   value proposition is trusting this app instead of Instagram. One wrong class
   time costs someone a wasted trip and they never come back. Provenance and
   freshness markers are load-bearing features, not decoration.

---

## What this is

Every Anytime Fitness Indonesia branch publishes its group-class timetable only
as an image on that branch's own Instagram account. To decide where to train you
have to open several accounts and read pictures. The official AF app has no
schedule feature.

This app digitises those timetables into one filterable web app.

**Owner:** Abed Lubis. Personal project, no deadline, free hosting tiers only.
Used by him and friends; intended to go public.
**Success criterion:** he and his friends stop opening Instagram to find out when
a class runs.

---

## Current state

| Area | State |
|---|---|
| Data | 57 of 62 clubs transcribed, 1,040 slots, 128 class names, 477 instructors |
| Backend | Hono + Drizzle + Postgres. Public API, session auth, admin CRUD. **49 tests pass** |
| Frontend | Vue 3 + TS + Tailwind. Public app + admin. Typechecks, builds, 19 kB gzipped |
| Deployment | Configured for Vercel, **not yet deployed** |
| Visual QA | **Never done.** Nobody has looked at the running app |

## Layout

```
docs/01-system-design.md   architecture, schema, API contract, wireframes
docs/02-decisions.md       every decision and why — read before changing anything
docs/03-data-notes.md      how the data was gathered, what is flagged, what is missing
docs/04-deployment.md      Vercel plan and the traps in it
docs/05-next-steps.md      what to do next, in order
backend/                   API — see backend/README.md
frontend/                  web app — see frontend/README.md
```

The 59 seed JSON files live at `backend/src/db/seed/sources/` — 57 club
timetables plus `clubs.json` and `class-templates.json`. They are the source of
truth for the initial load and are not duplicated anywhere else in this package.

## Run it

```bash
cd backend
npm install && npm test          # 49 tests, PGlite in-process, no database needed

cp .env.example .env             # DATABASE_URL (pooled) + DIRECT_URL from Neon
npm run db:migrate
npm run seed:import
npm run seed:admin               # reads ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD
npm run dev                      # :8787

cd ../frontend
npm install && cp .env.example .env
npm run dev                      # :5173, admin at /admin
```

`npm test` in `backend/` runs the migration and the full 1,040-slot import
against PGlite. It is the fastest way to confirm nothing is broken.

## The single most useful next action

Run the frontend and look at it. Every visual decision in this project was made
without anyone seeing the rendered result — it typechecks and builds, and that
is all that has been verified.
