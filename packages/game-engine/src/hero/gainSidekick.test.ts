/**
 * Gain a Sidekick from the Sidekick Stack (WP-844 / EC-882 / D-24778).
 *
 * Ten hero lines print "Gain a [rule:Sidekick]" / "Gain three [rule:Sidekicks]" (cvwr Captain
 * America Secret Avenger's Inspire a Nation, ssw1 Black Panther's King of Wakanda, ...). The
 * curated `[keyword:gain-sidekick:N]` marker rides the generic parser path, and the
 * `gain-sidekick` handler moves up to N Sidekicks from the top of `G.piles.sidekicks` into the
 * playing player's discard, outside the once-per-turn Sidekick recruit (rules v23 L3216-3218).
 *
 * Parser cases build hooks with buildHeroAbilityHooks on a 1-copy synthetic registry. Handler
 * cases dispatch through executeSingleEffect so the magnitude pre-gate is exercised (T12 and
 * the control run). T8-T10 replicate recruitSidekick.test.ts's file-local createMockGameState
 * so recruitSidekick's guard list sees every field it reads.
 *
 * No boardgame.io imports. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildHeroAbilityHooks } from '../setup/heroAbility.setup.js';
import { executeSingleEffect } from './heroEffects.execute.js';
import { gainSidekickToDiscard } from '../moves/gainSidekick.logic.js';
import { recruitSidekick } from '../moves/recruitSidekick.js';
import { formatCardRef } from '../log/logDisplay.js';
import { SIDEKICK_EXT_ID } from '../setup/pilesInit.js';
import { buildDefaultHookDefinitions } from '../rules/ruleRuntime.impl.js';
import { initializeCity, initializeHq } from '../board/city.logic.js';
import { makeMockMoveContext } from '../test/mockMoveContext.js';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { HeroEffectDescriptor } from '../rules/heroAbility.types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import {
  makeCardStatEntry,
  makeGlobalPiles,
  makeMastermindState,
  makePlayerZones,
  makeTurnEconomy,
} from '../test/fixtureBuilders.js';

const mockCtx = {
  ctx: { turn: 1 },
  random: { Shuffle: <T>(items: T[]): T[] => [...items].reverse() },
};

const INSPIRE_A_NATION = 'cvwr/captain-america-secret-avenger/inspire-a-nation#0' as CardExtId;

// why: real Stack tokens all share SIDEKICK_EXT_ID; distinct marker strings make the
// top-first order observable in the handler cases.
const MARKED_STACK: CardExtId[] = ['sidekick-a', 'sidekick-b', 'sidekick-c'];

const GAIN_ONE: HeroEffectDescriptor = { type: 'gain-sidekick', magnitude: 1 };
const GAIN_THREE: HeroEffectDescriptor = { type: 'gain-sidekick', magnitude: 3 };

// ---------------------------------------------------------------------------
// Parser harness
// ---------------------------------------------------------------------------

/** Minimal 1-copy registry exposing getSet, mirroring the Crazed Rampage parser harness. */
function makeCaptainRegistry(abilityLine: string) {
  const setData = {
    abbr: 'cvwr',
    heroes: [
      {
        slug: 'captain-america-secret-avenger',
        cards: [{ slug: 'inspire-a-nation', rarityLabel: 'Common', abilities: [abilityLine] }],
        physicalCards: [{ id: 'p0', count: 1, sides: ['inspire-a-nation'] }],
      },
    ],
    villains: [], henchmen: [], schemes: [], masterminds: [], bystanders: [], wounds: [], other: [],
  };
  return {
    listCards: () => [],
    listSets: () => [{ abbr: 'cvwr' }],
    getSet: (abbr: string) => (abbr === 'cvwr' ? setData : undefined),
  };
}

/** A match config naming only the cvwr Captain America, Secret Avenger hero deck. */
function makeConfig(): MatchSetupConfig {
  return {
    schemeId: 'test/scheme', mastermindId: 'test/mm',
    villainGroupIds: ['test/vg'], henchmanGroupIds: ['test/hg'],
    heroDeckIds: ['cvwr/captain-america-secret-avenger'],
    bystandersCount: 10, woundsCount: 15, officersCount: 20, sidekicksCount: 12,
  };
}

/** Builds the single Inspire a Nation hook for one printed + marked ability line. */
function buildSingleHook(abilityLine: string) {
  const hooks = buildHeroAbilityHooks(makeCaptainRegistry(abilityLine), makeConfig());
  const captainHooks = hooks.filter((hook) => hook.cardId.includes('inspire-a-nation'));
  assert.equal(captainHooks.length, 1, 'a 1-copy registry yields one Inspire a Nation hook');
  return captainHooks[0]!;
}

// ---------------------------------------------------------------------------
// Handler harness
// ---------------------------------------------------------------------------

/** A minimal game state with a Sidekick Stack and one player, for the handler cases. */
function makeGainState(sidekicks: CardExtId[]): LegendaryGameState {
  return {
    messages: [],
    turnEconomy: makeTurnEconomy(),
    playerZones: { '0': { ...makePlayerZones(), discard: ['starting-shield-agent'] } },
    piles: { ...makeGlobalPiles(), sidekicks: [...sidekicks] },
    mastermind: makeMastermindState(),
    heroAbilityHooks: [],
    cardStats: {},
    cardDisplayData: {},
  } as unknown as LegendaryGameState;
}

/**
 * Replicates recruitSidekick.test.ts's file-local createMockGameState: player 0 is current at
 * the Main stage with the given Recruit, and every field recruitSidekick's guards read exists.
 */
function createMockGameState(recruit: number): LegendaryGameState {
  const config = {
    schemeId: 'test-scheme',
    mastermindId: 'test-mastermind',
    villainGroupIds: ['test-villain-group'],
    henchmanGroupIds: ['test-henchman-group'],
    heroDeckIds: ['test-hero-deck'],
    bystandersCount: 1,
    woundsCount: 1,
    officersCount: 1,
    sidekicksCount: 3,
  };
  return {
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
      '0': { ...makePlayerZones(), deck: [], hand: [], discard: [], inPlay: [], victory: [] },
    },
    piles: { ...makeGlobalPiles(), sidekicks: [SIDEKICK_EXT_ID, SIDEKICK_EXT_ID, SIDEKICK_EXT_ID] },
    messages: [],
    counters: {},
    hookRegistry: buildDefaultHookDefinitions(config),
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: {},
    ko: [],
    attachedBystanders: {},
    turnEconomy: { ...makeTurnEconomy(), recruit },
    cardStats: {
      [SIDEKICK_EXT_ID]: makeCardStatEntry({ cost: 2 }),
      'starting-shield-agent': makeCardStatEntry({ recruit: 1 }),
    },
    cardDisplayData: {
      [SIDEKICK_EXT_ID]: { extId: SIDEKICK_EXT_ID, name: 'Sidekick', imageUrl: '', cost: null },
    },
    mastermind: { ...makeMastermindState(),
      id: 'test-mastermind',
      baseCardId: 'test-mastermind-base',
      tacticsDeck: [],
      tacticsDefeated: [],
    },
    city: initializeCity(),
    hq: initializeHq(),
    heroDeck: [],
    heroAbilityHooks: [],
    hasHealedThisTurn: false,
    // why: createMockGameState omits hasActedThisTurn, and undefined would pass a
    // `!== true` check for the wrong reason; T8 asserts it stays false explicitly.
    hasActedThisTurn: false,
    pendingKoHeroChoices: [],
    lobby: { requiredPlayers: 1, ready: {}, started: false },
  } as unknown as LegendaryGameState;
}

/** The locked `applied` log text for a full gain. */
function appliedLine(G: LegendaryGameState, gainedCount: number): string {
  return `Player 0 gained ${String(gainedCount)} Sidekick(s) from the Sidekick Stack (${formatCardRef(G.cardDisplayData, INSPIRE_A_NATION)}).`;
}

// ---------------------------------------------------------------------------
// Parser (T1-T3)
// ---------------------------------------------------------------------------

describe('gain-sidekick parser (WP-844 / D-24778)', () => {
  it('T1: an unconditional line emits one gain-sidekick effect with magnitude 1 and no hollow', () => {
    const hook = buildSingleHook('Gain a [rule:Sidekick]. [keyword:gain-sidekick:1]');

    assert.deepStrictEqual(hook.effects, [{ type: 'gain-sidekick', magnitude: 1 }]);
    assert.deepStrictEqual(hook.conditions ?? [], [], 'no conditions');
    const unresolvedMarkers = hook.unresolvedMarkers ?? [];
    assert.equal(unresolvedMarkers.some((marker) => marker.includes('sidekick')), false, 'no rule:sidekick hollow');
    assert.deepStrictEqual(unresolvedMarkers, [], 'unresolvedMarkers absent or empty');
  });

  it('T2: a class-gated line keeps its heroClassMatch gate beside the gain', () => {
    const hook = buildSingleHook('[hc:ranged]: Gain a [rule:Sidekick]. [keyword:gain-sidekick:1]');

    assert.deepStrictEqual(hook.effects, [{ type: 'gain-sidekick', magnitude: 1 }]);
    assert.deepStrictEqual(hook.conditions, [{ type: 'heroClassMatch', value: 'ranged' }]);
  });

  it('T3: "Gain three [rule:Sidekicks]" carries magnitude 3', () => {
    const hook = buildSingleHook('Gain three [rule:Sidekicks]. [keyword:gain-sidekick:3]');

    assert.deepStrictEqual(hook.effects, [{ type: 'gain-sidekick', magnitude: 3 }]);
  });
});

// ---------------------------------------------------------------------------
// Handler (T4-T7)
// ---------------------------------------------------------------------------

describe('gain-sidekick handler (WP-844 / D-24778)', () => {
  it('T4: a gain of 1 takes the top Sidekick into discard with one applied line', () => {
    const G = makeGainState(MARKED_STACK);

    const isExecuted = executeSingleEffect(G, mockCtx, '0', INSPIRE_A_NATION, GAIN_ONE);

    assert.equal(isExecuted, true);
    assert.deepStrictEqual(G.piles.sidekicks, ['sidekick-b', 'sidekick-c'], 'the top token left the Stack');
    assert.deepStrictEqual(G.playerZones['0']!.discard, ['starting-shield-agent', 'sidekick-a'], 'discard ends with the top token');
    assert.equal(G.messages.length, 1, 'one log line');
    assert.equal(G.messages[0]!.text, appliedLine(G, 1));
    assert.equal(G.messages[0]!.outcome, 'applied');
    assert.equal(G.messages[0]!.card, INSPIRE_A_NATION);
  });

  it('T5: a gain of 3 on a Stack of 3 takes all three in top-first order', () => {
    const G = makeGainState(MARKED_STACK);

    executeSingleEffect(G, mockCtx, '0', INSPIRE_A_NATION, GAIN_THREE);

    assert.deepStrictEqual(G.piles.sidekicks, [], 'the Stack is empty');
    assert.deepStrictEqual(
      G.playerZones['0']!.discard.slice(-3),
      ['sidekick-a', 'sidekick-b', 'sidekick-c'],
      'discard ends with the three tokens in order',
    );
    assert.equal(G.messages.length, 1, 'one log line');
    assert.equal(G.messages[0]!.text, appliedLine(G, 3));
    assert.equal(G.messages[0]!.outcome, 'applied');
  });

  it('T6: a gain of 3 on a Stack of 2 gains both and logs partial', () => {
    const G = makeGainState(['sidekick-a', 'sidekick-b']);

    executeSingleEffect(G, mockCtx, '0', INSPIRE_A_NATION, GAIN_THREE);

    assert.deepStrictEqual(G.piles.sidekicks, []);
    assert.deepStrictEqual(G.playerZones['0']!.discard.slice(-2), ['sidekick-a', 'sidekick-b']);
    assert.equal(G.messages.length, 1, 'one log line');
    assert.equal(
      G.messages[0]!.text,
      `Player 0 gained 2 of 3 Sidekick(s) — the Sidekick Stack ran out (${formatCardRef(G.cardDisplayData, INSPIRE_A_NATION)}).`,
    );
    assert.equal(G.messages[0]!.outcome, 'partial');
    assert.equal(G.messages[0]!.card, INSPIRE_A_NATION);
  });

  it('T7: an empty Stack is a logged no-op that never throws', () => {
    const G = makeGainState([]);
    const zonesBefore = JSON.stringify(G.playerZones);

    let isExecuted = false;
    assert.doesNotThrow(() => {
      isExecuted = executeSingleEffect(G, mockCtx, '0', INSPIRE_A_NATION, GAIN_ONE);
    });

    assert.equal(isExecuted, true);
    assert.equal(JSON.stringify(G.playerZones), zonesBefore, 'no zone change');
    assert.deepStrictEqual(G.piles.sidekicks, []);
    assert.equal(G.messages.length, 1, 'one log line');
    assert.equal(
      G.messages[0]!.text,
      `Player 0 could not gain a Sidekick — the Sidekick Stack is empty (${formatCardRef(G.cardDisplayData, INSPIRE_A_NATION)}).`,
    );
    assert.equal(G.messages[0]!.outcome, 'blocked');
    assert.equal(G.messages[0]!.card, INSPIRE_A_NATION);
  });
});

// ---------------------------------------------------------------------------
// Recruit independence (T8-T10) — rules v23 L3216-3218
// ---------------------------------------------------------------------------

describe('gain-sidekick is outside the once-per-turn recruit (WP-844 / D-24778)', () => {
  it('T8: a gain spends no Recruit, sets no recruit flag and leaves hasActedThisTurn false', () => {
    const G = createMockGameState(2);
    assert.equal(G.turnEconomy.spentRecruit, 0, 'precondition: nothing spent');
    assert.equal('hasRecruitedSidekickThisTurn' in G.turnEconomy, false, 'precondition: no recruit flag');

    executeSingleEffect(G, mockCtx, '0', INSPIRE_A_NATION, GAIN_ONE);

    assert.equal(G.piles.sidekicks.length, 2, 'the gain happened: the Stack dropped by one');
    assert.deepStrictEqual(G.playerZones['0']!.discard, [SIDEKICK_EXT_ID], 'the gain happened: discard +1');
    assert.equal('hasRecruitedSidekickThisTurn' in G.turnEconomy, false, 'no hasRecruitedSidekickThisTurn key');
    assert.equal(G.turnEconomy.recruit, 2, 'recruit unchanged');
    assert.equal(G.turnEconomy.spentRecruit, 0, 'spentRecruit unchanged');
    assert.equal(G.hasActedThisTurn, false, 'hasActedThisTurn still false');
  });

  it('T9: after a gain, the once-per-turn recruit still succeeds', () => {
    const G = createMockGameState(2);
    executeSingleEffect(G, mockCtx, '0', INSPIRE_A_NATION, GAIN_ONE);

    recruitSidekick(makeMockMoveContext(G));

    assert.equal(G.piles.sidekicks.length, 1, 'the recruit took one more: Stack 3 → 2 → 1');
    assert.deepStrictEqual(G.playerZones['0']!.discard, [SIDEKICK_EXT_ID, SIDEKICK_EXT_ID], 'discard +1 again');
    assert.equal(G.turnEconomy.hasRecruitedSidekickThisTurn, true, 'the recruit set its flag');
  });

  it('T10: a set recruit flag does not block a gain', () => {
    const G = createMockGameState(2);
    recruitSidekick(makeMockMoveContext(G));
    assert.equal(G.turnEconomy.hasRecruitedSidekickThisTurn, true, 'precondition: the recruit happened');

    executeSingleEffect(G, mockCtx, '0', INSPIRE_A_NATION, GAIN_ONE);

    assert.equal(G.piles.sidekicks.length, 1, 'the gain took one more: Stack 3 → 2 → 1');
    assert.deepStrictEqual(G.playerZones['0']!.discard, [SIDEKICK_EXT_ID, SIDEKICK_EXT_ID], 'discard +1 again');
  });
});

// ---------------------------------------------------------------------------
// Helper + pre-gate (T11-T12)
// ---------------------------------------------------------------------------

describe('gainSidekickToDiscard + the magnitude pre-gate (WP-844 / D-24778)', () => {
  it('T11: a missing player zone or an empty Stack returns false with no mutation', () => {
    const missingZone = makeGainState(MARKED_STACK);
    const missingZoneBefore = JSON.stringify(missingZone);
    let missingZoneResult = true;
    assert.doesNotThrow(() => {
      missingZoneResult = gainSidekickToDiscard(missingZone, '7');
    });
    assert.equal(missingZoneResult, false);
    assert.equal(JSON.stringify(missingZone), missingZoneBefore, 'missing zone: no mutation');

    const emptyStack = makeGainState([]);
    const emptyStackBefore = JSON.stringify(emptyStack);
    let emptyStackResult = true;
    assert.doesNotThrow(() => {
      emptyStackResult = gainSidekickToDiscard(emptyStack, '0');
    });
    assert.equal(emptyStackResult, false);
    assert.equal(JSON.stringify(emptyStack), emptyStackBefore, 'empty Stack: no mutation');
  });

  it('T12: control — a gain-sidekick effect with no magnitude is dropped by the pre-gate', () => {
    const G = makeGainState(MARKED_STACK);
    const before = JSON.stringify(G);

    const isExecuted = executeSingleEffect(G, mockCtx, '0', INSPIRE_A_NATION, { type: 'gain-sidekick' });

    assert.equal(isExecuted, false);
    assert.equal(JSON.stringify(G), before, 'no zone change, no log line');
  });
});
