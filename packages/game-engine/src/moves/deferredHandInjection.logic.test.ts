/**
 * Tests for consumeDeferredHandInjections (WP-695 / D-24512) — the onBegin consume of a
 * deferred specific-card hand injection (Magneto Electromagnetic Bubble).
 *
 * Covers: pulls the injected card from discard (the common post-cleanup case), from
 * in-play, and from deck; adds it to the hand; clears the per-player key; a card not
 * locatable in any zone is a logged no-op that still clears the key; a no-op (untouched
 * field) when nothing is recorded.
 *
 * Uses node:test + node:assert only. No boardgame.io testing imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { consumeDeferredHandInjections, setAsideDeferredHandInjections } from './deferredHandInjection.logic.js';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId, PlayerZones } from '../state/zones.types.js';

const CARD = 'core/wolverine/wolverine#0' as CardExtId;
const OTHER = 'core/iron-man/iron-man#0' as CardExtId;

function makeState(
  zones: Partial<PlayerZones>,
  injections?: Record<string, CardExtId[]>,
): { G: LegendaryGameState; zones: PlayerZones } {
  const fullZones = {
    deck: zones.deck ?? [], hand: zones.hand ?? [], discard: zones.discard ?? [],
    inPlay: zones.inPlay ?? [], victory: zones.victory ?? [],
  } as PlayerZones;
  const G = {
    playerZones: { '0': fullZones },
    messages: [],
    cardDisplayData: {},
    logMeta: { turn: 1, actionInStep: 0, firstPlayTurn: 1 },
  } as unknown as LegendaryGameState;
  if (injections !== undefined) {
    G.deferredHandInjections = injections;
  }
  return { G, zones: fullZones };
}

describe('consumeDeferredHandInjections (WP-695 / D-24512)', () => {
  it('pulls the injected card from discard into the hand and clears the key', () => {
    const { G, zones } = makeState({ hand: [OTHER], discard: [CARD] }, { '0': [CARD] });
    consumeDeferredHandInjections(G, '0', zones);
    assert.deepStrictEqual(zones.hand, [OTHER, CARD], 'card added to hand');
    assert.deepStrictEqual(zones.discard, [], 'removed from discard');
    assert.equal(G.deferredHandInjections?.['0'], undefined, 'key cleared');
  });

  it('pulls from in-play when not in discard', () => {
    const { G, zones } = makeState({ hand: [], inPlay: [CARD] }, { '0': [CARD] });
    consumeDeferredHandInjections(G, '0', zones);
    assert.deepStrictEqual(zones.hand, [CARD]);
    assert.deepStrictEqual(zones.inPlay, []);
  });

  it('pulls from deck when not in discard or in-play', () => {
    const { G, zones } = makeState({ hand: [], deck: [CARD, OTHER] }, { '0': [CARD] });
    consumeDeferredHandInjections(G, '0', zones);
    assert.deepStrictEqual(zones.hand, [CARD]);
    assert.deepStrictEqual(zones.deck, [OTHER]);
  });

  it('is a logged no-op when the card is not locatable, but still clears the key', () => {
    const { G, zones } = makeState({ hand: [OTHER] }, { '0': [CARD] });
    consumeDeferredHandInjections(G, '0', zones);
    assert.deepStrictEqual(zones.hand, [OTHER], 'hand unchanged — card not found');
    assert.equal(G.deferredHandInjections?.['0'], undefined, 'key cleared so it cannot re-fire');
    assert.ok(G.messages.length > 0, 'logged the not-locatable no-op');
  });

  it('is a no-op leaving the field absent when nothing is recorded', () => {
    const { G, zones } = makeState({ hand: [OTHER] });
    consumeDeferredHandInjections(G, '0', zones);
    assert.deepStrictEqual(zones.hand, [OTHER]);
    assert.equal(G.deferredHandInjections, undefined, 'field stays absent');
  });

  it('adds a set-aside card to the hand without searching the zones (D-24797)', () => {
    const { G, zones } = makeState({ hand: [OTHER], deck: [CARD] }, { '0': [CARD] });
    consumeDeferredHandInjections(G, '0', zones, [CARD]);
    assert.deepStrictEqual(zones.hand, [OTHER, CARD], 'the set-aside card is the extra card');
    assert.deepStrictEqual(zones.deck, [CARD], 'the deck copy was not pulled — the set-aside card was used');
    assert.equal(G.deferredHandInjections?.['0'], undefined, 'key cleared');
  });
});

describe('setAsideDeferredHandInjections (D-24797)', () => {
  it('lifts the recorded card out of the discard and leaves the key for the consume', () => {
    const { G, zones } = makeState({ discard: [OTHER, CARD] }, { '0': [CARD] });
    const setAside = setAsideDeferredHandInjections(G, '0', zones);
    assert.deepStrictEqual(setAside, [CARD]);
    assert.deepStrictEqual(zones.discard, [OTHER], 'removed from the discard before the fill');
    assert.deepStrictEqual(G.deferredHandInjections?.['0'], [CARD], 'key kept; the consume clears it');
  });

  it('leaves a card that is not in the discard where it is', () => {
    const { G, zones } = makeState({ discard: [OTHER], deck: [CARD] }, { '0': [CARD] });
    const setAside = setAsideDeferredHandInjections(G, '0', zones);
    assert.deepStrictEqual(setAside, []);
    assert.deepStrictEqual(zones.deck, [CARD], 'deck untouched');
    assert.deepStrictEqual(zones.discard, [OTHER], 'discard untouched');
  });

  it('returns [] and touches nothing when no injection is recorded', () => {
    const { G, zones } = makeState({ discard: [CARD] });
    assert.deepStrictEqual(setAsideDeferredHandInjections(G, '0', zones), []);
    assert.deepStrictEqual(zones.discard, [CARD]);
    assert.equal(G.deferredHandInjections, undefined, 'field stays absent');
  });
});
