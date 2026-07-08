# EC-363 — Seat → Account Identity Persistence (Match Join) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-333-seat-account-identity-persistence.md
**Layer:** Server (`apps/server/**`) + Persistence (new `legendary.*` table)

## Before Starting
- [ ] D-24119 Active (faithful-replay arc ratified; this is WP-1)
- [ ] WP-307/D-24092 Done — `matchGate.routes.ts` create/join gate exists
- [ ] WP-112 Done — `requireAuthenticatedSession` returns `{ ok, value: AccountId }`
- [ ] WP-052 Done — `legendary.players.ext_id text UNIQUE` (= AccountId, D-5201)
- [ ] Verified: bgio `createClientMatchData` (`server.js`) exposes `player.data` to clients → accountId MUST NOT go there
- [ ] `pnpm install` + `pnpm -r build` exit 0
- [ ] Target file set == the WP `Files Expected to Change` allowlist; anything outside is a FAIL

## Locked Values (do not re-derive)
- Table `legendary.match_seat_accounts`: `match_id text NOT NULL`, `player_id text NOT NULL`, `account_id text NOT NULL REFERENCES legendary.players(ext_id)`, `joined_at timestamptz NOT NULL DEFAULT now()`, `PRIMARY KEY (match_id, player_id)`
- `account_id` stores the `AccountId` (= `ext_id`) directly — no `player_id` bridging
- Writer: `recordSeatAccount(matchId: string, playerId: string, accountId: AccountId, database: DatabaseClient): Promise<void>` — one UPSERT `ON CONFLICT (match_id, player_id) DO UPDATE SET account_id = EXCLUDED.account_id, joined_at = now()`
- Migration path: `data/migrations/024_create_match_seat_accounts.sql`, idempotent (`CREATE TABLE IF NOT EXISTS`)
- `/api/match/join` request `{ matchID, playerID, playerName }` + response `{ playerCredentials }` — UNCHANGED
- Reserves D-24120

## Guardrails
- Recorded `account_id` = the SERVER-verified session `AccountId` ONLY; never read `accountId` from the request body (`requestBody.accountId` must not appear)
- Mapping stored ONLY in `legendary.match_seat_accounts`; NEVER stamped into bgio `setupData` / `player.data` (client-exposed → account-identity leak) — the native-join fetch body carries `playerID`+`playerName` only, no `data:`
- Seat recorded AFTER a successful native join; `recordSeatAccount` failure is best-effort — log a full-sentence error (naming matchID+playerID) and STILL return `{ playerCredentials }` (mirrors `issueTier1BadgesForSubmission`); do NOT fail the join
- Write is idempotent (re-join re-stamps, no duplicate)
- No engine / `G` / `ctx` / determinism / move / snapshot touch; `pg.Pool` reused (no `new Pool`); no new npm dep; no `Math.random`
- Migration idempotent; lives at `data/migrations/024_*` (established convention, NOT `apps/server/migrations/`)

## Required `// why:` Comments
- `matchGate.routes.ts` best-effort catch: why a record failure logs + continues (player already seated; attribution loss is a logged data-supply concern, not a join failure)
- `matchGate.routes.ts` identity source: why the recorded accountId is the session value, never the client body (anti-spoof)
- `seatAccount.logic.ts` UPSERT: why `ON CONFLICT DO UPDATE` (idempotent re-join)
- `024_*.sql` FK to `players(ext_id)`: why `ext_id` (not `player_id`) — the downstream `assignReplayOwnership` consumes `ext_id`

## Files to Produce
- `data/migrations/024_create_match_seat_accounts.sql` — **new** — the table
- `apps/server/src/match/seatAccount.logic.ts` — **new** — `recordSeatAccount`
- `apps/server/src/match/seatAccount.logic.test.ts` — **new** — UPSERT/idempotency (DB-gated)
- `apps/server/src/match/matchGate.routes.ts` — **modified** — auth helper returns AccountId; record seat post-join (best-effort)
- `apps/server/src/match/matchGate.routes.test.ts` — **modified** — session-not-client identity; best-effort non-failure; create still 401/delegates
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — whole-row `/api/match/join` (§21)
- `docs/ai/DECISIONS.md` — **modified** — D-24120

## After Completing
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/server test` exits 0 (new tests green; baseline preserved)
- [ ] Grep: `requestBody.accountId` absent from `matchGate.routes.ts`; native-join fetch body has no `data:`/`accountId`
- [ ] Migration `024` applied locally (`psql -f`) if running the DB-gated seat-account tests
- [ ] `api-endpoints.md` `/api/match/join` row updated (§21, whole-row)
- [ ] `docs/ai/STATUS.md` states "No user-observable change — infrastructure only" (+ payoff)
- [ ] `docs/ai/DECISIONS.md` D-24120 Active
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date
- [ ] `git diff --name-only` == allowlist

## Common Failure Smells (Optional)
- accountId visible to opponents in a match-info response → it was stamped into bgio `player.data`/`setupData` instead of the server-only table
- A transient DB blip 500s the join → the seat-record write is not wrapped best-effort
- Seat rows duplicate on re-join → missing `ON CONFLICT (match_id, player_id) DO UPDATE`
- A spoofed client `accountId` lands in the table → the handler read the body instead of the session value
