-- WP-420 — Deploy-Aware Bot-Ally Revival
-- Created 2026-07-24 per WP-420 / EC-455 / D-24240 (recover a drivable bot-ally
-- match that a clean deploy interrupted, instead of stranding it).
--
-- Adds a per-match "cleanly interrupted by shutdown" flag to
-- legendary.match_bot_ally. WP-419 correctly SURFACES a driverless bot-ally match
-- (the WP-415 banner) and settles a cap-stranded `active` row to `faulted`. But a
-- match that was HEALTHY and being driven when a graceful SIGTERM shutdown (what
-- Render sends on a redeploy) destroyed its in-process driver is recoverable — it
-- would play fine if the driver returned. This column lets the SIGTERM handler
-- mark exactly the matches it was driving, so boot revival can re-attach those
-- past the MAX_REVIVALS cap (one free revival, flag cleared on use). An ungraceful
-- loss (OOM / crash — no SIGTERM, so no flag) is NEVER free-revived: it keeps
-- WP-414's cap and WP-419's strand→faulted, so the 2026-07-23 OOM restart loop
-- cannot return.
--
-- Idempotent + additive: ADD COLUMN IF NOT EXISTS with a NOT NULL DEFAULT false,
-- so a re-run is a no-op and every existing row carries forward not-interrupted.
-- No existing column or row is altered.

-- why: additive column only (WP-420 Out of Scope: the row is never deleted or
-- repurposed); shutdown_interrupted defaults to false so pre-existing rows are
-- treated as not cleanly interrupted and stay under the normal MAX_REVIVALS cap.
-- The flag is set only by the graceful-SIGTERM mark and cleared on the next
-- revival — it is a one-boot exemption, never a persistent state.
ALTER TABLE legendary.match_bot_ally
    ADD COLUMN IF NOT EXISTS shutdown_interrupted boolean NOT NULL DEFAULT false;
