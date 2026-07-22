-- WP-414 — Bot-Ally Restart Revival Count
-- Created 2026-07-22 per WP-414 / EC-449 / D-24230 (bot-ally stall surfacing +
-- bounded restart revival).
--
-- Adds a per-match lifetime revival counter to legendary.match_bot_ally. WP-375
-- re-registered only `status = 'active'` matches after a server restart; a
-- driver that had faulted or exhausted before the restart was never revived, so
-- the human on seat 0 waited forever. WP-414 widens restart revival to still-live
-- faulted/exhausted matches, but must NOT re-register a permanently-wedged match
-- on every deploy — so each revival increments revive_count and the revival set
-- excludes any row at the MAX_REVIVALS cap (3). A capped match stays `faulted`
-- and is surfaced (via the new bot-ally-status endpoint + WP-415 banner) instead
-- of being revived again.
--
-- Idempotent + additive: ADD COLUMN IF NOT EXISTS with a NOT NULL DEFAULT 0, so
-- a re-run is a no-op and every existing row carries forward with revive_count 0
-- (never revived yet). No existing column or row is altered.

-- why: additive column only — the row is never deleted or repurposed (WP-414
-- Out of Scope); revive_count defaults to 0 so pre-existing rows are treated as
-- never-revived and remain eligible for the bounded revival on the next restart.
ALTER TABLE legendary.match_bot_ally
    ADD COLUMN IF NOT EXISTS revive_count integer NOT NULL DEFAULT 0;
