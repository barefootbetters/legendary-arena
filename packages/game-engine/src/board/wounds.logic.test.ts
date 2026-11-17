/**
 * Tests for gainWound helper.
 *
 * Verifies wound transfer from supply pile to player discard,
 * empty pile handling, immutability, and JSON serializability.
 *
 * Uses node:test and node:assert only — no boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { gainWound, gainHeldWoundWithOutcome } from './wounds.logic.js';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';

describe('gainWound', () => {
  it('moves one wound from pile[0] to discard', () => {
    const woundsPile = ['wound-1', 'wound-2', 'wound-3'];
    const playerDiscard = ['card-a'];

    const result = gainWound(woundsPile, playerDiscard);

    assert.deepStrictEqual(result.woundsPile, ['wound-2', 'wound-3']);
    assert.deepStrictEqual(result.playerDiscard, ['card-a', 'wound-1']);
  });

  it('empty wounds pile: both arrays returned unchanged', () => {
    const woundsPile: string[] = [];
    const playerDiscard = ['card-a'];

    const result = gainWound(woundsPile, playerDiscard);

    assert.deepStrictEqual(result.woundsPile, []);
    assert.deepStrictEqual(result.playerDiscard, ['card-a']);
  });

  it('returns new arrays (inputs not mutated)', () => {
    const woundsPile = ['wound-1', 'wound-2'];
    const playerDiscard = ['card-a'];

    const result = gainWound(woundsPile, playerDiscard);

    assert.notStrictEqual(result.woundsPile, woundsPile);
    assert.notStrictEqual(result.playerDiscard, playerDiscard);
    assert.deepStrictEqual(woundsPile, ['wound-1', 'wound-2']);
    assert.deepStrictEqual(playerDiscard, ['card-a']);
  });

  it('JSON.stringify of results succeeds', () => {
    const result = gainWound(['wound-1'], []);

    const serialized = JSON.stringify(result);
    assert.ok(serialized.length > 0, 'Serialized result must be non-empty');
  });
});

describe('gainHeldWoundWithOutcome (WP-769 / D-24602)', () => {
  const WOUND = 'pile-wound' as CardExtId;
  const DIVING_BLOCK = 'core-hero-captain-america-diving-block-00' as CardExtId;

  /** A narrow G with one or two seats and optional Diving Block in seat 0's hand. */
  function makeG(hasDivingBlock: boolean): LegendaryGameState {
    return {
      piles: { wounds: [] },
      playerZones: { '0': { hand: hasDivingBlock ? [DIVING_BLOCK] : [], discard: ['d'], inPlay: [] } },
      heroAbilityHooks: hasDivingBlock ? [{ cardId: DIVING_BLOCK, timing: 'onPlay', keywords: ['diving-block'] }] : [],
    } as unknown as LegendaryGameState;
  }

  it('lands the given Wound in the discard and reports gained', () => {
    const G = makeG(false);
    assert.equal(gainHeldWoundWithOutcome(G, '0', WOUND), 'gained');
    assert.deepEqual(G.playerZones['0']!.discard, ['d', WOUND]);
  });

  it('offers Diving Block like gainWoundForPlayer and reports diving-block-pending', () => {
    const G = makeG(true);
    assert.equal(gainHeldWoundWithOutcome(G, '0', WOUND), 'diving-block-pending');
    assert.equal(G.pendingDivingBlockWounds?.length, 1);
  });

  it('a seat with no zones never drops the Wound: it goes to the stack bottom', () => {
    const G = makeG(false);
    G.piles.wounds = ['top' as CardExtId];
    assert.equal(gainHeldWoundWithOutcome(G, '9', WOUND), 'no-wound');
    assert.deepEqual(G.piles.wounds, ['top', WOUND]);
  });
});
