/**
 * VP scoring logic for the Legendary Arena game engine.
 *
 * computeFinalScores is a pure function that reads G and returns a
 * per-player VP breakdown. It does not mutate G, does not trigger
 * endgame, and performs no I/O. Scoring is a derived view, not game
 * state — results are never stored in G during MVP.
 *
 * No boardgame.io imports. No .reduce() with branching. No registry
 * access. Reads the G.cardVictoryPoints setup snapshot for printed VP
 * (D-24157); still reads no G.cardStats.
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
import { computeDynamicVillainVictoryPoints } from './dynamicVictoryPoints.js';

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

  // why: each defeated Mastermind tactic scores for the SPECIFIC player who
  // defeated it, NOT for every player. `fightMastermind` pushes the defeated
  // tactic into that player's victory pile AND records its id in
  // `mastermind.tacticsDefeated`, so a victory-pile card whose id is in
  // `tacticsDefeated` is a tactic THIS player earned. This corrects the earlier
  // MVP shortcut that awarded every tactic's VP to every player (WP-019 pre-dated
  // per-player victory piles, so it could not attribute a tactic to its defeater);
  // per-player attribution is load-bearing for competitive scoring — a global
  // count credits every seat for tactics a co-player (or a bot ally) defeated and
  // can flip the higher-VP winner. Per-player counting happens inside the
  // victory-pile loop below. See DECISIONS.md D-24176.
  // why: D-24157 — each defeated tactic scores the mastermind's PRINTED vp (read
  // from the G.cardVictoryPoints setup snapshot by the mastermind's baseCardId),
  // falling back to VP_TACTIC only when the mastermind has no printed vp (e.g. a
  // null-vp mastermind). Magneto (vp 5) matches the old flat value; other
  // masterminds no longer misreport.
  const mastermindPrintedVp =
    gameState.cardVictoryPoints?.[gameState.mastermind.baseCardId] ?? VP_TACTIC;

  const players: PlayerScoreBreakdown[] = [];

  for (const playerId of playerIds) {
    const zones = gameState.playerZones[playerId];
    if (!zones) continue;

    // --- Victory pile scoring (printed VP per card; D-24157) ---
    // why: D-24157 — villains and henchmen score their PRINTED vp from the
    // G.cardVictoryPoints setup snapshot, falling back to the flat category
    // constant only when a card carries no printed vp (a null-vp card must never
    // score 0). Bystanders stay a flat count (1 VP each by rule; supply cards
    // carry no per-card vp).
    let villainVP = 0;
    let henchmanVP = 0;
    let bystanderCount = 0;
    let tacticCount = 0;

    for (const cardId of zones.victory) {
      const cardType = gameState.villainDeckCardTypes[cardId];

      if (cardType === 'villain') {
        // why: a card-text dynamic-VP resolver overrides the printed-VP/fallback
        // path for known modifier villains (Supreme HYDRA, D-24355); it returns
        // null for ordinary villains, which then take the printed vp or VP_VILLAIN
        // fallback. Folded into villainVP — it is villain VP — so no
        // PlayerScoreBreakdown field or breakdown-type change is needed.
        const dynamicVp = computeDynamicVillainVictoryPoints(cardId, zones.victory);
        villainVP += dynamicVp ?? (gameState.cardVictoryPoints?.[cardId] ?? VP_VILLAIN);
      } else if (cardType === 'henchman') {
        henchmanVP += gameState.cardVictoryPoints?.[cardId] ?? VP_HENCHMAN;
      } else if (cardType === 'bystander' || cardId === BYSTANDER_EXT_ID) {
        // why: bystanders in victory come from two sources — villain-deck
        // bystanders (tracked in G.villainDeckCardTypes) and rescued
        // supply-pile bystanders (using BYSTANDER_EXT_ID from WP-017).
        // Both contribute a flat VP_BYSTANDER.
        bystanderCount++;
      } else if (gameState.mastermind.tacticsDefeated.includes(cardId)) {
        // why: a victory-pile card whose id is in mastermind.tacticsDefeated is a
        // Mastermind tactic THIS player defeated (fightMastermind pushes it to the
        // defeater's victory pile). Count it per-player so only the defeater scores
        // it — not every seat (D-24176). Tactics carry no villainDeckCardTypes
        // entry, so they reach this branch (they are not villain/henchman/bystander).
        tacticCount++;
      }
      // why: cards not in G.villainDeckCardTypes (undefined) and not a defeated
      // tactic — scheme-twist / mastermind-strike / heroes / starting cards —
      // contribute 0 VP.
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
    // why: D-24157 — villainVP / henchmanVP are accumulated per-card in the
    // victory-pile loop above (printed vp with a flat fallback); only bystanderVP
    // stays a flat count × VP_BYSTANDER here.
    const bystanderVP = bystanderCount * VP_BYSTANDER;
    // why: per-player tactic VP — this player's own defeated tactics (counted from
    // their victory pile above) × the mastermind's printed vp (D-24157). Zero for a
    // player who defeated no tactics (D-24176).
    const tacticVP = tacticCount * mastermindPrintedVp;
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
