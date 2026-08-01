import type { Ctx, FnContext, Game, PlayerID } from 'boardgame.io';
import type { MatchConfiguration, LegendaryGameState } from './types.js';
import { validateMatchSetup, type CardRegistryReader } from './matchSetup.validate.js';
import { buildInitialGameState } from './setup/buildInitialGameState.js';
import { TURN_STAGES } from './turn/turnPhases.types.js';
import { advanceTurnStage } from './turn/turnLoop.js';
import { drawCards, playCard, endTurn } from './moves/coreMoves.impl.js';
import { HAND_SIZE, drawCardsIntoHand } from './moves/drawCards.logic.js';
import { resolveHeroChoice } from './moves/heroChoice.resolve.js';
import { resolveKoHeroChoice, hasPendingKoHeroChoice } from './moves/koHeroChoice.resolve.js';
import { resolveScryKoChoice, hasPendingScryKoChoice } from './moves/scryKoChoice.resolve.js';
import { resolveDiscardChoice, hasPendingDiscardChoice } from './moves/discardChoice.resolve.js';
import { resolveOptionalKoReward, hasPendingOptionalKoReward } from './moves/optionalKoReward.resolve.js';
import { resolveOptionalPutBottomHQ, hasPendingOptionalPutBottomHQ } from './moves/resolveOptionalPutBottomHQ.js';
import { resolvePutAnyNumberBottomHQ, hasPendingPutAnyNumberBottomHQ } from './moves/resolvePutAnyNumberBottomHQ.js';
import { resolveReturnZeroCostDiscard, hasPendingReturnZeroCostDiscard } from './moves/resolveReturnZeroCostDiscard.js';
import { resolveDiscardToPlay, hasPendingDiscardToPlay } from './moves/resolveDiscardToPlay.js';
import { resolveVictoryPileCardPick, hasPendingVictoryPileCardPick } from './moves/resolveVictoryPileCardPick.js';
import { resolveDrawOrEmpowered, hasPendingDrawOrEmpowered } from './moves/drawOrEmpowered.resolve.js';
import { executeRuleHooks } from './rules/ruleRuntime.execute.js';
import { applyRuleEffects } from './rules/ruleRuntime.effects.js';
import { DEFAULT_IMPLEMENTATION_MAP } from './rules/ruleRuntime.impl.js';
import { evaluateEndgame } from './endgame/endgame.evaluate.js';
import {
  latchFinalTurnIfDeckExhausted,
  resolveFinalTurnTieIfUnresolved,
} from './endgame/finalTurn.logic.js';
import { setPlayerReady, startMatchIfReady } from './lobby/lobby.moves.js';
import { revealVillainCard } from './villainDeck/villainDeck.reveal.js';
import { fightVillain } from './moves/fightVillain.js';
import { recruitHero } from './moves/recruitHero.js';
import { healWounds } from './moves/healWounds.js';
import { dodgeCard } from './moves/dodgeCard.js';
import { sendUndercover } from './moves/sendUndercover.js';
import { playFromUndercover } from './moves/playFromUndercover.js';
import { fightMastermind } from './moves/fightMastermind.js';
import { resetTurnEconomy } from './economy/economy.logic.js';
import { runAllInvariantChecks } from './invariants/runAllChecks.js';
import { buildUIState } from './ui/uiState.build.js';
import { filterUIStateForAudience } from './ui/uiState.filter.js';
import type { UIState } from './ui/uiState.types.js';

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
// why: D-10014 — satisfies wider CardRegistryReader for test-context skip
// path. PS-3 widened the interface to `{ listCards, listSets, getSet }`
// so the validator can build per-field qualified-ID sets; the empty
// registry must satisfy the wider shape too.
const EMPTY_REGISTRY: CardRegistryReader = {
  listCards: () => [],
  listSets: () => [],
  getSet: () => undefined,
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
  // why: block-all guard (D-24008) — while a KO-a-Hero choice is pending the
  // board is frozen; advanceStage (at any stage) returns with no side effects
  // so the player resolves the Fight effect before any other action. Placed
  // before any G read/write and before the cleanup turn-end check below.
  if (hasPendingKoHeroChoice(G)) { return; }
  // why: block-all guard (D-24282) — while a Doombot scry-KO choice is pending
  // the board is frozen; advanceStage (at any stage) returns with no side effects
  // so the player picks which revealed card to KO before any other action. Mirrors
  // the D-24008 KO-hero check above (both freeze the cleanup turn-end too).
  if (hasPendingScryKoChoice(G)) { return; }
  // why: block-all guard (WP-476 / D-24284) — while a discard-to-limit choice is
  // pending the board is frozen; advanceStage (at any stage) returns with no side
  // effects so the current player picks which cards to discard. A choice parked at
  // the START stage must block the start→main advance until resolved.
  if (hasPendingDiscardChoice(G)) { return; }
  // why: block-all guard (D-24019) — optional-KO-reward choice pending; the
  // board is frozen until resolved (this also blocks the cleanup turn-end
  // auto-transition below, mirroring the D-24008 KO-hero check above).
  if (hasPendingOptionalKoReward(G)) { return; }
  // why: block-all — pendingVictoryPileCardPick must be resolved before any other action (D-24067)
  if (hasPendingVictoryPileCardPick(G)) { return; }
  // why: block-all — pendingDrawOrEmpowered must be resolved before any other action (D-24069)
  if (hasPendingDrawOrEmpowered(G)) { return; }
  // why: block-all — pendingOptionalPutBottomHQ must be resolved before any other action
  if (hasPendingOptionalPutBottomHQ(G)) { return; }
  // why: D-24132 — block-all — pendingPutAnyNumberBottomHQ (multi-select HQ→bottom) must be resolved before any other action
  if (hasPendingPutAnyNumberBottomHQ(G)) { return; }
  // why: block-all — pendingReturnZeroCostDiscard must be resolved before any other action (D-24139)
  if (hasPendingReturnZeroCostDiscard(G)) { return; }
  // why: block-all — pendingDiscardToPlay must be resolved before any other action (WP-383 / D-24184)
  if (hasPendingDiscardToPlay(G)) { return; }
  // why: turn cannot end while a player-choice reveal is pending; at cleanup,
  // advanceTurnStage would otherwise call events.endTurn() and bypass the
  // endTurn-move guard (D-22002). The KO turn-end block is already covered by
  // the block-all guard above (D-24008 — queue-non-empty blocks turn-end).
  if (G.currentStage === 'cleanup' && G.pendingHeroChoice !== undefined) { return; }
  advanceTurnStage(G, { events: { endTurn: () => events.endTurn() } });
}

/**
 * Reshapes the client-visible state from LegendaryGameState to
 * audience-filtered UIState. Registered on LegendaryGame.playerView so
 * every state frame boardgame.io pushes to a connected client is already
 * audience-filtered — clients never observe raw G.
 *
 * Pure function: no I/O, no RNG, no mutation of G or ctx, no entries
 * appended to G.messages, never throws. Given identical (G, ctx, playerID),
 * the output is byte-identical.
 *
 * Runs on every state push — keep cheap. Delegates to WP-028 / WP-029
 * helpers which already carry the copy discipline that prevents aliasing
 * G into the projection.
 *
 * // why: parameter shape is the single context object { G, ctx, playerID }
 * because boardgame.io 0.50.2's Game<G>['playerView'] is declared as
 * `(context: { G, ctx, playerID }) => any`. The engine call-site is the
 * boardgame.io runtime itself — it passes a single object. A three-arg
 * positional signature would be type-compatible only via a double-cast and
 * would still be wrong at runtime. WP-089 / EC-089 / RS-3 locked a
 * three-arg signature that reflected the WP's design intent but conflicted
 * with the library's actual runtime shape under TS `exactOptionalPropertyTypes`;
 * resolved during execution per user-authorized RS-3 refinement (see
 * 01.6 post-mortem — "RS-3 cast refinement").
 *
 * @param context - boardgame.io single-argument context: { G, ctx, playerID }.
 * @returns Audience-filtered UIState for the viewing client.
 */
function buildPlayerView({
  G,
  ctx,
  playerID,
}: {
  G: LegendaryGameState;
  ctx: Ctx;
  playerID: PlayerID | null;
}): UIState {
  const uiBuildContext = {
    phase: ctx.phase,
    turn: ctx.turn,
    currentPlayer: ctx.currentPlayer,
  };
  const fullUIState = buildUIState(G, uiBuildContext);

  // why: null and any non-string playerID map to spectator because
  // boardgame.io represents unauthenticated / unseated clients as null
  // on the WebSocket transport; runtime paths that accidentally pass
  // undefined are defended by the same typeof check. Empty string '' is
  // NOT mapped to spectator: it is a valid seat ID in the 0.50.x
  // "0" | "1" | ... convention and routes to { kind: 'player', playerId: '' }.
  // EC-089 §Locked Values line 25 locks the typeof check verbatim.
  const audience = typeof playerID === 'string'
    ? { kind: 'player' as const, playerId: playerID }
    : { kind: 'spectator' as const };

  return filterUIStateForAudience(fullUIState, audience);
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
   * why: this hook is boardgame.io's ONLY create-time path to a clean,
   * client-visible rejection. A string return becomes `ctx.throw(400, msg)`
   * in boardgame.io's CreateMatch handler (dist/cjs/server.js), and Koa
   * exposes 4xx bodies — so the caller sees the actual reason. If a bad
   * config is instead left to fail inside setup() (which throws), Koa
   * swallows the throw into a generic HTTP 500 "Internal Server Error" and
   * the real reason (e.g. "bystandersCount must be at least 30 …") never
   * reaches the player. So the full match-setup validation runs HERE, at the
   * lobby boundary, and the setup() throw below remains only as a
   * belt-and-suspenders net for direct/internal callers (tests, rematch).
   *
   * The registry is the module-level `gameRegistry` (set by the server via
   * setRegistryForSetup at startup). When no registry is configured — unit
   * tests that intentionally skip validation — this hook skips the
   * existence/floor checks exactly like setup() does, returning only the
   * missing-setupData error.
   *
   * @param setupData - the setupData from the create request body
   * @param numPlayers - player count; drives the WP-370 composition gate
   * @returns an error message string if invalid, undefined if valid
   */
  validateSetupData: (
    setupData: MatchConfiguration | undefined,
    numPlayers: number,
  ): string | undefined => {
    if (!setupData) {
      return 'Missing setupData. The create request must include a setupData ' +
        'object with a valid MatchConfiguration (schemeId, mastermindId, etc.).';
    }
    // why: run the authoritative match-setup validation here so an invalid
    // config (unknown ext_id, below-floor supply count, malformed field,
    // or — WP-370 — a composition that does not match the player count)
    // returns a message-bearing HTTP 400 from the lobby create endpoint
    // instead of an opaque HTTP 500 from a setup() throw. Guarded on
    // gameRegistry for the no-registry test path (mirrors setup()).
    if (gameRegistry) {
      const result = validateMatchSetup(setupData, gameRegistry, numPlayers);
      if (!result.ok) {
        const firstError = result.errors[0];
        return firstError
          ? firstError.message
          : 'Match setup validation failed with an unknown error.';
      }
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
      // why: WP-370 — pass ctx.numPlayers so the composition gate can reject a
      // loadout whose villain-group / henchman / hero counts do not match the
      // player count (belt-and-suspenders behind validateSetupData).
      const result = validateMatchSetup(matchConfiguration, gameRegistry, context.ctx.numPlayers);
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

    // why: runAllInvariantChecks enforces structural, gameRules,
    // determinism, and lifecycle invariants after buildInitialGameState
    // constructs G. Setup is the one engine-wide call site permitted to
    // throw per .claude/skills/legendary-game-engine/SKILL.md §Throwing Convention row 1,
    // so assertInvariant's throw is safe here. Per D-3102, per-move
    // wiring is deferred to a follow-up WP.
    const initialState = buildInitialGameState(
      matchConfiguration,
      registryForSetup,
      context,
    );
    runAllInvariantChecks(initialState, {
      phase: context.ctx.phase,
      turn: context.ctx.turn,
    });
    return initialState;
  },

  // why: WP-411 / D-24223 — the end-of-game condition is a TOP-LEVEL Game
  // `endIf`, not a phase `endIf`. In boardgame.io a phase `endIf` only ends the
  // PHASE; only a top-level Game `endIf` sets `ctx.gameover` (to the truthy
  // return) and ends the game, which is what boardgame.io's store then persists
  // into the match `metadata.gameover`. The prior implementation placed the
  // endgame check as a `play`-phase `endIf`, which ended the phase (→ the empty
  // `end` phase) but NEVER set `ctx.gameover` — so no match ever registered
  // gameover and every completed-match consumer (competitive submission WP-338,
  // result-LAGN WP-406, Hall of Legends WP-407/408, match summaries D-24169) was
  // unreachable in production. This is a pure read of `G.counters` via
  // `evaluateEndgame` (the sole endgame authority; no inline counter logic, no
  // I/O, no events, consumes no randomness) — it returns the EndgameResult
  // ({ outcome, reason }) for a terminal state so the framework sets
  // `ctx.gameover` to it, or `undefined` to let the game continue. The
  // top-level `Game['endIf']` return type is `any`, so — unlike the removed
  // phase-level check whose narrower `boolean | void` type forced a cast — no
  // cast is needed. Determinism: this mutates no `G`, so an identical `G` hashes
  // identically; the only behavioral change is that a game now TERMINATES at the
  // win/loss point instead of accepting further moves.
  endIf: ({ G }) => evaluateEndgame(G) ?? undefined,

  // why: playerView is the sole engine→client projection boundary.
  // Clients never observe raw LegendaryGameState — this hook reshapes
  // every state frame into audience-filtered UIState via buildUIState
  // (WP-028) + filterUIStateForAudience (WP-029). filterUIStateForAudience
  // is the project's audience authority per D-0302 / D-8901; boardgame.io's
  // built-in secret-stripping helper is intentionally not used (see D-8901).
  //
  // why: cast anchor is NonNullable<Game<LegendaryGameState>['playerView']>
  // (narrowest refinement of RS-3's locked `Game<...>['playerView']` anchor).
  // The refinement strips the `| undefined` half of the indexed-access type
  // that exactOptionalPropertyTypes: true otherwise carries onto the object
  // literal field. It preserves RS-3's intent (anchor to boardgame.io's
  // Game<...>.playerView property type; do NOT modify the Game<...> generic)
  // while satisfying the compiler. Documented as an RS-3 cast refinement in
  // the 01.6 post-mortem; no DECISIONS entry needed — tooling variance, not
  // architecture.
  playerView: buildPlayerView as NonNullable<Game<LegendaryGameState>['playerView']>,

  // why: every state-mutating move is registered in long-form with
  // `client: false` per D-10008. Background: `playerView` (above) reshapes
  // the engine's authoritative G (LegendaryGameState) into UIState — a
  // completely different shape — for delivery to clients. Without
  // `client: false`, boardgame.io's default behavior runs each move
  // optimistically on the client's local G, which is actually UIState
  // (no `playerZones`, no `lobby`, no `villainDeck`, etc.). Every
  // state-mutating move would crash on the client with "Cannot read
  // properties of undefined" the first time it tries to mutate a G field
  // that doesn't exist on UIState. Setting `client: false` makes each
  // move server-only — the client dispatches via the multiplayer
  // transport but never tries to run the move locally. Server-side
  // execution against real G works; the next server frame broadcasts
  // the new state via playerView. This pattern applies uniformly to
  // ALL state-mutating moves in the engine. The 01.5 triggers remain
  // absent: no new LegendaryGameState field, no buildInitialGameState
  // shape change, no new LegendaryGame.moves entry (the move *names* and
  // their function bodies are unchanged — only the registration form
  // changes from short-form `move` to long-form `{ move, client: false }`),
  // and no new phase hook. Logged as D-10008.
  moves: {
    drawCards: { move: drawCards, client: false },
    playCard: { move: playCard, client: false },
    endTurn: { move: endTurn, client: false },
    advanceStage: { move: advanceStage, client: false },
    revealVillainCard: { move: revealVillainCard, client: false },
    fightVillain: { move: fightVillain, client: false },
    recruitHero: { move: recruitHero, client: false },
    // why: D-24051 — dodgeCard is a non-core, internally-stage-gated move (the
    // recruitHero pattern), NOT a core move; registered here so the player can
    // discard a Dodge card from hand to draw a replacement. Server-only
    // (client: false) per D-10008 — it mutates real G (playerZones), absent on UIState.
    dodgeCard: { move: dodgeCard, client: false },
    // why: WP-282 / EC-313 — sendUndercover sends a card face-down from hand to the
    // player's face-down store. playFromUndercover retrieves a face-down card and
    // plays it through the identical pathway as hand play. Both are server-only
    // (client: false) per D-10008 — they mutate playerZones fields.
    sendUndercover: { move: sendUndercover, client: false },
    playFromUndercover: { move: playFromUndercover, client: false },
    fightMastermind: { move: fightMastermind, client: false },
    // why: WP-379 / D-24179 — healWounds uses the printed Wound "Healing" ability,
    // KO'ing all Wounds from the current player's hand to G.ko. Server-only
    // (client: false) per D-10008 — it mutates real G (playerZones.hand / G.ko),
    // absent on UIState.
    healWounds: { move: healWounds, client: false },
    resolveHeroChoice: { move: resolveHeroChoice, client: false },
    resolveKoHeroChoice: { move: resolveKoHeroChoice, client: false },
    // why: WP-470 / D-24282 — resolveScryKoChoice resolves the interactive Doombot
    // scry-KO choice (pick which of the top two deck cards to KO). Server-only
    // (client: false) per D-10008 — it mutates real G (playerZones.deck / G.ko),
    // absent on UIState. NOT in CORE_MOVE_NAMES (mirrors resolveKoHeroChoice).
    resolveScryKoChoice: { move: resolveScryKoChoice, client: false },
    // why: WP-476 / D-24284 — resolveDiscardChoice resolves the interactive
    // Magneto discard-to-limit choice (the current player picks which cards to
    // discard down to four). Server-only (client: false) per D-10008 — it mutates
    // real G (playerZones.hand / .discard), absent on UIState. NOT in
    // CORE_MOVE_NAMES (mirrors resolveScryKoChoice / resolveKoHeroChoice).
    resolveDiscardChoice: { move: resolveDiscardChoice, client: false },
    resolveOptionalKoReward: { move: resolveOptionalKoReward, client: false },
    resolveOptionalPutBottomHQ: { move: resolveOptionalPutBottomHQ, client: false },
    // why: D-24132 — resolvePutAnyNumberBottomHQ resolves the multi-select HQ→bottom choice
    // (Wonder Man's 8th Wonder of the World et al.). Server-only (client: false) per D-10008 —
    // it mutates real G (G.hq / G.heroDeck / G.turnEconomy), absent on UIState.
    resolvePutAnyNumberBottomHQ: { move: resolvePutAnyNumberBottomHQ, client: false },
    resolveVictoryPileCardPick: { move: resolveVictoryPileCardPick, client: false },
    resolveDrawOrEmpowered: { move: resolveDrawOrEmpowered, client: false },
    // why: D-24139 — resolveReturnZeroCostDiscard resolves the mandatory 0-cost
    // discard-to-hand return (Black Knight's Defend the Weak). Server-only
    // (client: false) per D-10008 — it mutates playerZones fields.
    resolveReturnZeroCostDiscard: { move: resolveReturnZeroCostDiscard, client: false },
    resolveDiscardToPlay: { move: resolveDiscardToPlay, client: false },
  },

  // why: phase `next` fields declare the intended linear progression
  // (lobby -> setup -> play -> end) but do not cause automatic transitions.
  // Actual transitions require explicit ctx.events.setPhase() calls, which
  // will be added by subsequent Work Packets.
  phases: {
    lobby: {
      start: true,
      next: 'setup',
      // why: `activePlayers: { all: 'lobbyReady' }` plus the matching
      // empty `stages.lobbyReady: {}` block tells boardgame.io: every
      // seated player (not just ctx.currentPlayer) is in the
      // 'lobbyReady' stage and may submit phase-level moves. Equivalent
      // at runtime to boardgame.io's ActivePlayers.ALL constant (which
      // expands to `{ all: Stage.NULL }` where Stage.NULL: null) — but
      // type-clean because `StageArg = StageName | object` rejects the
      // bare `null` literal even though the runtime accepts it. The
      // empty `stages` block adds no new behavior; the lobby phase's
      // top-level `moves: { setPlayerReady, startMatchIfReady }` are
      // the only callable moves regardless of stage. Without this
      // activePlayers config, boardgame.io's server-side dispatch
      // rejects setPlayerReady from any player other than the
      // turn-holder with "player not active - playerID=[N] -
      // action[setPlayerReady]" — making multi-player lobby ready-up
      // impossible. Logged as D-10007. Per the four 01.5 triggers,
      // this is a phase-configuration property (not a phase hook), no
      // new LegendaryGameState field, no buildInitialGameState shape
      // change, no new LegendaryGame.moves entry — 01.5 NOT INVOKED.
      // The 'lobbyReady' stage name is local to this phase and has no
      // semantic meaning beyond "anonymous stage that authorizes all
      // players to submit phase moves".
      turn: {
        activePlayers: { all: 'lobbyReady' },
        stages: {
          lobbyReady: {},
        },
      },
      // why: lobby-phase moves are also long-form with `client: false`
      // per D-10008 — same playerView-vs-UIState shape mismatch as the
      // top-level moves. setPlayerReady mutates G.lobby.ready and
      // startMatchIfReady mutates G.lobby.started + calls
      // events.setPhase('play'); both crash on the client because
      // UIState has no `lobby` field. Server-only dispatch is the fix.
      moves: {
        setPlayerReady: { move: setPlayerReady, client: false },
        startMatchIfReady: { move: startMatchIfReady, client: false },
      },
    },
    setup: {
      next: 'play',
    },
    play: {
      next: 'end',
      // why: WP-411 / D-24223 — the endgame check that used to live here as a
      // `play`-phase `endIf` was REMOVED. A phase `endIf` only ends the phase
      // (→ the empty `end` phase); it never set `ctx.gameover`, which was the
      // bug. Termination now lives on the TOP-LEVEL `LegendaryGame.endIf`
      // (above), the only `endIf` that sets `ctx.gameover`. `play.next: 'end'`
      // and the `end` phase are retained (the four-phase structure is pinned by
      // game.test.ts) even though the game now ends via `gameover` before the
      // `end` phase is reached.
      turn: {
        // why: explicit `activePlayers: { currentPlayer: 'playTurn' }` plus
        // empty `stages.playTurn: {}` per D-10009. Without it,
        // boardgame.io's InitTurnOrderState falls back to
        // `SetActivePlayers(ctx, turn.activePlayers || {})` — passing the
        // empty object literal. SetActivePlayers with `{}` returns
        // `ctx.activePlayers = {}` (truthy empty object, NOT null). Then
        // IsPlayerActive evaluates `if (ctx.activePlayers)` → truthy
        // branch → `playerID in {}` → false for ALL players, blocking
        // every move including drawCards from the seated current player.
        // The explicit `{ currentPlayer: 'playTurn' }` config writes
        // `ctx.activePlayers = { '<currentPlayer>': 'playTurn' }`, so
        // IsPlayerActive correctly returns true only for ctx.currentPlayer
        // — restoring turn-based "only current player can move" semantics.
        // The empty `stages.playTurn: {}` block adds no behavior; the
        // top-level LegendaryGame.moves bag remains the active move
        // vocabulary (drawCards, playCard, fightVillain, etc.) per the
        // getMove precedence chain (stage.moves → phase.moves → global
        // moves). The 01.5 triggers remain absent: this is a
        // phase-configuration property, not a phase hook.
        activePlayers: { currentPlayer: 'playTurn' },
        stages: {
          playTurn: {},
        },
        // why: WP-367 / D-24159 — deck-exhaustion "final turn" latch. Fires after
        // EVERY successful play-phase move, so it observes the deck state that the
        // move (including any card effects it ran) leaves behind. The helper
        // latches the final turn the first time either shared deck reaches zero
        // and is sticky — a later card effect that refills the deck does NOT
        // cancel the final turn (the exact rulebook edge Jeff reported). See
        // finalTurn.logic.ts.
        onMove: ({ G }) => {
          latchFinalTurnIfDeckExhausted(G);
        },
        // why: Each new turn must begin at the first canonical turn stage.
        // TURN_STAGES[0] is used instead of a hardcoded string to prevent
        // drift if stage names ever change in turnPhases.types.ts.
        onBegin: ({ G, ctx, random }) => {
          // why: TURN_STAGES is a readonly array with known contents. The
          // non-null assertion is safe because TURN_STAGES always has at
          // least one element (enforced by drift-detection tests in WP-007A).
          G.currentStage = TURN_STAGES[0]!;

          // why: WP-328 — stamp the turn number into G (ctx.turn lives only in ctx, and
          // helper push sites have no ctx) and reset the per-step action counter, so
          // pushLog can number every log line {turn}.{step}.{action}. NOTE (WP-337):
          // `computeStateHash` (replay.hash.ts) INTENTIONALLY hashes the full G, so
          // logMeta IS part of the competitive/determinism hash — that is correct and
          // harmless (logMeta is deterministic, and the faithful reduction reproduces it
          // exactly, D-24124). It is the SEPARATE fixture-golden hash (hashGameState) that
          // excludes messages + logMeta for golden-churn reasons (D-24081 / D-24114), not
          // this one. logMeta is deterministic (ctx.turn), so it adds no non-determinism.
          //
          // why: the displayed turn number must be PLAY-RELATIVE (first play turn = 1).
          // The lobby phase consumes framework turn 1 (startMatchIfReady exits via
          // setPhase('play')), so the play phase's first turn arrives as ctx.turn === 2.
          // Without this offset the game log opened at "2.1.1" and the HUD header read
          // "Turn 2" on the very first turn. Capture the framework turn of the first play
          // turn once (firstPlayTurn) and offset every turn by it, so the numbering is
          // correct regardless of how many framework turns preceded play. firstPlayTurn is
          // carried across the per-turn logMeta reassignment.
          const firstPlayTurn = G.logMeta?.firstPlayTurn ?? ctx.turn;
          G.logMeta = {
            turn: ctx.turn - firstPlayTurn + 1,
            actionInStep: 0,
            firstPlayTurn,
          };

          // why: economy resets at start of each player turn — accumulated
          // and spent values from previous turn are cleared
          G.turnEconomy = resetTurnEconomy();

          // why: the once-per-turn villain reveal allowance refreshes at the
          // start of every player turn; without this reset the wrapper guard
          // would permanently block reveals from turn 2 onward.
          G.villainRevealedThisTurn = false;

          // why: the once-per-turn draw allowance refreshes at the start of
          // every player turn; without this reset the drawCards move guard
          // would permanently block draws from turn 2 onward.
          G.hasDrawnThisTurn = false;

          // why: WP-379 / D-24180 — the Healing/act mutual-exclusion allowance
          // refreshes at the start of every player turn. Without this reset a
          // player who acted or healed last turn would stay locked out this turn.
          G.hasActedThisTurn = false;
          G.hasHealedThisTurn = false;

          // why: WP-409 / D-24221 — the per-turn hero-effect-fired count is a
          // transient observability signal; a fresh turn starts at 0 before any
          // play (overwritten each play by applyCardPlay). Deliberately NOT seeded
          // in buildInitialGameState (unlike hasActedThisTurn etc.), so the empty
          // PRE_WP080 replay never sets it and that whole-G oracle is byte-unchanged;
          // it is excluded from the finalStateHash oracle, so sentinels hold too —
          // no hash re-pin (verified: full engine suite green).
          G.lastPlayEffectsFired = 0;

          // why: the engine owns the start-of-turn draw — the former
          // TurnActionBar "Draw to 6" UI scaffold is retired. Fill the active
          // player's hand to HAND_SIZE from their deck (reshuffling the
          // discard on exhaustion via the engine's deterministic shuffle — no
          // new randomness source). This runs BEFORE the onTurnStart hooks
          // below so a hand-reading turn-start hook (e.g. Magneto's hand-size
          // trim) observes the freshly drawn hand. hasDrawnThisTurn is set so
          // a subsequent drawCards submission is a guarded no-op.
          const activePlayerZones = G.playerZones[ctx.currentPlayer];
          if (activePlayerZones) {
            const cardsToDraw = Math.max(0, HAND_SIZE - activePlayerZones.hand.length);
            drawCardsIntoHand(activePlayerZones, cardsToDraw, { random });
            G.hasDrawnThisTurn = true;
          }

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

          // why: WP-367 / D-24159 — resolve the deck-exhaustion tie at the end of
          // the final turn. Runs AFTER the onTurnEnd effects above so an
          // end-of-turn effect that itself triggers a win/loss is honored before
          // the tie is considered. The helper only sets the tie when the final
          // turn is latched and no win/loss fired — see finalTurn.logic.ts.
          resolveFinalTurnTieIfUnresolved(G);
        },
      },
    },
    end: {},
  },
};
