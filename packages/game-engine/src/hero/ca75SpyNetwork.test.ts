/**
 * ca75 Agent X-13 "Spy Network" — the printed choose-one (D-24696).
 *
 * "Choose one: Gain a S.H.I.E.L.D. Officer, or you get +2[icon:attack]." Before D-24696 the
 * line's [icon:attack] auto-promoted to a flat +2 attack on every play and the Officer option
 * was never offered. The curated markers ([keyword:gain-officer] [keyword:attack:2]) now fold
 * the line into ONE count-scaled-choose effect that parks a PendingCountScaledChoice; the
 * resolveCountScaledChoice move applies exactly the chosen option.
 *
 * Covers: play parks the choice and grants nothing; the Officer option moves officers[0] to
 * the discard pile (no attack); the attack option grants +2 (no Officer); an empty Officer
 * stack makes the Officer option a logged no-op that never throws; the bot (getLegalMoves
 * short-circuit) takes the +2 attack. Line 1 ([hc:covert]: Woman Out of Time) is out of
 * scope (WP-803). Uses node:test + node:assert only.
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { buildHeroAbilityHooks } from '../setup/heroAbility.setup.js';
import { executeHeroEffects } from './heroEffects.execute.js';
import { resolveCountScaledChoice } from '../moves/countScaledChoice.resolve.js';
import { getLegalMoves } from '../simulation/ai.legalMoves.js';
import type { LegendaryGameState } from '../types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import {
  makeGlobalPiles,
  makeMastermindState,
  makePlayerZones,
  makeTurnEconomy,
} from '../test/fixtureBuilders.js';

// why: the exact generated ca75 ability lines (data/cards/ca75.json after the
// hero-ability-markers pass appends the two D-24696 option markers to line 0).
const SPY_NETWORK_CHOICE_LINE =
  'Choose one: Gain a S.H.I.E.L.D. Officer, or you get +2[icon:attack]. [keyword:gain-officer] [keyword:attack:2]';
const SPY_NETWORK_COVERT_LINE = '[hc:covert]: [keyword:Woman Out of Time]';

const SPY_NETWORK_ID = 'ca75/agent-x-13/spy-network#0';
const OFFICER = 'pile-shield-officer';

/** Builds a minimal getSet registry holding the ca75 Agent X-13 Spy Network card. */
function makeRegistry(): unknown {
  const cards = [
    { slug: 'spy-network', abilities: [SPY_NETWORK_CHOICE_LINE, SPY_NETWORK_COVERT_LINE] },
  ];
  const setData = {
    abbr: 'ca75',
    heroes: [{ slug: 'agent-x-13', cards, physicalCards: [{ id: 'p0', count: 1, sides: ['spy-network'] }] }],
    villains: [],
    henchmen: [],
    schemes: [],
    masterminds: [],
    bystanders: [],
    wounds: [],
    other: [],
  };
  return {
    listCards: () => [],
    listSets: () => [{ abbr: 'ca75' }],
    getSet: (abbr: string) => (abbr === 'ca75' ? setData : undefined),
  };
}

/** A valid mock MatchSetupConfig selecting the ca75 Agent X-13 hero deck. */
function makeConfig(): MatchSetupConfig {
  return {
    schemeId: 'test/test-scheme',
    mastermindId: 'test/test-mastermind',
    villainGroupIds: ['test/villain-001'],
    henchmanGroupIds: ['test/henchman-001'],
    heroDeckIds: ['ca75/agent-x-13'],
    bystandersCount: 10,
    woundsCount: 15,
    officersCount: 20,
    sidekicksCount: 5,
  };
}

/** Parses the real marked ability lines into the Spy Network hooks. */
function spyNetworkHooks(): HeroAbilityHook[] {
  const hooks = buildHeroAbilityHooks(makeRegistry(), makeConfig());
  const cardHooks = hooks.filter((candidate) => candidate.cardId === SPY_NETWORK_ID);
  assert.equal(cardHooks.length, 2, 'one hook per printed ability line');
  return cardHooks;
}

/**
 * One-player state with Spy Network in play (the only card played this turn, so the
 * [hc:covert] line's class gate is unmet) and the given Officer stack.
 *
 * @param officers - The S.H.I.E.L.D. Officer stack (top = index 0).
 */
function makeState(officers: string[]): LegendaryGameState {
  return {
    messages: [],
    currentStage: 'main',
    turnEconomy: { ...makeTurnEconomy() },
    playerZones: {
      '0': { ...makePlayerZones(), deck: [], hand: [], discard: ['starting-shield-agent'], inPlay: [SPY_NETWORK_ID], victory: [] },
    },
    piles: { ...makeGlobalPiles(), officers: [...officers] },
    mastermind: makeMastermindState(),
    heroAbilityHooks: spyNetworkHooks(),
    cardTraits: { [SPY_NETWORK_ID]: { heroClass: 'covert' } },
    cardStats: {},
    cardKeywords: {},
    cardDisplayData: {},
    hq: [null, null, null, null, null],
    city: [null, null, null, null, null],
    ko: [],
  } as unknown as LegendaryGameState;
}

const heroCtx = {
  ctx: { turn: 1 },
  random: { Shuffle: <T>(items: T[]): T[] => [...items].reverse() },
};

/** Builds a move context for resolveCountScaledChoice as player '0'. */
function moveContext(G: LegendaryGameState): Parameters<typeof resolveCountScaledChoice>[0] {
  return {
    G,
    ctx: { numPlayers: 1, currentPlayer: '0', phase: 'play', turn: 1, playOrder: ['0'], playOrderPos: 0 },
    events: { endTurn: mock.fn(), setPhase: mock.fn() },
    random: { Shuffle: <T>(items: T[]): T[] => [...items].reverse() },
    log: {},
    playerID: '0',
  } as unknown as Parameters<typeof resolveCountScaledChoice>[0];
}

/** Plays Spy Network (fires its hero effects) and returns the state with the choice parked. */
function playSpyNetwork(officers: string[]): LegendaryGameState {
  const gameState = makeState(officers);
  executeHeroEffects(gameState, heroCtx, '0', SPY_NETWORK_ID);
  return gameState;
}

describe('ca75 Agent X-13 Spy Network — printed choose-one (D-24696)', () => {
  it('playing it parks ONE choice (gain-officer, flat-attack 2) and grants nothing yet', () => {
    const gameState = playSpyNetwork([OFFICER, OFFICER]);
    assert.deepEqual(gameState.pendingCountScaledChoice, [{
      playerID: '0',
      cardId: SPY_NETWORK_ID,
      options: [{ kind: 'gain-officer' }, { kind: 'flat-attack', magnitude: 2 }],
    }]);
    assert.equal(gameState.turnEconomy.attack, 0, 'no +2 attack auto-grant at play time');
    assert.deepEqual(gameState.piles.officers, [OFFICER, OFFICER], 'no Officer gained at play time');
    assert.deepEqual(gameState.playerZones['0']!.discard, ['starting-shield-agent']);
  });

  it('choosing the Officer moves officers[0] to the discard pile and grants no attack', () => {
    const gameState = playSpyNetwork(['officer-top', 'officer-next']);
    resolveCountScaledChoice(moveContext(gameState), { optionIndex: 0 });
    assert.deepEqual(gameState.playerZones['0']!.discard, ['starting-shield-agent', 'officer-top']);
    assert.deepEqual(gameState.piles.officers, ['officer-next']);
    assert.deepEqual(gameState.playerZones['0']!.hand, [], 'gain lands in discard, not hand');
    assert.equal(gameState.turnEconomy.attack, 0, 'the Officer option grants no attack');
    assert.deepEqual(gameState.pendingCountScaledChoice, [], 'the choice is popped');
  });

  it('choosing +2 attack grants exactly 2 attack and gains no Officer', () => {
    const gameState = playSpyNetwork([OFFICER, OFFICER]);
    resolveCountScaledChoice(moveContext(gameState), { optionIndex: 1 });
    assert.equal(gameState.turnEconomy.attack, 2);
    assert.deepEqual(gameState.piles.officers, [OFFICER, OFFICER], 'the Officer stack is untouched');
    assert.deepEqual(gameState.playerZones['0']!.discard, ['starting-shield-agent']);
    assert.deepEqual(gameState.pendingCountScaledChoice, [], 'the choice is popped');
  });

  it('an empty Officer stack makes the Officer option a logged no-op — never throws', () => {
    const gameState = playSpyNetwork([]);
    assert.doesNotThrow(() => resolveCountScaledChoice(moveContext(gameState), { optionIndex: 0 }));
    assert.deepEqual(gameState.playerZones['0']!.discard, ['starting-shield-agent'], 'nothing gained');
    assert.deepEqual(gameState.piles.officers, []);
    assert.equal(gameState.turnEconomy.attack, 0);
    assert.deepEqual(gameState.pendingCountScaledChoice, [], 'the choice still resolves (popped)');
    const lastMessage = gameState.messages[gameState.messages.length - 1];
    assert.match(JSON.stringify(lastMessage), /Officer stack is empty/);
  });

  it('the bot (getLegalMoves short-circuit) resolves it by taking the +2 attack', () => {
    const gameState = playSpyNetwork([OFFICER]);
    const legalMoves = getLegalMoves(gameState, { phase: 'play', turn: 1, currentPlayer: '0', numPlayers: 1 });
    assert.deepEqual(legalMoves, [{ name: 'resolveCountScaledChoice', args: { optionIndex: 1 } }]);
  });
});
