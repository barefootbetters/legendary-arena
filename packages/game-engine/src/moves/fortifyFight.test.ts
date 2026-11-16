/**
 * Fighting a fortifying Villain through fightVillain({ fortifiedPlace }) (WP-873 / D-24818).
 *
 * Covers the successful fight (Victory Pile, table cleared, attack spent, the fought line),
 * the lazy Orrgo recorder, every silent refusal (G deep-equal before and after), Colleen Wing
 * at the Mastermind, and the D-24802 Size-Changing price on a fixture fortifier.
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fightVillain } from './fightVillain.js';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { FortifyPlace } from '../board/fortify.types.js';
import { buildDefaultHookDefinitions } from '../rules/ruleRuntime.impl.js';
import { initializeCity, initializeHq } from '../board/city.logic.js';
import { makeMockMoveContext } from '../test/mockMoveContext.js';
import { makeCardStatEntry, makeGlobalPiles, makeMastermindState, makePlayerZones, makeTurnEconomy } from '../test/fixtureBuilders.js';
import { getAvailableAttack } from '../economy/economy.logic.js';
import { formatCardRef } from '../log/logDisplay.js';
import { isMastermindGuarded } from '../board/besideMastermind.logic.js';

const SQUIRREL_GIRL = 'cvwr-villain-great-lakes-avengers-squirrel-girl-00' as CardExtId;
const COLLEEN_WING = 'cvwr-villain-heroes-for-hire-colleen-wing-00' as CardExtId;
const SHRINKING_FORTIFIER = 'test-villain-shrinking-fortifier-00' as CardExtId;
const ORRGO = 'chmp-villain-monsters-unleashed-orrgo-00' as CardExtId;

/**
 * A minimal one-seat state in the main stage with Squirrel Girl fortifying the Sidekick
 * Stack (her WP-871 restriction set), 3 attack and one card in play.
 *
 * @returns The game state.
 */
function createFortifiedState(): LegendaryGameState {
  const config = {
    schemeId: 'test-scheme',
    mastermindId: 'test-mastermind',
    villainGroupIds: ['test-villain-group'],
    henchmanGroupIds: ['test-henchman-group'],
    heroDeckIds: ['test-hero-deck'],
    bystandersCount: 1,
    woundsCount: 1,
    officersCount: 1,
    sidekicksCount: 1,
  };
  return {
    matchConfiguration: config,
    selection: {
      schemeId: config.schemeId,
      mastermindId: config.mastermindId,
      villainGroupIds: [...config.villainGroupIds],
      henchmanGroupIds: [...config.henchmanGroupIds],
      heroDeckIds: [...config.heroDeckIds],
    },
    currentStage: 'main',
    playerZones: {
      '0': { ...makePlayerZones(), deck: [], hand: [], discard: [], inPlay: ['hero-played-1'], victory: [] },
    },
    cardTraits: {},
    villainAbilityHooks: [],
    cardDisplayData: {
      [SQUIRREL_GIRL]: { extId: SQUIRREL_GIRL, name: 'Squirrel Girl', imageUrl: '', cost: 3 },
      [COLLEEN_WING]: { extId: COLLEEN_WING, name: 'Colleen Wing', imageUrl: '', cost: 9 },
    },
    villainFightRestrictions: { [SQUIRREL_GIRL]: { kind: 'at-most-one-card-played' } },
    piles: { ...makeGlobalPiles(), bystanders: [], wounds: [], officers: [], sidekicks: [] },
    messages: [],
    counters: {},
    hookRegistry: buildDefaultHookDefinitions(config),
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: {},
    ko: [],
    attachedBystanders: {},
    villainAttachedHeroes: {},
    turnEconomy: makeTurnEconomy({ attack: 3 }),
    cardStats: {
      [SQUIRREL_GIRL]: makeCardStatEntry({ fightCost: 3 }),
      [COLLEEN_WING]: makeCardStatEntry({ fightCost: 9 }),
    },
    mastermind: { ...makeMastermindState(), id: 'test-mastermind', baseCardId: 'test-mastermind-base', tacticsDeck: [], tacticsDefeated: [] },
    city: initializeCity(),
    hq: initializeHq(),
    lobby: { requiredPlayers: 1, ready: {}, started: false },
    notableEvents: [],
    escapedPile: [],
    fortifications: { 'sidekick-stack': { villainCardId: SQUIRREL_GIRL, lock: 'no-recruit-or-gain' } },
  } as unknown as LegendaryGameState;
}

/**
 * Calls fightVillain with a fortifier argument.
 *
 * @param gameState - The state to fight in.
 * @param fortifiedPlace - The place argument (untrusted; may be malformed).
 * @returns The move context after the move.
 */
function fightFortifier(gameState: LegendaryGameState, fortifiedPlace: unknown) {
  const moveContext = makeMockMoveContext(gameState);
  // why: the fortifier fight takes no cityIndex; cast through unknown so malformed places
  // can be passed exactly as an untrusted client would send them.
  fightVillain(moveContext, { fortifiedPlace } as unknown as Parameters<typeof fightVillain>[1]);
  return moveContext;
}

/**
 * Asserts a fortifier fight leaves G deep-equal (a silent refusal).
 *
 * @param gameState - The state to fight in.
 * @param fortifiedPlace - The place argument.
 * @param label - The case label.
 */
function assertRefused(gameState: LegendaryGameState, fortifiedPlace: unknown, label: string): void {
  const before = JSON.parse(JSON.stringify(gameState)) as unknown;
  const moveContext = fightFortifier(gameState, fortifiedPlace);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(moveContext.G)), before, `${label} must not mutate G`);
}

/**
 * Returns every log line's text.
 *
 * @param G - The game state.
 * @returns The texts in order.
 */
function logTexts(G: LegendaryGameState): string[] {
  return G.messages.map((entry) => entry.text);
}

describe('WP-873 fortifier fight (D-24818)', () => {
  it('T14: fighting Squirrel Girl at the Sidekick Stack defeats her and ends the fortification', () => {
    const moveContext = fightFortifier(createFortifiedState(), 'sidekick-stack' satisfies FortifyPlace);
    const G = moveContext.G;
    assert.ok(G.playerZones['0']!.victory.includes(SQUIRREL_GIRL), 'she is in the Victory Pile');
    assert.equal('fortifications' in G, false, 'the table key is deleted');
    assert.equal(getAvailableAttack(G.turnEconomy), 0, 'the 3 attack is spent');
    assert.equal(G.hasActedThisTurn, true);
    assert.ok(
      logTexts(G).includes(
        `Player 0 fought ${formatCardRef(G.cardDisplayData, SQUIRREL_GIRL)} fortifying the Sidekick Stack. The Sidekick Stack is no longer fortified.`,
      ),
      logTexts(G).join(' | '),
    );
    assert.deepStrictEqual(G.notableEvents, [], 'no fightResolved event for a fortifier fight');
  });

  it('T14b: the Orrgo recorder runs only in a match with that restriction', () => {
    const withOrrgo = createFortifiedState();
    withOrrgo.villainFightRestrictions = {
      ...withOrrgo.villainFightRestrictions,
      [ORRGO]: { kind: 'requires-villain-defeated-this-turn' },
    };
    assert.equal(fightFortifier(withOrrgo, 'sidekick-stack').G.turnEconomy.hasDefeatedVillainThisTurn, true);
    const withoutOrrgo = fightFortifier(createFortifiedState(), 'sidekick-stack').G;
    assert.equal('hasDefeatedVillainThisTurn' in withoutOrrgo.turnEconomy, false, 'lazy: the key stays absent');
  });

  it('T15: every refusal is silent and leaves G deep-equal', () => {
    assertRefused(createFortifiedState(), 'wound-stack', 'an unknown place');
    assertRefused(createFortifiedState(), 'mastermind', 'a place with no fortifier');
    const shortAttack = createFortifiedState();
    shortAttack.turnEconomy = makeTurnEconomy({ attack: 2 });
    assertRefused(shortAttack, 'sidekick-stack', 'attack 2');
    const twoCards = createFortifiedState();
    twoCards.playerZones['0']!.inPlay = ['hero-played-1', 'hero-played-2'];
    assertRefused(twoCards, 'sidekick-stack', 'two cards played (her WP-871 restriction)');
    const startStage = createFortifiedState();
    startStage.currentStage = 'start';
    assertRefused(startStage, 'sidekick-stack', 'the start stage');
    const pending = createFortifiedState();
    pending.pendingKoHeroChoices = [{ playerId: '0' }] as unknown as LegendaryGameState['pendingKoHeroChoices'];
    assertRefused(pending, 'sidekick-stack', 'a pending choice');
    const healed = createFortifiedState();
    healed.hasHealedThisTurn = true;
    assertRefused(healed, 'sidekick-stack', 'healed this turn');
    const noZones = createFortifiedState();
    noZones.playerZones = {} as LegendaryGameState['playerZones'];
    assertRefused(noZones, 'sidekick-stack', 'no zone for the fighter (Inspector P2-1)');
  });

  it('T16: Colleen Wing at the Mastermind is fought for 9', () => {
    const gameState = createFortifiedState();
    gameState.fortifications = { mastermind: { villainCardId: COLLEEN_WING, lock: 'no-fight' } };
    gameState.turnEconomy = makeTurnEconomy({ attack: 9 });
    const G = fightFortifier(gameState, 'mastermind').G;
    assert.ok(G.playerZones['0']!.victory.includes(COLLEEN_WING));
    assert.equal(G.fortifications, undefined);
    assert.ok(logTexts(G).some((text) => text.endsWith('fortifying the Mastermind. The Mastermind is no longer fortified.')));
  });

  it('T16: a Size-Changing fortifier is fought at the discounted price and logs the D-24802 line', () => {
    const gameState = createFortifiedState();
    gameState.fortifications = { mastermind: { villainCardId: SHRINKING_FORTIFIER, lock: 'no-fight' } };
    gameState.cardStats[SHRINKING_FORTIFIER] = makeCardStatEntry({ fightCost: 5 });
    gameState.cardTraits = { 'tech-hero-1': { heroClass: 'tech', team: null } } as unknown as LegendaryGameState['cardTraits'];
    gameState.playerZones['0']!.inPlay = ['tech-hero-1'];
    gameState.fightSizeChanging = { [SHRINKING_FORTIFIER]: { classes: ['tech'], microscopicIcons: [] } } as LegendaryGameState['fightSizeChanging'];
    gameState.turnEconomy = makeTurnEconomy({ attack: 3 });
    const G = fightFortifier(gameState, 'mastermind').G;
    assert.ok(G.playerZones['0']!.victory.includes(SHRINKING_FORTIFIER), 'defeated at the price of 3');
    assert.equal(G.turnEconomy.spentAttack, 3);
    assert.ok(
      logTexts(G).includes(`Size-Changing: Player 0 fights ${formatCardRef(G.cardDisplayData, SHRINKING_FORTIFIER)} (5 Attack) for 3.`),
      logTexts(G).join(' | '),
    );
  });
});

// ---------------------------------------------------------------------------
// WP-840 / D-24773 — a Villain to the left of the Mastermind (The Blob, T11-T15)
// ---------------------------------------------------------------------------

describe('WP-840 fighting The Blob to the left of the Mastermind (D-24773)', () => {
  const BLOB_00 = 'co2e-villain-brotherhood-of-mutants-the-blob-00' as CardExtId;
  const BLOB_01 = 'co2e-villain-brotherhood-of-mutants-the-blob-01' as CardExtId;
  const CITY_VILLAIN = 'test-villain-city-thug-00' as CardExtId;

  /**
   * The fortifier fixture with no fortification, The Blob listed and 4 attack.
   *
   * @param listed - The Villains to the left of the Mastermind.
   * @returns The game state.
   */
  function createBlobState(listed: CardExtId[] = [BLOB_00]): LegendaryGameState {
    const gameState = createFortifiedState();
    delete gameState.fortifications;
    gameState.villainsBesideMastermind = [...listed];
    gameState.turnEconomy = makeTurnEconomy({ attack: 4 });
    gameState.cardDisplayData[BLOB_00] = { extId: BLOB_00, name: 'The Blob', imageUrl: '', cost: 0 };
    gameState.cardDisplayData[BLOB_01] = { extId: BLOB_01, name: 'The Blob', imageUrl: '', cost: 0 };
    gameState.cardStats[BLOB_00] = makeCardStatEntry({ fightCost: 4 });
    gameState.cardStats[BLOB_01] = makeCardStatEntry({ fightCost: 4 });
    return gameState;
  }

  /**
   * Calls fightVillain with the given (untrusted, possibly malformed) arguments.
   *
   * @param gameState - The state to fight in.
   * @param args - The move arguments.
   * @returns The move context after the move.
   */
  function fightWith(gameState: LegendaryGameState, args: Record<string, unknown>) {
    const moveContext = makeMockMoveContext(gameState);
    fightVillain(moveContext, args as unknown as Parameters<typeof fightVillain>[1]);
    return moveContext;
  }

  /**
   * Asserts a fight leaves G deep-equal (a silent refusal).
   *
   * @param gameState - The state to fight in.
   * @param args - The move arguments.
   * @param label - The case label.
   */
  function assertBesideRefused(gameState: LegendaryGameState, args: Record<string, unknown>, label: string): void {
    const before = JSON.parse(JSON.stringify(gameState)) as unknown;
    const moveContext = fightWith(gameState, args);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(moveContext.G)), before, `${label} must not mutate G`);
  }

  it('T11: fighting The Blob puts him in the Victory Pile and empties the list', () => {
    const G = fightWith(createBlobState(), { besideMastermindIndex: 0 }).G;
    assert.ok(G.playerZones['0']!.victory.includes(BLOB_00));
    assert.equal('villainsBesideMastermind' in G, false, 'the list key is deleted');
    assert.equal(getAvailableAttack(G.turnEconomy), 0, 'the 4 attack is spent');
    assert.equal(G.hasActedThisTurn, true);
    assert.ok(
      logTexts(G).includes(`Player 0 fought ${formatCardRef(G.cardDisplayData, BLOB_00)} to the left of the Mastermind.`),
      logTexts(G).join(' | '),
    );
    assert.deepStrictEqual(G.notableEvents, [], 'no fightResolved event for an off-City fight (D-24818 residual)');
    assert.equal(isMastermindGuarded(G), false);
  });

  it('T12: every refusal is silent and leaves G deep-equal', () => {
    const shortAttack = createBlobState();
    shortAttack.turnEconomy = makeTurnEconomy({ attack: 3 });
    assertBesideRefused(shortAttack, { besideMastermindIndex: 0 }, 'attack 3');
    assertBesideRefused(createBlobState(), { besideMastermindIndex: 1 }, 'index 1 with one Blob');
    assertBesideRefused(createBlobState(), { besideMastermindIndex: -1 }, 'index -1');
    assertBesideRefused(createBlobState(), { besideMastermindIndex: 0.5 }, 'index 0.5');
    assertBesideRefused(createBlobState(), { besideMastermindIndex: '0' }, 'index as a string');
    const absent = createBlobState();
    delete absent.villainsBesideMastermind;
    assertBesideRefused(absent, { besideMastermindIndex: 0 }, 'the list absent');
    const startStage = createBlobState();
    startStage.currentStage = 'start';
    assertBesideRefused(startStage, { besideMastermindIndex: 0 }, 'the start stage');
    const healed = createBlobState();
    healed.hasHealedThisTurn = true;
    assertBesideRefused(healed, { besideMastermindIndex: 0 }, 'healed this turn');
    const pending = createBlobState();
    pending.pendingKoHeroChoices = [{ playerId: '0' }] as unknown as LegendaryGameState['pendingKoHeroChoices'];
    assertBesideRefused(pending, { besideMastermindIndex: 0 }, 'a pending choice');
  });

  it('T13: restricted Attack never pays for The Blob (only plain Attack)', () => {
    for (const target of ['sewers', 'mastermind']) {
      const gameState = createBlobState();
      // why: 4 attack in total, all of it a grant usable only against the named target.
      gameState.turnEconomy = makeTurnEconomy({
        attack: 4,
        restrictedAttack: [{ remaining: 4, targets: [target], sourceCardId: 'bolt' as CardExtId }],
      } as Parameters<typeof makeTurnEconomy>[0]);
      assertBesideRefused(gameState, { besideMastermindIndex: 0 }, `a 4-point grant for ${target} with no plain Attack`);
    }
  });

  it('T14: two Blobs and Colleen Wing — the Mastermind stays guarded until the last is fought', () => {
    let gameState = createBlobState([BLOB_00, BLOB_01]);
    gameState.fortifications = { mastermind: { villainCardId: COLLEEN_WING, lock: 'no-fight' } };
    gameState.turnEconomy = makeTurnEconomy({ attack: 20 });
    gameState = fightWith(gameState, { besideMastermindIndex: 1 }).G;
    assert.deepStrictEqual(gameState.villainsBesideMastermind, [BLOB_00]);
    assert.equal(isMastermindGuarded(gameState), true);
    gameState = fightWith(gameState, { fortifiedPlace: 'mastermind' }).G;
    assert.equal(gameState.fortifications, undefined);
    assert.equal(isMastermindGuarded(gameState), true);
    gameState = fightWith(gameState, { besideMastermindIndex: 0 }).G;
    assert.equal(isMastermindGuarded(gameState), false);
    assert.deepStrictEqual(gameState.playerZones['0']!.victory, [BLOB_01, COLLEEN_WING, BLOB_00]);
  });

  it('T15: fortifiedPlace wins over besideMastermindIndex; a City fight is unchanged', () => {
    const both = createBlobState();
    both.fortifications = { mastermind: { villainCardId: COLLEEN_WING, lock: 'no-fight' } };
    both.turnEconomy = makeTurnEconomy({ attack: 9 });
    const afterBoth = fightWith(both, { fortifiedPlace: 'mastermind', besideMastermindIndex: 0 }).G;
    assert.ok(afterBoth.playerZones['0']!.victory.includes(COLLEEN_WING));
    assert.deepStrictEqual(afterBoth.villainsBesideMastermind, [BLOB_00], 'the list is untouched');

    const city = createBlobState();
    city.city[0] = CITY_VILLAIN;
    city.cardStats[CITY_VILLAIN] = makeCardStatEntry({ fightCost: 2 });
    city.villainDeckCardTypes = { [CITY_VILLAIN]: 'villain' } as LegendaryGameState['villainDeckCardTypes'];
    const afterCity = fightWith(city, { cityIndex: 0 }).G;
    assert.ok(afterCity.playerZones['0']!.victory.includes(CITY_VILLAIN));
    assert.deepStrictEqual(afterCity.villainsBesideMastermind, [BLOB_00], 'the list is untouched');
    const fightResolved = (afterCity.notableEvents as unknown as { type: string; citySpace?: number }[]).find(
      (event) => event.type === 'fightResolved',
    );
    assert.equal(fightResolved?.citySpace, 0);
  });
});
