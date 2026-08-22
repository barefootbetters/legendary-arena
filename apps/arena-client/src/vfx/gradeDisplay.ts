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

import { SCORE_GRADE_BANDS, type ScoreGrade } from '@legendary-arena/game-engine';

// why: the true minus sign (U+2212), matching the rest of the endgame panel, so a
// negative threshold reads cleanly rather than with a hyphen.
const MINUS = '−';

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

/** One row of the endgame grade scale: a grade, its final-score range, and whether the player is in it. */
export interface GradeScaleEntry {
  readonly grade: ScoreGrade;
  /** The player-facing word for the grade ("Legendary", "A", …). */
  readonly label: string;
  /** The final-score range that earns this grade, e.g. "≤ −1000", "−1000…−300", "> 1800". */
  readonly range: string;
  /** True for the grade the player earned this match. */
  readonly isCurrent: boolean;
}

/**
 * Formats a centesimal-integer threshold with the true minus sign (no ÷100 — the
 * endgame panel shows raw centesimal integers, the WP-584 operator choice).
 */
function formatThreshold(value: number): string {
  return value < 0 ? `${MINUS}${Math.abs(value)}` : `${value}`;
}

/**
 * Builds the whole grade scale for the endgame screen — every band with its
 * final-score range and a marker for the grade the player earned (WP-587).
 *
 * why (D-24396, mirroring D-24392 / D-24367): the engine ships the numeric bands
 * (`SCORE_GRADE_BANDS`); the client owns the words and the range formatting. The
 * range for each band runs from the previous band's ceiling to this band's
 * ceiling (bands are inclusive-upper, best to worst); the final band is unbounded.
 *
 * @param currentGrade - The grade the player earned, to mark "you are here".
 * @returns One entry per grade band, best to worst.
 */
export function buildGradeScale(currentGrade: ScoreGrade): readonly GradeScaleEntry[] {
  const entries: GradeScaleEntry[] = [];
  let previousCeiling: number | null = null;
  for (const band of SCORE_GRADE_BANDS) {
    let range: string;
    if (band.maxFinalScore === null) {
      // why: the worst band is unbounded above — everything past the previous ceiling.
      range = `> ${formatThreshold(previousCeiling ?? 0)}`;
    } else if (previousCeiling === null) {
      // why: the best band has no lower bound — at or below its ceiling.
      range = `≤ ${formatThreshold(band.maxFinalScore)}`;
    } else {
      range = `${formatThreshold(previousCeiling)}…${formatThreshold(band.maxFinalScore)}`;
    }
    entries.push({
      grade: band.grade,
      label: gradeLabel(band.grade),
      range,
      isCurrent: band.grade === currentGrade,
    });
    previousCeiling = band.maxFinalScore;
  }
  return entries;
}
