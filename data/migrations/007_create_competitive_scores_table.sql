-- WP-053 — Competitive Score Submission & Verification Table
-- Created 2026-04-26 per WP-053 v1.5 / EC-053 / D-5301 / D-5302 /
-- D-5304 / D-5305 / D-5306 (Option A).
--
-- This table stores the immutable record of every accepted competitive
-- submission. Replay content is not stored here — only the cryptographic
-- state hash from re-execution, the owning account's internal player_id
-- FK, and the engine-derived scoring outputs (raw, final, full
-- breakdown). One row per (player_id, replay_hash) pair; idempotent
-- retries reuse the existing row via the locked
-- ON CONFLICT … DO UPDATE SET player_id = legendary.competitive_scores.player_id
-- no-op self-assignment + RETURNING (xmax = 0) AS was_inserted pattern
-- in the application layer.
--
-- Idempotent: CREATE TABLE uses IF NOT EXISTS. Re-running the migration
-- runner against an already-seeded database succeeds without error
-- (mirrors WP-052 / WP-103 / FP-01 precedent).

-- why: legendary.* namespace per docs/ai/REFERENCE/00.2-data-requirements.md §1.
-- This server-layer persistence sits under the same PostgreSQL schema
-- as legendary.players (WP-052), legendary.replay_ownership (WP-052),
-- and legendary.replay_blobs (WP-103) so future cross-table queries
-- (WP-054 leaderboards, profile pages) stay in one search_path.

CREATE TABLE IF NOT EXISTS legendary.competitive_scores (
    submission_id          bigserial    PRIMARY KEY,

    -- why: player_id is the internal bigint FK to legendary.players(player_id);
    -- mirrors the WP-052 legendary.replay_ownership pattern. Application
    -- code uses accountId (text ext_id) as the canonical owner reference
    -- per D-5201; the CTE at every write site bridges the
    -- ext_id ↔ player_id mapping. Keeping the FK on the internal bigint
    -- avoids string-keyed cross-service joins at the storage layer.
    player_id              bigint       NOT NULL REFERENCES legendary.players(player_id),

    -- why: replay_hash is the cryptographic state hash from WP-027's
    -- computeStateHash, the same value used as the natural key in
    -- legendary.replay_blobs. Pairs with player_id under the
    -- UNIQUE (player_id, replay_hash) constraint below to enforce
    -- per-account idempotent submission. No FK to legendary.replay_blobs
    -- or legendary.replay_ownership (the latter two have no FK
    -- between them either; WP-053 follows the same convention so
    -- the application layer remains the sole sequencing authority).
    replay_hash            text         NOT NULL,

    scenario_key           text         NOT NULL,

    -- why: integer raw_score and final_score per WP-053 §C and the
    -- engine's centesimal-arithmetic contract (parScoring.types.ts:46).
    -- The engine never produces fractional weights; display layers
    -- divide by 100 to render decimal point values.
    raw_score              integer      NOT NULL,
    final_score            integer      NOT NULL,

    -- why: score_breakdown stored as jsonb (not bytea, text, or json)
    -- for full audit transparency and shape queryability. pg's jsonb
    -- codec deserializes column values to JS objects on read; no
    -- manual JSON deserialization is performed at any read site.
    score_breakdown        jsonb        NOT NULL,

    -- why: par_version + scoring_config_version pin the scoring
    -- context at submission time. Future re-scoring under a new
    -- config would create a NEW record (with a different
    -- scoring_config_version); this row is immutable per D-5302.
    -- scoring_config_version is integer per WP-048's
    -- ScenarioScoringConfig.scoringConfigVersion: number contract.
    par_version            text         NOT NULL,
    scoring_config_version integer      NOT NULL,

    -- why: state_hash equals the submitted replay_hash for every
    -- accepted record (the application's step-9 verification asserts
    -- equality before INSERT). Stored explicitly so future audits can
    -- confirm the value at insert time without re-executing the
    -- replay. The two columns exist for redundant audit provenance,
    -- not because they may differ — they cannot, by construction.
    state_hash             text         NOT NULL,

    -- why: created_at is server-clock metadata local to the row, not
    -- a determinism-bearing field consumed by the engine. The engine
    -- never reads this column; it exists for operator-facing
    -- observability and future audit / leaderboard ordering use
    -- cases. now() at the SQL layer is the only wall-clock read in
    -- this packet.
    created_at             timestamptz  NOT NULL DEFAULT now(),

    -- why: idempotent submission anchor per D-5304. Application logic
    -- relies on this UNIQUE constraint for the
    -- ON CONFLICT (player_id, replay_hash) DO UPDATE SET player_id =
    -- legendary.competitive_scores.player_id RETURNING (xmax = 0)
    -- AS was_inserted pattern that distinguishes fresh inserts from
    -- race-lost retries. The DO UPDATE no-op self-assignment forces
    -- RETURNING to emit the conflicting row's columns; DO NOTHING
    -- would emit zero rows and the caller could not distinguish
    -- "first insert" from "race-lost idempotent retry" without a
    -- second SELECT.
    UNIQUE (player_id, replay_hash)
);

-- why: this table is write-once per D-5302. Competitive records are
-- immutable once accepted — no UPDATE path exists in the application
-- layer (no updateCompetitive* function; verified by grep gate at
-- post-mortem time). The locked ON CONFLICT ... DO UPDATE SET
-- player_id = legendary.competitive_scores.player_id self-assignment
-- in submitCompetitiveScore is the ONLY UPDATE acceptable against
-- this table; it is a no-op that exists solely to force RETURNING to
-- emit columns on the conflict path.
