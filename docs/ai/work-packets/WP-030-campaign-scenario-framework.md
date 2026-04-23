# WP-030 — Campaign / Scenario Framework

**Status:** Complete  
**Primary Layer:** Game Orchestration / Meta-Game  
**Dependencies:** WP-029

---

## Session Context

WP-027 proved deterministic replay. WP-028/029 established the UI state
contract and audience-filtered views. All MVP gameplay mechanics (WP-002
through WP-026) are complete. This packet introduces a meta-layer that
orchestrates multiple games into campaigns and scenarios — without altering
the game engine itself. Campaigns link games together with persistent state,
branching paths, and scenario-specific setup overrides. Each individual game
remains a normal deterministic match. This implements D-0501 (Campaigns Are
Meta-Orchestration Only) and D-0502 (Campaign State Lives Outside the Engine).

---

## Goal

Introduce a campaign and scenario framework as a meta-orchestration layer.
After this session:

- `ScenarioDefinition` is a data-only contract describing how a single game
  is configured within a campaign (setup overrides, victory/failure conditions,
  rewards)
- `CampaignDefinition` is a data-only contract describing a sequence of
  scenarios with branching paths, unlock conditions, and persistent state
- `CampaignState` tracks campaign progression externally to the engine —
  never inside `G`
- Scenario setup overrides produce a valid `MatchSetupConfig` — the engine
  receives a normal config and runs a normal game
- Campaign replay is a deterministic sequence of replayable games
- All contracts are JSON-serializable and follow the representation-before-
  execution pattern (D-0603)

---

## Assumes

- WP-029 complete. Specifically:
  - `packages/game-engine/src/replay/replay.types.ts` exports `ReplayInput`
    (WP-027)
  - `packages/game-engine/src/matchSetup.types.ts` exports `MatchSetupConfig`
    (WP-005A)
  - `packages/game-engine/src/scoring/scoring.types.ts` exports
    `FinalScoreSummary` (WP-020)
  - `packages/game-engine/src/endgame/endgame.types.ts` exports
    `EndgameResult` (WP-010)
  - `packages/game-engine/src/test/mockCtx.ts` exports `makeMockCtx` (WP-005B)
  - `pnpm --filter @legendary-arena/game-engine build` exits 0
  - `pnpm --filter @legendary-arena/game-engine test` exits 0
- `docs/ai/ARCHITECTURE.md` exists with "MVP Gameplay Invariants"
- `docs/ai/DECISIONS.md` exists with D-0501, D-0502, D-0603

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md — "Layer Boundary (Authoritative)"` — campaigns
  are NOT part of the game engine. Campaign logic lives in a separate
  orchestration layer. It never mutates `G`, never defines moves, and never
  alters engine rules.
- `docs/ai/DECISIONS.md` — read D-0501 (Campaigns Are Meta-Orchestration Only)
  and D-0502 (Campaign State Lives Outside the Engine). These are the governing
  decisions for this packet.
- `docs/ai/DECISIONS.md` — read D-0603 (Representation Before Execution).
  Campaign and scenario definitions are data-only contracts. Execution
  (actually running campaign progression) may come in a future packet or
  be handled by the application layer.
- `docs/ai/ARCHITECTURE.md §Section 3` — read "The Three Data Classes".
  `CampaignState` is Class 2 (Configuration) — it is a deterministic input,
  safe to persist. Individual game `G` remains Class 1 (Runtime).
- `docs/ai/ARCHITECTURE.md §Section 4` — read "Why G Must Never Be Persisted".
  Campaign state is explicitly NOT `G`. It is external, versioned data.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no abbreviations
  — `scenarioDefinition` not `scenDef`), Rule 6 (`// why:` on campaign/engine
  separation), Rule 8 (no `.reduce()`), Rule 13 (ESM only).

**Critical design note — campaign never touches the engine:**
The engine receives a `MatchSetupConfig` and runs a deterministic game. It
does not know it is part of a campaign. Scenario overrides are applied
*before* the config reaches `Game.setup()`. Campaign progression is computed
*after* the game ends, from the `EndgameResult` and `FinalScoreSummary`. The
engine is never aware of campaigns.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — campaign logic involves no randomness
- `G` must never be mutated by campaign logic
- ESM only, Node v22+ — all new files use `import`/`export`, never `require()`
- `node:` prefix on all Node.js built-in imports (`node:test`, `node:assert`,
  etc.)
- Test files use `.test.ts` extension — never `.test.mjs`
- No database or network access in any new file
- Full file contents for every new or modified file in the output — no diffs,
  no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- Campaign logic **never mutates `G`** — it operates on `MatchSetupConfig`
  (input) and `EndgameResult` / `FinalScoreSummary` (output)
- Campaign state is **external to the engine** — stored as its own data
  structure, never inside `G`
- `CampaignState` is Class 2 (Configuration) — safe to persist
- Scenario overrides produce a valid `MatchSetupConfig` — the engine receives
  a normal config with no awareness of campaigns
- All contracts are **data-only** and JSON-serializable — no functions, no
  closures (D-0603)
- Campaign replay = ordered sequence of `ReplayInput` objects — each game is
  independently replayable
- No engine modifications — this packet adds types and utilities only
- No `.reduce()` in campaign logic — use `for...of`
- Tests use plain mocks — no `boardgame.io` imports

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding

**Locked contract values:**

- **ScenarioDefinition shape (MVP):**
  ```ts
  interface ScenarioDefinition {
    id: string
    name: string
    description?: string
    setupOverrides?: Partial<MatchSetupConfig>
    victoryConditions?: ScenarioOutcomeCondition[]
    failureConditions?: ScenarioOutcomeCondition[]
    rewards?: ScenarioReward[]
  }
  ```

- **CampaignDefinition shape (MVP):**
  ```ts
  interface CampaignDefinition {
    id: string
    name: string
    scenarios: ScenarioDefinition[]
    unlockRules?: CampaignUnlockRule[]
  }
  ```

---

## Scope (In)

### A) `src/campaign/campaign.types.ts` — new

- `interface ScenarioDefinition` — data-only wrapper around a single game
  with setup overrides and outcome conditions
- `type ScenarioOutcome = 'victory' | 'defeat' | 'incomplete'` — named
  union for scenario outcomes. Used by both `evaluateScenarioOutcome`
  (return type) and `advanceCampaignState` (outcome parameter) so callers
  cannot pass arbitrary strings like `'Victory'` or `'win'`.
- `interface ScenarioOutcomeCondition` — declarative condition
  (e.g., `{ type: 'heroesWin' }` or `{ type: 'counterReached'; key: string; threshold: number }`)
- `interface ScenarioReward` — declarative reward descriptor
  (e.g., `{ type: 'unlockScenario'; scenarioId: string }`)
- `interface CampaignDefinition` — ordered list of scenarios with unlock rules
- `interface CampaignUnlockRule` — declarative unlock condition
  (e.g., `{ scenarioId: string; requires: string[] }`)
- `interface CampaignState` — progression tracking:
  ```ts
  interface CampaignState {
    campaignId: string
    completedScenarios: string[]
    currentScenarioId: string | null
    rewards: ScenarioReward[]
  }
  ```
- All types JSON-serializable — no functions, no engine concepts
- `// why:` comments: campaign state is Class 2 (Configuration), external to
  the engine; scenario overrides produce a valid MatchSetupConfig

### B) `src/campaign/campaign.logic.ts` — new

- `applyScenarioOverrides(baseConfig: MatchSetupConfig, scenario: ScenarioDefinition): MatchSetupConfig`
  — merges scenario overrides into a base config, returns a valid
  `MatchSetupConfig` for the engine
  - Pure function, no I/O
  - `// why:` comment: the engine receives a normal config — it never knows
    about campaigns

- `evaluateScenarioOutcome(result: EndgameResult, scores: FinalScoreSummary, victoryConditions: ScenarioOutcomeCondition[] | undefined, failureConditions: ScenarioOutcomeCondition[] | undefined): ScenarioOutcome`
  — checks outcome conditions against game results
  - Pure function, reads results only
  - `// why:` comment: evaluated after game ends, not during
  - Return type is the named `ScenarioOutcome` union, not an inline literal
  - `// why:` comment: loss-before-victory evaluation order (D-1235
    precedent) — failure conditions are checked before victory conditions
    so simultaneous satisfactions deterministically resolve to `'defeat'`
  - Victory and failure conditions are accepted as two separate arrays
    (not a single tagged array) so the evaluation order is expressible at
    the call site. Either array may be `undefined`, treated as empty.
    Locked by pre-flight risk review #5.

- `advanceCampaignState(state: CampaignState, scenarioId: string, outcome: ScenarioOutcome, rewards: ScenarioReward[]): CampaignState`
  — returns updated campaign state (new object, never mutates input)
  - Appends completed scenario, applies rewards, advances to next
  - Pure function
  - `outcome` is the named `ScenarioOutcome` union — callers cannot pass
    arbitrary strings. Compile-time safety prevents drift like `'Victory'`
    or `'win'`.

- No boardgame.io import — campaign is external to the engine

### C) `src/types.ts` — modified

- Re-export campaign types (but NOT as part of `LegendaryGameState` — campaign
  state is external)

### D) `src/index.ts` — modified

- Export campaign types and logic functions

### E) Tests — `src/campaign/campaign.logic.test.ts` — new

- Uses `node:test` and `node:assert` only; no boardgame.io import
- Eight tests:
  1. `applyScenarioOverrides` produces a valid `MatchSetupConfig`
  2. `applyScenarioOverrides` with no overrides returns the base config
  3. `evaluateScenarioOutcome` returns `'victory'` when conditions met
  4. `evaluateScenarioOutcome` returns `'defeat'` when failure conditions met
  5. `advanceCampaignState` appends completed scenario
  6. `advanceCampaignState` returns new object (input not mutated)
  7. All types are JSON-serializable (stringify roundtrip)
  8. Campaign state does NOT contain `G` or engine internals

---

## Out of Scope

- **No campaign UI** — future packets
- **No campaign persistence or save/load** — `CampaignState` is a type
  definition; storage is a future concern
- **No campaign execution runtime** (auto-advancing, branching) — this packet
  defines contracts and utility functions only
- **No engine modifications** — the engine is unaware of campaigns
- **No scenario difficulty scaling** — future packets
- **No multiplayer campaign coordination** — future packets
- **No server changes**
- **No database access**
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above

---

## Files Expected to Change

- `packages/game-engine/src/campaign/campaign.types.ts` — **new** —
  ScenarioDefinition, CampaignDefinition, CampaignState, and sub-types
- `packages/game-engine/src/campaign/campaign.logic.ts` — **new** —
  applyScenarioOverrides, evaluateScenarioOutcome, advanceCampaignState
- `packages/game-engine/src/types.ts` — **modified** — re-export campaign
  types (NOT added to LegendaryGameState)
- `packages/game-engine/src/index.ts` — **modified** — export campaign API
- `packages/game-engine/src/campaign/campaign.logic.test.ts` — **new** — tests

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Campaign Contracts
- [ ] `ScenarioDefinition` is data-only, JSON-serializable
- [ ] `CampaignDefinition` is data-only, JSON-serializable
- [ ] `CampaignState` is data-only, JSON-serializable
- [ ] No functions, closures, or engine concepts in any type
- [ ] `CampaignState` is NOT part of `LegendaryGameState`

### Engine Isolation
- [ ] Campaign types do NOT appear in `LegendaryGameState`
- [ ] `applyScenarioOverrides` produces a valid `MatchSetupConfig` (not a
      modified `G`)
- [ ] `evaluateScenarioOutcome` reads results only — never reads `G`
- [ ] `advanceCampaignState` returns new object (never mutates input)
- [ ] No campaign file imports `boardgame.io`
      (confirmed with `Select-String`)

### Pure Functions
- [ ] All campaign logic functions are pure — no I/O, no side effects
- [ ] No `.reduce()` in campaign logic
      (confirmed with `Select-String`)
- [ ] No registry import in campaign files
      (confirmed with `Select-String`)

### Tests
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files)
- [ ] Tests confirm scenario overrides produce valid MatchSetupConfig
- [ ] Tests confirm campaign state does not contain G
- [ ] Tests confirm all types JSON-serializable
- [ ] All test files use `.test.ts`; no boardgame.io import

### Scope Enforcement
- [ ] No engine files modified (game.ts, moves, rules)
      (confirmed with `git diff --name-only`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — build after adding campaign framework
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm no boardgame.io import in campaign files
Select-String -Path "packages\game-engine\src\campaign" -Pattern "boardgame.io" -Recurse
# Expected: no output

# Step 4 — confirm CampaignState not in LegendaryGameState
Select-String -Path "packages\game-engine\src\types.ts" -Pattern "CampaignState"
# Expected: re-export only, NOT as a field of LegendaryGameState

# Step 5 — confirm no .reduce()
Select-String -Path "packages\game-engine\src\campaign" -Pattern "\.reduce\(" -Recurse
# Expected: no output

# Step 6 — confirm no registry import
Select-String -Path "packages\game-engine\src\campaign" -Pattern "@legendary-arena/registry" -Recurse
# Expected: no output

# Step 7 — confirm no engine files modified
git diff --name-only packages/game-engine/src/game.ts packages/game-engine/src/moves/ packages/game-engine/src/rules/
# Expected: no output

# Step 8 — confirm no require()
Select-String -Path "packages\game-engine\src\campaign" -Pattern "require(" -Recurse
# Expected: no output

# Step 9 — confirm no files outside scope
git diff --name-only
# Expected: only files listed in ## Files Expected to Change
```

---

## Definition of Done

> Claude Code must execute every verification command in `## Verification Steps`
> before checking any item below. Reading the code is not sufficient — run the
> commands.
>
> Every item must be true before this packet is considered complete.

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria above pass
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files)
- [ ] No boardgame.io import in campaign files
      (confirmed with `Select-String`)
- [ ] CampaignState not part of LegendaryGameState
- [ ] No `.reduce()` in campaign logic (confirmed with `Select-String`)
- [ ] No engine files modified (confirmed with `git diff`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — campaign and scenario contracts exist;
      D-0501 and D-0502 implemented; campaigns orchestrate games without
      modifying the engine
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why campaign state is
      external to G (D-0502); why scenarios produce MatchSetupConfig not
      modified G; how campaign replay works (sequence of ReplayInputs)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-030 checked off with today's date
