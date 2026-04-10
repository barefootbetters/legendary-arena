import type { Ctx, FnContext, Game, PlayerID } from 'boardgame.io';
import type { MatchConfiguration, LegendaryGameState } from './types.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/**
 * Play a card from the active player's hand.
 *
 * Stub move — no side effects. Future Work Packets will implement card
 * resolution, attack/recruit accumulation, and rule hook triggers.
 *
 * @param _context - boardgame.io move context (unused in skeleton)
 */
function playCard(_context: MoveContext): void {
  // why: move stubs return void per the Immer mutation model (boardgame.io
  // 0.50.x). Moves mutate the draft of G directly and must not return a new
  // G object. Logic will be added by subsequent Work Packets.
}

/**
 * End the current player's turn.
 *
 * Stub move — no side effects. Future Work Packets will implement cleanup,
 * discard, and draw steps before advancing the turn.
 *
 * @param _context - boardgame.io move context (unused in skeleton)
 */
function endTurn(_context: MoveContext): void {
  // why: move stubs return void per the Immer mutation model. Turn-end logic
  // (cleanup stage, discard, draw) will be added by subsequent Work Packets.
}

/**
 * The authoritative boardgame.io Game object for Legendary Arena.
 *
 * All phases, moves, hooks, and endgame logic are registered through this
 * single Game instance. No parallel or experimental Game objects may exist.
 *
 * @see docs/ai/ARCHITECTURE.md — "The LegendaryGame Object"
 */
export const LegendaryGame: Game<LegendaryGameState, Record<string, unknown>, MatchConfiguration> = {
  name: 'legendary-arena',

  /**
   * Initializes the game state from a MatchConfiguration payload.
   *
   * @param context - boardgame.io setup context (ctx, events, random, log)
   * @param matchConfiguration - the match setup payload with card ext_ids and counts
   * @returns the initial LegendaryGameState
   * @throws {Error} if matchConfiguration is not provided
   */
  // why: setup() accepts MatchConfiguration so the server can pass in the
  // match parameters chosen during lobby/matchmaking. This is the only point
  // where external configuration enters the engine. After setup, the engine
  // operates solely on G and ctx — no further external input is accepted.
  setup: (_context: { ctx: Ctx }, matchConfiguration?: MatchConfiguration): LegendaryGameState => {
    if (!matchConfiguration) {
      throw new Error(
        'LegendaryGame.setup() requires a MatchConfiguration argument. ' +
        'The server must pass the match setup payload when creating a new game.'
      );
    }

    return {
      matchConfiguration,
    };
  },

  moves: {
    playCard,
    endTurn,
  },

  // why: phase `next` fields declare the intended linear progression
  // (lobby → setup → play → end) but do not cause automatic transitions.
  // Actual transitions require explicit ctx.events.setPhase() calls, which
  // will be added by subsequent Work Packets.
  phases: {
    lobby: {
      start: true,
      next: 'setup',
    },
    setup: {
      next: 'play',
    },
    play: {
      next: 'end',
    },
    end: {},
  },
};
