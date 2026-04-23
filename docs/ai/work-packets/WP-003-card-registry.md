# WP-003 — Card Registry Verification & Defect Correction

**Status:** Complete
**Primary Layer:** Data / Registry
**Dependencies:** WP-001, WP-002

---

## Session Context

WP-001 established the coordination system and locked the REFERENCE documents.
WP-002 created `packages/game-engine/` and established that
`@legendary-arena/registry` is a required dependency. This packet does NOT
create the registry from scratch — `packages/registry/` already exists. It
fixes two confirmed defects that would cause silent failures in WP-004 and
beyond, and adds the only smoke test for the registry package.

---

## Goal

Fix two confirmed defects in the existing `packages/registry/` implementation
and add a smoke test so WP-004 can safely consume the registry:

1. **`httpRegistry.ts` fetches the wrong file** — it fetches
   `metadata/card-types.json` (the 37-entry card type taxonomy) instead of
   `metadata/sets.json` (the set index). The Zod parse silently produces zero
   sets because `card-types.json` entries have `{ id, slug, name, displayName,
   prefix }` — none of which match `SetIndexEntrySchema`'s required
   `{ abbr, releaseDate }` fields.
2. **`FlatCard.cost` type is too narrow** — typed as `number | undefined` but
   the schema allows `string | number | undefined` (amwp Wasp has `"2*"`
   star-cost cards).

After this session: both defects are fixed, stale JSDoc comments are corrected,
and a smoke test confirms the local registry loads at least one set and one card
without parse errors.

---

## Assumes

- WP-001 complete: all REFERENCE docs updated and reviewed
- WP-002 complete: `packages/game-engine/` builds and tests pass
- `packages/registry/` exists with the following files already present:
  - `src/schema.ts` — Zod schemas for all card types
  - `src/types/index.ts` — TypeScript types inferred from schemas
  - `src/shared.ts` — `flattenSet()`, `applyQuery()`, `buildHealthReport()`
  - `src/impl/localRegistry.ts` — local file loader
  - `src/impl/httpRegistry.ts` — R2/HTTP loader (**contains Defect 1**)
  - `src/index.ts` — public exports
- `data/metadata/` exists with `sets.json`, `card-types.json`, and other
  metadata files
- `data/cards/` exists with at least one per-set JSON file (e.g., `mdns.json`)
- `packages/registry/package.json` has `zod` in `dependencies`
- `pnpm install` has been run
- `docs/ai/ARCHITECTURE.md` exists (created in WP-013)
- `docs/ai/DECISIONS.md` exists (created in WP-002)

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before making any change:

- `docs/ai/ARCHITECTURE.md §Section 2` — read "Registry Metadata File Shapes".
  Documents the canonical shapes of `sets.json` vs `card-types.json`, why their
  shapes are incompatible, and why the wrong fetch produces zero sets silently.
  Also read "Card Field Data Quality" — confirms `cost`, `attack`, and `recruit`
  are `string | number | undefined` in real card data.
- `docs/ai/ARCHITECTURE.md §Section 1` — the `packages/registry` import rules.
  The registry must NOT import `game-engine`, `server`, any `apps/*` package,
  or `pg`.
- `docs/ai/REFERENCE/00.2-data-requirements.md §2.1` — the `card-types.json`
  shape (`{ id, slug, name, displayName, prefix }`). Confirms it is NOT a set
  index and confirms Defect 1.
- `docs/ai/REFERENCE/00.2-data-requirements.md §2.2` — the `sets.json` shape
  (`{ id, abbr, pkgId, slug, name, releaseDate, type }`). This is what
  `SetIndexEntrySchema` expects.
- `docs/ai/REFERENCE/00.2-data-requirements.md §2.5` — rarities: confirms
  `cost` can be a string (`"2*"`), validating the Defect 2 fix.
- `packages/registry/src/schema.ts` — the actual Zod schemas. Read the
  comments — they document real data quirks (nullable fields, optional fields,
  star-cost cards) that drove schema permissiveness decisions. This file is
  correct as-is and must not be modified.
- `packages/registry/src/impl/localRegistry.ts` — the working implementation.
  The fix in `httpRegistry.ts` must match this file's corrected logic exactly.
  This file is correct as-is and must not be modified.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no
  abbreviations), Rule 6 (`// why:` comments), Rule 9 (`node:` prefix), Rule 14
  (field names match data contract).

---

## Non-Negotiable Constraints

**Applicable engine-wide constraints:**
- ESM only, Node v22+ — all files use `import`/`export`, never `require()`
- `node:` prefix on all Node.js built-in imports (`node:test`, `node:assert`,
  etc.)
- Test files use `.test.ts` extension — never `.test.mjs`
- No database or network access in the smoke test — local files only
- Full file contents for every new or modified file in the output — no diffs,
  no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- `src/schema.ts` must not be modified — the Zod schemas are correct as-is
- `src/shared.ts` must not be modified — the shared utilities are correct as-is
- `src/impl/localRegistry.ts` must not be modified — it already uses `sets.json`
- The `httpRegistry.ts` fix must add a `// why:` comment distinguishing
  `sets.json` (set index) from `card-types.json` (card type taxonomy)
- `FlatCard.cost` must be widened to `string | number | undefined` — never
  narrowed back to `number | undefined`
- No imports from `game-engine`, `server`, any `apps/*` package, or `pg` in
  any modified or new file

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding — never guess or invent field names, type shapes, or file
  paths

**Locked contract values (inline the relevant ones — do not paraphrase or
re-derive from memory; delete rows that do not apply to this packet):**

- **`sets.json` shape** (Defect 1 fix target — this is what `httpRegistry.ts`
  must fetch to enumerate sets):
  `{ id: string, abbr: string, pkgId: string, slug: string, name: string, releaseDate: string, type: string }`

- **`card-types.json` shape** (must NOT be used as the set index — fetching
  this file where `sets.json` is expected silently produces zero sets):
  `{ id: string, slug: string, name: string, displayName: string, prefix: string }`

- **`FlatCard.cost` corrected type** (Defect 2 fix — star-cost strings like
  `"2*"` exist in real card data):
  `string | number | undefined`  (was incorrectly `number | undefined`)

---

## Scope (In)

### A) Fix `src/impl/httpRegistry.ts`
- Change `metadata/card-types.json` to `metadata/sets.json` in the set index
  fetch
- Add a `// why:` comment at the fetch site explaining: `sets.json` is the set
  index (`{ id, abbr, pkgId, slug, name, releaseDate, type }`); `card-types.json`
  is the card type taxonomy (`{ id, slug, name, displayName, prefix }`) — they
  are incompatible shapes; fetching the wrong file produces zero sets silently
  because no entries match `SetIndexEntrySchema`

### B) Fix `src/types/index.ts`
- Change `FlatCard.cost` from `number | undefined` to `string | number | undefined`
  to match `HeroCardSchema.cost`
- Fix the `listSets()` JSDoc — it currently says "from card-types.json"; correct
  it to reference `sets.json`
- Fix any other stale JSDoc references to `card-types.json` that should be
  `sets.json`

### C) Add `src/registry.smoke.test.ts` — new
- Uses `node:test` and `node:assert` only — no Jest or Vitest
- Creates a local registry from `data/metadata/` and `data/cards/`
- Three assertions:
  1. `registry.listSets().length > 0` — at least one set loaded
  2. `registry.listCards().length > 0` — at least one card loaded
  3. `registry.validate().errors` is empty or contains only known non-blocking
     warnings (permissiveness issues, not load failures)
- Does not import from `game-engine`, `server`, or any database package

---

## Out of Scope

- No new registry features or API surface changes
- No changes to `src/schema.ts` — the Zod schemas are correct as-is
- No changes to `src/shared.ts` — the shared utilities are correct as-is
- No changes to `src/impl/localRegistry.ts` — it already uses `sets.json`
- No R2/HTTP integration testing — the smoke test uses local files only
- No caching, memoization, or search index changes
- No changes to `apps/registry-viewer/` or any other package
- No PostgreSQL access
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above

---

## Files Expected to Change

- `packages/registry/src/impl/httpRegistry.ts` — **modified** — fix
  `card-types.json` → `sets.json` in the set index fetch; add `// why:` comment
- `packages/registry/src/types/index.ts` — **modified** — fix `FlatCard.cost`
  type; fix stale `card-types.json` JSDoc references
- `packages/registry/src/registry.smoke.test.ts` — **new** — local registry
  smoke test using `node:test`

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Defect 1 — httpRegistry.ts fetch URL
- [ ] `src/impl/httpRegistry.ts` fetches `${base}/metadata/sets.json` — no
      occurrence of `card-types.json` as a fetch target remains
      (confirmed with `Select-String`)
- [ ] The corrected fetch has a `// why:` comment distinguishing `sets.json`
      from `card-types.json` and explaining the silent failure mode

### Defect 2 — FlatCard.cost type
- [ ] `FlatCard.cost` in `src/types/index.ts` is typed as
      `string | number | undefined` — not `number | undefined`
- [ ] `CardRegistry.listSets()` JSDoc in `src/types/index.ts` no longer
      references `card-types.json`

### Smoke Test
- [ ] `src/registry.smoke.test.ts` confirms `registry.listSets().length > 0`
- [ ] `src/registry.smoke.test.ts` confirms `registry.listCards().length > 0`
- [ ] Test uses `node:test` and `node:assert` only
- [ ] Test does not import from `game-engine`, `server`, or any database package

### Build and Tests
- [ ] `pnpm --filter @legendary-arena/registry build` exits 0 with no
      TypeScript errors
- [ ] `pnpm --filter @legendary-arena/registry test` exits 0

### Scope Enforcement
- [ ] `src/schema.ts` was not modified (confirmed with `git diff --name-only`)
- [ ] `src/shared.ts` was not modified (confirmed with `git diff --name-only`)
- [ ] `src/impl/localRegistry.ts` was not modified
      (confirmed with `git diff --name-only`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — build the package
pnpm --filter @legendary-arena/registry build
# Expected: exits 0, no TypeScript errors

# Step 2 — run the smoke test
pnpm --filter @legendary-arena/registry test
# Expected: TAP output — 3 passing, 0 failing

# Step 3 — confirm the bug fix: card-types.json must not be a fetch target
Select-String -Path "packages\registry\src\impl\httpRegistry.ts" -Pattern "card-types.json"
# Expected: no output (zero matches)

# Step 4 — confirm sets.json is now the fetch target
Select-String -Path "packages\registry\src\impl\httpRegistry.ts" -Pattern "sets.json"
# Expected: at least one match showing the corrected fetch URL

# Step 5 — confirm FlatCard.cost type is widened
Select-String -Path "packages\registry\src\types\index.ts" -Pattern "string \| number \| undefined"
# Expected: at least one match on the cost field

# Step 6 — confirm immutable files were not modified
git diff --name-only packages/registry/src/schema.ts packages/registry/src/shared.ts packages/registry/src/impl/localRegistry.ts
# Expected: no output (these three files must be untouched)

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
- [ ] `pnpm --filter @legendary-arena/registry build` exits 0
- [ ] `pnpm --filter @legendary-arena/registry test` exits 0
- [ ] `httpRegistry.ts` has zero occurrences of `card-types.json` as a fetch
      target (confirmed with `Select-String`)
- [ ] `FlatCard.cost` is `string | number | undefined` in `types/index.ts`
- [ ] `src/schema.ts`, `src/shared.ts`, and `src/impl/localRegistry.ts` were
      not modified (confirmed with `git diff --name-only`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — what was fixed; what is now confirmed
      working in the registry
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why `card-types.json` and
      `sets.json` are different files with incompatible shapes; why `FlatCard.cost`
      must be `string | number | undefined`
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-003 checked off with today's date
