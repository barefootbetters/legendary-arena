# Pre-Flight Invocation — WP-030 Campaign / Scenario Framework

**Target Work Packet:** `WP-030`
**Title:** Campaign / Scenario Framework
**Previous WP Status:** WP-029 Complete (2026-04-14, commit `356a001`)
**Pre-Flight Date:** 2026-04-14
**Invocation Stage:** Pre-Execution (Scope & Readiness)

**Work Packet Class:** **Contract-Only**

WP-030 introduces data-only contracts (`ScenarioDefinition`, `CampaignDefinition`,
`CampaignState`, sub-types) and three pure utility functions
(`applyScenarioOverrides`, `evaluateScenarioOutcome`, `advanceCampaignState`).
It does not mutate `G`, wire into `game.ts`, add moves or phases, or touch
the boardgame.io lifecycle. No runtime wiring, no framework context, no
setup-time builders. This is a pure contract + pure helpers WP.

Per 01.4 §Work Packet Class, a Contract-Only WP must complete:
Dependency Check, Input Data Traceability, Structural Readiness, Scope Lock,
Test Expectations, Risk Review. Runtime Readiness, Mutation Boundary, and
Dependency Contract Verification are not strictly required but are filled in
below where relevant (type fidelity, architectural boundaries).

---

## Pre-Flight Intent

Perform a pre-flight validation for WP-030.

- Not implementing.
- Not generating code.
- Validating readiness and constraints only.

---

## Authority Chain (Read Order)

1. `.claude/CLAUDE.md` — project invariants, EC-mode rules
2. `docs/ai/ARCHITECTURE.md` — layer boundaries, persistence classes
3. `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` — category rules (engine vs setup vs data-input vs...)
4. `docs/ai/execution-checklists/EC-030-campaign-framework.checklist.md` — governing checklist
5. `docs/ai/work-packets/WP-030-campaign-scenario-framework.md` — authoritative WP
6. Dependency source files (see Dependency Contract Verification)

---

## Dependency & Sequencing Check

| WP | Status | Notes |
|---|---|---|
| WP-005A | pass | `MatchSetupConfig` exists in [matchSetup.types.ts](packages/game-engine/src/matchSetup.types.ts) (9 locked readonly fields) |
| WP-005B | pass | `makeMockCtx` exists in [test/mockCtx.ts](packages/game-engine/src/test/mockCtx.ts) (not required by WP-030, listed in Assumes) |
| WP-010 | pass | `EndgameResult` exists in [endgame/endgame.types.ts](packages/game-engine/src/endgame/endgame.types.ts) with `{ outcome, reason }` |
| WP-020 | pass | `FinalScoreSummary` exists in [scoring/scoring.types.ts:61](packages/game-engine/src/scoring/scoring.types.ts:61) |
| WP-027 | pass | `ReplayInput` exists in [replay/replay.types.ts:34](packages/game-engine/src/replay/replay.types.ts:34) |
| WP-028 | pass | `UIState` contract complete (WP-028) |
| WP-029 | pass | `UIAudience` + `filterUIStateForAudience` complete (commit `356a001`, 2026-04-14) |

**Baseline green:** `pnpm --filter @legendary-arena/game-engine build` exits 0.
`pnpm --filter @legendary-arena/game-engine test` exits 0 (340 tests, 89 suites,
0 fail, duration ~3.4s). Matches session context baseline.

**Rule:** All prerequisites are complete. Sequencing is satisfied.

---

## Dependency Contract Verification

WP-030 consumes existing engine types by import. Verified against actual source:

- [x] **`MatchSetupConfig`** — imported at type level. Shape verified at
  [matchSetup.types.ts:29-56](packages/game-engine/src/matchSetup.types.ts):
  9 readonly fields — `schemeId`, `mastermindId`, `villainGroupIds`,
  `henchmanGroupIds`, `heroDeckIds`, `bystandersCount`, `woundsCount`,
  `officersCount`, `sidekicksCount`. Matches locked values in
  `.claude/rules/code-style.md` (Data Contracts §9 locked fields).
- [x] **`EndgameResult`** — shape is
  `{ outcome: EndgameOutcome, reason: string }` where
  `EndgameOutcome = 'heroes-win' | 'scheme-wins'`. `evaluateScenarioOutcome`
  must read `result.outcome` (not `result.winner`).
- [x] **`FinalScoreSummary`** — shape is
  `{ players: PlayerScoreBreakdown[], winner: string | null }`. Available
  for outcome evaluation if conditions reference final VP.
- [x] **`ReplayInput`** — shape is
  `{ seed, setupConfig: MatchSetupConfig, playerOrder: string[], moves: ReplayMove[] }`.
  Campaign replay = ordered array of these (data-only, no engine calls).

- [x] **Cross-layer import check**: campaign files will import `type` only
  from `matchSetup.types.ts`, `endgame/endgame.types.ts`,
  `scoring/scoring.types.ts`, and `replay/replay.types.ts`. These are all
  engine type-only imports; no `boardgame.io` import; no registry import.
- [x] **`readonly` field merging**: `MatchSetupConfig`'s fields are all
  `readonly`. `Partial<MatchSetupConfig>` preserves `readonly`. Spread-based
  object construction in `applyScenarioOverrides` produces a fresh object
  that satisfies the `readonly` contract — no in-place mutation required.
- [x] **`CampaignState` is NOT a field of `LegendaryGameState`** — verified
  at [types.ts:234](packages/game-engine/src/types.ts:234). WP-030 must not
  add one.
- [x] **Functions WP-030 calls are actually exported**: N/A — WP-030
  introduces new functions; it does not invoke engine functions at runtime.
  It only imports types.
- [x] **No move-vs-helper confusion**: WP-030 introduces pure helpers only;
  no move functions are extended or added.
- [x] **No runtime registry access** — campaign files are standalone and
  never read registry data.
- [x] **Decision ID references exist**: D-0501 ([DECISIONS.md:154](docs/ai/DECISIONS.md:154)),
  D-0502 ([DECISIONS.md:162](docs/ai/DECISIONS.md:162)),
  D-0603 ([DECISIONS.md:188](docs/ai/DECISIONS.md:188)) — all three verified
  by title match in DECISIONS.md (em-dash search fallback applied).

No name, field, or signature drift detected between WP-030 text and actual
dependency source.

---

## Input Data Traceability Check

- [x] All non-user-generated inputs consumed by this WP are listed in
  `docs/03.1-DATA-SOURCES.md` — **N/A**. WP-030 consumes no external data.
  It defines TypeScript types and pure functions. No registry reads, no
  card JSON loads, no database reads, no R2 fetches. `MatchSetupConfig`,
  `EndgameResult`, `FinalScoreSummary`, `ReplayInput` are engine-internal
  runtime types, not external data sources.
- [x] Storage location for each input — N/A (no inputs).
- [x] Data source for debugging incorrect behavior — campaign test files.
  All behavior is pure and deterministic against synthetic fixtures.
- [x] WP does not introduce "implicit data" — YES, verified. All values
  come from caller-supplied `ScenarioDefinition` / `CampaignState` objects.
- [x] Setup-time derived fields — N/A. Campaign code runs outside setup
  and never writes to `G`.

**Verdict:** Data traceability not applicable. No NO answers.

---

## Structural Readiness Check

- [x] All prior WPs compile and tests pass — 340 tests, 89 suites, 0 fail.
- [x] No known EC violations remain open — confirmed (WP-029 post-mortem
  clean; commit `356a001` and `3c9571e` landed clean).
- [x] Required types/contracts exist and are exported as referenced
  (`MatchSetupConfig`, `EndgameResult`, `FinalScoreSummary`, `ReplayInput`
  all exported from [index.ts](packages/game-engine/src/index.ts)).
- [x] No naming or ownership conflicts — `ScenarioDefinition`,
  `CampaignDefinition`, `CampaignState`, `ScenarioOutcomeCondition`,
  `ScenarioReward`, `CampaignUnlockRule` are all new; no collisions found
  in the game-engine tree.
- [x] No architectural boundary conflicts — campaign code lives in a new
  `src/campaign/` directory (see §Code Category Boundary Check below).
- [x] Database/migration — N/A.
- [x] R2 data — N/A.
- [x] G field subfields — N/A (WP-030 does not read G).

All YES. Structural readiness passes.

---

## Code Category Boundary Check

**Blocking finding — requires pre-session action.**

WP-030 creates a new directory `packages/game-engine/src/campaign/`. This
directory is **not currently listed** in
[02-CODE-CATEGORIES.md](docs/ai/REFERENCE/02-CODE-CATEGORIES.md).

Per 01.4 §Code Category Boundary Check:
> "If the WP creates files in a new directory not currently listed in
> `docs/ai/REFERENCE/02-CODE-CATEGORIES.md`: the directory must be classified
> under an existing category before execution. Document the classification in
> DECISIONS.md."

Precedents:
- **D-2706** — `src/replay/` classified as engine category (WP-027)
- **D-2801** — `src/ui/` classified as engine category (WP-028)

Campaign code is pure, deterministic, has no I/O, does not import
`boardgame.io`, does not import `@legendary-arena/registry`, does not mutate
`G`, and follows all engine-category rules. It qualifies for the `engine`
category by the same reasoning as `src/replay/` and `src/ui/`.

**Pre-session action required:**

1. Add a DECISIONS.md entry (proposed `D-3001 — Campaign Directory Classified
   as Engine Code Category`) following the D-2706 / D-2801 template.
2. (Optional) Update
   [02-CODE-CATEGORIES.md](docs/ai/REFERENCE/02-CODE-CATEGORIES.md) §engine
   "Directories" list to include `packages/game-engine/src/campaign/` if the
   repo follows the pattern of listing classified directories there (matches
   how WP-028 updated the category doc for `src/ui/`).

This is a scope-neutral governance action — no code scope changes. Once
resolved, the Code Category Boundary check passes.

Other boundary checks:
- [x] All new files fall cleanly into the `engine` code category (pure,
  deterministic, no framework imports, no I/O).
- [x] No file blurs category boundaries — campaign files do not import
  `boardgame.io`, `@legendary-arena/registry`, or any `apps/*` code.
- [x] Test file uses `node:test` / `node:assert` — matches test category rules.

---

## Scope Lock (Critical)

### WP-030 Is Allowed To

**Create:**
- `packages/game-engine/src/campaign/campaign.types.ts` — new — type-only
  definitions: `ScenarioDefinition`, `ScenarioOutcomeCondition`,
  `ScenarioReward`, `CampaignDefinition`, `CampaignUnlockRule`, `CampaignState`.
  Imports `type { MatchSetupConfig }` only.
- `packages/game-engine/src/campaign/campaign.logic.ts` — new — three pure
  functions: `applyScenarioOverrides`, `evaluateScenarioOutcome`,
  `advanceCampaignState`. Type-only imports from campaign types, match
  setup types, endgame types, scoring types.
- `packages/game-engine/src/campaign/campaign.logic.test.ts` — new — exactly
  **8 tests** (enumerated in the WP's Scope §E). Uses `node:test` and
  `node:assert` only.

**Modify:**
- `packages/game-engine/src/types.ts` — re-export campaign types (matching
  the existing re-export pattern for `MatchSnapshot`, `LobbyState`,
  `VillainDeckState`, etc.). **Must NOT** add `CampaignState` as a field of
  `LegendaryGameState`.
- `packages/game-engine/src/index.ts` — export campaign types and the three
  logic functions.

**Update governance docs after execution:**
- `docs/ai/STATUS.md` — note campaign/scenario contracts exist; D-0501 and
  D-0502 implemented.
- `docs/ai/DECISIONS.md` — at minimum: why `CampaignState` is external to
  `G`, why scenarios produce `MatchSetupConfig` (not modified G), how
  campaign replay works as a sequence of `ReplayInput` objects.
- `docs/ai/work-packets/WORK_INDEX.md` — check WP-030 off with today's date.

### WP-030 Is Explicitly NOT Allowed To

- Modify `game.ts`, any file under `src/moves/`, any file under `src/rules/`,
  or any other gameplay engine code.
- Add `CampaignState` (or any campaign field) to `LegendaryGameState`.
- Import `boardgame.io` in any campaign file.
- Import `@legendary-arena/registry` in any campaign file.
- Use `.reduce()` in campaign logic — use `for...of` per `.claude/rules/code-style.md`.
- Use `Math.random()` — campaign logic has no randomness in MVP.
- Introduce new `RuleEffect`, `RuleTriggerName`, phase, stage, or move.
- Use `require()`; ESM `import`/`export` only.
- Perform file I/O, database access, HTTP, or environment reads.
- Wire campaign code into the boardgame.io lifecycle (no `game.ts` phase
  hooks, no `onBegin`, no move dispatch).
- Mutate input objects in `advanceCampaignState` — must return a new object.
- Expand `CoreMoveName` / `CORE_MOVE_NAMES`.
- Create new `.claude/rules/*.md` files.
- Touch any file outside the `## Files Expected to Change` list.

**Rule:** Anything not explicitly allowed is out of scope.

---

## Test Expectations (Locked Before Execution)

- **New tests:** exactly **8** in
  `packages/game-engine/src/campaign/campaign.logic.test.ts`, matching the
  WP's enumeration:
  1. `applyScenarioOverrides` produces a valid `MatchSetupConfig`
  2. `applyScenarioOverrides` with no overrides returns the base config
  3. `evaluateScenarioOutcome` returns `'victory'` when conditions met
  4. `evaluateScenarioOutcome` returns `'defeat'` when failure conditions met
  5. `advanceCampaignState` appends completed scenario
  6. `advanceCampaignState` returns new object (input not mutated)
  7. All types are JSON-serializable (stringify roundtrip)
  8. Campaign state does NOT contain `G` or engine internals
- **Existing test changes:** none expected. No prior test is touched. No
  integration test asserts stub campaign behavior because none exists.
- **Prior test baseline:** 340 tests, 89 suites, 0 fail must remain green.
  After WP-030, expected count = **348 tests, 90 suites, 0 fail**.
- **Test boundaries:** no `boardgame.io/testing` imports; no modifications
  to `makeMockCtx` or other shared test helpers; no new logic in existing
  test files.
- **Defensive guards:** none required — WP-030 does not modify any field
  consumed by existing tests, and existing tests do not import from
  `src/campaign/`.

**Rule:** Test expectations are locked. If the implementing session
discovers more or fewer tests are needed, the deviation must be documented
in the execution summary and justified in the pre-commit review.

---

## Risk & Ambiguity Review

| # | Risk / Ambiguity | Impact | Mitigation | Decision / pattern to follow |
|---|---|---|---|---|
| 1 | `src/campaign/` not classified in 02-CODE-CATEGORIES.md | MEDIUM | Pre-session action: create D-3001 classifying `src/campaign/` as engine category, following D-2706 / D-2801 template | Locked as engine category; no boardgame.io, no registry, no I/O, no mutation |
| 2 | `exactOptionalPropertyTypes` strictness for optional fields (`description?`, `setupOverrides?`, `victoryConditions?`, `failureConditions?`, `rewards?`, `unlockRules?`) | MEDIUM | Use conditional assignment pattern — build base object, then assign optional fields in `if` blocks. Do not use inline ternaries returning `T \| undefined` for optional properties | WP-029 precedent (D-2903 / exactOptionalPropertyTypes lesson). Apply to `applyScenarioOverrides` and any helpers constructing `ScenarioDefinition` / `CampaignDefinition` in tests |
| 3 | `advanceCampaignState` accidentally mutates its `state` argument | HIGH | WP explicitly requires returning a new object. Test 6 asserts input not mutated. No spread on `rewards`/`completedScenarios` arrays without a fresh array literal | Locked as pure function; use `{ ...state, completedScenarios: [...state.completedScenarios, scenarioId], rewards: [...state.rewards, ...newRewards] }` pattern |
| 4 | `applyScenarioOverrides` shallow-merges nested arrays incorrectly (e.g., `villainGroupIds` override replaces instead of appending — or vice versa) | MEDIUM | WP says "merges scenario overrides into a base config" but doesn't specify append vs replace semantics. Lock replace semantics: any field present in `setupOverrides` replaces the base field wholesale. This matches `Partial<T>` semantics | Replace-on-override semantics locked; test 1 must assert the replaced value, test 2 must assert base config returned unchanged when `setupOverrides` is `undefined` or empty |
| 5 | `ScenarioOutcomeCondition` / `ScenarioReward` discriminated unions may be underspecified in WP | LOW | WP gives two examples: `{ type: 'heroesWin' }`, `{ type: 'counterReached'; key: string; threshold: number }` and `{ type: 'unlockScenario'; scenarioId: string }`. Lock the MVP union to exactly those three variants; tests only exercise these | Use type-discriminated union with a `type` field; executors use an exhaustive `switch`; an unknown `type` at runtime is a TypeScript impossibility because the union is closed. Do NOT introduce canonical-array drift tests at MVP |
| 6 | `evaluateScenarioOutcome` reads `EndgameResult.outcome` to decide victory; may confuse with `FinalScoreSummary.winner` (player ID) | LOW | Lock: `{ type: 'heroesWin' }` is satisfied when `result.outcome === 'heroes-win'`. `{ type: 'counterReached' }` reads `scores` or counters — for MVP, read `scores.players[*].totalVP` only if needed; otherwise defer to a future WP | Lock for execution: victory/failure conditions at MVP only inspect `EndgameResult.outcome` and a simple counter-reached check. `FinalScoreSummary` is accepted as a parameter but may only be used by `counterReached` if the condition `key` matches a score field |
| 7 | Test 7 (JSON-serializable roundtrip) may accidentally verify shape equality after `JSON.parse(JSON.stringify(x))` without checking no functions/Maps/Sets leak in | LOW | Use `deepStrictEqual` on the parsed object. Do not use `stringify` alone — that doesn't prove serializability for exotic values. Also assert that the input has no non-own enumerable properties | Use `assert.deepStrictEqual(JSON.parse(JSON.stringify(value)), value)` as the canonical JSON roundtrip test |
| 8 | Test 8 ("campaign state does not contain G") may be tautological if not written carefully | LOW | Assert `CampaignState` TypeScript type has no intersection with `LegendaryGameState` — at runtime, assert a sample `CampaignState` has only the four expected keys: `campaignId`, `completedScenarios`, `currentScenarioId`, `rewards`. No `G`, no `piles`, no `messages`, no `counters` | Runtime assertion over `Object.keys(campaignState).sort()` equal to `['campaignId', 'completedScenarios', 'currentScenarioId', 'rewards']` |
| 9 | Lifecycle wiring creep — agent may "helpfully" wire `applyScenarioOverrides` into `game.ts` or a setup hook | MEDIUM | Session prompt must explicitly prohibit: no `game.ts` import, no phase hook usage, no `Game.setup()` integration. Campaign functions are called only from the future application layer, never from the engine's boardgame.io lifecycle | Locked prohibition to include in session prompt, matching WP-028 lifecycle prohibition precedent for `buildUIState` |
| 10 | Projection aliasing — `applyScenarioOverrides` may return a result that aliases `setupOverrides`'s array fields (e.g., `villainGroupIds`) | MEDIUM | Spread-copy all array fields that come from overrides: `villainGroupIds: overrides.villainGroupIds ? [...overrides.villainGroupIds] : base.villainGroupIds`. Same for `henchmanGroupIds`, `heroDeckIds`. Post-mortem should trace returned arrays to their source | Spread-copy discipline locked for all array-typed fields in the returned `MatchSetupConfig`. Note: this is less strict than G-aliasing because neither source nor target is `G`, but is still required because the engine assumes `MatchSetupConfig` is effectively immutable |
| 11 | Decision ID encoding mismatch in DECISIONS.md (em-dash vs hyphen) | LOW | D-0501, D-0502, D-0603 verified by grep on both forms and by title match. No issue found | WP-028 precedent — search by title keyword as a fallback. Already applied |

**Locking rule:** Items 1-11 are now locked for execution. The session
prompt may transcribe them but not reinterpret or weaken them.

---

## Maintainability & Upgrade Readiness

Not strictly required for Contract-Only WPs, but the WP introduces long-lived
types that future WPs will consume. Sanity check:

- [x] **Extension seam exists** — `ScenarioOutcomeCondition` and
  `ScenarioReward` are discriminated unions keyed on `type`. Future WPs can
  add variants without refactoring existing code. The executor uses
  exhaustive `switch`, which TypeScript will warn about when a variant is
  missing.
- [x] **Patch locality** — all campaign logic lives in one file
  (`campaign.logic.ts`). Bug fixes in condition evaluation or reward
  application affect at most 2 files (logic + test).
- [x] **Fail-safe behavior** — `evaluateScenarioOutcome` returns
  `'incomplete'` when neither victory nor failure conditions are met —
  explicit tri-state prevents silent defaults. `applyScenarioOverrides` with
  empty `setupOverrides` returns a copy of the base config unchanged.
  `advanceCampaignState` with an unknown scenario ID still returns a valid
  state (just appends to `completedScenarios`; does not throw).
- [x] **Deterministic reconstructability** — all functions are pure. Given
  identical inputs, outputs are identical. No hidden state.
- [x] **Backward-compatible test surface** — no existing tests consume
  campaign types, so backward compatibility is trivially satisfied.
- [x] **Semantic naming stability** — names are domain-stable:
  `ScenarioDefinition`, `CampaignState`, `applyScenarioOverrides`. No
  `Simple`, `V1`, `Temp`, or `Inline` suffixes.

All YES. Design is maintainable.

---

## Established Patterns to Follow (Locked Precedents for WP-030)

From 01.4 §Established Patterns:

- **Pure helpers return new values; no in-place mutation** — all three
  campaign functions must be pure.
- **Data-only contracts; handler functions never in G** — `CampaignState`
  is Class 2 (Configuration), JSON-serializable, no functions.
- **Persistence class separation** — `CampaignState` is Class 2; individual
  game `G` remains Class 1. WP-030 must not mix these.
- **Discriminated union + exhaustive switch for extensibility** —
  `ScenarioOutcomeCondition.type`, `ScenarioReward.type` follow the
  `RuleEffect` / `HookDefinition` pattern.
- **New types defined in dedicated contract files** — `campaign.types.ts`
  exists for shared types; no inline definitions in `campaign.logic.ts`.
- **`exactOptionalPropertyTypes` strictness** — WP-029 precedent. Use
  conditional assignment for optional fields.
- **Projection copy discipline** — spread-copy array fields returned from
  `applyScenarioOverrides`. WP-028 precedent.
- **Lifecycle prohibition for non-framework code** — campaign functions
  must never be wired into `game.ts`, moves, or phase hooks. WP-028 precedent.
- **Classify new engine directories via DECISIONS.md entry** —
  D-2706 / D-2801 precedent. See §Code Category Boundary Check.

Deviations from these patterns require explicit justification.

---

## Pre-Flight Verdict (Binary)

**READY TO EXECUTE — conditional on one pre-session action.**

Justification:

1. **Dependencies complete.** WP-029 is committed (`356a001`), baseline is
   green (340 tests, 89 suites, 0 fail), and all referenced types
   (`MatchSetupConfig`, `EndgameResult`, `FinalScoreSummary`, `ReplayInput`)
   exist at the paths and shapes the WP text claims.
2. **Contract fidelity verified.** Dependency Contract Verification found
   no name, field, or signature drift. D-0501, D-0502, D-0603 exist in
   DECISIONS.md under their documented titles.
3. **Scope is narrow and clear.** WP-030 is Contract-Only: 2 new files
   in a new `src/campaign/` directory, 2 modified export files, 1 new
   test file with 8 enumerated tests. No engine mutation, no lifecycle
   wiring, no framework context.
4. **Risks identified and locked.** 11 risk items locked for execution,
   covering `exactOptionalPropertyTypes` strictness, mutation discipline,
   merge semantics, aliasing, lifecycle prohibition, and test-assertion
   precision.
5. **Architectural boundaries clean.** Campaign code is pure, deterministic,
   has no I/O, does not import `boardgame.io` or the registry, and does
   not mutate `G`. `CampaignState` is Class 2, external to
   `LegendaryGameState`.
6. **Maintainability check passes.** Discriminated unions provide an
   extension seam; pure functions give patch locality; tri-state outcome
   (`'victory'` / `'defeat'` / `'incomplete'`) gives fail-safe behavior.

**Blocking item requiring resolution before session execution:**

- **PS-1 (pre-session):** Create a new DECISIONS.md entry (suggested
  `D-3001 — Campaign Directory Classified as Engine Code Category`),
  following the D-2706 / D-2801 template. Rationale: campaign files are
  pure, have no I/O, do not import `boardgame.io` or registry, and
  follow all engine-category rules. Without this entry, WP-030 creates
  an unclassified directory, which is a blocking 01.4 §Code Category
  Boundary Check finding.

Once PS-1 is applied, the verdict is unconditionally READY TO EXECUTE.
No re-run of pre-flight is required — PS-1 is a scope-neutral governance
correction that resolves a risk this pre-flight identified, without
changing WP scope.

---

## Invocation Prompt Conformance Check (Pre-Generation)

To be verified when the session prompt is generated for WP-030 (step 2):

- [ ] All EC-030 locked values copied verbatim into the invocation prompt
      (`ScenarioDefinition`, `CampaignDefinition`, `CampaignState` shapes)
- [ ] No new keywords, helpers, file paths, or timing rules appear only
      in the prompt
- [ ] File paths, extensions, and test locations match WP-030 exactly
      (5 files: `campaign.types.ts`, `campaign.logic.ts`,
      `campaign.logic.test.ts`, `types.ts`, `index.ts`)
- [ ] No forbidden imports or behaviors introduced by wording changes
      (no `boardgame.io`, no registry, no `.reduce()`, no `Math.random()`)
- [ ] The prompt does not resolve ambiguities that were not resolved in
      this pre-flight (risks 1-11 are the complete locked set)
- [ ] Contract names and field names in the prompt match the verified
      dependency code (`EndgameResult.outcome`, not `EndgameResult.winner`)
- [ ] Helper call patterns in the prompt reflect actual signatures
      (`applyScenarioOverrides(baseConfig, scenario): MatchSetupConfig`,
      `evaluateScenarioOutcome(result, scores, conditions): 'victory' | 'defeat' | 'incomplete'`,
      `advanceCampaignState(state, scenarioId, outcome, rewards): CampaignState`)
- [ ] Session prompt includes explicit lifecycle prohibition: campaign
      functions must not be called from `game.ts`, phase hooks, or moves
- [ ] Session prompt includes explicit `exactOptionalPropertyTypes`
      guidance (conditional assignment for optional fields)
- [ ] Session prompt includes explicit spread-copy discipline for array
      fields returned by `applyScenarioOverrides`

---

## Authorized Next Step

Once PS-1 is applied:

> You are authorized to generate a session execution prompt for WP-030
> to be saved as:
> `docs/ai/invocations/session-wp030-campaign-framework.md`

**Guard:** The session prompt must conform exactly to the scope, constraints,
and decisions locked by this pre-flight. No new scope may be introduced.

**Pre-session actions — ALL RESOLVED (2026-04-14):**

1. **PS-1 — RESOLVED.** Created [D-3001 — Campaign Directory Classified as
   Engine Code Category](docs/ai/DECISIONS.md) at
   [DECISIONS.md:2981](docs/ai/DECISIONS.md:2981), following the D-2706
   (replay) and D-2801 (ui) template. Rationale cites purity, no I/O, no
   `boardgame.io` / registry imports, and orthogonality with D-0502
   (campaign state external to `LegendaryGameState`). Status: Immutable.

   `02-CODE-CATEGORIES.md` §engine Directories list was **not** updated,
   matching the precedent of WP-027 (D-2706) and WP-028 (D-2801) — the
   DECISIONS.md entry is the authoritative classification; the category
   doc's Directories list is a non-exhaustive summary.

All mandatory pre-session actions are complete. No re-run of pre-flight
required — this update resolves a risk identified by this pre-flight
without changing WP scope.

**Verdict is now unconditionally READY TO EXECUTE.**

---

## External Review — Disposition Log (2026-04-14)

An external reviewer (not this pre-flight author) proposed a set of
improvements. Each has been verified against the repo and dispositioned:

### Rejected as factually incorrect

- **"PS-0 — D-0603 missing from DECISIONS.md"** — REJECTED. Verified
  D-0603 exists at [DECISIONS.md:188](docs/ai/DECISIONS.md:188):
  `### D‑0603 — Representation Before Execution`. The reviewer's
  Sharepoint view was stale or incomplete. No action.
- **"WORK_INDEX marks WP-030 as Needs review"** — REJECTED. Verified
  [WORK_INDEX.md:628](docs/ai/work-packets/WORK_INDEX.md:628) reads
  `- [ ] WP-030 — Campaign / Scenario Framework ✅ Reviewed`. The
  reviewer conflated two orthogonal status dimensions: `[ ]` (pending
  execution) vs `✅ Reviewed` (document approved for execution). WP-030
  is reviewed and ready. No action.
- **"Add grep verification step for forbidden imports"** — REDUNDANT.
  Already present in WP-030 Verification Steps §Step 3 (no
  `boardgame.io`) and §Step 6 (no registry). The reviewer missed them.
  No action.
- **Reviewer's D-3001 stub format (`#### D‑3001`, `Status: Active
  Policy`)** — REJECTED. The actual D-3001 entry uses `### D-3001`
  heading and `Status: Immutable`, matching D-2706 / D-2801 house
  style. Kept the house-style version.

### Accepted and applied

- **Trailing stray backticks at end of DECISIONS.md** — APPLIED. Line
  3018 had an orphaned `` `` `` after "Protect this file." Removed.
- **`advanceCampaignState(outcome: string)` type tightening** — APPLIED.
  Introduced a named `ScenarioOutcome = 'victory' | 'defeat' | 'incomplete'`
  union in `campaign.types.ts`. Updated both function signatures in
  WP-030:
  - `evaluateScenarioOutcome(...): ScenarioOutcome` (was inline literal)
  - `advanceCampaignState(..., outcome: ScenarioOutcome, ...)` (was
    `outcome: string`)
  - Added the `ScenarioOutcome` type to EC-030 Locked Values above the
    `ScenarioDefinition` shape.
  Rationale: callers cannot pass `'Victory'` or `'win'` — compile-time
  safety prevents outcome-string drift between the two functions. This
  is scope-neutral (no new behavior, just better types).
- **Merging rule consolidation** — APPLIED inline below. Risks #4
  (replace-on-override semantics) and #10 (array aliasing) are now
  restated together as a single locked rule for implementer clarity.

### Merging Rule (Locked — consolidates risks #4 and #10)

`applyScenarioOverrides(baseConfig, scenario)` has the following
**locked** semantics:

1. **Replace-on-override.** Any field present in
   `scenario.setupOverrides` replaces the corresponding base field
   wholesale. No field-level append, no deep merge, no union. This
   matches `Partial<MatchSetupConfig>` semantics.
2. **No aliasing.** Every array field that comes from
   `scenario.setupOverrides` must be spread-copied into the result
   (`[...overrides.villainGroupIds]`, etc.) so that downstream mutation
   of the returned `MatchSetupConfig` cannot mutate the original
   `ScenarioDefinition`. This applies to `villainGroupIds`,
   `henchmanGroupIds`, and `heroDeckIds`.
3. **Undefined or empty overrides return a copy of the base config.**
   `applyScenarioOverrides(base, scenarioWithNoOverrides)` returns a
   `MatchSetupConfig` that is structurally equal to `base` but is a new
   object (so consumers may not assume reference equality with `base`).
4. **Post-mortem trace requirement.** After execution, every returned
   array must be traced to its source. If any returned array is a
   direct reference to `scenario.setupOverrides[...]`, the
   implementation is wrong. This is lower-risk than G-aliasing
   (WP-028 precedent) but still required.

Tests 1 and 2 already cover (1) and (3). A post-mortem check is
required for (2) and (4) — see Risk Review §10.

---

### Contract reconciliation note

Because the pre-flight now locks `ScenarioOutcome` as a named union, the
session prompt (step 2) must transcribe the updated WP-030 function
signatures verbatim, not the pre-tightening versions:

- `evaluateScenarioOutcome(...): ScenarioOutcome`
- `advanceCampaignState(..., outcome: ScenarioOutcome, ...)`

and must include the `ScenarioOutcome` type definition in the
`campaign.types.ts` file contents.

---

## Final Instruction

Pre-flight exists to prevent premature execution and scope drift.

WP-030 is tightly scoped, well-understood, and ready to execute once the
code category classification entry is in place. Do not proceed to step 2
(session prompt generation) until PS-1 is resolved.
