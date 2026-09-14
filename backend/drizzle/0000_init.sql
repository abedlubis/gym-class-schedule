CREATE TYPE "public"."admin_role" AS ENUM('admin', 'editor');--> statement-breakpoint
CREATE TYPE "public"."club_status" AS ENUM('open', 'presale', 'coming_soon', 'closed');--> statement-breakpoint
CREATE TYPE "public"."duration_source" AS ENUM('printed', 'capped', 'assumed');--> statement-breakpoint
CREATE TYPE "public"."entity_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."instructor_status" AS ENUM('confirmed', 'tba');--> statement-breakpoint
CREATE TYPE "public"."slot_status" AS ENUM('active', 'paused');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text,
	"role" "admin_role" DEFAULT 'admin' NOT NULL,
	"status" "entity_status" DEFAULT 'active' NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"color_hex" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "class_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"category_id" uuid NOT NULL,
	"family" text,
	"programme" text,
	"default_duration_min" integer DEFAULT 60 NOT NULL,
	"description" text,
	"status" "entity_status" DEFAULT 'active' NOT NULL,
	CONSTRAINT "class_templates_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "club_aliases" (
	"club_id" uuid NOT NULL,
	"alias" text NOT NULL,
	CONSTRAINT "club_aliases_club_id_alias_pk" PRIMARY KEY("club_id","alias")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clubs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"af_club_code" text,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"city" text NOT NULL,
	"region" text NOT NULL,
	"address" text,
	"postal_code" text,
	"status" "club_status" DEFAULT 'open' NOT NULL,
	"timezone" text DEFAULT 'Asia/Jakarta' NOT NULL,
	"instagram_handle" text,
	"instagram_verified" boolean,
	"official_url" text,
	"schedule_source_url" text,
	"schedule_effective_from" date,
	"schedule_captured_at" date,
	"schedule_stale" boolean DEFAULT false NOT NULL,
	"data_gap_note" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clubs_af_club_code_unique" UNIQUE("af_club_code"),
	CONSTRAINT "clubs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "instructor_clubs" (
	"instructor_id" uuid NOT NULL,
	"club_id" uuid NOT NULL,
	CONSTRAINT "instructor_clubs_instructor_id_club_id_pk" PRIMARY KEY("instructor_id","club_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "instructors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"bio" text,
	"status" "entity_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "instructors_slug_unique" UNIQUE("slug"),
	CONSTRAINT "instructors_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "schedule_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"class_template_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"start_time" time NOT NULL,
	"duration_min" integer DEFAULT 60 NOT NULL,
	"duration_source" "duration_source" DEFAULT 'assumed' NOT NULL,
	"room" text,
	"instructor_status" "instructor_status" DEFAULT 'confirmed' NOT NULL,
	"instructor_note" text,
	"note" text,
	"status" "slot_status" DEFAULT 'active' NOT NULL,
	"effective_from" date,
	"effective_to" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "schedule_version" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"published_version" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"admin_user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_agent" text,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "slot_instructors" (
	"slot_id" uuid NOT NULL,
	"instructor_id" uuid NOT NULL,
	CONSTRAINT "slot_instructors_slot_id_instructor_id_pk" PRIMARY KEY("slot_id","instructor_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "class_templates" ADD CONSTRAINT "class_templates_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "club_aliases" ADD CONSTRAINT "club_aliases_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "instructor_clubs" ADD CONSTRAINT "instructor_clubs_instructor_id_instructors_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."instructors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "instructor_clubs" ADD CONSTRAINT "instructor_clubs_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "schedule_slots" ADD CONSTRAINT "schedule_slots_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "schedule_slots" ADD CONSTRAINT "schedule_slots_class_template_id_class_templates_id_fk" FOREIGN KEY ("class_template_id") REFERENCES "public"."class_templates"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "slot_instructors" ADD CONSTRAINT "slot_instructors_slot_id_schedule_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."schedule_slots"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "slot_instructors" ADD CONSTRAINT "slot_instructors_instructor_id_instructors_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."instructors"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_templates_family" ON "class_templates" USING btree ("family");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_templates_category" ON "class_templates" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_clubs_region" ON "clubs" USING btree ("region","sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_clubs_status" ON "clubs" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_slots_club_weekday" ON "schedule_slots" USING btree ("club_id","weekday","start_time");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_slots_club_room_slot" ON "schedule_slots" USING btree ("club_id","room","weekday","start_time");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sessions_user" ON "sessions" USING btree ("admin_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sessions_expiry" ON "sessions" USING btree ("expires_at");