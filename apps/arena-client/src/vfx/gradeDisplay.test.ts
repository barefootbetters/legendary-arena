import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { SCORE_GRADES, SCORE_GRADE_BANDS, type ScoreGrade } from '@legendary-arena/game-engine';
import { gradeLabel, gradeClass, gradeAriaText, buildGradeScale } from './gradeDisplay';

describe('gradeDisplay (WP-583)', () => {
  test('every ScoreGrade maps to a non-empty label and class', () => {
    for (const grade of SCORE_GRADES) {
      const label = gradeLabel(grade);
      const cls = gradeClass(grade);
      assert.ok(label.length > 0, `${grade} has a label`);
      assert.ok(cls.startsWith('grade-badge--'), `${grade} has a modifier class`);
      assert.ok(gradeAriaText(grade).includes(label), `${grade} aria text names the label`);
    }
  });

  test('the elite tier is the word "Legendary" (not "S")', () => {
    assert.equal(gradeLabel('legendary'), 'Legendary');
    // The letter grades render as the uppercase letter.
    const letters: ReadonlyArray<readonly [ScoreGrade, string]> = [
      ['a', 'A'],
      ['b', 'B'],
      ['c', 'C'],
      ['d', 'D'],
      ['f', 'F'],
    ];
    for (const [grade, expected] of letters) {
      assert.equal(gradeLabel(grade), expected);
    }
  });
});

describe('buildGradeScale (WP-587)', () => {
  test('one entry per band, in SCORE_GRADES order, exactly one marked current', () => {
    const scale = buildGradeScale('a');
    assert.equal(scale.length, SCORE_GRADE_BANDS.length);
    assert.deepEqual(
      scale.map((entry) => entry.grade),
      [...SCORE_GRADES],
    );
    const current = scale.filter((entry) => entry.isCurrent);
    assert.equal(current.length, 1);
    assert.equal(current[0]?.grade, 'a');
  });

  test('ranges read best-to-worst: bounded ends, a middle band, and an unbounded tail', () => {
    const scale = buildGradeScale('legendary');
    const byGrade = Object.fromEntries(scale.map((entry) => [entry.grade, entry.range]));
    // Best band: at or below its ceiling (true minus sign, centesimal integer).
    assert.equal(byGrade['legendary'], '≤ −2000');
    // A middle band spans the previous ceiling to its own.
    assert.equal(byGrade['a'], '−2000…−700');
    // Worst band is unbounded above the previous ceiling.
    assert.equal(byGrade['f'], '> 4000');
  });

  test('every band label is the player-facing word', () => {
    const scale = buildGradeScale('c');
    assert.equal(scale.find((entry) => entry.grade === 'legendary')?.label, 'Legendary');
    assert.equal(scale.find((entry) => entry.grade === 'c')?.label, 'C');
  });
});
