# Legendary Arena — Claude Architecture Rules

This file **enforces** the architecture; it does not explain it. It is derived
from and subordinate to `.claude/CLAUDE.md`, `docs/ai/ARCHITECTURE.md`
(authoritative), and `docs/01-VISION.md`. Each section's full statement lives
in the ARCHITECTURE.md section named in its `Source:` line. If a Work Packet,
conversation, or suggestion conflicts with the architecture, **STOP and re-read
`docs/ai/ARCHITECTURE.md`**. That document wins.

---

## Authority Hierarchy (Non-Negotiable)

Highest to lowest (ARCHITECTURE.md document override hierarchy, WP-041):

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md`
3. `docs/01-VISION.md`
4. `.claude/rules/*.md` (enforcement layer, derived from ARCHITECTURE.md)
5. `docs/ai/work-packets/WORK_INDEX.md`
6. Individual Work Packets
7. Active conversation context

Claude **may not** override or reinterpret entries 1–3. `docs/ai/DECISIONS.md`
records the rationale; ARCHITECTURE.md encodes the constraint.

## Rule Levels

**Invariant** (never violated; refactor instead), **Derived Rule** (enforced
from ARCHITECTURE.md), **Guardrail** (prevents a known AI failure mode). All
rules below are Invariant unless stated otherwise.

---

## Core Invariants

### Determinism
- All randomness uses `ctx.random.*` exclusively
- `Math.random()`, time, clocks, timers, or wall-clock reads are forbidden
- No filesystem, network, or environment access inside moves, phases, or effects
- Given identical setup + moves, the game must replay identically

Source: ARCHITECTURE.md, Architectural Principles #1

### Engine Owns Truth
- Clients submit **intent**, never outcomes; the engine is the sole authority
- UI consumes read-only projections only; no client-side rule execution or reconciliation

Source: ARCHITECTURE.md, Architectural Principles #2

### UIState Projection Integrity [Derived Rule]

`playerView` (`packages/game-engine/src/game.ts`) is the sole engine→client
projection: `buildUIState(G, ctx)` (`ui/uiState.build.ts`) builds it, then
`filterUIStateForAudience(full, audience)` (`ui/uiState.filter.ts`) is a
**whitelist** that redacts private data and rebuilds the shared-board objects
(`scheme` / `mastermind` / `city` / `hq` / player zones) field-by-field.

**Board-Visible Field Rule (Invariant).** Adding a client-visible `UIState`
field is a **five-step contract**; fields are optional, so TypeScript does not
flag a missed step:

1. Declare it on `UIState` (`ui/uiState.types.ts`).
2. Populate it in `buildUIState`.
3. **Pass it through** `filterUIStateForAudience` with the right audience
   disposition (public shared-board vs owner-redacted).
4. Add an audience-filter test asserting it survives for the intended audiences.
5. Verify it appears in the Play Diagnostics `uiStateSnapshot`.

A field that skips step 3 is silently dropped. This shipped once: EC-206's
`scheme.display` / `scheme.gameText` / `mastermind.gameText` rendered blank
until PR #1165 restored the pass-through (the `matchCardImageUrls` pass-through
exists for the same reason). Corollary: any surface rendering `gameText` /
`abilityText` MUST route it through `AbilityText.vue`; raw marker syntax
(`[hc:…]`, `[icon:…]`) is never shown to a player.

Source: ARCHITECTURE.md, Architectural Principles #2; DECISIONS.md D-12803.
Companion: [ewiki Play Board](../../wiki/play-board.md).

### G and ctx Are Runtime-Only
- `G` is never persisted **by application code**, nor written to any `legendary.*` domain table (framework-store exemption: §Persistence Boundary (Cross-Layer))
- `ctx` is never persisted or serialized by application code
- Snapshots may store **counts only**, never zone contents

Source: ARCHITECTURE.md, Persistence Boundaries

### Zone Contents
- All zones store **CardExtId strings only** — no card objects, metadata, text, images, or DB ids in `G`
- Card display data is resolved by the UI via the registry
- All zone mutations go through `zoneOps.ts` helpers

Source: ARCHITECTURE.md, Zone & Pile Structure

---

## Move & Phase Rules

### Move Validation Contract
Every move, in this order: (1) validate args — return silently on failure;
(2) check the stage gate — return silently if blocked; (3) mutate `G` via
helpers; (4) return `void`. Moves **never throw**; only `Game.setup()` may throw.

A move MAY reject a play with a **card-specific pre-commit precondition**
(D-24185) in step 1 — reading the played card and returning `void` before any
`G` mutation when its cost is unpayable (`discard-to-play`, WP-383, is the first
case). This is a validation-phase return, distinct from the pending-choice
pattern, which fires after commit.

Source: ARCHITECTURE.md, The Move Validation Contract

### Phase & Turn Transitions
- `ctx.phase` is **never set directly**; phases change via `ctx.events.setPhase()` only, turns via `ctx.events.endTurn()` only
- Every call to either **must include a `// why:` comment**

Source: ARCHITECTURE.md, Phase & Turn Transitions

### Turn Stages
- Valid stages: `start` -> `main` -> `cleanup`, stored in `G.currentStage`, never in `ctx`
- Ordering is defined **once** in `turnPhases.logic.ts`; no file may re-encode it

Source: ARCHITECTURE.md, The Turn Stage Cycle

---

## Rule Execution Pipeline

- Rule handlers never live in `G`; `G.hookRegistry` is data-only
- `ImplementationMap` contains functions and is runtime-only
- `executeRuleHooks()` never mutates `G`; `applyRuleEffects()` mutates `G` using `for` / `for...of`
- `.reduce()` is forbidden in rule and zone operations
- Unknown effects emit warnings and continue — never throw

Source: ARCHITECTURE.md, The Rule Execution Pipeline

---

## Layer Boundary (Enforcement — Canonical Source Is ARCHITECTURE.md)

The canonical spec is `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)`.
This section enforces it; if any text here contradicts it, ARCHITECTURE.md wins.

### Layer Overview

| Layer | Package / Path | Role | Claude Enforcement |
|---|---|---|---|
| Registry | `packages/registry/**` | Card data loading & validation | `.claude/skills/legendary-registry/SKILL.md` |
| Game Engine | `packages/game-engine/**` | Gameplay rules & state transitions | `.claude/skills/legendary-game-engine/SKILL.md` |
| Pre-Planning | `packages/preplan/**` | Speculative planning for waiting players (non-authoritative) | `DESIGN-PREPLANNING.md` |
| Server | `apps/server/**` | Wiring, startup, networking | `.claude/skills/legendary-server/SKILL.md` |
| Shared Tooling (test/build only) | `packages/vue-sfc-loader/**` (and future test/build packages) | Dev/test-time transforms consumed only by `apps/*` test scripts or local tooling; never imported by production code | this section |
| Persistence (cross-cutting) | engine / app boundary | Data lifecycle & storage rules | `.claude/skills/legendary-persistence/SKILL.md` |

Each layer depends **only downward**; none reaches upward or sideways. Shared
Tooling is **orthogonal**: no runtime edges into `Registry → Engine → Server`,
and nothing on that chain imports it.

### Import Rules (Quick Reference)

| Package | May import | Must NOT import |
|---|---|---|
| `game-engine` | Node built-ins only | `registry`, `preplan`, `server`, `vue-sfc-loader`, any `apps/*`, `pg` |
| `registry` | Node built-ins, `zod` | `game-engine`, `preplan`, `server`, `vue-sfc-loader`, any `apps/*`, `pg` |
| `preplan` | `game-engine` type-only imports; engine state via host-app projections; Node built-ins | `game-engine` (runtime), `registry`, `server`, `vue-sfc-loader`, any `apps/*`, `pg`, `boardgame.io` |
| `vue-sfc-loader` (WP-065) | `@vue/compiler-sfc` (peer), `vue` (peer), `typescript` (optional, test-only), Node built-ins | `game-engine`, `registry`, `preplan`, `server`, any `apps/*`, `pg`, `boardgame.io`, any runtime UI code |
| `apps/server` | `@legendary-arena/game-engine` (`.` Runtime-Safe Engine Surface), `@legendary-arena/game-engine/setup` (Setup-Tooling Surface, D-14401), `registry`, `@legendary-arena/lagn` (pure zod validator; `validate` + `LAGN`; no upward/sideways runtime edge — D-24086), `pg`, Node built-ins | `preplan`, `vue-sfc-loader`, UI packages, browser APIs |
| `apps/registry-viewer` | `registry`, UI framework, `vue-sfc-loader` (devDep, test scripts only) | `game-engine`, `preplan`, `server`, `pg`, `vue-sfc-loader` at runtime |
| `apps/arena-client` (WP-061+) | UI framework, `vue-sfc-loader` (devDep, test scripts only), `@legendary-arena/preplan` (runtime, D-5901), `@legendary-arena/game-engine` (`.` Runtime-Safe Engine Surface only, WP-090) | `@legendary-arena/game-engine/setup` (Boundary Leakage, D-14401), `registry` (runtime), `server`, `pg`, `vue-sfc-loader` at runtime |
| `apps/engine-runner` (WP-304 / D-24088) | `@legendary-arena/game-engine` (`.` surface), `@legendary-arena/registry` (incl. `/setupContract`), Node built-ins | `boardgame.io` (directly), `pg`, `apps/server`, `preplan`, `vue-sfc-loader`, `@legendary-arena/game-engine/setup`, browser APIs, any deep import of a package `dist` tree or a `simulation` internal path |

Pure helpers must NOT import boardgame.io. `vue-sfc-loader` appears only in
apps' `devDependencies` and their `test` scripts' `NODE_OPTIONS`, never in
production bundles; listing it in `dependencies` is a layer violation.

### Registry Layer (Data Input)
Loads and validates card/metadata JSON (local or R2, via Zod) and exposes an
immutable `CardRegistry`. Never contains gameplay logic, imports the engine or
server, queries PostgreSQL, or mutates game state. Feeds the engine **once**, at
setup; the engine never queries it at runtime. Enforcement: `legendary-registry` skill.

### Game Engine Layer (Gameplay Authority)
Defines the boardgame.io `Game()`, owns all gameplay logic, and mutates `G`
deterministically; receives registry data via `Game.setup()`. Never imports
`apps/server/**`, touches PostgreSQL / HTTP / filesystem / environment, holds
startup / networking / CLI logic, treats `G` as storage, or loads registry data
after setup. The engine **decides outcomes**; the server never does.
Enforcement: `legendary-game-engine` skill.

### Pre-Planning Layer (Non-Authoritative, Per-Client)
Speculative turn planning for waiting players: tracks speculative reveals for
deterministic rewind and emits invalidation events. Type-only engine imports;
reads engine state via host-app projections; may use a client-local seedable
PRNG and disposable sandbox state. Never writes `G` / `ctx` or any
authoritative state, imports `boardgame.io` or engine runtime code, imports
`registry` / `server` / `apps/*`, uses `ctx.random.*` or depends on engine
randomness, or persists anything. The
engine **does not know** it exists. Design: `docs/ai/DESIGN-CONSTRAINTS-PREPLANNING.md`,
`docs/ai/DESIGN-PREPLANNING.md`.

### Server Layer (Wiring Only)
Loads immutable inputs at startup (registry, rules text from PostgreSQL) and
passes deterministic inputs into the engine, wires `LegendaryGame` into
boardgame.io `Server()`, exposes network / CLI entrypoints,
and handles process lifecycle (SIGTERM). Never implements game logic, defines
moves / rules / effects, mutates or interprets `G`, re-implements turn or phase
logic, or coordinates gameplay. Enforcement: `legendary-server` skill.

### Dependency Direction (Non-Negotiable)

```
Registry -> Game Engine -> Server -> Client / CLI
                    |
                    └-> Pre-Planning (type-only imports; reads engine state via host-app projections)

Shared Tooling (orthogonal):
  packages/vue-sfc-loader/ -> apps/* (test scripts only, never runtime)
```

Forbidden: server importing engine helpers to "handle logic"; engine importing
server utilities; runtime engine code querying the registry; registry importing
engine types; pre-planning importing engine runtime code or writing
authoritative state; the engine importing pre-planning; anything on the main
chain importing Shared Tooling; Shared Tooling in any app's runtime `dependencies`.

### Persistence Boundary (Cross-Layer)

- `G` and `ctx` are **runtime-only**; only the server/application layer may persist data
- Snapshots are **derived records** (counts only), never live state or save-games

> **boardgame.io framework-store exemption (D-24095).** boardgame.io's own
> storage adapter MAY persist its opaque match state to the dedicated `bgio`
> schema. Application code never reads or interprets that blob, and it is never
> a save-game or a source of derived features, **except** four server-layer,
> read-only, never-written-back carve-outs: **D-24119** (replay and score
> verification from `initialState + log` of a completed match),
> **D-24153** (Tier-1 LAGN loadout projection from
> `initialState.G.matchConfiguration` + `ctx.numPlayers`), **D-24169** (match
> summary for `/api/dash/matches` from `matchConfiguration`, `numPlayers`, and
> `metadata.{createdAt,updatedAt,gameover}`), and **D-24187** (deriving or
> backfilling `legendary.competitive_scores.team_key` from `heroDeckIds`, read
> from `bgio.replay_artifacts` or the `bgio.matches` blob). The exact terms
> are in ARCHITECTURE.md §Persistence Boundary (Cross-Layer); read them before
> touching any `bgio` read. All other application reads of the blob are forbidden.

This applies across **all layers**. Enforcement: `.claude/skills/legendary-persistence/SKILL.md`

### Enforcement Rule

If unsure where code belongs: decides gameplay → Game Engine; loads or
validates data → Registry; speculatively plans a future turn → Pre-Planning;
wires components or handles process concerns → Server; dev/test-time transform
for `apps/*` → Shared Tooling; stores anything → re-check Persistence. If a
change touches more than one layer, **stop and re-evaluate**.

### Final Principle

**Registry provides data. Engine decides outcomes. Pre-planning speculates
privately. Server connects pieces. Shared Tooling supports builds and tests
without ever running in production.**

Source: ARCHITECTURE.md, Package Import Rules

### Disconnect & Reconnect Posture (Cross-Reference)

Policy lives in [`docs/ai/ARCHITECTURE.md §Disconnect & Reconnect Semantics`](../../docs/ai/ARCHITECTURE.md#disconnect--reconnect-semantics)
(D-11601..D-11605; D-11606 deferred). A WP that wires reconnect handlers MUST
cite WP-116 and those D-entries.

---

## Prohibited AI Failure Patterns [Guardrail]

Claude must not:
- Invent mechanics, rules, phases, counters, or card behavior
- Persist runtime state "for convenience"
- Infer state from UI concerns
- Optimize before correctness and determinism are proven
- Introduce parallel validation or error contracts
- Store functions, Maps, Sets, or classes in `G`
- Create new `.claude/rules/` files without explicit human approval

When unsure, ask or log the decision in `DECISIONS.md`. Never guess.

## Final Enforcement Rule

Code that **compiles but violates architecture** is still wrong. When in doubt,
re-read `.claude/CLAUDE.md`, `docs/ai/ARCHITECTURE.md`, and `docs/01-VISION.md`,
then correct before proceeding.
