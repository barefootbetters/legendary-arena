/**
 * Replay-LAGN Producer — Re-Execution Helpers (WP-810 / EC-847 / D-24716).
 *
 * Pure helpers that turn a completed match's durable replay artifact into a
 * verified LAGN 1.7.0 `replay.execution` block (`@legendary-arena/lagn`). The
 * block carries exactly what the D-24119 server reducer needs to re-run the
 * match: the match seed, the ordered engine moves by seat, the engine
 * version/build, a data-version marker, and the expected final-state hash.
 *
 * Verify-before-emit: `buildVerifiedReplayExecution` re-executes the moves from
 * the seed alone — rebuilding the initial state through the engine's own
 * `InitializeGame` from the emitted Tier-1 setup — and requires the resulting
 * `computeStateHash` to equal a FRESH faithful reduction of the same artifact on
 * the serving build (`reduceMatchToFinalState`). A block is emitted only when
 * that equality holds in the same call, so every document handed out is proven
 * re-executable on the build that served it.
 *
 * why: a fresh reduction, never the capture-time hash — engine-fidelity changes
 * legitimately move the stored hash, so comparing to it would refuse good
 * matches. The check catches every SETUP-TIME divergence (lossy setup data,
 * pre-WP-805 matches lacking `isFirstPlayerRandom`, registry or setup-code
 * drift). It does NOT detect a tampered log or move-processing drift since
 * capture: both sides share the moves and the serving build.
 *
 * Layer-boundary: the server layer wires only. Re-execution goes through
 * boardgame.io's own `InitializeGame` / `CreateGameReducer` and the engine's
 * read-only exports (D-24119); no move, phase, or turn rule is reimplemented.
 * This module does NO database I/O — the caller reads the durable artifact and
 * passes it in. It imports boardgame.io's reducer from the built dist entry (the
 * SERVER-only edge the D-24095 replay carve-out authorizes), the engine's
 * `computeStateHash` / `LegendaryGame` / version exports read-only, the sibling
 * `reduceMatchToFinalState` (the reference reduction), and the pure
 * `@legendary-arena/lagn` types.
 *
 * Authority: WP-810 / EC-847; D-24716 (replay-export carve-out + verify-before
 * -emit + the 1.7.0 writer); D-24119 / D-24124 (the faithful reducer replay);
 * D-24714 (the 1.7.0 `replay.execution` contract); D-24689 §1 / D-24700;
 * D-24211 (ordinal version gates).
 */

// why: the deep dist entry carries no TypeScript declarations and is the only
// resolvable boardgame.io reducer entry under the tsx / Node ESM toolchain (the
// bare `boardgame.io/internal` subpath does not resolve, and the root bundle
// pulls in client-side `react`). Pinned to the locked boardgame.io ^0.50.0 —
// the reducer + plugin internals are version-coupled. This mirrors
// `matchReplay.logic.ts`'s identical import.
import * as boardgameInternal from 'boardgame.io/dist/cjs/internal.js';

import {
  computeStateHash,
  LegendaryGame,
  getCurrentEngineVersion,
  formatEngineVersion,
  CURRENT_DATA_VERSION,
} from '@legendary-arena/game-engine';
import type { LAGN, ReplayExecution, ReplayExecutionMove } from '@legendary-arena/lagn';

import {
  reduceMatchToFinalState,
  type MatchReplayArtifact,
} from '../replay/matchReplay.logic.js';

/** The Tier-1 `setup` block of a LAGN document, the input to re-execution. */
type LagnSetup = LAGN['setup'];

/**
 * The nine-field match-setup composition boardgame.io's `InitializeGame` reads,
 * plus the optional Final Blow flag. The canonical `00.2 §8.1`
 * `MatchSetupConfig` field names.
 */
interface ReexecutionSetupData {
  readonly schemeId: string;
  readonly mastermindId: string;
  readonly villainGroupIds: string[];
  readonly henchmanGroupIds: string[];
  readonly heroDeckIds: string[];
  readonly bystandersCount: number;
  readonly woundsCount: number;
  readonly officersCount: number;
  readonly sidekicksCount: number;
  readonly finalBlow?: boolean;
}

/** The successful result of `reexecuteFromSeed`: the rebuilt final state + hash. */
export interface ReexecutionResult {
  readonly finalState: unknown;
  readonly finalContext: unknown;
  readonly stateHash: string;
}

/** A verified block plus the re-executed endgame verdict, or a typed refusal. */
export type VerifiedReplayExecution =
  | { readonly isVerified: true; readonly execution: ReplayExecution; readonly gameover: unknown }
  | { readonly isVerified: false; readonly reason: 'operator_match' | 'not_reexecutable' };

// why: boardgame.io action-type constants are stable literals in the locked
// 0.50.x; `internal.js` does not re-export them. A move is re-dispatched as
// `{ type: 'MAKE_MOVE', payload: { type, args, playerID } }`.
const MAKE_MOVE = 'MAKE_MOVE';

type BgioAction = { readonly type?: unknown; readonly payload?: unknown };

interface BgioInternalModule {
  InitializeGame(config: {
    game: unknown;
    numPlayers: number;
    setupData: unknown;
  }): { G: unknown; ctx: unknown; plugins?: unknown };
  CreateGameReducer(config: {
    game: unknown;
    isClient: boolean;
  }): (state: unknown, action: { type: string; payload: unknown }) => {
    G: unknown;
    ctx: unknown;
  };
}

const { InitializeGame, CreateGameReducer } =
  boardgameInternal as unknown as BgioInternalModule;

/**
 * Read a persisted log entry's boardgame.io `action`. A log entry is
 * `{ action, _stateID, turn, phase, automatic? }`; the `action` is the
 * `{ type, payload }` object the reducer applies.
 *
 * why: throws (fails closed) on an entry with no `action` object — a malformed
 * log column cannot be re-executed. The caller runs this inside the
 * verify-before-emit guard, so a throw becomes a `not_reexecutable` refusal, the
 * same disposition `reduceMatchToFinalState` gives the reference reduction.
 *
 * @param entry One persisted log entry (already-parsed jsonb).
 * @returns The entry's `action` object.
 */
function readEntryAction(entry: unknown): BgioAction {
  if (
    entry === null ||
    typeof entry !== 'object' ||
    !('action' in entry) ||
    (entry as { action: unknown }).action === null ||
    typeof (entry as { action: unknown }).action !== 'object'
  ) {
    throw new Error(
      'A persisted match log entry is missing its action object and cannot be ' +
        're-executed; the durable replay artifact log column may be malformed.',
    );
  }
  return (entry as { action: BgioAction }).action;
}

/**
 * Read a persisted log entry's live `turn` / `phase` stamps — the boardgame.io
 * `ctx.turn` / `ctx.phase` the entry was created under during the real match.
 *
 * @param entry One persisted log entry (already-parsed jsonb).
 * @returns The entry's live `turn` (or `null` when absent/non-integer) and
 *   `phase` (string or null).
 */
function readEntryTurnPhase(entry: unknown): { turn: number | null; phase: string | null } {
  if (entry === null || typeof entry !== 'object') {
    return { turn: null, phase: null };
  }
  const record = entry as { turn?: unknown; phase?: unknown };
  const turn = Number.isInteger(record.turn) ? (record.turn as number) : null;
  const phase =
    typeof record.phase === 'string' || record.phase === null
      ? (record.phase as string | null)
      : null;
  return { turn, phase };
}

/**
 * Map a completed match's persisted log to the ordered `replay.execution.moves`
 * — one entry per player `MAKE_MOVE`, in whole-match order, dropping every
 * framework `GAME_EVENT` entry (phase/turn transitions the engine triggers and
 * the reducer regenerates on re-execution).
 *
 * `seq` runs 0..n-1 across the kept moves. `seat` is `Number(playerID)`,
 * `move_name` and `args` are verbatim, and `args` is deep-copied via
 * `structuredClone` so the emitted data never aliases reducer-owned state. The
 * descriptive live `turn` / `phase` stamps ride when present (omit `turn` unless
 * an integer ≥ 1, omit `phase` unless a string or null).
 *
 * why: throws on an entry with no `action` (via `readEntryAction`) — the caller
 * runs this inside the verify-before-emit guard, so the throw is a
 * `not_reexecutable` refusal.
 *
 * @param log The persisted ordered log entries (already-parsed jsonb).
 * @returns The ordered re-executable moves.
 */
export function extractExecutionMoves(log: readonly unknown[]): ReplayExecutionMove[] {
  const moves: ReplayExecutionMove[] = [];
  for (const entry of log) {
    const action = readEntryAction(entry);
    // why: re-dispatch only player MAKE_MOVE inputs; a GAME_EVENT entry is a
    // move consequence the reducer regenerates, so it is never an emitted move.
    if (action.type !== MAKE_MOVE) {
      continue;
    }
    const payload = action.payload as { type?: unknown; args?: unknown; playerID?: unknown };
    const { turn, phase } = readEntryTurnPhase(entry);
    const move: ReplayExecutionMove = {
      seq: moves.length,
      seat: Number(payload.playerID),
      move_name: String(payload.type),
      // why: structuredClone so the emitted args never alias reducer-owned state
      // (a positional array the reducer may freeze or reuse).
      args: structuredClone(Array.isArray(payload.args) ? payload.args : []),
    };
    // why: descriptive-only stamps; omit a turn below 1 or a non-string/non-null
    // phase, exactly as the WP-808 schema permits.
    if (turn !== null && turn >= 1) {
      move.turn = turn;
    }
    if (typeof phase === 'string' || phase === null) {
      move.phase = phase;
    }
    moves.push(move);
  }
  return moves;
}

/**
 * Map the emitted Tier-1 LAGN `setup` block back to the nine-field setup data
 * boardgame.io's `InitializeGame` reads, plus `finalBlow: true` when the setup
 * carries the Final Blow flag.
 *
 * why: the ONLY non-1:1 rename is `shield_officers_count → officersCount` (the
 * S.H.I.E.L.D. officer pile, 00.2 §7), mirroring `buildMatchLagn`'s forward map.
 * Re-executing from the EMITTED setup (not the stored composition) is what makes
 * the hash check catch a lossy setup: a composition the Tier-1 projection cannot
 * reproduce rebuilds to a different initial state and diverges.
 *
 * @param setup The emitted Tier-1 LAGN setup block.
 * @returns The setup data for `InitializeGame`.
 */
export function toSetupDataFromLagnSetup(setup: LagnSetup): ReexecutionSetupData {
  const setupData: ReexecutionSetupData = {
    schemeId: setup.scheme.id,
    mastermindId: setup.mastermind.id,
    villainGroupIds: setup.villain_groups.map((group) => group.id),
    henchmanGroupIds: setup.henchmen_groups.map((group) => group.id),
    heroDeckIds: setup.heroes.map((hero) => hero.id),
    bystandersCount: setup.bystanders_count,
    woundsCount: setup.wounds_count,
    officersCount: setup.shield_officers_count,
    sidekicksCount: setup.sidekicks_count,
  };
  if (setup.final_blow === true) {
    // why: a Final Blow match records the flag on the composition the engine
    // reads (D-24503); round-trip it so the rebuild reproduces the same setup.
    return { ...setupData, finalBlow: true };
  }
  return setupData;
}

/**
 * Read the match seed from a persisted initial state — the non-empty string
 * boardgame.io minted at `plugins.random.data.seed` (the D-24119 landmine).
 *
 * why: seed, NOT initial state — `G` is runtime-only and holds hidden
 * information, so it is never exported. `{ ...LegendaryGame, seed }` reproduces
 * the minted initial state from the seed alone.
 *
 * @param initialState The persisted initial state (already-parsed jsonb).
 * @returns The seed string, or `null` when it is absent/empty/misshaped.
 */
export function readArtifactSeed(initialState: unknown): string | null {
  if (initialState === null || typeof initialState !== 'object') {
    return null;
  }
  const plugins = (initialState as { plugins?: unknown }).plugins;
  if (plugins === null || typeof plugins !== 'object') {
    return null;
  }
  const random = (plugins as { random?: unknown }).random;
  if (random === null || typeof random !== 'object') {
    return null;
  }
  const data = (random as { data?: unknown }).data;
  if (data === null || typeof data !== 'object') {
    return null;
  }
  const seed = (data as { seed?: unknown }).seed;
  return typeof seed === 'string' && seed !== '' ? seed : null;
}

/**
 * Report whether a persisted initial state belongs to an operator match (WP-802
 * / D-24689) — an admin test board that must never be exported as a real result.
 *
 * why: operator matches are refused before any re-execution (D-24689 §1,
 * D-24714). Checks both `G.isDebugMatch === true` and an own `isDebugMatch` key
 * on the composition — the same two reads the create-path refusal uses — so a
 * flagged board is caught however the flag was persisted.
 *
 * @param initialState The persisted initial state (already-parsed jsonb).
 * @returns `true` when the initial state is an operator board.
 */
export function isOperatorArtifact(initialState: unknown): boolean {
  if (initialState === null || typeof initialState !== 'object') {
    return false;
  }
  const game = (initialState as { G?: unknown }).G;
  if (game === null || typeof game !== 'object') {
    return false;
  }
  if ((game as { isDebugMatch?: unknown }).isDebugMatch === true) {
    return true;
  }
  const composition = (game as { matchConfiguration?: unknown }).matchConfiguration;
  if (composition !== null && typeof composition === 'object') {
    return Object.hasOwn(composition, 'isDebugMatch');
  }
  return false;
}

/**
 * Re-execute a completed match from its seed alone: rebuild the initial state
 * through boardgame.io's own `InitializeGame` (which runs `LegendaryGame.setup()`
 * from the emitted setup data), then re-dispatch the ordered moves through the
 * server-authoritative reducer, and compute the canonical final-state hash.
 *
 * why: `{ ...LegendaryGame, seed }` reproduces the minted initial state from the
 * seed (`G` is never exported). `isClient: false` so move-triggered GAME_EVENTs
 * (phase/turn hooks) and `endIf` fire, matching the live reduction.
 *
 * Throws (fails closed) on a setup rejection (`InitializeGame`) or any reducer
 * throw; the caller runs it inside the verify-before-emit guard.
 *
 * @param input The seed, seat count, setup data, and ordered moves.
 * @returns `{ finalState, finalContext, stateHash }`.
 */
export function reexecuteFromSeed(input: {
  seed: string;
  numPlayers: number;
  setupData: ReexecutionSetupData;
  moves: readonly ReplayExecutionMove[];
}): ReexecutionResult {
  const game = { ...LegendaryGame, seed: input.seed };
  const initial = InitializeGame({
    game,
    numPlayers: input.numPlayers,
    setupData: input.setupData,
  });
  const reducer = CreateGameReducer({ game, isClient: false });
  let current: { G: unknown; ctx: unknown } = initial;
  for (const move of input.moves) {
    current = reducer(current, {
      type: MAKE_MOVE,
      payload: { type: move.move_name, args: move.args, playerID: String(move.seat) },
    });
  }
  return {
    finalState: current.G,
    finalContext: current.ctx,
    stateHash: computeStateHash(current.G as never),
  };
}

/**
 * Read the boardgame.io build id (the serving build's short git sha) the engine
 * version info carries. Converted to the LAGN `engine_build`, omitted when
 * `'unknown'`.
 *
 * why: the VERIFYING build, not the build the match was played on. Both sides of
 * the hash check run on the serving build, so the emitted document is faithful
 * to it — that is the meaning of `engine_build`.
 *
 * @param buildId The serving build's short sha, or `'unknown'`.
 * @param moves The ordered re-executable moves.
 * @param finalStateHash The verified final-state hash.
 * @param seed The match seed.
 * @returns The `replay.execution` block.
 */
function buildExecutionBlock(
  buildId: string,
  moves: ReplayExecutionMove[],
  finalStateHash: string,
  seed: string,
): ReplayExecution {
  const execution: ReplayExecution = {
    engine: 'legendary-arena',
    engine_version: formatEngineVersion(getCurrentEngineVersion()),
    // why: every stored artifact postdates the data-version 2 bump (WP-137,
    // 2026-05-07, before durable storage began WP-309), so this is accurate
    // today. A future data-axis bump must migrate stored artifacts or refuse
    // pre-bump ones — the hash cannot see a stale args shape (D-24716 §3).
    data_version: CURRENT_DATA_VERSION.version,
    seed,
    moves,
    final_state_hash: finalStateHash,
  };
  if (buildId !== 'unknown') {
    execution.engine_build = buildId;
  }
  return execution;
}

/**
 * Build a VERIFIED `replay.execution` block for a completed match, or a typed
 * refusal. Refuses an operator match (`operator_match`); otherwise re-executes
 * from the seed and the emitted setup, and requires the rebuilt hash to equal a
 * fresh faithful reduction of the same artifact — a mismatch, a missing seed, a
 * setup rejection, a malformed log entry, or any reduction throw all yield
 * `not_reexecutable`.
 *
 * why: verify-before-emit, always — no path returns a block unless the hash
 * equality held in this call. The reference is a FRESH `reduceMatchToFinalState`
 * on the serving build, never the capture-time hash (engine-fidelity drift moves
 * that stored hash legitimately). `extractExecutionMoves` runs INSIDE the guard,
 * so a malformed log entry is a refusal, never an escaped fault.
 *
 * @param artifact The durable replay artifact (`{ initialState, log }`).
 * @param setup The emitted Tier-1 LAGN setup to re-execute from.
 * @param numPlayers The seat count.
 * @param buildId The serving build's short sha (or `'unknown'`).
 * @returns A verified block + the re-executed verdict, or a typed refusal.
 */
export function buildVerifiedReplayExecution(
  artifact: MatchReplayArtifact,
  setup: LagnSetup,
  numPlayers: number,
  buildId: string,
): VerifiedReplayExecution {
  // why: operator check before any re-execution (D-24689 §1, D-24714).
  if (isOperatorArtifact(artifact.initialState)) {
    return { isVerified: false, reason: 'operator_match' };
  }
  try {
    const seed = readArtifactSeed(artifact.initialState);
    if (seed === null) {
      return { isVerified: false, reason: 'not_reexecutable' };
    }
    const moves = extractExecutionMoves(artifact.log);
    const setupData = toSetupDataFromLagnSetup(setup);
    const rebuilt = reexecuteFromSeed({ seed, numPlayers, setupData, moves });
    const reference = reduceMatchToFinalState({
      initialState: artifact.initialState,
      log: artifact.log,
    });
    if (rebuilt.stateHash !== reference.stateHash) {
      return { isVerified: false, reason: 'not_reexecutable' };
    }
    const execution = buildExecutionBlock(buildId, moves, rebuilt.stateHash, seed);
    // why: the re-executed final ctx.gameover becomes the document's result
    // outcome (D-24716 §1); boardgame.io copies it into the stored verdict, so
    // the shapes are equal. `null` when the match did not end on a decisive move.
    const gameover = (rebuilt.finalContext as { gameover?: unknown }).gameover ?? null;
    return { isVerified: true, execution, gameover };
  } catch (caughtError) {
    // why: a setup rejection, a malformed log entry, or any reduction throw is a
    // refusal, not a server fault — a stored config the current registry rejects
    // is the caller's data problem, not ours. The caught value is discarded.
    void caughtError;
    return { isVerified: false, reason: 'not_reexecutable' };
  }
}
