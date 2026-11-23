import { eq, inArray, sql as dsql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/db/schema";
import { cleanCard, flattenCard, flattenSet, gameplayHash, toIsoDate } from "./normalize";
import { computeScope, isInScope } from "./scope";
import { ApiSource, GithubSource } from "./sources";
import type { ApiSet, CardSource } from "./types";

type Db = PostgresJsDatabase<typeof schema>;

export interface SyncOptions {
  /** "auto" tries the API and falls back to GitHub if the API can't list sets. */
  source?: "api" | "github" | "auto";
  /** Re-fetch every set's cards, not just new or changed sets. */
  full?: boolean;
  /** Only fetch cards for in-scope sets (all set metadata is still stored). */
  scopeOnly?: boolean;
  /** Also re-fetch sets released within this many days, since early data gets fixed without a new updatedAt. */
  recentDays?: number;
  log?: (msg: string) => void;
  now?: Date;
}

export interface SyncResult {
  runId: number;
  source: string;
  setsSeen: number;
  setsFetched: number;
  cardsNew: number;
  cardsChanged: number;
  cardsUnchanged: number;
  setsFromFallback: number;
}

async function pickSource(
  choice: SyncOptions["source"],
  log: (m: string) => void,
): Promise<{ source: CardSource; fallback: CardSource | null; sets: ApiSet[] }> {
  if (choice === "github") {
    const source = new GithubSource();
    return { source, fallback: null, sets: await source.listSets() };
  }
  const api = new ApiSource();
  try {
    // In auto mode a set whose cards the API can't serve is fetched from GitHub instead.
    return { source: api, fallback: choice === "api" ? null : new GithubSource(), sets: await api.listSets() };
  } catch (err) {
    if (choice === "api") throw err;
    log(`Pokémon TCG API unavailable (${String(err)}); falling back to the GitHub data repo.`);
    const source = new GithubSource();
    return { source, fallback: null, sets: await source.listSets() };
  }
}

export function shouldFetchSet(
  set: ApiSet,
  existing: { updatedAt: string; cardsSyncedAt: Date | null } | undefined,
  opts: { full: boolean; recentDays: number; now: Date },
): boolean {
  if (opts.full || !existing || !existing.cardsSyncedAt) return true;
  if (existing.updatedAt !== set.updatedAt) return true;
  const released = Date.parse(toIsoDate(set.releaseDate));
  return opts.now.getTime() - released < opts.recentDays * 86_400_000;
}

export async function runSync(db: Db, opts: SyncOptions = {}): Promise<SyncResult> {
  const log = opts.log ?? console.log;
  const now = opts.now ?? new Date();
  const recentDays = opts.recentDays ?? 60;

  const [run] = await db.insert(schema.syncRuns).values({ source: opts.source ?? "auto" }).returning({ id: schema.syncRuns.id });
  const result: SyncResult = { runId: run.id, source: "", setsSeen: 0, setsFetched: 0, cardsNew: 0, cardsChanged: 0, cardsUnchanged: 0, setsFromFallback: 0 };

  try {
    const { source, fallback, sets } = await pickSource(opts.source ?? "auto", log);
    result.source = source.name;
    result.setsSeen = sets.length;
    const scope = computeScope(sets);
    const inScopeCount = sets.filter((s) => isInScope(s, scope)).length;
    log(
      `Source: ${source.name}. ${sets.length} sets, ${inScopeCount} in scope (${scope.startSeries} onward, from ${scope.cutoff ?? "n/a"}).`,
    );

    const existingSets = new Map(
      (await db.select({ id: schema.sets.id, updatedAt: schema.sets.updatedAt, cardsSyncedAt: schema.sets.cardsSyncedAt }).from(schema.sets)).map(
        (s) => [s.id, s],
      ),
    );

    for (const set of sets) {
      const row = flattenSet(set, isInScope(set, scope));
      await db
        .insert(schema.sets)
        .values(row)
        .onConflictDoUpdate({
          target: schema.sets.id,
          // updatedAt is written after the set's cards are stored, so a failed run retries the set.
          set: { ...row, updatedAt: dsql`${schema.sets.updatedAt}` },
        });
    }

    const toFetch = sets
      .filter((s) => !opts.scopeOnly || isInScope(s, scope))
      .filter((s) => shouldFetchSet(s, existingSets.get(s.id), { full: !!opts.full, recentDays, now }));
    log(`Fetching cards for ${toFetch.length} set(s).`);

    for (const set of toFetch) {
      let cards;
      try {
        cards = await source.listCards(set.id);
      } catch (err) {
        if (!fallback) throw err;
        log(`  ${set.id}: API failed (${String(err)}); using ${fallback.name} for this set.`);
        cards = await fallback.listCards(set.id);
        result.setsFromFallback++;
      }
      const counts = await storeSetCards(db, set.id, cards.map(cleanCard), now);
      await db.update(schema.sets).set({ updatedAt: set.updatedAt, cardsSyncedAt: now }).where(eq(schema.sets.id, set.id));
      result.setsFetched++;
      result.cardsNew += counts.new;
      result.cardsChanged += counts.changed;
      result.cardsUnchanged += counts.unchanged;
      log(`  ${set.id.padEnd(10)} ${String(cards.length).padStart(4)} cards  (+${counts.new} new, ${counts.changed} changed)`);
    }

    await db
      .update(schema.syncRuns)
      .set({ ...dbCounts(result), status: "ok", finishedAt: new Date() })
      .where(eq(schema.syncRuns.id, run.id));
    return result;
  } catch (err) {
    await db
      .update(schema.syncRuns)
      .set({ ...dbCounts(result), status: "failed", error: String(err), finishedAt: new Date() })
      .where(eq(schema.syncRuns.id, run.id));
    throw err;
  }
}

export async function storeSetCards(db: Db, setId: string, cards: ReturnType<typeof cleanCard>[], now: Date) {
  const counts = { new: 0, changed: 0, unchanged: 0 };
  if (cards.length === 0) return counts;

  await db.transaction(async (tx) => {
    const ids = cards.map((c) => c.id);
    const existing = new Map(
      (
        await tx
          .select({
            id: schema.rawCards.id,
            gameplayHash: schema.rawCards.gameplayHash,
            needsAnalysis: schema.rawCards.needsAnalysis,
            gameplayChangedAt: schema.rawCards.gameplayChangedAt,
            firstSeenAt: schema.rawCards.firstSeenAt,
          })
          .from(schema.rawCards)
          .where(inArray(schema.rawCards.id, ids))
      ).map((r) => [r.id, r]),
    );

    const rawRows = cards.map((card) => {
      const hash = gameplayHash(card);
      const prev = existing.get(card.id);
      const changed = !!prev && prev.gameplayHash !== hash;
      if (!prev) counts.new++;
      else if (changed) counts.changed++;
      else counts.unchanged++;
      return {
        id: card.id,
        setId,
        data: card,
        gameplayHash: hash,
        firstSeenAt: prev?.firstSeenAt ?? now,
        lastSeenAt: now,
        gameplayChangedAt: !prev || changed ? now : prev.gameplayChangedAt,
        needsAnalysis: !prev || changed ? true : prev.needsAnalysis,
      };
    });

    await tx
      .insert(schema.rawCards)
      .values(rawRows)
      .onConflictDoUpdate({
        target: schema.rawCards.id,
        set: {
          setId: dsql`excluded.set_id`,
          data: dsql`excluded.data`,
          gameplayHash: dsql`excluded.gameplay_hash`,
          lastSeenAt: dsql`excluded.last_seen_at`,
          gameplayChangedAt: dsql`excluded.gameplay_changed_at`,
          needsAnalysis: dsql`excluded.needs_analysis`,
        },
      });

    const flat = cards.map((c) => flattenCard(c, setId));
    const cols = Object.keys(flat[0]).filter((k) => k !== "id") as (keyof (typeof flat)[0])[];
    await tx
      .insert(schema.cards)
      .values(flat)
      .onConflictDoUpdate({
        target: schema.cards.id,
        set: Object.fromEntries(cols.map((k) => [k, dsql.raw(`excluded.${schema.cards[k].name}`)])),
      });
  });

  return counts;
}

function dbCounts(r: SyncResult) {
  return {
    source: r.setsFromFallback ? `${r.source}+github(${r.setsFromFallback})` : r.source || "none",
    setsSeen: r.setsSeen,
    setsFetched: r.setsFetched,
    cardsNew: r.cardsNew,
    cardsChanged: r.cardsChanged,
    cardsUnchanged: r.cardsUnchanged,
  };
}
