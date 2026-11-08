/**
 * The Mandarin's base-face lines (WP-875 / D-24822).
 *
 * "All Mandarin's Rings get +1 Attack." and "Mandarin gets -1 Attack for each Mandarin's Ring
 * among all players' Victory Piles. (-3 Attack for each in solo.)" are read-time terms in the two
 * single cost authorities (T1-T5). "Master Strike: Each player chooses a Mandarin's Ring from
 * their Victory Pile to enter the city. Any player who didn't have a Ring gains a Wound instead."
 * Wounds each player with no available Ring at strike time and queues the rest (T6-T8); the
 * onMove opener settles, asks and enters them (T9-T14, T17, T18); the queue joins the lockstep
 * footprint (T15).
 *
 * T12 (its onMove half) and T16 alone drive boardgame.io's own reducer (the WP-411 / D-24223
 * exception, as WP-870's T17); no other case touches boardgame.io. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
// why: WP-411 / D-24223 — T12 and T16 drive a REAL boardgame.io match through the framework's own
// reducer to prove the game.ts turn.onMove wiring (the WP-870 T17 / game.test.ts precedent). The
// deep dist entry exposes InitializeGame + CreateGameReducer and carries no types (cast below).
import * as boardgameInternal from 'boardgame.io/dist/cjs/internal.js';
import { LegendaryGame } from '../game.js';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { makeMockMoveContext } from '../test/mockMoveContext.js';
import { makeCardRegistryReader } from '../test/fixtureBuilders.js';
import { resolveFightCost, resolveMastermindFightCost } from '../economy/economy.resolve.js';
import { fightVillain } from '../moves/fightVillain.js';
import { fightMastermind } from '../moves/fightMastermind.js';
import { resolveVictoryPileCardPick } from '../moves/resolveVictoryPileCardPick.js';
import { resolveSeatChoice } from '../moves/seatChoice.resolve.js';
import { getLegalMoves } from '../simulation/ai.legalMoves.js';
import { buildUIState } from '../ui/uiState.build.js';
import { mastermindStrikeHandler } from '../rules/mastermindHandlers.js';
import { applyRuleEffects } from '../rules/ruleRuntime.effects.js';
import { DEFAULT_IMPLEMENTATION_MAP } from '../rules/ruleRuntime.impl.js';
import type { ImplementationMap } from '../rules/ruleRuntime.execute.js';
import { openMandarinRingEntriesIfNeeded } from '../moves/mandarinRingEntry.logic.js';
import { dropAllPendingPlayerChoices } from '../endgame/mastermindVictory.logic.js';
import { isOperatorChoiceOpen } from '../moves/operatorSetters.logic.js';
import { applyOnBeginParity } from '../simulation/onBeginParity.js';
import { ENDGAME_CONDITIONS } from '../endgame/endgame.types.js';
import { ESCAPE_HQ_KO_KIND } from '../villainDeck/villainEscapeProcedure.js';
import { WOUND_EXT_ID } from '../setup/pilesInit.js';
import {
  MANDARIN_MASTERMIND_ID,
  MANDARIN_RING_ENTRY_SEAT_CHOICE_KIND,
  countMandarinRingsInAllVictoryPiles,
  isMandarinRingCardId,
  listMandarinRingsInVictoryPile,
  mandarinRingAttackBonus,
  mandarinVictoryPileAttackReduction,
  queueMandarinRingEntry,
} from './mandarin.logic.js';
import type { LegendaryGameState } from '../types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { CardRegistryReader } from '../matchSetup.validate.js';
import type { CardExtId } from '../state/zones.types.js';
import type { RevealContext } from '../villainDeck/villainDeck.reveal.js';
import type { UICardDisplay } from '../ui/uiState.types.js';

// why: the deep dist entry carries no types; cast to the minimal shape these tests use (the
// game.test.ts / mandarinsRingsFight.test.ts precedent).
const { InitializeGame, CreateGameReducer } = boardgameInternal as unknown as {
  InitializeGame(config: { game: unknown; numPlayers: number; setupData: unknown }): {
    G: unknown;
    ctx: { currentPlayer: unknown };
  };
  CreateGameReducer(config: { game: unknown; isClient: boolean }): (
    state: unknown,
    action: { type: string; payload: unknown },
  ) => { G: unknown; ctx: { currentPlayer: unknown } };
};

const MANDARIN_BASE = 'rvlt-mastermind-mandarin-mandarin' as CardExtId;
const OTHER_MASTERMIND_ID = 'test/test-mastermind-001';
const RING_A = 'henchman-mandarins-rings-00' as CardExtId;
const RING_B = 'henchman-mandarins-rings-01' as CardExtId;
const RING_C = 'henchman-mandarins-rings-02' as CardExtId;
const RING_D = 'henchman-mandarins-rings-03' as CardExtId;
const RING_E = 'henchman-mandarins-rings-05' as CardExtId;
const RING_F = 'henchman-mandarins-rings-06' as CardExtId;
const OTHER_HENCHMAN = 'henchman-hand-ninjas-00' as CardExtId;
const CITY_VILLAINS: CardExtId[] = ['test-v0', 'test-v1', 'test-v2', 'test-v3', 'test-v4'] as CardExtId[];
const RING_NAMES: Record<string, string> = {
  [RING_A]: 'Liar, The Mento-Intensifier',
  [RING_B]: 'Nightbringer, The Black Light',
  [RING_C]: 'Remaker, The Matter-Rearranger',
  [RING_D]: 'Incandescence, The Flame Blast',
  [RING_E]: 'Influence, The Disintegration Beam',
  [RING_F]: 'Daimonic, The White Light',
};
const STRIKE_COUNT_LINE = 'Mastermind strike revealed — strike count incremented.';
const WOUND = WOUND_EXT_ID as CardExtId;

/**
 * Builds a display entry for a test card.
 *
 * @param extId - The card id.
 * @param name - The display name.
 * @returns A UICardDisplay.
 */
function display(extId: CardExtId, name: string): UICardDisplay {
  return { extId, name, imageUrl: '', cost: null };
}

/**
 * A complete game state from the real setup, with The Mandarin (or another Mastermind) leading,
 * every Ring printed at Fight 3, The Mandarin printed at Fight 16 and an empty City.
 *
 * @param numPlayers - The number of seats.
 * @param mastermindId - The leading Mastermind's id.
 * @returns A LegendaryGameState.
 */
function makeState(numPlayers: number, mastermindId: string = MANDARIN_MASTERMIND_ID): LegendaryGameState {
  const setupConfig: MatchSetupConfig = {
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
  const registry: CardRegistryReader = { ...makeCardRegistryReader(), listCards: () => [] };
  const built = buildInitialGameState(setupConfig, registry, makeMockCtx({ numPlayers }));
  const G: LegendaryGameState = {
    ...built,
    selection: { ...built.selection, mastermindId },
    mastermind: { ...built.mastermind, id: mastermindId as CardExtId, baseCardId: MANDARIN_BASE },
  };
  injectRingCards(G);
  G.city = [null, null, null, null, null];
  G.messages = [];
  G.currentStage = 'main';
  return G;
}

/**
 * Adds the Ring, other-Henchman, City-Villain and Mandarin stats, types and names to a state.
 *
 * @param G - The state, mutated in place.
 */
function injectRingCards(G: LegendaryGameState): void {
  const cardStats = { ...G.cardStats } as Record<string, { attack: number; recruit: number; cost: number; fightCost: number }>;
  const cardTypes = { ...G.villainDeckCardTypes } as Record<string, string>;
  const displayData = { ...G.cardDisplayData } as Record<string, UICardDisplay>;
  for (const ringId of Object.keys(RING_NAMES)) {
    cardStats[ringId] = { attack: 0, recruit: 0, cost: 0, fightCost: 3 };
    cardTypes[ringId] = 'henchman';
    displayData[ringId] = display(ringId as CardExtId, RING_NAMES[ringId]!);
  }
  cardStats[OTHER_HENCHMAN] = { attack: 0, recruit: 0, cost: 0, fightCost: 3 };
  cardTypes[OTHER_HENCHMAN] = 'henchman';
  for (const villainId of CITY_VILLAINS) {
    cardStats[villainId] = { attack: 0, recruit: 0, cost: 0, fightCost: 4 };
    cardTypes[villainId] = 'villain';
  }
  cardStats[MANDARIN_BASE] = { attack: 0, recruit: 0, cost: 0, fightCost: 16 };
  G.cardStats = cardStats as LegendaryGameState['cardStats'];
  G.villainDeckCardTypes = cardTypes as LegendaryGameState['villainDeckCardTypes'];
  G.cardDisplayData = displayData;
}

/**
 * A reveal context for the opener (a reversing Shuffle, turn 1).
 *
 * @param currentPlayer - The active seat.
 * @returns A RevealContext.
 */
function revealContextFor(currentPlayer: string): RevealContext {
  return { random: { Shuffle: <T>(deck: T[]): T[] => [...deck].reverse() }, ctx: { currentPlayer, turn: 1 } };
}

/**
 * Runs the opener with the default implementation map.
 *
 * @param G - The state, mutated in place.
 * @param currentPlayer - The active seat.
 * @param implementationMap - The map (the default unless a test stubs a twist).
 */
function openEntries(G: LegendaryGameState, currentPlayer: string, implementationMap: ImplementationMap = DEFAULT_IMPLEMENTATION_MAP): void {
  openMandarinRingEntriesIfNeeded(G, undefined, currentPlayer, revealContextFor(currentPlayer), implementationMap);
}

/**
 * Fires The Mandarin's Master Strike through the dispatcher and applies the returned effects.
 *
 * @param G - The state, mutated in place.
 * @param currentPlayer - The active seat.
 */
function strike(G: LegendaryGameState, currentPlayer: string): void {
  const context = { ctx: { currentPlayer, turn: 1 } };
  const effects = mastermindStrikeHandler(G, context, { cardId: 'test-strike' }, {});
  applyRuleEffects(G, context, effects);
}

/**
 * The log texts.
 *
 * @param G - The state.
 * @returns Every message text, in order.
 */
function texts(G: LegendaryGameState): string[] {
  return G.messages.map((message) => message.text);
}

/**
 * Answers the open seat choice for one seat.
 *
 * @param G - The state, mutated in place.
 * @param seat - The answering seat.
 * @param optionIndex - The chosen option.
 * @param numPlayers - The match size.
 */
function answer(G: LegendaryGameState, seat: string, optionIndex: number, numPlayers: number): void {
  resolveSeatChoice(makeMockMoveContext(G, { playerID: seat, numPlayers }), { optionIndex });
}

/**
 * The fightVillain city indexes the bot is offered.
 *
 * @param G - The state.
 * @returns The offered city indexes.
 */
function offeredFightIndexes(G: LegendaryGameState): number[] {
  const legalMoves = getLegalMoves(G, { phase: 'play', turn: 1, currentPlayer: '0', numPlayers: 2 });
  const indexes: number[] = [];
  for (const legalMove of legalMoves) {
    if (legalMove.name === 'fightVillain') {
      indexes.push((legalMove.args as { cityIndex: number }).cityIndex);
    }
  }
  return indexes;
}

describe('The Mandarin — Ring helpers (WP-875 / D-24822)', () => {
  it('identifies Rings by id prefix and lists them in pile order', () => {
    assert.equal(isMandarinRingCardId(RING_A), true);
    assert.equal(isMandarinRingCardId(OTHER_HENCHMAN), false);
    assert.deepStrictEqual(listMandarinRingsInVictoryPile([RING_C, OTHER_HENCHMAN, RING_A]), [RING_C, RING_A]);
    const G = makeState(2);
    G.playerZones['0']!.victory = [RING_A, OTHER_HENCHMAN];
    G.playerZones['1']!.victory = [RING_B, RING_C];
    assert.equal(countMandarinRingsInAllVictoryPiles(G), 3);
    assert.equal(mandarinRingAttackBonus(G, RING_A), 1);
    assert.equal(mandarinVictoryPileAttackReduction(G), 3);
  });
});

describe('The Mandarin — fight costs (WP-875 / D-24822)', () => {
  it('T1: a Ring costs 4 to fight while The Mandarin leads, at the move, the bot and Ebony Blade reads printed 3', () => {
    const G = makeState(2);
    assert.equal(resolveFightCost(G, RING_A), 4);
    assert.equal(resolveFightCost(G, OTHER_HENCHMAN), 3, 'a non-Ring Henchman is unchanged');
    assert.equal(resolveFightCost(makeState(2, OTHER_MASTERMIND_ID), RING_A), 3, 'another Mastermind leaves Rings at 3');

    G.city[0] = RING_A;
    G.turnEconomy.attack = 3;
    assert.deepStrictEqual(offeredFightIndexes(G), [], 'the bot is not offered the fight at 3');
    fightVillain(makeMockMoveContext(G, { numPlayers: 2 }), { cityIndex: 0 });
    assert.equal(G.city[0], RING_A, '3 Attack does not defeat a Fight-4 Ring');

    G.turnEconomy.attack = 4;
    assert.deepStrictEqual(offeredFightIndexes(G), [0], 'the bot is offered the fight at 4');
    fightVillain(makeMockMoveContext(G, { numPlayers: 2 }), { cityIndex: 0 });
    assert.equal(G.city[0], null, '4 Attack defeats it');

    const ebonyG = makeState(2);
    ebonyG.playerZones['0']!.victory = [RING_B];
    ebonyG.pendingVictoryPileCardPick = [{ playerID: '0', rewardType: 'attack' }];
    ebonyG.turnEconomy.attack = 0;
    resolveVictoryPileCardPick(makeMockMoveContext(ebonyG, { numPlayers: 2 }), { cardId: RING_B });
    assert.equal(ebonyG.turnEconomy.attack, 3, 'Ebony Blade grants the Ring\'s printed 3');
  });

  it('T2: the City card UIState fightCost for a Ring is 4', () => {
    const G = makeState(2);
    G.city[0] = RING_A;
    const uiState = buildUIState(G, { phase: 'play', turn: 1, currentPlayer: '0' });
    assert.equal(uiState.city.spaces[0]?.fightCost, 4);
  });

  it('T3: The Mandarin loses 1 per Ring in every Victory Pile, 3 per Ring in solo, floored at 0', () => {
    const G = makeState(2);
    assert.equal(resolveMastermindFightCost(G), 16, 'no Rings');
    G.playerZones['0']!.victory = [RING_A, RING_B];
    G.playerZones['1']!.victory = [OTHER_HENCHMAN, RING_C];
    assert.equal(resolveMastermindFightCost(G), 13, 'three Rings across two Victory Piles');

    const soloG = makeState(1);
    assert.equal(Object.keys(soloG.playerZones).length, 1, 'a one-seat match');
    soloG.playerZones['0']!.victory = [RING_A, RING_B];
    assert.equal(resolveMastermindFightCost(soloG), 10, 'two Rings in solo');
    soloG.playerZones['0']!.victory = [RING_A, RING_B, RING_C, RING_D, RING_E, RING_F];
    assert.equal(resolveMastermindFightCost(soloG), 0, 'six Rings in solo floor at 0');
  });

  it('T4: Rings in Victory Piles leave another Mastermind unchanged', () => {
    const G = makeState(2, OTHER_MASTERMIND_ID);
    G.playerZones['0']!.victory = [RING_A, RING_B];
    assert.equal(resolveMastermindFightCost(G), 16);
  });

  it('T5: the Mastermind UIState fightCost matches, and fightMastermind accepts exactly the reduced cost', () => {
    const G = makeState(2);
    G.playerZones['0']!.victory = [RING_A, RING_B];
    G.playerZones['1']!.victory = [RING_C];
    const uiState = buildUIState(G, { phase: 'play', turn: 1, currentPlayer: '0' });
    assert.equal(uiState.mastermind.fightCost, 13);

    // why: the test registry's Mastermind has no Tactics, so two are seeded to defeat.
    G.mastermind = { ...G.mastermind, tacticsDeck: ['test-tactic-a', 'test-tactic-b'] as CardExtId[] };
    const tacticsBefore = G.mastermind.tacticsDefeated.length;
    G.turnEconomy.attack = 12;
    fightMastermind(makeMockMoveContext(G, { numPlayers: 2 }), {});
    assert.equal(G.mastermind.tacticsDefeated.length, tacticsBefore, '12 Attack is refused');
    G.turnEconomy.attack = 13;
    fightMastermind(makeMockMoveContext(G, { numPlayers: 2 }), {});
    assert.equal(G.mastermind.tacticsDefeated.length, tacticsBefore + 1, '13 Attack defeats a Tactic');
  });
});

describe('The Mandarin — Master Strike (WP-875 / D-24822)', () => {
  it('T6: the arm is reached (no master-strike hollow) and the strike count still increments', () => {
    const G = makeState(2);
    strike(G, '0');
    const hollows = (G.diagnostics?.hollowEffects ?? []).filter((record) => record.mechanic === 'master-strike');
    assert.deepStrictEqual(hollows, []);
    assert.equal(texts(G).at(-1), STRIKE_COUNT_LINE);
  });

  it('T7: a player with no Ring gains a Wound; an empty supply logs the no-effect line', () => {
    const G = makeState(2);
    const woundsBefore = G.piles.wounds.length;
    strike(G, '0');
    assert.ok(G.playerZones['0']!.discard.includes(WOUND));
    assert.ok(G.playerZones['1']!.discard.includes(WOUND));
    assert.equal(G.piles.wounds.length, woundsBefore - 2);
    assert.ok(texts(G).includes('[Mandarin Master Strike] Player 0 had no Mandarin\'s Ring in their Victory Pile and gained a Wound.'));
    assert.equal(G.pendingMandarinRingEntries, undefined);

    const emptyG = makeState(2);
    emptyG.piles.wounds = [];
    strike(emptyG, '0');
    assert.ok(texts(emptyG).includes(
      '[Mandarin Master Strike] Player 1 had no Mandarin\'s Ring in their Victory Pile and the Wound supply is empty — no effect.',
    ));
  });

  it('T8: players with Rings are queued in turn order from the current player, with no City change and no Wound', () => {
    const G = makeState(3);
    G.playerZones['0']!.victory = [RING_A];
    G.playerZones['1']!.victory = [RING_B];
    G.playerZones['2']!.victory = [RING_C];
    const woundsBefore = G.piles.wounds.length;
    strike(G, '1');
    assert.deepStrictEqual(G.pendingMandarinRingEntries, [{ playerID: '1' }, { playerID: '2' }, { playerID: '0' }]);
    assert.deepStrictEqual(G.city, [null, null, null, null, null]);
    assert.equal(G.piles.wounds.length, woundsBefore);
    assert.ok(texts(G).includes('[Mandarin Master Strike] Player 1 will send a Mandarin\'s Ring from their Victory Pile into the City.'));
  });
});

describe('The Mandarin — Ring entry opener (WP-875 / D-24822)', () => {
  it('T9: one Ring enters the Sewers from the Victory Pile with no seat choice', () => {
    const G = makeState(2);
    G.playerZones['0']!.victory = [OTHER_HENCHMAN, RING_A];
    strike(G, '0');
    openEntries(G, '0');
    assert.equal(G.city[0], RING_A);
    assert.deepStrictEqual(G.playerZones['0']!.victory, [OTHER_HENCHMAN]);
    assert.equal(G.pendingSeatChoice, undefined);
    assert.equal(G.pendingMandarinRingEntries, undefined);
    assert.ok(texts(G).includes(
      `[Mandarin Master Strike] Player 0's Liar, The Mento-Intensifier (${RING_A}) entered the City from their Victory Pile.`,
    ));
  });

  it('T10: two Rings park one seat choice; the answer is recorded, then the next opener call enters it', () => {
    const G = makeState(2);
    G.playerZones['0']!.victory = [RING_A, RING_B];
    strike(G, '0');
    openEntries(G, '0');
    const choice = G.pendingSeatChoice;
    assert.equal(choice?.kind, MANDARIN_RING_ENTRY_SEAT_CHOICE_KIND);
    assert.deepStrictEqual(choice?.addressedSeats, ['0']);
    assert.deepStrictEqual(choice?.seatPrompts['0']?.options, [
      { label: RING_NAMES[RING_A], cardId: RING_A },
      { label: RING_NAMES[RING_B], cardId: RING_B },
    ]);
    assert.equal(choice?.defaultOptionIndex, 0);
    assert.deepStrictEqual(G.city, [null, null, null, null, null]);
    assert.ok(texts(G).includes('[Mandarin Master Strike] Player 0 chooses which Mandarin\'s Ring enters the City.'));

    answer(G, '0', 1, 2);
    assert.equal(G.pendingSeatChoice, undefined);
    assert.deepStrictEqual(G.pendingMandarinRingEntries, [{ playerID: '0', chosenCardId: RING_B }]);
    assert.deepStrictEqual(G.city, [null, null, null, null, null], 'the apply moves nothing');

    openEntries(G, '0');
    assert.equal(G.city[0], RING_B);
    assert.deepStrictEqual(G.playerZones['0']!.victory, [RING_A]);
    assert.equal(G.pendingMandarinRingEntries, undefined);
  });

  it('T11: two players with two Rings answer one seat choice; the entries run current player first', () => {
    const G = makeState(2);
    G.playerZones['0']!.victory = [RING_A, RING_B];
    G.playerZones['1']!.victory = [RING_C, RING_D];
    strike(G, '1');
    openEntries(G, '1');
    assert.deepStrictEqual(G.pendingSeatChoice?.addressedSeats, ['1', '0']);
    answer(G, '1', 0, 2);
    answer(G, '0', 1, 2);
    assert.equal(G.pendingSeatChoice, undefined);
    openEntries(G, '1');
    assert.equal(G.city[0], RING_B, 'Player 0 entered second, into the Sewers');
    assert.equal(G.city[1], RING_C, 'Player 1 entered first and was pushed to the Bank');
    assert.equal(G.pendingMandarinRingEntries, undefined);
  });

  it('T12: a Ring entering a full City pushes the Bridge Villain out through resolveVillainEscape', () => {
    const G = makeState(2);
    G.city = [...CITY_VILLAINS];
    G.playerZones['0']!.victory = [RING_A];
    G.pendingMandarinRingEntries = [{ playerID: '0' }];
    const escapedBefore = G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS] ?? 0;
    openEntries(G, '0');
    assert.deepStrictEqual(G.city, [RING_A, 'test-v0', 'test-v1', 'test-v2', 'test-v3']);
    assert.equal(G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS], escapedBefore + 1);
    assert.ok(G.escapedPile.includes('test-v4' as CardExtId));
  });

  it('T13: the opener waits while another seat choice or a hero choice is open, and once the match is decided', () => {
    const G = makeState(2);
    G.playerZones['0']!.victory = [RING_A];
    G.pendingMandarinRingEntries = [{ playerID: '0' }];
    G.pendingSeatChoice = {
      kind: 'generic', addressedSeats: ['1'], seatPrompts: { '1': { options: [{ label: 'A' }] } }, submissions: {}, defaultOptionIndex: 0,
    };
    openEntries(G, '0');
    assert.deepStrictEqual(G.pendingMandarinRingEntries, [{ playerID: '0' }]);
    assert.deepStrictEqual(G.city, [null, null, null, null, null]);

    delete G.pendingSeatChoice;
    G.pendingHeroChoice = { choiceType: 'discard-or-return', cardId: 'deck-01' as CardExtId, playerID: '0' };
    openEntries(G, '0');
    assert.deepStrictEqual(G.pendingMandarinRingEntries, [{ playerID: '0' }], 'waits on a pending hero choice');
    assert.deepStrictEqual(G.city, [null, null, null, null, null]);

    delete G.pendingHeroChoice;
    G.counters[ENDGAME_CONDITIONS.SCHEME_LOSS] = 1;
    openEntries(G, '0');
    assert.deepStrictEqual(G.pendingMandarinRingEntries, [{ playerID: '0' }]);
    assert.deepStrictEqual(G.city, [null, null, null, null, null]);
  });

  it('T14: a chosen Ring that left the Victory Pile does not enter, and the queue drains', () => {
    const G = makeState(2);
    G.pendingMandarinRingEntries = [{ playerID: '0', chosenCardId: RING_A }];
    openEntries(G, '0');
    assert.deepStrictEqual(G.city, [null, null, null, null, null]);
    assert.equal(G.pendingMandarinRingEntries, undefined);
    assert.ok(texts(G).includes(
      `[Mandarin Master Strike] Player 0's Liar, The Mento-Intensifier (${RING_A}) is no longer in their Victory Pile, so it does not enter the City.`,
    ));
  });

  it('T15: lockstep — end-of-game drop, operator-choice gate and turn-start delete', () => {
    const G = makeState(2);
    assert.equal(Object.hasOwn(G, 'pendingMandarinRingEntries'), false, 'never seeded');
    G.pendingMandarinRingEntries = [{ playerID: '0' }];
    assert.equal(isOperatorChoiceOpen(G), true);
    dropAllPendingPlayerChoices(G);
    assert.equal(G.pendingMandarinRingEntries, undefined);

    G.pendingMandarinRingEntries = [{ playerID: '0' }];
    applyOnBeginParity(G, '0');
    assert.equal(Object.hasOwn(G, 'pendingMandarinRingEntries'), false, 'applyOnBeginParity deletes it');

    // why: game.ts onBegin is called directly (the game.test.ts precedent): through the reducer the
    // onMove opener would drop a Ring-less entry first, so the delete would pass without onBegin.
    G.playerZones['0']!.victory = [RING_A];
    G.pendingMandarinRingEntries = [{ playerID: '0' }];
    const onBegin = (
      LegendaryGame.phases as Record<string, { turn?: { onBegin?: (context: unknown) => void } }>
    ).play?.turn?.onBegin;
    onBegin!({
      G,
      ctx: { currentPlayer: '0', numPlayers: 2, phase: 'play', turn: 3 },
      random: { Shuffle: <T>(deck: T[]): T[] => [...deck].reverse() },
      events: { setPhase: (): void => {}, endTurn: (): void => {} },
    });
    assert.equal(Object.hasOwn(G, 'pendingMandarinRingEntries'), false, 'game.ts onBegin deletes it');
  });

  it('T17: two strikes in one move never count a Ring twice; a three-Ring player is asked twice', () => {
    const G = makeState(2);
    G.playerZones['0']!.victory = [RING_A];
    G.playerZones['1']!.victory = [RING_B, RING_C, RING_D];
    strike(G, '0');
    strike(G, '0');
    assert.deepStrictEqual(G.pendingMandarinRingEntries, [{ playerID: '0' }, { playerID: '1' }, { playerID: '1' }]);
    assert.ok(G.playerZones['0']!.discard.includes(WOUND), 'Player 0\'s only Ring is owed, so the second strike Wounds them');
    assert.ok(!G.playerZones['1']!.discard.includes(WOUND));

    openEntries(G, '0');
    assert.deepStrictEqual(G.pendingSeatChoice?.addressedSeats, ['1'], 'Player 1 is asked once');
    assert.equal(G.pendingSeatChoice?.seatPrompts['1']?.options.length, 3);
    answer(G, '1', 2, 2);

    openEntries(G, '0');
    assert.deepStrictEqual(G.pendingSeatChoice?.addressedSeats, ['1'], 'Player 1 is asked again');
    assert.deepStrictEqual(
      G.pendingSeatChoice?.seatPrompts['1']?.options.map((option) => option.cardId),
      [RING_B, RING_C],
      'the first pick is excluded',
    );
    answer(G, '1', 0, 2);

    openEntries(G, '0');
    assert.deepStrictEqual(G.city, [RING_B, RING_D, RING_A, null, null], 'entered in queue order');
    assert.equal(G.pendingMandarinRingEntries, undefined);
    assert.deepStrictEqual(G.playerZones['1']!.victory, [RING_C]);
  });

  it('T18: entries a chained strike appends mid-drain are settled in the same call; an endgame stops the drain', () => {
    const chained = makeChainedStrikeState();
    chained.G.playerZones['1']!.victory = [RING_B];
    openEntries(chained.G, '0', chained.implementationMap);
    assert.equal(chained.G.city[0], RING_B, 'the appended lone Ring entered in the same call');
    assert.equal(chained.G.city[1], RING_A);
    assert.equal(chained.G.pendingMandarinRingEntries, undefined);

    const asked = makeChainedStrikeState();
    asked.G.playerZones['1']!.victory = [RING_B, RING_C];
    openEntries(asked.G, '0', asked.implementationMap);
    assert.equal(asked.G.pendingSeatChoice?.kind, MANDARIN_RING_ENTRY_SEAT_CHOICE_KIND, 'two Rings park a choice in the same call');
    assert.deepStrictEqual(asked.G.pendingMandarinRingEntries, [{ playerID: '1' }]);

    const decided = makeChainedStrikeState(true);
    decided.G.playerZones['1']!.victory = [RING_B, RING_C];
    decided.G.pendingMandarinRingEntries!.push({ playerID: '1', chosenCardId: RING_C });
    openEntries(decided.G, '0', decided.implementationMap);
    assert.deepStrictEqual(
      decided.G.pendingMandarinRingEntries,
      [{ playerID: '1', chosenCardId: RING_C }, { playerID: '1' }],
      'the rest stays queued once the match is decided',
    );
    assert.deepStrictEqual(decided.G.playerZones['1']!.victory, [RING_B, RING_C]);

    const dropped = makeState(2);
    dropped.pendingMandarinRingEntries = [{ playerID: '0' }];
    openEntries(dropped, '0');
    assert.equal(Object.hasOwn(dropped, 'pendingMandarinRingEntries'), false, 'a settle removal of the last entry deletes the queue');
    assert.ok(texts(dropped).includes(
      '[Mandarin Master Strike] Player 0 no longer has a Mandarin\'s Ring in their Victory Pile, so none enters the City.',
    ));
  });
});

/**
 * A state whose first Ring entry pushes out a Villain that becomes a Scheme Twist, and whose twist
 * stands in for a chained Master Strike by queueing an entry for Player 1.
 *
 * @param isTwistDecisive - When true the twist also latches a scheme loss.
 * @returns The state and the stub implementation map.
 */
function makeChainedStrikeState(isTwistDecisive = false): { G: LegendaryGameState; implementationMap: ImplementationMap } {
  const G = makeState(2);
  G.city = [...CITY_VILLAINS];
  G.playerZones['0']!.victory = [RING_A];
  G.pendingMandarinRingEntries = [{ playerID: '0', chosenCardId: RING_A }];
  G.villainAbilityHooks = [
    { cardId: 'test-v4' as CardExtId, timing: 'onEscape', keywords: [], effects: [{ primitive: 'become-scheme-twist' }] },
  ] as LegendaryGameState['villainAbilityHooks'];
  G.hookRegistry = [
    { id: 'test-chained-strike', kind: 'scheme', sourceId: 'test-scheme', triggers: ['onSchemeTwistRevealed'], priority: 1 },
  ];
  const implementationMap: ImplementationMap = {
    'test-chained-strike': (gameState) => {
      queueMandarinRingEntry(gameState, '1');
      if (isTwistDecisive) {
        gameState.counters[ENDGAME_CONDITIONS.SCHEME_LOSS] = 1;
      }
      return [];
    },
  };
  return { G, implementationMap };
}

/** A started two-seat match through the real reducer. */
interface ReducerMatch {
  state: { G: unknown; ctx: { currentPlayer: unknown } };
  makeMove: (state: unknown, moveName: string, args: unknown[], playerID: string) => { G: unknown; ctx: { currentPlayer: unknown } };
  activeSeat: string;
}

/**
 * Starts a real two-seat match (the game.test.ts pattern).
 *
 * @returns The started match and its active seat.
 */
function startReducerMatch(): ReducerMatch {
  const reducer = CreateGameReducer({ game: LegendaryGame, isClient: false });
  const makeMove: ReducerMatch['makeMove'] = (state, moveName, args, playerID) =>
    reducer(state, { type: 'MAKE_MOVE', payload: { type: moveName, args, playerID } });
  const setupData = {
    schemeId: 'test/test-scheme-001',
    mastermindId: 'test/test-mastermind-001',
    villainGroupIds: ['test/test-villain-group-001', 'test/test-villain-group-002'],
    henchmanGroupIds: ['test/test-henchman-group-001'],
    heroDeckIds: ['test/test-hero-deck-001', 'test/test-hero-deck-002', 'test/test-hero-deck-003'],
    bystandersCount: 30,
    woundsCount: 30,
    officersCount: 30,
    sidekicksCount: 0,
  };
  const initialState = InitializeGame({ game: LegendaryGame, numPlayers: 2, setupData });
  let state = makeMove(initialState, 'setPlayerReady', [{ ready: true }], '0');
  state = makeMove(state, 'setPlayerReady', [{ ready: true }], '1');
  state = makeMove(state, 'startMatchIfReady', [], '0');
  return { state, makeMove, activeSeat: String(state.ctx.currentPlayer) };
}

/**
 * The started match's G with The Mandarin leading and a Master Strike on the Villain Deck top.
 *
 * @param match - The started match.
 * @returns The injected G (stage 'start', ready for revealVillainCard).
 */
function injectMandarinStrike(match: ReducerMatch): LegendaryGameState {
  const G = structuredClone(match.state.G) as LegendaryGameState;
  G.selection = { ...G.selection, mastermindId: MANDARIN_MASTERMIND_ID };
  injectRingCards(G);
  G.villainDeck = { deck: ['test-master-strike' as CardExtId], discard: [] };
  G.villainDeckCardTypes = { ...G.villainDeckCardTypes, 'test-master-strike': 'mastermind-strike' };
  G.currentStage = 'start';
  return G;
}

describe('The Mandarin — game.ts onMove wiring (WP-875 / D-24822)', () => {
  it('T16: real reducer — a revealed strike with one Ring per player ends the move with both Rings in the City', () => {
    const match = startReducerMatch();
    const otherSeat = match.activeSeat === '0' ? '1' : '0';
    const G = injectMandarinStrike(match);
    G.city = [null, null, null, null, null];
    G.playerZones[match.activeSeat]!.victory = [RING_A];
    G.playerZones[otherSeat]!.victory = [RING_B];
    const state = match.makeMove({ ...match.state, G }, 'revealVillainCard', [], match.activeSeat);
    const after = state.G as LegendaryGameState;
    assert.equal(after.city[0], RING_B, 'the other player entered second, into the Sewers');
    assert.equal(after.city[1], RING_A, 'the current player entered first');
    assert.equal(after.pendingMandarinRingEntries, undefined);
    assert.equal(after.pendingSeatChoice, undefined);
  });

  it('T12 (onMove): the pushed-out Villain\'s escape steps open in the same move', () => {
    const match = startReducerMatch();
    const otherSeat = match.activeSeat === '0' ? '1' : '0';
    const G = injectMandarinStrike(match);
    G.city = [...CITY_VILLAINS];
    G.playerZones[match.activeSeat]!.victory = [RING_A];
    G.playerZones[otherSeat]!.victory = [];
    // why: the test registry's HQ starts empty; two Heroes with no stats entry count as cost 0,
    // so both are eligible and the escape's HQ KO is a choice, not an automatic KO.
    G.hq = ['test-hq-hero-a', 'test-hq-hero-b', null, null, null] as LegendaryGameState['hq'];
    const state = match.makeMove({ ...match.state, G }, 'revealVillainCard', [], match.activeSeat);
    const after = state.G as LegendaryGameState;
    assert.equal(after.city[0], RING_A);
    assert.ok(after.escapedPile.includes('test-v4' as CardExtId));
    assert.equal(after.pendingSeatChoice?.kind, ESCAPE_HQ_KO_KIND);
  });
});
