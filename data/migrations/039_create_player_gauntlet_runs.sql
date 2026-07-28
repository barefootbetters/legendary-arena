-- WP-443 / EC-478 / D-24262 — Gauntlet Run Persistence: legendary.player_gauntlet_runs
-- Created 2026-07-27 per WP-443 / EC-478.
--
-- why: migration number 039 because 038 (add_driver_owner_to_match_bot_ally)
-- is the current frontier on main; 039 is the next free sequential slot.
--
-- This migration introduces the account-local gauntlet **run workspace**: one
-- new table in the legendary.* domain schema holding a player's in-progress
-- Mastermind Gauntlet runs. Each row carries the run's identity (player_id FK,
-- set_abbr, mastermind_slug, division, player_count), the player's per-leg hero
-- picks (leg_picks), and audit timestamps. It is ordinary server-layer domain
-- storage analogous to legendary.player_loadouts (WP-301) — account-local input
-- the player authors, never runtime G/ctx, never a snapshot, never a save-game,
-- and never the boardgame.io framework store. No persistence carve-out is
-- needed or added.
--
-- why (D-24262 — derived-progression lock): the table is MINIMAL and MAXIMALLY
-- DERIVED. It stores ONLY identity + leg_picks + audit timestamps. Run state,
-- hero pool, budget headroom, fixed-pool validity, competitive standing, and
-- "where you left off" are ALL computed at read time (WP-5) from leg_picks +
-- legendary.competitive_scores — never persisted as a column or flag table. No
-- future work may cache a derived progression value without a superseding
-- decision. If a column seems to make a read cheaper, it is derived, not stored.
--
-- Idempotent: every CREATE TABLE / CREATE INDEX uses IF NOT EXISTS, mirroring
-- the migration-009 / 022 / 033 precedent. Re-running the runner against an
-- already-seeded database succeeds without error.

CREATE TABLE IF NOT EXISTS legendary.player_gauntlet_runs (
  -- why: opaque uuid PK (not a bigserial) so the surrogate key carries no
  -- enumerable ordering, matching the player_loadouts precedent (WP-301).
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- why: many-to-1 with legendary.players via FK on the bigint player_id PK
  -- (not the ext_id text column). ON DELETE CASCADE so WP-052's
  -- deletePlayerData removes a player's runs automatically (009/011/022).
  player_id          bigint      NOT NULL REFERENCES legendary.players(player_id) ON DELETE CASCADE,

  -- why: the run identity — the identity-only pack fields (D-24260) the import
  -- flow (WP-5) validates and writes: which set + mastermind, which division,
  -- and the seat count the run was built for.
  set_abbr           text        NOT NULL,
  mastermind_slug    text        NOT NULL,
  division           text        NOT NULL CHECK (division IN ('fixed', 'open')),
  player_count       smallint    NOT NULL CHECK (player_count BETWEEN 1 AND 5),

  -- why: leg_picks is the SINGLE authoritative hero state for the run — a jsonb
  -- map schemeSlug -> heroDeckIds[]. There is no child hero table and no
  -- player_loadouts entry (the 50-loadout cap, D-24086, is untouched); the run's
  -- picks live here and only here. Defaults to an empty object for a fresh run.
  leg_picks          jsonb       NOT NULL DEFAULT '{}'::jsonb,

  -- why: created_at is the immutable run-open timestamp; updated_at advances on
  -- any real edit to leg_picks (WP-5). The listing read orders by these.
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  -- why: first_completed_at is a nullable, write-once AUDIT + archive-boundary
  -- stamp — set the first time a read derives that the run has been finished
  -- (WP-5). It is NEVER read as competitive-standing truth; every read
  -- re-derives standing from legendary.competitive_scores. It exists only to
  -- order run history and to draw the active-run boundary (see the index below).
  first_completed_at timestamptz
);

-- why: the partial predicate (index rows only while first_completed_at is null)
-- enforces at-most-one ACTIVE run per identity (player + set + mastermind +
-- division + player_count). A completed run (non-null first_completed_at) drops
-- out of the index and frees the slot, so a player may open a fresh active run
-- of the same identity after finishing an earlier one. A full UNIQUE (no
-- predicate) would wrongly forbid that. NOT a different column set.
CREATE UNIQUE INDEX IF NOT EXISTS player_gauntlet_runs_active_identity_uidx
  ON legendary.player_gauntlet_runs (player_id, set_abbr, mastermind_slug, division, player_count)
  WHERE first_completed_at IS NULL;

-- why: every /api/me/gauntlet-runs read (WP-5) filters by the resolved player_id
-- first, so a dedicated single-column index on player_id is the cheaper plan for
-- the common WHERE player_id = $1 listing shape (the player_loadouts precedent).
CREATE INDEX IF NOT EXISTS player_gauntlet_runs_player_idx
  ON legendary.player_gauntlet_runs (player_id);
