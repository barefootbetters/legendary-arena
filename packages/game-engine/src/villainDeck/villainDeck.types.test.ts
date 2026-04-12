/**
 * Type contract tests for the villain deck subsystem.
 *
 * Verifies drift-detection for REVEALED_CARD_TYPES and JSON-serializability
 * of VillainDeckState.
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { REVEALED_CARD_TYPES } from './villainDeck.types.js';
import type { VillainDeckState } from './villainDeck.types.js';

describe('REVEALED_CARD_TYPES drift-detection', () => {
  // why: failure means union/array mismatch -- silently breaks trigger emission.
  // If a type string is added to the RevealedCardType union but not the
  // canonical array (or vice versa), trigger dispatch will silently fail
  // for the missing type.
  it('contains exactly the 5 canonical card type values', () => {
    assert.deepStrictEqual(
      [...REVEALED_CARD_TYPES],
      ['villain', 'henchman', 'bystander', 'scheme-twist', 'mastermind-strike'],
      'REVEALED_CARD_TYPES must contain exactly these 5 values in canonical order',
    );
  });
});

describe('VillainDeckState serialization', () => {
  it('JSON.stringify succeeds for a sample VillainDeckState', () => {
    const sampleState: VillainDeckState = {
      deck: ['card-a', 'card-b', 'card-c'],
      discard: ['card-d'],
    };

    const serialized = JSON.stringify(sampleState);
    assert.ok(
      serialized,
      'JSON.stringify must produce a non-empty string for VillainDeckState',
    );

    const deserialized = JSON.parse(serialized) as VillainDeckState;
    assert.deepStrictEqual(
      deserialized,
      sampleState,
      'VillainDeckState must survive JSON round-trip',
    );
  });
});
