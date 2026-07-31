/**
 * Tests for the resolveScryKoChoice move (WP-470 / D-24282) and the
 * hasPendingScryKoChoice block-all predicate.
 *
 * Covers: resolve KOs the chosen revealed card and leaves the other on top +
 * front-pop; a cardId NOT in the revealed snapshot / a wrong playerID / an empty
 * queue / a cardId absent from the deck are silent no-ops that leave the queue
 * intact; hasPendingScryKoChoice; block-all no-op on an action move while pending;
 * the resolver itself is NOT blocked.
 *
 * Uses node:test + node:assert only. No boardgame.io testing imports.
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveScryKoChoice,
  hasPendingScryKoChoice,
} from './scryKoChoice.resolve.js';
import { playCard } from './coreMoves.impl.js';
import type { LegendaryGameState, PendingScryKoChoice } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';

const WOUND = 'pile-wound' as CardExtId;
const HERO = 'core/spider-man/spider-man#0' as CardExtId;
const DEEP = 'core/x/deep#0' as CardExtId;

/**
 * Creates a minimal LegendaryGameState for testing the scry-KO flow.
 *
 * @param overrides - Selective overrides for player "0" deck/hand, the pending
 *   scry-KO queue, and current stage.
 */
function makeTestGameState(
  overrides: {
    deck?: CardExtId[];
    hand?: CardExtId[];
    pendingScryKoChoices?: PendingScryKoChoice[];
    currentStage?: LegendaryGameState['currentStage'];
  } = {},
): LegendaryGameState {
  const state = {
    matchConfiguration: {
      schemeId: 'test-scheme',
      mastermindId: 'test-mastermind',
      villainGroupIds: [],
      henchmanGroupIds: [],
      heroDeckIds: [],
      bystandersCount: 0,
      woundsCount: 0,
      officersCount: 0,
      sidekicksCount: 0,
    },
    selection: {
      schemeId: 'test-scheme',
      mastermindId: 'test-mastermind',
      villainGroupIds: [],
      henchmanGroupIds: [],
      heroDeckIds: [],
    },
    currentStage: overrides.currentStage ?? 'main',
    playerZones: {
      '0': {
        deck: overrides.deck ?? [],
        hand: overrides.hand ?? [],
        discard: [],
        inPlay: [],
        victory: [],
      },
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
      id: 'test-mastermind',
      baseCardId: 'test-mastermind-base',
      tacticsDeck: ['tactic-0'] as CardExtId[],
      tacticsDefeated: [],
      strikePile: [],
      attachedBystanders: [],
    },
    scheme: { twistPile: [] },
    notableEvents: [],
    city: [null, null, null, null, null],
    hq: [null, null, null, null, null],
    cardDisplayData: {},
    cardTraits: {},
    schemeSetupInstructions: [],
    heroAbilityHooks: [],
    lobby: { requiredPlayers: 1, ready: {}, started: false },
  } as unknown as LegendaryGameState;

  if (overrides.pendingScryKoChoices !== undefined) {
    state.pendingScryKoChoices = overrides.pendingScryKoChoices;
  }
  return state;
}

/** Builds a move context for the move under test. */
function makeMoveContext(
  gameState: LegendaryGameState,
  playerId: string = '0',
): Parameters<typeof resolveScryKoChoice>[0] {
  return {
    G: gameState,
    ctx: {
      numPlayers: 1,
      currentPlayer: playerId,
      phase: 'play',
      turn: 1,
      playOrder: [playerId],
      playOrderPos: 0,
      activePlayers: null,
    },
    events: {
      endTurn: mock.fn(),
      setPhase: mock.fn(),
      endPhase: mock.fn(),
      setStage: mock.fn(),
      endStage: mock.fn(),
      pass: mock.fn(),
      endGame: mock.fn(),
    },
    random: {
      Shuffle: <T>(deck: T[]): T[] => [...deck].reverse(),
      D4: mock.fn(), D6: mock.fn(), D10: mock.fn(), D12: mock.fn(), D20: mock.fn(),
      Die: mock.fn(), Number: mock.fn(),
    },
    playerID: playerId,
    log: { setMetadata: mock.fn() },
  } as unknown as Parameters<typeof resolveScryKoChoice>[0];
}

function scryChoice(revealedCardIds: CardExtId[]): PendingScryKoChoice {
  return { choiceType: 'scry-ko', playerID: '0', revealedCardIds };
}

describe('resolveScryKoChoice (WP-470 / D-24282)', () => {
  it('KOs the chosen revealed card, leaves the other on top, and front-pops the queue', () => {
    const G = makeTestGameState({
      deck: [WOUND, HERO, DEEP],
      pendingScryKoChoices: [scryChoice([WOUND, HERO])],
    });
    resolveScryKoChoice(makeMoveContext(G), { cardId: WOUND });
    assert.deepStrictEqual(G.ko, [WOUND], 'the chosen card was KO’d');
    assert.deepStrictEqual(
      G.playerZones['0']!.deck,
      [HERO, DEEP],
      'the other revealed card stays on top; deeper cards untouched',
    );
    assert.equal(G.pendingScryKoChoices?.length, 0, 'the queue was front-popped');
  });

  it('can KO the SECOND revealed card, leaving the first on top', () => {
    const G = makeTestGameState({
      deck: [WOUND, HERO, DEEP],
      pendingScryKoChoices: [scryChoice([WOUND, HERO])],
    });
    resolveScryKoChoice(makeMoveContext(G), { cardId: HERO });
    assert.deepStrictEqual(G.ko, [HERO], 'the second revealed card was KO’d');
    assert.deepStrictEqual(
      G.playerZones['0']!.deck,
      [WOUND, DEEP],
      'the first revealed card stays on top',
    );
    assert.equal(G.pendingScryKoChoices?.length, 0);
  });

  it('is a silent no-op when the cardId is NOT one of the revealed cards (queue intact)', () => {
    const G = makeTestGameState({
      deck: [WOUND, HERO, DEEP],
      pendingScryKoChoices: [scryChoice([WOUND, HERO])],
    });
    resolveScryKoChoice(makeMoveContext(G), { cardId: DEEP });
    assert.deepStrictEqual(G.ko, [], 'nothing KO’d — DEEP was not revealed');
    assert.deepStrictEqual(G.playerZones['0']!.deck, [WOUND, HERO, DEEP], 'deck unchanged');
    assert.equal(G.pendingScryKoChoices?.length, 1, 'the queue is left intact for resubmit');
  });

  it('is a silent no-op on a wrong playerID (queue intact)', () => {
    const G = makeTestGameState({
      deck: [WOUND, HERO],
      pendingScryKoChoices: [scryChoice([WOUND, HERO])],
    });
    resolveScryKoChoice(makeMoveContext(G, '1'), { cardId: WOUND });
    assert.deepStrictEqual(G.ko, []);
    assert.equal(G.pendingScryKoChoices?.length, 1, 'front.playerID mismatch leaves the queue intact');
  });

  it('is a silent no-op on an empty queue', () => {
    const G = makeTestGameState({ deck: [WOUND, HERO], pendingScryKoChoices: [] });
    resolveScryKoChoice(makeMoveContext(G), { cardId: WOUND });
    assert.deepStrictEqual(G.ko, []);
    assert.deepStrictEqual(G.playerZones['0']!.deck, [WOUND, HERO]);
  });

  it('is a silent no-op on an empty / non-string cardId', () => {
    const G = makeTestGameState({
      deck: [WOUND, HERO],
      pendingScryKoChoices: [scryChoice([WOUND, HERO])],
    });
    resolveScryKoChoice(makeMoveContext(G), { cardId: '' as CardExtId });
    assert.equal(G.pendingScryKoChoices?.length, 1, 'empty cardId is rejected before any mutation');
    assert.deepStrictEqual(G.ko, []);
  });

  it('is a silent no-op when the revealed cardId is somehow absent from the deck (queue intact)', () => {
    // why: defensive — the block-all guard freezes the deck, so this is unreachable in
    // practice, but the move must still no-op safely rather than throw or corrupt state.
    const G = makeTestGameState({
      deck: [DEEP],
      pendingScryKoChoices: [scryChoice([WOUND, HERO])],
    });
    resolveScryKoChoice(makeMoveContext(G), { cardId: WOUND });
    assert.deepStrictEqual(G.ko, [], 'nothing KO’d — WOUND is not in the deck');
    assert.equal(G.pendingScryKoChoices?.length, 1, 'the queue is left intact');
  });

  it('hasPendingScryKoChoice reflects the queue state', () => {
    assert.equal(hasPendingScryKoChoice(makeTestGameState()), false, 'undefined queue → false');
    assert.equal(hasPendingScryKoChoice(makeTestGameState({ pendingScryKoChoices: [] })), false, 'empty → false');
    assert.equal(
      hasPendingScryKoChoice(makeTestGameState({ pendingScryKoChoices: [scryChoice([WOUND, HERO])] })),
      true,
      'non-empty → true',
    );
  });

  it('block-all: an action move (playCard) is a no-op while a scry-KO choice is pending', () => {
    const G = makeTestGameState({
      hand: [HERO],
      deck: [WOUND, DEEP],
      pendingScryKoChoices: [scryChoice([WOUND, DEEP])],
    });
    // why: with the scry choice parked, playCard must leave the hand untouched — the
    // board is frozen until the player resolves the scry-KO.
    playCard(makeMoveContext(G) as never, { cardId: HERO } as never);
    assert.deepStrictEqual(G.playerZones['0']!.hand, [HERO], 'hand unchanged — playCard was blocked');
    assert.equal(G.pendingScryKoChoices?.length, 1, 'the pending choice is untouched');
  });
});
