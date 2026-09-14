# Next steps

**Classification: INTERNAL**
In priority order. Items are sized roughly.

---

## 1. Look at it — half an hour

Nobody has seen the running app. Every visual decision was verified by typecheck
and build only. Run `npm run dev` in both packages and check, on a real phone:

- the time rail width and whether the list scans cleanly
- the day strip on a narrow screen
- the class detail sheet, especially the provenance block at the bottom
- the admin slot form at mobile width

This is the cheapest source of real information available and it is blocking
nothing else.

## 2. Validate the data against reality — an hour

Open Setiabudi One in the app and compare it to a class actually attended. That
is the only end-to-end check of the whole chain — transcription, import,
materialisation, render — against ground truth.

## 3. Deploy — half a day

Follow `04-deployment.md`. Deploy the backend first, since the frontend rewrite
needs its domain.

## 4. Answer the open data questions — owner input, not code

- Citywalk Elvee Mon/Fri 19:00: what is the red martial-arts class?
- Are `Reni`/`Rini`, `Lila`/`Lita`, `Mona`/`Mora` the same people?
- Should crew names (`RX Team`, `MRDC`) be instructor rows or an affiliation?
- `MDRC` or `MRDC` — which spelling is right?
- Bintaro Junction: is June still current, or did they stop posting?
- Cikini and Mall of Indonesia: what is under the black bars?

## 5. Fill the remaining clubs — ongoing

4 presale/coming-soon clubs will need timetables when they open. 4 stale clubs
need re-screenshotting when they post again.

Once the admin is deployed, new timetables should be typed into the admin rather
than added as seed files. The seed pipeline was for bootstrapping.

---

## Backlog, roughly in value order

**Publish/snapshot renderer.** The design's answer to free-tier cold starts.
Admin writes render static JSON per club per week; the public app fetches those
instead of the API. Endpoints and version counter already exist.

**Per-club freshness on the public list.** The Studios screen shows class counts;
it should show how old each timetable is. The data is there.

**`slot_exceptions`.** One-off cancellations and substitutes. The most requested
thing a schedule app lacks, and the schema shape is already described.

**Instructor detail pages.** 477 instructors, many teaching at several branches.
"Where else does Ilanda teach" is a natural question the data can already answer.

**iCal export.** Turns a schedule into something that lives in a phone calendar.

**Generated client types.** `frontend/src/types/schedule.ts` hand-mirrors the API
response shape. Now that the two are separate folders, nothing stops them
drifting, and the symptom is `undefined` on screen rather than a type error.
Worth doing when it starts to bite, not before.

**Audit log, soft delete, editor role.** All deferred deliberately. The schema
has a `role` column ready.

---

## Things deliberately not on this list

Booking, capacity, member accounts, payments, image upload, push notifications, a
native app, i18n. See `02-decisions.md` for why.
