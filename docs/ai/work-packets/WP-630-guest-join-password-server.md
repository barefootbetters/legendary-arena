# WP-630 — Per-Match Guest Password + Game Name (Server)

**Status:** Ready
**Primary Layer:** Server (`apps/server`) + Persistence (a migration)
**Dependencies:** WP-627 / D-24437 (the add-guest secret-join this reuses to mint the seat); WP-307 (`requireAuthenticatedSession` for the host-gated set endpoint); WP-205 / D-20502 (the salted-hash + per-IP rate-limit precedents).
**User-Visible Surface:** none directly — two server endpoints + a lobby-list field. Consumed by the paired client WP-631. D-24026 live-verify is against the endpoints' observable effect (a guest with the password lands in a Casual seat).

> The server half of the **per-match guest password** model (D-24441): a host sets a game **name** + a **password**; a guest **types the password** to take a Casual seat — no account, no long link. This is the friendlier alternative to the WP-628 credential link, for a walk-up player (e.g. a grandchild on a tablet, no email). Server-only here; the host/guest UI is WP-631.

## Goal

After this session the server supports: (1) a host setting a **game name** + a **guest password** on a match they own; (2) a **public, rate-limited** endpoint that accepts `{ matchId, password }`, verifies the password against the stored **salted hash**, and — on match — mints the anonymous guest seat via the WP-627 add-guest secret-join, returning `{ matchId, seat, credentials }`; and (3) each match's **game name + `hasGuestPassword`** readable so the lobby list can show the name and the "Join as guest" affordance.

## User-Visible Impact (D-24026)

Nothing renders yet (WP-631 wires the UI), but the observable server behavior is: with a password set, a passwordless caller who supplies the right password gets a working Casual seat; a wrong password is rejected; repeated guesses are rate-limited.

## Assumes

- The WP-627 add-guest secret-join (`apps/server/src/match/addGuestRoutes.mjs`) mints an anonymous seat (no `match_seat_accounts` row, D-24120) and is reusable from a new endpoint.
- `requireAuthenticatedSession` + `resolveAuthenticatedAccountId` gate host-owned actions; `readSeatAccounts` confirms match participation.
- A per-IP in-memory token-bucket rate-limiter pattern exists (`apps/server/src/analytics/**`) to reuse.
- `computeRankedEligibility` rule 2 keeps any match with a rowless (guest) seat Casual (WP-354).
- If any assumption is false, this WP is **BLOCKED**.

## Context (Read First)

- `docs/ai/DECISIONS.md` — **D-24441** (this decision + the security posture), D-24437, D-24120.
- `apps/server/src/match/addGuestRoutes.mjs` — the secret-join to reuse.
- `apps/server/src/analytics/analytics.routes.ts` — the per-IP rate-limit pattern.
- `apps/server/src/match/matchGate.routes.ts` — the host-auth + loopback idiom.
- `docs/ai/ARCHITECTURE.md` §Persistence Boundary; `.claude/rules/architecture.md` (server layer; a `match_*` side table is fine, never stores `G`).

## Non-Negotiable Constraints

Engine determinism constraints are **N/A** (server wiring; no engine/`G`/`ctx`).

**Locked contract values:**

- New migration `045_create_match_guest_access.sql`: `legendary.match_guest_access` (`match_id` PK, `game_name text`, `password_hash text`, `password_salt text`, `created_at`/`updated_at`). Server-only side table; never stores `G`.
- Password is stored **salted-hashed** (`node:crypto` SHA-256 over `salt + password`, random per-record salt) and verified with **`timingSafeEqual`** (length-prechecked). The **plaintext is never stored, logged, or returned.**
- `POST /api/match/set-guest-access` — Auth **`authenticated-session-required`** (host must be a participant, `readSeatAccounts`). Body `{ matchId, gameName?, password? }` (either updatable; an empty/absent password clears it). Sets the row.
- `POST /api/match/join-as-guest` — **`guest`** (public). Body `{ matchId, password }`. **Per-IP rate-limited** (reuse the analytics token bucket). Verifies the hash; on match → the WP-627 add-guest secret-join → `200 { matchId, seat, credentials }`. Wrong/absent password → `401`; no password set on the match → `409`; match full → `409`; rate-limited → `429`.
- Game name + a boolean `hasGuestPassword` are **readable** for the lobby (a public `GET /api/match/:matchId/guest-access` returning `{ gameName: string | null, hasGuestPassword: boolean }` — never the hash/salt).
- The minted seat stays **Casual/non-account** exactly as WP-627 (no `match_seat_accounts` row → rule 2 demotes).

**Session protocol:** full-file contents; ESM; Node v22+; human-style code per `00.6`; no new npm deps (use `node:crypto`); Hanko-only for the host gate.

## Scope (In)

- **A. Migration** `045_create_match_guest_access.sql`.
- **B. Logic** (`apps/server/src/match/guestAccess.logic.ts`): `setGuestAccess`, `verifyGuestPassword` (timing-safe), `readGuestAccessMeta` — pure DB helpers (no boardgame.io import).
- **C. Endpoints**: `POST /api/match/set-guest-access` (host-gated), `POST /api/match/join-as-guest` (public, rate-limited → reuse the add-guest secret-join), `GET /api/match/:matchId/guest-access` (public meta read).
- **D.** `api-endpoints.md` rows (§21) for the three routes.
- **E. Tests** (`node:test`): hash round-trip + timing-safe verify; wrong password → 401; no-password → 409; rate-limit → 429; happy join mints a rowless Casual seat; host-gated set (401 for non-participant); meta read never leaks the hash.

## Out of Scope

- All client UI (WP-631).
- Any change to the WP-628 link/QR path (this complements it).
- The `auth_provider` enum / any standing guest account (this is a per-match secret, not an identity).
- Any ranked/competitive/scoring surface.
- Any engine / move / `G` / `ctx` change.

## Vision Alignment

Triggers §17.1 — identity/visibility (§3, §11) + multiplayer late-join (§4). The guest password is a **per-match join secret**, not an identity or account; the seat it grants is anonymous and Casual-only (hard-excluded from merit surfaces, WP-627). It adds no standing credential (unlike the rejected Candidate A) — per-match, ephemeral, hashed, rate-limited. NG-proximity: none (free casual convenience). Determinism: unaffected (server wiring; no engine/`G`).

## Files Expected to Change

- `data/migrations/045_create_match_guest_access.sql` — **new**.
- `apps/server/src/match/guestAccess.logic.ts` — **new** — set/verify/read helpers.
- `apps/server/src/match/guestAccessRoutes.mjs` (or extend `addGuestRoutes.mjs`) — **new/modified** — the three endpoints (executor picks; declare in EC).
- `apps/server/src/server.mjs` — **modified** — register the routes (reuse the bot-ally context for the secret-join).
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — three whole rows (§21).
- `apps/server/src/**/*.test.ts` — **new** — the tests.

Allowlist ~6 files (justified: a migration + logic + routes + wiring + catalog + tests for a cohesive server capability). Confirmed at execution.

## Acceptance Criteria

1. `setGuestAccess` stores a **salted hash** (never plaintext); `verifyGuestPassword` returns true only for the right password (timing-safe).
2. `POST /api/match/set-guest-access` is host-gated (401 for a non-participant / no session) and sets name + password.
3. `POST /api/match/join-as-guest` with the correct password mints a **rowless** anonymous seat (no `match_seat_accounts` row) and returns `{ matchId, seat, credentials }`.
4. Wrong password → 401; no password set → 409; match full → 409; > rate-limit/min from one IP → 429.
5. `GET /api/match/:matchId/guest-access` returns `{ gameName, hasGuestPassword }` and **never** the hash/salt.
6. A completed match joined via password is `is_ranked_eligible = false` (rule 2 — the guest seat is rowless).
7. `pnpm --filter @legendary-arena/server build` and `test` exit 0.
8. No file outside the allowlist changes.

## Verification Steps

```pwsh
pnpm --filter @legendary-arena/server build   # exit 0
pnpm --filter @legendary-arena/server test     # exit 0, guest-access suite green
Select-String -Path apps/server/src/**/*.mjs,apps/server/src/**/*.ts -Pattern "join-as-guest|set-guest-access"
Select-String -Path apps/server/src/match/guestAccess.logic.ts -Pattern "timingSafeEqual"
```

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` — D-24441 flipped Drafted → Active
- [ ] `docs/ai/REFERENCE/api-endpoints.md` — three new rows (§21)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅`; `roadmap:counts:check` exits 0
- [ ] D-24026 live-verify (a password join lands a Casual seat)
- [ ] No files outside the allowlist

## Lint Gate Self-Review

Per `00.3`: **§1** PASS (sections; Out-of-Scope names 5). **§2** PASS (engine N/A w/ reason; locked values incl. the hash/rate-limit/casual invariants; cites `00.6`). **§3** PASS (deps + shapes; BLOCKED clause). **§4** PASS (files + D-entries + ARCHITECTURE §Persistence). **§5** PASS (files listed; ~6 justified). **§6** PASS (`match_guest_access`, `match_seat_accounts`, `join-as-guest` names). **§7** PASS (no new deps; `node:crypto`). **§8** PASS (server layer; `match_*` side table never stores `G`; no engine/`ctx`). **§9** PASS (`pwsh`). **§10** N/A (no new env var; salt is per-record, not an env secret). **§11** PASS (host gate = Hanko session; join-as-guest is deliberately public + rate-limited — one identity model, stated). **§12** PASS (`node:test`; DB-gated serialized). **§13** PASS. **§14** PASS (8 binary). **§15/§15.1** PASS (`**User-Visible Surface:**` declared; D-24026). **§16** PASS. **§17** PASS (Vision block; per-match secret not identity). **§18** PASS. **§19** N/A. **§20** N/A (no funding surface). **§21** PASS (three api-catalog rows in the exec commit; `join-as-guest` Auth `guest`, `set-guest-access` `authenticated-session-required`).
