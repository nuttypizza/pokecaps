import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { sortTags, TagChip } from "@/components/tag-chips";
import { effectsForCard, getCard } from "@/lib/queries";
import type { ApiCard } from "@/sync/types";

export default function CardPage({ params }: PageProps<"/cards/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-neutral-500">Loading card…</p>}>
      <CardDetail params={params} />
    </Suspense>
  );
}

async function CardDetail({ params }: { params: PageProps<"/cards/[id]">["params"] }) {
  const { id } = await params;
  const cardId = decodeURIComponent(id);
  const [row, effects] = await Promise.all([getCard(cardId), effectsForCard(cardId)]);
  if (!row) notFound();
  const tagsFor = (key: string) => {
    const e = effects.find((x) => x.id === `${cardId}#${key}`);
    if (!e) return undefined;
    const order = sortTags(e.tags.map((t) => t.tagId));
    return order.map((tid) => e.tags.find((t) => t.tagId === tid)!);
  };
  const analyzed = effects.length > 0;
  const { card, set } = row;
  const data = row.data as ApiCard;

  return (
    <div>
      <Link href="/" className="text-sm text-neutral-500 hover:underline">
        ← All cards
      </Link>
      <div className="mt-4 grid gap-8 md:grid-cols-[minmax(0,360px)_1fr]">
        {card.imageLarge && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.imageLarge} alt={card.name} width={734} height={1024} className="w-full rounded-xl shadow" />
        )}
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold">{card.name}</h1>
            <p className="text-sm text-neutral-500">
              {[card.supertype, ...card.subtypes].join(" · ")}
              {card.hp ? ` · ${card.hp} HP` : ""}
              {card.types.length ? ` · ${card.types.join("/")}` : ""}
            </p>
            <p className="text-sm text-neutral-500">
              {set.name} ({set.series}) · #{card.number}
              {card.regulationMark ? ` · Regulation ${card.regulationMark}` : ""}
              {" · "}
              {[card.standardLegal && "Standard", card.expandedLegal && "Expanded"].filter(Boolean).join(", ") || "Not legal in Standard or Expanded"}
            </p>
            {card.evolvesFrom && <p className="text-sm text-neutral-500">Evolves from {card.evolvesFrom}</p>}
          </div>

          {data.abilities?.map((a, i) => (
            <Effect key={`a${i}`} kind={a.type} name={a.name} text={a.text} tags={tagsFor(`ability${i}`)} analyzed={analyzed} />
          ))}
          {data.attacks?.map((a, i) => (
            <Effect
              key={`k${i}`}
              kind={`Attack · ${(a.cost ?? []).join(", ") || "no cost"}`}
              name={a.damage ? `${a.name} — ${a.damage}` : a.name}
              text={a.text}
              tags={tagsFor(`attack${i}`)}
              analyzed={analyzed}
            />
          ))}
          {data.rules?.map((r, i) => <Effect key={`r${i}`} kind="Rules" text={r} tags={tagsFor(`rule${i}`)} analyzed={analyzed} reminder />)}

          <p className="text-xs text-neutral-500">
            {analyzed
              ? "Tags come from the automatic rule tagger. Hand edits arrive in phase 3."
              : "This card hasn't been analyzed yet."}
          </p>
        </div>
      </div>
    </div>
  );
}

type EffectTag = { tagId: string; params: Record<string, number | string> | null };

function Effect({
  kind,
  name,
  text,
  tags,
  analyzed,
  reminder,
}: {
  kind: string;
  name?: string;
  text?: string;
  tags?: EffectTag[];
  analyzed: boolean;
  /** Rules text with no effect row is reminder text (ex rule, Supporter rule), which isn't tagged. */
  reminder?: boolean;
}) {
  return (
    <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{kind}</div>
      {name && <div className="mt-1 font-medium">{name}</div>}
      {text && <p className="mt-1 text-sm leading-relaxed">{text}</p>}
      {analyzed && tags && (
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.length ? (
            tags.map((t) => <TagChip key={t.tagId} id={t.tagId} params={t.params} />)
          ) : (
            <span className="text-xs text-neutral-500">No capability tags</span>
          )}
        </div>
      )}
      {analyzed && !tags && reminder && <div className="mt-2 text-xs text-neutral-500">Reminder text, not tagged</div>}
    </div>
  );
}
