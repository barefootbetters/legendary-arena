/**
 * Tests for the resolveReturnOnDiscard priority guard (D-24527).
 *
 * An OPTIONAL return-on-discard (Cyclops "Unending Energy") must not be
 * resolvable while a MANDATORY discard-to-play cost is still being paid. Without
 * the guard, a multi-discard cost (Ruby Summers "Extinction Blast" — discard
 * three) could be paid with ONE return-on-discard card: discard Cyclops, return
 * it between discards, and re-discard the same card N times, so one card satisfies
 * an N-card cost. The guard defers the return until the full cost is paid, forcing
 * N DISTINCT cards, then lets the card come back — the faithful tabletop timing
 * (pay the whole cost, THEN the "you may return" trigger resolves).
 *
 * The bot's legalMoves generator already drains discard-to-play before offering
 * the return, so this closes the surface a human / crafted client could reach by
 * submitting the moves in a different order (engine owns truth, not the UI).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveReturnOnDiscard } from './resolveReturnOnDiscard.js';
import { resolveDiscardToPlay } from './resolveDiscardToPlay.js';
import type { LegendaryGameState, PendingDiscardToPlay } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';

const UNENDING_ENERGY = 'core/cyclops' as CardExtId;
const EXTINCTION_BLAST = 'ssw2/ruby-summers/extinction-blast' as CardExtId;
const CARD_B = 'core/spider-man' as CardExtId;
const CARD_C = 'core/iron-man' as CardExtId;

interface StateOverrides {
  hand?: CardExtId[];
  discard?: CardExtId[];
  pendingDiscardToPlay?: PendingDiscardToPlay[];
  pendingReturnOnDiscard?: { playerID: string; cardId: CardExtId }[];
}

/**
 * Minimal game state for the two resolve moves under test — one player, the given
 * hand/discard, and a heroAbilityHooks list marking Cyclops with return-on-discard
 * so discardFromHand parks the reaction.
 */
function makeState(overrides: StateOverrides): LegendaryGameState {
  const hooks: HeroAbilityHook[] = [
    { cardId: UNENDING_ENERGY, timing: 'onDiscard', keywords: ['return-on-discard'] },
  ];
  const state = {
    playerZones: {
      '0': {
        deck: [],
        hand: [...(overrides.hand ?? [])],
        discard: [...(overrides.discard ?? [])],
        inPlay: [],
        victory: [],
      },
    },
    heroAbilityHooks: hooks,
    cardDisplayData: {},
    messages: [],
  } as unknown as LegendaryGameState;
  if (overrides.pendingDiscardToPlay !== undefined) {
    state.pendingDiscardToPlay = overrides.pendingDiscardToPlay;
  }
  if (overrides.pendingReturnOnDiscard !== undefined) {
    state.pendingReturnOnDiscard = overrides.pendingReturnOnDiscard;
  }
  return state;
}

/** Builds the { G, playerID } move context both resolve moves destructure. */
function ctx(
  gameState: LegendaryGameState,
  playerID = '0',
): Parameters<typeof resolveReturnOnDiscard>[0] {
  return { G: gameState, playerID } as unknown as Parameters<typeof resolveReturnOnDiscard>[0];
}

describe('resolveReturnOnDiscard priority guard (D-24527)', () => {
  it('is a no-op while a discard-to-play cost is pending (both queues intact)', () => {
    const G = makeState({
      hand: [CARD_B, CARD_C],
      discard: [UNENDING_ENERGY],
      pendingDiscardToPlay: [{ playerID: '0', sourceCardId: EXTINCTION_BLAST, remaining: 2 }],
      pendingReturnOnDiscard: [{ playerID: '0', cardId: UNENDING_ENERGY }],
    });

    resolveReturnOnDiscard(ctx(G), { cardId: UNENDING_ENERGY });

    // Cyclops stays in discard; neither queue is touched — the return is deferred.
    assert.deepEqual(G.playerZones['0']!.discard, [UNENDING_ENERGY]);
    assert.deepEqual(G.playerZones['0']!.hand, [CARD_B, CARD_C]);
    assert.equal(G.pendingReturnOnDiscard!.length, 1);
    assert.equal(G.pendingDiscardToPlay!.length, 1);
  });

  it('also blocks a Decline while a discard-to-play cost is pending (queue intact)', () => {
    const G = makeState({
      discard: [UNENDING_ENERGY],
      pendingDiscardToPlay: [{ playerID: '0', sourceCardId: EXTINCTION_BLAST, remaining: 1 }],
      pendingReturnOnDiscard: [{ playerID: '0', cardId: UNENDING_ENERGY }],
    });

    resolveReturnOnDiscard(ctx(G), { decline: true });

    assert.equal(G.pendingReturnOnDiscard!.length, 1, 'the return choice is not consumed by a premature decline');
    assert.equal(G.pendingDiscardToPlay!.length, 1);
  });

  it('resolves normally once no discard-to-play cost remains', () => {
    const G = makeState({
      discard: [UNENDING_ENERGY],
      pendingReturnOnDiscard: [{ playerID: '0', cardId: UNENDING_ENERGY }],
    });

    resolveReturnOnDiscard(ctx(G), { cardId: UNENDING_ENERGY });

    assert.deepEqual(G.playerZones['0']!.hand, [UNENDING_ENERGY]);
    assert.deepEqual(G.playerZones['0']!.discard, []);
    assert.equal((G.pendingReturnOnDiscard ?? []).length, 0);
  });
});

describe('Extinction Blast n=3 + Cyclops exploit is closed (D-24527)', () => {
  it('one Cyclops cannot pay a three-discard cost — it forces three distinct cards, then returns', () => {
    // Extinction Blast is already inPlay; the cost (remaining 3) is pending.
    const G = makeState({
      hand: [UNENDING_ENERGY, CARD_B, CARD_C],
      pendingDiscardToPlay: [{ playerID: '0', sourceCardId: EXTINCTION_BLAST, remaining: 3 }],
    });

    // Discard #1: pay with Cyclops — it parks its optional return.
    resolveDiscardToPlay(ctx(G), { cardId: UNENDING_ENERGY });
    assert.equal(G.pendingDiscardToPlay![0]!.remaining, 2);
    assert.equal(G.pendingReturnOnDiscard!.length, 1, 'Cyclops parked its return');

    // Exploit attempt: try to bounce Cyclops back mid-cost. The guard no-ops it,
    // so Cyclops cannot be re-spent for discards #2 and #3.
    resolveReturnOnDiscard(ctx(G), { cardId: UNENDING_ENERGY });
    assert.deepEqual(G.playerZones['0']!.discard, [UNENDING_ENERGY], 'Cyclops stays discarded mid-cost');
    assert.deepEqual(G.playerZones['0']!.hand, [CARD_B, CARD_C], 'Cyclops did NOT return to hand');

    // Discards #2 and #3 must be paid with the two OTHER cards.
    resolveDiscardToPlay(ctx(G), { cardId: CARD_B });
    assert.equal(G.pendingDiscardToPlay![0]!.remaining, 1);
    resolveReturnOnDiscard(ctx(G), { cardId: UNENDING_ENERGY }); // still blocked
    assert.deepEqual(G.playerZones['0']!.hand, [CARD_C]);

    resolveDiscardToPlay(ctx(G), { cardId: CARD_C });
    // Cost fully paid — the discard-to-play queue front-pops.
    assert.equal((G.pendingDiscardToPlay ?? []).length, 0);

    // NOW the deferred return resolves: Cyclops comes back, B and C stay discarded.
    resolveReturnOnDiscard(ctx(G), { cardId: UNENDING_ENERGY });
    assert.deepEqual(G.playerZones['0']!.hand, [UNENDING_ENERGY], 'Cyclops returned after the cost was paid');
    assert.deepEqual(G.playerZones['0']!.discard, [CARD_B, CARD_C], 'three distinct cards paid the cost');
    assert.equal((G.pendingReturnOnDiscard ?? []).length, 0);
  });
});
