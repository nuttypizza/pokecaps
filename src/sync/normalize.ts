import { createHash } from "node:crypto";
import type { ApiCard, ApiSet } from "./types";

/** "2023/03/31" -> "2023-03-31" */
export function toIsoDate(apiDate: string): string {
  return apiDate.trim().slice(0, 10).replaceAll("/", "-");
}

/** Remove fields that differ between sources or change daily without affecting gameplay. */
export function cleanCard(card: ApiCard): ApiCard {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { set, tcgplayer, cardmarket, ...rest } = card;
  return rest as ApiCard;
}

/**
 * Hash of the fields that matter for capability analysis. Legality, rarity,
 * artwork and prices are left out, so rotations and price updates don't
 * send a card back for re-analysis.
 */
export function gameplayHash(card: ApiCard): string {
  const gameplay = {
    name: card.name,
    supertype: card.supertype,
    subtypes: card.subtypes ?? [],
    hp: card.hp ?? null,
    types: card.types ?? [],
    evolvesFrom: card.evolvesFrom ?? null,
    abilities: (card.abilities ?? []).map((a) => [a.type, a.name, a.text]),
    attacks: (card.attacks ?? []).map((a) => [a.name, a.cost ?? [], a.damage ?? "", a.text ?? ""]),
    rules: card.rules ?? [],
    weaknesses: card.weaknesses ?? [],
    resistances: card.resistances ?? [],
    retreatCost: card.retreatCost ?? [],
  };
  return createHash("sha256").update(JSON.stringify(gameplay)).digest("hex");
}

export function parseHp(hp: string | undefined): number | null {
  if (!hp) return null;
  const n = Number.parseInt(hp, 10);
  return Number.isFinite(n) ? n : null;
}

export function flattenCard(card: ApiCard, setId: string) {
  const texts = [
    ...(card.rules ?? []),
    ...(card.abilities ?? []).map((a) => `${a.name}: ${a.text}`),
    ...(card.attacks ?? []).map((a) => `${a.name}: ${a.text ?? ""}`),
  ];
  return {
    id: card.id,
    setId,
    name: card.name,
    supertype: card.supertype,
    subtypes: card.subtypes ?? [],
    hp: parseHp(card.hp),
    types: card.types ?? [],
    evolvesFrom: card.evolvesFrom ?? null,
    number: card.number,
    rarity: card.rarity ?? null,
    regulationMark: card.regulationMark ?? null,
    standardLegal: card.legalities?.standard === "Legal",
    expandedLegal: card.legalities?.expanded === "Legal",
    convertedRetreatCost: card.convertedRetreatCost ?? null,
    abilityCount: card.abilities?.length ?? 0,
    attackCount: card.attacks?.length ?? 0,
    effectText: texts.join("\n"),
    imageSmall: card.images?.small ?? null,
    imageLarge: card.images?.large ?? null,
  };
}

export function flattenSet(set: ApiSet, inScope: boolean) {
  return {
    id: set.id,
    name: set.name,
    series: set.series,
    printedTotal: set.printedTotal ?? null,
    total: set.total ?? null,
    ptcgoCode: set.ptcgoCode ?? null,
    releaseDate: toIsoDate(set.releaseDate),
    updatedAt: set.updatedAt,
    legalities: set.legalities ?? null,
    logoUrl: set.images?.logo ?? null,
    symbolUrl: set.images?.symbol ?? null,
    inScope,
  };
}
