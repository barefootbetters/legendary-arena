# Pre-Flight Input — WP-053a (PAR Artifact Carries Full ScenarioScoringConfig)

**Status:** Notes carried forward from the WP-053a A0 SPEC drafting + post-tightening session (2026-04-25).
**Authority:** **Non-authoritative.** The pre-flight session must independently verify every item before relying on it.
**Target:** [WP-053a](../work-packets/WP-053a-par-artifact-scoring-config.md) + [EC-053a](../execution-checklists/EC-053a-par-artifact-scoring-config.checklist.md) + draft session prompt at [`session-wp053a-par-artifact-scoring-config.md`](session-wp053a-par-artifact-scoring-config.md)

---

## Why this file exists

The WP-053a A0 SPEC bundle (`1734475`) plus EC-053a checklist (`fec82fd`) plus session-prompt draft (gitignored scratchpad) all landed in a single drafting session before any pre-flight ran. These notes preserve findings + repo facts confirmed during that session so the WP-053a pre-flight session can skip re-discovery and focus on resolving the open items below. The notes are inputs to pre-flight, not conclusions.

Per `docs/ai/REFERENCE/01.4-pre-flight-invocation.md` §Review Order, pre-flight reads in this order:

1. EC-053a (primary execution authority)
2. WP-053a (design intent)
3. Session prompt draft (derived artifact)

If any of (1)/(2)/(3) contradict each other, the lower-authority document must be corrected.

---

## State of `main` at pre-flight entry

`main` HEAD: **`fec82fd`** (`SPEC: EC-053a — draft canonical execution checklist for WP-053a`).

Recent landed history relevant to WP-053a (chronological):

- `fe7db3e` — `EC-111: introduce server-side replay storage and loader` (WP-103 Commit A — replay loader landed)
- `f74d180` — `SPEC: WP-103 / EC-111 governance close — text-PK + jsonb decisions, post-mortem, status`
- `c8a2421` — `SPEC: PRE-COMMIT-REVIEW artifact WP-103 / EC-111 (retrospective audit; verdict Safe to commit as-is)`
- `1734475` — `SPEC: WP-053a A0 — draft PAR-artifact ScenarioScoringConfig bundle + D-5306 / D-5306a-d resolution`
- `49ee0be` — `SPEC: WP-053 + EC-053 — fold WP-103 + WP-053a as explicit prerequisites in §Assumes / §Before Starting`
- `2784f54` — `SPEC: session-context-wp053 — post-WP-103 + post-WP-053a-A0-SPEC reconciliation`
- `c9ddbd1` — `SPEC: WP-053a — post-review tightening + propagated engine test count correction (+7 → +9)`
- `fec82fd` — `SPEC: EC-053a — draft canonical execution checklist for WP-053a`

`origin/main` is in sync with local `main` at `fec82fd`.

---

## Findings to verify

### 1. WP-049 / WP-050 / WP-051 status check (HARD GATE)

WP-053a §Assumes requires WP-049 (PAR aggregator), WP-050 (PAR artifact storage + `validateParStore`), and WP-051 (`checkParPublished` server gate) all complete. The session prompt's Pre-Session Gate 4 baselines depend on these being landed.

**Pre-flight action:** verify each is `[x] Done` in `WORK_INDEX.md` and that the contract surfaces exist on `main`:

```bash
grep -E "^- \[x\] WP-049 |^- \[x\] WP-050 |^- \[x\] WP-051 " docs/ai/work-packets/WORK_INDEX.md
# Expected: 3 lines

grep -n "ParBaseline\|ParSimulationResult\|ParSimulationConfig" packages/game-engine/src/simulation/par.aggregator.ts
grep -n "SeedParArtifact\|SimulationParArtifact\|ParIndex\|validateParStore" packages/game-engine/src/simulation/par.storage.ts
grep -n "checkParPublished\|ParGateHit" apps/server/src/par/parGate.mjs
```

If any of the three WPs is not Done, WP-053a is BLOCKED — pre-flight must list which WP and recommend its execution before WP-053a opens.

### 2. `validateScoringConfig` actual return shape

The session prompt's Step 2 implementation pattern assumes `validateScoringConfig` returns a `Result<T>`-like discriminated union with `.ok` and `.reason` fields. This is based on grep evidence from `packages/game-engine/src/scoring/parScoring.logic.test.ts:351`:

```
const result = validateScoringConfig(badConfig);
```

But the actual return shape was not directly inspected at draft time.

**Pre-flight action:** grep the actual signature:

```bash
grep -nE "export function validateScoringConfig" packages/game-engine/src/scoring/parScoring.logic.ts
grep -nE "interface .*ValidationResult|type .*ValidationResult|Result<" packages/game-engine/src/scoring/parScoring.types.ts packages/game-engine/src/scoring/parScoring.logic.ts
```

Document the actual shape. If it is *not* `Result<T>`-style (e.g., returns `boolean`, throws, or returns `string[]` of errors), the session prompt's implementation pattern (Step 2) and the validator extension pattern (Step 5) need amendments. Either:

- (a) Adapt the new error-emission pattern to match the existing `validateScoringConfig` shape, or
- (b) Document the shape divergence under a new `// why:` comment in `scoringConfigLoader.ts` explaining the wrapper.

### 3. Sync vs async loader signature

The session prompt has both `Promise<ScenarioScoringConfig>` (in implementation pattern) and bare `ScenarioScoringConfig` (in §Locked Values function signatures). One must be canonical.

**Pre-flight action:** decide based on the aggregator's call site:

- If `par.aggregator.ts` is async (uses `await`), use `async function` + `Promise<>` return — `node:fs/promises` `readFile`
- If `par.aggregator.ts` is sync, use sync function — `node:fs` `readFileSync`

```bash
grep -nE "^export (async )?function|await " packages/game-engine/src/simulation/par.aggregator.ts | head -10
```

Update WP-053a §Goal + EC-053a §Locked Values to commit to one form. The session prompt §Goal #1 and §Implementation Tasks Step 2 should be reconciled.

### 4. Authoring CLI call sites for `ParSimulationConfig`

The session prompt's Pre-Session Gate 11 + Implementation Step 13 assume there may be a CLI that constructs `ParSimulationConfig` today and would need a small update to pass `scoringConfig`. If no such CLI exists (i.e., the aggregator is exported but unwired), Step 13 collapses to a no-op.

**Pre-flight action:**

```bash
grep -RnE "createParSimulation|runParSimulation|aggregatePar|ParSimulationConfig\s*[:=]" packages/ apps/ scripts/ 2>/dev/null
```

Document each call site. If any are in scripts that would need updating, add the file path(s) to WP-053a §Files Expected to Change as an A0 SPEC amendment, then re-confirm pre-flight.

### 5. `data/par/` clean-slate confirmation

The session prompt's Pre-Session Gate 9 asserts `data/par/` is empty / disposable on `main`. A casual check during draft showed `cannot access 'data/par/'` (directory does not exist). Pre-flight must confirm against current `main`.

**Pre-flight action:**

```bash
ls -la data/par/ 2>&1
git ls-files data/par/ 2>&1
```

If `data/par/` exists with tracked content, pre-flight escalates to the WP-049/050 owner before WP-053a may proceed. Existing artifact files would need regeneration (not in-place migration) per WP-053a §Non-Negotiable Constraints.

### 6. Existing test fixture style + blast radius

The session prompt's Pre-Session Gate 12 + Implementation Steps 6/8/12 assume "every existing test fixture must add `scoringConfig`" — this is mechanical. Blast radius depends on whether fixtures are inline literals or factory-built.

**Pre-flight action:**

```bash
grep -cE "(SeedParArtifact|SimulationParArtifact|ParIndex|ParGateHit)\s*[:=]" packages/game-engine/src/simulation/par.storage.test.ts packages/game-engine/src/simulation/par.aggregator.test.ts apps/server/src/par/parGate.test.ts
grep -nE "function (build|make|create)(Seed|Simulation|Index|Gate|Par)" packages/game-engine/src/simulation/*.test.ts apps/server/src/par/*.test.ts
```

Record approximate fixture-update line counts in the pre-flight report. If a centralized factory exists, the blast radius collapses to one location. If fixtures are inline-literal-everywhere, the blast radius is large but mechanical.

### 7. Suite-count outcome for `scoringConfigLoader.test.ts`

EC-053a §Locked Values + WP-053a §Acceptance Criteria + the session prompt all leave open: do the 4 tests in the new `scoringConfigLoader.test.ts` go inside an existing engine describe block (+0 suites; total `522/115/0`) or a fresh top-level `describe('scoringConfigLoader (WP-053a)', …)` block (+1 suite; total `522/116/0`)?

**Pre-flight action:** decide. The post-WP-031 convention is to wrap test files in exactly one top-level `describe()` block (matches WP-052 §3.1 reconciliation discipline + WP-103 §16 Hard Stop on suite count). That convention argues for the **+1 suite outcome (`522/116/0`)** as default. Lock this in the pre-flight report; update the session prompt's §Locked Values + §Acceptance Criteria + §Verification Steps accordingly.

### 8. Scenario-key placeholder `<scenario_key>`

The session prompt has placeholder paths `data/scoring-configs/<scenario_key>.json`. Pre-flight should pick concrete scenario keys based on whatever the existing seed PAR set (or WP-049/050 outputs) reference.

**Pre-flight action:** search for existing scenario-key constants used in PAR test fixtures:

```bash
grep -nE "scenarioKey:\s*['\"]" packages/game-engine/src/simulation/*.test.ts packages/game-engine/src/scoring/*.test.ts | head -10
```

Pick at least one representative `<scenario_key>` and update the session prompt's §Implementation Tasks Step 1 + §Files Expected to Change with the concrete name.

---

## Verified repo facts (use as-is)

These were confirmed during the WP-053a drafting session and are unlikely to drift before pre-flight:

### Contract surfaces present on `main` at `fec82fd`

- **`ScenarioScoringConfig` interface** at `packages/game-engine/src/scoring/parScoring.types.ts:145` (D-4805 self-contained — verified).
- **`SeedParArtifact`, `SimulationParArtifact`, `ParArtifact` (union), `ParIndex`** at `packages/game-engine/src/simulation/par.storage.ts:90, 113, 136, 146` (verified shapes; `parBaseline` field on Seed; `scoring.{scoringConfigVersion, rawScoreSemanticsVersion}` on both).
- **`ParSimulationConfig`** at `packages/game-engine/src/simulation/par.aggregator.ts:122` (verified).
- **`checkParPublished` + `ParGate` + `ParGateHit` JSDoc** at `apps/server/src/par/parGate.mjs:30-75` (verified). Gate is fs-free at request time per D-5103 (the module's own JSDoc explicitly states `fs-free`).
- **`validateScoringConfig`** is exported from `packages/game-engine/src/scoring/parScoring.logic.ts` (presence verified via grep; **return shape NOT verified — see Finding #2**).

### Locked decisions on `main`

- **D-5306** (Option A bundled into PAR publication) — landed at `1734475`
- **D-5306a** (`data/scoring-configs/<scenario_key>.json` authoring origin) — landed at `1734475`
- **D-5306b** (inline materialization into `ParIndex` for fs-free gate access) — landed at `1734475`
- **D-5306c** (`SeedParArtifact.parBaseline` retained one cycle; validator enforces equality with `errorType: 'par_baseline_redundancy_drift'`) — landed at `1734475`
- **D-5306d** (`competitive_scores` retains both `par_version` and `scoring_config_version` columns as audit redundancy — informational; lands at WP-053, not WP-053a) — landed at `1734475`

### Test baselines on `main` at `fec82fd`

- `pnpm --filter @legendary-arena/game-engine test` reports **`513 / 115 / 0`** (verified at WP-103 closure)
- `pnpm --filter @legendary-arena/server test` reports **`36 / 6 / 0`** (with 10 skipped if no `TEST_DATABASE_URL`; verified at WP-103 closure)
- Engine `parScoring.types.ts` + `parScoring.logic.ts` are byte-identical to their pre-WP-103 state (`git diff main..fec82fd -- packages/game-engine/src/scoring/parScoring.{types,logic}.ts` empty)

### Working-tree state at pre-flight entry

`git status --short` likely shows the following NOT-WP-053a-scope items in the tree:

```
 M docs/ai/DESIGN-RANKING.md
 M docs/ai/execution-checklists/EC_INDEX.md
 M docs/ai/work-packets/WORK_INDEX.md
?? data/cards-combined.json
?? docs/TOURNAMENT-FUNDING.md
?? docs/ai/execution-checklists/EC-097-tournament-funding-policy.checklist.md
?? docs/ai/execution-checklists/EC-098-funding-surface-gate-trigger.checklist.md
?? docs/ai/work-packets/WP-097-tournament-funding-policy.md
?? docs/ai/work-packets/WP-098-funding-surface-gate-trigger.md
?? docs/ai/work-packets/WP-101-handle-claim-flow.md
?? scripts/Combine-CardData.ps1
```

These are unrelated WP-097 / WP-098 / WP-101 governance work-in-progress + an unrelated `data/cards-combined.json` + `Combine-CardData.ps1` script. Per the WP-103 precedent, the WP-053a execution session must stash the modified files before cutting the WP-053a topic branch. Untracked files do not need stashing (they won't be staged unless explicitly added).

### Parallel session note

A separate Claude session that the user opened earlier ran a WP-053 (not WP-053a) pre-flight under the assumption that Option B would be chosen for D-5306. Those findings (PS-1 through PS-6, the locked 9-step submission flow, the `xmax = 0` idempotency idiom, `45/7/0` server baseline target) are **partially invalidated** under Option A:

- The 9-step flow's step 12 (`computeParScore(config) === parValue`) becomes defense-in-depth rather than a primary safety net under Option A
- The `+9/+1` server baseline target was scoped against a starting baseline of `36/6/0`; under WP-053a's prerequisite landing first, WP-053 starts from `38/6/0`, so the projection shifts to `47/7/0` (engine deltas don't apply — WP-053 is server-only)
- The `xmax = 0` idiom and identity / ownership / PAR-gate-rejection patterns remain valid carry-forward for WP-053 (they're orthogonal to D-5306)

The parallel session can be quit. Its findings are NOT applicable to WP-053a's pre-flight (different WP); WP-053a needs a fresh pre-flight pass against the post-A0-SPEC `main`.

---

## WP-103 carry-forward lessons (must surface in WP-053a pre-flight)

Per `docs/ai/post-mortems/01.6-WP-103-replay-storage-loader.md` §3 + retrospective review at `docs/ai/reviews/pre-commit-review-wp103-ec111.md`:

### 1. Comment-text grep collisions (§3.1)

Hard Stop grep gates match comment text literally. The WP-053a session prompt's §Hard Stops includes patterns like `JSON.parse`, `ON CONFLICT.*DO UPDATE`, `Math.random`, etc. that could trip on `// why:` comment text explaining *why those forbidden patterns are avoided*.

**Pre-flight action:** review each Hard Stop grep in the session prompt and pre-screen `// why:` comment text in WP-053a's expected new files. If any comment substring would match a Hard Stop, either reword the comment (preferred) or anchor the gate to actual code structure (e.g., `^[^/]*JSON\.parse\(`).

### 2. Skip-pattern count discipline (§3.2)

Hard Stop §16 from WP-103's session prompt was "exactly N", not "≥ N". JSDoc / commentary references to the literal substring `skip: 'requires test database'` count toward the grep total.

**Pre-flight action:** WP-053a's `parGate.test.ts` extensions don't add new DB-dependent tests — the existing skip-pattern count should be unchanged. But verify by grep that the count after WP-053a equals the count before WP-053a; document the locked count in the session prompt.

### 3. PRE-COMMIT-REVIEW.template.md citation (retrospective review §Commit Hygiene)

The WP-103 session prompt did not cite `docs/ai/prompts/PRE-COMMIT-REVIEW.template.md` in its Authority Chain or Pre-Session Gates, and the implementing session committed without running the template. The retrospective review at `c8a2421` documented this gap.

**Pre-flight action:** verify the WP-053a session prompt cites the template in its Authority Chain (Step 15 of §Implementation Tasks + Hard Stop #22 + Definition-of-Done bullet). The session prompt draft already includes these citations — pre-flight just confirms they survived any amendments.

---

## Risk awareness items (flag in pre-flight report; post-mortem records)

These are non-invasive risks the session-prompt's §Risk Awareness Notes already documents, but worth surfacing again in the pre-flight verdict:

### Artifact hash sensitivity

`scoringConfig` embedded into both artifact shapes means key-ordering differences alter `artifactHash`. The alphabetical-key-ordering-on-write rule (D-5306a) covers this — but pre-flight should recommend that the executor spot-check at least one artifact hash by emitting the same `(scenarioKey, parValue, scoringConfig)` triple twice from the aggregator (e.g., in a test) and asserting `artifactHash` is byte-equal across emissions.

### `ParIndex` memory growth

Inline `scoringConfig` materialization (D-5306b) increases per-scenario index memory by ~1 KB. For 100 scenarios, ~100 KB. Negligible at MVP scale; should be acknowledged in the post-mortem under "Tradeoffs Observed" so the calibration is recorded.

---

## Authority chain for pre-flight reading

In strict order per `docs/ai/REFERENCE/01.4-pre-flight-invocation.md` §Review Order:

1. **`.claude/CLAUDE.md`** — root coordination
2. **`docs/ai/REFERENCE/01.4-pre-flight-invocation.md`** — pre-flight governance (this is the gate being executed)
3. **`docs/ai/REFERENCE/01.7-copilot-check.md`** — copilot check (Step 1b — runs after pre-flight READY for non-Contract-Only WPs; recommended-but-optional for WP-053a per its Contract-Only class — strongly-recommended given cross-layer touch)
4. **`docs/ai/execution-checklists/EC-053a-par-artifact-scoring-config.checklist.md`** — primary execution authority
5. **`docs/ai/work-packets/WP-053a-par-artifact-scoring-config.md`** — design intent
6. **`docs/ai/invocations/session-wp053a-par-artifact-scoring-config.md`** — derived session-prompt draft (gitignored scratchpad; pre-flight refines its §Header before execution opens)
7. **`docs/ai/DECISIONS.md`** — D-4805 (`ScenarioScoringConfig` self-contained), D-5101 (PAR sim-over-seed), D-5103 (fs-free gate), D-5306 + D-5306a/b/c/d
8. **`docs/ai/post-mortems/01.6-WP-103-replay-storage-loader.md`** — §3 carry-forward lessons
9. **`docs/ai/reviews/pre-commit-review-wp103-ec111.md`** — retrospective review §Commit Hygiene Recommendations
10. **`docs/ai/session-context/session-context-wp053.md`** — bridge document; §3 baseline table now reflects post-WP-053a-execution projections

Lower-authority documents must not work around higher-level errors (per `01.4` §Review Order).

---

## Pre-flight deliverable

Produce `docs/ai/invocations/preflight-wp053a.md` containing:

- **Verdict line** — `READY TO EXECUTE` / `PARTIAL` / `NOT READY`
- **State summary** — current `main` HEAD; baseline test totals; working-tree state
- **Findings 1-8 resolution** — for each finding above, document the verification result (verified / amended / blocked) and any required PS-N updates
- **Authority chain audit** — confirm EC-053a, WP-053a, session-prompt draft are internally consistent and don't contradict higher-authority docs
- **Locked-value review** — confirm the session-prompt's §Locked Values match EC-053a + WP-053a (function signatures, error type strings, baseline numbers, file allowlist)
- **WP-103 carry-forward folds** — verify the three carry-forwards (comment-text greps, skip-pattern count, PRE-COMMIT-REVIEW citation) are folded into the session prompt
- **Suite-count + sync-vs-async commitments** — explicit decisions on the two open questions (Findings 7 + 3)
- **Copilot check recommendation** — does the pre-flight recommend running 01.7 next (yes for WP-053a — strongly-recommended despite Contract-Only class) or proceeding directly to session prompt refinement?
- **Risk Awareness affirmations** — confirm the artifact-hash + memory-growth notes are in the session prompt's §Risk Awareness Notes

Per `.claude/rules/work-packets.md` §Invocation Artifacts, this report (`preflight-wp053a.md`) is **scratchpad-by-default** — not committed unless WP-053a or EC-053a explicitly cites it as a normative input.

---

## What this session does NOT do

- Does NOT execute WP-053a (no code changes, no test files, no migration — there isn't one).
- Does NOT modify WP-053a, EC-053a, the session prompt, or the DECISIONS entries unless a Finding's resolution explicitly requires an A0 SPEC amendment (which is itself a separate SPEC commit, not part of pre-flight).
- Does NOT stash the WP-097/098/101 WIP — that's WP-053a execution session's job per the WP-103 Pre-Session Gate 8 precedent.
- Does NOT run the PRE-COMMIT-REVIEW template — that's execution-session scope (Step 15 of the session prompt's §Implementation Tasks).
- Does NOT run the copilot check (01.7) — that's Step 1b, **after** this pre-flight session returns READY TO EXECUTE.
