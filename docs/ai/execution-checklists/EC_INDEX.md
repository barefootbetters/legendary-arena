# EC_INDEX.md — Execution Checklist Index

> **Purpose:** Tracks all Execution Checklists and their readiness status.  
> Subordinate to `docs/ai/work-packets/WORK_INDEX.md` — if status conflicts, WORK_INDEX.md wins.

> **Execution Rule:**  
> No implementation work may begin on a Work Packet unless a corresponding Execution Checklist (EC) exists in this index.

> **Status legend:**
> - `Done` — WP fully executed and validated; EC preserved for reference and regression  
> - `Draft` — EC generated and ready for execution  
> - `Blocked` — EC exists but WP dependencies are not met

> **Note:** Phase 0 ECs may be marked `Done` earlier than others due to documentation-only scope.

---

## Governing Documents

- **EC Template:** `docs/ai/execution-checklists/EC-TEMPLATE.md`
- **EC Workflow:** `docs/ai/REFERENCE/01.1-how-to-use-ecs-while-coding.md`
- **Bug Handling:** `docs/ai/REFERENCE/01.2-bug-handling-under-ec-mode.md`

All bugs must be handled through the bug handling protocol once any EC
is active. See 01.2 for the clause-driven diagnosis sequence.

---

## Foundation Prompts

| EC      | Source    | Layer                  | Execution Scope                                      | Status |
|---------|-----------|------------------------|------------------------------------------------------|--------|
| EC-FP01 | FP-01     | Server / Infrastructure | Render.com backend, rules loader, schema, render.yaml | Done   |

---

## Phase 0 — Coordination & Contracts

| EC     | Source WP | Layer                          | Execution Scope                                      | Status |
|--------|-----------|--------------------------------|------------------------------------------------------|--------|
| EC-001 | WP-001    | Documentation / Coordination   | Repo-as-memory system, REFERENCE docs                | Done   |
| EC-002 | WP-002    | Game Engine                    | boardgame.io Game skeleton, LegendaryGame            | Draft  |
| EC-003 | WP-003    | Registry                       | Card registry defect fixes, smoke test               | Draft  |
| EC-004 | WP-004    | Server                         | Server bootstrap, registry + rules wiring            | Draft  |
| EC-043 | WP-043    | Registry / Contracts (Docs)    | Data contracts reference migration                   | Draft  |
| EC-044 | WP-044    | Coordination / Quality Gate    | Prompt lint governance alignment                     | Draft  |
| EC-045 | WP-045    | Coordination / Execution Gate  | Connection health check alignment                    | Draft  |
| EC-046 | WP-046    | Coordination / Execution Gate  | R2 validation governance alignment                   | Draft  |
| EC-047 | WP-047    | Coordination / Quality Gate    | Code style reference alignment                       | Draft  |

---

## Phase 1 — Game Setup Contracts & Determinism

| EC      | Source WP | Layer                    | Execution Scope                                      | Status |
|---------|-----------|--------------------------|------------------------------------------------------|--------|
| EC-005A | WP-005A   | Game Engine / Contracts  | MatchSetupConfig (9 fields), validateMatchSetup      | Draft  |
| EC-005B | WP-005B   | Game Engine / Setup      | shuffleDeck, buildInitialGameState, Game.setup()     | Draft  |
| EC-006A | WP-006A   | Game Engine / Contracts  | PlayerZones (5), GlobalPiles (4), validators         | Draft  |
| EC-006B | WP-006B   | Game Engine / Setup      | buildPlayerState, buildGlobalPiles                   | Draft  |

---

## Phase 2 — Core Turn Engine

| EC      | Source WP | Layer                    | Execution Scope                                      | Status |
|---------|-----------|--------------------------|------------------------------------------------------|--------|
| EC-007A | WP-007A   | Game Engine / Contracts  | MATCH_PHASES, TURN_STAGES, getNextTurnStage          | Draft  |
| EC-007B | WP-007B   | Game Engine / Turn Loop  | advanceTurnStage, G.currentStage, play phase         | Draft  |
| EC-008A | WP-008A   | Game Engine / Contracts  | MoveResult/MoveError, CORE_MOVE_NAMES, stage gating  | Draft  |
| EC-008B | WP-008B   | Game Engine / Moves      | drawCards, playCard, endTurn, zoneOps.ts             | Draft  |

---

## Phase 3 — MVP Multiplayer Infrastructure

| EC     | Source WP | Layer                    | Execution Scope                                      | Status |
|--------|-----------|--------------------------|------------------------------------------------------|--------|
| EC-009A| WP-009A   | Game Engine / Contracts  | HookDefinition, RULE_TRIGGER_NAMES, RULE_EFFECT_TYPES| Draft  |
| EC-009B| WP-009B   | Game Engine / Rules Runtime | ImplementationMap, executeRuleHooks, applyRuleEffects| Draft  |
| EC-010 | WP-010    | Game Engine / Endgame    | evaluateEndgame, ENDGAME_CONDITIONS, endIf wiring    | Draft  |
| EC-011 | WP-011    | Server + Game Engine     | G.lobby, match creation, lobby moves, CLI script     | Draft  |
| EC-012 | WP-012    | Server / Match Access    | list-matches, join-match CLI scripts                 | Draft  |
| EC-013 | WP-013    | Architecture / Data Lifecycle | PERSISTENCE_CLASSES, MatchSnapshot, ARCHITECTURE.md | Draft  |

---

## Phase 4 — Core Gameplay Loop

| EC     | Source WP | Layer                    | Execution Scope                                      | Status |
|--------|-----------|--------------------------|------------------------------------------------------|--------|
| EC-014 | WP-014    | Game Engine / Core Gameplay | Villain deck, reveal pipeline, REVEALED_CARD_TYPES   | Draft  |
| EC-015 | WP-015    | Game Engine / Board Zones| G.city, G.hq, villain movement, escapes              | Draft  |
| EC-016 | WP-016    | Game Engine / Core Actions | fightVillain, recruitHero moves                      | Draft  |
| EC-017 | WP-017    | Game Engine / Zones + Effects | G.ko, G.attachedBystanders, wounds                 | Draft  |
| EC-018 | WP-018    | Game Engine / Economy    | G.turnEconomy, G.cardStats, parseCardStatValue       | Draft  |
| EC-019 | WP-019    | Game Engine / Boss Fight | G.mastermind, tactics deck, fightMastermind          | Draft  |
| EC-020 | WP-020    | Game Engine / Scoring    | computeFinalScores, VP constants                     | Draft  |

---

## Phase 5 — Card Mechanics & Abilities

| EC     | Source WP | Layer                    | Execution Scope                                      | Status |
|--------|-----------|--------------------------|------------------------------------------------------|--------|
| EC-021 | WP-021    | Game Engine / Rules (Contracts) | HeroAbilityHook, HeroKeyword, G.heroAbilityHooks  | Draft  |
| EC-022 | WP-022    | Game Engine / Rules Execution | 4 unconditional hero keywords execution            | Draft  |
| EC-023 | WP-023    | Game Engine / Rules Execution | 4 condition types, AND logic evaluation            | Draft  |
| EC-024 | WP-024    | Game Engine / Rules Execution | Scheme twist + mastermind strike handlers          | Draft  |
| EC-025 | WP-025    | Game Engine / Board Keywords | BoardKeyword (patrol/ambush/guard), G.cardKeywords| Draft  |
| EC-026 | WP-026    | Game Engine / Setup      | SchemeSetupInstruction, city modifiers               | Draft  |

---

## Phase 6 — Verification, UI & Production

| EC     | Source WP | Layer                    | Execution Scope                                      | Status |
|--------|-----------|--------------------------|------------------------------------------------------|--------|
| EC-027 | WP-027    | Engine Infrastructure    | ReplayInput, replayGame, verifyDeterminism           | Draft  |
| EC-028 | WP-028    | Engine / UI Boundary     | UIState contract, buildUIState pure function         | Draft  |
| EC-029 | WP-029    | Engine / UI Boundary     | UIAudience, filterUIStateForAudience                 | Draft  |
| EC-030 | WP-030    | Game Orchestration       | Campaign/Scenario framework, external to engine      | Draft  |
| EC-031 | WP-031    | Engine Safety            | 5 invariant categories, assertInvariant              | Draft  |
| EC-032 | WP-032    | Multiplayer Safety       | ClientTurnIntent, desync detection                   | Draft  |
| EC-033 | WP-033    | Game Engine / Content    | validateContent, validateContentBatch                | Draft  |
| EC-034 | WP-034    | Game Engine / Versioning | 3 version axes, VersionedArtifact, migrations        | Draft  |
| EC-035 | WP-035    | Operations / Release     | Release artifacts, 4 environments, rollback          | Draft  |
| EC-042 | WP-042    | Server / Operations      | Deployment checklists (R2, PostgreSQL, infra)        | Draft  |

---

## Phase 7 — Beta, Launch & Live Ops

| EC     | Source WP | Layer                    | Execution Scope                                      | Status |
|--------|-----------|--------------------------|------------------------------------------------------|--------|
| EC-036 | WP-036    | Game Engine / Simulation | AIPolicy, RandomPolicy, runSimulation                | Draft  |
| EC-037 | WP-037    | Release Strategy (Docs)  | Beta strategy, BetaFeedback type, exit criteria      | Draft  |
| EC-038 | WP-038    | Operations / Launch      | 4 readiness gates, launch day procedure              | Draft  |
| EC-039 | WP-039    | Operations / Observability | MetricEntry type, 4 metric categories              | Draft  |
| EC-040 | WP-040    | Product Governance       | 5 change categories, ChangeBudget type               | Draft  |
| EC-041 | WP-041    | Core Architecture (Docs) | Field Classification audit, authority hierarchy      | Draft  |

---

## Summary

| Status   | Count |
|----------|-------|
| Done     | 1     |
| Draft    | 50    |
| Blocked  | 0     |
| **Total**| **51**|

---

## Registry Hygiene (R-EC Series)

| EC | Scope | Execution Scope | Status |
|---|---|---|---|
| R-EC-01 | Registry / R2 Data | Fix `[object Object]` abilities in R2 metadata (msmc, bkpt, msis) | Deferred |
| R-EC-02 | Registry / Card Data | Fix missing vp fields in mgtg masterminds | Done |
| R-EC-03 | Registry / R2 Images | Resolve 5 missing images (slug mismatch or not uploaded) | Deferred |

---

## Rules

- EC status tracks **independently** from WP completion status in `WORK_INDEX.md`
- `Draft` means the EC is generated and structurally correct
- Move to `Done` **only** when the corresponding WP is completed in `WORK_INDEX.md`
- `Blocked` applies when a WP's dependencies are known to be unmet
- This index is subordinate to `WORK_INDEX.md` — it does **not** determine execution order
- **All bug handling must follow** `docs/ai/REFERENCE/01.2-bug-handling-under-ec-mode.md` once any EC is active

---

**Last updated:** 2026-04-09