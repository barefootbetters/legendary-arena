/**
 * Tests for the resolveMoveVillainChoice move (WP-795 / D-24664 — core Storm's "Spinning
 * Cyclone"), the hasPendingMoveVillainChoice predicate, the heroEffectSpinningCyclone park
 * handler (via executeHeroEffects), and the block-all guard.
 *
 * Covers:
 *  - park: a City Villain parks one entry for the active player; an empty City logs the locked
 *    blocked line and parks nothing.
 *  - move to an empty space: the Villain moves and only its Bystanders are rescued (both lines).
 *  - move to an occupied space: the two Villains swap; only the moved Villain's Bystanders are
 *    rescued; the other keeps its Bystanders and captured Heroes.
 *  - decline: only the log changes and the entry pops.
 *  - every invalid answer is a silent no-op with the queue intact.
 *  - the block-all guard freezes drawCards / playCard / endTurn / fightVillain / recruitHero /
 *    revealVillainCard, and hasAnyPendingChoice reports the open choice.
 *
 * Uses node:test + node:assert only. No boardgame.io imports.
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveMoveVillainChoice,
  hasPendingMoveVillainChoice,
} from './moveVillainChoice.resolve.js';
import type { ResolveMoveVillainChoiceArgs } from './moveVillainChoice.resolve.js';
import { drawCards, playCard, endTurn } from './coreMoves.impl.js';
import { fightVillain } from './fightVillain.js';
import { recruitHero } from './recruitHero.js';
import { hasAnyPendingChoice } from './phaseCard.js';
import { revealVillainCard } from '../villainDeck/villainDeck.reveal.js';
import { executeHeroEffects } from '../hero/heroEffects.execute.js';
import { formatCardRef } from '../log/logDisplay.js';
import { makeMockCtx } from '../test/mockCtx.js';
import type { LegendaryGameState, PendingMoveVillainChoice } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';

const SOURCE_CARD = 'core/storm/spinning-cyclone#0' as CardExtId;
const VILLAIN_A = 'villain-a' as CardExtId;
const VILLAIN_B = 'villain-b' as CardExtId;
const BYSTANDER_1 = 'bystander-1' as CardExtId;
const BYSTANDER_2 = 'bystander-2' as CardExtId;
const CAPTURED_HERO = 'captured-hero' as CardExtId;

/** Overrides for the minimal Spinning Cyclone game state. */
interface TestStateOverrides {
  city?: (CardExtId | null)[];
  attachedBystanders?: Record<string, CardExtId[]>;
  villainAttachedHeroes?: Record<string, CardExtId[]>;
  pendingMoveVillainChoices?: PendingMoveVillainChoice[];
  currentStage?: LegendaryGameState['currentStage'];
  heroAbilityHooks?: HeroAbilityHook[];
}

/**
 * Builds a minimal two-seat LegendaryGameState for the Spinning Cyclone flow.
 *
 * @param overrides - City contents, attachments, the pending queue and the stage.
 * @returns A fresh game state.
 */
function makeTestGameState(overrides: TestStateOverrides = {}): LegendaryGameState {
  const state = {
    matchConfiguration: {
      schemeId: 'test-scheme', mastermindId: 'test-mastermind', villainGroupIds: [],
      henchmanGroupIds: [], heroDeckIds: [], bystandersCount: 0, woundsCount: 0,
      officersCount: 0, sidekicksCount: 0,
    },
    selection: {
      schemeId: 'test-scheme', mastermindId: 'test-mastermind', villainGroupIds: [],
      henchmanGroupIds: [], heroDeckIds: [],
    },
    currentStage: overrides.currentStage ?? 'main',
    playerZones: {
      '0': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
    },
    piles: { bystanders: [], wounds: [], officers: [], sidekicks: [], horrors: [] },
    messages: [],
    counters: {},
    hookRegistry: [],
    villainAbilityHooks: [],
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: {},
    ko: [],
    attachedBystanders: overrides.attachedBystanders ?? {},
    villainAttachedHeroes: overrides.villainAttachedHeroes ?? {},
    turnEconomy: {
      attack: 0, recruit: 0, spentAttack: 0, spentRecruit: 0, piercing: 0,
      woundsDrawn: 0, cardsDrawn: 0,
    },
    cardStats: {},
    cardKeywords: {},
    heroDeck: [],
    escapedPile: [],
    mastermind: {
      id: 'test-mastermind', baseCardId: 'test-mastermind-base',
      tacticsDeck: [] as CardExtId[], tacticsDefeated: [], strikePile: [],
      attachedBystanders: [],
    },
    scheme: { twistPile: [] },
    notableEvents: [],
    city: overrides.city ?? [null, null, null, null, null],
    hq: [null, null, null, null, null],
    cardDisplayData: {},
    cardTraits: {},
    schemeSetupInstructions: [],
    heroAbilityHooks: overrides.heroAbilityHooks ?? [],
    lobby: { requiredPlayers: 1, ready: {}, started: false },
  } as unknown as LegendaryGameState;

  if (overrides.pendingMoveVillainChoices !== undefined) {
    state.pendingMoveVillainChoices = overrides.pendingMoveVillainChoices;
  }
  return state;
}

/**
 * Builds a move context (random.Shuffle reverses to prove it ran).
 *
 * @param gameState - The game state the move mutates.
 * @param playerId - The calling seat (also the current player).
 * @returns A boardgame.io-shaped move context.
 */
function makeMoveContext(
  gameState: LegendaryGameState,
  playerId: string = '0',
): Parameters<typeof resolveMoveVillainChoice>[0] {
  return {
    G: gameState,
    ctx: {
      numPlayers: 2, currentPlayer: playerId, phase: 'play', turn: 1,
      playOrder: ['0', '1'], playOrderPos: 0, activePlayers: null,
    },
    events: {
      endTurn: mock.fn(), setPhase: mock.fn(), endPhase: mock.fn(),
      setStage: mock.fn(), endStage: mock.fn(), pass: mock.fn(), endGame: mock.fn(),
    },
    random: {
      Shuffle: <T>(deck: T[]): T[] => [...deck].reverse(),
      D4: mock.fn(), D6: mock.fn(), D10: mock.fn(), D12: mock.fn(), D20: mock.fn(),
      Die: mock.fn(), Number: mock.fn(),
    },
    playerID: playerId,
    log: { setMetadata: mock.fn() },
  } as unknown as Parameters<typeof resolveMoveVillainChoice>[0];
}

/** The log reference for a card, exactly as the engine renders it. */
function ref(gameState: LegendaryGameState, cardId: CardExtId): string {
  return formatCardRef(gameState.cardDisplayData, cardId);
}

/** One pending Spinning Cyclone entry for seat 0. */
function pendingForSeatZero(): PendingMoveVillainChoice[] {
  return [{ playerID: '0', sourceCardId: SOURCE_CARD }];
}

/** The text of every log line pushed so far. */
function logTexts(gameState: LegendaryGameState): string[] {
  const texts: string[] = [];
  for (const entry of gameState.messages as unknown[]) {
    if (typeof entry === 'string') {
      texts.push(entry);
    } else {
      texts.push((entry as { text: string }).text);
    }
  }
  return texts;
}

describe('heroEffectSpinningCyclone park handler (WP-795 / D-24664)', () => {
  const spinningCycloneHook: HeroAbilityHook = {
    cardId: SOURCE_CARD as string,
    timing: 'onPlay',
    keywords: ['spinning-cyclone'],
    effects: [{ type: 'spinning-cyclone' }],
    conditions: [],
  } as unknown as HeroAbilityHook;

  it('parks ONE PendingMoveVillainChoice for the active player when a Villain is in the City', () => {
    const gameState = makeTestGameState({
      city: [null, null, VILLAIN_A, null, null],
      heroAbilityHooks: [spinningCycloneHook],
    });
    executeHeroEffects(gameState, makeMockCtx({ numPlayers: 2 }), '0', SOURCE_CARD as string);
    assert.equal(hasPendingMoveVillainChoice(gameState), true);
    assert.deepEqual(gameState.pendingMoveVillainChoices, [{ playerID: '0', sourceCardId: SOURCE_CARD }]);
  });

  it('logs the blocked line and parks NOTHING when the City is empty', () => {
    const gameState = makeTestGameState({ heroAbilityHooks: [spinningCycloneHook] });
    executeHeroEffects(gameState, makeMockCtx({ numPlayers: 2 }), '0', SOURCE_CARD as string);
    assert.equal(hasPendingMoveVillainChoice(gameState), false);
    assert.equal('pendingMoveVillainChoices' in gameState, false, 'the queue is never lazily created');
    const blocked = (gameState.messages as unknown as { text: string; outcome?: string; card?: string }[])
      .find((entry) => entry.text.endsWith('found no Villain in the City to move.'));
    assert.ok(blocked, 'the blocked line is logged');
    assert.equal(blocked.outcome, 'blocked');
    assert.equal(blocked.card, SOURCE_CARD);
    assert.match(blocked.text, /^Player 0's .+ found no Villain in the City to move\.$/);
  });
});

describe('resolveMoveVillainChoice — move to an empty space (WP-795 / D-24664)', () => {
  it('moves the Villain, rescues its Bystanders into the chooser\'s Victory Pile, logs both lines, and pops', () => {
    const gameState = makeTestGameState({
      city: [VILLAIN_A, null, null, null, null],
      attachedBystanders: { [VILLAIN_A]: [BYSTANDER_1, BYSTANDER_2] },
      pendingMoveVillainChoices: pendingForSeatZero(),
    });
    resolveMoveVillainChoice(makeMoveContext(gameState), { fromCityIndex: 0, toCityIndex: 4 });

    assert.deepEqual(gameState.city, [null, null, null, null, VILLAIN_A], 'the Bridge does not escape the moved Villain');
    assert.deepEqual(gameState.playerZones['0']!.victory, [BYSTANDER_1, BYSTANDER_2]);
    assert.equal(gameState.attachedBystanders[VILLAIN_A], undefined, 'the rescued mapping is removed');
    assert.deepEqual(gameState.escapedPile, [], 'no escape');
    assert.equal(hasPendingMoveVillainChoice(gameState), false, 'the entry is popped');
    const texts = logTexts(gameState);
    assert.ok(texts.includes(`Player 0 moved ${ref(gameState, VILLAIN_A)} from the Sewers to the Bridge (Spinning Cyclone).`));
    assert.ok(texts.includes(`Player 0 rescued 2 bystander(s) from ${ref(gameState, VILLAIN_A)}.`));
  });

  it('logs no rescue line when the moved Villain holds no Bystander', () => {
    const gameState = makeTestGameState({
      city: [null, VILLAIN_A, null, null, null],
      pendingMoveVillainChoices: pendingForSeatZero(),
    });
    resolveMoveVillainChoice(makeMoveContext(gameState), { fromCityIndex: 1, toCityIndex: 2 });
    assert.deepEqual(gameState.city, [null, null, VILLAIN_A, null, null]);
    assert.deepEqual(logTexts(gameState), [`Player 0 moved ${ref(gameState, VILLAIN_A)} from the Bank to the Rooftops (Spinning Cyclone).`]);
    assert.deepEqual(gameState.playerZones['0']!.victory, []);
  });
});

describe('resolveMoveVillainChoice — move to an occupied space swaps (WP-795 / D-24664)', () => {
  it('swaps the two Villains and rescues ONLY the moved Villain\'s Bystanders', () => {
    const gameState = makeTestGameState({
      city: [null, VILLAIN_A, null, VILLAIN_B, null],
      attachedBystanders: { [VILLAIN_A]: [BYSTANDER_1], [VILLAIN_B]: [BYSTANDER_2] },
      villainAttachedHeroes: { [VILLAIN_B]: [CAPTURED_HERO] },
      pendingMoveVillainChoices: pendingForSeatZero(),
    });
    resolveMoveVillainChoice(makeMoveContext(gameState), { fromCityIndex: 1, toCityIndex: 3 });

    assert.deepEqual(gameState.city, [null, VILLAIN_B, null, VILLAIN_A, null], 'both Villains stay in the City, swapped');
    assert.deepEqual(gameState.playerZones['0']!.victory, [BYSTANDER_1], 'only the moved Villain\'s Bystander is rescued');
    assert.deepEqual(gameState.attachedBystanders[VILLAIN_B], [BYSTANDER_2], 'the swapped Villain keeps its Bystander');
    assert.deepEqual(gameState.villainAttachedHeroes[VILLAIN_B], [CAPTURED_HERO], 'the swapped Villain keeps its captured Hero');
    assert.equal(hasPendingMoveVillainChoice(gameState), false);
    const texts = logTexts(gameState);
    assert.ok(texts.includes(
      `Player 0 moved ${ref(gameState, VILLAIN_A)} from the Bank to the Streets (Spinning Cyclone). ${ref(gameState, VILLAIN_B)} moved to the Bank.`,
    ));
    assert.ok(texts.includes(`Player 0 rescued 1 bystander(s) from ${ref(gameState, VILLAIN_A)}.`));
    assert.ok(!texts.some((text) => text.includes(`from ${ref(gameState, VILLAIN_B)}`)), 'nothing is rescued from the swapped Villain');
  });
});

describe('resolveMoveVillainChoice — decline (WP-795 / D-24664)', () => {
  it('changes nothing but the log and pops the entry', () => {
    const gameState = makeTestGameState({
      city: [VILLAIN_A, null, null, null, null],
      attachedBystanders: { [VILLAIN_A]: [BYSTANDER_1] },
      pendingMoveVillainChoices: pendingForSeatZero(),
    });
    resolveMoveVillainChoice(makeMoveContext(gameState), { decline: true });

    assert.deepEqual(gameState.city, [VILLAIN_A, null, null, null, null]);
    assert.deepEqual(gameState.attachedBystanders, { [VILLAIN_A]: [BYSTANDER_1] }, 'declining rescues nothing');
    assert.deepEqual(gameState.playerZones['0']!.victory, []);
    assert.equal(hasPendingMoveVillainChoice(gameState), false);
    assert.deepEqual(logTexts(gameState), ['Player 0 chose not to move a Villain (Spinning Cyclone).']);
  });
});

describe('resolveMoveVillainChoice — invalid answers are silent no-ops (WP-795 / D-24664)', () => {
  const invalidAnswers: { label: string; args: unknown }[] = [
    { label: 'null args', args: null },
    { label: 'undefined args', args: undefined },
    { label: 'a non-object', args: 'decline' },
    { label: 'an empty object', args: {} },
    { label: 'decline: false', args: { decline: false } },
    { label: 'decline plus an index (mixed)', args: { decline: true, fromCityIndex: 0 } },
    { label: 'a move plus decline (mixed)', args: { fromCityIndex: 0, toCityIndex: 1, decline: true } },
    { label: 'a partial move', args: { fromCityIndex: 0 } },
    { label: 'a non-integer index', args: { fromCityIndex: 0.5, toCityIndex: 1 } },
    { label: 'an index above 4', args: { fromCityIndex: 0, toCityIndex: 5 } },
    { label: 'a negative index', args: { fromCityIndex: -1, toCityIndex: 1 } },
    { label: 'a string index', args: { fromCityIndex: '0', toCityIndex: 1 } },
    { label: 'from === to', args: { fromCityIndex: 0, toCityIndex: 0 } },
    { label: 'an empty source space', args: { fromCityIndex: 2, toCityIndex: 0 } },
  ];

  for (const invalid of invalidAnswers) {
    it(`${invalid.label} leaves G byte-identical with the queue intact`, () => {
      const gameState = makeTestGameState({
        city: [VILLAIN_A, null, null, null, null],
        attachedBystanders: { [VILLAIN_A]: [BYSTANDER_1] },
        pendingMoveVillainChoices: pendingForSeatZero(),
      });
      const before = JSON.stringify(gameState);
      resolveMoveVillainChoice(makeMoveContext(gameState), invalid.args as ResolveMoveVillainChoiceArgs);
      assert.equal(JSON.stringify(gameState), before);
      assert.equal(hasPendingMoveVillainChoice(gameState), true);
    });
  }

  it('an empty queue is a no-op', () => {
    const gameState = makeTestGameState({ city: [VILLAIN_A, null, null, null, null] });
    const before = JSON.stringify(gameState);
    resolveMoveVillainChoice(makeMoveContext(gameState), { fromCityIndex: 0, toCityIndex: 1 });
    assert.equal(JSON.stringify(gameState), before);
  });

  it('a front playerID mismatch is a no-op with the queue intact', () => {
    const gameState = makeTestGameState({
      city: [VILLAIN_A, null, null, null, null],
      pendingMoveVillainChoices: pendingForSeatZero(),
    });
    const before = JSON.stringify(gameState);
    resolveMoveVillainChoice(makeMoveContext(gameState, '1'), { fromCityIndex: 0, toCityIndex: 1 });
    assert.equal(JSON.stringify(gameState), before);
    assert.equal(hasPendingMoveVillainChoice(gameState), true);
  });
});

describe('hasPendingMoveVillainChoice block-all guard (WP-795 / D-24664)', () => {
  /**
   * Runs `act` twice on fresh states — once with no pending choice (it must change `observe`,
   * proving the fixture reaches the move's effect) and once with a pending Spinning Cyclone
   * choice (it must leave `observe` unchanged — the guard froze the board).
   */
  function assertGuardBlocks(
    build: () => LegendaryGameState,
    act: (gameState: LegendaryGameState) => unknown,
    observe: (gameState: LegendaryGameState, actResult: unknown) => unknown,
  ): void {
    const unguarded = build();
    const unguardedBefore = JSON.stringify(observe(unguarded, undefined));
    const unguardedResult = act(unguarded);
    assert.notEqual(
      JSON.stringify(observe(unguarded, unguardedResult)),
      unguardedBefore,
      'without a pending choice the move takes effect (the fixture is not vacuous)',
    );

    const guarded = build();
    guarded.pendingMoveVillainChoices = pendingForSeatZero();
    const guardedBefore = JSON.stringify(observe(guarded, undefined));
    const guardedResult = act(guarded);
    assert.equal(JSON.stringify(observe(guarded, guardedResult)), guardedBefore, 'the pending choice blocks the move');
    assert.equal(hasPendingMoveVillainChoice(guarded), true);
  }

  it('drawCards no-ops while pending', () => {
    assertGuardBlocks(
      () => {
        const gameState = makeTestGameState({ currentStage: 'start' });
        gameState.playerZones['0']!.deck = ['deck-1', 'deck-2'] as CardExtId[];
        return gameState;
      },
      (gameState) => drawCards(makeMoveContext(gameState) as never, { count: 1 } as never),
      (gameState) => gameState.playerZones['0']!.hand,
    );
  });

  it('playCard no-ops while pending', () => {
    assertGuardBlocks(
      () => {
        const gameState = makeTestGameState({ currentStage: 'main' });
        gameState.playerZones['0']!.hand = ['hero-1'] as CardExtId[];
        return gameState;
      },
      (gameState) => playCard(makeMoveContext(gameState) as never, { cardId: 'hero-1' } as never),
      (gameState) => gameState.playerZones['0']!.inPlay,
    );
  });

  it('endTurn no-ops while pending', () => {
    assertGuardBlocks(
      () => makeTestGameState({ currentStage: 'cleanup' }),
      (gameState) => {
        const context = makeMoveContext(gameState);
        endTurn(context as never);
        return (context.events.endTurn as unknown as { mock: { callCount: () => number } }).mock.callCount();
      },
      (_gameState, actResult) => actResult ?? 0,
    );
  });

  it('fightVillain no-ops while pending', () => {
    assertGuardBlocks(
      () => {
        const gameState = makeTestGameState({ currentStage: 'main', city: [VILLAIN_A, null, null, null, null] });
        gameState.cardStats = {
          [VILLAIN_A]: { attack: 0, recruit: 0, cost: 0, fightCost: 1, fightCostMode: 'static', fightCostBase: 1 },
        } as unknown as LegendaryGameState['cardStats'];
        gameState.turnEconomy.attack = 5;
        return gameState;
      },
      (gameState) => fightVillain(makeMoveContext(gameState) as never, { cityIndex: 0 } as never),
      (gameState) => gameState.city,
    );
  });

  it('recruitHero no-ops while pending', () => {
    assertGuardBlocks(
      () => {
        const gameState = makeTestGameState({ currentStage: 'main' });
        gameState.hq = ['hq-hero', null, null, null, null] as LegendaryGameState['hq'];
        gameState.cardStats = {
          'hq-hero': { attack: 0, recruit: 0, cost: 1, fightCost: 0, fightCostMode: 'static', fightCostBase: 0 },
        } as unknown as LegendaryGameState['cardStats'];
        gameState.turnEconomy.recruit = 5;
        return gameState;
      },
      (gameState) => recruitHero(makeMoveContext(gameState) as never, { hqIndex: 0 } as never),
      (gameState) => gameState.playerZones['0']!.discard,
    );
  });

  it('revealVillainCard no-ops while pending', () => {
    assertGuardBlocks(
      () => {
        const gameState = makeTestGameState({ currentStage: 'start' });
        gameState.villainDeck = { deck: ['villain-z'], discard: [] } as unknown as LegendaryGameState['villainDeck'];
        gameState.villainDeckCardTypes = { 'villain-z': 'villain' } as unknown as LegendaryGameState['villainDeckCardTypes'];
        return gameState;
      },
      (gameState) => revealVillainCard(makeMoveContext(gameState) as never),
      (gameState) => gameState.villainDeck.deck,
    );
  });

  it('hasAnyPendingChoice reports the open choice (it also gates the escape-procedure opener)', () => {
    const gameState = makeTestGameState({ pendingMoveVillainChoices: pendingForSeatZero() });
    assert.equal(hasAnyPendingChoice(gameState), true);
    assert.equal(hasAnyPendingChoice(makeTestGameState()), false);
  });
});
