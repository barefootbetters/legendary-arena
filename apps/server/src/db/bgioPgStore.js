/**
 * Legendary Arena — boardgame.io Postgres Match Store (WP-309 / EC-339)
 *
 * A custom `StorageAPI.Async` adapter that backs boardgame.io's match store
 * with the existing PostgreSQL instance so an in-progress match survives a
 * server deploy or restart instead of vanishing with the in-memory store.
 * Constructed once in `apps/server/src/server.mjs` and passed as the `db:`
 * option to `Server({...})`.
 *
 * why: SCHEMA BOUNDARY — the store lives in a dedicated `bgio` schema, NEVER
 * in the `legendary.*` domain schema. This physically separates boardgame.io's
 * framework operational state from application domain data. Per the WP-309
 * architecture reconciliation (DECISIONS.md D-24095), the "`G` is never
 * persisted" invariant means *application code* never persists `G` into the
 * domain schema, never reads it back to reconstruct or branch game logic, and
 * never builds features on a persisted `G`. boardgame.io's OWN storage layer
 * round-tripping its opaque match blob to survive a restart is a framework /
 * operational durability concern, categorically distinct from application code
 * persisting `G`.
 *
 * why: ADAPTER NEVER INTERPRETS THE BLOB — this module STORES ONLY. It writes
 * and reads the `state` / `metadata` / `initial_state` / `log` jsonb columns as
 * opaque boardgame.io payloads. It never inspects, branches on, or derives any
 * game logic from their contents, and it imports no engine code. It is a pure
 * Server-layer wiring artifact: it stores, it does not decide gameplay.
 *
 * why: this module belongs to the Server layer only and imports nothing —
 * the `pg.Pool` is injected by the caller (the single long-lived WP-115 pool),
 * never constructed here. A second pool would defeat the single-pool,
 * close-on-SIGTERM invariant that `database.js` + `index.mjs` own.
 *
 * Authority: WP-309 §Scope (In) §A; EC-339 §Locked Values + §Guardrails;
 * DECISIONS.md D-24095 (framework-store exemption + dedicated `bgio` schema +
 * Option A over Option B).
 */

// why: boardgame.io's storage-type discriminant. Its `Type` enum
// (src/server/db/base.ts) is `SYNC = 0`, `ASYNC = 1`, and `isSynchronous()`
// checks `storageAPI.type() === Type.SYNC`. The enum is NOT re-exported from
// the `boardgame.io/server` bundle (only `Server`, `Origins`, `SocketIO`,
// `FlatFile` are), so the numeric literal is written out here with this
// comment rather than imported. `1` marks this adapter as asynchronous so
// boardgame.io awaits every method.
const STORAGE_TYPE_ASYNC = 1;

/**
 * Builds the boardgame.io `StorageAPI.Async` adapter over an injected
 * `pg.Pool`. The returned object implements the boardgame.io ^0.50 async
 * storage contract: `type`, `connect`, `createMatch`, `setState`,
 * `setMetadata`, `fetch`, `wipe`, `listMatches`.
 *
 * The match blob is stored as jsonb in `bgio.matches` keyed by
 * `match_id text primary key`. Each method reuses the injected pool; no new
 * pool and no per-call connect/disconnect.
 *
 * @param {import('pg').Pool} pool - The single long-lived WP-115 `pg.Pool`.
 * @returns {object} An object implementing boardgame.io's `StorageAPI.Async`.
 */
export function createBgioPgStore(pool) {
  return {
    /**
     * Reports this storage adapter as asynchronous so boardgame.io awaits
     * every method (per `isSynchronous()` / the `Type` enum).
     *
     * @returns {number} `1` (boardgame.io `Type.ASYNC`).
     */
    type() {
      return STORAGE_TYPE_ASYNC;
    },

    /**
     * Connect hook. Intentionally a no-op: the `pg.Pool` is already
     * constructed and lazily opens a connection on first query, and its
     * lifetime (close-on-SIGTERM) is owned by `index.mjs`, not by this
     * adapter. boardgame.io awaits this once during `server.run()`.
     *
     * @returns {Promise<void>}
     */
    async connect() {
      // why: nothing to open — the injected WP-115 pool owns its own
      // lifecycle. Returning resolves the connect step boardgame.io awaits.
      return;
    },

    /**
     * Creates a new match row: stores the initial state (both as the live
     * `state` and as the immutable `initial_state`), the metadata, and an
     * empty log. Idempotent via upsert so a re-created match id resets cleanly.
     *
     * @param {string} matchID - boardgame.io match id.
     * @param {{ initialState: unknown, metadata: unknown }} opts - Creation payload.
     * @returns {Promise<void>}
     */
    async createMatch(matchID, opts) {
      try {
        await pool.query(
          `INSERT INTO bgio.matches
             (match_id, state, initial_state, metadata, log, updated_at)
           VALUES ($1, $2::jsonb, $2::jsonb, $3::jsonb, '[]'::jsonb, now())
           ON CONFLICT (match_id) DO UPDATE
             SET state = EXCLUDED.state,
                 initial_state = EXCLUDED.initial_state,
                 metadata = EXCLUDED.metadata,
                 log = '[]'::jsonb,
                 updated_at = now()`,
          [matchID, opts.initialState, opts.metadata],
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(
          `bgioPgStore.createMatch failed to insert match "${matchID}" into bgio.matches. ` +
            `Check that the bgio schema migration has been applied and the database is reachable. ` +
            `Error: ${errorMessage}`,
        );
      }
    },

    /**
     * Updates the live match state, appending `deltalog` to the stored log
     * when present. Upserts so a state write for a match whose row is missing
     * (e.g. created before this store was wired) still persists.
     *
     * @param {string} matchID - boardgame.io match id.
     * @param {unknown} state - The full match state to store.
     * @param {unknown[]} [deltalog] - Log entries to append.
     * @returns {Promise<void>}
     */
    async setState(matchID, state, deltalog) {
      // why: an empty/absent deltalog concatenates as `existing || '[]'`,
      // leaving the stored log unchanged; a non-empty deltalog appends. This
      // mirrors boardgame.io's InMemory/FlatFile "append when deltalog present"
      // semantics without a branch.
      const deltalogArray = deltalog !== undefined ? deltalog : [];
      try {
        await pool.query(
          `INSERT INTO bgio.matches AS existing
             (match_id, state, log, updated_at)
           VALUES ($1, $2::jsonb, $3::jsonb, now())
           ON CONFLICT (match_id) DO UPDATE
             SET state = EXCLUDED.state,
                 log = existing.log || $3::jsonb,
                 updated_at = now()`,
          [matchID, state, JSON.stringify(deltalogArray)],
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(
          `bgioPgStore.setState failed to persist state for match "${matchID}". ` +
            `Check that the bgio schema migration has been applied and the database is reachable. ` +
            `Error: ${errorMessage}`,
        );
      }
    },

    /**
     * Updates the match metadata. An UPDATE (not an upsert) because
     * boardgame.io always calls `createMatch` before any standalone
     * `setMetadata`, so the row is guaranteed to exist; a metadata write for
     * an unknown match id is intentionally a no-op rather than creating a
     * stateless row.
     *
     * @param {string} matchID - boardgame.io match id.
     * @param {unknown} metadata - The match metadata to store.
     * @returns {Promise<void>}
     */
    async setMetadata(matchID, metadata) {
      try {
        await pool.query(
          `UPDATE bgio.matches
             SET metadata = $2::jsonb, updated_at = now()
           WHERE match_id = $1`,
          [matchID, metadata],
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(
          `bgioPgStore.setMetadata failed to persist metadata for match "${matchID}". ` +
            `Check that the bgio schema migration has been applied and the database is reachable. ` +
            `Error: ${errorMessage}`,
        );
      }
    },

    /**
     * Fetches the requested fields for a match. The returned object contains
     * only the keys enabled in `opts` (`state`, `metadata`, `log`,
     * `initialState`), matching boardgame.io's InMemory/FlatFile behaviour.
     * A missing row yields an empty object.
     *
     * @param {string} matchID - boardgame.io match id.
     * @param {{ state?: boolean, log?: boolean, metadata?: boolean, initialState?: boolean }} opts
     *   Which fields to return.
     * @returns {Promise<object>} The requested fields.
     */
    async fetch(matchID, opts) {
      let queryResult;
      try {
        queryResult = await pool.query(
          `SELECT state, initial_state, metadata, log
             FROM bgio.matches
            WHERE match_id = $1`,
          [matchID],
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(
          `bgioPgStore.fetch failed to read match "${matchID}" from bgio.matches. ` +
            `Check that the bgio schema migration has been applied and the database is reachable. ` +
            `Error: ${errorMessage}`,
        );
      }

      const result = {};
      if (queryResult.rows.length === 0) {
        return result;
      }
      const row = queryResult.rows[0];
      // why: jsonb columns come back already parsed by node-pg, so no
      // JSON.parse is needed. Each key is set only when the caller requested
      // it, matching boardgame.io's fetch contract (unrequested fields absent).
      if (opts.state === true) {
        result.state = row.state;
      }
      if (opts.metadata === true) {
        result.metadata = row.metadata;
      }
      if (opts.log === true) {
        result.log = row.log !== null ? row.log : [];
      }
      if (opts.initialState === true) {
        result.initialState = row.initial_state;
      }
      return result;
    },

    /**
     * Removes a match row entirely (state, metadata, log).
     *
     * @param {string} matchID - boardgame.io match id.
     * @returns {Promise<void>}
     */
    async wipe(matchID) {
      try {
        await pool.query(`DELETE FROM bgio.matches WHERE match_id = $1`, [matchID]);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(
          `bgioPgStore.wipe failed to delete match "${matchID}" from bgio.matches. ` +
            `Check that the database is reachable. Error: ${errorMessage}`,
        );
      }
    },

    /**
     * Lists match ids, optionally filtered by game name and match-metadata
     * predicates (`isGameover`, `updatedBefore`, `updatedAfter`), reading the
     * predicates from each row's stored metadata — the same fields
     * boardgame.io's InMemory store filters on.
     *
     * @param {{ gameName?: string, where?: { isGameover?: boolean, updatedBefore?: number, updatedAfter?: number } }} [opts]
     *   Optional filter.
     * @returns {Promise<string[]>} The matching match ids.
     */
    async listMatches(opts) {
      let queryResult;
      try {
        queryResult = await pool.query(
          `SELECT match_id, metadata FROM bgio.matches`,
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(
          `bgioPgStore.listMatches failed to read match ids from bgio.matches. ` +
            `Check that the bgio schema migration has been applied and the database is reachable. ` +
            `Error: ${errorMessage}`,
        );
      }

      // why: filtering runs in JS against each row's parsed metadata so the
      // predicate logic matches boardgame.io's InMemory store byte-for-byte
      // (gameName, gameover presence, updatedAt bounds). Match volume is low,
      // so a full scan + JS filter is clearer than pushing jsonb predicates
      // into SQL. No `.reduce()` — an explicit loop per code style.
      const matchIds = [];
      for (const row of queryResult.rows) {
        const metadata = row.metadata !== null ? row.metadata : {};
        if (opts === undefined) {
          matchIds.push(row.match_id);
          continue;
        }
        if (opts.gameName !== undefined && metadata.gameName !== opts.gameName) {
          continue;
        }
        if (opts.where !== undefined) {
          if (opts.where.isGameover !== undefined) {
            const isGameover = metadata.gameover !== undefined;
            if (isGameover !== opts.where.isGameover) {
              continue;
            }
          }
          if (
            opts.where.updatedBefore !== undefined &&
            metadata.updatedAt >= opts.where.updatedBefore
          ) {
            continue;
          }
          if (
            opts.where.updatedAfter !== undefined &&
            metadata.updatedAt <= opts.where.updatedAfter
          ) {
            continue;
          }
        }
        matchIds.push(row.match_id);
      }
      return matchIds;
    },
  };
}
