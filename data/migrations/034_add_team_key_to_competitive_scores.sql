-- WP-384 — Fixed-Hero-Pool Gauntlet Division: team_key column on competitive scores
-- Created 2026-07-16 per WP-384 / EC-413 / D-24187.
--
-- Adds a nullable `team_key` column to legendary.competitive_scores recording
-- the hero team the scored match was played with: the match's set-qualified
-- hero ids (the D-10014 `setAbbr/slug` space, exactly as configured — never
-- re-slugified) sorted ASC and joined with `+`. Derived at submission time
-- from the verifier's reduced final game state (`matchConfiguration.heroDeckIds`)
-- — never client-supplied. The D-24187 fixed-hero-pool gauntlet division
-- qualifies entries on these values; a row qualifies only via a non-NULL key.
--
-- why: nullable — rows inserted before this migration carry NULL, and a NULL
-- team_key never qualifies on any fixed-division board per D-24187 §1. Unlike
-- migrations 026/027, a one-time operator backfill exists
-- (scripts/backfill-team-key.mjs) that fills NULLs from the stored replay
-- artifacts under the D-24187 §2 carve-out; rows whose artifact is gone stay
-- NULL and stay open-division-only.
--
-- why: no CHECK constraint — the value is free-form text derived and written
-- exclusively by the server (submission step 14d + the backfill); its format
-- is enforced at the single derivation site, not by the schema.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS. Re-running the migration runner
-- against an already-migrated database succeeds without error (mirrors the
-- 026/027 precedent).

ALTER TABLE legendary.competitive_scores
    ADD COLUMN IF NOT EXISTS team_key text;
