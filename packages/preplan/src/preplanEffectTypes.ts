import type { PrePlan } from './preplan.types.js';

/**
 * Canonical readonly array of every value in
 * `PrePlan.invalidationReason.effectType`.
 *
 * Paired with the closed-union type declared on
 * `PrePlan.invalidationReason.effectType` and validated by both a compile-
 * time exhaustive check in this file and a runtime drift test in
 * `preplanEffectTypes.test.ts`. Any edit to the union must be accompanied
 * by a matching edit to this array, and vice versa.
 */
// why: canonical readonly array paired with
// PrePlan.invalidationReason.effectType closed union; drift-detection
// test enforces parity at build time (deferred from WP-056 per
// preplan.types.ts:101-106 JSDoc — WP-058 is the first runtime
// consumer of the effectType union).
export const PREPLAN_EFFECT_TYPES = ['discard', 'ko', 'gain', 'other'] as const;

/** Derived union type matching `PrePlan.invalidationReason.effectType` exactly. */
export type PrePlanEffectType = typeof PREPLAN_EFFECT_TYPES[number];

/**
 * Compile-time proof that `PREPLAN_EFFECT_TYPES` and the
 * `PrePlan.invalidationReason.effectType` closed union describe the same
 * set. If either side gains or drops a value without the other, this
 * assignment will fail to typecheck.
 *
 * The `NonNullable<>` wrapper is mandatory: `invalidationReason` is
 * optional on `PrePlan`, so a bare indexed access
 * `PrePlan['invalidationReason']['effectType']` would be
 * `undefined`-contaminated and the check would assert the wrong set.
 */
type _EffectTypeDriftCheck = PrePlanEffectType extends
  NonNullable<PrePlan['invalidationReason']>['effectType']
  ? NonNullable<PrePlan['invalidationReason']>['effectType'] extends PrePlanEffectType
    ? true
    : never
  : never;
const _effectTypeDriftProof: _EffectTypeDriftCheck = true;
void _effectTypeDriftProof;
