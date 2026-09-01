# WP-630 — Per-Match Guest Password + Game Name (Server)

**Status:** Done 2026-08-31
**Primary Layer:** Server (`apps/server`) + Persistence (a migration)
**Dependencies:** WP-627 / D-24437 (the add-guest secret-join this reuses to mint the seat); WP-307 (`requireAuthenticatedSession` for the host-gated set endpoint); WP-205 / D-20502 (the salted-hash + per-IP rate-limit precedents).
**User-Visible Surface:** none directly — two server endpoints + a lobby-list field. Consumed by the paired client WP-631. D-24026 live-verify is against the endpoints' observable effect (a guest with the password lands in a Casual seat).

> The server half of the **per-match guest password** model (D-24441): a host sets a game **name** + a **password**; a guest **types the password** to take a Casual seat — no account, no long link. This is the friendlier alternative to the WP-628 credential link, for a walk-up player (e.g. a grandchild on a tablet, no email). Server-only here; the host/guest UI is WP-631.

## Goal

After this session the server supports: (1) a host setting a **game name** + a **guest password** on a match they own; (2) a **public, rate-limited** endpoint that accepts `{ matchId, password }`, verifies the password against the stored **salted hash**, and — on match — mints the anonymous guest seat via the **shared `mintGuestSeat` helper** (extracted from the WP-627 add-guest secret-join), returning `{ matchId, seat, credentials }`; and (3) each match's **game name + `hasGuestPassword`** readable so the lobby list can show the name and the "Join as guest" affordance. The stored password is a `node:crypto` **`scrypt` derived key**, not a bare salted SHA-256.

## User-Visible Impact (D-24026)

Nothing renders yet (WP-631 wires the UI), but the observable server behavior is: with a password set, a passwordless caller who supplies the right password gets a working Casual seat; a wrong password is rejected; repeated guesses are rate-limited.

## Assumes

- The WP-627 add-guest secret-join (`apps/server/src/match/addGuestRoutes.mjs`) mints an anonymous seat (no `match_seat_accounts` row, D-24120) inline; its seat-minting body can be **extracted into an exported `mintGuestSeat` helper** and called from a new endpoint without behavior change.
- The analytics rate-limiter (`makeRateLimiter`) is **module-local, not exported** — its pattern is **copied**, not imported.
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

- New migration `044_create_match_guest_access.sql`: `legendary.match_guest_access` (`match_id` PK, `game_name text`, `password_kdf text`, `created_at`/`updated_at`). Server-only side table; never stores `G`. (`scrypt` encodes its salt inside the derived-key string, so there is no separate salt column.)
- Password is stored as a **`node:crypto` `scrypt` derived key** (a proper password KDF — no new dep; strengthens D-24441's salted-hash intent) with a random per-record salt embedded in the stored string, verified with **`timingSafeEqual`** (length-prechecked). The **plaintext is never stored, logged, or returned.**
- `POST /api/match/set-guest-access` — Auth **`authenticated-session-required`** (host must be a participant, `readSeatAccounts`). Body `{ matchId, gameName?, password? }` — **per-field merge**: an **absent** field is left unchanged; an explicit **empty string** clears it (so renaming the game can never silently wipe the password).
- `verifyGuestPassword` returns a **discriminated result** (`'no-access' | 'mismatch' | 'match'`), never a bare boolean, so the 409-vs-401 distinction is pinned at the type level.
- `POST /api/match/join-as-guest` — **`guest`** (public). Body `{ matchId, password }`. **Per-IP rate-limited** — the limiter is **copied** from the analytics `makeRateLimiter` pattern (it is module-local, not exported — do NOT import) into the new route file, and consumed **before** any DB/hash work (cheap reject). Flow: rate-limit → look up the row (**`no-access` → `409`**) → `verifyGuestPassword` (**`mismatch` → `401`**, **`match` →** mint the seat → `200 { matchId, seat, credentials }`). Match full → `409`; over the limit → `429`.
- The seat is minted via a **shared exported `mintGuestSeat` helper extracted from `addGuestRoutes.mjs`** (metadata occupancy read → free seat → secret-join → `{ seat, credentials }`), called by BOTH `add-guest` and `join-as-guest` so the D-24120 rowless-seat invariant lives in one place. The seat stays **Casual/non-account** (no `match_seat_accounts` row → rule 2 demotes).
- Game name + a boolean `hasGuestPassword` are **readable** for the lobby: public `GET /api/match/:matchId/guest-access` → `{ gameName: string | null, hasGuestPassword: boolean }` — **never** the derived key.

**Session protocol:** full-file contents; ESM; Node v22+; human-style code per `00.6`; no new npm deps (use `node:crypto`); Hanko-only for the host gate.

## Scope (In)

- **A. Migration** `044_create_match_guest_access.sql`.
- **B. Logic** (`apps/server/src/match/guestAccess.logic.ts`): `setGuestAccess` (**per-field merge** — absent leaves, empty-string clears), `verifyGuestPassword` (timing-safe, returns the discriminated `'no-access' | 'mismatch' | 'match'` result), `readGuestAccessMeta` — pure DB helpers (no boardgame.io import).
- **B2. Extract** the seat-minting body of `addGuestRoutes.mjs` into an exported `mintGuestSeat` helper; `add-guest` now calls it (no behavior change), and `join-as-guest` reuses it.
- **C. Endpoints**: `POST /api/match/set-guest-access` (host-gated), `POST /api/match/join-as-guest` (public; a **copied** per-IP token bucket consumed **before** any DB/hash work → `mintGuestSeat`), `GET /api/match/:matchId/guest-access` (public meta read).
- **D.** `api-endpoints.md` rows (§21) for the three routes.
- **E. Tests** (`node:test`): scrypt round-trip + timing-safe verify (discriminated result); **no-password → 409 vs wrong-password → 401 are distinct**; rate-limit → 429 **and the limiter fires BEFORE the row/hash read** (ordering test); happy join mints a rowless Casual seat; host-gated set (401 for non-participant); **`set-guest-access` per-field merge** (rename leaves the password intact; empty-string clears); meta read never leaks the derived key; **no endpoint logs the plaintext or the derived key**.

## Out of Scope

- All client UI (WP-631).
- Any change to the WP-628 link/QR path (this complements it).
- The `auth_provider` enum / any standing guest account (this is a per-match secret, not an identity).
- Any ranked/competitive/scoring surface.
- Any engine / move / `G` / `ctx` change.

## Vision Alignment

Triggers §17.1 — identity/visibility (§3, §11) + multiplayer late-join (§4). The guest password is a **per-match join secret**, not an identity or account; the seat it grants is anonymous and Casual-only (hard-excluded from merit surfaces, WP-627). It adds no standing credential (unlike the rejected Candidate A) — per-match, ephemeral, hashed, rate-limited. NG-proximity: none (free casual convenience). Determinism: unaffected (server wiring; no engine/`G`).

## Files Expected to Change

- `data/migrations/044_create_match_guest_access.sql` — **new**.
- `apps/server/src/match/guestAccess.logic.ts` — **new** — set/verify/read helpers (scrypt + timing-safe, discriminated verify).
- `apps/server/src/match/addGuestRoutes.mjs` — **modified** — extract the exported `mintGuestSeat` helper; `add-guest` calls it (no behavior change).
- `apps/server/src/match/guestAccessRoutes.mjs` — **new** — the three endpoints (copied rate-limiter; calls `mintGuestSeat`).
- `apps/server/src/server.mjs` — **modified** — register the routes (reuse the bot-ally context for the secret-join).
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — three whole rows (§21).
- `apps/server/src/**/*.test.ts` — **new** — the tests.

Allowlist ~7 files (justified: a migration + logic + the mintGuestSeat extraction + routes + wiring + catalog + tests for a cohesive server capability). Confirmed at execution.

## Acceptance Criteria

1. `setGuestAccess` stores a **scrypt derived key** (never plaintext); `verifyGuestPassword` returns `'match'` only for the right password (timing-safe) and distinguishes `'no-access'` from `'mismatch'`. **Per-field merge:** a `set` with only `gameName` leaves the stored password intact; an empty-string field clears that field.
2. `POST /api/match/set-guest-access` is host-gated (401 for a non-participant / no session) and sets name + password.
3. `POST /api/match/join-as-guest` with the correct password mints a **rowless** anonymous seat (no `match_seat_accounts` row) via the shared `mintGuestSeat` and returns `{ matchId, seat, credentials }`.
4. **Wrong password → 401; no password set on the match → 409** (distinct); match full → 409; > rate-limit/min from one IP → 429, **and the rate-limit is consumed before any row/hash read** (a test proves the ordering).
5. `GET /api/match/:matchId/guest-access` returns `{ gameName, hasGuestPassword }` and **never** the derived key. No endpoint logs the plaintext or the derived key.
6. A completed match joined via password is `is_ranked_eligible = false` (rule 2 — the guest seat is rowless).
7. The extracted `mintGuestSeat` leaves `add-guest` behaving byte-identically (its existing tests stay green).
8. `pnpm --filter @legendary-arena/server test` exits 0 (the server is tsx-run; there is no `build` step).
9. No file outside the allowlist changes.

## Verification Steps

```pwsh
# the server has no build step (tsx-run); tests are the gate
pnpm --filter @legendary-arena/server test     # exit 0, guest-access suites green
Select-String -Path apps/server/src/match/guestAccessRoutes.mjs -Pattern "join-as-guest|set-guest-access"
Select-String -Path apps/server/src/match/guestAccess.logic.ts -Pattern "timingSafeEqual|scrypt"
Select-String -Path apps/server/src/match/addGuestRoutes.mjs -Pattern "export.*mintGuestSeat"
```

## Definition of Done

- [x] All acceptance criteria pass
- [x] `docs/ai/STATUS.md` updated
- [x] `docs/ai/DECISIONS.md` — D-24441 flipped Drafted → Active
- [x] `docs/ai/REFERENCE/api-endpoints.md` — three new rows (§21)
- [x] `docs/ai/work-packets/WORK_INDEX.md` checked off with date
- [x] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅`; `roadmap:counts` exits 0
- [ ] D-24026 live-verify (a password join lands a Casual seat) — pending post-deploy
- [x] No files outside the allowlist

## Lint Gate Self-Review

Per `00.3`: **§1** PASS (sections; Out-of-Scope names 5). **§2** PASS (engine N/A w/ reason; locked values incl. the hash/rate-limit/casual invariants; cites `00.6`). **§3** PASS (deps + shapes; BLOCKED clause). **§4** PASS (files + D-entries + ARCHITECTURE §Persistence). **§5** PASS (files listed; ~6 justified). **§6** PASS (`match_guest_access`, `match_seat_accounts`, `join-as-guest` names). **§7** PASS (no new deps; `node:crypto`). **§8** PASS (server layer; `match_*` side table never stores `G`; no engine/`ctx`). **§9** PASS (`pwsh`). **§10** N/A (no new env var; salt is per-record, not an env secret). **§11** PASS (host gate = Hanko session; join-as-guest is deliberately public + rate-limited — one identity model, stated). **§12** PASS (`node:test`; DB-gated serialized). **§13** PASS. **§14** PASS (9 binary). **§15/§15.1** PASS (`**User-Visible Surface:**` declared; D-24026). **§16** PASS. **§17** PASS (Vision block; per-match secret not identity). **§18** PASS. **§19** N/A. **§20** N/A (no funding surface). **§21** PASS (three api-catalog rows in the exec commit; `join-as-guest` Auth `guest`, `set-guest-access` `authenticated-session-required`).
