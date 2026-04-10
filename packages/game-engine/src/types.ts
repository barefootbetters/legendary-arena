/**
 * Core types for the Legendary Arena game engine.
 *
 * LegendaryGameState is the shape of boardgame.io game state (G).
 * MatchConfiguration is the match setup payload passed to Game.setup().
 */

import type { MatchSetupConfig } from './matchSetup.types.js';

// why: MatchConfiguration (WP-002) and MatchSetupConfig (WP-005A) have
// identical 9-field shapes. MatchSetupConfig in matchSetup.types.ts is now
// the canonical definition with full validation support. MatchConfiguration
// is retained as a type alias for backward compatibility with game.ts and
// existing tests. Both names refer to the same type. See DECISIONS.md for
// the consolidation rationale.

/**
 * Match configuration payload sent to boardgame.io Game.setup().
 *
 * This is a type alias for MatchSetupConfig — the canonical match setup
 * contract defined in matchSetup.types.ts. Both names are exported for
 * backward compatibility.
 *
 * All card references use ext_id strings from the card registry. Field names
 * are locked by 00.2 section 8.1 — do not rename, abbreviate, or reorder.
 */
export type MatchConfiguration = MatchSetupConfig;

/**
 * Named type alias for card ext_id strings stored in zones and piles.
 *
 * All zones in G store CardExtId strings exclusively — never full card
 * objects, display names, or database IDs.
 */
export type CardExtId = string;

/**
 * Minimal setup-time context interface for deterministic operations.
 *
 * Captures what buildInitialGameState needs from the boardgame.io setup
 * context. Satisfied by the real boardgame.io context (via structural
 * typing) and by makeMockCtx (in tests).
 *
 * Defined locally to avoid importing boardgame.io in pure helpers.
 *
 * boardgame.io 0.50.x setup signature is:
 *   setup(context: { ctx: Ctx, random: RandomAPI, events, log }, setupData?)
 * The `ctx` sub-object carries match metadata (numPlayers, currentPlayer,
 * phase, turn). The `random` plugin API lives on the context itself, NOT
 * on ctx. This interface mirrors that nesting so that the real boardgame.io
 * context is structurally assignable without casting.
 */
export interface SetupContext {
  /** boardgame.io context metadata — numPlayers lives here, not at top level. */
  ctx: { numPlayers: number };
  /** Deterministic RNG provided by boardgame.io's random plugin. */
  random: { Shuffle: <T>(deck: T[]) => T[] };
}

/**
 * Per-player card zones. All arrays contain CardExtId strings only.
 *
 * After setup, only `deck` is non-empty. Cards enter other zones
 * exclusively through game moves — never through setup initialization.
 */
export interface PlayerZones {
  /** The player's draw pile. Shuffled at setup. */
  deck: CardExtId[];
  /** Cards in the player's hand. Empty at setup. */
  hand: CardExtId[];
  /** The player's discard pile. Empty at setup. */
  discard: CardExtId[];
  /** Cards currently in play this turn. Empty at setup. */
  inPlay: CardExtId[];
  /** Defeated villains and rescued bystanders. Empty at setup. */
  victory: CardExtId[];
}

/**
 * Shared global card piles. Sizes come from MatchSetupConfig count fields.
 * All arrays contain CardExtId strings only.
 */
export interface GlobalPiles {
  /** Bystander cards. Size equals config.bystandersCount. */
  bystanders: CardExtId[];
  /** Wound cards. Size equals config.woundsCount. */
  wounds: CardExtId[];
  /** S.H.I.E.L.D. Officer cards. Size equals config.officersCount. */
  officers: CardExtId[];
  /** Sidekick cards. Size equals config.sidekicksCount. */
  sidekicks: CardExtId[];
}

/**
 * Resolved match selection metadata copied from the validated config.
 *
 * Stores the ext_id references for the scheme, mastermind, villain groups,
 * henchman groups, and hero decks selected for this match.
 */
export interface MatchSelection {
  /** Scheme ext_id selected for this match. */
  readonly schemeId: string;
  /** Mastermind ext_id selected for this match. */
  readonly mastermindId: string;
  /** Villain group ext_ids selected for this match. */
  readonly villainGroupIds: readonly string[];
  /** Henchman group ext_ids selected for this match. */
  readonly henchmanGroupIds: readonly string[];
  /** Hero deck ext_ids selected for this match. */
  readonly heroDeckIds: readonly string[];
}

/**
 * The shape of boardgame.io game state (G).
 *
 * Invariant: G must be JSON-serializable at all times. No functions, classes,
 * Maps, Sets, Dates, or Symbols may appear anywhere in this type or its
 * descendants.
 */
export interface LegendaryGameState {
  /** The match configuration used to set up this game. Immutable after setup. */
  readonly matchConfiguration: MatchConfiguration;

  // why: selection extracts the entity reference fields from matchConfiguration
  // for convenient read access. matchConfiguration is the full 9-field input;
  // selection holds just the scheme, mastermind, and group ext_ids.
  /** Resolved match selection metadata (scheme, mastermind, groups, heroes). */
  readonly selection: MatchSelection;

  // why: playerZones is keyed by player ID string (boardgame.io uses "0", "1",
  // etc.). Each player has exactly 5 zone arrays. Only deck is non-empty after
  // setup — cards enter other zones via moves only.
  /** Per-player card zones, keyed by player ID ("0", "1", ...). */
  playerZones: Record<string, PlayerZones>;

  // why: piles contains the shared global card piles sized from config count
  // fields. Each pile array contains CardExtId strings. Piles are consumed by
  // game moves (e.g., gaining a wound, rescuing a bystander).
  /** Shared global card piles (bystanders, wounds, officers, sidekicks). */
  piles: GlobalPiles;
}
