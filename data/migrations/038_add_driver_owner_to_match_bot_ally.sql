-- WP-437 — Bot-Ally Cross-Instance Ownership Guard
-- Created 2026-07-26 per WP-437 / EC-472 / D-24256 (cross-instance driver
-- ownership lease that closes the WP-424/D-24244-deferred deploy-overlap
-- two-writer freeze).
--
-- Adds a per-match ownership LEASE to legendary.match_bot_ally so that only ONE
-- server instance ever drives a given bot seat at a time. On a rolling Render
-- deploy the NEW instance revives a match's BotAllyDriver and starts submitting
-- the bot's moves BEFORE the OLD instance finishes draining — two instances then
-- drive the same seat and race on boardgame.io's `_stateID`, the bot's move never
-- lands, and the co-op match freezes with `driving:true` (so neither WP-419's
-- banner nor WP-433's fault log fires). WP-424 stopped the OLD instance's drivers
-- at SIGTERM but the boot-to-SIGTERM overlap window remained; D-24244 deferred
-- exactly this durable guard.
--
--   driver_owner  — the SERVER_INSTANCE_ID of the instance currently driving this
--                   match's bot seat(s). NULL = unowned (claimable). The driver
--                   runs an atomic claim-or-renew each poll tick and drives ONLY
--                   when it holds the lease; a peer whose lease is fresh yields.
--   heartbeat_at  — the last time the owner renewed the lease. A survivor may
--                   claim an owned lease only once heartbeat_at is older than
--                   BOT_ALLY_LEASE_TTL_MS (a crashed owner with no clean SIGTERM);
--                   a clean SIGTERM clears driver_owner for a near-instant handoff.
--
-- PURPOSE: side-table ownership metadata only (D-24095 store-only discipline; the
-- same data class as revive_count / shutdown_interrupted). NEVER written to
-- boardgame.io's G/ctx or the bgio blob.
--
-- Idempotent + additive: ADD COLUMN IF NOT EXISTS with NULL defaults, so a re-run
-- is a no-op and every existing row carries forward driver_owner NULL /
-- heartbeat_at NULL — i.e. immediately claimable by whichever instance revives it
-- after the deploy. No existing column or row is altered.

-- why: additive columns only (WP-437 Out of Scope: the row is never deleted or
-- repurposed). driver_owner defaults to NULL so pre-existing rows are unowned and
-- claimable; heartbeat_at defaults to NULL so a legacy row is treated as
-- never-heartbeated (claimable regardless of TTL). The atomic claim-or-renew
-- UPDATE keys off match_id (the PRIMARY KEY), so no additional index is needed.
ALTER TABLE legendary.match_bot_ally
    ADD COLUMN IF NOT EXISTS driver_owner text;

ALTER TABLE legendary.match_bot_ally
    ADD COLUMN IF NOT EXISTS heartbeat_at timestamptz;
