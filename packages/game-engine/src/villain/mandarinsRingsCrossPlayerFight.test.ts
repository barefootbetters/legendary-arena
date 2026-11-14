/**
 * Mandarin's Rings cross-player and Villain Deck Fight lines (WP-872 / D-24817).
 *
 * Liar, The Mento-Intensifier — look at another player's deck top, claim "Good" or "Bad", and that
 * player chooses whose discard pile gets it without seeing it. Nightbringer, The Black Light —
 * reveal the top three Villain Deck cards, may defeat one worth 2VP or less, put the rest back in
 * any order, then do its Fight effect. Remaker, The Matter Rearranger — give a hand or discard card
 * to the player on your right.
 *
 * Parser cases build the real hooks from the committed card data; handler cases dispatch through
 * executeVillainAbilities and the real opener / resolveSeatChoice. T20 alone drives boardgame.io's
 * own reducer (the WP-411 / D-24223 exception); no other case touches boardgame.io.
 * node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
// why: WP-411 / D-24223 — T20 drives a REAL boardgame.io match through the framework's own
// reducer to prove the game.ts turn.onMove opener is wired and that the non-active target's answer
// is accepted (the game.test.ts precedent, also divingBlock.multiSeatWave.test.ts). The deep dist
// entry is the same one the server-layer replay / competition tests use; it exposes InitializeGame +
// CreateGameReducer and carries no types (cast below). This is the ONLY vehicle that exercises the
// boardgame.io wiring — the engine-runner simulation harness re-implements the turn loop.
import * as boardgameInternal from 'boardgame.io/dist/cjs/internal.js';
import { LegendaryGame } from '../game.js';
import { buildVillainAbilityHooks } from '../setup/villainAbility.setup.js';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { executeVillainAbilities } from './villainEffects.execute.js';
import { resolveSeatChoice } from '../moves/seatChoice.resolve.js';
import {
  openVillainFightPickSeatChoiceIfNeeded,
  rightNeighborSeat,
} from '../moves/villainFightPick.logic.js';
import { applyOnBeginParity } from '../simulation/onBeginParity.js';
import { buildUIState } from '../ui/uiState.build.js';
import { filterUIStateForAudience } from '../ui/uiState.filter.js';
import { SHIELD_OFFICER_EXT_ID } from '../setup/pilesInit.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { makeMockMoveContext } from '../test/mockMoveContext.js';
import type { LegendaryGameState, MatchConfiguration } from '../types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { VillainAbilityHook, VillainEffectDescriptor } from '../rules/villainAbility.types.js';
import type { ShuffleProvider } from '../setup/shuffle.js';

// why: the deep dist entry carries no types; cast to the minimal shape T20 uses — mirrors the
// game.test.ts precedent.
const { InitializeGame, CreateGameReducer } = boardgameInternal as unknown as {
  InitializeGame(config: { game: unknown; numPlayers: number; setupData: unknown }): ReducerState;
  CreateGameReducer(config: { game: unknown; isClient: boolean }): (
    state: unknown,
    action: { type: string; payload: unknown },
  ) => ReducerState;
};

/** The reducer state fields T20 reads. */
interface ReducerState {
  G: unknown;
  ctx: { currentPlayer: unknown; activePlayers?: Record<string, string> | null };
}

// why: resolve the repo-root data directory from this test's own location (the
// mandarinsRingsFight.test.ts precedent), so the tests read the card data that ships.
const CARDS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'data', 'cards');

const LIAR = 'henchman-mandarins-rings-03' as CardExtId;
const NIGHTBRINGER = 'henchman-mandarins-rings-05' as CardExtId;
const REMAKER = 'henchman-mandarins-rings-06' as CardExtId;
/** The looked-at card: its name and id appear nowhere else in the state. */
const HIDDEN_A = 'test/hero/zqxhidden-alpha#0' as CardExtId;
const HIDDEN_A_NAME = 'Qwyxz Hidden Alpha';
const HERO_B = 'test/hero/hero-b#0' as CardExtId;
const HERO_H = 'test/hero/hero-h#0' as CardExtId;
const HERO_D = 'test/hero/hero-d#0' as CardExtId;
const HENCHMAN_ONE = 'test-henchman-one' as CardExtId;
const BYSTANDER = 'test-bystander' as CardExtId;
const VILLAIN_THREE = 'test-villain-three' as CardExtId;
const TWIST = 'test-scheme-twist' as CardExtId;
const SKRULL = 'test-skrull-hero#0' as CardExtId;
const OFFICER = 'test-brainwashed-officer' as CardExtId;
/** A ShuffleProvider whose Shuffle reverses (proves a reshuffle ran deterministically). */
const REVERSE_SHUFFLE: ShuffleProvider = { random: { Shuffle: <T>(deck: T[]): T[] => [...deck].reverse() } };

/**
 * Builds every hook the Mandarin's Rings henchman group produces from the committed rvlt data.
 *
 * @returns The group's hooks.
 */
function buildRingsHooks(): VillainAbilityHook[] {
  const setData = JSON.parse(readFileSync(join(CARDS_DIRECTORY, 'rvlt.json'), 'utf8'));
  const registry = { getSet: (abbr: string) => (abbr === 'rvlt' ? setData : undefined) };
  const config = { villainGroupIds: [], henchmanGroupIds: ['rvlt/mandarins-rings'] } as unknown as MatchSetupConfig;
  return buildVillainAbilityHooks(registry, config);
}

const RINGS_HOOKS = buildRingsHooks();

/**
 * The onFight hooks one card id carries.
 *
 * @param hooks - The hooks to search.
 * @param cardId - The card.
 * @returns Its onFight hooks.
 */
function fightHooksFor(hooks: readonly VillainAbilityHook[], cardId: CardExtId): VillainAbilityHook[] {
  return hooks.filter((hook) => hook.cardId === cardId && hook.timing === 'onFight');
}

/**
 * A real initial game state with the Rings hooks, the given seats (empty zones) and display names.
 *
 * @param seats - The seat ids.
 * @returns A LegendaryGameState for the executor, the opener and the resolve move.
 */
function makeState(seats: string[]): LegendaryGameState {
  const gameState = buildInitialGameState(
    {
      schemeId: 'test-scheme', mastermindId: 'test-mastermind', villainGroupIds: [], henchmanGroupIds: [],
      heroDeckIds: [], bystandersCount: 0, woundsCount: 0, officersCount: 0, sidekicksCount: 0,
    },
    {},
    makeMockCtx({ numPlayers: seats.length }),
  );
  gameState.villainAbilityHooks = [...RINGS_HOOKS];
  gameState.currentStage = 'main';
  gameState.messages = [];
  gameState.playerZones = {};
  for (const seat of seats) {
    gameState.playerZones[seat] = { deck: [], hand: [], discard: [], inPlay: [], victory: [], undercover: [] };
  }
  gameState.villainDeck = { deck: [], discard: [] };
  gameState.cardDisplayData = {
    ...gameState.cardDisplayData,
    [LIAR]: { name: 'Liar, The Mento-Intensifier', imageUrl: '', cost: 0 },
    [NIGHTBRINGER]: { name: 'Nightbringer, The Black Light', imageUrl: '', cost: 0 },
    [REMAKER]: { name: 'Remaker, The Matter Rearranger', imageUrl: '', cost: 0 },
    [HIDDEN_A]: { name: HIDDEN_A_NAME, imageUrl: '', cost: 3 },
    [HERO_B]: { name: 'Hero B', imageUrl: '', cost: 3 },
    [HERO_H]: { name: 'Hero H', imageUrl: '', cost: 3 },
    [HERO_D]: { name: 'Hero D', imageUrl: '', cost: 3 },
    [HENCHMAN_ONE]: { name: 'Henchman One', imageUrl: '', cost: 0 },
    [BYSTANDER]: { name: 'Bystander', imageUrl: '', cost: 0 },
    [VILLAIN_THREE]: { name: 'Villain Three', imageUrl: '', cost: 0 },
    [TWIST]: { name: 'Scheme Twist', imageUrl: '', cost: 0 },
    [SKRULL]: { name: 'Skrull Hero', imageUrl: '', cost: 4 },
    [OFFICER]: { name: 'Brainwashed Officer', imageUrl: '', cost: 3 },
  } as LegendaryGameState['cardDisplayData'];
  return gameState;
}

/**
 * Sets the Villain Deck to H1 (henchman, 1 VP), BY (bystander), V3 (villain, 3 VP), X (twist).
 *
 * @param G - The game state, mutated.
 * @param topCardId - The first card (H1 by default; T14b puts Remaker there).
 */
function seedNightbringerDeck(G: LegendaryGameState, topCardId: CardExtId = HENCHMAN_ONE): void {
  G.villainDeck = { deck: [topCardId, BYSTANDER, VILLAIN_THREE, TWIST], discard: [] };
  G.villainDeckCardTypes = {
    ...G.villainDeckCardTypes,
    [topCardId]: 'henchman', [BYSTANDER]: 'bystander', [VILLAIN_THREE]: 'villain', [TWIST]: 'scheme-twist',
  } as LegendaryGameState['villainDeckCardTypes'];
  G.cardVictoryPoints = { ...G.cardVictoryPoints, [topCardId]: 1, [VILLAIN_THREE]: 3 };
}

/**
 * Gives a card an injected onFight hook.
 *
 * @param G - The game state, mutated.
 * @param cardId - The card.
 * @param effect - Its one Fight effect.
 */
function injectFightHook(G: LegendaryGameState, cardId: CardExtId, effect: VillainEffectDescriptor): void {
  G.villainAbilityHooks = [...G.villainAbilityHooks, { cardId, timing: 'onFight', keywords: [], effects: [effect] }];
}

/**
 * Fires a Rings copy's Fight through the real executor for seat 0.
 *
 * @param G - The game state.
 * @param cardId - The defeated copy.
 */
function fight(G: LegendaryGameState, cardId: CardExtId): void {
  executeVillainAbilities(G, { currentPlayer: '0', turn: 1 }, cardId, 'onFight', REVERSE_SHUFFLE);
}

/**
 * Runs the play-phase onMove opener the way game.ts does after a move (seat 0 active).
 *
 * @param G - The game state.
 */
function openPicks(G: LegendaryGameState): void {
  openVillainFightPickSeatChoiceIfNeeded(G, undefined, '0');
}

/**
 * Answers the open seat choice through the real resolveSeatChoice move. The mock's throwing
 * setActivePlayers is replaced by a recorder, so a non-active park is observable.
 *
 * @param G - The game state.
 * @param seat - The answering seat.
 * @param optionIndex - The chosen option.
 * @returns The seats each setActivePlayers call admitted.
 */
function answer(G: LegendaryGameState, seat: string, optionIndex: number): string[][] {
  const admitted: string[][] = [];
  const context = makeMockMoveContext(G, { playerID: seat, numPlayers: Object.keys(G.playerZones).length });
  // why: the chain parks Liar's decide for a non-active seat through events.setActivePlayers; the
  // shared mock throws on it (no engine code may call it outside the stage ride), so record it.
  context.ctx = { ...context.ctx, currentPlayer: '0' };
  context.events.setActivePlayers = (arg: Parameters<typeof context.events.setActivePlayers>[0]) => {
    if (!Array.isArray(arg)) {
      admitted.push(Object.keys(arg.value ?? {}));
    }
  };
  resolveSeatChoice(context, { optionIndex });
  return admitted;
}

/**
 * The log entries whose text is `text`, with or without the {turn}.{step}.{action} prefix.
 *
 * @param G - The game state.
 * @param text - The unprefixed log text.
 * @returns The matching entries.
 */
function logsWithText(G: LegendaryGameState, text: string): { text: string; outcome?: string; card?: string }[] {
  return G.messages.filter((entry) => entry.text === text || entry.text.endsWith(` ${text}`));
}

/**
 * Asserts exactly one log entry has the text, the outcome and the card argument.
 *
 * @param G - The game state.
 * @param text - The unprefixed log text.
 * @param outcome - The expected outcome.
 * @param card - The expected pushLog card argument (undefined for a card-less line).
 */
function assertLoggedOnce(G: LegendaryGameState, text: string, outcome: string | undefined, card: CardExtId | undefined): void {
  const matches = logsWithText(G, text);
  assert.equal(matches.length, 1, `expected one log line: ${text}`);
  assert.equal(matches[0]!.outcome, outcome, `outcome of: ${text}`);
  assert.equal(matches[0]!.card, card, `card argument of: ${text}`);
}

/**
 * The index of the first log entry whose text contains `fragment`.
 *
 * @param G - The game state.
 * @param fragment - The text to find.
 * @returns The index, or -1.
 */
function logIndexContaining(G: LegendaryGameState, fragment: string): number {
  return G.messages.findIndex((entry) => entry.text.includes(fragment));
}

/**
 * Asserts the hidden card never reached the public log (text or card argument).
 *
 * @param G - The game state.
 */
function assertLogNeverNamesHiddenCard(G: LegendaryGameState): void {
  for (const entry of G.messages) {
    assert.notEqual(entry.card, HIDDEN_A, `log card argument leaked the hidden card: ${entry.text}`);
    assert.equal(entry.text.includes(HIDDEN_A_NAME), false, `log text leaked the hidden name: ${entry.text}`);
    assert.equal(entry.text.includes(HIDDEN_A), false, `log text leaked the hidden id: ${entry.text}`);
  }
}

/**
 * The option labels a seat sees on the open seat choice.
 *
 * @param G - The game state.
 * @param seat - The seat.
 * @returns Its labels.
 */
function labelsFor(G: LegendaryGameState, seat: string): string[] {
  return (G.pendingSeatChoice?.seatPrompts[seat]?.options ?? []).map((option) => option.label);
}

/**
 * A two-seat Liar state with seat 1's deck [A, B], fought and opened (the claim parked).
 *
 * @returns The game state with 'liar-claim' open for seat 0.
 */
function liarClaimState(): LegendaryGameState {
  const G = makeState(['0', '1']);
  G.playerZones['1']!.deck = [HIDDEN_A, HERO_B];
  fight(G, LIAR);
  openPicks(G);
  return G;
}

const LIAR_REF = `Liar, The Mento-Intensifier (${LIAR})`;
const NIGHTBRINGER_REF = `Nightbringer, The Black Light (${NIGHTBRINGER})`;
const REMAKER_REF = `Remaker, The Matter Rearranger (${REMAKER})`;

describe('WP-872 Mandarin\'s Rings parser (D-24817)', () => {
  it('T1: Liar, Nightbringer and Remaker parse from the committed rvlt data with no unresolved marker', () => {
    assert.deepStrictEqual(fightHooksFor(RINGS_HOOKS, LIAR).map((hook) => hook.effects), [[{ primitive: 'look-other-player-deck-top-claim-current' }]]);
    assert.deepStrictEqual(fightHooksFor(RINGS_HOOKS, NIGHTBRINGER).map((hook) => hook.effects), [[{ primitive: 'reveal-villain-deck-defeat-low-vp-current' }]]);
    assert.deepStrictEqual(fightHooksFor(RINGS_HOOKS, REMAKER).map((hook) => hook.effects), [[{ primitive: 'give-card-to-right-player-current' }]]);
    for (const cardId of [LIAR, NIGHTBRINGER, REMAKER]) {
      assert.deepStrictEqual(fightHooksFor(RINGS_HOOKS, cardId)[0]!.unresolvedMarkers ?? [], [], `${cardId} has no unresolved marker`);
    }
  });
});

describe('WP-872 Liar, The Mento-Intensifier (D-24817)', () => {
  it('T2: one seat — a logged no-op, no queue', () => {
    const G = makeState(['0']);
    fight(G, LIAR);
    assert.equal(G.pendingVillainFightPicks, undefined);
    assertLoggedOnce(G, `Player 0 has no other player whose deck they can look at (${LIAR_REF}).`, 'blocked', LIAR);
  });

  it('T3: two seats — the claim prompt names the card for the fighter only; the log never does', () => {
    const G = liarClaimState();
    assert.equal(G.pendingSeatChoice?.kind, 'liar-claim');
    assert.deepStrictEqual(G.pendingSeatChoice?.addressedSeats, ['0']);
    assert.deepStrictEqual(labelsFor(G, '0'), [`Say "Good" (it is ${HIDDEN_A_NAME})`, `Say "Bad" (it is ${HIDDEN_A_NAME})`]);
    assert.equal(G.pendingSeatChoice?.villainFightPick?.lookedAtCardId, HIDDEN_A);
    assert.equal(G.pendingSeatChoice?.defaultOptionIndex, 0);
    assert.equal(G.pendingVillainFightPicks, undefined, 'the queue drained when the claim parked');
    assertLogNeverNamesHiddenCard(G);
    assertLoggedOnce(G, `Player 0 looks at the top card of Player 1's deck (${LIAR_REF}).`, 'neutral', LIAR);
    assertLoggedOnce(G, `Player 0 will look at the top card of another player's deck (${LIAR_REF}).`, 'neutral', LIAR);
  });

  it('T4: the target\'s empty deck tops up from their discard in the handler (D-24285)', () => {
    const G = makeState(['0', '1']);
    G.playerZones['1']!.discard = [HIDDEN_A, HERO_B];
    fight(G, LIAR);
    assert.deepStrictEqual(G.playerZones['1']!.deck, [HERO_B, HIDDEN_A], 'the mock shuffle reversed the discard');
    assert.deepStrictEqual(G.playerZones['1']!.discard, []);
    openPicks(G);
    assert.deepStrictEqual(labelsFor(G, '0'), ['Say "Good" (it is Hero B)', 'Say "Bad" (it is Hero B)']);
  });

  it('T5: three seats — the fighter picks the target in turn order, then the claim opens for that deck', () => {
    const G = makeState(['0', '1', '2']);
    G.playerZones['1']!.deck = [HERO_B];
    G.playerZones['2']!.deck = [HERO_H];
    fight(G, LIAR);
    openPicks(G);
    assert.equal(G.pendingSeatChoice?.kind, 'liar-target');
    assert.deepStrictEqual(labelsFor(G, '0'), ['Player 1', 'Player 2']);
    assert.equal(G.pendingSeatChoice?.defaultOptionIndex, 0);
    answer(G, '0', 1);
    assert.equal(G.pendingSeatChoice?.kind, 'liar-claim', 'the chain parked the claim');
    assert.equal(G.pendingSeatChoice?.villainFightPick?.targetSeat, '2');
    assert.deepStrictEqual(labelsFor(G, '0'), ['Say "Good" (it is Hero H)', 'Say "Bad" (it is Hero H)']);
  });

  it('T6: the claim is logged, and the target decides without seeing the card', () => {
    const G = liarClaimState();
    const admitted = answer(G, '0', 1);
    assertLoggedOnce(G, `Player 0 says the top card of Player 1's deck is "Bad" (${LIAR_REF}).`, 'neutral', LIAR);
    assert.equal(G.pendingSeatChoice?.kind, 'liar-decide');
    assert.deepStrictEqual(G.pendingSeatChoice?.addressedSeats, ['1']);
    assert.deepStrictEqual(admitted, [['1']], 'the non-active target rides the stage');
    const labels = labelsFor(G, '1');
    assert.deepStrictEqual(labels, [
      'Player 0 says it is "Bad": put it in Player 0\'s discard pile',
      'Player 0 says it is "Bad": put it in your discard pile',
    ]);
    for (const label of labels) {
      assert.equal(label.includes(HIDDEN_A_NAME), false, 'the decide labels never name the card');
    }
    assert.equal(G.pendingSeatChoice?.villainFightPick?.claim, 'bad');
    assertLogNeverNamesHiddenCard(G);
    assert.equal(G.messages.some((entry) => entry.text.includes('resolved liar-claim choice')), false, 'no generic seat-choice line');
  });

  it('T7: the decide moves the card to the fighter\'s discard (0) or the target\'s own (1)', () => {
    const toFighter = liarClaimState();
    answer(toFighter, '0', 1);
    answer(toFighter, '1', 0);
    assert.deepStrictEqual(toFighter.playerZones['0']!.discard, [HIDDEN_A]);
    assert.deepStrictEqual(toFighter.playerZones['1']!.deck, [HERO_B]);
    assertLoggedOnce(toFighter, `Player 1 put ${HIDDEN_A_NAME} (${HIDDEN_A}) in Player 0's discard pile (${LIAR_REF}).`, 'applied', HIDDEN_A);
    assert.equal(toFighter.pendingSeatChoice, undefined);

    const toTarget = liarClaimState();
    answer(toTarget, '0', 0);
    answer(toTarget, '1', 1);
    assert.deepStrictEqual(toTarget.playerZones['1']!.discard, [HIDDEN_A]);
    assert.deepStrictEqual(toTarget.playerZones['0']!.discard, []);
    assertLoggedOnce(toTarget, `Player 1 put ${HIDDEN_A_NAME} (${HIDDEN_A}) in their own discard pile (${LIAR_REF}).`, 'applied', HIDDEN_A);
  });

  it('T8: a changed deck top moves nothing and never names the card', () => {
    const G = liarClaimState();
    answer(G, '0', 0);
    G.playerZones['1']!.deck = [HERO_B, HIDDEN_A];
    answer(G, '1', 0);
    assertLoggedOnce(G, `The top card of Player 1's deck changed; nothing is put in a discard pile (${LIAR_REF}).`, 'neutral', LIAR);
    assert.deepStrictEqual(G.playerZones['1']!.deck, [HERO_B, HIDDEN_A]);
    assert.deepStrictEqual(G.playerZones['0']!.discard, []);
    assertLogNeverNamesHiddenCard(G);
  });

  it('T9: the per-seat projection shows the card only to the fighter during the claim, to nobody during the decide', () => {
    const G = liarClaimState();
    const uiContext = { phase: 'play', turn: 1, currentPlayer: '0' };
    /**
     * Whether an audience's filtered projection contains the hidden card's name or id.
     *
     * @param audience - The audience.
     * @returns true when the name or the id appears.
     */
    const sees = (audience: { kind: 'player'; playerId: string } | { kind: 'spectator' }): boolean => {
      // why: a deck owner's own `deckComposition` (a pre-existing, sorted, order-free list of every
      // card in their deck) names the card without saying it is on top, so it is left out of the id
      // check; everything else in the projection must carry neither the id nor the name.
      const projection = JSON.stringify(
        filterUIStateForAudience(buildUIState(G, uiContext), audience),
        (key, value) => (key === 'deckComposition' ? undefined : value),
      );
      return projection.includes(HIDDEN_A_NAME) || projection.includes(HIDDEN_A);
    };
    assert.equal(sees({ kind: 'player', playerId: '0' }), true, 'the fighter sees the card in their own prompt');
    assert.equal(sees({ kind: 'player', playerId: '1' }), false);
    assert.equal(sees({ kind: 'spectator' }), false);
    answer(G, '0', 0);
    assert.equal(G.pendingSeatChoice?.kind, 'liar-decide');
    assert.equal(sees({ kind: 'player', playerId: '0' }), false);
    assert.equal(sees({ kind: 'player', playerId: '1' }), false);
    assert.equal(sees({ kind: 'spectator' }), false);
  });
});

describe('WP-872 Nightbringer, The Black Light (D-24817)', () => {
  /**
   * A Nightbringer state with the T10 deck, fought and opened.
   *
   * @param topCardId - The deck's first card.
   * @param seats - The seats.
   * @returns The game state with the reveal handled.
   */
  function nightbringerState(topCardId: CardExtId = HENCHMAN_ONE, seats: string[] = ['0']): LegendaryGameState {
    const G = makeState(seats);
    seedNightbringerDeck(G, topCardId);
    fight(G, NIGHTBRINGER);
    openPicks(G);
    return G;
  }

  it('T10: only Villains / Henchmen worth 2VP or less are offered', () => {
    const G = nightbringerState();
    assertLoggedOnce(G,
      `Player 0 revealed Henchman One (${HENCHMAN_ONE}), Bystander (${BYSTANDER}), Villain Three (${VILLAIN_THREE}) from the top of the Villain Deck (${NIGHTBRINGER_REF}).`,
      'neutral',
      NIGHTBRINGER,
    );
    assert.equal(G.pendingSeatChoice?.kind, 'nightbringer-defeat');
    assert.deepStrictEqual(labelsFor(G, '0'), ['Don\'t defeat a Villain', 'Defeat Henchman One (1 VP)']);
    assert.equal(G.pendingSeatChoice?.defaultOptionIndex, 0);
  });

  it('T11: defeat, then put back, then the Fight effect — a defeat, not a fight', () => {
    const G = makeState(['0']);
    seedNightbringerDeck(G);
    injectFightHook(G, HENCHMAN_ONE, { primitive: 'gain-recruit-current', magnitude: 1 });
    fight(G, NIGHTBRINGER);
    openPicks(G);
    const attackBefore = G.turnEconomy.attack;
    const recruitBefore = G.turnEconomy.recruit;
    answer(G, '0', 1);
    assert.deepStrictEqual(G.playerZones['0']!.victory, [HENCHMAN_ONE]);
    assert.deepStrictEqual(G.villainDeck.deck, [BYSTANDER, VILLAIN_THREE, TWIST]);
    assertLoggedOnce(G, `Player 0 defeated Henchman One (${HENCHMAN_ONE}) from the Villain Deck (${NIGHTBRINGER_REF}).`, 'applied', HENCHMAN_ONE);
    assert.equal(G.pendingSeatChoice?.kind, 'nightbringer-order');
    assert.deepStrictEqual(labelsFor(G, '0'), ['Top to bottom: Bystander, Villain Three', 'Top to bottom: Villain Three, Bystander']);
    assert.equal(G.turnEconomy.recruit, recruitBefore, 'the Fight effect waits for the put-back');
    answer(G, '0', 1);
    assert.deepStrictEqual(G.villainDeck.deck, [VILLAIN_THREE, BYSTANDER, TWIST]);
    assert.equal(G.turnEconomy.recruit, recruitBefore + 1, 'the defeated Henchman\'s Fight effect ran');
    const putBackIndex = logIndexContaining(G, 'put the other 2 revealed cards back on top of the Villain Deck');
    const recruitIndex = logIndexContaining(G, 'gained +1 recruit');
    assert.ok(putBackIndex >= 0 && recruitIndex > putBackIndex, 'the Fight effect line follows the put-back line');
    // why: gain-recruit-current has no legacy keyword, so the only "Fight effect:" line is the
    // handler's own self-narration; no composed `Fight effect: …` line is written.
    const fightEffectLines = G.messages.filter((entry) => entry.text.includes('Fight effect:'));
    assert.deepStrictEqual(fightEffectLines.map((entry) => entry.text.endsWith('Fight effect: gained +1 recruit.')), [true]);
    assert.equal(G.notableEvents.some((event) => event.type === 'fightResolved'), false, 'no fightResolved');
    assert.equal(G.messages.some((entry) => /fought/.test(entry.text)), false, 'no fought line');
    assert.equal(G.turnEconomy.attack, attackBefore);
    assert.equal(G.pendingEnigmaPeekOffers, undefined);
    assert.equal(G.pendingSeatChoice, undefined);
  });

  it('T12: declining still reorders all three, default as revealed', () => {
    const G = nightbringerState();
    answer(G, '0', 0);
    assertLoggedOnce(G, `Player 0 chose not to defeat a revealed Villain (${NIGHTBRINGER_REF}).`, 'neutral', NIGHTBRINGER);
    assert.equal(G.pendingSeatChoice?.kind, 'nightbringer-order');
    assert.deepStrictEqual(labelsFor(G, '0'), [
      'Top to bottom: Henchman One, Bystander, Villain Three',
      'Top to bottom: Henchman One, Villain Three, Bystander',
      'Top to bottom: Bystander, Henchman One, Villain Three',
      'Top to bottom: Bystander, Villain Three, Henchman One',
      'Top to bottom: Villain Three, Henchman One, Bystander',
      'Top to bottom: Villain Three, Bystander, Henchman One',
    ]);
    assert.equal(G.pendingSeatChoice?.defaultOptionIndex, 0);
    answer(G, '0', 0);
    assert.deepStrictEqual(G.villainDeck.deck, [HENCHMAN_ONE, BYSTANDER, VILLAIN_THREE, TWIST]);
  });

  it('T13: no eligible card opens the order step directly; one ineligible card or none opens nothing', () => {
    const G = makeState(['0']);
    seedNightbringerDeck(G);
    G.villainDeck.deck = [BYSTANDER, VILLAIN_THREE, TWIST];
    fight(G, NIGHTBRINGER);
    openPicks(G);
    assertLoggedOnce(G, `None of the revealed cards is a Villain worth 2VP or less (${NIGHTBRINGER_REF}).`, 'neutral', NIGHTBRINGER);
    assert.equal(G.pendingSeatChoice?.kind, 'nightbringer-order');
    assert.equal(labelsFor(G, '0').length, 6);

    const single = makeState(['0']);
    seedNightbringerDeck(single);
    single.villainDeck.deck = [TWIST];
    fight(single, NIGHTBRINGER);
    openPicks(single);
    assert.equal(single.pendingSeatChoice, undefined);
    assert.equal(single.pendingVillainFightPicks, undefined);

    const empty = makeState(['0']);
    fight(empty, NIGHTBRINGER);
    openPicks(empty);
    assertLoggedOnce(empty, `The Villain Deck is empty; there is nothing to reveal (${NIGHTBRINGER_REF}).`, 'blocked', NIGHTBRINGER);
    assert.equal(empty.pendingSeatChoice, undefined);
  });

  it('T14: an Endless Armies Fight plays the reordered top through the shared bridge', () => {
    const G = makeState(['0']);
    seedNightbringerDeck(G);
    injectFightHook(G, HENCHMAN_ONE, { primitive: 'play-villain-deck-cards', magnitude: 2 });
    fight(G, NIGHTBRINGER);
    openPicks(G);
    answer(G, '0', 1);
    answer(G, '0', 1);
    assert.equal(logsWithText(G, `Fight effect: Henchman One (${HENCHMAN_ONE}) plays the top 2 card(s) of the Villain Deck.`).length, 1);
    assert.deepStrictEqual(G.villainDeck.deck, [TWIST], 'the two reordered cards were played');
    assert.ok(G.city.includes(VILLAIN_THREE), 'Villain Three (played first) entered the City');
    const playIndex = logIndexContaining(G, 'plays the top 2');
    const villainIndex = G.messages.findIndex((entry, index) => index > playIndex && entry.text.includes(VILLAIN_THREE));
    const bystanderIndex = G.messages.findIndex((entry, index) => index > playIndex && entry.text.includes(BYSTANDER));
    assert.ok(playIndex >= 0 && villainIndex > playIndex && bystanderIndex > villainIndex, 'V3 played before BY');
  });

  it('T14b: a Ring defeating a Ring — Remaker\'s pick is queued in the chain and opened after the move', () => {
    const G = nightbringerState(REMAKER, ['0', '1']);
    G.playerZones['0']!.discard = [HERO_D];
    answer(G, '0', 1);
    answer(G, '0', 0);
    assert.deepStrictEqual(G.pendingVillainFightPicks?.map((entry) => entry.primitive), ['give-card-to-right-player-current']);
    assert.equal(G.pendingSeatChoice, undefined);
    openPicks(G);
    // why: re-read through a fresh binding; the `undefined` assertion above narrows G.pendingSeatChoice.
    const parkedChoice = (G as LegendaryGameState).pendingSeatChoice;
    assert.equal(parkedChoice?.kind, 'remaker-give');
    assert.equal(parkedChoice?.villainFightPick?.targetSeat, '1');
  });

  it('T15: a defeat records the WP-871 flag only in a match with that restriction', () => {
    const restricted = makeState(['0']);
    seedNightbringerDeck(restricted);
    restricted.villainFightRestrictions = { 'test-orrgo': { kind: 'requires-villain-defeated-this-turn' } };
    fight(restricted, NIGHTBRINGER);
    openPicks(restricted);
    answer(restricted, '0', 1);
    assert.equal(restricted.turnEconomy.hasDefeatedVillainThisTurn, true);

    const plain = nightbringerState();
    answer(plain, '0', 1);
    assert.equal(Object.hasOwn(plain.turnEconomy, 'hasDefeatedVillainThisTurn'), false);
  });

  it('T16: a changed Villain Deck top defeats and reorders nothing', () => {
    const G = nightbringerState();
    G.villainDeck.deck = [BYSTANDER, HENCHMAN_ONE, VILLAIN_THREE, TWIST];
    answer(G, '0', 1);
    assertLoggedOnce(G,
      `The revealed cards are no longer on top of the Villain Deck; nothing is defeated or put back (${NIGHTBRINGER_REF}).`,
      'neutral',
      NIGHTBRINGER,
    );
    assert.deepStrictEqual(G.villainDeck.deck, [BYSTANDER, HENCHMAN_ONE, VILLAIN_THREE, TWIST]);
    assert.deepStrictEqual(G.playerZones['0']!.victory, []);
    assert.equal(G.pendingSeatChoice, undefined);
  });

  it('T16b: a converted Skrull or Officer routes home through the shared routing helper', () => {
    const G = makeState(['0']);
    G.villainDeck = { deck: [SKRULL], discard: [] };
    G.villainDeckCardTypes = { ...G.villainDeckCardTypes, [SKRULL]: 'villain' } as LegendaryGameState['villainDeckCardTypes'];
    G.convertedVillainOrigins = { [SKRULL]: 'skrull' };
    fight(G, NIGHTBRINGER);
    openPicks(G);
    assert.deepStrictEqual(labelsFor(G, '0'), ['Don\'t defeat a Villain', 'Defeat Skrull Hero (1 VP)']);
    answer(G, '0', 1);
    assert.deepStrictEqual(G.playerZones['0']!.discard, [SKRULL], 'the Skrull is gained into the discard');
    assert.deepStrictEqual(G.playerZones['0']!.victory, []);
    assert.equal(G.convertedVillainOrigins?.[SKRULL], undefined, 'its origin is deleted');
    assert.equal(logsWithText(G, `Player 0 defeated the Skrull Skrull Hero (${SKRULL}) and gained the Hero into their discard pile.`).length, 1);

    const officerState = makeState(['0']);
    officerState.villainDeck = { deck: [OFFICER], discard: [] };
    officerState.villainDeckCardTypes = { ...officerState.villainDeckCardTypes, [OFFICER]: 'villain' } as LegendaryGameState['villainDeckCardTypes'];
    officerState.convertedVillainOrigins = { [OFFICER]: 'shield-officer' };
    fight(officerState, NIGHTBRINGER);
    openPicks(officerState);
    answer(officerState, '0', 1);
    assert.deepStrictEqual(officerState.playerZones['0']!.discard, [SHIELD_OFFICER_EXT_ID]);
    assert.deepStrictEqual(officerState.playerZones['0']!.victory, []);
  });
});

describe('WP-872 Remaker, The Matter Rearranger (D-24817)', () => {
  it('T17: gives a hand or discard card (each id once per zone) to the previous seat', () => {
    const G = makeState(['0', '1', '2']);
    G.playerZones['0']!.hand = [HERO_H];
    G.playerZones['0']!.discard = [HERO_D, HERO_D];
    assert.equal(rightNeighborSeat(G, '0'), '2');
    fight(G, REMAKER);
    assertLoggedOnce(G, `Player 0 may give a card from their hand or discard pile to Player 2 (${REMAKER_REF}).`, 'neutral', REMAKER);
    openPicks(G);
    assert.equal(G.pendingSeatChoice?.kind, 'remaker-give');
    assert.deepStrictEqual(labelsFor(G, '0'), ['Give nothing', 'Hero H (hand)', 'Hero D (discard pile)']);
    answer(G, '0', 2);
    assert.deepStrictEqual(G.playerZones['2']!.hand, [HERO_D]);
    assert.deepStrictEqual(G.playerZones['0']!.discard, [HERO_D]);
    assert.deepStrictEqual(G.playerZones['1']!.hand, []);
    assertLoggedOnce(G, `Player 0 gave Hero D (${HERO_D}) to Player 2, who put it in their hand (${REMAKER_REF}).`, 'applied', HERO_D);
  });

  it('T18: one seat, a decline and an empty hand and discard', () => {
    const solo = makeState(['0']);
    solo.playerZones['0']!.hand = [HERO_H];
    fight(solo, REMAKER);
    assert.equal(solo.pendingVillainFightPicks, undefined);
    assertLoggedOnce(solo, `Player 0 has no player on their right to give a card to (${REMAKER_REF}).`, 'blocked', REMAKER);

    const declined = makeState(['0', '1']);
    declined.playerZones['0']!.hand = [HERO_H];
    fight(declined, REMAKER);
    openPicks(declined);
    answer(declined, '0', 0);
    assertLoggedOnce(declined, `Player 0 chose not to give a card (${REMAKER_REF}).`, 'neutral', REMAKER);
    assert.deepStrictEqual(declined.playerZones['0']!.hand, [HERO_H]);
    assert.deepStrictEqual(declined.playerZones['1']!.hand, []);

    const empty = makeState(['0', '1']);
    fight(empty, REMAKER);
    openPicks(empty);
    assertLoggedOnce(empty, `Player 0 has no card in their hand or discard pile to give (${REMAKER_REF}).`, 'blocked', REMAKER);
    assert.equal(empty.pendingSeatChoice, undefined);
    assert.equal(empty.pendingVillainFightPicks, undefined);
  });
});

/**
 * The game.test.ts mock match configuration (set-qualified test ids).
 *
 * @returns A MatchConfiguration the setup accepts.
 */
function createMockMatchConfiguration(): MatchConfiguration {
  return {
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
}

/** A started two-seat match through the real reducer. */
interface ReducerMatch {
  state: ReducerState;
  makeMove: (state: unknown, moveName: string, args: unknown[], playerID: string) => ReducerState;
  activeSeat: string;
  otherSeat: string;
}

/**
 * Starts a real two-seat match (the game.test.ts WP-845 pattern; the first player is random).
 *
 * @returns The started match with its active and other seat.
 */
function startReducerMatch(): ReducerMatch {
  const reducer = CreateGameReducer({ game: LegendaryGame, isClient: false });
  const makeMove: ReducerMatch['makeMove'] = (state, moveName, args, playerID) =>
    reducer(state, { type: 'MAKE_MOVE', payload: { type: moveName, args, playerID } });
  const initialState = InitializeGame({ game: LegendaryGame, numPlayers: 2, setupData: createMockMatchConfiguration() });
  let state = makeMove(initialState, 'setPlayerReady', [{ ready: true }], '0');
  state = makeMove(state, 'setPlayerReady', [{ ready: true }], '1');
  state = makeMove(state, 'startMatchIfReady', [], '0');
  const activeSeat = String(state.ctx.currentPlayer);
  const otherSeat = activeSeat === '0' ? '1' : '0';
  return { state, makeMove, activeSeat, otherSeat };
}

describe('WP-872 wiring (D-24817)', () => {
  it('T19: applyOnBeginParity deletes an owed pick, and a fresh state never seeds the field', () => {
    const freshG = makeState(['0', '1']);
    assert.equal(Object.hasOwn(freshG, 'pendingVillainFightPicks'), false, 'never seeded');
    const match = startReducerMatch();
    assert.equal(Object.hasOwn(match.state.G as object, 'pendingVillainFightPicks'), false, 'never seeded by setup');
    freshG.pendingVillainFightPicks = [{ primitive: 'reveal-villain-deck-defeat-low-vp-current', playerID: '0', sourceCardId: NIGHTBRINGER }];
    applyOnBeginParity(freshG, '0');
    assert.equal(Object.hasOwn(freshG, 'pendingVillainFightPicks'), false, 'deleted at turn start');
  });

  it('T20: real reducer — fight Liar, claim, the non-active target decides, the turn proceeds', () => {
    const match = startReducerMatch();
    const { makeMove, activeSeat, otherSeat } = match;
    const injectedG = structuredClone(match.state.G) as LegendaryGameState;
    injectedG.city[0] = LIAR;
    injectedG.villainDeckCardTypes = { ...injectedG.villainDeckCardTypes, [LIAR]: 'henchman' };
    injectedG.villainAbilityHooks = [...injectedG.villainAbilityHooks, ...fightHooksFor(RINGS_HOOKS, LIAR)];
    injectedG.cardStats = {
      ...injectedG.cardStats,
      [LIAR]: { attack: 0, recruit: 0, cost: 0, fightCost: 0 },
    } as LegendaryGameState['cardStats'];
    injectedG.cardDisplayData = {
      ...injectedG.cardDisplayData,
      [HIDDEN_A]: { name: HIDDEN_A_NAME, imageUrl: '', cost: 3 },
    } as LegendaryGameState['cardDisplayData'];
    injectedG.playerZones[otherSeat]!.deck = [HIDDEN_A, ...injectedG.playerZones[otherSeat]!.deck];
    injectedG.turnEconomy.attack = 10;
    injectedG.currentStage = 'main';

    let state = makeMove({ ...match.state, G: injectedG }, 'fightVillain', [{ cityIndex: 0 }], activeSeat);
    assert.equal((state.G as LegendaryGameState).city[0], null, 'Liar was defeated');
    assert.equal((state.G as LegendaryGameState).pendingSeatChoice?.kind, 'liar-claim', 'onMove opened the claim');

    state = makeMove(state, 'resolveSeatChoice', [{ optionIndex: 0 }], activeSeat);
    const claimedG = state.G as LegendaryGameState;
    assert.equal(claimedG.pendingSeatChoice?.kind, 'liar-decide');
    assert.deepStrictEqual(claimedG.pendingSeatChoice?.addressedSeats, [otherSeat]);
    assert.equal(Object.hasOwn(state.ctx.activePlayers ?? {}, otherSeat), true, 'the non-active target was admitted');

    state = makeMove(state, 'resolveSeatChoice', [{ optionIndex: 1 }], otherSeat);
    const decidedG = state.G as LegendaryGameState;
    assert.equal(decidedG.playerZones[otherSeat]!.discard.includes(HIDDEN_A), true, 'the card is in the target\'s discard');
    assert.equal(decidedG.pendingSeatChoice, undefined);
    assert.equal(decidedG.pendingVillainFightPicks, undefined);
    assert.equal(Object.hasOwn(state.ctx.activePlayers ?? {}, otherSeat), false, 'the turn returned to the active seat');

    state = makeMove(state, 'advanceStage', [], activeSeat);
    assert.equal((state.G as LegendaryGameState).currentStage, 'cleanup', 'a further move from the active seat lands');
  });
});
