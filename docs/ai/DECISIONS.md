# DECISIONS.md — Legendary Arena

## Purpose
This document records the **permanent, intentional decisions** made in designing,
building, launching, and growing Legendary Arena.

These decisions define:
- architectural constraints
- authority boundaries
- determinism guarantees
- growth governance rules

All future work **must conform** to the decisions recorded here.
Deviations require an explicit new decision entry.

---

## Guiding Meta‑Principles

### D‑0001 — Correctness Over Convenience
**Decision:** The system prioritizes correctness, determinism, and trust over ease of implementation.  
**Rationale:** Bugs that silently corrupt state destroy confidence and replay integrity.  
**Introduced:** WP‑027  
**Status:** Immutable

---

### D‑0002 — Determinism Is Non‑Negotiable
**Decision:** All gameplay must be fully deterministic and replayable.  
**Rationale:** Enables debugging, fairness, multiplayer trust, and long‑term maintenance.  
**Introduced:** WP‑027  
**Status:** Immutable

---

### D‑0003 — Data Outlives Code
**Decision:** Persisted data (replays, saves, campaigns) must always be versioned and migrated explicitly.  
**Rationale:** Code will change; player history must remain trustworthy.  
**Introduced:** WP‑034  
**Status:** Immutable

---

## Engine & Core Architecture Decisions

### D‑0101 — Engine Is the Sole Authority
**Decision:** The game engine is the only authority over game state and outcomes.  
**Rationale:** Prevents client‑side cheating, desyncs, and inconsistent behavior.  
**Introduced:** WP‑031 / WP‑032  
**Status:** Immutable

---

### D‑0102 — Fail Fast on Invariant Violations
**Decision:** Invariant violations cause immediate failure; no silent recovery is allowed.  
**Rationale:** Silent corruption is worse than visible failure.  
**Introduced:** WP‑031  
**Status:** Immutable

**Clarification (WP‑010–WP‑023):** This decision applies to **structural
invariants** — violations of serialization rules, zone shape contracts,
persistence boundaries, or layer boundaries. It does NOT apply to **unmet
gameplay conditions** such as insufficient attack points, empty piles, or
missing targets. Unmet gameplay conditions are expected during normal play
and are handled by returning void (moves) or producing no effect (helpers).
The distinction: an invariant violation means the system is in an invalid
state; an unmet gameplay condition means the game is in a valid state where
the requested action is not possible.

---

### D‑0104 — Counters Are Numeric Flags
**Decision:** All gameplay conditions in `G.counters` use numeric counters;
boolean fields are forbidden for game logic.  
**Rationale:** Numeric counters support accumulation (escaped villains count),
prioritized evaluation (loss before victory), replay determinism, and future
extensibility (scheme-specific thresholds) — none of which booleans support.  
**Scope:** A counter value >= 1 is truthy. Endgame evaluation reads counters
only via `evaluateEndgame(G)` using `ENDGAME_CONDITIONS` constants.  
**Introduced:** WP‑010  
**Reinforced:** WP‑015 (escape counter), WP‑019 (mastermind defeated counter),
WP‑024 (scheme-loss counter)  
**Status:** Immutable

---

### D‑0103 — No Engine Knowledge of UI or Network
**Decision:** The engine contains no UI, networking, analytics, or persistence logic.  
**Rationale:** Keeps the core deterministic, testable, and reusable.  
**Introduced:** WP‑028 / WP‑032  
**Status:** Immutable

---

## Replay & Determinism Decisions

### D‑0201 — Replay as a First‑Class Feature
**Decision:** Every game must be replayable from seed + setup + ordered intents.  
**Rationale:** Required for QA, debugging, balance, spectating, and ops.  
**Introduced:** WP‑027  
**Status:** Immutable

---

### D‑0202 — Deterministic State Hashing
**Decision:** Game state is hashed canonically for equality and desync detection.  
**Rationale:** Enables multiplayer correctness and replay verification.  
**Introduced:** WP‑027  
**Status:** Immutable

---

## UI & Presentation Decisions

### D‑0301 — UI Consumes Projections Only
**Decision:** The UI never reads or mutates engine state directly.  
**Rationale:** Prevents logic leakage and security flaws.  
**Introduced:** WP‑028  
**Status:** Immutable

---

### D‑0302 — Single UIState, Multiple Audiences
**Decision:** One authoritative UIState is filtered per audience (player, spectator).  
**Rationale:** Avoids duplicated logic and inconsistent views.  
**Introduced:** WP‑029  
**Status:** Immutable

---

## Network & Multiplayer Decisions

### D‑0401 — Clients Submit Intents, Not Outcomes
**Decision:** Clients submit turn intents; the engine validates and executes.  
**Rationale:** Ensures authority and prevents manipulation.  
**Introduced:** WP‑032  
**Status:** Immutable

---

### D‑0402 — Engine‑Authoritative Resync
**Decision:** On desync, the engine state always overrides the client.  
**Rationale:** Guarantees consistency and fairness.  
**Introduced:** WP‑032  
**Status:** Immutable

---

## Campaign & Scenario Decisions

### D‑0501 — Campaigns Are Meta‑Orchestration Only
**Decision:** Campaigns orchestrate games but never alter engine rules.  
**Rationale:** Preserves replay safety and engine simplicity.  
**Introduced:** WP‑030  
**Status:** Immutable

---

### D‑0502 — Campaign State Lives Outside the Engine
**Decision:** Campaign progression is external, versioned data.  
**Rationale:** Keeps individual games pure and replayable.  
**Introduced:** WP‑030  
**Status:** Immutable

---

## Content System Decisions

### D‑0601 — Content Is Data, Not Code
**Decision:** All gameplay content is declarative and schema‑validated.  
**Rationale:** Enables safe scaling and collaboration.  
**Introduced:** WP‑033  
**Status:** Immutable

---

### D‑0602 — Invalid Content Cannot Reach Runtime
**Decision:** Content must validate before engine load; no runtime forgiveness.  
**Rationale:** Prevents undefined behavior and late failures.  
**Introduced:** WP‑033  
**Status:** Immutable

---

### D‑0603 — Representation Before Execution
**Decision:** All gameplay systems must first be represented as declarative,
data-only contracts before execution logic is introduced. Representation
layers (types, hooks, taxonomies) are established as inert data structures;
execution layers are added on top without refactoring the underlying state.  
**Rationale:** Enables deterministic execution, static analysis, tooling,
validation, safe iteration, and future extensibility without refactoring
runtime state contracts.  
**Scope:** Applies to all gameplay mechanics including:
- Hero abilities (WP‑021 representation → WP‑022/023 execution)
- Scheme and mastermind abilities (WP‑009A hooks → WP‑024 execution)
- Future mechanics (keywords, modifiers, triggers) must follow this pattern  
**Introduced:** WP‑021  
**Reinforced:** WP‑022, WP‑023, WP‑024  
**Status:** Immutable

---

## AI & Balance Decisions

### D‑0701 — AI Is Tooling, Not Gameplay
**Decision:** AI exists only for testing and balance analysis, never as game logic.  
**Rationale:** Prevents hidden logic paths and unfair play.  
**Introduced:** WP‑036  
**Status:** Immutable

---

### D‑0702 — Balance Changes Require Simulation
**Decision:** No balance change ships without AI simulation validation.  
**Rationale:** Human intuition alone is insufficient at scale.  
**Introduced:** WP‑036  
**Status:** Immutable

---

## Versioning & Migration Decisions

### D‑0801 — Explicit Version Axes
**Decision:** Engine, data, and content versions are independent and explicit.  
**Rationale:** Enables safe evolution and compatibility checks.  
**Introduced:** WP‑034  
**Status:** Immutable

---

### D‑0802 — Incompatible Data Fails Loudly
**Decision:** If versions are incompatible and unmigratable, loading fails.  
**Rationale:** Prevents silent misinterpretation of history.  
**Introduced:** WP‑034  
**Status:** Immutable

---

## Live Operations Decisions

### D‑0901 — Deterministic Metrics Only
**Decision:** Live metrics must derive from replays and final state only.  
**Rationale:** Preserves trust and reproducibility.  
**Introduced:** WP‑039  
**Status:** Immutable

---

### D‑0902 — Rollback Is Always Possible
**Decision:** Every release must have a tested rollback path.  
**Rationale:** Recovery beats post‑hoc repair.  
**Introduced:** WP‑035 / WP‑039  
**Status:** Immutable

---

## Growth & Governance Decisions

### D‑1001 — Growth Requires Explicit Change Budgets
**Decision:** Every release declares allowed change scope by category.  
**Rationale:** Prevents entropy during success.  
**Introduced:** WP‑040  
**Status:** Immutable

---

### D‑1002 — Immutable Surfaces Are Protected
**Decision:** Replay semantics, rules, RNG behavior, and scoring cannot change without a major version.  
**Rationale:** These define player trust.  
**Introduced:** WP‑040  
**Status:** Immutable

---

### D‑1003 — Content and UI Are Primary Growth Vectors
**Decision:** Growth prioritizes content, onboarding, and UI—not engine or rules.  
**Rationale:** Safest way to scale while preserving guarantees.  
**Introduced:** WP‑040  
**Status:** Active Policy

---

## Onboarding Decisions

### D‑1101 — Onboarding Uses Real Rules
**Decision:** Tutorials run on the real engine with real validation.  
**Rationale:** Prevents teaching fake behavior.  
**Introduced:** WP‑042  
**Status:** Immutable

---

### D‑1102 — Onboarding Is UI‑Only
**Decision:** No onboarding logic exists inside the engine.  
**Rationale:** Preserves determinism and replay integrity.  
**Introduced:** WP‑042  
**Status:** Immutable

---

## Infrastructure & Schema Decisions

### D-1201 — game_sessions Uses ext_id Text References, Not bigint FKs
**Decision:** The `game_sessions` table references cards (mastermind, scheme)
via `text` columns (`mastermind_ext_id`, `scheme_ext_id`) that match
`legendary.cards.ext_id`, rather than `bigint` foreign keys to
`legendary.masterminds` or `legendary.schemes`.
**Rationale:** ext_id values are stable across re-seeds and schema changes.
Using bigint FKs would couple game_sessions to the card seeding order and
make re-seeding (which drops and re-creates rows with new IDs) break existing
match records. Per 00.2 §4.4: use ext_id for cross-service card references.
**Introduced:** FP-02
**Status:** Immutable

### D-1202 — MatchConfiguration Uses ext_id String References, Not Numeric IDs
**Decision:** All card references in `MatchConfiguration` (schemeId, mastermindId,
villainGroupIds, henchmanGroupIds, heroDeckIds) use `ext_id` text strings from
the card registry, not numeric database IDs.
**Rationale:** Extends D-1201 to the game engine layer. ext_id values are stable
across database re-seeds. Using numeric IDs would couple match configurations to
seeding order and break saved configurations or replays when the database is
re-seeded. Per 00.2 §4.4 and §8.1, ext_id is the canonical cross-service card
reference format.
**Introduced:** WP-002
**Status:** Immutable

---

## Registry & Card Data Decisions

### D-1203 — sets.json and card-types.json Are Incompatible Shapes
**Decision:** `sets.json` is the set index (`{ id, abbr, pkgId, slug, name,
releaseDate, type }`) and must be used by all loaders to enumerate sets.
`card-types.json` is the card type taxonomy (`{ id, slug, name, displayName,
prefix }`) and must never be used where a set index is expected.
**Rationale:** The two files have completely different shapes. Fetching
`card-types.json` where `sets.json` is expected causes a silent failure:
entries lack `abbr` and `releaseDate`, so every entry fails
`SetIndexEntrySchema` validation silently, producing zero sets with no error.
This was the confirmed Defect 1 in `httpRegistry.ts` fixed by WP-003.
**Introduced:** WP-003
**Status:** Immutable

---

### D-1204 — FlatCard.cost Must Be string | number | undefined
**Decision:** `FlatCard.cost` is typed as `string | number | undefined`, matching
`HeroCardSchema.cost` which accepts both integers and star-cost strings.
**Rationale:** Real card data includes star-cost strings like `"2*"` (amwp Wasp)
and `"3*"`. The previous type `number | undefined` rejected valid card data
silently. The schema (`z.union([z.number().int().min(0), z.string()]).optional()`)
already accepted strings — the TypeScript interface must match. Narrowing this
type back to `number | undefined` is forbidden.
**Introduced:** WP-003
**Status:** Immutable

### D-1205 — Server Uses createRegistryFromLocalFiles at Startup
**Decision:** The server loads card data at startup via
`createRegistryFromLocalFiles({ metadataDir: 'data/metadata', cardsDir: 'data/cards' })`
from `@legendary-arena/registry`, not via the HTTP/R2 loader
(`createRegistryFromHttp`).
**Rationale:** The server has direct filesystem access to the `data/` directory.
Using the HTTP/R2 loader would add an unnecessary network round-trip to
Cloudflare R2 and introduce a dependency on external infrastructure at startup.
The HTTP/R2 loader is designed for browser clients that cannot read the local
filesystem. Both loaders produce an identical immutable `CardRegistry` — only
the data source differs.
**Introduced:** WP-004
**Status:** Immutable

---

### D-1206 — boardgame.io Server Import Uses createRequire Bridge
**Decision:** `apps/server/src/server.mjs` uses `createRequire(import.meta.url)`
from `node:module` to import `boardgame.io/server` instead of a standard ESM
import.
**Rationale:** boardgame.io v0.50 only ships a CJS server bundle
(`dist/cjs/server.js`) with no ESM entrypoint. Node v22+ ESM does not resolve
CJS-only subpackage directory imports. The `createRequire` bridge is the
standard Node.js mechanism for consuming CJS packages from ESM without adding
a bundler. This decision is scoped to the `boardgame.io/server` import only —
all other imports use standard ESM.
**Introduced:** WP-004
**Status:** Active (revisit if boardgame.io adds ESM server exports)

---

## Match Setup Contract Decisions

### D-1207 — MatchSetupConfig Is Canonical, MatchConfiguration Is an Alias
**Decision:** `MatchSetupConfig` (defined in `matchSetup.types.ts`) is the
canonical 9-field match setup type. The original `MatchConfiguration` (from
WP-002) is now a type alias for `MatchSetupConfig` in `types.ts`.
**Rationale:** Both types had identical fields. `MatchSetupConfig` has full
validation support via `validateMatchSetup` and is the contract that all future
setup and gameplay packets depend on. Retaining `MatchConfiguration` as an alias
preserves backward compatibility with `game.ts` and existing tests without
maintaining two identical type definitions.
**Introduced:** WP-005A
**Status:** Immutable

---

### D-1208 — MatchSetupError Uses { field, message }, Not MoveError
**Decision:** `MatchSetupError` uses `{ field: string; message: string }` as its
error shape. It does not reference or extend `MoveError` (which uses
`{ code, message, path }` and is defined in WP-008A).
**Rationale:** Setup validation and move validation serve different purposes.
Setup validation identifies which configuration field failed and why (field +
message). Move validation identifies which game rule was violated (code +
message + path). Reusing `MoveError` for setup would couple the setup contract
to the move contract and add unused fields (`code`, `path`). Each domain gets
its own error shape sized to its needs.
**Introduced:** WP-005A
**Status:** Immutable

---

### D-1209 — CardRegistryReader Interface Preserves Layer Boundary
**Decision:** `matchSetup.validate.ts` defines a minimal `CardRegistryReader`
interface (`{ listCards(): Array<{ key: string }> }`) instead of importing
`CardRegistry` from `@legendary-arena/registry`.
**Rationale:** The architecture layer boundary forbids game-engine from importing
registry. The real `CardRegistry` satisfies `CardRegistryReader` via TypeScript
structural typing, so the server can pass one in at setup time without creating
a compile-time dependency. This preserves the unidirectional dependency direction
(Registry -> Game Engine -> Server) defined in ARCHITECTURE.md.
**Introduced:** WP-005A
**Status:** Immutable

---

## Change Management

### How to Add a New Decision
1. Assign a new decision ID
2. State the decision clearly
3. Document the rationale
4. Reference affected work packets
5. Declare immutability or scope

Unrecorded decisions are not valid.

---

## Final Note
Legendary Arena’s strength is not just its code.
It is the **discipline encoded in these decisions**.

Protect this file.
``