/**
 * Tests for the Haunt keyword helpers (WP-757 / D-24587).
 *
 * Covers isHqSlotHaunted, isMastermindHaunting, selectUnhauntedHqIndex,
 * hauntHqSlot and clearHqHaunter over a real buildInitialGameState fixture,
 * plus the index-keyed inheritance rule: a haunter stays on its HQ slot when
 * the Haunted Hero leaves and the slot refills.
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { LegendaryGameState, MatchConfiguration } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { CardRegistryReader } from '../matchSetup.validate.js';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { makeCardRegistryReader, makeCardStatEntry } from '../test/fixtureBuilders.js';
import {
  clearHqHaunter,
  hauntHqSlot,
  isHqSlotHaunted,
  isMastermindHaunting,
  selectUnhauntedHqIndex,
} from './haunt.logic.js';
import { refillHqSlot } from './city.logic.js';

/** Empty registry so the fixture does not depend on real card data. */
const EMPTY_REGISTRY: CardRegistryReader = { ...makeCardRegistryReader(),
  listCards: () => [],
};

/**
 * Builds a valid MatchConfiguration for haunt fixtures (mirrors invariants.test.ts).
 */
function buildConfig(): MatchConfiguration {
  return {
    schemeId: 'test-scheme-001',
    mastermindId: 'test-mastermind-001',
    villainGroupIds: ['test-villain-group-001'],
    henchmanGroupIds: ['test-henchman-group-001'],
    heroDeckIds: ['test-hero-deck-001'],
    bystandersCount: 1,
    woundsCount: 1,
    officersCount: 1,
    sidekicksCount: 0,
  };
}

const HERO_A = 'test-hero-a-00' as CardExtId;
const HERO_B = 'test-hero-b-00' as CardExtId;
const HERO_C = 'test-hero-c-00' as CardExtId;
const HERO_D = 'test-hero-d-00' as CardExtId;
const HERO_E = 'test-hero-e-00' as CardExtId;
const VILLAIN_ONE = 'test-villain-fallen-one-00' as CardExtId;
const VILLAIN_TWO = 'test-villain-fallen-two-00' as CardExtId;

/**
 * Builds a game state with a fully occupied HQ and per-hero costs
 * (A=5, B=2, C=6, D=3, E=4) so the cost-lte-3 selector has a mix.
 */
function buildHauntState(): LegendaryGameState {
  const gameState = buildInitialGameState(buildConfig(), EMPTY_REGISTRY, makeMockCtx({ numPlayers: 2 }));
  gameState.hq = [HERO_A, HERO_B, HERO_C, HERO_D, HERO_E];
  gameState.cardStats[HERO_A] = { ...makeCardStatEntry(), cost: 5 };
  gameState.cardStats[HERO_B] = { ...makeCardStatEntry(), cost: 2 };
  gameState.cardStats[HERO_C] = { ...makeCardStatEntry(), cost: 6 };
  gameState.cardStats[HERO_D] = { ...makeCardStatEntry(), cost: 3 };
  gameState.cardStats[HERO_E] = { ...makeCardStatEntry(), cost: 4 };
  return gameState;
}

describe('haunt.logic — absent hqHaunters (WP-757 / D-24587)', () => {
  it('a fresh game state has no hqHaunters field and reports nothing haunted', () => {
    const gameState = buildHauntState();
    // why: D-24587 — hqHaunters is lazy; it must never be seeded at setup.
    assert.equal(gameState.hqHaunters, undefined, 'hqHaunters is absent at setup');
    for (let hqIndex = 0; hqIndex < 5; hqIndex++) {
      assert.equal(isHqSlotHaunted(gameState, hqIndex), false, `slot ${hqIndex} is not haunted`);
    }
    assert.equal(isMastermindHaunting(gameState), false);
    assert.equal(clearHqHaunter(gameState, 0), null);
    assert.equal(gameState.hqHaunters, undefined, 'clearHqHaunter does not create the array');
  });
});

describe('haunt.logic — hauntHqSlot', () => {
  it('lazily creates a 5-length array on the first haunt with other slots null', () => {
    const gameState = buildHauntState();
    const recorded = hauntHqSlot(gameState, 2, { kind: 'villain', cardId: VILLAIN_ONE });
    assert.equal(recorded, true);
    assert.deepStrictEqual(gameState.hqHaunters, [
      null,
      null,
      { kind: 'villain', cardId: VILLAIN_ONE },
      null,
      null,
    ]);
    assert.equal(isHqSlotHaunted(gameState, 2), true);
    assert.equal(isHqSlotHaunted(gameState, 1), false);
  });

  it('refuses an already-haunted slot and leaves G untouched', () => {
    const gameState = buildHauntState();
    hauntHqSlot(gameState, 2, { kind: 'villain', cardId: VILLAIN_ONE });
    const before = JSON.stringify(gameState);
    const recorded = hauntHqSlot(gameState, 2, { kind: 'villain', cardId: VILLAIN_TWO });
    assert.equal(recorded, false, 'a Hero cannot be haunted by two Villains at once');
    assert.equal(JSON.stringify(gameState), before, 'the refused haunt wrote nothing');
  });

  it('refuses a null HQ slot on a fresh G without creating hqHaunters', () => {
    const gameState = buildHauntState();
    gameState.hq[3] = null;
    const before = JSON.stringify(gameState);
    const recorded = hauntHqSlot(gameState, 3, { kind: 'villain', cardId: VILLAIN_ONE });
    assert.equal(recorded, false);
    assert.equal(gameState.hqHaunters, undefined, 'a refused haunt must not create the array');
    assert.equal(JSON.stringify(gameState), before);
  });

  it('refuses out-of-range and non-integer indices on a fresh G without creating hqHaunters', () => {
    const gameState = buildHauntState();
    const before = JSON.stringify(gameState);
    for (const badIndex of [-1, 5, 99, 1.5, Number.NaN]) {
      const recorded = hauntHqSlot(gameState, badIndex, { kind: 'villain', cardId: VILLAIN_ONE });
      assert.equal(recorded, false, `index ${String(badIndex)} must be refused`);
    }
    assert.equal(gameState.hqHaunters, undefined);
    assert.equal(JSON.stringify(gameState), before);
  });

  it('refuses out-of-range indices when hqHaunters already exists and leaves it unchanged', () => {
    const gameState = buildHauntState();
    hauntHqSlot(gameState, 0, { kind: 'mastermind' });
    const before = JSON.stringify(gameState);
    assert.equal(hauntHqSlot(gameState, 5, { kind: 'villain', cardId: VILLAIN_ONE }), false);
    assert.equal(hauntHqSlot(gameState, -1, { kind: 'villain', cardId: VILLAIN_ONE }), false);
    assert.equal(JSON.stringify(gameState), before);
    assert.equal(gameState.hqHaunters!.length, 5);
  });
});

describe('haunt.logic — isMastermindHaunting', () => {
  it('is false when only Villain haunters exist', () => {
    const gameState = buildHauntState();
    hauntHqSlot(gameState, 1, { kind: 'villain', cardId: VILLAIN_ONE });
    assert.equal(isMastermindHaunting(gameState), false);
  });

  it('is true when a mastermind entry exists, and false again once it is cleared', () => {
    const gameState = buildHauntState();
    hauntHqSlot(gameState, 1, { kind: 'villain', cardId: VILLAIN_ONE });
    hauntHqSlot(gameState, 4, { kind: 'mastermind' });
    assert.equal(isMastermindHaunting(gameState), true);
    assert.deepStrictEqual(clearHqHaunter(gameState, 4), { kind: 'mastermind' });
    assert.equal(isMastermindHaunting(gameState), false);
  });
});

describe('haunt.logic — clearHqHaunter', () => {
  it('returns the haunter and nulls the slot; a second clear returns null', () => {
    const gameState = buildHauntState();
    hauntHqSlot(gameState, 3, { kind: 'villain', cardId: VILLAIN_TWO });
    const removed = clearHqHaunter(gameState, 3);
    assert.deepStrictEqual(removed, { kind: 'villain', cardId: VILLAIN_TWO });
    assert.equal(gameState.hqHaunters![3], null);
    assert.equal(gameState.hqHaunters!.length, 5, 'the array keeps its full length');
    assert.equal(isHqSlotHaunted(gameState, 3), false);
    assert.equal(clearHqHaunter(gameState, 3), null);
  });
});

describe('haunt.logic — selectUnhauntedHqIndex', () => {
  it('rightmost picks the highest index, skipping haunted and null slots', () => {
    const gameState = buildHauntState();
    assert.equal(selectUnhauntedHqIndex(gameState, 'rightmost'), 4);
    hauntHqSlot(gameState, 4, { kind: 'villain', cardId: VILLAIN_ONE });
    gameState.hq[3] = null;
    assert.equal(selectUnhauntedHqIndex(gameState, 'rightmost'), 2);
  });

  it('leftmost picks the lowest index, skipping haunted and null slots', () => {
    const gameState = buildHauntState();
    assert.equal(selectUnhauntedHqIndex(gameState, 'leftmost'), 0);
    gameState.hq[0] = null;
    hauntHqSlot(gameState, 1, { kind: 'villain', cardId: VILLAIN_ONE });
    assert.equal(selectUnhauntedHqIndex(gameState, 'leftmost'), 2);
  });

  it('cost-lte-3 picks the lowest-index unhaunted Hero costing 3 or less', () => {
    const gameState = buildHauntState();
    // why: costs are A=5, B=2, C=6, D=3, E=4 — slot 0 (cost 5) is skipped, slot 1 wins.
    assert.equal(selectUnhauntedHqIndex(gameState, 'cost-lte-3'), 1);
    hauntHqSlot(gameState, 1, { kind: 'villain', cardId: VILLAIN_ONE });
    // why: slot 1 now haunted, slot 2 costs 6, so slot 3 (cost exactly 3) is next.
    assert.equal(selectUnhauntedHqIndex(gameState, 'cost-lte-3'), 3);
  });

  it('cost-lte-3 returns null when every unhaunted Hero costs more than 3', () => {
    const gameState = buildHauntState();
    hauntHqSlot(gameState, 1, { kind: 'villain', cardId: VILLAIN_ONE });
    gameState.hq[3] = null;
    assert.equal(selectUnhauntedHqIndex(gameState, 'cost-lte-3'), null);
  });

  it('every selector returns null when every slot is null or haunted', () => {
    const gameState = buildHauntState();
    gameState.hq = [null, HERO_B, null, HERO_D, null];
    hauntHqSlot(gameState, 1, { kind: 'villain', cardId: VILLAIN_ONE });
    hauntHqSlot(gameState, 3, { kind: 'mastermind' });
    assert.equal(selectUnhauntedHqIndex(gameState, 'rightmost'), null);
    assert.equal(selectUnhauntedHqIndex(gameState, 'leftmost'), null);
    assert.equal(selectUnhauntedHqIndex(gameState, 'cost-lte-3'), null);
  });

  it('does not mutate G', () => {
    const gameState = buildHauntState();
    hauntHqSlot(gameState, 2, { kind: 'villain', cardId: VILLAIN_ONE });
    const before = JSON.stringify(gameState);
    selectUnhauntedHqIndex(gameState, 'rightmost');
    selectUnhauntedHqIndex(gameState, 'leftmost');
    selectUnhauntedHqIndex(gameState, 'cost-lte-3');
    assert.equal(JSON.stringify(gameState), before);
  });
});

describe('haunt.logic — index-keyed inheritance', () => {
  it('a haunter stays on its HQ slot after the Hero leaves and refillHqSlot refills it', () => {
    const gameState = buildHauntState();
    const replacementHero = 'test-hero-f-00' as CardExtId;
    gameState.heroDeck = [replacementHero];
    hauntHqSlot(gameState, 2, { kind: 'villain', cardId: VILLAIN_ONE });

    // why: rulebook v23 p.27 — when a Haunted Hero leaves the HQ, the haunter stays
    // in that HQ space and haunts the refill. Simulate the Hero leaving + refill.
    gameState.hq[2] = null;
    const refill = refillHqSlot(gameState.hq, 2, gameState.heroDeck);
    gameState.hq = refill.hq;
    gameState.heroDeck = refill.heroDeck;

    assert.equal(gameState.hq[2], replacementHero, 'the slot was refilled');
    assert.equal(isHqSlotHaunted(gameState, 2), true, 'the refilled slot is still haunted');
    assert.deepStrictEqual(gameState.hqHaunters![2], { kind: 'villain', cardId: VILLAIN_ONE });
    assert.equal(
      hauntHqSlot(gameState, 2, { kind: 'villain', cardId: VILLAIN_TWO }),
      false,
      'the inherited haunter still blocks a second haunt',
    );
  });

  it('a haunter stays on a slot that the empty Hero deck leaves null', () => {
    const gameState = buildHauntState();
    gameState.heroDeck = [];
    hauntHqSlot(gameState, 0, { kind: 'villain', cardId: VILLAIN_ONE });
    const refill = refillHqSlot(gameState.hq, 0, gameState.heroDeck);
    gameState.hq = refill.hq;
    assert.equal(gameState.hq[0], null);
    assert.equal(isHqSlotHaunted(gameState, 0), true, 'the haunter is reported on the empty slot');
  });
});
