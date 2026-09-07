/**
 * resolvePlayVillainTopChoice move — resolves a pending "play the top card of the Villain
 * Deck for +N Attack?" choice (WP-663 / D-24474 — Emma Frost's Shadowed Thoughts).
 *
 * Called by the active player after an optional-play-villain-top hero ability parked a
 * PendingPlayVillainTopChoice on G.pendingPlayVillainTopChoices (FIFO). The player either
 * declines (nothing) or accepts, in which case the top Villain-Deck card is PLAYED via the
 * shared reveal cascade (`playTopVillainDeckCards` — city entry / Master Strike / Scheme
 * Twist, no re-implementation) and the printed +Attack reward is granted.
 *
 * Unlike optional-ko-reward (a pure-upside-if-you-KO reward), playing the top Villain-Deck
 * card has a real downside, so the choice is genuine — humans are prompted (the client
 * PlayVillainTopPrompt), and the sim/bot default is DECLINE (see the getLegalMoves
 * short-circuit).
 *
 * No registry imports. No .reduce(). Moves never throw.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState } from '../types.js';
import type { RevealContext } from '../villainDeck/villainDeck.reveal.js';
import { playTopVillainDeckCards } from '../villainDeck/villainDeck.reveal.js';
import { DEFAULT_IMPLEMENTATION_MAP } from '../rules/ruleRuntime.impl.js';
import { addResources } from '../economy/economy.logic.js';
import { pushLog } from '../log/logPush.js';
import { formatCardRef } from '../log/logDisplay.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/**
 * Payload for the resolvePlayVillainTopChoice move: accept (play the top Villain-Deck card
 * for the Attack reward) or decline (nothing).
 */
export type ResolvePlayVillainTopChoiceArgs = { accept: boolean };

/**
 * Whether any play-top-Villain-Deck-card choice is currently pending.
 *
 * Single predicate imported by the block-all action-move guards and the getLegalMoves
 * short-circuit. `undefined` and `[]` both mean no pending choice (mirrors
 * hasPendingOptionalKoReward).
 *
 * @param G - The game state to inspect (not mutated).
 * @returns true when the pending queue holds at least one entry.
 */
export function hasPendingPlayVillainTopChoice(G: LegendaryGameState): boolean {
  return (G.pendingPlayVillainTopChoices?.length ?? 0) > 0;
}

/**
 * Resolves the FRONT pending play-top-Villain-Deck-card choice.
 *
 * Sequence (mirrors optionalKoReward.resolve.ts):
 *   1. Validate args — `accept` must be a boolean; else a silent no-op (queue intact).
 *   2. Validate the front pending entry — non-empty queue, front.playerID match.
 *   3. Decline (`accept: false`) → front-pop only, nothing.
 *   4. Accept (`accept: true`) → play the top Villain-Deck card via the shared reveal
 *      cascade, then grant the +Attack reward; front-pop LAST.
 *
 * Moves never throw.
 *
 * @param context - boardgame.io move context (G, playerID, random for the reveal reshuffle).
 * @param args - `{ accept }`.
 */
export function resolvePlayVillainTopChoice(
  { G, playerID, random }: MoveContext,
  args: ResolvePlayVillainTopChoiceArgs,
): void {
  // Step 1: validate args — `accept` must be a boolean.
  const accept = (args as { accept?: unknown }).accept;
  if (typeof accept !== 'boolean') { return; }

  // Step 2: validate the front pending entry — front-only resolution.
  const queue = G.pendingPlayVillainTopChoices;
  if (queue === undefined || queue.length === 0) { return; }
  const front = queue[0]!;
  if (front.playerID !== playerID) { return; }

  // Step 3: decline → front-pop only, nothing granted.
  if (!accept) {
    queue.shift();
    pushLog(G,
      `Player ${playerID} declined to play the top card of the Villain Deck for ${formatCardRef(G.cardDisplayData, front.cardId)}.`,
      'neutral',
      front.cardId,
    );
    return;
  }

  // Step 4: accept → play the top Villain-Deck card, then grant the +Attack reward.
  // why: WP-663 / D-24474 — build the narrow RevealContext exactly as fightVillain.ts does
  // (this move receives no RevealContext / implementationMap), passing the STATIC
  // DEFAULT_IMPLEMENTATION_MAP so the played card resolves as a normal reveal (city entry,
  // Master Strike, Scheme Twist) — the shared cascade, never re-implemented. The +Attack is
  // the printed "If you do" reward, granted after the play.
  const revealContext: RevealContext = {
    random,
    ctx: { currentPlayer: playerID },
  };
  pushLog(G,
    `Player ${playerID} plays the top card of the Villain Deck for ${formatCardRef(G.cardDisplayData, front.cardId)}.`,
    'neutral',
    front.cardId,
  );
  playTopVillainDeckCards(G, revealContext, DEFAULT_IMPLEMENTATION_MAP, 1);
  G.turnEconomy = addResources(G.turnEconomy, front.attackReward, 0);
  pushLog(G,
    `Player ${playerID} gained +${front.attackReward} attack from ${formatCardRef(G.cardDisplayData, front.cardId)}.`,
    'applied',
    front.cardId,
  );

  // Step 5: front-pop LAST.
  queue.shift();
}
