/**
 * The bkwd Taskmaster's Thunderbolts do what they print (WP-903 / D-24860).
 *
 * Parse coverage builds the REAL villain hooks from the committed `data/cards/bkwd.json`; the
 * behavioural tests fire the executor handlers inline, drive the fight-pick seam (queue → opener →
 * apply → chain) directly, and run the two fire-site bridges (Jester's Fight reveal-and-play and
 * Bullseye's Escape KO). No boardgame.io imports — node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildVillainAbilityHooks } from '../setup/villainAbility.setup.js';
import { executeVillainAbilitiesWithNarrative } from './villainEffects.execute.js';
import { resolveFightCost } from '../economy/economy.resolve.js';
import {
  queueVillainFightPick,
  openVillainFightPickSeatChoiceIfNeeded,
  applyVillainFightPickResolvedSeatChoice,
  chainVillainFightPick,
  isVillainFightPickKind,
  ENTER_CITY_HENCHMAN_FROM_VICTORY_KIND,
} from '../moves/villainFightPick.logic.js';
import { runVillainFightFireSiteBridges } from '../moves/fightVillain.js';
import { resolveVillainEscape } from '../villainDeck/villainDeck.reveal.js';
import { DEFAULT_IMPLEMENTATION_MAP } from '../rules/ruleRuntime.impl.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { makeGlobalPiles, makeMastermindState, makePlayerZones, makeTurnEconomy } from '../test/fixtureBuilders.js';
import { WOUND_EXT_ID } from '../setup/pilesInit.js';
import type { LegendaryGameState, MatchConfiguration, PendingSeatChoice, VillainAbilityHook } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { ShuffleProvider } from '../setup/shuffle.js';

const CARDS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'data', 'cards');

const JESTER = 'bkwd-villain-taskmasters-thunderbolts-jester-00' as CardExtId;
const JOYSTICK = 'bkwd-villain-taskmasters-thunderbolts-joystick-00' as CardExtId;
const JACK = 'bkwd-villain-taskmasters-thunderbolts-jack-olantern-00' as CardExtId;
const BULLSEYE = 'bkwd-villain-taskmasters-thunderbolts-bullseye-00' as CardExtId;

/** Builds the real Taskmaster's Thunderbolts hooks from the committed bkwd.json. */
function buildThunderboltsHooks(): VillainAbilityHook[] {
  const bkwd = JSON.parse(readFileSync(join(CARDS_DIRECTORY, 'bkwd.json'), 'utf8')) as unknown;
  const registry = { listCards: () => [], getSet: (abbr: string) => (abbr === 'bkwd' ? bkwd : undefined) };
  const config = { villainGroupIds: ['bkwd/taskmasters-thunderbolts'], henchmanGroupIds: [] } as unknown as MatchConfiguration;
  return buildVillainAbilityHooks(registry, config);
}

const THUNDERBOLTS_HOOKS = buildThunderboltsHooks();

/** The effects of a card's hook at a timing (from the real parse). */
function effectsAt(cardSlug: string, timing: 'onAmbush' | 'onFight' | 'onEscape'): { primitive: string }[] {
  const cardId = `bkwd-villain-taskmasters-thunderbolts-${cardSlug}-00`;
  for (const hook of THUNDERBOLTS_HOOKS) {
    if (hook.cardId === cardId && hook.timing === timing) {
      return hook.effects.map((effect) => ({ primitive: effect.primitive }));
    }
  }
  return [];
}

/** The unresolved markers of a card's hook at a timing. */
function unresolvedAt(cardSlug: string, timing: 'onAmbush' | 'onFight' | 'onEscape'): string[] {
  const cardId = `bkwd-villain-taskmasters-thunderbolts-${cardSlug}-00`;
  const markers: string[] = [];
  for (const hook of THUNDERBOLTS_HOOKS) {
    if (hook.cardId === cardId && hook.timing === timing) {
      markers.push(...(hook.unresolvedMarkers ?? []));
    }
  }
  return markers;
}

/** A two-seat state carrying the Thunderbolts hooks, rich enough for the executor and the escape path. */
function makeState(): LegendaryGameState {
  const displayData: Record<string, { name: string; imageUrl: string; cost: number }> = {
    [JESTER]: { name: 'Jester', imageUrl: '', cost: 0 },
    [JOYSTICK]: { name: 'Joystick', imageUrl: '', cost: 0 },
    [JACK]: { name: "Jack O'Lantern", imageUrl: '', cost: 0 },
    [BULLSEYE]: { name: 'Bullseye', imageUrl: '', cost: 0 },
  };
  return {
    matchConfiguration: {
      schemeId: 'test/scheme', mastermindId: 'test/mastermind',
      villainGroupIds: ['bkwd/taskmasters-thunderbolts'], henchmanGroupIds: [],
      heroDeckIds: [], bystandersCount: 0, woundsCount: 0, officersCount: 0, sidekicksCount: 0,
    },
    currentStage: 'main',
    messages: [],
    counters: {},
    hookRegistry: [],
    turnEconomy: { ...makeTurnEconomy() },
    playerZones: { '0': { ...makePlayerZones() }, '1': { ...makePlayerZones() } },
    piles: makeGlobalPiles(),
    mastermind: makeMastermindState(),
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: {},
    convertedVillainOrigins: {},
    city: [null, null, null, null, null],
    hq: [null, null, null, null, null],
    heroDeck: [],
    escapedPile: [],
    ko: [],
    attachedBystanders: {},
    villainAttachedHeroes: {},
    scheme: { twistPile: [] },
    selection: { schemeId: 'test/scheme', mastermindId: 'test/mastermind', villainGroupIds: ['bkwd/taskmasters-thunderbolts'], henchmanGroupIds: [], heroDeckIds: [] },
    heroAbilityHooks: [],
    villainAbilityHooks: [...THUNDERBOLTS_HOOKS],
    cardStats: {},
    cardTraits: {},
    cardKeywords: {},
    cardDisplayData: displayData,
    notableEvents: [],
  } as unknown as LegendaryGameState;
}

/** Registers a Henchman in a Victory Pile: its type, City Attack, and display name. */
function registerHenchman(G: LegendaryGameState, cardId: CardExtId, name: string, cityAttack: number): void {
  (G.villainDeckCardTypes as Record<string, string>)[cardId] = 'henchman';
  (G.cardStats as Record<string, unknown>)[cardId] = { attack: 0, recruit: 0, cost: 0, fightCost: cityAttack, fightCostMode: 'static' };
  (G.cardDisplayData as Record<string, unknown>)[cardId] = { name, imageUrl: '', cost: 0 };
}

/** Registers a Hero (for the Hero Deck capture): its cost, Attack-icon presence, and display name. */
function registerHero(G: LegendaryGameState, cardId: CardExtId, name: string, cost: number, hasAttackIcon: boolean): void {
  (G.cardStats as Record<string, unknown>)[cardId] = { attack: hasAttackIcon ? 1 : 0, recruit: 0, cost, fightCost: 0, hasAttackIcon };
  (G.cardDisplayData as Record<string, unknown>)[cardId] = { name, imageUrl: '', cost };
}

/** Registers Bullseye as a dynamic "4+" villain (base 4, grows by captured-Hero cost). */
function registerBullseyeDynamic(G: LegendaryGameState): void {
  (G.cardStats as Record<string, unknown>)[BULLSEYE] = { attack: 4, recruit: 0, cost: 0, fightCost: 4, fightCostBase: 4, fightCostMode: 'dynamic' };
  // why: WP-905 / D-24862 — Bullseye's printed Attack adds each captured Hero's cost, so it opts
  // into the captured-Hero cost term. In a real match buildVillainCapturedHeroCost sets this from
  // Bullseye's [effect:capture-hero-deck-top-by-icon-guess] marker; this hand-built fixture sets it
  // directly so resolveFightCost adds the captured cost (base 4 + captured cost), as before.
  (G as { villainCapturedHeroCost?: Record<string, true> }).villainCapturedHeroCost = { [BULLSEYE]: true };
}

/** A deterministic shuffle context. */
function shuffleContext(): ShuffleProvider {
  return { random: makeMockCtx().random } as unknown as ShuffleProvider;
}

/** The log lines (outcome: text). */
function logLines(G: LegendaryGameState): string[] {
  return G.messages.map((message) => `${message.outcome}: ${message.text}`);
}

/** Submits an option for a seat on an open seat choice. */
function submit(choice: PendingSeatChoice, seat: string, optionIndex: number): void {
  choice.submissions[seat] = { optionIndex };
}

/** The `effect:status` strings of every trace recorded for a card. */
function traceStatuses(G: LegendaryGameState, cardId: CardExtId): string[] {
  const statuses: string[] = [];
  for (const trace of (G as unknown as { diagnostics?: { traces?: { cardId: string; effect: string; status: string }[] } }).diagnostics?.traces ?? []) {
    if (trace.cardId === cardId) {
      statuses.push(`${trace.effect}:${trace.status}`);
    }
  }
  return statuses;
}

describe('Taskmaster\'s Thunderbolts parse (WP-903 / D-24860) — AC 1', () => {
  it('Jester: Ambush capture-bystander (unchanged) + Fight reveal-four-play-henchmen, no unresolved', () => {
    assert.deepEqual(effectsAt('jester', 'onAmbush'), [{ primitive: 'capture-bystander' }]);
    assert.deepEqual(effectsAt('jester', 'onFight'), [{ primitive: 'reveal-four-play-henchmen-current' }]);
    assert.deepEqual(unresolvedAt('jester', 'onAmbush'), []);
    assert.deepEqual(unresolvedAt('jester', 'onFight'), []);
  });

  it('Joystick: Ambush enter-city-henchman-from-any-victory-pile, no unresolved', () => {
    assert.deepEqual(effectsAt('joystick', 'onAmbush'), [{ primitive: 'enter-city-henchman-from-any-victory-pile-current' }]);
    assert.deepEqual(unresolvedAt('joystick', 'onAmbush'), []);
  });

  it('Jack O\'Lantern: Fight enter-city-henchman + Escape gain-wound-under-two-henchmen, no unresolved', () => {
    assert.deepEqual(effectsAt('jack-olantern', 'onFight'), [{ primitive: 'enter-city-henchman-from-any-victory-pile-current' }]);
    assert.deepEqual(effectsAt('jack-olantern', 'onEscape'), [{ primitive: 'gain-wound-under-two-henchmen-each-player' }]);
    assert.deepEqual(unresolvedAt('jack-olantern', 'onFight'), []);
    assert.deepEqual(unresolvedAt('jack-olantern', 'onEscape'), []);
  });

  it('Bullseye: Ambush capture-hero-deck-top + Fight gain-attached-hero + Escape ko-captured, no unresolved', () => {
    assert.deepEqual(effectsAt('bullseye', 'onAmbush'), [{ primitive: 'capture-hero-deck-top-by-icon-guess' }]);
    assert.deepEqual(effectsAt('bullseye', 'onFight'), [{ primitive: 'gain-attached-hero' }]);
    assert.deepEqual(effectsAt('bullseye', 'onEscape'), [{ primitive: 'ko-captured-heroes-on-escape' }]);
    assert.deepEqual(unresolvedAt('bullseye', 'onAmbush'), []);
    assert.deepEqual(unresolvedAt('bullseye', 'onFight'), []);
    assert.deepEqual(unresolvedAt('bullseye', 'onEscape'), []);
  });
});

describe('Jester Fight reveal-and-play (WP-903 / D-24860) — AC 2', () => {
  it('reveals the top four, plays the Henchmen into the City, returns the rest in revealed order', () => {
    const G = makeState();
    registerHenchman(G, 'hench-a' as CardExtId, 'Hench A', 1);
    registerHenchman(G, 'hench-b' as CardExtId, 'Hench B', 1);
    (G.villainDeckCardTypes as Record<string, string>)['vill-x'] = 'villain';
    (G.villainDeckCardTypes as Record<string, string>)['vill-y'] = 'villain';
    (G.cardDisplayData as Record<string, unknown>)['vill-x'] = { name: 'Villain X', imageUrl: '', cost: 0 };
    (G.cardDisplayData as Record<string, unknown>)['vill-y'] = { name: 'Villain Y', imageUrl: '', cost: 0 };
    G.villainDeck.deck = ['hench-a', 'vill-x', 'hench-b', 'vill-y', 'deeper'] as CardExtId[];
    runVillainFightFireSiteBridges(G, { currentPlayer: '0' }, JESTER, shuffleContext());
    // the two Henchmen entered the City
    assert.ok(G.city.includes('hench-a' as CardExtId));
    assert.ok(G.city.includes('hench-b' as CardExtId));
    // the non-Henchman remainder is back on top in revealed order, above the untouched deck
    assert.deepEqual(G.villainDeck.deck, ['vill-x', 'vill-y', 'deeper'] as CardExtId[]);
  });

  it('a short deck takes what exists; an empty deck is a logged no-op', () => {
    const shortState = makeState();
    registerHenchman(shortState, 'solo-hench' as CardExtId, 'Solo Hench', 1);
    shortState.villainDeck.deck = ['solo-hench'] as CardExtId[];
    runVillainFightFireSiteBridges(shortState, { currentPlayer: '0' }, JESTER, shuffleContext());
    assert.ok(shortState.city.includes('solo-hench' as CardExtId));
    assert.deepEqual(shortState.villainDeck.deck, [] as CardExtId[]);

    const emptyState = makeState();
    emptyState.villainDeck.deck = [];
    runVillainFightFireSiteBridges(emptyState, { currentPlayer: '0' }, JESTER, shuffleContext());
    assert.deepEqual(emptyState.villainDeck.deck, [] as CardExtId[]);
    assert.ok(logLines(emptyState).some((line) => line.includes('the Villain Deck') && line.startsWith('blocked:')));
  });

  it('the executor handler is a deliberate no-op (trace no-op, not fired)', () => {
    const G = makeState();
    executeVillainAbilitiesWithNarrative(G, { currentPlayer: '0' }, JESTER, 'onFight');
    assert.deepEqual(traceStatuses(G, JESTER), ['reveal-four-play-henchmen-current:no-op']);
  });
});

describe('Joystick Ambush / Jack O\'Lantern Fight Henchman-to-City pick (WP-903 / D-24860) — AC 3', () => {
  it('the Ambush executor queues the pick and returns its narrative clause (not the fallback)', () => {
    const G = makeState();
    const execution = executeVillainAbilitiesWithNarrative(G, { currentPlayer: '0' }, JOYSTICK, 'onAmbush');
    assert.deepEqual(execution.narrativeClauses, ['chooses a Henchman from a Victory Pile to enter the City']);
    assert.equal(G.pendingVillainFightPicks?.length, 1);
    assert.equal(G.pendingVillainFightPicks?.[0]?.primitive, 'enter-city-henchman-from-any-victory-pile-current');
  });

  it('both timings share one kind, dispatched through isVillainFightPickKind', () => {
    assert.ok(isVillainFightPickKind(ENTER_CITY_HENCHMAN_FROM_VICTORY_KIND));
    const fromFight = makeState();
    executeVillainAbilitiesWithNarrative(fromFight, { currentPlayer: '0' }, JACK, 'onFight');
    assert.equal(fromFight.pendingVillainFightPicks?.[0]?.primitive, 'enter-city-henchman-from-any-victory-pile-current');
  });

  it('options are every Henchman across all Victory Piles, ascending City Attack (option 0 least threatening)', () => {
    const G = makeState();
    registerHenchman(G, 'hench-big' as CardExtId, 'Big Hench', 5);
    registerHenchman(G, 'hench-small' as CardExtId, 'Small Hench', 2);
    G.playerZones['0']!.victory = ['hench-big'] as CardExtId[];
    G.playerZones['1']!.victory = ['hench-small'] as CardExtId[];
    queueVillainFightPick(G, { primitive: 'enter-city-henchman-from-any-victory-pile-current', playerID: '0', sourceCardId: JOYSTICK });
    openVillainFightPickSeatChoiceIfNeeded(G, undefined, '0');
    const choice = G.pendingSeatChoice!;
    assert.equal(choice.kind, ENTER_CITY_HENCHMAN_FROM_VICTORY_KIND);
    assert.deepEqual(choice.addressedSeats, ['0']);
    // ascending City Attack: Small Hench (2, Player 1) before Big Hench (5, Player 0)
    assert.equal(choice.seatPrompts['0']?.options[0]?.label, "Send Small Hench into the City (from Player 1's Victory Pile)");
    assert.equal(choice.seatPrompts['0']?.options[1]?.label, "Send Big Hench into the City (from Player 0's Victory Pile)");
  });

  it('the chosen Henchman leaves its owner\'s Victory Pile and enters the City', () => {
    const G = makeState();
    registerHenchman(G, 'hench-pick' as CardExtId, 'Pick Hench', 2);
    G.playerZones['1']!.victory = ['hench-pick'] as CardExtId[];
    queueVillainFightPick(G, { primitive: 'enter-city-henchman-from-any-victory-pile-current', playerID: '0', sourceCardId: JOYSTICK });
    openVillainFightPickSeatChoiceIfNeeded(G, undefined, '0');
    const choice = G.pendingSeatChoice!;
    submit(choice, '0', 0);
    const captured = { ...choice };
    applyVillainFightPickResolvedSeatChoice(G, choice, shuffleContext());
    delete G.pendingSeatChoice;
    chainVillainFightPick(G, captured, { currentPlayer: '0', turn: 0 }, undefined, makeMockCtx().random);
    assert.ok(!G.playerZones['1']!.victory.includes('hench-pick' as CardExtId));
    assert.ok(G.city.includes('hench-pick' as CardExtId));
  });

  it('no eligible Henchman → a logged no-op, no choice parked', () => {
    const G = makeState();
    queueVillainFightPick(G, { primitive: 'enter-city-henchman-from-any-victory-pile-current', playerID: '0', sourceCardId: JOYSTICK });
    openVillainFightPickSeatChoiceIfNeeded(G, undefined, '0');
    assert.equal(G.pendingSeatChoice, undefined);
    assert.ok(logLines(G).some((line) => line.startsWith('blocked:') && line.includes('No Henchman in any Victory Pile')));
  });
});

describe('Jack O\'Lantern Escape under-two-Henchmen Wound (WP-903 / D-24860) — AC 4', () => {
  it('wounds every seat with fewer than two Henchmen, current player first; woundsDrawn for the current player only', () => {
    const G = makeState();
    G.piles.wounds = [WOUND_EXT_ID, WOUND_EXT_ID] as CardExtId[];
    // seat 0: one Henchman (< 2) → wounded; seat 1: two Henchmen (≥ 2) → skipped
    registerHenchman(G, 'h0' as CardExtId, 'H0', 1);
    registerHenchman(G, 'h1a' as CardExtId, 'H1a', 1);
    registerHenchman(G, 'h1b' as CardExtId, 'H1b', 1);
    G.playerZones['0']!.victory = ['h0'] as CardExtId[];
    G.playerZones['1']!.victory = ['h1a', 'h1b'] as CardExtId[];
    executeVillainAbilitiesWithNarrative(G, { currentPlayer: '0' }, JACK, 'onEscape');
    assert.equal(G.playerZones['0']!.discard.filter((id) => id === WOUND_EXT_ID).length, 1);
    assert.equal(G.playerZones['1']!.discard.filter((id) => id === WOUND_EXT_ID).length, 0);
    assert.equal(G.turnEconomy.woundsDrawn, 1);
  });

  it('an empty Wound supply is a no-op', () => {
    const G = makeState();
    G.piles.wounds = [];
    G.playerZones['0']!.victory = [];
    G.playerZones['1']!.victory = [];
    executeVillainAbilitiesWithNarrative(G, { currentPlayer: '0' }, JACK, 'onEscape');
    assert.equal(G.playerZones['0']!.discard.length, 0);
    assert.equal(G.turnEconomy.woundsDrawn, 0);
    assert.ok(logLines(G).some((line) => line.startsWith('blocked:') && line.includes('Wound supply is empty')));
  });
});

describe('Bullseye Ambush Hero-Deck-top icon-guess capture (WP-903 / D-24860) — AC 5', () => {
  it('captures the top Hero when it has an Attack icon; Bullseye\'s City Attack grows by its cost', () => {
    const G = makeState();
    registerBullseyeDynamic(G);
    registerHero(G, 'hero-attack' as CardExtId, 'Attack Hero', 3, true);
    G.heroDeck = ['hero-attack', 'hero-next'] as CardExtId[];
    assert.equal(resolveFightCost(G, BULLSEYE), 4);
    const execution = executeVillainAbilitiesWithNarrative(G, { currentPlayer: '0' }, BULLSEYE, 'onAmbush');
    assert.deepEqual(execution.narrativeClauses, ['captures Attack Hero from the Hero Deck (+3 Attack)']);
    assert.deepEqual(G.villainAttachedHeroes[BULLSEYE], ['hero-attack'] as CardExtId[]);
    assert.deepEqual(G.heroDeck, ['hero-next'] as CardExtId[]);
    assert.equal(resolveFightCost(G, BULLSEYE), 7);
  });

  it('a top Hero with no Attack icon is not captured; Attack stays 4', () => {
    const G = makeState();
    registerBullseyeDynamic(G);
    registerHero(G, 'hero-recruit' as CardExtId, 'Recruit Hero', 3, false);
    G.heroDeck = ['hero-recruit'] as CardExtId[];
    const execution = executeVillainAbilitiesWithNarrative(G, { currentPlayer: '0' }, BULLSEYE, 'onAmbush');
    assert.deepEqual(execution.narrativeClauses, ['reveals Recruit Hero from the Hero Deck — no Attack icon, not captured']);
    assert.equal(G.villainAttachedHeroes[BULLSEYE], undefined);
    assert.deepEqual(G.heroDeck, ['hero-recruit'] as CardExtId[]);
    assert.equal(resolveFightCost(G, BULLSEYE), 4);
  });

  it('an empty Hero Deck captures nothing', () => {
    const G = makeState();
    registerBullseyeDynamic(G);
    G.heroDeck = [];
    const execution = executeVillainAbilitiesWithNarrative(G, { currentPlayer: '0' }, BULLSEYE, 'onAmbush');
    assert.deepEqual(execution.narrativeClauses, ['the Hero Deck is empty, so nothing was captured']);
    assert.equal(G.villainAttachedHeroes[BULLSEYE], undefined);
  });
});

describe('Bullseye Escape KO of the captured Hero (WP-903 / D-24860) — AC 7', () => {
  it('the executor handler is a deliberate no-op (trace no-op, not fired)', () => {
    const G = makeState();
    executeVillainAbilitiesWithNarrative(G, { currentPlayer: '0' }, BULLSEYE, 'onEscape');
    assert.deepEqual(traceStatuses(G, BULLSEYE), ['ko-captured-heroes-on-escape:no-op']);
  });

  it('the Escape bridge KOs the captured Hero and clears the entry, instead of the Escape Pile', () => {
    const G = makeState();
    registerHero(G, 'captured-hero' as CardExtId, 'Captured Hero', 3, true);
    G.villainAttachedHeroes[BULLSEYE] = ['captured-hero'] as CardExtId[];
    resolveVillainEscape(
      G,
      { random: makeMockCtx().random, ctx: { currentPlayer: '0', turn: 0 } },
      DEFAULT_IMPLEMENTATION_MAP,
      BULLSEYE,
    );
    assert.ok(G.ko.includes('captured-hero' as CardExtId));
    assert.ok(!G.escapedPile.includes('captured-hero' as CardExtId));
    assert.equal(G.villainAttachedHeroes[BULLSEYE], undefined);
  });

  it('a Bullseye with no captured Hero is a no-op (no KO, no Escape-Pile move)', () => {
    const G = makeState();
    resolveVillainEscape(
      G,
      { random: makeMockCtx().random, ctx: { currentPlayer: '0', turn: 0 } },
      DEFAULT_IMPLEMENTATION_MAP,
      BULLSEYE,
    );
    assert.deepEqual(G.ko, [] as CardExtId[]);
  });
});
