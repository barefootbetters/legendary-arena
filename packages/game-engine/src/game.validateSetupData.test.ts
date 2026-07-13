/**
 * Tests for LegendaryGame.validateSetupData — the lobby create-time
 * validation boundary.
 *
 * why: boardgame.io's CreateMatch handler turns a string return from
 * validateSetupData into `ctx.throw(400, message)` (a client-visible,
 * Koa-exposed 400), whereas a throw from setup() becomes an opaque HTTP 500
 * "Internal Server Error". These tests lock that the authoritative
 * match-setup validation runs in validateSetupData so an invalid config
 * (below-floor supply count, unknown ext_id, missing field) surfaces its
 * real reason to the player instead of a generic 500.
 */

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { LegendaryGame, setRegistryForSetup, clearRegistryForSetup } from './game.js';
import type { CardRegistryReader } from './matchSetup.validate.js';
import type { MatchConfiguration } from './types.js';

/**
 * Registry mock satisfying the widened CardRegistryReader interface
 * (listCards + listSets + getSet). Mirrors the proven fixture in
 * matchSetup.contracts.test.ts so a createValidConfig() input resolves —
 * villain group slugs come from villain flat-card keys, henchman groups from
 * getSet().henchmen, heroes from hero flat-card keys.
 */
function createMockRegistry(): CardRegistryReader {
  const testSetData = {
    abbr: 'test',
    schemes: [{ slug: 'test-scheme-001' }],
    masterminds: [{ slug: 'test-mastermind-001' }],
    henchmen: [{ slug: 'test-henchman-group-001' }],
    villains: [
      { slug: 'test-villain-group-001' },
      { slug: 'test-villain-group-002' },
    ],
  };
  return {
    listCards() {
      return [
        { key: 'test-hero-test-hero-001-1', cardType: 'hero', slug: '1', setAbbr: 'test', abilities: [] },
        { key: 'test-hero-test-hero-002-1', cardType: 'hero', slug: '1', setAbbr: 'test', abilities: [] },
        { key: 'test-hero-test-hero-003-1', cardType: 'hero', slug: '1', setAbbr: 'test', abilities: [] },
        { key: 'test-villain-test-villain-group-001-card-a', cardType: 'villain', slug: 'card-a', setAbbr: 'test' },
        { key: 'test-villain-test-villain-group-002-card-a', cardType: 'villain', slug: 'card-a', setAbbr: 'test' },
      ] as Array<{ key: string }>;
    },
    listSets() {
      return [{ abbr: 'test' }];
    },
    getSet(abbr: string) {
      return abbr === 'test' ? testSetData : undefined;
    },
  };
}

/**
 * A valid MatchConfiguration against the mock registry, all 9 fields at or
 * above the D-24032 supply floors.
 */
function createValidConfig(): MatchConfiguration {
  return {
    schemeId: 'test/test-scheme-001',
    mastermindId: 'test/test-mastermind-001',
    villainGroupIds: ['test/test-villain-group-001', 'test/test-villain-group-002'],
    henchmanGroupIds: ['test/test-henchman-group-001'],
    heroDeckIds: ['test/test-hero-001', 'test/test-hero-002', 'test/test-hero-003'],
    bystandersCount: 30,
    woundsCount: 30,
    officersCount: 30,
    sidekicksCount: 0,
  };
}

describe('LegendaryGame.validateSetupData', () => {
  afterEach(() => {
    // why: setRegistryForSetup mutates module-level state; clear it so one
    // test's registry does not leak into the next (test pollution).
    clearRegistryForSetup();
  });

  it('rejects missing setupData with an actionable message', () => {
    const validate = LegendaryGame.validateSetupData;
    assert.ok(validate, 'validateSetupData hook must be defined.');
    const message = validate(undefined, 1);
    assert.equal(typeof message, 'string');
    assert.match(message as string, /setupData/);
  });

  it('returns a below-floor supply count as a message (not a setup() throw / HTTP 500)', () => {
    setRegistryForSetup(createMockRegistry());
    const validate = LegendaryGame.validateSetupData!;
    const config = createValidConfig();
    config.bystandersCount = 1;

    const message = validate(config, 1);

    assert.equal(typeof message, 'string');
    assert.match(message as string, /bystandersCount/);
    assert.match(message as string, /at least 30/);
  });

  it('returns an unknown ext_id as a message', () => {
    setRegistryForSetup(createMockRegistry());
    const validate = LegendaryGame.validateSetupData!;
    const config = createValidConfig();
    config.mastermindId = 'test/unknown-mastermind';

    const message = validate(config, 1);

    assert.equal(typeof message, 'string');
    assert.match(message as string, /unknown-mastermind/);
  });

  it('accepts a valid config (returns undefined) when a registry is configured', () => {
    setRegistryForSetup(createMockRegistry());
    const validate = LegendaryGame.validateSetupData!;

    const message = validate(createValidConfig(), 1);

    assert.equal(message, undefined);
  });

  it('skips existence/floor checks when no registry is configured (test path)', () => {
    // why: with no registry set (setRegistryForSetup never called), the hook
    // mirrors setup()'s `if (gameRegistry)` guard and validates only that
    // setupData is present — a below-floor config passes here, exactly as it
    // did before this fix, preserving the registry-free unit-test path.
    const validate = LegendaryGame.validateSetupData!;
    const config = createValidConfig();
    config.bystandersCount = 1;

    const message = validate(config, 1);

    assert.equal(message, undefined);
  });
});
