-- WP-301 / EC-332 — Profile Loadout Library: legendary.player_loadouts
-- Created 2026-07-01 per WP-301 / EC-332.
--
-- This migration introduces account-scoped storage for a player's saved
-- LAGN loadouts (Vision §19b). One new table in the legendary.* namespace:
--
--   * legendary.player_loadouts — many-to-1 with legendary.players, keyed
--     on an opaque uuid id. Carries the loadout's display name, the
--     validated LAGN JSON document, a private/public visibility toggle,
--     and an opaque server-minted share_slug used by the guest read
--     endpoint (GET /api/loadouts/:shareSlug). ON DELETE CASCADE so
--     WP-052's deletePlayerData removes a player's loadouts automatically.
--
-- Saved loadouts are decorative, user-authored content per Vision §19b /
-- §19a — they are NEVER a competitive-submission path. This table has no
-- relationship to legendary.competitive_scores or any leaderboard surface.
--
-- Idempotent: every CREATE TABLE / CREATE INDEX uses IF NOT EXISTS,
-- mirroring the migration-009 precedent. Re-running the migration runner
-- against an already-seeded database succeeds without error.
--
-- Authority: WP-301 §Scope (In) §A; EC-332 §Locked Values; D-24086
-- (data model + decorative-not-merit lock + MAX_SAVED_LOADOUTS_PER_ACCOUNT
-- = 50 + share_slug opacity). The behavioral rules (per-account cap,
-- server-side LAGN validation, opaque slug minting + collision retry,
-- visibility->slug transitions, trimmed-name persistence) live in the
-- application layer (loadoutLibrary.logic.ts); this migration provides the
-- storage shape and the partial-unique share_slug backstop.

CREATE TABLE IF NOT EXISTS legendary.player_loadouts (
  -- why: opaque uuid PK (not a bigserial) so the surrogate key carries no
  -- enumerable ordering. The PATCH/DELETE routes address a loadout by this
  -- id; a random uuid keeps a caller from guessing another account's ids.
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- why: many-to-1 with legendary.players via FK on the bigint player_id
  -- PK (not the ext_id text column). The application resolves
  -- ext_id -> player_id inline (the migration-009 profile pattern) and
  -- scopes every /api/me/* query by the resolved player_id. ON DELETE
  -- CASCADE so WP-052's deletePlayerData removes a player's loadouts.
  player_id    bigint NOT NULL REFERENCES legendary.players(player_id) ON DELETE CASCADE,

  -- why: the loadout's display name. The 1-80 length bound and the trim
  -- are enforced in loadoutLibrary.logic.ts (validateLoadoutName) before
  -- any SQL fires, returning a typed 'invalid_name' rather than a
  -- constraint violation; NOT NULL here is defense-in-depth.
  name         text NOT NULL,

  -- why: the validated LAGN document. The application validates every
  -- create/update against @legendary-arena/lagn before insert and stores
  -- the parsed value; jsonb canonicalizes serialization (whitespace-
  -- insensitive, no duplicate keys). The raw request text is never stored.
  lagn_json    jsonb NOT NULL,

  -- why: private is the fail-closed default per Vision §3 posture — a
  -- freshly-saved loadout is not shareable until the owner opts in. The
  -- closed set '(private, public)' mirrors the migration-009 visibility
  -- CHECK; only a 'public' loadout is readable via the guest slug endpoint.
  visibility   text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),

  -- why: the opaque server-minted share slug (crypto.randomBytes(16) ->
  -- base64url, >=128 bits, 22 chars). NULL for a private loadout; minted
  -- on private->public and preserved on public->public so an already-
  -- shared link keeps working. Never derived from id/name/player_id.
  share_slug   text,

  -- why: created_at is the immutable save timestamp; updated_at advances
  -- on any real PATCH (name or visibility change) per the locked
  -- empty_update rule. The list endpoint orders by updated_at DESC.
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- why: every /api/me/loadouts read filters by the resolved player_id
-- first (list, and the ownership check on PATCH/DELETE), so a dedicated
-- single-column index on player_id is the cheaper plan for the common
-- WHERE player_id = $1 shape — consistent with the migration-009
-- idx_player_links_player_id posture.
CREATE INDEX IF NOT EXISTS idx_player_loadouts_player_id
  ON legendary.player_loadouts(player_id);

-- why: partial UNIQUE index on WHERE share_slug IS NOT NULL is the
-- collision backstop for the application-layer slug minter — many private
-- loadouts hold NULL share_slug simultaneously (a full UNIQUE would reject
-- the second NULL), while any two public loadouts are guaranteed distinct
-- slugs. The guest read endpoint keys on this column.
CREATE UNIQUE INDEX IF NOT EXISTS idx_player_loadouts_share_slug_unique
  ON legendary.player_loadouts(share_slug)
  WHERE share_slug IS NOT NULL;
