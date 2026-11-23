import { describe, expect, it } from "vitest";
import { cleanCard, flattenCard, gameplayHash, toIsoDate } from "./normalize";
import { shouldFetchSet } from "./run";
import { computeScope, isInScope } from "./scope";
import type { ApiCard, ApiSet } from "./types";

const set = (id: string, series: string, releaseDate: string, updatedAt = `${releaseDate} 15:00:00`): ApiSet => ({
  id,
  name: id,
  series,
  releaseDate,
  updatedAt,
});

const card: ApiCard = {
  id: "me6-89",
  name: "Aarune",
  supertype: "Trainer",
  subtypes: ["Supporter"],
  rules: ["Search your deck for up to 3 in any combination of Supporter and Stadium cards..."],
  number: "89",
  rarity: "Uncommon",
  legalities: { standard: "Legal", expanded: "Legal", unlimited: "Legal" },
  regulationMark: "J",
  images: { small: "https://img/s", large: "https://img/l" },
};

describe("scope", () => {
  const sets = [
    set("swsh1", "Sword & Shield", "2020/02/07"),
    set("swsh12pt5gg", "Sword & Shield", "2023/01/20"),
    set("svp", "Scarlet & Violet", "2023/01/01"),
    set("sv1", "Scarlet & Violet", "2023/03/31"),
    set("me1", "Mega Evolution", "2025/09/26"),
    set("future1", "Some Later Series", "2027/02/01"),
  ];

  it("starts at the earliest Scarlet & Violet set", () => {
    expect(computeScope(sets, "Scarlet & Violet").cutoff).toBe("2023-01-01");
  });

  it("includes Scarlet & Violet and every later series, but not late sets of older series", () => {
    const scope = computeScope(sets, "Scarlet & Violet");
    expect(sets.filter((s) => isInScope(s, scope)).map((s) => s.id)).toEqual(["svp", "sv1", "me1", "future1"]);
  });

  it("puts nothing in scope when the start series is missing", () => {
    const scope = computeScope([set("base1", "Base", "1999/01/09")], "Scarlet & Violet");
    expect(scope.cutoff).toBeNull();
    expect(isInScope(sets[0], scope)).toBe(false);
  });
});

describe("gameplayHash", () => {
  it("ignores legality, rarity, images and prices", () => {
    const rotated = { ...card, legalities: { standard: "Banned" }, rarity: "Rare", images: {}, tcgplayer: { prices: 1 } };
    expect(gameplayHash(rotated)).toBe(gameplayHash(card));
  });

  it("changes when effect text changes", () => {
    expect(gameplayHash({ ...card, rules: ["Draw 3 cards."] })).not.toBe(gameplayHash(card));
  });
});

describe("normalize", () => {
  it("converts API dates", () => {
    expect(toIsoDate("2023/03/31")).toBe("2023-03-31");
  });

  it("strips the embedded set and price blocks", () => {
    const c = cleanCard({ ...card, set: { id: "me6" }, tcgplayer: {}, cardmarket: {} });
    expect(c).not.toHaveProperty("set");
    expect(c).not.toHaveProperty("tcgplayer");
    expect(c).not.toHaveProperty("cardmarket");
  });

  it("flattens legality and effect text", () => {
    const f = flattenCard({ ...card, hp: "130", attacks: [{ name: "Spike Draw", text: "Draw 2 cards." }] }, "me6");
    expect(f).toMatchObject({ setId: "me6", hp: 130, standardLegal: true, expandedLegal: true, attackCount: 1 });
    expect(f.effectText).toContain("Spike Draw: Draw 2 cards.");
  });
});

describe("shouldFetchSet", () => {
  const now = new Date("2026-11-23T00:00:00Z");
  const opts = { full: false, recentDays: 60, now };
  const old = set("sv1", "Scarlet & Violet", "2023/03/31");

  it("fetches new sets and sets never fully synced", () => {
    expect(shouldFetchSet(old, undefined, opts)).toBe(true);
    expect(shouldFetchSet(old, { updatedAt: old.updatedAt, cardsSyncedAt: null }, opts)).toBe(true);
  });

  it("skips old unchanged sets", () => {
    expect(shouldFetchSet(old, { updatedAt: old.updatedAt, cardsSyncedAt: now }, opts)).toBe(false);
  });

  it("re-fetches when updatedAt changes, on --full, or when released recently", () => {
    expect(shouldFetchSet(old, { updatedAt: "2026/01/01 00:00:00", cardsSyncedAt: now }, opts)).toBe(true);
    expect(shouldFetchSet(old, { updatedAt: old.updatedAt, cardsSyncedAt: now }, { ...opts, full: true })).toBe(true);
    const recent = set("me6", "Mega Evolution", "2026/11/06");
    expect(shouldFetchSet(recent, { updatedAt: recent.updatedAt, cardsSyncedAt: now }, opts)).toBe(true);
  });
});
