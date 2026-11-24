import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  uniqueIndex,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Sync writes `sets`, `raw_cards`, `cards` and `sync_runs` only.
 * Later phases add `effects`, `machine_tags` (analysis) and `tag_overrides`
 * (manual edits) in separate tables so a re-sync never touches your edits.
 */

export const sets = pgTable("sets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  series: text("series").notNull(),
  printedTotal: integer("printed_total"),
  total: integer("total"),
  ptcgoCode: text("ptcgo_code"),
  releaseDate: date("release_date").notNull(),
  updatedAt: text("updated_at").notNull(),
  legalities: jsonb("legalities").$type<Record<string, string>>(),
  logoUrl: text("logo_url"),
  symbolUrl: text("symbol_url"),
  /** True when the set is inside the app's scope (see src/sync/scope.ts). */
  inScope: boolean("in_scope").notNull().default(false),
  cardsSyncedAt: timestamp("cards_synced_at", { withTimezone: true }),
});

/** Full card JSON exactly as received, plus the gameplay hash used to detect changes. */
export const rawCards = pgTable(
  "raw_cards",
  {
    id: text("id").primaryKey(),
    setId: text("set_id")
      .notNull()
      .references(() => sets.id),
    data: jsonb("data").notNull(),
    gameplayHash: text("gameplay_hash").notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    gameplayChangedAt: timestamp("gameplay_changed_at", { withTimezone: true }).notNull().defaultNow(),
    /** Set when a card is new or its gameplay text changed; cleared by analysis (phase 2). */
    needsAnalysis: boolean("needs_analysis").notNull().default(true),
  },
  (t) => [index("raw_cards_set_idx").on(t.setId), index("raw_cards_needs_analysis_idx").on(t.needsAnalysis)],
);

/** Flattened columns used by the browse page's filters and sorting. */
export const cards = pgTable(
  "cards",
  {
    id: text("id").primaryKey(),
    setId: text("set_id")
      .notNull()
      .references(() => sets.id),
    name: text("name").notNull(),
    supertype: text("supertype").notNull(),
    subtypes: text("subtypes").array().notNull().default([]),
    hp: integer("hp"),
    types: text("types").array().notNull().default([]),
    evolvesFrom: text("evolves_from"),
    number: text("number").notNull(),
    rarity: text("rarity"),
    regulationMark: text("regulation_mark"),
    standardLegal: boolean("standard_legal").notNull().default(false),
    expandedLegal: boolean("expanded_legal").notNull().default(false),
    convertedRetreatCost: integer("converted_retreat_cost"),
    abilityCount: integer("ability_count").notNull().default(0),
    attackCount: integer("attack_count").notNull().default(0),
    /** All rules, ability and attack text joined, for full-text search. */
    effectText: text("effect_text").notNull().default(""),
    imageSmall: text("image_small"),
    imageLarge: text("image_large"),
  },
  (t) => [
    index("cards_set_idx").on(t.setId),
    index("cards_name_idx").on(t.name),
    index("cards_supertype_idx").on(t.supertype),
    index("cards_types_idx").using("gin", t.types),
    index("cards_subtypes_idx").using("gin", t.subtypes),
  ],
);

export const syncRuns = pgTable("sync_runs", {
  id: serial("id").primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  source: text("source").notNull(),
  status: text("status").notNull().default("running"),
  setsSeen: integer("sets_seen").notNull().default(0),
  setsFetched: integer("sets_fetched").notNull().default(0),
  cardsNew: integer("cards_new").notNull().default(0),
  cardsChanged: integer("cards_changed").notNull().default(0),
  cardsUnchanged: integer("cards_unchanged").notNull().default(0),
  error: text("error"),
});

/**
 * Capability taxonomy. Source of truth is src/analysis/taxonomy.ts; the
 * analysis job upserts it here so the app can join and label tags.
 */
export const taxonomyTags = pgTable("taxonomy_tags", {
  id: text("id").primaryKey(),
  category: text("category").notNull(),
  label: text("label").notNull(),
  description: text("description").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  retired: boolean("retired").notNull().default(false),
});

/**
 * One row per ability, attack, or rules/trainer text on a card. `textHash`
 * identifies the normalized wording, so reprints share their tags.
 */
export const effects = pgTable(
  "effects",
  {
    id: text("id").primaryKey(),
    cardId: text("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"ability" | "attack" | "rule">().notNull(),
    position: integer("position").notNull(),
    name: text("name"),
    text: text("text").notNull(),
    cost: text("cost").array().notNull().default([]),
    damage: text("damage"),
    textHash: text("text_hash").notNull(),
  },
  (t) => [index("effects_card_idx").on(t.cardId), index("effects_hash_idx").on(t.textHash)],
);

/**
 * Tags produced by the analyzers, keyed by effect text hash. Re-analysis
 * replaces rows of the same `source`; manual edits live elsewhere (phase 3).
 */
export const machineTags = pgTable(
  "machine_tags",
  {
    id: serial("id").primaryKey(),
    textHash: text("text_hash").notNull(),
    tagId: text("tag_id")
      .notNull()
      .references(() => taxonomyTags.id),
    source: text("source").$type<"rule" | "llm">().notNull(),
    analyzerVersion: text("analyzer_version").notNull(),
    confidence: real("confidence").notNull(),
    params: jsonb("params").$type<Record<string, number | string>>(),
    rationale: text("rationale"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("machine_tags_hash_tag_source_uq").on(t.textHash, t.tagId, t.source),
    index("machine_tags_tag_idx").on(t.tagId),
  ],
);

export type SetRow = typeof sets.$inferSelect;
export type CardRow = typeof cards.$inferSelect;
