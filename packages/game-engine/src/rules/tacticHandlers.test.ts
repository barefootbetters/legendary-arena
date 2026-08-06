/**
 * Tests for the mastermind tactic onFight dispatcher + the Octet resolver
 * (WP-497 / D-24300).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { LegendaryGameState } from '../types.js';
import {
  dispatchTacticOnFight,
  resolveOctetOfValenceElectrons,
  OCTET_HAND_SIZE,
} from './tacticHandlers.js';

const OCTET_TACTIC_ID =
  'co2e-mastermind-doctor-octopus-octet-of-valence-electrons';

/** Minimal game state: the handlers touch only handSizeOverrides + messages. */
function makeState(): LegendaryGameState {
  return { messages: [] } as unknown as LegendaryGameState;
}

describe('resolveOctetOfValenceElectrons (WP-497 / D-24300)', () => {
  it('sets the current player next-hand override to OCTET_HAND_SIZE (8) and logs', () => {
    const G = makeState();
    resolveOctetOfValenceElectrons(G, '1');
    assert.equal(OCTET_HAND_SIZE, 8);
    assert.deepEqual(G.handSizeOverrides, { '1': 8 });
    assert.equal(G.messages.length, 1);
  });

  it('lazy-creates the container (absent → created) without disturbing other players', () => {
    const G = makeState();
    G.handSizeOverrides = { '0': 8 };
    resolveOctetOfValenceElectrons(G, '1');
    assert.deepEqual(G.handSizeOverrides, { '0': 8, '1': 8 });
  });
});

describe('dispatchTacticOnFight (WP-497 / D-24300)', () => {
  it('routes the Octet tactic id to the resolver (sets the override for ctx.currentPlayer)', () => {
    const G = makeState();
    dispatchTacticOnFight(G, { currentPlayer: '0' }, OCTET_TACTIC_ID);
    assert.deepEqual(G.handSizeOverrides, { '0': 8 });
  });

  it('is a silent no-op for an unknown/unimplemented tactic id (never throws, no state change)', () => {
    const G = makeState();
    dispatchTacticOnFight(G, { currentPlayer: '0' }, 'core-mastermind-magneto-electromagnetic-bubble');
    assert.equal(G.handSizeOverrides, undefined);
    assert.equal(G.messages.length, 0);
  });
});
