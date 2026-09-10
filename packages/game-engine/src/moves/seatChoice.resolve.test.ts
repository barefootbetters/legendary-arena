/**
 * Tests for the non-active / multi-seat pending-choice capability (WP-684 / EC-721 / D-24501).
 *
 * Covers: a NON-ACTIVE seat can resolve a choice addressed to it while the active player is
 * blocked; the active player CANNOT resolve another seat's choice; a SIMULTANEOUS MULTI-SEAT
 * choice awaits all seats then applies atomically + deterministically (replay-identical apply
 * order regardless of submission order); the deterministic disconnect/timeout default; the
 * boardgame.io stage-ride admission map; the getLegalMoves short-circuit; and the strict-superset
 * regression pin (existing active-only pending choices are untouched). node:test + node:assert.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveSeatChoice,
  hasPendingSeatChoice,
  isSeatAddressed,
  hasSeatSubmitted,
  getOutstandingSeats,
  allSeatsSubmitted,
  applySeatChoiceTimeoutDefault,
  buildSeatChoiceActivePlayersValue,
  admitSeatsForPendingSeatChoice,
  parkSeatChoice,
  SEAT_CHOICE_STAGE,
} from './seatChoice.resolve.js';
import { hasPendingCountScaledChoice } from './countScaledChoice.resolve.js';
import { drawCards } from './coreMoves.impl.js';
import { getLegalMoves } from '../simulation/ai.legalMoves.js';
import type { LegendaryGameState, PendingSeatChoice } from '../types.js';

/** Minimal move context — the seat-choice move reads only G + playerID. */
function makeContext(
  G: LegendaryGameState,
  playerID: string,
): Parameters<typeof resolveSeatChoice>[0] {
  return { G, playerID, ctx: {}, events: {}, random: {}, log: {} } as unknown as Parameters<typeof resolveSeatChoice>[0];
}

/** A minimal G carrying just the fields the seat-choice paths touch. */
function makeState(choice: PendingSeatChoice | undefined): LegendaryGameState {
  return {
    playerZones: {
      '0': { deck: ['c0#0'], hand: [], discard: [], victory: [], inPlay: [] },
      '1': { deck: ['c1#0'], hand: [], discard: [], victory: [], inPlay: [] },
      '2': { deck: ['c2#0'], hand: [], discard: [], victory: [], inPlay: [] },
    },
    currentStage: 'main',
    hasDrawnThisTurn: false,
    turnEconomy: { attack: 0, recruit: 0, spentAttack: 0, spentRecruit: 0, piercing: 0, woundsDrawn: 0, cardsDrawn: 0 },
    messages: [],
    ...(choice !== undefined ? { pendingSeatChoice: choice } : {}),
  } as unknown as LegendaryGameState;
}

/** A single-seat choice addressed to one (possibly non-active) seat. */
function singleSeatChoice(seat: string): PendingSeatChoice {
  return {
    kind: 'generic',
    addressedSeats: [seat],
    seatPrompts: { [seat]: { options: [{ label: 'Accept' }, { label: 'Decline' }] } },
    submissions: {},
    defaultOptionIndex: 1,
  };
}

/** A simultaneous multi-seat choice addressed to every listed seat. */
function multiSeatChoice(seats: string[]): PendingSeatChoice {
  const seatPrompts: Record<string, { options: { label: string }[] }> = {};
  for (const seat of seats) {
    seatPrompts[seat] = { options: [{ label: `${seat}-A` }, { label: `${seat}-B` }] };
  }
  return {
    kind: 'generic',
    addressedSeats: [...seats],
    seatPrompts,
    submissions: {},
    defaultOptionIndex: 0,
  };
}

describe('hasPendingSeatChoice / predicates', () => {
  it('is false when no seat choice is open, true when one is', () => {
    assert.equal(hasPendingSeatChoice(makeState(undefined)), false);
    assert.equal(hasPendingSeatChoice(makeState(singleSeatChoice('1'))), true);
  });

  it('isSeatAddressed / hasSeatSubmitted / getOutstandingSeats / allSeatsSubmitted', () => {
    const choice = multiSeatChoice(['0', '1', '2']);
    assert.equal(isSeatAddressed(choice, '1'), true);
    assert.equal(isSeatAddressed(choice, '3'), false);
    assert.equal(hasSeatSubmitted(choice, '1'), false);
    choice.submissions['1'] = { optionIndex: 0 };
    assert.equal(hasSeatSubmitted(choice, '1'), true);
    assert.deepEqual(getOutstandingSeats(choice), ['0', '2']);
    assert.equal(allSeatsSubmitted(choice), false);
    choice.submissions['0'] = { optionIndex: 0 };
    choice.submissions['2'] = { optionIndex: 1 };
    assert.equal(allSeatsSubmitted(choice), true);
  });
});

describe('non-active seat resolve (single seat)', () => {
  it('the active player CANNOT resolve a choice addressed only to a non-active seat', () => {
    // Active player is '0'; the choice is addressed to non-active seat '1'.
    const gameState = makeState(singleSeatChoice('1'));
    resolveSeatChoice(makeContext(gameState, '0'), { optionIndex: 0 });
    // The active player's submission is rejected — the choice stays open, unresolved.
    assert.equal(hasPendingSeatChoice(gameState), true, 'choice must stay open');
    assert.equal(hasSeatSubmitted(gameState.pendingSeatChoice!, '0'), false);
    assert.equal(gameState.messages.length, 0, 'nothing applied');
  });

  it('the addressed NON-ACTIVE seat CAN resolve, applying + clearing the choice', () => {
    const gameState = makeState(singleSeatChoice('1'));
    resolveSeatChoice(makeContext(gameState, '1'), { optionIndex: 0 });
    assert.equal(hasPendingSeatChoice(gameState), false, 'choice cleared once fully resolved');
    assert.equal(gameState.messages.length, 1, 'exactly one seat applied');
    assert.match(gameState.messages[0]!.text, /Seat 1 resolved generic choice: Accept/);
  });

  it('the active player is BLOCKED (block-all) while a non-active seat choice is open', () => {
    const gameState = makeState(singleSeatChoice('1'));
    gameState.currentStage = 'main';
    drawCards(makeContext(gameState, '0') as never, { count: 1 } as never);
    // block-all: the active player's drawCards is a no-op while the seat choice is pending.
    assert.equal(gameState.hasDrawnThisTurn, false, 'drawCards must be blocked');
    assert.equal(gameState.playerZones['0']!.hand.length, 0, 'no card drawn');
  });

  it('an out-of-range option index / a double submission is a silent no-op', () => {
    const gameState = makeState(singleSeatChoice('1'));
    resolveSeatChoice(makeContext(gameState, '1'), { optionIndex: 99 });
    assert.equal(hasPendingSeatChoice(gameState), true, 'bad index leaves the choice open');
    resolveSeatChoice(makeContext(gameState, '1'), { optionIndex: 0 });
    assert.equal(hasPendingSeatChoice(gameState), false, 'valid index resolves');
  });
});

describe('simultaneous multi-seat resolve — await-all + atomic + determinism', () => {
  it('blocks until EVERY addressed seat submits, then applies atomically', () => {
    const gameState = makeState(multiSeatChoice(['0', '1', '2']));
    resolveSeatChoice(makeContext(gameState, '2'), { optionIndex: 0 });
    assert.equal(hasPendingSeatChoice(gameState), true, 'still open after 1 of 3');
    assert.equal(gameState.messages.length, 0, 'nothing applied yet (atomic)');
    resolveSeatChoice(makeContext(gameState, '0'), { optionIndex: 1 });
    assert.equal(hasPendingSeatChoice(gameState), true, 'still open after 2 of 3');
    assert.equal(gameState.messages.length, 0, 'still nothing applied (atomic)');
    resolveSeatChoice(makeContext(gameState, '1'), { optionIndex: 0 });
    assert.equal(hasPendingSeatChoice(gameState), false, 'cleared once all 3 submit');
    assert.equal(gameState.messages.length, 3, 'all three applied at once');
  });

  it('applies in ASCENDING seat order regardless of submission order (replay-identical)', () => {
    // First run: submit 2, 0, 1.
    const stateA = makeState(multiSeatChoice(['0', '1', '2']));
    resolveSeatChoice(makeContext(stateA, '2'), { optionIndex: 0 });
    resolveSeatChoice(makeContext(stateA, '0'), { optionIndex: 0 });
    resolveSeatChoice(makeContext(stateA, '1'), { optionIndex: 0 });
    // Second run: submit 1, 0, 2 (different order, same selections).
    const stateB = makeState(multiSeatChoice(['0', '1', '2']));
    resolveSeatChoice(makeContext(stateB, '1'), { optionIndex: 0 });
    resolveSeatChoice(makeContext(stateB, '0'), { optionIndex: 0 });
    resolveSeatChoice(makeContext(stateB, '2'), { optionIndex: 0 });
    const textsA = stateA.messages.map((entry) => entry.text);
    const textsB = stateB.messages.map((entry) => entry.text);
    assert.deepEqual(textsA, textsB, 'apply order is submission-order-independent');
    assert.deepEqual(textsA, [
      'Seat 0 resolved generic choice: 0-A',
      'Seat 1 resolved generic choice: 1-A',
      'Seat 2 resolved generic choice: 2-A',
    ]);
  });
});

describe('deterministic disconnect/timeout default', () => {
  it('resolves an unsubmitted seat with defaultOptionIndex and completes atomically', () => {
    const gameState = makeState(multiSeatChoice(['0', '1']));
    resolveSeatChoice(makeContext(gameState, '0'), { optionIndex: 1 });
    assert.equal(hasPendingSeatChoice(gameState), true, 'still open — seat 1 outstanding');
    // Seat 1 disconnects/times out: apply its deterministic default (index 0).
    applySeatChoiceTimeoutDefault(gameState, ['1']);
    assert.equal(hasPendingSeatChoice(gameState), false, 'default completes the choice');
    assert.deepEqual(gameState.messages.map((entry) => entry.text), [
      'Seat 0 resolved generic choice: 0-B',
      'Seat 1 resolved generic choice: 1-A',
    ]);
  });

  it('clamps the default into the seat option range', () => {
    const choice = singleSeatChoice('1');
    choice.defaultOptionIndex = 99; // out of range
    const gameState = makeState(choice);
    applySeatChoiceTimeoutDefault(gameState, ['1']);
    assert.equal(hasPendingSeatChoice(gameState), false);
    // clamped to the last option ('Decline').
    assert.match(gameState.messages[0]!.text, /Decline/);
  });
});

describe('boardgame.io stage-ride admission', () => {
  it('buildSeatChoiceActivePlayersValue puts every addressed seat in the resolve stage', () => {
    const value = buildSeatChoiceActivePlayersValue(multiSeatChoice(['1', '2']));
    assert.deepEqual(value, {
      '1': { stage: SEAT_CHOICE_STAGE, moveLimit: 1 },
      '2': { stage: SEAT_CHOICE_STAGE, moveLimit: 1 },
    });
  });

  it('admitSeatsForPendingSeatChoice calls setActivePlayers with revert:true', () => {
    let captured: unknown;
    const events = { setActivePlayers: (arg: unknown) => { captured = arg; } };
    admitSeatsForPendingSeatChoice(events, singleSeatChoice('1'));
    assert.deepEqual(captured, {
      value: { '1': { stage: SEAT_CHOICE_STAGE, moveLimit: 1 } },
      revert: true,
    });
  });

  it('admitSeatsForPendingSeatChoice is a no-op without setActivePlayers (unit context)', () => {
    // Must not throw when the context has no setActivePlayers (tests dispatch directly).
    admitSeatsForPendingSeatChoice(undefined, singleSeatChoice('1'));
    admitSeatsForPendingSeatChoice({}, singleSeatChoice('1'));
  });

  it('parkSeatChoice sets G.pendingSeatChoice and admits the seats', () => {
    const gameState = makeState(undefined);
    let captured: unknown;
    parkSeatChoice(gameState, { setActivePlayers: (arg: unknown) => { captured = arg; } }, singleSeatChoice('1'));
    assert.equal(hasPendingSeatChoice(gameState), true);
    assert.ok(captured !== undefined, 'seats admitted via the framework ride');
  });
});

describe('getLegalMoves short-circuit', () => {
  it('offers resolveSeatChoice to an addressed, outstanding seat (non-active enumerated)', () => {
    const gameState = makeState(singleSeatChoice('1'));
    const moves = getLegalMoves(gameState, { phase: 'play', turn: 1, currentPlayer: '1', numPlayers: 3 });
    assert.deepEqual(moves, [{ name: 'resolveSeatChoice', args: { optionIndex: 1 } }]);
  });

  it('offers NO legal move to the blocked active (non-addressed) player', () => {
    const gameState = makeState(singleSeatChoice('1'));
    const moves = getLegalMoves(gameState, { phase: 'play', turn: 1, currentPlayer: '0', numPlayers: 3 });
    assert.deepEqual(moves, [], 'active player is blocked while a non-active seat choice is open');
  });

  it('offers NO legal move to a seat that already submitted', () => {
    const choice = multiSeatChoice(['0', '1']);
    choice.submissions['1'] = { optionIndex: 0 };
    const gameState = makeState(choice);
    const moves = getLegalMoves(gameState, { phase: 'play', turn: 1, currentPlayer: '1', numPlayers: 2 });
    assert.deepEqual(moves, [], 'a submitted seat has no further move');
  });
});

describe('strict-superset regression pin', () => {
  it('does not fire for an existing active-only pending choice, and resolve is a no-op with none open', () => {
    // An existing active-only choice (count-scaled) is present; no seat choice is open.
    const gameState = makeState(undefined);
    (gameState as unknown as { pendingCountScaledChoice: unknown[] }).pendingCountScaledChoice = [{
      playerID: '0',
      cardId: 'x#0',
      options: [{ resource: 'attack', countSource: 'attack-icon-played-this-turn', magnitude: 1 }],
    }];
    assert.equal(hasPendingSeatChoice(gameState), false, 'seat-choice predicate ignores active-only choices');
    assert.equal(hasPendingCountScaledChoice(gameState), true, 'the active-only choice is untouched');
    // resolveSeatChoice with no seat choice open leaves G byte-identical.
    const before = JSON.stringify(gameState);
    resolveSeatChoice(makeContext(gameState, '0'), { optionIndex: 0 });
    assert.equal(JSON.stringify(gameState), before, 'resolveSeatChoice is a no-op when no seat choice is open');
  });
});
