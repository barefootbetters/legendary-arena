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
  ScenarioScoringConfig,
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
import {
  buildVillainDeck,
  isVillainDeckRegistryReader,
} from '../villainDeck/villainDeck.setup.js';
import { initializeCity, initializeHq } from '../board/city.logic.js';
import { buildCardStats, resetTurnEconomy } from '../economy/economy.logic.js';
import {
  buildMastermindState,
  isMastermindRegistryReader,
} from '../mastermind/mastermind.setup.js';
import {
  buildHeroAbilityHooks,
  isHeroAbilityRegistryReader,
} from './heroAbility.setup.js';
import { buildCardKeywords } from './buildCardKeywords.js';
import {
  buildSchemeSetupInstructions,
  isSchemeRegistryReader,
} from './buildSchemeSetupInstructions.js';
import { executeSchemeSetup } from '../scheme/schemeSetup.execute.js';

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
 * @param scoringConfig - Optional setup-time PAR scoring configuration. When
 *   provided, assigned to G.activeScoringConfig to mark the match as
 *   PAR-scored. When undefined, the field stays unset.
 * @returns The fully populated initial LegendaryGameState.
 */
// why: 4th positional optional parameter per D-6703; narrowest additive change
// that keeps the 9-field MatchSetupConfig lock (D-1244) and D-4805
// scenario-config separation intact.
export function buildInitialGameState(
  config: MatchSetupConfig,
  registry: CardRegistryReader,
  context: SetupContext,
  scoringConfig?: ScenarioScoringConfig,
): LegendaryGameState {
  // why: Helpers were extracted from this function to satisfy the 30-line
  // function limit (code-style Rule 5) and to improve testability. Each
  // helper is independently testable with its own shape tests.

  const numPlayers = context.ctx.numPlayers;

  // why: D-10014 — Uniformity Rule + builder signatures don't accept G +
  // remediation pointer to setRegistryForSetup. Per Q3 LOCKED
  // orchestration-only, all four setup-builder diagnostic emissions live
  // here. Each guard returns false on incomplete registry-reader interface
  // (test mocks, server-not-wired). On false, push a full-sentence
  // diagnostic naming (a) which builder was skipped, (b) why, (c) how to
  // fix. Builder-internal `isXRegistryReader → empty` paths remain
  // unchanged for defense-in-depth; this orchestration site is the
  // primary detection seam.
  const setupMessages: string[] = [];

  if (!isVillainDeckRegistryReader(registry)) {
    setupMessages.push(
      'buildVillainDeck skipped: the registry-reader interface is incomplete (listCards / listSets / getSet missing or not functions). Verify that setRegistryForSetup(registry) was called at server startup, or that the test mock implements the full reader interface.',
    );
  }
  if (!isMastermindRegistryReader(registry)) {
    setupMessages.push(
      'buildMastermindState skipped: the registry-reader interface is incomplete (listSets / getSet missing or not functions). Verify that setRegistryForSetup(registry) was called at server startup, or that the test mock implements the full reader interface.',
    );
  }
  if (!isSchemeRegistryReader(registry)) {
    setupMessages.push(
      'buildSchemeSetupInstructions skipped: the registry-reader interface is incomplete (listSets / getSet missing or not functions). Verify that setRegistryForSetup(registry) was called at server startup, or that the test mock implements the full reader interface.',
    );
  }
  if (!isHeroAbilityRegistryReader(registry)) {
    setupMessages.push(
      'buildHeroAbilityHooks skipped: the registry-reader interface is incomplete (listCards missing or not a function). Verify that setRegistryForSetup(registry) was called at server startup, or that the test mock implements the full reader interface.',
    );
  }

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

  // why: cardStats extracted to local variable so buildMastermindState
  // can add the mastermind base card entry to it. buildMastermindState
  // MUST execute after buildCardStats (ordering invariant — EC-019).
  const cardStats = buildCardStats(registry as unknown, config);

  // why: card keywords resolved at setup from registry so moves never query
  // registry at runtime — same pattern as G.cardStats (WP-018) and
  // G.villainDeckCardTypes (WP-014B).
  const cardKeywords = buildCardKeywords(registry as unknown, config);

  // why: scheme setup runs after base construction, before first turn.
  // Instructions configure the board (counters, keywords, city state).
  // Separate from scheme twist execution (WP-024).
  const schemeSetupInstructions = buildSchemeSetupInstructions(
    config.schemeId as CardExtId,
    registry as unknown,
  );

  // why: mastermind state built from registry at setup time; base card
  // fightCost added to cardStats so fightMastermind reads it without
  // registry access. Narrow test mocks produce empty state gracefully.
  const mastermindState = buildMastermindState(
    config.mastermindId as CardExtId,
    registry as unknown,
    context,
    cardStats,
  );

  // why: build the base state first, then apply scheme setup instructions.
  // executeSchemeSetup returns updated state — pure function, no mutation.
  // At MVP, schemeSetupInstructions is always [], so this is a no-op passthrough.
  const baseState: LegendaryGameState = {
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
    messages: setupMessages,
    counters: {},
    hookRegistry: buildDefaultHookDefinitions(config),
    // why: villain deck built from registry data at setup time; see D-1410
    // through D-1413 for ext_id conventions and composition rules.
    villainDeck: villainDeckResult.state,
    villainDeckCardTypes: villainDeckResult.cardTypes,
    // why: KO pile starts empty; cards enter via koCard helper (WP-017)
    ko: [],
    // why: no bystanders attached at game start; populated during reveals (WP-017)
    attachedBystanders: {},
    // why: City initialized empty; villains enter via revealVillainCard (WP-015)
    city: initializeCity(),
    // why: HQ initialized empty; recruit slot population is WP-016 scope
    hq: initializeHq(),
    // why: mastermind state built at setup from registry; tactics deck
    // shuffled deterministically; base card fightCost in G.cardStats
    mastermind: mastermindState,
    // why: card stats resolved at setup from registry so moves never query
    // registry at runtime — same pattern as G.villainDeckCardTypes (WP-014).
    // Read-only after setup (mastermind base card added by buildMastermindState).
    cardStats,
    // why: board keywords resolved at setup from registry — same pattern as
    // cardStats and villainDeckCardTypes. Immutable during gameplay.
    cardKeywords,
    // why: scheme setup instructions stored for replay observability (D-2601).
    // Empty at MVP — no structured scheme metadata in registry yet.
    schemeSetupInstructions,
    // why: economy starts at zero; reset again at each turn start
    turnEconomy: resetTurnEconomy(),
    // why: hero ability hooks built from registry at setup time — same
    // pattern as hookRegistry and cardStats. Immutable during gameplay.
    // Execution deferred to WP-022+.
    heroAbilityHooks: buildHeroAbilityHooks(registry, config),
    // why: lobby state initialized at setup time from ctx.numPlayers. All
    // players start as not ready. G.lobby.started is false until
    // startMatchIfReady succeeds.
    lobby: {
      requiredPlayers: context.ctx.numPlayers,
      ready: {},
      started: false,
    } satisfies LobbyState,
    // why: conditional spread per WP-029 exactOptionalPropertyTypes pattern —
    // the field is included only when scoringConfig was supplied; never written
    // as `activeScoringConfig: undefined` literally (D-6703).
    ...(scoringConfig !== undefined ? { activeScoringConfig: scoringConfig } : {}),
  };

  return executeSchemeSetup(baseState, schemeSetupInstructions);
}
