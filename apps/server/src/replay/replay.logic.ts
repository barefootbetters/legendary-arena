/**
 * Server-Side Replay Storage — Logic (WP-103)
 *
 * Public functions for storing and loading content-addressed `ReplayInput`
 * blobs in `legendary.replay_blobs`. All persistent operations go through
 * PostgreSQL via a caller-injected `DatabaseClient` (`pg.Pool`); the
 * functions never open their own pool, never read `process.env`, and
 * never log.
 *
 * The `replay_hash` parameter is the cryptographic hash from WP-027's
 * `computeStateHash` (or any future content-addressing scheme); this
 * module never derives the hash itself — derivation is the caller's
 * responsibility (WP-053 submission path or any future ingestion shim).
 *
 * Layer-boundary contract: this module imports nothing from
 * `boardgame.io`, `@legendary-arena/game-engine` runtime, registry,
 * preplan, `vue-sfc-loader`, or any UI / client / replay-producer
 * package. The only import is `import type { … }` from the sibling
 * `./replay.types.js` re-export hub (`pg` itself is NOT imported here
 * — the `DatabaseClient` alias keeps driver coupling in `pg.Pool` /
 * `apps/server/src/identity/identity.types.ts` exclusively).
 *
 * Authority: WP-103 §Locked Contract Values; EC-111 §Locked Values
 * (`storeReplay` / `loadReplay` SQL verbatim, `Promise<void>` /
 * `Promise<ReplayInput | null>` return shapes verbatim); D-10301
 * (server-category classification); 13-REPLAYS-REFERENCE.md §Storage
 * and Access Architecture.
 */

import type { ReplayInput, DatabaseClient } from './replay.types.js';

// why: the conflict clause is DO-NOTHING (never the update-on-conflict
// alternative) — content-addressed rows are immutable after insert.
// The `replay_hash` IS the natural key; a SHA-256 collision producing
// different content for the same hash is statistically infeasible and
// would be a cryptographic anomaly, not expected behavior. Silent
// no-op on conflict is the correct semantic: observing two distinct
// `replay_input` values for the same `replay_hash` should be treated
// as a security incident, not a data-update opportunity. Diverges
// from WP-052's `assignReplayOwnership`, which uses an
// update-on-conflict-with-RETURNING pattern because ownership is not
// content-addressed (visibility may legitimately change for the same
// `(player_id, replay_hash)` pair).
/**
 * Idempotently store a `ReplayInput` blob keyed by its `replayHash`.
 * The first call inserts a fresh row; any subsequent call with the
 * same `replayHash` is a silent no-op (content-addressed rows are
 * immutable by construction). The function returns `Promise<void>` —
 * no `Result<T>` wrapper, no rowcount inspection, no `RETURNING`
 * clause. Infra-level errors (connection lost, permission denied,
 * malformed SQL) propagate via thrown exceptions for the caller (a
 * future request handler or submission-path WP-053 component) to
 * translate into HTTP responses or operator alerts.
 *
 * Parameter order is locked by WP-103 §Locked Values: hash first
 * (the natural key), payload second, database third (caller-injected,
 * last position so the call site reads `storeReplay(hash, blob, db)`
 * rather than threading the database through the prefix).
 */
export async function storeReplay(
  replayHash: string,
  replayInput: ReplayInput,
  database: DatabaseClient,
): Promise<void> {
  await database.query(
    'INSERT INTO legendary.replay_blobs (replay_hash, replay_input) ' +
      'VALUES ($1, $2) ' +
      'ON CONFLICT (replay_hash) DO NOTHING',
    [replayHash, replayInput],
  );
}

// why: pg's jsonb codec deserializes column values at the driver
// level — a manual JSON-parsing call against `result.rows[0].replay_input`
// would double-decode and break (the row value is already a JS
// object). The `as ReplayInput` cast at the return site is the only
// narrowing needed: pg's jsonb deserializer returns `unknown`-shaped
// JS values, and the application contract is that
// `legendary.replay_blobs` only ever contains `ReplayInput`-shaped
// rows (enforced at write time by the `storeReplay` parameter type —
// there is no other write path).
// why: this is the server-layer hash-indexed loader, distinct from
// `apps/arena-client/src/replay/loadReplay.ts`'s `parseReplayJson`
// (consumer-side `ReplaySnapshotSequence` parser, WP-074-era). The two
// share a directory name by convention; nothing else. Function-name
// conflict is zero — different layer (server vs arena-client),
// different signature ((hash, db) vs (jsonText)), different return
// type (`Promise<ReplayInput | null>` vs `ReplaySnapshotSequence`).
// The F-1 naming-overlap finding from the WP-103 pre-flight sweep
// confirmed this as a layer-boundary safety property, not a
// collision: no consumer can accidentally cross-call.
/**
 * Look up a stored `ReplayInput` blob by its `replayHash`. Returns
 * the deserialized blob on hit, `null` on miss. The function never
 * throws on absence — `null` is the only documented "miss" signal.
 * Infra-level errors (connection lost, permission denied, malformed
 * SQL) propagate via thrown exceptions.
 *
 * Used by future request handlers (WP-053 submission deduplication,
 * WP-054 leaderboard verification, any replay-by-hash retrieval
 * surface) to fetch a previously stored blob given its content hash.
 */
export async function loadReplay(
  replayHash: string,
  database: DatabaseClient,
): Promise<ReplayInput | null> {
  const result = await database.query(
    'SELECT replay_input FROM legendary.replay_blobs ' +
      'WHERE replay_hash = $1 LIMIT 1',
    [replayHash],
  );
  if (result.rows.length === 0) {
    return null;
  }
  return result.rows[0].replay_input as ReplayInput;
}
