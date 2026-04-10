-- 003_game_sessions.sql
-- Tracks match metadata for audit, debugging, and reconnection.
-- This table stores match lifecycle state only — not boardgame.io's G or ctx.
-- Per 00.2 §8.2: live game state (G, ctx) is managed by boardgame.io in memory.
--
-- Objects created (all in public schema):
--   Table:    game_sessions
--   Function: set_updated_at() (trigger function for updated_at)
--   Trigger:  game_sessions_set_updated_at (BEFORE UPDATE)
--   Index:    game_sessions_status_idx
--
-- Precondition: none for schema objects. This migration creates only public
-- schema objects and does not depend on the legendary.* schema from 001.
--
-- Idempotent: CREATE TABLE and CREATE INDEX use IF NOT EXISTS. The trigger
-- uses DROP IF EXISTS + CREATE (PostgreSQL has no CREATE TRIGGER IF NOT
-- EXISTS). The function uses CREATE OR REPLACE.
--
-- Transaction handling: this file contains PL/pgSQL with a bare "begin"
-- (no semicolon) inside the function body. The migration runner's
-- BEGIN/COMMIT stripping only matches "begin;" (with semicolon), so the
-- PL/pgSQL block opener is not affected.

create table if not exists game_sessions (
  -- why: game_sessions is in the public schema (not legendary.*) because it is
  -- infrastructure for match tracking, not card domain data.
  game_session_id  bigserial primary key,
  match_id         text unique not null,
  -- why: match_id is boardgame.io's alphanumeric match identifier (not a UUID).
  -- It is the join key used by all boardgame.io client calls.
  -- The UNIQUE constraint creates an implicit btree index, so no separate
  -- index is needed for match_id lookups.
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  status           text not null default 'waiting'
                     check (status in ('waiting', 'active', 'complete')),
  player_count     int not null check (player_count between 1 and 5),
  mastermind_ext_id text not null,
  -- why: mastermind_ext_id references legendary.cards.ext_id (stable across
  -- re-seeds). Using ext_id (text) rather than a bigint FK keeps game_sessions
  -- independent of the card schema seeding order. Per 00.2 §4.4: use ext_id
  -- for cross-service card references.
  scheme_ext_id    text not null
  -- why: scheme_ext_id references legendary.cards.ext_id for the chosen scheme.
);

-- why: updated_at default now() only fires on INSERT. Without a trigger,
-- updated_at would silently equal created_at forever, making the column
-- misleading for audit and debugging. This trigger ensures updated_at
-- reflects the actual last-modified time on every UPDATE.
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- why: DROP IF EXISTS + CREATE ensures idempotency. CREATE TRIGGER has no
-- IF NOT EXISTS variant in PostgreSQL, so the drop-then-create pattern is
-- the standard approach for repeatable migrations.
drop trigger if exists game_sessions_set_updated_at on game_sessions;
create trigger game_sessions_set_updated_at
  before update on game_sessions
  for each row
  execute function set_updated_at();

create index if not exists game_sessions_status_idx
  on game_sessions (status);
-- why: status-filtered queries ('active' sessions for monitoring dashboards,
-- 'waiting' sessions for lobby display) will be common at runtime.
