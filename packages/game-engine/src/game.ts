import type { Ctx, FnContext, Game, PlayerID } from 'boardgame.io';
import type { MatchConfiguration, LegendaryGameState } from './types.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/**
 * Play a card from the active player's hand.
 *
 * Stub move -- no side effects. Future Work Packets will implement card
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
 * Stub move -- no side effects. Future Work Packets will implement cleanup,
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
 * @see docs/ai/ARCHITECTURE.md -- "The LegendaryGame Object"
 */
export const LegendaryGame: Game<LegendaryGameState, Record<string, unknown>, MatchConfiguration> = {
  name: 'legendary-arena',

  // why: Legendary supports 1-5 players. Solo play (1) is a core mode in the
  // physical game; 5 is the maximum supported by the base set rules.
  minPlayers: 1,
  maxPlayers: 5,

  /**
   * Validates setupData before setup() is called. boardgame.io calls this
   * from the lobby create endpoint -- returning a string triggers a 400
   * response with the string as the error message.
   *
   * @param setupData - the setupData from the create request body
   * @param _numPlayers - player count (validated separately by boardgame.io)
   * @returns an error message string if invalid, undefined if valid
   */
  validateSetupData: (
    setupData: MatchConfiguration | undefined,
    _numPlayers: number,
  ): string | undefined => {
    if (!setupData) {
      return 'Missing setupData. The create request must include a setupData ' +
        'object with a valid MatchConfiguration (schemeId, mastermindId, etc.).';
    }
    return undefined;
  },

  /**
   * Initializes the game state from a MatchConfiguration payload.
   *
   * setup() is the single external-input boundary for the engine. After this
   * function returns, the engine operates solely on G and ctx -- no further
   * external configuration is accepted.
   *
   * @param context - boardgame.io setup context (ctx, events, random, log)
   * @param matchConfiguration - the match setup payload with card ext_ids and counts
   * @returns the initial LegendaryGameState
   * @throws {Error} if matchConfiguration is not provided
   */
  // why: setup() accepts MatchConfiguration so the server can pass in the
  // match parameters chosen during lobby/matchmaking. This is the only point
  // where external configuration enters the engine.
  setup: (_context: { ctx: Ctx }, matchConfiguration?: MatchConfiguration): LegendaryGameState => {
    // why: validateSetupData guards this at the lobby API layer, but setup()
    // can also be called directly in tests or by boardgame.io internals
    // (e.g. rematch). This check is a belt-and-suspenders safety net.
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
  // (lobby -> setup -> play -> end) but do not cause automatic transitions.
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
