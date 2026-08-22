/**
 * Competitive-score grade presentation (WP-583 / D-24392).
 *
 * Pure functions turning the engine's `ScoreGrade` enum into the word and class
 * name the endgame badge renders. No Vue import, so every rule here is testable
 * without mounting a component — the same split `vfx/menaceDisplay.ts` uses for
 * the danger meter.
 *
 * why (D-24392, mirroring D-24367 / D-24371): THIS is the file the engine's
 * `ScoreGrade` enum exists to feed. Every player-facing word for a grade —
 * "Legendary", "A", … — lives here and nowhere in `packages/`: the engine bands
 * the number, the client decides what to call each band. A label field in the
 * engine would put copy behind the layer boundary.
 */

import type { ScoreGrade } from '@legendary-arena/game-engine';

// why: the player-facing word for each grade. "Legendary" replaces the
// conventional "S" rank as the elite tier (operator decision, 2026-08-22).
const GRADE_LABELS: Record<ScoreGrade, string> = {
  legendary: 'Legendary',
  a: 'A',
  b: 'B',
  c: 'C',
  d: 'D',
  f: 'F',
};

/**
 * The player-facing word for a grade ("Legendary", "A", …).
 *
 * @param grade - The grade as banded by the engine.
 * @returns The display label.
 */
export function gradeLabel(grade: ScoreGrade): string {
  return GRADE_LABELS[grade];
}

/**
 * Maps a grade to its CSS modifier class.
 *
 * @param grade - The grade as banded by the engine.
 * @returns The modifier class name for that grade.
 */
export function gradeClass(grade: ScoreGrade): string {
  // why: an explicit switch rather than a template string so a future ScoreGrade
  // member fails to compile here instead of silently producing an unstyled class.
  switch (grade) {
    case 'legendary':
      return 'grade-badge--legendary';
    case 'a':
      return 'grade-badge--a';
    case 'b':
      return 'grade-badge--b';
    case 'c':
      return 'grade-badge--c';
    case 'd':
      return 'grade-badge--d';
    case 'f':
      return 'grade-badge--f';
  }
}

/**
 * Builds the screen-reader description of the grade.
 *
 * @param grade - The grade as banded by the engine.
 * @returns A full-sentence description for `aria-label`.
 */
export function gradeAriaText(grade: ScoreGrade): string {
  // why: the badge shows the letter/word for a sighted player; the screen-reader
  // text names it as a grade so the audio reading is not a bare "Legendary".
  return `Grade: ${gradeLabel(grade)}.`;
}
