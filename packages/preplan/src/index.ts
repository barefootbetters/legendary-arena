// why: WP-056 shipped this surface as type-only re-exports; WP-057 (first
// runtime consumer of the pre-plan contract) adds runtime exports for
// speculative operations. Authorized by EC-057 RS-2.
// WP-058 (first runtime consumer of the invalidationReason.effectType
// union + first implementation of DESIGN-CONSTRAINT #3 ledger-sole
// rewind) extends the runtime surface additively. WP-056 + WP-057 export
// blocks are unchanged.

// Types (WP-056)
export type {
  PrePlan,
  PrePlanSandboxState,
  RevealRecord,
  PrePlanStep,
} from './preplan.types.js';

// Canonical status array + derived type (WP-057, PS-2)
export { PREPLAN_STATUS_VALUES } from './preplanStatus.js';
export type { PrePlanStatusValue } from './preplanStatus.js';

// Sandbox creation (WP-057)
export type { PlayerStateSnapshot } from './preplanSandbox.js';
export { createPrePlan, computeStateFingerprint } from './preplanSandbox.js';

// Speculative operations (WP-057)
export {
  speculativeDraw,
  speculativePlay,
  updateSpeculativeCounter,
  addPlanStep,
  speculativeSharedDraw,
} from './speculativeOperations.js';

// PRNG (WP-057)
export {
  createSpeculativePrng,
  speculativeShuffle,
  generateSpeculativeSeed,
} from './speculativePrng.js';

// Disruption types (WP-058)
export type {
  PlayerAffectingMutation,
  DisruptionNotification,
  SourceRestoration,
  DisruptionPipelineResult,
} from './disruption.types.js';

// Disruption detection (WP-058)
export { isPrePlanDisrupted } from './disruptionDetection.js';

// Disruption pipeline (WP-058)
export {
  invalidatePrePlan,
  computeSourceRestoration,
  buildDisruptionNotification,
  executeDisruptionPipeline,
} from './disruptionPipeline.js';

// Canonical effect-type array + derived type (WP-058, PS-2)
export { PREPLAN_EFFECT_TYPES } from './preplanEffectTypes.js';
export type { PrePlanEffectType } from './preplanEffectTypes.js';
