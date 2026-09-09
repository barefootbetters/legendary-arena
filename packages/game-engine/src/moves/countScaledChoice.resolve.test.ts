/**
 * Tests for the resolveCountScaledChoice move + hasPendingCountScaledChoice predicate
 * (WP-675 / EC-712 / D-24490).
 *
 * Covers: the recruit option grants recruit (not attack) scaled by the recruit-icon count;
 * the attack option grants attack scaled by the attack-icon count; the triggering card is
 * excluded; an out-of-range index / wrong player / empty queue is a silent no-op with the
 * queue intact; the front entry is popped on success. Uses node:test + node:assert.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveCountScaledChoice, hasPendingCountScaledChoice } from './countScaledChoice.resolve.js';
import type { LegendaryGameState, PendingCountScaledChoice } from '../types.js';

/** Minimal move context — the per-count executors ignore ctx, so empty stubs suffice. */
function makeContext(G: LegendaryGameState, playerID: string): Parameters<typeof resolveCountScaledChoice>[0] {
  return { G, playerID, ctx: {}, events: {}, random: {}, log: {} } as unknown as Parameters<typeof resolveCountScaledChoice>[0];
}

/**
 * Builds a minimal state: player "0" with an in-play zone, an icon-presence cardStats map, a
 * fresh turn economy, and one parked count-scaled choice (recruit option 0, attack option 1).
 */
function makeState(): LegendaryGameState {
  const pending: PendingCountScaledChoice = {
    playerID: '0',
    cardId: 'symbiotic-adaptation#0',
    options: [
      { resource: 'recruit', countSource: 'recruit-icon-played-this-turn', magnitude: 1 },
      { resource: 'attack', countSource: 'attack-icon-played-this-turn', magnitude: 1 },
    ],
  };
  return {
    playerZones: {
      '0': {
        deck: [], hand: [], discard: [], victory: [],
        inPlay: ['recruiter-a#0', 'recruiter-b#0', 'attacker-a#0', 'symbiotic-adaptation#0'],
      },
    },
    cardStats: {
      'recruiter-a#0': { attack: 0, recruit: 2, cost: 3, fightCost: 0, fightCostMode: 'static', fightCostBase: 0, hasAttackIcon: false, hasRecruitIcon: true, isShieldOrHydra: false },
      'recruiter-b#0': { attack: 0, recruit: 1, cost: 2, fightCost: 0, fightCostMode: 'static', fightCostBase: 0, hasAttackIcon: false, hasRecruitIcon: true, isShieldOrHydra: false },
      'attacker-a#0': { attack: 3, recruit: 0, cost: 4, fightCost: 0, fightCostMode: 'static', fightCostBase: 0, hasAttackIcon: true, hasRecruitIcon: false, isShieldOrHydra: false },
      'symbiotic-adaptation#0': { attack: 0, recruit: 0, cost: 6, fightCost: 0, fightCostMode: 'static', fightCostBase: 0, hasAttackIcon: true, hasRecruitIcon: true, isShieldOrHydra: false },
    },
    turnEconomy: { attack: 0, recruit: 0, spentAttack: 0, spentRecruit: 0, piercing: 0, woundsDrawn: 0, cardsDrawn: 0 },
    messages: [],
    pendingCountScaledChoice: [pending],
  } as unknown as LegendaryGameState;
}

describe('hasPendingCountScaledChoice', () => {
  it('is false for undefined and empty, true for a non-empty queue', () => {
    assert.equal(hasPendingCountScaledChoice({} as LegendaryGameState), false);
    assert.equal(hasPendingCountScaledChoice({ pendingCountScaledChoice: [] } as unknown as LegendaryGameState), false);
    assert.equal(hasPendingCountScaledChoice(makeState()), true);
  });
});

describe('resolveCountScaledChoice', () => {
  it('option 0 (recruit) grants recruit scaled by the recruit-icon count and pops', () => {
    const gameState = makeState();
    resolveCountScaledChoice(makeContext(gameState, '0'), { optionIndex: 0 });
    // two recruit-icon cards (recruiter-a, recruiter-b); symbiotic-adaptation excluded.
    assert.equal(gameState.turnEconomy.recruit, 2, 'grant is 1 x 2 recruit');
    assert.equal(gameState.turnEconomy.attack, 0, 'the recruit option must not touch attack');
    assert.equal(gameState.pendingCountScaledChoice!.length, 0, 'the front entry is popped');
  });

  it('option 1 (attack) grants attack scaled by the attack-icon count and pops', () => {
    const gameState = makeState();
    resolveCountScaledChoice(makeContext(gameState, '0'), { optionIndex: 1 });
    // one attack-icon card (attacker-a); symbiotic-adaptation excluded despite showing an attack icon.
    assert.equal(gameState.turnEconomy.attack, 1, 'grant is 1 x 1 attack (triggering card excluded)');
    assert.equal(gameState.turnEconomy.recruit, 0, 'the attack option must not touch recruit');
    assert.equal(gameState.pendingCountScaledChoice!.length, 0, 'the front entry is popped');
  });

  it('an out-of-range index is a silent no-op with the queue intact', () => {
    const gameState = makeState();
    resolveCountScaledChoice(makeContext(gameState, '0'), { optionIndex: 5 });
    assert.equal(gameState.turnEconomy.attack, 0);
    assert.equal(gameState.turnEconomy.recruit, 0);
    assert.equal(gameState.pendingCountScaledChoice!.length, 1, 'the queue is untouched');
  });

  it('a wrong-player resolution is a silent no-op with the queue intact', () => {
    const gameState = makeState();
    resolveCountScaledChoice(makeContext(gameState, '1'), { optionIndex: 0 });
    assert.equal(gameState.turnEconomy.recruit, 0);
    assert.equal(gameState.pendingCountScaledChoice!.length, 1, 'the queue is untouched');
  });

  it('an empty queue is a silent no-op', () => {
    const gameState = makeState();
    gameState.pendingCountScaledChoice = [];
    resolveCountScaledChoice(makeContext(gameState, '0'), { optionIndex: 0 });
    assert.equal(gameState.turnEconomy.recruit, 0);
  });
});

describe('resolveCountScaledChoice — mixed heterogeneous options (WP-679 / D-24495)', () => {
  it('an undercover option (officer-stack) sends an Officer to the Victory Pile + tracker', () => {
    const gameState = {
      playerZones: { '0': { deck: [], hand: [], discard: [], inPlay: ['coulson#0'], victory: [], undercover: [] } },
      piles: { bystanders: [], wounds: [], officers: ['pile-shield-officer', 'pile-shield-officer'], sidekicks: [], horrors: [] },
      cardStats: {},
      turnEconomy: { attack: 0, recruit: 0, spentAttack: 0, spentRecruit: 0, piercing: 0, woundsDrawn: 0, cardsDrawn: 0 },
      messages: [],
      pendingCountScaledChoice: [{
        playerID: '0',
        cardId: 'coulson#0',
        options: [
          { kind: 'undercover', source: 'officer-stack' },
          { kind: 'count-scaled', resource: 'attack', countSource: 'shield-levels', magnitude: 1, perEach: 2 },
        ],
      }],
    } as unknown as LegendaryGameState;
    resolveCountScaledChoice(makeContext(gameState, '0'), { optionIndex: 0 });
    const zones = gameState.playerZones['0']!;
    assert.deepEqual(zones.victory, ['pile-shield-officer'], 'one officer sent to victory');
    assert.deepEqual(zones.undercover, ['pile-shield-officer'], 'recorded in the undercover tracker');
    assert.equal(gameState.piles.officers.length, 1, 'one officer removed from the stack');
    assert.equal(gameState.pendingCountScaledChoice!.length, 0, 'front entry popped');
  });

  it('a count-scaled option with perEach=2 grants floor(shieldLevels / 2) attack', () => {
    const gameState = {
      playerZones: { '0': { deck: [], hand: [], discard: [], inPlay: ['coulson#0'], victory: ['a', 'b', 'c'], undercover: [] } },
      piles: { bystanders: [], wounds: [], officers: [], sidekicks: [], horrors: [] },
      cardStats: {
        a: { isShieldOrHydra: true }, b: { isShieldOrHydra: true }, c: { isShieldOrHydra: true },
      },
      turnEconomy: { attack: 0, recruit: 0, spentAttack: 0, spentRecruit: 0, piercing: 0, woundsDrawn: 0, cardsDrawn: 0 },
      messages: [],
      pendingCountScaledChoice: [{
        playerID: '0',
        cardId: 'coulson#0',
        options: [
          { kind: 'undercover', source: 'hand-shield-hero' },
          { kind: 'count-scaled', resource: 'attack', countSource: 'shield-levels', magnitude: 1, perEach: 2 },
        ],
      }],
    } as unknown as LegendaryGameState;
    resolveCountScaledChoice(makeContext(gameState, '0'), { optionIndex: 1 });
    // 3 S.H.I.E.L.D. cards in victory → floor(3 / 2) = 1 attack.
    assert.equal(gameState.turnEconomy.attack, 1, 'grant is 1 × floor(3 / 2) = 1');
    assert.equal(gameState.pendingCountScaledChoice!.length, 0, 'front entry popped');
  });
});
