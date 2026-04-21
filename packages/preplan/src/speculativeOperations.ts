import type { CardExtId } from '@legendary-arena/game-engine';
import type { PrePlan, RevealRecord, PrePlanStep } from './preplan.types.js';

/**
 * Speculatively draw the top card from the sandbox-local deck.
 *
 * Returns `null` when the pre-plan is not active or when the sandbox deck
 * is empty. On success the drawn card is appended to the sandbox hand, a
 * `RevealRecord` with `source: 'player-deck'` is appended to the reveal
 * ledger, and the returned pre-plan carries a freshly-copied sandbox with
 * `revision` incremented by one.
 *
 * @param prePlan - The pre-plan to draw from.
 * @returns `{ updatedPlan, drawnCard }` on success, or `null` if
 *   `status !== 'active'` or the deck is empty.
 */
export function speculativeDraw(
  prePlan: PrePlan,
): { updatedPlan: PrePlan; drawnCard: CardExtId } | null {
  if (prePlan.status !== 'active') {
    // why: pre-plan is advisory and only mutates while active; null-return
    // signals non-active status to the caller without throwing (WP-057
    // failure-signaling convention)
    return null;
  }
  const { deck, hand } = prePlan.sandboxState;
  const drawnCard = deck[0];
  if (drawnCard === undefined) {
    return null;
  }
  // why: fresh array prevents aliasing — consumer must not be able to
  // mutate input PrePlan through returned sandboxState references
  // (WP-028 aliasing precedent)
  const newHand = [...hand, drawnCard];
  const newDeck = deck.slice(1);
  const newLedgerEntry: RevealRecord = {
    source: 'player-deck',
    cardExtId: drawnCard,
    revealIndex: prePlan.revealLedger.length,
  };
  const updatedPlan: PrePlan = {
    ...prePlan,
    // why: monotonic revision enables stale-reference detection, race
    // resolution, and notification ordering (preplan.types.ts
    // PrePlan.revision invariant)
    revision: prePlan.revision + 1,
    sandboxState: {
      hand: newHand,
      deck: newDeck,
      discard: [...prePlan.sandboxState.discard],
      inPlay: [...prePlan.sandboxState.inPlay],
      counters: { ...prePlan.sandboxState.counters },
    },
    revealLedger: [...prePlan.revealLedger, newLedgerEntry],
    planSteps: [...prePlan.planSteps],
  };
  return { updatedPlan, drawnCard };
}

/**
 * Speculatively play a card from the sandbox hand into the sandbox in-play
 * zone.
 *
 * Returns `null` when the pre-plan is not active or when the requested card
 * is not present in the hand. Only the first occurrence of the card is
 * removed from the hand. The reveal ledger is not touched.
 *
 * @param prePlan - The pre-plan to mutate speculatively.
 * @param cardExtId - The card to move from hand to in-play.
 * @returns A fresh pre-plan with `revision` incremented, or `null`.
 */
export function speculativePlay(prePlan: PrePlan, cardExtId: CardExtId): PrePlan | null {
  if (prePlan.status !== 'active') {
    // why: null-return signals non-active status without throwing
    return null;
  }
  const { hand, inPlay } = prePlan.sandboxState;
  const index = hand.indexOf(cardExtId);
  if (index === -1) {
    return null;
  }
  const newHand = [...hand.slice(0, index), ...hand.slice(index + 1)];
  const newInPlay = [...inPlay, cardExtId];
  return {
    ...prePlan,
    revision: prePlan.revision + 1,
    sandboxState: {
      hand: newHand,
      deck: [...prePlan.sandboxState.deck],
      discard: [...prePlan.sandboxState.discard],
      inPlay: newInPlay,
      counters: { ...prePlan.sandboxState.counters },
    },
    revealLedger: [...prePlan.revealLedger],
    planSteps: [...prePlan.planSteps],
  };
}

/**
 * Speculatively adjust a named counter by a delta.
 *
 * Returns `null` when the pre-plan is not active. If the named counter
 * does not yet exist it is treated as zero before the delta is applied.
 * The counters object on the returned pre-plan is a fresh copy; the input
 * counters are never mutated.
 *
 * @param prePlan - The pre-plan to mutate speculatively.
 * @param counterName - The counter key to adjust.
 * @param delta - The signed integer delta to add.
 * @returns A fresh pre-plan with `revision` incremented, or `null`.
 */
export function updateSpeculativeCounter(
  prePlan: PrePlan,
  counterName: string,
  delta: number,
): PrePlan | null {
  if (prePlan.status !== 'active') {
    // why: null-return signals non-active status without throwing
    return null;
  }
  const { counters } = prePlan.sandboxState;
  const currentValue = counters[counterName] ?? 0;
  const newCounters = { ...counters, [counterName]: currentValue + delta };
  return {
    ...prePlan,
    revision: prePlan.revision + 1,
    sandboxState: {
      hand: [...prePlan.sandboxState.hand],
      deck: [...prePlan.sandboxState.deck],
      discard: [...prePlan.sandboxState.discard],
      inPlay: [...prePlan.sandboxState.inPlay],
      counters: newCounters,
    },
    revealLedger: [...prePlan.revealLedger],
    planSteps: [...prePlan.planSteps],
  };
}

/**
 * Append an advisory plan step to the pre-plan.
 *
 * Returns `null` when the pre-plan is not active. The caller supplies the
 * step's intent / target / description fields; `isValid` is always set to
 * `true` at creation time — per-step invalidation is out of scope for
 * WP-057.
 *
 * @param prePlan - The pre-plan to append to.
 * @param step - The step fields excluding `isValid`.
 * @returns A fresh pre-plan with `revision` incremented, or `null`.
 */
export function addPlanStep(
  prePlan: PrePlan,
  step: Omit<PrePlanStep, 'isValid'>,
): PrePlan | null {
  if (prePlan.status !== 'active') {
    // why: null-return signals non-active status without throwing
    return null;
  }
  // why: plan-step validity is advisory and never flipped in WP-057;
  // per-step invalidation is WP-058 scope
  const newStep: PrePlanStep = { ...step, isValid: true };
  return {
    ...prePlan,
    revision: prePlan.revision + 1,
    sandboxState: {
      hand: [...prePlan.sandboxState.hand],
      deck: [...prePlan.sandboxState.deck],
      discard: [...prePlan.sandboxState.discard],
      inPlay: [...prePlan.sandboxState.inPlay],
      counters: { ...prePlan.sandboxState.counters },
    },
    revealLedger: [...prePlan.revealLedger],
    planSteps: [...prePlan.planSteps, newStep],
  };
}

/**
 * Speculatively draw a card from a shared source (officer stack, sidekick
 * stack, HQ, or other caller-supplied source).
 *
 * Returns `null` when the pre-plan is not active. On success the card is
 * appended to the sandbox hand and a `RevealRecord` with the caller-
 * supplied source is appended to the reveal ledger with a monotonically-
 * increasing `revealIndex`.
 *
 * @param prePlan - The pre-plan to mutate speculatively.
 * @param source - The `RevealRecord.source` label to record.
 * @param cardExtId - The revealed card.
 * @returns A fresh pre-plan with `revision` incremented, or `null`.
 */
export function speculativeSharedDraw(
  prePlan: PrePlan,
  source: RevealRecord['source'],
  cardExtId: CardExtId,
): PrePlan | null {
  if (prePlan.status !== 'active') {
    // why: null-return signals non-active status without throwing
    return null;
  }
  const newHand = [...prePlan.sandboxState.hand, cardExtId];
  const newLedgerEntry: RevealRecord = {
    source,
    cardExtId,
    revealIndex: prePlan.revealLedger.length,
  };
  return {
    ...prePlan,
    revision: prePlan.revision + 1,
    sandboxState: {
      hand: newHand,
      deck: [...prePlan.sandboxState.deck],
      discard: [...prePlan.sandboxState.discard],
      inPlay: [...prePlan.sandboxState.inPlay],
      counters: { ...prePlan.sandboxState.counters },
    },
    revealLedger: [...prePlan.revealLedger, newLedgerEntry],
    planSteps: [...prePlan.planSteps],
  };
}
