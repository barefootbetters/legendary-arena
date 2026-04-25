-- WP-052 — Replay Ownership Table (legendary.replay_ownership)
-- Created 2026-04-25 per WP-052 v1.3 / EC-052 / D-5203.
--
-- This table stores ownership metadata for replays. Replay content is
-- not stored here — only the cryptographic hash from WP-027's
-- computeStateHash, the owning account's internal player_id FK, and
-- visibility/retention bookkeeping.
--
-- Idempotent: CREATE TABLE uses IF NOT EXISTS. Re-running the migration
-- runner against an already-seeded database succeeds without error.

CREATE TABLE IF NOT EXISTS legendary.replay_ownership (
    ownership_id  bigserial    PRIMARY KEY,

    -- why: player_id is the internal bigint FK to
    -- legendary.players(player_id). The TypeScript application layer
    -- uses accountId: AccountId (mapped to legendary.players.ext_id)
    -- and never exposes the bigint FK — the join from accountId to
    -- player_id happens inside the SQL of each query.
    player_id     bigint       NOT NULL REFERENCES legendary.players(player_id),

    -- why: replay_hash is the cryptographic hash from WP-027's
    -- computeStateHash; ownership references the hash, never the
    -- replay blob.
    replay_hash   text         NOT NULL,

    scenario_key  text         NOT NULL,

    -- why: visibility defaults to 'private' per
    -- 13-REPLAYS-REFERENCE.md §Privacy and Consent Controls — public
    -- sharing requires explicit opt-in.
    visibility    text         NOT NULL DEFAULT 'private',

    created_at    timestamptz  NOT NULL DEFAULT now(),

    -- why: expires_at is NULL for indefinite retention (Supporter
    -- tier); a non-null timestamp means the server may purge after
    -- this date. Read-time enforcement in listAccountReplays excludes
    -- expired rows even before background purge runs.
    expires_at    timestamptz,

    -- why: idempotent ownership assignment; assignReplayOwnership
    -- relies on this constraint for the ON CONFLICT … DO UPDATE …
    -- RETURNING pattern (PS-6 lock).
    UNIQUE (player_id, replay_hash)
);
