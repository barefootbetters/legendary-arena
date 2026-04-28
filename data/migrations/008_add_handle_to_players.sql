-- WP-101 / EC-114 — Handle columns + partial UNIQUE index on legendary.players
-- Created 2026-04-28 per WP-101 / EC-114.
--
-- This migration extends the WP-052 legendary.players table with three
-- new columns capturing an immutable, globally unique, URL-safe handle
-- that locks at first successful claim. The handle is a presentation
-- alias only; AccountId (per WP-052 / D-5201) remains the stable
-- identity key for ranking, authorization, and cross-service lookups.
-- Handles never enter game state, ranking inputs, or RNG.
--
-- Idempotent: three idempotent column additions plus an idempotent
-- partial unique index creation. Re-running the migration runner
-- against an already-seeded database succeeds without error.

ALTER TABLE legendary.players
  -- why: handle_canonical is the post-trim().toLowerCase() form and is
  -- the uniqueness key. Nullable until first claim; once non-null, it
  -- is never updated. WP-101's claimHandle is the SOLE writer for this
  -- column (and for display_handle / handle_locked_at); any second
  -- writer would violate the immutability invariant locked in WP-101
  -- §Non-Negotiable Constraints.
  ADD COLUMN IF NOT EXISTS handle_canonical text,

  -- why: display_handle preserves user-submitted casing (post-trim
  -- only) for presentation. Never used for lookup, authorization,
  -- routing, or uniqueness — those all key on handle_canonical or
  -- AccountId per WP-101 §Non-Negotiable Constraints.
  ADD COLUMN IF NOT EXISTS display_handle   text,

  -- why: handle_locked_at is the immutability marker. Set to now() at
  -- first successful claim; never updated thereafter. Mutual-presence
  -- invariant: the three handle columns are NULL together or non-NULL
  -- together (verified by application-layer tests in
  -- handle.logic.test.ts and by the single-writer claim SQL in
  -- handle.logic.ts).
  ADD COLUMN IF NOT EXISTS handle_locked_at timestamptz;

-- why: partial UNIQUE index on WHERE handle_canonical IS NOT NULL
-- permits multiple pre-claim rows with NULL handles while enforcing
-- global uniqueness once any handle is claimed. PostgreSQL SQLSTATE
-- '23505' on this index maps to the application-layer
-- code: 'handle_taken'; concurrent claims of the same canonical from
-- different accounts are serialized by the index.
-- why: CREATE UNIQUE INDEX IF NOT EXISTS mirrors WP-052 idempotency
-- precedent (see migrations 004 / 005 / 006 / 007) so the migration
-- runner can safely re-execute against an already-seeded database.
CREATE UNIQUE INDEX IF NOT EXISTS legendary_players_handle_canonical_unique
  ON legendary.players (handle_canonical)
  WHERE handle_canonical IS NOT NULL;
