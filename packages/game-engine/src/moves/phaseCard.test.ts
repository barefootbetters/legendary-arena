/**
 * Phasing move tests for WP-783 / EC-820 / D-24629.
 *
 * Verifies phaseCard follows the move validation contract, gates to the main
 * stage and to "no pending choice", swaps a Phasing card in hand with the top
 * card of the deck (exact arrays), reshuffles the discard into the deck when the
 * deck is empty, is neither a draw nor a play (turnEconomy untouched, drawsLocked
 * ignored), has no per-turn limit, accepts a split card's face-b id, and keeps
 * the card taken into hand out of the public log. phasingOptions — the single
 * legality predicate — is checked to agree with the move in every case.
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { phaseCard, phasingOptions } from './phaseCard.js';
import type { LegendaryGameState } from '../types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import { makeMockMoveContext } from '../test/mockMoveContext.js';
import { makeGlobalPiles, makeMastermindState, makePlayerZones, makeTurnEconomy } from '../test/fixtureBuilders.js';

// ---------------------------------------------------------------------------
// Mock G factory + helpers
// ---------------------------------------------------------------------------

interface PhasingStateOptions {
  hand?: string[];
  deck?: string[];
  discard?: string[];
  currentStage?: LegendaryGameState['currentStage'];
  heroAbilityHooks?: HeroAbilityHook[];
}

/** A phasing hook exactly as the parser emits it: onPlay + no-magnitude effect. */
function phasingHook(cardId: string): HeroAbilityHook {
  return { cardId, timing: 'onPlay', keywords: ['phasing'], effects: [{ type: 'phasing' }] };
}

/**
 * Builds a minimal LegendaryGameState for Phasing tests. Player 0 owns all
 * zones; the stage defaults to main.
 *
 * @param options - Zone contents, stage, and hooks for the test.
 * @returns A fresh game state.
 */
function createPhasingState(options?: PhasingStateOptions): LegendaryGameState {
  const config = {
    schemeId: 'test-scheme',
    mastermindId: 'test-mastermind',
    villainGroupIds: [],
    henchmanGroupIds: [],
    heroDeckIds: [],
    bystandersCount: 0,
    woundsCount: 0,
    officersCount: 0,
    sidekicksCount: 0,
  };

  return {
    matchConfiguration: config,
    selection: {
      schemeId: config.schemeId,
      mastermindId: config.mastermindId,
      villainGroupIds: [],
      henchmanGroupIds: [],
      heroDeckIds: [],
    },
    currentStage: options?.currentStage ?? 'main',
    playerZones: {
      '0': { ...makePlayerZones(),
        deck: options?.deck ?? [],
        hand: options?.hand ?? [],
        discard: options?.discard ?? [],
        inPlay: [],
        victory: [],
      },
    },
    piles: { ...makeGlobalPiles(), bystanders: [], wounds: [], officers: [], sidekicks: [] },
    messages: [],
    counters: {},
    hookRegistry: [],
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: {},
    ko: [],
    attachedBystanders: {},
    turnEconomy: { ...makeTurnEconomy(), attack: 0, recruit: 0, spentAttack: 0, spentRecruit: 0 },
    cardStats: {},
    mastermind: { ...makeMastermindState(),
      id: 'test-mastermind',
      baseCardId: 'test-mastermind-base',
      tacticsDeck: [],
      tacticsDefeated: [],
    },
    city: [null, null, null, null, null],
    hq: [null, null, null, null, null],
    heroDeck: [],
    transformDeck: [],
    transformTargets: {},
    villainAttachedHeroes: {},
    scheme: { twistPile: [] },
    escapedPile: [],
    cardTraits: {},
    cardKeywords: {},
    cardDisplayData: {},
    schemeSetupInstructions: [],
    villainAbilityHooks: [],
    notableEvents: [],
    lobby: { requiredPlayers: 1, ready: {}, started: false },
    heroAbilityHooks: options?.heroAbilityHooks ?? [],
  };
}

/**
 * Runs phaseCard for player 0 against the given state.
 *
 * @param gameState - The state the move mutates.
 * @param cardId - The card id argument (typed loosely to exercise bad args).
 */
function runPhase(gameState: LegendaryGameState, cardId: unknown): void {
  phaseCard(makeMockMoveContext(gameState), { cardId: cardId as string });
}

/**
 * Snapshots G via JSON, runs the move, and asserts G is byte-identical (silent no-op).
 *
 * @param gameState - The state to check.
 * @param cardId - The card id argument.
 * @param label - The assertion label.
 */
function assertSilentNoOp(gameState: LegendaryGameState, cardId: unknown, label: string): void {
  const before = JSON.parse(JSON.stringify(gameState));
  runPhase(gameState, cardId);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(gameState)), before, label);
}

// ---------------------------------------------------------------------------
// The swap
// ---------------------------------------------------------------------------

describe('phaseCard — swap a Phasing card in hand with the top card of the deck', () => {
  it('moves the Phasing card to deck[0] and the old top card to the end of the hand (exact arrays)', () => {
    const gameState = createPhasingState({
      hand: ['keep-a', 'PHASE', 'keep-b'],
      deck: ['TOP', 'deck-2', 'deck-3'],
      discard: ['old'],
      heroAbilityHooks: [phasingHook('PHASE')],
    });

    assert.deepStrictEqual(phasingOptions(gameState, '0'), ['PHASE'], 'the predicate offers the Phasing card');
    runPhase(gameState, 'PHASE');
    const zones = gameState.playerZones['0']!;

    assert.deepStrictEqual(zones.hand, ['keep-a', 'keep-b', 'TOP'], 'hand = old hand without PHASE, old top card last');
    assert.deepStrictEqual(zones.deck, ['PHASE', 'deck-2', 'deck-3'], 'deck = [PHASE, ...oldDeck.slice(1)]');
    assert.deepStrictEqual(zones.discard, ['old'], 'the discard pile is untouched');
  });

  it('removes exactly ONE copy when the hand holds two copies of the Phasing card', () => {
    const gameState = createPhasingState({
      hand: ['PHASE', 'PHASE'],
      deck: ['TOP'],
      heroAbilityHooks: [phasingHook('PHASE')],
    });

    assert.deepStrictEqual(phasingOptions(gameState, '0'), ['PHASE'], 'distinct ids only');
    runPhase(gameState, 'PHASE');
    const zones = gameState.playerZones['0']!;

    assert.deepStrictEqual(zones.hand, ['PHASE', 'TOP'], 'one copy left the hand, the top card arrived');
    assert.deepStrictEqual(zones.deck, ['PHASE'], 'one copy sits on top of the deck');
  });

  it('lists every distinct Phasing card in hand order', () => {
    const gameState = createPhasingState({
      hand: ['PHASE-B', 'plain', 'PHASE-A', 'PHASE-B'],
      deck: ['TOP'],
      heroAbilityHooks: [phasingHook('PHASE-A'), phasingHook('PHASE-B')],
    });
    assert.deepStrictEqual(phasingOptions(gameState, '0'), ['PHASE-B', 'PHASE-A']);
  });

  it('two phases in one turn both apply (no per-turn limit)', () => {
    const gameState = createPhasingState({
      hand: ['PHASE-A', 'PHASE-B'],
      deck: ['TOP-1', 'TOP-2'],
      heroAbilityHooks: [phasingHook('PHASE-A'), phasingHook('PHASE-B')],
    });

    runPhase(gameState, 'PHASE-A');
    runPhase(gameState, 'PHASE-B');
    const zones = gameState.playerZones['0']!;

    assert.deepStrictEqual(zones.hand, ['TOP-1', 'PHASE-A'], 'the second phase took the first phased card back into hand');
    assert.deepStrictEqual(zones.deck, ['PHASE-B', 'TOP-2'], 'the second Phasing card is now on top');
    assert.equal(gameState.messages.length, 2, 'one log line per phase');
  });

  it('accepts the face-b id of a split card (Cloak & Dagger Fight / Flee) in hand', () => {
    // why: setup keys hooks on BOTH faces of a split card (WP-724 / D-24545), and both
    // faces print Phasing, so the alternate-face id resolves the keyword too.
    const faceA = 'cvwr/cloak-dagger/fight#0';
    const faceB = 'cvwr/cloak-dagger/flee#0';
    const gameState = createPhasingState({
      hand: [faceB],
      deck: ['TOP'],
      heroAbilityHooks: [phasingHook(faceA), phasingHook(faceB)],
    });

    assert.deepStrictEqual(phasingOptions(gameState, '0'), [faceB], 'the face-b id is phasable');
    runPhase(gameState, faceB);
    const zones = gameState.playerZones['0']!;
    assert.deepStrictEqual(zones.hand, ['TOP']);
    assert.deepStrictEqual(zones.deck, [faceB]);
  });
});

// ---------------------------------------------------------------------------
// Empty deck
// ---------------------------------------------------------------------------

describe('phaseCard — empty deck', () => {
  it('reshuffles the discard into the deck through the move context, then swaps', () => {
    const gameState = createPhasingState({
      hand: ['PHASE', 'keep'],
      deck: [],
      discard: ['d1', 'd2', 'd3'],
      heroAbilityHooks: [phasingHook('PHASE')],
    });

    assert.deepStrictEqual(phasingOptions(gameState, '0'), ['PHASE'], 'a non-empty discard keeps the card phasable');
    runPhase(gameState, 'PHASE');
    const zones = gameState.playerZones['0']!;

    // why: the mock Shuffle reverses, so the reshuffled deck is ['d3', 'd2', 'd1'];
    // the reversed order proves the shuffle ran through the move context.
    assert.deepStrictEqual(zones.discard, [], 'the discard was reshuffled into the deck');
    assert.equal(zones.deck[0], 'PHASE', 'the phased card is on top of the new deck');
    assert.equal(zones.deck.length, 3, 'deck length equals the old discard length');
    assert.deepStrictEqual(zones.deck, ['PHASE', 'd2', 'd1'], 'the new deck minus its old top card, under the phased card');
    assert.deepStrictEqual(zones.hand, ['keep', 'd3'], 'the new top card went into the hand');
  });

  it('with an empty deck AND an empty discard is a silent no-op and phasingOptions is empty', () => {
    const gameState = createPhasingState({
      hand: ['PHASE'],
      deck: [],
      discard: [],
      heroAbilityHooks: [phasingHook('PHASE')],
    });
    assert.deepStrictEqual(phasingOptions(gameState, '0'), []);
    assertSilentNoOp(gameState, 'PHASE', 'nothing to swap in must not mutate G');
  });
});

// ---------------------------------------------------------------------------
// Not a draw, not a play
// ---------------------------------------------------------------------------

describe('phaseCard — not a draw, not a play', () => {
  it('leaves turnEconomy byte-identical (no draw count, no play count)', () => {
    const gameState = createPhasingState({
      hand: ['PHASE'],
      deck: ['TOP'],
      heroAbilityHooks: [phasingHook('PHASE')],
    });
    const economyBefore = JSON.stringify(gameState.turnEconomy);

    runPhase(gameState, 'PHASE');

    assert.equal(JSON.stringify(gameState.turnEconomy), economyBefore, 'turnEconomy is untouched');
    assert.deepStrictEqual(gameState.playerZones['0']!.hand, ['TOP'], 'the swap happened');
  });

  it('still swaps while a draw lock (drawsLocked) is set', () => {
    const gameState = createPhasingState({
      hand: ['PHASE'],
      deck: ['TOP'],
      heroAbilityHooks: [phasingHook('PHASE')],
    });
    gameState.turnEconomy.drawsLocked = true;

    assert.deepStrictEqual(phasingOptions(gameState, '0'), ['PHASE'], 'the draw lock does not hide the option');
    runPhase(gameState, 'PHASE');

    assert.deepStrictEqual(gameState.playerZones['0']!.hand, ['TOP'], 'the swap is not a draw');
    assert.deepStrictEqual(gameState.playerZones['0']!.deck, ['PHASE']);
    assert.equal(gameState.turnEconomy.drawsLocked, true, 'the lock itself is unchanged');
  });

  it('never fires the phased card\'s other abilities (no attack, no draw)', () => {
    const gameState = createPhasingState({
      hand: ['PHASE'],
      deck: ['TOP', 'deck-2'],
      heroAbilityHooks: [
        phasingHook('PHASE'),
        { cardId: 'PHASE', timing: 'onPlay', keywords: ['attack'], effects: [{ type: 'attack', magnitude: 2 }] },
      ],
    });

    runPhase(gameState, 'PHASE');

    assert.equal(gameState.turnEconomy.attack, 0, 'no attack granted');
    assert.deepStrictEqual(gameState.playerZones['0']!.deck, ['PHASE', 'deck-2'], 'no extra card drawn');
  });
});

// ---------------------------------------------------------------------------
// Log privacy
// ---------------------------------------------------------------------------

describe('phaseCard — log line', () => {
  it('names the phased card and never the card taken into hand', () => {
    const gameState = createPhasingState({
      hand: ['PHASE'],
      deck: ['SECRET-TOP'],
      heroAbilityHooks: [phasingHook('PHASE')],
    });

    runPhase(gameState, 'PHASE');

    assert.equal(gameState.messages.length, 1, 'exactly one log line is pushed');
    const line = gameState.messages[0]!.text;
    assert.equal(
      line,
      'Player 0 phased PHASE (PHASE) onto the top of their deck and took the top card into their hand.',
      'the log line matches the locked format exactly',
    );
    assert.equal(line.includes('SECRET-TOP'), false, 'the card taken into hand stays hidden (G.messages is public)');
  });
});

// ---------------------------------------------------------------------------
// Silent no-ops — every ineligible call leaves G byte-identical
// ---------------------------------------------------------------------------

describe('phaseCard — silent no-op on ineligible calls (deep-equality snapshot)', () => {
  it('a non-Phasing card in hand is a no-op and is not offered', () => {
    const gameState = createPhasingState({
      hand: ['PLAIN'],
      deck: ['TOP'],
      heroAbilityHooks: [
        { cardId: 'PLAIN', timing: 'onPlay', keywords: ['draw'], effects: [{ type: 'draw', magnitude: 1 }] },
      ],
    });
    assert.deepStrictEqual(phasingOptions(gameState, '0'), []);
    assertSilentNoOp(gameState, 'PLAIN', 'a non-Phasing card must not mutate G');
  });

  it('a card not in hand is a no-op (even with a Phasing hook elsewhere)', () => {
    const gameState = createPhasingState({
      hand: ['other'],
      deck: ['PHASE', 'TOP'],
      heroAbilityHooks: [phasingHook('PHASE')],
    });
    assert.deepStrictEqual(phasingOptions(gameState, '0'), []);
    assertSilentNoOp(gameState, 'PHASE', 'a card absent from hand must not mutate G');
  });

  it('the cleanup stage is a no-op and offers nothing', () => {
    const gameState = createPhasingState({
      hand: ['PHASE'],
      deck: ['TOP'],
      currentStage: 'cleanup',
      heroAbilityHooks: [phasingHook('PHASE')],
    });
    assert.deepStrictEqual(phasingOptions(gameState, '0'), []);
    assertSilentNoOp(gameState, 'PHASE', 'a non-main stage must not mutate G');
  });

  it('the start stage is a no-op and offers nothing', () => {
    const gameState = createPhasingState({
      hand: ['PHASE'],
      deck: ['TOP'],
      currentStage: 'start',
      heroAbilityHooks: [phasingHook('PHASE')],
    });
    assert.deepStrictEqual(phasingOptions(gameState, '0'), []);
    assertSilentNoOp(gameState, 'PHASE', 'the start stage must not mutate G');
  });

  it('an empty / non-string cardId is a no-op', () => {
    const gameState = createPhasingState({
      hand: ['PHASE'],
      deck: ['TOP'],
      heroAbilityHooks: [phasingHook('PHASE')],
    });
    assertSilentNoOp(gameState, '', 'an empty cardId must not mutate G');
    assertSilentNoOp(gameState, undefined, 'an undefined cardId must not mutate G');
  });

  it('an absent heroAbilityHooks array offers nothing and never throws', () => {
    const gameState = createPhasingState({ hand: ['PHASE'], deck: ['TOP'] });
    delete (gameState as Partial<LegendaryGameState>).heroAbilityHooks;
    assert.deepStrictEqual(phasingOptions(gameState, '0'), []);
    assertSilentNoOp(gameState, 'PHASE', 'missing hooks must not mutate G');
  });
});

// ---------------------------------------------------------------------------
// Pending choices freeze the board
// ---------------------------------------------------------------------------

describe('phaseCard — a pending choice freezes the board', () => {
  /**
   * Builds a state with a phasable card, then asserts the given pending choice
   * both empties phasingOptions and turns the move into a silent no-op.
   *
   * @param setPending - Opens one pending choice on the state.
   * @param label - The assertion label.
   */
  function assertPendingBlocks(setPending: (gameState: LegendaryGameState) => void, label: string): void {
    const gameState = createPhasingState({
      hand: ['PHASE'],
      deck: ['TOP'],
      heroAbilityHooks: [phasingHook('PHASE')],
    });
    assert.deepStrictEqual(phasingOptions(gameState, '0'), ['PHASE'], 'phasable before the choice opens');
    setPending(gameState);
    assert.deepStrictEqual(phasingOptions(gameState, '0'), [], `${label}: phasingOptions is empty`);
    assertSilentNoOp(gameState, 'PHASE', `${label}: the move is a no-op`);
  }

  it('a pending optional put-bottom-HQ choice blocks Phasing', () => {
    assertPendingBlocks((gameState) => {
      gameState.pendingOptionalPutBottomHQ = [{ playerID: '0', sourceCardId: 'src' }];
    }, 'pendingOptionalPutBottomHQ');
  });

  it('a pending put-any-number-bottom-HQ choice blocks Phasing', () => {
    assertPendingBlocks((gameState) => {
      gameState.pendingPutAnyNumberBottomHQ = [{ playerID: '0', sourceCardId: 'src' }];
    }, 'pendingPutAnyNumberBottomHQ');
  });

  it('a pending KO-a-Hero choice (the dodgeCard cluster) blocks Phasing', () => {
    assertPendingBlocks((gameState) => {
      gameState.pendingKoHeroChoices = [{ playerID: '0', choiceType: 'ko-hero' }];
    }, 'pendingKoHeroChoices');
  });
});

// ---------------------------------------------------------------------------
// Serializability
// ---------------------------------------------------------------------------

describe('phaseCard — G stays serializable', () => {
  it('JSON.stringify(G) succeeds after a phase', () => {
    const gameState = createPhasingState({
      hand: ['PHASE'],
      deck: ['TOP'],
      heroAbilityHooks: [phasingHook('PHASE')],
    });
    runPhase(gameState, 'PHASE');
    assert.ok(JSON.stringify(gameState), 'JSON.stringify(G) must produce a non-empty string');
  });
});
