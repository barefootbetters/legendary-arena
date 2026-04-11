# Pre-Flight Invocation — WP-048

---

### Pre-Flight Header

**Target Work Packet:** `WP-048`
**Title:** PAR Scenario Scoring & Leaderboards
**Previous WP Status:** WP-020 Incomplete, WP-027 Incomplete, WP-030 Incomplete
**Pre-Flight Date:** 2026-04-10
**Invocation Stage:** Pre-Execution (Scope & Readiness)

**Work Packet Class:** Contract-Only (types/contracts/tests only)

WP-048 creates type definitions, pure scoring computation functions, and unit
tests. It does not mutate `G`, does not wire into `game.ts`, and does not use
framework `ctx`. All new files are pure helpers with no boardgame.io imports.

---

### Pre-Flight Intent

Perform a pre-flight validation for WP-048.

- Not implementing.
- Not generating code.
- Validating readiness and constraints only.

If a blocking condition is found, pre-flight must return **NOT READY** and stop.

---

### Authority Chain (Must Read)

1. `.claude/CLAUDE.md` — EC-mode rules, lint gate, execution checklists
2. `docs/ai/ARCHITECTURE.md` — Layer boundaries (scoring = engine; leaderboard
   storage = server), persistence boundaries (ScenarioScoringConfig = Class 2,
   ScoreBreakdown = Class 3), engine never queries registry at runtime
3. `docs/ai/execution-checklists/EC-048-par-scenario-scoring.checklist.md` —
   governing execution checklist
4. `docs/ai/work-packets/WP-048-par-scenario-scoring-leaderboards.md` —
   authoritative WP specification
5. `docs/12-SCORING-REFERENCE.md` — reference scoring formula, two-layer
   architecture, structural invariants, PAR derivation methodology

---

### Dependency & Sequencing Check

| WP | Required Artifacts | Status | Notes |
|---|---|---|---|
| WP-020 | `computeFinalScores`, `FinalScoreSummary`, `PlayerScoreBreakdown`, VP constants | ❌ Incomplete | `scoring/` directory does not exist. WP-020 is unchecked in WORK_INDEX.md. No scoring code has been written. |
| WP-027 | `ReplayInput`, `ReplayResult`, `replayGame`, `computeStateHash`, `verifyDeterminism` | ❌ Incomplete | `replay/` directory does not exist. WP-027 is unchecked in WORK_INDEX.md. No replay code has been written. |
| WP-030 | `ScenarioDefinition` | ❌ Incomplete | `campaign/` directory does not exist. WP-030 is unchecked in WORK_INDEX.md. `ScenarioDefinition` exists only in documentation. |

**All three prerequisite WPs are incomplete. Pre-flight is NOT READY.**

---

### Structural Readiness Check (Types & Contracts)

- [x] All prior WPs compile and tests pass — **YES**: `pnpm build` exits 0;
  `pnpm test` exits 0 with 89 passing tests, 0 failing
- [x] No known EC violations remain open — **YES**: no open violations
- [ ] Required types/contracts exist and are exported as referenced by WP-048 —
  **NO**: `FinalScoreSummary`, `PlayerScoreBreakdown`, VP constants
  (WP-020), `ReplayInput`, `ReplayResult`, `replayGame` (WP-027), and
  `ScenarioDefinition` (WP-030) do not exist in the codebase. These are
  prerequisite types that WP-048 consumes.
- [x] No naming or ownership conflicts — **YES**: `parScoring.*` namespace is
  unused; no conflicts anticipated
- [x] No architectural boundary conflicts anticipated — **YES**: all new files
  are pure helpers in the engine scoring package; `LeaderboardEntry` type
  is defined in engine but storage is explicitly server-only

**Blocking:** Required types/contracts from WP-020, WP-027, and WP-030 do not
exist. Pre-flight is **NOT READY**.

---

### Runtime Readiness Check

**Skipped** — WP-048 is Contract-Only. No runtime mutation, no framework `ctx`
usage, no `game.ts` wiring.

---

### Established Patterns to Follow (Locked Precedents)

The following patterns from prior WPs apply to WP-048:

- **Pure helper pattern**: functions return new values, no mutation, no I/O
  (established WP-005B, WP-006A, WP-007A)
- **Drift-detection pattern**: canonical `readonly` array + union type + test
  asserting exact match (established WP-007A for `MATCH_PHASES`,
  `TURN_STAGES`; WP-009A for `RULE_TRIGGER_NAMES`, `RULE_EFFECT_TYPES`)
- **Named type alias pattern**: `CardExtId = string` (WP-006A) — same pattern
  for `ScenarioKey = string`, `TeamKey = string`
- **Structured result, never throw**: validation functions return result objects
  (established WP-005A `ValidateMatchSetupResult`, WP-006A
  `ZoneValidationError`)
- **No boardgame.io imports in pure helpers**: enforced since WP-007A
- **No `.reduce()` with branching**: `for...of` loops for accumulation
  (established WP-009B)
- **`node:test` + `node:assert` only**: no `boardgame.io/testing`
  (established WP-005B)
- **Test files use `.test.ts`**: never `.test.mjs` (project convention)

No deviations from these patterns are anticipated.

---

### Scope Lock (Critical)

#### WP-048 Is Allowed To

- **Create:** `packages/game-engine/src/scoring/parScoring.types.ts` — PAR
  scoring type definitions, branded type aliases, interfaces, canonical array,
  penalty event type union
- **Create:** `packages/game-engine/src/scoring/parScoring.logic.ts` — pure
  scoring computation functions (deriveScoringInputs, computeRawScore,
  computeParScore, computeFinalScore, buildScoreBreakdown,
  validateScoringConfig)
- **Create:** `packages/game-engine/src/scoring/parScoring.keys.ts` — pure key
  builder functions (buildScenarioKey, buildTeamKey)
- **Create:** `packages/game-engine/src/scoring/parScoring.logic.test.ts` — 14
  unit tests
- **Create:** `packages/game-engine/src/scoring/parScoring.keys.test.ts` — 4
  unit tests
- **Modify:** `packages/game-engine/src/scoring/scoring.types.ts` — re-export
  additions only (no structural changes)
- **Modify:** `packages/game-engine/src/types.ts` — re-export PAR types
- **Modify:** `packages/game-engine/src/index.ts` — export PAR scoring API
- **Update:** `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md`,
  `docs/ai/work-packets/WORK_INDEX.md`

#### WP-048 Is Explicitly Not Allowed To

- No modification of WP-020 contract files (`scoring.types.ts`,
  `scoring.logic.ts`) beyond re-export additions
- No modification of WP-027 contract files (replay types/logic)
- No modification of WP-030 contract files (scenario/campaign types)
- No boardgame.io imports in any new file
- No registry or server imports in any new file
- No `Math.random()` in any new file
- No `.reduce()` with branching logic
- No `require()` — ESM only
- No floating-point arithmetic in scoring logic (centesimal integers only)
- No mutation of `G`
- No runtime wiring into `game.ts`
- No PAR derivation computation (consumed as input via config, not computed)
- No server endpoint implementation
- No UI changes
- No files outside the scope lock list

---

### Test Expectations (Locked Before Execution)

- **New tests:** 18 total
  - `parScoring.logic.test.ts` — 14 tests covering: raw score computation,
    monotonicity (4 directions), bystander cap, heroic vs conservative
    scenario, PAR-relative scoring, config validation (weights, invariants),
    drift detection, determinism
  - `parScoring.keys.test.ts` — 4 tests covering: scenario key sorting,
    single villain group, team key sorting, key stability
- **Existing test changes:** None expected. All 89 existing tests must continue
  to pass unmodified.
- **Prior test baseline:** 89 passing, 0 failing (confirmed 2026-04-10)
- **Test boundaries:**
  - No boardgame.io imports in test files
  - No modifications to `makeMockCtx` or other shared test helpers
  - `node:test` + `node:assert` only
  - All test files use `.test.ts` extension

---

### Mutation Boundary Confirmation

**Skipped** — WP-048 is Contract-Only. No `G` mutations. All functions are pure
(read-only inputs, return new values). No framework `ctx` usage.

---

### Risk & Ambiguity Review (Resolve Now, Lock for Execution)

#### Risk 1: `deriveScoringInputs` depends on game log event types

- **Risk:** WP-048 specifies `deriveScoringInputs` which extracts R, VP, BP, E
  from the game log (`GameMessage[]`). The function requires specific event
  types to be logged (turn progression, bystander rescue, villain escape,
  scheme twist). These events may not exist in the game log format until
  WP-020+ are implemented.
- **Impact:** `deriveScoringInputs` cannot be fully implemented or tested
  without the actual game log event types.
- **Mitigation:** Since WP-020, WP-027, and WP-030 are all incomplete,
  `deriveScoringInputs` should be implemented as a pure function that
  operates on the documented event type contracts. Tests can use mock game
  log data matching the expected format. If the actual game log event
  format differs when WP-020/027 are completed, `deriveScoringInputs` will
  need a follow-up adjustment.
- **Decision:** Accept this as a known integration risk. The function's
  contract (input types, output types) is stable. The implementation may
  need adjustment when upstream WPs are completed. This is acceptable for
  a Contract-Only WP that defines the scoring contract ahead of its
  runtime dependencies.

#### Risk 2: `computeFinalScores` reuse from WP-020

- **Risk:** WP-048 specifies that VP extraction reuses `computeFinalScores`
  from WP-020. Since WP-020 is incomplete, this function does not exist.
- **Impact:** `deriveScoringInputs` cannot call `computeFinalScores` at
  implementation time.
- **Mitigation:** Two options:
  - **(a)** Mock `computeFinalScores` in tests and define the interface dependency
    (import type only). The actual function call is wired when WP-020 exists.
  - **(b)** Defer `deriveScoringInputs` entirely to a future WP that runs after
    WP-020 and WP-027 are complete.
- **Decision:** Option (b) is cleaner. Split `deriveScoringInputs` out of
  WP-048's implementation scope. WP-048 should focus on the scoring
  computation contract (types, computeRawScore, computeParScore,
  computeFinalScore, buildScoreBreakdown, validateScoringConfig, key
  builders) and defer replay-dependent derivation to a follow-up WP.
  This avoids speculative mocking of upstream contracts that don't exist.

#### Risk 3: `ParBaseline` field `escapesPar` is ambiguous

- **Risk:** The `ParBaseline` interface has an `escapesPar` field, but the
  scoring formula uses per-event penalty weights (not a single escape count).
  It's unclear whether `escapesPar` represents total expected penalty events
  or only villain escapes.
- **Impact:** `computeParScore` needs clarity on how PAR baseline maps to
  per-event penalty contributions.
- **Mitigation:** Replace `escapesPar` with a per-event PAR baseline:
  `penaltyBaselineCounts: Record<PenaltyEventType, number>`. This aligns
  with the per-event penalty weight structure and eliminates ambiguity.
- **Decision:** The `ParBaseline` interface should be updated in WP-048 to use
  `penaltyBaselineCounts` instead of `escapesPar`. This is a pre-execution
  scope clarification, not a contract change (the interface hasn't been
  implemented yet).

#### Risk 4: `GameMessage` type dependency

- **Risk:** `deriveScoringInputs` signature references `GameMessage[]` from the
  game log. The `GameMessage` type is part of `G.messages` (see WP-010).
  If the message format doesn't carry structured event type information
  (just human-readable strings), extraction will be fragile or impossible.
- **Impact:** Cannot reliably extract penalty event counts from free-text
  messages.
- **Mitigation:** This risk is resolved by deferring `deriveScoringInputs`
  (see Risk 2 decision). When the function is implemented in a follow-up
  WP, it can define the required log event structure.
- **Decision:** Deferred. Not a WP-048 concern if `deriveScoringInputs` is
  split out.

---

### Pre-Flight Verdict (Binary)

❌ **DO NOT EXECUTE YET** — WP-048 has blocking dependency failures.

**Justification:**

All three prerequisite Work Packets (WP-020, WP-027, WP-030) are incomplete.
None of the required types (`FinalScoreSummary`, `ReplayInput`,
`ScenarioDefinition`) or functions (`computeFinalScores`, `replayGame`) exist
in the codebase. The `scoring/`, `replay/`, and `campaign/` directories have
not been created. While the scoring computation contract (types, pure functions,
config validation, key builders) could theoretically be implemented
independently of the upstream contracts, the `deriveScoringInputs` function
has a hard dependency on WP-020's `computeFinalScores` and the game log event
format. The risk review recommends splitting `deriveScoringInputs` out of
WP-048 to reduce upstream coupling. Additionally, the `ParBaseline` interface
should be updated to use per-event penalty baseline counts instead of a single
`escapesPar` field before execution.

**Recommended path forward:**

1. **Complete WP-020** (VP Scoring) — creates the `scoring/` directory and
   `computeFinalScores` that WP-048 depends on
2. **Complete WP-027** (Replay Harness) — creates the `replay/` directory and
   replay types that WP-048 consumes
3. **Complete WP-030** (Scenario Framework) — creates `ScenarioDefinition`
4. **Before re-running pre-flight for WP-048:**
   - Update `ParBaseline` to use `penaltyBaselineCounts: Record<PenaltyEventType, number>` instead of `escapesPar`
   - Consider splitting `deriveScoringInputs` into a separate follow-up WP
     to reduce upstream coupling
5. **Re-run pre-flight** once all three dependencies are complete

---

### Authorized Next Step

**NOT AUTHORIZED.** Do not generate a session execution prompt for WP-048.

The blocking dependencies (WP-020, WP-027, WP-030) must be completed first.
After completion, re-run this pre-flight to verify readiness.
