# WP-337 — Retire the `moveCount`-as-Rounds Proxy: Turns-Native Competitive Scoring (WP-4)

**Status:** Done (executed 2026-07-08)
**Primary Layer:** Game Engine (`packages/game-engine/**`) + Server (`apps/server/**`, mechanical)
**Dependencies:** D-24119 (arc), D-24123 (WP-336 fed turn count via the `moveCount` slot; this retires the slot), D-24124 (reduction faithful → live==replay hashes already agree), D-4801 (the MVP proxy this resolves), WP-336 (verifier already passes `turnCount`)
**EC:** EC-367
**Baseline:** `origin/main` at `790c0184` (2026-07-08)
**User-Visible Surface:** none — infrastructure
**Reserves:** D-24125

---

## Goal

Retire the D-4801 MVP proxy in which `deriveScoringInputs` reads
`ReplayResult.moveCount` (player move count) as the competitive `rounds` input.
Rename `ReplayResult.moveCount` → `turnCount` and make it carry the **completed
play-turn count** (matching `reduceMatchToFinalState` (WP-336) and
`par.aggregator`'s `turnsElapsed` — the quantity the PAR baselines were calibrated
with). After this, `rounds` is turns-native on **every** scoring path: the server
verifier (WP-336, already passing `turnCount`) stops overloading a field named
`moveCount`, and the offline replay-producer harness (`replayGame`) produces a real
turn count instead of a move count. Also resolve the `computeStateHash` field-set
"landmine" as an intentional-design clarification (per the operator decision): the
competitive/determinism hash **intentionally** covers the full `G` (a stronger,
tamper-evident ownership PK; live == replay is already guaranteed by D-24124), so
`computeStateHash` is NOT changed — only the stale `game.ts` comment claiming
`logMeta` is hash-excluded is corrected.

---

## Assumes

- **D-24123 + D-24124 Active; WP-336 Done.** The server verifier
  (`competition.logic.ts`) already computes `rounds` from a turn count — it builds a
  `ReplayResult`-shaped view `{ finalState, stateHash, moveCount: reduced.turnCount }`
  and feeds it to `deriveScoringInputs`. This WP removes that field-name overload.
- **`ReplayResult.moveCount` is used ONLY as the rounds proxy.** It is produced only
  at `replay.execute.ts:234` (`moveCount: input.moves.length`) and consumed only at
  `parScoring.logic.ts:58` (`const rounds = replayResult.moveCount`). (The unrelated
  `sweep.analyze.ts` / `sweep.runner.ts` `moveCount` fields are sweep-manifest move
  counts — a different type, correctly move counts, left untouched.)
- **`deriveScoringInputs` has exactly one production call site** (`competition.logic.ts:511`,
  the server verifier) and **`replayGame` (offline) feeds no scoring path** — it is
  called only by `replay.verify.ts` + engine tests (determinism self-checks), never
  chained into `deriveScoringInputs`. So the offline `turnCount` value affects no live
  score; it must simply be an honest turn count for contract consistency.
- **`computeStateHash` (`replay.hash.ts`) hashes the whole `G`** (incl. `messages` +
  `logMeta`), and D-24124 made the faithful reduction reproduce live `G` exactly, so
  live-vs-replay hashes already agree byte-for-byte. **The operator decision (Option A)
  is to keep this** — no field-set change, no golden re-pin.
- `pnpm -r build` exits 0 on `main`; engine + server suites pass their baseline.

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `docs/ai/DECISIONS.md` D-24119 (arc; WP-4 charter), D-24123 (rounds = turn count,
  engine-clean; this WP's engine follow-through), D-24124 (reduction faithful),
  D-4801 (the MVP proxy being resolved).
- `packages/game-engine/src/replay/replay.types.ts` (`ReplayResult`),
  `replay/replay.execute.ts` (`replayGame`), `replay/replay.verify.ts` (+ `.test.ts`).
- `packages/game-engine/src/scoring/parScoring.logic.ts` (`deriveScoringInputs`) +
  `scoring/parScoring.types.ts` (`ScoringInputs.rounds`).
- `packages/game-engine/src/game.ts` (the stale `logMeta` hash comment, ~line 433).
- `apps/server/src/competition/competition.logic.ts` (the `scoringView` overload).
- `docs/ai/REFERENCE/00.6-code-style.md`.

---

## Non-Negotiable Constraints

**Engine-wide (always apply):** ESM only, Node v22+. Human-style code (00.6). Test
files `.test.ts`; `node:test`. Full-sentence error messages. Determinism: no
`Math.random`, all randomness via `ctx.random.*` (unchanged here).

**Packet-specific:**
- **Rename, don't add.** `ReplayResult.moveCount` becomes `ReplayResult.turnCount`
  (the field is used only as the rounds proxy, so a rename — not a parallel field — is
  correct and prevents a lingering misnamed slot).
- **`turnCount` = completed play turns, floored at 1**, consistent with
  `reduceMatchToFinalState` + `par.aggregator`'s `turnsElapsed === 0 ? 1 : turnsElapsed`.
  In the offline `replayGame`, derive it as `max(1, count of 'endTurn' moves in
  input.moves)` (each completed turn ends with an `endTurn` move in a captured/sim
  move list) with a `// why:` documenting it.
- **`deriveScoringInputs` reads `replayResult.turnCount`** as `rounds`; the D-4801 MVP
  proxy comment is replaced with a turns-native `// why:` citing D-24123. No other
  scoring math changes.
- **`computeStateHash` is NOT changed** (Option A). No field-set change, no golden
  re-pin (`PRE_WP080_HASH` and replay-producer snapshots stay pinned). Only the stale
  `game.ts` comment claiming `logMeta` is "hash-excluded ... no replay/hash surface" is
  corrected to state that `computeStateHash` intentionally hashes the full `G`
  (including `logMeta`), and that the SEPARATE fixture-golden hash (`hashGameState`)
  excludes `messages`/`logMeta` for churn reasons (D-24081/D-24114).
- **Server is mechanical:** `competition.logic.ts`'s `scoringView` becomes
  `{ finalState, stateHash, turnCount: reduced.turnCount }` — a clean `turnCount →
  turnCount` pass, and the "moveCount slot carries turns" wart comment is removed.
- No new npm dependency; no new move (no move-registration drift-test edit); no
  boardgame.io import added to a pure helper.

**Locked contract values:**
- `ReplayResult = { finalState: LegendaryGameState, stateHash: string, turnCount: number }`.
- `deriveScoringInputs` reads `replayResult.turnCount` as `rounds`.
- `computeStateHash` signature + field set UNCHANGED.

---

## Scope (In)

### A) Engine — the contract rename + turns-native derivation
- `packages/game-engine/src/replay/replay.types.ts` — `moveCount` → `turnCount` (+ JSDoc).
- `packages/game-engine/src/replay/replay.execute.ts` — `replayGame` computes
  `turnCount = max(1, endTurnMoveCount)`; JSDoc `move count` → `turn count`.
- `packages/game-engine/src/scoring/parScoring.logic.ts` — `rounds = replayResult.turnCount`;
  replace the D-4801 proxy comment.
- `packages/game-engine/src/scoring/parScoring.types.ts` — `ScoringInputs.rounds` comment.
- `packages/game-engine/src/replay/replay.verify.test.ts` — the `moveCount` assertion
  (line 54) → `turnCount` (empty-move input → `turnCount === 1`).
- `packages/game-engine/src/game.ts` — correct the stale `logMeta` hash comment.

### B) Server — mechanical de-wart
- `apps/server/src/competition/competition.logic.ts` — `scoringView.turnCount` (rename);
  drop the wart comment.
- `apps/server/src/competition/competition.logic.test.ts` — `TEST_REPLAY_RESULT.moveCount`
  → `turnCount` (the ReplayResult-shaped expected-score fixture at the `deriveScoringInputs`
  recompute).

---

## Out of Scope

- **Any `computeStateHash` field-set change** (excluding `messages`/`logMeta`) and its
  golden re-pin — explicitly declined by the operator (Option A); the full-`G` hash is
  the intended competitive PK and live==replay already agrees (D-24124).
- **The `sweep.analyze.ts` / `sweep.runner.ts` `moveCount` fields** — unrelated sweep
  manifest move counts, correctly named, untouched.
- **Any scoring-formula / PAR-baseline change** — `rounds` now reads a turn count that
  matches how the baselines were already calibrated; no recalibration.
- **The pre-existing WP-054 leaderboard DB-test contract drift** (D-24124 follow-up) —
  a separate WP-054 test fix.

---

## Files Expected to Change

- `packages/game-engine/src/replay/replay.types.ts` — **modified**
- `packages/game-engine/src/replay/replay.execute.ts` — **modified**
- `packages/game-engine/src/replay/replay.verify.test.ts` — **modified**
- `packages/game-engine/src/scoring/parScoring.logic.ts` — **modified**
- `packages/game-engine/src/scoring/parScoring.types.ts` — **modified**
- `packages/game-engine/src/game.ts` — **modified** — stale comment only
- `apps/server/src/competition/competition.logic.ts` — **modified**
- `apps/server/src/competition/competition.logic.test.ts` — **modified**
- `docs/ai/work-packets/WP-337-rounds-turns-native.md` — **new** — this file
- `docs/ai/execution-checklists/EC-367-rounds-turns-native.checklist.md` — **new**
- `docs/ai/work-packets/WORK_INDEX.md` — **modified**
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified**
- `docs/ai/STATUS.md` — **modified** (execution)
- `docs/ai/DECISIONS.md` — **modified** (execution) — D-24125

No other files. No migration, no new endpoint, no API-catalog row change (no
apps/server export signature changes; `deriveScoringInputs`/`replayGame` are not
catalogued).

---

## Acceptance Criteria

- [ ] `ReplayResult` is `{ finalState, stateHash, turnCount }`; no `moveCount` field remains on it.
- [ ] `deriveScoringInputs` reads `replayResult.turnCount` as `rounds`; the D-4801 proxy comment is gone.
- [ ] `replayGame` sets `turnCount = max(1, count of 'endTurn' moves)`, documented.
- [ ] `competition.logic.ts`'s `scoringView` uses `turnCount: reduced.turnCount` (no `moveCount` overload, no wart comment).
- [ ] `computeStateHash` is byte-unchanged; `git diff` shows no edit to `replay.hash.ts`; no golden re-pin (`replay.execute.test.ts` PRE_WP080_HASH assertions unchanged and passing).
- [ ] `game.ts`'s `logMeta` comment no longer claims it is hash-excluded from `computeStateHash`.
- [ ] `grep -rn "\.moveCount" packages/game-engine/src apps/server/src` shows only the `sweep.*` manifest fields (no `ReplayResult.moveCount`).
- [ ] Engine + server suites green (no-DB); the competition DB happy/raw-score tests still pass (turnCount flows as rounds).
- [ ] No files outside `## Files Expected to Change`.

---

## Verification Steps

```pwsh
# Step 1 — build
pnpm -r build            # exits 0

# Step 2 — engine tests (scoring + replay + determinism goldens)
pnpm --filter @legendary-arena/game-engine test
# Expected: green; PRE_WP080_HASH determinism goldens UNCHANGED and passing

# Step 3 — server tests
pnpm --filter @legendary-arena/server test
# Expected: green (no-DB); competition rawScore test uses turnCount as rounds

# Step 4 — the proxy is gone
Select-String -Path "packages\game-engine\src\scoring\parScoring.logic.ts" -Pattern "moveCount"
# Expected: no match
Select-String -Path "packages\game-engine\src\replay\replay.types.ts" -Pattern "turnCount"
# Expected: >= 1 match

# Step 5 — computeStateHash untouched
git diff --name-only packages/game-engine/src/replay/replay.hash.ts
# Expected: no output

# Step 6 — scope
git diff --name-only    # matches Files Expected to Change
```

---

## Vision Alignment

**Vision clauses touched:** §22 (Scoring & Skill Measurement) — completes the
turns-native `rounds` input so every competitive score, on every path, is measured on
the same turn scale the PAR baselines were calibrated with; removes the last
move-count-as-rounds miscalibration (the offline path).

**Conflict assertion:** No conflict — preserves §22, strengthens calibration honesty.
No paid surface, no user-facing change.

**Determinism preservation:** `computeStateHash` is unchanged (full-`G` competitive
hash retained). `turnCount` is a deterministic function of the move list. No RNG
change. Replay determinism goldens (`PRE_WP080_HASH`) are not re-pinned.

---

## Funding Surface Gate

**N/A** — engine scoring-contract cleanup + a mechanical server rename. No global-nav /
registry / profile funding affordance. Authority: WP-097, D-9701, D-9801.

---

## API Catalog Update (§21 — D-11804)

**Not triggered.** No `apps/server` HTTP endpoint changes; no catalogued library
function's signature changes (`reduceMatchToFinalState`/`readReplayArtifactByHash`/
`reduceReplayByHash` are unchanged; `deriveScoringInputs`/`replayGame` are engine-internal
and not in the catalog). The `POST /api/competition/scores` behavior is unchanged.

---

## Lint Gate Self-Review (00.3)

| § | Verdict | Notes |
|---|---------|-------|
| §1 Structure | PASS | All sections incl. Out of Scope (≥2) |
| §2 Constraints | PASS | Engine-wide + packet-specific + locked values; 00.6 |
| §3 Assumes | PASS | D-24123/24124 + the sole-consumer + no-hash-change facts explicit |
| §4 Context | PASS | DECISIONS + replay + scoring + game.ts + competition cited |
| §5 Output | PASS | 8 code/test + governance; bounded |
| §6 Naming | PASS | `turnCount` consistent with `reduceMatchToFinalState` + `par.aggregator` |
| §7 Dependencies | PASS | No new dep; no new move |
| §8 Boundaries | PASS | Engine change is pure scoring/replay contract; server edit mechanical; no layer crossing |
| §9 Windows | PASS | `Select-String` / `pnpm` |
| §10 Env | N/A | none |
| §11 Auth | N/A | no endpoint/auth change |
| §12 Tests | PASS | `node:test`; determinism goldens asserted unchanged; scoring recompute updated |
| §13 Commands | PASS | Exact `pnpm` + `Select-String` w/ expected output |
| §14 Acceptance | PASS | 9 binary items incl. "computeStateHash byte-unchanged" + "no golden re-pin" |
| §15 DoD | PASS | STATUS/DECISIONS/WORK_INDEX + scope-boundary + User-Visible Surface |
| §16 Code style | PASS | Rename over parallel field; `// why:` on the endTurn-count derivation |
| §17 Vision | PASS | §22 cited; determinism-preservation line present |
| §18 Prose-vs-grep | PASS | Step 4 greps (`moveCount` expect none in parScoring; `turnCount` expect ≥1) |
| §19 Bridge | N/A | no repo-state artifact |
| §20 Funding | N/A | justified |
| §21 API catalog | PASS | Not triggered (no endpoint/catalogued-signature change) — stated + justified |

**Pre-flight self-verdict:** READY — deps Active/Done; scope is a bounded contract
rename with a documented single behavioral change (offline `turnCount` derivation);
the risky hash re-pin is explicitly excluded per the operator decision; no golden
churn.

**Copilot self-check:** PASS — engine scoring-contract cleanup, `computeStateHash`
untouched, no golden re-pin, server edit mechanical, §21 not triggered, User-Visible
Surface `none — infrastructure`.

---

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` + `pnpm --filter @legendary-arena/server test` green (determinism goldens unchanged; competition rawScore uses turnCount)
- [ ] `docs/ai/STATUS.md` updated — "No user-observable change — infrastructure only" + payoff (rounds turns-native on every path; D-4801 resolved; hash intentionally full-`G`)
- [ ] `docs/ai/DECISIONS.md` — D-24125 (retire `moveCount` proxy → `ReplayResult.turnCount`; `computeStateHash` intentionally full-`G`, comment corrected, no field-set change; resolves D-4801) Active
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-337 checked off with date
- [ ] No files outside `## Files Expected to Change` (`git diff --name-only`)
