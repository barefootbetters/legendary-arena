/**
 * Indestructible Man tests (WP-768 / D-24601): the shuffle-fight helpers, the fightMastermind
 * path, the Master Strike, the four tactics and the bot intents.
 *
 * node:test + node:assert only. makeMockCtx / makeMockMoveContext (Shuffle reverses). No
 * boardgame.io/testing import.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ELITE_ASSASSIN_EXT_ID_PREFIX,
  INDESTRUCTIBLE_MAN_MASTERMIND_ID,
  canShuffleFight,
  isIndestructibleMan,
  isShuffleFightOpen,
  isValidShuffleFightPick,
  listEligibleAssassins,
  selectLowestVpAssassins,
  shuffleIntoVillainDeck,
} from './indestructibleMan.logic.js';
import { fightMastermind } from '../moves/fightMastermind.js';
import { mastermindStrikeHandler } from '../rules/mastermindHandlers.js';
import { dispatchTacticOnFight, dropStaleArmsDealerGain, resolveDarkTechnology } from '../rules/tacticHandlers.js';
import { getLegalMoves } from '../simulation/ai.legalMoves.js';
import { applyOnBeginParity } from '../simulation/onBeginParity.js';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { DEFAULT_IMPLEMENTATION_MAP } from '../rules/ruleRuntime.impl.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { makeMockMoveContext } from '../test/mockMoveContext.js';
import { makeCardRegistryReader, makeCardStatEntry } from '../test/fixtureBuilders.js';
import { WOUND_EXT_ID } from '../setup/pilesInit.js';
import { LegendaryGame } from '../game.js';
import type { LegendaryGameState, MatchConfiguration } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BLUE_TALON_00 = `${ELITE_ASSASSIN_EXT_ID_PREFIX}blue-talon-00` as CardExtId;
const BLUE_TALON_01 = `${ELITE_ASSASSIN_EXT_ID_PREFIX}blue-talon-01` as CardExtId;
const IRON_MAIDEN_00 = `${ELITE_ASSASSIN_EXT_ID_PREFIX}iron-maiden-00` as CardExtId;
const BLACK_LOTUS_00 = `${ELITE_ASSASSIN_EXT_ID_PREFIX}black-lotus-00` as CardExtId;
const OTHER_VILLAIN = 'bkwd-villain-taskmasters-thunderbolts-songbird-00' as CardExtId;

const SECRETS = 'bkwd-mastermind-indestructible-man-secrets-of-indestructibility' as CardExtId;
const ARMS_DEALER = 'bkwd-mastermind-indestructible-man-international-arms-dealer' as CardExtId;
const PROJECT_FOUR = 'bkwd-mastermind-indestructible-man-unveil-project-four' as CardExtId;
const MAD_MONK = 'bkwd-mastermind-indestructible-man-manipulate-murderous-mad-monk' as CardExtId;

const DECK_CARD_A = 'deck-villain-a' as CardExtId;
const DECK_CARD_B = 'deck-villain-b' as CardExtId;
const DECK_CARD_C = 'deck-villain-c' as CardExtId;

/** The setup composition every fixture builds from (a mock registry). */
function createTestConfig(): MatchSetupConfig {
  return {
    schemeId: 'test-scheme-001',
    mastermindId: 'test-mastermind-001',
    villainGroupIds: ['test-villain-group-001'],
    henchmanGroupIds: ['test-henchman-group-001'],
    heroDeckIds: ['test-hero-deck-001', 'test-hero-deck-002'],
    bystandersCount: 10,
    woundsCount: 15,
    officersCount: 20,
    sidekicksCount: 5,
  };
}

/**
 * Builds a two-seat game state with Indestructible Man as the Mastermind.
 *
 * Player 0 holds Blue Talon ×2, Iron Maiden and Black Lotus (VP 2/2/2/3) plus a non-Assassin in
 * their Victory Pile; player 1 holds one Iron Maiden copy. The Villain Deck holds three plain
 * Villains.
 *
 * @param mastermindId - The selected Mastermind (Indestructible Man by default).
 * @returns The state.
 */
function makeState(mastermindId: string = INDESTRUCTIBLE_MAN_MASTERMIND_ID): LegendaryGameState {
  const baseState = buildInitialGameState(createTestConfig(), makeCardRegistryReader(), makeMockCtx());
  const gameState: LegendaryGameState = {
    ...baseState,
    selection: { ...baseState.selection, mastermindId },
  };
  gameState.currentStage = 'main';
  gameState.mastermind = {
    ...gameState.mastermind,
    baseCardId: 'bkwd-mastermind-indestructible-man' as CardExtId,
    tacticsDeck: [SECRETS, ARMS_DEALER, PROJECT_FOUR, MAD_MONK],
    tacticsDefeated: [],
  };
  gameState.cardStats['bkwd-mastermind-indestructible-man' as CardExtId] = makeCardStatEntry({ fightCost: 0 });
  gameState.playerZones['0']!.victory = [BLUE_TALON_00, BLACK_LOTUS_00, OTHER_VILLAIN, IRON_MAIDEN_00, BLUE_TALON_01];
  gameState.playerZones['1']!.victory = [`${ELITE_ASSASSIN_EXT_ID_PREFIX}iron-maiden-01` as CardExtId];
  for (const cardId of [BLUE_TALON_00, BLUE_TALON_01, IRON_MAIDEN_00, BLACK_LOTUS_00, OTHER_VILLAIN, DECK_CARD_A, DECK_CARD_B, DECK_CARD_C]) {
    gameState.villainDeckCardTypes[cardId] = 'villain';
  }
  gameState.cardVictoryPoints = {
    ...gameState.cardVictoryPoints,
    [BLUE_TALON_00]: 2,
    [BLUE_TALON_01]: 2,
    [IRON_MAIDEN_00]: 2,
    [BLACK_LOTUS_00]: 3,
    [OTHER_VILLAIN]: 1,
  };
  gameState.villainDeck = { deck: [DECK_CARD_A, DECK_CARD_B, DECK_CARD_C], discard: [] };
  gameState.turnEconomy = { ...gameState.turnEconomy, attack: 99 };
  return gameState;
}

/** The bot's lifecycle context (seat 0, the active player). */
const LEGAL_MOVES_CONTEXT = { currentPlayer: '0', numPlayers: 2, turn: 1, phase: 'play' } as never;

/** The log lines of a state, joined for substring checks. */
function logText(gameState: LegendaryGameState): string {
  return gameState.messages.map((message) => (typeof message === 'string' ? message : JSON.stringify(message))).join('\n');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

describe('WP-768 Indestructible Man helpers', () => {
  it('identifies him and lists only Elite Assassins, in pile order', () => {
    const gameState = makeState();
    assert.equal(isIndestructibleMan(gameState), true);
    assert.equal(isIndestructibleMan(makeState('test-mastermind-001')), false);
    assert.deepEqual(listEligibleAssassins(gameState, '0'), [BLUE_TALON_00, BLACK_LOTUS_00, IRON_MAIDEN_00, BLUE_TALON_01]);
    assert.deepEqual(listEligibleAssassins(gameState, 'missing'), []);
  });

  it('validates a pick: exactly two distinct own Assassins', () => {
    const gameState = makeState();
    assert.equal(isValidShuffleFightPick(gameState, '0', [BLUE_TALON_00, IRON_MAIDEN_00]), true);
    assert.equal(isValidShuffleFightPick(gameState, '0', [BLUE_TALON_00]), false, 'one id');
    assert.equal(isValidShuffleFightPick(gameState, '0', [BLUE_TALON_00, IRON_MAIDEN_00, BLUE_TALON_01]), false, 'three ids');
    assert.equal(isValidShuffleFightPick(gameState, '0', [BLUE_TALON_00, BLUE_TALON_00]), false, 'a duplicate');
    assert.equal(isValidShuffleFightPick(gameState, '0', [BLUE_TALON_00, OTHER_VILLAIN]), false, 'a non-Assassin');
    assert.equal(
      isValidShuffleFightPick(gameState, '0', [BLUE_TALON_00, `${ELITE_ASSASSIN_EXT_ID_PREFIX}iron-maiden-01`]),
      false,
      "another player's Assassin",
    );
    assert.equal(isValidShuffleFightPick(gameState, '0', 'not-an-array'), false);
    assert.equal(isValidShuffleFightPick(gameState, '0', [BLUE_TALON_00, 7]), false);
  });

  it('picks the lowest-VP Assassins, ties by ext_id', () => {
    const gameState = makeState();
    assert.deepEqual(selectLowestVpAssassins(gameState, '0', 2), [BLUE_TALON_00, BLUE_TALON_01]);
    assert.deepEqual(selectLowestVpAssassins(gameState, '0', 1), [BLUE_TALON_00]);
    assert.deepEqual(selectLowestVpAssassins(gameState, '0', 9).at(-1), BLACK_LOTUS_00, 'Black Lotus (3 VP) last');
  });

  it('canShuffleFight needs him, an unused flag and two Assassins', () => {
    const gameState = makeState();
    assert.equal(canShuffleFight(gameState, '0'), true);
    assert.equal(canShuffleFight(gameState, '1'), false, 'one Assassin');
    gameState.indestructibleManShuffleUsedThisTurn = true;
    assert.equal(canShuffleFight(gameState, '0'), false, 'used this turn');
    assert.equal(canShuffleFight(makeState('test-mastermind-001'), '0'), false, 'another Mastermind');
  });

  it('shuffleIntoVillainDeck moves the cards and shuffles the whole deck once; null moves nothing', () => {
    const gameState = makeState();
    const moved = shuffleIntoVillainDeck(gameState, '0', [BLUE_TALON_00, IRON_MAIDEN_00], {
      random: { Shuffle: <T,>(items: T[]): T[] => [...items].reverse() },
    });
    assert.equal(moved, true);
    assert.deepEqual(gameState.villainDeck.deck, [IRON_MAIDEN_00, BLUE_TALON_00, DECK_CARD_C, DECK_CARD_B, DECK_CARD_A]);
    assert.deepEqual(gameState.playerZones['0']!.victory, [BLACK_LOTUS_00, OTHER_VILLAIN, BLUE_TALON_01]);

    const untouched = makeState();
    assert.equal(shuffleIntoVillainDeck(untouched, '0', [BLUE_TALON_00], null), false);
    assert.deepEqual(untouched.villainDeck.deck, [DECK_CARD_A, DECK_CARD_B, DECK_CARD_C]);
    assert.equal(untouched.playerZones['0']!.victory.length, 5);
    assert.match(logText(untouched), /No shuffle source was available/);
  });
});

// ---------------------------------------------------------------------------
// fightMastermind
// ---------------------------------------------------------------------------

describe('WP-768 fightMastermind against Indestructible Man', () => {
  it('T1: a plain fight changes nothing at any attack value, with or without Excessive Violence', () => {
    for (const attack of [0, 5, 99]) {
      for (const useExcessiveViolence of [false, true]) {
        const gameState = makeState();
        gameState.turnEconomy = { ...gameState.turnEconomy, attack };
        const before = structuredClone(gameState);
        fightMastermind(makeMockMoveContext(gameState), { useExcessiveViolence });
        assert.deepStrictEqual(gameState, before, `attack ${String(attack)} EV ${String(useExcessiveViolence)}`);
      }
    }
  });

  it('T2: a valid shuffle-fight pays two Assassins, defeats a tactic, spends no attack and sets the flag', () => {
    const gameState = makeState();
    gameState.mastermind = { ...gameState.mastermind, attachedBystanders: ['bystander-x' as CardExtId] };
    const economyBefore = structuredClone(gameState.turnEconomy);
    fightMastermind(makeMockMoveContext(gameState), { shuffleAssassinIds: [BLUE_TALON_00, IRON_MAIDEN_00] });

    // why: the mock Shuffle reverses, so the two Assassins land on top of the deck and Secrets'
    // "play two cards from the Villain Deck" reveals exactly them; the other three stay.
    assert.deepEqual(gameState.villainDeck.deck, [DECK_CARD_C, DECK_CARD_B, DECK_CARD_A]);
    assert.equal(gameState.playerZones['0']!.victory.includes(BLUE_TALON_00), false);
    assert.equal(gameState.playerZones['0']!.victory.includes(IRON_MAIDEN_00), false);
    assert.equal(gameState.city.includes(BLUE_TALON_00), true, 'replayed into the City');
    assert.equal(gameState.city.includes(IRON_MAIDEN_00), true, 'replayed into the City');
    assert.deepEqual(gameState.mastermind.tacticsDefeated, [SECRETS]);
    assert.equal(gameState.playerZones['0']!.victory.includes('bystander-x' as CardExtId), true, 'held Bystander rescued');
    assert.deepStrictEqual(gameState.turnEconomy, economyBefore, 'no attack spent');
    assert.equal(gameState.indestructibleManShuffleUsedThisTurn, true);
    assert.equal(gameState.hasActedThisTurn, true);
    assert.match(logText(gameState), /shuffled .* from their Victory Pile into the Villain Deck to fight/);
    // why: Secrets of Indestructibility is not the last tactic, so it played two Villain-Deck cards.
    assert.match(logText(gameState), /Secrets of Indestructibility plays the top 2 card\(s\) of the Villain Deck/);
  });

  it('T3: a second shuffle-fight in the same turn is refused; the turn reset re-opens it', () => {
    const gameState = makeState();
    const moveContext = makeMockMoveContext(gameState);
    fightMastermind(moveContext, { shuffleAssassinIds: [BLUE_TALON_00, IRON_MAIDEN_00] });
    const afterFirst = structuredClone(gameState);
    fightMastermind(moveContext, { shuffleAssassinIds: [BLACK_LOTUS_00, BLUE_TALON_01] });
    assert.deepStrictEqual(gameState, afterFirst, 'second fight refused');

    applyOnBeginParity(gameState, '0');
    assert.equal(Object.prototype.hasOwnProperty.call(gameState, 'indestructibleManShuffleUsedThisTurn'), false);
    gameState.currentStage = 'main';
    fightMastermind(moveContext, { shuffleAssassinIds: [BLACK_LOTUS_00, BLUE_TALON_01] });
    assert.equal(gameState.mastermind.tacticsDefeated.length, 2, 'the next turn may shuffle-fight again');
  });

  it('T3: the live turn.onBegin clears the flag and creates no key when unset', () => {
    const playTurn = (
      LegendaryGame.phases as Record<string, { turn?: { onBegin?: (context: unknown) => void } }>
    ).play!.turn!;
    const setupState = LegendaryGame.setup!(
      makeMockCtx({ numPlayers: 2 }) as Parameters<NonNullable<typeof LegendaryGame.setup>>[0],
      {
        schemeId: 'test/test-scheme-001',
        mastermindId: 'test/test-mastermind-001',
        villainGroupIds: ['test/test-villain-group-001'],
        henchmanGroupIds: ['test/test-henchman-group-001'],
        heroDeckIds: ['test/test-hero-deck-001', 'test/test-hero-deck-002', 'test/test-hero-deck-003'],
        bystandersCount: 30,
        woundsCount: 30,
        officersCount: 30,
        sidekicksCount: 0,
      } as MatchConfiguration,
    );
    const beginContext = {
      G: setupState,
      ctx: { currentPlayer: '0', numPlayers: 2, phase: 'play', turn: 2 },
      random: { Shuffle: <T,>(deck: T[]): T[] => [...deck].reverse() },
      events: { setPhase: (): void => {}, endTurn: (): void => {} },
    };
    playTurn.onBegin!(beginContext);
    assert.equal(Object.prototype.hasOwnProperty.call(setupState, 'indestructibleManShuffleUsedThisTurn'), false);
    setupState.indestructibleManShuffleUsedThisTurn = true;
    playTurn.onBegin!(beginContext);
    assert.equal(setupState.indestructibleManShuffleUsedThisTurn, undefined);
  });

  it('T4: invalid picks and every existing gate refuse with G unchanged', () => {
    const cases: { label: string; prepare: (gameState: LegendaryGameState) => void; ids: readonly string[] }[] = [
      { label: 'one id', prepare: () => {}, ids: [BLUE_TALON_00] },
      { label: 'three ids', prepare: () => {}, ids: [BLUE_TALON_00, IRON_MAIDEN_00, BLUE_TALON_01] },
      { label: 'duplicate', prepare: () => {}, ids: [BLUE_TALON_00, BLUE_TALON_00] },
      { label: "another player's", prepare: () => {}, ids: [BLUE_TALON_00, `${ELITE_ASSASSIN_EXT_ID_PREFIX}iron-maiden-01`] },
      { label: 'non-Assassin', prepare: () => {}, ids: [BLUE_TALON_00, OTHER_VILLAIN] },
      { label: 'fewer than two eligible', prepare: (gameState) => { gameState.playerZones['0']!.victory = [BLUE_TALON_00]; }, ids: [BLUE_TALON_00, IRON_MAIDEN_00] },
      { label: 'not main', prepare: (gameState) => { gameState.currentStage = 'start'; }, ids: [BLUE_TALON_00, IRON_MAIDEN_00] },
      { label: 'healed', prepare: (gameState) => { gameState.hasHealedThisTurn = true; }, ids: [BLUE_TALON_00, IRON_MAIDEN_00] },
      { label: 'guarded', prepare: (gameState) => { gameState.villainsBesideMastermind = ['blob-00' as CardExtId]; }, ids: [BLUE_TALON_00, IRON_MAIDEN_00] },
      { label: 'haunting', prepare: (gameState) => { gameState.hqHaunters = [{ kind: 'mastermind' }, null, null, null, null]; }, ids: [BLUE_TALON_00, IRON_MAIDEN_00] },
      { label: 'block-all pending', prepare: (gameState) => { gameState.pendingGiveHqHeroChoices = [{ choiceType: 'give-hq-hero', playerID: '0' }]; }, ids: [BLUE_TALON_00, IRON_MAIDEN_00] },
    ];
    for (const testCase of cases) {
      const gameState = makeState();
      testCase.prepare(gameState);
      const before = structuredClone(gameState);
      fightMastermind(makeMockMoveContext(gameState), { shuffleAssassinIds: testCase.ids });
      assert.deepStrictEqual(gameState, before, testCase.label);
    }
  });

  it('T5: under the Final Blow the shuffle-fight after the 4th tactic awards the Mastermind card', () => {
    const gameState = makeState();
    gameState.finalBlow = true;
    gameState.mastermind = { ...gameState.mastermind, tacticsDeck: [], tacticsDefeated: [SECRETS, ARMS_DEALER, PROJECT_FOUR, MAD_MONK], finalBlowPending: true };
    fightMastermind(makeMockMoveContext(gameState), { shuffleAssassinIds: [BLUE_TALON_00, IRON_MAIDEN_00] });
    assert.equal(gameState.playerZones['0']!.victory.includes('bkwd-mastermind-indestructible-man' as CardExtId), true);
  });

  it('T7: another Mastermind ignores shuffleAssassinIds (same as a plain fight)', () => {
    const withArgument = makeState('test-mastermind-001');
    const plain = makeState('test-mastermind-001');
    fightMastermind(makeMockMoveContext(withArgument), { shuffleAssassinIds: [BLUE_TALON_00, IRON_MAIDEN_00] });
    fightMastermind(makeMockMoveContext(plain), {});
    assert.deepStrictEqual(withArgument, plain);
    assert.deepEqual(plain.mastermind.tacticsDefeated, [SECRETS], 'the plain fight did defeat a tactic');
  });
});

// ---------------------------------------------------------------------------
// Master Strike
// ---------------------------------------------------------------------------

/** A strike context carrying the seeded Shuffle and the current player. */
function strikeContext(currentPlayer: string): unknown {
  return { random: { Shuffle: <T,>(items: T[]): T[] => [...items].reverse() }, ctx: { currentPlayer, turn: 3 } };
}

describe('WP-768 Indestructible Man Master Strike', () => {
  it('T8: shuffles the current player\'s lowest-VP Assassin in; no Wound; no hollow', () => {
    const gameState = makeState();
    const woundsBefore = gameState.piles.wounds.length;
    mastermindStrikeHandler(gameState, strikeContext('0'), { cardId: 'strike-00' }, DEFAULT_IMPLEMENTATION_MAP);
    assert.equal(gameState.villainDeck.deck.includes(BLUE_TALON_00), true);
    assert.equal(gameState.playerZones['0']!.victory.includes(BLUE_TALON_00), false);
    assert.equal(gameState.playerZones['0']!.victory.includes(BLUE_TALON_01), true, 'only one Assassin');
    assert.equal(gameState.piles.wounds.length, woundsBefore);
    assert.equal(gameState.diagnostics?.hollowEffects?.length ?? 0, 0);
  });

  it('T8: with no Assassin every player gains a Wound, current player first then clockwise', () => {
    const gameState = makeState();
    gameState.playerZones['1']!.victory = [];
    const woundsBefore = gameState.piles.wounds.length;
    mastermindStrikeHandler(gameState, strikeContext('1'), { cardId: 'strike-00' }, DEFAULT_IMPLEMENTATION_MAP);
    assert.equal(gameState.piles.wounds.length, woundsBefore - 2);
    assert.equal(gameState.playerZones['0']!.discard.includes(WOUND_EXT_ID), true);
    assert.equal(gameState.playerZones['1']!.discard.includes(WOUND_EXT_ID), true);
    const lines = logText(gameState).split('\n').filter((line) => line.includes('[Indestructible Man Master Strike]'));
    assert.match(lines[0]!, /Player 1/, 'the current player first');
    assert.match(lines[1]!, /Player 0/);
    assert.equal(gameState.diagnostics?.hollowEffects?.length ?? 0, 0);
  });
});

// ---------------------------------------------------------------------------
// Tactics
// ---------------------------------------------------------------------------

/** A tactic shuffle context (reverses). */
const SHUFFLE_CONTEXT = { random: { Shuffle: <T,>(items: T[]): T[] => [...items].reverse() } };

/**
 * Dispatches a tactic after removing it from the tactics deck (the defeat core's order).
 *
 * @param gameState - The state.
 * @param tacticId - The defeated tactic.
 */
function defeatTactic(gameState: LegendaryGameState, tacticId: CardExtId): void {
  gameState.mastermind = {
    ...gameState.mastermind,
    tacticsDeck: gameState.mastermind.tacticsDeck.filter((cardId) => cardId !== tacticId),
  };
  dispatchTacticOnFight(gameState, { currentPlayer: '0', turn: 3 }, tacticId, SHUFFLE_CONTEXT);
}

describe('WP-768 Indestructible Man tactics', () => {
  it('T9 Secrets: KOs up to two Wounds, hand first; zero Wounds is a blocked line', () => {
    const gameState = makeState();
    gameState.playerZones['0']!.hand = [WOUND_EXT_ID, 'hero-a' as CardExtId];
    gameState.playerZones['0']!.discard = [WOUND_EXT_ID, WOUND_EXT_ID];
    const koBefore = gameState.ko.length;
    defeatTactic(gameState, SECRETS);
    assert.deepEqual(gameState.playerZones['0']!.hand, ['hero-a']);
    assert.deepEqual(gameState.playerZones['0']!.discard, [WOUND_EXT_ID]);
    assert.equal(gameState.ko.length, koBefore + 2);

    const none = makeState();
    none.playerZones['0']!.hand = [];
    none.playerZones['0']!.discard = [];
    defeatTactic(none, SECRETS);
    assert.match(logText(none), /no Wound in hand or discard pile to KO/);
  });

  it('T9: each of the three plays two Villain-Deck cards unless it is the last tactic', () => {
    const notLast = makeState();
    defeatTactic(notLast, SECRETS);
    assert.equal(notLast.villainDeck.deck.length, 1, 'two cards played');

    const last = makeState();
    last.mastermind = { ...last.mastermind, tacticsDeck: [SECRETS] };
    defeatTactic(last, SECRETS);
    assert.equal(last.villainDeck.deck.length, 3, 'last tactic plays nothing');
    assert.doesNotMatch(logText(last), /plays the top/);
  });

  it('T9 Arms Dealer: 1 Tech Hero auto-gains; other players reveal Tech or take a Wound', () => {
    const gameState = makeState();
    gameState.cardTraits = {
      ...gameState.cardTraits,
      'hq-tech': { heroClass: 'tech', team: null },
      'hq-ranged': { heroClass: 'ranged', team: null },
      'hand-tech': { heroClass: 'tech', team: null },
    } as LegendaryGameState['cardTraits'];
    gameState.hq = ['hq-tech', 'hq-ranged', null, null, null];
    gameState.playerZones['1']!.hand = ['hand-tech' as CardExtId];
    const woundsBefore = gameState.piles.wounds.length;
    defeatTactic(gameState, ARMS_DEALER);
    assert.equal(gameState.playerZones['0']!.discard.includes('hq-tech' as CardExtId), true, 'gained the only Tech Hero');
    assert.match(logText(gameState), /Player 0 gained .* from the HQ \(International Arms Dealer\)/);
    assert.match(logText(gameState), /Player 1 revealed .* no Wound/);
    assert.equal(gameState.piles.wounds.length, woundsBefore);

    const noTech = makeState();
    noTech.playerZones['1']!.hand = [];
    defeatTactic(noTech, ARMS_DEALER);
    assert.equal(noTech.playerZones['1']!.discard.includes(WOUND_EXT_ID), true, 'no Tech → a Wound');
    assert.match(logText(noTech), /no eligible Hero in the HQ to gain/);
  });

  it('T9 Arms Dealer: two Tech Heroes park; the play-two emptying the HQ drops the stale gain', () => {
    const gameState = makeState();
    gameState.cardTraits = {
      ...gameState.cardTraits,
      'hq-tech-1': { heroClass: 'tech', team: null },
      'hq-tech-2': { heroClass: 'tech', team: null },
    } as LegendaryGameState['cardTraits'];
    gameState.hq = ['hq-tech-1', 'hq-tech-2', null, null, null];
    gameState.mastermind = { ...gameState.mastermind, tacticsDeck: [ARMS_DEALER] };
    defeatTactic(gameState, ARMS_DEALER);
    assert.equal(gameState.pendingGiveHqHeroChoices?.length, 1, 'last tactic: no play, the gain stays parked');

    // why: the stale-gain drop (copilot finding 1): once the played cards leave no Tech Hero in
    // the HQ, the mandatory parked gain is removed so the board can't freeze; while one is still
    // eligible, it stays.
    const parked = gameState.pendingGiveHqHeroChoices![0]!;
    dropStaleArmsDealerGain(gameState, parked);
    assert.equal(gameState.pendingGiveHqHeroChoices?.length, 1, 'still eligible → kept');
    gameState.hq = [null, null, null, null, null];
    dropStaleArmsDealerGain(gameState, parked);
    assert.equal(gameState.pendingGiveHqHeroChoices?.length, 0, 'no Tech Hero left → dropped');
    assert.match(logText(gameState), /no Tech Hero is left in the HQ to gain \(International Arms Dealer\)/);
    dropStaleArmsDealerGain(gameState, null);
  });

  it('T9 Project Four: discards exactly the stat-4 cards (adjacent ones too), keeps cards without stats', () => {
    const gameState = makeState();
    gameState.cardStats['four-cost' as CardExtId] = makeCardStatEntry({ cost: 4 });
    gameState.cardStats['four-attack' as CardExtId] = makeCardStatEntry({ attack: 4, cost: 3 });
    gameState.cardStats['fourteen-recruit' as CardExtId] = makeCardStatEntry({ recruit: 14, cost: 2 });
    gameState.cardStats['plain' as CardExtId] = makeCardStatEntry({ cost: 3, attack: 2 });
    gameState.playerZones['1']!.hand = ['four-cost', 'four-attack', 'plain', 'fourteen-recruit', 'no-stats'] as CardExtId[];
    gameState.playerZones['1']!.discard = [];
    gameState.playerZones['0']!.hand = ['four-cost' as CardExtId];
    defeatTactic(gameState, PROJECT_FOUR);
    assert.deepEqual(gameState.playerZones['1']!.hand, ['plain', 'no-stats']);
    assert.deepEqual([...gameState.playerZones['1']!.discard].sort(), ['four-attack', 'four-cost', 'fourteen-recruit']);
    assert.deepEqual(gameState.playerZones['0']!.hand, ['four-cost'], 'the defeater is skipped');
    assert.match(logText(gameState), /approximate/);
  });

  it('T9 Mad Monk: records its hollow only when it is not the last tactic', () => {
    const gameState = makeState();
    defeatTactic(gameState, MAD_MONK);
    const records = gameState.diagnostics?.hollowEffects ?? [];
    assert.equal(records.length, 1);
    assert.equal(records[0]!.cardType, 'mastermind');
    assert.equal(records[0]!.mechanic, 'tactic-becomes-villain');
    assert.equal(records[0]!.turn, 3);

    const last = makeState();
    last.mastermind = { ...last.mastermind, tacticsDeck: [MAD_MONK] };
    defeatTactic(last, MAD_MONK);
    assert.equal(last.diagnostics?.hollowEffects?.length ?? 0, 0);
  });

  it('T10: Dark Technology keeps its recruit wording (the verb default)', () => {
    const gameState = makeState();
    gameState.hq = [null, null, null, null, null];
    resolveDarkTechnology(gameState, '0');
    assert.match(logText(gameState), /no eligible Hero in the HQ to recruit \(Dark Technology\); no effect\./);
  });
});

// ---------------------------------------------------------------------------
// Projection helper + bot
// ---------------------------------------------------------------------------

describe('WP-768 isShuffleFightOpen and the bot intents', () => {
  it('isShuffleFightOpen covers the board gates', () => {
    const gameState = makeState();
    assert.equal(isShuffleFightOpen(gameState, '0'), true);
    gameState.villainsBesideMastermind = ['blob-00' as CardExtId];
    assert.equal(isShuffleFightOpen(gameState, '0'), false, 'guarded');
    const noTactics = makeState();
    noTactics.mastermind = { ...noTactics.mastermind, tacticsDeck: [] };
    assert.equal(isShuffleFightOpen(noTactics, '0'), false, 'vanquished');
  });

  it('T12: no plain intent; one shuffle intent with the lowest-VP pair, even at price 1 and 0 attack', () => {
    const gameState = makeState();
    gameState.turnEconomy = { ...gameState.turnEconomy, attack: 0 };
    gameState.cardStats['bkwd-mastermind-indestructible-man' as CardExtId] = makeCardStatEntry({ fightCost: 1 });
    const fights = getLegalMoves(gameState, LEGAL_MOVES_CONTEXT).filter((move) => move.name === 'fightMastermind');
    assert.deepEqual(fights, [{ name: 'fightMastermind', args: { shuffleAssassinIds: [BLUE_TALON_00, BLUE_TALON_01] } }]);

    // why: the emitted intent commits when dispatched (D-24364 mirror).
    fightMastermind(makeMockMoveContext(gameState), fights[0]!.args as never);
    assert.deepEqual(gameState.mastermind.tacticsDefeated, [SECRETS]);
    const afterUse = getLegalMoves(gameState, LEGAL_MOVES_CONTEXT).filter((move) => move.name === 'fightMastermind');
    assert.deepEqual(afterUse, [], 'used this turn → none');
  });

  it('T12: fewer than two Assassins → no intent; another Mastermind is unchanged', () => {
    const gameState = makeState();
    gameState.playerZones['0']!.victory = [BLUE_TALON_00];
    assert.equal(getLegalMoves(gameState, LEGAL_MOVES_CONTEXT).some((move) => move.name === 'fightMastermind'), false);
    const other = makeState('test-mastermind-001');
    const plain = getLegalMoves(other, LEGAL_MOVES_CONTEXT).filter((move) => move.name === 'fightMastermind');
    assert.deepEqual(plain, [{ name: 'fightMastermind', args: {} }]);
  });
});
