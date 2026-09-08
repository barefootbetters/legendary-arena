/**
 * Scheme Transform logic tests (WP-670 / D-24484).
 *
 * Tests transformScheme, countBystandersInKo, and the per-move checkAndTransformScheme.
 * node:test + node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  transformScheme,
  countBystandersInKo,
  checkAndTransformScheme,
  SCHEME_TRANSFORM_TARGETS,
} from './schemeTransform.logic.js';
import type { SchemeState } from './schemeState.types.js';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';

const CHTHON_BASE = 'mdns/ritual-sacrifice-to-summon-chthon';
const CHTHON_TARGET = 'mdns/great-old-one-chthon';

/** A captured (not-yet-flipped) Chthon scheme state. */
function chthonScheme(): SchemeState {
  return {
    twistPile: [],
    gameText: ['Ritual Sacrifice text'],
    transformTargetSchemeId: CHTHON_TARGET as CardExtId,
    transformTargetGameText: ['Chthon text A', 'Chthon text B'],
    hasTransformed: false,
  };
}

describe('transformScheme (WP-670 / D-24484)', () => {
  it('flips: sets hasTransformed and swaps gameText to the Great Old One text', () => {
    const flipped = transformScheme(chthonScheme());
    assert.strictEqual(flipped.hasTransformed, true);
    assert.deepStrictEqual(flipped.gameText, ['Chthon text A', 'Chthon text B']);
    assert.deepStrictEqual(flipped.twistPile, [], 'unrelated fields survive (copy-then-override)');
  });

  it('is a no-op for a non-transform scheme (no target text)', () => {
    const plain: SchemeState = { twistPile: [], gameText: ['Legacy Virus text'] };
    assert.strictEqual(transformScheme(plain), plain, 'returns the input unchanged');
  });

  it('is a no-op for an already-transformed scheme', () => {
    const already: SchemeState = { ...chthonScheme(), hasTransformed: true };
    assert.strictEqual(transformScheme(already), already, 'does not double-flip');
  });
});

describe('countBystandersInKo (WP-670 / D-24484)', () => {
  it('counts bystander-villain-deck ids and ignores others', () => {
    const ko = [
      'bystander-villain-deck-00', 'bystander-villain-deck-01', 'core-villain-hydra-x',
      'bystander-villain-deck-02', 'starting-shield-agent',
    ] as CardExtId[];
    assert.strictEqual(countBystandersInKo(ko), 3);
  });

  it('returns 0 for an empty KO pile', () => {
    assert.strictEqual(countBystandersInKo([]), 0);
  });
});

describe('checkAndTransformScheme (WP-670 / D-24484)', () => {
  function makeState(overrides: { schemeId?: string; scheme?: SchemeState; ko?: CardExtId[] }): LegendaryGameState {
    return {
      selection: { schemeId: overrides.schemeId ?? CHTHON_BASE },
      scheme: overrides.scheme ?? chthonScheme(),
      ko: overrides.ko ?? [],
      messages: [],
    } as unknown as LegendaryGameState;
  }

  const fiveBystanders = [
    'bystander-villain-deck-00', 'bystander-villain-deck-01', 'bystander-villain-deck-02',
    'bystander-villain-deck-03', 'bystander-villain-deck-04',
  ] as CardExtId[];

  it('flips the scheme when the KO pile reaches the Bystander threshold', () => {
    const gameState = makeState({ ko: fiveBystanders });
    checkAndTransformScheme(gameState);
    assert.strictEqual(gameState.scheme.hasTransformed, true, 'the scheme flipped');
    assert.deepStrictEqual(gameState.scheme.gameText, ['Chthon text A', 'Chthon text B']);
    const awaken = gameState.messages.find((entry) => entry.text.includes('Great Old One awakens'));
    assert.ok(awaken !== undefined && awaken.outcome === 'threat', 'a threat awakening line is logged');
  });

  it('does NOT flip below the threshold (4 Bystanders)', () => {
    const gameState = makeState({ ko: fiveBystanders.slice(0, 4) });
    checkAndTransformScheme(gameState);
    assert.notStrictEqual(gameState.scheme.hasTransformed, true, 'not flipped below 5');
    assert.equal(gameState.messages.length, 0, 'no awakening line');
  });

  it('is a no-op for a non-transform scheme even with 5 Bystanders KO\'d', () => {
    const plain: SchemeState = { twistPile: [], gameText: ['Legacy Virus text'] };
    const gameState = makeState({ schemeId: 'core/legacy-virus-the', scheme: plain, ko: fiveBystanders });
    checkAndTransformScheme(gameState);
    assert.strictEqual(gameState.scheme, plain, 'the scheme is untouched');
    assert.equal(gameState.messages.length, 0, 'no log line for a non-transform scheme');
  });

  it('does not re-flip an already-transformed scheme', () => {
    const already: SchemeState = { ...chthonScheme(), hasTransformed: true, gameText: ['Chthon text A', 'Chthon text B'] };
    const gameState = makeState({ scheme: already, ko: fiveBystanders });
    checkAndTransformScheme(gameState);
    assert.equal(gameState.messages.length, 0, 'no second awakening line');
  });
});

describe('SCHEME_TRANSFORM_TARGETS (WP-670 / D-24484)', () => {
  it('pairs Chthon\'s base scheme to its Great Old One at threshold 5', () => {
    const target = SCHEME_TRANSFORM_TARGETS[CHTHON_BASE];
    assert.ok(target !== undefined, 'Chthon is in the allowlist');
    assert.strictEqual(target.targetSchemeId, CHTHON_TARGET);
    assert.strictEqual(target.bystandersInKoToTransform, 5);
  });
});
