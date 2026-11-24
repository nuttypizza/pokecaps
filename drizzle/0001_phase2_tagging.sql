CREATE TABLE "effects" (
	"id" text PRIMARY KEY NOT NULL,
	"card_id" text NOT NULL,
	"kind" text NOT NULL,
	"position" integer NOT NULL,
	"name" text,
	"text" text NOT NULL,
	"cost" text[] DEFAULT '{}' NOT NULL,
	"damage" text,
	"text_hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "machine_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"text_hash" text NOT NULL,
	"tag_id" text NOT NULL,
	"source" text NOT NULL,
	"analyzer_version" text NOT NULL,
	"confidence" real NOT NULL,
	"params" jsonb,
	"rationale" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "taxonomy_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"label" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"retired" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "effects" ADD CONSTRAINT "effects_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine_tags" ADD CONSTRAINT "machine_tags_tag_id_taxonomy_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."taxonomy_tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "effects_card_idx" ON "effects" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX "effects_hash_idx" ON "effects" USING btree ("text_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "machine_tags_hash_tag_source_uq" ON "machine_tags" USING btree ("text_hash","tag_id","source");--> statement-breakpoint
CREATE INDEX "machine_tags_tag_idx" ON "machine_tags" USING btree ("tag_id");