# EC-388 — Match Friend-Invite (Server) (WP-358)

**Pairs with:** WP-358 · **Reserves:** D-24150 · **Lane:** standard two-session · **Status:** execution-prep 2026-07-11
**Layer:** Server (`apps/server`, `data/migrations`).

## Before Starting
- [ ] Baseline `origin/main`; WP-350 (`getFriendshipStatus`), WP-333 (`readSeatAccounts`), WP-351 (`findAccountByHandle`/`getHandleForAccount`, routes pattern), WP-353 (`BrevoTransactionalSender`) all on `main`. Next free migration = `032`.
- [ ] `TEST_DATABASE_URL`; `pnpm migrate` (adds 032); full server suite serialized (`--test-concurrency=1`).

## Locked Values
- `legendary.match_invites`: `invite_id bigserial PK`, `match_id text`, `inviter_id`/`invitee_id bigint FK players(player_id) CASCADE`, `status text CHECK ('pending','accepted','declined') DEFAULT 'pending'`, `created_at`, `responded_at`, `UNIQUE(match_id, invitee_id)`, `CHECK(inviter_id <> invitee_id)`, index `(invitee_id, status)`.
- **Friends-only:** `createMatchInvite` requires `getFriendshipStatus === 'accepted'` (`not_friends`).
- **Inviter seated:** inviter's `AccountId` ∈ `readSeatAccounts(matchId)` (`not_in_match`).
- **Accept returns `{ matchId }`** — the client joins via the existing `POST /api/match/join`; NO server-side bgio join / credential mint.
- `declined → pending` re-invite = UPDATE (no second row). `MatchInviteView` = `matchId` + inviter `handle`/`displayName` + `status` + `createdAt` — **no `accountId`** (FR-2).
- Endpoints (all `authenticated-session-required`): `POST /api/match/invites {matchId, handle}` (201) · `GET /api/me/match-invites` (200 `{invites}`) · `POST /api/me/match-invites/:matchId/accept` (200 `{matchId}`) · `POST …/:matchId/decline` (204).
- Email: fail-open `notifyMatchInvite` (fire-and-forget `void`), `BREVO_MATCH_INVITE_TEMPLATE_ID` (unconfigured ⇒ no-op); params carry handle/displayName, no `accountId`.

## Guardrails
- [ ] No `boardgame.io`/engine/registry import; the join is delegated over loopback by the EXISTING matchGate, not reimplemented here.
- [ ] WP-350 `friendships.{types,logic}.ts` byte-identical; WP-351 routes byte-identical.
- [ ] Closed `MatchInviteStatus` + `MatchInviteErrorCode` (+ route `MatchInviteApiErrorCode`) each with a canonical array + drift test.
- [ ] Fail-open notify never throws; fired `void` after the ok logic result.

## Required Comments (`// why:`)
- [ ] The friends-only guard (anti-spam + block-respecting by construction).
- [ ] Accept-returns-matchId (no bgio join here).
- [ ] The fire-and-forget `void notifyMatchInvite`.

## Files to Produce
- `data/migrations/032_create_match_invites.sql`
- `apps/server/src/match/matchInvites.types.ts` / `.logic.ts` / `.routes.ts` / `matchInviteNotifications.logic.ts`
- `apps/server/src/server.mjs` (one `registerMatchInviteRoutes(...)` + notify config)
- `docs/ai/REFERENCE/api-endpoints.md` (4 rows, D-11804)
- Tests: `matchInvites.logic.test.ts`, `matchInvites.routes.test.ts`, `matchInviteNotifications.logic.test.ts`

## After Completing
- [ ] `pnpm -r build` 0; full serialized DB-wired server suite green; migration 032 applied.
- [ ] D-24150 → Active; WORK_INDEX WP-358 `[x]`; EC_INDEX + STATUS + wiki + mindmap (📝→✅); `api-endpoints.md` (§21).
- [ ] D-24026 operator-pending on deploy (invite friend → pending invite lists → accept returns matchId).
