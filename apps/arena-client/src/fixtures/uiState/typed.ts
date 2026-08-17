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

import type {
  LogEntry,
  MenaceTier,
  SchemeLossKind,
  UIProgressCounters,
  UIState,
} from '@legendary-arena/game-engine';
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


// why: WP-558 — same JSON-widening problem as `narrowLog` above, one field
// along. A JSON import widens `progress.menaceTier` to `string`, which no
// longer satisfies `MenaceTier`. Re-narrow it so the fixture still
// `satisfies UIState` and keeps its drift-checking role. The value itself is
// validated by the engine's own tier contract; here we only re-tag the
// compile-time literal.
// why: WP-562 — this function is a FIELD-BY-FIELD REBUILD, so a field added to
// the fixture JSON but not listed here is silently dropped before any component
// sees it — the same whitelist hazard as `filterUIStateForAudience`. Any future
// `progress` field must be added in BOTH places or the fixture-driven surfaces
// (the `?fixture=…&play=1` dev route, every component test) render as if the
// engine never projected it.
function narrowProgress(progress: {
  bystandersRescued: number;
  escapedVillains: number;
  menace: number;
  menaceTier: string;
  schemeLossProgress: number;
  schemeLossThreshold: number;
  schemeLossKind: string;
  schemeTwistThreshold: number;
}): UIProgressCounters {
  return {
    bystandersRescued: progress.bystandersRescued,
    escapedVillains: progress.escapedVillains,
    menace: progress.menace,
    menaceTier: progress.menaceTier as MenaceTier,
    schemeLossProgress: progress.schemeLossProgress,
    schemeLossThreshold: progress.schemeLossThreshold,
    // why: the same JSON-widening re-tag as `menaceTier` — a JSON import widens
    // the kind to `string`, which no longer satisfies `SchemeLossKind`.
    schemeLossKind: progress.schemeLossKind as SchemeLossKind,
    schemeTwistThreshold: progress.schemeTwistThreshold,
  };
}

export const midTurn = {
  ...midTurnJson,
  log: narrowLog(midTurnJson.log),
  progress: narrowProgress(midTurnJson.progress),
} satisfies UIState;
export const endgameWin = {
  ...endgameWinJson,
  log: narrowLog(endgameWinJson.log),
  progress: narrowProgress(endgameWinJson.progress),
} satisfies UIState;
export const endgameLoss = {
  ...endgameLossJson,
  log: narrowLog(endgameLossJson.log),
  progress: narrowProgress(endgameLossJson.progress),
} satisfies UIState;
