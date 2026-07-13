/**
 * Tests for the Registry Viewer `?lagn=` link encoder (WP-363 / EC-393).
 *
 * Pure. The round-trip is asserted by decoding the encoder's output with the
 * canonical base64url inverse (Node `Buffer`), NOT by importing WP-362's
 * registry-viewer decoder — a cross-app import would couple the two apps. Both
 * sides implement the same `base64url(UTF-8 JSON)` contract (D-24154); each tests
 * its own half against the standard.
 *
 * Authority: WP-363 §Scope (In) §E; EC-393; D-24155; D-24154 (encoding contract).
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { encodeLagnToViewerUrl, REGISTRY_VIEWER_ORIGIN } from './lagnShareLink';

/** Decode a viewer `?lagn=` URL back to its document (the base64url inverse). */
function decodeViewerUrl(url: string): unknown {
  const encoded = new URL(url).searchParams.get('lagn');
  assert.ok(encoded, 'the URL carries a lagn param');
  const json = Buffer.from(encoded, 'base64url').toString('utf-8');
  return JSON.parse(json);
}

const SAMPLE_LAGN = {
  lagn_version: '1.0.0',
  game_id: 'match-1',
  variant: 'cooperative',
  player_count: 2,
  setup: {
    mastermind: { id: 'core/loki-god-of-mischief', name: 'Loki — Kräven 日本' },
    scheme: { id: 'core/the-legacy-virus', name: 'Legacy Virus' },
  },
};

describe('encodeLagnToViewerUrl', () => {
  test('builds ${origin}/?lagn=… with exactly one slash before ?', () => {
    const url = encodeLagnToViewerUrl(SAMPLE_LAGN, REGISTRY_VIEWER_ORIGIN);
    assert.ok(url.startsWith(`${REGISTRY_VIEWER_ORIGIN}/?lagn=`));
    // no double slash before the query
    assert.equal(url.includes('//?'), false);
    // exactly one "/?" join
    assert.equal(url.split('/?').length, 2);
  });

  test('round-trips by parsed value, incl. a multi-byte UTF-8 name', () => {
    const url = encodeLagnToViewerUrl(SAMPLE_LAGN, REGISTRY_VIEWER_ORIGIN);
    assert.deepEqual(decodeViewerUrl(url), SAMPLE_LAGN);
  });

  test('produces URL-safe base64url (no +, /, or = in the payload)', () => {
    // a document whose JSON base64 would contain + and / without url-safing
    const url = encodeLagnToViewerUrl({ blob: '???>>><<<ÿÿ' }, REGISTRY_VIEWER_ORIGIN);
    const payload = new URL(url).searchParams.get('lagn') ?? '';
    assert.equal(/[+/=]/.test(payload), false);
  });

  test('treats lagn opaquely — an arbitrary object still round-trips', () => {
    const opaque = { anything: [1, 2, { deep: 'value' }], n: null };
    const url = encodeLagnToViewerUrl(opaque, REGISTRY_VIEWER_ORIGIN);
    assert.deepEqual(decodeViewerUrl(url), opaque);
  });

  test('the opened URL carries no bearer/token substring', () => {
    const url = encodeLagnToViewerUrl(SAMPLE_LAGN, REGISTRY_VIEWER_ORIGIN);
    assert.equal(/bearer|authorization|token/i.test(url), false);
  });

  test('REGISTRY_VIEWER_ORIGIN has no trailing slash', () => {
    assert.equal(REGISTRY_VIEWER_ORIGIN.endsWith('/'), false);
  });
});
