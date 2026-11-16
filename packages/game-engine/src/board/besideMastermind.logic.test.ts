/**
 * Tests for the Villains-to-the-left-of-the-Mastermind helpers (WP-840 / D-24773, T1).
 *
 * Covers the lazy list (created by the first put, deleted when the last one leaves, never
 * `[]`), index validation, the one guard predicate shared with Fortify, and the lock reason.
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import {
  buildBesideMastermindBlockReason,
  getVillainBesideMastermind,
  isMastermindGuarded,
  listVillainsBesideMastermind,
  putVillainBesideMastermind,
  takeVillainBesideMastermind,
} from './besideMastermind.logic.js';

const BLOB_00 = 'co2e-villain-brotherhood-of-mutants-the-blob-00' as CardExtId;
const BLOB_01 = 'co2e-villain-brotherhood-of-mutants-the-blob-01' as CardExtId;
const COLLEEN_WING = 'cvwr-villain-heroes-for-hire-colleen-wing-00' as CardExtId;

/**
 * Builds the smallest state the helpers read: the optional list, the fortifications and the
 * display names.
 *
 * @returns A partial game state cast to the full type (the helpers read nothing else).
 */
function makeState(): LegendaryGameState {
  return {
    cardDisplayData: {
      [BLOB_00]: { extId: BLOB_00, name: 'The Blob', imageUrl: '', cost: 0 },
      [BLOB_01]: { extId: BLOB_01, name: 'The Blob', imageUrl: '', cost: 0 },
    },
  } as unknown as LegendaryGameState;
}

describe('WP-840 besideMastermind helpers (T1)', () => {
  it('reads an absent list as empty, unguarded, with no reason', () => {
    const G = makeState();
    assert.deepEqual([...listVillainsBesideMastermind(G)], []);
    assert.equal(getVillainBesideMastermind(G, 0), null);
    assert.equal(isMastermindGuarded(G), false);
    assert.equal(buildBesideMastermindBlockReason(G), null);
    assert.equal('villainsBesideMastermind' in G, false);
  });

  it('puts a Villain once, guards the Mastermind and names it in the reason', () => {
    const G = makeState();
    assert.equal(putVillainBesideMastermind(G, BLOB_00), true);
    assert.equal(putVillainBesideMastermind(G, BLOB_00), false);
    assert.deepEqual(G.villainsBesideMastermind, [BLOB_00]);
    assert.equal(getVillainBesideMastermind(G, 0), BLOB_00);
    assert.equal(isMastermindGuarded(G), true);
    assert.equal(buildBesideMastermindBlockReason(G), 'The Blob is to the left of the Mastermind. Fight The Blob first.');
  });

  it('keeps arrival order and refuses non-integer or out-of-range indexes', () => {
    const G = makeState();
    putVillainBesideMastermind(G, BLOB_00);
    putVillainBesideMastermind(G, BLOB_01);
    assert.deepEqual(G.villainsBesideMastermind, [BLOB_00, BLOB_01]);
    assert.equal(getVillainBesideMastermind(G, 2), null);
    assert.equal(getVillainBesideMastermind(G, -1), null);
    assert.equal(getVillainBesideMastermind(G, 0.5), null);
    assert.equal(getVillainBesideMastermind(G, '0'), null);
    assert.equal(getVillainBesideMastermind(G, Number.NaN), null);
  });

  it('takes entries out and deletes the field when it empties (never [])', () => {
    const G = makeState();
    putVillainBesideMastermind(G, BLOB_00);
    putVillainBesideMastermind(G, BLOB_01);
    assert.equal(takeVillainBesideMastermind(G, 5), null);
    assert.equal(takeVillainBesideMastermind(G, 1), BLOB_01);
    assert.deepEqual(G.villainsBesideMastermind, [BLOB_00]);
    assert.equal(takeVillainBesideMastermind(G, 0), BLOB_00);
    assert.equal('villainsBesideMastermind' in G, false);
    assert.equal(isMastermindGuarded(G), false);
  });

  it('counts a fortifier as a guard too, with no Blob reason', () => {
    const G = makeState();
    G.fortifications = { mastermind: { villainCardId: COLLEEN_WING, lock: 'no-fight' } };
    assert.equal(isMastermindGuarded(G), true);
    assert.equal(buildBesideMastermindBlockReason(G), null);
  });

  it('falls back to the card id when no display name exists', () => {
    const G = makeState();
    G.cardDisplayData = {};
    putVillainBesideMastermind(G, BLOB_00);
    assert.equal(buildBesideMastermindBlockReason(G), `${BLOB_00} is to the left of the Mastermind. Fight ${BLOB_00} first.`);
  });
});
