-- WP-333 — Seat → Account Identity Persistence (Match Join) Table
-- Created 2026-07-08 per WP-333 / EC-363 / D-24119 (faithful-replay arc) /
-- D-24120.
--
-- Records the server-verified AccountId behind each authenticated seat that
-- joins a multiplayer match via POST /api/match/join. One row per
-- (match_id, player_id) pair. This is WP-1 of the D-24119 arc: the durable
-- seat→account mapping the later capture step reads to call
-- assignReplayOwnership per authenticated seat.
--
-- PRIVACY (D-24120): this mapping is stored server-side ONLY. It is NOT written
-- to boardgame.io's player.data / setupData, which the framework returns to
-- clients (createClientMatchData strips only credentials) — stamping the
-- accountId there would leak account identity to opponents. This is consistent
-- with the project already withholding accountId from clients (WP-102
-- PublicProfileView).
--
-- Idempotent: CREATE TABLE uses IF NOT EXISTS. Re-running the migration runner
-- against an already-seeded database succeeds without error (mirrors
-- WP-052 / WP-053 / WP-103 precedent).

-- why: legendary.* namespace per docs/ai/REFERENCE/00.2-data-requirements.md §1.
-- Sits under the same PostgreSQL schema as legendary.players (WP-052) so the
-- capture step's ext_id join stays in one search_path.

CREATE TABLE IF NOT EXISTS legendary.match_seat_accounts (
    -- why: match_id + player_id are boardgame.io identifiers (player_id is a
    -- text seat id such as "0"), NOT legendary.* keys — this table maps the
    -- framework's match/seat coordinates to a legendary account. The composite
    -- PRIMARY KEY enforces exactly one recorded account per seat.
    match_id    text         NOT NULL,
    player_id   text         NOT NULL,

    -- why: account_id stores the AccountId (= legendary.players.ext_id) directly.
    -- The downstream assignReplayOwnership resolves ownership by ext_id, so no
    -- internal player_id bridging is stored here. The FK to the UNIQUE ext_id
    -- column enforces that the recorded account exists (the session already
    -- validated it at join time).
    account_id  text         NOT NULL REFERENCES legendary.players(ext_id),

    -- why: joined_at is when the seat's identity was recorded; it is re-stamped
    -- on an idempotent re-join (ON CONFLICT DO UPDATE in the application layer).
    joined_at   timestamptz  NOT NULL DEFAULT now(),

    PRIMARY KEY (match_id, player_id)
);
