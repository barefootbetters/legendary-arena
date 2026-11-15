/**
 * Tests for listSelectedVillainCards, the one setup registry walk shared by the
 * five per-villain setup table builders (WP-898 / D-24855).
 *
 * T1-T6 pin the enumerator on mock registries: reader guard, malformed ids, card
 * guards and the string-line filter, the shared copy-count emitter, config and card
 * order, and fresh arrays per call. T7-T8 run all five builders over the committed
 * card data and pin the tables byte-for-byte (the D-24855 golden) and per-copy
 * object identity (D-13502).
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  listSelectedVillainCards,
  buildVillainDefeatRequirements,
  buildVillainFightDiscardCosts,
  buildVillainVariableAttack,
  buildVillainFightRestrictions,
  buildVillainAttackPerCaptured,
} from './villainDefeatRequirement.setup.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';

// why: card fields are `unknown` so T3 / T4 can hand the enumerator a numeric slug,
// a string `abilities`, mixed ability arrays and `copies: 0` without `any` or a
// suppression comment; `cards` is `unknown[]` so a group can hold a `null` card.
interface MockVillainCard {
  slug?: unknown;
  abilities?: unknown;
  copies?: unknown;
}
interface MockVillainGroup {
  slug: string;
  cards: unknown[];
}

/**
 * Builds a registry mock exposing getSet for one set's villain groups.
 *
 * @param setAbbr - The one set abbreviation the mock answers for.
 * @param villains - The set's villain groups.
 * @returns A structural `{ getSet }` registry.
 */
function makeRegistry(setAbbr: string, villains: MockVillainGroup[]) {
  const setData = {
    abbr: setAbbr,
    villains,
    henchmen: [],
    schemes: [],
    masterminds: [],
    heroes: [],
    bystanders: [],
    wounds: [],
    other: [],
  };
  return {
    getSet: (abbr: string) => (abbr === setAbbr ? setData : undefined),
  };
}

/**
 * Minimal MatchSetupConfig selecting the given villain groups.
 *
 * @param villainGroupIds - The set-qualified villain group ids, in order.
 * @returns A config whose other fields are inert for these builders.
 */
function makeConfig(villainGroupIds: string[]): MatchSetupConfig {
  return {
    schemeId: 'core/midtown-bank-robbery',
    mastermindId: 'core/magneto',
    villainGroupIds,
    henchmanGroupIds: [],
    heroDeckIds: [],
    bystandersCount: 5,
    woundsCount: 5,
    officersCount: 5,
    sidekicksCount: 5,
  };
}

/**
 * One plain marked card for the mock registry.
 *
 * @param slug - The card slug.
 * @param copies - Optional copy count.
 * @returns A mock card with a single ability line.
 */
function makeCard(slug: string, copies?: number): MockVillainCard {
  if (copies === undefined) {
    return { slug, abilities: [`${slug} line`] };
  }
  return { slug, abilities: [`${slug} line`], copies };
}

describe('listSelectedVillainCards — mock registry (WP-898)', () => {
  it('T1: a value that is not a registry reader lists nothing and never throws', () => {
    const config = makeConfig(['core/brotherhood']);
    assert.deepEqual(listSelectedVillainCards(null, config), []);
    assert.deepEqual(listSelectedVillainCards({}, config), []);
    assert.deepEqual(listSelectedVillainCards({ getSet: 'x' }, config), []);
  });

  it('T2: malformed, unknown-set and unknown-group ids are skipped, not thrown', () => {
    const registry = makeRegistry('core', [
      { slug: 'brotherhood', cards: [makeCard('blob', 2)] },
    ]);
    const config = makeConfig([
      '',
      'core',
      'a/b/c',
      ' core/brotherhood',
      'zzzz/brotherhood',
      'core/unknown-group',
    ]);
    assert.deepEqual(listSelectedVillainCards(registry, config), []);
  });

  it('T3: card guards and the string-line filter; a null card still throws', () => {
    const registry = makeRegistry('core', [
      {
        slug: 'mixed',
        cards: [
          { abilities: ['no slug'] },
          { slug: 7, abilities: ['numeric slug'] },
          { slug: 'string-abilities', abilities: 'not an array' },
          { slug: 'kept', abilities: ['a', 7, null, 'b'] },
        ],
      },
    ]);
    assert.deepEqual(listSelectedVillainCards(registry, makeConfig(['core/mixed'])), [
      { abilityLines: ['a', 'b'], instanceExtIds: ['core-villain-mixed-kept-00'] },
    ]);

    // why: every builder throws a TypeError at `typeof card.slug` for a null card
    // today; the walk fold must keep that throw (no new `!card` guard).
    const nullCardRegistry = makeRegistry('core', [{ slug: 'holes', cards: [null] }]);
    assert.throws(
      () => listSelectedVillainCards(nullCardRegistry, makeConfig(['core/holes'])),
      TypeError,
    );
  });

  it('T4: instance ids come from the shared copy-count emitter', () => {
    const registry = makeRegistry('core', [
      {
        slug: 'copies',
        cards: [
          { slug: 'three', abilities: [], copies: 3 },
          { slug: 'unset', abilities: [] },
          { slug: 'zero', abilities: [], copies: 0 },
        ],
      },
    ]);
    assert.deepEqual(listSelectedVillainCards(registry, makeConfig(['core/copies'])), [
      {
        abilityLines: [],
        instanceExtIds: [
          'core-villain-copies-three-00',
          'core-villain-copies-three-01',
          'core-villain-copies-three-02',
        ],
      },
      { abilityLines: [], instanceExtIds: ['core-villain-copies-unset-00'] },
      { abilityLines: [], instanceExtIds: ['core-villain-copies-zero-00'] },
    ]);
  });

  it('T5: records follow config order, then card order; a repeated group is listed again', () => {
    const registry = makeRegistry('core', [
      { slug: 'g1', cards: [makeCard('a'), makeCard('b')] },
      { slug: 'g2', cards: [makeCard('c'), makeCard('d')] },
    ]);

    const reversed = listSelectedVillainCards(registry, makeConfig(['core/g2', 'core/g1']));
    const reversedIds: string[] = [];
    for (const villainCard of reversed) {
      reversedIds.push(...villainCard.instanceExtIds);
    }
    assert.deepEqual(reversedIds, [
      'core-villain-g2-c-00',
      'core-villain-g2-d-00',
      'core-villain-g1-a-00',
      'core-villain-g1-b-00',
    ]);

    const repeated = listSelectedVillainCards(registry, makeConfig(['core/g1', 'core/g1']));
    const repeatedIds: string[] = [];
    for (const villainCard of repeated) {
      repeatedIds.push(...villainCard.instanceExtIds);
    }
    assert.deepEqual(repeatedIds, [
      'core-villain-g1-a-00',
      'core-villain-g1-b-00',
      'core-villain-g1-a-00',
      'core-villain-g1-b-00',
    ]);
  });

  it('T6: every call returns fresh arrays that never alias registry data', () => {
    const registryCard = { slug: 'fresh', abilities: ['first line'], copies: 2 };
    const registry = makeRegistry('core', [{ slug: 'group', cards: [registryCard] }]);
    const config = makeConfig(['core/group']);

    const firstResult = listSelectedVillainCards(registry, config);
    const secondResult = listSelectedVillainCards(registry, config);
    assert.notEqual(firstResult, secondResult);
    const expected = [
      {
        abilityLines: ['first line'],
        instanceExtIds: ['core-villain-group-fresh-00', 'core-villain-group-fresh-01'],
      },
    ];
    assert.deepEqual(secondResult, expected);

    firstResult[0]!.abilityLines.push('pushed line');
    firstResult[0]!.instanceExtIds.push('pushed-id');
    firstResult.push({ abilityLines: [], instanceExtIds: [] });
    assert.deepEqual(secondResult, expected);
    assert.deepEqual(listSelectedVillainCards(registry, config), expected);

    const thirdResult = listSelectedVillainCards(registry, config);
    registryCard.abilities.push('later line');
    assert.notEqual(thirdResult[0]!.abilityLines, registryCard.abilities);
    assert.deepEqual(thirdResult[0]!.abilityLines, ['first line']);
  });
});

// ---------------------------------------------------------------------------
// Real registry (T7-T8)
// ---------------------------------------------------------------------------

const CARDS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'data', 'cards');

/** The sets the D-24855 golden reads, as committed in data/cards. */
const GOLDEN_SET_ABBRS = ['core', 'ssw1', 'ca75', 'co2e', 'chmp', 'cvwr', 'ssw2'];

/** The 13 villain groups carrying every marked villain card, in golden config order. */
const GOLDEN_VILLAIN_GROUP_IDS = [
  'core/brotherhood',
  'core/spider-foes',
  'ssw1/deadlands-the',
  'ca75/zolas-creations',
  'co2e/hydra',
  'co2e/skulls',
  'co2e/sinister-syndicate',
  'co2e/enemies-of-asgard',
  'co2e/masters-of-evil',
  'co2e/sinister-spider-foes',
  'chmp/monsters-unleashed',
  'cvwr/great-lakes-avengers',
  'ssw2/deadpools-secret-secret-wars',
];

/** sha256 of JSON.stringify(GOLDEN_TABLES) on b43e5478 card data (WP-898 Locked Values). */
const GOLDEN_TABLES_SHA256 = '4c0bc0d3a510af9a42b75829887c28da5ea2290ac8c5f923d4d4117ad2321d17';

// why: D-24855 golden, captured from the pre-WP-898 builders. A failure means a setup
// table changed, which changes G at setup and is replay-relevant; it is never re-pinned
// to make a refactor pass. Only a card-data change that marks another card in these
// groups updates it, in the same commit as that data change.
const GOLDEN_TABLES = {
  villainDefeatRequirements: {
    'core-villain-brotherhood-blob-00': { kind: 'team', value: 'x-men' },
    'core-villain-brotherhood-blob-01': { kind: 'team', value: 'x-men' },
    'core-villain-spider-foes-venom-00': { kind: 'hero-class', value: 'covert' },
    'ssw1-villain-deadlands-the-zombie-venom-00': { kind: 'hero-class', value: 'covert' },
  },
  villainFightDiscardCosts: {
    'ca75-villain-zolas-creations-primus-00': { eligibleCosts: [2, 3, 5, 7] },
    'ca75-villain-zolas-creations-primus-01': { eligibleCosts: [2, 3, 5, 7] },
  },
  villainVariableAttack: {
    'co2e-villain-hydra-baron-strucker-supreme-hydra-00': { source: 'per-other-hydra-villain', attackPerUnit: 1 },
    'co2e-villain-hydra-baron-strucker-supreme-hydra-01': { source: 'per-other-hydra-villain', attackPerUnit: 1 },
    'co2e-villain-skulls-paibok-the-power-skrull-00': { source: 'per-hq-hero-class', attackPerUnit: 1 },
    'co2e-villain-skulls-paibok-the-power-skrull-01': { source: 'per-hq-hero-class', attackPerUnit: 1 },
    'co2e-villain-skulls-super-skrull-00': { source: 'per-hq-hero-class', attackPerUnit: 1 },
    'co2e-villain-skulls-super-skrull-01': { source: 'per-hq-hero-class', attackPerUnit: 1 },
    'co2e-villain-sinister-syndicate-hydro-man-00': {
      source: 'flat',
      attackPerUnit: 2,
      requireCitySpaces: ['sewers', 'bridge'],
    },
    'co2e-villain-sinister-syndicate-hydro-man-01': {
      source: 'flat',
      attackPerUnit: 2,
      requireCitySpaces: ['sewers', 'bridge'],
    },
  },
  villainFightRestrictions: {
    'chmp-villain-monsters-unleashed-orrgo-00': { kind: 'requires-villain-defeated-this-turn' },
    'cvwr-villain-great-lakes-avengers-squirrel-girl-00': { kind: 'at-most-one-card-played' },
    'cvwr-villain-great-lakes-avengers-squirrel-girl-01': { kind: 'at-most-one-card-played' },
    'ssw2-villain-deadpools-secret-secret-wars-doop-00': { kind: 'no-adjacent-villain' },
    'ssw2-villain-deadpools-secret-secret-wars-doop-01': { kind: 'no-adjacent-villain' },
  },
  villainAttackPerCaptured: {
    'co2e-villain-enemies-of-asgard-enchantress-00': { kind: 'bystander', attackPerCard: 1 },
    'co2e-villain-enemies-of-asgard-enchantress-01': { kind: 'bystander', attackPerCard: 1 },
    'co2e-villain-masters-of-evil-baron-zemo-00': { kind: 'bystander', attackPerCard: 1 },
    'co2e-villain-masters-of-evil-baron-zemo-01': { kind: 'bystander', attackPerCard: 1 },
    'co2e-villain-sinister-spider-foes-venom-00': { kind: 'hero', attackPerCard: 1 },
    'co2e-villain-sinister-spider-foes-venom-01': { kind: 'hero', attackPerCard: 1 },
  },
};

/**
 * Builds a structural `{ getSet }` registry over committed card data.
 *
 * @param setAbbrs - The set abbreviations to load from data/cards.
 * @returns A registry exposing getSet for those sets.
 */
function makeCommittedRegistry(setAbbrs: string[]): { getSet: (abbr: string) => unknown } {
  const sets: Record<string, unknown> = {};
  for (const setAbbr of setAbbrs) {
    sets[setAbbr] = JSON.parse(readFileSync(join(CARDS_DIRECTORY, `${setAbbr}.json`), 'utf8'));
  }
  return { getSet: (abbr: string) => sets[abbr] };
}

/**
 * Runs all five setup table builders over the golden groups of the committed data.
 *
 * @returns The five tables, keyed as their G fields.
 */
function buildGoldenTables() {
  const registry = makeCommittedRegistry(GOLDEN_SET_ABBRS);
  const config = makeConfig(GOLDEN_VILLAIN_GROUP_IDS);
  return {
    villainDefeatRequirements: buildVillainDefeatRequirements(registry, config),
    villainFightDiscardCosts: buildVillainFightDiscardCosts(registry, config),
    villainVariableAttack: buildVillainVariableAttack(registry, config),
    villainFightRestrictions: buildVillainFightRestrictions(registry, config),
    villainAttackPerCaptured: buildVillainAttackPerCaptured(registry, config),
  };
}

/**
 * Strips the two-digit copy suffix from an instance ext_id.
 *
 * @param cardId - A copy-indexed villain instance ext_id.
 * @returns The id without its trailing `-NN`.
 */
function cardBaseId(cardId: string): string {
  return cardId.slice(0, cardId.length - 3);
}

describe('villain setup tables — committed card data (WP-898 / D-24855)', () => {
  it('T7: all five tables equal the golden, key order included', () => {
    assert.equal(
      createHash('sha256').update(JSON.stringify(GOLDEN_TABLES)).digest('hex'),
      GOLDEN_TABLES_SHA256,
    );

    const tables = buildGoldenTables();
    assert.deepEqual(tables, GOLDEN_TABLES);
    assert.deepEqual(Object.keys(tables.villainDefeatRequirements), Object.keys(GOLDEN_TABLES.villainDefeatRequirements));
    assert.deepEqual(Object.keys(tables.villainFightDiscardCosts), Object.keys(GOLDEN_TABLES.villainFightDiscardCosts));
    assert.deepEqual(Object.keys(tables.villainVariableAttack), Object.keys(GOLDEN_TABLES.villainVariableAttack));
    assert.deepEqual(Object.keys(tables.villainFightRestrictions), Object.keys(GOLDEN_TABLES.villainFightRestrictions));
    assert.deepEqual(Object.keys(tables.villainAttackPerCaptured), Object.keys(GOLDEN_TABLES.villainAttackPerCaptured));
    assert.equal(createHash('sha256').update(JSON.stringify(tables)).digest('hex'), GOLDEN_TABLES_SHA256);
  });

  it('T8: copies of one card never share an entry object or array (D-13502)', () => {
    const tables = buildGoldenTables();
    const tableList: Record<string, unknown>[] = [
      tables.villainDefeatRequirements,
      tables.villainFightDiscardCosts,
      tables.villainVariableAttack,
      tables.villainFightRestrictions,
      tables.villainAttackPerCaptured,
    ];

    let multiCopyCardCount = 0;
    for (const table of tableList) {
      const entriesByCard: Record<string, unknown[]> = {};
      for (const cardId of Object.keys(table)) {
        const baseId = cardBaseId(cardId);
        if (entriesByCard[baseId] === undefined) {
          entriesByCard[baseId] = [];
        }
        entriesByCard[baseId]!.push(table[cardId]);
      }
      for (const copyEntries of Object.values(entriesByCard)) {
        if (copyEntries.length < 2) continue;
        multiCopyCardCount += 1;
        for (let i = 1; i < copyEntries.length; i++) {
          assert.notEqual(copyEntries[i], copyEntries[0]);
        }
      }
    }
    assert.equal(multiCopyCardCount, 11);

    const primusFirst = tables.villainFightDiscardCosts['ca75-villain-zolas-creations-primus-00']!;
    const primusSecond = tables.villainFightDiscardCosts['ca75-villain-zolas-creations-primus-01']!;
    assert.notEqual(primusFirst.eligibleCosts, primusSecond.eligibleCosts);
    primusFirst.eligibleCosts.push(99);
    assert.deepEqual(primusSecond.eligibleCosts, [2, 3, 5, 7]);

    const hydroFirst = tables.villainVariableAttack['co2e-villain-sinister-syndicate-hydro-man-00']!;
    const hydroSecond = tables.villainVariableAttack['co2e-villain-sinister-syndicate-hydro-man-01']!;
    assert.notEqual(hydroFirst.requireCitySpaces, hydroSecond.requireCitySpaces);
    hydroFirst.requireCitySpaces!.push('streets');
    assert.deepEqual(hydroSecond.requireCitySpaces, ['sewers', 'bridge']);

    const blobFirst = tables.villainDefeatRequirements['core-villain-brotherhood-blob-00']!;
    const blobSecond = tables.villainDefeatRequirements['core-villain-brotherhood-blob-01']!;
    blobFirst.value = 'mutated';
    assert.equal(blobSecond.value, 'x-men');
  });
});
