/**
 * Reveal pipeline tests for the villain deck subsystem.
 *
 * All tests construct mock G states with pre-populated villainDeck and
 * villainDeckCardTypes. They do not depend on buildVillainDeck (WP-014B).
 *
 * Trigger emission is verified by installing test hooks in G.hookRegistry
 * that return deterministic queueMessage effects, then asserting the
 * expected messages appear in G.messages after revealVillainCard runs.
 *
 * Uses node:test and node:assert only. Uses makeMockCtx. No boardgame.io
 * imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { revealVillainCard } from './villainDeck.reveal.js';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { RevealedCardType, VillainDeckState } from './villainDeck.types.js';
import type { HookDefinition, RuleEffect } from '../rules/ruleHooks.types.js';
import type { ImplementationMap } from '../rules/ruleRuntime.execute.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { TURN_STAGES } from '../turn/turnPhases.types.js';
import { buildDefaultHookDefinitions } from '../rules/ruleRuntime.impl.js';
import { DEFAULT_IMPLEMENTATION_MAP } from '../rules/ruleRuntime.impl.js';

// ---------------------------------------------------------------------------
// Test hook infrastructure
// ---------------------------------------------------------------------------

/** Stable identifier for the test reveal hook. */
const TEST_REVEAL_HOOK_ID = 'test-reveal-hook';

/**
 * Creates a HookDefinition that subscribes to the given triggers.
 * The handler encodes the trigger name and card ID into a queueMessage effect
 * so tests can observe which triggers fired and with what payload.
 */
function createTestHookDefinition(
  triggers: HookDefinition['triggers'],
): HookDefinition {
  return {
    id: TEST_REVEAL_HOOK_ID,
    kind: 'scheme',
    sourceId: 'test-source',
    triggers,
    priority: 1,
  };
}

/**
 * Handler for the test reveal hook. Returns a queueMessage effect encoding
 * the trigger name and cardId from the payload.
 */
function testRevealHandler(
  _gameState: LegendaryGameState,
  _ctx: unknown,
  payload: unknown,
): RuleEffect[] {
  const typedPayload = payload as { cardId?: string; cardTypeSlug?: string };
  const cardId = typedPayload.cardId ?? 'unknown';
  const cardTypeSlug = typedPayload.cardTypeSlug ?? '';
  const suffix = cardTypeSlug ? `:type:${cardTypeSlug}` : '';
  return [
    { type: 'queueMessage', message: `test-trigger:cardId:${cardId}${suffix}` },
  ];
}

/**
 * Builds an ImplementationMap that includes the test reveal hook handler
 * alongside the default implementations.
 */
function createTestImplementationMap(): ImplementationMap {
  return {
    ...DEFAULT_IMPLEMENTATION_MAP,
    [TEST_REVEAL_HOOK_ID]: testRevealHandler,
  };
}

// ---------------------------------------------------------------------------
// Mock G factory
// ---------------------------------------------------------------------------

/**
 * Creates a minimal LegendaryGameState for reveal tests.
 * All fields required by LegendaryGameState are present. The villainDeck
 * and villainDeckCardTypes are populated with the provided test data.
 */
function createMockGameState(options: {
  deck: CardExtId[];
  discard: CardExtId[];
  cardTypes: Record<CardExtId, RevealedCardType>;
  hookDefinitions?: HookDefinition[];
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

  const defaultHooks = buildDefaultHookDefinitions(config);
  const additionalHooks = options.hookDefinitions ?? [];

  return {
    matchConfiguration: config,
    selection: {
      schemeId: config.schemeId,
      mastermindId: config.mastermindId,
      villainGroupIds: [...config.villainGroupIds],
      henchmanGroupIds: [...config.henchmanGroupIds],
      heroDeckIds: [...config.heroDeckIds],
    },
    currentStage: TURN_STAGES[0]!,
    playerZones: {},
    piles: {
      bystanders: [],
      wounds: [],
      officers: [],
      sidekicks: [],
    },
    messages: [],
    counters: {},
    hookRegistry: [...defaultHooks, ...additionalHooks],
    villainDeck: {
      deck: options.deck,
      discard: options.discard,
    },
    villainDeckCardTypes: options.cardTypes,
    lobby: {
      requiredPlayers: 1,
      ready: {},
      started: false,
    },
  };
}

/**
 * Creates a mock MoveContext for revealVillainCard.
 * Uses makeMockCtx for the random provider and adds required boardgame.io
 * move context fields.
 */
function createMockMoveContext(gameState: LegendaryGameState) {
  const mockCtx = makeMockCtx({ numPlayers: 1 });
  return {
    G: gameState,
    ctx: { ...mockCtx.ctx, currentPlayer: '0', phase: 'play', turn: 1, numMoves: 0, playOrder: ['0'], playOrderPos: 0, activePlayers: null },
    random: mockCtx.random,
    events: { endTurn: () => {}, setPhase: () => {}, endGame: () => {} },
    playerID: '0' as string,
    log: { setMetadata: () => {} },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('revealVillainCard', () => {
  it('draws the top card from G.villainDeck.deck', () => {
    const gameState = createMockGameState({
      deck: ['card-a', 'card-b', 'card-c'],
      discard: [],
      cardTypes: { 'card-a': 'villain', 'card-b': 'villain', 'card-c': 'villain' },
    });

    const moveContext = createMockMoveContext(gameState);
    revealVillainCard(moveContext);

    assert.ok(
      !moveContext.G.villainDeck.deck.includes('card-a'),
      'card-a must be removed from deck after reveal',
    );
    assert.equal(
      moveContext.G.villainDeck.deck.length,
      2,
      'Deck must have 2 cards remaining after revealing 1',
    );
    assert.equal(
      moveContext.G.villainDeck.deck[0],
      'card-b',
      'card-b must be the new top of deck',
    );
  });

  it('places the revealed card in G.villainDeck.discard', () => {
    const gameState = createMockGameState({
      deck: ['card-a', 'card-b'],
      discard: [],
      cardTypes: { 'card-a': 'villain', 'card-b': 'villain' },
    });

    const moveContext = createMockMoveContext(gameState);
    revealVillainCard(moveContext);

    assert.ok(
      moveContext.G.villainDeck.discard.includes('card-a'),
      'card-a must be in discard after reveal',
    );
  });

  it('onCardRevealed trigger fires with correct cardId and cardTypeSlug', () => {
    const testHook = createTestHookDefinition(['onCardRevealed']);
    const gameState = createMockGameState({
      deck: ['villain-card-001'],
      discard: [],
      cardTypes: { 'villain-card-001': 'villain' },
      hookDefinitions: [testHook],
    });

    // why: We must replace the default implementation map with one that
    // includes our test handler. Since revealVillainCard uses the module-level
    // DEFAULT_IMPLEMENTATION_MAP, we need our test hook to be in that map.
    // We work around this by directly manipulating the map for testing.
    const originalHandler = DEFAULT_IMPLEMENTATION_MAP[TEST_REVEAL_HOOK_ID];
    DEFAULT_IMPLEMENTATION_MAP[TEST_REVEAL_HOOK_ID] = testRevealHandler;

    try {
      const moveContext = createMockMoveContext(gameState);
      revealVillainCard(moveContext);

      const triggerMessage = moveContext.G.messages.find(
        (message) => message.startsWith('test-trigger:'),
      );
      assert.ok(
        triggerMessage,
        'G.messages must contain a test-trigger message after reveal',
      );
      assert.ok(
        triggerMessage.includes('cardId:villain-card-001'),
        'Trigger message must contain the correct cardId',
      );
      assert.ok(
        triggerMessage.includes('type:villain'),
        'Trigger message must contain the correct cardTypeSlug',
      );
    } finally {
      if (originalHandler) {
        DEFAULT_IMPLEMENTATION_MAP[TEST_REVEAL_HOOK_ID] = originalHandler;
      } else {
        delete DEFAULT_IMPLEMENTATION_MAP[TEST_REVEAL_HOOK_ID];
      }
    }
  });

  it('onSchemeTwistRevealed fires only when card type is scheme-twist', () => {
    const testHook = createTestHookDefinition([
      'onCardRevealed',
      'onSchemeTwistRevealed',
    ]);
    const gameState = createMockGameState({
      deck: ['twist-card-001'],
      discard: [],
      cardTypes: { 'twist-card-001': 'scheme-twist' },
      hookDefinitions: [testHook],
    });

    DEFAULT_IMPLEMENTATION_MAP[TEST_REVEAL_HOOK_ID] = testRevealHandler;

    try {
      const moveContext = createMockMoveContext(gameState);
      revealVillainCard(moveContext);

      const triggerMessages = moveContext.G.messages.filter(
        (message) => message.startsWith('test-trigger:'),
      );
      assert.equal(
        triggerMessages.length,
        2,
        'Two test-trigger messages expected: onCardRevealed + onSchemeTwistRevealed',
      );
    } finally {
      delete DEFAULT_IMPLEMENTATION_MAP[TEST_REVEAL_HOOK_ID];
    }
  });

  it('onSchemeTwistRevealed does NOT fire for villain cards', () => {
    const testHook = createTestHookDefinition([
      'onCardRevealed',
      'onSchemeTwistRevealed',
    ]);
    const gameState = createMockGameState({
      deck: ['villain-card-001'],
      discard: [],
      cardTypes: { 'villain-card-001': 'villain' },
      hookDefinitions: [testHook],
    });

    DEFAULT_IMPLEMENTATION_MAP[TEST_REVEAL_HOOK_ID] = testRevealHandler;

    try {
      const moveContext = createMockMoveContext(gameState);
      revealVillainCard(moveContext);

      const triggerMessages = moveContext.G.messages.filter(
        (message) => message.startsWith('test-trigger:'),
      );
      assert.equal(
        triggerMessages.length,
        1,
        'Only onCardRevealed should fire for villain cards, not onSchemeTwistRevealed',
      );
    } finally {
      delete DEFAULT_IMPLEMENTATION_MAP[TEST_REVEAL_HOOK_ID];
    }
  });

  it('onMastermindStrikeRevealed fires only when card type is mastermind-strike', () => {
    const testHook = createTestHookDefinition([
      'onCardRevealed',
      'onMastermindStrikeRevealed',
    ]);
    const gameState = createMockGameState({
      deck: ['strike-card-001'],
      discard: [],
      cardTypes: { 'strike-card-001': 'mastermind-strike' },
      hookDefinitions: [testHook],
    });

    DEFAULT_IMPLEMENTATION_MAP[TEST_REVEAL_HOOK_ID] = testRevealHandler;

    try {
      const moveContext = createMockMoveContext(gameState);
      revealVillainCard(moveContext);

      const triggerMessages = moveContext.G.messages.filter(
        (message) => message.startsWith('test-trigger:'),
      );
      assert.equal(
        triggerMessages.length,
        2,
        'Two test-trigger messages expected: onCardRevealed + onMastermindStrikeRevealed',
      );
    } finally {
      delete DEFAULT_IMPLEMENTATION_MAP[TEST_REVEAL_HOOK_ID];
    }
  });

  it('reshuffles discard into deck when deck is empty but discard has cards', () => {
    const gameState = createMockGameState({
      deck: [],
      discard: ['card-x', 'card-y', 'card-z'],
      cardTypes: { 'card-x': 'villain', 'card-y': 'henchman', 'card-z': 'bystander' },
    });

    const moveContext = createMockMoveContext(gameState);
    revealVillainCard(moveContext);

    assert.ok(
      moveContext.G.villainDeck.discard.length > 0,
      'After reshuffle + reveal, discard must contain the revealed card',
    );
    // makeMockCtx reverses arrays, so the reshuffled deck order is reversed
    // The total cards across deck + discard must equal the original 3
    const totalCards =
      moveContext.G.villainDeck.deck.length +
      moveContext.G.villainDeck.discard.length;
    assert.equal(
      totalCards,
      3,
      'Total cards across deck + discard must remain 3 after reshuffle + reveal',
    );
  });

  it('returns with message when both deck and discard are empty', () => {
    const gameState = createMockGameState({
      deck: [],
      discard: [],
      cardTypes: {},
    });

    const moveContext = createMockMoveContext(gameState);
    const messagesBefore = moveContext.G.messages.length;
    revealVillainCard(moveContext);

    assert.equal(
      moveContext.G.villainDeck.deck.length,
      0,
      'Deck must remain empty',
    );
    assert.equal(
      moveContext.G.villainDeck.discard.length,
      0,
      'Discard must remain empty',
    );
    assert.ok(
      moveContext.G.messages.length > messagesBefore,
      'A message must be appended when both deck and discard are empty',
    );
  });

  it('JSON.stringify(G) succeeds after reveal', () => {
    const gameState = createMockGameState({
      deck: ['card-a', 'card-b'],
      discard: ['card-c'],
      cardTypes: { 'card-a': 'villain', 'card-b': 'henchman', 'card-c': 'bystander' },
    });

    const moveContext = createMockMoveContext(gameState);
    revealVillainCard(moveContext);

    const serialized = JSON.stringify(moveContext.G);
    assert.ok(
      serialized,
      'JSON.stringify(G) must produce a non-empty string after reveal',
    );
  });

  it('fails closed when cardType is missing from villainDeckCardTypes', () => {
    const gameState = createMockGameState({
      deck: ['unknown-card-001', 'card-b'],
      discard: [],
      cardTypes: { 'card-b': 'villain' },
    });

    const moveContext = createMockMoveContext(gameState);
    const deckBefore = [...moveContext.G.villainDeck.deck];
    revealVillainCard(moveContext);

    assert.deepStrictEqual(
      moveContext.G.villainDeck.deck,
      deckBefore,
      'Deck must remain unchanged when cardType is missing (fail-closed)',
    );
    assert.equal(
      moveContext.G.villainDeck.discard.length,
      0,
      'Discard must remain empty when cardType is missing',
    );
    assert.ok(
      moveContext.G.messages.some((message) =>
        message.includes('unknown-card-001'),
      ),
      'A message mentioning the missing card must be appended',
    );
  });
});
