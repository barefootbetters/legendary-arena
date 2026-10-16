/**
 * Scheme-specific setup sizing for the Legendary Arena game engine (D-24321).
 *
 * Some schemes print a setup rule that sizes a pile differently from the
 * requested match configuration. Legacy Virus is the first: "Wound stack holds
 * 6 Wounds per player" — a stack far smaller than the default, which is exactly
 * what makes its "Evil Wins: If the Wound stack runs out" reachable.
 *
 * This is applied as a POST-VALIDATION override at pile build (in
 * buildInitialGameState): the requested config is validated normally (its
 * woundsCount passes the 30 floor, D-24032), then the engine builds the Wound
 * pile at the scheme's effective size. The floor governs the requested config;
 * the scheme rule governs the built pile.
 *
 * A single explicit branch, not a general framework (per "duplicate first,
 * abstract on the third copy"). No boardgame.io import. No I/O. Pure.
 */

const LEGACY_VIRUS_SCHEME_ID = 'core/legacy-virus-the';

/** Legacy Virus prints "Wound stack holds 6 Wounds per player". */
const LEGACY_VIRUS_WOUNDS_PER_PLAYER = 6;

const CLASH_SCHEME_ID = 'chmp/clash-of-the-monsters-unleashed';

/** Clash of the Monsters Unleashed prints "6 Wounds per player in the Wound Stack". */
const CLASH_WOUNDS_PER_PLAYER = 6;

const CIVIL_WAR_SCHEME_ID = 'core/super-hero-civil-war';

/** Super Hero Civil War prints "If only 2 players, use only 4 Heroes in the Hero Deck". */
const CIVIL_WAR_2P_HERO_GROUPS = 4;

/** A printed Scheme Twist count at 1, 2, 3, 4 and 5 players, in that order. */
type TwistCountByPlayers = readonly [number, number, number, number, number];

// why: a scheme whose printed Setup sizes the twist stack by player count (D-24733 /
// D-24734). The card data carries only a scalar villainDeckTwistCount, so these
// schemes used to get the builder's flat 8 at every count. Each row is the printed
// clause written out at 1-5 players, so a reader can check it against the card without
// doing arithmetic; schemeSetupSizing.test.ts pins every row to its card's Setup text.
// Where a card prints nothing for 1 player, 1 player mirrors 2 (as Civil War's loss
// map does, D-24371 §6).
const SCHEME_TWIST_COUNT_BY_PLAYERS: Readonly<Record<string, TwistCountByPlayers>> = {
  // "For 2-3 players, use 8 Twists. For 4-5 players, use 5 Twists." (D-24733)
  'core/super-hero-civil-war': [8, 8, 8, 5, 5],
  'msp1/super-hero-civil-war': [8, 8, 8, 5, 5],
  // "1-3 players: 6 Twists. 4-5 players: 5 Twists."
  'co2e/super-hero-civil-war': [6, 6, 6, 5, 5],
  // "1-3 players: 9 Twists. 4-5 players: 6 Twists."
  'cvwr/epic-super-hero-civil-war': [9, 9, 9, 6, 6],
  // "1-3 players: 6 Twists. 4-5 Players: 5 Twists."
  'dead/deadpool-kills-the-marvel-universe': [6, 6, 6, 5, 5],
  // "2 players: 9 Twists. 1 or 4 players: 10 Twists. 3 or 5 players: 11 Twists."
  'dstr/duels-of-science-and-magic': [10, 9, 11, 10, 11],
  // "1 player: 7 Twists. 2-3 players: 9 Twists. 4-5 players: 11 Twists."
  'rvlt/secret-hydra-corruption': [7, 9, 9, 11, 11],
  // "8 Twists. (1 player: 4 Twists.)"
  'ssw2/fountain-of-eternal-life-the': [4, 8, 8, 8, 8],
  // "1 player: 8 Twists. 2-4 players: 10 Twists. 5 players: 11 Twists."
  'wpnx/go-after-heroes-loved-ones': [8, 10, 10, 10, 11],
  // "Twists equal to the number of players plus 6."
  'antm/transform-commuters-into-giant-ants': [7, 8, 9, 10, 11],
  // "Twists equal to 5 plus the number of players."
  'bkpt/poison-lakes-with-nanite-microbots': [6, 7, 8, 9, 10],
  // "8 Twists, minus 1 Twist per player."
  'bkwd/train-black-widows-in-the-red-room': [7, 6, 5, 4, 3],
  // "11 Twists, minus 1 Twist per player."
  'bkwd/sniper-rifle-assassins': [10, 9, 8, 7, 6],
  // "6 Twists plus 1 per player."
  'co2e/negative-zone-prison-outbreak': [7, 8, 9, 10, 11],
  // "3 Twists, plus 1 Twist per player."
  'co2e/enshrouded-identity': [4, 5, 6, 7, 8],
  // "Twists equal to the number of players plus 5."
  'gotg/unite-the-shards': [6, 7, 8, 9, 10],
  // "6 Twists, plus 1 per player." (with Lilith: 1 Twist total, below)
  'mdns/ritual-sacrifice-to-summon-chthon': [7, 8, 9, 10, 11],
  // "Twists equal to the number of players plus 4."
  'msis/sacrifice-for-the-soul-stone': [5, 6, 7, 8, 9],
  // "1 Twist, plus 2 Twists per player."
  'nmut/trapped-in-the-insane-asylum': [3, 5, 7, 9, 11],
  // "Add Twists equal to the number of players plus 3."
  'rlmk/devolve-with-xerogen-crystals': [4, 5, 6, 7, 8],
  // "Twists equal to the number of players plus 4."
  'wpnx/wipe-heroes-memories': [5, 6, 7, 8, 9],
};

const CHTHON_SCHEME_ID = 'mdns/ritual-sacrifice-to-summon-chthon';

const LILITH_MASTERMIND_ID = 'mdns/lilith-mother-of-demons';

/** Ritual Sacrifice to Summon Chthon prints "If using Lilith: Use 1 Twist total". */
const CHTHON_WITH_LILITH_TWIST_COUNT = 1;

/**
 * Returns the effective Wound-stack size for a match, applying any
 * scheme-specific setup sizing.
 *
 * For Legacy Virus and Clash of the Monsters Unleashed, the stack is
 * `6 × numPlayers` (each card's printed setup) — this is deliberately below the
 * 30 woundsCount config-floor (D-24032); the floor validates the requested
 * config, this rule sizes the built pile. Every other scheme uses the requested
 * count unchanged.
 *
 * @param schemeId - The selected scheme ext_id (`G.selection.schemeId`).
 * @param numPlayers - The match player count (`ctx.numPlayers`).
 * @param requestedWoundsCount - The validated `config.woundsCount`.
 * @returns The number of Wound cards to build into `G.piles.wounds`.
 */
export function resolveEffectiveWoundsCount(
  schemeId: string,
  numPlayers: number,
  requestedWoundsCount: number,
): number {
  if (schemeId === LEGACY_VIRUS_SCHEME_ID) {
    // why: the card's printed setup ("6 Wounds per player"); intentionally below
    // the 30 config-floor — the small stack IS Legacy Virus's doom clock, and
    // the loss ("If the Wound stack runs out") is unreachable at the flat 30.
    return LEGACY_VIRUS_WOUNDS_PER_PLAYER * numPlayers;
  }
  if (schemeId === CLASH_SCHEME_ID) {
    // why: D-24736 — the card's printed setup ("6 Wounds per player in the Wound
    // Stack"); the Wound Stack running out is half of Clash's Evil Wins, and the
    // Monster Pit's Wounds are what drain it.
    return CLASH_WOUNDS_PER_PLAYER * numPlayers;
  }
  return requestedWoundsCount;
}

/**
 * Returns the effective Hero-Deck group id list for a match, applying any
 * scheme-specific setup sizing (D-24328).
 *
 * For Super Hero Civil War at exactly 2 players, the deck is built from only the
 * first 4 of the requested hero groups — the card's printed setup ("If only 2
 * players, use only 4 Heroes in the Hero Deck"). That smaller 56-card deck is what
 * makes WP-510/D-24318's "Evil Wins: If the Hero Deck runs out" reachable at 2p; the
 * default 5-group / 70-card deck is too large to run out in a normal 2p game. Every
 * other scheme and player count uses the requested ids unchanged.
 *
 * This is a POST-VALIDATION override (the second sizing case, a sibling to
 * `resolveEffectiveWoundsCount`): validation now requires exactly 4 at 2p (WP-576 /
 * D-24385 — the requirement-side resolveEffectiveHeroCount override), so the loadout
 * already supplies 4 ids and this `slice(0, 4)` is a retained defensive no-op on a
 * 4-id loadout, not the sizing mechanism. (It stayed the sizing mechanism only while
 * the requirement side still demanded 5; the D-24385 requirement override closed that
 * gap — displays-5/plays-4 is gone.)
 *
 * @param schemeId - The selected scheme ext_id (`config.schemeId`).
 * @param numPlayers - The match player count (`ctx.numPlayers`).
 * @param requestedHeroDeckIds - The validated `config.heroDeckIds`.
 * @returns The hero-group id list to build into the Hero Deck.
 */
export function resolveEffectiveHeroDeckIds(
  schemeId: string,
  numPlayers: number,
  requestedHeroDeckIds: string[],
): string[] {
  if (schemeId === CIVIL_WAR_SCHEME_ID && numPlayers === 2) {
    // why: the card's printed setup ("If only 2 players, use only 4 Heroes in the Hero
    // Deck") — the smaller deck is Civil War's 2p doom clock, and the depletion loss
    // (WP-510/D-24318) is unreachable at the flat 5-group deck. The first 4 is a
    // deterministic engine choice: the card lets the table pick which 4, but the engine
    // cannot ask, so it keeps the first 4 of the loadout's list (a stable, arbitrary
    // default; a future loadout-layer refinement could let a 2p Civil War loadout name
    // exactly 4). `slice` is safe on a list already shorter than 4 (returns it unchanged).
    return requestedHeroDeckIds.slice(0, CIVIL_WAR_2P_HERO_GROUPS);
  }
  return requestedHeroDeckIds;
}

/**
 * Returns the effective Scheme Twist count for the Villain Deck, applying any
 * scheme-specific setup sizing (D-24733 / D-24734).
 *
 * A scheme in SCHEME_TWIST_COUNT_BY_PLAYERS gets its printed count for the match's
 * player count; Ritual Sacrifice to Summon Chthon with Lilith as the Mastermind gets 1
 * ("If using Lilith: Use 1 Twist total"). Every other scheme keeps its resolved count
 * (its villainDeckTwistCount, or the builder's default) unchanged.
 *
 * @param schemeId - The selected scheme ext_id (`config.schemeId`).
 * @param mastermindId - The selected mastermind ext_id (`config.mastermindId`).
 * @param numPlayers - The match player count (`ctx.numPlayers`).
 * @param defaultTwistCount - The scheme's villainDeckTwistCount, or the builder's default.
 * @returns The number of Scheme Twist cards to build into the Villain Deck.
 */
export function resolveEffectiveTwistCount(
  schemeId: string,
  mastermindId: string,
  numPlayers: number,
  defaultTwistCount: number,
): number {
  if (schemeId === CHTHON_SCHEME_ID && mastermindId === LILITH_MASTERMIND_ID) {
    return CHTHON_WITH_LILITH_TWIST_COUNT;
  }
  const countsByPlayers = SCHEME_TWIST_COUNT_BY_PLAYERS[schemeId];
  if (countsByPlayers === undefined) {
    return defaultTwistCount;
  }
  // why: a player count outside 1-5 is rejected upstream (boardgame.io player bounds,
  // the setup contract); keep the resolved count rather than read past the row.
  const printedCount = countsByPlayers[numPlayers - 1];
  if (printedCount === undefined) {
    return defaultTwistCount;
  }
  return printedCount;
}
