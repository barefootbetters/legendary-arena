# WP-002 — boardgame.io Game Skeleton (Contracts Only)

**Status:** Ready
**Primary Layer:** Game Engine
**Dependencies:** WP-001, Foundation Prompts (01, 02)

---

## Session Context

WP-001 established the repo-as-memory coordination system and locked the
REFERENCE documents that govern all subsequent sessions. Foundation Prompts 01
and 02 bootstrapped the server and database environment. This packet creates
the `packages/game-engine/` package from scratch — the contract all future
game-logic packets build on top of.

---

## Goal

Create the `packages/game-engine` workspace package and define the authoritative
boardgame.io `Game()` skeleton for Legendary Arena — including game phases, turn
structure, the setup payload contract, canonical `G` type definitions, and empty
move stubs — without implementing any game rules or logic.

After this session, `@legendary-arena/game-engine` is importable, compilable,
exports `LegendaryGame` as a valid boardgame.io `0.50.x` `Game()` object, and
has a passing JSON-serializability test. The engine contract all future gameplay
Work Packets must follow is now locked.

---

## Assumes

- WP-001 complete: all REFERENCE docs updated and reviewed
- Foundation Prompt 01 complete: `apps/server/src/server.mjs` exists
- Foundation Prompt 02 complete: `data/migrations/` exists and `pnpm migrate`
  succeeds against the target DB
- `packages/game-engine/` does **not** exist yet — this packet creates it from scratch
- `packages/registry/` exists at `@legendary-arena/registry` (reference for
  workspace package structure conventions — `"type": "module"`, exports map,
  TypeScript setup)
- `data/legendary_library_schema.sql` exists (canonical schema — ground truth
  for table names and field names)
- boardgame.io `0.50.x` is available on npm
- `docs/ai/ARCHITECTURE.md` exists (created in WP-013)
- `docs/ai/DECISIONS.md` may not exist yet — this packet creates it (first entry)
- `docs/ai/STATUS.md` may not exist yet — this packet creates it (first entry)

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Section 1` — the `packages/game-engine` package
  boundary and import rules. The new package must respect these boundaries from
  the start: `game-engine` may NOT import `registry`, `server`, any `apps/*`
  package, or `pg`.
- `docs/ai/ARCHITECTURE.md §Section 4` — "The LegendaryGame Object" and "What
  `G` Is". Documents the boardgame.io `^0.50.0` version lock, the Immer
  mutation model (move functions receive a draft and return void, not a new `G`),
  and the 4 phase names (`lobby`, `setup`, `play`, `end`) scaffolded here.
- `docs/ai/REFERENCE/00.2-data-requirements.md §8.1` — Match Configuration:
  the exact 9 field names for the `MatchConfiguration` type. Every field name
  is locked. Do not rename, abbreviate, or add fields.
- `docs/ai/REFERENCE/00.2-data-requirements.md §4.2` — what belongs in `G`
  vs. what must stay out of it. `G` never contains `imageUrl`, ability text,
  or any display data from R2.
- `docs/ai/REFERENCE/00.1-master-coordination-prompt.md` — non-negotiable
  constraints: boardgame.io rules, ESM-only, `ctx.random.*` requirement, no
  `Math.random()`.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no
  abbreviations), Rule 6 (`// why:` comments), Rule 9 (`node:` prefix), Rule 13
  (ESM only), Rule 14 (field names match data contract).
- `packages/registry/package.json` — reference for workspace package structure
  (`"type": "module"`, exports map, TypeScript setup). Mirror this structure.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — all randomness uses `ctx.random.*` only
- Never throw inside boardgame.io move functions — return void on invalid input
- Never persist `G`, `ctx`, or any runtime state — see ARCHITECTURE.md §Section 3
- `G` must be JSON-serializable at all times — no class instances, Maps, Sets, or functions
- ESM only, Node v22+ — all new files use `import`/`export`, never `require()`
- `node:` prefix on all Node.js built-in imports (`node:test`, `node:assert`, etc.)
- Test files use `.test.ts` extension — never `.test.mjs`
- No database or network access inside move functions or pure helpers
- Full file contents for every new or modified file in the output — no diffs, no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- `MatchConfiguration` field names must match `00.2-data-requirements.md §8.1`
  exactly — do not rename, abbreviate, or reorder any of the 9 fields
- `LegendaryGame` must be the single `Game()` object — all phases, moves, and
  hooks register through it; never create parallel Game instances
- boardgame.io dependency pinned at `^0.50.0` — do not use a different version
- Move stubs return void — do not return a new `G` (Immer model: mutate the
  draft, return void)
- `G` must never contain `imageUrl`, ability text, or display data from R2

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding — never guess or invent field names, type shapes, or file
  paths

**Locked contract values (inline the relevant ones — do not paraphrase or
re-derive from memory; delete rows that do not apply to this packet):**

- **MatchSetupConfig fields** (this packet creates `MatchConfiguration` with
  these exact 9 names — character-for-character):
  `schemeId`, `mastermindId`, `villainGroupIds`, `henchmanGroupIds`,
  `heroDeckIds`, `bystandersCount`, `woundsCount`, `officersCount`,
  `sidekicksCount`

- **Phase names** (this packet scaffolds exactly these 4 boardgame.io phases):
  `'lobby'` | `'setup'` | `'play'` | `'end'`

---

## Scope (In)

### A) Package scaffold
- **`packages/game-engine/package.json`** — new:
  - `"name": "@legendary-arena/game-engine"`, `"type": "module"`
  - `boardgame.io` in `dependencies` at `^0.50.0`
  - Build script, TypeScript peer dep
- **`packages/game-engine/tsconfig.json`** — new: TypeScript configuration
  mirroring `packages/registry/`

### B) `src/types.ts` — new
- `MatchConfiguration` interface — all 9 fields from 00.2 §8.1 with exact
  names: `schemeId`, `mastermindId`, `villainGroupIds`, `henchmanGroupIds`,
  `heroDeckIds`, `bystandersCount`, `woundsCount`, `officersCount`,
  `sidekicksCount`
- `LegendaryGameState` interface — the initial (empty) shape of `G`; fields
  will be added by subsequent packets
- Add `// why:` comment on `MatchConfiguration` explaining why it uses `ext_id`
  string references rather than numeric database IDs

### C) `src/game.ts` — new
- `LegendaryGame` using boardgame.io `Game()`:
  - `setup(ctx, matchData)` — accepts `MatchConfiguration`, returns initial `G`
    typed as `LegendaryGameState`; add `// why:` comment on the setup signature
  - Phases: `lobby`, `setup`, `play`, `end` — scaffolded with no logic; these
    names are locked and match the lifecycle mapping in ARCHITECTURE.md §Section 4
  - Move stubs: `playCard`, `endTurn` — return void, no side effects

### D) `src/index.ts` — new
- Named exports: `LegendaryGame`, `MatchConfiguration`, `LegendaryGameState`

### E) Tests — `src/game.test.ts` — new
- One test: `JSON.stringify(G)` succeeds on the value returned by `setup()`
  with valid mock `MatchConfiguration` data — no throw
- Uses `node:test` and `node:assert` only — no Jest, Vitest, or Mocha
- Does not import from `boardgame.io` directly

---

## Out of Scope

- No card rules, no shuffle logic, no win/loss conditions
- No randomness of any kind — `ctx.random.*` is available but must not be
  called in this packet (no logic to trigger it yet)
- No PostgreSQL access or `getRules()` calls
- No server or client wiring — `apps/server/` is not modified in this packet
- No `packages/registry/` changes
- No UI concerns
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above

---

## Files Expected to Change

- `packages/game-engine/package.json` — **new** — workspace package declaration
- `packages/game-engine/tsconfig.json` — **new** — TypeScript configuration
- `packages/game-engine/src/types.ts` — **new** — `MatchConfiguration` and `LegendaryGameState`
- `packages/game-engine/src/game.ts` — **new** — boardgame.io `Game()` definition
- `packages/game-engine/src/index.ts` — **new** — package named exports
- `packages/game-engine/src/game.test.ts` — **new** — JSON-serializability test

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Package Structure
- [ ] `packages/game-engine/package.json` has `"name": "@legendary-arena/game-engine"`,
      `"type": "module"`, and `boardgame.io` in `dependencies` at `^0.50.0`
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0 with no
      TypeScript errors

### MatchConfiguration
- [ ] `src/types.ts` exports `MatchConfiguration` containing exactly these 9
      fields (names must match character-for-character):
      `schemeId`, `mastermindId`, `villainGroupIds`, `henchmanGroupIds`,
      `heroDeckIds`, `bystandersCount`, `woundsCount`, `officersCount`,
      `sidekicksCount`
      (confirmed with `Select-String`)
- [ ] `MatchConfiguration` has a `// why:` comment explaining `ext_id` string
      references over numeric database IDs

### LegendaryGame
- [ ] `src/game.ts` exports `LegendaryGame` created with boardgame.io `Game()`
- [ ] `LegendaryGame` defines exactly 4 phases with these names:
      `lobby`, `setup`, `play`, `end`
- [ ] `LegendaryGame.setup()` accepts a `MatchConfiguration` argument and
      returns a `LegendaryGameState` object without throwing when passed valid
      mock data
- [ ] All move stubs in `LegendaryGame.moves` return void — no side effects,
      no throws, no returned `G`

### Tests
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] `JSON.stringify(G)` succeeds on the output of `setup()` — confirmed by
      the test in `src/game.test.ts`
- [ ] Test uses `node:test` and `node:assert` only — no Jest, Vitest, or Mocha
- [ ] Test does not import from `boardgame.io` directly

### Scope Enforcement
- [ ] No `require()` appears in any generated file
      (confirmed with `Select-String`)
- [ ] No imports from `apps/server/`, `apps/registry-viewer/`, or any
      database packages appear in any generated file
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — install the new package's dependencies
pnpm install
# Expected: packages resolved, @legendary-arena/game-engine linked,
#           no errors, lockfile updated

# Step 2 — build the package
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors or warnings

# Step 3 — run the JSON-serializability test
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — 1 passing, 0 failing

# Step 4 — confirm MatchConfiguration has all 9 field names
Select-String -Path "packages\game-engine\src\types.ts" -Pattern "schemeId|mastermindId|villainGroupIds|henchmanGroupIds|heroDeckIds|bystandersCount|woundsCount|officersCount|sidekicksCount"
# Expected: 9 matches, one per field

# Step 5 — confirm no require() in any generated file
Select-String -Path "packages\game-engine\src" -Pattern "require(" -Recurse
# Expected: no output

# Step 6 — confirm the package is importable from a consumer
node --input-type=module --eval "
  import { LegendaryGame } from '@legendary-arena/game-engine';
  console.log('phases:', Object.keys(LegendaryGame.phases ?? {}));
  console.log('moves:', Object.keys(LegendaryGame.moves ?? {}));
"
# Expected: phases and moves lists printed without error

# Step 7 — confirm no files outside scope were changed
git diff --name-only
# Expected: only files under packages/game-engine/ are listed
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
- [ ] All 9 `MatchConfiguration` field names verified against 00.2 §8.1 side
      by side — no deviations (confirmed with `Select-String`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` **created** (first entry) — what is now importable
      and what a subsequent session can rely on
- [ ] `docs/ai/DECISIONS.md` **created** (first entry) — at minimum: why
      `MatchConfiguration` uses `ext_id` string references rather than numeric
      database IDs
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-002 checked off with today's date
