/**
 * Integration tests for escape-wound-bystander interactions (WP-017).
 *
 * Exercises the interaction between escape detection, bystander
 * attachment, bystander award on defeat, and bystander resolution on
 * escape. Since WP-793 / D-24656 no escape gives a generic Wound (the
 * rulebook HQ KO + Bystander discard replace it; villainEscapeProcedure.test.ts). Tests use revealVillainCard and fightVillain
 * directly with mock game state.
 *
 * Uses node:test, node:assert, and makeMockCtx — no boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { RevealedCardType } from '../villainDeck/villainDeck.types.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { revealVillainCard } from '../villainDeck/villainDeck.reveal.js';
import { fightVillain } from '../moves/fightVillain.js';
import { initializeCity, initializeHq } from '../board/city.logic.js';
import { buildDefaultHookDefinitions } from '../rules/ruleRuntime.impl.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import { makeMockMoveContext } from '../test/mockMoveContext.js';
import type { MockMoveContext } from '../test/mockMoveContext.js';
import { makeGlobalPiles, makeMastermindState, makePlayerZones, makeTurnEconomy } from '../test/fixtureBuilders.js';

/**
 * Creates a mock LegendaryGameState for integration testing.
 */
function createMockGameState(options?: {
  deck?: CardExtId[];
  cardTypes?: Record<CardExtId, RevealedCardType>;
  city?: LegendaryGameState['city'];
  bystandersPile?: CardExtId[];
  woundsPile?: CardExtId[];
  attachedBystanders?: Record<CardExtId, CardExtId[]>;
  currentStage?: LegendaryGameState['currentStage'];
}): LegendaryGameState {
  const config: MatchSetupConfig = {
    schemeId: 'test-scheme',
    mastermindId: 'test-mastermind',
    villainGroupIds: ['test-villain-group'],
    henchmanGroupIds: ['test-henchman-group'],
    heroDeckIds: ['test-hero-deck'],
    bystandersCount: 5,
    woundsCount: 5,
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
    currentStage: options?.currentStage ?? 'start',
    playerZones: {
      '0': { ...makePlayerZones(),
        deck: [],
        hand: [],
        discard: [],
        inPlay: [],
        victory: [],
      },
    },
    piles: { ...makeGlobalPiles(),
      bystanders: options?.bystandersPile ?? ['bystander-1', 'bystander-2', 'bystander-3'],
      wounds: options?.woundsPile ?? ['wound-1', 'wound-2', 'wound-3'],
      officers: ['officer-1'],
      sidekicks: ['sidekick-1'],
    },
    messages: [],
    // why: WP-200 — required field; fightVillain emits to this array
    // when defeating a card.
    notableEvents: [],
    counters: {},
    hookRegistry: buildDefaultHookDefinitions(config),
    villainDeck: {
      deck: options?.deck ?? [],
      discard: [],
    },
    villainDeckCardTypes: options?.cardTypes ?? {},
    ko: [],
    attachedBystanders: options?.attachedBystanders ?? {},
    turnEconomy: { ...makeTurnEconomy(), attack: 0, recruit: 0, spentAttack: 0, spentRecruit: 0, piercing: 0, woundsDrawn: 0 },
    cardStats: {},
    mastermind: { ...makeMastermindState(),
      id: 'test-mastermind',
      baseCardId: 'test-mastermind-base',
      tacticsDeck: [],
      tacticsDefeated: [],
      strikePile: [],
    },
    scheme: { twistPile: [] },
    escapedPile: [],
    city: options?.city ?? initializeCity(),
    hq: initializeHq(),
    lobby: {
      requiredPlayers: 1,
      ready: {},
      started: false,
    },
  };
}

/**
 * Creates a mock MoveContext for moves that need ctx.
 */
function createMockMoveContext(gameState: LegendaryGameState): MockMoveContext {
  // why: delegates to the shared builder so this mock carries the COMPLETE
  // boardgame.io plugin-API surface. The local literal it replaced implemented
  // only the members the engine calls, which is a structurally invalid mock
  // rather than a smaller one (WP-569 / D-24378).
  return makeMockMoveContext(gameState);
}

describe('escape-wound integration', () => {
  // why: WP-793 / D-24656 — intentional behavior change: the D-1702 / D-24439 generic
  // escape Wound is removed (rules v23 L556–L570 owe an HQ KO + Bystander discard instead).
  it('villain escape gives the current player no Wound (D-24656)', () => {
    // City full with 5 villains; pushing one more causes escape
    const gameState = createMockGameState({
      deck: ['new-villain'],
      cardTypes: {
        'new-villain': 'villain',
        'city-villain-0': 'villain',
        'city-villain-1': 'villain',
        'city-villain-2': 'villain',
        'city-villain-3': 'villain',
        'city-villain-4': 'villain',
      },
      city: ['city-villain-0', 'city-villain-1', 'city-villain-2', 'city-villain-3', 'city-villain-4'],
      woundsPile: ['wound-1', 'wound-2'],
    });

    const moveContext = createMockMoveContext(gameState);
    revealVillainCard(moveContext);

    assert.deepStrictEqual(
      gameState.playerZones['0']!.discard,
      [],
      'an escape gives the current player no Wound — the discard is unchanged',
    );
    assert.equal(
      gameState.piles.wounds.length,
      2,
      'the wound pile is unchanged by an escape',
    );
    assert.ok(
      !gameState.messages.some((entry) => entry.text.includes('gained a wound from villain escape')),
      'no generic escape-Wound line is logged',
    );
  });

  it('escape with empty wounds pile: no wound, no error', () => {
    const gameState = createMockGameState({
      deck: ['new-villain'],
      cardTypes: {
        'new-villain': 'villain',
        'city-villain-0': 'villain',
        'city-villain-1': 'villain',
        'city-villain-2': 'villain',
        'city-villain-3': 'villain',
        'city-villain-4': 'villain',
      },
      city: ['city-villain-0', 'city-villain-1', 'city-villain-2', 'city-villain-3', 'city-villain-4'],
      woundsPile: [],
    });

    const moveContext = createMockMoveContext(gameState);
    revealVillainCard(moveContext);

    assert.equal(
      gameState.playerZones['0']!.discard.length,
      0,
      'No wound should be gained when wounds pile is empty',
    );
  });

  // why: D-24439 — the generic per-escape wound is a BASELINE penalty for a plain
  // villain. A villain whose card text defines its own onEscape ability (Ultron's
  // reveal-or-wound, …) resolves that ability INSTEAD; the generic wound must not
  // stack on top (that double-wounded the active player). city-villain-4 is the
  // card that escapes when the full City is pushed (see the attached-bystanders
  // test below), so the onEscape hook is placed on it.
  it('a villain WITH its own onEscape ability does NOT also take the generic escape wound', () => {
    const gameState = createMockGameState({
      deck: ['new-villain'],
      cardTypes: {
        'new-villain': 'villain',
        'city-villain-0': 'villain',
        'city-villain-1': 'villain',
        'city-villain-2': 'villain',
        'city-villain-3': 'villain',
        'city-villain-4': 'villain',
      },
      city: ['city-villain-0', 'city-villain-1', 'city-villain-2', 'city-villain-3', 'city-villain-4'],
      woundsPile: ['wound-1', 'wound-2'],
    });
    // why: give the escaping card a real onEscape ability (shape mirrors the
    // WP-252 parser output used in boardKeywords.integration.test.ts) so the gate
    // sees a card-defined escape and skips the generic baseline wound.
    gameState.villainAbilityHooks = [
      {
        cardId: 'city-villain-4',
        timing: 'onEscape',
        keywords: ['gainWoundEachPlayer'],
        effects: [{ primitive: 'gain-wound', target: 'each' }],
      },
    ];

    const moveContext = createMockMoveContext(gameState);
    revealVillainCard(moveContext);

    // why: the generic per-escape wound emits exactly this line; its ABSENCE proves
    // the gate skipped it. The card's own ability may still wound (via its own path),
    // so we assert on the generic line specifically, not on total wound count.
    assert.ok(
      !gameState.messages.some((entry) => entry.text.includes('gained a wound from villain escape')),
      'the generic escape wound must be skipped for a villain with its own onEscape ability',
    );
  });

  // why: WP-793 / D-24656 — intentional behavior change: the control for the gate above
  // used to prove a plain villain still took the generic Wound; the Wound is removed for
  // every escape, so a plain villain now takes none either.
  it('a plain villain (no onEscape ability) takes no escape wound either (D-24656)', () => {
    const gameState = createMockGameState({
      deck: ['new-villain'],
      cardTypes: {
        'new-villain': 'villain',
        'city-villain-0': 'villain',
        'city-villain-1': 'villain',
        'city-villain-2': 'villain',
        'city-villain-3': 'villain',
        'city-villain-4': 'villain',
      },
      city: ['city-villain-0', 'city-villain-1', 'city-villain-2', 'city-villain-3', 'city-villain-4'],
      woundsPile: ['wound-1', 'wound-2'],
    });

    const moveContext = createMockMoveContext(gameState);
    revealVillainCard(moveContext);

    assert.ok(
      !gameState.messages.some((entry) => entry.text.includes('gained a wound from villain escape')),
      'a plain villain escape logs no generic escape-Wound line',
    );
    assert.deepStrictEqual(
      gameState.playerZones['0']!.discard,
      [],
      'a plain villain escape leaves the current player\'s discard unchanged',
    );
    assert.equal(gameState.piles.wounds.length, 2, 'the wound pile is unchanged by an escape');
  });

  it('JSON.stringify(G) succeeds after escape + wound', () => {
    const gameState = createMockGameState({
      deck: ['new-villain'],
      cardTypes: {
        'new-villain': 'villain',
        'city-villain-0': 'villain',
        'city-villain-1': 'villain',
        'city-villain-2': 'villain',
        'city-villain-3': 'villain',
        'city-villain-4': 'villain',
      },
      city: ['city-villain-0', 'city-villain-1', 'city-villain-2', 'city-villain-3', 'city-villain-4'],
    });

    const moveContext = createMockMoveContext(gameState);
    revealVillainCard(moveContext);

    const serialized = JSON.stringify(gameState);
    assert.ok(serialized.length > 0, 'G must be JSON-serializable after escape + wound');
  });
});

describe('no bystander attachment on City entry (WP-432 — canonical)', () => {
  // why: WP-432 removed the non-canonical D-1701 entry-attach. A villain/henchman
  // does NOT capture a bystander merely by entering the City; bystanders enter
  // only via a bystander CARD revealed from the villain deck (or a specific
  // Ambush/Strike/Twist/Fight effect). Entering the City must leave the supply
  // pile untouched and attach nothing.
  it('villain City entry with a full supply pile: nothing attached, supply unchanged', () => {
    const gameState = createMockGameState({
      deck: ['villain-a'],
      cardTypes: { 'villain-a': 'villain' },
      bystandersPile: ['bystander-1', 'bystander-2'],
    });

    const moveContext = createMockMoveContext(gameState);
    revealVillainCard(moveContext);

    assert.ok(
      !('villain-a' in gameState.attachedBystanders) ||
        gameState.attachedBystanders['villain-a']!.length === 0,
      'No bystander is attached to a villain merely by entering the City',
    );
    assert.equal(
      gameState.piles.bystanders.length,
      2,
      'The supply pile is untouched by City entry',
    );
  });
});

describe('bystander award on defeat', () => {
  it('on defeat: attached bystanders move to player victory and mapping entry removed', () => {
    const gameState = createMockGameState({
      city: ['villain-a', null, null, null, null],
      attachedBystanders: { 'villain-a': ['bystander-1', 'bystander-2'] },
      currentStage: 'main',
    });

    const moveContext = createMockMoveContext(gameState);
    fightVillain(moveContext, { cityIndex: 0 });

    assert.ok(
      gameState.playerZones['0']!.victory.includes('bystander-1'),
      'Bystander-1 must be in player victory',
    );
    assert.ok(
      gameState.playerZones['0']!.victory.includes('bystander-2'),
      'Bystander-2 must be in player victory',
    );
    assert.ok(
      !('villain-a' in gameState.attachedBystanders),
      'Mapping entry for defeated villain must be removed',
    );
  });
});

describe('escape with attached bystanders', () => {
  it('escape with attached bystanders: bystanders carried into the escaped pile, mapping entry removed, no bystander leak', () => {
    const gameState = createMockGameState({
      deck: ['new-villain'],
      cardTypes: {
        'new-villain': 'villain',
        'city-villain-0': 'villain',
        'city-villain-1': 'villain',
        'city-villain-2': 'villain',
        'city-villain-3': 'villain',
        'city-villain-4': 'villain',
      },
      city: ['city-villain-0', 'city-villain-1', 'city-villain-2', 'city-villain-3', 'city-villain-4'],
      attachedBystanders: { 'city-villain-4': ['bystander-attached-1'] },
      bystandersPile: ['bystander-supply-1'],
    });

    const moveContext = createMockMoveContext(gameState);
    revealVillainCard(moveContext);

    assert.ok(
      !('city-villain-4' in gameState.attachedBystanders),
      'Mapping entry for escaped villain must be removed',
    );
    // why: D-24314 — an escaping villain CARRIES its captured bystanders into
    // the Escaped Villains pile (countable for resource-loss schemes), NOT back
    // to the shared supply.
    assert.ok(
      gameState.escapedPile.includes('bystander-attached-1'),
      'Attached bystander must be carried into the Escaped Villains pile',
    );
    assert.ok(
      !gameState.piles.bystanders.includes('bystander-attached-1'),
      'Attached bystander must NOT be returned to the supply pile',
    );
  });
});
