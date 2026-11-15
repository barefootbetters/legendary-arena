/**
 * Charge (WP-874 / D-24820): the pure `chargeCityVillainOneSpace` City step.
 *
 * No boardgame.io imports. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { chargeCityVillainOneSpace } from './villainCharge.logic.js';
import type { CityZone } from './city.types.js';
import type { CardExtId } from '../state/zones.types.js';

const CHARGER = 'test-villain-crew-charger-00' as CardExtId;
const ALPHA = 'test-villain-crew-alpha-00' as CardExtId;
const BETA = 'test-villain-crew-beta-00' as CardExtId;
const GAMMA = 'test-villain-crew-gamma-00' as CardExtId;
const DELTA = 'test-villain-crew-delta-00' as CardExtId;
const EPSILON = 'test-villain-crew-epsilon-00' as CardExtId;

describe('WP-874 chargeCityVillainOneSpace (RS-4, D-24820)', () => {
  it('an empty destination: the charger moves one space, nothing is pushed', () => {
    const result = chargeCityVillainOneSpace([CHARGER, null, null, null, null], 0);

    assert.deepStrictEqual(result, {
      city: [null, CHARGER, null, null, null],
      hasPushedVillain: false,
      escapedCardId: null,
      hasChargerEscaped: false,
    });
  });

  it('an occupied destination with a gap ahead: only the contiguous block shifts', () => {
    const result = chargeCityVillainOneSpace([CHARGER, ALPHA, BETA, null, GAMMA], 0);

    assert.deepStrictEqual(result, {
      city: [null, CHARGER, ALPHA, BETA, GAMMA],
      hasPushedVillain: true,
      escapedCardId: null,
      hasChargerEscaped: false,
    });
  });

  it('a full block to the edge ejects the last card', () => {
    const result = chargeCityVillainOneSpace([null, CHARGER, ALPHA, BETA, GAMMA], 1);

    assert.deepStrictEqual(result, {
      city: [null, null, CHARGER, ALPHA, BETA],
      hasPushedVillain: true,
      escapedCardId: GAMMA,
      hasChargerEscaped: false,
    });
  });

  it('a charger on the last space escapes itself', () => {
    const result = chargeCityVillainOneSpace([ALPHA, null, null, null, CHARGER], 4);

    assert.deepStrictEqual(result, {
      city: [ALPHA, null, null, null, null],
      hasPushedVillain: false,
      escapedCardId: CHARGER,
      hasChargerEscaped: true,
    });
  });

  for (const fromIndex of [-1, 5, 1.5, Number.NaN]) {
    it(`an out-of-range fromIndex (${String(fromIndex)}) returns an unchanged copy`, () => {
      const city: CityZone = [CHARGER, ALPHA, null, null, null];
      const result = chargeCityVillainOneSpace(city, fromIndex);

      assert.deepStrictEqual(result, {
        city: [CHARGER, ALPHA, null, null, null],
        hasPushedVillain: false,
        escapedCardId: null,
        hasChargerEscaped: false,
      });
      assert.notEqual(result.city, city, 'a copy, not the input array');
    });
  }

  it('an empty space at fromIndex returns an unchanged copy', () => {
    const result = chargeCityVillainOneSpace([null, ALPHA, null, null, null], 0);

    assert.deepStrictEqual(result, {
      city: [null, ALPHA, null, null, null],
      hasPushedVillain: false,
      escapedCardId: null,
      hasChargerEscaped: false,
    });
  });

  it('never mutates the input array', () => {
    const city: CityZone = [null, CHARGER, ALPHA, BETA, GAMMA];
    const snapshot = [...city];

    chargeCityVillainOneSpace(city, 1);
    chargeCityVillainOneSpace(city, 4);

    assert.deepStrictEqual(city, snapshot);
  });

  it('works on a grown six-space City (the escape edge is the last space)', () => {
    const pushed = chargeCityVillainOneSpace([null, null, CHARGER, ALPHA, BETA, GAMMA], 2);
    assert.deepStrictEqual(pushed, {
      city: [null, null, null, CHARGER, ALPHA, BETA],
      hasPushedVillain: true,
      escapedCardId: GAMMA,
      hasChargerEscaped: false,
    });

    const absorbed = chargeCityVillainOneSpace([CHARGER, ALPHA, BETA, GAMMA, DELTA, null], 0);
    assert.deepStrictEqual(absorbed, {
      city: [null, CHARGER, ALPHA, BETA, GAMMA, DELTA],
      hasPushedVillain: true,
      escapedCardId: null,
      hasChargerEscaped: false,
    });

    const fromLast = chargeCityVillainOneSpace([EPSILON, null, null, null, null, CHARGER], 5);
    assert.deepStrictEqual(fromLast, {
      city: [EPSILON, null, null, null, null, null],
      hasPushedVillain: false,
      escapedCardId: CHARGER,
      hasChargerEscaped: true,
    });
  });
});
