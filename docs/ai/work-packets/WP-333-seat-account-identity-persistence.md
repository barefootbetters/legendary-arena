# WP-333 — Seat → Account Identity Persistence (Match Join)

**Status:** Draft — Ready to execute (pending operator review)
**Primary Layer:** Server (`apps/server/**`) + Persistence (new `legendary.*` table)
**Dependencies:** D-24119 (Active — faithful-replay architecture arc), WP-112 (session auth — Done), WP-052 (identity / `legendary.players` — Done), WP-307/D-24092 (match-gate authenticated create/join — Done), WP-309/D-24095 (durable bgio store — Done, context only)
**EC:** EC-363
**Baseline:** `origin/main` at `c8939fb7` (2026-07-08)
**User-Visible Surface:** none — infrastructure
**Reserves:** D-24120

---

## Goal

After this packet, every authenticated seat that joins a multiplayer match via
`POST /api/match/join` has its **server-verified** `AccountId` recorded in a new
server-only table `legendary.match_seat_accounts`, keyed by `(match_id,
player_id)`. This is WP-1 of the D-24119 faithful-replay arc: it makes the
seat→account mapping durable so a later capture step can call
`assignReplayOwnership(accountId, …)` for each authenticated seat. No user-visible
change; no seat identity is exposed to clients.

---

## Assumes

- **D-24119 Active** — the faithful-replay arc is ratified; this is its
  prerequisite WP-1 (seat→account identity). See `docs/ai/DECISIONS.md` D-24119.
- **WP-307 / D-24092 Done** — `apps/server/src/match/matchGate.routes.ts` exists
  with `POST /api/match/create` + `POST /api/match/join`, both authenticated via
  the caller-injected `requireAuthenticatedSession` (WP-112). The join handler
  delegates to the native lobby over loopback with the WP-308 internal-delegation
  secret.
- **WP-112 Done** — `requireAuthenticatedSession(req, options)` resolves to
  `{ ok: true, value: AccountId }`; the current `isRequestAuthenticated` helper
  (`matchGate.routes.ts:144`) already calls it but **discards** `value`, returning
  only a boolean.
- **WP-052 Done** — `legendary.players` has `ext_id text NOT NULL UNIQUE`
  (migration `004`), which is the `AccountId` (D-5201). `assignReplayOwnership`
  (the downstream consumer, a later WP) resolves ownership by `ext_id`.
- **Privacy constraint (verified):** boardgame.io's `createClientMatchData`
  (`server.js:2109-2115`) strips only `credentials` from player metadata and
  returns `player.data` to clients via `GET /games/:name/:id` + `listMatches`.
  Therefore the `AccountId` MUST NOT be stamped into bgio `player.data` (it would
  leak account identity to opponents + the public lobby). The project already
  withholds `accountId` from clients (WP-102 `PublicProfileView` omits it). The
  mapping is stored server-side only.
- **The bgio native join** (`server.js:2256`) assigns/accepts the `playerID` the
  gate forwards; the gate holds that `playerID` (client body) and the verified
  `AccountId` (session) together at join time.
- `pnpm install && pnpm -r build` exits 0 on `main`; the `apps/server` suite
  passes its baseline (DB-dependent tests skip without `TEST_DATABASE_URL`).

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `docs/ai/DECISIONS.md` D-24119 (the arc + this WP's place in it), D-24092
  (match-gate auth), D-5201 (AccountId is the branded `ext_id`; server-side
  owner reference), D-24095 (bgio store boundary — context).
- `docs/ai/ARCHITECTURE.md §Layer Boundary` + §Persistence Boundary — server
  may persist to `legendary.*`; this is a new domain table.
  `.claude/skills/legendary-persistence/SKILL.md`.
- `apps/server/src/match/matchGate.routes.ts` (`:144-165` the auth helper;
  `:274-339` the join handler + native delegation) — the edit sites.
- `apps/server/src/match/matchGate.routes.test.ts` — the fetch-stub test
  harness (`globalThis.fetch` capture) to extend.
- `apps/server/src/identity/replayOwnership.logic.ts` — the downstream consumer
  shape (`assignReplayOwnership` resolves by `ext_id`), for the column choice.
- `data/migrations/007_create_competitive_scores_table.sql` +
  `004_create_players_table.sql` — the migration + `ext_id` conventions to mirror.
- `docs/ai/REFERENCE/api-endpoints.md` — the `POST /api/match/join` row (behavior
  note update, §21).
- `docs/ai/REFERENCE/00.6-code-style.md` — Rules 4, 6, 11, 13.
- `docs/01-VISION.md` §3 (player identity / fairness / privacy).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- ESM only, Node v22+.
- Human-style code — see `docs/ai/REFERENCE/00.6-code-style.md`.
- Full file contents for every new or modified file (no diffs, no snippets).
- Test files `.test.ts`; `node:test` + `node:assert`; no boardgame.io import in
  tests; no network. DB-dependent tests use the non-silent skip when
  `TEST_DATABASE_URL` is unset (the WP-052 / WP-053 skip precedent).
- Full-sentence error messages.

**Packet-specific:**
- The recorded `AccountId` is the **server-verified** session value from
  `requireAuthenticatedSession`, NEVER a client-supplied field. The client body
  for `/api/match/join` is unchanged (`{ matchID, playerID, playerName }`); no
  `accountId` is read from it.
- The mapping is stored ONLY in the new `legendary.match_seat_accounts` table.
  It MUST NOT be stamped into bgio `setupData` or `player.data` (client-exposed
  via `createClientMatchData` — would leak account identity).
- The seat record is written **after** the native join succeeds, and is
  **best-effort**: a record-write failure is logged (full-sentence, error-level,
  naming `matchID`+`playerID`) but does NOT fail the join response (the player is
  already seated; mirrors the fire-and-forget `issueTier1BadgesForSubmission`
  precedent in `competition.logic.ts`). Attribution loss for that seat is a
  logged data-supply concern, not a join failure.
- The write is idempotent: `ON CONFLICT (match_id, player_id) DO UPDATE` (a
  re-join of the same seat re-stamps the account + `joined_at`).
- Migration is idempotent (`CREATE TABLE IF NOT EXISTS`); lives at
  `data/migrations/024_create_match_seat_accounts.sql` (the established
  convention — NOT `apps/server/migrations/`).
- No engine / `G` / `ctx` / determinism / move / snapshot surface touched. This
  is boardgame.io-metadata-adjacent only in that it keys on the bgio `match_id` +
  `player_id`; it stores no `G`.
- `pg.Pool` reused (never a fresh client). No new npm dependency. No
  `Math.random`, no engine import.

**Session protocol:**
- If the `AccountId` → `ext_id` linkage or the bgio `player.data` exposure is
  unclear, stop and re-read `identity.types.ts` / the bgio `server.js` join +
  `createClientMatchData` — never guess.

**Locked contract values:**
- Table: `legendary.match_seat_accounts` — columns:
  `match_id text NOT NULL`, `player_id text NOT NULL`,
  `account_id text NOT NULL REFERENCES legendary.players(ext_id)`,
  `joined_at timestamptz NOT NULL DEFAULT now()`;
  `PRIMARY KEY (match_id, player_id)`.
- `account_id` stores the `AccountId` (= `ext_id`) directly — the downstream
  `assignReplayOwnership` consumes `ext_id`, so no `player_id` bridging is stored
  here.
- Writer: `recordSeatAccount(matchId: string, playerId: string, accountId:
  AccountId, database: DatabaseClient): Promise<void>` — one parameterized UPSERT.
- The `/api/match/join` request + response contracts are UNCHANGED
  (`{ matchID, playerID, playerName }` → `{ playerCredentials }`).

---

## Scope (In)

### A) Migration
- **`data/migrations/024_create_match_seat_accounts.sql`** — new. Creates
  `legendary.match_seat_accounts` per the locked shape. Idempotent.

### B) Seat-account writer
- **`apps/server/src/match/seatAccount.logic.ts`** — new. Exports
  `recordSeatAccount(matchId, playerId, accountId, database)` — a single
  `INSERT ... ON CONFLICT (match_id, player_id) DO UPDATE SET account_id =
  EXCLUDED.account_id, joined_at = now()` against `legendary.match_seat_accounts`.
  Full-sentence error on DB fault (the caller decides best-effort handling).

### C) Gate wiring
- **`apps/server/src/match/matchGate.routes.ts`** — modified. (1) Change the auth
  helper (`isRequestAuthenticated` → `resolveAuthenticatedAccountId`) to return
  `AccountId | null` (null = rejected, 401 already written); update the
  `create` call site to treat null as "return" (it ignores the id). (2) In the
  `join` handler, after a successful native join, call `recordSeatAccount(matchId,
  playerId, accountId, database)` inside a try/catch — on failure, `console.error`
  a full-sentence warning naming `matchID`+`playerID` and continue (best-effort).
  The join response is unchanged.

### D) Tests
- **`apps/server/src/match/seatAccount.logic.test.ts`** — new. DB-dependent
  (skip without `TEST_DATABASE_URL`): a fresh insert then an idempotent re-insert
  (same `(match_id, player_id)` re-stamps `account_id`); a logic-pure shape/param
  assertion via a stub `query` where feasible.
- **`apps/server/src/match/matchGate.routes.test.ts`** — modified. The join
  success test asserts `recordSeatAccount` is invoked with the **session**
  `AccountId` (via an injected fake / stub `query` capturing the params) and the
  `playerID` from the body; a test proving a client-supplied `accountId` field in
  the body is ignored (the session value is used); a test proving a
  `recordSeatAccount` failure does NOT fail the join (still returns
  `playerCredentials`). The create tests still pass with the helper's new return.

### E) API catalog (§21 — same commit)
- **`docs/ai/REFERENCE/api-endpoints.md`** — modified. Whole-row replace the
  `POST /api/match/join` row to note the new server-side side-effect (records the
  seat→account mapping in `legendary.match_seat_accounts`). Request/response/
  status/auth are unchanged.

---

## Out of Scope

- **The capture step** (reading `match_seat_accounts` + `assignReplayOwnership`) —
  that is WP-3 of the arc. This WP only WRITES the mapping; it adds no reader.
- **Any faithful-replay / reducer-replay code** — WP-2 of the arc.
- **`GET`/list of seat accounts, or any client exposure** of the mapping — it is
  server-only by design.
- **Stamping identity into bgio `setupData` / `player.data`** — rejected
  (client-exposed; would leak `accountId`).
- **Bot / autoplay seats** — they join via a different path (not
  `/api/match/join`) and are intentionally left without a `match_seat_accounts`
  row; the future capture step treats a missing row as "not an authenticated
  seat." No change to the autoplay path here.
- **Backfill of in-flight matches** — only seats that join after this ships are
  recorded. Pre-existing matches are not retroactively mapped.

---

## Files Expected to Change

- `data/migrations/024_create_match_seat_accounts.sql` — **new**
- `apps/server/src/match/seatAccount.logic.ts` — **new** — `recordSeatAccount`
- `apps/server/src/match/seatAccount.logic.test.ts` — **new**
- `apps/server/src/match/matchGate.routes.ts` — **modified** — surface AccountId + record seat post-join
- `apps/server/src/match/matchGate.routes.test.ts` — **modified**
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — `/api/match/join` row (§21)
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — WP-333 row
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — EC-363 row
- `docs/ai/execution-checklists/EC-363-seat-account-identity-persistence.checklist.md` — **new**
- `docs/ai/work-packets/WP-333-seat-account-identity-persistence.md` — **new** — this file
- `docs/ai/STATUS.md` — **modified** (execution) — infrastructure-only entry
- `docs/ai/DECISIONS.md` — **modified** (execution) — D-24120

No other files may be modified.

---

## Contract

- **Table `legendary.match_seat_accounts`**: `(match_id text, player_id text,
  account_id text → players.ext_id, joined_at timestamptz)`, PK `(match_id,
  player_id)`.
- **`recordSeatAccount(matchId, playerId, accountId, database) => Promise<void>`**:
  idempotent UPSERT; throws only on infrastructure fault (caller handles
  best-effort).
- **`POST /api/match/join`**: request `{ matchID, playerID, playerName }` and
  response `{ playerCredentials }` UNCHANGED. New side-effect: on success, the
  `(matchID, playerID, session-AccountId)` seat mapping is recorded. Auth stays
  `authenticated-session-required`.
- **Identity source**: the recorded `account_id` is the session `AccountId` only.

---

## Acceptance Criteria

- [ ] Migration `024` creates `legendary.match_seat_accounts` with the locked
      columns + PK `(match_id, player_id)` + FK `account_id → players(ext_id)`;
      idempotent (`IF NOT EXISTS`).
- [ ] `recordSeatAccount` issues a single parameterized UPSERT
      (`ON CONFLICT (match_id, player_id) DO UPDATE`); re-invocation for the same
      seat re-stamps `account_id`/`joined_at` (no duplicate row).
- [ ] The join handler records the seat with the **session** `AccountId`, not any
      client-supplied field (asserted with a client body carrying a spoofed
      `accountId` — the session value wins).
- [ ] The join handler records the seat only **after** a successful native join,
      and a `recordSeatAccount` failure does NOT fail the join (still returns
      `{ playerCredentials }`; a full-sentence error is logged).
- [ ] The `/api/match/join` request + response shapes are byte-unchanged; no
      `accountId` is read from the request body.
- [ ] No `AccountId` is written to bgio `setupData` / `player.data` (grep: the
      native-join delegation body carries no `data:` / no `accountId`).
- [ ] `create` still authenticates via the updated helper (returns 401 unchanged
      on a bad session; delegates unchanged on a good one).
- [ ] `apps/server` test baseline preserved + new tests green.
- [ ] `docs/ai/REFERENCE/api-endpoints.md` `/api/match/join` row updated
      (whole-row, §21) noting the seat-mapping side-effect.
- [ ] No files outside `## Files Expected to Change` modified.

---

## Verification Steps

```pwsh
# Step 1 — build
pnpm -r build
# Expected: exits 0

# Step 2 — server tests (new + existing green; DB tests skip without TEST_DATABASE_URL)
pnpm --filter @legendary-arena/server test
# Expected: baseline preserved; new seatAccount + matchGate tests pass

# Step 3 — no accountId / data stamped into the native-join delegation
Select-String -Path "apps\server\src\match\matchGate.routes.ts" -Pattern "data:\s*\{|accountId" | Select-String -Pattern "join" -Context 0,0
# Expected: the native-join fetch body contains playerID + playerName only; the
# accountId appears ONLY in the recordSeatAccount call, never in the fetch body

# Step 4 — migration idempotency marker
Select-String -Path "data\migrations\024_create_match_seat_accounts.sql" -Pattern "CREATE TABLE IF NOT EXISTS legendary\.match_seat_accounts"
# Expected: 1 match

# Step 5 — request contract unchanged (no accountId read from body)
Select-String -Path "apps\server\src\match\matchGate.routes.ts" -Pattern "requestBody\.accountId"
# Expected: no match

# Step 6 — scope
git diff --name-only
# Expected: matches Files Expected to Change
```

---

## Vision Alignment

**Vision clauses touched:** §3 (Player Trust & Fairness / identity — this records
the account behind a competitive seat, server-side, for later score attribution;
it deliberately does NOT expose account identity to opponents).

**Conflict assertion:** No conflict: this WP preserves §3. The mapping is
server-only and never client-exposed, consistent with the project's existing
stance of withholding `accountId` from clients (WP-102 `PublicProfileView`).

**Non-Goal proximity check:** NG-1..7 — none crossed. No paid surface, no
pay-to-win, no data sale (the mapping is internal, not sold or exposed).

**Determinism preservation:** N/A — this WP touches no scoring, replay, RNG,
simulation, `G`, or `ctx`. It writes a `legendary.*` domain row keyed on
boardgame.io identifiers; the match's game state and determinism are untouched.

---

## Funding Surface Gate

**N/A** — server-side identity-persistence plumbing. No global-nav / registry /
profile funding affordance, no tournament funding channel, no user-visible
funding copy. Authority: WP-097, D-9701, D-9801.

---

## API Catalog Update (§21 — D-11804)

**Triggered** (behavior of an existing catalogued endpoint changes). At execution,
`docs/ai/REFERENCE/api-endpoints.md` is updated **in the same commit**: the
`POST /api/match/join` row is replaced **whole** to note the new server-side
side-effect (records the `(matchID, playerID, AccountId)` seat mapping in
`legendary.match_seat_accounts`). `Status` stays `Wired`, `Auth` stays
`authenticated-session-required`; request/response schemas unchanged; canonical
field names (`matchID`, `accountId`) per `00.2-data-requirements.md`.

---

## Lint Gate Self-Review (00.3)

| § | Verdict | Notes |
|---|---------|-------|
| §1 Structure | PASS | All required sections incl. Out of Scope (≥2 exclusions) |
| §2 Constraints | PASS | Engine-wide + packet-specific + session protocol + locked values; references 00.6; no partial output |
| §3 Assumes | PASS | D-24119/WP-112/WP-052/WP-307 + the bgio player.data exposure fact all explicit |
| §4 Context | PASS | ARCHITECTURE + persistence SKILL + matchGate + migrations + api-endpoints + VISION cited |
| §5 Output | PASS | 10 files new/modified w/ descriptions; bounded; ≤8 code/doc (governance excluded) |
| §6 Naming | PASS | `accountId`/`matchID`/`ext_id`/`player_id` per 00.2 + WP-052 |
| §7 Dependencies | PASS | No new npm dep; `pg.Pool` reused |
| §8 Boundaries | PASS | Server + persistence only; PostgreSQL for domain data (not `G`); no DB in moves; `pg.Pool` not client; migration idempotent |
| §9 Windows | PASS | `Select-String` / `pnpm` |
| §10 Env vars | N/A | No new env vars |
| §11 Auth | PASS | One model: `authenticated-session-required` via WP-112; the recorded identity is the server-verified session AccountId; Limitations = a record failure logs + does not fail the join |
| §12 Tests | PASS | `node:test`; DB-tests skip non-silently without `TEST_DATABASE_URL`; no boardgame.io import |
| §13 Commands | PASS | Exact `pnpm` + `Select-String` w/ expected output |
| §14 Acceptance | PASS | 10 binary, observable, referenced items |
| §15 Definition of Done | PASS | STATUS/DECISIONS/WORK_INDEX + scope-boundary + User-Visible Surface (`none — infrastructure`) |
| §16 Code style | PASS | Small functions; `// why:` on the best-effort catch + the session-not-client identity source; no premature abstraction |
| §17 Vision | PASS | §3 cited; no conflict; NG check; determinism N/A line present |
| §18 Prose-vs-grep | PASS | Step 3/5 greps target `data:`/`accountId`/`requestBody.accountId`; prose paraphrases (no verbatim self-trip) |
| §19 Bridge staleness | N/A | No repo-state-summarizing artifact |
| §20 Funding | N/A | Justified: server identity plumbing, no funding surface |
| §21 API catalog | PASS | Triggered; whole-row `/api/match/join` update obligated in the impl commit |

**Pre-flight self-verdict:** READY — deps (D-24119/WP-052/112/307) Active/Done on
`main`; scope locked; the privacy design (server-only table, not bgio `player.data`)
is resolved with the verified `createClientMatchData` finding; no ambiguity.

**Copilot self-check:** PASS — server+persistence only, additive table + one
gate-wiring edit, no engine/determinism surface, catalog obligation captured,
User-Visible Surface honestly `none — infrastructure`.

---

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/server test` exits 0 (new tests green, baseline preserved)
- [ ] `docs/ai/REFERENCE/api-endpoints.md` updated in the impl commit (whole-row, §21)
- [ ] `docs/ai/STATUS.md` updated — states "No user-observable change — infrastructure only"; names the payoff (seat→account mapping now durable for the D-24119 capture step)
- [ ] `docs/ai/DECISIONS.md` updated — D-24120 (seat→account persisted in a server-only `legendary.match_seat_accounts` table, NOT bgio `player.data`, to avoid exposing `accountId` to clients; best-effort write posture) flipped to Active
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-333 checked off with date
- [ ] No files outside `## Files Expected to Change` modified (`git diff --name-only`)
- [ ] Migration `024` applied to the local DB (`psql -f`) if running the DB-backed seat-account tests
