import type { CardExtId } from '@legendary-arena/game-engine';
import type { PrePlan } from './preplan.types.js';

// why: PS-3 consolidation — the four public types that describe the
// disruption pipeline (input mutation, output notification, output source
// restoration, output envelope) live here together so that callers import
// a single module for the entire public surface. disruptionPipeline.ts
// re-imports every type via `import type` rather than re-declaring any
// of them, preventing shape drift between detection, invalidation, and
// notification phases.

/**
 * A player-affecting mutation produced by the real game engine.
 *
 * Non-authoritative input: the caller (an integration adapter between the
 * authoritative engine and the pre-planning layer) derives this shape from
 * the authoritative state transition that just occurred. The pre-planning
 * layer never constructs one on its own and never inspects authoritative
 * state to reconstruct one.
 *
 * Binary per-player semantics (DESIGN-CONSTRAINT #4): detection keys on
 * `affectedPlayerId` only. The pre-planning layer never inspects plan
 * steps or sandbox contents to decide whether a mutation disrupts a plan.
 */
export type PlayerAffectingMutation = {
  /** The player whose action caused the disruption. */
  sourcePlayerId: string;

  /** The player whose pre-plan may be disrupted. */
  affectedPlayerId: string;

  /**
   * Machine-stable category of the disruptive effect.
   *
   * Paired with the canonical readonly array `PREPLAN_EFFECT_TYPES` in
   * `preplanEffectTypes.ts`. The closed union matches
   * `PrePlan.invalidationReason.effectType` exactly; a compile-time
   * drift-check proof in `preplanEffectTypes.ts` enforces parity.
   */
  effectType: 'discard' | 'ko' | 'gain' | 'other';

  /** Human-readable description of the disruptive effect. */
  effectDescription: string;

  /** The card involved in the disruption, if any. */
  affectedCardExtId?: CardExtId;
};

/**
 * Structured notification produced when a pre-plan is invalidated.
 *
 * Carries enough causal metadata for the affected player to understand
 * what happened without inspecting authoritative engine state
 * (DESIGN-CONSTRAINT #11 understandable failures,
 * DESIGN-CONSTRAINT #12 structured notification payload).
 */
export type DisruptionNotification = {
  /** Identifier of the pre-plan that was invalidated. */
  prePlanId: string;

  /** The player whose pre-plan was invalidated. */
  affectedPlayerId: string;

  /** The player whose action caused the disruption. */
  sourcePlayerId: string;

  /** Human-readable summary suitable for direct display. */
  message: string;

  /** The card involved in the disruption, if any. */
  affectedCardExtId?: CardExtId;
};

/**
 * Instructions for returning speculatively-revealed cards to their real
 * sources after a pre-plan is discarded.
 *
 * The pre-planning layer produces instructions only; the caller (an
 * integration adapter) is responsible for executing the returns against
 * authoritative engine state. Derived exclusively from
 * `PrePlan.revealLedger` per DESIGN-CONSTRAINT #3 (reveal ledger is the
 * sole authority for deterministic rewind).
 *
 * Partitioning semantics: a `RevealRecord` with `source === 'player-deck'`
 * contributes to `playerDeckReturns`; every other source value (open union
 * per `RevealRecord.source`) contributes to
 * `sharedSourceReturns[sourceValue]`, lazily initialized to `[]` on first
 * encounter.
 */
export type SourceRestoration = {
  /** Cards to return to the affected player's own deck, in ledger order. */
  playerDeckReturns: CardExtId[];

  /**
   * Cards to return to non-player-deck sources, keyed by the open-union
   * `RevealRecord.source` value. Ledger order is preserved within each key.
   */
  sharedSourceReturns: Record<string, CardExtId[]>;
};

/**
 * The full output envelope of `executeDisruptionPipeline`.
 *
 * Returned only when invalidation succeeded (i.e., the pre-plan was
 * `'active'` before the pipeline ran). Otherwise the pipeline returns
 * `null` — the null-on-inactive convention carries from WP-057 RS-8.
 */
export type DisruptionPipelineResult = {
  /** The invalidated pre-plan, with fresh nested copies for every field. */
  invalidatedPlan: PrePlan;

  /** Instructions for returning speculatively-revealed cards. */
  sourceRestoration: SourceRestoration;

  /** Structured causal notification for the affected player. */
  notification: DisruptionNotification;

  // why: requiresImmediateNotification is typed as literal `true` (not
  // `boolean`) to encode Constraint #7 (immediate notification) in the
  // type system. Callers check this field to confirm they are handling
  // the notification requirement. Removing the field would delete a
  // type-level enforcement mechanism — the notification requirement
  // would then live only in prose. Do not "clean up" this field as
  // redundant data (Copilot Issue 15).
  requiresImmediateNotification: true;
};
