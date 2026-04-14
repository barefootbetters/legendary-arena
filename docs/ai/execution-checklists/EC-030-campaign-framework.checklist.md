# EC-030 — Campaign / Scenario Framework (Execution Checklist)

**Source:** docs/ai/work-packets/WP-030-campaign-scenario-framework.md
**Layer:** Game Orchestration / Meta-Game

**Execution Authority:**
This EC is the authoritative execution checklist for WP-030.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-030.

---

## Before Starting

- [ ] WP-029 complete: UIState, audience-filtered views, replay harness all exist
- [ ] `MatchSetupConfig` (WP-005A), `EndgameResult` (WP-010), `FinalScoreSummary` (WP-020) exist
- [ ] D-0501 and D-0502 recorded in DECISIONS.md
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-030.
If formatting, spelling, or ordering differs, the implementation is invalid.

- **ScenarioOutcome (named union, MVP):**
  ```ts
  type ScenarioOutcome = 'victory' | 'defeat' | 'incomplete'
  ```
  Used by `evaluateScenarioOutcome` return type and `advanceCampaignState`
  outcome parameter. Callers must not pass arbitrary strings.

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

- **CampaignState shape:**
  ```ts
  interface CampaignState {
    campaignId: string
    completedScenarios: string[]
    currentScenarioId: string | null
    rewards: ScenarioReward[]
  }
  ```

- `CampaignState` is Class 2 (Configuration) -- safe to persist
- `CampaignState` is **NOT** part of `LegendaryGameState`

---

## Guardrails

- Campaign logic **never mutates G** -- operates on MatchSetupConfig (input) and EndgameResult (output)
- Campaign state is **external to the engine** -- never inside G (D-0502)
- Engine is unaware of campaigns -- receives a normal `MatchSetupConfig`
- All contracts are data-only, JSON-serializable -- no functions, no closures (D-0603)
- No engine files modified (game.ts, moves, rules) -- types and utilities only
- No boardgame.io import in campaign files
- No `.reduce()` in campaign logic

---

## Required `// why:` Comments

- `CampaignState`: Class 2 data, external to engine (D-0502)
- `applyScenarioOverrides`: engine receives normal config -- never knows about campaigns
- `evaluateScenarioOutcome`: evaluated after game ends, not during
- Campaign/engine separation: D-0501

---

## Files to Produce

- `packages/game-engine/src/campaign/campaign.types.ts` -- **new** -- ScenarioDefinition, CampaignDefinition, CampaignState, sub-types
- `packages/game-engine/src/campaign/campaign.logic.ts` -- **new** -- applyScenarioOverrides, evaluateScenarioOutcome, advanceCampaignState
- `packages/game-engine/src/types.ts` -- **modified** -- re-export campaign types (NOT added to LegendaryGameState)
- `packages/game-engine/src/index.ts` -- **modified** -- export campaign API
- `packages/game-engine/src/campaign/campaign.logic.test.ts` -- **new** -- 8 tests

---

## Common Failure Smells (Optional)

- CampaignState appears as a field of LegendaryGameState -- engine boundary violated
- Campaign logic imports boardgame.io -- layer violation
- advanceCampaignState mutates input object -- must return new object
- Engine file modified -- scope creep

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] CampaignState NOT part of LegendaryGameState
- [ ] No engine files modified (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated (campaign/scenario contracts exist; D-0501 and D-0502 implemented)
- [ ] `docs/ai/DECISIONS.md` updated (campaign state external to G; scenarios produce MatchSetupConfig; campaign replay as sequence of ReplayInputs)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-030 checked off with date
