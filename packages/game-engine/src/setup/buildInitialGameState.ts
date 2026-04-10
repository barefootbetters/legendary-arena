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
  GlobalPiles,
  MatchSelection,
  CardExtId,
} from '../types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { CardRegistryReader } from '../matchSetup.validate.js';
import { shuffleDeck } from './shuffle.js';

// ── Well-known ext_ids for generic game component cards ─────────────────────

// why: Starting cards (S.H.I.E.L.D. Agents and Troopers) are standard game
// components that exist in every Legendary game. They are not set-specific
// cards and do not appear in the registry's per-set card data. These ext_id
// constants provide well-known identifiers for zone tracking.

/** Well-known ext_id for S.H.I.E.L.D. Agent starting cards. */
export const SHIELD_AGENT_EXT_ID: CardExtId = 'starting-shield-agent';

/** Well-known ext_id for S.H.I.E.L.D. Trooper starting cards. */
export const SHIELD_TROOPER_EXT_ID: CardExtId = 'starting-shield-trooper';

// why: Global pile cards (bystanders, wounds, officers, sidekicks) are
// generic game components. Each pile contains identical copies of a single
// card type, sized from the config count fields.

/** Well-known ext_id for Bystander pile cards. */
export const BYSTANDER_EXT_ID: CardExtId = 'pile-bystander';

/** Well-known ext_id for Wound pile cards. */
export const WOUND_EXT_ID: CardExtId = 'pile-wound';

/** Well-known ext_id for S.H.I.E.L.D. Officer pile cards. */
export const SHIELD_OFFICER_EXT_ID: CardExtId = 'pile-shield-officer';

/** Well-known ext_id for Sidekick pile cards. */
export const SIDEKICK_EXT_ID: CardExtId = 'pile-sidekick';

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
 * Builds the initial PlayerZones for one player with a shuffled starting deck.
 *
 * @param context - Setup context with deterministic RNG.
 * @returns PlayerZones with shuffled deck and empty hand/discard/inPlay/victory.
 */
function buildPlayerZones(context: SetupContext): PlayerZones {
  const unshuffledDeck = buildStartingDeckCards();
  const shuffledDeck = shuffleDeck(unshuffledDeck, context);

  return {
    deck: shuffledDeck,
    hand: [],
    discard: [],
    inPlay: [],
    victory: [],
  };
}

/**
 * Creates an array of identical CardExtId entries.
 *
 * @param extId - The ext_id string to repeat.
 * @param count - How many copies to create.
 * @returns Array of `count` copies of `extId`.
 */
function createPileCards(extId: CardExtId, count: number): CardExtId[] {
  const cards: CardExtId[] = [];

  for (let i = 0; i < count; i++) {
    cards.push(extId);
  }

  return cards;
}

/**
 * Builds the global piles from config count fields.
 *
 * @param config - Validated match setup config with count fields.
 * @param context - Setup context with deterministic RNG.
 * @returns GlobalPiles with shuffled arrays of CardExtId strings.
 */
function buildGlobalPiles(
  config: MatchSetupConfig,
  context: SetupContext,
): GlobalPiles {
  // why: Each pile is shuffled for determinism consistency, even though
  // all cards in a given pile share the same ext_id. This ensures the
  // shuffle path is always exercised and the RNG state advances uniformly.
  return {
    bystanders: shuffleDeck(
      createPileCards(BYSTANDER_EXT_ID, config.bystandersCount),
      context,
    ),
    wounds: shuffleDeck(
      createPileCards(WOUND_EXT_ID, config.woundsCount),
      context,
    ),
    officers: shuffleDeck(
      createPileCards(SHIELD_OFFICER_EXT_ID, config.officersCount),
      context,
    ),
    sidekicks: shuffleDeck(
      createPileCards(SIDEKICK_EXT_ID, config.sidekicksCount),
      context,
    ),
  };
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

/**
 * Builds the complete initial LegendaryGameState from a validated config.
 *
 * This is the primary setup function. It constructs all zones, piles, and
 * selection metadata that constitute the initial game state (G).
 *
 * @param config - Validated MatchSetupConfig (all 9 fields).
 * @param _registry - Card registry for resolving ext_ids. Accepted for API
 *   consistency with future Work Packets (hero deck and villain deck
 *   construction). Currently unused in WP-005B because starting decks and
 *   global piles use well-known card ext_ids.
 * @param context - Setup context with ctx.numPlayers and random.Shuffle.
 * @returns The fully populated initial LegendaryGameState.
 */
export function buildInitialGameState(
  config: MatchSetupConfig,
  _registry: CardRegistryReader,
  context: SetupContext,
): LegendaryGameState {
  const numPlayers = context.ctx.numPlayers;

  // Build per-player zones with shuffled starting decks
  const playerZones: Record<string, PlayerZones> = {};

  for (let playerIndex = 0; playerIndex < numPlayers; playerIndex++) {
    const playerId = String(playerIndex);
    playerZones[playerId] = buildPlayerZones(context);
  }

  // Build global piles sized from config count fields
  const piles = buildGlobalPiles(config, context);

  // Build selection metadata from config
  const selection = buildMatchSelection(config);

  return {
    matchConfiguration: config,
    selection,
    playerZones,
    piles,
  };
}
