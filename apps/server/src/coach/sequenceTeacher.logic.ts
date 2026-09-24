/**
 * Play-order sequence teacher (WP-710 / D-24533) — a pure server-layer read over the
 * D-24119 faithful replay.
 *
 * `computeSequenceTips` turns a same-turn SEQUENCING miss into one forward
 * "opportunity" tip per seat: when a seat's Hero card carried a snapshot-gate
 * conditional clause (`heroClassMatch` / `requiresTeam` / `requiresKeyword`) that came
 * up empty, and an UNCONDITIONAL same-class/team/keyword hero was played LATER the same
 * turn, moving that enabler earlier would have assembled the clause at zero cost.
 *
 * Design (see WP-710 / EC-747):
 * - Reorderability is a SET-SATISFIABILITY check over the captured real `inPlay` sets
 *   (`reduceMatchCapturingHeroPlays`) via the engine's pure `heroConditionHoldsForInPlay`
 *   predicate — never a reordered re-simulation (that would diverge on RNG). The engine
 *   stays the sole authority on condition semantics (D-20105); this module re-implements
 *   none of them.
 * - **Net-gain, never net-zero:** the enabler MUST be unconditional (no snapshot-gate
 *   clause of its own), else moving it earlier just moves the whiff to the enabler (a
 *   mutually-enabling pair). A size-changing/copy-powers card makes the predicate return
 *   `unsupported`, and the whiff is skipped (never a wrong tip).
 * - Opportunity voice only — never "whiff" / "failed" / "missed"; at most one tip per seat.
 *
 * No `boardgame.io`, no DB, no I/O. Pure over the captured plays + the reduced final state.
 */

import type { LegendaryGameState, CardExtId, HeroConditionCardData } from '@legendary-arena/game-engine';
import {
  getHooksForCard,
  heroConditionHoldsForInPlay,
  SEQUENCE_GATE_CONDITION_TYPES,
} from '@legendary-arena/game-engine';
import type { CapturedHeroPlay } from '../replay/matchReplay.logic.js';
import { resolveMatchCardName } from './coachSummary.logic.js';

/** A hero condition as read off a hook (structural — `HeroCondition` shape). */
interface HookCondition {
  readonly type: string;
  readonly value: string;
}

/**
 * Whether a card is an UNCONDITIONAL enabler — it carries no on-play hook condition
 * whose type is a snapshot gate (WP-710 / D-24533).
 *
 * why: the net-gain rule. An enabler with its own snapshot-gate clause is one half of a
 * mutually-enabling pair — moving it before the whiffed card merely moves the whiff to
 * it (net-zero). `playedThisTurn` is unproduced by any card parser today, and
 * `firstHeroPlayedThisTurn` is net-safe as an enabler (moving it earlier only helps its
 * own "first Hero" gate), so gating on `SEQUENCE_GATE_CONDITION_TYPES` alone is correct
 * for the current corpus.
 *
 * @param finalState - The reduced final match state (for `heroAbilityHooks`).
 * @param cardId - The candidate enabler card.
 * @returns Whether the card has no snapshot-gate condition.
 */
function isUnconditionalEnabler(finalState: LegendaryGameState, cardId: CardExtId): boolean {
  const hooks = finalState.heroAbilityHooks ? getHooksForCard(finalState.heroAbilityHooks, cardId) : [];
  for (const hook of hooks) {
    for (const condition of (hook.conditions ?? []) as readonly HookCondition[]) {
      if (SEQUENCE_GATE_CONDITION_TYPES.includes(condition.type)) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Builds the opportunity tip string for a teachable reorder (WP-710 / D-24533).
 *
 * why: forward, celebratory-adjacent voice — the copy-lint forbids whiff/failed/error/
 * missed/wasted. Names the enabler and the gated card by display name.
 *
 * @param enablerName - The display name of the enabler to play earlier.
 * @param cardName - The display name of the gated card.
 * @param gate - The failing snapshot-gate condition (its `value` is the class/team/keyword).
 * @returns The tip string.
 */
function formatSequenceTip(enablerName: string, cardName: string, gate: HookCondition): string {
  return `Next time, play ${enablerName} before ${cardName} — you'd have landed its ${gate.value} synergy bonus.`;
}

/**
 * Computes at most one play-order "opportunity" tip per seat (WP-710 / D-24533).
 *
 * For each seat's hero plays in log order, finds the first card whose snapshot-gate
 * clause came up empty at its play position but which an UNCONDITIONAL same-gate hero,
 * played later the same turn, would have assembled — and emits one forward tip.
 *
 * @param heroPlays - The per-play `{ seat, turn, cardId, inPlay }` captured from the replay.
 * @param finalState - The reduced final match state (supplies the setup-static card data).
 * @param resolveCardName - Maps a `CardExtId` to a display name.
 * @returns Zero or more tips (at most one per seat), in seat-first-seen order.
 */
export function computeSequenceTips(
  heroPlays: readonly CapturedHeroPlay[],
  finalState: LegendaryGameState,
  resolveCardName: (cardId: string) => string,
): readonly string[] {
  const cardData: HeroConditionCardData = {
    cardTraits: finalState.cardTraits,
    cardSizeChangingClasses: finalState.cardSizeChangingClasses,
    cardCopiedTeams: finalState.cardCopiedTeams,
    heroAbilityHooks: finalState.heroAbilityHooks,
  };

  // why: group plays by seat, preserving log order, so the "later the same turn" search
  // and the one-tip-per-seat cap are straightforward. for...of, no .reduce().
  const playsBySeat = new Map<string, CapturedHeroPlay[]>();
  for (const play of heroPlays) {
    const existing = playsBySeat.get(play.seat);
    if (existing === undefined) {
      playsBySeat.set(play.seat, [play]);
    } else {
      existing.push(play);
    }
  }

  const tips: string[] = [];
  for (const [, seatPlays] of playsBySeat) {
    const tip = firstTeachableTip(seatPlays, cardData, finalState, resolveCardName);
    if (tip !== null) {
      tips.push(tip);
    }
  }
  return tips;
}

/**
 * Finds the first teachable reorder tip for one seat's plays, or `null` (WP-710).
 *
 * @param seatPlays - The seat's hero plays in log order.
 * @param cardData - The setup-static card-data slice.
 * @param finalState - The reduced final state (for the unconditional-enabler check).
 * @param resolveCardName - Card id → display name.
 * @returns The tip, or `null` when no net-gain reorder exists.
 */
function firstTeachableTip(
  seatPlays: readonly CapturedHeroPlay[],
  cardData: HeroConditionCardData,
  finalState: LegendaryGameState,
  resolveCardName: (cardId: string) => string,
): string | null {
  for (let index = 0; index < seatPlays.length; index++) {
    const played = seatPlays[index]!;
    const hooks = cardData.heroAbilityHooks
      ? getHooksForCard(cardData.heroAbilityHooks, played.cardId)
      : [];
    for (const hook of hooks) {
      for (const condition of (hook.conditions ?? []) as readonly HookCondition[]) {
        if (!SEQUENCE_GATE_CONDITION_TYPES.includes(condition.type)) {
          continue;
        }
        // why: reproduce the real evaluation over the captured pre-play inPlay; only a
        // genuine `fails` (not `unsupported`, not `holds`) is a teachable whiff.
        if (heroConditionHoldsForInPlay(condition, played.cardId, played.inPlay, cardData) !== 'fails') {
          continue;
        }
        const enabler = findUnconditionalEnabler(seatPlays, index, condition, cardData, finalState);
        if (enabler !== null) {
          // why: D-24579 — tip text names the cards as players see them: the
          // per-copy ids resolve through the match's own cardDisplayData first.
          return formatSequenceTip(
            resolveMatchCardName(enabler.cardId, finalState, resolveCardName),
            resolveMatchCardName(played.cardId, finalState, resolveCardName),
            condition,
          );
        }
      }
    }
  }
  return null;
}

/**
 * Finds an UNCONDITIONAL hero played LATER the same turn that satisfies the whiffed gate
 * (WP-710 / D-24533), or `null`.
 *
 * @param seatPlays - The seat's plays in log order.
 * @param whiffedIndex - The index of the whiffed play.
 * @param gate - The failing snapshot-gate condition.
 * @param cardData - The setup-static card-data slice.
 * @param finalState - The reduced final state.
 * @returns The enabling play, or `null`.
 */
function findUnconditionalEnabler(
  seatPlays: readonly CapturedHeroPlay[],
  whiffedIndex: number,
  gate: HookCondition,
  cardData: HeroConditionCardData,
  finalState: LegendaryGameState,
): CapturedHeroPlay | null {
  const whiffed = seatPlays[whiffedIndex]!;
  for (let later = whiffedIndex + 1; later < seatPlays.length; later++) {
    const candidate = seatPlays[later]!;
    // why: same turn only — a reorder cannot cross turn boundaries.
    if (candidate.turn !== whiffed.turn) {
      continue;
    }
    if (!isUnconditionalEnabler(finalState, candidate.cardId)) {
      continue;
    }
    // why: does this single enabler satisfy the whiffed gate for the played card? A
    // size-changing/copy-powers candidate returns `unsupported` here and is skipped.
    if (heroConditionHoldsForInPlay(gate, whiffed.cardId, [candidate.cardId], cardData) === 'holds') {
      return candidate;
    }
  }
  return null;
}
