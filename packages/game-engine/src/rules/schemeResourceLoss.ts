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

import type { LegendaryGameState, ConvertedVillainOrigin } from '../types.js';
import type { RevealedCardType } from '../villainDeck/villainDeck.types.js';
import type {
  SchemeLossPile,
  SchemeResourceLossCondition,
} from './schemeTwistConfig.types.js';
import { ENDGAME_CONDITIONS } from '../endgame/endgame.types.js';
import { BYSTANDER_EXT_ID } from '../setup/pilesInit.js';
import { SCHEME_TWIST_CONFIGS } from './schemeTwistConfigs.js';
import { pushLog } from '../log/logPush.js';

/** The `pile-depleted` members of the resource-loss condition union. */
export type PileDepletedCondition = Extract<
  SchemeResourceLossCondition,
  { kind: 'pile-depleted' }
>;

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
 * Counts entries in the Escaped Villains pile whose card type is one of `cardTypes`.
 *
 * Uses an explicit `for...of` loop (no `.reduce()`), classifying each entry
 * via resolveEscapedPileEntryType so supply bystanders are counted too.
 *
 * @param gameState - The current game state (read-only).
 * @param cardTypes - The RevealedCardTypes to count.
 * @returns The number of matching entries in `G.escapedPile`.
 */
export function countEscapedPileByType(
  gameState: LegendaryGameState,
  cardTypes: readonly RevealedCardType[],
): number {
  let matchCount = 0;
  for (const escapedCardId of gameState.escapedPile) {
    const entryType = resolveEscapedPileEntryType(gameState, escapedCardId);
    if (entryType !== undefined && cardTypes.includes(entryType)) {
      matchCount = matchCount + 1;
    }
  }
  return matchCount;
}

/**
 * Counts entries in the Escaped Villains pile carrying a converted-villain origin.
 *
 * Reads `G.convertedVillainOrigins` (absent for non-converting schemes → 0). Uses
 * an explicit `for...of` loop (no `.reduce()`). This counts converted cards (e.g.
 * Killbots) DISTINCTLY from real villains — a converted card is typed `'villain'`
 * for routing, so `countEscapedPileByType(gs, ['villain'])` would wrongly include it.
 *
 * @param gameState - The current game state (read-only).
 * @param origin - The converted origin to count (e.g. 'killbot').
 * @returns The number of matching entries in `G.escapedPile`.
 */
export function countEscapedByConvertedOrigin(
  gameState: LegendaryGameState,
  origin: ConvertedVillainOrigin,
): number {
  const origins = gameState.convertedVillainOrigins ?? {};
  let matchCount = 0;
  for (const escapedCardId of gameState.escapedPile) {
    if (origins[escapedCardId] === origin) {
      matchCount = matchCount + 1;
    }
  }
  return matchCount;
}

/**
 * Applies the active scheme's escaped-pile resource-loss condition, if any.
 *
 * Handles both escape-pile loss kinds — `'escaped-pile-count'` (by card type,
 * D-24315) and `'escaped-converted-count'` (by converted origin, D-24325) — and
 * sets the SCHEME_LOSS counter to 1 (idempotent) + logs once when the escaped
 * pile holds at least `threshold` matching entries. A no-op for schemes without a
 * matching resourceLossCondition (including `'pile-depleted'`, handled by
 * applyPileDepletionResourceLoss), or when already lost. Never throws.
 *
 * @param gameState - The game state to mutate (counters + log only).
 */
export function applyEscapedPileResourceLoss(
  gameState: LegendaryGameState,
): void {
  const config = SCHEME_TWIST_CONFIGS.get(gameState.selection.schemeId);
  const condition = config?.resourceLossCondition;
  if (
    !condition ||
    (condition.kind !== 'escaped-pile-count' &&
      condition.kind !== 'escaped-converted-count')
  ) {
    return;
  }

  // why: idempotent — once the scheme loss is latched, do not re-count or
  // re-log. evaluateEndgame treats SCHEME_LOSS >= 1 as the loss, so a single
  // set to 1 is sufficient and repeated escapes must not stack the counter.
  if ((gameState.counters[ENDGAME_CONDITIONS.SCHEME_LOSS] ?? 0) >= 1) {
    return;
  }

  // why: both kinds count the escaped pile — by card type, or by converted
  // origin (Killbots: converted cards are typed 'villain' for routing, so they
  // must be counted by origin, not by the shared 'villain' type).
  const matchCount =
    condition.kind === 'escaped-pile-count'
      ? countEscapedPileByType(gameState, condition.cardTypes)
      : countEscapedByConvertedOrigin(gameState, condition.origin);
  const matchLabel =
    condition.kind === 'escaped-pile-count'
      ? condition.cardTypes.join('/')
      : condition.origin;

  if (matchCount >= condition.threshold) {
    // why: SCHEME_LOSS is set HERE, in the escape path, rather than derived
    // inside evaluateEndgame, because evaluateEndgame reads only G.counters
    // (the counter-only invariant). The escape path is the only place
    // G.escapedPile grows, so it is the correct place to evaluate the count.
    gameState.counters[ENDGAME_CONDITIONS.SCHEME_LOSS] = 1;
    pushLog(
      gameState,
      `Scheme loss triggered — ${matchCount} ${matchLabel} card(s) carried away by escaping villains (threshold ${condition.threshold}).`,
    );
  }
}

/**
 * Lists the piles a `pile-depleted` condition names, in declaration order.
 *
 * why (D-24595): the condition is an exclusive union — a single `pile` (every
 * core entry) or a `piles` list ("the Hero Deck or Villain Deck runs out"). This
 * one normaliser is shared by the loss rule, the setup capture and the meter, so
 * no caller re-decides which form it is looking at.
 *
 * @param condition - A `pile-depleted` resource-loss condition.
 * @returns The named piles (one entry for the single-pile form).
 */
export function listConditionPiles(
  condition: PileDepletedCondition,
): readonly SchemeLossPile[] {
  if (condition.piles !== undefined) {
    return condition.piles;
  }
  return [condition.pile];
}

/**
 * Returns the number of cards remaining in a named depletion-loss pile.
 *
 * Maps a `pile-depleted` condition's pile name to the length of the
 * corresponding zone in `G`. `'heroDeck'` → `G.heroDeck` (Super Hero Civil War,
 * WP-510); `'wounds'` → `G.piles.wounds` (Legacy Virus, WP-511);
 * `'villainDeck'` → `G.villainDeck.deck` (WP-763 / D-24595).
 *
 * Exported so `schemeLossProgress.ts` reads the SAME pile mapping the loss
 * itself turns on (WP-562). A second mapping there would be free to drift from
 * this one, which is exactly the class of defect that module exists to prevent.
 *
 * @param gameState - The current game state (read-only).
 * @param pile - The pile name from the resourceLossCondition.
 * @returns The remaining card count in that pile.
 */
export function remainingPileCount(
  gameState: LegendaryGameState,
  pile: SchemeLossPile,
): number {
  // why: an explicit switch (not dynamic G[pile] indexing) so each supported
  // pile maps to its real zone location — the hero deck lives at G.heroDeck,
  // the wound stack under G.piles.wounds, the Villain Deck under
  // G.villainDeck.deck.
  switch (pile) {
    case 'heroDeck':
      return gameState.heroDeck.length;
    case 'wounds':
      return gameState.piles.wounds.length;
    case 'villainDeck':
      return gameState.villainDeck.deck.length;
  }
}

/**
 * Applies the active scheme's pile-depletion resource-loss condition, if any.
 *
 * If the active scheme declares a `'pile-depleted'` resourceLossCondition and
 * ANY named pile is empty (`remainingPileCount === 0`), sets the SCHEME_LOSS
 * counter to 1 (idempotent) and logs once. A no-op for schemes without a
 * `'pile-depleted'` condition, or when already lost. Never throws.
 *
 * @param gameState - The game state to mutate (counters + log only).
 */
export function applyPileDepletionResourceLoss(
  gameState: LegendaryGameState,
): void {
  const config = SCHEME_TWIST_CONFIGS.get(gameState.selection.schemeId);
  const condition = config?.resourceLossCondition;
  if (!condition || condition.kind !== 'pile-depleted') {
    return;
  }

  // why: idempotent — once the scheme loss is latched, do not re-check or
  // re-log. evaluateEndgame treats SCHEME_LOSS >= 1 as the loss, so a single
  // set to 1 is sufficient.
  if ((gameState.counters[ENDGAME_CONDITIONS.SCHEME_LOSS] ?? 0) >= 1) {
    return;
  }

  for (const pile of listConditionPiles(condition)) {
    if (remainingPileCount(gameState, pile) === 0) {
      // why: SCHEME_LOSS is set HERE (called from the play-phase turn.onMove
      // hook, a central per-move chokepoint) rather than at the recruitHero
      // refill, because the named pile can be drained by paths other than a
      // recruit — Super Hero Civil War's ko-from-hq twist forces HQ refills that
      // drain G.heroDeck outside any recruit move, and the Villain Deck drains on
      // every reveal. evaluateEndgame stays counter-only; the depletion decision
      // lives here at the check site. Because onMove runs the final-turn latch
      // first and evaluateEndgame checks SCHEME_LOSS before the deck-out tie
      // (D-24319), a Villain Deck runout on a scheme that names it is a loss,
      // not a tie.
      gameState.counters[ENDGAME_CONDITIONS.SCHEME_LOSS] = 1;
      pushLog(
        gameState,
        `Scheme loss triggered — the ${pileDisplayName(pile)} has run out.`,
      );
      return;
    }
  }
}

/**
 * Reports whether the active scheme's Evil Wins includes a named pile running out.
 *
 * @param gameState - The current game state (read-only).
 * @param pile - The pile to ask about.
 * @returns True when the scheme's `pile-depleted` condition names that pile.
 */
export function isSchemeLossPile(
  gameState: LegendaryGameState,
  pile: SchemeLossPile,
): boolean {
  const config = SCHEME_TWIST_CONFIGS.get(gameState.selection.schemeId);
  const condition = config?.resourceLossCondition;
  if (!condition || condition.kind !== 'pile-depleted') {
    return false;
  }
  return listConditionPiles(condition).includes(pile);
}

/**
 * Names a depletion pile the way the printed rules do, for the game log.
 *
 * @param pile - The depletion pile.
 * @returns The rulebook name ("Villain Deck", "Hero Deck", "Wound Stack").
 */
function pileDisplayName(pile: SchemeLossPile): string {
  // why (D-24599): the loss line printed the internal key ("the villainDeck pile
  // has run out"). An exhaustive switch, so a new pile fails to compile here
  // rather than leaking its identifier into the player's log.
  switch (pile) {
    case 'heroDeck':
      return 'Hero Deck';
    case 'wounds':
      return 'Wound Stack';
    case 'villainDeck':
      return 'Villain Deck';
  }
}
