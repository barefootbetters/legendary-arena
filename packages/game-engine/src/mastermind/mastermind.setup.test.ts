/**
 * Mastermind setup tests for WP-019.
 *
 * Tests buildMastermindState with a mock registry.
 * Uses node:test and node:assert only. Uses makeMockCtx. No boardgame.io
 * imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildMastermindState } from './mastermind.setup.js';
import { makeMockCtx } from '../test/mockCtx.js';
import type { CardStatEntry } from '../economy/economy.types.js';
import type { CardExtId } from '../state/zones.types.js';

// ---------------------------------------------------------------------------
// Mock registry
// ---------------------------------------------------------------------------

/**
 * Creates a minimal mock registry with one set containing a mastermind
 * with 1 base card and 3 tactic cards.
 */
function createMockRegistry() {
  const setData = {
    abbr: 'core',
    masterminds: [
      {
        slug: 'test-mastermind',
        cards: [
          { slug: 'base-card', tactic: false, vAttack: '8+' },
          { slug: 'tactic-alpha', tactic: true, vAttack: null },
          { slug: 'tactic-beta', tactic: true, vAttack: null },
          { slug: 'tactic-gamma', tactic: true, vAttack: null },
        ],
      },
    ],
  };

  return {
    listCards: () => [],
    listSets: () => [{ abbr: 'core' }],
    getSet: (abbr: string) => (abbr === 'core' ? setData : undefined),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildMastermindState', () => {
  it('produces a non-empty tacticsDeck', () => {
    const registry = createMockRegistry();
    const context = makeMockCtx({ numPlayers: 2 });
    const cardStats: Record<CardExtId, CardStatEntry> = {};

    const state = buildMastermindState(
      'test-mastermind' as CardExtId,
      registry,
      context,
      cardStats,
    );

    assert.ok(
      state.tacticsDeck.length > 0,
      'tacticsDeck must have cards after setup',
    );
    assert.strictEqual(
      state.tacticsDeck.length,
      3,
      'tacticsDeck must contain exactly 3 tactic cards',
    );
  });

  it('baseCardId corresponds to a card with tactic === false', () => {
    const registry = createMockRegistry();
    const context = makeMockCtx({ numPlayers: 2 });
    const cardStats: Record<CardExtId, CardStatEntry> = {};

    const state = buildMastermindState(
      'test-mastermind' as CardExtId,
      registry,
      context,
      cardStats,
    );

    assert.strictEqual(
      state.baseCardId,
      'core-mastermind-test-mastermind-base-card',
      'baseCardId must use the {setAbbr}-mastermind-{slug}-{cardSlug} format',
    );
    assert.ok(
      !state.tacticsDeck.includes(state.baseCardId),
      'baseCardId must not appear in tacticsDeck',
    );
  });

  it('all cards in tacticsDeck are tactic cards (not the base card)', () => {
    const registry = createMockRegistry();
    const context = makeMockCtx({ numPlayers: 2 });
    const cardStats: Record<CardExtId, CardStatEntry> = {};

    const state = buildMastermindState(
      'test-mastermind' as CardExtId,
      registry,
      context,
      cardStats,
    );

    for (const tacticId of state.tacticsDeck) {
      assert.notStrictEqual(
        tacticId,
        state.baseCardId,
        `tacticsDeck must not contain the base card: ${tacticId}`,
      );
      assert.ok(
        tacticId.includes('tactic-'),
        `tactic ext_id must contain 'tactic-': ${tacticId}`,
      );
    }
  });

  it('tacticsDeck is shuffled (makeMockCtx reverses)', () => {
    const registry = createMockRegistry();
    const context = makeMockCtx({ numPlayers: 2 });
    const cardStats: Record<CardExtId, CardStatEntry> = {};

    const state = buildMastermindState(
      'test-mastermind' as CardExtId,
      registry,
      context,
      cardStats,
    );

    // Sorted order would be: alpha, beta, gamma (lexical)
    // makeMockCtx reverses, so shuffled should be: gamma, beta, alpha
    const sorted = [...state.tacticsDeck].sort();
    assert.notDeepStrictEqual(
      state.tacticsDeck,
      sorted,
      'tacticsDeck must be shuffled (not in sorted order)',
    );
  });

  it('JSON.stringify(mastermindState) succeeds', () => {
    const registry = createMockRegistry();
    const context = makeMockCtx({ numPlayers: 2 });
    const cardStats: Record<CardExtId, CardStatEntry> = {};

    const state = buildMastermindState(
      'test-mastermind' as CardExtId,
      registry,
      context,
      cardStats,
    );

    const serialized = JSON.stringify(state);
    assert.ok(serialized.length > 0, 'State must be JSON-serializable');
  });
});
