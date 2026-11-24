import Link from "next/link";
import { TAXONOMY } from "@/analysis/taxonomy";
import { ENERGY_TYPES, SORTS, SUPERTYPES, type Filters } from "@/lib/filters";

interface Props {
  filters: Filters;
  sets: { id: string; name: string; series: string }[];
  subtypes: string[];
  tagCounts: Record<string, number>;
}

const field = "w-full rounded-md border border-black/15 bg-transparent px-2 py-1.5 text-sm dark:border-white/20";
const label = "block text-xs font-medium uppercase tracking-wide text-neutral-500 mb-1";

/** A plain GET form: filtering works without client JavaScript and every result page has its own URL. */
export function FilterForm({ filters: f, sets, subtypes, tagCounts }: Props) {
  const series = [...new Set(sets.map((s) => s.series))];
  return (
    <form method="get" action="/" className="space-y-4">
      <div>
        <label className={label} htmlFor="q">Search</label>
        <input id="q" name="q" defaultValue={f.q} placeholder="Name or card text" className={field} />
      </div>
      <fieldset>
        <legend className={label}>Capabilities</legend>
        <div className="mb-2 flex gap-3 text-sm">
          <label className="flex items-center gap-1">
            <input type="radio" name="capMode" value="any" defaultChecked={f.capMode === "any"} /> Any selected
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" name="capMode" value="all" defaultChecked={f.capMode === "all"} /> All selected
          </label>
        </div>
        <div className="max-h-96 space-y-1 overflow-y-auto rounded-md border border-black/10 p-2 dark:border-white/10">
          {TAXONOMY.map((cat) => {
            const picked = cat.tags.filter((t) => f.cap.includes(t.id)).length;
            return (
              <details key={cat.id} open={picked > 0}>
                <summary className="cursor-pointer text-sm font-medium">
                  {cat.label}
                  {picked > 0 && <span className="ml-1 text-xs text-neutral-500">({picked})</span>}
                </summary>
                <div className="mt-1 space-y-0.5 pl-3">
                  {cat.tags.map((t) => (
                    <label key={t.id} className="flex items-center gap-2 text-sm" title={t.description}>
                      <input type="checkbox" name="cap" value={t.id} defaultChecked={f.cap.includes(t.id)} />
                      <span className="flex-1">{t.label}</span>
                      <span className="text-xs tabular-nums text-neutral-500">{tagCounts[t.id] ?? 0}</span>
                    </label>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      </fieldset>
      <div>
        <label className={label} htmlFor="set">Set</label>
        <select id="set" name="set" defaultValue={f.set} className={field}>
          <option value="">All sets</option>
          {series.map((name) => (
            <optgroup key={name} label={name}>
              {sets
                .filter((s) => s.series === name)
                .map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
            </optgroup>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label} htmlFor="supertype">Card type</label>
          <select id="supertype" name="supertype" defaultValue={f.supertype} className={field}>
            <option value="">Any</option>
            {SUPERTYPES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="subtype">Subtype</label>
          <select id="subtype" name="subtype" defaultValue={f.subtype} className={field}>
            <option value="">Any</option>
            {subtypes.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={label} htmlFor="type">Energy type</label>
        <select id="type" name="type" defaultValue={f.type} className={field}>
          <option value="">Any</option>
          {ENERGY_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label} htmlFor="hpMin">HP from</label>
          <input id="hpMin" name="hpMin" type="number" min={0} step={10} defaultValue={f.hpMin ?? ""} className={field} />
        </div>
        <div>
          <label className={label} htmlFor="hpMax">HP to</label>
          <input id="hpMax" name="hpMax" type="number" min={0} step={10} defaultValue={f.hpMax ?? ""} className={field} />
        </div>
      </div>
      <div>
        <label className={label} htmlFor="legal">Legal in</label>
        <select id="legal" name="legal" defaultValue={f.legal} className={field}>
          <option value="">Any format</option>
          <option value="standard">Standard</option>
          <option value="expanded">Expanded</option>
        </select>
      </div>
      <div>
        <label className={label} htmlFor="sort">Sort by</label>
        <select id="sort" name="sort" defaultValue={f.sort} className={field}>
          {Object.entries(SORTS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="scope" value="all" defaultChecked={f.scope === "all"} />
        Include sets before Scarlet &amp; Violet
      </label>
      <div className="flex gap-2">
        <button type="submit" className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-black">
          Apply
        </button>
        <Link href="/" className="rounded-md px-3 py-1.5 text-sm text-neutral-600 hover:underline dark:text-neutral-400">
          Reset
        </Link>
      </div>
    </form>
  );
}
