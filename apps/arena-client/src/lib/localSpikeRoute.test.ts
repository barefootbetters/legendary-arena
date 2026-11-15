/**
 * WP-890 (D-24842): `?route=local-spike` opens the spike only with the flag on.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { isLocalSpikeRoute } from './localSpikeRoute';

describe('isLocalSpikeRoute', () => {
  test("'local-spike' with the flag on opens the spike", () => {
    assert.equal(isLocalSpikeRoute('local-spike', true), true);
  });

  test("'local-spike' with the flag off does not", () => {
    assert.equal(isLocalSpikeRoute('local-spike', false), false);
  });

  test('another route value with the flag on does not', () => {
    assert.equal(isLocalSpikeRoute('workshop', true), false);
  });

  test('another route value with the flag off does not', () => {
    assert.equal(isLocalSpikeRoute('workshop', false), false);
  });

  test('no route value with the flag on does not', () => {
    assert.equal(isLocalSpikeRoute(null, true), false);
  });

  test('no route value with the flag off does not', () => {
    assert.equal(isLocalSpikeRoute(null, false), false);
  });
});
