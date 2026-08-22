import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { SCORE_GRADES, type ScoreGrade } from '@legendary-arena/game-engine';
import { gradeLabel, gradeClass, gradeAriaText } from './gradeDisplay';

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
