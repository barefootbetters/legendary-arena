/**
 * recruitSidekick move + on-play Sidekick return tests (WP-842 / EC-880 / D-24776).
 *
 * Verifies recruitSidekick follows the three-step validation contract, gates to
 * the main stage, moves the top Sidekick token from the Sidekick Stack to the
 * current player's discard, spends 2 recruit, at most once per turn, and no-ops
 * (never throws) on an empty Stack / insufficient recruit / wrong stage /
 * heal-lock / parked interactive choice / missing zone. Verifies that playing a
 * Sidekick returns it to the bottom of the Stack and draws two (draw lock and
 * short draws honoured), that every other card's play is unchanged, that the
 * turn-2 Out of Time replay returns a Sidekick too, and that the move is wired
 * into LegendaryGame and the replay dispatch map but not the simulation.
 *
 * Uses node:test and node:assert only. Uses makeMockMoveContext. No boardgame.io
 * imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  recruitSidekick,
  returnPlayedSidekick,
  SIDEKICK_RECRUIT_COST,
  SIDEKICK_RETURN_DRAW_COUNT,
} from './recruitSidekick.js';
import { playCard } from './coreMoves.impl.js';
import { replayOutOfTimeCards } from './outOfTime.logic.js';
import { CORE_MOVE_NAMES } from './coreMoves.types.js';
import { resetTurnEconomy } from '../economy/economy.logic.js';
import { LegendaryGame } from '../game.js';
import { SIMULATION_MOVE_NAMES } from '../simulation/ai.legalMoves.js';
import { applyReplayStep } from '../replay/replay.execute.js';
import type { LegendaryGameState } from '../types.js';
import { SIDEKICK_EXT_ID } from '../setup/pilesInit.js';
import { buildDefaultHookDefinitions } from '../rules/ruleRuntime.impl.js';
import { initializeCity, initializeHq } from '../board/city.logic.js';
import { makeMockMoveContext } from '../test/mockMoveContext.js';
import {
  makeCardStatEntry,
  makeGlobalPiles,
  makeMastermindState,
  makePlayerZones,
  makeTurnEconomy,
} from '../test/fixtureBuilders.js';

// ---------------------------------------------------------------------------
// Mock G factory
// ---------------------------------------------------------------------------

/** The locked recruit log line for a Stack that has `remaining` Sidekicks left after the recruit. */
function expectedRecruitLine(remaining: number): string {
  return `Player 0 recruited Sidekick (pile-sidekick) from the Sidekick Stack (spent 2 recruit; sidekicks pile: ${String(remaining)}).`;
}

/**
 * Creates a minimal LegendaryGameState for Sidekick tests. Player 0 is current
 * at the Main stage with the given recruit points; the Sidekick Stack, the
 * player's zones and cardStats are seeded per case.
 */
function createMockGameState(options?: {
  sidekicks?: string[];
  recruit?: number;
  currentStage?: LegendaryGameState['currentStage'];
  cardStats?: LegendaryGameState['cardStats'];
  hasHealedThisTurn?: boolean;
  pendingKoHeroChoices?: LegendaryGameState['pendingKoHeroChoices'];
  deck?: string[];
  hand?: string[];
  discard?: string[];
  inPlay?: string[];
  drawsLocked?: boolean;
}): LegendaryGameState {
  const config = {
    schemeId: 'test-scheme',
    mastermindId: 'test-mastermind',
    villainGroupIds: ['test-villain-group'],
    henchmanGroupIds: ['test-henchman-group'],
    heroDeckIds: ['test-hero-deck'],
    bystandersCount: 1,
    woundsCount: 1,
    officersCount: 1,
    sidekicksCount: 3,
  };
  const turnEconomy = { ...makeTurnEconomy(), recruit: options?.recruit ?? 0 };
  if (options?.drawsLocked === true) {
    turnEconomy.drawsLocked = true;
  }

  return {
    matchConfiguration: config,
    selection: {
      schemeId: config.schemeId,
      mastermindId: config.mastermindId,
      villainGroupIds: [...config.villainGroupIds],
      henchmanGroupIds: [...config.henchmanGroupIds],
      heroDeckIds: [...config.heroDeckIds],
    },
    currentStage: options?.currentStage ?? 'main',
    playerZones: {
      '0': {
        ...makePlayerZones(),
        deck: options?.deck ?? [],
        hand: options?.hand ?? [],
        discard: options?.discard ?? [],
        inPlay: options?.inPlay ?? [],
        victory: [],
      },
    },
    piles: { ...makeGlobalPiles(), sidekicks: options?.sidekicks ?? [SIDEKICK_EXT_ID, SIDEKICK_EXT_ID, SIDEKICK_EXT_ID] },
    messages: [],
    counters: {},
    hookRegistry: buildDefaultHookDefinitions(config),
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: {},
    ko: [],
    attachedBystanders: {},
    turnEconomy,
    cardStats: options?.cardStats ?? {
      [SIDEKICK_EXT_ID]: makeCardStatEntry({ cost: 2 }),
      'starting-shield-agent': makeCardStatEntry({ recruit: 1 }),
    },
    cardDisplayData: {
      [SIDEKICK_EXT_ID]: { extId: SIDEKICK_EXT_ID, name: 'Sidekick', imageUrl: '', cost: null },
    },
    mastermind: { ...makeMastermindState(),
      id: 'test-mastermind',
      baseCardId: 'test-mastermind-base',
      tacticsDeck: [],
      tacticsDefeated: [],
    },
    city: initializeCity(),
    hq: initializeHq(),
    heroDeck: [],
    heroAbilityHooks: [],
    hasHealedThisTurn: options?.hasHealedThisTurn ?? false,
    pendingKoHeroChoices: options?.pendingKoHeroChoices ?? [],
    lobby: { requiredPlayers: 1, ready: {}, started: false },
  } as unknown as LegendaryGameState;
}

/** Returns the message texts of a game state's log. */
function logTexts(gameState: LegendaryGameState): string[] {
  const texts: string[] = [];
  for (const entry of gameState.messages) {
    texts.push(entry.text);
  }
  return texts;
}

// ---------------------------------------------------------------------------
// Recruit (T1-T5)
// ---------------------------------------------------------------------------

describe('recruitSidekick (WP-842 / D-24776)', () => {
  it('T1: a funded main-stage recruit moves the top Sidekick to discard, spends 2, and sets the once-per-turn flag', () => {
    const gameState = createMockGameState({ recruit: 2 });
    const moveContext = makeMockMoveContext(gameState);

    recruitSidekick(moveContext);

    assert.equal(gameState.piles.sidekicks.length, 2, 'the Stack drops from 3 to 2');
    assert.deepStrictEqual(gameState.playerZones['0']!.discard, [SIDEKICK_EXT_ID], 'the Sidekick lands in discard');
    assert.equal(gameState.turnEconomy.spentRecruit, 2, 'spends 2 recruit');
    assert.equal(gameState.hasActedThisTurn, true, 'marks the player as having acted');
    assert.equal(gameState.turnEconomy.hasRecruitedSidekickThisTurn, true, 'the once-per-turn flag is set');
    assert.deepStrictEqual(logTexts(gameState), [expectedRecruitLine(2)], 'one locked log line');
  });

  it('T2: a second recruit in the same turn is a no-op even with recruit to spare', () => {
    const gameState = createMockGameState({ recruit: 4 });
    const moveContext = makeMockMoveContext(gameState);

    recruitSidekick(moveContext);
    const afterFirst = JSON.stringify(gameState);
    recruitSidekick(moveContext);

    assert.equal(JSON.stringify(gameState), afterFirst, 'the second recruit changes nothing');
    assert.equal(gameState.piles.sidekicks.length, 2, 'only one Sidekick left the Stack');
  });

  it('T3: insufficient recruit, empty Stack, wrong stage, heal-lock, parked choice and missing zone are silent no-ops', () => {
    const cases: { label: string; gameState: LegendaryGameState }[] = [
      { label: '1 recruit', gameState: createMockGameState({ recruit: 1 }) },
      { label: 'empty Stack', gameState: createMockGameState({ recruit: 2, sidekicks: [] }) },
      { label: 'stage start', gameState: createMockGameState({ recruit: 2, currentStage: 'start' }) },
      { label: 'healed this turn', gameState: createMockGameState({ recruit: 2, hasHealedThisTurn: true }) },
      {
        label: 'parked KO-a-Hero choice',
        gameState: createMockGameState({
          recruit: 2,
          pendingKoHeroChoices: [{ playerId: '0', sourceCardId: 'x', count: 1 }] as never,
        }),
      },
    ];
    const missingZone = createMockGameState({ recruit: 2 });
    missingZone.playerZones = {};
    cases.push({ label: 'missing current-player zone', gameState: missingZone });

    for (const testCase of cases) {
      const before = JSON.stringify(testCase.gameState);
      assert.doesNotThrow(() => recruitSidekick(makeMockMoveContext(testCase.gameState)), `${testCase.label}: never throws`);
      assert.equal(JSON.stringify(testCase.gameState), before, `${testCase.label}: no mutation`);
    }
  });

  it('T4: falls back to SIDEKICK_RECRUIT_COST when cardStats has no Sidekick entry', () => {
    assert.equal(SIDEKICK_RECRUIT_COST, 2);
    const funded = createMockGameState({ recruit: 2, cardStats: {} });
    recruitSidekick(makeMockMoveContext(funded));
    assert.equal(funded.piles.sidekicks.length, 2, 'succeeds at the fallback cost 2');

    const short = createMockGameState({ recruit: 1, cardStats: {} });
    recruitSidekick(makeMockMoveContext(short));
    assert.equal(short.piles.sidekicks.length, 3, 'fails with 1 recruit');
  });

  it('T5: resetTurnEconomy drops the flag, so the next turn may recruit again', () => {
    const gameState = createMockGameState({ recruit: 2 });
    recruitSidekick(makeMockMoveContext(gameState));
    assert.equal(gameState.turnEconomy.hasRecruitedSidekickThisTurn, true);

    const reset = resetTurnEconomy();
    assert.equal(Object.keys(reset).includes('hasRecruitedSidekickThisTurn'), false, 'the reset economy has no flag key');

    gameState.turnEconomy = { ...reset, recruit: 2 };
    recruitSidekick(makeMockMoveContext(gameState));
    assert.equal(gameState.piles.sidekicks.length, 1, 'a fresh-turn recruit succeeds');
  });
});

// ---------------------------------------------------------------------------
// Play: return to the Stack and draw two (T6-T10b)
// ---------------------------------------------------------------------------

describe('playing a Sidekick (WP-842 / D-24776)', () => {
  it('T6: returns the Sidekick to the bottom of the Stack and draws two', () => {
    const gameState = createMockGameState({
      sidekicks: ['sidekick-stack-marker', SIDEKICK_EXT_ID],
      hand: [SIDEKICK_EXT_ID],
      deck: ['deck-a', 'deck-b', 'deck-c'],
      discard: ['discard-a'],
    });
    const victoryBefore = [...gameState.playerZones['0']!.victory];

    playCard(makeMockMoveContext(gameState), { cardId: SIDEKICK_EXT_ID });

    const zones = gameState.playerZones['0']!;
    assert.equal(zones.inPlay.includes(SIDEKICK_EXT_ID), false, 'the Sidekick left play');
    assert.deepStrictEqual(gameState.piles.sidekicks, ['sidekick-stack-marker', SIDEKICK_EXT_ID, SIDEKICK_EXT_ID], 'appended at the bottom (the end)');
    assert.deepStrictEqual(zones.hand, ['deck-a', 'deck-b'], 'the top two deck cards came to hand');
    assert.deepStrictEqual(zones.deck, ['deck-c'], 'one deck card remains');
    assert.deepStrictEqual(zones.discard, ['discard-a'], 'discard untouched');
    assert.deepStrictEqual(zones.victory, victoryBefore, 'victory untouched');
    assert.equal(gameState.turnEconomy.cardsDrawn, SIDEKICK_RETURN_DRAW_COUNT, 'cardsDrawn +2');
    assert.equal(gameState.turnEconomy.sidekicksReturnedThisTurn, 1, 'the return is counted');
    const lastEntry = gameState.messages[gameState.messages.length - 1]!;
    assert.equal(lastEntry.text, 'Player 0 returned a Sidekick to the bottom of the Sidekick Stack and drew 2 card(s).');
    assert.equal(lastEntry.outcome, 'applied');
    assert.equal(lastEntry.card, SIDEKICK_EXT_ID);
  });

  it('T7: a reshuffle completes the draw; an empty deck and discard draw nothing (partial)', () => {
    const reshuffle = createMockGameState({
      hand: [SIDEKICK_EXT_ID],
      deck: ['deck-a'],
      discard: ['discard-a', 'discard-b'],
    });
    playCard(makeMockMoveContext(reshuffle), { cardId: SIDEKICK_EXT_ID });
    assert.equal(reshuffle.playerZones['0']!.hand.length, 2, 'draws 2 across one reshuffle');
    assert.equal(reshuffle.turnEconomy.cardsDrawn, 2);
    assert.equal(reshuffle.messages[reshuffle.messages.length - 1]!.outcome, 'applied');

    const empty = createMockGameState({ hand: [SIDEKICK_EXT_ID] });
    playCard(makeMockMoveContext(empty), { cardId: SIDEKICK_EXT_ID });
    const lastEntry = empty.messages[empty.messages.length - 1]!;
    assert.equal(empty.playerZones['0']!.hand.length, 0, 'nothing to draw');
    assert.equal(empty.turnEconomy.cardsDrawn, 0);
    assert.equal(empty.piles.sidekicks.length, 4, 'the Sidekick still returned');
    assert.equal(lastEntry.text, 'Player 0 returned a Sidekick to the bottom of the Sidekick Stack and drew 0 card(s).');
    assert.equal(lastEntry.outcome, 'partial');
  });

  it('T8: under the draw lock the Sidekick returns but nothing is drawn (blocked)', () => {
    const gameState = createMockGameState({
      hand: [SIDEKICK_EXT_ID],
      deck: ['deck-a', 'deck-b', 'deck-c'],
      drawsLocked: true,
    });

    playCard(makeMockMoveContext(gameState), { cardId: SIDEKICK_EXT_ID });

    const zones = gameState.playerZones['0']!;
    const lastEntry = gameState.messages[gameState.messages.length - 1]!;
    assert.equal(zones.inPlay.includes(SIDEKICK_EXT_ID), false, 'the Sidekick still returned');
    assert.equal(gameState.piles.sidekicks.length, 4);
    assert.deepStrictEqual(zones.hand, [], 'hand unchanged');
    assert.equal(gameState.turnEconomy.cardsDrawn, 0, 'cardsDrawn unchanged');
    assert.equal(gameState.turnEconomy.sidekicksReturnedThisTurn, 1);
    assert.equal(lastEntry.text, "Player 0 returned a Sidekick to the bottom of the Sidekick Stack but can't draw — no more draws this turn.");
    assert.equal(lastEntry.outcome, 'blocked');
    assert.equal(lastEntry.card, SIDEKICK_EXT_ID);
  });

  it('T9: any other card plays exactly as before (stays in play, no draw, no count key)', () => {
    const gameState = createMockGameState({
      hand: ['starting-shield-agent'],
      deck: ['deck-a', 'deck-b', 'deck-c'],
    });

    playCard(makeMockMoveContext(gameState), { cardId: 'starting-shield-agent' });

    const zones = gameState.playerZones['0']!;
    assert.deepStrictEqual(zones.inPlay, ['starting-shield-agent'], 'stays in play');
    assert.deepStrictEqual(zones.hand, [], 'no draw');
    assert.deepStrictEqual(zones.deck, ['deck-a', 'deck-b', 'deck-c'], 'deck untouched');
    assert.equal(gameState.piles.sidekicks.length, 3, 'Stack untouched');
    assert.equal(gameState.turnEconomy.cardsDrawn, 0);
    assert.equal(Object.keys(gameState.turnEconomy).includes('sidekicksReturnedThisTurn'), false, 'no count key');
    assert.equal(gameState.messages.length, 1, 'only the play line');
  });

  it('T10: returnPlayedSidekick does nothing when the Sidekick is not the last inPlay entry', () => {
    const gameState = createMockGameState({
      inPlay: [SIDEKICK_EXT_ID, 'starting-shield-agent'],
      deck: ['deck-a', 'deck-b'],
    });
    const before = JSON.stringify(gameState);

    returnPlayedSidekick(gameState, makeMockMoveContext(gameState), '0');

    assert.equal(JSON.stringify(gameState), before, 'no change');
  });

  it('T10b: the turn-2 Out of Time replay of a Sidekick returns it to the Stack instead of the discard', () => {
    const gameState = createMockGameState({ deck: ['deck-a', 'deck-b', 'deck-c'] });
    gameState.outOfTimeCards = { '0': [SIDEKICK_EXT_ID] };

    replayOutOfTimeCards(gameState, makeMockMoveContext(gameState), '0');

    const zones = gameState.playerZones['0']!;
    assert.equal(gameState.piles.sidekicks.length, 4, 'Stack +1');
    assert.equal(zones.hand.length, 2, 'hand +2');
    assert.deepStrictEqual(zones.discard, [], 'discard unchanged');
    assert.deepStrictEqual(zones.inPlay, [], 'nothing left in play');
    assert.deepStrictEqual(gameState.turnEconomy.outOfTimePlayedCardIds, [SIDEKICK_EXT_ID]);
    assert.equal(gameState.turnEconomy.sidekicksReturnedThisTurn, 1);
  });
});

// ---------------------------------------------------------------------------
// Wiring (T15, T15b)
// ---------------------------------------------------------------------------

describe('recruitSidekick wiring (WP-842 / D-24776)', () => {
  it('T15: registered on LegendaryGame (54 moves), not a core move, not a simulation move', () => {
    const moveNames = Object.keys(LegendaryGame.moves ?? {});
    assert.equal(moveNames.length, 54, 'LegendaryGame defines 54 moves');
    assert.equal(moveNames.includes('recruitSidekick'), true, 'recruitSidekick is registered');
    assert.equal((CORE_MOVE_NAMES as readonly string[]).includes('recruitSidekick'), false, 'not a CORE_MOVE_NAME');
    assert.equal((SIMULATION_MOVE_NAMES as readonly string[]).includes('recruitSidekick'), false, 'not a simulation move');
  });

  it('T15b: the replay dispatch map runs recruitSidekick', () => {
    const gameState = createMockGameState({ recruit: 2 });

    applyReplayStep(gameState, { moveName: 'recruitSidekick', playerId: '0', args: {} }, 1);

    assert.equal(gameState.piles.sidekicks.length, 2, 'one token popped from the Stack');
    assert.deepStrictEqual(gameState.playerZones['0']!.discard, [SIDEKICK_EXT_ID]);
  });
});
