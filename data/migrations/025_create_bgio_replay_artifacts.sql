-- WP-335 — Live-Match Capture: Durable Replay Artifacts + captured_at Marker
-- Created 2026-07-08 per WP-335 / EC-365 / D-24119 (arc) / D-24122.
--
-- bgio.replay_artifacts durably stores a finished match's replay artifact
-- ({ initial_state, log }) keyed by its canonical replayHash, so the artifact
-- survives the WP-327 reaper deleting the live bgio.matches row. It also carries
-- the replayHash -> match_id mapping (D-24121 named it as the missing link) and
-- the derived scenario_key. The capture harvester (WP-335) writes it; the future
-- verifier (WP-3b) reads it.
--
-- SCHEMA PLACEMENT (D-24122 / D-24095): this table lives in the `bgio` schema,
-- NOT legendary.*, because it holds framework-shaped replay data (initial_state,
-- log). The D-24119/D-24095 carve-out authorizes the server replay pipeline to
-- derive replay data from the bgio blob; keeping the durable copy in the `bgio`
-- schema avoids persisting framework-serialized state into the legendary.* domain
-- schema (which the D-24095 core invariant forbids). It is a derived,
-- server-replay-pipeline-only projection, distinct from the framework's live
-- match store (bgio.matches).
--
-- Idempotent: CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS. Re-running
-- the migration runner against an already-migrated database succeeds without
-- error (mirrors the WP-309 / WP-333 precedent).

CREATE TABLE IF NOT EXISTS bgio.replay_artifacts (
    -- why: replay_hash is the canonical computeStateHash of the reduced final G
    -- (reduceMatchToFinalState, WP-334) — the PK the future verifier looks up by
    -- when a client submits { replayHash }.
    replay_hash    text         PRIMARY KEY,

    -- why: match_id is the replayHash -> matchId mapping D-24121 named as the
    -- missing link; the capture step is the sole owner of both.
    match_id       text         NOT NULL,

    -- why: scenario_key = buildScenarioKey over the set-abbr-stripped selection
    -- ids (D-10014); the leaderboard/PAR key the ownership + submission use.
    scenario_key   text         NOT NULL,

    -- why: the durable copy of the bgio artifact the reducer replays, copied so
    -- it survives the reaper deleting the live bgio.matches row. The future
    -- verifier reduces THIS, never the (reaped) live row.
    initial_state  jsonb        NOT NULL,
    log            jsonb        NOT NULL,

    captured_at    timestamptz  NOT NULL DEFAULT now()
);

-- why: captured_at on the live match store is BOTH the harvester's dedupe marker
-- (it scans WHERE captured_at IS NULL) AND the reaper's guard (a gameover row is
-- reaped only once captured_at is set, so a capture outage past the grace never
-- silently drops a competitive match). Nullable: an un-captured row has NULL.
ALTER TABLE bgio.matches ADD COLUMN IF NOT EXISTS captured_at timestamptz;
