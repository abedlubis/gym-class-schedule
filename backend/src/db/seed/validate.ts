import {
  durationSourceOf,
  loadClubSchedules,
  loadReference,
  minutes,
  type ClubSchedule,
} from './load.js'

export type Finding = {
  level: 'error' | 'warn' | 'info'
  club: string
  message: string
}

/** Levenshtein distance, capped — we only care about "is this ≤ 1 apart". */
function withinOne(a: string, b: string): boolean {
  if (a === b) return false
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  let j = 0
  let edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++
      j++
      continue
    }
    if (++edits > 1) return false
    if (a.length > b.length) i++
    else if (a.length < b.length) j++
    else {
      i++
      j++
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1
}

export function validate(): Finding[] {
  const { clubs, templates } = loadReference()
  const schedules = loadClubSchedules()
  const findings: Finding[] = []

  const clubBySlug = new Map(clubs.clubs.map((c) => [c.slug, c]))
  const categorySlugs = new Set(templates.categories.map((c) => c.slug))
  const templateByName = new Map(templates.class_templates.map((t) => [t.name, t]))

  // ---- reference integrity -------------------------------------------------
  for (const t of templates.class_templates) {
    if (!categorySlugs.has(t.category)) {
      findings.push({
        level: 'error',
        club: '(templates)',
        message: `class template "${t.name}" references unknown category "${t.category}"`,
      })
    }
  }

  const seeded = new Set(schedules.map((s) => s.data.club.slug))
  for (const c of clubs.clubs) {
    if (seeded.has(c.slug)) continue
    if (c.status === 'open' && !c.schedule_excluded) {
      findings.push({
        level: 'warn',
        club: c.slug,
        message: 'club is open but has no timetable file',
      })
    }
  }

  // ---- per-club ------------------------------------------------------------


  for (const { file, data } of schedules) {
    const slug = data.club.slug
    const club = clubBySlug.get(slug)

    if (!club) {
      findings.push({
        level: 'error',
        club: slug,
        message: `${file} has no matching entry in clubs.json`,
      })
    } else if (club.schedule_excluded) {
      findings.push({
        level: 'error',
        club: slug,
        message: 'club is marked schedule_excluded but a timetable file exists',
      })
    }

    if (data.slots.length !== data.schedule.slot_count) {
      findings.push({
        level: 'error',
        club: slug,
        message: `slot_count says ${data.schedule.slot_count} but file holds ${data.slots.length}`,
      })
    }

    if (!data.schedule.effective_from) {
      findings.push({
        level: 'warn',
        club: slug,
        message: 'no effective_from — the graphic did not print one',
      })
    }
    if (data.schedule.staleness_warning) {
      findings.push({
        level: 'warn',
        club: slug,
        message: `stale timetable: ${data.schedule.staleness_warning.detail}`,
      })
    }
    if (data.schedule.known_gap) {
      findings.push({
        level: 'warn',
        club: slug,
        message: `known gap in source: ${data.schedule.known_gap.user_facing}`,
      })
    }

    checkSlots(data, findings)

    for (const s of data.slots) {
      if (!templateByName.has(s.class_name)) {
        findings.push({
          level: 'error',
          club: slug,
          message: `class "${s.class_name}" is not in class-templates.json`,
        })
      }

      if (s._review) {
        findings.push({ level: 'info', club: slug, message: `review: ${s._review}` })
      }
    }
  }

  // ---- instructor near-duplicates -----------------------------------------
  // Guard against "Sendi" / "Sendy" quietly becoming two people under the
  // globally-unique-nickname rule.
  //
  // Scoped deliberately to names appearing at the SAME club. Indonesian
  // nicknames are short, so a global edit-distance-1 sweep over 477 names
  // fires 112 times and is almost entirely false positives (Tia/Tina/Tika are
  // three real people). Two near-identical names on one club's timetable is a
  // far stronger signal — that is where a transcription typo would land.
  for (const { data } of schedules) {
    const local = [
      ...new Set(data.slots.flatMap((s) => s.instructors)),
    ].sort()
    for (let i = 0; i < local.length; i++) {
      for (let j = i + 1; j < local.length; j++) {
        const a = local[i]!
        const b = local[j]!
        if (b.length - a.length > 1) break
        if (withinOne(a.toLowerCase(), b.toLowerCase())) {
          findings.push({
            level: 'info',
            club: data.club.slug,
            message: `"${a}" and "${b}" both teach here and differ by one character — same person?`,
          })
        }
      }
    }
  }

  return findings
}

function checkSlots(data: ClubSchedule, findings: Finding[]) {
  const slug = data.club.slug
  const byDay = new Map<number, typeof data.slots>()
  for (const s of data.slots) {
    if (!byDay.has(s.weekday)) byDay.set(s.weekday, [])
    byDay.get(s.weekday)!.push(s)

    if (s.instructors.length === 0 && s.instructor_status !== 'tba') {
      findings.push({
        level: 'error',
        club: slug,
        message: `slot ${s.class_name} has no instructors but is not marked tba`,
      })
    }
    if (durationSourceOf(s) === 'assumed' && s.duration_min !== 60) {
      findings.push({
        level: 'warn',
        club: slug,
        message: `slot ${s.class_name} is ${s.duration_min} min but marked as assumed`,
      })
    }
  }

  for (const [day, slots] of byDay) {
    const sorted = [...slots].sort((a, b) => minutes(a.start_time) - minutes(b.start_time))
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i]!
      const b = sorted[i + 1]!
      if (minutes(a.start_time) === minutes(b.start_time)) {
        findings.push({
          level: 'error',
          club: slug,
          message: `two classes at ${a.start_time} on weekday ${day}: ${a.class_name} / ${b.class_name}`,
        })
      } else if (minutes(a.start_time) + a.duration_min > minutes(b.start_time)) {
        findings.push({
          level: 'error',
          club: slug,
          message: `${a.class_name} at ${a.start_time} (${a.duration_min}m) overlaps ${b.class_name} at ${b.start_time}`,
        })
      }
    }
  }
}

/* ---------------------------------------------------------------- reporter */

function main() {
  const findings = validate()
  const errors = findings.filter((f) => f.level === 'error')
  const warns = findings.filter((f) => f.level === 'warn')
  const infos = findings.filter((f) => f.level === 'info')

  for (const group of [errors, warns, infos]) {
    for (const f of group) {
      const tag = f.level.toUpperCase().padEnd(5)
      console.log(`${tag} ${f.club.padEnd(26)} ${f.message}`)
    }
  }

  console.log(
    `\n${errors.length} error(s), ${warns.length} warning(s), ${infos.length} note(s)`,
  )
  if (errors.length > 0) {
    console.log('Import blocked. Fix the errors above, then re-run.')
    process.exitCode = 1
  } else {
    console.log('Safe to import.')
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main()
