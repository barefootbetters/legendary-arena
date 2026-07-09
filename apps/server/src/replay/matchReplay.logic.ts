/**
 * Server-Layer Faithful Reducer-Replay — Server Layer (WP-334)
 *
 * WP-2 of the D-24119 faithful-replay arc. Re-executes a completed match's
 * persisted boardgame.io `initialState + log` (from the WP-309 `bgio.matches`
 * store) through boardgame.io's OWN reducer to reproduce the exact live final
 * `G` — seed- and phase/turn-hook-faithful by construction — and computes the
 * canonical `computeStateHash` over it.
 *
 * WP-336 additions: `readReplayArtifactByHash` + `reduceReplayByHash` (the
 * competitive verifier's faithful-path lookup, reading the WP-335
 * `bgio.replay_artifacts` store by `replayHash`), and `turnCount` on the result
 * (the PAR-calibrated `rounds` input, D-24123). WP-336 also FIXED a multi-turn
 * faithfulness bug in the reduction: play-phase `endTurn` GAME_EVENTs are logged
 * `automatic: false`, so WP-334's skip-`automatic` reduction re-dispatched them
 * on top of the move that triggered them and double-advanced every turn past the
 * first — divergent for every multi-turn match (WP-334's only golden was a 0-turn
 * lobby game). The reduction now re-dispatches only player `MAKE_MOVE` inputs and
 * lets the reducer regenerate all move-triggered transitions (D-24124).
 *
 * Layer-boundary: the reducer-replay imports boardgame.io — permitted in the
 * SERVER layer only, per D-24119 + the D-24095 replay/verification carve-out
 * (the engine's `packages/game-engine/src/replay/**` may NOT, per D-2705). It
 * imports the engine's `computeStateHash` + `LegendaryGame` read-only and
 * changes nothing in the engine.
 *
 * Authority: WP-334 / EC-364; WP-336 / EC-366; D-24119 (arc + landmines);
 * D-24095 (read carve-out); D-0205 / D-2705 (engine harness stays
 * determinism-only, no boardgame.io in the engine); D-5201 (AccountId). Reserves
 * D-24121 (WP-334), D-24123 + D-24124 (WP-336).
 */

// why: WP-334 imports boardgame.io's reducer from the package's built internal
// entry `boardgame.io/dist/cjs/internal.js`. The bare `boardgame.io/internal`
// subpath does NOT resolve under the tsx / Node ESM toolchain (boardgame.io
// 0.50.2 ships legacy proxy directories with no `exports` map and no index
// module, so the subpath falls through to a non-existent `internal/index.jsx`),
// and the root `boardgame.io` bundle pulls in `react` (client code) and fails
// server-side. The concrete dist entry is the only resolvable path and is a
// published file (package `files` lists `dist/cjs`). Pinned to the locked
// boardgame.io ^0.50.0 — the reducer + plugin internals are version-coupled;
// a major bump must re-verify this replay path.
import * as boardgameInternal from 'boardgame.io/dist/cjs/internal.js';

import { computeStateHash, LegendaryGame } from '@legendary-arena/game-engine';
import type { LegendaryGameState } from '@legendary-arena/game-engine';

import type { DatabaseClient } from '../identity/identity.types.js';

// why: the deep dist entry carries no TypeScript declarations, so the reducer
// factory is typed locally to the shape this module uses. `CreateGameReducer`
// returns a Redux-style `(state, action) => state` reducer; passing
// `isClient: false` is mandatory so GAME_EVENT handling + post-move triggers
// (the phase/turn hooks that drive the start-of-turn draw) run — a client
// reducer early-returns on GAME_EVENT and skips triggers, which would diverge
// from the live state.
interface BgioReducerState {
  readonly G: LegendaryGameState;
  readonly ctx: unknown;
  readonly plugins?: unknown;
  readonly _stateID?: number;
  readonly deltalog?: readonly unknown[];
}

type BgioAction = { readonly type: string; readonly payload: unknown };

interface BgioInternalModule {
  CreateGameReducer(config: {
    game: unknown;
    isClient: boolean;
  }): (state: unknown, action: BgioAction) => BgioReducerState;
}

const { CreateGameReducer } =
  boardgameInternal as unknown as BgioInternalModule;

/**
 * A persisted match artifact sufficient to reconstruct the final state: the
 * boardgame.io `initialState` blob (seed-bearing) and the ordered `LogEntry[]`.
 * Both are read verbatim from `bgio.matches` (jsonb) — opaque to this module
 * except for each entry's `action`.
 */
export interface MatchReplayArtifact {
  readonly initialState: unknown;
  readonly log: readonly unknown[];
}

/**
 * The faithful reconstruction result: the reproduced final `G`, its canonical
 * hash (the same `computeStateHash` the competitive pipeline uses), and the
 * completed play-turn count used as the competitive `rounds` input.
 */
export interface MatchReplayResult {
  readonly finalState: LegendaryGameState;
  readonly stateHash: string;
  /**
   * The number of completed play-phase turns, reconciled to the `turnsElapsed`
   * quantity the PAR baselines were calibrated with (WP-336 / D-24123). The
   * competitive verifier feeds this into `deriveScoringInputs` as `rounds`.
   */
  readonly turnCount: number;
}

/**
 * The boardgame.io `ctx.turn` value of the first PLAY-phase turn. The lobby is
 * turn 1; `startMatchIfReady`'s `setPhase('play')` begins a fresh turn, so the
 * first play turn is turn 2.
 *
 * // why: this is the offset subtracted from the highest play-phase turn in the
 * log to count completed play turns (see computeTurnCount). Verified empirically
 * for WP-336 by driving N real turns through the reducer (the final play move is
 * stamped turn === 2 + N) and locked by the multi-turn assertions in
 * matchReplay.logic.test.ts — if the pre-play phase structure ever changes, that
 * test fails loudly rather than the competitive score silently drifting.
 */
const FIRST_PLAY_TURN = 2;

/**
 * Read the `{ turn, phase }` a persisted `LogEntry` was stamped with LIVE. A
 * log entry is `{ action, _stateID, turn, phase, automatic? }`; `turn` is the
 * boardgame.io `ctx.turn` and `phase` the `ctx.phase` at the moment the entry
 * was created during the real match.
 *
 * @param entry One persisted log entry (jsonb).
 * @returns The entry's live `turn` (or `0` when absent/non-numeric) and `phase`.
 */
function readEntryTurnPhase(entry: unknown): { turn: number; phase: string | null } {
  if (typeof entry !== 'object' || entry === null) {
    return { turn: 0, phase: null };
  }
  const record = entry as { turn?: unknown; phase?: unknown };
  const turn = typeof record.turn === 'number' ? record.turn : 0;
  const phase =
    typeof record.phase === 'string' || record.phase === null
      ? (record.phase as string | null)
      : null;
  return { turn, phase };
}

/**
 * Compute the competitive `rounds` input — the number of completed play-phase
 * turns — from the highest play-phase turn number recorded in the match log.
 *
 * @param maxPlayTurn The largest `turn` stamped on any `phase === 'play'` log
 *   entry (or `0` when the match never reached play).
 * @returns The completed play-turn count, floored at `1`.
 */
function computeTurnCount(maxPlayTurn: number): number {
  // why: rounds = completed play turns, reconciled to par.aggregator.ts's
  // `turnsElapsed` (the quantity the PAR baselines were calibrated with, D-24123).
  // The count is derived from the LOG's live-recorded per-entry `turn`, NOT the
  // reduced `ctx.turn`: re-executing the log through the reducer while skipping
  // AUTOMATIC entries reproduces the final `G` faithfully (WP-334) but does NOT
  // reproduce `ctx` — the reduced `ctx.turn`/`ctx.phase` drift from live (and `ctx`
  // is hash-excluded, so WP-334's golden never covered it). Each log entry, by
  // contrast, carries the live `ctx.turn` it was stamped with. boardgame.io numbers
  // the first play turn `FIRST_PLAY_TURN` and increments by exactly 1 per turn, so
  // the highest play-phase `turn` in the log is FIRST_PLAY_TURN + (completed play
  // turns). `maxPlayTurn - FIRST_PLAY_TURN` therefore equals `turnsElapsed`; floored
  // at 1 to mirror its `turnsElapsed === 0 ? 1 : turnsElapsed`.
  const completedTurns = maxPlayTurn - FIRST_PLAY_TURN;
  return completedTurns < 1 ? 1 : completedTurns;
}

/**
 * Extract the boardgame.io action object from a persisted `LogEntry`. A log
 * entry is `{ action, _stateID, turn, phase, automatic? }`; the `action` is the
 * full `{ type, payload }` object the reducer applies.
 *
 * @param entry One persisted log entry (jsonb).
 * @returns The entry's `action`.
 */
function extractAction(entry: unknown): BgioAction {
  if (
    typeof entry !== 'object' ||
    entry === null ||
    !('action' in entry) ||
    typeof (entry as { action: unknown }).action !== 'object' ||
    (entry as { action: unknown }).action === null
  ) {
    throw new Error(
      'A persisted match log entry is missing its `action` object and cannot ' +
        'be replayed; the bgio.matches log column may be malformed.',
    );
  }
  return (entry as { action: BgioAction }).action;
}

/**
 * Whether a persisted log entry is a player `MAKE_MOVE` input — the only kind of
 * entry that must be re-dispatched to reproduce the match. Every `GAME_EVENT`
 * entry (phase/turn transitions: `setPhase`, `endTurn`, `endPhase`, plus their
 * `onBegin`/`onEnd` effects) is a *consequence* the engine's moves trigger via
 * `ctx.events.*`, and the reducer regenerates it inline when the triggering move
 * is re-dispatched — and re-evaluates `endIf` after every move — so `GAME_EVENT`
 * entries must be SKIPPED.
 *
 * @param action The action extracted from a persisted log entry.
 * @returns `true` when the action is a player `MAKE_MOVE`.
 */
function isPlayerMove(action: BgioAction): boolean {
  return action.type === 'MAKE_MOVE';
}

/**
 * Reproduce a completed match's final `G` by re-executing its persisted
 * `initialState + log` through boardgame.io's own reducer, starting from the
 * persisted initial state (NOT a fresh `InitializeGame` — that mints a new
 * seed and would diverge), and compute the canonical `computeStateHash`.
 *
 * Faithful by construction: only player `MAKE_MOVE` inputs are re-dispatched, and
 * the framework reducer re-runs every move-triggered phase/turn transition (via
 * `ctx.events.*`), re-evaluates `endIf` after each move, and re-runs the seeded
 * `alea` PRNG (rehydrated from `initialState.plugins.random.data`) — so the
 * reproduced final `G` equals the live final `G`.
 *
 * Pure: no I/O. Throws (fails closed) on a null initial state or a malformed
 * log entry — never returns a partial or guessed state.
 *
 * @param artifact The persisted `{ initialState, log }` (from `readMatchForReplay`).
 * @returns `{ finalState, stateHash, turnCount }`.
 */
export function reduceMatchToFinalState(
  artifact: MatchReplayArtifact,
): MatchReplayResult {
  if (artifact.initialState === null || artifact.initialState === undefined) {
    throw new Error(
      'Cannot replay a match with no persisted initial state; the bgio.matches ' +
        'row has a null initial_state (a setState-upsert-created row) and is ' +
        'not replayable.',
    );
  }
  // why: isClient: false — server-authoritative reduction; move-triggered
  // GAME_EVENTs (phase/turn hooks) + endIf must fire for the reproduced state to
  // match live.
  const reducer = CreateGameReducer({ game: LegendaryGame, isClient: false });
  let state = artifact.initialState as BgioReducerState;
  // why: track the highest play-phase turn number the log was stamped with LIVE —
  // the faithful source for the competitive rounds count (see computeTurnCount).
  let maxPlayTurn = 0;
  for (const entry of artifact.log) {
    const { turn, phase } = readEntryTurnPhase(entry);
    if (phase === 'play' && turn > maxPlayTurn) {
      maxPlayTurn = turn;
    }
    const action = extractAction(entry);
    // why: re-dispatch ONLY player MAKE_MOVE inputs; skip every GAME_EVENT entry.
    // In this engine, players submit moves — never raw framework events; every
    // phase/turn transition is a move consequence the engine triggers via
    // `ctx.events.*`. When the triggering move is re-dispatched, the reducer
    // regenerates those transitions inline (and re-evaluates `endIf`), so a
    // GAME_EVENT entry in the log is a duplicate: re-dispatching it double-applies
    // the transition (a turn ended twice, a phase set twice) and diverges from the
    // live state. WP-334 originally skipped only `automatic === true` entries, but
    // play-phase `endTurn` GAME_EVENTs are logged `automatic: false`, so that skip
    // double-advanced every turn beyond the first — faithful for a 0-turn lobby
    // game (WP-334's only golden) but divergent for every multi-turn match
    // (WP-336 finding; D-24124). Skipping all GAME_EVENTs is faithful for 0..N turns.
    if (!isPlayerMove(action)) {
      continue;
    }
    state = reducer(state, action);
  }
  const finalState = state.G;
  const turnCount = computeTurnCount(maxPlayTurn);
  return { finalState, stateHash: computeStateHash(finalState), turnCount };
}

/**
 * Read a completed match's replay artifact from the WP-309 `bgio.matches` store
 * (the D-24095 replay carve-out authorizes this server-layer read). Returns the
 * `{ initialState, log, metadata }` needed to reconstruct the final state, or
 * `null` when the row is absent OR its `initial_state` is null (a
 * setState-upsert-created row is not replayable — fail closed).
 *
 * @param matchId The boardgame.io match id.
 * @param database The caller-injected `pg` pool.
 * @returns The artifact, or `null` when not replayable.
 */
export async function readMatchForReplay(
  matchId: string,
  database: DatabaseClient,
): Promise<{ initialState: unknown; log: readonly unknown[]; metadata: unknown } | null> {
  // why: a direct, read-only SELECT against the framework store (not the
  // boardgame.io storage adapter) makes the replay read intent explicit per the
  // D-24095 carve-out ("a derived, read-only projection"). jsonb columns arrive
  // already parsed from node-pg.
  const result = await database.query(
    'SELECT initial_state, log, metadata FROM bgio.matches WHERE match_id = $1',
    [matchId],
  );
  if (result.rows.length === 0) {
    return null;
  }
  const row = result.rows[0];
  if (row.initial_state === null || row.initial_state === undefined) {
    return null;
  }
  return {
    initialState: row.initial_state,
    log: Array.isArray(row.log) ? row.log : [],
    metadata: row.metadata,
  };
}

/**
 * Read a submitted replay's durable artifact from the WP-335
 * `bgio.replay_artifacts` store by its canonical `replayHash`. This is the
 * lookup the competitive verifier uses (WP-336): the harvester copies each
 * finished match's `{ initialState, log }` here keyed by `replayHash`, so the
 * artifact survives the WP-327 reaper deleting the live `bgio.matches` row.
 *
 * @param replayHash The canonical `computeStateHash` a client submitted.
 * @param database The caller-injected `pg` pool.
 * @returns The `{ initialState, log }` to reduce, or `null` when no artifact
 *   with that hash exists (an unknown / uncaptured replay).
 */
export async function readReplayArtifactByHash(
  replayHash: string,
  database: DatabaseClient,
): Promise<{ initialState: unknown; log: readonly unknown[] } | null> {
  // why: a direct read-only SELECT against the durable artifact store (the
  // `bgio` schema, D-24122 — a derived replay projection, NOT the legendary.*
  // domain), scoped to the submitted hash. jsonb columns arrive already parsed.
  const result = await database.query(
    'SELECT initial_state, log FROM bgio.replay_artifacts WHERE replay_hash = $1',
    [replayHash],
  );
  if (result.rows.length === 0) {
    return null;
  }
  const row = result.rows[0];
  if (row.initial_state === null || row.initial_state === undefined) {
    return null;
  }
  return {
    initialState: row.initial_state,
    log: Array.isArray(row.log) ? row.log : [],
  };
}

/**
 * Whether a match has reached gameover, read from its `bgio.matches` metadata.
 * The submit-by-matchId flow (WP-338) gates on this BEFORE any capture: scoring is
 * end-of-match only (D-4804), so an unfinished match must be rejected, never
 * captured/scored on a non-terminal state. Mirrors the capture harvester's own
 * gameover predicate (`jsonb_exists(metadata,'gameover')`).
 *
 * @param matchId The boardgame.io match id.
 * @param database The caller-injected `pg` pool.
 * @returns `true` when the match's metadata carries a `gameover`; `false` when the
 *   match is absent or still in progress.
 */
export async function isMatchFinished(
  matchId: string,
  database: DatabaseClient,
): Promise<boolean> {
  const result = await database.query(
    "SELECT (metadata ? 'gameover') AS finished FROM bgio.matches WHERE match_id = $1",
    [matchId],
  );
  if (result.rows.length === 0) {
    return false;
  }
  return result.rows[0].finished === true;
}

/**
 * Resolve a finished match's canonical `replayHash` from the durable WP-335
 * `bgio.replay_artifacts` store by its `match_id`. This is the lookup the
 * submit-by-matchId flow (WP-338) uses: the arena-client submits a `matchId`, and
 * the server needs the `replayHash` the capture step stored for it. Returns `null`
 * when the match has not been captured yet (the caller then captures on-demand).
 *
 * @param matchId The boardgame.io match id.
 * @param database The caller-injected `pg` pool.
 * @returns The stored `replayHash`, or `null` when no artifact for the match exists.
 */
export async function readReplayHashByMatchId(
  matchId: string,
  database: DatabaseClient,
): Promise<string | null> {
  // why: LIMIT 1 — the capture step writes exactly one artifact per finished match
  // (keyed by replay_hash, carrying the match_id), so at most one row matches; the
  // limit documents that one-row expectation and guards a defensive extra row.
  const result = await database.query(
    'SELECT replay_hash FROM bgio.replay_artifacts WHERE match_id = $1 LIMIT 1',
    [matchId],
  );
  if (result.rows.length === 0) {
    return null;
  }
  return result.rows[0].replay_hash as string;
}

/**
 * Look up a submitted replay's durable artifact by `replayHash` and reduce it
 * to its final state. This is the faithful-path replacement for the WP-053
 * verifier's old `loadReplay` + `replayGame` pair (WP-336): a single call that
 * reads `bgio.replay_artifacts` and re-executes it through boardgame.io's own
 * reducer, returning the reproduced final `G`, its canonical hash (for the
 * anti-tamper compare), and the completed play-turn count (the `rounds` input).
 *
 * @param replayHash The canonical `computeStateHash` a client submitted.
 * @param database The caller-injected `pg` pool.
 * @returns The `MatchReplayResult`, or `null` when no artifact with that hash
 *   exists (the verifier maps `null` to a replay-verification failure — it does
 *   NOT throw for an unknown replay).
 */
export async function reduceReplayByHash(
  replayHash: string,
  database: DatabaseClient,
): Promise<MatchReplayResult | null> {
  const artifact = await readReplayArtifactByHash(replayHash, database);
  if (artifact === null) {
    return null;
  }
  return reduceMatchToFinalState(artifact);
}
