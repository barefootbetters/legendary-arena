-- WP-052 — Player Account Table (legendary.players)
-- Created 2026-04-25 per WP-052 v1.3 / EC-052 / D-5202 / D-5203.
--
-- This table stores authenticated player accounts. The TypeScript layer
-- maps `ext_id` <-> AccountId per D-5201; `player_id` is internal and
-- never exposed at the application surface.
--
-- Idempotent: CREATE TABLE uses IF NOT EXISTS. Re-running the migration
-- runner against an already-seeded database succeeds without error.

CREATE TABLE IF NOT EXISTS legendary.players (
    -- why: bigserial PK per 00.2-data-requirements.md §1; never exposed
    -- to the application layer (which uses ext_id / AccountId).
    player_id        bigserial    PRIMARY KEY,

    -- why: ext_id is the cross-service identifier per
    -- 00.2-data-requirements.md §1; maps 1:1 to AccountId per D-5201.
    -- UUID v4 sourced from node:crypto.randomUUID() at the application
    -- layer; format validated in the application, not in the schema.
    ext_id           text         NOT NULL UNIQUE,

    -- why: email is canonicalized (trimmed + lowercased) at the
    -- application layer before insertion; the UNIQUE constraint then
    -- enforces case-folded uniqueness.
    email            text         NOT NULL UNIQUE,

    -- why: display_name is validated (trimmed; length 1-64; no control
    -- characters) at the application layer; the column is plain text
    -- to keep the schema simple.
    display_name     text         NOT NULL,

    auth_provider    text         NOT NULL,
    auth_provider_id text         NOT NULL,
    created_at       timestamptz  NOT NULL DEFAULT now(),

    -- why: updated_at is application-managed (PS-11); this column
    -- exists for future identity-mutation WPs. No DB trigger updates
    -- it; insert-time it equals created_at by virtue of both defaults
    -- being now().
    updated_at       timestamptz  NOT NULL DEFAULT now()
);
