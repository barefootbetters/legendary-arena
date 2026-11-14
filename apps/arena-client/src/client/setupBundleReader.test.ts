/**
 * WP-890 (D-24842): the plain-data setup bundle reader and its parser.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createSetupBundleReader,
  parseLocalSpikeSetupBundle,
  type LocalSpikeSetupBundle,
} from './setupBundleReader';

/**
 * Builds a small, valid bundle for the reader tests.
 *
 * @param overrides - Fields to replace.
 * @returns A bundle-shaped plain object.
 */
function makeBundleValue(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    bundleKind: 'local-spike-setup-bundle',
    numPlayers: 1,
    matchConfiguration: {
      schemeId: 'core/scheme',
      mastermindId: 'core/mastermind',
      villainGroupIds: ['core/villains'],
      henchmanGroupIds: ['core/henchmen'],
      heroDeckIds: ['core/hero-a', 'core/hero-b', 'core/hero-c'],
      bystandersCount: 30,
      woundsCount: 30,
      officersCount: 30,
      sidekicksCount: 12,
    },
    seed: 'seed',
    matchCardImageUrlCount: 2,
    initialStateHash: 'abcd1234',
    cards: [{ key: 'core-a' }, { key: 'core-b' }],
    sets: [{ abbr: 'core' }],
    setData: { core: { abbr: 'core', heroes: [] } },
    playerCountSetup: {
      1: { villainGroupCount: 1, henchmenGroupCount: 1, villainDeckBystanderCount: 1, heroCount: 3 },
    },
    answers: {
      resolveEffectiveHeroCount: [{ args: ['core/scheme', 1, 3], result: 3 }],
    },
    ...overrides,
  };
}

/**
 * Parses a test bundle.
 *
 * @param overrides - Fields to replace.
 * @returns The typed bundle.
 */
function makeBundle(overrides: Record<string, unknown> = {}): LocalSpikeSetupBundle {
  return parseLocalSpikeSetupBundle(makeBundleValue(overrides));
}

describe('createSetupBundleReader', () => {
  test('serves listCards, listSets, getSet and playerCountSetup from the bundle', () => {
    const bundle = makeBundle();
    const reader = createSetupBundleReader(bundle);
    assert.deepEqual(reader.listCards(), [{ key: 'core-a' }, { key: 'core-b' }]);
    assert.deepEqual(reader.listSets(), [{ abbr: 'core' }]);
    assert.deepEqual(reader.getSet('core'), { abbr: 'core', heroes: [] });
    assert.deepEqual(reader.playerCountSetup, bundle.playerCountSetup);
  });

  test('getSet returns undefined for an abbr the bundle has no data for', () => {
    const reader = createSetupBundleReader(makeBundle());
    assert.equal(reader.getSet('nope'), undefined);
  });

  test('a recorded optional call answers from the bundle', () => {
    const reader = createSetupBundleReader(makeBundle());
    assert.equal(reader.resolveEffectiveHeroCount?.('core/scheme', 1, 3), 3);
  });

  test('an unrecorded call throws the full-sentence error', () => {
    const reader = createSetupBundleReader(makeBundle());
    assert.throws(
      () => reader.resolveEffectiveHeroCount?.('core/other', 2, 3),
      {
        message:
          'The local spike setup bundle has no recorded answer for resolveEffectiveHeroCount("core/other", 2, 3). ' +
          'Re-run pnpm spike:local-bundle for this setup.',
      },
    );
  });

  test('a function never called during recording is left off the reader', () => {
    const reader = createSetupBundleReader(makeBundle());
    assert.equal(reader.resolveEffectiveHenchmenCount, undefined);
    assert.equal(reader.resolveEffectiveVillainGroupCount, undefined);
    assert.equal('resolveEffectiveHenchmenCount' in reader, false);
  });

  test('listCards returns a new array on each call', () => {
    const bundle = makeBundle();
    const reader = createSetupBundleReader(bundle);
    const first = reader.listCards();
    const second = reader.listCards();
    assert.notEqual(first, second);
    first.push({ key: 'core-z' });
    assert.equal(bundle.cards.length, 2);
  });

  test('playerCountSetup is omitted when the bundle has null', () => {
    const reader = createSetupBundleReader(makeBundle({ playerCountSetup: null }));
    assert.equal('playerCountSetup' in reader, false);
  });
});

describe('parseLocalSpikeSetupBundle', () => {
  test('accepts a valid bundle', () => {
    assert.equal(makeBundle().bundleKind, 'local-spike-setup-bundle');
  });

  test('rejects a wrong schemaVersion with a full-sentence error', () => {
    assert.throws(() => makeBundle({ schemaVersion: 2 }), /has schemaVersion 2, but this client reads only schemaVersion 1\./);
  });

  test('rejects a wrong bundleKind with a full-sentence error', () => {
    assert.throws(() => makeBundle({ bundleKind: 'something-else' }), /is not a local spike setup bundle: its bundleKind is something-else/);
  });
});
