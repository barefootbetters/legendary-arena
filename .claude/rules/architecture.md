# Legendary Arena — Claude Architecture Rules

This file exists to **enforce** the authoritative system architecture during
AI-assisted development. It is **derived from** and **subordinate to**:

- `docs/ai/ARCHITECTURE.md` (authoritative architecture)
- `docs/ai/REFERENCE/00.1-master-coordination-prompt.md` (override hierarchy)

This file **does not explain architecture**.
It encodes **hard constraints Claude must never violate**.

If a Work Packet, conversation, or suggestion conflicts with the architecture,
**STOP and re-read `docs/ai/ARCHITECTURE.md`**. That document wins.

---

## Authority Hierarchy (Non-Negotiable)

Highest to Lowest:

1. `.claude/CLAUDE.md` (root coordination for Claude Code sessions)
2. `docs/ai/REFERENCE/00.1-master-coordination-prompt.md`
3. `docs/ai/ARCHITECTURE.md`
4. `.claude/rules/*.md` (enforcement layer)
5. Individual Work Packets
6. Active conversation context

Claude **may not** override or reinterpret entries 1 or 2.

---

## Rule Levels

- **Invariant** — may never be violated; refactor instead
- **Derived Rule** — directly enforced from ARCHITECTURE.md
- **Guardrail** — prevents known AI failure modes

All rules below are **Invariant unless stated otherwise**.

---

## Core Invariants

### Determinism
- All randomness uses `ctx.random.*` exclusively
- `Math.random()`, time, clocks, timers, or wall-clock reads are forbidden
- No filesystem, network, or environment access inside moves, phases, or effects
- Given identical setup + moves, the game must replay identically

Source: ARCHITECTURE.md, Architectural Principles #1

### Engine Owns Truth
- Clients submit **intent**, never outcomes
- The engine is the sole authority on game state
- UI consumes read-only projections only
- No client-side rule execution or reconciliation

Source: ARCHITECTURE.md, Architectural Principles #2

### G and ctx Are Runtime-Only
- `G` is never persisted, stored, cached, or written to any database
- `ctx` is never persisted or serialized by application code
- Snapshots may store **counts only**, never zone contents

Source: ARCHITECTURE.md, Persistence Boundaries

### Zone Contents
- All zones store **CardExtId strings only**
- No card objects, metadata, text, images, or database IDs in `G`
- Card display data is resolved by the UI via the registry
- All zone mutations go through `zoneOps.ts` helpers

Source: ARCHITECTURE.md, Zone & Pile Structure

---

## Move & Phase Rules

### Move Validation Contract
Every move must follow this exact order:
1. Validate args (return silently on failure)
2. Check stage gate (return silently if blocked)
3. Mutate `G` via helpers
4. Return `void`

Moves **never throw**.
Only `Game.setup()` may throw.

Source: ARCHITECTURE.md, The Move Validation Contract

### Phase & Turn Transitions
- `ctx.phase` is **never set directly**
- Phase changes use `ctx.events.setPhase()` only
- Turn changes use `ctx.events.endTurn()` only
- Every call to either **must include a `// why:` comment**

Source: ARCHITECTURE.md, Phase & Turn Transitions

### Turn Stages
- Valid stages: `start` -> `main` -> `cleanup`
- Stage lives in `G.currentStage`, never in `ctx`
- Ordering is defined **once** in `turnPhases.logic.ts`
- No file may re-encode stage ordering

Source: ARCHITECTURE.md, The Turn Stage Cycle

---

## Rule Execution Pipeline

- Rule handlers never live in `G`
- `G.hookRegistry` is data-only
- `ImplementationMap` contains functions and is runtime-only
- `executeRuleHooks()` never mutates `G`
- `applyRuleEffects()` mutates `G` using `for` / `for...of`
- `.reduce()` is forbidden in rule and zone operations
- Unknown effects emit warnings and continue — never throw

Source: ARCHITECTURE.md, The Rule Execution Pipeline

---

## Layer Boundary (Authoritative)

Legendary Arena is structured as a **strictly layered system**.
Each layer has a single responsibility and hard boundaries that must not be crossed.

Violations of these boundaries are **architectural bugs**, even if the code compiles
or appears to "work".

This section is the **canonical reference** for layer responsibility and ownership.
Enforcement of these boundaries is implemented in the corresponding
`.claude/rules/*.md` files.

### Layer Overview

| Layer | Package / Path | Role | Claude Enforcement |
|---|---|---|---|
| Registry | `packages/registry/**` | Card data loading & validation | `.claude/rules/registry.md` |
| Game Engine | `packages/game-engine/**` | Gameplay rules & state transitions | `.claude/rules/game-engine.md` |
| Pre-Planning | `packages/preplan/**` | Speculative planning for waiting players (non-authoritative) | `DESIGN-PREPLANNING.md` |
| Server | `apps/server/**` | Wiring, startup, networking | `.claude/rules/server.md` |
| Persistence (cross-cutting) | engine / app boundary | Data lifecycle & storage rules | `.claude/rules/persistence.md` |

Each layer depends **only downward**.
No layer may reach upward or sideways.

### Import Rules (Quick Reference)

| Package | May import | Must NOT import |
|---|---|---|
| `game-engine` | Node built-ins only | `registry`, `preplan`, `server`, any `apps/*`, `pg` |
| `registry` | Node built-ins, `zod` | `game-engine`, `preplan`, `server`, any `apps/*`, `pg` |
| `preplan` | `game-engine` (types only), Node built-ins | `game-engine` (runtime), `registry`, `server`, any `apps/*`, `pg`, `boardgame.io` |
| `apps/server` | `game-engine`, `registry`, `pg`, Node built-ins | `preplan`, UI packages, browser APIs |
| `apps/registry-viewer` | `registry`, UI framework | `game-engine`, `preplan`, `server`, `pg` |

Pure helpers must NOT import boardgame.io.

### Registry Layer (Data Input)

**Purpose:**
- Load and validate card and metadata JSON
- Expose an immutable `CardRegistry`

**May:**
- Read local files or R2 via loaders
- Validate data via Zod schemas
- Expose read-only data structures

**Must NEVER:**
- Contain gameplay logic
- Import `packages/game-engine`
- Import `apps/server`
- Query PostgreSQL
- Mutate runtime game state

**Direction:** Registry -> Game Engine (setup-time only)

Registry feeds data **once**.
The engine never queries the registry at runtime.

Enforcement: `.claude/rules/registry.md`

### Game Engine Layer (Gameplay Authority)

**Purpose:**
- Define the boardgame.io `Game()` object
- Own all gameplay logic (phases, moves, rule hooks, turn flow, endgame)
- Mutate `G` deterministically

**May:**
- Receive registry data via `Game.setup()`
- Use `ctx.random.*` (never `Math.random()`)
- Maintain derived runtime state in `G`
- Export pure helpers and types

**Must NEVER:**
- Import anything from `apps/server/**`
- Query PostgreSQL, HTTP, filesystem, or environment
- Contain startup, networking, or CLI logic
- Treat `G` as persistent storage
- Load registry data after setup time

**Direction:** Game Engine -> Server (wired into `Server()`)

The engine **decides outcomes**.
The server never does.

Enforcement: `.claude/rules/game-engine.md`

### Pre-Planning Layer (Non-Authoritative, Per-Client)

**Purpose:**
- Provide speculative turn planning for waiting players
- Track speculative reveals for deterministic rewind
- Detect disruptions and produce invalidation events

**May:**
- Import engine type definitions (`import type` only, e.g., `CardExtId`)
- Read engine state projections (read-only snapshots)
- Use a client-local seedable PRNG for speculative deck shuffling
- Maintain disposable sandbox state

**Must NEVER:**
- Write to `G`, `ctx`, or any authoritative game state
- Import `boardgame.io`
- Import engine runtime code (functions, constants, helpers)
- Import `registry`, `server`, or any `apps/*` package
- Use `ctx.random.*` or depend on engine randomness
- Persist state to any storage

**Direction:** Game Engine -> Pre-Planning (read-only types)

The engine **does not know** pre-planning exists.
Pre-planning observes the engine; it never influences it.

Design docs: `docs/ai/DESIGN-CONSTRAINTS-PREPLANNING.md`,
`docs/ai/DESIGN-PREPLANNING.md`

### Server Layer (Wiring Only)

**Purpose:**
- Load immutable inputs at startup
- Wire `LegendaryGame` into boardgame.io `Server()`
- Expose network and CLI entrypoints
- Manage process lifecycle

**May:**
- Load registry data at startup
- Load rules text from PostgreSQL
- Pass deterministic inputs into the engine
- Handle process signals (SIGTERM)

**Must NEVER:**
- Implement game logic
- Define moves, rules, or effects
- Mutate or interpret `G`
- Re-implement turn or phase logic
- Act as a "coordinator" of gameplay

**Direction:** Server -> Client / CLI

The server **connects pieces**.
It does not decide what happens in the game.

Enforcement: `.claude/rules/server.md`

### Dependency Direction (Non-Negotiable)

```
Registry -> Game Engine -> Server -> Client / CLI
                    |
                    └-> Pre-Planning (types only, read-only)
```

Forbidden examples:
- Server importing game-engine helpers to "handle logic"
- Engine importing server utilities (rules loader, DB access)
- Runtime engine code querying registry
- Registry importing engine types
- Pre-planning importing engine runtime code (type-only permitted)
- Engine importing pre-planning (engine does not know it exists)
- Pre-planning writing to G, ctx, or any authoritative state

### Persistence Boundary (Cross-Layer)

- `G` and `ctx` are **runtime-only**
- Only the server/application layer may persist data
- Snapshots are **derived records**, never live state
- No layer may treat snapshots as save-games

This applies across **all layers**.

Enforcement: `.claude/rules/persistence.md`

### Enforcement Rule

If unsure where code belongs:

- **If it decides gameplay** -> Game Engine
- **If it loads or validates data** -> Registry
- **If it speculatively plans a future turn** -> Pre-Planning
- **If it wires components or handles process concerns** -> Server
- **If it stores anything** -> re-check Persistence rules

If a change touches more than one layer, **stop and re-evaluate**.
Layer violations compound silently and are expensive to unwind later.

### Final Principle

**Registry provides data.**
**Engine decides outcomes.**
**Pre-planning speculates privately.**
**Server connects pieces.**

If a layer starts doing another layer's job, the architecture is already broken.

Source: ARCHITECTURE.md, Package Import Rules

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

When unsure:
- Ask for clarification **or**
- Log the decision in `DECISIONS.md`

Never guess.

---

## Final Enforcement Rule

If code **compiles but violates architecture**, it is still wrong.

When in doubt:
1. Re-read `docs/ai/ARCHITECTURE.md`
2. Re-read `00.1-master-coordination-prompt.md`
3. Stop and correct before proceeding

This file exists to keep Claude aligned — not creative.
