/**
 * resolveCopyPowersChoice move — resolves a pending Copy Powers choice (WP-535 / D-24345).
 *
 * Parked by the `copy-powers` hero-effect handler (Rogue's "Copy Powers": "Play this card
 * as a copy of another Hero you played this turn.") when the current player has ≥ 2
 * eligible Heroes to copy. The player picks which Hero to copy; this move re-fires that
 * Hero's on-play ability (via the reentrant `executeHeroEffects`) and grants Copy Powers
 * the copied class, then front-pops the queue. With exactly 1 eligible Hero the handler
 * auto-copies (no park); a bot-driven current player auto-copies via ai.legalMoves, so
 * only the current human player ever parks an entry here.
 *
 * Atomicity is exact: the chosen `cardId` must be an eligible Hero in `inPlay` NOW (the
 * block-all guards freeze the board between park and resolve, so the eligible set cannot
 * drift). A stale/absent/wrong target is a silent no-op that leaves the queue intact so
 * the player can resubmit.
 *
 * // why: unlike every other resolve move (which takes the `{G, playerID}`-only shape),
 * this threads the FULL move-context wrapper into `executeHeroEffects` — the copied
 * ability may draw / reshuffle via `ctx.random`, so the random source must survive the
 * re-fire. It mirrors applyCardPlay's `{ G, playerID, ...context }` split exactly.
 *
 * No registry imports. No .reduce(). Moves never throw.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { buildCopyPowersTargets, applyCopyPowers } from '../hero/heroEffects.execute.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/**
 * Payload for the resolveCopyPowersChoice move.
 *
 * cardId — the Hero ext_id the player chooses to copy (must be an eligible in-play Hero now).
 */
export interface ResolveCopyPowersChoiceArgs {
  cardId: CardExtId;
}

/**
 * Whether any Copy Powers choice is currently pending.
 *
 * Single predicate imported by the block-all action-move guards and the getLegalMoves
 * short-circuit. Undefined and [] both mean no pending choice.
 *
 * @param G - The game state to inspect (not mutated).
 * @returns true when the pending Copy Powers queue holds at least one entry.
 */
export function hasPendingCopyPowersChoice(G: LegendaryGameState): boolean {
  return (G.pendingCopyPowersChoices?.length ?? 0) > 0;
}

/**
 * The Heroes the given player may copy for the FRONT pending choice — the eligible
 * in-play Heroes when the front entry belongs to the player, else `[]`.
 *
 * // why: the eligibility source shared by the UIState projection and the resolve
 * validation (the round-trip rule) so the client can only submit a Hero the resolve move
 * accepts. Gated on the front chooser so only the active chooser's list projects.
 *
 * @param G - The game state to inspect (not mutated).
 * @param playerID - The player whose front pending choice is inspected.
 * @returns The copyable Hero ids in play order, or [] when not this player's choice.
 */
export function getEligibleCopyPowersCards(
  G: LegendaryGameState,
  playerID: string,
): CardExtId[] {
  const queue = G.pendingCopyPowersChoices;
  if (queue === undefined || queue.length === 0) {
    return [];
  }
  const front = queue[0]!;
  if (front.playerID !== playerID) {
    return [];
  }
  return buildCopyPowersTargets(G, playerID);
}

/**
 * The deterministic bot/auto default Hero to copy for the FRONT pending choice — the
 * highest-cost eligible Hero (ties → earliest played). Returns null when it is not this
 * player's choice or there are no eligible Heroes.
 *
 * // why: the bot copies the highest-cost Hero (the most valuable ability, matching the
 * give-HQ-Hero "highest cost" bot heuristic); ai.legalMoves returns exactly this as the
 * single legal move so a bot-driven chooser never blocks the board.
 *
 * @param G - The game state to inspect (not mutated).
 * @param playerID - The player whose front pending choice is inspected.
 * @returns The highest-cost copyable Hero id, or null.
 */
export function selectDefaultCopyPowersCard(
  G: LegendaryGameState,
  playerID: string,
): CardExtId | null {
  const eligible = getEligibleCopyPowersCards(G, playerID);
  if (eligible.length === 0) {
    return null;
  }
  let bestHeroId: CardExtId = eligible[0]!;
  let bestCost = G.cardStats[bestHeroId]?.cost ?? 0;
  for (let heroIndex = 1; heroIndex < eligible.length; heroIndex++) {
    const heroId = eligible[heroIndex]!;
    const heroCost = G.cardStats[heroId]?.cost ?? 0;
    // why: strictly greater keeps the earliest-played Hero on a cost tie (deterministic).
    if (heroCost > bestCost) {
      bestCost = heroCost;
      bestHeroId = heroId;
    }
  }
  return bestHeroId;
}

/**
 * Resolves the FRONT pending Copy Powers choice by copying the chosen Hero.
 *
 * Atomic sequence:
 *   1. Validate args — a non-empty `cardId`; an invalid shape is a silent no-op.
 *   2. Validate the front pending entry — non-empty queue, front.playerID +
 *      choiceType match.
 *   3. The chosen `cardId` must be an eligible in-play Hero NOW; absent/stale →
 *      silent no-op, queue intact (resubmit).
 *   4. Front-pop FIRST (so a copied ability that parks its OWN nested pending lands
 *      behind this one in FIFO), THEN apply the copy (re-fire + dual-class).
 *
 * Any failure before step 4 ABORTS the move (no state change). Moves never throw.
 *
 * // why: destructures `{ G, playerID, ...context }` and threads `context` (the wrapper
 * carrying `.ctx` + `.random`) into applyCopyPowers → executeHeroEffects, so a copied
 * draw / reshuffle replays deterministically from the seed. Mirrors applyCardPlay.
 *
 * @param context - boardgame.io move context (G, ctx, playerID, random, ...).
 * @param args - the selected { cardId } to copy.
 */
export function resolveCopyPowersChoice(
  { G, playerID, ...context }: MoveContext,
  args: ResolveCopyPowersChoiceArgs,
): void {
  // Step 1: Validate args — empty / non-string cardId is a no-op.
  if (typeof args.cardId !== 'string' || args.cardId.length === 0) {
    return;
  }

  // Step 2: Validate the front pending entry — front-only resolution.
  const queue = G.pendingCopyPowersChoices;
  if (queue === undefined || queue.length === 0) {
    return;
  }
  const front = queue[0]!;
  if (front.playerID !== playerID) {
    return;
  }
  if (front.choiceType !== 'copy-powers') {
    return;
  }

  // Step 3: Resolve against CURRENT G — the chosen cardId must be an eligible in-play Hero
  // now (no eligible snapshot is stored; eligibility is recomputed fresh, the round-trip rule).
  const eligible = buildCopyPowersTargets(G, playerID);
  if (!eligible.includes(args.cardId)) {
    // why: invalid/stale target (not an eligible Hero) is a no-op that leaves the queue
    // intact so the player resubmits; the block-all guard guarantees an eligible Hero exists.
    return;
  }

  // Step 4: Front-pop LAST-of-validation / FIRST-of-mutation — pop the copy-powers entry
  // BEFORE the re-fire so a copied ability that parks its own pending lands behind it.
  const sourceCardId = front.sourceCardId;
  queue.shift();

  // Step 5: Apply the copy (re-fire + dual-class) with the full move-context wrapper.
  applyCopyPowers(G, context, playerID, sourceCardId, args.cardId);
}
