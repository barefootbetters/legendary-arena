/**
 * Tests for enterCityIgnoringAmbush — the Haunt exorcise release path
 * (WP-757 / D-24587).
 *
 * The entering Villain goes to City space 0 WITHOUT Ambush; a Villain pushed off
 * space 4 escapes with full reveal parity via resolveVillainEscape.
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { LegendaryGameState, MatchConfiguration } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { CardRegistryReader } from '../matchSetup.validate.js';
import type { RevealContext } from './villainDeck.reveal.js';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { makeCardRegistryReader, makePlayerZones } from '../test/fixtureBuilders.js';
import { DEFAULT_IMPLEMENTATION_MAP } from '../rules/ruleRuntime.impl.js';
import { ENDGAME_CONDITIONS } from '../endgame/endgame.types.js';
import { enterCityIgnoringAmbush } from './villainDeck.enterCity.js';

/** Empty registry so the fixture does not depend on real card data. */
const EMPTY_REGISTRY: CardRegistryReader = { ...makeCardRegistryReader(),
  listCards: () => [],
};

const ENTERING_VILLAIN = 'test-villain-fallen-haunter-00' as CardExtId;
const ESCAPING_VILLAIN = 'test-villain-escaper-00' as CardExtId;
const HQ_HERO = 'test-hero-hq-00' as CardExtId;
const WOUND_ID = 'test-wound-00' as CardExtId;

/**
 * Builds a valid MatchConfiguration for enter-city fixtures.
 */
function buildConfig(): MatchConfiguration {
  return {
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
}

/**
 * Builds a game state where the entering Villain carries an Ambush that would
 * capture the rightmost HQ Hero if Ambush ever fired.
 */
function buildEnterCityState(): LegendaryGameState {
  const gameState = buildInitialGameState(buildConfig(), EMPTY_REGISTRY, makeMockCtx({ numPlayers: 1 }));
  gameState.playerZones = {
    '0': { ...makePlayerZones(), deck: [], hand: [], discard: [], inPlay: [], victory: [] },
  };
  gameState.piles.wounds = [WOUND_ID];
  gameState.hq = [null, null, null, null, HQ_HERO];
  gameState.heroDeck = [];
  gameState.escapedPile = [];
  gameState.notableEvents = [];
  gameState.villainAttachedHeroes = {};
  gameState.attachedBystanders = {};
  // why: the Ambush keyword + an onAmbush capture hook is exactly what the reveal
  // path would fire; enterCityIgnoringAmbush must NOT run it (an exorcise is not a reveal).
  gameState.cardKeywords = { [ENTERING_VILLAIN]: ['ambush'] };
  gameState.villainAbilityHooks = [
    {
      cardId: ENTERING_VILLAIN,
      timing: 'onAmbush',
      keywords: ['captureHqHeroRightmost'],
      effects: [{ primitive: 'capture-hq-hero', selector: 'rightmost' }],
    },
  ];
  return gameState;
}

/**
 * Narrow reveal context: deterministic shuffle + the active player id.
 */
function buildRevealContext(): RevealContext {
  return { random: makeMockCtx().random, ctx: { currentPlayer: '0' } };
}

describe('enterCityIgnoringAmbush (WP-757 / D-24587)', () => {
  it('enters City space 0 of a partly-empty City without any escape', () => {
    const gameState = buildEnterCityState();
    const otherVillain = 'test-villain-other-00' as CardExtId;
    gameState.city = [otherVillain, null, null, null, null];
    const countersBefore = JSON.stringify(gameState.counters);

    enterCityIgnoringAmbush(gameState, buildRevealContext(), DEFAULT_IMPLEMENTATION_MAP, ENTERING_VILLAIN);

    assert.equal(gameState.city[0], ENTERING_VILLAIN, 'the Villain enters space 0');
    assert.equal(gameState.city[1], otherVillain, 'the existing Villain is pushed one space');
    assert.deepStrictEqual(gameState.escapedPile, [], 'nothing escaped');
    assert.equal(JSON.stringify(gameState.counters), countersBefore, 'counters are unchanged');
    assert.deepStrictEqual(gameState.playerZones['0']!.discard, [], 'no wound was gained');
    assert.ok(
      gameState.messages.some(
        (message) => message.text.includes(ENTERING_VILLAIN) && message.text.includes('entered the city'),
      ),
      'a city-entry line is logged',
    );
  });

  it('does NOT fire the entering Villain onAmbush hook', () => {
    const gameState = buildEnterCityState();
    enterCityIgnoringAmbush(gameState, buildRevealContext(), DEFAULT_IMPLEMENTATION_MAP, ENTERING_VILLAIN);

    assert.equal(gameState.hq[4], HQ_HERO, 'the rightmost HQ Hero was NOT captured');
    assert.equal(
      gameState.villainAttachedHeroes[ENTERING_VILLAIN],
      undefined,
      'no Hero is attached to the entering Villain',
    );
    assert.equal(
      gameState.notableEvents.filter((event) => event.type === 'ambushResolved').length,
      0,
      'no ambushResolved event is pushed',
    );
    assert.equal(
      gameState.messages.filter((message) => message.text.startsWith('Ambush effect:')).length,
      0,
      'no Ambush effect line is logged',
    );
  });

  it('a full City pushes the space-4 Villain out and it escapes with reveal parity', () => {
    const gameState = buildEnterCityState();
    const bystanderId = 'test-bystander-captured-00' as CardExtId;
    gameState.city = [
      'test-c0' as CardExtId,
      'test-c1' as CardExtId,
      'test-c2' as CardExtId,
      'test-c3' as CardExtId,
      ESCAPING_VILLAIN,
    ];
    gameState.attachedBystanders = { [ESCAPING_VILLAIN]: [bystanderId] };
    const escapedBefore = gameState.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS] ?? 0;

    enterCityIgnoringAmbush(gameState, buildRevealContext(), DEFAULT_IMPLEMENTATION_MAP, ENTERING_VILLAIN);

    assert.deepStrictEqual(gameState.city, [
      ENTERING_VILLAIN,
      'test-c0',
      'test-c1',
      'test-c2',
      'test-c3',
    ]);
    assert.equal(
      gameState.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS],
      escapedBefore + 1,
      'the escaped-villains counter increments by 1',
    );
    assert.ok(gameState.escapedPile.includes(ESCAPING_VILLAIN), 'the escaper is in the escaped pile');
    assert.ok(gameState.escapedPile.includes(bystanderId), 'its bystander is carried into the escaped pile');
    assert.equal(gameState.attachedBystanders[ESCAPING_VILLAIN], undefined, 'the attachment entry is cleared');
    // why: D-24439 — the escaper has no Escape ability, so the generic per-escape
    // wound goes to the current player.
    assert.deepStrictEqual(gameState.playerZones['0']!.discard, [WOUND_ID], 'the current player gained the wound');
    assert.deepStrictEqual(gameState.piles.wounds, [], 'the wound came from the supply');
    assert.equal(gameState.hq[4], HQ_HERO, 'Ambush still did not fire on the entering Villain');
  });

  it('an escaper with a card-text Escape effect fires it instead of the generic wound', () => {
    const gameState = buildEnterCityState();
    const heroDeckTop = 'test-hero-deck-top-00' as CardExtId;
    gameState.heroDeck = [heroDeckTop];
    gameState.city = [
      'test-c0' as CardExtId,
      'test-c1' as CardExtId,
      'test-c2' as CardExtId,
      'test-c3' as CardExtId,
      ESCAPING_VILLAIN,
    ];
    gameState.villainAbilityHooks = [
      ...gameState.villainAbilityHooks,
      {
        cardId: ESCAPING_VILLAIN,
        timing: 'onEscape',
        keywords: ['heroDeckTopToEscape'],
        effects: [{ primitive: 'hero-deck-top-to-escape' }],
      },
    ];

    enterCityIgnoringAmbush(gameState, buildRevealContext(), DEFAULT_IMPLEMENTATION_MAP, ENTERING_VILLAIN);

    assert.ok(gameState.escapedPile.includes(ESCAPING_VILLAIN));
    assert.ok(gameState.escapedPile.includes(heroDeckTop), 'the Escape effect moved the hero-deck top');
    assert.deepStrictEqual(gameState.heroDeck, []);
    assert.ok(
      gameState.messages.some((message) => message.text.startsWith('Escape effect:')),
      'the Escape effect is narrated',
    );
    // why: D-24439 — an escaper with its own Escape ability does not also deal the
    // generic per-escape wound.
    assert.deepStrictEqual(gameState.playerZones['0']!.discard, [], 'no generic wound');
    assert.deepStrictEqual(gameState.piles.wounds, [WOUND_ID]);
  });
});
