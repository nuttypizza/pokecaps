/** Shapes returned by the Pokémon TCG API v2 (and the PokemonTCG/pokemon-tcg-data repo). */

export interface ApiSet {
  id: string;
  name: string;
  series: string;
  printedTotal?: number;
  total?: number;
  ptcgoCode?: string;
  releaseDate: string; // "2023/03/31"
  updatedAt: string; // "2023/03/31 15:45:00"
  legalities?: Record<string, string>;
  images?: { symbol?: string; logo?: string };
}

export interface ApiAbility {
  name: string;
  text: string;
  type: string;
}

export interface ApiAttack {
  name: string;
  cost?: string[];
  convertedEnergyCost?: number;
  damage?: string;
  text?: string;
}

export interface ApiCard {
  id: string;
  name: string;
  supertype: string;
  subtypes?: string[];
  hp?: string;
  types?: string[];
  evolvesFrom?: string;
  abilities?: ApiAbility[];
  attacks?: ApiAttack[];
  rules?: string[];
  weaknesses?: { type: string; value: string }[];
  resistances?: { type: string; value: string }[];
  retreatCost?: string[];
  convertedRetreatCost?: number;
  number: string;
  rarity?: string;
  regulationMark?: string;
  legalities?: Record<string, string>;
  images?: { small?: string; large?: string };
  [key: string]: unknown;
}

export interface CardSource {
  readonly name: "api" | "github";
  listSets(): Promise<ApiSet[]>;
  listCards(setId: string): Promise<ApiCard[]>;
}
