/**
 * Core types for the Legendary Arena game engine.
 *
 * LegendaryGameState is the shape of boardgame.io game state (G).
 * MatchConfiguration is the match setup payload passed to Game.setup().
 *
 * Zone and player state types are defined canonically in
 * src/state/zones.types.ts and re-exported here for backward compatibility.
 */

import type { MatchSetupConfig } from './matchSetup.types.js';

// why: Persistence boundary types (PERSISTENCE_CLASSES, MatchSnapshot,
// PersistableMatchConfig) are defined canonically in
// src/persistence/persistence.types.ts (WP-013). Re-exported here so that
// consumers importing from './types.js' have access.
export type {
  MatchSnapshot,
  MatchSnapshotPlayer,
  MatchSnapshotOutcome,
  PersistableMatchConfig,
} from './persistence/persistence.types.js';
export { PERSISTENCE_CLASSES } from './persistence/persistence.types.js';

// why: LobbyState is defined canonically in src/lobby/lobby.types.ts (WP-011).
// Re-exported here so that consumers importing from './types.js' have access.
export type { LobbyState, SetPlayerReadyArgs } from './lobby/lobby.types.js';

// why: Turn phase types (MatchPhase, TurnStage, TurnPhaseError) are defined
// canonically in src/turn/turnPhases.types.ts (WP-007A). They are re-exported
// here so that consumers importing from './types.js' have access.
export type {
  MatchPhase,
  TurnStage,
  TurnPhaseError,
} from './turn/turnPhases.types.js';

// why: Move contracts (MoveResult, MoveError, CoreMoveName) are the engine-wide
// result contract defined canonically in src/moves/coreMoves.types.ts (WP-008A).
// Re-exported here so that consumers importing from './types.js' have access.
export type {
  MoveResult,
  MoveError,
  CoreMoveName,
} from './moves/coreMoves.types.js';

// why: Rule hook contracts (RuleTriggerName, RuleEffect, HookDefinition,
// HookRegistry) are defined canonically in src/rules/ruleHooks.types.ts
// (WP-009A). Re-exported here so that consumers importing from './types.js'
// have access.
export type {
  RuleTriggerName,
  RuleEffect,
  HookDefinition,
  HookRegistry,
} from './rules/ruleHooks.types.js';

// why: Endgame types (EndgameResult, EndgameOutcome) are defined canonically
// in src/endgame/endgame.types.ts (WP-010). Re-exported here so that
// consumers importing from './types.js' have access. ENDGAME_CONDITIONS is
// a value export (const), not a type, so it uses a separate export statement.
export type {
  EndgameResult,
  EndgameOutcome,
} from './endgame/endgame.types.js';
export { ENDGAME_CONDITIONS } from './endgame/endgame.types.js';

// why: Zone types (CardExtId, PlayerZones, GlobalPiles) were originally
// defined inline in this file during WP-005B. WP-006A consolidated them
// into src/state/zones.types.ts as the canonical source. They are
// re-exported here so that existing imports from './types.js' continue
// to work without modification.
export type {
  CardExtId,
  Zone,
  PlayerZones,
  PlayerState,
  GlobalPiles,
  ZoneValidationError,
  GameStateShape,
} from './state/zones.types.js';

import type { TurnStage } from './turn/turnPhases.types.js';
import type { CardExtId, PlayerZones, GlobalPiles } from './state/zones.types.js';
import type { HookDefinition } from './rules/ruleHooks.types.js';
import type { LobbyState } from './lobby/lobby.types.js';

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

  // why: boardgame.io's ctx does not expose the inner turn stage in a form
  // that move functions can read. Storing currentStage in G makes it observable
  // to moves (for stage gating) and JSON-serializable (for replay and snapshots).
  // Reset to the first TURN_STAGES entry on each new turn by the play phase
  // onBegin hook.
  /** Current turn stage within the play phase (start, main, cleanup). */
  currentStage: TurnStage;

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

  // why: messages is a deterministic event log that records rule effects,
  // warnings, and diagnostic entries. It is append-only during gameplay and
  // supports replay inspection and debugging.
  /** Deterministic event log populated by rule effects. */
  messages: string[];

  // why: counters tracks named numeric values used by endgame conditions and
  // scheme/mastermind rules. Counters are modified by modifyCounter effects
  // and read by evaluateEndgame.
  /** Named numeric counters for endgame conditions and rule tracking. */
  counters: Record<string, number>;

  // why: hookRegistry stores data-only HookDefinition entries that describe
  // which triggers each hook subscribes to and its execution priority. Handler
  // functions live in the ImplementationMap outside of G — they are never
  // stored here. This keeps G JSON-serializable.
  /** Data-only rule hook definitions (no functions). */
  hookRegistry: HookDefinition[];

  // why: lobby state is stored in G so the UI can observe lobby completion
  // and readiness status. Initialized at setup time from ctx.numPlayers.
  /** Lobby phase state (player readiness and match start flag). */
  lobby: LobbyState;
}
