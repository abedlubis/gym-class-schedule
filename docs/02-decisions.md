# Decisions

**Classification: INTERNAL**

Every decision that shaped the build, with the reason. Several were reversed
mid-project when evidence arrived; those are marked. Read this before proposing
an architectural change — the obvious alternatives were mostly considered.

---

## Architecture

**Node + TypeScript (Hono) + Postgres + Drizzle, not Supabase.**
Supabase would have been faster to ship. The owner's stated goal for the project
is practising system design end to end, so writing the schema, migrations and
auth is the point rather than overhead.

**Recurring slots, not absolute datetimes.** *(schema-defining)*
The v1 dataset stored one specific week as absolute datetimes. Because those
dates spanned two calendar weeks, sorting produced a Wed→Tue timeline. Slots now
store `weekday` + local `start_time`; the API materialises a dated ISO week.
Retrofitting this later would have meant rewriting every endpoint.

**Week materialisation happens server-side.**
One definition of "this week", and the frontend does no date arithmetic. Times
are returned as wall-clock strings plus a date, never UTC instants — a 07:00
class in Jakarta must read 07:00 to someone in Denpasar.

**Published static snapshot, not live API reads.** *(reversed)*
Originally specified as live fetch. Reversed once free hosting was confirmed as a
hard constraint: free API tiers cold-start or cap CPU, and neither is acceptable
for a page someone opens standing in a gym lobby. The endpoints still exist and
the publish step consumes them.
*Status: designed, endpoints built, the snapshot renderer itself is not written.*

**Light mode only.** Halves the token surface and removes every "what does this
look like inverted" question.

---

## Data model

**`instructor_status: confirmed | tba`.** *(added from evidence)*
Studios publish timetables before deciding who teaches — the cell is blank or
reads "Coach", "PT Team", "ALL PT". 38 slots across 11 clubs; at Gandaria it is
the entire timetable. This is the club's answer, not a gap, so it is a state
rather than an empty join. Consequences: the card shows "Instructor TBA", the
admin does not reject the save, the seed validator does not flag it.

**`duration_source: printed | capped | assumed`.** *(added from evidence)*
AF graphics almost never print durations. 60 minutes is the standing default,
capped where the next class at that club starts sooner. Puri Indah CNI prints
explicit ranges and every one is exactly 60 minutes, which is the only direct
confirmation. The column records measurement versus assumption so a later reader
can tell them apart.

**`class_templates.family`.** *(added from evidence)*
Branches name the same class differently: 128 distinct names across 1,040 slots,
63% appearing at only one club, nine names for yoga alone. Filtering on raw names
is useless across branches. 13 hand-mapped families cover everything. The public
filter offers families; **the card still shows the club's own printed name**,
because that is what is on the studio door.

**Instructor nicknames are globally unique.**
Owner's call, and correct — trainers genuinely cover several branches. One
`instructors` row plus several `instructor_clubs` rows. The guard against two
coaches sharing a nickname is a confirm dialog in the admin, not a schema
constraint.

**No `tags` table.** The design doc specifies one; zero transcribed slots carry
tags. That data came from the discarded v1 sample. One-line migration when there
is data.

**No `slot_exceptions`.** Phase 2. Schema shape is described in the design doc.

**Distinct category hues, not brand tints.** *(reversed)*
Purple tints were specified first for palette coherence. Wrong — with 9
categories, nine purple badges cannot be told apart at a glance, which defeats
the badge. Now green/pink/orange/blue/red/teal/violet/amber, admin-editable.

---

## Auth

**Opaque session id in Postgres, httpOnly cookie — not a JWT.**
Revoking is a `DELETE`. A JWT cannot be revoked and is readable by any XSS.
Sliding 7-day expiry, hard 30-day cap.

**argon2id via WASM (`hash-wasm`), not a native binding.**
Native builds are the first thing to break on a free tier.

**Sign-in uses an Origin check, not double-submit CSRF.** *(bug, then fix)*
The first implementation put double-submit on every mutation including login. A
first-time visitor has no CSRF cookie, so the check can never pass — login was
impossible and 15 tests failed with 401s that looked like a password problem.
Split into `requireOrigin` (sign-in) and `requireCsrf` (everything else).
Login-CSRF is covered by the Origin allowlist plus SameSite=Lax.

**One generic message for every login failure.** Wrong email, wrong password and
disabled account are indistinguishable, and the server hashes even when the user
does not exist so timing matches. Otherwise the endpoint enumerates accounts.

**The Vue route guard is UX, not a boundary.** Every `/admin` request re-checks
the session server-side.

**In-memory rate limiter, accepted as single-instance.**
5 attempts / 15 minutes per IP+email. On serverless each instance keeps its own
counter, so the limit is per-instance. Accepted: it guards a login only the owner
uses, and Redis would add a paid dependency to stop an attack that has not
happened. Upstash has a free tier if that changes.

---

## Product scope

**No booking, no capacity badges, no Reserve button.**
Two reference apps have them and two clubs publish capacity, but you cannot book
through this. A dead button is worse than no button.

**No instructor photos.** 477 names, no photos, and sourcing headshots of real
trainers is a privacy problem nobody asked for.

**No favourites.** Needs storage and identity.

**Two bottom-nav tabs, not five.** There is no profile and no saved list. Padding
a nav bar with dead tabs is the fastest way to make a small app feel fake.

**Provenance is a feature.** The class detail sheet carries the source studio, an
Instagram link, whether the club has gone quiet, and whether the duration was
assumed. It sits where someone decides whether to trust a time.

---

## Source-data policy

**Conflicts are escalated, never auto-resolved.**
AF's official Linktree is the main source for club Instagram handles but is known
to be wrong. Both times a conflict was checkable against a post header, the
Linktree lost. Conflicting records are flagged `instagram_verified: false` and
left for the owner. Silently picking a winner is how a club ends up permanently
linked to the wrong account.

**Fanindo Sanctuary is excluded.** It publishes complimentary GX and HYROX boards
rather than a standard studio timetable. Recorded in `clubs.json` as a decision.

---

## Signature visual idea

AF prints a purple vertical time column down the left of every timetable graphic.
The class list borrows it: time and duration sit in a fixed left rail against a
hairline, so a week scans down one spine. It is the only place any boldness was
spent. Type is Archivo, with tabular figures everywhere a time or count appears.

---

## Bugs found during the build, worth not reintroducing

1. **Search was dead in v1.** The sidebar bound its input to a local ref that was
   never emitted. Desktop and mobile also held separate search state. Fixed with
   `defineModel` and one shared `FilterPanel`.
2. **`useScheduleFilters` took a plain object**, so the search index was built
   once at setup and never rebuilt — harmless with a build-time import, broken
   the moment data arrived by fetch. Now `MaybeRefOrGetter` + `toValue`.
3. **A Drizzle correlated subquery in a select projection returned 0** for every
   club's class count. The same SQL by hand worked. Replaced with a grouped
   count. It fails *quietly* — 200 with plausible data. Two regression tests.
4. **24 class templates silently lost their `family`** because the field was
   added mid-transcription. Caught by a test, not by review. 101 slots backfilled.
5. **Nothing loaded `.env`.** `tsx` does not read it and it was never wired up.
   Now `process.loadEnvFile` in the db client.
6. **`DB_DIRECT=1 tsx ...` in package.json is not cross-platform.** Scripts set
   the variable themselves now.
7. **An edit-distance-1 duplicate-name check fired 112 times** across 477 names,
   almost all false positives (Tia/Tina/Tika are three real people). Scoped to
   names at the same club: 10 hits, all worth a look. A noisy check trains people
   to ignore warnings.
