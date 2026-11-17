/**
 * Killmonger tests (WP-769 / D-24602): the lock predicates, the fightMastermind lock, the Wound
 * return, the Final Blow, the Master Strike, the four tactics and the bot intents.
 *
 * node:test + node:assert only. makeMockCtx / makeMockMoveContext (Shuffle reverses). No
 * boardgame.io/testing import.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  KILLMONGER_MASTERMIND_ID,
  canWoundMastermind,
  isKillmonger,
  isKillmongerAttackLocked,
  isKillmongerLockShown,
} from './killmonger.logic.js';
import { fightMastermind, defeatMastermindTacticCore } from '../moves/fightMastermind.js';
import { woundMastermind } from '../moves/woundMastermind.js';
import { mastermindStrikeHandler } from '../rules/mastermindHandlers.js';
import { dispatchTacticOnFight } from '../rules/tacticHandlers.js';
import { getLegalMoves } from '../simulation/ai.legalMoves.js';
import { runSimulation } from '../simulation/simulation.runner.js';
import { createCompetentHeuristicPolicy } from '../simulation/ai.competent.js';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { DEFAULT_IMPLEMENTATION_MAP } from '../rules/ruleRuntime.impl.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { makeMockMoveContext } from '../test/mockMoveContext.js';
import { makeCardRegistryReader, makeCardStatEntry } from '../test/fixtureBuilders.js';
import { WOUND_EXT_ID } from '../setup/pilesInit.js';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { CardRegistryReader } from '../matchSetup.validate.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const KILLMONGER_BASE = 'bkpt-mastermind-killmonger-killmonger' as CardExtId;
const SCAR = 'bkpt-mastermind-killmonger-a-scar-for-every-kill' as CardExtId;
const RITE = 'bkpt-mastermind-killmonger-rite-of-challenge' as CardExtId;
const WATERFALL = 'bkpt-mastermind-killmonger-throw-from-the-waterfall' as CardExtId;
const ALTAR = 'bkpt-mastermind-killmonger-altar-of-resurrection' as CardExtId;

const VILLAIN_A = 'bkpt-villain-killmongers-league-malice-00' as CardExtId;
const VILLAIN_B = 'bkpt-villain-killmongers-league-preyy-00' as CardExtId;
const HENCHMAN_A = 'core-henchman-doombot-legion-00' as CardExtId;
const BYSTANDER_A = 'pile-bystander' as CardExtId;

/** The setup composition every fixture builds from (a mock registry). */
function createTestConfig(): MatchSetupConfig {
  return {
    schemeId: 'test-scheme-001',
    mastermindId: 'test-mastermind-001',
    villainGroupIds: ['test-villain-group-001'],
    henchmanGroupIds: ['test-henchman-group-001'],
    heroDeckIds: ['test-hero-deck-001', 'test-hero-deck-002'],
    bystandersCount: 10,
    woundsCount: 15,
    officersCount: 20,
    sidekicksCount: 5,
  };
}

/**
 * Builds a two-seat game state with Killmonger (printed Attack 5) as the Mastermind, four
 * tactics left, 99 Attack, an empty KO pile and the `main` stage.
 *
 * @param mastermindId - The selected Mastermind (Killmonger by default).
 * @returns The state.
 */
function makeState(mastermindId: string = KILLMONGER_MASTERMIND_ID): LegendaryGameState {
  const baseState = buildInitialGameState(createTestConfig(), makeCardRegistryReader(), makeMockCtx());
  const gameState: LegendaryGameState = {
    ...baseState,
    selection: { ...baseState.selection, mastermindId },
  };
  gameState.currentStage = 'main';
  gameState.mastermind = {
    ...gameState.mastermind,
    baseCardId: KILLMONGER_BASE,
    tacticsDeck: [SCAR, RITE, WATERFALL, ALTAR],
    tacticsDefeated: [],
  };
  gameState.cardStats[KILLMONGER_BASE] = makeCardStatEntry({ fightCost: 5 });
  gameState.cardDisplayData = {
    ...gameState.cardDisplayData,
    [KILLMONGER_BASE]: { extId: KILLMONGER_BASE, name: 'Killmonger', imageUrl: '', cost: 0 },
  };
  gameState.villainDeckCardTypes[VILLAIN_A] = 'villain';
  gameState.villainDeckCardTypes[VILLAIN_B] = 'villain';
  gameState.villainDeckCardTypes[HENCHMAN_A] = 'henchman';
  gameState.villainDeckCardTypes[BYSTANDER_A] = 'bystander';
  gameState.ko = [];
  gameState.turnEconomy = { ...gameState.turnEconomy, attack: 99 };
  return gameState;
}

/**
 * Puts N Wounds on the Mastermind directly (test setup).
 *
 * @param gameState - The state.
 * @param count - How many Wounds.
 */
function setWounds(gameState: LegendaryGameState, count: number): void {
  const wounds: CardExtId[] = [];
  for (let woundIndex = 0; woundIndex < count; woundIndex++) {
    wounds.push(WOUND_EXT_ID);
  }
  gameState.mastermind = { ...gameState.mastermind, wounds };
}

/** The bot's lifecycle context (seat 0, the active player). */
const LEGAL_MOVES_CONTEXT = { currentPlayer: '0', numPlayers: 2, turn: 1, phase: 'play' } as never;

/** A strike context: current player + a reversing Shuffle. */
function strikeContext(currentPlayer: string): unknown {
  return { random: { Shuffle: <T,>(items: T[]): T[] => [...items].reverse() }, ctx: { currentPlayer, turn: 3 } };
}

/** A tactic shuffle context (reverses). */
const SHUFFLE_CONTEXT = { random: { Shuffle: <T,>(items: T[]): T[] => [...items].reverse() } };

/** The log lines of a state, joined for substring checks. */
function logText(gameState: LegendaryGameState): string {
  return gameState.messages.map((message) => (typeof message === 'string' ? message : JSON.stringify(message))).join('\n');
}

/**
 * Dispatches a tactic after removing it from the tactics deck and awarding it (the core's order).
 *
 * @param gameState - The state.
 * @param tacticId - The defeated tactic.
 * @param events - Optional seat-choice events.
 */
function defeatTactic(gameState: LegendaryGameState, tacticId: CardExtId, events?: never): void {
  gameState.mastermind = {
    ...gameState.mastermind,
    tacticsDeck: gameState.mastermind.tacticsDeck.filter((cardId) => cardId !== tacticId),
  };
  gameState.playerZones['0']!.victory.push(tacticId);
  dispatchTacticOnFight(gameState, { currentPlayer: '0', turn: 3 }, tacticId, SHUFFLE_CONTEXT, events);
}

// ---------------------------------------------------------------------------
// Predicates
// ---------------------------------------------------------------------------

describe('WP-769 Killmonger predicates', () => {
  it('identifies him; the lock follows his Attack, Wounds included', () => {
    const gameState = makeState();
    assert.equal(isKillmonger(gameState), true);
    assert.equal(isKillmonger(makeState('test-mastermind-001')), false);
    assert.equal(isKillmongerAttackLocked(gameState, '0'), true);
    setWounds(gameState, 4);
    assert.equal(isKillmongerAttackLocked(gameState, '0'), true, 'Attack 1');
    setWounds(gameState, 5);
    assert.equal(isKillmongerAttackLocked(gameState, '0'), false, 'Attack 0');
    assert.equal(isKillmongerAttackLocked(makeState('test-mastermind-001'), '0'), false);
  });

  it('canWoundMastermind needs Killmonger, a Tactic or the Final Blow, Attack > 0 and a Wound', () => {
    assert.equal(canWoundMastermind(makeState(), '0'), true);
    assert.equal(canWoundMastermind(makeState('test-mastermind-001'), '0'), false);
    const atZero = makeState();
    setWounds(atZero, 5);
    assert.equal(canWoundMastermind(atZero, '0'), false);
    const noWound = makeState();
    noWound.piles = { ...noWound.piles, wounds: [] };
    assert.equal(canWoundMastermind(noWound, '0'), false);
    noWound.ko = [WOUND_EXT_ID];
    assert.equal(canWoundMastermind(noWound, '0'), true, 'a KO-pile Wound');
    const vanquished = makeState();
    vanquished.mastermind = { ...vanquished.mastermind, tacticsDeck: [] };
    assert.equal(canWoundMastermind(vanquished, '0'), false);
    vanquished.finalBlow = true;
    vanquished.mastermind = { ...vanquished.mastermind, tacticsDefeated: [SCAR], finalBlowPending: true };
    assert.equal(canWoundMastermind(vanquished, '0'), true, 'Final Blow pending');
    assert.equal(isKillmongerLockShown(vanquished, '0'), true);
  });
});

// ---------------------------------------------------------------------------
// fightMastermind
// ---------------------------------------------------------------------------

describe('WP-769 fightMastermind against Killmonger', () => {
  it('T1: a plain fight changes nothing while his Attack is 5, 4 or 1, with or without Excessive Violence', () => {
    for (const woundCount of [0, 1, 4]) {
      for (const useExcessiveViolence of [false, true]) {
        const gameState = makeState();
        if (woundCount > 0) {
          setWounds(gameState, woundCount);
        }
        const before = structuredClone(gameState);
        fightMastermind(makeMockMoveContext(gameState), { useExcessiveViolence });
        assert.deepStrictEqual(gameState, before, `wounds ${String(woundCount)} EV ${String(useExcessiveViolence)}`);
      }
    }
  });

  it('T1 + T5: at Attack 0 he is fought for 0, no Recruit, and his Wounds return to the stack bottom after the Fight', () => {
    const gameState = makeState();
    gameState.mastermind = { ...gameState.mastermind, tacticsDeck: [ALTAR, SCAR] };
    setWounds(gameState, 5);
    const stackBefore = [...gameState.piles.wounds];
    const economyBefore = { ...gameState.turnEconomy };
    fightMastermind(makeMockMoveContext(gameState), {});
    assert.deepEqual(gameState.mastermind.tacticsDefeated, [ALTAR]);
    assert.equal(gameState.turnEconomy.attack, economyBefore.attack, 'spent 0');
    assert.equal(gameState.turnEconomy.recruit, economyBefore.recruit, 'no +1 Recruit');
    assert.equal('wounds' in gameState.mastermind, false, 'deleted, never []');
    assert.deepEqual(gameState.piles.wounds, [...stackBefore, ...Array<CardExtId>(5).fill(WOUND_EXT_ID)]);
    assert.match(logText(gameState), /Killmonger's 5 Wound\(s\) returned to the Wound Stack\./);
    assert.equal(gameState.hasActedThisTurn, true);
  });

  it('T5: Silent Sniper\'s free defeat (the shared core) returns the Wounds too; an unwounded defeat logs no return', () => {
    const gameState = makeState();
    setWounds(gameState, 2);
    defeatMastermindTacticCore(gameState, { currentPlayer: '0' }, SHUFFLE_CONTEXT);
    assert.equal('wounds' in gameState.mastermind, false);
    const unwounded = makeState('test-mastermind-001');
    defeatMastermindTacticCore(unwounded, { currentPlayer: '0' }, SHUFFLE_CONTEXT);
    assert.equal('wounds' in unwounded.mastermind, false);
    assert.doesNotMatch(logText(unwounded), /returned to the Wound Stack/);
  });

  it('T5: Rite of Challenge hands out Wounds before the return; the rest return', () => {
    const gameState = makeState();
    gameState.mastermind = { ...gameState.mastermind, tacticsDeck: [RITE, SCAR] };
    setWounds(gameState, 5);
    const stackBefore = gameState.piles.wounds.length;
    fightMastermind(makeMockMoveContext(gameState), {});
    assert.equal(gameState.playerZones['1']!.discard.filter((cardId) => cardId === WOUND_EXT_ID).length, 1);
    assert.equal(gameState.playerZones['0']!.discard.includes(WOUND_EXT_ID), false, 'the defeater holds Rite');
    assert.equal(gameState.piles.wounds.length, stackBefore + 4, 'the other four return');
    const text = logText(gameState);
    assert.ok(text.indexOf('Rite of Challenge') < text.indexOf('returned to the Wound Stack'), 'Rite first');
  });

  it('T7: Final Blow — the 4th tactic returns the Wounds and latches; wounding is legal again; at 0 the Final Blow awards him', () => {
    const gameState = makeState();
    gameState.finalBlow = true;
    gameState.mastermind = { ...gameState.mastermind, tacticsDeck: [ALTAR] };
    setWounds(gameState, 5);
    fightMastermind(makeMockMoveContext(gameState), {});
    assert.equal(gameState.mastermind.finalBlowPending, true);
    assert.equal('wounds' in gameState.mastermind, false);
    assert.equal(canWoundMastermind(gameState, '0'), true);
    for (let woundIndex = 0; woundIndex < 5; woundIndex++) {
      woundMastermind(makeMockMoveContext(gameState));
    }
    assert.equal(gameState.mastermind.wounds?.length, 5);
    fightMastermind(makeMockMoveContext(gameState), {});
    assert.equal(gameState.playerZones['0']!.victory.includes(KILLMONGER_BASE), true, 'the Mastermind card is awarded');
    assert.equal(canWoundMastermind(gameState, '0'), false, 'no more wounding after the award');
  });

  it('T10: Negablast Grenades\' +3 Attack can\'t pay the Excessive Violence extra; cost + 1 before the fight still can', () => {
    const negablast = 'core-mastermind-red-skull-negablast-grenades' as CardExtId;
    for (const [attack, isExpectedEv] of [[5, false], [6, true]] as const) {
      const gameState = makeState('core/red-skull');
      gameState.mastermind = { ...gameState.mastermind, tacticsDeck: [negablast, SCAR] };
      gameState.turnEconomy = { ...gameState.turnEconomy, attack };
      fightMastermind(makeMockMoveContext(gameState), { useExcessiveViolence: true });
      assert.deepEqual(gameState.mastermind.tacticsDefeated, [negablast], `attack ${String(attack)}`);
      assert.equal(gameState.turnEconomy.excessiveViolenceUsedThisTurn === true, isExpectedEv, `attack ${String(attack)}`);
    }
  });
});

// ---------------------------------------------------------------------------
// Master Strike
// ---------------------------------------------------------------------------

describe('WP-769 Killmonger Master Strike', () => {
  /**
   * Gives a player a hand of Heroes with the given classes.
   *
   * @param gameState - The state.
   * @param playerId - The player.
   * @param classes - One entry per card: a class, or a [class, class2] dual-class pair.
   */
  function giveClassHand(gameState: LegendaryGameState, playerId: string, classes: (string | [string, string])[]): void {
    const hand: CardExtId[] = [];
    classes.forEach((heroClass, cardIndex) => {
      const cardId = `hero-${playerId}-${String(cardIndex)}` as CardExtId;
      hand.push(cardId);
      if (Array.isArray(heroClass)) {
        gameState.cardTraits[cardId] = { heroClass: heroClass[0], heroClass2: heroClass[1], team: null } as never;
      } else {
        gameState.cardTraits[cardId] = { heroClass, team: null } as never;
      }
    });
    gameState.playerZones[playerId]!.hand = hand;
  }

  it('T8: 4 classes (a dual-class card counts both) are unaffected with a strikeBlocked event; no hollow, no capture', () => {
    const gameState = makeState();
    setWounds(gameState, 2);
    giveClassHand(gameState, '0', ['tech', 'covert', ['strength', 'ranged']]);
    giveClassHand(gameState, '1', ['tech', 'covert', 'strength', 'instinct']);
    mastermindStrikeHandler(gameState, strikeContext('0'), { cardId: 'strike-00' }, DEFAULT_IMPLEMENTATION_MAP);
    assert.equal(gameState.mastermind.wounds?.length, 2, 'nobody took a Wound');
    assert.equal(gameState.notableEvents.filter((event) => event.type === 'strikeBlocked').length, 2);
    assert.equal(gameState.diagnostics?.hollowEffects?.length ?? 0, 0);
    assert.deepEqual(gameState.mastermind.attachedBystanders, []);
  });

  it('T8: otherwise players gain his Wounds in turn order (current player first) until they run out, then discard to 4', () => {
    const gameState = makeState();
    setWounds(gameState, 1);
    giveClassHand(gameState, '0', ['tech', 'tech', 'tech', 'tech', 'tech', 'tech']);
    giveClassHand(gameState, '1', ['tech', 'tech', 'tech', 'tech', 'tech', 'tech']);
    const stackBefore = gameState.piles.wounds.length;
    mastermindStrikeHandler(gameState, strikeContext('1'), { cardId: 'strike-00' }, DEFAULT_IMPLEMENTATION_MAP);
    assert.equal(gameState.playerZones['1']!.discard.includes(WOUND_EXT_ID), true, 'the current player first');
    assert.equal('wounds' in gameState.mastermind, false);
    assert.equal(gameState.piles.wounds.length, stackBefore, 'his Wound, not the stack');
    // why: seat 0 (not current) could do neither → auto-discards hand.length − 4 = 2.
    assert.equal(gameState.playerZones['0']!.hand.length, 4);
    assert.equal(gameState.playerZones['0']!.discard.length, 2);
  });

  it('T8: the current player who can do neither parks discard-to-limit 4; a hand of 4 or fewer discards nothing', () => {
    const gameState = makeState();
    giveClassHand(gameState, '0', ['tech', 'tech', 'tech', 'tech', 'tech']);
    giveClassHand(gameState, '1', ['tech', 'tech', 'tech']);
    mastermindStrikeHandler(gameState, strikeContext('0'), { cardId: 'strike-00' }, DEFAULT_IMPLEMENTATION_MAP);
    assert.deepEqual(gameState.pendingDiscardChoices, [{ choiceType: 'discard-to-limit', playerID: '0', limit: 4 }]);
    assert.equal(gameState.playerZones['1']!.hand.length, 3);
    assert.match(logText(gameState), /Player 1 could do neither and already has 3 card\(s\) in hand/);
  });

  it('T8: a Diving Block holder gets the interception and the log says "would gain"', () => {
    const gameState = makeState();
    setWounds(gameState, 1);
    const divingBlock = 'core-hero-captain-america-diving-block-00' as CardExtId;
    gameState.heroAbilityHooks = [
      ...gameState.heroAbilityHooks,
      { cardId: divingBlock, timing: 'onPlay', keywords: ['diving-block'] } as never,
    ];
    giveClassHand(gameState, '0', ['tech', 'tech', 'tech', 'tech']);
    gameState.playerZones['0']!.hand.push(divingBlock);
    giveClassHand(gameState, '1', ['tech', 'covert', 'strength', 'instinct']);
    mastermindStrikeHandler(gameState, strikeContext('0'), { cardId: 'strike-00' }, DEFAULT_IMPLEMENTATION_MAP);
    assert.equal(gameState.pendingDivingBlockWounds?.length, 1);
    assert.match(logText(gameState), /would gain a Wound — Diving Block can prevent it from Killmonger/);
  });
});

// ---------------------------------------------------------------------------
// Tactics
// ---------------------------------------------------------------------------

describe('WP-769 Killmonger tactics', () => {
  it('T9 Scar: +1 Recruit per non-Henchman Villain only; 0 is a neutral line', () => {
    for (const [victory, expected] of [
      [[], 0],
      [[VILLAIN_A], 1],
      [[VILLAIN_A, VILLAIN_B, VILLAIN_A, HENCHMAN_A, BYSTANDER_A], 3],
    ] as const) {
      const gameState = makeState();
      gameState.playerZones['0']!.victory = [...victory];
      const recruitBefore = gameState.turnEconomy.recruit;
      defeatTactic(gameState, SCAR);
      assert.equal(gameState.turnEconomy.recruit - recruitBefore, expected);
    }
  });

  it('T9 Rite: Wounds go in turn order to seats with no Killmonger tactic, while any remain', () => {
    const gameState = makeState();
    setWounds(gameState, 1);
    defeatTactic(gameState, RITE);
    assert.equal(gameState.playerZones['1']!.discard.includes(WOUND_EXT_ID), true);
    assert.equal('wounds' in gameState.mastermind, false);
    const noWounds = makeState();
    defeatTactic(noWounds, RITE);
    assert.match(logText(noWounds), /no Wound is left on Killmonger/);
    const holder = makeState();
    setWounds(holder, 2);
    holder.playerZones['1']!.victory = [SCAR];
    defeatTactic(holder, RITE);
    assert.equal(holder.mastermind.wounds?.length, 2, 'seat 1 holds a Killmonger tactic');
  });

  it('T9 Waterfall: draws 2 (counted), parks the discard for the other seats; the draw lock skips the draw only', () => {
    const gameState = makeState();
    gameState.playerZones['0']!.deck = ['d1', 'd2', 'd3'] as CardExtId[];
    gameState.playerZones['1']!.hand = ['h1', 'h2'] as CardExtId[];
    const handBefore = gameState.playerZones['0']!.hand.length;
    const drawnBefore = gameState.turnEconomy.cardsDrawn;
    defeatTactic(gameState, WATERFALL);
    assert.equal(gameState.playerZones['0']!.hand.length, handBefore + 2);
    assert.equal(gameState.turnEconomy.cardsDrawn, drawnBefore + 2);
    assert.equal(gameState.pendingSeatChoice?.kind, 'killmonger-waterfall-discard');
    assert.deepEqual(gameState.pendingSeatChoice?.addressedSeats, ['1']);

    const oneCard = makeState();
    oneCard.playerZones['0']!.deck = ['d1'] as CardExtId[];
    oneCard.playerZones['0']!.discard = [];
    defeatTactic(oneCard, WATERFALL);
    assert.match(logText(oneCard), /Player 0 drew 1 card\(s\) \(Throw from the Waterfall\)/);

    const locked = makeState();
    locked.turnEconomy = { ...locked.turnEconomy, drawsLocked: true };
    locked.playerZones['0']!.deck = ['d1', 'd2'] as CardExtId[];
    locked.playerZones['1']!.hand = ['h1'] as CardExtId[];
    const lockedHand = locked.playerZones['0']!.hand.length;
    defeatTactic(locked, WATERFALL);
    assert.equal(locked.playerZones['0']!.hand.length, lockedHand, 'no draw');
    assert.match(logText(locked), /can't draw 2 card\(s\) — no more draws this turn/);
    assert.equal(locked.pendingSeatChoice?.kind, 'killmonger-waterfall-discard', 'the discard still happens');
  });

  it('T9 Altar: a hollow only when the left / right player (solo: the defeater) has a non-Henchman Villain', () => {
    const gameState = makeState();
    gameState.playerZones['1']!.victory = [VILLAIN_A];
    defeatTactic(gameState, ALTAR);
    const records = gameState.diagnostics?.hollowEffects ?? [];
    assert.equal(records.length, 1);
    assert.equal(records[0]!.cardId, ALTAR);
    assert.equal(records[0]!.cardType, 'mastermind');
    assert.equal(records[0]!.mechanic, 'villain-wound');
    assert.equal(records[0]!.reason, 'unsupported-keyword');
    assert.equal(records[0]!.turn, 3);

    const unreachable = makeState();
    unreachable.playerZones['1']!.victory = [HENCHMAN_A];
    unreachable.playerZones['0']!.victory = [VILLAIN_A];
    defeatTactic(unreachable, ALTAR);
    assert.equal(unreachable.diagnostics?.hollowEffects?.length ?? 0, 0, 'the defeater does not choose with another player');
  });
});

// ---------------------------------------------------------------------------
// Bot intents
// ---------------------------------------------------------------------------

describe('WP-769 Killmonger bot intents', () => {
  it('T12: while locked no fightMastermind; one woundMastermind that commits; at 0 the plain fight', () => {
    const gameState = makeState();
    gameState.turnEconomy = { ...gameState.turnEconomy, attack: 15 };
    for (let woundIndex = 0; woundIndex < 5; woundIndex++) {
      const moves = getLegalMoves(gameState, LEGAL_MOVES_CONTEXT);
      assert.equal(moves.some((move) => move.name === 'fightMastermind'), false, `locked at wound ${String(woundIndex)}`);
      const wounds = moves.filter((move) => move.name === 'woundMastermind');
      assert.deepEqual(wounds, [{ name: 'woundMastermind', args: {} }]);
      // why: the emitted intent commits when dispatched (D-24364 mirror).
      const before = gameState.mastermind.wounds?.length ?? 0;
      woundMastermind(makeMockMoveContext(gameState));
      assert.equal(gameState.mastermind.wounds?.length, before + 1);
    }
    const atZero = getLegalMoves(gameState, LEGAL_MOVES_CONTEXT);
    assert.equal(atZero.some((move) => move.name === 'woundMastermind'), false);
    assert.deepEqual(atZero.filter((move) => move.name === 'fightMastermind'), [{ name: 'fightMastermind', args: {} }]);
  });

  it('T12: short attack → none; a pending Final Blow → none; another Mastermind unchanged', () => {
    const short = makeState();
    short.turnEconomy = { ...short.turnEconomy, attack: 4 };
    assert.equal(getLegalMoves(short, LEGAL_MOVES_CONTEXT).some((move) => move.name === 'woundMastermind'), false);
    const finalBlow = makeState();
    finalBlow.finalBlow = true;
    finalBlow.mastermind = { ...finalBlow.mastermind, tacticsDeck: [], tacticsDefeated: [SCAR], finalBlowPending: true };
    assert.equal(canWoundMastermind(finalBlow, '0'), true, 'the move would accept it');
    assert.equal(getLegalMoves(finalBlow, LEGAL_MOVES_CONTEXT).some((move) => move.name === 'woundMastermind'), false);
    const other = makeState('test-mastermind-001');
    other.cardStats[KILLMONGER_BASE] = makeCardStatEntry({ fightCost: 5 });
    const plain = getLegalMoves(other, LEGAL_MOVES_CONTEXT);
    assert.equal(plain.some((move) => move.name === 'woundMastermind'), false);
    assert.deepEqual(plain.filter((move) => move.name === 'fightMastermind'), [{ name: 'fightMastermind', args: {} }]);
  });

  it('T12: never takes the last Wound-Stack Wound under Legacy Virus, unless the KO pile has one', () => {
    const gameState = makeState();
    gameState.selection = { ...gameState.selection, schemeId: 'core/legacy-virus-the' };
    gameState.piles = { ...gameState.piles, wounds: [WOUND_EXT_ID] };
    assert.equal(getLegalMoves(gameState, LEGAL_MOVES_CONTEXT).some((move) => move.name === 'woundMastermind'), false);
    gameState.ko = [WOUND_EXT_ID];
    assert.equal(getLegalMoves(gameState, LEGAL_MOVES_CONTEXT).some((move) => move.name === 'woundMastermind'), true);
    const twoLeft = makeState();
    twoLeft.selection = { ...twoLeft.selection, schemeId: 'core/legacy-virus-the' };
    twoLeft.piles = { ...twoLeft.piles, wounds: [WOUND_EXT_ID, WOUND_EXT_ID] };
    assert.equal(getLegalMoves(twoLeft, LEGAL_MOVES_CONTEXT).some((move) => move.name === 'woundMastermind'), true);
  });
});

// ---------------------------------------------------------------------------
// Seeded simulation
// ---------------------------------------------------------------------------

/**
 * A mock registry whose bkpt set carries Killmonger (printed Attack 5) and his four tactics,
 * so setup builds his fight cost.
 *
 * @returns The registry reader.
 */
function createKillmongerRegistry(): CardRegistryReader {
  const killmongerSet = {
    abbr: 'bkpt',
    masterminds: [
      {
        name: 'Killmonger',
        slug: 'killmonger',
        alwaysLeads: [],
        vp: 4,
        cards: [
          { name: 'Killmonger', slug: 'killmonger', tactic: false, vAttack: '5', abilities: [] },
          { name: 'A Scar for Every Kill', slug: 'a-scar-for-every-kill', tactic: true, vAttack: 5, abilities: [] },
          { name: 'Rite of Challenge', slug: 'rite-of-challenge', tactic: true, vAttack: 5, abilities: [] },
          { name: 'Throw from the Waterfall', slug: 'throw-from-the-waterfall', tactic: true, vAttack: 5, abilities: [] },
          { name: 'Altar of Resurrection', slug: 'altar-of-resurrection', tactic: true, vAttack: 5, abilities: [] },
        ],
      },
    ],
    villains: [],
    henchmen: [],
    schemes: [],
    heroes: [],
  };
  return makeCardRegistryReader({
    getSet: (setAbbr: string) => (setAbbr === 'bkpt' ? killmongerSet : undefined),
  } as never);
}

describe('WP-769 seeded Killmonger simulation', () => {
  it('T12: a seeded 1-player competent simulation against Killmonger terminates', () => {
    const result = runSimulation(
      {
        games: 1,
        seed: 'wp769-killmonger',
        setupConfig: { ...createTestConfig(), mastermindId: KILLMONGER_MASTERMIND_ID },
        policies: [createCompetentHeuristicPolicy('wp769-p0')],
      },
      createKillmongerRegistry(),
    );
    assert.equal(result.gamesPlayed, 1);
  });
});
