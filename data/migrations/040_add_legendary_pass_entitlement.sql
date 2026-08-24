-- WP-594 / EC-629 / D-24403 — Endgame AI Coach (server): add the legendary_pass_2026
-- entitlement key. Created 2026-08-23 per WP-594 / EC-629.
--
-- why: migration number 040 because 039 (create_player_gauntlet_runs) is the
-- current frontier on main; 040 is the next free sequential slot.
--
-- This migration widens the legendary.entitlements.entitlement_key closed-set
-- CHECK constraint (migration 011, D-13203) to admit a NEW distinct product key,
-- 'legendary_pass_2026' — the Legendary Pass. Per the operator's 2026-08-23
-- decision, the Pass is a SEPARATE product from supporter_tier_basic_2026 (it is
-- year-suffixed for the same reason supporter SKUs are: the Pass is time-boxed,
-- and a renewal ships a new key like _2027). The WP-594 endgame AI coach gates on
-- this key via getEntitlementsForAccount (WP-132).
--
-- why (drift-detection triple, per .claude/rules/code-style.md §Drift Detection):
-- adding an entitlement key requires the SAME-CHANGE update of (1) this SQL CHECK,
-- (2) the ENTITLEMENT_KEYS union, and (3) the ENTITLEMENT_KEYS array in
-- apps/server/src/entitlements/entitlements.types.ts. The migration-011 comment
-- names this obligation.
--
-- The inline CHECK from migration 011 was created unnamed, so PostgreSQL
-- auto-named it 'entitlements_entitlement_key_check'. This migration DROPs that
-- constraint and re-ADDs it with the widened member list under the SAME name, so
-- the schema stays stable. Idempotent: DROP CONSTRAINT IF EXISTS + a re-ADD that
-- names the constraint explicitly, so re-running the runner succeeds.

ALTER TABLE legendary.entitlements
  DROP CONSTRAINT IF EXISTS entitlements_entitlement_key_check;

ALTER TABLE legendary.entitlements
  ADD CONSTRAINT entitlements_entitlement_key_check CHECK (entitlement_key IN (
    'supporter_tier_basic_2026',
    'legendary_pass_2026',
    'cosmetic_playmat_classic',
    'cosmetic_playmat_comic',
    'cosmetic_playmat_minimal',
    'cosmetic_cardback_default_plus',
    'cosmetic_avatar_frame_supporter'
  ));
