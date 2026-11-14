/**
 * Heist for the Legendary Arena game engine (WP-865 / D-24808).
 *
 * Rules v23 p.26-27 (Ant-Man and the Wasp): once per turn, if you played any Heroes with Heist
 * abilities, you may attempt a Heist. Count the different non-zero costs among your Heroes (the
 * Heist Count), then reveal the top card of the Villain Deck and compare with its printed VP:
 *
 * - higher: use all the Heist abilities of the Heroes you played this turn;
 * - tied: nothing happens;
 * - lower: gain a Wound.
 *
 * Playing an allowlisted Heist card readies it (heroEffectHeist). `attemptHeist` is the player's
 * action that resolves the Heist; `isHeistAvailable` is the single legality predicate shared by
 * the move and the `economy.heistAvailable` projection, so the button the client shows and the
 * move the engine accepts never disagree. Bots attempt a Heist through getLegalMoves step 4c, which
 * emits the move only when shouldBotAttemptHeist (simulation/ai.heist.ts) passes: the Heist is
 * available, a won Heist pays the bot, and the card-count odds favor it (WP-878 / D-24826). A human
 * player's Heist is unchanged.
 *
 * This is a non-core move that gates internally (the useRitualArtifact precedent). It is NOT added
 * to CoreMoveName, CORE_MOVE_NAMES, or MOVE_ALLOWED_STAGES.
 *
 * No registry imports. No .reduce(). Moves never throw. Imported bindings are read only inside
 * function bodies (this module joins the runtime-safe import cycle through phaseCard and
 * heroEffects.execute, the ritualArtifact.ts precedent).
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { hasAnyPendingChoice } from './phaseCard.js';
import { fireHeistPlays } from '../hero/heroEffects.execute.js';
import { playedCardIdsStillInPlay } from '../hero/splitCard.logic.js';
import { markHeistAttempted } from '../economy/economy.logic.js';
import { gainWoundWithOutcome } from '../board/wounds.logic.js';
import { VP_BYSTANDER, VP_HENCHMAN, VP_VILLAIN } from '../scoring/scoring.types.js';
import { formatCardRef } from '../log/logDisplay.js';
import { pushLog } from '../log/logPush.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/**
 * Computes a player's Heist Count: the number of different non-zero printed costs among the
 * Heroes they have right now.
 *
 * @param G - The game state to inspect (not mutated).
 * @param playerId - The seat whose Heroes are counted.
 * @returns The Heist Count, or 0 when the player has no zones.
 */
export function heistCount(G: LegendaryGameState, playerId: string): number {
  const playerZones = G.playerZones?.[playerId];
  if (!playerZones) {
    return 0;
  }
  // why: WP-865 / D-24808 — "your Heroes this turn" is the rulebook term "Heroes you have"
  // (rules v23 ~l.3439-3450): the cards in your hand plus the cards you played this turn that
  // are still in play (D-24529 overturned a play-only reading of the same phrase). A played card
  // that moved to the deck, discard or KO pile no longer counts, so the pool is
  // playedCardIdsStillInPlay, not playedCardIdsThisTurn.
  const pool: CardExtId[] = [...playerZones.hand, ...playedCardIdsStillInPlay(G, playerZones.inPlay)];
  const distinctCosts: number[] = [];
  for (const cardId of pool) {
    // why: WP-865 / D-24808 — the PRINTED cost (G.cardStats, built at setup). An id with no
    // cardStats entry adds nothing; 0-cost cards (S.H.I.E.L.D. starters) never count.
    const cost = G.cardStats?.[cardId]?.cost ?? 0;
    if (cost > 0 && !distinctCosts.includes(cost)) {
      distinctCosts.push(cost);
    }
  }
  return distinctCosts.length;
}

/**
 * Reads the printed VP of a Villain Deck card for a Heist comparison.
 *
 * @param G - The game state to inspect (not mutated).
 * @param cardId - The revealed Villain Deck card.
 * @returns The card's printed VP; 0 for a Scheme Twist, a Master Strike, or an unclassified card.
 */
export function heistRevealedVictoryPoints(G: LegendaryGameState, cardId: CardExtId): number {
  const cardType = G.villainDeckCardTypes?.[cardId];
  // why: WP-865 / D-24808 — villains and henchmen read their printed VP from the setup snapshot,
  // else the same constant scoring falls back to (D-24157). Accepted residual: a printed VP that
  // does not normalize ("-1", "1*", "2+", "3+", "3*") is absent from cardVictoryPoints and reads
  // as 1. Bystanders are 1 VP by rule. Scheme Twists and Master Strikes print no VP, and a card
  // with no classification reads 0, silently.
  if (cardType === 'villain') {
    return G.cardVictoryPoints?.[cardId] ?? VP_VILLAIN;
  } else if (cardType === 'henchman') {
    return G.cardVictoryPoints?.[cardId] ?? VP_HENCHMAN;
  } else if (cardType === 'bystander') {
    return VP_BYSTANDER;
  } else {
    return 0;
  }
}

/**
 * Whether the given player may attempt a Heist right now.
 *
 * True in the `main` stage with no choice open, when the player readied at least one Heist card,
 * has not yet attempted this turn's Heist, and the Villain Deck has a card to reveal. Does not
 * check the seat: callers pass `ctx.currentPlayer`.
 *
 * @param G - The game state to inspect (not mutated).
 * @param playerId - The seat to check.
 * @returns true when the Attempt Heist action would be accepted.
 */
export function isHeistAvailable(G: LegendaryGameState, playerId: string): boolean {
  // why: WP-865 / D-24808 — the single legality predicate, shared by the attemptHeist move and the
  // economy.heistAvailable projection. The `main` window with no choice open is the
  // useRitualArtifact gate (D-24794).
  if (G.currentStage !== 'main') return false;
  if (hasAnyPendingChoice(G)) return false;
  if (!G.playerZones?.[playerId]) return false;
  if ((G.turnEconomy?.heistCrewCards?.length ?? 0) === 0) return false;
  if (G.turnEconomy?.hasAttemptedHeistThisTurn === true) return false;
  // why: WP-865 / D-24808 — with an empty Villain Deck there is no card to reveal, so the Heist
  // cannot be attempted.
  if ((G.villainDeck?.deck?.length ?? 0) === 0) return false;
  return true;
}

/**
 * Logs and applies the Wound for a Heist that came up short.
 *
 * @param G - Game state, mutated in place.
 * @param playerId - The player whose Heist failed.
 * @param count - The Heist Count.
 * @param victoryPoints - The revealed card's printed VP.
 */
function resolveCaughtHeist(G: LegendaryGameState, playerId: string, count: number, victoryPoints: number): void {
  const prefix = `The Heist failed — Heist Count ${count} is lower than ${victoryPoints} VP`;
  const woundOutcome = gainWoundWithOutcome(G, playerId);
  // why: WP-865 / D-24808 — woundsDrawn projects the active player's Wounds this turn; it bumps
  // when a Wound landed (gained, or landed with a Diving Block reveal pending) and not when the
  // supply was empty (the heroEffectGainWound convention). A Wound a Diving Block reveal may still
  // return is never logged as gained (D-24673).
  if (woundOutcome === 'gained') {
    G.turnEconomy.woundsDrawn += 1;
    pushLog(G, `${prefix}, so Player ${playerId} gains a Wound.`, 'blocked');
  } else if (woundOutcome === 'diving-block-pending') {
    G.turnEconomy.woundsDrawn += 1;
    pushLog(G, `${prefix}, so Player ${playerId} must gain a Wound unless they block it.`, 'blocked');
  } else {
    pushLog(G, `${prefix}, but the Wound supply is empty.`, 'blocked');
  }
}

/**
 * Attempts this turn's Heist: compares the Heist Count with the printed VP of the Villain Deck's
 * top card, then fires every readied Heist ability (higher), does nothing (tied), or gains a Wound
 * (lower).
 *
 * Takes no arguments. Any ineligible call (the wrong stage, a choice open, nothing readied, a
 * second attempt, an empty Villain Deck) returns silently with no mutation. Moves never throw.
 *
 * @param context - boardgame.io move context with G, ctx, random.
 */
export function attemptHeist({ G, playerID, ...context }: MoveContext): void {
  // Step 1: Validate — no arguments to check; the player is the current player.
  const playerId = context.ctx.currentPlayer;

  // Step 2: Stage gate (non-core move, internal gating) plus the shared legality predicate.
  if (G.currentStage !== 'main') return;
  if (!isHeistAvailable(G, playerId)) return;
  const revealedCardId = G.villainDeck.deck[0];
  if (revealedCardId === undefined) return;

  // Step 3: Latch the one attempt per turn.
  // why: WP-865 / D-24808 — the latch is set BEFORE the outcome resolves, so no inner effect can
  // re-enter a second attempt, and a Heist card played later this turn is too late.
  // why: WP-876 / D-24823 — the revealed card is recorded with the latch, so The Big Score and
  // Revolutionary Anthem read the card THIS Heist revealed even after an earlier Heist ability
  // changed the Villain Deck top.
  G.turnEconomy = markHeistAttempted(G.turnEconomy, revealedCardId);

  // Step 4: Count and reveal. The move's own logic uses no randomness.
  // why: WP-865 / D-24808 — the revealed card stays on top of the Villain Deck: the rule only
  // reveals it (The Big Score and Revolutionary Anthem read it as "the card revealed", WP-876), so no zone moves it and
  // the deck is never shuffled, drawn or reordered here.
  const count = heistCount(G, playerId);
  const victoryPoints = heistRevealedVictoryPoints(G, revealedCardId);
  pushLog(G,
    `Player ${playerId} attempts a Heist: Heist Count ${count} against ${formatCardRef(G.cardDisplayData, revealedCardId)} (${victoryPoints} VP).`,
    'neutral',
  );

  // Step 5: Resolve.
  if (count > victoryPoints) {
    // why: WP-865 / D-24808 — forward the move context so an inner draw reshuffles the player's
    // discard through ctx.random exactly as it would at play.
    const firedCount = fireHeistPlays(G, context, playerId);
    const abilityWord = firedCount === 1 ? 'ability' : 'abilities';
    pushLog(G, `The Heist worked! Player ${playerId} uses ${firedCount} Heist ${abilityWord}.`, 'applied');
  } else if (count === victoryPoints) {
    pushLog(G, `The Heist went sideways — Heist Count ${count} ties ${victoryPoints} VP, so nothing happens.`, 'blocked');
  } else {
    resolveCaughtHeist(G, playerId, count, victoryPoints);
  }
}
