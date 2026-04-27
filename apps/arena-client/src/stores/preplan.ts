/**
 * Pinia store for client-local pre-planning state.
 *
 * Write invariants (relied on by future middleware, e.g., the
 * disruption detector WP-090 will add):
 *   - `current` is written ONLY by `startPlan`, `consumePlan`,
 *     `recordDisruption`, and `clearPlan`.
 *   - `lastNotification` is written ONLY by `recordDisruption`,
 *     `dismissNotification`, and `clearPlan`.
 *   - External callers route disruption events through
 *     `applyDisruptionToStore` in `preplanLifecycle.ts`, never by
 *     calling `recordDisruption` directly from component code.
 *   - Components never mutate the store; they read through
 *     `storeToRefs` and invoke actions.
 *
 * Notification-overwrite invariant:
 *   - `lastNotification` retains only the most recent disruption.
 *     Earlier notifications are intentionally dropped; disruption
 *     invalidates the viewer's advisory state, so a queue would
 *     present stale causal context. A future WP adds an aria-live
 *     log surface if audit is needed — not a queue.
 */

import { defineStore } from 'pinia';
import type {
  DisruptionNotification,
  DisruptionPipelineResult,
  PrePlan,
} from '@legendary-arena/preplan';

interface PreplanStoreState {
  current: PrePlan | null;
  lastNotification: DisruptionNotification | null;
}

// why: the Pinia Options API shape is used instead of the Setup API because
// this store has a small, fixed surface — matching WP-061's precedent
// (`src/stores/uiState.ts`) keeps the two stores grep-symmetric for future
// maintainers.
export const usePreplanStore = defineStore('preplan', {
  state: (): PreplanStoreState => ({
    current: null,
    lastNotification: null,
  }),
  getters: {
    /**
     * True only when a pre-plan exists and its status is `'active'`.
     * `'consumed'` and `'invalidated'` plans are not active.
     */
    isActive(state): boolean {
      return state.current !== null && state.current.status === 'active';
    },
  },
  actions: {
    /**
     * Install a fresh pre-plan as the current advisory state.
     *
     * Throws when an active plan is already installed — a second active
     * plan is almost certainly a caller bug, not a recoverable condition.
     *
     * @param plan The newly created `PrePlan` to install.
     */
    startPlan(plan: PrePlan): void {
      if (this.current !== null && this.current.status === 'active') {
        // why: throws rather than silently replacing — a second active plan
        // is almost certainly a caller bug. One active plan at a time is the
        // lifecycle invariant from WP-056 + DESIGN-PREPLANNING §11.
        throw new Error(
          'Cannot start a plan while another plan is active; call clearPlan or consumePlan first.',
        );
      }
      this.current = plan;
    },

    /**
     * Mark the current pre-plan as consumed (no-op when not active).
     *
     * Preserves every other field of the pre-plan unchanged. Idempotent
     * on null, already-consumed, and already-invalidated plans.
     */
    consumePlan(): void {
      if (this.current === null || this.current.status !== 'active') {
        return;
      }
      // why: there is no preplan-package helper for the 'consumed'
      // transition — the transition is client-observed and
      // non-authoritative, so we construct a new PrePlan object
      // explicitly. Construction (vs. in-place mutation) preserves
      // JSON serializability and avoids aliasing shared references
      // that may have been captured by components via storeToRefs.
      // revision is preserved (not bumped) — status transitions are
      // not in the revision-bump list per preplan.types.ts:33-46, and
      // invalidatePrePlan deliberately does not bump revision either
      // (disruptionPipeline.ts:24-27). consumePlan matches that
      // convention. The action is idempotent: calling it on a null,
      // already-consumed, or already-invalidated plan is a no-op.
      this.current = {
        ...this.current,
        status: 'consumed',
      };
    },

    /**
     * Apply a disruption pipeline result to the store.
     *
     * Always overwrites `lastNotification`. Replaces `current` with
     * `result.invalidatedPlan` only when `current` is non-null and
     * `current.status === 'active'`.
     *
     * @param result The `DisruptionPipelineResult` produced by the
     *   future live-mutation middleware (WP-090 follow-up). The pipeline
     *   has already invalidated the plan; this action is assignment-only.
     */
    recordDisruption(result: DisruptionPipelineResult): void {
      // why: result.invalidatedPlan is the authoritative invalidated
      // form (disruptionPipeline.ts:42-82 produces fresh nested copies
      // for every field). Reusing it avoids a second invalidatePrePlan
      // call that would either return null or shadow the pipeline's
      // already-correct restoration metadata. The store's job here is
      // assignment, not transformation. Structured restoration
      // (result.sourceRestoration) is intentionally ignored at this
      // layer — restoration application against authoritative engine
      // state is out of scope per §Out of Scope; the future live-
      // mutation middleware (WP-090 follow-up) owns that path.
      this.lastNotification = result.notification;
      if (this.current !== null && this.current.status === 'active') {
        this.current = result.invalidatedPlan;
      }
    },

    /**
     * Clear the most recent disruption notification.
     * Does not touch `current`.
     */
    dismissNotification(): void {
      this.lastNotification = null;
    },

    /**
     * Clear both `current` and `lastNotification`. Used between turns and
     * during plan-replacement flows.
     */
    clearPlan(): void {
      this.current = null;
      this.lastNotification = null;
    },
  },
});
