/**
 * Builds the initial LegendaryGameState (G) from a validated MatchSetupConfig.
 *
 * Called by Game.setup() after validation succeeds. Resolves config fields
 * into zone arrays of CardExtId strings and constructs the full initial
 * game state.
 *
 * After this function returns, the engine operates solely on G and ctx.
 * No further registry access occurs at runtime.
 */

import type {
  LegendaryGameState,
  SetupContext,
  PlayerZones,
  MatchSelection,
  CardExtId,
  LobbyState,
} from '../types.js';
import { TURN_STAGES } from '../turn/turnPhases.types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { CardRegistryReader } from '../matchSetup.validate.js';
import { buildPlayerState } from './playerInit.js';
import {
  buildGlobalPiles,
  BYSTANDER_EXT_ID,
  WOUND_EXT_ID,
  SHIELD_OFFICER_EXT_ID,
  SIDEKICK_EXT_ID,
} from './pilesInit.js';
import { buildDefaultHookDefinitions } from '../rules/ruleRuntime.impl.js';
import { buildVillainDeck } from '../villainDeck/villainDeck.setup.js';

// why: Pile ext_id constants are re-exported from pilesInit.ts for backward
// compatibility. The canonical definitions live in pilesInit.ts — importing
// them here prevents silent drift from duplicate string literals.
export { BYSTANDER_EXT_ID, WOUND_EXT_ID, SHIELD_OFFICER_EXT_ID, SIDEKICK_EXT_ID };

// ── Well-known ext_ids for generic game component cards ─────────────────────

// why: Starting cards (S.H.I.E.L.D. Agents and Troopers) are standard game
// components that exist in every Legendary game. They are not set-specific
// cards and do not appear in the registry's per-set card data. These ext_id
// constants provide well-known identifiers for zone tracking.

/** Well-known ext_id for S.H.I.E.L.D. Agent starting cards. */
export const SHIELD_AGENT_EXT_ID: CardExtId = 'starting-shield-agent';

/** Well-known ext_id for S.H.I.E.L.D. Trooper starting cards. */
export const SHIELD_TROOPER_EXT_ID: CardExtId = 'starting-shield-trooper';

// ── Starting deck composition ───────────────────────────────────────────────

// why: Per Legendary board game rules, each player starts with 12 cards:
// 8 S.H.I.E.L.D. Agents (recruit 1) and 4 S.H.I.E.L.D. Troopers (attack 1).

/** Number of S.H.I.E.L.D. Agent cards in each player's starting deck. */
const STARTING_AGENTS_COUNT = 8;

/** Number of S.H.I.E.L.D. Trooper cards in each player's starting deck. */
const STARTING_TROOPERS_COUNT = 4;

/**
 * Builds an unshuffled starting deck of CardExtId strings for one player.
 *
 * @returns Array of 12 CardExtId strings (8 agents + 4 troopers).
 */
function buildStartingDeckCards(): CardExtId[] {
  const cards: CardExtId[] = [];

  for (let i = 0; i < STARTING_AGENTS_COUNT; i++) {
    cards.push(SHIELD_AGENT_EXT_ID);
  }

  for (let i = 0; i < STARTING_TROOPERS_COUNT; i++) {
    cards.push(SHIELD_TROOPER_EXT_ID);
  }

  return cards;
}

/**
 * Extracts the match selection metadata from a validated config.
 *
 * @param config - Validated match setup config.
 * @returns MatchSelection with the selected entity ext_ids.
 */
function buildMatchSelection(config: MatchSetupConfig): MatchSelection {
  return {
    schemeId: config.schemeId,
    mastermindId: config.mastermindId,
    villainGroupIds: [...config.villainGroupIds],
    henchmanGroupIds: [...config.henchmanGroupIds],
    heroDeckIds: [...config.heroDeckIds],
  };
}

// ── Main orchestrator ───────────────────────────────────────────────────────

/**
 * Builds the complete initial LegendaryGameState from a validated config.
 *
 * Delegates player zone construction to buildPlayerState and global pile
 * construction to buildGlobalPiles.
 *
 * @param config - Validated MatchSetupConfig (all 9 fields).
 * @param registry - Card registry for resolving ext_ids. Used by
 *   buildVillainDeck (WP-014B) to resolve villain, henchman, scheme, and
 *   mastermind data at setup time. Satisfies VillainDeckRegistryReader
 *   structurally.
 * @param context - Setup context with ctx.numPlayers and random.Shuffle.
 * @returns The fully populated initial LegendaryGameState.
 */
export function buildInitialGameState(
  config: MatchSetupConfig,
  registry: CardRegistryReader,
  context: SetupContext,
): LegendaryGameState {
  // why: Helpers were extracted from this function to satisfy the 30-line
  // function limit (code-style Rule 5) and to improve testability. Each
  // helper is independently testable with its own shape tests.

  const numPlayers = context.ctx.numPlayers;

  // Build per-player state with shuffled starting decks
  const playerZones: Record<string, PlayerZones> = {};

  for (let playerIndex = 0; playerIndex < numPlayers; playerIndex++) {
    const playerId = String(playerIndex);
    const startingDeck = buildStartingDeckCards();
    const playerState = buildPlayerState(playerId, startingDeck, context);
    playerZones[playerId] = playerState.zones;
  }

  // Build global piles sized from config count fields
  const piles = buildGlobalPiles(config, context);

  // Build selection metadata from config
  const selection = buildMatchSelection(config);

  // Build villain deck from registry data
  // why: villain deck built from registry data at setup time; see D-1410
  // through D-1413 for ext_id conventions and composition rules. The real
  // CardRegistry satisfies VillainDeckRegistryReader structurally. Test mocks
  // that only implement CardRegistryReader (listCards with {key} only) will
  // lack listSets/getSet — buildVillainDeck handles this gracefully by
  // producing an empty deck, which the reveal pipeline already supports.
  const villainDeckResult = buildVillainDeck(config, registry, context);

  return {
    matchConfiguration: config,
    selection,
    // why: currentStage is initialized to the first canonical turn stage.
    // The play phase onBegin hook resets it on each new turn. During setup
    // and lobby phases, currentStage is not meaningful but must be present
    // because LegendaryGameState requires it for JSON-serializability.
    // why: TURN_STAGES is a readonly array with known contents. The non-null
    // assertion is safe because TURN_STAGES always has at least one element
    // (enforced by drift-detection tests in WP-007A).
    currentStage: TURN_STAGES[0]!,
    playerZones,
    piles,
    messages: [],
    counters: {},
    hookRegistry: buildDefaultHookDefinitions(config),
    // why: villain deck built from registry data at setup time; see D-1410
    // through D-1413 for ext_id conventions and composition rules.
    villainDeck: villainDeckResult.state,
    villainDeckCardTypes: villainDeckResult.cardTypes,
    // why: lobby state initialized at setup time from ctx.numPlayers. All
    // players start as not ready. G.lobby.started is false until
    // startMatchIfReady succeeds.
    lobby: {
      requiredPlayers: context.ctx.numPlayers,
      ready: {},
      started: false,
    } satisfies LobbyState,
  };
}
