import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
// why: WP-411 / D-24223 — the AC-3 wiring test drives a REAL boardgame.io match
// through the framework's own reducer to prove the top-level `endIf` sets
// `ctx.gameover`. The deep dist entry is the same one the server-layer replay /
// competition tests use (matchReplay.logic.test.ts, competition.logic.test.ts);
// it exposes InitializeGame + CreateGameReducer and carries no types (cast
// below). This is the ONLY vehicle that exercises the boardgame.io wiring —
// the engine-runner simulation harness re-implements the turn loop and calls
// evaluateEndgame directly, so it never sets `ctx.gameover` (see EC-446
// Execution Amendment).
import * as boardgameInternal from 'boardgame.io/dist/cjs/internal.js';
import { LegendaryGame } from './game.js';
import type { LegendaryGameState, MatchConfiguration } from './types.js';
import { HAND_SIZE } from './moves/drawCards.logic.js';
import { makeMockCtx } from './test/mockCtx.js';
import { evaluateEndgame } from './endgame/endgame.evaluate.js';
import { ENDGAME_CONDITIONS } from './endgame/endgame.types.js';

// why: the deep dist entry carries no types; cast to the minimal shape these
// tests use — mirrors the server-layer precedent (matchReplay.logic.test.ts).
const { InitializeGame, CreateGameReducer } = boardgameInternal as unknown as {
  InitializeGame(config: {
    game: unknown;
    numPlayers: number;
    setupData: unknown;
  }): { G: unknown; ctx: { currentPlayer: unknown; gameover?: unknown } };
  CreateGameReducer(config: {
    game: unknown;
    isClient: boolean;
  }): (
    state: unknown,
    action: { type: string; payload: unknown },
  ) => { G: unknown; ctx: { currentPlayer: unknown; gameover?: unknown } };
};

/**
 * Creates a valid mock MatchConfiguration for testing.
 *
 * All values are plausible ext_id strings and counts that satisfy the
 * MatchConfiguration interface. These are not real card ext_ids — they exist
 * only to exercise the setup contract.
 */
/**
 * @amended WP-113 PS-7: bare slug fixtures migrated to set-qualified
 *   form `'<setAbbr>/<slug>'` per the qualified-ID contract
 *   (per D-10014). Assertions below
 *   were updated to match.
 */
function createMockMatchConfiguration(): MatchConfiguration {
  return {
    schemeId: 'test/test-scheme-001',
    mastermindId: 'test/test-mastermind-001',
    villainGroupIds: ['test/test-villain-group-001', 'test/test-villain-group-002'],
    henchmanGroupIds: ['test/test-henchman-group-001'],
    heroDeckIds: ['test/test-hero-deck-001', 'test/test-hero-deck-002', 'test/test-hero-deck-003'],
    bystandersCount: 30,
    woundsCount: 30,
    officersCount: 30,
    sidekicksCount: 0,
  };
}

describe('LegendaryGame', () => {
  it('setup() returns a JSON-serializable game state', () => {
    const mockConfiguration = createMockMatchConfiguration();

    // why: boardgame.io 0.50.x setup receives (context, setupData) where
    // context includes { ctx, random, events, log }. makeMockCtx provides
    // the minimal shape needed by buildInitialGameState.
    const mockContext = makeMockCtx({ numPlayers: 2 });
    const gameState = LegendaryGame.setup!(
      mockContext as Parameters<NonNullable<typeof LegendaryGame.setup>>[0],
      mockConfiguration,
    );

    // G must be JSON-serializable at all times — no functions, classes, Maps,
    // Sets, Dates, or Symbols. If this throws, the game state contract is broken.
    const serialized = JSON.stringify(gameState);
    assert.ok(serialized, 'JSON.stringify(G) must produce a non-empty string');

    // Round-trip: parse the serialized state and verify it matches the original.
    const deserialized = JSON.parse(serialized);
    assert.deepStrictEqual(
      deserialized,
      gameState,
      'Game state must survive JSON round-trip without data loss',
    );
  });

  it('setup() includes all 9 MatchConfiguration fields in the returned state', () => {
    const mockConfiguration = createMockMatchConfiguration();

    const mockContext = makeMockCtx({ numPlayers: 2 });
    const gameState = LegendaryGame.setup!(
      mockContext as Parameters<NonNullable<typeof LegendaryGame.setup>>[0],
      mockConfiguration,
    );

    assert.equal(gameState.matchConfiguration.schemeId, 'test/test-scheme-001');
    assert.equal(gameState.matchConfiguration.mastermindId, 'test/test-mastermind-001');
    assert.deepStrictEqual(gameState.matchConfiguration.villainGroupIds, ['test/test-villain-group-001', 'test/test-villain-group-002']);
    assert.deepStrictEqual(gameState.matchConfiguration.henchmanGroupIds, ['test/test-henchman-group-001']);
    assert.deepStrictEqual(gameState.matchConfiguration.heroDeckIds, ['test/test-hero-deck-001', 'test/test-hero-deck-002', 'test/test-hero-deck-003']);
    assert.equal(gameState.matchConfiguration.bystandersCount, 30);
    assert.equal(gameState.matchConfiguration.woundsCount, 30);
    assert.equal(gameState.matchConfiguration.officersCount, 30);
    assert.equal(gameState.matchConfiguration.sidekicksCount, 0);
  });

  it('setup() throws when matchConfiguration is not provided', () => {
    const mockContext = makeMockCtx({ numPlayers: 2 });
    assert.throws(
      () => {
        LegendaryGame.setup!(
          mockContext as Parameters<NonNullable<typeof LegendaryGame.setup>>[0],
          undefined,
        );
      },
      {
        message: /requires a MatchConfiguration argument/,
      },
    );
  });

  it('defines exactly 4 phases: lobby, setup, play, end', () => {
    const phaseNames = Object.keys(LegendaryGame.phases ?? {});
    assert.deepStrictEqual(
      phaseNames.sort(),
      ['end', 'lobby', 'play', 'setup'],
      'LegendaryGame must define exactly 4 phases: lobby, setup, play, end',
    );
  });

  it('defines moves: advanceStage, dodgeCard, drawCards, endTurn, fightMastermind, fightVillain, healWounds, playCard, playFromUndercover, recruitHero, resolveDiscardChoice, resolveDiscardToPlay, resolveDrawOrEmpowered, resolveHeroChoice, resolveKoHeroChoice, resolveOptionalKoReward, resolveOptionalPutBottomHQ, resolvePutAnyNumberBottomHQ, resolveReorderChoice, resolveReturnZeroCostDiscard, resolveScryKoChoice, resolveVictoryPileCardPick, revealVillainCard, and sendUndercover', () => {
    const moveNames = Object.keys(LegendaryGame.moves ?? {});
    assert.deepStrictEqual(
      moveNames.sort(),
      // why: WP-285 / EC-317 added resolveVictoryPileCardPick (14 → 15); WP-286 / EC-318 added
      // resolveDrawOrEmpowered (15 → 16); the Ionic Energy optional-put-bottom-hq fix added
      // resolveOptionalPutBottomHQ (16 → 17); D-24132 added resolvePutAnyNumberBottomHQ (17 → 18);
      // D-24139 added resolveReturnZeroCostDiscard (18 → 19); WP-379 / D-24179 added healWounds (19 → 20); WP-383 / D-24184 added resolveDiscardToPlay (20 → 21);
      // WP-470 / D-24282 added resolveScryKoChoice (21 → 22) — sorts between resolveReturnZeroCostDiscard and resolveVictoryPileCardPick; NOT a CORE_MOVE_NAME (mirrors resolveKoHeroChoice).
      // WP-476 / D-24284 added resolveDiscardChoice (22 → 23) — sorts between recruitHero and resolveDiscardToPlay; NOT a CORE_MOVE_NAME (mirrors resolveScryKoChoice).
      // WP-479 / D-24286 added resolveReorderChoice (23 → 24) — sorts between resolvePutAnyNumberBottomHQ and resolveReturnZeroCostDiscard; NOT a CORE_MOVE_NAME (mirrors resolveScryKoChoice / resolveDiscardChoice).
      ['advanceStage', 'dodgeCard', 'drawCards', 'endTurn', 'fightMastermind', 'fightVillain', 'healWounds', 'playCard', 'playFromUndercover', 'recruitHero', 'resolveDiscardChoice', 'resolveDiscardToPlay', 'resolveDrawOrEmpowered', 'resolveHeroChoice', 'resolveKoHeroChoice', 'resolveOptionalKoReward', 'resolveOptionalPutBottomHQ', 'resolvePutAnyNumberBottomHQ', 'resolveReorderChoice', 'resolveReturnZeroCostDiscard', 'resolveScryKoChoice', 'resolveVictoryPileCardPick', 'revealVillainCard', 'sendUndercover'],
      'LegendaryGame must define exactly 23 moves',
    );
  });

  it('configures lobby phase with activePlayers: { all: "lobbyReady" } + matching stages block per D-10007', () => {
    // why: drift-detection lock for the WP-100 fix-forward (D-10007). Without
    // this config, boardgame.io rejects setPlayerReady / startMatchIfReady
    // from any player other than ctx.currentPlayer with "player not active",
    // making lobby ready-up impossible for player 1+. The stage-name approach
    // (`{ all: 'lobbyReady' }` + empty `stages.lobbyReady: {}`) is the
    // type-clean equivalent of boardgame.io's ActivePlayers.ALL constant
    // (which uses `{ all: Stage.NULL }` where Stage.NULL: null at runtime,
    // but is typed as `any` in turn-order.d.ts). The bare-null literal is
    // rejected by `StageArg = StageName | object`; the named empty stage
    // satisfies the type without changing runtime semantics.
    const phases = LegendaryGame.phases as
      | Record<
          string,
          {
            turn?: {
              activePlayers?: unknown;
              stages?: Record<string, unknown>;
            };
          }
        >
      | undefined;
    const lobbyPhase = phases?.lobby;
    assert.notEqual(
      lobbyPhase,
      undefined,
      'lobby phase must be configured on LegendaryGame',
    );
    assert.deepStrictEqual(
      lobbyPhase?.turn?.activePlayers,
      { all: 'lobbyReady' },
      'lobby phase turn.activePlayers must be { all: "lobbyReady" } per D-10007 — without it, only the turn-holder can submit setPlayerReady/startMatchIfReady',
    );
    assert.deepStrictEqual(
      lobbyPhase?.turn?.stages,
      { lobbyReady: {} },
      'lobby phase turn.stages.lobbyReady must exist (empty config) per D-10007 — required by boardgame.io to validate the activePlayers stage reference',
    );
  });

  it('play-phase onBegin auto-draws the active player to HAND_SIZE and sets hasDrawnThisTurn (WP-236)', () => {
    // why: WP-236 — the engine owns the start-of-turn draw. After onBegin the
    // active player's hand is filled to HAND_SIZE from their deck and
    // G.hasDrawnThisTurn is true. The auto-draw runs before the onTurnStart
    // hooks (locked onBegin order), so a hand-reading turn-start hook (e.g.
    // Magneto's hand-size trim) observes the freshly drawn hand; the default
    // onTurnStart hooks do not touch the hand, so the filled hand observed
    // here is the auto-draw's work, not a later hook's.
    const mockConfiguration = createMockMatchConfiguration();
    const mockContext = makeMockCtx({ numPlayers: 2 });
    const gameState = LegendaryGame.setup!(
      mockContext as Parameters<NonNullable<typeof LegendaryGame.setup>>[0],
      mockConfiguration,
    );

    // The active player begins their turn with an empty hand (no draw at setup).
    assert.equal(gameState.playerZones['0']!.hand.length, 0);
    const deckBefore = gameState.playerZones['0']!.deck.length;
    assert.ok(deckBefore >= HAND_SIZE, 'starting deck must have at least HAND_SIZE cards');

    const playPhase = (
      LegendaryGame.phases as Record<
        string,
        { turn?: { onBegin?: (context: unknown) => void } }
      >
    ).play;
    const onBegin = playPhase?.turn?.onBegin;
    assert.notEqual(onBegin, undefined, 'play phase must define a turn.onBegin hook');

    onBegin!({
      G: gameState,
      ctx: { currentPlayer: '0', numPlayers: 2, phase: 'play', turn: 1 },
      random: { Shuffle: <T>(deck: T[]): T[] => [...deck].reverse() },
      events: { setPhase: (): void => {}, endTurn: (): void => {} },
    } satisfies {
      G: LegendaryGameState;
      ctx: { currentPlayer: string; numPlayers: number; phase: string; turn: number };
      random: { Shuffle: <T>(deck: T[]) => T[] };
      events: { setPhase: () => void; endTurn: () => void };
    });

    assert.equal(
      gameState.playerZones['0']!.hand.length,
      HAND_SIZE,
      'onBegin must fill the active player hand to HAND_SIZE',
    );
    assert.equal(
      gameState.playerZones['0']!.deck.length,
      deckBefore - HAND_SIZE,
      'the drawn cards must come off the deck',
    );
    assert.equal(gameState.hasDrawnThisTurn, true);
  });

  it('play-phase onBegin numbers the first play turn as 1, not the framework ctx.turn (lobby offset)', () => {
    // why: the lobby phase consumes framework turn 1 (startMatchIfReady exits via
    // setPhase('play')), so the play phase's first turn arrives as ctx.turn === 2.
    // The player-facing turn (G.logMeta.turn, read by both the game-log prefix and
    // the HUD header) must be play-relative: first play turn = 1. This guards the
    // off-by-one that opened the log at "2.1.1".
    const gameState = LegendaryGame.setup!(
      makeMockCtx({ numPlayers: 2 }) as Parameters<NonNullable<typeof LegendaryGame.setup>>[0],
      createMockMatchConfiguration(),
    );
    const playPhase = (
      LegendaryGame.phases as Record<
        string,
        { turn?: { onBegin?: (context: unknown) => void } }
      >
    ).play;
    const onBegin = playPhase!.turn!.onBegin!;
    const makeContext = (turn: number): unknown => ({
      G: gameState,
      ctx: { currentPlayer: '0', numPlayers: 2, phase: 'play', turn },
      random: { Shuffle: <T>(deck: T[]): T[] => [...deck].reverse() },
      events: { setPhase: (): void => {}, endTurn: (): void => {} },
    });

    // First play turn: framework ctx.turn === 2 (lobby was turn 1) must render as 1.
    onBegin(makeContext(2));
    assert.equal(
      gameState.logMeta!.turn,
      1,
      'first play turn must be play-relative 1, not the framework ctx.turn (2)',
    );
    assert.equal(gameState.logMeta!.firstPlayTurn, 2, 'firstPlayTurn captures the first play framework turn');

    // Second play turn: framework ctx.turn === 3 must render as 2 (offset preserved).
    onBegin(makeContext(3));
    assert.equal(
      gameState.logMeta!.turn,
      2,
      'second play turn must be play-relative 2 (firstPlayTurn offset carried forward)',
    );
    assert.equal(gameState.logMeta!.firstPlayTurn, 2, 'firstPlayTurn is stable across turns');
  });

  it('defines a TOP-LEVEL endIf that returns the evaluateEndgame result for a terminal G and undefined for a mid-game G (WP-411 / D-24223 — AC-1)', () => {
    // why: AC-1 — the fix is a TOP-LEVEL LegendaryGame.endIf (sibling of
    // moves/phases), NOT a phase endIf. Only a top-level endIf sets
    // ctx.gameover. This unit-asserts the endIf's pure return contract; the
    // AC-3 test below proves the framework wiring turns that return into
    // ctx.gameover.
    const endIf = LegendaryGame.endIf;
    assert.notEqual(
      endIf,
      undefined,
      'LegendaryGame must define a top-level endIf (the only endIf that sets ctx.gameover)',
    );

    // why: the endIf must NOT be duplicated on the play phase — a phase endIf
    // only ends the phase and re-introduces the bug (D-24223). Guard the removal.
    const playPhase = (
      LegendaryGame.phases as Record<string, { endIf?: unknown }>
    ).play;
    assert.equal(
      playPhase?.endIf,
      undefined,
      'the play-phase endIf must be removed — a phase endIf never sets ctx.gameover (D-24223)',
    );

    // Terminal G: mastermind defeated → evaluateEndgame returns a heroes-win
    // result, and the endIf must return exactly that.
    const terminalState = LegendaryGame.setup!(
      makeMockCtx({ numPlayers: 2 }) as Parameters<NonNullable<typeof LegendaryGame.setup>>[0],
      createMockMatchConfiguration(),
    );
    terminalState.counters[ENDGAME_CONDITIONS.MASTERMIND_DEFEATED] = 1;
    const expected = evaluateEndgame(terminalState);
    assert.notEqual(expected, null, 'a terminal counter must make evaluateEndgame non-null');
    assert.deepStrictEqual(
      endIf!({ G: terminalState } as Parameters<NonNullable<typeof LegendaryGame.endIf>>[0]),
      expected,
      'endIf must return the evaluateEndgame result verbatim for a terminal G',
    );

    // Mid-game G: no terminal counter → evaluateEndgame is null → endIf returns
    // undefined (the game continues; the framework leaves ctx.gameover unset).
    const midGameState = LegendaryGame.setup!(
      makeMockCtx({ numPlayers: 2 }) as Parameters<NonNullable<typeof LegendaryGame.setup>>[0],
      createMockMatchConfiguration(),
    );
    assert.equal(
      evaluateEndgame(midGameState),
      null,
      'a fresh setup G must be mid-game (evaluateEndgame null)',
    );
    assert.equal(
      endIf!({ G: midGameState } as Parameters<NonNullable<typeof LegendaryGame.endIf>>[0]),
      undefined,
      'endIf must return undefined for a mid-game G',
    );
  });

  it('the top-level endIf sets ctx.gameover through boardgame.io when a match reaches a terminal condition (WP-411 / D-24223 — AC-3 wiring)', () => {
    // why: AC-3 — the bug hid because tests asserted evaluateEndgame(G) directly
    // but NEVER that the boardgame.io wiring turns that into ctx.gameover. This
    // drives a REAL match through boardgame.io's own reducer (InitializeGame →
    // lobby ready-up → startMatchIfReady → play), confirms ctx.gameover is unset
    // mid-game, then reaches a terminal condition (mastermind defeated) and
    // asserts the framework sets ctx.gameover to the evaluateEndgame result.
    // Reaching a natural mastermind defeat would require hundreds of card-data-
    // dependent moves; instead the terminal counter is injected into G and one
    // more move is dispatched so the framework runs the top-level endIf against
    // the terminal G — the exact code path the missing endIf left dead. On the
    // pre-fix code this move left ctx.gameover undefined (verified this session).
    const setupData: MatchConfiguration = createMockMatchConfiguration();
    const initialState = InitializeGame({
      game: LegendaryGame,
      numPlayers: 2,
      setupData,
    });
    const reducer = CreateGameReducer({ game: LegendaryGame, isClient: false });

    const makeMove = (
      state: unknown,
      moveName: string,
      args: unknown[],
      playerID: string,
    ): { G: unknown; ctx: { currentPlayer: unknown; gameover?: unknown } } =>
      reducer(state, {
        // why: boardgame.io dispatches a move as
        // { type: 'MAKE_MOVE', payload: { type: <moveName>, args, playerID } }
        // in the locked 0.50.x — the internal.js entry does not re-export the
        // constant, so the stable literal is used directly.
        type: 'MAKE_MOVE',
        payload: { type: moveName, args, playerID },
      });

    // Drive lobby → play: both seats ready, then start.
    let state = makeMove(initialState, 'setPlayerReady', [{ ready: true }], '0');
    state = makeMove(state, 'setPlayerReady', [{ ready: true }], '1');
    state = makeMove(state, 'startMatchIfReady', [], '0');

    assert.equal(
      state.ctx.gameover,
      undefined,
      'a mid-game match must not have ctx.gameover set',
    );

    // why: inject a terminal condition (mastermind defeated) into G — the state
    // fed to the reducer for the next move. The move itself does not touch
    // counters, so the framework's top-level endIf observes the terminal G after
    // the move and must set ctx.gameover.
    const terminalG = {
      ...(state.G as Record<string, unknown>),
      counters: {
        ...((state.G as { counters: Record<string, number> }).counters),
        [ENDGAME_CONDITIONS.MASTERMIND_DEFEATED]: 1,
      },
    };
    const terminalState = { ...state, G: terminalG };
    const expectedGameover = evaluateEndgame(terminalG as unknown as LegendaryGameState);
    assert.notEqual(expectedGameover, null, 'the injected counter must make evaluateEndgame non-null');

    const activePlayer = String(terminalState.ctx.currentPlayer);
    const finalState = makeMove(terminalState, 'advanceStage', [], activePlayer);

    assert.deepStrictEqual(
      finalState.ctx.gameover,
      expectedGameover,
      'the framework must set ctx.gameover to the evaluateEndgame result once the top-level endIf fires — the wiring whose absence was the bug',
    );
  });
});
