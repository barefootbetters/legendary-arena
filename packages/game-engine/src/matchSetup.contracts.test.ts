import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateMatchSetup } from './matchSetup.validate.js';
import type { CardRegistryReader } from './matchSetup.validate.js';
import type { MatchSetupConfig } from './matchSetup.types.js';
import type { MatchConfiguration } from './types.js';

/**
 * Creates an inline mock registry containing the given ext_id keys.
 *
 * The mock satisfies the CardRegistryReader interface used by
 * validateMatchSetup. No boardgame.io imports are needed.
 *
 * @param keys - The ext_id strings to include in the mock registry.
 * @returns A CardRegistryReader whose listCards returns FlatCard-like objects.
 */
function createMockRegistry(keys: string[]): CardRegistryReader {
  return {
    listCards() {
      const cards: Array<{ key: string }> = [];
      for (const key of keys) {
        cards.push({ key });
      }
      return cards;
    },
  };
}

/** A valid MatchSetupConfig input with all 9 fields. */
function createValidInput(): Record<string, unknown> {
  return {
    schemeId: 'test-scheme-001',
    mastermindId: 'test-mastermind-001',
    villainGroupIds: ['test-villain-group-001', 'test-villain-group-002'],
    henchmanGroupIds: ['test-henchman-group-001'],
    heroDeckIds: ['test-hero-deck-001', 'test-hero-deck-002', 'test-hero-deck-003'],
    bystandersCount: 30,
    woundsCount: 30,
    officersCount: 30,
    sidekicksCount: 0,
  };
}

/** All ext_ids referenced in createValidInput(). */
const ALL_KNOWN_EXT_IDS = [
  'test-scheme-001',
  'test-mastermind-001',
  'test-villain-group-001',
  'test-villain-group-002',
  'test-henchman-group-001',
  'test-hero-deck-001',
  'test-hero-deck-002',
  'test-hero-deck-003',
];

describe('validateMatchSetup', () => {
  it('returns ok: true for a valid config with all ext_ids in the registry', () => {
    const registry = createMockRegistry(ALL_KNOWN_EXT_IDS);
    const input = createValidInput();

    const result = validateMatchSetup(input, registry);

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.schemeId, 'test-scheme-001');
      assert.equal(result.value.mastermindId, 'test-mastermind-001');
      assert.deepEqual(result.value.villainGroupIds, ['test-villain-group-001', 'test-villain-group-002']);
      assert.deepEqual(result.value.henchmanGroupIds, ['test-henchman-group-001']);
      assert.deepEqual(result.value.heroDeckIds, ['test-hero-deck-001', 'test-hero-deck-002', 'test-hero-deck-003']);
      assert.equal(result.value.bystandersCount, 30);
      assert.equal(result.value.woundsCount, 30);
      assert.equal(result.value.officersCount, 30);
      assert.equal(result.value.sidekicksCount, 0);
    }
  });

  it('returns ok: false with correct field name when a required field is missing', () => {
    const registry = createMockRegistry(ALL_KNOWN_EXT_IDS);
    const input = createValidInput();
    delete input.schemeId;

    const result = validateMatchSetup(input, registry);

    assert.equal(result.ok, false);
    if (!result.ok) {
      const schemeError = result.errors.find((error) => error.field === 'schemeId');
      assert.ok(schemeError, 'Expected an error for the schemeId field.');
      assert.ok(
        schemeError.message.length > 10,
        'Error message should be a full sentence.',
      );
    }
  });

  it('returns ok: false when a count field is invalid (negative number)', () => {
    const registry = createMockRegistry(ALL_KNOWN_EXT_IDS);
    const input = createValidInput();
    input.bystandersCount = -1;

    const result = validateMatchSetup(input, registry);

    assert.equal(result.ok, false);
    if (!result.ok) {
      const countError = result.errors.find((error) => error.field === 'bystandersCount');
      assert.ok(countError, 'Expected an error for the bystandersCount field.');
      assert.ok(
        countError.message.length > 10,
        'Error message should be a full sentence.',
      );
    }
  });

  it('returns ok: false with correct field name when an ext_id is unknown', () => {
    // why: Registry contains all IDs except mastermindId, so only that
    // field should fail the ext_id existence check.
    const registryWithoutMastermind = createMockRegistry(
      ALL_KNOWN_EXT_IDS.filter((id) => id !== 'test-mastermind-001'),
    );
    const input = createValidInput();

    const result = validateMatchSetup(input, registryWithoutMastermind);

    assert.equal(result.ok, false);
    if (!result.ok) {
      const mastermindError = result.errors.find((error) => error.field === 'mastermindId');
      assert.ok(mastermindError, 'Expected an error for the mastermindId field.');
      assert.ok(
        mastermindError.message.includes('test-mastermind-001'),
        'Error message should include the unknown ext_id.',
      );
    }
  });
});

describe('validateMatchSetup — no-throw contract', () => {
  it('never throws, even with null input', () => {
    const registry = createMockRegistry([]);
    const result = validateMatchSetup(null, registry);
    assert.equal(result.ok, false);
    assert.ok(Array.isArray((result as { ok: false; errors: unknown[] }).errors));
  });

  it('never throws, even with undefined input', () => {
    const registry = createMockRegistry([]);
    const result = validateMatchSetup(undefined, registry);
    assert.equal(result.ok, false);
  });

  it('never throws, even with a number input', () => {
    const registry = createMockRegistry([]);
    const result = validateMatchSetup(42, registry);
    assert.equal(result.ok, false);
  });

  it('never throws, even with an array input', () => {
    const registry = createMockRegistry([]);
    const result = validateMatchSetup([1, 2, 3], registry);
    assert.equal(result.ok, false);
  });

  it('always returns an object with an ok property', () => {
    const registry = createMockRegistry(ALL_KNOWN_EXT_IDS);

    const validResult = validateMatchSetup(createValidInput(), registry);
    assert.equal(typeof validResult.ok, 'boolean');

    const invalidResult = validateMatchSetup({}, registry);
    assert.equal(typeof invalidResult.ok, 'boolean');
  });
});

describe('MatchConfiguration / MatchSetupConfig compatibility', () => {
  it('MatchConfiguration is assignable from MatchSetupConfig and vice versa', () => {
    // why: MatchConfiguration is a type alias for MatchSetupConfig.
    // This test proves the two types are interchangeable at compile time
    // and that no fields are missing or extra. If either type changes
    // without updating the other, this test will fail to compile.
    const config: MatchSetupConfig = {
      schemeId: 'test-scheme',
      mastermindId: 'test-mastermind',
      villainGroupIds: ['vg-1'],
      henchmanGroupIds: ['hg-1'],
      heroDeckIds: ['hd-1'],
      bystandersCount: 10,
      woundsCount: 10,
      officersCount: 10,
      sidekicksCount: 0,
    };

    // Assign MatchSetupConfig to MatchConfiguration — must compile
    const asMatchConfiguration: MatchConfiguration = config;
    // Assign MatchConfiguration back to MatchSetupConfig — must compile
    const asMatchSetupConfig: MatchSetupConfig = asMatchConfiguration;

    // Runtime check: both references point to the same shape
    assert.equal(asMatchSetupConfig.schemeId, config.schemeId);
    assert.deepEqual(
      Object.keys(config).sort(),
      [
        'bystandersCount',
        'henchmanGroupIds',
        'heroDeckIds',
        'mastermindId',
        'officersCount',
        'schemeId',
        'sidekicksCount',
        'villainGroupIds',
        'woundsCount',
      ],
      'MatchSetupConfig must have exactly 9 fields with the locked names.',
    );
  });
});

describe('validateMatchSetup — CardRegistryReader boundary', () => {
  it('works with a minimal in-memory CardRegistryReader (no registry import)', () => {
    // why: This test proves the validator depends only on the
    // CardRegistryReader interface, not on @legendary-arena/registry.
    // The fake implementation has no imports beyond what the game-engine
    // defines.
    const fakeRegistry: CardRegistryReader = {
      listCards() {
        return [
          { key: 'fake-scheme-001' },
          { key: 'fake-mastermind-001' },
          { key: 'fake-villain-001' },
          { key: 'fake-henchman-001' },
          { key: 'fake-hero-001' },
        ];
      },
    };

    const input = {
      schemeId: 'fake-scheme-001',
      mastermindId: 'fake-mastermind-001',
      villainGroupIds: ['fake-villain-001'],
      henchmanGroupIds: ['fake-henchman-001'],
      heroDeckIds: ['fake-hero-001'],
      bystandersCount: 5,
      woundsCount: 5,
      officersCount: 5,
      sidekicksCount: 0,
    };

    const result = validateMatchSetup(input, fakeRegistry);
    assert.equal(result.ok, true);
  });
});

describe('validateMatchSetup — error accumulation', () => {
  it('accumulates multiple shape errors instead of failing on the first one', () => {
    const registry = createMockRegistry(ALL_KNOWN_EXT_IDS);

    // why: Input has multiple invalid fields. The validator must report
    // all of them, not just the first one encountered.
    const input = {
      schemeId: 123,
      mastermindId: null,
      villainGroupIds: [],
      henchmanGroupIds: 'not-an-array',
      heroDeckIds: [42],
      bystandersCount: -1,
      woundsCount: 3.5,
      officersCount: 'ten',
      sidekicksCount: -99,
    };

    const result = validateMatchSetup(input, registry);

    assert.equal(result.ok, false);
    if (!result.ok) {
      // All 9 fields are invalid — expect an error for each one
      assert.equal(result.errors.length, 9,
        'Expected exactly 9 errors — one for each invalid field.');

      const errorFields = result.errors.map((error) => error.field).sort();
      assert.deepEqual(errorFields, [
        'bystandersCount',
        'henchmanGroupIds',
        'heroDeckIds',
        'mastermindId',
        'officersCount',
        'schemeId',
        'sidekicksCount',
        'villainGroupIds',
        'woundsCount',
      ]);
    }
  });
});
