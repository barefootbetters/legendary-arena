/**
 * exorciseHauntedHero move tests (WP-757 / D-24587).
 *
 * Verifies the Haunt exorcise move: it pays exactly the Haunted Hero's cost, KOs the
 * Hero or gives it to any player's discard, refills the HQ slot unhaunted, and
 * releases the haunter — a Villain enters City space 0 ignoring its Ambush (with full
 * escape handling if the City is full); a Mastermind returns to the Mastermind space.
 * Every invalid call is a silent no-op that leaves G untouched, and the move never
 * throws.
 *
 * Uses node:test and node:assert only. Uses makeMockMoveContext. No boardgame.io
 * imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { exorciseHauntedHero } from './exorciseHauntedHero.js';
import type { ExorciseHauntedHeroArgs } from './exorciseHauntedHero.js';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { VillainAbilityHook } from '../rules/villainAbility.types.js';
import { initializeCity } from '../board/city.logic.js';
import { hauntHqSlot, isHqSlotHaunted, isMastermindHaunting } from '../board/haunt.logic.js';
import { revealVillainCard } from '../villainDeck/villainDeck.reveal.js';
import { buildDefaultHookDefinitions } from '../rules/ruleRuntime.impl.js';
import { ENDGAME_CONDITIONS } from '../endgame/endgame.types.js';
import { makeMockMoveContext } from '../test/mockMoveContext.js';
import type { MockMoveContext } from '../test/mockMoveContext.js';
import {
  makeCardStatEntry,
  makeGlobalPiles,
  makeMastermindState,
  makePlayerZones,
  makeTurnEconomy,
} from '../test/fixtureBuilders.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const HAUNTED_HERO = 'test/haunted-hero#0';
const OTHER_HERO = 'test/other-hero#0';
const REFILL_HERO = 'test/refill-hero#0';
const HAUNTING_VILLAIN = 'test/haunting-villain#0';
const HAUNTED_HERO_COST = 4;

/**
 * An onAmbush hook that wounds each player — the same parser-output shape the
 * economy integration tests use. Used to prove exorcise does NOT fire Ambush.
 */
function ambushWoundEachPlayerHook(cardId: CardExtId): VillainAbilityHook {
  return {
    cardId,
    timing: 'onAmbush',
    keywords: ['gainWoundEachPlayer'],
    effects: [{ primitive: 'gain-wound', target: 'each' }],
  } as VillainAbilityHook;
}

/**
 * Creates a two-seat LegendaryGameState with HQ slot 0 holding the Haunted Hero,
 * haunted by a Villain, and 10 recruit available to player 0 in the main stage.
 */
function createHauntedGameState(): LegendaryGameState {
  const config: MatchSetupConfig = {
    schemeId: 'test-scheme',
    mastermindId: 'test-mastermind',
    villainGroupIds: ['test-villain-group'],
    henchmanGroupIds: ['test-henchman-group'],
    heroDeckIds: ['test-hero-deck'],
    bystandersCount: 5,
    woundsCount: 5,
    officersCount: 1,
    sidekicksCount: 1,
  };

  const gameState: LegendaryGameState = {
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
      '0': { ...makePlayerZones(), deck: ['p0-deck-card'], hand: [], discard: [], inPlay: [], victory: [] },
      '1': { ...makePlayerZones(), deck: [], hand: [], discard: [], inPlay: [], victory: [] },
    },
    piles: { ...makeGlobalPiles(),
      bystanders: ['bystander-1', 'bystander-2'],
      wounds: ['wound-1', 'wound-2', 'wound-3'],
      officers: [],
      sidekicks: [],
    },
    messages: [],
    notableEvents: [],
    counters: {},
    hookRegistry: buildDefaultHookDefinitions(config),
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: {},
    ko: [],
    attachedBystanders: {},
    villainAttachedHeroes: {},
    turnEconomy: { ...makeTurnEconomy(), attack: 0, recruit: 10, spentAttack: 0, spentRecruit: 0 },
    cardStats: {
      [HAUNTED_HERO]: { ...makeCardStatEntry(), cost: HAUNTED_HERO_COST },
      [OTHER_HERO]: { ...makeCardStatEntry(), cost: 1 },
      [REFILL_HERO]: { ...makeCardStatEntry(), cost: 2 },
    },
    mastermind: { ...makeMastermindState(),
      id: 'test-mastermind',
      baseCardId: 'test-mastermind-base',
      tacticsDeck: ['tactic-1'],
      tacticsDefeated: [],
      strikePile: [],
    },
    scheme: { twistPile: [] },
    escapedPile: [],
    city: initializeCity(),
    hq: [HAUNTED_HERO, OTHER_HERO, null, null, null],
    heroDeck: [REFILL_HERO],
    heroAbilityHooks: [],
    lobby: { requiredPlayers: 2, ready: {}, started: true },
  } as unknown as LegendaryGameState;

  // why: the haunting Villain carries a live Ambush (keyword + hook) so the release
  // path can be proven to ignore it. The control test below proves this exact setup
  // DOES fire on a normal villain-deck reveal.
  gameState.cardKeywords = { [HAUNTING_VILLAIN]: ['ambush'] } as LegendaryGameState['cardKeywords'];
  gameState.villainAbilityHooks = [ambushWoundEachPlayerHook(HAUNTING_VILLAIN)];

  hauntHqSlot(gameState, 0, { kind: 'villain', cardId: HAUNTING_VILLAIN });
  return gameState;
}

/**
 * Creates a two-seat move context with player 0 as the current player.
 */
function createMoveContext(gameState: LegendaryGameState): MockMoveContext {
  return makeMockMoveContext(gameState, { numPlayers: 2 });
}

/**
 * Runs the move with the given (possibly malformed) args and asserts G is
 * byte-identical before and after.
 */
function assertNoOp(gameState: LegendaryGameState, args: unknown, label: string): void {
  const snapshotBefore = JSON.stringify(gameState);
  const moveContext = createMoveContext(gameState);
  exorciseHauntedHero(moveContext, args as ExorciseHauntedHeroArgs);
  assert.equal(JSON.stringify(moveContext.G), snapshotBefore, `${label}: G must be unchanged`);
}

// ---------------------------------------------------------------------------
// Success paths
// ---------------------------------------------------------------------------

describe('exorciseHauntedHero — success', () => {
  it("'ko' spends exactly the Hero cost, KOs the Hero, refills the slot unhaunted, and releases the Villain to City space 0", () => {
    const gameState = createHauntedGameState();
    const moveContext = createMoveContext(gameState);

    exorciseHauntedHero(moveContext, { hqIndex: 0, outcome: 'ko' });

    const G = moveContext.G;
    assert.equal(G.turnEconomy.spentRecruit, HAUNTED_HERO_COST, 'exactly the Hero cost is spent');
    assert.equal(G.turnEconomy.recruit, 10, 'recruit total is untouched');
    assert.equal(G.hasActedThisTurn, true, 'the player is marked as having acted');
    assert.deepStrictEqual(G.ko, [HAUNTED_HERO], 'the Hero is in the KO pile');
    assert.equal(G.playerZones['0']!.discard.includes(HAUNTED_HERO), false, 'the Hero is not gained');
    assert.equal(G.hq[0], REFILL_HERO, 'the slot refilled from heroDeck');
    assert.deepStrictEqual(G.heroDeck, [], 'the refill came off heroDeck');
    assert.equal(isHqSlotHaunted(G, 0), false, 'the refilled slot is unhaunted');
    assert.deepStrictEqual(G.hqHaunters, [null, null, null, null, null], 'no haunter remains');
    assert.equal(G.hq[1], OTHER_HERO, 'the other HQ slot is untouched');
    assert.deepStrictEqual(G.city, [HAUNTING_VILLAIN, null, null, null, null], 'the Villain entered City space 0');
  });

  it('the released Villain does NOT fire its Ambush', () => {
    const gameState = createHauntedGameState();
    const moveContext = createMoveContext(gameState);

    exorciseHauntedHero(moveContext, { hqIndex: 0, outcome: 'ko' });

    const G = moveContext.G;
    assert.deepStrictEqual(G.piles.wounds, ['wound-1', 'wound-2', 'wound-3'], 'no wound left the wound pile');
    assert.equal(G.playerZones['0']!.discard.length, 0, 'player 0 gained no wound');
    assert.equal(G.playerZones['1']!.discard.length, 0, 'player 1 gained no wound');
    for (const notableEvent of G.notableEvents) {
      assert.notEqual(notableEvent.type, 'ambushResolved', 'no ambushResolved event is recorded');
    }
  });

  it('control: the same Villain fires its Ambush when revealed normally (proves the no-Ambush test is meaningful)', () => {
    const gameState = createHauntedGameState();
    // why: remove the haunt so the Villain is an ordinary villain-deck card.
    delete gameState.hqHaunters;
    gameState.currentStage = 'start';
    gameState.villainDeck = { deck: [HAUNTING_VILLAIN], discard: [] };
    gameState.villainDeckCardTypes = { [HAUNTING_VILLAIN]: 'villain' };
    const moveContext = createMoveContext(gameState);

    revealVillainCard(moveContext);

    assert.equal(moveContext.G.city[0], HAUNTING_VILLAIN, 'the Villain entered the City via reveal');
    assert.ok(moveContext.G.piles.wounds.length < 3, 'the Ambush wounded at least one player on a normal reveal');
  });

  it('exorcise is not a recruit: the Hero\'s onRecruit hook does not fire', () => {
    const gameState = createHauntedGameState();
    gameState.heroAbilityHooks = [
      { cardId: HAUNTED_HERO, timing: 'onRecruit', keywords: ['draw'], effects: [{ type: 'draw', magnitude: 1 }] },
    ] as LegendaryGameState['heroAbilityHooks'];
    const moveContext = createMoveContext(gameState);

    exorciseHauntedHero(moveContext, { hqIndex: 0, outcome: 'ko' });

    assert.deepStrictEqual(moveContext.G.playerZones['0']!.hand, [], 'no card was drawn');
    assert.deepStrictEqual(moveContext.G.playerZones['0']!.deck, ['p0-deck-card'], 'the deck is untouched');
  });

  it("'gain' to the active player puts the Hero in that player's discard", () => {
    const gameState = createHauntedGameState();
    const moveContext = createMoveContext(gameState);

    exorciseHauntedHero(moveContext, { hqIndex: 0, outcome: 'gain', recipientPlayerId: '0' });

    const G = moveContext.G;
    assert.deepStrictEqual(G.playerZones['0']!.discard, [HAUNTED_HERO], 'player 0 gained the Hero');
    assert.deepStrictEqual(G.ko, [], 'nothing was KOd');
    assert.equal(G.turnEconomy.spentRecruit, HAUNTED_HERO_COST, 'exactly the Hero cost is spent');
    assert.equal(G.city[0], HAUNTING_VILLAIN, 'the Villain was released');
  });

  it("'gain' to a NON-active recipient puts the Hero in that player's discard", () => {
    const gameState = createHauntedGameState();
    const moveContext = createMoveContext(gameState);

    exorciseHauntedHero(moveContext, { hqIndex: 0, outcome: 'gain', recipientPlayerId: '1' });

    const G = moveContext.G;
    assert.deepStrictEqual(G.playerZones['1']!.discard, [HAUNTED_HERO], 'player 1 gained the Hero');
    assert.deepStrictEqual(G.playerZones['0']!.discard, [], 'the active player gained nothing');
    assert.equal(G.turnEconomy.spentRecruit, HAUNTED_HERO_COST, 'the active player paid the cost');
    assert.equal(G.hasActedThisTurn, true, 'the active player is marked as having acted');
  });

  it('full City: the released Villain pushes the space-4 Villain out, which escapes with its bystanders', () => {
    const gameState = createHauntedGameState();
    gameState.city = ['city-v0', 'city-v1', 'city-v2', 'city-v3', 'city-v4'];
    gameState.attachedBystanders = { 'city-v4': ['captured-bystander'] };
    const moveContext = createMoveContext(gameState);

    exorciseHauntedHero(moveContext, { hqIndex: 0, outcome: 'ko' });

    const G = moveContext.G;
    assert.deepStrictEqual(
      G.city,
      [HAUNTING_VILLAIN, 'city-v0', 'city-v1', 'city-v2', 'city-v3'],
      'the City shifted and the released Villain is at space 0',
    );
    assert.equal(G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS], 1, 'the escaped counter incremented once');
    assert.ok(G.escapedPile.includes('city-v4'), 'the escaped Villain is in the escaped pile');
    assert.ok(G.escapedPile.includes('captured-bystander'), 'its bystander was carried into the escaped pile');
    assert.equal(G.attachedBystanders['city-v4'], undefined, 'the attached-bystander entry was cleared');
    assert.deepStrictEqual(G.playerZones['0']!.discard, ['wound-1'], 'the current player took the generic escape wound');
    assert.deepStrictEqual(G.playerZones['1']!.discard, [], 'the other player was not wounded (no Ambush)');
  });

  it('Mastermind haunter: released back to the Mastermind space with a log line; City unchanged', () => {
    const gameState = createHauntedGameState();
    gameState.hqHaunters = [{ kind: 'mastermind' }, null, null, null, null];
    assert.equal(isMastermindHaunting(gameState), true, 'precondition: the Mastermind haunts');
    const cityBefore = [...gameState.city];
    const moveContext = createMoveContext(gameState);

    exorciseHauntedHero(moveContext, { hqIndex: 0, outcome: 'ko' });

    const G = moveContext.G;
    assert.equal(G.hqHaunters![0], null, 'the haunter entry is cleared');
    assert.equal(isMastermindHaunting(G), false, 'the Mastermind no longer haunts');
    assert.deepStrictEqual(G.city, cityBefore, 'the City is unchanged');
    assert.deepStrictEqual(G.ko, [HAUNTED_HERO], 'the Hero was KOd');
    const hasReturnLine = G.messages.some((message) => message.text.includes('returns to the Mastermind space.'));
    assert.ok(hasReturnLine, 'a "returns to the Mastermind space." log line is present');
  });

  it('empty heroDeck: the slot ends null and the haunter is cleared', () => {
    const gameState = createHauntedGameState();
    gameState.heroDeck = [];
    const moveContext = createMoveContext(gameState);

    exorciseHauntedHero(moveContext, { hqIndex: 0, outcome: 'ko' });

    const G = moveContext.G;
    assert.equal(G.hq[0], null, 'the slot is empty');
    assert.equal(isHqSlotHaunted(G, 0), false, 'the haunter is cleared');
    assert.deepStrictEqual(G.ko, [HAUNTED_HERO], 'the Hero was KOd');
    assert.equal(G.city[0], HAUNTING_VILLAIN, 'the Villain was released');
  });
});

// ---------------------------------------------------------------------------
// Silent no-ops
// ---------------------------------------------------------------------------

describe('exorciseHauntedHero — silent no-ops', () => {
  it('invalid hqIndex (-1, 5, 1.5, NaN, "x") changes nothing', () => {
    const invalidIndexes: unknown[] = [-1, 5, 1.5, Number.NaN, 'x', '0'];
    for (const hqIndex of invalidIndexes) {
      assertNoOp(createHauntedGameState(), { hqIndex, outcome: 'ko' }, `hqIndex ${String(hqIndex)}`);
    }
  });

  it('a null HQ slot changes nothing even when that slot is haunted', () => {
    const gameState = createHauntedGameState();
    // why: a haunter survives on an empty slot when the Hero deck ran dry.
    gameState.hq[0] = null;
    assertNoOp(gameState, { hqIndex: 0, outcome: 'ko' }, 'null haunted slot');
  });

  it('an unhaunted slot changes nothing', () => {
    assertNoOp(createHauntedGameState(), { hqIndex: 1, outcome: 'ko' }, 'unhaunted slot 1');
  });

  it('a match that never haunted (no hqHaunters) changes nothing', () => {
    const gameState = createHauntedGameState();
    delete gameState.hqHaunters;
    assertNoOp(gameState, { hqIndex: 0, outcome: 'ko' }, 'no hqHaunters');
  });

  it('a bad outcome changes nothing', () => {
    const badOutcomes: unknown[] = ['recruit', 'KO', undefined, null, 1];
    for (const outcome of badOutcomes) {
      assertNoOp(createHauntedGameState(), { hqIndex: 0, outcome }, `outcome ${String(outcome)}`);
    }
  });

  it("'gain' without a recipient, or with an unknown / non-string recipient, changes nothing", () => {
    assertNoOp(createHauntedGameState(), { hqIndex: 0, outcome: 'gain' }, 'missing recipient');
    assertNoOp(createHauntedGameState(), { hqIndex: 0, outcome: 'gain', recipientPlayerId: '7' }, 'unknown recipient');
    assertNoOp(createHauntedGameState(), { hqIndex: 0, outcome: 'gain', recipientPlayerId: 1 }, 'numeric recipient');
  });

  it('insufficient recruit changes nothing', () => {
    const gameState = createHauntedGameState();
    // why: 10 recruit with 7 already spent leaves 3 available against a cost of 4.
    gameState.turnEconomy = { ...gameState.turnEconomy, recruit: 10, spentRecruit: 7 };
    assertNoOp(gameState, { hqIndex: 0, outcome: 'ko' }, 'insufficient recruit');
  });

  it("wrong stage ('start', 'cleanup') changes nothing", () => {
    for (const stage of ['start', 'cleanup'] as const) {
      const gameState = createHauntedGameState();
      gameState.currentStage = stage;
      assertNoOp(gameState, { hqIndex: 0, outcome: 'ko' }, `stage ${stage}`);
    }
  });

  it('an outstanding KO-a-Hero pending choice changes nothing', () => {
    const gameState = createHauntedGameState();
    gameState.pendingKoHeroChoices = [{ choiceType: 'ko-hero', playerID: '0' }];
    assertNoOp(gameState, { hqIndex: 0, outcome: 'ko' }, 'pending ko-hero choice');
  });

  it('an outstanding give-HQ-Hero pending choice changes nothing', () => {
    const gameState = createHauntedGameState();
    gameState.pendingGiveHqHeroChoices = [{ choiceType: 'give-hq-hero', playerID: '1' }];
    assertNoOp(gameState, { hqIndex: 0, outcome: 'gain', recipientPlayerId: '0' }, 'pending give-hq-hero choice');
  });

  it('after Wound Healing this turn, exorcise changes nothing', () => {
    const gameState = createHauntedGameState();
    gameState.hasHealedThisTurn = true;
    assertNoOp(gameState, { hqIndex: 0, outcome: 'ko' }, 'healed this turn');
  });

  it('a second exorcise of the same (now unhaunted) slot changes nothing', () => {
    const gameState = createHauntedGameState();
    const moveContext = createMoveContext(gameState);
    exorciseHauntedHero(moveContext, { hqIndex: 0, outcome: 'ko' });
    assertNoOp(moveContext.G, { hqIndex: 0, outcome: 'ko' }, 'second exorcise');
  });
});

// ---------------------------------------------------------------------------
// Never throws
// ---------------------------------------------------------------------------

describe('exorciseHauntedHero — never throws', () => {
  it('malformed args (null, undefined, {}, a string, an array) never throw and change nothing', () => {
    const malformedArgs: unknown[] = [null, undefined, {}, 'ko', [0, 'ko']];
    for (const args of malformedArgs) {
      const gameState = createHauntedGameState();
      const snapshotBefore = JSON.stringify(gameState);
      const moveContext = createMoveContext(gameState);
      assert.doesNotThrow(
        () => exorciseHauntedHero(moveContext, args as ExorciseHauntedHeroArgs),
        `args ${JSON.stringify(args) ?? 'undefined'} must not throw`,
      );
      assert.equal(JSON.stringify(moveContext.G), snapshotBefore, `args ${JSON.stringify(args) ?? 'undefined'}: G unchanged`);
    }
  });
});
