import Link from "next/link";
import { sortTags, TagChip } from "./tag-chips";

interface CardTile {
  id: string;
  name: string;
  supertype: string;
  subtypes: string[];
  hp: number | null;
  number: string;
  imageSmall: string | null;
  setName: string;
}

const MAX_CHIPS = 4;

export function CardGrid({ cards, tags = {} }: { cards: CardTile[]; tags?: Record<string, string[]> }) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {cards.map((c) => (
        <li key={c.id}>
          <Link href={`/cards/${c.id}`} className="group block">
            {c.imageSmall ? (
              // Plain <img>: images come straight from the card image CDN, so we pay nothing to resize or serve them.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={c.imageSmall}
                alt={c.name}
                loading="lazy"
                width={245}
                height={342}
                className="aspect-[245/342] w-full rounded-lg bg-neutral-100 shadow-sm transition group-hover:-translate-y-0.5 group-hover:shadow-md dark:bg-neutral-900"
              />
            ) : (
              <div className="flex aspect-[245/342] w-full items-center justify-center rounded-lg bg-neutral-100 text-sm text-neutral-500 dark:bg-neutral-900">
                No image
              </div>
            )}
            <div className="mt-2 text-sm font-medium leading-tight group-hover:underline">{c.name}</div>
            <div className="text-xs text-neutral-500">
              {c.setName} · #{c.number}
              {c.hp ? ` · ${c.hp} HP` : ""}
            </div>
            <div className="text-xs text-neutral-500">{[c.supertype, ...c.subtypes].join(" · ")}</div>
          </Link>
          <Chips ids={tags[c.id] ?? []} />
        </li>
      ))}
    </ul>
  );
}

function Chips({ ids }: { ids: string[] }) {
  if (!ids.length) return null;
  const sorted = sortTags(ids).filter((id) => !id.startsWith("drawback.") && id !== "trait.coin");
  const shown = sorted.slice(0, MAX_CHIPS);
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {shown.map((id) => (
        <TagChip key={id} id={id} />
      ))}
      {sorted.length > shown.length && <span className="text-[11px] text-neutral-500">+{sorted.length - shown.length}</span>}
    </div>
  );
}
