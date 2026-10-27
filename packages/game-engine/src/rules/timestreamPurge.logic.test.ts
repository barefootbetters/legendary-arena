/**
 * Go Back in Time to Slay Heroes' Ancestors — "Purged from the Timestream" (WP-829 / D-24762).
 *
 * "Twist: Put a Hero from the HQ next to the Scheme, 'Purged from the Timestream.'" and "Special
 * Rules: Whenever a Hero is in the HQ whose Hero Name has been Purged from the Timestream, KO that
 * Hero." Builds a full G from the shipped data/cards/ca75.json (the brainwashTheMilitary.test.ts
 * precedent), resolves the Twist through the registered resolver, opens owed Purges through the
 * LIVE play-phase turn.onMove, and resolves picks with resolveSeatChoice.
 *
 * node:test + node:assert only. No boardgame.io import.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { makeMockMoveContext } from '../test/mockMoveContext.js';
import { SCHEME_TWIST_RESOLVERS } from './schemeTwistResolvers.js';
import { SCHEME_TWIST_CONFIGS } from './schemeTwistConfigs.js';
import { DEFAULT_IMPLEMENTATION_MAP } from './ruleRuntime.impl.js';
import {
  heroNameOf,
  sweepPurgedHeroesFromHq,
  TIMESTREAM_PURGE_SEAT_CHOICE_KIND,
} from './timestreamPurge.logic.js';
import { resolveSeatChoice } from '../moves/seatChoice.resolve.js';
import { choosePlayingSeatChoiceOption } from '../simulation/ai.seatChoice.js';
import { LegendaryGame } from '../game.js';
import { ENDGAME_CONDITIONS } from '../endgame/endgame.types.js';
import type { LegendaryGameState } from '../types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { RevealContext } from '../villainDeck/villainDeck.reveal.js';

const here = dirname(fileURLToPath(import.meta.url));
const ca75SetData = JSON.parse(readFileSync(join(here, '..', '..', '..', '..', 'data', 'cards', 'ca75.json'), 'utf8'));

const SCHEME_ID = 'ca75/go-back-in-time-to-slay-heroes-ancestors';
const TWIST_ID = 'scheme-twist-go-back-in-time-00' as CardExtId;
const REVEAL_CONTEXT: RevealContext = {
  random: { Shuffle: <T,>(deck: T[]): T[] => [...deck] },
  ctx: { currentPlayer: '0', turn: 3 },
};

/** A setup registry over the real ca75 set (getSet serves ca75.json). */
const REGISTRY = {
  listCards: () => [],
  listSets: () => [{ abbr: 'ca75' }],
  getSet: (abbr: string) => (abbr === 'ca75' ? ca75SetData : undefined),
};

/** A ca75 loadout with the scheme under test and four Hero decks. */
const CONFIG: MatchSetupConfig = {
  schemeId: SCHEME_ID,
  mastermindId: 'ca75/arnim-zola',
  villainGroupIds: ['ca75/masters-of-evil-wwii'],
  henchmanGroupIds: [],
  heroDeckIds: ['ca75/agent-x-13', 'ca75/captain-america-falcon', 'ca75/winter-soldier', 'ca75/captain-america-1941'],
  bystandersCount: 30,
  woundsCount: 30,
  officersCount: 30,
  sidekicksCount: 0,
};

/** Hero card ids of the built match, grouped by Hero Name. */
type HeroPools = Record<string, CardExtId[]>;

/**
 * Builds the match and groups every Hero Deck / HQ card by Hero Name.
 *
 * @returns The game state and its Hero cards by Hero Name.
 */
function buildMatch(): { G: LegendaryGameState; pools: HeroPools } {
  const G = buildInitialGameState(CONFIG, REGISTRY, makeMockCtx({ numPlayers: 2 }));
  const pools: HeroPools = {};
  for (const cardId of [...G.hq, ...G.heroDeck]) {
    if (cardId === null || cardId === undefined) {
      continue;
    }
    const name = heroNameOf(cardId);
    if (pools[name] === undefined) {
      pools[name] = [];
    }
    pools[name]!.push(cardId);
  }
  return { G, pools };
}

/** The live play-phase turn hooks, read once. */
const PLAY_TURN = (
  LegendaryGame.phases as Record<string, { turn?: { onMove?: (context: unknown) => void } }>
).play!.turn!;

/**
 * Runs the LIVE play-phase turn.onMove (opens owed Purges, runs the sweep).
 *
 * @param G - The game state, mutated in place.
 */
function settle(G: LegendaryGameState): void {
  PLAY_TURN.onMove!({ G, ctx: { currentPlayer: '0' }, events: {}, random: REVEAL_CONTEXT.random });
}

/**
 * Resolves one Go Back in Time Twist through the registered resolver.
 *
 * @param G - The game state, mutated in place.
 */
function twist(G: LegendaryGameState): void {
  SCHEME_TWIST_RESOLVERS['go-back-in-time'](G, REVEAL_CONTEXT, DEFAULT_IMPLEMENTATION_MAP, {}, TWIST_ID);
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

const NAMES = ['ca75/agent-x-13', 'ca75/captain-america-falcon', 'ca75/winter-soldier', 'ca75/captain-america-1941'];

describe('Go Back in Time — config and Twist (WP-829)', () => {
  it('B1 the scheme dispatches to go-back-in-time and keeps the Hero Deck loss', () => {
    const config = SCHEME_TWIST_CONFIGS.get(SCHEME_ID)!;
    assert.equal(config.resolverId, 'go-back-in-time');
    assert.deepEqual(config.resourceLossCondition, { kind: 'pile-depleted', pile: 'heroDeck' });
  });

  it('B2 a Twist queues one owed Purge for the active player', () => {
    const { G } = buildMatch();
    twist(G);
    assert.deepEqual(G.pendingTimestreamPurges, [{ chooserPlayerID: '0', twistCardId: TWIST_ID }]);
  });
});

describe('Go Back in Time — the Purge (WP-829)', () => {
  it('B3 two or more HQ Heroes open the active player\'s choice, in slot order with costs', () => {
    const { G } = buildMatch();
    twist(G);
    settle(G);
    assert.equal(G.pendingSeatChoice!.kind, TIMESTREAM_PURGE_SEAT_CHOICE_KIND);
    assert.deepEqual(G.pendingSeatChoice!.addressedSeats, ['0']);
    const options = G.pendingSeatChoice!.seatPrompts['0']!.options;
    assert.deepEqual(options.map((option) => option.cardId), G.hq.filter((cardId) => cardId !== null));
    assert.match(options[0]!.label, /\(cost \d+\)$/);
  });

  it('B4 the pick is Purged (not KO\'d), its slot refills, and every HQ Hero of that name is KO\'d', () => {
    const { G, pools } = buildMatch();
    const [falconA, falconB] = pools['ca75/captain-america-falcon']!;
    const otherHeroes = [pools['ca75/agent-x-13']![0]!, pools['ca75/winter-soldier']![0]!, pools['ca75/captain-america-1941']![0]!];
    G.hq = [falconA!, otherHeroes[0]!, falconB!, otherHeroes[1]!, otherHeroes[2]!];
    G.heroDeck = [pools['ca75/agent-x-13']![1]!, pools['ca75/winter-soldier']![1]!, pools['ca75/agent-x-13']![2]!];
    twist(G);
    settle(G);
    resolveSeatChoice(makeMockMoveContext(G), { optionIndex: 0 });
    assert.deepEqual(G.purgedFromTimestream, [falconA]);
    assert.ok(!G.ko.includes(falconA!), 'the Purged Hero is not KO\'d');
    assert.ok(G.ko.includes(falconB!), 'the other Falcon card in the HQ is KO\'d');
    assert.equal(G.hq.some((cardId) => cardId !== null && heroNameOf(cardId) === 'ca75/captain-america-falcon'), false);
    assert.equal(G.hq.filter((cardId) => cardId !== null).length, 5, 'both slots refilled');
    assert.equal(G.pendingTimestreamPurges, undefined);
    assert.ok(logText(G).some((line) => line.includes('Purged') && line.includes('from the Timestream')));
  });

  it('B5 one HQ Hero is Purged with no prompt; an empty HQ logs a no-op', () => {
    const { G, pools } = buildMatch();
    const lone = pools['ca75/winter-soldier']![0]!;
    G.hq = [null, lone, null, null, null];
    // why: a non-empty Hero Deck — an empty one is already the scheme's loss, and the opener
    // rightly waits once the match is decided.
    G.heroDeck = [pools['ca75/agent-x-13']![0]!, pools['ca75/agent-x-13']![1]!];
    twist(G);
    settle(G);
    assert.equal(G.pendingSeatChoice, undefined);
    assert.deepEqual(G.purgedFromTimestream, [lone]);
    G.hq = [null, null, null, null, null];
    twist(G);
    settle(G);
    assert.ok(logText(G).some((line) => line.includes('No Hero in the HQ to Purge')));
    assert.equal(G.pendingTimestreamPurges, undefined);
  });

  it('B6 two owed Purges resolve one after the other', () => {
    const { G } = buildMatch();
    twist(G);
    twist(G);
    settle(G);
    resolveSeatChoice(makeMockMoveContext(G), { optionIndex: 0 });
    settle(G);
    assert.equal(G.pendingSeatChoice!.kind, TIMESTREAM_PURGE_SEAT_CHOICE_KIND, 'the second Purge opens');
    resolveSeatChoice(makeMockMoveContext(G), { optionIndex: 0 });
    assert.equal(G.purgedFromTimestream!.length, 2);
    assert.equal(G.pendingTimestreamPurges, undefined);
  });

  it('B7 the opener waits while another choice is open', () => {
    const { G } = buildMatch();
    twist(G);
    G.pendingHeroChoice = { choiceType: 'discard-or-return', cardId: 'deck-01' as CardExtId, playerID: '0' };
    settle(G);
    assert.equal(G.pendingSeatChoice, undefined);
    assert.equal(G.pendingTimestreamPurges!.length, 1);
    delete G.pendingHeroChoice;
    settle(G);
    assert.equal(G.pendingSeatChoice!.kind, TIMESTREAM_PURGE_SEAT_CHOICE_KIND);
  });

  it('B8 the bot Purges the cheapest listed Hero', () => {
    const { G } = buildMatch();
    twist(G);
    settle(G);
    const options = G.pendingSeatChoice!.seatPrompts['0']!.options;
    let cheapestIndex = 0;
    for (let optionIndex = 1; optionIndex < options.length; optionIndex++) {
      if ((G.cardStats[options[optionIndex]!.cardId!]?.cost ?? 0) < (G.cardStats[options[cheapestIndex]!.cardId!]?.cost ?? 0)) {
        cheapestIndex = optionIndex;
      }
    }
    assert.equal(choosePlayingSeatChoiceOption(G, '0'), cheapestIndex);
  });
});

describe('Go Back in Time — the "whenever" sweep (WP-829)', () => {
  it('B9 after a move, an HQ Hero of a Purged name is KO\'d and its slot refilled', () => {
    const { G, pools } = buildMatch();
    const [purged, sameName] = pools['ca75/agent-x-13']!;
    const refill = pools['ca75/winter-soldier']![0]!;
    G.purgedFromTimestream = [purged!];
    G.hq = [sameName!, pools['ca75/captain-america-falcon']![0]!, null, null, null];
    G.heroDeck = [refill];
    settle(G);
    assert.ok(G.ko.includes(sameName!));
    assert.equal(G.hq[0], refill);
  });

  it('B10 the sweep repeats until no Purged name is left in the HQ', () => {
    const { G, pools } = buildMatch();
    const agents = pools['ca75/agent-x-13']!;
    G.purgedFromTimestream = [agents[0]!];
    G.hq = [agents[1]!, null, null, null, null];
    G.heroDeck = [agents[2]!, agents[3]!, pools['ca75/winter-soldier']![0]!];
    assert.equal(sweepPurgedHeroesFromHq(G), 3);
    assert.equal(G.hq[0], pools['ca75/winter-soldier']![0]);
  });

  it('B11 a sweep that empties the Hero Deck triggers the scheme loss', () => {
    const { G, pools } = buildMatch();
    const agents = pools['ca75/agent-x-13']!;
    G.hq = [agents[0]!, agents[1]!, null, null, null];
    G.heroDeck = [agents[2]!];
    twist(G);
    settle(G);
    resolveSeatChoice(makeMockMoveContext(G), { optionIndex: 0 });
    assert.equal(G.heroDeck.length, 0);
    assert.equal(G.counters[ENDGAME_CONDITIONS.SCHEME_LOSS], 1);
  });

  it('B12 with nothing Purged the sweep is a no-op and creates no field', () => {
    const { G } = buildMatch();
    const hqBefore = [...G.hq];
    assert.equal(sweepPurgedHeroesFromHq(G), 0);
    settle(G);
    assert.deepEqual(G.hq, hqBefore);
    assert.equal(Object.prototype.hasOwnProperty.call(G, 'purgedFromTimestream'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(G, 'pendingTimestreamPurges'), false);
  });

  it('B13 Hero Names come from the Hero deck id', () => {
    for (const name of NAMES) {
      assert.equal(heroNameOf(`${name}/some-card#3` as CardExtId), name);
    }
  });
});

describe('Go Back in Time — ordering and lockstep (WP-829)', () => {
  it('B14 the Purge pick never offers a Hero of a Purged name', () => {
    const { G, pools } = buildMatch();
    const [purged, sameName] = pools['ca75/agent-x-13']!;
    const others = [pools['ca75/winter-soldier']![0]!, pools['ca75/captain-america-falcon']![0]!];
    G.purgedFromTimestream = [purged!];
    G.hq = [sameName!, others[0]!, others[1]!, null, null];
    G.heroDeck = [pools['ca75/captain-america-1941']![0]!, pools['ca75/captain-america-1941']![1]!];
    twist(G);
    settle(G);
    const optionIds = G.pendingSeatChoice!.seatPrompts['0']!.options.map((option) => option.cardId);
    assert.ok(G.ko.includes(sameName!), 'swept before the pick opened');
    assert.ok(!optionIds.includes(sameName!), 'the swept Hero is not an option');
    assert.deepEqual(optionIds, G.hq.filter((cardId) => cardId !== null), 'every option is still in the HQ');
  });

  it('B15 a pick whose Hero has left the HQ keeps the Purge owed and re-opens it', () => {
    const { G, pools } = buildMatch();
    twist(G);
    settle(G);
    const firstOption = G.pendingSeatChoice!.seatPrompts['0']!.options[0]!.cardId!;
    G.hq = G.hq.map((cardId) => (cardId === firstOption ? pools['ca75/winter-soldier']![5]! : cardId));
    resolveSeatChoice(makeMockMoveContext(G), { optionIndex: 0 });
    assert.equal(G.purgedFromTimestream, undefined, 'nothing was Purged');
    assert.equal(G.pendingTimestreamPurges!.length, 1, 'the Purge is still owed');
    assert.ok(logText(G).some((line) => line.includes('is no longer in the HQ: the Purge is still owed.')));
    settle(G);
    assert.equal(G.pendingSeatChoice!.kind, TIMESTREAM_PURGE_SEAT_CHOICE_KIND, 're-opened');
  });

  it('B16 a Twist records a schemeTwistResolved notable event', () => {
    const { G } = buildMatch();
    twist(G);
    const twistEvent = G.notableEvents.find((event) => event.type === 'schemeTwistResolved');
    assert.ok(twistEvent !== undefined && twistEvent.type === 'schemeTwistResolved');
    assert.equal(twistEvent.resolverKey, 'goBackInTime');
    assert.equal(twistEvent.twistCardId, TWIST_ID);
  });
});
