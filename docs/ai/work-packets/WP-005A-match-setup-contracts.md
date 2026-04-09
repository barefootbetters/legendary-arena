# WP-005A — Match Setup Contracts

**Status:** Ready
**Primary Layer:** Game Engine / Contracts
**Dependencies:** WP-002, WP-003

---

## Session Context

WP-002 created `packages/game-engine/` with an initial `MatchConfiguration`
type and `LegendaryGameState` as empty shells. WP-003 fixed the registry so
that `validateMatchSetup` can use it to check ext_id existence. This packet
locks the canonical match setup contract — the 9-field `MatchSetupConfig` type,
its validator, and its result types — that all future setup and gameplay packets
depend on. This packet is contracts only: no deck construction, no shuffling,
no `G` changes.

---

## Goal

Define the authoritative match setup contracts for `@legendary-arena/game-engine`
so that all future setup and gameplay logic is constrained by a single, canonical,
validated shape.

After this session, `@legendary-arena/game-engine` exports:
- `MatchSetupConfig` — the exact 9-field type from 00.2 §8.1
- `MatchSetupError` — the typed error shape `{ field, message }`
- `ValidateMatchSetupResult` — the discriminated union result type
- `validateMatchSetup(input, registry)` — returns a structured result, never
  throws

---

## Assumes

- WP-002 complete:
  - `packages/game-engine/src/types.ts` exports `MatchConfiguration` and
    `LegendaryGameState` (WP-002)
  - `packages/game-engine/src/index.ts` exports `LegendaryGame` (WP-002)
  - `pnpm --filter @legendary-arena/game-engine build` exits 0
- WP-003 complete:
  - `@legendary-arena/registry` builds and exports `createRegistryFromLocalFiles`
    and the `CardRegistry` type (WP-003)
- `docs/ai/DECISIONS.md` exists (created in WP-002)
- `docs/ai/ARCHITECTURE.md` exists (created in WP-013)

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Section 2` — read "Match Lifecycle" step 1 for
  the canonical 9-field `MatchSetupConfig` shape and the note that field names
  are locked. Also read the note in step 3 that `validateMatchSetup` checks
  BOTH shape AND registry ext_id existence — it is not shape-only.
- `docs/ai/ARCHITECTURE.md §Section 4` — read "The Move Validation Contract"
  and specifically the `Game.setup()` throwing table. `validateMatchSetup`
  returns a structured result and never throws; `Game.setup()` is the caller
  that decides to throw if the result is `ok: false`.
- `docs/ai/REFERENCE/00.2-data-requirements.md §8.1` — the exact 9 field names
  for `MatchSetupConfig`. Every field name is locked. Do not rename, abbreviate,
  or add fields.
- `docs/ai/REFERENCE/00.2-data-requirements.md §1–§3` — ID and slug conventions:
  card data uses `ext_id` strings as stable cross-service identifiers. The
  validator checks that each `ext_id` in the config exists in the loaded
  registry.
- `packages/game-engine/src/types.ts` — the existing `MatchConfiguration` type
  from WP-002. `MatchSetupConfig` must align with it; read this file entirely
  before creating new types to avoid duplicates or conflicts.
- `packages/registry/src/types/index.ts` — the `CardRegistry` interface.
  `validateMatchSetup` takes a `CardRegistry` as its second argument; confirm
  the exact method names available for ext_id existence checks before writing
  the implementation.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no
  abbreviations), Rule 6 (`// why:` comments), Rule 9 (`node:` prefix), Rule 11
  (full-sentence error messages), Rule 13 (ESM only), Rule 14 (field names
  match data contract).

---

## Non-Negotiable Constraints

**Applicable engine-wide constraints:**
- Never throw inside `validateMatchSetup` — return a structured result; the
  caller (`Game.setup()`) decides to throw
- `G` must be JSON-serializable at all times — no class instances, Maps, Sets,
  or functions (no `G` changes in this packet, but new types must be
  JSON-serializable)
- ESM only, Node v22+ — all new files use `import`/`export`, never `require()`
- `node:` prefix on all Node.js built-in imports (`node:test`, `node:assert`,
  etc.)
- Test files use `.test.ts` extension — never `.test.mjs`
- No database or network access of any kind
- Full file contents for every new or modified file in the output — no diffs,
  no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- `MatchSetupConfig` field names must match `00.2-data-requirements.md §8.1`
  exactly — do not rename, abbreviate, or reorder any of the 9 fields
- `MatchSetupError` uses `{ field: string; message: string }` — this is NOT
  `MoveError` (which uses `{ code, message, path }` and is defined in WP-008A);
  do not use or reference `MoveError` in this packet
- `ValidateMatchSetupResult` is the result type — this is NOT `MoveResult`
  (which is defined in WP-008A); do not use or reference `MoveResult` here
- `validateMatchSetup` checks BOTH shape AND registry ext_id existence — it is
  not a shape-only validator
- Error messages must be full sentences per 00.6 Rule 11
- No randomness (`Math.random()` or `ctx.random.*`) — this packet is contracts
  only

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding — never guess or invent field names, type shapes, or file
  paths

**Locked contract values (inline the relevant ones — do not paraphrase or
re-derive from memory; delete rows that do not apply to this packet):**

- **MatchSetupConfig fields** (this packet defines `MatchSetupConfig` with
  exactly these 9 names — character-for-character, no others):
  `schemeId`, `mastermindId`, `villainGroupIds`, `henchmanGroupIds`,
  `heroDeckIds`, `bystandersCount`, `woundsCount`, `officersCount`,
  `sidekicksCount`

- **MatchSetupError shape** (this packet's error type — NOT `MoveError`; shown
  side-by-side to prevent confusion):
  This packet: `{ field: string; message: string }`
  WP-008A `MoveError` (must NOT be used here): `{ code: string; message: string; path: string }`

---

## Scope (In)

### A) `src/matchSetup.types.ts` — new
- `MatchSetupConfig` interface — exactly these 9 fields from 00.2 §8.1:
  `schemeId: string`, `mastermindId: string`, `villainGroupIds: string[]`,
  `henchmanGroupIds: string[]`, `heroDeckIds: string[]`,
  `bystandersCount: number`, `woundsCount: number`, `officersCount: number`,
  `sidekicksCount: number`
- `MatchSetupError` — `{ field: string; message: string }`
- `ValidateMatchSetupResult` — discriminated union:
  `{ ok: true; value: MatchSetupConfig } | { ok: false; errors: MatchSetupError[] }`
- Add `// why:` comment on `MatchSetupConfig` explaining why it uses `ext_id`
  string references rather than numeric database IDs

### B) `src/matchSetup.validate.ts` — new
- `validateMatchSetup(input: unknown, registry: CardRegistry): ValidateMatchSetupResult`
- Checks (in order):
  1. All 9 fields present and of correct type
  2. Array fields (`villainGroupIds`, `henchmanGroupIds`, `heroDeckIds`) are
     non-empty string arrays
  3. Count fields (`bystandersCount`, `woundsCount`, `officersCount`,
     `sidekicksCount`) are integers ≥ 0
  4. Each ID (`schemeId`, `mastermindId`, and each entry in the three array
     fields) exists in the registry via ext_id lookup
- Returns `{ ok: true, value: config }` on success
- Returns `{ ok: false, errors: [...] }` on any failure — never throws
- Error messages are full sentences naming the failing field

### C) `src/types.ts` — modified
- Reconcile `MatchConfiguration` (from WP-002) with the new `MatchSetupConfig`
- If they are duplicates, consolidate to one canonical type and document the
  decision in a `// why:` comment
- `LegendaryGameState` remains unchanged

### D) `src/index.ts` — modified
- Add named exports: `MatchSetupConfig`, `MatchSetupError`,
  `ValidateMatchSetupResult`, `validateMatchSetup`

### E) Tests — `src/matchSetup.contracts.test.ts` — new
- Uses `node:test` and `node:assert` only
- Does not import from `boardgame.io`
- Uses an inline mock registry (no `makeMockCtx` — that is WP-005B)
- Four tests:
  1. Valid config + registry containing all referenced IDs → `{ ok: true }`
  2. Missing required field → `{ ok: false }` with correct `field` name
  3. Invalid count (negative, non-integer, or string) → `{ ok: false }`
  4. Unknown ext_id in registry → `{ ok: false }` with the correct `field` name

---

## Out of Scope

- No deterministic shuffling or deck construction — that is WP-005B
- No changes to `Game.setup()` beyond type reference updates — that is WP-005B
- No gameplay rules, moves, or phases
- No PostgreSQL access
- No UI or server changes
- `MoveResult` and `MoveError` — those are defined in WP-008A; do not introduce
  them here
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above

---

## Files Expected to Change

- `packages/game-engine/src/matchSetup.types.ts` — **new** — canonical setup
  types
- `packages/game-engine/src/matchSetup.validate.ts` — **new** — validation
  function
- `packages/game-engine/src/types.ts` — **modified** — reconcile
  `MatchConfiguration` with `MatchSetupConfig`
- `packages/game-engine/src/index.ts` — **modified** — export new public API
- `packages/game-engine/src/matchSetup.contracts.test.ts` — **new** —
  `node:test` coverage

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### MatchSetupConfig
- [ ] `src/matchSetup.types.ts` exports `MatchSetupConfig` with exactly these
      9 fields and no others: `schemeId`, `mastermindId`, `villainGroupIds`,
      `henchmanGroupIds`, `heroDeckIds`, `bystandersCount`, `woundsCount`,
      `officersCount`, `sidekicksCount`
      (confirmed with `Select-String` — 9 matches, one per field)
- [ ] No field in `MatchSetupConfig` is renamed, re-cased, or abbreviated
- [ ] `MatchSetupConfig` has a `// why:` comment on ext_id string references

### validateMatchSetup
- [ ] `src/matchSetup.validate.ts` exports `validateMatchSetup` with signature
      `(input: unknown, registry: CardRegistry): ValidateMatchSetupResult`
- [ ] `validateMatchSetup` with a valid config and a registry containing all
      referenced IDs returns `{ ok: true, value: <config> }`
- [ ] `validateMatchSetup` with a missing `schemeId` returns
      `{ ok: false, errors: [{ field: 'schemeId', message: <full sentence> }] }`
- [ ] `validateMatchSetup` with `bystandersCount: -1` returns
      `{ ok: false, errors: [{ field: 'bystandersCount', ... }] }`
- [ ] `validateMatchSetup` with an unknown ext_id for `mastermindId` returns
      `{ ok: false, errors: [{ field: 'mastermindId', ... }] }`
- [ ] No `throw` statement in `src/matchSetup.validate.ts`
      (confirmed with `Select-String`)

### Error types
- [ ] `MatchSetupError` uses `{ field: string; message: string }` — it does
      not reference or extend `MoveError`
      (confirmed with `Select-String` for `MoveError` in matchSetup files —
      no matches)

### Exports
- [ ] `src/index.ts` exports `MatchSetupConfig`, `MatchSetupError`,
      `ValidateMatchSetupResult`, and `validateMatchSetup` by name

### Build and Tests
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 with 4 passing
      tests in `matchSetup.contracts.test.ts`
- [ ] Test uses `node:test` and `node:assert` only — no Jest, Vitest, or Mocha
- [ ] Test does not import from `boardgame.io`

### Scope Enforcement
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — build the package
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run the contract tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — 4 passing, 0 failing

# Step 3 — confirm all 9 MatchSetupConfig field names are present
Select-String -Path "packages\game-engine\src\matchSetup.types.ts" -Pattern "schemeId|mastermindId|villainGroupIds|henchmanGroupIds|heroDeckIds|bystandersCount|woundsCount|officersCount|sidekicksCount"
# Expected: 9 matches, one per field

# Step 4 — confirm validateMatchSetup never throws
Select-String -Path "packages\game-engine\src\matchSetup.validate.ts" -Pattern "throw "
# Expected: no output

# Step 5 — confirm MoveError is not referenced in setup files
Select-String -Path "packages\game-engine\src\matchSetup.types.ts","packages\game-engine\src\matchSetup.validate.ts" -Pattern "MoveError|MoveResult"
# Expected: no output

# Step 6 — confirm no files outside scope were changed
git diff --name-only
# Expected: only files under packages/game-engine/src/
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
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 with 4 passing
- [ ] All 9 `MatchSetupConfig` field names verified against 00.2 §8.1 side by
      side — no deviations (confirmed with `Select-String`)
- [ ] No `throw` in `src/matchSetup.validate.ts` (confirmed with `Select-String`)
- [ ] No `MoveError` or `MoveResult` in any matchSetup file
      (confirmed with `Select-String`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — what contracts are now available
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: how `MatchSetupConfig`
      relates to the `MatchConfiguration` type from WP-002 and which one is
      canonical; why `MatchSetupError` uses `{ field, message }` rather than
      reusing any future `MoveError` shape
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-005A checked off with today's date
