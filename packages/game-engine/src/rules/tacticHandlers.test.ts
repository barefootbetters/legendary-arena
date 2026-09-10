/**
 * Tests for the mastermind tactic onFight dispatcher + its resolvers
 * (WP-497 / D-24300 Octet; WP-506 / D-24312 Crushing Shockwave).
 */

import { describe, it, mock } from 'node:test';
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
  resolveTreasuresOfLatveria,
  resolveXaviersNemesis,
  resolveWhispersAndLies,
  resolveSecretsOfTimeTravel,
  OCTET_HAND_SIZE,
  SHOCKWAVE_WOUND_COUNT,
  NEGABLAST_GRENADES_ATTACK,
  ENDLESS_RESOURCES_RECRUIT,
  HYDRA_CONSPIRACY_BASE_DRAW,
  TREASURES_EXTRA_CARDS,
  WHISPERS_BYSTANDER_KO,
} from './tacticHandlers.js';
import { advanceTurnStage } from '../turn/turnLoop.js';
import { endTurn } from '../moves/coreMoves.impl.js';

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

// ---------------------------------------------------------------------------
// WP-691 / D-24508 — three no-choice core mastermind tactics
// ---------------------------------------------------------------------------

const TREASURES_TACTIC_ID = 'core-mastermind-dr-doom-treasures-of-latveria';
const XAVIERS_TACTIC_ID = 'core-mastermind-magneto-xaviers-nemesis';
const WHISPERS_TACTIC_ID = 'core-mastermind-loki-whispers-and-lies';

// why: the default HAND_SIZE (6) is duplicated here rather than imported — the test
// asserts the additive result (6 + 3 = 9) against the printed +3, so a drift in the
// engine base would surface as a failed assertion, not a silently-tracked constant.
const DEFAULT_HAND_SIZE = 6;

describe('resolveTreasuresOfLatveria (WP-691 / D-24508)', () => {
  it('adds exactly +3 to the base fill when no override is set (6 → 9) and logs', () => {
    const G = makeState();
    resolveTreasuresOfLatveria(G, '0');
    assert.equal(TREASURES_EXTRA_CARDS, 3);
    assert.deepEqual(G.handSizeOverrides, { '0': DEFAULT_HAND_SIZE + TREASURES_EXTRA_CARDS });
    assert.equal(G.messages.length, 1);
    assert.equal(G.messages[0]!.outcome, 'applied');
    assert.match(G.messages[0]!.text, /Treasures of Latveria/);
  });

  it('is ADDITIVE (stacks on an existing override), not set-to-N (8 → 11)', () => {
    // why: a prior next-hand bonus this turn (e.g. Octet set-to-8) must accumulate,
    // not be clobbered — the +3 is a delta on the absolute base.
    const G = makeState();
    G.handSizeOverrides = { '0': 8 };
    resolveTreasuresOfLatveria(G, '0');
    assert.deepEqual(G.handSizeOverrides, { '0': 11 });
  });

  it('applies to the DEFEATING player only, not globally', () => {
    const G = makeState();
    G.handSizeOverrides = { '1': 6 };
    resolveTreasuresOfLatveria(G, '0');
    assert.deepEqual(G.handSizeOverrides, { '1': 6, '0': DEFAULT_HAND_SIZE + TREASURES_EXTRA_CARDS });
  });

  it('routes through dispatchTacticOnFight for ctx.currentPlayer', () => {
    const G = makeState();
    dispatchTacticOnFight(G, { currentPlayer: '1' }, TREASURES_TACTIC_ID, SHUFFLE);
    assert.deepEqual(G.handSizeOverrides, { '1': DEFAULT_HAND_SIZE + TREASURES_EXTRA_CARDS });
  });
});

const XAVIERS_X_MEN_HERO: CardExtId = 'core-hero-cyclops-optic-blast';
const XAVIERS_NON_X_MEN: CardExtId = 'core-hero-spider-man-web-shooter';
const XAVIERS_COPY_CARD: CardExtId = 'core-hero-rogue-copy-powers';

/**
 * Builds a state for Xavier's Nemesis: the acting player's in-play zone, a supply
 * of `supplySize` bystanders, and a cardTraits map marking only the X-Men Hero.
 *
 * @param inPlay - The acting player's in-play cards.
 * @param supplySize - Number of Bystanders in the supply pile.
 * @returns A LegendaryGameState carrying only the fields the resolver reads.
 */
function makeXaviersState(inPlay: CardExtId[], supplySize: number): LegendaryGameState {
  const bystanders: CardExtId[] = [];
  for (let index = 0; index < supplySize; index++) {
    bystanders.push('pile-bystander');
  }
  return {
    messages: [],
    playerZones: {
      '0': { deck: [], hand: [], discard: [], inPlay: [...inPlay], victory: [] },
      '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
    },
    piles: { bystanders },
    cardTraits: { [XAVIERS_X_MEN_HERO]: { heroClass: null, team: 'x-men' } },
  } as unknown as LegendaryGameState;
}

describe('resolveXaviersNemesis (WP-691 / D-24508)', () => {
  it('rescues one Bystander per in-play X-Men Hero (2 X-Men → 2 rescued)', () => {
    const G = makeXaviersState([XAVIERS_X_MEN_HERO, XAVIERS_X_MEN_HERO, XAVIERS_NON_X_MEN], 5);
    resolveXaviersNemesis(G, '0');
    assert.deepEqual(G.playerZones['0']!.victory, ['pile-bystander', 'pile-bystander']);
    assert.equal(G.piles.bystanders.length, 3); // 5 − 2 rescued
    assert.match(G.messages[0]!.text, /rescued 2 Bystander/);
  });

  it('rescues ZERO with no in-play X-Men Hero (supply untouched)', () => {
    const G = makeXaviersState([XAVIERS_NON_X_MEN], 5);
    resolveXaviersNemesis(G, '0');
    assert.equal(G.playerZones['0']!.victory.length, 0);
    assert.equal(G.piles.bystanders.length, 5);
    assert.match(G.messages[0]!.text, /rescued 0 Bystander/);
  });

  it('stops early when the supply runs short (3 X-Men, 1 Bystander → 1 rescued)', () => {
    const G = makeXaviersState([XAVIERS_X_MEN_HERO, XAVIERS_X_MEN_HERO, XAVIERS_X_MEN_HERO], 1);
    resolveXaviersNemesis(G, '0');
    assert.equal(G.playerZones['0']!.victory.length, 1);
    assert.equal(G.piles.bystanders.length, 0);
    assert.match(G.messages[0]!.text, /rescued 1 Bystander/);
  });

  it('counts a Copy-Powers granted X-Men team (not only the printed trait)', () => {
    // why: the common failure smell — reading cardTraits.team directly misses a
    // Rogue Copy Powers card that copied an X-Men Hero. cardHasTeamWhenPlayed sees it.
    const G = makeXaviersState([XAVIERS_COPY_CARD], 5);
    G.cardCopiedTeams = { [XAVIERS_COPY_CARD]: ['x-men'] };
    resolveXaviersNemesis(G, '0');
    assert.equal(G.playerZones['0']!.victory.length, 1);
  });

  it('routes through dispatchTacticOnFight for ctx.currentPlayer', () => {
    const G = makeXaviersState([XAVIERS_X_MEN_HERO], 5);
    dispatchTacticOnFight(G, { currentPlayer: '0' }, XAVIERS_TACTIC_ID, SHUFFLE);
    assert.equal(G.playerZones['0']!.victory.length, 1);
  });
});

/**
 * Builds a state for Whispers and Lies: per-player victory piles and a KO pile.
 *
 * @param victories - Map of player id → that player's victory pile.
 * @returns A LegendaryGameState carrying only the fields the resolver reads.
 */
function makeWhispersState(victories: Record<string, CardExtId[]>): LegendaryGameState {
  const playerZones: Record<string, { victory: CardExtId[] }> = {};
  for (const playerId of Object.keys(victories)) {
    playerZones[playerId] = { victory: [...victories[playerId]!] };
  }
  return {
    messages: [],
    playerZones,
    ko: [],
  } as unknown as LegendaryGameState;
}

describe('resolveWhispersAndLies (WP-691 / D-24508)', () => {
  it('each OTHER player KOs two Victory-Pile Bystanders to the KO pile', () => {
    const G = makeWhispersState({
      '0': ['pile-bystander', 'pile-bystander'], // defeater — untouched
      '1': ['pile-bystander', 'pile-bystander', 'core-villain-brotherhood-blob-00'],
    });
    resolveWhispersAndLies(G, '0');
    assert.equal(WHISPERS_BYSTANDER_KO, 2);
    // why: the defeater keeps both Bystanders (skip-self).
    assert.deepEqual(G.playerZones['0']!.victory, ['pile-bystander', 'pile-bystander']);
    // why: player 1 loses two Bystanders; the non-Bystander villain stays.
    assert.deepEqual(G.playerZones['1']!.victory, ['core-villain-brotherhood-blob-00']);
    assert.deepEqual(G.ko, ['pile-bystander', 'pile-bystander']);
  });

  it('a player with fewer than two Bystanders KOs all they have', () => {
    const G = makeWhispersState({
      '0': [],
      '1': ['pile-bystander', 'some-villain'],
    });
    resolveWhispersAndLies(G, '0');
    assert.deepEqual(G.playerZones['1']!.victory, ['some-villain']);
    assert.deepEqual(G.ko, ['pile-bystander']);
    assert.ok(G.messages.some((entry) => entry.text.includes("KO'd 1 Bystander")));
  });

  it('counts rescued villain-deck Bystanders as Bystanders (two-arm predicate)', () => {
    const G = makeWhispersState({
      '0': [],
      '1': ['bystander-villain-deck-01', 'bystander-villain-deck-02', 'a-villain'],
    });
    resolveWhispersAndLies(G, '0');
    assert.deepEqual(G.playerZones['1']!.victory, ['a-villain']);
    assert.deepEqual(G.ko, ['bystander-villain-deck-01', 'bystander-villain-deck-02']);
  });

  it('never touches the DEFEATING player, even with Bystanders in their pile', () => {
    const G = makeWhispersState({
      '0': ['pile-bystander', 'pile-bystander'],
      '1': [],
    });
    resolveWhispersAndLies(G, '0');
    assert.deepEqual(G.playerZones['0']!.victory, ['pile-bystander', 'pile-bystander']);
    assert.equal(G.ko.length, 0);
  });

  it('emits exactly one Fight-effect log line per OTHER player (defeater excluded)', () => {
    const G = makeWhispersState({
      '0': ['pile-bystander'],
      '1': ['pile-bystander', 'pile-bystander'],
      '2': [],
    });
    resolveWhispersAndLies(G, '0');
    assert.equal(G.messages.length, 2);
  });

  it('routes through dispatchTacticOnFight and skips ctx.currentPlayer', () => {
    const G = makeWhispersState({
      '0': ['pile-bystander', 'pile-bystander'],
      '1': ['pile-bystander', 'pile-bystander'],
    });
    dispatchTacticOnFight(G, { currentPlayer: '0' }, WHISPERS_TACTIC_ID, SHUFFLE);
    assert.deepEqual(G.playerZones['0']!.victory, ['pile-bystander', 'pile-bystander']);
    assert.equal(G.playerZones['1']!.victory.length, 0);
    assert.equal(G.ko.length, 2);
  });
});

// ---------------------------------------------------------------------------
// Secrets of Time Travel — core Dr. Doom tactic Fight + the extra-turn
// primitive (WP-696 / D-24513)
// ---------------------------------------------------------------------------

const SECRETS_OF_TIME_TRAVEL_TACTIC_ID =
  'core-mastermind-dr-doom-secrets-of-time-travel';

/**
 * Builds the minimal cleanup-stage move context the endTurn move needs: the
 * acting player's zones (a card in play so the sweep does observable work),
 * G.extraTurns preset, and an endTurn spy that records its `{ next }` argument.
 *
 * @param extraTurns - The initial extra-turn counter map (preset onto G).
 * @param playerID - The acting seat (default '0').
 * @returns The move context (cast to the move signature) plus the endTurn spy.
 */
function makeEndTurnContext(
  extraTurns: Record<string, number> | undefined,
  playerID = '0',
): { context: unknown; endTurnSpy: ReturnType<typeof mock.fn> } {
  const endTurnSpy = mock.fn();
  const G = {
    currentStage: 'cleanup',
    messages: [],
    playerZones: {
      [playerID]: { deck: [], hand: [], discard: [], inPlay: ['some-card'], victory: [] },
    },
    ...(extraTurns !== undefined ? { extraTurns } : {}),
  } as unknown as LegendaryGameState;
  const context = { G, playerID, events: { endTurn: endTurnSpy } };
  return { context, endTurnSpy };
}

describe('resolveSecretsOfTimeTravel (WP-696 / D-24513)', () => {
  it('AC-1: lazily creates the counter and increments the defeating player to 1, logging', () => {
    const G = makeState();
    resolveSecretsOfTimeTravel(G, '0');
    assert.deepEqual(G.extraTurns, { '0': 1 });
    assert.equal(G.messages.length, 1);
    assert.match(G.messages[0]!.text, /Secrets of Time Travel/);
    assert.equal(G.messages[0]!.outcome, 'applied');
  });

  it('AC-4: increments (stacks) rather than setting to 1 — two grants queue two turns', () => {
    const G = makeState();
    resolveSecretsOfTimeTravel(G, '0');
    resolveSecretsOfTimeTravel(G, '0');
    // why: a set-to-1 bug would leave this at 1; increment stacks to 2.
    assert.deepEqual(G.extraTurns, { '0': 2 });
  });

  it('does not disturb another player already holding a queued extra turn', () => {
    const G = makeState();
    G.extraTurns = { '1': 1 };
    resolveSecretsOfTimeTravel(G, '0');
    assert.deepEqual(G.extraTurns, { '0': 1, '1': 1 });
  });
});

describe('dispatchTacticOnFight — Secrets of Time Travel branch (WP-696 / D-24513)', () => {
  it('AC-1: routes the tactic id to the resolver (increments ctx.currentPlayer)', () => {
    const G = makeState();
    dispatchTacticOnFight(G, { currentPlayer: '1' }, SECRETS_OF_TIME_TRAVEL_TACTIC_ID, SHUFFLE);
    assert.deepEqual(G.extraTurns, { '1': 1 });
  });

  it('AC-6: an unknown Dr. Doom tactic id stays a silent no-op (no counter, no log)', () => {
    const G = makeState();
    dispatchTacticOnFight(G, { currentPlayer: '0' }, 'core-mastermind-dr-doom-dark-technology', SHUFFLE);
    assert.equal(G.extraTurns, undefined);
    assert.equal(G.messages.length, 0);
  });
});

describe('extra-turn end-to-end: resolver → counter → turn-end grant (WP-696 / D-24513)', () => {
  it('AC-1+AC-2: dispatch then advanceTurnStage grants the SAME seat another turn and drains the counter', () => {
    // why: chains the resolver to the turn-loop honoring — the control-stub check
    // (stub resolveSecretsOfTimeTravel to a no-op) makes THIS fail, proving the
    // grant depends on the resolver actually setting the counter (non-vacuous).
    const G = { currentStage: 'cleanup', messages: [] } as unknown as LegendaryGameState;
    dispatchTacticOnFight(G, { currentPlayer: '0' }, SECRETS_OF_TIME_TRAVEL_TACTIC_ID, SHUFFLE);
    assert.deepEqual(G.extraTurns, { '0': 1 });

    const endTurnSpy = mock.fn();
    advanceTurnStage(G as never, { currentPlayer: '0', events: { endTurn: endTurnSpy } });

    assert.equal(endTurnSpy.mock.callCount(), 1);
    assert.deepEqual(endTurnSpy.mock.calls[0]!.arguments, [{ next: '0' }]);
    assert.equal(G.extraTurns?.['0'], undefined);
  });

  it('AC-2: the endTurn MOVE (the direct-events path) forwards { next } and decrements', () => {
    // why: this is the primary user path — the endTurn move calls events.endTurn
    // DIRECTLY, not via advanceTurnStage (D-22002 two-path model), so it must honor
    // the counter itself. This is ALSO exactly the call the sim / PAR / replay
    // harnesses dispatch and observe, so it doubles as the harness-parity signal.
    const { context, endTurnSpy } = makeEndTurnContext({ '0': 1 }, '0');
    endTurn(context as never);
    assert.equal(endTurnSpy.mock.callCount(), 1);
    assert.deepEqual(endTurnSpy.mock.calls[0]!.arguments, [{ next: '0' }]);
    assert.equal((context as { G: LegendaryGameState }).G.extraTurns?.['0'], undefined);
  });

  it('AC-3: the endTurn MOVE with no counter uses the bare endTurn() (normal rotation)', () => {
    const { context, endTurnSpy } = makeEndTurnContext(undefined, '0');
    endTurn(context as never);
    assert.equal(endTurnSpy.mock.callCount(), 1);
    assert.deepEqual(endTurnSpy.mock.calls[0]!.arguments, []);
  });

  it('AC-4: stacking — the endTurn MOVE drains one queued turn per call', () => {
    const { context, endTurnSpy } = makeEndTurnContext({ '0': 2 }, '0');
    const G = (context as { G: LegendaryGameState }).G;
    endTurn(context as never);
    assert.deepEqual(endTurnSpy.mock.calls[0]!.arguments, [{ next: '0' }]);
    assert.equal(G.extraTurns?.['0'], 1);

    // why: a second cleanup end-turn drains the last queued extra turn, then a
    // third rotates normally — the stacking contract end-to-end on the move path.
    G.currentStage = 'cleanup';
    G.playerZones['0']!.inPlay = ['some-card'];
    endTurn(context as never);
    assert.deepEqual(endTurnSpy.mock.calls[1]!.arguments, [{ next: '0' }]);
    assert.equal(G.extraTurns?.['0'], undefined);

    G.currentStage = 'cleanup';
    G.playerZones['0']!.inPlay = ['some-card'];
    endTurn(context as never);
    assert.deepEqual(endTurnSpy.mock.calls[2]!.arguments, []);
  });
});
