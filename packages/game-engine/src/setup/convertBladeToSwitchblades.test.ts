/**
 * Midnight Massacre Blade → Switchblade conversion (WP-764 / D-24596) — the pure setup helpers:
 * the deterministic Blade preference (selectBladeHero) and the Villain Deck conversion
 * (convertBladeToSwitchblades).
 *
 * node:test + node:assert only. No boardgame.io import, no registry.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MIDNIGHT_MASSACRE_SCHEME_ID,
  selectBladeHero,
  convertBladeToSwitchblades,
} from './convertBladeToSwitchblades.js';

const OTHER_SCHEME_ID = 'core/secret-invasion-of-the-skrull-shapeshifters';
const PREFERRED_BLADE = 'dkcy/blade';
const FALLBACK_BLADE = 'mdns/blade-daywalker';

describe('WP-764 selectBladeHero — deterministic Blade preference (D-24596)', () => {
  it('another scheme selects no Blade', () => {
    assert.deepEqual(selectBladeHero(OTHER_SCHEME_ID, [PREFERRED_BLADE, 'mdns/morbius']), {
      bothBladesSelected: false,
    });
  });

  it('neither Blade selected → the preferred Blade (Dark City)', () => {
    assert.deepEqual(selectBladeHero(MIDNIGHT_MASSACRE_SCHEME_ID, ['mdns/morbius', 'mdns/elsa-bloodstone']), {
      bladeHeroId: PREFERRED_BLADE,
      bothBladesSelected: false,
    });
  });

  it('the preferred Blade is a selected Hero → the fallback Blade (Daywalker)', () => {
    assert.deepEqual(selectBladeHero(MIDNIGHT_MASSACRE_SCHEME_ID, [PREFERRED_BLADE, 'mdns/morbius']), {
      bladeHeroId: FALLBACK_BLADE,
      bothBladesSelected: false,
    });
  });

  it('only the fallback Blade is selected → the preferred Blade is still used', () => {
    assert.deepEqual(selectBladeHero(MIDNIGHT_MASSACRE_SCHEME_ID, [FALLBACK_BLADE, 'mdns/morbius']), {
      bladeHeroId: PREFERRED_BLADE,
      bothBladesSelected: false,
    });
  });

  it('both Blades selected → the no-op flag, and no Blade to convert', () => {
    assert.deepEqual(selectBladeHero(MIDNIGHT_MASSACRE_SCHEME_ID, [PREFERRED_BLADE, FALLBACK_BLADE, 'mdns/morbius']), {
      bothBladesSelected: true,
    });
  });
});

describe('WP-764 convertBladeToSwitchblades — the Villain Deck conversion (D-24596)', () => {
  const freshInputs = () => ({
    deckState: { deck: ['v#0', 't#0'], discard: [] } as never,
    cardTypes: { 'v#0': 'villain', 't#0': 'scheme-twist' } as never,
    origins: {} as never,
  });

  it('injects the Blade ids as switchblade Villains and shuffles once', () => {
    const { deckState, cardTypes, origins } = freshInputs();
    let shuffleCount = 0;
    const context = { random: { Shuffle: <T,>(deck: T[]): T[] => { shuffleCount = shuffleCount + 1; return [...deck].reverse(); } } };
    const result = convertBladeToSwitchblades(
      MIDNIGHT_MASSACRE_SCHEME_ID,
      ['b#0', 'b#1'],
      deckState,
      cardTypes,
      origins,
      context,
    );
    // reverse of [v#0, t#0, b#0, b#1]
    assert.deepEqual(result.villainDeckState.deck, ['b#1', 'b#0', 't#0', 'v#0']);
    assert.equal(result.villainDeckCardTypes['b#0'], 'villain');
    assert.equal(result.villainDeckCardTypes['b#1'], 'villain');
    assert.equal(result.convertedOrigins['b#0'], 'switchblade');
    assert.equal(result.convertedOrigins['b#1'], 'switchblade');
    assert.equal(shuffleCount, 1);
  });

  it('never mutates its inputs', () => {
    const { deckState, cardTypes, origins } = freshInputs();
    const context = { random: { Shuffle: <T,>(deck: T[]): T[] => [...deck].reverse() } };
    convertBladeToSwitchblades(MIDNIGHT_MASSACRE_SCHEME_ID, ['b#0'], deckState, cardTypes, origins, context);
    assert.deepEqual(deckState, { deck: ['v#0', 't#0'], discard: [] });
    assert.deepEqual(cardTypes, { 'v#0': 'villain', 't#0': 'scheme-twist' });
    assert.deepEqual(origins, {});
  });

  it('another scheme passes through with no draw', () => {
    const { deckState, cardTypes, origins } = freshInputs();
    let shuffleCount = 0;
    const context = { random: { Shuffle: <T,>(deck: T[]): T[] => { shuffleCount = shuffleCount + 1; return [...deck]; } } };
    const result = convertBladeToSwitchblades(OTHER_SCHEME_ID, ['b#0'], deckState, cardTypes, origins, context);
    assert.equal(result.villainDeckState, deckState);
    assert.equal(result.villainDeckCardTypes, cardTypes);
    assert.equal(result.convertedOrigins, origins);
    assert.equal(shuffleCount, 0);
  });

  it('the Midnight Massacre scheme with an empty Blade list passes through with no draw (the both-selected no-op)', () => {
    const { deckState, cardTypes, origins } = freshInputs();
    let shuffleCount = 0;
    const context = { random: { Shuffle: <T,>(deck: T[]): T[] => { shuffleCount = shuffleCount + 1; return [...deck]; } } };
    const result = convertBladeToSwitchblades(MIDNIGHT_MASSACRE_SCHEME_ID, [], deckState, cardTypes, origins, context);
    assert.equal(result.villainDeckState, deckState);
    assert.equal(shuffleCount, 0);
  });
});
