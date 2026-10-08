/**
 * Tests for the player-facing count-source labels (D-24673).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeCountSource, formatCountScaledRate } from './countSourceLabel.js';
import { HERO_COUNT_SOURCES } from '../rules/heroCountSource.js';

test('every canonical count source has a hand-written label (no raw slug leaks into the log)', () => {
  for (const countSource of HERO_COUNT_SOURCES) {
    const label = describeCountSource(countSource);
    assert.notEqual(label, countSource.replace(/-/g, ' '), `${countSource} falls through to the slug fallback`);
    assert.ok(!label.includes('-played-this-turn'), `${countSource} label still reads like a slug`);
  }
});

test('the "Heroes you have" source names hand + played, not "played this turn" (D-24529)', () => {
  assert.equal(
    describeCountSource('distinct-hero-classes-played-this-turn'),
    'Hero color you have (hand + played)',
  );
});

test('an unknown source falls back to its slug with spaces', () => {
  assert.equal(describeCountSource('some-new-source'), 'some new source');
});

test('formatCountScaledRate omits a divisor of 1 and shows a larger one', () => {
  assert.equal(
    formatCountScaledRate(1, 1, 'distinct-hero-classes-played-this-turn', 3),
    '1 per Hero color you have (hand + played); count 3',
  );
  assert.equal(
    formatCountScaledRate(1, 2, 'shield-levels', 5),
    '1 per 2 × S.H.I.E.L.D. Level; count 5',
  );
});
