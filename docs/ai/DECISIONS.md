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
This document is authoritative over all Work Packets.
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

### D‑0004 — No Post‑Shuffle Seed Filtering or Fairness Gating
**Decision:** Legendary Arena does not inspect, score, or reject initial
seeds for perceived playability. Once `Game.setup()` has established a seed
and the villain deck is shuffled, that seed is the match. There is no
pre‑game "fairness" layer that re‑rolls shuffles, rejects opening sequences,
or filters hypergeometrically improbable draws.

**Scope:**
- Applies to villain deck order, hero deck order, HQ fill, and any other
  `ctx.random.*`‑driven setup output.
- Applies whether the gating is expressed as "hard reject," "soft reroll,"
  "retry on failure," or "opening difficulty clamp."
- Does **not** apply to deterministic deck *composition* (which cards are
  included) — composition is governed by scheme/mastermind rules and
  `MatchSetupConfig` and is not random.
- Does **not** prohibit *observational* tooling (e.g., a PAR/difficulty
  estimator that scores a seed after the fact for telemetry). Scoring is
  allowed; rewriting outcomes is not.

**Rationale:**
1. **Determinism integrity (reinforces D‑0002).** A post‑shuffle reroll
   layer makes the accepted seed a function of `(originalSeed, policy,
   thresholds, triggerDefs)` rather than `originalSeed` alone. Every input
   to that function then becomes part of the replay contract. This is a
   large, silent expansion of replay surface area for no gameplay benefit.
2. **Engine authority (reinforces D‑0101).** Seed filtering inserts a
   non‑engine policy layer between match setup and first turn that can
   veto the engine's own deterministic output. That is the definition of
   an outside authority over game state.
3. **No invented mechanics (`.claude/rules/architecture.md`).** "Early
   loss," "forced loss probability," and "fairness threshold" are not
   concepts in Legendary's rules. Introducing them as gating conditions
   invents mechanics rather than implementing them.
4. **Model mismatch.** Hypergeometric probability of "≥k category‑C cards
   in the first n villain draws" is a count statistic, not a probability
   of a forced loss. Forced losses depend on sequence, city position,
   hero hand, and conditional scheme effects — none of which hypergeometric
   analysis captures. A filter claiming to gate on "forced‑loss probability"
   is gating on a proxy and mislabeling it.
5. **Design intent.** Opening variance — including occasionally brutal
   openings — is part of Legendary's difficulty profile. Filtering it out
   changes the tuning of every scheme/mastermind already content‑balanced
   against the unfiltered distribution.

**How to apply:**
- A Work Packet proposing "seed validation," "opening fairness," "early‑loss
  detection that invalidates setup," or equivalent must be rejected at
  intake.
- Observational scoring of opening seeds (for PAR, balance telemetry, or
  content QA) is allowed provided it never mutates the accepted seed or
  blocks match start.
- If a scheme is found to produce genuinely unrecoverable openings at a
  rate players consider broken, the remedy is **content** (adjust scheme
  rules, deck composition, or twist threshold via the normal content
  pipeline), not a runtime seed filter.

**Revisiting:** This decision may be revisited only by a new `DECISIONS.md`
entry that (a) identifies a concrete scheme and playtest data showing
unrecoverable openings above an agreed rate, (b) proposes a remedy and
explains why content adjustment is insufficient, and (c) addresses the
replay‑contract expansion in points 1–2 above.

**Introduced:** 2026‑04‑16 — rejection of draft WP "Early‑Loss Seed
Validation via Hypergeometric Analysis" at WP intake review.  
**Reinforces:** D‑0002 (Determinism Is Non‑Negotiable), D‑0101 (Engine Is
the Sole Authority)  
**Status:** Active

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
the requested action is not possible. Fail-closed behavior (returning void
with no mutation) is the expected outcome for invalid player actions during
normal gameplay.

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

### D‑0703 — Difficulty Is Declared Before Competition
**Decision:** Competitive play is never evaluated against retroactive,
provisional, or undeclared difficulty benchmarks. Scenario difficulty (PAR) must
be published before competitive results are accepted. Once declared, PAR
baselines are immutable for the purpose of competition — refinements create new
versions, never retroactive adjustments.  
**Rationale:** Allowing competition against an undefined or later-adjusted
baseline destroys trust and enables hindsight bias. Difficulty must be declared
first so that skill — not post-hoc calibration — is measured. This justifies the
server fail-closed gate (WP-051) and the immutable artifact store (WP-050).  
**Introduced:** WP‑049 / WP‑050 / WP‑051  
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

### D-1249 — boardgame.io Version Locked at ^0.50.0

**Decision:** The boardgame.io dependency is locked at `^0.50.0` in
`packages/game-engine/package.json`. Any upgrade requires a DECISIONS.md
entry with impact analysis before proceeding.

**Rationale:** The `Game()` API, Immer-based G mutation model, `ctx` shape,
`Server()` integration, and `FnContext` move signatures are all
version-specific in boardgame.io 0.50.x. An unintentional upgrade could
silently change how G mutations work, break move signatures, or alter phase
lifecycle hooks. The CJS server bundle workaround (D-1206) is also
version-specific.

**Consequences:** `pnpm update` must not automatically bump boardgame.io.
CI should verify the locked version. Any future upgrade must document:
which APIs changed, whether the Immer mutation model is preserved, and
whether ctx shape is backward-compatible.

**Introduced:** WP-002 (implicit), formalized during consistency audit
**Status:** Immutable

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

### D-1251 — Package Import Matrix Is an Architectural Invariant

**Decision:** The package import rules table in ARCHITECTURE.md Section 1
("Package Import Rules — Hard Constraints") is an immutable enforcement
boundary. Any new cross-package import that violates the table is a bug.

**Rationale:** The import matrix enforces unidirectional dependency flow
(Registry -> Game Engine -> Server -> Client). Violations compound silently
and are expensive to unwind. The table is declared "Hard Constraints" with
violations explicitly called bugs in ARCHITECTURE.md. D-1209 documents
the `CardRegistryReader` structural-typing workaround that enables the
engine to consume registry data without importing the registry package.

**Consequences:** Adding a new cross-package import requires verifying
compliance with the import matrix. If the import would violate the table,
a new DECISIONS.md entry must justify the exception before proceeding.

**Introduced:** WP-001 (implicit), formalized during consistency audit
**Status:** Immutable

---

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

### D-1229 — HookDefinition Is Data-Only With No Handler Functions
**Decision:** `HookDefinition` is a plain data interface (id, kind, sourceId,
triggers, priority) with no handler functions, closures, or class instances.
Handler logic lives in `ImplementationMap` (WP-009B), which is stored outside
`G` at runtime.
**Rationale:** `G` must be JSON-serializable at all times (D-0002, ARCHITECTURE.md).
Functions cannot live in `G`. Separating the data declaration (what a rule
responds to) from the execution logic (how it responds) ensures that
`G.hookRegistry` remains serializable and that rule hooks can be replayed
deterministically from the data alone.
**Introduced:** WP-009A
**Status:** Immutable

---

### D-1230 — Rule Effects Are a Tagged Data Union, Not Callback Functions
**Decision:** `RuleEffect` is a tagged union of plain data objects
(`queueMessage`, `modifyCounter`, `drawCards`, `discardHand`). Each variant
describes *what should happen*; the executor (WP-009B) applies them
deterministically. Effects contain no functions.
**Rationale:** Keeping effects as data preserves JSON serializability and
enables deterministic replay. The executor can apply effects in a `for...of`
loop without closures or callbacks. Unknown effect types push a warning to
`G.messages` and continue — they never throw — ensuring forward compatibility.
**Introduced:** WP-009A
**Status:** Immutable

---

### D-1231 — Hook Execution Order: Priority Ascending, Then ID Lexically
**Decision:** `getHooksForTrigger` returns hooks sorted by `priority` ascending,
then by `id` lexically for ties. This ordering is the sole determinant of hook
execution sequence.
**Rationale:** Deterministic ordering is required for replay correctness (D-0002).
Given the same `G.hookRegistry`, identical trigger sequences must always produce
identical effects. Priority-then-id provides a stable, predictable sort that
designers can control (via priority) with a tiebreaker that prevents ambiguity.
**Introduced:** WP-009A
**Status:** Immutable

---

### D-1232 — ImplementationMap Pattern: Handler Functions Separate from HookDefinition
**Decision:** Handler functions are stored in an `ImplementationMap`
(`Record<string, handler>`) that lives outside `G`, keyed by hook `id`. They are
never stored in `HookDefinition` or any field of `G`.
**Rationale:** `G` must be JSON-serializable at all times (D-0002, ARCHITECTURE.md).
Functions cannot be serialized. Separating the data-only `HookDefinition` (stored
in `G.hookRegistry`) from handler functions (in the `ImplementationMap`) preserves
the serialization invariant while allowing swappable logic. The `ImplementationMap`
is built once at startup and passed to lifecycle hooks via closure.
**Introduced:** WP-009B
**Status:** Immutable

---

### D-1233 — Two-Step Execute/Apply Pipeline for Rule Effects
**Decision:** Rule execution is split into two functions: `executeRuleHooks`
(collects `RuleEffect[]` without modifying `G`) and `applyRuleEffects` (applies
effects to `G` using `for...of`).
**Rationale:** Separating collection from application enables tests to assert what
effects would be produced without modifying state. It also allows callers to
inspect, filter, or replay the effect list before committing mutations. This
matches the architectural pattern where intent is declared as data and then
applied deterministically.
**Introduced:** WP-009B
**Status:** Immutable

---

### D-1234 — Unknown Effect Types Handled Gracefully, Not Thrown
**Decision:** When `applyRuleEffects` encounters an unknown effect `type`, it
pushes a structured warning to `G.messages` and continues. It never throws.
**Rationale:** Later Work Packets will add new effect types. If a newer hook
returns an effect type that the current runtime does not recognize, crashing would
abort the entire turn. Graceful degradation (warning + continue) preserves game
state integrity and provides diagnostic visibility via `G.messages` while allowing
the game to proceed.
**Introduced:** WP-009B
**Status:** Immutable

---

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

### D-1404 — Code Style Reference Is Descriptive; .claude/rules/code-style.md Is Enforcement; Three-Artifact Relationship
**Decision:** `docs/ai/REFERENCE/00.6-code-style.md` remains the descriptive
code style reference (human-readable rules with examples, rationale, and the
enforcement mapping to 00.3 §16). `.claude/rules/code-style.md` is the runtime
enforcement companion (distilled constraints loaded automatically by Claude Code
during execution). `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md §16` is the
pre-execution quality gate that checks Work Packet output against the style
rules before execution begins. Three artifacts, three audiences, three times:
- **00.6** — descriptive reference for humans and AI context (read any time)
- **.claude/rules/code-style.md** — enforcement rules for Claude Code (loaded
  automatically at execution time)
- **00.3 §16** — quality gate for Work Packet output (checked before each WP)
Neither the REFERENCE document nor the rules file is redundant. The REFERENCE
provides the examples and rationale that justify each rule; the rules file
distills these into enforceable constraints without examples; the lint checklist
maps rules to checkable items. This parallels D-1401 (prompt lint checklist),
D-1402 (connection health check), and D-1403 (R2 validation gate).
**Rationale:** Merging the descriptive reference into `.claude/rules/` would
bloat the enforcement file with examples and rationale that Claude Code does not
need at runtime. Merging the enforcement file into the REFERENCE document would
lose the automatic loading behavior. Keeping them separate preserves each
artifact's role while the subordination clause in 00.6's header ensures they
never contradict.
**Introduced:** WP-047
**Status:** Immutable

---

## Endgame Decisions

### D-1235 — Loss Before Victory Evaluation Order
**Decision:** When evaluating endgame conditions, loss conditions are always
checked before victory conditions. If both a loss condition (`schemeLoss >= 1`)
and a victory condition (`mastermindDefeated >= 1`) are met simultaneously,
the result is `scheme-wins`.
**Rationale:** Matches Legendary rulebook precedence — the scheme completing
represents an immediate catastrophic failure that supersedes individual
mastermind defeat. This prevents edge cases where a last-turn mastermind
defeat could override a scheme that already triggered.
**Introduced:** WP-010
**Status:** Immutable

---

### D-1236 — Numeric Counters Instead of Boolean Fields
**Decision:** Endgame conditions use numeric counters in `G.counters`
(`>= 1` for truthy events, `>= ESCAPE_LIMIT` for thresholds) rather than
separate boolean fields in `LegendaryGameState`.
**Rationale:** Boolean fields would require schema changes for each new
condition and cannot support threshold-based conditions (e.g., escape count).
Numeric counters are extensible via the existing `modifyCounter` effect type,
keep `G` flat, and support both boolean-equivalent events (`>= 1`) and
threshold events (`>= 8`) with the same mechanism. Missing keys default to
`0` via `?? 0`.
**Introduced:** WP-010
**Status:** Immutable

---

### D-1237 — ESCAPE_LIMIT as Hardcoded MVP Constant
**Decision:** `ESCAPE_LIMIT = 8` is a hardcoded constant in
`endgame.types.ts` for MVP, rather than a field in `MatchSetupConfig`.
**Rationale:** The standard Legendary base set uses 8 as the universal escape
limit. Scheme-specific limits (e.g., 5 for certain schemes) are a future
enhancement that requires `MatchSetupConfig` schema changes and setup
validation updates. Hardcoding for MVP avoids premature config complexity
while establishing the constant that future packets will import.
**Introduced:** WP-010
**Status:** Active — will migrate to `MatchSetupConfig` when scheme-specific
limits are implemented

---

### D-1238 — G.lobby.started as a Boolean Flag in G
**Decision:** `G.lobby.started` is a boolean flag stored in `G` rather than
relying on `ctx.phase` alone to determine whether the lobby has completed.
**Rationale:** The UI may read `G` at any point during a phase transition.
By setting `G.lobby.started = true` before calling `ctx.events.setPhase('setup')`,
the UI can observe lobby completion regardless of read timing relative to the
framework's phase transition mechanics. This is the "observability pattern"
defined in ARCHITECTURE.md Section 4.
**Introduced:** WP-011
**Status:** Active

---

### D-1239 — startMatchIfReady Transitions to Setup, Not Directly to Play
**Decision:** `startMatchIfReady` transitions to the `setup` phase, not
directly to the `play` phase.
**Rationale:** The phase sequence `lobby -> setup -> play -> end` is a locked
architectural invariant. The `setup` phase is responsible for deterministic
deck and state construction that must complete before gameplay begins. Skipping
`setup` would violate the phase lifecycle and leave the game in an incomplete
state.
**Introduced:** WP-011
**Status:** Active

---

### D-1250 — Phase Names Are Locked to lobby/setup/play/end

**Decision:** The four boardgame.io phase names (`lobby`, `setup`, `play`,
`end`) are immutable. They must not be renamed, reordered, or supplemented
without updating both `LegendaryGame` in `game.ts` and `MATCH_PHASES` in
`turnPhases.types.ts` simultaneously.

**Rationale:** Phase names are scaffolded in WP-002 and formalized in WP-007A.
They appear in `ctx.phase`, in `setPhase()` calls, in `MATCH_PHASES`
drift-detection tests, and in ARCHITECTURE.md's lifecycle mapping. Renaming
a phase would break the framework integration, invalidate replays, and require
coordinated changes across multiple files and tests.

**Consequences:** Adding a new phase (e.g., a pre-lobby phase) requires a new
DECISIONS.md entry, updates to `MATCH_PHASES`, `LegendaryGame`, and
ARCHITECTURE.md Section 4.

**Introduced:** WP-002 (scaffolded), WP-007A (formalized), audit (recorded)
**Status:** Immutable

---

### D-1240 — ctx.currentPlayer as the Lobby Ready-Map Key
**Decision:** `ctx.currentPlayer` is used as the key in `G.lobby.ready` to
track which players have signaled readiness.
**Rationale:** boardgame.io passes the authenticated player ID through
`ctx.currentPlayer`. Using this as the ready-map key ensures each player can
only set their own readiness status — they cannot impersonate another player.
No additional authentication mechanism is needed at the lobby level.
**Introduced:** WP-011
**Status:** Active

---

### D-1241 — CLI Scripts Use boardgame.io Built-In Lobby Endpoints
**Decision:** `list-matches.mjs` and `join-match.mjs` use boardgame.io's
default lobby REST endpoints (`GET /games/legendary-arena` and
`POST /games/legendary-arena/<matchID>/join`) rather than custom REST routes.
**Rationale:** boardgame.io already exposes a full lobby API. Adding custom
routes would duplicate functionality, increase surface area for bugs, and
violate the server-as-wiring-only principle. The built-in endpoints handle
seat assignment, credential issuance, and match state tracking natively.
**Introduced:** WP-012
**Status:** Active

---

### D-1242 — Unit Tests Stub fetch Rather Than Spinning Up a Test Server
**Decision:** `list-matches.test.ts` and `join-match.test.ts` stub
`globalThis.fetch` to test CLI script logic without a running server.
**Rationale:** CLI scripts are thin HTTP clients — their testable surface is
argument parsing, error message formatting, and exit code behavior. Spinning
up a real boardgame.io server for these tests would introduce startup latency,
port conflicts, and flaky teardown issues. The stubbed approach isolates the
unit under test and runs in milliseconds.
**Introduced:** WP-012
**Status:** Active

---

### D-1243 — Credentials Printed to stdout, Never Stored to Disk
**Decision:** `join-match.mjs` prints `{ matchID, playerID, credentials }`
to stdout. Credentials are never written to a file, environment variable,
or any persistent storage by the script.
**Rationale:** Credential persistence is a security concern that belongs in
a dedicated authentication layer, not in a CLI utility script. Printing to
stdout lets the caller decide how to handle credentials (pipe to a file,
store in a session, or discard). This follows the Unix principle of composable
tools and avoids creating accidental credential stores.
**Introduced:** WP-012
**Status:** Active

### Audit: Match Setup Schema and Validation Alignment (2026-04-11)

**Scope:** Match Setup, Engine Initialization, Replay Determinism, Simulation, PAR
**Related Artifacts:** `MATCH-SETUP-JSON-SCHEMA.json`, `MATCH-SETUP-SCHEMA.md`,
`MATCH-SETUP-VALIDATION.md`, `matchSetup.types.ts`, `game.ts`,
`13-REPLAYS-REFERENCE.md`

An audit identified that the prior Match Setup schema was structurally valid
but **incomplete relative to engine requirements**, creating a risk of implicit
defaults or runtime inference during engine initialization. Such schema-engine
drift is incompatible with deterministic replay, simulation correctness, and
competitive/PAR verification guarantees. Additionally, responsibilities between
server-side envelope validation and engine-side composition validation were
insufficiently documented.

The following corrective decisions (D-1244 through D-1248) were adopted to
establish Match Setup as a deterministic, engine-aligned, governance-enforced
configuration boundary. The Match Setup pipeline is now engine-aligned,
replay-safe, simulation-correct, and governance-compliant.

See `SAFE-KNOBS.md` for the list of configuration surfaces explicitly
intended to change in response to customer feedback without engine changes.

> *Match setup defines the board.
> The engine enforces the game.
> Determinism begins before a match exists.*

---

### D-1244 — Match Setup Composition Maps 1:1 to MatchSetupConfig
**Decision:** The `composition` block in MATCH-SETUP-JSON-SCHEMA.json contains
exactly the 9 locked fields defined by `MatchSetupConfig` in
`matchSetup.types.ts` (lines 29-56). Field names, types, and cardinality
match the engine contract precisely. The prior schema used `heroIds` (wrong)
and omitted `henchmanGroupIds`, `bystandersCount`, `woundsCount`,
`officersCount`, and `sidekicksCount`.
**Rationale:** Match Setup must be consumable by the engine without defaults,
inference, mutation, or interpretation. Schema-engine drift is a stop-ship
class risk for replay determinism, PAR simulation, and competitive
verification. Composition is now authoritative, explicit, and frozen.
**Related Artifacts:** `MATCH-SETUP-JSON-SCHEMA.json`, `MATCH-SETUP-SCHEMA.md`,
`matchSetup.types.ts`, 00.2 section 8.1
**Introduced:** Schema audit (2026-04-11)
**Status:** Active

---

### D-1245 — Match Setup playerCount Maximum Aligned to Engine maxPlayers
**Decision:** The schema's `playerCount` maximum was corrected from 10 to 5,
matching `LegendaryGame.maxPlayers` in `game.ts` (line 81). Minimum remains 1,
matching `LegendaryGame.minPlayers`.
**Rationale:** Prevents creation of structurally valid setups that the engine
would reject. Schema constraints must not be looser than engine constraints.
**Related Artifacts:** `MATCH-SETUP-JSON-SCHEMA.json`, `game.ts`
**Introduced:** Schema audit (2026-04-11)
**Status:** Active

---

### D-1246 — Match Setup Uses additionalProperties:false, Not Explicit Field Bans
**Decision:** Unknown fields are rejected via `additionalProperties: false` at
all object levels in the JSON Schema. A prior `not/anyOf` clause explicitly
banning `parOverride`, `scoreModifier`, `ruleOverrides`, and
`runtimeDirectives` was removed as redundant.
**Rationale:** `additionalProperties: false` already enforces fail-closed
behavior structurally. Maintaining a parallel ban list duplicates logic without
adding enforcement value and creates a false impression that only listed fields
are banned.
**Related Artifacts:** `MATCH-SETUP-JSON-SCHEMA.json`
**Introduced:** Schema audit (2026-04-11)
**Status:** Active

---

### D-1247 — Match Setup Two-Layer Structure: Envelope and Composition
**Decision:** A Match Setup document has two conceptual layers: (1) the
*envelope* (`schemaVersion`, `setupId`, `createdAt`, `createdBy`, `seed`,
`playerCount`, `themeId`, `expansions`) consumed by the server, and (2) the
*composition* block passed verbatim as boardgame.io `setupData` to the engine.
**Rationale:** The engine's `Game.setup()` accepts `MatchSetupConfig` (the
9-field composition), not the full envelope. Versioning, identity, seed, and
content pool resolution are server concerns. This separation keeps the engine
layer clean and aligns with the existing layer boundary (server wires, engine
decides).
**Related Artifacts:** `MATCH-SETUP-SCHEMA.md`, `game.ts`, `matchSetup.types.ts`
**Introduced:** Schema audit (2026-04-11)
**Status:** Active

---

### D-1248 — Match Setup Seed Is an Archival Identifier Until PRNG Wiring Exists
**Decision:** The `seed` field in Match Setup is mandatory and recorded with
every match, but boardgame.io currently manages its own internal PRNG via
`ctx.random`. There is no direct wiring path from schema seed to engine PRNG
at this time. This is accepted as a known integration gap, not a schema or
validation defect.
**Rationale:** Recording the seed now establishes the deterministic contract
for replay archival and simulation matching. Wiring it into boardgame.io's
random plugin requires a separate architectural decision and implementation
packet. Documenting the gap prevents false assumptions.
**Related Artifacts:** `MATCH-SETUP-SCHEMA.md`, `MATCH-SETUP-JSON-SCHEMA.json`,
`13-REPLAYS-REFERENCE.md`
**Introduced:** Schema audit (2026-04-11)
**Status:** Active (gap accepted, future wiring deferred)

---

## Phase Gate Decisions

### D-1320 — Phase 3 Exit Approved
**Decision:** Phase 3 (MVP Multiplayer) exit gate is satisfied. All five exit
criteria (X-1 through X-5) pass simultaneously. Phase 4 (Core Gameplay Loop)
may proceed.
**Evidence:**
- X-1 Determinism Under Concurrency — PASS (WP-009A/B, WP-010)
- X-2 Intent Validation & Replay Safety — PASS (WP-011, WP-012)
- X-3 Snapshot, Restore & Reconnect Integrity — PASS (WP-013)
- X-4 Engine/Server Authority Separation — PASS (all Phase 3 WPs)
- X-5 Failure Mode Behavior — PASS (WP-011, WP-013)
**Gate document:** `docs/ai/REFERENCE/03A-PHASE-3-MULTIPLAYER-READINESS.md`
**Rationale:** All six Phase 3 Work Packets (WP-009A, 009B, 010, 011, 012, 013)
are complete. Determinism is preserved under concurrency, the move validation
contract holds for multiplayer, persistence boundaries are formally defined in
code, engine/server separation is enforced by governance rules, and failure
modes are explicit rather than silent. The gate document was strengthened with
contractual language prohibiting regression, wall-clock tie-breaking, framework
lock-in, and silent recovery.
**Introduced:** Phase 3 gate review (2026-04-11)
**Status:** Immutable

---

## Persistence Boundary Decisions (WP-013)

### D-1310 — Snapshots Use Zone Counts, Not CardExtId Arrays
**Decision:** `MatchSnapshot` records the number of cards in each zone
(`deckCount`, `handCount`, etc.) rather than the actual `CardExtId[]` arrays.
**Rationale:** Storing zone contents would make the snapshot a second source of
truth about card positions. The live `G` is the sole authority on card locations;
snapshots are audit records only. Zone counts are sufficient for debugging and
auditing without creating data consistency risks.
**Introduced:** WP-013
**Status:** Immutable

---

### D-1311 — createSnapshot Is a Pure Function, Not an Async DB Write
**Decision:** `createSnapshot` is a synchronous pure function that returns a
frozen `Readonly<MatchSnapshot>`. It does not write to any database.
**Rationale:** Snapshot creation belongs in the game-engine layer as a pure
derivation from `G` and `ctx`. Database persistence is an application-layer
concern and will be handled by a future packet. Keeping `createSnapshot` pure
maintains the engine's no-I/O invariant and ensures snapshots are testable
without infrastructure.
**Introduced:** WP-013
**Status:** Immutable

---

### D-1312 — PersistableMatchConfig Excludes G and ctx
**Decision:** `PersistableMatchConfig` contains only `matchId`, `setupConfig`
(MatchSetupConfig), `playerNames`, and `createdAt`. It never contains `G`,
`ctx`, or any runtime state.
**Rationale:** `G` and `ctx` are runtime-only objects managed by boardgame.io.
Persisting them would bypass boardgame.io's state integrity guarantees and
violate the engine's persistence boundary. `PersistableMatchConfig` captures
only the deterministic inputs that are safe to store independently of the
runtime.
**Introduced:** WP-013
**Status:** Immutable

---

### D-1313 — Endgame Outcome Derived via evaluateEndgame, Not Stored on G
**Decision:** `createSnapshot` derives the `outcome` field by calling
`evaluateEndgame(G)` rather than reading a persisted field on `G`.
**Rationale:** `LegendaryGameState` does not have an `endgameResult` field;
boardgame.io's `endIf` mechanism returns the result through the framework,
not by storing it in `G`. `evaluateEndgame` is a pure function that reads
only `G.counters`, so calling it from `createSnapshot` is safe and deterministic.
**Introduced:** WP-013
**Status:** Immutable

---

## Lessons Learned

Audit findings distilled into reusable principles. These are not decisions
themselves but patterns observed during decision-making that should inform
future work.

### Match Setup Schema and Validation Alignment (2026-04-11)

- **Schema-engine drift is a high-risk failure mode.**
  Schemas that are "reasonable" in isolation can still violate determinism
  if they do not map 1:1 to the engine's authoritative setup contract.
  Engine alignment must be validated explicitly, not assumed.

- **Implicit defaults break replay guarantees.**
  Any missing setup field that requires inference, defaulting, or mutation
  at runtime is incompatible with deterministic replay, simulation, and
  competitive verification.

- **Fail-closed schemas reduce governance complexity.**
  Enforcing `additionalProperties: false` at all relevant levels eliminated
  the need for ad-hoc exclusion rules and prevented configuration creep.

- **Validation responsibilities must be layered and documented.**
  Structural validation, semantic validation, and governance validation
  serve different purposes and must be treated as distinct steps with
  clear boundaries.

- **Hard engine limits belong in the schema.**
  Allowing values the engine cannot support (e.g., player count) creates
  delayed failures that are harder to diagnose and audit.

- **Known gaps should be documented, not hidden.**
  Explicitly recording the seed-to-PRNG wiring gap preserved trust in the
  system and avoided false assumptions about determinism completeness.

- **Configuration must never encode rules.**
  Treating match setup strictly as configuration -- not as a balance lever
  or rule surface -- simplifies validation and preserves long-term correctness.

**Applies when:** setup schemas, deterministic configuration artifacts,
registries, replay/simulation inputs, or any pre-engine initialization
boundary is introduced or modified.

## WP-014 — Villain Deck Architecture (Authority Boundary)

WP-014 was intentionally split into two packets:

- **WP-014A** — Villain Reveal & Trigger Pipeline
  Owns runtime behaviour: reveal order, trigger emission, fail-closed handling,
  and deterministic routing. Decisions D-1405 through D-1409.

- **WP-014B** — Villain Deck Composition Rules & Registry Integration
  Owns metadata decisions: card instancing, ext_id conventions, and
  rules-based deck composition counts. Decisions D-1410 through D-1413.

No packet may cross this boundary. Reveal logic must never depend on registry
shape or deck composition strategy.

---

### D-1405 — Store Revealed Card Classification in Game State

**Decision:** The classification of villain-deck cards (`RevealedCardType`) is
stored in `G.villainDeckCardTypes: Record<CardExtId, RevealedCardType>` at
**setup time**, and all reveal logic reads from this game-state map. Reveal
moves must **never** query the registry or infer card types at runtime.

**Rationale:** boardgame.io move functions receive only `(G, ctx, args)` and
have no access to the registry. Runtime registry access would violate
determinism, complicate replays, and break offline simulation. Storing
classification in `G` yields O(1) lookup and a fully deterministic reveal
pipeline. Classification is a structural property of deck composition, not a
runtime behaviour.

**Consequences:** `revealVillainCard` relies exclusively on
`G.villainDeckCardTypes`. Tests inject mock classifications directly into `G`,
enabling isolated verification of reveal behaviour. Registry schema changes do
not require changes to reveal logic as long as setup populates
`villainDeckCardTypes` correctly.

**Introduced:** WP-014A
**Status:** Immutable

---

### D-1406 — Reveal Pipeline Is Independent of Deck Construction

**Decision:** The villain reveal pipeline (draw, classify, trigger, resolve,
route) is implemented **without** any knowledge of how the villain deck is
built. `buildVillainDeck` is **explicitly deferred** to WP-014B and is not
stubbed, guessed, or partially implemented in WP-014A.

**Rationale:** The current registry schema does not define henchman card
instances, scheme-twist card identifiers, or per-scheme/per-player deck
composition counts. Attempting to infer these would embed unverified
assumptions into game logic. Separating reveal mechanics from deck composition
allows Phase 4 to proceed while preserving long-term correctness.

**Consequences:** `buildInitialGameState` initializes empty defaults
(`villainDeck: { deck: [], discard: [] }`, `villainDeckCardTypes: {}`).
`revealVillainCard` handles empty deck + empty discard deterministically
(logs a message and returns). WP-014A remains valid even if the deck is
permanently unpopulated. WP-014B becomes the sole authority for deck
composition rules.

**Introduced:** WP-014A
**Status:** Active (deferred scope resolved by WP-014B)

---

### D-1407 — Fail-Closed Behaviour for Missing Card Classification

**Decision:** If a revealed card does not have an entry in
`G.villainDeckCardTypes`, the reveal move must **fail closed**: append a
message to `G.messages`, perform **no removal** or reshuffle, emit **no
triggers**, and return immediately.

**Rationale:** An undefined card type would otherwise produce undefined
trigger payloads, leading to silent logic failures. Fail-closed behaviour
preserves determinism and makes configuration errors visible without
corrupting game state. This mirrors input-validation rules used elsewhere in
the engine.

**Consequences:** Reveal logic validates classification before mutating state.
Tests explicitly cover and enforce this behaviour. Partial or corrupted deck
setups do not cascade into undefined gameplay.

**Introduced:** WP-014A
**Status:** Immutable

---

### D-1408 — Discard Routing Is Correct and Temporary

**Decision:** All revealed cards are placed into `G.villainDeck.discard` after
reveal resolution in WP-014A. This includes villains and henchmen. City
routing is **intentionally deferred** to WP-015.

**Rationale:** WP-014A establishes reveal correctness and trigger semantics
only. Introducing City logic earlier would couple deck reveal with board
topology. Deferring routing makes WP-015 a clean, focused packet.

**Consequences:** Reveal behaviour remains simple and deterministic. Tests
assert discard routing explicitly. Any change to routing before WP-015 is
considered a contract violation.

**Introduced:** WP-014A
**Status:** Active (superseded by WP-015 when City routing is implemented)

---

### D-1409 — Canonical RevealedCardType Set Is Closed and Drift-Checked

**Decision:** The set of revealed card types is **fixed and closed**:
`'villain' | 'henchman' | 'bystander' | 'scheme-twist' | 'mastermind-strike'`.
A canonical array `REVEALED_CARD_TYPES` must always enumerate exactly these
values, and a drift-detection test is mandatory.

**Rationale:** Trigger emission depends on exact string matching. Adding a new
type without updating the canonical set would silently break game rules. Drift
detection enforces alignment between types, constants, and tests.

**Consequences:** Any future change to revealed card taxonomy requires an
explicit decision. Tests fail early if union/array mismatch occurs. Replay
determinism is preserved across versions.

**Introduced:** WP-014A
**Status:** Immutable

---

**Related packets:**
- WP-014A — Reveal & Trigger Pipeline
- WP-014B — Villain Deck Composition Rules & Registry Integration
- WP-015 — City & HQ Zones

---

### D-1410 — Henchmen Are Virtual, Instanced Cards

**Unlocks:** `buildVillainDeck` (WP-014B)

**Decision:** Henchmen are treated as **virtual card instances**, not
registry-defined per-card entries. For each henchman group selected in
`MatchSetupConfig.henchmanGroupIds`, the group contributes a fixed number of
identical cards to the villain deck. Each copy is represented by a distinct
`CardExtId` string generated deterministically at setup time.

**Canonical ext_id convention:** `henchman-{groupSlug}-{index}`
where `{index}` is zero-padded (e.g., `henchman-doombot-legion-00` through
`henchman-doombot-legion-09`). Hyphens throughout — no colons, no underscores.

**Rationale:** The registry models henchmen at group level only, not card
level. Physical Legendary decks contain multiple identical henchmen cards.
Treating henchmen as virtual instances preserves determinism and replay
accuracy without inflating the registry schema. Distinct ext_ids are required
so that cards can move independently, escapes and KOs are attributable, and
replays remain lossless.

**Consequences:** `buildVillainDeck` is responsible for instancing henchman
ext_ids. Game logic never inspects the `{index}` portion of the ext_id. All
henchman instances share `RevealedCardType = 'henchman'`.

**Introduced:** WP-014B
**Status:** Accepted

---

### D-1411 — Scheme Twists Are Virtual, Scheme-Scoped Cards

**Unlocks:** `buildVillainDeck` (WP-014B)

**Decision:** Scheme twists are modelled as **virtual cards scoped to the
active scheme**. They are not registry cards and not generic cards shared
across schemes.

**Canonical ext_id convention:** `scheme-twist-{schemeSlug}-{index}`
where `{index}` is zero-padded (e.g., `scheme-twist-midtown-bank-robbery-00`
through `scheme-twist-midtown-bank-robbery-07`). Hyphens throughout.

**Count rule:** The number of scheme twists added to the villain deck is
defined by the scheme definition itself, not by `MatchSetupConfig`. If the
registry scheme metadata does not yet expose a twist count, WP-014B defines a
default of **8** and records it as a game-engine constant. Any deviation from
the default must be encoded in scheme metadata later, not inferred in engine
logic.

**Rationale:** In Legendary, scheme twists are mechanically distinct but
visually identical. Their meaning comes from the active scheme, not from card
text. Scheme-scoped virtual cards allow deterministic reveal, correct trigger
emission, and scheme-specific replay auditing.

**Consequences:** Reveal logic treats all scheme-twist cards uniformly. The
`{index}` exists only to uniquely identify an instance. No runtime logic keys
off the ext_id shape beyond type classification.

**Introduced:** WP-014B
**Status:** Accepted

---

### D-1412 — Villain Deck Composition Counts Come From Rules, Not Config

**Unlocks:** `buildVillainDeck` (WP-014B)

**Decision:** Villain deck composition counts are **rules-driven**, not
user-configured. `MatchSetupConfig` does not contain henchman copy counts,
scheme-twist counts, or mastermind strike counts. These quantities are derived
from scheme rules, mastermind rules, and fixed game invariants.

**Specific count sources:**
- Henchman copies per group: **10** (standard Legendary rule; game-engine
  constant). Future expansion support may make this configurable per scheme.
- Scheme twist count: **8** (default; future: per-scheme metadata).
- Bystanders in villain deck: derived from `context.ctx.numPlayers` (1 per
  player, standard Legendary rule). This is **separate** from
  `config.bystandersCount` which sizes the bystander pile (supply).
- **Bystander ext_id format (amended WP-014B):** `bystander-villain-deck-{index}`
  zero-padded (e.g., `bystander-villain-deck-00`). Indexed format chosen for
  consistency with henchman and scheme twist patterns and to enable replay
  targeting of individual bystander reveal events.
- Mastermind strikes: all non-tactic cards from the selected mastermind's
  cards array (count determined by mastermind data, not a fixed constant).

**Rationale:** These counts are not tuning knobs; they are rule invariants.
Exposing them in setup config would fracture game rules, complicate
matchmaking, and undermine replay comparability.

**Consequences:** `buildVillainDeck` derives counts from scheme definition,
mastermind definition, and fixed constants. Any future rule that modifies deck
counts must be recorded as a new decision, not silently modify setup config.

**Introduced:** WP-014B
**Status:** Accepted

---

### D-1413 — Mastermind Strikes Identified by tactic Field, Not Heuristically

**Unlocks:** `buildVillainDeck` (WP-014B)

**Decision:** Mastermind strike cards are identified by the `tactic` boolean
field on `MastermindCard` in the registry schema. A card is a **strike** when
`tactic !== true` (i.e., `tactic` is `false`, `undefined`, or absent). This is
treated as a **registry schema contract**, not an inference heuristic.

**Ext_id convention:** Mastermind strike ext_ids use the existing FlatCard key
format: `{setAbbr}-mastermind-{mastermindSlug}-{cardSlug}`. No virtual
instancing is needed because mastermind cards already have individual
identities in the registry.

**Rationale:** The `tactic` boolean is the only structural marker distinguishing
strikes from tactics in the current registry schema (`MastermindCardSchema` in
`schema.ts`). Rather than adding a new field, we formalise the existing field
as the contract. This is auditable and deterministic. WP-019 (tactics deck)
depends on this same field for the inverse selection.

**Consequences:** `buildVillainDeck` filters mastermind cards using
`tactic !== true`. Reveal logic does not care how a card was identified as a
strike — only that its `RevealedCardType` is `'mastermind-strike'`. If a
future registry change adds richer strike/tactic metadata, a new decision
supersedes this one.

**Introduced:** WP-014B
**Status:** Accepted

---

**Related packets:**
- WP-014B — Villain Deck Composition Rules & Registry Integration
- WP-015 — City & HQ Zones
- WP-017 — Bystander Mechanics
- WP-019 — Mastermind Tactics

---

### D-1501 — City and HQ Use Fixed 5-Tuples

**Unlocks:** WP-015 city/HQ zone implementation

**Decision:** The City and HQ zones are modelled as **fixed 5-element tuples**
(`[CardExtId | null, ...]`), not variable-length arrays. The City has exactly
5 spaces and the HQ has exactly 5 hero slots, matching the physical Legendary
board layout.

**Rationale:** Fixed-size tuples enforce the board layout at the type level.
Variable-length arrays would allow invalid states (e.g., a 6-space city or
0-space city) that could silently corrupt gameplay. The 5-space constraint is
fundamental to Legendary's game design and is not configurable.

**Introduced:** WP-015
**Status:** Accepted

---

### D-1502 — City Push Inserts at Space 0

**Unlocks:** WP-015 villain movement

**Decision:** New villains and henchmen always enter the City at **space 0**.
All existing cards shift rightward toward space 4 (the escape edge). The card
that escapes is always the card previously occupying space 4, never the newly
revealed card.

**Rationale:** This matches the physical Legendary board's left-to-right flow.
The leftmost space is the entry point; the rightmost space is the escape edge.
The push-from-zero convention is deterministic, unambiguous, and matches every
published Legendary rulebook.

**Introduced:** WP-015
**Status:** Accepted

---

### D-1503 — Bystander MVP: Discard, Not Capture

**Unlocks:** WP-015 reveal routing

**Decision:** In WP-015, revealed bystanders go to `G.villainDeck.discard`
with a message logged to `G.messages`. Bystander capture rules (rescuing
bystanders for VP) are deferred to WP-017.

**Rationale:** WP-015 focuses on City placement and villain movement. Adding
bystander capture would require the KO pile, bystander attachment tracking,
and rescue move — all of which are WP-017 scope. The discard + message
approach preserves the reveal pipeline's completeness while keeping WP-015
focused.

**Introduced:** WP-015
**Status:** Accepted (temporary — WP-017 replaces with capture rules)

---

**Related packets:**
- WP-015 — City & HQ Zones (Villain Movement + Escapes)
- WP-016 — Fight First, Then Recruit
- WP-017 — Bystander Mechanics

---

### D-1601 — CoreMoveName and MOVE_ALLOWED_STAGES Are a Closed Set

**Unlocks:** WP-016 non-core move pattern; all future domain moves

**Decision:** `CoreMoveName`, `CORE_MOVE_NAMES`, and `MOVE_ALLOWED_STAGES` are
**closed** to the three original lifecycle moves (`drawCards`, `playCard`,
`endTurn`). Domain actions (`revealVillainCard`, `fightVillain`, `recruitHero`,
and all future gameplay moves) are **non-core moves** that must enforce stage
gating internally by checking `G.currentStage` directly within the move body.
Non-core moves must not be added to `CoreMoveName`, `CORE_MOVE_NAMES`, or
`MOVE_ALLOWED_STAGES`.

**Rationale:** Keeps core lifecycle logic stable as the game grows. Prevents
repeated modifications to core contract files (`coreMoves.types.ts`,
`coreMoves.gating.ts`) every time a new move is added. Preserves static
analyzability of move-stage legality and replay determinism. The non-core
internal gating pattern was established by `revealVillainCard` (WP-014A) and
formalized in EC-014A's "Core vs Non-Core Move Model" section.

**Consequences:** Any WP that introduces a new move must gate it internally.
Expanding `CoreMoveName` requires an explicit architecture-level decision
recorded in `DECISIONS.md` and referenced from `ARCHITECTURE.md`. This
decision complements D-1223, which assigns stage gating only for core
lifecycle moves; domain moves intentionally bypass `MOVE_ALLOWED_STAGES`.

**Introduced:** WP-014A (precedent), formalized WP-016 (decision)
**Status:** Accepted

---

### D-1602 — Fight and Recruit Ordering Is Player-Controlled

**Unlocks:** WP-016 fight/recruit move ordering

**Decision:** Players may fight or recruit in any order during the `main` stage
of their turn. The engine enforces legality only (target exists, correct stage),
not ordering. Both `fightVillain` and `recruitHero` are valid in `main`
simultaneously.

"Fight-first" is recorded as a **policy preference** for UI/AI guidance only,
not a rules constraint enforced by the engine. The engine does not reject a
recruit move when a fight target is available.

**Rationale:** In physical Legendary (tabletop rules), the active player may
fight or recruit in any order during their turn, choosing whichever action best
suits their strategy. This behavior is preserved intentionally in the engine.
Fight-first is a recommended strategy, not a rule enforced by the game. Enforcing it in the
engine would require inspecting City state during recruit validation, which
creates cross-zone coupling and complicates future rule exceptions. Future
enforcement layers (AI hints, UI suggestions) may reference this policy without
engine changes.

**Introduced:** WP-016
**Status:** Accepted

---

### D-1603 — MVP Fight and Recruit Have No Resource Checking

**Unlocks:** WP-016 minimal implementation

**Decision:** In WP-016, `fightVillain` and `recruitHero` do not check
attack or recruit points before executing. Any player can fight any
occupied City space or recruit any occupied HQ slot without resource
validation. WP-018 introduces `G.turnEconomy` and enforces resource costs.

**Rationale:** Separating the move mechanics (target validation, zone
transfer) from the economy (resource costs) allows incremental delivery.
WP-016 proves the moves work correctly in isolation; WP-018 layers resource
gating on top without modifying the move contracts.

**Introduced:** WP-016
**Status:** Accepted (superseded by WP-018 when economy is implemented)

---

### D-1604 — Recruited Heroes Go to Player Discard, Not Hand

**Unlocks:** WP-016 recruit destination

**Decision:** When a player recruits a hero from the HQ, the card is placed
in the player's `discard` zone, not their `hand`. This matches the physical
Legendary tabletop rules where recruited cards go to the discard pile and
are drawn in future turns.

**Rationale:** Placing recruited heroes directly in hand would give an
immediate play advantage not present in the physical game. The discard
destination preserves the deck-building cycle: recruit → discard → shuffle
→ draw → play.

**Introduced:** WP-016
**Status:** Accepted

---

### D-1701 — MVP Attaches Exactly 1 Bystander per Villain Entering City

**Unlocks:** WP-017 bystander capture

**Decision:** When a villain or henchman enters the City via
`revealVillainCard`, exactly one bystander is attached from
`G.piles.bystanders` (taking `pile[0]`). This is a simplified MVP rule.
Full Legendary rules allow variable bystander counts based on card text
and game effects.

**Rationale:** The 1-bystander-per-villain rule covers the core mechanic
without requiring card text parsing or effect resolution. Future WPs can
extend this to support variable counts.

**Introduced:** WP-017
**Status:** Accepted

---

### D-1702 — Escape Causes Wound (MVP Player Penalty)

**Unlocks:** WP-017 escape side effects

**Decision:** When a villain escapes the City (pushed past space 4), the
current player gains 1 wound from `G.piles.wounds` into their discard zone.
If the wounds pile is empty, no wound is gained (deterministic no-op).

**Rationale:** This links escapes to a tangible player penalty beyond the
endgame counter increment. In tabletop Legendary, escapes have various
penalties; the wound rule is a reasonable MVP default that makes escapes
feel consequential during gameplay.

**Introduced:** WP-017
**Status:** Accepted

---

### D-1703 — G.attachedBystanders Is a Plain Record, Not a Map

**Unlocks:** WP-017 state shape

**Decision:** `G.attachedBystanders` is typed as
`Record<CardExtId, CardExtId[]>` — a plain JavaScript object, not a `Map`
or `Set`. Entries are created on City entry and removed on defeat (award)
or escape (return to supply).

**Rationale:** `G` must be JSON-serializable at all times (engine-wide
invariant). `Map` and `Set` do not survive `JSON.stringify/parse`
round-trips. A plain object with string keys satisfies the serializability
constraint while providing O(1) lookup by card ID.

**Introduced:** WP-017
**Status:** Accepted

---

### D-1704 — Escaped Bystanders Return to Supply Pile, Not KO

**Unlocks:** WP-017 escape bystander resolution

**Decision:** When a villain escapes the City, any bystanders attached to
the escaped card are returned to the end of `G.piles.bystanders` (supply
pile), not placed in `G.ko`.

**Rationale:** Returning bystanders to supply prevents bystander depletion
artifacts where repeated escapes would permanently remove bystanders from
the game. This preserves the total bystander count and matches the
tabletop Legendary convention where escaped bystanders are not destroyed.

**Introduced:** WP-017
**Status:** Accepted

---

### D-1705 — Supply Pile pile[0] Is Top-of-Pile Convention

**Unlocks:** WP-017 pile consumption

**Decision:** For all supply piles (`G.piles.bystanders`, `G.piles.wounds`,
etc.), `pile[0]` is the top of the pile — the card consumed next. Removal
uses `pile.slice(1)`. This is consistent with the villain deck convention
where `deck[0]` is the top card.

**Rationale:** A consistent top-of-pile convention across all array-based
card zones prevents confusion and off-by-one errors. `pile[0]` + `.slice(1)`
is deterministic, immutable-friendly, and matches the existing deck
convention established in WP-014A.

**Introduced:** WP-017
**Status:** Accepted

---

**Related packets:**
- WP-014A — Villain Reveal & Trigger Pipeline (non-core move precedent)
- WP-016 — Fight First, Then Recruit
- WP-017 — KO, Wounds & Bystander Capture (Minimal MVP)
- WP-018 — Attack & Recruit Economy

---

## Engine-Wide Gameplay Invariants

### D-1801 — Economy and Scoring Are Separate Concerns

**Decision:** The attack/recruit economy (`G.turnEconomy`) determines what
actions are allowed during play and resets each turn. VP scoring
(`computeFinalScores`, WP-020) determines final results only and is computed
at match end. These two systems are strictly separate and must never be
conflated.

**Rationale:** Economy governs action legality during gameplay; scoring governs
outcome evaluation after gameplay. Conflating them (e.g., VP affecting action
legality, or economy state persisting into scoring) would create feedback loops
that break determinism and complicate balance testing. Endgame detection
(WP-010) and VP scoring (WP-020) are also separate: endgame uses `G.counters`,
scoring uses zone contents.

**Consequences:** No WP may introduce mechanics where VP affects action
legality or where turn economy influences final scoring. Economy state
(`G.turnEconomy`) must never appear in `computeFinalScores` logic.

**Introduced:** WP-018 (implicit), formalized during consistency audit
**Status:** Immutable

---

### D-1802 — Debuggability Via Deterministic Reproduction Only

**Decision:** All engine behavior must be debuggable via deterministic
reproduction and state inspection — not runtime logging, breakpoints, or
printf debugging.

**Rationale:** The engine is designed for full replay reproducibility (D-0002).
Given identical setup config, identical RNG seed, and identical ordered moves,
execution must produce identical results. This means bugs can always be
reproduced deterministically. Relying on runtime logging or breakpoints would
create debugging approaches that cannot be replayed, shared, or automated.
`G.messages` provides deterministic observability for rule effects and
diagnostics.

**Consequences:** No state mutation may be introduced that cannot be inspected
post-execution or validated via tests or replay analysis. After execution,
runtime state must remain JSON-serializable with no invalid entries. When
execution performs non-obvious behavior, a human-readable entry should be
appended to `G.messages`.

**Introduced:** WP-010 (implicit), formalized during consistency audit
**Status:** Immutable

---

### D-1803 — G.cardStats Stores Parsed Card Stats at Setup Time (Registry Boundary)

**Decision:** `G.cardStats` is a `Record<CardExtId, CardStatEntry>` built at
setup time from registry data via `buildCardStats()`. It is read-only after
setup — no move or hook may write to it. Moves access card stats via
`G.cardStats[cardId]` without registry access.

**Rationale:** Same pattern as `G.villainDeckCardTypes` (D-1410). The registry
is available at setup time only. Resolving card stats during setup ensures moves
are deterministic and have O(1) lookup without crossing the registry boundary.

**Consequences:** Any new card stat field must be added to `CardStatEntry` and
populated during `buildCardStats`. Moves may never import or query the registry.

**Introduced:** WP-018
**Status:** Accepted

---

### D-1804 — "2+" Parses to Base 2 Only (Conditional Bonuses Deferred)

**Decision:** The `parseCardStatValue` parser strips trailing `+` and `*`
modifiers and returns the integer base only. `"2+"` parses to `2`, not
"2 plus conditional bonus". Conditional bonus semantics are deferred to WP-022
(keyword-driven effects).

**Rationale:** ARCHITECTURE.md "Card Field Data Quality" specifies strip-and-parse
as the parsing rule. The `+` modifier has no mechanical meaning until the keyword
effect system exists. Implementing conditional logic in the parser would create
scope creep and couple the economy to an unimplemented system.

**Consequences:** MVP economy values are lower than full-game values for cards
with `+` modifiers. This is intentional and will be addressed by WP-022.

**Introduced:** WP-018
**Status:** Accepted

---

### D-1805 — CardStatEntry.fightCost Is Semantically Distinct from CardStatEntry.attack

**Decision:** `CardStatEntry` has separate `attack` (hero attack generation)
and `fightCost` (villain/henchman fight requirement) fields. Both derive from
numeric card fields but serve different purposes: `attack` is added to the
economy by `playCard`, while `fightCost` is validated by `fightVillain`.

**Rationale:** Hero `attack` generates resources; villain `vAttack` represents
a cost to fight. Conflating them in a single field would create confusion about
direction (adding vs spending) and make the data model ambiguous.

**Consequences:** `buildCardStats` sets `fightCost = 0` for heroes and
`attack = 0, recruit = 0, cost = 0` for villains/henchmen. No cross-contamination.

**Introduced:** WP-018
**Status:** Accepted

---

### D-1806 — Starting Cards Contribute 0/0 in MVP (Fail-Closed)

**Decision:** Starting cards (S.H.I.E.L.D. Agents and Troopers) are not in
`G.cardStats` and contribute 0 attack / 0 recruit when played. This is a
**fail-closed MVP** choice.

**Rationale:** Starting cards are well-known game components, not registry cards.
Adding hardcoded stat values for them would require special-case logic outside
the registry resolution pattern. The fail-closed behavior (missing stats = 0/0)
is safe and consistent. In the real game, Agents provide 1 recruit and Troopers
provide 1 attack — a future WP can add starting card stat entries for
gameplay-correct economy.

**Consequences:** MVP economy does not match full Legendary gameplay for starting
cards. Players will need to rely on hero cards for attack/recruit generation.

**Introduced:** WP-018
**Status:** Accepted (MVP limitation)

---

### D-1807 — HQ Refill After Recruit Is Not in WP-018

**Decision:** Recruiting a hero from the HQ does not automatically refill the
empty slot. HQ refill is a separate concern that may require its own WP.

**Rationale:** WP-018 focuses on the economy (resource gating). HQ refill
involves drawing from a hero deck (not yet implemented as a runtime zone) and
may interact with hero deck exhaustion rules. Bundling it into WP-018 would
create scope creep.

**Consequences:** After recruiting, the HQ slot remains null until a future WP
implements refill logic.

**Introduced:** WP-018
**Status:** Accepted

---

### D-1901 — MVP Defeats Exactly 1 Tactic per Successful Fight

**Decision:** `fightMastermind` defeats the top tactic card (index 0) from the
tactics deck on each successful fight. Multi-tactic defeat and conditional
defeat logic are deferred to WP-024 (tactic text effects).

**Rationale:** The MVP mastermind fight is purely mechanical — validate attack
points, spend them, remove a tactic, check for victory. Tactic cards have no
text effects in MVP. Implementing multi-defeat or conditional logic would couple
the fight move to a keyword system that does not yet exist.

**Consequences:** Each mastermind fight costs attack points but only defeats one
tactic regardless of excess attack. Players must fight the mastermind multiple
times to win.

**Introduced:** WP-019
**Status:** Accepted (MVP simplification)

---

### D-1902 — Mastermind vAttack Stored as fightCost via buildMastermindState

**Decision:** The mastermind's `vAttack` is parsed at setup time by
`buildMastermindState` using WP-018's `parseCardStatValue` and stored as
`fightCost` in `G.cardStats[baseCardId]`. `buildMastermindState` is the **sole
place** the mastermind base card enters `G.cardStats` — WP-018's
`buildCardStats` does not include masterminds.

**Rationale:** `fightCost` is the semantic field for fight requirements per
D-1805. `CardStatEntry.attack` is for hero attack generation only. Using the
same field and pattern as villains/henchmen ensures consistency across all card
types that have fight requirements.

**Consequences:** `buildMastermindState` must execute **after** `buildCardStats`
so the `cardStats` record exists. The mastermind base card entry has
`attack: 0, recruit: 0, cost: 0` (masterminds do not generate resources).

**Introduced:** WP-019
**Status:** Accepted

---

### D-1903 — No Tactic Text Effects in MVP

**Decision:** Tactic cards in MVP are defeated and moved to `tacticsDefeated`
with no additional effects. Tactic abilities (text effects, conditional triggers)
are deferred to WP-024.

**Rationale:** The MVP mastermind fight validates the boss-fight loop
(play -> fight -> defeat tactics -> win) without requiring the keyword/ability
system. Implementing tactic effects before the keyword system exists would
create throwaway code.

**Consequences:** Tactic cards have no mechanical impact beyond being the defeat
counter. Their `vAttack` values are not used (only the base card's `vAttack`
determines fight cost).

**Introduced:** WP-019
**Status:** Accepted (MVP limitation)

---

### D-1904 — buildMastermindState Adds Mastermind Base Card to cardStats Separately

**Decision:** `buildMastermindState` adds the mastermind base card to the
`cardStats` record passed to it as a parameter. This is separate from
`buildCardStats` (WP-018), which only processes heroes, villains, and henchmen.

**Rationale:** WP-018's `buildCardStats` iterates `heroDeckIds`,
`villainGroupIds`, and `henchmanGroupIds` from the match config. Masterminds
are a distinct entity type selected via `mastermindId` and resolved through
a different registry path (`setData.masterminds`). Adding mastermind processing
to `buildCardStats` would blur the separation between WP-018 and WP-019 scope.

**Consequences:** The ordering invariant (`buildMastermindState` after
`buildCardStats`) must be maintained. If future WPs add more entity types
to `G.cardStats`, they should follow this same pattern of adding entries in
their own setup function.

**Introduced:** WP-019
**Status:** Accepted

---

### D-2001 — MVP VP Table Values Locked as Named Constants

**Decision:** VP values for MVP scoring are locked: VP_VILLAIN=1,
VP_HENCHMAN=1, VP_BYSTANDER=1, VP_TACTIC=5, VP_WOUND=-1. These are
named constant exports, never inline numbers.

**Rationale:** Named constants prevent magic numbers, make future balance
changes auditable, and simplify test expectations. Values are chosen for
MVP simplicity, not game balance. Card-text VP modifiers are future packets.

**Consequences:** All scoring math uses these constants. Any VP value change
requires updating the constant and re-running all scoring tests.

**Introduced:** WP-020
**Status:** Accepted (MVP — values may change in future balance packets)

---

### D-2002 — Wounds Identified by WOUND_EXT_ID Constant

**Decision:** Wounds in player zones are identified by `cardId === WOUND_EXT_ID`
where `WOUND_EXT_ID = 'pile-wound'`. All wound cards share this single ext_id
from WP-017. No registry lookup or card text inspection is required.

**Rationale:** Wound cards are well-known game components (like starting cards).
They use a single constant ext_id from the pile system. Pattern matching or
registry queries would add unnecessary complexity.

**Consequences:** Scoring counts wounds across deck, hand, discard, and inPlay
(not victory — wounds in victory would be unusual).

**Introduced:** WP-020
**Status:** Accepted

---

### D-2003 — Tactic VP Awarded to All Players

**Decision:** Each defeated mastermind tactic contributes `VP_TACTIC` to every
player's score. Tactic VP is not attributed to the player who defeated the
tactic.

**Rationale:** WP-019's `G.mastermind.tacticsDefeated` does not track which
player defeated each tactic. Implementing per-player attribution would require
modifying `MastermindState` — out of scope for WP-020. Awarding to all players
is the simplest MVP rule that keeps scoring read-only and decoupled.

**Consequences:** Tactic VP is symmetric across all players. The differentiator
for winning is victory pile composition and wound count, not tactic contribution.

**Introduced:** WP-020
**Status:** Accepted (MVP — per-player attribution is a future packet)

---

### D-2004 — Scores Not Stored in G During MVP

**Decision:** `computeFinalScores` returns `FinalScoreSummary` as a derived
view. Results are NOT stored in `G` during MVP.

**Rationale:** Scoring is a derived view, not game state. `G` is runtime state
managed by moves (D-1801). Storing derived data in `G` would violate this
principle and create coupling between scoring and the move system.

**Consequences:** Future UI, server, or snapshot code calls
`computeFinalScores(G)` explicitly to get scores. The function is a pure
library export.

**Introduced:** WP-020
**Status:** Accepted

---

### D-2005 — game.ts Not Modified for Scoring

**Decision:** `computeFinalScores` is exported as a pure library function and
is NOT wired into `game.ts` or any boardgame.io lifecycle hook during MVP.

**Rationale:** Keeping scoring out of the engine lifecycle preserves purity,
avoids contact with boardgame.io phase/hook complexity, and lets the caller
decide when and how to compute scores. Automatic invocation is a future concern.

**Consequences:** No engine hook calls scoring automatically. The caller
(future UI, server, or test harness) is responsible for invoking scoring
after the game ends.

**Introduced:** WP-020
**Status:** Accepted (MVP)

---

### D-2006 — Bystander VP Uses Dual-Source Check

**Decision:** Bystander VP scoring uses a dual check: (1)
`G.villainDeckCardTypes[cardId] === 'bystander'` for villain-deck bystanders,
AND (2) `cardId === BYSTANDER_EXT_ID` for rescued supply-pile bystanders.
Both contribute `VP_BYSTANDER`.

**Rationale:** Victory piles may contain bystanders from two different sources
with different ext_id formats. Villain-deck bystanders have deck-specific
ext_ids tracked in `G.villainDeckCardTypes`. Rescued supply-pile bystanders
use `BYSTANDER_EXT_ID = 'pile-bystander'` (awarded by `awardAttachedBystanders`
in WP-017) and are NOT in `G.villainDeckCardTypes`. Checking only one source
would undercount bystander VP.

**Consequences:** Scoring must import `BYSTANDER_EXT_ID` and check both
conditions. Tests must include at least one rescued supply-pile bystander
to verify the dual check.

**Introduced:** WP-020
**Status:** Accepted

---

### D-2101 — HeroAbilityHook Is Data-Only

**Decision:** `HeroAbilityHook` is a data-only, JSON-serializable interface
stored in `G.heroAbilityHooks`. Same pattern as `HookDefinition` (WP-009A).
No functions, closures, or handler references stored in `G`.

**Rationale:** `G` must be fully JSON-serializable. Storing functions or
closures in `G` violates the runtime-only constraint and breaks determinism.

**Consequences:** All hero ability hooks are inert declarations. Execution
logic lives outside `G` and is introduced in WP-022+.

**Introduced:** WP-021
**Status:** Accepted

---

### D-2102 — HeroKeyword Union Is Closed

**Decision:** `HeroKeyword` union is closed. Adding a keyword requires a
DECISIONS.md entry and updating both the union type and `HERO_KEYWORDS`
canonical array.

**Rationale:** Drift between the union type and the canonical array is a
known AI failure mode. Closing the union and enforcing drift-detection tests
prevents silent divergence.

**Consequences:** `HERO_KEYWORDS` canonical array and `HeroKeyword` union
must always match exactly. Drift-detection tests enforce this.

**Introduced:** WP-021
**Status:** Accepted

---

### D-2103 — HeroAbilityTiming Union Is Closed

**Decision:** `HeroAbilityTiming` union is closed. Same drift-detection
pattern as `HeroKeyword`. Timing defaults to `'onPlay'` when ability markup
does not encode timing explicitly. No NL inference.

**Rationale:** A safe default prevents ambiguous or missing timing values
from requiring natural-language parsing. `'onPlay'` is the most common
timing in Legendary and is the correct fallback.

**Consequences:** `HERO_ABILITY_TIMINGS` canonical array and
`HeroAbilityTiming` union must always match exactly. Drift-detection tests
enforce this. Unrecognized timings are not inferred.

**Introduced:** WP-021
**Status:** Accepted

---

### D-2104 — Hero Ability Execution Deferred to WP-022+

**Decision:** Hero ability execution is deferred to WP-022+.
`G.heroAbilityHooks` is an observation-only data structure in WP-021.
No game state changes result from hero hooks.

**Rationale:** WP-021 establishes the data contract. Execution introduces
new complexity (effect application, condition evaluation) that belongs in
its own packet with its own tests.

**Consequences:** `G.heroAbilityHooks` is populated at setup but never
consumed by the engine during gameplay in WP-021. The packet is inert
by design.

**Introduced:** WP-021
**Status:** Accepted

---

### D-2105 — buildHeroAbilityHooks Uses CardRegistryReader

**Decision:** `buildHeroAbilityHooks` uses `CardRegistryReader` (not
`CardRegistry`). Builder consumes only `cardId`/`key`, `abilities: string[]`,
and deck membership.

**Rationale:** `CardRegistryReader` is the read-only interface exposed by
the registry layer. Using the full `CardRegistry` would widen the coupling
surface beyond what the builder requires.

**Consequences:** The builder function signature accepts `CardRegistryReader`.
No direct dependency on the mutable registry implementation.

**Introduced:** WP-021
**Status:** Accepted

---

### D-2201 — Only 4 Keywords Execute in WP-022 MVP
**Decision:** Only `'draw'`, `'attack'`, `'recruit'`, and `'ko'` are executed in the
minimal MVP. The remaining 4 keywords (`'rescue'`, `'wound'`, `'reveal'`,
`'conditional'`) are safely ignored — no mutation, no error.
**Rationale:** These 4 keywords cover the most common hero card abilities with
existing helpers (zone-ops for draw, `addResources` for economy, `koCard` for KO).
The remaining keywords require conditional logic, targeting UI, or additional game
systems that are not yet implemented. Executing a safe subset first allows
incremental testing and validates the execution pipeline.
**Introduced:** WP-022
**Status:** Scoped to WP-022. WP-023 adds conditional evaluation.

---

### D-2202 — KO Targets the Played Card Only (MVP)
**Decision:** The `'ko'` keyword in WP-022 targets the played hero card itself —
the card is removed from inPlay and added to `G.ko`. No player choice or target
selection is supported.
**Rationale:** Many hero cards say "KO this card to..." — targeting the played card
is the simplest deterministic implementation. Target selection requires UI
interaction and a choice protocol that does not exist yet.
**Introduced:** WP-022
**Status:** Scoped to WP-022. Future WPs may add target selection for KO.

---

### D-2203 — Hero Hook Economy Is Additive to Base Card Stats
**Decision:** `executeHeroEffects` adds attack/recruit from hook effects on top of
the base card stats already applied by `playCard` via WP-018's `addResources` call.
The WP-018 economy call is not removed or replaced.
**Rationale:** Base card stats (from `G.cardStats`) and hero hook effects
(from `G.heroAbilityHooks`) may overlap for some cards, producing additive economy.
This is intentional — removing the base stats call risks breaking cards that have
no hooks. If specific cards produce unintended double-counting, the resolution is
a card-data fix or a future WP, not removing the base economy path.
**Introduced:** WP-022
**Status:** Active. Monitor for double-counting during play testing.

---

### D-2204 — executeHeroEffects Uses ctx: unknown to Avoid boardgame.io Import
**Decision:** The `executeHeroEffects` function accepts `ctx: unknown` and narrows
to `ShuffleProvider` (from engine-internal `setup/shuffle.js`) at the draw call
site. This keeps the file free of boardgame.io imports.
**Rationale:** Follows the established pattern from WP-005B/008B where
boardgame.io ctx is structurally compatible with `ShuffleProvider`. Hero execution
files are pure helpers — the boardgame.io import boundary is enforced by
`.claude/rules/architecture.md`.
**Introduced:** WP-022
**Status:** Active

---

### D-2205 — Draw Logic Extracted, Not drawCards Move Called
**Decision:** `executeHeroEffects` implements draw logic using zone-ops primitives
(`moveCardFromZone`, `moveAllCards`, `shuffleDeck`) directly, rather than calling
the `drawCards` move function.
**Rationale:** `drawCards` is a full move function that takes `MoveContext`, performs
args validation, and checks stage gating — responsibilities that belong to the move
layer, not to a helper called from within another move. The draw algorithm
(deck-to-hand with reshuffle on empty) is replicated using the same zone-ops
primitives that `drawCards` uses.
**Introduced:** WP-022
**Status:** Active

---

### D-2206 — DataProvenance Type Deferred (Not Yet Useful)
**Decision:** A `DataProvenance` type for tracing setup-time derived artifacts
(e.g., `G.heroAbilityHooks`, `G.cardStats`) back to their input data sources
was considered and deferred. It will not be implemented until real debugging
pain justifies it.
**Rationale:** The proposal meets only the weakest "truly useful" criterion
(likely future extension point). No debugging scenario has yet required
answering "which card JSON version produced this hook?" The type would also
introduce a determinism tension: `buildTimeIso` timestamps in `G` violate
D-0002 unless injected deterministically or omitted, and adding an optional
`provenance` field to `HeroAbilityHook` would modify a WP-021 locked contract.
Per code-style rules, "duplicate first, abstract only when a third copy
appears" — zero copies exist today. A ready-to-execute prompt is saved for
when the need materializes (criteria: a real debugging session where
upstream tracing takes >5 minutes, or a second/third derived field with the
same traceability need, or frequent card data changes).
**Introduced:** WP-022 review (2026-04-13)
**Status:** Deferred. Re-evaluate when debugging pain or data churn arrives.

### D-2301 — Condition Evaluation Uses AND Logic
**Decision:** `evaluateAllConditions` returns `true` only when ALL conditions
on a hero ability hook pass. Empty or undefined conditions = unconditional
(returns `true`). This is the only supported logic mode for MVP.
**Rationale:** AND logic is the simplest correct model — a hero card that
says "if you played a Tech hero this turn, gain +2 attack" requires both
the Tech check and any other conditions to pass. OR logic and complex
combinators are deferred until card data demands them.
**Introduced:** WP-023 (2026-04-13)
**Status:** Active

---

### D-2302 — 4 MVP Condition Types (2 Functional, 2 Placeholder)
**Decision:** WP-023 implements evaluators for 4 condition types:
`requiresKeyword` and `playedThisTurn` are fully functional with current G
data. `heroClassMatch` and `requiresTeam` return `false` unconditionally
because team/class data is not resolved into G yet.
**Rationale:** Team and hero class data exists in the registry
(`HeroGroupSchema.team`, `HeroCardSchema.hc`) but is not resolved into
`G.cardStats` or any other G field at setup time. Adding this data requires
expanding `CardStatEntry` or introducing new G fields — scope beyond WP-023.
The placeholder pattern (return `false` = safe skip) matches WP-022's
treatment of unsupported keywords.
**Introduced:** WP-023 (2026-04-13)
**Status:** Active — follow-up WP needed to resolve team/class data into G

---

### D-2303 — Condition Evaluators Are Pure Functions (Never Mutate G)
**Decision:** `evaluateCondition` and `evaluateAllConditions` are pure
functions that read `G` and return `boolean`. They never mutate game state.
Deep equality test enforces this invariant.
**Rationale:** Conditions are pre-filters, not actions. Mutating G during
condition evaluation would break determinism and make debugging impossible
(the act of checking whether an effect should fire would change the game).
**Introduced:** WP-023 (2026-04-13)
**Status:** Immutable

---

### D-2304 — Condition Type String Is heroClassMatch (Not requiresColor)
**Decision:** The condition type for hero class checks is `heroClassMatch`,
matching the string produced by `heroAbility.setup.ts` (line 123). The
WP-023 spec originally used `requiresColor` — pre-flight discovered the
drift and locked the actual code string.
**Rationale:** Evaluators must match the condition type strings that exist
in `G.heroAbilityHooks` at runtime. Using aspirational names from the WP
instead of actual code strings causes silent evaluation failures.
**Introduced:** WP-023 pre-flight (2026-04-13)
**Status:** Active

---

### D-2305 — HeroCondition.value Is Always String; Numeric Parse for playedThisTurn
**Decision:** `HeroCondition` has `type: string; value: string` per WP-021.
The `playedThisTurn` evaluator parses `value` to integer via `parseInt`.
Invalid parse returns `false` (safe skip).
**Rationale:** The WP-021 contract uses string for value to keep the type
generic. Parsing at evaluation time is correct — condition descriptors are
data, evaluators interpret them.
**Introduced:** WP-023 (2026-04-13)
**Status:** Active

---

### D-2401 — Scheme and Mastermind Use Same Hook Pipeline as Heroes
**Decision:** Scheme twist and mastermind strike handlers use the existing
`executeRuleHooks` -> `applyRuleEffects` pipeline from WP-009B. No new
execution engine was created.
**Rationale:** The two-step pipeline (collect effects, apply effects) is the
established pattern for all rule hooks. Scheme and mastermind handlers are
`ImplementationMap` entries like hero keyword handlers. One pipeline ensures
deterministic replay and consistent effect application.
**Introduced:** WP-024 (2026-04-13)
**Status:** Active

---

### D-2402 — MVP Scheme Twist Threshold Is Fixed at 7
**Decision:** `MVP_SCHEME_TWIST_THRESHOLD = 7` is a fixed constant. Most
standard Legendary schemes trigger loss at 7 twists. A future WP will
parameterize per-scheme thresholds resolved from registry data at setup time.
**Rationale:** MVP simplification. Real schemes have varying thresholds
defined in card text. The constant provides functional scheme-loss behavior
without text parsing.
**Introduced:** WP-024 (2026-04-13)
**Status:** Active (MVP — will be replaced by per-scheme thresholds)

---

### D-2403 — MVP Mastermind Strike Uses Counter + Message Only
**Decision:** Mastermind strike handler produces `modifyCounter` +
`queueMessage` effects only. Actual wound card movement (moving cards from
`G.piles.wounds` to player discard) requires a `'gainWound'` effect type
that does not exist yet.
**Rationale:** Existing effect types do not support card-movement wound-gain.
Counter tracking provides observability for the MVP. A future WP will add
a `'gainWound'` effect type to the `RuleEffect` union and implement actual
wound card movement. This follows the WP-023 safe-skip pattern: implement
the handler structure, defer full behavior.
**Introduced:** WP-024 (2026-04-13)
**Status:** Active (MVP — wound card effects deferred)

---

### D-2404 — WP-009B Stub Handlers Replaced with Real Handlers
**Decision:** `defaultSchemeImplementation` and `defaultMastermindImplementation`
(WP-009B stubs) replaced with `schemeTwistHandler` and `mastermindStrikeHandler`.
Stub triggers (`onTurnStart`, `onTurnEnd`) replaced with real triggers
(`onSchemeTwistRevealed`, `onMastermindStrikeRevealed`). Integration test
assertions updated under 01.5 allowance (value-only, no new logic).
**Rationale:** The stubs existed to prove the pipeline worked (WP-009B). Now
that the pipeline is proven, real handlers replace them. Trigger replacement
is the core behavioral change — scheme hooks now fire when scheme twists
are actually revealed, not on generic turn events.
**Introduced:** WP-024 (2026-04-13)
**Status:** Active

---

### D-2405 — WP-024 File Path Correction (Pre-Flight Finding)
**Decision:** WP-024 originally referenced `src/setup/buildDefaultHookDefinitions.ts`
and `src/setup/buildImplementationMap.ts`. These files do not exist. Both
`buildDefaultHookDefinitions` and `DEFAULT_IMPLEMENTATION_MAP` live in
`src/rules/ruleRuntime.impl.ts`. WP-024 and EC-024 corrected during pre-flight.
**Rationale:** The WP was written before the actual file structure was
finalized. Pre-flight verification against actual code caught the mismatch.
**Introduced:** WP-024 pre-flight (2026-04-13)
**Status:** Active

### D-2501 — Board Keywords Separate from Hero Ability Hooks
**Decision:** Board keywords (Patrol, Ambush, Guard) are a separate mechanism
from hero ability hooks. They are structural City rules that fire automatically
without player choice. They do not use the `HeroAbilityHook` system.
**Rationale:** Hero hooks require player choice and fire on specific timings
(`onPlay`, `onFight`, etc.). Board keywords are automatic, positional, and
modify City behavior (fight cost, access blocking, entry effects). Different
mechanism, different trigger model.
**Extension seam:** `BoardKeyword` union + `BOARD_KEYWORDS` canonical array.
Adding a new keyword = add to union + array + handler in
`boardKeywords.logic.ts` + integration point in fight/reveal.
**Affected WPs:** WP-025, WP-026+
**Immutability:** Locked — board keywords must remain separate from hero hooks.

### D-2502 — MVP Board Keyword Values
**Decision:** MVP keyword effects are fixed:
- Patrol: +1 fight cost (additive modifier)
- Ambush: each player gains 1 wound on City entry
- Guard: blocks `fightVillain` targeting of lower-index City cards
**Rationale:** These are simplified versions of the Legendary tabletop
keywords. Future WPs may parameterize effects per card (e.g., Patrol +2,
Ambush with different effects per card).
**Affected WPs:** WP-025
**Immutability:** MVP values may be extended by future WPs.

### D-2503 — Ambush Wound Gain is Inline (Not RuleEffect Pipeline)
**Decision:** Ambush wound gain calls `gainWound` directly in the reveal
pipeline (same pattern as escape wounds in `villainDeck.reveal.ts` lines
124-137). It does NOT route through the `RuleEffect` / `applyRuleEffects`
system because no `gainWound` RuleEffect type exists.
**Rationale:** D-2403 safe-skip pattern for effect type gaps. The handler
structure is complete; only the effect vocabulary is incomplete. Adding a
`gainWound` RuleEffect type would require modifying `ruleHooks.types.ts`
(WP-009A contract) which is out of scope.
**Affected WPs:** WP-025
**Immutability:** Interim — future WP may add `gainWound` to the RuleEffect
union and migrate Ambush to the pipeline.

### D-2504 — Board Keyword Data Availability (Safe-Skip)
**Decision:** Ambush is extractable from villain/henchman ability text
(`"Ambush:"` prefix, 304 occurrences across all 40 sets). Patrol and Guard
have no data source in current card data — Patrol in the data is a different
mechanic (Secret Wars Vol 2 location patrols), and Guard has zero occurrences.
**Resolution:** `buildCardKeywords` extracts Ambush from ability text. Patrol
and Guard produce empty results. All three mechanics are fully implemented
and tested with synthetic data. Patrol and Guard are dormant with real cards
until a future WP adds structured keyword classification or manual card mapping.
**Rationale:** WP-023 safe-skip precedent (D-2302). Mechanics are code-complete.
Data availability is a separate concern.
**Affected WPs:** WP-025, future keyword data WP
**Immutability:** Data gap status may change when card data is enhanced.

### D-2601 — Representation Before Execution (RBE) & Scheme Setup Separation
**Decision:** The game engine follows the Representation Before Execution (RBE)
pattern for all non-trivial gameplay logic and configuration effects. Under this
pattern: (1) all gameplay behavior is represented first as declarative, data-only
contracts (JSON-serializable); (2) execution logic operates solely on those
representations via deterministic evaluators or executors; (3) execution never
reads directly from upstream sources (registry, server, network, UI) at runtime —
all external resolution occurs at setup time; (4) data representations are stored
on `G` for observability, replay, and debugging.
**Scheme setup vs scheme twist (locked model):** Scheme behavior is divided into
two distinct mechanisms that MUST NOT be mixed. **Scheme setup** (WP-026) executes
once during the `setup` phase before the first turn, produces
`SchemeSetupInstruction[]` (data-only, JSON-serializable, deterministic), and
configures the board and persistent modifiers (City size rules, keyword overlays,
counters). Instructions are stored as `G.schemeSetupInstructions` for replay
observability. A deterministic executor applies these instructions to `G`. No
setup instruction logic is hard-coded per scheme. **Scheme twist** (WP-024)
executes reactively each time a scheme twist is revealed, uses rule execution
infrastructure (`HookDefinition`, effect pipelines), does NOT modify persistent
board configuration, and does NOT run during setup.
**MVP data reality:** The card registry does not provide structured scheme setup
metadata. For MVP: `buildSchemeSetupInstructions()` returns `[]` (empty array).
All instruction typing, ordering, execution, and safety behavior are implemented
and tested using synthetic instructions. No hard-coded scheme mappings are
permitted. A future WP may introduce structured registry metadata or an explicit
mapping layer — that change builds on this decision without refactoring the
execution model. This follows the established safe-skip pattern (D-2504, D-2302).
**Constraints:** Instruction representations are data-only (no functions,
closures, Maps, Sets, or class instances). Executors are pure functions
(deterministic). Unknown instruction types log a warning, skip, and never throw.
Setup instructions execute once and are never re-executed during moves. No
gameplay logic reads from the registry after setup. `SchemeSetupType` is a closed
union — new types require a new DECISIONS entry.
**Rationale:** This pattern ensures determinism and replayability, clear
separation of data from execution, testability (instruction execution tested
independently of data resolution), future-proofing against registry evolution,
and elimination of hard-coded scheme logic. Already proven effective in:
HookDefinition + execution maps (WP-009A/B), hero ability hooks (WP-021), hero
effect descriptors (WP-022). WP-026 formalizes and extends it to scheme setup.
**Affected WPs:** WP-009A, WP-021, WP-022, WP-024, WP-025, WP-026
**Immutability:** Locked — all future setup-time mechanics must follow RBE unless
explicitly exempted by a future DECISIONS entry. MVP data gap status may change
when registry metadata is enhanced.

### D-2602 — City Size Modification Deferred (Fixed Tuple MVP)
**Decision:** While `CityZone` is a fixed 5-tuple, the `modifyCitySize` scheme
setup instruction type logs a warning to `G.messages`, performs no mutation, and
returns `G` unchanged. The instruction type exists in the `SchemeSetupType` union
so the executor infrastructure is complete, but functional city resizing is
deferred until `CityZone` is converted from a fixed tuple to a dynamic array.
**Rationale:** Changing `CityZone` from `[CitySpace, CitySpace, CitySpace,
CitySpace, CitySpace]` to `CitySpace[]` would modify WP-015 contract
(`city.types.ts`) and require updating all consumers. This is out of scope for
WP-026 and requires its own WP with architectural review.
**Affected WPs:** WP-026, future City resize WP
**Immutability:** Interim — future WP may convert CityZone to dynamic and enable
`modifyCitySize` behavior.

### D-2603 — Scheme Setup Builder Location (src/setup/)
**Decision:** `buildSchemeSetupInstructions.ts` lives in
`packages/game-engine/src/setup/`, not `src/scheme/`. Scheme setup types and
executor live in `src/scheme/`.
**Rationale:** `02-CODE-CATEGORIES.md` maps setup-time builders to `src/setup/`.
The builder follows the same pattern as `buildCardKeywords.ts`,
`heroAbility.setup.ts`, and `economy.logic.ts` — it resolves registry data at
setup time into `G` fields. Types and executor are engine-layer pure code,
appropriately in `src/scheme/`.
**Affected WPs:** WP-026
**Immutability:** Locked — setup builders belong in `src/setup/`.

---

### D-5501 — Themes Are Data, Not Behavior
**Decision:** Themes are static JSON content in the registry layer. They describe
game composition (mastermind, scheme, villain groups, hero decks) but contain no
runtime logic, modifiers, or effects.
**Rationale:** Keeps themes engine-agnostic and prevents schema coupling to gameplay code.
**Affected WPs:** WP-055
**Immutability:** Permanent

---

### D-5502 — Theme Schema Is Engine-Agnostic (Registry Layer Only)
**Decision:** Theme schema (`ThemeDefinitionSchema`) lives in `packages/registry/`.
No engine imports. `setupIntent` mirrors `MatchSetupConfig` ID fields but excludes
count fields because themes describe content composition, not pile sizing.
**Rationale:** Registry layer boundary (ARCHITECTURE.md). Themes are content, not configuration.
**Affected WPs:** WP-055, WP-005A
**Immutability:** Permanent

---

### D-5503 — Theme IDs Are Immutable Once Published
**Decision:** Once a theme is committed with a `themeId`, that ID never changes.
Filename must always match `themeId`.
**Rationale:** Prevents broken references in UI, URLs, and cross-theme links.
**Affected WPs:** WP-055
**Immutability:** Permanent

---

### D-5504 — Schema Evolution Via Versioning Only
**Decision:** `themeSchemaVersion: 1` is a literal. Schema changes require a version bump,
never mutation of existing fields.
**Rationale:** Backwards compatibility for hundreds of theme files.
**Affected WPs:** WP-055
**Immutability:** Permanent

---

### D-5505 — External Comic References Are Editorial Only
**Decision:** URLs in `references.primaryStory` (Fandom, Comic Vine, Marvel Unlimited)
are editorial aids. They are never required at runtime, may rot without consequence,
and must never be treated as dependencies.
**Rationale:** External URLs are outside our control. Theme validity must not depend on third-party uptime.
**Affected WPs:** WP-055
**Immutability:** Permanent

---

### D-5506 — comicImageUrl Is Editorial, Not Hosted
**Decision:** `comicImageUrl` stores a URL reference to a Comic Vine cover image.
Images are hotlinked, not downloaded or stored in R2. The field is nullable
(`null` when no verified cover exists).
**Rationale:** Avoids copyright/redistribution concerns. Zero storage cost. URLs may
rot and are replaced by re-running the fetcher tool.
**Affected WPs:** WP-055
**Immutability:** Field exists; hosting policy may evolve.

---

### D-5507 — Referential Integrity Validation Deferred
**Decision:** v1 validates schema shape only. Verifying that `setupIntent` IDs
actually exist in the card registry is deferred to a theme loader WP.
**Rationale:** Integrity checking requires registry access at validation time,
which crosses layer concerns for a static schema package.
**Affected WPs:** WP-055, future theme loader WP
**Immutability:** Temporary — will be addressed when themes are consumed at runtime.

---

### D-5508 — PAR Difficulty Rating Excluded From v1
**Decision:** `parDifficultyRating` is intentionally absent from `ThemeDefinitionSchema` v1.
**Rationale:** PAR scoring system does not exist yet (WP-048).
**Affected WPs:** WP-055, WP-048
**Immutability:** Temporary — field will be added when PAR system is implemented.

---

### D-5509 — Theme Schema v2: Music Fields Added Via Version Bump
**Decision:** `themeSchemaVersion` bumped from `1` to `2`. V2 adds three optional
top-level fields (`musicTheme`, `musicAIPrompt`, `musicAssets`) and one new
sub-schema (`ThemeMusicAssetsSchema`) with eight optional URL fields
(`previewIntroUrl`, `matchStartUrl`, `ambientLoopUrl`, `mainThemeUrl`,
`schemeTwistUrl`, `masterStrikeUrl`, `villainAmbushUrl`, `bystanderUrl`).
All 68 authored themes in `content/themes/` migrated to v2 on 2026-04-19.
**Rationale:** D-5504 requires a version bump for any schema change, including
additive-only ones. The music fields are the first such bump. Keeping v1 with
additive changes was rejected to preserve the immutability rule in D-5504 and
give consumers an unambiguous signal that the schema grew. This decision also
supersedes the 2026-04-12 design-review note in WP-055 that exempted editorial
fields from versioning; that exemption is grandfathered, not precedent.
**Affected WPs:** WP-055
**Immutability:** Permanent — v1 is retired, v2 is the authoring target. Any
future additions will require a v3 bump.

---

### D-2701 — Canonical State Hashing: Sorted-Key JSON + djb2

**Decision:** `computeStateHash` uses `JSON.stringify` with a sorted-key
replacer function and the djb2 string hash algorithm. No crypto dependency.
**Rationale:** Canonical serialization (sorted keys at every nesting level)
ensures the same `G` always produces the same hash regardless of JavaScript
property insertion order. djb2 is a simple, well-known, deterministic hash
suitable for equality comparison. Cryptographic security is not required —
this is for replay determinism verification, not tamper detection.
**Introduced:** WP-027
**Status:** Immutable

---

### D-2702 — Replay Harness Uses makeMockCtx, Not boardgame.io/testing

**Decision:** The replay harness constructs setup contexts via `makeMockCtx`
(or equivalent deterministic mock) and never imports `boardgame.io/testing`.
**Rationale:** `boardgame.io/testing` couples the harness to framework
internals. `makeMockCtx` provides a deterministic reverse-shuffle that proves
the shuffle path executed without framework dependency. This matches the
established testing pattern from WP-005B onward.
**Introduced:** WP-027
**Status:** Immutable

---

### D-2703 — ReplayInput Is Class 2 (Configuration) Data

**Decision:** `ReplayInput` (seed, setupConfig, playerOrder, moves) is
Class 2 data — safe to persist and transfer. The replayed `G` is Class 1
(Runtime) — never persisted.
**Rationale:** `ReplayInput` is a deterministic input contract. Given the
same `ReplayInput`, the engine must always produce the same final state.
Persisting `ReplayInput` enables match replay, debugging, and QA without
storing runtime state.
**Introduced:** WP-027
**Status:** Immutable

---

### D-2704 — MVP Replay Uses Deterministic Mock Shuffle, Not Seed-Faithful Replay

**Decision:** MVP replay uses `makeMockCtx`'s reverse-shuffle for all
shuffling operations. The `seed` field in `ReplayInput` is stored but not
used for actual PRNG seeding at MVP.
**Rationale:** The MVP goal is to prove the replay mechanism works (identical
inputs produce identical outputs). Seed-faithful replay (matching live game
shuffles) requires integration with boardgame.io's seeded PRNG, which is a
future WP. The `seed` field is included in the contract now so the API is
stable when seed-fidelity is added later.
**Introduced:** WP-027
**Status:** Temporary — seed-faithful replay will be implemented in a future WP

---

### D-2705 — advanceStage Replicated via advanceTurnStage in Replay

**Decision:** The replay harness does not import `advanceStage` from
`game.ts` (it is a local non-exported function). Instead, the replay
`MOVE_MAP` entry for `'advanceStage'` calls `advanceTurnStage` from
`turnLoop.ts` directly with equivalent context.
**Rationale:** `advanceStage` in `game.ts` is a thin wrapper around
`advanceTurnStage`. Importing `game.ts` would transitively import
`boardgame.io`, violating the replay harness guardrail. The reconstruction
is functionally equivalent.
**Introduced:** WP-027
**Status:** Immutable

---

### D-2706 — Replay Directory Classified as Engine Code Category

**Decision:** `packages/game-engine/src/replay/` is classified under the
`engine` code category.
**Rationale:** Replay files are pure, deterministic, have no I/O, and do
not import `boardgame.io` directly. They follow all engine category rules.
The replay directory extends the engine's verification capability without
introducing new categories or blurring existing boundaries.
**Introduced:** WP-027
**Status:** Immutable

---

### D-2801 — UI Projection Directory Classified as Engine Code Category

**Decision:** `packages/game-engine/src/ui/` is classified under the
`engine` code category.
**Rationale:** UI projection files are pure, deterministic, have no I/O, and
do not import `boardgame.io` or registry packages. They derive UIState from
G and ctx without mutation. They follow all engine category rules.
**Introduced:** WP-028
**Status:** Immutable

---

### D-2802 — Zone Projection Strategy (Counts, Not Card Arrays)

**Decision:** Player zones in UIState are projected as integer counts
(`deckCount`, `handCount`, etc.), not as `CardExtId[]` arrays.
**Rationale:** Zone counts prevent the UI from accessing card identities it
should not see (other players' hands, decks). Card display resolution is a
separate concern — the UI calls the registry independently for display
names, images, and ability text using ext_ids from city/HQ projections.
**Introduced:** WP-028
**Status:** Immutable

---

### D-2803 — UIState Hides Engine Internals

**Decision:** UIState must not expose or reference, directly or indirectly:
`hookRegistry`, `ImplementationMap`, `cardStats`, `heroAbilityHooks`,
`villainDeckCardTypes`, `schemeSetupInstructions`, registry objects, or
setup builder functions.
**Rationale:** Engine internals are implementation details that would cause
logic leakage if exposed to the UI. The UI should depend only on
display-safe projections, not on how the engine stores or computes state.
This maintains the Layer Boundary defined in ARCHITECTURE.md.
**Introduced:** WP-028
**Status:** Immutable

---

### D-2804 — Card Display Resolution Is a Separate UI Concern

**Decision:** `buildUIState` exposes card ext_ids only (in city spaces and
HQ slots). The UI calls the registry independently for display names,
images, and ability text. `buildUIState` does not import the registry.
**Rationale:** Separating display resolution from state projection keeps
`buildUIState` pure and free of registry dependencies. The engine layer
(where `buildUIState` lives) must not import the registry package. Display
data changes (new images, updated text) do not require engine changes.
**Introduced:** WP-028
**Status:** Immutable

---

## Change Management

### D-2901 — Audience Filter Operates on UIState, Not G

**Decision:** `filterUIStateForAudience` is a pure post-processing function
that accepts `UIState` (from `buildUIState`) as input. It never accesses G,
ctx, or engine internals. All audiences see the same game truth with only
visibility differences.

**Rationale:** The filter is a projection-layer concern implementing D-0302
(Single UIState, Multiple Audiences). Operating on UIState (not G) ensures
the filter cannot accidentally leak engine internals, mutate game state, or
create alternate game states. The filter is a consumer of the UI projection
layer, not a participant in gameplay.

**Affected WPs:** WP-029, future UI/server WPs that consume filtered views.

---

### D-2902 — Hand Visibility Approach (handCards Optional Field)

**Decision:** `UIPlayerState.handCards?: string[]` is optional. `buildUIState`
always populates it (spread copy from `zones.hand`). `filterUIStateForAudience`
redacts it (omits the field) for non-owning audiences and spectators. The
active player sees their own hand ext_ids; all others see `handCount` only.

**Rationale:** The filter operates on UIState, not G. For the active player
to see hand card ext_ids, `buildUIState` must include them. Making the field
optional allows the filter to cleanly remove it for non-owning audiences
without introducing `null` semantics. The spread copy in `buildUIState`
prevents aliasing with G.playerZones.hand.

**Affected WPs:** WP-029. Future WPs consuming UIState should check
`handCards` presence rather than assuming it exists.

---

### D-2903 — Economy Visibility (Zeroed for Non-Active and Spectators)

**Decision:** Turn economy is zeroed (all fields set to 0) for non-active
players and spectators. Only the active player (whose turn it is) sees
economy values (attack, recruit, availableAttack, availableRecruit).

**Rationale:** The turn economy reveals the active player's remaining
resources, which is strategic information. Non-active players and spectators
should not know how much attack/recruit the active player has available.
Zeroing maintains type stability (no optional fields on UITurnEconomyState).

**Affected WPs:** WP-029. Future WPs may adjust visibility rules (e.g.,
showing spent totals to spectators) by modifying the filter.

---

### D-3001 — Campaign Directory Classified as Engine Code Category

**Decision:** `packages/game-engine/src/campaign/` is classified under the
`engine` code category.
**Rationale:** Campaign files are pure, deterministic, have no I/O, and do
not import `boardgame.io` or registry packages. They define data-only
contracts (`ScenarioDefinition`, `CampaignDefinition`, `CampaignState`) and
pure helper functions (`applyScenarioOverrides`, `evaluateScenarioOutcome`,
`advanceCampaignState`) that operate on `MatchSetupConfig` and
`EndgameResult` without mutating `G`. They follow all engine category rules.
The campaign directory extends the engine's meta-orchestration capability
without introducing new categories or blurring existing boundaries. This
follows the precedent established by D-2706 (replay) and D-2801 (ui) for
new engine subdirectories that host pure, non-lifecycle code. Campaign
state remains external to `LegendaryGameState` per D-0502 — directory
classification is orthogonal to the persistence-class separation.
**Introduced:** WP-030
**Status:** Immutable

---

### D-3002 — Campaign State External to G (MVP Implementation)

**Decision:** `CampaignState` is stored, mutated, and persisted entirely
by the application layer. It is never a field of `LegendaryGameState`,
never part of `G`, and never read or written by the game engine.
Individual game `G` remains Class 1 (Runtime) and is never persisted.
`CampaignState` is Class 2 (Configuration) and is persisted separately
by the application layer.

**Rationale:** Implements D-0502 (Campaign State Lives Outside the
Engine) at the code level. Keeps individual games pure and replayable:
because `G` is unchanged by campaign progression, replaying any single
scenario reproduces an identical game state regardless of which campaign
it belongs to. Concretely, this means the engine's snapshot,
deterministic-replay, and persistence semantics are unaffected by the
introduction of campaigns. A bug in campaign progression cannot corrupt
a game's `G`, and a bug in the engine cannot corrupt a campaign's
progression.

**Affected WPs:** WP-030 introduced the contract. Future WPs that add
campaign persistence, branching logic, or UI must continue to hold
`CampaignState` outside the engine.

**Introduced:** WP-030
**Status:** Immutable

---

### D-3003 — Scenarios Produce MatchSetupConfig, Not Modified G

**Decision:** `applyScenarioOverrides(baseConfig, scenario)` produces a
valid `MatchSetupConfig` that is passed to `Game.setup()` by the
application layer. The engine receives a normal config and runs a
normal deterministic game. The engine never knows a game is part of a
campaign. Scenario overrides use replace-on-override semantics: any
field present in `scenario.setupOverrides` replaces the corresponding
base field wholesale, and all array fields in the result are spread
copies so callers cannot alias the input via the return value.

**Rationale:** Implements D-0501 (Campaigns Are Meta-Orchestration
Only) at the code level. Preserves engine simplicity and replay safety
— the same replay input (seed, config, moves) always produces the same
game state whether or not the game was played as part of a campaign.
Replace-on-override was chosen over deep-merge because (a) it matches
`Partial<MatchSetupConfig>` semantics, (b) it is unambiguous in the
presence of array fields (append-vs-replace designer confusion is
eliminated), and (c) it is trivially testable. Spread-copy discipline
prevents mutable references from leaking between `baseConfig`,
`scenario.setupOverrides`, and the returned config.

**Affected WPs:** WP-030. Future WPs that introduce additional override
semantics (e.g., per-scheme count adjustments) must either extend
`MatchSetupConfig` fields or define new override types — the engine
contract is not modified.

**Introduced:** WP-030
**Status:** Immutable

---

### D-3004 — Campaign Replay as Sequence of ReplayInputs

**Decision:** Campaign-level replay is the ordered concatenation of
each scenario's `ReplayInput` object (WP-027). There is no campaign-
level replay format. Each scenario's game is independently replayable
and produces the same `EndgameResult` deterministically. The
application layer reconstructs campaign progression by replaying each
scenario in order and feeding the results through `advanceCampaignState`
to rebuild `CampaignState`.

**Rationale:** Preserves the engine's replay guarantees (D-0201, D-0002)
without introducing a second replay format. Debugging a campaign bug
becomes a two-step process: (1) replay the individual scenario game to
reproduce its `EndgameResult`, (2) replay the sequence of
`advanceCampaignState` calls to reproduce the `CampaignState` drift.
Each step is independently debuggable and each step is already proven
deterministic. No new replay infrastructure is needed.

**Affected WPs:** WP-030. Future WPs that add branching logic must
record any branch decisions deterministically (e.g., as additional
`ScenarioReward` entries in the replay history) so that replaying the
same inputs always reconstructs the same branch path.

**Introduced:** WP-030
**Status:** Immutable

---

### D-3101 — Invariants Directory Classified as Engine Code Category

**Decision:** `packages/game-engine/src/invariants/` is classified under
the `engine` code category.

**Rationale:** Invariant files are pure, deterministic, have no I/O, and
do not import `boardgame.io` or registry packages. They define data-only
contracts (`InvariantCategory`, `InvariantViolation`,
`InvariantCheckContext`) and a throwing assertion utility
(`assertInvariant`) with a companion `InvariantViolationError` class.
The check functions (`structural.checks`, `gameRules.checks`,
`determinism.checks`, `lifecycle.checks`) and the orchestrator
(`runAllInvariantChecks`) read `G` and either call `assertInvariant`
or return `void` — they never mutate `G`, never read external inputs,
and never query the registry. They follow all engine category rules.

The invariants directory extends the engine's correctness-guarantee
capability without introducing new categories or blurring existing
boundaries. Runtime wiring of `runAllInvariantChecks` into `game.ts`
is permitted because `game.ts` is the framework-boundary file that
already imports `boardgame.io` — the wiring site, not the invariant
files themselves, is where `Ctx` fields are read and passed into the
local structural `InvariantCheckContext` interface (see D-2801
`UIBuildContext` precedent for the pattern).

This follows the precedent established by D-2706 (replay),
D-2801 (ui), and D-3001 (campaign) for new engine subdirectories
that host pure, non-lifecycle code. The classification is orthogonal
to the throwing-convention exception: `assertInvariant` throws at
setup time under the existing `Game.setup() may throw` rule
(`.claude/rules/game-engine.md §Throwing Convention`), not as a new
exception.

**Affected WPs:** WP-031 introduces the directory. Future WPs that
add additional invariant check files, extend the `InvariantCategory`
union, or wire invariant checks into additional lifecycle points
(e.g., per-move checks under a follow-up of D-3102) must continue to
host them under `src/invariants/` and obey the engine category rules.

**Introduced:** WP-031
**Status:** Immutable

---

### D-3102 — Runtime Invariant Check Wiring Scope (Setup-Only at MVP)

**Decision:** `runAllInvariantChecks` is wired into the engine runtime
at exactly **one** point for the WP-031 MVP: the return path of
`Game.setup()` in `packages/game-engine/src/game.ts`. Per-move
wiring is **deferred** to a follow-up WP. The four implemented
invariant categories (structural, gameRules, determinism, lifecycle)
fire once per match, immediately after `buildInitialGameState`
produces the initial `G`.

Gameplay conditions (insufficient attack, empty wounds pile, no
valid target, stage gate blocked) remain **safe no-ops at move
return** per D-0102 clarification. They are NOT invariant violations
and are NOT checked by the invariant pipeline. Move functions
continue to follow the "validate args → check stage gate → mutate
G → return void" contract with no changes.

**Rationale:** Three alternatives were considered during WP-031
pre-flight:

- **Option A — per-move wiring, production-on:** wrap every entry
  in `LegendaryGame.moves` with `withInvariantChecks`. Highest
  correctness coverage, but would run invariant checks on every
  move across the 348-test baseline. Any existing test that
  constructs a handcrafted partial `G` and flows it through a
  move could break. High ripple risk, uncertain remediation cost.

- **Option B — setup-only wiring (this decision):** wire
  `runAllInvariantChecks` only at the `Game.setup()` return. The
  setup path is the highest-value single observation point for
  MVP invariants — every WP-001 through WP-026 construction step
  converges there, and a single successful check after setup
  validates the entire deterministic build pipeline. Tests 9 and
  10 (WP-031 §K) prove gameplay-condition non-violation via
  direct unit calls to the check functions, so per-move runtime
  wiring is not required for EC satisfaction. **Chosen.**

- **Option C — dev/test-gated per-move wiring:** gate Option A
  behind `process.env.NODE_ENV !== 'production'` or an
  `ENABLE_RUNTIME_INVARIANTS` module flag. Rejected because it
  introduces environment coupling into `game.ts`, which conflicts
  with the engine's environment-independence principle. The
  engine should not read `process.env`; it should be configurable
  from the server layer or not at all.

Option B preserves the existing 348-test baseline, keeps the engine
environment-independent, satisfies the WP-031 Definition of Done
(runtime wiring exists, gameplay conditions excluded), and leaves
a clean extension seam for a future WP to re-evaluate per-move
wiring once the performance-vs-coverage trade-off is measured
against real move throughput.

The follow-up WP that adds per-move wiring (if and when it is
scheduled) must introduce a new throwing-convention exception for
"`assertInvariant` inside a move is permitted because structural
corruption must not be silently ignored". That exception is NOT
introduced by WP-031 — under Option B, `assertInvariant` is only
called from the setup return path, which is already covered by the
existing `Game.setup() may throw` rule in
`.claude/rules/game-engine.md §Throwing Convention`.

**Affected WPs:** WP-031 implements setup-only wiring. A future
follow-up WP may expand wiring into the move lifecycle under a new
decision that supersedes this one for the move-wiring scope
specifically; the setup-only portion remains Immutable regardless.

**Introduced:** WP-031
**Status:** Immutable

---

### D-3103 — Card Uniqueness Invariant Scope (Fungible Token Exclusion)

**Decision:** The `checkNoCardInMultipleZones` invariant in WP-031
§D scans for cross-zone duplication of **non-fungible** CardExtIds
only. Six well-known CardExtId strings are classified as **fungible
tokens** and are excluded from the dedup scan entirely. Their
legitimate duplication across zones is structurally normal and must
not fire the invariant.

The locked fungible set (drawn from existing setup-layer public
constants, no new constants introduced):

| Constant | Value | Owner |
|---|---|---|
| `SHIELD_AGENT_EXT_ID`   | `'starting-shield-agent'`    | `buildInitialGameState.ts` |
| `SHIELD_TROOPER_EXT_ID` | `'starting-shield-trooper'`  | `buildInitialGameState.ts` |
| `BYSTANDER_EXT_ID`      | `'pile-bystander'`           | `pilesInit.ts`             |
| `WOUND_EXT_ID`          | `'pile-wound'`               | `pilesInit.ts`             |
| `SHIELD_OFFICER_EXT_ID` | `'pile-shield-officer'`      | `pilesInit.ts`             |
| `SIDEKICK_EXT_ID`       | `'pile-sidekick'`            | `pilesInit.ts`             |

All other CardExtIds — villain cards (from `listCards()` keys in the
format `{setAbbr}-villain-{groupSlug}-{cardSlug}`), henchmen
(`henchman-{groupSlug}-{NN}`), scheme twists
(`scheme-twist-{schemeSlug}-{NN}`), virtual bystanders
(`bystander-villain-deck-{NN}`), mastermind strikes and tactics
(`{setAbbr}-mastermind-{slug}-{cardSlug}`), and any future hero-deck
instance IDs — are treated as **per-instance unique**. If any of
these strings appear in two distinct zones simultaneously, the
invariant fires and `assertInvariant` throws with category
`'gameRules'`.

**Rationale:** CardExtIds in the Legendary Arena engine are card-
**type** identifiers, not per-instance identifiers. The MVP engine
makes a deliberate space-vs-precision trade-off for fungible game
components (agents, troopers, pile tokens): all copies of a token
share a single string ID, and `G.piles.bystanders` is an array of
30 identical `'pile-bystander'` entries. This keeps setup code
simple, snapshot state compact, and registry-loader concerns out of
the pile-builder code path.

The correctness cost of this trade-off is that a literal
"no CardExtId appears in more than one zone" invariant cannot be
implemented for these six strings — every valid `G` produced by
`buildInitialGameState` contains legitimate duplication inside the
piles and starting decks. A mid-execution discovery during WP-031
(2026-04-15) surfaced this conflict: running the literal check on
the initial state would throw `InvariantViolationError` and break
every existing test that routes through `LegendaryGame.setup()`,
regressing the 348-test baseline that WP-031 was required to
preserve.

Three alternatives were considered:

- **Option 1 — Fungible-exclusion cross-zone check (this decision):**
  The check skips the six fungible tokens entirely. For all other
  CardExtIds, it detects cross-zone duplication (same ID, two
  distinct zone names). Narrower correctness coverage than a literal
  "no duplicate ever" check, but sound against the current engine
  state. Chosen.

- **Option 2 — Drop the check entirely from WP-031:** defer the
  invariant to a follow-up WP. Rejected because it removes
  correctness coverage WP-031 was scoped to deliver, and because
  cross-zone non-fungible duplication is a real bug class (e.g., a
  move that reveals a villain into the city without removing it
  from `G.villainDeck.deck`) that the amended check does catch.

- **Option 3 — Refactor fungible tokens to per-instance unique
  CardExtIds** (e.g., `'starting-shield-agent-00'`,
  `'starting-shield-agent-01'`, …, `'pile-bystander-0000'`, …):
  would enable the literal check but requires rewriting
  `buildStartingDeckCards`, `createPileCards`, every zoneOp that
  references starting-card strings, every test fixture that
  hardcodes token IDs, and inflates snapshot state by ~10× on the
  bystanders / wounds / officers piles. Massively out of scope for
  a production-hardening WP. Deferred to a hypothetical future WP
  that explicitly decides the per-instance trade-off.

Option 1 is the correct choice for WP-031 because it preserves the
348-test baseline, delivers the non-fungible cross-zone coverage
that was the check's original intent, and leaves a clean extension
seam: a future WP that chooses Option 3 can replace the amended
check with a literal one without touching the fungible set (which
will be empty after the refactor).

**Trade-off acknowledgement:** The amended check does NOT detect:

- Duplication of a fungible token across two zones that should not
  both hold it (e.g., a bug that copies a `'pile-wound'` out of
  `G.piles.wounds` into `G.playerZones[0].hand` without removing it
  from the pile — both are legitimate locations for wound tokens in
  isolation, so the check cannot distinguish the bug from normal
  state). Such bugs must be caught by test fixtures or a future
  per-instance refactor.
- Duplication of a non-fungible CardExtId **within the same zone**
  (the amended check uses a zone-name key, so two identical non-
  fungible IDs inside `G.villainDeck.deck` would currently be
  allowed). A "no duplicates within one zone" check is a separate
  invariant and is deferred. For the MVP, villain/henchman/tactic
  construction pipelines are deterministic and do not emit
  intra-zone duplicates in practice.
- Security/Visibility leakage (category is reserved in the union;
  no checks are implemented in WP-031 per its §Out of Scope).

These gaps are intentional and documented so that a future
correctness audit does not treat the amended check as a complete
card-tracking invariant.

**Affected WPs:** WP-031 implements the amended check. A future WP
that introduces per-instance unique CardExtIds (refactoring
`buildStartingDeckCards` and `createPileCards`) supersedes this
decision for the fungible-exclusion portion — the check can then
be widened to literal cross-zone dedup without a fungible filter.
The Option 1 scope described here remains the authoritative WP-031
implementation contract regardless of future refactors.

**Introduced:** WP-031 (mid-execution, 2026-04-15)
**Status:** Immutable

---

### D-3202 — Intent Validation Is Engine-Side, Not Server-Side

**Decision:** All intent validation logic (`validateIntent`,
`detectDesync`) lives in `packages/game-engine/src/network/`, not in
`apps/server/`. The server layer wires transport; the engine validates
intents.

**Rationale:** The engine owns truth (D-0101). Intent validation must be
transport-agnostic — it works identically whether the transport is
boardgame.io's WebSocket, HTTP polling, or a future alternative. Placing
validation in the engine ensures it is covered by the engine test suite,
deterministic, and replayable. The server is a wiring layer only
(ARCHITECTURE.md §Layer Boundary) and must not implement game logic.

**Affected WPs:** WP-032 introduces the validation. Future WPs that wire
intent validation into the server transport must call `validateIntent`
from the server layer without modifying its implementation.

**Introduced:** WP-032
**Status:** Immutable

---

### D-3203 — Intent Validation Adds to boardgame.io Turn Order, Not Replaces

**Decision:** `validateIntent` is additive validation on top of
boardgame.io's built-in turn order enforcement. It does not replace or
bypass the framework's player turn validation.

**Rationale:** boardgame.io already enforces that only the current player
can submit moves. `validateIntent` adds intent-level checks that
boardgame.io does not provide: turn number verification (stale/replayed
intents), move name validation against the injected list, structural
args checking, and desync detection. The two layers are complementary:
boardgame.io enforces framework-level constraints; `validateIntent`
enforces application-level intent contracts.

**Affected WPs:** WP-032 establishes the relationship. Future WPs that
modify the move registry or add transport features must maintain both
validation layers.

**Introduced:** WP-032
**Status:** Immutable

---

### D-3201 — Network Directory Classified as Engine Code Category

**Decision:** `packages/game-engine/src/network/` is classified under
the `engine` code category.

**Rationale:** Network validation files are pure, deterministic, have no
I/O, and do not import `boardgame.io` or registry packages. They define
data-only contracts (`ClientTurnIntent`, `IntentValidationResult`,
`IntentRejectionCode`) and pure validation functions (`validateIntent`,
`detectDesync`) that read game state without mutation. All files in this
directory follow all engine-category rules defined in
`docs/ai/REFERENCE/02-CODE-CATEGORIES.md` and
`.claude/rules/game-engine.md`:

- No `boardgame.io` imports (uses local structural interface for ctx)
- No registry imports
- No I/O, no network, no database access
- No `.reduce()` in validation logic
- No `Math.random()` or nondeterminism
- No functions stored in game state
- Validation never throws — returns structured results only
- All exports are pure functions or data-only types

This follows the established directory classification pattern from
D-2706 (`src/replay/`), D-2801 (`src/ui/`), D-3001 (`src/campaign/`),
and D-3101 (`src/invariants/`).

**Affected WPs:** WP-032 introduces the directory. Future WPs that add
network-layer contracts (reconnection protocol, rate limiting, transport
adapters) must host transport-agnostic validation code under
`src/network/` and obey the engine category rules. Server-specific
networking code (WebSocket handlers, HTTP endpoints) belongs in
`apps/server/`, not `src/network/`.

**Introduced:** WP-032
**Status:** Immutable

---

### D-3301 — Content Directory Classified as Engine Code Category

**Decision:** `packages/game-engine/src/content/` is classified under
the `engine` code category.

**Rationale:** Content validation files are pure, deterministic, have no
I/O, and do not import `boardgame.io` or registry packages. They define
declarative author-facing schemas (`content.schemas.ts`) and pure
validation functions (`validateContent`, `validateContentBatch`) that
produce structured results without mutation. All files in this directory
follow all engine-category rules defined in
`docs/ai/REFERENCE/02-CODE-CATEGORIES.md` and
`.claude/rules/game-engine.md`:

- No `boardgame.io` imports
- No registry imports (hero classes re-declared locally per WP-033 RS-9 lock)
- No I/O, no network, no database access
- No `.reduce()` in validation logic
- No `Math.random()` or nondeterminism
- No functions stored in schemas or game state
- Validation never throws — returns structured results only
- All exports are pure functions or data-only types

This follows the established directory classification pattern from
D-2706 (`src/replay/`), D-2801 (`src/ui/`), D-3001 (`src/campaign/`),
D-3101 (`src/invariants/`), and D-3201 (`src/network/`).

**Affected WPs:** WP-033 introduces the directory. Future WPs that add
content-authoring schemas or validators (e.g., campaign-level content
schemas, balance-check toolkits) must host them under `src/content/` and
obey the engine category rules.

**Introduced:** WP-033
**Status:** Immutable

---

### D-3302 — Henchman Author-Facing Schema Mirrors VillainCard Shape

**Decision:** The WP-033 author-facing henchman schema mirrors the
required-field shape of the registry's `VillainCardSchema` (name, slug,
vp, vAttack, abilities), not a bespoke henchman shape.

**Rationale:** The registry currently declares `henchmen:
z.array(z.unknown())` — henchmen have no typed registry schema and no
individual card entries. Per D-1410 through D-1413, henchmen are virtual
cards that exist only in `G` with ext_id format `henchman-{slug}-{NN}`;
authoring data for new henchmen is undocumented. Rather than invent an
untethered henchman shape (which would risk the same false-gating
failure mode resolved in WP-026 / D-2601), the author-facing henchman
schema reuses the nearest registry analog (`VillainCardSchema`) as a
conservative starting point. This follows the WP-026 / WP-025
safe-extension pattern: use the closest established shape until a
dedicated authoring spec exists.

Engine-category rules apply:

- The henchman schema is a declarative shape in
  `packages/game-engine/src/content/content.schemas.ts` (no runtime code)
- No import from `packages/registry/src/schema.ts`; the field list is
  re-declared locally (same approach as `HERO_CLASSES` per WP-033 RS-9)
- Validation failures produce `ContentValidationError` entries with
  full-sentence messages per Rule 11

**Affected WPs:** WP-033 introduces the henchman schema. A future WP
that defines a dedicated henchman authoring spec (separate required
fields, henchman-specific enums) may supersede this decision with an
explicit update. Until that WP exists, the VillainCard-mirroring shape
is canonical.

**Introduced:** WP-033
**Status:** Immutable until superseded by a dedicated henchman
authoring WP

---

### D-3303 — Content Validation Is Author-Facing and Separate from Registry Zod Schemas

**Decision:** The WP-033 content validation toolkit
(`packages/game-engine/src/content/`) is a **pre-engine gate** that
validates *new, author-authored content* against stricter, declarative
descriptor schemas. It is deliberately separate from the registry's
Zod schemas (`packages/registry/src/schema.ts`) and does not replace
or extend them.

**Rationale:** The two validation layers answer different questions
and cannot be merged without losing information:

- **Registry Zod schemas** validate *existing loaded data*, which
  contains documented historical quirks (D-1204 / D-1227 — e.g.,
  `anni` cards with only `slug` + `imageUrl`, `amwp` Wasp with
  `cost: "2*"`, `mgtg` MCU Guardians masterminds with `vp: null`).
  The registry must be permissive; otherwise forty sets of shipped
  data would fail to load.
- **Content validation** (WP-033) validates *new content an author is
  writing*. Authors must supply fields the registry treats as
  optional — otherwise authoring typos silently reach runtime as
  structurally valid but game-mechanically broken content. Stricter
  required-field lists are the author's safety net.

Semantic checks go beyond structural shape:

1. **Structural** — required fields present, correct types, non-empty
   strings, finite numbers, arrays where expected.
2. **Enum** — values belong to canonical closed unions (`HERO_KEYWORDS`,
   `BOARD_KEYWORDS`, `HERO_ABILITY_TIMINGS`, `SCHEME_SETUP_TYPES`,
   local `HERO_CLASSES`). Strict accept-list for `contentType` itself
   (copilot RISK #10 / #21 resolution).
2a. **Mastermind tactic presence** — at least one `cards[].tactic ===
    true` entry; missing tactics make a mastermind unplayable.
3. **Cross-reference** — caller-injected `ContentValidationContext`
   supplies sets of known slugs; `alwaysLeads` membership is checked
   against `validVillainGroupSlugs`. Absent sets skip that specific
   check silently (opt-out, not failure). Pattern mirrors WP-032's
   `validMoveNames` injection (D-2801 local structural interface
   precedent).
4. **Hook consistency** — hero ability hook `timing` and `keywords`
   are checked against the WP-021 canonical unions, catching drift
   at authoring time before the hook silently fails to fire.

Canonical-keyword-union reference pattern: schemas declare enum
references by name (not by value list) in `ContentSchemaDescriptor`;
the validator dereferences them against the engine-side canonical
arrays at call time. This guarantees a single source of truth per
keyword family — adding a new `HERO_KEYWORDS` entry automatically
enlarges the valid set without touching the content validator. The
engine category cannot import from the registry package (D-3301), so
`HERO_CLASSES` is locally re-declared rather than imported from
`HeroClassSchema` (RS-9).

Lifecycle isolation: `validateContent` and `validateContentBatch` are
NOT part of the boardgame.io lifecycle. They MUST NOT be called from
`game.ts`, move functions, phase hooks, setup-time builders, or rule
hook executors. They are consumed exclusively by content-authoring
tools and the WP-033 test suite. This preserves the "engine owns
truth" architectural principle — authorially valid content is a
prerequisite to engine consumption, not a runtime concern.

**Affected WPs:** WP-033 introduces the toolkit. Future content
authoring WPs (hero, villain, mastermind authoring specs) will
tighten per-type schemas but must respect the same layer boundary:
no registry import, no boardgame.io import, no `G` mutation, no
`throw`.

**Introduced:** WP-033
**Status:** Immutable until a superseding architecture decision

---

### D-6501 — Shared Tooling classification for packages/vue-sfc-loader/
**Decision:** The new package at `packages/vue-sfc-loader/` is classified as Shared Tooling and belongs to the Shared Tooling category in `docs/ai/REFERENCE/02-CODE-CATEGORIES.md`.  
**Rationale:** This package provides internal test-tooling for Vue SFC compilation and loader registration; it is not part of runtime game engine logic, server persistence, registry data input, or end-user documentation. Classifying it as Shared Tooling ensures its imports and behavior are governed by the layer-boundary rules in `docs/ai/ARCHITECTURE.md §Layer Boundary` rather than the broader `infra` or `docs` categories.  
**Alternatives rejected:** classifying it as `infra` would be too broad and would not distinguish executable shared tooling from one-off scripts; classifying it as `docs` would mischaracterize package code as non-executable governance material; classifying it under `server`, `engine`, or `data-input` would violate the package's tooling-only nature and layer import rules.  
**Introduced:** PS-1 / WP-065  
**Status:** Active

---

### D-6502 — Vue version pinning via peerDependencies
**Decision:** `packages/vue-sfc-loader/package.json` pins both `vue` and `@vue/compiler-sfc` to `^3.4.27` under `peerDependencies`, mirrored (at the same pin) under `devDependencies`. Vue is never added to `dependencies`.
**Rationale:** pnpm will install a second copy of Vue into a package's own `node_modules` when `vue` appears under `dependencies`. `@vue/test-utils`' `mount()` uses component identity and `instanceof` checks that silently fail when two Vue copies coexist. Pinning `vue` and `@vue/compiler-sfc` together prevents template-compilation drift — `@vue/compiler-sfc` ships in lockstep with `vue`, and a version mismatch corrupts compiled render functions without surfacing an error. The pin matches `apps/registry-viewer/package.json:15`.
**Alternatives rejected:** direct `dependencies` entry (causes pnpm dual-install, breaks mount); installing Vue only in `apps/*` (package tests cannot resolve Vue); leaving `@vue/compiler-sfc` unpinned while pinning `vue` (silent template-compilation drift).
**Introduced:** WP-065
**Status:** Active

---

### D-6503 — apps/registry-viewer/ prior-shim disposition: none found
**Decision:** `apps/registry-viewer/` had no prior SFC test shim at WP-065 execution time. No `.test.*` files, no custom loader hook, no `register.mjs`. `vue-sfc-loader` is therefore the first `.vue` test transform in the repo, not a consolidation.
**Rationale:** The Preflight "viewer precedent" item required an explicit finding in DECISIONS.md so that future maintainers can distinguish "greenfield transform" from "consolidation". Greenfield status means no apps/registry-viewer/** edits are in this WP's scope.
**Alternatives rejected:** silently leaving two transforms in place (would violate WP-065 scope); expanding WP-065 to cover shim removal (scope violation since the shim does not exist).
**Introduced:** WP-065
**Status:** Active

---

### D-6504 — Intentional stripping of style and unknown custom blocks in compileVue
**Decision:** `compileVue` emits code for `<template>` and `<script>` blocks only. `<style>` blocks and any unknown custom blocks (`<i18n>`, `<docs>`, etc.) are dropped silently from the emitted module. The `DEBUG=vue-sfc-loader` one-liner surfaces the stripped counts so the behavior is visible without dumping contents.
**Rationale:** `jsdom` does not compute styles, and component tests under `node:test` assert on text and accessibility, not visual presentation. Emitting `<style>` into a no-op module adds bytes and noise without test value. Custom blocks have no standard runtime interpretation outside Vite; surfacing them as test-visible warnings would create per-project escape hatches.
**Alternatives rejected:** emitting `<style>` into a no-op module (adds bytes, no test value); surfacing custom blocks as test-visible warnings (creates per-project escape hatches); failing the compile on unknown blocks (breaks mixed-use `.vue` files shared with production Vite).
**Introduced:** WP-065
**Status:** Active

---

### D-6505 — Node 22 module.register() as the loader API
**Decision:** `packages/vue-sfc-loader/src/register.ts` uses `register('./loader.js', import.meta.url)` from `node:module`. The consumer-facing opt-in is `--import @legendary-arena/vue-sfc-loader/register`. Node v22 is the documented floor; pre-flight validated on Node v24.14.1.
**Rationale:** `module.register()` + `--import` is the stable, non-deprecated loader-registration API on Node 22 LTS and Node 24. It works cross-platform (Windows, macOS, Linux). Legacy `--loader` hooks are deprecated and the runtime prints a warning. CommonJS `require.extensions` is not ESM-compatible and the repo is ESM-only.
**Alternatives rejected:** legacy `--loader` hook (deprecated, warns at runtime); `require.extensions` (CJS-only, incompatible with repo's ESM-only policy); a global monkey-patch of `import` (not feasible under ESM).
**Introduced:** WP-065
**Status:** Active

---

### D-6506 — TS strategy outcome for vue-sfc-loader (Outcome B)
**Decision:** Pre-flight's `<script lang="ts">` smoke test was run during execution (Locked Decision 7). At `@vue/compiler-sfc@^3.4.27` (actual installed version 3.5.30) `compileScript` retains TypeScript syntax (`interface Props`, `: string` annotations, `__props: any`) in its output. `compileVue` therefore applies `typescript.transpileModule({ module: 'ESNext', target: 'ES2022', isolatedModules: true })` internally after concatenating the rewritten script, template, and default-export sections. `typescript` is a `dependencies` entry (not `devDependencies`) because it runs at loader time.
**Rationale:** Node's loader chain does not re-transform the string returned from `load()`. Relying on an outer TS loader (`tsx`, `ts-node`) to "catch up" after this loader returned TS would fail with `Unexpected token` on `<script lang="ts">`. The pass must happen inside `compileVue`. `isolatedModules: true` ensures the transpile pass does not require a full TS program and stays deterministic for pure string-in / string-out behavior.
**Alternatives rejected:** relying on the outer TS loader (incompatible with Node's loader chain — `load()` return is not re-transformed); adding `tsx`, `ts-node`, or `esbuild` as in-package dependencies (violates WP-065 forbidden-dependencies list); stripping TS via regex (incorrect for generics, unions, and enums).
**Introduced:** WP-065
**Status:** Active

---

### D-6507 — Canonical NODE_OPTIONS composition pattern (tsx first, vue-sfc-loader second)
**Decision:** The canonical consumer composition is `NODE_OPTIONS="--import tsx --import @legendary-arena/vue-sfc-loader/register"`. `tsx` runs first so consumer `.test.ts` files are TypeScript-transformed; `@legendary-arena/vue-sfc-loader/register` runs second so `.vue` imports are SFC-compiled. The delivered `packages/vue-sfc-loader/README.md` substitutes `tsx` for the `<repo-ts-loader>` placeholder per Locked Decision 1. The governance documents (WP-065 and EC-065) keep the placeholder literally.
**Rationale:** Reversing the order breaks `<script lang="ts">` handling: `tsx` cannot re-transform strings returned from this loader's `load()`. A single documented pattern prevents per-app drift and makes failure smells diagnosable (the EC-065 "Common Failure Smells" table cites loader-ordering as the first mode).
**Alternatives rejected:** letting each app invent its own ordering (guarantees drift); using direct `node --import` invocations as the default (worse onboarding for app authors); deferring the TS-loader choice to the app (ambiguity when WP-061+ land).
**Introduced:** WP-065
**Status:** Active

---

### D-6508 — Canonical TS loader name = tsx
**Decision:** The repo-canonical TypeScript loader for `node:test` consumers is `tsx`. This is the literal package name substituted for `<repo-ts-loader>` in the delivered `packages/vue-sfc-loader/README.md` worked example, composition-pattern lines, and troubleshooting section.
**Rationale:** `tsx` appears verbatim in all three existing `node:test` runners that ship today — `packages/game-engine/package.json:19`, `packages/registry/package.json:19`, `apps/server/package.json:10`. Picking any other package would create a second TS-loader dependency and diverge from existing precedent. The `<repo-ts-loader>` placeholder in the WP-065 and EC-065 governance documents remains literal so those files remain re-executable under a future loader change.
**Alternatives rejected:** hard-coding `tsx` inside WP-065 / EC-065 governance text (loses re-executability under a loader change); `ts-node` (not in use anywhere in the repo); a repo-local loader (no such loader exists and introducing one was out of scope).
**Introduced:** WP-065
**Status:** Active

---

### D-6509 — POSIX filename normalization for compiler identity
**Decision:** `compileVue` normalizes `filename` to POSIX forward slashes (`filename.replace(/\\/g, '/')`) before passing it as the `id` argument to `@vue/compiler-sfc.parse`, `compileScript`, `compileTemplate`, and `typescript.transpileModule`. The original OS-native path is retained for error messages so humans see a path their shell understands. A dedicated test asserts byte-for-byte identical emitted module bodies for `C:\fix\hello.vue` and `/fix/hello.vue` (sourcemap comment stripped for the comparison).
**Rationale:** `@vue/compiler-sfc` embeds the `id` string into generated render-function helpers and sourcemap `sources` arrays. On Windows the id is `C:\foo\Hello.vue`; on Linux CI it is `/foo/Hello.vue`. Without normalization the emitted bodies diverge in the id bytes even when the source and intent are identical, which makes byte-for-byte determinism across CI platforms impossible. POSIX normalization is a strictly one-way transform that preserves identity — the dropped backslashes cannot conflict with any legal POSIX path character.
**Alternatives rejected:** passing the raw OS-native path (produces divergent compiler IDs across platforms); hashing the filename (loses debuggability — stack traces lose the `.vue` path); normalizing only the compiler `id` but not `filename` (splits the two paths, risking future drift).
**Introduced:** WP-065
**Status:** Active

---

### D-6510 — Sourcemap tolerance = .vue path + non-zero line, not perfect column accuracy
**Decision:** `compileVue` emits an inline sourcemap comment (`//# sourceMappingURL=data:application/json;charset=utf-8;base64,...`) containing a minimal identity mapping (`"mappings": "AAAA"`) with `sources` pointing at the POSIX-normalized `.vue` path and `sourcesContent` carrying the original SFC source. The acceptance target is "stack traces reference the `.vue` path with a non-zero line number"; perfect column accuracy is explicitly out of scope. A dedicated test in `loader.test.ts` asserts the stack trace from a deliberately broken fixture names the `.vue` path.
**Rationale:** `@vue/compiler-sfc` produces separate sourcemaps for template and script; merging them into a single accurate map that threads through the subsequent `typescript.transpileModule` pass is non-trivial and out of scope for a test-time transform. "Path + non-zero line" is the debuggability target a human needs to find the failing site in the source `.vue`. Perfect column accuracy would add map-merger complexity that test environments do not consume.
**Alternatives rejected:** a custom template/script map-merger (scope creep; fragile across `@vue/compiler-sfc` minor bumps); no sourcemap at all (breaks stack trace debuggability); emitting an external `.map` file (adds filesystem coupling to a pure helper).
**Introduced:** WP-065
**Status:** Active

---

### D-6511 — Client App classification for apps/arena-client/

**Decision:** The new package at `apps/arena-client/` is classified as 
Client App and belongs to the Client App category in 
`docs/ai/REFERENCE/02-CODE-CATEGORIES.md`.  

**Rationale:** This package provides a Vue 3 + Vite SPA for gameplay UI, 
distinct from the registry-viewer (card browser) and server (backend). 
Classifying it as Client App ensures its imports and behavior are governed 
by the layer-boundary rules in `docs/ai/ARCHITECTURE.md §Layer Boundary` 
rather than the broader `infra` or `docs` categories.  

**Alternatives rejected:** classifying it as `infra` would be too broad and 
would not distinguish executable client apps from one-off scripts; 
classifying it as `docs` would mischaracterize package code as non-executable 
governance material; classifying it under `server` would violate the package's
client-side nature and layer import rules.  

**Introduced:** Pre-session action for WP-061  
**Status:** Active

---

### D-6512 — BootstrapProbe uses explicit `defineComponent({ setup() { return {...} } })` instead of `<script setup>` sugar

**Decision:** `apps/arena-client/src/components/BootstrapProbe.vue` uses the
explicit `defineComponent({ setup() { return {...} } })` Composition API form
rather than the `<script setup>` sugar form originally specified in WP-061
§Scope (In) D. App.vue keeps `<script setup>` (Vite-only path; unaffected).

**Rationale:** The WP-065 vue-sfc-loader compiles `.vue` SFCs using
`@vue/compiler-sfc`'s `compileScript` + `compileTemplate` as separate passes
with `inlineTemplate: false`. In that mode, the template's render function
receives `_ctx` as a proxy over the instance, and `<script setup>` top-level
bindings (refs, `storeToRefs(...)` outputs, etc.) are NOT exposed on `_ctx` —
the auto-exposure only works when the template is inlined into the setup
function (`inlineTemplate: true`). Props ARE exposed (via the instance's
`$props`), which is why WP-065's `hello.vue` fixture works. Top-level
setup-scope bindings used in a template interpolation fail at test time with
`TypeError: Cannot read properties of undefined (reading '…')` rooted inside
Vue's render function. The explicit `setup(){ return { snapshot } }` form
places the binding on the returned object, which Vue merges onto the instance
proxy, making `_ctx.snapshot` resolve correctly.

**Alternatives rejected:** (1) Modifying `packages/vue-sfc-loader/**` to pass
`bindingMetadata` from `compileScript` into `compileTemplate` — forbidden by
EC-067 scope lock and would be a cross-packet change outside this WP.
(2) Rewriting the component as Options API with `data()` — less idiomatic
and hides the store access inside a mount-time function. (3) Passing
`snapshot` as a prop from App.vue — App.vue would then have the same issue
in its own template.

**Introduced:** WP-061 execution, 2026-04-17  
**Status:** Active

---

### D-6513 — DCE-marker Step-12 verification is scoped to executing JS; sourcemaps preserve the marker by design

**Decision:** The WP-061 acceptance check that
`Select-String -Path apps/arena-client/dist -Pattern __WP061_DEV_FIXTURE_HARNESS__ -Recurse`
returns zero matches applies to executing JavaScript output
(`dist/assets/*.js`). The `.js.map` sourcemap artifact is a known carve-out
because `build.sourcemap: true` is enabled (D-6515) and sourcemaps preserve
original source content — that is their purpose. WP-061 verification is
satisfied when `dist/assets/*.js` contains zero matches.

**Rationale:** The session prompt and EC-067 simultaneously require
(a) `build.sourcemap: true` for first-time-bootstrap diagnosability and
(b) zero marker occurrences anywhere under `dist/`. These two requirements
are incompatible literally: emitted `.js.map` files contain the full
original source, including any string literal that was present before DCE
ran. DCE operates on the AST, not on the sourcemap's source-content string
array. The underlying DCE invariant — "the dev branch does not reach
production execution" — is satisfied by the executing bundle being
marker-free. Making the verification target `dist/assets/*.js` captures the
actual behavioral guarantee; recursing into `.js.map` captures a preserved
debug artifact, not a live-code artifact.

**Alternatives rejected:** (1) Disabling build sourcemaps — conflicts with
D-6515 and the WP-061 DoD requirement. (2) Composing the marker from
concatenated parts to defeat the sourcemap — bundlers constant-fold string
concatenation, so the marker would still appear in both `.js` and `.js.map`.
(3) Base64-encoding the marker in source — ugly and defeats the grep target
in the source file, which is itself a WP-061 acceptance criterion.

**Introduced:** WP-061 execution, 2026-04-17  
**Status:** Active

---

### D-6514 — UIState fixture validation strategy: `satisfies UIState` over JSON imports under `resolveJsonModule`

**Decision:** `apps/arena-client/src/fixtures/uiState/typed.ts` imports
each committed JSON fixture and applies `satisfies UIState` at the import
site. No Zod schema, no runtime validator, no type assertion. Optional
fields (e.g., `gameOver`, `handCards`) are OMITTED from the JSON when
absent, never emitted as `null` — required by `exactOptionalPropertyTypes: true`.

**Rationale:** `satisfies` enforces structural compatibility without
widening the literal type, so fixture drift becomes a compile error at
the import site rather than a runtime mystery downstream. A bare type
assertion would silently widen the literal and mask drift. A Zod schema
would add a runtime dependency and a second validation code path — both
explicitly rejected by EC-067 §Guardrails ("no Zod fallback" — `satisfies`
is the only strategy). The `exactOptionalPropertyTypes: true` flag (inherited
from `packages/game-engine/tsconfig.json:8` via the self-contained
`apps/arena-client/tsconfig.json`) makes `{"gameOver": null}` non-assignable
to `gameOver?: UIGameOverState`; JSON cannot represent `undefined`; omission
is therefore the only valid encoding for absent optional fields.

**Alternatives rejected:** Zod runtime validation (unnecessary dependency;
duplicates compile-time guarantee); bare type assertion (masks drift);
emitting `null` for absent optionals (fails `satisfies` under `exactOptionalPropertyTypes`).

**Introduced:** WP-061 execution, 2026-04-17  
**Status:** Active

---

### D-6515 — arena-client enables `build.sourcemap: true` for first-bootstrap diagnosability

**Decision:** `apps/arena-client/vite.config.ts` sets `build.sourcemap: true`.
Dev sourcemaps are already Vite's default.

**Rationale:** The gameplay client is the first client app consuming engine
`UIState` projections; first-time bootstrap failures are likely to surface
as Vue-runtime stack traces inside minified bundles. Sourcemaps make those
diagnosable against the original TypeScript and `.vue` sources. The
bundle-size cost is accepted while the app is small. Revisit in a later WP
once `apps/arena-client/` grows and production sourcemap size becomes a
material concern (or if sourcemap-leakage of non-public strings becomes a
concern independent of that).

**Introduced:** WP-061 execution, 2026-04-17  
**Status:** Active

---

### D-6516 — `apps/arena-client/` bootstrap omits routing entirely (no `vue-router`)

**Decision:** `apps/arena-client/` does not install `vue-router` or any
alternative router. The single mount point is `/` via `index.html` and
`src/main.ts`. Navigation, guards, and deep-linking are deliberately out
of scope for the bootstrap packet.

**Rationale:** Matches the precedent set by `apps/registry-viewer/`, which
uses internal tab switching without a router. WP-061 is plumbing only —
adding router infrastructure would accrue responsibility the bootstrap
does not need and would create a second abstraction the future HUD WP
would immediately overhaul. The dev `?fixture=` harness uses
`URLSearchParams` directly on `window.location.search` rather than a router
API, matching the "strict plumbing" boundary.

**Alternatives rejected:** Installing `vue-router` "so it's ready for
WP-062" — premature abstraction; WP-062 can add it with context-appropriate
route shapes if it is needed at all.

**Introduced:** WP-061 execution, 2026-04-17  
**Status:** Active

---

### D-6517 — arena-client test runner composition: direct `--import` flags, no `NODE_OPTIONS`

**Decision:** `apps/arena-client/package.json`'s `test` script invokes
Node directly with two `--import` flags in fixed order:
`node --import tsx --import @legendary-arena/vue-sfc-loader/register --test src/**/*.test.ts`.
No `NODE_OPTIONS`, no `cross-env`, no wrapper script.

**Rationale:** Matches the precedent in `packages/game-engine/package.json:19`,
`packages/registry/package.json:19`, and `apps/server/package.json:10`. The
direct `--import` flag order is load-bearing: `tsx` must come first so
consumer `.test.ts` files are TypeScript-transformed before
`@legendary-arena/vue-sfc-loader/register` sees their `.vue` imports
(D-6507). Reversing the order breaks `<script lang="ts">` handling under
Node's loader chain because `load()` output is not re-transformed. This
composition works cross-platform (Windows / Linux / macOS) without
`cross-env` because Node reads `--import` directly from argv; avoiding
`NODE_OPTIONS` avoids a Windows-vs-POSIX quoting hazard.

**Alternatives rejected:** `NODE_OPTIONS="--import tsx --import @legendary-arena/vue-sfc-loader/register"`
(Windows quoting hazard, requires `cross-env`); a single wrapper script
(extra file, no benefit); Vitest (project-wide forbidden per lint §7 / §12
and `.claude/rules/code-style.md`).

**Introduced:** WP-061 execution, 2026-04-17  
**Status:** Active

---

### D-4801 — PAR Derivation Reads G State, Not a Structured Event Log

**Context:** WP-048 originally specified
`deriveScoringInputs(replayResult, gameLog: GameMessage[])`. Pre-flight
(2026-04-17) discovered that `GameMessage` is not a declared type anywhere
in the engine and that the canonical penalty event literals
(`villainEscaped`, `bystanderLost`, `schemeTwistNegative`,
`mastermindTacticUntaken`, `scenarioSpecificPenalty`) have no runtime
producers. `G.messages` is `string[]` — unstructured, wording-coupled.
An executor implementing the original spec would have been forced to
either invent a parallel event-log contract (massive scope creep) or
substring-match `G.messages` (brittle and non-deterministic).

**Decision:** `deriveScoringInputs` signature is
`(replayResult: ReplayResult, gameState: LegendaryGameState): ScoringInputs`.
No `gameLog` parameter. No `GameMessage` type is introduced. Derivation
reads `replayResult.moveCount` for rounds, `computeFinalScores` for VP,
`gameState.playerZones[*].victory` + `villainDeckCardTypes` for
bystanders-rescued, and `gameState.counters[ESCAPED_VILLAINS] ?? 0` for
escapes. Penalty event counts that have no engine producer today
(`bystanderLost`, `schemeTwistNegative`, `mastermindTacticUntaken`,
`scenarioSpecificPenalty`) safe-skip to `0` with `// why:` comments
naming the deferred follow-up WP.

**Rationale:** This is the WP-023 / D-2302 safe-skip precedent extended
to scoring (condition evaluators safe-skipped missing data; scoring
safe-skips missing producers). The extension seam (`PENALTY_EVENT_TYPES`
union + canonical array) is preserved — a future WP adds a producer by
updating the corresponding derivation line without changing the
`deriveScoringInputs` signature or any consumer. Formula weights still
apply — safe-skipped counts are `0`, which contributes zero to the raw
score, not a silent inflation.

**Alternatives rejected:**
- **Introduce `GameMessage` type and structured event log in `G`** —
  massive blast radius (every move, every reveal, every hook would need
  to emit structured events). Deferred as a separate WP.
- **Substring-match `G.messages: string[]`** — brittle; couples scoring
  to human-readable log wording; non-deterministic across minor log
  changes. Rejected.
- **Silent `0` without `// why:` comments** — violates code-style Rule 6
  and hides the known gap from future maintainers. Rejected.

**Introduced:** WP-048 pre-flight amendment A-048-01, 2026-04-17  
**Status:** Active

---

### D-4802 — WP-048 Defers `G.activeScoringConfig` Field to WP-067

**Context:** The `MatchSetupConfig` 9-field lock in `.claude/CLAUDE.md`
forbids adding a 10th field, but the scoring config must reach `G`
somehow at match setup so `buildUIState` can project PAR into
`UIGameOverState.par`. WP-048's original draft did not list
`types.ts` or `buildInitialGameState.ts` in Files Expected to Change,
while WP-067's draft assumes `G.activeScoringConfig` is populated at
setup. Session-context-wp048 item #1 required a pre-flight decision
on which WP owns the field addition.

**Decision:** WP-048 does NOT add `activeScoringConfig` to
`LegendaryGameState` and does NOT modify `buildInitialGameState`'s
signature. WP-067 owns the field addition via its Conditional §C.
When WP-067 lands, the field is threaded through an **optional 4th
parameter** to `buildInitialGameState(config, registry, context,
scoringConfig?)` — not a 10th `MatchSetupConfig` field.
`MatchSetupConfig` remains at 9 fields.

**Rationale:** Keeps WP-048 as a pure Contract-Only WP with no
Runtime Wiring Allowance invocation. Separates scoring-contract
concerns (WP-048) from setup-wiring concerns (WP-067). Preserves
the `MatchSetupConfig` lock. EC-068 lines 29-34 already
accommodate this decision via its conditional §C — no downstream
churn.

**Alternatives rejected:**
- **Add `activeScoringConfig` in WP-048** — expands WP-048's
  allowlist and blurs its contract-only classification. Rejected.
- **Amend `MatchSetupConfig` to 10 fields** — largest blast
  radius, breaks CLAUDE.md lock, forces all setup validators and
  tests to update. Rejected.
- **Server-layer population after `Game.setup()` finishes** —
  blurs the setup-only boundary and introduces a timing race with
  the first call to `buildUIState`. Rejected.

**Introduced:** WP-048 pre-flight amendment A-048-01, 2026-04-17  
**Status:** Active

---

### D-4803 — MVP PAR Scoring Is Team-Aggregate, Not Per-Player

**Context:** `ScoringInputs.victoryPoints` derivation reuses
`computeFinalScores(gameState)`, which returns
`FinalScoreSummary.players[*].totalVP` — per-player breakdowns. Pre-flight
needed to decide whether PAR scoring summed across players (team score)
or produced per-player scores.

**Decision:** MVP PAR is a **team-aggregate score**.
`ScoringInputs.victoryPoints` = `sum(FinalScoreSummary.players[*].totalVP)`.
`ScoreBreakdown` carries a single set of numbers, not per-player
breakdowns. `LeaderboardEntry.playerIdentifiers` is a `readonly string[]`
naming the team.

**Rationale:** Legendary tabletop semantics are cooperative — the team
wins or loses together, and a scenario's PAR is a team-level target.
Per-player PAR is interesting (contribution analysis, personal best
tracking) but requires additional design decisions (how to attribute
shared events like mastermind tactic defeats) that are out of scope for
WP-048. The team-aggregate MVP preserves the option to add per-player
PAR later without breaking the `LeaderboardEntry` contract — a future
WP can add an optional `perPlayerBreakdown?: PlayerScoreBreakdown[]`
field.

**Alternatives rejected:**
- **Per-player PAR in MVP** — requires attribution rules for shared
  events (tactic VP is awarded to all players today per
  `scoring.logic.ts:45`; distributing it fairly across PAR targets is
  a design question deferred).
- **Both team and per-player at MVP** — doubles the contract surface
  without a clear authoring use case. Deferred.

**Introduced:** WP-048 pre-flight amendment A-048-01, 2026-04-17  
**Status:** Active

---

### D-4804 — `deriveScoringInputs` Is End-of-Match Only

**Context:** `computeRawScore`, `computeParScore`, and `computeFinalScore`
are pure arithmetic functions callable at any lifecycle point. But
`deriveScoringInputs` reads from `replayResult.finalState` and from
`gameState.counters` — values that are only meaningful once the match
has reached `ctx.phase === 'end'`. Pre-flight needed to lock the
timing contract.

**Decision:** `deriveScoringInputs` is **end-of-match only**. Callers
must not invoke it mid-match; behaviour at non-terminal states is
unspecified (and will produce partial, misleading inputs — e.g., an
intermediate `escapes` count that could still grow). Live / mid-match
PAR projection is a separate future WP.

**Rationale:** Matches WP-067 / EC-068's decision that PAR appears on
`UIGameOverState` only when `ctx.phase === 'end'`. Two independent
declarations of the same timing rule prevent drift. Downstream WP-062
(Arena HUD) already tolerates `live=undefined` per WP-067
§Non-Negotiable Constraints.

**Alternatives rejected:**
- **Live mid-match PAR** — requires a separate "partial derivation"
  contract with different semantics; deferred to a future WP if/when
  product direction requires live PAR.

**Introduced:** WP-048 pre-flight amendment A-048-01, 2026-04-17  
**Status:** Active

---

### D-4805 — Scenario Scoring Configs Are Self-Contained

**Context:** WP-048's "Locked contract values" table lists reference
defaults for component weights, penalty weights, and caps, with
language stating "scenarios may override". Copilot check (2026-04-17)
Finding #12 flagged that "override" alone is ambiguous — it could mean
full replacement, field-level merge with defaults, or default
inheritance for missing fields. Each interpretation has different
implications for `validateScoringConfig` strictness and for leaderboard
entry interpretability across config versions.

**Decision:** Every `ScenarioScoringConfig` is **self-contained**. It
carries a full `ScoringWeights`, full `ScoringCaps`, full
`PenaltyEventWeights` (with an entry for every `PenaltyEventType`),
full `ParBaseline`, and a `scoringConfigVersion`. There is no default
config object and no runtime merge with defaults. The reference
defaults in the WP are **authoring guidance**, not merge targets.
`validateScoringConfig` rejects any config missing any required field,
including any `PenaltyEventType` key in `penaltyEventWeights` —
WP-048 Test 15 enforces this.

**Rationale:** Self-contained configs make leaderboard entries
interpretable in isolation — reading a persisted `LeaderboardEntry`
never requires joining against a runtime "current defaults" source.
They eliminate the drift class where changing a reference default
silently changes the semantics of historical leaderboard entries that
pinned to an earlier version. They also simplify
`validateScoringConfig` — strict reject-on-missing is a single-branch
check, not a multi-step merge-then-validate.

**Alternatives rejected:**
- **Field-level merge with defaults** — creates a "magic defaults"
  surface that `ScenarioScoringConfig` persistence records don't
  capture; historical entries become uninterpretable if defaults drift.
- **Partial configs with missing fields inheriting defaults** — same
  drift hazard; also forces `validateScoringConfig` to run a merge
  pass before validating, doubling the code path.

**Introduced:** WP-048 pre-flight amendment A-048-01, 2026-04-17  
**Status:** Active

---

### D-4806 — `ScoreBreakdown` and `LeaderboardEntry` Are JSON-Roundtrip Tested

**Context:** `ScoreBreakdown` is Class 3 (Snapshot, persistable) and
`LeaderboardEntry` is server-persisted. Both must be JSON-safe — no
functions, Maps, Sets, Dates, or class instances. WP-048's original
test list (14 tests) did not include a JSON-roundtrip assertion;
copilot check (2026-04-17) Finding #17 flagged that a future field
addition could silently break persistability.

**Decision:** WP-048 Test 16 asserts
`JSON.parse(JSON.stringify(breakdown))` produces a structurally-equal
`ScoreBreakdown`, and the same assertion for a sample `LeaderboardEntry`
constructed from the breakdown. The test exists to catch the failure
mode where a later refactor introduces a `Date`, `Map`, or closure in
either type.

**Rationale:** Matches the project-wide JSON-serializability discipline
(engine rule: "G must be JSON-serializable — no functions, classes,
Maps, Sets, Dates, or Symbols" per `.claude/rules/game-engine.md`).
Extends that discipline from `G` to Class 3 snapshots, which are
persisted and must re-hydrate deterministically. WP-028 D-2801
precedent established aliasing protection as a first-class test
requirement for projection-class types; D-4806 applies
JSON-serializability to the scoring type family.

**Alternatives rejected:**
- **Rely on code review to catch non-serializable additions** — misses
  the failure mode the rule is designed to prevent; rejected per the
  WP-028 principle "prevention by construction, not vigilance".

**Introduced:** WP-048 pre-flight amendment A-048-01, 2026-04-17  
**Status:** Active

---

### D-6701 — WP-067 `UIParBreakdown` Ships as Type-Level Contract With Safe-Skip Payload

**Context:** WP-067 extends `UIGameOverState` with an optional
`par?: UIParBreakdown` populated by a new `buildParBreakdown(G, ctx)`
helper. The payload would be computed by
`buildScoreBreakdown(deriveScoringInputs(replayResult, gameState), config)`.
But `deriveScoringInputs` requires a `ReplayResult` (for `moveCount` →
`rounds`) and `buildUIState(G, ctx)` has no `ReplayResult` in scope.
`replayResult` only exists inside WP-027's `replayGame` infrastructure,
which is not part of the normal engine → UI rendering path. WP-067
§Non-Negotiable Constraints installs a "stop and ask" gate for exactly
this condition; the WP-067 pre-flight (2026-04-17) tripped the gate.

**Decision:** WP-067 ships `UIProgressCounters` and `UIParBreakdown` as
full type-level contracts. `UIState.progress` is populated for every
call. `UIGameOverState.par?` is **always omitted** at MVP:
`buildParBreakdown(G, ctx)` returns `undefined` unconditionally, with a
`// why:` comment citing this decision. The four `UIParBreakdown`
fields (`rawScore`, `parScore`, `finalScore`, `scoringConfigVersion`)
are locked at the type level — WP-062's aria-label bindings compile
against the drift-test `satisfies` fixture — but no runtime payload is
produced. The function signature, gating logic (`ctx.phase === 'end'`
AND `G.activeScoringConfig !== undefined`), and the call to
`deriveScoringInputs` / `buildScoreBreakdown` are deferred.

A follow-up WP resolves data availability by one of:
- threading `replayResult` into `buildUIState` (new two-arg → three-arg
  public signature — must not break WP-061 consumers);
- persisting a minimal `{ moveCount }` into `G` at the endgame boundary
  (new engine contract, setup-time persistence class);
- moving PAR projection entirely into a post-match server pipeline that
  already holds the `ReplayResult`.

The choice between those paths is out of scope for WP-067 and is not
pre-committed here.

**Rationale:** Matches the established safe-skip pattern (WP-023
D-2302, WP-025 D-2504, WP-026 D-2601) where a contract ships at the
type level with a deterministic `undefined` / no-op payload until a
data source is available. Preserves WP-062's type-level consumption
without forcing WP-067 to thread a new parameter through a frozen
`buildUIState` signature or invent a partial `ReplayResult`. Purity of
`buildUIState` is preserved — the function reads nothing it doesn't
already read. The drift test remains load-bearing: any future rename of
the four PAR field names still fails typecheck before runtime.

**Alternatives rejected:**
- **Add `replayResult?` parameter to `buildUIState`** — rejected because
  WP-061 consumers (Pinia store, fixtures, component tests) are already
  frozen on the `(G, ctx)` shape. The signature change would cascade
  into every WP-061 call site.
- **Synthesize a partial `ReplayResult` from `G`** — rejected per
  D-4801. Inventing a `moveCount` value at projection time introduces a
  non-authoritative data source that replay cannot reconcile.
- **Delay `UIParBreakdown` type to a later WP** — rejected because
  WP-062 (Arena HUD) pre-flight blockers #1-#3 require a stable
  type-level contract now. Shipping the type without a payload
  unblocks WP-062 design; the payload lands in a follow-up WP.

**Introduced:** WP-067 pre-flight, 2026-04-17  
**Status:** Active

---

### D-6702 — `G.activeScoringConfig` Added by WP-067, Not WP-048

**Context:** WP-048 (PAR scoring engine types and helpers, commit
`2587bbb`) delivered `ScenarioScoringConfig` as a self-contained
validated type but explicitly deferred adding
`G.activeScoringConfig?: ScenarioScoringConfig` to `LegendaryGameState`
(D-4802). WP-067 reads `G.activeScoringConfig` at projection time as
part of the PAR gate (`ctx.phase === 'end'` AND
`G.activeScoringConfig !== undefined`). A grep of
`packages/game-engine/src/` at WP-067 pre-flight time (2026-04-17)
returned zero matches for `activeScoringConfig`, confirming the field
does not yet exist.

**Decision:** WP-067 adds the field unconditionally. The `types.ts`
and `setup/buildInitialGameState.ts` edits listed in WP-067 §C and
EC-068 §Files to Produce are **not conditional** — the "no-op" /
"adopted from WP-048" branch is inoperative and must not appear in the
session prompt.

Concretely:
1. `packages/game-engine/src/types.ts` — add
   `readonly activeScoringConfig?: ScenarioScoringConfig` to
   `LegendaryGameState`, with a `// why:` comment stating the field is
   runtime-only, never persisted, and marks the match as PAR-scored for
   `buildUIState` gating (D-6701 gate is only active when this field
   is defined).
2. `packages/game-engine/src/setup/buildInitialGameState.ts` — accept
   a new optional setup input (see D-6703 for positional arity),
   assign it to `G.activeScoringConfig`.

**Rationale:** Confirms and executes the deferral recorded in D-4802.
Keeps scoring-config storage inside `G` consistent with the engine's
runtime-state pattern (`G.hookRegistry`, `G.cardStats`,
`G.heroAbilityHooks`). Does not modify `MatchSetupConfig` — D-4805
keeps scenario configs self-contained and separate from match setup.

**Alternatives rejected:**
- **Server-layer population after `Game.setup()`** — rejected per
  session-context-wp067 option (b); blurs the setup boundary and
  requires the server to mutate `G` post-setup, which is forbidden
  outside move / phase hook contexts.
- **Extend `MatchSetupConfig` to a 10th field** — rejected per
  session-context-wp067 option (c). The 9-field lock (D-1244) is a
  foundational invariant; amending it would cascade into every WP that
  validates `MatchSetupConfig` shape.

**Introduced:** WP-067 pre-flight, 2026-04-17  
**Status:** Active

---

### D-6703 — `buildInitialGameState` Gains a Fourth Positional Optional Parameter for `scoringConfig`

**Context:** D-6702 locks that `G.activeScoringConfig` is populated
by `buildInitialGameState` from an incoming `ScenarioScoringConfig`.
The current signature is
`buildInitialGameState(config: MatchSetupConfig, registry: CardRegistryReader, context: SetupContext)`
— three positional parameters. Session-context-wp067 line 106-111
options (a/b/c) describe adding "an optional third parameter" but the
third slot is already taken. Pre-flight RS-3 (2026-04-17) flagged the
ambiguity before execution.

**Decision:** Add a **fourth positional optional parameter**:
`scoringConfig?: ScenarioScoringConfig`. Full new signature:

```
buildInitialGameState(
  config: MatchSetupConfig,
  registry: CardRegistryReader,
  context: SetupContext,
  scoringConfig?: ScenarioScoringConfig,
): LegendaryGameState
```

All existing call sites remain source-compatible because the new
parameter is optional. `MatchSetupConfig` is not modified. Inside the
function body, assign `G.activeScoringConfig = scoringConfig` when
`scoringConfig !== undefined`; leave the field unset otherwise.

**Rationale:** Minimal additive change. Preserves the narrow
structural interface pattern (D-2801 / D-6512) — the helper's caller
provides the config, no new registry or framework import needed.
Keeps `MatchSetupConfig` immutable (D-1244 9-field lock,
D-4805 scenario-config separation). Avoids a positional bag object
for one field.

**Alternatives rejected:**
- **Convert the third parameter to an object bag** — rejected
  because it would break every existing call site.
- **Bundle `scoringConfig` into `SetupContext`** — rejected because
  `SetupContext` is a narrow framework-facing shape (`ctx`, `random`)
  and adding gameplay config to it conflates categories.
- **Expand `MatchSetupConfig`** — rejected per D-6702 rationale.

**Introduced:** WP-067 pre-flight, 2026-04-17  
**Status:** Active

---

### D-6201 — HUD aria-labels are the literal leaf UIState field name, verbatim

**Decision:** Every user-visible numeric value in the Arena HUD carries
an `aria-label` equal to the **literal leaf** `UIState` field name,
verbatim, with no paraphrasing or humanization. Examples:
`aria-label="bystandersRescued"`, `aria-label="twistCount"`,
`aria-label="tacticsRemaining"`, `aria-label="tacticsDefeated"`,
`aria-label="finalScore"`. Visible display text may be human-readable
(e.g., `"Bystanders rescued: 4"`), but the `aria-label` is the data-
contract name.

**Rationale:** Tests assert the accessibility tree against exact
strings; humanized or paraphrased labels drift silently when
translation pipelines, locale files, or cosmetic refactors touch the
HUD. The literal-leaf rule also binds the HUD's a11y surface to
`uiState.types.drift.test.ts` — a rename of any of the six locked
field names (WP-067) breaks BOTH the drift test AND the HUD tests in
lockstep, preventing divergence.

**Status:** Active
**Raised:** WP-062 execution (2026-04-18)
**Resolved:** 2026-04-18

---

### D-6202 — No client-side arithmetic on `UIState` game values in the HUD

**Decision:** HUD components must not sum, subtract, normalize, smooth,
average, count, or otherwise combine two or more numeric `UIState`
fields into a new game-relevant value. `.reduce()` is banned in HUD
source; so is a hand-written loop or a `+` operator between projected
numbers in a `computed`. The only permitted "computation" is reading a
single field and mapping it to a display string (including sign choice
for PAR delta rendering).

**Rationale:** Every number visible to the player must trace directly
to an engine projection. Client-side aggregation introduces a second
source of truth — if the engine later projects a pre-aggregated field
and the HUD's aggregation disagrees, the UI lies to the player and
undermines Vision §Primary Goal 3 (Player Trust & Fairness). Derived
values belong on `UIState`, produced by the engine's projection layer.

**Status:** Active
**Raised:** WP-062 execution (2026-04-18)
**Resolved:** 2026-04-18

---

### D-6203 — `<ParDeltaReadout />` renders em-dash only when `par` is absent, never when `finalScore === 0`

**Decision:** The PAR delta readout renders an em-dash (`—`) when
`!('par' in gameOver)` or `gameOver === undefined`. It renders `0`
(no arrow, neutral tone) when `gameOver.par.finalScore === 0`. Tests
assert the absent form via the `'par' in gameOver` key check, NOT via
`gameOver.par === undefined`, because under `Object.keys` iteration
and `JSON.stringify` the two forms differ (D-6701 §1).

**Rationale:** Zero is a valid engine value — a player can legitimately
hit PAR exactly. Collapsing `finalScore === 0` into an em-dash would
hide a real competitive outcome behind the same indicator that means
"no payload yet." This is load-bearing under D-6701 because
`buildParBreakdown` currently returns `undefined` unconditionally; the
HUD must distinguish "not wired yet" (em-dash) from "you hit par
exactly" (`0`).

**Status:** Active
**Raised:** WP-062 execution (2026-04-18)
**Resolved:** 2026-04-18

---

### D-6204 — Bystanders-rescued counter is the single `data-emphasis="primary"` slot in `<SharedScoreboard />`

**Decision:** In `SharedScoreboard.vue`, the `bystandersRescued`
counter carries `data-emphasis="primary"` exactly once. The four
penalty counters (`escapedVillains`, `twistCount`,
`tacticsRemaining`, `tacticsDefeated`) carry
`data-emphasis="secondary"`. The attribute contract is structural —
tests assert `[data-emphasis="primary"]` count = 1 and
`[data-emphasis="secondary"]` count = 4, not class names — so a CSS
refactor or theme layer cannot silently regress the emphasis rule.

**Rationale:** `docs/01-VISION.md §Heroic Values in Scoring` names
bystanders rescued as the strongest positive cooperative action. The
visual hierarchy surfaces cooperation above penalty tracking; if the
HUD has exactly one "primary" emphasis slot in the scoreboard, this
is it.

**Status:** Active
**Raised:** WP-062 execution (2026-04-18)
**Resolved:** 2026-04-18

---

### D-6205 — HUD failure semantics: fail-loud-for-required, fail-soft-for-optional

**Decision:** HUD components access **required** `UIState` paths
without defensive guards (`snapshot.progress.*`, every `UIPlayerState`
core field, `snapshot.game.*`, `snapshot.scheme.*`,
`snapshot.mastermind.*`). A missing required key is a fixture or
contract violation — a loud `TypeError` is the correct failure mode,
caught upstream by `satisfies UIState` fixture typing and the WP-067
drift test. **Optional** paths (`snapshot.gameOver?`,
`snapshot.gameOver.par?`, `snapshot.gameOver.scores?`,
`snapshot.players[i].handCards?`) are guarded via `'key' in parent` or
`?.` before access.

**Rationale:** Defensive guards on required fields mask bugs instead
of surfacing them. If `snapshot.progress` ever goes missing, the HUD
should fail loudly at test time rather than silently render zero.
Optional fields, by contrast, are legitimately absent in well-formed
UIStates (e.g., `gameOver` during play, `par` under D-6701) and MUST
be guarded to preserve the HUD's empty-state rendering guarantees.

**Status:** Active
**Raised:** WP-062 execution (2026-04-18)
**Resolved:** 2026-04-18

---

### D-6206 — HUD color tokens: Okabe-Ito palette with numeric contrast-ratio comments

**Decision:** `apps/arena-client/src/styles/base.css` gains five HUD
color tokens (`--color-emphasis`, `--color-penalty`,
`--color-active-player`, `--color-par-positive`,
`--color-par-negative`) under both `prefers-color-scheme: light` and
`prefers-color-scheme: dark` blocks. Each token carries an inline
numeric contrast-ratio comment against the appropriate background
token (format: `/* 7.2:1 on --color-background */`). Player identity
colors come from the Okabe-Ito CUD-safe qualitative palette; the
icon differentiator (distinct glyph per palette slot) is mandatory
because color is never the sole accessibility signal.

**Rationale:** WCAG AA requires 4.5:1 contrast for normal text; WP-062
targets 4.5:1 minimum with AAA (7:1+) on the emphasis and active-
player indicators where the visual hierarchy is highest. Numeric
comments are load-bearing — a hand-wave "AA compliant" claim is a
DoD failure per §Debuggability & Diagnostics. Contrast ratios were
computed against the light (`#f9f9f9`) and dark (`#101015`)
background tokens WP-061 committed; values are standard computations
from the WebAIM contrast formula, verifiable with any WCAG checker.

**Status:** Active
**Raised:** WP-062 execution (2026-04-18)
**Resolved:** 2026-04-18

---

### D-6301 — `apps/replay-producer/` classified as `cli-producer-app` code category (new top-level category)

**Decision:** `apps/replay-producer/` (introduced by WP-063) is the
first instance of a new top-level code category, `cli-producer-app`
("CLI Producer App"). The category sits alongside `client-app` in
`docs/ai/REFERENCE/02-CODE-CATEGORIES.md` and is governed by the
same §Layer Boundary section of `docs/ai/ARCHITECTURE.md`. Unlike
`client-app` (which is browser-side, type-only engine imports), a
`cli-producer-app` runs under Node 22+ and MAY import
`@legendary-arena/game-engine` runtime — it wraps engine helpers
with filesystem and stdout/stderr I/O to produce deterministic,
portable artifacts. The category forbids `@legendary-arena/registry`
imports (unless `Game.setup()` transitively requires them, mirroring
`apps/server/`), forbids `boardgame.io` direct imports, forbids
network/DB access, and permits `Date.now()` only as a fallback when
an explicit override flag is absent (the override is the
deterministic path; `Date.now()` is the convenience fallback).

**Rationale:** WP-063 introduces `apps/replay-producer/` as a new
top-level application that does not fit any existing category:
- `client-app` forbids runtime engine imports (type-only) and
  targets the browser — wrong for a Node CLI that must drive the
  engine step-by-step.
- `server` carries the expectation of PostgreSQL access, HTTP
  endpoints, and process lifecycle management — far too broad for a
  single-artifact producer.
- `infra` (scripts/, .githooks/) explicitly covers one-off tooling
  not shipped to players, but its rules permit "performance
  shortcuts" and do not enforce the determinism + sourcemap +
  full-sentence-error discipline a replay artifact producer
  requires.
- `engine` forbids all I/O, which is the CLI's reason to exist.

Creating `cli-producer-app` lets pre-flight, ECs, and pre-commit
review pin the exact constraints a CLI producer must satisfy
(determinism flag override, sourcemap enablement, named exit-code
constants, no runtime registry reach) without diluting an existing
category. Future CLI producers (PAR artifact producer, migration
scripts promoted to first-class tooling, etc.) reuse the same
category.

**Status:** Active
**Raised:** WP-063 pre-flight / EC-071 drafting (2026-04-18)
**Resolved:** 2026-04-18

---

### D-6302 — `ReplaySnapshotSequence` JSON sorting: top-level keys sorted, nested objects inherit engine-produced order

**Decision:** The CLI `produce-replay` output serializes
`ReplaySnapshotSequence` with **top-level keys sorted
alphabetically** (`metadata`, `snapshots`, `version` at the outer
object level). **Nested objects are NOT recursively sorted** — they
inherit the key order produced by the engine (`buildUIState` output
for each `snapshots[i]`, and any `metadata` sub-fields in author-
supplied input order constrained to the locked shape). A
probe-object unit test in `buildSnapshotSequence.test.ts` constructs
a shape with deliberately-shuffled top-level keys and asserts stable
serialization across two invocations; the CLI-side determinism test
(`cli.test.ts`, Verification Step 5) asserts byte-identical output
across two runs with the same `--produced-at` override.

**Rationale:** Determinism in the artifact is the product of two
independent sources: (a) top-level key stability, which a custom
sorter guarantees regardless of the `JSON.stringify` implementation;
and (b) nested key stability, which is **already guaranteed** by the
engine's purity discipline (`UIState` is constructed by deterministic
engine code under a single Node runtime per session). Recursive
sorting would add ~dozens of lines of walker logic and a bespoke
comparator for every nested shape, with no additional determinism
benefit — the engine purity rule is load-bearing for the nested
case. If a future Node release ever changed nested-key iteration
order, the engine determinism test (WP-027) would catch it long
before the replay artifact; escalating the detection to the CLI
layer would be redundant. Top-level sorting remains mandatory
because the CLI itself assembles the outer object (combining
helper output + author-supplied metadata) and cannot rely on the
engine's purity rule for its own assembly order.

**Consequence:** The CLI serializer is a ~10-line function that
projects the outer object to a sorted shape and then calls
`JSON.stringify` with two-space indentation. It does NOT walk into
`snapshots[*]` or `metadata.*`. The probe test proves the
top-level guarantee; the run-twice determinism test proves the
end-to-end byte stability.

**Status:** Active
**Raised:** WP-063 pre-flight / EC-071 drafting (2026-04-18)
**Resolved:** 2026-04-18

---

### D-6303 — `ReplaySnapshotSequence` version bump policy: additive-at-v1, breaking-to-v2, consumer-must-assert

**Decision:** `ReplaySnapshotSequence.version` is the literal `1`.
Additive changes (new optional top-level fields, new optional
`metadata` sub-fields) remain at `version: 1`. Any of the following
require a bump to `version: 2`: (a) a change to the shape of
`snapshots[i]` beyond what `UIState` itself defines (the engine
projection is its own versioning axis — a change to `UIState` is
governed by WP-028's rules, and the snapshot sequence inherits it
transparently), (b) removal or rename of a documented field,
(c) a change to sort semantics or serialization format, (d) a
change to the meaning of any existing field (even if the name and
type are unchanged). Consumers of `ReplaySnapshotSequence` (WP-064
and future replay readers) MUST assert `version === 1` and refuse
unknown versions with a full-sentence error per
`00.6-code-style.md` Rule 11 (example: `"Unsupported
ReplaySnapshotSequence version <N>; this reader supports version 1
only."`). The `version` field is deliberately declared as the
literal `1` (not `number`) so a future bump is a compile-time
breaking change at every consumer, not a silent runtime drift.

**Optional-field serialization addendum:** optional fields are
**OMITTED** when absent, never serialized as `"metadata":
undefined` or `"par": null`. When `metadata` has no sub-fields set,
the entire `metadata` key is omitted from the output. A
construction-matrix test covers: `metadata` absent, `metadata: {}`,
and each `metadata.*` sub-field set singly, each case asserting
serialized output stability and absence of `undefined` literals in
the JSON text. This rule eliminates the
`exactOptionalPropertyTypes`-related ambiguity between "key missing"
and "key present with value `undefined`" at the serialization
boundary.

**Rationale:** `ReplaySnapshotSequence` becomes the input type for
WP-064's `<ReplayInspector />` and any future replay tooling. The
cost of a silent schema drift (a consumer blindly accepting a v2
artifact as v1) is corrupted playback and hard-to-trace desyncs.
The cost of a loud version assertion is a single line per consumer.
Locking the additive-vs-breaking threshold now — before the first
additive change is requested — prevents the "is this a v2 or still
v1?" debate that typically surfaces when the first optional field
is proposed. The literal-type `version: 1` constraint is the
compile-time seam that makes any future format change a
breaking change visible at every import site.

**Status:** Active
**Raised:** WP-063 pre-flight / EC-071 drafting (2026-04-18)
**Resolved:** 2026-04-18

---

### D-6304 — WP-027 Replay Harness Exposes a Step-Level API for Downstream Snapshot / Replay Tools

**Decision:** The engine's replay harness
(`packages/game-engine/src/replay/replay.execute.ts`) exposes a named
step-level API — `applyReplayStep(gameState, move, numPlayers):
LegendaryGameState` — that downstream consumers
(`buildSnapshotSequence` in WP-063, future replay inspectors, future
debug tools) call to apply exactly one `ReplayMove` at a time. The
harness's internal move dispatch (`MOVE_MAP` and `buildMoveContext`,
both file-local in `replay.execute.ts`) remains the **single source
of truth**; `replayGame` is refactored so its internal loop delegates
each iteration to `applyReplayStep`. The step function mutates
`gameState` in place and returns the same reference
(mutate-and-return-same-reference contract); consumers that need
historical snapshots must project via `buildUIState` (WP-028) after
each step, not retain `G` copies. The existing
`verifyDeterminism` test fixture is the regression guard: the
`stateHash` produced by `replayGame` must be byte-identical before
and after the refactor.

**Rationale:** A prior session attempted to execute WP-063 / EC-071
(Replay Snapshot Producer) and stopped at Pre-Session Gate #4
because `replay.execute.ts` currently exposes only
`replayGame(input, registry): ReplayResult` — an end-to-end function
that loops all moves internally and returns only the final state
plus a hash. `MOVE_MAP` (line 77), `buildMoveContext` (line 98), and
the `ReplayMoveContext` structural interface (line 39) are all
module-local; no per-step callback, no generator, no intermediate
`G` observable from outside. WP-063's `buildSnapshotSequence` needs
per-input stepping with a live `G` reference at each step to call
`buildUIState`; without a step-level export from WP-027, the only
path for WP-063 would be to duplicate `MOVE_MAP` and
`buildMoveContext` into `apps/replay-producer/` or a new engine
file. That is the failure mode this decision exists to prevent: when
a new move is added to `LegendaryGame.moves`, the author must
remember to update two dispatch tables instead of one, and the
legacy `replayGame` path passes existing tests while the new
consumer path silently diverges until a new-move-specific test is
written. Locking "single source of truth for dispatch" now —
before the first duplicate `MOVE_MAP` is written — prevents the
drift.

**Alternatives Considered:**
- **Option A — status quo (rejected):** consumers duplicate
  `MOVE_MAP` + `buildMoveContext` in `apps/replay-producer/` or a
  new file under `packages/game-engine/src/replay/`. Drift risk;
  new moves silently diverge; two bodies of dispatch logic must
  be kept in sync without a compiler check.
- **Option B — expose a context-constructing pair
  (`buildReplayMoveContext` + `dispatchReplayMove`) (rejected):**
  doubles the export surface and forces `ReplayMoveContext` to
  become a public type. WP-063's actual need is one function that
  applies one move — Option B leaks internals that no current
  consumer requires. Follow-up WP can promote the constructor if
  a second consumer surfaces (00.6 Rule 1: duplicate first,
  abstract on third copy).
- **Option C — expose `MOVE_MAP` directly (`export const
  REPLAY_MOVE_MAP`) (rejected):** leaks the `MoveFn` type and the
  internal dispatch topology; invites ad-hoc extension by
  downstream code. Rejected as maximum-surface, minimum-discipline.
- **Option D (accepted) — single named step function
  `applyReplayStep`:** minimum surface area; matches WP-063's
  need exactly; "one function, one job"; `MOVE_MAP` and
  `buildMoveContext` stay file-local; the refactor of
  `replayGame`'s loop collapses two potential dispatch paths into
  one.

**Sub-rules embedded in this decision (do not split into D-6305 /
D-6306 unless a load-bearing reason surfaces):**
- **Step-function state ownership (Q2):** `applyReplayStep`
  mutates `gameState` in place and returns the same reference.
  Cloning is not performed. Consumers wanting historical snapshots
  must project via `buildUIState` after each step. Rationale:
  preserves `replayGame`'s current semantics byte-identically
  (`replay.execute.ts`'s loop at 156–168 already mutates in
  place); cloning per step is expensive on long matches and
  duplicates work `buildUIState` already performs for its
  immutable projection.
- **Step-function purity (inherited from WP-027 / D-0205):** no
  `Date.now`, no `Math.random`, no `performance.now`, no
  `console.*`, no `node:fs*` import, no network, no environment
  access. No `boardgame.io` import in `replay.execute.ts` (the
  file already avoids this; the new export preserves the
  invariant). RNG semantics unchanged — the step function
  inherits the reverse-shuffle determinism-only semantics per
  D-0205.
- **`ReplayMoveContext` scope (Q4):** remains a file-local
  structural interface in `replay.execute.ts`. Not exported; not
  re-declared in `replay.types.ts`; not added to the engine
  barrel. Dead surface area until a consumer actually imports it.

**Scope:**
- Does **not** change live-match RNG semantics. D-0205 remains in
  force unchanged. The step function inherits the reverse-shuffle
  determinism-only semantics from the module-level contract.
- Does **not** introduce or modify `ReplayInputsFile` (WP-063's
  scope; Q5 marks it out of scope for WP-080).
- Does **not** bump `boardgame.io` version (locked at `^0.50.0`).
- Does **not** modify `ReplayInput`, `ReplayMove`, `ReplayResult`,
  `DeterminismResult`, `computeStateHash`, or `verifyDeterminism`
  — all WP-027 contract surfaces remain frozen.

**Follow-up actions required by this decision:**
- Execute WP-080 / EC-072 to add the step-level export and
  refactor `replayGame`'s loop. Commit prefix `EC-072:` (P6-36 —
  never `WP-080:`).
- Resume WP-063 / EC-071 execution (existing session prompt;
  amended at Pre-Session Gates #4 and Authority Chain in the
  same SPEC commit that created this decision) once WP-080 lands.
  Pre-Session Gate #4 then passes because `applyReplayStep` is
  visible at `packages/game-engine/src/index.ts`.
- If WP-079 has not yet been drafted as an EC, that drafting is
  a **separate** SPEC session and a transitive prerequisite to
  WP-080 execution (both packets touch `replay.execute.ts`;
  WP-079 lands first with JSDoc narrowing, WP-080 inherits it
  verbatim).

**References:** WP-027 (harness locked), WP-063 (blocked consumer),
WP-079 (JSDoc narrowing sibling; must land before WP-080), WP-080
(this decision's execution WP), EC-071 (WP-063's checklist;
BLOCKED at Pre-Session Gate #4), EC-072 (WP-080's checklist;
Draft), session-wp063-replay-snapshot-producer.md §Pre-Session
Gates #4 (the amended block), D-0201 (Replay as a First-Class
Feature — the parent decision WP-080 implements), D-0205 (RNG
truth source — unchanged; WP-080 inherits).

**Status:** Active
**Raised:** WP-063 / EC-071 execution session 2026-04-18 (stopped
at Pre-Session Gate #4; user selected "Stop and amend (pre-flight)"
via `AskUserQuestion`)
**Resolved:** 2026-04-18

---

### D-6305 — `ReplayInputsFile` Reconciled with WP-027 Canonical `ReplayMove`; `buildSnapshotSequence` Requires Explicit `playerOrder` + `registry` Parameters

**Decision:** The on-disk `ReplayInputsFile` shape defined by WP-063
uses `moves: readonly ReplayMove[]` (not `inputs: readonly
ReplayInput[]` as the WP literally phrased it) and carries
`playerOrder: readonly string[]` alongside `setupConfig`, `seed`, and
optional `metadata`. The `buildSnapshotSequence` helper signature is
a 6-field `BuildSnapshotSequenceParams` interface (`setupConfig`,
`seed`, `playerOrder`, `moves`, `registry`, optional `metadata`),
which extends the WP's literal 3-field signature with `playerOrder`
(required to derive `numPlayers` for `applyReplayStep`) and
`registry` (a `CardRegistryReader` required by
`buildInitialGameState` at setup time). The CLI `apps/replay-producer`
supplies a minimal inline registry reader
(`{ listCards: () => [] }`) matching the `replay.execute.test.ts` /
`replay.verify.test.ts` precedent — no runtime registry import
under the `cli-producer-app` category (D-6301).

**Rationale:** WP-063's literal field-naming was internally
inconsistent. `snapshots.length === inputs.length + 1` (from the
WP's acceptance criteria) requires each "input" to be a per-step
move record, which is `ReplayMove` in WP-027's canonical naming —
not `ReplayInput` (WP-027's top-level match record containing
`seed`, `setupConfig`, `playerOrder`, and `moves`). Reconciling
the file field with `ReplayMove` avoids a confusing parallel
naming convention and preserves the WP-027 invariant that
"`ReplayInput` is the full match record, `ReplayMove` is one
step." The `playerOrder` and `registry` additions are
non-negotiable preconditions for `buildInitialGameState` and
`applyReplayStep` — omitting them would force module-level
singletons or hidden globals that break the helper's purity
guarantee and the `cli-producer-app` "no registry imports at
runtime" rule. Accepting `seed` in the helper params (even though
`applyReplayStep` inherits determinism-only semantics per D-0205
and ignores seed) preserves spec fidelity and gives a natural
metadata passthrough for the CLI.

**Alternatives Considered:**
- **Option A — `ReplayInputsFile = ReplayInput & { version: 1;
  metadata? }` intersection type (rejected):** elegant structural
  reuse, but surfaces WP-027's mutable array types (`playerOrder:
  string[]`, `moves: ReplayMove[]`) — the WP-063 spec asks for
  `readonly` arrays, which the intersection cannot enforce without
  widening or wrapping.
- **Option B — hide `registry` behind a module-scoped singleton
  (`let currentRegistry; export setRegistry(...)`) (rejected):**
  breaks the helper's pure-function guarantee; makes tests
  non-composable; introduces hidden global state that
  determinism-only testing cannot distinguish from real regressions.
- **Option C — omit `playerOrder`, derive `numPlayers` from
  `moves` (e.g., `new Set(moves.map(m => m.playerId)).size`)
  (rejected):** fragile — fails when only one player has moved so
  far or when move list is empty; forces the helper to make
  assumptions about the match's player population from
  partial-history data.
- **Option D — rename the field to `inputs: readonly ReplayMove[]`
  (preserves WP's literal field name, contradicts WP-027 naming)
  (rejected):** invites future drift; every downstream consumer
  (WP-064 and beyond) must then either alias `ReplayMove` to
  `ReplayInput` locally or explain the naming divergence. Cleaner
  to align with the canonical per-step record name.

**Scope:**
- `packages/game-engine/src/replay/replaySnapshot.types.ts`
  (`ReplayInputsFile` shape)
- `packages/game-engine/src/replay/buildSnapshotSequence.ts`
  (`BuildSnapshotSequenceParams` shape)
- `apps/replay-producer/src/cli.ts` (minimal inline registry
  reader; CLI param mapping)

**Forward guard:** if a future replay-producer consumer surfaces
that legitimately requires live registry resolution, the CLI's
minimal reader is a single swap site; the engine helper stays
unchanged because `registry` is already a first-class param. Any
such swap must be a follow-up WP with an explicit rationale,
not a silent CLI edit.

**Status:** Active
**Raised:** WP-063 / EC-071 execution session 2026-04-19 (during
implementation — WP's literal 3-field helper signature proved
insufficient to call the upstream engine helpers)
**Resolved:** 2026-04-19

---

## Decision Points Raised by `MOVE_LOG_FORMAT.md`

The three entries below originate from the forensics report
`docs/ai/MOVE_LOG_FORMAT.md` (commit `1d709e5`, 2026-04-18), which
established that no persisted move-log format exists in the repo today
and that these three forks are the preconditions for any Phase 6
persistence / replay Work Packet.

Entries are resolved **in place** rather than moved: when an entry
flips to `Status: Active` it keeps its original options, adds an
`Options rejected:` block, and records the resolution date. The
`Status:` field on each entry is the source of truth — some entries
in this section may be Open, others Active. A Work Packet that
depends on one of these decisions may not be scoped while its
corresponding entry's status is `Open`.

---

### D-0203 — Canonical Persisted Artifact for Move Log / Replay

**Decision:** *TBD.*

**Scope:** Determines which artifact the server persists for every match
so that a match can be reconstructed after the process restarts and so
that replays, spectator late-join, and reconnection have a single
source of truth to read from. Narrows what Recommendation 1 of
`MOVE_LOG_FORMAT.md` actually builds.

**Options:**
- **(A) boardgame.io-native.** Persist `initialState + LogEntry[]`
  retrieved via the framework's `fetch({ initialState: true, log: true })`
  contract. Store via a `db:` adapter passed to `Server({...})` in
  `apps/server/src/server.mjs` — today this call sets no `db:` and
  defaults to `InMemory` (lines 90-98).
- **(B) engine-native.** Persist the engine's existing `ReplayInput`
  (`packages/game-engine/src/replay/replay.types.ts:34-39`). Requires a
  new server-side writer that derives `ReplayInput.moves` from
  observable match activity, since nothing constructs `ReplayInput`
  from a live match today.
- **(C) both, with one derived from the other.** Persist one as
  canonical and materialise the other on demand.

**Trade-offs:**
- (A) reuses the framework's own per-move record and the reducer's
  native replay path; no parallel contract. But it couples replay
  forever to boardgame.io's `LogEntry` shape and requires adopting or
  writing a `StorageAPI.Async` subclass (`bgio-postgres` or custom).
- (B) keeps replay inside the engine's pure-helper layer and isolates
  it from framework upgrades, but duplicates the framework's work and
  leaves `LogEntry[]` as write-only Diagnostic data. The current
  `replayGame` also hardcodes a reverse-shuffle and ignores
  `ReplayInput.seed` — see D-0205.
- (C) is the most flexible but carries the largest maintenance surface
  (two shapes, two writers, a projection between them). Must specify
  which is authoritative for conflict resolution.

**Dependencies:**
- Blocks Work Packets scoped from `MOVE_LOG_FORMAT.md` Recommendation 1
  (persistent adapter) and Recommendation 3 (unify engine replay harness
  with framework log).
- Interacts with D-0204 (privacy) and D-0205 (RNG truth source): any
  persisted artifact is only useful if it can (a) be stored without
  leaking hidden information and (b) actually reproduce live matches.

**Target resolution:** Phase 6 — Verification, UI & Production. This
decision gates the persistence-adapter WP implied by
`MOVE_LOG_FORMAT.md` Recommendation 1 and is a precondition for
WP-063 (Replay Snapshot Producer) producing artifacts with a
committed shape. Non-binding target — adjustable via a follow-up
DECISIONS.md entry if Phase 6 re-sequences.

**Status:** Open — Awaiting decision
**Raised:** `MOVE_LOG_FORMAT.md` Decision Point 1, 2026-04-18

---

### D-0204 — Privacy Boundary for Persisted Logs

**Decision:** *TBD.*

**Scope:** Establishes whether a persisted move log (whichever artifact
D-0203 selects) contains hidden information, and if so, who can see it.
Gates `redact` declarations on moves and any dual-view log tooling.

**Context from `MOVE_LOG_FORMAT.md` Gap #8:** today, no Legendary Arena
move declares the boardgame.io `redact` property. The only `redact*`
code path lives in `packages/game-engine/src/ui/uiState.filter.ts` and
is an **audience-scoped UI filter**, not a persistence policy. Today's
eight registered moves appear to operate on public `CardExtId` strings
only, but `ReplayMove.args: unknown` carries no enforced contract.
Future moves that select from a hidden zone or reveal top-of-deck
would leak through a naive persisted log.

**Options:**
- **(A) Public-only persistence.** Redact private args at write time;
  persisted logs are safe for any audience. Forbids reconstructing
  fully-faithful replays of games with hidden information.
- **(B) Privileged persistence.** Persist raw logs including hidden
  information; restrict read access to admin / tournament / post-hoc
  analysis roles only. Enables full replay but expands the trust
  surface of whatever system reads persisted matches.
- **(C) Dual-view persistence.** Store two projections per match — a
  redacted public log and a privileged full log. Most expensive but
  lets replay tooling pick the right view per audience.

**Trade-offs:**
- (A) is the simplest threat model but silently loses replay fidelity
  the moment a move touches hidden state. Would also require all
  future moves to be audited for private-info leaks in their args.
- (B) is the easiest to implement but makes persistent storage the
  new attack surface for information leaks; any bug in read-path
  access control leaks hidden information across matches.
- (C) matches the UI layer's existing audience-based filtering
  (`filterUIStateForAudience`, D-0302), but doubles write-path cost
  and requires careful derivation so the two views do not drift.

**Dependencies:**
- Must be resolved before any WP scoped from Recommendation 1 of
  `MOVE_LOG_FORMAT.md` begins implementation.
- Reinforces, and is a concrete application of, D-0302
  (*One UIState, many audiences*). A persisted log is a second,
  different projection surface that needs its own audience model.

**Target resolution:** Phase 6 — Verification, UI & Production.
Co-resolves with D-0203; also gates WP-064 (Game Log & Replay
Inspector), which must know which audiences can read which fields.
Reinforced again in Phase 7 by WP-053 (Competitive Score Submission
& Verification). Non-binding target.

**Status:** Open — Awaiting decision
**Raised:** `MOVE_LOG_FORMAT.md` Decision Point 2, 2026-04-18

---

### D-0205 — RNG Truth Source for Replay

**Decision:** **Option (C) — the engine's `replayGame` / `verifyDeterminism`
harness is explicitly scoped as *determinism-only / debug-only* tooling.**
It is not, and does not claim to be, a live-match replayer. Any future
"replay a specific match" feature builds on a separate pipeline that
rehydrates boardgame.io's seeded `ctx.random.*` — most likely via
D-0203 option (A), but that choice remains open.

**Decision rationale:** The repo currently lacks a canonical persisted
RNG truth source. `replayGame` hardcodes a reverse-shuffle and ignores
`ReplayInput.seed` — this is deterministic but is not the RNG that
drives live matches. Claiming "replay" capability without reconciling
the two would be dishonest and would silently invite downstream WPs to
build on a false foundation. Scoping the harness to determinism
verification keeps the tooling **honest and useful** (it still proves
the engine reducer is deterministic given fixed RNG) while deferring
the architectural RNG decision to the same pipeline that resolves
D-0203. Minimum-commitment resolution: costs only a doc change on
two exports; no storage choice, no framework coupling, no engine
behavior change.

**Scope:** Fixes which RNG source is authoritative for replay
reconstruction. Today this is ambiguous: live matches use boardgame.io's
seeded `ctx.random.*` (required by D-0002 and `.claude/rules/architecture.md`
§Determinism), but `packages/game-engine/src/replay/replay.execute.ts:119-123`
hardcodes a reverse-shuffle and ignores `ReplayInput.seed`. The stored
seed exists, but is not honoured — the two paths disagree.

**Context from `MOVE_LOG_FORMAT.md` Gap #4:** this gap is flagged as a
**blocker** for any "replay live matches" Work Packet. A replay feature
that runs against the current harness does not reproduce live-match
outcomes, it reproduces a parallel mock-RNG universe.

**Options:**
- **(A) boardgame.io `ctx.random.*` is canonical.** Replay reconstructs
  via the framework reducer, with the framework's seeded RNG. The
  engine's own `replayGame` becomes derived (or is retired) per D-0203
  option C. Requires persisting whatever the framework needs to
  rehydrate `ctx.random` (typically the initial seed on
  `initialState`, plus any RNG state carried in `ctx`).
- **(B) Engine seed is canonical.** Replace the reverse-shuffle in
  `replay.execute.ts:121-123` with a seeded deterministic PRNG driven
  by `ReplayInput.seed`. Decouples replay from the framework but
  requires the live engine to *also* source randomness from this PRNG,
  or the two diverge — which contradicts D-0002.
- **(C) Explicitly debug-only harness.** Keep `replayGame` as it is
  (reverse-shuffle, ignored seed) but label it *debug-only /
  determinism-only* — it proves the engine is deterministic given a
  fixed RNG, nothing more. Any future "replay a specific match" WP
  builds a separate pipeline under option (A).

**Trade-offs:**
- (A) is the least invasive for the engine today and aligns replay
  with the framework's existing contract. Tightens the repo's
  dependency on boardgame.io's RNG semantics surviving future upgrades.
- (B) would make the engine's replay path self-contained, but creates
  a second RNG source of truth that must be kept in lockstep with
  live play — exactly the drift D-0002 is meant to prevent.
- (C) is cheapest: it costs only a doc change and a label on
  `verifyDeterminism`. It does, however, permanently narrow what the
  existing replay harness claims to do, and pushes the "replay live
  matches" feature onto a different (as-yet-unscoped) stack.

**Options rejected:**
- **(A) boardgame.io `ctx.random.*` is canonical.** Rejected *for now*
  (not permanently) — this remains the natural fit for a future
  "replay live matches" feature, but selecting it today would
  pre-commit D-0203 to option (A) without the architectural review
  D-0203 deserves. Revisit when D-0203 resolves.
- **(B) Engine seed is canonical.** Rejected. Makes the engine
  maintain a second RNG source of truth in lockstep with
  boardgame.io's live RNG — exactly the silent-divergence failure
  mode D-0002 (*Determinism Is Non-Negotiable*) exists to prevent.
  No path forward unless boardgame.io's seeded `ctx.random.*` is
  replaced wholesale, which is out of scope.

**Follow-up actions required by this decision:**
- `packages/game-engine/src/replay/replay.execute.ts` and
  `replay.verify.ts`: add JSDoc + header warnings on `replayGame` and
  `verifyDeterminism` stating the harness does not replay live-match
  RNG (uses a fixed reverse-shuffle; `ReplayInput.seed` is ignored).
  **Completed 2026-04-19 at commit `1e6de0b` under EC-073 / WP-079.**
- `docs/ai/MOVE_LOG_FORMAT.md` Gap #4: remains accurate (the gap
  *describes* the condition this decision resolves) — no edit
  required.
- `packages/game-engine/src/index.ts` public exports of
  `replayGame` / `verifyDeterminism`: no API change; doc-only.
- These actions should land as a tiny Work Packet — *"Label engine
  replay harness as determinism-only"* — scoped via the normal
  00.3 lint gate + `WORK_INDEX.md` flow. **Landed as WP-079 under
  EC-073 on 2026-04-19; see `STATUS.md` entry "WP-079 / EC-073
  Executed — Replay Harness Labeled Determinism-Only".**

**Dependencies:**
- Blocker for any `MOVE_LOG_FORMAT.md` Recommendation that claims
  "replay live matches" (Recommendations 1 and 3). This decision
  *closes* the blocker by re-scoping the claim, not by building a
  replayer — the replayer itself remains a future WP gated on D-0203.

**Target resolution:** Phase 6 — Verification, UI & Production. This
is the blocker flagged by `MOVE_LOG_FORMAT.md` Gap #4 for any Phase 6
"replay live matches" feature (WP-063, WP-064, and the unscoped
persistence-adapter WP). Must resolve before or alongside D-0203.
Non-binding target.

**Status:** Active
**Raised:** `MOVE_LOG_FORMAT.md` Decision Point 3, 2026-04-18
**Resolved:** 2026-04-18

---

### D-6401 — Keyboard Focus Pattern for Stepper-Style Interactive Components: `tabindex="0"` Root + Listeners-on-Root

**Decision:** Stepper-style interactive components in
`apps/arena-client/` (and any future client app) carry `tabindex="0"`
on the component's root element AND mount their keyboard event
listeners (e.g., `@keydown`) directly on that root element rather
than on individual child controls. The first instance of this
pattern is `<ReplayInspector />`
(`apps/arena-client/src/components/replay/ReplayInspector.vue`).
Each listener call site MUST carry a `// why:` comment citing this
decision and documenting the focus order.

The pattern applies to any component that exposes a
discrete-step navigation surface to the keyboard:

- `←` / `→` step prev/next
- `Home` / `End` jump first/last
- (future) `Space` toggle play/pause for any auto-play extension
- (future) `PageUp` / `PageDown` jump-by-page for long sequences
- (future) numeric range scrub via screen-reader announcements

It does NOT apply to leaf form controls
(buttons, inputs, range sliders) that already receive focus
naturally — those keep their own `aria-label` and rely on the
browser's default keyboard handling.

**Rationale:** WP-064 introduced the first client component that
takes discrete keyboard steps over a sequence (the replay
inspector's snapshots index). Pre-flight confirmed via direct
review of WP-061's `<BootstrapProbe />` and WP-062's six HUD
components (`<ArenaHud />`, `<TurnPhaseBanner />`,
`<SharedScoreboard />`, `<ParDeltaReadout />`,
`<PlayerPanelList />`, `<PlayerPanel />`, `<EndgameSummary />`)
that no prior keyboard-stepper precedent existed — WP-062's HUD
components are passive display surfaces with `aria-label` /
`aria-live` / `aria-current` attributes only, none carrying
`tabindex` or `@keydown` handlers.

The pattern was selected over the alternative
"per-control listeners with manually-managed focus refs" because:

1. **Determinism of focus order:** root-level focus + root-level
   listeners means the screen-reader announces the inspector once
   when focused, then ArrowLeft/ArrowRight/Home/End act on the
   inspector as a unit. Per-control listeners would announce each
   button on focus traversal, which is verbose for a stepper.
2. **No per-control focus juggling:** the alternative requires
   a `ref` for each interactive control plus JavaScript-side focus
   management (`button.focus()`) on each step, which is brittle and
   adds state that is invisible to the template.
3. **Mirror of native scrubbers:** every other replay/timeline tool
   (video players, audio scrubbers, IDE timeline scrubbers) uses
   the same root-focus-plus-arrow-keys idiom. Users coming from
   those tools have correct expectations on first use.
4. **Accessibility tree stability:** `tabindex="0"` on the root
   creates exactly one tab stop for the whole stepper, regardless
   of how many controls it contains. Adding or removing a control
   (e.g., a future "loop" toggle) does not change the tab order
   for downstream components.

The leaf controls inside the inspector (the buttons and the range
input) keep their own `aria-label` so screen-reader users can
discover them by browsing within the inspector. They are
keyboard-operable independently — clicking via Enter / Space on a
focused button works the same as the top-level keyboard map. The
root-level `@keydown` is additive, not exclusive.

**Sub-rule embedded in this decision (do not split into D-6402):**
the keyboard map MUST clamp at sequence boundaries, never wrap.
Stepping past index 0 or past `lastIndex` is a no-op. Wrapping
from last to first would present unrelated game state as
"adjacent" — a confusing UX for replay inspection. The
ReplayInspector's `setIndex(target)` helper enforces this via a
`clamp(target)` call that returns `0` for negative targets and
`lastIndex` for over-range targets. Future stepper components
inherit this clamp-not-wrap rule.

**Implications for future client WPs:**

- Any future stepper component (moves timeline, scenario
  selector, tutorial carousel, spectator-position chooser)
  follows this pattern verbatim. The session prompt should cite
  D-6401 in §Locked Values, and the EC should require a
  `// why:` comment on the `tabindex="0"` declaration and on the
  root-level `@keydown` handler.
- Components that are NOT steppers (passive display surfaces like
  the WP-062 HUD subcomponents) continue to omit `tabindex` and
  `@keydown`. They rely on the browser's default focus order
  through their interactive children.
- A future spectator surface that wraps `<ReplayInspector />`
  inherits the keyboard map for free. Wrapping the inspector in
  another `tabindex="0"` container would create a redundant tab
  stop — don't do that.
- A future "playback controls" component for live-match catchup
  may extend the map with `Space` for play/pause; the prop seam
  for this exists today as `enableAutoPlay?: boolean` on the
  inspector (default `false`; no implementation yet — gated to
  keep WP-064 scope to one session per its §Out of Scope).

**Alternatives rejected:**

- **Per-control `@keydown` listeners on each button + the range
  input:** rejected because `Home` / `End` would need a global
  listener anyway (no single button "owns" jump-to-first), so
  the per-control approach degenerates to a mixed pattern that's
  harder to reason about than uniform root listeners.
- **Document-level `@keydown` listener on the body:** rejected
  because it would steal keys from any other focused element
  (text inputs in modals, text in forms). Root-level scoping is
  the right granularity.
- **`role="application"` on the root:** rejected because the
  inspector is a content surface, not an application widget that
  intercepts every key. `role="group"` (the chosen role) plus
  the explicit `aria-label="Replay inspector"` correctly
  describes the structure.
- **No keyboard support, mouse-only:** rejected because WP-064
  AC + Vision §17 (Accessibility & Inclusivity) require full
  keyboard operation.

**Implementation locations:**

- Pattern definition: `apps/arena-client/src/components/replay/
  ReplayInspector.vue` — root `tabindex="0"` + `@keydown="onKeyDown"`
  + clamping `setIndex(target)` helper.
- `// why:` comment in the same file documents the focus order
  and cites D-6401.
- Locked-value reference: `docs/ai/execution-checklists/EC-074-
  log-replay-inspector.checklist.md` §Locked Values "Keyboard
  focus pattern (D-6401)".
- Pre-flight reference: `docs/ai/preflight-wp064.md` (READY
  verdict 2026-04-19) §Likely New Decisions identified D-64NN
  as the placeholder; this entry assigns the real number.
- Post-mortem reference: `docs/ai/post-mortems/01.6-WP-064-log-
  replay-inspector.md` §6 hidden-coupling audit confirms no
  WP-061 / WP-062 precedent existed.

**Status:** Immutable
**Raised:** WP-064 / EC-074 pre-flight, 2026-04-19
**Resolved:** 2026-04-19 at commit `76beddc`

---

### D-3401 — `packages/game-engine/src/versioning/` Classified as Engine Code Category

**Decision:** The new `packages/game-engine/src/versioning/` subdirectory
(introduced by WP-034 / EC-034) is classified as the **`engine`** code
category per `docs/ai/REFERENCE/02-CODE-CATEGORIES.md`. All files in
the subdirectory inherit the engine-category invariants:

- No `boardgame.io` import at runtime.
- No `@legendary-arena/registry` import at runtime.
- No `apps/server/` import at runtime.
- No `Math.random()`, `performance.now()`, or `Date.now()`. (One
  documented exception: `versioning.stamp.ts` calls
  `new Date().toISOString()` for `savedAt` metadata — this is a
  load-boundary call, structurally distinct from the gameplay-affecting
  `Date.now()` rule, and is the only place in the subdirectory that
  reads the wall clock. Documented with a `// why:` comment in the
  file and re-stated in the WP-034 session prompt §Locked Values.)
- No I/O (filesystem, network, environment access).
- No `.reduce()` with branching logic.
- No `require()` — ESM only.
- `.test.ts` extension on test files.

**Rationale:** Versioning logic is a pure engine concern: it operates
on persisted artifact wrappers (`VersionedArtifact<T>`) before the
engine reducer ever sees the payload, and it produces no side effects
beyond returning typed structured results. It does not touch `G`, does
not import the framework, does not query persistence storage (storage
is the server/app layer's concern — see §Layer Boundary). The
classification mirrors six prior precedents that established the
"new engine subdirectory needs a D-entry" pattern:

- D-2706 — `src/replay/` (WP-027 replay harness)
- D-2801 — `src/ui/` (WP-028 UIState contract)
- D-3001 — `src/campaign/` (WP-030 campaign framework)
- D-3101 — `src/invariants/` (WP-031 production invariants)
- D-3201 — `src/network/` (WP-032 network sync)
- D-3301 — `src/content/` (WP-033 content authoring toolkit)

D-3401 is the seventh instance of the same pattern; the precedent is
fully steady-state. Pre-flight P6-25 (WP-033) explicitly anticipated
this entry as the next instance.

**Sub-rule embedded in this decision (do not split into D-3402):**
the `new Date().toISOString()` exception in `versioning.stamp.ts` is
strictly limited to the `savedAt` metadata field. Any other call to
`new Date()` or `Date.now()` in `src/versioning/` is a violation of
the engine-category invariants. The exception applies because:

1. Save-time stamping is at the persistence boundary, not in
   gameplay code paths.
2. The `savedAt` field is metadata about when an artifact was
   serialized, not gameplay state — it does not affect determinism
   of any in-game decision.
3. Load-time validation (`checkCompatibility`, `migrateArtifact`)
   reads the `savedAt` field as a string only — it never invokes
   `new Date()` or any clock function.
4. The forbidden-call grep gate in Verification Step 3 of the WP-034
   session prompt uses pattern `Math\.random|performance\.now|Date\.now`
   — `new Date().toISOString()` is structurally distinct and does not
   match.

**Implications for future engine WPs:**

- Any future versioning extension (additional axes, migration
  functions, snapshot diff helpers) lives in `src/versioning/` under
  the same D-3401 classification — no new D-entry needed.
- Save/load adapters that bridge `VersionedArtifact<T>` to actual
  storage backends (PostgreSQL rows, R2 objects, file artifacts)
  do NOT live in `src/versioning/` — they belong in the server /
  app layer per the Layer Boundary. The engine never imports those
  adapters; they import the engine.
- Future engine subdirectories continue to need D-entries (D-3501,
  D-3601, …) per the established pattern. The pre-flight check for
  this is now codified in P6-25 (01.4 Established Patterns).

**Alternatives rejected:**

- **No classification (skip the D-entry):** rejected. The pattern
  has six prior precedents; skipping breaks the audit trail. A
  future code-category boundary check would have no documented
  authority for the subdirectory's invariants.
- **Classify as `setup`:** rejected. `setup` is for code that runs
  inside `Game.setup()` and produces `G.*` fields. Versioning runs
  before `Game.setup()` (artifact validation gates load) and never
  produces `G` fields.
- **Classify as `infra`:** rejected. `infra` is for non-shipped
  code (scripts, hooks, CI). Versioning ships to players as part
  of the engine bundle.
- **Allow `Date.now()` instead of `new Date().toISOString()`:**
  rejected. `Date.now()` returns a numeric millisecond count that
  would need separate ISO-string conversion for the `savedAt` field;
  `new Date().toISOString()` is the single-step idiom that produces
  the correct serialized form directly. Both call shapes are
  semantically equivalent at the boundary but the latter avoids an
  intermediate `number` representation.

**Implementation locations:**

- Pattern reference: `docs/ai/REFERENCE/02-CODE-CATEGORIES.md`
  §`engine` directory list — `packages/game-engine/src/versioning/`
  added alongside the six prior precedents.
- Locked-value reference: `docs/ai/execution-checklists/EC-034-versioning.checklist.md`
  + `docs/ai/invocations/session-wp034-versioning-save-migration.md`
  §Locked Values + §Non-Negotiable Constraints.
- Wall-clock exception documentation: `versioning.stamp.ts` `// why:`
  comment on the `new Date().toISOString()` call, citing this D-entry
  by number and quoting the sub-rule above.

**Status:** Immutable
**Raised:** WP-034 / EC-034 pre-flight, 2026-04-19
**Resolved:** 2026-04-19 (pre-flight SPEC commit lands D-3401 +
02-CODE-CATEGORIES.md update before EC-034 execution begins)

---

### D-3501 — `packages/game-engine/src/ops/` Classified as Engine Code Category

**Decision:** The new `packages/game-engine/src/ops/` subdirectory
(introduced by WP-035 / EC-035) is classified as the **`engine`** code
category per `docs/ai/REFERENCE/02-CODE-CATEGORIES.md`. All files in
the subdirectory inherit the engine-category invariants:

- No `boardgame.io` import at runtime.
- No `@legendary-arena/registry` import at runtime.
- No `apps/server/` import at runtime.
- No cross-subdirectory import from any other `packages/game-engine/src/*/`
  subdirectory (ops is a leaf of the engine-export DAG — it depends on
  nothing engine-internal).
- No `Math.random()`, `performance.now()`, `Date.now()`, or `new Date()`.
  **No sub-rule carve-outs** (unlike D-3401, which carved out
  `new Date().toISOString()` for `savedAt` metadata in
  `versioning.stamp.ts`). The ops subdirectory ships pure type
  definitions only — no load-boundary wall-clock need exists.
- No I/O (filesystem, network, environment access).
- No `.reduce()` with branching logic.
- No `require()` — ESM only.
- `.test.ts` extension on test files (none expected at MVP — WP-035
  ships zero new tests per the RS-2 lock).

**Rationale:** Operational counter types and environment / severity
literal unions are pure engine-layer metadata contracts. They describe
the shape of observability data that downstream tooling (server layer,
future ops dashboard, future WP-042 deployment procedures) will
construct, increment, and persist — but the engine itself never reads
or writes a counter instance at runtime (the RS-1 option-(a) lock in
the WP-035 session prompt). The types live in the engine package
because they form part of the engine's public API surface consumed by
the server layer; they do not live in `apps/server/` because the
server layer is wiring-only and does not own contract definitions.

The classification mirrors seven prior precedents that established the
"new engine subdirectory needs a D-entry" pattern:

- D-2706 — `src/replay/` (WP-027 replay harness)
- D-2801 — `src/ui/` (WP-028 UIState contract)
- D-3001 — `src/campaign/` (WP-030 campaign framework)
- D-3101 — `src/invariants/` (WP-031 production invariants)
- D-3201 — `src/network/` (WP-032 network sync)
- D-3301 — `src/content/` (WP-033 content authoring toolkit)
- D-3401 — `src/versioning/` (WP-034 versioning & save migration)

D-3501 is the eighth instance of the same pattern; the precedent is
fully steady-state. Pre-flight P6-25 (WP-033) anticipates each new
engine subdirectory as its own D-entry.

**Sub-rule embedded in this decision:** WP-035 ships no runtime
`OpsCounters` instance anywhere in the engine. `ops.types.ts` exports
types only — no constants, no functions, no module-level state. Any
future need for an engine-side counter instance (module-level
singleton, field on `G`, or side-effect surface) is out of scope for
D-3501 and requires a separate D-entry. This preserves the
"engine does not auto-heal — monitoring is passive" invariant stated
in WP-035 §Non-Negotiable.

**Implications for future engine WPs:**

- Any future ops-metadata type (additional counter fields, new
  deployment environments, new severity levels, or new observability
  surfaces) lives in `src/ops/` under the same D-3501 classification —
  no new D-entry needed, but a coordinated update to the three
  `docs/ops/*.md` files is required alongside any shape change.
- Server-layer code that constructs and increments `OpsCounters`
  instances lives in `apps/server/` (wiring) or a future ops tooling
  package, never in `src/ops/`. `src/ops/` is the contract; the
  construction and mutation sites are elsewhere.
- A future P4 severity level or a fifth deployment environment is a
  governance change (new D-entry + coordinated doc update), not a
  silent code extension. The two closed literal unions
  (`DeploymentEnvironment`, `IncidentSeverity`) are intentionally
  small and locked at MVP.
- Future engine subdirectories continue to need D-entries (D-3601,
  D-3701, …) per the established pattern.

**Alternatives rejected:**

- **No classification (skip the D-entry):** rejected. Eight prior
  precedents (through D-3401); skipping breaks the audit trail.
- **Classify as `infra`:** rejected. `infra` is for non-shipped code
  (scripts, hooks, CI). Ops types ship to players as part of the
  engine bundle (consumed by the server layer at runtime; exported on
  the public API surface via `packages/game-engine/src/index.ts`).
- **Place ops types under `apps/server/`:** rejected. The server layer
  is wiring-only per §Layer Boundary — it consumes engine contracts,
  it does not own them. Moving ops types to the server would couple
  the contract surface to a specific deployment target and block
  reuse by future tooling (CLI producers, replay inspectors, ops
  dashboards).
- **Allow a module-level `currentOpsCounters` singleton in
  `ops.types.ts`:** rejected. A mutable module-level instance in the
  engine bundle would violate the "engine does not auto-heal"
  invariant, risk accidental inclusion in `G` via closure capture, and
  break JSON-roundtrip assertions for any future state snapshot that
  enumerates engine exports. Pure-type classification keeps the
  boundary clean (RS-1 option-(a) in the WP-035 session prompt).
- **Classify as `setup`:** rejected. `setup` is for code that runs
  inside `Game.setup()` and produces `G.*` fields. Ops types never
  participate in `Game.setup()` and never produce `G` fields.

**Implementation locations:**

- Pattern reference: `docs/ai/REFERENCE/02-CODE-CATEGORIES.md`
  §`engine` directory list — `packages/game-engine/src/ops/` added
  alongside the seven prior precedents.
- Locked-value reference:
  `docs/ai/execution-checklists/EC-035-release-ops.checklist.md`
  + `docs/ai/invocations/session-wp035-release-deployment-ops-playbook.md`
  §Locked Values + §Non-Negotiable Constraints.
- Runtime-ownership lock (RS-1 option (a)): WP-035 session prompt
  §Locked Values "Runtime ownership" subsection — `ops.types.ts`
  ships no runtime value.

**Status:** Immutable
**Raised:** WP-035 / EC-035 pre-flight, 2026-04-19
**Resolved:** 2026-04-19 (pre-flight SPEC commit lands D-3501 +
02-CODE-CATEGORIES.md update + WP-035 session prompt before EC-035
execution begins)

---

### D-3502 — Four Deployment Environments: `dev` → `test` → `staging` → `prod`

**Decision:** Legendary Arena supports exactly **four** deployment
environments, ordered sequentially in a single promotion path:

1. `dev` — engine & content development.
2. `test` — full validation, replay, migration checks.
3. `staging` — production-identical dry run.
4. `prod` — live players.

The ordering is locked by the typed contract
`DeploymentEnvironment = 'dev' | 'test' | 'staging' | 'prod'` exported
from `packages/game-engine/src/ops/ops.types.ts`. Promotion moves one
step right at a time; skipping is forbidden. Adding a fifth environment
is a governance change (new D-entry + coordinated update to the typed
union + `docs/ops/DEPLOYMENT_FLOW.md`), not a silent code extension.

**Rationale:** each environment tests a different aspect of the
release, and the four-environment count is the minimum that covers all
four aspects without overlap.

- `dev` is where authoring happens — no shared traffic, no persistence
  guarantees across `dataVersion` bumps.
- `test` is the first shared environment; it runs the full
  `RELEASE_CHECKLIST.md` gate suite on every build. Synthetic fixtures
  and replay suites provide coverage; no player traffic.
- `staging` exists because `test` cannot prove production-identical
  behavior — `test` accepts synthetic data shapes that production will
  never see. `staging` forces the promotion artifact to confront the
  real production topology, configuration, and data shape before any
  player reaches it.
- `prod` is the terminal environment; every artifact here is immutable
  (see D-3503) and carries a full audit trail.

Fewer environments leaves a gap: merging `test` and `staging` sacrifices
the production-parity gate; merging `dev` and `test` removes the shared
gate-suite boundary. More environments (a separate QA tier, a public
beta ring, dynamic per-PR deployments) creates promotion fatigue and
dilutes the sequential-promotion discipline without adding a new
testable aspect. The four-environment count is the minimum sufficient
covering.

**Implications:**

- The four-element literal union in `ops.types.ts` is closed at MVP;
  the TypeScript compiler enforces exhaustive handling at every
  consumer site.
- `docs/ops/DEPLOYMENT_FLOW.md` is the authoritative prose
  specification of each environment's purpose, promotion trigger,
  approval gate, and artifact identity (byte-identical from `test`
  through `prod`).
- Future ops tooling (logging, alerting, metrics collection) that
  discriminates by environment consumes this union directly — no
  environment-identifying string literal should appear anywhere except
  the one `DeploymentEnvironment` declaration.

**Alternatives rejected:**

- **Three environments** (merge `test` + `staging`): rejected. Loses
  the production-identical dry-run gate; the `staging → prod` promotion
  becomes "deploy and hope" without a parity check.
- **Five or more environments** (add `qa`, `beta`, or per-PR): rejected
  at MVP. Adds promotion steps without adding new testable aspects.
  Revisitable post-MVP if a concrete signal gap emerges.
- **Dynamic environments** (spun up per branch or per pull request):
  rejected. Breaks the sequential-promotion discipline; introduces
  environments that never receive a gate-suite run and never feed
  back into the release checklist's audit trail.

**Status:** Immutable
**Raised:** WP-035 / EC-035 pre-commit review (follow-up SPEC), 2026-04-19
**Resolved:** 2026-04-19 (this entry satisfies the WP-035 Definition
of Done requirement that the four-environment rationale be captured in
`DECISIONS.md`; prose restatement is retained in
`docs/ops/DEPLOYMENT_FLOW.md` §The Four Environments)

---

### D-3503 — No Hot-Patching In Production

**Decision:** Production accepts **only** versioned artifact
deployments. Ad-hoc edits to a running `prod` process, manual patches
to a running container, side-loaded configuration changes, and
"just-this-once" SQL fixes are all forbidden. If production behavior
needs to change, the change is authored, stamped via `stampArtifact`,
and promoted through the full `dev → test → staging → prod` path
defined in D-3502.

When production behavior must change immediately, the only two valid
responses are:

1. **Roll back** to the previous known-good artifact (D-0902). This is
   the path for broken production deployments.
2. **Fast-track a new versioned artifact** through the release
   checklist as quickly as the gate suite allows. This is the path for
   new behavior that production needs.

There is no third option.

**Rationale:** the no-hot-patching rule is load-bearing for three
independent architectural properties:

- **Determinism of rollback (D-0902).** "Reversible to what" is only
  well-defined if the rollback target is a named, stamped artifact
  that passed the full release checklist. A hot-patch is by definition
  unstamped — there is no prior artifact to revert to without
  reconstructing the pre-patch state from memory, which breaks the
  D-0902 guarantee that every deployment is reversible without data
  loss.
- **Audit trail.** Every production change must be traceable to an
  artifact, a `VersionedArtifact` stamp, a release note, and a human
  sign-off (`RELEASE_CHECKLIST.md` Gate 7). A hot-patch bypasses all
  four; post-incident reconstruction becomes guesswork.
- **Staging parity.** `staging` is a production-identical dry run
  (D-3502). If production accepts a hot-patch that `staging` never
  saw, the parity guarantee is broken and the entire promotion path
  loses its meaning for the next release. The hot-patch contaminates
  all subsequent deployments, not just itself.

This decision enforces D-1002 (Immutable Surfaces Are Protected) at the
deployment boundary. Release artifacts are the immutable surface;
production is the environment that receives them; hot-patching would
mutate the surface in place.

**Implications:**

- Deployment tooling must not expose any operation that writes directly
  to a running production process. Container orchestration, SSH access,
  database console access, and dynamic configuration reloads are
  constrained to the rollback + fast-track-release paths above.
- Emergency procedures for severe incidents route through D-0902
  rollback, not through hot-patching. The incident-response playbook
  (`docs/ops/INCIDENT_RESPONSE.md`) classifies "corrupted game state"
  as P0 with immediate rollback — not immediate hot-patch.
- `staging` gets the same no-hot-patching treatment for the same
  reason: a `staging` hot-patch breaks the identity guarantee between
  `staging` and `prod` artifacts, making the `staging → prod`
  promotion decision unreliable.
- `test` and `dev` may accept destructive editing (rebuild from
  scratch), but any behavior observed there must still be reproduced
  via a promoted artifact before it reaches `staging` or `prod`.

**Alternatives rejected:**

- **Allow emergency hot-patches with post-hoc justification:**
  rejected. The "emergency" carve-out erodes quickly — every hot-patch
  author believes their situation is an emergency. The absence of a
  carve-out is itself the discipline.
- **Allow configuration hot-reloads (but not code):** rejected at MVP.
  Configuration is Class 2 data per `ARCHITECTURE.md` §Section 3 and
  is bundled into the versioned artifact; splitting configuration out
  for live reload would require a separate versioning axis and a
  separate audit trail. Revisitable if a concrete need emerges.
- **Allow hot-patches gated by a second-human-approval:** rejected.
  The approval adds friction without restoring the three properties
  (rollback determinism, audit trail, staging parity) that hot-patching
  breaks.

**Status:** Immutable
**Raised:** WP-035 / EC-035 pre-commit review (follow-up SPEC), 2026-04-19
**Resolved:** 2026-04-19 (this entry satisfies the WP-035 Definition
of Done requirement that the no-hot-patching rationale be captured in
`DECISIONS.md`; prose restatement is retained in
`docs/ops/DEPLOYMENT_FLOW.md` §Why No Hot-Patching)

---

### D-3504 — Release Validation Gates and Runtime Invariant Checks Are Complementary

**Decision:** The release-time validation gates defined in
`docs/ops/RELEASE_CHECKLIST.md` and the runtime invariant checks
defined in `packages/game-engine/src/invariants/` (WP-031) are
**complementary, not redundant**. Each operates on a different signal
window and serves a different purpose:

- **Release gates run before** the artifact reaches any environment.
  They catch problems in the artifact itself (failing tests, invalid
  content, non-deterministic replays, broken migrations, missing
  version stamps). Failure blocks promotion; no player is ever
  exposed to a gate-failing artifact.
- **Runtime invariants run during** a live match. They catch problems
  that emerge from the interaction of a gate-passing artifact with
  live state (unexpected zone contents, serializability violations,
  counter inconsistencies, lifecycle-state anomalies). Failure fires a
  P0 incident (`docs/ops/INCIDENT_RESPONSE.md`) and triggers rollback
  per D-0902.

A well-run release never fires a runtime invariant in production. When
a runtime invariant **does** fire in production, it is evidence that a
release gate missed something — the invariant is the final line of
defense against a class of bug the release pipeline did not anticipate.
Both layers are required; removing either one creates a silent failure
mode.

**Rationale:** the two layers differ on every axis that matters:

| Axis | Release gates | Runtime invariants |
|---|---|---|
| When | Pre-promotion | During live match |
| Signal source | Test fixtures, validation reports | Live `G` state transitions |
| Failure mode | Block promotion (artifact never ships) | Fire P0 incident (rollback) |
| Cost of miss | High (players see broken behavior) | Very high (players experience the failure) |
| Cost of false positive | Low (author re-runs the gate) | Medium (rollback churn) |
| Coverage model | Representative sample of inputs | Exhaustive check of actual state |

Release gates cannot prove runtime safety for inputs the gate suite
never sampled; runtime invariants cannot prevent a broken artifact
from reaching production. Each defends the other's blind spot.

**Implications:**

- Adding a new runtime invariant (WP-031 or a follow-up WP) does not
  justify removing a corresponding release gate. A runtime invariant
  that fires in production is already a P0; preventing the P0 at
  release time is strictly cheaper.
- Conversely, adding a new release gate does not justify removing a
  corresponding runtime invariant. Release gates run against a
  representative sample; live play exercises the full input space.
- When a production incident is traced to a gap in either layer, the
  post-mortem must decide which layer to strengthen — and typically
  strengthens both. A release gate catches the specific defect; a
  runtime invariant catches the class of defect.
- The incident-severity mapping in `docs/ops/INCIDENT_RESPONSE.md`
  reflects this relationship: P0 (corrupted game state) inherits
  D-0802 fail-loud semantics because the runtime invariant is
  declaring that a load-bearing assumption is broken — a signal no
  release gate can produce, because the gates run before load.

**Alternatives rejected:**

- **Collapse release gates into runtime invariants ("fail fast at
  load"):** rejected. Release gates catch problems before any player
  is affected; collapsing them means every release defect becomes a
  production incident.
- **Collapse runtime invariants into release gates ("test
  exhaustively before release"):** rejected. Live state space exceeds
  any practical test fixture; runtime invariants exist precisely
  because the full input space cannot be sampled offline.
- **Treat runtime invariants as warnings rather than P0 triggers:**
  rejected. A runtime invariant firing means the engine has detected a
  state shape that contradicts a locked assumption; continuing to
  serve the match risks cascading corruption. The fail-loud response
  per D-0802 is load-bearing.

**Status:** Immutable
**Raised:** WP-035 / EC-035 pre-commit review (follow-up SPEC), 2026-04-19
**Resolved:** 2026-04-19 (this entry satisfies the WP-035 Definition
of Done requirement that the relationship between release gates and
runtime invariants be captured in `DECISIONS.md`; prose restatement is
retained in `docs/ops/RELEASE_CHECKLIST.md` §Relationship to runtime
invariant checks)

---

### D-4201 — WP-042 Scope Reduction: PostgreSQL Seeding Sections Deferred Until Foundation Prompt 03 Is Revived

**Decision:** WP-042 (Deployment Checklists) ships with the
PostgreSQL checklist **scope-reduced** from eight sections to four.
The four surviving sections are:

- §B.1 — Pre-conditions (`DATABASE_URL`, connection health, Node
  v22+, `pg` package)
- §B.2 — Migration execution (three real migrations:
  `001_server_schema.sql`, `002_seed_rules.sql`,
  `003_game_sessions.sql`)
- §B.6 — Rules data seeding verification (`legendary.rules` +
  `legendary.rule_docs` + FTS vector — this is the one seeding path
  WP-042 can verify because `002_seed_rules.sql` IS a real migration)
- §B.7 — Schema-structure verification (tables/columns/FK/indexes
  exist, NOT row counts)

The four **deferred** sections are:

- §B.3 — Lookup table seeding
- §B.4 — Group and entity seeding
- §B.5 — Card record seeding
- §B.8 — Re-seeding procedure

All four deferred sections depend on `scripts/seed-from-r2.mjs` and
the corresponding `pnpm seed` npm script. **Neither has ever
existed in the repo.** They were specified by Foundation Prompt 03
(`docs/archive prompts-legendary-area-game/03-game-seed-data.md`
§Deliverable 1 + §Deliverable 4), but Foundation Prompt 03 was
never executed. Git history (`git log --all --oneline --diff-filter=A
-- "scripts/*seed*"`) shows no commit that ever introduced a seed
script. The only `seed`-adjacent scripts in `scripts/` are
`upload-themes-to-r2.mjs` (uploads theme content, not database
seeding) and `validate-r2.mjs` (validates R2, does not seed).

A future work packet — provisionally **WP-042.1** — revives
Foundation Prompt 03: creates `scripts/seed-from-r2.mjs`, adds the
`"seed"` entry to root `package.json`, authors any additional
`legendary.*` lookup-table migrations that the seed script requires
(`004_upsert_indexes.sql` with UNIQUE constraints on `slug`
columns, per the Foundation Prompt 03 deliverable 3), and then
ships the deferred checklist sections §B.3 / §B.4 / §B.5 / §B.8.

**Rationale:** three options were considered at WP-042 pre-flight.

- **(a) Scope reduction (this decision).** Ship what can be shipped
  without the missing script. Preserves WP-042's Documentation
  class (zero new tests, zero new runtime code). Delivers real
  verifiable value for the R2 checklist + schema structure
  verification today. Defers the seed-dependent verification
  cleanly to a successor WP.
- **(b) Block WP-042 until Foundation Prompt 03 is revived.**
  Rejected. Foundation Prompt 03 is itself unscheduled; blocking
  WP-042 on an unscheduled prerequisite creates an open-ended
  wait and forecloses on shipping the R2 checklist, which has
  real standalone value.
- **(c) Pull Foundation Prompt 03 into WP-042's scope.** Rejected.
  Would change WP-042 class from Documentation to
  Code+Documentation. Adding `scripts/seed-from-r2.mjs` violates
  the WP-042 §Non-Negotiable "documentation only" rule; invalidates
  the RS-2 test-count lock (script would need tests); changes the
  commit topology from `SPEC:` governance-only to `EC-042:`
  code-plus-docs. The PS-51 form-(2) precedent (prose-in-
  produced-doc with back-pointer D-entry) was drafted for
  WP-042's style of doc-heavy work; folding in runtime code
  changes the class entirely and invalidates the pre-flight's
  §Non-Negotiable lock.

Option (a) is the minimum-change path that preserves both WP-042's
design invariants and the broader architectural commitment (D-4203
below will codify the documentation-only invariant).

**Implications:**

- The PostgreSQL checklist produced by WP-042 MUST include a clear
  "deferred sections" pointer at the top, enumerating §B.3 / §B.4
  / §B.5 / §B.8 as awaiting WP-042.1. A future reader of the
  checklist must not be left wondering why seeding verification
  appears incomplete — the deferral must be visible and cited.
- Lookup-table row-count verification (`legendary.sets` = 40,
  `legendary.card_types` = 37, etc.) is DEFERRED. WP-042's
  §B.7 verifies schema structure (table/column/FK/index
  existence), not row populations. A production deployment could
  pass WP-042's checklist with zero rows in every lookup table —
  this is intentional at this scope reduction. Row-count
  verification is the essence of the deferred sections.
- `WORK_INDEX.md` MUST gain a WP-042.1 entry alongside the WP-042
  `[x]` flip, so the deferral is tracked as durable work-item
  state, not lost in a commit message.
- `STATUS.md` §Current State entry for WP-042 MUST mention the
  scope reduction explicitly — "WP-042 shipped scope-reduced per
  D-4201; seeding checklist sections deferred to WP-042.1" or
  similar.

**Pre-flight archaeology evidence:**

- `git log --all --oneline --diff-filter=D -- scripts/seed-from-r2.mjs`
  returns no output (script never deleted — because it never
  existed).
- `grep -rln "seed-from-r2" --include="*.mjs" --include="*.ts"`
  returns no output in runtime code; matches appear only in
  documentation files (WP-042 spec, legacy Foundation Prompt 03,
  and now this D-entry).
- `grep -n "seed" package.json` returns no matches — no
  `"seed":` npm script entry exists.
- `git log ac8486b -1 --format="%B"` (the Foundation Prompt 02
  commit) enumerates what DID land:
  `001_server_schema.sql`, `002_seed_rules.sql`,
  `003_game_sessions.sql`, `scripts/migrate.mjs`, `render.yaml`
  updates, `package.json` `pnpm migrate` script. No seed script;
  no `004_upsert_indexes.sql`; no `005_lobby_columns.sql`. The
  five-migration locked list in the pre-amendment WP-042 body was
  drafted against Foundation Prompt 03's paper specs, not
  against Foundation Prompt 02's actual output.

**Alternatives rejected:**

- **Rewrite the seed script in WP-042 scope:** rejected (option (c)
  above; class change).
- **Silently drop the deferred sections without a D-entry:**
  rejected. The deferral is load-bearing; a future reader must be
  able to trace why §B.3–§B.5 and §B.8 are missing without
  reconstructing the archaeology from scratch. D-4201 is the
  durable record of the scope reduction; the checklist's pointer
  cites it by number.
- **Defer WP-042 in its entirety:** rejected. The R2 checklist
  (§A.1–§A.7) has no dependency on the missing seed script; it
  ships complete. The four surviving PostgreSQL sections verify
  real shipped infrastructure (three real migrations + rules FTS
  + schema structure). Shipping today is strictly better than
  waiting for Foundation Prompt 03 revival to unblock both
  checklists.

**Status:** Immutable
**Raised:** WP-042 pre-flight session, 2026-04-19
**Resolved:** 2026-04-19 (pre-flight SPEC commit lands D-4201 +
WP-042 amendments + EC-042 amendments + WP-042 session prompt
before EC-042 execution begins)

---

### D-4202 — Legacy UI-Rendering-Layer Verification Excluded From Deployment Checklists (Back-Pointer)

**Decision:** The legacy operational checklist at
`docs/archive prompts-legendary-area-game/00.2b-deployment-checklists.md`
included a §C that verified a specific browser-side rendering
library's integration — color constants, zone layout, card rendering
layers, modal components. WP-042 **explicitly excludes** that §C
from the deployment checklist suite. UI-layer rendering concerns
are not deployment prerequisites; they are UI-layer implementation
details and belong in a UI-layer deployment checklist authored (if
ever) by a separate UI-layer work packet.

This entry is the P6-51 **form (2)** back-pointer for the full
rationale. The authoritative prose of the exclusion lives in the
produced checklist itself at
[`docs/ai/deployment/r2-data-checklist.md`](deployment/r2-data-checklist.md)
§Scope (the "Explicitly out of scope" block), which cites this
D-entry by number as its governance anchor.

**Rationale (summary):**

- **Layer Boundary discipline.** Per `ARCHITECTURE.md §Layer
  Boundary (Authoritative)`, UI rendering and server / ops
  deployment are separate concerns. A deployment checklist that
  verifies UI-rendering-layer integration would cross the boundary
  and conflate release-time infrastructure verification with
  runtime UI correctness.
- **UI-implementation volatility.** The legacy §C was specific to a
  single rendering library's API surface. UI implementations evolve
  (framework migrations, renderer swaps, component rewrites) far
  more frequently than infrastructure checklists can track; binding
  a deployment gate to a specific rendering-library API guarantees
  stale-checklist drift.
- **Testing surface overlap.** UI-rendering correctness is already
  covered by the UI package's own test suites (`apps/arena-client`,
  `apps/registry-viewer`) in the `pnpm -r test` baseline enforced
  by `docs/ops/RELEASE_CHECKLIST.md` Gate 1. Duplicating that
  coverage inside a deployment checklist would create a second
  source of truth for UI-rendering correctness and invite drift
  between the two.

**Alternatives rejected:**

- **Port legacy §C verbatim into the deployment checklist:**
  rejected (Layer Boundary violation + library-specific coupling).
- **Translate legacy §C into library-agnostic UI-rendering
  assertions:** rejected. "Library-agnostic UI rendering
  verification" is a useful concept but it belongs in a UI-layer
  work packet, not in a server / ops deployment packet. WP-042 is
  Documentation class under the Server / Operations layer; mixing
  layers would re-open the scope-reduction question that D-4201
  resolved.
- **Leave the legacy §C's absence undocumented:** rejected. A
  future reader comparing WP-042's output to the legacy source
  document would see the missing §C and either reintroduce it
  unknowingly or waste effort tracing why it was dropped. D-4202
  is the durable anchor that makes the exclusion load-bearing and
  auditable.

**Implications:**

- A future UI-layer work packet that needs a UI-rendering
  deployment checklist must create a **new** checklist file (e.g.,
  `docs/ai/deployment/ui-rendering-checklist.md`) with its own
  scope, guardrails, and Layer Boundary compliance; it must **not**
  retrofit UI-layer checks into `r2-data-checklist.md` or
  `postgresql-checklist.md`.
- `docs/ops/RELEASE_CHECKLIST.md` Gate 5 (UI contract unchanged or
  versioned) remains the release-time surface for UI-layer
  correctness. D-4202 does not reduce the coverage of Gate 5; it
  clarifies that UI-rendering verification is **not** a §A / §B
  responsibility.

**Status:** Immutable
**Raised:** WP-042 execution session, 2026-04-19
**Resolved:** 2026-04-19 (EC-042 execution commit lands D-4202 +
the `r2-data-checklist.md` §Scope exclusion prose together)

---

### D-4203 — WP-042 Is Documentation-Class, Not Code-Class (Layer-Boundary Invariant)

**Decision:** WP-042 (Deployment Checklists) is classified as
**Documentation class** under the Server / Operations layer, and
this classification is load-bearing. The WP ships:

- two new files under `docs/ai/deployment/`,
- one additive line in `docs/ai/ARCHITECTURE.md`,
- two additive back-pointer lines in `docs/ops/RELEASE_CHECKLIST.md`,
- two new D-entries in `docs/ai/DECISIONS.md` (D-4202 + D-4203),
- one new post-mortem under `docs/ai/post-mortems/`.

It does **not** ship any of the following, and must not in any
amendment that preserves the D-4203 classification:

- New runtime code (`.ts`, `.mjs`, `.js`) anywhere in the repo.
- New `scripts/` files — in particular, no
  `scripts/seed-from-r2.mjs`; the temptation to "helpfully" create
  that script in-scope is explicitly forbidden by this D-entry.
- New `package.json` entries (no `"seed":` npm script; no new
  dependencies).
- New migration SQL files under `data/migrations/`.
- New tests — the repo-wide test baseline is locked at
  `436 engine / 526 repo-wide / 0 failing` across the execution of
  WP-042 (RS-2 lock in the EC-042 pre-flight).

**Rationale:** WP-042 is the first deployment-pillar documentation
WP to ship under the EC-framework; its class discipline is the
template that WP-042.1 and future sibling WPs (UI-rendering
deployment checklist, Render-specific runbook, logging / alerting
checklist) should follow when each is opened. Three class-preserving
properties that this D-entry locks:

- **Test-baseline invariance.** Documentation-only WPs must never
  perturb `pnpm -r test` totals. A shifting baseline makes drift
  detection harder for subsequent code-class WPs and creates false
  positives in the `engine count UNCHANGED at 436 / 109 / 0 fail`
  verification step that every Server-/ Ops-layer WP inherits.
- **Commit-topology clarity.** Documentation WPs use the
  three-commit pattern (`SPEC:` pre-flight / `EC-NNN:` execution /
  `SPEC:` governance close) without a tests-passing commit in the
  middle. Code-class WPs typically insert a separate tests commit
  between execution and governance close; preserving the shorter
  three-commit pattern keeps the `WORK_INDEX.md` commit-hash
  column unambiguous for documentation WPs.
- **Layer Boundary stability.** Folding script creation into a
  deployment-documentation WP would drag the WP from Server / Ops
  (where deployment verification lives) into the cross-cutting
  infrastructure layer (where scripts live). D-4201 resolved that
  scope pull-in explicitly; D-4203 codifies the resolution as an
  ongoing invariant rather than a one-time decision.

**Alternatives rejected:**

- **Leave WP-042's class implicit.** Rejected. The session prompt
  for WP-042 repeatedly references "Documentation class" as an
  invariant; making it a first-class DECISIONS.md entry gives
  future work packets a citable anchor instead of forcing them to
  reconstruct the class discipline from session-prompt prose.
- **Generalize the invariant to all Documentation WPs at once.**
  Rejected. D-4203 scopes the invariant specifically to WP-042 so
  that subsequent Documentation WPs can cite D-4203 as precedent
  without being retroactively bound by a rule they did not
  negotiate. Once three or more sibling D-entries exist (e.g.,
  D-4301 for a future UI-rendering checklist, D-4401 for a
  Render-specific runbook), a consolidating cross-WP invariant
  entry may be considered.

**Implications:**

- Any amendment to WP-042 that would add runtime code, a new
  `scripts/` file, a new test, or a new npm dependency requires
  re-opening D-4203 and either superseding it with a new D-entry
  or explicitly carving out an exception with a coordinated
  DECISIONS_INDEX.md row. Silent amendments are a class-discipline
  violation.
- Future deployment-pillar documentation WPs (UI-rendering,
  Render-specific runbook, logging / alerting) should cite D-4203
  as precedent when locking their own class invariants and adjust
  the specific file list to their own scope.
- The post-mortem artifact at
  `docs/ai/post-mortems/01.6-WP-042-deployment-checklists.md`
  captures the execution-time reality of this invariant so it is
  observable in the historical record, not just in the forward-
  looking governance.

**Status:** Immutable
**Raised:** WP-042 execution session, 2026-04-19
**Resolved:** 2026-04-19 (EC-042 execution commit lands D-4203 +
WP-042's four-file deliverable + the §B.7 schema-structure checklist
body, confirming the documentation-class invariant in practice)

---

### D-5601 — Pre-Planning Package Classified as New `preplan` Code Category

**Decision:** `packages/preplan/` is classified under a **new top-level
`preplan` code category**. It is not a subcategory of `engine`, `data-input`,
`client-app`, or `cli-producer-app` — pre-planning is a non-authoritative,
per-client, speculative layer that observes the engine's read-only projections
but never writes to authoritative game state.

**Rationale:** Pre-planning has distinct constraints that none of the existing
categories fully express:

- Unlike `engine`, the preplan layer is **non-authoritative** and client-local.
  It cannot mutate `G`, cannot participate in `boardgame.io` lifecycle, and
  cannot be imported by the engine. Classifying it as `engine` would inherit
  the engine's authority semantics and misrepresent the layer boundary.
- Unlike `data-input`, it performs no I/O, loads no files, and validates no
  card data. It consumes engine type definitions and produces speculative
  in-memory state only.
- Unlike `client-app`, it is a reusable package (`packages/preplan/`), not
  an executable application. Client apps may consume the preplan package,
  but preplan is not itself a bundle target or rendering surface.
- Unlike `cli-producer-app`, it produces no file artifacts and has no
  CLI entry point. All output is in-memory advisory state consumed by UI
  layers within the same client process.

The import matrix for the `preplan` category:

**May:**
- Import type definitions from `@legendary-arena/game-engine` via
  `import type` only (e.g., `CardExtId`).
- Use Node built-ins (for utilities, once runtime code is introduced by
  WP-057 and beyond).
- Read read-only projections of engine state (via UI-layer snapshots;
  never via direct engine runtime imports).
- Use a client-local seedable PRNG for speculative deck shuffling
  (WP-057 scope; not introduced by WP-056).

**Must not:**
- Import `@legendary-arena/game-engine` runtime code (functions, constants,
  helpers) — type-only imports only.
- Import `boardgame.io`, `@legendary-arena/registry`, `apps/server`, any
  `apps/*` package, or `pg`.
- Write to `G`, `ctx`, or any authoritative game state.
- Use `ctx.random.*` (engine randomness is authoritative; preplan uses
  its own client-local PRNG).
- Persist state to any storage (localStorage, sessionStorage, IndexedDB,
  cookies, filesystem, database).
- Be wired into `game.ts`, `LegendaryGame.moves`, phase hooks, or any
  engine lifecycle point — the engine does not know preplan exists.

This follows the **top-level category pattern** established by D-6301
(`cli-producer-app` for `apps/replay-producer/`) and D-6511 (`client-app`
for `apps/arena-client/`), not the engine-subdirectory pattern established
by D-2706 (`src/replay/`), D-2801 (`src/ui/`), D-3001 (`src/campaign/`),
D-3101 (`src/invariants/`), D-3201 (`src/network/`), D-3301 (`src/content/`),
D-3401 (`src/versioning/`), and D-3501 (`src/ops/`). The preplan layer is
architecturally distinct because it lives outside the game engine package
and has different authority semantics.

ARCHITECTURE.md §Layer Boundary (Authoritative) already lists
`packages/preplan/**` as a layer row citing `DESIGN-PREPLANNING.md` as its
specification source; `.claude/rules/architecture.md` §Import Rules already
locks the import matrix. D-5601 extends `02-CODE-CATEGORIES.md` to carry
the same category taxonomy so that pre-flight §Code Category Boundary
Check has an explicit row to verify against.

**Affected WPs:** WP-056 introduces the directory and the four public
type contracts (`PrePlan`, `PrePlanSandboxState`, `RevealRecord`,
`PrePlanStep`) as types-only. WP-057 will introduce the first runtime
code under the `preplan` category (sandbox execution; speculative move
simulation; client-local PRNG for deck shuffling). WP-058 will introduce
disruption detection and invalidation pipelines. WP-059 is deferred per
`DESIGN-PREPLANNING.md §WP-059 Deferral Rationale`. All preplan-hosted
code, whether types or runtime, must continue to obey the `preplan`
category rules above.

**Introduced:** WP-056
**Status:** Immutable

---

### D-8101 — Dead Registry Build Pipeline Deleted, Not Rewritten

**Decision:** The three broken operator scripts under
`packages/registry/scripts/` — `normalize-cards.ts`, `build-dist.mjs`,
and `standardize-images.ts` — are **deleted** by WP-081 rather than
rewritten against the post-WP-003 schemas. The associated
`scripts.normalize` and `scripts.standardize-img` entries in
`packages/registry/package.json` are removed, and the `node
scripts/build-dist.mjs` suffix is trimmed from `scripts.build`, leaving
the registry build as `tsc -p tsconfig.build.json`-only.

**Rationale:** No consumer in the monorepo reads any of the five JSON
artifacts that the deleted pipeline produced (`dist/cards.json`,
`dist/index.json`, `dist/sets.json`, `dist/keywords.json`,
`dist/registry-info.json`). The runtime path for registry data is
`metadata/sets.json` plus per-set `metadata/{abbr}.json` fetched
directly from R2 by `httpRegistry.ts` / `localRegistry.ts`; there is
no precomputed flat artifact on the critical path. The
`dist/image-manifest.json` emitted by `standardize-images.ts` is
likewise unconsumed; `upload-r2.ts` uploads images directly from
`images/standard/` to R2 without relying on the manifest.

Rewriting the pipeline against the current `SetDataSchema` / `FlatCard`
shapes would produce an additional derived artifact with no runtime
consumer, increasing maintenance surface without benefit. The WP-003
schema rewrite is the authoritative data shape for both local and
HTTP loaders; deriving a flattened JSON aggregate from it adds a
second source-of-truth risk (aggregate drifts from per-set files)
with no corresponding read-side benefit.

The discovery anchor is `docs/ai/post-mortems/01.6-WP-055-theme-data-model.md`
§8 item 3, which flagged the dead pipeline as pre-existing breakage
unrelated to WP-055. WP-081 is the eventual follow-up cleanup.

**Affected WPs:** WP-003 (current schema shape is load-bearing),
WP-055 (discovery anchor), WP-081 (execution).

**Introduced:** WP-081
**Status:** Immutable

---

### D-8102 — `registry:validate` Is the Single CI Validation Step

**Decision:** Registry validation runs **exactly once per CI pipeline**,
in the job named `validate` via `pnpm registry:validate`. The redundant
second invocation formerly present in the `build` job under the step
named `"Normalize cards"` (with the misleading comment `# also writes
cards.json + index.json`) is removed. The `build` job is restricted to
`tsc`-compiling the registry source and uploading the `registry-dist`
artifact.

**Rationale:** The `"Normalize cards"` step was a copy of
`pnpm registry:validate` dressed in a misleading name. Its comment
claimed the step also wrote `cards.json` and `index.json`, but
`packages/registry/scripts/validate.ts` writes only
`dist/registry-health.json` — the claim was never true, even
pre-WP-003. The step added no artifact that any following step
consumed; it only re-ran the validation that the earlier `validate`
job already produced as the `registry-health` artifact.

Build and validate responsibilities are **not merged** by WP-081. CI
remains a two-step pipeline: the `validate` job runs the schema /
health checks once and uploads `registry-health.json`; the `build`
job compiles TypeScript types. Future registry-data changes that need
validation at build time must use the upstream `validate` job's
artifact (via `needs: validate` + `download-artifact`), not re-run
validation locally.

**Affected WPs:** WP-081 (execution). Affects `.github/workflows/ci.yml`
job `build` only; jobs `validate`, `build-viewer`, `upload-r2`, and
`publish-npm` are textually unchanged.

**Introduced:** WP-081
**Status:** Immutable

---

### D-6001 — Keyword and Rule Glossary Data Is Display-Only, No Zod Schema
**Decision:** `data/metadata/keywords-full.json` (113 entries,
`{ key, description }[]`) and `data/metadata/rules-full.json` (20 entries,
`{ key, label, summary }[]`) ship without a Zod schema. The files are
consumed only by the registry-viewer for tooltip rendering. Shape drift
shows up as absent or obviously-wrong tooltip text at runtime, not as
silent contract breakage.
**Rationale:** Display text is not a validated contract. Adding a schema
would mandate maintenance (re-infer types, re-export from the registry
package, wire into `pnpm validate`) with no defensive value — the viewer's
fetch already tolerates schema drift by falling back to the tooltip-absent
path. Matches the precedent in `themeClient.ts` (WP-055) where theme JSON
parses directly into display-oriented types without a Zod guard.
**Affected WPs:** WP-060 (execution), any future viewer WP that adds
glossary entries.
**Introduced:** WP-060 / EC-106
**Superseded by:** D-8201 (partial — Zod schema clause only; display-only clause remains)
**Status:** Immutable (partial supersession)

---

### D-6002 — Glossary Data Lives in `data/metadata/` Alongside Registry Metadata
**Decision:** Keyword and rule glossary JSON files live under
`data/metadata/`, the same directory that holds `sets.json`. They are
served from `images.barefootbetters.com/metadata/` at runtime, matching
the registry metadata hosting pattern.
**Rationale:** Glossary definitions are registry-layer *content*, not
game-engine *logic*. Co-locating them with the existing registry metadata
keeps one directory, one R2 prefix, and one upload cadence for viewer data.
Creating a new top-level directory would have introduced classification
ambiguity without any operational benefit.
**Historical-neighbor note (updated 2026-04-21 per WP-084):** the
original D-6002 wording named five additional auxiliary files
(`card-types.json`, `hero-classes.json`, `hero-teams.json`,
`icons-meta.json`, `leads.json`) as historical neighbors of the
glossary JSON in `data/metadata/`. Those five files were deleted by
WP-084 (Commit A `b250bf1`, 2026-04-21) as unused surface area; the
glossary JSON remains co-located with `sets.json` under
`data/metadata/`.
**Affected WPs:** WP-060, WP-084 (historical-neighbor wording update only)
**Introduced:** WP-060 / EC-106
**Status:** Immutable (historical-neighbor wording amended by WP-084 §A-084-01 PS-9)

---

### D-6003 — Glossary Data Is Served From R2 Alongside Card and Theme Data
**Decision:** Both glossary JSON files are uploaded to
`images.barefootbetters.com/metadata/keywords-full.json` and
`images.barefootbetters.com/metadata/rules-full.json` via the same R2 bucket
and manual upload workflow used for card set metadata and theme files. No
separate CDN, no per-file version query string.
**Rationale:** Glossary data shares the registry-viewer's data-fetch
lifecycle — loaded once at startup, cached in module scope, invalidated
only on redeploy. Using the same bucket means one CORS policy, one cache
policy, and one credential set. Diverging would create an operational tax
with no user-visible benefit.
**Affected WPs:** WP-060
**Introduced:** WP-060 / EC-106
**Status:** Immutable

---

### D-6004 — `[keyword:N]` Numeric References Are Resolved by the Viewer at Render Time
**Decision:** Definition text in `keywords-full.json` may contain
`[keyword:N]` markers that reference other keyword IDs in the same file.
The registry-viewer resolves these via `parseAbilityText()` in
`useRules.ts`, the same tokenizer that handles `[icon:X]`, `[hc:X]`,
`[rule:N]`, and `[team:T]` markers. No pre-processing step rewrites token
markup before upload.
**Rationale:** Token markup is preserved verbatim in R2 so that the viewer
can re-render definitions with arbitrary cross-references. Flattening
`[keyword:N]` to plain text at author time would lose the hyperlinking
behavior that makes the glossary panel useful.
**Affected WPs:** WP-060
**Introduced:** WP-060 / EC-106
**Status:** Immutable

---

### D-6005 — Hero Class Descriptions Stay Hardcoded in `useRules.ts`
**Decision:** `HERO_CLASS_GLOSSARY` (5 entries: Covert, Instinct, Ranged,
Strength, Tech) remains hardcoded in
`apps/registry-viewer/src/composables/useRules.ts`. It is **not** migrated
to R2 by WP-060 and is not present in any external or R2 glossary artifact.
**Rationale:** Hero class labels are stable engine-class identifiers that
match `MatchSetupConfig` class semantics. They are bounded (exactly 5),
never edited, and semantically closer to engine-layer enum values than to
editable glossary content. Co-locating them with `lookupHeroClass()` keeps
the one-entry-per-class mapping adjacent to its only consumer.
**Affected WPs:** WP-060
**Introduced:** WP-060 / EC-106
**Status:** Immutable

---

### D-6006 — Canonical Migration Baseline Is the Hardcoded Maps, Not the Upstream JSON
**Decision:** The authoritative source for WP-060's data migration is the
pair of hardcoded Maps `KEYWORD_GLOSSARY` (113 entries) and
`RULES_GLOSSARY` (20 entries) in
`apps/registry-viewer/src/composables/useRules.ts` — not the upstream
`C:\Users\jjensen\bbcode\modern-master-strike\src\data\keywords-full.json`
(102 entries) or `.../rules-full.json` (18 entries) that the Maps
originally diverged from.
**Rationale:** The in-repo Maps include ~30 modifier variants
(`ultimateabomination`, `doublestriker`, `tripleempowered`, etc.), two
generic rule references (`additional mastermind`, `transforms`), and
post-divergence editorial fixes that the upstream files never received.
Re-seeding from upstream would silently regress the modifier-keyword
tooltips that card data in the viewer already depends on.
**Affected WPs:** WP-060
**Introduced:** WP-060 / EC-106
**Status:** Immutable

---

### D-6007 — Glossary Wiring Scope Expansion and Lookup Algorithm Lock
**Decision:** WP-060's scope expansion to modify
`apps/registry-viewer/src/composables/useGlossary.ts` (reactive `allEntries`
rebuild after the async fetch) is authorized under the viewer-scope analog
of `docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md` —
dependency-driven wiring only, no new behavior. Separately, the
algorithmic bodies of `lookupKeyword` and `lookupRule` in `useRules.ts`
are locked: only the backing Map source changes in this migration. The
exact-lowercase → space-hyphen-stripped → prefix / suffix / substring
matcher for `lookupKeyword` and the exact + slugified-fallback matcher for
`lookupRule` are preserved byte-for-byte, with only the identifier
substitution (module-scope holder + null-guard) permitted.
**Rationale:** The reactive `ref` conversion is a strict consequence of
moving from module-eval-time Map construction to post-mount Map
installation — removing the exports that `useGlossary.ts` imported would
have broken compilation without the wiring edit. Preserving the matcher
bodies verbatim defends against regressing ~20 modifier-keyword tooltips
("Ultimate Abomination", "Double Striker", "Triple Empowered", "Focus 2",
"Patrol the Bank", "Danger Sense 3", "Cross-Dimensional Hulk Rampage",
etc.) that a naïve `return fetchedMap.get(lower) ?? null` rewrite would
silently drop.
**Affected WPs:** WP-060
**Introduced:** WP-060 / EC-106
**Status:** Immutable

---

### D-3601 — Simulation Code Category
**Decision:** `packages/game-engine/src/simulation/` (introduced by WP-036 /
EC-036) belongs to the `engine` code category per
`docs/ai/REFERENCE/02-CODE-CATEGORIES.md`. All engine-category rules apply
verbatim: no `boardgame.io` imports, no `@legendary-arena/registry` imports,
no IO (filesystem, network, environment), no `Math.random()`, no
`performance.now()` / `Date.now()` / `new Date()`, no `.reduce()` with
branching logic, no throwing, no `require()` (ESM only), no storing
functions in `G`, `.test.ts` extension on test files.

**Rationale:** Simulation is external consumer tooling that exercises the
engine's full pipeline from outside `boardgame.io` (D-0701: AI is tooling,
not gameplay; D-0702: balance changes require simulation validation). It
mirrors the replay harness pattern (D-2706) — it calls engine APIs via the
same setup-time + move-dispatch + UIState-projection + endgame-scoring
flow as multiplayer, but adds zero gameplay logic. Engine-category
constraints apply verbatim; no new category is needed.

The classification mirrors the eight prior precedents that established the
"new engine subdirectory needs a D-entry" pattern:

- D-2706 — `src/replay/` (WP-027 replay harness)
- D-2801 — `src/ui/` (WP-028 UIState contract)
- D-3001 — `src/campaign/` (WP-030 campaign framework)
- D-3101 — `src/invariants/` (WP-031 production invariants)
- D-3201 — `src/network/` (WP-032 network sync)
- D-3301 — `src/content/` (WP-033 content authoring toolkit)
- D-3401 — `src/versioning/` (WP-034 versioning & save migration)
- D-3501 — `src/ops/` (WP-035 release operations)

D-3601 is the ninth instance of the same pattern; the precedent is fully
steady-state.

**Sub-rule embedded in this decision:** the simulation subdirectory ships
a seeded mulberry32 PRNG as a file-local helper (not exported from the
package). This is the D-2704 capability-gap pattern — `makeMockCtx`
reverses arrays instead of accepting a seed, so deterministic simulation
requires a subdirectory-local PRNG. The mulberry32 helper lives in
`ai.random.ts` and is duplicated (not shared) into `simulation.runner.ts`
per the WP-036 Scope Lock (4 files, no 5th helper file).

**Implications for future engine WPs:**

- Future engine subdirectories continue to need D-entries (D-3701, D-3801,
  …) per the established pattern.
- Any future AI policy (heuristic, MCTS, neural) that plugs into the
  `AIPolicy` interface lives in `src/simulation/` under the same D-3601
  classification — no new D-entry needed unless a new long-lived
  abstraction or category boundary is introduced.
- `AIPolicy` is a function interface — it must never be stored in `G`
  (would violate serialization + the "no functions in G" invariant).

**Alternatives rejected:**

- **No classification (skip the D-entry):** rejected. Eight prior
  precedents; skipping breaks the audit trail.
- **Classify as `infra`:** rejected. `infra` is for non-shipped code
  (scripts, hooks, CI). Simulation ships as part of the engine bundle
  (exported on the public API surface via
  `packages/game-engine/src/index.ts` for external balance tooling
  consumers per D-0702).
- **Place simulation under a new top-level package (e.g.,
  `packages/ai/`):** rejected at MVP. Simulation's only consumer is the
  engine's own contract surface (`ClientTurnIntent`, `UIState`,
  `MatchSetupConfig`, `CardRegistryReader`, `FinalScoreSummary`). A
  separate package would add a cross-package boundary without adding a
  new testable aspect.
- **Classify as `setup`:** rejected. `setup` is for code that runs inside
  `Game.setup()` and produces `G.*` fields. Simulation calls
  `buildInitialGameState` as a consumer; it never participates in
  `Game.setup()` directly.

**Implementation locations:**

- Pattern reference: `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` §`engine`
  directory list — `packages/game-engine/src/simulation/` added alongside
  the eight prior precedents.
- Locked-value reference:
  `docs/ai/execution-checklists/EC-036-ai-playtesting.checklist.md`
  + `docs/ai/invocations/session-wp036-ai-playtesting-balance-simulation.md`
  §Locked Values + §Hard Stops.

**Affected WPs:** WP-036
**Introduced:** WP-036 / EC-036
**Status:** Immutable
**Raised:** WP-036 / EC-036 pre-flight, 2026-04-20
**Resolved:** 2026-04-21 (pre-flight SPEC bundle lands D-3601 +
02-CODE-CATEGORIES.md update + WP-036 §D signature correction + EC-036
amendment + session prompt + session-context bridge before EC-036
execution begins)

---

### D-3602 — AI Uses the Same Pipeline as Humans
**Decision:** The AI playtesting framework (`packages/game-engine/src/simulation/`)
drives the same pipeline that multiplayer uses: `buildInitialGameState`
for setup, `buildUIState` + `filterUIStateForAudience` for the
player-audience projection, `getLegalMoves` enumeration, the static
`MOVE_MAP` dispatch set, and `evaluateEndgame` + `computeFinalScores`
for termination and VP scoring. The AI policy returns a
`ClientTurnIntent` (WP-032 canonical shape) that is dispatched exactly
as a human-submitted intent would be. There is no "AI-only" engine path,
no engine-side hook that branches on whether the caller is human, and no
backdoor that lets the policy read unfiltered G. D-0701 (AI Is Tooling,
Not Gameplay) is enforced by construction.

**Rationale:** Any engine branch that differentiates AI from human would
silently decouple the two — balance measurements would stop reflecting
the experience a human player has. The D-0702 invariant (balance
changes require simulation validation) only holds if the measurement
stack is the same stack players use. Isolating AI behind a different
path would make "simulation says this is fine" uncorrelated with
"players say this is fine." The single-pipeline constraint is the
entire point of WP-036.

**Implications:**

- `AIPolicy.decideTurn` receives a filtered `UIState` and a
  `LegalMove[]` — not `G`, not `ctx`, not the registry. The policy has
  strictly human visibility.
- `runSimulation` never bypasses `validateIntent` conceptually — the
  move dispatch route calls the same move functions the server
  dispatches after `validateIntent` returns ok, and the move functions
  themselves enforce stage gating and args validation. Re-running
  `validateIntent` in simulation would be redundant at MVP since the
  legal-move enumerator already honors the same gates (RS-13 +
  stage-gating table in `.claude/rules/game-engine.md`).
- Future heuristic / MCTS / neural policies plug into the same
  `AIPolicy` interface. They are not special-cased anywhere in the
  engine.
- Any future temptation to "give the AI a peek at G for performance" is
  a D-3602 violation — raise a new D-entry before considering.

**Alternatives rejected:**

- **Separate AI dispatch path:** rejected. Would decouple simulation
  from the live-match pipeline, invalidating the D-0702 balance claim.
- **Full `validateIntent` re-run inside `runSimulation`:** rejected at
  MVP. Double-validation is redundant given the legal-move enumerator
  already honors stage gating; when a future WP introduces
  intent-level invariants that are not reflected in
  `MOVE_ALLOWED_STAGES`, re-running validate becomes the right move.
- **Engine-side AI hook (onAiTurnStart, etc.):** rejected. Violates the
  "functions never in G" invariant and inverts the layer boundary —
  simulation is a consumer, not a participant.

**Affected WPs:** WP-036 and every Phase 7 downstream that consumes the
`SimulationResult` contract (WP-037 → WP-041 simulation tooling;
WP-049 → WP-054 PAR simulation).
**Introduced:** WP-036 / EC-036
**Status:** Immutable
**Raised:** WP-036 / EC-036, 2026-04-21
**Resolved:** 2026-04-21 (EC-036 implementation lands the single-pipeline
simulation runner).

---

### D-3603 — Random Policy Is the MVP Balance Baseline
**Decision:** The MVP implementation of `AIPolicy` is a uniformly random
selector over the legal-move set (`createRandomPolicy` in
`src/simulation/ai.random.ts`). Sophisticated policies (heuristic
priorities, MCTS, neural) are deliberately out of scope for WP-036 and
will land in future Phase 7 WPs that plug into the same `AIPolicy`
interface without refactor.

**Rationale:** A random baseline is the correct first measurement stake
for three reasons:

1. **Signal floor.** Random play reveals whether the engine pipeline is
   even reachable — if the random policy cannot drive a game to
   termination, no heuristic could either. WP-036 establishes that
   signal first.
2. **Sensitivity proxy.** Balance pathologies that show up against
   random play (infinite loops, degenerate win rates, stuck states)
   almost always show up against heuristic play; random-play metrics
   are a fast smoke test for those pathologies.
3. **Interface pressure.** Building random first forces the
   `AIPolicy` + `LegalMove` surface to be policy-agnostic. A heuristic
   baseline would have leaked strategy-specific assumptions into the
   contract (e.g., "the policy gets board scoring metadata"),
   foreclosing future MCTS/neural implementations.

Random is not claimed to be realistic. Its output is a baseline only.
Future balance changes SHOULD be validated against heuristic policies
in addition to random — `SimulationResult.averageScore` under random
policies and under a parked heuristic policy are complementary
measurements, not substitutes.

**Alternatives rejected:**

- **Heuristic as the first policy:** rejected. Heuristic design is a
  separate WP — bundling it with the AI framework violates "one WP,
  one concern" and would push `AIPolicy` to leak strategy-specific
  fields. Heuristic belongs in a follow-up WP gated on a D-entry that
  pins the heuristic's scoring weights.
- **No policy at MVP (framework-only):** rejected. A framework without
  a concrete policy is untestable against real game runs; the 8-test
  suite under `simulation.test.ts` requires a policy to exercise.

**Affected WPs:** WP-036 (random policy ships); future heuristic /
MCTS / neural WPs plug into the same interface.
**Introduced:** WP-036 / EC-036
**Status:** Immutable
**Raised:** WP-036 / EC-036, 2026-04-21
**Resolved:** 2026-04-21

---

### D-3604 — Simulation Seed Reproducibility: Two Independent PRNG Domains
**Decision:** `runSimulation` uses two seeded mulberry32 PRNG domains,
deliberately independent:

1. **Run-level shuffle domain.** A single mulberry32 instance created
   at the top of `runSimulation` from `hashSeedString(config.seed)`.
   Drives every in-game deck reshuffle via the `random.Shuffle`
   hook inside the dispatched move context (Fisher-Yates).
2. **Policy-level decision domain.** Each `createRandomPolicy(seed)`
   call creates its own mulberry32 instance from
   `hashSeedString(policySeed)` closed over inside `decideTurn`.
   Drives the policy's uniformly random legal-move selection.

The two domains are never merged, never share state, and never seed
each other. `config.seed` and each policy's seed are independent
inputs, and the tests MUST be able to reseed either domain without
perturbing the other.

**Rationale:** Coupling the domains would make "does this shuffle
change the AI's next decision?" un-answerable — a reproducibility bug
could manifest in either domain and the test matrix could not
disambiguate. Separating them gives the test suite two orthogonal
levers: "fix the shuffle seed, vary the policy seed" and vice versa.

The hash function is djb2 (inline in both `ai.random.ts` and
`simulation.runner.ts`), chosen for three reasons:

- No crypto dependency (engine category forbids IO / env / external
  libraries in simulation files per D-3601).
- Deterministic: same string input → same 32-bit output, across Node
  versions and OS boundaries.
- Trivially inspectable: ~8 lines; no third-party surface to audit.

Mulberry32 is the PRNG for the same three reasons plus its
reproducibility guarantee (same seed + same call sequence = same
output sequence). It is NOT cryptographic. It addresses the D-2704
capability gap: `makeMockCtx` reverse-shuffles arrays and does not
accept a seed, so the simulation subsystem cannot reuse it for seeded
work.

The djb2 + mulberry32 implementation is **duplicated** across
`ai.random.ts` and `simulation.runner.ts` rather than shared via a 5th
helper file. Per the WP-036 Scope Lock (4 simulation files + 1 test
file), introducing a 5th file requires a WP amendment; the ~20-line
duplication is cheaper than the governance overhead of a new file. If
a third simulation subsystem ever needs the same PRNG, the de-dup
becomes a follow-up WP.

**Implications:**

- Rerunning `runSimulation` with identical `(config, registry)` inputs
  MUST produce a byte-identical `SimulationResult`. The simulation
  test suite (`simulation.test.ts`) enforces this via the
  deterministic-decisions test (test #3).
- Changing the djb2 implementation (even cosmetically) requires an
  amendment — every stored seed string would silently re-hash.
- Changing the mulberry32 implementation requires an amendment for
  the same reason.
- The policy seed is orthogonal to the run seed: two policies with
  the same seed make the same decisions against the same inputs
  (proved by test #3); two policies with different seeds make
  different decisions (proved by test #4).

**Alternatives rejected:**

- **Single shared PRNG:** rejected. Couples shuffle domain to
  decision domain, as described above. Orthogonal seeding is the
  entire point.
- **Share the PRNG via a 5th helper file:** rejected at MVP per the
  WP-036 Scope Lock. Revisit in a follow-up WP if a third consumer
  appears.
- **Use `crypto.getRandomValues` or `node:crypto` for seed hashing:**
  rejected. Engine category forbids IO / env access, and mulberry32
  does not need a cryptographic seed — djb2 is sufficient for a
  reproducible 32-bit integer.
- **Skip seeding entirely; rely on `makeMockCtx`'s reverse-shuffle:**
  rejected. Reverse-shuffle is deterministic but not parameterizable;
  two simulation runs with different intents would produce identical
  shuffles, hiding any shuffle-order sensitivity.

**Affected WPs:** WP-036. Future seeded-RNG consumers in
`src/simulation/` inherit D-3604 — no new D-entry needed — but any new
subdirectory (e.g., a hypothetical `src/simulationHeuristic/`)
requires its own D-entry per the D-3601 family pattern.
**Introduced:** WP-036 / EC-036
**Status:** Immutable
**Raised:** WP-036 / EC-036, 2026-04-21
**Resolved:** 2026-04-21

---

### D-3701 — Beta Types Code Category
**Decision:** `packages/game-engine/src/beta/` (introduced by WP-037 /
EC-037) belongs to the `engine` code category per
`docs/ai/REFERENCE/02-CODE-CATEGORIES.md`. All engine-category rules apply
verbatim: no `boardgame.io` imports, no `@legendary-arena/registry`
imports, no `apps/server/` imports, no cross-subdirectory imports from
any other `packages/game-engine/src/*/` subdirectory (beta is a leaf of
the engine-export DAG — it depends on nothing engine-internal), no IO
(filesystem, network, environment), no `Math.random()`,
`performance.now()`, `Date.now()`, or `new Date()`, no `.reduce()` with
branching logic, no throwing, no `require()` (ESM only), no storing
functions in `G`, `.test.ts` extension on test files (none expected at
MVP — WP-037 ships zero new tests per the pre-flight RS-2 lock).

**Rationale:** The public-beta pillar is intentionally Contract-Only:
it ships three JSON-serializable type declarations (`BetaFeedback`,
`BetaCohort`, `FeedbackCategory`) and two strategy documents
(`docs/beta/BETA_STRATEGY.md`, `docs/beta/BETA_EXIT_CRITERIA.md`). The
types describe metadata artifacts that downstream server/ops tooling
will construct, transport, and persist — but the engine itself never
reads, writes, or stores a `BetaFeedback` instance at runtime. Beta
feedback is metadata-not-state and must never appear as a field of
`LegendaryGameState`. Beta games run the same deterministic engine as
production — there is no "beta mode" branch anywhere. The types live
in the engine package because they form part of the engine's public
API surface (re-exported via `packages/game-engine/src/types.ts` and
`packages/game-engine/src/index.ts`) consumed by future server-layer
feedback collection; they do not live in `apps/server/` because the
server layer is wiring-only and does not own contract definitions.

The classification mirrors nine prior precedents that established the
"new engine subdirectory needs a D-entry" pattern:

- D-2706 — `src/replay/` (WP-027 replay harness)
- D-2801 — `src/ui/` (WP-028 UIState contract)
- D-3001 — `src/campaign/` (WP-030 campaign framework)
- D-3101 — `src/invariants/` (WP-031 production invariants)
- D-3201 — `src/network/` (WP-032 network sync)
- D-3301 — `src/content/` (WP-033 content authoring toolkit)
- D-3401 — `src/versioning/` (WP-034 versioning & save migration)
- D-3501 — `src/ops/` (WP-035 release operations)
- D-3601 — `src/simulation/` (WP-036 AI playtesting)

D-3701 is the tenth instance of the same pattern; the precedent is
fully steady-state. The D-3501 and D-3601 Implications sections
explicitly anticipated this slot ("Future engine subdirectories
continue to need D-entries (D-3701, D-3801, …)").

**Sub-rule embedded in this decision:** WP-037 ships no runtime
`BetaFeedback` instance anywhere in the engine. `beta.types.ts`
exports types only — no constants, no functions, no module-level
state. Any future need for an engine-side feedback instance
(module-level singleton, field on `G`, or side-effect surface) is out
of scope for D-3701 and requires a separate D-entry. This preserves
the "metadata, never stored in G" invariant stated in WP-037
§Non-Negotiable Constraints and in EC-037 §Guardrails. A future WP
that introduces a server-side feedback collection backend wires it in
`apps/server/` (or a future ops-tooling package), never in
`src/beta/`.

**Implications for future engine WPs:**

- Any future beta-metadata type (additional feedback category values,
  new cohort identifiers, expanded severity scale, or new
  beta-phase observability surfaces) lives in `src/beta/` under the
  same D-3701 classification — no new D-entry needed, but a
  coordinated update to `docs/beta/BETA_STRATEGY.md` and
  `docs/beta/BETA_EXIT_CRITERIA.md` is required alongside any shape
  change. Expanding `BetaCohort` or `FeedbackCategory` also requires
  drift-detection coverage if those unions acquire paired canonical
  arrays in the future.
- Server-layer code that constructs, transports, or persists
  `BetaFeedback` instances lives in `apps/server/` or a future
  feedback-collection package, never in `src/beta/`. `src/beta/` is
  the contract; the construction, transport, and persistence sites
  are elsewhere.
- Future engine subdirectories continue to need D-entries (D-3801,
  D-3901, …) per the established pattern. WP-038 (Launch Readiness)
  and WP-039 (Post-Launch Metrics & Live Ops) may introduce their
  own engine subdirectories; each will need its own D-entry.

**Alternatives rejected:**

- **No classification (skip the D-entry):** rejected. Nine prior
  precedents through D-3601; skipping breaks the audit trail and
  establishes a directory precedent that drifts from the category
  model (01.4 §Established Patterns — "Code-category classification
  for new engine subdirectories as pre-flight pre-condition").
- **Classify as `infra`:** rejected. `infra` is for non-shipped code
  (scripts, hooks, CI). Beta types ship to consumers as part of the
  engine bundle (exported on the public API surface via
  `packages/game-engine/src/index.ts` for downstream feedback-
  collection tooling).
- **Place beta types under `docs/beta/` or a separate top-level
  package (e.g., `packages/beta/`):** rejected at MVP. Beta's only
  consumer surface is the engine's own public API (the types flow
  alongside `ClientTurnIntent`, `UIState`, and `MatchSetupConfig`
  into server and tooling layers). A separate package would add a
  cross-package boundary without adding a new testable aspect.
- **Classify as `setup`:** rejected. `setup` is for code that runs
  inside `Game.setup()` and produces `G.*` fields. Beta types never
  participate in setup and never produce runtime state.
- **Allow a module-level `currentBetaFeedback` singleton or an
  in-engine feedback buffer in `beta.types.ts`:** rejected. A mutable
  module-level instance in the engine bundle would violate the
  "metadata, never stored in G" invariant, risk accidental inclusion
  in `G` via closure capture, and break JSON-roundtrip assertions
  for any future state snapshot that enumerates engine exports.
  Pure-type classification keeps the boundary clean (mirrors D-3501
  ops-types sub-rule).
- **Define beta types inline in `apps/server/`:** rejected. The
  server layer is wiring-only per §Layer Boundary — it consumes
  engine contracts, it does not own them. Moving beta types to the
  server would couple the contract surface to a specific deployment
  target and block reuse by future tooling (CLI feedback importers,
  ops dashboards, balance-feedback aggregators that cite D-0702
  simulation alignment).

**Implementation locations:**

- Pattern reference: `docs/ai/REFERENCE/02-CODE-CATEGORIES.md`
  §`engine` directory list — `packages/game-engine/src/beta/` added
  alongside the nine prior precedents.
- Locked-value reference:
  `docs/ai/execution-checklists/EC-037-beta-strategy.checklist.md`
  §Locked Values (BetaFeedback interface, BetaCohort union,
  FeedbackCategory union) + §Guardrails.
- Strategy documents: `docs/beta/BETA_STRATEGY.md` and
  `docs/beta/BETA_EXIT_CRITERIA.md` (produced by EC-037 execution,
  not by this decision).

**Affected WPs:** WP-037
**Introduced:** WP-037 / EC-037
**Status:** Immutable
**Raised:** WP-037 / EC-037 pre-flight, 2026-04-22
**Resolved:** 2026-04-22 (pre-flight SPEC bundle lands D-3701 +
02-CODE-CATEGORIES.md update before EC-037 execution begins)

---

### D-3702 — Beta Access Is Invitation-Only for Signal Quality
**Decision:** The controlled public beta runs on
**invitation-only** access — no anonymous sessions, no walk-up access,
no open signup. Every participant has a personally issued invitation
tied to their beta account. Total concurrent participants across all
cohorts are capped at a pre-committed ceiling well below production
capacity.

**Rationale:** The beta's primary deliverable is **attributable,
structured feedback from known cohorts** (rules-aware tabletop
experts, general-strategy players, passive observers), not breadth.
Open-access would flood the feedback pipeline with low-attribution
noise, dilute cohort-level signal, and make balance-perception
measurement (D-0702-anchored comparison of human win rates against
AI simulation predictions) impossible at the sample sizes the beta
captures. Invitation-only also bounds operational risk: every beta
build stays inside the production release cadence (WP-035) and
remains rollbackable (D-0902) under the same procedures as
production. Signal quality scales poorly with volume; signal
attribution scales poorly with anonymity. Invitation-only is the
only configuration that satisfies both.

**Alternatives rejected:**

- **Open beta with rate-limited signup:** rejected. Rate-limiting
  constrains volume but does nothing to fix attribution. Without
  cohort assignment at invitation time, feedback cannot be filtered
  by `BetaCohort` downstream and the cohort-target-signal breakdown
  in `BETA_STRATEGY.md` §3 collapses.
- **Invitation for cohort 1 + cohort 3, open signup for cohort 2:**
  rejected as an operational complication without a signal-quality
  payoff. The general-strategy cohort is the largest contributor to
  the UX-clarity exit criterion (task-completion rate ≥ 80%);
  unknown-provenance participants would skew that number and the
  confusion-feedback ceiling without a clean provenance audit trail.
- **Paid early-access tier with optional beta participation:**
  rejected. Violates Vision NG-1 (no pay-to-win) and NG-3 (no
  content withheld for competitive advantage) proximity, and would
  couple access to monetization — explicitly forbidden by
  `BETA_STRATEGY.md` §1 non-goal #3 and Out-of-Scope "no
  monetization testing" per WP-037.

**Implementation locations:**

- Strategy document: `docs/beta/BETA_STRATEGY.md` §4 (Access
  Control — invitation-only statement + hard user cap + unique
  build ID + opt-in diagnostics) and the invitation-only rationale
  paragraph.
- Contract: `packages/game-engine/src/beta/beta.types.ts` —
  `BetaFeedback.sessionId` is an opaque identifier (participant
  identity is upstream of the engine, resolved by the server layer
  at invitation acceptance).

**Affected WPs:** WP-037
**Introduced:** WP-037 / EC-037
**Status:** Immutable
**Raised:** WP-037 Definition of Done, 2026-04-22
**Resolved:** 2026-04-22 (Commit B governance close)

---

### D-3703 — Beta Partitions Participants Into Three Cohorts by Expertise and Role
**Decision:** The controlled public beta partitions participants
into **exactly three cohorts** in this locked order:

1. `'expert-tabletop'` — rules-aware, edge-case focused.
2. `'general-strategy'` — UX, clarity, onboarding signal.
3. `'passive-observer'` — spectator and replay usability.

The cohort identifiers match the `BetaCohort` closed literal union
in `packages/game-engine/src/beta/beta.types.ts` verbatim. Adding a
fourth cohort requires a new `DECISIONS.md` entry and a coordinated
documentation update — no silent expansion.

**Rationale:** The three cohorts capture **mutually distinct signal
targets** that cannot be collapsed into a single "beta participant"
pool without losing fidelity:

- Expert tabletop players find rules-interaction defects, trigger-
  ordering anomalies, and rare content combinations that
  general-strategy players rarely trigger.
- General-strategy players find UX friction, tooltip-comprehension
  gaps, and onboarding flows that experts have long internalized
  past.
- Passive observers validate an entirely different UI surface
  (spectator + replay) that active players never see. Vision §18
  (Replayability & Spectation) requires a dedicated cohort; an
  active-only beta would leave spectator UX and late-joining
  semantics unverified.

Sampling all three in parallel produces balanced feedback across the
engine, UI, and replay pillars simultaneously. A single-cohort
(or two-cohort) beta leaves at least one pillar unverified at exit
time, directly blocking the Category 1 / Category 2 / Category 4
exit criteria in `BETA_EXIT_CRITERIA.md`.

**Alternatives rejected:**

- **Two cohorts (experts + general):** rejected. Collapses spectator
  and replay usability into general-strategy, which is a mismatch of
  signal targets. Passive observers provide no active-play data and
  active players provide no passive-observation data; averaging the
  two muddies both signals.
- **Four cohorts with a separate "multiplayer focus" group:**
  rejected at MVP. Vision §4 multiplayer validation (reconnection,
  late-joining, no-desync) is operationalized as binary exit
  criteria in `BETA_EXIT_CRITERIA.md` §4.3 / §4.4 / §4.5 measured
  across **all** cohorts, not concentrated in a separate group.
  A dedicated multiplayer cohort would fragment the signal without
  fixing a measurement gap.
- **Cohorts partitioned by payer status, ownership tier, or
  "founder" rank:** rejected outright. Violates Vision NG-1 (no
  pay-to-win) and NG-3 (no content withheld for competitive
  advantage). The cohort closed literal union is locked precisely
  to prevent this widening.

**Implementation locations:**

- Contract: `packages/game-engine/src/beta/beta.types.ts` —
  `BetaCohort` closed three-member literal union, ordered
  `'expert-tabletop'` → `'general-strategy'` →
  `'passive-observer'` (signal-target sequence).
- Strategy document: `docs/beta/BETA_STRATEGY.md` §3 (User Cohorts
  with signal-target descriptions) and the three-cohorts rationale
  paragraph.
- Exit gate: `docs/beta/BETA_EXIT_CRITERIA.md` §2 (UX clarity
  criterion 2.1 explicitly targets cohort 2 general-strategy
  task-completion rate).

**Affected WPs:** WP-037
**Introduced:** WP-037 / EC-037
**Status:** Immutable
**Raised:** WP-037 Definition of Done, 2026-04-22
**Resolved:** 2026-04-22 (Commit B governance close)

---

### D-3704 — Beta Uses the Same Release Gates as Production
**Decision:** Beta deployments pass through **the same release
gates as production** per `docs/ops/RELEASE_CHECKLIST.md` (WP-035)
— no beta-specific shortcuts. Every beta build completes the full
validation sequence (build-green, test-green, invariant checks,
replay verification, versioning stamp) before deployment, and is
rolled back through the same procedure (D-0902) if any operational
counter (`OpsCounters`, D-3501) trips a threshold.

**Rationale:** Using production gates for beta produces three
reinforcing guarantees:

1. **Defect parity.** Any defect the beta surfaces is a defect the
   same pipeline could have caught in production. Beta-only
   defects that a laxer beta pipeline could permit would mask
   shipping-blockers from the exit criteria evaluation.
2. **Remediation portability.** Any fix shipped to beta is
   directly portable to production without re-validation, because
   both environments are gated identically. A looser beta pipeline
   would force a second, different validation pass at
   beta-to-prod promotion — a governance drift-vector WP-035
   explicitly forecloses.
3. **Rollback consistency.** `docs/ops/DEPLOYMENT_FLOW.md` defines
   the sequential `dev → test → staging → prod` promotion path and
   four rollback rules; beta deployments traverse the same path
   (beta is a production-adjacent environment using the same
   underlying release process). All rollback capabilities from
   WP-035 / D-0902 apply to beta deployments verbatim.

**Alternatives rejected:**

- **Skip Gate 2 / Gate 4 for beta (looser release):** rejected.
  Every gate in `RELEASE_CHECKLIST.md` is a binary pass/fail
  safety check; skipping any of them would invalidate the exit
  criteria (Category 4 "rollback never triggered in final
  deployment" assumes the deployment was gated identically to
  production).
- **Introduce a `beta-release-checklist.md` with a subset of
  gates:** rejected. Creates a governance-drift seam between beta
  and production release processes; any skipped gate becomes a
  permanent asymmetry that future WPs would have to re-bridge.
  Single-checklist discipline is cheaper than dual-checklist
  discipline.
- **Allow a "hotfix without full gate traversal" exception for
  beta:** rejected. Any defect severe enough to warrant a hotfix
  is severe enough to warrant the full gate sequence; shortening
  the gates is the pre-condition for the kind of silent regression
  Vision §14 (Explicit Decisions, No Silent Drift) forbids.

**Implementation locations:**

- Procedure reference: `docs/ops/RELEASE_CHECKLIST.md` — no
  modification by WP-037; beta simply consumes the existing
  gates.
- Procedure reference: `docs/ops/DEPLOYMENT_FLOW.md` — beta
  deployments traverse the same path; no beta-only branch.
- Procedure reference: `docs/ops/INCIDENT_RESPONSE.md` — the P0 /
  P1 / P2 / P3 severity model applies to beta incidents verbatim.
- Strategy document: `docs/beta/BETA_STRATEGY.md` §4 (the
  same-release-gates-as-production rationale paragraph).
- Exit gate: `docs/beta/BETA_EXIT_CRITERIA.md` §4.2 ("rollback
  never triggered in the final deployment") and §Why these
  criteria (Category 4 anchor to D-0902).

**Affected WPs:** WP-037
**Introduced:** WP-037 / EC-037
**Status:** Immutable
**Raised:** WP-037 Definition of Done, 2026-04-22
**Resolved:** 2026-04-22 (Commit B governance close)

---

### D-8201 — Keyword and Rule Glossary Payloads Are Zod-Validated at the Fetch Boundary
**Decision:** `data/metadata/keywords-full.json` and
`data/metadata/rules-full.json` are validated against
`KeywordGlossarySchema` and `RuleGlossarySchema` (both defined in
`packages/registry/src/schema.ts`) at the R2 fetch boundary in
`apps/registry-viewer/src/lib/glossaryClient.ts`. The call uses
`.safeParse(...)` rather than `.parse(...)` — the fetch boundary
remains non-blocking: a schema failure logs a full-sentence
`[Glossary] Rejected <file> from <url>: <path> — <issue.message>.
Panel will show no entries until data is corrected.` warning and
degrades to an empty Map. Network failures still throw so `App.vue`
can catch + continue. Both entry schemas use `.strict()` to reject
unknown fields.
**Rationale:** WP-060 (D-6001) rejected a schema for these files on the
grounds that display drift "shows up as absent or obviously-wrong tooltip
text at runtime, not as silent contract breakage." The 2026-04-21
rulebook-v23 audit that added ten new keywords and mandated a `label`
field invalidated that premise — a malformed R2 publish during the audit
cycle produced an empty Map silently, and the glossary panel disappeared
with no surfaced error. Validation at the fetch boundary surfaces the
defect in operator logs before users notice. `.strict()` is the
author-facing-strict pattern per WP-033 / D-3303: loader schemas accept
shipped-data quirks permissively, but schemas over new editorial
metadata reject unknown fields so typos reach the pre-flight grep rather
than runtime.
**Alternatives rejected:**
- **Leave unvalidated (D-6001 status quo):** rejected. The audit showed
  the silent-empty-Map failure mode is a real hazard.
- **Use `.parse(...)` at the fetch boundary:** rejected. A throw would
  propagate past the App.vue try/catch for network errors and take
  down the card view; the guardrail is explicit in EC-107
  §Guardrails.
- **Schema in the viewer's local `src/registry/`:** rejected. Per
  `.claude/rules/registry.md` §Schema Authority, schemas live only in
  `packages/registry/src/schema.ts`; the viewer imports from there
  via the `@legendary-arena/registry/schema` subpath (A-082-01).
**Supersedes:** D-6001 (partial — Zod schema clause only; display-only clause remains)
**Affected WPs:** WP-082 (introduction), any future glossary-field WP.
**Introduced:** WP-082 / EC-107
**Status:** Immutable

---

### D-8202 — Keyword Entries Carry Required `label` and Optional `pdfPage`; `titleCase()` Heuristic Deleted
**Decision:** `KeywordGlossaryEntrySchema` requires a non-empty
`label` field and accepts an optional positive-integer `pdfPage`
field. Every one of the 123 entries in `keywords-full.json` carries a
`label` sourced verbatim from the rulebook (including
`"S.H.I.E.L.D. Clearance"`, `"Choose a Villain Group"`, `"Grey Heroes"`,
`"Half-Points"`, etc.); 118 also carry a `pdfPage`. The
`titleCase()` heuristic at `useGlossary.ts:94–100` and its two call
sites are deleted. The deduplication block at `useGlossary.ts:52–55` is
also deleted (uniqueness is a JSON contract, enforced at backfill time
and by the alphabetical-by-key invariant).
**Rationale:** WP-060's `titleCase()` helper split camelCase /
hyphens and capitalized each segment. The WP-060 audit documented
five confirmed cases where this broke canonical rulebook
capitalization: `chooseavillaingroup` → `Chooseavillaingroup`,
`shieldclearance` → `Shieldclearance`, `greyheroes` → `Greyheroes`,
`halfpoints` → `Half-points`, plus any punctuation-bearing name. No
heuristic can recover these — explicit `label` fields sourced
verbatim from the rulebook are the only correct answer. The
viewer's `CLAUDE.md` carries the sentence *"Do not infer labels
from keys under any circumstance."* so a future contributor does
not reintroduce a transformation helper.
**Alternatives rejected:**
- **Keep `titleCase()` + add `label` only for the 5 failure cases:**
  rejected. Label authority must live in one place; a per-entry
  label with a heuristic fallback creates two sources of truth.
- **Auto-derive `label` from a server-side enrichment step:**
  rejected. The viewer fetches raw R2 JSON; no enrichment layer
  exists and adding one would blur the registry/viewer boundary.
**Affected WPs:** WP-082 (introduction), any future glossary-authoring WP.
**Introduced:** WP-082 / EC-107
**Status:** Immutable

---

### D-8203 — Rule Entries Carry Optional `pdfPage`; Existing `label` and `summary` Unchanged
**Decision:** `RuleGlossaryEntrySchema` accepts an optional
positive-integer `pdfPage` field alongside the existing required
`label` and `summary`. Every one of the 20 entries in
`rules-full.json` except `asterisk` (no confirmable rulebook page
for the asterisk-symbol convention) carries a `pdfPage`. Existing
`label` and `summary` values are preserved byte-for-byte.
**Rationale:** The rule glossary already had `label` from WP-060
(no capitalization-heuristic problem existed for rules, which were
always authored with explicit labels). Only `pdfPage` needed to
flow through for rulebook deep-links. The EC-107 §Non-Negotiable
"no content changes" guardrail applies: `summary` rewrites — even
rulebook-verbatim ones — are out of scope for WP-082. A pre-session
rewrite of all 20 summaries was detected by the RS-3 diff gate at
Commit A start and quarantined per A-082-02 for a future dedicated
WP.
**Alternatives rejected:**
- **Fold the rulebook-verbatim summary rewrite into WP-082:**
  rejected. Byte-for-byte preservation is the EC guardrail; scope
  creep here would have invalidated the RS-3 gate's binary STOP
  contract.
**Affected WPs:** WP-082 (introduction), future rule-glossary WP (inherits).
**Introduced:** WP-082 / EC-107
**Status:** Immutable

---

### D-8204 — Marvel Legendary Universal Rulebook v23 PDF Is Hosted on R2 at a Version-Pinned URL
**Decision:** The rulebook PDF is hosted at
`https://images.barefootbetters.com/docs/legendary-universal-rules-v23.pdf`
with `Content-Type: application/pdf` and
`Cache-Control: max-age=31536000, immutable`. The URL is
version-pinned by `v23` in the filename — a hypothetical v24
rulebook will be a new file at
`.../legendary-universal-rules-v24.pdf`, not a mutation of this
one. The viewer exposes the URL via a new `rulebookPdfUrl` field
in `apps/registry-viewer/public/registry-config.json`.
**Rationale:** Rulebooks are versioned physical artifacts — a new
edition supersedes the old but both remain authoritative for
specific `pdfPage` values. Immutable cache headers are safe because
the URL itself encodes the version; operators who want to ship a
patched v23 (e.g., to fix a typo) must cache-bust at the filename
level. Co-locating under `images.barefootbetters.com` keeps one
CORS policy and one credential set with the existing metadata
artifacts. The PDF filename is kebab-case with no spaces or
parentheses so it URL-encodes cleanly and copy-pastes without quote
ambiguity.
**Alternatives rejected:**
- **Rulebook as a mutable `.pdf` at a stable URL with cache
  busting via `?v=`:** rejected. Invalidates the immutability
  guarantee and forces client-side version awareness that isn't
  otherwise needed.
- **Rulebook as a rendered `.md` with anchor fragments:** attempted
  by operator at upload time, reverted per A-082-03. Markdown
  doesn't support `#page=N` fragment navigation in native browser
  viewers; the `.md` URL would have shipped broken deep-links.
**Affected WPs:** WP-082 (introduction); future WPs that reference
rulebook deep-links inherit this URL pattern.
**Introduced:** WP-082 / EC-107
**Status:** Immutable

---

### D-8205 — Rulebook Deep-Links Use RFC 3778 `#page=N` with Mandatory `target="_blank"` and `rel="noopener"`
**Decision:** The glossary panel renders an anchor below each
entry with a `pdfPage` whose href is
`${rulebookPdfUrl}#page=${pdfPage}`, exactly matching the
[RFC 3778 §3](https://datatracker.ietf.org/doc/html/rfc3778#section-3)
open-parameter syntax supported by Chrome, Firefox, Edge, and
Safari native PDF viewers. The anchor carries `target="_blank"`
and `rel="noopener"` mandatorily, plus `@click.stop` to prevent
the parent `<li @click>` from firing `scrollToEntry` when the
link is clicked. Anchor rendering is gated by
`entry.pdfPage !== undefined && rulebookPdfUrl` — when either side
is absent the anchor is silently omitted (no warning, no fallback
UI, no banner).
**Rationale:** `rel="noopener"` is a hard security guardrail —
without it the new tab can manipulate `window.opener` in the
parent frame. `target="_blank"` + `rel="noopener"` are therefore
a paired contract, never one without the other. `@click.stop` is
required because the entire `<li>` already has a click handler
(scrollToEntry) — without `.stop` the click would both navigate to
the PDF and scroll the panel. Silent absence is the contract for
the missing-config case so operators can deliberately ship the
viewer without the rulebook anchor (e.g., during a rulebook
re-upload window) without any user-visible break. Browser-native
PDF viewers handle the fragment; no PDF.js bundle is shipped with
the viewer.
**Alternatives rejected:**
- **`target="_blank"` without `rel="noopener"`:** rejected as a
  security regression.
- **Inline PDF viewer via `PDF.js`:** rejected. Adds ~1 MB to the
  bundle and re-implements what browsers already do well.
- **Warning banner when `rulebookPdfUrl` is missing:** rejected.
  The config field's absence is a supported operator choice; a
  banner would nag operators into adding a URL they may not want
  to ship yet.
**Affected WPs:** WP-082 (introduction).
**Introduced:** WP-082 / EC-107
**Status:** Immutable

---

### D-8206 — `docs/legendary-universal-rules-v23.md` Is the Authoritative `pdfPage` Source; Omit Rather Than Guess
**Decision:** Every `pdfPage` value in `keywords-full.json` and
`rules-full.json` must trace to a specific `page N` marker in the
markdown extract at `docs/legendary-universal-rules-v23.md`. When
no confirmable page source exists, the field is **omitted** —
never filled with a best guess. At WP-082 ship time, 5 keywords
(`burnshards`, `fail`, `fightorfail`, `unleash`,
`whenrecruitedundercover`) and 1 rule (`asterisk`) omit `pdfPage`.
The markdown extract's first block is the verbatim Authority
Notice *"This file is the authoritative source for all `pdfPage`
values in glossary metadata. Page numbers must not be inferred
from the PDF alone."*
**Rationale:** The rulebook PDF itself is the ground truth but
is not greppable by contributors; the markdown extract (produced
once via `pdftotext -layout` and committed alongside the raw
`docs/Marvel Legendary Universal Rules v23.txt`) is the greppable
surrogate. Requiring a specific page marker in the markdown before
a `pdfPage` ships prevents two drift modes: (a) contributors
hand-counting PDF pages and landing on the physical-page vs
printed-page distinction (a 6-page offset for this PDF), and
(b) contributors inferring pages from internal rulebook
cross-references that may themselves be stale. Omission is
architecturally cheap (optional field in the Zod schema, silent
anchor omission in the panel) and operationally correct —
incomplete metadata is preferred to speculatively complete metadata.
**Alternatives rejected:**
- **Allow best-guess `pdfPage` values:** rejected. Guesses
  accumulate and become harder to audit once shipped.
- **Require every entry to have `pdfPage`:** rejected. Would
  force either fabrication for the five non-keyword modifier
  entries or scope creep to re-derive every rulebook reference
  from primary sources.
**Affected WPs:** WP-082 (introduction); any future glossary-authoring WP.
**Introduced:** WP-082 / EC-107
**Status:** Immutable

---

### D-8401 — Five Auxiliary Metadata JSON Files Deleted; Reintroduction Forbidden Without a Runtime Consumer
**Decision:** The five auxiliary metadata JSON files
`data/metadata/card-types.json`, `hero-classes.json`, `hero-teams.json`,
`icons-meta.json`, and `leads.json` are **deleted** as of WP-084 (Commit A
`b250bf1`, 2026-04-21). A 2026-04-21 audit confirmed they had no runtime
consumer — not the server (`createRegistryFromLocalFiles`), the viewer
(`createRegistryFromHttp`, `themeClient`, `glossaryClient`), the game
engine, or the pre-plan package. Their sole consumer was
`packages/registry/scripts/validate.ts` Phase 2, an opt-in manual
validation script not wired to `pnpm build`, `pnpm test`, or CI.
Reintroducing any of these files requires a new WP that names an actual
runtime or fetch-time consumer in its `## Goal` section; standalone
auxiliary metadata files without a reader are forbidden by D-8405.
**Rationale:** Five exported-but-unused data files mislead future
readers into believing they encode a runtime contract. The naming
collision precedent in D-1203 (`sets.json` vs `card-types.json` silent
failure, fixed by WP-003) demonstrates how dormant metadata files
become latent silent-failure attractors. Removing them shrinks the
authoritative metadata surface to the three files that have live
consumers (`sets.json` + `keywords-full.json` + `rules-full.json` per
WP-082 / EC-107) and aligns with the WP-083 fetch-time validation
contract (everything that runs validates; nothing that validates is
dormant).
**See D-1203 for the silent-failure precedent that motivated extra
caution around `card-types.json` specifically; the educational
`// why:` comments in `packages/registry/src/impl/httpRegistry.ts`
were retained per A-084-01 §K because the silent-failure pattern still
applies to any future metadata file with a similar shape.**
**Affected WPs:** WP-084 (introduction); any future WP that proposes
reintroducing one of the five filenames.
**Introduced:** WP-084 / EC-109
**Status:** Immutable

---

### D-8402 — Five Auxiliary Metadata Zod Schemas Deleted; Reintroduction Requires a Named Runtime Consumer
**Decision:** The five corresponding Zod schemas `CardTypeEntrySchema`,
`HeroClassEntrySchema`, `HeroTeamEntrySchema`, `IconEntrySchema`, and
`LeadsEntrySchema` are deleted from `packages/registry/src/schema.ts` as
of WP-084 (Commit A `b250bf1`, 2026-04-21). Reintroducing any of them
requires a new WP that names a runtime or fetch-time consumer in its
`## Goal` section. The block-comment headers (`// ── Card type taxonomy
(card-types.json) ──`, etc.) and any `z.infer` types based on these
schemas are deleted with them.
**Rationale:** A Zod schema with no consumer is technical debt — it
appears authoritative but isn't, and contributors cannot easily tell
whether it gates a runtime path. The author-facing-strict vs
loader-permissive pattern (D-3303) only applies when a schema actually
runs; an unconsumed schema fails neither path. Per `.claude/rules/registry.md`
"Schema Authority", `schema.ts` is "immutable unless strong justification";
the 2026-04-21 no-consumer audit is the justification, and this
DECISIONS entry is the required record.
**Affected WPs:** WP-084 (introduction); any future WP that proposes
reintroducing one of the five schema names.
**Introduced:** WP-084 / EC-109
**Status:** Immutable

---

### D-8403 — `card-types-old.json` Orphan Deleted; Legacy `*-old.*` Files Are a Repo Smell
**Decision:** `data/metadata/card-types-old.json` is deleted as an
orphan (zero references anywhere in `apps/`, `packages/`, `scripts/`,
or any in-scope `docs/` file at the 2026-04-21 audit). Legacy
`*-old.*` filenames are a repo smell because they advertise legacy
status while remaining in the working tree; routine cleanup should
scan for them and either delete or rename to a date-stamped archive
location.
**Rationale:** The file existed because an earlier author kept the
prior shape of `card-types.json` "just in case" rather than relying on
git history. The git history is the canonical archive; co-located
"old" copies create classification ambiguity, drift risk, and
audit-grep noise. Same pattern applied to `scripts/Validate-R2-old.ps1`
(see D-8407).
**Affected WPs:** WP-084 (introduction); future cleanup WPs that
encounter `*-old.*` artifacts.
**Introduced:** WP-084 / EC-109
**Status:** Immutable

---

### D-8404 — `validate.ts` Validates Only Live-Consumer or Cross-File-Integrity Artifacts
**Decision:** `packages/registry/scripts/validate.ts` validates only
artifacts that have live runtime or fetch-time consumers, or that
enforce cross-file integrity the runtime assumes (cards, cross-refs,
images). It is **not** wired to `pnpm build` or `pnpm test`, does not
run in CI, and must not be used as a parking lot for unconsumed
metadata. Per-feature validation belongs at the fetch boundary (see
D-083A introduced by WP-083 / EC-108) or in `Game.setup()` (engine
layer). Soft `sets.json` validation (count / invalid-entry warnings)
moves exclusively to Phase 1's abbreviation-extraction loop after the
WP-084 Phase 2 excision; runtime still validates at the
`SetIndexEntrySchema.safeParse` boundary (Phase 1 local mode) or HTTP
loader boundary (R2 mode in `httpRegistry.ts`).
**Rationale:** Treating `validate.ts` as a catch-all validator
dilutes its contract — failures become hard to triage because they
mix runtime-blocking issues with informational warnings about
auxiliary data nothing reads. Anchoring validation to live consumers
makes the script's exit code a reliable proxy for "is the data the
runtime depends on intact?".
**Affected WPs:** WP-084 (introduction); any future WP that proposes
adding a `validate.ts` phase.
**Introduced:** WP-084 / EC-109
**Status:** Immutable

---

### D-8405 — Future Reintroduction Pattern: Derived From Per-Set Data OR Wired To a Consumer In the Same WP
**Decision:** If any of the deleted metadata concepts (card types,
hero classes, hero teams, icon metadata, mastermind-villain leads)
are reintroduced, the new artifact must be **either** (a) *derived*
from per-set data at setup or fetch time (no standalone JSON file
needed), **or** (b) wired to a runtime or fetch-time consumer in the
same WP that reintroduces it (the WP's `## Goal` names the consumer
and the call site). A standalone JSON file plus a Zod schema with no
reader is forbidden by this decision. A future WP that violates this
rule must first amend this DECISIONS entry with an explicit override
(`Supersedes D-8405`) and a written justification.
**Rationale:** The deleted files all originated as well-intentioned
"future-proofing" — author imagined a future feature that might want
the data, so the schema and JSON shipped ahead of the consumer. The
features never landed; the data became stale; the schemas became
ambient noise. The derived-or-wired-in-same-WP rule eliminates the
class of failure by tying every metadata artifact to a concrete
reader at the moment it ships.
**Examples of the pattern done correctly:**
- Card-type classification → engine derives `G.villainDeckCardTypes`
  from per-set data at setup time per WP-014B (no standalone
  `card-types.json` needed).
- Hero-class display labels → viewer hardcodes `HERO_CLASS_GLOSSARY`
  + `HERO_CLASS_LABELS` in `useRules.ts` per WP-082 / EC-107 (no
  standalone `hero-classes.json` needed).
- Mastermind→villain-group leads → declared per-set on each
  mastermind record (`alwaysLeads[]`) and validated by the WP-014B
  virtual-card pipeline at setup time (no standalone `leads.json`
  needed).
**Affected WPs:** WP-084 (introduction); any future WP that proposes
reintroducing auxiliary metadata.
**Introduced:** WP-084 / EC-109
**Status:** Immutable

---

### D-8406 — Viewer's Drifted Duplicate `localRegistry.ts` Deleted as Orphan (A-084-01)
**Decision:** `apps/registry-viewer/src/registry/impl/localRegistry.ts`
is deleted as a drifted orphan duplicate of the main registry's
`packages/registry/src/impl/localRegistry.ts`. The viewer's copy
carried the exact WP-003 Defect 1 silent-failure bug (read
`card-types.json` as a set index — see D-1203) and was never invoked.
The Explore agent confirmed dead code on 2026-04-21 with seven pieces
of evidence: (a) zero imports across the entire repo
(`apps/registry-viewer/src/`, `packages/`, `scripts/`, `.github/`);
(b) absent from the viewer's `dist/` bundle (browser entry
`browser.ts` uses HTTP-only and never imported the Node-only file);
(c) CI never invoked any code path that reached it; (d) unchanged
since the initial commit of the viewer registry folder (`d5ea067`,
2026-03-23); (e) the viewer's own `httpRegistry.ts` and `browser.ts`
are the only browser-reachable factories; (f) the file's "CI
validation" label in the viewer's `CLAUDE.md:62` was aspirational
documentation rather than a description of an existing CI job; and
(g) `pnpm --filter registry-viewer build` exits 0 post-deletion,
proving no transitive consumer existed.
**Reintroducing a Node-only CardRegistry factory inside the viewer
package requires a new WP that also defines the actual CI validation
job that invokes it.** The main registry's `createRegistryFromLocalFiles`
at `packages/registry/src/impl/localRegistry.ts` remains the single
canonical Node factory and is unaffected.
**Rationale:** A drifted duplicate of a load-bearing file is a
pure-downside artifact: it doubles the surface area that has to stay
in sync, captures bugs the source has fixed, and provides zero
runtime benefit. The viewer's local copy carried the D-1203
silent-failure bug for over a year because no reader exercised it.
Deletion eliminates the drift entirely.
**Affected WPs:** WP-084 (introduction); any future WP that proposes
reintroducing a viewer-local Node-only factory.
**Introduced:** WP-084 / EC-109 (A-084-01 amendment)
**Status:** Immutable

---

### D-8407 — Legacy `Validate-R2-old.ps1` Deleted as Superseded Orphan (A-084-01)
**Decision:** `scripts/Validate-R2-old.ps1` is deleted as a
superseded orphan PowerShell validator. Its replacements —
`scripts/validate-r2.mjs` (Node variant, wired to the root
`pnpm validate:*` scripts referenced from `package.json`) and
`packages/registry/scripts/validate.ts` (tsx variant, wired to
`pnpm registry:validate`) — remain the authoritative validators.
The file name admits `-old`; its docstring referenced all five
deleted filenames in `data/metadata/`. Any future PowerShell-specific
validator must be a new file with a current name, not a revival of
`Validate-R2-old.ps1`.
**Rationale:** Same legacy-file pattern as D-8403 (`*-old.*` files
are a repo smell). The file accumulated through three validator
generations and was never garbage-collected; deletion completes the
generational rotation.
**Affected WPs:** WP-084 (introduction); any future WP that
introduces a new PowerShell validator.
**Introduced:** WP-084 / EC-109 (A-084-01 amendment)
**Status:** Immutable

---

### D-8301 — Viewer R2 Fetches Validate at the Boundary (`.safeParse(...)`, Not Interface Casts)
**Decision:** Every R2 fetcher in the registry viewer validates its
payload with `.safeParse(...)` against a schema owned by the registry
package (`packages/registry/src/schema.ts` or
`packages/registry/src/theme.schema.ts`). Inline TS-interface casts on
fetched JSON are forbidden. The four R2 fetchers
(`apps/registry-viewer/src/lib/registryClient.ts`,
`apps/registry-viewer/src/lib/themeClient.ts`, and the two inside
`apps/registry-viewer/src/lib/glossaryClient.ts`) all now satisfy this
rule. `.parse(...)` at a fetch boundary is also forbidden because its
automatic throw bypasses the locked error-rendering format —
`.safeParse(...)` returns a discriminated union so each call site
handles the failure explicitly per D-8303 severity.
**Rationale:** Prevents silent shape drift and makes failures
developer-actionable at the first point of ingestion. TS interface casts
are compile-time only and do not protect against malformed R2 publishes,
accidental schema drift upstream, or CDN corruption. Completes the
viewer-side validation rollout initiated by WP-082 / EC-107 for the
glossary fetchers; closes the remaining gap for viewer config + theme
JSONs.
**Affected WPs:** WP-083 (introduction); any future WP that adds a new
R2 fetcher to the registry viewer. Any such WP must ship with a matching
registry-package schema and a `.safeParse(...)` wiring at the fetch
boundary.
**Introduced:** WP-083 / EC-108
**Status:** Active Policy

---

### D-8302 — `ViewerConfigSchema` Is Distinct from `RegistryConfigSchema` (Naming Collision Locked)
**Decision:** `ViewerConfigSchema` in
`packages/registry/src/schema.ts` is the schema for
`apps/registry-viewer/public/registry-config.json` (an object shape
with `metadataBaseUrl`, `eagerLoad?`, `rulebookPdfUrl?`).
`RegistryConfigSchema` in the same file is the schema for a separate
R2 artifact at `/registry-config.json` that is a flat array of set
abbreviation strings. These two names and their shapes are locked and
must not be conflated, renamed, or collapsed into one schema. The
adjacent comment on `RegistryConfigSchema` explicitly disambiguates the
two.
**Rationale:** The two artifacts happen to share the same basename
(`registry-config.json`) because each exists in a different directory
(`public/` vs R2 root). Renaming `RegistryConfigSchema` would break CI
scripts and external tooling that consume the set-abbreviation list.
Renaming `ViewerConfigSchema` to avoid the collision would break this
WP's retrofit. Locking both names and their distinct meanings is the
lowest-risk resolution.
**Affected WPs:** WP-083 (introduction); any future WP that touches
either artifact must preserve the naming distinction or update this
entry with a supersession.
**Introduced:** WP-083 / EC-108
**Status:** Immutable

---

### D-8303 — Validation Severity Policy by Dependency Type (Throw vs. Warn + Skip)
**Decision:** Validation failures in the registry viewer are handled
by dependency severity:
- **Throw** when the payload is a hard dependency whose absence makes
  the subsystem unusable:
  - `public/registry-config.json` (viewer cannot boot)
  - `themes/index.json` (Themes tab cannot populate)
- **Warn + skip** when the failure is isolated to a single entry in a
  batch whose other entries are independently usable:
  - Individual `themes/{file}.json` (one bad theme must not hide the
    other 68)
  - Glossary payloads per EC-107 (malformed keyword / rule data degrades
    to an empty Map; tooltips go absent but cards still render)

All diagnostics render only `issue.path.join('.')` (or `"root"` if
empty) plus `issue.message` from the **first** Zod issue. `.format()`
dumps, multi-issue arrays, and raw `issues` prints are forbidden.
**Rationale:** Hard dependencies must fail loudly to avoid undefined
runtime behavior; batch entries should degrade gracefully while
preserving operator visibility. First-issue-only rendering keeps
operator logs scannable and matches the EC-107 `[Glossary] Rejected`
precedent. This is the third retrofit (after EC-107 glossary + this
packet's viewer config / themes) and the fourth R2 fetcher; the policy
is now authoritative for all future viewer-side validation.
**Affected WPs:** WP-082 (glossary, already matched this policy
de facto); WP-083 (explicit lock); any future WP that adds a new
viewer R2 fetcher.
**Introduced:** WP-083 / EC-108
**Status:** Active Policy

---

### D-8304 — Auxiliary Metadata Schemas Remain Offline-Only (Cross-Reference to D-8401 / D-8402)
**Decision:** At WP-083 authoring time, WP-084 / EC-109 deleted five
auxiliary metadata schemas (`CardTypeEntrySchema`,
`HeroClassEntrySchema`, `HeroTeamEntrySchema`, `IconEntrySchema`,
`LeadsEntrySchema`) and their JSON counterparts (see D-8401, D-8402).
If a future WP revives any of those schemas, this decision locks the
following: no revived auxiliary schema may be wired to a runtime R2
fetcher as part of the revival. The revival WP and its runtime
consumer must land together in the same WP, with a matching validated
fetcher per D-8301.
**Rationale:** Prevents scope creep and schema-without-consumer drift.
Schemas that exist only for offline validation should stay offline
until a concrete consumer exists; when the consumer arrives, the WP
that wires it must also ship the fetch-boundary validation per D-8301
rather than treating the schema as prior art that skips the validation
review. Pairs with D-8405 (future-reintroduction pattern).
**Affected WPs:** WP-083 (introduction); any future WP that revives
one of the five deleted schemas or adds a new auxiliary metadata
schema.
**Introduced:** WP-083 / EC-108
**Status:** Active Policy

---

### D-8305 — Theme-Schema Subpath Export for Browser-Safe Viewer Imports (A-083-04)
**Decision:** `packages/registry/package.json` exposes theme schemas
via a dedicated `./theme.schema` subpath export
(`"./theme.schema": { "import": "./dist/theme.schema.js", "types":
"./dist/theme.schema.d.ts" }`). Viewer code — and any future
browser-bundled consumer — **must** use this subpath when importing
`ThemeDefinitionSchema`, `ThemeDefinition`, or any other theme-schema
binding, not the barrel `@legendary-arena/registry`. The barrel
re-exports `createRegistryFromLocalFiles` which imports Node-only
modules (`node:fs/promises`, `node:path`); Rollup resolves the import
graph before tree-shaking can prune the unused factory, so a barrel
import of theme schemas would break the viewer's production build at
`resolve` from `__vite-browser-external`.
**Rationale:** Locks the retrofit precedent A-082-01 established for
general schemas (`./schema`) and extends it to theme schemas without
modifying `theme.schema.ts` (locked by D-5504 / D-5509 / EC-055).
Preserves file-level separation of concerns — `schema.ts` and
`theme.schema.ts` each expose their own subpath independently. Future
retrofit WPs consuming theme schemas in a browser bundle cite this
decision instead of re-litigating the import-path question or
attempting to move theme schemas into `schema.ts` (prohibited).
**Affected WPs:** WP-083 (introduction, A-083-04 amendment); any
future WP that imports theme schemas into a browser-bundled consumer.
**Introduced:** WP-083 / EC-108 (A-083-04 amendment)
**Status:** Immutable

---

### D-8501 — WP-085 Is the Queued Governance Instrument for §17 Vision Alignment Audit Enforcement
**Decision:**
`docs/ai/work-packets/WP-085-vision-alignment-audit.md` is the queued
governance Work Packet that codifies the §17 Vision Alignment gate's
enforcement tooling. WP-085 defines the orchestrator
(`scripts/audit/vision/run-all.mjs`), the comment-aware filter on
DET-001 inside `scripts/audit/vision/determinism.greps.mjs`, the
two-channel detection model (script-channel executable detection +
orchestrator-channel allowlist verification), the combined report
format under `docs/audits/vision-alignment-{YYYY-MM-DD}.md`, and the
single-verdict PASS/FAIL contract. WP-085 consumes the calibrated
audit baseline captured at INFRA `24996a9` on `main` (6 DET-001
documentation-only baseline exceptions / 4 DET-007 warnings /
0 monetization / 0 registry / 0 engine-boundary findings) as a locked
acceptance contract per Scope (In) §D.

**Status scope of this decision:** Pre-execution only. WP-085 is a
**queued instrument**, not an operational enforcement tool. Until
EC-085 executes, the §17 gate is enforced by prose governance in
`docs/ai/REFERENCE/00.3-prompt-lint-checklist.md §17` and the
supporting 01.3 / 01.4 references. The operational claim "§17 Vision
Alignment is enforced by WP-085 audit tooling" is deferred to a
separate decision landing at Commit B of EC-085, when the claim
becomes factually accurate. The two-channel DET-001 model as a reusable
mechanics pattern is likewise deferred to Commit B of EC-085.

**Rationale:**
The §17 Vision Alignment gate landed at SPEC `0689406` with prose-level
enforcement across 00.3 / 01.3 / 01.4. The audit scaffold landed at
INFRA `24996a9` with four `.greps.mjs` scripts under
`scripts/audit/vision/`. The gap between a prose gate and a
programmatic enforcer was previously labeled "WP-042 queued" in the
Phase 7 breadcrumb at
[WORK_INDEX.md](work-packets/WORK_INDEX.md) — a reference that
collided with the actually-completed Deployment Checklists at WP-042
(commit `c964cf4`, 2026-04-19). The vision audit instrument is now
registered under its own identifier, WP-085, with the breadcrumb
corrected to match in the same SPEC commit that landed this entry.

Recording this decision pre-execution serves three purposes:

1. Closes the governance drift vector created by the stale "WP-042"
   breadcrumb before any future auditor can interpret it as evidence
   of an ownership ambiguity.
2. Locks the calibrated baseline (6 / 4 / 0 / 0 / 0) as the canonical
   AC-2 source-of-truth before EC-085 proceeds, preventing
   re-calibration creep.
3. Provides a stable identity for the queued instrument that Phase 7
   WPs and future governance references can cite without waiting for
   EC-085 execution.

**Alternatives rejected:**

- **Defer the decision until Commit B of EC-085:** rejected. Post-
  execution, the operational claim ("§17 *is enforced* by WP-085")
  becomes factually true and warrants its own decision. But the
  pre-execution claim ("WP-085 *is the queued instrument*") also
  needs recording, because (a) the stale "WP-042" breadcrumb is a
  governance-drift vector active right now, and (b) future auditors
  may arrive in the window between this SPEC commit and EC-085
  executing.
- **Subsume the two-channel DET-001 model and the "§17 is enforced
  by WP-085" operational claim into this decision:** rejected. Those
  describe an instrument that does not yet exist operationally; the
  corresponding decisions land at Commit B of EC-085 when the
  mechanics are instantiated and the claim is factually accurate.
  Separating forward-looking intent from operational reality
  protects against the future-dated-claim pattern that Vision §14
  (No Silent Drift) forbids.
- **Let WP-085 register itself in `WORK_INDEX.md` without a
  `DECISIONS.md` entry:** rejected.
  `.claude/rules/work-packets.md` requires `WORK_INDEX.md`
  registration before execution, but a governance instrument as
  load-bearing as §17 enforcement warrants an immutable record of
  *why* the instrument exists and *what* it is bound to. The entry
  prevents future "is this still the canonical enforcer?" ambiguity
  and gives a stable reference target (D-8501) that downstream
  decisions can cite.
- **Rename or renumber WP-085 back to WP-042:** rejected outright.
  WP-042 is an already-completed WP (Deployment Checklists, commit
  `c964cf4`, 2026-04-19) listed under Phase 7 at
  [WORK_INDEX.md](work-packets/WORK_INDEX.md). Reusing its identifier
  would destroy audit-trail traceability for both WPs.

**Implementation locations:**

- Source of truth for the queued instrument:
  `docs/ai/work-packets/WP-085-vision-alignment-audit.md` (draft,
  landed at this same SPEC commit).
- Supporting audit scaffold:
  `scripts/audit/vision/determinism.greps.mjs`,
  `scripts/audit/vision/monetization.greps.mjs`,
  `scripts/audit/vision/registry.greps.mjs`,
  `scripts/audit/vision/engine-boundary.greps.mjs` (landed at INFRA
  `24996a9`; untouched by this decision).
- Governance gates:
  `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` §17,
  `docs/ai/REFERENCE/01.3-commit-hygiene-under-ec-mode.md` Vision
  Trailer convention,
  `docs/ai/REFERENCE/01.4-pre-flight-invocation.md` Vision Sanity
  Check (all landed at SPEC `0689406`; untouched by this decision).
- Index registration:
  `docs/ai/work-packets/WORK_INDEX.md` Phase 7 — breadcrumb
  terminology corrected ("documentation-only baseline exceptions"
  replaces "false positives"; "WP-085" replaces the stale "WP-042")
  and a formal WP-085 row landed in the same SPEC commit as this
  decision.

**Post-execution follow-ups (not in this decision's scope):**

- Operational enforcement claim ("§17 Vision Alignment is enforced
  by WP-085 audit tooling") lands at Commit B of EC-085.
- Two-channel DET-001 model as a reusable governance pattern
  (script-channel executable detection + orchestrator-channel
  baseline-exception verification; single-channel DET-007 asymmetry)
  lands at Commit B of EC-085 alongside the mechanics.
- Memory file `feedback_audit_tooling_scaffold_first.md` rationale
  paragraph correction ("WP-042" → "WP-085") tracked under WP-085
  § Post-WP-085 Follow-ups.

**Affected WPs:** WP-085 (introduction); all Phase 7 WPs that cite
the §17 Vision Alignment gate (inherited enforcement scope once
EC-085 executes).
**Introduced:** WP-085 (pre-execution SPEC governance bundle)
**Status:** Immutable
**Raised:** WP-085 drafting, 2026-04-22
**Resolved:** 2026-04-22 (pre-execution SPEC commit landing
WORK_INDEX.md registration + breadcrumb terminology correction +
this decision + WP-085 draft)

---

### D-8502 — Vision Audit Baseline Source-of-Truth Is INFRA `24996a9` on `main`
**Decision:**
The calibrated Vision Alignment audit baseline — exactly 6 DET-001
findings, 4 DET-007 findings, 0 monetization findings, 0 registry
findings, 0 engine-boundary findings — captured on `main` at INFRA
`24996a9` is the canonical, immutable source-of-truth for WP-085's
AC-2 / AC-3 / AC-4 acceptance contract. These values appear as named
constants in `scripts/audit/vision/run-all.mjs` (`EXPECTED_DET_001 = 6`,
`EXPECTED_DET_007 = 4`, `EXPECTED_MONETIZATION = 0`,
`EXPECTED_REGISTRY = 0`, `EXPECTED_ENGINE_BOUNDARY = 0`). Any deviation
at any future audit run is a FAIL.

**Rationale:**
A calibrated audit instrument must freeze its acceptance contract at
the calibration point. Otherwise "passing" becomes a moving target and
the instrument loses diagnostic value — a regression could silently
renormalize the baseline upward and no auditor would notice. Locking
the baseline in a named-constant form in the orchestrator (rather than
as prose-only in WP-085) gives the contract a single mechanical
enforcement surface: changing the baseline requires editing code, and
code changes must land through a superseding WP per WP-085 AC-6.

The six DET-001 findings are all documentation-only occurrences at the
AC-3 allowlist file:line pairs — JSDoc warnings against runtime use of
`Math.random`. The four DET-007 findings are snapshot and version
metadata wall-clock reads at the AC-4 allowlist file:line pairs. Zeros
in the remaining three scans mean the current engine has no
monetization predicates, no registry divergence, and no forbidden
engine↔apps imports.

**Alternatives rejected:**

- **Store the baseline only in WP-085 prose:** rejected. Prose drifts
  silently; code does not. Named constants guarantee that any future
  re-calibration is a visible diff.
- **Allow runtime re-calibration via CLI flag:** rejected. A re-
  calibration flag would let an operator fabricate a PASS verdict by
  resetting the contract to whatever the current tree produces. The
  instrument's whole purpose is to catch drift; making the baseline
  mutable at runtime defeats that.
- **Store the baseline in a separate `baseline.json` file:** rejected
  for this iteration. Named constants inside the orchestrator keep the
  contract co-located with the comparison logic; a separate config
  file adds indirection without audit-integrity benefit. A future INFRA
  WP may promote the baseline to a versioned JSON if CI integration
  demands it.

**Implementation locations:**

- `scripts/audit/vision/run-all.mjs` lines 69–73 (named constants).
- `scripts/audit/vision/run-all.mjs` lines 80–99 (AC-3 and AC-4
  allowlist file:line pairs as frozen arrays).
- `docs/ai/work-packets/WP-085-vision-alignment-audit.md` AC-2 matrix
  + AC-3 + AC-4 allowlists.

**Affected WPs:** WP-085 (primary); every Phase 7 WP whose `## Vision
Alignment` block cites §17 (inherited enforcement contract).
**Introduced:** EC-085 Commit B (governance close)
**Status:** Immutable
**Raised:** EC-085 execution, 2026-04-22
**Resolved:** 2026-04-22 (Commit B — this decision)

---

### D-8503 — Two-Channel DET-001 With Single-Channel DET-007 Asymmetry
**Decision:**
The Vision Alignment audit uses two distinct detection channels for
DET-001 (`Math.random(` in engine code) and exactly one channel for
DET-007 (`new Date(` in engine code). This asymmetry is a load-bearing
design decision, not an accident.

- **DET-001 script channel** (`scripts/audit/vision/determinism.greps.mjs`)
  applies a comment-aware filter after `git grep` returns matches. Any
  line whose content portion — after the `path:lineno:` prefix — begins
  with `//`, `/*`, or `*` is discarded. The script must report exactly
  **zero** executable findings on `main`.
- **DET-001 orchestrator channel** (`scripts/audit/vision/run-all.mjs`)
  independently reads each of the six AC-3 allowlist files and verifies
  the referenced line is a doc-comment. Exactly **six** doc-comment
  matches constitute the baseline exception count. The composite
  (script-channel executable + orchestrator-channel allowlist) must
  equal `EXPECTED_DET_001 = 6`, and *each* channel must satisfy its
  own invariant independently.
- **DET-007 single channel** applies no comment-aware filter. All four
  findings — executable or doc-comment — must match the AC-4 four-pair
  allowlist exactly; missing or extra pairs are a FAIL.

**Rationale:**
DET-001 protects a determinism invariant: engine replay requires
`ctx.random.*` and breaks catastrophically if any executable call to
`Math.random(` leaks in. A doc-comment that says *"never use
`Math.random()` in engine code"* is the warning, not the violation —
filtering comment hits prevents the gate from firing on its own
guardrail text. But the warning text is itself a governance artifact:
if the warning disappears, a future contributor loses the in-file
signal. The orchestrator channel verifies the warnings are still
present at their canonical locations.

DET-007 is different. It protects a *suspicious-pattern* invariant:
`new Date(` in engine code is a smell that someone may have introduced
wall-clock dependency. A doc-comment at the canonical site (e.g.,
*"snapshotAt uses `new Date()` for derived metadata only"*) is the
canonical site documentation and carries **equal audit meaning** to
the executable hit one or two lines below. Filtering DET-007
comment hits would hide the governance context — the auditor would
see only the executable hit and lose the explanation. Keeping DET-007
single-channel preserves the full audit signal.

This asymmetry is locked with a `// why:` comment at
`scripts/audit/vision/determinism.greps.mjs` lines 170–181 so future
contributors do not "fix" the perceived inconsistency.

**Alternatives rejected:**

- **Apply the comment-aware filter to both DET-001 and DET-007:**
  rejected. Would destroy DET-007 audit signal; doc-comment
  occurrences at the four AC-4 sites are canonical site documentation,
  not noise.
- **Apply no comment-aware filter to either rule:** rejected. Would
  make DET-001 fire on the six documentation warnings at AC-3 sites
  (which are the invariant's own guardrail text), producing a
  permanent six-count critical FAIL with no semantic meaning.
- **Collapse to a single allowlist channel covering both rules:**
  rejected. Conflates two different invariants — executable
  forbidden-call detection (DET-001) vs. suspicious-pattern auditing
  (DET-007) — and loses the ability to independently verify the
  DET-001 documentation warnings still exist at their canonical sites.

**Reusable pattern:** the two-channel model (script-channel executable
detection + orchestrator-channel baseline-exception verification) is
appropriate any time a scan rule protects an invariant whose guardrail
text contains the forbidden token. The single-channel model is
appropriate when the rule's doc-comment occurrences are themselves
audit-relevant site documentation. Future audit rules should classify
into one of these two shapes explicitly.

**Implementation locations:**

- `scripts/audit/vision/determinism.greps.mjs` lines 109–140
  (`isDocCommentLine` helper).
- `scripts/audit/vision/determinism.greps.mjs` lines 170–182 (DET-001
  filter with asymmetry `// why:` comment).
- `scripts/audit/vision/run-all.mjs` lines 244–280
  (`verifyDet001Allowlist` — orchestrator channel).
- `scripts/audit/vision/run-all.mjs` lines 290–317
  (`verifyDet007AllowlistAgainstLines` — single-channel diff).

**Affected WPs:** WP-085 (primary); any future audit WP adopting the
scan-rule classification above.
**Introduced:** EC-085 Commit B (governance close)
**Status:** Immutable
**Raised:** EC-085 execution, 2026-04-22
**Resolved:** 2026-04-22 (Commit B — this decision)

---

### D-8504 — Same-Day Audit Report Overwrite Refusal Is Audit-History Immutability
**Decision:**
The Vision Alignment audit orchestrator refuses to overwrite an
existing report at `docs/audits/vision-alignment-{YYYY-MM-DD}.md`. If
a same-day report already exists when the orchestrator runs, the
process exits with a non-zero status and a full-sentence error
message; no file is written. Corrective action for an incorrect report
is a new corrective WP per WP-085 AC-6, never an in-place overwrite.

**Rationale:**
Audit reports are point-in-time witnesses. Each carries an audited
commit hash and a VERDICT line that together constitute a
testimonial record: *"on this date, at this commit, the engine
satisfied (or failed) the calibrated baseline."* Permitting a same-day
overwrite would let a later run erase or amend an earlier verdict,
destroying the report's role as an immutable record. Worse, it would
enable a silent-drift attack surface: an operator seeing a FAIL could
fix the underlying regression, re-run the audit, and overwrite the
FAIL with a PASS — losing the record that the regression ever
existed.

The non-zero exit is deliberate: it surfaces the refusal as a failed
process to any CI job that invokes the audit multiple times per day.
The full-sentence error message tells the operator what to do
instead (ship a corrective WP per WP-085 AC-6).

**Alternatives rejected:**

- **Overwrite with a backup:** rejected. A `.bak` file is not the
  canonical audit record; downstream consumers look at the primary
  filename, and the backup drifts out of any index.
- **Append a timestamp suffix on collision
  (`vision-alignment-2026-04-22-1.md`):** rejected. Fragments the
  audit-history file namespace and forces auditors to reason about
  "which of today's reports is canonical?" The answer should be
  "exactly one per date."
- **Warn and continue:** rejected. A warning that an existing report
  was overwritten is a paper shield — the record is gone either way.
  Hard-refusing preserves the invariant mechanically.

**Implementation locations:**

- `scripts/audit/vision/run-all.mjs` lines 157–172
  (`refuseOnSameDayCollision`, including the audit-history
  immutability `// why:` comment).
- `scripts/audit/vision/run-all.mjs` line 451 (invocation at the top
  of `main`).

**Affected WPs:** WP-085 (primary); any future audit WP emitting a
dated report under `docs/audits/`.
**Introduced:** EC-085 Commit B (governance close)
**Status:** Immutable
**Raised:** EC-085 execution, 2026-04-22
**Resolved:** 2026-04-22 (Commit B — this decision)

---

## Final Note
Legendary Arena’s strength is not just its code.
It is the **discipline encoded in these decisions**.

Protect this file.