/**
 * Tests for hero condition evaluation (WP-023).
 *
 * Verifies the 4 MVP condition types (heroClassMatch, requiresTeam,
 * requiresKeyword, playedThisTurn), unsupported condition handling,
 * AND logic, empty conditions, and G immutability during evaluation.
 *
 * No boardgame.io imports. No modifications to shared test helpers.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateCondition,
  evaluateAllConditions,
  findFailedCondition,
  describeFailedCondition,
} from './heroConditions.evaluate.js';
import type { LegendaryGameState } from '../types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import { makeGlobalPiles, makeMastermindState, makePlayerZones, makeTurnEconomy } from '../test/fixtureBuilders.js';

// ---------------------------------------------------------------------------
// Test helper
// ---------------------------------------------------------------------------

/**
 * Creates a minimal LegendaryGameState for condition evaluation testing.
 *
 * @param overrides - Partial overrides for player zones, hooks, and traits.
 * @returns A minimal LegendaryGameState.
 */
function makeTestState(overrides?: {
  inPlay?: string[];
  heroAbilityHooks?: HeroAbilityHook[];
  cardTraits?: Record<string, { heroClass: string | null; team: string | null }>;
  cardSizeChangingClasses?: Record<string, string[]>;
  turnEconomyRecruit?: number;
}): LegendaryGameState {
  return {
    matchConfiguration: {
      schemeId: 'test-scheme',
      mastermindId: 'test-mastermind',
      villainGroupIds: [],
      henchmanGroupIds: [],
      heroDeckIds: [],
      bystandersCount: 0,
      woundsCount: 0,
      officersCount: 0,
      sidekicksCount: 0,
    },
    selection: {
      schemeId: 'test-scheme',
      mastermindId: 'test-mastermind',
      villainGroupIds: [],
      henchmanGroupIds: [],
      heroDeckIds: [],
    },
    currentStage: 'main' as LegendaryGameState['currentStage'],
    playerZones: {
      '0': { ...makePlayerZones(),
        deck: [],
        hand: [],
        discard: [],
        inPlay: overrides?.inPlay ?? [],
        victory: [],
      },
    },
    piles: { ...makeGlobalPiles(),
      bystanders: [],
      wounds: [],
      officers: [],
      sidekicks: [],
    },
    messages: [],
    counters: {},
    hookRegistry: [],
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: {},
    ko: [],
    attachedBystanders: {},
    turnEconomy: { ...makeTurnEconomy(),
      attack: 0,
      recruit: overrides?.turnEconomyRecruit ?? 0,
      spentAttack: 0,
      spentRecruit: 0,
    },
    cardStats: {},
    cardTraits: overrides?.cardTraits ?? {},
    cardSizeChangingClasses: overrides?.cardSizeChangingClasses ?? {},
    mastermind: { ...makeMastermindState(),
      id: 'test-mastermind',
      baseCardId: 'test-mastermind-base',
      tacticsDeck: [],
      tacticsDefeated: [],
    },
    city: [null, null, null, null, null],
    hq: [null, null, null, null, null],
    lobby: { requiredPlayers: 1, ready: {}, started: false },
    heroAbilityHooks: overrides?.heroAbilityHooks ?? [],
  };
}

describe('evaluateCondition', () => {
  // -------------------------------------------------------------------------
  // Test 1: heroClassMatch returns false when no matching trait data
  // -------------------------------------------------------------------------
  it('heroClassMatch returns false when no card traits match', () => {
    const gameState = makeTestState({
      inPlay: ['hero-a'],
      cardTraits: {
        'hero-a': { heroClass: 'covert', team: null },
      },
    });

    const result = evaluateCondition(gameState, '0', {
      type: 'heroClassMatch',
      value: 'tech',
    });

    assert.equal(result, false,
      'heroClassMatch should return false when no matching class in inPlay.');
  });

  // -------------------------------------------------------------------------
  // Test 2: requiresTeam returns false when no matching trait data
  // -------------------------------------------------------------------------
  it('requiresTeam returns false when no card traits match', () => {
    const gameState = makeTestState({
      inPlay: ['hero-a'],
      cardTraits: {
        'hero-a': { heroClass: null, team: 'x-men' },
      },
    });

    const result = evaluateCondition(gameState, '0', {
      type: 'requiresTeam',
      value: 'avengers',
    });

    assert.equal(result, false,
      'requiresTeam should return false when no matching team in inPlay.');
  });

  // -------------------------------------------------------------------------
  // Test 3: requiresKeyword passes with matching keyword
  // -------------------------------------------------------------------------
  it('requiresKeyword passes when matching keyword on played card', () => {
    const gameState = makeTestState({
      inPlay: ['hero-a'],
      heroAbilityHooks: [
        {
          cardId: 'hero-a' as string,
          timing: 'onPlay',
          keywords: ['attack'],
          effects: [{ type: 'attack', magnitude: 2 }],
        },
      ],
    });

    const result = evaluateCondition(gameState, '0', {
      type: 'requiresKeyword',
      value: 'attack',
    });

    assert.equal(result, true,
      'requiresKeyword should pass when a played card has the keyword.');
  });

  // -------------------------------------------------------------------------
  // Test 4: requiresKeyword fails with no matching keyword
  // -------------------------------------------------------------------------
  it('requiresKeyword fails when no matching keyword on played cards', () => {
    const gameState = makeTestState({
      inPlay: ['hero-a'],
      heroAbilityHooks: [
        {
          cardId: 'hero-a' as string,
          timing: 'onPlay',
          keywords: ['recruit'],
          effects: [{ type: 'recruit', magnitude: 1 }],
        },
      ],
    });

    const result = evaluateCondition(gameState, '0', {
      type: 'requiresKeyword',
      value: 'draw',
    });

    assert.equal(result, false,
      'requiresKeyword should fail when no played card has the keyword.');
  });

  // -------------------------------------------------------------------------
  // Test 5: playedThisTurn passes with enough cards
  // -------------------------------------------------------------------------
  it('playedThisTurn passes when enough cards played', () => {
    const gameState = makeTestState({
      inPlay: ['hero-a', 'hero-b', 'hero-c'],
    });

    const result = evaluateCondition(gameState, '0', {
      type: 'playedThisTurn',
      value: '2',
    });

    assert.equal(result, true,
      'playedThisTurn should pass when inPlay.length >= threshold.');
  });

  // -------------------------------------------------------------------------
  // Test 6: playedThisTurn fails with too few cards
  // -------------------------------------------------------------------------
  it('playedThisTurn fails when too few cards played', () => {
    const gameState = makeTestState({
      inPlay: ['hero-a'],
    });

    const result = evaluateCondition(gameState, '0', {
      type: 'playedThisTurn',
      value: '3',
    });

    assert.equal(result, false,
      'playedThisTurn should fail when inPlay.length < threshold.');
  });

  // -------------------------------------------------------------------------
  // Test 7: unsupported condition type returns false
  // -------------------------------------------------------------------------
  it('unsupported condition type returns false (safe skip)', () => {
    const gameState = makeTestState({
      inPlay: ['hero-a'],
    });

    const result = evaluateCondition(gameState, '0', {
      type: 'unknownFutureCondition',
      value: 'anything',
    });

    assert.equal(result, false,
      'Unsupported condition types should return false.');
  });
});

describe('evaluateAllConditions', () => {
  // -------------------------------------------------------------------------
  // Test 8: empty conditions returns true
  // -------------------------------------------------------------------------
  it('empty conditions array returns true (unconditional)', () => {
    const gameState = makeTestState();

    const resultEmpty = evaluateAllConditions(gameState, '0', []);
    assert.equal(resultEmpty, true,
      'Empty conditions array should return true.');

    const resultUndefined = evaluateAllConditions(gameState, '0', undefined);
    assert.equal(resultUndefined, true,
      'Undefined conditions should return true.');
  });

  // -------------------------------------------------------------------------
  // Test 9: mixed pass/fail returns false (AND logic)
  // -------------------------------------------------------------------------
  it('mixed pass/fail returns false — AND logic enforced', () => {
    const gameState = makeTestState({
      inPlay: ['hero-a', 'hero-b', 'hero-c'],
    });

    // First condition passes (3 >= 2), second fails (placeholder)
    const result = evaluateAllConditions(gameState, '0', [
      { type: 'playedThisTurn', value: '2' },
      { type: 'heroClassMatch', value: 'tech' },
    ]);

    assert.equal(result, false,
      'AND logic: one failing condition should make the result false.');
  });

  // -------------------------------------------------------------------------
  // Test 10: condition evaluation does not mutate G
  // -------------------------------------------------------------------------
  it('condition evaluation does not mutate G (deep equality check)', () => {
    const gameState = makeTestState({
      inPlay: ['hero-a', 'hero-b'],
      heroAbilityHooks: [
        {
          cardId: 'hero-a' as string,
          timing: 'onPlay',
          keywords: ['attack'],
          effects: [{ type: 'attack', magnitude: 2 }],
        },
      ],
    });

    const snapshot = JSON.parse(JSON.stringify(gameState));

    evaluateCondition(gameState, '0', {
      type: 'requiresKeyword',
      value: 'attack',
    });

    evaluateCondition(gameState, '0', {
      type: 'playedThisTurn',
      value: '1',
    });

    evaluateAllConditions(gameState, '0', [
      { type: 'playedThisTurn', value: '1' },
      { type: 'heroClassMatch', value: 'tech' },
    ]);

    assert.deepEqual(gameState, snapshot,
      'G must not be mutated by condition evaluation.');
  });
});

// ---------------------------------------------------------------------------
// WP-179 — heroClassMatch evaluator with G.cardTraits
// ---------------------------------------------------------------------------

describe('evaluateCondition heroClassMatch (WP-179)', () => {
  it('positive: matching hero class card in inPlay returns true', () => {
    const gameState = makeTestState({
      inPlay: ['tech-card-a#0', 'tech-card-b#0'],
      cardTraits: {
        'tech-card-a#0': { heroClass: 'tech', team: 'avengers' },
        'tech-card-b#0': { heroClass: 'tech', team: 'avengers' },
      },
    });

    const result = evaluateCondition(gameState, '0', {
      type: 'heroClassMatch',
      value: 'tech',
    }, 'tech-card-b#0' as unknown as import('../state/zones.types.js').CardExtId);

    assert.equal(result, true, 'should return true when another tech card is in inPlay');
  });

  it('self-only: only the triggering card (same class) in inPlay returns false', () => {
    const gameState = makeTestState({
      inPlay: ['tech-card-a#0'],
      cardTraits: {
        'tech-card-a#0': { heroClass: 'tech', team: 'avengers' },
      },
    });

    const result = evaluateCondition(gameState, '0', {
      type: 'heroClassMatch',
      value: 'tech',
    }, 'tech-card-a#0' as unknown as import('../state/zones.types.js').CardExtId);

    assert.equal(result, false, 'should return false when only self has matching class');
  });

  it('mismatch: different class in inPlay returns false', () => {
    const gameState = makeTestState({
      inPlay: ['covert-card#0', 'trigger-card#0'],
      cardTraits: {
        'covert-card#0': { heroClass: 'covert', team: null },
        'trigger-card#0': { heroClass: 'tech', team: null },
      },
    });

    const result = evaluateCondition(gameState, '0', {
      type: 'heroClassMatch',
      value: 'tech',
    }, 'trigger-card#0' as unknown as import('../state/zones.types.js').CardExtId);

    assert.equal(result, false, 'should return false when no other tech card in inPlay');
  });

  it('undefined-trait: card in inPlay with no cardTraits entry returns false', () => {
    const gameState = makeTestState({
      inPlay: ['unknown-card', 'trigger-card#0'],
      cardTraits: {
        'trigger-card#0': { heroClass: 'tech', team: null },
      },
    });

    const result = evaluateCondition(gameState, '0', {
      type: 'heroClassMatch',
      value: 'tech',
    }, 'trigger-card#0' as unknown as import('../state/zones.types.js').CardExtId);

    assert.equal(result, false, 'should return false when other card has no trait entry');
  });
});

// ---------------------------------------------------------------------------
// WP-179 — requiresTeam evaluator with G.cardTraits
// ---------------------------------------------------------------------------

describe('evaluateCondition requiresTeam (WP-179)', () => {
  it('positive: matching team card in inPlay returns true', () => {
    const gameState = makeTestState({
      inPlay: ['avenger-a#0', 'avenger-b#0'],
      cardTraits: {
        'avenger-a#0': { heroClass: 'tech', team: 'avengers' },
        'avenger-b#0': { heroClass: 'covert', team: 'avengers' },
      },
    });

    const result = evaluateCondition(gameState, '0', {
      type: 'requiresTeam',
      value: 'avengers',
    }, 'avenger-b#0' as unknown as import('../state/zones.types.js').CardExtId);

    assert.equal(result, true, 'should return true when another avengers card is in inPlay');
  });

  it('self-only: only the triggering card (same team) in inPlay returns false', () => {
    const gameState = makeTestState({
      inPlay: ['avenger-a#0'],
      cardTraits: {
        'avenger-a#0': { heroClass: 'tech', team: 'avengers' },
      },
    });

    const result = evaluateCondition(gameState, '0', {
      type: 'requiresTeam',
      value: 'avengers',
    }, 'avenger-a#0' as unknown as import('../state/zones.types.js').CardExtId);

    assert.equal(result, false, 'should return false when only self has matching team');
  });

  it('mismatch: different team in inPlay returns false', () => {
    const gameState = makeTestState({
      inPlay: ['xmen-card#0', 'trigger-card#0'],
      cardTraits: {
        'xmen-card#0': { heroClass: 'covert', team: 'x-men' },
        'trigger-card#0': { heroClass: 'tech', team: 'avengers' },
      },
    });

    const result = evaluateCondition(gameState, '0', {
      type: 'requiresTeam',
      value: 'avengers',
    }, 'trigger-card#0' as unknown as import('../state/zones.types.js').CardExtId);

    assert.equal(result, false, 'should return false when no other avengers card in inPlay');
  });

  it('undefined-trait: card in inPlay with no cardTraits entry returns false', () => {
    const gameState = makeTestState({
      inPlay: ['no-trait-card', 'trigger-card#0'],
      cardTraits: {
        'trigger-card#0': { heroClass: 'tech', team: 'avengers' },
      },
    });

    const result = evaluateCondition(gameState, '0', {
      type: 'requiresTeam',
      value: 'avengers',
    }, 'trigger-card#0' as unknown as import('../state/zones.types.js').CardExtId);

    assert.equal(result, false, 'should return false when other card has no trait entry');
  });
});

// ---------------------------------------------------------------------------
// WP-179 — Integration tests (Tech→Tech superpower, Avengers→Avengers)
// ---------------------------------------------------------------------------

describe('evaluateCondition integration (WP-179)', () => {
  it('Tech→Tech superpower: second tech card condition passes', () => {
    const gameState = makeTestState({
      inPlay: ['core/iron-man/repulsor#0', 'core/iron-man/unibeam#0'],
      cardTraits: {
        'core/iron-man/repulsor#0': { heroClass: 'tech', team: 'avengers' },
        'core/iron-man/unibeam#0': { heroClass: 'tech', team: 'avengers' },
      },
    });

    const conditionResult = evaluateCondition(gameState, '0', {
      type: 'heroClassMatch',
      value: 'tech',
    }, 'core/iron-man/unibeam#0' as unknown as import('../state/zones.types.js').CardExtId);

    assert.equal(conditionResult, true, 'Tech condition passes when another Tech card in inPlay');

    const allResult = evaluateAllConditions(gameState, '0', [
      { type: 'heroClassMatch', value: 'tech' },
    ], 'core/iron-man/unibeam#0' as unknown as import('../state/zones.types.js').CardExtId);

    assert.equal(allResult, true, 'evaluateAllConditions also passes');
  });

  it('Avengers→Avengers team condition passes', () => {
    const gameState = makeTestState({
      inPlay: ['core/cap/shield-bash#0', 'core/iron-man/repulsor#0'],
      cardTraits: {
        'core/cap/shield-bash#0': { heroClass: 'strength', team: 'avengers' },
        'core/iron-man/repulsor#0': { heroClass: 'tech', team: 'avengers' },
      },
    });

    const conditionResult = evaluateCondition(gameState, '0', {
      type: 'requiresTeam',
      value: 'avengers',
    }, 'core/iron-man/repulsor#0' as unknown as import('../state/zones.types.js').CardExtId);

    assert.equal(conditionResult, true, 'Avengers team condition passes when another Avenger is in inPlay');

    const allResult = evaluateAllConditions(gameState, '0', [
      { type: 'requiresTeam', value: 'avengers' },
    ], 'core/iron-man/repulsor#0' as unknown as import('../state/zones.types.js').CardExtId);

    assert.equal(allResult, true, 'evaluateAllConditions also passes for team');
  });
});

// ---------------------------------------------------------------------------
// WP-280 — distinctHeroClassesAtLeast evaluator (self-inclusive)
// ---------------------------------------------------------------------------

describe('evaluateCondition distinctHeroClassesAtLeast (WP-280)', () => {
  it('≥3 classes: self-inclusive boundary (2 other distinct + 3rd via self) returns true', () => {
    const gameState = makeTestState({
      inPlay: ['hero-tech#0', 'hero-covert#0', 'hero-instinct#0'],
      cardTraits: {
        'hero-tech#0': { heroClass: 'tech', team: null },
        'hero-covert#0': { heroClass: 'covert', team: null },
        'hero-instinct#0': { heroClass: 'instinct', team: null },
      },
    });

    const result = evaluateCondition(gameState, '0', {
      type: 'distinctHeroClassesAtLeast',
      value: '3',
    }, 'hero-instinct#0' as unknown as import('../state/zones.types.js').CardExtId);

    assert.equal(result, true, 'should return true when ≥3 distinct hero classes present, self-inclusive');
  });

  it('<3 classes: self-inclusive boundary (2 other distinct + self shares one) returns false', () => {
    const gameState = makeTestState({
      inPlay: ['hero-tech#0', 'hero-covert#0', 'hero-tech-2#0'],
      cardTraits: {
        'hero-tech#0': { heroClass: 'tech', team: null },
        'hero-covert#0': { heroClass: 'covert', team: null },
        'hero-tech-2#0': { heroClass: 'tech', team: null },
      },
    });

    const result = evaluateCondition(gameState, '0', {
      type: 'distinctHeroClassesAtLeast',
      value: '3',
    }, 'hero-tech-2#0' as unknown as import('../state/zones.types.js').CardExtId);

    assert.equal(result, false, 'should return false when only 2 distinct classes (self shares one of them)');
  });

  it('S.H.I.E.L.D./Sidekick (null heroClass) never count', () => {
    const gameState = makeTestState({
      inPlay: ['hero-tech#0', 'hero-covert#0', 'shield-card#0', 'hero-instinct#0'],
      cardTraits: {
        'hero-tech#0': { heroClass: 'tech', team: null },
        'hero-covert#0': { heroClass: 'covert', team: null },
        'shield-card#0': { heroClass: null, team: 'shield' },
        'hero-instinct#0': { heroClass: 'instinct', team: null },
      },
    });

    const result = evaluateCondition(gameState, '0', {
      type: 'distinctHeroClassesAtLeast',
      value: '3',
    }, 'hero-instinct#0' as unknown as import('../state/zones.types.js').CardExtId);

    assert.equal(result, true, 'should count 3 heroes (tech, covert, instinct) and ignore shield card with null heroClass');
  });

  it('NaN threshold safely returns false', () => {
    const gameState = makeTestState({
      inPlay: ['hero-tech#0', 'hero-covert#0', 'hero-instinct#0'],
      cardTraits: {
        'hero-tech#0': { heroClass: 'tech', team: null },
        'hero-covert#0': { heroClass: 'covert', team: null },
        'hero-instinct#0': { heroClass: 'instinct', team: null },
      },
    });

    const result = evaluateCondition(gameState, '0', {
      type: 'distinctHeroClassesAtLeast',
      value: 'not-a-number',
    });

    assert.equal(result, false, 'should return false when threshold is NaN');
  });

  it('no cardTraits returns false', () => {
    const gameState = makeTestState({
      inPlay: ['hero-tech#0', 'hero-covert#0', 'hero-instinct#0'],
    });
    delete gameState.cardTraits;

    const result = evaluateCondition(gameState, '0', {
      type: 'distinctHeroClassesAtLeast',
      value: '3',
    });

    assert.equal(result, false, 'should return false when G.cardTraits is undefined');
  });

  it('empty inPlay returns false', () => {
    const gameState = makeTestState({
      inPlay: [],
      cardTraits: {},
    });

    const result = evaluateCondition(gameState, '0', {
      type: 'distinctHeroClassesAtLeast',
      value: '3',
    });

    assert.equal(result, false, 'should return false when no heroes in inPlay');
  });
});

// ---------------------------------------------------------------------------
// WP-290 / D-24074 — Size-Changing class-grant honored by the two class reads
//
// A card in inPlay counts as each of its EFFECTIVE classes (printed plus granted).
// heroClassMatch (self-exclusive) and distinctHeroClassesAtLeast (self-inclusive) both
// derive class membership from the sizeChanging.logic.ts helper; these tests pin the
// grant behavior at both reads, including a null-printed (granted-only) card, a dual-class
// card (printed ≠ granted), and the preserved self-exclusion / self-inclusion semantics.
// ---------------------------------------------------------------------------

describe('heroClassMatch honors the Size-Changing grant (WP-290 / D-24074)', () => {
  it('a granted-only card (null printed class) satisfies another card\'s match for the granted class', () => {
    // why: yellowjacket-style — null printed class, instinct granted only by Size-Changing.
    const gameState = makeTestState({
      inPlay: ['sc-granter', 'trigger'],
      cardTraits: {
        'sc-granter': { heroClass: null, team: null },
        'trigger': { heroClass: null, team: null },
      },
      cardSizeChangingClasses: {
        'sc-granter': ['instinct'],
      },
    });

    const result = evaluateCondition(
      gameState,
      '0',
      { type: 'heroClassMatch', value: 'instinct' },
      'trigger',
    );

    assert.equal(result, true,
      'a granted-only instinct card should satisfy another card\'s instinct match');
  });

  it('a dual-class card (printed strength + granted tech) satisfies a match for EITHER class', () => {
    const gameState = makeTestState({
      inPlay: ['giant-ego', 'trigger'],
      cardTraits: {
        'giant-ego': { heroClass: 'strength', team: null },
        'trigger': { heroClass: null, team: null },
      },
      cardSizeChangingClasses: {
        'giant-ego': ['tech'],
      },
    });

    const matchesPrinted = evaluateCondition(
      gameState, '0', { type: 'heroClassMatch', value: 'strength' }, 'trigger',
    );
    const matchesGranted = evaluateCondition(
      gameState, '0', { type: 'heroClassMatch', value: 'tech' }, 'trigger',
    );

    assert.equal(matchesPrinted, true, 'dual-class card matches its printed class (strength)');
    assert.equal(matchesGranted, true, 'dual-class card matches its granted class (tech)');
  });

  it('the triggering card\'s own granted class does not satisfy its own match (self-exclusion preserved)', () => {
    const gameState = makeTestState({
      inPlay: ['sc-self'],
      cardTraits: {
        'sc-self': { heroClass: null, team: null },
      },
      cardSizeChangingClasses: {
        'sc-self': ['instinct'],
      },
    });

    const result = evaluateCondition(
      gameState,
      '0',
      { type: 'heroClassMatch', value: 'instinct' },
      'sc-self',
    );

    assert.equal(result, false,
      'the only in-play card is the triggering card — its own granted class is self-excluded');
  });
});

describe('distinctHeroClassesAtLeast honors the Size-Changing grant (WP-290 / D-24074)', () => {
  it('a single dual-class Size-Changing card contributes BOTH printed and granted classes', () => {
    const gameState = makeTestState({
      inPlay: ['giant-ego'],
      cardTraits: {
        'giant-ego': { heroClass: 'strength', team: null },
      },
      cardSizeChangingClasses: {
        'giant-ego': ['tech'],
      },
    });

    const reachesTwo = evaluateCondition(
      gameState, '0', { type: 'distinctHeroClassesAtLeast', value: '2' },
    );
    const reachesThree = evaluateCondition(
      gameState, '0', { type: 'distinctHeroClassesAtLeast', value: '3' },
    );

    assert.equal(reachesTwo, true,
      'one card contributes 2 distinct effective classes (strength + tech), self-inclusive');
    assert.equal(reachesThree, false,
      'one dual-class card cannot reach 3 distinct classes');
  });

  it('a granted-only card (null printed class) still contributes its granted class to the count', () => {
    const gameState = makeTestState({
      inPlay: ['sc-granter', 'plain'],
      cardTraits: {
        'sc-granter': { heroClass: null, team: null },
        'plain': { heroClass: 'covert', team: null },
      },
      cardSizeChangingClasses: {
        'sc-granter': ['instinct'],
      },
    });

    const result = evaluateCondition(
      gameState, '0', { type: 'distinctHeroClassesAtLeast', value: '2' },
    );

    assert.equal(result, true,
      'covert (printed) + instinct (granted-only) = 2 distinct effective classes');
  });
});

// ---------------------------------------------------------------------------
// recruitMadeThisTurnAtLeast (WP-545 / D-24354 — Thor Surge of Power gate)
// ---------------------------------------------------------------------------

describe('evaluateCondition — recruitMadeThisTurnAtLeast', () => {
  it('returns true when gross recruit made this turn meets the threshold', () => {
    const gameState = makeTestState({ turnEconomyRecruit: 8 });

    const result = evaluateCondition(gameState, '0', {
      type: 'recruitMadeThisTurnAtLeast',
      value: '8',
    });

    assert.equal(result, true,
      'recruitMadeThisTurnAtLeast should be true when turnEconomy.recruit >= threshold.');
  });

  it('returns true when gross recruit made this turn exceeds the threshold', () => {
    const gameState = makeTestState({ turnEconomyRecruit: 12 });

    const result = evaluateCondition(gameState, '0', {
      type: 'recruitMadeThisTurnAtLeast',
      value: '8',
    });

    assert.equal(result, true,
      'recruitMadeThisTurnAtLeast should be true when turnEconomy.recruit exceeds threshold.');
  });

  it('returns false when gross recruit made this turn is below the threshold', () => {
    const gameState = makeTestState({ turnEconomyRecruit: 4 });

    const result = evaluateCondition(gameState, '0', {
      type: 'recruitMadeThisTurnAtLeast',
      value: '8',
    });

    assert.equal(result, false,
      'recruitMadeThisTurnAtLeast should be false when turnEconomy.recruit < threshold (the live turn-14 bug: 4 recruit made, no +3 attack).');
  });

  it('compares against gross recruit MADE, not net available (spentRecruit does not lower the gate)', () => {
    // why: turnEconomy.recruit is the gross accumulator; a player who made 8
    // recruit and spent all of it still satisfies the "made 8 or more" gate.
    const gameState = makeTestState({ turnEconomyRecruit: 8 });
    gameState.turnEconomy.spentRecruit = 8;

    const result = evaluateCondition(gameState, '0', {
      type: 'recruitMadeThisTurnAtLeast',
      value: '8',
    });

    assert.equal(result, true,
      'spending recruit must not lower the gate — the condition reads gross recruit made.');
  });

  it('returns false on a non-numeric (NaN) value', () => {
    const gameState = makeTestState({ turnEconomyRecruit: 99 });

    const result = evaluateCondition(gameState, '0', {
      type: 'recruitMadeThisTurnAtLeast',
      value: 'not-a-number',
    });

    assert.equal(result, false,
      'recruitMadeThisTurnAtLeast should safe-skip (false) when the threshold value is NaN.');
  });
});

// ---------------------------------------------------------------------------
// WP-566 / D-24375 — the blocked-ability message names the FAILED condition
// ---------------------------------------------------------------------------

describe('findFailedCondition (WP-566 / D-24375)', () => {
  it('returns undefined when every condition passes', () => {
    const G = makeTestState({
      inPlay: ['other-card'],
      cardTraits: { 'other-card': { heroClass: 'instinct', team: null } },
    });
    const conditions = [{ type: 'heroClassMatch', value: 'instinct' }];
    assert.equal(findFailedCondition(G, '0', conditions, 'self-card'), undefined);
  });

  it('returns undefined for empty / undefined conditions', () => {
    const G = makeTestState();
    assert.equal(findFailedCondition(G, '0', []), undefined);
    assert.equal(findFailedCondition(G, '0', undefined), undefined);
  });

  it('AC-5: names the FIRST failing condition, matching the short-circuit order', () => {
    // why: the reported condition must be the one that actually stopped the
    // ability. Reporting the LAST failure would silently disagree with the order
    // evaluateAllConditions uses everywhere else in the engine.
    const G = makeTestState();
    const conditions = [
      { type: 'recruitMadeThisTurnAtLeast', value: '8' },
      { type: 'heroClassMatch', value: 'instinct' },
    ];
    const failed = findFailedCondition(G, '0', conditions, 'self-card');
    assert.equal(failed?.type, 'recruitMadeThisTurnAtLeast');
  });

  it('agrees with evaluateAllConditions in both directions', () => {
    // why: AC-8 in miniature — the sibling must never disagree with the gate it
    // shadows, or the log would explain a block that did not happen (or stay
    // silent about one that did).
    const passing = makeTestState({
      inPlay: ['other-card'],
      cardTraits: { 'other-card': { heroClass: 'instinct', team: null } },
    });
    const failing = makeTestState();
    const conditions = [{ type: 'heroClassMatch', value: 'instinct' }];

    assert.equal(evaluateAllConditions(passing, '0', conditions, 'self-card'), true);
    assert.equal(findFailedCondition(passing, '0', conditions, 'self-card'), undefined);

    assert.equal(evaluateAllConditions(failing, '0', conditions, 'self-card'), false);
    assert.notEqual(findFailedCondition(failing, '0', conditions, 'self-card'), undefined);
  });
});

describe('describeFailedCondition (WP-566 / D-24375)', () => {
  it('AC-1: a recruit threshold names the requirement AND the actual, with no class/team words', () => {
    // why: THE reported defect. Surge of Power's printed gate is "If you made 8 or
    // more recruit this turn" — no class or team component at all — yet the old
    // single string blamed "Hero class or team synergy" 8 times in one match.
    const G = makeTestState({ turnEconomyRecruit: 5 });
    const text = describeFailedCondition(G, '0', {
      type: 'recruitMadeThisTurnAtLeast',
      value: '8',
    });
    assert.match(text, /8 or more recruit/);
    assert.match(text, /made 5/);
    // why: assert the ABSENCE of the old misattribution — a positive-only check
    // would pass even if the wrong clause were still appended.
    assert.equal(/Hero class/i.test(text), false);
    assert.equal(/team synergy/i.test(text), false);
  });

  it('AC-2: a distinct-class threshold names required and actual', () => {
    const G = makeTestState({
      inPlay: ['a', 'b'],
      cardTraits: {
        a: { heroClass: 'instinct', team: null },
        b: { heroClass: 'strength', team: null },
      },
    });
    const text = describeFailedCondition(G, '0', {
      type: 'distinctHeroClassesAtLeast',
      value: '3',
    });
    assert.match(text, /3 different Hero classes/);
    assert.match(text, /you have 2/);
    assert.equal(/team synergy/i.test(text), false);
  });

  it('AC-3: the two the old message got RIGHT stay right', () => {
    const G = makeTestState();
    const classText = describeFailedCondition(G, '0', { type: 'heroClassMatch', value: 'instinct' });
    assert.match(classText, /another instinct Hero/);

    const teamText = describeFailedCondition(G, '0', { type: 'requiresTeam', value: 'x-men' });
    assert.match(teamText, /another x-men Hero/);
  });

  it('describes the two types handled but never constructed from card data', () => {
    const G = makeTestState({ inPlay: ['a', 'b'] });
    assert.match(
      describeFailedCondition(G, '0', { type: 'playedThisTurn', value: '5' }),
      /5 cards played this turn/,
    );
    assert.match(
      describeFailedCondition(G, '0', { type: 'requiresKeyword', value: 'patrol' }),
      /another patrol card/,
    );
  });

  it('AC-4: an UNRECOGNIZED type reads as un-evaluable and names the type', () => {
    // why: D-24375 section 3 — evaluateCondition's default returns false, so a data
    // or parse defect currently renders identically to a working synergy gate. The
    // loud fallback is also the only guarantee available: HeroCondition.type is a
    // bare string, so this describer cannot be compiler-exhaustive.
    const G = makeTestState();
    const text = describeFailedCondition(G, '0', {
      type: 'someFutureConditionType',
      value: '3',
    });
    assert.match(text, /could not be evaluated/);
    assert.match(text, /someFutureConditionType/);
    assert.equal(/was not met/i.test(text), false);
  });

  it('AC-4: behaviour is UNCHANGED — an unrecognized condition still blocks', () => {
    // why: fail-closed stays. Firing an effect whose gate cannot be evaluated is
    // strictly worse than blocking it; only the LOG distinguishes the two.
    const G = makeTestState();
    const unknown = { type: 'someFutureConditionType', value: '3' };
    assert.equal(evaluateCondition(G, '0', unknown), false);
    assert.equal(evaluateAllConditions(G, '0', [unknown]), false);
  });

  it('every constructed condition type yields a distinct, non-empty clause', () => {
    // why: guards against two types collapsing onto the same sentence, which would
    // re-create the defect in miniature.
    const G = makeTestState({ turnEconomyRecruit: 1, inPlay: ['a'] });
    const clauses = [
      describeFailedCondition(G, '0', { type: 'heroClassMatch', value: 'instinct' }),
      describeFailedCondition(G, '0', { type: 'requiresTeam', value: 'x-men' }),
      describeFailedCondition(G, '0', { type: 'distinctHeroClassesAtLeast', value: '3' }),
      describeFailedCondition(G, '0', { type: 'recruitMadeThisTurnAtLeast', value: '8' }),
    ];
    for (const clause of clauses) {
      assert.equal(clause.length > 0, true);
    }
    assert.equal(new Set(clauses).size, clauses.length);
  });
});
