/**
 * Audience-based filter for UIState projections.
 *
 * filterUIStateForAudience is a pure post-processing function that takes
 * the authoritative UIState (from buildUIState) and produces an
 * audience-appropriate view by redacting or replacing fields.
 *
 * One UIState, filtered views — no alternate game states.
 * Implements D-0302 (Single UIState, Multiple Audiences).
 *
 * No boardgame.io imports. No registry imports. No LegendaryGameState.
 * No .reduce(). No mutation of input. No I/O.
 */

import type {
  UIState,
  UIPlayerState,
  UITurnEconomyState,
  UICityCard,
  UIHQCard,
} from './uiState.types.js';
import type { UIAudience } from './uiAudience.types.js';

// why: non-active players and spectators must not see the active player's
// remaining resources (attack/recruit). Zeroed economy prevents strategic
// information leakage while maintaining type stability.
const REDACTED_ECONOMY: UITurnEconomyState = {
  attack: 0,
  recruit: 0,
  availableAttack: 0,
  availableRecruit: 0,
};

/**
 * Builds a per-element shallow-copy of City spaces, including the
 * additive `display` payload, to prevent aliasing with the input
 * UIState. Public information — not redacted.
 */
// why: WP-111 — City display is public; shallow copies at every level
// prevent aliasing with the input UIState's card objects. Mirrors the
// WP-028 cardKeywords post-mortem aliasing-prevention precedent.
function deepCopyCitySpaces(
  spaces: (UICityCard | null)[],
): (UICityCard | null)[] {
  const result: (UICityCard | null)[] = [];
  for (const space of spaces) {
    if (space === null) {
      result.push(null);
    } else {
      result.push({
        extId: space.extId,
        type: space.type,
        keywords: [...space.keywords],
        display: { ...space.display },
      });
    }
  }
  return result;
}

/**
 * Builds a per-element shallow-copy of HQ slotDisplay entries to
 * prevent aliasing with the input UIState. Public information — not
 * redacted.
 */
// why: WP-111 — HQ slotDisplay is public; per-entry shallow copies at
// the filter boundary mirror the projection-time aliasing-prevention
// pattern (WP-028 cardKeywords post-mortem precedent).
function deepCopyHqSlotDisplay(
  slotDisplay: (UIHQCard | null)[],
): (UIHQCard | null)[] {
  const result: (UIHQCard | null)[] = [];
  for (const entry of slotDisplay) {
    if (entry === null) {
      result.push(null);
    } else {
      result.push({
        extId: entry.extId,
        display: { ...entry.display },
      });
    }
  }
  return result;
}

/**
 * Builds a redacted copy of a UIPlayerState with hand cards removed.
 *
 * @param player - The source player state. Not mutated.
 * @returns A new UIPlayerState with handCards set to undefined.
 */
function redactHandCards(player: UIPlayerState): UIPlayerState {
  return {
    playerId: player.playerId,
    deckCount: player.deckCount,
    handCount: player.handCount,
    discardCount: player.discardCount,
    inPlayCount: player.inPlayCount,
    victoryCount: player.victoryCount,
    woundCount: player.woundCount,
    // why: hand card ext_ids redacted — this player's hand contents are
    // hidden from the viewing audience. Only handCount remains visible.
    // why: WP-111 / EC-118 — handDisplay omitted alongside handCards
    // (privacy symmetry). Leaking display data is identical to leaking
    // the CardExtId for opponent privacy purposes. Conditional
    // assignment is moot here because we simply do not assign the
    // field at all (mirrors the existing handCards omission pattern).
  };
}

/**
 * Builds a copy of a UIPlayerState preserving hand cards.
 *
 * @param player - The source player state. Not mutated.
 * @returns A new UIPlayerState with handCards preserved.
 */
function preserveHandCards(player: UIPlayerState): UIPlayerState {
  const base: UIPlayerState = {
    playerId: player.playerId,
    deckCount: player.deckCount,
    handCount: player.handCount,
    discardCount: player.discardCount,
    inPlayCount: player.inPlayCount,
    victoryCount: player.victoryCount,
    woundCount: player.woundCount,
  };

  // why: active player sees own hand card ext_ids for gameplay.
  // Spread copy prevents aliasing with input UIState.
  if (player.handCards !== undefined) {
    base.handCards = [...player.handCards];
  }

  // why: WP-111 / EC-118 — conditional assignment per WP-029 D-2902
  // exactOptionalPropertyTypes precedent (do NOT assign undefined
  // literally; do NOT use inline ternary that returns T[] | undefined).
  // Per-entry shallow copy of each UICardDisplay prevents aliasing with
  // the input UIState's display objects (same WP-028 cardKeywords
  // post-mortem precedent applied at the filter boundary).
  if (player.handDisplay !== undefined) {
    const copiedHandDisplay = [];
    for (const display of player.handDisplay) {
      copiedHandDisplay.push({ ...display });
    }
    base.handDisplay = copiedHandDisplay;
  }

  return base;
}

/**
 * Filters a UIState for a specific audience.
 *
 * Pure function: no I/O, no mutation of input UIState, no side effects.
 * Same inputs always produce the same output.
 *
 * One UIState, filtered views — no alternate game states.
 * Implements D-0302 (Single UIState, Multiple Audiences).
 *
 * Forbidden behaviors (do not add later):
 * - mutation of the input uiState
 * - accessing G, ctx, or any engine internals
 * - caching or memoization
 * - any form of side effect
 *
 * @param uiState - The authoritative UIState from buildUIState. Not mutated.
 * @param audience - Who is viewing: player (with playerId) or spectator.
 * @returns A new UIState with audience-appropriate visibility.
 */
export function filterUIStateForAudience(
  uiState: UIState,
  audience: UIAudience,
): UIState {
  // --- 1. Filter players based on audience ---
  const filteredPlayers: UIPlayerState[] = [];

  if (audience.kind === 'player') {
    for (const player of uiState.players) {
      if (player.playerId === audience.playerId) {
        // why: viewing player sees own hand card ext_ids
        filteredPlayers.push(preserveHandCards(player));
      } else {
        // why: other players' hand contents are hidden — count only
        filteredPlayers.push(redactHandCards(player));
      }
    }
  } else {
    // why: spectators see hand counts only — no hand card ext_ids for any player
    for (const player of uiState.players) {
      filteredPlayers.push(redactHandCards(player));
    }
  }

  // --- 2. Determine economy visibility ---
  let economy: UITurnEconomyState;

  if (audience.kind === 'player' && audience.playerId === uiState.game.activePlayerId) {
    // why: only the active player sees their own economy
    economy = {
      attack: uiState.economy.attack,
      recruit: uiState.economy.recruit,
      availableAttack: uiState.economy.availableAttack,
      availableRecruit: uiState.economy.availableRecruit,
    };
  } else {
    // why: non-active players and spectators do not see economy details
    economy = { ...REDACTED_ECONOMY };
  }

  // --- 3. Build new UIState with all fields copied (no references to input) ---
  // why: deck contents/order are already hidden by buildUIState (WP-028) —
  // decks are projected as counts only, never as card arrays. The filter
  // does not need to redact deck data because it was never included.
  // why: WP-111 — City `display`, HQ `slotDisplay`, and Mastermind
  // `display` are public information and pass through. Per-entry
  // shallow copies (via deepCopyCitySpaces / deepCopyHqSlotDisplay)
  // prevent aliasing with the input UIState's card display objects.
  // Mastermind is shallow-copied with a nested {...display} to copy
  // the display payload alongside id / tacticsRemaining / tacticsDefeated.
  const result: UIState = {
    game: { ...uiState.game },
    players: filteredPlayers,
    city: { spaces: deepCopyCitySpaces(uiState.city.spaces) },
    hq: {
      slots: [...uiState.hq.slots],
      ...(uiState.hq.slotDisplay !== undefined
        ? { slotDisplay: deepCopyHqSlotDisplay(uiState.hq.slotDisplay) }
        : {}),
    },
    mastermind: {
      ...uiState.mastermind,
      display: { ...uiState.mastermind.display },
    },
    scheme: { ...uiState.scheme },
    economy,
    log: [...uiState.log],
    // why: progress counters are public (no redaction needed) — passed through
    // unchanged via fresh object copy to avoid aliasing with the input UIState.
    // Forced cascade from WP-067 making `progress` a required UIState field.
    progress: { ...uiState.progress },
  };

  if (uiState.gameOver !== undefined) {
    result.gameOver = { ...uiState.gameOver };
  }

  return result;
}
