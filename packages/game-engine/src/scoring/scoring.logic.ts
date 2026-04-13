/**
 * VP scoring logic for the Legendary Arena game engine.
 *
 * computeFinalScores is a pure function that reads G and returns a
 * per-player VP breakdown. It does not mutate G, does not trigger
 * endgame, and performs no I/O. Scoring is a derived view, not game
 * state — results are never stored in G during MVP.
 *
 * No boardgame.io imports. No .reduce() with branching. No registry
 * access. No G.cardStats reads.
 */

import type { LegendaryGameState } from '../types.js';
import type { FinalScoreSummary, PlayerScoreBreakdown } from './scoring.types.js';
import {
  VP_VILLAIN,
  VP_HENCHMAN,
  VP_BYSTANDER,
  VP_TACTIC,
  VP_WOUND,
} from './scoring.types.js';
import { WOUND_EXT_ID, BYSTANDER_EXT_ID } from '../setup/buildInitialGameState.js';

/**
 * Computes final VP scores for all players.
 *
 * Pure function — reads G, returns FinalScoreSummary, never mutates.
 * Called after endIf triggers. Does not participate in the endgame
 * decision (WP-010 owns that).
 *
 * @param gameState - The final LegendaryGameState after the game ends.
 * @returns FinalScoreSummary with per-player breakdowns and winner.
 */
export function computeFinalScores(
  gameState: LegendaryGameState,
): FinalScoreSummary {
  // why: sorted keys ensure deterministic ordering of
  // FinalScoreSummary.players array, preventing flaky snapshot tests
  // and inconsistent JSON comparisons
  const playerIds = Object.keys(gameState.playerZones).sort();

  // why: MVP awards tactic VP to every player because WP-019 does not
  // track which player defeated each tactic. Per-player attribution is
  // a future packet.
  const tacticVP = gameState.mastermind.tacticsDefeated.length * VP_TACTIC;

  const players: PlayerScoreBreakdown[] = [];

  for (const playerId of playerIds) {
    const zones = gameState.playerZones[playerId];
    if (!zones) continue;

    // --- Victory pile classification ---
    let villainCount = 0;
    let henchmanCount = 0;
    let bystanderCount = 0;

    for (const cardId of zones.victory) {
      const cardType = gameState.villainDeckCardTypes[cardId];

      if (cardType === 'villain') {
        villainCount++;
      } else if (cardType === 'henchman') {
        henchmanCount++;
      } else if (cardType === 'bystander' || cardId === BYSTANDER_EXT_ID) {
        // why: bystanders in victory come from two sources — villain-deck
        // bystanders (tracked in G.villainDeckCardTypes) and rescued
        // supply-pile bystanders (using BYSTANDER_EXT_ID from WP-017).
        // Both contribute VP.
        bystanderCount++;
      }
      // why: cards not in G.villainDeckCardTypes (undefined) or classified
      // as scheme-twist / mastermind-strike contribute 0 VP in MVP.
      // Heroes, starting cards, and other non-deck cards score 0.
    }

    // --- Wound count across all non-victory zones ---
    let woundCount = 0;

    for (const cardId of zones.deck) {
      if (cardId === WOUND_EXT_ID) {
        woundCount++;
      }
    }

    for (const cardId of zones.hand) {
      if (cardId === WOUND_EXT_ID) {
        woundCount++;
      }
    }

    for (const cardId of zones.discard) {
      if (cardId === WOUND_EXT_ID) {
        woundCount++;
      }
    }

    for (const cardId of zones.inPlay) {
      if (cardId === WOUND_EXT_ID) {
        woundCount++;
      }
    }

    // --- Build breakdown ---
    const villainVP = villainCount * VP_VILLAIN;
    const henchmanVP = henchmanCount * VP_HENCHMAN;
    const bystanderVP = bystanderCount * VP_BYSTANDER;
    // why: 0 * -1 produces -0 in JavaScript; coerce to +0 for clean
    // JSON serialization and strict equality comparisons
    const woundVP = woundCount === 0 ? 0 : woundCount * VP_WOUND;
    const totalVP = villainVP + henchmanVP + bystanderVP + tacticVP + woundVP;

    players.push({
      playerId,
      villainVP,
      henchmanVP,
      bystanderVP,
      tacticVP,
      woundVP,
      totalVP,
    });
  }

  // --- Determine winner ---
  const winner = determineWinner(players);

  return { players, winner };
}

/**
 * Determines the winner from player score breakdowns.
 *
 * Returns the playerId with the highest totalVP, or null if two or
 * more players are tied for the highest score.
 *
 * @param players - Array of PlayerScoreBreakdown entries.
 * @returns The winning playerId, or null on tie.
 */
function determineWinner(players: PlayerScoreBreakdown[]): string | null {
  if (players.length === 0) {
    return null;
  }

  let maxVP = -Infinity;
  for (const player of players) {
    if (player.totalVP > maxVP) {
      maxVP = player.totalVP;
    }
  }

  const topPlayers: string[] = [];
  for (const player of players) {
    if (player.totalVP === maxVP) {
      topPlayers.push(player.playerId);
    }
  }

  // why: no tiebreaker in MVP — ties produce null
  if (topPlayers.length === 1) {
    return topPlayers[0]!;
  }

  return null;
}
