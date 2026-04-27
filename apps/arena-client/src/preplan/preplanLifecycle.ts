/**
 * Pure lifecycle adapters between the `@legendary-arena/preplan` runtime
 * and the client-local `usePreplanStore()`.
 *
 * Two named exports, both runtime functions:
 *   - `startPrePlanForActiveViewer` — wraps `createPrePlan` (WP-057) and
 *     installs the result into the store via `store.startPlan(plan)`.
 *   - `applyDisruptionToStore` — single named integration seam between
 *     future mutation-detection middleware (WP-090 follow-up) and the
 *     store's `recordDisruption` action.
 *
 * No type exports. The v1 `PrePlanContext` shape was dropped after
 * pre-flight CV-1 verified that `createPrePlan`'s actual signature takes
 * three positional scalars (snapshot, prePlanId, prngSeed) — not a context
 * object. The §D compile-time drift sentinel locks that signature.
 */

import {
  createPrePlan,
  type DisruptionPipelineResult,
  type PlayerStateSnapshot,
} from '@legendary-arena/preplan';
import type { usePreplanStore } from '../stores/preplan';

/**
 * Build a fresh pre-plan from a viewer snapshot and install it in the store.
 *
 * The function reads no engine state (`G` / `ctx` are not referenced) and
 * performs no I/O. It is pure given its inputs and the store reference.
 * Errors propagate from `createPrePlan` (none currently expected) and
 * from `store.startPlan` (when an active plan is already installed).
 *
 * @param args.snapshot   Player-visible state to mirror into the sandbox.
 * @param args.prePlanId  Caller-supplied identifier for this pre-plan.
 * @param args.prngSeed   Seed for the speculative deck shuffle.
 * @param args.store      The Pinia store instance to install the plan into.
 */
// why: prePlanId and prngSeed are passed through from the caller
// because createPrePlan takes them as positional parameters
// (preplanSandbox.ts:37-41). This adapter is a one-line wrapper
// that names the call site and routes the result into the store;
// it does not generate either value itself. Future middleware
// (WP-090 follow-up) is responsible for choosing the seed source
// and the prePlanId convention.
export function startPrePlanForActiveViewer(args: {
  snapshot: PlayerStateSnapshot;
  prePlanId: string;
  prngSeed: number;
  store: ReturnType<typeof usePreplanStore>;
}): void {
  const plan = createPrePlan(args.snapshot, args.prePlanId, args.prngSeed);
  args.store.startPlan(plan);
}

/**
 * Forward a `DisruptionPipelineResult` into the store.
 *
 * @param args.store  The Pinia store instance to apply the result to.
 * @param args.result The result envelope produced by future middleware.
 */
// why: this adapter is the single named integration seam
// between mutation detection (future middleware) and the
// preplan store. The body is intentionally trivial — the
// value is the name, not the behavior. Keeping it thin
// preserves testability and freezes the call surface before
// WP-090 lands so middleware can be written against a stable
// function identifier. See DESIGN-PREPLANNING §11
// "Notification delivery timing".
export function applyDisruptionToStore(args: {
  store: ReturnType<typeof usePreplanStore>;
  result: DisruptionPipelineResult;
}): void {
  args.store.recordDisruption(args.result);
}
