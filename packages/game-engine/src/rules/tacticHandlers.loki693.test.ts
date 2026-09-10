/**
 * Tests for the two core Loki tactic Fight resolvers (WP-693 / EC-730 / D-24510):
 * Cruel Ruler ("Defeat a Villain in the City for free") and Maniacal Tyrant
 * ("KO up to four cards from your discard pile"), plus their dispatch routing.
 *
 * The exactly-1 Cruel Ruler auto-defeat exercises the shared free-defeat core, so
 * this file builds a full LegendaryGameState (mirroring defeatChoice.resolve.test.ts's
 * makeG — the second copy, per "duplicate first, abstract on a third copy").
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  dispatchTacticOnFight,
  resolveCruelRuler,
  resolveManiacalTyrant,
  MANIACAL_TYRANT_KO_MAX,
} from './tacticHandlers.js';
import { hasPendingDefeatChoice } from '../moves/defeatChoice.resolve.js';
import { hasPendingKoDiscardChoice } from '../moves/koDiscardChoice.resolve.js';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { VillainAbilityHook } from '../rules/villainAbility.types.js';
import { LEGACY_VILLAIN_KEYWORD_TO_DESCRIPTOR } from '../rules/villainAbility.types.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { buildDefaultHookDefinitions } from '../rules/ruleRuntime.impl.js';
import { initializeCity, initializeHq } from '../board/city.logic.js';
import { makeGlobalPiles, makeMastermindState, makePlayerZones, makeTurnEconomy } from '../test/fixtureBuilders.js';

const CRUEL_RULER_TACTIC_ID: CardExtId = 'core-mastermind-loki-cruel-ruler';
const MANIACAL_TYRANT_TACTIC_ID: CardExtId = 'core-mastermind-loki-maniacal-tyrant';

// why: a real ShuffleProvider (reverse) — the free-defeat core forwards it for a
// defeated villain's Fight scry reshuffle; reversing proves any shuffle ran.
const SHUFFLE = { random: { Shuffle: <T,>(items: T[]): T[] => [...items].reverse() } };

interface MockGOptions {
  city?: (CardExtId | null)[];
  attachedBystanders?: Record<CardExtId, CardExtId[]>;
  discard?: CardExtId[];
  hand?: CardExtId[];
  villainAbilityHooks?: VillainAbilityHook[];
  attack?: number;
}

/** Creates a full LegendaryGameState for the Loki tactic resolvers. */
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
        discard: (options?.discard ?? []) as LegendaryGameState['playerZones']['0']['discard'],
        inPlay: [],
        victory: [],
      },
      '1': { ...makePlayerZones(), deck: [], hand: [], discard: [], inPlay: [], victory: [] },
    },
    cardTraits: {},
    villainAbilityHooks: options?.villainAbilityHooks ?? [],
    piles: { ...makeGlobalPiles(), bystanders: [], wounds: [], officers: [], sidekicks: [] },
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
      tacticsDeck: [],
      tacticsDefeated: [],
      attachedBystanders: [],
    },
    city: (options?.city as LegendaryGameState['city']) ?? initializeCity(),
    hq: initializeHq(),
    lobby: { requiredPlayers: 1, ready: {}, started: false },
    notableEvents: [],
  } as unknown as LegendaryGameState;
}

/** The bare bgio ctx the free-defeat core reads (currentPlayer). */
const CTX = { currentPlayer: '0' };

/** Builds an onFight villain ability hook for a single legacy keyword. */
function fightHook(cardId: string, keyword: keyof typeof LEGACY_VILLAIN_KEYWORD_TO_DESCRIPTOR): VillainAbilityHook {
  return {
    cardId: cardId as CardExtId,
    timing: 'onFight',
    keywords: [keyword],
    effects: [{ ...LEGACY_VILLAIN_KEYWORD_TO_DESCRIPTOR[keyword] }],
  };
}

// ---------------------------------------------------------------------------
// resolveCruelRuler
// ---------------------------------------------------------------------------

describe('resolveCruelRuler (WP-693 / D-24510)', () => {
  it('0 City Villains → silent no-op (no defeat, no park)', () => {
    const G = makeG({ city: [null, null, null, null, null] });
    resolveCruelRuler(G, CTX, '0', SHUFFLE);
    assert.equal(hasPendingDefeatChoice(G), false);
    assert.deepStrictEqual(G.playerZones['0']!.victory, []);
  });

  it('exactly 1 City Villain → auto-defeat for free (no prompt, no attack spent)', () => {
    const G = makeG({
      city: ['villain-a', null, null, null, null],
      attachedBystanders: { 'villain-a': ['bystander-1'] },
      attack: 5,
    });
    resolveCruelRuler(G, CTX, '0', SHUFFLE);
    assert.equal(hasPendingDefeatChoice(G), false, 'exactly one is auto-resolved (no prompt)');
    assert.equal(G.city[0], null, 'the villain is removed from the City');
    assert.ok(G.playerZones['0']!.victory.includes('villain-a'), 'the villain lands in the victory pile');
    assert.ok(G.playerZones['0']!.victory.includes('bystander-1'), 'the attached Bystander is rescued');
    assert.equal(G.turnEconomy.attack, 5, 'attack unchanged — a free defeat');
    assert.equal(G.turnEconomy.spentAttack, 0, 'no attack spent');
  });

  it('exactly 1 City Villain → fires the villain onFight ability (reuses the fight path)', () => {
    const G = makeG({
      city: ['villain-a', null, null, null, null],
      hand: ['core-hero-m-00', 'core-hero-a-00'] as CardExtId[],
      villainAbilityHooks: [fightHook('villain-a', 'koHeroCurrentPlayer')],
    });
    resolveCruelRuler(G, CTX, '0', SHUFFLE);
    assert.equal(G.pendingKoHeroChoices?.length, 1, 'the defeated villain onFight KO-hero ability fired');
  });

  it('≥2 City Villains → parks a cruel-ruler PendingDefeatChoice for the active player', () => {
    const G = makeG({ city: ['villain-a', null, 'villain-c', null, null] });
    resolveCruelRuler(G, CTX, '0', SHUFFLE);
    assert.equal(hasPendingDefeatChoice(G), true);
    const front = G.pendingDefeatChoices![0]!;
    assert.equal(front.choiceType, 'cruel-ruler');
    assert.equal(front.playerID, '0');
    assert.deepStrictEqual(front.targets, [
      { kind: 'villain', cityIndex: 0, cardId: 'villain-a' },
      { kind: 'villain', cityIndex: 2, cardId: 'villain-c' },
    ]);
    assert.equal(G.city[0], 'villain-a', 'no villain is defeated yet — the choice is parked');
  });
});

// ---------------------------------------------------------------------------
// resolveManiacalTyrant
// ---------------------------------------------------------------------------

describe('resolveManiacalTyrant (WP-693 / D-24510)', () => {
  it('MANIACAL_TYRANT_KO_MAX is 4 (the printed "up to four")', () => {
    assert.equal(MANIACAL_TYRANT_KO_MAX, 4);
  });

  it('empty discard → silent no-op (no park)', () => {
    const G = makeG({ discard: [] });
    resolveManiacalTyrant(G, '0');
    assert.equal(hasPendingKoDiscardChoice(G), false);
  });

  it('non-empty discard → parks a ko-from-discard PendingKoDiscardChoice (cap 4) for the active player', () => {
    const G = makeG({ discard: ['a', 'b', 'c'] });
    resolveManiacalTyrant(G, '0');
    assert.equal(hasPendingKoDiscardChoice(G), true);
    const front = G.pendingKoDiscardChoices![0]!;
    assert.equal(front.choiceType, 'ko-from-discard');
    assert.equal(front.playerID, '0');
    assert.equal(front.maxCount, MANIACAL_TYRANT_KO_MAX);
    assert.deepStrictEqual(G.playerZones['0']!.discard, ['a', 'b', 'c'], 'nothing is KO\'d yet — the choice is parked');
  });
});

// ---------------------------------------------------------------------------
// dispatchTacticOnFight routing (WP-693 / D-24510)
// ---------------------------------------------------------------------------

describe('dispatchTacticOnFight — Loki tactic routing (WP-693 / D-24510)', () => {
  it('routes the Cruel Ruler id to the free-defeat resolver', () => {
    const G = makeG({ city: ['villain-a', null, 'villain-c', null, null] });
    dispatchTacticOnFight(G, CTX, CRUEL_RULER_TACTIC_ID, SHUFFLE);
    assert.equal(hasPendingDefeatChoice(G), true, 'Cruel Ruler parked a defeat choice (≥2 City Villains)');
    assert.equal(G.pendingDefeatChoices![0]!.choiceType, 'cruel-ruler');
  });

  it('routes the Maniacal Tyrant id to the KO-from-discard resolver', () => {
    const G = makeG({ discard: ['a', 'b'] });
    dispatchTacticOnFight(G, CTX, MANIACAL_TYRANT_TACTIC_ID, SHUFFLE);
    assert.equal(hasPendingKoDiscardChoice(G), true, 'Maniacal Tyrant parked a KO-from-discard choice');
  });

  it('an unknown tactic id remains a silent no-op (never throws, no park)', () => {
    const G = makeG({ city: ['villain-a', null, 'villain-c', null, null], discard: ['a', 'b'] });
    dispatchTacticOnFight(G, CTX, 'core-mastermind-loki-vanishing-illusions', SHUFFLE);
    assert.equal(hasPendingDefeatChoice(G), false);
    assert.equal(hasPendingKoDiscardChoice(G), false);
  });
});
