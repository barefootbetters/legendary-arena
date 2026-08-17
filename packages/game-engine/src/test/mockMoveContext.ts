/**
 * Shared test helper: a COMPLETE mock move context for game engine tests.
 *
 * Move functions take `FnContext<LegendaryGameState> & { playerID }`, which
 * carries boardgame.io's three plugin APIs in full: `events` (8 members),
 * `random` (8 members) and `log` (1). Before WP-569 every test file built its
 * own literal covering only the members the engine happens to call, which is
 * not a smaller mock — it is a structurally invalid one (D-24378).
 *
 * why: this module lives BESIDE `mockCtx.ts` rather than inside it because
 * `mockCtx.ts` is production-reachable — `src/replay/replay.execute.ts` and
 * `src/replay/buildSnapshotSequence.ts` import `makeMockCtx` at runtime and use
 * its reverse-shuffle as the replay pipeline's deterministic RNG. Editing that
 * file would drag a determinism surface into a test-typing change.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState } from '../types.js';
import { makeMockCtx } from './mockCtx.js';

/** The context shape every engine move function destructures. */
export type MockMoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/**
 * Optional overrides for makeMockMoveContext.
 */
export interface MockMoveContextOverrides {
  /** Seat taking the move. Defaults to '0'. */
  playerID?: PlayerID;
  /** Number of seats in the match. Defaults to 1. */
  numPlayers?: number;
  /** Match phase. Defaults to 'play'. */
  phase?: string;
  /** Turn number. Defaults to 1. */
  turn?: number;
}

/**
 * Builds the message a forbidden plugin-API stub throws.
 *
 * @param member - The plugin API member the engine must never call.
 * @param reason - Why the architecture forbids it.
 * @returns The full-sentence error message.
 */
function forbiddenCallMessage(member: string, reason: string): string {
  return (
    `A test mock's ${member}() was called, but the Legendary Arena engine must never call it: ` +
    `${reason} If a move genuinely needs this boardgame.io API, that is an architecture change ` +
    `and belongs in ARCHITECTURE.md and DECISIONS.md before the mock is relaxed.`
  );
}

/**
 * Creates a complete mock move context for a game state.
 *
 * why: the five EventsAPI members and seven RandomAPI members stubbed below
 * THROW rather than no-op. They are exactly the calls the architecture forbids
 * — `.claude/rules/architecture.md` §Phase & Turn Transitions allows only
 * `events.setPhase` and `events.endTurn`, and §Determinism routes all
 * randomness through `random.Shuffle`. Verified at WP-569 drafting: non-test
 * engine source calls `events.endTurn` 47 times, `events.setPhase` 9 times and
 * `random.Shuffle` 65 times, and none of the twelve members below even once.
 * Throwing makes the completed type surface double as a runtime assertion of
 * those rules; a no-op stub would satisfy the compiler while leaving a real
 * violation silent (D-24378 §1).
 *
 * @param gameState - The game state the move will read and mutate.
 * @param overrides - Optional seat, player-count, phase and turn overrides.
 * @returns A context satisfying FnContext<LegendaryGameState> & { playerID }.
 */
export function makeMockMoveContext(
  gameState: LegendaryGameState,
  overrides?: MockMoveContextOverrides,
): MockMoveContext {
  const playerID = overrides?.playerID ?? '0';
  const numPlayers = overrides?.numPlayers ?? 1;
  const setupContext = makeMockCtx({ numPlayers });

  const playOrder: PlayerID[] = [];
  for (let seatIndex = 0; seatIndex < numPlayers; seatIndex += 1) {
    playOrder.push(String(seatIndex));
  }

  return {
    G: gameState,
    ctx: {
      numPlayers,
      playOrder,
      playOrderPos: 0,
      activePlayers: null,
      currentPlayer: playerID,
      numMoves: 0,
      turn: overrides?.turn ?? 1,
      phase: overrides?.phase ?? 'play',
    },
    playerID,
    events: {
      // The three the engine is allowed to use. No-ops: the tests assert on G,
      // not on flow transitions, which boardgame.io owns.
      endTurn: () => {},
      setPhase: () => {},
      endGame: () => {},
      endPhase: () => {
        throw new Error(
          forbiddenCallMessage('events.endPhase', 'phase changes go through events.setPhase only.'),
        );
      },
      endStage: () => {
        throw new Error(
          forbiddenCallMessage(
            'events.endStage',
            'the turn stage lives in G.currentStage, never in boardgame.io stages.',
          ),
        );
      },
      pass: () => {
        throw new Error(
          forbiddenCallMessage('events.pass', 'turn changes go through events.endTurn only.'),
        );
      },
      setActivePlayers: () => {
        throw new Error(
          forbiddenCallMessage(
            'events.setActivePlayers',
            'the engine does not use boardgame.io activePlayers; seat state lives in G.',
          ),
        );
      },
      setStage: () => {
        throw new Error(
          forbiddenCallMessage(
            'events.setStage',
            'the turn stage lives in G.currentStage, never in boardgame.io stages.',
          ),
        );
      },
    },
    random: {
      // why: Shuffle is inherited from makeMockCtx so its reverse-shuffle
      // semantics stay identical across setup and move tests. An identity
      // shuffle would let a test pass even if the shuffle step were skipped.
      Shuffle: setupContext.random.Shuffle,
      D4: () => {
        throw new Error(forbiddenCallMessage('random.D4', 'the engine rolls no dice.'));
      },
      D6: () => {
        throw new Error(forbiddenCallMessage('random.D6', 'the engine rolls no dice.'));
      },
      D10: () => {
        throw new Error(forbiddenCallMessage('random.D10', 'the engine rolls no dice.'));
      },
      D12: () => {
        throw new Error(forbiddenCallMessage('random.D12', 'the engine rolls no dice.'));
      },
      D20: () => {
        throw new Error(forbiddenCallMessage('random.D20', 'the engine rolls no dice.'));
      },
      Die: () => {
        throw new Error(forbiddenCallMessage('random.Die', 'the engine rolls no dice.'));
      },
      Number: () => {
        throw new Error(
          forbiddenCallMessage(
            'random.Number',
            'all engine randomness goes through random.Shuffle.',
          ),
        );
      },
    },
    log: {
      setMetadata: () => {},
    },
  };
}
