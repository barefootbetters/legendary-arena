/**
 * Maps a game-log line's `LogOutcome` to how the HUD renders it (WP-435 / WP-B.3b).
 *
 * The engine authors the outcome on every `LogEntry` (WP-434 / D-24253); this is the
 * client's read-only render mapping. B.3b makes the outcome *visible* — B.3a shipped it
 * as data only.
 *
 * // why: colour is NEVER the only signal (D-24253 §Fork E). Each non-`neutral`
 * outcome pairs a colour class with a decorative glyph AND a screen-reader label, so a
 * colour-blind or screen-reader user gets the outcome without seeing colour. `neutral`
 * — the dominant narration case — is intentionally unstyled with no glyph/label;
 * colouring it would drown the signal.
 */

import type { LogOutcome } from '@legendary-arena/game-engine';

/** The render triple for one outcome: the CSS class, a decorative glyph, and the a11y label. */
export interface LogOutcomeDisplay {
  /** CSS class on the `<li>`, or `''` for `neutral` (unstyled). */
  readonly className: string;
  /** Decorative glyph (rendered `aria-hidden`), or `''` for `neutral` (no glyph). */
  readonly glyph: string;
  /** Screen-reader-only outcome word, or `''` for `neutral` (no label). */
  readonly label: string;
}

// why: a keyed Record over the LogOutcome union — NOT an index signature and NOT a
// switch with a catch-all default. Adding a value to LOG_OUTCOMES / the LogOutcome
// union is then an immediate compile error here until a row is added, so the drift
// guard is real rather than a tautology (a catch-all would silently return neutral).
const DISPLAY: Record<LogOutcome, LogOutcomeDisplay> = {
  neutral: { className: '', glyph: '', label: '' },
  applied: { className: 'game-log__line--applied', glyph: '✓', label: 'applied' },
  partial: { className: 'game-log__line--partial', glyph: '⚠', label: 'partial' },
  blocked: { className: 'game-log__line--blocked', glyph: '✕', label: 'blocked' },
};

/**
 * Returns the render triple (class, glyph, a11y label) for a log line's outcome.
 *
 * @param outcome The engine-authored `LogEntry.outcome`.
 * @returns The `{ className, glyph, label }` triple; all-empty for `neutral`.
 */
export function logOutcomeDisplay(outcome: LogOutcome): LogOutcomeDisplay {
  return DISPLAY[outcome];
}
