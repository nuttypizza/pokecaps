CREATE TABLE "cards" (
	"id" text PRIMARY KEY NOT NULL,
	"set_id" text NOT NULL,
	"name" text NOT NULL,
	"supertype" text NOT NULL,
	"subtypes" text[] DEFAULT '{}' NOT NULL,
	"hp" integer,
	"types" text[] DEFAULT '{}' NOT NULL,
	"evolves_from" text,
	"number" text NOT NULL,
	"rarity" text,
	"regulation_mark" text,
	"standard_legal" boolean DEFAULT false NOT NULL,
	"expanded_legal" boolean DEFAULT false NOT NULL,
	"converted_retreat_cost" integer,
	"ability_count" integer DEFAULT 0 NOT NULL,
	"attack_count" integer DEFAULT 0 NOT NULL,
	"effect_text" text DEFAULT '' NOT NULL,
	"image_small" text,
	"image_large" text
);
--> statement-breakpoint
CREATE TABLE "raw_cards" (
	"id" text PRIMARY KEY NOT NULL,
	"set_id" text NOT NULL,
	"data" jsonb NOT NULL,
	"gameplay_hash" text NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"gameplay_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"needs_analysis" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sets" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"series" text NOT NULL,
	"printed_total" integer,
	"total" integer,
	"ptcgo_code" text,
	"release_date" date NOT NULL,
	"updated_at" text NOT NULL,
	"legalities" jsonb,
	"logo_url" text,
	"symbol_url" text,
	"in_scope" boolean DEFAULT false NOT NULL,
	"cards_synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"source" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"sets_seen" integer DEFAULT 0 NOT NULL,
	"sets_fetched" integer DEFAULT 0 NOT NULL,
	"cards_new" integer DEFAULT 0 NOT NULL,
	"cards_changed" integer DEFAULT 0 NOT NULL,
	"cards_unchanged" integer DEFAULT 0 NOT NULL,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_set_id_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_cards" ADD CONSTRAINT "raw_cards_set_id_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cards_set_idx" ON "cards" USING btree ("set_id");--> statement-breakpoint
CREATE INDEX "cards_name_idx" ON "cards" USING btree ("name");--> statement-breakpoint
CREATE INDEX "cards_supertype_idx" ON "cards" USING btree ("supertype");--> statement-breakpoint
CREATE INDEX "cards_types_idx" ON "cards" USING gin ("types");--> statement-breakpoint
CREATE INDEX "cards_subtypes_idx" ON "cards" USING gin ("subtypes");--> statement-breakpoint
CREATE INDEX "raw_cards_set_idx" ON "raw_cards" USING btree ("set_id");--> statement-breakpoint
CREATE INDEX "raw_cards_needs_analysis_idx" ON "raw_cards" USING btree ("needs_analysis");