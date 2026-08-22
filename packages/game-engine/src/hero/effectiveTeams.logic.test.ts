/**
 * Tests for the effective-team helper (WP-582 / D-24391).
 *
 * Verifies getGrantedTeams (the granted list, empty when none) and cardHasTeamWhenPlayed
 * (printed OR granted membership, presence not count). The helper reads only
 * G.cardTraits + G.cardCopiedTeams and is pure — these tests confirm both reads and the
 * effective-team union without constructing a full game state. Mirrors
 * sizeChanging.logic.test.ts.
 *
 * No boardgame.io imports. No registry imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getGrantedTeams, cardHasTeamWhenPlayed } from './effectiveTeams.logic.js';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';

/**
 * Builds a minimal LegendaryGameState carrying only the fields the helper reads.
 *
 * The helper is a pure function of exactly cardTraits + cardCopiedTeams, so the other
 * state fields are irrelevant; the cast keeps the test focused on the two inputs.
 *
 * @param cardTraits - Per-card printed traits (heroClass / team).
 * @param cardCopiedTeams - Per-card Copy-Powers granted-team lists (omit for "no grant").
 * @returns A game state usable by the helper.
 */
function makeHelperState(
  cardTraits: Record<string, { heroClass: string | null; team: string | null }>,
  cardCopiedTeams?: Record<string, string[]>,
): LegendaryGameState {
  const partial: Pick<LegendaryGameState, 'cardTraits' | 'cardCopiedTeams'> = {
    cardTraits,
  };
  if (cardCopiedTeams !== undefined) {
    partial.cardCopiedTeams = cardCopiedTeams;
  }
  return partial as LegendaryGameState;
}

describe('getGrantedTeams (WP-582 / D-24391)', () => {
  it('returns an empty list when the cardCopiedTeams table is absent', () => {
    const gameState = makeHelperState({ 'hero-a': { heroClass: 'tech', team: 'avengers' } });
    assert.deepStrictEqual(
      [...getGrantedTeams(gameState, 'hero-a' as CardExtId)],
      [],
      'no table means no grant',
    );
  });

  it('returns an empty list when the card has no entry in the table', () => {
    const gameState = makeHelperState(
      { 'hero-a': { heroClass: 'tech', team: 'avengers' } },
      { 'other-hero': ['x-men'] },
    );
    assert.deepStrictEqual(
      [...getGrantedTeams(gameState, 'hero-a' as CardExtId)],
      [],
      'a card absent from the table grants nothing',
    );
  });

  it('returns the granted-team list when present', () => {
    const gameState = makeHelperState(
      { 'core/rogue/copy-powers': { heroClass: 'covert', team: null } },
      { 'core/rogue/copy-powers': ['x-men'] },
    );
    assert.deepStrictEqual(
      [...getGrantedTeams(gameState, 'core/rogue/copy-powers' as CardExtId)],
      ['x-men'],
      'returns the card\'s granted teams',
    );
  });
});

describe('cardHasTeamWhenPlayed (WP-582 / D-24391)', () => {
  it('returns true for the printed team', () => {
    const gameState = makeHelperState({ 'hero-a': { heroClass: 'covert', team: 'avengers' } });
    assert.equal(
      cardHasTeamWhenPlayed(gameState, 'hero-a' as CardExtId, 'avengers'),
      true,
      'a card has its printed team',
    );
  });

  it('returns true for a granted team (null printed team) — the Copy Powers case', () => {
    const gameState = makeHelperState(
      { 'core/rogue/copy-powers': { heroClass: 'covert', team: null } },
      { 'core/rogue/copy-powers': ['x-men'] },
    );
    assert.equal(
      cardHasTeamWhenPlayed(gameState, 'core/rogue/copy-powers' as CardExtId, 'x-men'),
      true,
      'a null-printed-team card has its Copy-Powers granted team',
    );
  });

  it('returns true for BOTH the printed and the granted team when they differ', () => {
    const gameState = makeHelperState(
      { 'multi': { heroClass: 'strength', team: 'avengers' } },
      { 'multi': ['x-men'] },
    );
    assert.equal(
      cardHasTeamWhenPlayed(gameState, 'multi' as CardExtId, 'avengers'),
      true,
      'has its printed team (avengers)',
    );
    assert.equal(
      cardHasTeamWhenPlayed(gameState, 'multi' as CardExtId, 'x-men'),
      true,
      'has its granted team (x-men)',
    );
  });

  it('returns false for a team that is neither printed nor granted', () => {
    const gameState = makeHelperState(
      { 'multi': { heroClass: 'strength', team: 'avengers' } },
      { 'multi': ['x-men'] },
    );
    assert.equal(
      cardHasTeamWhenPlayed(gameState, 'multi' as CardExtId, 'spider-friends'),
      false,
      'spider-friends is neither printed (avengers) nor granted (x-men)',
    );
  });

  it('returns false when the card has neither a trait entry nor a grant', () => {
    const gameState = makeHelperState({});
    assert.equal(
      cardHasTeamWhenPlayed(gameState, 'unknown' as CardExtId, 'x-men'),
      false,
      'an unknown card has no team',
    );
  });
});
