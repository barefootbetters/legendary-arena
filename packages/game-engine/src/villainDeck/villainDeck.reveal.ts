/**
 * Villain deck reveal move for the Legendary Arena game engine.
 *
 * revealVillainCard draws the top card from the villain deck, looks up its
 * classification in G.villainDeckCardTypes, emits the appropriate rule
 * triggers via the WP-009B pipeline, applies the resulting effects, and
 * places the card in discard.
 *
 * This move assumes the deck already exists in G. It does not construct
 * or validate deck composition — that is WP-014B's responsibility.
 *
 * No registry imports. No .reduce(). Moves never throw.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState } from '../types.js';
import type { RuleEffect } from '../rules/ruleHooks.types.js';
import { executeRuleHooks } from '../rules/ruleRuntime.execute.js';
import { applyRuleEffects } from '../rules/ruleRuntime.effects.js';
import { DEFAULT_IMPLEMENTATION_MAP } from '../rules/ruleRuntime.impl.js';
import { shuffleDeck } from '../setup/shuffle.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/**
 * Reveals the top card from the villain deck.
 *
 * Pipeline: draw → classify → trigger → apply effects → route to discard.
 *
 * Handles edge cases:
 * - Empty deck + non-empty discard: reshuffles discard into deck first.
 * - Empty deck + empty discard: logs a message and returns.
 * - Missing card type: fail-closed — logs a message, card stays in deck.
 *
 * @param context - boardgame.io move context with G, ctx, random, playerID.
 */
export function revealVillainCard({ G, ctx, ...context }: MoveContext): void {
  const deck = G.villainDeck.deck;
  const discard = G.villainDeck.discard;

  // Step 1: Handle empty deck
  if (deck.length === 0 && discard.length === 0) {
    G.messages.push(
      'Villain deck reveal skipped: both deck and discard are empty.',
    );
    return;
  }

  if (deck.length === 0 && discard.length > 0) {
    // why: reshuffling empty deck from discard is standard Legendary behaviour.
    // When the villain deck runs out, the discard pile is shuffled to form a
    // new deck. This ensures the game can continue as long as cards exist.
    const reshuffled = shuffleDeck([...discard], { random: context.random });
    G.villainDeck.deck = reshuffled;
    G.villainDeck.discard = [];
  }

  // Step 2: Draw the top card (top-of-deck = deck[0], locked convention)
  const cardId = G.villainDeck.deck[0];

  if (!cardId) {
    G.messages.push(
      'Villain deck reveal skipped: deck is empty after reshuffle attempt.',
    );
    return;
  }

  // Step 3: Look up classification — fail-closed if missing
  const cardType = G.villainDeckCardTypes[cardId];

  if (!cardType) {
    G.messages.push(
      `Villain deck reveal failed: card "${cardId}" has no entry in villainDeckCardTypes. No removal or trigger occurred.`,
    );
    return;
  }

  // Step 4: Remove card from deck (new array assignment, not in-place mutation)
  G.villainDeck.deck = G.villainDeck.deck.slice(1);

  // Step 5: Collect rule effects via the WP-009B pipeline
  const allEffects: RuleEffect[] = [];

  // Always emit onCardRevealed
  const cardRevealedEffects = executeRuleHooks(
    G,
    ctx,
    'onCardRevealed',
    { cardId, cardTypeSlug: cardType },
    G.hookRegistry,
    DEFAULT_IMPLEMENTATION_MAP,
  );

  for (const effect of cardRevealedEffects) {
    allEffects.push(effect);
  }

  // Conditionally emit type-specific triggers
  if (cardType === 'scheme-twist') {
    const schemeTwistEffects = executeRuleHooks(
      G,
      ctx,
      'onSchemeTwistRevealed',
      { cardId },
      G.hookRegistry,
      DEFAULT_IMPLEMENTATION_MAP,
    );

    for (const effect of schemeTwistEffects) {
      allEffects.push(effect);
    }
  }

  if (cardType === 'mastermind-strike') {
    const mastermindStrikeEffects = executeRuleHooks(
      G,
      ctx,
      'onMastermindStrikeRevealed',
      { cardId },
      G.hookRegistry,
      DEFAULT_IMPLEMENTATION_MAP,
    );

    for (const effect of mastermindStrikeEffects) {
      allEffects.push(effect);
    }
  }

  // Step 6: Apply all collected effects
  applyRuleEffects(G, ctx, allEffects);

  // Step 7: Route card to discard
  // why: WP-015 will modify routing for villain and henchman cards to the City.
  // Until then, all revealed cards go to discard regardless of type.
  G.villainDeck.discard = [...G.villainDeck.discard, cardId];
}
