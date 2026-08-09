/**
 * Tests for convertHeroesToSkrulls (WP-514 / D-24326).
 *
 * Covers the Secret Invasion cross-deck conversion (12 Heroes → Skrull Villains,
 * injected + re-shuffled into the Villain Deck) and the passthrough for every other
 * scheme — including the determinism-critical property that a non-Secret-Invasion
 * scheme makes NO ctx.random.Shuffle call (zero new random draws).
 *
 * Uses node:test only — no boardgame.io imports. The ShuffleProvider is a stub that
 * reverses (proves the shuffle ran) and counts its invocations.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { CardExtId } from '../state/zones.types.js';
import type { RevealedCardType, VillainDeckState } from '../villainDeck/villainDeck.types.js';
import type { ConvertedVillainOrigin } from '../types.js';
import { convertHeroesToSkrulls } from './convertHeroesToSkrulls.js';

const SECRET_INVASION = 'core/secret-invasion-of-the-skrull-shapeshifters';

/** A ShuffleProvider stub that reverses (proves it ran) and counts its calls. */
function makeCountingShuffle(): { provider: { random: { Shuffle: <T>(deck: T[]) => T[] } }; calls: () => number } {
  let callCount = 0;
  return {
    provider: {
      random: {
        Shuffle: <T>(deck: T[]): T[] => {
          callCount = callCount + 1;
          return [...deck].reverse();
        },
      },
    },
    calls: () => callCount,
  };
}

/** Builds `count` hero ext_ids h0..h(count-1). */
function makeHeroes(count: number): CardExtId[] {
  const heroes: CardExtId[] = [];
  for (let heroIndex = 0; heroIndex < count; heroIndex++) {
    heroes.push(`hero-${heroIndex}` as CardExtId);
  }
  return heroes;
}

function makeVillainDeck(): VillainDeckState {
  return { deck: ['villain-a', 'villain-b'] as CardExtId[], discard: [] };
}

const BASE_CARD_TYPES: Record<CardExtId, RevealedCardType> = {
  'villain-a': 'villain',
  'villain-b': 'villain',
};

describe('convertHeroesToSkrulls — Secret Invasion', () => {
  it('removes exactly 12 Heroes from the front of the reservoir', () => {
    const { provider } = makeCountingShuffle();
    const result = convertHeroesToSkrulls(
      SECRET_INVASION,
      makeHeroes(20),
      makeVillainDeck(),
      { ...BASE_CARD_TYPES },
      {},
      provider,
    );
    // 20 - 12 = 8 remain in the reservoir, and they are the trailing 8 (h12..h19).
    assert.equal(result.heroReservoir.length, 8);
    assert.deepStrictEqual(result.heroReservoir, makeHeroes(20).slice(12));
  });

  it('injects the 12 Heroes into the villain deck and re-shuffles (one draw)', () => {
    const { provider, calls } = makeCountingShuffle();
    const result = convertHeroesToSkrulls(
      SECRET_INVASION,
      makeHeroes(20),
      makeVillainDeck(),
      { ...BASE_CARD_TYPES },
      {},
      provider,
    );
    // 2 original villains + 12 injected Skrulls = 14 cards, reshuffled exactly once.
    assert.equal(result.villainDeckState.deck.length, 14);
    assert.equal(calls(), 1);
    // The stub reverses, so the injected order [v-a, v-b, h0..h11] comes back reversed.
    assert.equal(result.villainDeckState.deck[0], 'hero-11');
    assert.equal(result.villainDeckState.deck[13], 'villain-a');
  });

  it('types each converted Hero as a villain and marks its skrull origin', () => {
    const { provider } = makeCountingShuffle();
    const result = convertHeroesToSkrulls(
      SECRET_INVASION,
      makeHeroes(20),
      makeVillainDeck(),
      { ...BASE_CARD_TYPES },
      {},
      provider,
    );
    for (let heroIndex = 0; heroIndex < 12; heroIndex++) {
      const heroId = `hero-${heroIndex}` as CardExtId;
      assert.equal(result.villainDeckCardTypes[heroId], 'villain');
      assert.equal(result.convertedOrigins[heroId], 'skrull');
    }
    // A Hero beyond the first 12 is NOT converted.
    assert.equal(result.villainDeckCardTypes['hero-12' as CardExtId], undefined);
    assert.equal(result.convertedOrigins['hero-12' as CardExtId], undefined);
    // Original villains keep their type; no spurious origins.
    assert.equal(result.villainDeckCardTypes['villain-a' as CardExtId], 'villain');
    assert.equal(result.convertedOrigins['villain-a' as CardExtId], undefined);
  });

  it('converts however many exist when the reservoir has fewer than 12', () => {
    const { provider, calls } = makeCountingShuffle();
    const result = convertHeroesToSkrulls(
      SECRET_INVASION,
      makeHeroes(5),
      makeVillainDeck(),
      { ...BASE_CARD_TYPES },
      {},
      provider,
    );
    assert.equal(result.heroReservoir.length, 0);
    assert.equal(result.villainDeckState.deck.length, 2 + 5);
    assert.equal(Object.keys(result.convertedOrigins).length, 5);
    assert.equal(calls(), 1);
  });

  it('does not mutate the input maps', () => {
    const { provider } = makeCountingShuffle();
    const inputTypes = { ...BASE_CARD_TYPES };
    const inputOrigins: Record<CardExtId, ConvertedVillainOrigin> = {};
    convertHeroesToSkrulls(
      SECRET_INVASION,
      makeHeroes(20),
      makeVillainDeck(),
      inputTypes,
      inputOrigins,
      provider,
    );
    assert.deepStrictEqual(inputTypes, BASE_CARD_TYPES);
    assert.deepStrictEqual(inputOrigins, {});
  });
});

describe('convertHeroesToSkrulls — non-Secret-Invasion passthrough', () => {
  it('returns the inputs unchanged and makes NO shuffle call (zero new draws)', () => {
    const { provider, calls } = makeCountingShuffle();
    const reservoir = makeHeroes(20);
    const villainDeck = makeVillainDeck();
    const types = { ...BASE_CARD_TYPES };
    const origins: Record<CardExtId, ConvertedVillainOrigin> = { 'bystander-villain-deck-00': 'killbot' };
    const result = convertHeroesToSkrulls(
      'core/replace-earths-leaders-with-killbots',
      reservoir,
      villainDeck,
      types,
      origins,
      provider,
    );
    // Determinism-critical: a non-Secret-Invasion scheme adds NO random draw.
    assert.equal(calls(), 0);
    assert.equal(result.heroReservoir, reservoir);
    assert.equal(result.villainDeckState, villainDeck);
    assert.equal(result.villainDeckCardTypes, types);
    assert.equal(result.convertedOrigins, origins);
  });
});
