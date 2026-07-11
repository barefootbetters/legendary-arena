-- WP-355 / EC-385 — Block list: legendary.player_blocks
-- Created 2026-07-11 per WP-355 / EC-385 (D-24147).
--
-- Packet #6 (abuse controls) of the Friends & Ranked Trust subsystem.
-- Blocking is a SEPARATE model from friendship (WP-350 / D-24142: the
-- legendary.friendships table never gains a 'blocked' status — a block
-- can exist with no prior request, so it gets its own table). One
-- directed block row per (blocker, blocked) pair; the send guard treats
-- a block as symmetric (a blocked pair cannot friend either way).
--
--   * legendary.player_blocks — block_id (bigserial PK); blocker_id /
--     blocked_id FK the bigint player_id on legendary.players (the
--     profile-family convention, migrations 009/028), ON DELETE CASCADE
--     so a deleted account's block rows are removed automatically.
--
-- Idempotent: CREATE ... IF NOT EXISTS, mirroring the migration 028
-- precedent. Re-running against an already-seeded database succeeds.
--
-- Authority: WP-355 §Scope (In) §A; EC-385 §Locked Values; D-24147;
-- D-24142 (blocking is orthogonal to friendship — a separate model).

CREATE TABLE IF NOT EXISTS legendary.player_blocks (
  -- why: bigserial surrogate PK. Pair identity is enforced by the
  -- (blocker_id, blocked_id) unique constraint below; block_id is
  -- server-internal and never appears on the wire.
  block_id     bigserial   PRIMARY KEY,

  -- why: blocker_id / blocked_id FK the bigint player_id on
  -- legendary.players (NOT the ext_id text column), the profile-family
  -- convention. ON DELETE CASCADE so a deleted account's block rows go
  -- with it. The row is DIRECTED (blocker blocked blocked); the send
  -- guard checks BOTH directions so enforcement is symmetric.
  blocker_id   bigint      NOT NULL REFERENCES legendary.players(player_id) ON DELETE CASCADE,
  blocked_id   bigint      NOT NULL REFERENCES legendary.players(player_id) ON DELETE CASCADE,

  created_at   timestamptz NOT NULL DEFAULT now(),

  -- why: a player can never block themselves. Enforced at the DB so a
  -- logic-layer bypass still cannot write a self-row; the logic layer
  -- maps a self-block to the typed 'self_block' code before any SQL.
  CONSTRAINT player_blocks_no_self CHECK (blocker_id <> blocked_id),

  -- why: at most one block row per directed pair. A duplicate block
  -- (blocker already blocked blocked) maps to the typed 'already_blocked'
  -- code, never a second row.
  CONSTRAINT player_blocks_pair_unique UNIQUE (blocker_id, blocked_id)
);

-- why: the "who has this player blocked?" list read (listBlocks) and the
-- send guard's blocker-side lookup both filter by blocker_id first; the
-- index serves that WHERE. The unique (blocker_id, blocked_id) index also
-- covers blocker-prefix lookups, but a dedicated single-column index is
-- the cheaper plan for the common WHERE blocker_id = $1 shape and mirrors
-- the migration-028 lookup-index posture.
CREATE INDEX IF NOT EXISTS idx_player_blocks_blocker
  ON legendary.player_blocks (blocker_id);
