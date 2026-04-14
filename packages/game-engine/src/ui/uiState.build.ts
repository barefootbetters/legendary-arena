/**
 * Builds the authoritative UIState projection from engine state.
 *
 * This file contains the sole function for deriving UIState from G and ctx.
 * The UI never reads G directly — it calls buildUIState to get a
 * JSON-serializable, engine-internal-free projection.
 *
 * No boardgame.io imports. No registry imports. No .reduce().
 * No mutation of G or ctx.
 */

import type { LegendaryGameState } from '../types.js';
import type { PlayerZones } from '../state/zones.types.js';
import type {
  UIState,
  UIPlayerState,
  UICityCard,
  UIGameOverState,
} from './uiState.types.js';
import { getAvailableAttack, getAvailableRecruit } from '../economy/economy.logic.js';
import { evaluateEndgame } from '../endgame/endgame.evaluate.js';
import { computeFinalScores } from '../scoring/scoring.logic.js';
import { WOUND_EXT_ID } from '../setup/buildInitialGameState.js';

// why: exact structural contract — do not widen or add optional fields.
// buildUIState MUST NOT depend on any other ctx fields.
// Structurally compatible with boardgame.io's Ctx at the call site.
interface UIBuildContext {
  readonly phase: string | null;
  readonly turn: number;
  readonly currentPlayer: string;
}

/**
 * Counts wound cards across all five player zones.
 *
 * // why: wounds are CardExtId strings mixed into player zones. There is
 * no dedicated wounds zone per player. Counting uses WOUND_EXT_ID constant
 * to identify wound cards across deck, hand, discard, inPlay, and victory.
 *
 * @param zones - The player's five card zones.
 * @returns The total number of wound cards in all zones.
 */
function countWounds(zones: PlayerZones): number {
  let woundCount = 0;

  // why: iterate each zone explicitly with for...of; no .reduce()
  for (const card of zones.deck) {
    if (card === WOUND_EXT_ID) {
      woundCount += 1;
    }
  }
  for (const card of zones.hand) {
    if (card === WOUND_EXT_ID) {
      woundCount += 1;
    }
  }
  for (const card of zones.discard) {
    if (card === WOUND_EXT_ID) {
      woundCount += 1;
    }
  }
  for (const card of zones.inPlay) {
    if (card === WOUND_EXT_ID) {
      woundCount += 1;
    }
  }
  for (const card of zones.victory) {
    if (card === WOUND_EXT_ID) {
      woundCount += 1;
    }
  }

  return woundCount;
}

/**
 * Derives the authoritative UIState from engine state.
 *
 * Pure function: no I/O, no mutation of G or ctx, no side effects.
 * Same G + ctx always produces the same UIState.
 *
 * Forbidden behaviors (do not add later):
 * - caching or memoization
 * - closures over G or ctx
 * - mutation via object aliasing
 * - any form of side effect or state retention between calls
 *
 * // why: UIState is the only state the UI consumes. This function
 * implements D-0301 (UI Consumes Projections Only). All items in the
 * canonical forbidden internals list are excluded.
 *
 * @param gameState - The current engine state (G). Not mutated.
 * @param ctx - Minimal context with phase, turn, currentPlayer.
 * @returns The derived UIState projection.
 */
export function buildUIState(
  gameState: LegendaryGameState,
  ctx: UIBuildContext,
): UIState {
  // --- 1. Project game phase/turn/active player from ctx ---
  // why: game metadata comes from ctx (framework) and G.currentStage (engine)
  const game = {
    phase: ctx.phase ?? 'unknown',
    turn: ctx.turn,
    activePlayerId: ctx.currentPlayer,
    currentStage: gameState.currentStage,
  };

  // --- 2. Project player states ---
  // why: zone counts hide card identities from the UI; wound count
  // uses WOUND_EXT_ID constant to identify wound cards across all zones
  const players: UIPlayerState[] = [];
  for (const playerId of Object.keys(gameState.playerZones)) {
    const zones = gameState.playerZones[playerId]!;
    players.push({
      playerId,
      deckCount: zones.deck.length,
      handCount: zones.hand.length,
      discardCount: zones.discard.length,
      inPlayCount: zones.inPlay.length,
      victoryCount: zones.victory.length,
      woundCount: countWounds(zones),
    });
  }

  // --- 3. Project City ---
  // why: city projection includes type and keywords for display without
  // exposing the raw villainDeckCardTypes or cardKeywords maps
  const citySpaces: (UICityCard | null)[] = [];
  for (const space of gameState.city) {
    if (space === null) {
      citySpaces.push(null);
    } else {
      // why: spread operator creates a new array to prevent aliasing
      // with G.cardKeywords — UIState must not hold references to G data
      const cardKeywords = gameState.cardKeywords[space];
      citySpaces.push({
        extId: space,
        type: gameState.villainDeckCardTypes[space] ?? 'unknown',
        keywords: cardKeywords !== undefined ? [...cardKeywords] : [],
      });
    }
  }

  // --- 4. Project HQ ---
  // why: HQ slots expose ext_ids for registry display lookup; no
  // engine internals needed
  const hqSlots: (string | null)[] = [];
  for (const slot of gameState.hq) {
    hqSlots.push(slot);
  }

  // --- 5. Project mastermind ---
  // why: tactics projected as counts, not card arrays
  const mastermind = {
    id: gameState.mastermind.id,
    tacticsRemaining: gameState.mastermind.tacticsDeck.length,
    tacticsDefeated: gameState.mastermind.tacticsDefeated.length,
  };

  // --- 6. Project scheme — derive twist count ---
  // why: twist count derived from already-revealed cards in villain
  // deck discard; no new G fields needed
  let twistCount = 0;
  for (const cardId of gameState.villainDeck.discard) {
    if (gameState.villainDeckCardTypes[cardId] === 'scheme-twist') {
      twistCount += 1;
    }
  }
  const scheme = {
    id: gameState.selection.schemeId,
    twistCount,
  };

  // --- 7. Project economy ---
  // why: available amounts computed via engine helpers, not raw
  // subtraction, to stay consistent with move validation logic
  const economy = {
    attack: gameState.turnEconomy.attack,
    recruit: gameState.turnEconomy.recruit,
    availableAttack: getAvailableAttack(gameState.turnEconomy),
    availableRecruit: getAvailableRecruit(gameState.turnEconomy),
  };

  // --- 8. Project log ---
  // why: shallow copy prevents mutation of G.messages through UIState
  const log = [...gameState.messages];

  // --- 9. Project game over ---
  // why: endgame state derived from G counters via evaluateEndgame
  // (pure); scores computed via computeFinalScores (pure). No ctx.gameover
  // access needed.
  let gameOver: UIGameOverState | undefined;
  const endgameResult = evaluateEndgame(gameState);
  if (endgameResult !== null) {
    gameOver = {
      outcome: endgameResult.outcome,
      reason: endgameResult.reason,
      scores: computeFinalScores(gameState),
    };
  }

  return {
    game,
    players,
    city: { spaces: citySpaces },
    hq: { slots: hqSlots },
    mastermind,
    scheme,
    economy,
    log,
    ...(gameOver !== undefined ? { gameOver } : {}),
  };
}
