// why: WP-056 shipped this surface as type-only re-exports; WP-057 (first
// runtime consumer of the pre-plan contract) adds runtime exports for
// speculative operations. Authorized by EC-057 RS-2.

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
