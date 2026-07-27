/**
 * The structured game-log record contract (WP-434 / WP-B.3a, D-24253).
 *
 * `G.messages` and `UIState.log` are `LogEntry[]` rather than `string[]`: each log
 * line carries a machine-readable `outcome` the engine authors at push time, so the
 * client can colour the line (green / yellow / red) without re-parsing prose. Before
 * this, the effect outcome (a full vs short draw, an empty supply, a guard-blocked
 * action) was known at the `pushLog` call site but destroyed the moment it was
 * flattened to a string — which forced the client `effectProvenance` heuristic to
 * reconstruct it by string-matching (D-24100). See DESIGN-LOG-OUTCOME-CONTRACT.md.
 */

/**
 * The coarse, player-facing outcome of a single log line. A *projection* of the
 * finer engine-side `EffectExecutionReason` (WP-257) — a player does not care whether
 * "nothing happened" was a condition-fail or an empty source, only that it was red.
 *
 * - `neutral` — pure narration, no effect claim (the majority; e.g. "played X",
 *   turn/phase lines). Rendered with no colour.
 * - `applied` — the effect fully did its thing (green).
 * - `partial` — some-but-not-all / conditional-skipped (yellow).
 * - `blocked` — tried and nothing happened: condition-failed, empty source,
 *   no-branch-matched, hollow (red).
 */
export type LogOutcome = 'neutral' | 'applied' | 'partial' | 'blocked';

/**
 * All log outcomes in canonical order. Single source of truth (canonical
 * drift-detected array, per code-style §Drift Detection). Adding an outcome requires
 * updating BOTH this array and the `LogOutcome` union; `logOutcome.contracts.test.ts`
 * asserts they stay in lockstep.
 */
export const LOG_OUTCOMES: readonly LogOutcome[] = [
  'neutral',
  'applied',
  'partial',
  'blocked',
] as const;

// why: type-only — CardExtId is a string alias; this keeps the
// logOutcome.types → zones.types → types.ts → logOutcome.types cycle erased at emit
// (every edge is `import type`). Never convert to a value import (WP-438 / RS-1).
import type { CardExtId } from '../state/zones.types.js';

/**
 * One game-log line: the fully-prefixed sentence, its outcome, and (when the line is
 * about a specific card) the card's ext-id. `text` already carries the
 * `{turn}.{step}.{action}` numbering prefix (stamped inside `pushLog`); nothing
 * downstream re-parses it.
 *
 * // why: WP-438 — `card` is an OPTIONAL structured ext-id, present on card-attributed
 * lines (a play, a hero effect, a hollow record) and absent on pure narration
 * (turn/phase, scheme/master-strike). The freeze diagnostic reads it to identify a
 * played card and associate its effect lines WITHOUT parsing the "played X ({ext-id})"
 * prose (retires the fragile extractor). Optional + additive: every existing caller and
 * line stays valid; `card` is omitted (not `undefined`) when not supplied.
 */
export interface LogEntry {
  text: string;
  outcome: LogOutcome;
  card?: CardExtId;
}
