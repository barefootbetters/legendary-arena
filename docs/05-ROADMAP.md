# Legendary Arena -- Development Roadmap

> A modern multiplayer evolution of the Marvel Legendary deck-building card game.
> Built with **boardgame.io**, **TypeScript**, and **Cloudflare R2**.

**Last updated:** 2026-04-19 (**Phase 6 closed — tagged `phase-6-complete` at commit `c376467`**) — WP-027..033 landed 2026-04-14/15/16; EC-103/104 landed 2026-04-16/17; WP-065 at `bc23913` under EC-065; WP-061 at `2e68530` under EC-067; **WP-048 landed 2026-04-17 at commit `2587bbb` under EC-048** — PAR scoring infrastructure; **WP-067 landed 2026-04-17 at commit `1d709e5` under EC-068** — UIState PAR breakdown + progress counters with D-6701 safe-skip; **WP-062 landed 2026-04-18 at commit `7eab3dc` under EC-069** (merged at `3307b12`) — Arena HUD component tree; **WP-079 landed 2026-04-19 at commit `1e6de0b` under EC-073** — JSDoc-only narrowing of replay harness as determinism-only per D-0205 follow-up; **WP-080 landed 2026-04-19 at commit `dd0e2fd` under EC-072** — `applyReplayStep` step-level API; **WP-063 landed 2026-04-19 at commit `97560b1` under EC-071** — `ReplaySnapshotSequence` + `apps/replay-producer/` CLI; **WP-064 landed 2026-04-19 at commit `76beddc` under EC-074** — client replay-consumption surface + D-6401 keyboard focus pattern; **WP-034 landed 2026-04-19 at commit `5139817` under EC-034** — `packages/game-engine/src/versioning/` (three version axes + `VersionedArtifact<T>` + `checkCompatibility` / `migrateArtifact` / `stampArtifact`; engine 427→436); **WP-035 landed 2026-04-19 at commit `d5935b5` under EC-035** — `packages/game-engine/src/ops/` engine subtree + `docs/ops/RELEASE_CHECKLIST.md` + `DEPLOYMENT_FLOW.md` + `INCIDENT_RESPONSE.md` (D-3501..D-3504); **WP-042 landed 2026-04-19 at commit `c964cf4` under EC-042** — `docs/ai/deployment/r2-data-checklist.md` (full §A.1–§A.7) + `docs/ai/deployment/postgresql-checklist.md` (scope-reduced to §B.1/§B.2/§B.6/§B.7 per D-4201) + D-4202/D-4203 governance. **Phase 6 tagged `phase-6-complete` at governance-close commit `c376467`** (19 WPs landed; engine 436/109/0; repo-wide 526/0; WP-042.1 deferred per D-4201 + WP-066 unreviewed carried forward to Phase 7 backlog). -- **Authoritative source:** [`docs/ai/work-packets/WORK_INDEX.md`](ai/work-packets/WORK_INDEX.md)

---

## Current Status

**Foundation Prompts**
`00.4` ✅ `00.5` ✅ `01` ✅ `02` ✅

**Work Packets**
`WP-001` ✅ `WP-002` ✅ `WP-003` ✅ `WP-004` ✅ `WP-005A` ✅ `WP-005B` ✅ `WP-006A` ✅ `WP-006B` ✅ `WP-007A` ✅ `WP-007B` ✅ `WP-008A` ✅ `WP-008B` ✅ `WP-009A` ✅ `WP-009B` ✅ `WP-010` ✅ `WP-011` ✅ `WP-012` ✅ `WP-013` ✅ `WP-014A` ✅ `WP-014B` ✅ `WP-015` ✅ `WP-016` ✅ `WP-017` ✅ `WP-018` ✅ `WP-019` ✅ `WP-020` ✅ `WP-021` ✅ `WP-022` ✅ `WP-023` ✅ `WP-024` ✅ `WP-025` ✅ `WP-026` ✅ `WP-027` ✅ `WP-028` ✅ `WP-029` ✅ `WP-030` ✅ `WP-031` ✅ `WP-032` ✅ `WP-033` ✅ `WP-034` ✅ `WP-035` ✅ `WP-042` ✅ `WP-043` ✅ `WP-044` ✅ `WP-045` ✅ `WP-046` ✅ `WP-047` ✅ `WP-048` ✅ `WP-061` ✅ `WP-062` ✅ `WP-063` ✅ `WP-064` ✅ `WP-065` ✅ `WP-067` ✅ `WP-079` ✅ `WP-080` ✅ -- `WP-042.1` ⏸ (blocked on FP-03 revival per D-4201) `WP-055` ⬜ `WP-056` ⬜ `WP-057` ⬜ `WP-058` ⬜ `WP-060` ⬜ `WP-066` ⬜ (not yet reviewed) -- **WP-036..041, 049..054** ⬜

**Overall Progress**
60 / 74 items complete (4 FPs + 56 WPs). **Phase 6 closed on 2026-04-19 — tagged `phase-6-complete` at commit `c376467`.** The ops chain (`WP-034 → WP-035 → WP-042`) landed sequentially on 2026-04-19 and closes the verification / production workstream: `WP-034` at `5139817` under EC-034 (versioning subtree: `EngineVersion` / `DataVersion` / `ContentVersion` + `VersionedArtifact<T>` + `checkCompatibility` / `migrateArtifact` / `stampArtifact`; engine 427→436); `WP-035` at `d5935b5` under EC-035 (ops types subtree + `docs/ops/` playbook: `RELEASE_CHECKLIST.md` + `DEPLOYMENT_FLOW.md` + `INCIDENT_RESPONSE.md`; D-3501..D-3504); `WP-042` at `c964cf4` under EC-042 (deployment checklists: full R2 §A.1–§A.7 + scope-reduced PostgreSQL §B.1/§B.2/§B.6/§B.7 per D-4201; D-4202 UI-rendering-layer exclusion back-pointer + D-4203 Documentation-class invariant). Engine baseline held at 436/109/0 through all three; repo-wide held at 526/0. **Phase 7 entry:** WP-055 / WP-060 (content, parallel-safe), WP-056 (Pre-Plan State, parallel-safe), plus the Phase 7 main sequence (WP-036..041, 049..051). **Carry-forward backlog:** WP-042.1 (deferred per D-4201, unblocks when Foundation Prompt 03 is revived), WP-066 (standalone registry-viewer feature, not yet reviewed).

---

## Foundation Layer

Infrastructure that everything else builds on.

| #       | Name                                | What It Establishes                                | Status      |
|---------|-------------------------------------|----------------------------------------------------|-------------|
| FP-00.4 | Connection & Environment Health Check | `pnpm check` / `pnpm check:env`                 | ✅ Complete |
| FP-00.5 | R2 Data & Image Validation          | `pnpm validate` -- 4-phase integrity check (40 sets) | ✅ Complete |
| FP-01   | Render.com Backend                  | Server scaffold, PostgreSQL, `render.yaml`         | ✅ Complete |
| FP-02   | Database Migrations                 | Migration runner + seed pipeline                   | ✅ Complete |

---

## Phase 0 -- Coordination & Contracts ✅

Establishes repo-as-memory system and locks contracts.

| WP      | Name                             | Layer              | What It Produces                               | Status      |
|---------|----------------------------------|--------------------|-------------------------------------------------|-------------|
| 001     | Foundation & Coordination System | Documentation      | REFERENCE docs, WORK_INDEX, override hierarchy  | ✅ Complete |
| 002     | boardgame.io Game Skeleton       | Game Engine        | `LegendaryGame`, 4 phases, `validateSetupData`  | ✅ Complete |
| 003     | Card Registry Verification       | Registry           | Fix 2 defects + smoke test                      | ✅ Complete |
| 004     | Server Bootstrap                 | Server             | Wire engine + registry into `Server()`           | ✅ Complete |
| 043-047 | Governance Packets               | Docs / Coordination| Align all foundation prompts with framework      | ✅ Complete |

---

## Phase 1 -- Game Setup Contracts & Determinism ✅

Defines *what* a match is before *how* it plays.

| WP     | Name                             | Layer   | What It Produces                                  | Status      |
|--------|----------------------------------|---------|----------------------------------------------------|-------------|
| 005A/B | Match Setup & Deterministic Init | Engine  | `MatchSetupConfig`, `shuffleDeck`, `Game.setup()`  | ✅ Complete |
| 006A/B | Player State & Zones             | Engine  | `PlayerZones`, `GlobalPiles`, validators            | ✅ Complete |

---

## Content Layer -- Theme Data Model

Engine-agnostic content contracts. Parallel-safe with Phase 2+.

| WP  | Name                      | Layer    | What It Produces                                         | Status |
|-----|---------------------------|----------|----------------------------------------------------------|--------|
| 055 | Theme Data Model          | Registry | `ThemeDefinition` Zod schema, `content/themes/`, examples | ⬜ Ready |
| 060 | Keyword & Rule Glossary   | Content  | `keywords-full.json`, `rules-full.json` in `data/metadata/` + R2 | ⬜ Ready |

Themes are curated mastermind/scheme/villain/hero combinations recreating
iconic Marvel storylines. WP-055 defines the schema and validation only --
loading, referential integrity, and projection into `MatchSetupConfig` land
as scope items in the first WP that consumes themes at runtime (UI, setup,
etc.), not as standalone packets.

WP-060 migrates 102 keyword definitions and 18 rule definitions from the
predecessor `modern-master-strike` project into `data/metadata/` and R2.
The registry viewer currently hardcodes these; WP-060 replaces hardcoded
definitions with runtime fetch. Parallel-safe with Phase 2+.

---

## Pre-Planning System (Parallel-Safe with Phase 4+)

Sandboxed speculative planning for waiting players. Reduces multiplayer
downtime by eliminating mental backtracking when inter-player effects
disrupt pre-planned turns.

| WP  | Name                     | Layer    | What It Produces                                    | Status |
|-----|--------------------------|----------|-----------------------------------------------------|--------|
| 056 | State Model & Lifecycle  | Pre-Plan | `PrePlan` types, lifecycle invariants, `packages/preplan/` | ⬜ Ready |
| 057 | Sandbox Execution        | Pre-Plan | PRNG, sandbox creation, speculative operations       | ⬜ Ready |
| 058 | Disruption Pipeline      | Pre-Plan | Detection, invalidation, rewind, notification        | ⬜ Ready |
| 059 | UI Integration           | UI       | Client wiring, notification rendering                | ⏸ Deferred |

WP-059 is deferred until WP-028 (UI State Contract) and a UI framework
decision. Integration guidance in `docs/ai/DESIGN-PREPLANNING.md` §11.

Design docs:
[`DESIGN-CONSTRAINTS-PREPLANNING.md`](ai/DESIGN-CONSTRAINTS-PREPLANNING.md) |
[`DESIGN-PREPLANNING.md`](ai/DESIGN-PREPLANNING.md)

---

## Phase 2 -- Core Turn Engine ✅

First playable (but incomplete) game loop.

| WP     | Name                 | Layer   | What It Produces                       | Status      |
|--------|----------------------|---------|----------------------------------------|-------------|
| 007A/B | Turn Structure & Loop | Engine | `MATCH_PHASES`, `advanceTurnStage`      | ✅ Complete |
| 008A   | Core Moves Contracts | Engine  | `MoveResult`, `MOVE_ALLOWED_STAGES`, validators | ✅ Complete |
| 008B   | Core Moves Implementation | Engine | `drawCards`, `playCard`, `endTurn` mutations | ✅ Complete |

---

## Phase 3 -- MVP Multiplayer Infrastructure ✅

Minimum viable multiplayer loop. Phase 3 exit gate closed 2026-04-11
(D-1320). All five exit criteria pass: determinism under concurrency,
intent validation, snapshot integrity, engine/server separation, and
failure mode behavior.

| WP      | Name                       | Layer   | What It Produces                            | Status      |
|---------|----------------------------|---------|----------------------------------------------|-------------|
| 009A/B  | Rule Hooks                 | Engine  | 5 triggers, 4 effect types, execution pipeline | ✅ Complete |
| 010     | Victory & Loss Conditions  | Engine  | `evaluateEndgame`, `ENDGAME_CONDITIONS`       | ✅ Complete |
| 011     | Match Creation & Lobby     | Engine  | `LobbyState`, `setPlayerReady`, `startMatchIfReady` | ✅ Complete |
| 012     | Match Listing & Join       | Server  | `list-matches.mjs`, `join-match.mjs` CLI scripts | ✅ Complete |
| 013     | Persistence Boundaries     | Engine  | `PERSISTENCE_CLASSES`, `MatchSnapshot`, `createSnapshot` | ✅ Complete |

---

## Phase 4 -- Core Gameplay Loop ✅

The game finally plays like Legendary. Full MVP combat loop: setup →
play cards → fight villains → recruit heroes → fight mastermind →
endgame → VP scoring. 247 tests passing.

| WP      | Name                                  | Layer   | What It Produces                                       | Status      |
|---------|---------------------------------------|---------|--------------------------------------------------------|-------------|
| 014A    | Villain Reveal & Trigger Pipeline     | Engine  | `revealVillainCard`, card type classification           | ✅ Complete |
| 014B    | Villain Deck Composition              | Engine  | `buildVillainDeck`, henchman/scheme/mastermind cards    | ✅ Complete |
| 015     | City & HQ Zones                       | Engine  | `G.city`, `G.hq`, `pushVillainIntoCity`, escapes       | ✅ Complete |
| 016     | Fight & Recruit Moves                 | Engine  | `fightVillain`, `recruitHero` (no resource gating)     | ✅ Complete |
| 017     | KO, Wounds & Bystander Capture        | Engine  | `G.ko`, `gainWound`, bystander attach/award/resolve    | ✅ Complete |
| 018     | Attack & Recruit Point Economy        | Engine  | `G.turnEconomy`, `G.cardStats`, resource-gated moves   | ✅ Complete |
| 019     | Mastermind Fight & Tactics            | Engine  | `G.mastermind`, `fightMastermind`, victory trigger      | ✅ Complete |
| 020     | VP Scoring & Win Summary              | Engine  | `computeFinalScores`, per-player VP breakdowns          | ✅ Complete |

---

## Phase 5 -- Card Mechanics & Abilities ✅

Individual cards come alive. Hero abilities fire with keywords and
conditions. Scheme twists and mastermind strikes produce real effects.
Board keywords add tactical City friction. Scheme setup instructions
configure the board before the first turn. 314 tests passing.

| WP      | Name                                  | Layer   | What It Produces                                        | Status      |
|---------|---------------------------------------|---------|----------------------------------------------------------|-------------|
| 021     | Hero Card Text & Keywords (Hooks)     | Engine  | `HeroAbilityHook[]`, `HeroKeyword` union, setup builder  | ✅ Complete |
| 022     | Execute Hero Keywords (Minimal MVP)   | Engine  | `executeHeroEffects`, draw/attack/recruit/ko keywords     | ✅ Complete |
| 023     | Conditional Hero Effects              | Engine  | `evaluateCondition`, 4 condition types, AND logic         | ✅ Complete |
| 024     | Scheme & Mastermind Ability Execution | Engine  | `schemeTwistHandler`, `mastermindStrikeHandler`           | ✅ Complete |
| 025     | Keywords: Patrol, Ambush, Guard       | Engine  | `BoardKeyword`, fight cost/blocking/wound-on-entry        | ✅ Complete |
| 026     | Scheme Setup Instructions             | Engine  | `SchemeSetupInstruction`, executor, builder (MVP: `[]`)   | ✅ Complete |

---

## Phase 6 -- Verification, UI & Production ✅ (tagged `phase-6-complete` at `c376467` on 2026-04-19)

Making the game safe to ship.

| WP      | Name                                | Layer          | What It Produces                               | Status |
|---------|--------------------------------------|----------------|-------------------------------------------------|--------|
| 027-033 | Replay through Network Boundaries   | Engine + Ops   | Determinism, UIState, versioning, network types | ✅ Complete |
| 034     | Versioning & Save Migration Strategy | Engine Versioning | `packages/game-engine/src/versioning/` — three version axes, `VersionedArtifact<T>`, `checkCompatibility`, `migrateArtifact`, `stampArtifact`, `migrationRegistry` (MVP frozen empty); D-3401 engine-code-category classification | ✅ Complete (2026-04-19, EC-034, commit `5139817`) |
| 035     | Release, Deployment & Ops Playbook   | Ops            | `packages/game-engine/src/ops/` types subtree (`OpsCounters` / `DeploymentEnvironment` / `IncidentSeverity`) + `docs/ops/RELEASE_CHECKLIST.md` (seven gates) + `DEPLOYMENT_FLOW.md` (four-environment sequential promotion + rollback) + `INCIDENT_RESPONSE.md` (P0–P3 ladder); D-3501..D-3504 | ✅ Complete (2026-04-19, EC-035, commit `d5935b5`) |
| 042     | Deployment Checklists (Data, Database & Infrastructure) | Ops / Docs | `docs/ai/deployment/r2-data-checklist.md` (full §A.1–§A.7) + `docs/ai/deployment/postgresql-checklist.md` (scope-reduced to §B.1 / §B.2 / §B.6 / §B.7 per D-4201; §B.3–§B.5 / §B.8 deferred to WP-042.1) + RELEASE_CHECKLIST back-pointers + ARCHITECTURE cross-reference; D-4201 (scope reduction), D-4202 (UI-rendering-layer exclusion back-pointer), D-4203 (Documentation-class invariant) | ✅ Complete (2026-04-19, EC-042, commit `c964cf4`) |
| 048     | PAR Scenario Scoring & Leaderboards | Engine Scoring | ScenarioKey, ScoreBreakdown, LeaderboardEntry, six D-entries (D-4801–D-4806) | ✅ Complete (2026-04-17, EC-048, commit `2587bbb`) |
| 065     | Vue SFC Test Transform Pipeline     | Shared tooling | `packages/vue-sfc-loader/`, `@vue/compiler-sfc` register hook | ✅ Complete (2026-04-17, EC-065, commit `bc23913`) |
| 061     | Gameplay Client Bootstrap           | Client UI      | `apps/arena-client/` Vue 3 + Pinia skeleton, `UIState` fixtures | ✅ Complete (2026-04-17, EC-067, commit `2e68530`) |
| 067     | UIState Projection of PAR Scoring & Progress Counters | Engine — UI projection | `UIProgressCounters`, optional `UIGameOverState.par`, drift tests, three WP-061 fixture conformance edits, D-6701 PAR safe-skip | ✅ Complete (2026-04-17, EC-068, commit `1d709e5`) |
| 062     | Arena HUD & Scoreboard              | Client UI      | Turn/phase banner, shared scoreboard, PAR delta, player panels, EndgameSummary; generalized D-6512 to P6-30/40 vue-sfc-loader pattern | ✅ Complete (2026-04-18, EC-069, commit `7eab3dc`; merged at `3307b12`) |
| 079     | Label Replay Harness Determinism-Only | Engine — docs only | JSDoc + module-header rewrite on `replay.execute.ts` + `replay.verify.ts` per D-0205 follow-up | ✅ Complete (2026-04-19, EC-073, commit `1e6de0b`) |
| 080     | Replay Harness Step-Level API       | Engine          | `applyReplayStep(gameState, move, numPlayers)` exported; `replayGame` loop refactored to delegate; `MOVE_MAP` remains single source of truth | ✅ Complete (2026-04-19, EC-072, commit `dd0e2fd`) |
| 063     | Replay Snapshot Producer            | Engine + CLI   | `ReplaySnapshotSequence` engine type + `apps/replay-producer/` CLI (first cli-producer-app per D-6301) + golden three-turn-sample fixture triplet | ✅ Complete (2026-04-19, EC-071, commit `97560b1`) |
| 064     | Game Log & Replay Inspector         | Client UI      | `parseReplayJson` consumer-side D-6303 site + `<GameLogPanel />` + `<ReplayInspector />` + `<ReplayFileLoader />` + new D-6401 keyboard focus pattern (first repo stepper precedent) | ✅ Complete (2026-04-19, EC-074, commit `76beddc`) |

### UI Implementation Chain (Phase 6)

The UI chain introduces the first gameplay client and its first consumer
surfaces. Decisions captured during drafting (2026-04-16) and refined
during WP-061 execution (2026-04-17):

- **Vitest forbidden** (lint §7, §12) -- `node:test` is the only permitted
  test runner project-wide. WP-065 established the Vue SFC test transform
  pipeline that makes this work by wrapping `@vue/compiler-sfc` in a
  Node 22 `module.register()` loader hook. ✅ Shipped 2026-04-17 (EC-065).
  Every UI WP that tests `.vue` components depends on WP-065.
- **Gameplay client skeleton** ✅ Shipped 2026-04-17 as `apps/arena-client/`
  (EC-067, commit `2e68530`). Vue 3 + Vite + Pinia SPA; single-state
  `useUiStateStore()` with `snapshot: UIState | null` + `setSnapshot`; typed
  JSON fixtures validated via `satisfies UIState`; `<BootstrapProbe />`
  wiring smoke; DCE-guarded dev `?fixture=` URL harness. Engine import is
  type-only.
- **Intermediate UIState projection WP (WP-067)** ✅ — WP-062 as originally
  drafted depended on `rawScore` / `parScore` / `finalScore` /
  `bystandersRescued` / `escapedVillains` being readable on `UIState`;
  none were. WP-048 ships the scoring types but explicitly produces no UI
  projection ("No UI changes -- scoring produces data, not display").
  WP-067 bridged that gap: added
  `UIState.progress: UIProgressCounters` (non-optional, projection-time
  aggregation), optional `UIGameOverState.par: UIParBreakdown` with
  D-6701 PAR safe-skip when scoring config absent, drift-detection tests,
  and fixture conformance edits. Shipped 2026-04-17 (EC-068, commit
  `1d709e5`) right after WP-048 (`2587bbb`). WP-062 then consumed the
  surface and shipped 2026-04-18 (EC-069, commit `7eab3dc`, merged at
  `3307b12`). Full UI scoring chain (WP-048 → WP-067 → WP-062) closed
  within 24 hours.
- **Floating-window system dropped** -- vision-misaligned (Legendary is a
  cooperative tabletop recreation, not an arena sim).
- **Cosmetic theming deferred** to a future monetization WP; accessibility
  presets (WCAG AA contrast, color-blind-safe palette) were folded into
  WP-061's base CSS ✅ (`--color-foreground`, `--color-background`,
  `--color-focus-ring` with numeric contrast ratios per D-6515) and
  extend into WP-062's HUD components.
- **`<script setup>` vs `defineComponent` under vue-sfc-loader** (trap
  discovered 2026-04-17, precedent P6-30 in 01.4; refined 2026-04-19 by
  WP-064 as P6-46): vue-sfc-loader's separate-compile pipeline
  (`inlineTemplate: false`) does NOT expose `<script setup>` top-level
  bindings on the template's `_ctx`, so any tested `.vue` component
  with setup-scope bindings in its template must use the explicit
  `defineComponent({ setup() { return {...} } })` form (D-6512). The
  precise rule (per P6-46): *"any template binding that is neither a
  `defineProps`-declared prop nor a `defineEmits`-declared emit forces
  `defineComponent({ setup() { return {...} } })` form."* WP-064's
  `<ReplayFileLoader />` was promoted from `<script setup>` mid-execution
  after the same failure WP-061's `<BootstrapProbe />` and WP-062's HUD
  containers documented; `<GameLogPanel />` (props-only template) stays
  in `<script setup>`.
- **Spectator HUD layout** is a future WP (consumes WP-029).
- **`ReplaySnapshotSequence` defined once** in the engine by WP-063 ✅
  and imported as a type by WP-064 ✅ -- the client never regenerates
  `UIState` from moves. Verified at `parseReplayJson` (consumer-side
  D-6303 assertion site) and at `<ReplayInspector />` (drives
  `useUiStateStore().setSnapshot` on index changes; no engine call).
- **D-6401 keyboard focus pattern** (introduced 2026-04-19 by WP-064):
  stepper-style interactive components in `apps/arena-client/` carry
  `tabindex="0"` on the root + mount keyboard listeners on the root
  element + clamp-not-wrap at sequence boundaries. First repo
  precedent (confirmed via WP-061 / WP-062 review — no prior keyboard-
  stepper art). Future stepper components (moves timeline, scenario
  selector, tutorial carousel, spectator-position chooser) inherit
  this pattern.
- **Pinia reactive proxy ≠ raw object** (precedent P6-47 in 01.4):
  Pinia wraps stored values in reactive proxies on assignment, so
  strict reference equality (`assert.equal(store.snapshot, original)`)
  always fails. Future client-app tests assert by content equality
  (deep-equal or `JSON.stringify`) or by display-state side effects.
  WP-064 locks `loadedIndex(store, sequence)` as the canonical
  "which fixture index is currently loaded" helper.

---

## Phase 7 -- Beta, Launch & Live Ops

Ship it, score it, keep it alive.

| WP      | Name                                  | Layer              | What It Produces                              |
|---------|---------------------------------------|---------------------|-----------------------------------------------|
| 036-041 | AI Playtesting through Architecture Audit | Simulation + Ops | Beta strategy, metrics, growth governance      |
| 049     | PAR Simulation Engine                 | Tooling / Simulation | T2 heuristic AI, PAR aggregation, policy tiers |
| 050     | PAR Artifact Storage & Indexing       | Tooling / Data       | Immutable versioned artifacts, index, validation |
| 051     | PAR Publication & Server Gate         | Server / Enforcement | Pre-release gate, fail-closed competitive check |

---

## Scoring & PAR Pipeline

The competitive scoring system spans multiple phases and layers:

```
Scoring Reference (12-SCORING-REFERENCE.md)
  ↓
WP-048: Scoring contracts (Engine)
  ↓
WP-049: Simulation calibration (Tooling) ← WP-036 (AI framework)
  ↓
WP-050: Immutable artifact storage (Data)
  ↓
WP-051: Server gate enforcement (Server)
  ↓
Competitive Leaderboards
```

Key documents: `docs/12-SCORING-REFERENCE.md`, `docs/12.1-PAR-ARTIFACT-INTEGRITY.md`

---

## Dependency Overview

```mermaid
flowchart TD
    FP["Foundation Prompts\n00.4 ✅ 00.5 ✅ 01 ✅ 02 ✅"] --> WP001["WP-001 ✅\nCoordination"]
    WP001 --> WP002["WP-002 ✅\nGame Skeleton"]
    WP001 --> WP003["WP-003 ✅\nCard Registry"]
    WP002 --> WP004["WP-004 ✅\nServer Bootstrap"]
    WP003 --> WP004
    WP003 --> WP055["WP-055\nTheme Data Model"]
    WP003 --> WP060["WP-060\nKeyword Glossary"]
    WP004 --> Phase1["Phase 1 ✅\nGame Setup"]
    Phase1 --> WP055
    Phase1 --> Phase2["Phase 2 ✅\nTurn Engine"]
    Phase2 --> Phase3["Phase 3 ✅\nMVP Multiplayer"]
    Phase3 --> Phase4["Phase 4 ✅\nCore Gameplay"]
    Phase4 --> Phase5["Phase 5 ✅\nCard Abilities"]
    Phase5 --> Phase6["Phase 6 ✅\nProduction (tagged phase-6-complete)"]
    Phase6 --> Phase7["Phase 7\nBeta & Launch"]
    Phase6 --> WP048["WP-048\nPAR Scoring"]
    Phase7 --> WP049["WP-049\nPAR Simulation"]
    WP048 --> WP049
    WP049 --> WP050["WP-050\nPAR Artifacts"]
    WP050 --> WP051["WP-051\nServer Gate"]
    Phase2 --> WP056["WP-056\nPrePlan State"]
    WP056 --> WP057["WP-057\nSandbox Exec"]
    WP057 --> WP058["WP-058\nDisruption Pipeline"]
    Phase6 --> WP028["WP-028 ✅\nUIState Contract"]
    Phase6 --> WP065["WP-065 ✅\nVue SFC Test Transform"]
    WP028 --> WP061["WP-061 ✅\nClient Bootstrap"]
    WP065 --> WP061
    WP028 --> WP067["WP-067 ✅\nUIState PAR + Progress Projection"]
    WP048 --> WP067
    WP067 --> WP062["WP-062 ✅\nArena HUD"]
    WP061 --> WP062
    WP065 --> WP062
    WP061 --> WP064["WP-064 ✅\nLog & Replay Inspector"]
    WP065 --> WP064
    WP028 --> WP063["WP-063 ✅\nReplay Snapshot Producer"]
    Phase6 --> WP027["WP-027 ✅\nReplay Harness"]
    WP027 --> WP079["WP-079 ✅\nLabel Determinism-Only"]
    WP079 --> WP080["WP-080 ✅\napplyReplayStep API"]
    WP080 --> WP063
    WP063 --> WP064
    Phase6 --> WP034ops["WP-034 ✅\nVersioning & Save Migration"]
    WP034ops --> WP035ops["WP-035 ✅\nRelease & Ops Playbook"]
    WP035ops --> WP042ops["WP-042 ✅\nDeployment Checklists"]
    style FP fill:#10b981,color:#fff
    style WP001 fill:#10b981,color:#fff
    style WP002 fill:#10b981,color:#fff
    style WP003 fill:#10b981,color:#fff
    style WP004 fill:#10b981,color:#fff
    style Phase1 fill:#10b981,color:#fff
    style Phase2 fill:#10b981,color:#fff
    style Phase3 fill:#10b981,color:#fff
    style Phase4 fill:#10b981,color:#fff
    style Phase5 fill:#10b981,color:#fff
    style WP027 fill:#10b981,color:#fff
    style WP028 fill:#10b981,color:#fff
    style WP048 fill:#10b981,color:#fff
    style WP065 fill:#10b981,color:#fff
    style WP061 fill:#10b981,color:#fff
    style WP062 fill:#10b981,color:#fff
    style WP067 fill:#10b981,color:#fff
    style WP079 fill:#10b981,color:#fff
    style WP080 fill:#10b981,color:#fff
    style WP063 fill:#10b981,color:#fff
    style WP064 fill:#10b981,color:#fff
    style Phase6 fill:#10b981,color:#fff
    style WP034ops fill:#10b981,color:#fff
    style WP035ops fill:#10b981,color:#fff
    style WP042ops fill:#10b981,color:#fff
```

**Parallel-safe packets:** WP-003 (alongside 002), WP-005A/B (no dep on 004), WP-030 (parallel to 031), WP-055/060 (parallel with Phase 2+), WP-056/057/058 (parallel with Phase 4+). The full UI chain (WP-048 ✅, WP-061 ✅, WP-062 ✅, WP-063 ✅, WP-064 ✅, WP-065 ✅, WP-067 ✅) plus the replay-harness sub-chain (WP-079 ✅, WP-080 ✅) plus the ops chain (WP-034 ✅ → WP-035 ✅ → WP-042 ✅) are all complete; **Phase 6 closed on 2026-04-19 with tag `phase-6-complete` at `c376467`**. The scoring side (WP-048 → WP-067 → WP-062) closed 2026-04-17/18; the replay side (WP-079 → WP-080 → WP-063 → WP-064) closed 2026-04-19; the ops side (WP-034 → WP-035 → WP-042) closed 2026-04-19.

---

## Architectural Invariants

- Determinism is non-negotiable -- randomness only via `ctx.random.*`
- Engine owns truth -- clients send intents, never outcomes
- `G` is never persisted -- only `MatchSnapshot` is saved
- Moves never throw -- only `Game.setup()` is allowed to
- Zones store only `CardExtId` strings
- Every phase/transition has a `// why:` comment
- PAR artifacts are immutable trust surfaces -- write-once, never overwritten
- Scoring semantics are an immutable surface -- no changes without major version bump

---

## Governance System

| Document | Role |
|----------|------|
| `.claude/CLAUDE.md` | Root coordination (loaded every session) |
| `docs/ai/ARCHITECTURE.md` | Architectural decisions & boundaries |
| `docs/ai/work-packets/WORK_INDEX.md` | Execution order & status |
| `.claude/rules/*.md` | 7 layer-specific enforcement rules |
| `docs/ai/execution-checklists/EC-*.md` | WP-backed ECs + ad-hoc R-EC (registry hygiene) and EC-101+ (viewer) series; see `EC_INDEX.md` for status |
| `docs/ai/DECISIONS.md` | Immutable decisions |
| `docs/12-SCORING-REFERENCE.md` | PAR scoring formula & leaderboard rules |
| `docs/ai/REFERENCE/03A-PHASE-3-MULTIPLAYER-READINESS.md` | Phase 3 exit gate (closed) |

*Last updated: 2026-04-19 (**Phase 6 closure pass** — ops chain WP-034 → WP-035 → WP-042 all landed 2026-04-19 and the phase was tagged `phase-6-complete` at governance-close commit `c376467`. **WP-034** ✅ at `5139817` under EC-034 — `packages/game-engine/src/versioning/` subtree adding three version axes (`EngineVersion` semver + `DataVersion` / `ContentVersion` integer), `VersionedArtifact<T>` wrapper, `checkCompatibility` (pure), `migrateArtifact` (forward-only; load-boundary throw per D-0802 exception), `stampArtifact` (single permitted wall-clock read in subtree per D-3401 sub-rule), MVP `migrationRegistry = Object.freeze({})`; engine 427→436; 01.6 WP COMPLETE. **WP-035** ✅ at `d5935b5` under EC-035 — `packages/game-engine/src/ops/` engine subtree (D-3501 eighth engine subdirectory) exporting pure-type `OpsCounters` / `DeploymentEnvironment` / `IncidentSeverity` (RS-1 option (a): no runtime instance in engine — monitoring is passive, humans decide) + three `docs/ops/` playbook files (`RELEASE_CHECKLIST.md` with seven gates; `DEPLOYMENT_FLOW.md` with four-environment sequential promotion + four rollback rules implementing D-0902 at deployment boundary; `INCIDENT_RESPONSE.md` with P0–P3 ladder + D-0802 vs D-1234 mapping); D-3501..D-3504; engine 436 unchanged; 01.6 WP COMPLETE. **WP-042** ✅ at `c964cf4` under EC-042 — seven-file allowlist delivering `docs/ai/deployment/r2-data-checklist.md` (full §A.1–§A.7 grounded in the real `validate.ts` env-var surface: `METADATA_DIR` / `SETS_DIR` / `HEALTH_OUT` / `R2_BASE_URL` / `SKIP_IMAGES` / `IMAGE_DELAY_MS`) + `docs/ai/deployment/postgresql-checklist.md` (scope-reduced to §B.1 / §B.2 / §B.6 / §B.7 per **D-4201**; §B.3 / §B.4 / §B.5 / §B.8 deferred to **WP-042.1** awaiting Foundation Prompt 03 revival) + `ARCHITECTURE.md` one-line cross-reference + `RELEASE_CHECKLIST.md` two back-pointer blocks (Gate 2 + runtime-invariant relationship) + **D-4202** (P6-51 form-(2) back-pointer for legacy 00.2b §C UI-rendering-layer exclusion) + **D-4203** (P6-51 form-(1) Documentation-class invariant) + 01.6 post-mortem (verdict WP COMPLETE); engine 436 unchanged; repo-wide 526 unchanged. **Phase 6 tag** `phase-6-complete` published to origin at `c376467`; 19 WPs landed; WP-042.1 (deferred per D-4201) and WP-066 (unreviewed standalone registry-viewer feature) carried forward to Phase 7 backlog. Prior 2026-04-19 history retained: the replay sub-chain WP-027 → WP-079 → WP-080 → WP-063 → WP-064 closed sequentially on 2026-04-19 (D-6401 keyboard focus pattern + new precedents P6-43..P6-49 in 01.4). Prior 2026-04-17/18 refresh notes retained: WP-048 ✅ `2587bbb`, WP-067 ✅ `1d709e5`, WP-062 ✅ `7eab3dc` merged at `3307b12`; Phase 6 total went 11/14 → 14/14 with this closure pass; overall 57/74 → 60/74.)*
