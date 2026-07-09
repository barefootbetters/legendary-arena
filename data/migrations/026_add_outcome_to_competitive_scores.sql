-- WP-342 — Mastermind Set-Gauntlet Boards: outcome column on competitive scores
-- Created 2026-07-09 per WP-342 / EC-372 / D-24131.
--
-- Adds a nullable `outcome` column to legendary.competitive_scores recording
-- which side won the match ('heroes-win' | 'scheme-wins'), derived at
-- submission time from the verifier's reduced final game state via the
-- engine's pure endgame evaluation. The D-24131 gauntlet boards qualify legs
-- on outcome = 'heroes-win' ("defeat the mastermind"), which is not derivable
-- from the score columns alone.
--
-- why: nullable — rows inserted before this migration (and any defensive
-- null-evaluation path) carry NULL, and a NULL outcome never qualifies as a
-- gauntlet leg per D-24131 §3. No backfill is performed: pre-existing rows
-- predate the outcome contract and are simply non-qualifying.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS. Re-running the migration runner
-- against an already-migrated database succeeds without error (mirrors the
-- WP-333 / WP-335 precedent).

ALTER TABLE legendary.competitive_scores
    ADD COLUMN IF NOT EXISTS outcome text
    CHECK (outcome IN ('heroes-win', 'scheme-wins'));
