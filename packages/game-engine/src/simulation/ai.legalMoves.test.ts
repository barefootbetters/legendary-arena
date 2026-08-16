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

describe('getLegalMoves — discard-to-play payability mirrors the move guard (WP-555 / D-24364)', () => {
  // why: WP-555. getLegalMoves enumerated playCard for EVERY hand card, but playCard
  // refuses a card whose [keyword:discard-to-play:N] cost is unpayable (the WP-383 /
  // D-24185 pre-commit precondition: hand.length < cost + 1, the +1 because the played
  // card is still IN hand). Core Cyclops 'Optic Blast' and 'Determination' both carry
  // discard-to-play:1, so once a hand held only that card the play was refused forever,
  // the bot re-picked it, nothing mutated, and the turn wedged — 5 of 312 games in the
  // runtime-observed sweep, all on the `core` hero board. Third application of the
  // D-24363 part-1 rule, after WP-214 (fight cost) and WP-554 (defeat requirement).

  /**
   * Builds a state whose hand holds `handCardIds`, where 'costly-card' carries a
   * discard-to-play cost of 1 and 'free-card' carries none.
   */
  function makeDiscardToPlayG(handCardIds: CardExtId[]): LegendaryGameState {
    const gameState = makeG({ hand: handCardIds, currentStage: 'main' });
    // why: getDiscardToPlayCost reads G.heroAbilityHooks and sums the MAGNITUDE of
    // each `discard-to-play` EFFECT (the keyword alone carries no cost), so the hook
    // needs both the keyword and the effect entry. Only 'costly-card' is marked.
    gameState.heroAbilityHooks = [
      {
        cardId: 'costly-card',
        keywords: ['discard-to-play'],
        effects: [{ type: 'discard-to-play', magnitude: 1 }],
      },
    ] as unknown as LegendaryGameState['heroAbilityHooks'];
    return gameState;
  }

  test('does NOT offer playCard for an UNPAYABLE discard-to-play card (alone in hand)', () => {
    // The exact wedge: cost 1, hand length 1 → 1 < 2, the move refuses.
    const gameState = makeDiscardToPlayG(['costly-card' as CardExtId]);

    const legalMoves = getLegalMoves(gameState, CONTEXT);

    assert.equal(
      legalMoves.filter((move) => move.name === 'playCard').length,
      0,
      'an unpayable discard-to-play card must not be offered',
    );
    // why: the bot must retain a way out of the turn, or suppression relocates the wedge.
    assert.ok(
      legalMoves.some((move) => move.name === 'advanceStage'),
      'advanceStage remains available so the turn can still end',
    );
  });

  test('DOES offer it at exactly cost + 1 cards in hand (the boundary)', () => {
    // why: the anti-over-filtering + off-by-one guard. Filtering on keyword PRESENCE,
    // or writing `hand.length < cost`, both pass the test above and break this one.
    const gameState = makeDiscardToPlayG(['costly-card' as CardExtId, 'free-card' as CardExtId]);

    const legalMoves = getLegalMoves(gameState, CONTEXT);

    const played = legalMoves.filter((move) => move.name === 'playCard');
    assert.equal(played.length, 2, 'at cost + 1 both cards are playable');
    assert.ok(
      played.some((move) => (move.args as { cardId: string }).cardId === 'costly-card'),
      'the costly card itself is offered once its cost is payable',
    );
  });

  test('is unaffected for a card with NO discard-to-play cost (alone in hand)', () => {
    const gameState = makeDiscardToPlayG(['free-card' as CardExtId]);

    const legalMoves = getLegalMoves(gameState, CONTEXT);

    assert.equal(
      legalMoves.filter((move) => move.name === 'playCard').length,
      1,
      'an unmarked card is offered exactly as before',
    );
  });
});

describe('getLegalMoves — villain defeat requirement mirrors the move guard (WP-554 / D-24363)', () => {
  // why: WP-554. getLegalMoves gated fightVillain on Guard-blocking + resolveFightCost +
  // getPatrolModifier only, and never consulted the villain's [require-to-defeat:...]
  // marker that fightVillain.ts enforces. Blob (vAttack 4, require-to-defeat team x-men)
  // was therefore offered to a player holding 4 attack and no X-Men Hero; the move refused
  // it, mutated nothing, and the enumeration returned the identical list on the next step —
  // an unbounded within-turn spin (>500 s, no completion, on the WP-453 seeded-shuffle
  // branch) and, in a live match, the same no-op re-pick the bot-ally driver's 100-step cap
  // faults on. This is the defeat-requirement half of the same divergence WP-214 fixed for
  // fight COST at this very line. These tests pin enumeration to the shared helper.

  /**
   * Builds a state with one Blob-like villain (static fightCost 4, requiring an
   * [team:x-men] Hero) in city slot 0, 4 available attack, and caller-chosen
   * hand / in-play / discard contents.
   */
  function makeDefeatRequirementG(overrides: {
    hand?: CardExtId[];
    inPlay?: CardExtId[];
    discard?: CardExtId[];
    withRequirement?: boolean;
  }): LegendaryGameState {
    const gameState = makeG({
      hand: overrides.hand ?? [],
      inPlay: overrides.inPlay ?? [],
      discard: overrides.discard ?? [],
      currentStage: 'main',
    });
    gameState.turnEconomy = {
      attack: 4,
      recruit: 0,
      spentAttack: 0,
      spentRecruit: 0,
      piercing: 0,
      woundsDrawn: 0,
    } as LegendaryGameState['turnEconomy'];
    gameState.city = ['blob-villain' as CardExtId, null, null, null, null];
    gameState.cardStats = {
      'blob-villain': { attack: 0, recruit: 0, cost: 0, fightCost: 4 },
    } as unknown as LegendaryGameState['cardStats'];
    gameState.cardTraits = {
      'x-men-hero': { team: 'x-men' },
      'avengers-hero': { team: 'avengers' },
    } as unknown as LegendaryGameState['cardTraits'];
    if (overrides.withRequirement !== false) {
      gameState.villainDefeatRequirements = {
        'blob-villain': { kind: 'team', value: 'x-men' },
      } as unknown as LegendaryGameState['villainDefeatRequirements'];
    }
    return gameState;
  }

  test('does NOT offer fightVillain when the defeat requirement is UNMET', () => {
    // The exact repro: 4 attack vs a 4-cost Blob, but the only Hero held is Avengers.
    const gameState = makeDefeatRequirementG({ hand: ['avengers-hero' as CardExtId] });

    const legalMoves = getLegalMoves(gameState, CONTEXT);

    assert.equal(
      legalMoves.filter((move) => move.name === 'fightVillain').length,
      0,
      'a villain whose defeat requirement is unmet must not be offered',
    );
    // why: the bot must retain a way OUT of the turn, or suppressing the fight would
    // simply relocate the spin instead of ending it.
    assert.ok(
      legalMoves.some((move) => move.name === 'advanceStage'),
      'advanceStage remains available so the turn can still end',
    );
  });

  test('DOES offer fightVillain once the defeat requirement is MET from hand', () => {
    // why: the anti-over-filtering guard. Dropping fightVillain whenever a requirement
    // EXISTS (rather than when it is UNMET) would satisfy the test above and silently
    // break every legitimate fight against Blob / Venom / Zombie Venom.
    const gameState = makeDefeatRequirementG({
      hand: ['avengers-hero' as CardExtId, 'x-men-hero' as CardExtId],
    });

    const legalMoves = getLegalMoves(gameState, CONTEXT);

    const fightMoves = legalMoves.filter((move) => move.name === 'fightVillain');
    assert.equal(fightMoves.length, 1, 'a satisfied requirement must still offer the fight');
    assert.deepEqual(fightMoves[0]!.args, { cityIndex: 0 });
  });

  test('DOES offer fightVillain when the requirement is met from IN PLAY', () => {
    const gameState = makeDefeatRequirementG({ inPlay: ['x-men-hero' as CardExtId] });

    const legalMoves = getLegalMoves(gameState, CONTEXT);

    assert.equal(
      legalMoves.filter((move) => move.name === 'fightVillain').length,
      1,
      'in-play counts toward the requirement, same as hand',
    );
  });

  test('does NOT count DISCARD toward the requirement (D-24076 zone scope)', () => {
    // why: pins enumeration to playerMeetsDefeatRequirement rather than a looser
    // re-implementation. D-24076 scopes "have" to hand OR in play only.
    const gameState = makeDefeatRequirementG({ discard: ['x-men-hero' as CardExtId] });

    const legalMoves = getLegalMoves(gameState, CONTEXT);

    assert.equal(
      legalMoves.filter((move) => move.name === 'fightVillain').length,
      0,
      'a qualifying Hero in the discard does not satisfy the requirement',
    );
  });

  test('is unaffected for a villain carrying NO defeat requirement', () => {
    // why: the overwhelming majority of villains are unmarked; the new check must be a
    // pure no-op for them.
    const gameState = makeDefeatRequirementG({
      hand: ['avengers-hero' as CardExtId],
      withRequirement: false,
    });

    const legalMoves = getLegalMoves(gameState, CONTEXT);

    assert.equal(
      legalMoves.filter((move) => move.name === 'fightVillain').length,
      1,
      'an unmarked villain is offered exactly as before',
    );
  });
});

describe('getLegalMoves — pending hero-reveal discard-or-return short-circuit (D-22001, bot-freeze gap)', () => {
  // why: pendingHeroChoice was the ONE block-all choice getLegalMoves did not short-circuit
  // (the WP-427 sibling). It blocks endTurn + the cleanup stage-advance, so without a resolve
  // move the bot dispatched a guard-rejected endTurn/advanceStage and its turn faulted. These
  // tests pin the short-circuit + the deterministic 'return' default.

  test('returns EXACTLY one resolveHeroChoice with the deterministic return default while pending', () => {
    const gameState = makeG({ hand: ['h' as CardExtId], currentStage: 'main' });
    gameState.pendingHeroChoice = {
      choiceType: 'discard-or-return',
      cardId: 'revealed-card' as CardExtId,
      playerID: '0',
    };

    const legalMoves = getLegalMoves(gameState, CONTEXT);

    assert.equal(legalMoves.length, 1, 'exactly one move while a hero-reveal choice is pending');
    assert.equal(legalMoves[0]!.name, 'resolveHeroChoice');
    assert.deepEqual(
      legalMoves[0]!.args,
      { resolution: 'return' },
      'deterministic default returns (keeps) the revealed card — never discards blindly',
    );
  });

  test('the short-circuit fires in cleanup too (where pendingHeroChoice blocks the turn-end)', () => {
    const gameState = makeG({ hand: [], currentStage: 'cleanup' });
    gameState.pendingHeroChoice = {
      choiceType: 'discard-or-return',
      cardId: 'revealed-card' as CardExtId,
      playerID: '0',
    };

    const legalMoves = getLegalMoves(gameState, CONTEXT);

    assert.equal(legalMoves.length, 1);
    assert.equal(legalMoves[0]!.name, 'resolveHeroChoice');
  });

  test('no short-circuit when pendingHeroChoice is undefined (normal enumeration)', () => {
    const gameState = makeG({ hand: [], currentStage: 'main' });
    assert.equal(gameState.pendingHeroChoice, undefined);

    const legalMoves = getLegalMoves(gameState, CONTEXT);

    assert.ok(
      !legalMoves.some((move) => move.name === 'resolveHeroChoice'),
      'resolveHeroChoice is not offered when nothing is pending',
    );
    assert.ok(legalMoves.some((move) => move.name === 'advanceStage'));
  });
});

describe('getLegalMoves — pending Copy Powers short-circuit (WP-535 / D-24345)', () => {
  const COPY = 'core/rogue/copy-powers' as CardExtId;
  const GAMBIT = 'core/gambit/card-shark' as CardExtId;
  const WOLVERINE = 'core/wolverine/keen-senses' as CardExtId;

  function makeCopyG(): LegendaryGameState {
    return {
      currentStage: 'main',
      villainRevealedThisTurn: false,
      playerZones: {
        '0': { deck: [], hand: [], discard: [], inPlay: [COPY, GAMBIT, WOLVERINE], victory: [] },
      },
      turnEconomy: { attack: 0, recruit: 0, spentAttack: 0, spentRecruit: 0, piercing: 0, woundsDrawn: 0 },
      cardStats: { [GAMBIT]: { cost: 4 }, [WOLVERINE]: { cost: 6 } },
      cardTraits: {
        [COPY]: { heroClass: 'covert', team: null },
        [GAMBIT]: { heroClass: 'instinct', team: 'x-men' },
        [WOLVERINE]: { heroClass: 'instinct', team: 'x-men' },
      },
      cardKeywords: {},
      hq: [null, null, null, null, null],
      city: [null, null, null, null, null],
      mastermind: { baseCardId: 'm-base', tacticsDeck: [] },
      pendingCopyPowersChoices: [{ choiceType: 'copy-powers', playerID: '0', sourceCardId: COPY }],
    } as unknown as LegendaryGameState;
  }

  test('returns EXACTLY one resolveCopyPowersChoice targeting the highest-cost eligible Hero', () => {
    const legalMoves = getLegalMoves(makeCopyG(), CONTEXT);
    assert.equal(legalMoves.length, 1, 'exactly one legal move while pending');
    const only = legalMoves[0]!;
    assert.equal(only.name, 'resolveCopyPowersChoice', 'the single move is resolveCopyPowersChoice');
    // Wolverine (cost 6) beats Gambit (cost 4); Copy Powers itself is excluded from the eligible set.
    assert.deepStrictEqual(only.args, { cardId: WOLVERINE });
  });
});
