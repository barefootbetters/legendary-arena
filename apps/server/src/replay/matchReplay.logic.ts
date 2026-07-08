/**
 * Server-Layer Faithful Reducer-Replay — Server Layer (WP-334)
 *
 * WP-2 of the D-24119 faithful-replay arc. Re-executes a completed match's
 * persisted boardgame.io `initialState + log` (from the WP-309 `bgio.matches`
 * store) through boardgame.io's OWN reducer to reproduce the exact live final
 * `G` — seed- and phase/turn-hook-faithful by construction — and computes the
 * canonical `computeStateHash` over it.
 *
 * MECHANISM ONLY: this module does not repoint the WP-053 submission verifier
 * (deferred, D-24121 — no `replayHash → matchId` mapping exists until the WP-3
 * capture step creates it) and does not capture live matches.
 *
 * Layer-boundary: the reducer-replay imports boardgame.io — permitted in the
 * SERVER layer only, per D-24119 + the D-24095 replay/verification carve-out
 * (the engine's `packages/game-engine/src/replay/**` may NOT, per D-2705). It
 * imports the engine's `computeStateHash` + `LegendaryGame` read-only and
 * changes nothing in the engine.
 *
 * Authority: WP-334 / EC-364; D-24119 (arc + landmines); D-24095 (read
 * carve-out); D-0205 / D-2705 (engine harness stays determinism-only, no
 * boardgame.io in the engine); D-5201 (AccountId). Reserves D-24121.
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
 * The faithful reconstruction result: the reproduced final `G` and its
 * canonical hash (the same `computeStateHash` the competitive pipeline uses).
 */
export interface MatchReplayResult {
  readonly finalState: LegendaryGameState;
  readonly stateHash: string;
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
 * Whether a persisted log entry is an AUTOMATIC event — a phase/turn transition
 * (setPhase, endTurn, endPhase, onBegin/onEnd effects) that the framework
 * generated as a *consequence* of a move (e.g. a move calling
 * `ctx.events.setPhase`), rather than an external input the client dispatched.
 *
 * @param entry One persisted log entry (jsonb).
 * @returns `true` when the entry is framework-automatic and must NOT be re-dispatched.
 */
function isAutomaticEntry(entry: unknown): boolean {
  return (
    typeof entry === 'object' &&
    entry !== null &&
    (entry as { automatic?: unknown }).automatic === true
  );
}

/**
 * Reproduce a completed match's final `G` by re-executing its persisted
 * `initialState + log` through boardgame.io's own reducer, starting from the
 * persisted initial state (NOT a fresh `InitializeGame` — that mints a new
 * seed and would diverge), and compute the canonical `computeStateHash`.
 *
 * Faithful by construction: the framework reducer re-runs the phase/turn hooks
 * and the seeded `alea` PRNG (rehydrated from `initialState.plugins.random.data`),
 * so the reproduced final `G` equals the live final `G`.
 *
 * Pure: no I/O. Throws (fails closed) on a null initial state or a malformed
 * log entry — never returns a partial or guessed state.
 *
 * @param artifact The persisted `{ initialState, log }` (from `readMatchForReplay`).
 * @returns `{ finalState, stateHash }`.
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
  // why: isClient: false — server-authoritative reduction; GAME_EVENT + move
  // triggers (phase/turn hooks) must fire for the reproduced state to match live.
  const reducer = CreateGameReducer({ game: LegendaryGame, isClient: false });
  let state = artifact.initialState as BgioReducerState;
  for (const entry of artifact.log) {
    // why: skip AUTOMATIC entries. A move that calls `ctx.events.setPhase` /
    // `endTurn` triggers phase/turn transitions the reducer re-runs INLINE when
    // the move is re-dispatched — the log records those consequences as separate
    // automatic entries, and re-dispatching them would double-apply the
    // transition (a phase set twice, a turn hook fired twice) and diverge from
    // the live state. Re-dispatch only the external inputs (player MAKE_MOVEs and
    // player-initiated GAME_EVENTs); the reducer regenerates every automatic
    // consequence faithfully.
    if (isAutomaticEntry(entry)) {
      continue;
    }
    state = reducer(state, extractAction(entry));
  }
  const finalState = state.G;
  return { finalState, stateHash: computeStateHash(finalState) };
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
