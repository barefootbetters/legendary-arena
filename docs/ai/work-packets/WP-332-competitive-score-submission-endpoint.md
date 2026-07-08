# WP-332 — Competitive Score Submission HTTP Endpoint

**Status:** Draft — Ready to execute (pending operator review)
**Primary Layer:** Server (`apps/server/**`)
**Dependencies:** WP-053 (submission library — Done), WP-112 (session auth — Done), WP-107 (`requireUnsuspendedAccount` — Done), WP-115 (leaderboard read routes precedent — Done)
**EC:** EC-362
**Baseline:** `origin/main` at `efc3a917` (2026-07-08)
**User-Visible Surface:** none — infrastructure
**Reserves:** D-24118

---

## Goal

After this packet, `apps/server` exposes a single authenticated HTTP endpoint —
`POST /api/competition/scores` — that wires the already-shipped WP-053 competitive
score-submission library (`submitCompetitiveScore`) to a request path. An
authenticated player submits a `{ replayHash }`; the server re-executes the
canonical replay, verifies the state hash, recomputes the PAR score, and writes
(idempotently) one immutable row to `legendary.competitive_scores`. This closes
the write-path gap documented in the Leaderboard ewiki page: today the submission
library has no route, so the table is empty and the public board renders nothing.
This WP does **not** wire any client to call the endpoint — that is a separate,
layer-split follow-up (see Out of Scope).

---

## Assumes

- **WP-053 Done** — `apps/server/src/competition/competition.logic.ts` exports
  `submitCompetitiveScoreImpl(identity, replayHash, database, deps)` (`:357`) and
  the inert 3-arg wrapper `submitCompetitiveScore(identity, replayHash, database)`
  (`:283`), plus the closed types `CompetitiveSubmissionRequest`,
  `SubmissionResult`, `SubmissionRejectionReason` in `competition.types.ts`.
- **The inert-wrapper gotcha** — the shipped `submitCompetitiveScore` wrapper uses
  `PRODUCTION_DEPENDENCIES`, whose `checkParPublished: () => null`
  (`competition.logic.ts:158-163`) fail-closes **every** submission to
  `par_not_published` before any replay load. A working route MUST inject the real
  `parGate.checkParPublished` and the startup registry; it MUST NOT call the inert
  wrapper.
- **WP-112 Done** — `requireAuthenticatedSession(req, options)` resolves a request
  to `Result<AccountId, SessionValidationCode>`; imported in `server.mjs:49`.
  Constructed deps `verifier` (`server.mjs:629`) and `accountResolver`
  (`server.mjs:676`) exist at startup.
- **WP-107 Done** — `requireUnsuspendedAccount` (`apps/server/src/auth/requireUnsuspendedAccount.ts`)
  ships fail-closed and unwired; its API-catalog row names "the future
  score-submission request-handler WP" as its first caller. This WP is that caller.
- **WP-115 Done** — `apps/server/src/leaderboards/leaderboard.routes.ts` is the
  structural precedent (`registerLeaderboardRoutes`, structural `KoaRouter`,
  `Cache-Control: no-store` first statement, `{ error: <code> }` envelope,
  per-module route-count drift test in `leaderboard.routes.test.ts`).
- `legendary.competitive_scores` exists (migration `007`, WP-053) with
  `UNIQUE (player_id, replay_hash)` (`:96`) — the idempotency anchor.
- `pnpm install && pnpm -r build` exits 0 on `main`; `pnpm --filter @legendary-arena/server test`
  passes its baseline.

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — confirms
  `apps/server/**` owns HTTP wiring; the engine decides, the server connects.
  `.claude/rules/architecture.md` import table (`apps/server` row).
- `.claude/skills/legendary-server/SKILL.md` — server-layer enforcement.
- `apps/server/src/competition/competition.logic.ts` (`:132-163`, `:283-289`,
  `:357-362`, `:515-597`) — the library surface, deps object, and the idempotent
  CTE insert / `wasExisting` semantics.
- `apps/server/src/competition/competition.types.ts` (`:58-60`, `:79-108`,
  `:140-172`) — `CompetitiveSubmissionRequest`, `SubmissionRejectionReason` +
  its canonical array, `SubmissionResult`, `CompetitiveScoreRecord`.
- `apps/server/src/leaderboards/leaderboard.routes.ts` (`:315-320`, `:419-451`)
  and `leaderboard.routes.test.ts` (`:74-85`, `:307-316`) — the route
  registration + handler + drift-test precedent to mirror.
- `apps/server/src/profile/ownerProfile.routes.ts` (`:91-98`, `:145-153`,
  `:198-212`) — the authenticated-write auth pattern (`authenticate` helper,
  `statusForSessionValidationCode`, 401-not-403 for `unknown_account`).
- `apps/server/src/auth/requireUnsuspendedAccount.ts` and its
  `docs/ai/REFERENCE/api-endpoints.md` row — the suspension check to wire.
- `apps/server/src/auth/identity.types.ts` — `PlayerIdentity` / `PlayerAccount`
  discriminated union + `AccountId` brand + the `isGuest` guard (do not re-derive
  the discriminant).
- `docs/ai/REFERENCE/api-endpoints.md` (`:29-48` taxonomy, `:216`
  `submitCompetitiveScore` `Library-only` row, `:135` / `:190` POST-row templates).
- `docs/ai/REFERENCE/00.2-data-requirements.md` — canonical field names
  (`replayHash`, `accountId`, `scenarioKey`).
- `docs/ai/REFERENCE/00.6-code-style.md` — Rules 4, 6, 11, 13; `.claude/rules/code-style.md`.
- `docs/01-VISION.md` §3, §18, §22, §24.
- `docs/ai/DECISIONS.md` — scan D-5301..D-5304 (submission verification +
  idempotency), D-9905 (Auth closed set), D-11504 (Cache-Control first),
  D-11802/D-11804 (error envelope + API catalog).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- ESM only, Node v22+.
- Human-style code — see `docs/ai/REFERENCE/00.6-code-style.md`.
- Full file contents for every new or modified file (no diffs, no snippets, no
  "show only the changed section").
- Test files `.test.ts`; `node:test` + `node:assert` only; no boardgame.io import
  in tests; no network/DB in unit tests (inject fakes).
- Full-sentence error messages.

**Packet-specific:**
- The route MUST call the new `submitCompetitiveScoreForRequest` wrapper (real
  `checkParPublished` + registry injected). It MUST NOT call the inert 3-arg
  `submitCompetitiveScore` wrapper (which rejects everything with
  `par_not_published`).
- The endpoint is `authenticated-session-required` (D-9905 closed set). Order of
  gates in the handler: (1) `Cache-Control: no-store` as the literal first
  statement; (2) resolve session → `AccountId` via `requireAuthenticatedSession`;
  (3) `requireUnsuspendedAccount`; (4) parse/validate body; (5) construct the
  non-guest `PlayerAccount` and call the submission. A failed earlier gate returns
  before the next runs.
- Guest / suspended / unauthenticated requests never reach the submission library.
  Because an authenticated session is by construction never a guest, the library's
  `guest_not_eligible` branch is structurally unreachable on this path — that is
  expected, not a bug.
- Uniform response envelope `{ error: <code> }` for every non-success path
  (mirrors the WP-115 leaderboard read family and the owner-profile auth path).
  `requireUnsuspendedAccount`'s Result is mapped into this envelope by the handler;
  the helper is envelope-agnostic.
- Additive-only in `competition.logic.ts`: the new wrapper is added; every existing
  export (`submitCompetitiveScore`, `submitCompetitiveScoreImpl`,
  `listPlayerCompetitiveScores`, `findCompetitiveScore`, the types) stays
  byte-identical. No contract file (`.types.ts`) is modified.
- `server.mjs` change is limited to the import + the `registerCompetitionRoutes(...)`
  registration (01.5 runtime-wiring; authorized below). No other `server.mjs` edit.
- No new npm dependencies. `pg.Pool` reused (never a fresh client). No
  `Math.random`, no wall-clock branching, no engine/registry mutation.

**Session protocol:**
- If any signature, type shape, or the `PlayerAccount` constructor is unclear, stop
  and read `identity.types.ts` / `competition.types.ts` — never invent a field name
  or discriminant.

**Locked contract values:**
- Method + path: `POST /api/competition/scores`
- Auth: `authenticated-session-required`
- Request body: `{ "replayHash": string }` (canonical field name `replayHash`)
- Success (200) body: `{ "record": CompetitiveScoreRecord, "wasExisting": boolean }`
- Status-code map (locked):

  | Condition | Status | Body |
  |---|---|---|
  | Success (fresh insert OR idempotent existing) | `200` | `{ record, wasExisting }` |
  | Missing / empty / non-string `replayHash` | `400` | `{ error: "invalid_request" }` |
  | Missing / invalid / expired session, unknown account | `401` | `{ error: <SessionValidationCode> }` |
  | Suspended account | `403` | `{ error: "forbidden" }` |
  | Rejection `replay_not_found` | `404` | `{ error: "replay_not_found" }` |
  | Rejection `not_owner`, `visibility_not_eligible` | `403` | `{ error: <reason> }` |
  | Rejection `par_not_published`, `replay_verification_failed` | `422` | `{ error: <reason> }` |
  | Uncaught error thrown | `500` | `{ error: "internal_error" }` |

- Status-code domain locked to `{ 200, 400, 401, 403, 404, 422, 500 }`.
- Route registration: `registerCompetitionRoutes(router, database, deps, competitionLogic = PRODUCTION_COMPETITION_LOGIC)` — the 4th param is a test seam mirroring `registerLeaderboardRoutes`'s `leaderboardLogic`.

---

## Scope (In)

### A) Submission route
- **`apps/server/src/competition/competition.routes.ts`** — new. Exports
  `registerCompetitionRoutes(router, database, deps, competitionLogic)`. Registers
  exactly one handler: `router.post('/api/competition/scores', ...)`. Handler
  follows the locked gate order, the locked status map, and the `{ error }`
  envelope. `deps` bundle: `{ requireAuthenticatedSession, verifier,
  accountResolver, requireUnsuspendedAccount, checkParPublished, registry }`.
  `PRODUCTION_COMPETITION_LOGIC.submitCompetitiveScore` delegates to the new
  `competition.logic.ts` wrapper. Uses the local structural `KoaRouter` interface
  pattern (no `@koa/router` import), mirroring `leaderboard.routes.ts`.

### B) Production submission wrapper (real deps)
- **`apps/server/src/competition/competition.logic.ts`** — modified, additive only.
  Add `submitCompetitiveScoreForRequest(identity, replayHash, database, { checkParPublished, registry })`
  that delegates to `submitCompetitiveScoreImpl(identity, replayHash, database, { loadReplay, replayGame, checkParPublished, registry })`, supplying the real
  module-internal `loadReplay` / `replayGame` and the injected `checkParPublished`
  + `registry`. Every existing export unchanged.

### C) Server wiring
- **`apps/server/src/server.mjs`** — modified (01.5 runtime-wiring). Add the import
  and one `registerCompetitionRoutes(server.router, pool, { requireAuthenticatedSession,
  verifier, accountResolver: verifier === undefined ? undefined : accountResolver,
  requireUnsuspendedAccount, checkParPublished: parGate.checkParPublished, registry })`
  call, placed after the pool + parGate + registry + auth deps exist (adjacent to
  the existing `registerLeaderboardRoutes` / `registerOwnerProfileRoutes` block).

### D) Tests
- **`apps/server/src/competition/competition.routes.test.ts`** — new. Mock-router
  drift test ("registers exactly one POST handler at the locked path"),
  Cache-Control-first assertion, auth-first (401 on failed session; 403 on
  suspended — both before any submission call), 400 on missing/empty `replayHash`,
  the full rejection→status map (one case per `SubmissionRejectionReason` that is
  reachable on this path), success 200 for fresh (`wasExisting:false`) and existing
  (`wasExisting:true`), and 500 on a thrown error. All via injected fakes — no DB,
  no network.
- **`apps/server/src/competition/competition.logic.test.ts`** — modified. Add
  coverage for `submitCompetitiveScoreForRequest`: it delegates with the injected
  `checkParPublished` (so a PAR-published scenario is now accepted where the inert
  wrapper would reject), and it does not alter existing behavior.

### E) API catalog (D-11804 — same commit as code)
- **`docs/ai/REFERENCE/api-endpoints.md`** — modified. Whole-row replace the
  `submitCompetitiveScore` `Library-only` row (`:216`) → a `Wired` `POST`
  `/api/competition/scores` row (Auth `authenticated-session-required`; request
  `{ replayHash }`; response `{ record, wasExisting }` / the locked error map;
  Authorizing WP `WP-332`), correcting that row's stale signature/return type. The
  `submitCompetitiveScoreImpl` / `listPlayerCompetitiveScores` library rows stay
  `Library-only` (the latter unwired — see Out of Scope).

---

## Out of Scope

- **Client integration.** Wiring `apps/arena-client` (or the play surface) to POST
  to this endpoint after a completed match is a separate WP — it crosses into the
  app layer. Until it lands, this endpoint exists but no user submits through it, so
  the public board still does not populate from real play. (This is why the WP's
  User-Visible Surface is `none — infrastructure`.)
- **`GET /api/me/scores`** (owner score history via `listPlayerCompetitiveScores`) —
  a separate read-endpoint WP; it is the surface the profile "Rank — coming soon"
  stub would consume. Left `Library-only`.
- **Rate limiting / abuse hardening.** Replay re-execution is CPU-bearing; a per-
  account rate limit (mirroring the analytics token bucket) is a follow-up hardening
  WP. Idempotency + authentication bound the risk for v1.
- **Any change to the submission library's logic, verification, scoring, or table.**
  WP-053's `competition.logic.ts` verification flow, `competition.types.ts`, and
  migration `007` are untouched (the wrapper is purely additive).
- **Leaderboard read endpoints / the snapshot publisher.** WP-115 / WP-142 are
  unchanged.
- **`201 Created` vs `200`.** The endpoint is idempotent; it returns `200` for both
  fresh and existing, with `wasExisting` distinguishing them. No 201 path.

---

## Files Expected to Change

- `apps/server/src/competition/competition.routes.ts` — **new** — submission route + registration
- `apps/server/src/competition/competition.routes.test.ts` — **new** — route drift + handler tests
- `apps/server/src/competition/competition.logic.ts` — **modified** — additive `submitCompetitiveScoreForRequest` wrapper
- `apps/server/src/competition/competition.logic.test.ts` — **modified** — wrapper delegation coverage
- `apps/server/src/server.mjs` — **modified** — import + `registerCompetitionRoutes(...)` wiring (01.5)
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — whole-row replace `submitCompetitiveScore` → `Wired` POST endpoint row
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — WP-332 row
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — EC-362 row
- `docs/ai/execution-checklists/EC-362-competitive-score-submission-endpoint.checklist.md` — **new**
- `docs/ai/work-packets/WP-332-competitive-score-submission-endpoint.md` — **new** — this file
- `docs/ai/STATUS.md` — **modified** (execution) — infrastructure-only entry
- `docs/ai/DECISIONS.md` — **modified** (execution) — D-24118

No other files may be modified. `competition.types.ts` and migration `007` are NOT
in the allowlist (additive wrapper needs no type/schema change).

---

## Contract

- **Endpoint:** `POST /api/competition/scores`, `authenticated-session-required`.
- **Request:** `{ "replayHash": string }` (non-empty). No other fields read.
- **Success (200):** `{ "record": CompetitiveScoreRecord, "wasExisting": boolean }`
  where `CompetitiveScoreRecord` is the 11-key shape from
  `competition.types.ts:140-152` (`submissionId, accountId, replayHash,
  scenarioKey, rawScore, finalScore, scoreBreakdown, parVersion,
  scoringConfigVersion, stateHash, createdAt`).
- **Errors:** the locked status map above; uniform `{ error: <code> }` envelope.
- **Idempotency:** re-POSTing the same `(account, replayHash)` returns `200` with
  `wasExisting: true` and the canonical record; never a duplicate row (DB
  `UNIQUE (player_id, replay_hash)`).
- **Identity:** the row's owner is the authenticated session's `AccountId`
  (resolved to `player_id` inside the library), never a client-supplied value.
- **New library export:** `submitCompetitiveScoreForRequest(identity, replayHash,
  database, { checkParPublished, registry }) => Promise<SubmissionResult>` — the
  production request-path entry that injects real deps.

---

## Acceptance Criteria

- [ ] `POST /api/competition/scores` is registered via `registerCompetitionRoutes`
      wired in `server.mjs`; `competition.routes.test.ts` asserts exactly one POST
      handler at the locked path.
- [ ] The handler sets `Cache-Control: no-store` as its first statement (asserted).
- [ ] An unauthenticated / invalid-session request returns `401 { error: <code> }`
      and never calls the submission library (asserted with a fake that would throw
      if called).
- [ ] A suspended account returns `403 { error: "forbidden" }` before submission.
- [ ] A missing/empty `replayHash` returns `400 { error: "invalid_request" }`.
- [ ] Each reachable `SubmissionRejectionReason` maps to its locked status
      (`replay_not_found`→404; `not_owner`/`visibility_not_eligible`→403;
      `par_not_published`/`replay_verification_failed`→422), body `{ error: <reason> }`.
- [ ] A successful fresh submission returns `200 { record, wasExisting: false }`;
      an idempotent retry returns `200 { record, wasExisting: true }`.
- [ ] A thrown error returns `500 { error: "internal_error" }` (asserted).
- [ ] `submitCompetitiveScoreForRequest` delegates to `submitCompetitiveScoreImpl`
      with the injected `checkParPublished` + `registry` and the real
      `loadReplay`/`replayGame`; the route never calls the inert
      `submitCompetitiveScore` wrapper (asserted / grepped).
- [ ] `competition.logic.ts` existing exports are byte-unchanged (additive only);
      `competition.types.ts` and migration `007` are unmodified.
- [ ] `docs/ai/REFERENCE/api-endpoints.md` has the whole `submitCompetitiveScore`
      row replaced with the `Wired` POST endpoint row (`Status`/`Auth` in the closed
      sets; canonical `replayHash`; Authorizing WP `WP-332`).
- [ ] No files outside `## Files Expected to Change` modified (`git diff --name-only`).

---

## Verification Steps

```pwsh
# Step 1 — build
pnpm -r build
# Expected: exits 0

# Step 2 — server tests (new + existing green)
pnpm --filter @legendary-arena/server test
# Expected: prior baseline + new competition.routes tests pass; 0 fail

# Step 3 — route registered exactly once at the locked path
Select-String -Path "apps\server\src\competition\competition.routes.ts" -Pattern "/api/competition/scores"
# Expected: 1 match (the router.post registration)

# Step 4 — the route does NOT call the inert wrapper
Select-String -Path "apps\server\src\competition\competition.routes.ts" -Pattern "submitCompetitiveScoreForRequest"
# Expected: >= 1 match (the production-logic delegate)
Select-String -Path "apps\server\src\competition\competition.routes.ts" -Pattern "PRODUCTION_DEPENDENCIES|submitCompetitiveScore\b(?!ForRequest)"
# Expected: no match (never the inert 3-arg wrapper / prod-deps)

# Step 5 — competition.logic.ts additive only (existing exports intact)
git diff apps/server/src/competition/competition.logic.ts
# Expected: only the new submitCompetitiveScoreForRequest export added; no existing lines changed

# Step 6 — server wiring present, single call
Select-String -Path "apps\server\src\server.mjs" -Pattern "registerCompetitionRoutes"
# Expected: 2 matches (import + one registration call)

# Step 7 — API catalog row flipped (no Library-only row left for submitCompetitiveScore)
Select-String -Path "docs\ai\REFERENCE\api-endpoints.md" -Pattern "POST.*\/api\/competition\/scores"
# Expected: 1 match, row Status = Wired

# Step 8 — scope
git diff --name-only
# Expected: matches Files Expected to Change
```

---

## Vision Alignment

**Vision clauses touched:** §3 (fairness / player identity — submission owner is the
authenticated account, never client-supplied), §18 (replays — submission is keyed
on the stored replay and re-executes it), §22 (skill measurement — server recomputes
the PAR score and verifies the state hash; the client's number is never trusted),
§24 (public leaderboards — this is the write path that feeds them).

**Conflict assertion:** No conflict: this WP preserves all touched clauses. It adds
no new scoring logic, no new identity model, and no new trust in client input — it
exposes the existing WP-053 verification pipeline over HTTP.

**Non-Goal proximity check:** NG-1..7 — none crossed. The endpoint is free,
account-gated by the existing auth model, introduces no paid surface, no
pay-to-win, no cosmetics, no data sale.

**Determinism preservation:** The endpoint's server-side acceptance re-executes the
replay via the engine's deterministic `replayGame` and requires
`computeStateHash(finalState) === replayHash` before recording (WP-053 flow,
unchanged). No new RNG, no wall-clock branching, no persistence of `G`/`ctx`.
Replay-faithful per Vision §22.

---

## Funding Surface Gate

**N/A** — this WP wires a competitive-score submission API endpoint. It touches no
global-navigation funding affordance (§A), no registry-viewer funding affordance
(§B), no profile/account funding-attribution surface (§C), no tournament
funding-channel integration, and adds no user-visible copy referencing "donate",
"support tournaments", or equivalent. It is a server-only data-write endpoint with
no funding surface. Authority: WP-097, D-9701, D-9801.

---

## API Catalog Update (§21 — D-11804)

**Triggered.** This WP adds a new `apps/server` HTTP endpoint AND changes the status
of the `Library-only` `submitCompetitiveScore` function reachable from
`apps/server/src/**`. At execution, `docs/ai/REFERENCE/api-endpoints.md` is updated
**in the same commit** as the code: the `submitCompetitiveScore` row (`:216`) is
replaced **whole** with a `Wired | POST | /api/competition/scores |
authenticated-session-required | { replayHash } | { record, wasExisting } (+ locked
error map) | WP-332 | ...` row. `Status`/`Auth` values are from the closed sets
(D-11801/D-9905). Canonical field names (`replayHash`, `accountId`, `scenarioKey`)
match `00.2-data-requirements.md`.

---

## Lint Gate Self-Review (00.3)

| § | Verdict | Notes |
|---|---------|-------|
| §1 Structure | PASS | All required sections present incl. Out of Scope (≥2 exclusions) |
| §2 Constraints | PASS | Engine-wide + packet-specific + session protocol + locked values; references 00.6; forbids partial output |
| §3 Assumes | PASS | WP-053/112/107/115 + inert-wrapper gotcha + table/build state all explicit |
| §4 Context | PASS | ARCHITECTURE.md, server SKILL, 00.2, 00.6, api-endpoints.md, VISION all cited with sections/lines |
| §5 Output | PASS | 11 files listed new/modified w/ descriptions; ≤8 code/doc files (governance excluded); bounded |
| §6 Naming | PASS | `replayHash`, `accountId`, `scenarioKey` per 00.2; no renamed fields |
| §7 Dependencies | PASS | No new npm deps; `pg.Pool` reused; forbidden packages N/A (none introduced) |
| §8 Boundaries | PASS | Server-layer only; no engine/registry mutation; `pg.Pool` not client; no DB in moves |
| §9 Windows | PASS | Verification uses `Select-String` / `pnpm` |
| §10 Env vars | N/A | No new env vars (reuses PAR_VERSION/registry/auth already wired) |
| §11 Auth | PASS | One model: `authenticated-session-required` via WP-112 `requireAuthenticatedSession`; protected endpoint states required credential; Limitations = guest/suspended rejected pre-submission |
| §12 Tests | PASS | `node:test`; injected fakes; no boardgame.io; no network/DB |
| §13 Commands | PASS | Exact `pnpm` + `Select-String` with expected output |
| §14 Acceptance | PASS | 11 binary, observable, file/function-referenced items aligned to scope |
| §15 Definition of Done | PASS | STATUS/DECISIONS/WORK_INDEX + scope-boundary + User-Visible Surface (`none — infrastructure`, STATUS must say so) |
| §16 Code style | PASS | Human-style; small handlers; `// why:` required (see EC); no premature abstraction |
| §17 Vision | PASS | §3/§18/§22/§24 cited; no conflict; NG check; determinism line present |
| §18 Prose-vs-grep | PASS | Step 4 greps a token also named in prose (`submitCompetitiveScoreForRequest`) — the grep EXPECTS ≥1 match, so prose does not falsify it; the negative grep uses a lookahead excluding `ForRequest` |
| §19 Bridge staleness | N/A | No repo-state-summarizing artifact authored |
| §20 Funding | N/A | Justified above: server-only data endpoint, no funding surface/copy |
| §21 API catalog | PASS | Triggered; whole-row replacement obligated in the impl commit (documented) |

**Pre-flight self-verdict:** READY TO EXECUTE — dependencies (WP-053/107/112/115)
all Done on `main`; scope locked; the two design seams (real-deps injection; auth
`AccountId`→`PlayerAccount`) are resolved in Scope/Contract; no ambiguity remains.

**Copilot self-check:** PASS — no cross-layer leak (server-only), no contract-file
edit, no determinism/persistence surface, additive library change, catalog
obligation captured, User-Visible Surface honestly `none — infrastructure`.

---

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/server test` exits 0 (new tests green, baseline preserved)
- [ ] `docs/ai/REFERENCE/api-endpoints.md` updated in the impl commit (whole-row replace; §21)
- [ ] `docs/ai/STATUS.md` updated — states "No user-observable change — infrastructure only" (surface = `none — infrastructure`), naming the payoff (unblocks leaderboard population once client integration lands)
- [ ] `docs/ai/DECISIONS.md` updated — D-24118 (endpoint contract: path/method/auth, real-deps injection, `{ error }` envelope + status map, idempotent-200, identity seam) flipped to Active
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-332 checked off with date
- [ ] No files outside `## Files Expected to Change` modified (`git diff --name-only`)
- [ ] 01.5 runtime-wiring: `server.mjs` edit limited to the import + one registration call
