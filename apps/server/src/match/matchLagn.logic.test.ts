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

import { validate, LAGN_VERSION } from '@legendary-arena/lagn';
import type { CardRegistry } from '@legendary-arena/registry';

import {
  buildMatchLagn,
  buildNameResolver,
  readMatchConfigurationForLagn,
  readMatchGameover,
  readAccountPublicIdentities,
  buildResultPlayers,
  buildResultMatchLagn,
  toLagnResult,
  DEFAULT_SCORING_PROFILE,
  type MatchLagnComposition,
  type ResultPlayerIdentity,
} from './matchLagn.logic.js';
import type { AccountId, DatabaseClient } from '../identity/identity.types.js';

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

    // why: assert the constant, not a literal — a hardcoded version here is
    // the duplication D-24195 removed, and it re-breaks on every bump.
    assert.equal(lagn.lagn_version, LAGN_VERSION);
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

// ============================================================================
// Result-LAGN producer (WP-406 / D-24216)
// ============================================================================

describe('toLagnResult — outcome mapping', () => {
  test('heroes-win maps to victory and scheme-wins to defeat', () => {
    assert.deepEqual(toLagnResult({ outcome: 'heroes-win' }), { outcome: 'victory' });
    assert.deepEqual(toLagnResult({ outcome: 'scheme-wins' }), { outcome: 'defeat' });
  });

  test('a tie, a null verdict, or an unknown outcome yields no result block', () => {
    // why: LAGN has no tie outcome, so a non-decisive verdict omits result rather
    // than guessing (result is optional). loss_condition is never fabricated.
    assert.equal(toLagnResult({ outcome: 'tie' }), undefined);
    assert.equal(toLagnResult(null), undefined);
    assert.equal(toLagnResult({ outcome: 'something-else' }), undefined);
    assert.equal(toLagnResult({}), undefined);
  });
});

describe('buildResultPlayers — roster projection (D-24214)', () => {
  const identities = new Map<AccountId, ResultPlayerIdentity>([
    ['account-ana' as AccountId, { displayHandle: 'ana-handle', displayName: 'Ana' }],
    ['account-devon' as AccountId, { displayHandle: 'devon-handle', displayName: null }],
    ['account-noh' as AccountId, { displayHandle: null, displayName: 'Unclaimed' }],
  ]);

  test('emits the claimed handle as player_id, never the AccountId', () => {
    const players = buildResultPlayers(
      [{ playerId: '0', accountId: 'account-ana' as AccountId }],
      identities,
    );
    assert.deepEqual(players, [{ seat: 0, player_id: 'ana-handle', display_name: 'Ana' }]);
    // the AccountId appears nowhere
    assert.equal(JSON.stringify(players).includes('account-ana'), false);
  });

  test('omits display_name when the account has none', () => {
    const players = buildResultPlayers(
      [{ playerId: '1', accountId: 'account-devon' as AccountId }],
      identities,
    );
    assert.deepEqual(players, [{ seat: 1, player_id: 'devon-handle' }]);
  });

  test('omits a seat whose account has no claimed handle', () => {
    const players = buildResultPlayers(
      [
        { playerId: '0', accountId: 'account-ana' as AccountId },
        { playerId: '1', accountId: 'account-noh' as AccountId },
      ],
      identities,
    );
    assert.equal(players?.length, 1);
    assert.equal(players?.[0].player_id, 'ana-handle');
  });

  test('returns undefined (not []) when no seat qualifies', () => {
    const players = buildResultPlayers(
      [{ playerId: '0', accountId: 'account-noh' as AccountId }],
      identities,
    );
    assert.equal(players, undefined);
  });

  test('sorts by seat for a deterministic document', () => {
    const players = buildResultPlayers(
      [
        { playerId: '1', accountId: 'account-devon' as AccountId },
        { playerId: '0', accountId: 'account-ana' as AccountId },
      ],
      identities,
    );
    assert.deepEqual(
      players?.map((entry) => entry.seat),
      [0, 1],
    );
  });
});

describe('buildResultMatchLagn — composed document', () => {
  test('setup + scoring_profile + players + result, and validates as 1.4.0', () => {
    const players = buildResultPlayers(
      [{ playerId: '0', accountId: 'account-ana' as AccountId }],
      new Map([['account-ana' as AccountId, { displayHandle: 'ana', displayName: 'Ana' }]]),
    );
    const lagn = buildResultMatchLagn(
      'match-1',
      VALID_COMPOSITION,
      1,
      identityResolver,
      players,
      { outcome: 'victory' },
      DEFAULT_SCORING_PROFILE,
    );
    assert.equal(lagn.lagn_version, LAGN_VERSION);
    assert.equal(lagn.scoring_profile, 'classic');
    assert.deepEqual(lagn.result, { outcome: 'victory' });
    assert.equal(lagn.players?.length, 1);
    assert.equal(validate(lagn).valid, true);
  });

  test('omits players and result when both are undefined; scoring_profile stays', () => {
    const lagn = buildResultMatchLagn(
      'match-1',
      VALID_COMPOSITION,
      1,
      identityResolver,
      undefined,
      undefined,
      DEFAULT_SCORING_PROFILE,
    );
    assert.equal('players' in lagn, false);
    assert.equal('result' in lagn, false);
    assert.equal(lagn.scoring_profile, 'classic');
    assert.equal(validate(lagn).valid, true);
  });
});

describe('readMatchGameover — metadata.gameover read (D-24169)', () => {
  test('returns the stored verdict when gameover is present', async () => {
    const gameover = await readMatchGameover(
      'match-1',
      fakeDatabase([{ gameover: { outcome: 'heroes-win', reason: 'Mastermind defeated' } }]),
    );
    assert.deepEqual(gameover, { outcome: 'heroes-win', reason: 'Mastermind defeated' });
  });

  test('returns null when the match row is absent', async () => {
    assert.equal(await readMatchGameover('missing', fakeDatabase([])), null);
  });

  test('returns null when the match has no gameover (still in progress)', async () => {
    assert.equal(await readMatchGameover('live', fakeDatabase([{ gameover: null }])), null);
  });
});

describe('readAccountPublicIdentities — domain-table read', () => {
  test('maps ext_id to its claimed handle + mutable display name', async () => {
    const identities = await readAccountPublicIdentities(
      ['account-ana' as AccountId],
      fakeDatabase([
        { ext_id: 'account-ana', display_handle: 'ana-handle', display_name: 'Ana' },
      ]),
    );
    assert.deepEqual(identities.get('account-ana' as AccountId), {
      displayHandle: 'ana-handle',
      displayName: 'Ana',
    });
  });

  test('returns an empty map for no account ids (no query needed)', async () => {
    let queried = false;
    const database = {
      query: async () => {
        queried = true;
        return { rows: [] };
      },
    } as unknown as DatabaseClient;
    const identities = await readAccountPublicIdentities([], database);
    assert.equal(identities.size, 0);
    assert.equal(queried, false);
  });

  test('coerces a null handle / name to null in the map', async () => {
    const identities = await readAccountPublicIdentities(
      ['account-noh' as AccountId],
      fakeDatabase([
        { ext_id: 'account-noh', display_handle: null, display_name: null },
      ]),
    );
    assert.deepEqual(identities.get('account-noh' as AccountId), {
      displayHandle: null,
      displayName: null,
    });
  });
});
