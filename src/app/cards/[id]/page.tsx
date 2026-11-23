import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getCard } from "@/lib/queries";
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
  const row = await getCard(decodeURIComponent(id));
  if (!row) notFound();
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

          {data.abilities?.map((a) => (
            <Effect key={a.name} kind={a.type} name={a.name} text={a.text} />
          ))}
          {data.attacks?.map((a) => (
            <Effect
              key={a.name}
              kind={`Attack · ${(a.cost ?? []).join(", ") || "no cost"}`}
              name={a.damage ? `${a.name} — ${a.damage}` : a.name}
              text={a.text}
            />
          ))}
          {data.rules?.map((r, i) => <Effect key={i} kind="Rules" text={r} />)}

          <p className="rounded-md border border-dashed border-black/15 p-3 text-sm text-neutral-500 dark:border-white/20">
            Capability tags arrive in phase 2.
          </p>
        </div>
      </div>
    </div>
  );
}

function Effect({ kind, name, text }: { kind: string; name?: string; text?: string }) {
  return (
    <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{kind}</div>
      {name && <div className="mt-1 font-medium">{name}</div>}
      {text && <p className="mt-1 text-sm leading-relaxed">{text}</p>}
    </div>
  );
}
