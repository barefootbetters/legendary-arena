import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { HollowEffectRecord } from '@legendary-arena/game-engine';
import { groupHollowEffects, humanizeCardKey } from './hollowEffects.group';

/** Builds a hero hollow record with the given card, mechanic, timing, and turn. */
function record(cardId: string, mechanic: string, timing: HollowEffectRecord['timing'], turn: number): HollowEffectRecord {
  return { cardId, cardType: 'hero', timing, mechanic, reason: 'parse-unrecognized', turn };
}

test('humanizeCardKey title-cases the last extId segment', () => {
  assert.equal(humanizeCardKey('cvwr/storm-black-panther/tsunami-of-justice'), 'Tsunami Of Justice');
  assert.equal(humanizeCardKey('core/doombot-legion'), 'Doombot Legion');
});

test('groupHollowEffects merges copies of one card and keeps first-seen order', () => {
  const groups = groupHollowEffects([
    record('xmen/cannonball/natural-leader#2', 'soaring-flight', 'onRecruit', 10),
    record('bkwd/falcon-winter-soldier/atone#3', 'dark-memories', 'onPlay', 4),
    record('xmen/cannonball/natural-leader#0', 'soaring-flight', 'onRecruit', 6),
  ]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0]!.cardKey, 'xmen/cannonball/natural-leader');
  assert.equal(groups[0]!.count, 2);
  assert.deepEqual(groups[0]!.turns, [6, 10]);
  assert.equal(groups[1]!.cardName, 'Atone');
});

test('groupHollowEffects keeps a different timing or mechanic on the same card apart', () => {
  // why: Carry to the Air's ungated line records soaring-flight at onRecruit and its
  // gated mention line records it at onPlay — two different gaps, two rows.
  const groups = groupHollowEffects([
    record('xmen/cannonball/carry-to-the-air#2', 'soaring-flight', 'onRecruit', 3),
    record('xmen/cannonball/carry-to-the-air#2', 'soaring-flight', 'onPlay', 3),
    record('xmen/cannonball/carry-to-the-air#2', 'gate-only', 'onPlay', 3),
  ]);
  assert.equal(groups.length, 3);
  for (const group of groups) {
    assert.equal(group.count, 1);
    assert.deepEqual(group.turns, [3]);
  }
});

test('groupHollowEffects returns no rows for no records', () => {
  assert.deepEqual(groupHollowEffects([]), []);
});
