/**
 * Lilin Ambush "Hunt for Victims" — Skinner, Meatmarket and Blackout (WP-889 / D-24841).
 *
 * Their printed "Ambush: [keyword:Hunt for Victims]" did nothing and logged an `unmarked-ability`
 * hollow. These tests build the REAL villain hooks from the committed data/cards/mdns.json, reveal
 * through the real revealVillainCard (and a chained performVillainReveal for the same-move cases),
 * and resolve through the real resolveSeatChoice, so they pin the parse, the holder options, the
 * default target, the stale re-resolve, Blackout's Moonlight repeat chain and the Ambush overlay
 * together.
 *
 * No boardgame.io imports. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildVillainAbilityHooks } from '../setup/villainAbility.setup.js';
import { resolveSeatChoice, applySeatChoiceTimeoutDefault } from './seatChoice.resolve.js';
import { performVillainReveal, revealVillainCard } from '../villainDeck/villainDeck.reveal.js';
import { DEFAULT_IMPLEMENTATION_MAP } from '../rules/ruleRuntime.impl.js';
import { getLegalMoves } from '../simulation/ai.legalMoves.js';
import { choosePlayingSeatChoiceOption } from '../simulation/ai.seatChoice.js';
import { huntForVictimsForVillain, VILLAIN_HUNT_FOR_VICTIMS_SEAT_CHOICE_KIND } from './huntForVictims.logic.js';
import { BYSTANDER_EXT_ID } from '../setup/pilesInit.js';
import type { LegendaryGameState, MatchConfiguration } from '../types.js';
import type { VillainAbilityHook } from '../rules/villainAbility.types.js';
import type { CardExtId } from '../state/zones.types.js';
import {
  makeGlobalPiles,
  makeMastermindState,
  makePlayerZones,
  makeTurnEconomy,
} from '../test/fixtureBuilders.js';
import { makeMockMoveContext } from '../test/mockMoveContext.js';

const CARDS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'data', 'cards');

const SKINNER = 'mdns-villain-lilin-skinner-00' as CardExtId;
const MEATMARKET = 'mdns-villain-lilin-meatmarket-00' as CardExtId;
const BLACKOUT = 'mdns-villain-lilin-blackout-00' as CardExtId;
const OUTCAST = 'mdns-villain-lilin-outcast-00' as CardExtId;
const SISTER_NIL = 'mdns-villain-lilin-sister-nil-00' as CardExtId;
const NINJAS = 'test/villain/hand-ninjas#0' as CardExtId;
const THUG = 'test/villain/thug#0' as CardExtId;
const ESCAPED_VILLAIN = 'test/villain/escaped#0' as CardExtId;
const FILLER_A = 'test/villain/filler#0' as CardExtId;
const FILLER_B = 'test/villain/filler#1' as CardExtId;
const FILLER_C = 'test/villain/filler#2' as CardExtId;
const MASTERMIND = 'test-mastermind-001' as CardExtId;
const BYSTANDER_A = 'test/bystander/a#0' as CardExtId;
const BYSTANDER_B = 'test/bystander/b#0' as CardExtId;
const BYSTANDER_C = 'test/bystander/c#0' as CardExtId;
const BYSTANDER_D = 'test/bystander/d#0' as CardExtId;
const HERO_ODD_A = 'test/hero/odd-a#0' as CardExtId;
const HERO_ODD_B = 'test/hero/odd-b#0' as CardExtId;
const HERO_EVEN = 'test/hero/even#0' as CardExtId;

const SKINNER_REF = `Skinner (${SKINNER})`;
const BLACKOUT_REF = `Blackout (${BLACKOUT})`;
const HEADING_KIND = 'villain-hunt-for-victims';

const mockCtx = {
  ctx: { turn: 1, currentPlayer: '0', numPlayers: 2 },
  random: { Shuffle: <T>(items: T[]): T[] => [...items].reverse() },
};

/**
 * Builds the real Lilin villain hooks from the committed card data.
 *
 * @returns Every hook the Lilin group produces.
 */
function buildHooks(): VillainAbilityHook[] {
  const sets: Record<string, unknown> = {
    mdns: JSON.parse(readFileSync(join(CARDS_DIRECTORY, 'mdns.json'), 'utf8')),
  };
  const registry = { listCards: () => [], getSet: (abbr: string) => sets[abbr] };
  return buildVillainAbilityHooks(registry, { villainGroupIds: ['mdns/lilin'], henchmanGroupIds: [] } as unknown as MatchConfiguration);
}

const REAL_HOOKS = buildHooks();

/**
 * A two-seat state wide enough for a reveal, the villain executor and the seat-choice resolve.
 *
 * @returns A LegendaryGameState sufficient for these tests (HQ empty: neither Sunlight nor Moonlight).
 */
function makeState(): LegendaryGameState {
  return {
    currentStage: 'start',
    messages: [],
    counters: {},
    hookRegistry: [],
    turnEconomy: { ...makeTurnEconomy() },
    playerZones: { '0': { ...makePlayerZones() }, '1': { ...makePlayerZones() } },
    piles: makeGlobalPiles({ bystanders: [BYSTANDER_A, BYSTANDER_B, BYSTANDER_C] }),
    mastermind: makeMastermindState(),
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: {
      [SKINNER]: 'villain',
      [MEATMARKET]: 'villain',
      [BLACKOUT]: 'villain',
      [OUTCAST]: 'villain',
      [SISTER_NIL]: 'villain',
      [NINJAS]: 'villain',
      [THUG]: 'villain',
      [ESCAPED_VILLAIN]: 'villain',
      [FILLER_A]: 'villain',
      [FILLER_B]: 'villain',
      [FILLER_C]: 'villain',
      [BYSTANDER_A]: 'bystander',
      [BYSTANDER_B]: 'bystander',
      [BYSTANDER_C]: 'bystander',
      [BYSTANDER_D]: 'bystander',
    },
    city: [null, null, null, null, null],
    hq: [null, null, null, null, null],
    heroDeck: [],
    escapedPile: [],
    ko: [],
    attachedBystanders: {},
    scheme: { twistPile: [] },
    // why: an escape reads the scheme's escaped-pile loss config; a test scheme has none.
    selection: { schemeId: 'test/scheme', mastermindId: 'test/mastermind', villainGroupIds: ['mdns/lilin'], henchmanGroupIds: [], heroDeckIds: [] },
    heroAbilityHooks: [],
    villainAbilityHooks: [...REAL_HOOKS],
    cardStats: {
      [HERO_ODD_A]: { attack: 0, recruit: 0, cost: 3, fightCost: 0 },
      [HERO_ODD_B]: { attack: 0, recruit: 0, cost: 5, fightCost: 0 },
      [HERO_EVEN]: { attack: 0, recruit: 0, cost: 4, fightCost: 0 },
    },
    cardTraits: {},
    cardKeywords: {
      [SKINNER]: ['ambush'],
      [MEATMARKET]: ['ambush'],
      [BLACKOUT]: ['ambush'],
      [OUTCAST]: ['ambush'],
      [SISTER_NIL]: ['ambush'],
    },
    cardDisplayData: {
      [SKINNER]: { name: 'Skinner', imageUrl: '', cost: 0 },
      [MEATMARKET]: { name: 'Meatmarket', imageUrl: '', cost: 0 },
      [BLACKOUT]: { name: 'Blackout', imageUrl: '', cost: 0 },
      [OUTCAST]: { name: 'Outcast', imageUrl: '', cost: 0 },
      [SISTER_NIL]: { name: 'Sister Nil', imageUrl: '', cost: 0 },
      [NINJAS]: { name: 'Hand Ninjas', imageUrl: '', cost: 0 },
      [THUG]: { name: 'Thug', imageUrl: '', cost: 0 },
      [MASTERMIND]: { name: 'Zarathos', imageUrl: '', cost: 0 },
    },
    notableEvents: [],
  } as unknown as LegendaryGameState;
}

/**
 * Stages the HQ: odd costs outnumber even (Moonlight), even outnumber odd (Sunlight), or empty.
 *
 * @param G - The game state.
 * @param light - The day / night state to stage.
 */
function stageLight(G: LegendaryGameState, light: 'moonlight' | 'sunlight' | 'neither'): void {
  if (light === 'moonlight') {
    G.hq = [HERO_ODD_A, HERO_ODD_B, HERO_EVEN, null, null] as LegendaryGameState['hq'];
  } else if (light === 'sunlight') {
    G.hq = [HERO_EVEN, HERO_EVEN, HERO_ODD_A, null, null] as LegendaryGameState['hq'];
  } else {
    G.hq = [null, null, null, null, null] as LegendaryGameState['hq'];
  }
}

/**
 * Reveals a card as player 0's start-of-turn Villain Deck reveal (the real move).
 *
 * @param G - The game state.
 * @param cardId - The card to put on top of the Villain Deck and reveal.
 */
function reveal(G: LegendaryGameState, cardId: CardExtId): void {
  G.currentStage = 'start';
  G.villainDeck.deck = [cardId];
  revealVillainCard(makeMockMoveContext(G, { numPlayers: 2 }) as never);
}

/**
 * Plays a card from the Villain Deck the way a chained effect does (same move, no guards).
 *
 * @param G - The game state.
 * @param cardId - The card to put on top of the Villain Deck and play.
 */
function chainedReveal(G: LegendaryGameState, cardId: CardExtId): void {
  G.villainDeck.deck = [cardId];
  performVillainReveal(G, { random: mockCtx.random, ctx: { currentPlayer: '0', turn: 1 } }, DEFAULT_IMPLEMENTATION_MAP);
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
 * The log lines with their outcomes.
 *
 * @param G - The game state.
 * @returns "outcome: text" lines.
 */
function logLines(G: LegendaryGameState): string[] {
  return G.messages.map((message) => `${message.outcome}: ${message.text}`);
}

/**
 * Whether a log line with exactly this outcome and text exists.
 *
 * @param G - The game state.
 * @param outcome - The expected outcome.
 * @param text - The exact text.
 * @returns true when present.
 */
function loggedExactly(G: LegendaryGameState, outcome: string, text: string): boolean {
  return logLines(G).includes(`${outcome}: ${text}`);
}

/**
 * The `unmarked-ability` hollow records for a card.
 *
 * @param G - The game state.
 * @param cardId - The card.
 * @returns The matching records' count.
 */
function unmarkedHollows(G: LegendaryGameState, cardId: CardExtId): number {
  let count = 0;
  for (const record of G.diagnostics?.hollowEffects ?? []) {
    if (record.cardId === cardId && record.mechanic === 'unmarked-ability') {
      count += 1;
    }
  }
  return count;
}

/**
 * The last ambushResolved event.
 *
 * @param G - The game state.
 * @returns Its narrative and appliedEffects.
 */
function lastAmbush(G: LegendaryGameState): { narrative: string; appliedEffects: unknown } {
  for (let eventIndex = G.notableEvents.length - 1; eventIndex >= 0; eventIndex--) {
    const event = G.notableEvents[eventIndex] as unknown as { type: string; narrative: string; appliedEffects: unknown };
    if (event.type === 'ambushResolved') {
      return event;
    }
  }
  assert.fail('no ambushResolved event');
}

describe('Lilin Hunt for Victims parse (WP-889 AC-1)', () => {
  it('Skinner, Meatmarket and Blackout parse to onAmbush hunt descriptors; Outcast and Sister Nil stay unmarked', () => {
    const ambushEffects: Record<string, unknown> = {};
    for (const hook of REAL_HOOKS) {
      if (hook.timing === 'onAmbush' && hook.cardId.endsWith('-00')) {
        ambushEffects[hook.cardId] = hook.effects;
        assert.deepEqual(hook.unresolvedMarkers ?? [], [], `${hook.cardId} has no unresolved marker`);
      }
    }
    assert.deepEqual(ambushEffects, {
      [BLACKOUT]: [{ primitive: 'villain-hunt-for-victims' }, { primitive: 'villain-hunt-for-victims', requireCondition: 'moonlight' }],
      [MEATMARKET]: [{ primitive: 'villain-hunt-for-victims' }],
      [OUTCAST]: [],
      [SISTER_NIL]: [],
      [SKINNER]: [{ primitive: 'villain-hunt-for-victims' }],
    });
  });

  it('revealing Skinner records no unmarked-ability hollow; Outcast and Sister Nil still do (AC-1 / AC-7)', () => {
    const G = makeState();
    reveal(G, SKINNER);
    assert.equal(unmarkedHollows(G, SKINNER), 0);
    const outcast = makeState();
    reveal(outcast, OUTCAST);
    assert.equal(unmarkedHollows(outcast, OUTCAST), 1);
    const sisterNil = makeState();
    reveal(sisterNil, SISTER_NIL);
    assert.equal(unmarkedHollows(sisterNil, SISTER_NIL), 1);
  });
});

describe('Villain Hunt for Victims with no holder or one holder (RS-1 / AC-2 / AC-3)', () => {
  it('no holder: Skinner captures the top supply Bystander (L2), and the overlay names the hunt (AC-11)', () => {
    const G = makeState();
    reveal(G, SKINNER);
    assert.deepEqual(G.attachedBystanders[SKINNER], [BYSTANDER_A]);
    assert.deepEqual(G.piles.bystanders, [BYSTANDER_B, BYSTANDER_C]);
    assert.equal(G.pendingSeatChoice, undefined);
    assert.ok(loggedExactly(G, 'applied', `${SKINNER_REF} Hunted for Victims: no Bystander to KO, so it captured a Bystander.`));
    const ambush = lastAmbush(G);
    assert.equal(ambush.narrative, '"Skinner" ambushed: it Hunts for Victims.');
    assert.deepEqual(ambush.appliedEffects, [], 'a keyword-less descriptor adds no applied effect (AC-7)');
  });

  it('no holder and an empty supply: nothing moves and L3 is logged', () => {
    const G = makeState();
    G.piles.bystanders = [];
    reveal(G, MEATMARKET);
    assert.equal(Object.hasOwn(G.attachedBystanders, MEATMARKET), false);
    assert.deepEqual(G.ko, []);
    assert.ok(loggedExactly(G, 'blocked', `Meatmarket (${MEATMARKET}) found no Bystander to Hunt for Victims, and the Bystander supply is empty.`));
  });

  it('no holder and the Villain no longer in the City: L4, nothing captured', () => {
    const G = makeState();
    huntForVictimsForVillain(G, '0', SKINNER);
    assert.deepEqual(G.piles.bystanders, [BYSTANDER_A, BYSTANDER_B, BYSTANDER_C]);
    assert.ok(loggedExactly(G, 'blocked', `${SKINNER_REF} could not capture a Bystander — it is not in the City.`));
  });

  it('one holder (the Mastermind, with its mirror copy): its last Bystander is KO\'d with no prompt, mirror removed (L1)', () => {
    const G = makeState();
    G.mastermind = { ...G.mastermind, attachedBystanders: [BYSTANDER_C, BYSTANDER_D] };
    G.attachedBystanders = { [MASTERMIND]: [BYSTANDER_D] };
    reveal(G, SKINNER);
    assert.equal(G.pendingSeatChoice, undefined);
    assert.deepEqual(G.mastermind.attachedBystanders, [BYSTANDER_C]);
    assert.equal(Object.hasOwn(G.attachedBystanders, MASTERMIND), false);
    assert.deepEqual(G.ko, [BYSTANDER_D]);
    assert.ok(loggedExactly(G, 'applied', `${SKINNER_REF} Hunted for Victims: a Bystander held by Zarathos was KO'd.`));
  });

  it('one holder (the Escape Pile): the escaped Bystander is KO\'d, the escaped Villain stays', () => {
    const G = makeState();
    G.escapedPile = [ESCAPED_VILLAIN, BYSTANDER_EXT_ID];
    reveal(G, SKINNER);
    assert.deepEqual(G.escapedPile, [ESCAPED_VILLAIN]);
    assert.deepEqual(G.ko, [BYSTANDER_EXT_ID]);
    assert.ok(loggedExactly(G, 'applied', `${SKINNER_REF} Hunted for Victims: a Bystander in the Escape Pile was KO'd.`));
  });
});

describe('Villain Hunt for Victims choice (RS-1 / RS-3 / AC-4)', () => {
  it('two holders park a mandatory choice for the active seat, default the Escape Pile (L5)', () => {
    const G = makeState();
    G.city[0] = NINJAS;
    G.attachedBystanders = { [NINJAS]: [BYSTANDER_C] };
    G.escapedPile = [BYSTANDER_EXT_ID];
    reveal(G, SKINNER);
    assert.equal(G.pendingSeatChoice?.kind, VILLAIN_HUNT_FOR_VICTIMS_SEAT_CHOICE_KIND);
    assert.equal(G.pendingSeatChoice?.kind, HEADING_KIND);
    assert.deepEqual(G.pendingSeatChoice?.addressedSeats, ['0']);
    assert.deepEqual(labels(G), ['KO a Bystander held by Hand Ninjas (Bank)', 'KO a Bystander from the Escape Pile'], 'no decline');
    assert.equal(G.pendingSeatChoice?.defaultOptionIndex, 1);
    assert.deepEqual(G.pendingSeatChoice?.huntForVictims, { sourceCardId: SKINNER });
    assert.ok(loggedExactly(G, 'neutral', `Player 0 must choose which Bystander ${SKINNER_REF} Hunts.`));
    assert.deepEqual(G.ko, [], 'nothing KO\'d before the pick');
  });

  it('choosing the City holder KOs its last Bystander (L1); the Escape Pile is untouched', () => {
    const G = makeState();
    G.city[0] = NINJAS;
    G.attachedBystanders = { [NINJAS]: [BYSTANDER_C, BYSTANDER_D] };
    G.escapedPile = [BYSTANDER_EXT_ID];
    reveal(G, SKINNER);
    choose(G, indexOf(G, 'KO a Bystander held by Hand Ninjas (Bank)'));
    assert.equal(G.pendingSeatChoice, undefined);
    assert.deepEqual(G.attachedBystanders[NINJAS], [BYSTANDER_C]);
    assert.deepEqual(G.ko, [BYSTANDER_D]);
    assert.deepEqual(G.escapedPile, [BYSTANDER_EXT_ID]);
    assert.ok(loggedExactly(G, 'applied', `${SKINNER_REF} Hunted for Victims: a Bystander held by Hand Ninjas (Bank) was KO'd.`));
  });

  it('without an Escape Pile Bystander the default is the first option; bots, autoplay and the timeout take it', () => {
    const G = makeState();
    G.city[0] = NINJAS;
    G.attachedBystanders = { [NINJAS]: [BYSTANDER_C] };
    G.mastermind = { ...G.mastermind, attachedBystanders: [BYSTANDER_D] };
    reveal(G, SKINNER);
    assert.deepEqual(labels(G), ['KO a Bystander held by Hand Ninjas (Bank)', 'KO a Bystander held by Zarathos']);
    assert.equal(G.pendingSeatChoice?.defaultOptionIndex, 0);
    assert.equal(choosePlayingSeatChoiceOption(G, '0'), 0, 'no bot arm: the default is the policy');
    const moves = getLegalMoves(G, { phase: 'play', turn: 1, currentPlayer: '0', numPlayers: 2 });
    assert.deepEqual(moves, [{ name: 'resolveSeatChoice', args: { optionIndex: 0 } }]);
    applySeatChoiceTimeoutDefault(G, ['0']);
    assert.equal(G.pendingSeatChoice, undefined);
    assert.deepEqual(G.ko, [BYSTANDER_C]);
    assert.deepEqual(G.mastermind.attachedBystanders, [BYSTANDER_D]);
  });

  it('a chained reveal after the park shifts the chosen City Villain; the pick still KOs from it (RS-3 re-locate)', () => {
    const G = makeState();
    G.city[0] = NINJAS;
    G.attachedBystanders = { [NINJAS]: [BYSTANDER_C] };
    G.escapedPile = [BYSTANDER_EXT_ID];
    reveal(G, SKINNER);
    chainedReveal(G, THUG);
    assert.equal(G.city[2], NINJAS, 'the chained reveal pushed Hand Ninjas from the Bank to the Rooftops');
    choose(G, indexOf(G, 'KO a Bystander held by Hand Ninjas (Bank)'));
    assert.equal(Object.hasOwn(G.attachedBystanders, NINJAS), false);
    assert.deepEqual(G.ko, [BYSTANDER_C]);
    assert.ok(loggedExactly(G, 'applied', `${SKINNER_REF} Hunted for Victims: a Bystander held by Hand Ninjas (Rooftops) was KO'd.`));
  });

  it('a chained reveal escapes the chosen City Villain: L7, then the default target is KO\'d (RS-3 stale)', () => {
    const G = makeState();
    // why: a push cascades only through occupied spaces, so the City is full up to Hand Ninjas:
    // Skinner's entry moves it to the Bridge and the chained reveal pushes it out.
    G.city = [FILLER_A, FILLER_B, FILLER_C, NINJAS, null] as LegendaryGameState['city'];
    G.attachedBystanders = { [NINJAS]: [BYSTANDER_C] };
    G.mastermind = { ...G.mastermind, attachedBystanders: [BYSTANDER_D] };
    reveal(G, SKINNER);
    const ninjasOption = indexOf(G, 'KO a Bystander held by Hand Ninjas (Bridge)');
    chainedReveal(G, THUG);
    assert.equal(G.city.indexOf(NINJAS), -1, 'Hand Ninjas escaped');
    choose(G, ninjasOption);
    assert.ok(loggedExactly(G, 'neutral', `${SKINNER_REF}'s chosen Bystander is no longer there, so it Hunts its default target.`));
    // why: the escape carried Hand Ninjas' Bystander to the Escape Pile, which is now the default.
    assert.deepEqual(G.ko, [BYSTANDER_C], 'exactly one Bystander KO\'d: the hunt is mandatory');
    assert.deepEqual(G.mastermind.attachedBystanders, [BYSTANDER_D]);
    assert.ok(loggedExactly(G, 'applied', `${SKINNER_REF} Hunted for Victims: a Bystander in the Escape Pile was KO'd.`));
    assert.equal(G.pendingSeatChoice, undefined, 'the re-resolve never parks');
  });

  it('a stale pick with no holder left re-resolves to a capture onto the Villain (L7 then L2)', () => {
    const G = makeState();
    G.city[0] = NINJAS;
    G.attachedBystanders = { [NINJAS]: [BYSTANDER_C] };
    G.mastermind = { ...G.mastermind, attachedBystanders: [BYSTANDER_D] };
    reveal(G, SKINNER);
    G.attachedBystanders = {};
    G.mastermind = { ...G.mastermind, attachedBystanders: [] };
    choose(G, 0);
    assert.ok(loggedExactly(G, 'neutral', `${SKINNER_REF}'s chosen Bystander is no longer there, so it Hunts its default target.`));
    assert.ok(loggedExactly(G, 'applied', `${SKINNER_REF} Hunted for Victims: no Bystander to KO, so it captured a Bystander.`));
    assert.deepEqual(G.attachedBystanders[SKINNER], [BYSTANDER_A]);
    assert.deepEqual(G.ko, []);
  });

  it('two holders while an unrelated seat choice is open: L6, the default is KO\'d, the open choice is untouched (AC-5)', () => {
    const G = makeState();
    G.currentStage = 'main';
    G.city[0] = NINJAS;
    G.attachedBystanders = { [NINJAS]: [BYSTANDER_C] };
    G.escapedPile = [BYSTANDER_EXT_ID];
    const openChoice = {
      kind: 'generic',
      addressedSeats: ['1'],
      seatPrompts: { '1': { options: [{ label: 'A' }, { label: 'B' }] } },
      submissions: {},
      defaultOptionIndex: 0,
    };
    G.pendingSeatChoice = JSON.parse(JSON.stringify(openChoice));
    chainedReveal(G, SKINNER);
    assert.deepEqual(G.pendingSeatChoice, openChoice);
    assert.deepEqual(G.ko, [BYSTANDER_EXT_ID]);
    assert.deepEqual(G.attachedBystanders[NINJAS], [BYSTANDER_C]);
    const lines = logLines(G);
    const collisionIndex = lines.indexOf(`neutral: ${SKINNER_REF} Hunted for Victims at its default target — another choice is open.`);
    const koIndex = lines.indexOf(`applied: ${SKINNER_REF} Hunted for Victims: a Bystander in the Escape Pile was KO'd.`);
    assert.ok(collisionIndex >= 0 && koIndex > collisionIndex, 'L6 then L1');
  });

  it('a parked choice with pendingRepeats survives a JSON round-trip unchanged', () => {
    const G = makeState();
    stageLight(G, 'moonlight');
    G.city[0] = NINJAS;
    G.attachedBystanders = { [NINJAS]: [BYSTANDER_C] };
    G.escapedPile = [BYSTANDER_EXT_ID];
    reveal(G, BLACKOUT);
    const choice = G.pendingSeatChoice;
    assert.deepEqual(choice?.huntForVictims, { sourceCardId: BLACKOUT, pendingRepeats: 1 });
    assert.deepEqual(JSON.parse(JSON.stringify(choice)), choice);
  });
});

describe('Blackout\'s Moonlight repeat (RS-2 / RS-3b / AC-6)', () => {
  it('Moonlight, no holder: the first hunt captures onto Blackout, the second KOs that Bystander', () => {
    const G = makeState();
    stageLight(G, 'moonlight');
    reveal(G, BLACKOUT);
    assert.equal(Object.hasOwn(G.attachedBystanders, BLACKOUT), false);
    assert.deepEqual(G.ko, [BYSTANDER_A]);
    assert.deepEqual(G.piles.bystanders, [BYSTANDER_B, BYSTANDER_C]);
    const lines = logLines(G);
    const captureIndex = lines.indexOf(`applied: ${BLACKOUT_REF} Hunted for Victims: no Bystander to KO, so it captured a Bystander.`);
    const koIndex = lines.indexOf(`applied: ${BLACKOUT_REF} Hunted for Victims: a Bystander held by Blackout (Sewers) was KO'd.`);
    assert.ok(captureIndex >= 0 && koIndex > captureIndex, 'capture, then the KO of the captured Bystander');
    assert.equal(lastAmbush(G).narrative, '"Blackout" ambushed: it Hunts for Victims.');
  });

  for (const light of ['sunlight', 'neither'] as const) {
    it(`${light}: Blackout hunts once and the second descriptor logs L8`, () => {
      const G = makeState();
      stageLight(G, light);
      reveal(G, BLACKOUT);
      assert.deepEqual(G.attachedBystanders[BLACKOUT], [BYSTANDER_A]);
      assert.deepEqual(G.ko, []);
      assert.ok(loggedExactly(G, 'blocked', 'Ambush effect: it is not Moonlight; no effect.'));
    });
  }

  it('Moonlight, two holders: the first parks, the second records a repeat (L9), then hunts after the pick', () => {
    const G = makeState();
    stageLight(G, 'moonlight');
    G.city[0] = NINJAS;
    G.attachedBystanders = { [NINJAS]: [BYSTANDER_C] };
    G.escapedPile = [BYSTANDER_EXT_ID];
    reveal(G, BLACKOUT);
    assert.equal(G.pendingSeatChoice?.huntForVictims?.pendingRepeats, 1);
    assert.ok(loggedExactly(G, 'neutral', `${BLACKOUT_REF} will Hunt for Victims again after this choice.`));
    assert.deepEqual(G.ko, [], 'the second hunt waits for the first pick');
    choose(G, indexOf(G, 'KO a Bystander held by Hand Ninjas (Bank)'));
    assert.deepEqual(G.ko, [BYSTANDER_C, BYSTANDER_EXT_ID], 'the second hunt saw the post-choice board: one holder left');
    assert.deepEqual(G.escapedPile, []);
    assert.equal(G.pendingSeatChoice, undefined);
  });

  it('Moonlight, holders with two Bystanders each: the repeat parks again with no repeats owed', () => {
    const G = makeState();
    stageLight(G, 'moonlight');
    G.city[0] = NINJAS;
    G.attachedBystanders = { [NINJAS]: [BYSTANDER_C, BYSTANDER_D] };
    G.escapedPile = [BYSTANDER_EXT_ID, BYSTANDER_EXT_ID];
    reveal(G, BLACKOUT);
    choose(G, indexOf(G, 'KO a Bystander from the Escape Pile'));
    assert.deepEqual(G.ko, [BYSTANDER_EXT_ID]);
    assert.equal(G.pendingSeatChoice?.kind, VILLAIN_HUNT_FOR_VICTIMS_SEAT_CHOICE_KIND);
    assert.deepEqual(G.pendingSeatChoice?.huntForVictims, { sourceCardId: BLACKOUT });
    choose(G, indexOf(G, 'KO a Bystander held by Hand Ninjas (Bank)'));
    assert.deepEqual(G.ko, [BYSTANDER_EXT_ID, BYSTANDER_D]);
    assert.equal(G.pendingSeatChoice, undefined);
  });
});

describe('Ambush overlay narrative for a non-hunt Ambush (RS-6 / AC-11)', () => {
  it('Outcast (unmarked) keeps the byte-identical "no Ambush effect" narrative', () => {
    const G = makeState();
    reveal(G, OUTCAST);
    assert.equal(lastAmbush(G).narrative, '"Outcast" entered the city with no Ambush effect.');
  });
});
