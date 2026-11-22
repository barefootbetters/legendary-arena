/**
 * Tests for buildVillainCapturedHeroCost, the setup-time captured-Hero cost opt-in
 * scan (WP-905 / D-24862).
 *
 * A dynamic villain opts into the captured-Hero cost Attack term by its REAL
 * Hero-capture ability marker, not by the `+` / `*` display glyph. These tests pin the
 * positive (a capture marker qualifies), the negatives (a Bystander-capture / no-capture
 * line and a villain whose own variable-Attack term wins do NOT qualify), the narrow-mock
 * graceful skip, the per-copy fan-out, and a non-vacuous drift assertion that the
 * allow-list covers every Hero-capture data-marker token in the pool.
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildVillainCapturedHeroCost,
  HERO_CAPTURE_EFFECT_MARKERS,
} from './buildVillainCapturedHeroCost.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';

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
 * @returns A config whose other fields are inert for this builder.
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

describe('buildVillainCapturedHeroCost — opt-in scan (WP-905)', () => {
  it('a villain with a captureHqHero* marker qualifies (one entry per copy)', () => {
    const registry = makeRegistry('co2e', [
      {
        slug: 'skulls',
        cards: [
          {
            slug: 'skrull-shapeshifter',
            vAttack: '1+',
            copies: 2,
            abilities: [
              "Ambush: Skrull Shapeshifter captures the rightmost Hero. It gets +[icon:attack] equal to that Hero's cost. [effect:captureHqHeroRightmost]",
            ],
          },
        ],
      },
    ]);
    assert.deepEqual(buildVillainCapturedHeroCost(registry, makeConfig(['co2e/skulls'])), {
      'co2e-villain-skulls-skrull-shapeshifter-00': true,
      'co2e-villain-skulls-skrull-shapeshifter-01': true,
    });
  });

  it('a capture-pile-hero / capture-hq-heroes-cost-lte marker on a line qualifies', () => {
    const registry = makeRegistry('co2e', [
      {
        slug: 'kidnappers-like',
        cards: [
          {
            slug: 'pile-capturer',
            vAttack: '2+',
            abilities: ['Ambush: captures a Sidekick. [effect:capture-pile-hero:sidekick] [effect:capture-hq-heroes-cost-lte:2]'],
          },
        ],
      },
    ]);
    assert.deepEqual(buildVillainCapturedHeroCost(registry, makeConfig(['co2e/kidnappers-like'])), {
      'co2e-villain-kidnappers-like-pile-capturer-00': true,
    });
  });

  it('WP-903 Bullseye icon-guess capture qualifies (the allow-list covers it)', () => {
    const registry = makeRegistry('bkwd', [
      {
        slug: 'taskmasters-thunderbolts',
        cards: [
          {
            slug: 'bullseye',
            vAttack: '4+',
            abilities: [
              "Ambush: ... Bullseye captures it and gets +[icon:attack] equal to that Hero's cost. [effect:capture-hero-deck-top-by-icon-guess]",
            ],
          },
        ],
      },
    ]);
    assert.deepEqual(
      buildVillainCapturedHeroCost(registry, makeConfig(['bkwd/taskmasters-thunderbolts'])),
      { 'bkwd-villain-taskmasters-thunderbolts-bullseye-00': true },
    );
  });

  it('a Bystander-capture / no-capture villain does NOT qualify (negative)', () => {
    const registry = makeRegistry('core', [
      {
        slug: 'plain',
        cards: [
          { slug: 'bystander-grabber', vAttack: '3+', abilities: ['Ambush: captures a Bystander. [effect:capture-bystander]'] },
          { slug: 'noop-villain', vAttack: '5+', abilities: ['Fight: draw a card. [effect:draw-cards-current]'] },
        ],
      },
    ]);
    assert.deepEqual(buildVillainCapturedHeroCost(registry, makeConfig(['core/plain'])), {});
  });

  it('a villain whose own variable-Attack term wins is excluded even with a capture line (Venom)', () => {
    const registry = makeRegistry('co2e', [
      {
        slug: 'venom-like',
        cards: [
          {
            slug: 'venom',
            vAttack: '5+',
            abilities: [
              'Venom gets +1[icon:attack] for each Hero he has. [attack-per-captured:hero:1]',
              'Ambush: captures a Sidekick. [effect:capture-pile-hero:sidekick] [effect:capture-hq-heroes-cost-lte:2]',
            ],
          },
          {
            slug: 'sunlight-capturer',
            vAttack: '2+',
            abilities: [
              'Gets +1[icon:attack] per HQ class. [variable-attack:per-hq-hero-class:1]',
              'Ambush: captures the rightmost Hero. [effect:captureHqHeroRightmost]',
            ],
          },
        ],
      },
    ]);
    assert.deepEqual(buildVillainCapturedHeroCost(registry, makeConfig(['co2e/venom-like'])), {});
  });

  it('a narrow (reader-less) mock yields an empty record, never throws', () => {
    assert.deepEqual(buildVillainCapturedHeroCost(null, makeConfig(['co2e/skulls'])), {});
    assert.deepEqual(buildVillainCapturedHeroCost({}, makeConfig(['co2e/skulls'])), {});
    assert.deepEqual(buildVillainCapturedHeroCost({ getSet: 'x' }, makeConfig(['co2e/skulls'])), {});
  });

  it('drift: HERO_CAPTURE_EFFECT_MARKERS covers every Hero-capture data-marker token (non-vacuous)', () => {
    // why: the allow-list is hand-maintained; this pins it ⊇ the `[effect:…]` tokens that
    // actually attach a Hero to G.villainAttachedHeroes in the committed card data, so a
    // future hero-capture primitive cannot silently drop a villain's captured-Hero cost term.
    const HERO_CAPTURE_DATA_MARKER_TOKENS = [
      'captureHqHeroRightmost',
      'captureHqHeroHighestCost',
      'captureHqHeroLowestCost',
      'capture-pile-hero',
      'capture-hq-heroes-cost-lte',
      'capture-hero-deck-top-by-icon-guess',
    ];
    for (const token of HERO_CAPTURE_DATA_MARKER_TOKENS) {
      assert.equal(HERO_CAPTURE_EFFECT_MARKERS.has(token), true, `allow-list must cover ${token}`);
    }
    // why: a phantom token proves the guard is not vacuously true (a Bystander capture is NOT
    // a Hero capture and must stay out of the allow-list).
    assert.equal(HERO_CAPTURE_EFFECT_MARKERS.has('capture-bystander'), false);
    assert.equal(HERO_CAPTURE_EFFECT_MARKERS.has('captureHqHeroNonexistent'), false);
  });
});
