/**
 * "You may gain a Wound. If you do, you get +N Attack" — the gain-wound-reward keyword
 * (WP-883 / EC-921 / D-24834).
 *
 * The Hulk Smash! (co2e) and Scalded by Sunlight (mdns) hooks are built by buildHeroAbilityHooks
 * from the committed data/cards/*.json (the marker pass output), and Flying Shield Block from
 * data/cards/ca75.json, so these tests pin the parse, the prompt and the keep-or-forfeit rule
 * together. Diving Block uses a synthetic hook, as in divingBlock.logic.test.ts and
 * flyingShieldBlock.logic.test.ts.
 *
 * node:test + node:assert only — no boardgame.io/testing import.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHeroAbilityHooks } from '../setup/heroAbility.setup.js';
import { executeHeroEffects, HERO_EFFECT_HANDLERS } from './heroEffects.execute.js';
import { GAIN_WOUND_REWARD_SEAT_CHOICE_KIND } from './gainWoundReward.logic.js';
import { gainWoundWithOutcome } from '../board/wounds.logic.js';
import { applySeatChoiceTimeoutDefault, resolveSeatChoice } from '../moves/seatChoice.resolve.js';
import { WOUND_EXT_ID } from '../setup/pilesInit.js';
import { LegendaryGame } from '../game.js';
import { formatCardRef } from '../log/logDisplay.js';
import type { LegendaryGameState, MatchConfiguration } from '../types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import type { CardExtId } from '../state/zones.types.js';

// why: resolve the repo-root data directory from this test's own location (the
// doubledSuperpowerIcon.test.ts precedent), so the tests read the card data that ships.
const CARDS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'data', 'cards');

const DIVING_BLOCK_ID = 'core/captain-america/diving-block#0';
const STRENGTH_HERO_ID = 'test/avenger/punch#0';
const BYSTANDER = 'pile-bystander';
const EVEN_HQ_HERO = 'test/hq/even#0';
const ODD_HQ_HERO = 'test/hq/odd#0';

/** Identity Shuffle so any draw is deterministic in tests. */
const IDENTITY_RANDOM = { Shuffle: <T,>(deck: T[]): T[] => [...deck] };

/**
 * Builds the real hooks for the given hero decks from the committed card data.
 *
 * @param heroDeckIds - `{setAbbr}/{heroSlug}` ids.
 * @returns Every hook those hero decks produce.
 */
function buildRealHooks(heroDeckIds: string[]): HeroAbilityHook[] {
  const sets: Record<string, unknown> = {};
  for (const heroDeckId of heroDeckIds) {
    const setAbbr = heroDeckId.split('/')[0]!;
    sets[setAbbr] = JSON.parse(readFileSync(join(CARDS_DIRECTORY, `${setAbbr}.json`), 'utf8'));
  }
  const registry = { listCards: () => [], getSet: (abbr: string) => sets[abbr] };
  return buildHeroAbilityHooks(registry, { heroDeckIds } as unknown as MatchConfiguration);
}

const REAL_HOOKS = buildRealHooks(['co2e/hulk', 'mdns/morbius', 'ca75/captain-america-falcon']);

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

const HULK_SMASH = copiesOf('hulk-smash')[0]!;
const SCALDED_BY_SUNLIGHT = copiesOf('scalded-by-sunlight')[0]!;
const [FSB_A, FSB_B] = copiesOf('flying-shield-block');

/**
 * Minimal G for playing the two cards, the wound chokepoint and both interceptions.
 *
 * @param hands - Each seat's hand.
 * @param woundCount - Wounds in the supply.
 * @param dayNight - Which day/night the HQ shows.
 * @returns A LegendaryGameState sufficient for these tests.
 */
function makeState(
  hands: Record<string, string[]>,
  woundCount = 3,
  dayNight: 'sunlight' | 'moonlight' = 'sunlight',
): LegendaryGameState {
  const playerZones: Record<string, unknown> = {};
  for (const seat of Object.keys(hands)) {
    playerZones[seat] = { deck: [`${seat}-deckcard#0`], hand: [...hands[seat]!], discard: [], victory: [], inPlay: [] };
  }
  const wounds: string[] = [];
  for (let i = 0; i < woundCount; i++) {
    wounds.push(WOUND_EXT_ID);
  }
  let hqHero = EVEN_HQ_HERO;
  if (dayNight === 'moonlight') {
    hqHero = ODD_HQ_HERO;
  }
  return {
    playerZones,
    piles: { bystanders: [BYSTANDER, BYSTANDER, BYSTANDER], wounds, officers: [], sidekicks: [] },
    heroAbilityHooks: [...REAL_HOOKS, { cardId: DIVING_BLOCK_ID, timing: 'onPlay', keywords: ['diving-block'] }],
    villainAbilityHooks: [],
    hookRegistry: [],
    turnEconomy: { attack: 0, recruit: 0, spentAttack: 0, spentRecruit: 0, piercing: 0, woundsDrawn: 0, cardsDrawn: 0 },
    messages: [],
    notableEvents: [],
    cardDisplayData: {},
    cardKeywords: {},
    cardStats: {
      [EVEN_HQ_HERO]: { attack: 0, recruit: 0, cost: 4, fightCost: 0 },
      [ODD_HQ_HERO]: { attack: 0, recruit: 0, cost: 3, fightCost: 0 },
    },
    cardTraits: { [STRENGTH_HERO_ID]: { team: 'avengers', heroClass: 'strength' } },
    counters: {},
    city: [null, null, null, null, null],
    hq: [hqHero, null, null, null, null],
    ko: [],
    attachedBystanders: {},
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
 * Opens the interception waves through the LIVE play-phase turn.onMove (the game.test.ts
 * pattern), so the game.ts wiring is under test.
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
function play(G: LegendaryGameState, cardId: CardExtId, playedBefore: string[] = [STRENGTH_HERO_ID]): void {
  G.playerZones['0']!.inPlay = [...(playedBefore as CardExtId[]), cardId];
  executeHeroEffects(G, { ctx: { turn: 1, currentPlayer: '0' }, random: IDENTITY_RANDOM }, '0', cardId);
}

/**
 * Plays Hulk Smash! after a Strength Hero and answers its prompt.
 *
 * @param G - The game state, mutated in place.
 * @param optionIndex - 0 gain, 1 decline.
 */
function playHulkSmashAndAnswer(G: LegendaryGameState, optionIndex: number): void {
  play(G, HULK_SMASH);
  assert.equal(G.pendingSeatChoice?.kind, GAIN_WOUND_REWARD_SEAT_CHOICE_KIND);
  resolveSeatChoice(makeContext(G, '0'), { optionIndex });
}

/**
 * The game log's entries.
 *
 * @param G - The game state.
 * @returns Each entry's text and outcome, in order.
 */
function logEntries(G: LegendaryGameState): { text: string; outcome: string }[] {
  const entries: { text: string; outcome: string }[] = [];
  for (const entry of G.messages) {
    entries.push({ text: entry.text, outcome: entry.outcome });
  }
  return entries;
}

/**
 * Asserts the log holds the exact line with the exact outcome.
 *
 * @param G - The game state.
 * @param text - The expected line.
 * @param outcome - The expected outcome.
 */
function assertLogged(G: LegendaryGameState, text: string, outcome: string): void {
  assert.ok(
    logEntries(G).some((entry) => entry.text === text && entry.outcome === outcome),
    `expected log line [${outcome}] "${text}"; got ${JSON.stringify(logEntries(G))}`,
  );
}

const HULK_REF = formatCardRef({}, HULK_SMASH);

describe('gain-wound-reward — the prompt (WP-883)', () => {
  it('G1 Hulk Smash! after a Strength Hero parks the gain / don\'t prompt (L1); without one it parks nothing', () => {
    const G = makeState({ '0': [] });
    play(G, HULK_SMASH);
    const choice = G.pendingSeatChoice!;
    assert.equal(choice.kind, 'gain-wound-reward');
    assert.deepEqual(choice.addressedSeats, ['0']);
    assert.deepEqual(choice.seatPrompts['0']!.options, [{ label: 'Gain a Wound: you get +5 Attack' }, { label: "Don't gain a Wound" }]);
    assert.equal(choice.defaultOptionIndex, 1);
    assert.deepEqual(choice.gainWoundReward, { rewardType: 'attack', magnitude: 5, sourceCardId: HULK_SMASH });
    assert.equal(G.turnEconomy.attack, 0, 'no Attack at play: the +5 is no longer free');
    assertLogged(G, `Player 0 may gain a Wound for +5 Attack (${HULK_REF}).`, 'neutral');

    const withoutStrength = makeState({ '0': [] });
    play(withoutStrength, HULK_SMASH, []);
    assert.equal(withoutStrength.pendingSeatChoice, undefined);
    assert.equal(withoutStrength.turnEconomy.attack, 0);
  });

  it('G2 gain: one Wound to the discard pile, supply -1, +5 Attack, woundsDrawn +1, L4', () => {
    const G = makeState({ '0': [] });
    playHulkSmashAndAnswer(G, 0);
    assert.deepEqual(G.playerZones['0']!.discard, [WOUND_EXT_ID]);
    assert.equal(G.piles.wounds.length, 2);
    assert.equal(G.turnEconomy.attack, 5);
    assert.equal(G.turnEconomy.woundsDrawn, 1);
    assert.equal(G.pendingSeatChoice, undefined);
    assertLogged(G, `Player 0 gained a Wound and got +5 Attack (${HULK_REF}).`, 'applied');
  });

  it('G3 decline: nothing changes but L3', () => {
    const G = makeState({ '0': [] });
    playHulkSmashAndAnswer(G, 1);
    assert.deepEqual(G.playerZones['0']!.discard, []);
    assert.equal(G.piles.wounds.length, 3);
    assert.equal(G.turnEconomy.attack, 0);
    assert.equal(G.turnEconomy.woundsDrawn, 0);
    assertLogged(G, `Player 0 chose not to gain a Wound (${HULK_REF}).`, 'neutral');
  });

  it('G4 empty supply: no prompt, L2', () => {
    const G = makeState({ '0': [] }, 0);
    play(G, HULK_SMASH);
    assert.equal(G.pendingSeatChoice, undefined);
    assert.equal(G.turnEconomy.attack, 0);
    assertLogged(G, `Player 0's ${HULK_REF} did nothing — the Wound supply is empty.`, 'blocked');
  });

  it('G5 supply emptied after the park: L6, no Attack', () => {
    const G = makeState({ '0': [] });
    play(G, HULK_SMASH);
    G.piles.wounds = [];
    resolveSeatChoice(makeContext(G, '0'), { optionIndex: 0 });
    assert.deepEqual(G.playerZones['0']!.discard, []);
    assert.equal(G.turnEconomy.attack, 0);
    assert.equal(G.turnEconomy.woundsDrawn, 0);
    assertLogged(G, `Player 0 could not gain a Wound — the Wound supply is empty, so no Attack (${HULK_REF}).`, 'blocked');
  });

  it('G6 a pre-opened seat choice: L9, the open choice untouched', () => {
    const G = makeState({ '0': [] });
    const openChoice = {
      kind: 'generic',
      addressedSeats: ['1'],
      seatPrompts: { '1': { options: [{ label: 'A' }, { label: 'B' }] } },
      submissions: {},
      defaultOptionIndex: 0,
    };
    G.pendingSeatChoice = structuredClone(openChoice);
    play(G, HULK_SMASH);
    assert.deepEqual(G.pendingSeatChoice, openChoice);
    assertLogged(G, `Player 0's ${HULK_REF} could not offer its Wound choice — another choice is open.`, 'blocked');
  });

  it('G7 an unseeded reward descriptor: L0, no prompt', () => {
    const G = makeState({ '0': [] });
    HERO_EFFECT_HANDLERS['gain-wound-reward']!(G, {}, '0', HULK_SMASH, { type: 'gain-wound-reward', magnitude: 1, rewardType: 'draw' });
    assert.equal(G.pendingSeatChoice, undefined);
    assertLogged(G, 'Player 0 played a hero ability whose gain-a-Wound reward is not yet supported, so it was skipped.', 'blocked');
  });
});

describe('gain-wound-reward — Scalded by Sunlight (WP-883)', () => {
  const scaldedRef = formatCardRef({}, SCALDED_BY_SUNLIGHT);

  it('G8 Sunlight: the prompt offers +2; gain grants +2', () => {
    const G = makeState({ '0': [] }, 3, 'sunlight');
    play(G, SCALDED_BY_SUNLIGHT, []);
    assert.equal(G.pendingSeatChoice!.kind, 'gain-wound-reward');
    assert.equal(G.pendingSeatChoice!.seatPrompts['0']!.options[0]!.label, 'Gain a Wound: you get +2 Attack');
    resolveSeatChoice(makeContext(G, '0'), { optionIndex: 0 });
    assert.equal(G.turnEconomy.attack, 2);
    assertLogged(G, `Player 0 gained a Wound and got +2 Attack (${scaldedRef}).`, 'applied');
    const sunlightHook = REAL_HOOKS.find((hook) => hook.cardId === SCALDED_BY_SUNLIGHT && (hook.effects ?? []).some((effect) => effect.type === 'gain-wound-reward'));
    assert.ok(sunlightHook !== undefined, 'the Sunlight line builds a gain-wound-reward hook');
    assert.equal(sunlightHook.unresolvedMarkers, undefined, 'no sunlight hollow marker');
  });

  it('G9 Moonlight: the Sunlight line prompts nothing; the Moonlight line still runs ko-wound-reward', () => {
    const G = makeState({ '0': [] }, 3, 'moonlight');
    G.playerZones['0']!.discard = [WOUND_EXT_ID];
    play(G, SCALDED_BY_SUNLIGHT, []);
    assert.equal(G.pendingSeatChoice, undefined);
    assert.deepEqual(G.playerZones['0']!.discard, [], 'the Moonlight line KO\'d the Wound');
    assert.equal(G.turnEconomy.attack, 2, 'the Moonlight ko-wound-reward granted +2');
  });
});

describe('gain-wound-reward — Diving Block keeps or forfeits the reward (WP-883)', () => {
  it('G10 Diving Block in hand: gain parks a tagged entry and no Attack yet (L5)', () => {
    const G = makeState({ '0': [DIVING_BLOCK_ID] });
    playHulkSmashAndAnswer(G, 0);
    assert.deepEqual(G.pendingDivingBlockWounds, [
      { playerID: '0', woundCardId: WOUND_EXT_ID, gainWoundReward: { rewardType: 'attack', magnitude: 5, sourceCardId: HULK_SMASH } },
    ]);
    assert.equal(G.turnEconomy.attack, 0);
    assert.equal(G.turnEconomy.woundsDrawn, 1);
    assertLogged(G, `Player 0 would gain a Wound — +5 Attack if they keep it (${HULK_REF}).`, 'neutral');
  });

  it('G11 reveal: the Wound goes back, a card is drawn, no Attack, L8', () => {
    const G = makeState({ '0': [DIVING_BLOCK_ID] });
    playHulkSmashAndAnswer(G, 0);
    openWaves(G);
    assert.equal(G.pendingSeatChoice!.kind, 'diving-block');
    resolveSeatChoice(makeContext(G, '0'), { optionIndex: 0 });
    assert.deepEqual(G.playerZones['0']!.discard, []);
    assert.equal(G.piles.wounds.length, 3);
    assert.ok(G.playerZones['0']!.hand.includes('0-deckcard#0' as CardExtId), 'a card was drawn instead');
    assert.equal(G.turnEconomy.attack, 0);
    assertLogged(G, `Player 0's Wound was prevented, so no +5 Attack (${HULK_REF}).`, 'blocked');
  });

  it('G12 decline: the Wound is kept and +5 is granted (L7)', () => {
    const G = makeState({ '0': [DIVING_BLOCK_ID] });
    playHulkSmashAndAnswer(G, 0);
    openWaves(G);
    resolveSeatChoice(makeContext(G, '0'), { optionIndex: 1 });
    assert.deepEqual(G.playerZones['0']!.discard, [WOUND_EXT_ID]);
    assert.equal(G.turnEconomy.attack, 5);
    assertLogged(G, `Player 0 kept the Wound and got +5 Attack (${HULK_REF}).`, 'applied');
  });

  it('G13 a declined Diving Block that parks Flying Shield Block carries the reward over', () => {
    const G = makeState({ '0': [DIVING_BLOCK_ID], '1': [FSB_A!] });
    playHulkSmashAndAnswer(G, 0);
    openWaves(G);
    resolveSeatChoice(makeContext(G, '0'), { optionIndex: 1 });
    assert.equal(G.turnEconomy.attack, 0, 'no +5 while Flying Shield Block may still prevent the Wound');
    assert.deepEqual(G.pendingFlyingShieldBlockWounds![0]!.gainWoundReward, { rewardType: 'attack', magnitude: 5, sourceCardId: HULK_SMASH });
    openWaves(G);
    assert.equal(G.pendingSeatChoice!.seatPrompts['1']!.options[1]!.label, 'Let Player 0 take the Wound (they keep +5 Attack)');
    resolveSeatChoice(makeContext(G, '1'), { optionIndex: 1 });
    assert.equal(G.turnEconomy.attack, 5);
    assertLogged(G, `Player 0 kept the Wound and got +5 Attack (${HULK_REF}).`, 'applied');
  });

  it('G14 a Wound from any other source is untagged and labelled as before', () => {
    const G = makeState({ '0': [DIVING_BLOCK_ID] });
    assert.equal(gainWoundWithOutcome(G, '0'), 'diving-block-pending');
    assert.deepEqual(G.pendingDivingBlockWounds, [{ playerID: '0', woundCardId: WOUND_EXT_ID }]);
    openWaves(G);
    assert.deepEqual(G.pendingSeatChoice!.seatPrompts['0']!.options, [
      { label: 'Reveal Diving Block: prevent the Wound and draw a card' },
      { label: 'Take the Wound' },
    ]);
    resolveSeatChoice(makeContext(G, '0'), { optionIndex: 1 });
    assert.equal(G.turnEconomy.attack, 0);
  });

  it('G15 the tagged Diving Block wave labels the decline "Take the Wound (keep +5 Attack)"', () => {
    const G = makeState({ '0': [DIVING_BLOCK_ID] });
    playHulkSmashAndAnswer(G, 0);
    openWaves(G);
    assert.deepEqual(G.pendingSeatChoice!.seatPrompts['0']!.options, [
      { label: 'Reveal Diving Block: prevent the Wound and draw a card' },
      { label: 'Take the Wound (keep +5 Attack)' },
    ]);
  });
});

describe('gain-wound-reward — Flying Shield Block keeps or forfeits the reward (WP-883)', () => {
  it('G16 another seat\'s Flying Shield Block: a tagged entry; reveal → no Attack (L8)', () => {
    const G = makeState({ '0': [], '1': [FSB_A!] });
    playHulkSmashAndAnswer(G, 0);
    assert.equal(G.pendingFlyingShieldBlockWounds!.length, 1);
    assert.equal(G.pendingFlyingShieldBlockWounds![0]!.gainWoundReward!.magnitude, 5);
    assert.equal(G.turnEconomy.attack, 0);
    assertLogged(G, `Player 0 would gain a Wound — +5 Attack if they keep it (${HULK_REF}).`, 'neutral');
    openWaves(G);
    resolveSeatChoice(makeContext(G, '1'), { optionIndex: 0 });
    assert.deepEqual(G.playerZones['0']!.discard, []);
    assert.deepEqual(G.playerZones['1']!.victory, [BYSTANDER]);
    assert.equal(G.turnEconomy.attack, 0);
    assertLogged(G, `Player 0's Wound was prevented, so no +5 Attack (${HULK_REF}).`, 'blocked');
  });

  it('G17 another seat declines: +5 (L7)', () => {
    const G = makeState({ '0': [], '1': [FSB_A!] });
    playHulkSmashAndAnswer(G, 0);
    openWaves(G);
    resolveSeatChoice(makeContext(G, '1'), { optionIndex: 1 });
    assert.deepEqual(G.playerZones['0']!.discard, [WOUND_EXT_ID]);
    assert.equal(G.turnEconomy.attack, 5);
    assertLogged(G, `Player 0 kept the Wound and got +5 Attack (${HULK_REF}).`, 'applied');
  });

  it('G18 two holders: the first declines (tag stays, no +5); the second reveals (L8) or declines (L7)', () => {
    for (const secondAnswer of [0, 1]) {
      const G = makeState({ '0': [], '1': [FSB_A!], '2': [FSB_B!] });
      playHulkSmashAndAnswer(G, 0);
      openWaves(G);
      assert.deepEqual(G.pendingSeatChoice!.addressedSeats, ['1']);
      resolveSeatChoice(makeContext(G, '1'), { optionIndex: 1 });
      assert.equal(G.turnEconomy.attack, 0, 'a decline that leaves a candidate grants nothing yet');
      assert.equal(G.pendingFlyingShieldBlockWounds![0]!.gainWoundReward!.magnitude, 5, 'the tag stays on the entry');
      openWaves(G);
      assert.deepEqual(G.pendingSeatChoice!.addressedSeats, ['2']);
      resolveSeatChoice(makeContext(G, '2'), { optionIndex: secondAnswer });
      if (secondAnswer === 0) {
        assert.equal(G.turnEconomy.attack, 0);
        assertLogged(G, `Player 0's Wound was prevented, so no +5 Attack (${HULK_REF}).`, 'blocked');
      } else {
        assert.equal(G.turnEconomy.attack, 5);
        assertLogged(G, `Player 0 kept the Wound and got +5 Attack (${HULK_REF}).`, 'applied');
      }
      assert.equal(G.pendingFlyingShieldBlockWounds, undefined);
    }
  });

  it('G19 the only copy spent on an earlier Wound in the same wave: the tagged entry drops and +5 is granted (L7)', () => {
    const G = makeState({ '0': [], '1': [FSB_A!] });
    gainWoundWithOutcome(G, '0');
    playHulkSmashAndAnswer(G, 0);
    assert.equal(G.pendingFlyingShieldBlockWounds!.length, 2);
    assert.equal(G.pendingFlyingShieldBlockWounds![0]!.gainWoundReward, undefined, 'the earlier Wound is untagged');
    openWaves(G);
    resolveSeatChoice(makeContext(G, '1'), { optionIndex: 0 });
    assert.equal(G.turnEconomy.attack, 0);
    openWaves(G);
    assert.equal(G.pendingFlyingShieldBlockWounds, undefined);
    assert.equal(G.turnEconomy.attack, 5);
    assertLogged(G, `Player 0 kept the Wound and got +5 Attack (${HULK_REF}).`, 'applied');
  });

  it('G20 a copy already revealed this turn: nothing parks and +5 is granted now (L4)', () => {
    const G = makeState({ '0': [], '1': [FSB_A!] });
    G.flyingShieldBlockUsedThisTurn = [FSB_A!];
    playHulkSmashAndAnswer(G, 0);
    assert.equal(G.pendingFlyingShieldBlockWounds, undefined);
    assert.equal(G.turnEconomy.attack, 5);
    assertLogged(G, `Player 0 gained a Wound and got +5 Attack (${HULK_REF}).`, 'applied');
  });

  it('G21 labels: the recipient\'s own prompt reads "Take the Wound (keep +5 Attack)"; untagged labels are unchanged', () => {
    const G = makeState({ '0': [FSB_A!] });
    playHulkSmashAndAnswer(G, 0);
    openWaves(G);
    assert.deepEqual(G.pendingSeatChoice!.seatPrompts['0']!.options, [
      { label: 'Reveal Flying Shield Block: prevent your Wound and rescue a Bystander' },
      { label: 'Take the Wound (keep +5 Attack)' },
    ]);

    const untagged = makeState({ '0': [FSB_A!], '1': [] });
    gainWoundWithOutcome(untagged, '0');
    openWaves(untagged);
    assert.equal(untagged.pendingSeatChoice!.seatPrompts['0']!.options[1]!.label, 'Take the Wound');

    const untaggedOther = makeState({ '0': [], '1': [FSB_A!] });
    gainWoundWithOutcome(untaggedOther, '0');
    openWaves(untaggedOther);
    assert.equal(untaggedOther.pendingSeatChoice!.seatPrompts['1']!.options[1]!.label, 'Let Player 0 take the Wound');
  });
});

describe('gain-wound-reward — the disconnect / timeout default (WP-883)', () => {
  it('G22 a defaulted gain-wound-reward choice declines: no Wound, L3', () => {
    const G = makeState({ '0': [] });
    play(G, HULK_SMASH);
    applySeatChoiceTimeoutDefault(G, ['0']);
    assert.equal(G.pendingSeatChoice, undefined);
    assert.deepEqual(G.playerZones['0']!.discard, []);
    assert.equal(G.turnEconomy.attack, 0);
    assertLogged(G, `Player 0 chose not to gain a Wound (${HULK_REF}).`, 'neutral');
  });

  it('G23 a defaulted tagged Diving Block or Flying Shield Block entry keeps the Wound: +5 (L7)', () => {
    const divingBlock = makeState({ '0': [DIVING_BLOCK_ID] });
    playHulkSmashAndAnswer(divingBlock, 0);
    openWaves(divingBlock);
    applySeatChoiceTimeoutDefault(divingBlock, ['0']);
    assert.deepEqual(divingBlock.playerZones['0']!.discard, [WOUND_EXT_ID]);
    assert.equal(divingBlock.turnEconomy.attack, 5);
    assertLogged(divingBlock, `Player 0 kept the Wound and got +5 Attack (${HULK_REF}).`, 'applied');

    const flyingShieldBlock = makeState({ '0': [], '1': [FSB_A!] });
    playHulkSmashAndAnswer(flyingShieldBlock, 0);
    openWaves(flyingShieldBlock);
    applySeatChoiceTimeoutDefault(flyingShieldBlock, ['1']);
    assert.deepEqual(flyingShieldBlock.playerZones['0']!.discard, [WOUND_EXT_ID]);
    assert.equal(flyingShieldBlock.turnEconomy.attack, 5);
    assertLogged(flyingShieldBlock, `Player 0 kept the Wound and got +5 Attack (${HULK_REF}).`, 'applied');
  });
});
