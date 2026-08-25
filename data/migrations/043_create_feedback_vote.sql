-- WP-604 / EC-639 / D-24414 — Feedback intake & voting (server): legendary.feedback_vote.
-- Created 2026-08-25 per WP-604 / EC-639.
--
-- why: migration number 043 because 042 (create_feedback_item) is this change's
-- earlier step; 043 is the next free sequential slot and depends on 042 existing (it
-- references legendary.feedback_item).
--
-- This migration introduces the FEEDBACK VOTE table: one row per account per item,
-- the upvotes that rank enhancement requests on the public roadmap. It is the voting
-- side of the custom-built player-feedback + public-roadmap system (D-24414).
--
-- why (persistence boundary): feedback_vote is an ORDINARY server-layer domain table
-- (same class as feedback_item / coach_reports / competitive_scores). It is never
-- runtime G/ctx, never a snapshot, never a save-game, never hashed, and never a
-- source of competitive/derived gameplay features. No persistence carve-out is added.
--
-- why (the DB owns vote_count): there is deliberately NO stored vote_count column on
-- feedback_item. The tally is a COUNT projection over this table at read time — one
-- source of truth for the count, no denormalized counter to keep in sync (D-24414
-- corollary 3).
--
-- Idempotent: CREATE TABLE uses IF NOT EXISTS (the 009/022/033/039/041 precedent).
-- Re-running the runner against an already-seeded database succeeds.

CREATE TABLE IF NOT EXISTS legendary.feedback_vote (
  -- why: bigserial surrogate PK — one row per cast vote. The one-vote-per-account
  -- rule is the UNIQUE constraint below, not this id.
  id                bigserial   PRIMARY KEY,

  -- why: the item this vote is for. FK to legendary.feedback_item with ON DELETE
  -- CASCADE so removing an item removes its votes (no orphaned tallies).
  feedback_item_id  bigint      NOT NULL
                    REFERENCES legendary.feedback_item (id) ON DELETE CASCADE,

  -- why: the voting account (= legendary.players.ext_id, D-5201). Named
  -- account_ext_id (the voter role), intentionally distinct from
  -- feedback_item.author_ext_id (the submitter role) — same value space, different
  -- meaning; do NOT unify the names.
  account_ext_id    text        NOT NULL,

  -- why: when the vote was cast; retained for audit/order, not branched on.
  created_at        timestamptz NOT NULL DEFAULT now(),

  -- why: UNIQUE (feedback_item_id, account_ext_id) IS the one-vote-per-account rule —
  -- the DATABASE owns the tally (D-24414). A second upvote by the same account for
  -- the same item is rejected by this constraint (the addVote insert uses
  -- ON CONFLICT DO NOTHING against it), so vote_count can never double-count and the
  -- application needs no read-modify-write.
  UNIQUE (feedback_item_id, account_ext_id)
);
