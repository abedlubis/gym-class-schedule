# AF Class Schedule — Frontend

Standalone. Needs the backend running and `VITE_API_BASE_URL` pointing at it.

**Classification: INTERNAL**

```bash
npm install
cp .env.example .env      # VITE_API_BASE_URL=http://localhost:8787/api/v1
npm run dev
```

## M1.5 — the visual refactor

**Light mode only.** No dark variant, no system toggle.

### Tokens

| Token | Value | Role |
|---|---|---|
| `--color-bg` | `#EFF0F0` | page |
| `--color-surface` | `#FFFFFF` | cards, bars, sheets |
| `--color-line` | `#CCCCCC` | hairlines only, never text (1.6 on white) |
| `--color-ink` | `#221551` | primary text — 16.2 on white |
| `--color-ink-muted` | `#35393D` | secondary text — 11.6 on white |
| `--color-primary` | `#6E38D5` | actions, selected states — 6.6 on white |
| `--color-accent` | `#804C9E` | category labels — 6.1 on white |
| `--color-wordmark` | `#000000` | the AF mark, and nothing else |

`#221551` is the text colour, not a background. It reads as near-black with a
purple cast, so the brand is present on every screen without a dark theme.

### The one bold idea

Anytime Fitness prints a purple vertical time column down the left of every
timetable graphic. The class list borrows it: time and duration sit in a fixed
left rail against a hairline, so a week scans down a single spine. Everything
else stays quiet.

Type is **Archivo** throughout — Archivo Narrow for day headers and the class
title in the detail sheet. Times, durations and counts use tabular figures
(`.tnum`), because a timetable whose numbers do not line up is not a timetable.

### Layout

- **Mobile:** sticky top bar (studio picker + filters) → week strip → list →
  two-tab bottom bar. Selecting a day filters to that day.
- **Desktop:** same components, filter sidebar returns, the whole week scrolls
  and the day strip acts as an anchor.
- One `lg` breakpoint. No separate implementations.

### Screens

- `HomeView` — the week, with the day strip and the class list.
- `StudiosView` — every club grouped by area. Clubs with no data say so and
  invite a contribution rather than rendering an empty row.
- `ClassDetail` — a bottom sheet on mobile, a right panel on desktop. Carries
  the studio, an Instagram link, other times that class runs this week, and the
  provenance block: where the data came from, whether the club has gone quiet,
  and whether the duration was assumed.

### Deliberately not built

No Reserve button and no capacity badge — the reference apps have them, but you
cannot book through this and a dead button is worse than none. No instructor
photos: 477 names, no photos, and sourcing headshots of real trainers is a
privacy problem. No favourites — that needs storage and identity.

## M2–M3 — admin

Routes live under `/admin`, lazy-loaded, and never reach the public bundle.

| Route | What it does |
|---|---|
| `/admin/login` | one generic error for every failure mode |
| `/admin/slots` | the working screen — filter by studio, add, edit, copy, pause, delete |
| `/admin/instructors` | add and remove, with the duplicate-nickname guard |
| `/admin/clubs` | mark a studio out of date, which warns on its public page |
| `/admin/classes` | class families and the category colours |

Three things worth knowing:

- **Unpublished changes are always on screen.** The sidebar shows the count and
  the Publish button. An edit that was never published is the most likely way
  this system fails silently.
- **The duplicate-instructor guard is a dialog, not a constraint.** Adding an
  instructor whose nickname already exists returns a 409 listing the studios
  that person already teaches at, and the admin confirms. Nicknames are one
  person everywhere, so this is where two coaches would silently merge.
- **A class with no instructor is normal.** The form says so rather than
  blocking the save, because studios publish timetables before naming anyone.

The route guard only decides what to render. Every `/admin` API call is
re-checked server-side.

## Talking to the backend

Two environment values have to agree or nothing loads:

- frontend `.env` → `VITE_API_BASE_URL=http://localhost:8787/api/v1`
- backend `.env` → `CORS_ORIGINS=http://localhost:5173`

The admin sends cookies cross-origin, so the backend allowlist must name the
frontend origin exactly. `*` will not work there.

## One thing to watch now the repos are split

`src/types/schedule.ts` hand-mirrors the API response shape from
`backend/src/services/schedule.ts`. Nothing enforces that they stay in step.
If the two drift, the symptom is `undefined` on screen rather than a type error.
When that starts to bite, generate the client types from the backend instead of
copying them.

## Deploying to Vercel

Both sides live in one Git repository and become two Vercel projects.

| Project | Root Directory | Serves |
|---|---|---|
| existing project | `frontend` | the static site |
| new project | `backend` | the API as Vercel Functions |

Set Root Directory in Settings for the existing project; create the second
project from the same repository.

### The rewrite matters more than it looks

`vercel.json` proxies `/api/*` to the backend project, so the browser only ever
sees one origin.

That is not cosmetic. Admin auth is cookie-based, and Safari and Chrome block
third-party cookies — a cross-origin admin login works on a laptop and fails
silently on a phone. Same-origin also means `CORS_ORIGINS` can be left empty in
production.

**Replace `REPLACE-ME-backend.vercel.app`** with the backend project's domain
before the first deploy.

The second rewrite is the SPA fallback. Without it, opening `/studios` or
`/admin/slots` directly returns 404 — only the root path would resolve.

### Environment

- Local: `VITE_API_BASE_URL=http://localhost:8787/api/v1`
- Production: leave it unset. The default is the relative `/api/v1`, which the
  rewrite forwards.

## Feedback round — what changed

**Opens on today.** The page reads the current date and shows that day. There is
no "all days" view: 176 classes run on a Monday across 57 studios, and a week of
that is not something anyone can read. The day strip marks today with a dot and a
"Back to today" button appears once you navigate away. The chosen day is kept in
the URL, so a shared link opens on the same day.

**Two list shapes for two questions.**

- *A studio is selected* — the detailed list: time rail, class, instructor,
  duration. This is the "tell me about this class" view.
- *All studios* — one row per start time with every branch on it as a compact
  chip: `Pilates · AKR Tower`, `Zumba · Citywalk Sudirman`. Monday 07:00 holds 7
  classes across 7 branches; a full Monday collapses from **176 cards to 35 time
  rows**. This is the "what is on at 7am" view.

**Every class opens a modal** with the full detail — instructor, duration,
studio and area, other times it runs this week, and the provenance block.

**Loading states everywhere.** Skeletons shaped like the content they replace,
for the schedule, the studio picker and the compact rows. No blank canvas.

## On the UI kit

**PrimeVue, not Vuetify, and in unstyled mode.**

Vuetify is Material Design. Adopting it means adopting Material's shapes,
elevation and motion, and the AF palette ends up fighting the theme on every
surface — the brief was to keep the palette. Unstyled PrimeVue takes the
opposite trade: the behaviour (focus trap, focus restore, `aria-modal`, Escape,
scroll lock, portal and z-index handling, keyboard navigation in the studio
picker) with every pixel still coming from the existing Tailwind tokens.

The whole "theme" is the pass-through object in `src/plugins/primevue.ts`. It
contains only Tailwind classes built from the same tokens as everything else, so
nothing new entered the palette.

Components used: `Dialog` (class detail), `Select` (studio picker, with filtering
— it matters at 58 studios), `Skeleton` (loading).

### The cost, measured

| Build | Initial JS (gzipped) |
|---|---|
| before, hand-rolled | 19 kB |
| PrimeVue core + Skeleton, native `<select>` | 45 kB |
| **current** — core + Skeleton + Select | **69 kB** |
| `ClassDetail` (Dialog) | 12.6 kB, lazy — loads on first tap |

PrimeVue's core and config account for roughly 26 kB of that before a single
component is used; `Select` is another 24 kB. The dialog is lazy-loaded because
it is only needed after a tap.

That is a 3.6x increase on a page people open on mobile data in a gym lobby. It
buys a searchable studio picker and correct dialog accessibility. If the size
matters more than the search box, reverting `Select` to a native `<select>` drops
it back to 45 kB and is a ten-line change — the native picker is a system sheet
on mobile, which is not a bad experience.
