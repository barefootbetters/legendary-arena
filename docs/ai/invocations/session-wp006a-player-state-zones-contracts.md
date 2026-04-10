# Session Prompt — Execute WP-006A (Player State & Zones Contracts)

**FULL CONTENTS MODE**

You are operating inside the Legendary Arena AI coordination system.

---

## What You Are Doing

Execute **WP-006A** to lock canonical **zone and player state contracts** and
introduce **runtime shape validators** for the game engine.

This Work Packet is about **structure, not gameplay**.

After this session, `@legendary-arena/game-engine` must have:

- Canonical zone and player state types in `src/state/zones.types.ts`
- Pure, non-throwing **shape validators** in `src/state/zones.validate.ts`
- Tests that pin structural invariants and prevent silent state corruption
- `src/types.ts` consolidated to re-export canonical zone types (no duplication)

---

## Authority Chain (Read in This Order)

Before writing any code, read these files **in order**:

1. `.claude/CLAUDE.md` — root coordination, EC-mode rules, governance set
2. `docs/ai/ARCHITECTURE.md`
   - Section 2: Zone & Pile Structure, initialization rule
   - Section 4: Move Validation Contract (ZoneValidationError note)
3. `.claude/rules/game-engine.md` — engine layer enforcement rules
4. `.claude/rules/code-style.md` — code style enforcement rules
5. `docs/ai/work-packets/WP-006A-player-state-zones-contracts.md` —
   **THE WORK PACKET**

Then read these **reference files**:

6. `packages/game-engine/src/types.ts` — **will be modified**
   (currently defines PlayerZones, GlobalPiles, CardExtId, MatchSelection,
   SetupContext, LegendaryGameState)
7. `packages/game-engine/src/index.ts` — **will be modified** (exports)
8. `packages/game-engine/src/setup/buildInitialGameState.ts` — reference only
   (authoritative shape of G, uses `G.piles: GlobalPiles`)
9. `packages/game-engine/src/matchSetup.types.ts` — reference only
   (MatchSetupConfig field names)

---

## Critical Context: Actual Post-WP-005B State

WP-006A was authored before WP-005B. Some assumptions in the WP text are stale.
Use the **actual** state described below.

### Types already present (from WP-005B)

- `CardExtId = string`
- `SetupContext` (with `ctx.numPlayers`, `random.Shuffle`)
- `PlayerZones` — `deck | hand | discard | inPlay | victory`
- `GlobalPiles` — `bystanders | wounds | officers | sidekicks`
- `MatchSelection` — readonly scheme/mastermind/group/hero IDs
- `LegendaryGameState` — `{ matchConfiguration, selection, playerZones, piles }`

### G structure uses `G.piles`

Validators must check:

```ts
G.piles: GlobalPiles
```

NOT flat top-level pile keys.

### Types WP-006A must add

- `Zone = CardExtId[]`
- `PlayerState = { playerId: string; zones: PlayerZones }`
- `ZoneValidationError = { field: string; message: string }`
- `GameStateShape` (minimal interface for validators)

---

## What WP-006A Must Do

1. Create `src/state/zones.types.ts` — **canonical zone contracts**
2. Move `CardExtId`, `PlayerZones`, `GlobalPiles` from `types.ts` to
   `zones.types.ts` and re-export them from `types.ts`
3. Add `Zone`, `PlayerState`, `ZoneValidationError`, `GameStateShape`
4. Create `src/state/zones.validate.ts` with **pure shape validators**
5. Create `src/state/zones.shape.test.ts` with **4 structural tests**
6. Update `src/index.ts` with new exports
7. Ensure **all existing tests still pass**

---

## Execution Rules (Strict)

1. **One Work Packet per session** — WP-006A only
2. **Read the full WP** before writing code
3. **ESM only** — `node:` prefix for all built-ins
4. **Code style**: `docs/ai/REFERENCE/00.6-code-style.md`
5. **No `.reduce()`** in validators — use `for...of`
6. **WP-005B files are reference-only**
   Do NOT modify:
   - `matchSetup.types.ts`
   - `matchSetup.validate.ts`
   - `buildInitialGameState.ts`
   - `shuffle.ts`
   - `mockCtx.ts`
7. **Test files use `.test.ts` only**
8. **Validators never throw** — structured results only
9. **No boardgame.io imports** in `zones.types.ts` or `zones.validate.ts`
10. **ZoneValidationError is NOT MoveError**
11. **Validators are diagnostic only**
    - Do NOT mutate input
    - Do NOT normalize or repair state
12. **Validators validate shape ONLY**
    - Do NOT inspect card identity, prefixes, or semantics
    - Do NOT apply gameplay rules or counts
13. **No cross-field or relational validation**
    - Do NOT assert cards appear in only one zone
    - Do NOT balance totals across zones
14. **GameStateShape is intentionally MINIMAL**
    - Do NOT mirror LegendaryGameState fully
    - Include only fields required for zone validation

---

## Locked Values (Copy Verbatim)

### PlayerZones keys (`Zone = CardExtId[]`)

- `deck`
- `hand`
- `discard`
- `inPlay`
- `victory`

### GlobalPiles keys (`Zone = CardExtId[]`)

- `bystanders`
- `wounds`
- `officers`
- `sidekicks`

### ZoneValidationError shape

```ts
{ field: string; message: string }
```

---

## Files Expected to Change

- `packages/game-engine/src/state/zones.types.ts` — **new**
- `packages/game-engine/src/state/zones.validate.ts` — **new**
- `packages/game-engine/src/state/zones.shape.test.ts` — **new**
- `packages/game-engine/src/types.ts` — **modified** (re-exports only)
- `packages/game-engine/src/index.ts` — **modified** (exports)

Optional documentation updates:

- `docs/ai/STATUS.md`
- `docs/ai/DECISIONS.md`
- `docs/ai/work-packets/WORK_INDEX.md`

No other files may be modified.

---

## Verification After Execution

Run these **in order**:

```pwsh
pnpm --filter @legendary-arena/game-engine build
pnpm --filter @legendary-arena/game-engine test
```

Confirm constraints:

```pwsh
# Validators do not throw
Select-String -Path "packages\game-engine\src\state\zones.validate.ts" -Pattern "throw "

# No boardgame.io imports
Select-String -Path "packages\game-engine\src\state\zones.validate.ts" -Pattern "boardgame.io"

# No MoveError references
Select-String -Path "packages\game-engine\src\state\zones.types.ts","packages\game-engine\src\state\zones.validate.ts" -Pattern "MoveError"

# No card object fields in zone types
Select-String -Path "packages\game-engine\src\state\zones.types.ts" -Pattern "imageUrl|cardName|slug"
```

---

## Post-Execution Updates

- [ ] `docs/ai/STATUS.md` — add WP-006A section
- [ ] `docs/ai/DECISIONS.md` — add decisions:
      1. Why zones use `ext_id` strings instead of card objects
      2. Why ZoneValidationError is `{ field, message }` not MoveError
      3. How zone contracts were canonicalized post-WP-005B
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — mark WP-006A complete

---

### Intent Summary (For Claude)

This packet **locks structure, not rules**.
If a check feels like gameplay, it does **not** belong here.
