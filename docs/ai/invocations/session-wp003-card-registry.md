# Session Prompt — Execute WP-003 (Card Registry Verification & Defect Correction)

**FULL CONTENTS MODE**

You are operating inside the Legendary Arena AI coordination system.

---

## What You Are Doing

Execute WP-003 to fix two confirmed defects in the existing
`packages/registry/` package and add a smoke test. This packet does NOT
create the registry from scratch — it already exists.

**Defect 1:** `httpRegistry.ts` fetches `metadata/card-types.json` (the
37-entry card type taxonomy) instead of `metadata/sets.json` (the set index).
The Zod parse silently produces zero sets because `card-types.json` entries
lack the `abbr` and `releaseDate` fields that `SetIndexEntrySchema` expects.

**Defect 2:** `FlatCard.cost` in `src/types/index.ts` is typed as
`number | undefined` but real card data includes star-cost strings like
`"2*"` (amwp Wasp). The correct type is `string | number | undefined`.

---

## Authority Chain (Read in This Order)

Before writing any code, read these files in order:

1. `.claude/CLAUDE.md` — root coordination, EC-mode rules, governance set
2. `docs/ai/ARCHITECTURE.md` — layer boundaries, registry layer rules,
   metadata file shapes, card field data quality
3. `.claude/rules/registry.md` — registry layer enforcement rules
4. `.claude/rules/code-style.md` — code style enforcement rules
5. `docs/ai/work-packets/WP-003-card-registry.md` — **THE WORK PACKET**
   (authoritative spec for what to fix)
6. `docs/ai/execution-checklists/EC-003-card-registry.checklist.md` —
   **THE EXECUTION CHECKLIST** (every item must be satisfied exactly)
7. `docs/ai/REFERENCE/00.2-data-requirements.md §2.1–§2.2` — `card-types.json`
   shape vs `sets.json` shape (confirms Defect 1)
8. `docs/ai/REFERENCE/00.2-data-requirements.md §2.5` — rarities: confirms
   `cost` can be a string (`"2*"`) (validates Defect 2)
9. `docs/ai/REFERENCE/00.6-code-style.md` — code style rules

**Then read the actual source files you will modify or reference:**

10. `packages/registry/src/impl/httpRegistry.ts` — **contains Defect 1**
11. `packages/registry/src/types/index.ts` — **contains Defect 2**
12. `packages/registry/src/impl/localRegistry.ts` — reference implementation
    (already correct, uses `sets.json` — do NOT modify)
13. `packages/registry/src/schema.ts` — Zod schemas (already correct — do NOT
    modify; read the comments for data quirk context)
14. `packages/registry/src/shared.ts` — shared utilities (do NOT modify)
15. `packages/registry/src/index.ts` — public exports (reference for test imports)
16. `packages/registry/package.json` — check for existing test script

---

## Pre-Execution Checks

Before writing a single line, confirm:

- [ ] WP-002 complete: `packages/game-engine/` builds and tests pass
- [ ] `packages/registry/` exists with `schema.ts`, `localRegistry.ts`,
      `httpRegistry.ts`, `types/index.ts`, `shared.ts`, `index.ts`
- [ ] `data/metadata/sets.json` exists
- [ ] `data/metadata/card-types.json` exists
- [ ] `data/cards/` exists with card JSON files (expect ~40 files)
- [ ] `pnpm install` succeeds

**Note:** `pnpm --filter @legendary-arena/registry build` currently FAILS
with pre-existing TypeScript errors. This is expected — some of those errors
(the `FlatCard.cost` type mismatch in `shared.ts`) are caused by Defect 2.
Do not be alarmed. The WP-003 fixes should resolve the type errors related
to `cost`. Other pre-existing errors (e.g., missing `node:fs/promises` type
declarations, implicit `any` parameters) may exist and are NOT in scope for
this packet — only fix what WP-003 explicitly calls for.

---

## Execution Rules

1. **One Work Packet per session** — only WP-003
2. **Read the full WP and EC** before writing code
3. **EC is the execution contract** — every checklist item must be satisfied
4. **If the EC and WP conflict, the WP wins**
5. **ESM only** — no `require()`, `node:` prefix on all built-ins
6. **Code style**: `docs/ai/REFERENCE/00.6-code-style.md` — all rules apply
7. **Test files use `.test.ts`** — never `.test.mjs`
8. **Immutable files** — do NOT modify `schema.ts`, `shared.ts`, or
   `localRegistry.ts` under any circumstances

---

## Locked Values (Copy Verbatim — Do Not Re-derive)

- **`sets.json` shape** (what `httpRegistry.ts` must fetch):
  `{ id, abbr, pkgId, slug, name, releaseDate, type }`

- **`card-types.json` shape** (must NOT be used as set index):
  `{ id, slug, name, displayName, prefix }`

- **`FlatCard.cost` corrected type**:
  `string | number | undefined` (was incorrectly `number | undefined`)

---

## Files Expected to Change

- `packages/registry/src/impl/httpRegistry.ts` — **modified** — fix
  `card-types.json` → `sets.json` in the set index fetch; add `// why:`
- `packages/registry/src/types/index.ts` — **modified** — widen
  `FlatCard.cost`; fix stale JSDoc references
- `packages/registry/src/registry.smoke.test.ts` — **new** — local registry
  smoke test using `node:test`

No other files may be modified except:
- `docs/ai/STATUS.md` — **update** (add WP-003 section)
- `docs/ai/DECISIONS.md` — **update** (add decisions for sets.json vs
  card-types.json and FlatCard.cost widening)
- `docs/ai/work-packets/WORK_INDEX.md` — **update** (check off WP-003)

---

## Current Environment State

- WP-002 committed: `packages/game-engine/` builds and tests pass (5/5)
- Local PostgreSQL is running with `legendary_arena` database
- All 3 migrations applied (`pnpm migrate` exits 0)
- `packages/registry/` exists with all source files
- `data/metadata/` has `sets.json` (40 sets), `card-types.json` (37 types)
- `data/cards/` has 40 per-set JSON files
- Registry build currently FAILS due to pre-existing TypeScript errors
  (some caused by Defect 2, others pre-existing and out of scope)
- Registry has no `test` script in `package.json` — you will need to add one

---

## Important Notes

- **STATUS.md and DECISIONS.md already exist** — add new sections to the
  existing files rather than creating them from scratch.
- **The WP lists WP-001 as the only dependency** in WORK_INDEX, but the WP
  body says "WP-002 complete" under Assumes. WP-002 is complete as of this
  session, so the dependency is satisfied either way.
- **The registry package has no `test` script** in its `package.json`. You
  will need to add one (e.g., `"test": "node --import tsx --test src/**/*.test.ts"`)
  to run the smoke test via `pnpm --filter @legendary-arena/registry test`.
  Adding this script to `package.json` is an allowed modification since
  it is required to satisfy the verification steps.
- **Pre-existing build errors beyond Defect 2** — the registry has TypeScript
  errors unrelated to WP-003 (missing `node:` type declarations, implicit `any`
  parameters, `exactOptionalPropertyTypes` strictness in `shared.ts`). If fixing
  Defect 2 (`FlatCard.cost` widening) does not resolve all build errors, note
  which errors remain but do NOT fix files outside scope. The WP says
  `schema.ts`, `shared.ts`, and `localRegistry.ts` must not be modified.
  If the build cannot pass without modifying those files, document the
  remaining errors and flag them for a follow-up.
- **Smoke test path resolution** — the test creates a local registry from
  `data/metadata/` and `data/cards/`. Check how `localRegistry.ts` resolves
  these paths (likely relative to CWD or an explicit base path parameter)
  and mirror that in the test.

---

## Verification After Execution

Run these in order (from the WP's Verification Steps):

```pwsh
# 1. Build the package
pnpm --filter @legendary-arena/registry build
# Expected: exits 0 (or document remaining pre-existing errors if any)

# 2. Run the smoke test
pnpm --filter @legendary-arena/registry test
# Expected: TAP output — passing tests, 0 failing

# 3. Confirm card-types.json is NOT a fetch target
Select-String -Path "packages\registry\src\impl\httpRegistry.ts" `
  -Pattern "card-types.json"
# Expected: no output (zero matches as a fetch URL — may appear in comments)

# 4. Confirm sets.json IS the fetch target
Select-String -Path "packages\registry\src\impl\httpRegistry.ts" `
  -Pattern "sets.json"
# Expected: at least one match showing the corrected fetch URL

# 5. Confirm FlatCard.cost type is widened
Select-String -Path "packages\registry\src\types\index.ts" `
  -Pattern "string \| number \| undefined"
# Expected: at least one match on the cost field

# 6. Confirm immutable files were not modified
git diff --name-only packages/registry/src/schema.ts `
  packages/registry/src/shared.ts `
  packages/registry/src/impl/localRegistry.ts
# Expected: no output

# 7. Confirm no files outside scope were changed
git diff --name-only
```

---

## Post-Execution Updates

- [ ] `docs/ai/STATUS.md` — add WP-003 section
- [ ] `docs/ai/DECISIONS.md` — add decisions:
      1. Why `card-types.json` and `sets.json` are different files with
         incompatible shapes (D-1203 or next available ID)
      2. Why `FlatCard.cost` must be `string | number | undefined`
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — mark WP-003 complete with date
