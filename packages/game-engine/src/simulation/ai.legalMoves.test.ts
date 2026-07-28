/**
 * Tests for the pending-KO short-circuit in getLegalMoves (WP-242 / D-24009).
 *
 * When a KO-a-Hero choice is pending, getLegalMoves MUST return a list of
 * length EXACTLY 1 whose single entry is resolveKoHeroChoice with the legacy
 * auto-resolution target (selectKoHeroTarget priority — captured here via
 * selectDefaultKoTarget). When no choice is pending, enumeration is unchanged.
 *
 * Uses node:test + node:assert only. No boardgame.io imports.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { getLegalMoves } from './ai.legalMoves.js';
import { selectDefaultKoTarget } from '../villain/villainEffects.execute.js';
import { selectDefaultOptionalKoTarget } from '../hero/heroEffects.execute.js';
import type { LegendaryGameState, PendingKoHeroChoice, PendingOptionalKoReward } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';

const CONTEXT = { phase: 'play', turn: 1, currentPlayer: '0', numPlayers: 1 };

/**
 * Builds a minimal LegendaryGameState exercising only what getLegalMoves reads.
 */
function makeG(overrides: {
  hand?: CardExtId[];
  discard?: CardExtId[];
  inPlay?: CardExtId[];
  currentStage?: LegendaryGameState['currentStage'];
  pendingKoHeroChoices?: PendingKoHeroChoice[];
  villainRevealedThisTurn?: boolean;
}): LegendaryGameState {
  return {
    currentStage: overrides.currentStage ?? 'main',
    villainRevealedThisTurn: overrides.villainRevealedThisTurn ?? false,
    playerZones: {
      '0': {
        deck: [],
        hand: overrides.hand ?? [],
        discard: overrides.discard ?? [],
        inPlay: overrides.inPlay ?? [],
        victory: [],
      },
    },
    turnEconomy: { attack: 0, recruit: 0, spentAttack: 0, spentRecruit: 0, piercing: 0, woundsDrawn: 0 },
    cardStats: {},
    cardKeywords: {},
    hq: [null, null, null, null, null],
    city: [null, null, null, null, null],
    mastermind: { baseCardId: 'm-base', tacticsDeck: [] },
    pendingKoHeroChoices: overrides.pendingKoHeroChoices,
  } as unknown as LegendaryGameState;
}

describe('getLegalMoves — pending-KO short-circuit (WP-242 / D-24009)', () => {
  test('returns EXACTLY one resolveKoHeroChoice whose target = selectDefaultKoTarget when a KO choice is pending', () => {
    const gameState = makeG({
      discard: ['core/spider-man/strike' as CardExtId, 'starting-shield-agent' as CardExtId],
      hand: ['hero-h' as CardExtId],
      inPlay: ['hero-p' as CardExtId],
      currentStage: 'main',
      pendingKoHeroChoices: [{ choiceType: 'ko-hero', playerID: '0' }],
    });

    const legalMoves = getLegalMoves(gameState, CONTEXT);

    assert.equal(legalMoves.length, 1, 'exactly one legal move while pending');
    const only = legalMoves[0]!;
    assert.equal(only.name, 'resolveKoHeroChoice', 'the single move is resolveKoHeroChoice');
    const expectedTarget = selectDefaultKoTarget(gameState.playerZones['0']!);
    assert.deepStrictEqual(
      only.args,
      expectedTarget,
      'target equals the legacy auto-resolution pick (selectKoHeroTarget priority)',
    );
    // The default target is the starter SHIELD card in discard (D-20602).
    assert.deepStrictEqual(only.args, { zone: 'discard', cardId: 'starting-shield-agent' });
  });

  test('short-circuit fires regardless of stage (board frozen)', () => {
    const gameState = makeG({
      hand: ['hero-a' as CardExtId, 'hero-b' as CardExtId],
      currentStage: 'start',
      pendingKoHeroChoices: [{ choiceType: 'ko-hero', playerID: '0' }],
    });
    const legalMoves = getLegalMoves(gameState, CONTEXT);
    assert.equal(legalMoves.length, 1);
    assert.equal(legalMoves[0]!.name, 'resolveKoHeroChoice');
  });

  test('no resolveKoHeroChoice and normal enumeration when no KO choice is pending', () => {
    const gameState = makeG({
      hand: ['hero-a' as CardExtId],
      currentStage: 'main',
    });
    const legalMoves = getLegalMoves(gameState, CONTEXT);
    const names = legalMoves.map((m) => m.name);
    assert.equal(
      names.includes('resolveKoHeroChoice'),
      false,
      'resolveKoHeroChoice absent when no KO choice pending',
    );
    assert.equal(names.includes('playCard'), true, 'normal main-stage moves enumerated');
  });

  test('an empty pending queue does not short-circuit', () => {
    const gameState = makeG({
      hand: ['hero-a' as CardExtId],
      currentStage: 'main',
      pendingKoHeroChoices: [],
    });
    const legalMoves = getLegalMoves(gameState, CONTEXT);
    assert.equal(
      legalMoves.some((m) => m.name === 'resolveKoHeroChoice'),
      false,
      'empty queue is not pending',
    );
  });
});

describe('getLegalMoves — pending optional-KO-reward short-circuit (WP-248 / D-24019)', () => {
  const optionalPending: PendingOptionalKoReward[] = [
    { playerID: '0', rewardType: 'rescue', rewardMagnitude: 1, sourceCardId: 'hero-x' as CardExtId },
  ];

  test('returns EXACTLY one resolveOptionalKoReward whose target = selectDefaultOptionalKoTarget; never declines', () => {
    const gameState = makeG({
      discard: ['pricey-discard' as CardExtId],
      hand: ['cheap-hand' as CardExtId],
      currentStage: 'main',
    });
    gameState.pendingOptionalKoRewards = optionalPending;
    gameState.cardStats = {
      'pricey-discard': { attack: 0, recruit: 0, cost: 3, fightCost: 0 },
      'cheap-hand': { attack: 0, recruit: 0, cost: 1, fightCost: 0 },
    } as unknown as LegendaryGameState['cardStats'];

    const legalMoves = getLegalMoves(gameState, CONTEXT);

    assert.equal(legalMoves.length, 1, 'exactly one legal move while pending');
    const only = legalMoves[0]!;
    assert.equal(only.name, 'resolveOptionalKoReward', 'the single move is resolveOptionalKoReward');
    const expectedTarget = selectDefaultOptionalKoTarget(gameState.playerZones['0']!, gameState.cardStats);
    assert.deepStrictEqual(only.args, expectedTarget, 'target equals the deterministic default pick');
    // The default target is the lowest-cost card (hand cost 1 beats discard cost 3).
    assert.deepStrictEqual(only.args, { zone: 'hand', cardId: 'cheap-hand' });
    // The bot never declines.
    assert.notDeepStrictEqual(only.args, { decline: true }, 'the bot never emits decline');
  });

  test('optional-KO-reward short-circuit fires BEFORE the KO-hero one (precedence lock)', () => {
    const gameState = makeG({
      discard: ['only-card' as CardExtId],
      currentStage: 'main',
      pendingKoHeroChoices: [{ choiceType: 'ko-hero', playerID: '0' }],
    });
    gameState.pendingOptionalKoRewards = optionalPending;
    gameState.cardStats = {
      'only-card': { attack: 0, recruit: 0, cost: 0, fightCost: 0 },
    } as unknown as LegendaryGameState['cardStats'];

    const legalMoves = getLegalMoves(gameState, CONTEXT);

    assert.equal(legalMoves.length, 1, 'still exactly one move when both queues are non-empty');
    assert.equal(
      legalMoves[0]!.name,
      'resolveOptionalKoReward',
      'optional-KO-reward takes precedence over resolveKoHeroChoice',
    );
  });

  test('no resolveOptionalKoReward and normal enumeration when no optional-KO-reward is pending', () => {
    const gameState = makeG({ hand: ['hero-a' as CardExtId], currentStage: 'main' });
    const legalMoves = getLegalMoves(gameState, CONTEXT);
    const names = legalMoves.map((m) => m.name);
    assert.equal(names.includes('resolveOptionalKoReward'), false, 'absent when not pending');
    assert.equal(names.includes('playCard'), true, 'normal main-stage moves enumerated');
  });
});

describe('getLegalMoves — pending victory-pile villain-pick short-circuit (WP-285 / D-24067)', () => {
  /**
   * Sets up a pending victory-pile pick with the given victory pile, type map,
   * and card stats. Mutates state directly because makeG hardcodes victory: [].
   */
  function makeVictoryPickG(
    victory: CardExtId[],
    villainDeckCardTypes: Record<string, string>,
    cardStats: Record<string, { attack: number; recruit: number; cost: number; fightCost: number }>,
  ): LegendaryGameState {
    const gameState = makeG({ hand: ['hero-a' as CardExtId], currentStage: 'main' });
    gameState.playerZones['0']!.victory = victory;
    gameState.villainDeckCardTypes = villainDeckCardTypes as unknown as LegendaryGameState['villainDeckCardTypes'];
    gameState.cardStats = cardStats as unknown as LegendaryGameState['cardStats'];
    gameState.pendingVictoryPileCardPick = [{ rewardType: 'attack', playerID: '0' }];
    return gameState;
  }

  test('returns EXACTLY one resolveVictoryPileCardPick with the highest-fightCost villain (AC-12)', () => {
    const gameState = makeVictoryPickG(
      ['villain-low' as CardExtId, 'villain-high' as CardExtId, 'henchman-x' as CardExtId],
      { 'villain-low': 'villain', 'villain-high': 'villain', 'henchman-x': 'henchman' },
      {
        'villain-low': { attack: 0, recruit: 0, cost: 0, fightCost: 3 },
        'villain-high': { attack: 0, recruit: 0, cost: 0, fightCost: 8 },
        'henchman-x': { attack: 0, recruit: 0, cost: 0, fightCost: 99 },
      },
    );

    const legalMoves = getLegalMoves(gameState, CONTEXT);

    assert.equal(legalMoves.length, 1, 'exactly one legal move while a pick is pending');
    const only = legalMoves[0]!;
    assert.equal(only.name, 'resolveVictoryPileCardPick', 'the single move is resolveVictoryPileCardPick');
    // villain-high (fightCost 8) beats villain-low (3); the henchman (99) is filtered out (not a villain).
    assert.deepStrictEqual(only.args, { cardId: 'villain-high' }, 'bot picks highest-fightCost eligible villain');
  });

  test('tie on fightCost is broken by lowest victory-pile index (AC-12)', () => {
    const gameState = makeVictoryPickG(
      ['villain-first' as CardExtId, 'villain-second' as CardExtId],
      { 'villain-first': 'villain', 'villain-second': 'villain' },
      {
        'villain-first': { attack: 0, recruit: 0, cost: 0, fightCost: 5 },
        'villain-second': { attack: 0, recruit: 0, cost: 0, fightCost: 5 },
      },
    );

    const legalMoves = getLegalMoves(gameState, CONTEXT);

    assert.equal(legalMoves.length, 1);
    assert.deepStrictEqual(
      legalMoves[0]!.args,
      { cardId: 'villain-first' },
      'tie resolved by lowest victory-pile index (first occurrence)',
    );
  });

  test('victory-pile pick short-circuit fires BEFORE the optional-KO-reward one (precedence lock)', () => {
    const gameState = makeVictoryPickG(
      ['villain-v' as CardExtId],
      { 'villain-v': 'villain' },
      { 'villain-v': { attack: 0, recruit: 0, cost: 0, fightCost: 4 } },
    );
    gameState.pendingOptionalKoRewards = [
      { playerID: '0', rewardType: 'rescue', rewardMagnitude: 1, sourceCardId: 'hero-x' as CardExtId },
    ];

    const legalMoves = getLegalMoves(gameState, CONTEXT);

    assert.equal(legalMoves.length, 1, 'still exactly one move when both queues are non-empty');
    assert.equal(
      legalMoves[0]!.name,
      'resolveVictoryPileCardPick',
      'victory-pile pick takes precedence over resolveOptionalKoReward',
    );
  });

  test('bot never emits resolveVictoryPileCardPick when no eligible villain exists (AC-16)', () => {
    const gameState = makeVictoryPickG(
      ['henchman-only' as CardExtId],
      { 'henchman-only': 'henchman' },
      { 'henchman-only': { attack: 0, recruit: 0, cost: 0, fightCost: 6 } },
    );

    const legalMoves = getLegalMoves(gameState, CONTEXT);

    assert.equal(
      legalMoves.some((m) => m.name === 'resolveVictoryPileCardPick'),
      false,
      'no resolveVictoryPileCardPick when getEligibleVictoryVillains is empty',
    );
  });

  test('no resolveVictoryPileCardPick and normal enumeration when no pick is pending', () => {
    const gameState = makeG({ hand: ['hero-a' as CardExtId], currentStage: 'main' });
    const legalMoves = getLegalMoves(gameState, CONTEXT);
    const names = legalMoves.map((m) => m.name);
    assert.equal(names.includes('resolveVictoryPileCardPick'), false, 'absent when not pending');
    assert.equal(names.includes('playCard'), true, 'normal main-stage moves enumerated');
  });
});

describe('getLegalMoves — once-per-turn reveal gate (WP-266)', () => {
  test('offers revealVillainCard at the start stage when the reveal allowance is unspent', () => {
    const gameState = makeG({ currentStage: 'start', villainRevealedThisTurn: false });
    const names = getLegalMoves(gameState, CONTEXT).map((m) => m.name);
    assert.equal(
      names.includes('revealVillainCard'),
      true,
      'reveal is offered while villainRevealedThisTurn is false',
    );
  });

  test('suppresses revealVillainCard at the start stage once the reveal allowance is spent', () => {
    const gameState = makeG({ currentStage: 'start', villainRevealedThisTurn: true });
    const names = getLegalMoves(gameState, CONTEXT).map((m) => m.name);
    assert.equal(
      names.includes('revealVillainCard'),
      false,
      'reveal is gated out once villainRevealedThisTurn is true (mirrors the move-level guard)',
    );
    // why: the gate must not strand the turn — advanceStage stays available so
    // the bot can progress to main after its single start-stage reveal.
    assert.equal(names.includes('advanceStage'), true, 'advanceStage remains available');
  });
});

describe('getLegalMoves — pending put-bottom-HQ short-circuits (WP-427 / D-24248)', () => {
  test('mandatory optional-put-bottom returns EXACTLY one resolveOptionalPutBottomHQ moving the first HQ card', () => {
    const gameState = makeG({ hand: ['h' as CardExtId], currentStage: 'main' });
    // why: mandatory form (Absorb Ambient Power) cannot decline — the bot must move a
    // card, so getLegalMoves picks the first present HQ card (lowest slot index).
    gameState.hq = [null, 'hq-card-1' as CardExtId, 'hq-card-2' as CardExtId, null, null];
    gameState.pendingOptionalPutBottomHQ = [
      { playerID: '0', sourceCardId: 'src' as CardExtId, mandatory: true },
    ];

    const legalMoves = getLegalMoves(gameState, CONTEXT);

    assert.equal(legalMoves.length, 1, 'exactly one move while a mandatory put-bottom is pending');
    assert.equal(legalMoves[0]!.name, 'resolveOptionalPutBottomHQ');
    assert.deepEqual(
      legalMoves[0]!.args,
      { cardId: 'hq-card-1' },
      'moves the first present HQ card (lowest slot index)',
    );
  });

  test('optional (non-mandatory) put-bottom returns EXACTLY one resolveOptionalPutBottomHQ that declines', () => {
    const gameState = makeG({ hand: ['h' as CardExtId], currentStage: 'main' });
    gameState.hq = ['hq-card-0' as CardExtId, null, null, null, null];
    // why: optional form (Ionic Energy) — declining is the neutral bot default (no reward forgone).
    gameState.pendingOptionalPutBottomHQ = [{ playerID: '0', sourceCardId: 'src' as CardExtId }];

    const legalMoves = getLegalMoves(gameState, CONTEXT);

    assert.equal(legalMoves.length, 1);
    assert.equal(legalMoves[0]!.name, 'resolveOptionalPutBottomHQ');
    assert.deepEqual(legalMoves[0]!.args, { decline: true });
  });

  test('put-any-number-bottom returns EXACTLY one resolvePutAnyNumberBottomHQ with an empty selection', () => {
    const gameState = makeG({ hand: ['h' as CardExtId], currentStage: 'main' });
    gameState.pendingPutAnyNumberBottomHQ = [{ playerID: '0', sourceCardId: 'src' as CardExtId }];

    const legalMoves = getLegalMoves(gameState, CONTEXT);

    assert.equal(legalMoves.length, 1);
    assert.equal(legalMoves[0]!.name, 'resolvePutAnyNumberBottomHQ');
    assert.deepEqual(legalMoves[0]!.args, { cardIds: [] }, 'the deterministic bot default is "put none"');
  });

  test('mandatory put-bottom over an empty HQ fails closed (no unresolvable move)', () => {
    const gameState = makeG({ hand: ['h' as CardExtId], currentStage: 'main' });
    // hq stays all-null (makeG default) — an engine-invariant violation for a mandatory choice.
    gameState.pendingOptionalPutBottomHQ = [
      { playerID: '0', sourceCardId: 'src' as CardExtId, mandatory: true },
    ];

    const legalMoves = getLegalMoves(gameState, CONTEXT);

    assert.equal(legalMoves.length, 0, 'fail closed rather than emit an unresolvable move');
  });
});

describe('getLegalMoves — dynamic villain fight cost uses resolveFightCost (bot-freeze fix)', () => {
  // why: 2026-07-27 prod freeze (matches aifbXW04bA1 / eAVZNdWE5C1). getLegalMoves read
  // the STATIC cardStats.fightCost for city villains, but the fightVillain move gates on
  // resolveFightCost (the WP-214 single authority), which adds the captured-hero cost for
  // dynamic (vAttack "*"/"N+") villains. A dynamic villain whose static fightCost is 0 but
  // whose RESOLVED cost exceeds available attack was offered as a legal fight; the move
  // silently rejected it, yet boardgame.io still bumped _stateID on the void return, so the
  // bot-ally driver could not see the no-op and re-picked it every step until the 100-step
  // per-turn cap FAULTED the co-op match. These tests pin getLegalMoves to resolveFightCost.

  /**
   * Builds a state with one dynamic ("*") villain in city slot 0 that has captured one
   * hero, plus available attack. Mirrors the Skrull Queen Veranke + Covering Fire repro.
   */
  function makeDynamicVillainG(availableAttack: number): LegendaryGameState {
    const gameState = makeG({ hand: [], currentStage: 'main' });
    gameState.turnEconomy = {
      attack: availableAttack,
      recruit: 0,
      spentAttack: 0,
      spentRecruit: 0,
      piercing: 0,
      woundsDrawn: 0,
    } as LegendaryGameState['turnEconomy'];
    gameState.city = ['dyn-villain' as CardExtId, null, null, null, null];
    // why: dynamic villain — static fightCost 0, fightCostBase 0; resolved cost is
    // fightCostBase + captured hero cost = 0 + 5 = 5 (the captured hero costs 5).
    gameState.cardStats = {
      'dyn-villain': { attack: 0, recruit: 0, cost: 0, fightCost: 0, fightCostMode: 'dynamic', fightCostBase: 0 },
      'captured-hero': { attack: 0, recruit: 0, cost: 5, fightCost: 0 },
    } as unknown as LegendaryGameState['cardStats'];
    gameState.villainAttachedHeroes = { 'dyn-villain': ['captured-hero' as CardExtId] };
    return gameState;
  }

  test('does NOT offer fightVillain when the RESOLVED dynamic cost exceeds available attack', () => {
    // Resolved cost = 5; available attack = 4 → unaffordable. The static fightCost (0)
    // would have wrongly offered it (this is the exact freeze).
    const gameState = makeDynamicVillainG(4);

    const legalMoves = getLegalMoves(gameState, CONTEXT);

    const fightMoves = legalMoves.filter((move) => move.name === 'fightVillain');
    assert.equal(fightMoves.length, 0, 'unaffordable dynamic villain must not be offered');
  });

  test('does NOT offer fightVillain at zero attack against a captured-hero dynamic villain', () => {
    // The prod repro: attack 0, resolved cost 5. Static-fightCost logic offered it at 0>=0.
    const gameState = makeDynamicVillainG(0);

    const legalMoves = getLegalMoves(gameState, CONTEXT);

    assert.equal(
      legalMoves.filter((move) => move.name === 'fightVillain').length,
      0,
      'a dynamic villain with static fightCost 0 must not be offered at zero attack',
    );
    // The bot is left only advanceStage, so it can end the turn instead of spinning.
    assert.ok(
      legalMoves.some((move) => move.name === 'advanceStage'),
      'advanceStage remains available so the turn can end',
    );
  });

  test('DOES offer fightVillain once available attack meets the resolved dynamic cost', () => {
    // Resolved cost = 5; available attack = 5 → affordable.
    const gameState = makeDynamicVillainG(5);

    const legalMoves = getLegalMoves(gameState, CONTEXT);

    const fightMoves = legalMoves.filter((move) => move.name === 'fightVillain');
    assert.equal(fightMoves.length, 1, 'affordable dynamic villain is offered');
    assert.deepEqual(fightMoves[0]!.args, { cityIndex: 0 });
  });
});
