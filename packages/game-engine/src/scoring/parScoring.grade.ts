/**
 * Competitive-score grade banding for the Legendary Arena game engine (WP-583).
 *
 * A coarse rank (Legendary / A / B / C / D / F) mapped from the PAR-relative
 * final score. This is the score-legibility sibling to `menaceTierFor` (the
 * danger-meter tier band, `rules/schemeLossProgress.ts`): a pure threshold
 * function plus a drift-pinned canonical array mirroring a string union.
 *
 * Boundary contract (D-24392, mirroring D-24367 / D-24371): the engine ships
 * the grade ENUM only. Every player-facing word ("Legendary", "A", …) lives
 * client-side in `apps/arena-client/src/vfx/gradeDisplay.ts` — no display copy
 * in `packages/`.
 *
 * Pure: a deterministic function of one number. No mutation, no `G`, no
 * boardgame.io import. Not stored anywhere — a read-only banding function.
 */

/**
 * Coarse competitive-score grade, best to worst.
 *
 * A shared contract: the boundaries are locked once here so the endgame badge
 * and any future leaderboard grade can never disagree about what "legendary"
 * means.
 */
export type ScoreGrade = 'legendary' | 'a' | 'b' | 'c' | 'd' | 'f';

/**
 * Canonical ordered list of ScoreGrade values, best to worst.
 *
 * Drift-checked against the `ScoreGrade` union — never update one without the
 * other (`.claude/rules/code-style.md` §Drift Detection).
 */
export const SCORE_GRADES: readonly ScoreGrade[] = ['legendary', 'a', 'b', 'c', 'd', 'f'];

// why: grade band ceilings on the PAR-relative finalScore (centesimal integer,
// lower is better, 0 = PAR). A finalScore at or below a ceiling earns that grade;
// the bands are tunable config — a display-legibility choice, NOT a scoring-formula
// change (WP-583 / D-24392). Legendary is well under PAR; anything past D_MAX is F.
const LEGENDARY_MAX = -1000; // <= -10.00 under PAR
const A_MAX = -300; // <= -3.00 under PAR
const B_MAX = 300; // around PAR (0)
const C_MAX = 800; // <= +8.00 over PAR
const D_MAX = 1800; // <= +18.00 over PAR (higher is F)

/**
 * Maps a PAR-relative final score to its coarse grade band.
 *
 * @param finalScore - The competitive final score (centesimal integer; lower is
 *   better; 0 = PAR). Banded by ascending ceilings.
 * @returns The ScoreGrade for that final score.
 */
export function gradeForFinalScore(finalScore: number): ScoreGrade {
  if (finalScore <= LEGENDARY_MAX) {
    return 'legendary';
  }
  if (finalScore <= A_MAX) {
    return 'a';
  }
  if (finalScore <= B_MAX) {
    return 'b';
  }
  if (finalScore <= C_MAX) {
    return 'c';
  }
  if (finalScore <= D_MAX) {
    return 'd';
  }
  return 'f';
}
