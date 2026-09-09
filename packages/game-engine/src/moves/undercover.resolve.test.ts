/**
 * Tests for the Undercover mechanic (WP-678 / EC-715 / D-24494, supersedes D-24060).
 *
 * Covers the two source-shape handlers (via executeSingleEffect's real dispatch), the
 * resolveUndercoverChoice move + hasPendingUndercoverChoice predicate, and the block-all
 * guard. The undercover'd card lands in `victory` AND in the `undercover` tracker (worth 1 VP
 * — asserted here structurally; the VP is asserted in scoring.logic.test.ts). Uses node:test.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { executeSingleEffect } from '../hero/heroEffects.execute.js';
import { resolveUndercoverChoice, hasPendingUndercoverChoice } from './undercover.resolve.js';
import { makePlayerZones } from '../test/fixtureBuilders.js';
import { playCard } from './coreMoves.impl.js';

/** Minimal move context — the undercover handlers + resolve ignore ctx. */
function makeContext(G: LegendaryGameState, playerID: string): Parameters<typeof resolveUndercoverChoice>[0] {
  return { G, playerID, ctx: {}, events: {}, random: {}, log: {} } as unknown as Parameters<typeof resolveUndercoverChoice>[0];
}

/** Builds a minimal state: player "0" with the given hand + a shield-team cardTraits map. */
function makeState(hand: string[], officers: string[] = []): LegendaryGameState {
  return {
    playerZones: {
      '0': makePlayerZones({ hand: hand as CardExtId[], inPlay: ['coulson#0' as CardExtId] }),
    },
    piles: { bystanders: [], wounds: [], officers: officers as CardExtId[], sidekicks: [], horrors: [] },
    cardTraits: {
      'nick-fury#0': { team: 'shield', heroClass: 'tech' },
      'maria-hill#0': { team: 'shield', heroClass: 'covert' },
      'agent#0': { team: 'shield', heroClass: null },
      'spider-man#0': { team: 'spider-friends', heroClass: 'instinct' },
      'coulson#0': { team: 'shield', heroClass: 'covert' },
    },
    messages: [],
  } as unknown as LegendaryGameState;
}

describe('Undercover — officer-stack source (deterministic)', () => {
  it('sends the top Officer into the Victory Pile + tracker; empty stack is a no-op', () => {
    const gameState = makeState([], ['pile-shield-officer', 'pile-shield-officer']);
    executeSingleEffect(gameState, {} as never, '0', 'coulson#0' as CardExtId, { type: 'undercover-officer-stack' } as never);
    const zones = gameState.playerZones['0']!;
    assert.deepEqual(zones.victory, ['pile-shield-officer'], 'one officer moved to victory');
    assert.deepEqual(zones.undercover, ['pile-shield-officer'], 'recorded in the undercover tracker');
    assert.equal(gameState.piles.officers.length, 1, 'one officer removed from the stack');

    // empty stack → no-op
    const empty = makeState([], []);
    executeSingleEffect(empty, {} as never, '0', 'coulson#0' as CardExtId, { type: 'undercover-officer-stack' } as never);
    assert.deepEqual(empty.playerZones['0']!.victory, [], 'empty officer stack is a no-op');
    assert.deepEqual(empty.playerZones['0']!.undercover, [], 'no tracker entry on no-op');
  });
});

describe('Undercover — hand shield-hero source (0 / 1 / >=2 eligibility)', () => {
  it('0 eligible [team:shield] Heroes is a legal no-op', () => {
    const gameState = makeState(['spider-man#0']); // not shield
    executeSingleEffect(gameState, {} as never, '0', 'coulson#0' as CardExtId, { type: 'undercover-hand-shield-hero' } as never);
    assert.deepEqual(gameState.playerZones['0']!.victory, [], 'no shield Hero → no send');
    assert.deepEqual(gameState.playerZones['0']!.undercover, [], 'no tracker entry');
    assert.equal(hasPendingUndercoverChoice(gameState), false, 'no choice parked');
  });

  it('exactly 1 eligible auto-sends (no prompt)', () => {
    const gameState = makeState(['nick-fury#0', 'spider-man#0']);
    executeSingleEffect(gameState, {} as never, '0', 'coulson#0' as CardExtId, { type: 'undercover-hand-shield-hero' } as never);
    const zones = gameState.playerZones['0']!;
    assert.deepEqual(zones.victory, ['nick-fury#0'], 'the sole shield Hero auto-sent to victory');
    assert.deepEqual(zones.undercover, ['nick-fury#0'], 'recorded in the tracker');
    assert.deepEqual(zones.hand, ['spider-man#0'], 'removed from hand; non-shield card untouched');
    assert.equal(hasPendingUndercoverChoice(gameState), false, 'no choice parked for a single candidate');
  });

  it('>=2 eligible parks a PendingUndercoverChoice with the eligible set (no send yet)', () => {
    const gameState = makeState(['nick-fury#0', 'maria-hill#0', 'spider-man#0']);
    executeSingleEffect(gameState, {} as never, '0', 'coulson#0' as CardExtId, { type: 'undercover-hand-shield-hero' } as never);
    assert.equal(hasPendingUndercoverChoice(gameState), true, 'a choice is parked');
    const front = gameState.pendingUndercoverChoice![0]!;
    assert.deepEqual(front.eligibleTargets, ['nick-fury#0', 'maria-hill#0'], 'both shield Heroes eligible; non-shield excluded');
    assert.deepEqual(gameState.playerZones['0']!.victory, [], 'nothing sent until resolved');
  });
});

describe('resolveUndercoverChoice', () => {
  function parkedState(): LegendaryGameState {
    const gameState = makeState(['nick-fury#0', 'maria-hill#0']);
    executeSingleEffect(gameState, {} as never, '0', 'coulson#0' as CardExtId, { type: 'undercover-hand-shield-hero' } as never);
    return gameState;
  }

  it('sends the chosen eligible target and pops the queue', () => {
    const gameState = parkedState();
    resolveUndercoverChoice(makeContext(gameState, '0'), { targetExtId: 'maria-hill#0' as CardExtId });
    const zones = gameState.playerZones['0']!;
    assert.deepEqual(zones.victory, ['maria-hill#0'], 'the chosen Hero went to victory');
    assert.deepEqual(zones.undercover, ['maria-hill#0'], 'recorded in the tracker');
    assert.deepEqual(zones.hand, ['nick-fury#0'], 'the unchosen Hero stays in hand');
    assert.equal(gameState.pendingUndercoverChoice!.length, 0, 'the front entry is popped');
  });

  it('an ineligible target is a silent no-op with the queue intact', () => {
    const gameState = parkedState();
    resolveUndercoverChoice(makeContext(gameState, '0'), { targetExtId: 'spider-man#0' as CardExtId });
    assert.deepEqual(gameState.playerZones['0']!.victory, [], 'no send for an ineligible target');
    assert.equal(gameState.pendingUndercoverChoice!.length, 1, 'the queue is untouched');
  });

  it('a wrong-player resolution is a silent no-op with the queue intact', () => {
    const gameState = parkedState();
    resolveUndercoverChoice(makeContext(gameState, '1'), { targetExtId: 'nick-fury#0' as CardExtId });
    assert.deepEqual(gameState.playerZones['0']!.victory, []);
    assert.equal(gameState.pendingUndercoverChoice!.length, 1, 'the queue is untouched');
  });
});

describe('hasPendingUndercoverChoice + block-all', () => {
  it('is false for undefined/empty, true for a non-empty queue', () => {
    assert.equal(hasPendingUndercoverChoice({} as LegendaryGameState), false);
    assert.equal(hasPendingUndercoverChoice({ pendingUndercoverChoice: [] } as unknown as LegendaryGameState), false);
    const parked = makeState(['nick-fury#0', 'maria-hill#0']);
    executeSingleEffect(parked, {} as never, '0', 'coulson#0' as CardExtId, { type: 'undercover-hand-shield-hero' } as never);
    assert.equal(hasPendingUndercoverChoice(parked), true);
  });

  it('block-all: playCard is a no-op while an Undercover pick is pending', () => {
    const gameState = makeState(['nick-fury#0', 'maria-hill#0']);
    executeSingleEffect(gameState, {} as never, '0', 'coulson#0' as CardExtId, { type: 'undercover-hand-shield-hero' } as never);
    // seed a playable card + a turn economy so playCard would otherwise act
    gameState.playerZones['0']!.hand = [...gameState.playerZones['0']!.hand, 'extra#0' as CardExtId];
    gameState.currentStage = 'main';
    gameState.turnEconomy = { attack: 0, recruit: 0, spentAttack: 0, spentRecruit: 0, piercing: 0, woundsDrawn: 0, cardsDrawn: 0 } as never;
    gameState.cardStats = { 'extra#0': { attack: 1, recruit: 0, cost: 0, fightCost: 0 } } as unknown as LegendaryGameState['cardStats'];
    const handBefore = [...gameState.playerZones['0']!.hand];
    playCard(makeContext(gameState, '0') as never, { cardId: 'extra#0' as CardExtId });
    assert.deepEqual(gameState.playerZones['0']!.hand, handBefore, 'playCard blocked — hand unchanged while the pick is pending');
  });
});
