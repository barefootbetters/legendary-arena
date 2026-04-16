# 02 — Code Categories

> **REFERENCE DOCUMENT — Not an execution prompt.**
>
> **Subordination:** This document is subordinate to:
>
> 1. `docs/ai/ARCHITECTURE.md` (authoritative layer boundaries)
> 2. `.claude/rules/*.md` (per-layer enforcement rules)
>
> If this document conflicts with either, the higher-authority document wins.
> This document names and organizes what those documents enforce.

---

## Purpose

Every file in the codebase belongs to exactly one code category. Categories
define what a file is allowed to do — what it may import, whether it may
mutate state, and what failure mode applies when it breaks.

This document exists so that:

- Pre-flight can check: "does this file belong to the right category?"
- Debugging can start with: "what category is this? what are the rules?"
- Patching can assess: "what's the blast radius of changing this?"
- New WPs can scope: "which categories will this touch?"

Categories are **structural and enforceable**, not labels. If two categories
allow the same imports, access the same data, and mutate the same state,
they are not real categories.

---

## Category Summary

| ID | Category | Primary location | Enforcement |
|---|---|---|---|
| `framework` | Framework / Orchestration | `game.ts`, phase hooks, move map | `.claude/rules/game-engine.md` |
| `engine` | Game Engine / Rules Core | `packages/game-engine/src/rules/`, `src/hero/`, `src/economy/`, `src/board/` | `.claude/rules/game-engine.md` |
| `setup` | Setup-Time Builders | `packages/game-engine/src/setup/` | `.claude/rules/game-engine.md` |
| `moves` | Move Implementations | `packages/game-engine/src/moves/` | `.claude/rules/game-engine.md` |
| `data-input` | Data Input / Registry | `packages/registry/`, `data/` | `.claude/rules/registry.md` |
| `server` | Server / Persistence | `apps/server/` | `.claude/rules/server.md`, `.claude/rules/persistence.md` |
| `test` | Tests | `**/*.test.ts` | `.claude/rules/code-style.md` |
| `infra` | Data Pipeline / Infra | `scripts/`, `.githooks/`, CI workflows | N/A (not shipped to players) |
| `docs` | Documentation / Governance | `docs/`, `.claude/` | `.claude/rules/work-packets.md` |

---

## Category Definitions

### `framework` — Framework / Orchestration

**What it is:** Code bound to boardgame.io — `game.ts`, phase hooks
(`onBegin`, `onEnd`), the moves map, `endIf`. Anything that receives
`ctx` from the framework or calls `ctx.events.*`.

**May:** Import `boardgame.io`. Mutate `G` (under Immer draft). Call
`ctx.events.setPhase()`, `ctx.events.endTurn()`. Wire engine components.

**Must not:** Implement game rules. Load data. Perform IO. Contain
pure rule logic beyond coordination.

**Failure mode:** Timing/ordering bugs. Phase transition errors.

**Directories:** `packages/game-engine/src/game.ts`

---

### `engine` — Game Engine / Rules Core

**What it is:** Deterministic rules, data-only contracts, rule execution
logic, keyword handling, economy helpers, zone operations. The heart of
correctness and replayability.

**May:** Read immutable inputs from `G`. Compute derived state. Use pure
helpers. Iterate deterministically with `for...of`.

**Must not:** Import `boardgame.io`. Import registry packages. Perform IO.
Use `Math.random()`. Throw (return void instead). Use `.reduce()` for
branching logic. Store functions in `G`.

**Failure mode:** Determinism violations. Replay divergence. Rule
incorrectness.

**Directories:** `packages/game-engine/src/rules/`,
`packages/game-engine/src/hero/`, `packages/game-engine/src/economy/`,
`packages/game-engine/src/board/`, `packages/game-engine/src/turn/`,
`packages/game-engine/src/state/`, `packages/game-engine/src/scoring/`,
`packages/game-engine/src/mastermind/`,
`packages/game-engine/src/villainDeck/`,
`packages/game-engine/src/replay/` (D-2706),
`packages/game-engine/src/ui/` (D-2801),
`packages/game-engine/src/campaign/` (D-3001),
`packages/game-engine/src/invariants/` (D-3101),
`packages/game-engine/src/network/` (D-3201),
`packages/game-engine/src/content/` (D-3301)

---

### `setup` — Setup-Time Builders

**What it is:** Code that runs during `Game.setup()`. Converts input data
(registry, config) into derived runtime state stored in `G`. Registry
resolution, configuration expansion, initial state construction.

**May:** Consume registry data as a function parameter. Generate immutable
runtime data. Produce `G.*` fields. Use `ctx.random.Shuffle` for
deterministic deck shuffling. Throw on invalid configuration (only context
where throwing is permitted).

**Must not:** Be called after setup. Import `boardgame.io` (receives ctx
as a parameter, never imports it). Mutate state at runtime. Access
database or network.

**Failure mode:** Data provenance errors. Wrong data resolved into `G`.
Traceability gaps.

**Directories:** `packages/game-engine/src/setup/`

---

### `moves` — Move Implementations

**What it is:** boardgame.io move functions that follow the three-step
contract: validate args, check stage gate, mutate `G`. Bridge between
framework category and engine category.

**May:** Import `boardgame.io` (for `FnContext` type). Mutate `G` under
Immer draft. Call engine helpers and assign return values. Destructure
`ctx` for `random`, `events`.

**Must not:** Throw. Implement rule logic beyond dispatch. Access registry.
Perform IO.

**Failure mode:** Move validation errors. Stage gating gaps. Silent no-ops
vs expected mutations.

**Directories:** `packages/game-engine/src/moves/`

---

### `data-input` — Data Input / Registry

**What it is:** Schema definitions (Zod), card JSON files, metadata files,
registry loaders, converters, validators. The source of all card and
configuration data.

**May:** Perform IO (file reads, HTTP fetches). Use Zod for validation.
Load and parse JSON. Export immutable data structures.

**Must not:** Import `game-engine`. Import `server`. Contain game logic.
Mutate runtime state. Access databases.

**Failure mode:** Typos, schema drift, silent data corruption, wrong file
loaded (sets.json vs card-types.json). Bugs here manifest as wrong
gameplay behavior downstream.

**Directories:** `packages/registry/`, `data/cards/`, `data/metadata/`

---

### `server` — Server / Persistence

**What it is:** PostgreSQL access, network endpoints, process lifecycle,
rules text loading, PAR enforcement, security boundaries. Wires engine
into `boardgame.io Server()`.

**May:** Access databases. Load registry at startup. Pass data into engine
via `Game.setup()`. Handle process signals. Manage auth.

**Must not:** Implement game logic. Define moves or rules. Mutate or
inspect `G` beyond routing. Import UI packages.

**Failure mode:** Authority and trust violations. Data leaks. Deployment
issues.

**Directories:** `apps/server/`

---

### `test` — Tests

**What it is:** Unit tests (pure engine), integration tests (moves +
engine), validation tests (registry / pipeline). All use `node:test` +
`node:assert`.

**May:** Use mocks (`makeMockCtx`, inline mock contexts). Assert
deterministic outcomes. Create minimal test game states.

**Must not:** Import `boardgame.io`. Contain business logic. Mutate
shared test helpers. Use `.test.mjs` extension. Require a live server.

**Failure mode:** False confidence from weak assertions. Test debt from
missing defensive guards for new `G` fields.

**Directories:** `**/*.test.ts`, `packages/game-engine/src/test/`

---

### `infra` — Data Pipeline / Infra

**What it is:** Conversion scripts, upload scripts, CI validators, git
hooks, PAR simulation tooling, commit hygiene enforcement. Never shipped
to players.

**May:** Perform IO. Use performance shortcuts. Run as one-off CLI tools.
Access R2/rclone.

**Must not:** Be imported by runtime code. Depend on engine internals.
Affect gameplay behavior.

**Failure mode:** Broken builds, corrupted uploads, missed validations.

**Directories:** `scripts/`, `.githooks/`, `.github/workflows/`,
`data/par/` (PAR artifacts)

---

### `docs` — Documentation / Governance

**What it is:** Work packets, execution checklists, pre-flight documents,
architecture docs, decisions log, data sources inventory, reference docs.

**May:** State normative truth. Define constraints and rationale. Record
decisions.

**Must not:** Contain suggestions disguised as rules. Drift from code
reality. Introduce requirements that conflict with ARCHITECTURE.md.

**Failure mode:** Governance drift. Stale documentation causing wrong
implementation decisions.

**Directories:** `docs/`, `.claude/`, `docs/ai/`

---

## How Categories Connect to Other Governance

| Governance artifact | How it uses categories |
|---|---|
| **Pre-flight (01.4)** | "Do all new/modified files belong to exactly one category and follow its constraints?" |
| **Execution Checklists** | EC allowlists map to categories — files outside the WP's categories are forbidden |
| **Pre-commit review** | Boundary integrity axis checks that no file blurs category boundaries |
| **ARCHITECTURE.md** | Authoritative source for layer boundaries that categories enforce |
| **`.claude/rules/*.md`** | Per-category enforcement rules loaded automatically by Claude Code |

---

## Rules

1. Every file belongs to exactly one category.
2. A file's category is determined by its directory, not by comments.
3. If a file needs to do something its category forbids, it belongs in a
   different category (move it or split it).
4. Categories are structural. If you can't tell which category a file
   belongs to from its path, the directory structure needs fixing.
5. Do not create new categories without a DECISIONS.md entry.
