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

const CIVIL_WAR_SCHEME_ID = 'core/super-hero-civil-war';

/** Super Hero Civil War prints "If only 2 players, use only 4 Heroes in the Hero Deck". */
const CIVIL_WAR_2P_HERO_GROUPS = 4;

/**
 * Returns the effective Wound-stack size for a match, applying any
 * scheme-specific setup sizing.
 *
 * For Legacy Virus, the stack is `6 × numPlayers` (its printed setup) — this is
 * deliberately below the 30 woundsCount config-floor (D-24032); the floor
 * validates the requested config, this rule sizes the built pile. Every other
 * scheme uses the requested count unchanged.
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
 * `resolveEffectiveWoundsCount`): the loadout still provides and validates its normal
 * 5 hero-deck ids (matchSetup.validate requires exactly 5 at 2p), and this rule sizes
 * the BUILT deck below that — the same config-floor / built-pile split as D-24321's
 * wound sizing.
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
