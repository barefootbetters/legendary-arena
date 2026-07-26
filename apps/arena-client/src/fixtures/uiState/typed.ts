/**
 * Typed-fixture layer — binds each committed JSON fixture to UIState
 * at its import site via `satisfies`.
 *
 * // why: `satisfies UIState` (never a bare type-assertion to the same
 * type) forces the JSON literal to be structurally checked against the
 * engine-owned UIState contract at each import site. Any fixture drift
 * becomes a compile-time error here instead of a runtime surprise
 * downstream. A bare type-assertion would silently widen the literal and
 * mask drift — explicitly forbidden by EC-067.
 */

import type { LogEntry, UIState } from '@legendary-arena/game-engine';
import midTurnJson from './mid-turn.json';
import endgameWinJson from './endgame-win.json';
import endgameLossJson from './endgame-loss.json';

// why: WP-434 — a JSON import widens the `log[].outcome` string literal to `string`,
// which no longer satisfies `LogEntry['outcome']` (the LogOutcome union). Re-narrow the
// imported log into LogEntry records so the fixture still `satisfies UIState` and keeps
// its drift-checking role (the outcome value is validated at runtime by the engine's
// LOG_OUTCOMES gate; here we only re-tag the compile-time literal).
function narrowLog(log: ReadonlyArray<{ text: string; outcome: string }>): LogEntry[] {
  return log.map((entry) => ({ text: entry.text, outcome: entry.outcome as LogEntry['outcome'] }));
}

export const midTurn = {
  ...midTurnJson,
  log: narrowLog(midTurnJson.log),
} satisfies UIState;
export const endgameWin = {
  ...endgameWinJson,
  log: narrowLog(endgameWinJson.log),
} satisfies UIState;
export const endgameLoss = {
  ...endgameLossJson,
  log: narrowLog(endgameLossJson.log),
} satisfies UIState;
