/**
 * Tests for buildCardVictoryPoints — setup-time printed-VP resolution (WP-365 / D-24157).
 *
 * node:test only. No boardgame.io imports. Structural registry mock.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCardVictoryPoints,
  normalizePrintedVictoryPoints,
} from './buildCardVictoryPoints.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { CardExtId } from '../state/zones.types.js';

// why: buildCardVictoryPoints reads only villainGroupIds / henchmanGroupIds /
// mastermindId; the other locked fields are present for shape fidelity.
function makeConfig(overrides: Partial<MatchSetupConfig> = {}): MatchSetupConfig {
  return {
    schemeId: 'core/midtown-bank-robbery',
    mastermindId: 'core/magneto',
    villainGroupIds: ['core/brotherhood'],
    henchmanGroupIds: ['core/sentinel'],
    heroDeckIds: ['core/black-widow'],
    bystandersCount: 30,
    woundsCount: 30,
    officersCount: 30,
    sidekicksCount: 0,
    ...overrides,
  } as MatchSetupConfig;
}

/** A structural registry whose `core` set carries printed vp for each card kind. */
function makeRegistry(): { getSet(abbr: string): unknown } {
  return {
    getSet(abbr: string): unknown {
      if (abbr !== 'core') return undefined;
      return {
        villains: [
          {
            slug: 'brotherhood',
            cards: [
              { slug: 'juggernaut', vp: 4, copies: 1 },
              { slug: 'blob', vp: 2, copies: 1 },
              // why: a null-vp villain must be OMITTED so scoring's fallback applies.
              { slug: 'mystery', vp: null, copies: 1 },
            ],
          },
        ],
        henchmen: [{ slug: 'sentinel', vp: 1 }],
        masterminds: [{ slug: 'magneto', vp: 5 }],
      };
    },
  };
}

const MAGNETO_BASE_CARD_ID = 'core-mastermind-magneto-magneto' as CardExtId;

describe('normalizePrintedVictoryPoints', () => {
  test('accepts non-negative integers and numeric strings, including 0', () => {
    assert.equal(normalizePrintedVictoryPoints(4), 4);
    assert.equal(normalizePrintedVictoryPoints(0), 0);
    assert.equal(normalizePrintedVictoryPoints('2'), 2);
    assert.equal(normalizePrintedVictoryPoints(' 3 '), 3);
  });

  test('omits null / undefined / empty / non-numeric / negative / non-integer', () => {
    assert.equal(normalizePrintedVictoryPoints(null), undefined);
    assert.equal(normalizePrintedVictoryPoints(undefined), undefined);
    assert.equal(normalizePrintedVictoryPoints(''), undefined);
    assert.equal(normalizePrintedVictoryPoints('x'), undefined);
    assert.equal(normalizePrintedVictoryPoints(-1), undefined);
    assert.equal(normalizePrintedVictoryPoints(2.5), undefined);
    assert.equal(normalizePrintedVictoryPoints('2.5'), undefined);
  });
});

describe('buildCardVictoryPoints', () => {
  test('keys villains by copy-suffixed instance ext_id with their printed vp', () => {
    const vp = buildCardVictoryPoints(makeRegistry(), makeConfig(), MAGNETO_BASE_CARD_ID);
    assert.equal(vp['core-villain-brotherhood-juggernaut-00' as CardExtId], 4);
    assert.equal(vp['core-villain-brotherhood-blob-00' as CardExtId], 2);
  });

  test('omits a null-vp villain (scoring fallback applies)', () => {
    const vp = buildCardVictoryPoints(makeRegistry(), makeConfig(), MAGNETO_BASE_CARD_ID);
    assert.equal(vp['core-villain-brotherhood-mystery-00' as CardExtId], undefined);
  });

  test('keys all 10 henchman virtual copies with the group vp', () => {
    const vp = buildCardVictoryPoints(makeRegistry(), makeConfig(), MAGNETO_BASE_CARD_ID);
    for (let copyIndex = 0; copyIndex < 10; copyIndex++) {
      const paddedIndex = String(copyIndex).padStart(2, '0');
      assert.equal(vp[`henchman-sentinel-${paddedIndex}` as CardExtId], 1);
    }
  });

  test('keys the mastermind vp by the passed baseCardId', () => {
    const vp = buildCardVictoryPoints(makeRegistry(), makeConfig(), MAGNETO_BASE_CARD_ID);
    assert.equal(vp[MAGNETO_BASE_CARD_ID], 5);
  });

  test('returns an empty map for a non-reader registry (EMPTY_REGISTRY parity)', () => {
    const vp = buildCardVictoryPoints({}, makeConfig(), MAGNETO_BASE_CARD_ID);
    assert.deepEqual(vp, {});
  });

  test('returns an empty map when no card carries a printed vp', () => {
    const emptyRegistry = {
      getSet(): unknown {
        return { villains: [], henchmen: [], masterminds: [] };
      },
    };
    const vp = buildCardVictoryPoints(emptyRegistry, makeConfig(), MAGNETO_BASE_CARD_ID);
    assert.deepEqual(vp, {});
  });

  test('result is JSON-serializable', () => {
    const vp = buildCardVictoryPoints(makeRegistry(), makeConfig(), MAGNETO_BASE_CARD_ID);
    assert.doesNotThrow(() => JSON.stringify(vp));
  });
});
