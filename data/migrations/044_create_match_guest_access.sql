-- WP-630 / EC-665 / D-24441 — Per-match guest password + game name (server):
-- legendary.match_guest_access.
-- Created 2026-08-31 per WP-630 / EC-665.
--
-- why: migration number 044 because 043 (create_feedback_vote) is the previous
-- sequential slot on disk; 044 is the next free slot.
--
-- This migration introduces the GUEST-ACCESS side table: at most one row per
-- match, holding an optional host-chosen game NAME and an optional guest-join
-- PASSWORD (stored only as a scrypt derived key, never plaintext). It is the
-- server-side backing for the per-match guest password model (D-24441): a host
-- sets a name + password on a match they own; a walk-up guest (a grandchild on
-- a tablet, no email) types the password to take an anonymous Casual seat —
-- the friendlier alternative to the WP-628 credential link.
--
-- why (persistence boundary): match_guest_access is an ORDINARY server-layer
-- domain table — exactly like legendary.match_bot_ally or legendary.coach_reports.
-- It is never runtime G/ctx, never a snapshot, never a save-game, never hashed
-- into the game-state hash, and never a source of competitive/derived gameplay
-- features. The seat a password grants is minted rowless (no match_seat_accounts
-- row, D-24120), so rule 2 keeps the match Casual. No persistence carve-out is
-- needed or added.
--
-- why (password_kdf, not password_hash + password_salt): the password is stored
-- as a node:crypto scrypt derived key. scrypt encodes its own random per-record
-- salt inside the stored string (the "salt:derivedKey" form this app writes), so
-- there is no separate salt column — one text column holds everything verify
-- needs. The plaintext is NEVER stored, logged, or returned.
--
-- why (game_name nullable): a host may set a password without a name, or a name
-- without a password; both columns are independently optional so the per-field
-- set-guest-access merge (absent leaves unchanged, empty-string clears) can null
-- either one without deleting the row.
--
-- Idempotent: CREATE TABLE uses IF NOT EXISTS (the 009/022/033/039/041/042
-- precedent). Re-running the runner against an already-seeded database succeeds.

CREATE TABLE IF NOT EXISTS legendary.match_guest_access (
  -- why: the bgio match id this access row belongs to — one row per match, so it
  -- is the natural primary key. A text column, no FK (the bgio match lives in the
  -- separate bgio schema, D-24095; the row is cleaned up by match lifecycle, not
  -- a database cascade).
  match_id      text        PRIMARY KEY,

  -- why: the optional host-chosen display name for the match ("Grandkids game").
  -- Nullable; the lobby shows it when present. Cleared to NULL by an explicit
  -- empty-string set (never wiped by a password-only set).
  game_name     text,

  -- why: the optional guest-join password as a node:crypto scrypt derived key in
  -- the "salt:derivedKey" hex form (the salt is embedded — no separate column).
  -- Nullable; NULL means the match has no guest password (join-as-guest returns
  -- 409 no-access). The plaintext is never stored here.
  password_kdf  text,

  -- why: when the access row was first created.
  created_at    timestamptz NOT NULL DEFAULT now(),

  -- why: when the name or password was last changed (advanced on every set).
  updated_at    timestamptz NOT NULL DEFAULT now()
);
