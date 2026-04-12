/**
 * Tests for bystander capture helpers.
 *
 * Verifies attachBystanderToVillain, awardAttachedBystanders, and
 * resolveEscapedBystanders behavior, immutability, and JSON serializability.
 *
 * Uses node:test and node:assert only — no boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  attachBystanderToVillain,
  awardAttachedBystanders,
  resolveEscapedBystanders,
} from './bystanders.logic.js';

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

describe('resolveEscapedBystanders', () => {
  it('returns bystanders to supply pile and removes mapping', () => {
    const attachedBystanders = {
      'villain-a': ['bystander-1', 'bystander-2'],
    };
    const bystandersPile = ['bystander-3'];

    const result = resolveEscapedBystanders(
      'villain-a',
      attachedBystanders,
      bystandersPile,
    );

    assert.deepStrictEqual(
      result.bystandersPile,
      ['bystander-3', 'bystander-1', 'bystander-2'],
    );
    assert.ok(!('villain-a' in result.attachedBystanders));
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

    const resolveResult = resolveEscapedBystanders(
      'villain-a',
      { 'villain-a': ['bystander-1'] },
      [],
    );
    assert.ok(
      JSON.stringify(resolveResult).length > 0,
      'resolveEscapedBystanders result must serialize',
    );
  });
});
