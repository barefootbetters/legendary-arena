/**
 * Tests for Super Hero Civil War 2-player Hero-Deck setup sizing (WP-515 / D-24328).
 *
 * At exactly 2 players, Civil War builds a Hero Deck from only 4 hero groups (its
 * printed "If only 2 players, use only 4 Heroes in the Hero Deck") — the smaller deck
 * that makes WP-510/D-24318's hero-deck-depletion loss reachable at 2p. 3-5 player
 * Civil War and every non-Civil-War scheme build the full 5 groups.
 *
 * This is the build-wiring companion to schemeSetupSizing.test.ts (which unit-tests the
 * pure `resolveEffectiveHeroDeckIds` slice): here we build a full G from a 5-hero-group
 * fixture and assert the applied deck size, plus the AC-4 loss-wiring assertion that the
 * sized deck feeds the shipped depletion loss. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildInitialGameState } from './buildInitialGameState.js';
import { applyPileDepletionResourceLoss } from '../rules/schemeResourceLoss.js';
import { makeMockCtx } from '../test/mockCtx.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';

const CIVIL_WAR_SCHEME_ID = 'core/super-hero-civil-war';
const FIVE_HERO_IDS = [
  'core/hero-a',
  'core/hero-b',
  'core/hero-c',
  'core/hero-d',
  'core/hero-e',
];

/**
 * The four canonical rarity cards for one hero group (the D-13501 5/3/3/3 copy map →
 * 14 cards per group). Mirrors the loadout fixture's black-widow shape.
 */
function makeHeroGroupCards(heroSlug: string) {
  return [
    {
      slug: 'c1',
      rarityLabel: 'Common 1',
      name: `${heroSlug} C1`,
      imageUrl: `https://images.legendary-arena.com/core/core-hero-${heroSlug}-1.webp`,
      cost: 2,
      attack: null,
      recruit: '2',
    },
    {
      slug: 'c2',
      rarityLabel: 'Common 2',
      name: `${heroSlug} C2`,
      imageUrl: `https://images.legendary-arena.com/core/core-hero-${heroSlug}-2.webp`,
      cost: 3,
      attack: '2',
      recruit: null,
    },
    {
      slug: 'u',
      rarityLabel: 'Uncommon',
      name: `${heroSlug} U`,
      imageUrl: `https://images.legendary-arena.com/core/core-hero-${heroSlug}-3.webp`,
      cost: 4,
      attack: null,
      recruit: '3',
    },
    {
      slug: 'r',
      rarityLabel: 'Rare',
      name: `${heroSlug} R`,
      imageUrl: `https://images.legendary-arena.com/core/core-hero-${heroSlug}-4.webp`,
      cost: 6,
      attack: '4',
      recruit: null,
    },
  ];
}

/**
 * A registry with 5 hero groups + a Civil War scheme (plus a minimal mastermind /
 * villain / henchman so the full build succeeds). Mirrors the loadout-fixture shape.
 */
function buildCivilWarRegistry() {
  const heroSlugs = ['hero-a', 'hero-b', 'hero-c', 'hero-d', 'hero-e'];
  const setData = {
    abbr: 'core',
    schemes: [{ slug: 'super-hero-civil-war' }, { slug: 'midtown-bank-robbery' }],
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
    listCards: () => [
      {
        key: 'core-villain-brotherhood-magneto',
        cardType: 'villain',
        slug: 'magneto',
        setAbbr: 'core',
        abilities: ['Magneto attacks!'],
      },
      {
        key: 'core-villain-brotherhood-mystique',
        cardType: 'villain',
        slug: 'mystique',
        setAbbr: 'core',
        abilities: ['Mystique disguises.'],
      },
    ],
    listSets: () => [{ abbr: 'core' }],
    getSet: (abbr: string) => (abbr === 'core' ? setData : undefined),
  };
}

/** A 5-hero-group loadout config; schemeId is the parameter under test. */
function buildCivilWarConfig(schemeId: string): MatchSetupConfig {
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

/** Distinct hero-group slugs across the HQ + Hero Deck (ext_id `{set}/{heroSlug}/…`). */
function distinctHeroGroups(gameState: ReturnType<typeof buildInitialGameState>): Set<string> {
  const groups = new Set<string>();
  for (const slot of gameState.hq) {
    if (slot !== null) {
      groups.add(slot.split('/')[1]!);
    }
  }
  for (const cardId of gameState.heroDeck) {
    groups.add(cardId.split('/')[1]!);
  }
  return groups;
}

describe('buildInitialGameState — Super Hero Civil War 2p Hero-Deck sizing (WP-515 / D-24328)', () => {
  it('AC-3 a 2-player Civil War match builds a 4-group Hero Deck (56 cards; HQ 5 + deck 51)', () => {
    const registry = buildCivilWarRegistry();
    const config = buildCivilWarConfig(CIVIL_WAR_SCHEME_ID);
    const context = makeMockCtx({ numPlayers: 2 });

    const gameState = buildInitialGameState(config, registry, context);

    assert.equal(distinctHeroGroups(gameState).size, 4, 'exactly 4 hero groups at 2p Civil War');
    // why: 4 groups × 14 cards = 56 total; fillHqFromDeck moves 5 into the HQ.
    assert.equal(gameState.heroDeck.length, 4 * 14 - 5, 'G.heroDeck holds the sized 51-card reservoir');
  });

  it('AC-3 a 3-player Civil War match builds the full 5-group Hero Deck (70 cards; deck 65)', () => {
    const registry = buildCivilWarRegistry();
    const config = buildCivilWarConfig(CIVIL_WAR_SCHEME_ID);
    const context = makeMockCtx({ numPlayers: 3 });

    const gameState = buildInitialGameState(config, registry, context);

    assert.equal(distinctHeroGroups(gameState).size, 5, 'all 5 hero groups at 3p Civil War (sizing is 2p-only)');
    assert.equal(gameState.heroDeck.length, 5 * 14 - 5, 'G.heroDeck holds the full 65-card reservoir');
  });

  it('AC-3 a 2-player non-Civil-War match builds the full 5-group Hero Deck', () => {
    const registry = buildCivilWarRegistry();
    const config = buildCivilWarConfig('core/midtown-bank-robbery');
    const context = makeMockCtx({ numPlayers: 2 });

    const gameState = buildInitialGameState(config, registry, context);

    assert.equal(distinctHeroGroups(gameState).size, 5, 'all 5 hero groups — the sizing is Civil-War-only');
    assert.equal(gameState.heroDeck.length, 5 * 14 - 5, 'non-Civil-War 2p deck is unchanged');
  });

  it('AC-4 the sized 2p Civil War deck feeds the shipped depletion loss (empty heroDeck latches SCHEME_LOSS)', () => {
    const registry = buildCivilWarRegistry();
    const config = buildCivilWarConfig(CIVIL_WAR_SCHEME_ID);
    const context = makeMockCtx({ numPlayers: 2 });

    const gameState = buildInitialGameState(config, registry, context);
    // why: WP-510/D-24318's loss keys on the Civil War `pile-depleted`/`heroDeck`
    // condition — the SIZED deck feeds the same check. Draining it to empty must latch
    // SCHEME_LOSS (this WP makes that reachable at 2p; it does not change the loss).
    gameState.heroDeck = [];
    applyPileDepletionResourceLoss(gameState);

    assert.equal(gameState.counters.schemeLoss, 1, 'empty G.heroDeck latches SCHEME_LOSS for 2p Civil War');
  });
});
