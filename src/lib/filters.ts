import { TAG_IDS } from "@/analysis/taxonomy";

/** Browse filters, parsed from and written back to the URL so every search can be bookmarked. */

export const SUPERTYPES = ["Pokémon", "Trainer", "Energy"] as const;
export const ENERGY_TYPES = [
  "Grass", "Fire", "Water", "Lightning", "Psychic", "Fighting", "Darkness", "Metal", "Dragon", "Colorless",
] as const;
export const SORTS = {
  newest: "Newest set first",
  oldest: "Oldest set first",
  name: "Name (A to Z)",
  "hp-desc": "HP (high to low)",
  "hp-asc": "HP (low to high)",
} as const;
export type Sort = keyof typeof SORTS;

export interface Filters {
  q: string;
  set: string;
  supertype: string;
  subtype: string;
  type: string;
  hpMin: number | null;
  hpMax: number | null;
  legal: "" | "standard" | "expanded";
  sort: Sort;
  /** "all" includes sets released before the Scarlet & Violet scope. */
  scope: "" | "all";
  /** Capability tag ids (see src/analysis/taxonomy.ts). */
  cap: string[];
  /** "any": card has at least one of `cap`; "all": card has every one. */
  capMode: "any" | "all";
  page: number;
}

type Raw = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
const many = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v : v ? [v] : []).flatMap((x) => x.split(",")).map((x) => x.trim()).filter(Boolean);
const int = (v: string | string[] | undefined) => {
  const n = Number.parseInt(one(v), 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export function parseFilters(raw: Raw): Filters {
  const sort = one(raw.sort);
  const legal = one(raw.legal);
  return {
    q: one(raw.q).slice(0, 100),
    set: one(raw.set),
    supertype: one(raw.supertype),
    subtype: one(raw.subtype),
    type: one(raw.type),
    hpMin: int(raw.hpMin),
    hpMax: int(raw.hpMax),
    legal: legal === "standard" || legal === "expanded" ? legal : "",
    sort: sort in SORTS ? (sort as Sort) : "newest",
    scope: one(raw.scope) === "all" ? "all" : "",
    cap: [...new Set(many(raw.cap).filter((id) => TAG_IDS.has(id)))].slice(0, 12),
    capMode: one(raw.capMode) === "all" ? "all" : "any",
    page: Math.max(1, int(raw.page) ?? 1),
  };
}

/** Build a query string from filters, dropping defaults. */
export function toQuery(f: Partial<Filters>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    if (v === null || v === undefined || v === "") continue;
    if (k === "sort" && v === "newest") continue;
    if (k === "page" && v === 1) continue;
    if (k === "capMode" && v === "any") continue;
    if (Array.isArray(v)) {
      for (const x of v) p.append(k, String(x));
      continue;
    }
    p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}
