-- WP-375 — Bot-Ally Match Metadata Table
-- Created 2026-07-14 per WP-375 / EC-404 / D-24170 (solo bot-ally driver).
--
-- Records which seats of a mixed human + bot cooperative match are driven by a
-- bot ally, plus the bot's own decision seed and policy. One row per match,
-- written at creation by POST /api/match/create-with-bot (before the match
-- starts) and updated only in its `status` / `fault_message` fields as the
-- per-match BotAllyDriver tears down.
--
-- PURPOSE (D-24170 metadata storage): a first-class, queryable `bot_seats` tag.
-- It is the durable Casual-never-ranked signal WP-377's ranked guard consumes
-- (DESIGN §5b/§5c) — a match with a non-empty bot_seats row is never ranked —
-- and it lets the server re-register in-flight drivers after a restart. Stored
-- server-side ONLY; never written to boardgame.io's client-exposed
-- player.data / setupData.
--
-- NOTE: the number is 033 (not the WP/EC's placeholder 030) because migrations
-- 030 (player_blocks) and 032 (match_invites) already exist on main; 033 is the
-- next free slot.
--
-- Idempotent: CREATE TABLE uses IF NOT EXISTS. Re-running the migration runner
-- against an already-seeded database succeeds without error (mirrors the
-- WP-333 / WP-052 precedent).

-- why: legendary.* namespace per docs/ai/REFERENCE/00.2-data-requirements.md §1.
-- Sits under the same PostgreSQL schema as legendary.match_seat_accounts
-- (WP-333); it maps a boardgame.io match id to its bot-ally metadata.

CREATE TABLE IF NOT EXISTS legendary.match_bot_ally (
    -- why: match_id is the boardgame.io match identifier (a text id), NOT a
    -- legendary.* key. One bot-ally record per match, so it is the PRIMARY KEY.
    match_id       text        NOT NULL PRIMARY KEY,

    -- why: bot_seats holds the boardgame.io seat ids driven by the bot ally
    -- (e.g. {"1"} for 1 human + 1 bot; {"1","2"} for 1 human + 2 bots). A
    -- non-empty array is the signal WP-377's ranked guard short-circuits on.
    bot_seats      text[]      NOT NULL,

    -- why: decision_seed is the bot's OWN tie-break seed (the match id at
    -- creation) — NOT the match shuffle seed (D-3604) — persisted so a bot-ally
    -- match is reproducible and a re-registered driver keeps the same policy.
    decision_seed  text        NOT NULL,

    -- why: policy is the bot policy name ('competent' | 'random') — the only
    -- two v1 policies (DESIGN §10).
    policy         text        NOT NULL,

    -- why: status advances from 'active' (at creation) to a terminal value
    -- ('completed' | 'faulted' | 'abandoned' | 'exhausted') when the driver
    -- tears down. The row itself is never deleted, so bot_seats stays readable
    -- for the ranked guard even after the match finishes.
    status         text        NOT NULL DEFAULT 'active',

    -- why: fault_message carries the public-safe, co-op-framed sentence surfaced
    -- when the bot ally cannot finish its turn (WP-261 / D-24037). NULL unless
    -- the match faulted.
    fault_message  text,

    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);

-- why: the boot re-registration scan and any future analytics filter by status,
-- so index the status column for the "WHERE status = 'active'" read.
CREATE INDEX IF NOT EXISTS match_bot_ally_status_idx
    ON legendary.match_bot_ally (status);
