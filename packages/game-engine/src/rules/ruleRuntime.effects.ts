/**
 * Effect applicator for the Legendary Arena rule execution pipeline.
 *
 * applyRuleEffects applies RuleEffect[] to G deterministically using
 * for...of. Each effect type has a dedicated handler. Unknown effect types
 * push a warning to G.messages — they never throw.
 *
 * No boardgame.io imports. No .reduce(). No throw.
 */

import type { RuleEffect } from './ruleHooks.types.js';
import type { LegendaryGameState } from '../types.js';
import { moveAllCards } from '../moves/zoneOps.js';
import { moveCardFromZone } from '../moves/zoneOps.js';
import { shuffleDeck } from '../setup/shuffle.js';

/**
 * Minimal interface for the context needed by drawCards effect.
 *
 * Narrower than the full boardgame.io Ctx — only requires the
 * deterministic shuffle capability needed for deck reshuffle.
 */
interface EffectContext {
  random: { Shuffle: <T>(deck: T[]) => T[] };
}

/**
 * Applies a queueMessage effect by pushing the message to G.messages.
 *
 * @param gameState - The game state to mutate.
 * @param effect - The queueMessage effect to apply.
 */
function applyQueueMessage(
  gameState: LegendaryGameState,
  effect: { type: 'queueMessage'; message: string },
): void {
  gameState.messages.push(effect.message);
}

/**
 * Applies a modifyCounter effect by adding delta to the named counter.
 *
 * @param gameState - The game state to mutate.
 * @param effect - The modifyCounter effect to apply.
 */
function applyModifyCounter(
  gameState: LegendaryGameState,
  effect: { type: 'modifyCounter'; counter: string; delta: number },
): void {
  gameState.counters[effect.counter] =
    (gameState.counters[effect.counter] ?? 0) + effect.delta;
}

/**
 * Applies a drawCards effect by moving cards from deck to hand.
 *
 * If the deck runs out mid-draw, the discard pile is reshuffled into
 * the deck using shuffleDeck, then drawing continues.
 *
 * @param gameState - The game state to mutate.
 * @param effect - The drawCards effect to apply.
 * @param ctx - Context providing deterministic shuffle.
 */
function applyDrawCards(
  gameState: LegendaryGameState,
  effect: { type: 'drawCards'; playerId: string; count: number },
  ctx: EffectContext,
): void {
  const playerZones = gameState.playerZones[effect.playerId];
  if (!playerZones) {
    gameState.messages.push(
      `Draw effect skipped: player "${effect.playerId}" not found in playerZones.`,
    );
    return;
  }

  let drawn = 0;

  while (drawn < effect.count) {
    if (playerZones.deck.length === 0 && playerZones.discard.length > 0) {
      // why: ctx.random.Shuffle provides deterministic reshuffling seeded
      // by boardgame.io's PRNG, ensuring replay reproducibility.
      const reshuffled = shuffleDeck(playerZones.discard, ctx);
      playerZones.deck = reshuffled;
      playerZones.discard = [];
    }

    if (playerZones.deck.length === 0) {
      break;
    }

    const topCard = playerZones.deck[0]!;
    const moveResult = moveCardFromZone(playerZones.deck, playerZones.hand, topCard);
    playerZones.deck = moveResult.from;
    playerZones.hand = moveResult.to;
    drawn++;
  }
}

/**
 * Applies a discardHand effect by moving all hand cards to discard.
 *
 * @param gameState - The game state to mutate.
 * @param effect - The discardHand effect to apply.
 */
function applyDiscardHand(
  gameState: LegendaryGameState,
  effect: { type: 'discardHand'; playerId: string },
): void {
  const playerZones = gameState.playerZones[effect.playerId];
  if (!playerZones) {
    gameState.messages.push(
      `Discard hand effect skipped: player "${effect.playerId}" not found in playerZones.`,
    );
    return;
  }

  const moveResult = moveAllCards(playerZones.hand, playerZones.discard);
  playerZones.hand = moveResult.from;
  playerZones.discard = moveResult.to;
}

/**
 * Applies an array of RuleEffect descriptions to the game state.
 *
 * Effects are applied in sequence using for...of. Each effect type is
 * handled by a dedicated function. Unknown effect types push a warning
 * to G.messages and continue — they never throw.
 *
 * @param gameState - The game state to mutate.
 * @param ctx - Context providing deterministic shuffle (for drawCards).
 * @param effects - Array of RuleEffect descriptions to apply in order.
 * @returns The mutated game state (same reference as input).
 */
export function applyRuleEffects(
  gameState: LegendaryGameState,
  ctx: unknown,
  effects: RuleEffect[],
): LegendaryGameState {
  for (const effect of effects) {
    if (effect.type === 'queueMessage') {
      applyQueueMessage(gameState, effect);
    } else if (effect.type === 'modifyCounter') {
      applyModifyCounter(gameState, effect);
    } else if (effect.type === 'drawCards') {
      applyDrawCards(gameState, effect, ctx as EffectContext);
    } else if (effect.type === 'discardHand') {
      applyDiscardHand(gameState, effect);
    } else {
      // why: Unknown effect types are handled gracefully rather than thrown.
      // New effect types added in later packets should fail gracefully in
      // older runtime versions rather than crashing the game.
      const unknownType = (effect as { type: string }).type;
      gameState.messages.push(
        `Unknown rule effect type "${unknownType}" was skipped.`,
      );
    }
  }

  return gameState;
}
