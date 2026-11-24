import Link from "next/link";
import { ALL_TAGS } from "@/analysis/taxonomy";

const BY_ID = new Map(ALL_TAGS.map((t) => [t.id, t]));

/** One color per category so tiles are easy to scan. */
const CATEGORY_COLOR: Record<string, string> = {
  draw: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  search: "bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200",
  energy: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  recovery: "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200",
  healing: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  mobility: "bg-cyan-100 text-cyan-900 dark:bg-cyan-950 dark:text-cyan-200",
  gust: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200",
  damage: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  protection: "bg-lime-100 text-lime-900 dark:bg-lime-950 dark:text-lime-200",
  disruption: "bg-fuchsia-100 text-fuchsia-900 dark:bg-fuchsia-950 dark:text-fuchsia-200",
  conditions: "bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-200",
  setup: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200",
  drawback: "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
};

export function tagLabel(id: string) {
  return BY_ID.get(id)?.label ?? id;
}

function paramText(params?: Record<string, number | string> | null) {
  if (!params) return "";
  const v = params.count ?? params.amount ?? params.damage;
  return v === undefined ? "" : ` (${v})`;
}

export function TagChip({ id, params, link = true }: { id: string; params?: Record<string, number | string> | null; link?: boolean }) {
  const tag = BY_ID.get(id);
  const cls = `inline-block rounded px-1.5 py-0.5 text-[11px] font-medium leading-tight ${CATEGORY_COLOR[tag?.category ?? ""] ?? "bg-neutral-100"}`;
  const text = `${tag?.label ?? id}${paramText(params)}`;
  return link ? (
    <Link href={`/?cap=${encodeURIComponent(id)}`} title={tag?.description} className={`${cls} hover:underline`}>
      {text}
    </Link>
  ) : (
    <span title={tag?.description} className={cls}>
      {text}
    </span>
  );
}

/** Tags sorted in taxonomy order, drawbacks last. */
export function sortTags(ids: string[]) {
  return [...ids].sort((a, b) => (BY_ID.get(a)?.sortOrder ?? 9999) - (BY_ID.get(b)?.sortOrder ?? 9999));
}
