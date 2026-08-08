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
