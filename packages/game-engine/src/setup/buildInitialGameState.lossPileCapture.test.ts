/**
 * Tests for the lazy depletion-pile setup capture (WP-562 / D-24371 §2).
 *
 * `Game.setup()` records the setup size of the pile whose depletion IS the active
 * scheme's Evil-Wins condition, so the danger meter can measure that condition
 * instead of falling back to counting Scheme Twists (the D-24366 §5 behaviour this
 * packet supersedes).
 *
 * Two properties matter here and are asserted separately:
 *
 * 1. The captured hero-deck number is the TOTAL HERO CARDS BUILT, before the 5
 *    dealt to the HQ — the operator's 42-over-37 decision, at this fixture's scale.
 * 2. The field is LAZY. Its absence for every non-`pile-depleted` scheme is what
 *    keeps those games' state hashes — and `PRE_WP080_HASH` — unmoved.
 *
 * The registry fixture mirrors `buildInitialGameState.civilWarSizing.test.ts`
 * (5 hero groups × the D-13501 4-rarity / 14-copy map). node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildInitialGameState } from './buildInitialGameState.js';
import { makeMockCtx } from '../test/mockCtx.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';

const CIVIL_WAR_SCHEME_ID = 'core/super-hero-civil-war';
const LEGACY_VIRUS_SCHEME_ID = 'core/legacy-virus-the';
const MIDTOWN_SCHEME_ID = 'core/midtown-bank-robbery';

const FIVE_HERO_IDS = [
  'core/hero-a',
  'core/hero-b',
  'core/hero-c',
  'core/hero-d',
  'core/hero-e',
];

// why: the D-13501 rarity → copy-count map is 5/3/3/3 across the four rarity
// labels, so one hero group builds 14 cards. Named rather than inlined because
// every expected total below is a multiple of it.
const CARDS_PER_HERO_GROUP = 14;
const HQ_SLOTS = 5;

/**
 * Builds the four canonical rarity cards for one hero group.
 *
 * @param heroSlug - The hero group's slug.
 * @returns The group's four registry card entries.
 */
function makeHeroGroupCards(heroSlug: string) {
  return [
    { slug: 'c1', rarityLabel: 'Common 1', name: `${heroSlug} C1`, cost: 2, attack: null, recruit: '2' },
    { slug: 'c2', rarityLabel: 'Common 2', name: `${heroSlug} C2`, cost: 3, attack: '2', recruit: null },
    { slug: 'u', rarityLabel: 'Uncommon', name: `${heroSlug} U`, cost: 4, attack: null, recruit: '3' },
    { slug: 'r', rarityLabel: 'Rare', name: `${heroSlug} R`, cost: 6, attack: '4', recruit: null },
  ];
}

/**
 * Builds a registry carrying the three schemes under test plus 5 hero groups.
 *
 * @returns A CardRegistryReader-shaped mock.
 */
function buildRegistry() {
  const heroSlugs = ['hero-a', 'hero-b', 'hero-c', 'hero-d', 'hero-e'];
  const setData = {
    abbr: 'core',
    schemes: [
      { slug: 'super-hero-civil-war' },
      { slug: 'legacy-virus-the' },
      { slug: 'midtown-bank-robbery' },
    ],
    masterminds: [
      {
        slug: 'dr-doom',
        cards: [
          { slug: 'doom-base', tactic: false, vAttack: '8' },
          { slug: 'doom-tactic-a', tactic: true, vAttack: '4' },
          { slug: 'doom-tactic-b', tactic: true, vAttack: '5' },
        ],
      },
    ],
    henchmen: [{ slug: 'doombot-legion', vAttack: '3' }],
    villains: [
      {
        slug: 'brotherhood',
        cards: [
          { slug: 'magneto', vAttack: '6' },
          { slug: 'mystique', vAttack: '4' },
        ],
      },
    ],
    heroes: heroSlugs.map((heroSlug) => ({ slug: heroSlug, cards: makeHeroGroupCards(heroSlug) })),
  };

  return {
    listCards: () => [],
    listSets: () => [{ abbr: 'core' }],
    getSet: (abbr: string) => (abbr === 'core' ? setData : undefined),
  };
}

/**
 * Builds a 5-hero-group loadout config for a named scheme.
 *
 * @param schemeId - The scheme under test.
 * @returns A valid MatchSetupConfig.
 */
function buildConfig(schemeId: string): MatchSetupConfig {
  return {
    schemeId,
    mastermindId: 'core/dr-doom',
    villainGroupIds: ['core/brotherhood'],
    henchmanGroupIds: ['core/doombot-legion'],
    heroDeckIds: [...FIVE_HERO_IDS],
    bystandersCount: 5,
    woundsCount: 30,
    officersCount: 15,
    sidekicksCount: 0,
  } as MatchSetupConfig;
}

describe('buildInitialGameState — the lazy loss-pile capture (WP-562 / D-24371 §2)', () => {
  it('captures the TOTAL hero cards built, not the post-HQ remainder', () => {
    // why: the 42-over-37 operator decision, at this fixture's scale. 5 groups ×
    // 14 = 70 cards built; 5 go to the HQ leaving 65 in G.heroDeck. The capture
    // must be 70. It is asserted against BOTH numbers because "correcting" it to
    // the post-HQ remainder is the specific regression the WP names — the HQ
    // cards are recruitable, not gone.
    const gameState = buildInitialGameState(
      buildConfig(CIVIL_WAR_SCHEME_ID),
      buildRegistry(),
      makeMockCtx({ numPlayers: 3 }),
    );

    assert.equal(gameState.schemeLossPileSetupSize, 5 * CARDS_PER_HERO_GROUP);
    assert.equal(gameState.heroDeck.length, 5 * CARDS_PER_HERO_GROUP - HQ_SLOTS);
    assert.notEqual(gameState.schemeLossPileSetupSize, gameState.heroDeck.length);
  });

  it('tracks the 2-player Civil War sizing override', () => {
    // why: at exactly 2 players Civil War builds only 4 groups (D-24328). The
    // capture must follow the SIZED deck — a hardcoded 70 would report a
    // denominator the match never had.
    const gameState = buildInitialGameState(
      buildConfig(CIVIL_WAR_SCHEME_ID),
      buildRegistry(),
      makeMockCtx({ numPlayers: 2 }),
    );

    assert.equal(gameState.schemeLossPileSetupSize, 4 * CARDS_PER_HERO_GROUP);
  });

  it('captures the wound stack for Legacy Virus, at its own sizing rule', () => {
    // why: Legacy Virus names `wounds`, and D-24321 sizes that stack at 6 per
    // player rather than the config's 30 — so the capture proves it reads the
    // BUILT pile rather than the requested count.
    const gameState = buildInitialGameState(
      buildConfig(LEGACY_VIRUS_SCHEME_ID),
      buildRegistry(),
      makeMockCtx({ numPlayers: 2 }),
    );

    assert.equal(gameState.schemeLossPileSetupSize, gameState.piles.wounds.length);
    assert.equal(gameState.schemeLossPileSetupSize, 12);
  });

  it('AC-8: the field is ABSENT for a scheme that does not lose on depletion', () => {
    // why: absence, not `undefined`. A key serialised into every game's state
    // would move PRE_WP080_HASH and every non-pile-depleted fixture hash — which
    // the packet treats as a STOP condition, not a re-pin. `in` is the assertion
    // that distinguishes the two.
    const gameState = buildInitialGameState(
      buildConfig(MIDTOWN_SCHEME_ID),
      buildRegistry(),
      makeMockCtx({ numPlayers: 2 }),
    );

    assert.equal('schemeLossPileSetupSize' in gameState, false);
  });
});
