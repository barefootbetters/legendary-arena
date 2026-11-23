/**
 * Midnight Massacre (WP-764 / D-24596) — full-G integration over the shipped data/cards/mdns.json
 * and dkcy.json (the trapHeroesInTheMicroverse.test.ts precedent): the Blade → Switchblade setup
 * conversion, the printed-cost fight, the "KO it or give it to a player" defeat choice (the active
 * seat, the timeout default, the Silent Sniper free defeat, the deferred Sunlight/Moonlight hollow),
 * the Hero-Deck-burn Twist (3 per Switchblade, always one more Villain Deck card), and the Hero
 * Deck / Villain Deck runout Evil Wins.
 *
 * node:test + node:assert only. No boardgame.io import.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildInitialGameState } from './buildInitialGameState.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { checkNoCardInMultipleZones } from '../invariants/gameRules.checks.js';
import { SCHEME_TWIST_RESOLVERS } from '../rules/schemeTwistResolvers.js';
import { SCHEME_TWIST_CONFIGS } from '../rules/schemeTwistConfigs.js';
import { applyPileDepletionResourceLoss } from '../rules/schemeResourceLoss.js';
import { resolveFightCost, resolveFightPrice } from '../economy/economy.resolve.js';
import { defeatCityVillainCore } from '../moves/fightVillain.js';
import { dispatchDefeatWithBystanderTarget } from '../moves/defeatChoice.resolve.js';
import { resolveSeatChoice, applySeatChoiceTimeoutDefault } from '../moves/seatChoice.resolve.js';
import { MIDNIGHT_MASSACRE_SWITCHBLADE_SEAT_CHOICE_KIND } from '../moves/seatChoiceTactics.js';
import { DEFAULT_IMPLEMENTATION_MAP } from '../rules/ruleRuntime.impl.js';
import { ENDGAME_CONDITIONS } from '../endgame/endgame.types.js';
import { runSimulation } from '../simulation/simulation.runner.js';
import { createRandomPolicy } from '../simulation/ai.random.js';
import type { LegendaryGameState, SetupContext } from '../types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { RevealContext } from '../villainDeck/villainDeck.reveal.js';

const here = dirname(fileURLToPath(import.meta.url));

/** Reads one shipped card set. */
function loadSet(abbr: string): unknown {
  return JSON.parse(readFileSync(join(here, '..', '..', '..', '..', 'data', 'cards', `${abbr}.json`), 'utf8'));
}

const SETS: Record<string, unknown> = { mdns: loadSet('mdns'), dkcy: loadSet('dkcy') };

/** A setup registry over the real mdns and dkcy sets. */
const REGISTRY = {
  listCards: () => [],
  listSets: () => [{ abbr: 'mdns' }, { abbr: 'dkcy' }],
  getSet: (abbr: string) => SETS[abbr],
};

const MIDNIGHT_MASSACRE_SCHEME_ID = 'mdns/midnight-massacre';
const OTHER_SCHEME_ID = 'mdns/sire-vampires-at-the-blood-bank';
const BLADE_PREFIX = 'dkcy/blade/';

/** A loadout of five mdns Heroes; none is `dkcy/blade`, so the default Blade (Dark City) is used. */
function buildConfig(schemeId: string = MIDNIGHT_MASSACRE_SCHEME_ID): MatchSetupConfig {
  return {
    schemeId,
    mastermindId: 'mdns/lilith-mother-of-demons',
    villainGroupIds: ['mdns/lilin'],
    henchmanGroupIds: [],
    heroDeckIds: [
      'mdns/elsa-bloodstone',
      'mdns/morbius',
      'mdns/werewolf-by-night',
      'mdns/wong-master-of-the-mystic-arts',
      'mdns/blade-daywalker',
    ],
    bystandersCount: 1,
    woundsCount: 30,
    officersCount: 30,
    sidekicksCount: 0,
  };
}

/** Builds G for the loadout. */
function buildState(numPlayers: number = 2, schemeId?: string): LegendaryGameState {
  return buildInitialGameState(buildConfig(schemeId), REGISTRY as never, makeMockCtx({ numPlayers }));
}

/** Counts every Shuffle call one setup build makes. */
function countSetupShuffles(schemeId: string): number {
  const mockCtx = makeMockCtx({ numPlayers: 2 });
  let shuffleCount = 0;
  const countingCtx: SetupContext = {
    ...mockCtx,
    random: { Shuffle: <T,>(deck: T[]): T[] => { shuffleCount = shuffleCount + 1; return mockCtx.random.Shuffle(deck); } },
  };
  buildInitialGameState(buildConfig(schemeId), REGISTRY as never, countingCtx);
  return shuffleCount;
}

const identityRandom = { Shuffle: <T,>(deck: T[]) => [...deck] };

/** A reveal context with an identity shuffle. */
function makeRevealContext(): RevealContext {
  return { random: identityRandom, ctx: { currentPlayer: '0', turn: 1 } };
}

/** The Switchblade card ids still carrying the origin. */
function switchblades(gameState: LegendaryGameState): CardExtId[] {
  const cardIds: CardExtId[] = [];
  for (const [cardId, origin] of Object.entries(gameState.convertedVillainOrigins ?? {})) {
    if (origin === 'switchblade') {
      cardIds.push(cardId);
    }
  }
  return cardIds;
}

/** Moves a Villain Deck card into a City space. */
function placeInCity(gameState: LegendaryGameState, cardId: CardExtId, cityIndex: number): void {
  gameState.villainDeck.deck = gameState.villainDeck.deck.filter((deckCardId) => deckCardId !== cardId);
  const city = [...gameState.city] as typeof gameState.city;
  city[cityIndex] = cardId;
  gameState.city = city;
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

describe('WP-764 Midnight Massacre — setup (D-24596)', () => {
  it('the default Blade (dkcy/blade) becomes 14 Switchblade Villains in the Villain Deck, and only there', () => {
    const gameState = buildState();
    const blades = switchblades(gameState);
    assert.equal(blades.length, 14);
    for (const cardId of blades) {
      assert.ok(cardId.startsWith(BLADE_PREFIX), cardId);
      assert.ok(gameState.villainDeck.deck.includes(cardId), cardId);
      assert.equal(gameState.villainDeckCardTypes[cardId], 'villain', cardId);
      // the Blade cards carry stats and display even though the Blade is not a selected Hero
      assert.ok(gameState.cardStats[cardId] !== undefined, `${cardId} has stats`);
      assert.ok(gameState.cardDisplayData[cardId] !== undefined, `${cardId} has display`);
    }
    const heroZoneCards = [...gameState.heroDeck, ...gameState.hq];
    assert.equal(heroZoneCards.some((cardId) => cardId !== null && cardId.startsWith(BLADE_PREFIX)), false, 'no Switchblade is in the Hero Deck or HQ');
    const twistCount = gameState.villainDeck.deck.filter((cardId) => gameState.villainDeckCardTypes[cardId] === 'scheme-twist').length;
    assert.equal(twistCount, 11);
    assert.ok(logTexts(gameState).some((text) => /Midnight Massacre: .* 14 cards are shuffled into the Villain Deck as Switchblade Villains\./.test(text)));
    checkNoCardInMultipleZones(gameState);
  });

  it('another scheme with the same loadout converts nothing and draws one Shuffle fewer', () => {
    const gameState = buildState(2, OTHER_SCHEME_ID);
    assert.equal(switchblades(gameState).length, 0);
    assert.equal(Object.keys(gameState.villainDeckCardTypes).some((cardId) => cardId.startsWith(BLADE_PREFIX)), false);
    assert.equal(logTexts(gameState).some((text) => text.startsWith('Midnight Massacre')), false);
    assert.equal(countSetupShuffles(MIDNIGHT_MASSACRE_SCHEME_ID), countSetupShuffles(OTHER_SCHEME_ID) + 1);
  });

  it('two same-seed builds give the identical Villain Deck order (determinism)', () => {
    assert.deepEqual(buildState().villainDeck.deck, buildState().villainDeck.deck);
  });

  it('no ability, keyword or defeat requirement is keyed by a Switchblade', () => {
    const gameState = buildState();
    for (const cardId of switchblades(gameState)) {
      assert.equal(gameState.villainAbilityHooks.some((hook) => hook.cardId === cardId), false, cardId);
      assert.equal((gameState.cardKeywords[cardId] ?? []).length, 0, cardId);
      assert.equal(gameState.villainDefeatRequirements?.[cardId], undefined, cardId);
    }
  });
});

describe('WP-764 Midnight Massacre — fight cost (D-24596)', () => {
  it('a Switchblade fights for its printed cost exactly (no +N)', () => {
    const gameState = buildState();
    for (const cardId of switchblades(gameState)) {
      placeInCity(gameState, cardId, 0);
      assert.equal(resolveFightCost(gameState, cardId, '0'), gameState.cardStats[cardId]!.cost, cardId);
      assert.equal(resolveFightPrice(gameState, cardId, '0'), gameState.cardStats[cardId]!.cost, cardId);
    }
  });
});

describe('WP-764 Midnight Massacre — defeat: KO it or give it to a player (D-24596)', () => {
  it('defeating a Switchblade parks the choice for the active seat with the locked options and default', () => {
    const gameState = buildState(2);
    const cardId = switchblades(gameState)[0]!;
    placeInCity(gameState, cardId, 2);
    defeatCityVillainCore(gameState, { currentPlayer: '0', turn: 1 }, 2, { random: identityRandom });
    // the card lives only in the pending choice: in no zone
    assert.equal(gameState.playerZones['0']!.discard.includes(cardId), false);
    assert.equal(gameState.playerZones['0']!.victory.includes(cardId), false);
    assert.equal(gameState.ko.includes(cardId), false);
    const choice = gameState.pendingSeatChoice;
    assert.equal(choice?.kind, MIDNIGHT_MASSACRE_SWITCHBLADE_SEAT_CHOICE_KIND);
    assert.deepEqual(choice?.addressedSeats, ['0']);
    assert.equal(choice?.defaultOptionIndex, 1);
    const options = choice!.seatPrompts['0']!.options;
    assert.equal(options.length, 3, 'KO, self-gain, give to the other seat');
    assert.equal(options[0]!.recipientSeat, undefined, 'the KO option carries no recipient');
    assert.equal(options[1]!.recipientSeat, '0', 'self-gain');
    assert.equal(options[2]!.recipientSeat, '1', 'give to the other seat');
    for (const option of options) {
      assert.equal(option.cardId, cardId);
    }
    // the Sunlight/Moonlight deferral is recorded as a hollow at the defeat
    const hollow = (gameState.diagnostics?.hollowEffects ?? []).find((record) => record.cardId === cardId);
    assert.deepEqual(hollow && { mechanic: hollow.mechanic, reason: hollow.reason, timing: hollow.timing, cardType: hollow.cardType }, {
      mechanic: 'switchblade-day-night', reason: 'unsupported-keyword', timing: 'onFight', cardType: 'villain',
    });
  });

  it('KO (index 0) sends the Switchblade to the KO pile, never a Victory Pile, and clears the overlay', () => {
    const gameState = buildState(2);
    const cardId = switchblades(gameState)[0]!;
    placeInCity(gameState, cardId, 2);
    defeatCityVillainCore(gameState, { currentPlayer: '0', turn: 1 }, 2, { random: identityRandom });
    resolveSeatChoice(makeSeatResolveCtx(gameState, '0'), { optionIndex: 0 });
    assert.ok(gameState.ko.includes(cardId));
    assert.equal(gameState.playerZones['0']!.victory.includes(cardId), false);
    assert.equal(gameState.convertedVillainOrigins?.[cardId], undefined);
    assert.equal(gameState.pendingSeatChoice, undefined);
    assert.ok(logTexts(gameState).some((text) => /KO'd the Switchblade/.test(text)));
    checkNoCardInMultipleZones(gameState);
  });

  it('give to the other seat (index 2) puts the Switchblade in that player\'s discard as a Hero', () => {
    const gameState = buildState(2);
    const cardId = switchblades(gameState)[0]!;
    placeInCity(gameState, cardId, 2);
    defeatCityVillainCore(gameState, { currentPlayer: '0', turn: 1 }, 2, { random: identityRandom });
    resolveSeatChoice(makeSeatResolveCtx(gameState, '0'), { optionIndex: 2 });
    assert.ok(gameState.playerZones['1']!.discard.includes(cardId));
    assert.equal(gameState.playerZones['0']!.discard.includes(cardId), false);
    assert.equal(gameState.convertedVillainOrigins?.[cardId], undefined);
    assert.ok(logTexts(gameState).some((text) => /Player 1 gains the Switchblade/.test(text)));
    checkNoCardInMultipleZones(gameState);
  });

  it('the timeout default (index 1) gains the Switchblade to the active seat', () => {
    const gameState = buildState(2);
    const cardId = switchblades(gameState)[0]!;
    placeInCity(gameState, cardId, 2);
    defeatCityVillainCore(gameState, { currentPlayer: '0', turn: 1 }, 2, { random: identityRandom });
    applySeatChoiceTimeoutDefault(gameState, ['0']);
    gameState.pendingSeatChoice = undefined; // the move layer clears it after the apply
    assert.ok(gameState.playerZones['0']!.discard.includes(cardId));
    assert.equal(gameState.playerZones['1']!.discard.includes(cardId), false);
    assert.equal(gameState.convertedVillainOrigins?.[cardId], undefined);
  });

  it('a Silent Sniper FREE defeat of a Switchblade parks the same choice (the shared defeat core)', () => {
    const gameState = buildState(1);
    const cardId = switchblades(gameState)[0]!;
    placeInCity(gameState, cardId, 3);
    dispatchDefeatWithBystanderTarget(
      gameState,
      { currentPlayer: '0', turn: 1 },
      { kind: 'villain', cityIndex: 3, cardId },
      { random: identityRandom },
    );
    assert.equal(gameState.pendingSeatChoice?.kind, MIDNIGHT_MASSACRE_SWITCHBLADE_SEAT_CHOICE_KIND);
    // one seat: KO, or gain to self (default 1)
    assert.equal(gameState.pendingSeatChoice?.seatPrompts['0']?.options.length, 2);
    assert.equal(gameState.pendingSeatChoice?.defaultOptionIndex, 1);
    applySeatChoiceTimeoutDefault(gameState, ['0']);
    assert.ok(gameState.playerZones['0']!.discard.includes(cardId));
  });
});

describe('WP-764 Midnight Massacre — Twist (D-24596)', () => {
  const config = () => SCHEME_TWIST_CONFIGS.get(MIDNIGHT_MASSACRE_SCHEME_ID)!;

  it('the config uses the midnight-massacre resolver and the heroDeck/villainDeck pile-runout loss', () => {
    assert.equal(config().resolverId, 'midnight-massacre');
    assert.deepEqual(config().resourceLossCondition, { kind: 'pile-depleted', piles: ['heroDeck', 'villainDeck'] });
  });

  it('with k Switchblades in the City + Escape Pile, 3k Hero Deck cards are KO\'d and exactly one Villain Deck card is played', () => {
    const gameState = buildState(2);
    const blades = switchblades(gameState);
    // put two Switchblades in the City, one in the Escape Pile → k = 3
    placeInCity(gameState, blades[0]!, 0);
    placeInCity(gameState, blades[1]!, 1);
    gameState.villainDeck.deck = gameState.villainDeck.deck.filter((id) => id !== blades[2]);
    gameState.escapedPile = [blades[2]!];
    // a plain Villain on top so the extra play lands in the City and chains nothing
    const plainVillain = gameState.villainDeck.deck.find(
      (id) => gameState.villainDeckCardTypes[id] === 'villain' && gameState.convertedVillainOrigins?.[id] === undefined,
    )!;
    gameState.villainDeck.deck = [plainVillain, ...gameState.villainDeck.deck.filter((id) => id !== plainVillain)];
    const heroDeckBefore = gameState.heroDeck.length;
    const koBefore = gameState.ko.length;
    const villainDeckBefore = gameState.villainDeck.deck.length;
    const expectedTopKos = gameState.heroDeck.slice(0, 9);
    SCHEME_TWIST_RESOLVERS['midnight-massacre'](gameState, makeRevealContext(), DEFAULT_IMPLEMENTATION_MAP, config().params, 'twist' as CardExtId);
    assert.equal(gameState.heroDeck.length, heroDeckBefore - 9, '3 x 3 = 9 Hero Deck cards KO\'d');
    assert.equal(gameState.ko.length, koBefore + 9);
    for (const koedCard of expectedTopKos) {
      assert.ok(gameState.ko.includes(koedCard), koedCard);
    }
    assert.equal(gameState.villainDeck.deck.length, villainDeckBefore - 1, 'exactly one more Villain Deck card played');
    assert.ok(gameState.city.includes(plainVillain));
  });

  it('at k = 0 Switchblades, no Hero Deck card is KO\'d but one Villain Deck card is still played', () => {
    const gameState = buildState(2);
    // no Switchblade in the City or Escape Pile
    const plainVillain = gameState.villainDeck.deck.find(
      (id) => gameState.villainDeckCardTypes[id] === 'villain' && gameState.convertedVillainOrigins?.[id] === undefined,
    )!;
    gameState.villainDeck.deck = [plainVillain, ...gameState.villainDeck.deck.filter((id) => id !== plainVillain)];
    const heroDeckBefore = gameState.heroDeck.length;
    const villainDeckBefore = gameState.villainDeck.deck.length;
    SCHEME_TWIST_RESOLVERS['midnight-massacre'](gameState, makeRevealContext(), DEFAULT_IMPLEMENTATION_MAP, config().params, 'twist' as CardExtId);
    assert.equal(gameState.heroDeck.length, heroDeckBefore, 'no KO at k = 0');
    assert.equal(gameState.villainDeck.deck.length, villainDeckBefore - 1, 'always one more Villain Deck card');
  });

  it('the Twist never reads past an empty Hero Deck (no throw)', () => {
    const gameState = buildState(2);
    const blades = switchblades(gameState);
    placeInCity(gameState, blades[0]!, 0); // k = 1 → wants 3 KOs
    gameState.heroDeck = gameState.heroDeck.slice(0, 1); // only one card to KO
    assert.doesNotThrow(() => {
      SCHEME_TWIST_RESOLVERS['midnight-massacre'](gameState, makeRevealContext(), DEFAULT_IMPLEMENTATION_MAP, config().params, 'twist' as CardExtId);
    });
    assert.equal(gameState.heroDeck.length, 0);
  });
});

describe('WP-764 Midnight Massacre — Evil Wins (D-24596)', () => {
  it('the Hero Deck running out loses the scheme', () => {
    const gameState = buildState(2);
    gameState.heroDeck = [];
    applyPileDepletionResourceLoss(gameState);
    assert.equal(gameState.counters[ENDGAME_CONDITIONS.SCHEME_LOSS], 1);
  });

  it('the Villain Deck running out loses the scheme', () => {
    const gameState = buildState(2);
    gameState.villainDeck.deck = [];
    applyPileDepletionResourceLoss(gameState);
    assert.equal(gameState.counters[ENDGAME_CONDITIONS.SCHEME_LOSS], 1);
  });
});

describe('WP-764 Midnight Massacre — a 1-player sim terminates (D-24596)', () => {
  it('runSimulation completes one 1-player game without stranding on a Switchblade defeat', () => {
    const result = runSimulation(
      { games: 1, seed: 'midnight-massacre-1p', setupConfig: buildConfig(), policies: [createRandomPolicy('p0-seed')] },
      REGISTRY as never,
    );
    assert.equal(result.gamesPlayed, 1);
    assert.equal(Number.isFinite(result.averageTurns), true);
  });
});
