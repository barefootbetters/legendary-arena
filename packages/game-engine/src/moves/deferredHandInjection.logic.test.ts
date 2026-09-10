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
import { consumeDeferredHandInjections } from './deferredHandInjection.logic.js';
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
});
