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
// why: WP-599 / D-24409 — re-derived for the rulebook-fidelity scale. Removing the
// −200 bystander reward and rescaling penalties to true VP-units (10/30/40) collapsed
// the raw-score magnitude ~10× (the score is now VP-dominated: `Raw = penalties −
// VP×10`), so the old ±2000/±700 bands would pin almost every win at B. On the new
// scale a competent win lands near PAR (0), and Final is driven by how far the team's
// VP beats the scheme's expected VP (roughly ±10 per net VP). These narrower bands put
// a solid win at B, a strong game at A, an exceptional one at Legendary, a weak win at
// C, and a loss (via the +800 LOSS_PENALTY) at D/F. INTERIM / operator-tunable — a
// display-legibility choice, NOT a scoring-formula change; validated against the 13
// real anchor games (Final = raw − scheme-PAR): a 34-bystander Midtown win lands A, a
// competent win sits near PAR (B), a bystander-heavy loss (via the +800 LOSS_PENALTY)
// lands D and a low-VP loss F. Interim / operator-tunable (the WP-591 precedent).
export const SCORE_GRADE_BANDS: readonly ScoreGradeBand[] = [
  { grade: 'legendary', maxFinalScore: -500 }, // well under a competent-play PAR
  { grade: 'a', maxFinalScore: -250 }, // clearly above competent
  { grade: 'b', maxFinalScore: 150 }, // a solid win sits around PAR (0)
  { grade: 'c', maxFinalScore: 500 }, // a weak win
  { grade: 'd', maxFinalScore: 1100 }, // a near-miss loss (loss penalty applied)
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
