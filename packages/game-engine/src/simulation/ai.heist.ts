/**
 * The bot's Heist decision for the Legendary Arena simulation (WP-878 / D-24826).
 *
 * Rules v23 p.26-27: once per turn, a player who readied a Heist card MAY attempt a Heist ("You
 * don't have to go on a Heist. Weigh it carefully!"). The bot weighs it with card-count odds, the
 * policy Jeff chose on 2026-11-08: over the cards still in the Villain Deck taken as a set, it
 * attempts only when more of them would lose to its Heist Count than would beat it. It never reads
 * the top card or the deck's order.
 *
 * getLegalMoves step 4c calls shouldBotAttemptHeist, so every bot policy (competent, random, server
 * autoplay, bot ally) honors the rule, and every emitted attemptHeist passes isHeistAvailable.
 *
 * Pure: no boardgame.io import, no randomness, no clock, no I/O. Reads G, never mutates it. Never
 * throws.
 */

import type { LegendaryGameState } from '../types.js';
import { heistCount, heistRevealedVictoryPoints, isHeistAvailable } from '../moves/attemptHeist.js';
import { getHooksForCard } from '../rules/heroAbility.types.js';

/** The Heist outcome a card in the Villain Deck would give, tallied over the whole deck. */
export interface HeistOdds {
  /** Cards whose printed VP is lower than the Heist Count (the Heist works). */
  readonly winCount: number;
  /** Cards whose printed VP equals the Heist Count (nothing happens). */
  readonly tieCount: number;
  /** Cards whose printed VP is higher than the Heist Count (the player gains a Wound). */
  readonly loseCount: number;
}

/** The one inner Heist effect the bot answer declines (X-Con Security Van, WP-876 / D-24823). */
const BOT_DECLINED_HEIST_EFFECT_TYPE = 'heist-move-villain-ko-hero';

/**
 * Tallies how the cards still in the Villain Deck would resolve a Heist for the given player.
 *
 * Every card counts once, whatever its position, so the tally is the same for any order of the
 * deck and the top card has no special weight.
 *
 * @param G - The game state to inspect (not mutated).
 * @param playerId - The seat whose Heist Count is compared.
 * @returns The win / tie / lose tally; all zero for an absent or empty Villain Deck.
 */
export function countHeistOdds(G: LegendaryGameState, playerId: string): HeistOdds {
  const count = heistCount(G, playerId);
  let winCount = 0;
  let tieCount = 0;
  let loseCount = 0;
  for (const cardId of G.villainDeck?.deck ?? []) {
    const victoryPoints = heistRevealedVictoryPoints(G, cardId);
    if (count > victoryPoints) {
      winCount += 1;
    } else if (count === victoryPoints) {
      tieCount += 1;
    } else {
      loseCount += 1;
    }
  }
  return { winCount, tieCount, loseCount };
}

/**
 * Whether a won Heist would give the bot anything, given the cards it readied this turn.
 *
 * Walks the readied crew exactly as fireHeistPlays does (crew card, its hooks, each `heist` effect,
 * each inner effect) and reports true as soon as one inner effect is not X-Con Security Van's
 * move-a-Villain choice.
 *
 * @param G - The game state to inspect (not mutated).
 * @returns true when a won Heist fires at least one effect the bot keeps.
 */
export function hasBotHeistPayoff(G: LegendaryGameState): boolean {
  // why: WP-878 / D-24826 §3 — the bot's answer to X-Con Security Van's move declines it (D-24823
  // §7: the Spinning Cyclone answer could name an occupied space the X-Con variant rejects), so a
  // crew of X-Con copies alone gains nothing from a won Heist and risks a Wound on a lost one. Any
  // other readied Heist card carries an unconditional payoff and restores the reason to attempt.
  const allHooks = G.heroAbilityHooks ?? [];
  for (const cardId of G.turnEconomy?.heistCrewCards ?? []) {
    for (const hook of getHooksForCard(allHooks, cardId)) {
      for (const effect of hook.effects ?? []) {
        if (effect.type !== 'heist') {
          continue;
        }
        for (const innerEffect of effect.heistEffects ?? []) {
          if (innerEffect.type !== BOT_DECLINED_HEIST_EFFECT_TYPE) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

/**
 * Whether the bot should attempt a Heist right now.
 *
 * True only when the Heist is available (isHeistAvailable), a won Heist would pay the bot
 * (hasBotHeistPayoff), and more cards in the Villain Deck would lose to the Heist Count than would
 * beat it. Ties count as neither.
 *
 * @param G - The game state to inspect (not mutated).
 * @param playerId - The seat deciding (the active player).
 * @returns true when getLegalMoves should offer attemptHeist.
 */
export function shouldBotAttemptHeist(G: LegendaryGameState, playerId: string): boolean {
  // why: WP-878 / D-24826 §2 — availability first, through the move's own predicate (D-24364), so
  // every emitted attemptHeist commits and the cheaper checks never run on a board without a
  // readied Heist card.
  if (!isHeistAvailable(G, playerId)) {
    return false;
  }
  if (!hasBotHeistPayoff(G)) {
    return false;
  }
  // why: WP-878 / D-24826 §1, §5 — Jeff's card-count odds (2026-11-08): attempt when a win is more
  // likely than a Wound over the remaining Villain Deck taken as a set. countHeistOdds counts every
  // card once, so the deck's order and its hidden top card are never read; the set itself is
  // public in principle (setup composition plus every card revealed since).
  const odds = countHeistOdds(G, playerId);
  if (odds.winCount > odds.loseCount) {
    return true;
  }
  return false;
}
