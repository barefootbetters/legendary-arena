/**
 * Tests for the co-op outcome classifier (WP-452).
 *
 * One assertion per category from a synthetic CoopGameRecord, a non-vacuous
 * drift test on COOP_OUTCOME_CATEGORIES, and the ESCAPE_LIMIT boundary
 * (exactly at the limit → escaped; one below → scheme-completed).
 *
 * No boardgame.io import. node:test / node:assert only.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { classifyCoopOutcome, COOP_OUTCOME_CATEGORIES } from './coopOutcome.js';
import { ESCAPE_LIMIT } from '../endgame/endgame.types.js';
import type { CoopGameRecord } from './coopWinRate.js';

/**
 * Builds a synthetic CoopGameRecord with sensible defaults (a plain
 * scheme-completed loss) that each test overrides for its branch.
 *
 * @param overrides - the fields to override for the branch under test.
 * @returns a full CoopGameRecord.
 */
function makeRecord(overrides: Partial<CoopGameRecord>): CoopGameRecord {
  return {
    isHeroesWin: false,
    endgameReached: true,
    endgameWinner: 'scheme-wins',
    escapedVillains: 0,
    turns: 12,
    ...overrides,
  };
}

describe('classifyCoopOutcome (WP-452)', () => {
  test("heroes win → 'win'", () => {
    const record = makeRecord({ isHeroesWin: true, endgameWinner: 'heroes-win' });
    assert.equal(classifyCoopOutcome(record), 'win');
  });

  test("scheme wins below the escape limit → 'loss-scheme-completed'", () => {
    const record = makeRecord({ endgameWinner: 'scheme-wins', escapedVillains: 0 });
    assert.equal(classifyCoopOutcome(record), 'loss-scheme-completed');
  });

  test("scheme wins at exactly ESCAPE_LIMIT → 'loss-villains-escaped'", () => {
    const record = makeRecord({
      endgameWinner: 'scheme-wins',
      escapedVillains: ESCAPE_LIMIT,
    });
    assert.equal(classifyCoopOutcome(record), 'loss-villains-escaped');
  });

  test("scheme wins at ESCAPE_LIMIT - 1 → 'loss-scheme-completed' (boundary)", () => {
    // why: the negative boundary — one escape below the limit is NOT an escape
    // overrun, so the classifier must fall through to scheme-completed. Pins the
    // >= comparison against an off-by-one drift.
    const record = makeRecord({
      endgameWinner: 'scheme-wins',
      escapedVillains: ESCAPE_LIMIT - 1,
    });
    assert.equal(classifyCoopOutcome(record), 'loss-scheme-completed');
  });

  test("deck-exhaustion tie → 'loss-tie'", () => {
    const record = makeRecord({ endgameWinner: 'tie' });
    assert.equal(classifyCoopOutcome(record), 'loss-tie');
  });

  test("turn cap hit with no terminal → 'inconclusive-turn-cap'", () => {
    const record = makeRecord({ endgameReached: false, endgameWinner: null });
    assert.equal(classifyCoopOutcome(record), 'inconclusive-turn-cap');
  });

  test('a heroes win outranks every other condition', () => {
    // why: the win branch is first, so isHeroesWin must win even when other
    // fields look like a loss (a defensive guard against branch reordering).
    const record = makeRecord({
      isHeroesWin: true,
      endgameWinner: 'heroes-win',
      escapedVillains: ESCAPE_LIMIT + 5,
    });
    assert.equal(classifyCoopOutcome(record), 'win');
  });

  test('drift: COOP_OUTCOME_CATEGORIES is exactly the 5 expected members in order', () => {
    assert.deepEqual(
      [...COOP_OUTCOME_CATEGORIES],
      [
        'win',
        'loss-scheme-completed',
        'loss-villains-escaped',
        'loss-tie',
        'inconclusive-turn-cap',
      ],
    );
    assert.equal(COOP_OUTCOME_CATEGORIES.length, 5);
  });

  test('drift: a phantom category name is absent from the canonical array', () => {
    // why: a non-vacuous negative — proves the array is a closed set, not a
    // grab-bag a stray name could slip into.
    const phantom = 'loss-mastermind-escaped' as never;
    assert.equal(COOP_OUTCOME_CATEGORIES.includes(phantom), false);
  });

  test('every classifier branch returns a member of COOP_OUTCOME_CATEGORIES', () => {
    // why: non-vacuous — walk one record per branch and assert the result is a
    // canonical member, so no branch can return an off-list string.
    const branchRecords: CoopGameRecord[] = [
      makeRecord({ isHeroesWin: true, endgameWinner: 'heroes-win' }),
      makeRecord({ endgameReached: false, endgameWinner: null }),
      makeRecord({ endgameWinner: 'tie' }),
      makeRecord({ endgameWinner: 'scheme-wins', escapedVillains: ESCAPE_LIMIT }),
      makeRecord({ endgameWinner: 'scheme-wins', escapedVillains: 0 }),
    ];
    for (const record of branchRecords) {
      const category = classifyCoopOutcome(record);
      assert.ok(
        (COOP_OUTCOME_CATEGORIES as readonly string[]).includes(category),
        `classifyCoopOutcome returned "${category}", not a canonical category`,
      );
    }
  });
});
