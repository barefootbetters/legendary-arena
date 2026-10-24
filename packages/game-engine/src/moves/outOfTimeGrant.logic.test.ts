/**
 * Winter Soldier's 2>4 grants Man Out of Time to a Hero in hand for the turn (WP-828 / D-24761).
 *
 * "A Hero in your hand gains [keyword:Man Out of Time] this turn." and "[hc:tech]: Another
 * Hero in your hand gains [keyword:Man Out of Time] this turn." The 2>4 and Storm the
 * Beachhead hooks are built from the committed data/cards/ca75.json; cards are played through
 * the real `playCard` move on a `buildInitialGameState` match, and owed grants are opened
 * through the LIVE play-phase turn.onMove, so the parse, the queue, the seat choice, the
 * game.ts wiring and the applyCardPlay set-aside are exercised together.
 *
 * No boardgame.io imports. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OUT_OF_TIME_GRANT_SEAT_CHOICE_KIND, applyGrantedOutOfTime } from './outOfTimeGrant.logic.js';
import { playCard } from './coreMoves.impl.js';
import { resolveSeatChoice } from './seatChoice.resolve.js';
import { buildHeroAbilityHooks } from '../setup/heroAbility.setup.js';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { choosePlayingSeatChoiceOption } from '../simulation/ai.seatChoice.js';
import { applyOnBeginParity } from '../simulation/onBeginParity.js';
import { LegendaryGame } from '../game.js';
import { WOUND_EXT_ID, BYSTANDER_EXT_ID } from '../setup/pilesInit.js';
import { SHIELD_AGENT_EXT_ID } from '../setup/pilesInit.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { makeMockMoveContext } from '../test/mockMoveContext.js';
import type { LegendaryGameState, MatchConfiguration } from '../types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { CardStatEntry } from '../economy/economy.types.js';

// why: resolve the repo-root data directory from this test's own location (the
// doubledSuperpowerIcon.test.ts precedent), so the tests read the card data that ships.
const CARDS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'data', 'cards');

const HERO_A = 'test/ally/hero-a#0';
const HERO_B = 'test/ally/hero-b#0';
const HERO_C = 'test/ally/hero-c#0';
const TECH_ALLY = 'test/ally/tech-ally#0';
const DECK = ['deck-01', 'deck-02', 'deck-03', 'deck-04', 'deck-05', 'deck-06'];

/**
 * Builds the real hooks for ca75 hero decks from the committed card data.
 *
 * @param heroSlugs - The ca75 hero slugs.
 * @returns Every hook the hero decks produce.
 */
function buildCa75Hooks(heroSlugs: string[]): HeroAbilityHook[] {
  const setData = JSON.parse(readFileSync(join(CARDS_DIRECTORY, 'ca75.json'), 'utf8'));
  const registry = { listCards: () => [], getSet: (abbr: string) => (abbr === 'ca75' ? setData : undefined) };
  const heroDeckIds = heroSlugs.map((slug) => `ca75/${slug}`);
  return buildHeroAbilityHooks(registry, { heroDeckIds } as unknown as MatchConfiguration);
}

const HOOKS = buildCa75Hooks(['winter-soldier', 'captain-america-1941']);

/**
 * The first copy id of a card in the built hooks.
 *
 * @param cardSlug - The card slug.
 * @returns The first copy's card id.
 */
function firstCopy(cardSlug: string): CardExtId {
  const hook = HOOKS.find((candidate) => candidate.cardId.includes(`/${cardSlug}#`));
  assert.ok(hook !== undefined, `the ca75 data builds a hook for ${cardSlug}`);
  return hook.cardId;
}

const TWO_FOUR = firstCopy('2-4');
const STORM_THE_BEACHHEAD = firstCopy('storm-the-beachhead');

/**
 * A complete CardStatEntry for a test hero.
 *
 * @param cost - The printed cost.
 * @returns The stat entry (no attack / recruit).
 */
function heroStat(cost: number): CardStatEntry {
  return {
    attack: 0, recruit: 0, cost, fightCost: 0, fightCostMode: 'static', fightCostBase: 0,
    hasAttackIcon: false, hasRecruitIcon: false, isShieldOrHydra: false,
  };
}

/**
 * A main-stage match for player 0 with the given hand and cards played before.
 *
 * @param hand - Player 0's hand.
 * @param playedBefore - Cards already in player 0's play area.
 * @returns The game state.
 */
function makeState(hand: string[], playedBefore: string[] = []): LegendaryGameState {
  const gameState = buildInitialGameState(
    {
      schemeId: 'test-scheme', mastermindId: 'test-mastermind', villainGroupIds: [], henchmanGroupIds: [],
      heroDeckIds: [], bystandersCount: 0, woundsCount: 0, officersCount: 0, sidekicksCount: 0,
    },
    {},
    makeMockCtx(),
  );
  gameState.heroAbilityHooks = HOOKS;
  gameState.cardTraits = {
    [TWO_FOUR]: { heroClass: 'tech', team: null },
    [STORM_THE_BEACHHEAD]: { heroClass: 'tech', team: null },
    [TECH_ALLY]: { heroClass: 'tech', team: null },
  };
  gameState.cardStats = {
    [TWO_FOUR]: heroStat(7),
    [STORM_THE_BEACHHEAD]: heroStat(5),
    [HERO_A]: heroStat(2),
    [HERO_B]: heroStat(6),
    [HERO_C]: heroStat(4),
    [TECH_ALLY]: heroStat(2),
  };
  gameState.currentStage = 'main';
  gameState.playerZones['0']!.hand = [...hand];
  gameState.playerZones['0']!.inPlay = [...playedBefore];
  gameState.playerZones['0']!.deck = [...DECK];
  return gameState;
}

/** The live play-phase turn hooks, read once. */
const PLAY_TURN = (
  LegendaryGame.phases as Record<string, { turn?: { onMove?: (context: unknown) => void; onBegin?: (context: unknown) => void } }>
).play!.turn!;

/**
 * Plays a hand card through the real playCard move, then runs the LIVE turn.onMove.
 *
 * @param G - The game state, mutated in place.
 * @param cardId - The hand card to play.
 */
function playAndSettle(G: LegendaryGameState, cardId: string): void {
  playCard(makeMockMoveContext(G), { cardId });
  settle(G);
}

/**
 * Runs the LIVE play-phase turn.onMove (opens owed grants).
 *
 * @param G - The game state, mutated in place.
 */
function settle(G: LegendaryGameState): void {
  PLAY_TURN.onMove!({ G, ctx: { currentPlayer: '0' }, events: {}, random: { Shuffle: <T,>(deck: T[]): T[] => [...deck] } });
}

/**
 * Submits player 0's seat-choice option, then runs the live onMove.
 *
 * @param G - The game state, mutated in place.
 * @param optionIndex - The option to submit.
 */
function choose(G: LegendaryGameState, optionIndex: number): void {
  resolveSeatChoice(makeMockMoveContext(G), { optionIndex });
  settle(G);
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
    lines.push(typeof entry === 'string' ? entry : entry.text);
  }
  return lines;
}

/**
 * The card ids listed in the open seat choice for player 0.
 *
 * @param G - The game state.
 * @returns The option card ids.
 */
function optionCards(G: LegendaryGameState): (CardExtId | undefined)[] {
  const options = G.pendingSeatChoice!.seatPrompts['0']!.options;
  const cards: (CardExtId | undefined)[] = [];
  for (const option of options) {
    cards.push(option.cardId);
  }
  return cards;
}

describe('Winter Soldier 2>4 — parse (WP-828)', () => {
  it('W1 both lines build a grant-out-of-time hook; the second is gated on [hc:tech]', () => {
    const cardHooks = HOOKS.filter((hook) => hook.cardId === TWO_FOUR);
    assert.equal(cardHooks.length, 2);
    assert.deepEqual(cardHooks[0]!.effects, [{ type: 'grant-out-of-time' }]);
    assert.deepEqual(cardHooks[0]!.conditions ?? [], []);
    assert.deepEqual(cardHooks[1]!.effects, [{ type: 'grant-out-of-time' }]);
    assert.deepEqual(cardHooks[1]!.conditions, [{ type: 'heroClassMatch', value: 'tech' }]);
    assert.equal((cardHooks[0]!.unresolvedMarkers ?? []).length + (cardHooks[1]!.unresolvedMarkers ?? []).length, 0);
  });
});

describe('Winter Soldier 2>4 — choosing the Hero (WP-828)', () => {
  it('W2 one eligible Hero (a Wound is not one) is granted with no prompt', () => {
    const G = makeState([TWO_FOUR, HERO_A, WOUND_EXT_ID]);
    playAndSettle(G, TWO_FOUR);
    assert.equal(G.pendingSeatChoice, undefined);
    assert.deepEqual(G.outOfTimeGrantedThisTurn, [HERO_A]);
    assert.equal(G.pendingOutOfTimeGrants, undefined);
    assert.ok(logText(G).some((line) => line.includes('gains Man Out of Time this turn')));
  });

  it('W3 two eligible Heroes open the active player\'s choice; the pick is granted', () => {
    const G = makeState([TWO_FOUR, HERO_A, HERO_B]);
    playAndSettle(G, TWO_FOUR);
    assert.equal(G.pendingSeatChoice!.kind, OUT_OF_TIME_GRANT_SEAT_CHOICE_KIND);
    assert.deepEqual(G.pendingSeatChoice!.addressedSeats, ['0']);
    assert.deepEqual(optionCards(G), [HERO_A, HERO_B]);
    choose(G, 1);
    assert.deepEqual(G.outOfTimeGrantedThisTurn, [HERO_B]);
    assert.equal(G.pendingSeatChoice, undefined);
    assert.equal(G.pendingOutOfTimeGrants, undefined);
  });

  it('W4 with [hc:tech] two grants are owed and the second excludes the first pick ("Another Hero")', () => {
    const G = makeState([TWO_FOUR, HERO_A, HERO_B, HERO_C], [TECH_ALLY]);
    playAndSettle(G, TWO_FOUR);
    assert.equal(G.pendingOutOfTimeGrants!.length, 2);
    assert.deepEqual(optionCards(G), [HERO_A, HERO_B, HERO_C]);
    choose(G, 0);
    assert.deepEqual(optionCards(G), [HERO_B, HERO_C], 'the second choice leaves out the first pick');
    choose(G, 1);
    assert.deepEqual(G.outOfTimeGrantedThisTurn, [HERO_A, HERO_C]);
    assert.equal(G.pendingOutOfTimeGrants, undefined);
  });

  it('W5 with [hc:tech] and one Hero in hand the first is granted and the second logs why it did nothing', () => {
    const G = makeState([TWO_FOUR, HERO_A], [TECH_ALLY]);
    playAndSettle(G, TWO_FOUR);
    assert.deepEqual(G.outOfTimeGrantedThisTurn, [HERO_A]);
    assert.equal(G.pendingSeatChoice, undefined);
    assert.ok(logText(G).some((line) => line.includes('has no Hero left in hand to gain Man Out of Time')));
  });

  it('W6 no Hero in hand (a Wound and a Bystander are not Heroes) grants nothing and logs it', () => {
    const G = makeState([TWO_FOUR, WOUND_EXT_ID, BYSTANDER_EXT_ID]);
    playAndSettle(G, TWO_FOUR);
    assert.equal(G.outOfTimeGrantedThisTurn, undefined);
    assert.equal(G.pendingOutOfTimeGrants, undefined);
    assert.ok(logText(G).some((line) => line.includes('has no Hero left in hand to gain Man Out of Time')));
  });

  it('W7 the bot grants the highest-cost listed Hero', () => {
    const G = makeState([TWO_FOUR, HERO_A, HERO_B, HERO_C]);
    playAndSettle(G, TWO_FOUR);
    assert.equal(choosePlayingSeatChoiceOption(G, '0'), 1, 'HERO_B costs 6');
  });
});

describe('Winter Soldier 2>4 — the granted card goes Out of Time (WP-828)', () => {
  it('W8 the granted Hero, played this turn, is set aside Out of Time after its abilities', () => {
    const G = makeState([TWO_FOUR, HERO_A]);
    playAndSettle(G, TWO_FOUR);
    playAndSettle(G, HERO_A);
    assert.equal(G.playerZones['0']!.inPlay.includes(HERO_A), false);
    assert.deepEqual(G.outOfTimeCards?.['0'], [HERO_A]);
    assert.ok(G.turnEconomy.outOfTimePlayedCardIds?.includes(HERO_A));
  });

  it('W9 a card that was not granted stays in play', () => {
    const G = makeState([TWO_FOUR, HERO_A, WOUND_EXT_ID], []);
    G.playerZones['0']!.hand.push(HERO_C);
    playAndSettle(G, TWO_FOUR);
    choose(G, 0);
    playAndSettle(G, HERO_C);
    assert.ok(G.playerZones['0']!.inPlay.includes(HERO_C));
    assert.equal(G.outOfTimeCards?.['0']?.includes(HERO_C) ?? false, false);
  });

  it('W10 a granted card with its own Man Out of Time goes Out of Time once, with one set-aside line', () => {
    const G = makeState([TWO_FOUR, STORM_THE_BEACHHEAD]);
    playAndSettle(G, TWO_FOUR);
    assert.deepEqual(G.outOfTimeGrantedThisTurn, [STORM_THE_BEACHHEAD]);
    playAndSettle(G, STORM_THE_BEACHHEAD);
    assert.deepEqual(G.outOfTimeCards?.['0'], [STORM_THE_BEACHHEAD]);
    const setAsideLines = logText(G).filter((line) => line.includes('aside Out of Time') || line.includes('not set aside'));
    assert.equal(setAsideLines.length, 1);
  });
});

describe('Winter Soldier 2>4 — skips and waits (WP-828)', () => {
  it('W13 two copies sharing one id: the grant covers the id, the first goes Out of Time, the second stays, silently', () => {
    const G = makeState([TWO_FOUR, SHIELD_AGENT_EXT_ID, SHIELD_AGENT_EXT_ID]);
    playAndSettle(G, TWO_FOUR);
    assert.deepEqual(G.outOfTimeGrantedThisTurn, [SHIELD_AGENT_EXT_ID], 'one eligible id: auto-granted');
    playAndSettle(G, SHIELD_AGENT_EXT_ID);
    playAndSettle(G, SHIELD_AGENT_EXT_ID);
    assert.deepEqual(G.outOfTimeCards?.['0'], [SHIELD_AGENT_EXT_ID], 'the first copy is set aside');
    assert.ok(G.playerZones['0']!.inPlay.includes(SHIELD_AGENT_EXT_ID), 'the second copy stays in play');
    assert.equal(logText(G).some((line) => line.includes('not set aside')), false);
  });

  it('W14 a granted card that is no longer last in play is skipped silently', () => {
    const G = makeState([]);
    G.outOfTimeGrantedThisTurn = [HERO_A as CardExtId];
    G.playerZones['0']!.inPlay = [HERO_A, HERO_C];
    applyGrantedOutOfTime(G, makeMockMoveContext(G), '0', HERO_A as CardExtId);
    assert.deepEqual(G.playerZones['0']!.inPlay, [HERO_A, HERO_C]);
    assert.equal(logText(G).some((line) => line.includes("a copy can't use Out of Time")), false);
  });

  it('W15 the opener waits while another choice is open, then opens', () => {
    const G = makeState([TWO_FOUR, HERO_A, HERO_B]);
    G.pendingHeroChoice = { choiceType: 'discard-or-return', cardId: 'deck-01' as CardExtId, playerID: '0' };
    playAndSettle(G, TWO_FOUR);
    assert.equal(G.pendingSeatChoice, undefined, 'no grant choice while a hero choice is open');
    assert.equal(G.pendingOutOfTimeGrants!.length, 1);
    delete G.pendingHeroChoice;
    settle(G);
    assert.equal(G.pendingSeatChoice!.kind, OUT_OF_TIME_GRANT_SEAT_CHOICE_KIND);

    const H = makeState([TWO_FOUR, HERO_A, HERO_B]);
    playCard(makeMockMoveContext(H), { cardId: TWO_FOUR });
    // why: a pending Do-Over blocks playCard itself, so it is opened after the play and before
    // the move's onMove runs (the window a Steal Abilities double-park would hit).
    H.pendingDoOverChoices = [{ playerID: '0' }] as unknown as LegendaryGameState['pendingDoOverChoices'];
    settle(H);
    assert.equal(H.pendingSeatChoice, undefined, 'no grant choice while another pending choice is open');
    assert.equal(H.pendingOutOfTimeGrants!.length, 1);
    delete H.pendingDoOverChoices;
    settle(H);
    assert.equal(H.pendingSeatChoice!.kind, OUT_OF_TIME_GRANT_SEAT_CHOICE_KIND);
  });
});

describe('Winter Soldier 2>4 — turn reset (WP-828)', () => {
  it('W11 applyOnBeginParity deletes the grant list and the owed queue, creating no key when unset', () => {
    const G = makeState([]);
    G.outOfTimeGrantedThisTurn = [HERO_A as CardExtId];
    G.pendingOutOfTimeGrants = [{ playerID: '0', sourceCardId: TWO_FOUR }];
    applyOnBeginParity(G, '0');
    assert.equal(G.outOfTimeGrantedThisTurn, undefined);
    assert.equal(G.pendingOutOfTimeGrants, undefined);
    const neverSet = makeState([]);
    applyOnBeginParity(neverSet, '0');
    assert.equal(Object.prototype.hasOwnProperty.call(neverSet, 'outOfTimeGrantedThisTurn'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(neverSet, 'pendingOutOfTimeGrants'), false);
  });

  it('W12 the live turn.onBegin deletes both, creating no key when unset', () => {
    const G = makeState([]);
    const beginContext = {
      G,
      ctx: { currentPlayer: '0', numPlayers: 1, phase: 'play', turn: 2 },
      random: { Shuffle: <T,>(deck: T[]): T[] => [...deck] },
      events: { setPhase: (): void => {}, endTurn: (): void => {} },
    };
    PLAY_TURN.onBegin!(beginContext);
    assert.equal(Object.prototype.hasOwnProperty.call(G, 'outOfTimeGrantedThisTurn'), false);
    G.outOfTimeGrantedThisTurn = [HERO_A as CardExtId];
    G.pendingOutOfTimeGrants = [{ playerID: '0', sourceCardId: TWO_FOUR }];
    PLAY_TURN.onBegin!(beginContext);
    assert.equal(G.outOfTimeGrantedThisTurn, undefined);
    assert.equal(G.pendingOutOfTimeGrants, undefined);
  });
});
