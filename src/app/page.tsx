import Link from "next/link";
import { Suspense } from "react";
import { CardGrid } from "@/components/card-grid";
import { FilterForm } from "@/components/filter-form";
import { parseFilters, toQuery } from "@/lib/filters";
import { filterOptions, lastSync, PAGE_SIZE, searchCards, tagCounts, tagsForCards } from "@/lib/queries";

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<p className="text-sm text-neutral-500">Loading cards…</p>}>
      <Browse searchParams={searchParams} />
    </Suspense>
  );
}

async function Browse({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const filters = parseFilters(await searchParams);
  const [{ rows, total }, options, sync, counts] = await Promise.all([
    searchCards(filters),
    filterOptions(filters.scope),
    lastSync(),
    tagCounts(filters.scope),
  ]);
  const tags = await tagsForCards(rows.map((r) => r.id));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const first = total === 0 ? 0 : (filters.page - 1) * PAGE_SIZE + 1;
  const last = Math.min(total, filters.page * PAGE_SIZE);

  return (
    <div className="grid gap-8 md:grid-cols-[260px_1fr]">
      <aside>
        <FilterForm filters={filters} sets={options.sets} subtypes={options.subtypes} tagCounts={counts} />
        {sync?.finishedAt && (
          <p className="mt-6 text-xs text-neutral-500">
            Card data last synced {sync.finishedAt.toISOString().slice(0, 10)}.
          </p>
        )}
      </aside>
      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h1 className="text-xl font-semibold">
            {total.toLocaleString("en-US")} {total === 1 ? "card" : "cards"}
          </h1>
          {total > 0 && (
            <span className="text-sm text-neutral-500">
              Showing {first}–{last}
            </span>
          )}
        </div>
        {rows.length === 0 ? (
          <p className="text-neutral-500">No cards match these filters.</p>
        ) : (
          <CardGrid cards={rows} tags={tags} />
        )}
        {pages > 1 && (
          <nav className="mt-8 flex items-center justify-center gap-4 text-sm" aria-label="Pages">
            {filters.page > 1 ? (
              <Link href={`/${toQuery({ ...filters, page: filters.page - 1 })}`} className="hover:underline">
                ← Previous
              </Link>
            ) : (
              <span className="text-neutral-400">← Previous</span>
            )}
            <span>
              Page {filters.page} of {pages}
            </span>
            {filters.page < pages ? (
              <Link href={`/${toQuery({ ...filters, page: filters.page + 1 })}`} className="hover:underline">
                Next →
              </Link>
            ) : (
              <span className="text-neutral-400">Next →</span>
            )}
          </nav>
        )}
      </section>
    </div>
  );
}
