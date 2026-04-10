# Session Prompt -- Execute WP-005B (Deterministic Setup Implementation)

**FULL CONTENTS MODE**

You are operating inside the Legendary Arena AI coordination system.

---

## What You Are Doing

Execute WP-005B to implement deterministic match setup for
`@legendary-arena/game-engine`. This packet builds the initial game state from
a validated `MatchSetupConfig` using `ctx.random.*` exclusively for shuffling.

After this session, the game engine:
- Has `shuffleDeck(cards, ctx)` -- deterministic, `ctx.random.Shuffle` only
- Has `makeMockCtx` -- shared test helper; `Shuffle` reverses arrays (not identity)
- Has `buildInitialGameState(config, registry, ctx)` -- produces fully populated `G`
- Has `Game.setup()` wired to call `validateMatchSetup` first, throw on failure,
  then call `buildInitialGameState`
- Passes a determinism test: two calls with the same `makeMockCtx` produce identical `G`

---

## Authority Chain (Read in This Order)

Before writing any code, read these files in order:

1. `.claude/CLAUDE.md` -- root coordination, EC-mode rules, governance set
2. `docs/ai/ARCHITECTURE.md` -- Section 2 (Match Lifecycle step 3,
   Zone & Pile Structure, Card Field Data Quality), Section 4 (Move Validation
   Contract -- Game.setup() throwing table)
3. `.claude/rules/game-engine.md` -- game engine enforcement rules
4. `.claude/rules/code-style.md` -- code style enforcement rules
5. `docs/ai/work-packets/WP-005B-deterministic-setup-implementation.md` --
   **THE WORK PACKET** (authoritative design document)
6. `docs/ai/execution-checklists/EC-005B-setup-implementation.checklist.md` --
   **THE EXECUTION CHECKLIST** (every item must be satisfied exactly)
7. `docs/ai/REFERENCE/00.2-data-requirements.md` -- section 8.1 (9 field names),
   section 8.2 (runtime state boundaries), section 1.2 (hero deck shape)
8. `docs/ai/REFERENCE/00.6-code-style.md` -- code style rules (Rule 6: `// why:`,
   Rule 8: no `.reduce()`, Rule 13: ESM only, Rule 14: no renamed fields)

**Then read the actual source files you will modify or reference:**

9. `packages/game-engine/src/types.ts` -- **will be modified** -- expand
   `LegendaryGameState` with new G fields
10. `packages/game-engine/src/game.ts` -- **will be modified** -- wire
    `validateMatchSetup` + `buildInitialGameState` into `setup()`
11. `packages/game-engine/src/index.ts` -- **will be modified** -- export new
    public types if needed
12. `packages/game-engine/src/matchSetup.types.ts` -- reference only --
    `MatchSetupConfig` and `ValidateMatchSetupResult` from WP-005A.
    **This file must NOT be modified.**
13. `packages/game-engine/src/matchSetup.validate.ts` -- reference only --
    `validateMatchSetup` and `CardRegistryReader` from WP-005A.
    **This file must NOT be modified.**
14. `packages/registry/src/types/index.ts` -- reference only -- `CardRegistry`,
    `Hero`, `Mastermind`, `VillainGroup`, `Scheme`, `FlatCard` types. Setup
    resolves ext_id strings into these objects to build deck contents.

---

## Pre-Execution Checks

Before writing a single line, confirm:

- [ ] WP-005A complete: `MatchSetupConfig`, `MatchSetupError`,
      `ValidateMatchSetupResult`, and `validateMatchSetup` exported from
      `@legendary-arena/game-engine`
- [ ] `packages/game-engine/src/types.ts` exports `LegendaryGameState`
- [ ] `@legendary-arena/registry` exports `CardRegistry` and
      `createRegistryFromLocalFiles`
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0

---

## Execution Rules

1. **One Work Packet per session** -- only WP-005B
2. **Read the full WP and EC** before writing code
3. **EC is the execution contract** -- every checklist item must be satisfied
4. **If the EC and WP conflict, the WP wins**
5. **ESM only** -- `node:` prefix on all built-ins, no `require()`
6. **Code style**: `docs/ai/REFERENCE/00.6-code-style.md` -- all rules apply
7. **No `Math.random()`** -- all randomness uses `ctx.random.Shuffle` only
8. **No `.reduce()`** in deck construction -- use `for...of`
9. **`G` stores ext_id strings only** -- no full card objects in zones or piles
10. **WP-005A files are read-only** -- do not modify `matchSetup.types.ts` or
    `matchSetup.validate.ts`
11. **Test files use `.test.ts`** -- never `.test.mjs`
12. **`makeMockCtx` must NOT import from `boardgame.io`**

---

## Locked Values (Copy Verbatim -- Do Not Re-derive)

- **MatchSetupConfig fields** (setup reads all 9 to build `G`):
  `schemeId`, `mastermindId`, `villainGroupIds`, `henchmanGroupIds`,
  `heroDeckIds`, `bystandersCount`, `woundsCount`, `officersCount`,
  `sidekicksCount`

- **PlayerZones keys** (all `CardExtId[]`; only `deck` non-empty after setup):
  `deck` | `hand` | `discard` | `inPlay` | `victory`

- **GlobalPiles keys** (sizes from config count fields):
  `bystanders` (← `bystandersCount`) | `wounds` (← `woundsCount`) |
  `officers` (← `officersCount`) | `sidekicks` (← `sidekicksCount`)

- **makeMockCtx().random.Shuffle** reverses arrays -- not identity

---

## Files Expected to Change

- `packages/game-engine/src/setup/shuffle.ts` -- **new** -- `shuffleDeck(cards, ctx)`
- `packages/game-engine/src/test/mockCtx.ts` -- **new** -- shared `makeMockCtx`
  test helper (no boardgame.io imports)
- `packages/game-engine/src/setup/buildInitialGameState.ts` -- **new** -- setup builder
- `packages/game-engine/src/game.ts` -- **modified** -- wire validate + build
- `packages/game-engine/src/types.ts` -- **modified** -- expand `LegendaryGameState`
- `packages/game-engine/src/index.ts` -- **modified** -- export new public types
- `packages/game-engine/src/setup/buildInitialGameState.shape.test.ts` -- **new**
- `packages/game-engine/src/setup/buildInitialGameState.determinism.test.ts` -- **new**

No other files may be modified except:
- `docs/ai/STATUS.md` -- add WP-005B section
- `docs/ai/DECISIONS.md` -- add decisions (ext_id strings in G, makeMockCtx reverse)
- `docs/ai/work-packets/WORK_INDEX.md` -- check off WP-005B

---

## Critical Implementation Notes

### Registry Access at Setup Time

The architecture allows registry access at setup time only. `buildInitialGameState`
receives a `CardRegistry` (or `CardRegistryReader`) as a parameter. After setup
returns, the engine operates solely on `G` and `ctx` -- no further registry access.

The `CardRegistryReader` interface defined in WP-005A
(`{ listCards(): Array<{ key: string }> }`) is sufficient for `validateMatchSetup`.
However, `buildInitialGameState` needs richer registry data (hero cards, mastermind
data, etc.) to build initial decks. You may need to define a broader local interface
or accept the full `CardRegistry` type. If you import from `@legendary-arena/registry`,
use `import type` only to avoid a runtime dependency. Check whether the game-engine
`package.json` needs `@legendary-arena/registry` as a devDependency for type resolution.

### Hero Deck Shape

Heroes are organized as decks (per 00.2 §1.2), not flat card lists. Each hero has
multiple cards with different costs and abilities. Setup builds player starting
decks by collecting the hero deck's card ext_ids into `string[]` arrays.

### FlatCard.key IS the ext_id

The `FlatCard.key` field is the ext_id. Its format varies by cardType:
- hero: `"{setAbbr}-hero-{heroSlug}-{slot}"`
- mastermind: `"{setAbbr}-mastermind-{groupSlug}-{cardSlug}"`
- villain: `"{setAbbr}-villain-{groupSlug}-{cardSlug}"`
- scheme: `"{setAbbr}-scheme-{schemeSlug}"`

### Card Field Data Quality

Hero card `cost`, `attack`, and `recruit` fields are `string | number | undefined`,
not clean integers. Per D-1204, `FlatCard.cost` must remain
`string | number | undefined`. Setup code should handle these types correctly.

### Player Starting Decks

Per the Legendary board game rules, each player starts with a deck of basic
S.H.I.E.L.D. cards (typically 8 S.H.I.E.L.D. Agents and 4 S.H.I.E.L.D. Troopers
for a 12-card starting deck). The exact composition depends on the game's setup
rules. Use ext_id strings for these cards.

### Validation Flow in setup()

`Game.setup()` must:
1. Call `validateMatchSetup(matchData, registry)` first
2. If result is `{ ok: false }`, throw `new Error(result.errors[0].message)`
3. If result is `{ ok: true }`, call `buildInitialGameState(result.value, registry, ctx)`
4. Return the fully populated `G`

This is the ONLY place in the engine where throwing is correct.

---

## Post-WP-005B Hardening Objectives

After the core WP-005B work is complete and all EC items are satisfied,
apply the following hardening objectives. These extend WP-005B's scope to
prepare the engine for gameplay Work Packets.

**Objective:**
Introduce the first playable, deterministic turn mechanics for Legendary Arena
by implementing real (non-stub) engine moves and minimal runtime game state.

WP-005B is the first Work Packet that mutates LegendaryGameState (G) during play.

**Scope:**
- packages/game-engine only
- Gameplay runtime state and moves only
- No setup, server, or registry changes

**Primary Goals:**
1. Extend LegendaryGameState with a minimal, JSON-serializable runtime state
   required to support turn progression.
2. Implement at least one real move (prefer endTurn) that:
   - Mutates G in-place
   - Advances turn / phase using ctx.events
3. Ensure turn order and current player are coherent and deterministic.

**Hard Constraints:**
- Do NOT modify:
  - setup()
  - validateSetupData()
  - minPlayers / maxPlayers
  - MatchSetupConfig or validation logic
- Do NOT import or reference:
  - registry
  - rules
  - server code
  - filesystem, network, or database
- Do NOT introduce randomness, shuffling, or card resolution yet.
- Do NOT add AI, bots, persistence, or UI concerns.

**Engine Invariants:**
- matchConfiguration is read-only and must never be mutated.
- All gameplay behavior must be reproducible from (G, ctx, move args).
- All moves must:
  - Accept FnContext<LegendaryGameState>
  - Return void
  - Produce no side effects outside of G / ctx

**Required Gameplay Semantics:**
- The engine must support:
  - A starting player
  - A current player
  - Advancing to the next player
- Phase progression must be explicit (via ctx.events.setPhase / endTurn).
- No implicit phase transitions are allowed.

**Allowed State Additions (examples, not prescriptions):**
- turnNumber
- roundNumber
- currentPlayerId (if not relying solely on ctx)
- per-turn flags or counters

**Testing Requirements:**
- Add engine-level tests asserting:
  - The new move mutates G predictably
  - Turn / phase progression behaves correctly
  - No mutation of matchConfiguration occurs
- Tests must not mock server or registry.

**Out of Scope for hardening:**
- Card play resolution
- Decks, shuffling, draw piles
- Attack / recruit logic
- Win / loss conditions
- Scheme or mastermind behavior

**Hardening Success Criteria:**
- A game can be created with valid setupData.
- Players can execute at least one real move.
- Turns advance deterministically without errors.
- Engine state remains minimal, explicit, and debuggable.

---

## Current Environment State

- WP-005A committed: `MatchSetupConfig`, `validateMatchSetup`,
  `CardRegistryReader`, `MatchSetupError`, `ValidateMatchSetupResult` all
  exported from game-engine (17 tests passing)
- WP-004 committed: server bootstrap complete, game-engine wired in
- WP-003 committed: registry builds and exports `CardRegistry`
- `MatchConfiguration` is now a type alias for `MatchSetupConfig` (D-1207)
- `pnpm install` is clean

---

## Verification After Execution

Run these in order (from the WP's Verification Steps):

```pwsh
# 1. Build the package
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# 2. Run all tests (WP-005A tests + new tests)
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output -- all tests passing, 0 failing

# 3. Confirm Math.random is not used anywhere
Select-String -Path "packages\game-engine\src" -Pattern "Math.random" -Recurse
# Expected: no output

# 4. Confirm shuffleDeck uses ctx.random.Shuffle
Select-String -Path "packages\game-engine\src\setup\shuffle.ts" -Pattern "ctx.random.Shuffle"
# Expected: at least one match

# 5. Confirm mockCtx does not import boardgame.io
Select-String -Path "packages\game-engine\src\test\mockCtx.ts" -Pattern "boardgame.io"
# Expected: no output

# 6. Confirm test files do not import boardgame.io
Select-String -Path "packages\game-engine\src\setup\buildInitialGameState.shape.test.ts","packages\game-engine\src\setup\buildInitialGameState.determinism.test.ts" -Pattern "boardgame.io"
# Expected: no output

# 7. Confirm WP-005A contract files were not modified
git diff --name-only packages/game-engine/src/matchSetup.types.ts packages/game-engine/src/matchSetup.validate.ts
# Expected: no output

# 8. Confirm no files outside scope were changed
git diff --name-only
# Expected: only files listed in ## Files Expected to Change
```

---

## Post-Execution Updates

- [ ] `docs/ai/STATUS.md` -- add WP-005B section
- [ ] `docs/ai/DECISIONS.md` -- add decisions:
      1. Why player starting decks use ext_id strings rather than full card objects in G
      2. Why makeMockCtx reverses arrays rather than using identity shuffle
- [ ] `docs/ai/work-packets/WORK_INDEX.md` -- mark WP-005B complete with date
