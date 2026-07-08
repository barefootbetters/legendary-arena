# EC-362 — Competitive Score Submission HTTP Endpoint (Execution Checklist)

**Source:** docs/ai/work-packets/WP-332-competitive-score-submission-endpoint.md
**Layer:** Server (`apps/server/**`)

## Before Starting
- [ ] WP-053 Done — `submitCompetitiveScoreImpl` + `submitCompetitiveScore` + types shipped
- [ ] WP-112 Done — `requireAuthenticatedSession` + `verifier` + `accountResolver` wired in `server.mjs`
- [ ] WP-107 Done — `requireUnsuspendedAccount` present (fail-closed, unwired)
- [ ] WP-115 Done — `leaderboard.routes.ts` precedent available
- [ ] `pnpm install` exits 0; `pnpm -r build` exits 0
- [ ] Target file set is EXACTLY the WP `Files Expected to Change` allowlist — any file outside it is a FAIL

## Locked Values (do not re-derive)
- Method + path: `POST /api/competition/scores`
- Auth: `authenticated-session-required`
- Request body: `{ "replayHash": string }` (non-empty)
- Success (200) body: `{ "record": CompetitiveScoreRecord, "wasExisting": boolean }`
- Status map: `200` success; `400 {error:"invalid_request"}` bad body;
  `401 {error:<SessionValidationCode>}` session; `403 {error:"forbidden"}` suspended;
  `404 {error:"replay_not_found"}`; `403 {error:<reason>}` not_owner / visibility_not_eligible;
  `422 {error:<reason>}` par_not_published / replay_verification_failed;
  `500 {error:"internal_error"}` thrown
- Status-code domain: `{200, 400, 401, 403, 404, 422, 500}`
- Envelope: uniform `{ error: <code> }` for every non-success path
- Registration seam: `registerCompetitionRoutes(router, database, deps, competitionLogic = PRODUCTION_COMPETITION_LOGIC)`
- Handler gate order: Cache-Control → session → unsuspended → body validate → construct PlayerAccount → submit
- Reserves D-24118

## Guardrails
- Route calls `submitCompetitiveScoreForRequest` (real `checkParPublished` + `registry`); NEVER the inert `submitCompetitiveScore` 3-arg wrapper (rejects all with `par_not_published`)
- `competition.logic.ts` is ADDITIVE ONLY — every existing export byte-identical; `competition.types.ts` + migration `007` untouched
- `Cache-Control: no-store` is the literal FIRST statement of the handler (incl. error paths)
- Guest / suspended / unauthenticated never reach the library; `guest_not_eligible` is structurally unreachable (expected)
- Row owner = session `AccountId`, never client-supplied; `pg.Pool` reused, never a fresh client
- `server.mjs` edit = import + one `registerCompetitionRoutes(...)` call ONLY (01.5)
- No new npm deps; no `Math.random` / wall-clock; no engine/registry mutation
- API catalog (`api-endpoints.md`) whole-row replaced in the SAME commit (D-11804; partial-update = FAIL)

## Required `// why:` Comments
- `competition.routes.ts` Cache-Control first-statement: why it precedes auth (D-11504)
- `competition.routes.ts` 401-not-403 for unknown account: why (account-existence-probe defense)
- `competition.routes.ts` construct-PlayerAccount step: why guest branch is unreachable on an authenticated route
- `competition.logic.ts` new wrapper: why real `checkParPublished`/`registry` are injected (inert wrapper fail-closes)

## Files to Produce
- `apps/server/src/competition/competition.routes.ts` — **new** — route + `registerCompetitionRoutes`
- `apps/server/src/competition/competition.routes.test.ts` — **new** — drift + handler tests (fakes)
- `apps/server/src/competition/competition.logic.ts` — **modified** — additive `submitCompetitiveScoreForRequest`
- `apps/server/src/competition/competition.logic.test.ts` — **modified** — wrapper delegation coverage
- `apps/server/src/server.mjs` — **modified** — import + registration (01.5)
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — whole-row replace `submitCompetitiveScore` → Wired POST row
- `docs/ai/DECISIONS.md` — **modified** — D-24118

## After Completing
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/server test` exits 0 (new tests green; baseline preserved)
- [ ] Route drift test asserts exactly one POST handler at the locked path
- [ ] Grep: `submitCompetitiveScore\b(?!ForRequest)` / `PRODUCTION_DEPENDENCIES` absent from `competition.routes.ts`
- [ ] `git diff apps/server/src/competition/competition.logic.ts` shows ONLY the added export
- [ ] API catalog row flipped `Library-only` → `Wired` (same commit)
- [ ] `docs/ai/STATUS.md` states "No user-observable change — infrastructure only" (+ payoff)
- [ ] `docs/ai/DECISIONS.md` D-24118 Active
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date
- [ ] `git diff --name-only` == allowlist

## Common Failure Smells (Optional)
- Every submission returns `422 par_not_published` → the route called the inert `submitCompetitiveScore` wrapper instead of `submitCompetitiveScoreForRequest`
- `guest_not_eligible` surfacing at runtime → identity was not constructed as a non-guest `PlayerAccount` from the session `AccountId`
- Route-count test green but suspension untested → `requireUnsuspendedAccount` not wired (WP-107's designated first caller)
