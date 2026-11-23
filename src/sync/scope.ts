import { toIsoDate } from "./normalize";
import type { ApiSet } from "./types";

/**
 * The app covers the Scarlet & Violet block and every series that started
 * after it (Mega Evolution, and whatever comes next). The cutoff is looked up
 * from the data, not hardcoded.
 *
 * A set is in scope when it belongs to SCOPE_START_SERIES, or it was released
 * on or after that series' first set AND its own series also started on or
 * after that date. The second condition keeps out late sets of older series,
 * such as Crown Zenith (Sword & Shield, January 2023), which released after
 * the Scarlet & Violet promo set's nominal date.
 */
export const DEFAULT_SCOPE_START_SERIES = "Scarlet & Violet";

export interface Scope {
  startSeries: string;
  cutoff: string | null;
  /** Earliest release date of each series. */
  seriesStart: Map<string, string>;
}

export function computeScope(sets: ApiSet[], startSeries = process.env.SCOPE_START_SERIES || DEFAULT_SCOPE_START_SERIES): Scope {
  const seriesStart = new Map<string, string>();
  for (const s of sets) {
    const d = toIsoDate(s.releaseDate);
    const prev = seriesStart.get(s.series);
    if (!prev || d < prev) seriesStart.set(s.series, d);
  }
  return { startSeries, cutoff: seriesStart.get(startSeries) ?? null, seriesStart };
}

export function isInScope(set: ApiSet, scope: Scope): boolean {
  if (!scope.cutoff) return false;
  if (set.series === scope.startSeries) return true;
  const started = scope.seriesStart.get(set.series) ?? toIsoDate(set.releaseDate);
  return toIsoDate(set.releaseDate) >= scope.cutoff && started >= scope.cutoff;
}
