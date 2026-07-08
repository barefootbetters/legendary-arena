# WP-336 — Competitive Verifier Repoint onto the Faithful Reducer Path (WP-3b)

**Status:** Draft — Ready to execute (pending operator review)
**Primary Layer:** Server (`apps/server/**`)
**Dependencies:** D-24119 (arc), D-24121 (WP-3 owns the mapping + the deferred repoint), D-24122 (capture + `bgio.replay_artifacts`), WP-334 (`reduceMatchToFinalState`), WP-335 (`bgio.replay_artifacts` + capture), WP-332 (the submission endpoint), WP-053 (the verifier being repointed)
**EC:** EC-366
**Baseline:** `origin/main` at `ab9a3ed8` (2026-07-08)
**User-Visible Surface:** none — infrastructure
**Reserves:** D-24123

---

## Goal

After this packet, the WP-053 competitive submission verifier re-executes a
submitted `{ replayHash }` on the **faithful reducer path**: it reads the durable
`bgio.replay_artifacts` row (WP-335) by `replay_hash`, `reduceMatchToFinalState`s it
(WP-334), verifies the hash, and scores it — instead of the old
`loadReplay`(`replay_blobs`)→`replayGame`(determinism-only harness) path that
live-captured matches never populate. Critically, it feeds `deriveScoringInputs` the
**calibration-correct rounds = turn count** (the reduced match's turn count),
matching how the PAR baselines were built — so competitive `finalScore`s are on the
right scale from the first live submission. This is WP-3b of the arc; it makes the
capture→submit→score chain functional end-to-end at the server (the arena-client
submit + `listAccountReplays` surface remain WP-5).

---

## Assumes

- **D-24119/24121/24122 Active; WP-334/335/332/053 Done.**
- **WP-335 Done** — `bgio.replay_artifacts (replay_hash PK, match_id, scenario_key,
  initial_state, log, captured_at)` (migration 025) is populated by the capture
  harvester for each finished match, and `assignReplayOwnership` has recorded
  `legendary.replay_ownership` rows per authenticated seat (keyed on `replay_hash`).
- **WP-334 Done** — `reduceMatchToFinalState({ initialState, log }) → { finalState,
  stateHash }` re-executes via boardgame.io's reducer (from the persisted
  `initialState`, skipping automatic entries); the reduced boardgame.io state carries
  `ctx.turn` (currently discarded — the reducer returns only `state.G`).
- **WP-053 verifier** — `apps/server/src/competition/competition.logic.ts`
  `submitCompetitiveScoreImpl` steps 7-9 today: `loadReplay(replayHash)` (a
  `ReplayInput` from `legendary.replay_blobs`) → `replayGame(input, registry)`
  (engine determinism-only harness) → `computeStateHash` compare. The
  `SubmissionDependencies` seam is `{ loadReplay, replayGame, checkParPublished,
  registry }`; `submitCompetitiveScoreForRequest` (WP-332 production entry) wires it.
- **The scoring calibration (the load-bearing fact, D-24123 decision):** PAR baselines
  (`ScenarioScoringConfig.parBaseline` / `parValue`) were calibrated by
  `packages/game-engine/src/simulation/par.aggregator.ts` with **`rounds = turnCount`**
  (its `turnsElapsed`, incremented per `endTurn`; `deriveScoringInputsFromFinalState`
  passes `turnCount`). The runtime verifier's `deriveScoringInputs`
  (`parScoring.logic.ts`) reads `replayResult.moveCount` into the `rounds` slot
  (D-4801 MVP proxy). No live competitive score has ever been persisted (the path is
  inert — capture writes `bgio.replay_artifacts`, but step-7 `loadReplay` reads the
  never-populated `replay_blobs`), so there is no history to shift — but this WP is
  the first to make the path live and must feed the calibration-correct turn count.
- `pnpm install && pnpm -r build` exits 0 on `main`; the `apps/server` suite passes
  its baseline (DB-dependent tests skip without `TEST_DATABASE_URL`).

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `docs/ai/DECISIONS.md` D-24119 (arc), D-24121 (mapping + repoint deferral),
  D-24122 (capture + artifact store), D-4801 (the `moveCount`-as-rounds MVP proxy this
  WP reconciles), D-5301 (server verifies, not trusts).
- `apps/server/src/competition/competition.logic.ts` — the verifier + the deps seam +
  `submitCompetitiveScoreForRequest`.
- `apps/server/src/competition/competition.logic.test.ts` (the deps-injection fixtures
  + the D-5304 retry spies) and `apps/server/src/leaderboards/leaderboard.logic.test.ts`
  (seeds fixtures via `submitCompetitiveScoreImpl` with the same seam) — both migrate.
- `apps/server/src/replay/matchReplay.logic.ts` (`reduceMatchToFinalState`,
  `readMatchForReplay`) — extended here.
- `packages/game-engine/src/scoring/parScoring.logic.ts` (`deriveScoringInputs`
  reads `replayResult.moveCount` as `rounds`) and
  `packages/game-engine/src/simulation/par.aggregator.ts` (`turnsElapsed` /
  `turnCount` — the calibration source to reconcile against). **Read-only — the
  engine is NOT edited in this WP (B1, engine-clean).**
- `apps/server/src/competition/competition.routes.ts` + `apps/server/src/server.mjs`
  (the `CompetitiveSubmissionProductionDependencies` wiring — `registry` is dropped).
- `docs/ai/REFERENCE/00.6-code-style.md`; `.claude/skills/legendary-server/SKILL.md`.
- `docs/01-VISION.md` §22 (replay-verified competitive integrity).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- ESM only, Node v22+. Human-style code (00.6). Full file contents. Test files
  `.test.ts`; `node:test`; DB-dependent tests use the non-silent skip. Full-sentence
  error messages.

**Packet-specific:**
- **Rounds = turn count (D-24123), fed engine-clean.** `reduceMatchToFinalState`
  additionally returns `turnCount` (the reduced match's turn count, from the reduced
  `ctx.turn`), and the verifier passes it into `deriveScoringInputs`'s existing
  `rounds` slot (the `ReplayResult.moveCount` field). The engine's
  `deriveScoringInputs` / `parScoring.logic.ts` is **NOT edited** — it keeps reading
  `replayResult.moveCount`, now fed the turn count. The overloaded field name is
  documented with a `// why:` at the synthesis site (the honest engine-side proxy
  cleanup — retiring the `moveCount` name — is deferred to WP-4 per the operator
  decision).
- **turnCount MUST reconcile to the PAR calibration.** The `turnCount`
  `reduceMatchToFinalState` returns MUST equal `par.aggregator.ts`'s `turnsElapsed`
  for the same match (accounting for the lobby-is-boardgame.io-turn-1 offset — play
  turns only). This is a **scaffold-verify gate** (per `01.4 §Empirical Scaffold`):
  before finalizing, reduce a match AND simulate the same setup, and confirm the
  reduced `turnCount` equals the sim's `turnsElapsed` (or document the exact
  derivation, e.g. `ctx.turn − lobbyTurnOffset`, and why it matches). Do NOT guess the
  formula — verify it, because it sets the scale of every competitive score.
- **The verifier reads `bgio.replay_artifacts` by `replay_hash`, not `replay_blobs`.**
  A new `readReplayArtifactByHash(replayHash, db) → { initialState, log } | null` +
  a composed `reduceReplayByHash(replayHash, db) → { finalState, stateHash, turnCount }
  | null` (both in `matchReplay.logic.ts`) replace the `loadReplay`+`replayGame` deps.
- **`registry` is dropped** from `SubmissionDependencies` +
  `CompetitiveSubmissionProductionDependencies` + the route/`server.mjs` wiring — the
  reducer needs no `CardRegistryReader` (card resolution is baked into the persisted
  `initialState`).
- **Steps 1-6 (guest / ownership / owner / visibility / idempotency fast-path / PAR
  gate) are UNCHANGED** — they read `legendary.replay_ownership` (WP-335 capture
  populates it) + `checkParPublished`. **Step 9 hash-compare is KEPT** as an
  artifact-integrity + lookup-consistency anti-tamper check (`reduced.stateHash ===
  submittedReplayHash`). Steps 10-14 scoring are unchanged except for the rounds
  source. The D-5304 idempotency + no-throw-for-expected-failure contract is preserved
  (a missing artifact → `replay_verification_failed`, mirroring the old null-`loadReplay`).
- **`replay_blobs` / `storeReplay` / `loadReplay` (WP-103) are NOT deleted** — only
  unwired from the verifier; they remain for their own tests + the offline
  replay-producer path. No engine edit; no determinism fixture re-pin; no
  `computeStateHash` change.
- No new npm dependency; `pg.Pool` reused; no `Math.random`.

**Session protocol:**
- If the turnCount↔turnsElapsed reconciliation is unclear, STOP and scaffold-verify
  against a simulated match — never ship an unverified rounds formula.

**Locked contract values:**
- Endpoint unchanged: `POST /api/competition/scores`, `authenticated-session-required`,
  request `{ replayHash }`, response `{ record, wasExisting }`, status map unchanged.
- `MatchReplayResult` gains `turnCount: number` (additive).
- `reduceMatchToFinalState({ initialState, log }) → { finalState, stateHash, turnCount }`.
- `readReplayArtifactByHash(replayHash, db) → { initialState, log } | null`
  (`SELECT initial_state, log FROM bgio.replay_artifacts WHERE replay_hash = $1`).
- `reduceReplayByHash(replayHash, db) → { finalState, stateHash, turnCount } | null`.
- `SubmissionDependencies` = `{ reduceReplay, checkParPublished }` (drops `loadReplay`,
  `replayGame`, `registry`); `reduceReplay: (replayHash, db) => Promise<{ finalState,
  stateHash, turnCount } | null>`.
- Rounds fed to `deriveScoringInputs` = `turnCount` (via the `ReplayResult.moveCount`
  slot; engine unedited).

---

## Scope (In)

### A) Reducer: return turnCount + the artifact reader
- **`apps/server/src/replay/matchReplay.logic.ts`** — modified. (1) `reduceMatchToFinalState`
  additionally returns `turnCount` (reconciled to `par.aggregator` `turnsElapsed`;
  from the reduced `ctx.turn` minus the lobby-turn offset, verified). `MatchReplayResult`
  gains `turnCount` (additive; the existing WP-335 destructure `{ finalState, stateHash }`
  is unaffected). (2) `readReplayArtifactByHash(replayHash, db)` — the `bgio.replay_artifacts`
  read. (3) `reduceReplayByHash(replayHash, db)` — composes the two (null when the
  artifact is absent).

### B) Verifier repoint
- **`apps/server/src/competition/competition.logic.ts`** — modified. `SubmissionDependencies`
  becomes `{ reduceReplay, checkParPublished }` (drop `loadReplay`/`replayGame`/`registry`;
  `PRODUCTION_DEPENDENCIES` + `submitCompetitiveScoreForRequest` +
  `CompetitiveSubmissionProductionDependencies` updated). Steps 7-8 → `const reduced =
  await deps.reduceReplay(replayHash, database); if (reduced === null) return
  replay_verification_failed;`. Step 9 → `reduced.stateHash !== replayHash → fail`.
  Step 10 → `deriveScoringInputs({ finalState: reduced.finalState, stateHash:
  reduced.stateHash, moveCount: reduced.turnCount }, reduced.finalState)` (turnCount in
  the rounds slot; `// why:` documents the overload). Remove the `loadReplay`/`replayGame`
  engine imports.

### C) Wiring
- **`apps/server/src/competition/competition.routes.ts`** + **`apps/server/src/server.mjs`**
  — modified. `CompetitiveSubmissionProductionDependencies` loses `registry`; the route
  passes `{ reduceReplay: reduceReplayByHash, checkParPublished: parGate.checkParPublished }`;
  `server.mjs` drops `registry` from the `registerCompetitionRoutes` deps (01.5 wiring).

### D) Tests
- **`apps/server/src/replay/matchReplay.logic.test.ts`** — modified. The faithfulness
  golden additionally asserts `turnCount` is returned + equals the expected turn count
  (scaffold-verified against a sim); a DB-gated `readReplayArtifactByHash` /
  `reduceReplayByHash` round-trip against a seeded `bgio.replay_artifacts` row.
- **`apps/server/src/competition/competition.logic.test.ts`** — modified. Migrate the
  deps-injection fixtures + the D-5304 retry spies from `{ loadReplay, replayGame, … }`
  to `{ reduceReplay, checkParPublished }`; assert the score uses `turnCount` as rounds.
- **`apps/server/src/leaderboards/leaderboard.logic.test.ts`** — modified. Migrate the
  fixture-seed deps to the new seam.

### E) API catalog (§21)
- **`docs/ai/REFERENCE/api-endpoints.md`** — modified. Update the `POST /api/competition/scores`
  row (verifier now reads `bgio.replay_artifacts` + reducer path; request/response/status
  unchanged) and the `reduceMatchToFinalState` Library-only row (now returns `turnCount`);
  add Library-only rows for `readReplayArtifactByHash` + `reduceReplayByHash`.

---

## Out of Scope

- **The engine-side `moveCount`-proxy cleanup** (renaming/retiring `moveCount` in
  `deriveScoringInputs` to read turns from `G` directly, D-4801) — deferred to WP-4 per
  the operator decision; this WP keeps the engine untouched and passes turn count via
  the existing slot.
- **`computeStateHash` messages/logMeta reconciliation** — WP-4; non-blocking (capture
  + verify share the reducer over the same artifact).
- **The arena-client submit-after-match + `listAccountReplays` HTTP surface** — WP-5.
- **Deleting `replay_blobs`/`storeReplay`/`loadReplay`** — a separate dead-code sweep;
  they stay for the offline replay-producer + their own tests.
- **Any change to the endpoint contract, the ownership/visibility/PAR gates, or the
  idempotency semantics.**

---

## Files Expected to Change

- `apps/server/src/replay/matchReplay.logic.ts` — **modified** — `turnCount` + `readReplayArtifactByHash` + `reduceReplayByHash`
- `apps/server/src/replay/matchReplay.logic.test.ts` — **modified**
- `apps/server/src/competition/competition.logic.ts` — **modified** — seam swap + steps 7-10 repoint
- `apps/server/src/competition/competition.logic.test.ts` — **modified**
- `apps/server/src/leaderboards/leaderboard.logic.test.ts` — **modified**
- `apps/server/src/competition/competition.routes.ts` — **modified** — deps (drop `registry`, add `reduceReplay`)
- `apps/server/src/server.mjs` — **modified** — `registerCompetitionRoutes` wiring (01.5)
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — endpoint row + Library-only rows (§21)
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — WP-336 row
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — EC-366 row
- `docs/ai/execution-checklists/EC-366-competitive-verifier-repoint.checklist.md` — **new**
- `docs/ai/work-packets/WP-336-competitive-verifier-repoint.md` — **new** — this file
- `docs/ai/STATUS.md` — **modified** (execution) — infrastructure-only entry
- `docs/ai/DECISIONS.md` — **modified** (execution) — D-24123

No other files. **Engine (`packages/**`) is NOT modified** (B1, engine-clean).

---

## Contract

- `reduceMatchToFinalState(...) → { finalState, stateHash, turnCount }` (turnCount
  reconciled to `par.aggregator` `turnsElapsed`).
- `readReplayArtifactByHash(replayHash, db) → { initialState, log } | null`;
  `reduceReplayByHash(replayHash, db) → { finalState, stateHash, turnCount } | null`.
- `SubmissionDependencies = { reduceReplay, checkParPublished }`.
- The verifier scores a live-captured replay off the reduced `finalState` + `turnCount`;
  the endpoint contract + gates + idempotency are unchanged.

---

## Acceptance Criteria

- [ ] `reduceMatchToFinalState` returns `turnCount`; a scaffold-verify confirms it
      equals `par.aggregator`'s `turnsElapsed` for a representative match (the exact
      derivation documented).
- [ ] `readReplayArtifactByHash` reads `bgio.replay_artifacts` by `replay_hash`
      (returns `null` when absent); `reduceReplayByHash` composes read + reduce
      (`null` when the artifact is absent).
- [ ] `SubmissionDependencies` is `{ reduceReplay, checkParPublished }` — `loadReplay`,
      `replayGame`, and `registry` are gone; the engine `replayGame`/`loadReplay`
      imports are removed from `competition.logic.ts`.
- [ ] Steps 1-6 (ownership/owner/visibility/idempotency/PAR) unchanged; step 9
      hash-compare kept (`reduced.stateHash === replayHash`); a missing artifact →
      `replay_verification_failed`.
- [ ] `deriveScoringInputs` is fed `turnCount` as rounds (via the `moveCount` slot);
      the engine (`parScoring.logic.ts`) is NOT edited.
- [ ] `registry` is dropped from `CompetitiveSubmissionProductionDependencies` + the
      route + `server.mjs` wiring.
- [ ] `competition.logic.test.ts` + `leaderboard.logic.test.ts` migrated to the new
      seam and green; a test asserts the score uses `turnCount` as rounds.
- [ ] Engine untouched (`git diff --name-only packages/` empty); no `computeStateHash`
      change; no determinism fixture re-pin.
- [ ] `docs/ai/REFERENCE/api-endpoints.md` updated (endpoint row + Library-only rows).
- [ ] No files outside `## Files Expected to Change` modified.

---

## Verification Steps

```pwsh
# Step 1 — build
pnpm -r build
# Expected: exits 0

# Step 2 — server tests (repoint + migrated fixtures; DB tests skip without TEST_DATABASE_URL)
pnpm --filter @legendary-arena/server test
# Expected: baseline preserved + migrated; new matchReplay turnCount + reduceReplayByHash tests pass

# Step 3 — verifier reads the artifact table, not replay_blobs
Select-String -Path "apps\server\src\competition\competition.logic.ts" -Pattern "loadReplay|replayGame|replay_blobs"
# Expected: no match (the old path is gone)
Select-String -Path "apps\server\src\competition\competition.logic.ts" -Pattern "reduceReplay"
# Expected: >= 1 match

# Step 4 — rounds = turnCount; engine unedited
Select-String -Path "apps\server\src\competition\competition.logic.ts" -Pattern "turnCount"
# Expected: >= 1 match (fed into the rounds slot)
git diff --name-only packages/
# Expected: no output (engine untouched)

# Step 5 — registry dropped from the competition deps
Select-String -Path "apps\server\src\competition\competition.logic.ts" -Pattern "registry"
# Expected: no match in SubmissionDependencies (registry removed)

# Step 6 — scope
git diff --name-only
# Expected: matches Files Expected to Change
```

---

## Vision Alignment

**Vision clauses touched:** §22 (Scoring & Skill Measurement — this makes the
faithful, replay-verified competitive score functional end-to-end, and pins the
rounds input to the same turn count the PAR baselines were calibrated with, so scores
are meaningful).

**Conflict assertion:** No conflict: this WP preserves §22. It corrects the rounds
source to the calibration-correct turn count (no live score exists to shift) and
keeps the server-verifies-not-trusts model (D-5301): the server re-reduces the
persisted match and re-derives the score; it never trusts a client number.

**Non-Goal proximity check:** NG-1..7 — none crossed. No paid surface, no user-facing
change, no pay-to-win.

**Determinism preservation:** The verifier re-reduces via the framework-seeded
`reduceMatchToFinalState` (WP-334) — deterministic, replay-faithful. No RNG sourcing
change, no engine edit, no `computeStateHash` change. The `turnCount` is a
deterministic function of the reduced state. Replay-verified per Vision §22.

---

## Funding Surface Gate

**N/A** — server-side scoring-verification wiring. No global-nav / registry / profile
funding affordance, no tournament funding channel, no user-visible funding copy.
Authority: WP-097, D-9701, D-9801.

---

## API Catalog Update (§21 — D-11804)

**Triggered** (the `POST /api/competition/scores` behavior changes — the verifier now
reads `bgio.replay_artifacts` + the reducer path — and library functions are
added/changed). At execution, `docs/ai/REFERENCE/api-endpoints.md` is updated in the
impl commit: the `POST /api/competition/scores` row's Notes reflect the faithful
verifier path (request/response/status/auth unchanged); the `reduceMatchToFinalState`
Library-only row notes the added `turnCount`; new Library-only rows for
`readReplayArtifactByHash` + `reduceReplayByHash`. Closed-set `Status`/`Auth` values
preserved; canonical `replayHash`/`scenarioKey` names.

---

## Lint Gate Self-Review (00.3)

| § | Verdict | Notes |
|---|---------|-------|
| §1 Structure | PASS | All required sections incl. Out of Scope (≥2 exclusions) |
| §2 Constraints | PASS | Engine-wide + packet-specific + session protocol + locked values; 00.6; no partial output |
| §3 Assumes | PASS | WP-334/335/332/053 + the PAR-calibration (rounds=turnCount) fact explicit |
| §4 Context | PASS | DECISIONS + competition.logic + matchReplay + parScoring/par.aggregator + routes/server + SKILL cited |
| §5 Output | PASS | 8 code/test/doc files + governance; bounded; engine excluded |
| §6 Naming | PASS | `replayHash`/`scenarioKey`/`turnCount` consistent; canonical names |
| §7 Dependencies | PASS | No new npm dep; `pg.Pool` reused; forbidden packages N/A |
| §8 Boundaries | PASS | Server-only; engine untouched (B1); reads bgio.replay_artifacts (D-24095 carve-out); no DB in moves |
| §9 Windows | PASS | `Select-String` / `pnpm` |
| §10 Env vars | N/A | No new env vars |
| §11 Auth | PASS | Endpoint stays `authenticated-session-required` (WP-332); gates unchanged; the verifier change is internal |
| §12 Tests | PASS | `node:test`; scaffold-verify for turnCount; DB-gated read; migrated seam fixtures; no boardgame.io import in tests |
| §13 Commands | PASS | Exact `pnpm` + `Select-String` w/ expected output |
| §14 Acceptance | PASS | 10 binary, observable, referenced items |
| §15 Definition of Done | PASS | STATUS/DECISIONS/WORK_INDEX + scope-boundary + User-Visible Surface (`none — infrastructure`) |
| §16 Code style | PASS | Small functions; `// why:` on the turnCount-in-moveCount-slot overload + the artifact read; no premature abstraction |
| §17 Vision | PASS | §22 cited; no conflict; determinism-preservation line present |
| §18 Prose-vs-grep | PASS | Step 3/5 greps (`loadReplay`/`replayGame`/`replay_blobs`/`registry` expect zero; `reduceReplay`/`turnCount` expect ≥1) — prose usage intended; the zero-expects are the removal proof |
| §19 Bridge staleness | N/A | No repo-state-summarizing artifact |
| §20 Funding | N/A | Justified: server scoring-verification wiring, no funding surface |
| §21 API catalog | PASS | Triggered; endpoint row + Library-only rows obligated in the impl commit |

**Pre-flight self-verdict:** READY — deps Done/Active on `main`; the load-bearing
rounds-source decision is made (D-24123 = turn count, B1 engine-clean); scope locked;
the turnCount↔turnsElapsed reconciliation is a mandatory scaffold-verify gate (not a
guess); the seam swap + registry-drop + test migrations are enumerated. No ambiguity.

**Copilot self-check:** PASS — server-only, engine untouched, the scoring-scale
decision is explicit + operator-ratified (D-24123), the calibration reconciliation is
a hard scaffold-verify gate, catalog obligation captured, User-Visible Surface
`none — infrastructure`.

---

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/server test` exits 0 (repoint + migrated fixtures green; DB-gated verified locally where feasible; baseline preserved)
- [ ] The turnCount↔`turnsElapsed` reconciliation is scaffold-verified and documented (not guessed)
- [ ] `docs/ai/REFERENCE/api-endpoints.md` updated in the impl commit (§21)
- [ ] `docs/ai/STATUS.md` updated — states "No user-observable change — infrastructure only"; names the payoff (the capture→submit→score chain is functional end-to-end at the server; scores use the calibration-correct turn count)
- [ ] `docs/ai/DECISIONS.md` updated — D-24123 (rounds = turn count via B1 engine-clean field-slot; `reduceReplay` seam; `registry` dropped; the engine-proxy cleanup deferred to WP-4) flipped to Active
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-336 checked off with date
- [ ] No files outside `## Files Expected to Change` modified (`git diff --name-only`); engine untouched
