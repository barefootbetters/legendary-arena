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

/**
 * One grade band: a ScoreGrade and the inclusive upper bound of the finalScore
 * that earns it.
 *
 * why (WP-587 / D-24396): the endgame screen renders the whole scale — every
 * band with its threshold and a "you are here" marker — so the boundaries can no
 * longer live only inside `gradeForFinalScore`'s if-ladder. SCORE_GRADE_BANDS is
 * the single source of truth for both the classification and the displayed scale;
 * the client renders the words (`gradeDisplay.ts`) and the numbers, keeping the
 * D-24392 / D-24367 no-copy-in-`packages/` boundary.
 */
export interface ScoreGradeBand {
  readonly grade: ScoreGrade;
  /**
   * Inclusive upper bound of finalScore for this grade (centesimal integer;
   * lower is better; 0 = PAR). `null` on the worst band, which is unbounded
   * above (everything past the previous ceiling is F).
   */
  readonly maxFinalScore: number | null;
}

// why: grade band ceilings on the PAR-relative finalScore (centesimal integer,
// lower is better, 0 = PAR). A finalScore at or below a band's ceiling earns that
// grade, tried best-to-worst; the bands are tunable config — a display-legibility
// choice, NOT a scoring-formula change (WP-583 / D-24392). Legendary is well under
// PAR; the final band (`null` ceiling) catches everything worse than D.
// why: WP-591 / D-24400 — retuned for the scheme-aware, twist-aware PAR (which now
// centers on competent play per scheme). Each bystander is worth 200 points, so the
// old ±300-wide bands meant ~1.5 bystanders flipped a grade — everything pinned at
// the extremes. These wider bands, validated against the 13 real anchor games, make
// a solid win land B, an exceptional game A/Legendary, and a loss (via the loss
// penalty) D/F. Tunable; a display-legibility choice, NOT a scoring-formula change.
export const SCORE_GRADE_BANDS: readonly ScoreGradeBand[] = [
  { grade: 'legendary', maxFinalScore: -2000 }, // well under a competent-play PAR
  { grade: 'a', maxFinalScore: -700 }, // clearly above competent
  { grade: 'b', maxFinalScore: 700 }, // a solid win sits around PAR (0)
  { grade: 'c', maxFinalScore: 2000 }, // a weak win
  { grade: 'd', maxFinalScore: 4000 }, // a near-miss loss (loss penalty applied)
  { grade: 'f', maxFinalScore: null }, // a poor loss
];

/**
 * Maps a PAR-relative final score to its coarse grade band.
 *
 * @param finalScore - The competitive final score (centesimal integer; lower is
 *   better; 0 = PAR). Banded by ascending ceilings.
 * @returns The ScoreGrade for that final score.
 */
export function gradeForFinalScore(finalScore: number): ScoreGrade {
  // why: iterate the single-source-of-truth bands best-to-worst so the classifier
  // and the displayed scale can never disagree (WP-587). The `null`-ceiling final
  // band is the catch-all and always matches.
  for (const band of SCORE_GRADE_BANDS) {
    if (band.maxFinalScore === null || finalScore <= band.maxFinalScore) {
      return band.grade;
    }
  }
  // why: unreachable — the last band's ceiling is null (always matches) — but a
  // defined return keeps the function total without a non-null assertion.
  return 'f';
}
