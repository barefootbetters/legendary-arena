/**
 * Stalk the Night Stalkers — Hunt for Victims, then KO a Hero, with the Tech rescue (WP-884 / D-24835).
 *
 * The card's first line logged a `hunt-for-victims` hollow on every play and its Tech line was a
 * `gate-only` hollow. These tests build the REAL hooks from the committed data/cards/mdns.json, play
 * through the real hero executor (and once through the real playCard move), and resolve every step
 * through the real resolveSeatChoice, so they pin the parse, the hunt options, the Tech rescue, the
 * chained KO-a-Hero pick, the KO sites and the guards together.
 *
 * No boardgame.io imports. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHeroAbilityHooks } from '../setup/heroAbility.setup.js';
import { executeHeroEffects } from '../hero/heroEffects.execute.js';
import { playCard as playCardMove } from './coreMoves.impl.js';
import { resolveSeatChoice, applySeatChoiceTimeoutDefault } from './seatChoice.resolve.js';
import { captureBystanderToMastermind } from './seatChoiceCards.js';
import { revealVillainCard } from '../villainDeck/villainDeck.reveal.js';
import { getLegalMoves } from '../simulation/ai.legalMoves.js';
import { choosePlayingSeatChoiceOption } from '../simulation/ai.seatChoice.js';
import {
  HUNT_FOR_VICTIMS_KO_HERO_SEAT_CHOICE_KIND,
  HUNT_FOR_VICTIMS_SEAT_CHOICE_KIND,
  chainHuntForVictimsKoHero,
} from './huntForVictims.logic.js';
import { BYSTANDER_EXT_ID, SHIELD_AGENT_EXT_ID, WOUND_EXT_ID } from '../setup/pilesInit.js';
import { OWNED_CARD_KOED_CONDITION_TYPE } from '../hero/heroConditions.evaluate.js';
import type { LegendaryGameState, MatchConfiguration } from '../types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import type { CardExtId } from '../state/zones.types.js';
import {
  makeGlobalPiles,
  makeMastermindState,
  makePlayerZones,
  makeTurnEconomy,
} from '../test/fixtureBuilders.js';
import { makeMockMoveContext } from '../test/mockMoveContext.js';

const CARDS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'data', 'cards');

const STALK = 'mdns/elsa-bloodstone/stalk-the-night-stalkers#0' as CardExtId;
const TECH_HERO = 'test/tech/gadget#0' as CardExtId;
const NINJAS_A = 'test/villain/hand-ninjas#0' as CardExtId;
const NINJAS_B = 'test/villain/hand-ninjas#1' as CardExtId;
const SKRULL = 'test/villain/skrull#0' as CardExtId;
const ESCAPED_VILLAIN = 'test/villain/escaped#0' as CardExtId;
const MASTERMIND = 'test-mastermind-001' as CardExtId;
const BYSTANDER_A = 'test/bystander/a#0' as CardExtId;
const BYSTANDER_B = 'test/bystander/b#0' as CardExtId;
const BYSTANDER_C = 'test/bystander/c#0' as CardExtId;
const HERO_A = 'test/hero/a#0' as CardExtId;

const DECLINE_HUNT = "Don't Hunt for Victims";

const mockCtx = {
  ctx: { turn: 1, currentPlayer: '0', numPlayers: 2 },
  random: { Shuffle: <T>(items: T[]): T[] => [...items].reverse() },
};

/**
 * Builds the real Elsa Bloodstone hooks from the committed card data.
 *
 * @returns Every hook the hero deck produces.
 */
function buildHooks(): HeroAbilityHook[] {
  const sets: Record<string, unknown> = {
    mdns: JSON.parse(readFileSync(join(CARDS_DIRECTORY, 'mdns.json'), 'utf8')),
  };
  const registry = { listCards: () => [], getSet: (abbr: string) => sets[abbr] };
  return buildHeroAbilityHooks(registry, { heroDeckIds: ['mdns/elsa-bloodstone'] } as unknown as MatchConfiguration);
}

const REAL_HOOKS = buildHooks();

/**
 * A two-seat state wide enough for the hero executor, the seat-choice resolve and a reveal.
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
    piles: makeGlobalPiles({ bystanders: [BYSTANDER_A, BYSTANDER_B, BYSTANDER_C] }),
    mastermind: makeMastermindState(),
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: {
      [NINJAS_A]: 'villain',
      [NINJAS_B]: 'villain',
      [SKRULL]: 'villain',
      [ESCAPED_VILLAIN]: 'villain',
      [BYSTANDER_A]: 'bystander',
      [BYSTANDER_B]: 'bystander',
      [BYSTANDER_C]: 'bystander',
    },
    city: [null, null, null, null, null],
    hq: [null, null, null, null, null],
    heroDeck: [],
    escapedPile: [],
    ko: [],
    attachedBystanders: {},
    scheme: { twistPile: [] },
    heroAbilityHooks: [...REAL_HOOKS],
    villainAbilityHooks: [],
    cardStats: {},
    cardTraits: { [TECH_HERO]: { heroClass: 'tech' }, [STALK]: { heroClass: 'tech' } },
    cardKeywords: {},
    cardDisplayData: {
      [NINJAS_A]: { name: 'Hand Ninjas', imageUrl: '', cost: 0 },
      [NINJAS_B]: { name: 'Hand Ninjas', imageUrl: '', cost: 0 },
      [SKRULL]: { name: 'Skrull Shapeshifters', imageUrl: '', cost: 0 },
      [MASTERMIND]: { name: 'Zarathos', imageUrl: '', cost: 0 },
      [STALK]: { name: 'Stalk the Night Stalkers', imageUrl: '', cost: 6 },
      [SHIELD_AGENT_EXT_ID]: { name: 'S.H.I.E.L.D. Agent', imageUrl: '', cost: 0 },
    },
    notableEvents: [],
  } as unknown as LegendaryGameState;
}

/**
 * Plays a card for player 0 through the hero executor: puts it in play and runs its hooks.
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

/**
 * Whether any log line contains the text.
 *
 * @param G - The game state.
 * @param text - The text to look for.
 * @returns true when a message contains it.
 */
function logged(G: LegendaryGameState, text: string): boolean {
  return G.messages.some((message) => message.text.includes(text));
}

/**
 * Counts the Bystanders in the Escape Pile.
 *
 * @param G - The game state.
 * @returns The count.
 */
function escapedBystanders(G: LegendaryGameState): number {
  let count = 0;
  for (const cardId of G.escapedPile) {
    if (G.villainDeckCardTypes[cardId] === 'bystander' || cardId === BYSTANDER_EXT_ID) {
      count += 1;
    }
  }
  return count;
}

describe('Stalk the Night Stalkers parse and play (WP-884 / D-24835)', () => {
  it('parses to the two EC target hooks exactly', () => {
    const hooks = REAL_HOOKS.filter((hook) => hook.cardId === STALK);
    assert.deepEqual(hooks, [
      { cardId: STALK, timing: 'onPlay', keywords: ['hunt-for-victims'], effects: [{ type: 'hunt-for-victims' }] },
      {
        cardId: STALK,
        timing: 'onPlay',
        keywords: ['hunt-for-victims-rescue', 'conditional'],
        conditions: [{ type: 'heroClassMatch', value: 'tech' }],
        effects: [{ type: 'hunt-for-victims-rescue' }],
      },
    ]);
  });

  it('playing it through the real playCard move records no hollow and keeps its printed 3 Attack', () => {
    const G = makeState();
    G.city[1] = NINJAS_A;
    G.attachedBystanders = { [NINJAS_A]: [BYSTANDER_A] };
    G.cardStats = { [STALK]: { attack: 3, recruit: 0, cost: 6, fightCost: 0 } };
    G.playerZones['0']!.hand = [STALK];
    playCardMove(makeMockMoveContext(G, { numPlayers: 2 }), { cardId: STALK });
    assert.equal(G.diagnostics?.hollowEffects.length ?? 0, 0);
    assert.equal(G.turnEconomy.attack, 3);
    assert.equal(G.pendingSeatChoice?.kind, HUNT_FOR_VICTIMS_SEAT_CHOICE_KIND);
    assert.ok(logged(G, 'must choose whether a Villain or Mastermind Hunts for Victims'));
  });
});

describe('Hunt for Victims options (RS-2)', () => {
  it('KO mode lists each holder in order, the decline last and default', () => {
    const G = makeState();
    G.city[1] = NINJAS_A;
    G.attachedBystanders = { [NINJAS_A]: [BYSTANDER_A, BYSTANDER_B] };
    G.mastermind.attachedBystanders = [BYSTANDER_C];
    G.escapedPile = [ESCAPED_VILLAIN, BYSTANDER_EXT_ID];
    playCard(G, STALK);
    assert.deepEqual(labels(G), [
      'KO a Bystander held by Hand Ninjas (Bank)',
      'KO a Bystander held by Zarathos',
      'KO a Bystander from the Escape Pile',
      DECLINE_HUNT,
    ]);
    assert.equal(G.pendingSeatChoice?.defaultOptionIndex, 3);
    assert.deepEqual(G.pendingSeatChoice?.seatPrompts['0']?.options[0], {
      label: 'KO a Bystander held by Hand Ninjas (Bank)',
      huntAction: 'ko',
      huntSource: 'city',
      cityIndex: 1,
      cardId: NINJAS_A,
    });
    assert.deepEqual(G.pendingSeatChoice?.huntForVictims, { sourceCardId: STALK });
  });

  it('two copies of one Villain get two distinct labels', () => {
    const G = makeState();
    G.city[1] = NINJAS_A;
    G.city[3] = NINJAS_B;
    G.attachedBystanders = { [NINJAS_A]: [BYSTANDER_A], [NINJAS_B]: [BYSTANDER_B] };
    playCard(G, STALK);
    assert.deepEqual(labels(G), [
      'KO a Bystander held by Hand Ninjas (Bank)',
      'KO a Bystander held by Hand Ninjas (Streets)',
      DECLINE_HUNT,
    ]);
  });

  it('capture mode: no Bystander anywhere lists each City Villain, then the Mastermind', () => {
    const G = makeState();
    G.city[0] = NINJAS_A;
    G.city[2] = SKRULL;
    playCard(G, STALK);
    assert.deepEqual(labels(G), [
      'Hand Ninjas (Sewers) captures a Bystander',
      'Skrull Shapeshifters (Rooftops) captures a Bystander',
      'Zarathos captures a Bystander',
      DECLINE_HUNT,
    ]);
    assert.equal(G.pendingSeatChoice?.defaultOptionIndex, 3);
  });
});

describe('Hunt for Victims KO (RS-3 / RS-4)', () => {
  it('KO from a City Villain: its last Bystander goes to the KO pile, it keeps the other, the Hero pick opens', () => {
    const G = makeState();
    G.city[1] = NINJAS_A;
    G.attachedBystanders = { [NINJAS_A]: [BYSTANDER_A, BYSTANDER_B] };
    G.playerZones['0']!.discard = [SHIELD_AGENT_EXT_ID];
    playCard(G, STALK);
    choose(G, indexOf(G, 'KO a Bystander held by Hand Ninjas (Bank)'));
    assert.deepEqual(G.ko, [BYSTANDER_B]);
    assert.deepEqual(G.attachedBystanders[NINJAS_A], [BYSTANDER_A]);
    assert.ok(logged(G, `Player 0's Stalk the Night Stalkers (${STALK}) Hunted for Victims: a Bystander held by Hand Ninjas (Bank) was KO'd.`));
    assert.equal(G.pendingSeatChoice?.kind, HUNT_FOR_VICTIMS_KO_HERO_SEAT_CHOICE_KIND);
    assert.deepEqual(labels(G), ['KO S.H.I.E.L.D. Agent (discard pile)', "Don't KO a Hero"]);
    assert.equal(G.pendingSeatChoice?.defaultOptionIndex, 1);
  });

  it('KOing the only City Bystander deletes its attachedBystanders key', () => {
    const G = makeState();
    G.city[1] = NINJAS_A;
    G.attachedBystanders = { [NINJAS_A]: [BYSTANDER_A] };
    playCard(G, STALK);
    choose(G, 0);
    assert.equal(Object.hasOwn(G.attachedBystanders, NINJAS_A), false);
  });

  it('KO from the Escape Pile: the escaped Villain stays and one Bystander fewer is escaped', () => {
    const G = makeState();
    G.escapedPile = [BYSTANDER_EXT_ID, ESCAPED_VILLAIN, BYSTANDER_EXT_ID];
    playCard(G, STALK);
    choose(G, indexOf(G, 'KO a Bystander from the Escape Pile'));
    assert.deepEqual(G.escapedPile, [BYSTANDER_EXT_ID, ESCAPED_VILLAIN]);
    assert.equal(escapedBystanders(G), 1);
    assert.deepEqual(G.ko, [BYSTANDER_EXT_ID]);
    assert.ok(logged(G, "Hunted for Victims: a Bystander in the Escape Pile was KO'd."));
  });

  it('PS-1: a Bystander revealed into an empty City is KO\'d from both Mastermind stores, and the mirror key goes', () => {
    const G = makeState();
    G.currentStage = 'start';
    G.villainDeck.deck = [BYSTANDER_C];
    G.piles.bystanders = [];
    revealVillainCard(makeMockMoveContext(G, { numPlayers: 2 }) as never);
    assert.deepEqual(G.mastermind.attachedBystanders, [BYSTANDER_C]);
    assert.deepEqual(G.attachedBystanders[MASTERMIND], [BYSTANDER_C]);
    G.currentStage = 'main';
    playCard(G, STALK);
    assert.deepEqual(labels(G), ['KO a Bystander held by Zarathos', DECLINE_HUNT], 'the mirror key is not a City holder');
    choose(G, 0);
    assert.deepEqual(G.mastermind.attachedBystanders, []);
    assert.equal(Object.hasOwn(G.attachedBystanders, MASTERMIND), false);
    assert.deepEqual(G.ko, [BYSTANDER_C]);
  });

  it('a Here, Hold This capture to the Mastermind (no mirror copy) KOs cleanly', () => {
    const G = makeState();
    captureBystanderToMastermind(G);
    assert.equal(Object.hasOwn(G.attachedBystanders, MASTERMIND), false);
    playCard(G, STALK);
    choose(G, indexOf(G, 'KO a Bystander held by Zarathos'));
    assert.deepEqual(G.mastermind.attachedBystanders, []);
    assert.deepEqual(G.ko, [BYSTANDER_A]);
    assert.deepEqual(G.attachedBystanders, {});
  });
});

describe('Hunt for Victims Tech rescue (RS-5)', () => {
  it('after another Tech Hero, rescue twins precede each KO option; a rescue goes to Victory and the Hero pick still opens', () => {
    const G = makeState();
    G.city[1] = NINJAS_A;
    G.attachedBystanders = { [NINJAS_A]: [BYSTANDER_A] };
    G.escapedPile = [BYSTANDER_EXT_ID];
    G.playerZones['0']!.hand = [HERO_A];
    playCard(G, TECH_HERO);
    playCard(G, STALK);
    assert.deepEqual(labels(G), [
      'Rescue a Bystander held by Hand Ninjas (Bank)',
      'KO a Bystander held by Hand Ninjas (Bank)',
      'Rescue a Bystander from the Escape Pile',
      'KO a Bystander from the Escape Pile',
      DECLINE_HUNT,
    ]);
    assert.equal(G.pendingSeatChoice?.defaultOptionIndex, 4);
    assert.deepEqual(G.pendingSeatChoice?.huntForVictims, { sourceCardId: STALK, isRescueAllowed: true });
    assert.equal(G.diagnostics?.hollowEffects.length ?? 0, 0);
    choose(G, indexOf(G, 'Rescue a Bystander held by Hand Ninjas (Bank)'));
    assert.deepEqual(G.playerZones['0']!.victory, [BYSTANDER_A]);
    assert.deepEqual(G.ko, []);
    assert.ok(logged(G, "Hunted for Victims: a Bystander held by Hand Ninjas (Bank) was rescued instead of KO'd."));
    assert.equal(G.pendingSeatChoice?.kind, HUNT_FOR_VICTIMS_KO_HERO_SEAT_CHOICE_KIND);
  });

  it('without another Tech Hero the rescue line is blocked by its gate and no rescue rows appear', () => {
    const G = makeState();
    G.escapedPile = [BYSTANDER_EXT_ID];
    playCard(G, STALK);
    assert.deepEqual(labels(G), ['KO a Bystander from the Escape Pile', DECLINE_HUNT]);
    assert.ok(
      G.messages.some(
        (message) => message.outcome === 'blocked' && message.text.startsWith(`Player 0's Stalk the Night Stalkers (${STALK})`),
      ),
      'the Tech line logs its own blocked gate line',
    );
    assert.equal(G.messages.some((message) => message.text.includes('not supported yet')), false, 'the gate body is not hollow');
    assert.equal(G.pendingSeatChoice?.huntForVictims?.isRescueAllowed, undefined);
  });
});

describe('Hunt for Victims capture (RS-4)', () => {
  it('choosing the Mastermind appends the top supply Bystander to it, with no mirror copy and no Hero pick', () => {
    const G = makeState();
    G.city[0] = NINJAS_A;
    G.playerZones['0']!.discard = [SHIELD_AGENT_EXT_ID];
    playCard(G, STALK);
    choose(G, indexOf(G, 'Zarathos captures a Bystander'));
    assert.deepEqual(G.mastermind.attachedBystanders, [BYSTANDER_A]);
    assert.deepEqual(G.piles.bystanders, [BYSTANDER_B, BYSTANDER_C]);
    assert.deepEqual(G.attachedBystanders, {});
    assert.equal(G.pendingSeatChoice, undefined, 'a capture opens no Hero pick');
    assert.ok(logged(G, 'Hunted for Victims: no Bystander to KO, so Zarathos captured a Bystander.'));
  });

  it('choosing a City Villain attaches the top supply Bystander to it', () => {
    const G = makeState();
    G.city[0] = NINJAS_A;
    playCard(G, STALK);
    choose(G, indexOf(G, 'Hand Ninjas (Sewers) captures a Bystander'));
    assert.deepEqual(G.attachedBystanders[NINJAS_A], [BYSTANDER_A]);
    assert.ok(logged(G, 'no Bystander to KO, so Hand Ninjas (Sewers) captured a Bystander.'));
  });

  it('decline does nothing and opens nothing', () => {
    const G = makeState();
    G.escapedPile = [BYSTANDER_EXT_ID];
    playCard(G, STALK);
    choose(G, indexOf(G, DECLINE_HUNT));
    assert.equal(G.pendingSeatChoice, undefined);
    assert.deepEqual(G.escapedPile, [BYSTANDER_EXT_ID]);
    assert.ok(logged(G, 'Player 0 chose not to Hunt for Victims.'));
  });
});

describe('Hunt for Victims guards (RS-1 / RS-7)', () => {
  it('RS-1: no Bystander anywhere and an empty supply parks nothing and logs why', () => {
    const G = makeState();
    G.piles.bystanders = [];
    G.city[0] = NINJAS_A;
    playCard(G, STALK);
    assert.equal(G.pendingSeatChoice, undefined);
    assert.ok(logged(G, `Player 0's Stalk the Night Stalkers (${STALK}) found no Bystander to Hunt for Victims, and the Bystander supply is empty.`));
  });

  it('RS-1: an open seat choice is never overwritten, and the Tech line is a silent no-op', () => {
    const G = makeState();
    G.escapedPile = [BYSTANDER_EXT_ID];
    const openChoice = {
      kind: 'generic',
      addressedSeats: ['0'],
      seatPrompts: { '0': { options: [{ label: 'Open' }] } },
      submissions: {},
      defaultOptionIndex: 0,
    };
    G.pendingSeatChoice = structuredClone(openChoice);
    playCard(G, TECH_HERO);
    playCard(G, STALK);
    assert.deepEqual(G.pendingSeatChoice, openChoice);
    assert.ok(logged(G, 'Player 0 could not Hunt for Victims — another choice is open.'));
  });

  it('RS-7: a City option whose Villain lost its Bystander is a logged no-op with no Hero pick', () => {
    const G = makeState();
    G.city[1] = NINJAS_A;
    G.attachedBystanders = { [NINJAS_A]: [BYSTANDER_A] };
    G.playerZones['0']!.discard = [SHIELD_AGENT_EXT_ID];
    playCard(G, STALK);
    G.attachedBystanders = {};
    choose(G, 0);
    assert.deepEqual(G.ko, []);
    assert.equal(G.pendingSeatChoice, undefined);
    assert.ok(logged(G, 'could not Hunt for Victims — that Bystander is no longer there.'));
  });

  it('RS-7: a City option whose space now holds a different Villain moves nothing (ko and capture)', () => {
    const G = makeState();
    G.city[1] = NINJAS_A;
    G.attachedBystanders = { [NINJAS_A]: [BYSTANDER_A], [SKRULL]: [BYSTANDER_B] };
    playCard(G, STALK);
    G.city[1] = SKRULL;
    choose(G, 0);
    assert.deepEqual(G.ko, []);
    assert.deepEqual(G.attachedBystanders, { [NINJAS_A]: [BYSTANDER_A], [SKRULL]: [BYSTANDER_B] });
    assert.equal(G.pendingSeatChoice, undefined);

    const H = makeState();
    H.city[1] = NINJAS_A;
    playCard(H, STALK);
    H.city[1] = SKRULL;
    choose(H, indexOf(H, 'Hand Ninjas (Bank) captures a Bystander'));
    assert.deepEqual(H.attachedBystanders, {});
    assert.deepEqual(H.piles.bystanders, [BYSTANDER_A, BYSTANDER_B, BYSTANDER_C]);
    assert.ok(logged(H, 'could not Hunt for Victims — that Villain is no longer there.'));
  });
});

describe('Hunt for Victims KO-a-Hero pick (RS-6)', () => {
  it('a S.H.I.E.L.D. Agent in hand and discard gives two options; the discard pick KOs only that copy and records an owned KO', () => {
    const G = makeState();
    G.escapedPile = [BYSTANDER_EXT_ID];
    G.playerZones['0']!.hand = [SHIELD_AGENT_EXT_ID, WOUND_EXT_ID];
    G.playerZones['0']!.discard = [SHIELD_AGENT_EXT_ID, WOUND_EXT_ID];
    // why: the owned-KO count is written only while a grant that reads it is waiting.
    G.heroAbilityHooks = [
      ...G.heroAbilityHooks,
      { cardId: 'test/owned-reader#0', timing: 'onPlay', keywords: ['conditional'], conditions: [{ type: OWNED_CARD_KOED_CONDITION_TYPE, value: '1' }], effects: [] } as unknown as HeroAbilityHook,
    ];
    G.deferredConditionalGrants = [{ playerId: '0', cardId: 'test/owned-reader#0', hookIndex: G.heroAbilityHooks.length - 1 }];
    playCard(G, STALK);
    choose(G, 0);
    assert.deepEqual(labels(G), ['KO S.H.I.E.L.D. Agent (discard pile)', 'KO S.H.I.E.L.D. Agent (hand)', "Don't KO a Hero"]);
    choose(G, indexOf(G, 'KO S.H.I.E.L.D. Agent (discard pile)'));
    assert.deepEqual(G.playerZones['0']!.discard, [WOUND_EXT_ID]);
    assert.deepEqual(G.playerZones['0']!.hand, [SHIELD_AGENT_EXT_ID, WOUND_EXT_ID], 'the hand copy stays');
    assert.deepEqual(G.ko, [BYSTANDER_EXT_ID, SHIELD_AGENT_EXT_ID]);
    assert.deepEqual(G.ownedCardsKoedSinceResolve, { '0': 1 });
    assert.ok(logged(G, `Player 0 KO'd S.H.I.E.L.D. Agent from their discard pile for Stalk the Night Stalkers (${STALK}).`));
    assert.equal(G.pendingSeatChoice, undefined);
  });

  it('decline KOs nothing', () => {
    const G = makeState();
    G.escapedPile = [BYSTANDER_EXT_ID];
    G.playerZones['0']!.hand = [HERO_A];
    playCard(G, STALK);
    choose(G, 0);
    choose(G, indexOf(G, "Don't KO a Hero"));
    assert.deepEqual(G.playerZones['0']!.hand, [HERO_A]);
    assert.deepEqual(G.ko, [BYSTANDER_EXT_ID]);
    assert.ok(logged(G, 'Player 0 chose not to KO a Hero.'));
  });

  it('an empty hand and discard pile after a Bystander KO opens no pick and says so', () => {
    const G = makeState();
    G.escapedPile = [BYSTANDER_EXT_ID];
    G.playerZones['0']!.hand = [WOUND_EXT_ID];
    playCard(G, STALK);
    choose(G, 0);
    assert.equal(G.pendingSeatChoice, undefined);
    assert.ok(logged(G, `Player 0 had no Hero in hand or discard pile to KO for Stalk the Night Stalkers (${STALK}).`));
  });

  it('RS-7: a Hero that left its zone is a logged no-op with no owned-KO record', () => {
    const G = makeState();
    chainHuntForVictimsKoHero(G, '0', STALK);
    assert.equal(G.pendingSeatChoice, undefined, 'nothing to KO yet');
    G.playerZones['0']!.discard = [HERO_A];
    chainHuntForVictimsKoHero(G, '0', STALK);
    G.playerZones['0']!.discard = [];
    choose(G, 0);
    assert.deepEqual(G.ko, []);
    assert.equal(Object.hasOwn(G, 'ownedCardsKoedSinceResolve'), false);
    assert.ok(logged(G, 'could not KO test/hero/a#0 — it is no longer in their discard pile'));
  });
});

describe('Hunt for Victims bots, timeout and serialization (D-24745 / D-24501)', () => {
  it('a playing bot rescues from the Escape Pile, else KOs from it, else takes another rescue, else declines', () => {
    const G = makeState();
    G.city[1] = NINJAS_A;
    G.attachedBystanders = { [NINJAS_A]: [BYSTANDER_A] };
    G.escapedPile = [BYSTANDER_EXT_ID];
    playCard(G, TECH_HERO);
    playCard(G, STALK);
    assert.equal(choosePlayingSeatChoiceOption(G, '0'), indexOf(G, 'Rescue a Bystander from the Escape Pile'));

    const noTech = makeState();
    noTech.city[1] = NINJAS_A;
    noTech.attachedBystanders = { [NINJAS_A]: [BYSTANDER_A] };
    noTech.escapedPile = [BYSTANDER_EXT_ID];
    playCard(noTech, STALK);
    assert.equal(choosePlayingSeatChoiceOption(noTech, '0'), indexOf(noTech, 'KO a Bystander from the Escape Pile'));

    const cityOnly = makeState();
    cityOnly.city[1] = NINJAS_A;
    cityOnly.attachedBystanders = { [NINJAS_A]: [BYSTANDER_A] };
    playCard(cityOnly, TECH_HERO);
    playCard(cityOnly, STALK);
    assert.equal(choosePlayingSeatChoiceOption(cityOnly, '0'), indexOf(cityOnly, 'Rescue a Bystander held by Hand Ninjas (Bank)'));

    const capture = makeState();
    capture.city[0] = NINJAS_A;
    playCard(capture, STALK);
    assert.equal(choosePlayingSeatChoiceOption(capture, '0'), indexOf(capture, DECLINE_HUNT), 'never a capture');

    const villainKoOnly = makeState();
    villainKoOnly.mastermind.attachedBystanders = [BYSTANDER_A];
    playCard(villainKoOnly, STALK);
    assert.equal(choosePlayingSeatChoiceOption(villainKoOnly, '0'), indexOf(villainKoOnly, DECLINE_HUNT), 'never a Mastermind KO');
  });

  it('a playing bot KOs a 0-cost Hero, else declines; getLegalMoves keeps the decline default', () => {
    const G = makeState();
    G.escapedPile = [BYSTANDER_EXT_ID, BYSTANDER_EXT_ID];
    G.cardStats = { [HERO_A]: { attack: 0, recruit: 0, cost: 5, fightCost: 0 }, [SHIELD_AGENT_EXT_ID]: { attack: 0, recruit: 1, cost: 0, fightCost: 0 } };
    G.playerZones['0']!.hand = [HERO_A, SHIELD_AGENT_EXT_ID];
    playCard(G, STALK);
    const huntMoves = getLegalMoves(G, { phase: 'play', turn: 1, currentPlayer: '0', numPlayers: 2 });
    assert.deepEqual(huntMoves, [{ name: 'resolveSeatChoice', args: { optionIndex: labels(G).length - 1 } }]);
    choose(G, 0);
    assert.equal(choosePlayingSeatChoiceOption(G, '0'), indexOf(G, 'KO S.H.I.E.L.D. Agent (hand)'));
    const koMoves = getLegalMoves(G, { phase: 'play', turn: 1, currentPlayer: '0', numPlayers: 2 });
    assert.deepEqual(koMoves, [{ name: 'resolveSeatChoice', args: { optionIndex: indexOf(G, "Don't KO a Hero") } }]);

    const expensive = makeState();
    expensive.escapedPile = [BYSTANDER_EXT_ID];
    expensive.cardStats = { [HERO_A]: { attack: 0, recruit: 0, cost: 5, fightCost: 0 } };
    expensive.playerZones['0']!.hand = [HERO_A];
    playCard(expensive, STALK);
    choose(expensive, 0);
    assert.equal(choosePlayingSeatChoiceOption(expensive, '0'), indexOf(expensive, "Don't KO a Hero"));
  });

  it('the timeout default declines the hunt and parks nothing', () => {
    const G = makeState();
    G.escapedPile = [BYSTANDER_EXT_ID];
    G.playerZones['0']!.hand = [HERO_A];
    playCard(G, STALK);
    applySeatChoiceTimeoutDefault(G, ['0']);
    assert.equal(G.pendingSeatChoice, undefined);
    assert.deepEqual(G.escapedPile, [BYSTANDER_EXT_ID]);
    assert.ok(logged(G, 'Player 0 chose not to Hunt for Victims.'));
  });

  it('a parked hunt choice with isRescueAllowed survives a JSON round-trip unchanged', () => {
    const G = makeState();
    G.escapedPile = [BYSTANDER_EXT_ID];
    playCard(G, TECH_HERO);
    playCard(G, STALK);
    const choice = G.pendingSeatChoice;
    assert.equal(choice?.huntForVictims?.isRescueAllowed, true);
    assert.deepEqual(JSON.parse(JSON.stringify(choice)), choice);
  });
});
