import { describe, expect, it } from "vitest";
import { effectHash, extractEffects, isBoilerplate, normalizeText } from "./normalize";
import { RULE_TAG_IDS, tagEffect } from "./rules";
import { TAG_IDS } from "./taxonomy";
import type { ApiCard } from "@/sync/types";

const tags = (text: string, kind: "ability" | "attack" | "rule" = "rule", damage: string | null = null) =>
  tagEffect({ kind, damage, normText: normalizeText(text) }).map((t) => t.tagId).sort();

describe("taxonomy", () => {
  it("every rule points at a defined tag", () => {
    for (const id of RULE_TAG_IDS) expect(TAG_IDS.has(id), id).toBe(true);
  });
});

describe("normalize", () => {
  it("lowercases, strips accents and collapses spaces", () => {
    expect(normalizeText("Search your deck for a  Pokémon.")).toBe("search your deck for a pokemon.");
  });
  it("swaps the card's own name for {self}", () => {
    expect(normalizeText("Put Pikachu ex onto your Bench.", "Pikachu ex")).toBe("put {self} onto your bench.");
  });
  it("detects reminder text", () => {
    expect(isBoilerplate(normalizeText("You may play only 1 Supporter card during your turn."))).toBe(true);
    expect(isBoilerplate(normalizeText("Pokémon ex rule: When your Pokémon ex is Knocked Out, your opponent takes 2 Prize cards."))).toBe(true);
    expect(isBoilerplate(normalizeText("Draw 3 cards."))).toBe(false);
  });
  it("hashes kind, damage and text together", () => {
    expect(effectHash("attack", "30", "x")).not.toBe(effectHash("attack", "40", "x"));
    expect(effectHash("attack", "30", "x")).toBe(effectHash("attack", "30", "x"));
  });
  it("extracts effects, skipping boilerplate, and keeps Trainer names as words", () => {
    const card = {
      id: "t-1",
      name: "Switch",
      supertype: "Trainer",
      number: "1",
      rules: ["Switch your Active Pokémon with 1 of your Benched Pokémon.", "You may play any number of Item cards during your turn."],
    } as ApiCard;
    const effects = extractEffects(card);
    expect(effects).toHaveLength(1);
    expect(effects[0].normText).toContain("switch your active pokemon");
  });
});

describe("rules on real card text", () => {
  it.each([
    ["Draw 3 cards.", ["draw.cards"]],
    ["Draw cards until you have 6 cards in your hand.", ["draw.until"]],
    ["Shuffle your hand into your deck. Then, draw 4 cards. If your opponent has 3 or fewer Prize cards remaining, draw 8 cards instead.", ["draw.cards", "draw.refresh"]],
    ["Search your deck for up to 3 Basic Energy cards, reveal them, and put them into your hand. Then, shuffle your deck.", ["search.energy"]],
    ["Search your deck for a Supporter card that has \"Team Rocket\" in its name, reveal it, and put it into your hand. Then, shuffle your deck.", ["search.trainer"]],
    ["Discard your hand and search your deck for a Pokémon, a Supporter card, and a Basic Energy card, reveal them, and put them into your hand. Then, shuffle your deck.", ["search.energy", "search.pokemon", "search.trainer"]],
    ["Look at the top 7 cards of your deck. You may reveal a Pokémon you find there and put it into your hand. Shuffle the other cards back into your deck.", ["search.top"]],
    ["Attach a Basic Psychic Energy card from your discard pile to 1 of your Benched Psychic Pokémon.", ["energy.from-discard"]],
    ["Put up to 4 Basic Energy cards from your discard pile into your hand.", ["recovery.energy"]],
    ["Shuffle up to 5 Pokémon from your discard pile into your deck.", ["recovery.pokemon"]],
    ["Switch in 1 of your opponent's Benched Pokémon to the Active Spot.", ["gust.pick"]],
    ["Discard a Pokémon Tool and a Special Energy from 1 of your opponent's Pokémon.", ["disrupt.energy", "disrupt.tool"]],
    ["Your opponent's Active Pokémon is now Asleep and Poisoned.", ["cond.asleep", "cond.poisoned"]],
    ["Discard the top card of your opponent's deck.", ["disrupt.mill"]],
    ["The Dragon Pokémon this card is attached to takes 50 less damage from attacks from your opponent's Grass, Fire, Water, or Lightning Pokémon (after applying Weakness and Resistance).", ["protect.reduce"]],
    ["Search your deck for up to 3 Basic Pokémon with 120 HP or less, reveal them, and put them into your hand. Then, shuffle your deck.", ["search.pokemon"]],
  ])("%s", (text, expected) => {
    expect(tags(text)).toEqual([...expected].sort());
  });

  it("switching with a choice also boosts damage", () => {
    const t = tags(
      "Choose 1: • Switch your Active Pokémon with 1 of your Benched Pokémon. • During this turn, attacks used by your Pokémon do 30 more damage to your opponent's Active Pokémon ex and Active Pokémon V (before applying Weakness and Resistance).",
    );
    expect(t).toContain("switch.self");
    expect(t).toContain("damage.boost");
  });

  it("tags attacks by damage", () => {
    expect(tags("", "attack", "230")).toEqual(["damage.high"]);
    expect(tags("This attack does 30 damage for each Energy attached to this Pokémon.", "attack", "30×")).toEqual(["damage.scaling"]);
    expect(tags("Flip a coin. If heads, this attack does 30 more damage.", "attack", "30+")).toEqual(["damage.conditional", "trait.coin"]);
    expect(tags("This Pokémon also does 30 damage to itself.", "attack", "120")).toEqual(["drawback.self-damage"]);
    expect(tags("This attack also does 30 damage to 1 of your opponent's Benched Pokémon. (Don't apply Weakness and Resistance for Benched Pokémon.)", "attack", "60")).toEqual(["damage.bench"]);
  });

  it("doesn't call a search 'return to hand'", () => {
    expect(tags("Search your deck for a Pokémon, reveal it, and put it into your hand. Then, shuffle your deck.", "attack")).toEqual(["search.pokemon"]);
    expect(tags("Put this Pokémon and all attached cards into your hand.", "attack")).toEqual(["switch.bounce"]);
  });

  it("returns params", () => {
    const [draw] = tagEffect({ kind: "rule", damage: null, normText: normalizeText("Draw 3 cards.") });
    expect(draw.params).toEqual({ count: 3 });
    const heal = tagEffect({ kind: "ability", damage: null, normText: normalizeText("Heal 90 damage from 1 of your Pokémon.") });
    expect(heal[0]).toMatchObject({ tagId: "heal.damage", params: { amount: 90 } });
  });
});
