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
