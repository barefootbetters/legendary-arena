# Pre-Commit Review — WP-030 Campaign / Scenario Framework

Applies `docs/ai/prompts/PRE-COMMIT-REVIEW.template.md`.

**Role:** Pre-Commit Reviewer (Non-Implementing, Gatekeeper)
**Work Packet:** WP-030 — Campaign / Scenario Framework
**Status:** Implementation complete, pending commit
**Review Date:** 2026-04-14

**Artifacts reviewed:**
- [WP-030](docs/ai/work-packets/WP-030-campaign-scenario-framework.md)
- [EC-030](docs/ai/execution-checklists/EC-030-campaign-framework.checklist.md)
- [Pre-flight](docs/ai/invocations/preflight-wp030-campaign-framework.md)
- [Session prompt](docs/ai/invocations/session-wp030-campaign-framework.md)
- [Post-mortem](docs/ai/invocations/postmortem-wp030-campaign-framework.md)
- New code files: `packages/game-engine/src/campaign/{campaign.types.ts,campaign.logic.ts,campaign.logic.test.ts}`
- Modified files: `packages/game-engine/src/{types.ts,index.ts}`
- Governance updates: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md`, `docs/ai/work-packets/WORK_INDEX.md`

---

## Executive Verdict (Binary)

**Safe to commit as-is.**

The Work Packet satisfies its declared scope exactly: three pure functions
plus the supporting data-only contract types, all additive, with zero
engine-file modification and zero lifecycle coupling. Post-mortem verified
aliasing-free return paths, exact key-set enforcement for `CampaignState`,
and the complete absence of `boardgame.io` / registry imports in campaign
files. D-3001 (engine code category classification) was established before
execution, D-0501 and D-0502 are implemented at the code level, and
`CampaignState` does not appear as a field of `LegendaryGameState`.
**WP-030 is safe to commit.**

---

## Review Axis Assessment

### 1. Scope Discipline — **Pass**

Every modified file has a scope justification:

- The 3 new `src/campaign/*.ts` files are the WP's declared new files.
- `src/types.ts` and `src/index.ts` modifications are purely additive
  re-exports — the WP explicitly allowlists both.
- `STATUS.md`, `DECISIONS.md`, `WORK_INDEX.md` updates are the WP's
  declared post-execution documentation.
- `WP-030-campaign-scenario-framework.md` and
  `EC-030-campaign-framework.checklist.md` were modified during the
  external-review phase **before** execution to introduce the named
  `ScenarioOutcome` union. Those modifications were authorized by the
  pre-flight §External Review — Disposition Log and are part of the
  approved scope.
- The pre-flight, session prompt, and post-mortem artifacts under
  `docs/ai/invocations/` are governance artifacts, not code — not
  bound by the WP allowlist.
- `.claude/settings.local.json` was in pre-existing dirty state at
  session start and was not touched by WP-030.

No "while I'm here" refactors. No speculative additions. No implicit
runtime behavior introduced — the WP is declarative (contracts + pure
helpers) and contains no lifecycle integration, no `G` mutation, no
phase hooks, no move registration.

**Declarative WP confirmation:** Explicitly confirmed that no runtime
behavior or state mutation was introduced. Campaign functions are never
called from `game.ts`, any move, any phase hook, or any setup builder.

### 2. Contract & Type Correctness — **Pass**

- `ScenarioDefinition` and `CampaignDefinition` shapes match EC-030
  Locked Values verbatim.
- `CampaignState` shape matches EC-030 Locked Values verbatim: the four
  keys `campaignId`, `completedScenarios`, `currentScenarioId`,
  `rewards`, no others (Test 8 enforces this at runtime).
- `ScenarioOutcome = 'victory' | 'defeat' | 'incomplete'` is a named
  union used by **both** `evaluateScenarioOutcome` (return type) and
  `advanceCampaignState` (outcome parameter), eliminating outcome-
  string drift.
- `ScenarioOutcomeCondition` and `ScenarioReward` are closed
  discriminated unions with exhaustive `switch` coverage guarded by a
  `never` branch. Future variant additions force a compile-time error
  at the switch site — the extension seam is durable.
- `applyScenarioOverrides` uses replace-on-override semantics with
  spread-copied arrays, matching the pre-flight Merging Rule (Locked).
- `evaluateScenarioOutcome` uses loss-before-victory evaluation order
  (D-1235 precedent), documented in the function's JSDoc and enforced
  by Test 4.
- `advanceCampaignState` returns a new object with new arrays;
  `completedScenarios` and `rewards` are fresh arrays via spread.
  Test 6 enforces pre/post JSON equality of the input state.
- Canonical sources of truth (`MatchSetupConfig`, `EndgameResult`,
  `FinalScoreSummary`) are consumed by `import type` only. No runtime
  coupling to engine helpers.

### 3. Boundary Integrity — **Pass**

- **Types vs runtime helpers:** `campaign.types.ts` contains only type
  and interface declarations. `campaign.logic.ts` contains only runtime
  helpers. No blurring.
- **Pure logic vs state mutation:** All three functions are pure. No
  `G`, no `ctx`, no Immer drafts, no boardgame.io lifecycle coupling.
  Post-mortem verified line-by-line that every return path uses fresh
  object and array literals.
- **Engine contracts vs framework wiring:** `src/campaign/` is isolated
  from `src/game.ts`, `src/moves/`, `src/rules/`, `src/setup/`, and
  every other engine directory. `grep -rn "campaign"
  packages/game-engine/src/ --exclude-dir=campaign` would return zero
  matches outside the expected re-export lines in `types.ts` and
  `index.ts`.
- **Forbidden imports:** Confirmed absent — no `boardgame.io`, no
  `@legendary-arena/registry`, no `LegendaryGameState`, no
  `hookRegistry`, no `ImplementationMap` imports in any campaign file.
  The only textual mentions of `boardgame.io` in campaign files are
  JSDoc comments stating "no boardgame.io" — not actual imports.
- **Code category compliance:** `src/campaign/` is classified under
  the `engine` code category by D-3001, following the D-2706 (replay)
  and D-2801 (ui) precedent. The classification decision was created
  during pre-flight as PS-1 before any campaign file was written.

### 4. Test Integrity — **Pass**

- **Test count:** Exactly 8 new tests, matching WP-030 §E verbatim in
  both count and order:
  1. `applyScenarioOverrides` produces a valid `MatchSetupConfig`
  2. `applyScenarioOverrides` with no overrides returns base config
  3. `evaluateScenarioOutcome` returns `'victory'` when conditions met
  4. `evaluateScenarioOutcome` returns `'defeat'` when failure conds met
  5. `advanceCampaignState` appends completed scenario
  6. `advanceCampaignState` returns new object (input not mutated)
  7. All types are JSON-serializable (stringify roundtrip)
  8. `CampaignState` does NOT contain `G` or engine internals
- **Suite count increase:** 89 → 93. The +4 reflects the four
  `describe` blocks in the new test file (one per function + one
  "campaign type contracts" block for tests 7 and 8). This is a
  cosmetic artifact of test organization, not additional tests.
- **Drift-detection tests:** Not required — WP-030 introduces no new
  canonical readonly array that pairs with a union type. The
  discriminated unions (`ScenarioOutcomeCondition`, `ScenarioReward`)
  are closed at the type level and protected by exhaustive-switch
  `never` branches, which is a stronger guarantee than a runtime drift
  test would provide.
- **Test intent:** All 8 tests are contract-enforcement, not
  illustrative. Tests 2 and 6 assert reference inequality at runtime
  (spread-copy discipline). Test 8 enforces `Object.keys(x).sort()`
  equal to the exact key set. Test 7 uses
  `deepStrictEqual(JSON.parse(JSON.stringify(x)), x)` — the strong
  round-trip check, not bare `stringify`.
- **No tests weakened:** Post-mortem confirmed 8 tests landed passing
  on the first build run. No assertions softened.
- **No over-testing:** Each test targets a specific contract
  requirement. No speculative tests for behavior the WP did not
  specify.
- **No boardgame.io imports in tests:** Confirmed. Tests construct
  synthetic fixtures inline without `buildInitialGameState`,
  `makeMockCtx`, or any registry reader.

### 5. Runtime Boundary Check — **Pass (01.5 NOT invoked)**

**The 01.5 runtime wiring allowance was NOT invoked by this Work
Packet.** This was stated explicitly in both the session prompt
(§Runtime Wiring Allowance — NOT INVOKED) and the pre-flight, and the
execution was consistent with that declaration.

- No files outside the WP allowlist were modified.
- No structural test assertions were updated (none needed updating).
- No `buildInitialGameState` changes (the WP does not touch
  `LegendaryGameState` shape).
- No `game.test.ts` changes (the WP adds no move or phase — the
  existing structural assertions at lines 91 and 100 remain exact-
  match).
- No `makeMockCtx` changes or other shared test helper modifications.

The WP is purely additive. The declared "01.5 not invoked" posture
held throughout execution, post-mortem verified it, and this review
affirms it.

**Runtime wiring allowance exercised:** **No.**

### 6. Governance & EC-Mode Alignment — **Pass**

- **DECISIONS.md:** Four WP-030 entries added with rationale:
  - D-3001 (campaign directory classified as engine code category) —
    created during pre-flight as PS-1 resolution, before execution
  - D-3002 (campaign state external to G — MVP implementation)
  - D-3003 (scenarios produce MatchSetupConfig, not modified G)
  - D-3004 (campaign replay as sequence of ReplayInputs)
  Each entry includes rationale, not just outcome. D-0501 and D-0502
  (governing architectural decisions) are cited by reference.
- **STATUS.md:** WP-030 entry added at top of "Current State" with
  what changed, key decisions, architectural significance, what's
  true now, and what's next. Accurate to the executed state.
- **WORK_INDEX.md:** WP-030 checkbox flipped from `[ ]` to `[x]`,
  completion date recorded, and notes include the `ScenarioOutcome`
  tightening, the parameter shape refinement, the D-3001 classification,
  and the "01.5 NOT invoked" status.
- **ARCHITECTURE.md:** Not updated. Non-blocking — WP-030 implements
  existing architectural principles (D-0501, D-0502) and introduces no
  new architectural concepts. The post-mortem and session prompt both
  flagged this as a non-blocking gap consistent with the WP-028
  precedent.
- **Execution checklist intent honored:** Every EC-030 acceptance
  criterion has a corresponding test, grep, or `git diff` check that
  passes. No criterion was waived, weakened, or reinterpreted.
- **No policy invented at implementation time:** The
  `evaluateScenarioOutcome` split-parameter shape
  (`victoryConditions` + `failureConditions` separate arrays instead
  of a single `conditions` array) was authorized explicitly in the
  pre-flight §Risk Review item #5 and the session prompt §B
  implementation note. It was NOT invented during execution. See also
  Optional Pre-Commit Nit #1 below regarding WP-030 text back-sync.

---

## Optional Pre-Commit Nits (Non-Blocking)

### Nit 1 — WP-030 text retains the pre-refinement `evaluateScenarioOutcome` signature

**Observation:** [WP-030 line 196](docs/ai/work-packets/WP-030-campaign-scenario-framework.md) still reads:

> `evaluateScenarioOutcome(result: EndgameResult, scores: FinalScoreSummary, conditions: ScenarioOutcomeCondition[]): ScenarioOutcome`

The implemented and session-prompt-locked signature is the split
form with `victoryConditions` and `failureConditions` as separate
parameters. This refinement was explicitly called out in the
pre-flight and session prompt as a minor parameter shaping (not a
scope deviation), and it is documented in STATUS.md, WORK_INDEX.md,
and the post-mortem.

**Risk:** Low. A future reader of WP-030 alone — without reading the
pre-flight or session prompt — would see a signature mismatch between
the WP text and the shipped code. All other governance artifacts are
consistent.

**Suggested fix (non-blocking, no code change):** One-line edit to
WP-030 line 196 replacing `conditions: ScenarioOutcomeCondition[]`
with `victoryConditions: ScenarioOutcomeCondition[] | undefined,
failureConditions: ScenarioOutcomeCondition[] | undefined`. Optional
sync of WP-030 §E Tests list comments if desired. This is
governance-document synchronization only — no code, test, or other
artifact changes required. May be deferred to a post-commit cleanup
if preferred.

**This nit does not block commit.** The WP-030 text is a spec
document; the authoritative execution contract is EC-030 (which
correctly locks the `ScenarioOutcome` union but does not lock the
function signature). The post-mortem Section 2 audit confirmed the
signature refinement was pre-authorized and consistently applied.

### Nit 2 — ARCHITECTURE.md naming gap

**Observation:** ARCHITECTURE.md does not mention `ScenarioDefinition`,
`CampaignDefinition`, or `CampaignState` by name. This matches the
WP-028 precedent noted in 01.6's Precedent Log, where `UIState` and
`buildUIState` had the same gap.

**Risk:** None. The principles they implement (D-0501, D-0502) are
already in ARCHITECTURE.md. Naming the concrete types would be a
cosmetic refresh.

**Suggested action:** Defer to a future ARCHITECTURE.md refresh that
addresses both this gap and the WP-028 gap together. Not a blocker for
WP-030 commit.

---

## Explicit Deferrals (Correctly NOT in This WP)

The following were correctly omitted from WP-030, reinforcing scope
discipline:

- **Campaign UI** — no campaign selection, scenario progress display,
  or visual artifacts. Deferred to future UI WPs.
- **Campaign persistence** — no `CampaignState` save/load, no database
  schema, no serializer/deserializer helpers. Deferred to a future
  persistence WP.
- **Campaign execution runtime** — no auto-advancing scheduler, no
  branching logic interpreter, no unlock-rule evaluator at runtime.
  The `outcome` parameter on `advanceCampaignState` is reserved for
  future branching without requiring a signature change.
- **Scenario difficulty scaling** — no PAR-aware scenario
  configuration, no `FinalScoreSummary` threshold adjustments.
  Deferred to a future balance/difficulty WP.
- **Multiplayer campaign coordination** — no server-side campaign
  state synchronization, no session-level campaign handoff.
- **Database or server changes** — none. Correctly kept out of scope.
- **Runtime enforcement of condition vocabulary** — unknown
  `counterReached` keys return `false` (safe-skip). Future WPs extend
  the vocabulary by adding cases; no runtime enforcement is added now.
- **Drift-detection tests for canonical arrays** — not introduced
  because WP-030 does not define a canonical readonly array alongside
  its union types. Closed discriminated unions with exhaustive-switch
  `never` branches are a stronger guarantee at the type level.
- **Wiring `applyScenarioOverrides` into `Game.setup()`** — correctly
  omitted. Campaign functions are called by the application layer,
  not by the engine.
- **01.5 runtime wiring allowance invocation** — correctly declined.
  The WP is purely additive and has no reason to exercise the
  allowance.

---

## Commit Hygiene Recommendations

### Commit message

Per the session prompt and 01.3 commit hygiene rules:

```
EC-030: implement campaign and scenario framework contracts
```

Suggested body (optional, per 01.3 format):

> Contract-only WP: no engine modification. Introduces
> `ScenarioDefinition`, `CampaignDefinition`, `CampaignState`, and
> `ScenarioOutcome` as data-only contracts, plus pure helpers
> `applyScenarioOverrides`, `evaluateScenarioOutcome`, and
> `advanceCampaignState`. Implements D-0501 and D-0502 at the code
> level. `src/campaign/` classified as engine code category (D-3001).
> `CampaignState` is NOT part of `LegendaryGameState`. 8 new tests
> (340 → 348). 01.5 runtime wiring allowance NOT invoked.

### Commit scope

The commit should include:
- 3 new files under `packages/game-engine/src/campaign/`
- Modifications to `packages/game-engine/src/types.ts` and
  `packages/game-engine/src/index.ts`
- Updates to `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md`,
  `docs/ai/work-packets/WORK_INDEX.md`

### Files to consider splitting into separate commits (optional)

The diff also contains:
- Earlier `ScenarioOutcome` tightening edits to `EC-030` and `WP-030`
  text (pre-execution, during external-review phase)
- The `DECISIONS.md` trailing-backtick cleanup (pre-execution, also
  during external-review phase)

These are governance-only edits that were authorized during the
pre-flight and happened before WP-030 execution began. They may be
included in the same commit under the `EC-030:` prefix, or split into
a separate `SPEC:` commit if the commit hygiene rules in 01.3 prefer
clean separation between spec tightening and implementation. Either
approach is acceptable — defer to the author's preference and 01.3
guidance.

### Files to explicitly exclude from the commit

- `.claude/settings.local.json` — pre-existing dirty state unrelated
  to WP-030. Should not be staged.
- `docs/ai/REFERENCE/01.5-copilot-check.md` — untracked file observed
  in `git status` but **not created by WP-030**. Flagged in the
  execution summary and post-mortem. Must not be included in the
  WP-030 commit.
- `docs/ai/session-context/session-context-wp029.md`,
  `docs/legendary-arena-*`, `docs/upper-deck-*` — pre-existing
  untracked state at session start. Unrelated to WP-030.

### Hook validation reminder

Per 01.3, the commit must pass all pre-commit hooks without
`--no-verify`. If a hook fails, the failure must be diagnosed and
fixed by creating a new commit — never by amending or bypassing hooks.

---

## Final Affirmation

WP-030 satisfies its contract. The Work Packet is **safe to commit as-is**.

Follow [01.3-commit-hygiene-under-ec-mode.md](docs/ai/REFERENCE/01.3-commit-hygiene-under-ec-mode.md)
for the actual commit. This review authorizes the commit; 01.3 governs
how it is made (prefix format, hook validation, helper script). Do not
commit without confirming hook compliance.

**End of pre-commit review.**
