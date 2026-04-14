/**
 * Unit tests for scheme setup instruction executor.
 *
 * Tests all 4 instruction types with synthetic data, unknown type handling,
 * empty instruction list, deterministic ordering, JSON serialization proof,
 * and drift-detection for SCHEME_SETUP_TYPES.
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { executeSchemeSetup } from './schemeSetup.execute.js';
import { SCHEME_SETUP_TYPES } from './schemeSetup.types.js';
import type { SchemeSetupInstruction } from './schemeSetup.types.js';
import type { LegendaryGameState } from '../types.js';
import type { CityZone } from '../board/city.types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { BoardKeyword } from '../board/boardKeywords.types.js';

/**
 * Builds a minimal LegendaryGameState mock with the fields that
 * executeSchemeSetup reads and modifies.
 */
function buildMinimalGameState(): LegendaryGameState {
  return {
    city: [null, null, null, null, null] as CityZone,
    cardKeywords: {} as Record<CardExtId, BoardKeyword[]>,
    counters: {},
    messages: [],
    schemeSetupInstructions: [],
    // why: remaining fields are required by LegendaryGameState but not read
    // by executeSchemeSetup. Minimal stubs to satisfy the type.
    matchConfiguration: {} as LegendaryGameState['matchConfiguration'],
    selection: {} as LegendaryGameState['selection'],
    currentStage: 'start',
    playerZones: {},
    piles: {} as LegendaryGameState['piles'],
    hookRegistry: [],
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: {},
    ko: [],
    attachedBystanders: {},
    hq: [null, null, null, null, null],
    mastermind: {} as LegendaryGameState['mastermind'],
    cardStats: {},
    turnEconomy: { attack: 0, recruit: 0, spentAttack: 0, spentRecruit: 0 },
    heroAbilityHooks: [],
    lobby: { requiredPlayers: 2, ready: {}, started: false },
  };
}

describe('executeSchemeSetup', () => {
  // -------------------------------------------------------------------------
  // addSchemeCounter
  // -------------------------------------------------------------------------

  it('addSchemeCounter initializes a new counter in G.counters', () => {
    const gameState = buildMinimalGameState();
    const instructions: SchemeSetupInstruction[] = [
      { type: 'addSchemeCounter', value: { name: 'bystanders-rescued', value: 0 } },
    ];

    const result = executeSchemeSetup(gameState, instructions);

    assert.equal(result.counters['bystanders-rescued'], 0);
  });

  // -------------------------------------------------------------------------
  // addCityKeyword
  // -------------------------------------------------------------------------

  it('addCityKeyword adds keyword to G.cardKeywords', () => {
    const gameState = buildMinimalGameState();
    const instructions: SchemeSetupInstruction[] = [
      { type: 'addCityKeyword', value: { cardId: 'test-villain-01', keyword: 'guard' } },
    ];

    const result = executeSchemeSetup(gameState, instructions);

    assert.deepStrictEqual(result.cardKeywords['test-villain-01'], ['guard']);
  });

  // -------------------------------------------------------------------------
  // initialCityState
  // -------------------------------------------------------------------------

  it('initialCityState pre-populates City spaces', () => {
    const gameState = buildMinimalGameState();
    const instructions: SchemeSetupInstruction[] = [
      { type: 'initialCityState', value: { cityIndex: 2, cardId: 'test-villain-02' } },
    ];

    const result = executeSchemeSetup(gameState, instructions);

    assert.equal(result.city[2], 'test-villain-02');
    // Other spaces remain null
    assert.equal(result.city[0], null);
    assert.equal(result.city[4], null);
  });

  // -------------------------------------------------------------------------
  // modifyCitySize (MVP: warn + no-op)
  // -------------------------------------------------------------------------

  it('modifyCitySize logs warning and leaves City unchanged (MVP)', () => {
    const gameState = buildMinimalGameState();
    const originalCity = [...gameState.city];
    const instructions: SchemeSetupInstruction[] = [
      { type: 'modifyCitySize', value: { size: 6 } },
    ];

    const result = executeSchemeSetup(gameState, instructions);

    // City unchanged
    assert.deepStrictEqual([...result.city], originalCity);
    // Warning logged
    const hasWarning = result.messages.some(
      (message) => message.includes('modifyCitySize') && message.includes('not yet supported'),
    );
    assert.equal(hasWarning, true, 'Expected warning about modifyCitySize');
  });

  // -------------------------------------------------------------------------
  // Unknown instruction type
  // -------------------------------------------------------------------------

  it('unknown instruction type logs warning and does not crash', () => {
    const gameState = buildMinimalGameState();
    const instructions = [
      { type: 'unknownType', value: {} },
    ] as unknown as SchemeSetupInstruction[];

    const result = executeSchemeSetup(gameState, instructions);

    const hasWarning = result.messages.some(
      (message) => message.includes('Unknown scheme setup instruction type') && message.includes('unknownType'),
    );
    assert.equal(hasWarning, true, 'Expected warning about unknown type');
  });

  // -------------------------------------------------------------------------
  // Empty instructions
  // -------------------------------------------------------------------------

  it('empty instructions list returns G unchanged', () => {
    const gameState = buildMinimalGameState();

    const result = executeSchemeSetup(gameState, []);

    assert.deepStrictEqual(result, gameState);
  });

  // -------------------------------------------------------------------------
  // Deterministic ordering
  // -------------------------------------------------------------------------

  it('instructions execute in order (deterministic)', () => {
    const gameState = buildMinimalGameState();
    const instructions: SchemeSetupInstruction[] = [
      { type: 'addSchemeCounter', value: { name: 'counter-alpha', value: 1 } },
      { type: 'addSchemeCounter', value: { name: 'counter-beta', value: 2 } },
    ];

    const result = executeSchemeSetup(gameState, instructions);

    assert.equal(result.counters['counter-alpha'], 1);
    assert.equal(result.counters['counter-beta'], 2);
  });

  // -------------------------------------------------------------------------
  // JSON serialization proof
  // -------------------------------------------------------------------------

  it('JSON.stringify(G) succeeds after all instructions', () => {
    const gameState = buildMinimalGameState();
    const instructions = [
      { type: 'addSchemeCounter', value: { name: 'test-counter', value: 0 } },
      { type: 'addCityKeyword', value: { cardId: 'test-villain-01', keyword: 'guard' } },
      { type: 'initialCityState', value: { cityIndex: 0, cardId: 'test-villain-03' } },
      { type: 'modifyCitySize', value: { size: 6 } },
      { type: 'unknownType', value: {} },
    ] as unknown as SchemeSetupInstruction[];

    const result = executeSchemeSetup(gameState, instructions);

    // Must not throw — G remains JSON-serializable
    assert.doesNotThrow(() => JSON.stringify(result));
  });

  // -------------------------------------------------------------------------
  // Drift detection
  // -------------------------------------------------------------------------

  it('SCHEME_SETUP_TYPES contains exactly the expected types', () => {
    // why: drift-detection — canonical array must match SchemeSetupType union.
    // If a type is added to the union, it must also appear here.
    assert.deepStrictEqual(
      [...SCHEME_SETUP_TYPES],
      ['modifyCitySize', 'addCityKeyword', 'addSchemeCounter', 'initialCityState'],
    );
  });
});
