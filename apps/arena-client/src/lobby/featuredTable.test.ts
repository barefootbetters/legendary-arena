import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  FEATURED_PLAYER_COUNT,
  FEATURED_TABLE,
  FEATURED_TABLE_LABELS,
} from './featuredTable';

/**
 * WP-785 — pins the featured table against the card data. The client may not
 * import the registry, so the test reads `data/cards/core.json` directly.
 */

interface CardEntry {
  readonly name: string;
  readonly imageUrl?: string;
}

interface CardGroup {
  readonly slug: string;
  readonly name: string;
  readonly alwaysLeads?: readonly string[];
  readonly cards?: readonly CardEntry[];
}

interface CoreSet {
  readonly masterminds: readonly CardGroup[];
  readonly schemes: readonly CardGroup[];
  readonly villains: readonly CardGroup[];
  readonly henchmen: readonly CardGroup[];
  readonly heroes: readonly CardGroup[];
}

const coreSet = JSON.parse(
  readFileSync(new URL('../../../../data/cards/core.json', import.meta.url), 'utf8'),
) as CoreSet;

/**
 * Strips the `core/` set prefix from a set-qualified ext_id.
 *
 * @param qualifiedId A set-qualified id such as `core/magneto`.
 * @returns The bare slug, e.g. `magneto`.
 */
function toSlug(qualifiedId: string): string {
  return qualifiedId.replace(/^core\//, '');
}

/**
 * Finds a card group by slug, failing the test loudly when it is missing.
 *
 * @param groups The category to search.
 * @param qualifiedId The set-qualified id to look up.
 * @returns The matching group.
 */
function findGroup(groups: readonly CardGroup[], qualifiedId: string): CardGroup {
  const slug = toSlug(qualifiedId);
  const match = groups.find((group) => group.slug === slug);
  assert.ok(match !== undefined, `The featured id "${qualifiedId}" is missing from core.json.`);
  return match;
}

test('every featured id exists in its core.json category', () => {
  findGroup(coreSet.masterminds, FEATURED_TABLE.mastermindId);
  findGroup(coreSet.schemes, FEATURED_TABLE.schemeId);
  for (const villainGroupId of FEATURED_TABLE.villainGroupIds) {
    findGroup(coreSet.villains, villainGroupId);
  }
  for (const henchmanGroupId of FEATURED_TABLE.henchmanGroupIds) {
    findGroup(coreSet.henchmen, henchmanGroupId);
  }
  for (const heroDeckId of FEATURED_TABLE.heroDeckIds) {
    findGroup(coreSet.heroes, heroDeckId);
  }
});

test("the mastermind's Always Leads groups are all in the villain groups", () => {
  const mastermind = findGroup(coreSet.masterminds, FEATURED_TABLE.mastermindId);
  const villainSlugs = FEATURED_TABLE.villainGroupIds.map(toSlug);
  const alwaysLeads = mastermind.alwaysLeads ?? [];
  assert.ok(alwaysLeads.length > 0, 'The featured mastermind should carry an Always Leads group.');
  for (const leadSlug of alwaysLeads) {
    assert.ok(
      villainSlugs.includes(leadSlug),
      `Always Leads "${leadSlug}" is not among the featured villain groups.`,
    );
  }
});

test('the composition has the 1-player group and hero counts', () => {
  // why: pins PLAYER_COUNT_SETUP[1] (D-24165: 1 villain group, 1 henchman group,
  // 3 heroes). arena-client cannot import the registry; live create's
  // validateSetupData stays the authoritative legality check.
  assert.equal(FEATURED_PLAYER_COUNT, 1);
  assert.equal(FEATURED_TABLE.villainGroupIds.length, 1);
  assert.equal(FEATURED_TABLE.henchmanGroupIds.length, 1);
  assert.equal(FEATURED_TABLE.heroDeckIds.length, 3);
});

test('each label equals the card data name', () => {
  assert.equal(
    FEATURED_TABLE_LABELS.mastermind,
    findGroup(coreSet.masterminds, FEATURED_TABLE.mastermindId).name,
  );
  assert.equal(FEATURED_TABLE_LABELS.scheme, findGroup(coreSet.schemes, FEATURED_TABLE.schemeId).name);
  assert.equal(
    FEATURED_TABLE_LABELS.villainGroup,
    findGroup(coreSet.villains, FEATURED_TABLE.villainGroupIds[0]!).name,
  );
  assert.equal(
    FEATURED_TABLE_LABELS.henchmanGroup,
    findGroup(coreSet.henchmen, FEATURED_TABLE.henchmanGroupIds[0]!).name,
  );
  const heroNames = FEATURED_TABLE.heroDeckIds.map((heroDeckId) => findGroup(coreSet.heroes, heroDeckId).name);
  assert.deepEqual([...FEATURED_TABLE_LABELS.heroes], heroNames);
});

test("the art URL is the imageUrl of the mastermind's base card", () => {
  const mastermind = findGroup(coreSet.masterminds, FEATURED_TABLE.mastermindId);
  const baseCard = (mastermind.cards ?? []).find((card) => card.name === mastermind.name);
  assert.ok(baseCard !== undefined, 'The featured mastermind should have a base card named after it.');
  assert.equal(FEATURED_TABLE_LABELS.artUrl, baseCard.imageUrl);
});
