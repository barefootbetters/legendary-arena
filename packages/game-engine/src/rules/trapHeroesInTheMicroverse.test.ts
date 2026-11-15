/**
 * Trap Heroes in the Microverse (WP-863 / D-24805) — the last-listed Hero's cards as Micro-Sized
 * Villains: setup, Attack = printed cost, Size-Changing for the card color, "choose any player to
 * gain it", the two-card Twist and the "3 Villains per player escaped or the Villain Deck runs out"
 * Evil Wins.
 *
 * Builds full G from the shipped data/cards/antm.json and bkpt.json (read from the repo root, the
 * brainwashTheMilitary.test.ts precedent). bkpt King Black Panther is the trapped Hero because its
 * cards are dual-class.
 *
 * node:test + node:assert only. No boardgame.io import.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { checkNoCardInMultipleZones } from '../invariants/gameRules.checks.js';
import { SCHEME_TWIST_RESOLVERS } from './schemeTwistResolvers.js';
import { SCHEME_TWIST_CONFIGS } from './schemeTwistConfigs.js';
import { applyEscapedPileResourceLoss, applyPileDepletionResourceLoss } from './schemeResourceLoss.js';
import {
  isTwistLossSuppressed,
  resolveSchemeLossKind,
  resolveSchemeLossProgress,
  resolveSchemeLossThreshold,
} from './schemeLossProgress.js';
import {
  MICRO_SIZED_GAIN_SEAT_CHOICE_KIND,
  TRAP_HEROES_IN_THE_MICROVERSE_SCHEME_ID,
  addMicroSizedHeroesToVillainDeck,
  buildMicroSizedFightSizeChanging,
  splitTrappedHeroDeckId,
} from './trapHeroesInTheMicroverse.logic.js';
import { DEFAULT_IMPLEMENTATION_MAP } from './ruleRuntime.impl.js';
import { resolveFightCost, resolveFightPrice } from '../economy/economy.resolve.js';
import { defeatCityVillainCore } from '../moves/fightVillain.js';
import { resolveSeatChoice } from '../moves/seatChoice.resolve.js';
import { performVillainReveal } from '../villainDeck/villainDeck.reveal.js';
import { ENDGAME_CONDITIONS } from '../endgame/endgame.types.js';
import type { LegendaryGameState, PendingSeatChoice, SetupContext } from '../types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { RevealContext } from '../villainDeck/villainDeck.reveal.js';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Reads one shipped card set.
 *
 * @param abbr - The set abbreviation.
 * @returns The parsed set data.
 */
function loadSet(abbr: string): unknown {
  return JSON.parse(readFileSync(join(here, '..', '..', '..', '..', 'data', 'cards', `${abbr}.json`), 'utf8'));
}

const SETS: Record<string, unknown> = { antm: loadSet('antm'), bkpt: loadSet('bkpt') };

/** A setup registry over the real antm and bkpt sets (getSet / listSets; no flat card list). */
const REGISTRY = {
  listCards: () => [],
  listSets: () => [{ abbr: 'antm' }, { abbr: 'bkpt' }],
  getSet: (abbr: string) => SETS[abbr],
};

const TRAPPED_HERO_PREFIX = 'bkpt/king-black-panther/';
const OTHER_SCHEME_ID = 'antm/age-of-ultron';

/** A 6-Hero loadout whose LAST Hero (King Black Panther) is the trapped one. */
function buildConfig(schemeId: string = TRAP_HEROES_IN_THE_MICROVERSE_SCHEME_ID): MatchSetupConfig {
  return {
    schemeId,
    mastermindId: 'antm/ultron',
    villainGroupIds: ['antm/ultrons-legacy'],
    henchmanGroupIds: [],
    heroDeckIds: [
      'antm/ant-man',
      'antm/black-knight',
      'antm/jocasta',
      'antm/wasp',
      'antm/wonder-man',
      'bkpt/king-black-panther',
    ],
    bystandersCount: 1,
    woundsCount: 30,
    officersCount: 30,
    sidekicksCount: 0,
  };
}

/**
 * Builds G for the loadout.
 *
 * @param numPlayers - Seats in the match.
 * @param schemeId - The scheme under test.
 * @returns The built game state.
 */
function buildState(numPlayers: number = 2, schemeId?: string): LegendaryGameState {
  return buildInitialGameState(buildConfig(schemeId), REGISTRY as never, makeMockCtx({ numPlayers }));
}

/**
 * Counts every Shuffle call one setup build makes.
 *
 * @param schemeId - The scheme to build.
 * @returns How many times setup called Shuffle.
 */
function countSetupShuffles(schemeId: string): number {
  const mockCtx = makeMockCtx({ numPlayers: 2 });
  let shuffleCount = 0;
  const countingCtx: SetupContext = {
    ...mockCtx,
    random: {
      Shuffle: <T,>(deck: T[]): T[] => {
        shuffleCount = shuffleCount + 1;
        return mockCtx.random.Shuffle(deck);
      },
    },
  };
  buildInitialGameState(buildConfig(schemeId), REGISTRY as never, countingCtx);
  return shuffleCount;
}

const identityRandom = { Shuffle: <T,>(deck: T[]) => [...deck] };

/** A reveal context with an identity shuffle. */
function makeRevealContext(): RevealContext {
  return { random: identityRandom, ctx: { currentPlayer: '0', turn: 1 } };
}

/**
 * Lists the trapped (Micro-Sized) cards still carrying the origin.
 *
 * @param gameState - The game state.
 * @returns The Micro-Sized card ids.
 */
function microSizedCards(gameState: LegendaryGameState): CardExtId[] {
  const cardIds: CardExtId[] = [];
  for (const [cardId, origin] of Object.entries(gameState.convertedVillainOrigins ?? {})) {
    if (origin === 'micro-sized') {
      cardIds.push(cardId);
    }
  }
  return cardIds;
}

/**
 * Finds a trapped card by its card slug.
 *
 * @param gameState - The game state.
 * @param cardSlug - The King Black Panther card slug.
 * @returns The first copy's id.
 */
function trappedCard(gameState: LegendaryGameState, cardSlug: string): CardExtId {
  const cardId = microSizedCards(gameState).find((id) => id.startsWith(`${TRAPPED_HERO_PREFIX}${cardSlug}#`));
  if (cardId === undefined) {
    throw new Error(`No Micro-Sized ${cardSlug} is in the test Villain Deck; check the loadout.`);
  }
  return cardId;
}

/** Moves a Villain Deck card into a City space. */
function placeInCity(gameState: LegendaryGameState, cardId: CardExtId, cityIndex: number): void {
  gameState.villainDeck.deck = gameState.villainDeck.deck.filter((deckCardId) => deckCardId !== cardId);
  const city = [...gameState.city] as typeof gameState.city;
  city[cityIndex] = cardId;
  gameState.city = city;
}

/**
 * A played card id of the given class from the other Heroes (Hero Deck or HQ).
 *
 * @param gameState - The game state.
 * @param heroClass - The class wanted.
 * @returns A non-trapped Hero card with exactly that class.
 */
function heroCardOfClass(gameState: LegendaryGameState, heroClass: string): CardExtId {
  for (const cardId of [...gameState.heroDeck, ...gameState.hq]) {
    const traits = cardId === null ? undefined : gameState.cardTraits[cardId];
    if (cardId !== null && traits?.heroClass === heroClass && traits.heroClass2 === undefined) {
      return cardId;
    }
  }
  throw new Error(`No ${heroClass} Hero card is in the test Hero Deck; check the loadout.`);
}

/** The text of every log line. */
function logTexts(gameState: LegendaryGameState): string[] {
  return gameState.messages.map((entry) => entry.text);
}

/** A resolveSeatChoice move context for a submitting seat. */
function makeSeatResolveCtx(G: LegendaryGameState, playerID: string): Parameters<typeof resolveSeatChoice>[0] {
  return {
    G,
    playerID,
    ctx: { currentPlayer: '0', numPlayers: Object.keys(G.playerZones).length, turn: 2 },
    events: { setActivePlayers: () => undefined },
    random: identityRandom,
    log: {},
  } as unknown as Parameters<typeof resolveSeatChoice>[0];
}

describe('WP-863 Trap Heroes in the Microverse — setup (D-24805)', () => {
  it('M1: the last-listed Hero\'s 14 cards join the Villain Deck as Micro-Sized Villains, and only those', () => {
    const gameState = buildState();
    const trapped = microSizedCards(gameState);
    assert.equal(trapped.length, 14);
    for (const cardId of trapped) {
      assert.ok(cardId.startsWith(TRAPPED_HERO_PREFIX), cardId);
      assert.ok(gameState.villainDeck.deck.includes(cardId), cardId);
      assert.equal(gameState.villainDeckCardTypes[cardId], 'villain', cardId);
    }
    const heroZoneCards = [...gameState.heroDeck, ...gameState.hq];
    assert.equal(heroZoneCards.some((cardId) => cardId !== null && cardId.startsWith(TRAPPED_HERO_PREFIX)), false);
    assert.ok(heroZoneCards.some((cardId) => cardId !== null && cardId.startsWith('antm/wonder-man/')));
    const twistCount = gameState.villainDeck.deck.filter((cardId) => gameState.villainDeckCardTypes[cardId] === 'scheme-twist').length;
    assert.equal(twistCount, 11);
    assert.ok(logTexts(gameState).includes(
      "Trap Heroes in the Microverse: King Black Panther's 14 cards are shuffled into the Villain Deck as Micro-Sized Villains.",
    ));
    checkNoCardInMultipleZones(gameState);
  });

  it('M1: another scheme with the same loadout converts nothing and draws one Shuffle fewer', () => {
    const gameState = buildState(2, OTHER_SCHEME_ID);
    assert.equal(gameState.convertedVillainOrigins, undefined);
    assert.equal(Object.keys(gameState.villainDeckCardTypes).some((cardId) => cardId.startsWith(TRAPPED_HERO_PREFIX)), false);
    const heroZoneCards = [...gameState.heroDeck, ...gameState.hq];
    assert.ok(heroZoneCards.some((cardId) => cardId !== null && cardId.startsWith(TRAPPED_HERO_PREFIX)));
    assert.equal(logTexts(gameState).some((text) => text.startsWith('Trap Heroes in the Microverse')), false);
    assert.equal(countSetupShuffles(TRAP_HEROES_IN_THE_MICROVERSE_SCHEME_ID), countSetupShuffles(OTHER_SCHEME_ID) + 1);
  });

  it('M1: one Hero, another scheme or a registry with no getSet traps nothing', () => {
    assert.deepEqual(splitTrappedHeroDeckId(TRAP_HEROES_IN_THE_MICROVERSE_SCHEME_ID, ['antm/wasp'], REGISTRY), {
      heroDeckIds: ['antm/wasp'],
    });
    assert.deepEqual(splitTrappedHeroDeckId(OTHER_SCHEME_ID, ['antm/wasp', 'antm/jocasta'], REGISTRY), {
      heroDeckIds: ['antm/wasp', 'antm/jocasta'],
    });
    assert.deepEqual(splitTrappedHeroDeckId(TRAP_HEROES_IN_THE_MICROVERSE_SCHEME_ID, ['antm/wasp', 'antm/jocasta'], {}), {
      heroDeckIds: ['antm/wasp', 'antm/jocasta'],
    });
    assert.deepEqual(splitTrappedHeroDeckId(TRAP_HEROES_IN_THE_MICROVERSE_SCHEME_ID, ['antm/wasp', 'antm/jocasta'], REGISTRY), {
      heroDeckIds: ['antm/wasp'],
      trappedHeroDeckId: 'antm/jocasta',
    });
  });

  it('M1: two same-seed builds give the identical Villain Deck order', () => {
    // why: a difference means setup is not deterministic, which breaks replays of this scheme.
    assert.deepEqual(buildState().villainDeck.deck, buildState().villainDeck.deck);
  });

  it('M1: the conversion never mutates its inputs, and an empty list draws nothing', () => {
    const deckState = Object.freeze({ deck: Object.freeze(['v#0', 't#0']), discard: Object.freeze([]) }) as never;
    const cardTypes = Object.freeze({ 'v#0': 'villain', 't#0': 'scheme-twist' }) as never;
    const origins = Object.freeze({}) as never;
    let shuffleCount = 0;
    const context = { random: { Shuffle: <T,>(deck: T[]): T[] => { shuffleCount = shuffleCount + 1; return [...deck].reverse(); } } };
    const result = addMicroSizedHeroesToVillainDeck(['h#0'], deckState, cardTypes, origins, context);
    assert.deepEqual(result.villainDeckState.deck, ['h#0', 't#0', 'v#0']);
    assert.equal(result.villainDeckCardTypes['h#0'], 'villain');
    assert.equal(result.convertedOrigins['h#0'], 'micro-sized');
    assert.deepEqual(deckState, { deck: ['v#0', 't#0'], discard: [] });
    assert.deepEqual(origins, {});
    assert.equal(shuffleCount, 1);
    const passthrough = addMicroSizedHeroesToVillainDeck([], deckState, cardTypes, origins, context);
    assert.equal(passthrough.villainDeckState, deckState);
    assert.equal(shuffleCount, 1, 'no draw for an empty list');
  });

  it('M5: no ability, keyword or defeat requirement is keyed by a trapped card', () => {
    const gameState = buildState();
    for (const cardId of microSizedCards(gameState)) {
      assert.equal(gameState.villainAbilityHooks.some((hook) => hook.cardId === cardId), false, cardId);
      assert.equal((gameState.cardKeywords[cardId] ?? []).length, 0, cardId);
      assert.equal(gameState.villainDefeatRequirements?.[cardId], undefined, cardId);
      assert.equal(gameState.villainVariableAttack?.[cardId], undefined, cardId);
    }
  });
});

describe('WP-863 Trap Heroes in the Microverse — Attack and Size-Changing (D-24805)', () => {
  it('M3: Attack is the printed cost', () => {
    const gameState = buildState();
    for (const cardId of microSizedCards(gameState)) {
      placeInCity(gameState, cardId, 0);
      assert.equal(resolveFightCost(gameState, cardId, '0'), gameState.cardStats[cardId]!.cost, cardId);
    }
  });

  it('M4: a dual-class card has Size-Changing for both colors, each its own 2-less step, floored at 0', () => {
    const gameState = buildState();
    // King Black Panther "Unite the Tribes of Wakanda" is Strength / Ranged.
    const cardId = trappedCard(gameState, 'unite-the-tribes-of-wakanda');
    placeInCity(gameState, cardId, 0);
    const printedCost = gameState.cardStats[cardId]!.cost;
    assert.ok(printedCost >= 4, 'the test needs a card costing at least 4');
    assert.deepEqual(gameState.fightSizeChanging?.[cardId], { classes: ['strength', 'ranged'], microscopicIcons: [] });
    assert.equal(resolveFightPrice(gameState, cardId, '0'), printedCost);
    gameState.playerZones['0']!.inPlay = [heroCardOfClass(gameState, 'strength')];
    assert.equal(resolveFightPrice(gameState, cardId, '0'), printedCost - 2);
    gameState.playerZones['0']!.inPlay = [heroCardOfClass(gameState, 'strength'), heroCardOfClass(gameState, 'ranged')];
    assert.equal(resolveFightPrice(gameState, cardId, '0'), Math.max(0, printedCost - 4));
    gameState.playerZones['0']!.inPlay = [heroCardOfClass(gameState, 'tech')];
    assert.equal(resolveFightPrice(gameState, cardId, '0'), printedCost);
  });

  it('M4: a single-class card gets one class; a card with no class gets no entry', () => {
    const entries = buildMicroSizedFightSizeChanging(['a#0', 'b#0', 'c#0'], {
      'a#0': { heroClass: 'tech', team: null },
      'b#0': { heroClass: null, team: null },
      'c#0': { heroClass: 'covert', heroClass2: 'covert', team: null },
    });
    assert.deepEqual(entries, {
      'a#0': { classes: ['tech'], microscopicIcons: [] },
      'c#0': { classes: ['covert'], microscopicIcons: [] },
    });
  });
});

describe('WP-863 Trap Heroes in the Microverse — fight: choose any player to gain it (D-24805)', () => {
  it('M6: one seat gains it outright, never into the Victory Pile', () => {
    const gameState = buildState(1);
    const cardId = trappedCard(gameState, 'unseen-protector');
    placeInCity(gameState, cardId, 2);
    defeatCityVillainCore(gameState, { currentPlayer: '0', turn: 1 }, 2, { random: identityRandom });
    assert.ok(gameState.playerZones['0']!.discard.includes(cardId));
    assert.equal(gameState.playerZones['0']!.victory.includes(cardId), false);
    assert.equal(gameState.convertedVillainOrigins?.[cardId], undefined);
    assert.equal(gameState.pendingSeatChoice, undefined);
    assert.ok(logTexts(gameState).includes(
      'Player 0 defeated Unseen Protector (Micro-Sized) and gained it as a Hero into their discard pile.',
    ));
    assert.equal(logTexts(gameState).some((text) => text.startsWith('Fight effect:')), false);
    checkNoCardInMultipleZones(gameState);
  });

  it('M6: the gain line follows the "fought" line, with its outcome colour and card link', () => {
    // why: the gain was logged during the routing, ahead of the fight that caused it; this pins
    // the order for the outright gain, the parked choice and the blocked pick.
    const outright = buildState(1);
    const outrightCard = trappedCard(outright, 'unseen-protector');
    placeInCity(outright, outrightCard, 2);
    defeatCityVillainCore(outright, { currentPlayer: '0', turn: 1 }, 2, { random: identityRandom });
    const outrightTexts = logTexts(outright);
    const outrightFought = outrightTexts.findIndex((text) => text.startsWith('Player 0 fought '));
    const outrightGain = outrightTexts.indexOf(
      'Player 0 defeated Unseen Protector (Micro-Sized) and gained it as a Hero into their discard pile.',
    );
    assert.ok(outrightFought !== -1, 'the fought line is logged');
    assert.equal(outrightGain, outrightFought + 1, 'the gain line comes right after the fought line');
    assert.equal(outright.messages[outrightGain]!.outcome, 'applied');
    assert.equal(outright.messages[outrightGain]!.card, outrightCard);

    const parked = buildState(2);
    const parkedCard = trappedCard(parked, 'unseen-protector');
    placeInCity(parked, parkedCard, 2);
    defeatCityVillainCore(parked, { currentPlayer: '0', turn: 1 }, 2, { random: identityRandom });
    const parkedTexts = logTexts(parked);
    const parkedFought = parkedTexts.findIndex((text) => text.startsWith('Player 0 fought '));
    const parkedGain = parkedTexts.indexOf('Player 0 chooses a player to gain Unseen Protector (Trap Heroes in the Microverse).');
    assert.equal(parkedGain, parkedFought + 1);
    assert.equal(parked.messages[parkedGain]!.outcome, 'neutral');
    assert.equal(parked.messages[parkedGain]!.card, parkedCard);

    const blocked = buildState(2);
    blocked.pendingSeatChoice = {
      kind: 'generic',
      addressedSeats: ['1'],
      seatPrompts: { '1': { options: [{ label: 'ok' }] } },
      submissions: {},
      defaultOptionIndex: 0,
    };
    const blockedCard = trappedCard(blocked, 'unseen-protector');
    placeInCity(blocked, blockedCard, 2);
    defeatCityVillainCore(blocked, { currentPlayer: '0', turn: 1 }, 2, { random: identityRandom });
    const blockedTexts = logTexts(blocked);
    const blockedFought = blockedTexts.findIndex((text) => text.startsWith('Player 0 fought '));
    const blockedGain = blockedTexts.indexOf(
      'Player 0 gained Unseen Protector — another choice is open, so no other player could be chosen (Trap Heroes in the Microverse).',
    );
    assert.equal(blockedGain, blockedFought + 1);
    assert.equal(blocked.messages[blockedGain]!.outcome, 'blocked');
  });

  it('M6: two seats park a "Player N gains" choice; choosing Player 1 moves the card to their discard', () => {
    const gameState = buildState(2);
    const cardId = trappedCard(gameState, 'unseen-protector');
    placeInCity(gameState, cardId, 2);
    defeatCityVillainCore(gameState, { currentPlayer: '0', turn: 1 }, 2, { random: identityRandom });
    assert.ok(gameState.playerZones['0']!.discard.includes(cardId), 'held by the defeater while the pick is open');
    const choice = gameState.pendingSeatChoice;
    assert.equal(choice?.kind, MICRO_SIZED_GAIN_SEAT_CHOICE_KIND);
    assert.deepEqual(choice?.addressedSeats, ['0']);
    assert.equal(choice?.defaultOptionIndex, 0);
    assert.deepEqual(
      choice?.seatPrompts['0']?.options.map((option) => [option.label, option.recipientSeat, option.cardId]),
      [
        ['Player 0 gains Unseen Protector', '0', cardId],
        ['Player 1 gains Unseen Protector', '1', cardId],
      ],
    );
    assert.ok(logTexts(gameState).includes('Player 0 chooses a player to gain Unseen Protector (Trap Heroes in the Microverse).'));
    resolveSeatChoice(makeSeatResolveCtx(gameState, '0'), { optionIndex: 1 });
    assert.equal(gameState.pendingSeatChoice, undefined);
    assert.equal(gameState.playerZones['0']!.discard.includes(cardId), false);
    assert.ok(gameState.playerZones['1']!.discard.includes(cardId));
    assert.ok(logTexts(gameState).includes('Player 1 gains Unseen Protector (Trap Heroes in the Microverse).'));
    checkNoCardInMultipleZones(gameState);
  });

  it('M6: choosing yourself leaves the card in your discard', () => {
    const gameState = buildState(2);
    const cardId = trappedCard(gameState, 'unseen-protector');
    placeInCity(gameState, cardId, 2);
    defeatCityVillainCore(gameState, { currentPlayer: '0', turn: 1 }, 2, { random: identityRandom });
    resolveSeatChoice(makeSeatResolveCtx(gameState, '0'), { optionIndex: 0 });
    assert.ok(gameState.playerZones['0']!.discard.includes(cardId));
    assert.equal(gameState.playerZones['1']!.discard.includes(cardId), false);
    assert.ok(logTexts(gameState).includes('Player 0 gains Unseen Protector (Trap Heroes in the Microverse).'));
  });

  it('M6: an open seat choice blocks only the park; the card stays with the defeater', () => {
    const gameState = buildState(2);
    const openChoice: PendingSeatChoice = {
      kind: 'generic',
      addressedSeats: ['1'],
      seatPrompts: { '1': { options: [{ label: 'ok' }] } },
      submissions: {},
      defaultOptionIndex: 0,
    };
    gameState.pendingSeatChoice = openChoice;
    const cardId = trappedCard(gameState, 'unseen-protector');
    placeInCity(gameState, cardId, 2);
    defeatCityVillainCore(gameState, { currentPlayer: '0', turn: 1 }, 2, { random: identityRandom });
    assert.equal(gameState.pendingSeatChoice, openChoice);
    assert.ok(gameState.playerZones['0']!.discard.includes(cardId));
    assert.ok(logTexts(gameState).includes(
      'Player 0 gained Unseen Protector — another choice is open, so no other player could be chosen (Trap Heroes in the Microverse).',
    ));
  });

  it('M6: a stale pick (the card left the discard pile) gives nothing to anyone', () => {
    const gameState = buildState(2);
    const cardId = trappedCard(gameState, 'unseen-protector');
    placeInCity(gameState, cardId, 2);
    defeatCityVillainCore(gameState, { currentPlayer: '0', turn: 1 }, 2, { random: identityRandom });
    gameState.playerZones['0']!.discard = gameState.playerZones['0']!.discard.filter((id) => id !== cardId);
    gameState.playerZones['0']!.hand.push(cardId);
    resolveSeatChoice(makeSeatResolveCtx(gameState, '0'), { optionIndex: 1 });
    assert.equal(gameState.playerZones['1']!.discard.includes(cardId), false);
    assert.ok(logTexts(gameState).includes(
      "Unseen Protector is no longer in Player 0's discard pile, so no one else gains it (Trap Heroes in the Microverse).",
    ));
  });

  it('M5: a revealed trapped card enters the City like a Villain and runs no ability', () => {
    const gameState = buildState(2);
    const cardId = trappedCard(gameState, 'unseen-protector');
    gameState.villainDeck.deck = [cardId, ...gameState.villainDeck.deck.filter((id) => id !== cardId)];
    const messagesBefore = gameState.messages.length;
    performVillainReveal(gameState, makeRevealContext(), DEFAULT_IMPLEMENTATION_MAP);
    assert.equal(gameState.city[0], cardId);
    const newLines = logTexts(gameState).slice(messagesBefore);
    assert.equal(newLines.some((text) => /Ambush|Fight effect|Escape effect/.test(text)), false, newLines.join(' | '));
  });
});

describe('WP-863 Trap Heroes in the Microverse — Twist and Evil Wins (D-24805)', () => {
  it('M7: a Twist plays two cards from the Villain Deck', () => {
    const gameState = buildState(2);
    const config = SCHEME_TWIST_CONFIGS.get(TRAP_HEROES_IN_THE_MICROVERSE_SCHEME_ID)!;
    assert.equal(config.resolverId, 'chained-reveals');
    assert.deepEqual(config.params, { revealCount: 2 });
    // why: two printed Villains on top, so both reveals land in the City and nothing chains.
    const villains = gameState.villainDeck.deck.filter(
      (cardId) => gameState.villainDeckCardTypes[cardId] === 'villain' && gameState.convertedVillainOrigins?.[cardId] === undefined,
    );
    const topTwo = villains.slice(0, 2);
    gameState.villainDeck.deck = [...topTwo, ...gameState.villainDeck.deck.filter((id) => !topTwo.includes(id))];
    const deckBefore = gameState.villainDeck.deck.length;
    SCHEME_TWIST_RESOLVERS['chained-reveals'](gameState, makeRevealContext(), DEFAULT_IMPLEMENTATION_MAP, config.params, 'twist' as CardExtId);
    assert.equal(gameState.villainDeck.deck.length, deckBefore - 2);
    assert.ok(gameState.city.includes(topTwo[0]!) && gameState.city.includes(topTwo[1]!));
  });

  it('M8: 3 escaped Villains per player lose the scheme; Micro-Sized Villains count', () => {
    const gameState = buildState(2);
    assert.equal(isTwistLossSuppressed(gameState), true, 'no twist-count loss');
    const trapped = microSizedCards(gameState);
    const printedVillains = gameState.villainDeck.deck.filter(
      (cardId) => gameState.villainDeckCardTypes[cardId] === 'villain' && gameState.convertedVillainOrigins?.[cardId] === undefined,
    );
    gameState.escapedPile = [...trapped.slice(0, 3), ...printedVillains.slice(0, 2)];
    applyEscapedPileResourceLoss(gameState);
    assert.equal(gameState.counters[ENDGAME_CONDITIONS.SCHEME_LOSS] ?? 0, 0, '5 of 6 escaped');
    assert.equal(resolveSchemeLossThreshold(gameState), 6);
    assert.equal(resolveSchemeLossKind(gameState), 'escaped-pile');
    assert.equal(resolveSchemeLossProgress(gameState), 5);
    gameState.escapedPile.push(printedVillains[2]!);
    applyEscapedPileResourceLoss(gameState);
    assert.equal(gameState.counters[ENDGAME_CONDITIONS.SCHEME_LOSS], 1);
    assert.ok(logTexts(gameState).includes('Scheme loss triggered — 6 Villains escaped (threshold 6).'));
  });

  it('M8: the threshold is 3 per seat', () => {
    const gameState = buildState(3);
    gameState.escapedPile = microSizedCards(gameState).slice(0, 8);
    applyEscapedPileResourceLoss(gameState);
    assert.equal(gameState.counters[ENDGAME_CONDITIONS.SCHEME_LOSS] ?? 0, 0, '8 of 9 escaped');
    gameState.escapedPile.push(microSizedCards(gameState)[8]!);
    applyEscapedPileResourceLoss(gameState);
    assert.equal(gameState.counters[ENDGAME_CONDITIONS.SCHEME_LOSS], 1);
  });

  it('M8: the Villain Deck running out loses the scheme, and the meter follows the closer half', () => {
    const gameState = buildState(2);
    assert.equal(resolveSchemeLossKind(gameState), 'villain-deck', 'nothing escaped yet: the deck half reports');
    gameState.villainDeck.deck = [];
    applyPileDepletionResourceLoss(gameState);
    assert.equal(gameState.counters[ENDGAME_CONDITIONS.SCHEME_LOSS], 1);
    assert.ok(logTexts(gameState).includes('Scheme loss triggered — the Villain Deck has run out.'));
  });
});
