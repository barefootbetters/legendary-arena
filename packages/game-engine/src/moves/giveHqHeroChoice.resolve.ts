/**
 * resolveGiveHqHeroChoice move — resolves a pending give-HQ-Hero player choice
 * (WP-532 / D-24343).
 *
 * Parked by the `give-hq-hero-each-player` villain-effect handler (Paibok the Power
 * Skrull Fight) when the CURRENT (fighting) player reaches ≥ 2 HQ Heroes to choose
 * from. The player picks which HQ Hero to gain; this move moves that Hero from the HQ
 * into the chooser's discard pile (D-24327 gain-routing), refills the vacated HQ slot
 * from `G.heroDeck`, and front-pops the queue. Every other player (and a bot-driven
 * current player, via ai.legalMoves) auto-gains the highest-cost HQ Hero, so only the
 * current human player ever parks an entry here.
 *
 * Atomicity is exact: the chosen `cardId` must be a Hero present in `G.hq` NOW (the
 * block-all guards freeze the board between park and resolve). A stale/absent/wrong
 * target is a silent no-op that leaves the queue intact so the player can resubmit.
 *
 * No registry imports. No .reduce(). Moves never throw.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState, GiveHqHeroFilter } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { refillHqSlot } from '../board/city.logic.js';
import { formatCardRef } from '../log/logDisplay.js';
import { pushLog } from '../log/logPush.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/**
 * Payload for the resolveGiveHqHeroChoice move.
 *
 * - `{ cardId }` — the HQ Hero ext_id the player chooses to gain (must be an
 *   eligible HQ occupant now).
 * - `{ decline: true }` — decline the gain (only honored when the FRONT pending
 *   entry is `optional`, e.g. Dark Technology's "may recruit"; WP-692 / D-24509).
 */
export type ResolveGiveHqHeroChoiceArgs =
  | { cardId: CardExtId }
  | { decline: true };

/**
 * Whether any give-HQ-Hero choice is currently pending.
 *
 * Single predicate imported by the block-all action-move guards and the
 * getLegalMoves short-circuit. Undefined and [] both mean no pending choice.
 *
 * @param G - The game state to inspect (not mutated).
 * @returns true when the pending give-HQ-Hero queue holds at least one entry.
 */
export function hasPendingGiveHqHeroChoice(G: LegendaryGameState): boolean {
  return (G.pendingGiveHqHeroChoices?.length ?? 0) > 0;
}

/**
 * Whether an HQ Hero satisfies the FRONT pending choice's optional trait filter
 * (WP-692 / D-24509).
 *
 * // why: the free-recruit tactics gate the HQ by a trait predicate (Dark Technology
 * `hero-class` ∈ {tech, ranged}; Bitter Captor `team` === x-men), read from the
 * setup-time `G.cardTraits` snapshot with OR semantics over `filter.values`. An
 * absent filter (Paibok's give-hq-hero-each-player) matches every Hero, unchanged. A
 * missing traits map / entry matches nothing rather than throwing — a filtered choice
 * with no classified HQ Hero is a no-op, not a crash.
 *
 * @param G - The game state (read-only; supplies `cardTraits`).
 * @param cardId - The HQ Hero ext_id to test.
 * @param filter - The front entry's filter, or undefined for the unfiltered case.
 * @returns true when the Hero is eligible under the filter.
 */
function hqHeroMatchesFilter(
  G: LegendaryGameState,
  cardId: CardExtId,
  filter: GiveHqHeroFilter | undefined,
): boolean {
  if (filter === undefined) {
    return true;
  }
  const trait = G.cardTraits?.[cardId];
  if (trait === undefined) {
    return false;
  }
  for (const value of filter.values) {
    if (filter.kind === 'team') {
      if (trait.team === value) {
        return true;
      }
    } else {
      // why: the kind union is closed to 'team' | 'hero-class', so the else branch
      // is 'hero-class' — total without a default. Slugs are normalized at setup, so
      // `===` is casing/whitespace-safe (mirrors villainEffects.execute cardTraitMatches).
      if (trait.heroClass === value) {
        return true;
      }
    }
  }
  return false;
}

/**
 * The HQ Heroes the given player may gain for the FRONT pending choice — the
 * non-null `G.hq` occupants (in slot order) that satisfy the front entry's optional
 * trait filter, when the front entry belongs to the player, else `[]`.
 *
 * // why: the eligibility source shared by the UIState projection, the resolve
 * validation, and the bot default (the round-trip rule) so the client can only submit
 * a Hero the resolve move accepts. The HQ is PUBLIC, so no hand-leak redaction — but
 * still gated on the front chooser so only the active chooser's list projects. The
 * WP-692 free-recruit tactics add a trait filter (Paibok stays unfiltered).
 *
 * @param G - The game state to inspect (not mutated).
 * @param playerID - The player whose front pending choice is inspected.
 * @returns The gainable HQ Hero ids in HQ slot order, or [] when not this player's choice.
 */
export function getEligibleGiveHqHeroCards(
  G: LegendaryGameState,
  playerID: string,
): CardExtId[] {
  const queue = G.pendingGiveHqHeroChoices;
  if (queue === undefined || queue.length === 0) {
    return [];
  }
  const front = queue[0]!;
  if (front.playerID !== playerID) {
    return [];
  }
  const eligible: CardExtId[] = [];
  for (let hqIndex = 0; hqIndex < G.hq.length; hqIndex++) {
    const slot = G.hq[hqIndex];
    if (slot !== null && slot !== undefined && hqHeroMatchesFilter(G, slot, front.filter)) {
      eligible.push(slot);
    }
  }
  return eligible;
}

/**
 * The deterministic bot/auto default HQ Hero to gain for the FRONT pending choice —
 * the highest-cost HQ Hero (ties → rightmost index), matching the handler's
 * non-current auto-gain selector. Returns null when it is not this player's choice or
 * the HQ is empty.
 *
 * // why: the bot picks the highest-cost Hero (the operator-locked "for the bot, just
 * choose the highest cost"); ai.legalMoves returns exactly this as the single legal
 * move so a bot-driven chooser never blocks the board.
 *
 * @param G - The game state to inspect (not mutated).
 * @param playerID - The player whose front pending choice is inspected.
 * @returns The highest-cost gainable HQ Hero id, or null.
 */
export function selectDefaultGiveHqHeroCard(
  G: LegendaryGameState,
  playerID: string,
): CardExtId | null {
  // why: WP-692 / D-24509 — pick the highest-cost ELIGIBLE Hero (respecting the
  // front entry's optional trait filter) rather than the highest-cost HQ Hero
  // overall. An unfiltered highest-cost scan could name an ineligible Hero the
  // resolve move then rejects, deadlocking the block-all guard (the sim-hang smell).
  // Gaining is always player-optimal (a free Hero beats declining), so the bot
  // gains even for an optional (Dark Technology "may") choice.
  const eligible = getEligibleGiveHqHeroCards(G, playerID);
  if (eligible.length === 0) {
    return null;
  }
  let selectedCardId: CardExtId | null = null;
  let highestCost = -1;
  for (const cardId of eligible) {
    const heroCost = G.cardStats[cardId]?.cost ?? 0;
    // why: D-24343 — highest cost wins; a tie resolves to the LAST eligible entry.
    // `eligible` is in HQ slot order, so ">=" keeps the rightmost slot on a tie,
    // matching selectHighestCostHqIndex's rightmost-index rule.
    if (heroCost >= highestCost) {
      highestCost = heroCost;
      selectedCardId = cardId;
    }
  }
  return selectedCardId;
}

/**
 * Resolves the FRONT pending give-HQ-Hero choice by moving the chosen HQ Hero into
 * the chooser's discard pile.
 *
 * Atomic sequence:
 *   1. Validate args — exactly one of `{ decline: true }` / `{ cardId }`; any other
 *      shape is a silent no-op.
 *   2. Validate the front pending entry — non-empty queue, front.playerID +
 *      choiceType match.
 *   3. Decline arm (WP-692 / D-24509) — honored only when the front entry is
 *      `optional` (Dark Technology's "may"); front-pop with no gain. A decline against
 *      a mandatory entry is a no-op, queue intact.
 *   4. The chosen `cardId` must be an ELIGIBLE HQ occupant NOW (fresh via
 *      getEligibleGiveHqHeroCards, which applies the front entry's trait filter);
 *      ineligible/stale → silent no-op, queue intact (resubmit).
 *   5. Vacate the HQ slot, refill it from `G.heroDeck`, push the Hero onto the
 *      chooser's discard (D-24327) — spending NO recruit — log, then front-pop LAST.
 *
 * Any failure before step 5 ABORTS the move (no zone change). Moves never throw.
 *
 * @param context - boardgame.io move context with G and playerID.
 * @param args - the selected `{ cardId }` to gain, or `{ decline: true }`.
 */
export function resolveGiveHqHeroChoice(
  { G, playerID }: MoveContext,
  args: ResolveGiveHqHeroChoiceArgs,
): void {
  // Step 1: Validate args — exactly one of { decline: true } / { cardId }; any other
  // shape (both, neither, empty cardId) is a malformed payload and a silent no-op.
  const isDecline = (args as { decline?: unknown }).decline === true;
  const requestedCardId = (args as { cardId?: unknown }).cardId;
  const isGainRequest = typeof requestedCardId === 'string' && requestedCardId.length > 0;
  if (isDecline === isGainRequest) {
    return;
  }

  // Step 2: Validate the front pending entry — front-only resolution.
  const queue = G.pendingGiveHqHeroChoices;
  if (queue === undefined || queue.length === 0) {
    return;
  }
  const front = queue[0]!;
  if (front.playerID !== playerID) {
    return;
  }
  if (front.choiceType !== 'give-hq-hero') {
    return;
  }

  // Step 3: Decline arm (WP-692 / D-24509) — honored ONLY when the front entry is
  // optional (Dark Technology's "may recruit"). A decline against a mandatory entry
  // (Paibok, Bitter Captor) is a no-op that leaves the queue intact so the player must
  // still pick. A valid decline front-pops with no gain, no recruit, no card movement.
  if (isDecline) {
    if (front.optional !== true) {
      return;
    }
    pushLog(G, `Player ${playerID} declined to recruit a Hero from the HQ.`);
    queue.shift();
    return;
  }

  // Step 4: Resolve against CURRENT G — the chosen cardId must be an ELIGIBLE HQ
  // occupant now (recomputed fresh via getEligibleGiveHqHeroCards, which applies the
  // front entry's optional trait filter; the round-trip rule). An ineligible/stale
  // target is a no-op, queue intact.
  const chosenCardId = requestedCardId as CardExtId;
  if (!getEligibleGiveHqHeroCards(G, playerID).includes(chosenCardId)) {
    // why: invalid/stale/ineligible target is a no-op that leaves the queue intact so the
    // player resubmits; the block-all guard guarantees a valid eligible HQ Hero still exists.
    return;
  }
  let hqIndex = -1;
  for (let slotIndex = 0; slotIndex < G.hq.length; slotIndex++) {
    if (G.hq[slotIndex] === chosenCardId) {
      hqIndex = slotIndex;
      break;
    }
  }
  if (hqIndex === -1) {
    return;
  }

  // Step 5: Mutate — vacate the slot, refill from G.heroDeck, gain to the chooser's discard.
  // why: WP-692 / D-24509 — this is the free-recruit mutation too (the tactic case): it
  // moves the card + refills the HQ but never reads or spends `turnEconomy.recruit`, so a
  // tactic-parked pick recruits for free, exactly as Paibok's mandatory give does.
  const heroId = G.hq[hqIndex] as CardExtId;
  G.hq[hqIndex] = null;
  const refillResult = refillHqSlot(G.hq, hqIndex, G.heroDeck);
  G.hq = refillResult.hq;
  G.heroDeck = refillResult.heroDeck;
  // why: D-24327 — "gain" routes to the recipient's discard pile, never the victory pile.
  const playerZones = G.playerZones[playerID];
  if (playerZones) {
    playerZones.discard.push(heroId);
  }
  pushLog(
    G,
    `Player ${playerID} gained ${formatCardRef(G.cardDisplayData, heroId)} from the HQ into their discard pile.`,
  );

  // Step 6: Front-pop LAST — each entry owes exactly one Hero (no `remaining`).
  queue.shift();
}
