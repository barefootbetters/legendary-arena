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

### D-1210 — Player Starting Decks Use ext_id Strings in G, Not Full Card Objects
**Decision:** Player starting decks in `G.playerZones[id].deck` store `CardExtId`
strings (e.g., `'starting-shield-agent'`, `'starting-shield-trooper'`) — not full
card objects with names, costs, abilities, or image URLs.
**Rationale:** G must be JSON-serializable, minimal, and deterministic. Storing full
card objects would bloat the game state, create redundant data that could drift from
the registry, and violate the architectural invariant that zones contain CardExtId
strings only. Card display data is resolved by the UI via the registry separately.
This also enables replay reproducibility — the same ext_id strings always refer to
the same cards regardless of registry version changes.
**Introduced:** WP-005B
**Status:** Immutable

---

### D-1211 — makeMockCtx Reverses Arrays Instead of Identity Shuffle
**Decision:** `makeMockCtx().random.Shuffle` reverses arrays rather than returning
them unchanged (identity).
**Rationale:** An identity shuffle would not prove that `shuffleDeck` actually called
`context.random.Shuffle`. A test could pass even if the shuffle step was accidentally
skipped or short-circuited. Reversing produces a predictable, deterministic
reordering that confirms the shuffle path executed. This makes mock tests meaningful
rather than vacuous.
**Introduced:** WP-005B
**Status:** Immutable

---

### D-1212 — Global Piles Use G.piles Container, Not Flat Top-Level Keys
**Decision:** Global piles (bystanders, wounds, officers, sidekicks) are stored
under `G.piles` as a `GlobalPiles` object, not as flat top-level keys on G.
**Rationale:** ARCHITECTURE.md §Zone & Pile Structure and the game-engine rules
Key G Fields table both specify `G.piles` as the container. WP-005B's scope
section listed them as flat keys, but per the authority hierarchy
(ARCHITECTURE.md > individual Work Packets), the nested structure is correct.
**Introduced:** WP-005B
**Status:** Immutable

---

### D-1213 — Game.setup() Uses Module-Level Registry Holder Pattern
**Decision:** `game.ts` exposes `setRegistryForSetup(registry)` to configure the
registry used by `Game.setup()`. When set, setup validates the config against the
registry before building state. When not set (e.g., in unit tests), validation is
skipped and an empty registry is passed to `buildInitialGameState`.
**Rationale:** boardgame.io's `setup()` function signature does not include a
registry parameter — it only receives `(context, setupData)`. The server must
configure the registry at startup before any matches are created. This pattern
avoids modifying the boardgame.io Game type while keeping validation in the
engine layer where it belongs.
**Introduced:** WP-005B
**Status:** Active — may be superseded by a factory pattern in a future WP

---

## Zone Contract Decisions

### D-1214 — Zones Store ext_id Strings, Not Full Card Objects
**Decision:** All zone and pile types (`Zone = CardExtId[]`) store `ext_id`
strings exclusively. No zone type may contain full card objects, display data,
images, or database IDs.
**Rationale:** G must remain JSON-serializable and small. Card display data
(images, text, costs) is resolved by the UI via the card registry at render
time. Storing full card objects would bloat G, break serialization guarantees,
create redundant data that could drift from the registry, and violate the
architectural invariant that zones contain CardExtId strings only. This also
enables replay reproducibility — the same ext_id strings always refer to the
same cards regardless of registry version changes. See also D-1210.
**Introduced:** WP-006A
**Status:** Immutable

---

### D-1215 — ZoneValidationError Uses { field, message }, Not MoveError
**Decision:** `ZoneValidationError` uses `{ field: string; message: string }` as
its error shape. It does not reference or extend `MoveError` (which uses
`{ code, message, path }` and is defined in WP-008A).
**Rationale:** Zone validation and move validation serve different purposes.
Zone validation identifies which structural field is malformed and describes the
problem (field + message). Move validation identifies which game rule was
violated (code + message + path). Reusing `MoveError` for zone shape errors
would couple the zone contract to the move contract and add unused fields
(`code`, `path`). This parallels D-1208 (MatchSetupError). Each validation
domain gets its own error shape sized to its needs.
**Introduced:** WP-006A
**Status:** Immutable

---

### D-1216 — LegendaryGameState Consolidated with Canonical Zone Types Post-WP-005B
**Decision:** After WP-005B defined `PlayerZones`, `GlobalPiles`, and `CardExtId`
inline in `types.ts`, WP-006A moved these definitions to
`src/state/zones.types.ts` as the canonical source. `types.ts` now re-exports
them for backward compatibility. `LegendaryGameState` uses the canonical types
from `zones.types.ts` — no duplicate zone type definitions exist.
**Rationale:** WP-005B needed the types to implement setup, but defining them
inline created duplication risk. WP-006A consolidates them into a single
canonical location (`zones.types.ts`) that all future WPs import from. The
re-export in `types.ts` ensures existing imports from WP-005B code continue
to work without modification.
**Introduced:** WP-006A
**Status:** Immutable

---

## Setup Initialization Decisions

### D-1217 — buildPlayerState and buildGlobalPiles Extracted from buildInitialGameState
**Decision:** Player zone construction (`buildPlayerState`) and global pile
construction (`buildGlobalPiles`) are extracted into dedicated helper files
(`playerInit.ts`, `pilesInit.ts`) rather than remaining inline in
`buildInitialGameState`.
**Rationale:** `buildInitialGameState` exceeded the 30-line function limit
(code-style Rule 5) and mixed per-player, per-pile, and orchestration
concerns in a single function. Extracting helpers improves testability — each
helper has its own shape tests — and makes the orchestration function readable
at a glance. The extracted helpers are internal only (not exported from
`index.ts`) to avoid expanding the public API surface.
**Introduced:** WP-006B
**Status:** Immutable

---

### D-1218 — Global Piles Use Token ext_ids Rather Than Registry ext_ids
**Decision:** Global pile cards (bystanders, wounds, officers, sidekicks) use
well-known token ext_ids (`pile-bystander`, `pile-wound`, `pile-shield-officer`,
`pile-sidekick`) rather than ext_ids resolved from the card registry.
**Rationale:** These are generic game components — each pile contains identical
copies of a single token type. They exist in every Legendary game and are not
set-specific cards. Using registry ext_ids would require the registry at setup
time for components that have no meaningful card data to look up. The `pile-`
prefix convention distinguishes game tokens from set-specific cards. Starting
cards (`starting-shield-agent`, `starting-shield-trooper`) follow the same
pattern with a `starting-` prefix.
**Introduced:** WP-005B, formalized WP-006B
**Status:** Immutable

---

## Turn Structure Decisions

### D-1219 — TurnStage Is Defined Separately from boardgame.io's Stage Concept
**Decision:** `TurnStage` (`'start' | 'main' | 'cleanup'`) is a Legendary Arena
engine concept defined in `turnPhases.types.ts`. It is not the same as
boardgame.io's built-in stage system (`ctx.activePlayers`, `setStage`, etc.).
**Rationale:** boardgame.io's stage system is designed for simultaneous player
actions and does not expose inner stage to move functions via `ctx`. Legendary
Arena needs a per-turn phase cycle (start -> main -> cleanup) that moves can
read from `G.currentStage` to enforce stage gating. Storing this in `G` ensures
it is JSON-serializable, deterministically observable, and available to all move
functions without framework coupling. The turn stage cycle is defined once in
`turnPhases.logic.ts` — no other file may re-encode stage ordering.
**Introduced:** WP-007A
**Status:** Immutable

---

### D-1220 — getNextTurnStage Returns null After Cleanup Instead of Cycling
**Decision:** `getNextTurnStage('cleanup')` returns `null` rather than cycling
back to `'start'`.
**Rationale:** Returning `null` explicitly signals that the turn should end.
The caller (WP-007B's turn loop) interprets `null` as the trigger to call
`ctx.events.endTurn()`. Cycling back to `'start'` would conflate two distinct
events — turn restart and stage advancement — into a single function. Turn
restart is managed by the play phase `onBegin` hook which resets
`G.currentStage = 'start'` on each new turn. Keeping these concerns separate
prevents accidental infinite loops and makes the turn boundary explicitly
observable.
**Introduced:** WP-007A
**Status:** Immutable

### D-1221 — G.currentStage Stored in G, Not ctx
**Decision:** The per-turn stage (`'start' | 'main' | 'cleanup'`) is stored in
`G.currentStage`, not in boardgame.io's `ctx` object.
**Rationale:** boardgame.io's `ctx` does not expose an inner turn stage concept
in a form that move functions can read. Storing `currentStage` in `G` makes it:
(1) observable to move functions for stage gating (e.g., `playCard` only in
`main`), (2) JSON-serializable for replay and snapshot support, and
(3) resettable on each new turn via the play phase `onBegin` hook.
boardgame.io's built-in stage system (`ctx.activePlayers`, `setStage`) is
designed for simultaneous player actions and does not serve the same purpose.
See also D-1219.
**Introduced:** WP-007B
**Status:** Immutable

---

### D-1222 — Integration Tests Call Functions Directly, Not boardgame.io/testing
**Decision:** Turn loop integration tests call `advanceTurnStage` directly with
a minimal mock context, rather than using `boardgame.io/testing` or running a
live boardgame.io server.
**Rationale:** `turnLoop.ts` is a pure helper with no boardgame.io imports.
Testing it through boardgame.io/testing would add framework coupling to code
that is intentionally framework-independent. Direct function calls with a mock
context provide faster, more focused tests that verify the exact contract
(`getNextTurnStage` ordering, `endTurn` invocation, JSON serializability)
without framework overhead. This also follows the convention established in
WP-005B where `makeMockCtx` was introduced for framework-free testing.
**Introduced:** WP-007B
**Status:** Immutable

---

## Move Contract Decisions

### D-1223 — MOVE_ALLOWED_STAGES Stage Assignments for Core Moves
**Decision:** The three core moves have the following stage gating assignments:
- `drawCards`: allowed in `['start', 'main']`
- `playCard`: allowed in `['main']`
- `endTurn`: allowed in `['cleanup']`

**Rationale:**
- `drawCards` is allowed in `start` because the player draws cards at the
  beginning of their turn (start phase), and in `main` because card effects
  during the main action phase may grant additional draws.
- `playCard` is restricted to `main` because playing cards is the primary
  action during a player's turn. Cards cannot be played during the draw phase
  (start) or after actions are complete (cleanup).
- `endTurn` is restricted to `cleanup` because a player must complete all
  actions and resolve all effects before ending their turn. Allowing endTurn
  earlier would skip mandatory cleanup steps (discard hand, draw new hand).

**Introduced:** WP-008A
**Status:** Immutable

---

### D-1224 — MoveResult/MoveError Is the Engine-Wide Result Contract
**Decision:** `MoveResult` (`{ ok: true } | { ok: false; errors: MoveError[] }`)
and `MoveError` (`{ code: string; message: string; path: string }`) are the
engine-wide result contract. Every move validator in every future packet must
import and return these types. No future packet may define a parallel error type
for move validation.
**Rationale:** A single, consistent error shape across all validation boundaries
enables uniform error handling, logging, and UI error display. The only exception
is `ZoneValidationError` (D-1215) and `MatchSetupError` (D-1208), which serve
distinct structural and setup validation purposes respectively and predate this
contract.
**Introduced:** WP-008A
**Status:** Immutable

---

## Zone Operation Decisions

### D-1225 — zoneOps.ts Helpers Return New Arrays Rather Than Mutating G Directly
**Decision:** `moveCardFromZone` and `moveAllCards` in `zoneOps.ts` return new
arrays (`{ from, to }`) rather than mutating the zone arrays in `G` directly.
The calling move function assigns the returned arrays back to zone properties
on the Immer draft of `G`.
**Rationale:** Returning new arrays keeps the helpers pure, independently testable,
and free of boardgame.io dependencies. Pure helpers can be tested without an Immer
draft, making tests simpler and faster. The move function is responsible for
assigning returned arrays to `G` properties — Immer tracks the property assignment
automatically. This separation also keeps each move function under 30 lines
(code-style Rule 5) by extracting zone mutation logic into reusable helpers.
**Introduced:** WP-008B
**Status:** Immutable

---

### D-1226 — Moves Return void on Validation Failure Rather Than Throwing
**Decision:** When a move's args validation or stage gate check fails, the move
function returns `void` immediately without mutating `G`. Moves never throw
exceptions.
**Rationale:** boardgame.io 0.50.x uses Immer — moves mutate a draft of `G` and
return `void`. Throwing inside a move function would crash the boardgame.io server
process rather than gracefully rejecting the invalid action. Returning `void` on
invalid input leaves `G` unchanged, which boardgame.io interprets as a no-op. This
is consistent with the engine-wide convention that only `Game.setup()` may throw
(D-0102 clarification). Invalid move attempts are expected during normal gameplay
(e.g., a client submitting a move in the wrong stage) and are not invariant
violations.
**Introduced:** WP-008B
**Status:** Immutable

---

## Registry Build Fix Decisions

### D-1227 — FlatCard Hero-Only Optional Fields Include Explicit undefined
**Decision:** All hero-only optional fields on `FlatCard` in `types/index.ts`
(`heroName`, `team`, `hc`, `rarity`, `rarityLabel`, `slot`, `cost`, `attack`,
`recruit`) are typed as `T | undefined` rather than plain `T` with `?:`.
**Rationale:** The tsconfig enables `exactOptionalPropertyTypes: true`, which
distinguishes between "property absent" (`prop?: T`) and "property present but
undefined" (`prop?: T | undefined`). `HeroCardSchema` marks these fields as
`z.string().optional()`, so the Zod-inferred types produce `T | undefined`.
Assigning schema-inferred values to `FlatCard` optional properties without the
explicit `| undefined` causes TS2379 errors under this strict flag. Adding
`| undefined` is semantically correct — these fields genuinely can be undefined
when card data is incomplete (e.g., anni set). This does not weaken the type
contract for non-hero card types (which never set these fields at all).
**Introduced:** INFRA fix (registry build repair)
**Status:** Immutable

---

### D-1228 — shared.ts Hero Card Defaults for name and abilities
**Decision:** `flattenSet()` in `shared.ts` provides defaults for two
optional `HeroCardSchema` fields: `card.name ?? card.slug` and
`card.abilities ?? []`.
**Rationale:** `HeroCardSchema.name` and `HeroCardSchema.abilities` are
optional because some sets (e.g., anni) produce cards with incomplete data.
`FlatCard.name` and `FlatCard.abilities` are required fields. Under
`exactOptionalPropertyTypes`, assigning `string | undefined` to `string`
is a type error. Defaulting to `card.slug` for name (always present) and
`[]` for abilities is safe — slug is a meaningful fallback, and an empty
abilities array correctly represents "no printed abilities."
**Introduced:** INFRA fix (registry build repair)
**Status:** Immutable

---

## Data Contracts & Documentation Decisions

### D-1301 — Legacy 00.2 Sections 7/9/10/11/12 Excluded from Governed Document
**Decision:** The governed `docs/ai/REFERENCE/00.2-data-requirements.md` excludes
legacy sections §7 (User Deck Data), §9 (Search/Filter), §10 (User Preferences),
§11 (App Configuration/Feature Flags), and §12 (Export/Interoperability).
**Rationale:** These sections describe UI-layer concerns (localStorage, feature
flags, search/filter logic, user preferences). Per the Layer Boundary
(ARCHITECTURE.md), the data contracts reference documents registry-layer data
shapes only. UI implementation details belong in future UI-layer Work Packets,
not in a data contracts reference subordinate to `schema.ts`.
**Introduced:** WP-043
**Status:** Immutable

---

### D-1302 — 00.2 Is a Human-Readable Reference Subordinate to schema.ts
**Decision:** `docs/ai/REFERENCE/00.2-data-requirements.md` is a human-readable
data contracts reference, not a replacement for `packages/registry/src/schema.ts`.
If the two documents conflict on field types, shapes, or constraints, `schema.ts`
wins unconditionally.
**Rationale:** `schema.ts` is machine-enforced via Zod and validated against real
data at runtime. A markdown reference document cannot enforce constraints. Keeping
the reference document subordinate prevents drift where human-readable docs
contradict the actual validation layer.
**Introduced:** WP-043
**Status:** Immutable

---

## Governance & Coordination Decisions

### D-1401 — Prompt Lint Checklist Remains a REFERENCE Document, Not Merged into .claude/rules/
**Decision:** `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` remains a
standalone REFERENCE document (reusable pre-execution quality gate). It is not
merged into `.claude/rules/` or replaced by a rules file.
**Rationale:** The checklist and `.claude/rules/*.md` serve different purposes
at different times. The checklist gates Work Packet quality **before**
execution — it validates that a packet is well-formed, scoped, and complete
before Claude Code runs it. The `.claude/rules/*.md` files enforce constraints
**during** execution — they are loaded automatically by Claude Code and govern
real-time behavior. Merging them would conflate pre-execution review (human
responsibility) with runtime enforcement (tool responsibility). The checklist
is subordinate to `ARCHITECTURE.md` and `.claude/rules/*.md` — if it conflicts
with either, the checklist must be updated to match.
**Introduced:** WP-044
**Status:** Immutable

---

### D-1402 — Connection Health Check Remains a REFERENCE Document; Health Check vs Lint Gate Distinction
**Decision:** `docs/ai/REFERENCE/00.4-connection-health-check.md` remains a
standalone REFERENCE document (reusable Foundation Prompt prerequisite gate).
It is not merged into `.claude/rules/` or replaced by a rules file. The health
check and the Prompt Lint Checklist (`00.3`) are distinct gates that serve
different purposes at different times:
- **Health check (00.4):** Foundation Prompt prerequisite — runs **once** before
  any Work Packet execution begins. Produces developer tooling scripts.
- **Lint Gate (00.3):** Per-WP quality gate — runs **before each** Work Packet
  execution. Validates packet structure and constraints.
The two gates must not be confused. The health check is not a per-WP gate; the
Lint Gate is not a Foundation Prompt prerequisite.
**Rationale:** The health check verifies that external infrastructure (database,
R2, rclone, tooling) is reachable and correctly configured. It runs once at
the start of the Foundation Prompt sequence (`00.4 -> 00.5 -> 01 -> 02`) and
blocks all subsequent prompts and Work Packets on failure. The Lint Gate
validates individual Work Packet quality before each session. Merging the
health check into `.claude/rules/` would conflate infrastructure verification
(one-time prerequisite) with runtime enforcement (loaded every session). The
distinction parallels D-1401 (prompt lint checklist remains REFERENCE).
**Introduced:** WP-045
**Status:** Immutable

---

### D-1403 — R2 Validation Gate Remains a REFERENCE Document; R2 Validation vs Lint Gate Distinction
**Decision:** `docs/ai/REFERENCE/00.5-validation.md` remains a standalone
REFERENCE document (reusable Foundation Prompt prerequisite gate). It is not
merged into `.claude/rules/` or replaced by a rules file. The R2 validation
gate and the Prompt Lint Checklist (`00.3`) are distinct gates that serve
different purposes at different times:
- **R2 validation (00.5):** Foundation Prompt prerequisite — runs **once** after
  00.4 (connection health) and before Foundation Prompts 01 and 02. Validates
  R2 card data, metadata, images, and cross-set slugs. Error-level failures
  block all subsequent Foundation Prompts and Work Packets depending on R2
  data. Warnings alone do not block execution.
- **Lint Gate (00.3):** Per-WP quality gate — runs **before each** Work Packet
  execution. Validates packet structure and constraints.
The two gates must not be confused. The R2 validation is not a per-WP gate; the
Lint Gate is not a Foundation Prompt prerequisite.
**Additional distinctions:**
- R2 validation (00.5) is a reusable preflight script producing
  `scripts/validate-r2.mjs`. For operational deployment checklists (uploading
  sets, re-seeding), see WP-042.
- R2 data validation is a registry/data-layer concern per the Layer Boundary
  (`.claude/rules/architecture.md`). Validation script changes are informed by
  `.claude/rules/registry.md` for data shape conventions.
- Position in Foundation Prompts sequence: `00.4 -> 00.5 -> 01 -> 02`. Each
  step depends on the prior step completing successfully.
**Rationale:** The R2 validation gate verifies that card data in Cloudflare R2
is structurally correct, images are reachable, and no cross-set slug collisions
exist. It runs once in the Foundation Prompt sequence and blocks downstream
prompts and Work Packets on error-level failure. Merging it into
`.claude/rules/` would conflate data validation (one-time prerequisite) with
runtime enforcement (loaded every session). The distinction parallels D-1401
(prompt lint checklist remains REFERENCE) and D-1402 (connection health check
remains REFERENCE).
**Introduced:** WP-046
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