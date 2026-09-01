# EC-665 — Per-Match Guest Password + Game Name (Server) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-630-guest-join-password-server.md
**Layer:** Server (`apps/server`) + Persistence (migration)

## Before Starting

- [ ] Read `addGuestRoutes.mjs` (the secret-join to reuse) + `analytics.routes.ts` (the per-IP token-bucket to reuse).
- [ ] Confirm the next migration number is `045` (`ls data/migrations`).
- [ ] `pnpm --filter @legendary-arena/server build` / `test` exit 0 (baseline).

## Locked Values (do not re-derive)

- Migration `045_create_match_guest_access.sql`: `legendary.match_guest_access` (`match_id` PK, `game_name`, `password_hash`, `password_salt`, `created_at`, `updated_at`). Server-only; never stores `G`.
- Password: salted **SHA-256** (`node:crypto`, random per-record salt over `salt+password`); verify with **`timingSafeEqual`** after a length precheck. **Plaintext NEVER stored/logged/returned.**
- `POST /api/match/set-guest-access` — `authenticated-session-required`, host must be a participant (`readSeatAccounts`); `{ matchId, gameName?, password? }`; empty password clears it.
- `POST /api/match/join-as-guest` — **public**, **per-IP rate-limited**; `{ matchId, password }` → verify → WP-627 add-guest secret-join → `200 { matchId, seat, credentials }`. Wrong/absent pw → 401; no pw set → 409; full → 409; rate-limited → 429.
- `GET /api/match/:matchId/guest-access` — public; `{ gameName, hasGuestPassword }` — NEVER the hash/salt.
- Seat stays Casual/non-account (no `match_seat_accounts` row → rule 2).

## Guardrails

- Server only — no engine/`G`/`ctx`; the `match_*` side table never stores `G`.
- The plaintext password never leaves the request handler (no log line, no response, no metadata).
- `join-as-guest` MUST be rate-limited before the DB hash read (cheap reject).
- Reuse the WP-627 secret-join to mint the seat — do not write a `match_seat_accounts` row.
- No new npm dep (use `node:crypto`); custom `/api` routes attach their own body parser (no global parser).

## Required `// why:` Comments

- On the salted-hash + `timingSafeEqual`: why (never store/compare plaintext; constant-time).
- On the public `join-as-guest` + its rate limit: why public (guests have no account) and why rate-limited (brute-force guard).
- On the no-`match_seat_accounts`-row mint: why (D-24120 → rule-2 Casual).

## Files to Produce

- `data/migrations/045_create_match_guest_access.sql` — **new**.
- `apps/server/src/match/guestAccess.logic.ts` — **new** — set/verify/read helpers.
- `apps/server/src/match/guestAccessRoutes.mjs` (or extend `addGuestRoutes.mjs`) — **new/modified** — the three endpoints.
- `apps/server/src/server.mjs` — **modified** — register (reuse the bot-ally context).
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — three whole rows.
- `apps/server/src/**/*.test.ts` — **new** — hash round-trip, wrong-pw 401, no-pw 409, rate-limit 429, happy rowless mint, host-gated set, meta never leaks hash.

## After Completing

- [ ] `pnpm --filter @legendary-arena/server build` / `test` exit 0 (DB-gated serialized)
- [ ] D-24026 live-verify (a password join lands a Casual seat)
- [ ] `docs/ai/REFERENCE/api-endpoints.md` rows present (whole-row)
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` — D-24441 Drafted → Active
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅`, then `pnpm roadmap:counts:write`

## Common Failure Smells (Optional)

- A password join yields a ranked match → a `match_seat_accounts` row was written; use the WP-627 rowless secret-join.
- The meta read exposes `password_hash` → tighten the SELECT / response shape.
- Brute-force possible → the rate limit runs after the hash read, or not at all; gate it first.
