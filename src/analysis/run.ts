import { and, eq, inArray, ne, notInArray, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "@/db/schema";
import { effects, machineTags, rawCards, sets, taxonomyTags } from "@/db/schema";
import type { ApiCard } from "@/sync/types";
import { extractEffects } from "./normalize";
import { RULE_CONFIDENCE, RULES_VERSION, tagEffect } from "./rules";
import { ALL_TAGS } from "./taxonomy";

type Db = NodePgDatabase<typeof schema>;

export type AnalysisResult = {
  cards: number;
  effects: number;
  hashesTagged: number;
  tagsWritten: number;
  rulesVersion: string;
  fullRetag: boolean;
};

const BATCH = 400;

/** Pushes the taxonomy in code to the database; tags removed from code are marked retired. */
export async function syncTaxonomy(db: Db) {
  for (const t of ALL_TAGS) {
    await db
      .insert(taxonomyTags)
      .values({ id: t.id, category: t.category, label: t.label, description: t.description, sortOrder: t.sortOrder, retired: false })
      .onConflictDoUpdate({
        target: taxonomyTags.id,
        set: { category: t.category, label: t.label, description: t.description, sortOrder: t.sortOrder, retired: false },
      });
  }
  await db.update(taxonomyTags).set({ retired: true }).where(notInArray(taxonomyTags.id, ALL_TAGS.map((t) => t.id)));
}

/**
 * Extracts effects for in-scope cards that need analysis (new or changed
 * gameplay text) and tags each distinct effect text with the rule tagger.
 * A new RULES_VERSION, or `all`, re-processes every in-scope card.
 */
export async function runAnalysis(db: Db, opts: { all?: boolean; log?: (m: string) => void } = {}): Promise<AnalysisResult> {
  const log = opts.log ?? (() => {});
  await syncTaxonomy(db);

  const [stale] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(machineTags)
    .where(and(eq(machineTags.source, "rule"), ne(machineTags.analyzerVersion, RULES_VERSION)));
  const fullRetag = Boolean(opts.all) || stale.n > 0;
  if (fullRetag) log(opts.all ? "Re-analyzing every in-scope card." : `Rules changed to ${RULES_VERSION}; re-analyzing every in-scope card.`);

  const ids = (
    await db
      .select({ id: rawCards.id })
      .from(rawCards)
      .innerJoin(sets, eq(sets.id, rawCards.setId))
      .where(fullRetag ? eq(sets.inScope, true) : and(eq(sets.inScope, true), eq(rawCards.needsAnalysis, true)))
      .orderBy(rawCards.id)
  ).map((r) => r.id);
  log(`${ids.length} card(s) to analyze.`);

  const result: AnalysisResult = { cards: 0, effects: 0, hashesTagged: 0, tagsWritten: 0, rulesVersion: RULES_VERSION, fullRetag };
  const done = new Set<string>();

  for (let i = 0; i < ids.length; i += BATCH) {
    const batchIds = ids.slice(i, i + BATCH);
    const rows = await db.select({ id: rawCards.id, data: rawCards.data }).from(rawCards).where(inArray(rawCards.id, batchIds));
    const extracted = rows.flatMap((r) => extractEffects(r.data as ApiCard));

    // One tag set per distinct text in this batch that we haven't tagged this run.
    const byHash = new Map<string, (typeof extracted)[number]>();
    for (const e of extracted) if (!done.has(e.textHash) && !byHash.has(e.textHash)) byHash.set(e.textHash, e);
    const tagRows = [...byHash.values()].flatMap((e) =>
      tagEffect(e).map((t) => ({
        textHash: e.textHash,
        tagId: t.tagId,
        source: "rule" as const,
        analyzerVersion: RULES_VERSION,
        confidence: RULE_CONFIDENCE,
        params: t.params ?? null,
        rationale: t.rationale,
      })),
    );

    await db.transaction(async (tx) => {
      await tx.delete(effects).where(inArray(effects.cardId, batchIds));
      if (extracted.length) {
        await tx.insert(effects).values(
          extracted.map((e) => ({
            id: e.id,
            cardId: e.cardId,
            kind: e.kind,
            position: e.position,
            name: e.name,
            text: e.text,
            cost: e.cost,
            damage: e.damage,
            textHash: e.textHash,
          })),
        );
      }
      const hashes = [...byHash.keys()];
      if (hashes.length) await tx.delete(machineTags).where(and(eq(machineTags.source, "rule"), inArray(machineTags.textHash, hashes)));
      if (tagRows.length) await tx.insert(machineTags).values(tagRows);
      await tx.update(rawCards).set({ needsAnalysis: false }).where(inArray(rawCards.id, batchIds));
    });

    for (const h of byHash.keys()) done.add(h);
    result.cards += rows.length;
    result.effects += extracted.length;
    result.hashesTagged += byHash.size;
    result.tagsWritten += tagRows.length;
    log(`  ${Math.min(i + BATCH, ids.length)}/${ids.length} cards`);
  }

  // Rule tags whose text no longer appears on any card.
  await db.execute(
    sql`delete from ${machineTags} m where m.source = 'rule' and not exists (select 1 from ${effects} e where e.text_hash = m.text_hash)`,
  );
  return result;
}
