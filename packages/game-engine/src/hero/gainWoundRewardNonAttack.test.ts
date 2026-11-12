/**
 * "You may gain a Wound. If you do, <reward>": the non-Attack rewards (WP-885 / EC-923 / D-24836).
 *
 * wpnx Violent Conditioning (Berserk twice), msis Hulk Gets Smashed (KO up to two other cards from
 * hand / discard) and wwhk Mood Swings (Transform into Raging Savage). The hooks are built by
 * buildHeroAbilityHooks from the committed data/cards/*.json (the marker pass output), and Flying
 * Shield Block from data/cards/ca75.json, so these tests pin the parse, the prompt, the grant and
 * the keep-or-forfeit rule together. Diving Block uses a synthetic hook, as in
 * gainWoundReward.test.ts.
 *
 * node:test + node:assert only — no boardgame.io/testing import.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHeroAbilityHooks } from '../setup/heroAbility.setup.js';
import { buildTransformTargets } from '../setup/buildHeroDeck.js';
import { executeHeroEffects } from './heroEffects.execute.js';
import { GAIN_WOUND_REWARD_SEAT_CHOICE_KIND } from './gainWoundReward.logic.js';
import { resolveSeatChoice } from '../moves/seatChoice.resolve.js';
import { resolveOptionalKoReward } from '../moves/optionalKoReward.resolve.js';
import { getLegalMoves } from '../simulation/ai.legalMoves.js';
import { buildUIState } from '../ui/uiState.build.js';
import { filterUIStateForAudience } from '../ui/uiState.filter.js';
import { WOUND_EXT_ID } from '../setup/pilesInit.js';
import { LegendaryGame } from '../game.js';
import { formatCardRef } from '../log/logDisplay.js';
import { makeCardStatEntry, makeGlobalPiles, makeMastermindState, makeTurnEconomy } from '../test/fixtureBuilders.js';
import type { LegendaryGameState, MatchConfiguration } from '../types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import type { CardExtId } from '../state/zones.types.js';

// why: resolve the repo-root data directory from this test's own location (the
// gainWoundReward.test.ts precedent), so the tests read the card data that ships.
const CARDS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'data', 'cards');

const HERO_DECK_IDS = ['wpnx/weapon-x-wolverine', 'msis/bruce-banner', 'wwhk/skaar-son-of-hulk', 'ca75/captain-america-falcon'];
const DIVING_BLOCK_ID = 'core/captain-america/diving-block#0';
const STRENGTH_HERO_ID = 'test/avenger/punch#0';
const INSTINCT_HERO_ID = 'test/xmen/claws#0';
const BYSTANDER = 'pile-bystander';
const AGENT = 'starter-agent#0' as CardExtId;
const TROOPER = 'starter-trooper#0' as CardExtId;
const DECK_TOP_A = 'test/deck/top-a#0' as CardExtId;
const DECK_TOP_B = 'test/deck/top-b#0' as CardExtId;
const DECK_TOP_C = 'test/deck/top-c#0' as CardExtId;
const RAGING_SAVAGE = 'wwhk/skaar-son-of-hulk/raging-savage#0' as CardExtId;

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

const REGISTRY = makeSetRegistry();
const REAL_HOOKS: HeroAbilityHook[] = buildHeroAbilityHooks(REGISTRY, { heroDeckIds: HERO_DECK_IDS } as unknown as MatchConfiguration);
const TRANSFORM_TARGETS = buildTransformTargets(['wwhk/skaar-son-of-hulk'], REGISTRY);

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

const VIOLENT_CONDITIONING = copiesOf('violent-conditioning')[0]!;
const HULK_GETS_SMASHED = copiesOf('hulk-gets-smashed')[0]!;
const MOOD_SWINGS = copiesOf('mood-swings')[0]!;
const [FSB_A] = copiesOf('flying-shield-block');

/**
 * A state wide enough for the hero executor, the seat-choice and optional-KO resolves, both
 * interceptions, getLegalMoves and buildUIState.
 *
 * @param hands - Each seat's hand.
 * @returns A LegendaryGameState sufficient for these tests.
 */
function makeState(hands: Record<string, string[]>): LegendaryGameState {
  const playerZones: Record<string, unknown> = {};
  for (const seat of Object.keys(hands)) {
    playerZones[seat] = { deck: [`${seat}-deckcard#0`], hand: [...hands[seat]!], discard: [], victory: [], inPlay: [] };
  }
  return {
    currentStage: 'main',
    playerZones,
    piles: makeGlobalPiles({ bystanders: [BYSTANDER, BYSTANDER, BYSTANDER], wounds: [WOUND_EXT_ID, WOUND_EXT_ID, WOUND_EXT_ID] }),
    heroAbilityHooks: [...REAL_HOOKS, { cardId: DIVING_BLOCK_ID, timing: 'onPlay', keywords: ['diving-block'] }],
    villainAbilityHooks: [],
    hookRegistry: [],
    turnEconomy: { ...makeTurnEconomy() },
    messages: [],
    notableEvents: [],
    cardDisplayData: {
      [MOOD_SWINGS]: { name: 'Mood Swings', imageUrl: '', cost: 3 },
      [RAGING_SAVAGE]: { name: 'Raging Savage', imageUrl: '', cost: 6 },
    },
    cardKeywords: {},
    cardStats: {
      [DECK_TOP_A]: makeCardStatEntry({ attack: 2, cost: 3 }),
      [DECK_TOP_B]: makeCardStatEntry({ attack: 1, cost: 2 }),
      [DECK_TOP_C]: makeCardStatEntry({ attack: 4, cost: 5 }),
      [RAGING_SAVAGE]: makeCardStatEntry({ attack: 3, cost: 6 }),
    },
    cardTraits: {
      [STRENGTH_HERO_ID]: { team: 'avengers', heroClass: 'strength' },
      [INSTINCT_HERO_ID]: { team: 'x-men', heroClass: 'instinct' },
    },
    counters: {},
    city: [null, null, null, null, null],
    hq: [null, null, null, null, null],
    ko: [],
    attachedBystanders: {},
    mastermind: makeMastermindState(),
    scheme: { twistPile: [] },
    escapedPile: [],
    villainDeck: { deck: ['v-1'], discard: [] },
    villainDeckCardTypes: {},
    heroDeck: ['h-1'],
    transformTargets: { ...TRANSFORM_TARGETS },
    transformDeck: [RAGING_SAVAGE],
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
 * Plays a card for seat 0, with the given cards played before it this turn.
 *
 * @param G - The game state, mutated in place.
 * @param cardId - The card being played.
 * @param playedBefore - Cards played earlier this turn.
 */
function play(G: LegendaryGameState, cardId: CardExtId, playedBefore: string[]): void {
  G.playerZones['0']!.inPlay = [...(playedBefore as CardExtId[]), cardId];
  executeHeroEffects(G, { ctx: { turn: 1, currentPlayer: '0' }, random: IDENTITY_RANDOM }, '0', cardId);
}

/**
 * Plays a card and answers its gain-a-Wound prompt.
 *
 * @param G - The game state, mutated in place.
 * @param cardId - The card being played.
 * @param playedBefore - Cards played earlier this turn.
 * @param optionIndex - 0 gain, 1 decline.
 */
function playAndAnswer(G: LegendaryGameState, cardId: CardExtId, playedBefore: string[], optionIndex: number): void {
  play(G, cardId, playedBefore);
  assert.equal(G.pendingSeatChoice?.kind, GAIN_WOUND_REWARD_SEAT_CHOICE_KIND);
  resolveSeatChoice(makeContext(G, '0'), { optionIndex });
}

/**
 * Resolves the front optional-KO entry for seat 0 through the real move.
 *
 * @param G - The game state, mutated in place.
 * @param args - The { zone, cardId } to KO.
 */
function resolveKo(G: LegendaryGameState, args: { zone: 'hand' | 'discard' | 'inPlay'; cardId: string }): void {
  resolveOptionalKoReward({ G, playerID: '0', ctx: { currentPlayer: '0' }, random: IDENTITY_RANDOM } as never, args as never);
}

/**
 * Asserts the log holds the exact line with the exact outcome.
 *
 * @param G - The game state.
 * @param text - The expected line.
 * @param outcome - The expected outcome.
 */
function assertLogged(G: LegendaryGameState, text: string, outcome: string): void {
  const entries: { text: string; outcome: string }[] = [];
  for (const entry of G.messages) {
    entries.push({ text: entry.text, outcome: entry.outcome });
  }
  assert.ok(
    entries.some((entry) => entry.text === text && entry.outcome === outcome),
    `expected log line [${outcome}] "${text}"; got ${JSON.stringify(entries)}`,
  );
}

/**
 * The optional-KO projection for seat 0 (built, then filtered to seat 0).
 *
 * @param G - The game state.
 * @returns The projected eligible hand and discard card ids.
 */
function projectedKoTargets(G: LegendaryGameState): { hand: string[]; discard: string[] } {
  const full = buildUIState(G, { phase: 'play', turn: 1, currentPlayer: '0' });
  const filtered = filterUIStateForAudience(full, { kind: 'player', playerId: '0' });
  const projection = filtered.pendingOptionalKoReward;
  assert.ok(projection !== undefined, 'an optional-KO entry is projected');
  return {
    hand: projection.eligibleHand.map((card) => card.cardId),
    discard: projection.eligibleDiscard.map((card) => card.cardId),
  };
}

/**
 * The bot's single legal optional-KO move for seat 0.
 *
 * @param G - The game state.
 * @returns The { zone, cardId } the bot would KO.
 */
function botKoTarget(G: LegendaryGameState): { zone: 'hand' | 'discard' | 'inPlay'; cardId: string } {
  const moves = getLegalMoves(G, { phase: 'play', turn: 1, currentPlayer: '0', numPlayers: 1 });
  assert.equal(moves.length, 1, 'exactly one legal move while an optional KO is pending');
  assert.equal(moves[0]!.name, 'resolveOptionalKoReward');
  return moves[0]!.args as { zone: 'hand' | 'discard' | 'inPlay'; cardId: string };
}

/**
 * Counts the Wounds in seat 0's hand ∪ discard.
 *
 * @param G - The game state.
 * @returns The Wound count.
 */
function woundsInHandAndDiscard(G: LegendaryGameState): number {
  const zones = G.playerZones['0']!;
  let count = 0;
  for (const cardId of [...zones.hand, ...zones.discard]) {
    if (cardId === WOUND_EXT_ID) {
      count += 1;
    }
  }
  return count;
}

const VC_REF = formatCardRef({}, VIOLENT_CONDITIONING);
const HGS_REF = formatCardRef({}, HULK_GETS_SMASHED);

describe('gain-wound-reward Berserk — Violent Conditioning (WP-885)', () => {
  it('N1 the prompt names the reward; nothing is granted at play', () => {
    const G = makeState({ '0': [] });
    play(G, VIOLENT_CONDITIONING, []);
    const choice = G.pendingSeatChoice!;
    assert.equal(choice.kind, 'gain-wound-reward');
    assert.deepEqual(choice.seatPrompts['0']!.options, [{ label: 'Gain a Wound: Berserk twice' }, { label: "Don't gain a Wound" }]);
    assert.equal(choice.defaultOptionIndex, 1);
    assert.deepEqual(choice.gainWoundReward, { rewardType: 'berserk', magnitude: 2, sourceCardId: VIOLENT_CONDITIONING });
    assert.equal(G.turnEconomy.attack, 0, 'no free Berserk at play');
    assertLogged(G, `Player 0 may gain a Wound to Berserk twice (${VC_REF}).`, 'neutral');
  });

  it('N4 gain: a Wound, then the top two deck cards are discarded for their printed Attack', () => {
    const G = makeState({ '0': [] });
    G.playerZones['0']!.deck = [DECK_TOP_A, DECK_TOP_B, DECK_TOP_C];
    playAndAnswer(G, VIOLENT_CONDITIONING, [], 0);
    assert.deepEqual(G.playerZones['0']!.discard, [WOUND_EXT_ID, DECK_TOP_A, DECK_TOP_B]);
    assert.deepEqual(G.playerZones['0']!.deck, [DECK_TOP_C]);
    assert.equal(G.turnEconomy.attack, 3, '2 + 1 printed Attack');
    assertLogged(G, `Player 0 gained a Wound (${VC_REF}).`, 'applied');
  });

  it('decline: nothing changes but L3', () => {
    const G = makeState({ '0': [] });
    G.playerZones['0']!.deck = [DECK_TOP_A, DECK_TOP_B];
    playAndAnswer(G, VIOLENT_CONDITIONING, [], 1);
    assert.deepEqual(G.playerZones['0']!.discard, []);
    assert.deepEqual(G.playerZones['0']!.deck, [DECK_TOP_A, DECK_TOP_B]);
    assert.equal(G.turnEconomy.attack, 0);
    assertLogged(G, `Player 0 chose not to gain a Wound (${VC_REF}).`, 'neutral');
  });

  it('N5 / N8 Diving Block reveal: no Berserk — the deck loses only the card Diving Block draws', () => {
    const G = makeState({ '0': [DIVING_BLOCK_ID] });
    G.playerZones['0']!.deck = [DECK_TOP_A, DECK_TOP_B, DECK_TOP_C];
    playAndAnswer(G, VIOLENT_CONDITIONING, [], 0);
    assertLogged(G, `Player 0 would gain a Wound — they Berserk twice if they keep it (${VC_REF}).`, 'neutral');
    openWaves(G);
    assert.deepEqual(G.pendingSeatChoice!.seatPrompts['0']!.options, [
      { label: 'Reveal Diving Block: prevent the Wound and draw a card' },
      { label: 'Take the Wound (then Berserk twice)' },
    ]);
    resolveSeatChoice(makeContext(G, '0'), { optionIndex: 0 });
    assert.deepEqual(G.playerZones['0']!.deck, [DECK_TOP_B, DECK_TOP_C], 'exactly one card left the deck');
    assert.ok(G.playerZones['0']!.hand.includes(DECK_TOP_A), 'Diving Block drew the top card');
    assert.deepEqual(G.playerZones['0']!.discard, [], 'no Wound and no Berserked card in the discard pile');
    assert.equal(G.turnEconomy.attack, 0);
    assertLogged(G, `Player 0's Wound was prevented, so they do not Berserk twice (${VC_REF}).`, 'blocked');
  });

  it('N7 Diving Block decline: the Wound is kept, then Berserk twice', () => {
    const G = makeState({ '0': [DIVING_BLOCK_ID] });
    G.playerZones['0']!.deck = [DECK_TOP_A, DECK_TOP_B, DECK_TOP_C];
    playAndAnswer(G, VIOLENT_CONDITIONING, [], 0);
    openWaves(G);
    resolveSeatChoice(makeContext(G, '0'), { optionIndex: 1 });
    assert.deepEqual(G.playerZones['0']!.discard, [WOUND_EXT_ID, DECK_TOP_A, DECK_TOP_B]);
    assert.equal(G.turnEconomy.attack, 3);
    assertLogged(G, `Player 0 kept the Wound (${VC_REF}).`, 'applied');
  });

  it('Flying Shield Block labels: "(then Berserk twice)" for the recipient, "(they keep its reward)" for another seat', () => {
    const own = makeState({ '0': [FSB_A!] });
    playAndAnswer(own, VIOLENT_CONDITIONING, [], 0);
    openWaves(own);
    assert.equal(own.pendingSeatChoice!.seatPrompts['0']!.options[1]!.label, 'Take the Wound (then Berserk twice)');

    const other = makeState({ '0': [], '1': [FSB_A!] });
    playAndAnswer(other, VIOLENT_CONDITIONING, [], 0);
    openWaves(other);
    assert.equal(other.pendingSeatChoice!.seatPrompts['1']!.options[1]!.label, 'Let Player 0 take the Wound (they keep its reward)');
  });

  it('the effect trace carries rewardComposition berserk through buildUIState + the audience filter', () => {
    const G = makeState({ '0': [] });
    play(G, VIOLENT_CONDITIONING, []);
    const full = buildUIState(G, { phase: 'play', turn: 1, currentPlayer: '0' });
    for (const audience of [{ kind: 'player' as const, playerId: '0' }, { kind: 'spectator' as const }]) {
      const filtered = filterUIStateForAudience(full, audience);
      const trace = (filtered.effectTraces ?? []).find((record) => record.cardId === VIOLENT_CONDITIONING && record.effect === 'gain-wound-reward');
      assert.ok(trace !== undefined, 'a gain-wound-reward trace is projected');
      assert.equal(trace.params.rewardComposition, 'berserk');
    }
  });
});

describe('gain-wound-reward KO up to two other cards — Hulk Gets Smashed (WP-885)', () => {
  it('N1 the prompt names the reward after another Strength Hero; none without one', () => {
    const G = makeState({ '0': [] });
    play(G, HULK_GETS_SMASHED, [STRENGTH_HERO_ID]);
    assert.deepEqual(G.pendingSeatChoice!.seatPrompts['0']!.options, [
      { label: 'Gain a Wound: KO up to 2 other cards from your hand or discard pile' },
      { label: "Don't gain a Wound" },
    ]);
    assertLogged(G, `Player 0 may gain a Wound to KO up to 2 other cards from their hand or discard pile (${HGS_REF}).`, 'neutral');

    const ungated = makeState({ '0': [] });
    play(ungated, HULK_GETS_SMASHED, []);
    assert.equal(ungated.pendingSeatChoice, undefined);
  });

  it('pre-gain discard [Agent, Trooper]: two spare-the-Wound entries; the gained Wound is never eligible', () => {
    const G = makeState({ '0': [] });
    G.playerZones['0']!.discard = [AGENT, TROOPER];
    playAndAnswer(G, HULK_GETS_SMASHED, [STRENGTH_HERO_ID], 0);
    assert.deepEqual(G.playerZones['0']!.discard, [AGENT, TROOPER, WOUND_EXT_ID]);
    assertLogged(G, `Player 0 gained a Wound (${HGS_REF}).`, 'applied');
    const entries = G.pendingOptionalKoRewards!;
    assert.equal(entries.length, 2);
    for (const entry of entries) {
      assert.deepEqual(entry, {
        playerID: '0', rewardType: 'none', rewardMagnitude: 0, sourceCardId: HULK_GETS_SMASHED,
        koZones: ['hand', 'discard'], koSparesGainedWound: true,
      });
    }
    assert.notStrictEqual(entries[0]!.koZones, entries[1]!.koZones, 'each entry has its own koZones array');
    assert.deepEqual(projectedKoTargets(G).discard, [AGENT, TROOPER], 'the projection omits the gained Wound');
    resolveKo(G, { zone: 'discard', cardId: WOUND_EXT_ID });
    assert.equal(G.pendingOptionalKoRewards!.length, 2, 'the resolve rejects the gained Wound (queue intact)');
    assert.deepEqual(G.playerZones['0']!.discard, [AGENT, TROOPER, WOUND_EXT_ID]);
    assert.notEqual(botKoTarget(G).cardId, WOUND_EXT_ID, 'the bot never targets the gained Wound');
  });

  it('one prior Wound in hand: a Wound is eligible until one is KO\'d, then the last is spared', () => {
    const G = makeState({ '0': [WOUND_EXT_ID] });
    G.playerZones['0']!.discard = [AGENT];
    playAndAnswer(G, HULK_GETS_SMASHED, [STRENGTH_HERO_ID], 0);
    assert.equal(G.pendingOptionalKoRewards!.length, 2, 'Agent + one of the two Wounds');
    assert.deepEqual(projectedKoTargets(G), { hand: [WOUND_EXT_ID], discard: [AGENT, WOUND_EXT_ID] });
    resolveKo(G, { zone: 'hand', cardId: WOUND_EXT_ID });
    assert.equal(G.pendingOptionalKoRewards!.length, 1);
    assert.deepEqual(projectedKoTargets(G), { hand: [], discard: [AGENT] }, 'the last Wound is now spared');
    resolveKo(G, { zone: 'discard', cardId: WOUND_EXT_ID });
    assert.equal(G.pendingOptionalKoRewards!.length, 1, 'the resolve rejects the last Wound');
    assert.equal(botKoTarget(G).cardId, AGENT);
  });

  it('N10 no other card: no entry is parked', () => {
    const G = makeState({ '0': [] });
    playAndAnswer(G, HULK_GETS_SMASHED, [STRENGTH_HERO_ID], 0);
    assert.deepEqual(G.playerZones['0']!.discard, [WOUND_EXT_ID]);
    assert.equal(G.pendingOptionalKoRewards, undefined);
    assertLogged(G, `Player 0 had no other card in their hand or discard pile to KO (${HGS_REF}).`, 'blocked');
  });

  it('one eligible card: one entry; the bot takes the hand card over the spared discard Wound', () => {
    const G = makeState({ '0': [AGENT] });
    playAndAnswer(G, HULK_GETS_SMASHED, [STRENGTH_HERO_ID], 0);
    assert.equal(G.pendingOptionalKoRewards!.length, 1);
    assert.deepEqual(botKoTarget(G), { zone: 'hand', cardId: AGENT });
  });

  it('N6 the supply empties after the park: no Wound, no KO', () => {
    const G = makeState({ '0': [AGENT] });
    play(G, HULK_GETS_SMASHED, [STRENGTH_HERO_ID]);
    G.piles.wounds = [];
    resolveSeatChoice(makeContext(G, '0'), { optionIndex: 0 });
    assert.equal(G.pendingOptionalKoRewards, undefined);
    assertLogged(G, `Player 0 could not gain a Wound — the Wound supply is empty, so they do not KO up to 2 other cards from their hand or discard pile (${HGS_REF}).`, 'blocked');
  });

  for (const [label, hand, discard] of [
    ['{gained Wound, older Wound, Agent}', [WOUND_EXT_ID], [AGENT]],
    ['{gained Wound, Agent}', [], [AGENT]],
  ] as const) {
    it(`drain loop ${label}: the bot's move always shrinks the queue, and a Wound remains`, () => {
      const G = makeState({ '0': [...hand] });
      G.playerZones['0']!.discard = [...discard];
      playAndAnswer(G, HULK_GETS_SMASHED, [STRENGTH_HERO_ID], 0);
      let iterations = 0;
      while ((G.pendingOptionalKoRewards?.length ?? 0) > 0) {
        const before = G.pendingOptionalKoRewards!.length;
        resolveKo(G, botKoTarget(G));
        assert.ok((G.pendingOptionalKoRewards?.length ?? 0) < before, 'the queue shrinks every iteration (no sim hang)');
        iterations += 1;
        assert.ok(iterations <= 2, 'at most two KOs');
      }
      assert.ok(woundsInHandAndDiscard(G) >= 1, 'at least one Wound (the gained one) remains');
    });
  }
});

describe('gain-wound-reward Transform — Mood Swings (WP-885)', () => {
  const moodSwingsRef = formatCardRef({ [MOOD_SWINGS]: { name: 'Mood Swings', imageUrl: '', cost: 3 } }, MOOD_SWINGS);

  it('N1 / N4 gain after another Instinct Hero: Raging Savage in play, Mood Swings set aside, +3 Attack, the Transform event', () => {
    const G = makeState({ '0': [] });
    play(G, MOOD_SWINGS, [INSTINCT_HERO_ID]);
    assert.deepEqual(G.pendingSeatChoice!.seatPrompts['0']!.options[0], { label: 'Gain a Wound: Transform into Raging Savage' });
    assertLogged(G, `Player 0 may gain a Wound to Transform into Raging Savage (${moodSwingsRef}).`, 'neutral');
    resolveSeatChoice(makeContext(G, '0'), { optionIndex: 0 });
    assert.deepEqual(G.playerZones['0']!.inPlay, [INSTINCT_HERO_ID, RAGING_SAVAGE]);
    assert.deepEqual(G.transformDeck, [MOOD_SWINGS]);
    assert.deepEqual(G.playerZones['0']!.discard, [WOUND_EXT_ID]);
    assert.equal(G.turnEconomy.attack, 3);
    assert.ok(G.notableEvents.some((event) => event.type === 'transformResolved'), 'the Transformed! event fires');
    assertLogged(G, `Player 0 gained a Wound (${moodSwingsRef}).`, 'applied');
  });

  it('decline: no Wound, no Transform', () => {
    const G = makeState({ '0': [] });
    playAndAnswer(G, MOOD_SWINGS, [INSTINCT_HERO_ID], 1);
    assert.deepEqual(G.playerZones['0']!.inPlay, [INSTINCT_HERO_ID, MOOD_SWINGS]);
    assert.deepEqual(G.transformDeck, [RAGING_SAVAGE]);
    assert.equal(G.turnEconomy.attack, 0);
  });

  it('no Raging Savage left: the label says "its second form"; gain keeps the Wound and logs the existing refusal', () => {
    const G = makeState({ '0': [] });
    G.transformDeck = [];
    play(G, MOOD_SWINGS, [INSTINCT_HERO_ID]);
    assert.deepEqual(G.pendingSeatChoice!.seatPrompts['0']!.options[0], { label: 'Gain a Wound: Transform into its second form' });
    resolveSeatChoice(makeContext(G, '0'), { optionIndex: 0 });
    assert.deepEqual(G.playerZones['0']!.discard, [WOUND_EXT_ID]);
    assert.deepEqual(G.playerZones['0']!.inPlay, [INSTINCT_HERO_ID, MOOD_SWINGS]);
    assertLogged(G, `Player 0 could not Transform ${moodSwingsRef} — no matching second-form copy remained in the transform side deck.`, 'blocked');
  });

  it('without another Instinct Hero: no prompt', () => {
    const G = makeState({ '0': [] });
    play(G, MOOD_SWINGS, []);
    assert.equal(G.pendingSeatChoice, undefined);
  });
});
