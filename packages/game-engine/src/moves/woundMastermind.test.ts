/**
 * woundMastermind move tests (WP-769 / D-24602): the spend, the Wound source, the +1 Recruit,
 * the 5 → 0 walk and every gate (T2-T4).
 *
 * node:test + node:assert only. makeMockMoveContext. No boardgame.io/testing import.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { woundMastermind } from './woundMastermind.js';
import { healWounds } from './healWounds.js';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { resolveMastermindFightCost } from '../economy/economy.resolve.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { makeMockMoveContext } from '../test/mockMoveContext.js';
import { makeCardRegistryReader, makeCardStatEntry } from '../test/fixtureBuilders.js';
import { WOUND_EXT_ID } from '../setup/pilesInit.js';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';

const KILLMONGER_BASE = 'bkpt-mastermind-killmonger-killmonger' as CardExtId;

/** The setup composition (a mock registry). */
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
 * Builds a state with Killmonger (printed Attack 5), two tactics, the given Attack, an empty KO
 * pile and the `main` stage.
 *
 * @param attack - The player's Attack.
 * @param mastermindId - The selected Mastermind.
 * @returns The state.
 */
function makeState(attack: number, mastermindId = 'bkpt/killmonger'): LegendaryGameState {
  const baseState = buildInitialGameState(createTestConfig(), makeCardRegistryReader(), makeMockCtx());
  const gameState: LegendaryGameState = { ...baseState, selection: { ...baseState.selection, mastermindId } };
  gameState.currentStage = 'main';
  gameState.mastermind = {
    ...gameState.mastermind,
    baseCardId: KILLMONGER_BASE,
    tacticsDeck: ['bkpt-mastermind-killmonger-rite-of-challenge', 'bkpt-mastermind-killmonger-a-scar-for-every-kill'] as CardExtId[],
  };
  gameState.cardStats[KILLMONGER_BASE] = makeCardStatEntry({ fightCost: 5 });
  gameState.cardDisplayData = {
    ...gameState.cardDisplayData,
    [KILLMONGER_BASE]: { extId: KILLMONGER_BASE, name: 'Killmonger', imageUrl: '', cost: 0 },
  };
  gameState.ko = [];
  gameState.turnEconomy = { ...gameState.turnEconomy, attack };
  return gameState;
}

describe('WP-769 woundMastermind', () => {
  it('T2: each call spends his Attack, puts a Wound on him and gives +1 Recruit; 5 → 0 costs 15 and gives +5', () => {
    const gameState = makeState(15);
    const recruitBefore = gameState.turnEconomy.recruit;
    const expectedCosts = [5, 4, 3, 2, 1];
    for (const [step, cost] of expectedCosts.entries()) {
      assert.equal(resolveMastermindFightCost(gameState, '0'), cost);
      const spentBefore = gameState.turnEconomy.spentAttack;
      woundMastermind(makeMockMoveContext(gameState));
      assert.equal(gameState.turnEconomy.spentAttack - spentBefore, cost, `step ${String(step)}`);
      assert.equal(gameState.mastermind.wounds?.length, step + 1);
    }
    assert.equal(resolveMastermindFightCost(gameState, '0'), 0);
    assert.equal(gameState.turnEconomy.recruit - recruitBefore, 5);
    assert.equal(gameState.turnEconomy.attack - gameState.turnEconomy.spentAttack, 0, '15 Attack spent');
    const before = structuredClone(gameState);
    woundMastermind(makeMockMoveContext(gameState));
    assert.deepStrictEqual(gameState, before, 'a sixth call (Attack 0) is refused');
    assert.match(
      gameState.messages.map((entry) => entry.text).join('\n'),
      /Player 0 spent 5 Attack to Wound Killmonger and got \+1 Recruit; he has 1 Wound\(s\) and 4 Attack now\./,
    );
  });

  it('T3: the KO pile is used first, then the Wound Stack top; with neither the move is refused', () => {
    const gameState = makeState(99);
    gameState.ko = ['ko-hero' as CardExtId, WOUND_EXT_ID];
    const stackBefore = gameState.piles.wounds.length;
    woundMastermind(makeMockMoveContext(gameState));
    assert.deepEqual(gameState.ko, ['ko-hero']);
    assert.equal(gameState.piles.wounds.length, stackBefore, 'the stack is untouched');
    woundMastermind(makeMockMoveContext(gameState));
    assert.equal(gameState.piles.wounds.length, stackBefore - 1, 'then the stack');

    const empty = makeState(99);
    empty.piles = { ...empty.piles, wounds: [] };
    const before = structuredClone(empty);
    woundMastermind(makeMockMoveContext(empty));
    assert.deepStrictEqual(empty, before);
  });

  it('T4: refused (G unchanged) for another Mastermind, short attack, not main, a pending choice, no Tactic left', () => {
    const cases: [string, LegendaryGameState][] = [];
    cases.push(['another Mastermind', makeState(99, 'test-mastermind-001')]);
    cases.push(['short attack', makeState(4)]);
    const startStage = makeState(99);
    startStage.currentStage = 'start';
    cases.push(['not main', startStage]);
    const pending = makeState(99);
    pending.pendingDiscardChoices = [{ choiceType: 'discard-to-limit', playerID: '0', limit: 4 }];
    cases.push(['a pending choice', pending]);
    const vanquished = makeState(99);
    vanquished.mastermind = { ...vanquished.mastermind, tacticsDeck: [] };
    cases.push(['no Tactic and no Final Blow', vanquished]);
    for (const [label, gameState] of cases) {
      const before = structuredClone(gameState);
      woundMastermind(makeMockMoveContext(gameState));
      assert.deepStrictEqual(gameState, before, label);
    }
  });

  it('T4: not a fight — legal after Healing, while haunted or guarded, under an Enigma code; never sets hasActedThisTurn', () => {
    const healed = makeState(99);
    healed.playerZones['0']!.hand = [WOUND_EXT_ID];
    healWounds(makeMockMoveContext(healed));
    assert.equal(healed.hasActedThisTurn, false);
    woundMastermind(makeMockMoveContext(healed));
    assert.equal(healed.mastermind.wounds?.length, 1, 'after Healing');
    assert.equal(healed.hasActedThisTurn, false);

    const guarded = makeState(99);
    guarded.villainsBesideMastermind = ['co2e-villain-brotherhood-of-mutants-the-blob-00' as CardExtId];
    woundMastermind(makeMockMoveContext(guarded));
    assert.equal(guarded.mastermind.wounds?.length, 1, 'guarded');

    const enigma = makeState(99);
    enigma.enigmaCode = ['enigma-00' as CardExtId] as never;
    woundMastermind(makeMockMoveContext(enigma));
    assert.equal(enigma.mastermind.wounds?.length, 1, 'no guess needed');
  });
});
