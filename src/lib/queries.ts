import { and, arrayContains, asc, count, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db/client";
import { cards, effects, machineTags, rawCards, sets, syncRuns } from "@/db/schema";
import type { Filters } from "./filters";

export const PAGE_SIZE = 60;

function escapeLike(s: string) {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function whereFor(f: Filters): SQL | undefined {
  const c: (SQL | undefined)[] = [];
  if (f.scope !== "all") c.push(eq(sets.inScope, true));
  if (f.q) {
    const pattern = `%${escapeLike(f.q)}%`;
    c.push(or(ilike(cards.name, pattern), ilike(cards.effectText, pattern)));
  }
  if (f.set) c.push(eq(cards.setId, f.set));
  if (f.supertype) c.push(eq(cards.supertype, f.supertype));
  if (f.subtype) c.push(arrayContains(cards.subtypes, [f.subtype]));
  if (f.type) c.push(arrayContains(cards.types, [f.type]));
  if (f.hpMin !== null) c.push(gte(cards.hp, f.hpMin));
  if (f.hpMax !== null) c.push(lte(cards.hp, f.hpMax));
  if (f.legal === "standard") c.push(eq(cards.standardLegal, true));
  if (f.legal === "expanded") c.push(eq(cards.expandedLegal, true));
  if (f.cap.length) {
    const has = (tagIds: string[]) =>
      sql`exists (select 1 from ${effects} e join ${machineTags} m on m.text_hash = e.text_hash where e.card_id = ${cards.id} and m.tag_id in (${sql.join(
        tagIds.map((t) => sql`${t}`),
        sql`, `,
      )}))`;
    if (f.capMode === "all") for (const t of f.cap) c.push(has([t]));
    else c.push(has(f.cap));
  }
  return and(...c);
}

const numberOrder = [sql`length(${cards.number})`, asc(cards.number)];

function orderFor(sort: Filters["sort"]) {
  switch (sort) {
    case "oldest":
      return [asc(sets.releaseDate), ...numberOrder];
    case "name":
      return [asc(cards.name), desc(sets.releaseDate), ...numberOrder];
    case "hp-desc":
      return [sql`${cards.hp} desc nulls last`, asc(cards.name)];
    case "hp-asc":
      return [sql`${cards.hp} asc nulls last`, asc(cards.name)];
    default:
      return [desc(sets.releaseDate), ...numberOrder];
  }
}

export async function searchCards(f: Filters) {
  "use cache";
  cacheTag("catalog");
  cacheLife("hours");

  const where = whereFor(f);
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: cards.id,
        name: cards.name,
        supertype: cards.supertype,
        subtypes: cards.subtypes,
        hp: cards.hp,
        types: cards.types,
        number: cards.number,
        imageSmall: cards.imageSmall,
        setName: sets.name,
        setId: sets.id,
      })
      .from(cards)
      .innerJoin(sets, eq(cards.setId, sets.id))
      .where(where)
      .orderBy(...orderFor(f.sort))
      .limit(PAGE_SIZE)
      .offset((f.page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(cards).innerJoin(sets, eq(cards.setId, sets.id)).where(where),
  ]);
  return { rows, total };
}

export async function filterOptions(scope: Filters["scope"]) {
  "use cache";
  cacheTag("catalog");
  cacheLife("hours");

  const scoped = scope === "all" ? undefined : eq(sets.inScope, true);
  const [setRows, subtypeRows] = await Promise.all([
    db
      .select({ id: sets.id, name: sets.name, series: sets.series, releaseDate: sets.releaseDate })
      .from(sets)
      .where(scoped)
      .orderBy(desc(sets.releaseDate), asc(sets.name)),
    db
      .selectDistinct({ subtype: sql<string>`unnest(${cards.subtypes})` })
      .from(cards)
      .innerJoin(sets, eq(cards.setId, sets.id))
      .where(scoped),
  ]);
  return { sets: setRows, subtypes: subtypeRows.map((r) => r.subtype).sort() };
}

export async function getCard(id: string) {
  "use cache";
  cacheTag("catalog", `card:${id}`);
  cacheLife("hours");

  const [row] = await db
    .select({ card: cards, set: sets, data: rawCards.data })
    .from(cards)
    .innerJoin(sets, eq(cards.setId, sets.id))
    .innerJoin(rawCards, eq(rawCards.id, cards.id))
    .where(eq(cards.id, id))
    .limit(1);
  return row ?? null;
}

export async function lastSync() {
  "use cache";
  cacheTag("catalog");
  cacheLife("minutes");

  const [row] = await db.select().from(syncRuns).where(eq(syncRuns.status, "ok")).orderBy(desc(syncRuns.id)).limit(1);
  return row ?? null;
}

/** Capability tags per card, for the tiles on one results page. */
export async function tagsForCards(ids: string[]) {
  "use cache";
  cacheTag("catalog");
  cacheLife("hours");

  if (!ids.length) return {} as Record<string, string[]>;
  const rows = await db
    .selectDistinct({ cardId: effects.cardId, tagId: machineTags.tagId })
    .from(effects)
    .innerJoin(machineTags, eq(machineTags.textHash, effects.textHash))
    .where(inArray(effects.cardId, ids));
  const out: Record<string, string[]> = {};
  for (const r of rows) (out[r.cardId] ??= []).push(r.tagId);
  return out;
}

/** How many cards carry each capability tag, for the filter list. */
export async function tagCounts(scope: Filters["scope"]) {
  "use cache";
  cacheTag("catalog");
  cacheLife("hours");

  const rows = await db
    .select({ tagId: machineTags.tagId, n: sql<number>`count(distinct ${effects.cardId})::int` })
    .from(machineTags)
    .innerJoin(effects, eq(effects.textHash, machineTags.textHash))
    .innerJoin(cards, eq(cards.id, effects.cardId))
    .innerJoin(sets, eq(sets.id, cards.setId))
    .where(scope === "all" ? undefined : eq(sets.inScope, true))
    .groupBy(machineTags.tagId);
  return Object.fromEntries(rows.map((r) => [r.tagId, r.n])) as Record<string, number>;
}

/** Each effect on a card with the tags on its text. */
export async function effectsForCard(id: string) {
  "use cache";
  cacheTag("catalog", `card:${id}`);
  cacheLife("hours");

  const rows = await db
    .select({
      id: effects.id,
      kind: effects.kind,
      position: effects.position,
      name: effects.name,
      text: effects.text,
      tagId: machineTags.tagId,
      source: machineTags.source,
      confidence: machineTags.confidence,
      params: machineTags.params,
    })
    .from(effects)
    .leftJoin(machineTags, eq(machineTags.textHash, effects.textHash))
    .where(eq(effects.cardId, id))
    .orderBy(effects.kind, effects.position);
  const byEffect = new Map<string, { id: string; kind: string; position: number; name: string | null; text: string; tags: { tagId: string; source: string; confidence: number; params: Record<string, number | string> | null }[] }>();
  for (const r of rows) {
    const e = byEffect.get(r.id) ?? { id: r.id, kind: r.kind, position: r.position, name: r.name, text: r.text, tags: [] };
    if (r.tagId && r.source && r.confidence !== null) e.tags.push({ tagId: r.tagId, source: r.source, confidence: r.confidence, params: r.params });
    byEffect.set(r.id, e);
  }
  return [...byEffect.values()];
}
