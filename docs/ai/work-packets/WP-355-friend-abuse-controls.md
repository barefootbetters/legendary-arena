# WP-355 — Friend Abuse Controls: Block List + Request Rate Limit + Re-request Cooldown (Server)

**Status:** Draft 2026-07-11 · **READY (not blocked — all hard-deps Done)** · **Standard two-session lane** (D-24028 — NOT lightweight: new table + new `.types.ts`/routes contract + new endpoints + an additive extension of WP-351's error union + catalog rows). Pairs with **EC-385** (authored at execution-prep). Reserves **D-24147** (lands at execution).
**Primary Layer:** Server (`apps/server`, `data/migrations`)
**User-Visible Surface:** `play.legendary-arena.com` (block/unblock actions + a blocked player cannot friend-request you; the block-management UI is a follow-up consumer). **D-24026 live-verify APPLIES** (via the block endpoints + the guarded send).
**Dependencies:** WP-350 (`legendary.friendships` + `removeFriend`) ✅ **Done (PR #672)**; WP-351 (`friendships.routes.ts` — the send handler this packet guards + where block endpoints mount; `findAccountByHandle`; the `FriendApiErrorCode` union this packet extends) ✅ **Done (PR #674)**; WP-104 (the `/api/me/*` auth pattern) ✅. **No unmerged dependency — executable now.**
**Baseline:** `origin/main` @ (capture `git rev-parse origin/main` at execution). Highest migration on disk is `028` (or `029` if WP-354 lands first — **the two are sequence-independent**; use the next free slot at execution). 

---

## Goal

Give players the anti-abuse controls the friend graph needs: a **block list** (a blocked player cannot send you a request, cannot be sent one by you, and any existing friendship between you is severed), a **per-day outgoing-request rate limit** (an abuser can't spam requests), and a **re-request cooldown** (a declined requester can't immediately re-send). Blocking is a **separate model** from friendship (WP-350's locked decision — a block can exist with no prior request), stored in a new `legendary.player_blocks` table. The three guards are enforced at WP-351's send handler; block/unblock/list are three new `authenticated-session-required` endpoints. This is the abuse-controls packet (charter #6).

---

## User-Visible Impact

A player can block someone (from a future block-management surface): the blocked person can no longer friend-request them, disappears from being addable, and any existing friendship is removed. Spamming friend requests hits a daily cap. Re-sending a just-declined request is refused until a cooldown elapses. Legitimate friending is unaffected.

---

## Assumes

- **WP-351's send handler is the guard site.** `friendships.routes.ts` `POST /api/me/friends/requests` resolves the target `@handle` → `AccountId` and calls `sendFriendRequest`. This packet inserts three checks (block, rate limit, cooldown) **before** that call and mounts the block endpoints in the same router. (Verified: WP-351 `friendships.routes.ts`.)
- **`FriendApiErrorCode` is WP-351's closed union with a canonical array + drift test.** This packet extends it **additively** with `blocked` / `rate_limited` / `request_cooldown` (D-24147 authorizes the contract extension) and keeps the drift test green. (Verified: WP-351 routes.)
- **`removeFriend` / the friendships pair model exist (WP-350).** Blocking severs an existing friendship by deleting the normalized-pair row (reuse the WP-350 delete path or an equivalent scoped delete). Cooldown reads the declined row's `responded_at`; the daily cap counts `pending` rows by `requester_id` + `requested_at`. (Verified: `friendships.logic.ts` + migration 028.)
- **`findAccountByHandle` resolves the block target.** `handle.logic.ts:260`. (Verified.)
- **The profile-family FK convention.** `player_blocks` FKs `player_id bigint` to `legendary.players(player_id) ON DELETE CASCADE`, resolving `ext_id → player_id` inline. (Verified: migrations 009/028.)

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

- [`wiki/profile-login.md` §Friends & Ranked Trust Layer (Proposed)](../../../wiki/profile-login.md) — the charter's "Privacy & abuse controls" + packet #6. **Blocking is a separate model** (WP-350 / D-24142 point 3 — `legendary.friendships` never gains a `'blocked'` status; a separate table owns it).
- `apps/server/src/friendships/friendships.routes.ts` (WP-351) — the send handler to guard + where block endpoints mount + the error union to extend.
- `apps/server/src/friendships/friendships.logic.ts` (WP-350) — `removeFriend` + the normalized-pair model (the friendship-severing on block).
- `apps/server/src/profile/loadoutLibrary.routes.ts` — the `/api/me/*` route + typed-error precedent for the block endpoints.
- `docs/ai/REFERENCE/api-endpoints.md` + `00.3 §21` / D-11804 — 3 new block endpoints + the updated send row (new codes).

---

## Non-Negotiable Constraints

**Always apply:**
- ESM only; `node:` built-ins; `.test.ts`; human-style code per `00.6`; full-sentence errors; `// why:` on non-obvious choices; JSDoc; no branching `.reduce()`.
- No cross-layer import beyond the server set; no `boardgame.io`/engine/registry import.

**Packet-specific:**
- **Blocking is orthogonal to friendship (D-24142).** A block lives in `legendary.player_blocks`, never as a friendship `status`. A block may exist with no prior request. Blocking someone **severs** any existing friendship (delete the pair row) as one transaction.
- **Symmetric block enforcement.** The send guard rejects if **either** direction is blocked (A blocked B, or B blocked A) → `blocked`. A blocked pair cannot friend either way.
- **Rate limit + cooldown are locked, additive send guards.** `MAX_OUTGOING_PENDING_PER_DAY` and `REREQUEST_COOLDOWN_HOURS` are locked constants (below); a request over the cap → `rate_limited`; a re-send within cooldown of a decline → `request_cooldown`. The three guards run in a fixed order (block → cooldown → rate limit) **before** `sendFriendRequest`.
- **WP-351 contract extended additively only.** `FriendApiErrorCode` gains exactly three codes (canonical array + drift test updated together); the six existing endpoints' shapes are otherwise byte-identical. The block endpoints are **new** rows.
- **WP-350 contract untouched.** `friendships.types.ts` / `friendships.logic.ts` are not modified; the friendship-sever on block reuses the existing `removeFriend` (or a scoped pair-delete in the new module) — no edit to the locked WP-350 files.
- **Identity by handle on the wire.** Block endpoints target `@handle`; the block list returns `handle` + `displayName`, **never** `accountId` (FR-2).
- Every new closed error union has a canonical `readonly` array + drift test.

**Session protocol:**
- If the send-handler shape or the `FriendApiErrorCode` extension mechanics are unclear, stop and read `friendships.routes.ts` — do not fork the error contract.

---

## Scope (In)

### A) Migration `0NN_create_player_blocks.sql` (next free slot — `029` or `030`)
- `legendary.player_blocks`: `block_id bigserial PK`, `blocker_id bigint NOT NULL REFERENCES legendary.players(player_id) ON DELETE CASCADE`, `blocked_id bigint NOT NULL REFERENCES legendary.players(player_id) ON DELETE CASCADE`, `created_at timestamptz NOT NULL DEFAULT now()`, `UNIQUE (blocker_id, blocked_id)`, `CHECK (blocker_id <> blocked_id)`. Index on `blocker_id`. Idempotent.

### B) `playerBlocks.logic.ts` (new)
- `blockPlayer(pool, blockerAccountId, blockedAccountId)` — insert the block **and** delete any friendships pair row between them, in one `BEGIN/COMMIT`; typed result. `unblockPlayer(pool, blockerAccountId, blockedAccountId)` — delete the block. `listBlocks(pool, accountId)` → the accounts this player has blocked. `isEitherBlocked(pool, accountIdA, accountIdB)` → boolean (either direction). Plus send-guard helpers: `countOutgoingPendingSince(pool, accountId, sinceIso)` and `mostRecentDeclineAgainst(pool, requesterAccountId, addresseeAccountId)`. All `AccountId`-keyed, `ext_id → player_id` inline, typed results, no WP-350-file edits.

### C) Send-handler guards + block endpoints — `friendships.routes.ts` (WP-351, additive)
- In `POST /api/me/friends/requests`, before `sendFriendRequest`: `isEitherBlocked` → `blocked` (403); `mostRecentDeclineAgainst` within `REREQUEST_COOLDOWN_HOURS` → `request_cooldown` (429); `countOutgoingPendingSince(24h) ≥ MAX_OUTGOING_PENDING_PER_DAY` → `rate_limited` (429).
- New routes: `POST /api/me/blocks` `{handle}` (201), `DELETE /api/me/blocks/:handle` (204), `GET /api/me/blocks` (200 `{ blocked: FriendSummary[] }` shape — handle+displayName, no accountId). Auth-first, typed errors, `Cache-Control: no-store`.
- Extend `FriendApiErrorCode` (+ canonical array + drift test) with `blocked` / `rate_limited` / `request_cooldown`; add a `BlockApiErrorCode` (or reuse) for the block endpoints (`unauthorized`/`invalid_request`/`handle_not_found`/`self_block`/`already_blocked`/`not_blocked`).

### D) Wiring — `server.mjs`
- No new dependency; the block routes register through the existing `registerFriendshipRoutes` deps (same `pool` + auth). If a separate `registerBlockRoutes` is cleaner, wire it in the same profile-routes block (01.5).

### E) `api-endpoints.md` (D-11804, at execution)
- 3 new block rows (`authenticated-session-required`) + the updated `POST /api/me/friends/requests` row (new error codes).

### F) Tests
- `playerBlocks.logic.test.ts` — block inserts + severs an existing friendship (transaction); unblock; list; `isEitherBlocked` both directions; self-block → `self_block`; duplicate → `already_blocked`; the rate-limit + cooldown count/decline helpers.
- `friendships.routes.test.ts` (extend) — send to a blocked pair → `blocked`; over-cap → `rate_limited`; within-cooldown re-send → `request_cooldown`; the block endpoints (create/list/delete, no `accountId` on the wire); the extended `FriendApiErrorCode` drift test.

---

## Out of Scope

- **No notification opt-out** — a per-account "email me on friend requests" preference (the WP-353 risk) is a **separate follow-up** dependent on WP-353 (drafted, not done); not in this packet.
- **No block-management UI / search hiding** — the `apps/arena-client` block surface + hiding blocked users from any future search is a consumer follow-up (this packet ships the API + send-guard enforcement).
- **No change to WP-350's friendship contract files** — `friendships.{types,logic}.ts` byte-identical; the sever-on-block reuses `removeFriend`.
- **No change to the six existing friend endpoints' shapes** — only the send row's error set is extended (additive).
- **No ranked / scoring touch** (that's WP-354). **No engine / `G` / RNG touch.**

---

## Files Expected to Change

- `data/migrations/0NN_create_player_blocks.sql` — **new**
- `apps/server/src/friendships/playerBlocks.logic.ts` — **new**
- `apps/server/src/friendships/playerBlocks.logic.test.ts` — **new**
- `apps/server/src/friendships/friendships.routes.ts` — **modified** (WP-351; send guards + block endpoints + extended error union — additive)
- `apps/server/src/friendships/friendships.routes.test.ts` — **modified** (guard + block-endpoint cases)
- `apps/server/src/server.mjs` — **modified** (block-route wiring if separate — 01.5)
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** (3 new rows + updated send row)
- Governance: `WORK_INDEX.md` + `DECISIONS.md` (**D-24147**) + `STATUS.md` + `wiki/profile-login.md`. `EC_INDEX.md` + EC-385 at execution-prep.

**1 migration + 1 new logic + 1 route edit + 2 tests + wiring + catalog. Standard two-session lane.**

---

## Contract

### New endpoints (`authenticated-session-required`)
`POST /api/me/blocks {handle}` → `201` · `DELETE /api/me/blocks/:handle` → `204` · `GET /api/me/blocks` → `200 { blocked: FriendSummary[] }`.

### Extended `FriendApiErrorCode` (send)
`… + 'blocked' | 'rate_limited' | 'request_cooldown'` (canonical array + drift test updated together).

### Locked Values (do not re-derive at execution)
| Key | Value |
|---|---|
| `MAX_OUTGOING_PENDING_PER_DAY` | **20** (outgoing `pending` requests created in the trailing 24h; over → `rate_limited`) |
| `REREQUEST_COOLDOWN_HOURS` | **24** (re-send to a requester who declined you within this window → `request_cooldown`) |
| Guard order | **block → cooldown → rate limit**, all **before** `sendFriendRequest` |
| Block symmetry | `isEitherBlocked` rejects a send if A blocked B **or** B blocked A |
| Block sever | `blockPlayer` inserts the block **and** deletes any friendships pair row in one `BEGIN/COMMIT` |
| Block store | `legendary.player_blocks`, `player_id` FKs (never a friendship `status` — D-24142) |
| Wire identity | block list returns `handle` + `displayName`, never `accountId` (FR-2) |

---

## Acceptance Criteria

1. Migration adds `legendary.player_blocks` with the Scope-A columns/constraints (unique pair, self-CHECK, FK CASCADE, `blocker_id` index) (**AC-1**).
2. `blockPlayer` inserts the block and severs any existing friendship in one transaction; `unblockPlayer` deletes it; `listBlocks` returns the blocker's blocked accounts; `isEitherBlocked` is true for either direction (**AC-2**).
3. The send handler rejects a blocked pair (`blocked`), an over-cap sender (`rate_limited` after `MAX_OUTGOING_PENDING_PER_DAY`), and a within-cooldown re-send (`request_cooldown`), in the locked order, before `sendFriendRequest` — a legitimate request still succeeds (**AC-3**).
4. `POST/DELETE/GET /api/me/blocks` work auth-first with typed errors and `Cache-Control: no-store`; the block list exposes `handle`+`displayName`, **no** `accountId` (asserted) (**AC-4**).
5. `FriendApiErrorCode` gains exactly `blocked`/`rate_limited`/`request_cooldown` (canonical array + drift test green); the six existing endpoints' shapes are otherwise byte-identical; WP-350's `friendships.{types,logic}.ts` byte-identical (**AC-5**).
6. `api-endpoints.md` gains the 3 block rows + the updated send row (D-11804); `00.3 §21` passes (**AC-6**).
7. `pnpm -r build` 0; `pnpm --filter @legendary-arena/server test` green (new + extended suites pass; DB-less skip parity) (**AC-7**).

---

## Verification Steps

```pwsh
pnpm -r build   # 0
pnpm --filter @legendary-arena/server test   # playerBlocks + friendships.routes suites green
git diff --name-only origin/main -- apps/server/src/friendships/friendships.types.ts apps/server/src/friendships/friendships.logic.ts   # no output (WP-350 untouched)
Select-String -Path "apps\server\src\friendships\playerBlocks.logic.ts" -Pattern "player_blocks|isEitherBlocked|blockPlayer"
Select-String -Path "apps\server\src\friendships\friendships.routes.ts" -Pattern "blocked|rate_limited|request_cooldown|/api/me/blocks"
Select-String -Path "docs\ai\REFERENCE\api-endpoints.md" -Pattern "/api/me/blocks"
git diff --name-only   # only the ## Files Expected to Change set
```

---

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] `player_blocks` migration (unique pair, self-CHECK, CASCADE, index); idempotent
- [ ] `playerBlocks.logic.ts` — block (+ sever, transactional) / unblock / list / `isEitherBlocked` + rate-limit + cooldown helpers; `AccountId`-keyed; typed results; drift-tested unions
- [ ] Send handler guards (block → cooldown → rate limit) before `sendFriendRequest`; block endpoints mounted; `FriendApiErrorCode` extended additively (drift green)
- [ ] WP-350 `friendships.{types,logic}.ts` byte-identical; block list has no `accountId`
- [ ] `api-endpoints.md` 3 new rows + updated send row (D-11804)
- [ ] `pnpm -r build` 0; server test green (DB-less skip parity)
- [ ] `DECISIONS.md` **D-24147** landed (Active); `WORK_INDEX` (WP-355) + `STATUS.md` + `wiki` updated
- [ ] **User-visible verification (D-24026):** APPLIES. On a real DB: block an account → confirm it can no longer send you a request and any friendship is gone; exceed the daily cap → `rate_limited`; re-send after a decline → `request_cooldown`. Operator-pending on deploy; proof is the suite + DB smoke.

---

## Vision Alignment

**Vision clauses touched:** none of the scoring clauses. Anti-abuse controls on the social graph; §23(b) — block/rate/cooldown copy carries no match/opponent framing. **Conflict assertion:** No conflict — hardens the friend graph without touching scoring/replay/RNG. **Non-Goal check:** NG-1 (not pay-to-win — blocks/limits are free safety controls, not gated power). **No social reputation** — a block is binary, not a score. **Determinism:** N/A — persistence + read guards.

## Lint Gate Self-Review (00.3)

- §1–§21: PASS or N/A-with-reason. Highlights — §5 standard lane (new table + new contract + endpoints → not lightweight); §8 server boundary (no engine import; reuses WP-350/351 same-layer); §11 all 3 block endpoints `authenticated-session-required`, session-resolved actor; §15.1 APPLIES (block + guard live check); §17 §23(b) + NG-1 addressed, determinism N/A; §21 APPLIES (3 rows + send row). §18 greps target identifiers + the WP-350-untouched `git diff`, not a count-echo.

## Pre-Flight / Copilot (drafter self-review, standard lane)

**Pre-flight (01.4): READY.** All hard-deps Done on `main` (WP-350 friendships + `removeFriend`; WP-351 routes + error union + `findAccountByHandle`; WP-104 auth pattern). No blocker. Scope locked to migration + 1 logic + 1 route edit + 2 tests + wiring + catalog. New table + contract extension → standard lane. Migration slot is sequence-independent of WP-354 (use next free at execution).

**Copilot (01.7): PASS.** Failure modes pinned: (a) blocking modeled as a friendship status → **separate `player_blocks` table, D-24142**; (b) a block leaving a live friendship → **transactional insert-block-and-sever**; (c) one-directional block bypass → **`isEitherBlocked` both directions**; (d) editing WP-350's locked contract → **byte-identical `git diff` gate, reuse `removeFriend`**; (e) `FriendApiErrorCode` drift → **canonical array + drift test updated together**; (f) `accountId` leaking on the block list → **handle/displayName only, asserted**; (g) rate-limit counting the wrong rows → **outgoing `pending` by `requester_id` in trailing 24h, tested**. No BLOCK.

## Decision (reserved, lands at execution)

Reserves **D-24147**: friend abuse controls (packet #6). Locks: (1) a **separate `legendary.player_blocks` table** (`player_id` FKs; blocking is never a friendship `status`, per D-24142); (2) `blockPlayer` **severs** any existing friendship transactionally; (3) **symmetric** block enforcement at the send handler (`isEitherBlocked`); (4) `MAX_OUTGOING_PENDING_PER_DAY = 20` + `REREQUEST_COOLDOWN_HOURS = 24`, enforced **block → cooldown → rate limit** before `sendFriendRequest`; (5) three new `authenticated-session-required` block endpoints returning `handle`+`displayName` (never `accountId`); (6) `FriendApiErrorCode` extended **additively** with `blocked`/`rate_limited`/`request_cooldown` (WP-350's contract files untouched; WP-351's six endpoint shapes otherwise byte-identical). Notification opt-out is a separate WP-353-dependent follow-up. Drafted 2026-07-11; not yet landed.
