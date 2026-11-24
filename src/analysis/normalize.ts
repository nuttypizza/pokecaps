import { createHash } from "node:crypto";
import type { ApiCard } from "@/sync/types";

export type EffectKind = "ability" | "attack" | "rule";

export type ExtractedEffect = {
  id: string;
  cardId: string;
  kind: EffectKind;
  position: number;
  name: string | null;
  text: string;
  cost: string[];
  damage: string | null;
  normText: string;
  textHash: string;
};

/** Reminder text printed on many cards that says nothing about what the card does. */
const BOILERPLATE = [
  /^(mega evolution )?pokemon ex rule:/,
  /^when your (mega evolution )?pokemon ex is knocked out, your opponent takes \d+ prize cards?\.?$/,
  /^you may play only 1 (supporter|stadium) card during your turn/,
  /^you may play any number of item cards during your turn/,
  /^you may attach any number of pokemon tools to your pokemon during your turn/,
  /^attach a pokemon tool to 1 of your pokemon that doesn't already have a pokemon tool attached\.?$/,
  /^(ace spec: )?you can't have more than 1 ace spec card in your deck/,
  /^(tera: )?as long as this pokemon is on your bench, prevent all damage done to this pokemon by attacks \(both yours and your opponent's\)\.?$/,
  /^when (your |a )?(pokemon[- ]ex|pokemon-gx|tag team|pokemon v|pokemon vmax|pokemon vstar|this pokemon)[^.]* knocked out, your opponent takes \d+ prize cards?\.?$/,
  /^you can't have more than 1 \{self\} in your deck\.?$/,
  /^when 1 of your pokemon becomes a mega evolution pokemon, your turn ends\.?$/,
  /^\{self\} retains the attacks, abilities, weakness, resistance, and retreat cost of its previous evolution\.?$/,
  /^put this card from your hand onto your bench only with the other half of/,
  /^this pokemon is both \w+ (and )?\w+ type\.?$/,
  /^this card provides 1 (colorless|grass|fire|water|lightning|psychic|fighting|darkness|metal) energy\.?$/,
];

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Lowercase, plain e for é, single spaces, and the card's own name as {self}. */
export function normalizeText(text: string, cardName?: string): string {
  let t = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  if (cardName) {
    const name = normalizeText(cardName);
    if (name.length > 2) t = t.replace(new RegExp(`\\b${escapeRe(name)}\\b`, "g"), "{self}");
  }
  return t;
}

export function isBoilerplate(normText: string): boolean {
  return BOILERPLATE.some((re) => re.test(normText));
}

export function effectHash(kind: EffectKind, damage: string | null, normText: string): string {
  return createHash("sha256").update(`${kind}|${damage ?? ""}|${normText}`).digest("hex").slice(0, 32);
}

/** Splits a card into the effects that get tagged. Boilerplate rules are skipped. */
export function extractEffects(card: ApiCard): ExtractedEffect[] {
  const out: ExtractedEffect[] = [];
  const push = (kind: EffectKind, position: number, name: string | null, text: string, cost: string[], damage: string | null) => {
    // Only Pokémon names are swapped for {self}: Trainer names like "Switch" are also game verbs.
    const normText = normalizeText(text, card.supertype === "Pokémon" ? card.name : undefined);
    if (kind === "rule" && (!normText || isBoilerplate(normText))) return;
    if (kind !== "attack" && !normText) return;
    out.push({
      id: `${card.id}#${kind}${position}`,
      cardId: card.id,
      kind,
      position,
      name,
      text,
      cost,
      damage: damage || null,
      normText,
      textHash: effectHash(kind, damage || null, normText),
    });
  };
  (card.rules ?? []).forEach((r, i) => push("rule", i, null, r, [], null));
  (card.abilities ?? []).forEach((a, i) => push("ability", i, a.name, a.text ?? "", [], null));
  (card.attacks ?? []).forEach((a, i) => push("attack", i, a.name, a.text ?? "", a.cost ?? [], a.damage ?? null));
  return out;
}
