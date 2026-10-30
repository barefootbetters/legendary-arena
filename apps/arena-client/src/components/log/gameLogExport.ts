/**
 * Pure text-export helpers for the live HUD Game Log (WP-322).
 *
 * The engine log reaches the client as `UIState.log` — a `LogEntry[]` (WP-434) in
 * chronological (append) order. These helpers turn that array into a plain-text
 * transcript for the Copy (clipboard) and Save (match-scoped `.txt` download)
 * affordances on `GameLogPanel` and the endgame `GameLogDownloadButton`. They are extracted from the component so the
 * export payload is unit-testable without the clipboard / Blob browser APIs
 * (the WP-321 `gameLogScroll` testability precedent) — the DOM side effects
 * themselves are covered by the D-24026 live-verify.
 */

import type { LogEntry } from '@legendary-arena/game-engine';

/**
 * Builds the download file name for a game-log transcript, mirroring the
 * diagnostics export scheme (`legendary-arena-diagnostics-<match>-<ms>.json`) so
 * a per-match archive keeps the log and diagnostics files side by side and two
 * exports of the same setup never collide. An absent or empty match id becomes
 * the literal `no-match`; `/` and `\` in the id are replaced with `-` so the
 * name stays a single safe filename component (as `buildDiagnosticFileName`).
 *
 * @param matchId      The `?match=` id (already URL-decoded) or `null` when absent.
 * @param capturedAtMs The single `Date.now()` read at click time.
 * @returns The `.txt` file name.
 */
export function buildGameLogFileName(matchId: string | null, capturedAtMs: number): string {
  const rawMatchSegment = matchId !== null && matchId !== '' ? matchId : 'no-match';
  const safeMatchSegment = rawMatchSegment.replaceAll('/', '-').replaceAll('\\', '-');
  return `legendary-arena-game-log-${safeMatchSegment}-${capturedAtMs}.txt`;
}

/**
 * Builds the plain-text transcript for the game log: one entry per line, in the
 * given (chronological) order, with a trailing newline so the file ends cleanly.
 * An empty log yields an empty string (no stray newline).
 *
 * Optional header lines (e.g. the build provenance from
 * `formatProvenanceHeaderLines`) are written first, followed by a blank line. With
 * no header lines the output is exactly the plain transcript.
 *
 * @param log The chronological log entries, exactly as received from `UIState.log`.
 * @param headerLines Lines to write above the transcript; empty by default.
 * @returns The joined transcript text, or an empty string when the log is empty.
 */
export function buildGameLogText(log: readonly LogEntry[], headerLines: readonly string[] = []): string {
  if (log.length === 0) {
    return '';
  }
  let header = '';
  if (headerLines.length > 0) {
    header = headerLines.join('\n') + '\n\n';
  }
  // why: WP-435 — the export stays a plain-text transcript, so the on-screen colour
  // becomes a leading `[outcome]` text tag on non-`neutral` lines (greppable, mirrors
  // the HUD glyph). `neutral` — the dominant narration case — stays untagged so the
  // transcript reads cleanly; this also keeps every pre-B.3b (all-`neutral`) export
  // byte-identical.
  return (
    header +
    log
      .map((entry) =>
        entry.outcome === 'neutral' ? entry.text : `[${entry.outcome}] ${entry.text}`,
      )
      .join('\n') + '\n'
  );
}
