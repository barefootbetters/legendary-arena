/**
 * Replay execution engine for the Legendary Arena game engine.
 *
 * replayGame is a pure function that reconstructs a game from a ReplayInput
 * by building initial state and executing each move in sequence. Identical
 * inputs always produce identical outputs.
 *
 * Implements D-0201 (Replay as a First-Class Feature).
 *
 * This module is determinism-only tooling (per D-0205): it is a
 * reducer-determinism harness, not a live-match replayer. It ignores the
 * stored `ReplayInput.seed` and drives every in-game shuffle through a
 * fixed deterministic reverse-shuffle at the `random.Shuffle` call inside
 * `buildMoveContext` below. It therefore proves the engine reducer is
 * deterministic given a fixed mock RNG, but it does not reproduce the
 * live boardgame.io `ctx.random.*` sequence that drives production
 * matches. See `docs/ai/DECISIONS.md §D-0205` (RNG Truth Source for
 * Replay) and `docs/ai/MOVE_LOG_FORMAT.md §Known Gaps / Risks Gap #4`
 * for the forensics trail that led to this narrowing.
 */

import type { LegendaryGameState } from '../types.js';
import type { CardRegistryReader } from '../matchSetup.validate.js';
import type { ReplayInput, ReplayResult, ReplayMove } from './replay.types.js';
import { computeStateHash } from './replay.hash.js';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { makeMockCtx } from '../test/mockCtx.js';

// Move function imports — these files import boardgame.io types internally,
// but this file does NOT import boardgame.io directly.
import { drawCards, playCard, endTurn } from '../moves/coreMoves.impl.js';
import { revealVillainCard } from '../villainDeck/villainDeck.reveal.js';
import { fightVillain } from '../moves/fightVillain.js';
import { recruitHero } from '../moves/recruitHero.js';
import { fightMastermind } from '../moves/fightMastermind.js';
import { setPlayerReady, startMatchIfReady } from '../lobby/lobby.moves.js';
import { advanceTurnStage } from '../turn/turnLoop.js';

// why: move functions expect FnContext<LegendaryGameState> & { playerID }.
// We cannot import boardgame.io types, so we define a local structural
// interface with the fields moves actually destructure: G, playerID, ctx,
// events, random. Events are no-ops for replay; random uses deterministic
// reverse-shuffle from makeMockCtx pattern.
/**
 * Minimal move context for replay execution.
 *
 * Satisfies the structural shape that move functions destructure without
 * requiring a boardgame.io import.
 */
interface ReplayMoveContext {
  G: LegendaryGameState;
  playerID: string;
  ctx: { currentPlayer: string; numPlayers: number };
  events: { endTurn: () => void; setPhase: (phase: string) => void };
  random: { Shuffle: <T>(deck: T[]) => T[] };
}

// why: static exhaustive map from move name to move function. No dynamic
// dispatch. Covers all moves registered in LegendaryGame.moves plus lobby
// moves. advanceStage uses advanceTurnStage directly because the game.ts
// wrapper is not exported.

/** Move function type for the replay move map. */
type MoveFn = (context: ReplayMoveContext, args?: unknown) => void;

/**
 * Handles the advanceStage move in replay context.
 *
 * advanceStage is a local function in game.ts that wraps advanceTurnStage
 * from turnLoop.ts. Since it is not exported, we reconstruct the equivalent
 * behavior by calling advanceTurnStage directly.
 */
function replayAdvanceStage(context: ReplayMoveContext): void {
  // why: advanceTurnStage expects TurnLoopState (has currentStage) and
  // TurnLoopContext (has events.endTurn). G satisfies TurnLoopState and
  // context.events satisfies TurnLoopContext structurally.
  advanceTurnStage(context.G, {
    events: { endTurn: context.events.endTurn },
  });
}

/**
 * Static map from move name strings to move functions.
 *
 * Every move registered in LegendaryGame.moves has an entry here.
 * Unknown move names are handled gracefully (warning + skip).
 */
const MOVE_MAP: Record<string, MoveFn> = {
  drawCards: (context, args) => drawCards(context as never, args as never),
  playCard: (context, args) => playCard(context as never, args as never),
  endTurn: (context) => endTurn(context as never),
  advanceStage: (context) => replayAdvanceStage(context),
  revealVillainCard: (context) => revealVillainCard(context as never),
  fightVillain: (context, args) => fightVillain(context as never, args as never),
  recruitHero: (context, args) => recruitHero(context as never, args as never),
  fightMastermind: (context) => fightMastermind(context as never),
  setPlayerReady: (context, args) => setPlayerReady(context as never, args as never),
  startMatchIfReady: (context) => startMatchIfReady(context as never),
};

/**
 * Constructs a ReplayMoveContext for executing a single move during replay.
 *
 * @param gameState - The current mutable game state.
 * @param playerId - The player executing the move.
 * @param numPlayers - Total number of players in the match.
 * @returns A context object satisfying the move function signature.
 */
function buildMoveContext(
  gameState: LegendaryGameState,
  playerId: string,
  numPlayers: number,
): ReplayMoveContext {
  return {
    G: gameState,
    playerID: playerId,
    ctx: {
      currentPlayer: playerId,
      numPlayers,
    },
    // why: events are no-ops during replay. endTurn and setPhase have no
    // framework to call — moves that invoke them simply become no-ops.
    // This is acceptable because replay reconstructs the full move sequence
    // including explicit advanceStage moves and phase transitions.
    events: {
      endTurn: () => {},
      setPhase: () => {},
    },
    // why: deterministic reverse-shuffle from makeMockCtx pattern. MVP replay
    // uses this predictable shuffle for all in-game reshuffles. The seed field
    // in ReplayInput is stored for future seed-faithful replay (D-0201).
    random: {
      Shuffle: <T>(deck: T[]): T[] => [...deck].reverse(),
    },
  };
}

/**
 * Replays a game from a canonical ReplayInput against the determinism-only
 * harness and returns the final state with a deterministic hash.
 *
 * This function drives the engine reducer under a fixed mock RNG so that
 * identical inputs always produce identical outputs — that property is the
 * entire claim. It does not replay live-match RNG: the stored
 * `ReplayInput.seed` is ignored, and every in-game shuffle uses the
 * deterministic reverse-shuffle supplied by `buildMoveContext` below. A
 * future feature that reconstructs the `ctx.random.*` sequence from a
 * production boardgame.io match must therefore be built on a separate
 * pipeline gated on D-0203; this function cannot substitute for one.
 *
 * See `docs/ai/DECISIONS.md §D-0205` (RNG Truth Source for Replay) for
 * the decision that narrows this claim, and
 * `docs/ai/MOVE_LOG_FORMAT.md §Known Gaps / Risks Gap #4` for the
 * forensics trail.
 *
 * Pure function — identical input always produces identical output. No I/O,
 * no side effects.
 *
 * @param input - The canonical replay input (seed, config, players, moves).
 *                The `seed` field is stored but ignored by this harness;
 *                see D-0205.
 * @param registry - Card registry reader for setup-time resolution.
 * @returns The replay result with final state, hash, and move count.
 */
export function replayGame(
  input: ReplayInput,
  registry: CardRegistryReader,
): ReplayResult {
  // why: reconstruction-from-inputs approach — G is never persisted, so any
  // match can be reconstructed by replaying the setup config and ordered
  // moves. This implements D-0201 (Replay as a First-Class Feature).

  // Step 1: Construct initial game state via buildInitialGameState
  // why: MVP replay uses makeMockCtx for deterministic setup shuffling.
  // The seed field is stored in ReplayInput for future seed-faithful replay.
  const setupContext = makeMockCtx({ numPlayers: input.playerOrder.length });
  const initialState = buildInitialGameState(input.setupConfig, registry, setupContext);

  // Step 2: Execute moves in sequence
  let gameState = initialState;
  const numPlayers = input.playerOrder.length;

  for (const move of input.moves) {
    const moveFn = MOVE_MAP[move.moveName];

    if (!moveFn) {
      gameState.messages.push(
        `Replay warning: unknown move name "${move.moveName}" — skipped.`,
      );
      continue;
    }

    const moveContext = buildMoveContext(gameState, move.playerId, numPlayers);
    moveFn(moveContext, move.args);
  }

  // Step 3: Compute canonical state hash
  const stateHash = computeStateHash(gameState);

  return {
    finalState: gameState,
    stateHash,
    moveCount: input.moves.length,
  };
}
