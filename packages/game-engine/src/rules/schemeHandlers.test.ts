/**
 * Tests for scheme twist handler (WP-024) and the per-scheme dispatcher.
 *
 * Verifies generic twist counting + scheme-loss triggering at threshold,
 * read-only G invariant for the generic path, ENDGAME_CONDITIONS constant
 * usage, serialization, AND the Midtown Bank Robbery twist resolver
 * (Bank-villain bystander capture + chained villain-deck reveal).
 *
 * No boardgame.io imports. Uses node:test and node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { schemeTwistHandler } from './schemeHandlers.js';
import {
  DEFAULT_IMPLEMENTATION_MAP,
  DEFAULT_SCHEME_HOOK_ID,
} from './ruleRuntime.impl.js';
import { ENDGAME_CONDITIONS } from '../endgame/endgame.types.js';
import type { LegendaryGameState } from '../types.js';
import type { HookDefinition } from './ruleHooks.types.js';

// ---------------------------------------------------------------------------
// Test helper
// ---------------------------------------------------------------------------

/**
 * Creates a minimal LegendaryGameState for scheme handler testing.
 *
 * @param counterOverrides - Optional counter values to preset.
 * @returns A minimal LegendaryGameState.
 */
function makeTestState(counterOverrides?: Record<string, number>): LegendaryGameState {
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
      '0': {
        deck: [],
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
    // why: WP-200 — required field; scheme twist resolvers emit to
    // `notableEvents` at their terminal point.
    notableEvents: [],
    counters: counterOverrides ?? {},
    hookRegistry: [],
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: {},
    ko: [],
    attachedBystanders: {},
    turnEconomy: {
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
  };
}

// ---------------------------------------------------------------------------
// Midtown Bank Robbery fixture helpers
// ---------------------------------------------------------------------------

// why: Bank = engine city index 1 per useCityRow.ts visual mapping
// (engine 0 = Sewers; engine 4 = Bridge). Hardcoded here so the test
// breaks loudly if BANK_CITY_INDEX in schemeHandlers.ts drifts.
const BANK_INDEX = 1;

/** Identity shuffle so tests are deterministic without depending on PRNG. */
const identityRandom = { Shuffle: <T,>(deck: T[]) => [...deck] };

/**
 * Builds a context shaped like the RevealContext that performVillainReveal
 * receives from the move (and that scheme dispatchers cast it back to for
 * the chained reveal).
 */
function makeRevealContext(currentPlayer: string = '0') {
  return { random: identityRandom, ctx: { currentPlayer } };
}

/**
 * Adds a Midtown Bank Robbery hook to G.hookRegistry so the chained reveal
 * inside the handler can fire onSchemeTwistRevealed without recursing
 * forever (the chained reveal will hit a villain in the deck, not another
 * twist).
 */
function midtownHookRegistry(): HookDefinition[] {
  return [
    {
      id: DEFAULT_SCHEME_HOOK_ID,
      kind: 'scheme',
      sourceId: 'core/midtown-bank-robbery',
      triggers: ['onSchemeTwistRevealed'],
      priority: 10,
    },
  ];
}

describe('schemeTwistHandler', () => {
  // -------------------------------------------------------------------------
  // Test 1: handler returns non-empty RuleEffect[]
  // -------------------------------------------------------------------------
  it('returns non-empty RuleEffect[]', () => {
    const gameState = makeTestState();
    const effects = schemeTwistHandler(gameState, {}, { cardId: 'test-twist' }, DEFAULT_IMPLEMENTATION_MAP);

    assert.ok(Array.isArray(effects), 'result must be an array');
    assert.ok(effects.length > 0, 'result must not be empty');
  });

  // -------------------------------------------------------------------------
  // Test 2: produces modifyCounter effect for twist count
  // -------------------------------------------------------------------------
  it('produces modifyCounter effect for schemeTwistCount', () => {
    const gameState = makeTestState();
    const effects = schemeTwistHandler(gameState, {}, { cardId: 'test-twist' }, DEFAULT_IMPLEMENTATION_MAP);

    const counterEffect = effects.find(
      (effect) =>
        effect.type === 'modifyCounter' &&
        'counter' in effect &&
        (effect as { counter: string }).counter === 'schemeTwistCount',
    );

    assert.ok(counterEffect, 'must contain modifyCounter for schemeTwistCount');
    assert.equal(
      (counterEffect as { delta: number }).delta,
      1,
      'delta must be 1',
    );
  });

  // -------------------------------------------------------------------------
  // Test 3: at threshold, produces modifyCounter on SCHEME_LOSS
  // -------------------------------------------------------------------------
  it('at threshold: produces modifyCounter on ENDGAME_CONDITIONS.SCHEME_LOSS', () => {
    // why: threshold is 7; set counter to 6 so handler predicts 7 (>= threshold)
    const gameState = makeTestState({ schemeTwistCount: 6 });
    const effects = schemeTwistHandler(gameState, {}, { cardId: 'test-twist' }, DEFAULT_IMPLEMENTATION_MAP);

    const schemeLossEffect = effects.find(
      (effect) =>
        effect.type === 'modifyCounter' &&
        'counter' in effect &&
        (effect as { counter: string }).counter === ENDGAME_CONDITIONS.SCHEME_LOSS,
    );

    assert.ok(
      schemeLossEffect,
      'must contain modifyCounter for ENDGAME_CONDITIONS.SCHEME_LOSS at threshold',
    );
    assert.equal(
      (schemeLossEffect as { delta: number }).delta,
      1,
      'scheme-loss delta must be 1',
    );
  });

  // -------------------------------------------------------------------------
  // Test 4: handler does not mutate G (except messages)
  // -------------------------------------------------------------------------
  it('does not mutate G besides messages', () => {
    const gameState = makeTestState({ schemeTwistCount: 3 });
    const snapshot = JSON.parse(JSON.stringify(gameState));

    schemeTwistHandler(gameState, {}, { cardId: 'test-twist' }, DEFAULT_IMPLEMENTATION_MAP);

    // why: the config-driven dispatcher (WP-182) pushes a diagnostic message
    // for unconfigured schemes. Exclude messages from the no-mutation check.
    const gameStateWithoutMessages = { ...gameState, messages: [] };
    const snapshotWithoutMessages = { ...snapshot, messages: [] };
    assert.deepStrictEqual(
      gameStateWithoutMessages,
      snapshotWithoutMessages,
      'G must not be mutated by handler (except messages)',
    );
  });

  // -------------------------------------------------------------------------
  // Test 5: uses ENDGAME_CONDITIONS.SCHEME_LOSS constant (not string literal)
  // -------------------------------------------------------------------------
  it('uses ENDGAME_CONDITIONS.SCHEME_LOSS constant for scheme-loss counter', () => {
    const gameState = makeTestState({ schemeTwistCount: 6 });
    const effects = schemeTwistHandler(gameState, {}, { cardId: 'test-twist' }, DEFAULT_IMPLEMENTATION_MAP);

    const schemeLossEffect = effects.find(
      (effect) =>
        effect.type === 'modifyCounter' &&
        'counter' in effect &&
        (effect as { counter: string }).counter === ENDGAME_CONDITIONS.SCHEME_LOSS,
    );

    assert.ok(schemeLossEffect, 'scheme-loss effect must exist at threshold');
    // why: this verifies the constant is used — the counter value must match
    // the constant, not a hardcoded string
    assert.equal(
      (schemeLossEffect as { counter: string }).counter,
      ENDGAME_CONDITIONS.SCHEME_LOSS,
      'counter must use ENDGAME_CONDITIONS.SCHEME_LOSS constant',
    );
  });

  // -------------------------------------------------------------------------
  // Test 6: JSON.stringify(effects) succeeds (serialization proof)
  // -------------------------------------------------------------------------
  it('effects are JSON-serializable', () => {
    const gameState = makeTestState({ schemeTwistCount: 6 });
    const effects = schemeTwistHandler(gameState, {}, { cardId: 'test-twist' }, DEFAULT_IMPLEMENTATION_MAP);

    const serialized = JSON.stringify(effects);
    assert.ok(serialized, 'JSON.stringify(effects) must produce a non-empty string');
  });
});

// ---------------------------------------------------------------------------
// Midtown Bank Robbery dispatcher tests
// ---------------------------------------------------------------------------

describe('schemeTwistHandler — Midtown Bank Robbery', () => {
  /**
   * Builds a Midtown-shaped state with a configurable Bank occupant,
   * bystander supply size, and chained-reveal deck contents.
   */
  function makeMidtownState(options: {
    bankVillain?: string;
    bystanderCount?: number;
    nextCardId?: string;
    nextCardType?: 'villain' | 'bystander';
  }): LegendaryGameState {
    const gameState = makeTestState();
    gameState.selection = {
      ...gameState.selection,
      schemeId: 'core/midtown-bank-robbery',
    };
    gameState.hookRegistry = midtownHookRegistry();

    if (options.bankVillain) {
      gameState.city[BANK_INDEX] = options.bankVillain;
      gameState.attachedBystanders[options.bankVillain] = [];
    }

    const bystanderCount = options.bystanderCount ?? 0;
    const bystanders: string[] = [];
    for (let i = 0; i < bystanderCount; i++) {
      bystanders.push(`bystander-${i + 1}`);
    }
    gameState.piles.bystanders = bystanders;

    if (options.nextCardId && options.nextCardType) {
      gameState.villainDeck.deck = [options.nextCardId];
      gameState.villainDeckCardTypes = {
        [options.nextCardId]: options.nextCardType,
      };
    }

    return gameState;
  }

  it('captures 2 bystanders onto the villain in the Bank when supply is full', () => {
    const gameState = makeMidtownState({
      bankVillain: 'core/magneto-001',
      bystanderCount: 5,
      nextCardId: 'villain-next',
      nextCardType: 'villain',
    });

    schemeTwistHandler(
      gameState,
      makeRevealContext(),
      { cardId: 'twist-card' },
      DEFAULT_IMPLEMENTATION_MAP,
    );

    assert.equal(
      gameState.attachedBystanders['core/magneto-001']!.length,
      2,
      'Bank villain must have exactly 2 bystanders attached',
    );
    // why: Midtown takes 2 from the supply; the chained villain reveal attaches
    // NOTHING on City entry (WP-432 removed the D-1701 entry-attach). 5 - 2 = 3.
    assert.equal(
      gameState.piles.bystanders.length,
      3,
      'Bystander supply: -2 from Midtown only (no City-entry attach post-WP-432)',
    );
  });

  it('captures only as many bystanders as the supply has (partial)', () => {
    const gameState = makeMidtownState({
      bankVillain: 'core/magneto-001',
      bystanderCount: 1,
      nextCardId: 'villain-next',
      nextCardType: 'villain',
    });

    schemeTwistHandler(
      gameState,
      makeRevealContext(),
      { cardId: 'twist-card' },
      DEFAULT_IMPLEMENTATION_MAP,
    );

    assert.equal(
      gameState.attachedBystanders['core/magneto-001']!.length,
      1,
      'Bank villain captures all remaining bystanders when supply < 2',
    );
    // why: Midtown captures the 1 remaining bystander onto the Bank villain;
    // the chained reveal attaches nothing on City entry (WP-432). 1 - 1 = 0.
    assert.equal(
      gameState.piles.bystanders.length,
      0,
      'Bystander supply is empty after Midtown captures the last one',
    );
  });

  it('logs a no-capture message when the Bank is empty', () => {
    const gameState = makeMidtownState({
      bystanderCount: 5,
      nextCardId: 'villain-next',
      nextCardType: 'villain',
    });

    schemeTwistHandler(
      gameState,
      makeRevealContext(),
      { cardId: 'twist-card' },
      DEFAULT_IMPLEMENTATION_MAP,
    );

    const emptyBankMessage = gameState.messages.find((message) =>
      message.text.includes('Bank is empty'),
    );
    assert.ok(
      emptyBankMessage,
      'must log a "Bank is empty" message when no villain occupies the Bank',
    );
    // why: when the Bank is empty, no capture occurs from the Midtown effect,
    // and the chained reveal attaches nothing on City entry (WP-432). Supply is
    // untouched (5 remain).
    assert.equal(
      gameState.piles.bystanders.length,
      5,
      'Neither Midtown (empty Bank) nor the chained City entry consumed a bystander',
    );
  });

  it('chains a villain-deck reveal (next card lands in the City)', () => {
    const gameState = makeMidtownState({
      bankVillain: 'core/magneto-001',
      bystanderCount: 5,
      nextCardId: 'villain-chained',
      nextCardType: 'villain',
    });

    schemeTwistHandler(
      gameState,
      makeRevealContext(),
      { cardId: 'twist-card' },
      DEFAULT_IMPLEMENTATION_MAP,
    );

    assert.equal(
      gameState.city[0],
      'villain-chained',
      'Chained reveal must push the next card into city[0]',
    );
    assert.equal(
      gameState.villainDeck.deck.length,
      0,
      'Villain deck must be empty after the chained reveal pops its only card',
    );
  });

  it('returns the generic counter-increment effects even on the Midtown path', () => {
    const gameState = makeMidtownState({
      bankVillain: 'core/magneto-001',
      bystanderCount: 5,
      nextCardId: 'villain-next',
      nextCardType: 'villain',
    });

    const effects = schemeTwistHandler(
      gameState,
      makeRevealContext(),
      { cardId: 'twist-card' },
      DEFAULT_IMPLEMENTATION_MAP,
    );

    const counterEffect = effects.find(
      (effect) =>
        effect.type === 'modifyCounter' &&
        'counter' in effect &&
        (effect as { counter: string }).counter === 'schemeTwistCount',
    );
    assert.ok(
      counterEffect,
      'Midtown dispatch must still return the generic schemeTwistCount effect',
    );
  });

  it('handles empty Bank + empty bystander supply without throwing', () => {
    const gameState = makeMidtownState({
      bystanderCount: 0,
      nextCardId: 'villain-next',
      nextCardType: 'villain',
    });

    assert.doesNotThrow(() => {
      schemeTwistHandler(
        gameState,
        makeRevealContext(),
        { cardId: 'twist-card' },
        DEFAULT_IMPLEMENTATION_MAP,
      );
    });
  });

  it('suppresses the twist-count proxy at its stack size (real loss is escaped-pile count, D-24315)', () => {
    // why: Midtown declares a resourceLossCondition (escaped-pile bystander
    // count), so the twist-count doom-clock proxy is suppressed — even at
    // predicted twist 8 (its printed stack size) the handler must NOT push
    // SCHEME_LOSS. The real loss is evaluated from the escape path instead.
    const gameState = makeMidtownState({
      bankVillain: 'core/magneto-001',
      bystanderCount: 2,
      nextCardId: 'villain-next',
      nextCardType: 'villain',
    });
    gameState.counters.schemeTwistCount = 7; // predicted 8 = printed stack size

    const effects = schemeTwistHandler(
      gameState,
      makeRevealContext(),
      { cardId: 'twist-card' },
      DEFAULT_IMPLEMENTATION_MAP,
    );

    assert.equal(
      triggersSchemeLoss(effects),
      false,
      'Midtown must not trip the twist-count proxy — its loss is the escaped-pile count',
    );
    // proxy suppression is loss-only: the twist count still increments.
    const counterEffect = effects.find(
      (effect) => (effect as { counter?: string }).counter === 'schemeTwistCount',
    );
    assert.ok(counterEffect, 'twist count still increments under proxy suppression');
  });
});

// ---------------------------------------------------------------------------
// Scheme loss threshold (D-24178) — per-scheme + per-player-count twist stacks
// ---------------------------------------------------------------------------

/** Whether the handler's effects include the scheme-loss counter bump. */
function triggersSchemeLoss(effects: ReturnType<typeof schemeTwistHandler>): boolean {
  return effects.some(
    (effect) => (effect as { counter?: string }).counter === ENDGAME_CONDITIONS.SCHEME_LOSS,
  );
}

describe('scheme loss threshold (D-24178)', () => {
  it('Cosmic Cube loses at twist 8, not the fallback 7 (the reported bug)', () => {
    // schemeTwistCount 6 → predicted 7 → no loss (7 < 8).
    const beforeLoss = makeTestState({ schemeTwistCount: 6 });
    beforeLoss.selection.schemeId = 'core/unleash-the-power-of-the-cosmic-cube';
    assert.equal(
      triggersSchemeLoss(schemeTwistHandler(beforeLoss, {}, { cardId: 't' }, DEFAULT_IMPLEMENTATION_MAP)),
      false,
      'must NOT lose at predicted twist 7 (was the early-loss bug)',
    );

    // schemeTwistCount 7 → predicted 8 → loss.
    const atLoss = makeTestState({ schemeTwistCount: 7 });
    atLoss.selection.schemeId = 'core/unleash-the-power-of-the-cosmic-cube';
    assert.equal(
      triggersSchemeLoss(schemeTwistHandler(atLoss, {}, { cardId: 't' }, DEFAULT_IMPLEMENTATION_MAP)),
      true,
      'must lose at predicted twist 8 (printed "Twist 8: Evil Wins!")',
    );
  });

  it('Super Hero Civil War suppresses the twist-count proxy at every player count (real loss is hero-deck depletion, D-24318)', () => {
    // why: WP-510 — Civil War declares a resourceLossCondition
    // (pile-depleted / heroDeck), so the twist-count doom-clock proxy is
    // suppressed for it (the kind-agnostic suppressTwistLoss gate). Even at its
    // printed stack size — predicted twist 8 at 2-3p, twist 5 at 4-5p — the
    // handler must NOT push SCHEME_LOSS; the real loss is evaluated per-move from
    // the hero-deck depletion check. The twist still increments the count.
    const makeCivilWar = (twistCount: number, players: number) => {
      const state = makeTestState({ schemeTwistCount: twistCount });
      state.selection.schemeId = 'core/super-hero-civil-war';
      state.lobby.requiredPlayers = players;
      return schemeTwistHandler(state, {}, { cardId: 't' }, DEFAULT_IMPLEMENTATION_MAP);
    };

    // 2-3 players (printed stack 8): predicted 8 must NOT trip the proxy.
    assert.equal(triggersSchemeLoss(makeCivilWar(7, 2)), false, '2p must not trip the proxy at predicted twist 8');
    assert.equal(triggersSchemeLoss(makeCivilWar(7, 3)), false, '3p must not trip the proxy at predicted twist 8');
    // 4-5 players (printed stack 5): predicted 5 must NOT trip the proxy.
    assert.equal(triggersSchemeLoss(makeCivilWar(4, 4)), false, '4p must not trip the proxy at predicted twist 5');
    assert.equal(triggersSchemeLoss(makeCivilWar(4, 5)), false, '5p must not trip the proxy at predicted twist 5');

    // proxy suppression is loss-only: the twist count still increments.
    const effects = makeCivilWar(7, 2);
    const counterEffect = effects.find(
      (effect) => (effect as { counter?: string }).counter === 'schemeTwistCount',
    );
    assert.ok(counterEffect, 'twist count still increments under proxy suppression');
  });

  it('Negative Zone suppresses the twist-count proxy at its stack size (real loss is escaped-villain count, D-24316)', () => {
    // why: WP-509 — Negative Zone declares a resourceLossCondition
    // (escaped-pile-count / villain / 12), so the twist-count doom-clock proxy
    // is suppressed. Even at predicted twist 8 (its printed stack size) the
    // handler must NOT push SCHEME_LOSS; the real loss is evaluated in the escape
    // path from the escaped-villain count.
    const atStack = makeTestState({ schemeTwistCount: 7 }); // predicted 8
    atStack.selection.schemeId = 'core/negative-zone-prison-breakout';
    assert.equal(
      triggersSchemeLoss(schemeTwistHandler(atStack, {}, { cardId: 't' }, DEFAULT_IMPLEMENTATION_MAP)),
      false,
      'Negative Zone must not trip the twist-count proxy — its loss is the escaped-villain count',
    );
  });

  it('an unconfigured scheme still falls back to the MVP default threshold (7)', () => {
    const state = makeTestState({ schemeTwistCount: 6 });
    // 'test-scheme' has no config → fallback 7 → predicted 7 → loss.
    assert.equal(
      triggersSchemeLoss(schemeTwistHandler(state, {}, { cardId: 't' }, DEFAULT_IMPLEMENTATION_MAP)),
      true,
      'unconfigured scheme uses the fallback threshold of 7',
    );
  });
});
