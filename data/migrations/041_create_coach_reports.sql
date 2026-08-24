-- WP-594 / EC-629 / D-24403 — Endgame AI Coach (server): legendary.coach_reports cache.
-- Created 2026-08-23 per WP-594 / EC-629.
--
-- why: migration number 041 because 040 (add_legendary_pass_entitlement) is this
-- change's earlier step; 041 is the next free sequential slot.
--
-- This migration introduces the endgame AI-coach REPORT CACHE: one row per scored
-- match (keyed by replay_hash) holding the Claude-generated coaching report as
-- jsonb. It exists so the paid LLM call runs at most ONCE per match — a second
-- view of the same match's coaching reads this cache, never re-calls the model.
--
-- why (persistence boundary): the coach report is a DERIVED, read-only ADVISORY
-- artifact — it is never runtime G/ctx, never a snapshot, never a save-game, never
-- hashed into the game-state hash, and never a source of competitive/derived
-- gameplay features. It is ordinary server-layer domain storage analogous to a
-- memoized projection; it never affects score or gameplay. No persistence
-- carve-out is needed or added.
--
-- why (keyed by replay_hash, not match_id): the score submission and the coach
-- request both key on replay_hash (the caller cannot compute it, but the server
-- resolves it), and one replay_hash is exactly one scored match. The account_id
-- (= legendary.players.ext_id) is stored for forensics + per-account cleanup, but
-- the report is a property of the match, so replay_hash is the PK.
--
-- Idempotent: CREATE TABLE / CREATE INDEX use IF NOT EXISTS (the 009/022/033/039
-- precedent). Re-running the runner against an already-seeded database succeeds.

CREATE TABLE IF NOT EXISTS legendary.coach_reports (
  -- why: replay_hash is the PK — one coaching report per scored match, ever. A
  -- second request for the same match reads this row (cache hit) rather than
  -- re-calling the paid model.
  replay_hash   text        PRIMARY KEY,

  -- why: the account the report was generated for (= legendary.players.ext_id,
  -- D-5201). Stored for forensics + per-account cleanup on account deletion; the
  -- report itself is a property of the match, not the account. Nullable-safe: a
  -- text column, no FK (replay_hash is the identity; the owning player is already
  -- enforced at request time by the ownership check).
  account_id    text        NOT NULL,

  -- why: which model produced this report (e.g. 'claude-sonnet-5'), pinned so a
  -- later model change does not silently mix report styles in the cache and so a
  -- forced regeneration under a new model is auditable.
  model         text        NOT NULL,

  -- why: the coaching report as jsonb (headline / hero-fit / purchases / tips) —
  -- rendered verbatim by the client, never re-parsed for gameplay. jsonb for full
  -- audit transparency, mirroring competitive_scores.score_breakdown.
  report        jsonb       NOT NULL,

  -- why: when the report was generated; the read orders/audits by it.
  generated_at  timestamptz NOT NULL DEFAULT now()
);

-- why: per-account cleanup + forensics filter by account_id, so a dedicated index
-- makes WHERE account_id = $1 cheap (the player_gauntlet_runs precedent).
CREATE INDEX IF NOT EXISTS coach_reports_account_idx
  ON legendary.coach_reports (account_id);
