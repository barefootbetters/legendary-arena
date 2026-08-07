/**
 * Tests for the mastermind tactic onFight dispatcher + its resolvers
 * (WP-497 / D-24300 Octet; WP-506 / D-24312 Crushing Shockwave).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import {
  dispatchTacticOnFight,
  resolveOctetOfValenceElectrons,
  resolveCrushingShockwave,
  OCTET_HAND_SIZE,
  SHOCKWAVE_WOUND_COUNT,
} from './tacticHandlers.js';

const OCTET_TACTIC_ID =
  'co2e-mastermind-doctor-octopus-octet-of-valence-electrons';

/** Minimal game state: the Octet handlers touch only handSizeOverrides + messages. */
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

// ---------------------------------------------------------------------------
// Crushing Shockwave — core Magneto tactic Fight (WP-506 / D-24312)
// ---------------------------------------------------------------------------

const CRUSHING_SHOCKWAVE_TACTIC_ID =
  'core-mastermind-magneto-crushing-shockwave';

// why: X_MEN_HERO gets a cardTraits team of 'x-men' below (the reveal branch);
// NON_X_MEN_CARD is deliberately left OUT of cardTraits so its team resolves to
// undefined (the wound branch — proving the team-only match cannot false-fire).
const X_MEN_HERO: CardExtId = 'core-hero-cyclops-optic-blast';
const NON_X_MEN_CARD: CardExtId = 'core-hero-spider-man-web-shooter';
const WOUND: CardExtId = 'wound';

/**
 * Builds a minimal state for the Crushing Shockwave resolver: per-player hands
 * (discard starts empty), a wounds supply of `woundSupplySize` copies of WOUND,
 * and a cardTraits map marking only X_MEN_HERO as team `x-men`.
 *
 * @param hands - Map of player id → that player's hand (in order).
 * @param woundSupplySize - Number of Wounds in `G.piles.wounds`.
 * @returns A LegendaryGameState carrying only the fields the resolver reads.
 */
function makeShockwaveState(
  hands: Record<string, CardExtId[]>,
  woundSupplySize: number,
): LegendaryGameState {
  const playerZones: Record<string, { hand: CardExtId[]; discard: CardExtId[] }> = {};
  for (const playerId of Object.keys(hands)) {
    playerZones[playerId] = { hand: [...hands[playerId]!], discard: [] };
  }
  const wounds: CardExtId[] = [];
  for (let woundIndex = 0; woundIndex < woundSupplySize; woundIndex++) {
    wounds.push(WOUND);
  }
  return {
    messages: [],
    playerZones,
    piles: { wounds },
    cardTraits: { [X_MEN_HERO]: { heroClass: null, team: 'x-men' } },
  } as unknown as LegendaryGameState;
}

describe('resolveCrushingShockwave (WP-506 / D-24312)', () => {
  it('an OTHER player holding no X-Men Hero gains exactly two Wounds (supply → discard)', () => {
    // why: player '0' defeats the tactic; player '1' holds a non-X-Men card.
    const G = makeShockwaveState({ '0': [], '1': [NON_X_MEN_CARD] }, 5);
    resolveCrushingShockwave(G, '0');
    assert.equal(SHOCKWAVE_WOUND_COUNT, 2);
    assert.deepEqual(G.playerZones['1']!.discard, [WOUND, WOUND]);
    assert.equal(G.piles.wounds.length, 3); // 5 − 2 moved
  });

  it('an OTHER player holding an X-Men Hero reveals it and gains zero Wounds (no mutation)', () => {
    const G = makeShockwaveState({ '0': [], '1': [X_MEN_HERO] }, 5);
    resolveCrushingShockwave(G, '0');
    assert.equal(G.playerZones['1']!.discard.length, 0);
    assert.equal(G.piles.wounds.length, 5); // supply untouched
    assert.ok(G.messages.some((entry) => entry.text.includes('revealed an X-Men Hero')));
  });

  it('never affects the DEFEATING player, even holding no X-Men Hero', () => {
    // why: '0' is the defeater AND holds a non-X-Men card — still skipped entirely.
    const G = makeShockwaveState({ '0': [NON_X_MEN_CARD], '1': [X_MEN_HERO] }, 5);
    resolveCrushingShockwave(G, '0');
    assert.equal(G.playerZones['0']!.discard.length, 0); // no Wounds to the defeater
    assert.equal(G.piles.wounds.length, 5); // '1' revealed, '0' skipped → none taken
  });

  it('gains the available count and logs the shortfall when the supply is short (never throws)', () => {
    const G = makeShockwaveState({ '0': [], '1': [NON_X_MEN_CARD] }, 1); // only one Wound
    resolveCrushingShockwave(G, '0');
    assert.equal(G.playerZones['1']!.discard.length, 1);
    assert.equal(G.piles.wounds.length, 0);
    assert.ok(G.messages.some((entry) => entry.text.includes('gained 1 Wound(s)')));
  });

  it('gains zero Wounds and logs a no-op when the supply is empty', () => {
    const G = makeShockwaveState({ '0': [], '1': [NON_X_MEN_CARD] }, 0);
    resolveCrushingShockwave(G, '0');
    assert.equal(G.playerZones['1']!.discard.length, 0);
    assert.ok(G.messages.some((entry) => entry.text.includes('gained 0 Wound(s)')));
  });

  it('emits exactly one Fight-effect log line per OTHER player (defeater excluded)', () => {
    // why: '1' takes Wounds, '2' reveals, '0' (defeater) is skipped → two lines.
    const G = makeShockwaveState(
      { '0': [], '1': [NON_X_MEN_CARD], '2': [X_MEN_HERO] },
      5,
    );
    resolveCrushingShockwave(G, '0');
    assert.equal(G.messages.length, 2);
  });
});

describe('dispatchTacticOnFight — Crushing Shockwave branch (WP-506 / D-24312)', () => {
  it('routes the Crushing Shockwave tactic id to the resolver (skips ctx.currentPlayer)', () => {
    const G = makeShockwaveState({ '0': [], '1': [NON_X_MEN_CARD] }, 5);
    dispatchTacticOnFight(G, { currentPlayer: '0' }, CRUSHING_SHOCKWAVE_TACTIC_ID);
    assert.equal(G.playerZones['1']!.discard.length, 2);
    assert.equal(G.playerZones['0']!.discard.length, 0);
  });
});
