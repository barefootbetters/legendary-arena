import { describe, test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildGauntletBadgeDefinitions,
  buildGauntletBadgeKey,
  issueGauntletBadgesForSubmission,
  registerGauntletBadgeContext,
} from './badge.gauntlet.js';
import { resolveBadgeDefinition, registerDynamicBadgeDefinitions } from './badge.types.js';
import type { GauntletDefinition } from '../legends/gauntlet.logic.js';
import type {
  DatabaseClient,
  LeaderboardDependencies,
} from '../leaderboards/leaderboard.types.js';

/**
 * Gauntlet champion badge tests (WP-344 / D-24133). Stub database:
 * the first query is the progress SELECT (rows below), any INSERT is
 * recorded for assertion. Context registration is reset after every
 * test so the module-level seam never leaks across tests.
 */

const TEST_DEFINITION: GauntletDefinition = {
  setAbbr: 'core',
  setName: 'Core Set',
  mastermindSlug: 'dr-doom',
  mastermindName: 'Dr. Doom',
  legSchemeSlugs: ['scheme-a', 'scheme-b'],
};

interface StubQueryCall {
  text: string;
  params: unknown[];
}

function createStubDatabase(progressRows: unknown[]): {
  database: DatabaseClient;
  calls: StubQueryCall[];
} {
  const calls: StubQueryCall[] = [];
  const database = {
    async query(text: string, params?: unknown[]) {
      calls.push({ text, params: params ?? [] });
      if (text.includes('SELECT')) {
        return { rows: progressRows, rowCount: progressRows.length };
      }
      return { rows: [], rowCount: 0 };
    },
  } as DatabaseClient;
  return { database, calls };
}

function stubDeps(): LeaderboardDependencies {
  return {
    checkParPublished: () => ({
      parValue: 0,
      parVersion: 'v1',
      source: 'simulation' as const,
      scoringConfig: { scoringConfigVersion: 1 } as never,
    }),
  };
}

function winningRow(schemeSlug: string): unknown {
  return {
    scenario_key: `${schemeSlug}::dr-doom::villains-x`,
    final_score: -1,
    scoring_config_version: 1,
  };
}

afterEach(() => {
  registerGauntletBadgeContext(null);
  registerDynamicBadgeDefinitions(new Map());
});

describe('gauntlet badge definitions (WP-344)', () => {
  test('one definition per catalog gauntlet with the locked key grammar and label', () => {
    const definitions = buildGauntletBadgeDefinitions([TEST_DEFINITION]);
    const definition = definitions.get('gauntlet.core.dr-doom');
    assert.ok(definition !== undefined);
    assert.equal(definition.badgeKey, buildGauntletBadgeKey(TEST_DEFINITION));
    assert.equal(definition.tier, 1);
    assert.equal(definition.sourceKind, 'competitive_history');
    assert.equal(definition.label, 'Dr. Doom Champion — Core Set');
    assert.ok(definition.description.includes('2 replay-verified wins'));
  });

  test('registered dynamic definitions resolve; unknown keys still drop', () => {
    registerDynamicBadgeDefinitions(buildGauntletBadgeDefinitions([TEST_DEFINITION]));
    assert.ok(resolveBadgeDefinition('gauntlet.core.dr-doom') !== undefined);
    assert.equal(resolveBadgeDefinition('gauntlet.core.nobody'), undefined);
    // Static Tier 1 keys keep resolving through the same seam.
    assert.ok(resolveBadgeDefinition('gameplay.sub-par-run') !== undefined);
  });
});

describe('gauntlet badge issuance (WP-344)', () => {
  test('no-ops when no context is registered (the pre-WP-344 behavior)', async () => {
    const { database, calls } = createStubDatabase([]);
    await issueGauntletBadgesForSubmission(
      7, 'account-1', 'scheme-a::dr-doom::v', 'heroes-win', 1, database,
    );
    assert.equal(calls.length, 0);
  });

  test('no-ops on a loss and on a legacy NULL outcome', async () => {
    registerGauntletBadgeContext({
      catalog: [TEST_DEFINITION],
      leaderboardDeps: stubDeps(),
    });
    const { database, calls } = createStubDatabase([]);
    await issueGauntletBadgesForSubmission(
      7, 'account-1', 'scheme-a::dr-doom::v', 'scheme-wins', 1, database,
    );
    await issueGauntletBadgesForSubmission(
      7, 'account-1', 'scheme-a::dr-doom::v', null, 1, database,
    );
    assert.equal(calls.length, 0);
  });

  test('no-ops when the scenario belongs to no catalog gauntlet', async () => {
    registerGauntletBadgeContext({
      catalog: [TEST_DEFINITION],
      leaderboardDeps: stubDeps(),
    });
    const { database, calls } = createStubDatabase([]);
    await issueGauntletBadgesForSubmission(
      7, 'account-1', 'scheme-a::someone-else::v', 'heroes-win', 1, database,
    );
    assert.equal(calls.length, 0);
  });

  test('an incomplete gauntlet issues nothing (progress query runs, no INSERT)', async () => {
    registerGauntletBadgeContext({
      catalog: [TEST_DEFINITION],
      leaderboardDeps: stubDeps(),
    });
    const { database, calls } = createStubDatabase([winningRow('scheme-a')]);
    await issueGauntletBadgesForSubmission(
      7, 'account-1', 'scheme-a::dr-doom::v', 'heroes-win', 1, database,
    );
    assert.equal(calls.length, 1);
    assert.ok(calls[0]?.text.includes('SELECT'));
  });

  test('the completing win issues one idempotent NULL-source_ref row', async () => {
    registerGauntletBadgeContext({
      catalog: [TEST_DEFINITION],
      leaderboardDeps: stubDeps(),
    });
    const { database, calls } = createStubDatabase([
      winningRow('scheme-a'),
      winningRow('scheme-b'),
    ]);
    await issueGauntletBadgesForSubmission(
      7, 'account-1', 'scheme-b::dr-doom::v', 'heroes-win', 3, database,
    );
    assert.equal(calls.length, 2);
    const insert = calls[1];
    assert.ok(insert?.text.includes('INSERT INTO legendary.player_badges'));
    assert.ok(insert.text.includes('ON CONFLICT DO NOTHING'));
    assert.deepEqual(insert.params, [
      7,
      'gauntlet.core.dr-doom',
      1,
      'competitive_history',
      null,
      3,
    ]);
  });
});
