/**
 * co2e Stealth Assault Squad gates on a S.H.I.E.L.D. Hero that costs 1 or more (WP-825 / D-24758).
 *
 * Nick Fury's Stealth Assault Squad prints "You get +2[icon:attack] if you played another
 * [team:shield] Hero that costs 1 or more this turn." Before this packet the line parsed to a
 * plain `requiresTeam: shield` gate, so one cost-0 S.H.I.E.L.D. Agent or Trooper starter unlocked
 * the +2. The parser now sets `minimumCost: 1` on that gate, and the shared other-card counter
 * honors it: the cost-3 Officer and any costed S.H.I.E.L.D. Hero count, the starters don't.
 *
 * The hooks are built from the committed data/cards/co2e.json and played through
 * executeHeroEffects. The starters carry cost-0 cardStats rows, as the real setup builds them.
 *
 * No boardgame.io imports. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHeroAbilityHooks } from '../setup/heroAbility.setup.js';
import { executeHeroEffects } from './heroEffects.execute.js';
import {
  describeFailedCondition,
  evaluateCondition,
  heroConditionHoldsForInPlay,
} from './heroConditions.evaluate.js';
import type { LegendaryGameState, MatchConfiguration } from '../types.js';
import type { HeroAbilityHook, HeroCondition } from '../rules/heroAbility.types.js';
import type { CardExtId } from '../state/zones.types.js';
import { makeGlobalPiles, makeMastermindState, makePlayerZones, makeTurnEconomy } from '../test/fixtureBuilders.js';

// why: resolve the repo-root data directory from this test's own location (the
// doubledSuperpowerIcon.test.ts precedent), so the tests read the card data that ships.
const CARDS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'data', 'cards');

const SHIELD_AGENT = 'starting-shield-agent';
const SHIELD_TROOPER = 'starting-shield-trooper';
const SHIELD_OFFICER = 'pile-shield-officer';

const mockCtx = {
  ctx: { turn: 1, currentPlayer: '0' },
  random: { Shuffle: <T>(items: T[]): T[] => [...items].reverse() },
};

/**
 * Builds the real hooks for co2e Nick Fury from the committed card data.
 *
 * @returns Every hook the hero deck produces.
 */
function buildNickFuryHooks(): HeroAbilityHook[] {
  const setData = JSON.parse(readFileSync(join(CARDS_DIRECTORY, 'co2e.json'), 'utf8'));
  const registry = { listCards: () => [], getSet: (abbr: string) => (abbr === 'co2e' ? setData : undefined) };
  return buildHeroAbilityHooks(registry, { heroDeckIds: ['co2e/nick-fury'] } as unknown as MatchConfiguration);
}

const hooks = buildNickFuryHooks();
const squadIds = [...new Set(
  hooks.map((hook) => hook.cardId).filter((cardId) => cardId.includes('/stealth-assault-squad#')),
)];
const squadId = squadIds[0]!;
const otherSquadId = squadIds[1]!;

const cardTraits = {
  [squadId]: { heroClass: 'covert', team: 'shield' },
  [otherSquadId]: { heroClass: 'covert', team: 'shield' },
  'avenger-costing-five#0': { heroClass: 'strength', team: 'avengers' },
};
// why: the real setup gives the starters cost-0 rows and the Officer cost 3
// (setup/buildInitialGameState.ts), so a "has a cardStats row" read can't pass these cases.
const cardStats = {
  [squadId]: { cost: 2 },
  [otherSquadId]: { cost: 2 },
  [SHIELD_AGENT]: { cost: 0 },
  [SHIELD_TROOPER]: { cost: 0 },
  [SHIELD_OFFICER]: { cost: 3 },
  'avenger-costing-five#0': { cost: 5 },
};

/**
 * Minimal state for driving executeHeroEffects.
 *
 * @returns A LegendaryGameState sufficient for these tests.
 */
function makeState(): LegendaryGameState {
  return {
    messages: [],
    notableEvents: [],
    counters: {},
    hookRegistry: [],
    turnEconomy: { ...makeTurnEconomy() },
    playerZones: { '0': { ...makePlayerZones(), hand: [], inPlay: [], victory: [] } },
    piles: makeGlobalPiles(),
    mastermind: { ...makeMastermindState(), baseCardId: 'test-mastermind-base' as CardExtId },
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: {},
    cardKeywords: {},
    cardStats,
    cardTraits,
    cardDisplayData: {},
    city: [null, null, null, null, null],
    hq: [null, null, null, null, null],
    ko: [],
    attachedBystanders: {},
    heroAbilityHooks: hooks,
    villainAbilityHooks: [],
  } as unknown as LegendaryGameState;
}

/**
 * Plays Stealth Assault Squad after the given cards and returns the Attack its line granted.
 *
 * @param playedBefore - Cards played earlier this turn.
 * @returns The game state after the play.
 */
function playSquadAfter(playedBefore: string[]): LegendaryGameState {
  const G = makeState();
  G.playerZones['0']!.inPlay = [...(playedBefore as CardExtId[]), squadId as CardExtId];
  executeHeroEffects(G, mockCtx, '0', squadId as CardExtId);
  return G;
}

describe('co2e Stealth Assault Squad — another S.H.I.E.L.D. Hero that costs 1 or more (WP-825)', () => {
  it('parses to one requiresTeam: shield gate with minimumCost 1 and a +2 attack effect', () => {
    const squadHooks = hooks.filter((hook) => hook.cardId === squadId);
    assert.equal(squadHooks.length, 1, 'one printed ability line');
    assert.deepEqual(squadHooks[0]!.conditions, [{ type: 'requiresTeam', value: 'shield', minimumCost: 1 }]);
    assert.deepEqual(squadHooks[0]!.effects, [{ type: 'attack', magnitude: 2 }]);
    // why: the helper mutates the freshly built conditions array, so no two hooks may share a
    // condition object (a later edit pointing it at a shared array would floor other copies' gates).
    const otherCopyHook = hooks.find((hook) => hook.cardId === otherSquadId)!;
    assert.notStrictEqual(squadHooks[0]!.conditions![0], otherCopyHook.conditions![0]);
  });

  it('cost-0 Agent and Trooper starters alone do not unlock the +2', () => {
    const G = playSquadAfter([SHIELD_AGENT, SHIELD_TROOPER, SHIELD_AGENT]);
    assert.equal(G.turnEconomy.attack, 0);
  });

  it('a played S.H.I.E.L.D. Officer (cost 3) unlocks the +2', () => {
    const G = playSquadAfter([SHIELD_AGENT, SHIELD_OFFICER]);
    assert.equal(G.turnEconomy.attack, 2);
  });

  it('another costed S.H.I.E.L.D. Hero (a second Stealth Assault Squad) unlocks the +2', () => {
    const G = playSquadAfter([otherSquadId]);
    assert.equal(G.turnEconomy.attack, 2);
  });

  it('a costed non-S.H.I.E.L.D. Hero does not unlock it, and the card never counts itself', () => {
    assert.equal(playSquadAfter(['avenger-costing-five#0', SHIELD_TROOPER]).turnEconomy.attack, 0);
    assert.equal(playSquadAfter([]).turnEconomy.attack, 0);
  });

  it('the failed-gate log names the cost floor', () => {
    const G = playSquadAfter([SHIELD_AGENT]);
    const logText = JSON.stringify(G.messages);
    assert.match(logText, /it needs another shield Hero that costs 1 or more played this turn/);
  });
});

describe('HeroCondition.minimumCost (WP-825 / D-24758)', () => {
  const flooredGate: HeroCondition = { type: 'requiresTeam', value: 'shield', minimumCost: 1 };
  const plainGate: HeroCondition = { type: 'requiresTeam', value: 'shield' };

  it('a gate without minimumCost still counts the cost-0 starters (unchanged behavior)', () => {
    const G = makeState();
    G.playerZones['0']!.inPlay = [SHIELD_AGENT as CardExtId, squadId as CardExtId];
    assert.equal(evaluateCondition(G, '0', plainGate, squadId as CardExtId), true);
    assert.equal(evaluateCondition(G, '0', flooredGate, squadId as CardExtId), false);
  });

  it('a 0, negative or non-integer minimumCost behaves as no floor', () => {
    const G = makeState();
    G.playerZones['0']!.inPlay = [SHIELD_AGENT as CardExtId, squadId as CardExtId];
    for (const minimumCost of [0, -1, 1.5]) {
      assert.equal(evaluateCondition(G, '0', { ...plainGate, minimumCost }, squadId as CardExtId), true, `minimumCost ${minimumCost}`);
    }
  });

  it('describeFailedCondition keeps the plain wording when there is no floor', () => {
    const G = makeState();
    assert.equal(describeFailedCondition(G, '0', plainGate), 'it needs another shield Hero played this turn');
    assert.equal(
      describeFailedCondition(G, '0', flooredGate),
      'it needs another shield Hero that costs 1 or more played this turn',
    );
    assert.equal(
      describeFailedCondition(G, '0', { ...flooredGate, requiredMatches: 2 }),
      'it needs 2 other shield Heroes that cost 1 or more played this turn',
      'the plural form agrees',
    );
  });

  it('the sequence teacher scopes out a cost-floored gate (its card-data slice has no cardStats)', () => {
    const cardData = { cardTraits, cardSizeChangingClasses: {}, cardCopiedTeams: {}, heroAbilityHooks: hooks };
    assert.equal(
      heroConditionHoldsForInPlay(flooredGate, squadId as CardExtId, [SHIELD_OFFICER as CardExtId], cardData as never),
      'unsupported',
    );
    assert.equal(
      heroConditionHoldsForInPlay(plainGate, squadId as CardExtId, [SHIELD_OFFICER as CardExtId], cardData as never),
      'holds',
      'an unfloored gate is still evaluated',
    );
  });
});
