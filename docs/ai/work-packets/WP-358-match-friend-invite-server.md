# WP-358 — Match Friend-Invite: Invite a Friend Into Your Game (Server)

**Status:** Draft 2026-07-11 · **READY (not blocked — all hard-deps Done)** · **Standard two-session lane** (D-24028 — NOT lightweight: new table + new `.types.ts`/routes contract + new endpoints + a new transactional-email event + catalog rows). Pairs with **EC-388** (authored at execution-prep). Reserves **D-24150** (lands at execution).
**Primary Layer:** Server (`apps/server`, `data/migrations`)
**User-Visible Surface:** email inboxes (an invite email) + the future client invite/pending-invites UI (a **client follow-on**). **D-24026 live-verify APPLIES** (invite a friend → they see it / can accept).
**Dependencies:** WP-350 (`getFriendshipStatus` — the friends-only guard) ✅ **Done**; WP-333 (`readSeatAccounts` — the inviter-is-in-the-match guard) ✅; WP-351 (`findAccountByHandle` — resolve the invitee) ✅; WP-353 (`BrevoTransactionalSender` + the fail-open notify pattern) ✅; the match create/join lobby (WP-308/D-24094 + WP-333) ✅. **No unmerged dependency — executable now.**
**Baseline:** `origin/main` @ (capture `git rev-parse origin/main` at execution). Highest migration on disk is `030` (or higher if WP-355/357 friends WPs land more — **use the next free slot at execution**; this doc says `032`).

---

## Goal

Turn the existing "share the matchID somehow" flow into a first-class **invite a friend into your game** feature. A player who has joined a match can invite an **accepted friend** by `@handle`; the friend gets a fail-open **email** and a persistent **pending invite** they can list, accept, or decline. Accept returns the `matchID` for the client to join through the existing `POST /api/match/join` (no server-side auto-join — boardgame.io credentials are client-managed). This is the **server half** of the lobby-invite flow (the half split out of the charter's packet #5); the invite / pending-invites UI is the deferred client follow-on. Invites are **friends-only by design** — inviting a non-friend stays the out-of-band shareable-link path, which keeps this feature anti-spam by construction (no rate limit needed; blocks are respected because a block severs friendship).

---

## User-Visible Impact

After a player creates and joins a match, they can invite a friend by `@handle`. The friend receives an email ("**{inviter} invited you to a game**") and — once the client follow-on lands — sees the invite in their profile with Join / Decline. Joining drops them into the same match. Non-friends can't be invited this way (they use a shared link); a blocked person can't be invited (blocking severed the friendship).

---

## Assumes

- **The match lifecycle is create → join, keyed on `matchID`.** `POST /api/match/create` (authenticated) returns `{ matchID }`; `POST /api/match/join` (authenticated) records the seat→account mapping (`recordSeatAccount`, WP-333) and is the join key. An invite is a friend-addressed pointer to a `matchID`; **accept returns the `matchID`** and the client joins through the existing endpoint — this packet does **not** reimplement the bgio join. (Verified: `apps/server/src/match/matchGate.routes.ts:224,284`.)
- **`readSeatAccounts(matchId, db)` gives the match's authenticated roster.** The inviter-is-in-the-match guard checks the inviter's `AccountId` is present. (Verified: `apps/server/src/match/seatAccount.logic.ts:72`.)
- **`getFriendshipStatus(pool, a, b)` returns the pair's status (WP-350).** The friends-only guard requires `'accepted'`. (Verified: `apps/server/src/friendships/friendships.logic.ts`.)
- **`findAccountByHandle` resolves the invitee `@handle` → `AccountId`.** (Verified: `handle.logic.ts:260`.)
- **`BrevoTransactionalSender` + the fail-open notify pattern exist (WP-353).** `createBrevoTransactionalSender(apiKey, fetchImpl?)` → `POST /v3/smtp/email`; the notify boundary swallows every failure (D-24077). This packet adds a `notifyMatchInvite` mirroring it + a new `BREVO_MATCH_INVITE_TEMPLATE_ID`. (Verified: `friendshipNotifications.logic.ts`, `brevoTransactional.logic.ts`.)
- **The profile-family FK + `/api/me/*` auth patterns are fixed.** `player_id bigint` FK to `legendary.players(player_id)`; routes call `requireAuthenticatedSession` first, typed errors, `Cache-Control: no-store`. (Verified: migrations 009/028; `loadoutLibrary.routes.ts`.)
- **Migration numbering:** use the next free slot at execution (this doc assumes `032`; highest on disk is `030` plus any friends-WP migrations that land first — `029`/`030`/`031`).

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

- [`wiki/profile-login.md` §Friends & Ranked Trust Layer](../../../wiki/profile-login.md) — the charter. This is the **lobby-invite-flow half of packet #5** that WP-354 split out. The ranked-eligibility gate (WP-354) is orthogonal — it clique-checks the roster at submission regardless of how players got into the match.
- `apps/server/src/match/matchGate.routes.ts` — the create/join lobby (the invite points at its `matchID`; accept hands the client back to `join`).
- `apps/server/src/match/seatAccount.logic.ts` — `readSeatAccounts` (inviter-in-match guard).
- `apps/server/src/friendships/friendships.logic.ts` — `getFriendshipStatus` (friends-only guard).
- `apps/server/src/friendships/friendshipNotifications.logic.ts` + `apps/server/src/marketing/brevoTransactional.logic.ts` (WP-353) — the fail-open transactional-email pattern to mirror for `notifyMatchInvite`.
- `apps/server/src/profile/loadoutLibrary.routes.ts` — the `/api/me/*` route + typed-error precedent.
- `docs/ai/REFERENCE/api-endpoints.md` + `00.3 §21` / D-11804 — the 4 new endpoints' catalog rows.

---

## Non-Negotiable Constraints

**Always apply:**
- ESM only; `node:` built-ins; `.test.ts`; human-style code per `00.6`; full-sentence errors; `// why:` on non-obvious choices; JSDoc; no branching `.reduce()`.
- No cross-layer import beyond the server set; no `boardgame.io`/engine/registry import (the join is delegated over loopback exactly as `matchGate.routes.ts` already does — this packet does not import bgio).

**Packet-specific:**
- **Friends-only (anti-spam by construction).** `createMatchInvite` requires `getFriendshipStatus(inviter, invitee) === 'accepted'` → else `not_friends`. This makes invites self-limiting (only friends can invite) and block-respecting (a block severs friendship, so a blocked person is not a friend). No separate rate limit in this packet.
- **Inviter must be in the match.** `readSeatAccounts(matchId)` must contain the inviter's `AccountId` → else `not_in_match`. You can only invite into a match you've joined.
- **Accept hands off to the existing join.** `acceptMatchInvite` marks the invite `accepted` and returns `{ matchId }`; the client joins via `POST /api/match/join`. This packet performs **no** boardgame.io join and mints **no** credentials.
- **Identity by handle on the wire (FR-2).** The invite view exposes the inviter's `handle` + `displayName` + the `matchId`, **never** an `accountId`. The invitee is resolved from the session; the invite target from `@handle`.
- **Fail-open email (D-24077).** `notifyMatchInvite` never throws/rejects; an unconfigured sender / unset template / unresolvable recipient / Brevo error degrades to a `console.warn`. Fired **fire-and-forget** (`void`) from the create route — the invite record is authoritative even if the email fails.
- **Closed status set + closed error union** each with a canonical `readonly` array + drift test. One invite per `(match, invitee)` (unique); re-invite after decline transitions `declined → pending` (UPDATE, not a second row) — mirrors the WP-350 friendship precedent.
- **No engine / `G` / RNG / scoring touch.** The invite is profile-adjacent persistence + a loopback pointer; it never affects ranked eligibility (WP-354 owns that at submission).

**Session protocol:**
- If the create/join delegation or the `getFriendshipStatus`/`readSeatAccounts` signatures are unclear, stop and read `matchGate.routes.ts` / `friendships.logic.ts` / `seatAccount.logic.ts` — do not invent the flow.

---

## Scope (In)

### A) Migration `032_create_match_invites.sql`
- `legendary.match_invites`: `invite_id bigserial PK`, `match_id text NOT NULL`, `inviter_id bigint NOT NULL REFERENCES legendary.players(player_id) ON DELETE CASCADE`, `invitee_id bigint NOT NULL REFERENCES legendary.players(player_id) ON DELETE CASCADE`, `status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined'))`, `created_at timestamptz NOT NULL DEFAULT now()`, `responded_at timestamptz`, `UNIQUE (match_id, invitee_id)`, `CHECK (inviter_id <> invitee_id)`. Index on `(invitee_id, status)` (the incoming-invites read). Idempotent.

### B) `matchInvites.types.ts` (new contract)
- `MatchInviteStatus = 'pending' | 'accepted' | 'declined'` + canonical array. `MatchInviteView { matchId, inviterHandle, inviterDisplayName, status, createdAt }` (no `accountId`). Closed `MatchInviteErrorCode` union (`unauthorized`/`invalid_request`/`handle_not_found`/`not_friends`/`not_in_match`/`self_invite`/`already_invited`/`invite_not_found`) + canonical array. `MatchInviteResult<T>` (mirrors WP-350 `Result<T>`). Re-import `AccountId`/`DatabaseClient` from identity.

### C) `matchInvites.logic.ts` (new)
- `createMatchInvite(pool, inviterAccountId, inviteeAccountId, matchId)` — guards: `inviter !== invitee` (`self_invite`); inviter in `readSeatAccounts(matchId)` (`not_in_match`); `getFriendshipStatus === 'accepted'` (`not_friends`); INSERT `pending`, or transition an existing `declined` pair `→ pending` (UPDATE). `listIncomingMatchInvites(pool, accountId)` → pending invites (invitee = account), enriched with inviter `handle`/`displayName` (one round-trip). `acceptMatchInvite(pool, accountId, matchId)` → mark the caller's pending invite `accepted`, return `{ matchId }` (`invite_not_found` if none). `declineMatchInvite(pool, accountId, matchId)` → mark `declined`.

### D) `matchInviteNotifications.logic.ts` (new — fail-open email)
- `notifyMatchInvite(pool, sender, templateId, { inviterAccountId, inviteeAccountId, matchId })` — resolve the invitee email + inviter `handle`/`displayName`, send the Brevo template (`params`: `inviterHandle`, `inviterDisplayName`; **no** `accountId`), swallow every failure (`console.warn`); always resolves. Mirrors WP-353's `sendFriendNotification`.

### E) `matchInvites.routes.ts` (new) — `registerMatchInviteRoutes(router, pool, deps)`
- `POST /api/match/invites` `{ matchId, handle }` → resolve `@handle` (`handle_not_found`), `createMatchInvite`, `void notifyMatchInvite(...)`, **201** `{ MatchInviteView }`.
- `GET /api/me/match-invites` → **200** `{ invites: MatchInviteView[] }`.
- `POST /api/me/match-invites/:matchId/accept` → **200** `{ matchId }`.
- `POST /api/me/match-invites/:matchId/decline` → **204**.
- All `authenticated-session-required`, auth-first, typed errors, `Cache-Control: no-store`. Deps bundle carries `requireAuthenticatedSession`/`verifier`/`accountResolver` + the `notificationConfig` (sender + `BREVO_MATCH_INVITE_TEMPLATE_ID`).

### F) Wiring — `server.mjs`
- One `registerMatchInviteRoutes(server.router, pool, { …auth, sender, matchInviteTemplateId })` call in the existing route-wiring block; build the sender from `BREVO_API_KEY` (reused) + parse `BREVO_MATCH_INVITE_TEMPLATE_ID` (undefined ⇒ email no-op). 01.5 wiring.

### G) `api-endpoints.md` (D-11804, at execution)
- 4 new rows (all `authenticated-session-required`, `Wired`).

### H) Tests
- `matchInvites.logic.test.ts` — create happy path; `self_invite`; inviter not seated → `not_in_match`; non-friend invitee → `not_friends`; duplicate → `already_invited`; `declined → pending` re-invite (UPDATE); list incoming (enriched, no `accountId`); accept returns `matchId` + marks accepted; accept with none → `invite_not_found`; decline; drift tests.
- `matchInvites.routes.test.ts` — auth gate; handle resolution (`handle_not_found`); the 4 endpoints; wire shape has no `accountId`.
- `matchInviteNotifications.logic.test.ts` — sends with the right template/params (no `accountId`); fail-open (sender throw / undefined / unresolvable → resolves, no reject).

---

## Out of Scope

- **No client** — the invite button + pending-invites list on `apps/arena-client` is the deferred **client follow-on**.
- **No server-side auto-join / bgio credential minting** — accept returns the `matchId`; the client joins via the existing `POST /api/match/join`.
- **No non-friend invites** — inviting a stranger stays the out-of-band shareable-link path (the "Option A" this WP deliberately did not build).
- **No invite rate limit** — friends-only makes it self-limiting; a cap is a future item only if abuse appears.
- **No match-invite email opt-out** — a preference could later extend the WP-357 pattern; not in this packet (match-invite email is fail-open, unconfigured ⇒ no-op).
- **No ranked / scoring touch** — WP-354 owns eligibility at submission, independent of how players were invited.
- **No engine / `G` / RNG touch.**

---

## Files Expected to Change

- `data/migrations/032_create_match_invites.sql` — **new**
- `apps/server/src/match/matchInvites.types.ts` — **new** (contract)
- `apps/server/src/match/matchInvites.logic.ts` — **new**
- `apps/server/src/match/matchInviteNotifications.logic.ts` — **new**
- `apps/server/src/match/matchInvites.routes.ts` — **new**
- `apps/server/src/match/matchInvites.logic.test.ts` — **new**
- `apps/server/src/match/matchInvites.routes.test.ts` — **new**
- `apps/server/src/match/matchInviteNotifications.logic.test.ts` — **new**
- `apps/server/src/server.mjs` — **modified** (one `registerMatchInviteRoutes(...)` wiring call — 01.5)
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** (4 new rows, D-11804)
- Governance: `WORK_INDEX.md` + `DECISIONS.md` (**D-24150**) + `STATUS.md` + `wiki/profile-login.md`. `EC_INDEX.md` + EC-388 at execution-prep.

**~5 new code + 3 tests + 1 wiring + catalog. Standard two-session lane.**

---

## Contract

### Endpoints (`authenticated-session-required`)
`POST /api/match/invites {matchId, handle}` → `201 {MatchInviteView}` · `GET /api/me/match-invites` → `200 {invites: MatchInviteView[]}` · `POST /api/me/match-invites/:matchId/accept` → `200 {matchId}` · `POST /api/me/match-invites/:matchId/decline` → `204`.

### Locked Values
| Key | Value |
|---|---|
| Friends-only | `createMatchInvite` requires `getFriendshipStatus(inviter, invitee) === 'accepted'` (`not_friends` else) — anti-spam + block-respecting by construction |
| Inviter-in-match | inviter's `AccountId` ∈ `readSeatAccounts(matchId)` (`not_in_match` else) |
| Accept semantics | mark `accepted`, **return `{ matchId }`**; the client joins via the existing `POST /api/match/join` (no server join, no bgio credentials) |
| Uniqueness | one row per `(match_id, invitee_id)`; `declined → pending` re-invite is an UPDATE (WP-350 precedent) |
| Wire identity | `MatchInviteView` = `matchId` + inviter `handle`/`displayName` + `status` + `createdAt`; **no** `accountId` (FR-2) |
| Email | fail-open `notifyMatchInvite` (fire-and-forget `void`); `BREVO_MATCH_INVITE_TEMPLATE_ID` (unconfigured ⇒ no-op); params carry handle/displayName, no `accountId` |

---

## Acceptance Criteria

1. Migration adds `legendary.match_invites` per Scope A (unique `(match_id, invitee_id)`, self-CHECK, status CHECK, FK CASCADE, `(invitee_id, status)` index) (**AC-1**).
2. `createMatchInvite` rejects self (`self_invite`), a non-seated inviter (`not_in_match`), a non-friend invitee (`not_friends`), and a duplicate (`already_invited`); inserts `pending` or transitions a `declined` pair `→ pending` (UPDATE, no second row) (**AC-2**).
3. `listIncomingMatchInvites` returns the caller's pending invites enriched with inviter `handle`/`displayName` (no `accountId`); `acceptMatchInvite` marks accepted and returns `{ matchId }` (`invite_not_found` if none); `declineMatchInvite` marks declined (**AC-3**).
4. The 4 routes are auth-first (guest → `unauthorized`), resolve `@handle` (`handle_not_found`), map typed errors, set `Cache-Control: no-store`, and expose **no** `accountId` on any wire object (asserted) (**AC-4**).
5. `notifyMatchInvite` sends the template with `inviterHandle`/`inviterDisplayName` (no `accountId`) and is fail-open (sender throw / undefined / unresolvable → resolves, never rejects); fired fire-and-forget from the create route (**AC-5**).
6. `server.mjs` wires exactly one `registerMatchInviteRoutes`; `api-endpoints.md` gains the 4 rows (D-11804); `00.3 §21` passes; no `boardgame.io`/engine/registry import in the new files (**AC-6**).
7. `pnpm -r build` 0; `pnpm --filter @legendary-arena/server test` green (new suites pass; DB-less skip parity; baseline otherwise unchanged) (**AC-7**).

---

## Verification Steps

```pwsh
pnpm -r build   # 0
pnpm --filter @legendary-arena/server test   # matchInvites + notifications suites green
Select-String -Path "apps\server\src\match\matchInvites.logic.ts" -Pattern "getFriendshipStatus|readSeatAccounts|not_friends|not_in_match"
Select-String -Path "apps\server\src\match\matchInvites.routes.ts","apps\server\src\match\matchInviteNotifications.logic.ts" -Pattern "accountId|boardgame.io|@legendary-arena/game-engine|@legendary-arena/registry"   # no output
Select-String -Path "docs\ai\REFERENCE\api-endpoints.md" -Pattern "/api/match/invites|/api/me/match-invites"
git diff --name-only   # only the ## Files Expected to Change set
```

---

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] Migration `032` (unique `(match,invitee)`, self-CHECK, status CHECK, CASCADE, index); idempotent
- [ ] `matchInvites.{types,logic}.ts` — friends-only + inviter-in-match guards; accept returns `{matchId}`; `declined→pending` UPDATE; drift-tested unions; no `accountId` on the wire
- [ ] `matchInviteNotifications.logic.ts` fail-open email (fire-and-forget); `matchInvites.routes.ts` 4 auth-first endpoints; `server.mjs` wires once
- [ ] No `boardgame.io`/engine/registry import; no server-side bgio join
- [ ] `api-endpoints.md` 4 rows (D-11804); `pnpm -r build` 0; server test green (DB-less skip parity)
- [ ] `DECISIONS.md` **D-24150** landed (Active); `WORK_INDEX` (WP-358) + `STATUS.md` + `wiki` updated
- [ ] **User-visible verification (D-24026):** APPLIES. On a real DB: seat two friends' accounts in a created match's roster, invite one → confirm the pending invite lists for them and accept returns the `matchId`; a non-friend invite → `not_friends`; (with Brevo configured) the invite email fires. Operator-pending on deploy; proof is the suite + DB smoke.

---

## Vision Alignment

**Vision clauses touched:** §23 (co-op — invite a friend to play *together* against the Mastermind; no PvP framing). **Conflict assertion:** No conflict — a social convenience over the existing lobby; ranked eligibility stays WP-354's job at submission. **Non-Goal check:** NG-1 (not pay-to-win — an invite confers no advantage); §23(b) (copy is "invite" / "join", no match/opponent/win framing). **No social reputation.** **Determinism:** N/A — profile-adjacent persistence + a loopback pointer; no engine/`G`/RNG.

## Lint Gate Self-Review (00.3)

- §1–§21: PASS or N/A-with-reason. Highlights — §5 standard lane (new table + contract + endpoints + email event → not lightweight); §8 server boundary (no bgio/engine import; join delegated over loopback as the existing gate does); §11 all 4 endpoints `authenticated-session-required`, session-resolved actor; §15.1 APPLIES (invite/accept live check); §17 §23(b)+NG-1 addressed, determinism N/A; §21 APPLIES (4 rows). §18 greps target identifiers + a no-`accountId`/no-bgio absence check, not a count-echo.

## Pre-Flight / Copilot (drafter self-review, standard lane)

**Pre-flight (01.4): READY.** All hard-deps Done on `main` (WP-350 `getFriendshipStatus`, WP-333 `readSeatAccounts`, WP-351 `findAccountByHandle`, WP-353 sender, the match lobby). No blocker. Scope locked to ~5 code + 3 tests + wiring + catalog, single layer.

**Copilot (01.7): PASS.** Failure modes pinned: (a) invite-spam by strangers → **friends-only guard (self-limiting, block-respecting)**; (b) inviting into a match you're not in → **`readSeatAccounts` guard**; (c) reimplementing/─breaking the bgio join → **accept returns `matchId`, client joins via existing endpoint, no bgio import**; (d) an email failure blocking the invite → **fail-open fire-and-forget**; (e) `accountId` on the wire/email → **handle/displayName only, asserted**; (f) duplicate/re-invite rows → **unique `(match,invitee)` + `declined→pending` UPDATE**. No BLOCK.

## Decision (reserved, lands at execution)

Reserves **D-24150**: match friend-invites (the lobby-invite-flow half of the charter's packet #5, server). Locks: (1) a new `legendary.match_invites` table (`player_id` FKs, unique `(match_id, invitee_id)`, closed status `('pending','accepted','declined')`; `declined→pending` re-invite is an UPDATE); (2) **friends-only** — `createMatchInvite` requires `getFriendshipStatus === 'accepted'` (anti-spam + block-respecting by construction; non-friends use the out-of-band shareable link); (3) **inviter must be seated** in the match (`readSeatAccounts`); (4) **accept returns `{matchId}`** and the client joins via the existing `POST /api/match/join` — no server-side bgio join or credential minting; (5) four `authenticated-session-required` endpoints returning a `MatchInviteView` (`matchId` + inviter `handle`/`displayName` + `status`, **never** `accountId`); (6) a fail-open fire-and-forget `notifyMatchInvite` email mirroring WP-353 (`BREVO_MATCH_INVITE_TEMPLATE_ID`, unconfigured ⇒ no-op). The client invite/pending-invites UI + any invite rate-limit/opt-out are separate follow-ons. Drafted 2026-07-11; not yet landed.
