/**
 * Dodge move tests for WP-275 / EC-306 / D-24051.
 *
 * Verifies dodgeCard follows the three-step validation contract, gates to the
 * main stage, respects the existing block-all guards, discards an eligible Dodge
 * card from hand and draws exactly one replacement, leaves G byte-identical on
 * every ineligible call (silent no-op proven by a JSON deep-equality snapshot),
 * pushes the byte-locked log line, and never routes the dodged card through the
 * play pipeline.
 *
 * Uses node:test and node:assert only. Uses makeMockCtx. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dodgeCard } from './dodgeCard.js';
import type { LegendaryGameState } from '../types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { makeMockMoveContext } from '../test/mockMoveContext.js';
import type { MockMoveContext } from '../test/mockMoveContext.js';
import { makeGlobalPiles, makeMastermindState, makePlayerZones, makeTurnEconomy } from '../test/fixtureBuilders.js';

// ---------------------------------------------------------------------------
// Mock G factory + move context
// ---------------------------------------------------------------------------

interface DodgeStateOptions {
  hand?: string[];
  deck?: string[];
  discard?: string[];
  inPlay?: string[];
  currentStage?: LegendaryGameState['currentStage'];
  heroAbilityHooks?: HeroAbilityHook[];
  pendingKoHeroChoices?: LegendaryGameState['pendingKoHeroChoices'];
  pendingOptionalKoRewards?: LegendaryGameState['pendingOptionalKoRewards'];
}

/** A dodge hook exactly as the parser emits it: onPlay + no-magnitude effect. */
function dodgeHook(cardId: string): HeroAbilityHook {
  return { cardId, timing: 'onPlay', keywords: ['dodge'], effects: [{ type: 'dodge' }] };
}

/**
 * Builds a minimal LegendaryGameState for dodge tests. Player 0 owns all zones;
 * the stage defaults to main and the dodge eligibility hook is supplied by tests.
 */
function createDodgeState(options?: DodgeStateOptions): LegendaryGameState {
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

  const state: LegendaryGameState = {
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
        inPlay: options?.inPlay ?? [],
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
    lobby: { requiredPlayers: 1, ready: {}, started: false },
    heroAbilityHooks: options?.heroAbilityHooks ?? [],
  };

  if (options?.pendingKoHeroChoices !== undefined) {
    state.pendingKoHeroChoices = options.pendingKoHeroChoices;
  }
  if (options?.pendingOptionalKoRewards !== undefined) {
    state.pendingOptionalKoRewards = options.pendingOptionalKoRewards;
  }

  return state;
}

/** Builds a dodgeCard move context bound to the given G (player 0's turn). */
function createMoveContext(gameState: LegendaryGameState): MockMoveContext {
  // why: delegates to the shared builder so this mock carries the COMPLETE
  // boardgame.io plugin-API surface. The local literal it replaced implemented
  // only the members the engine calls, which is a structurally invalid mock
  // rather than a smaller one (WP-569 / D-24378).
  return makeMockMoveContext(gameState);
}

/** Snapshots G via JSON, runs the move, asserts G is byte-identical (silent no-op). */
function assertSilentNoOp(gameState: LegendaryGameState, cardId: unknown, label: string): void {
  const before = JSON.parse(JSON.stringify(gameState));
  // why: the move never throws on any input; the assertion is the deep-equality snapshot.
  dodgeCard(createMoveContext(gameState), { cardId: cardId as string });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(gameState)), before, label);
}

// ---------------------------------------------------------------------------
// Honest fix — discard + draw
// ---------------------------------------------------------------------------

describe('dodgeCard — honest fix (discard one Dodge card from hand, draw one replacement)', () => {
  it('removes the dodge card from hand, appends it to discard, and draws one replacement (deck non-empty)', () => {
    const gameState = createDodgeState({
      hand: ['DODGE', 'keep'],
      deck: ['REPL', 'deck-2'],
      discard: ['old'],
      heroAbilityHooks: [dodgeHook('DODGE')],
    });

    dodgeCard(createMoveContext(gameState), { cardId: 'DODGE' });
    const zones = gameState.playerZones['0']!;

    // Hand net 0 (one out, one in); DODGE left exactly once; REPL drawn into hand.
    assert.equal(zones.hand.length, 2, 'hand net change is 0 (one card out, one in)');
    assert.equal(zones.hand.includes('DODGE'), false, 'the dodged card left the hand');
    assert.ok(zones.hand.includes('keep'), 'the untouched hand card stays');
    assert.ok(zones.hand.includes('REPL'), 'the deck-top replacement entered the hand');

    // Discard +1: the dodged card appended exactly once.
    assert.deepStrictEqual(zones.discard, ['old', 'DODGE'], 'the dodged card is appended to discard exactly once');

    // Deck −1: the drawn replacement removed off the top.
    assert.deepStrictEqual(zones.deck, ['deck-2'], 'the replacement was drawn off the deck top');
  });

  it('removes exactly ONE copy when the hand holds duplicates of the dodge card', () => {
    const gameState = createDodgeState({
      hand: ['DODGE', 'DODGE', 'keep'],
      deck: ['REPL'],
      heroAbilityHooks: [dodgeHook('DODGE')],
    });

    dodgeCard(createMoveContext(gameState), { cardId: 'DODGE' });
    const zones = gameState.playerZones['0']!;

    assert.equal(
      zones.hand.filter((card) => card === 'DODGE').length,
      1,
      'exactly one DODGE copy left the hand (remove-once)',
    );
    assert.deepStrictEqual(zones.discard, ['DODGE'], 'exactly one DODGE copy appended to discard (append-once)');
    assert.ok(zones.hand.includes('REPL'), 'one replacement drawn');
  });

  it('pushes exactly the byte-locked G.messages line', () => {
    const gameState = createDodgeState({
      hand: ['DODGE'],
      deck: ['REPL'],
      heroAbilityHooks: [dodgeHook('DODGE')],
    });
    const messagesBefore = gameState.messages.length;

    dodgeCard(createMoveContext(gameState), { cardId: 'DODGE' });

    assert.equal(gameState.messages.length - messagesBefore, 1, 'exactly one G.messages line is pushed');
    assert.equal(
      gameState.messages[gameState.messages.length - 1]!.text,
      'Player 0 dodged DODGE (DODGE) (discarded from hand, drew 1 replacement)',
      'the dodge log line matches the byte-locked format exactly',
    );
  });

  it('never contains a timestamp, date, or other non-deterministic context in the log line', () => {
    const gameState = createDodgeState({
      hand: ['DODGE'],
      deck: ['REPL'],
      heroAbilityHooks: [dodgeHook('DODGE')],
    });

    dodgeCard(createMoveContext(gameState), { cardId: 'DODGE' });
    const lastMessage = gameState.messages[gameState.messages.length - 1]!.text;

    assert.equal(/\d{4}-\d{2}-\d{2}/.test(lastMessage), false, 'no date pattern (YYYY-MM-DD)');
    assert.equal(/T\d{2}:\d{2}:\d{2}/.test(lastMessage), false, 'no ISO timestamp pattern');
    assert.equal(/\d{13}/.test(lastMessage), false, 'no millisecond unix timestamp');
  });

  it('JSON.stringify(G) succeeds after a dodge (G stays serializable)', () => {
    const gameState = createDodgeState({
      hand: ['DODGE'],
      deck: ['REPL'],
      heroAbilityHooks: [dodgeHook('DODGE')],
    });

    dodgeCard(createMoveContext(gameState), { cardId: 'DODGE' });
    assert.ok(JSON.stringify(gameState), 'JSON.stringify(G) must produce a non-empty string');
  });

  it('empty-deck edge: the dodged card is reshuffled and drawn straight back (rule-correct, no throw)', () => {
    // why: D-24051 — discard-before-draw means the dodged card is non-empty discard when the
    // deck is empty; drawCardsIntoHand reshuffles the discard into the deck and draws it back.
    const gameState = createDodgeState({
      hand: ['DODGE'],
      deck: [],
      discard: [],
      heroAbilityHooks: [dodgeHook('DODGE')],
    });

    dodgeCard(createMoveContext(gameState), { cardId: 'DODGE' });
    const zones = gameState.playerZones['0']!;

    assert.deepStrictEqual(zones.hand, ['DODGE'], 'the dodged card is reshuffled and drawn straight back into hand');
    assert.deepStrictEqual(zones.discard, [], 'the discard is emptied by the reshuffle');
    assert.deepStrictEqual(zones.deck, [], 'the deck is empty again after drawing the one reshuffled card');
  });
});

// ---------------------------------------------------------------------------
// Play-path exclusion — "ignore all the other text on that card"
// ---------------------------------------------------------------------------

describe('dodgeCard — play-path exclusion ("ignore all other text")', () => {
  it('dodging a card that ALSO declares an onPlay draw effect does NOT fire that effect', () => {
    // why: D-24051 — the dodged card is discarded, never played, so its other abilities never
    // execute. If the onPlay draw:2 had fired, the deck would shrink by 3 (1 dodge replacement +
    // 2 from the draw); a deck −1 proves only the dodge replacement was drawn (play-path excluded).
    const dodgeAndDrawHook: HeroAbilityHook = {
      cardId: 'DODGE-DRAW',
      timing: 'onPlay',
      keywords: ['dodge', 'draw'],
      effects: [{ type: 'dodge' }, { type: 'draw', magnitude: 2 }],
    };
    const gameState = createDodgeState({
      hand: ['DODGE-DRAW', 'keep'],
      deck: ['r1', 'r2', 'r3'],
      heroAbilityHooks: [dodgeAndDrawHook],
    });

    dodgeCard(createMoveContext(gameState), { cardId: 'DODGE-DRAW' });
    const zones = gameState.playerZones['0']!;

    assert.deepStrictEqual(zones.deck, ['r2', 'r3'], 'only ONE replacement drawn — the onPlay draw effect never fired');
    assert.equal(zones.hand.length, 2, 'hand net 0 — no extra draw cards entered the hand');
    assert.ok(zones.hand.includes('r1'), 'the single dodge replacement is r1');
    assert.deepStrictEqual(zones.discard, ['DODGE-DRAW'], 'the dodged card landed in discard, was never played');
  });
});

// ---------------------------------------------------------------------------
// Silent no-ops — every ineligible call leaves G byte-identical
// ---------------------------------------------------------------------------

describe('dodgeCard — silent no-op on ineligible calls (deep-equality snapshot)', () => {
  it('a non-dodge card in hand is a silent no-op', () => {
    const gameState = createDodgeState({
      hand: ['NON-DODGE'],
      deck: ['REPL'],
      heroAbilityHooks: [
        { cardId: 'NON-DODGE', timing: 'onPlay', keywords: ['draw'], effects: [{ type: 'draw', magnitude: 1 }] },
      ],
    });
    assertSilentNoOp(gameState, 'NON-DODGE', 'a non-dodge card must not mutate G');
  });

  it('a card not in hand is a silent no-op (even with a dodge hook elsewhere)', () => {
    const gameState = createDodgeState({
      hand: ['other'],
      deck: ['REPL'],
      heroAbilityHooks: [dodgeHook('DODGE')],
    });
    assertSilentNoOp(gameState, 'DODGE', 'a card absent from hand must not mutate G');
  });

  it('the wrong stage (cleanup) is a silent no-op', () => {
    const gameState = createDodgeState({
      hand: ['DODGE'],
      deck: ['REPL'],
      currentStage: 'cleanup',
      heroAbilityHooks: [dodgeHook('DODGE')],
    });
    assertSilentNoOp(gameState, 'DODGE', 'a non-main stage must not mutate G');
  });

  it('a pending KO-a-Hero choice (board frozen) is a silent no-op', () => {
    const gameState = createDodgeState({
      hand: ['DODGE'],
      deck: ['REPL'],
      heroAbilityHooks: [dodgeHook('DODGE')],
      pendingKoHeroChoices: [{ playerID: '0', choiceType: 'ko-hero' }],
    });
    assertSilentNoOp(gameState, 'DODGE', 'a pending KO-a-Hero choice must freeze the board (no mutation)');
  });

  it('a pending optional-KO-reward choice (board frozen) is a silent no-op', () => {
    const gameState = createDodgeState({
      hand: ['DODGE'],
      deck: ['REPL'],
      heroAbilityHooks: [dodgeHook('DODGE')],
      pendingOptionalKoRewards: [
        { playerID: '0', rewardType: 'draw', rewardMagnitude: 1, sourceCardId: 'src' },
      ],
    });
    assertSilentNoOp(gameState, 'DODGE', 'a pending optional-KO-reward choice must freeze the board (no mutation)');
  });

  it('an empty / non-string cardId is a silent no-op', () => {
    const gameState = createDodgeState({
      hand: ['DODGE'],
      deck: ['REPL'],
      heroAbilityHooks: [dodgeHook('DODGE')],
    });
    assertSilentNoOp(gameState, '', 'an empty cardId must not mutate G');
    assertSilentNoOp(gameState, undefined, 'an undefined cardId must not mutate G');
  });
});
