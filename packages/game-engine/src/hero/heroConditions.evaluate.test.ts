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
  countOtherInPlayMatchingCondition,
  findFailedCondition,
  describeFailedCondition,
  heroConditionHoldsForInPlay,
  SEQUENCE_GATE_CONDITION_TYPES,
} from './heroConditions.evaluate.js';
import type { HeroConditionCardData } from './heroConditions.evaluate.js';
import { WAIT_AND_SEE_CONDITION_TYPES } from './deferredConditionalGrants.js';
import type { LegendaryGameState } from '../types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import { makeGlobalPiles, makeMastermindState, makePlayerZones, makeTurnEconomy } from '../test/fixtureBuilders.js';
import { SHIELD_OFFICER_EXT_ID } from '../setup/pilesInit.js';

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
  hand?: string[];
  discard?: string[];
  victory?: string[];
  heroAbilityHooks?: HeroAbilityHook[];
  cardTraits?: Record<string, { heroClass: string | null; heroClass2?: string | null; team: string | null }>;
  cardStatCosts?: Record<string, number>;
  cardSizeChangingClasses?: Record<string, string[]>;
  cardCopiedTeams?: Record<string, string[]>;
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
        hand: overrides?.hand ?? [],
        discard: overrides?.discard ?? [],
        inPlay: overrides?.inPlay ?? [],
        victory: overrides?.victory ?? [],
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
    cardStats: Object.fromEntries(
      Object.entries(overrides?.cardStatCosts ?? {}).map(([cardId, cost]) => [
        cardId,
        { attack: 0, recruit: 0, cost, fightCost: 0, fightCostMode: 'static' as const, fightCostBase: 0 },
      ]),
    ),
    cardTraits: overrides?.cardTraits ?? {},
    cardSizeChangingClasses: overrides?.cardSizeChangingClasses ?? {},
    cardCopiedTeams: overrides?.cardCopiedTeams ?? {},
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

  // why (Jeff feedback — Legendary Commander): a requiresTeam 'shield' gate must
  // count the teamless basic S.H.I.E.L.D. tokens. The real Officer token carries no
  // cardTraits row, so the old trait-only read failed the gate; it must now pass.
  it('requiresTeam shield is satisfied by a played S.H.I.E.L.D. Officer token (no cardTraits row)', () => {
    const gameState = makeTestState({
      inPlay: [SHIELD_OFFICER_EXT_ID],
      cardTraits: {},
    });

    const result = evaluateCondition(gameState, '0', {
      type: 'requiresTeam',
      value: 'shield',
    });

    assert.equal(result, true,
      'a played S.H.I.E.L.D. Officer counts as a shield Hero for the requiresTeam gate.');
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

  // WP-582 / D-24391 — a Copy Powers card that copied an avengers Hero counts as avengers
  // via the runtime cardCopiedTeams grant, routed through cardHasTeamWhenPlayed.
  it('copy-powers grant: a Copy Powers card with a granted team satisfies requiresTeam', () => {
    const gameState = makeTestState({
      inPlay: ['core/rogue/copy-powers#0', 'trigger-card#0'],
      cardTraits: {
        'core/rogue/copy-powers#0': { heroClass: 'covert', team: null }, // printed teamless
        'trigger-card#0': { heroClass: 'tech', team: 'avengers' },
      },
      cardCopiedTeams: {
        'core/rogue/copy-powers#0': ['avengers'], // copied an avengers Hero
      },
    });

    const result = evaluateCondition(gameState, '0', {
      type: 'requiresTeam',
      value: 'avengers',
    }, 'trigger-card#0' as unknown as import('../state/zones.types.js').CardExtId);

    assert.equal(result, true, 'a Copy Powers card granted the avengers team satisfies the synergy');
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

  it('WP-703: a dual-class card contributes BOTH printed classes to the distinct set', () => {
    // dual (strength+ranged) + covert = 3 distinct classes; without hc2 counting it would be 2.
    const gameState = makeTestState({
      inPlay: ['dual#0', 'hero-covert#0'],
      cardTraits: {
        'dual#0': { heroClass: 'strength', heroClass2: 'ranged', team: 'x-men' },
        'hero-covert#0': { heroClass: 'covert', team: null },
      },
    });

    const result = evaluateCondition(gameState, '0', {
      type: 'distinctHeroClassesAtLeast',
      value: '3',
    }, 'dual#0' as unknown as import('../state/zones.types.js').CardExtId);

    assert.equal(result, true, 'a single dual-class card counts as two distinct classes');
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

  it('WP-729 Part B: heroClassInDiscardPile message is article-aware (an instinct / a strength)', () => {
    const G = makeTestState();
    const instinct = describeFailedCondition(G, '0', { type: 'heroClassInDiscardPile', value: 'instinct' });
    const strength = describeFailedCondition(G, '0', { type: 'heroClassInDiscardPile', value: 'strength' });
    assert.match(instinct, /an instinct card in your discard pile/);
    assert.match(strength, /a strength card in your discard pile/);
    // why: guard against the "a instinct" regression AND a consonant class wrongly flipping to "an".
    assert.equal(/\ba instinct\b/.test(instinct), false, 'vowel class must not read "a instinct"');
    assert.equal(/\ban strength\b/.test(strength), false, 'consonant class must not read "an strength"');
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

// ---------------------------------------------------------------------------
// WP-653 / D-24464 — the four condition-gate keywords
// ---------------------------------------------------------------------------

describe('evaluateCondition distinctHeroCostsAtLeast (Outwit)', () => {
  it('passes when >= 3 distinct costs are in play', () => {
    const G = makeTestState({ inPlay: ['a', 'b', 'c'], cardStatCosts: { a: 2, b: 3, c: 5 } });
    assert.equal(evaluateCondition(G, '0', { type: 'distinctHeroCostsAtLeast', value: '3' }), true);
  });

  it('fails when fewer than 3 DISTINCT costs (duplicates do not count)', () => {
    const G = makeTestState({ inPlay: ['a', 'b', 'c'], cardStatCosts: { a: 2, b: 2, c: 3 } });
    assert.equal(evaluateCondition(G, '0', { type: 'distinctHeroCostsAtLeast', value: '3' }), false);
  });

  it('counts a 0-cost Hero (S.H.I.E.L.D. Agent) as the distinct cost 0 (rules v23 §Outwit)', () => {
    // why: the rulebook's worked example — a 2-cost hand Hero + a 6-cost Outwit
    // card + a 0-cost S.H.I.E.L.D. Agent already played = the 3 different costs.
    const G = makeTestState({
      inPlay: ['outwit-card', 'starting-shield-agent'],
      hand: ['hand-hero'],
      cardStatCosts: { 'outwit-card': 6, 'starting-shield-agent': 0, 'hand-hero': 2 },
    });
    assert.equal(evaluateCondition(G, '0', { type: 'distinctHeroCostsAtLeast', value: '3' }), true);
  });

  it('counts Heroes revealed from HAND, not just cards already in play', () => {
    // why: Outwit is checkable at play-instant because "reveal" spans the hand —
    // the Outwit card can be played first with its cost-mates still unplayed.
    const G = makeTestState({
      inPlay: ['outwit-card'],
      hand: ['hero-b', 'hero-c'],
      cardStatCosts: { 'outwit-card': 4, 'hero-b': 6, 'hero-c': 0 },
    });
    assert.equal(evaluateCondition(G, '0', { type: 'distinctHeroCostsAtLeast', value: '3' }), true);
  });

  it('excludes Wounds (a Wound is not a Hero) even though it reads as cost 0', () => {
    const G = makeTestState({
      inPlay: ['a', 'pile-wound'],
      hand: ['pile-wound'],
      cardStatCosts: { a: 4 },
    });
    // only `a` (cost 4) counts; the Wounds are excluded, so distinct costs = 1.
    assert.equal(evaluateCondition(G, '0', { type: 'distinctHeroCostsAtLeast', value: '2' }), false);
  });

  it('returns false for a malformed value', () => {
    const G = makeTestState({ inPlay: ['a'], cardStatCosts: { a: 3 } });
    assert.equal(evaluateCondition(G, '0', { type: 'distinctHeroCostsAtLeast', value: 'x' }), false);
  });
});

describe('evaluateCondition heroCostAtLeastInHandOrPlay (Worthy)', () => {
  it('passes when a Hero costing >= 5 is in play', () => {
    const G = makeTestState({ inPlay: ['big'], cardStatCosts: { big: 5 } });
    assert.equal(evaluateCondition(G, '0', { type: 'heroCostAtLeastInHandOrPlay', value: '5' }), true);
  });

  it('passes when a Hero costing >= 5 is in HAND (hand-inclusive)', () => {
    const G = makeTestState({ hand: ['big'], cardStatCosts: { big: 6 } });
    assert.equal(evaluateCondition(G, '0', { type: 'heroCostAtLeastInHandOrPlay', value: '5' }), true);
  });

  it('fails when no Hero reaches the cost, in hand or play', () => {
    const G = makeTestState({ inPlay: ['a'], hand: ['b'], cardStatCosts: { a: 3, b: 4 } });
    assert.equal(evaluateCondition(G, '0', { type: 'heroCostAtLeastInHandOrPlay', value: '5' }), false);
  });
});

describe('evaluateCondition bystandersInVictoryAtLeast (Savior)', () => {
  it('passes when >= 3 bystanders (supply + rescued villain-deck) are in the Victory Pile', () => {
    const G = makeTestState({
      victory: ['pile-bystander', 'pile-bystander', 'bystander-villain-deck-0', 'some-villain'],
    });
    // three bystanders (two supply, stored as exact BYSTANDER_EXT_ID repeats, +
    // one villain-deck bystander); the villain is not counted.
    assert.equal(evaluateCondition(G, '0', { type: 'bystandersInVictoryAtLeast', value: '3' }), true);
  });

  it('fails with fewer than 3 bystanders in the Victory Pile', () => {
    const G = makeTestState({ victory: ['pile-bystander', 'some-villain'] });
    assert.equal(evaluateCondition(G, '0', { type: 'bystandersInVictoryAtLeast', value: '3' }), false);
  });
});

describe('evaluateCondition cheapOrSizeChangingAtLeast (Antics)', () => {
  it('passes when >= 3 cards cost 1-2 and/or are Size-Changing (hand + play)', () => {
    const G = makeTestState({
      inPlay: ['cheap1', 'sizer'],
      hand: ['cheap2'],
      cardStatCosts: { cheap1: 1, cheap2: 2, sizer: 6 },
      cardSizeChangingClasses: { sizer: ['tech'] },
    });
    assert.equal(evaluateCondition(G, '0', { type: 'cheapOrSizeChangingAtLeast', value: '3' }), true);
  });

  it('counts a card that is both cheap AND Size-Changing only once', () => {
    const G = makeTestState({
      inPlay: ['both', 'cheap'],
      cardStatCosts: { both: 2, cheap: 1 },
      cardSizeChangingClasses: { both: ['ranged'] },
    });
    // two qualifying cards, not three — `both` is not double-counted.
    assert.equal(evaluateCondition(G, '0', { type: 'cheapOrSizeChangingAtLeast', value: '3' }), false);
  });
});

describe('evaluateCondition firstHeroPlayedThisTurn (WP-681 / D-24498 — Do-Over)', () => {
  it('true when the triggering card is the only card in inPlay (first Hero)', () => {
    const G = makeTestState({ inPlay: ['do-over-card'] });
    assert.equal(
      evaluateCondition(G, '0', { type: 'firstHeroPlayedThisTurn', value: '1' }, 'do-over-card'),
      true,
    );
  });

  it('false when another Hero is already in inPlay (not the first)', () => {
    const G = makeTestState({ inPlay: ['other-hero', 'do-over-card'] });
    assert.equal(
      evaluateCondition(G, '0', { type: 'firstHeroPlayedThisTurn', value: '1' }, 'do-over-card'),
      false,
    );
  });

  it('true when inPlay is empty (defensive — no triggering card yet)', () => {
    const G = makeTestState({ inPlay: [] });
    assert.equal(
      evaluateCondition(G, '0', { type: 'firstHeroPlayedThisTurn', value: '1' }),
      true,
    );
  });

  it('describeFailedCondition names the first-Hero requirement', () => {
    const G = makeTestState({ inPlay: ['other-hero', 'do-over-card'] });
    assert.match(
      describeFailedCondition(G, '0', { type: 'firstHeroPlayedThisTurn', value: '1' }),
      /first Hero you played this turn/,
    );
  });
});

describe('describeFailedCondition (WP-653 conditions quote the actual count)', () => {
  it('quotes distinct-cost, bystander, and cheap counts; Worthy states the requirement', () => {
    const G = makeTestState({
      inPlay: ['a', 'b'],
      hand: ['c'],
      victory: ['pile-bystander'],
      cardStatCosts: { a: 2, b: 2, c: 1 },
    });
    assert.match(
      describeFailedCondition(G, '0', { type: 'distinctHeroCostsAtLeast', value: '3' }),
      /different costs in hand or play.*you have 2/,
    );
    assert.match(
      describeFailedCondition(G, '0', { type: 'heroCostAtLeastInHandOrPlay', value: '5' }),
      /costing 5 or more/,
    );
    assert.match(
      describeFailedCondition(G, '0', { type: 'bystandersInVictoryAtLeast', value: '3' }),
      /Bystanders.*you have 1/,
    );
    assert.match(
      describeFailedCondition(G, '0', { type: 'cheapOrSizeChangingAtLeast', value: '3' }),
      /costing 1-2 or Size-Changing.*you have 3/,
    );
  });
});

// ---------------------------------------------------------------------------
// heroConditionHoldsForInPlay — the WP-710 / D-24533 sequence-teacher predicate
// ---------------------------------------------------------------------------

/**
 * Builds a `HeroConditionCardData` slice from optional per-map overrides for the
 * predicate tests — exactly the four setup-static maps the predicate reads.
 *
 * @param overrides - Partial card-data maps.
 * @returns A `HeroConditionCardData`.
 */
function makeCardData(overrides?: {
  cardTraits?: Record<string, { heroClass: string | null; team: string | null; heroClass2?: string | null }>;
  cardSizeChangingClasses?: Record<string, string[]>;
  cardCopiedTeams?: Record<string, string[]>;
  heroAbilityHooks?: HeroAbilityHook[];
}): HeroConditionCardData {
  return {
    cardTraits: (overrides?.cardTraits ?? {}) as HeroConditionCardData['cardTraits'],
    cardSizeChangingClasses: overrides?.cardSizeChangingClasses ?? {},
    cardCopiedTeams: overrides?.cardCopiedTeams ?? {},
    heroAbilityHooks: overrides?.heroAbilityHooks ?? [],
  };
}

describe('heroConditionHoldsForInPlay (WP-710 / D-24533)', () => {
  it('returns holds when a same-class enabler is in the candidate inPlay', () => {
    const cardData = makeCardData({
      cardTraits: {
        'gated-card': { heroClass: 'covert', team: null },
        'tech-enabler': { heroClass: 'tech', team: null },
      },
    });

    const result = heroConditionHoldsForInPlay(
      { type: 'heroClassMatch', value: 'tech' },
      'gated-card',
      ['gated-card', 'tech-enabler'],
      cardData,
    );

    assert.equal(result, 'holds', 'A same-class enabler in inPlay must make the gate hold.');
  });

  it('returns fails when no candidate satisfies the class gate', () => {
    const cardData = makeCardData({
      cardTraits: {
        'gated-card': { heroClass: 'covert', team: null },
        'ranged-card': { heroClass: 'ranged', team: null },
      },
    });

    const result = heroConditionHoldsForInPlay(
      { type: 'heroClassMatch', value: 'tech' },
      'gated-card',
      ['gated-card', 'ranged-card'],
      cardData,
    );

    assert.equal(result, 'fails', 'No matching class in inPlay must make the gate fail.');
  });

  it('self-excludes the played card (its own class never satisfies its gate)', () => {
    const cardData = makeCardData({
      cardTraits: {
        // why: the played card is itself tech; the gate must still fail when it is the
        // only tech card in play (evaluateCondition self-excludes the trigger).
        'gated-card': { heroClass: 'tech', team: null },
      },
    });

    const result = heroConditionHoldsForInPlay(
      { type: 'heroClassMatch', value: 'tech' },
      'gated-card',
      ['gated-card'],
      cardData,
    );

    assert.equal(result, 'fails', 'The played card must not satisfy its own class gate.');
  });

  it('returns holds for a requiresTeam gate with a same-team enabler', () => {
    const cardData = makeCardData({
      cardTraits: {
        'gated-card': { heroClass: 'covert', team: 'x-men' },
        'avenger-enabler': { heroClass: 'tech', team: 'avengers' },
      },
    });

    const result = heroConditionHoldsForInPlay(
      { type: 'requiresTeam', value: 'avengers' },
      'gated-card',
      ['gated-card', 'avenger-enabler'],
      cardData,
    );

    assert.equal(result, 'holds', 'A same-team enabler in inPlay must make the team gate hold.');
  });

  it('returns holds for a requiresKeyword gate satisfied by an in-play hook keyword', () => {
    const cardData = makeCardData({
      cardTraits: {
        'gated-card': { heroClass: 'covert', team: null },
        'keyword-enabler': { heroClass: 'tech', team: null },
      },
      heroAbilityHooks: [
        { cardId: 'keyword-enabler', timing: 'onPlay', keywords: ['covert'] },
      ] as unknown as HeroAbilityHook[],
    });

    const result = heroConditionHoldsForInPlay(
      { type: 'requiresKeyword', value: 'covert' },
      'gated-card',
      ['gated-card', 'keyword-enabler'],
      cardData,
    );

    assert.equal(result, 'holds', 'An in-play card with the target keyword must make the keyword gate hold.');
  });

  it('returns unsupported when the played card is size-changing', () => {
    const cardData = makeCardData({
      cardTraits: {
        'gated-card': { heroClass: 'covert', team: null },
        'tech-enabler': { heroClass: 'tech', team: null },
      },
      heroAbilityHooks: [
        // why: a size-changing hook on the played card — its class could depend on an
        // uncaptured grant, so the predicate must scope it out (unsupported), not guess.
        { cardId: 'gated-card', timing: 'onPlay', keywords: [], sizeChangingClasses: ['tech'] },
      ] as unknown as HeroAbilityHook[],
    });

    const result = heroConditionHoldsForInPlay(
      { type: 'heroClassMatch', value: 'tech' },
      'gated-card',
      ['gated-card', 'tech-enabler'],
      cardData,
    );

    assert.equal(result, 'unsupported', 'A size-changing played card must return unsupported.');
  });

  it('returns unsupported when a candidate is copy-powers', () => {
    const cardData = makeCardData({
      cardTraits: {
        'gated-card': { heroClass: 'covert', team: null },
        'rogue-copy': { heroClass: 'covert', team: null },
      },
      heroAbilityHooks: [
        // why: a copy-powers candidate could count as the gated class via an uncaptured
        // copied-team/class grant, so the whole in-play set is scoped out (unsupported).
        { cardId: 'rogue-copy', timing: 'onPlay', keywords: ['copy-powers'] },
      ] as unknown as HeroAbilityHook[],
    });

    const result = heroConditionHoldsForInPlay(
      { type: 'heroClassMatch', value: 'tech' },
      'gated-card',
      ['gated-card', 'rogue-copy'],
      cardData,
    );

    assert.equal(result, 'unsupported', 'A copy-powers card anywhere in inPlay must return unsupported.');
  });
});

// ---------------------------------------------------------------------------
// SEQUENCE_GATE_CONDITION_TYPES — drift-parity assertions (WP-710 RS-1)
// ---------------------------------------------------------------------------

describe('evaluateCondition heroClassInDiscardPile (WP-723 / D-24544 — X-Gene)', () => {
  // -------------------------------------------------------------------------
  // true: a matching-class card in the discard pile satisfies the gate
  // -------------------------------------------------------------------------
  it('returns true when a card of the given printed class is in the discard pile', () => {
    const gameState = makeTestState({
      discard: ['instinct-card'],
      cardTraits: {
        'instinct-card': { heroClass: 'instinct', team: null },
      },
    });

    const result = evaluateCondition(gameState, '0', {
      type: 'heroClassInDiscardPile',
      value: 'instinct',
    });

    assert.equal(result, true,
      'heroClassInDiscardPile is met when a card of that class sits in the discard pile.');
  });

  // -------------------------------------------------------------------------
  // false: no matching-class card in the discard pile
  // -------------------------------------------------------------------------
  it('returns false when no card of the given class is in the discard pile', () => {
    const gameState = makeTestState({
      discard: ['tech-card'],
      cardTraits: {
        'tech-card': { heroClass: 'tech', team: null },
      },
    });

    const result = evaluateCondition(gameState, '0', {
      type: 'heroClassInDiscardPile',
      value: 'instinct',
    });

    assert.equal(result, false,
      'heroClassInDiscardPile fails when no discard-pile card has that class.');
  });

  // -------------------------------------------------------------------------
  // discard-scope: a same-class card in PLAY (not discard) does NOT satisfy it
  // (this is the "another Instinct Hero played this turn" trap the gate avoids)
  // -------------------------------------------------------------------------
  it('is NOT satisfied by a same-class card in play — the gate is discard-pile presence', () => {
    const gameState = makeTestState({
      inPlay: ['instinct-in-play'],
      discard: [],
      cardTraits: {
        'instinct-in-play': { heroClass: 'instinct', team: null },
      },
    });

    const result = evaluateCondition(gameState, '0', {
      type: 'heroClassInDiscardPile',
      value: 'instinct',
    });

    assert.equal(result, false,
      'a played Instinct card does not satisfy the discard-pile condition (not a play-this-turn gate).');
  });

  // -------------------------------------------------------------------------
  // reads heroClass2: a dual-class card counts on its SECOND printed class
  // -------------------------------------------------------------------------
  it('reads heroClass2 — a dual-class discard card satisfies the gate on its second class', () => {
    const gameState = makeTestState({
      discard: ['dual-card'],
      cardTraits: {
        'dual-card': { heroClass: 'tech', heroClass2: 'instinct', team: null },
      },
    });

    const result = evaluateCondition(gameState, '0', {
      type: 'heroClassInDiscardPile',
      value: 'instinct',
    });

    assert.equal(result, true,
      'a dual-class card in discard counts on either printed class.');
  });

  // -------------------------------------------------------------------------
  // describeFailedCondition wording
  // -------------------------------------------------------------------------
  it('describeFailedCondition names the required class in the discard pile', () => {
    const gameState = makeTestState({ discard: [] });

    const message = describeFailedCondition(gameState, '0', {
      type: 'heroClassInDiscardPile',
      value: 'instinct',
    });

    // why: WP-729 Part B — the X-Gene failed-condition line is now article-aware; a
    // vowel-initial class ("instinct") reads "an instinct", correcting the WP-723 "a instinct".
    assert.equal(message, 'it needs an instinct card in your discard pile',
      'the failure line names the class the discard pile must hold, article-correct.');
  });
});

describe('SEQUENCE_GATE_CONDITION_TYPES drift parity (WP-710 / D-24533)', () => {
  it('is disjoint from WAIT_AND_SEE_CONDITION_TYPES', () => {
    // why (RS-1a): a snapshot gate the teacher teaches must NOT also be a numeric
    // wait-and-see gate the engine already retro-fires — the two sets are mutually
    // exclusive by construction, and this pin catches any future overlap. Imports the
    // canonical WAIT_AND_SEE array (never a local re-declaration) so the cross-file
    // drift the pin exists to prevent cannot slip back in.
    for (const gateType of SEQUENCE_GATE_CONDITION_TYPES) {
      assert.equal(
        WAIT_AND_SEE_CONDITION_TYPES.includes(gateType),
        false,
        `Sequence-gate type "${gateType}" must not also be a wait-and-see condition type.`,
      );
    }
  });

  it('every member has a real evaluateCondition case (never the default false)', () => {
    // why (RS-1b): a member added to the gate set without a matching evaluateCondition
    // case would silently read as the default `false` — a whiff that can never be taught
    // or would misfire. Each member is exercised with a state that SATISFIES it; the
    // default branch can only return false, so a `true` here proves the case exists.
    for (const gateType of SEQUENCE_GATE_CONDITION_TYPES) {
      const satisfyingState = makeTestState({
        inPlay: ['enabler'],
        cardTraits: { enabler: { heroClass: 'tech', team: 'avengers' } },
        heroAbilityHooks: [
          { cardId: 'enabler', timing: 'onPlay', keywords: ['covert'] },
        ] as unknown as HeroAbilityHook[],
      });
      const gateValue =
        gateType === 'heroClassMatch' ? 'tech' : gateType === 'requiresTeam' ? 'avengers' : 'covert';
      assert.equal(
        evaluateCondition(satisfyingState, '0', { type: gateType, value: gateValue }),
        true,
        `Sequence-gate type "${gateType}" must have a real evaluateCondition case.`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// countOtherInPlayMatchingCondition (WP-740 / D-24562)
// ---------------------------------------------------------------------------

describe('countOtherInPlayMatchingCondition (WP-740 / D-24562)', () => {
  type CardExtId = import('../state/zones.types.js').CardExtId;
  const self = 'crowd#0' as unknown as CardExtId;
  const traits = {
    'crowd#0': { heroClass: 'strength', team: 'venomverse' },
    'venom-a#0': { heroClass: 'instinct', team: 'venomverse' },
    'venom-b#0': { heroClass: 'strength', team: 'venomverse' },
    'x-ally#0': { heroClass: 'strength', team: 'x-men' },
  };

  it('counts OTHER in-play team members, skipping the triggering card', () => {
    const gameState = makeTestState({ inPlay: ['venom-a#0', 'x-ally#0', 'venom-b#0', 'crowd#0'], cardTraits: traits });
    assert.equal(countOtherInPlayMatchingCondition(gameState, '0', { type: 'requiresTeam', value: 'venomverse' }, self), 2);
  });

  it('counts OTHER in-play hero-class members', () => {
    const gameState = makeTestState({ inPlay: ['venom-a#0', 'x-ally#0', 'venom-b#0', 'crowd#0'], cardTraits: traits });
    assert.equal(countOtherInPlayMatchingCondition(gameState, '0', { type: 'heroClassMatch', value: 'strength' }, self), 2);
  });

  it('never counts the triggering card itself, but does count a second copy (different #N)', () => {
    const alone = makeTestState({ inPlay: ['crowd#0'], cardTraits: traits });
    assert.equal(countOtherInPlayMatchingCondition(alone, '0', { type: 'requiresTeam', value: 'venomverse' }, self), 0);
    const withCopy = makeTestState({
      inPlay: ['crowd#1', 'crowd#0'],
      cardTraits: { ...traits, 'crowd#1': { heroClass: 'strength', team: 'venomverse' } },
    });
    assert.equal(countOtherInPlayMatchingCondition(withCopy, '0', { type: 'requiresTeam', value: 'venomverse' }, self), 1);
  });

  it('returns 0 for an unsupported condition type', () => {
    const gameState = makeTestState({ inPlay: ['venom-a#0', 'crowd#0'], cardTraits: traits });
    assert.equal(countOtherInPlayMatchingCondition(gameState, '0', { type: 'requiresKeyword', value: 'attack' }, self), 0);
  });

  it('returns 0 for a missing player zone or missing cardTraits, without throwing', () => {
    const gameState = makeTestState({ inPlay: ['venom-a#0', 'crowd#0'], cardTraits: traits });
    assert.equal(countOtherInPlayMatchingCondition(gameState, '9', { type: 'requiresTeam', value: 'venomverse' }, self), 0);
    const noTraits = makeTestState({ inPlay: ['venom-a#0', 'crowd#0'], cardTraits: traits });
    (noTraits as { cardTraits?: unknown }).cardTraits = undefined;
    assert.doesNotThrow(() => countOtherInPlayMatchingCondition(noTraits, '0', { type: 'heroClassMatch', value: 'strength' }, self));
    assert.equal(countOtherInPlayMatchingCondition(noTraits, '0', { type: 'heroClassMatch', value: 'strength' }, self), 0);
  });
});

// ---------------------------------------------------------------------------
// sunlightInEffect / moonlightInEffect (WP-765 / D-24598)
// ---------------------------------------------------------------------------

describe('sunlightInEffect / moonlightInEffect (WP-765 / D-24598)', () => {
  // why: the two day/night condition types, kept here as the runtime drift pin —
  // HeroCondition.type is a bare string, so no compile-time union can catch a missing case.
  const DAY_NIGHT_CONDITION_TYPES = ['sunlightInEffect', 'moonlightInEffect'];

  /** A state whose HQ holds the given [cardId, printed cost] pairs (null = empty slot). */
  function makeDayNightTestState(slots: ([string, number] | null)[]): LegendaryGameState {
    const costs: Record<string, number> = {};
    const hq: (string | null)[] = [];
    for (const slot of slots) {
      if (slot === null) {
        hq.push(null);
      } else {
        hq.push(slot[0]);
        costs[slot[0]] = slot[1];
      }
    }
    const gameState = makeTestState({ inPlay: ['day-night-card'], cardStatCosts: costs });
    (gameState as unknown as { hq: (string | null)[] }).hq = hq;
    return gameState;
  }

  const SUNLIGHT_HQ: ([string, number] | null)[] = [['h2', 2], ['h4', 4], ['h3', 3], null, null];
  const MOONLIGHT_HQ: ([string, number] | null)[] = [['h3', 3], ['h5', 5], ['h4', 4], null, null];
  const TIE_HQ: ([string, number] | null)[] = [['h2', 2], ['h3', 3], null, null, null];

  it('sunlightInEffect holds only when most HQ Heroes have even printed costs', () => {
    const condition = { type: 'sunlightInEffect', value: '' };
    assert.equal(evaluateCondition(makeDayNightTestState(SUNLIGHT_HQ), '0', condition), true);
    assert.equal(evaluateCondition(makeDayNightTestState(MOONLIGHT_HQ), '0', condition), false);
    assert.equal(evaluateCondition(makeDayNightTestState(TIE_HQ), '0', condition), false, 'a tie is neither');
  });

  it('moonlightInEffect holds only when most HQ Heroes have odd printed costs', () => {
    const condition = { type: 'moonlightInEffect', value: '' };
    assert.equal(evaluateCondition(makeDayNightTestState(MOONLIGHT_HQ), '0', condition), true);
    assert.equal(evaluateCondition(makeDayNightTestState(SUNLIGHT_HQ), '0', condition), false);
    assert.equal(evaluateCondition(makeDayNightTestState(TIE_HQ), '0', condition), false, 'a tie is neither');
  });

  it('re-reads the HQ on every evaluation (never cached per card)', () => {
    const gameState = makeDayNightTestState(SUNLIGHT_HQ);
    const condition = { type: 'sunlightInEffect', value: '' };
    assert.equal(evaluateCondition(gameState, '0', condition, 'day-night-card'), true);
    // why: the HQ changes between two resolutions of the same card's line.
    (gameState as unknown as { hq: (string | null)[] }).hq = ['h3', 'h5', 'h4', null, null];
    assert.equal(evaluateCondition(gameState, '0', condition, 'day-night-card'), false);
  });

  it('describes a failed day/night gate in player-facing English', () => {
    const gameState = makeDayNightTestState(TIE_HQ);
    assert.equal(describeFailedCondition(gameState, '0', { type: 'sunlightInEffect', value: '' }), "it isn't Sunlight");
    assert.equal(describeFailedCondition(gameState, '0', { type: 'moonlightInEffect', value: '' }), "it isn't Moonlight");
  });

  it('runtime pin: both types have a real evaluate case and a real describe case, and are neither wait-and-see nor sequence gates', () => {
    for (const conditionType of DAY_NIGHT_CONDITION_TYPES) {
      // why: the default evaluate branch only returns false, so a `true` on a satisfying
      // HQ proves the case exists.
      const satisfyingHq = conditionType === 'sunlightInEffect' ? SUNLIGHT_HQ : MOONLIGHT_HQ;
      assert.equal(
        evaluateCondition(makeDayNightTestState(satisfyingHq), '0', { type: conditionType, value: '' }),
        true,
        `"${conditionType}" must have a real evaluateCondition case.`,
      );
      // why: the default describe branch names the type as unrecognized.
      const description = describeFailedCondition(makeDayNightTestState(TIE_HQ), '0', { type: conditionType, value: '' });
      assert.ok(
        !description.includes('could not be evaluated'),
        `"${conditionType}" must have a real describeFailedCondition case.`,
      );
      assert.equal(WAIT_AND_SEE_CONDITION_TYPES.includes(conditionType), false,
        `"${conditionType}" is resolved per line, never a wait-and-see gate.`);
      assert.equal(SEQUENCE_GATE_CONDITION_TYPES.includes(conditionType), false,
        `"${conditionType}" is board state, never a play-order sequence gate.`);
    }
  });

  it('returns false (never throws) on a minimal G with no HQ (heroConditionHoldsForInPlay slice)', () => {
    const minimal = { playerZones: { '0': { inPlay: [] } } } as unknown as LegendaryGameState;
    assert.doesNotThrow(() => evaluateCondition(minimal, '0', { type: 'sunlightInEffect', value: '' }));
    assert.equal(evaluateCondition(minimal, '0', { type: 'sunlightInEffect', value: '' }), false);
    assert.equal(evaluateCondition(minimal, '0', { type: 'moonlightInEffect', value: '' }), false);
  });
});
