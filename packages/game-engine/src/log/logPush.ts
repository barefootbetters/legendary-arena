import type { LegendaryGameState } from '../types.js';
import { TURN_STAGES } from '../turn/turnPhases.types.js';
import type { LogEntry, LogOutcome } from './logOutcome.types.js';
import type { CardExtId } from '../state/zones.types.js';

/**
 * Central game-log push helper (WP-328; WP-434 outcome arg). Appends a `LogEntry`
 * to `G.messages` — the `.text` carries a `{turn}.{step}.{action}` prefix so every
 * log line has a stable address (`turn` = the play-relative player turn; `step` = the
 * 1-based turn stage `start`=1/`main`=2/`cleanup`=3; `action` = a per-step counter,
 * from `G.logMeta`, stamped at the play-phase `onBegin` and reset per stage) — and the
 * `.outcome` carries the machine-readable colour class the client renders.
 *
 * // why: WP-434 — `outcome` defaults to `neutral` so the ~two dozen narration callers
 * stay byte-unchanged in behavior; only the bounded outcome-bearing effect emissions
 * pass a third argument. Keeping neutral dominant is what makes a coloured line mean
 * something (see LOG_OUTCOMES / DESIGN-LOG-OUTCOME-CONTRACT.md).
 *
 * `G.messages` is excluded from `finalStateHash` (D-24081); so is `G.logMeta`, so the
 * prefix, counter, and outcome are replay-safe (all deterministic).
 *
 * @param G The game state (mutated: appends to `G.messages`, increments the counter).
 * @param message The full-sentence log line to record (without a prefix).
 * @param outcome The line's coarse outcome; defaults to `neutral`.
 */
export function pushLog(
  G: LegendaryGameState,
  message: string,
  outcome: LogOutcome = 'neutral',
  card?: CardExtId,
): void {
  // why: a narrow test/mock `G` may omit the messages array — skip rather than throw,
  // matching the Array.isArray guard used across the effect/reveal push sites.
  if (!Array.isArray(G.messages)) {
    return;
  }
  // why: WP-438 — build the LogEntry with `card` ONLY when supplied. Omitting the key
  // (rather than writing `card: undefined`) keeps narration lines byte-identical and is
  // the strict-optional (`exactOptionalPropertyTypes`) construction pattern.
  const cardPart = card !== undefined ? { card } : {};
  const logMeta = G.logMeta;
  if (logMeta === undefined) {
    // why: narrow unit fixtures omit `G.logMeta` — push the bare message unprefixed.
    // Production always initializes it at onBegin (game.ts), so live logs are numbered.
    G.messages.push({ text: message, outcome, ...cardPart });
    return;
  }
  logMeta.actionInStep += 1;
  // why: step is the 1-based index of the current stage in TURN_STAGES (start=1,
  // main=2, cleanup=3) — read from the canonical array rather than hardcoding the map.
  const step = TURN_STAGES.indexOf(G.currentStage) + 1;
  const text = `${logMeta.turn}.${step}.${logMeta.actionInStep} ${message}`;
  G.messages.push({ text, outcome, ...cardPart } satisfies LogEntry);
}
