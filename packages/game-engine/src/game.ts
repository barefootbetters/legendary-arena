import type { Ctx, FnContext, Game, PlayerID } from 'boardgame.io';
import type { MatchConfiguration, LegendaryGameState } from './types.js';
import { validateMatchSetup, type CardRegistryReader } from './matchSetup.validate.js';
import { buildInitialGameState } from './setup/buildInitialGameState.js';
import { TURN_STAGES } from './turn/turnPhases.types.js';
import { advanceTurnStage } from './turn/turnLoop.js';
import { drawCards, playCard, endTurn } from './moves/coreMoves.impl.js';
import { executeRuleHooks } from './rules/ruleRuntime.execute.js';
import { applyRuleEffects } from './rules/ruleRuntime.effects.js';
import { DEFAULT_IMPLEMENTATION_MAP } from './rules/ruleRuntime.impl.js';
import { evaluateEndgame } from './endgame/endgame.evaluate.js';
import { setPlayerReady, startMatchIfReady } from './lobby/lobby.moves.js';
import { revealVillainCard } from './villainDeck/villainDeck.reveal.js';

// why: The registry must be available to Game.setup() for ext_id validation,
// but boardgame.io's setup function signature does not include a registry
// parameter. This module-level holder allows the server to configure the
// registry at startup (via setRegistryForSetup) before any matches are
// created. Tests that bypass registry validation do not set this.
let gameRegistry: CardRegistryReader | undefined;

/**
 * Configures the card registry used by Game.setup() for match validation
 * and initial state construction. Must be called by the server at startup
 * before creating any matches.
 *
 * @param registry - The card registry for ext_id existence checks.
 */
export function setRegistryForSetup(registry: CardRegistryReader): void {
  gameRegistry = registry;
}

/**
 * Clears the registry previously set by setRegistryForSetup. Test-only —
 * never call in production server code.
 *
 * Without this, a test that calls setRegistryForSetup would leave the
 * registry set for all subsequent tests in the same process, causing
 * test pollution.
 */
export function clearRegistryForSetup(): void {
  gameRegistry = undefined;
}

// why: No-op registry satisfies the CardRegistryReader interface when the
// real registry has not been configured. Used only in test contexts where
// setup validation is intentionally skipped.
const EMPTY_REGISTRY: CardRegistryReader = {
  listCards: () => [],
};

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/**
 * Advances the current turn stage to the next stage in the canonical
 * sequence (start -> main -> cleanup -> turn ends).
 *
 * Delegates entirely to advanceTurnStage from turnLoop.ts, which uses
 * getNextTurnStage for ordering — no stage strings are hardcoded here.
 *
 * @param context - boardgame.io move context with G and events.
 */
function advanceStage({ G, events }: MoveContext): void {
  advanceTurnStage(G, { events: { endTurn: () => events.endTurn() } });
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
   * @throws {Error} if matchConfiguration is not provided or validation fails
   */
  // why: setup() accepts MatchConfiguration so the server can pass in the
  // match parameters chosen during lobby/matchmaking. This is the only point
  // where external configuration enters the engine.
  setup: (context, matchConfiguration?: MatchConfiguration): LegendaryGameState => {
    // why: validateSetupData guards this at the lobby API layer, but setup()
    // can also be called directly in tests or by boardgame.io internals
    // (e.g. rematch). This check is a belt-and-suspenders safety net.
    if (!matchConfiguration) {
      throw new Error(
        'LegendaryGame.setup() requires a MatchConfiguration argument. ' +
        'The server must pass the match setup payload when creating a new game.'
      );
    }

    // why: When a registry is available (set by the server via
    // setRegistryForSetup), validate the config against the registry before
    // building state. This catches invalid ext_ids at match creation time.
    // Game.setup() is the ONLY place in the engine where throwing is correct
    // — an invalid config must abort match creation immediately.
    if (gameRegistry) {
      const result = validateMatchSetup(matchConfiguration, gameRegistry);
      if (!result.ok) {
        const firstError = result.errors[0];
        const errorMessage = firstError
          ? firstError.message
          : 'Match setup validation failed with an unknown error.';
        throw new Error(errorMessage);
      }
    }

    // why: The registry parameter allows buildInitialGameState to resolve
    // card data in future Work Packets (hero deck, villain deck construction).
    // For WP-005B, starting decks and piles use well-known ext_ids that do
    // not require registry lookup. EMPTY_REGISTRY is used when the server has
    // not configured a registry (e.g., in unit tests).
    const registryForSetup = gameRegistry ?? EMPTY_REGISTRY;

    return buildInitialGameState(matchConfiguration, registryForSetup, context);
  },

  moves: {
    drawCards,
    playCard,
    endTurn,
    advanceStage,
    revealVillainCard,
  },

  // why: phase `next` fields declare the intended linear progression
  // (lobby -> setup -> play -> end) but do not cause automatic transitions.
  // Actual transitions require explicit ctx.events.setPhase() calls, which
  // will be added by subsequent Work Packets.
  phases: {
    lobby: {
      start: true,
      next: 'setup',
      moves: {
        setPlayerReady,
        startMatchIfReady,
      },
    },
    setup: {
      next: 'play',
    },
    play: {
      next: 'end',
      // why: endIf must be pure -- all endgame state is read from G.counters
      // which the rule pipeline maintains via applyRuleEffects. Delegates
      // entirely to evaluateEndgame; no inline counter logic here.
      // boardgame.io stores any truthy endIf return as ctx.gameover at runtime;
      // the phase-level type definition is narrower than what it accepts, so
      // we assert the return to satisfy the compiler.
      endIf: ({ G }) => {
        const result = evaluateEndgame(G);
        return (result ?? undefined) as unknown as boolean | void;
      },
      turn: {
        // why: Each new turn must begin at the first canonical turn stage.
        // TURN_STAGES[0] is used instead of a hardcoded string to prevent
        // drift if stage names ever change in turnPhases.types.ts.
        onBegin: ({ G, ctx }) => {
          // why: TURN_STAGES is a readonly array with known contents. The
          // non-null assertion is safe because TURN_STAGES always has at
          // least one element (enforced by drift-detection tests in WP-007A).
          G.currentStage = TURN_STAGES[0]!;

          // why: trigger -> collect effects -> apply effects pipeline.
          // onTurnStart fires at the beginning of each player's turn so
          // scheme hooks can react to the new turn.
          const turnStartEffects = executeRuleHooks(
            G,
            ctx,
            'onTurnStart',
            { currentPlayerId: ctx.currentPlayer },
            G.hookRegistry,
            DEFAULT_IMPLEMENTATION_MAP,
          );
          applyRuleEffects(G, ctx, turnStartEffects);
        },

        onEnd: ({ G, ctx }) => {
          // why: trigger -> collect effects -> apply effects pipeline.
          // onTurnEnd fires at the end of each player's turn so mastermind
          // hooks can react to the turn ending.
          const turnEndEffects = executeRuleHooks(
            G,
            ctx,
            'onTurnEnd',
            { currentPlayerId: ctx.currentPlayer },
            G.hookRegistry,
            DEFAULT_IMPLEMENTATION_MAP,
          );
          applyRuleEffects(G, ctx, turnEndEffects);
        },
      },
    },
    end: {},
  },
};
