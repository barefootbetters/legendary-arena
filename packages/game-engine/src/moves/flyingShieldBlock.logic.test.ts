/**
 * Tests for Captain America (Falcon)'s Flying Shield Block — reactive wound interception for
 * any seat holding a copy (WP-827 / EC-865 / D-24760).
 *
 * "Once per turn, if a player would gain a Wound, you may reveal this card and rescue a
 * Bystander instead." The Flying Shield Block hook is built from the committed
 * data/cards/ca75.json (the marker pass output), so these tests pin the parse and the
 * reaction together. Diving Block uses a synthetic hook, as in divingBlock.logic.test.ts.
 *
 * node:test + node:assert only — no boardgame.io/testing import.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHeroAbilityHooks } from '../setup/heroAbility.setup.js';
import {
  findRevealableFlyingShieldBlockCopy,
  FLYING_SHIELD_BLOCK_SEAT_CHOICE_KIND,
} from './flyingShieldBlock.logic.js';
import { gainWoundForPlayer } from '../board/wounds.logic.js';
import { resolveSeatChoice } from './seatChoice.resolve.js';
import { choosePlayingSeatChoiceOption } from '../simulation/ai.seatChoice.js';
import { applyOnBeginParity } from '../simulation/onBeginParity.js';
import { WOUND_EXT_ID } from '../setup/pilesInit.js';
import { LegendaryGame } from '../game.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { createMockMatchConfiguration } from '../test/fixtureBuilders.js';
import type { LegendaryGameState, MatchConfiguration } from '../types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import type { CardExtId } from '../state/zones.types.js';

// why: resolve the repo-root data directory from this test's own location (the
// doubledSuperpowerIcon.test.ts precedent), so the tests read the card data that ships.
const CARDS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'data', 'cards');

const DIVING_BLOCK_ID = 'core/captain-america/diving-block#0';
const OTHER_CARD_ID = 'core/spider-man/web-shooters#0';
const BYSTANDER = 'pile-bystander';

/** Identity Shuffle so any draw is deterministic in tests. */
const IDENTITY_RANDOM = { Shuffle: <T,>(deck: T[]): T[] => [...deck] };

/**
 * Builds the real Falcon hooks from the committed card data.
 *
 * @returns Every hook the Captain America (Falcon) hero deck produces.
 */
function buildFalconHooks(): HeroAbilityHook[] {
  const setData = JSON.parse(readFileSync(join(CARDS_DIRECTORY, 'ca75.json'), 'utf8'));
  const registry = { listCards: () => [], getSet: (abbr: string) => (abbr === 'ca75' ? setData : undefined) };
  return buildHeroAbilityHooks(registry, { heroDeckIds: ['ca75/captain-america-falcon'] } as unknown as MatchConfiguration);
}

const FALCON_HOOKS = buildFalconHooks();

/**
 * The card ids of every Flying Shield Block copy in the deck, in deck order.
 *
 * @returns The copy ids (at least two in the real data).
 */
function flyingShieldBlockCopies(): CardExtId[] {
  const copies: CardExtId[] = [];
  for (const hook of FALCON_HOOKS) {
    if (hook.cardId.includes('/flying-shield-block#') && !copies.includes(hook.cardId)) {
      copies.push(hook.cardId);
    }
  }
  return copies;
}

const [FSB_A, FSB_B] = flyingShieldBlockCopies();

/**
 * Minimal G for the wound chokepoint and both interceptions.
 *
 * @param hands - Each seat's hand.
 * @param woundCount - Wounds in the supply.
 * @param bystanderCount - Bystanders in the supply.
 * @returns A LegendaryGameState sufficient for these tests.
 */
function makeState(hands: Record<string, string[]>, woundCount = 3, bystanderCount = 3): LegendaryGameState {
  const playerZones: Record<string, unknown> = {};
  for (const seat of Object.keys(hands)) {
    playerZones[seat] = { deck: [`${seat}-deckcard#0`], hand: [...hands[seat]!], discard: [], victory: [], inPlay: [] };
  }
  const wounds: string[] = [];
  for (let i = 0; i < woundCount; i++) {
    wounds.push(WOUND_EXT_ID);
  }
  const bystanders: string[] = [];
  for (let i = 0; i < bystanderCount; i++) {
    bystanders.push(BYSTANDER);
  }
  return {
    playerZones,
    piles: { bystanders, wounds, officers: [], sidekicks: [] },
    heroAbilityHooks: [...FALCON_HOOKS, { cardId: DIVING_BLOCK_ID, timing: 'onPlay', keywords: ['diving-block'] }],
    turnEconomy: { attack: 0, recruit: 0, spentAttack: 0, spentRecruit: 0, piercing: 0, woundsDrawn: 0, cardsDrawn: 0 },
    messages: [],
    cardDisplayData: {},
    // why: the fields the live turn.onMove reads (pile-depletion and endgame checks), as in the
    // game.test.ts onMove fixtures; a non-empty Villain Deck and Hero Deck keep both checks quiet.
    counters: {},
    cardTraits: {},
    villainDeck: { deck: ['v-1'], discard: [] },
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
  return { G, playerID, ctx: {}, events: {}, random: IDENTITY_RANDOM, log: {} } as unknown as Parameters<typeof resolveSeatChoice>[0];
}

/** A setup configuration for the live onBegin case (the game.test.ts shape). */
const SETUP_CONFIGURATION = {
  schemeId: 'test/test-scheme-001',
  mastermindId: 'test/test-mastermind-001',
  villainGroupIds: ['test/test-villain-group-001', 'test/test-villain-group-002'],
  henchmanGroupIds: ['test/test-henchman-group-001'],
  heroDeckIds: ['test/test-hero-deck-001', 'test/test-hero-deck-002', 'test/test-hero-deck-003'],
  bystandersCount: 30,
  woundsCount: 30,
  officersCount: 30,
  sidekicksCount: 0,
} as MatchConfiguration;

/** The live play-phase turn hooks, read once. */
const PLAY_TURN = (
  LegendaryGame.phases as Record<string, { turn?: { onMove?: (context: unknown) => void; onBegin?: (context: unknown) => void } }>
).play!.turn!;

/**
 * Opens the waves through the LIVE play-phase turn.onMove (the game.test.ts pattern), so the
 * game.ts wiring is under test, not a hand copy of its order.
 *
 * @param G - The game state, mutated in place.
 */
function openWaves(G: LegendaryGameState): void {
  PLAY_TURN.onMove!({ G, ctx: { currentPlayer: '0' }, events: {}, random: IDENTITY_RANDOM });
}

/**
 * The game log's text lines.
 *
 * @param G - The game state.
 * @returns Each log entry's text, in order.
 */
function logText(G: LegendaryGameState): string[] {
  const lines: string[] = [];
  for (const entry of G.messages) {
    lines.push(entry.text);
  }
  return lines;
}

describe('Flying Shield Block — parse (WP-827)', () => {
  it('F1 the ca75 line builds one flying-shield-block hook per copy with no hollow marker', () => {
    assert.ok(FSB_A !== undefined && FSB_B !== undefined, 'the real data has at least two copies');
    const hook = FALCON_HOOKS.find((candidate) => candidate.cardId === FSB_A)!;
    assert.deepEqual(hook.keywords, ['flying-shield-block']);
    assert.equal(hook.conditions ?? undefined, undefined);
    assert.equal((hook.unresolvedMarkers ?? []).length, 0);
  });
});

describe('Flying Shield Block — another seat intercepts (WP-827)', () => {
  it('F2 seat 1 reveals to stop seat 0\'s Wound: the Wound returns, seat 1 rescues, the card stays in hand', () => {
    const G = makeState({ '0': [OTHER_CARD_ID], '1': [FSB_A!] });
    gainWoundForPlayer(G, '0');
    assert.deepEqual(G.pendingFlyingShieldBlockWounds, [{ recipientID: '0', woundCardId: WOUND_EXT_ID, candidateSeats: ['1'] }]);
    openWaves(G);
    assert.equal(G.pendingSeatChoice!.kind, FLYING_SHIELD_BLOCK_SEAT_CHOICE_KIND);
    assert.deepEqual(G.pendingSeatChoice!.addressedSeats, ['1']);
    assert.match(G.pendingSeatChoice!.seatPrompts['1']!.options[0]!.label, /prevent Player 0's Wound and rescue a Bystander/);
    resolveSeatChoice(makeContext(G, '1'), { optionIndex: 0 });
    assert.deepEqual(G.playerZones['0']!.discard, [], 'the Wound was prevented');
    assert.equal(G.piles.wounds.length, 3, 'the Wound went back to the supply');
    assert.deepEqual(G.playerZones['1']!.victory, [BYSTANDER], 'seat 1 rescued a Bystander');
    assert.deepEqual(G.playerZones['1']!.hand, [FSB_A], 'Flying Shield Block stays in hand');
    assert.deepEqual(G.flyingShieldBlockUsedThisTurn, [FSB_A]);
    assert.equal(G.pendingFlyingShieldBlockWounds, undefined);
    assert.equal(G.pendingSeatChoice, undefined);
  });

  it('F3 once per turn: the same copy cannot stop a second Wound this turn', () => {
    const G = makeState({ '0': [], '1': [FSB_A!] });
    gainWoundForPlayer(G, '0');
    openWaves(G);
    resolveSeatChoice(makeContext(G, '1'), { optionIndex: 0 });
    gainWoundForPlayer(G, '0');
    assert.equal(G.pendingFlyingShieldBlockWounds, undefined, 'no copy is left to reveal');
    assert.equal(G.playerZones['0']!.discard.length, 1, 'the second Wound is kept');
  });

  it('F4 a second copy can stop a second Wound in the same turn', () => {
    const G = makeState({ '0': [], '1': [FSB_A!, FSB_B!] });
    gainWoundForPlayer(G, '0');
    openWaves(G);
    resolveSeatChoice(makeContext(G, '1'), { optionIndex: 0 });
    gainWoundForPlayer(G, '0');
    openWaves(G);
    resolveSeatChoice(makeContext(G, '1'), { optionIndex: 0 });
    assert.deepEqual(G.playerZones['0']!.discard, []);
    assert.deepEqual(G.flyingShieldBlockUsedThisTurn, [FSB_A, FSB_B]);
    assert.equal(G.playerZones['1']!.victory.length, 2);
  });

  it('F5 declining keeps the Wound and logs it', () => {
    const G = makeState({ '0': [], '1': [FSB_A!] });
    gainWoundForPlayer(G, '0');
    openWaves(G);
    resolveSeatChoice(makeContext(G, '1'), { optionIndex: 1 });
    assert.equal(G.playerZones['0']!.discard.length, 1);
    assert.deepEqual(G.playerZones['1']!.victory, []);
    assert.equal(G.flyingShieldBlockUsedThisTurn, undefined, 'a decline does not use the copy');
    assert.ok(logText(G).some((line) => line.includes('Player 0 took the Wound (Flying Shield Block was not revealed)')));
  });

  it('F6 the holder can stop their own Wound', () => {
    const G = makeState({ '0': [FSB_A!] });
    gainWoundForPlayer(G, '0');
    openWaves(G);
    assert.match(G.pendingSeatChoice!.seatPrompts['0']!.options[0]!.label, /prevent your Wound/);
    resolveSeatChoice(makeContext(G, '0'), { optionIndex: 0 });
    assert.deepEqual(G.playerZones['0']!.discard, []);
    assert.deepEqual(G.playerZones['0']!.victory, [BYSTANDER]);
  });

  it('F7 a copy played this turn can be revealed', () => {
    const G = makeState({ '0': [], '1': [] });
    G.playerZones['1']!.inPlay = [FSB_A!];
    assert.equal(findRevealableFlyingShieldBlockCopy(G, '1'), FSB_A);
  });
});

describe('Flying Shield Block — order with Diving Block and other holders (WP-827)', () => {
  it('F8 the recipient\'s Diving Block is offered first; declining it offers Flying Shield Block', () => {
    const G = makeState({ '0': [DIVING_BLOCK_ID], '1': [FSB_A!] });
    gainWoundForPlayer(G, '0');
    assert.equal(G.pendingDivingBlockWounds!.length, 1);
    assert.equal(G.pendingFlyingShieldBlockWounds, undefined, 'no second interception while Diving Block is open');
    openWaves(G);
    assert.equal(G.pendingSeatChoice!.kind, 'diving-block');
    resolveSeatChoice(makeContext(G, '0'), { optionIndex: 1 });
    assert.equal(G.pendingFlyingShieldBlockWounds!.length, 1, 'the declined Wound passes to Flying Shield Block');
    openWaves(G);
    assert.equal(G.pendingSeatChoice!.kind, FLYING_SHIELD_BLOCK_SEAT_CHOICE_KIND);
    resolveSeatChoice(makeContext(G, '1'), { optionIndex: 0 });
    assert.deepEqual(G.playerZones['0']!.discard, []);
    assert.deepEqual(G.playerZones['1']!.victory, [BYSTANDER]);
  });

  it('F9 a revealed Diving Block leaves nothing for Flying Shield Block', () => {
    const G = makeState({ '0': [DIVING_BLOCK_ID], '1': [FSB_A!] });
    gainWoundForPlayer(G, '0');
    openWaves(G);
    resolveSeatChoice(makeContext(G, '0'), { optionIndex: 0 });
    assert.equal(G.pendingFlyingShieldBlockWounds, undefined);
    assert.deepEqual(G.playerZones['1']!.victory, []);
  });

  it('F10 two holders: a decline by the first passes the Wound to the second', () => {
    const G = makeState({ '0': [], '1': [FSB_A!], '2': [FSB_B!] });
    gainWoundForPlayer(G, '0');
    assert.deepEqual(G.pendingFlyingShieldBlockWounds![0]!.candidateSeats, ['1', '2']);
    openWaves(G);
    assert.deepEqual(G.pendingSeatChoice!.addressedSeats, ['1']);
    resolveSeatChoice(makeContext(G, '1'), { optionIndex: 1 });
    openWaves(G);
    assert.deepEqual(G.pendingSeatChoice!.addressedSeats, ['2']);
    resolveSeatChoice(makeContext(G, '2'), { optionIndex: 0 });
    assert.deepEqual(G.playerZones['0']!.discard, []);
    assert.deepEqual(G.playerZones['2']!.victory, [BYSTANDER]);
  });

  it('F15 crossing stamps: each seat resolves the Wound it was shown, recipient first', () => {
    const G = makeState({ '0': [], '1': [FSB_A!], '2': [FSB_B!] });
    gainWoundForPlayer(G, '0');
    gainWoundForPlayer(G, '2');
    assert.deepEqual(G.pendingFlyingShieldBlockWounds!.map((entry) => entry.candidateSeats), [['1', '2'], ['2', '1']]);
    openWaves(G);
    assert.deepEqual(G.pendingSeatChoice!.addressedSeats, ['1', '2']);
    assert.deepEqual(G.pendingFlyingShieldBlockWounds!.map((entry) => entry.addressedSeat), ['1', '2']);
    resolveSeatChoice(makeContext(G, '1'), { optionIndex: 1 });
    resolveSeatChoice(makeContext(G, '2'), { optionIndex: 1 });
    openWaves(G);
    assert.deepEqual(G.pendingFlyingShieldBlockWounds!.map((entry) => entry.addressedSeat), ['2', '1']);
    resolveSeatChoice(makeContext(G, '1'), { optionIndex: 0 });
    resolveSeatChoice(makeContext(G, '2'), { optionIndex: 1 });
    assert.deepEqual(G.playerZones['2']!.discard, [], 'seat 1 prevented seat 2\'s Wound');
    assert.equal(G.playerZones['0']!.discard.length, 1, 'seat 0 keeps its Wound');
    assert.deepEqual(G.playerZones['1']!.victory, [BYSTANDER]);
    const lines = logText(G);
    const revealIndex = lines.findIndex((line) => line.includes("Player 1 revealed Flying Shield Block: prevented Player 2's Wound"));
    const keptIndex = lines.findIndex((line) => line.includes('Player 0 took the Wound (Flying Shield Block was not revealed)'));
    assert.ok(revealIndex !== -1 && keptIndex > revealIndex);
    assert.equal(G.pendingFlyingShieldBlockWounds, undefined);
  });

  it('F11 two Wounds and one copy: the second Wound is kept once the copy is used', () => {
    const G = makeState({ '0': [], '1': [FSB_A!], '2': [] });
    gainWoundForPlayer(G, '0');
    gainWoundForPlayer(G, '2');
    assert.equal(G.pendingFlyingShieldBlockWounds!.length, 2);
    openWaves(G);
    assert.deepEqual(G.pendingSeatChoice!.addressedSeats, ['1'], 'one prompt per seat per wave');
    resolveSeatChoice(makeContext(G, '1'), { optionIndex: 0 });
    openWaves(G);
    assert.equal(G.pendingSeatChoice, undefined);
    assert.equal(G.pendingFlyingShieldBlockWounds, undefined);
    assert.deepEqual(G.playerZones['0']!.discard, [], 'the first Wound was prevented');
    assert.equal(G.playerZones['2']!.discard.length, 1, 'the second Wound is kept');
    assert.ok(logText(G).some((line) => line.includes('Player 2 took the Wound (no Flying Shield Block was left to reveal)')));
  });
});

describe('Flying Shield Block — turn reset, empty supply, bot (WP-827)', () => {
  it('F12 the once-per-turn record is cleared at turn start (rebuilt loops)', () => {
    const G = makeState({ '0': [], '1': [FSB_A!] });
    G.flyingShieldBlockUsedThisTurn = [FSB_A!];
    applyOnBeginParity(G, '0');
    assert.equal(G.flyingShieldBlockUsedThisTurn, undefined);
    assert.equal(findRevealableFlyingShieldBlockCopy(G, '1'), FSB_A);
    const neverSet = makeState({ '0': [] });
    applyOnBeginParity(neverSet, '0');
    assert.equal(Object.prototype.hasOwnProperty.call(neverSet, 'flyingShieldBlockUsedThisTurn'), false, 'no key is created');
  });

  it('F12b the live turn.onBegin clears the once-per-turn record and creates no key when unset', () => {
    const setupState = LegendaryGame.setup!(
      makeMockCtx({ numPlayers: 2 }) as Parameters<NonNullable<typeof LegendaryGame.setup>>[0],
      SETUP_CONFIGURATION,
    );
    const beginContext = {
      G: setupState,
      ctx: { currentPlayer: '0', numPlayers: 2, phase: 'play', turn: 2 },
      random: { Shuffle: <T,>(deck: T[]): T[] => [...deck].reverse() },
      events: { setPhase: (): void => {}, endTurn: (): void => {} },
    };
    PLAY_TURN.onBegin!(beginContext);
    assert.equal(Object.prototype.hasOwnProperty.call(setupState, 'flyingShieldBlockUsedThisTurn'), false, 'no key is created');
    setupState.flyingShieldBlockUsedThisTurn = ['ca75/captain-america-falcon/flying-shield-block#0' as CardExtId];
    PLAY_TURN.onBegin!(beginContext);
    assert.equal(setupState.flyingShieldBlockUsedThisTurn, undefined);
  });

  it('F13 with no Bystander left the reveal still prevents the Wound and says so', () => {
    const G = makeState({ '0': [], '1': [FSB_A!] }, 3, 0);
    gainWoundForPlayer(G, '0');
    openWaves(G);
    resolveSeatChoice(makeContext(G, '1'), { optionIndex: 0 });
    assert.deepEqual(G.playerZones['0']!.discard, []);
    assert.ok(logText(G).some((line) => line.includes('could not rescue a Bystander (the supply is empty)')));
  });

  it('F16 a reveal after the Wound left the discard still rescues and says why', () => {
    const G = makeState({ '0': [], '1': [FSB_A!] });
    gainWoundForPlayer(G, '0');
    openWaves(G);
    G.playerZones['0']!.discard = [];
    resolveSeatChoice(makeContext(G, '1'), { optionIndex: 0 });
    assert.deepEqual(G.flyingShieldBlockUsedThisTurn, [FSB_A]);
    assert.deepEqual(G.playerZones['1']!.victory, [BYSTANDER]);
    assert.ok(logText(G).some((line) => line.includes("Player 0's Wound was no longer in their discard pile")));
  });

  it('F14 a bot seat always reveals', () => {
    const G = makeState({ '0': [], '1': [FSB_A!] });
    gainWoundForPlayer(G, '0');
    openWaves(G);
    assert.equal(choosePlayingSeatChoiceOption(G, '1'), 0);
  });
});
