/**
 * useRules.ts
 * Provides static rule glossary and keyword definitions for the registry viewer.
 *
 * Two lookup sources:
 *   RULES_GLOSSARY  — 18 game-mechanic rules from seed_rules.sql, keyed by code.
 *                     Referenced in ability text as [rule:X].
 *   KEYWORD_GLOSSARY — Common gameplay keywords that appear across multiple sets,
 *                      keyed by lowercase keyword name.
 *                      Referenced in ability text as [keyword:X].
 *
 * Ability text may also contain icon/hc/team tokens which are handled by
 * parseAbilityText() but do not have definitions — they're rendered as labels only.
 */

export interface RuleEntry {
  label:   string;
  summary: string;
}

// ── Rules glossary (from seed_rules.sql) ──────────────────────────────────────
// Key: rule code value (matches [rule:X] tokens in ability text)
export const RULES_GLOSSARY: Map<string, RuleEntry> = new Map([
  ["shards", {
    label:   "Shards",
    summary: "Shard tokens represent cosmic energy. Players can spend a Shard for +1 Attack. Villains and Masterminds gain +1 Attack per Shard on them.",
  }],
  ["multiclasscards", {
    label:   "Multiclass Cards",
    summary: "A multiclass card counts as both of its Hero Classes. Great for triggering multiple Superpower Abilities.",
  }],
  ["multiplemasterminds", {
    label:   "Multiple Masterminds",
    summary: "When Villains escape, they can ascend to become additional Masterminds. All Masterminds must be defeated to win.",
  }],
  ["divided", {
    label:   "Divided Card",
    summary: "A Divided Card has two mini-cards printed on one card. When played, choose which side to use. The cost is the cost of one side, not both.",
  }],
  ["traps", {
    label:   "Traps",
    summary: "When a Trap is played from the Villain Deck, you must complete a challenge this turn to avoid it. Success puts it in your Victory Pile.",
  }],
  ["locations", {
    label:   "Locations",
    summary: "Locations are placed above city spaces. They don't move and don't count as Villains. Fight them by spending the listed Attack to claim them.",
  }],
  ["transformingschemes", {
    label:   "Transforming Schemes",
    summary: "Double-sided Schemes that flip over mid-game. Start with the Setup side face up. When told to Transform, flip it over.",
  }],
  ["adaptingmasterminds", {
    label:   "Adapting Masterminds",
    summary: "Adapting Masterminds have only Tactic cards — no main card. The top Tactic counts as the Mastermind. After each Strike, Adapt: shuffle Tactics and reveal a new one on top.",
  }],
  ["villainousweapons", {
    label:   "Villainous Weapons",
    summary: "Weapons captured by Villains boost their Attack. When you defeat that Villain, you claim the Weapon as an Artifact for your own hand.",
  }],
  ["asterisk", {
    label:   "Asterisk Symbol (*)",
    summary: "A * on VP or Attack means there's something unusual about that value — like Size-Changing or a special condition required to fight.",
  }],
  ["sidekicks", {
    label:   "Sidekicks",
    summary: "Pay 2 Recruit to take one Sidekick per turn from the Sidekick Stack. When played, return it to the bottom of the Stack.",
  }],
  ["chooseavillain", {
    label:   "Choose a Villain Group",
    summary: "Pick one specific Villain Group by name. You can count Henchman Groups but not multiple groups at once via shared words.",
  }],
  ["veiledschemes", {
    label:   "Veiled Schemes",
    summary: "Start with this side face up. At a certain point it transforms into a randomly selected Unveiled Scheme.",
  }],
  ["unveiledschemes", {
    label:   "Unveiled Schemes",
    summary: "The transformed version of a Veiled Scheme. Use these rules once the Scheme has flipped to this side.",
  }],
  ["woundsonvillains", {
    label:   "Wounds on Villains",
    summary: "Place a Wound on a Villain to give it -1 Attack. Wounds are returned to the Wound Stack when that Villain is defeated or leaves the city.",
  }],
  ["ambushschemes", {
    label:   "Ambush Schemes",
    summary: "Played alongside the main Scheme. Triggers an immediate effect when drawn. Scheme Twists now trigger both Schemes. Defeat the Ambush Scheme for bonus VP.",
  }],
  ["grievouswounds", {
    label:   "Grievous Wounds",
    summary: "Harder-to-heal Wounds with unique Healing abilities like \"Spend 5 Recruit to KO this Wound.\" Still count as Wounds for all effects.",
  }],
  ["enragingwounds", {
    label:   "Enraging Wounds",
    summary: "Wounds that can be played from hand for bonuses like Recruit or Attack. Each has a unique Healing condition. Still count as Wounds for all effects.",
  }],
  // Generic rule references found in ability text
  ["additional mastermind", {
    label:   "Additional Mastermind",
    summary: "This enemy ascends to become an additional Mastermind. All Masterminds must be defeated to win. No Tactics — fight it once to claim it.",
  }],
  ["transforms", {
    label:   "Transforms",
    summary: "Flip this double-sided card over to its other face. Use only the rules now showing.",
  }],
]);

// ── Keyword glossary (set-specific and universal gameplay terms) ───────────────
// Key: lowercase keyword name (matches the X in [keyword:X])
// These cover keywords that appear across multiple sets and have consistent meanings.
export const KEYWORD_GLOSSARY: Map<string, string> = new Map([
  // ── Universal game actions ──────────────────────────────────────────────────
  ["ambush", "Happens when this card is played from the Villain Deck, before it enters the city."],
  ["fight", "Happens when you defeat this enemy by spending the required Attack."],
  ["escape", "Happens when this Villain escapes the city (moves off the left edge)."],
  ["master strike", "Happens when a Master Strike card is played from the Villain Deck."],
  ["ko", "Remove this card from the game entirely, placing it in the KO pile."],
  ["rescue", "Claim a Bystander from the city or Bystander Deck and put it in your Victory Pile."],
  ["healing", "Discard this Wound to KO it. Some cards require extra conditions to heal."],
  ["last stand", "You may fight a Villain in an empty city space."],
  ["recruit", "Spend Recruit points to buy Hero cards from the HQ into your discard pile."],
  ["attack", "Spend Attack points to fight Villains, Masterminds, and other enemies."],

  // ── Civil War / Set-specific ────────────────────────────────────────────────
  ["team attack", "Combine Attack with another player on the same Villain this turn."],
  ["bribe", "Pay the listed amount to move this Villain away or neutralize its ability."],

  // ── Secret Wars / Cosmic ───────────────────────────────────────────────────
  ["domain", "A territory on Battleworld with its own rules while in play."],
  ["worthy", "When you recruit a card with a 0 cost, you become Worthy and gain a special benefit."],
  ["adapt", "Shuffle the Mastermind Tactics and randomly place a new one on top face up."],

  // ── Midnight Sons / Horror ─────────────────────────────────────────────────
  ["patrol", "This ability triggers based on whether the city space below the HQ slot is empty or occupied."],
  ["blood frenzy", "For each [hc:instinct] or [hc:strength] card you played this turn, draw a card or gain Attack."],
  ["moonlight and sunlight", "This ability has two versions — one for nighttime (Moonlight) and one for daytime (Sunlight). You get both effects if both conditions are met."],
  ["hunt for victims", "This enemy moves to an empty city space or, if none exist, KOs the top Bystander from the Bystander Deck."],
  ["haunt", "Place this card's token on a Hero in the HQ. That Hero gets a penalty while haunted."],

  // ── X-Men / Messiah Complex ────────────────────────────────────────────────
  ["omega level", "This card ignores most restrictions and works at full power regardless of conditions."],
  ["bodyslide", "Teleport this card to a specific city space or zone."],
  ["fastball special", "Pay Attack equal to a teammate's cost to use that teammate's Fight ability."],

  // ── Champions / Heroes ─────────────────────────────────────────────────────
  ["inspiration", "Gain a bonus equal to the number of Champions you played this turn."],

  // ── Guardians of the Galaxy ────────────────────────────────────────────────
  ["power stone", "Collect Infinity Stones — each gives a unique ongoing bonus."],
  ["milano", "Use the team ship to gain a travel or combat bonus."],

  // ── Black Panther / Wakanda ────────────────────────────────────────────────
  ["vibranium", "Powerful Wakandan metal — cards with Vibranium have enhanced abilities."],
  ["wound a villain", "Place a Wound on a Villain. It gets -1 Attack for each Wound on it."],

  // ── Doctor Strange / Mystical ──────────────────────────────────────────────
  ["sorcery", "Magical ability that may require discarding or spending extra resources."],
  ["dark dimension", "The realm of Dormammu. Cards in this zone follow special rules."],

  // ── Annihilation / Cosmic ──────────────────────────────────────────────────
  ["annihilation wave", "Massive army bonus — this card gets stronger for each Annihilation Wave Villain in play."],

  // ── General ────────────────────────────────────────────────────────────────
  ["teleport", "Move a card to another city space immediately, ignoring normal movement rules."],
  ["size-changing", "This card's Attack or VP changes based on a game condition (marked with *)."],
  ["divide and conquer", "Split the effect between two different targets instead of applying it all to one."],
  ["additional mastermind", "This Villain ascends and becomes a second Mastermind. All Masterminds must be defeated to win."],
  ["transforms", "Flip this card over to reveal its other side. Use only the currently visible rules."],
]);

// ── Ability text token types ──────────────────────────────────────────────────
export type TokenType = "text" | "keyword" | "rule" | "icon" | "hc" | "team";

export interface AbilityToken {
  type:  TokenType;
  value: string;  // The X in [type:X], or plain text for type="text"
  raw:   string;  // The original markup string
}

// ── parseAbilityText ──────────────────────────────────────────────────────────
/**
 * Parse a single ability text line into typed tokens.
 * Splits on [type:value] markup, yielding interleaved text and token segments.
 *
 * Example input:  "[keyword:Patrol]: If it's empty, you get +1[icon:recruit]."
 * Example output: [
 *   { type: "keyword", value: "Patrol",  raw: "[keyword:Patrol]" },
 *   { type: "text",    value: ": If it's empty, you get +1", raw: "" },
 *   { type: "icon",    value: "recruit", raw: "[icon:recruit]" },
 *   { type: "text",    value: ".",       raw: "" },
 * ]
 */
export function parseAbilityText(text: string): AbilityToken[] {
  const tokens: AbilityToken[] = [];
  // Matches [keyword:X], [icon:X], [hc:X], [team:X], [rule:X]
  const pattern = /\[(keyword|icon|hc|team|rule):([^\]]+)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    // Plain text before this token
    if (match.index > lastIndex) {
      tokens.push({
        type:  "text",
        value: text.slice(lastIndex, match.index),
        raw:   "",
      });
    }

    const tokenType = match[1] as TokenType;
    const tokenValue = match[2] ?? "";

    tokens.push({
      type:  tokenType,
      value: tokenValue,
      raw:   match[0],
    });

    lastIndex = match.index + match[0].length;
  }

  // Any remaining plain text
  if (lastIndex < text.length) {
    tokens.push({
      type:  "text",
      value: text.slice(lastIndex),
      raw:   "",
    });
  }

  return tokens;
}

// ── lookupKeyword ─────────────────────────────────────────────────────────────
/**
 * Look up a keyword definition by name (case-insensitive).
 * Returns the summary string, or null if not found.
 */
export function lookupKeyword(name: string): string | null {
  return KEYWORD_GLOSSARY.get(name.toLowerCase()) ?? null;
}

// ── lookupRule ────────────────────────────────────────────────────────────────
/**
 * Look up a rules glossary entry by code (case-insensitive).
 * Tries both the exact value and a slugified version.
 * Returns the RuleEntry, or null if not found.
 */
export function lookupRule(code: string): RuleEntry | null {
  const normalizedCode = code.toLowerCase().replace(/\s+/g, "");
  // Try exact match first
  if (RULES_GLOSSARY.has(code.toLowerCase())) {
    return RULES_GLOSSARY.get(code.toLowerCase()) ?? null;
  }
  // Try without spaces
  for (const [key, entry] of RULES_GLOSSARY) {
    if (key.replace(/\s+/g, "") === normalizedCode) {
      return entry;
    }
  }
  return null;
}
