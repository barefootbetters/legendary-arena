/**
 * Tests for the current-match LAGN projection logic (WP-361 / EC-391).
 *
 * Pure unit tests — no database, no network. `buildMatchLagn` is exercised
 * directly with a stub name resolver; `buildNameResolver` with a fake registry
 * exposing only `listCards()`; `readMatchConfigurationForLagn` with a fake
 * `DatabaseClient` whose `query` returns canned rows.
 *
 * Authority: WP-361 §Scope (In) §F; EC-391; D-24153.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { validate } from '@legendary-arena/lagn';
import type { CardRegistry } from '@legendary-arena/registry';

import {
  buildMatchLagn,
  buildNameResolver,
  readMatchConfigurationForLagn,
  type MatchLagnComposition,
} from './matchLagn.logic.js';
import type { DatabaseClient } from '../identity/identity.types.js';

/** A complete, valid 9-field composition fixture. */
const VALID_COMPOSITION: MatchLagnComposition = {
  schemeId: 'core/the-legacy-virus',
  mastermindId: 'core/loki-god-of-mischief',
  villainGroupIds: ['core/hydra', 'core/enemies-of-asgard'],
  henchmanGroupIds: ['core/doombot-legion'],
  heroDeckIds: ['core/spider-man', 'core/wolverine'],
  bystandersCount: 12,
  woundsCount: 30,
  officersCount: 20,
  sidekicksCount: 0,
};

/** An identity resolver (name === id) for mapping-shape assertions. */
const identityResolver = (extId: string): string => extId;

/** A fake registry exposing only the `listCards()` the resolver uses. */
function fakeRegistry(
  cards: { extId: string; name: string }[],
): CardRegistry {
  return { listCards: () => cards } as unknown as CardRegistry;
}

/** A fake `DatabaseClient` whose `query` returns the supplied rows. */
function fakeDatabase(rows: unknown[]): DatabaseClient {
  return {
    query: async () => ({ rows }),
  } as unknown as DatabaseClient;
}

describe('buildMatchLagn — mapping', () => {
  test('maps all nine composition fields + player_count + game_id, and validates', () => {
    const lagn = buildMatchLagn('match-1', VALID_COMPOSITION, 3, identityResolver);

    assert.equal(lagn.lagn_version, '1.0.0');
    assert.equal(lagn.game_id, 'match-1');
    assert.equal(lagn.player_count, 3);
    assert.equal(lagn.variant, 'cooperative');

    assert.equal(lagn.setup.mastermind.id, 'core/loki-god-of-mischief');
    assert.equal(lagn.setup.scheme.id, 'core/the-legacy-virus');
    assert.deepEqual(
      lagn.setup.villain_groups.map((group) => group.id),
      ['core/hydra', 'core/enemies-of-asgard'],
    );
    assert.deepEqual(
      lagn.setup.henchmen_groups.map((group) => group.id),
      ['core/doombot-legion'],
    );
    assert.deepEqual(
      lagn.setup.heroes.map((hero) => hero.id),
      ['core/spider-man', 'core/wolverine'],
    );
    assert.equal(lagn.setup.bystanders_count, 12);
    assert.equal(lagn.setup.wounds_count, 30);
    assert.equal(lagn.setup.sidekicks_count, 0);

    // the one non-1:1 rename
    assert.equal(lagn.setup.shield_officers_count, 20);

    assert.equal(validate(lagn).valid, true);
  });

  test('variant is solo for one seat and cooperative for two or more', () => {
    assert.equal(
      buildMatchLagn('m', VALID_COMPOSITION, 1, identityResolver).variant,
      'solo',
    );
    assert.equal(
      buildMatchLagn('m', VALID_COMPOSITION, 2, identityResolver).variant,
      'cooperative',
    );
    assert.equal(
      buildMatchLagn('m', VALID_COMPOSITION, 5, identityResolver).variant,
      'cooperative',
    );
    // a solo LAGN with one seat is internally consistent and valid
    assert.equal(
      validate(buildMatchLagn('m', VALID_COMPOSITION, 1, identityResolver)).valid,
      true,
    );
  });

  test('resolves names via the resolver (canonical name, else ext_id verbatim)', () => {
    const resolveName = buildNameResolver(
      fakeRegistry([
        { extId: 'core/loki-god-of-mischief', name: 'Loki, God of Mischief' },
      ]),
    );
    const lagn = buildMatchLagn('m', VALID_COMPOSITION, 2, resolveName);
    // known ext_id → its display name
    assert.equal(lagn.setup.mastermind.name, 'Loki, God of Mischief');
    // unknown ext_id → the ext_id unchanged (no synthesis)
    assert.equal(lagn.setup.scheme.name, 'core/the-legacy-virus');
    assert.equal(lagn.setup.villain_groups[0].name, 'core/hydra');
  });
});

describe('buildNameResolver — no synthesis, id fallback', () => {
  test('returns the display name for a known ext_id and the ext_id verbatim otherwise', () => {
    const resolveName = buildNameResolver(
      fakeRegistry([{ extId: 'core/thanos', name: 'Thanos' }]),
    );
    assert.equal(resolveName('core/thanos'), 'Thanos');
    assert.equal(resolveName('core/unknown-entity'), 'core/unknown-entity');
    assert.equal(resolveName('bad/id-format'), 'bad/id-format');
  });
});

describe('buildMatchLagn — nine-field drift + corrupt input', () => {
  test('consumes exactly the nine sanctioned fields — an extra field never leaks', () => {
    // why: a field added to MatchSetupConfig later must not silently leak into the
    // LAGN projection; the setup must be byte-identical to the same fixture
    // without the extra field, and the extra key must appear nowhere in the output.
    const withExtra = {
      ...VALID_COMPOSITION,
      sneakyExtraField: 'should-not-appear',
    } as unknown as MatchLagnComposition;

    const fromExtra = buildMatchLagn('m', withExtra, 2, identityResolver);
    const fromClean = buildMatchLagn('m', VALID_COMPOSITION, 2, identityResolver);

    assert.deepEqual(fromExtra.setup, fromClean.setup);
    assert.equal(JSON.stringify(fromExtra).includes('sneakyExtraField'), false);
  });

  test('a corrupt numPlayers yields a document that fails validation (no coercion)', () => {
    for (const badSeatCount of [0, 8, -1]) {
      const lagn = buildMatchLagn('m', VALID_COMPOSITION, badSeatCount, identityResolver);
      assert.equal(lagn.player_count, badSeatCount);
      assert.equal(validate(lagn).valid, false);
    }
  });

  test('a non-array group field becomes [] (never throws) and fails validation', () => {
    const badArrays = {
      ...VALID_COMPOSITION,
      villainGroupIds: undefined as unknown as string[],
    };
    let lagn;
    assert.doesNotThrow(() => {
      lagn = buildMatchLagn('m', badArrays, 2, identityResolver);
    });
    assert.deepEqual(lagn!.setup.villain_groups, []);
    assert.equal(validate(lagn!).valid, false);
  });
});

describe('readMatchConfigurationForLagn — fail-closed reads', () => {
  test('returns the composition + numPlayers for a valid initial_state row', async () => {
    const database = fakeDatabase([
      {
        initial_state: {
          G: { matchConfiguration: VALID_COMPOSITION },
          ctx: { numPlayers: 3 },
        },
      },
    ]);
    const result = await readMatchConfigurationForLagn('match-1', database);
    assert.notEqual(result, null);
    assert.equal(result!.numPlayers, 3);
    assert.equal(result!.matchConfiguration.mastermindId, 'core/loki-god-of-mischief');
  });

  test('returns null when the match row is absent', async () => {
    const result = await readMatchConfigurationForLagn('missing', fakeDatabase([]));
    assert.equal(result, null);
  });

  test('returns null when initial_state is null (a setState-upsert row)', async () => {
    const result = await readMatchConfigurationForLagn(
      'unplayable',
      fakeDatabase([{ initial_state: null }]),
    );
    assert.equal(result, null);
  });
});
