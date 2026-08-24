/**
 * Endgame AI Coach — Model Routing Shim (coach model-independence)
 *
 * The coach's model-routing layer. It owns the two things that were previously
 * hardcoded in the feature client and the server wiring: WHICH model the coach
 * calls, and the PER-MODEL request quirks that model needs (its extended-thinking
 * directive and output-token cap). Pulling them here is the coach's realization of
 * the AI Second Brain "Model Independence" rule — replace the model with a config
 * change, not a code edit, and keep model-specific behaviour at the routing layer
 * instead of baked into `coachClient.ts`.
 *
 * Swapping the coach's model is now setting `COACH_MODEL` in the environment. A
 * model with no quirk row uses the safe default profile (no thinking directive,
 * the standard bounded-report cap); a model that needs its own quirks gets one row
 * added below and never re-inherits another model's workaround.
 *
 * Layer/boundary: server layer only — imports nothing from `boardgame.io`, the
 * engine, the registry, or any UI package.
 *
 * Design record: the ewiki "AI Second Brain" page, "Gateway routing for the
 * endgame coach" decision sketch (Option B — the in-server shim). The Sonnet-5
 * disabled-thinking quirk this file now owns is the EC-629 hotfix.
 */

/**
 * The Messages-API `thinking` directive a model needs. Omitted (undefined) on a
 * model's quirks means send no directive and let the model use its own default.
 */
export type CoachThinkingDirective = { type: 'disabled' } | { type: 'adaptive' };

/**
 * The per-model request quirks the coach applies. These are model-specific
 * Messages-API knobs, kept here so `coachClient.ts` stays model-agnostic.
 */
export interface CoachModelQuirks {
  /** The `thinking` param for this model, or undefined to send none. */
  readonly thinking?: CoachThinkingDirective;
  /** The `max_tokens` cap for the bounded coach report. */
  readonly maxOutputTokens: number;
}

/** A resolved coach model id plus the quirks to apply when calling it. */
export interface CoachModelConfig {
  readonly model: string;
  readonly quirks: CoachModelQuirks;
}

/**
 * The model the coach calls when `COACH_MODEL` is unset. Kept as the shipped
 * Sonnet 5, so behaviour is unchanged unless an operator deliberately swaps it.
 */
export const DEFAULT_COACH_MODEL = 'claude-sonnet-5';

// why: the bounded report (headline + two paragraphs + 2-3 tips) fits well under
// this cap; it is the same value the coach shipped with, now owned per-model here.
const BOUNDED_REPORT_MAX_OUTPUT_TOKENS = 2048;

/**
 * Per-model quirk registry. One row per model that needs model-specific request
 * config; a model absent from this map uses `DEFAULT_COACH_MODEL_QUIRKS`.
 */
const COACH_MODEL_QUIRKS_BY_MODEL: Record<string, CoachModelQuirks> = {
  // why: Sonnet 5 runs adaptive extended thinking BY DEFAULT and those thinking
  // tokens draw from `max_tokens`; on a full match-analysis prompt the thinking
  // exhausted the budget before any answer text was emitted (an empty text block →
  // `coach_unavailable` on every real call). For a bounded structured-JSON report
  // we disable thinking so the whole budget is the answer (the EC-629 hotfix).
  // This is exactly the model-specific config the routing layer should own, not
  // the feature client — swapping to another model must not re-inherit it.
  'claude-sonnet-5': {
    thinking: { type: 'disabled' },
    maxOutputTokens: BOUNDED_REPORT_MAX_OUTPUT_TOKENS,
  },
};

/**
 * The quirks used for any model without its own row: no thinking directive (use
 * the model's own default) and the standard bounded-report output cap. A new model
 * that needs different handling gets a row in `COACH_MODEL_QUIRKS_BY_MODEL`.
 */
const DEFAULT_COACH_MODEL_QUIRKS: CoachModelQuirks = {
  maxOutputTokens: BOUNDED_REPORT_MAX_OUTPUT_TOKENS,
};

/**
 * Resolve the coach's model + quirks from the environment. Reads `COACH_MODEL`
 * (falling back to `DEFAULT_COACH_MODEL` when unset or empty) and looks up that
 * model's quirks, using the default profile for an unregistered model.
 *
 * @param environment The process environment to read `COACH_MODEL` from.
 * @returns The resolved model id and the quirks to apply when calling it.
 */
export function resolveCoachModelConfig(
  environment: Record<string, string | undefined>,
): CoachModelConfig {
  const configuredModel = environment.COACH_MODEL;
  const model =
    configuredModel === undefined || configuredModel === ''
      ? DEFAULT_COACH_MODEL
      : configuredModel;
  const quirks = COACH_MODEL_QUIRKS_BY_MODEL[model] ?? DEFAULT_COACH_MODEL_QUIRKS;
  return { model, quirks };
}
