/**
 * Capability taxonomy. Edit here (ids are permanent; retire instead of
 * deleting), then run `npm run analyze` to push it to the database.
 */
export type TagDef = { id: string; label: string; description: string };
export type CategoryDef = { id: string; label: string; tags: TagDef[] };

export const TAXONOMY: CategoryDef[] = [
  {
    id: "draw",
    label: "Draw",
    tags: [
      { id: "draw.cards", label: "Draw cards", description: "Draws a set number of cards." },
      { id: "draw.until", label: "Draw until N", description: "Draws until your hand has a number of cards." },
      { id: "draw.refresh", label: "Hand refresh", description: "Shuffles or discards your hand, then draws." },
    ],
  },
  {
    id: "search",
    label: "Search",
    tags: [
      { id: "search.pokemon", label: "Search Pokémon", description: "Searches the deck for Pokémon." },
      { id: "search.energy", label: "Search Energy", description: "Searches the deck for Energy cards." },
      { id: "search.trainer", label: "Search Trainer", description: "Searches the deck for Supporter, Item, Tool or Stadium cards." },
      { id: "search.any", label: "Search any card", description: "Searches the deck for any card." },
      { id: "search.top", label: "Dig top of deck", description: "Looks at the top cards of the deck and takes some." },
    ],
  },
  {
    id: "energy",
    label: "Energy acceleration",
    tags: [
      { id: "energy.from-deck", label: "Attach from deck", description: "Attaches Energy from the deck." },
      { id: "energy.from-discard", label: "Attach from discard", description: "Attaches Energy from the discard pile." },
      { id: "energy.from-hand", label: "Extra attach from hand", description: "Attaches extra Energy from hand." },
      { id: "energy.move", label: "Move Energy", description: "Moves Energy between your Pokémon." },
      { id: "energy.cost-cut", label: "Cheaper attacks", description: "Attacks cost less Energy." },
      { id: "energy.special", label: "Provides extra Energy", description: "Provides more or different Energy than a basic Energy." },
    ],
  },
  {
    id: "recovery",
    label: "Recovery",
    tags: [
      { id: "recovery.pokemon", label: "Recover Pokémon", description: "Returns Pokémon from the discard pile to hand or deck." },
      { id: "recovery.energy", label: "Recover Energy", description: "Returns Energy from the discard pile to hand or deck." },
      { id: "recovery.trainer", label: "Recover Trainer", description: "Returns Trainer cards from the discard pile." },
      { id: "recovery.revive", label: "Revive to Bench", description: "Puts Pokémon from the discard pile onto the Bench." },
    ],
  },
  {
    id: "healing",
    label: "Healing",
    tags: [
      { id: "heal.damage", label: "Heal damage", description: "Heals damage from Pokémon." },
      { id: "heal.conditions", label: "Cure conditions", description: "Removes Special Conditions." },
    ],
  },
  {
    id: "mobility",
    label: "Switching and mobility",
    tags: [
      { id: "switch.self", label: "Switch your Active", description: "Switches your Active Pokémon with a Benched one." },
      { id: "switch.retreat", label: "Retreat help", description: "Reduces or removes Retreat Cost." },
      { id: "switch.bounce", label: "Return to hand or deck", description: "Puts your own Pokémon back into hand or deck." },
    ],
  },
  {
    id: "gust",
    label: "Gust",
    tags: [
      { id: "gust.pick", label: "Choose opponent's Active", description: "You pick which Benched Pokémon your opponent moves to the Active Spot." },
      { id: "gust.force", label: "Force opponent to switch", description: "Your opponent must switch, and they pick the replacement." },
    ],
  },
  {
    id: "damage",
    label: "Damage output",
    tags: [
      { id: "damage.bench", label: "Bench damage", description: "Does damage to Benched Pokémon." },
      { id: "damage.spread", label: "Spread damage", description: "Damages several of your opponent's Pokémon at once." },
      { id: "damage.counters", label: "Place damage counters", description: "Puts damage counters on Pokémon." },
      { id: "damage.scaling", label: "Scaling damage", description: "Damage grows with a count (Energy, cards, Prizes and so on)." },
      { id: "damage.boost", label: "Damage boost", description: "Makes attacks do more damage." },
      { id: "damage.high", label: "High base damage", description: "Base damage of 200 or more." },
      { id: "damage.conditional", label: "Conditional bonus", description: "Attack does more damage when a condition is met or a coin lands heads." },
      { id: "damage.pierce", label: "Ignores Resistance or effects", description: "Damage ignores Weakness, Resistance or effects on the defender." },
      { id: "damage.ko", label: "Instant Knock Out", description: "Knocks out a Pokémon without damage math." },
    ],
  },
  {
    id: "protection",
    label: "Protection",
    tags: [
      { id: "protect.reduce", label: "Damage reduction", description: "Takes less damage from attacks." },
      { id: "protect.prevent", label: "Prevent damage", description: "Prevents all damage from attacks." },
      { id: "protect.effects", label: "Prevent effects", description: "Prevents effects of attacks, abilities or conditions." },
      { id: "protect.prize", label: "Prize denial", description: "Your opponent takes fewer or no Prize cards." },
      { id: "protect.hp", label: "HP boost", description: "Raises maximum HP." },
    ],
  },
  {
    id: "disruption",
    label: "Disruption",
    tags: [
      { id: "disrupt.hand", label: "Hand disruption", description: "Shrinks or discards your opponent's hand." },
      { id: "disrupt.energy", label: "Energy removal", description: "Discards or moves your opponent's Energy." },
      { id: "disrupt.tool", label: "Tool removal", description: "Discards Pokémon Tools." },
      { id: "disrupt.stadium", label: "Stadium removal", description: "Discards a Stadium in play." },
      { id: "disrupt.mill", label: "Mill", description: "Discards cards from the top of your opponent's deck." },
      { id: "disrupt.item-lock", label: "Item or Trainer lock", description: "Stops your opponent playing Item, Supporter or Stadium cards." },
      { id: "disrupt.ability-lock", label: "Ability lock", description: "Stops Abilities from working." },
      { id: "disrupt.attack-lock", label: "Attack or retreat lock", description: "Stops a Pokémon attacking or retreating." },
      { id: "disrupt.tax", label: "Cost increase", description: "Makes your opponent's attacks or retreat cost more." },
      { id: "disrupt.devolve", label: "Devolve", description: "Devolves your opponent's Pokémon." },
    ],
  },
  {
    id: "conditions",
    label: "Special Conditions",
    tags: [
      { id: "cond.poisoned", label: "Poison", description: "Makes a Pokémon Poisoned." },
      { id: "cond.burned", label: "Burn", description: "Makes a Pokémon Burned." },
      { id: "cond.asleep", label: "Sleep", description: "Makes a Pokémon Asleep." },
      { id: "cond.paralyzed", label: "Paralysis", description: "Makes a Pokémon Paralyzed." },
      { id: "cond.confused", label: "Confusion", description: "Makes a Pokémon Confused." },
    ],
  },
  {
    id: "setup",
    label: "Setup and tempo",
    tags: [
      { id: "setup.bench", label: "Fill Bench", description: "Puts Pokémon from the deck onto the Bench." },
      { id: "setup.evolve", label: "Evolution help", description: "Evolves early, skips stages, or evolves from the deck." },
      { id: "setup.prize", label: "Extra Prizes", description: "Takes more Prize cards." },
      { id: "setup.attack-copy", label: "Copy attacks", description: "Uses attacks from other Pokémon." },
    ],
  },
  {
    id: "drawback",
    label: "Drawbacks and traits",
    tags: [
      { id: "drawback.self-damage", label: "Damages itself", description: "Does damage or puts damage counters on itself." },
      { id: "drawback.discard-energy", label: "Discards own Energy", description: "Discards Energy from itself as a cost." },
      { id: "drawback.lockout", label: "Can't attack next turn", description: "Can't attack (or use this attack) during your next turn." },
      { id: "drawback.self-condition", label: "Self Special Condition", description: "Leaves itself with a Special Condition." },
      { id: "drawback.bench-damage", label: "Hits your Bench", description: "Also damages your own Benched Pokémon." },
      { id: "trait.coin", label: "Coin flip", description: "Outcome depends on coin flips." },
    ],
  },
];

export const ALL_TAGS = TAXONOMY.flatMap((c, ci) =>
  c.tags.map((t, ti) => ({ ...t, category: c.id, sortOrder: ci * 100 + ti })),
);
export const TAG_IDS = new Set(ALL_TAGS.map((t) => t.id));
export const CATEGORY_LABEL = Object.fromEntries(TAXONOMY.map((c) => [c.id, c.label]));
