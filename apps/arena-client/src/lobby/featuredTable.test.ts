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

// why: WP-788 / D-24636 — arena-client may never import `apps/server` (layer
// rule), so the server's GUEST_SOLO_FEATURED_TABLE is read as source TEXT and
// compared with FEATURED_TABLE; a guest and a signed-in player must get the
// same featured table.
const SERVER_TABLE_URL = new URL('../../../server/src/match/guestSoloRoutes.mjs', import.meta.url);

/**
 * Isolates the GUEST_SOLO_FEATURED_TABLE object literal from the server source.
 * The table holds only strings, numbers, and arrays, so the first `}` after the
 * first `{` closes it.
 *
 * @param source The server file's text.
 * @returns The literal from its opening `{` to its closing `}`.
 */
function extractServerTableLiteral(source: string): string {
  const marker = 'export const GUEST_SOLO_FEATURED_TABLE';
  const start = source.indexOf(marker);
  assert.ok(
    start >= 0,
    'apps/server/src/match/guestSoloRoutes.mjs no longer exports GUEST_SOLO_FEATURED_TABLE, so it cannot be compared with FEATURED_TABLE in apps/arena-client/src/lobby/featuredTable.ts.',
  );
  const withoutComments = source
    .slice(start)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
  const open = withoutComments.indexOf('{');
  const close = withoutComments.indexOf('}', open);
  return withoutComments.slice(open, close + 1);
}

/**
 * Compares a server table literal with FEATURED_TABLE: the same ids (sorted) and
 * the same four supply counts.
 *
 * @param literal The extracted server object literal.
 * @returns A list of mismatch descriptions; empty when the tables are equal.
 */
function compareWithFeaturedTable(literal: string): string[] {
  const mismatches: string[] = [];
  const serverIds: string[] = [];
  for (const match of literal.matchAll(/'([^']*)'|"([^"]*)"/g)) {
    serverIds.push(match[1] ?? match[2] ?? '');
  }
  serverIds.sort();
  const clientIds = [
    FEATURED_TABLE.schemeId,
    FEATURED_TABLE.mastermindId,
    ...FEATURED_TABLE.villainGroupIds,
    ...FEATURED_TABLE.henchmanGroupIds,
    ...FEATURED_TABLE.heroDeckIds,
  ].sort();
  if (JSON.stringify(serverIds) !== JSON.stringify(clientIds)) {
    mismatches.push(`ids differ: server ${JSON.stringify(serverIds)}, client ${JSON.stringify(clientIds)}`);
  }
  const counts: Array<[string, number]> = [
    ['bystandersCount', FEATURED_TABLE.bystandersCount],
    ['woundsCount', FEATURED_TABLE.woundsCount],
    ['officersCount', FEATURED_TABLE.officersCount],
    ['sidekicksCount', FEATURED_TABLE.sidekicksCount],
  ];
  for (const [field, value] of counts) {
    if (!new RegExp(`\\b${field}\\s*:\\s*${value}\\b`).test(literal)) {
      mismatches.push(`${field} is not ${value} in the server table`);
    }
  }
  return mismatches;
}

test('the server guest-solo table equals FEATURED_TABLE, and a drifted copy is caught', () => {
  const literal = extractServerTableLiteral(readFileSync(SERVER_TABLE_URL, 'utf8'));
  assert.deepEqual(compareWithFeaturedTable(literal), []);
  const drifted = literal.replace("'core/wolverine'", "'core/storm'");
  assert.notEqual(drifted, literal, 'The drift probe must actually change the literal.');
  assert.ok(compareWithFeaturedTable(drifted).length > 0);
});
