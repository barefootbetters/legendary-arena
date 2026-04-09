# WP-006A — Player State & Zones Contracts

**Status:** Ready
**Primary Layer:** Game Engine / Contracts
**Dependencies:** WP-005B

---

## Session Context

WP-005B built `buildInitialGameState` and populated `G` with player zones and
global piles using inline types. This packet locks those structures as named,
stable TypeScript interfaces — `PlayerZones`, `PlayerState`, `GlobalPiles`,
`CardExtId` — so every future packet references a canonical shape rather than
an ad hoc one. It also adds runtime validators that confirm structural shape
without importing boardgame.io.

---

## Goal

Lock the canonical TypeScript types for all zone and player state in
`@legendary-arena/game-engine` and add runtime validators that can confirm a
`G` object has the right structure without importing boardgame.io.

After this session, `@legendary-arena/game-engine` exports:
- `CardExtId`, `Zone`, `PlayerZones`, `PlayerState`, `GlobalPiles` — canonical
  zone types
- `ZoneValidationError` — `{ field: string; message: string }` (distinct from
  `MoveError`)
- `validateGameStateShape(G)` — structured result, never throws
- `validatePlayerStateShape(player)` — structured result, never throws

---

## Assumes

- WP-005B complete. Specifically:
  - `packages/game-engine/src/types.ts` exports `LegendaryGameState` with
    `playerZones`, `selection`, `bystanders`, `wounds`, `officers`, `sidekicks`
    (WP-005B)
  - `packages/game-engine/src/setup/buildInitialGameState.ts` exists and
    produces a `G` with per-player zones and global piles (WP-005B)
  - `packages/game-engine/src/matchSetup.types.ts` exports `MatchSetupConfig`
    (WP-005A)
  - `packages/game-engine/src/test/mockCtx.ts` exports `makeMockCtx` (WP-005B)
  - `pnpm --filter @legendary-arena/game-engine build` exits 0
  - `pnpm --filter @legendary-arena/game-engine test` exits 0
- `docs/ai/DECISIONS.md` exists (created in WP-002)
- `docs/ai/ARCHITECTURE.md` exists (created in WP-013)

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Section 2` — read "Zone & Pile Structure" for the
  canonical 5-zone `PlayerZones` and 4-pile `GlobalPiles` layouts. The types
  in this packet must produce exactly those structures. Also read the
  initialization rule: zones other than `deck` start empty; cards enter them
  through moves, not setup.
- `docs/ai/ARCHITECTURE.md §Section 4` — read "The Move Validation Contract"
  for the `ZoneValidationError` exception note. `ZoneValidationError` uses
  `{ field, message }` — distinct from `MoveError { code, message, path }`.
  Do not reuse `MoveError` for zone shape errors.
- `packages/game-engine/src/types.ts` — the existing `LegendaryGameState` type
  from WP-005B. Read it entirely before creating new types — avoid duplicates
  or conflicts.
- `packages/game-engine/src/setup/buildInitialGameState.ts` — the existing
  setup builder from WP-005B. Read it to understand the actual shape of `G`
  it produces before writing validators for that shape.
- `docs/ai/REFERENCE/00.2-data-requirements.md §7.1–§7.2` — deck references
  use stable `ext_id` strings. Zone contents must be `ext_id` strings only —
  no full card objects.
- `docs/ai/REFERENCE/00.2-data-requirements.md §8.1` — the 9 locked
  `MatchSetupConfig` field names. Setup selections embedded in `G` must use
  these exact names.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no
  abbreviations), Rule 6 (`// why:` comments), Rule 9 (`node:` prefix), Rule 11
  (full-sentence error messages), Rule 13 (ESM only), Rule 14 (field names
  match data contract).

---

## Non-Negotiable Constraints

**Applicable engine-wide constraints:**
- `G` must be JSON-serializable at all times — no class instances, Maps, Sets,
  or functions; all new types must satisfy this
- ESM only, Node v22+ — all new files use `import`/`export`, never `require()`
- `node:` prefix on all Node.js built-in imports (`node:test`, `node:assert`,
  etc.)
- Test files use `.test.ts` extension — never `.test.mjs`
- No database or network access of any kind
- Full file contents for every new or modified file in the output — no diffs,
  no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- Zone contents are `CardExtId` strings only — no full card objects in any zone
  or pile type definition
- `ZoneValidationError` uses `{ field: string; message: string }` — this is
  NOT `MoveError` (which uses `{ code, message, path }` and is defined in
  WP-008A); do not use, import, or reference `MoveError` in this packet
- Both validators return structured results — never throw; add a `// why:`
  comment explaining why validators return rather than throw
- `src/state/zones.validate.ts` must not import from `boardgame.io` — it is a
  pure helper that must be independently testable without a boardgame.io instance
- Validators check structural shape only — they do not access the registry or
  validate that ext_ids exist in card data

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding — never guess or invent field names, type shapes, or file
  paths

**Locked contract values (inline the relevant ones — do not paraphrase or
re-derive from memory; delete rows that do not apply to this packet):**

- **PlayerZones keys** (this packet defines `PlayerZones` with exactly these
  5 keys — all `Zone` = `CardExtId[]`; only `deck` is non-empty after setup):
  `deck` | `hand` | `discard` | `inPlay` | `victory`

- **GlobalPiles keys** (this packet defines `GlobalPiles` with exactly these
  4 keys — all `Zone` = `CardExtId[]`):
  `bystanders` | `wounds` | `officers` | `sidekicks`

- **ZoneValidationError shape** (this packet's error type — NOT `MoveError`;
  shown side-by-side to prevent confusion):
  This packet: `{ field: string; message: string }`
  WP-008A `MoveError` (must NOT be used here): `{ code: string; message: string; path: string }`

---

## Scope (In)

### A) `src/state/zones.types.ts` — new
- `type CardExtId = string` — stable `ext_id` reference (not a slug or name)
- `type Zone = CardExtId[]`
- `interface PlayerZones { deck: Zone; hand: Zone; discard: Zone; inPlay: Zone; victory: Zone }`
- `interface PlayerState { playerId: string; zones: PlayerZones }`
- `interface GlobalPiles { bystanders: Zone; wounds: Zone; officers: Zone; sidekicks: Zone }`
- `type ZoneValidationError = { field: string; message: string }`
- `interface GameStateShape` — minimum shape `validateGameStateShape` checks
- Add `// why:` comments explaining why zones use `ext_id` strings rather than
  full card objects (keeps `G` small and JSON-serializable)

### B) `src/state/zones.validate.ts` — new
- `validateGameStateShape(input: unknown): { ok: true } | { ok: false; errors: ZoneValidationError[] }`
- `validatePlayerStateShape(input: unknown): { ok: true } | { ok: false; errors: ZoneValidationError[] }`
- Validators check structural shape only — no registry lookups
- Return structured results — never throw
- No import from `boardgame.io`

### C) `src/types.ts` — modified
- Align `LegendaryGameState` to use the new canonical types from `zones.types.ts`
- If `playerZones` and any inline zone types are duplicated, consolidate to use
  `PlayerZones` and `GlobalPiles`
- Document the consolidation decision in a `// why:` comment

### D) `src/index.ts` — modified
- Add named exports: `CardExtId`, `Zone`, `PlayerZones`, `PlayerState`,
  `GlobalPiles`, `ZoneValidationError`, `validateGameStateShape`,
  `validatePlayerStateShape`

### E) Tests — `src/state/zones.shape.test.ts` — new
- Uses `node:test` and `node:assert` only — no Jest, Vitest, or Mocha
- Does not import from `boardgame.io`
- Four tests:
  1. A minimal valid `G`-shaped object passes `validateGameStateShape`
  2. A minimal valid player object passes `validatePlayerStateShape`
  3. An object missing the players/playerZones key returns `{ ok: false }`
  4. A zone containing a non-string value returns `{ ok: false }`

---

## Out of Scope

- No gameplay moves (play card, recruit, fight, end turn)
- No win/loss logic
- No city or HQ logic
- No persistence or PostgreSQL access
- No registry lookups in the validators — shape validation only
- No shuffling or randomness changes
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above

---

## Files Expected to Change

- `packages/game-engine/src/state/zones.types.ts` — **new** — canonical zone
  and player state types
- `packages/game-engine/src/state/zones.validate.ts` — **new** — runtime shape
  validators
- `packages/game-engine/src/types.ts` — **modified** — align
  `LegendaryGameState` to canonical types
- `packages/game-engine/src/index.ts` — **modified** — export new public
  contracts
- `packages/game-engine/src/state/zones.shape.test.ts` — **new** — `node:test`
  coverage

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Canonical Zone Types
- [ ] `src/state/zones.types.ts` exports `CardExtId`, `Zone`, `PlayerZones`,
      `PlayerState`, `GlobalPiles`, `ZoneValidationError`, and `GameStateShape`
- [ ] `PlayerZones` has exactly 5 zone keys:
      `deck`, `hand`, `discard`, `inPlay`, `victory` — all typed as `Zone`
- [ ] `GlobalPiles` has exactly 4 pile keys:
      `bystanders`, `wounds`, `officers`, `sidekicks` — all typed as `Zone`
- [ ] No card object fields (`imageUrl`, `slug`, `name`) appear in any zone
      type definition (confirmed with `Select-String`)

### Alignment With WP-005B Output
- [ ] `LegendaryGameState` in `src/types.ts` uses `PlayerZones` and
      `GlobalPiles` from `src/state/zones.types.ts` — no duplicate zone type
      definitions exist
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0 after
      consolidation

### Validators
- [ ] `validateGameStateShape` exported from `src/state/zones.validate.ts`
      with signature
      `(input: unknown): { ok: true } | { ok: false; errors: ZoneValidationError[] }`
- [ ] `validatePlayerStateShape` exported with the same result contract
- [ ] Neither validator contains a `throw` statement
      (confirmed with `Select-String`)
- [ ] `src/state/zones.validate.ts` contains no import from `boardgame.io`
      (confirmed with `Select-String`)
- [ ] `MoveError` is not referenced in `zones.types.ts` or `zones.validate.ts`
      (confirmed with `Select-String`)

### Tests
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] Shape test has 4 tests (2 passing, 2 `{ ok: false }` cases)
- [ ] Test file does not import from `boardgame.io`
      (confirmed with `Select-String`)
- [ ] Test uses `node:test` and `node:assert` only

### Scope Enforcement
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — build after type alignment
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests including new shape tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm validators do not throw
Select-String -Path "packages\game-engine\src\state\zones.validate.ts" -Pattern "throw "
# Expected: no output

# Step 4 — confirm zones.validate.ts does not import boardgame.io
Select-String -Path "packages\game-engine\src\state\zones.validate.ts" -Pattern "boardgame.io"
# Expected: no output

# Step 5 — confirm MoveError not referenced in zone files
Select-String -Path "packages\game-engine\src\state\zones.types.ts","packages\game-engine\src\state\zones.validate.ts" -Pattern "MoveError"
# Expected: no output

# Step 6 — confirm no card object fields in zone type definitions
Select-String -Path "packages\game-engine\src\state\zones.types.ts" -Pattern "imageUrl|cardName|slug"
# Expected: no output

# Step 7 — confirm no files outside scope were changed
git diff --name-only
# Expected: only files listed in ## Files Expected to Change
```

---

## Definition of Done

> Claude Code must execute every verification command in `## Verification Steps`
> before checking any item below. Reading the code is not sufficient — run the
> commands.
>
> Every item must be true before this packet is considered complete.

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria above pass
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] No `throw` in `zones.validate.ts` (confirmed with `Select-String`)
- [ ] No `boardgame.io` import in `zones.validate.ts`
      (confirmed with `Select-String`)
- [ ] No `MoveError` in any zone file (confirmed with `Select-String`)
- [ ] No card object fields in `zones.types.ts` (confirmed with `Select-String`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — what zone contracts are now exported
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why zones use `ext_id`
      strings rather than full card objects; why `ZoneValidationError` uses
      `{ field, message }` rather than reusing the future `MoveError` shape;
      how `LegendaryGameState` was consolidated after WP-005B and WP-006A types
      were reconciled
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-006A checked off with today's date
