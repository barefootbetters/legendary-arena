# EC-665 — Per-Match Guest Password + Game Name (Server) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-630-guest-join-password-server.md
**Layer:** Server (`apps/server`) + Persistence (migration)

## Before Starting

- [ ] Read `addGuestRoutes.mjs` (the secret-join to reuse) + `analytics.routes.ts` (the per-IP token-bucket **pattern to copy — `makeRateLimiter` is not exported**).
- [ ] Confirm the next migration number is `044` (`ls data/migrations`; highest on disk is `043`).
- [ ] `pnpm --filter @legendary-arena/server test` exits 0 (baseline; the server is tsx-run, there is no `build` step).

## Locked Values (do not re-derive)

- Migration `044_create_match_guest_access.sql`: `legendary.match_guest_access` (`match_id` PK, `game_name`, `password_kdf`, `created_at`, `updated_at`). Server-only; never stores `G`. (No salt column — `scrypt` embeds its salt in the stored string.)
- Password: **`node:crypto` `scrypt` derived key** (random per-record salt embedded in the string); verify with **`timingSafeEqual`** after a length precheck. **Plaintext NEVER stored/logged/returned.**
- `verifyGuestPassword` returns a **discriminated** `'no-access' | 'mismatch' | 'match'` — never a bare boolean.
- `POST /api/match/set-guest-access` — `authenticated-session-required`, host must be a participant (`readSeatAccounts`); `{ matchId, gameName?, password? }`; **per-field merge — absent leaves unchanged, empty-string clears** (renaming never wipes the password).
- `POST /api/match/join-as-guest` — **public**, **per-IP rate-limited (limiter COPIED from the analytics pattern, consumed BEFORE any DB/hash read)**; `{ matchId, password }`. Flow: rate-limit → row lookup (**`no-access` → 409**) → verify (**`mismatch` → 401**, **`match` →** `mintGuestSeat` → `200 { matchId, seat, credentials }`). Full → 409; over the limit → 429.
- Seat minted via the **shared exported `mintGuestSeat`** extracted from `addGuestRoutes.mjs` (called by BOTH `add-guest` and `join-as-guest`).
- `GET /api/match/:matchId/guest-access` — public; `{ gameName, hasGuestPassword }` — NEVER the derived key.
- Seat stays Casual/non-account (no `match_seat_accounts` row → rule 2).

## Guardrails

- Server only — no engine/`G`/`ctx`; the `match_*` side table never stores `G`.
- The plaintext password never leaves the request handler (no log line, no response, no metadata).
- `join-as-guest` MUST consume the rate limit before the DB/hash read (cheap reject) — a test proves the ordering.
- Extract, don't re-implement: `mintGuestSeat` is the ONE place a rowless seat is minted; `add-guest` must stay byte-identical (its tests stay green).
- The rate-limiter is **copied** into the route file (the analytics one is module-local, not exported) — do NOT add an export to analytics.
- No new npm dep (use `node:crypto`); custom `/api` routes attach their own body parser (no global parser).

## Required `// why:` Comments

- On the `scrypt` KDF + `timingSafeEqual`: why (never store/compare plaintext; constant-time; scrypt = brute-force-resistant KDF).
- On the public `join-as-guest` + its rate limit: why public (guests have no account) and why rate-limited (brute-force guard).
- On the no-`match_seat_accounts`-row mint: why (D-24120 → rule-2 Casual).

## Files to Produce

- `data/migrations/044_create_match_guest_access.sql` — **new**.
- `apps/server/src/match/guestAccess.logic.ts` — **new** — set (per-field merge) / verify (discriminated, timing-safe) / read helpers.
- `apps/server/src/match/addGuestRoutes.mjs` — **modified** — extract exported `mintGuestSeat`; `add-guest` calls it (no behavior change).
- `apps/server/src/match/guestAccessRoutes.mjs` — **new** — the three endpoints (copied rate-limiter; calls `mintGuestSeat`).
- `apps/server/src/server.mjs` — **modified** — register (reuse the bot-ally context).
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — three whole rows.
- `apps/server/src/**/*.test.ts` — **new** — scrypt round-trip, **no-pw 409 vs wrong-pw 401 distinct**, **rate-limit-before-hash ordering** + 429, happy rowless mint, host-gated set, **per-field merge (rename keeps password / empty clears)**, meta never leaks the key, **no plaintext/key logged**, `add-guest` still green.

## After Completing

- [ ] `pnpm --filter @legendary-arena/server test` exits 0 (DB-gated serialized; no `build` step)
- [ ] D-24026 live-verify (a password join lands a Casual seat)
- [ ] `docs/ai/REFERENCE/api-endpoints.md` rows present (whole-row)
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` — D-24441 Drafted → Active
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅`, then `pnpm roadmap:counts:write`

## Common Failure Smells (Optional)

- A password join yields a ranked match → a `match_seat_accounts` row was written; use the WP-627 rowless secret-join.
- The meta read exposes `password_kdf` → tighten the SELECT / response shape.
- A `set` with only a new `gameName` blanks the password → the merge treated absent as clear; absent must LEAVE, only empty-string clears.
- Brute-force possible → the rate limit runs after the hash read, or not at all; gate it first.
