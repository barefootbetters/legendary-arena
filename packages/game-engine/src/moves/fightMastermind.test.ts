/**
 * Fight mastermind move tests for WP-019.
 *
 * Verifies fightMastermind follows the three-step validation contract,
 * gates to main stage, defeats tactics, spends attack, and triggers
 * victory when all tactics are defeated.
 *
 * Uses node:test and node:assert only. Uses makeMockCtx. No boardgame.io
 * imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fightMastermind, defeatMastermindTacticCore } from './fightMastermind.js';
import { mastermindStrikeHandler } from '../rules/mastermindHandlers.js';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { buildDefaultHookDefinitions } from '../rules/ruleRuntime.impl.js';
import { initializeCity, initializeHq } from '../board/city.logic.js';
import { ENDGAME_CONDITIONS } from '../endgame/endgame.types.js';
import { evaluateEndgame } from '../endgame/endgame.evaluate.js';
import { makeMockMoveContext } from '../test/mockMoveContext.js';
import type { MockMoveContext } from '../test/mockMoveContext.js';
import { makeCardStatEntry, makeGlobalPiles, makeMastermindState, makePlayerZones, makeTurnEconomy } from '../test/fixtureBuilders.js';

// ---------------------------------------------------------------------------
// Mock G factory
// ---------------------------------------------------------------------------

/**
 * Creates a minimal LegendaryGameState for fightMastermind tests.
 */
function createMockGameState(options?: {
  currentStage?: LegendaryGameState['currentStage'];
  turnEconomy?: LegendaryGameState['turnEconomy'];
  cardStats?: LegendaryGameState['cardStats'];
  mastermind?: LegendaryGameState['mastermind'];
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
        hand: [],
        discard: [],
        inPlay: [],
        victory: [],
      },
    },
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
    mastermind: options?.mastermind ?? { ...makeMastermindState(),
      id: 'test-mastermind' as CardExtId,
      baseCardId: 'test-mastermind-base' as CardExtId,
      tacticsDeck: ['tactic-1', 'tactic-2', 'tactic-3'] as CardExtId[],
      tacticsDefeated: [] as CardExtId[],
    },
    turnEconomy: options?.turnEconomy ?? { ...makeTurnEconomy(), attack: 0, recruit: 0, spentAttack: 0, spentRecruit: 0 },
    cardStats: options?.cardStats ?? {
      'test-mastermind-base': { ...makeCardStatEntry(), attack: 0, recruit: 0, cost: 0, fightCost: 8 },
    },
    city: initializeCity(),
    hq: initializeHq(),
    lobby: {
      requiredPlayers: 1,
      ready: {},
      started: false,
    },
    notableEvents: [],
  };
}

/**
 * Creates a mock MoveContext for fightMastermind.
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

describe('fightMastermind', () => {
  it('successful fight defeats top tactic and spends attack', () => {
    const gameState = createMockGameState({
      turnEconomy: { ...makeTurnEconomy(), attack: 10, recruit: 0, spentAttack: 0, spentRecruit: 0 },
    });

    const moveContext = createMockMoveContext(gameState);
    fightMastermind(moveContext);

    assert.deepStrictEqual(
      moveContext.G.mastermind.tacticsDeck,
      ['tactic-2', 'tactic-3'],
      'Top tactic must be removed from deck',
    );
    assert.deepStrictEqual(
      moveContext.G.mastermind.tacticsDefeated,
      ['tactic-1'],
      'Defeated tactic must be in tacticsDefeated',
    );
    assert.strictEqual(
      moveContext.G.turnEconomy.spentAttack,
      8,
      'spentAttack must be incremented by fightCost',
    );
  });

  it('insufficient attack: no G mutation', () => {
    const gameState = createMockGameState({
      turnEconomy: { ...makeTurnEconomy(), attack: 5, recruit: 0, spentAttack: 0, spentRecruit: 0 },
    });

    const mastermindBefore = { ...gameState.mastermind };
    const economyBefore = { ...gameState.turnEconomy };

    const moveContext = createMockMoveContext(gameState);
    fightMastermind(moveContext);

    assert.deepStrictEqual(
      moveContext.G.mastermind.tacticsDeck,
      mastermindBefore.tacticsDeck,
      'Mastermind state must be unchanged when attack is insufficient',
    );
    assert.deepStrictEqual(
      moveContext.G.turnEconomy,
      economyBefore,
      'Economy must be unchanged when attack is insufficient',
    );
  });

  it('no tactics remaining: no G mutation', () => {
    const gameState = createMockGameState({
      turnEconomy: { ...makeTurnEconomy(), attack: 10, recruit: 0, spentAttack: 0, spentRecruit: 0 },
      mastermind: { ...makeMastermindState(),
        id: 'test-mastermind' as CardExtId,
        baseCardId: 'test-mastermind-base' as CardExtId,
        tacticsDeck: [],
        tacticsDefeated: ['t1', 't2', 't3'],
      },
    });

    const economyBefore = { ...gameState.turnEconomy };

    const moveContext = createMockMoveContext(gameState);
    fightMastermind(moveContext);

    assert.strictEqual(
      moveContext.G.mastermind.tacticsDeck.length,
      0,
      'Tactics deck must remain empty',
    );
    assert.deepStrictEqual(
      moveContext.G.turnEconomy,
      economyBefore,
      'Economy must be unchanged when no tactics remain',
    );
  });

  it('wrong stage (cleanup): no G mutation', () => {
    const gameState = createMockGameState({
      currentStage: 'cleanup',
      turnEconomy: { ...makeTurnEconomy(), attack: 10, recruit: 0, spentAttack: 0, spentRecruit: 0 },
    });

    const tacticsDeckBefore = [...gameState.mastermind.tacticsDeck];
    const economyBefore = { ...gameState.turnEconomy };

    const moveContext = createMockMoveContext(gameState);
    fightMastermind(moveContext);

    assert.deepStrictEqual(
      moveContext.G.mastermind.tacticsDeck,
      tacticsDeckBefore,
      'Mastermind state must be unchanged in wrong stage',
    );
    assert.deepStrictEqual(
      moveContext.G.turnEconomy,
      economyBefore,
      'Economy must be unchanged in wrong stage',
    );
  });

  it('all tactics defeated: MASTERMIND_DEFEATED_PENDING latched, terminal NOT set, game not over (WP-732)', () => {
    const gameState = createMockGameState({
      turnEconomy: { ...makeTurnEconomy(), attack: 10, recruit: 0, spentAttack: 0, spentRecruit: 0 },
      mastermind: { ...makeMastermindState(),
        id: 'test-mastermind' as CardExtId,
        baseCardId: 'test-mastermind-base' as CardExtId,
        tacticsDeck: ['last-tactic'] as CardExtId[],
        tacticsDefeated: ['t1', 't2'] as CardExtId[],
      },
    });

    const moveContext = createMockMoveContext(gameState);
    fightMastermind(moveContext);

    // why: WP-732 / D-24553 — the vanquish latches the victory-assured PENDING
    // counter, NOT the terminal one; the current player finishes their turn first.
    assert.strictEqual(
      moveContext.G.counters[ENDGAME_CONDITIONS.MASTERMIND_DEFEATED_PENDING],
      1,
      'MASTERMIND_DEFEATED_PENDING must be latched on the vanquish',
    );
    assert.strictEqual(
      moveContext.G.counters[ENDGAME_CONDITIONS.MASTERMIND_DEFEATED],
      undefined,
      'the terminal MASTERMIND_DEFEATED must NOT be set at the vanquish (it resolves at turn end)',
    );
    assert.strictEqual(
      evaluateEndgame(moveContext.G),
      null,
      'the game is not over right after the vanquish — the win is deferred to turn end',
    );
    assert.strictEqual(
      moveContext.G.mastermind.tacticsDeck.length,
      0,
      'Tactics deck must be empty after defeating last tactic',
    );
    assert.deepStrictEqual(
      moveContext.G.mastermind.tacticsDefeated,
      ['t1', 't2', 'last-tactic'],
      'All defeated tactics must be in tacticsDefeated',
    );
  });

  it('all tactics defeated: captured bystanders awarded to victory and store cleared', () => {
    const gameState = createMockGameState({
      turnEconomy: { ...makeTurnEconomy(), attack: 10, recruit: 0, spentAttack: 0, spentRecruit: 0 },
      mastermind: { ...makeMastermindState(),
        id: 'test-mastermind' as CardExtId,
        baseCardId: 'test-mastermind-base' as CardExtId,
        tacticsDeck: ['last-tactic'] as CardExtId[],
        tacticsDefeated: ['t1', 't2'] as CardExtId[],
        strikePile: [] as CardExtId[],
        attachedBystanders: ['pile-bystander', 'pile-bystander'] as CardExtId[],
      },
    });

    const moveContext = createMockMoveContext(gameState);
    fightMastermind(moveContext);

    assert.deepStrictEqual(
      moveContext.G.playerZones['0']!.victory,
      ['last-tactic', 'pile-bystander', 'pile-bystander'],
      'Victory pile must hold the defeated tactic followed by both rescued bystanders',
    );
    assert.deepStrictEqual(
      moveContext.G.mastermind.attachedBystanders,
      [],
      'Mastermind attachedBystanders must be cleared after the award',
    );
    // why: D-20008 — defeating the mastermind emits exactly one
    // mastermindDefeated notable event carrying the rescued-bystander count
    // so the arena-client overlay can report the win + rescue.
    assert.equal(
      moveContext.G.notableEvents.length,
      1,
      'Exactly one notable event must be emitted on mastermind defeat',
    );
    const defeatEvent = moveContext.G.notableEvents[0]!;
    assert.equal(defeatEvent.type, 'mastermindDefeated', 'event type must be mastermindDefeated');
    assert.equal(
      defeatEvent.type === 'mastermindDefeated' && defeatEvent.bystandersRescued,
      2,
      'event must report 2 bystanders rescued',
    );
  });

  it('all tactics defeated: city-empty bystander mirror is awarded once and cleared', () => {
    const gameState = createMockGameState({
      turnEconomy: { ...makeTurnEconomy(), attack: 10, recruit: 0, spentAttack: 0, spentRecruit: 0 },
      mastermind: { ...makeMastermindState(),
        id: 'test-mastermind' as CardExtId,
        baseCardId: 'test-mastermind-base' as CardExtId,
        tacticsDeck: ['last-tactic'] as CardExtId[],
        tacticsDefeated: ['t1', 't2'] as CardExtId[],
        strikePile: [] as CardExtId[],
        attachedBystanders: ['pile-bystander'] as CardExtId[],
      },
    });
    // why: a bystander revealed while the City was empty lives in BOTH
    // G.mastermind.attachedBystanders and the city-villain map keyed by the
    // mastermind base card — verify the award counts it exactly once.
    gameState.attachedBystanders = {
      'test-mastermind-base': ['pile-bystander'],
    } as LegendaryGameState['attachedBystanders'];

    const moveContext = createMockMoveContext(gameState);
    fightMastermind(moveContext);

    assert.ok(
      !('test-mastermind-base' in moveContext.G.attachedBystanders),
      'Mastermind mirror entry must be removed from G.attachedBystanders',
    );
    assert.deepStrictEqual(
      moveContext.G.playerZones['0']!.victory,
      ['last-tactic', 'pile-bystander'],
      'Bystander must be awarded exactly once despite living in two stores',
    );
  });

  it('non-final fight: captured bystanders are rescued immediately, not held for the vanquish', () => {
    // why: regression test for the play.legendary-arena.com report — a
    // Mastermind holding bystanders must release them on EVERY tactic
    // defeat, not only the final blow (Universal Rules v23 §"When you fight
    // a Mastermind/Commander"). Three tactics remain after this fight, so
    // the mastermind is NOT vanquished, yet both held bystanders must move
    // to the victory pile.
    const gameState = createMockGameState({
      turnEconomy: { ...makeTurnEconomy(), attack: 10, recruit: 0, spentAttack: 0, spentRecruit: 0 },
      mastermind: { ...makeMastermindState(),
        id: 'test-mastermind' as CardExtId,
        baseCardId: 'test-mastermind-base' as CardExtId,
        tacticsDeck: ['tactic-1', 'tactic-2', 'tactic-3'] as CardExtId[],
        tacticsDefeated: [] as CardExtId[],
        strikePile: [] as CardExtId[],
        attachedBystanders: ['pile-bystander-a', 'pile-bystander-b'] as CardExtId[],
      },
    });

    const moveContext = createMockMoveContext(gameState);
    fightMastermind(moveContext);

    assert.equal(
      moveContext.G.counters[ENDGAME_CONDITIONS.MASTERMIND_DEFEATED],
      undefined,
      'MASTERMIND_DEFEATED must NOT be set while tactics remain',
    );
    assert.deepStrictEqual(
      moveContext.G.playerZones['0']!.victory,
      ['tactic-1', 'pile-bystander-a', 'pile-bystander-b'],
      'the defeated tactic and both held bystanders are awarded on this non-final fight',
    );
    assert.deepStrictEqual(
      moveContext.G.mastermind.attachedBystanders,
      [],
      'mastermind bystander store must be cleared after the non-final rescue',
    );
    assert.equal(
      moveContext.G.notableEvents.length,
      0,
      'the vanquish-only mastermindDefeated event must NOT fire while tactics remain',
    );
  });

  it('JSON.stringify(G) succeeds after fight', () => {
    const gameState = createMockGameState({
      turnEconomy: { ...makeTurnEconomy(), attack: 10, recruit: 0, spentAttack: 0, spentRecruit: 0 },
    });

    const moveContext = createMockMoveContext(gameState);
    fightMastermind(moveContext);

    const serialized = JSON.stringify(moveContext.G);
    assert.ok(serialized.length > 0, 'G must be JSON-serializable after fight');
  });
});

// ---------------------------------------------------------------------------
// Integration: Master Strike capture (real handler) then per-fight rescue
// across two fights. Reproduces the play.legendary-arena.com report where a
// mastermind that captured bystanders was only releasing them on the final
// blow — proves the captured bystanders are awarded to victory on EACH tactic
// defeat, end-to-end through the real capture + fight code paths, with a
// fresh capture between fights to show the per-fight semantics.
// ---------------------------------------------------------------------------

/**
 * Builds a self-contained state for the strike-capture-then-fight integration
 * test. Includes notableEvents (the strike handler emits one) and a 2-tactic
 * mastermind with a non-Magneto id so only the generic capture runs.
 */
function makeIntegrationState(): LegendaryGameState {
  return {
    matchConfiguration: {
      schemeId: 'test-scheme',
      mastermindId: 'test-mastermind',
      villainGroupIds: [],
      henchmanGroupIds: [],
      heroDeckIds: [],
      bystandersCount: 0,
      woundsCount: 0,
      officersCount: 0,
      sidekicksCount: 0,
    },
    selection: {
      schemeId: 'test-scheme',
      mastermindId: 'test-mastermind',
      villainGroupIds: [],
      henchmanGroupIds: [],
      heroDeckIds: [],
    },
    currentStage: 'main',
    playerZones: {
      '0': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
    },
    piles: {
      bystanders: ['bystander-001', 'bystander-002'] as CardExtId[],
      wounds: [],
      officers: [],
      sidekicks: [],
    },
    messages: [],
    counters: {},
    hookRegistry: [],
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: {},
    ko: [],
    attachedBystanders: {},
    turnEconomy: { attack: 100, recruit: 0, spentAttack: 0, spentRecruit: 0 },
    cardStats: {
      'test-mastermind-base': { attack: 0, recruit: 0, cost: 0, fightCost: 8 },
    },
    mastermind: {
      id: 'test-mastermind' as CardExtId,
      baseCardId: 'test-mastermind-base' as CardExtId,
      tacticsDeck: ['tactic-1', 'tactic-2'] as CardExtId[],
      tacticsDefeated: [] as CardExtId[],
      strikePile: [] as CardExtId[],
      attachedBystanders: [] as CardExtId[],
    },
    city: [null, null, null, null, null],
    hq: [null, null, null, null, null],
    lobby: { requiredPlayers: 1, ready: {}, started: false },
    notableEvents: [],
  } as unknown as LegendaryGameState;
}

describe('fightMastermind — integration: Master Strike capture then per-fight rescue', () => {
  it('rescues the held bystander on EACH tactic defeat, including a fresh capture between fights', () => {
    const gameState = makeIntegrationState();

    // A real Master Strike captures the first bystander onto the mastermind.
    mastermindStrikeHandler(gameState, {}, { cardId: 'strike-1' });
    assert.equal(
      gameState.mastermind.attachedBystanders.length,
      1,
      'one bystander must be captured onto the mastermind by the first strike',
    );

    const moveContext = createMockMoveContext(gameState);

    // First attack: defeats tactic-1 (NON-final) — must rescue the held
    // bystander immediately, not wait for the vanquish.
    fightMastermind(moveContext);
    assert.equal(
      moveContext.G.counters[ENDGAME_CONDITIONS.MASTERMIND_DEFEATED],
      undefined,
      'mastermind is NOT yet vanquished after only the first tactic falls',
    );
    assert.deepStrictEqual(
      moveContext.G.playerZones['0']!.victory,
      ['tactic-1', 'bystander-001'],
      'the first defeated tactic and the held bystander are both rescued on the non-final fight',
    );
    assert.equal(
      moveContext.G.mastermind.attachedBystanders.length,
      0,
      'mastermind bystander store is cleared after the non-final rescue',
    );

    // A second Master Strike captures another bystander BETWEEN fights.
    mastermindStrikeHandler(moveContext.G, {}, { cardId: 'strike-2' });
    assert.equal(
      moveContext.G.mastermind.attachedBystanders.length,
      1,
      'the second strike captures a fresh bystander before the final fight',
    );

    // Second attack: defeats tactic-2 (last) — vanquish — rescues the freshly
    // captured bystander (not the one already rescued on the first fight).
    fightMastermind(moveContext);
    assert.equal(
      moveContext.G.counters[ENDGAME_CONDITIONS.MASTERMIND_DEFEATED_PENDING],
      1,
      'mastermind must be vanquished (victory assured, pending) after the second attack',
    );
    assert.deepStrictEqual(
      moveContext.G.playerZones['0']!.victory,
      ['tactic-1', 'bystander-001', 'tactic-2', 'bystander-002'],
      'each tactic rescued the bystander the mastermind held at the moment of its defeat',
    );
    assert.equal(
      moveContext.G.mastermind.attachedBystanders.length,
      0,
      'mastermind bystander store must be cleared after the final rescue',
    );

    // The vanquish event reports only the bystander rescued on the FINAL fight.
    const defeatEvent = moveContext.G.notableEvents.find(
      (event) => event.type === 'mastermindDefeated',
    );
    assert.ok(defeatEvent, 'a mastermindDefeated event must be emitted on vanquish');
    assert.equal(
      defeatEvent.type === 'mastermindDefeated' && defeatEvent.bystandersRescued,
      1,
      'the vanquish event reports the single bystander rescued on the final fight',
    );
  });
});

// ---------------------------------------------------------------------------
// WP-497 / D-24300 — tactic onFight dispatch (Doc Ock "Octet of Valence Electrons")
// ---------------------------------------------------------------------------

const OCTET_TACTIC_ID =
  'co2e-mastermind-doctor-octopus-octet-of-valence-electrons' as CardExtId;

describe('defeatMastermindTacticCore — tactic onFight dispatch (WP-497 / D-24300)', () => {
  it('AC-1: defeating the Octet tactic sets the defeating player next-hand override to 8', () => {
    const gameState = createMockGameState({
      mastermind: { ...makeMastermindState(),
        id: 'co2e/doctor-octopus' as CardExtId,
        baseCardId: 'co2e-mastermind-doctor-octopus-doctor-octopus' as CardExtId,
        tacticsDeck: [OCTET_TACTIC_ID, 'tactic-2' as CardExtId],
        tacticsDefeated: [] as CardExtId[],
      },
    });

    defeatMastermindTacticCore(gameState, { currentPlayer: '0' }, { random: { Shuffle: <T,>(items: T[]): T[] => [...items].reverse() } });

    assert.deepEqual(gameState.handSizeOverrides, { '0': 8 },
      'defeating Octet records the +8 next-hand override for the current player');
  });

  it('AC-5: defeating a non-Octet tactic leaves handSizeOverrides absent (silent no-op)', () => {
    const gameState = createMockGameState({
      mastermind: { ...makeMastermindState(),
        id: 'test-mastermind' as CardExtId,
        baseCardId: 'test-mastermind-base' as CardExtId,
        tacticsDeck: ['tactic-1', 'tactic-2', 'tactic-3'] as CardExtId[],
        tacticsDefeated: [] as CardExtId[],
      },
    });

    defeatMastermindTacticCore(gameState, { currentPlayer: '0' }, { random: { Shuffle: <T,>(items: T[]): T[] => [...items].reverse() } });

    assert.equal(gameState.handSizeOverrides, undefined,
      'an unimplemented tactic id fires no onFight effect (stays inert)');
  });
});

// ---------------------------------------------------------------------------
// WP-656 / D-24467 — Diamond Form defeat signal (gated; RS-1 per-tactic)
// ---------------------------------------------------------------------------

describe('WP-656 / D-24467 — mastermind-defeat signal', () => {
  it('RS-1: each successful tactic fight sets the defeat signal when a grant is pending', () => {
    const gameState = createMockGameState({
      turnEconomy: { ...makeTurnEconomy(), attack: 10, recruit: 0, spentAttack: 0, spentRecruit: 0 },
    });
    // why: gated on a pending Diamond Form grant. RS-1 — a single tactic defeat (not
    // only the final vanquish) counts as a Mastermind defeat, so the flag is set here.
    gameState.deferredConditionalGrants = [{ playerId: '0', cardId: 'diamond-form', hookIndex: 0 }];

    const moveContext = createMockMoveContext(gameState);
    fightMastermind(moveContext);

    assert.equal(
      moveContext.G.mastermind.tacticsDefeated.length,
      1,
      'exactly one tactic was defeated (not a full vanquish)',
    );
    assert.equal(
      moveContext.G.villainOrMastermindDefeatedSinceResolve,
      true,
      'a single tactic defeat signals Diamond Form (RS-1: per-tactic counts)',
    );
  });

  it('AC-9: does NOT set the signal when no deferred grant is pending (oracle-safe)', () => {
    const gameState = createMockGameState({
      turnEconomy: { ...makeTurnEconomy(), attack: 10, recruit: 0, spentAttack: 0, spentRecruit: 0 },
    });

    const moveContext = createMockMoveContext(gameState);
    fightMastermind(moveContext);

    assert.equal(
      moveContext.G.villainOrMastermindDefeatedSinceResolve,
      undefined,
      'the flag must never enter G for a game with no deferred grant',
    );
  });

  it('does NOT set the signal on a rejected fight (insufficient attack)', () => {
    const gameState = createMockGameState({
      turnEconomy: { ...makeTurnEconomy(), attack: 5, recruit: 0, spentAttack: 0, spentRecruit: 0 },
    });
    gameState.deferredConditionalGrants = [{ playerId: '0', cardId: 'diamond-form', hookIndex: 0 }];

    const moveContext = createMockMoveContext(gameState);
    fightMastermind(moveContext);

    assert.equal(
      moveContext.G.villainOrMastermindDefeatedSinceResolve,
      undefined,
      'a fight that defeats no tactic signals nothing (the flag is on the success path)',
    );
  });
});

// ---------------------------------------------------------------------------
// Final Blow (WP-687 / D-24504)
// ---------------------------------------------------------------------------

/**
 * Builds a mastermind with exactly one Tactic left (the 4th/last), so a single
 * fight defeats it and empties the deck.
 */
function lastTacticMastermind(finalBlowPending?: boolean): LegendaryGameState['mastermind'] {
  return {
    ...makeMastermindState(),
    id: 'test-mastermind' as CardExtId,
    baseCardId: 'test-mastermind-base' as CardExtId,
    tacticsDeck: ['tactic-last'] as CardExtId[],
    tacticsDefeated: ['t1', 't2', 't3'] as CardExtId[],
    ...(finalBlowPending !== undefined ? { finalBlowPending } : {}),
  };
}

/**
 * Builds a fully-defeated mastermind (deck empty, all four tactics down) that is
 * final-blow-pending — the state after the 4th tactic fell under Final Blow, ready
 * for the 5th, final fight.
 */
function pendingFinalBlowMastermind(): LegendaryGameState['mastermind'] {
  return {
    ...makeMastermindState(),
    id: 'test-mastermind' as CardExtId,
    baseCardId: 'test-mastermind-base' as CardExtId,
    tacticsDeck: [] as CardExtId[],
    tacticsDefeated: ['t1', 't2', 't3', 'tactic-last'] as CardExtId[],
    finalBlowPending: true,
  };
}

describe('fightMastermind — Final Blow (WP-687 / D-24504)', () => {
  it('OFF (default): the 4th-tactic defeat latches the assured win, deferred to turn end (WP-732)', () => {
    const gameState = createMockGameState({
      turnEconomy: { ...makeTurnEconomy(), attack: 10, recruit: 0, spentAttack: 0, spentRecruit: 0 },
      mastermind: lastTacticMastermind(),
    });

    const moveContext = createMockMoveContext(gameState);
    fightMastermind(moveContext);

    // why: WP-732 / D-24553 — with Final Blow off, defeating the last tactic assures
    // victory but the win now resolves at turn end (the player finishes their turn),
    // so the vanquish latches PENDING, not the terminal counter.
    assert.equal(
      moveContext.G.counters[ENDGAME_CONDITIONS.MASTERMIND_DEFEATED_PENDING],
      1,
      'with Final Blow off, defeating the last tactic latches the victory-assured PENDING counter',
    );
    assert.equal(
      moveContext.G.counters[ENDGAME_CONDITIONS.MASTERMIND_DEFEATED],
      undefined,
      'the terminal counter is NOT set at the vanquish (it resolves at turn end)',
    );
    assert.equal(
      moveContext.G.mastermind.finalBlowPending,
      undefined,
      'finalBlowPending is never set when Final Blow is off (omitted -> byte-identical)',
    );
  });

  it('ON: the 4th-tactic defeat does NOT win — it latches finalBlowPending', () => {
    const gameState = {
      ...createMockGameState({
        turnEconomy: { ...makeTurnEconomy(), attack: 10, recruit: 0, spentAttack: 0, spentRecruit: 0 },
        mastermind: lastTacticMastermind(),
      }),
      finalBlow: true,
    };

    const moveContext = createMockMoveContext(gameState);
    fightMastermind(moveContext);

    assert.deepStrictEqual(
      moveContext.G.mastermind.tacticsDeck,
      [],
      'the last tactic is still defeated (deck empty)',
    );
    assert.equal(
      moveContext.G.counters[ENDGAME_CONDITIONS.MASTERMIND_DEFEATED],
      undefined,
      'under Final Blow the 4th-tactic defeat must NOT set MASTERMIND_DEFEATED',
    );
    assert.equal(
      moveContext.G.mastermind.finalBlowPending,
      true,
      'the Mastermind is now final-blow-pending (fightable a 5th, final time)',
    );
    assert.equal(moveContext.G.turnEconomy.spentAttack, 8, 'the tactic still cost attack');
  });

  it('ON: the 5th fight awards the Mastermind card to the victory pile and wins', () => {
    const gameState = {
      ...createMockGameState({
        turnEconomy: { ...makeTurnEconomy(), attack: 10, recruit: 0, spentAttack: 0, spentRecruit: 0 },
        mastermind: pendingFinalBlowMastermind(),
      }),
      finalBlow: true,
    };

    const moveContext = createMockMoveContext(gameState);
    fightMastermind(moveContext);

    const victory = moveContext.G.playerZones['0']!.victory;
    assert.ok(
      victory.includes('test-mastermind-base'),
      'the Mastermind base card is awarded to the fighting player victory pile',
    );
    assert.equal(
      victory.filter((id) => id === 'test-mastermind-base').length,
      1,
      'the Mastermind card enters the victory pile EXACTLY once (no double-award)',
    );
    // why: WP-732 / D-24553 — the Final Blow win defers identically to the normal
    // vanquish: it latches PENDING, and the terminal win resolves at turn end.
    assert.equal(
      moveContext.G.counters[ENDGAME_CONDITIONS.MASTERMIND_DEFEATED_PENDING],
      1,
      'the final blow latches MASTERMIND_DEFEATED_PENDING (assured win, resolved at turn end)',
    );
    assert.equal(
      moveContext.G.counters[ENDGAME_CONDITIONS.MASTERMIND_DEFEATED],
      undefined,
      'the terminal counter is NOT set at the final blow (it resolves at turn end)',
    );
    assert.equal(
      moveContext.G.mastermind.finalBlowPending,
      false,
      'finalBlowPending is cleared once the card is awarded',
    );
    assert.equal(moveContext.G.turnEconomy.spentAttack, 8, 'the final fight pays the Mastermind fight cost');
    const lastEvent = moveContext.G.notableEvents.at(-1);
    assert.equal(lastEvent?.type, 'mastermindDefeated', 'the 5th fight emits the mastermindDefeated notable event');
  });

  it('ON: the 5th fight with insufficient attack is a silent no-op', () => {
    const gameState = {
      ...createMockGameState({
        turnEconomy: { ...makeTurnEconomy(), attack: 5, recruit: 0, spentAttack: 0, spentRecruit: 0 }, // < fightCost 8
        mastermind: pendingFinalBlowMastermind(),
      }),
      finalBlow: true,
    };
    const economyBefore = { ...gameState.turnEconomy };

    const moveContext = createMockMoveContext(gameState);
    fightMastermind(moveContext);

    assert.equal(
      moveContext.G.playerZones['0']!.victory.includes('test-mastermind-base'),
      false,
      'the Mastermind card is NOT awarded when attack is insufficient',
    );
    assert.equal(
      moveContext.G.counters[ENDGAME_CONDITIONS.MASTERMIND_DEFEATED],
      undefined,
      'no win on an under-resourced final fight',
    );
    assert.deepStrictEqual(
      moveContext.G.turnEconomy,
      economyBefore,
      'the under-resourced final fight spends nothing (silent no-op)',
    );
    assert.equal(
      moveContext.G.mastermind.finalBlowPending,
      true,
      'the Mastermind stays final-blow-pending after a failed final fight',
    );
  });
});

// ---------------------------------------------------------------------------
// D-24518 — a vanquishing tactic must not leave a dangling pending choice
// ---------------------------------------------------------------------------

const ELECTROMAGNETIC_BUBBLE_TACTIC_ID =
  'core-mastermind-magneto-electromagnetic-bubble' as CardExtId;
const RUTHLESS_DICTATOR_TACTIC_ID =
  'core-mastermind-red-skull-ruthless-dictator' as CardExtId;

/** A deterministic reverse-shuffle context (the pattern the onFight tests above use). */
const REVERSE_SHUFFLE = { random: { Shuffle: <T,>(items: T[]): T[] => [...items].reverse() } };

/** Seeds two in-play X-Men Heroes on player 0 so Electromagnetic Bubble parks (>= 2 eligible). */
function seedTwoInPlayXMenHeroes(gameState: LegendaryGameState): void {
  const firstHero = 'core/cyclops/optic-blast#1' as CardExtId;
  const secondHero = 'core/cyclops/optic-blast#2' as CardExtId;
  gameState.playerZones['0']!.inPlay = [firstHero, secondHero];
  gameState.cardTraits = {
    [firstHero]: { heroClass: null, team: 'x-men' },
    [secondHero]: { heroClass: null, team: 'x-men' },
  };
}

describe('WP-732 / D-24553 — a vanquishing tactic defers the win and leaves its parked choice resolvable', () => {
  it('vanquishing on Electromagnetic Bubble latches PENDING and the next-hand pick SURVIVES', () => {
    const gameState = createMockGameState({
      mastermind: { ...makeMastermindState(),
        id: 'core/magneto' as CardExtId,
        baseCardId: 'core-mastermind-magneto-magneto' as CardExtId,
        tacticsDeck: [ELECTROMAGNETIC_BUBBLE_TACTIC_ID],
        tacticsDefeated: [] as CardExtId[],
      },
    });
    seedTwoInPlayXMenHeroes(gameState);

    defeatMastermindTacticCore(gameState, { currentPlayer: '0' }, REVERSE_SHUFFLE);

    // why: WP-732 / D-24553 — the vanquish assures victory (PENDING) but the game
    // is not over, so a choice the final Tactic's Fight ability parked legitimately
    // stands and is resolvable during the rest of the winning player's turn. The
    // D-24518 drop now runs only at the turn-end promotion.
    assert.equal(gameState.counters[ENDGAME_CONDITIONS.MASTERMIND_DEFEATED_PENDING], 1,
      'defeating the last tactic latches the victory-assured PENDING counter');
    assert.equal(gameState.counters[ENDGAME_CONDITIONS.MASTERMIND_DEFEATED], undefined,
      'the terminal counter is not set at the vanquish');
    assert.equal(gameState.pendingElectromagneticBubbleChoices?.length ?? 0, 1,
      'the next-hand X-Men pick survives the vanquish (resolvable during the finished turn)');
  });

  it('vanquishing on Ruthless Dictator latches PENDING and the deck-scry choice SURVIVES', () => {
    const gameState = createMockGameState({
      mastermind: { ...makeMastermindState(),
        id: 'core/red-skull' as CardExtId,
        baseCardId: 'core-mastermind-red-skull-red-skull' as CardExtId,
        tacticsDeck: [RUTHLESS_DICTATOR_TACTIC_ID],
        tacticsDefeated: [] as CardExtId[],
      },
    });
    gameState.playerZones['0']!.deck = ['c1', 'c2', 'c3'] as CardExtId[];

    defeatMastermindTacticCore(gameState, { currentPlayer: '0' }, REVERSE_SHUFFLE);

    assert.equal(gameState.counters[ENDGAME_CONDITIONS.MASTERMIND_DEFEATED_PENDING], 1,
      'defeating the last tactic latches the victory-assured PENDING counter');
    assert.equal(gameState.pendingRuthlessDictatorChoices?.length ?? 0, 1,
      'the deck-scry choice survives the vanquish (resolvable during the finished turn)');
  });

  it('a NON-final Electromagnetic Bubble defeat STILL parks the pick (unchanged)', () => {
    const gameState = createMockGameState({
      mastermind: { ...makeMastermindState(),
        id: 'core/magneto' as CardExtId,
        baseCardId: 'core-mastermind-magneto-magneto' as CardExtId,
        tacticsDeck: [ELECTROMAGNETIC_BUBBLE_TACTIC_ID, 'tactic-2' as CardExtId],
        tacticsDefeated: [] as CardExtId[],
      },
    });
    seedTwoInPlayXMenHeroes(gameState);

    defeatMastermindTacticCore(gameState, { currentPlayer: '0' }, REVERSE_SHUFFLE);

    assert.notEqual(gameState.counters[ENDGAME_CONDITIONS.MASTERMIND_DEFEATED], 1,
      'a tactic remains — not the vanquishing blow');
    assert.equal(gameState.pendingElectromagneticBubbleChoices?.length ?? 0, 1,
      'a mid-game defeat still parks the pick unchanged');
  });

  it('Final Blow: the 4th-tactic Electromagnetic Bubble defeat parks the pick (win deferred, choice stands)', () => {
    // why: the guard keys on MASTERMIND_DEFEATED === 1, NOT areAllTacticsDefeated. Under
    // the optional Final Blow rule the 4th-tactic defeat latches finalBlowPending and does
    // NOT set MASTERMIND_DEFEATED — the game is not over — so the parked choice is legitimate.
    const gameState = createMockGameState({
      mastermind: { ...makeMastermindState(),
        id: 'core/magneto' as CardExtId,
        baseCardId: 'core-mastermind-magneto-magneto' as CardExtId,
        tacticsDeck: [ELECTROMAGNETIC_BUBBLE_TACTIC_ID],
        tacticsDefeated: [] as CardExtId[],
      },
    });
    gameState.finalBlow = true;
    seedTwoInPlayXMenHeroes(gameState);

    defeatMastermindTacticCore(gameState, { currentPlayer: '0' }, REVERSE_SHUFFLE);

    assert.notEqual(gameState.counters[ENDGAME_CONDITIONS.MASTERMIND_DEFEATED], 1,
      'Final Blow defers the win — MASTERMIND_DEFEATED is not set on the 4th-tactic defeat');
    assert.equal(gameState.mastermind.finalBlowPending, true, 'the final blow is pending');
    assert.equal(gameState.pendingElectromagneticBubbleChoices?.length ?? 0, 1,
      'under Final Blow the game is not over, so the parked pick legitimately stands');
  });

  // why: WP-732 / D-24553 — the complete-`pending*`-field drift guard (that the
  // end-of-game drop clears EVERY pending field) MOVED to
  // endgame/mastermindVictory.logic.test.ts along with dropAllPendingPlayerChoices,
  // because the drop is now performed at the turn-end promotion, not at the vanquish.
  // The core no longer touches any pending field, so what remains here is the pin
  // that a defeat (vanquishing or not) leaves parked choices intact.

  it('a NON-vanquishing defeat leaves seeded pending fields untouched (the core never drops)', () => {
    const gameState = createMockGameState({
      mastermind: { ...makeMastermindState(),
        id: 'test-mastermind' as CardExtId,
        baseCardId: 'test-mastermind-base' as CardExtId,
        tacticsDeck: ['synthetic-tactic' as CardExtId, 'tactic-2' as CardExtId],
        tacticsDefeated: [] as CardExtId[],
      },
    });
    // why: WP-732 — the core no longer drops any pending choice (the D-24518 drop
    // moved to the turn-end promotion), so a lone pending choice is left untouched.
    gameState.pendingReturnOnDiscard = [{ sentinel: true }] as unknown as LegendaryGameState['pendingReturnOnDiscard'];

    defeatMastermindTacticCore(gameState, { currentPlayer: '0' }, REVERSE_SHUFFLE);

    assert.notEqual(gameState.counters[ENDGAME_CONDITIONS.MASTERMIND_DEFEATED], 1,
      'a tactic remains — not the vanquishing blow');
    assert.equal(gameState.pendingReturnOnDiscard?.length ?? 0, 1,
      'a non-winning defeat does not clear pending choices');
  });
});

// ---------------------------------------------------------------------------
// WP-736 / D-24556 / D-24557 — Excessive Violence fight-overspend (mastermind)
// ---------------------------------------------------------------------------

describe('fightMastermind — Excessive Violence overspend (WP-736 / D-24556 / D-24557)', () => {
  // why: base mastermind fightCost is 8 (test-mastermind-base); the deck has 3 tactics, so a
  // single fight defeats ONE tactic (not the vanquish), keeping these tests off the endgame path.
  function withEvMastermind(options: {
    attack: number;
    recruit?: number;
    recruitSpendableAsAttack?: boolean;
    ledger?: string[];
    innerEffects?: { type: string; magnitude?: number }[];
    excessiveViolenceUsedThisTurn?: boolean;
  }): LegendaryGameState {
    const gameState = createMockGameState({
      turnEconomy: makeTurnEconomy({
        attack: options.attack,
        recruit: options.recruit ?? 0,
        ...(options.recruitSpendableAsAttack ? { recruitSpendableAsAttack: true } : {}),
        ...(options.ledger ? { excessiveViolencePlayedCards: options.ledger } : {}),
        ...(options.excessiveViolenceUsedThisTurn ? { excessiveViolenceUsedThisTurn: true } : {}),
      }),
    });
    gameState.playerZones['0']!.deck = ['d-1'] as LegendaryGameState['playerZones']['0']['deck'];
    gameState.heroAbilityHooks = [{
      cardId: 'rc' as CardExtId,
      timing: 'onFight',
      keywords: ['excessive-violence'],
      effects: [{ type: 'excessive-violence', excessiveViolenceEffects: (options.innerEffects ?? [{ type: 'draw', magnitude: 1 }]) as never }],
    }];
    return gameState;
  }

  it('fires the enrolled EV ability and debits ONE extra attack on a valid opt-in', () => {
    const gameState = withEvMastermind({ attack: 10, ledger: ['rc'] });
    const moveContext = createMockMoveContext(gameState);
    fightMastermind(moveContext, { useExcessiveViolence: true });

    assert.equal(moveContext.G.mastermind.tacticsDefeated.length, 1, 'one tactic is defeated');
    assert.equal(moveContext.G.turnEconomy.spentAttack, 9, 'debits requiredFightCost + 1 (8 + 1)');
    assert.equal(moveContext.G.playerZones['0']!.hand.length, 1, 'the EV draw fired at fight resolution');
    assert.strictEqual(moveContext.G.turnEconomy.excessiveViolenceUsedThisTurn, true, 'the once-per-turn guard is set');
  });

  it('does NOT fire EV again the same turn (once-per-turn) and debits no extra attack', () => {
    const gameState = withEvMastermind({ attack: 10, ledger: ['rc'], excessiveViolenceUsedThisTurn: true });
    const moveContext = createMockMoveContext(gameState);
    fightMastermind(moveContext, { useExcessiveViolence: true });

    assert.equal(moveContext.G.turnEconomy.spentAttack, 8, 'only requiredFightCost is debited (no extra attack)');
    assert.equal(moveContext.G.playerZones['0']!.hand.length, 0, 'the EV ability does NOT fire a second time this turn');
  });

  it('declines silently to a normal fight when the extra +1 is unaffordable', () => {
    const gameState = withEvMastermind({ attack: 8, ledger: ['rc'] });
    const moveContext = createMockMoveContext(gameState);
    fightMastermind(moveContext, { useExcessiveViolence: true });

    assert.equal(moveContext.G.mastermind.tacticsDefeated.length, 1, 'the tactic is defeated at the normal cost');
    assert.equal(moveContext.G.turnEconomy.spentAttack, 8, 'only requiredFightCost is debited — the unaffordable +1 declines');
    assert.equal(moveContext.G.playerZones['0']!.hand.length, 0, 'EV did not fire (no extra attack)');
    assert.strictEqual(moveContext.G.turnEconomy.excessiveViolenceUsedThisTurn, undefined, 'the guard is not set on a declined opt-in');
  });

  it('a normal fight (no useExcessiveViolence) is byte-identical — no EV fire, no new fields', () => {
    const gameState = withEvMastermind({ attack: 10, ledger: ['rc'] });
    const moveContext = createMockMoveContext(gameState);
    fightMastermind(moveContext);

    assert.equal(moveContext.G.turnEconomy.spentAttack, 8, 'a normal fight debits only requiredFightCost');
    assert.equal(moveContext.G.playerZones['0']!.hand.length, 0, 'EV does not fire without the opt-in');
    assert.strictEqual(moveContext.G.turnEconomy.excessiveViolenceUsedThisTurn, undefined, 'the guard stays absent');
  });
});
