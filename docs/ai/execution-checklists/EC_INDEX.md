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
| EC-014A | WP-014A  | Game Engine / Core Gameplay | Reveal pipeline, trigger emission, REVEALED_CARD_TYPES (no deck construction) | Draft  |
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
| EC-048 | WP-048    | Engine Scoring + Server  | PAR scoring, ScenarioKey, LeaderboardEntry contract  | Draft  |
| EC-066 | WP-066    | Client UI / Registry     | Registry viewer: image-to-data toggle, localStorage   | Draft  |

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
| EC-049 | WP-049    | Tooling / Simulation     | T2 CompetentHeuristic, PAR aggregation, policy tiers | Draft  |
| EC-050 | WP-050    | Tooling / Data           | PAR artifact storage, indexing, immutable versioning | Draft  |
| EC-051 | WP-051    | Server / Enforcement     | PAR publication gate, index loading, fail-closed     | Draft  |

---

## Summary

| Status   | Count |
|----------|-------|
| Done     | 1     |
| Draft    | 55    |
| Blocked  | 0     |
| **Total**| **56**|

---

## Registry Hygiene (R-EC Series)

| EC | Scope | Execution Scope | Status |
|---|---|---|---|
| R-EC-01 | Registry / R2 Data | Fix `[object Object]` abilities in R2 metadata (msmc, bkpt, msis) | Deferred |
| R-EC-02 | Registry / Card Data | Fix missing vp fields in mgtg masterminds | Done |
| R-EC-03 | Registry / R2 Images | Resolve 5 missing images (slug mismatch or not uploaded) | Deferred |

---

## Shared Tooling (EC-060+ Series)

Execution Checklists for shared internal tooling packages under
`packages/*` that are consumed by app test scripts only (not by the
game engine, registry, or server at runtime). Numbered 060+ to keep
the range separate from phase-driven game-engine ECs and viewer ECs.

| EC | Source WP | Layer | Execution Scope | Status |
|---|---|---|---|---|
| EC-065 | WP-065 | Shared Tooling (`packages/vue-sfc-loader/`) | Node `module.register()` loader + `compileVue` pure helper; enables `node:test` to import `.vue` SFCs; hard prerequisite for WP-061, WP-062, WP-064 and future client UI WPs. See `EC-065-vue-sfc-loader.checklist.md`. | Draft |
| EC-067 | WP-061 | Client UI (`apps/arena-client/`) | Gameplay client bootstrap: Vue 3 + Vite + Pinia SPA; `useUiStateStore()` with `snapshot: UIState \| null` + `setSnapshot`; typed fixture loader with `satisfies UIState` discipline; `<BootstrapProbe />` wiring smoke; dev-only `?fixture=` URL harness behind `import.meta.env.DEV` (DCE-guarded); jsdom + `@vue/test-utils` test path via `vue-sfc-loader/register`. No HUD, no networking, no runtime engine import. **Note:** EC-061 was consumed by the registry-viewer Rules Glossary (commit `1b923a4`); WP-061 uses EC-067 — the next free slot. See `EC-067-gameplay-client-bootstrap.checklist.md`. Executed 2026-04-17 at commit `2e68530`. | Done |
| EC-068 | WP-067 | Game Engine (`packages/game-engine/src/ui/`) | UIState projection bridge between WP-048 (PAR scoring types) and WP-062 (Arena HUD consumer): adds `UIProgressCounters { bystandersRescued, escapedVillains }` as non-optional `UIState.progress`; adds optional `UIGameOverState.par: UIParBreakdown { rawScore, parScore, finalScore, scoringConfigVersion }` populated only at `phase === 'end'` with a defined `G.activeScoringConfig`; projection-time aggregation of bystanders from victory piles (no new G counter); drift test pins every new field name for WP-062 aria-label stability; includes three WP-061 fixture type-conformance edits (single `progress` key addition per fixture) so `pnpm -r test` stays green across the contract change. 01.5 NOT INVOKED. 01.6 post-mortem MANDATORY. See `EC-068-uistate-par-projection-and-progress-counters.checklist.md`. Executed 2026-04-17 at commit `1d709e5`. | Done |
| EC-069 | WP-062 | Client UI (`apps/arena-client/src/components/hud/`) | Arena HUD & Scoreboard: seven-file Vue 3 component tree (`ArenaHud`, `TurnPhaseBanner`, `SharedScoreboard`, `ParDeltaReadout`, `PlayerPanelList`, `PlayerPanel`, `EndgameSummary`) + `hudColors.ts` palette helper; five `node:test` component tests under jsdom via `vue-sfc-loader/register`. `ArenaHud.vue` is the sole `useUiStateStore` consumer (container/presenter split); every subcomponent takes its UIState sub-slice via props. `aria-label`s bind to literal leaf field names pinned by WP-067's drift test (`bystandersRescued`, `escapedVillains`, `twistCount`, `tacticsRemaining`, `tacticsDefeated`, `finalScore`). `<SharedScoreboard />` renders unconditionally (`progress` is required on every UIState). `<ParDeltaReadout />` renders em-dash when `!('par' in gameOver)` (D-6701 dominant runtime case); zero is a valid engine value and renders as `0`. `base.css` gains five HUD tokens with numeric contrast ratios. `ArenaHud.vue` uses `defineComponent({ setup() { return {...} } })` form per D-6512/P6-30; subcomponents may use `<script setup>`. **Note:** EC-062–EC-064 unused; EC-065–EC-068 historically bound; following the EC-061 → EC-067 and EC-066 → EC-068 retargeting precedent, WP-062 uses EC-069 — the next free slot. 01.5 NOT INVOKED. 01.6 post-mortem MANDATORY (new long-lived abstraction + new contract consumption). See `EC-069-arena-hud-scoreboard.checklist.md`. | Draft |
| EC-070 | WP-068 | Client UI (`apps/registry-viewer/src/prefs/`) | Preferences Foundation: Pinia-backed preferences subsystem with three shared-tier sections (`appearance`, `accessibility`, `advancedBase`). Adds `pinia ^2.1.7` dep + `tsx` devDep + `test` script to `apps/registry-viewer/package.json`; `createPinia()` wiring + side-effect `registerSections` import in `src/main.ts`. Nine new source files (four `*.schema.ts` + `sectionRegistry.ts` + `persistence.ts` + `createPreferencesStore.ts` + `usePreferences.ts` + `registerSections.ts`) + four `*.test.ts` (schema defaults + purity guard + registry duplicate-id + store round-trip/corrupt-blob backup). Defaults calibrated to plan §2.3 verbatim so a fresh visitor sees bit-identical UI to pre-packet (§5.7 "defaults-match-today"). Option A path locked per D-1414; `packages/ui-preferences/` not created. Schema tier is Node-consumable (no `vue` / `@vue/` / `document.` / `window.` imports in any `*.schema.ts` — enforced by `_schema-purity.test.ts`) so the eventual Option-A → Option-B hoist remains a pure file-move. Persistence is corruption-safe (missing vs corrupt JSON distinguished; corrupt blob copied to `BACKUP_KEY`). **Note:** Drafted alongside execution per P6-36 (the commit-msg hook rejects `WP-###:` prefixes; an EC-### commit prefix requires an EC file). 01.5 NOT INVOKED. 01.6 post-mortem MANDATORY (new long-lived abstraction + new runtime wiring). See `EC-070-preferences-foundation.checklist.md`. Executed 2026-04-18 at commit `bbd58b0` (+ `8ec6ced` structural refinement). | Done |

---

## Registry Viewer (EC-101+ Series)

Ad-hoc viewer-scoped ECs for CI, tooling, a11y, performance, and
deployment hardening of `apps/registry-viewer`. Numbered 101+ to keep
the range clearly separate from game-engine WP-backed ECs.

| EC | Scope | Execution Scope | Status |
|---|---|---|---|
| EC-101 | Viewer / CI + Tooling + A11y | Fix CI duplicate `on.push` triggers; scaffold viewer `typecheck` + `lint` scripts + `.eslintrc.cjs`; add `aria-live` status announcements in `App.vue` | Draft |
| EC-102 | Viewer / Type Consolidation + Cosmetic Lint | Consolidate viewer on `types-index.ts` (wide/live FlatCard); retire stale `types/index.ts` as canonical source for browser.ts/httpRegistry.ts/shared.ts; null-safe field mappings + stringify attack/recruit in shared.ts; silence 2 cosmetic ESLint rules; `prefer-const` fix. **CI gating deferred to EC-103** (vue-tsc exclude bug + 29 real a11y errors surfaced by eslint-plugin-vuejs-accessibility) | Draft |
| EC-103 | Viewer / A11y Cleanup + CI Gating | Resolve EC-102's two blockers: (1) add `@types/node` to unblock `localRegistry.ts` typecheck + re-point its types to `types-index.ts`; (2) fix 29 real a11y errors across 8 Vue SFCs (`no-static-element-interactions` ×13, `click-events-have-key-events` ×10, `form-control-has-label` ×3, `no-redundant-roles` ×1) — prefer `<div @click>` → `<button>` semantic swaps over ARIA. Then wire `Lint viewer` + `Typecheck viewer` CI steps into `build-viewer` job. Includes manual keyboard smoke test. | Done |
| EC-104 | Viewer / Debug Surface (Dev-Only) | Add unified dev-only debug gate `DEBUG_VIEWER` (`import.meta.env.DEV && ?debug`) in new `src/lib/debugMode.ts`; rewrite `devLog.ts` to locked categorical signature `(category, message, fields?)`; instrument `registryClient.ts` / `themeClient.ts` with `load start/complete/failed` events; add conditional `.debug-section` inside `HealthPanel.vue` with optional `debugState` prop fed inline from `App.vue`; tighten ESLint with `no-console: ['error', { allow: ['warn','error'] }]` + overrides for `devLog.ts` / `debugMode.ts`. DCE hard-gate verified: zero `DEBUG_VIEWER` / `debugMode` references in `dist/`. | Done |
| EC-105 | Viewer / A11y Interaction Tracing (Dev-Only) | Add `"a11y"` category to `devLog` plus `traceSource()` helper; instrument backdrop-close / activation / resize / cross-link handlers across `CardDetail.vue`, `GlossaryPanel.vue`, `ImageLightbox.vue`, `HealthPanel.vue`, `ThemeDetail.vue`, and `App.vue` `handleKeydown`. Log-only, zero UI, zero behavior changes, all gated by `DEBUG_VIEWER`. **Trigger:** execute only after WP-065 (Vue SFC Test Transform Pipeline) lands — rationale in checklist §Before Starting. See `EC-105-viewer-a11y-interaction-tracing.checklist.md`. | Deferred |

---

## Rules

- EC status tracks **independently** from WP completion status in `WORK_INDEX.md`
- `Draft` means the EC is generated and structurally correct
- Move to `Done` **only** when the corresponding WP is completed in `WORK_INDEX.md`
- `Blocked` applies when a WP's dependencies are known to be unmet
- This index is subordinate to `WORK_INDEX.md` — it does **not** determine execution order
- **All bug handling must follow** `docs/ai/REFERENCE/01.2-bug-handling-under-ec-mode.md` once any EC is active

---

**Last updated:** 2026-04-17 (EC-065 drafted under new Shared Tooling series; WP-065 unblocks EC-105 once executed)