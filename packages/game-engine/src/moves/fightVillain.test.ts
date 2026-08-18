/**
 * Fight villain move tests for WP-016.
 *
 * Verifies fightVillain follows the three-step validation contract,
 * gates to main stage, removes villains from City to victory pile,
 * and handles invalid inputs gracefully.
 *
 * Uses node:test and node:assert only. Uses makeMockCtx. No boardgame.io
 * imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fightVillain, defeatCityVillainCore } from './fightVillain.js';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { VillainAbilityHook } from '../rules/villainAbility.types.js';
import { LEGACY_VILLAIN_KEYWORD_TO_DESCRIPTOR } from '../rules/villainAbility.types.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { TURN_STAGES } from '../turn/turnPhases.types.js';
import { buildDefaultHookDefinitions } from '../rules/ruleRuntime.impl.js';
import { initializeCity, initializeHq } from '../board/city.logic.js';
import { makeMockMoveContext } from '../test/mockMoveContext.js';
import type { MockMoveContext } from '../test/mockMoveContext.js';
import { makeGlobalPiles, makeMastermindState, makePlayerZones, makeTurnEconomy } from '../test/fixtureBuilders.js';

// ---------------------------------------------------------------------------
// Mock G factory
// ---------------------------------------------------------------------------

/**
 * Creates a minimal LegendaryGameState for fight tests.
 * City has a villain at the specified index. Player 0 has empty zones.
 */
function createMockGameState(options?: {
  city?: LegendaryGameState['city'];
  currentStage?: LegendaryGameState['currentStage'];
  hand?: string[];
  inPlay?: string[];
  discard?: string[];
  cardTraits?: LegendaryGameState['cardTraits'];
  villainDefeatRequirements?: LegendaryGameState['villainDefeatRequirements'];
  villainAbilityHooks?: VillainAbilityHook[];
  cardDisplayData?: LegendaryGameState['cardDisplayData'];
  villainAttachedHeroes?: LegendaryGameState['villainAttachedHeroes'];
}): LegendaryGameState {
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
    currentStage: options?.currentStage ?? 'main',
    playerZones: {
      '0': { ...makePlayerZones(),
        deck: [],
        hand: (options?.hand ?? []) as LegendaryGameState['playerZones']['0']['hand'],
        discard: (options?.discard ?? []) as LegendaryGameState['playerZones']['0']['discard'],
        inPlay: (options?.inPlay ?? []) as LegendaryGameState['playerZones']['0']['inPlay'],
        victory: [],
      },
    },
    cardTraits: options?.cardTraits ?? {},
    // why: WP-316 — villain ability hooks + display data drive the Fight:
    // effect narration. Absent by default (empty hooks → no effect line), so
    // existing tests are unaffected.
    villainAbilityHooks: options?.villainAbilityHooks ?? [],
    ...(options?.cardDisplayData ? { cardDisplayData: options.cardDisplayData } : {}),
    ...(options?.villainDefeatRequirements
      ? { villainDefeatRequirements: options.villainDefeatRequirements }
      : {}),
    piles: { ...makeGlobalPiles(),
      bystanders: [],
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
    attachedBystanders: {},
    villainAttachedHeroes: options?.villainAttachedHeroes ?? {},
    turnEconomy: { ...makeTurnEconomy(), attack: 0, recruit: 0, spentAttack: 0, spentRecruit: 0 },
    cardStats: {},
    mastermind: { ...makeMastermindState(),
      id: 'test-mastermind',
      baseCardId: 'test-mastermind-base',
      tacticsDeck: [],
      tacticsDefeated: [],
    },
    city: options?.city ?? initializeCity(),
    hq: initializeHq(),
    lobby: {
      requiredPlayers: 1,
      ready: {},
      started: false,
    },
    // why: WP-200 — fightVillain pushes one `fightResolved` event to
    // `G.notableEvents` after the message push. Field initialised here so
    // the emission does not throw on missing-field; required by D-20003.
    notableEvents: [],
  };
}

/**
 * Creates a mock MoveContext for fightVillain.
 */
function createMockMoveContext(gameState: LegendaryGameState): MockMoveContext {
  // why: delegates to the shared builder so this mock carries the COMPLETE
  // boardgame.io plugin-API surface. The local literal it replaced implemented
  // only the members the engine calls, which is a structurally invalid mock
  // rather than a smaller one (WP-569 / D-24378).
  return makeMockMoveContext(gameState);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('fightVillain', () => {
  it('removes card from G.city[cityIndex]', () => {
    const gameState = createMockGameState({
      city: ['villain-a', null, 'villain-c', null, null],
    });

    const moveContext = createMockMoveContext(gameState);
    fightVillain(moveContext, { cityIndex: 0 });

    assert.equal(
      moveContext.G.city[0],
      null,
      'City space 0 must be null after fight',
    );
  });

  it('removed card appears in player victory zone', () => {
    const gameState = createMockGameState({
      city: ['villain-a', null, null, null, null],
    });

    const moveContext = createMockMoveContext(gameState);
    fightVillain(moveContext, { cityIndex: 0 });

    assert.ok(
      moveContext.G.playerZones['0']!.victory.includes('villain-a'),
      'villain-a must be in player 0 victory zone',
    );
  });

  it('invalid cityIndex (out of range): no mutation', () => {
    const gameState = createMockGameState({
      city: ['villain-a', null, null, null, null],
    });

    const moveContext = createMockMoveContext(gameState);
    const cityBefore = [...moveContext.G.city];

    fightVillain(moveContext, { cityIndex: 5 });
    assert.deepStrictEqual(moveContext.G.city, cityBefore, 'City unchanged for index 5');

    fightVillain(moveContext, { cityIndex: -1 });
    assert.deepStrictEqual(moveContext.G.city, cityBefore, 'City unchanged for index -1');

    fightVillain(moveContext, { cityIndex: 2.5 });
    assert.deepStrictEqual(moveContext.G.city, cityBefore, 'City unchanged for non-integer');

    fightVillain(moveContext, { cityIndex: NaN });
    assert.deepStrictEqual(moveContext.G.city, cityBefore, 'City unchanged for NaN');
  });

  it('empty city space (null): no mutation', () => {
    const gameState = createMockGameState({
      city: [null, null, null, null, null],
    });

    const moveContext = createMockMoveContext(gameState);
    const victoryBefore = moveContext.G.playerZones['0']!.victory.length;

    fightVillain(moveContext, { cityIndex: 2 });

    assert.equal(
      moveContext.G.playerZones['0']!.victory.length,
      victoryBefore,
      'Victory zone must not change when fighting empty space',
    );
  });

  it('wrong stage (start): no mutation', () => {
    const gameState = createMockGameState({
      city: ['villain-a', null, null, null, null],
      currentStage: 'start',
    });

    const moveContext = createMockMoveContext(gameState);
    const cityBefore = [...moveContext.G.city];
    const messagesBefore = moveContext.G.messages.length;

    fightVillain(moveContext, { cityIndex: 0 });

    assert.deepStrictEqual(
      moveContext.G.city,
      cityBefore,
      'City must not change when stage is not main',
    );
    assert.equal(
      moveContext.G.messages.length,
      messagesBefore,
      'No messages when stage gate blocks',
    );
  });

  it('JSON.stringify(G) succeeds after fight', () => {
    const gameState = createMockGameState({
      city: ['villain-a', 'villain-b', null, null, null],
    });

    const moveContext = createMockMoveContext(gameState);
    fightVillain(moveContext, { cityIndex: 1 });

    const serialized = JSON.stringify(moveContext.G);
    assert.ok(serialized, 'JSON.stringify(G) must produce a non-empty string');
  });

  it('idempotence: second call on same index is no-op', () => {
    const gameState = createMockGameState({
      city: ['villain-a', null, null, null, null],
    });

    const moveContext = createMockMoveContext(gameState);
    fightVillain(moveContext, { cityIndex: 0 });

    assert.equal(moveContext.G.playerZones['0']!.victory.length, 1, 'One card in victory after first fight');

    fightVillain(moveContext, { cityIndex: 0 });

    assert.equal(
      moveContext.G.playerZones['0']!.victory.length,
      1,
      'Victory unchanged after second fight on same (now null) space',
    );
  });

  // -------------------------------------------------------------------------
  // WP-200 — fightResolved emission
  // -------------------------------------------------------------------------

  it('WP-200: pushes exactly one fightResolved event with correct payload', () => {
    const gameState = createMockGameState({
      city: ['villain-a', null, null, null, null],
    });
    const moveContext = createMockMoveContext(gameState);

    fightVillain(moveContext, { cityIndex: 0 });

    assert.equal(
      moveContext.G.notableEvents.length,
      1,
      'exactly one fightResolved event must be emitted',
    );
    const event = moveContext.G.notableEvents[0]!;
    assert.equal(event.type, 'fightResolved');
    if (event.type === 'fightResolved') {
      assert.equal(event.playerId, '0');
      assert.equal(event.cardId, 'villain-a');
      assert.equal(event.citySpace, 0);
      assert.equal(event.bystandersRescued, 0);
      assert.deepStrictEqual(
        event.appliedEffects,
        [],
        'no villain ability hooks in this test G → appliedEffects empty',
      );
      assert.ok(
        event.narrative.length > 0 && event.narrative.includes('villain-a'),
        'narrative is non-empty and names the card',
      );
    }
  });

  it('WP-200: fightResolved event is NOT pushed when the move short-circuits', () => {
    const gameState = createMockGameState({
      city: ['villain-a', null, null, null, null],
      currentStage: 'start',
    });
    const moveContext = createMockMoveContext(gameState);

    fightVillain(moveContext, { cityIndex: 0 });

    assert.equal(
      moveContext.G.notableEvents.length,
      0,
      'stage-gated short-circuit must not push an event',
    );
  });
});

// ---------------------------------------------------------------------------
// WP-316 — Fight: effect log narration (per-target)
// ---------------------------------------------------------------------------

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

describe('fightVillain — WP-316 Fight: effect log narration', () => {
  it('auto-KO (1 eligible) pushes a Fight effect line naming the resolved hero', () => {
    const gameState = createMockGameState({
      city: ['villain-a', null, null, null, null],
      discard: ['core-hero-spidey'],
      villainAbilityHooks: [fightHook('villain-a', 'koHeroCurrentPlayer')],
      cardDisplayData: {
        'core-hero-spidey': { name: 'Spider-Man' },
      } as unknown as LegendaryGameState['cardDisplayData'],
    });
    const moveContext = createMockMoveContext(gameState);

    fightVillain(moveContext, { cityIndex: 0 });

    assert.ok(
      moveContext.G.messages.some(
        (entry) => entry.text === 'Fight effect: the active player KO’d a hero (Spider-Man).',
      ),
      'the durable log names the specific KO\'d hero',
    );
    // why: WP-316 keyword-surface byte-identity (appliedEffects) + WP-319 the
    // narrative NAMES the KO'd hero (shown by the center-screen overlay).
    const event = moveContext.G.notableEvents[0]!;
    assert.equal(event.type, 'fightResolved');
    if (event.type === 'fightResolved') {
      assert.deepStrictEqual(event.appliedEffects, ['koHeroCurrentPlayer']);
      assert.equal(
        event.narrative,
        'Fought "villain-a"; Fight effect: the active player KO’d a hero (Spider-Man).',
      );
    }
  });

  it('≥2 eligible (pending KO) pushes a Fight effect line that says the choice is pending', () => {
    const gameState = createMockGameState({
      city: ['villain-a', null, null, null, null],
      discard: ['core-hero-a', 'core-hero-b'],
      villainAbilityHooks: [fightHook('villain-a', 'koHeroCurrentPlayer')],
    });
    const moveContext = createMockMoveContext(gameState);

    fightVillain(moveContext, { cityIndex: 0 });

    assert.ok(
      moveContext.G.messages.some((entry) => entry.text === 'Fight effect: the active player must KO a hero.'),
      'a parked interactive KO logs the pending phrase, not a hero name',
    );
    assert.equal(
      moveContext.G.pendingKoHeroChoices?.length,
      1,
      'the choice is parked pending',
    );
  });

  it('an effectless fight pushes no Fight effect line', () => {
    const gameState = createMockGameState({
      city: ['villain-a', null, null, null, null],
    });
    const moveContext = createMockMoveContext(gameState);

    fightVillain(moveContext, { cityIndex: 0 });

    assert.equal(
      moveContext.G.messages.filter((message) => message.text.startsWith('Fight effect:')).length,
      0,
      'no effect line when the villain applied no Fight: effect',
    );
  });
});

describe('fightVillain — defeat-requirement gate (WP-292 / D-24076)', () => {
  const BLOB = 'core-villain-brotherhood-blob-01';
  const TEAM_REQ = { kind: 'team', value: 'x-men' } as const;
  const TRAITS = {
    'core/cyclops/optic-blast#0': { heroClass: 'ranged', team: 'x-men' },
    'starting-shield-agent': { heroClass: null, team: null },
  } as unknown as LegendaryGameState['cardTraits'];

  it('blocks the fight when the player holds no qualifying Hero (G unchanged)', () => {
    const gameState = createMockGameState({
      city: [BLOB, null, null, null, null],
      hand: ['starting-shield-agent'],
      cardTraits: TRAITS,
      villainDefeatRequirements: { [BLOB]: TEAM_REQ },
    });
    const moveContext = createMockMoveContext(gameState);
    fightVillain(moveContext, { cityIndex: 0 });

    assert.equal(moveContext.G.city[0], BLOB, 'villain must remain in the City');
    assert.equal(
      moveContext.G.playerZones['0']!.victory.length,
      0,
      'nothing moved to the victory pile',
    );
    assert.equal(moveContext.G.messages.length, 0, 'no message on a blocked fight');
    assert.equal(moveContext.G.notableEvents.length, 0, 'no event on a blocked fight');
  });

  it('allows the fight when a qualifying Hero is in hand', () => {
    const gameState = createMockGameState({
      city: [BLOB, null, null, null, null],
      hand: ['core/cyclops/optic-blast#0'],
      cardTraits: TRAITS,
      villainDefeatRequirements: { [BLOB]: TEAM_REQ },
    });
    const moveContext = createMockMoveContext(gameState);
    fightVillain(moveContext, { cityIndex: 0 });

    assert.equal(moveContext.G.city[0], null, 'villain removed from the City');
    assert.ok(
      moveContext.G.playerZones['0']!.victory.includes(BLOB),
      'villain moved to the victory pile',
    );
  });

  it('allows the fight when a qualifying Hero is in play', () => {
    const gameState = createMockGameState({
      city: [BLOB, null, null, null, null],
      inPlay: ['core/cyclops/optic-blast#0'],
      cardTraits: TRAITS,
      villainDefeatRequirements: { [BLOB]: TEAM_REQ },
    });
    const moveContext = createMockMoveContext(gameState);
    fightVillain(moveContext, { cityIndex: 0 });

    assert.equal(moveContext.G.city[0], null, 'villain removed from the City');
    assert.ok(
      moveContext.G.playerZones['0']!.victory.includes(BLOB),
      'villain moved to the victory pile',
    );
  });

  it('does not gate a villain that carries no requirement (regression-free)', () => {
    // why: the requirements table exists (Blob is marked) but the fought villain
    // is unmarked — the gate must be a no-op for it.
    const gameState = createMockGameState({
      city: ['core-villain-skrulls-super-skrull-00', null, null, null, null],
      hand: [],
      cardTraits: TRAITS,
      villainDefeatRequirements: { [BLOB]: TEAM_REQ },
    });
    const moveContext = createMockMoveContext(gameState);
    fightVillain(moveContext, { cityIndex: 0 });

    assert.equal(moveContext.G.city[0], null, 'unmarked villain removed normally');
    assert.ok(
      moveContext.G.playerZones['0']!.victory.includes(
        'core-villain-skrulls-super-skrull-00',
      ),
      'unmarked villain moved to the victory pile',
    );
  });
});

describe('fightVillain — captured-hero return log (WP-431)', () => {
  it('logs each captured hero returning to the defeating player discard pile', () => {
    const gameState = createMockGameState({
      city: ['skrull-shapeshifters-00', null, null, null, null],
      villainAttachedHeroes: { 'skrull-shapeshifters-00': ['core/hulk/unstoppable-hulk#4'] },
    });
    const moveContext = createMockMoveContext(gameState);
    fightVillain(moveContext, { cityIndex: 0 });

    assert.ok(
      moveContext.G.playerZones['0']!.discard.includes('core/hulk/unstoppable-hulk#4'),
      'captured hero moved into the defeating player discard pile',
    );
    assert.ok(
      moveContext.G.messages.some(
        (message) =>
          message.text.includes('Player 0 gained') &&
          message.text.includes('core/hulk/unstoppable-hulk#4') &&
          message.text.includes('skrull-shapeshifters-00') &&
          message.text.includes('into their discard pile.'),
      ),
      'a return-to-discard log line names the hero and the defeated villain',
    );
  });

  it('emits no hero-return line when the villain captured no hero', () => {
    const gameState = createMockGameState({
      city: ['plain-villain-00', null, null, null, null],
    });
    const moveContext = createMockMoveContext(gameState);
    fightVillain(moveContext, { cityIndex: 0 });

    assert.equal(
      moveContext.G.messages.filter((message) => message.text.includes('into their discard pile.')).length,
      0,
      'no hero-return line for a villain with no attached hero',
    );
  });
});

// ---------------------------------------------------------------------------
// defeat-to-gain for Skrulls (WP-514 / D-24327)
// ---------------------------------------------------------------------------

describe('defeatCityVillainCore — Skrull defeat-to-gain (WP-514 / D-24327)', () => {
  const shuffleContext = { random: makeMockCtx({ numPlayers: 1 }).random };

  it('routes a defeated Skrull to the player discard, clears its overlay, and logs the gain', () => {
    const gameState = createMockGameState({
      city: ['hero-skrull', null, null, null, null],
    });
    gameState.convertedVillainOrigins = {
      'hero-skrull': 'skrull',
    } as LegendaryGameState['convertedVillainOrigins'];

    defeatCityVillainCore(gameState, { currentPlayer: '0' }, 0, shuffleContext);

    assert.ok(
      gameState.playerZones['0']!.discard.includes('hero-skrull' as CardExtId),
      'the gained Hero lands in the defeating player discard pile',
    );
    assert.ok(
      !gameState.playerZones['0']!.victory.includes('hero-skrull' as CardExtId),
      'the Skrull does NOT go to the victory pile',
    );
    assert.equal(
      gameState.convertedVillainOrigins!['hero-skrull'],
      undefined,
      'the skrull overlay entry is cleared (it is a Hero again)',
    );
    assert.ok(
      gameState.messages.some((message) => message.text.includes('gained the Hero')),
      'a gain log line is emitted (no untrailed hero in the deck)',
    );
  });

  it('WP-518: the fightResolved overlay narrative announces the Skrull gain', () => {
    const gameState = createMockGameState({
      city: ['hero-skrull', null, null, null, null],
    });
    gameState.convertedVillainOrigins = {
      'hero-skrull': 'skrull',
    } as LegendaryGameState['convertedVillainOrigins'];

    defeatCityVillainCore(gameState, { currentPlayer: '0' }, 0, shuffleContext);

    const event = gameState.notableEvents[gameState.notableEvents.length - 1]!;
    assert.equal(event.type, 'fightResolved');
    if (event.type === 'fightResolved') {
      // why: WP-518 / D-24331 — the center-screen overlay must name the gain, not
      // just the durable log; otherwise the Skrull defeat reads as an ordinary kill.
      assert.ok(
        event.narrative.includes("gained the Hero into the active player's discard pile"),
        'the overlay narrative announces the Skrull gain',
      );
    }
  });

  it('WP-518: a non-Skrull defeat narrative does NOT mention a gain (byte-identical path)', () => {
    const gameState = createMockGameState({
      city: ['villain-real', null, null, null, null],
    });

    defeatCityVillainCore(gameState, { currentPlayer: '0' }, 0, shuffleContext);

    const event = gameState.notableEvents[gameState.notableEvents.length - 1]!;
    assert.equal(event.type, 'fightResolved');
    if (event.type === 'fightResolved') {
      assert.ok(
        !event.narrative.includes('gained the Hero'),
        'an ordinary villain defeat narrative carries no Skrull-gain clause',
      );
    }
  });

  it('a non-Skrull villain still routes to the victory pile (non-vacuous both-ways)', () => {
    const gameState = createMockGameState({
      city: ['villain-real', null, null, null, null],
    });

    defeatCityVillainCore(gameState, { currentPlayer: '0' }, 0, shuffleContext);

    assert.ok(
      gameState.playerZones['0']!.victory.includes('villain-real' as CardExtId),
      'a real villain still routes to the victory pile',
    );
    assert.ok(
      !gameState.playerZones['0']!.discard.includes('villain-real' as CardExtId),
      'a real villain does NOT land in the discard pile',
    );
    assert.ok(
      !gameState.messages.some((message) => message.text.includes('gained the Hero')),
      'no gain log line for a non-Skrull defeat',
    );
  });
});

// ---------------------------------------------------------------------------
// WP-542 / D-24351 — Endless Armies of HYDRA onFight fire site
// ---------------------------------------------------------------------------

describe('fightVillain — Endless Armies of HYDRA plays the top two Villain Deck cards (WP-542 / D-24351)', () => {
  it('defeating the villain plays the top two villain-deck cards into the city', () => {
    const endless = 'endless-armies' as CardExtId;
    const gameState = createMockGameState({
      city: [endless, null, null, null, null],
      villainAbilityHooks: [
        {
          cardId: endless,
          timing: 'onFight',
          keywords: [],
          effects: [{ primitive: 'play-villain-deck-cards', magnitude: 2 }],
        },
      ],
    });
    // why: the two cards the Fight plays, plus one that must remain on the deck.
    gameState.villainDeck = { deck: ['play-1', 'play-2', 'extra'] as CardExtId[], discard: [] };
    gameState.villainDeckCardTypes = { 'play-1': 'villain', 'play-2': 'villain', extra: 'villain' };
    const moveContext = createMockMoveContext(gameState);

    fightVillain(moveContext, { cityIndex: 0 });

    assert.ok(
      gameState.playerZones['0']!.victory.includes(endless),
      'Endless Armies of HYDRA is defeated into the victory pile',
    );
    // why: pushVillainIntoCity inserts at index 0 and shifts occupants toward the
    // escape edge, so assert membership (order-agnostic), not slot index.
    const cityCards = gameState.city.filter((occupant) => occupant !== null);
    assert.ok(cityCards.includes('play-1' as CardExtId), 'the first played card entered the city');
    assert.ok(cityCards.includes('play-2' as CardExtId), 'the second played card entered the city');
    assert.ok(!cityCards.includes(endless), 'Endless Armies left the city (it is in the victory pile)');
    assert.deepStrictEqual(
      gameState.villainDeck.deck,
      ['extra'],
      'exactly two cards were played from the deck',
    );
  });

  it('a defeated villain with no play hook plays nothing from the villain deck', () => {
    const plain = 'plain-villain' as CardExtId;
    const gameState = createMockGameState({
      city: [plain, null, null, null, null],
    });
    gameState.villainDeck = { deck: ['should-stay'] as CardExtId[], discard: [] };
    gameState.villainDeckCardTypes = { 'should-stay': 'villain' };
    const moveContext = createMockMoveContext(gameState);

    fightVillain(moveContext, { cityIndex: 0 });

    assert.deepStrictEqual(
      gameState.villainDeck.deck,
      ['should-stay'],
      'an ordinary defeat leaves the villain deck untouched',
    );
  });
});
