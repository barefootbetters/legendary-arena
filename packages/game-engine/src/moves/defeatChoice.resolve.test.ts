/**
 * Tests for the defeat-with-a-Bystander vertical (WP-486 / EC-521 / D-24291):
 * the eligible-target builder, the shared dispatcher, hasPendingDefeatChoice, and
 * the resolveDefeatChoice move (front-pop-before-dispatch + nested-pending FIFO).
 *
 * Uses node:test and node:assert only. Uses makeMockCtx. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDefeatWithBystanderTargets,
  buildCityVillainDefeatTargets,
  dispatchDefeatWithBystanderTarget,
  hasPendingDefeatChoice,
  resolveDefeatChoice,
} from './defeatChoice.resolve.js';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { VillainAbilityHook } from '../rules/villainAbility.types.js';
import { LEGACY_VILLAIN_KEYWORD_TO_DESCRIPTOR } from '../rules/villainAbility.types.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { buildDefaultHookDefinitions } from '../rules/ruleRuntime.impl.js';
import { initializeCity, initializeHq } from '../board/city.logic.js';
import { makeGlobalPiles, makeMastermindState, makePlayerZones, makeTurnEconomy } from '../test/fixtureBuilders.js';

// ---------------------------------------------------------------------------
// Mock G factory
// ---------------------------------------------------------------------------

interface MockGOptions {
  city?: (CardExtId | null)[];
  attachedBystanders?: Record<CardExtId, CardExtId[]>;
  hand?: CardExtId[];
  inPlay?: CardExtId[];
  bystandersSupply?: CardExtId[];
  villainAbilityHooks?: VillainAbilityHook[];
  mastermindAttachedBystanders?: CardExtId[];
  mastermindTacticsDeck?: CardExtId[];
  attack?: number;
  pendingDefeatChoices?: LegendaryGameState['pendingDefeatChoices'];
}

/** Creates a minimal LegendaryGameState for defeat-choice tests. */
function makeG(options?: MockGOptions): LegendaryGameState {
  const config = {
    schemeId: 'test-scheme',
    mastermindId: 'test-mastermind',
    villainGroupIds: ['test-villain-group'],
    henchmanGroupIds: ['test-henchman-group'],
    heroDeckIds: ['test-hero-deck'],
    bystandersCount: 1,
    woundsCount: 1,
    officersCount: 1,
    sidekicksCount: 1,
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
      '0': { ...makePlayerZones(),
        deck: [],
        hand: (options?.hand ?? []) as LegendaryGameState['playerZones']['0']['hand'],
        discard: [],
        inPlay: (options?.inPlay ?? []) as LegendaryGameState['playerZones']['0']['inPlay'],
        victory: [],
      },
      '1': { ...makePlayerZones(), deck: [], hand: [], discard: [], inPlay: [], victory: [] },
    },
    cardTraits: {},
    villainAbilityHooks: options?.villainAbilityHooks ?? [],
    piles: { ...makeGlobalPiles(),
      bystanders: (options?.bystandersSupply ?? []) as CardExtId[],
      wounds: [],
      officers: [],
      sidekicks: [],
    },
    messages: [],
    counters: {},
    hookRegistry: buildDefaultHookDefinitions(config),
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: {},
    ko: [],
    attachedBystanders: options?.attachedBystanders ?? {},
    villainAttachedHeroes: {},
    turnEconomy: { ...makeTurnEconomy(), attack: options?.attack ?? 0, recruit: 0, spentAttack: 0, spentRecruit: 0 },
    cardStats: {},
    mastermind: { ...makeMastermindState(),
      id: 'test-mastermind',
      baseCardId: 'test-mastermind-base',
      tacticsDeck: (options?.mastermindTacticsDeck ?? []) as CardExtId[],
      tacticsDefeated: [],
      attachedBystanders: (options?.mastermindAttachedBystanders ?? []) as CardExtId[],
    },
    city: (options?.city as LegendaryGameState['city']) ?? initializeCity(),
    hq: initializeHq(),
    lobby: { requiredPlayers: 1, ready: {}, started: false },
    notableEvents: [],
    ...(options?.pendingDefeatChoices ? { pendingDefeatChoices: options.pendingDefeatChoices } : {}),
  };
}

/** A move context carrying the bare bgio ctx with a real currentPlayer + turn. */
function makeMoveContext(gameState: LegendaryGameState) {
  const mockCtx = makeMockCtx({ numPlayers: 2 });
  return {
    G: gameState,
    ctx: { ...mockCtx.ctx, currentPlayer: '0', turn: 1, phase: 'play' },
    random: mockCtx.random,
    events: { endTurn: () => {}, setPhase: () => {}, endGame: () => {} },
    playerID: '0' as string,
    log: { setMetadata: () => {} },
  };
}

/** Builds an onFight villain ability hook for a single legacy keyword. */
function fightHook(
  cardId: string,
  keyword: keyof typeof LEGACY_VILLAIN_KEYWORD_TO_DESCRIPTOR,
): VillainAbilityHook {
  return {
    cardId: cardId as CardExtId,
    timing: 'onFight',
    keywords: [keyword],
    effects: [{ ...LEGACY_VILLAIN_KEYWORD_TO_DESCRIPTOR[keyword] }],
  };
}

// ---------------------------------------------------------------------------
// buildDefeatWithBystanderTargets
// ---------------------------------------------------------------------------

describe('buildDefeatWithBystanderTargets (WP-486 / D-24291)', () => {
  it('returns 0 targets when no Villain and no Mastermind holds a Bystander', () => {
    const G = makeG({ city: ['villain-a', null, null, null, null] });
    assert.deepStrictEqual(buildDefeatWithBystanderTargets(G), []);
  });

  it('a City Villain with an attached Bystander is one villain target', () => {
    const G = makeG({
      city: ['villain-a', null, null, null, null],
      attachedBystanders: { 'villain-a': ['bystander-1'] },
    });
    assert.deepStrictEqual(buildDefeatWithBystanderTargets(G), [
      { kind: 'villain', cityIndex: 0, cardId: 'villain-a' },
    ]);
  });

  it('a City Villain with an EMPTY attached-Bystander list is NOT a target', () => {
    const G = makeG({
      city: ['villain-a', null, null, null, null],
      attachedBystanders: { 'villain-a': [] },
    });
    assert.deepStrictEqual(buildDefeatWithBystanderTargets(G), []);
  });

  it('builds targets City-ascending, then the Mastermind LAST (deterministic order)', () => {
    const G = makeG({
      city: ['villain-a', null, 'villain-c', null, null],
      attachedBystanders: { 'villain-c': ['bystander-2'], 'villain-a': ['bystander-1'] },
      mastermindAttachedBystanders: ['bystander-m'],
      mastermindTacticsDeck: ['tactic-1', 'tactic-2'],
    });
    assert.deepStrictEqual(buildDefeatWithBystanderTargets(G), [
      { kind: 'villain', cityIndex: 0, cardId: 'villain-a' },
      { kind: 'villain', cityIndex: 2, cardId: 'villain-c' },
      { kind: 'mastermind', cardId: 'test-mastermind-base' },
    ]);
  });

  it('the Mastermind is NOT a target when it holds a Bystander but has no tactic left', () => {
    const G = makeG({
      mastermindAttachedBystanders: ['bystander-m'],
      mastermindTacticsDeck: [],
    });
    assert.deepStrictEqual(buildDefeatWithBystanderTargets(G), []);
  });
});

// ---------------------------------------------------------------------------
// buildCityVillainDefeatTargets — Cruel Ruler (WP-693 / D-24510)
// ---------------------------------------------------------------------------

describe('buildCityVillainDefeatTargets (WP-693 / D-24510)', () => {
  it('returns 0 targets when the City is empty', () => {
    const G = makeG({ city: [null, null, null, null, null] });
    assert.deepStrictEqual(buildCityVillainDefeatTargets(G), []);
  });

  it('returns every occupied City space (NO Bystander requirement), City-ascending', () => {
    const G = makeG({ city: ['villain-a', null, 'villain-c', null, 'villain-e'] });
    assert.deepStrictEqual(buildCityVillainDefeatTargets(G), [
      { kind: 'villain', cityIndex: 0, cardId: 'villain-a' },
      { kind: 'villain', cityIndex: 2, cardId: 'villain-c' },
      { kind: 'villain', cityIndex: 4, cardId: 'villain-e' },
    ]);
  });

  it('includes a City Villain with NO attached Bystander (unlike buildDefeatWithBystanderTargets)', () => {
    const G = makeG({ city: ['villain-a', null, null, null, null] });
    assert.deepStrictEqual(buildCityVillainDefeatTargets(G), [
      { kind: 'villain', cityIndex: 0, cardId: 'villain-a' },
    ]);
  });

  it('never offers the Mastermind, even when it holds a Bystander with tactics left', () => {
    const G = makeG({
      city: ['villain-a', null, null, null, null],
      mastermindAttachedBystanders: ['bystander-m'],
      mastermindTacticsDeck: ['tactic-1'],
    });
    const targets = buildCityVillainDefeatTargets(G);
    assert.ok(targets.every((target) => target.kind === 'villain'), 'no Mastermind target');
    assert.equal(targets.length, 1);
  });
});

// ---------------------------------------------------------------------------
// hasPendingDefeatChoice
// ---------------------------------------------------------------------------

describe('hasPendingDefeatChoice (WP-486 / D-24291)', () => {
  it('reflects the queue: undefined → false, empty → false, non-empty → true', () => {
    assert.equal(hasPendingDefeatChoice(makeG()), false);
    assert.equal(hasPendingDefeatChoice(makeG({ pendingDefeatChoices: [] })), false);
    assert.equal(
      hasPendingDefeatChoice(
        makeG({
          pendingDefeatChoices: [
            { choiceType: 'defeat-with-bystander', playerID: '0', targets: [{ kind: 'mastermind', cardId: 'm' }] },
          ],
        }),
      ),
      true,
    );
  });
});

// ---------------------------------------------------------------------------
// dispatchDefeatWithBystanderTarget — the shared defeat (no attack spend)
// ---------------------------------------------------------------------------

describe('dispatchDefeatWithBystanderTarget (WP-486 / D-24291)', () => {
  it('defeats a City Villain, rescues its Bystander, and spends NO attack', () => {
    const G = makeG({
      city: ['villain-a', null, null, null, null],
      attachedBystanders: { 'villain-a': ['bystander-1'] },
      attack: 5,
    });
    const context = makeMoveContext(G);

    dispatchDefeatWithBystanderTarget(G, context.ctx, { kind: 'villain', cityIndex: 0, cardId: 'villain-a' }, { random: context.random });

    assert.equal(G.city[0], null, 'the villain is removed from the City');
    assert.ok(G.playerZones['0']!.victory.includes('villain-a'), 'the villain is in the victory pile');
    assert.ok(G.playerZones['0']!.victory.includes('bystander-1'), 'the attached Bystander is rescued to the victory pile');
    assert.equal(G.attachedBystanders['villain-a'], undefined, 'the attachment mapping entry is cleared');
    assert.equal(G.turnEconomy.attack, 5, 'attack is unchanged — the defeat spends none');
    assert.equal(G.turnEconomy.spentAttack, 0, 'no attack was spent');
  });

  it('a City Villain defeat fires the villain onFight abilities (reuses the fight path)', () => {
    const G = makeG({
      city: ['villain-a', null, null, null, null],
      attachedBystanders: { 'villain-a': ['bystander-1'] },
      hand: ['core-hero-m-00', 'core-hero-a-00'] as CardExtId[],
      villainAbilityHooks: [fightHook('villain-a', 'koHeroCurrentPlayer')],
    });
    const context = makeMoveContext(G);

    dispatchDefeatWithBystanderTarget(G, context.ctx, { kind: 'villain', cityIndex: 0, cardId: 'villain-a' }, { random: context.random });

    assert.equal(G.pendingKoHeroChoices?.length, 1, 'the villain onFight KO-hero ability fired and parked a choice');
  });

  it('defeats a Mastermind tactic, rescues the Mastermind Bystanders, and spends NO attack', () => {
    const G = makeG({
      mastermindAttachedBystanders: ['bystander-m1', 'bystander-m2'],
      mastermindTacticsDeck: ['tactic-1', 'tactic-2'],
      attack: 7,
    });
    const context = makeMoveContext(G);

    dispatchDefeatWithBystanderTarget(G, context.ctx, { kind: 'mastermind', cardId: 'test-mastermind-base' }, { random: context.random });

    assert.ok(G.playerZones['0']!.victory.includes('tactic-1'), 'the defeated tactic is in the victory pile');
    assert.ok(G.playerZones['0']!.victory.includes('bystander-m1'), 'a rescued Mastermind Bystander is in the victory pile');
    assert.ok(G.playerZones['0']!.victory.includes('bystander-m2'), 'both rescued Mastermind Bystanders are in the victory pile');
    assert.deepStrictEqual(G.mastermind.attachedBystanders, [], 'the Mastermind Bystander store is cleared');
    assert.equal(G.mastermind.tacticsDeck.length, 1, 'exactly one tactic was defeated');
    assert.equal(G.turnEconomy.attack, 7, 'attack is unchanged — the defeat spends none');
  });
});

// ---------------------------------------------------------------------------
// resolveDefeatChoice
// ---------------------------------------------------------------------------

describe('resolveDefeatChoice (WP-486 / D-24291)', () => {
  function parkedVillainAndMastermind(): LegendaryGameState['pendingDefeatChoices'] {
    return [
      {
        choiceType: 'defeat-with-bystander',
        playerID: '0',
        targets: [
          { kind: 'villain', cityIndex: 0, cardId: 'villain-a' },
          { kind: 'mastermind', cardId: 'test-mastermind-base' },
        ],
      },
    ];
  }

  it('defeats the chosen Villain and front-pops the pending entry', () => {
    const G = makeG({
      city: ['villain-a', null, null, null, null],
      attachedBystanders: { 'villain-a': ['bystander-1'] },
      mastermindAttachedBystanders: ['bystander-m'],
      mastermindTacticsDeck: ['tactic-1', 'tactic-2'],
      pendingDefeatChoices: parkedVillainAndMastermind(),
    });
    const context = makeMoveContext(G);

    resolveDefeatChoice(context as never, { targetKind: 'villain', cityIndex: 0 });

    assert.equal(G.city[0], null, 'the chosen villain is defeated');
    assert.ok(G.playerZones['0']!.victory.includes('villain-a'), 'the villain is in the victory pile');
    assert.equal(hasPendingDefeatChoice(G), false, 'the pending defeat choice is front-popped');
    assert.equal(G.mastermind.tacticsDeck.length, 2, 'the un-chosen Mastermind target is untouched');
  });

  it('defeats the chosen Mastermind tactic', () => {
    const G = makeG({
      city: ['villain-a', null, null, null, null],
      attachedBystanders: { 'villain-a': ['bystander-1'] },
      mastermindAttachedBystanders: ['bystander-m'],
      mastermindTacticsDeck: ['tactic-1', 'tactic-2'],
      pendingDefeatChoices: parkedVillainAndMastermind(),
    });
    const context = makeMoveContext(G);

    resolveDefeatChoice(context as never, { targetKind: 'mastermind' });

    assert.equal(G.mastermind.tacticsDeck.length, 1, 'the chosen Mastermind tactic is defeated');
    assert.equal(G.city[0], 'villain-a', 'the un-chosen villain is untouched');
    assert.equal(hasPendingDefeatChoice(G), false, 'the pending defeat choice is front-popped');
  });

  it('front-pops the defeat entry BEFORE dispatch so a nested onFight KO-hero park lands behind it (FIFO)', () => {
    const G = makeG({
      city: ['villain-a', null, null, null, null],
      attachedBystanders: { 'villain-a': ['bystander-1'] },
      hand: ['core-hero-m-00', 'core-hero-a-00'] as CardExtId[],
      villainAbilityHooks: [fightHook('villain-a', 'koHeroCurrentPlayer')],
      pendingDefeatChoices: [
        {
          choiceType: 'defeat-with-bystander',
          playerID: '0',
          targets: [
            { kind: 'villain', cityIndex: 0, cardId: 'villain-a' },
            { kind: 'villain', cityIndex: 2, cardId: 'villain-c' },
          ],
        },
      ],
    });
    const context = makeMoveContext(G);

    resolveDefeatChoice(context as never, { targetKind: 'villain', cityIndex: 0 });

    assert.equal(hasPendingDefeatChoice(G), false, 'the defeat entry is popped first (not still pending behind the nested park)');
    assert.equal(G.pendingKoHeroChoices?.length, 1, 'the villain onFight KO-hero park landed behind the popped defeat entry (FIFO)');
  });

  it('is a silent no-op for a bad targetKind, a wrong player, an empty queue, and a target not in the parked set', () => {
    // bad targetKind
    const badKind = makeG({ pendingDefeatChoices: parkedVillainAndMastermind(), city: ['villain-a', null, null, null, null], attachedBystanders: { 'villain-a': ['b'] } });
    resolveDefeatChoice(makeMoveContext(badKind) as never, { targetKind: 'nonsense' as never });
    assert.equal(hasPendingDefeatChoice(badKind), true, 'bad targetKind leaves the queue intact');

    // wrong player
    const wrongPlayer = makeG({ pendingDefeatChoices: parkedVillainAndMastermind(), city: ['villain-a', null, null, null, null], attachedBystanders: { 'villain-a': ['b'] } });
    const wrongCtx = makeMoveContext(wrongPlayer);
    wrongCtx.playerID = '1';
    resolveDefeatChoice(wrongCtx as never, { targetKind: 'villain', cityIndex: 0 });
    assert.equal(hasPendingDefeatChoice(wrongPlayer), true, 'a non-owner resolve leaves the queue intact');

    // empty queue
    const emptyQueue = makeG();
    resolveDefeatChoice(makeMoveContext(emptyQueue) as never, { targetKind: 'mastermind' });
    assert.equal(hasPendingDefeatChoice(emptyQueue), false, 'an empty queue stays empty (no throw)');

    // target not in the parked set (cityIndex 3 was never eligible)
    const notInSet = makeG({ pendingDefeatChoices: parkedVillainAndMastermind(), city: ['villain-a', null, null, null, null], attachedBystanders: { 'villain-a': ['b'] } });
    resolveDefeatChoice(makeMoveContext(notInSet) as never, { targetKind: 'villain', cityIndex: 3 });
    assert.equal(hasPendingDefeatChoice(notInSet), true, 'a target not in the parked set leaves the queue intact (resubmit)');
    assert.equal(notInSet.city[0], 'villain-a', 'no villain was defeated on the rejected submission');
  });

  it('accepts a "cruel-ruler" front entry and defeats the chosen City Villain for free (WP-693 / D-24510)', () => {
    const G = makeG({
      city: ['villain-a', null, 'villain-c', null, null],
      attack: 4,
      pendingDefeatChoices: [
        {
          choiceType: 'cruel-ruler',
          playerID: '0',
          targets: [
            { kind: 'villain', cityIndex: 0, cardId: 'villain-a' },
            { kind: 'villain', cityIndex: 2, cardId: 'villain-c' },
          ],
        },
      ],
    });
    const context = makeMoveContext(G);

    resolveDefeatChoice(context as never, { targetKind: 'villain', cityIndex: 2 });

    assert.equal(hasPendingDefeatChoice(G), false, 'the cruel-ruler entry is popped on success');
    assert.equal(G.city[2], null, 'the chosen City Villain is removed');
    assert.ok(G.playerZones['0']!.victory.includes('villain-c'), 'the chosen villain is in the victory pile');
    assert.equal(G.turnEconomy.attack, 4, 'attack unchanged — Cruel Ruler is a free defeat');
    assert.equal(G.turnEconomy.spentAttack, 0, 'no attack spent');
  });

  it('a "cruel-ruler" front entry rejects a target not in the parked snapshot (queue intact)', () => {
    const G = makeG({
      city: ['villain-a', null, null, null, null],
      pendingDefeatChoices: [
        {
          choiceType: 'cruel-ruler',
          playerID: '0',
          targets: [{ kind: 'villain', cityIndex: 0, cardId: 'villain-a' }],
        },
      ],
    });
    resolveDefeatChoice(makeMoveContext(G) as never, { targetKind: 'villain', cityIndex: 3 });
    assert.equal(hasPendingDefeatChoice(G), true, 'a target not in the snapshot leaves the queue intact');
    assert.equal(G.city[0], 'villain-a', 'no villain was defeated on the rejected submission');
  });
});
