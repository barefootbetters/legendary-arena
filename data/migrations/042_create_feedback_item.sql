-- WP-604 / EC-639 / D-24414 — Feedback intake & voting (server): legendary.feedback_item.
-- Created 2026-08-25 per WP-604 / EC-639.
--
-- why: migration number 042 because 041 (create_coach_reports) is the previous
-- sequential slot; 042 is the next free slot, 043 (the votes table) follows it.
--
-- This migration introduces the FEEDBACK ITEM table: one row per submitted player
-- feedback — a bug report, an enhancement request, or a review. It is the intake
-- side of the custom-built player-feedback + public-roadmap system (D-24414: build
-- custom on the existing Postgres + Hanko + Dashboard stack, not a SaaS board and
-- not self-hosted Fider). The companion 043 migration adds the one-vote-per-account
-- votes table that references this one.
--
-- why (persistence boundary): feedback_item is an ORDINARY server-layer domain
-- table — exactly like legendary.coach_reports or legendary.competitive_scores. It
-- is never runtime G/ctx, never a snapshot, never a save-game, never hashed into
-- the game-state hash, and never a source of competitive/derived gameplay features.
-- No persistence carve-out is needed or added.
--
-- why (status default 'under_review'): every freshly submitted item starts in the
-- raw-intake status. THIS system never advances status — the Under review → Planned
-- → In progress → Shipped → Declined editorial workflow is authored only on the
-- operator dashboard (a follow-on WP, per D-24414 corollary 4). There is deliberately
-- no code path in apps/server/src/feedback that UPDATEs status.
--
-- why (author_ext_id, not account_id): the submitter is identified by their
-- legendary.players.ext_id (D-5201, the cross-service account id). The column is
-- named author_ext_id — distinct from feedback_vote.account_ext_id in 043 — because
-- the submitter and a voter are different roles even though both hold an ext_id.
--
-- why (resolution_reason nullable): reserved for the future dashboard-triage WP,
-- which requires a reason when an item is Declined. This packet never writes it; it
-- exists now so 042 does not need re-migrating when triage lands.
--
-- Idempotent: CREATE TABLE / CREATE INDEX use IF NOT EXISTS (the 009/022/033/039/041
-- precedent). Re-running the runner against an already-seeded database succeeds.

CREATE TABLE IF NOT EXISTS legendary.feedback_item (
  -- why: bigserial surrogate PK — one row per submitted feedback item. The votes
  -- table (043) references this id with ON DELETE CASCADE.
  id                bigserial   PRIMARY KEY,

  -- why: the kind of feedback. Closed set enforced by a CHECK so a malformed
  -- feedback_type never lands (the application also validates before insert). Only
  -- 'enhancement' rows surface on the public GET; 'bug'/'review' are stored but have
  -- no public read surface in this packet.
  feedback_type     text        NOT NULL
                    CHECK (feedback_type IN ('bug', 'enhancement', 'review')),

  -- why: the short one-line summary the submitter typed. Non-empty (the application
  -- rejects blank titles before insert).
  title             text        NOT NULL,

  -- why: the free-text body of the feedback. Non-empty (validated before insert).
  description       text        NOT NULL,

  -- why: the submitting account (= legendary.players.ext_id, D-5201). A text column,
  -- no FK — the account row's presence is already enforced at submit time by the
  -- authenticated-session gate; the ext_id is retained for forensics + per-account
  -- cleanup. Named author_ext_id (the submitter role), distinct from a voter.
  author_ext_id     text        NOT NULL,

  -- why: the editorial status. DEFAULT 'under_review' is the ONLY status this packet
  -- ever writes; the dashboard-triage follow-on WP owns every transition to the other
  -- values. The CHECK pins the closed set so no unknown status can be stored.
  status            text        NOT NULL DEFAULT 'under_review'
                    CHECK (status IN ('under_review', 'planned', 'in_progress', 'shipped', 'declined')),

  -- why: the reason an item was Declined (required only when status = 'declined',
  -- enforced by the future dashboard WP, not here). Nullable; never written by this
  -- packet.
  resolution_reason text,

  -- why: when the item was submitted; the public list orders by it (vote_count first,
  -- then created_at).
  created_at        timestamptz NOT NULL DEFAULT now(),

  -- why: when the item last changed. Set to now() on insert; advanced by the future
  -- triage WP on a status edit. This packet never advances it after insert.
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- why: the public list filters WHERE feedback_type = 'enhancement' AND status = ANY(...),
-- so a composite index on (feedback_type, status) makes that read cheap (the
-- coach_reports_account_idx / player_gauntlet_runs precedent).
CREATE INDEX IF NOT EXISTS feedback_item_type_status_idx
  ON legendary.feedback_item (feedback_type, status);
