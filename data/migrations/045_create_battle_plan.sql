-- WP-635 / EC-670 / D-24449 — Battle Plan API (server): legendary.battle_plan.
-- Created 2026-09-02 per WP-635 / EC-670.
--
-- why: migration number 045 because 044 (create_match_guest_access) is the
-- previous sequential slot; 045 is the next free slot.
--
-- This migration introduces the BATTLE PLAN table: one shared row per match
-- holding the free-text, football-style "game plan" a team writes during a
-- match, in three lifecycle-tied phases — the pre-battle plan (mastermind /
-- scheme / villains read + why these heroes), the in-game battle adjustments
-- (hero focus / course corrections), and the post-battle analysis (the debrief).
-- It is the server + persistence foundation for the Battle Plan arc; the client
-- BattlePlanPanel.vue and the LAGN battle_plan export block are follow-on WPs.
--
-- why (persistence boundary): battle_plan is an ORDINARY server-layer domain
-- table — exactly like legendary.feedback_item, legendary.coach_reports, or
-- legendary.competitive_scores. It is never runtime G/ctx, never a snapshot,
-- never a save-game, never hashed into the game-state hash, and never a source
-- of competitive/derived gameplay features. It touches none of the D-24095 /
-- D-24119 boardgame.io-blob carve-outs; no persistence carve-out is needed or
-- added. The Battle Plan flows exclusively over REST + Postgres, never through
-- boardgame.io.
--
-- why (one shared row per match): the Battle Plan is a TEAM document, not
-- per-player rows. The UNIQUE match_id constraint is the one-row-per-match rule;
-- each write is a per-column upsert (INSERT ... ON CONFLICT (match_id) DO UPDATE
-- SET <phase-column> = ...), so writing one phase never clears the other two.
--
-- why (match_id text, no FK): match lifecycle is owned by the bgio store, not the
-- legendary.* schema (mirror migration 032_create_match_invites). A plain text
-- column, no foreign key — a match id is a bgio-owned identifier, and the
-- legendary.* schema never references it relationally.
--
-- why (updated_by_ext_id, not account_id): the last editor is identified by their
-- legendary.players.ext_id (D-5201, the cross-service account id). A text column,
-- no FK — the account row's presence is already enforced at write time by the
-- authenticated-session + participant gate. Stored for AUDIT ONLY: it is never
-- projected in the GET response (a future client WP that wants a "last edited by"
-- label adds a public-handle projection, never a raw ext_id).
--
-- Idempotent: CREATE TABLE uses IF NOT EXISTS (the 009/022/033/039/041/042/043
-- precedent). Re-running the runner against an already-seeded database succeeds.

CREATE TABLE IF NOT EXISTS legendary.battle_plan (
  -- why: bigserial surrogate PK — one row per match. The one-shared-row-per-match
  -- rule is the UNIQUE (match_id) constraint below, not this id.
  id                  bigserial   PRIMARY KEY,

  -- why: the boardgame.io match id this plan belongs to. text (not FK) — match
  -- lifecycle is owned by the bgio store, not the legendary.* schema (mirror
  -- migration 032). UNIQUE enforces the one-shared-row-per-match team-document
  -- rule and is the ON CONFLICT target for the per-phase upsert.
  match_id            text        NOT NULL UNIQUE,

  -- why: the pre-battle plan phase — the mastermind / scheme / villains read and
  -- why these heroes. Nullable; empty until a participant writes it.
  pre_battle          text,

  -- why: the in-game battle-adjustments phase — hero focus / course corrections
  -- made while the match is underway. Nullable.
  battle_adjustments  text,

  -- why: the post-battle-analysis phase — the debrief (what worked?). Nullable.
  post_battle         text,

  -- why: the last editor's account (= legendary.players.ext_id, D-5201). A text
  -- column, no FK. Stored for AUDIT ONLY — it is NOT projected in the GET response
  -- (never expose an internal ext_id to co-participants). NOT NULL: every write
  -- records who made it.
  updated_by_ext_id   text        NOT NULL,

  -- why: when the row was first created (the first phase write for the match).
  created_at          timestamptz NOT NULL DEFAULT now(),

  -- why: when any phase was last written. Set to now() on insert and advanced to
  -- now() on every per-phase upsert.
  updated_at          timestamptz NOT NULL DEFAULT now()
);
