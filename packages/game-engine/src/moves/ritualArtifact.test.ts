/**
 * Ritual Artifacts — Doctor Voodoo's Staff of Legba and Medallion of Many Loas (WP-858 / D-24794).
 *
 * Staff of Legba logged an attack-no-magnitude hollow on every play and Medallion of Many Loas
 * granted a phantom +1 Attack on every play. These tests build the REAL hooks from the committed
 * data/cards/dstr.json, play through the real hero executor, keep the cards through the real
 * end-of-turn cleanup, record recruits through the real recruit moves and use the Rituals through
 * the real useRitualArtifact move, so they pin the parse, the keep, the predicate, the rewards and
 * the "still played this turn" ledger together.
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
import { countDistinctHeroClassesYouHave } from '../hero/heroConditions.evaluate.js';
import { playedCardIdsThisTurn } from '../hero/splitCard.logic.js';
import { applyEndOfTurnCleanup } from './endOfTurnCleanup.logic.js';
import { recruitHero } from './recruitHero.js';
import { recruitOfficer } from './recruitOfficer.js';
import {
  isRitualArtifact,
  matchHasRecruitedHeroRitual,
  ritualArtifactOptions,
  ritualArtifactReward,
  useRitualArtifact,
} from './ritualArtifact.js';
import { SHIELD_OFFICER_EXT_ID } from '../setup/pilesInit.js';
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

const STAFF = 'dstr/doctor-voodoo/staff-of-legba#0' as CardExtId;
const STAFF_TWO = 'dstr/doctor-voodoo/staff-of-legba#1' as CardExtId;
const MEDALLION = 'dstr/doctor-voodoo/medallion-of-many-loas#0' as CardExtId;
const WAND = 'dstr/doctor-strange/wand-of-watoomb#0' as CardExtId;
const COVERT_HERO = 'test/covert-hero/sneak#0' as CardExtId;
const RANGED_HERO = 'test/ranged-hero/blast#0' as CardExtId;
const INSTINCT_HERO = 'test/instinct-hero/claw#0' as CardExtId;
const HQ_HERO = 'test/hq-hero/five-cost#0' as CardExtId;
const DECK = ['deck-01', 'deck-02', 'deck-03', 'deck-04', 'deck-05', 'deck-06', 'deck-07'] as CardExtId[];

const mockCtx = {
  ctx: { turn: 1, currentPlayer: '0', numPlayers: 2 },
  random: { Shuffle: <T>(items: T[]): T[] => [...items].reverse() },
};

/**
 * Builds the real hooks for Doctor Voodoo and Doctor Strange from the committed card data.
 *
 * @param heroDeckIds - The hero decks to parse.
 * @returns Every hook those hero decks produce.
 */
function buildHooks(heroDeckIds: string[]): HeroAbilityHook[] {
  const sets: Record<string, unknown> = {
    dstr: JSON.parse(readFileSync(join(CARDS_DIRECTORY, 'dstr.json'), 'utf8')),
  };
  const registry = { listCards: () => [], getSet: (abbr: string) => sets[abbr] };
  return buildHeroAbilityHooks(registry, { heroDeckIds } as unknown as MatchConfiguration);
}

/**
 * A two-seat state wide enough for the hero executor, the cleanup, the recruit moves and the
 * Ritual move.
 *
 * @param hooks - The hero ability hooks the match carries.
 * @returns A LegendaryGameState sufficient for these tests.
 */
function makeState(hooks: HeroAbilityHook[]): LegendaryGameState {
  return {
    currentStage: 'main',
    messages: [],
    counters: {},
    hookRegistry: [],
    turnEconomy: { ...makeTurnEconomy() },
    playerZones: {
      '0': { ...makePlayerZones(), deck: [...DECK] },
      '1': { ...makePlayerZones(), deck: [...DECK] },
    },
    piles: makeGlobalPiles({ officers: [SHIELD_OFFICER_EXT_ID] }),
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
    heroAbilityHooks: hooks,
    villainAbilityHooks: [],
    cardStats: {
      [HQ_HERO]: { attack: 0, recruit: 0, cost: 5, fightCost: 0, fightCostMode: 'static', fightCostBase: 0, hasAttackIcon: false, hasRecruitIcon: false, isShieldOrHydra: false },
    },
    cardTraits: {
      [STAFF]: { heroClass: 'strength' },
      [STAFF_TWO]: { heroClass: 'strength' },
      [MEDALLION]: { heroClass: 'tech' },
      [WAND]: { heroClass: 'ranged' },
      [COVERT_HERO]: { heroClass: 'covert' },
      [RANGED_HERO]: { heroClass: 'ranged' },
      [INSTINCT_HERO]: { heroClass: 'instinct' },
    },
    cardKeywords: {},
    cardDisplayData: {},
    notableEvents: [],
  } as unknown as LegendaryGameState;
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
 * The move context a move reads.
 *
 * @param G - The game state.
 * @returns A move context for player 0.
 */
function moveContext(G: LegendaryGameState): never {
  return { G, playerID: '0', ctx: { ...mockCtx.ctx }, random: mockCtx.random } as never;
}

/**
 * Ends player 0's turn through the shared cleanup, then resets the turn economy as turn.onBegin does.
 *
 * @param G - The game state.
 */
function endTurn(G: LegendaryGameState): void {
  applyEndOfTurnCleanup(G, '0', { random: mockCtx.random });
  G.turnEconomy = { ...makeTurnEconomy() };
}

/**
 * Recruits the 5-cost HQ Hero for player 0 through the real recruitHero move.
 *
 * @param G - The game state.
 */
function recruitFiveCostHero(G: LegendaryGameState): void {
  G.hq[0] = HQ_HERO;
  G.turnEconomy = { ...G.turnEconomy, recruit: G.turnEconomy.recruit + 5 };
  recruitHero(moveContext(G), { hqIndex: 0 });
}

describe('Ritual Artifact parse and play (WP-858 / D-24794)', () => {
  it('Staff and Medallion parse to the ritual keywords with no attack effect', () => {
    const hooks = buildHooks(['dstr/doctor-voodoo']);
    const staff = hooks.find((hook) => hook.cardId === STAFF);
    const medallion = hooks.find((hook) => hook.cardId === MEDALLION);
    assert.deepEqual(staff?.keywords, ['ritual-recruited-hero']);
    assert.deepEqual(staff?.effects, [{ type: 'ritual-recruited-hero' }]);
    assert.deepEqual(medallion?.keywords, ['ritual-hero-classes']);
    assert.deepEqual(medallion?.effects, [{ type: 'ritual-hero-classes', magnitude: 3 }]);
  });

  it('playing either card adds no Attack and records no hollow', () => {
    const G = makeState(buildHooks(['dstr/doctor-voodoo']));
    playCard(G, STAFF);
    playCard(G, MEDALLION);
    assert.equal(G.turnEconomy.attack, 0, 'no phantom +1 Attack from Medallion');
    assert.equal(G.diagnostics?.hollowEffects.length ?? 0, 0, 'no attack-no-magnitude hollow from Staff');
  });

  it('Wand of Watoomb (unmarked) keeps its parse and still discards at end of turn', () => {
    const G = makeState(buildHooks(['dstr/doctor-strange']));
    assert.equal(isRitualArtifact(G, WAND), false, 'an unmarked Artifact is not a modeled Ritual');
    G.playerZones['0']!.inPlay.push(WAND);
    endTurn(G);
    assert.ok(G.playerZones['0']!.discard.includes(WAND), 'the Wand goes to the discard pile');
    assert.equal(Object.hasOwn(G, 'controlledArtifacts'), false, 'nothing is kept');
  });
});

describe('Controlled Artifacts at end of turn (WP-858 / D-24794)', () => {
  it('cleanup keeps a played Staff in front of the player and discards the rest', () => {
    const G = makeState(buildHooks(['dstr/doctor-voodoo']));
    playCard(G, STAFF);
    G.playerZones['0']!.inPlay.push(COVERT_HERO);
    endTurn(G);
    assert.deepEqual(G.controlledArtifacts, { '0': [STAFF] });
    assert.ok(G.playerZones['0']!.discard.includes(COVERT_HERO));
    assert.equal(G.playerZones['0']!.discard.includes(STAFF), false);
    assert.ok(G.messages.some((message) => message.text.includes('keeps') && message.text.includes('as an Artifact')));
  });

  it('a kept card stays across a second cleanup', () => {
    const G = makeState(buildHooks(['dstr/doctor-voodoo']));
    playCard(G, STAFF);
    endTurn(G);
    endTurn(G);
    assert.deepEqual(G.controlledArtifacts, { '0': [STAFF] });
  });

  it('a match without a marked card never gains controlledArtifacts', () => {
    const G = makeState([]);
    G.playerZones['0']!.inPlay.push(COVERT_HERO);
    endTurn(G);
    assert.equal(Object.hasOwn(G, 'controlledArtifacts'), false);
  });
});

describe('Staff of Legba Ritual (WP-858 / D-24794)', () => {
  it('is not listed until a Hero is recruited this turn', () => {
    const G = makeState(buildHooks(['dstr/doctor-voodoo']));
    playCard(G, STAFF);
    assert.deepEqual(ritualArtifactOptions(G, '0'), []);
  });

  it('after a 5-cost Hero and an Officer, use from play gives +5 and the card still counts as played', () => {
    const G = makeState(buildHooks(['dstr/doctor-voodoo']));
    playCard(G, STAFF);
    recruitFiveCostHero(G);
    G.turnEconomy = { ...G.turnEconomy, recruit: G.turnEconomy.recruit + 3 };
    recruitOfficer(moveContext(G));
    assert.equal(G.turnEconomy.highestRecruitedHeroCost, 5, 'the highest recruited cost is kept');
    assert.deepEqual(ritualArtifactOptions(G, '0'), [STAFF]);
    const attackBefore = G.turnEconomy.attack;
    useRitualArtifact(moveContext(G), { cardId: STAFF });
    assert.equal(G.turnEconomy.attack - attackBefore, 5);
    assert.ok(G.playerZones['0']!.discard.includes(STAFF));
    assert.equal(G.playerZones['0']!.inPlay.includes(STAFF), false);
    assert.deepEqual(G.turnEconomy.ritualUsedPlayedCardIds, [STAFF]);
    assert.ok(playedCardIdsThisTurn(G, G.playerZones['0']!.inPlay).includes(STAFF), 'still played this turn');
    assert.ok(G.messages.some((message) => message.text.includes("'s Ritual: discarded it.")));
  });

  it('a controlled Staff is used on a later turn and the record empties', () => {
    const G = makeState(buildHooks(['dstr/doctor-voodoo']));
    playCard(G, STAFF);
    endTurn(G);
    recruitFiveCostHero(G);
    assert.deepEqual(ritualArtifactOptions(G, '0'), [STAFF]);
    useRitualArtifact(moveContext(G), { cardId: STAFF });
    assert.equal(G.turnEconomy.attack, 5);
    assert.equal(Object.hasOwn(G, 'controlledArtifacts'), false, 'the empty key and map are deleted');
    assert.equal(G.turnEconomy.ritualUsedPlayedCardIds, undefined, 'a controlled card was not played this turn');
  });

  it('two controlled Staffs are both usable from one recruit, each for the cost', () => {
    const G = makeState(buildHooks(['dstr/doctor-voodoo']));
    G.controlledArtifacts = { '0': [STAFF, STAFF_TWO] };
    recruitFiveCostHero(G);
    assert.deepEqual(ritualArtifactOptions(G, '0'), [STAFF, STAFF_TWO]);
    useRitualArtifact(moveContext(G), { cardId: STAFF });
    useRitualArtifact(moveContext(G), { cardId: STAFF_TWO });
    assert.equal(G.turnEconomy.attack, 10);
  });

  it('a recruit in a match without a Staff hook writes no record', () => {
    const G = makeState(buildHooks(['dstr/doctor-strange']));
    assert.equal(matchHasRecruitedHeroRitual(G), false);
    recruitFiveCostHero(G);
    assert.equal(Object.hasOwn(G.turnEconomy, 'highestRecruitedHeroCost'), false);
  });
});

describe('Medallion of Many Loas Ritual (WP-858 / D-24794)', () => {
  it('needs three Hero Classes; three in hand + play gives +3', () => {
    const G = makeState(buildHooks(['dstr/doctor-voodoo']));
    playCard(G, MEDALLION);
    G.playerZones['0']!.hand.push(COVERT_HERO);
    assert.deepEqual(ritualArtifactOptions(G, '0'), [], 'two classes is not enough');
    G.playerZones['0']!.hand.push(RANGED_HERO);
    assert.deepEqual(ritualArtifactOptions(G, '0'), [MEDALLION]);
    useRitualArtifact(moveContext(G), { cardId: MEDALLION });
    assert.equal(G.turnEconomy.attack, 3, 'tech + covert + ranged, including the Medallion itself');
  });

  it('a controlled Artifact adds its class: four classes give +4', () => {
    const G = makeState(buildHooks(['dstr/doctor-voodoo']));
    G.controlledArtifacts = { '0': [STAFF] };
    playCard(G, MEDALLION);
    G.playerZones['0']!.hand.push(COVERT_HERO, RANGED_HERO);
    assert.equal(ritualArtifactReward(G, '0', MEDALLION), 4, 'strength from the controlled Staff');
    useRitualArtifact(moveContext(G), { cardId: MEDALLION });
    assert.equal(G.turnEconomy.attack, 4);
  });

  it('a controlled Medallion counts itself ("including this one")', () => {
    const G = makeState(buildHooks(['dstr/doctor-voodoo']));
    G.controlledArtifacts = { '0': [MEDALLION] };
    G.playerZones['0']!.hand.push(COVERT_HERO, RANGED_HERO);
    assert.deepEqual(ritualArtifactOptions(G, '0'), [MEDALLION]);
    assert.equal(ritualArtifactReward(G, '0', MEDALLION), 3);
  });

  it('after use from play it still counts as played but is no longer a class you have', () => {
    const G = makeState(buildHooks(['dstr/doctor-voodoo']));
    playCard(G, MEDALLION);
    G.playerZones['0']!.hand.push(COVERT_HERO, RANGED_HERO);
    useRitualArtifact(moveContext(G), { cardId: MEDALLION });
    assert.equal(Object.hasOwn(G.turnEconomy, 'outOfTimePlayedCardIds'), false, 'no Out of Time ledger');
    assert.ok(playedCardIdsThisTurn(G, G.playerZones['0']!.inPlay).includes(MEDALLION), 'played this turn');
    assert.equal(countDistinctHeroClassesYouHave(G, '0'), 2, 'the discarded Medallion is not a Hero you have');
  });
});

describe('useRitualArtifact refusals (WP-858 / D-24794)', () => {
  /**
   * A state where the controlled Staff is usable, for the no-op cases.
   *
   * @returns The state.
   */
  function usableState(): LegendaryGameState {
    const G = makeState(buildHooks(['dstr/doctor-voodoo']));
    G.controlledArtifacts = { '0': [STAFF] };
    recruitFiveCostHero(G);
    return G;
  }

  it('is a silent no-op outside main, with a choice open, for a non-ritual card or a card not held', () => {
    const outsideMain = usableState();
    outsideMain.currentStage = 'cleanup';
    const outsideMainBefore = JSON.stringify(outsideMain);
    useRitualArtifact(moveContext(outsideMain), { cardId: STAFF });
    assert.equal(JSON.stringify(outsideMain), outsideMainBefore, 'outside main');

    const withChoice = usableState();
    withChoice.pendingKoDiscardChoices = [{ choiceType: 'ko-from-discard', playerID: '0', maxCount: 1 }];
    assert.deepEqual(ritualArtifactOptions(withChoice, '0'), [], 'no option while a choice is open');
    const withChoiceBefore = JSON.stringify(withChoice);
    useRitualArtifact(moveContext(withChoice), { cardId: STAFF });
    assert.equal(JSON.stringify(withChoice), withChoiceBefore, 'pending choice');

    const nonRitual = usableState();
    nonRitual.playerZones['0']!.inPlay.push(COVERT_HERO);
    const nonRitualBefore = JSON.stringify(nonRitual);
    useRitualArtifact(moveContext(nonRitual), { cardId: COVERT_HERO });
    assert.equal(JSON.stringify(nonRitual), nonRitualBefore, 'non-ritual card');

    const notHeld = usableState();
    const notHeldBefore = JSON.stringify(notHeld);
    useRitualArtifact(moveContext(notHeld), { cardId: STAFF_TWO });
    useRitualArtifact(moveContext(notHeld), undefined as never);
    assert.equal(JSON.stringify(notHeld), notHeldBefore, 'card not held / no payload');
  });
});
