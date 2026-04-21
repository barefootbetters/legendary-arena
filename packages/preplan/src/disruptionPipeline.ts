import type { CardExtId } from '@legendary-arena/game-engine';
import type { PrePlan, RevealRecord } from './preplan.types.js';
import type {
  PlayerAffectingMutation,
  DisruptionNotification,
  SourceRestoration,
  DisruptionPipelineResult,
} from './disruption.types.js';

/**
 * Invalidate an active pre-plan in response to a player-affecting mutation.
 *
 * Returns a fresh pre-plan with `status: 'invalidated'` and a populated
 * `invalidationReason`. Returns `null` when the pre-plan is not currently
 * active — the null-on-inactive convention carries from WP-057 RS-8.
 *
 * The returned pre-plan carries fresh copies for every field of
 * `sandboxState` plus `revealLedger` and `planSteps`, even though
 * invalidation does not semantically change those three pieces of state.
 * This full-spread 42/42 discipline prevents callers from mutating the
 * input pre-plan through aliased references on the output envelope
 * (WP-028 aliasing precedent; WP-057 post-mortem §6 pattern).
 *
 * `revision` is deliberately NOT incremented — status and
 * `invalidationReason` are not revision-bumping fields per
 * `preplan.types.ts:36-38`. The top-level `...prePlan` spread carries
 * `revision` through unchanged.
 *
 * @param prePlan - The pre-plan to invalidate.
 * @param mutation - The authoritative mutation driving the invalidation.
 * @returns A fresh `PrePlan` in the `'invalidated'` state, or `null` when
 *   the pre-plan is not active.
 */
export function invalidatePrePlan(
  prePlan: PrePlan,
  mutation: PlayerAffectingMutation,
): PrePlan | null {
  if (prePlan.status !== 'active') {
    // why: null-return signals non-active status without throwing. First-
    // mutation-wins semantics for multiple mutations per move (WP-058
    // §Architectural Placement lines 120-125) is enforced mechanically
    // here — a second caller receives a plan whose status is already
    // 'invalidated' and short-circuits to null. No caller dedup logic.
    return null;
  }

  // why: exactOptionalPropertyTypes forbids explicit undefined
  // assignment on an optional field (packages/preplan/tsconfig.json:8).
  // Build invalidationReason without affectedCardExtId, then assign in
  // an if-block only when mutation.affectedCardExtId is defined
  // (session-context-wp058 Lesson 1; D-2901 preserveHandCards precedent).
  const invalidationReason: NonNullable<PrePlan['invalidationReason']> = {
    sourcePlayerId: mutation.sourcePlayerId,
    effectType: mutation.effectType,
    effectDescription: mutation.effectDescription,
  };
  if (mutation.affectedCardExtId !== undefined) {
    invalidationReason.affectedCardExtId = mutation.affectedCardExtId;
  }

  // why: fresh copies for every sandboxState field + revealLedger +
  // planSteps. Invalidation does not semantically change these three
  // fields, but returning them by reference would let a consumer mutate
  // the input PrePlan through the output envelope (WP-028 aliasing
  // precedent; WP-057 post-mortem §6 42/42 pattern). Standard JSON-
  // equality tests cannot detect aliasing — post-mortem §6 trace is
  // the backstop.
  return {
    ...prePlan,
    status: 'invalidated',
    invalidationReason,
    sandboxState: {
      hand: [...prePlan.sandboxState.hand],
      deck: [...prePlan.sandboxState.deck],
      discard: [...prePlan.sandboxState.discard],
      inPlay: [...prePlan.sandboxState.inPlay],
      counters: { ...prePlan.sandboxState.counters },
    },
    revealLedger: [...prePlan.revealLedger],
    planSteps: [...prePlan.planSteps],
  };
}

/**
 * Compute source-restoration instructions from a reveal ledger.
 *
 * Partitions ledger entries into two buckets:
 *   - `record.source === 'player-deck'` → appended to `playerDeckReturns`.
 *   - Any other source value → appended to `sharedSourceReturns[source]`,
 *     lazily initialized to `[]` on first encounter.
 *
 * Iteration order preserves the ledger's insertion order within each
 * bucket. Empty ledger produces empty buckets (never throws).
 *
 * Never reads `PrePlan.sandboxState` — DESIGN-CONSTRAINT #3 requires that
 * the reveal ledger be the sole authority for rewind.
 *
 * @param revealLedger - The reveal ledger of the pre-plan being discarded.
 * @returns Restoration instructions for the caller to execute against
 *   authoritative engine state.
 */
export function computeSourceRestoration(
  revealLedger: readonly RevealRecord[],
): SourceRestoration {
  const playerDeckReturns: CardExtId[] = [];
  const sharedSourceReturns: Record<string, CardExtId[]> = {};

  // why: reveal ledger is the sole authority for deterministic rewind
  // (DESIGN-CONSTRAINT #3, preplan.types.ts:162-168). This loop reads
  // only revealLedger; sandboxState is not inspected anywhere in this
  // function. Any rewind logic that reads sandboxState is invalid —
  // a future refactor that does so fails the ledger-sole test
  // (Copilot Issue 11 FIX).
  for (const record of revealLedger) {
    if (record.source === 'player-deck') {
      playerDeckReturns.push(record.cardExtId);
    } else {
      if (!sharedSourceReturns[record.source]) {
        sharedSourceReturns[record.source] = [];
      }
      (sharedSourceReturns[record.source] as CardExtId[]).push(record.cardExtId);
    }
  }

  return { playerDeckReturns, sharedSourceReturns };
}

/**
 * Build the human-readable summary string for a disruption notification.
 *
 * Internal helper — not exported. Appends the affected card identifier
 * in parentheses when the mutation carries one, otherwise terminates
 * with a plain period.
 *
 * @param mutation - The mutation driving the notification.
 * @returns A single display-ready sentence.
 */
function buildNotificationMessage(mutation: PlayerAffectingMutation): string {
  const base = `Player ${mutation.sourcePlayerId}'s ${mutation.effectDescription}`;
  if (mutation.affectedCardExtId !== undefined) {
    return `${base} (${mutation.affectedCardExtId}).`;
  }
  return `${base}.`;
}

/**
 * Build a structured causal notification for an already-invalidated plan.
 *
 * Throws when the supplied plan is not in the `'invalidated'` state — the
 * sole programming-error throw in this package. Every other failure path
 * in WP-058 returns `null` or `false`.
 *
 * @param invalidatedPlan - A pre-plan whose `status` is `'invalidated'`.
 * @param mutation - The mutation that drove the invalidation.
 * @returns A `DisruptionNotification` populated from the plan identity
 *   and the mutation metadata.
 * @throws Error when `invalidatedPlan.status !== 'invalidated'`. Reserved
 *   for caller misuse; `executeDisruptionPipeline` is the only expected
 *   caller and always passes an invalidated plan.
 */
export function buildDisruptionNotification(
  invalidatedPlan: PrePlan,
  mutation: PlayerAffectingMutation,
): DisruptionNotification {
  if (invalidatedPlan.status !== 'invalidated') {
    // why: programming-error throw — executeDisruptionPipeline is the
    // only expected caller and always passes an invalidated plan. Any
    // other caller is misusing the API. WP-057 convention: throws
    // reserved for programming errors, null returns for expected failure
    // paths. Session-context-wp058 Lesson 2.
    throw new Error(
      `Cannot build notification for PrePlan ${invalidatedPlan.prePlanId}: status is '${invalidatedPlan.status}', expected 'invalidated'.`,
    );
  }

  // why: exactOptionalPropertyTypes forbids explicit undefined
  // assignment (same rationale as invalidatePrePlan). Build the base
  // notification without affectedCardExtId, assign in an if-block
  // only when mutation.affectedCardExtId is defined.
  const notification: DisruptionNotification = {
    prePlanId: invalidatedPlan.prePlanId,
    affectedPlayerId: invalidatedPlan.playerId,
    sourcePlayerId: mutation.sourcePlayerId,
    message: buildNotificationMessage(mutation),
  };
  if (mutation.affectedCardExtId !== undefined) {
    notification.affectedCardExtId = mutation.affectedCardExtId;
  }
  return notification;
}

/**
 * Run the full disruption pipeline: detect-less invalidation, source
 * restoration derivation, and causal notification construction.
 *
 * The caller is expected to have already decided (via `isPrePlanDisrupted`)
 * that this pre-plan should be invalidated. This function still returns
 * `null` when the plan is not active — the detection layer and the
 * pipeline layer enforce the same null-on-inactive semantics, which
 * mechanically implements first-mutation-wins for repeated calls with
 * the same mutation.
 *
 * @param prePlan - The pre-plan to invalidate and tear down.
 * @param mutation - The authoritative mutation driving the pipeline.
 * @returns A full `DisruptionPipelineResult` on success; `null` when the
 *   pre-plan is not active.
 */
export function executeDisruptionPipeline(
  prePlan: PrePlan,
  mutation: PlayerAffectingMutation,
): DisruptionPipelineResult | null {
  const invalidatedPlan = invalidatePrePlan(prePlan, mutation);
  if (invalidatedPlan === null) return null;

  // why: invalidation does not mutate the ledger; reading from the
  // pre-invalidation plan is equivalent to reading from invalidatedPlan
  // and avoids coupling to invalidatePrePlan's spread-copy semantics
  // (pre-flight RS-8).
  const sourceRestoration = computeSourceRestoration(prePlan.revealLedger);
  const notification = buildDisruptionNotification(invalidatedPlan, mutation);

  return {
    invalidatedPlan,
    sourceRestoration,
    notification,
    requiresImmediateNotification: true,
  };
}
