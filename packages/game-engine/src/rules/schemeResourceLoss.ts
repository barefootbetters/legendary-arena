/**
 * Scheme resource-loss evaluation for the Legendary Arena game engine.
 *
 * Some schemes' printed "Evil Wins" condition is a resource threshold, not a
 * twist count (D-24315). This module counts cards of a given type in the
 * Escaped Villains pile (`G.escapedPile`) and sets the SCHEME_LOSS endgame
 * counter when the active scheme's configured threshold is reached.
 *
 * Pure and side-effect-limited: it mutates only `G.counters` and appends to the
 * game log. No boardgame.io import. No registry import. No `.reduce()`.
 */

import type { LegendaryGameState } from '../types.js';
import type { RevealedCardType } from '../villainDeck/villainDeck.types.js';
import { ENDGAME_CONDITIONS } from '../endgame/endgame.types.js';
import { BYSTANDER_EXT_ID } from '../setup/pilesInit.js';
import { SCHEME_TWIST_CONFIGS } from './schemeTwistConfigs.js';
import { pushLog } from '../log/logPush.js';

/**
 * Resolves the card type of one Escaped Villains pile entry.
 *
 * `G.villainDeckCardTypes` classifies every card built into the villain deck
 * (villains, henchmen, villain-deck bystanders, scheme twists, master strikes).
 * Bystanders captured from the shared supply via card/twist effects carry the
 * generic `BYSTANDER_EXT_ID` (`'pile-bystander'`) and are NOT in that map, so
 * they are resolved explicitly to `'bystander'` here — otherwise a scheme like
 * Midtown Bank Robbery (whose twist captures supply bystanders) would
 * undercount the bystanders carried off by escaping villains.
 *
 * @param gameState - The current game state (read-only).
 * @param escapedCardId - An ext_id present in `G.escapedPile`.
 * @returns The resolved card type, or undefined if unclassifiable.
 */
function resolveEscapedPileEntryType(
  gameState: LegendaryGameState,
  escapedCardId: string,
): RevealedCardType | undefined {
  const villainDeckType = gameState.villainDeckCardTypes[escapedCardId];
  if (villainDeckType !== undefined) {
    return villainDeckType;
  }
  // why: supply bystanders (BYSTANDER_EXT_ID) are not villain-deck cards, so
  // they carry no villainDeckCardTypes entry; classify them as 'bystander'.
  if (escapedCardId === BYSTANDER_EXT_ID) {
    return 'bystander';
  }
  return undefined;
}

/**
 * Counts entries in the Escaped Villains pile whose card type matches.
 *
 * Uses an explicit `for...of` loop (no `.reduce()`), classifying each entry
 * via resolveEscapedPileEntryType so supply bystanders are counted too.
 *
 * @param gameState - The current game state (read-only).
 * @param cardType - The RevealedCardType to count.
 * @returns The number of matching entries in `G.escapedPile`.
 */
export function countEscapedPileByType(
  gameState: LegendaryGameState,
  cardType: RevealedCardType,
): number {
  let matchCount = 0;
  for (const escapedCardId of gameState.escapedPile) {
    if (resolveEscapedPileEntryType(gameState, escapedCardId) === cardType) {
      matchCount = matchCount + 1;
    }
  }
  return matchCount;
}

/**
 * Applies the active scheme's escaped-pile resource-loss condition, if any.
 *
 * If the active scheme declares an `'escaped-pile-count'` resourceLossCondition
 * and the escaped pile holds at least `threshold` entries of the configured
 * card type, sets the SCHEME_LOSS counter to 1 (idempotent) and logs once. A
 * no-op for schemes without a resourceLossCondition, or when already lost.
 * Never throws.
 *
 * @param gameState - The game state to mutate (counters + log only).
 */
export function applyEscapedPileResourceLoss(
  gameState: LegendaryGameState,
): void {
  const config = SCHEME_TWIST_CONFIGS.get(gameState.selection.schemeId);
  const condition = config?.resourceLossCondition;
  if (!condition || condition.kind !== 'escaped-pile-count') {
    return;
  }

  // why: idempotent — once the scheme loss is latched, do not re-count or
  // re-log. evaluateEndgame treats SCHEME_LOSS >= 1 as the loss, so a single
  // set to 1 is sufficient and repeated escapes must not stack the counter.
  if ((gameState.counters[ENDGAME_CONDITIONS.SCHEME_LOSS] ?? 0) >= 1) {
    return;
  }

  const matchCount = countEscapedPileByType(gameState, condition.cardType);
  if (matchCount >= condition.threshold) {
    // why: SCHEME_LOSS is set HERE, in the escape path, rather than derived
    // inside evaluateEndgame, because evaluateEndgame reads only G.counters
    // (the counter-only invariant). The escape path is the only place
    // G.escapedPile grows, so it is the correct place to evaluate the count.
    gameState.counters[ENDGAME_CONDITIONS.SCHEME_LOSS] = 1;
    pushLog(
      gameState,
      `Scheme loss triggered — ${matchCount} ${condition.cardType} card(s) carried away by escaping villains (threshold ${condition.threshold}).`,
    );
  }
}
