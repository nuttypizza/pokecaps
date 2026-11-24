import type { EffectKind } from "./normalize";

/**
 * Rule-based tagger. Each rule reads the normalized effect text (see
 * normalize.ts) and returns params when it matches. Bump RULES_VERSION
 * whenever rules change so the analysis job re-tags everything.
 */
export const RULES_VERSION = "rules-1";
export const RULE_CONFIDENCE = 0.9;

export type EffectInput = { kind: EffectKind; normText: string; damage: string | null };
export type RuleTag = { tagId: string; params?: Record<string, number | string>; rationale: string };

type Ctx = EffectInput & { text: string; sentences: string[]; baseDamage: number | null };
type Match = boolean | Record<string, number | string> | null | undefined;
type Rule = { tag: string; why: string; kinds?: EffectKind[]; test: (c: Ctx) => Match };

const NUM: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 };
const toNum = (s: string | undefined) => (s === undefined ? undefined : (NUM[s] ?? (Number.parseInt(s, 10) || undefined)));

const any = (c: Ctx, ...res: RegExp[]) => res.some((re) => re.test(c.text));
const sentence = (c: Ctx, pred: (s: string) => boolean) => c.sentences.some(pred);
const OPP = /\b(your opponent's|their)\b/;

/** "search your deck for X ..." clauses, up to the shuffle. */
function searchClauses(c: Ctx): string[] {
  return [...c.text.matchAll(/search(?:es)? (?:your|their) deck for ([^]*?)(?:\. then, shuffle|\. shuffle|$)/g)].map((m) => m[1]);
}
const toHand = (s: string) => /into (?:your|their) hand/.test(s);
const objPokemon = (s: string) => /pokemon|\{self\}/.test(s.replace(/pokemon tools?/g, ""));
const objEnergy = (s: string) => /\benergy\b/.test(s);
const objTrainer = (s: string) => /\b(supporter|item|pokemon tool|tool|stadium|trainer)\b/.test(s);

/** "... from your discard pile into your hand/deck" sentences, with the object before "from". */
function discardRecoveries(c: Ctx): string[] {
  return c.sentences
    .filter((s) => /from your discard pile/.test(s) && /into your (hand|deck)/.test(s) && !/opponent's discard/.test(s))
    .map((s) => s.split("from your discard pile")[0]);
}

const RULES: Rule[] = [
  // Draw
  {
    tag: "draw.cards",
    why: "draws cards",
    test: (c) => {
      const m = c.text.match(/\bdraw (a|an|one|two|three|four|five|six|seven|eight|\d+|that many|up to \d+) cards?\b/);
      if (m) return { count: toNum(m[1].replace("up to ", "")) ?? m[1] };
      return /\bdraw a card for each\b|\bdraw cards? equal to\b|\bdraw \d+ cards? for each\b/.test(c.text);
    },
  },
  { tag: "draw.until", why: "draws until hand size", test: (c) => any(c, /\bdraws? cards until (you|they) have\b/) },
  {
    tag: "draw.refresh",
    why: "shuffles or discards hand, then draws",
    test: (c) => any(c, /(shuffles? (your|their) hand|discard your hand|put your hand on the bottom)[^.]*(\.|,|and) [^.]*\bdraws?\b/),
  },

  // Search
  { tag: "search.pokemon", why: "searches deck for Pokémon to hand", test: (c) => searchClauses(c).some((s) => toHand(s) && objPokemon(s)) },
  { tag: "search.energy", why: "searches deck for Energy to hand", test: (c) => searchClauses(c).some((s) => toHand(s) && objEnergy(s)) },
  { tag: "search.trainer", why: "searches deck for Trainers to hand", test: (c) => searchClauses(c).some((s) => toHand(s) && objTrainer(s)) },
  {
    tag: "search.any",
    why: "searches deck for any card",
    test: (c) => searchClauses(c).some((s) => toHand(s) && /^(a|up to \d+|\d+|any) cards?\b/.test(s)),
  },
  {
    tag: "search.top",
    why: "looks at top cards and takes some",
    test: (c) => any(c, /look at the (top|bottom) (\d+|card) (cards )?of your deck[^]*into your hand/),
  },

  // Energy
  {
    tag: "energy.from-deck",
    why: "attaches Energy from deck",
    test: (c) =>
      sentence(c, (s) => /(search your deck|top \d+ cards of your deck|from your deck)/.test(s) && /\battach/.test(s) && /energy/.test(s)) ||
      searchClauses(c).some((s) => /energy[^]*attach/.test(s)),
  },
  {
    tag: "energy.from-discard",
    why: "attaches Energy from discard pile",
    test: (c) => sentence(c, (s) => /\battach/.test(s) && /energy/.test(s) && /from your discard pile/.test(s)),
  },
  {
    tag: "energy.from-hand",
    why: "extra Energy attachment from hand",
    kinds: ["ability", "rule", "attack"],
    test: (c) =>
      sentence(c, (s) => /\battach\b[^.]*energy[^.]*from your hand/.test(s) && !/opponent/.test(s)),
  },
  {
    tag: "energy.move",
    why: "moves Energy between your Pokémon",
    test: (c) =>
      sentence(
        c,
        (s) => /\bmove\b[^.]*energy/.test(s) && !/from (1 of )?your opponent's|opponent's pokemon to/.test(s) && /(your|this|another)/.test(s),
      ),
  },
  {
    tag: "energy.special",
    why: "provides several or every type of Energy",
    kinds: ["rule"],
    test: (c) => {
      const m = c.text.match(/provides (\d+|two|three) (\w+ )?energy|provides (every type of|energy of every type)|provides \w+ energy for each/);
      return Boolean(m);
    },
  },

  {
    tag: "energy.cost-cut",
    why: "makes attacks cost less Energy",
    test: (c) =>
      any(c, /ignore (all |\d+ )?(\w+ )?energy in the costs? of attacks/, /costs? \d+ (\w+ )?energy less/, /attacks[^.]* cost (\w+ ){1,3}less\b/) && !/opponent's pokemon/.test(c.text),
  },

  // Recovery
  { tag: "recovery.pokemon", why: "Pokémon from discard to hand/deck", test: (c) => discardRecoveries(c).some(objPokemon) },
  { tag: "recovery.energy", why: "Energy from discard to hand/deck", test: (c) => discardRecoveries(c).some(objEnergy) },
  { tag: "recovery.trainer", why: "Trainers from discard", test: (c) => discardRecoveries(c).some(objTrainer) },
  { tag: "recovery.revive", why: "puts Pokémon from discard onto Bench", test: (c) => any(c, /from (your|their) discard pile onto (your|their) bench/) },

  // Healing
  {
    tag: "heal.damage",
    why: "heals damage",
    test: (c) => {
      const m = c.text.match(/\bheal (\d+|all) damage\b/);
      if (m) return { amount: m[1] === "all" ? "all" : Number(m[1]) };
      return /\bheal (all )?(the )?damage from|\bheal (that much|the same amount of) damage|\bheals? \d+ damage|\bmove [^.]*damage counters? from [^.]*(of your|your other)/.test(c.text);
    },
  },
  {
    tag: "heal.conditions",
    why: "removes Special Conditions",
    test: (c) => any(c, /\brecovers? from (all |a )?special conditions?/, /\bremove (all )?special conditions?/),
  },

  // Mobility
  {
    tag: "switch.self",
    why: "switches your Active with Benched",
    test: (c) =>
      any(
        c,
        /\bswitch (your active pokemon|this pokemon|it|{self}|that pokemon|your active [^.]*?pokemon) with (1 of )?your benched/,
        /\bswitch (1 of )?your benched pokemon with your active/,
        /\bswitch their active (\w+ )?pokemon with 1 of their benched/,
      ),
  },
  {
    tag: "switch.retreat",
    why: "reduces or removes Retreat Cost",
    test: (c) =>
      sentence(c, (s) => /retreat cost/.test(s) && /(\bless\b|has no retreat cost|have no retreat cost|is 0|no retreat cost)/.test(s) && (!OPP.test(s) || /both yours/.test(s))) ||
      any(c, /retreat[^.]* without paying/),
  },
  {
    tag: "switch.bounce",
    why: "returns your own Pokémon to hand or deck",
    test: (c) =>
      sentence(
        c,
        (s) =>
          /\b(put|shuffle) (this pokemon|{self}|1 of your pokemon|your active pokemon|1 of your benched pokemon|1 of your benched [^.]*?|1 of your [^.]*?pokemon|that pokemon)( and all (attached )?cards( attached to it)?)?[^.]*into your (hand|deck)/.test(s) &&
          !OPP.test(s.split("into your")[0]),
      ),
  },

  // Gust
  {
    tag: "gust.pick",
    why: "you choose opponent's new Active",
    test: (c) =>
      any(c, /switch in (up to )?1 of your opponent's benched pokemon/, /switch (1 of )?your opponent's benched pokemon with (their|your opponent's) active/),
  },
  {
    tag: "gust.force",
    why: "opponent must switch their Active",
    test: (c) =>
      any(
        c,
        /your opponent switches their active pokemon with 1 of their benched/,
        /switch out your opponent's active pokemon/,
        /(shuffle|put) your opponent's active pokemon[^.]*into (their|your opponent's) (hand|deck)/,
        /your opponent shuffles their active pokemon[^.]*into their deck/,
        /shuffle each player's active pokemon/,
      ),
  },

  // Damage
  {
    tag: "damage.bench",
    why: "damages Benched Pokémon",
    test: (c) =>
      any(
        c,
        /damage to (each of |up to \d+ of |\d+ of |1 of |2 of )?your opponent's benched pokemon/,
        /damage to (each of |up to \d+ of |\d+ of |1 of |2 of )?your opponent's pokemon/,
        /damage counters on (each of |up to \d+ of |\d+ of |1 of )?your opponent's (benched )?pokemon/,
        /damage counters on your opponent's pokemon in any way/,
      ),
  },
  {
    tag: "damage.spread",
    why: "hits several opposing Pokémon",
    test: (c) =>
      any(
        c,
        /damage to each of your opponent's/,
        /damage to (up to )?[2-6] of your opponent's/,
        /damage counters on (each of )?your opponent's (benched )?pokemon in any way you like/,
        /damage counters on each of your opponent's/,
      ),
  },
  {
    tag: "damage.counters",
    why: "places damage counters",
    test: (c) => {
      const m = c.text.match(/\b(?:put|place) (\d+|a|an) damage counters? on/);
      if (m) return { count: toNum(m[1]) ?? m[1] };
      return /\b(put|place) damage counters on|damage counters on [^.]* equal to|damage counter[^.]*for each/.test(c.text);
    },
  },
  {
    tag: "damage.scaling",
    why: "damage scales with a count",
    test: (c) =>
      (c.kind === "attack" && /×|x$/.test(c.damage ?? "")) ||
      any(c, /does \d+ (more )?damage for each\b/, /\d+ (more )?damage times the\b/, /damage for each [^.]*(energy|prize|card|pokemon|damage counter)/),
  },
  {
    tag: "damage.boost",
    why: "makes attacks do more damage",
    test: (c) =>
      any(
        c,
        /attacks (used by|of) [^.]*do \d+ more damage/,
        /attacks? [^.]*do(es)? \d+ more damage to your opponent's active/,
        /the attacks of [^.]*do \d+ more damage/,
        /\bdo \d+ more damage to your opponent's active pokemon\b/,
      ) && !(c.kind === "attack" && /^this attack does/.test(c.text)),
  },
  {
    tag: "damage.high",
    why: "base damage of 200 or more",
    kinds: ["attack"],
    test: (c) => (c.baseDamage !== null && c.baseDamage >= 200 ? { damage: c.baseDamage } : false),
  },
  {
    tag: "damage.ko",
    why: "knocks out without damage",
    test: (c) =>
      any(c, /if heads, (your opponent's active pokemon|the defending pokemon|the attacking pokemon) is knocked out/, /\bknock out (1 of )?your opponent's/, /(your opponent's active pokemon|that pokemon) is knocked out\.?$/) &&
      !/^if (this|your|1 of your)/.test(c.text),
  },

  {
    tag: "damage.conditional",
    why: "bonus damage when a condition is met",
    kinds: ["attack"],
    test: (c) => /\bthis attack does \d+ more damage\b/.test(c.text) && !/for each/.test(c.text),
  },
  {
    tag: "damage.pierce",
    why: "ignores Resistance, Weakness or defending effects",
    kinds: ["attack"],
    test: (c) =>
      any(c, /damage isn't affected by (weakness or )?resistance/, /isn't affected by any effects on (your opponent's|the defending)/, /isn't affected by weakness/),
  },

  // Protection
  {
    tag: "protect.reduce",
    why: "takes less damage",
    test: (c) => {
      const m = c.text.match(/takes? (\d+) less damage/);
      if (m) return { amount: Number(m[1]) };
      return any(c, /damage done to [^.]* is reduced by/, /ha(ve|s) no weakness/, /(defending pokemon's|your opponent's [^.]*) attacks do \d+ less damage/);
    },
  },
  {
    tag: "protect.prevent",
    why: "prevents all damage",
    test: (c) => any(c, /prevent all damage( and effects of attacks)? (done )?to/, /prevent all damage from (and effects of )?attacks/, /if heads, prevent that damage/, /(it|this pokemon) is not knocked out/),
  },
  {
    tag: "protect.effects",
    why: "prevents effects",
    test: (c) =>
      any(
        c,
        /prevent all effects of/,
        /prevent all damage and effects/,
        /prevent all damage from and effects of/,
        /can't be affected by (any )?(special conditions|effects)/,
        /(isn't|aren't|is not|are not) affected by (any )?(effects|special conditions|abilities)/,
        /prevent all damage counters from being placed/,
        /can't be (asleep|burned|confused|paralyzed|poisoned)/,
      ),
  },
  {
    tag: "protect.hp",
    why: "raises HP",
    test: (c) => {
      const m = c.text.match(/gets? \+(\d+) hp/);
      return m ? { amount: Number(m[1]) } : any(c, /maximum hp is \d+ (more|higher)/);
    },
  },

  // Disruption
  {
    tag: "disrupt.hand",
    why: "disrupts opponent's hand",
    test: (c) =>
      any(
        c,
        /your opponent (shuffles|discards|puts) [^.]*their hand/,
        /(each player|both players) (shuffles|discards|puts) [^.]*their hand/,
        /discard [^.]* from your opponent's hand/,
        /your opponent reveals their hand[^]*(discard|bottom of their deck|into their deck)/,
        /(cards?|card) from your opponent's hand/,
        /choose (a|\d+|up to \d+) cards? from your opponent's hand/,
      ),
  },
  {
    tag: "disrupt.energy",
    why: "removes opponent's Energy",
    test: (c) =>
      sentence(
        c,
        (s) =>
          /(discard|remove)[^.]*energy[^.]*(from|attached to)[^.]*(opponent's|the attacking pokemon|the defending pokemon)/.test(s) ||
          /energy[^.]*attached to [^.]*opponent's[^.]*into (their|your opponent's) (hand|deck)/.test(s) ||
          /(move|put) [^.]*energy (from|attached to) [^.]*opponent's/.test(s),
      ),
  },
  {
    tag: "disrupt.tool",
    why: "discards Pokémon Tools",
    test: (c) =>
      sentence(c, (s) => /discard[^.]*pokemon tools?/.test(s) && !/from your hand/.test(s) && (/opponent|yours or|both|each|in play/.test(s))),
  },
  { tag: "disrupt.tool", why: "turns off Pokémon Tools", test: (c) => any(c, /pokemon tools attached to [^.]* have no effect/) },
  { tag: "disrupt.stadium", why: "discards a Stadium", test: (c) => any(c, /discard (a|that|the|any) stadium/, /discard [^.]*stadium in play/) },
  {
    tag: "disrupt.mill",
    why: "discards from opponent's deck",
    test: (c) => {
      const m = c.text.match(/discard the top (card|\d+ cards) of your opponent's deck/);
      if (m) return { count: m[1] === "card" ? 1 : Number.parseInt(m[1], 10) };
      return any(c, /discard the top [^.]* of (your opponent's|each player's) deck/);
    },
  },
  { tag: "disrupt.item-lock", why: "stops Item, Supporter or Stadium play", test: (c) => any(c, /can't play (any )?(item|supporter|stadium|trainer) cards/) },
  {
    tag: "disrupt.ability-lock",
    why: "stops Abilities",
    test: (c) => any(c, /have no abilities/, /has no abilities/, /abilities[^.]* (have no effect|can't be used)/, /can't use (any )?abilities/),
  },
  {
    tag: "disrupt.attack-lock",
    why: "stops attacking or retreating",
    test: (c) =>
      any(
        c,
        /the defending pokemon can't (attack|retreat|use)/,
        /your opponent's active pokemon can't (attack|retreat|use)/,
        /\bthat attack doesn't happen\b/,
        /that pokemon can't use that attack/,
        /(your opponent's|the defending) pokemon[^.]* can't (attack|retreat)/,
      ),
  },
  {
    tag: "disrupt.tax",
    why: "raises opponent's costs",
    test: (c) =>
      sentence(c, (s) => /costs? ((colorless|grass|fire|water|lightning|psychic|fighting|darkness|metal) ?)+more\b/.test(s) && /(opponent|both yours|each|defending)/.test(s)) ||
      any(c, /(opponent's|defending) [^.]*retreat cost is (\w+ )+more/),
  },
  { tag: "disrupt.devolve", why: "devolves Pokémon", test: (c) => any(c, /\bdevolve\b/) },

  // Special Conditions (inflicted on the opponent)
  ...(["poisoned", "burned", "asleep", "paralyzed", "confused"] as const).map<Rule>((cond) => ({
    tag: `cond.${cond}`,
    why: `inflicts ${cond}`,
    test: (c) =>
      sentence(
        c,
        (s) =>
          (new RegExp(`\\b(is|are) now [^.]*\\b${cond}\\b`).test(s) ||
            new RegExp(`\\bmake (your opponent's active pokemon|both active pokemon|the defending pokemon) [^.]*\\b${cond}\\b`).test(s)) &&
          !/\b(this pokemon|{self}) is now\b/.test(s),
      ),
  })),

  // Setup
  {
    tag: "setup.bench",
    why: "puts Pokémon from deck onto Bench",
    test: (c) => searchClauses(c).some((s) => /onto your bench/.test(s)) || any(c, /from your deck onto your bench/, /top [^.]* of your deck[^]*onto your bench/),
  },
  {
    tag: "setup.evolve",
    why: "helps evolve",
    test: (c) =>
      any(
        c,
        /to evolve (it|that pokemon|them)/,
        /skipping the stage 1/,
        /can evolve [^.]*(first turn|the turn (you|they) play)/,
        /search your deck for [^.]*evolves from/,
        /evolve [^.]*from your deck/,
      ),
  },
  {
    tag: "protect.prize",
    why: "denies or reduces Prizes",
    test: (c) => any(c, /your opponent (can't take any|takes \d+ fewer|takes 1 fewer) prize cards?/),
  },
  { tag: "setup.prize", why: "takes extra Prizes", test: (c) => any(c, /take (\d+|1|an additional|another) (more )?prize cards?/, /take \d+ more prize/) },
  {
    tag: "setup.attack-copy",
    why: "uses other Pokémon's attacks",
    test: (c) => any(c, /choose 1 of [^.]*attacks[^.]*(and use it|use it as this attack)/, /use it as this attack/, /can use any attack from/, /can use the attack on this card/),
  },

  // Drawbacks (costs that come with the effect)
  {
    tag: "drawback.self-damage",
    why: "damages itself",
    test: (c) => any(c, /this pokemon (also )?does \d+ damage to itself/, /put \d+ damage counters on this pokemon/),
  },
  {
    tag: "drawback.discard-energy",
    why: "discards its own Energy",
    test: (c) => any(c, /discard (an|a|all|\d+|up to \d+)?[^.]*energy (cards? )?(from|attached to) this pokemon/),
  },
  {
    tag: "drawback.lockout",
    why: "can't attack again next turn",
    kinds: ["attack"],
    test: (c) => any(c, /during your next turn, this pokemon can't (attack|use)/),
  },
  { tag: "drawback.self-condition", why: "affects itself", test: (c) => any(c, /\bthis pokemon is now (asleep|confused|paralyzed|poisoned|burned)/) },
  { tag: "drawback.bench-damage", why: "damages your own Bench", test: (c) => any(c, /damage to each of your benched pokemon/, /damage to 1 of your benched pokemon/) },
  { tag: "trait.coin", why: "uses coin flips", test: (c) => any(c, /\bflip (a|\d+|\w+) coins?\b/) },
];

function baseDamage(damage: string | null): number | null {
  const m = damage?.match(/^(\d+)/);
  return m ? Number(m[1]) : null;
}

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?)])\s+(?=[a-z({•])|\s*•\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function tagEffect(input: EffectInput): RuleTag[] {
  const ctx: Ctx = { ...input, text: input.normText, sentences: splitSentences(input.normText), baseDamage: baseDamage(input.damage) };
  const out: RuleTag[] = [];
  for (const rule of RULES) {
    if (rule.kinds && !rule.kinds.includes(input.kind)) continue;
    const m = rule.test(ctx);
    if (!m) continue;
    out.push({ tagId: rule.tag, rationale: rule.why, ...(typeof m === "object" ? { params: m } : {}) });
  }
  return out;
}

export const RULE_TAG_IDS = RULES.map((r) => r.tag);
