import { fetchJson } from "./http";
import type { ApiCard, ApiSet, CardSource } from "./types";

const API_BASE = "https://api.pokemontcg.io/v2";
const PAGE_SIZE = 250; // API maximum

interface Page<T> {
  data: T[];
  page: number;
  pageSize: number;
  count: number;
  totalCount: number;
}

/**
 * The Pokémon TCG API (pokemontcg.io). Deprecated: closed to new sign-ups, and
 * existing keys stop working on 2027-03-01. Kept as an optional source.
 */
export class ApiSource implements CardSource {
  readonly name = "api" as const;
  constructor(
    private apiKey = process.env.POKEMONTCG_API_KEY,
    private retry = { attempts: Number(process.env.API_RETRY_ATTEMPTS ?? 4), baseDelayMs: 2000 },
  ) {}

  private async getAll<T>(path: string, params: Record<string, string> = {}): Promise<T[]> {
    const out: T[] = [];
    const headers: Record<string, string> = { accept: "application/json" };
    if (this.apiKey) headers["X-Api-Key"] = this.apiKey;
    for (let page = 1; ; page++) {
      const qs = new URLSearchParams({ ...params, page: String(page), pageSize: String(PAGE_SIZE) });
      const res = await fetchJson<Page<T>>(`${API_BASE}${path}?${qs}`, { headers }, this.retry);
      out.push(...res.data);
      if (res.data.length === 0 || out.length >= res.totalCount) break;
    }
    return out;
  }

  listSets() {
    return this.getAll<ApiSet>("/sets", { orderBy: "releaseDate" });
  }

  listCards(setId: string) {
    return this.getAll<ApiCard>("/cards", { q: `set.id:${setId}`, orderBy: "number" });
  }
}

/**
 * The maintainers' data repository (github.com/PokemonTCG/pokemon-tcg-data),
 * which the API is built from. Same JSON shape. The default source: free, no
 * key, no rate limit worth worrying about.
 */
export class GithubSource implements CardSource {
  readonly name = "github" as const;
  constructor(private base = "https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master") {}

  listSets() {
    return fetchJson<ApiSet[]>(`${this.base}/sets/en.json`);
  }

  async listCards(setId: string) {
    try {
      return await fetchJson<ApiCard[]>(`${this.base}/cards/en/${encodeURIComponent(setId)}.json`, {}, { attempts: 3, baseDelayMs: 1000 });
    } catch (err) {
      // A set can be announced before its card file exists.
      if (String(err).includes("HTTP 404")) return [];
      throw err;
    }
  }
}
