# AF Class Schedule — System Design & Wireframes

**Classification: INTERNAL**
Version 0.1 · Draft for review · Author: Abed Lubis

---

## 0. Assumptions (confirm or flip before build)

These were the six open decisions. This document is written against the recommended option for each. Changing one changes the sections listed.

| # | Decision | Assumed | Affects |
|---|---|---|---|
| 1 | Backend stack | Node + TypeScript (Hono) + Postgres + Drizzle | §2, §5, §9 |
| 2 | Schedule model | Recurring (weekday + time), not absolute datetimes | §3, §4 |
| 3 | Auth | Admin-only, no self-signup, httpOnly session cookie | §5 |
| 4 | Admin UI | Same Vue app, `/admin/*`, lazy-loaded, route guard | §6, §7 |
| 5 | Public data | **Published snapshot** — admin writes trigger a static JSON rebuild; public page never hits the API | §4, §8 |
| 6 | MVP scope | No booking, no member accounts, no uploads | §10 |
| 7 | Theme | **Light mode only**, no dark variant, no system toggle | §7 |
| 8 | Responsive | One codebase; app-shell layout on mobile, sidebar layout on desktop, single `lg` breakpoint | §6, §7 |

Decision 5 was originally "live fetch from the API". It flipped once the free-hosting constraint (§1.1) was confirmed: free API tiers either cold-start after inactivity or cap CPU per request, and neither is acceptable for a public page that must load instantly for someone standing in a gym lobby. Serving the public read path as a static file sidesteps both, and the admin path is allowed to be slow because only I use it.

ASSUMPTION: single timezone per club, and every club's schedule repeats weekly. Exceptions (cancellations, substitutes) are Phase 2 — the schema reserves space for them but the MVP does not implement them.

---

## 1. Background, goals & non-goals

### 1.1 Background

I train in group classes at Anytime Fitness regularly. Every AF branch runs its own timetable — different class names, different instructors, different times — and the only place those timetables are published is each studio's own Instagram account, as feed posts and stories.

That makes a simple question expensive to answer. To decide where and when to train, a member has to open several studio accounts one at a time and read timetables rendered as images. Stories expire. Nothing is searchable, nothing is filterable, and there is no way to see across branches at all. The official AF app does not surface class schedules, so there is no first-party alternative.

This project digitises those timetables into a single web app: every branch's classes in one place, filterable by class, instructor, day, time, and location, so a member can answer "where can I do Bodycombat on Tuesday evening" in one view instead of five Instagram accounts.

**Users.** Me first, plus friends who attend classes regularly. The intent is to promote it publicly once it holds enough branches to be useful to strangers.

**Why build it.** Two reasons, both real. The schedule problem is genuine and unsolved. And the project is my vehicle for practising system design and structuring a web app end to end — which is why this document exists at all, and why the data model below is more rigorous than 55 rows strictly require. The modelling work is the point, not incidental overhead.

**Constraints.** Hobby project, no deadline, no budget. Everything must run on free hosting tiers. This is a hard constraint, not a preference, and it drives several decisions in §2 and §4.

**Success criteria.** My friends and I stop opening Instagram to find out when a class runs.

### 1.2 Goals

1. Replace the build-time `schedule.json` with a real datastore.
2. Let an admin CRUD clubs, instructors, class templates, categories, and schedule slots through a UI — no redeploy to change a schedule.
3. Keep the existing public browsing experience identical or better, now reading from an API.
4. Practise end-to-end system design: schema modelling, migrations, API contracts, auth, and how the pieces fit together.

### 1.3 Non-goals for MVP

Booking and capacity, attendance tracking, member accounts, payments, image upload, audit log, soft delete, multi-tenant, i18n, push notifications, native app.

---

## 2. Architecture

```
                         ┌──────────────────────────────┐
                         │        Browser (SPA)         │
                         │  Vue 3 + TS + Tailwind 4     │
                         │                              │
                         │  /            public page    │
                         │  /admin/*     admin (lazy)   │
                         └───────┬──────────────┬───────┘
                                 │              │
                 public, cacheable│              │session cookie
                  GET only        │              │ + CSRF header
                                 ▼              ▼
                         ┌──────────────────────────────┐
                         │      API service (Hono)      │
                         │                              │
                         │  routes/    public | admin   │
                         │  middleware auth, csrf,      │
                         │             ratelimit, zod   │
                         │  services/  domain logic     │
                         │  db/        drizzle schema   │
                         └───────────────┬──────────────┘
                                         │ SQL over TLS
                                         ▼
                         ┌──────────────────────────────┐
                         │        PostgreSQL            │
                         │  clubs · instructors ·       │
                         │  categories · class_templates│
                         │  schedule_slots · sessions   │
                         │  admin_users                 │
                         └──────────────────────────────┘
```

**Deployment (free tier only).** Frontend on Vercel or Cloudflare Pages. API as a single small service on a free tier that tolerates cold starts, since only the admin hits it. Postgres on Neon's free tier, which autosuspends when idle and wakes on connect.

Free-tier facts that shape this, worth verifying before committing:
- Render's free web services spin down after inactivity, giving a cold start of roughly a minute. Fine for an admin panel, unacceptable for a public page — which is why the public read path is static.
- Cloudflare Workers' free plan caps CPU per request, which rules out argon2id at sensible parameters. If the API runs on Workers, password hashing has to move or the parameters have to drop — a real trade-off, not a detail.
- Neon's free tier autosuspends, so the first admin request after an idle period pays a wake-up delay.

**CORS.** The admin path sends credentials, so the allowlist must name the exact production and preview origins. Never `*`.

ASSUMPTION: free-tier limits above reflect current published terms and should be re-checked at build time; they change.

**Why one service, not two.** The admin and public API share the same domain model. Splitting them buys isolation you don't need at 56 clubs and costs you a second deploy pipeline. Separation is enforced by route prefix and middleware, not by process.

---

## 3. Data model

### 3.1 Entity relationships

```
  categories ──┐
               │ 1:N
  class_templates ──────┐
       │                │ 1:N
       │ N:M (tags)     │
  tags ┘                ▼
                  schedule_slots ──── N:1 ──── clubs
                        │
                        │ N:M
                        ▼
                  slot_instructors ── N:1 ── instructors
                                                  │
                                                  │ N:M
                                                  └── instructor_clubs ── clubs

  admin_users ── 1:N ── sessions
```

### 3.2 Tables

**`clubs`** — an AF branch. ~56 operating clubs nationally; only 3 have schedule data today.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| slug | text unique | `setiabudi-one` |
| name | text | `Setiabudi One` |
| city | text | `Jakarta` |
| region | text | `Jakarta Selatan` |
| address | text null | |
| status | enum | `open` \| `presale` \| `coming_soon` \| `closed` |
| timezone | text | IANA, default `Asia/Jakarta`. Bali clubs are `Asia/Makassar` |
| instagram_handle | text null | |
| sort_order | int default 0 | |
| created_at / updated_at | timestamptz | |

**`categories`** — replaces the hardcoded `CATEGORY_COLOR` map in the frontend.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| slug | text unique | `martial-cardio` |
| label | text | `Martial Cardio` |
| color_hex | text | `#fbbf24` — admin-editable, frontend stops hardcoding |
| sort_order | int | |

**`instructors`**

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| slug | text unique | |
| name | text | The nickname as printed on the timetable — treated as **globally unique across all clubs** |
| bio | text null | |
| status | enum | `active` \| `inactive` |
| created_at / updated_at | timestamptz | |

**`instructor_clubs`** — composite pk `(instructor_id, club_id)`. Trainers genuinely cover multiple branches, so an instructor is **one row in `instructors` and several rows here**, not a duplicate per club.

The identity rule is that a nickname is one person everywhere. That is correct today and cheap, and the failure mode is two different coaches sharing a nickname silently merging into one. The guard is not a schema change — it is a warning in the admin: creating an instructor whose name already exists shows *"Agus already teaches at Citra Kemayoran and Setiabudi One — same person?"* with a confirm step. One dialog, no extra tables.

**`class_templates`** — the reusable definition of a class ("Bodycombat"), separate from when and where it runs.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| slug | text unique | |
| name | text | `Bodycombat` |
| category_id | uuid fk | |
| programme | text null | `LesMills`, `Zumba`, `Salsation`. Replaces the LesMills *tag* — a tag is the wrong place for a licensed programme |
| default_duration_min | int | Defaults to 60. AF timetable graphics do not print durations, so 60 is the standing assumption until a class is known to differ |
| description | text null | |
| status | enum | `active` \| `archived` |

**Class-name normalisation (`family`).** Branches name the same class differently. Across the eight transcribed clubs there are 46 distinct class names for 150 slots, and **63% of names appear at only one club** — nine different names for yoga alone (Yoga, Basic Yoga, Hatha Yoga, Vinyasa Yoga, Gentle Yoga, Power Yoga, Flow Yoga, Inside Flow, Yoga Stretch). Filtering on raw names is therefore useless across branches: "show me yoga" would miss most of it.

Resolution: a nullable `family` text column on `class_templates`, hand-mapped. Twelve families cover all 46 names. The public filter offers families; **the class card still displays the club's own printed name**, because that is what the member will see on the studio door and changing it would break trust. No fuzzy matching and no separate taxonomy table — the mapping is small, and a wrong automatic merge is worse than an unmapped name.

**`tags`** + **`class_template_tags`** — free-form descriptors (`low-impact`, `mobility`). Many-to-many. 35 tags exist in current data.

**`schedule_slots`** — the core table. One row = "this class runs at this club every Tuesday at 18:10".

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| club_id | uuid fk | |
| class_template_id | uuid fk | |
| weekday | smallint | 0 = Sunday … 6 = Saturday (matches JS `getDay()`) |
| start_time | time | local to the club's timezone, no date |
| duration_min | int | defaults from template, overridable |
| room | text null | reserved for clubs with multiple studios |
| status | enum | `active` \| `paused` |
| effective_from | date | |
| effective_to | date null | null = open-ended |
| created_at / updated_at | timestamptz | |

Indexes:
- `idx_slots_club_weekday` on `(club_id, weekday, start_time)` — the read path.
- Partial unique on `(club_id, room, weekday, start_time)` where `status = 'active'` — prevents double-booking the same room.

**Instructor TBA is a first-class state.** Studios routinely publish a timetable before they have settled who teaches a slot — the cell is blank, or reads `Coach`, `PT Team`, or `ALL PT`. Across the transcribed data this is 36 slots at 11 clubs, and at one club (Gandaria) it is the entire timetable. So a slot with no instructor is **not** missing data to be chased; it is the club's current answer.

Model it as `schedule_slots.instructor_status` with values `confirmed` and `tba`, rather than inferring it from an empty join. The UI shows *"Instructor TBA"* on the class card instead of a blank line, and the admin does not treat an empty instructor list as a validation error.

**`slot_instructors`** — composite pk `(slot_id, instructor_id)`. Current data has classes with a single instructor, but co-taught classes exist and the array is already in the JSON.

**`slot_exceptions`** *(Phase 2, schema only)* — `(id, slot_id, date, type, substitute_instructor_id, new_start_time, note)` where `type` is `cancelled` \| `substitute` \| `time_change`.

**`admin_users`** — `(id, email, password_hash, name, role, status, last_login_at, created_at)`. `role` is `admin` today; the column exists so adding `editor` later is not a migration against live data.

**`sessions`** — `(id, admin_user_id, expires_at, created_at, last_seen_at, user_agent, ip)`. Opaque server-side session; see §5.

### 3.3 What changes versus today's JSON

| Today | New model | Why |
|---|---|---|
| Absolute `datetime` for one week | `weekday` + `start_time` | Current data spans two calendar weeks, so the timeline renders Wed→Tue. Recurring fixes it and enables "today" / "next class" |
| `location` as a string | `clubs` table with status, region, timezone | Names repeat, and six clubs aren't open yet |
| Instructor as string array | `instructors` + join table | Enables an instructor page and prevents typo duplicates |
| `LesMills` as a tag | `programme` on the template | It's a licensed programme, not a descriptor |
| Category colours in `utils/schedule.ts` | `categories.color_hex` | Adding a category stops requiring a frontend deploy |
| `filters` block hand-maintained in JSON | Derived from data at query time | Removes drift risk permanently |

---

## 4. API contract

Base: `/api/v1`. JSON only. All responses use one envelope.

```jsonc
// success
{ "data": <payload>, "meta": { "page": 1, "limit": 20, "total": 55 } }

// error
{ "error": { "code": "VALIDATION_FAILED", "message": "Invalid request body",
             "details": [{ "field": "start_time", "issue": "required" }] } }
```

Error codes: `VALIDATION_FAILED` 422, `UNAUTHORIZED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404, `CONFLICT` 409, `RATE_LIMITED` 429, `INTERNAL` 500.

### 4.1 Public (no auth, `GET` only, cacheable)

| Method | Path | Notes |
|---|---|---|
| GET | `/clubs` | `?status=open` default. Returns id, slug, name, city, region, timezone |
| GET | `/schedule` | `?club=setiabudi-one&week=2026-04-06`. Returns slots **materialised into dated occurrences for that ISO week**, so the frontend renders Mon→Sun without date maths. `week` defaults to the current week in the club's timezone |
| GET | `/filters` | Derived lists: categories (with colours), instructors, class names, tags, programmes. Scoped by `?club=` |

`/schedule` response shape — deliberately close to today's `ScheduleDataset` so the frontend migration is small:

```jsonc
{
  "data": {
    "meta": { "club": "setiabudi-one", "timezone": "Asia/Jakarta",
              "week_start": "2026-04-06", "week_end": "2026-04-12" },
    "classes": [
      { "id": "<slot-id>:2026-04-06", "slot_id": "<uuid>",
        "date": "2026-04-06", "start_time": "07:00", "duration_min": 60,
        "class_name": "Hatha Yoga", "category": { "slug": "yoga", "color": "#4ade80" },
        "programme": null, "instructors": ["Ilanda"],
        "club": "Setiabudi One", "tags": ["mind-body", "flexibility"] }
    ]
  }
}
```

**How the public page actually reads this (published snapshot).** The endpoints above define the shape, but the public page does not call them at runtime. Instead:

1. Any admin mutation marks the schedule dirty and bumps a `schedule_version` counter.
2. A publish step — a button in the admin, plus a nightly job — renders the full dataset to static JSON: one file per club per ISO week, `/data/{club}/{week}.json`, plus a `clubs.json` index.
3. Those files are uploaded to the static host and served from CDN with a long `max-age` and a versioned filename.
4. The public Vue app fetches them directly. No API, no cold start, no database wake-up, no CORS, and it stays up even if the API tier is asleep or gone.

Cost: edits are not instant — they appear at publish. For a weekly class timetable that is the right trade. The admin shows a "3 unpublished changes" banner so the state is never ambiguous.

The live endpoints in §4.1 still get built, because the publish step consumes them and because they are the escape hatch if the snapshot model turns out wrong.

### 4.2 Admin (session cookie + CSRF header)

| Method | Path | |
|---|---|---|
| POST | `/auth/login` | body `{ email, password }` → sets cookie, returns user |
| POST | `/auth/logout` | revokes the session row |
| GET | `/auth/me` | current user, or 401 |
| GET/POST | `/admin/clubs` · `/admin/instructors` · `/admin/class-templates` · `/admin/categories` · `/admin/tags` · `/admin/slots` | list + create |
| GET/PATCH/DELETE | `…/:id` | read, partial update, delete |

List endpoints share one param contract: `?page&limit&q&status&sort`. `limit` capped at 100 server-side.

`DELETE` is a hard delete in MVP, guarded by a confirmation dialog and by foreign keys (`ON DELETE RESTRICT` — you cannot delete a club that still has slots). Soft delete is Phase 2.

---

## 5. Auth & security design

Grounded risk areas: **access control**, **secrets management**, **input validation**, **rate limiting**.

**Access control.**
- Opaque session ID (32 random bytes, base64url) stored in an httpOnly, `Secure`, `SameSite=Lax` cookie; the session row lives in Postgres so revocation is a `DELETE`. Chosen over a JWT in `localStorage`, which cannot be revoked and is readable by any XSS.
- 7-day expiry, sliding on activity, hard cap 30 days.
- Passwords hashed with argon2id (memory 19 MiB, time 2, parallelism 1). Never bcrypt-with-defaults, never SHA anything.
- No self-signup. The first admin is created by a seed script that reads a one-time password from an environment variable; further admins are created through the admin UI.
- Every `/admin/*` route re-checks the session server-side. The Vue route guard is UX, never a security boundary.

**CSRF.** Mutations require a matching `X-CSRF-Token` header (double-submit against a non-httpOnly companion cookie) and an `Origin` check against the allowlist.

**Secrets management.** `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_SEED_PASSWORD`, `CORS_ORIGINS` come from platform environment variables only. `.env` stays gitignored; a committed `.env.example` carries key names with empty values. No credential value ever appears in source, seed data, logs, or this document.

**Input validation.** Zod schema at every route boundary — body, params, and query. Parsed output is the only thing that reaches a service function. Drizzle parameterises all queries; no string-built SQL anywhere.

**Rate limiting.** `/auth/login` limited to 5 attempts per 15 minutes per IP+email pair, with a constant generic failure message so the endpoint cannot be used to enumerate accounts. Global limit of 100 requests per minute per IP on `/admin/*`.

**Other.** Security headers via middleware (HSTS, `X-Content-Type-Options`, `Referrer-Policy`, a CSP once the asset origins settle). Structured request logs with method, path, status, duration, and session ID — never the request body, never the cookie.

---

## 6. Frontend architecture

```
src/
  api/            client.ts (fetch wrapper, envelope unwrap, error mapping)
                  schedule.ts · clubs.ts · admin/*.ts
  composables/    useScheduleFilters.ts   (refactor to accept a getter)
                  useAuth.ts              (session state, /auth/me on boot)
                  useAdminResource.ts     (generic list/create/update/delete)
  components/
    schedule/     existing public components
    admin/        DataTable · FormDrawer · ConfirmDialog · SlotForm …
  views/
    HomeView.vue
    admin/        LoginView · DashboardView · SlotsView · InstructorsView
                  ClubsView · ClassTemplatesView · CategoriesView
  router/         public routes + lazy admin routes behind meta.requiresAuth
```

Four changes to existing code this forces, all of which were already worth doing:

1. `useScheduleFilters(dataset)` must accept `MaybeRefOrGetter<ScheduleDataset>` and `toValue()` it, or the search index will never recompute when the fetch resolves.
2. The broken search input gets fixed on the way — `defineModel` in `FilterSidebar`, bound from both the desktop sidebar and the mobile drawer.
3. Filter state moves into the URL query string, which also gives the admin preview a shareable link.
4. `CATEGORY_COLOR` is deleted; colours come from the API.

Admin state uses Pinia (the dependency is already installed and currently unused): one `auth` store, one `ui` store for toasts. Resource data stays local to each view via `useAdminResource`.

---

## 7. Wireframes

**Theme: light mode only.** No dark variant, no system-preference switch. That halves the token surface and removes every "what does this look like inverted" question from the build.

### 7.1 Visual language

Distilled from the reference apps, adapted to what this project actually has.

**Colour tokens (light, final)**

| Token | Value | Contrast on its background |
|---|---|---|
| `--bg` | `#EFF0F0` | page |
| `--surface` | `#FFFFFF` | cards, app bar, bottom nav |
| `--border` | `#CCCCCC` | hairlines only — **never text**, 1.6 on white |
| `--text` | `#221551` | 16.2 on white — AAA |
| `--text-muted` | `#35393D` | 11.6 on white — AAA |
| `--primary` | `#6E38D5` | 6.6 on white — AA |
| `--on-primary` | `#FFFFFF` | 6.6 on primary — AA |
| `--accent` | `#804C9E` | 6.1 on white — AA, for category labels |
| `--ink` | `#000000` | reserved for the wordmark |

`#221551` becomes the primary text colour rather than a background. It reads as near-black with a purple cast, which keeps the brand present without a dark theme. `#000000` is deliberately almost unused — pure black text on an off-white page is harsher than the reference apps.

**Row anatomy.** Every reference converges on the same list row, and this is the one to copy:

```
  TIME      CATEGORY (small caps, --accent)
  duration  Class Name (bold, --text)
            Instructor                    ›
```

Deliberate omissions from the references:
- **No instructor photos.** Reference 1 leans on them heavily; I have 48 instructor names and zero photos, and sourcing them is a privacy question I don't want. Category label carries the colour instead.
- **No spots-remaining badge, no Reserve button.** Those are booking affordances (references 2 and 4). Booking is out of scope, and showing a capacity number I can't verify would be worse than showing nothing.

**Day selection.** References split between a fixed 7-day strip and scrollable date tabs. Fixed strip wins here, because the underlying model is a repeating week — there is no "next month" to scroll to.

### 7.2 Mobile — Schedule (default screen)

```
┌─────────────────────────────────┐
│  ‹    Setiabudi One  ▾      ⚙   │  app bar, --surface
├─────────────────────────────────┤
│   S    M    T    W    T    F   S │
│   5   (6)   7    8    9   10  11 │  selected = --primary pill
├─────────────────────────────────┤
│  Monday, 6 April      10 classes │
│                                  │
│  07:00   MIND-BODY               │
│  60 min  Hatha Yoga              │
│          Ilanda                › │
│  ──────────────────────────────  │
│  18:10   DANCE                   │
│  60 min  Salsation               │
│          Patty                 › │
│  ──────────────────────────────  │
│  19:10   CARDIO                  │
│  60 min  Pound                   │
│          Wulan                 › │
│  ──────────────────────────────  │
│  20:10   MARTIAL · LESMILLS      │
│  55 min  Bodycombat              │
│          Kevin                 › │
│                                  │
├─────────────────────────────────┤
│   ▦         ⚲         ⌕          │
│ Schedule  Studios   Search       │
└─────────────────────────────────┘
```

Three tabs, not five. There is no profile and no saved list in MVP, and padding a nav bar with dead tabs is the fastest way to make a small app feel like a fake one.

The `⚙` is the filter entry point, opening the sheet in §7.3. When filters are active it shows a dot.

### 7.3 Mobile — Filter sheet

```
┌─────────────────────────────────┐
│              ▬▬▬                 │
│  Filters            Reset        │
│                                  │
│  Search                          │
│  [ Class, instructor…         ]  │
│                                  │
│  Time                            │
│  (Any) ( Morning ) ( Evening )   │
│                                  │
│  Category                        │
│  ( yoga )( dance )( strength )   │
│  ( hiit )( cycling )( pilates )  │
│                                  │
│  Instructor                      │
│  [ Select instructors     ▾  ]   │
│                                  │
│  Programme                       │
│  [ LesMills only          ○  ]   │
│                                  │
│  ┌────────────────────────────┐  │
│  │     Show 12 classes        │  │
│  └────────────────────────────┘  │
└─────────────────────────────────┘
```

Day is not in this sheet — the day strip owns it. Club is not either; the app bar owns it. One control, one place.

Needed regardless of design: Escape to close, focus trap, body scroll lock, safe-area padding.

### 7.4 Mobile — Class detail sheet

New screen; the current app has no detail view. Reference 3 is the model.

```
┌─────────────────────────────────┐
│              ▬▬▬                 │
│  MARTIAL CARDIO · LESMILLS       │
│  Bodycombat                      │
│                                  │
│  Monday, 6 April · 20:10         │
│  55 min · Kevin                  │
│                                  │
│  Setiabudi One                   │
│  Jl. H.R. Rasuna Said Kav. 62    │
│  [  Open in Maps  ]              │
│                                  │
│  About                           │
│  cardio · combat · endurance     │
│                                  │
│  Also this week                  │
│  Wed 20:10 · Thu 19:10           │
│                                  │
│  ──────────────────────────────  │
│  Source: @anytimefitness_setia…  │
│  Schedule updated 8 Sep 2026     │
└─────────────────────────────────┘
```

The last two lines are the answer to open question 5. Freshness and provenance live where someone is deciding whether to trust a time, not buried in a footer.

"Also this week" is a cheap query against `schedule_slots` and turns a dead-end screen into a useful one.

### 7.5 Mobile — Studios

```
┌─────────────────────────────────┐
│  Studios                    ⌕    │
├─────────────────────────────────┤
│  JAKARTA SELATAN                 │
│  Setiabudi One                   │
│  12 classes this week          › │
│  ──────────────────────────────  │
│  Sarana Square                   │
│  9 classes this week           › │
│  ──────────────────────────────  │
│  Senopati                        │
│  No schedule yet               › │
│                                  │
│  JAKARTA PUSAT                   │
│  Cikini                          │
│  8 classes this week           › │
└─────────────────────────────────┘
```

Grouped by region, matching how AF themselves organise their club list. "No schedule yet" is honest and also recruits help — it is the natural place for a "know this schedule? send it to me" link.

### 7.6 Desktop (`lg` and up)

Same components, one breakpoint, no separate implementation.

```
┌────────────────────────────────────────────────────────────────┐
│  AF Class Schedule          Schedule  Studios        [ Search ]│
├────────────────────────────────────────────────────────────────┤
│  Setiabudi One ▾                                    ‹ 6–12 Apr ›│
│  Mon 6 | Tue 7 | Wed 8 | Thu 9 | Fri 10 | Sat 11 | Sun 12      │
├──────────────┬─────────────────────────────────────────────────┤
│ FILTERS      │  Monday, 6 April                    10 classes  │
│              │  ┌───────────────────────────────────────────┐  │
│ Search       │  │ 07:00   MIND-BODY                         │  │
│ [__________] │  │ 60 min  Hatha Yoga                        │  │
│              │  │         Ilanda                          › │  │
│ Time         │  └───────────────────────────────────────────┘  │
│ ● Any time   │  ┌───────────────────────────────────────────┐  │
│ ○ Morning    │  │ 18:10   DANCE                             │  │
│ ○ Afternoon  │  │ 60 min  Salsation · Patty               › │  │
│ ○ Evening    │  └───────────────────────────────────────────┘  │
│              │                                                 │
│ Category     │  Tuesday, 7 April                    9 classes  │
│ ☐ yoga       │  ┌───────────────────────────────────────────┐  │
│ ☐ dance      │  │ 17:20   MIND-BODY                         │  │
│ ☐ strength   │  │ 60 min  Gentle Yoga · Dhian             › │  │
│              │  └───────────────────────────────────────────┘  │
│ Instructor   │                                                 │
│ ☐ Ilanda     │                                                 │
│ ☐ Patty …    │                                                 │
│              │                                                 │
│ Programme    │                                                 │
│ [LesMills ○] │                                                 │
└──────────────┴─────────────────────────────────────────────────┘
```

One real difference from mobile: desktop shows the **whole week** in a continuous scroll with day headers, while mobile shows one selected day. There is room for it, and scanning a week is the thing a desktop visitor came for. The day tabs act as scroll anchors rather than filters.

Detail opens as a right-side panel instead of a bottom sheet — same component, different mount point.

### 7.7 Admin — login (`/admin/login`)

```
              ┌─────────────────────────────────┐
              │        AF Schedule Admin        │
              │                                 │
              │  Email                          │
              │  [___________________________]  │
              │                                 │
              │  Password                       │
              │  [___________________________]  │
              │                                 │
              │  ⚠ Email or password is         │
              │    incorrect.                   │
              │                                 │
              │  [        Sign in           ]   │
              └─────────────────────────────────┘
```

One generic error for every failure mode — wrong email, wrong password, locked account. Never "user not found".

### 7.8 Admin — schedule slots (`/admin/slots`)

The primary working screen. Everything else is supporting reference data.

```
┌────────────┬─────────────────────────────────────────────────────────┐
│ AF Admin   │  Schedule slots                     [ + Add slot ]      │
│            │                                                         │
│ ▸ Schedule │  [ Club: Setiabudi One ▾ ] [ Day: All ▾ ] [ Search __ ] │
│   Clubs    │                                                         │
│   Instr.   │  ┌───┬────────┬──────────────┬───────────┬──────┬─────┐ │
│   Classes  │  │Day│ Time   │ Class        │Instructor │Status│     │ │
│   Categor. │  ├───┼────────┼──────────────┼───────────┼──────┼─────┤ │
│   Tags     │  │Mon│ 07:00  │ Hatha Yoga   │ Ilanda    │Active│ ⋮   │ │
│            │  │Mon│ 18:10  │ Salsation    │ Patty     │Active│ ⋮   │ │
│ ─────────  │  │Mon│ 19:10  │ Pound        │ Wulan     │Active│ ⋮   │ │
│ ⚠ 3 unpub- │  │Mon│ 20:10  │ Bodycombat   │ Kevin     │Active│ ⋮   │ │
│   lished   │  │Tue│ 17:20  │ Gentle Yoga  │ Dhian     │Paused│ ⋮   │ │
│ [Publish]  │  └───┴────────┴──────────────┴───────────┴──────┴─────┘ │
│ ─────────  │                                                         │
│ abed@…     │  Showing 1–20 of 55          [ ‹ 1 2 3 › ]              │
│ Sign out   │                                                         │
└────────────┴─────────────────────────────────────────────────────────┘
```

Row menu `⋮`: Edit · Duplicate · Pause · Delete. Duplicate matters more than it sounds — most new slots are an existing slot moved to another day.

The unpublished-changes banner and Publish button implement §4's snapshot model. It is always visible in the sidebar, because a schedule edit that was never published is the single most likely way this system silently fails.

### 7.9 Admin — slot form (right-side drawer)

```
                    ┌──────────────────────────────────────┐
                    │  Edit slot                        ✕  │
                    │                                      │
                    │  Club *                              │
                    │  [ Setiabudi One              ▾ ]    │
                    │                                      │
                    │  Class *                             │
                    │  [ Bodycombat                 ▾ ]    │
                    │  ⓘ LesMills · martial-cardio · 55m   │
                    │                                      │
                    │  Day *          Start time *         │
                    │  [ Monday  ▾ ]  [ 20:10       ]      │
                    │                                      │
                    │  Duration (min)  Room                │
                    │  [ 55         ]  [ Studio 1     ]    │
                    │                                      │
                    │  Instructors *                       │
                    │  [ Kevin ✕ ] [ + add instructor ]    │
                    │  ⓘ Only instructors assigned to      │
                    │    this club are listed.             │
                    │                                      │
                    │  Effective from   Effective to       │
                    │  [ 2026-04-01 ]   [ (ongoing)   ]    │
                    │                                      │
                    │  Status  ( Active ) ( Paused )       │
                    │                                      │
                    │  ⚠ Studio 1 already has a class at   │
                    │    20:10 on Monday.                  │
                    │                                      │
                    │  [ Cancel ]          [ Save slot ]   │
                    └──────────────────────────────────────┘
```

Conflict detection runs server-side on save (the partial unique index) and is surfaced as a 409, not only as a client-side hint.

### 7.10 Admin — instructors (`/admin/instructors`)

```
┌────────────┬─────────────────────────────────────────────────────────┐
│ AF Admin   │  Instructors                    [ + Add instructor ]    │
│            │  [ Search ______ ] [ Club: All ▾ ] [ Status: Active ▾ ] │
│            │                                                         │
│            │  ┌──────────────┬────────────────────┬────────┬───────┐ │
│            │  │ Name         │ Clubs              │ Slots  │       │ │
│            │  ├──────────────┼────────────────────┼────────┼───────┤ │
│            │  │ Ilanda       │ Setiabudi One      │   4    │  ⋮    │ │
│            │  │ Dhian        │ Setiabudi, Cikini  │   7    │  ⋮    │ │
│            │  │ Kevin        │ Setiabudi One      │   3    │  ⋮    │ │
│            │  └──────────────┴────────────────────┴────────┴───────┘ │
└────────────┴─────────────────────────────────────────────────────────┘
```

The **Slots** count is the guardrail: deleting an instructor with slots is blocked, and the number tells the admin why before they try.

Clubs, class templates, categories, and tags follow the same list + drawer pattern. One `DataTable` and one `FormDrawer` component serve all six screens.

## 8. Non-functional notes

**Performance.** 55 rows today, maybe 2,000 if all 56 clubs are populated. A single indexed query per week per club. No caching layer beyond HTTP; adding Redis at this size would be cost without benefit.

**Materialising a week.** `/schedule` expands recurring slots into dated occurrences server-side using the club's timezone. Doing it on the server keeps the frontend free of date arithmetic and keeps one source of truth for what "this week" means. Times are returned as wall-clock strings (`"07:00"`) plus a date, never as UTC instants — the current frontend already avoids `Date` parsing for exactly this reason, and that instinct was correct.

**Errors.** Every unhandled error returns a generic 500 with a correlation ID; the detail goes to logs only. Stack traces never reach the client.

**Testing.** Vitest. Priority order: (1) week materialisation and timezone handling, (2) filter logic in `utils/schedule.ts`, (3) auth middleware — session valid, expired, missing, wrong CSRF, (4) validation schemas. Integration tests hit a throwaway Postgres via testcontainers or a scratch Neon branch.

**Observability.** Structured JSON logs, a `/health` endpoint returning DB connectivity, and error tracking (Sentry free tier) on both frontend and API.

---

## 9. Migration & seed plan

**The existing `src/data/schedule.json` is discarded.** It is one stale week for three clubs, and every club is being re-transcribed from its current official timetable anyway. Nothing is migrated; the database is seeded from scratch.

1. Write Drizzle migrations for every table in §3.
2. Seed `clubs` with all ~56 AF Indonesia branches. Names, regions, and status come from AF's own club list; address, phone, and `af_club_code` come from each club's `anytimefitness.id/gyms/{code}/...` page, which is machine-readable. Most clubs will have zero slots — that is fine and makes the admin immediately useful.
3. Seed `categories`, including `mobility`, which the first transcribed timetable added.
4. Transcribe each club's timetable graphic into one JSON file per club (`seed/{club-slug}.json`), carrying `effective_from`, `schedule_source_url`, `schedule_captured_at`, and a `_review_queue` of anything not directly observable.
5. **Source conflicts are escalated, never auto-resolved.** The Linktree is AF's own link hub but is known to contain wrong entries, so no source outranks another by default. Where two sources disagree on a club's Instagram handle, name, or code, the record is flagged `instagram_verified: false` and left for the owner to settle. Silently picking a winner is how a club ends up permanently linked to the wrong account.
6. A validation script runs before insert and reports: class names not yet in `class_templates`, instructor names within edit-distance 1 of an existing name, slots overlapping at the same club once durations are applied, and any slot missing a required field.
7. **Model validation gate:** seed the first two clubs only, then render `/schedule` for a week and compare it against the source graphics by eye. If anything is lossy or awkward, the schema is wrong and changing it is still free. Do this before building any admin screen.
8. Seed one admin user from `ADMIN_SEED_PASSWORD`; rotate immediately after first login.

## 10. Milestones

| M | Scope | Done when |
|---|---|---|
| **M0** | Repo restructure (`apps/web`, `apps/api`), Drizzle schema, migrations, club seed, transcription validator | Two clubs seeded from transcribed timetables; `/schedule` renders a week that matches the source graphics |
| **M1** | Public read API + frontend switches from JSON import to fetch. Fixes the broken search, URL filter state, `MaybeRefOrGetter` refactor | Public page works identically, fed by the API |
| **M2** | Auth: login, logout, `/me`, sessions, CSRF, rate limit, route guard, admin shell | Can log in and out; `/admin` is unreachable logged out, verified server-side |
| **M3** | CRUD for slots, instructors, clubs, class templates, categories, tags | A schedule change made in admin appears on the public page within a minute |
| **M4** | Hardening: validation coverage, conflict detection, security headers, health check, error tracking, deploy | Deployed, with tests on the four priority areas |

**── MVP STOP LINE ──**

Phase 2 candidates, in the order I'd actually want them: slot exceptions (cancel/substitute for one date), audit log, soft delete, instructor detail pages, favourites via localStorage, iCal export, week grid view, editor role.

---

## 11. Open questions

1. **Repo layout** — monorepo (`apps/web` + `apps/api`) or a separate backend repo? Monorepo assumed; it keeps shared TypeScript types in one place, which is most of the value.
2. **Shared types** — publish a `packages/shared` with the API response types consumed by both sides, or generate the client from a Zod-derived OpenAPI spec? The second is more elegant and more work.
3. **Club scope on the public page** — one club at a time via selector, or all clubs at once with a club filter as today? The wireframe assumes a selector, which scales to 56 clubs; the current behaviour does not.
4. **Public launch posture.** §1.1 commits to promoting this publicly, and the data is transcribed from Anytime Fitness's own Instagram posts. That is fine for a personal tool and a different proposition once strangers rely on it. Minimum before promoting: a visible "unofficial, not affiliated with Anytime Fitness" line, a per-club "last updated" date, and a link out to each studio's Instagram as the source of truth. Decide whether to notify AF — worst case they ask me to take it down, best case they find it useful.
5. **Stale data is the main product risk, not a technical one.** The whole value proposition is trusting the app instead of Instagram. A wrong class time costs a member a trip to the gym, and one of those undoes the habit permanently. Per-club freshness indicators are a Phase 2 item that behaves like a Phase 1 item.

---

*End of document. Review §0 assumptions first — flipping decision 1 or 2 rewrites most of what follows.*
