# Session Prompt -- Execute WP-005A (Match Setup Contracts)

**FULL CONTENTS MODE**

You are operating inside the Legendary Arena AI coordination system.

---

## What You Are Doing

Execute WP-005A to define the authoritative match setup contracts for
`@legendary-arena/game-engine`. This is a **contracts-only** packet -- no deck
construction, no shuffling, no `G` changes, no server changes.

After this session, the game engine exports:
- `MatchSetupConfig` -- the canonical 9-field match setup type
- `MatchSetupError` -- `{ field: string; message: string }`
- `ValidateMatchSetupResult` -- discriminated union result type
- `validateMatchSetup(input, registry)` -- structured validation, never throws

---

## Authority Chain (Read in This Order)

Before writing any code, read these files in order:

1. `.claude/CLAUDE.md` -- root coordination, EC-mode rules, governance set
2. `docs/ai/ARCHITECTURE.md` -- Section 2 (Match Lifecycle step 1 and step 3),
   Section 4 (Move Validation Contract -- Game.setup() throwing table)
3. `.claude/rules/game-engine.md` -- game engine enforcement rules
4. `.claude/rules/code-style.md` -- code style enforcement rules
5. `docs/ai/work-packets/WP-005A-match-setup-contracts.md` -- **THE WORK PACKET**
6. `docs/ai/execution-checklists/EC-005A-setup-contracts.checklist.md` --
   **THE EXECUTION CHECKLIST** (every item must be satisfied exactly)
7. `docs/ai/REFERENCE/00.2-data-requirements.md` -- section 8.1 for the exact
   9 field names; sections 1-3 for ext_id conventions
8. `docs/ai/REFERENCE/00.6-code-style.md` -- code style rules

**Then read the actual source files you will modify or reference:**

9. `packages/game-engine/src/types.ts` -- **will be modified** -- contains
   `MatchConfiguration` (WP-002) with the 9 fields and `LegendaryGameState`.
   You must reconcile `MatchConfiguration` with the new `MatchSetupConfig`.
10. `packages/game-engine/src/index.ts` -- **will be modified** -- add exports
11. `packages/game-engine/src/game.ts` -- reference only -- see how
    `MatchConfiguration` is used in `setup()` and `validateSetupData`
12. `packages/registry/src/types/index.ts` -- reference only -- the
    `CardRegistry` interface and `FlatCard` type. Understand what lookup
    methods are available before writing the validator.

---

## Pre-Execution Checks

Before writing a single line, confirm:

- [ ] WP-002 complete: `packages/game-engine/` builds and tests pass (5/5)
- [ ] WP-003 complete: `@legendary-arena/registry` builds and exports
      `CardRegistry`
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0

---

## Execution Rules

1. **One Work Packet per session** -- only WP-005A
2. **Read the full WP and EC** before writing code
3. **EC is the execution contract** -- every checklist item must be satisfied
4. **If the EC and WP conflict, the WP wins**
5. **ESM only** -- `node:` prefix on all built-ins, no `require()`
6. **Code style**: `docs/ai/REFERENCE/00.6-code-style.md` -- all rules apply
7. **Contracts only** -- no deck construction, no shuffling, no `G` changes
8. **Never throw inside `validateMatchSetup`** -- return structured result
9. **Do NOT use or reference `MoveError` or `MoveResult`** -- those are WP-008A
10. **Test files use `.test.ts`** -- never `.test.mjs`

---

## Locked Values (Copy Verbatim -- Do Not Re-derive)

- **MatchSetupConfig fields** (exactly 9, character-for-character):
  `schemeId`, `mastermindId`, `villainGroupIds`, `henchmanGroupIds`,
  `heroDeckIds`, `bystandersCount`, `woundsCount`, `officersCount`,
  `sidekicksCount`

- **MatchSetupError shape** (this packet's error type):
  `{ field: string; message: string }`

- **ValidateMatchSetupResult shape**:
  `{ ok: true; value: MatchSetupConfig } | { ok: false; errors: MatchSetupError[] }`

- **WP-008A MoveError** (must NOT be used here):
  `{ code: string; message: string; path: string }`

---

## Files Expected to Change

- `packages/game-engine/src/matchSetup.types.ts` -- **new** -- canonical
  setup types (`MatchSetupConfig`, `MatchSetupError`, `ValidateMatchSetupResult`)
- `packages/game-engine/src/matchSetup.validate.ts` -- **new** -- validation
  function (`validateMatchSetup`)
- `packages/game-engine/src/types.ts` -- **modified** -- reconcile
  `MatchConfiguration` with `MatchSetupConfig`
- `packages/game-engine/src/index.ts` -- **modified** -- export new public API
- `packages/game-engine/src/matchSetup.contracts.test.ts` -- **new** -- 4 tests

No other files may be modified except:
- `docs/ai/STATUS.md` -- add WP-005A section
- `docs/ai/DECISIONS.md` -- reconciliation decision + error type decision
- `docs/ai/work-packets/WORK_INDEX.md` -- check off WP-005A

---

## Critical Implementation Notes

### Reconciling MatchConfiguration and MatchSetupConfig

`packages/game-engine/src/types.ts` already defines `MatchConfiguration` with
the exact same 9 fields from 00.2 section 8.1. The WP introduces
`MatchSetupConfig` with identical fields. You must decide:

- Are these the same type? (consolidate to one canonical name)
- Are they different concerns? (keep both with clear `// why:` comments)

Whatever you decide, document it in `DECISIONS.md` and ensure `game.ts`
(which uses `MatchConfiguration` in `setup()` and `validateSetupData`) still
compiles.

### Registry Lookup for ext_id Validation

The `CardRegistry` interface does NOT have a `getByExtId()` method.
Available methods:
- `listCards(): FlatCard[]` -- all cards, each with a `key` field
- `query(q: CardQuery): FlatCard[]` -- filter by `cardType`, `setAbbr`, etc.
- `listSets(): SetIndexEntry[]` -- set index entries
- `listHeroes(): Hero[]` -- hero-level (not card-level) entries
- `getSet(abbr: string): SetData | undefined` -- full set data

The `FlatCard.key` field IS the ext_id. Its format varies by cardType:
- hero: `"{setAbbr}-hero-{heroSlug}-{slot}"`
- mastermind: `"{setAbbr}-mastermind-{groupSlug}-{cardSlug}"`
- villain: `"{setAbbr}-villain-{groupSlug}-{cardSlug}"`
- scheme: `"{setAbbr}-scheme-{schemeSlug}"`

The validator needs to check that each ext_id in the config exists as a `key`
in the registry's card list. Consider building a Set of keys from `listCards()`
for O(1) lookups rather than searching the array for each ID.

Note: `schemeId` maps to `cardType: "scheme"`, `mastermindId` to
`cardType: "mastermind"`, `villainGroupIds` and `henchmanGroupIds` to villain
groups (not individual cards), and `heroDeckIds` to heroes (not individual
cards). You'll need to understand how these map to the registry's data model.
Read the `SetData` schema and `FlatCard` definitions carefully.

### Validation Checks (from WP)

`validateMatchSetup(input: unknown, registry: CardRegistry)` checks in order:
1. All 9 fields present and correct type
2. Array fields are non-empty string arrays
3. Count fields are integers >= 0
4. Each ID exists in the registry via ext_id lookup

Returns `{ ok: true, value: config }` on success, never throws.

### Test Setup

Tests use an inline mock registry -- NOT `makeMockCtx` (that is WP-005B).
The mock needs to implement `CardRegistry` interface methods used by the
validator. Keep the mock minimal -- only implement what the validator calls.

---

## Current Environment State

- WP-002 committed: `packages/game-engine/` builds and tests pass (5/5)
- WP-003 committed: `packages/registry/` smoke test passes
- WP-004 committed: server bootstrap complete, game-engine wired in
- `MatchConfiguration` already exists in `src/types.ts` with 9 locked fields
- `LegendaryGame.setup()` and `validateSetupData` reference `MatchConfiguration`
- `pnpm install` is clean

---

## Verification After Execution

Run these in order (from the WP's Verification Steps):

```pwsh
# 1. Build the package
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# 2. Run the contract tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output -- passing (including 4 new contract tests)

# 3. Confirm all 9 MatchSetupConfig field names
Select-String -Path "packages\game-engine\src\matchSetup.types.ts" `
  -Pattern "schemeId|mastermindId|villainGroupIds|henchmanGroupIds|heroDeckIds|bystandersCount|woundsCount|officersCount|sidekicksCount"
# Expected: 9 matches, one per field

# 4. Confirm validateMatchSetup never throws
Select-String -Path "packages\game-engine\src\matchSetup.validate.ts" -Pattern "throw "
# Expected: no output

# 5. Confirm MoveError/MoveResult not referenced
Select-String -Path "packages\game-engine\src\matchSetup.types.ts","packages\game-engine\src\matchSetup.validate.ts" `
  -Pattern "MoveError|MoveResult"
# Expected: no output

# 6. Confirm no files outside scope were changed
git diff --name-only
# Expected: only files under packages/game-engine/src/ and docs/ai/
```

---

## Post-Execution Updates

- [ ] `docs/ai/STATUS.md` -- add WP-005A section
- [ ] `docs/ai/DECISIONS.md` -- add decisions:
      1. How `MatchSetupConfig` relates to `MatchConfiguration` and which is canonical
      2. Why `MatchSetupError` uses `{ field, message }` rather than reusing
         any future `MoveError` shape
- [ ] `docs/ai/work-packets/WORK_INDEX.md` -- mark WP-005A complete with date
