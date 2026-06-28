/**
 * Tests for the Size-Changing effective-class helper (WP-290 / D-24074).
 *
 * Verifies getGrantedClasses (the granted list, empty when none) and
 * cardHasClassWhenPlayed (printed OR granted membership, presence not count). The helper
 * reads only G.cardTraits + G.cardSizeChangingClasses and is pure — these tests confirm
 * both reads and the effective-class union without constructing a full game state.
 *
 * No boardgame.io imports. No registry imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getGrantedClasses, cardHasClassWhenPlayed } from './sizeChanging.logic.js';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';

// ---------------------------------------------------------------------------
// Test helper — a minimal G carrying only the two fields the helper reads
// ---------------------------------------------------------------------------

/**
 * Builds a minimal LegendaryGameState carrying only the fields the helper reads.
 *
 * The helper is a pure function of exactly cardTraits + cardSizeChangingClasses, so the
 * other state fields are irrelevant; the cast keeps the test focused on the two inputs.
 *
 * @param cardTraits - Per-card printed traits (heroClass / team).
 * @param cardSizeChangingClasses - Per-card granted-class lists (omit for "no grant").
 * @returns A game state usable by the helper.
 */
function makeHelperState(
  cardTraits: Record<string, { heroClass: string | null; team: string | null }>,
  cardSizeChangingClasses?: Record<string, string[]>,
): LegendaryGameState {
  const partial: Pick<LegendaryGameState, 'cardTraits' | 'cardSizeChangingClasses'> = {
    cardTraits,
  };
  if (cardSizeChangingClasses !== undefined) {
    partial.cardSizeChangingClasses = cardSizeChangingClasses;
  }
  return partial as LegendaryGameState;
}

describe('getGrantedClasses (WP-290 / D-24074)', () => {
  it('returns an empty list when the cardSizeChangingClasses table is absent', () => {
    const gameState = makeHelperState({ 'hero-a': { heroClass: 'tech', team: null } });
    assert.deepStrictEqual(
      [...getGrantedClasses(gameState, 'hero-a' as CardExtId)],
      [],
      'no table means no grant',
    );
  });

  it('returns an empty list when the card has no entry in the table', () => {
    const gameState = makeHelperState(
      { 'hero-a': { heroClass: 'tech', team: null } },
      { 'other-hero': ['instinct'] },
    );
    assert.deepStrictEqual(
      [...getGrantedClasses(gameState, 'hero-a' as CardExtId)],
      [],
      'a card absent from the table grants nothing',
    );
  });

  it('returns the normalized granted-class list when present', () => {
    const gameState = makeHelperState(
      { 'giant-ego': { heroClass: 'strength', team: null } },
      { 'giant-ego': ['tech'] },
    );
    assert.deepStrictEqual(
      [...getGrantedClasses(gameState, 'giant-ego' as CardExtId)],
      ['tech'],
      'returns the card\'s granted classes',
    );
  });
});

describe('cardHasClassWhenPlayed (WP-290 / D-24074)', () => {
  it('returns true for the printed class', () => {
    const gameState = makeHelperState({ 'hero-a': { heroClass: 'covert', team: null } });
    assert.equal(
      cardHasClassWhenPlayed(gameState, 'hero-a' as CardExtId, 'covert'),
      true,
      'a card has its printed class',
    );
  });

  it('returns true for a granted class (null printed class)', () => {
    const gameState = makeHelperState(
      { 'yellowjacket': { heroClass: null, team: null } },
      { 'yellowjacket': ['instinct'] },
    );
    assert.equal(
      cardHasClassWhenPlayed(gameState, 'yellowjacket' as CardExtId, 'instinct'),
      true,
      'a null-printed-class card has its granted class',
    );
  });

  it('returns true for BOTH the printed and the granted class when they differ (dual-class)', () => {
    const gameState = makeHelperState(
      { 'giant-ego': { heroClass: 'strength', team: null } },
      { 'giant-ego': ['tech'] },
    );
    assert.equal(
      cardHasClassWhenPlayed(gameState, 'giant-ego' as CardExtId, 'strength'),
      true,
      'dual-class card has its printed class (strength)',
    );
    assert.equal(
      cardHasClassWhenPlayed(gameState, 'giant-ego' as CardExtId, 'tech'),
      true,
      'dual-class card has its granted class (tech)',
    );
  });

  it('returns false for a class that is neither printed nor granted', () => {
    const gameState = makeHelperState(
      { 'giant-ego': { heroClass: 'strength', team: null } },
      { 'giant-ego': ['tech'] },
    );
    assert.equal(
      cardHasClassWhenPlayed(gameState, 'giant-ego' as CardExtId, 'covert'),
      false,
      'covert is neither printed (strength) nor granted (tech)',
    );
  });

  it('returns false when the card has neither a trait entry nor a grant', () => {
    const gameState = makeHelperState({});
    assert.equal(
      cardHasClassWhenPlayed(gameState, 'unknown' as CardExtId, 'tech'),
      false,
      'an unknown card has no class',
    );
  });
});
