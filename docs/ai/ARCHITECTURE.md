# Legendary Arena — System Architecture

> **This document is referenced by every Work Packet in `docs/ai/work-packets/`.**
> It is the authoritative source for package boundaries, data flow, persistence
> rules, and dependency constraints. If this document and a Work Packet conflict,
> this document wins.
>
> **Document override hierarchy** (established in WP-001):
> 1. `docs/ai/REFERENCE/00.1-master-coordination-prompt.md` — highest authority;
>    the coordination system itself; non-negotiable constraints and session protocol
> 2. `docs/ai/ARCHITECTURE.md` (this file) — architectural decisions and boundaries
> 3. Individual Work Packets (`docs/ai/work-packets/WP-NNN-*.md`)
> 4. Active conversation context — lowest authority
>
> Higher entries win in any conflict. A Work Packet may never override this
> document or `00.1`. If a Work Packet appears to conflict with either, stop
> and re-read this document and `00.1` before proceeding.
>
> Created: WP-013 -- Persistence Boundaries & Snapshots
> Updated: WP-014 review -- villain deck reveal pipeline and RevealedCardType conventions
> Updated: WP-014 -- Villain Deck & Reveal Pipeline
> Updated: WP-011 review -- Lobby phase flow and G.lobby observability pattern
> Updated: WP-010 review -- endIf contract and G.counters key conventions
> Updated: WP-009A/009B review -- rule execution pipeline and ImplementationMap pattern
> Updated: WP-008A/008B review -- move validation contract and zone mutation rules
> Updated: WP-007A/007B review -- turn stage cycle, lifecycle-to-phase mapping
> Updated: WP-006A/006B review -- zone/pile structure and initialization rules
> Updated: WP-005A/005B review -- setup validation contract and throwing convention
> Updated: WP-004 review -- server layer boundary and startup sequence
> Updated: WP-004 execution -- server bootstrap complete; LegendaryGame wired with
>   minPlayers/maxPlayers, validateSetupData; registry loaded via createRegistryFromLocalFiles;
>   createRequire bridge for boardgame.io CJS server bundle (D-1205, D-1206)
> Updated: WP-003 review -- registry metadata file shapes and card field data quality
> Updated: WP-002 review -- boardgame.io version lock and LegendaryGame contract
> Updated: WP-001 review -- override hierarchy and legendary.* namespace convention

---

## Architectural Principles

### 1. Determinism Is Non‑Negotiable

Every game must be fully reproducible from:
- initial seed
- setup configuration
- ordered list of player actions

There is no hidden state, no implicit randomness, and no time‑dependent behaviour.
All randomness uses `ctx.random.*` exclusively — never `Math.random()`.

### 2. The Engine Owns Truth

- The engine is the **sole source of truth** for all game state
- Clients submit **intents**, not outcomes
- UI consumes **read‑only projections** of engine state, never `G` or `ctx` directly
- Invalid or out-of-order actions are rejected deterministically engine-side

### 3. Data Outlives Code

All persisted artefacts (replays, saves, campaign state, snapshots) are:
- explicitly versioned
- migrated deterministically
- rejected loudly if incompatible with the current engine version

Live runtime state (`G`, `ctx`) is **never** persisted.

### 4. Growth Is Constrained, Not Free

Growth happens within explicit boundaries:
- immutable surfaces are protected by versioning
- change budgets control release velocity
- balance changes are validated via simulation before shipping

Success is allowed. Entropy is not.

---

## Section 1 — Monorepo Package Boundaries

The repository is a pnpm monorepo. Every package has a single, bounded responsibility.

```
C:\pcloud\BB\DEV\legendary-arena\
│
├── packages/
│   ├── game-engine/          @legendary-arena/game-engine
│   │   Responsibility: ALL game logic
│   │   Contains: boardgame.io Game() definition (LegendaryGame), phases, moves,
│   │             turn loop, rule hooks, endgame evaluator, lobby state,
│   │             villain deck, persistence types
│   │   boardgame.io version: ^0.50.0 (locked — do not upgrade without a
│   │             DECISIONS.md entry; the Game() API and ctx shape are
│   │             version-specific)
│   │   Must NOT import: server, registry, any app package, pg, axios
│   │
│   └── registry/             @legendary-arena/registry
│       Responsibility: card data loading and validation ONLY
│       Contains: createRegistryFromHttp, createRegistryFromLocalFiles,
│                 Zod schemas, CardRegistry interface
│       Must NOT import: game-engine, server, any app package, pg
│
├── apps/
│   ├── server/
│   │   Responsibility: boardgame.io Server() runtime — wires packages together
│   │   Contains: server bootstrap (server.mjs), process entrypoint (index.mjs),
│   │             rules loader (rules/loader.mjs — loadRules/getRules from PostgreSQL),
│   │             backwards-compat re-export (game/legendary.mjs)
│   │   Must NOT: contain game logic, implement rules, or define moves —
│   │             the server is a wiring layer, not a logic layer
│   │   └── scripts/
│   │       Contains: CLI tools — create-match.mjs, list-matches.mjs,
│   │                 join-match.mjs (Node v22 built-in fetch, no axios)
│   │   Imports: @legendary-arena/game-engine, @legendary-arena/registry, pg
│   │   Must NOT import: UI packages, direct DOM/browser APIs
│   │
│   └── registry-viewer/
│       Responsibility: read-only card browser SPA
│       Imports: @legendary-arena/registry
│       Must NOT import: game-engine, server internals
│
├── data/
│   Contains: canonical metadata JSON, per-set card JSON, PostgreSQL schema,
│             seed SQL, migration files
│   This is NOT a package — it is raw data consumed by other packages
│   PostgreSQL tables: all in the `legendary.*` schema namespace
│     (e.g., legendary.rules, legendary.sets, legendary.cards)
│     PKs use bigserial; cross-service identifiers use ext_id text columns
│
└── docs/ai/
    Contains: coordination system, REFERENCE docs, Work Packets, this file
    REFERENCE/ — authoritative project memory (established in WP-001):
      00.1-master-coordination-prompt.md  — coordination system, override
                                            hierarchy, WP template, session
                                            protocol, drift detection (highest
                                            authority after this file)
      00.2-data-requirements.md           — canonical data contracts: field
                                            names, schema conventions, ext_id
                                            usage, image URL patterns
      00.3-prompt-lint-checklist.md       — 28-item Final Gate before execution
      00.4-connection-health-check.md     — environment / connectivity checks
      00.5-validation.md                  — data validation procedures
      00.6-code-style.md                  — Rules 1–15: ESM-only, no
                                            abbreviations, // why: comments,
                                            data contract alignment, etc.
```

### Package Import Rules (Hard Constraints)

| Package | May import | Must NOT import |
|---|---|---|
| `game-engine` | Node built-ins only | `registry`, `server`, any `apps/*`, `pg` |
| `registry` | Node built-ins, `zod` | `game-engine`, `server`, any `apps/*`, `pg` |
| `apps/server` | `game-engine`, `registry`, `pg`, Node built-ins | UI packages, browser APIs |
| `apps/registry-viewer` | `registry`, UI framework | `game-engine`, `server`, `pg` |

Violations of these rules are bugs. The TypeScript build should catch them via
`"paths"` restrictions in `tsconfig.json`.

---

## Section 2 — Data Flow

### Server Startup Sequence

Before any match can be created, the server must complete two independent startup
tasks. Both must succeed before `Server()` begins accepting requests.

```
Task 1 — Card registry (from local files or R2):
  createRegistryFromLocalFiles({ metadataDir: 'data/metadata', cardsDir: 'data/cards' })
  → Loads data/metadata/sets.json          (set index — see Registry Metadata File Shapes)
  → Loads data/metadata/card-types.json    (card type taxonomy — NOT the set index)
  → Loads data/cards/[set-abbr].json       (per-set card records)
  → Validates all files against Zod schemas (packages/registry/src/schema.ts)
  → Returns immutable CardRegistry
  → Logged: "[server] registry loaded: X sets, Y heroes, Z cards"

Task 2 — Rules text (from PostgreSQL):
  loadRules()  ← apps/server/src/rules/loader.mjs (established by Foundation Prompt 01)
  → Reads from legendary.rules table in PostgreSQL
  → Returns in-memory rules accessible via getRules()
  → Logged: "[server] rules loaded: N rules"
  Note: rules/loader.mjs is NOT touched by game-engine Work Packets —
        it belongs to the server layer only

Both tasks complete → Server() starts → process entrypoint (index.mjs) signals ready
```

**Why two separate tasks?** Card data (registry) and rules text (PostgreSQL) are
different data sources with different update cadences. The registry is immutable
release data. The rules text is seeded at deploy time. Neither is `G` — they are
read-only inputs to the engine, not game state.

### Registry Metadata File Shapes

Two files in `data/metadata/` are easily confused because they have similar names
but completely different shapes and purposes. Every Work Packet that touches
registry loading must know this distinction.

**`data/metadata/sets.json`** — the **set index**:

```
{ id: string, abbr: string, pkgId: string, slug: string,
  name: string, releaseDate: string, type: string }
```

This is what `SetIndexEntrySchema` validates. It lists which card sets exist and
provides the `abbr` used to locate per-set card files (e.g., `mdns.json`).
**This is the file `createRegistryFromLocalFiles` and `createRegistryFromHttp`
must fetch to enumerate sets.**

**`data/metadata/card-types.json`** — the **card type taxonomy**:

```
{ id: string, slug: string, name: string, displayName: string, prefix: string }
```

37 entries classifying card archetypes (`villain`, `henchman`, `hero`, `scheme`,
`mastermind`, etc.). It has no `abbr` or `releaseDate` fields.
**This is NOT a set index and must never be used where `sets.json` is expected.**

**Why the distinction matters — the silent failure mode:**
If code fetches `card-types.json` where `sets.json` is expected, the Zod parse
produces **zero sets with no error thrown**. The shapes are incompatible:
`card-types.json` entries lack `abbr` and `releaseDate`, so every entry fails
the schema silently and is dropped. The registry appears to load successfully
but contains no data. This was the confirmed bug in `httpRegistry.ts` fixed by
WP-003.

**`packages/registry/src/schema.ts`** is the authoritative source for all field
shapes and nullable/optional constraints. Read it before writing any
registry-related code. The comments inside document real data quirks that drove
schema permissiveness decisions.

### Card Field Data Quality

Hero card numeric fields are **not** clean integers in the raw data. Any code
that reads or parses these fields must treat them as `string | number | undefined`:

| Field | Real data examples | Why |
|---|---|---|
| `cost` | `0`, `3`, `"2*"` | Star-cost modifier (established in WP-003) |
| `attack` | `0`, `3`, `"2+"` | Plus-modifier for conditional bonuses |
| `recruit` | `0`, `2`, `"1+"` | Plus-modifier for conditional bonuses |
| `vAttack` (mastermind) | `8`, `"8+"` | Mastermind fight values use the same pattern |

**Parsing rule:** Strip trailing `+` or `*` and parse the integer base. On
unexpected input, return `0` and emit a deterministic warning — never throw.
This parser is implemented in WP-018 (`economy.logic.ts`). All packets from
WP-018 onward must use it rather than assume integers.

### Match Lifecycle: From Config to Game State

```
1. Caller (CLI script or UI) constructs a MatchSetupConfig:
   {
     schemeId, mastermindId, villainGroupIds, henchmanGroupIds,
     heroDeckIds, bystandersCount, woundsCount, officersCount, sidekicksCount
   }
   These are the 9 canonical field names from 00.2 §8.1. They are locked.
   Do not rename, abbreviate, or add fields.

2. Caller POSTs to boardgame.io default endpoint:
   POST /games/legendary-arena/create
   Body: { numPlayers: N, setupData: <MatchSetupConfig> }
   → Returns { matchID }

3. boardgame.io stores the match and calls:
   Game.setup(ctx, matchData)
   → validateMatchSetup(matchData, registry)
       — checks BOTH shape AND registry ext_id existence (not shape-only)
       — throws Error with failing field name if invalid
       — this is the ONLY place in the engine where throwing is correct;
         moves must never throw (see Section 4, The Move Validation Contract)
   → buildInitialGameState(matchData, registry, ctx) — calls helpers:
       buildPlayerState(playerId, startingDeck, ctx) per player
         → G.playerZones[id].deck = shuffled starting deck (CardExtId[])
           (shuffling uses ctx.random.Shuffle — never Math.random())
         → G.playerZones[id].hand/discard/inPlay/victory = [] (empty)
       buildGlobalPiles(matchData, ctx)
         → G.piles.bystanders/wounds/officers/sidekicks sized from config counts
   → buildVillainDeck(matchData, registry, ctx) — constructs villain deck + type index
   → buildDefaultHookDefinitions(matchData) — constructs HookDefinition[] from schemeId/mastermindId
   → G.hookRegistry populated with HookDefinition[] (data-only, JSON-serializable)
   → G.lobby is initialised: { requiredPlayers: ctx.numPlayers, ready: {}, started: false }
   → G.messages = [], G.counters = {}
   → G is stored in boardgame.io's in-memory match store
   (ImplementationMap handler functions are NOT stored in G)

4. Players join via:
   POST /games/legendary-arena/<matchID>/join
   → Each player receives { playerID, credentials }
   → Match begins in the lobby phase

4b. Each player signals readiness (lobby phase only):
   setPlayerReady({ ready: true })
   → Sets G.lobby.ready[ctx.currentPlayer] = true
   → Move is phase-gated: only callable in the lobby phase

4c. Any player triggers the start check:
   startMatchIfReady()
   → validateCanStartMatch(G.lobby) checks all seats are ready
   → If valid: sets G.lobby.started = true, calls ctx.events.setPhase('setup')
   → Transitions: lobby → setup → play

5. Players submit moves in the play phase (each turn cycles start → main → cleanup):
   → boardgame.io calls the move function with (G, ctx, args)
   → Move function: validate args → check stage gate → mutate G
   → boardgame.io stores the new G

5b. On each turn boundary, boardgame.io fires lifecycle hooks:
   turn.onBegin → G.currentStage reset to 'start'
               → executeRuleHooks(G, ctx, 'onTurnStart', payload, G.hookRegistry, implementationMap)
               → applyRuleEffects(G, ctx, effects)
   turn.onEnd  → executeRuleHooks(G, ctx, 'onTurnEnd', payload, G.hookRegistry, implementationMap)
               → applyRuleEffects(G, ctx, effects)

6. After every move, boardgame.io calls:
   endIf(G, ctx)
   → Delegates to evaluateEndgame(G)
   → evaluateEndgame reads G.counters using ENDGAME_CONDITIONS key constants
   → Returns EndgameResult if a condition is met, undefined to continue

7. When game ends:
   → boardgame.io marks match as gameover
   → Final G is accessible but not persisted by the engine
```

### Card Data Flow: Registry into Game Engine

```
See "Server Startup Sequence" above for how the registry reaches the server.
See "Registry Metadata File Shapes" above for the shape of each metadata file.

Game.setup() receives the registry as part of matchData
  → validateMatchSetup checks all ext_ids against registry (throws on failure)
  → Resolves ext_id strings from MatchSetupConfig against registry
  → Builds G with ext_id string arrays (not full card objects)
  → Builds G.villainDeckCardTypes: Record<CardExtId, RevealedCardType>
    — maps each villain deck card to its type ('villain', 'henchman', etc.)
    — stored in G so moves can classify cards without registry access
  → G never stores imageUrl, ability text, or display data

At runtime, moves operate on ext_id strings in G.
Card display data is resolved by the UI via the registry separately.
Card type classification uses G.villainDeckCardTypes — no registry in moves.
```

### Zone & Pile Structure

`CardExtId = string` is the canonical type for all zone contents. Every zone in
`G` stores `CardExtId` strings exclusively — never full card objects, display
names, or database IDs. Types are defined in `src/state/zones.types.ts`.

**`PlayerZones`** — 5 zones per player:

| Zone | Contents at setup | How cards enter |
|---|---|---|
| `deck` | Shuffled starting deck (`CardExtId[]`) | `buildPlayerState` at setup |
| `hand` | `[]` — empty | `drawCards` move |
| `discard` | `[]` — empty | `endTurn` move (from inPlay/hand) |
| `inPlay` | `[]` — empty | `playCard` move |
| `victory` | `[]` — empty | `fightVillain` and similar defeat moves |

**`GlobalPiles`** — 4 shared piles sized from `MatchSetupConfig` count fields:

| Pile | Size | Config field |
|---|---|---|
| `bystanders` | `bystandersCount` | `MatchSetupConfig.bystandersCount` |
| `wounds` | `woundsCount` | `MatchSetupConfig.woundsCount` |
| `officers` | `officersCount` | `MatchSetupConfig.officersCount` |
| `sidekicks` | `sidekicksCount` | `MatchSetupConfig.sidekicksCount` |

**Initialization rule:** Zones other than `deck` start empty at setup. Cards
enter non-deck zones **exclusively through game moves** — never through setup
initialization. Pre-populating a non-deck zone at setup would bypass the move
validation contract and break replay determinism.

**Shape validators** (`validateGameStateShape`, `validatePlayerStateShape` from
`src/state/zones.validate.ts`) check structural shape only — they confirm zone
arrays exist and contain strings. They do **not** verify that ext_ids correspond
to real cards in the registry. Registry ext_id existence is validated by
`validateMatchSetup` at match creation time, not at move time.

### What Lives Where

| Data | Location | Mutable |
|---|---|---|
| Card metadata and images | R2 (Cloudflare) / `data/` local | No (immutable releases) |
| Match setup config | boardgame.io matchData | No (input) |
| Live game state (G) | boardgame.io in-memory | Yes — via moves only |
| boardgame.io metadata (ctx) | boardgame.io in-memory | Yes — by boardgame.io internals |
| Match credentials | boardgame.io in-memory | No |
| Snapshots | Application layer (future) | No (immutable records) |
| Rules text (seeded) | PostgreSQL (`legendary.rules`) | No (seeded at deploy) |
| Rules text (runtime) | Server in-memory via `getRules()` | No — read-only after load |
| Card registry | Server in-memory via `CardRegistry` | No — read-only after load |
| ImplementationMap handler functions | Runtime memory (NOT in G) | No — built at startup |

---

## Section 3 — Persistence Boundaries

This is the most important section. Every engineer must know it before writing
any storage code.

### The Three Data Classes

#### Class 1 — Runtime State (NEVER PERSIST)

These objects exist **only in boardgame.io's in-memory process** while a match
is running. They must never be written to PostgreSQL, Redis, files, or any store.

| Object | Why it must not be persisted |
|---|---|
| `G` (entire object) | Managed by boardgame.io; re-hydrating from DB would bypass boardgame.io's state integrity guarantees |
| `ctx` | boardgame.io internal metadata; no public contract |
| `matchState` / `stateID` | boardgame.io internals; format may change across versions |
| In-flight `RuleEffect[]` | Transient execution artifact; valid only within a single move |
| `ImplementationMap` | Contains handler functions; functions cannot be serialised |
| Socket / session data | Network layer; not part of game state |
| `G.hookRegistry` | Derived from setup; reconstructed each match from `matchData` |

If you feel the urge to persist any of these, stop and re-read this section.

#### Class 2 — Configuration State (SAFE TO PERSIST)

These are deterministic **inputs** to a match. They may be stored before and
after a match runs, as they have no dependency on boardgame.io runtime.

| Object | Notes |
|---|---|
| `MatchSetupConfig` | The 9-field setup payload (see 00.2 §8.1) |
| Player names and seat assignments | Created at join time |
| Match creation timestamp | ISO 8601 string |
| Scheme / mastermind / hero selections | Already encoded in MatchSetupConfig |

These map to the `PersistableMatchConfig` type in `src/persistence/persistence.types.ts`.

#### Class 3 — Snapshot State (SAFE TO PERSIST AS IMMUTABLE RECORDS)

These are **derived, read-only views** of match state at a point in time.
They may be stored for debugging, auditing, and replay reconstruction — but
with strict constraints:

- A snapshot **must never** be re-hydrated into a live boardgame.io match
- A snapshot **must never** replace `G` as the source of truth
- A snapshot **must** use zone counts, not zone contents (no `ext_id` arrays)
- Snapshots are safe to delete at any time without affecting game integrity

The canonical shape is `MatchSnapshot` in `src/persistence/persistence.types.ts`.

### Field Classification Reference

| Field / Object | Class | Notes |
|---|---|---|
| `G` | Runtime | Never persist |
| `G.counters` | Snapshot (as copy) | Read-only record; key names governed by `ENDGAME_CONDITIONS` |
| `G.messages` | Snapshot (as copy) | Read-only record; deterministic log of rule effects applied |
| `G.hookRegistry` | Runtime | `HookDefinition[]` — data-only, reconstructed from `matchData` at setup |
| `G.playerZones[*].*` | Snapshot → count only | All 5 zones (deck/hand/discard/inPlay/victory) — zone contents are Runtime; see Zone & Pile Structure |
| `G.piles.*` | Snapshot → count only | All 4 piles (bystanders/wounds/officers/sidekicks) — pile contents are Runtime |
| `G.lobby` | Runtime | Transient phase state; see Section 4 |
| `G.lobby.started` | Runtime | UI observability flag; not a persistence record |
| `G.currentStage` | Runtime | Game engine's inner stage (`start`/`main`/`cleanup`) — in `G`, not `ctx`; reset to `'start'` on each turn |
| `G.villainDeck.deck` | Snapshot → count only | Zone contents are Runtime |
| `G.villainDeck.discard` | Snapshot → count only | Zone contents are Runtime |
| `G.villainDeckCardTypes` | Runtime | Derived from registry at setup; not persisted |
| `G.selection` | Runtime | Match setup selection state; introduced WP-005B |
| `G.city` | Runtime | 5-tuple of `CardExtId \| null`; villain movement zone; introduced WP-015 |
| `G.hq` | Runtime | 5-tuple of `CardExtId \| null`; hero recruitment zone; introduced WP-015 |
| `G.ko` | Runtime | `CardExtId[]`; knocked-out cards zone; introduced WP-017 |
| `G.attachedBystanders` | Runtime | `Record<CardExtId, CardExtId[]>`; bystanders attached to villains; introduced WP-017 |
| `G.turnEconomy` | Runtime | Attack/recruit/spent tracking; reset per turn; introduced WP-018 |
| `G.cardStats` | Runtime | `Record<CardExtId, CardStatEntry>`; built at setup from registry; introduced WP-018 |
| `G.mastermind` | Runtime | `MastermindState` with tactics deck; introduced WP-019 |
| `G.heroAbilityHooks` | Runtime | `HeroAbilityHook[]`; data-only, built at setup; introduced WP-021 |
| `G.cardKeywords` | Runtime | `Record<CardExtId, BoardKeyword[]>`; built at setup from registry; introduced WP-025 |
| `G.schemeSetupInstructions` | Runtime | `SchemeSetupInstruction[]`; stored for replay observability; introduced WP-026 |
| `ImplementationMap` | Runtime | Handler functions — must never enter `G` |
| `ctx` | Runtime | Never persist |
| `MatchSetupConfig` | Configuration | Safe to store |
| Player names | Configuration | Safe to store |
| `MatchSnapshot` | Snapshot | Immutable, read-only |
| `EndgameResult` | Snapshot (as copy) | Embed in snapshot |

---

## Section 4 — boardgame.io Runtime Model

### The LegendaryGame Object

`LegendaryGame` is the single boardgame.io `Game()` object that defines the
entire game. It is created in `packages/game-engine/src/game.ts` (WP-002) and
is the package's primary export. Every phase, move, lifecycle hook, and endgame
condition must be registered through this object — never through parallel or
alternative Game instances.

**boardgame.io version: `^0.50.0`** (locked in `packages/game-engine/package.json`).
Do not upgrade this dependency without a `DECISIONS.md` entry explaining the
impact. The `Game()` API, Immer-based `G` mutation model, `ctx` shape, and
`Server()` integration are all version-specific. An unintentional upgrade would
silently break all move functions, phase hooks, and test utilities.

### What `G` Is

`G` is the **game state object** managed entirely by boardgame.io. It is:
- JSON-serializable at all times (no class instances, Maps, Sets, or functions)
- The single source of truth for all gameplay data during a match
- Passed into every move function and lifecycle hook as a parameter
- Mutated via Immer (boardgame.io 0.50.x) — move functions receive a draft and
  mutate it directly; they return void, not a new `G`
- Never stored in a database

`G` is NOT a database row, a Redux store, or a plain JavaScript object that the
application owns. boardgame.io owns `G`.

`LegendaryGameState` is the TypeScript type for `G` (defined in
`packages/game-engine/src/types.ts`, first created in WP-002). It is expanded
by each successive Work Packet that adds new state fields. The canonical initial
shape is empty — `G` gains fields as packets are completed.

### What `ctx` Is

`ctx` is boardgame.io's **match metadata** — the information boardgame.io tracks
to manage turn order, phases, and player rotation. It includes:

| Field | Meaning |
|---|---|
| `ctx.currentPlayer` | Player ID whose turn it is |
| `ctx.turn` | Current turn number |
| `ctx.phase` | Current phase name (`lobby`, `setup`, `play`, `end`) |
| `ctx.numPlayers` | Total number of players in the match |
| `ctx.random.*` | Seeded random number functions — the **only** permitted randomness source |
| `ctx.events.*` | Phase/turn transition functions (`endTurn`, `setPhase`, etc.) |

`ctx` is **never** to be persisted or serialised outside of boardgame.io's own
internal mechanisms.

### Phase Sequence and Lifecycle Mapping

Legendary Arena has four phases. These phase names are locked — they were
scaffolded in WP-002 and the mapping to lifecycle concepts was formalised in
WP-007A. The names must never be changed without updating both `LegendaryGame`
and `MATCH_PHASES`.

| Lifecycle concept (00.2 §8.2) | boardgame.io phase name | Notes |
|---|---|---|
| Lobby | `lobby` | Players join and ready up |
| Setup | `setup` | Deterministic deck construction |
| In Progress | `play` | Active gameplay; each turn cycles through three stages |
| Completed | `end` | Terminal; final scoring |

Do not invent alternate phase names. The mapping is locked.

```
lobby  →  setup  →  play  →  end
```

| Phase | Entry condition | Key activity | Exit mechanism |
|---|---|---|---|
| `lobby` | Match created | Players join and signal readiness | `startMatchIfReady()` calls `ctx.events.setPhase('setup')` |
| `setup` | All players ready | Deterministic deck construction | Automatic on setup completion |
| `play` | Setup complete | Turns cycle: `start → main → cleanup` per player | `evaluateEndgame(G)` returns truthy via `endIf` |
| `end` | Game over | Final scoring, outcome display | Terminal — no further transitions |

`ctx.phase` is managed by boardgame.io. **Never set it directly** — always use
`ctx.events.setPhase()` from within a move, with a `// why:` comment.

`MATCH_PHASES` and `TURN_STAGES` are the canonical arrays for their respective
union types (exported from `src/turn/turnPhases.types.ts`). Drift-detection tests
must assert these arrays exactly match their union types — any code adding a new
phase or stage must update both the type and the array simultaneously.

### The Turn Stage Cycle

Within the `play` phase, each player's turn passes through three stages in order:

```
start  →  main  →  cleanup  →  (turn ends)
```

**`TurnStage`** values (`'start' | 'main' | 'cleanup'`) are defined in
`src/turn/turnPhases.types.ts`. This is separate from boardgame.io's own
stage/step concept — `TurnStage` belongs entirely to the game engine.

**Why is `G.currentStage` stored in `G` and not `ctx`?**
boardgame.io's `ctx` does not expose the inner stage in a form that moves can
read. Move functions receive `(G, ctx, args)` and must be able to check which
stage they are in to enforce gating. Storing `currentStage` in `G` makes it:
- Observable to moves (`isMoveAllowedInStage(moveName, G.currentStage)`)
- JSON-serializable (replay and snapshot support)
- Resettable on each turn (`play` phase `onBegin` sets `G.currentStage = 'start'`)

This is a hard rule: **stage tracking belongs in `G`, never in `ctx`**.

**The advancement flow:**

```
advanceTurnStage(G, ctx):
  next = getNextTurnStage(G.currentStage)
  if next is not null:
    G.currentStage = next
    return updated G
  else (currentStage was 'cleanup'):
    ctx.events.endTurn()  // why: boardgame.io manages player rotation
    return G unchanged
```

`getNextTurnStage` is the only authority on stage ordering — it is defined once
in `src/turn/turnPhases.logic.ts` and called everywhere else. No code outside
that file may hardcode the ordering `'start' → 'main' → 'cleanup'`.

**Valid stage transitions:**
- `start → main` ✓
- `main → cleanup` ✓
- Any other transition ✗ — enforced by `isValidTurnStageTransition`

**Turn start:** On every `play` phase `onBegin`, `G.currentStage` is reset to
`'start'`. The rule pipeline fires `onTurnStart` at this point.

**Turn end:** When `advanceTurnStage` is called with `currentStage = 'cleanup'`,
`ctx.events.endTurn()` is called. boardgame.io advances to the next player and
fires `onTurnEnd` triggers. Manual player index rotation is **not permitted**.

### The Move Validation Contract

Every boardgame.io move function in the engine must follow this exact ordering
before touching `G`. There are no exceptions.

```
moveFunction(G, ctx, args):
  Step 1 — Validate args
    call validateXxxArgs(args)
    if ok: false → log structured error, return (no G mutation)

  Step 2 — Check stage gate
    call isMoveAllowedInStage(moveName, G.currentStage)
    if blocked → return (no G mutation)

  Step 3 — Mutate G
    use zoneOps.ts helpers to move cards between zones
    return void (boardgame.io 0.50.x uses Immer — mutate the draft, return void)
```

**Why this ordering?**
- Args validation comes first so malformed inputs are caught before any state check.
- Stage gating comes second so a valid-but-wrong-stage call is rejected without
  touching `G`. Both failures are silent returns — boardgame.io move functions
  **never throw**; exceptions would crash the server process.
- `G` is only mutated once both guards pass.

**`MoveResult` and `MoveError` are the engine-wide result contract** (defined in
`src/moves/coreMoves.types.ts`):

```ts
interface MoveError  { code: string; message: string; path: string }
type     MoveResult  = { ok: true } | { ok: false; errors: MoveError[] }
```

Every validator in every packet — lobby moves, rule hooks, endgame evaluators,
villain deck functions — must return `MoveResult`. No packet may define a new
parallel error type.

**Exception:** `ZoneValidationError` (from `src/state/zones.validate.ts`) uses
`{ field: string; message: string }` — a narrower shape for structural zone
checks that report which field failed. Zone shape validators are distinct from
move validators and use this simpler type; they do not return `MoveResult`.

**`Game.setup()` is the only place where throwing is correct.** `validateMatchSetup`
(called from `Game.setup()`) throws an `Error` if the `MatchSetupConfig` is invalid.
This is initialization — not a move. boardgame.io propagates a setup failure as
a match creation error before any player has joined. Everywhere else in the engine
(moves, validators, effect applicators) **must never throw**. The asymmetry is
intentional:

| Context | On invalid input | Reason |
|---|---|---|
| `Game.setup()` | Throws `Error` | Match creation must abort before `G` is built |
| Moves | Returns void silently | boardgame.io would crash if a move threw |
| `validateMatchSetup` | Returns `ValidateMatchSetupResult` | Pure validator — caller decides to throw |
| Zone / move validators | Returns `MoveResult` or `ZoneValidationError` | Structured results, never throw |

**Stage gating is driven by `MOVE_ALLOWED_STAGES`** (defined in
`src/moves/coreMoves.gating.ts`). The canonical stage assignments are:

| Move | Allowed stages | Why |
|---|---|---|
| `drawCards` | `start`, `main` | Cards drawn before and during action; not after cleanup |
| `playCard` | `main` | Cards played only during the action window |
| `endTurn` | `cleanup` | Turn ends only after all actions are resolved |

Any deviation from these assignments must be recorded in `DECISIONS.md`. Stage
gating uses `TurnStage` constants — never hardcoded string literals.

### Zone Mutation Rules

All zone operations go through `zoneOps.ts` pure helpers. These rules apply to
every packet that moves cards between zones.

**`moveCardFromZone`** — moves one card from a source zone to a destination zone:
```ts
moveCardFromZone(
  fromZone: CardExtId[],
  toZone:   CardExtId[],
  cardId:   CardExtId
): { from: CardExtId[]; to: CardExtId[]; found: boolean }
```

**`moveAllCards`** — moves all cards from one zone to another:
```ts
moveAllCards(
  fromZone: CardExtId[],
  toZone:   CardExtId[]
): { from: CardExtId[]; to: CardExtId[] }
```

**Hard rules:**
1. **Helpers return new arrays — they never mutate their inputs.**
2. **Zones contain only `CardExtId` strings** — never full card objects.
3. **`zoneOps.ts` has no `boardgame.io` import** — pure, independently testable.
4. **No `.reduce()` in zone operations** — use `for` or `for...of` loops.

**Why pure helpers?** Extracting zone operations into `zoneOps.ts` keeps each
move function under 30 lines and makes the operations independently testable.

### The Rule Execution Pipeline

This is the most architecturally significant subsystem in the game engine. Every
Work Packet from WP-015 onward that touches game events must understand it.

**The core problem:** Game rules (scheme twists, mastermind strikes, hero
abilities) are different for every match. The handler logic must be swappable,
but `G` must remain JSON-serializable. Functions cannot live in `G`.

**The solution — two separate registries:**

```
G.hookRegistry: HookDefinition[]          ← lives IN G (JSON-serializable)
ImplementationMap                         ← lives OUTSIDE G (contains functions)
```

`HookDefinition` is **data-only** — no handler functions, no closures, no
class instances. It declares what a rule responds to:

```ts
interface HookDefinition {
  id:       string           // stable unique identifier
  kind:     'scheme' | 'mastermind'
  sourceId: string           // ext_id of the scheme or mastermind
  triggers: RuleTriggerName[]
  priority: number           // lower fires first; ties broken by id lexically
}
```

`ImplementationMap` contains the handler functions, keyed by `hookDefinition.id`:

```ts
type ImplementationMap = Record<
  string,
  (G: LegendaryGameState, ctx: Ctx, payload: unknown) => RuleEffect[]
>
```

**The two-step execution pipeline:**

```
Step 1 — Collect effects (executeRuleHooks):
  getHooksForTrigger(G.hookRegistry, triggerName)
  → sorted HookDefinition[] (priority asc, then id lexically)
  → for each definition: look up handler in ImplementationMap by definition.id
  → call handler(G, ctx, payload) → RuleEffect[]
  → accumulate all effects
  → return flat RuleEffect[] (G is NOT modified here)

Step 2 — Apply effects (applyRuleEffects):
  for...of effects:
    queueMessage    → G.messages.push(message)
    modifyCounter   → G.counters[key] = (G.counters[key] ?? 0) + delta
    drawCards       → shared draw helper from coreMoves.impl.ts
    discardHand     → moveAllCards from zoneOps.ts
    unknown type    → push warning to G.messages (never throw)
  → returns updated G
```

**Key invariants:**
- `ImplementationMap` handler functions are **never stored in `G`**
- `executeRuleHooks` **never modifies `G`** — it only reads it
- `applyRuleEffects` uses `for...of` — never `.reduce()`
- Unknown effect types push a warning to `G.messages` and continue — never throw
- Hook execution order is deterministic: priority ascending, then `id` lexically
  for ties. Given the same `G.hookRegistry`, identical trigger sequences always
  produce identical effects. This is required for replay correctness.
- `RULE_TRIGGER_NAMES` and `RULE_EFFECT_TYPES` are the canonical arrays — any
  code adding a new trigger or effect type must update these arrays, confirmed
  by drift-detection tests

### The endIf Contract

`endIf` is boardgame.io's mechanism for ending a match. In Legendary Arena it is
wired in the `play` phase as:

```ts
endIf: (G, ctx) => evaluateEndgame(G) ?? undefined
```

**Hard rules that must never be violated:**

1. **`endIf` must be a pure function** — no I/O, no events, no side effects.
2. **`endIf` must delegate entirely to `evaluateEndgame`** — no inline counter
   logic inside `endIf`.
3. **`evaluateEndgame` reads only `G.counters`** via `ENDGAME_CONDITIONS` constants.
4. **Loss before victory** when both conditions trigger simultaneously.

### G.counters Key Conventions

`G.counters` is `Record<string, number>`. Canonical endgame counter names are
defined in `ENDGAME_CONDITIONS` (exported from `src/endgame/endgame.types.ts`):

| Constant | Counter key string | Meaning |
|---|---|---|
| `ENDGAME_CONDITIONS.ESCAPED_VILLAINS` | `'escapedVillains'` | Villains past the City — checked against `ESCAPE_LIMIT` |
| `ENDGAME_CONDITIONS.SCHEME_LOSS` | `'schemeLoss'` | Scheme triggered — `>= 1` means loss |
| `ENDGAME_CONDITIONS.MASTERMIND_DEFEATED` | `'mastermindDefeated'` | All tactics defeated — `>= 1` means victory |

Any code incrementing these counters must import and use these constants — never
string literals. `ESCAPE_LIMIT = 8` is a hardcoded MVP constant; import it, do
not re-hardcode the value.

### RevealedCardType Conventions

`G.villainDeckCardTypes` is `Record<CardExtId, RevealedCardType>`. Canonical card
type strings are defined in `REVEALED_CARD_TYPES` (exported from
`src/villainDeck/villainDeck.types.ts`):

| Index | Type string | Trigger emitted on reveal |
|---|---|---|
| 0 | `'villain'` | `onCardRevealed` only (WP-015 routes to City) |
| 1 | `'henchman'` | `onCardRevealed` only (WP-015 routes to City) |
| 2 | `'bystander'` | `onCardRevealed` only |
| 3 | `'scheme-twist'` | `onCardRevealed` + `onSchemeTwistRevealed` |
| 4 | `'mastermind-strike'` | `onCardRevealed` + `onMastermindStrikeRevealed` |

Slugs use **hyphens not underscores** — confirmed against
`data/metadata/card-types.json`. A mismatch (e.g., `'scheme_twist'`) silently
prevents the correct trigger from firing because the type lookup in
`revealVillainCard` will not match the string literal in the conditional branch.

Any code that reads `G.villainDeckCardTypes` or defines a `RevealedCardType`
value must use `REVEALED_CARD_TYPES` constants — never inline string literals.
A drift-detection test in `villainDeck.setup.test.ts` guards this: failure means
a type string was added to the `RevealedCardType` union but not the canonical
array, or vice versa.

### The `G.lobby.started` Observability Pattern

`G.lobby.started` is a boolean flag set to `true` by `startMatchIfReady()` before
calling `ctx.events.setPhase('setup')`. Without it, the UI cannot detect "lobby
completed" without fragile phase inference.

**Pattern:** When a phase transition has UI significance, store an explicit flag
in `G` before calling `ctx.events.setPhase()`. The flag lives in `G` — the source
of truth — not in `ctx.phase`.

### How Moves Work

```
Player submits move →
  boardgame.io validates it is the correct player's turn →
  boardgame.io calls moveFunction(G, ctx, args) →
  Move function (see "The Move Validation Contract" above):
    1. Validates args — if invalid: return void (no throw, no G mutation)
    2. Checks stage gate — if blocked: return void (no G mutation)
    3. Mutates G via zoneOps.ts helpers (see "Zone Mutation Rules" above) →
  boardgame.io stores the new G →
  boardgame.io calls endIf(G, ctx) →
    endIf delegates to evaluateEndgame(G) →
    If truthy: match ends
    If falsy: continue
```

Moves **never throw**. If a move threw, boardgame.io would catch it as an
unhandled exception and potentially crash the server process. Invalid input
is always silently discarded via `return` — after logging a structured error.

### How Phase Transitions Work

Phase transitions happen from inside moves via `ctx.events.setPhase('phaseName')`.
This is the **only** way to change phases — never by setting `ctx.phase` directly.

Every call to `ctx.events.setPhase()` must have a `// why:` comment explaining
the transition.

### How Turn Transitions Work

Within the `play` phase, turn transitions are driven by `advanceTurnStage`:

```
advanceTurnStage called with G.currentStage = 'start'
  → getNextTurnStage('start') returns 'main'
  → G.currentStage = 'main'; return G

advanceTurnStage called with G.currentStage = 'main'
  → getNextTurnStage('main') returns 'cleanup'
  → G.currentStage = 'cleanup'; return G

advanceTurnStage called with G.currentStage = 'cleanup'
  → getNextTurnStage('cleanup') returns null
  → ctx.events.endTurn()  // boardgame.io advances to next player
  → return G unchanged
```

`ctx.events.endTurn()` is the **only** mechanism for ending a turn and advancing
to the next player. Manual player index rotation is not permitted — boardgame.io
manages turn order.

Every call to `ctx.events.endTurn()` must have a `// why:` comment.

`getNextTurnStage` is the single authority on stage ordering — defined once in
`src/turn/turnPhases.logic.ts`, imported everywhere else. No other file may
encode the `start → main → cleanup` ordering.

### Why `G` Must Never Be Persisted

1. **Integrity**: boardgame.io tracks `G` as part of a versioned state chain.
2. **Determinism**: A match can always be reconstructed from setup config and
   ordered moves. Storing `G` mid-match is redundant.
3. **Correctness**: `G` contains derived data (`hookRegistry`, `villainDeckCardTypes`,
   `currentStage`) that must be reconstructed or reset at the right lifecycle
   points — not loaded from a snapshot.

---

### Execution Mode

Execution Checklists (ECs) are active. For any Work Packet with a
corresponding EC, the EC is the authoritative execution contract.

No code changes may be made unless an EC exists and all EC clauses
are satisfied.

---

## MVP Gameplay Invariants (WP-010–WP-020)

These invariants are locked by the Work Packets that established the MVP
gameplay loop. They apply to all current and future packets. Violating any
invariant below is an architectural bug, even if the code compiles.

### Endgame & Counters

- `evaluateEndgame(G)` is the **only** authority for match termination.
- All endgame triggers are mediated through `G.counters`.
- Endgame counters are **numeric flags**: a value >= 1 is truthy. Counters
  must never be boolean fields.
- Loss conditions are always evaluated **before** victory.
- All code that affects endgame state must use `ENDGAME_CONDITIONS` constants
  — never string literals.

### Registry & Runtime Boundary

- The registry is available **only during `Game.setup()`**.
- No move, rule hook, or scorer may query the registry at runtime.
- All card metadata required at runtime must be **resolved at setup time** and
  stored in `G` as plain data structures (e.g., `G.cardStats`,
  `G.villainDeckCardTypes`, `G.heroAbilityHooks`).
- Runtime logic operates exclusively on `CardExtId` strings and deterministic
  state derived from setup.

### Zones, State & Serialization

- All runtime state (`G`) must remain **JSON-serializable at all times**.
- Zones and piles store **`CardExtId` strings only**.
- No Maps, Sets, classes, functions, or closures are permitted in `G`.
- All zone mutations must be performed via **pure helper functions** that
  return new arrays and never mutate inputs.

### Moves & Determinism

- All boardgame.io moves follow the three-step contract: validate arguments,
  check stage gating, mutate `G`.
- Moves return `void`, never throw, and perform no I/O.
- All randomness must flow through `ctx.random.*` — never `Math.random()`.

### Economy vs Scoring

- The attack/recruit economy (`G.turnEconomy`) determines **what actions are
  allowed** during play. It resets each turn.
- VP scoring (`computeFinalScores`) determines **final results only**.
- Final score computation is a **pure function**: it must never mutate `G`,
  never trigger endgame logic, and never query the registry.
- Endgame detection (WP-010) and VP scoring (WP-020) are strictly separate
  concerns.

### Data Representation Before Execution

- Gameplay text (hero abilities, keywords, conditions) is represented in the
  engine **before it is executed**.
- Representation layers (contracts, hooks, taxonomies) must be in place before
  execution layers are introduced.
- Execution of represented data must never require refactoring existing
  state contracts.

### Debuggability & Diagnostics

- All engine behavior must be debuggable via **deterministic reproduction and
  state inspection** — not logging, breakpoints, or printf debugging.
- Behavior must be fully reproducible given identical setup configuration,
  identical RNG seed, and identical ordered moves.
- No state mutation may be introduced that cannot be inspected post-execution
  or validated via tests or replay analysis.
- After any operation, runtime state must remain JSON-serializable, packet-owned
  zones/counters must contain no invalid entries, and no cross-module state
  may be mutated outside declared scope.
- Failures must be localizable via invariant violation or unexpected state
  mutation.

---

## Section 5 — Package Dependency Rules

### Rule Summary

```
packages/game-engine  ←── (no game-engine imports from here)
packages/registry     ←── (no registry imports from game-engine)
apps/server           ──→ game-engine, registry
apps/registry-viewer  ──→ registry
```

### Detailed Rules

**`packages/game-engine` may NOT import:**
- `@legendary-arena/registry` — card type classification data
  (`G.villainDeckCardTypes`) is built at setup time from the registry passed in
  as `matchData`. Move functions use this stored index — never the registry directly.
  Exception: `Game.setup()` receives the registry as `matchData` — this is
  correct and intentional. The prohibition is on importing the registry package
  at module scope, not on receiving it as a function parameter.
- `pg` or any database driver — no DB queries inside moves (ever)
- `boardgame.io` in pure helper files — these files must be independently
  testable without a boardgame.io instance. This prohibition covers:
  - `src/turn/turnPhases.logic.ts` — turn stage helpers
  - `src/state/zones.validate.ts` — zone shape validators
  - `src/rules/ruleHooks.*.ts` — trigger/effect contracts and registry
  - `src/rules/ruleRuntime.*.ts` — execution pipeline and effect applicator
  - `src/endgame/endgame.evaluate.ts` — endgame condition evaluator
  - `src/moves/zoneOps.ts` — zone mutation helpers
  - `src/villainDeck/villainDeck.types.ts` — card type definitions
  - `src/villainDeck/villainDeck.setup.ts` — deck construction helper
  - Any other pure logic file that does not need boardgame.io lifecycle hooks
- Any `apps/*` package

**`packages/registry` may NOT import:**
- `@legendary-arena/game-engine` — the registry knows nothing about game rules
- `pg` — the registry reads from R2/filesystem, not PostgreSQL
- Any `apps/*` package

**`apps/server` may NOT:**
- Implement game logic, rules, or gameplay — the server is a wiring layer only
- Import browser or DOM APIs
- Import UI frameworks (Vue, React)
- Import Direct R2 SDK for card data (use `@legendary-arena/registry`)
- Define a boardgame.io `Game()` directly — `LegendaryGame` comes from
  `@legendary-arena/game-engine`; `apps/server/src/game/legendary.mjs` is a
  backwards-compat thin re-export only

**`apps/server/scripts/` CLI scripts:**
- Use Node v22 built-in `fetch` exclusively — no axios, no node-fetch
- Exit 1 on failure with a full-sentence message to stderr
- Are ESM modules (`.mjs` extension or `"type": "module"`)
- Do not store credentials to disk

**Test files may NOT import:**
- `boardgame.io` directly — use `makeMockCtx` from
  `packages/game-engine/src/test/mockCtx.ts` instead
- `boardgame.io/testing` — the engine is tested by calling functions directly
  with mock contexts, not by running a match server

### Why These Rules Exist

The goal is **layered testability**: each package can be built, linted, and
tested independently without running the other packages.

The `G.villainDeckCardTypes` and `G.currentStage` patterns both follow the same
principle: data that move functions need at runtime is built or reset at the right
lifecycle point (setup, turn start) and stored in `G`. Zone shape validators
follow the same principle for testability: pure functions, no boardgame.io import,
callable in isolation.

These constraints are enforced by:
1. TypeScript `"paths"` configuration in each package's `tsconfig.json`
2. `pnpm` workspace dependency declarations in `package.json`
3. The lint checklist in `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`

---

## High‑Level System Diagram

```text
+------------------+
|   Client (UI)    |
|------------------|
| - Input          |
| - Rendering      |
| - Spectating     |
+---------+--------+
          |
          | intents (ClientTurnIntent)
          v
+------------------+
| Network Boundary |  apps/server
|------------------|
| - Wires packages |  ← NO game logic here
| - Turn intents   |
| - Validation     |
| - Ordering       |
| - CLI scripts    |
+---------+--------+
          |
          | move functions
          v
+------------------+
| Game Engine      |  packages/game-engine
|------------------|
| - LegendaryGame  |  ← single Game() object (boardgame.io ^0.50.0)
| - Lobby phase    |
| - Turn loop      |  ← start → main → cleanup cycle
| - Rule pipeline  |  ← HookDefinition + ImplementationMap
| - Keywords       |
| - City logic     |
| - Villain deck   |
| - Endgame eval   |
| - Invariants     |
+---------+--------+
          |
          | reads ext_id strings resolved at startup
          v
+------------------+
| Card Registry    |  packages/registry
|------------------|
| - Set metadata   |
| - Card schemas   |
| - Zod validation |
+---------+--------+
          |
          | R2 / local files (read-only at startup)
          v
+------------------+
| Determinism &    |
| Replay Layer     |
|------------------|
| - State hashing  |
| - Replay inputs  |
| - Snapshots      |
+---------+--------+
          |
          v
+------------------+
| Analytics & Ops  |
|------------------|
| - Metrics        |
| - Balance sim    |
| - Live Ops       |
+------------------+
```

---

*Last updated: WP-014 review — villain deck reveal pipeline and RevealedCardType conventions*
*Maintained by: human developer — update this file when package boundaries or
data flow decisions change. Do not let a Work Packet change what this file says
without also updating this file.*
