-- WP-344 — Player-Count Gauntlet Boards: player_count column on competitive scores
-- Created 2026-07-09 per WP-344 / EC-376 / D-24134.
--
-- Adds a nullable `player_count` column to legendary.competitive_scores
-- recording how many seats the scored match was played with (1-5), derived
-- at submission time from the verifier's reduced final game state (the
-- per-player zone record's key count) — never client-supplied. The D-24134
-- gauntlet boards are keyed per player count; a row qualifies only on the
-- board matching its recorded count.
--
-- why: nullable — rows inserted before this migration (and any defensive
-- out-of-range derivation) carry NULL, and a NULL player_count never
-- qualifies on any count-keyed board per D-24134 §1. No backfill is
-- performed: pre-existing rows predate the player-count contract and are
-- simply non-qualifying (the migration-026 outcome pattern).
--
-- Idempotent: ADD COLUMN IF NOT EXISTS. Re-running the migration runner
-- against an already-migrated database succeeds without error (mirrors the
-- 026 precedent).

ALTER TABLE legendary.competitive_scores
    ADD COLUMN IF NOT EXISTS player_count smallint
    CHECK (player_count BETWEEN 1 AND 5);
