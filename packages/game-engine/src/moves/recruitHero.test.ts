/**
 * Recruit hero move tests for WP-016.
 *
 * Verifies recruitHero follows the three-step validation contract,
 * gates to main stage, removes heroes from HQ to discard pile,
 * and handles invalid inputs gracefully.
 *
 * Uses node:test and node:assert only. Uses makeMockCtx. No boardgame.io
 * imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { recruitHero } from './recruitHero.js';
import type { LegendaryGameState } from '../types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { TURN_STAGES } from '../turn/turnPhases.types.js';
import { buildDefaultHookDefinitions } from '../rules/ruleRuntime.impl.js';
import { initializeCity, initializeHq } from '../board/city.logic.js';
import { drawCardsIntoHand } from './drawCards.logic.js';

// ---------------------------------------------------------------------------
// Mock G factory
// ---------------------------------------------------------------------------

/**
 * Creates a minimal LegendaryGameState for recruit tests.
 * HQ has a hero at the specified index. Player 0 has empty zones.
 */
function createMockGameState(options?: {
  hq?: LegendaryGameState['hq'];
  currentStage?: LegendaryGameState['currentStage'];
  heroDeck?: LegendaryGameState['heroDeck'];
  // why: WP-273 — the wall-crawl placement reads the recruited card's onRecruit
  // hooks from G.heroAbilityHooks; existing tests omit it (the Array.isArray guard
  // in recruitHero then routes to discard exactly as before).
  heroAbilityHooks?: HeroAbilityHook[];
  deck?: string[];
}): LegendaryGameState {
  const config = {
    schemeId: 'test-scheme',
    mastermindId: 'test-mastermind',
    villainGroupIds: ['test-villain-group'],
    henchmanGroupIds: ['test-henchman-group'],
    heroDeckIds: ['test-hero-deck'],
    bystandersCount: 1,
    woundsCount: 1,
    officersCount: 1,
    sidekicksCount: 1,
  };

  return {
    matchConfiguration: config,
    selection: {
      schemeId: config.schemeId,
      mastermindId: config.mastermindId,
      villainGroupIds: [...config.villainGroupIds],
      henchmanGroupIds: [...config.henchmanGroupIds],
      heroDeckIds: [...config.heroDeckIds],
    },
    currentStage: options?.currentStage ?? 'main',
    playerZones: {
      '0': {
        deck: options?.deck ?? [],
        hand: [],
        discard: [],
        inPlay: [],
        victory: [],
      },
    },
    piles: {
      bystanders: [],
      wounds: [],
      officers: [],
      sidekicks: [],
    },
    messages: [],
    counters: {},
    hookRegistry: buildDefaultHookDefinitions(config),
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: {},
    ko: [],
    attachedBystanders: {},
    turnEconomy: { attack: 0, recruit: 0, spentAttack: 0, spentRecruit: 0 },
    cardStats: {},
    mastermind: {
      id: 'test-mastermind',
      baseCardId: 'test-mastermind-base',
      tacticsDeck: [],
      tacticsDefeated: [],
    },
    city: initializeCity(),
    hq: options?.hq ?? initializeHq(),
    // why: WP-135 — recruitHero refills the vacated HQ slot from G.heroDeck
    // via refillHqSlot. The mock supplies an empty reservoir by default;
    // tests that exercise the refill branch override `heroDeck` per case.
    heroDeck: options?.heroDeck ?? [],
    heroAbilityHooks: options?.heroAbilityHooks ?? [],
    lobby: {
      requiredPlayers: 1,
      ready: {},
      started: false,
    },
  };
}

/**
 * Creates a mock MoveContext for recruitHero.
 */
function createMockMoveContext(gameState: LegendaryGameState) {
  const mockCtx = makeMockCtx({ numPlayers: 1 });
  return {
    G: gameState,
    ctx: {
      ...mockCtx.ctx,
      currentPlayer: '0',
      phase: 'play',
      turn: 1,
      numMoves: 0,
      playOrder: ['0'],
      playOrderPos: 0,
      activePlayers: null,
    },
    random: mockCtx.random,
    events: { endTurn: () => {}, setPhase: () => {}, endGame: () => {} },
    playerID: '0' as string,
    log: { setMetadata: () => {} },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('recruitHero', () => {
  it('removes card from G.hq[hqIndex]', () => {
    const gameState = createMockGameState({
      hq: ['hero-a', null, 'hero-c', null, null],
    });

    const moveContext = createMockMoveContext(gameState);
    recruitHero(moveContext, { hqIndex: 0 });

    assert.equal(
      moveContext.G.hq[0],
      null,
      'HQ slot 0 must be null after recruit',
    );
  });

  it('removed card appears in player discard zone', () => {
    const gameState = createMockGameState({
      hq: ['hero-a', null, null, null, null],
    });

    const moveContext = createMockMoveContext(gameState);
    recruitHero(moveContext, { hqIndex: 0 });

    assert.ok(
      moveContext.G.playerZones['0']!.discard.includes('hero-a'),
      'hero-a must be in player 0 discard zone',
    );
  });

  it('invalid hqIndex (out of range): no mutation', () => {
    const gameState = createMockGameState({
      hq: ['hero-a', null, null, null, null],
    });

    const moveContext = createMockMoveContext(gameState);
    const hqBefore = [...moveContext.G.hq];

    recruitHero(moveContext, { hqIndex: 5 });
    assert.deepStrictEqual(moveContext.G.hq, hqBefore, 'HQ unchanged for index 5');

    recruitHero(moveContext, { hqIndex: -1 });
    assert.deepStrictEqual(moveContext.G.hq, hqBefore, 'HQ unchanged for index -1');

    recruitHero(moveContext, { hqIndex: 2.5 });
    assert.deepStrictEqual(moveContext.G.hq, hqBefore, 'HQ unchanged for non-integer');

    recruitHero(moveContext, { hqIndex: NaN });
    assert.deepStrictEqual(moveContext.G.hq, hqBefore, 'HQ unchanged for NaN');
  });

  it('empty HQ slot (null): no mutation', () => {
    const gameState = createMockGameState({
      hq: [null, null, null, null, null],
    });

    const moveContext = createMockMoveContext(gameState);
    const discardBefore = moveContext.G.playerZones['0']!.discard.length;

    recruitHero(moveContext, { hqIndex: 2 });

    assert.equal(
      moveContext.G.playerZones['0']!.discard.length,
      discardBefore,
      'Discard zone must not change when recruiting from empty slot',
    );
  });

  it('wrong stage (cleanup): no mutation', () => {
    const gameState = createMockGameState({
      hq: ['hero-a', null, null, null, null],
      currentStage: 'cleanup',
    });

    const moveContext = createMockMoveContext(gameState);
    const hqBefore = [...moveContext.G.hq];
    const messagesBefore = moveContext.G.messages.length;

    recruitHero(moveContext, { hqIndex: 0 });

    assert.deepStrictEqual(
      moveContext.G.hq,
      hqBefore,
      'HQ must not change when stage is not main',
    );
    assert.equal(
      moveContext.G.messages.length,
      messagesBefore,
      'No messages when stage gate blocks',
    );
  });

  it('JSON.stringify(G) succeeds after recruit', () => {
    const gameState = createMockGameState({
      hq: ['hero-a', 'hero-b', null, null, null],
    });

    const moveContext = createMockMoveContext(gameState);
    recruitHero(moveContext, { hqIndex: 1 });

    const serialized = JSON.stringify(moveContext.G);
    assert.ok(serialized, 'JSON.stringify(G) must produce a non-empty string');
  });

  it('idempotence: second call on same index is no-op', () => {
    const gameState = createMockGameState({
      hq: ['hero-a', null, null, null, null],
    });

    const moveContext = createMockMoveContext(gameState);
    recruitHero(moveContext, { hqIndex: 0 });

    assert.equal(moveContext.G.playerZones['0']!.discard.length, 1, 'One card in discard after first recruit');

    recruitHero(moveContext, { hqIndex: 0 });

    assert.equal(
      moveContext.G.playerZones['0']!.discard.length,
      1,
      'Discard unchanged after second recruit on same (now null) slot',
    );
  });
});

// ---------------------------------------------------------------------------
// WP-135 — HQ refill on recruit + D-13503 empty-deck branch + locked log line
// ---------------------------------------------------------------------------

describe('recruitHero — WP-135 HQ refill', () => {
  it('refills the vacated slot with the front card of G.heroDeck (FIFO)', () => {
    const gameState = createMockGameState({
      hq: ['hero-a', null, null, null, null],
      heroDeck: ['next-card', 'after-next', 'tail'],
    });

    const moveContext = createMockMoveContext(gameState);
    recruitHero(moveContext, { hqIndex: 0 });

    assert.equal(
      moveContext.G.hq[0],
      'next-card',
      'Vacated slot must be refilled with the front card of G.heroDeck (FIFO)',
    );
    assert.deepStrictEqual(
      moveContext.G.heroDeck,
      ['after-next', 'tail'],
      'G.heroDeck length decrements by 1; remaining cards preserved in order',
    );
  });

  it('empty-deck branch: vacated slot stays null; G.heroDeck stays []', () => {
    const gameState = createMockGameState({
      hq: ['hero-a', null, null, null, null],
      heroDeck: [],
    });

    const moveContext = createMockMoveContext(gameState);
    recruitHero(moveContext, { hqIndex: 0 });

    assert.equal(
      moveContext.G.hq[0],
      null,
      'Empty-deck branch: vacated slot stays null per D-13503',
    );
    assert.deepStrictEqual(
      moveContext.G.heroDeck,
      [],
      'G.heroDeck stays [] — no auto-reshuffle of recruited cards back into the deck',
    );
  });

  it('refills only the vacated slot — other slots are unchanged', () => {
    const gameState = createMockGameState({
      hq: ['hero-a', 'hero-b', 'hero-c', 'hero-d', 'hero-e'],
      heroDeck: ['refill-card', 'tail'],
    });

    const moveContext = createMockMoveContext(gameState);
    recruitHero(moveContext, { hqIndex: 2 });

    assert.equal(moveContext.G.hq[0], 'hero-a', 'slot 0 unchanged');
    assert.equal(moveContext.G.hq[1], 'hero-b', 'slot 1 unchanged');
    assert.equal(moveContext.G.hq[2], 'refill-card', 'slot 2 refilled');
    assert.equal(moveContext.G.hq[3], 'hero-d', 'slot 3 unchanged');
    assert.equal(moveContext.G.hq[4], 'hero-e', 'slot 4 unchanged');
  });
});

describe('recruitHero — WP-135 G.messages locked log format', () => {
  it('exactly ONE G.messages entry per successful recruit (the WP-135 push REPLACES the WP-016 push)', () => {
    const gameState = createMockGameState({
      hq: ['core/spider-man/astonishing-strength', null, null, null, null],
      heroDeck: ['core/black-widow/mission-accomplished'],
    });

    const moveContext = createMockMoveContext(gameState);
    const messagesBefore = moveContext.G.messages.length;
    recruitHero(moveContext, { hqIndex: 0 });

    const newMessageCount = moveContext.G.messages.length - messagesBefore;
    assert.equal(
      newMessageCount,
      1,
      'Each successful recruit must push exactly one G.messages entry (replaces the pre-WP-135 WP-016 push, not augments)',
    );
  });

  it('non-empty deck: log line follows the byte-locked WP-135 format', () => {
    const gameState = createMockGameState({
      hq: ['core/spider-man/astonishing-strength', null, null, null, null],
      heroDeck: ['core/black-widow/mission-accomplished', 'core/black-widow/silent-takedown'],
    });

    const moveContext = createMockMoveContext(gameState);
    recruitHero(moveContext, { hqIndex: 0 });

    const lastMessage = moveContext.G.messages[moveContext.G.messages.length - 1]!.text;
    assert.equal(
      lastMessage,
      'Player 0 recruited core/spider-man/astonishing-strength (core/spider-man/astonishing-strength); HQ slot 0 refilled from heroDeck (heroDeck.length: 1)',
      'Locked WP-135 byte-equality format must match exactly',
    );
  });

  it('empty-deck branch: log line substitutes the trailing parenthetical', () => {
    const gameState = createMockGameState({
      hq: ['core/spider-man/astonishing-strength', null, null, null, null],
      heroDeck: [],
    });

    const moveContext = createMockMoveContext(gameState);
    recruitHero(moveContext, { hqIndex: 0 });

    const lastMessage = moveContext.G.messages[moveContext.G.messages.length - 1]!.text;
    assert.equal(
      lastMessage,
      'Player 0 recruited core/spider-man/astonishing-strength (core/spider-man/astonishing-strength); HQ slot 0 refilled from heroDeck (heroDeck empty; slot left null)',
      'Empty-deck branch must substitute the locked trailing parenthetical',
    );
  });

  it('log line never contains a timestamp, date, or other non-deterministic context', () => {
    const gameState = createMockGameState({
      hq: ['core/spider-man/astonishing-strength', null, null, null, null],
      heroDeck: ['core/black-widow/mission-accomplished'],
    });

    const moveContext = createMockMoveContext(gameState);
    recruitHero(moveContext, { hqIndex: 0 });

    const lastMessage = moveContext.G.messages[moveContext.G.messages.length - 1]!.text;
    assert.equal(/\d{4}-\d{2}-\d{2}/.test(lastMessage), false, 'No date pattern (YYYY-MM-DD) in log line');
    assert.equal(/T\d{2}:\d{2}:\d{2}/.test(lastMessage), false, 'No ISO timestamp pattern in log line');
    assert.equal(/\d{13}/.test(lastMessage), false, 'No millisecond unix timestamp in log line');
  });
});

// ---------------------------------------------------------------------------
// WP-273 / D-24049 — Wall-Crawl onRecruit keyword + optional deck-top placement
// ---------------------------------------------------------------------------

describe('recruitHero — WP-273 Wall-Crawl deck-top placement', () => {
  const WALL_CRAWL_CARD = 'pttr/symbiote-spider-man/dark-strength#0';

  /** An onRecruit wall-crawl hook for the given card id. */
  function wallCrawlHook(cardId: string): HeroAbilityHook {
    return { cardId, timing: 'onRecruit', keywords: ['wall-crawl'], effects: [{ type: 'wall-crawl' }] };
  }

  it('toTopOfDeck:true places the wall-crawl Hero at the next-draw position (proven by drawing 1)', () => {
    const gameState = createMockGameState({
      hq: [WALL_CRAWL_CARD, null, null, null, null],
      deck: ['already-on-deck'],
      heroAbilityHooks: [wallCrawlHook(WALL_CRAWL_CARD)],
    });

    const moveContext = createMockMoveContext(gameState);
    recruitHero(moveContext, { hqIndex: 0, toTopOfDeck: true });

    const playerZones = moveContext.G.playerZones['0']!;
    assert.equal(playerZones.deck[0], WALL_CRAWL_CARD, 'recruited card occupies deck[0]');
    assert.equal(
      playerZones.discard.includes(WALL_CRAWL_CARD),
      false,
      'recruited card is NOT in discard on the deck-top branch',
    );

    // why: D-24049 — contract-level proof of "top": draw 1 via the real draw helper and
    // assert the recruited card lands in hand (not a raw index check).
    drawCardsIntoHand(playerZones, 1, { random: moveContext.random });
    assert.ok(
      playerZones.hand.includes(WALL_CRAWL_CARD),
      'drawing 1 card yields the recruited wall-crawl Hero — it was on top of the deck',
    );
  });

  it('toTopOfDeck:true appends the locked Wall-Crawl placement note to the recruit log line', () => {
    const gameState = createMockGameState({
      hq: [WALL_CRAWL_CARD, null, null, null, null],
      heroDeck: ['next-card'],
      heroAbilityHooks: [wallCrawlHook(WALL_CRAWL_CARD)],
    });

    const moveContext = createMockMoveContext(gameState);
    recruitHero(moveContext, { hqIndex: 0, toTopOfDeck: true });

    const lastMessage = moveContext.G.messages[moveContext.G.messages.length - 1]!.text;
    assert.equal(
      lastMessage,
      `Player 0 recruited ${WALL_CRAWL_CARD} (${WALL_CRAWL_CARD}); HQ slot 0 refilled from heroDeck (heroDeck.length: 0) (Wall-Crawl: placed on top of deck)`,
      'deck-top branch appends the byte-locked Wall-Crawl placement note',
    );
  });

  it('toTopOfDeck omitted for a wall-crawl Hero goes to discard with the byte-identical WP-135 log', () => {
    const gameState = createMockGameState({
      hq: [WALL_CRAWL_CARD, null, null, null, null],
      heroDeck: ['next-card'],
      heroAbilityHooks: [wallCrawlHook(WALL_CRAWL_CARD)],
    });

    const moveContext = createMockMoveContext(gameState);
    recruitHero(moveContext, { hqIndex: 0 });

    const playerZones = moveContext.G.playerZones['0']!;
    assert.ok(playerZones.discard.includes(WALL_CRAWL_CARD), 'omitted toTopOfDeck routes to discard');
    assert.equal(playerZones.deck.includes(WALL_CRAWL_CARD), false, 'card is not placed on the deck');
    const lastMessage = moveContext.G.messages[moveContext.G.messages.length - 1]!.text;
    assert.equal(
      lastMessage,
      `Player 0 recruited ${WALL_CRAWL_CARD} (${WALL_CRAWL_CARD}); HQ slot 0 refilled from heroDeck (heroDeck.length: 0)`,
      'discard branch log line is byte-identical to the locked WP-135 format (no placement note)',
    );
  });

  it('toTopOfDeck:false for a wall-crawl Hero goes to discard', () => {
    const gameState = createMockGameState({
      hq: [WALL_CRAWL_CARD, null, null, null, null],
      deck: ['already-on-deck'],
      heroAbilityHooks: [wallCrawlHook(WALL_CRAWL_CARD)],
    });

    const moveContext = createMockMoveContext(gameState);
    recruitHero(moveContext, { hqIndex: 0, toTopOfDeck: false });

    const playerZones = moveContext.G.playerZones['0']!;
    assert.ok(playerZones.discard.includes(WALL_CRAWL_CARD), 'explicit false routes to discard');
    assert.deepStrictEqual(playerZones.deck, ['already-on-deck'], 'deck order is unchanged');
  });

  it('toTopOfDeck:true for a Hero whose only onRecruit hook is NOT wall-crawl goes to discard', () => {
    // why: D-24049 — the placement tests SPECIFICALLY for a wall-crawl keyword on an
    // onRecruit hook, never "the first onRecruit hook" — a non-wall-crawl onRecruit hook
    // must not trigger the deck-top placement.
    const nonWallCrawlCard = 'core/spider-man/astonishing-strength#0';
    const nonWallCrawlHook: HeroAbilityHook = {
      cardId: nonWallCrawlCard,
      timing: 'onRecruit',
      keywords: ['draw'],
      effects: [{ type: 'draw', magnitude: 1 }],
    };
    const gameState = createMockGameState({
      hq: [nonWallCrawlCard, null, null, null, null],
      deck: ['already-on-deck'],
      heroAbilityHooks: [nonWallCrawlHook],
    });

    const moveContext = createMockMoveContext(gameState);
    recruitHero(moveContext, { hqIndex: 0, toTopOfDeck: true });

    const playerZones = moveContext.G.playerZones['0']!;
    assert.ok(playerZones.discard.includes(nonWallCrawlCard), 'non-wall-crawl Hero routes to discard');
    assert.deepStrictEqual(playerZones.deck, ['already-on-deck'], 'deck order is unchanged');
  });
});
