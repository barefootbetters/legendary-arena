-- WP-350 / EC-380 — Friendship graph: legendary.friendships
-- Created 2026-07-10 per WP-350 / EC-380 (D-24142).
--
-- Packet #1 of the Friends & Ranked Trust subsystem
-- (wiki/profile-login.md §Friends & Ranked Trust Layer). This migration
-- introduces the peer-to-peer social graph the profile surface has so
-- far lacked. One new table in the legendary.* namespace:
--
--   * legendary.friendships — the symmetric friend-request relation.
--     Keyed on friendship_id (bigserial); each row FKs two internal
--     player_id values to legendary.players(player_id) (the profile-
--     family convention from migration 009, NOT the ext_id text
--     column). requester_id / addressee_id record only WHO INITIATED
--     the request (for pending-request display); an accepted friendship
--     is symmetric and is stored ONCE per unordered pair via the
--     normalized-pair unique index below. status walks a closed set
--     ('pending','accepted','declined'). ON DELETE CASCADE so WP-052's
--     deletePlayerData removes a deleted player's friendship rows.
--
-- Idempotent: every CREATE uses IF NOT EXISTS, mirroring the migration
-- 004 / 008 / 009 precedent. Re-running against an already-seeded
-- database succeeds without error.
--
-- Authority: WP-350 §Scope (In) §A; EC-380 §Locked Values; D-24142
-- (friendship data model — FK convention, symmetry-as-normalized-pair,
-- closed status set, declined→pending UPDATE, removeFriend DELETE,
-- clique algorithm, library-only scope).

CREATE TABLE IF NOT EXISTS legendary.friendships (
  -- why: bigserial surrogate PK. The pair identity is enforced by the
  -- normalized-pair unique index below, not by the PK; friendship_id is
  -- server-internal and never appears on FriendshipView (the wire shape).
  friendship_id  bigserial   PRIMARY KEY,

  -- why: requester_id / addressee_id FK the bigint player_id on
  -- legendary.players (NOT the AccountId / ext_id text column), the
  -- profile-family convention from migration 009. They record only who
  -- initiated the request so packet #2 can render "incoming" vs
  -- "outgoing" pending requests; once accepted, the friendship is
  -- symmetric and direction is display-only. ON DELETE CASCADE so a
  -- deleted account's friendship rows are removed automatically.
  requester_id   bigint      NOT NULL REFERENCES legendary.players(player_id) ON DELETE CASCADE,
  addressee_id   bigint      NOT NULL REFERENCES legendary.players(player_id) ON DELETE CASCADE,

  -- why: closed status set per D-24142. A DB CHECK backs the TypeScript
  -- FriendshipStatus union + the canonical FRIENDSHIP_STATUSES array +
  -- a drift test. 'blocked' is DELIBERATELY absent: blocking is
  -- orthogonal to friendship (a block can exist with no prior request)
  -- and gets its own persistence model in a later packet. Adding a
  -- status value requires a new WP + a DECISIONS.md entry.
  status         text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),

  -- why: requested_at is reset to now() when a declined pair is
  -- re-requested (declined → pending is an UPDATE, never a second row).
  requested_at   timestamptz NOT NULL DEFAULT now(),

  -- why: responded_at is null while pending and is set to now() on
  -- accept or decline. It stays null on a fresh pending row and is
  -- cleared back to null when a declined pair is re-requested.
  responded_at   timestamptz,

  -- why: a player can never friend themselves. Enforced at the DB so a
  -- logic-layer bypass still cannot write a self-row; the logic layer
  -- maps a self-request to the typed 'self_friendship' code before any
  -- SQL fires.
  CONSTRAINT friendships_no_self CHECK (requester_id <> addressee_id)
);

-- why: symmetry stored ONCE per unordered pair. Normalizing on
-- (LEAST, GREATEST) makes {A,B} and {B,A} collide on the same index
-- key, so the second insert in EITHER direction fails at the DB — there
-- is never both an A→B and a B→A row. "Is A a friend of B?" is a single
-- row lookup regardless of who sent the request. This is the FR-4
-- symmetry invariant expressed as a constraint.
CREATE UNIQUE INDEX IF NOT EXISTS friendships_pair_unique
  ON legendary.friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));

-- why: the "incoming pending requests" read path filters by
-- addressee_id + status ('pending'). The composite index serves that
-- WHERE directly; the addressee-first column order matches the query
-- shape in listIncomingRequests.
CREATE INDEX IF NOT EXISTS idx_friendships_addressee_status
  ON legendary.friendships (addressee_id, status);
