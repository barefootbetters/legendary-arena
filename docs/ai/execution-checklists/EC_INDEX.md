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
| EC-034 | WP-034    | Game Engine / Versioning | 3 version axes (`EngineVersion` semver, `DataVersion` integer, `ContentVersion` integer), `VersionedArtifact<T>` wrapper, `checkCompatibility` (pure decision; never throws), `migrateArtifact` (forward-only; throws on no path per D-0802 load-boundary exception), `stampArtifact` (single permitted wall-clock read in subtree per D-3401 sub-rule), MVP `migrationRegistry = Object.freeze({})`. Five new files under `packages/game-engine/src/versioning/` (D-3401 engine code category). 9 new tests in one `describe('versioning (WP-034)')` block; engine 427→436, repo 517→526. P6-43 paraphrase pass caught six JSDoc/grep collisions at first verification gate run — first empirical demonstration of cross-session precedent-log value. 01.5 NOT INVOKED. 01.6 post-mortem MANDATORY (new long-lived abstraction `VersionedArtifact<T>` + new code-category directory D-3401) — verdict WP COMPLETE. See `EC-034-versioning.checklist.md` + `docs/ai/invocations/session-wp034-versioning-save-migration.md`. Executed 2026-04-19 at commit `5139817`. | Done   |
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
| EC-069 | WP-062 | Client UI (`apps/arena-client/src/components/hud/`) | Arena HUD & Scoreboard: seven-file Vue 3 component tree (`ArenaHud`, `TurnPhaseBanner`, `SharedScoreboard`, `ParDeltaReadout`, `PlayerPanelList`, `PlayerPanel`, `EndgameSummary`) + `hudColors.ts` palette helper; six `node:test` component tests under jsdom via `vue-sfc-loader/register`. `ArenaHud.vue` is the sole `useUiStateStore` consumer (container/presenter split); every subcomponent takes its UIState sub-slice via props. `aria-label`s bind to literal leaf field names pinned by WP-067's drift test (`bystandersRescued`, `escapedVillains`, `twistCount`, `tacticsRemaining`, `tacticsDefeated`, `finalScore`). `<SharedScoreboard />` renders unconditionally (`progress` is required on every UIState). `<ParDeltaReadout />` renders em-dash when `!('par' in gameOver)` (D-6701 dominant runtime case); zero is a valid engine value and renders as `0`. `base.css` gains five HUD tokens with numeric contrast ratios. `ArenaHud.vue`, `PlayerPanel.vue`, `PlayerPanelList.vue`, `ParDeltaReadout.vue`, and `EndgameSummary.vue` use the `defineComponent({ setup() { return {...} } })` form per D-6512/P6-30 — under vue-sfc-loader's separate-compile pipeline, template bindings beyond props must be returned from `setup()` and imported child components must be registered via the `components: {...}` option; `TurnPhaseBanner.vue` + `SharedScoreboard.vue` remain in `<script setup>` (props-only templates). **Note:** EC-062–EC-064 unused; EC-065–EC-068 historically bound; following the EC-061 → EC-067 and EC-066 → EC-068 retargeting precedent, WP-062 uses EC-069 — the next free slot. 01.5 NOT INVOKED. 01.6 post-mortem MANDATORY (new long-lived abstraction + new contract consumption). See `EC-069-arena-hud-scoreboard.checklist.md`. Executed 2026-04-18 at commit `<pending — gatekeeper session>`. | Done |
| EC-070 | WP-068 | Client UI (`apps/registry-viewer/src/prefs/`) | Preferences Foundation: Pinia-backed preferences subsystem with three shared-tier sections (`appearance`, `accessibility`, `advancedBase`). Adds `pinia ^2.1.7` dep + `tsx` devDep + `test` script to `apps/registry-viewer/package.json`; `createPinia()` wiring + side-effect `registerSections` import in `src/main.ts`. Nine new source files (four `*.schema.ts` + `sectionRegistry.ts` + `persistence.ts` + `createPreferencesStore.ts` + `usePreferences.ts` + `registerSections.ts`) + four `*.test.ts` (schema defaults + purity guard + registry duplicate-id + store round-trip/corrupt-blob backup). Defaults calibrated to plan §2.3 verbatim so a fresh visitor sees bit-identical UI to pre-packet (§5.7 "defaults-match-today"). Option A path locked per D-1414; `packages/ui-preferences/` not created. Schema tier is Node-consumable (no `vue` / `@vue/` / `document.` / `window.` imports in any `*.schema.ts` — enforced by `_schema-purity.test.ts`) so the eventual Option-A → Option-B hoist remains a pure file-move. Persistence is corruption-safe (missing vs corrupt JSON distinguished; corrupt blob copied to `BACKUP_KEY`). **Note:** Drafted alongside execution per P6-36 (the commit-msg hook rejects `WP-###:` prefixes; an EC-### commit prefix requires an EC file). 01.5 NOT INVOKED. 01.6 post-mortem MANDATORY (new long-lived abstraction + new runtime wiring). See `EC-070-preferences-foundation.checklist.md`. Executed 2026-04-18 at commit `bbd58b0` (+ `8ec6ced` structural refinement). | Done |
| EC-071 | WP-063 | Game Engine (`packages/game-engine/src/replay/`) + CLI Producer App (`apps/replay-producer/`) | Replay Snapshot Producer: adds engine type `ReplaySnapshotSequence { version: 1, snapshots: readonly UIState[], metadata? }` + pure helper `buildSnapshotSequence({ setupConfig, seed, playerOrder, moves, registry, metadata? })` that wraps WP-080's `applyReplayStep` step-level API, calls WP-028's `buildUIState` at each step, and returns a frozen sequence (no I/O, no logging, no wall clock, no RNG, no `boardgame.io` import). Adds NEW CLI app `apps/replay-producer/` (first `cli-producer-app` per D-6301) with `produce-replay --in --out --match-id --produced-at` flags, documented exit codes 0–4 (named constants `EXIT_OK` / `EXIT_INVALID_ARGS` / `EXIT_INPUT_PARSE` / `EXIT_ENGINE` / `EXIT_OUTPUT_WRITE` behind a single `// why:` block), sorted top-level JSON keys (D-6302), optional-field omission (D-6303 — never `"metadata": undefined` / `null`), sourcemaps via `process.setSourceMapsEnabled(true)` at entry, and a committed `three-turn-sample` golden artifact triplet. Execution surfaced **D-6305** (`ReplayInputsFile` field named `moves: readonly ReplayMove[]` to match WP-027 canonical naming, not `inputs: readonly ReplayInput[]` as the WP literally phrased it; helper requires explicit `playerOrder` + `registry` parameters beyond the WP's 3-field signature; full rationale in `docs/ai/post-mortems/01.6-WP-063-replay-snapshot-producer.md` §D-6305). **Note:** EC-062–EC-064 unused; EC-065–EC-070 historically bound; following the EC-061 → EC-067, EC-066 → EC-068, EC-062 → EC-069 retargeting precedent, WP-063 uses EC-071 — the next free slot. Commits use `EC-071:` prefix (never `WP-063:` per P6-36). 01.5 NOT INVOKED. 01.6 post-mortem MANDATORY (new long-lived abstraction + new code category) — delivered in-session at `docs/ai/post-mortems/01.6-WP-063-replay-snapshot-producer.md`; verdict WP COMPLETE. Pre-commit review ran in separate gatekeeper session per P6-35; no P6-42 deviation. See `EC-071-replay-snapshot-producer.checklist.md`. Executed 2026-04-19 at commit `97560b1`. | Done |
| EC-072 | WP-080 | Game Engine (`packages/game-engine/src/replay/`) | Replay Harness Step-Level API: adds named export `applyReplayStep(gameState, move, numPlayers): LegendaryGameState` to `packages/game-engine/src/replay/replay.execute.ts` (Q1 = Option A — single function, minimum surface); refactors `replayGame`'s internal loop to delegate to the new export so `MOVE_MAP` remains the single source of truth for dispatch (Q3 = Option A; regression guard via byte-identical `computeStateHash` on the existing `verifyDeterminism` fixture). `MOVE_MAP`, `buildMoveContext`, and `ReplayMoveContext` remain file-local (Q4 — not exported). State-ownership contract: mutate-and-return-same-reference (Q2 = Option A; consumers wanting historical snapshots project via `buildUIState`, not `G` copies). `ReplayInputsFile` is OUT OF SCOPE (Q5 — WP-063's concern). RNG semantics unchanged; D-0205 remains in force. New test file `replay.execute.test.ts` asserts identity, `replayGame` regression, and unknown-move warning-and-skip routing. Adds exactly one new export line under the existing WP-027 block in `packages/game-engine/src/index.ts`. **Note:** EC-062–EC-064 unused; EC-065–EC-071 historically bound; following the EC-061 → EC-067, EC-066 → EC-068, EC-062 → EC-069, and EC-063 → EC-071 retargeting precedent, WP-080 uses EC-072 — the next truly free slot. Commits use `EC-072:` prefix (never `WP-080:` per P6-36). Hard upstream: WP-079 / EC-073 (JSDoc narrowing on `replay.execute.ts` must land first; both packets touch the same file; WP-080 inherits WP-079 verbatim). 01.5 NOT INVOKED. 01.6 post-mortem MANDATORY (new long-lived abstraction — `applyReplayStep` becomes the canonical step-level dispatch surface for every future replay consumer). See `EC-072-replay-harness-step-level-api.checklist.md`. Executed 2026-04-19 at commit `dd0e2fd`. | Done |
| EC-073 | WP-079 | Game Engine / Documentation (`packages/game-engine/src/replay/`) | Label Replay Harness as Determinism-Only: doc-only JSDoc + module-header rewrite on `packages/game-engine/src/replay/replay.execute.ts` and `packages/game-engine/src/replay/replay.verify.ts` per D-0205's single follow-up action. Zero runtime behavior change; zero signature change; zero export change; zero test change (test count IDENTICAL to starting commit). Forbidden phrases ("replays live matches", "replays a specific match", "reproduces live-match outcomes") grep to zero; required phrases ("determinism-only" ≥ 2 in execute / ≥ 1 in verify; D-0205 xref in both; `MOVE_LOG_FORMAT.md` Gap #4 xref in execute). Existing `// why:` comments preserved verbatim (reverse-shuffle `replay.execute.ts:118–124`; events no-op `:110–117`; two-run rationale `replay.verify.ts:43–45`). Hard downstream: WP-080 / EC-072 (both WPs touch `replay.execute.ts`; WP-079 lands first and WP-080 inherits the narrowing verbatim). **Note:** EC-062–EC-064 unused; EC-065–EC-072 historically bound; following the EC-061 → EC-067, EC-066 → EC-068, EC-062 → EC-069, EC-063 → EC-071, and EC-080 → EC-072 retargeting precedent, WP-079 uses EC-073 — the next truly free slot. Commits use `EC-073:` prefix (NEVER `WP-079:` per P6-36 — the WP body's trailing note saying "use `WP-079:` prefix" predates P6-36 and is superseded by EC-073's Locked Values). NO 01.6 post-mortem required (doc-only; no new long-lived abstraction; no new code category — both P6-35 triggers absent). See `EC-073-label-replay-harness-determinism-only.checklist.md`. Executed 2026-04-19 at commit `1e6de0b`. | Done |
| EC-074 | WP-064 | Client UI (`apps/arena-client/src/replay/` + `src/components/log/` + `src/components/replay/` + `src/fixtures/replay/`) | Game Log & Replay Inspector: four new SFCs (`<GameLogPanel />`, `<ReplayInspector />`, `<ReplayFileLoader />`, plus `loadReplay.ts` parser) that consume `ReplaySnapshotSequence` from WP-063 and drive `useUiStateStore().setSnapshot` on index changes. **Consumer-side `version === 1` assertion per D-6303** carries three locked full-sentence error templates mirroring the WP-063 CLI wording (invalid version / missing `snapshots` / empty `snapshots`). **`<ReplayInspector />` and `<ReplayFileLoader />` are non-leaf** under `@legendary-arena/vue-sfc-loader` and use `defineComponent({ setup() {...} })` form per P6-30 / P6-40 (`<ReplayFileLoader />` was promoted from `<script setup>` mid-execution after the first test run revealed its template references non-prop bindings — same vue-sfc-loader separate-compile failure WP-061's `<BootstrapProbe />` and WP-062's HUD containers documented per D-6512 / P6-30); `<GameLogPanel />` stays in `<script setup>` (props-only template). Keyboard controls `←` / `→` / `Home` / `End` with `tabindex="0"` root + listeners-on-root — locks **D-6401** as first repo precedent (confirmed via WP-062 HUD review: no prior keyboard-stepper art). Fixture is 8 snapshots produced by the committed WP-063 CLI using 3 `advanceStage` moves (for `G.currentStage` stage transitions: start→main between snapshots 0-1, main→cleanup between 2-3) + 4 unknown-move records (for `UIState.log` growth via `applyReplayStep`'s warning-and-skip at `replay.execute.ts:162–166`); **phase transitions unreachable via producer per D-0205, rescoped to stage transitions** per the WP-064 2026-04-19 amendment. Fixture path `apps/arena-client/src/fixtures/replay/three-turn-sample.{json,inputs.json,cmd.txt}`; byte-identical regeneration confirmed twice. Sourcemaps inherit Vite defaults (WP-061). 01.5 NOT INVOKED. 01.6 post-mortem MANDATORY (new long-lived abstraction `parseReplayJson` + new keyboard focus precedent D-6401) delivered in-session at `docs/ai/post-mortems/01.6-WP-064-log-replay-inspector.md` — verdict WP COMPLETE. One in-allowlist refinement applied during post-mortem: `<ReplayInspector />`'s `currentLog` computed now spread-copies `snapshot.log` before passing to `<GameLogPanel />` (WP-028 / D-2802 aliasing-prevention). Pre-commit review ran in separate gatekeeper session per P6-35 default; no P6-42 deviation. Verification (12 of 12 pass): build/typecheck/test exit 0; arena-client 35→66 (+31); repo-wide 486→517 (+31); no runtime engine/registry/boardgame.io import; no engine move/hook names leaked; no `Math.random`/`Date.now`/`performance.now` (P6-43 paraphrase form); no `.reduce()` in rendering; engine/registry/vue-sfc-loader/server/replay-producer/registry-viewer untouched; `pnpm-lock.yaml` absent (P6-44); both stashes intact; EC-069 placeholder not backfilled; WP-080 post-mortem not staged. **Note:** EC-062–EC-064 unused; EC-065–EC-073 historically bound; following the EC-061 → EC-067, EC-066 → EC-068, EC-062 → EC-069, EC-063 → EC-071, EC-080 → EC-072, and EC-079 → EC-073 retargeting precedent, WP-064 uses EC-074 — the next free slot. Commits use `EC-074:` prefix (never `WP-064:` per P6-36). See `EC-074-log-replay-inspector.checklist.md` + `docs/ai/preflight-wp064.md` (READY verdict 2026-04-19). Executed 2026-04-19 at commit `76beddc`. | Done |

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

**Last updated:** 2026-04-19 (EC-034 executed at commit `5139817` — WP-034 Versioning & Save Migration Strategy lands the first persistence-versioning surface for the engine: `EngineVersion` semver + `DataVersion` / `ContentVersion` integer axes, `VersionedArtifact<T>` wrapper, `checkCompatibility` pure decision function, `migrateArtifact` forward-only with load-boundary throw exception per D-0802, `stampArtifact` save-time embed with the single permitted wall-clock read in the subtree per D-3401 sub-rule. Five new files under `packages/game-engine/src/versioning/` (D-3401 engine code category, seventh instance of the established directory-classification pattern after replay/ui/campaign/invariants/network/content); additive re-exports in `types.ts` and `index.ts` only — no `LegendaryGameState` shape change, no other engine subdirectory touched. MVP `migrationRegistry = Object.freeze({})` is the long-lived seam. 9 new tests in one `describe('versioning (WP-034)')` block per P6-19 / P6-25 suite-count discipline; engine 427→436 (+9; 108→109 suites), repo-wide 517→526 (+9). `pnpm-lock.yaml` absent (P6-44); both retained stashes intact. 01.5 NOT INVOKED. 01.6 post-mortem mandatory triggers fired (new long-lived abstraction `VersionedArtifact<T>` + new code-category directory D-3401) — verdict WP COMPLETE; zero in-allowlist refinements applied during post-mortem. **Meta-finding:** P6-43 (JSDoc + grep collision precedent authored from WP-064 execution and committed at `0c741c6`) caught six initial JSDoc-vs-grep collisions at the first verification gate run; all fixed via paraphrase form before re-test. First empirical demonstration that the precedent log is load-bearing across sessions. Three commits: `c587f74` SPEC pre-flight (D-3401 + 02-CODE-CATEGORIES.md + session prompt); `5139817` EC-034 code + post-mortem; this SPEC governance close. Prior EC-074 execution close footer retained below as historical context — EC-074 executed at commit `76beddc` — WP-064 Game Log & Replay Inspector lands four new client surfaces consuming WP-063's `ReplaySnapshotSequence` artifact: `parseReplayJson` D-6303 site, `<GameLogPanel />` leaf, `<ReplayInspector />` non-leaf with `tabindex="0"` + listeners-on-root keyboard pattern locked as first repo precedent **D-6401**, `<ReplayFileLoader />` non-leaf — promoted from `<script setup>` mid-execution after the same vue-sfc-loader separate-compile failure WP-061 / WP-062 documented. Fixture `three-turn-sample.{json,inputs.json,cmd.txt}` at 8 snapshots, byte-identical regeneration confirmed; arena-client tests 35→66, repo-wide 486→517; engine/registry/vue-sfc-loader/server/replay-producer/registry-viewer all untouched; `pnpm-lock.yaml` absent from diff per P6-44; both inherited stashes preserved. 01.6 post-mortem mandatory triggers fired (new long-lived abstraction + new keyboard precedent) — verdict WP COMPLETE; one in-allowlist refinement applied (`currentLog` spread-copy in `<ReplayInspector />` per WP-028 / D-2802 aliasing-prevention pattern). Prior EC-071 execution close footer retained below as historical context — EC-071 executed at commit `97560b1` with repo-wide tests 464 → 486.)