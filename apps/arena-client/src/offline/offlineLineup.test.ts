import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import featuredSetupBundleJson from '../fixtures/localSpike/featuredSetupBundle.json';
import { parseLocalSpikeSetupBundle, type LocalSpikeSetupBundle } from '../client/setupBundleReader';
import { summarizeOfflineLineup } from './offlineLineup';

/**
 * WP-894 follow-up — the offline Battle Brief lineup is resolved from the
 * setup bundle's own set data, so the brief needs no server.
 */
describe('summarizeOfflineLineup', () => {
  test('the featured bundle resolves every group and hero to its display name', () => {
    const bundle = parseLocalSpikeSetupBundle(featuredSetupBundleJson);
    const lineup = summarizeOfflineLineup(bundle);
    assert.equal(lineup.mastermind, 'Magneto');
    assert.equal(lineup.scheme, 'Midtown Bank Robbery');
    assert.deepEqual(lineup.villainGroups, ['Brotherhood']);
    assert.deepEqual(lineup.henchmanGroups, ['Sentinel']);
    assert.deepEqual(lineup.heroes, ['Spider-Man', 'Hulk', 'Wolverine']);
    assert.deepEqual(lineup.heroAlternates, []);
    assert.equal(lineup.playerCount, 1);
    assert.equal(lineup.finalBlow, false);
  });

  test('an id whose set or slug is missing falls back to the slug, never throws', () => {
    const bundle = parseLocalSpikeSetupBundle(featuredSetupBundleJson);
    const altered: LocalSpikeSetupBundle = {
      ...bundle,
      matchConfiguration: {
        ...bundle.matchConfiguration,
        villainGroupIds: ['zzzz/no-such-set', 'core/no-such-group'],
        heroDeckIds: ['bare-id'],
        finalBlow: true,
      },
    };
    const lineup = summarizeOfflineLineup(altered);
    assert.deepEqual(lineup.villainGroups, ['no-such-set', 'no-such-group']);
    assert.deepEqual(lineup.heroes, ['bare-id']);
    assert.equal(lineup.finalBlow, true);
  });
});
