# Post-Mortem — WP-030 Campaign / Scenario Framework

Applies `docs/ai/REFERENCE/01.6-post-mortem-checklist.md`.

---

### 0. Metadata

- **Work Packet:** WP-030
- **Title:** Campaign / Scenario Framework
- **Execution Date:** 2026-04-14
- **EC Used:** EC-030
- **Pre-Flight Date:** 2026-04-14
  ([preflight-wp030-campaign-framework.md](docs/ai/invocations/preflight-wp030-campaign-framework.md))
- **Session Prompt:**
  ([session-wp030-campaign-framework.md](docs/ai/invocations/session-wp030-campaign-framework.md))
- **Test Baseline:** 340 tests / 89 suites → **348 tests / 93 suites**
- **Post-Mortem Required:** Yes — WP introduces new contract types
  consumed by future WPs, a new code category directory (`src/campaign/`),
  and a new long-lived abstraction (extension seam via discriminated
  unions). Mandatory per 01.6 §When Post-Mortem Is Required.

---

### 1. Binary Health Check

- [x] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [x] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [x] Correct number of new tests added — **8 tests** in 4 `describe`
  blocks, matching WP-030 §E exactly
- [x] No existing test files modified — `git diff --name-only` shows
  only the new `campaign.logic.test.ts` file; no `.test.ts` file under
  `packages/game-engine/src/` was touched
- [x] No scope expansion occurred during execution — files modified
  match the WP allowlist exactly
- [x] EC-030 acceptance criteria all pass (build green, tests green,
  `CampaignState` not in `LegendaryGameState`, no engine files modified,
  no boardgame.io/registry imports, no `.reduce()`, no `require()`)

**Verdict:** All items YES. Proceed.

---

### 2. Scope & Allowlist Audit

Diff (`git status --short`) breakdown:

| File | Status | Allowlist | Justification |
|---|---|---|---|
| `.claude/settings.local.json` | M | N/A | Pre-existing dirty state at session start (in original git status); WP-030 did not touch it |
| `docs/ai/DECISIONS.md` | M | ✅ Allowed | D-3001 (PS-1 resolution), trailing backticks cleanup (review phase), D-3002/3003/3004 (post-execution documentation) |
| `docs/ai/STATUS.md` | M | ✅ Allowed | WP-030 entry added per WP-030 DoD |
| `docs/ai/execution-checklists/EC-030-campaign-framework.checklist.md` | M | ✅ Allowed | `ScenarioOutcome` tightening during external-review phase (pre-execution) |
| `docs/ai/work-packets/WORK_INDEX.md` | M | ✅ Allowed | WP-030 checked off per WP-030 DoD |
| `docs/ai/work-packets/WP-030-campaign-scenario-framework.md` | M | ✅ Allowed | `ScenarioOutcome` tightening during external-review phase (pre-execution) |
| `packages/game-engine/src/index.ts` | M | ✅ Allowed | Campaign exports appended at end, purely additive |
| `packages/game-engine/src/types.ts` | M | ✅ Allowed | Campaign re-export block added between UI re-export and local imports; `LegendaryGameState` unchanged |
| `docs/ai/invocations/preflight-wp030-campaign-framework.md` | ?? | N/A | Pre-flight governance artifact |
| `docs/ai/invocations/session-wp030-campaign-framework.md` | ?? | N/A | Session prompt governance artifact |
| `docs/ai/invocations/postmortem-wp030-campaign-framework.md` | ?? | N/A | This document |
| `packages/game-engine/src/campaign/campaign.types.ts` | ?? | ✅ Allowed | New file per WP-030 §A |
| `packages/game-engine/src/campaign/campaign.logic.ts` | ?? | ✅ Allowed | New file per WP-030 §B |
| `packages/game-engine/src/campaign/campaign.logic.test.ts` | ?? | ✅ Allowed | New file per WP-030 §E |

Out-of-scope untracked files NOT touched by this WP (flagged for
awareness, not action):
- `docs/ai/REFERENCE/01.5-copilot-check.md` — new in untracked state but
  I did not create it. Not WP-030.
- `docs/ai/session-context/session-context-wp029.md`,
  `docs/legendary-arena-*`, `docs/upper-deck-*` — pre-existing untracked
  state at session start, not WP-030.

- [x] Only files listed in the WP allowlist were modified
- [x] No contract files modified unless explicitly authorized (the
  `ScenarioOutcome` tightening of EC-030 / WP-030 was authorized by the
  external-review disposition log in the pre-flight)
- [x] No "while I'm here" refactors slipped in
- [x] No formatting-only or cleanup-only edits were added
- [x] No new files created outside WP scope

**Verdict:** Scope lock clean.

---

### 3. Boundary Integrity Check

#### Framework Boundaries

- [x] No `boardgame.io` imports in campaign files. Verified by grep:
  ```
  grep -rn "boardgame.io" packages/game-engine/src/campaign/
  ```
  Matches only doc comments (`campaign.logic.ts:14` and
  `campaign.logic.test.ts:10`) stating *"no boardgame.io"* — no
  `import ... from 'boardgame.io'` statements.
- [x] No framework `ctx` leaking into pure helpers. Campaign functions
  accept typed parameters (`MatchSetupConfig`, `EndgameResult`,
  `FinalScoreSummary`, `CampaignState`) — none take a boardgame.io `ctx`.
- [x] No lifecycle coupling. `applyScenarioOverrides`,
  `evaluateScenarioOutcome`, and `advanceCampaignState` are **not**
  called from `game.ts`, moves, phase hooks, setup builders, or any
  existing engine code. Verified by grep:
  ```
  grep -rn "applyScenarioOverrides\|evaluateScenarioOutcome\|advanceCampaignState" packages/game-engine/src/
  ```
  Matches only their definitions, their test file, and the `index.ts`
  re-export. No lifecycle site calls them.

#### Registry / IO Boundaries

- [x] No registry imports. Verified by grep:
  ```
  grep -rn "@legendary-arena/registry" packages/game-engine/src/campaign/
  ```
  Empty.
- [x] No filesystem, network, or persistence access. Campaign files
  contain no `fs`, `http`, `fetch`, `pg`, `process.env`, or any
  equivalent. Confirmed by inspection.

#### Code Category Compliance

- [x] `packages/game-engine/src/campaign/` classified as `engine` code
  category via D-3001 (created during pre-flight as PS-1 resolution).
  Follows D-2706 (replay) and D-2801 (ui) precedent.
- [x] All campaign files honor engine category rules: pure,
  deterministic, no I/O, no framework imports, no `Math.random()`, no
  mutation of inputs.
- [x] No setup-time code placed in engine-only directories (campaign
  files contain no setup-time builders).
- [x] No execution logic placed in data/type-only files
  (`campaign.types.ts` contains only type and interface declarations;
  logic lives exclusively in `campaign.logic.ts`).

**Verdict:** All boundaries intact.

---

### 4. Representation & Determinism Audit

- [x] New representations are **data-only** and JSON-serializable.
  `ScenarioDefinition`, `CampaignDefinition`, `CampaignState`,
  `ScenarioOutcomeCondition`, `ScenarioReward`, `CampaignUnlockRule`,
  `ScenarioOutcome` all contain only strings, numbers, nulls, arrays,
  and nested objects of the same. Test 7 (`all types are
  JSON-serializable`) asserts this via
  `deepStrictEqual(JSON.parse(JSON.stringify(x)), x)` on one example of
  each public type.
- [x] Execution logic is deterministic.
  - `applyScenarioOverrides` reads only its parameters; output depends
    entirely on inputs.
  - `evaluateScenarioOutcome` reads only its parameters; output is a
    pure function of `result.outcome`, `scores.players[*].totalVP`,
    and the condition arrays. Loss-before-victory evaluation order is
    deterministic and explicitly documented (D-1235 precedent).
  - `advanceCampaignState` reads only its parameters; output is a pure
    function of them.
- [x] No hidden state, caching, or memoization. No module-level `let`
  or `const` that accumulates state in `campaign.logic.ts`. Inspected.
- [x] Unknown / future values fail safely.
  - Unknown `counterReached` keys (e.g., anything other than
    `heroesTotalVP`) return `false` rather than throwing, preserving
    the extension seam for future WPs.
  - Exhaustive `switch` on `condition.type` uses a `never` branch that
    will force a TypeScript error if a new variant is added without
    handling — compile-time protection, not runtime.
  - `undefined` victory/failure condition arrays are treated as empty;
    no throw.
  - `undefined` `setupOverrides` returns a fresh copy of the base
    config; no throw.
- [x] No `Math.random()`, `Date.now()`, `performance.now()`, locale-
  dependent formatting, or unstable iteration order. Verified by grep:
  ```
  grep -rn "Math\.random\|Date\.now\|performance\.now\|toLocaleString" packages/game-engine/src/campaign/
  ```
  Empty.

**Verdict:** Representation and determinism both clean.

---

### 5. Mutation, Aliasing, & Reference Safety (High-Risk)

**This section was reviewed deliberately per 01.6 §5. Each returned
value in campaign.logic.ts was traced to its source.**

#### `applyScenarioOverrides` — no-overrides branch

Returns a new object literal. Array fields:

| Return field | Source | Copy discipline |
|---|---|---|
| `villainGroupIds` | `[...baseConfig.villainGroupIds]` | ✅ spread copy |
| `henchmanGroupIds` | `[...baseConfig.henchmanGroupIds]` | ✅ spread copy |
| `heroDeckIds` | `[...baseConfig.heroDeckIds]` | ✅ spread copy |

No reference to `baseConfig` retained. **Test 2 asserts
`result.villainGroupIds !== BASE_CONFIG.villainGroupIds`** (and the
other two array fields) to prove reference inequality at runtime.

#### `applyScenarioOverrides` — overrides branch

Array fields use ternary:

```ts
const villainGroupIds = overrides.villainGroupIds
  ? [...overrides.villainGroupIds]
  : [...baseConfig.villainGroupIds];
```

Both branches produce spread copies. The returned object contains
**no** direct reference to either `overrides` or `baseConfig`. Same
pattern applies to `henchmanGroupIds` and `heroDeckIds`.

Scalar fields use `overrides.X ?? baseConfig.X` — primitive copy, no
aliasing possible.

#### `evaluateScenarioOutcome`

Returns a primitive string literal (`'victory'`, `'defeat'`, or
`'incomplete'`). No object return path. Inputs are read only — the
`for...of` loops over `failureConditions` and `victoryConditions` do
not write to them. No aliasing possible.

#### `advanceCampaignState`

Returns a new object literal. Fields:

| Return field | Source | Copy discipline |
|---|---|---|
| `campaignId` | `state.campaignId` (primitive string) | ✅ primitive copy |
| `completedScenarios` | `[...state.completedScenarios, scenarioId]` | ✅ fresh array (spread + append) |
| `currentScenarioId` | `null` | ✅ primitive literal |
| `rewards` | `[...state.rewards, ...rewards]` | ✅ fresh array (double spread) |

**Shallow-copy note:** The new `rewards` array contains the same
`ScenarioReward` object references as the caller's input `rewards`
parameter. These objects are data-only discriminated-union members with
only scalar fields (`{ type: 'unlockScenario'; scenarioId: string }`),
so shallow copying is sufficient: mutating a reward would require the
caller to reach into their own input array, which is their concern,
not the engine's. This is consistent with the WP-029 locked precedent
("Filter aliasing is lower-risk than projection aliasing — shallow
copies of input arrays and objects are sufficient when the entire
pipeline is pure") documented in 01.4.

**Test 6** asserts reference inequality at runtime on both the
returned object and the two array fields:
```ts
assert.notStrictEqual(result, BASE_STATE);
assert.notStrictEqual(result.completedScenarios, BASE_STATE.completedScenarios);
assert.notStrictEqual(result.rewards, BASE_STATE.rewards);
```
and asserts that the JSON form of `BASE_STATE` is unchanged pre/post
the call, which is the strongest tractable proof of non-mutation.

- [x] All mutation occurs only in authorized lifecycle contexts —
  campaign functions perform **no** mutation at all
- [x] No helpers mutate `G` or `ctx` — campaign code does not even
  reference `G` or `ctx`
- [x] No mutation during rendering, projection, or evaluation
- [x] Pure helpers are actually pure (traced above + Tests 2 and 6
  assert it)
- [x] **No aliasing bugs** — every returned array is a spread copy of
  its source; every returned object is a new object literal

**Verdict:** Aliasing and mutation safety clean. No fixes required.

---

### 6. Hidden-Coupling Detection

- [x] **No engine internals exposed through public projections.** Test
  8 enforces that `CampaignState` has exactly the key set
  `['campaignId', 'completedScenarios', 'currentScenarioId', 'rewards']`
  at runtime. No `G`, `piles`, `messages`, `counters`, `playerZones`,
  or any other engine-internal field could be added without breaking
  this test.
- [x] **No enum or union widened unintentionally.** `ScenarioOutcome`,
  `ScenarioOutcomeCondition`, and `ScenarioReward` are closed unions
  with exhaustive switches guarded by `never` branches. Adding a
  variant anywhere forces a compile-time error at the switch site.
- [x] **No implicit knowledge of upstream implementation details.**
  Campaign code consumes engine types by name (`MatchSetupConfig`,
  `EndgameResult`, `FinalScoreSummary`) but makes no assumptions about
  how those types are produced. It does not know about phases, moves,
  rule hooks, or `G` shape.
- [x] **Ordering assumptions are explicit.** Loss-before-victory is
  documented in the `evaluateScenarioOutcome` JSDoc with a reference
  to D-1235 precedent, and Test 4 exercises it by passing the same
  `heroesWin` condition in both `victoryConditions` and
  `failureConditions` arrays and asserting `'defeat'` is returned.
- [x] **No dependency on non-exported functions or internal module
  state.** `isConditionSatisfied` is a file-local helper used only by
  `evaluateScenarioOutcome`. It is not exported, which is correct —
  the exhaustive-switch behavior is an implementation detail of the
  evaluator. No external code depends on it.

**Verdict:** No hidden coupling.

---

### 7. Test Adequacy Review

- [x] **Tests fail if architectural boundaries are violated.**
  - Test 8 (`Object.keys(campaignState).sort() === [...]`) fails if
    any engine-internal field leaks into `CampaignState`.
  - Test 7 (JSON roundtrip via `deepStrictEqual`) fails if any type
    contains a function, Map, Set, Date, Symbol, or class instance.
  - Test 6 (deep-equality pre/post + reference inequality) fails if
    `advanceCampaignState` mutates its input.
  - Test 2 (reference inequality on array fields) fails if
    `applyScenarioOverrides` aliases with the input.
- [x] **Determinism is not explicitly tested** but is implied by the
  pure-function contract plus the inline inspection in Section 4. A
  dedicated determinism test would add marginal value (campaign logic
  has no randomness, no time reads, no iteration-order hazards).
  **Not blocking** — determinism is structurally guaranteed by the
  function signatures and bodies.
- [x] **Serialization is tested** (Test 7 — `deepStrictEqual` on
  `JSON.parse(JSON.stringify(x))` for 5 public types).
- [x] **Non-mutation is tested** (Test 6 for `advanceCampaignState`,
  Test 2 for `applyScenarioOverrides`).
- [x] **Tests do NOT depend on unrelated engine behavior.** Fixtures
  are inline synthetic data. No `buildInitialGameState`, no
  `makeMockCtx`, no registry reader, no real `G`.
- [x] **No tests weakened** to make things pass. All 8 tests landed
  passing on the first build.

**Verdict:** Tests are contract-enforcement quality. Adequate.

---

### 8. Documentation & Governance Updates

- [x] **DECISIONS.md** — D-3001 (campaign directory classified as
  engine category, created during pre-flight), D-3002 (campaign state
  external to G — MVP implementation), D-3003 (scenarios produce
  MatchSetupConfig, not modified G), D-3004 (campaign replay as
  sequence of ReplayInputs) all added. Each includes rationale, not
  just outcome.
- [x] **ARCHITECTURE.md** — N/A. The authoritative architecture
  document already describes campaigns as meta-orchestration external
  to the engine (D-0501, D-0502). WP-030 implements these existing
  architectural principles; it does not introduce new
  architecturally-significant concepts. Updating ARCHITECTURE.md would
  be redundant with the WP-030 §Context (Read First) section and the
  DECISIONS.md entries. **Non-blocking omission** — matches WP-028
  precedent.
- [x] **STATUS.md** — WP-030 entry added at the top with what changed,
  key decisions, architectural significance, what's true now, and
  what's next. Accurate to the executed state.
- [x] **WORK_INDEX.md** — WP-030 checked off with date `2026-04-14`
  and note about `ScenarioOutcome` tightening, parameter shape
  refinement (victoryConditions/failureConditions split), `src/campaign/`
  code-category classification (D-3001), and 01.5 not-invoked status.

**Verdict:** Governance documentation reflects reality.

---

### 9. Forward-Safety Questions

- [x] **Can this code survive future refactors without touching
  unrelated layers?** Yes. Campaign files import only type definitions
  from sibling engine files. Future refactors of `MatchSetupConfig`,
  `EndgameResult`, or `FinalScoreSummary` will either (a) be
  backwards-compatible and require no campaign changes, or (b) break
  the TypeScript compile loudly at the campaign imports, which is the
  desired failure mode.
- [x] **Can replay/debugging reconstruct behavior from stored data?**
  Yes. All three functions are pure: given identical inputs they
  produce identical outputs. A campaign bug is debuggable by capturing
  the inputs at the moment of the bug and replaying them against the
  functions locally. No hidden state, no logging required.
- [x] **Would removing upstream data still fail safely?** Yes.
  `undefined` `setupOverrides` returns a base copy. `undefined`
  condition arrays are treated as empty. Unknown `counterReached` keys
  return `false`. The only error path is a TypeScript compile error
  (e.g., a new `ScenarioOutcomeCondition` variant without a `switch`
  case), which is compile-time, not runtime.
- [x] **Is it impossible for this WP's output to influence gameplay
  unintentionally?** Yes. Campaign code is never wired into the
  boardgame.io lifecycle, moves, phase hooks, or setup builders. The
  engine does not import anything from `src/campaign/`. Gameplay
  determinism is unaffected by the presence of campaign code.
- [x] **Is the contract stable enough to be referenced by future WPs?**
  Yes. `ScenarioOutcome` is a named union (preventing outcome-string
  drift). All three functions have locked signatures in EC-030 and
  have `// why:` comments documenting the semantics that future WPs
  must preserve. Discriminated unions (`ScenarioOutcomeCondition`,
  `ScenarioReward`) provide the extension seam for future variant
  additions without refactoring.

**Verdict:** All forward-safety questions answered YES without
qualification.

---

### 10. Final Post-Mortem Verdict

- [x] **WP COMPLETE** — execution is correct, safe, and durable
- [ ] WP INCOMPLETE

**Notes / Follow-ups:**

- `ARCHITECTURE.md` does not mention `ScenarioDefinition` /
  `CampaignDefinition` / `CampaignState` by name. The principle they
  implement (D-0501, D-0502) is already documented. Updating
  ARCHITECTURE.md would be a cosmetic refresh. **Non-blocking.** Can
  be addressed in a future ARCHITECTURE.md refresh alongside the
  similar WP-028 `UIState` naming gap noted in 01.6's Precedent Log.
- An untracked file `docs/ai/REFERENCE/01.5-copilot-check.md` was
  observed in the final `git status` but was not created or touched by
  WP-030. Flagged for awareness in the execution summary; not a
  WP-030 concern.

**Fixes applied during post-mortem:**

- None. Inline verification during execution already covered the
  high-risk areas (aliasing trace, exact-key-set assertion, no engine
  file modification). The formal post-mortem document confirms the
  execution was correct, safe, and durable without requiring
  additional code changes.

**Precedent-log candidate for 01.6:**

This post-mortem is the first for a Contract-Only WP that explicitly
did **not** invoke the 01.5 runtime-wiring allowance. The finding
worth propagating is:

> *Contract-Only WPs that create a new directory require the code-
> category classification decision (D-NNNN) as a pre-flight
> precondition, and the post-mortem should explicitly verify the
> decision exists. WP-030 followed this pattern via PS-1 → D-3001.*

Consider adding a short entry to 01.6 §Precedent Log when lessons-
learned (step 7) runs.
