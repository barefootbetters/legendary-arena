/**
 * Tests for applyEndOfTurnCleanup (WP-701 / D-24520) — the single end-of-turn
 * cleanup site: discard in-play + hand, then draw a fresh HAND_SIZE hand, with
 * the reshuffle event, handSizeOverride, and deferred-hand injection consumes.
 *
 * Uses node:test + node:assert only. makeMockCtx reverses arrays (proves shuffle
 * ran) but the draw here just takes the deck top; reshuffle is exercised directly.
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { applyEndOfTurnCleanup } from './endOfTurnCleanup.logic.js';
import { HAND_SIZE } from './drawCards.logic.js';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';

/** A ShuffleProvider whose Shuffle reverses (proves a reshuffle ran deterministically). */
const reverseShuffle = { random: { Shuffle: <T>(deck: T[]): T[] => [...deck].reverse() } };

/** Minimal game state with player "0"'s zones + optional override/injection. */
function makeState(overrides: {
  hand?: CardExtId[];
  inPlay?: CardExtId[];
  deck?: CardExtId[];
  discard?: CardExtId[];
  handSizeOverride?: number;
  injection?: CardExtId[];
} = {}): LegendaryGameState {
  const state = {
    playerZones: {
      '0': {
        deck: overrides.deck ?? [],
        hand: overrides.hand ?? [],
        discard: overrides.discard ?? [],
        inPlay: overrides.inPlay ?? [],
        victory: [],
      },
    },
    notableEvents: [],
    messages: [],
    cardDisplayData: {},
  } as unknown as LegendaryGameState;
  if (overrides.handSizeOverride !== undefined) {
    (state as unknown as { handSizeOverrides: Record<string, number> }).handSizeOverrides = {
      '0': overrides.handSizeOverride,
    };
  }
  if (overrides.injection !== undefined) {
    (state as unknown as { deferredHandInjections: Record<string, CardExtId[]> }).deferredHandInjections = {
      '0': overrides.injection,
    };
  }
  return state;
}

describe('applyEndOfTurnCleanup (WP-701 / D-24520)', () => {
  it('discards in-play + hand, then draws a fresh HAND_SIZE hand from the deck', () => {
    const deck = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8'] as CardExtId[];
    const state = makeState({
      hand: ['h1', 'h2'] as CardExtId[],
      inPlay: ['p1', 'p2', 'p3'] as CardExtId[],
      deck,
    });

    applyEndOfTurnCleanup(state, '0', reverseShuffle);

    const z = state.playerZones['0']!;
    assert.equal(z.hand.length, HAND_SIZE, 'hand drawn to HAND_SIZE');
    assert.deepStrictEqual(z.hand, ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'], 'drew the deck top in order');
    assert.deepStrictEqual(z.deck, ['d7', 'd8'], 'deck shrank by HAND_SIZE');
    assert.deepStrictEqual(
      [...z.discard].sort(),
      ['h1', 'h2', 'p1', 'p2', 'p3'],
      'the old hand + in-play were discarded',
    );
    assert.equal(z.inPlay.length, 0, 'in-play emptied');
  });

  it('reshuffles the discard on deck exhaustion and pushes a deckReshuffled event', () => {
    const state = makeState({
      hand: [] as CardExtId[],
      deck: ['only'] as CardExtId[],
      discard: ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7'] as CardExtId[],
    });

    applyEndOfTurnCleanup(state, '0', reverseShuffle);

    assert.equal(state.playerZones['0']!.hand.length, HAND_SIZE, 'filled to HAND_SIZE via reshuffle');
    assert.ok(
      state.notableEvents.some((e) => (e as { type: string }).type === 'deckReshuffled'),
      'a deckReshuffled notable event was pushed',
    );
  });

  it('honours a handSizeOverride (fills to 8) and consumes it', () => {
    const deck = Array.from({ length: 10 }, (_, i) => `d${i}` as CardExtId);
    const state = makeState({ hand: [], deck, handSizeOverride: 8 });

    applyEndOfTurnCleanup(state, '0', reverseShuffle);

    assert.equal(state.playerZones['0']!.hand.length, 8, 'filled to the override, not HAND_SIZE');
    assert.equal(
      (state as unknown as { handSizeOverrides?: Record<string, number> }).handSizeOverrides?.['0'],
      undefined,
      'the override was consumed (deleted)',
    );
  });

  it('adds a deferred hand injection as an extra card after the fill and clears it', () => {
    const deck = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7'] as CardExtId[];
    // the injected card is in the discard (an in-play Hero swept there this cleanup)
    const state = makeState({
      hand: [] as CardExtId[],
      inPlay: ['x-men-hero'] as CardExtId[],
      deck,
      injection: ['x-men-hero'] as CardExtId[],
    });

    applyEndOfTurnCleanup(state, '0', reverseShuffle);

    const z = state.playerZones['0']!;
    assert.equal(z.hand.length, HAND_SIZE + 1, 'HAND_SIZE + the injected extra card');
    assert.ok(z.hand.includes('x-men-hero' as CardExtId), 'the injected card is in hand');
    assert.equal(
      (state as unknown as { deferredHandInjections?: Record<string, CardExtId[]> }).deferredHandInjections?.['0'],
      undefined,
      'the injection was consumed (cleared)',
    );
  });

  it('is a no-op for an unknown player', () => {
    const state = makeState({ hand: ['h1'] as CardExtId[] });
    assert.doesNotThrow(() => applyEndOfTurnCleanup(state, '9', reverseShuffle));
    assert.deepStrictEqual(state.playerZones['0']!.hand, ['h1'], "player 0's hand untouched");
  });

  it('does not set hasDrawnThisTurn (that flag is an onBegin reset, not a draw side-effect)', () => {
    const state = makeState({ hand: [], deck: ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'] as CardExtId[] });
    applyEndOfTurnCleanup(state, '0', reverseShuffle);
    assert.equal(
      (state as unknown as { hasDrawnThisTurn?: boolean }).hasDrawnThisTurn,
      undefined,
      'the helper leaves hasDrawnThisTurn untouched',
    );
    void mock;
  });
});
