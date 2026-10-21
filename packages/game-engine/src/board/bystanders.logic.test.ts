/**
 * Tests for bystander capture helpers.
 *
 * Verifies attachBystanderToVillain, awardAttachedBystanders, and
 * carryEscapedBystandersToPile behavior, immutability, and JSON serializability,
 * plus the WP-816 Savior helpers and their parity with the hero Savior gate.
 *
 * Uses node:test and node:assert only — no boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  attachBystanderToVillain,
  awardAttachedBystanders,
  carryEscapedBystandersToPile,
  SAVIOR_BYSTANDER_THRESHOLD,
  countVictoryPileBystanders,
  findFirstVictoryPileBystander,
} from './bystanders.logic.js';
import { evaluateCondition } from '../hero/heroConditions.evaluate.js';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';

describe('attachBystanderToVillain', () => {
  it('takes pile[0] bystander (top-of-pile convention)', () => {
    const bystandersPile = ['bystander-1', 'bystander-2', 'bystander-3'];
    const attachedBystanders = {};

    const result = attachBystanderToVillain(
      bystandersPile,
      'villain-a',
      attachedBystanders,
    );

    assert.deepStrictEqual(result.attachedBystanders['villain-a'], ['bystander-1']);
    assert.deepStrictEqual(result.bystandersPile, ['bystander-2', 'bystander-3']);
  });

  it('removes from pile and adds to mapping', () => {
    const bystandersPile = ['bystander-1'];
    const attachedBystanders = {};

    const result = attachBystanderToVillain(
      bystandersPile,
      'villain-x',
      attachedBystanders,
    );

    assert.equal(result.bystandersPile.length, 0);
    assert.ok('villain-x' in result.attachedBystanders);
    assert.deepStrictEqual(result.attachedBystanders['villain-x'], ['bystander-1']);
  });

  it('empty bystander pile: returns unchanged', () => {
    const bystandersPile: string[] = [];
    const attachedBystanders = { 'villain-a': ['bystander-existing'] };

    const result = attachBystanderToVillain(
      bystandersPile,
      'villain-b',
      attachedBystanders,
    );

    assert.deepStrictEqual(result.bystandersPile, []);
    assert.ok(!('villain-b' in result.attachedBystanders));
    assert.deepStrictEqual(
      result.attachedBystanders['villain-a'],
      ['bystander-existing'],
    );
  });
});

describe('awardAttachedBystanders', () => {
  it('moves attached bystanders to victory zone', () => {
    const attachedBystanders = {
      'villain-a': ['bystander-1', 'bystander-2'],
      'villain-b': ['bystander-3'],
    };
    const playerVictory = ['villain-a'];

    const result = awardAttachedBystanders(
      'villain-a',
      attachedBystanders,
      playerVictory,
    );

    assert.deepStrictEqual(
      result.playerVictory,
      ['villain-a', 'bystander-1', 'bystander-2'],
    );
  });

  it('removes the mapping entry', () => {
    const attachedBystanders = {
      'villain-a': ['bystander-1'],
      'villain-b': ['bystander-2'],
    };

    const result = awardAttachedBystanders(
      'villain-a',
      attachedBystanders,
      [],
    );

    assert.ok(!('villain-a' in result.attachedBystanders));
    assert.deepStrictEqual(result.attachedBystanders['villain-b'], ['bystander-2']);
  });

  it('no mapping entry: returns unchanged', () => {
    const attachedBystanders = { 'villain-b': ['bystander-1'] };
    const playerVictory = ['card-a'];

    const result = awardAttachedBystanders(
      'villain-nonexistent',
      attachedBystanders,
      playerVictory,
    );

    assert.deepStrictEqual(result.playerVictory, ['card-a']);
    assert.deepStrictEqual(
      result.attachedBystanders['villain-b'],
      ['bystander-1'],
    );
  });
});

describe('carryEscapedBystandersToPile', () => {
  it('carries bystanders into the escaped pile and removes mapping', () => {
    const attachedBystanders = {
      'villain-a': ['bystander-1', 'bystander-2'],
    };
    const escapedPile = ['core-villain-brotherhood-blob-00'];

    const result = carryEscapedBystandersToPile(
      'villain-a',
      attachedBystanders,
      escapedPile,
    );

    // why: bystanders are carried INTO the escaped pile (D-24314), not returned
    // to the supply — this is what makes them countable for resource losses.
    assert.deepStrictEqual(
      result.escapedPile,
      ['core-villain-brotherhood-blob-00', 'bystander-1', 'bystander-2'],
    );
    assert.ok(!('villain-a' in result.attachedBystanders));
  });

  it('no mapping entry: returns the escaped pile unchanged (no-op)', () => {
    const attachedBystanders = { 'villain-b': ['bystander-1'] };
    const escapedPile = ['core-villain-brotherhood-blob-00'];

    const result = carryEscapedBystandersToPile(
      'villain-a',
      attachedBystanders,
      escapedPile,
    );

    assert.deepStrictEqual(result.escapedPile, ['core-villain-brotherhood-blob-00']);
    assert.deepStrictEqual(result.attachedBystanders['villain-b'], ['bystander-1']);
  });

  it('does not mutate the input escaped pile', () => {
    const escapedPile = ['v-1'];
    const result = carryEscapedBystandersToPile(
      'villain-a',
      { 'villain-a': ['bystander-1'] },
      escapedPile,
    );

    assert.deepStrictEqual(escapedPile, ['v-1'], 'input escaped pile must be unchanged');
    assert.deepStrictEqual(result.escapedPile, ['v-1', 'bystander-1']);
  });
});

describe('bystander helpers — JSON serialization', () => {
  it('JSON.stringify succeeds for all returned structures', () => {
    const attachResult = attachBystanderToVillain(
      ['bystander-1'],
      'villain-a',
      {},
    );
    assert.ok(
      JSON.stringify(attachResult).length > 0,
      'attachBystanderToVillain result must serialize',
    );

    const awardResult = awardAttachedBystanders(
      'villain-a',
      { 'villain-a': ['bystander-1'] },
      ['villain-a'],
    );
    assert.ok(
      JSON.stringify(awardResult).length > 0,
      'awardAttachedBystanders result must serialize',
    );

    const carryResult = carryEscapedBystandersToPile(
      'villain-a',
      { 'villain-a': ['bystander-1'] },
      [],
    );
    assert.ok(
      JSON.stringify(carryResult).length > 0,
      'carryEscapedBystandersToPile result must serialize',
    );
  });
});

describe('WP-816 Savior helpers (D-24749)', () => {
  const VILLAIN = 'ca75-villain-masters-of-evil-wwii-black-knight-00' as CardExtId;

  it('T9: countVictoryPileBystanders counts both Bystander arms and nothing else', () => {
    const victory = [
      VILLAIN,
      'pile-bystander',
      'bystander-villain-deck-03',
      'pile-wound',
    ] as CardExtId[];
    const snapshot = [...victory];
    assert.equal(countVictoryPileBystanders(victory), 2);
    assert.deepStrictEqual(victory, snapshot, 'the input must not be mutated');
    assert.equal(countVictoryPileBystanders([]), 0);
  });

  it('T10: findFirstVictoryPileBystander returns the first Bystander in pile order', () => {
    const victory = [VILLAIN, 'bystander-villain-deck-03', 'pile-bystander'] as CardExtId[];
    assert.equal(findFirstVictoryPileBystander(victory), 'bystander-villain-deck-03');
    assert.equal(findFirstVictoryPileBystander([VILLAIN]), undefined);
  });

  it('T11: villain Savior agrees with the hero Savior gate at 0, 2, 3 and 4 Bystanders', () => {
    // why: hero and villain Savior must never disagree in one match (D-24749); this pins
    // the new helper to the hero evaluator, which is deliberately left unedited.
    assert.equal(SAVIOR_BYSTANDER_THRESHOLD, 3);
    const victoryPiles: CardExtId[][] = [
      [VILLAIN],
      [VILLAIN, 'pile-bystander', 'bystander-villain-deck-01'] as CardExtId[],
      ['pile-bystander', VILLAIN, 'bystander-villain-deck-01', 'pile-bystander'] as CardExtId[],
      [
        'bystander-villain-deck-01',
        'bystander-villain-deck-02',
        VILLAIN,
        'pile-bystander',
        'pile-bystander',
      ] as CardExtId[],
    ];
    for (const victory of victoryPiles) {
      const G = {
        playerZones: {
          '0': { deck: [], hand: [], discard: [], inPlay: [], victory },
        },
      } as unknown as LegendaryGameState;
      const isVillainSavior = countVictoryPileBystanders(victory) >= SAVIOR_BYSTANDER_THRESHOLD;
      const isHeroSavior = evaluateCondition(G, '0', {
        type: 'bystandersInVictoryAtLeast',
        value: '3',
      });
      assert.equal(
        isVillainSavior,
        isHeroSavior,
        `hero and villain Savior must agree for Victory Pile ${JSON.stringify(victory)}`,
      );
    }
  });
});
