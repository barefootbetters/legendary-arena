/**
 * Tests for Magneto "Electromagnetic Bubble" (WP-695 / D-24512): the resolver
 * (rules/tacticHandlers.resolveElectromagneticBubble — 0 no-op / 1 auto / ≥2 park) and the
 * resolveElectromagneticBubbleChoice move + hasPendingElectromagneticBubbleChoice predicate.
 *
 * Covers: eligibility is team-only (cardTraits.team === 'x-men'); 0 in-play X-Men is a
 * logged no-op; exactly 1 auto-records the deferred injection inline (no park); ≥2 parks a
 * pick; the resolve move records the chosen ext_id into G.deferredHandInjections and
 * front-pops; invalid / stale states are silent no-ops leaving the queue intact.
 *
 * Uses node:test + node:assert only. No boardgame.io testing imports.
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveElectromagneticBubbleChoice,
  hasPendingElectromagneticBubbleChoice,
} from './electromagneticBubbleChoice.resolve.js';
import { resolveElectromagneticBubble } from '../rules/tacticHandlers.js';
import type { LegendaryGameState, PendingElectromagneticBubbleChoice } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';

const XMEN_A = 'core/wolverine/wolverine#0' as CardExtId;
const XMEN_B = 'core/cyclops/cyclops#0' as CardExtId;
const NON_XMEN = 'core/iron-man/iron-man#0' as CardExtId;

/** Minimal single-player LegendaryGameState for the Electromagnetic Bubble flow. */
function makeTestGameState(
  overrides: {
    inPlay?: CardExtId[];
    cardTraits?: Record<string, { team?: string; heroClass?: string }>;
    pendingElectromagneticBubbleChoices?: PendingElectromagneticBubbleChoice[];
  } = {},
): LegendaryGameState {
  const state = {
    currentStage: 'main',
    playerZones: {
      '0': { deck: [], hand: [], discard: [], inPlay: overrides.inPlay ?? [], victory: [] },
    },
    piles: { bystanders: [], wounds: [], officers: [], sidekicks: [], horrors: [] },
    messages: [],
    counters: {},
    hookRegistry: [],
    villainAbilityHooks: [],
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: {},
    ko: [],
    attachedBystanders: {},
    villainAttachedHeroes: {},
    turnEconomy: { attack: 10, recruit: 10, spentAttack: 0, spentRecruit: 0, piercing: 0, woundsDrawn: 0 },
    cardStats: {},
    cardKeywords: {},
    heroDeck: [],
    escapedPile: [],
    mastermind: {
      id: 'test-mastermind', baseCardId: 'test-mastermind-base',
      tacticsDeck: [], tacticsDefeated: [], strikePile: [], attachedBystanders: [],
    },
    scheme: { twistPile: [] },
    notableEvents: [],
    city: [null, null, null, null, null],
    hq: [null, null, null, null, null],
    cardDisplayData: {},
    cardTraits: overrides.cardTraits ?? {},
    schemeSetupInstructions: [],
    heroAbilityHooks: [],
    lobby: { requiredPlayers: 1, ready: {}, started: false },
  } as unknown as LegendaryGameState;
  if (overrides.pendingElectromagneticBubbleChoices !== undefined) {
    state.pendingElectromagneticBubbleChoices = overrides.pendingElectromagneticBubbleChoices;
  }
  return state;
}

function makeMoveContext(
  gameState: LegendaryGameState,
  playerId: string = '0',
): Parameters<typeof resolveElectromagneticBubbleChoice>[0] {
  return {
    G: gameState,
    ctx: { numPlayers: 1, currentPlayer: playerId, phase: 'play', turn: 1, playOrder: ['0'], playOrderPos: 0, activePlayers: null },
    events: { endTurn: mock.fn(), setPhase: mock.fn(), endPhase: mock.fn(), setStage: mock.fn(), endStage: mock.fn(), pass: mock.fn(), endGame: mock.fn() },
    random: { Shuffle: <T>(d: T[]): T[] => [...d].reverse(), D4: mock.fn(), D6: mock.fn(), D10: mock.fn(), D12: mock.fn(), D20: mock.fn(), Die: mock.fn(), Number: mock.fn() },
    playerID: playerId,
    log: { setMetadata: mock.fn() },
  } as unknown as Parameters<typeof resolveElectromagneticBubbleChoice>[0];
}

describe('resolveElectromagneticBubble resolver (WP-695 / D-24512)', () => {
  it('is a logged no-op with 0 in-play X-Men Heroes', () => {
    const G = makeTestGameState({ inPlay: [NON_XMEN], cardTraits: { [NON_XMEN]: { team: 'avengers' } } });
    resolveElectromagneticBubble(G, '0');
    assert.equal(G.pendingElectromagneticBubbleChoices, undefined, 'no park');
    assert.equal(G.deferredHandInjections, undefined, 'no injection recorded');
    assert.ok(G.messages.length > 0, 'logged the no-op');
  });

  it('auto-records the deferred injection inline with exactly 1 in-play X-Men Hero', () => {
    const G = makeTestGameState({ inPlay: [XMEN_A, NON_XMEN], cardTraits: { [XMEN_A]: { team: 'x-men' }, [NON_XMEN]: { team: 'avengers' } } });
    resolveElectromagneticBubble(G, '0');
    assert.equal(G.pendingElectromagneticBubbleChoices, undefined, 'no park for a single eligible Hero');
    assert.deepStrictEqual(G.deferredHandInjections?.['0'], [XMEN_A], 'sole X-Men recorded for next hand');
  });

  it('parks a pick with ≥2 in-play X-Men Heroes', () => {
    const G = makeTestGameState({ inPlay: [XMEN_A, XMEN_B], cardTraits: { [XMEN_A]: { team: 'x-men' }, [XMEN_B]: { team: 'x-men' } } });
    resolveElectromagneticBubble(G, '0');
    assert.equal(G.deferredHandInjections, undefined, 'no injection until the pick resolves');
    assert.equal(G.pendingElectromagneticBubbleChoices?.length, 1, 'one entry parked');
    assert.deepStrictEqual(G.pendingElectromagneticBubbleChoices![0]!.eligibleCardIds, [XMEN_A, XMEN_B]);
  });

  it('does not false-match a heroClass-only card (team-only eligibility)', () => {
    const G = makeTestGameState({ inPlay: [NON_XMEN], cardTraits: { [NON_XMEN]: { heroClass: 'x-men' } } });
    resolveElectromagneticBubble(G, '0');
    assert.equal(G.deferredHandInjections, undefined, 'heroClass is not the team trait');
    assert.equal(G.pendingElectromagneticBubbleChoices, undefined);
  });
});

describe('resolveElectromagneticBubbleChoice move (WP-695 / D-24512)', () => {
  function twoChoice(): PendingElectromagneticBubbleChoice {
    return { choiceType: 'electromagnetic-bubble', playerID: '0', eligibleCardIds: [XMEN_A, XMEN_B] };
  }

  it('records the chosen X-Men Hero as a deferred injection and front-pops', () => {
    const G = makeTestGameState({ inPlay: [XMEN_A, XMEN_B], pendingElectromagneticBubbleChoices: [twoChoice()] });
    resolveElectromagneticBubbleChoice(makeMoveContext(G), { cardId: XMEN_B });
    assert.deepStrictEqual(G.deferredHandInjections?.['0'], [XMEN_B], 'chosen Hero recorded');
    assert.equal(G.pendingElectromagneticBubbleChoices?.length, 0, 'queue front-popped');
  });

  it('is a silent no-op on a non-eligible pick, wrong player, and empty queue', () => {
    const G1 = makeTestGameState({ pendingElectromagneticBubbleChoices: [twoChoice()] });
    resolveElectromagneticBubbleChoice(makeMoveContext(G1), { cardId: 'not-eligible' as CardExtId });
    assert.equal(G1.deferredHandInjections, undefined, 'non-eligible pick ignored');
    assert.equal(G1.pendingElectromagneticBubbleChoices?.length, 1, 'queue intact');

    const G2 = makeTestGameState({ pendingElectromagneticBubbleChoices: [twoChoice()] });
    resolveElectromagneticBubbleChoice(makeMoveContext(G2, '1'), { cardId: XMEN_A });
    assert.equal(G2.deferredHandInjections, undefined, 'wrong player ignored');

    const G3 = makeTestGameState();
    resolveElectromagneticBubbleChoice(makeMoveContext(G3), { cardId: XMEN_A });
    assert.equal(G3.deferredHandInjections, undefined, 'empty queue ignored');
  });

  it('hasPendingElectromagneticBubbleChoice reflects the queue', () => {
    assert.equal(hasPendingElectromagneticBubbleChoice(makeTestGameState()), false);
    assert.equal(hasPendingElectromagneticBubbleChoice(makeTestGameState({ pendingElectromagneticBubbleChoices: [twoChoice()] })), true);
  });
});
