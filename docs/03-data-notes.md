# Data notes

**Classification: INTERNAL**

How the dataset was produced, what is flagged, and where it is thin.

---

## Provenance

Every timetable was **transcribed by hand from a screenshot** of the club's own
Instagram post. There is no scraping: Instagram blocks automated access at the
domain level, and the schedule is an image anyway, so the page HTML would not
contain the times.

Club names, regions and Instagram handles came from AF Indonesia's official
Linktree. Club codes (`ID-0045`) and addresses came from `anytimefitness.id/gyms/`
pages, which are machine-readable.

**Transcription accuracy has one independent check.** Kebon Jeruk was transcribed
twice from different screenshots in different batches and matched exactly on all
10 slots — day, time, class and instructor. That is the only error-rate evidence
there is, and it is a sample of one club.

## Where the files are

`backend/src/db/seed/sources/` — 57 club timetables plus:

- `clubs.json` — all 62 clubs, including the 5 with no timetable
- `class-templates.json` — 128 class names, 9 categories, 13 families

Each club file records `effective_from`, the Instagram handle, and any flag. Each
slot records `_duration_source` and, where relevant, `_note` or `_review`.

## Per-club inventory

```
club                         slots  effective    flags
akr-tower                       10  2026-09-01   
antasari-place                  15  2026-09-01   
bella-terra                     19  2026-09-01   
bintaro-junction                18  2026-06-01   STALE: Graphic is effective June 2026 and was posted 2026-06-03. Every other 
bintaro-plaza                   20  2026-09-01   
cibinong-city-mall              16  2026-09-02   
cikini                          13  —            GAP: Cikini's published schedule hides one time slot.; NO EFFECTIVE DATE
citimall-cimanggis              20  2026-09-01   
citra-kemayoran                 19  2026-09-01   
citywalk-elvee                  13  2026-09-01   
citywalk-sudirman               20  2026-09-01   
concourse-alam-sutera           15  2026-09-01   
de-ritz-menteng                  5  2026-09-01   NOTE: Graphic has Monday, Wednesday, Thursday and Friday columns only — no T
eastvara-bsd                    20  2026-09-01   4 TBA
festival-citylink               23  2026-09-01   
gandaria                        21  2026-09-01   21 TBA; NOTE: Graphic prints class logos only — no instructor names anywhere on it.
grand-galaxy-park               19  2026-09-01   
grand-kota-bintang              21  2026-09-01   
green-sedayu-mall               23  2026-09-01   
greenville                      21  2026-09-01   NOTE: Graphic has Monday-Saturday columns only; no Sunday classes published.
harapan-indah-avenue            16  2026-09-01   1 TBA
heritage-riau                   25  2026-09-01   
hublife-taman-anggrek           15  2026-08-01   STALE: August 2026 timetable; September not yet posted at capture time.
jtown-jatinegara                16  2026-09-02   
la-codefin-kemang               14  2026-09-01   
lippo-mall-nusantara            18  2026-09-02   
lippo-plaza-keboen-raya         19  2026-09-01   
living-world-denpasar           21  2026-09-01   
living-world-grand-wisata       14  2026-09-01   
living-world-kota-wisata        20  2026-09-01   
mall-of-indonesia               15  —            GAP: AF Mall Of Indonesia's published schedule hides part of the day.; NO EFFECTIVE DATE
mampang                          7  2026-09-01   NOTE: Graphic has Monday-Friday columns only; no weekend classes published.
mekarwangi-junction             30  2026-08-01   STALE: August 2026 timetable; September not yet posted at capture time.; 1 TBA; NOTE: Graphic has Monday-Saturday columns only; no Sunday classes published.
menara-cakrawala                21  2026-09-11   
one-district-puri               22  2026-09-01   
pakuwon-city-mall               17  2026-09-01   
paradise-walk-serpong           23  2026-09-04   
pasaraya-blok-m                 10  2026-09-01   NOTE: Graphic has Monday-Friday columns only; no weekend classes published.
pesona-square-mall              21  2026-09-01   
puri-indah-cni                  18  2026-09-01   NOTE: Graphic has Monday-Saturday columns only, and is the first club to pri
qbig-bsd-city                   22  2026-09-01   
queen-city-mall                 18  2026-09-01   1 TBA
revo-mall                       13  2026-09-01   
rosthen-garden-slipi            19  2026-09-01   
sakura-garden-city              21  2026-09-01   
sarana-square                   18  2026-08-01   STALE: August 2026 timetable; September not yet posted at capture time.
sedayu-city                     23  2026-09-01   2 TBA
senopati                        15  2026-09-01   3 TBA
setiabudi-one                   22  2026-09-01   
simatupang                      15  —            NO EFFECTIVE DATE; NOTE: Graphic says '2026 Group Class Schedule' with no month — effective dat
sopo-del-mega-kuningan          20  2026-09-01   1 TBA; NOTE: Graphic has no Sunday column at all.
south78                         20  2026-09-04   
spazio                          17  2026-09-01   1 TBA
summarecon-mall-bandung         22  2026-09-01   1 TBA
sunter-mall                     19  2026-09-01   
the-amboja                      30  2026-09-01   1 TBA
the-hive-cawang                 13  2026-09-01   1 TBA

```

## Totals

```
TOTAL slots 1040
TBA slots 38
durations {30: 2, 44: 1, 45: 3, 50: 2, 60: 1032}
duration_source {'assumed': 1014, 'capped': 8, 'printed': 18}
clubs registry 62 {'open': 58, 'coming_soon': 2, 'presale': 2}
not seeded ['kalibata-city', 'trans-park-juanda', 'tenth-avenue-mall', 'plaza-renon-bali', 'fanindo-sanctuary']
templates 128 | categories ['cardio', 'cycling', 'dance', 'kids', 'martial', 'mobility', 'pilates', 'strength', 'yoga']
families {'Dance': 36, 'Conditioning': 30, 'Cardio': 21, 'Yoga': 16, 'Martial Arts': 7, 'Pilates': 6, 'Zumba': 3, 'Kids': 3, 'Cycling': 2, 'Bodycombat': 1, 'Bodypump': 1, 'Mobility': 1, 'RPM': 1}
```

## Known gaps and flags

**4 clubs on stale timetables.** Bintaro Junction is the worst — June 2026, three
months behind everyone else, and its graphic was a video overlay so one slot
(Sunday Muay Thai) is medium confidence on placement. It is flagged
`severity: high` and **should not be published** until confirmed.

**2 clubs have a redaction in the source artwork.** Cikini and Mall of Indonesia
both publish graphics with a solid black bar painted over one or more time rows.
This is the club's own edit, not a capture error — re-screenshotting does not
help. Recorded as `known_gap: redacted_in_source` with user-facing copy.

**2 clubs print no effective date.** Cikini and Simatupang. Slots with no
`effective_from` are treated as always in force.

**5 clubs have no timetable.** Four are presale or coming-soon. The fifth,
Fanindo Sanctuary, was excluded deliberately — it runs complimentary GX and HYROX
boards rather than a standard timetable.

**2 slots at Citywalk Elvee are guesses.** Monday and Friday 19:00 show a small
red martial-arts badge with no legible text. Stored as "Martial Arts" and flagged
`_review`. One answer from someone who trains there fixes both.

## Things that are not people

Some instructor cells hold crews or placeholders rather than individuals:

- **Crews:** `RX Team`, `MRDC` (and `Rafli MDRC` / `Nadhim MRDC` — the same suffix
  spelled two ways in one graphic), `IL Tsar`, `Rightstep`
- **ZIN prefix:** `Zin Lesta`, `Zin Anty`, `Zin Kiki`, `Zin Eka`, `Zin Jessy` —
  Zumba Instructor Network
- **Placeholders**, stored as TBA with no instructor: `Coach AF`, `AF Coach`,
  `PT Team`, `ALL PT`, `Personal Trainer`, bare `Coach`

All stored verbatim. Whether a crew should be an instructor row or a separate
affiliation is an open question, deliberately unanswered.

## Near-duplicate names worth checking

The seed validator reports names differing by one character **at the same club**,
which is where a transcription typo would land. Current hits include `Reni`/`Rini`
at Sedayu City, `Lila`/`Lita` at Citra Kemayoran, `Mona`/`Mora` at Citywalk
Sudirman. A global sweep across all 477 names fires 112 times and is almost
entirely false positives — do not widen the check.

## Format oddities

- `de-ritz-menteng` runs 5 classes a week, Mon/Wed/Thu/Fri only
- `pasaraya-blok-m`, `mampang` — weekdays only, no weekend columns
- `puri-indah-cni`, `greenville`, `mekarwangi-junction`, `sopo-del-mega-kuningan`
  — no Sunday column at all
- `puri-indah-cni` is the only club printing explicit time ranges
- Two clubs publish per-class capacity (Amboja, Kota Bintang). Not seeded —
  booking is out of scope.

## Re-running the pipeline

```bash
cd backend
npm run seed:validate    # report; errors block the import, exits non-zero
npm run seed:import      # truncate and reload
```

The importer is deliberately destructive. That is correct while the seed files
are the only source of truth; it becomes an upsert keyed on
`(club, weekday, start_time)` once the admin creates data that matters.
