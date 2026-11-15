/**
 * Commune with the Spirit World — discard an Artifact you control or three cards, then KO a card
 * from your hand or discard pile (WP-860 / D-24796).
 *
 * The line parsed to nothing and logged an `artifact` hollow on every play. These tests build the
 * REAL hooks from the committed data/cards/dstr.json, play through the real hero executor, and
 * resolve every step through the real resolveSeatChoice, so they pin the parse, the cost choice,
 * the chained discard picks, the zone-scoped KO, the owned-KO record and the guards together.
 *
 * No boardgame.io imports. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHeroAbilityHooks } from '../setup/heroAbility.setup.js';
import { executeHeroEffects, resolveDeferredHeroGrants } from '../hero/heroEffects.execute.js';
import { playedCardIdsThisTurn } from '../hero/splitCard.logic.js';
import { resolveSeatChoice, applySeatChoiceTimeoutDefault } from './seatChoice.resolve.js';
import { getLegalMoves } from '../simulation/ai.legalMoves.js';
import {
  COMMUNE_COST_SEAT_CHOICE_KIND,
  COMMUNE_DISCARD_SEAT_CHOICE_KIND,
  COMMUNE_KO_SEAT_CHOICE_KIND,
  chainCommuneAfterDiscard,
} from './communeSpiritWorld.logic.js';
import { SHIELD_AGENT_EXT_ID, WOUND_EXT_ID } from '../setup/pilesInit.js';
import { CARDS_DISCARDED_THIS_TURN_CONDITION_TYPE } from '../hero/heroConditions.evaluate.js';
import type { LegendaryGameState, MatchConfiguration } from '../types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import type { CardExtId } from '../state/zones.types.js';
import {
  makeGlobalPiles,
  makeMastermindState,
  makePlayerZones,
  makeTurnEconomy,
} from '../test/fixtureBuilders.js';

const CARDS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'data', 'cards');

const COMMUNE = 'dstr/doctor-voodoo/commune-with-the-spirit-world#0' as CardExtId;
const COMMUNE_TWO = 'dstr/doctor-voodoo/commune-with-the-spirit-world#1' as CardExtId;
const STAFF = 'dstr/doctor-voodoo/staff-of-legba#0' as CardExtId;
const MEDALLION = 'dstr/doctor-voodoo/medallion-of-many-loas#0' as CardExtId;
const POSSESSED = 'dstr/doctor-voodoo/posessed-by-brothers-spirit#0' as CardExtId;
const HERO_A = 'test/hero/a#0' as CardExtId;
const HERO_B = 'test/hero/b#0' as CardExtId;
const HERO_C = 'test/hero/c#0' as CardExtId;
const HERO_D = 'test/hero/d#0' as CardExtId;

const mockCtx = {
  ctx: { turn: 1, currentPlayer: '0', numPlayers: 2 },
  random: { Shuffle: <T>(items: T[]): T[] => [...items].reverse() },
};

/**
 * Builds the real Doctor Voodoo hooks from the committed card data.
 *
 * @returns Every hook the hero deck produces.
 */
function buildHooks(): HeroAbilityHook[] {
  const sets: Record<string, unknown> = {
    dstr: JSON.parse(readFileSync(join(CARDS_DIRECTORY, 'dstr.json'), 'utf8')),
  };
  const registry = { listCards: () => [], getSet: (abbr: string) => sets[abbr] };
  return buildHeroAbilityHooks(registry, { heroDeckIds: ['dstr/doctor-voodoo'] } as unknown as MatchConfiguration);
}

/**
 * A two-seat state wide enough for the hero executor and the seat-choice resolve.
 *
 * @returns A LegendaryGameState sufficient for these tests.
 */
function makeState(): LegendaryGameState {
  return {
    currentStage: 'main',
    messages: [],
    counters: {},
    hookRegistry: [],
    turnEconomy: { ...makeTurnEconomy() },
    playerZones: { '0': { ...makePlayerZones() }, '1': { ...makePlayerZones() } },
    piles: makeGlobalPiles(),
    mastermind: makeMastermindState(),
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: {},
    city: [null, null, null, null, null],
    hq: [null, null, null, null, null],
    heroDeck: [],
    escapedPile: [],
    ko: [],
    attachedBystanders: {},
    scheme: { twistPile: [] },
    heroAbilityHooks: buildHooks(),
    villainAbilityHooks: [],
    cardStats: {},
    cardTraits: {
      [STAFF]: { heroClass: 'strength' },
      [MEDALLION]: { heroClass: 'tech' },
    },
    cardKeywords: {},
    cardDisplayData: {
      [STAFF]: { name: 'Staff of Legba', imageUrl: '', cost: 5 },
      [MEDALLION]: { name: 'Medallion of Many Loas', imageUrl: '', cost: 4 },
    },
    notableEvents: [],
  } as unknown as LegendaryGameState;
}

/**
 * Adds a hook that reads the discard-count condition, so discardFromHand records the per-turn
 * count in this test match (the recorder is gated on a match that reads it).
 *
 * @param G - The game state, mutated in place.
 */
function addDiscardCountReader(G: LegendaryGameState): void {
  G.heroAbilityHooks = [
    ...G.heroAbilityHooks,
    {
      cardId: 'test/discard-reader#0',
      timing: 'onPlay',
      keywords: ['conditional'],
      conditions: [{ type: CARDS_DISCARDED_THIS_TURN_CONDITION_TYPE, value: '1' }],
      effects: [],
    } as unknown as HeroAbilityHook,
  ];
}

/**
 * Plays a card for player 0: puts it in play and runs its hooks.
 *
 * @param G - The game state.
 * @param cardId - The card to play.
 */
function playCard(G: LegendaryGameState, cardId: CardExtId): void {
  G.playerZones['0']!.inPlay.push(cardId);
  executeHeroEffects(G, mockCtx, '0', cardId);
}

/**
 * Submits an option of the open seat choice for player 0 through the real resolve move.
 *
 * @param G - The game state.
 * @param optionIndex - The option to pick.
 */
function choose(G: LegendaryGameState, optionIndex: number): void {
  resolveSeatChoice({ G, playerID: '0', ctx: { ...mockCtx.ctx }, random: mockCtx.random, events: undefined } as never, { optionIndex });
}

/**
 * The labels of the open seat choice for player 0.
 *
 * @param G - The game state.
 * @returns The option labels.
 */
function labels(G: LegendaryGameState): string[] {
  return (G.pendingSeatChoice?.seatPrompts['0']?.options ?? []).map((option) => option.label);
}

/**
 * The index of the open choice's option with the given label.
 *
 * @param G - The game state.
 * @param label - The label to find.
 * @returns The option index.
 */
function indexOf(G: LegendaryGameState, label: string): number {
  const index = labels(G).indexOf(label);
  assert.ok(index >= 0, `the open choice has an option "${label}" (has ${JSON.stringify(labels(G))})`);
  return index;
}

describe('Commune with the Spirit World parse and play (WP-860 / D-24796)', () => {
  it('parses to the handler keyword (the printed [keyword:Artifact] stays an unresolved marker)', () => {
    const hook = buildHooks().find((candidate) => candidate.cardId === COMMUNE);
    assert.deepEqual(hook?.keywords, ['discard-artifact-or-three-then-ko']);
    assert.deepEqual(hook?.effects, [{ type: 'discard-artifact-or-three-then-ko' }]);
    assert.deepEqual(hook?.unresolvedMarkers, ['artifact']);
  });

  it('playing it records no hollow', () => {
    const G = makeState();
    G.playerZones['0']!.hand = [HERO_A, HERO_B, HERO_C];
    playCard(G, COMMUNE);
    assert.equal(G.diagnostics?.hollowEffects.length ?? 0, 0);
    assert.equal(G.pendingSeatChoice?.kind, COMMUNE_COST_SEAT_CHOICE_KIND);
  });

  it('RS-1: no Artifact and fewer than three cards in hand → nothing opens, a blocked log', () => {
    const G = makeState();
    G.playerZones['0']!.hand = [HERO_A, HERO_B];
    playCard(G, COMMUNE);
    assert.equal(G.pendingSeatChoice, undefined);
    assert.ok(G.messages.some((message) => message.text.includes('had no Artifact to discard and fewer than three cards')));
  });

  it('RS-1: another open seat choice is never overwritten', () => {
    const G = makeState();
    G.playerZones['0']!.hand = [HERO_A, HERO_B, HERO_C];
    playCard(G, COMMUNE);
    const first = G.pendingSeatChoice;
    playCard(G, COMMUNE_TWO);
    assert.equal(G.pendingSeatChoice, first, 'the first choice is untouched');
    assert.ok(G.messages.some((message) => message.text.includes('another choice is open')));
  });
});

describe('Commune cost choice options (WP-860 / D-24796 RS-3)', () => {
  it('lists controlled then in-play Artifacts, three cards, then the decline default', () => {
    const G = makeState();
    G.controlledArtifacts = { '0': [STAFF] };
    G.playerZones['0']!.inPlay = [MEDALLION];
    G.playerZones['0']!.hand = [HERO_A, HERO_B, HERO_C, HERO_D];
    playCard(G, COMMUNE);
    assert.deepEqual(labels(G), [
      'Discard Staff of Legba',
      'Discard Medallion of Many Loas',
      'Discard three cards from your hand',
      "Don't discard",
    ]);
    assert.equal(G.pendingSeatChoice?.defaultOptionIndex, 3);
  });

  it('offers no three-cards option with two cards in hand', () => {
    const G = makeState();
    G.controlledArtifacts = { '0': [STAFF] };
    G.playerZones['0']!.hand = [HERO_A, HERO_B];
    playCard(G, COMMUNE);
    assert.deepEqual(labels(G), ['Discard Staff of Legba', "Don't discard"]);
  });
});

describe('Commune Artifact branch (WP-860 / D-24796)', () => {
  it('discards a controlled Staff, empties the record, then KOs a Wound from the discard pile', () => {
    const G = makeState();
    G.controlledArtifacts = { '0': [STAFF] };
    G.playerZones['0']!.hand = [HERO_A];
    G.playerZones['0']!.discard = [WOUND_EXT_ID];
    addDiscardCountReader(G);
    playCard(G, COMMUNE);
    choose(G, indexOf(G, 'Discard Staff of Legba'));
    assert.equal(G.controlledArtifacts, undefined, 'the emptied record leaves no key');
    assert.ok(G.playerZones['0']!.discard.includes(STAFF));
    assert.equal(G.cardsDiscardedThisTurn?.['0'] ?? 0, 0, 'the Artifact cost is not a hand discard');
    assert.equal(G.turnEconomy.ritualUsedPlayedCardIds, undefined, 'a controlled Artifact was not played this turn');
    assert.equal(G.pendingSeatChoice?.kind, COMMUNE_KO_SEAT_CHOICE_KIND);
    const options = G.pendingSeatChoice?.seatPrompts['0']?.options ?? [];
    assert.deepEqual(
      options.map((option) => [option.cardId, option.sourceZone]),
      [[HERO_A, 'hand'], [WOUND_EXT_ID, 'discard'], [STAFF, 'discard']],
      'hand first, then the discard pile (incl. the discarded Staff)',
    );
    assert.equal(labels(G)[2], 'KO Staff of Legba (discard pile)');
    assert.equal(G.pendingSeatChoice?.defaultOptionIndex, 0, 'mandatory: no decline, default the first card');
    choose(G, 1);
    assert.deepEqual(G.ko, [WOUND_EXT_ID]);
    assert.equal(G.pendingSeatChoice, undefined);
  });

  it('an in-play Medallion leaves play and still counts as played this turn', () => {
    const G = makeState();
    G.playerZones['0']!.inPlay = [MEDALLION];
    G.playerZones['0']!.hand = [HERO_A];
    playCard(G, COMMUNE);
    choose(G, indexOf(G, 'Discard Medallion of Many Loas'));
    assert.equal(G.playerZones['0']!.inPlay.includes(MEDALLION), false);
    assert.deepEqual(G.turnEconomy.ritualUsedPlayedCardIds, [MEDALLION]);
    assert.ok(playedCardIdsThisTurn(G, G.playerZones['0']!.inPlay).includes(MEDALLION));
  });

  it('a cost Artifact that left before the apply pays nothing and opens no KO pick', () => {
    const G = makeState();
    G.controlledArtifacts = { '0': [STAFF] };
    G.playerZones['0']!.hand = [HERO_A];
    playCard(G, COMMUNE);
    const staffIndex = indexOf(G, 'Discard Staff of Legba');
    delete G.controlledArtifacts;
    choose(G, staffIndex);
    assert.equal(G.pendingSeatChoice, undefined, 'no KO without payment');
    assert.deepEqual(G.ko, []);
  });
});

describe('Commune three-cards branch (WP-860 / D-24796)', () => {
  it('three chained picks through discardFromHand, then a KO from hand, end to end', () => {
    const G = makeState();
    G.playerZones['0']!.hand = [HERO_A, HERO_B, HERO_C, HERO_D];
    addDiscardCountReader(G);
    playCard(G, COMMUNE);
    choose(G, indexOf(G, 'Discard three cards from your hand'));
    assert.equal(G.pendingSeatChoice?.kind, COMMUNE_DISCARD_SEAT_CHOICE_KIND);
    assert.equal(G.pendingSeatChoice?.communeSpiritWorld?.discardsRemaining, 3);
    const roundTripped = JSON.parse(JSON.stringify(G.pendingSeatChoice));
    assert.deepEqual(roundTripped, G.pendingSeatChoice, 'a parked discard pick survives a JSON round-trip');
    choose(G, indexOf(G, 'Discard test/hero/a#0'));
    assert.equal(G.pendingSeatChoice?.communeSpiritWorld?.discardsRemaining, 2);
    choose(G, indexOf(G, 'Discard test/hero/b#0'));
    choose(G, indexOf(G, 'Discard test/hero/c#0'));
    assert.equal(G.cardsDiscardedThisTurn?.['0'], 3, 'each pick went through discardFromHand');
    assert.deepEqual(G.playerZones['0']!.discard, [HERO_A, HERO_B, HERO_C]);
    assert.deepEqual(G.playerZones['0']!.hand, [HERO_D]);
    assert.equal(G.pendingSeatChoice?.kind, COMMUNE_KO_SEAT_CHOICE_KIND);
    choose(G, indexOf(G, 'KO test/hero/d#0 (hand)'));
    assert.deepEqual(G.ko, [HERO_D]);
    assert.deepEqual(G.playerZones['0']!.hand, []);
    assert.equal(G.pendingSeatChoice, undefined);
  });

  it('decline: nothing moves and no further choice opens', () => {
    const G = makeState();
    G.playerZones['0']!.hand = [HERO_A, HERO_B, HERO_C];
    playCard(G, COMMUNE);
    choose(G, indexOf(G, "Don't discard"));
    assert.equal(G.pendingSeatChoice, undefined);
    assert.deepEqual(G.playerZones['0']!.hand, [HERO_A, HERO_B, HERO_C]);
    assert.deepEqual(G.ko, []);
  });
});

describe('Commune KO pick (WP-860 / D-24796)', () => {
  it('a repeated id KOs from the picked zone only; identical (zone, id) pairs are listed once', () => {
    const G = makeState();
    G.controlledArtifacts = { '0': [STAFF] };
    G.playerZones['0']!.hand = [SHIELD_AGENT_EXT_ID, SHIELD_AGENT_EXT_ID];
    G.playerZones['0']!.discard = [SHIELD_AGENT_EXT_ID];
    playCard(G, COMMUNE);
    choose(G, indexOf(G, 'Discard Staff of Legba'));
    const options = G.pendingSeatChoice?.seatPrompts['0']?.options ?? [];
    assert.equal(options.length, 3, 'one hand Agent, one discard Agent, the Staff');
    const discardAgentIndex = options.findIndex((option) => option.cardId === SHIELD_AGENT_EXT_ID && option.sourceZone === 'discard');
    choose(G, discardAgentIndex);
    assert.deepEqual(G.ko, [SHIELD_AGENT_EXT_ID]);
    assert.deepEqual(G.playerZones['0']!.hand, [SHIELD_AGENT_EXT_ID, SHIELD_AGENT_EXT_ID], 'the hand Agents stay');
    assert.deepEqual(G.playerZones['0']!.discard, [STAFF]);
  });

  it('RS-5: a paid cost with an empty hand and discard pile parks no KO pick', () => {
    // why: the reachable shape is teleport-on-discard taking the discarded cards out of the
    // discard pile; no committed hero fixture combines it with Commune, so the chain step is
    // driven directly on an emptied pool (the step the live path reaches after the last pick).
    const G = makeState();
    chainCommuneAfterDiscard(G, '0', 0, COMMUNE, undefined);
    assert.equal(G.pendingSeatChoice, undefined);
    assert.ok(G.messages.some((message) => message.text.includes('had no card to KO')));
  });

  it('a KO option whose card left its zone is a logged no-op (no KO, no owned-KO count)', () => {
    const G = makeState();
    G.controlledArtifacts = { '0': [STAFF] };
    G.playerZones['0']!.discard = [HERO_A];
    playCard(G, COMMUNE);
    choose(G, indexOf(G, 'Discard Staff of Legba'));
    const heroIndex = (G.pendingSeatChoice?.seatPrompts['0']?.options ?? []).findIndex(
      (option) => option.cardId === HERO_A && option.sourceZone === 'discard',
    );
    G.playerZones['0']!.discard = G.playerZones['0']!.discard.filter((cardId) => cardId !== HERO_A);
    G.playerZones['0']!.hand.push(HERO_A);
    choose(G, heroIndex);
    assert.deepEqual(G.ko, []);
    assert.ok(G.messages.some((message) => message.text.includes('could not KO')));
    assert.equal(Object.hasOwn(G, 'ownedCardsKoedSinceResolve'), false);
  });

  it('a Hero KO\'d by Commune triggers a waiting Possessed by Brother\'s Spirit', () => {
    const G = makeState();
    G.controlledArtifacts = { '0': [STAFF] };
    G.playerZones['0']!.hand = [HERO_A];
    playCard(G, POSSESSED);
    playCard(G, COMMUNE);
    choose(G, indexOf(G, 'Discard Staff of Legba'));
    choose(G, indexOf(G, 'KO test/hero/a#0 (hand)'));
    resolveDeferredHeroGrants(G, mockCtx);
    assert.equal(G.pendingCountScaledChoice?.length, 1, 'the +4 Recruit / +4 Attack choice parks');
  });
});

describe('Commune defaults (WP-860 / D-24796)', () => {
  it('a bot answers the cost choice with the decline, and nothing more opens', () => {
    const G = makeState();
    G.playerZones['0']!.hand = [HERO_A, HERO_B, HERO_C];
    playCard(G, COMMUNE);
    const moves = getLegalMoves(G, { phase: 'play', turn: 1, currentPlayer: '0', numPlayers: 2 });
    assert.deepEqual(moves, [{ name: 'resolveSeatChoice', args: { optionIndex: 1 } }]);
    choose(G, 1);
    assert.equal(G.pendingSeatChoice, undefined);
  });

  it('the timeout default declines and parks nothing', () => {
    const G = makeState();
    G.playerZones['0']!.hand = [HERO_A, HERO_B, HERO_C];
    playCard(G, COMMUNE);
    applySeatChoiceTimeoutDefault(G, ['0']);
    assert.equal(G.pendingSeatChoice, undefined);
    assert.deepEqual(G.playerZones['0']!.hand, [HERO_A, HERO_B, HERO_C]);
  });
});
