import type { LegendaryGameState } from '../types.js';
import { TURN_STAGES } from '../turn/turnPhases.types.js';

/**
 * Central game-log push helper (WP-328). Appends `message` to `G.messages` with a
 * `{turn}.{step}.{action}` prefix so every log line carries a stable address —
 * `turn` = the player turn, `step` = the 1-based turn stage (`start`=1, `main`=2,
 * `cleanup`=3), `action` = a per-step counter. The numbering data lives in
 * `G.logMeta`, stamped at `onBegin` (from `ctx.turn`) and reset per stage.
 *
 * `G.messages` is excluded from `finalStateHash` (D-24081); so is `G.logMeta`, so
 * the prefix and the counter are replay-safe (turn/stage/order are all deterministic).
 *
 * @param G The game state (mutated: appends to `G.messages`, increments the counter).
 * @param message The full-sentence log line to record (without a prefix).
 */
export function pushLog(G: LegendaryGameState, message: string): void {
  // why: a narrow test/mock `G` may omit the messages array — skip rather than throw,
  // matching the Array.isArray guard used across the effect/reveal push sites.
  if (!Array.isArray(G.messages)) {
    return;
  }
  const logMeta = G.logMeta;
  if (logMeta === undefined) {
    // why: narrow unit fixtures omit `G.logMeta` — push the bare message unprefixed.
    // Production always initializes it at onBegin (game.ts), so live logs are numbered.
    G.messages.push(message);
    return;
  }
  logMeta.actionInStep += 1;
  // why: step is the 1-based index of the current stage in TURN_STAGES (start=1,
  // main=2, cleanup=3) — read from the canonical array rather than hardcoding the map.
  const step = TURN_STAGES.indexOf(G.currentStage) + 1;
  G.messages.push(`${logMeta.turn}.${step}.${logMeta.actionInStep} ${message}`);
}
