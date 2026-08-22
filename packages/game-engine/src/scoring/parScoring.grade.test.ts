/**
 * Tests for the competitive-score grade banding (WP-583 / D-24392).
 *
 * Verifies gradeForFinalScore at every band boundary (the bands are
 * inclusive-upper: a finalScore equal to a ceiling earns that band) and a
 * RUNTIME drift assertion that SCORE_GRADES matches the ScoreGrade union
 * (D-24372 — a runtime keyset check, not a bare `satisfies`).
 *
 * No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SCORE_GRADES,
  SCORE_GRADE_BANDS,
  gradeForFinalScore,
  type ScoreGrade,
} from './parScoring.grade.js';

describe('SCORE_GRADES canonical array (drift pin, D-24372)', () => {
  it('matches the ScoreGrade union exactly, best to worst', () => {
    // why: a RUNTIME assertion (not a bare `satisfies`) so a union member added
    // without an array entry — or vice versa — fails on every test run. Every
    // literal below must be a member of ScoreGrade (compile-time) AND present in
    // the array in this order (runtime).
    const expected: readonly ScoreGrade[] = ['legendary', 'a', 'b', 'c', 'd', 'f'];
    assert.deepStrictEqual([...SCORE_GRADES], [...expected]);
    assert.equal(SCORE_GRADES.length, 6);
    // Every returnable grade is in the canonical array (no orphan return value).
    const returned = new Set(
      [-2000, -1000, -500, 0, 500, 1000, 5000].map((s) => gradeForFinalScore(s)),
    );
    for (const grade of returned) {
      assert.ok(SCORE_GRADES.includes(grade), `${grade} is a canonical grade`);
    }
  });
});

describe('SCORE_GRADE_BANDS is the single source of truth (WP-587 / D-24396)', () => {
  it('lists every grade once, in SCORE_GRADES order, with only the last band unbounded', () => {
    // why: RUNTIME drift pin — the displayed scale (bands) and the canonical grade
    // list must never disagree. A grade added to one but not the other fails here.
    assert.deepStrictEqual(
      SCORE_GRADE_BANDS.map((band) => band.grade),
      [...SCORE_GRADES],
    );
    // Only the worst band is unbounded above (null ceiling); every other is a number.
    const nullCeilings = SCORE_GRADE_BANDS.filter((band) => band.maxFinalScore === null);
    assert.equal(nullCeilings.length, 1);
    assert.equal(SCORE_GRADE_BANDS[SCORE_GRADE_BANDS.length - 1]?.maxFinalScore, null);
    // Ceilings strictly ascend (best band lowest) so best-to-worst iteration is correct.
    const numericCeilings = SCORE_GRADE_BANDS.map((band) => band.maxFinalScore).filter(
      (ceiling): ceiling is number => ceiling !== null,
    );
    for (let index = 1; index < numericCeilings.length; index++) {
      assert.ok(
        numericCeilings[index]! > numericCeilings[index - 1]!,
        'band ceilings must strictly ascend',
      );
    }
  });

  it('classifies each band ceiling to its own grade (bands agree with gradeForFinalScore)', () => {
    // why: proves gradeForFinalScore is genuinely driven by the bands — a ceiling
    // earns its band, and ceiling+1 falls to the next band.
    for (let index = 0; index < SCORE_GRADE_BANDS.length; index++) {
      const band = SCORE_GRADE_BANDS[index]!;
      if (band.maxFinalScore === null) {
        continue;
      }
      assert.equal(gradeForFinalScore(band.maxFinalScore), band.grade);
      const nextBand = SCORE_GRADE_BANDS[index + 1];
      if (nextBand) {
        assert.equal(gradeForFinalScore(band.maxFinalScore + 1), nextBand.grade);
      }
    }
  });
});

describe('gradeForFinalScore band boundaries', () => {
  // why: the bands are inclusive-upper (`finalScore <= ceiling`), so each ceiling
  // earns its own band and ceiling+1 falls to the next. These cases pin both sides
  // of every boundary — the exact table locked in WP-583 AC-1.
  const cases: ReadonlyArray<readonly [number, ScoreGrade]> = [
    [-5000, 'legendary'],
    [-1000, 'legendary'], // ceiling
    [-999, 'a'],
    [-300, 'a'], // ceiling
    [-299, 'b'],
    [0, 'b'], // PAR sits in B
    [300, 'b'], // ceiling
    [301, 'c'],
    [800, 'c'], // ceiling
    [801, 'd'],
    [1220, 'd'], // the live example (Red Skull / Midtown)
    [1800, 'd'], // ceiling
    [1801, 'f'],
    [9999, 'f'],
  ];

  for (const [finalScore, expected] of cases) {
    it(`finalScore ${finalScore} -> ${expected}`, () => {
      assert.equal(gradeForFinalScore(finalScore), expected);
    });
  }
});
