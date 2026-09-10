/**
 * Tests for the two Deadpool interactive/multiplayer abilities that ride WP-684's
 * non-active/multi-seat pending-choice capability (WP-683 / EC-720 / D-24500):
 *
 *   - `here-hold-this` — active-scoped directed Bystander capture (pick a City Villain;
 *     0 Villains → Mastermind captures; empty supply → no-op; 1 → auto; ≥2 → park).
 *   - `random-acts` — optional gain-Wound-to-HAND then a SIMULTANEOUS multi-seat pass-left
 *     (ctx.playOrder adjacency, atomic apply, no peeking; solo degenerates faithfully).
 *
 * Covers the handler cardinalities, the wound-to-hand gain, the wound→pass chain, the
 * pass-left adjacency for 2 / 3 / 4 players, simultaneity + atomicity, the passable Wound,
 * solo degeneracy, and the per-seat UIState redaction of the pass prompt. node:test.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { LegendaryGameState, PendingSeatChoice } from '../types.js';
import { executeSingleEffect } from '../hero/heroEffects.execute.js';
import { resolveSeatChoice } from './seatChoice.resolve.js';
import {
  buildHereHoldThisTargets,
  buildPassLeftChoice,
  HERE_HOLD_THIS_KIND,
  RANDOM_ACTS_WOUND_KIND,
  RANDOM_ACTS_PASS_LEFT_KIND,
} from './seatChoiceCards.js';

/** A stub boardgame.io events surface that records setActivePlayers admissions. */
function makeEvents(): { setActivePlayers: (arg: unknown) => void; admitted: unknown[] } {
  const admitted: unknown[] = [];
  return { admitted, setActivePlayers: (arg: unknown) => admitted.push(arg) };
}

/** A minimal G carrying only the fields the two Deadpool mechanics touch. */
function makeState(options: {
  city?: (string | null)[];
  bystanders?: string[];
  wounds?: string[];
  hands?: Record<string, string[]>;
  mastermindBystanders?: string[];
  pendingSeatChoice?: PendingSeatChoice;
}): LegendaryGameState {
  const hands = options.hands ?? { '0': [] };
  const playerZones: Record<string, unknown> = {};
  for (const seat of Object.keys(hands)) {
    playerZones[seat] = { deck: [], hand: [...hands[seat]!], discard: [], victory: [], inPlay: [] };
  }
  return {
    playerZones,
    city: options.city ?? [null, null, null, null, null],
    attachedBystanders: {},
    piles: {
      bystanders: [...(options.bystanders ?? [])],
      wounds: [...(options.wounds ?? [])],
      officers: [],
      sidekicks: [],
      horrors: [],
    },
    mastermind: {
      id: 'mm',
      baseCardId: 'mm#0',
      tacticsDeck: ['t0', 't1'],
      tacticsDefeated: [],
      strikePile: [],
      attachedBystanders: [...(options.mastermindBystanders ?? [])],
    },
    cardDisplayData: {},
    messages: [],
    turnEconomy: { attack: 0, recruit: 0, spentAttack: 0, spentRecruit: 0, piercing: 0, woundsDrawn: 0, cardsDrawn: 0 },
    currentStage: 'main',
    ...(options.pendingSeatChoice !== undefined ? { pendingSeatChoice: options.pendingSeatChoice } : {}),
  } as unknown as LegendaryGameState;
}

/** A hero-handler context wrapper (executeSingleEffect narrows .ctx / .events / .random). */
function makeHandlerCtx(playOrder: string[]): unknown {
  return {
    ctx: { playOrder, numPlayers: playOrder.length, currentPlayer: playOrder[0], turn: 2 },
    events: makeEvents(),
    random: {},
  };
}

/** A resolveSeatChoice move context for a submitting seat. */
function makeResolveCtx(
  G: LegendaryGameState,
  playerID: string,
  playOrder: string[],
): Parameters<typeof resolveSeatChoice>[0] {
  return {
    G,
    playerID,
    ctx: { playOrder, numPlayers: playOrder.length, currentPlayer: playOrder[0], turn: 2 },
    events: makeEvents(),
    random: {},
    log: {},
  } as unknown as Parameters<typeof resolveSeatChoice>[0];
}

// ---------------------------------------------------------------------------
// Here, Hold This for a Second
// ---------------------------------------------------------------------------

describe('here-hold-this — directed Bystander capture (WP-683 / D-24500)', () => {
  it('empty Bystander supply is a clean no-op (no capture, no pending)', () => {
    const G = makeState({ city: ['v0#0', null, null, null, null], bystanders: [] });
    executeSingleEffect(G, makeHandlerCtx(['0']), '0', 'here-hold-this#0', { type: 'here-hold-this' });
    assert.equal(G.pendingSeatChoice, undefined, 'no choice parked');
    assert.deepEqual(G.attachedBystanders, {}, 'no Bystander attached');
  });

  it('0 City Villains → the Mastermind captures (universal-rules-v23 §capture)', () => {
    const G = makeState({ city: [null, null, null, null, null], bystanders: ['by0', 'by1'] });
    executeSingleEffect(G, makeHandlerCtx(['0']), '0', 'here-hold-this#0', { type: 'here-hold-this' });
    assert.deepEqual(G.mastermind.attachedBystanders, ['by0'], 'Mastermind captured the top Bystander');
    assert.deepEqual(G.piles.bystanders, ['by1'], 'top Bystander removed from supply');
    assert.equal(G.pendingSeatChoice, undefined, 'no choice parked');
  });

  it('exactly 1 City Villain → auto-attach with no prompt', () => {
    const G = makeState({ city: [null, 'v1#0', null, null, null], bystanders: ['by0'] });
    executeSingleEffect(G, makeHandlerCtx(['0']), '0', 'here-hold-this#0', { type: 'here-hold-this' });
    assert.deepEqual(G.attachedBystanders['v1#0'], ['by0'], 'the sole Villain captured the Bystander');
    assert.deepEqual(G.piles.bystanders, [], 'supply drained');
    assert.equal(G.pendingSeatChoice, undefined, 'no choice parked');
  });

  it('≥2 City Villains → parks an active-scoped pick; resolve attaches to the chosen Villain', () => {
    const G = makeState({ city: ['v0#0', null, 'v2#0', null, null], bystanders: ['by0'] });
    executeSingleEffect(G, makeHandlerCtx(['0']), '0', 'here-hold-this#0', { type: 'here-hold-this' });
    const choice = G.pendingSeatChoice;
    assert.ok(choice !== undefined, 'a choice was parked');
    assert.equal(choice!.kind, HERE_HOLD_THIS_KIND);
    assert.deepEqual(choice!.addressedSeats, ['0'], 'active-scoped');
    assert.equal(choice!.seatPrompts['0']!.options.length, 2, 'one option per City Villain');
    // Pick option 1 (city space 2 → v2#0).
    resolveSeatChoice(makeResolveCtx(G, '0', ['0']), { optionIndex: 1 });
    assert.equal(G.pendingSeatChoice, undefined, 'choice cleared');
    assert.deepEqual(G.attachedBystanders['v2#0'], ['by0'], 'the chosen Villain captured');
    assert.equal(G.attachedBystanders['v0#0'], undefined, 'the unchosen Villain did not');
  });

  it('the non-active player CANNOT resolve the active-scoped pick', () => {
    const G = makeState({
      city: ['v0#0', 'v1#0', null, null, null],
      bystanders: ['by0'],
      hands: { '0': [], '1': [] },
    });
    executeSingleEffect(G, makeHandlerCtx(['0', '1']), '0', 'here-hold-this#0', { type: 'here-hold-this' });
    resolveSeatChoice(makeResolveCtx(G, '1', ['0', '1']), { optionIndex: 0 });
    assert.ok(G.pendingSeatChoice !== undefined, 'a non-addressed seat cannot resolve it');
  });

  it('buildHereHoldThisTargets returns non-empty City spaces ascending', () => {
    const G = makeState({ city: [null, 'v1#0', null, 'v3#0', null] });
    assert.deepEqual(buildHereHoldThisTargets(G), [
      { cityIndex: 1, cardId: 'v1#0' },
      { cityIndex: 3, cardId: 'v3#0' },
    ]);
  });
});

// ---------------------------------------------------------------------------
// Random Acts of Unkindness — wound-to-hand
// ---------------------------------------------------------------------------

describe('random-acts — optional gain-Wound-to-hand (WP-683 / D-24500)', () => {
  it('parks an active-scoped wound choice when the supply is non-empty', () => {
    const G = makeState({ wounds: ['w0'], hands: { '0': ['a0'], '1': ['b0'] } });
    executeSingleEffect(G, makeHandlerCtx(['0', '1']), '0', 'random-acts#0', { type: 'random-acts' });
    const choice = G.pendingSeatChoice;
    assert.ok(choice !== undefined);
    assert.equal(choice!.kind, RANDOM_ACTS_WOUND_KIND);
    assert.deepEqual(choice!.addressedSeats, ['0']);
    assert.equal(choice!.defaultOptionIndex, 1, 'the default declines the Wound');
  });

  it('accepting gains the Wound to HAND (not discard), then chains the pass-left', () => {
    const G = makeState({ wounds: ['w0'], hands: { '0': ['a0'], '1': ['b0'] } });
    executeSingleEffect(G, makeHandlerCtx(['0', '1']), '0', 'random-acts#0', { type: 'random-acts' });
    // Accept the Wound (option 0).
    resolveSeatChoice(makeResolveCtx(G, '0', ['0', '1']), { optionIndex: 0 });
    assert.ok(G.playerZones['0']!.hand.includes('w0'), 'the Wound landed in hand');
    assert.deepEqual(G.playerZones['0']!.discard, [], 'the Wound did NOT go to discard');
    assert.deepEqual(G.piles.wounds, [], 'the Wound left the supply');
    // The pass-left chained.
    assert.ok(G.pendingSeatChoice !== undefined, 'the pass-left choice was chained');
    assert.equal(G.pendingSeatChoice!.kind, RANDOM_ACTS_PASS_LEFT_KIND);
  });

  it('declining gains no Wound but still chains the pass-left', () => {
    const G = makeState({ wounds: ['w0'], hands: { '0': ['a0'], '1': ['b0'] } });
    executeSingleEffect(G, makeHandlerCtx(['0', '1']), '0', 'random-acts#0', { type: 'random-acts' });
    resolveSeatChoice(makeResolveCtx(G, '0', ['0', '1']), { optionIndex: 1 });
    assert.deepEqual(G.piles.wounds, ['w0'], 'no Wound gained');
    assert.ok(!G.playerZones['0']!.hand.includes('w0'));
    assert.equal(G.pendingSeatChoice!.kind, RANDOM_ACTS_PASS_LEFT_KIND, 'the pass still chains');
  });

  it('empty Wound supply + multiplayer → parks the pass-left directly (no wound step)', () => {
    const G = makeState({ wounds: [], hands: { '0': ['a0'], '1': ['b0'] } });
    executeSingleEffect(G, makeHandlerCtx(['0', '1']), '0', 'random-acts#0', { type: 'random-acts' });
    assert.equal(G.pendingSeatChoice!.kind, RANDOM_ACTS_PASS_LEFT_KIND);
  });

  it('solo, empty Wound supply → a clean no-op (no pending, nothing to pass or gain)', () => {
    const G = makeState({ wounds: [], hands: { '0': ['a0'] } });
    executeSingleEffect(G, makeHandlerCtx(['0']), '0', 'random-acts#0', { type: 'random-acts' });
    assert.equal(G.pendingSeatChoice, undefined);
  });

  it('solo, Wound supply present → gains to hand, then the pass degenerates to a no-op (kept)', () => {
    const G = makeState({ wounds: ['w0'], hands: { '0': ['a0'] } });
    executeSingleEffect(G, makeHandlerCtx(['0']), '0', 'random-acts#0', { type: 'random-acts' });
    resolveSeatChoice(makeResolveCtx(G, '0', ['0']), { optionIndex: 0 });
    assert.ok(G.playerZones['0']!.hand.includes('w0'), 'solo keeps the gained Wound in hand');
    assert.equal(G.pendingSeatChoice, undefined, 'no cross-seat pass in solo');
  });
});

// ---------------------------------------------------------------------------
// Random Acts — simultaneous multi-seat pass-left
// ---------------------------------------------------------------------------

/** Drives a full pass-left: parks (empty wound supply) then submits every seat's pick. */
function runPassLeft(
  hands: Record<string, string[]>,
  playOrder: string[],
  picks: Record<string, number>,
): LegendaryGameState {
  const G = makeState({ wounds: [], hands });
  executeSingleEffect(G, makeHandlerCtx(playOrder), playOrder[0]!, 'random-acts#0', { type: 'random-acts' });
  assert.equal(G.pendingSeatChoice!.kind, RANDOM_ACTS_PASS_LEFT_KIND, 'pass-left parked');
  for (const seat of playOrder) {
    if (G.pendingSeatChoice === undefined) break;
    if (!G.pendingSeatChoice.addressedSeats.includes(seat)) continue;
    resolveSeatChoice(makeResolveCtx(G, seat, playOrder), { optionIndex: picks[seat] ?? 0 });
  }
  return G;
}

describe('random-acts — simultaneous pass-left adjacency + atomicity (WP-683 / D-24500)', () => {
  it('2 players: each passes to the other (left = next in playOrder, wrapping)', () => {
    const G = runPassLeft({ '0': ['a0'], '1': ['b0'] }, ['0', '1'], { '0': 0, '1': 0 });
    assert.deepEqual(G.playerZones['0']!.hand, ['b0'], 'seat 0 received seat 1\'s card');
    assert.deepEqual(G.playerZones['1']!.hand, ['a0'], 'seat 1 received seat 0\'s card');
    assert.equal(G.pendingSeatChoice, undefined, 'applied and cleared');
  });

  it('3 players: 0→1, 1→2, 2→0; a seat passes its OWN card, never the incoming one (no peeking)', () => {
    const G = runPassLeft({ '0': ['a0', 'a1'], '1': ['b0'], '2': ['c0'] }, ['0', '1', '2'], { '0': 0, '1': 0, '2': 0 });
    // seat0 passed a0→seat1, kept a1, received c0 from seat2.
    assert.deepEqual(G.playerZones['0']!.hand, ['a1', 'c0']);
    // seat1 passed its OWN b0→seat2 (not the incoming a0), received a0 from seat0.
    assert.deepEqual(G.playerZones['1']!.hand, ['a0']);
    // seat2 passed its OWN c0→seat0 (not the incoming b0), received b0 from seat1.
    assert.deepEqual(G.playerZones['2']!.hand, ['b0']);
  });

  it('4 players: full ring adjacency', () => {
    const G = runPassLeft(
      { '0': ['a'], '1': ['b'], '2': ['c'], '3': ['d'] },
      ['0', '1', '2', '3'],
      { '0': 0, '1': 0, '2': 0, '3': 0 },
    );
    assert.deepEqual(G.playerZones['0']!.hand, ['d'], '0 receives from 3');
    assert.deepEqual(G.playerZones['1']!.hand, ['a'], '1 receives from 0');
    assert.deepEqual(G.playerZones['2']!.hand, ['b'], '2 receives from 1');
    assert.deepEqual(G.playerZones['3']!.hand, ['c'], '3 receives from 2');
  });

  it('is atomic: nothing moves until EVERY addressed seat has submitted', () => {
    const G = makeState({ wounds: [], hands: { '0': ['a0'], '1': ['b0'], '2': ['c0'] } });
    executeSingleEffect(G, makeHandlerCtx(['0', '1', '2']), '0', 'random-acts#0', { type: 'random-acts' });
    resolveSeatChoice(makeResolveCtx(G, '0', ['0', '1', '2']), { optionIndex: 0 });
    assert.ok(G.pendingSeatChoice !== undefined, 'still open after 1 of 3');
    assert.deepEqual(G.playerZones['0']!.hand, ['a0'], 'no card moved yet (atomic)');
    resolveSeatChoice(makeResolveCtx(G, '1', ['0', '1', '2']), { optionIndex: 0 });
    assert.deepEqual(G.playerZones['1']!.hand, ['b0'], 'still nothing moved after 2 of 3');
    resolveSeatChoice(makeResolveCtx(G, '2', ['0', '1', '2']), { optionIndex: 0 });
    assert.equal(G.pendingSeatChoice, undefined, 'applied once all 3 submit');
  });

  it('the gained Wound is a legal card to pass', () => {
    const G = makeState({ wounds: ['w0'], hands: { '0': ['a0'], '1': ['b0'] } });
    executeSingleEffect(G, makeHandlerCtx(['0', '1']), '0', 'random-acts#0', { type: 'random-acts' });
    resolveSeatChoice(makeResolveCtx(G, '0', ['0', '1']), { optionIndex: 0 }); // accept wound → hand ['a0','w0']
    const pass = G.pendingSeatChoice!;
    const woundOptionIndex = pass.seatPrompts['0']!.options.findIndex((option) => option.cardId === 'w0');
    assert.ok(woundOptionIndex >= 0, 'the gained Wound is an offered pass option');
    resolveSeatChoice(makeResolveCtx(G, '0', ['0', '1']), { optionIndex: woundOptionIndex });
    resolveSeatChoice(makeResolveCtx(G, '1', ['0', '1']), { optionIndex: 0 });
    assert.ok(G.playerZones['1']!.hand.includes('w0'), 'the Wound was passed to the left seat');
  });

  it('a seat with an empty hand is not addressed but still receives', () => {
    const choice = buildPassLeftChoice(makeState({ hands: { '0': ['a0'], '1': [] } }), ['0', '1']);
    assert.deepEqual(choice!.addressedSeats, ['0'], 'the empty-hand seat is not addressed');
    assert.equal(choice!.leftNeighborBySeat!['0'], '1', 'seat 0 still passes to (empty) seat 1');
  });

  it('buildPassLeftChoice returns undefined for solo (no player on the left)', () => {
    assert.equal(buildPassLeftChoice(makeState({ hands: { '0': ['a0'] } }), ['0']), undefined);
  });

  // why: WP-683 / D-24500 — the pass-left prompt reuses G.pendingSeatChoice unchanged, so its
  // PER-SEAT UIState redaction (each seat sees ONLY its own prompt; opponents/spectators see
  // nothing) is the WP-684 audience-filter contract, which is KIND-AGNOSTIC (uiState.filter.ts
  // rebuilds seatPrompts to the viewer's own entry regardless of `kind`) and is proven by
  // uiState.filter.test.ts "pendingSeatChoice per-seat redaction (D-24501)". No pass-left-specific
  // redaction code exists to test separately.
});
