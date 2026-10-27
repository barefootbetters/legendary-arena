-- WP-811 / EC-848 / D-24719 — keep a finished match's LAGN readable after the
-- reaper deletes its live bgio.matches row.
-- Created 2026-10-14 per WP-811 / EC-848.
--
-- why: migration number 046 because 045 (create_battle_plan) is the previous
-- sequential slot; 046 is the next free slot.
--
-- why (the bug): GET /api/match/:matchId/lagn and /result-lagn read only the
-- live bgio.matches row, and the WP-327 reaper deletes a finished match's row
-- about an hour after gameover (once captured_at is set). The durable
-- bgio.replay_artifacts copy (migration 025) survives, but it had no copy of
-- the endgame verdict, so the result LAGN could not be rebuilt from it.
--
-- why (gameover column): the capture step copies the live row's
-- metadata.gameover here (the same value /result-lagn reads from the live row,
-- D-24169 / D-24719). Nullable: artifacts captured before this migration carry
-- NULL until the capture harvester's verdict sweep fills them (D-24719 §3).
-- The column is an app-owned derived value in the bgio schema, like
-- captured_at and match_id — never round-tripped into gameplay state.
ALTER TABLE bgio.replay_artifacts ADD COLUMN IF NOT EXISTS gameover jsonb;

-- why (match_id index): the reaped-row fallback and readReplayHashByMatchId
-- both look an artifact up by match_id on a guest-readable endpoint; without
-- an index each lookup scans the whole artifact table.
CREATE INDEX IF NOT EXISTS replay_artifacts_match_id_idx
  ON bgio.replay_artifacts (match_id);

-- why (partial index): the harvester's verdict sweep selects
-- `WHERE gameover IS NULL` every scan; once the legacy rows are filled the
-- partial index is empty, so the steady-state sweep costs nothing.
CREATE INDEX IF NOT EXISTS replay_artifacts_gameover_missing_idx
  ON bgio.replay_artifacts (replay_hash)
  WHERE gameover IS NULL;
