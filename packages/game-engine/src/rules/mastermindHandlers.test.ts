/**
 * Tests for mastermind strike handler (WP-024, WP-154).
 *
 * Verifies bystander capture on strike, empty-supply logging,
 * negative assertions on city-villain attachedBystanders, and
 * serialization.
 *
 * No boardgame.io imports. Uses node:test and node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mastermindStrikeHandler, selectDiscardToLimitCards } from './mastermindHandlers.js';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { WOUND_EXT_ID } from '../setup/pilesInit.js';
import { makeGlobalPiles, makePlayerZones, makeTurnEconomy } from '../test/fixtureBuilders.js';

// ---------------------------------------------------------------------------
// Test helper
// ---------------------------------------------------------------------------

/**
 * Creates a minimal LegendaryGameState for mastermind handler testing.
 *
 * @returns A minimal LegendaryGameState with populated bystander supply.
 */
function makeTestState(): LegendaryGameState {
  return {
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
    currentStage: 'main' as LegendaryGameState['currentStage'],
    playerZones: {
      '0': { ...makePlayerZones(),
        deck: [],
        hand: [],
        discard: [],
        inPlay: [],
        victory: [],
      },
    },
    piles: { ...makeGlobalPiles(),
      bystanders: ['bystander-001', 'bystander-002', 'bystander-003'],
      wounds: [],
      officers: [],
      sidekicks: [],
    },
    messages: [],
    counters: {},
    hookRegistry: [],
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: {},
    ko: [],
    attachedBystanders: {},
    turnEconomy: { ...makeTurnEconomy(),
      attack: 0,
      recruit: 0,
      spentAttack: 0,
      spentRecruit: 0,
    },
    cardStats: {},
    mastermind: {
      id: 'test-mastermind',
      baseCardId: 'test-mastermind-base',
      tacticsDeck: [],
      tacticsDefeated: [],
      strikePile: [],
      attachedBystanders: [],
    },
    city: [null, null, null, null, null],
    hq: [null, null, null, null, null],
    lobby: { requiredPlayers: 1, ready: {}, started: false },
    heroAbilityHooks: [],
    // why: WP-200 — mastermindStrikeHandler pushes one
    // `mastermindStrikeResolved` event to G.notableEvents at its terminal
    // point. Initialised here so the emission does not throw on a missing
    // field; required by D-20003.
    notableEvents: [],
  };
}

describe('mastermindStrikeHandler', () => {
  // -------------------------------------------------------------------------
  // Test 1: handler returns non-empty RuleEffect[]
  // -------------------------------------------------------------------------
  it('returns non-empty RuleEffect[]', () => {
    const gameState = makeTestState();
    const effects = mastermindStrikeHandler(gameState, {}, { cardId: 'test-strike' });

    assert.ok(Array.isArray(effects), 'result must be an array');
    assert.ok(effects.length > 0, 'result must not be empty');
  });

  // -------------------------------------------------------------------------
  // Test 2: produces counter increment effect
  // -------------------------------------------------------------------------
  it('produces modifyCounter effect for masterStrikeCount', () => {
    const gameState = makeTestState();
    const effects = mastermindStrikeHandler(gameState, {}, { cardId: 'test-strike' });

    const counterEffect = effects.find(
      (effect) =>
        effect.type === 'modifyCounter' &&
        'counter' in effect &&
        (effect as { counter: string }).counter === 'masterStrikeCount',
    );

    assert.ok(counterEffect, 'must contain modifyCounter for masterStrikeCount');
    assert.equal(
      (counterEffect as { delta: number }).delta,
      1,
      'delta must be 1',
    );
  });

  // -------------------------------------------------------------------------
  // Test 3: captures top bystander (index 0) from non-empty supply
  // -------------------------------------------------------------------------
  it('captures top bystander from supply onto mastermind.attachedBystanders', () => {
    const gameState = makeTestState();
    const originalBystanderCount = gameState.piles.bystanders.length;
    const topBystander = gameState.piles.bystanders[0];

    mastermindStrikeHandler(gameState, {}, { cardId: 'test-strike' });

    assert.equal(
      gameState.mastermind.attachedBystanders.length,
      1,
      'mastermind.attachedBystanders must have exactly 1 entry after capture',
    );
    assert.equal(
      gameState.mastermind.attachedBystanders[0],
      topBystander,
      'captured bystander must be the former index-0 card',
    );
    assert.equal(
      gameState.piles.bystanders.length,
      originalBystanderCount - 1,
      'bystander pile must shrink by exactly 1',
    );
    assert.equal(
      gameState.piles.bystanders[0],
      'bystander-002',
      'new top of pile must be the former index-1 card',
    );
  });

  // -------------------------------------------------------------------------
  // Test 4: empty supply — no capture, message appended
  // -------------------------------------------------------------------------
  it('skips capture and appends message when bystander supply is empty', () => {
    const gameState = makeTestState();
    gameState.piles.bystanders = [];
    const messagesBefore = gameState.messages.length;

    mastermindStrikeHandler(gameState, {}, { cardId: 'test-strike' });

    assert.equal(
      gameState.mastermind.attachedBystanders.length,
      0,
      'no bystander captured when supply is empty',
    );
    assert.equal(
      gameState.messages.length,
      messagesBefore + 1,
      'exactly one message appended on empty supply',
    );
    assert.ok(
      gameState.messages[gameState.messages.length - 1]!.text.startsWith('[Master Strike]'),
      'empty-supply message must begin with [Master Strike] prefix',
    );
  });

  // -------------------------------------------------------------------------
  // Test 5: city-villain attachedBystanders unchanged (negative assertion)
  // -------------------------------------------------------------------------
  it('does not modify G.attachedBystanders (city-villain captures)', () => {
    const gameState = makeTestState();
    const cityBystandersBefore = JSON.parse(JSON.stringify(gameState.attachedBystanders));

    mastermindStrikeHandler(gameState, {}, { cardId: 'test-strike' });

    assert.deepStrictEqual(
      gameState.attachedBystanders,
      cityBystandersBefore,
      'G.attachedBystanders (city-villain) must not be modified by mastermind strike',
    );
  });

  // -------------------------------------------------------------------------
  // Test 6: bystander pile length unchanged when supply is empty
  // -------------------------------------------------------------------------
  it('bystander pile length remains 0 when supply is already empty', () => {
    const gameState = makeTestState();
    gameState.piles.bystanders = [];

    mastermindStrikeHandler(gameState, {}, { cardId: 'test-strike' });

    assert.equal(
      gameState.piles.bystanders.length,
      0,
      'empty pile must remain at length 0',
    );
  });

  // -------------------------------------------------------------------------
  // Test 7: effects are JSON-serializable
  // -------------------------------------------------------------------------
  it('effects are JSON-serializable', () => {
    const gameState = makeTestState();
    const effects = mastermindStrikeHandler(gameState, {}, { cardId: 'test-strike' });

    const serialized = JSON.stringify(effects);
    assert.ok(serialized, 'JSON.stringify(effects) must produce a non-empty string');
  });
});

// ---------------------------------------------------------------------------
// Magneto Master Strike dispatcher tests
// ---------------------------------------------------------------------------

describe('mastermindStrikeHandler — Magneto Master Strike', () => {
  /**
   * Creates a Magneto-shaped state with configurable hand sizes per player.
   * `hands` is keyed by player id; each value is an array of CardExtId
   * strings representing the player's hand from top (index 0) to bottom.
   */
  function makeMagnetoState(hands: Record<string, string[]>): LegendaryGameState {
    const gameState = makeTestState();
    gameState.selection = {
      ...gameState.selection,
      mastermindId: 'core/magneto',
    };
    gameState.playerZones = {};
    for (const [playerId, hand] of Object.entries(hands)) {
      gameState.playerZones[playerId] = { ...makePlayerZones(),
        deck: [],
        hand: [...hand],
        discard: [],
        inPlay: [],
        victory: [],
      };
    }
    return gameState;
  }

  it('discards a 7-card hand down to 4', () => {
    const gameState = makeMagnetoState({
      '0': ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7'],
    });

    mastermindStrikeHandler(gameState, {}, { cardId: 'strike-card' }, {});

    assert.equal(
      gameState.playerZones['0']!.hand.length,
      4,
      'Hand must shrink to 4 cards after Magneto strike',
    );
    assert.equal(
      gameState.playerZones['0']!.discard.length,
      3,
      'Discarded cards must be appended to the discard pile',
    );
    // why: the kept cards are the bottom 4 (most recently drawn) so
    // discarded cards are h1..h3 from the top.
    assert.deepStrictEqual(
      gameState.playerZones['0']!.discard,
      ['h1', 'h2', 'h3'],
      'Top-of-hand cards must be discarded first',
    );
    assert.deepStrictEqual(
      gameState.playerZones['0']!.hand,
      ['h4', 'h5', 'h6', 'h7'],
      'Bottom-of-hand cards must remain',
    );
  });

  it('leaves a 4-card hand untouched', () => {
    const gameState = makeMagnetoState({
      '0': ['h1', 'h2', 'h3', 'h4'],
    });

    mastermindStrikeHandler(gameState, {}, { cardId: 'strike-card' }, {});

    assert.equal(
      gameState.playerZones['0']!.hand.length,
      4,
      'Hand size already at the limit must not change',
    );
    assert.equal(
      gameState.playerZones['0']!.discard.length,
      0,
      'No cards discarded when hand size <= 4',
    );
  });

  it('leaves a hand smaller than 4 untouched', () => {
    const gameState = makeMagnetoState({
      '0': ['h1', 'h2'],
    });

    mastermindStrikeHandler(gameState, {}, { cardId: 'strike-card' }, {});

    assert.deepStrictEqual(
      gameState.playerZones['0']!.hand,
      ['h1', 'h2'],
      'A 2-card hand must remain at 2 cards',
    );
    assert.equal(gameState.playerZones['0']!.discard.length, 0);
  });

  it('applies the discard rule to every player independently', () => {
    const gameState = makeMagnetoState({
      '0': ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'],
      '1': ['b1', 'b2', 'b3'],
      '2': ['c1', 'c2', 'c3', 'c4', 'c5'],
    });

    mastermindStrikeHandler(gameState, {}, { cardId: 'strike-card' }, {});

    assert.equal(gameState.playerZones['0']!.hand.length, 4, 'Player 0: 6 → 4');
    assert.equal(gameState.playerZones['0']!.discard.length, 2);

    assert.equal(gameState.playerZones['1']!.hand.length, 3, 'Player 1: 3 → 3 (no change)');
    assert.equal(gameState.playerZones['1']!.discard.length, 0);

    assert.equal(gameState.playerZones['2']!.hand.length, 4, 'Player 2: 5 → 4');
    assert.equal(gameState.playerZones['2']!.discard.length, 1);
  });

  it('still captures one bystander onto the mastermind (generic strike effect)', () => {
    const gameState = makeMagnetoState({
      '0': ['h1', 'h2', 'h3', 'h4', 'h5'],
    });
    gameState.piles.bystanders = ['bystander-001', 'bystander-002'];

    mastermindStrikeHandler(gameState, {}, { cardId: 'strike-card' }, {});

    assert.equal(
      gameState.mastermind.attachedBystanders.length,
      1,
      'Generic D-15401 bystander capture must still run on the Magneto path',
    );
    assert.equal(gameState.piles.bystanders.length, 1);
  });

  it('still returns the generic masterStrikeCount counter effect', () => {
    const gameState = makeMagnetoState({
      '0': ['h1', 'h2', 'h3', 'h4', 'h5'],
    });

    const effects = mastermindStrikeHandler(
      gameState,
      {},
      { cardId: 'strike-card' },
      {},
    );

    const counterEffect = effects.find(
      (effect) =>
        effect.type === 'modifyCounter' &&
        'counter' in effect &&
        (effect as { counter: string }).counter === 'masterStrikeCount',
    );
    assert.ok(counterEffect, 'Magneto dispatch must still return masterStrikeCount');
  });

  it('logs a per-player message for both discard and no-discard outcomes', () => {
    const gameState = makeMagnetoState({
      '0': ['h1', 'h2', 'h3', 'h4', 'h5'],
      '1': ['x1'],
    });

    mastermindStrikeHandler(gameState, {}, { cardId: 'strike-card' }, {});

    const player0Message = gameState.messages.find(
      (message) => message.text.includes('Magneto') && message.text.includes('Player 0'),
    );
    const player1Message = gameState.messages.find(
      (message) => message.text.includes('Magneto') && message.text.includes('Player 1'),
    );

    assert.ok(player0Message, 'Player 0 (discarded) must have a Magneto log line');
    assert.ok(player1Message, 'Player 1 (no discard) must have a Magneto log line');
  });

  it('does NOT run the Magneto branch for a non-Magneto mastermind', () => {
    const gameState = makeMagnetoState({
      '0': ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    });
    gameState.selection = { ...gameState.selection, mastermindId: 'core/other-boss' };
    gameState.piles.bystanders = ['bystander-001'];

    mastermindStrikeHandler(gameState, {}, { cardId: 'strike-card' }, {});

    assert.equal(
      gameState.playerZones['0']!.hand.length,
      6,
      'Non-Magneto mastermind must not trigger the hand-discard effect',
    );
    assert.equal(
      gameState.mastermind.attachedBystanders.length,
      1,
      'Generic bystander capture still runs for any mastermind',
    );
  });
});

// ---------------------------------------------------------------------------
// Magneto Master Strike reveal-or-discard + interactive discard (WP-476 / D-24284)
// ---------------------------------------------------------------------------

describe('mastermindStrikeHandler — Magneto reveal-or-discard (WP-476 / D-24284)', () => {
  /** A RevealContext-shaped strike context carrying the active player id. */
  function ctxFor(currentPlayer: string): unknown {
    return { ctx: { currentPlayer } };
  }

  it('a player holding an X-Men Hero reveals it and discards nothing (AC-1)', () => {
    const gameState = makeCo2eState(
      'core/magneto',
      { '0': ['xm-a', 'b', 'c', 'd', 'e'] },
      { 'xm-a': co2eStat(3) },
      { 'xm-a': XMEN },
    );

    // why: even with the current player supplied, an X-Men Hero in hand takes the
    // reveal branch — no park, no discard (the reported 1p bug: no more forced discard).
    mastermindStrikeHandler(gameState, ctxFor('0'), { cardId: 'strike' }, {});

    assert.deepStrictEqual(gameState.playerZones['0']!.hand, ['xm-a', 'b', 'c', 'd', 'e']);
    assert.deepStrictEqual(gameState.playerZones['0']!.discard, []);
    assert.equal(gameState.pendingDiscardChoices, undefined, 'no discard choice parked');
  });

  it('the CURRENT player who must discard gets a parked pendingDiscardChoice, nothing discarded yet (AC-2)', () => {
    const gameState = makeCo2eState(
      'core/magneto',
      { '0': ['a', 'b', 'c', 'd', 'e'] },
      {},
      {},
    );

    mastermindStrikeHandler(gameState, ctxFor('0'), { cardId: 'strike' }, {});

    assert.deepStrictEqual(
      gameState.playerZones['0']!.hand,
      ['a', 'b', 'c', 'd', 'e'],
      'nothing discarded until the player resolves the choice',
    );
    assert.deepStrictEqual(gameState.pendingDiscardChoices, [
      { choiceType: 'discard-to-limit', playerID: '0', limit: 4 },
    ]);
  });

  it('a NON-current player who must discard auto-picks cheapest-first, no park (AC-3)', () => {
    const gameState = makeCo2eState(
      'core/magneto',
      { '1': ['cheap', 'mid', 'pricey', 'w', 'x'] },
      { cheap: co2eStat(1), mid: co2eStat(3), pricey: co2eStat(8), w: co2eStat(4), x: co2eStat(5) },
      {},
    );

    // why: player '0' is current; player '1' is non-current → auto-pick the single
    // cheapest card ('cheap', cost 1) down to 4, keeping the expensive cards. No park.
    mastermindStrikeHandler(gameState, ctxFor('0'), { cardId: 'strike' }, {});

    assert.deepStrictEqual(gameState.playerZones['1']!.hand, ['mid', 'pricey', 'w', 'x']);
    assert.deepStrictEqual(gameState.playerZones['1']!.discard, ['cheap']);
    assert.equal(gameState.pendingDiscardChoices, undefined, 'non-current players never park a choice');
  });

  it('parks the current player AND auto-picks a non-current player in the same strike', () => {
    const gameState = makeCo2eState(
      'core/magneto',
      { '0': ['a', 'b', 'c', 'd', 'e'], '1': ['p', 'q', 'r', 's', 't'] },
      {},
      {},
    );

    mastermindStrikeHandler(gameState, ctxFor('0'), { cardId: 'strike' }, {});

    // current player '0' parked (untouched); non-current '1' auto-discarded down to 4.
    assert.deepStrictEqual(gameState.playerZones['0']!.hand, ['a', 'b', 'c', 'd', 'e']);
    assert.equal(gameState.pendingDiscardChoices?.length, 1, 'exactly one park (the current player)');
    assert.equal(gameState.playerZones['1']!.hand.length, 4, 'non-current auto-discarded to 4');
    assert.equal(gameState.playerZones['1']!.discard.length, 1);
  });

  it('falls back to auto-pick for the current player when the context carries no ctx.currentPlayer', () => {
    const gameState = makeCo2eState(
      'core/magneto',
      { '0': ['a', 'b', 'c', 'd', 'e'] },
      {},
      {},
    );

    // why: legacy harness passing `{}` (no ctx) — the strike auto-picks rather than
    // blocking on an unknown chooser, so the sim/replay path never hangs.
    mastermindStrikeHandler(gameState, {}, { cardId: 'strike' }, {});

    assert.equal(gameState.playerZones['0']!.hand.length, 4, 'auto-discarded to 4 with no current player');
    assert.equal(gameState.pendingDiscardChoices, undefined, 'no park without a current player');
  });
});

describe('selectDiscardToLimitCards (WP-476 / D-24284)', () => {
  const state = makeCo2eState(
    'core/magneto',
    {},
    { cheap: co2eStat(1), mid: co2eStat(3), pricey: co2eStat(8) },
    {},
  );

  it('returns the cheapest cards first, ties broken by lowest hand index', () => {
    const hand = ['pricey', 'cheap', 'mid', 'cheap'] as CardExtId[];
    // why: two cost-1 'cheap' copies are the cheapest; ties keep lower hand index
    // first, so the index-1 copy is chosen before 'mid'.
    assert.deepStrictEqual(
      selectDiscardToLimitCards(state, hand, 2),
      ['cheap', 'cheap'],
    );
  });

  it('treats Wounds and unpriced starters as cost 0 (discarded first), always reaching the count', () => {
    const hand = [WOUND_EXT_ID, 'mid', 'pricey'] as CardExtId[];
    assert.deepStrictEqual(
      selectDiscardToLimitCards(state, hand, 1),
      [WOUND_EXT_ID],
      'the cost-0 Wound is discarded before any priced Hero',
    );
  });

  it('returns min(count, hand.length) cards and never throws on an over-count', () => {
    const hand = ['mid', 'pricey'] as CardExtId[];
    assert.deepStrictEqual(selectDiscardToLimitCards(state, hand, 5), ['mid', 'pricey']);
  });
});

// ---------------------------------------------------------------------------
// Red Skull Master Strike dispatcher tests (WP-386 / D-24188)
// ---------------------------------------------------------------------------

describe('mastermindStrikeHandler — Red Skull Master Strike', () => {
  /** A full CardStatEntry with the given recruit cost; other fields inert. */
  function stat(cost: number) {
    return {
      attack: 0,
      recruit: 0,
      cost,
      fightCost: 0,
      fightCostMode: 'static' as const,
      fightCostBase: 0,
    };
  }

  /**
   * Creates a Red Skull-shaped state with per-player hands and an optional
   * cardStats map (heroes absent from the map are treated as cost 0).
   * `mastermindId` defaults to `core/red-skull`.
   */
  function makeRedSkullState(
    hands: Record<string, string[]>,
    cardStats: Record<string, ReturnType<typeof stat>> = {},
    mastermindId = 'core/red-skull',
  ): LegendaryGameState {
    const gameState = makeTestState();
    gameState.selection = { ...gameState.selection, mastermindId };
    gameState.cardStats = cardStats as LegendaryGameState['cardStats'];
    gameState.playerZones = {};
    for (const [playerId, hand] of Object.entries(hands)) {
      gameState.playerZones[playerId] = { ...makePlayerZones(),
        deck: [],
        hand: [...hand],
        discard: [],
        inPlay: [],
        victory: [],
      };
    }
    return gameState;
  }

  it('KOs exactly one Hero from each player and appends it to G.ko', () => {
    const gameState = makeRedSkullState(
      { '0': ['hero-a', 'hero-b'], '1': ['hero-c'] },
      { 'hero-a': stat(2), 'hero-b': stat(5), 'hero-c': stat(3) },
    );

    mastermindStrikeHandler(gameState, {}, { cardId: 'strike-card' }, {});

    // Player 0: lowest-cost of {hero-a:2, hero-b:5} → hero-a KO'd.
    assert.deepStrictEqual(gameState.playerZones['0']!.hand, ['hero-b']);
    // Player 1: its only Hero KO'd.
    assert.deepStrictEqual(gameState.playerZones['1']!.hand, []);
    // Players resolve in sorted order (0 then 1).
    assert.deepStrictEqual(gameState.ko, ['hero-a', 'hero-c']);
  });

  it('picks the lowest-cost Hero, breaking a cost tie by lowest hand index', () => {
    const gameState = makeRedSkullState(
      { '0': ['hero-hi', 'hero-tie-1', 'hero-tie-2'] },
      { 'hero-hi': stat(4), 'hero-tie-1': stat(1), 'hero-tie-2': stat(1) },
    );

    mastermindStrikeHandler(gameState, {}, { cardId: 'strike-card' }, {});

    // Both cost 1; the earlier hand index (hero-tie-1) is KO'd.
    assert.deepStrictEqual(gameState.ko, ['hero-tie-1']);
    assert.deepStrictEqual(gameState.playerZones['0']!.hand, [
      'hero-hi',
      'hero-tie-2',
    ]);
  });

  it('treats a statless starter as cost 0 and picks it over a priced Hero', () => {
    const gameState = makeRedSkullState(
      { '0': ['priced-hero', 'shield-agent'] },
      { 'priced-hero': stat(3) }, // shield-agent absent → cost 0
    );

    mastermindStrikeHandler(gameState, {}, { cardId: 'strike-card' }, {});

    assert.deepStrictEqual(gameState.ko, ['shield-agent']);
    assert.deepStrictEqual(gameState.playerZones['0']!.hand, ['priced-hero']);
  });

  it('never KOs a Wound: an all-Wound hand takes no KO and logs the no-Hero line', () => {
    const gameState = makeRedSkullState({ '0': [WOUND_EXT_ID, WOUND_EXT_ID] });

    mastermindStrikeHandler(gameState, {}, { cardId: 'strike-card' }, {});

    assert.deepStrictEqual(gameState.playerZones['0']!.hand, [
      WOUND_EXT_ID,
      WOUND_EXT_ID,
    ]);
    assert.deepStrictEqual(gameState.ko, []);
    const noHeroLine = gameState.messages.find(
      (message) =>
        message.text.includes('Red Skull') &&
        message.text.includes('Player 0') &&
        message.text.includes('no Hero'),
    );
    assert.ok(noHeroLine, 'an all-Wound hand must log the no-Hero line');
  });

  it('an empty hand takes no KO and logs the no-Hero line', () => {
    const gameState = makeRedSkullState({ '0': [] });

    mastermindStrikeHandler(gameState, {}, { cardId: 'strike-card' }, {});

    assert.deepStrictEqual(gameState.playerZones['0']!.hand, []);
    assert.deepStrictEqual(gameState.ko, []);
    const noHeroLine = gameState.messages.find(
      (message) =>
        message.text.includes('Red Skull') &&
        message.text.includes('Player 0') &&
        message.text.includes('no Hero'),
    );
    assert.ok(noHeroLine, 'an empty hand must log the no-Hero line');
  });

  it('a Wound-plus-Hero hand KOs only the Hero', () => {
    const gameState = makeRedSkullState(
      { '0': [WOUND_EXT_ID, 'hero-x'] },
      { 'hero-x': stat(2) },
    );

    mastermindStrikeHandler(gameState, {}, { cardId: 'strike-card' }, {});

    assert.deepStrictEqual(gameState.ko, ['hero-x']);
    assert.deepStrictEqual(gameState.playerZones['0']!.hand, [WOUND_EXT_ID]);
  });

  it('logs one KO line per player that KOs a Hero', () => {
    const gameState = makeRedSkullState(
      { '0': ['hero-a'], '1': ['hero-b'] },
      { 'hero-a': stat(1), 'hero-b': stat(1) },
    );

    mastermindStrikeHandler(gameState, {}, { cardId: 'strike-card' }, {});

    const player0Line = gameState.messages.find(
      (message) =>
        message.text.includes('Red Skull') &&
        message.text.includes('Player 0') &&
        message.text.includes("KO'd"),
    );
    const player1Line = gameState.messages.find(
      (message) =>
        message.text.includes('Red Skull') &&
        message.text.includes('Player 1') &&
        message.text.includes("KO'd"),
    );
    assert.ok(player0Line, 'Player 0 KO line present');
    assert.ok(player1Line, 'Player 1 KO line present');
  });

  it('takes the branch for co2e/red-skull as well', () => {
    const gameState = makeRedSkullState(
      { '0': ['hero-a', 'hero-b'] },
      { 'hero-a': stat(2), 'hero-b': stat(5) },
      'co2e/red-skull',
    );

    mastermindStrikeHandler(gameState, {}, { cardId: 'strike-card' }, {});

    assert.deepStrictEqual(gameState.ko, ['hero-a']);
    assert.deepStrictEqual(gameState.playerZones['0']!.hand, ['hero-b']);
  });

  it('does NOT run the Red Skull branch for a non-Red-Skull mastermind', () => {
    const gameState = makeRedSkullState(
      { '0': ['hero-a', 'hero-b'] },
      { 'hero-a': stat(2), 'hero-b': stat(5) },
      'core/other-boss',
    );

    mastermindStrikeHandler(gameState, {}, { cardId: 'strike-card' }, {});

    assert.deepStrictEqual(
      gameState.playerZones['0']!.hand,
      ['hero-a', 'hero-b'],
      'no KO for a non-Red-Skull mastermind',
    );
    assert.deepStrictEqual(gameState.ko, []);
  });

  it('preserves generic strike behavior: bystander capture, counter, one emission', () => {
    const gameState = makeRedSkullState(
      { '0': ['hero-a', 'hero-b'] },
      { 'hero-a': stat(2), 'hero-b': stat(5) },
    );
    gameState.piles.bystanders = ['bystander-001', 'bystander-002'];

    const effects = mastermindStrikeHandler(
      gameState,
      {},
      { cardId: 'strike-card' },
      {},
    );

    // D-15401 bystander capture still runs on the Red Skull path.
    assert.equal(gameState.mastermind.attachedBystanders.length, 1);
    assert.equal(gameState.piles.bystanders.length, 1);
    // Generic counter effect still returned.
    const counterEffect = effects.find(
      (effect) =>
        effect.type === 'modifyCounter' &&
        'counter' in effect &&
        (effect as { counter: string }).counter === 'masterStrikeCount',
    );
    assert.ok(
      counterEffect,
      'masterStrikeCount effect must still be returned on a Red Skull strike',
    );
    // Exactly one WP-200 emission.
    assert.equal(gameState.notableEvents.length, 1);
    assert.equal(
      gameState.notableEvents[0]!.type,
      'mastermindStrikeResolved',
    );
    // And the KO still happened.
    assert.deepStrictEqual(gameState.ko, ['hero-a']);
  });
});

// ---------------------------------------------------------------------------
// WP-200 — mastermindStrikeResolved emission
// ---------------------------------------------------------------------------

describe('mastermindStrikeHandler — WP-200 mastermindStrikeResolved emission', () => {
  it('pushes exactly one mastermindStrikeResolved event per strike resolution', () => {
    const gameState = makeTestState();
    mastermindStrikeHandler(gameState, {}, { cardId: 'master-strike-00' }, {});

    assert.equal(
      gameState.notableEvents.length,
      1,
      'exactly one mastermindStrikeResolved event must be emitted',
    );
    const event = gameState.notableEvents[0]!;
    assert.equal(event.type, 'mastermindStrikeResolved');
    if (event.type === 'mastermindStrikeResolved') {
      assert.equal(event.strikeCardId, 'master-strike-00');
      assert.ok(
        event.narrative.length > 0 && event.narrative.includes('master-strike-00'),
        'narrative is non-empty and names the strike card',
      );
    }
  });

  it('falls back to empty strikeCardId when payload is malformed (no throw)', () => {
    // why: WP-200 + architecture rules — moves never throw. Defensive
    // payload narrowing yields '' when the trigger payload is missing /
    // not an object / missing cardId. Production dispatch always supplies
    // `{ cardId: string }`; this guard only matters for the malformed-
    // payload code path that is reachable only via misuse / test stubs.
    const gameState = makeTestState();
    mastermindStrikeHandler(gameState, {}, null, {});
    assert.equal(gameState.notableEvents.length, 1);
    const event = gameState.notableEvents[0]!;
    if (event.type === 'mastermindStrikeResolved') {
      assert.equal(event.strikeCardId, '');
    }
  });
});

// ---------------------------------------------------------------------------
// WP-388 / D-24192 — co2e mastermind strike texts
// ---------------------------------------------------------------------------

/** A full CardStatEntry with the given recruit cost; other fields inert. */
function co2eStat(cost: number) {
  return {
    attack: 0,
    recruit: 0,
    cost,
    fightCost: 0,
    fightCostMode: 'static' as const,
    fightCostBase: 0,
  };
}

/**
 * Creates a co2e-shaped state with per-player hands, a cardStats map, and a
 * cardTraits map. Heroes absent from cardStats are treated as cost 0; heroes
 * absent from cardTraits match no trait gate.
 */
function makeCo2eState(
  mastermindId: string,
  hands: Record<string, string[]>,
  cardStats: Record<string, ReturnType<typeof co2eStat>> = {},
  cardTraits: Record<string, { heroClass: string | null; team: string | null }> = {},
): LegendaryGameState {
  const gameState = makeTestState();
  gameState.selection = { ...gameState.selection, mastermindId };
  gameState.cardStats = cardStats as LegendaryGameState['cardStats'];
  gameState.cardTraits = cardTraits as LegendaryGameState['cardTraits'];
  gameState.playerZones = {};
  for (const [playerId, hand] of Object.entries(hands)) {
    gameState.playerZones[playerId] = { ...makePlayerZones(),
      deck: [],
      hand: [...hand],
      discard: [],
      inPlay: [],
      victory: [],
    };
  }
  return gameState;
}

/** Convenience trait entries. */
const XMEN = { heroClass: null, team: 'x-men' };
const SPIDER = { heroClass: null, team: 'spider-friends' };
const AVENGER = { heroClass: null, team: 'avengers' };
const STRENGTH = { heroClass: 'strength', team: null };
const TECH = { heroClass: 'tech', team: null };

describe('mastermindStrikeHandler — co2e Magneto Master Strike (WP-388)', () => {
  it('discards the lowest-cost X-Men Hero from each player (AC-3)', () => {
    const gameState = makeCo2eState(
      'co2e/magneto',
      { '0': ['xm-a', 'xm-b', 'av-a'], '1': ['xm-c'] },
      { 'xm-a': co2eStat(5), 'xm-b': co2eStat(2), 'xm-c': co2eStat(4), 'av-a': co2eStat(1) },
      { 'xm-a': XMEN, 'xm-b': XMEN, 'xm-c': XMEN, 'av-a': AVENGER },
    );

    mastermindStrikeHandler(gameState, {}, { cardId: 'strike' }, {});

    // why: xm-b (cost 2) beats xm-a (cost 5); av-a is cheaper still but is
    // not X-Men, so the trait gate must exclude it.
    assert.deepEqual(gameState.playerZones['0']!.hand, ['xm-a', 'av-a']);
    assert.deepEqual(gameState.playerZones['0']!.discard, ['xm-b']);
    assert.deepEqual(gameState.playerZones['1']!.hand, []);
    assert.deepEqual(gameState.playerZones['1']!.discard, ['xm-c']);
  });

  it('gains a Wound when the player holds no X-Men Hero (AC-3)', () => {
    const gameState = makeCo2eState(
      'co2e/magneto',
      { '0': ['av-a'] },
      { 'av-a': co2eStat(1) },
      { 'av-a': AVENGER },
    );
    gameState.piles.wounds = ['wound-1', 'wound-2'];

    mastermindStrikeHandler(gameState, {}, { cardId: 'strike' }, {});

    assert.deepEqual(gameState.playerZones['0']!.hand, ['av-a'], 'hand unchanged');
    assert.deepEqual(gameState.playerZones['0']!.discard, ['wound-1']);
    assert.equal(gameState.piles.wounds.length, 1, 'wounds pile shrinks by exactly one');
  });

  it('degrades to a no-op when the wounds pile is empty (AC-3, AC-9)', () => {
    const gameState = makeCo2eState(
      'co2e/magneto',
      { '0': ['av-a'] },
      {},
      { 'av-a': AVENGER },
    );
    gameState.piles.wounds = [];

    assert.doesNotThrow(() =>
      mastermindStrikeHandler(gameState, {}, { cardId: 'strike' }, {}),
    );
    assert.deepEqual(gameState.playerZones['0']!.discard, []);
  });

  it('never selects a Wound held in hand (AC-5)', () => {
    const gameState = makeCo2eState(
      'co2e/magneto',
      { '0': [WOUND_EXT_ID, 'xm-a'] },
      { 'xm-a': co2eStat(9) },
      { [WOUND_EXT_ID]: XMEN, 'xm-a': XMEN },
    );

    mastermindStrikeHandler(gameState, {}, { cardId: 'strike' }, {});

    // why: the Wound is cost-0 and mis-tagged X-Men here on purpose — the
    // WOUND_EXT_ID filter must win over both cost and trait.
    assert.deepEqual(gameState.playerZones['0']!.hand, [WOUND_EXT_ID]);
    assert.deepEqual(gameState.playerZones['0']!.discard, ['xm-a']);
  });
});

describe('mastermindStrikeHandler — core Loki Master Strike (WP-537 / D-24346)', () => {
  it('a player revealing a Strength Hero keeps it and takes no Wound', () => {
    const gameState = makeCo2eState(
      'core/loki',
      { '0': ['st-a', 'te-a'] },
      { 'st-a': co2eStat(3), 'te-a': co2eStat(1) },
      { 'st-a': STRENGTH, 'te-a': TECH },
    );
    gameState.piles.wounds = ['wound-1'];

    mastermindStrikeHandler(gameState, {}, { cardId: 'strike' }, {});

    // why: reveal is the printed escape — the Strength Hero is kept, hand and
    // discard unchanged, and no Wound is drawn.
    assert.deepEqual(gameState.playerZones['0']!.hand, ['st-a', 'te-a']);
    assert.deepEqual(gameState.playerZones['0']!.discard, []);
    assert.equal(gameState.piles.wounds.length, 1, 'wounds pile untouched');
  });

  it('gains a Wound when the player holds no Strength Hero', () => {
    const gameState = makeCo2eState(
      'core/loki',
      { '0': ['te-a'] },
      { 'te-a': co2eStat(1) },
      { 'te-a': TECH },
    );
    gameState.piles.wounds = ['wound-1', 'wound-2'];

    mastermindStrikeHandler(gameState, {}, { cardId: 'strike' }, {});

    assert.deepEqual(gameState.playerZones['0']!.hand, ['te-a'], 'hand unchanged');
    assert.deepEqual(gameState.playerZones['0']!.discard, ['wound-1']);
    assert.equal(gameState.piles.wounds.length, 1, 'wounds pile shrinks by exactly one');
  });

  it('degrades to a no-op when the wounds pile is empty', () => {
    const gameState = makeCo2eState(
      'core/loki',
      { '0': ['te-a'] },
      {},
      { 'te-a': TECH },
    );
    gameState.piles.wounds = [];

    assert.doesNotThrow(() =>
      mastermindStrikeHandler(gameState, {}, { cardId: 'strike' }, {}),
    );
    assert.deepEqual(gameState.playerZones['0']!.discard, []);
  });

  it('resolves players independently in sorted id order (reveal vs Wound)', () => {
    const gameState = makeCo2eState(
      'core/loki',
      { '0': ['st-a'], '1': ['te-a'] },
      { 'st-a': co2eStat(2), 'te-a': co2eStat(2) },
      { 'st-a': STRENGTH, 'te-a': TECH },
    );
    gameState.piles.wounds = ['wound-1', 'wound-2'];

    mastermindStrikeHandler(gameState, {}, { cardId: 'strike' }, {});

    // Player 0 reveals + keeps its Strength Hero (no Wound); player 1 holds none
    // and gains exactly one Wound.
    assert.deepEqual(gameState.playerZones['0']!.hand, ['st-a']);
    assert.deepEqual(gameState.playerZones['0']!.discard, []);
    assert.deepEqual(gameState.playerZones['1']!.discard, ['wound-1']);
    assert.equal(gameState.piles.wounds.length, 1);
  });
});

describe('mastermindStrikeHandler — core Dr. Doom Master Strike (WP-538 / D-24347)', () => {
  /** A RevealContext-shaped strike context carrying the active player id. */
  function ctxFor(currentPlayer: string): unknown {
    return { ctx: { currentPlayer } };
  }

  it('a player without exactly 6 cards is unaffected (no park, no deck change)', () => {
    const gameState = makeCo2eState(
      'core/dr-doom',
      { '0': ['a', 'b', 'c'] }, // 3 cards, not 6
      {},
      {},
    );
    mastermindStrikeHandler(gameState, ctxFor('0'), { cardId: 'strike' }, {});
    assert.deepEqual(gameState.playerZones['0']!.hand, ['a', 'b', 'c']);
    assert.deepEqual(gameState.playerZones['0']!.deck, []);
    assert.equal(gameState.pendingPutCardsOnDeckChoices, undefined, 'no choice parked');
  });

  it('a 6-card hand holding a Tech Hero reveals it and keeps it (no park, no deck change)', () => {
    const gameState = makeCo2eState(
      'core/dr-doom',
      { '0': ['te-a', 'b', 'c', 'd', 'e', 'f'] },
      { 'te-a': co2eStat(3) },
      { 'te-a': TECH },
    );
    mastermindStrikeHandler(gameState, ctxFor('0'), { cardId: 'strike' }, {});
    assert.deepEqual(gameState.playerZones['0']!.hand, ['te-a', 'b', 'c', 'd', 'e', 'f']);
    assert.deepEqual(gameState.playerZones['0']!.deck, []);
    assert.equal(gameState.pendingPutCardsOnDeckChoices, undefined, 'no choice parked');
  });

  it('the CURRENT player with 6 cards and no Tech Hero gets a parked choice, nothing moved yet', () => {
    const gameState = makeCo2eState(
      'core/dr-doom',
      { '0': ['a', 'b', 'c', 'd', 'e', 'f'] },
      {},
      {},
    );
    mastermindStrikeHandler(gameState, ctxFor('0'), { cardId: 'strike' }, {});
    assert.deepEqual(gameState.playerZones['0']!.hand, ['a', 'b', 'c', 'd', 'e', 'f'], 'hand unchanged at park');
    assert.deepEqual(gameState.playerZones['0']!.deck, [], 'deck unchanged at park');
    assert.equal(gameState.pendingPutCardsOnDeckChoices?.length, 1, 'one choice parked');
    assert.deepEqual(gameState.pendingPutCardsOnDeckChoices![0], {
      choiceType: 'put-cards-on-deck',
      playerID: '0',
      count: 2,
    });
  });

  it('a NON-current player with 6 cards and no Tech Hero auto-puts the 2 cheapest on top', () => {
    const gameState = makeCo2eState(
      'core/dr-doom',
      { '1': ['hi1', 'hi2', 'hi3', 'hi4', 'cheap1', 'cheap2'] },
      {
        hi1: co2eStat(5), hi2: co2eStat(5), hi3: co2eStat(5), hi4: co2eStat(5),
        cheap1: co2eStat(1), cheap2: co2eStat(1),
      },
      {},
    );
    // why: current player is '0' (not in this state); player '1' is non-current → auto.
    mastermindStrikeHandler(gameState, ctxFor('0'), { cardId: 'strike' }, {});
    assert.deepEqual(gameState.playerZones['1']!.hand, ['hi1', 'hi2', 'hi3', 'hi4'], 'expensive Heroes kept in hand');
    assert.equal(gameState.playerZones['1']!.deck.length, 2, 'two cards put on top of the deck');
    assert.ok(
      gameState.playerZones['1']!.deck.includes('cheap1') &&
        gameState.playerZones['1']!.deck.includes('cheap2'),
      'the two cheapest were the ones put on deck',
    );
    assert.equal(gameState.pendingPutCardsOnDeckChoices, undefined, 'a non-current player does not park');
  });
});

describe('mastermindStrikeHandler — co2e Loki Master Strike (WP-388)', () => {
  it('discards the lowest-cost Strength Hero from each player (AC-2)', () => {
    const gameState = makeCo2eState(
      'co2e/loki',
      { '0': ['st-a', 'st-b', 'te-a'] },
      { 'st-a': co2eStat(6), 'st-b': co2eStat(3), 'te-a': co2eStat(1) },
      { 'st-a': STRENGTH, 'st-b': STRENGTH, 'te-a': TECH },
    );

    mastermindStrikeHandler(gameState, {}, { cardId: 'strike' }, {});

    assert.deepEqual(gameState.playerZones['0']!.hand, ['st-a', 'te-a']);
    assert.deepEqual(gameState.playerZones['0']!.discard, ['st-b']);
  });

  it('is a logged no-op — never a Wound — with no Strength Hero (AC-2)', () => {
    const gameState = makeCo2eState(
      'co2e/loki',
      { '0': ['te-a'] },
      { 'te-a': co2eStat(1) },
      { 'te-a': TECH },
    );
    gameState.piles.wounds = ['wound-1'];

    mastermindStrikeHandler(gameState, {}, { cardId: 'strike' }, {});

    assert.deepEqual(gameState.playerZones['0']!.hand, ['te-a'], 'hand unchanged');
    // why: D-24192 — the Hypno-Thrall branch is out of scope, so the player
    // escapes. Substituting a Wound here would be the wrong card text.
    assert.deepEqual(gameState.playerZones['0']!.discard, []);
    assert.equal(gameState.piles.wounds.length, 1, 'Loki never gains a Wound');
  });
});

describe('mastermindStrikeHandler — co2e Doctor Octopus Master Strike (WP-388)', () => {
  it('discards the lowest-cost Spider-Friends Hero from each player (AC-4)', () => {
    const gameState = makeCo2eState(
      'co2e/doctor-octopus',
      { '0': ['sp-a', 'sp-b'], '1': ['av-a'] },
      { 'sp-a': co2eStat(4), 'sp-b': co2eStat(2), 'av-a': co2eStat(1) },
      { 'sp-a': SPIDER, 'sp-b': SPIDER, 'av-a': AVENGER },
    );

    mastermindStrikeHandler(gameState, {}, { cardId: 'strike' }, {});

    assert.deepEqual(gameState.playerZones['0']!.hand, ['sp-a']);
    assert.deepEqual(gameState.playerZones['0']!.discard, ['sp-b']);
    // player 1 holds no Spider-Friends Hero — logged no-op, no Wound
    assert.deepEqual(gameState.playerZones['1']!.hand, ['av-a']);
    assert.deepEqual(gameState.playerZones['1']!.discard, []);
  });
});

describe('mastermindStrikeHandler — co2e Doctor Doom Master Strike (WP-388)', () => {
  it('discards one card at the first strike and three at the third (AC-1)', () => {
    const firstStrike = makeCo2eState(
      'co2e/doctor-doom',
      { '0': ['a', 'b', 'c', 'd'] },
      { a: co2eStat(4), b: co2eStat(1), c: co2eStat(3), d: co2eStat(2) },
    );
    mastermindStrikeHandler(firstStrike, {}, { cardId: 'strike' }, {});
    // why: counters.masterStrikeCount is 0 pre-increment, so this strike is
    // Omen #1 — exactly one discard, the cheapest card.
    assert.deepEqual(firstStrike.playerZones['0']!.hand, ['a', 'c', 'd']);
    assert.deepEqual(firstStrike.playerZones['0']!.discard, ['b']);

    const thirdStrike = makeCo2eState(
      'co2e/doctor-doom',
      { '0': ['a', 'b', 'c', 'd'] },
      { a: co2eStat(4), b: co2eStat(1), c: co2eStat(3), d: co2eStat(2) },
    );
    thirdStrike.counters.masterStrikeCount = 2;
    mastermindStrikeHandler(thirdStrike, {}, { cardId: 'strike' }, {});
    // why: 2 prior Omens + this one = 3 discards, cheapest-first (b,d,c).
    assert.deepEqual(thirdStrike.playerZones['0']!.hand, ['a']);
    assert.deepEqual(thirdStrike.playerZones['0']!.discard, ['b', 'd', 'c']);
  });

  it('gains a Wound instead when the hand cannot cover the Omen count (AC-1)', () => {
    const gameState = makeCo2eState('co2e/doctor-doom', { '0': ['a', 'b'] });
    gameState.counters.masterStrikeCount = 4;
    gameState.piles.wounds = ['wound-1'];

    mastermindStrikeHandler(gameState, {}, { cardId: 'strike' }, {});

    // why: 5 Omens against a 2-card hand — the player takes the Wound and
    // discards nothing.
    assert.deepEqual(gameState.playerZones['0']!.hand, ['a', 'b']);
    assert.deepEqual(gameState.playerZones['0']!.discard, ['wound-1']);
    assert.equal(gameState.piles.wounds.length, 0);
  });

  it('does not throw when the hand is all Wounds (AC-9)', () => {
    const gameState = makeCo2eState('co2e/doctor-doom', {
      '0': [WOUND_EXT_ID, WOUND_EXT_ID],
    });

    // why: hand.length covers the Omen count but no card is an eligible Hero;
    // the resolver must stop rather than loop forever or throw.
    assert.doesNotThrow(() =>
      mastermindStrikeHandler(gameState, {}, { cardId: 'strike' }, {}),
    );
    assert.deepEqual(gameState.playerZones['0']!.hand, [WOUND_EXT_ID, WOUND_EXT_ID]);
  });
});

describe('mastermindStrikeHandler — co2e dispatch isolation (WP-388)', () => {
  it('leaves core/magneto on its own reveal-or-discard branch, not the co2e one (AC-6)', () => {
    const gameState = makeCo2eState(
      'core/magneto',
      { '0': ['xm-a', 'b', 'c', 'd', 'e'] },
      { 'xm-a': co2eStat(1) },
      { 'xm-a': XMEN },
    );

    mastermindStrikeHandler(gameState, {}, { cardId: 'strike' }, {});

    // why: WP-476 — core Magneto's printed reveal branch: a player holding an
    // X-Men Hero REVEALS it and discards nothing. The co2e/magneto resolver would
    // instead DISCARD the X-Men Hero, so an untouched 5-card hand + empty discard
    // proves the core branch ran, not the co2e one.
    assert.equal(gameState.playerZones['0']!.hand.length, 5);
    assert.deepEqual(gameState.playerZones['0']!.discard, []);
  });

  it('takes no branch for an unimplemented mastermind (AC-6)', () => {
    const gameState = makeCo2eState(
      'co2e/some-other-mastermind',
      { '0': ['xm-a', 'xm-b'] },
      { 'xm-a': co2eStat(1), 'xm-b': co2eStat(2) },
      { 'xm-a': XMEN, 'xm-b': XMEN },
    );

    mastermindStrikeHandler(gameState, {}, { cardId: 'strike' }, {});

    assert.deepEqual(gameState.playerZones['0']!.hand, ['xm-a', 'xm-b']);
    assert.deepEqual(gameState.playerZones['0']!.discard, []);
  });

  it('preserves generic strike behaviour on every co2e branch (AC-7, AC-8)', () => {
    const gameState = makeCo2eState(
      'co2e/magneto',
      { '0': ['xm-a'] },
      { 'xm-a': co2eStat(1) },
      { 'xm-a': XMEN },
    );

    const effects = mastermindStrikeHandler(gameState, {}, { cardId: 'strike' }, {});

    assert.deepEqual(effects, [
      { type: 'modifyCounter', counter: 'masterStrikeCount', delta: 1 },
      { type: 'queueMessage', message: 'Mastermind strike revealed — strike count incremented.' },
    ]);
    // D-15401 capture still runs on the co2e branch
    assert.equal(gameState.mastermind.attachedBystanders.length, 1);
    assert.equal(gameState.piles.bystanders.length, 2);
    // WP-200 emission still terminal
    assert.equal(gameState.notableEvents.length, 1);
    // exactly one hand mutation per player per strike
    assert.deepEqual(gameState.playerZones['0']!.discard, ['xm-a']);
  });

  it('does not throw when G.cardTraits is absent entirely (AC-9)', () => {
    const gameState = makeCo2eState('co2e/loki', { '0': ['st-a'] }, { 'st-a': co2eStat(1) });
    // why: legacy states predate WP-179; the map itself may be undefined.
    (gameState as { cardTraits?: unknown }).cardTraits = undefined;

    assert.doesNotThrow(() =>
      mastermindStrikeHandler(gameState, {}, { cardId: 'strike' }, {}),
    );
    assert.deepEqual(gameState.playerZones['0']!.hand, ['st-a']);
  });
});

// ---------------------------------------------------------------------------
// WP-397 / D-24200 — Doctor Octopus reveal-eight branch
// ---------------------------------------------------------------------------

/** A deterministic stand-in for ctx.random.Shuffle: reverses the array. */
function reversingShuffleContext() {
  return { random: { Shuffle: <T>(items: T[]): T[] => [...items].reverse() } };
}

/**
 * Builds a Doctor Octopus state with one player's hand, deck, and traits.
 * The hand is empty by default so the reveal branch is the one exercised.
 */
function makeOctopusRevealState(
  deck: string[],
  cardTraits: Record<string, { heroClass: string | null; team: string | null }> = {},
  hand: string[] = [],
): LegendaryGameState {
  const gameState = makeCo2eState('co2e/doctor-octopus', { '0': hand }, {}, cardTraits);
  gameState.playerZones['0']!.deck = [...deck];
  return gameState;
}

/** Multiset comparison helper — order-insensitive card conservation. */
function sortedCopy(cards: readonly string[]): string[] {
  return [...cards].sort();
}

describe('mastermindStrikeHandler — Doctor Octopus reveal-eight (WP-397)', () => {
  it('does NOT reveal when the player discards a Spider-Friends Hero (AC-1)', () => {
    const gameState = makeOctopusRevealState(
      ['d1', 'd2', 'd3'],
      { 'sp-a': SPIDER, d1: STRENGTH, d2: STRENGTH, d3: STRENGTH },
      ['sp-a'],
    );

    mastermindStrikeHandler(gameState, reversingShuffleContext(), { cardId: 's' }, {});

    assert.deepEqual(gameState.playerZones['0']!.hand, [], 'the Hero was discarded');
    assert.deepEqual(
      gameState.playerZones['0']!.deck,
      ['d1', 'd2', 'd3'],
      'deck untouched — the reveal branch must not run',
    );
    assert.deepEqual(gameState.playerZones['0']!.discard, ['sp-a']);
  });

  it('reveals exactly 8 and leaves the rest of the deck alone (AC-2, AC-4)', () => {
    const deck = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'tail1', 'tail2'];
    // why: every revealed card is grey, so all 8 return — this isolates the
    // count and the tail-preservation assertions from the partition logic.
    const gameState = makeOctopusRevealState(deck, {});

    mastermindStrikeHandler(gameState, reversingShuffleContext(), { cardId: 's' }, {});

    const after = gameState.playerZones['0']!.deck;
    assert.equal(after.length, 10, 'no card left the deck — all revealed were grey');
    assert.deepEqual(
      after.slice(8),
      ['tail1', 'tail2'],
      'the untouched tail keeps its content and order, below the returned cards',
    );
    assert.deepEqual(
      after.slice(0, 8),
      ['c8', 'c7', 'c6', 'c5', 'c4', 'c3', 'c2', 'c1'],
      'the returned remainder sits at the FRONT, in Shuffle order',
    );
  });

  it('tops up a short deck from the discard to reveal a full window (WP-482 / D-24288)', () => {
    const gameState = makeOctopusRevealState(['a', 'b'], { a: TECH });
    gameState.playerZones['0']!.discard = ['already-discarded'];

    mastermindStrikeHandler(gameState, reversingShuffleContext(), { cardId: 's' }, {});

    // why: WP-482 / D-24288 — a short deck (< 8) now reshuffles the discard to reveal a
    // fuller window (reverses D-24200's no-top-up). deck [a,b] + reverse([already-discarded])
    // = [a,b,already-discarded]; all 3 revealed; 'a' (tech) is non-grey → discarded; 'b' and
    // 'already-discarded' (grey) return in Shuffle (reverse) order → [already-discarded, b].
    assert.deepEqual(gameState.playerZones['0']!.deck, ['already-discarded', 'b']);
    assert.deepEqual(gameState.playerZones['0']!.discard, ['a']);
  });

  it('does NOT top up a short deck when the discard is empty (WP-482 / D-24288)', () => {
    const gameState = makeOctopusRevealState(['a', 'b'], { a: TECH });
    // discard is empty → nothing to reshuffle → reveal the short deck as-is.
    mastermindStrikeHandler(gameState, reversingShuffleContext(), { cardId: 's' }, {});

    assert.deepEqual(gameState.playerZones['0']!.deck, ['b'], "'a' discarded, 'b' returned");
    assert.deepEqual(gameState.playerZones['0']!.discard, ['a']);
  });

  it('does NOT top up when no shuffle source is available (WP-482 / D-24288)', () => {
    const gameState = makeOctopusRevealState(['a', 'b'], { a: TECH });
    gameState.playerZones['0']!.discard = ['already-discarded'];
    // why: shuffleFunction is null (the strike context carries no random.Shuffle), so the
    // top-up is skipped (reveal as-is) and the remainder returns in revealed order — the
    // pre-WP-482 path, preserved for the no-shuffle degrade.
    mastermindStrikeHandler(gameState, {}, { cardId: 's' }, {});

    assert.deepEqual(gameState.playerZones['0']!.deck, ['b']);
    assert.deepEqual(gameState.playerZones['0']!.discard, ['already-discarded', 'a']);
  });

  it('discards non-grey Heroes and returns grey cards, Wounds included (AC-3)', () => {
    const gameState = makeOctopusRevealState(
      ['hero-tech', WOUND_EXT_ID, 'hero-str', 'starter-no-entry'],
      { 'hero-tech': TECH, 'hero-str': STRENGTH, [WOUND_EXT_ID]: { heroClass: null, team: null } },
    );

    mastermindStrikeHandler(gameState, reversingShuffleContext(), { cardId: 's' }, {});

    assert.deepEqual(
      sortedCopy(gameState.playerZones['0']!.discard),
      sortedCopy(['hero-tech', 'hero-str']),
      'only cards carrying a Hero Class are discarded',
    );
    assert.deepEqual(
      sortedCopy(gameState.playerZones['0']!.deck),
      sortedCopy([WOUND_EXT_ID, 'starter-no-entry']),
      'Wounds and cards with no cardTraits entry are grey and return to the deck',
    );
  });

  it('orders the remainder with the supplied Shuffle (AC-5)', () => {
    const gameState = makeOctopusRevealState(['x', 'y', 'z'], {});

    mastermindStrikeHandler(gameState, reversingShuffleContext(), { cardId: 's' }, {});

    assert.deepEqual(
      gameState.playerZones['0']!.deck,
      ['z', 'y', 'x'],
      'the reversing stand-in proves the Shuffle function was actually applied',
    );
  });

  it('falls back to revealed order when the context carries no Shuffle (AC-5, AC-7)', () => {
    const gameState = makeOctopusRevealState(['x', 'y', 'z'], {});

    // why: unit-test stubs pass `{}`; the fallback must be deterministic and
    // logged, never a throw and never a hand-rolled shuffle.
    assert.doesNotThrow(() =>
      mastermindStrikeHandler(gameState, {}, { cardId: 's' }, {}),
    );
    assert.deepEqual(gameState.playerZones['0']!.deck, ['x', 'y', 'z']);
    assert.ok(
      gameState.messages.some((line) => line.text.includes('no shuffle available')),
      'the fallback is logged rather than silent',
    );
  });

  it('conserves cards across the reveal (AC-6)', () => {
    const deck = ['h1', 'g1', 'h2', 'g2', 'h3', 'g3', 'h4', 'g4', 'g5'];
    const traits: Record<string, { heroClass: string | null; team: string | null }> = {
      h1: TECH, h2: STRENGTH, h3: TECH, h4: STRENGTH,
    };
    const gameState = makeOctopusRevealState(deck, traits);
    gameState.playerZones['0']!.discard = ['pre'];
    const before = sortedCopy([...deck, 'pre']);

    mastermindStrikeHandler(gameState, reversingShuffleContext(), { cardId: 's' }, {});

    const after = sortedCopy([
      ...gameState.playerZones['0']!.deck,
      ...gameState.playerZones['0']!.discard,
    ]);
    assert.deepEqual(after, before, 'deck + discard is unchanged as a multiset');
  });

  it('does not throw on an empty deck, an all-non-grey reveal, or absent cardTraits (AC-7)', () => {
    const emptyDeck = makeOctopusRevealState([], {});
    assert.doesNotThrow(() =>
      mastermindStrikeHandler(emptyDeck, reversingShuffleContext(), { cardId: 's' }, {}),
    );
    assert.deepEqual(emptyDeck.playerZones['0']!.deck, []);

    const allNonGrey = makeOctopusRevealState(['a', 'b'], { a: TECH, b: STRENGTH });
    assert.doesNotThrow(() =>
      mastermindStrikeHandler(allNonGrey, reversingShuffleContext(), { cardId: 's' }, {}),
    );
    assert.deepEqual(allNonGrey.playerZones['0']!.deck, [], 'every revealed card was discarded');
    assert.deepEqual(sortedCopy(allNonGrey.playerZones['0']!.discard), sortedCopy(['a', 'b']));

    const noTraits = makeOctopusRevealState(['a', 'b'], {});
    (noTraits as { cardTraits?: unknown }).cardTraits = undefined;
    assert.doesNotThrow(() =>
      mastermindStrikeHandler(noTraits, reversingShuffleContext(), { cardId: 's' }, {}),
    );
    assert.equal(noTraits.playerZones['0']!.deck.length, 2, 'no traits map — everything reads grey');
  });

  it('preserves the generic strike behaviour on the reveal branch (AC-8)', () => {
    const gameState = makeOctopusRevealState(['a'], {});

    const effects = mastermindStrikeHandler(
      gameState,
      reversingShuffleContext(),
      { cardId: 's' },
      {},
    );

    assert.deepEqual(effects, [
      { type: 'modifyCounter', counter: 'masterStrikeCount', delta: 1 },
      { type: 'queueMessage', message: 'Mastermind strike revealed — strike count incremented.' },
    ]);
    assert.equal(gameState.mastermind.attachedBystanders.length, 1, 'D-15401 capture still runs');
    assert.equal(gameState.notableEvents.length, 1, 'WP-200 emission still terminal');
  });

  it('leaves the other co2e resolvers untouched by the context change (AC-8)', () => {
    const loki = makeCo2eState(
      'co2e/loki',
      { '0': ['st-a'] },
      { 'st-a': co2eStat(1) },
      { 'st-a': STRENGTH },
    );
    loki.playerZones['0']!.deck = ['d1', 'd2'];

    mastermindStrikeHandler(loki, reversingShuffleContext(), { cardId: 's' }, {});

    // why: only Doctor Octopus reveals. Loki discards and must never touch the
    // deck, even now that a shuffle function is available to the handler.
    assert.deepEqual(loki.playerZones['0']!.deck, ['d1', 'd2']);
    assert.deepEqual(loki.playerZones['0']!.discard, ['st-a']);
  });
});
