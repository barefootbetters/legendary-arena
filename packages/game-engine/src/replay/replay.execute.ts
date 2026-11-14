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
 *
 * why (D-24322 clarification): being a reducer-determinism harness, this path
 * intentionally does NOT run the bgio play-phase `turn.onMove` effects — neither
 * `latchFinalTurnIfDeckExhausted` nor `applyPileDepletionResourceLoss`. So a
 * recorded pile-depletion game (Civil War hero deck / Legacy Virus wounds,
 * D-24318/D-24320) replayed here will not set `SCHEME_LOSS`, exactly as it already
 * omits the deck-exhaustion final-turn latch. This is consistent, not divergent:
 * setup sizing IS honored (it runs in `buildInitialGameState`), and FAITHFUL replay
 * reconstruction (server-layer D-24119) uses boardgame.io's own reducer, which DOES
 * run `turn.onMove`. The live sim harnesses (`simulation.runner.ts`,
 * `par.aggregator.ts`) DO mirror `turn.onMove` for pile-depletion losses; this
 * determinism harness deliberately does not.
 *
 * why (WP-744 / D-24567, same D-24322 exclusion): for the same reason this path
 * also does NOT run the deferred-grant lifecycle — neither the per-move
 * `resolveDeferredHeroGrants` (`turn.onMove`, WP-568 / D-24377 wait-and-see grants
 * and the WP-656 / D-24467 defeat edge) nor the `turn.onBegin` clear
 * (`clearDeferredConditionalGrants` + the `villainOrMastermindDefeatedSinceResolve`
 * delete). It has no turn-rotation site to host the clear, and adding either would
 * contradict D-24322. The sim, PAR and fixture harnesses (`simulation.runner.ts`,
 * `par.aggregator.ts`, `runFixture.ts`) DO mirror both halves; the sim <-> runFixture
 * capture contract (D-24273) is the one that must hold, and this harness is not
 * asserted equal to either.
 */

import type { LegendaryGameState } from '../types.js';
import type { CardRegistryReader } from '../matchSetup.validate.js';
import type { ReplayInput, ReplayResult, ReplayMove } from './replay.types.js';
import { computeStateHash } from './replay.hash.js';
import { promoteMastermindVictoryIfPending } from '../endgame/mastermindVictory.logic.js';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { makeMockCtx } from '../test/mockCtx.js';

// Move function imports — these files import boardgame.io types internally,
// but this file does NOT import boardgame.io directly.
import { drawCards, playCard, endTurn } from '../moves/coreMoves.impl.js';
import { revealVillainCard } from '../villainDeck/villainDeck.reveal.js';
import { fightVillain } from '../moves/fightVillain.js';
import { recruitHero } from '../moves/recruitHero.js';
import { exorciseHauntedHero } from '../moves/exorciseHauntedHero.js';
import { recruitOfficer } from '../moves/recruitOfficer.js';
import { recruitSidekick } from '../moves/recruitSidekick.js';
import { fightMastermind } from '../moves/fightMastermind.js';
import { dodgeCard } from '../moves/dodgeCard.js';
import { healWounds } from '../moves/healWounds.js';
import { phaseCard } from '../moves/phaseCard.js';
import { useRitualArtifact } from '../moves/ritualArtifact.js';
import { attemptHeist } from '../moves/attemptHeist.js';
import { endMatchEarly } from '../moves/endMatchEarly.js';
import { resolveHeroChoice } from '../moves/heroChoice.resolve.js';
import { resolveKoHeroChoice } from '../moves/koHeroChoice.resolve.js';
import { resolveScryKoChoice } from '../moves/scryKoChoice.resolve.js';
import { resolveMelterKoChoice } from '../moves/melterKoChoice.resolve.js';
import { resolveRuthlessDictatorChoice } from '../moves/ruthlessDictatorChoice.resolve.js';
import { resolveElectromagneticBubbleChoice } from '../moves/electromagneticBubbleChoice.resolve.js';
import { resolveDiscardChoice } from '../moves/discardChoice.resolve.js';
import { resolvePutCardsOnDeckChoice } from '../moves/putCardsOnDeckChoice.resolve.js';
import { resolveReorderChoice } from '../moves/reorderChoice.resolve.js';
import { resolveDefeatChoice } from '../moves/defeatChoice.resolve.js';
import { resolveKoDiscardChoice } from '../moves/koDiscardChoice.resolve.js';
import { resolveOptionalKoReward } from '../moves/optionalKoReward.resolve.js';
import { resolveSmashDiscard } from '../moves/smashDiscard.resolve.js';
import { resolvePutHandOnDeckTop } from '../moves/putHandOnDeckTop.resolve.js';
import { resolveRevealTopDispose } from '../moves/revealTopDispose.resolve.js';
import { resolveRevealThreeAssign } from '../moves/revealThreeAssign.resolve.js';
import { resolveDoOver } from '../moves/doOver.resolve.js';
import { resolvePlayVillainTopChoice } from '../moves/playVillainTop.resolve.js';
import { resolveOptionalPutBottomHQ } from '../moves/resolveOptionalPutBottomHQ.js';
import { resolvePutAnyNumberBottomHQ } from '../moves/resolvePutAnyNumberBottomHQ.js';
import { resolveVictoryPileCardPick } from '../moves/resolveVictoryPileCardPick.js';
import { resolveDrawOrEmpowered } from '../moves/drawOrEmpowered.resolve.js';
import { resolveCoveringFireChoice } from '../moves/coveringFireChoice.resolve.js';
import { resolveMoveVillainChoice } from '../moves/moveVillainChoice.resolve.js';
import { resolveSplitFaceChoice } from '../moves/splitFaceChoice.resolve.js';
import { resolveCountScaledChoice } from '../moves/countScaledChoice.resolve.js';
import { resolveUndercoverChoice } from '../moves/undercover.resolve.js';
import { resolveReturnZeroCostDiscard } from '../moves/resolveReturnZeroCostDiscard.js';
import { resolveDiscardToPlay } from '../moves/resolveDiscardToPlay.js';
import { resolveReturnOnDiscard } from '../moves/resolveReturnOnDiscard.js';
import { resolveGiveHqHeroChoice } from '../moves/giveHqHeroChoice.resolve.js';
import { resolveCopyPowersChoice } from '../moves/copyPowersChoice.resolve.js';
import { resolveSeatChoice } from '../moves/seatChoice.resolve.js';
import {
  operatorSetSupplyCount,
  operatorMoveToDeckTop,
  operatorRevealNow,
  operatorMoveCard,
  operatorAddEconomy,
  operatorEscapeVillain,
} from '../moves/operatorSetters.js';
import { setPlayerReady, startMatchIfReady } from '../lobby/lobby.moves.js';
import { advanceTurnStage } from '../turn/turnLoop.js';
import { applyEndOfTurnCleanup } from '../moves/endOfTurnCleanup.logic.js';
import { replayOutOfTimeCards } from '../moves/outOfTime.logic.js';
import { pushLog } from '../log/logPush.js';

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
  // why: WP-696 / D-24513 — endTurn accepts boardgame.io's optional `{ next }` arg.
  // It stays a no-op here (replay reconstructs turns from the recorded move list, so
  // each extra turn is already its own recorded endTurn move); the arg is accepted so
  // the real endTurn move / advanceTurnStage type-check when they call `{ next }`. The
  // extra turn stays faithful because the real endTurn move still decrements
  // G.extraTurns during replay, keeping the reconstructed G consistent with live.
  events: { endTurn: (opts?: { next?: string }) => void; setPhase: (phase: string) => void };
  random: { Shuffle: <T>(deck: T[]) => T[] };
}

// why: static exhaustive map from move name to move function. No dynamic
// dispatch. Covers every move registered in LegendaryGame.moves plus the lobby
// phase moves (D-24830, pinned by simulation.moveDispatch.drift.test.ts).
// advanceStage uses advanceTurnStage directly because the game.ts wrapper is
// not exported.

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
  // TurnLoopContext (has currentPlayer + events.endTurn). G satisfies TurnLoopState
  // and context.events satisfies TurnLoopContext structurally.
  // why: WP-696 / D-24513 — pass currentPlayer so advanceTurnStage's extra-turn
  // branch consumes G.extraTurns identically to live/sim during replay; the endTurn
  // call itself is a no-op here, but the consume keeps the reconstructed G faithful.
  advanceTurnStage(context.G, {
    currentPlayer: context.ctx.currentPlayer,
    events: { endTurn: context.events.endTurn },
    // why: WP-701 / D-24520 — end-of-turn cleanup (discard + draw the new hand) on the
    // cleanup-stage turn-end path, using the replay's reconstructed ShuffleProvider so
    // the replayed G matches live/sim byte-for-byte.
    cleanup: (endingPlayerID) =>
      applyEndOfTurnCleanup(context.G, endingPlayerID, { random: context.random }),
    // why: WP-803 / D-24692 — rules v23 L1678: returning Out of Time cards are played after the
    // villain card and before the hand (the start → main advance). The replay context is passed
    // the same way MOVE_MAP.playCard passes it, so the replayed G matches live/sim.
    beginMain: (startingPlayerID) =>
      replayOutOfTimeCards(context.G, context as never, startingPlayerID),
  });
}

/**
 * Static map from move name strings to move functions.
 *
 * Covers every entry in LegendaryGame.moves plus the lobby phase moves
 * (D-24830). The drift guard in simulation.moveDispatch.drift.test.ts asserts
 * the key set equals the registered move set, so a newly registered move
 * cannot ship without a replay entry. A move name with no entry here (an
 * unknown or retired name) logs a replay warning and is skipped (see
 * applyReplayStep).
 */
const MOVE_MAP: Record<string, MoveFn> = {
  drawCards: (context, args) => drawCards(context as never, args as never),
  playCard: (context, args) => playCard(context as never, args as never),
  endTurn: (context) => endTurn(context as never),
  advanceStage: (context) => replayAdvanceStage(context),
  revealVillainCard: (context) => revealVillainCard(context as never),
  fightVillain: (context, args) => fightVillain(context as never, args as never),
  recruitHero: (context, args) => recruitHero(context as never, args as never),
  // why: WP-757 / D-24587 — a recorded game that exorcises a Haunted Hero replays through
  // this dispatch map ({ hqIndex, outcome, recipientPlayerId? } payload).
  exorciseHauntedHero: (context, args) => exorciseHauntedHero(context as never, args as never),
  // why: WP-648 — a recorded human game that recruits an Officer replays through
  // this dispatch map; recruitOfficer takes no args (empty payload).
  recruitOfficer: (context) => recruitOfficer(context as never),
  // why: WP-842 / D-24776 — a recorded human game that recruits a Sidekick replays through
  // this dispatch map; recruitSidekick takes no args (empty payload).
  recruitSidekick: (context) => recruitSidekick(context as never),
  // why: WP-830 / D-24763 — pass the args through: the Enigma Code guess rides on them.
  fightMastermind: (context, args) => fightMastermind(context as never, args as never),
  // why: D-24830 — before this entry set, a recorded game that used any of the moves below
  // reconstructed a wrong G here: the move was skipped and a "Replay warning: unknown move
  // name" line was pushed in its place. The live game, the sim and PAR dispatch them, and
  // humans can make every one (attemptHeist since WP-865 / D-24808, bots too since WP-878 /
  // D-24826). Each entry reuses the registered move function, with no re-implementation.
  // Pending choices that only the bgio turn hooks open (D-24322) still are not opened by this
  // harness, so a resolve move whose choice was never parked returns without changing G,
  // which is the move's own validation contract.
  dodgeCard: (context, args) => dodgeCard(context as never, args as never),
  healWounds: (context) => healWounds(context as never),
  phaseCard: (context, args) => phaseCard(context as never, args as never),
  useRitualArtifact: (context, args) => useRitualArtifact(context as never, args as never),
  attemptHeist: (context) => attemptHeist(context as never),
  endMatchEarly: (context) => endMatchEarly(context as never),
  resolveHeroChoice: (context, args) => resolveHeroChoice(context as never, args as never),
  resolveKoHeroChoice: (context, args) => resolveKoHeroChoice(context as never, args as never),
  resolveScryKoChoice: (context, args) => resolveScryKoChoice(context as never, args as never),
  resolveMelterKoChoice: (context, args) => resolveMelterKoChoice(context as never, args as never),
  resolveRuthlessDictatorChoice: (context, args) => resolveRuthlessDictatorChoice(context as never, args as never),
  resolveElectromagneticBubbleChoice: (context, args) => resolveElectromagneticBubbleChoice(context as never, args as never),
  resolveDiscardChoice: (context, args) => resolveDiscardChoice(context as never, args as never),
  resolvePutCardsOnDeckChoice: (context, args) => resolvePutCardsOnDeckChoice(context as never, args as never),
  resolveReorderChoice: (context, args) => resolveReorderChoice(context as never, args as never),
  resolveDefeatChoice: (context, args) => resolveDefeatChoice(context as never, args as never),
  resolveKoDiscardChoice: (context, args) => resolveKoDiscardChoice(context as never, args as never),
  resolveOptionalKoReward: (context, args) => resolveOptionalKoReward(context as never, args as never),
  resolveSmashDiscard: (context, args) => resolveSmashDiscard(context as never, args as never),
  resolvePutHandOnDeckTop: (context, args) => resolvePutHandOnDeckTop(context as never, args as never),
  resolveRevealTopDispose: (context, args) => resolveRevealTopDispose(context as never, args as never),
  resolveRevealThreeAssign: (context, args) => resolveRevealThreeAssign(context as never, args as never),
  resolveDoOver: (context, args) => resolveDoOver(context as never, args as never),
  resolvePlayVillainTopChoice: (context, args) => resolvePlayVillainTopChoice(context as never, args as never),
  resolveOptionalPutBottomHQ: (context, args) => resolveOptionalPutBottomHQ(context as never, args as never),
  resolvePutAnyNumberBottomHQ: (context, args) => resolvePutAnyNumberBottomHQ(context as never, args as never),
  resolveVictoryPileCardPick: (context, args) => resolveVictoryPileCardPick(context as never, args as never),
  resolveDrawOrEmpowered: (context, args) => resolveDrawOrEmpowered(context as never, args as never),
  resolveCoveringFireChoice: (context, args) => resolveCoveringFireChoice(context as never, args as never),
  resolveMoveVillainChoice: (context, args) => resolveMoveVillainChoice(context as never, args as never),
  resolveSplitFaceChoice: (context, args) => resolveSplitFaceChoice(context as never, args as never),
  resolveCountScaledChoice: (context, args) => resolveCountScaledChoice(context as never, args as never),
  resolveUndercoverChoice: (context, args) => resolveUndercoverChoice(context as never, args as never),
  resolveReturnZeroCostDiscard: (context, args) => resolveReturnZeroCostDiscard(context as never, args as never),
  resolveDiscardToPlay: (context, args) => resolveDiscardToPlay(context as never, args as never),
  resolveReturnOnDiscard: (context, args) => resolveReturnOnDiscard(context as never, args as never),
  resolveGiveHqHeroChoice: (context, args) => resolveGiveHqHeroChoice(context as never, args as never),
  resolveCopyPowersChoice: (context, args) => resolveCopyPowersChoice(context as never, args as never),
  // why: WP-684 / D-24501 — a seat choice is resolved by the addressed seat; applyReplayStep
  // already passes move.playerId as playerID, so a non-active seat's resolve replays as that seat.
  resolveSeatChoice: (context, args) => resolveSeatChoice(context as never, args as never),
  // why: WP-802 / D-24689 — the operator setters guard on G.isDebugMatch themselves, so an entry
  // here replays a debug match's log faithfully and stays a no-op for any other match.
  operatorSetSupplyCount: (context, args) => operatorSetSupplyCount(context as never, args as never),
  operatorMoveToDeckTop: (context, args) => operatorMoveToDeckTop(context as never, args as never),
  operatorRevealNow: (context, args) => operatorRevealNow(context as never, args as never),
  operatorMoveCard: (context, args) => operatorMoveCard(context as never, args as never),
  operatorAddEconomy: (context, args) => operatorAddEconomy(context as never, args as never),
  operatorEscapeVillain: (context, args) => operatorEscapeVillain(context as never, args as never),
  setPlayerReady: (context, args) => setPlayerReady(context as never, args as never),
  startMatchIfReady: (context) => startMatchIfReady(context as never),
};

// why: D-24830 — exposed for the move-dispatch drift guard, which asserts this key set equals
// LegendaryGame.moves plus the lobby phase moves. Derived from Object.keys(MOVE_MAP), never a
// hand-maintained list (mirrors SIMULATION_RUNNER_MOVE_NAMES, WP-289 / D-24073).
export const REPLAY_MOVE_NAMES: readonly string[] = Object.keys(MOVE_MAP);

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
 * Applies a single ReplayMove to the given LegendaryGameState and returns
 * the same reference.
 *
 * Mutate-and-return-same-reference contract (D-6304): consumers wanting
 * historical snapshots must project via buildUIState after each step — they
 * must not retain G copies. applyReplayStep never clones.
 *
 * Unblocks WP-063's buildSnapshotSequence and future replay inspectors by
 * exposing the step-level dispatch primitive while keeping MOVE_MAP as the
 * single source of truth (D-6304). Inherits replayGame's determinism-only
 * semantics (D-0205).
 *
 * @param gameState - The current mutable game state; mutated in place.
 * @param move - The ReplayMove to apply (name + playerId + optional args).
 * @param numPlayers - Total number of players in the match.
 * @returns The same gameState reference that was passed in.
 */
export function applyReplayStep(
  gameState: LegendaryGameState,
  move: ReplayMove,
  numPlayers: number,
): LegendaryGameState {
  const moveFn = MOVE_MAP[move.moveName];
  if (!moveFn) {
    pushLog(gameState, 
      `Replay warning: unknown move name "${move.moveName}" — skipped.`,
    );
    return gameState;
  }
  const moveContext = buildMoveContext(gameState, move.playerId, numPlayers);
  moveFn(moveContext, move.args);
  return gameState;
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
 * @returns The replay result with final state, hash, and completed play-turn count.
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

  // why: the loop delegates to applyReplayStep so MOVE_MAP + buildMoveContext
  // remain the single source of truth for dispatch (D-6304). Reassignment is
  // stylistic — applyReplayStep returns the same reference per Q2 = A, so the
  // variable binding is always identical. Determinism regression is covered by
  // the PRE_WP080_HASH guard in replay.execute.test.ts via computeStateHash.
  for (const move of input.moves) {
    gameState = applyReplayStep(gameState, move, numPlayers);
  }

  // why: WP-732 / D-24553 — turn-loop-harness parity (PS-1) for the deferred
  // Mastermind win. Unlike the sim and runFixture, replayGame is a flat dispatch
  // loop with NO turn-end rotation site, so promote a pending Mastermind victory
  // once here, after the move loop and before the hash, so a recorded
  // Mastermind-win game reconstructs the same terminal state the other two
  // harnesses produce. This is a no-op on every committed fixture (none defeats a
  // Mastermind), so PRE_WP080_HASH and every sentinel hash stay byte-unchanged.
  promoteMastermindVictoryIfPending(gameState);

  // Step 3: Compute canonical state hash
  const stateHash = computeStateHash(gameState);

  // why: turnCount is the completed play-turn count — the competitive `rounds`
  // input (deriveScoringInputs reads it, D-24123), NOT the player move count. Each
  // completed turn ends with an `endTurn` move in a captured/sim move list, so the
  // count of `endTurn` moves is the completed-turn count; floored at 1 to match
  // reduceMatchToFinalState + par.aggregator's `turnsElapsed === 0 ? 1 : turnsElapsed`.
  // This offline determinism harness feeds no live scorer (only replay.verify's
  // self-check consumes its result), but the field must carry an honest turn count.
  let endTurnMoveCount = 0;
  for (const move of input.moves) {
    if (move.moveName === 'endTurn') {
      endTurnMoveCount = endTurnMoveCount + 1;
    }
  }
  const turnCount = endTurnMoveCount < 1 ? 1 : endTurnMoveCount;

  return {
    finalState: gameState,
    stateHash,
    turnCount,
  };
}
