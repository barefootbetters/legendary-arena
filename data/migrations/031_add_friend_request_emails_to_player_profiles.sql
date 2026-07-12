-- WP-357 / EC-387 — Friend-request email opt-out preference
-- Created 2026-07-11 per WP-357 / EC-387 / D-24149.
--
-- Adds a per-account preference governing the WP-353 friend-request emails
-- (received + accepted). Lives on legendary.player_profiles alongside the
-- existing per-account preference columns (avatar_visibility /
-- about_me_visibility / links_visibility, migration 009) — no new table.
--
-- Default TRUE so every existing account keeps receiving friend emails; a
-- never-edited account (no player_profiles row) resolves to TRUE via the
-- application-layer COALESCE(pp.friend_request_emails, true) in
-- friendshipNotifications.logic.ts. The WP-353 send boundary reads the
-- RECIPIENT's value and, when FALSE, degrades to a clean no-op.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS. Re-running the migration runner
-- against an already-seeded database succeeds without error.

ALTER TABLE legendary.player_profiles
  -- why: default TRUE = opt-out is off by default (transactional friend
  -- emails keep flowing) per D-24149; a player opts out via
  -- PATCH /api/me/profile { friendRequestEmails: false }. NOT NULL so the
  -- column is always concrete once a player_profiles row exists; the
  -- absent-row case defaults to TRUE at the application layer.
  ADD COLUMN IF NOT EXISTS friend_request_emails boolean NOT NULL DEFAULT true;
