/**
 * Mastermind setup tests for WP-019.
 *
 * Tests buildMastermindState with a mock registry.
 * Uses node:test and node:assert only. Uses makeMockCtx. No boardgame.io
 * imports.
 *
 * @amended WP-113 PS-7: bare slug fixture `'test-mastermind'` migrated
 *   to set-qualified form `'core/test-mastermind'` per the qualified-ID
 *   contract (per D-10014).
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
      'core/test-mastermind' as CardExtId,
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
      'core/test-mastermind' as CardExtId,
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
      'core/test-mastermind' as CardExtId,
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
      'core/test-mastermind' as CardExtId,
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
      'core/test-mastermind' as CardExtId,
      registry,
      context,
      cardStats,
    );

    const serialized = JSON.stringify(state);
    assert.ok(serialized.length > 0, 'State must be JSON-serializable');
  });
});

// ---------------------------------------------------------------------------
// WP-389 / D-24193 — base card is the FIRST non-tactic face
// ---------------------------------------------------------------------------

/**
 * Creates a mock registry whose mastermind ships TWO non-tactic faces — a
 * base face followed by an Epic face — with tactic cards interleaved after
 * both, mirroring how the affected sets are authored.
 *
 * The interleaving is deliberate: it proves the fix collects tactics that
 * appear after the alternate face, which a `break` would have dropped.
 */
function createTwoNonTacticFaceRegistry() {
  const setData = {
    abbr: 'core',
    masterminds: [
      {
        slug: 'two-face-mastermind',
        cards: [
          { slug: 'base-card', tactic: false, vAttack: '10+' },
          { slug: 'epic-base-card', tactic: false, vAttack: '12+' },
          { slug: 'tactic-alpha', tactic: true, vAttack: null },
          { slug: 'tactic-beta', tactic: true, vAttack: null },
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

/**
 * Creates a mock registry whose mastermind ships ONLY tactic cards, so no
 * base card can be resolved.
 */
function createZeroNonTacticFaceRegistry() {
  const setData = {
    abbr: 'core',
    masterminds: [
      {
        slug: 'tactics-only-mastermind',
        cards: [
          { slug: 'tactic-alpha', tactic: true, vAttack: null },
          { slug: 'tactic-beta', tactic: true, vAttack: null },
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

describe('buildMastermindState — base-face selection (WP-389 / D-24193)', () => {
  it('selects the FIRST non-tactic face, not the Epic face', () => {
    const registry = createTwoNonTacticFaceRegistry();
    const context = makeMockCtx({ numPlayers: 2 });
    const cardStats: Record<CardExtId, CardStatEntry> = {};

    const state = buildMastermindState(
      'core/two-face-mastermind' as CardExtId,
      registry,
      context,
      cardStats,
    );

    assert.strictEqual(
      state.baseCardId,
      'core-mastermind-two-face-mastermind-base-card',
      'baseCardId must resolve to the FIRST non-tactic face',
    );
    // why: the negative assertion is what makes this guard non-vacuous —
    // pre-WP-389 the loop selected the LAST non-tactic face, so without this
    // line the test would still pass with the fix reverted.
    assert.notStrictEqual(
      state.baseCardId,
      'core-mastermind-two-face-mastermind-epic-base-card',
      'baseCardId must never resolve to the Epic face (D-24193)',
    );
  });

  it('collects every tactic card when a second non-tactic face is present', () => {
    const registry = createTwoNonTacticFaceRegistry();
    const context = makeMockCtx({ numPlayers: 2 });
    const cardStats: Record<CardExtId, CardStatEntry> = {};

    const state = buildMastermindState(
      'core/two-face-mastermind' as CardExtId,
      registry,
      context,
      cardStats,
    );

    // why: guards against a `break`-style fix, which would exit the loop at
    // the base face and drop the tactic cards that follow it.
    assert.strictEqual(
      state.tacticsDeck.length,
      2,
      'tacticsDeck must contain both tactic cards despite the second non-tactic face',
    );
    // why: the Epic face is not a tactic and must not leak into the deck.
    assert.ok(
      !state.tacticsDeck.some((cardId) => cardId.includes('epic-base-card')),
      'the Epic face must never appear in tacticsDeck',
    );
  });

  it('is unchanged for a mastermind with exactly one non-tactic face', () => {
    const registry = createMockRegistry();
    const context = makeMockCtx({ numPlayers: 2 });
    const cardStats: Record<CardExtId, CardStatEntry> = {};

    const state = buildMastermindState(
      'core/test-mastermind' as CardExtId,
      registry,
      context,
      cardStats,
    );

    assert.strictEqual(
      state.baseCardId,
      'core-mastermind-test-mastermind-base-card',
      'single-non-tactic-face resolution must be byte-identical to pre-WP-389',
    );
    assert.strictEqual(
      state.tacticsDeck.length,
      3,
      'single-face masterminds keep all three tactics',
    );
  });

  // why: WP-389 AC-4 pinned the OLD behaviour here — zero non-tactic faces
  // degraded to the fallback state. WP-390 / D-24206 inverts that: setup now
  // throws instead of shipping an inert mastermind. The packet flagged this
  // AC as the reason WP-390 had to land second.
  it('THROWS when the mastermind has no base face (WP-390 / D-24206)', () => {
    const registry = createZeroNonTacticFaceRegistry();
    const context = makeMockCtx({ numPlayers: 2 });
    const cardStats: Record<CardExtId, CardStatEntry> = {};

    assert.throws(
      () =>
        buildMastermindState(
          'core/tactics-only-mastermind' as CardExtId,
          registry,
          context,
          cardStats,
        ),
      (error: unknown) => {
        assert.ok(error instanceof Error, 'must throw an Error');
        // why: assert on the diagnostic content, not just that something threw
        // — the whole point is that an operator can tell WHY the match was
        // rejected without reading engine source.
        assert.match(error.message, /has no base face/);
        assert.match(error.message, /council-style mastermind/);
        assert.match(error.message, /WP-390/);
        return true;
      },
      'a mastermind whose cards are ALL tactics must fail setup loudly',
    );
  });

  it('still degrades (does NOT throw) when the mastermind is simply absent', () => {
    const registry = createZeroNonTacticFaceRegistry();
    const context = makeMockCtx({ numPlayers: 2 });
    const cardStats: Record<CardExtId, CardStatEntry> = {};

    // why: the guard distinguishes "found, but every card is a tactic" from
    // "no such mastermind". Only the first is the council defect. Without
    // this test, tightening the guard to throw on any null resolve would look
    // correct and would break every narrow test mock in the repo.
    const state = buildMastermindState(
      'core/no-such-mastermind' as CardExtId,
      registry,
      context,
      cardStats,
    );

    assert.strictEqual(
      state.baseCardId,
      'core/no-such-mastermind',
      'an absent mastermind still falls back to baseCardId = mastermindId',
    );
    assert.strictEqual(state.tacticsDeck.length, 0);
  });
});
