-- WP-309 / EC-339 — Durable boardgame.io Match Storage: bgio.matches
-- Created 2026-07-05 per WP-309 / EC-339.
--
-- why: this schema is boardgame.io's OPERATIONAL match store, deliberately
-- placed OUTSIDE the application's `legendary` domain namespace per the WP-309
-- architecture reconciliation (DECISIONS.md D-24095). boardgame.io internally serializes a
-- match's `G`/`ctx` into an opaque blob; persisting that blob so an
-- in-progress match survives a server deploy/restart is a framework durability
-- concern, categorically distinct from application code persisting `G` into
-- the domain schema. Keeping the store in a dedicated `bgio` schema physically
-- separates framework operational state from application domain data, and no
-- application code (routes, engine, snapshot builders) ever reads these rows.
--
-- The single `bgio.matches` table holds one row per match, addressed by
-- boardgame.io's own `match_id` (a text id, NOT a bigserial — the framework
-- mints and owns it). The `state` / `initial_state` / `metadata` / `log`
-- columns store boardgame.io's opaque jsonb payloads; the adapter
-- (`apps/server/src/db/bgioPgStore.js`) is their only reader/writer.
--
-- Idempotent: CREATE SCHEMA / CREATE TABLE use IF NOT EXISTS, so re-running
-- the migration runner against an already-migrated database succeeds without
-- error (mirrors the migration-009 / migration-022 precedent).
--
-- Authority: WP-309 §Scope (In) §B; EC-339 §Locked Values (schema `bgio`,
-- table `bgio.matches`, PK `match_id text`); D-24095 (framework-store
-- exemption + dedicated `bgio` schema + Option A over Option B).

CREATE SCHEMA IF NOT EXISTS bgio;

CREATE TABLE IF NOT EXISTS bgio.matches (
  -- why: boardgame.io mints and owns the match id (a text key), so the PK is
  -- `match_id text` — not a surrogate bigserial. The adapter keys every read
  -- and write on this id.
  match_id      text PRIMARY KEY,

  -- why: the live match state — boardgame.io's opaque serialization of the
  -- running match (its `G`/`ctx`). NOT NULL because every write path that
  -- inserts a row (createMatch, setState) always carries a state; setMetadata
  -- is UPDATE-only and never inserts a stateless row.
  state         jsonb NOT NULL,

  -- why: the immutable initial state, stowed separately at createMatch time so
  -- boardgame.io can retrieve it for replay/reset without walking the log.
  -- Nullable: only createMatch sets it; a setState upsert-insert (row absent)
  -- legitimately leaves it null.
  initial_state jsonb,

  -- why: match metadata (players, gameName, gameover, updatedAt, credentials).
  -- Nullable for the same reason as initial_state — a setState upsert-insert
  -- populates state before any metadata write.
  metadata      jsonb,

  -- why: the append-only match log. Defaults to an empty jsonb array so the
  -- adapter's `log || deltalog` concatenation is never applied to NULL.
  log           jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- why: last-write timestamp, advanced on every createMatch/setState/
  -- setMetadata. boardgame.io's listMatches filters on its own metadata
  -- `updatedAt`; this column is an operational audit aid, not that predicate.
  updated_at    timestamptz NOT NULL DEFAULT now()
);
