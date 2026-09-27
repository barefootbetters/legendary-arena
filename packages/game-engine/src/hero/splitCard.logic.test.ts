/**
 * Tests for the Divided Card off-play read helpers (WP-772 / D-24604): resolveSplitFacePair,
 * offPlayCardTraits, offPlayCardStats — plus a real-data invariant pin over the five split sets.
 *
 * Covers:
 *  - resolveSplitFacePair from a primary id and from an alternate id (same #copyIndex); null for
 *    a non-split id and when there is no split-face map; the primary lookup wins before the scan.
 *  - offPlayCardTraits: union of both halves' classes; identity for a non-split card.
 *  - offPlayCardStats: attack / recruit totalled, icons OR-ed, cost from face a; identity.
 *  - Contract edges: absent maps return undefined; a missing face entry falls back to the raw
 *    entry; the split path returns a new object (never a G entry).
 *  - Real data: all 39 split pairs have no hc2, distinct hc, equal cost, no Recruit on both faces,
 *    and the primary→alternate map is one-to-one (the two-slot union + sum premise).
 *
 * Uses node:test + node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { resolveSplitFacePair, offPlayCardTraits, offPlayCardStats } from './splitCard.logic.js';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { CardTraitEntry } from '../state/cardTraits.types.js';
import type { CardStatEntry } from '../economy/economy.types.js';

const FACE_A = 'cvwr/captain-america-secret-avenger/inspire-a-man#2' as CardExtId;
const FACE_B = 'cvwr/captain-america-secret-avenger/inspire-a-nation#2' as CardExtId;
const PLAIN_CARD = 'core/spider-man/astonishing-strength#0' as CardExtId;
const SPLIT_FACES = {
  'cvwr/captain-america-secret-avenger/inspire-a-man': 'cvwr/captain-america-secret-avenger/inspire-a-nation',
} as Record<CardExtId, CardExtId>;

/** Builds a card-stat row with the icon flags set from the printed values. */
function stat(attack: number, recruit: number, cost: number): CardStatEntry {
  return {
    attack,
    recruit,
    cost,
    fightCost: 0,
    fightCostMode: 'static',
    fightCostBase: 0,
    hasAttackIcon: attack > 0,
    hasRecruitIcon: recruit > 0,
  } as CardStatEntry;
}

/** Builds the minimal game state the helpers read. */
function makeState(overrides: {
  splitFaces?: Record<CardExtId, CardExtId>;
  cardTraits?: Record<string, CardTraitEntry>;
  cardStats?: Record<string, CardStatEntry>;
}): LegendaryGameState {
  const state = {
    cardTraits: overrides.cardTraits,
    cardStats: overrides.cardStats,
  } as unknown as LegendaryGameState;
  if (overrides.splitFaces !== undefined) {
    state.splitFaces = overrides.splitFaces;
  }
  return state;
}

const TRAITS: Record<string, CardTraitEntry> = {
  [FACE_A]: { heroClass: 'instinct', team: 'avengers' },
  [FACE_B]: { heroClass: 'strength', team: 'avengers' },
  [PLAIN_CARD]: { heroClass: 'strength', team: 'spider-friends' },
};
const STATS: Record<string, CardStatEntry> = {
  [FACE_A]: stat(2, 0, 3),
  [FACE_B]: stat(0, 2, 3),
  [PLAIN_CARD]: stat(0, 2, 1),
};

describe('resolveSplitFacePair (WP-772 / D-24604)', () => {
  it('resolves both faces from the primary id and from the alternate id at the same copy index', () => {
    const state = makeState({ splitFaces: SPLIT_FACES });
    assert.deepEqual(resolveSplitFacePair(state, FACE_A), { faceA: FACE_A, faceB: FACE_B });
    assert.deepEqual(resolveSplitFacePair(state, FACE_B), { faceA: FACE_A, faceB: FACE_B });
  });

  it('returns null for a non-split id and when there is no split-face map', () => {
    assert.equal(resolveSplitFacePair(makeState({ splitFaces: SPLIT_FACES }), PLAIN_CARD), null);
    assert.equal(resolveSplitFacePair(makeState({}), FACE_A), null);
  });

  it('prefers the primary-key lookup over the alternate scan', () => {
    // why: a (malformed) map where a base is both a key and another key's value — the primary
    // lookup must answer first, so the id resolves as a PRIMARY face.
    const chained = {
      'set/hero/x': 'set/hero/y',
      'set/hero/w': 'set/hero/x',
    } as Record<CardExtId, CardExtId>;
    const pair = resolveSplitFacePair(makeState({ splitFaces: chained }), 'set/hero/x#0');
    assert.deepEqual(pair, { faceA: 'set/hero/x#0', faceB: 'set/hero/y#0' });
  });
});

describe('offPlayCardTraits (WP-772 / D-24604)', () => {
  it('a split card counts as both halves’ classes, from either face id', () => {
    const state = makeState({ splitFaces: SPLIT_FACES, cardTraits: TRAITS });
    const expected = { heroClass: 'instinct', heroClass2: 'strength', team: 'avengers' };
    assert.deepEqual(offPlayCardTraits(state, FACE_A), expected);
    assert.deepEqual(offPlayCardTraits(state, FACE_B), expected);
  });

  it('returns the raw entry (same reference) for a non-split card and when there is no map', () => {
    const state = makeState({ splitFaces: SPLIT_FACES, cardTraits: TRAITS });
    assert.equal(offPlayCardTraits(state, PLAIN_CARD), TRAITS[PLAIN_CARD]);
    assert.equal(offPlayCardTraits(makeState({ cardTraits: TRAITS }), FACE_A), TRAITS[FACE_A]);
  });

  it('omits heroClass2 when both halves share a class', () => {
    const sameClass = { ...TRAITS, [FACE_B]: { heroClass: 'instinct', team: 'avengers' } };
    const state = makeState({ splitFaces: SPLIT_FACES, cardTraits: sameClass });
    assert.deepEqual(offPlayCardTraits(state, FACE_A), { heroClass: 'instinct', team: 'avengers' });
  });

  it('the split path returns a new object and never writes G.cardTraits', () => {
    const traits = { ...TRAITS };
    const state = makeState({ splitFaces: SPLIT_FACES, cardTraits: traits });
    const union = offPlayCardTraits(state, FACE_A);
    assert.notEqual(union, traits[FACE_A]);
    assert.notEqual(union, traits[FACE_B]);
    assert.deepEqual(traits, TRAITS, 'G.cardTraits untouched');
  });

  it('absent cardTraits → undefined; a missing face entry → the raw entry for the id', () => {
    assert.equal(offPlayCardTraits(makeState({ splitFaces: SPLIT_FACES }), FACE_A), undefined);
    const missingB = { [FACE_A]: TRAITS[FACE_A]! };
    const state = makeState({ splitFaces: SPLIT_FACES, cardTraits: missingB });
    assert.equal(offPlayCardTraits(state, FACE_A), missingB[FACE_A]);
  });
});

describe('offPlayCardStats (WP-772 / D-24604)', () => {
  it('totals attack and recruit, ORs the icons, and keeps face a’s cost', () => {
    const state = makeState({ splitFaces: SPLIT_FACES, cardStats: STATS });
    const combined = offPlayCardStats(state, FACE_B);
    assert.equal(combined?.attack, 2);
    assert.equal(combined?.recruit, 2);
    assert.equal(combined?.cost, 3);
    assert.equal(combined?.hasAttackIcon, true);
    assert.equal(combined?.hasRecruitIcon, true);
  });

  it('returns the raw entry (same reference) for a non-split card', () => {
    const state = makeState({ splitFaces: SPLIT_FACES, cardStats: STATS });
    assert.equal(offPlayCardStats(state, PLAIN_CARD), STATS[PLAIN_CARD]);
  });

  it('absent cardStats → undefined; a missing face entry → the raw entry; never a G entry', () => {
    assert.equal(offPlayCardStats(makeState({ splitFaces: SPLIT_FACES }), FACE_A), undefined);
    const missingA = { [FACE_B]: STATS[FACE_B]! };
    assert.equal(
      offPlayCardStats(makeState({ splitFaces: SPLIT_FACES, cardStats: missingA }), FACE_B),
      missingA[FACE_B],
    );
    const combined = offPlayCardStats(makeState({ splitFaces: SPLIT_FACES, cardStats: STATS }), FACE_A);
    assert.notEqual(combined, STATS[FACE_A]);
    assert.equal(STATS[FACE_A]!.attack, 2, 'G.cardStats untouched');
  });
});

// ---------------------------------------------------------------------------
// Real-data invariant pin — the premise the two-slot union and the sum rely on.
// ---------------------------------------------------------------------------

interface RawHeroCard {
  slug: string;
  hc?: string | null;
  hc2?: string | null;
  cost?: number | string | null;
  recruit?: number | string | null;
}

interface RawHero {
  slug: string;
  cards: RawHeroCard[];
  physicalCards?: { sides: string[] }[] | null;
}

const SPLIT_SETS = ['bkwd', 'cvwr', 'mgtg', 'msis', 'xmen'];
const CARDS_DIRECTORY = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../data/cards',
);

/** Whether a raw printed Recruit value shows a Recruit number. */
function hasPrintedRecruit(value: number | string | null | undefined): boolean {
  return value !== null && value !== undefined && value !== '' && value !== '0' && value !== 0;
}

describe('split-card data premise (WP-772 / D-24604 real-data pin)', () => {
  it('all 39 split pairs: no hc2, distinct hc, equal cost, no Recruit on both faces, one-to-one map', () => {
    const primaryKeys = new Set<string>();
    const alternateKeys = new Set<string>();
    const violations: string[] = [];
    for (const setAbbr of SPLIT_SETS) {
      const setData = JSON.parse(readFileSync(path.join(CARDS_DIRECTORY, `${setAbbr}.json`), 'utf8')) as {
        heroes: RawHero[];
      };
      for (const hero of setData.heroes) {
        const cardsBySlug = new Map<string, RawHeroCard>();
        for (const card of hero.cards) {
          cardsBySlug.set(card.slug, card);
        }
        for (const physicalCard of hero.physicalCards ?? []) {
          if (physicalCard.sides.length !== 2) {
            continue;
          }
          const [primarySlug, alternateSlug] = physicalCard.sides as [string, string];
          const label = `${setAbbr}/${hero.slug} [${primarySlug} | ${alternateSlug}]`;
          const faceA = cardsBySlug.get(primarySlug);
          const faceB = cardsBySlug.get(alternateSlug);
          if (faceA === undefined || faceB === undefined) {
            violations.push(`${label}: a face has no cards[] entry`);
            continue;
          }
          if (faceA.hc2 || faceB.hc2) violations.push(`${label}: a face carries hc2`);
          if (faceA.hc === faceB.hc) violations.push(`${label}: both faces share hc "${String(faceA.hc)}"`);
          if (faceA.cost !== faceB.cost) violations.push(`${label}: costs differ`);
          if (hasPrintedRecruit(faceA.recruit) && hasPrintedRecruit(faceB.recruit)) {
            violations.push(`${label}: both faces print Recruit`);
          }
          const primaryKey = `${setAbbr}/${hero.slug}/${primarySlug}`;
          const alternateKey = `${setAbbr}/${hero.slug}/${alternateSlug}`;
          if (alternateKeys.has(alternateKey)) violations.push(`${label}: alternate appears twice`);
          primaryKeys.add(primaryKey);
          alternateKeys.add(alternateKey);
        }
      }
    }
    for (const primaryKey of primaryKeys) {
      if (alternateKeys.has(primaryKey)) {
        violations.push(`${primaryKey}: is both a primary key and an alternate value`);
      }
    }
    assert.deepEqual(violations, [], 'the split-card data premise holds for every pair');
    assert.equal(primaryKeys.size, 39, 'exactly 39 split physical cards across the five sets');
  });
});
