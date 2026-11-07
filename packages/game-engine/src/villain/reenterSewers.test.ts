/**
 * Mr. Immortal reenters the Sewers (WP-868 / D-24811).
 *
 * cvwr Mr. Immortal prints "Fight: Reveal the top card of the Villain Deck. If it's a Villain or
 * Bystander, Mr. Immortal reenters the Sewers." The line logged an `unmarked-ability` hollow. The
 * `reenter-sewers-if-villain-deck-top` primitive is an executor no-op; the bridge at the end of
 * defeatCityVillainCore reveals the top card (never moving it) and, on a Villain, Henchman or
 * Bystander, moves Mr. Immortal from the Victory Pile into City space 0.
 *
 * Builds Mr. Immortal's real hooks from the committed card data and drives every case through
 * defeatCityVillainCore, except the full-City escape, which calls the bridge directly (see there).
 * No boardgame.io imports. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildVillainAbilityHooks } from '../setup/villainAbility.setup.js';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { defeatCityVillainCore } from '../moves/fightVillain.js';
import { reenterSewersOnVillainDeckReveal } from '../villainDeck/villainDeck.enterCity.js';
import { DEFAULT_IMPLEMENTATION_MAP } from '../rules/ruleRuntime.impl.js';
import { ENDGAME_CONDITIONS } from '../endgame/endgame.types.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { makeCardRegistryReader, makePlayerZones } from '../test/fixtureBuilders.js';
import type { LegendaryGameState, MatchConfiguration, RevealedCardType } from '../types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { CardRegistryReader } from '../matchSetup.validate.js';
import type { VillainAbilityHook } from '../rules/villainAbility.types.js';

// why: resolve the repo-root data directory from this test's own location (the
// cvwrBigBerthaRevealOrWound.test.ts precedent), so the tests read the card data that ships.
const CARDS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'data', 'cards');

const EMPTY_REGISTRY: CardRegistryReader = { ...makeCardRegistryReader(), listCards: () => [] };
const TOP_CARD = 'test-villain-deck-top-00' as CardExtId;
const RESCUED_BYSTANDER = 'test-bystander-rescued-00' as CardExtId;
const CITY_VILLAINS = ['test-villain-a-00', 'test-villain-b-00', 'test-villain-c-00', 'test-villain-d-00', 'test-villain-e-00'] as CardExtId[];
const FIGHT_CTX = { currentPlayer: '0', turn: 3 };
const SHUFFLE_CONTEXT = { random: makeMockCtx({ numPlayers: 1 }).random };

/**
 * Builds the real villain hooks for cvwr Great Lakes Avengers.
 *
 * @returns Every hook the villain group produces.
 */
function buildGreatLakesAvengersHooks(): VillainAbilityHook[] {
  const setData = JSON.parse(readFileSync(join(CARDS_DIRECTORY, 'cvwr.json'), 'utf8'));
  const registry = { getSet: (abbr: string) => (abbr === 'cvwr' ? setData : undefined) };
  const config = { villainGroupIds: ['cvwr/great-lakes-avengers'], henchmanGroupIds: [] } as unknown as MatchSetupConfig;
  return buildVillainAbilityHooks(registry, config);
}

const HOOKS = buildGreatLakesAvengersHooks();
const MR_IMMORTAL = HOOKS.find((hook) => hook.cardId.startsWith('cvwr-villain-great-lakes-avengers-mr-immortal-'))!.cardId;

/**
 * A one-seat state with Mr. Immortal in City space 0 and the given Villain Deck top card.
 *
 * @param topType - The top card's RevealedCardType, or null for an empty Villain Deck.
 * @returns The game state.
 */
function makeState(topType: RevealedCardType | null): LegendaryGameState {
  const config: MatchConfiguration = {
    schemeId: 'test-scheme-001',
    mastermindId: 'test-mastermind-001',
    villainGroupIds: ['test-villain-group-001'],
    henchmanGroupIds: ['test-henchman-group-001'],
    heroDeckIds: ['test-hero-deck-001'],
    bystandersCount: 1,
    woundsCount: 1,
    officersCount: 1,
    sidekicksCount: 0,
  };
  const G = buildInitialGameState(config, EMPTY_REGISTRY, makeMockCtx({ numPlayers: 1 }));
  G.playerZones = { '0': { ...makePlayerZones(), deck: [], hand: [], discard: [], inPlay: [], victory: [] } };
  G.city = [MR_IMMORTAL, null, null, null, null];
  G.hq = [null, null, null, null, null];
  G.heroDeck = [];
  G.escapedPile = [];
  G.notableEvents = [];
  G.villainAttachedHeroes = {};
  G.attachedBystanders = {};
  G.villainAbilityHooks = HOOKS;
  G.cardDisplayData = {
    ...G.cardDisplayData,
    [MR_IMMORTAL]: { name: 'Mr. Immortal', imageUrl: '', cost: 0 },
    [TOP_CARD]: { name: 'Top Card', imageUrl: '', cost: 0 },
  };
  if (topType === null) {
    G.villainDeck = { deck: [], discard: [] };
    G.villainDeckCardTypes = {};
  } else {
    G.villainDeck = { deck: [TOP_CARD], discard: [] };
    G.villainDeckCardTypes = { [TOP_CARD]: topType };
  }
  return G;
}

/**
 * Returns every log line's text.
 *
 * @param G - The game state.
 * @returns The message texts in order.
 */
function logTexts(G: LegendaryGameState): string[] {
  const texts: string[] = [];
  for (const message of G.messages) {
    texts.push(message.text);
  }
  return texts;
}

describe('WP-868 RS-4 parse: Mr. Immortal', () => {
  it('both copies parse to reenter-sewers-if-villain-deck-top with villain + bystander', () => {
    const fightHooks = HOOKS.filter(
      (hook) => hook.cardId.startsWith('cvwr-villain-great-lakes-avengers-mr-immortal-') && hook.timing === 'onFight',
    );
    assert.ok(fightHooks.length > 0);
    for (const fightHook of fightHooks) {
      assert.deepStrictEqual(fightHook.effects, [
        { primitive: 'reenter-sewers-if-villain-deck-top', reenterRevealKinds: ['villain', 'bystander'] },
      ]);
      assert.deepStrictEqual(fightHook.unresolvedMarkers ?? [], []);
    }
  });
});

describe('WP-868 RS-3 Mr. Immortal reenters the Sewers (D-24811)', () => {
  for (const topType of ['villain', 'henchman', 'bystander'] as const) {
    it(`a ${topType} on top: he leaves the Victory Pile for City space 0, and the top card stays put`, () => {
      const G = makeState(topType);
      defeatCityVillainCore(G, FIGHT_CTX, 0, SHUFFLE_CONTEXT);
      assert.equal(G.city[0], MR_IMMORTAL, 'Mr. Immortal is in the Sewers');
      assert.equal(G.playerZones['0']!.victory.includes(MR_IMMORTAL), false, 'he left the Victory Pile');
      assert.deepStrictEqual(G.villainDeck.deck, [TOP_CARD], 'the revealed card is never moved');
      const texts = logTexts(G);
      assert.ok(texts.includes('Fight effect: Mr. Immortal revealed Top Card from the Villain Deck.'));
      assert.equal(texts[texts.length - 1], 'Mr. Immortal reenters the Sewers.');
      assert.equal(G.messages[G.messages.length - 1]?.outcome, 'threat');
    });
  }

  for (const topType of ['scheme-twist', 'mastermind-strike'] as const) {
    it(`a ${topType} on top: he stays defeated`, () => {
      const G = makeState(topType);
      defeatCityVillainCore(G, FIGHT_CTX, 0, SHUFFLE_CONTEXT);
      assert.equal(G.city[0], null);
      assert.ok(G.playerZones['0']!.victory.includes(MR_IMMORTAL));
      assert.deepStrictEqual(G.villainDeck.deck, [TOP_CARD]);
      const texts = logTexts(G);
      assert.equal(texts[texts.length - 1], 'Top Card is not a Villain or Bystander, so Mr. Immortal stays defeated.');
    });
  }

  it('an empty Villain Deck: he stays defeated with a blocked line', () => {
    const G = makeState(null);
    defeatCityVillainCore(G, FIGHT_CTX, 0, SHUFFLE_CONTEXT);
    assert.equal(G.city[0], null);
    assert.ok(G.playerZones['0']!.victory.includes(MR_IMMORTAL));
    assert.equal(G.messages[G.messages.length - 1]?.text, 'Fight effect: the Villain Deck is empty, so Mr. Immortal stays defeated.');
    assert.equal(G.messages[G.messages.length - 1]?.outcome, 'blocked');
  });

  it('his own Bystanders stay rescued in the Victory Pile when he reenters', () => {
    const G = makeState('villain');
    G.attachedBystanders = { [MR_IMMORTAL]: [RESCUED_BYSTANDER] };
    defeatCityVillainCore(G, FIGHT_CTX, 0, SHUFFLE_CONTEXT);
    assert.equal(G.city[0], MR_IMMORTAL);
    assert.ok(G.playerZones['0']!.victory.includes(RESCUED_BYSTANDER), 'the rescued Bystander stays rescued');
    assert.equal((G.attachedBystanders[MR_IMMORTAL] ?? []).length, 0, 'he reenters carrying no Bystander');
  });

  it('a City entry pushes the occupied spaces like any entry', () => {
    const G = makeState('villain');
    G.city = [CITY_VILLAINS[0]!, MR_IMMORTAL, null, null, null];
    defeatCityVillainCore(G, FIGHT_CTX, 1, SHUFFLE_CONTEXT);
    assert.deepStrictEqual(G.city, [MR_IMMORTAL, CITY_VILLAINS[0], null, null, null]);
  });

  it('the onFight trace for the primitive reads no-op, not fired', () => {
    const G = makeState('villain');
    defeatCityVillainCore(G, FIGHT_CTX, 0, SHUFFLE_CONTEXT);
    const traces = G.diagnostics?.traces ?? [];
    const reenterTraces = traces.filter((trace) => trace.effect === 'reenter-sewers-if-villain-deck-top');
    assert.equal(reenterTraces.length, 1);
    assert.equal(reenterTraces[0]!.status, 'no-op');
  });

  it('a card no longer in the Victory Pile does not reenter', () => {
    const G = makeState('villain');
    G.playerZones['0']!.victory = [];
    reenterSewersOnVillainDeckReveal(
      G,
      { random: SHUFFLE_CONTEXT.random, ctx: { currentPlayer: '0', turn: 3 } },
      DEFAULT_IMPLEMENTATION_MAP,
      '0',
      MR_IMMORTAL,
      ['villain', 'bystander'],
    );
    assert.deepStrictEqual(G.city, [MR_IMMORTAL, null, null, null, null], 'the City is untouched');
    assert.equal(
      G.messages[G.messages.length - 1]?.text,
      'Fight effect: Mr. Immortal is no longer in the Victory Pile, so it cannot reenter the Sewers.',
    );
  });

  it('a full City pushes its last card out through the escape procedure', () => {
    // why: a Fight always empties the fought space, so through defeatCityVillainCore the push can
    // never reach the escape edge; the bridge is driven directly on a full City to pin the escape.
    const G = makeState('villain');
    G.city = [...CITY_VILLAINS];
    G.playerZones['0']!.victory = [MR_IMMORTAL];
    const escapedBefore = G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS] ?? 0;
    reenterSewersOnVillainDeckReveal(
      G,
      { random: SHUFFLE_CONTEXT.random, ctx: { currentPlayer: '0', turn: 3 } },
      DEFAULT_IMPLEMENTATION_MAP,
      '0',
      MR_IMMORTAL,
      ['villain', 'bystander'],
    );
    assert.deepStrictEqual(G.city, [MR_IMMORTAL, ...CITY_VILLAINS.slice(0, 4)]);
    assert.ok(G.escapedPile.includes(CITY_VILLAINS[4]!), 'the pushed-out Villain escapes');
    assert.equal(G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS], escapedBefore + 1, 'the escape counts');
    assert.equal(G.playerZones['0']!.victory.includes(MR_IMMORTAL), false);
  });
});
