/**
 * Shape tests for buildPlayerState.
 *
 * Validates that buildPlayerState returns a correctly shaped PlayerState
 * with all 5 zone keys and a shuffled deck.
 *
 * Uses makeMockCtx from src/test/mockCtx.ts — no boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlayerState } from './playerInit.js';
import { validatePlayerStateShape } from '../state/zones.validate.js';
import { makeMockCtx } from '../test/mockCtx.js';

describe('buildPlayerState — shape', () => {
  it('returns a PlayerState with all 5 zones present', () => {
    const context = makeMockCtx();
    const startingDeck = ['card-a', 'card-b', 'card-c'];

    const playerState = buildPlayerState('0', startingDeck, context);

    assert.equal(playerState.playerId, '0', 'playerId must match the input');
    assert.ok(Array.isArray(playerState.zones.deck), 'zones.deck must be an array');
    assert.ok(Array.isArray(playerState.zones.hand), 'zones.hand must be an array');
    assert.ok(Array.isArray(playerState.zones.discard), 'zones.discard must be an array');
    assert.ok(Array.isArray(playerState.zones.inPlay), 'zones.inPlay must be an array');
    assert.ok(Array.isArray(playerState.zones.victory), 'zones.victory must be an array');

    assert.deepStrictEqual(playerState.zones.hand, [], 'hand must be empty at setup');
    assert.deepStrictEqual(playerState.zones.discard, [], 'discard must be empty at setup');
    assert.deepStrictEqual(playerState.zones.inPlay, [], 'inPlay must be empty at setup');
    assert.deepStrictEqual(playerState.zones.victory, [], 'victory must be empty at setup');
  });

  it('zones.deck is the reversed input (proves shuffle ran)', () => {
    // why: makeMockCtx reverses arrays during shuffle. If the deck matches
    // the input order, shuffleDeck was not called.
    const context = makeMockCtx();
    const startingDeck = ['card-a', 'card-b', 'card-c', 'card-d'];

    const playerState = buildPlayerState('0', startingDeck, context);

    const expectedReversed = ['card-d', 'card-c', 'card-b', 'card-a'];
    assert.deepStrictEqual(
      playerState.zones.deck,
      expectedReversed,
      'Deck must be reversed by makeMockCtx shuffle — proves shuffleDeck was called.',
    );
  });

  it('each player gets independent zone arrays (no shared references)', () => {
    const context = makeMockCtx();
    const deck = ['card-a', 'card-b'];

    const player0 = buildPlayerState('0', deck, context);
    const player1 = buildPlayerState('1', deck, context);

    // why: If buildPlayerState reuses the same array instance for empty zones
    // across calls, mutating one player's zone would silently corrupt another
    // player's zone. This test pins the invariant that every call produces
    // independent arrays.
    player0.zones.hand.push('injected-card');

    assert.equal(
      player1.zones.hand.length,
      0,
      'Mutating player 0 hand must not affect player 1 hand — zones must be independent arrays.',
    );
  });

  it('does not mutate the input startingDeck array', () => {
    // why: shuffleDeck copies internally, but this test pins the contract at
    // the buildPlayerState boundary. If the internal copy is removed later,
    // this test catches the regression before callers are affected.
    const context = makeMockCtx();
    const startingDeck = ['card-a', 'card-b', 'card-c'];
    const snapshot = [...startingDeck];

    buildPlayerState('0', startingDeck, context);

    assert.deepStrictEqual(
      startingDeck,
      snapshot,
      'buildPlayerState must not mutate the input startingDeck array.',
    );
  });

  it('validatePlayerStateShape returns ok: false on a broken player object', () => {
    // why: Confirms the validator correctly rejects a malformed player state
    // missing a zone key. This tests the validator, not buildPlayerState.
    const brokenPlayer = {
      playerId: '0',
      zones: {
        deck: ['card-a'],
        hand: [],
        discard: [],
        // inPlay intentionally missing
        victory: [],
      },
    };

    const result = validatePlayerStateShape(brokenPlayer);

    assert.equal(
      result.ok,
      false,
      'Validator must reject a player state missing the inPlay zone.',
    );
  });
});
