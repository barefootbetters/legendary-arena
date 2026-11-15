/**
 * "You may gain a Wound. If you do, you get Rooftops Conqueror 4" — anni Super-Skrull's Put to the
 * Torch, line 2 (WP-893 / EC-931 / D-24850).
 *
 * The hooks are built by buildHeroAbilityHooks from the committed data/cards/*.json (the marker
 * pass output), and Flying Shield Block from data/cards/ca75.json, so these tests pin the parse,
 * the prompt, the grant-time Conqueror read and the keep-or-forfeit rule together. Diving Block
 * uses a synthetic hook (the gainWoundRewardNonAttack.test.ts precedent). Every grant case builds
 * the recipient's playerZones: without them evaluateCondition returns false and a "no Attack"
 * assertion would pass for the wrong reason.
 *
 * node:test + node:assert only — no boardgame.io/testing import.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHeroAbilityHooks } from '../setup/heroAbility.setup.js';
import { executeHeroEffects } from './heroEffects.execute.js';
import { GAIN_WOUND_REWARD_SEAT_CHOICE_KIND } from './gainWoundReward.logic.js';
import { resolveSeatChoice } from '../moves/seatChoice.resolve.js';
import { WOUND_EXT_ID } from '../setup/pilesInit.js';
import { LegendaryGame } from '../game.js';
import { formatCardRef } from '../log/logDisplay.js';
import { makeGlobalPiles, makeMastermindState, makeTurnEconomy } from '../test/fixtureBuilders.js';
import type { LegendaryGameState, MatchConfiguration } from '../types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import type { CardExtId } from '../state/zones.types.js';

// why: resolve the repo-root data directory from this test's own location (the
// gainWoundRewardNonAttack.test.ts precedent), so the tests read the card data that ships.
const CARDS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'data', 'cards');

const HERO_DECK_IDS = ['anni/super-skrull', 'ca75/captain-america-falcon'];
const DIVING_BLOCK_ID = 'core/captain-america/diving-block#0';
const BRIDGE_VILLAIN = 'test/villain/bridge-thug#0';
const STREETS_VILLAIN = 'test/villain/streets-thug#0';
const ROOFTOPS_VILLAIN = 'test/villain/rooftops-thug#0';
const DECK_TOP = 'test/deck/top#0' as CardExtId;

/** Identity Shuffle so any draw is deterministic in tests. */
const IDENTITY_RANDOM = { Shuffle: <T,>(deck: T[]): T[] => [...deck] };

/**
 * A registry stub over the committed sets the hero decks need.
 *
 * @returns A structural registry reader.
 */
function makeSetRegistry(): { listCards: () => never[]; getSet: (abbr: string) => unknown } {
  const sets: Record<string, unknown> = {};
  for (const heroDeckId of HERO_DECK_IDS) {
    const setAbbr = heroDeckId.split('/')[0]!;
    sets[setAbbr] = JSON.parse(readFileSync(join(CARDS_DIRECTORY, `${setAbbr}.json`), 'utf8'));
  }
  return { listCards: () => [], getSet: (abbr: string) => sets[abbr] };
}

const REAL_HOOKS: HeroAbilityHook[] = buildHeroAbilityHooks(
  makeSetRegistry(),
  { heroDeckIds: HERO_DECK_IDS } as unknown as MatchConfiguration,
);

/**
 * The card ids of every copy of a card, in deck order.
 *
 * @param cardSlug - The card slug.
 * @returns The copy ids.
 */
function copiesOf(cardSlug: string): CardExtId[] {
  const copies: CardExtId[] = [];
  for (const hook of REAL_HOOKS) {
    if (hook.cardId.includes(`/${cardSlug}#`) && !copies.includes(hook.cardId)) {
      copies.push(hook.cardId);
    }
  }
  return copies;
}

const PUT_TO_THE_TORCH = copiesOf('put-to-the-torch')[0]!;
const [FSB_A] = copiesOf('flying-shield-block');
const TORCH_REF = formatCardRef({}, PUT_TO_THE_TORCH);
const OPTION_GAIN = { label: 'Gain a Wound: you get Rooftops Conqueror 4' };

/**
 * A full-size City with Villains in the named spaces (index 0 = Sewers … 4 = Bridge).
 *
 * @param spaces - The occupied spaces.
 * @returns The City array.
 */
function cityWith(...spaces: ('bridge' | 'streets' | 'rooftops')[]): (string | null)[] {
  const city: (string | null)[] = [null, null, null, null, null];
  if (spaces.includes('rooftops')) {
    city[2] = ROOFTOPS_VILLAIN;
  }
  if (spaces.includes('streets')) {
    city[3] = STREETS_VILLAIN;
  }
  if (spaces.includes('bridge')) {
    city[4] = BRIDGE_VILLAIN;
  }
  return city;
}

/**
 * A state wide enough for the hero executor, the seat-choice resolve and both interceptions.
 * Every seat named in `hands` gets its playerZones.
 *
 * @param hands - Each seat's hand.
 * @param city - The City spaces.
 * @returns A LegendaryGameState sufficient for these tests.
 */
function makeState(hands: Record<string, string[]>, city: (string | null)[]): LegendaryGameState {
  const playerZones: Record<string, unknown> = {};
  for (const seat of Object.keys(hands)) {
    playerZones[seat] = { deck: [DECK_TOP], hand: [...hands[seat]!], discard: [], victory: [], inPlay: [] };
  }
  return {
    currentStage: 'main',
    playerZones,
    piles: makeGlobalPiles({ wounds: [WOUND_EXT_ID, WOUND_EXT_ID, WOUND_EXT_ID] }),
    heroAbilityHooks: [...REAL_HOOKS, { cardId: DIVING_BLOCK_ID, timing: 'onPlay', keywords: ['diving-block'] }],
    villainAbilityHooks: [],
    hookRegistry: [],
    turnEconomy: { ...makeTurnEconomy() },
    messages: [],
    notableEvents: [],
    cardDisplayData: {},
    cardKeywords: {},
    cardStats: {},
    cardTraits: {},
    counters: {},
    city: [...city],
    hq: [null, null, null, null, null],
    ko: [],
    attachedBystanders: {},
    mastermind: makeMastermindState(),
    scheme: { twistPile: [] },
    escapedPile: [],
    villainDeck: { deck: ['v-1'], discard: [] },
    villainDeckCardTypes: {},
    heroDeck: ['h-1'],
    selection: {
      schemeId: 'core/portals-to-the-dark-dimension',
      mastermindId: 'test-mastermind',
      villainGroupIds: [],
      henchmanGroupIds: [],
      heroDeckIds: [],
    },
  } as unknown as LegendaryGameState;
}

/**
 * A move context whose only live fields are G + playerID + random.
 *
 * @param G - The game state.
 * @param playerID - The submitting seat.
 * @returns A resolveSeatChoice context.
 */
function makeContext(G: LegendaryGameState, playerID: string): Parameters<typeof resolveSeatChoice>[0] {
  return { G, playerID, ctx: { currentPlayer: '0' }, events: {}, random: IDENTITY_RANDOM, log: {} } as unknown as Parameters<typeof resolveSeatChoice>[0];
}

/** The live play-phase turn hooks, read once. */
const PLAY_TURN = (
  LegendaryGame.phases as Record<string, { turn?: { onMove?: (context: unknown) => void } }>
).play!.turn!;

/**
 * Opens the interception waves through the LIVE play-phase turn.onMove.
 *
 * @param G - The game state, mutated in place.
 */
function openWaves(G: LegendaryGameState): void {
  PLAY_TURN.onMove!({ G, ctx: { currentPlayer: '0' }, events: {}, random: IDENTITY_RANDOM });
}

/**
 * Plays Put to the Torch for seat 0.
 *
 * @param G - The game state, mutated in place.
 */
function playTorch(G: LegendaryGameState): void {
  G.playerZones['0']!.inPlay = [PUT_TO_THE_TORCH];
  executeHeroEffects(G, { ctx: { turn: 1, currentPlayer: '0' }, random: IDENTITY_RANDOM }, '0', PUT_TO_THE_TORCH);
}

/**
 * Plays Put to the Torch and answers its gain-a-Wound prompt.
 *
 * @param G - The game state, mutated in place.
 * @param optionIndex - 0 gain, 1 decline.
 */
function playTorchAndAnswer(G: LegendaryGameState, optionIndex: number): void {
  playTorch(G);
  assert.equal(G.pendingSeatChoice?.kind, GAIN_WOUND_REWARD_SEAT_CHOICE_KIND);
  resolveSeatChoice(makeContext(G, '0'), { optionIndex });
}

/**
 * The index of the exact log line with the exact outcome, or -1.
 *
 * @param G - The game state.
 * @param text - The expected line.
 * @param outcome - The expected outcome.
 * @returns The message index, or -1 when absent.
 */
function logIndex(G: LegendaryGameState, text: string, outcome: string): number {
  return G.messages.findIndex((entry) => entry.text === text && entry.outcome === outcome);
}

/**
 * Asserts the log holds the exact line with the exact outcome.
 *
 * @param G - The game state.
 * @param text - The expected line.
 * @param outcome - The expected outcome.
 * @returns The line's message index.
 */
function assertLogged(G: LegendaryGameState, text: string, outcome: string): number {
  const index = logIndex(G, text, outcome);
  assert.ok(index !== -1, `expected log line [${outcome}] "${text}"; got ${JSON.stringify(G.messages.map((entry) => [entry.outcome, entry.text]))}`);
  return index;
}

const N4 = `Player 0 gained a Wound (${TORCH_REF}).`;
const C1 = `Player 0 got +4 Attack — a Villain is in the Rooftops (${TORCH_REF}).`;
const C2_EMPTY = `Player 0 got no Attack — no Villain is in the Rooftops (${TORCH_REF}).`;
const C2_MISSING = `Player 0 got no Attack — there is no Rooftops in the City (${TORCH_REF}).`;

describe('gain-wound-reward Rooftops Conqueror — Put to the Torch (WP-893)', () => {
  it('1. play with the Bridge, Streets and Rooftops occupied: +2 at play, the prompt, N1', () => {
    const G = makeState({ '0': [] }, cityWith('bridge', 'streets', 'rooftops'));
    playTorch(G);
    assert.equal(G.turnEconomy.attack, 2, 'lines 0 / 1 resolve at play; line 2 grants nothing yet');
    const choice = G.pendingSeatChoice!;
    assert.equal(choice.kind, 'gain-wound-reward');
    assert.deepEqual(choice.seatPrompts['0']!.options, [OPTION_GAIN, { label: "Don't gain a Wound" }]);
    assert.equal(choice.defaultOptionIndex, 1);
    assert.deepEqual(choice.gainWoundReward, { rewardType: 'rooftops-conqueror', magnitude: 4, sourceCardId: PUT_TO_THE_TORCH });
    assertLogged(G, `Player 0 may gain a Wound to get Rooftops Conqueror 4 (${TORCH_REF}).`, 'neutral');
  });

  it('2. gain with the Rooftops occupied: a Wound in the discard pile, +4 (total 6), N4 then C1', () => {
    const G = makeState({ '0': [] }, cityWith('bridge', 'streets', 'rooftops'));
    playTorchAndAnswer(G, 0);
    assert.deepEqual(G.playerZones['0']!.discard, [WOUND_EXT_ID]);
    assert.equal(G.turnEconomy.attack, 6);
    assert.ok(assertLogged(G, N4, 'applied') < assertLogged(G, C1, 'applied'), 'N4 precedes C1');
  });

  it('3. gain with the Rooftops empty: the Wound is kept, no Attack, N4 then C2 "no Villain is in the Rooftops"', () => {
    const G = makeState({ '0': [] }, cityWith('bridge', 'streets'));
    playTorchAndAnswer(G, 0);
    assert.deepEqual(G.playerZones['0']!.discard, [WOUND_EXT_ID]);
    assert.equal(G.turnEconomy.attack, 2, 'only lines 0 / 1');
    assert.ok(assertLogged(G, N4, 'applied') < assertLogged(G, C2_EMPTY, 'blocked'), 'N4 precedes C2');
    assert.equal(logIndex(G, C1, 'applied'), -1);
  });

  it('4. gain in a 2-space City: the Wound is kept, no Attack, C2 "there is no Rooftops in the City"', () => {
    const G = makeState({ '0': [] }, [ROOFTOPS_VILLAIN, ROOFTOPS_VILLAIN]);
    playTorchAndAnswer(G, 0);
    assert.deepEqual(G.playerZones['0']!.discard, [WOUND_EXT_ID]);
    assert.equal(G.turnEconomy.attack, 0);
    assertLogged(G, C2_MISSING, 'blocked');
  });

  it('5. decline: no Wound, no Attack, L3', () => {
    const G = makeState({ '0': [] }, cityWith('rooftops'));
    playTorchAndAnswer(G, 1);
    assert.deepEqual(G.playerZones['0']!.discard, []);
    assert.equal(G.piles.wounds.length, 3);
    assert.equal(G.turnEconomy.attack, 0);
    assertLogged(G, `Player 0 chose not to gain a Wound (${TORCH_REF}).`, 'neutral');
  });

  it('6. empty Wound supply: L2, no choice opened', () => {
    const G = makeState({ '0': [] }, cityWith('rooftops'));
    G.piles.wounds = [];
    playTorch(G);
    assert.equal(G.pendingSeatChoice, undefined);
    assert.equal(G.turnEconomy.attack, 0);
    assertLogged(G, `Player 0's ${TORCH_REF} did nothing — the Wound supply is empty.`, 'blocked');
  });

  it('7. grant-time read: the Rooftops Villain leaves G.city before the choice resolves → no Attack, C2', () => {
    const G = makeState({ '0': [] }, cityWith('rooftops'));
    playTorch(G);
    // why: a direct test edit — real play cannot do this (the open seat choice blocks every other
    // move); it proves the condition is read when the Wound is kept, not snapshotted at play.
    G.city[2] = null;
    resolveSeatChoice(makeContext(G, '0'), { optionIndex: 0 });
    assert.deepEqual(G.playerZones['0']!.discard, [WOUND_EXT_ID]);
    assert.equal(G.turnEconomy.attack, 0);
    assertLogged(G, C2_EMPTY, 'blocked');
  });

  it('8a. Diving Block in hand, gain then reveal: no Wound, no Attack, N5 then N8', () => {
    const G = makeState({ '0': [DIVING_BLOCK_ID] }, cityWith('rooftops'));
    playTorchAndAnswer(G, 0);
    assertLogged(G, `Player 0 would gain a Wound — they get Rooftops Conqueror 4 if they keep it (${TORCH_REF}).`, 'neutral');
    openWaves(G);
    assert.deepEqual(G.pendingSeatChoice!.seatPrompts['0']!.options, [
      { label: 'Reveal Diving Block: prevent the Wound and draw a card' },
      { label: 'Take the Wound (then you get Rooftops Conqueror 4)' },
    ]);
    resolveSeatChoice(makeContext(G, '0'), { optionIndex: 0 });
    assert.deepEqual(G.playerZones['0']!.discard, []);
    assert.equal(G.turnEconomy.attack, 0);
    assertLogged(G, `Player 0's Wound was prevented, so they do not get Rooftops Conqueror 4 (${TORCH_REF}).`, 'blocked');
    assert.equal(logIndex(G, C1, 'applied'), -1);
  });

  it('8b. Diving Block in hand, gain then decline: the Wound is kept, N7 then C1', () => {
    const G = makeState({ '0': [DIVING_BLOCK_ID] }, cityWith('rooftops'));
    playTorchAndAnswer(G, 0);
    openWaves(G);
    resolveSeatChoice(makeContext(G, '0'), { optionIndex: 1 });
    assert.deepEqual(G.playerZones['0']!.discard, [WOUND_EXT_ID]);
    assert.equal(G.turnEconomy.attack, 4);
    const keptIndex = assertLogged(G, `Player 0 kept the Wound (${TORCH_REF}).`, 'applied');
    assert.ok(keptIndex < assertLogged(G, C1, 'applied'), 'N7 precedes C1');
  });

  it('9. Flying Shield Block: the recipient\'s tagged decline label ends "(then you get Rooftops Conqueror 4)"', () => {
    const G = makeState({ '0': [FSB_A!] }, cityWith('rooftops'));
    playTorchAndAnswer(G, 0);
    openWaves(G);
    const declineLabel = G.pendingSeatChoice!.seatPrompts['0']!.options[1]!.label;
    assert.ok(declineLabel.endsWith(' (then you get Rooftops Conqueror 4)'), declineLabel);
  });
});
