# Claude Code Instructions — Opinionated Version for Generating a Full Vue 3 Schedule App

## How to Work
You are generating a real project inside Visual Studio Code.

Follow these rules while working:
- **Create files directly** when they are clearly required for the project.
- **Ask before deleting existing files** or making destructive refactors.
- **Show diff summaries** after meaningful groups of changes.
- **Prefer shadcn-vue** for reusable UI primitives when it improves speed and consistency.
- **Keep components under 200 lines when possible**.
- Prefer small, focused components over one large file.
- Prefer composables and utility helpers over duplicated logic.
- Favor maintainable code over clever code.
- If a choice is ambiguous, choose the simpler implementation that keeps the app easy to extend.

When editing:
- Reuse existing files if they already fit the target architecture.
- Do not rewrite the entire project if only a subset needs to change.
- Preserve existing user code unless it conflicts with the requested architecture.
- If something must be replaced, explain why briefly before doing it.

When reporting progress:
- Summarize what files were created or changed.
- Summarize the functional impact of the changes.
- Mention any assumptions that affect behavior.

---

## Goal
Build a complete single-page application in **Vue 3 + TypeScript** that displays and filters a fitness class schedule from a JSON dataset.

The app should feel modern, clean, fast, and production-ready enough for a personal project or internal tool MVP.

The main use case:
- Show class schedule across multiple locations
- Filter by location, category, instructor, tags, day, and time range
- Support special filtering for `LesMills`
- Render schedule in a clean timeline-first UI
- Be easy to extend later with weekly grid view, favorites, and detail drawer

---

## Tech Stack Requirements
Use the following stack:
- **Vue 3**
- **TypeScript**
- **Vite**
- **Tailwind CSS**
- **Composition API** everywhere

State management:
- Prefer **local composables** first
- Use **Pinia** only if there is a clear need for shared global state

Routing:
- Use **Vue Router** only if needed
- For MVP, a single route is acceptable

UI layer:
- **Prefer shadcn-vue**
- Acceptable fallback: **Headless UI + Tailwind**
- Final fallback: pure Tailwind components

Do not over-engineer the stack.

---

## Delivery Expectation
Generate a full project with real files, not a conceptual draft.

That means:
- create the actual source files
- wire up imports correctly
- include working config files
- include a sample JSON dataset
- include a README
- make the app runnable with normal npm commands

Do not stop at architecture notes unless the user explicitly asks for architecture only.

---

## Project Objective
Create a schedule exploration app called something like:
- `Fitness Class Schedule`
- or `Class Discovery Board`

The application should:
1. Load schedule data from a local JSON file
2. Normalize and type the data properly
3. Display the classes in a **timeline grouped by weekday**
4. Provide **fast filtering**
5. Be responsive on desktop and mobile
6. Use reusable components and a clean folder structure
7. Be easy to run in Visual Studio Code with standard npm scripts

---

## Dataset Expectations
The app will consume a merged JSON dataset with this shape:

```json
{
  "meta": {
    "effective_from": "2026-04-01",
    "timezone": "Asia/Jakarta",
    "locations": ["Setiabudi One", "Sarana Square", "Cikini"],
    "notes": []
  },
  "classes": [
    {
      "id": "setiabudi-mon-2010-bodycombat-kevin",
      "location": "Setiabudi One",
      "datetime": "2026-04-06T20:10:00+07:00",
      "class_name": "Bodycombat",
      "instructor": ["Kevin"],
      "category": "martial-cardio",
      "tags": ["combat", "cardio", "LesMills"]
    }
  ],
  "filters": {
    "locations": ["Setiabudi One", "Sarana Square", "Cikini"],
    "categories": ["yoga", "dance", "strength", "hiit", "martial-cardio", "pilates", "cycling", "cardio", "hybrid"],
    "instructors": ["Kevin", "Topan", "Fira"],
    "class_names": ["Bodycombat", "Zumba"],
    "tags": ["LesMills", "cardio", "mobility"]
  }
}
```

Important notes:
- `datetime` is an ISO string, not a native Date object
- `instructor` is always an array of strings
- `tags` is always an array of strings
- `LesMills` may appear in tags and should also support a dedicated filter shortcut

---

## Required Features

### 1. Main Layout
Create a single-page layout with these sections.

#### Header
Include:
- app title
- subtitle or short description
- optional month label like “April 2026”
- quick filter buttons such as:
  - All week
  - Evening
  - LesMills

#### Filter Sidebar
Desktop:
- sticky left sidebar

Mobile:
- slide-over drawer or bottom sheet

Filters must include:
- text search
- location
- day
- category
- instructor
- tags
- time range
- LesMills toggle
- clear all

#### Main Content
Default view must be a **timeline grouped by weekday**.

For each day:
- show a sticky day header
- show class cards sorted by time ascending

Each class card should display:
- time
- class name
- instructor
- location
- category badge
- tag chips

#### Empty State
If no classes match:
- show a clean empty state
- include a helpful message such as: “Try removing a few filters.”

---

### 2. Filter Logic
Filtering must be built in a **composable** and be efficient.

Use computed properties and pre-indexed search-friendly values.

Supported filters:
- `search`
  - should match class name, instructor, location, category, tags, and day name
- `locations[]`
- `categories[]`
- `instructors[]`
- `tags[]`
- `dayKeys[]`
- `timeRange`
  - all
  - morning
  - afternoon
  - evening
  - after_work
- `lesMillsOnly`

Behavior:
- text search should be case-insensitive
- multi-select filters should work with OR logic inside a single group
- filters across groups should work with AND logic
- time filtering should use the `datetime` value

Recommended time buckets:
- morning: before 12:00
- afternoon: 12:00 to before 18:00
- evening / after_work: 18:00 onward

Implementation preference:
- precompute searchable blobs once in a computed index
- precompute normalized sets for instructors and tags when filtering
- sort final results by datetime ascending
- keep the composable readable and testable

---

### 3. UI / Design Direction
The visual style should feel like a modern fitness or productivity app.

Suggested design language:
- dark theme by default
- elegant spacing
- rounded cards
- subtle borders
- strong typography hierarchy
- colorful badges for categories
- bright chip styling for tags
- make `LesMills` tag visually distinct

Suggested palette:
- background: slate/charcoal
- card backgrounds: slightly lighter slate
- accent: sky blue or violet
- category colors:
  - yoga: green
  - dance: pink
  - strength: violet
  - hiit: red
  - martial-cardio: amber
  - pilates: cyan

Make the result feel polished, not like an admin table.

---

### 4. Responsiveness
Desktop:
- sidebar + main content two-column layout

Tablet/mobile:
- stacked layout
- filter drawer instead of persistent sidebar
- cards should remain readable
- timeline remains the primary view on mobile

Do not make the weekly grid the default mobile experience.

---

## Optional Nice-to-Haves
If implementation is straightforward, include some or all of these:
- active filter chips row
- result count
- quick filter pills in the header
- persisted filters in URL query params
- mobile filter drawer
- view toggle placeholder for future timeline/grid views
- “next class” summary card

Prioritize the MVP first.

---

## Required Folder Structure
Create a clean project structure like this:

```txt
src/
  assets/
  components/
    schedule/
      ClassCard.vue
      FilterSidebar.vue
      FilterDrawer.vue
      ScheduleHeader.vue
      ScheduleTimeline.vue
      DaySection.vue
      ActiveFilterChips.vue
      EmptyState.vue
  composables/
    useScheduleFilters.ts
  data/
    schedule.json
  types/
    schedule.ts
  utils/
    schedule.ts
  views/
    HomeView.vue
  App.vue
  main.ts
```

If you change this structure, do it only for a clear improvement and keep it consistent.

---

## Type Definitions
Create strong TypeScript types for:
- schedule meta
- schedule class
- schedule filters
- dataset object
- category union if useful

Recommended types:

```ts
export type Category =
  | 'yoga'
  | 'dance'
  | 'cardio'
  | 'martial-cardio'
  | 'hybrid'
  | 'strength'
  | 'cycling'
  | 'hiit'
  | 'pilates'

export interface ScheduleClass {
  id: string
  location: string
  datetime: string
  class_name: string
  instructor: string[]
  category: Category | string
  tags: string[]
}
```

---

## Utility Functions
Create utility helpers for:
- parsing ISO datetime
- formatting time
- formatting day labels
- extracting weekday keys
- matching time range buckets
- building a search blob
- grouping filtered classes by weekday
- generating unique filter option lists if needed

Keep utility code simple and readable.

---

## Component Responsibilities

### `ScheduleHeader.vue`
Responsibilities:
- title
- subtitle
- quick action filters
- optional summary card like “24 classes found”

### `FilterSidebar.vue`
Responsibilities:
- desktop filters UI
- emits filter change events
- includes clear all button

### `FilterDrawer.vue`
Responsibilities:
- mobile filter experience
- same controls as sidebar

### `ClassCard.vue`
Responsibilities:
- render one schedule item
- show time, class name, instructor, location, category, tags
- visually highlight `LesMills`

### `DaySection.vue`
Responsibilities:
- sticky day heading
- render class cards for that weekday

### `ScheduleTimeline.vue`
Responsibilities:
- render all grouped weekday sections
- show empty state if no results

### `ActiveFilterChips.vue`
Responsibilities:
- show currently active filters
- allow quick removal of selected filters if practical

### `EmptyState.vue`
Responsibilities:
- friendly message when no results exist

Guideline:
- keep each component under 200 lines when possible
- if a component starts growing too much, split presentation and logic

---

## Composable Requirements
Create `useScheduleFilters.ts`.

It should:
- accept the schedule dataset
- expose a reactive filter state
- expose computed filter options
- expose computed filtered results
- expose grouped timeline results
- expose result count
- expose whether active filters exist
- expose helper methods:
  - `resetFilters()`
  - `toggleArrayFilter()`

Performance expectations:
- build a lightweight indexed representation of classes using computed
- avoid recomputing expensive string concatenation unnecessarily
- sort final result by datetime ascending
- do not introduce premature abstraction

---

## UI Kit Guidance
Preferred:
- use **shadcn-vue** components where useful

Good candidates:
- Sheet or Drawer for mobile filters
- Input for search
- Checkbox for multi-select filters
- Badge for categories and tags
- Button for quick filters
- ScrollArea for long instructor lists

Fallback:
- pure Tailwind components are acceptable if setup cost outweighs benefits

Do not let the UI kit slow down delivery.

---

## Tailwind Guidance
Use Tailwind classes directly in components.

Desired feel:
- generous spacing
- rounded-2xl or rounded-3xl surfaces
- layered dark backgrounds
- subtle hover states
- readable contrast
- sticky day headers

Keep styling consistent and restrained.

---

## Accessibility Expectations
Please make the app reasonably accessible:
- labels for form inputs
- buttons use semantic elements
- focus states visible
- sufficient color contrast
- keyboard-friendly filter controls

---

## Scripts and DX
Set up the project so it runs with standard commands:
- `npm install`
- `npm run dev`
- `npm run build`

Include:
- working Tailwind setup
- TypeScript config
- Vite config
- package.json with required dependencies
- clean README with setup instructions

---

## README Requirements
Generate a `README.md` that includes:
- project overview
- stack used
- how to install
- how to run
- how to build
- where the JSON data lives
- how filtering works
- what can be extended next

---

## Output Requirements
Generate a full project with real files.

The output should include:
- all required source files
- proper imports
- working Tailwind setup
- at least one sample `schedule.json`
- clean component code
- typed composable logic
- responsive UI
- no placeholder pseudocode unless clearly marked as optional future enhancement

After generating or editing files:
- provide a concise diff summary grouped by area
- mention created files
- mention modified files
- mention any files intentionally left unchanged

---

## Design Summary
The product should feel like:
- a modern schedule explorer
- visually clean
- practical for actual use
- easy to scan
- easy to filter
- easy to extend

Default experience should emphasize:
- timeline view
- class cards
- fast discovery
- strong filtering

---

## Stretch Goals
If time remains after the MVP is solid, add:
- detail drawer when clicking a class
- view switcher for timeline vs grid placeholder
- URL persistence for filters
- a “next class” widget
- favorite classes or favorite instructors

These are optional.

---

## Final Instruction
Generate the complete Vue 3 + TypeScript + Tailwind project now.

Create files directly where needed.
Ask before deleting existing files or performing destructive changes.
Prefer shadcn-vue where it improves consistency and speed.
Keep components under 200 lines when possible.
Show diff summaries after meaningful groups of changes.

Favor clarity, maintainability, and polished UX over unnecessary complexity.

