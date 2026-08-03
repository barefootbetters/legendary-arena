/**
 * Hollow-effect detection contracts for the Legendary Arena game engine
 * (WP-257 / D-24033 + D-24034).
 *
 * A *hollow* effect is a declared card ability whose executable handler is
 * absent or unreachable at runtime. The detector classifies on handler
 * REACHABILITY — never by diffing pre/post `G`. An empty-bystander-supply
 * rescue, a failed `[hc:]`/`[team:]` condition, an empty-deck reveal, and an
 * explicitly-deferred mechanic are all reachable handlers that legitimately
 * no-op; they are NOT hollow.
 *
 * This module is the contract surface only: the reason taxonomy + its
 * drift-protected canonical array, the hollow-reason predicate, the internal
 * per-effect outcome shape both executors build, the serializable runtime
 * record, the `G.diagnostics` channel shape, the bounded-channel cap, and the
 * explicit deferred allowlist. The writer lives in `hollowEffect.record.ts`.
 *
 * No boardgame.io imports. No registry imports. No I/O. Contracts only.
 */

// why: type-only import of the CardExtId string alias (WP-488 / D-24294) so the
// EffectTrace contract names the card ext_id with its canonical type rather than a
// bare `string`. Type-only — erased at compile time, so the "no runtime imports"
// posture of this contracts file is preserved (no cycle, no I/O).
import type { CardExtId } from '../state/zones.types.js';

// ---------------------------------------------------------------------------
// EffectExecutionReason — the per-effect classification taxonomy (D-24033)
// ---------------------------------------------------------------------------

/**
 * Closed canonical union of effect-execution reasons. Answers the one binary
 * question the detector asks: did a declared mechanic reach an executable
 * handler, and if not, why not?
 *
 * Reachable (NOT hollow): `applied`, `handler-noop`, `condition-failed`,
 * `deferred`. Unreachable (hollow): `parse-unrecognized`, `no-handler`,
 * `unsupported-keyword`.
 */
export type EffectExecutionReason =
  | 'applied'
  | 'handler-noop'
  | 'condition-failed'
  | 'deferred'
  | 'no-handler'
  | 'unsupported-keyword'
  | 'parse-unrecognized';

// why: canonical drift array (D-24033) — adding a reason requires updating THIS
// array, the EffectExecutionReason union, AND a DECISIONS.md entry together
// (code-style §Drift Detection), mirroring REVEAL_ACTION_KINDS. The drift test
// in hollowEffect.test.ts pins bidirectional parity. The seven-member order is
// locked: the four reachable reasons first, then the three hollow reasons.
/** All effect-execution reasons in canonical order. Single source of truth. */
export const EFFECT_EXECUTION_REASONS: readonly EffectExecutionReason[] = [
  'applied',
  'handler-noop',
  'condition-failed',
  'deferred',
  'no-handler',
  'unsupported-keyword',
  'parse-unrecognized',
] as const;

/**
 * Returns whether a reason flags the effect as hollow.
 *
 * Exactly three reasons are hollow — `parse-unrecognized`, `no-handler`, and
 * `unsupported-keyword` — all of which mean dispatch could not reach an
 * executable handler. The four reachable reasons (`applied`, `handler-noop`,
 * `condition-failed`, `deferred`) are legitimate implemented outcomes and never
 * flag.
 *
 * @param reason - The per-effect execution reason.
 * @returns Whether the reason indicates a hollow (unreachable-handler) outcome.
 */
export function isHollowReason(reason: EffectExecutionReason): boolean {
  return (
    reason === 'parse-unrecognized' ||
    reason === 'no-handler' ||
    reason === 'unsupported-keyword'
  );
}

// ---------------------------------------------------------------------------
// EffectExecutionOutcome — internal per-effect classification (not in G)
// ---------------------------------------------------------------------------

/**
 * The internal per-effect classification both executors build as they dispatch
 * one declared effect. It is NOT stored in `G` — it is a transient value the
 * executor inspects to decide whether to record a hollow event.
 *
 * `declared` is always true here (an outcome exists only for a declared effect);
 * the field is retained to match the design-spine §4.1 contract shape and to
 * make the "declared but unreachable" question explicit at the call site.
 *
 * @property declared - Whether this came from a declared mechanic (always true).
 * @property mechanic - The declared mechanic label (keyword / primitive / marker).
 * @property timing - The hook timing label (e.g. 'onPlay', 'onAmbush').
 * @property executed - Whether a handler was reached and ran (true for reachable).
 * @property reason - The classification reason.
 */
export interface EffectExecutionOutcome {
  declared: boolean;
  mechanic: string;
  timing: string;
  executed: boolean;
  reason: EffectExecutionReason;
}

// ---------------------------------------------------------------------------
// HollowEffectRecord — the serializable runtime record (the contract; D-24034)
// ---------------------------------------------------------------------------

/**
 * One JSON-serializable record of a declared mechanic that reached no
 * executable handler at runtime. This is the machine-readable contract that
 * tests assert on — the companion `G.messages` line is for operator visibility
 * only and is NOT the contract.
 *
 * Plain `{string, number}` fields only — no functions, Maps, Sets, Dates, or
 * class instances — so the channel stays JSON-serializable and safe to include
 * in the diagnostics export.
 *
 * @property cardId - The card-instance ext_id whose ability was hollow.
 * @property cardType - Whether the source card is a hero, villain, or henchman.
 * @property timing - The hook timing the hollow mechanic was declared at.
 * @property mechanic - The declared mechanic label that reached no handler.
 * @property reason - The hollow reason (one of the three hollow reasons).
 * @property turn - The boardgame.io turn number the record was observed on.
 */
export interface HollowEffectRecord {
  cardId: string;
  cardType: 'hero' | 'villain' | 'henchman';
  timing: string;
  mechanic: string;
  reason: 'parse-unrecognized' | 'no-handler' | 'unsupported-keyword';
  turn: number;
}

// ---------------------------------------------------------------------------
// GameDiagnostics — the runtime-only G.diagnostics channel (D-24034)
// ---------------------------------------------------------------------------

/**
 * The runtime-only diagnostics channel stored at `G.diagnostics`.
 *
 * Bounded by `HOLLOW_EFFECTS_CAP`: once the list reaches the cap,
 * `recordHollowEffect` stops pushing and increments `hollowEffectsDropped`
 * instead — a long match can never grow `G` without limit (mirrors the
 * arena-client diagnostics ring-buffer posture).
 *
 * Runtime-only: never persisted, never snapshotted as a save-game, and NEVER
 * read as gameplay input (no move, rule, or `endIf` may consume it). It is
 * observation, not state.
 *
 * @property hollowEffects - The capped list of observed hollow-effect records.
 * @property hollowEffectsDropped - How many records were dropped after the cap.
 * @property traces - The capped list of per-dispatch effect traces (WP-488 /
 *   D-24294). Optional: `recordHollowEffect` predates this field and inits the
 *   channel WITHOUT it, so a hollow-first dispatch leaves `traces` absent until
 *   the first `recordEffectTrace` seeds it — never seeded in `Game.setup()`.
 * @property tracesDropped - How many traces were dropped after `EFFECT_TRACES_CAP`.
 *   Optional for the same lazy-init reason as `traces`.
 */
export interface GameDiagnostics {
  hollowEffects: HollowEffectRecord[];
  hollowEffectsDropped: number;
  traces?: EffectTrace[];
  tracesDropped?: number;
}

// why: the bound mirrors the arena-client diagnostics ring buffer — large enough
// that a normal match never drops a real hollow event, small enough that a
// pathological match cannot grow G without limit. The exact value is not
// load-bearing for gameplay (the channel is never gameplay input); 256 leaves
// generous headroom over the few-dozen distinct hollow mechanics a match could
// realistically encounter.
/** Maximum number of HollowEffectRecord entries retained in G.diagnostics. */
export const HOLLOW_EFFECTS_CAP = 256;

// why: D-24033 — "deferred = not hollow" holds ONLY for mechanics on this
// explicit allowlist. `wound` and `conditional` have NO handler today (absent
// from HANDLED_KEYWORDS); without this allowlist they would classify as
// `no-handler` → hollow even though they are implemented-as-deferred by design
// (they need targeting UI / game systems not yet built). Listing them here
// classifies them `deferred` (reachable, not hollow). A future WP that ships a
// real handler removes the mechanic from this set.
/** Mechanics that are deferred-by-design — classified `deferred`, never hollow. */
export const DEFERRED_BY_DESIGN_MECHANICS: ReadonlySet<string> = new Set<string>([
  'wound',
  'conditional',
]);

// ---------------------------------------------------------------------------
// EffectTrace — the per-dispatch runtime trace (WP-488 / D-24294)
// ---------------------------------------------------------------------------

/**
 * Closed union of trace statuses — the outcome of one effect dispatch.
 *
 * - `fired` — a handler ran (the common case).
 * - `no-op` — a DELIBERATE-no-op handler ran. Determined by PRIMITIVE IDENTITY
 *   (the fixed allowlist `{ become-scheme-twist [D-24287], gain-attached-hero
 *   [D-24270] }`, both of which intentionally mutate nothing), NEVER by
 *   `targets.length` — many real-firing handlers legitimately return empty targets.
 * - `no-handler` — no handler was reached for the token (co-recorded as a hollow).
 * - `secondary-site` — the effect's real work fired at a DIFFERENT site than the
 *   executor (Mystique's escape→Scheme-Twist: the executor handler is a no-op; the
 *   twist fires at the villain-deck escape site).
 */
export type EffectTraceStatus =
  | 'fired'
  | 'no-op'
  | 'no-handler'
  | 'secondary-site';

// why: canonical drift array (WP-488 / D-24294) — adding a status requires updating
// THIS array, the EffectTraceStatus union, AND a DECISIONS.md entry together
// (code-style §Drift Detection). The drift test in effectTrace.record.test.ts pins
// bidirectional parity, mirroring EFFECT_EXECUTION_REASONS above.
/** All effect-trace statuses in canonical order. Single source of truth. */
export const EFFECT_TRACE_STATUSES: readonly EffectTraceStatus[] = [
  'fired',
  'no-op',
  'no-handler',
  'secondary-site',
] as const;

/**
 * Closed union of the code sites that emit a trace — the caller loop / fire site
 * a trace came from.
 *
 * - `villain-executor` — the `executeVillainAbilities` per-descriptor loop.
 * - `hero-executor` — the legacy `hook.effects` → `executeSingleEffect` sub-path.
 * - `hero-primitive` — the composition `hook.primitiveEffects` →
 *   `interpretHeroPrimitiveEffect` sub-path.
 * - `escape-scheme-twist` — the villain-deck escape branch where a
 *   `become-scheme-twist` escape fires the real Scheme Twist (the secondary site).
 */
export type EffectTraceFireSite =
  | 'villain-executor'
  | 'hero-executor'
  | 'hero-primitive'
  | 'escape-scheme-twist';

// why: canonical drift array (WP-488 / D-24294) — same bidirectional-parity contract
// as EFFECT_TRACE_STATUSES; a fire site added to the union but not the array (or vice
// versa) fails the drift test.
/** All effect-trace fire sites in canonical order. Single source of truth. */
export const EFFECT_TRACE_FIRE_SITES: readonly EffectTraceFireSite[] = [
  'villain-executor',
  'hero-executor',
  'hero-primitive',
  'escape-scheme-twist',
] as const;

/**
 * One JSON-serializable per-dispatch effect trace (WP-488 / D-24294).
 *
 * Materialized on the runtime-only `G.diagnostics.traces` channel whenever a card
 * effect descriptor is dispatched during play. It unifies what the hollow detector
 * and a mutation check answer separately — "did a handler run at all?" and "did the
 * real work fire here or elsewhere?" — into one record.
 *
 * Plain `{string, number, boolean}` fields only — no functions, Maps, Sets, Dates,
 * or class instances — so the channel stays JSON-serializable. `handler` is a STRING
 * LABEL (the handler map key / function name), never a function reference; `""` when
 * no handler ran. `effect` is the descriptor's primitive/keyword token verbatim.
 * `params` is a shallow scalar snapshot of the descriptor's own parameter fields.
 *
 * Runtime-only and INERT: never persisted, never a save-game, hash-excluded from BOTH
 * oracles, and NEVER read as gameplay input by any move / rule / `endIf` / bot / scoring.
 *
 * @property cardId - The card-instance ext_id whose effect was dispatched.
 * @property scope - Whether the source card is a hero, villain, or henchman.
 * @property timing - The hook timing label (e.g. 'onPlay', 'onFight', 'onEscape').
 * @property effect - The dispatched primitive / keyword token, verbatim.
 * @property handler - The handler's string label (map key / function name), `""` when none.
 * @property status - The dispatch outcome.
 * @property fireSite - The code site that emitted this trace.
 * @property params - A shallow scalar snapshot of the descriptor's own parameter fields.
 * @property turn - The boardgame.io turn number the trace was observed on (0 when the
 *   emitting context carries no turn, e.g. the villain-deck reveal path).
 */
export interface EffectTrace {
  cardId: CardExtId;
  scope: 'hero' | 'villain' | 'henchman';
  timing: string;
  effect: string;
  handler: string;
  status: EffectTraceStatus;
  fireSite: EffectTraceFireSite;
  params: Record<string, string | number | boolean>;
  turn: number;
}

// why: WP-488 / D-24294 — a trace fires on EVERY effect dispatch (unlike the rare
// hollow record), so a long match is high-volume; the cap bounds `G.diagnostics.traces`
// so a pathological match cannot grow G without limit (mirrors HOLLOW_EFFECTS_CAP + the
// arena-client diagnostics ring buffer). The value is not gameplay-load-bearing (the
// channel is never gameplay input); 512 leaves generous headroom for a long match's
// dispatch volume while staying bounded.
/** Maximum number of EffectTrace entries retained in G.diagnostics. */
export const EFFECT_TRACES_CAP = 512;
