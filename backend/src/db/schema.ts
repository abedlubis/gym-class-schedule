import { relations } from 'drizzle-orm'
import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

/* ------------------------------------------------------------------ enums */

export const clubStatus = pgEnum('club_status', [
  'open',
  'presale',
  'coming_soon',
  'closed',
])

export const slotStatus = pgEnum('slot_status', ['active', 'paused'])

/**
 * Studios routinely publish a timetable before deciding who teaches a slot —
 * the cell is blank, or reads "Coach" / "PT Team" / "ALL PT". That is the
 * club's current answer, not missing data, so it gets its own state.
 */
export const instructorStatus = pgEnum('instructor_status', ['confirmed', 'tba'])

/**
 * AF timetable graphics almost never print durations. This records how we
 * arrived at one, so a later reader can tell measurement from assumption.
 */
export const durationSource = pgEnum('duration_source', [
  'printed', // the graphic showed an explicit time range
  'capped', // shortened because the next class at this club starts sooner
  'assumed', // fell back to the 60-minute default
])

export const entityStatus = pgEnum('entity_status', ['active', 'archived'])
export const adminRole = pgEnum('admin_role', ['admin', 'editor'])

/* ------------------------------------------------------------------ clubs */

export const clubs = pgTable(
  'clubs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    afClubCode: text('af_club_code').unique(), // e.g. ID-0045, official and stable
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    city: text('city').notNull(),
    region: text('region').notNull(),
    address: text('address'),
    postalCode: text('postal_code'),
    status: clubStatus('status').notNull().default('open'),
    timezone: text('timezone').notNull().default('Asia/Jakarta'),
    instagramHandle: text('instagram_handle'),
    instagramVerified: boolean('instagram_verified'),
    officialUrl: text('official_url'),

    // Provenance and freshness — rendered on the class detail sheet so a
    // member can judge whether to trust a time before turning up.
    scheduleSourceUrl: text('schedule_source_url'),
    scheduleEffectiveFrom: date('schedule_effective_from'),
    scheduleCapturedAt: date('schedule_captured_at'),
    scheduleStale: boolean('schedule_stale').notNull().default(false),
    dataGapNote: text('data_gap_note'),

    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byRegion: index('idx_clubs_region').on(t.region, t.sortOrder),
    byStatus: index('idx_clubs_status').on(t.status),
  }),
)

export const clubAliases = pgTable(
  'club_aliases',
  {
    clubId: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    alias: text('alias').notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.clubId, t.alias] }),
  }),
)

/* ------------------------------------------------------------- categories */

export const categories = pgTable('categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull().unique(),
  label: text('label').notNull(),
  // Distinct hues, not brand tints — nine purple badges cannot be told apart
  // at a glance, which is the whole point of the badge.
  colorHex: text('color_hex').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
})

/* -------------------------------------------------------- class templates */

export const classTemplates = pgTable(
  'class_templates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(), // the club's own printed name
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    /**
     * Branches name the same class differently — nine names for yoga alone
     * across the transcribed clubs, and 63% of names appear at only one club.
     * `family` is the hand-mapped grouping the public filter offers; the card
     * still shows `name`, because that is what is on the studio door.
     */
    family: text('family'),
    programme: text('programme'), // LesMills, Zumba, POUND, HYROX, ...
    defaultDurationMin: integer('default_duration_min').notNull().default(60),
    description: text('description'),
    status: entityStatus('status').notNull().default('active'),
  },
  (t) => ({
    byFamily: index('idx_templates_family').on(t.family),
    byCategory: index('idx_templates_category').on(t.categoryId),
  }),
)

/* ------------------------------------------------------------ instructors */

export const instructors = pgTable('instructors', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull().unique(),
  // Nicknames are treated as globally unique across all clubs; trainers do
  // cover several branches. The guard against two people sharing a nickname
  // is a confirm dialog in the admin, not a schema constraint.
  name: text('name').notNull().unique(),
  bio: text('bio'),
  status: entityStatus('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const instructorClubs = pgTable(
  'instructor_clubs',
  {
    instructorId: uuid('instructor_id')
      .notNull()
      .references(() => instructors.id, { onDelete: 'cascade' }),
    clubId: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.instructorId, t.clubId] }),
  }),
)

/* --------------------------------------------------------- schedule slots */

export const scheduleSlots = pgTable(
  'schedule_slots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clubId: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'restrict' }),
    classTemplateId: uuid('class_template_id')
      .notNull()
      .references(() => classTemplates.id, { onDelete: 'restrict' }),

    weekday: smallint('weekday').notNull(), // 0 = Sunday … 6 = Saturday
    startTime: time('start_time').notNull(), // local to the club's timezone
    durationMin: integer('duration_min').notNull().default(60),
    durationSource: durationSource('duration_source').notNull().default('assumed'),

    room: text('room'),
    instructorStatus: instructorStatus('instructor_status').notNull().default('confirmed'),
    instructorNote: text('instructor_note'),
    note: text('note'),

    status: slotStatus('status').notNull().default('active'),
    effectiveFrom: date('effective_from'),
    effectiveTo: date('effective_to'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    read: index('idx_slots_club_weekday').on(t.clubId, t.weekday, t.startTime),
    // Prevents double-booking the same room. `room` is null everywhere today,
    // so this behaves as one class per club per weekday per start time.
    noClash: uniqueIndex('uq_slots_club_room_slot').on(
      t.clubId,
      t.room,
      t.weekday,
      t.startTime,
    ),
  }),
)

export const slotInstructors = pgTable(
  'slot_instructors',
  {
    slotId: uuid('slot_id')
      .notNull()
      .references(() => scheduleSlots.id, { onDelete: 'cascade' }),
    instructorId: uuid('instructor_id')
      .notNull()
      .references(() => instructors.id, { onDelete: 'restrict' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.slotId, t.instructorId] }),
  }),
)

/* ------------------------------------------------------------------ admin */

export const adminUsers = pgTable('admin_users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  role: adminRole('role').notNull().default('admin'),
  status: entityStatus('status').notNull().default('active'),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(), // opaque, 32 random bytes base64url
    adminUserId: uuid('admin_user_id')
      .notNull()
      .references(() => adminUsers.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    userAgent: text('user_agent'),
    ip: text('ip'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byUser: index('idx_sessions_user').on(t.adminUserId),
    byExpiry: index('idx_sessions_expiry').on(t.expiresAt),
  }),
)

/**
 * Bumped by any mutation. The publish step renders static JSON per club per
 * week; this counter drives the "N unpublished changes" banner and the
 * snapshot filename.
 */
export const scheduleVersion = pgTable('schedule_version', {
  id: smallint('id').primaryKey().default(1),
  version: integer('version').notNull().default(1),
  publishedVersion: integer('published_version').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/* -------------------------------------------------------------- relations */

export const clubsRelations = relations(clubs, ({ many }) => ({
  slots: many(scheduleSlots),
  aliases: many(clubAliases),
  instructors: many(instructorClubs),
}))

export const classTemplatesRelations = relations(classTemplates, ({ one, many }) => ({
  category: one(categories, {
    fields: [classTemplates.categoryId],
    references: [categories.id],
  }),
  slots: many(scheduleSlots),
}))

export const scheduleSlotsRelations = relations(scheduleSlots, ({ one, many }) => ({
  club: one(clubs, { fields: [scheduleSlots.clubId], references: [clubs.id] }),
  template: one(classTemplates, {
    fields: [scheduleSlots.classTemplateId],
    references: [classTemplates.id],
  }),
  instructors: many(slotInstructors),
}))

export const instructorsRelations = relations(instructors, ({ many }) => ({
  slots: many(slotInstructors),
  clubs: many(instructorClubs),
}))

export const slotInstructorsRelations = relations(slotInstructors, ({ one }) => ({
  slot: one(scheduleSlots, {
    fields: [slotInstructors.slotId],
    references: [scheduleSlots.id],
  }),
  instructor: one(instructors, {
    fields: [slotInstructors.instructorId],
    references: [instructors.id],
  }),
}))
