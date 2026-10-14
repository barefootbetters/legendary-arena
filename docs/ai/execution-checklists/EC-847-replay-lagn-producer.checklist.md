# EC-847 — Replay-LAGN Producer + LAGN Writer Flip to 1.7.0 (Execution Checklist)

**Source:** docs/ai/work-packets/WP-810-replay-lagn-producer.md
**Layer:** Server (`apps/server`) + Shared Tooling writer flip (`packages/lagn-spec`) + docs

## Before Starting

- [ ] **WP-808 is `[x]`** and D-24714 is Active. If not, STOP — this packet is BLOCKED.
- [ ] You are in a fresh worktree off `origin/main`, the baseline is recorded, and every WP-810 Assumes line holds.
- [ ] `pnpm -r build` exits 0. Record the before-counts for lagn, server, and registry-viewer.
- [ ] Read the templates: `matchLagn.routes.ts` (`/result-lagn` + seam), `matchReplay.logic.ts` + its test's
  fixed-seed harness, `analytics.routes.ts` (the `now` + limiter pattern).

## Locked Values (do not re-derive)

- **Route.** `GET /api/match/:matchId/replay-lagn`, inside `registerMatchLagnRoutes`; auth `guest`. The first statement
  sets `Cache-Control: no-store`.
- **Clock.** `MatchLagnRouteDependencies` gains `readonly now?: () => number`.
- **Limiter.** In the register function: `const now = deps.now ?? (() => Date.now()); const rateLimiter =
  createTokenBucketRateLimiter({ capacity: 10, windowMs: 60_000, now });`.
  In the handler, before any read:
  `const { key } = resolveRateLimitKey(koaContext); if (rateLimiter.consume(key, 1) === false)` →
  `429 { error: 'rate_limited' }`. Process budget, move-weighted: `const exportBudget = createTokenBucketRateLimiter({
  capacity: 4000, windowMs: 60_000, now });`, spent **after** the artifact read as `moveCount` (`MAKE_MOVE` entries,
  min 1): `if (exportBudget.consume('process', moveCount) === false)` → `503 { error: 'at_capacity' }`.
- **Statuses** `{200, 404, 422, 429, 500, 503}`, body `{ error: <code> }`: `404 not_found` (empty id), `404 replay_not_found`
  (no artifact), `422 operator_match` (`G.isDebugMatch === true` or `Object.hasOwn(matchConfiguration,
  'isDebugMatch')`), `422 not_reexecutable` (misshaped seed / composition / `numPlayers`; any throw from
  `InitializeGame` or either reduction; an entry with no `action`; hash mismatch), `429 rate_limited`, `503 at_capacity`,
  `500 lagn_projection_failed`, `500 internal_error`.
- **Handler order:** (1) per-client limiter → id → `readReplayHashByMatchId` → `readReplayArtifactByHash` → process
  budget (`moveCount`); (2) shape check (all 9 composition fields typed, `finalBlow` absent or boolean,
  `numPlayers` 1–5, seed non-empty) → 422;
  (3) `base = buildMatchLagn(matchId, composition, numPlayers, resolveName)`; (4) `buildVerifiedReplayExecution(artifact,
  base.setup, numPlayers, logic.getBuildId())`; (5) the existing `/result-lagn` domain reads (reuse the step-1 replay hash); (6)
  `buildResultMatchLagn(..., toLagnResult(verified.gameover ?? null), ...)` + `replay = { execution }`; (7) `validate()`
  once → `200 { lagn }`.
- **`execution`:** `engine: 'legendary-arena'`; `engine_version: formatEngineVersion(getCurrentEngineVersion())`;
  `engine_build` = `getVersionInfo().gitSha` (omitted when `'unknown'`); `data_version: CURRENT_DATA_VERSION.version`;
  `seed: initialState.plugins.random.data.seed`; `moves` per `MAKE_MOVE` entry in order `{ seq: index, seat:
  Number(playerID), move_name: payload.type, args: structuredClone(payload.args), turn?, phase? }` — omit `turn` unless an integer ≥ 1,
  omit `phase` unless a string or null; `final_state_hash` = the verified hash.
- **Verify:** (1) operator check; (2) `setupData = toSetupDataFromLagnSetup(setup)` (9 fields, `shield_officers_count →
  officersCount`, + `finalBlow: true` when `final_blow === true`); (3) `InitializeGame({ game: { ...LegendaryGame, seed },
  numPlayers, setupData })`, re-dispatch `MAKE_MOVE { type: move_name, args, playerID: String(seat) }` through
  `CreateGameReducer({ game, isClient: false })`; (4) require equality with `reduceMatchToFinalState({ initialState, log
  }).stateHash`; (5) any throw in (2)–(4) → `not_reexecutable`; `extractExecutionMoves` runs inside that guarded block.
- **`replayLagn.logic.ts`** exports exactly `extractExecutionMoves`, `toSetupDataFromLagnSetup`, `readArtifactSeed`,
  `isOperatorArtifact`, `reexecuteFromSeed` (→ `{ finalState, finalContext, stateHash }`), and
  `buildVerifiedReplayExecution` (→ `{ isVerified: true, execution, gameover } | { isVerified: false, reason:
  'operator_match' | 'not_reexecutable' }`). Its code and comments never contain `bgio.matches`, `metadata`, or `.state`.
- **Seam.** `MatchLagnLogic` gains `readReplayArtifactByHash`, `buildVerifiedReplayExecution`, `getBuildId`.
- **Writer flip.** `LAGN_VERSION = LAGN_VERSION_1_7_0` and `package.json` `"version": "1.7.0"`, in the same commit. No
  `migrate.ts` change.
- **Verbatim text.** D-24716 Content, the ARCHITECTURE.md clause, and the rules-file parenthetical are copied verbatim
  from the WP.

## Guardrails

- Never emit `replay.execution` without the hash equality holding in the same request, and never compare against
  `replay_hash`.
- The server wires only: boardgame.io + engine exports. No move, phase, or turn logic is reimplemented.
- No table write, no cross-request cache, and nothing is ever read from `metadata`, `bgio.matches`, or `state`. The
  output is non-authoritative (D-5301 / D-24126).
- Every `setRegistryForSetup` in a test is paired with `clearRegistryForSetup` in `after()`.
- Tests manufacture with a FIXED seed (the CI-flake precedent), then rebuild through `readArtifactSeed` + plain
  `LegendaryGame`.
- Do not change the `/lagn` or `/result-lagn` read sources; the reaping bug is out of scope.
- Re-pin only the scaffold-observed writer / migration assertion class (titles and comments included). Any other lagn
  failure is STOP-and-report.

## Required `// why:` Comments

- **Verify-before-emit:** a fresh reduction, not the capture-time hash (engine-fidelity drift); it catches setup-time
  divergence, not a tampered log or move-processing drift (both sides share the moves and the build).
- **Durable source** (in `matchLagn.routes.ts`): the reaper deletes the live row about 1 hour after gameover; the
  artifact persists (D-24716).
- **`data_version`:** every stored artifact postdates the v2 bump. A future bump must migrate the artifacts or refuse
  pre-bump ones, because the hash cannot see a stale `args` shape (D-24716 §3).
- **`engine_build`:** the verifying build, not the build the match was played on.
- **Throws → `not_reexecutable`:** a stored config the current registry rejects is a refusal, not a server fault.
- **Seed-only rebuild:** `G` is never exported; `{ ...LegendaryGame, seed }` reproduces the minted initial state.
- **Limiters:** guest + CPU-bound (two reductions/request); `now` injected. Per-client first (no refund: the reverse
  order lets an over-limit client drain the global budget). The process budget is the hard bound because keys rotate
  under carrier NAT (D-24635 §3 + follow-up). It is move-weighted, so it bounds CPU, not count.
- **`operator_match`:** checked before re-execution (D-24689 §1, D-24714).
- **`LAGN_VERSION` doc comment:** 1.7.0 as of WP-810; ordinal gates make the restamp safe (D-24211).

## Files to Produce

- `packages/lagn-spec/src/validator.ts`, `package.json`, `validator.test.ts` — **modified** (flip + re-pins)
- `apps/server/src/match/`: `replayLagn.logic.ts` + `.test.ts` **new**; `matchLagn.routes.ts` + `.test.ts` **modified**;
  `matchLagn.logic.ts` **modified** (doc comments only)
- `apps/registry-viewer/src/composables/useLoadoutLagnExport.ts` and `useLoadoutLagnExport.test.ts` — **modified**
  (comments only)
- `docs/ai/ARCHITECTURE.md`, `.claude/rules/architecture.md` — **modified** (D-24716 lockstep; replace the D-24689
  clause's final period)
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** (1 new row + 3 whole-row replacements)
- `wiki/lagn-v1.md` and `docs/ai/REFERENCE/00.2-data-requirements.md` — **modified**

## After Completing

- [ ] `pnpm -r build` exits 0. lagn, server, and registry-viewer have 0 failures. `registry-viewer typecheck` exits 0.
  `pnpm -r --no-bail test` shows no new failures.
- [ ] AC-1..AC-9 output is pasted, and the `Select-String` check on `replayLagn.logic.ts` comes back empty.
- [ ] WP-808 is deployed to the cards and legends sites (they accept a 1.7.0 `?lagn=`) **before** this PR merges.
- [ ] D-24716 is Active, plus the "Amended by D-24716 §3" pointer on D-24714. STATUS reads: "No user-observable change —
  infrastructure only (new guest API endpoint)".
- [ ] WORK_INDEX `[x]`; EC_INDEX Done; mindmap `📝 → ✅`; `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0.
- [ ] `git diff --name-only` = Files to Produce + governance.
- [ ] Before merge: the ms-per-request + move-count measurement on a real long prod artifact (read-only, local) is
  recorded in D-24716 §5; STOP if `ms_per_move × 2 × 4000 > 6000 ms` or any recent artifact exceeds 4000 moves.
- [ ] Post-deploy (with Jeff): one observed prod `200` with `replay.execution` for a post-deploy match, plus the 200/422
  sample split.

## Common Failure Smells

- **Every round trip fails.** The rebuild used `matchConfiguration` instead of `base.setup`, dropped `finalBlow`, or got
  `numPlayers` wrong.
- **Every request returns 500.** The limiter was built without `now`.
- **The limit trips across routes.** The bucket is module-scoped instead of route-local.
- **422 on a valid match only in CI.** The harness is unseeded (flaky deck order), or the registry was not set for setup.
- **`validate()` fails at 200.** The writer flip is missing, so the 1.7.0 gate rejects `replay.execution`.
- **The `Select-String` check trips.** A comment in `replayLagn.logic.ts` names `metadata` or `bgio.matches`; move the
  rationale to the routes file.
