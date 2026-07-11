-- WP-354 / EC-384 — Ranked eligibility flag on legendary.competitive_scores
-- Created 2026-07-11 per WP-354 / EC-384 (D-24146).
--
-- Packet #5 (ranked-gate half) of the Friends & Ranked Trust subsystem.
-- Adds a per-submission flag recording whether a competitive run's
-- authenticated human roster formed a mutual-friend clique at submission
-- time (WP-350's areAllMutualFriends over WP-333's readSeatAccounts).
-- The public ranked leaderboard filters to is_ranked_eligible = true; an
-- ineligible multiplayer run is still recorded and visible (Casual) on
-- the owner's own My-Scores read.
--
-- why: DEFAULT true so every pre-gate row and every solo / single-account
-- run stays ranked (solo is vacuously a clique — n <= 1). The flag is
-- evaluated exactly once at submission and never re-written (FR-7): a
-- later unfriend/block does not retroactively alter a completed run.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS. Re-running against an already-
-- migrated database succeeds without error. Mirrors the migration 026 /
-- 027 additive-column precedent on this table.
--
-- Authority: WP-354 §Scope (In) §A; EC-384 §Locked Values; D-24146.

ALTER TABLE legendary.competitive_scores
  ADD COLUMN IF NOT EXISTS is_ranked_eligible boolean NOT NULL DEFAULT true;
