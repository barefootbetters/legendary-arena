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
  resolveNegablastGrenades,
  resolveEndlessResources,
  resolveHydraConspiracy,
  OCTET_HAND_SIZE,
  SHOCKWAVE_WOUND_COUNT,
  NEGABLAST_GRENADES_ATTACK,
  ENDLESS_RESOURCES_RECRUIT,
  HYDRA_CONSPIRACY_BASE_DRAW,
} from './tacticHandlers.js';

const OCTET_TACTIC_ID =
  'co2e-mastermind-doctor-octopus-octet-of-valence-electrons';

// why: WP-567 - a real ShuffleProvider, not a stub. dispatchTacticOnFight now
// takes one because HYDRA Conspiracy DRAWS, and the bare boardgame.io ctx has no
// random (D-24051). Reversing is the makeMockCtx idiom: it proves the shuffle ran.
const SHUFFLE = { random: { Shuffle: <T,>(items: T[]): T[] => [...items].reverse() } };

const NEGABLAST_TACTIC_ID = 'core-mastermind-red-skull-negablast-grenades';
const ENDLESS_RESOURCES_TACTIC_ID = 'core-mastermind-red-skull-endless-resources';
const HYDRA_CONSPIRACY_TACTIC_ID = 'core-mastermind-red-skull-hydra-conspiracy';
const RUTHLESS_DICTATOR_TACTIC_ID = 'core-mastermind-red-skull-ruthless-dictator';

/** Economy-and-zones state for the Red Skull resolvers. */
function makeEconomyState(victory: string[] = [], deck: string[] = []): LegendaryGameState {
  return {
    messages: [],
    turnEconomy: { attack: 0, recruit: 0, spentAttack: 0, spentRecruit: 0, piercing: 0, woundsDrawn: 0 },
    playerZones: {
      '0': { deck: [...deck], hand: [], discard: [], inPlay: [], victory: [...victory] },
      '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
    },
  } as unknown as LegendaryGameState;
}

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
    dispatchTacticOnFight(G, { currentPlayer: '0' }, OCTET_TACTIC_ID, SHUFFLE);
    assert.deepEqual(G.handSizeOverrides, { '0': 8 });
  });

  it('is a silent no-op for an unknown/unimplemented tactic id (never throws, no state change)', () => {
    const G = makeState();
    dispatchTacticOnFight(G, { currentPlayer: '0' }, 'core-mastermind-magneto-electromagnetic-bubble', SHUFFLE);
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
    dispatchTacticOnFight(G, { currentPlayer: '0' }, CRUSHING_SHOCKWAVE_TACTIC_ID, SHUFFLE);
    assert.equal(G.playerZones['1']!.discard.length, 2);
    assert.equal(G.playerZones['0']!.discard.length, 0);
  });
});

describe('Red Skull tactic onFight resolvers (WP-567 / D-24376)', () => {
  it('AC-1: Negablast Grenades grants exactly +3 attack and logs it', () => {
    const G = makeEconomyState();
    resolveNegablastGrenades(G, '0');
    assert.equal(NEGABLAST_GRENADES_ATTACK, 3);
    assert.equal(G.turnEconomy.attack, 3);
    assert.equal(G.turnEconomy.recruit, 0);
    // why: the silence WAS half the defect - a resolver that mutates without a
    // log line reproduces the original complaint (the player sees nothing happen).
    assert.equal(G.messages.length, 1);
    assert.match(G.messages[0]!.text, /Negablast Grenades/);
    assert.equal(G.messages[0]!.outcome, 'applied');
  });

  it('AC-2: Endless Resources grants exactly +4 recruit and logs it', () => {
    const G = makeEconomyState();
    resolveEndlessResources(G, '0');
    assert.equal(ENDLESS_RESOURCES_RECRUIT, 4);
    assert.equal(G.turnEconomy.recruit, 4);
    assert.equal(G.turnEconomy.attack, 0);
    assert.equal(G.messages.length, 1);
    assert.equal(G.messages[0]!.outcome, 'applied');
  });

  it('AC-3: HYDRA Conspiracy draws exactly 2 with ZERO HYDRA villains', () => {
    const G = makeEconomyState([], ['a', 'b', 'c', 'd', 'e']);
    resolveHydraConspiracy(G, '0', HYDRA_CONSPIRACY_TACTIC_ID, SHUFFLE);
    assert.equal(HYDRA_CONSPIRACY_BASE_DRAW, 2);
    assert.equal(G.playerZones['0']!.hand.length, 2);
  });

  it('AC-3: HYDRA Conspiracy draws 5 with THREE HYDRA villains (2 + 3)', () => {
    // why: 0-and-N both asserted - a single-value test passes against a hardcoded 2.
    const victory = [
      'core-villain-hydra-viper-00',
      'core-villain-hydra-supreme-hydra-00',
      'core-villain-hydra-hydra-kidnappers-01',
    ];
    const G = makeEconomyState(victory, ['a', 'b', 'c', 'd', 'e', 'f', 'g']);
    resolveHydraConspiracy(G, '0', HYDRA_CONSPIRACY_TACTIC_ID, SHUFFLE);
    assert.equal(G.playerZones['0']!.hand.length, 5);
    assert.match(G.messages[0]!.text, /drew 5 card\(s\)/);
  });

  it('AC-4: the HYDRA count reads the DEFEATING player victory pile only', () => {
    // why: reachable only at 2+ seats - a solo-only suite would never surface a
    // count that spans all players, and the draw would silently inflate.
    const G = makeEconomyState([], ['a', 'b', 'c', 'd', 'e']);
    G.playerZones['1']!.victory = [
      'core-villain-hydra-viper-00',
      'core-villain-hydra-supreme-hydra-00',
    ];
    resolveHydraConspiracy(G, '0', HYDRA_CONSPIRACY_TACTIC_ID, SHUFFLE);
    assert.equal(G.playerZones['0']!.hand.length, 2);
  });

  it('counts only HYDRA villains - other groups and villain-deck bystanders do not', () => {
    const victory = [
      'core-villain-hydra-viper-00',
      'core-villain-brotherhood-magneto-00',
      'bystander-villain-deck-00',
      'henchman-doombot-legion-03',
      'core-mastermind-red-skull-hydra-conspiracy',
    ];
    const G = makeEconomyState(victory, ['a', 'b', 'c', 'd', 'e']);
    resolveHydraConspiracy(G, '0', HYDRA_CONSPIRACY_TACTIC_ID, SHUFFLE);
    // why: 2 base + exactly 1 HYDRA villain. The anchored prefix is what keeps
    // `bystander-villain-deck-NN` and the tactic's own id out of the count.
    assert.equal(G.playerZones['0']!.hand.length, 3);
  });

  it('reports what was actually DRAWN when the deck runs short', () => {
    const G = makeEconomyState([], ['only-one']);
    resolveHydraConspiracy(G, '0', HYDRA_CONSPIRACY_TACTIC_ID, SHUFFLE);
    assert.equal(G.playerZones['0']!.hand.length, 1);
    assert.match(G.messages[0]!.text, /drew 1 card\(s\)/);
  });

  it('reshuffles the discard when the deck empties mid-draw (the threaded provider)', () => {
    // why: pins the WIRE, not a mock. dispatchTacticOnFight gained a
    // ShuffleProvider precisely because the bare ctx has no random (D-24051); if
    // the provider were not threaded, this reshuffle path would throw.
    const G = makeEconomyState([], ['deck-1']);
    G.playerZones['0']!.discard = ['discard-1', 'discard-2'];
    resolveHydraConspiracy(G, '0', HYDRA_CONSPIRACY_TACTIC_ID, SHUFFLE);
    assert.equal(G.playerZones['0']!.hand.length, 2);
  });
});

describe('dispatchTacticOnFight - Red Skull routing + the deliberate omission (WP-567)', () => {
  it('routes all three implemented Red Skull tactics', () => {
    const attackState = makeEconomyState();
    dispatchTacticOnFight(attackState, { currentPlayer: '0' }, NEGABLAST_TACTIC_ID, SHUFFLE);
    assert.equal(attackState.turnEconomy.attack, 3);

    const recruitState = makeEconomyState();
    dispatchTacticOnFight(recruitState, { currentPlayer: '0' }, ENDLESS_RESOURCES_TACTIC_ID, SHUFFLE);
    assert.equal(recruitState.turnEconomy.recruit, 4);

    const drawState = makeEconomyState([], ['a', 'b', 'c']);
    dispatchTacticOnFight(drawState, { currentPlayer: '0' }, HYDRA_CONSPIRACY_TACTIC_ID, SHUFFLE);
    assert.equal(drawState.playerZones['0']!.hand.length, 2);
  });

  it('AC-5: Ruthless Dictator stays UNDISPATCHED - no mutation, no log', () => {
    // why: deliberate omission, not an oversight. Its printed top-three
    // KO/discard/replace is INTERACTIVE and parks a pending choice; shipped
    // without its UIState projection and prompt it HARD-FREEZES the human player.
    // Pinned so a later packet's arrival is a decision, not an accident.
    const G = makeEconomyState([], ['a', 'b', 'c']);
    dispatchTacticOnFight(G, { currentPlayer: '0' }, RUTHLESS_DICTATOR_TACTIC_ID, SHUFFLE);
    assert.equal(G.turnEconomy.attack, 0);
    assert.equal(G.turnEconomy.recruit, 0);
    assert.equal(G.playerZones['0']!.hand.length, 0);
    assert.equal(G.messages.length, 0);
  });

  it('AC-7: an unhandled tactic id is still a silent no-op and does not throw', () => {
    const G = makeEconomyState([], ['a', 'b', 'c']);
    dispatchTacticOnFight(G, { currentPlayer: '0' }, 'core-mastermind-loki-some-unimplemented-tactic', SHUFFLE);
    assert.equal(G.messages.length, 0);
    assert.equal(G.turnEconomy.attack, 0);
  });
});
