/**
 * Pure text-export helpers for the live HUD Game Log (WP-322).
 *
 * The engine log reaches the client as `UIState.log` — a `LogEntry[]` (WP-434) in
 * chronological (append) order. These helpers turn that array into a plain-text
 * transcript for the Copy (clipboard) and Save (`game-log.txt` download)
 * affordances on `GameLogPanel`. They are extracted from the component so the
 * export payload is unit-testable without the clipboard / Blob browser APIs
 * (the WP-321 `gameLogScroll` testability precedent) — the DOM side effects
 * themselves are covered by the D-24026 live-verify.
 */

// why: the plain-text download file name for the "Save" affordance; a fixed name
// keeps the Save deterministic and avoids a wall-clock read (this is a human
// transcript, not the timestamped JSON diagnostics export in DiagnosticExportButton).
import type { LogEntry } from '@legendary-arena/game-engine';

export const GAME_LOG_EXPORT_FILE_NAME = 'game-log.txt';

/**
 * Builds the plain-text transcript for the game log: one entry per line, in the
 * given (chronological) order, with a trailing newline so the file ends cleanly.
 * An empty log yields an empty string (no stray newline).
 *
 * @param log The chronological log entries, exactly as received from `UIState.log`.
 * @returns The joined transcript text, or an empty string when the log is empty.
 */
export function buildGameLogText(log: readonly LogEntry[]): string {
  if (log.length === 0) {
    return '';
  }
  // why: WP-434 — the export stays a plain-text transcript; render each record's
  // `.text` only (the outcome colour is an on-screen concern, not part of the
  // copyable / downloadable log).
  return log.map((entry) => entry.text).join('\n') + '\n';
}
