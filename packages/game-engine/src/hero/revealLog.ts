import type { CardExtId } from '../state/zones.types.js';
import type { UICardDisplay } from '../ui/uiState.types.js';
import type {
  RevealPredicate,
  RevealAction,
  RevealActionKind,
} from '../rules/revealRule.js';
import { formatCardRef } from '../log/logDisplay.js';

/**
 * Pure game-log formatting for reveal / "What If…?" outcomes (WP-325).
 *
 * The reveal pipeline (`heroEffects.execute.ts` `applyRevealRules`) peeks the deck
 * top, tests a predicate against the card's cost, and applies the matched rule's
 * actions — and previously logged nothing, so a player could not tell whether a
 * conditional ("What If…?") effect fired. These helpers turn a reveal into one
 * human-readable line naming the revealed card (via `formatCardRef`), its cost, the
 * predicate outcome, and the action.
 *
 * Pure: no `boardgame.io` import, no I/O, and no `G` reach-through — callers pass
 * `G.cardDisplayData` and the predicate/outcome data in.
 */

/** The card-display snapshot shape as stored on `G.cardDisplayData`. */
type CardDisplayData = Readonly<Record<CardExtId, UICardDisplay>>;

/** The composed outcome of one reveal: whether any branch matched, and its text. */
export interface RevealOutcome {
  /** Whether at least one reveal rule's predicate matched the peeked card. */
  matched: boolean;
  /** The first matched predicate's text (present only when `matched`). */
  predicateText?: string;
  /** The matched rules' action phrases, comma-joined (present only when `matched`). */
  actionsText?: string;
  /**
   * The matched actions that did NOT realize their mutation, comma-joined
   * (WP-417 / D-24237). Absent when everything the branch claimed actually
   * happened — which is the common case.
   */
  unappliedActionsText?: string;
}

/**
 * Renders a reveal predicate to human-readable text.
 *
 * @param predicate The reveal predicate to describe.
 * @returns A short phrase, e.g. `"cost ≤ 3"` or `"always"`.
 */
export function describeRevealPredicate(predicate: RevealPredicate): string {
  if (predicate.kind === 'always') {
    return 'always';
  }
  if (predicate.kind === 'cost-zero') {
    return 'cost is 0';
  }
  if (predicate.kind === 'cost-odd') {
    return 'cost is odd';
  }
  if (predicate.kind === 'cost-lte') {
    // why: a threshold of 0 is legitimate (reveal M=0), so test undefined explicitly
    // rather than a falsy fallback — mirrors revealPredicateMatches.
    return predicate.threshold === undefined
      ? 'cost ≤ (no threshold)'
      : `cost ≤ ${predicate.threshold}`;
  }
  if (predicate.kind === 'cost-gte') {
    return predicate.threshold === undefined
      ? 'cost ≥ (no threshold)'
      : `cost ≥ ${predicate.threshold}`;
  }
  return `an unrecognized predicate (${String(predicate.kind)})`;
}

/**
 * Renders one reveal action kind to a human-readable outcome phrase.
 *
 * @param kind The reveal action kind.
 * @returns A short phrase, e.g. `"drew it"`.
 */
function describeRevealActionKind(kind: RevealActionKind): string {
  if (kind === 'draw') {
    return 'drew it';
  }
  if (kind === 'ko') {
    return "KO'd it";
  }
  if (kind === 'attack-by-cost' || kind === 'attack-fixed') {
    return 'gained attack';
  }
  if (kind === 'choose-discard-or-return') {
    return 'queued a choice';
  }
  return 'applied an unrecognized action';
}

/**
 * Renders a matched rule's actions to a comma-joined phrase.
 *
 * @param actions The matched rule's actions, in order.
 * @returns The joined phrase, e.g. `"gained attack, queued a choice"`.
 */
export function describeRevealActions(actions: readonly RevealAction[]): string {
  const phrases: string[] = [];
  for (const action of actions) {
    phrases.push(describeRevealActionKind(action.kind));
  }
  return phrases.join(', ');
}

/**
 * Renders one reveal action kind as the THING it was supposed to do, for the
 * WP-417 "matched but did not apply" clause.
 *
 * @param kind The reveal action kind.
 * @returns A short noun phrase, e.g. `"the draw"`.
 */
function describeUnappliedRevealActionKind(kind: RevealActionKind): string {
  if (kind === 'draw') {
    return 'the draw';
  }
  if (kind === 'ko') {
    return 'the KO';
  }
  if (kind === 'attack-by-cost' || kind === 'attack-fixed') {
    return 'the attack grant';
  }
  if (kind === 'choose-discard-or-return') {
    return 'the choice';
  }
  return 'an unrecognized action';
}

/**
 * Renders the matched actions that failed to realize their mutation.
 *
 * WP-417 / D-24237 — `describeRevealActions` states what the matched branch
 * CLAIMED ("drew it"); this states what of it did not actually happen, so a
 * guard-blocked action (an empty deck, a missing turnEconomy) is no longer
 * reported to the player as a success.
 *
 * @param kinds The matched action kinds that returned "did not apply", in order.
 * @returns The joined phrase, e.g. `"the KO"`, or an empty string when none failed.
 */
export function describeUnappliedRevealActions(
  kinds: readonly RevealActionKind[],
): string {
  const phrases: string[] = [];
  for (const kind of kinds) {
    phrases.push(describeUnappliedRevealActionKind(kind));
  }
  return phrases.join(', ');
}

/**
 * Builds the reveal-outcome game-log line for one peeked card.
 *
 * @param cardDisplayData The `G.cardDisplayData` snapshot, or undefined.
 * @param playerID The revealing player's id.
 * @param revealedCardId The peeked deck-top card's ext-id.
 * @param cost The peeked card's cost (the predicate input).
 * @param outcome The composed reveal outcome (matched + predicate/action text).
 * @returns The formatted line.
 */
export function formatRevealOutcomeLine(
  cardDisplayData: CardDisplayData | undefined,
  playerID: string,
  revealedCardId: CardExtId,
  cost: number,
  outcome: RevealOutcome,
): string {
  const cardRef = formatCardRef(cardDisplayData, revealedCardId);
  if (!outcome.matched) {
    return `Player ${playerID} revealed ${cardRef} (cost ${cost}) — no branch matched (left on top).`;
  }
  // why: WP-417 / D-24237 — a matched branch whose action was guard-blocked used to
  // print the success phrase anyway ("drew it" with nothing drawn). Name the gap.
  if (outcome.unappliedActionsText !== undefined && outcome.unappliedActionsText.length > 0) {
    return `Player ${playerID} revealed ${cardRef} (cost ${cost}) — ${outcome.predicateText} matched: ${outcome.actionsText}, but ${outcome.unappliedActionsText} could not be applied.`;
  }
  return `Player ${playerID} revealed ${cardRef} (cost ${cost}) — ${outcome.predicateText} matched: ${outcome.actionsText}.`;
}
