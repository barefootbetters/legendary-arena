import type { PrePlan } from './preplan.types.js';

/**
 * Canonical readonly array of every value in `PrePlan['status']`.
 *
 * Paired with the closed-union type on `PrePlan.status` and validated by
 * both a compile-time exhaustive check in this file and a runtime drift
 * test in `preplanStatus.test.ts`. Any edit to the union must be
 * accompanied by a matching edit to this array, and vice versa.
 */
// why: canonical readonly array paired with PrePlan.status closed union;
// drift-detection test enforces parity at build time (deferred from
// WP-056 per EC-056 Locked Value line 32; first runtime consumer is
// WP-057 §C speculative operation status guards)
export const PREPLAN_STATUS_VALUES = ['active', 'invalidated', 'consumed'] as const;

/** Derived union type matching `PrePlan['status']` exactly. */
export type PrePlanStatusValue = typeof PREPLAN_STATUS_VALUES[number];

/**
 * Compile-time proof that `PREPLAN_STATUS_VALUES` and `PrePlan['status']`
 * describe the same set. If either side gains or drops a value without
 * the other, this assignment will fail to typecheck.
 */
type _StatusDriftCheck = PrePlanStatusValue extends PrePlan['status']
  ? PrePlan['status'] extends PrePlanStatusValue
    ? true
    : never
  : never;
const _statusDriftProof: _StatusDriftCheck = true;
void _statusDriftProof;
