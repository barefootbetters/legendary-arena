-- WP-358 / EC-388 — Match friend-invites (legendary.match_invites)
-- Created 2026-07-11 per WP-358 / EC-388 / D-24150.
--
-- A seated player invites an accepted friend into their match. The invite is
-- a friend-addressed pointer to a matchID; accept returns the matchID and the
-- client joins via the existing POST /api/match/join (no server-side bgio
-- join). Friends-only by design (enforced in matchInvites.logic.ts via
-- getFriendshipStatus) — anti-spam + block-respecting by construction.
--
-- Idempotent: CREATE TABLE / CREATE INDEX use IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS legendary.match_invites (
    invite_id    bigserial    PRIMARY KEY,

    -- why: the boardgame.io match id the invite points at. text (not FK) —
    -- match lifecycle is owned by the bgio store, not the legendary.* schema.
    match_id     text         NOT NULL,

    -- why: inviter/invitee FK the internal player_id (the profile-family
    -- convention, migrations 009/028), ON DELETE CASCADE so a deleted player
    -- takes their invites with them. The application resolves ext_id ->
    -- player_id inline before insert.
    inviter_id   bigint       NOT NULL REFERENCES legendary.players(player_id) ON DELETE CASCADE,
    invitee_id   bigint       NOT NULL REFERENCES legendary.players(player_id) ON DELETE CASCADE,

    -- why: closed status set mirrored by MATCH_INVITE_STATUSES + a drift test;
    -- adding a value requires updating both. declined -> pending re-invite is
    -- an UPDATE (matchInvites.logic.ts), never a second row.
    status       text         NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'accepted', 'declined')),

    created_at   timestamptz  NOT NULL DEFAULT now(),
    responded_at timestamptz,

    -- why: one invite per (match, invitee) — a friend cannot be double-invited
    -- to the same match; the re-invite path UPDATEs the existing row.
    UNIQUE (match_id, invitee_id),

    -- why: you cannot invite yourself (self_invite is also guarded in logic).
    CHECK (inviter_id <> invitee_id)
);

-- why: the incoming-invites read (GET /api/me/match-invites) filters by
-- (invitee_id, status='pending'); a composite index serves it directly.
CREATE INDEX IF NOT EXISTS idx_match_invites_invitee_status
  ON legendary.match_invites (invitee_id, status);
