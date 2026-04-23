# WP-033 — Content Authoring Toolkit

**Status:** Complete  
**Primary Layer:** Content Creation / Validation / Tooling  
**Dependencies:** WP-031

---

## Session Context

WP-031 introduced engine invariant checks ensuring structural integrity.
WP-021 through WP-026 established data-only contracts for hero abilities,
keywords, scheme setup instructions, and board keywords — all following the
representation-before-execution pattern (D-0603). This packet provides the
tooling layer that allows designers to create and validate new content (heroes,
villains, schemes, masterminds, scenarios) without modifying engine logic.
Content errors are caught before the engine ever sees the data. This
implements D-0601 (Content Is Data, Not Code) and D-0602 (Invalid Content
Cannot Reach Runtime).

---

## Goal

Provide a safe, deterministic content authoring toolkit. After this session:

- Author-facing JSON schemas exist for all content types (heroes, villains,
  henchmen, masterminds, schemes, scenarios)
- A content validation pipeline checks structural shape, field ranges, enum
  validity, cross-reference integrity, and keyword/hook consistency
- Validation produces structured results (pass/fail with full-sentence error
  messages) — never throws
- Invalid content is rejected before it can enter the engine
- Schemas are pure JSON schema definitions — no runtime code in schemas
- The toolkit is deterministic and reproducible

---

## Assumes

- WP-031 complete. Specifically:
  - Engine invariant checks exist (WP-031) — content validation catches
    errors before invariant checks would
  - `packages/game-engine/src/rules/heroAbility.types.ts` exports
    `HeroAbilityHook` (WP-021)
  - `packages/game-engine/src/rules/heroKeywords.ts` exports `HeroKeyword`,
    `HERO_KEYWORDS` (WP-021)
  - `packages/game-engine/src/board/boardKeywords.types.ts` exports
    `BoardKeyword`, `BOARD_KEYWORDS` (WP-025)
  - `packages/game-engine/src/scheme/schemeSetup.types.ts` exports
    `SchemeSetupInstruction` (WP-026)
  - `packages/game-engine/src/campaign/campaign.types.ts` exports
    `ScenarioDefinition` (WP-030)
  - `packages/registry/src/schema.ts` exists with Zod schemas (WP-003)
  - `pnpm --filter @legendary-arena/game-engine build` exits 0
  - `pnpm --filter @legendary-arena/game-engine test` exits 0
- `docs/ai/ARCHITECTURE.md` exists with "MVP Gameplay Invariants"
- `docs/ai/DECISIONS.md` exists with D-0601, D-0602, D-0603

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md — "MVP Gameplay Invariants"` — read "Registry &
  Runtime Boundary". Content is loaded and validated at registry/setup time.
  The engine receives only validated, structured data.
- `docs/ai/ARCHITECTURE.md — "Layer Boundary (Authoritative)"` — the registry
  layer loads and validates card data. Content validation extends this with
  author-facing schema checks. The engine never validates raw content — it
  receives pre-validated data.
- `docs/ai/DECISIONS.md` — read D-0601 (Content Is Data, Not Code), D-0602
  (Invalid Content Cannot Reach Runtime), D-0603 (Representation Before
  Execution). These govern this packet.
- `packages/registry/src/schema.ts` — read existing Zod schemas. Content
  validation extends these with author-facing checks for game-mechanical
  fields (keywords, hooks, setup instructions) that the registry schemas
  don't cover.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no
  abbreviations), Rule 6 (`// why:` on validation stages), Rule 8 (no
  `.reduce()`), Rule 11 (full-sentence validation error messages), Rule 13
  (ESM only).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — content validation involves no randomness
- ESM only, Node v22+ — all new files use `import`/`export`, never `require()`
- `node:` prefix on all Node.js built-in imports (`node:test`, `node:assert`,
  etc.)
- Test files use `.test.ts` extension — never `.test.mjs`
- No database or network access in validation logic
- Full file contents for every new or modified file in the output — no diffs,
  no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- Schemas are **pure JSON schema definitions** — no runtime code, no functions,
  no closures in schema definitions
- Validation produces **structured results** — `{ valid: true }` or
  `{ valid: false; errors: ContentValidationError[] }` — never throws
- Validation error messages are **full sentences** identifying what failed,
  which content item, and what to fix (Rule 11)
- Content validation is a **pre-engine gate** — it runs before the engine
  sees the data. Invalid content never reaches `Game.setup()`.
- Validation checks both **structural** (field presence, types, ranges) and
  **semantic** (keyword existence in canonical unions, cross-reference integrity)
- No runtime code in schemas — schemas define shapes; validators execute checks
- No `.reduce()` in validation logic — use `for...of`
- No modifications to `packages/registry/src/schema.ts` — content validation
  extends existing schemas, does not replace them
- Tests use plain mocks — no `boardgame.io` imports

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding

**Locked contract values:**

- **Content types requiring schemas:**
  Hero cards, Villains, Henchmen, Masterminds (+ tactics), Schemes (+ setup
  instructions), Scenarios (from WP-030)

- **ContentValidationResult shape:**
  ```ts
  type ContentValidationResult =
    | { valid: true }
    | { valid: false; errors: ContentValidationError[] }

  interface ContentValidationError {
    contentType: string
    contentId: string
    field: string
    message: string
  }
  ```

- **ContentValidationContext shape:**
  ```ts
  interface ContentValidationContext {
    readonly validVillainGroupSlugs?: ReadonlySet<string>
    readonly validMastermindSlugs?: ReadonlySet<string>
    readonly validSchemeSlugs?: ReadonlySet<string>
    readonly validHeroSlugs?: ReadonlySet<string>
  }
  ```

  Absence of a field means "skip that cross-reference check." Absence is
  silent, not an error.

---

## Scope (In)

### A) `src/content/content.schemas.ts` — new

- Author-facing schema definitions for each content type:
  - Hero card schema: required fields (name, slug, team, hc, cost, attack,
    recruit, abilities), type constraints, numeric ranges
  - Villain schema: required fields (name, slug, vp, vAttack), type constraints
  - Mastermind schema: required fields (name, slug, vp, alwaysLeads, cards with
    tactic flag), tactic card count > 0
  - Scheme schema: required fields (name, slug, cards, setup instructions)
  - Scenario schema: aligns with `ScenarioDefinition` from WP-030
- Schemas define allowed enums: hero keywords from `HERO_KEYWORDS`, board
  keywords from `BOARD_KEYWORDS`, hero classes, teams
- Schemas are declarative data — no runtime code
- `// why:` comment: schemas are author-facing; engine-facing validation is
  in registry Zod schemas

### B) `src/content/content.validate.ts` — new

- `validateContent(content: unknown, contentType: string, context?: ContentValidationContext): ContentValidationResult`
  — pure function:
  1. **Structural checks**: required fields present, correct types, valid ranges
  2. **Enum checks**: keywords in canonical unions (`HERO_KEYWORDS`,
     `BOARD_KEYWORDS`, `HERO_ABILITY_TIMINGS`, `SCHEME_SETUP_TYPES`),
     hero classes in local `HERO_CLASSES` re-declaration (per WP-033
     RS-9); teams validated as non-empty string only (per RS-8 — no
     canonical teams union at MVP)
  3. **Cross-reference checks** (require `context`; silently skipped when
     `context` is absent): `alwaysLeads` references a slug in
     `context.validVillainGroupSlugs`, scheme setup instructions
     reference valid `SCHEME_SETUP_TYPES` values, tactic cards present
     for masterminds
  4. **Hook consistency checks**: hero ability hooks reference valid keywords
     and timings from WP-021 contracts
  - Uses `for...of` for all iteration (no `.reduce()`)
  - Returns structured result — never throws
  - Error messages are full sentences (Rule 11)
  - `// why:` comment on each validation stage

- `validateContentBatch(items: { content: unknown; contentType: string }[], context?: ContentValidationContext): ContentValidationResult`
  — validates multiple items, aggregates errors. The same `context` is
  forwarded to each per-item call. When `context` is absent,
  cross-reference checks are skipped on all items; structural, enum,
  and hook-consistency checks still run.

- `ContentValidationContext` — a local structural interface for optional
  cross-reference data supplied by the caller:

  ```ts
  interface ContentValidationContext {
    readonly validVillainGroupSlugs?: ReadonlySet<string>
    readonly validMastermindSlugs?: ReadonlySet<string>
    readonly validSchemeSlugs?: ReadonlySet<string>
    readonly validHeroSlugs?: ReadonlySet<string>
  }
  ```

  All fields are optional. When a field is absent, the corresponding
  cross-reference check is silently skipped (absence is not an error —
  it means the caller chose not to supply that reference set). Pattern
  matches WP-032's caller-injected `validMoveNames` (D-2801 local
  structural interface precedent extended to cross-reference data).

### C) `src/types.ts` — modified

- Re-export `ContentValidationResult`, `ContentValidationError`,
  `ContentValidationContext`

### D) `src/index.ts` — modified

- Export `validateContent`, `validateContentBatch`,
  `ContentValidationResult`, `ContentValidationError`,
  `ContentValidationContext`

### E) Tests — `src/content/content.validate.test.ts` — new

- Uses `node:test` and `node:assert` only; no boardgame.io import
- Nine tests:
  1. Valid hero card passes validation
  2. Hero card missing required field: fails with specific error
  3. Hero card with invalid keyword: fails with enum error
  4. Valid mastermind with tactics passes
  5. Mastermind with no tactic cards: fails
  6. Scheme with invalid setup instruction type: fails
  7. Cross-reference check with context supplied: a mastermind whose
     `alwaysLeads` slug is not in `context.validVillainGroupSlugs` fails
     with a full-sentence error identifying the missing slug. When the
     same mastermind is validated with `context` omitted, validation
     passes (cross-reference check is silently skipped).
  8. Batch validation aggregates errors from multiple items
  9. All error messages are full sentences (pattern check)

---

## Out of Scope

- **No content editor UI** — this is a validation toolkit, not an authoring
  interface
- **No content generation or AI-assisted authoring** — future concern
- **No modification of `packages/registry/src/schema.ts`** — content validation
  extends, does not replace
- **No runtime content loading** — validation runs at authoring/build time,
  not at move time
- **No balance validation** — content validation checks structure and
  consistency, not game balance (WP-036 handles balance simulation)
- **No persistence / database access**
- **No server or UI changes**
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above

---

## Files Expected to Change

- `packages/game-engine/src/content/content.schemas.ts` — **new** —
  author-facing schema definitions
- `packages/game-engine/src/content/content.validate.ts` — **new** —
  validateContent, validateContentBatch
- `packages/game-engine/src/types.ts` — **modified** — re-export content types
- `packages/game-engine/src/index.ts` — **modified** — export content API
- `packages/game-engine/src/content/content.validate.test.ts` — **new** — tests

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Schema Definitions
- [ ] Schemas exist for: hero, villain, mastermind, scheme, scenario
- [ ] Schemas reference canonical keyword unions (HERO_KEYWORDS, BOARD_KEYWORDS)
- [ ] Schemas are declarative — no runtime code

### Validation Pipeline
- [ ] `validateContent` returns structured result — never throws
- [ ] Structural checks catch missing required fields
- [ ] Enum checks catch invalid keywords/teams/classes
- [ ] Cross-reference checks catch broken alwaysLeads references
- [ ] Hook consistency checks catch invalid keyword/timing combos
- [ ] Error messages are full sentences

### Batch Validation
- [ ] `validateContentBatch` aggregates errors from multiple items
- [ ] Single invalid item does not block validation of remaining items

### Pre-Engine Gate
- [ ] Validation runs independently of the engine (no boardgame.io import)
      (confirmed with `Select-String`)
- [ ] No `.reduce()` in validation logic
      (confirmed with `Select-String`)

### Tests
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files)
- [ ] Tests cover: valid content, missing fields, invalid enums, broken
      cross-references, batch validation
- [ ] All test files use `.test.ts`; no boardgame.io import

### Scope Enforcement
- [ ] `packages/registry/src/schema.ts` not modified
      (confirmed with `git diff --name-only`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — build after adding content toolkit
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm no boardgame.io import in content files
Select-String -Path "packages\game-engine\src\content" -Pattern "boardgame.io" -Recurse
# Expected: no output

# Step 4 — confirm no .reduce() in validation
Select-String -Path "packages\game-engine\src\content" -Pattern "\.reduce\(" -Recurse
# Expected: no output

# Step 5 — confirm registry schemas not modified
git diff --name-only packages/registry/src/schema.ts
# Expected: no output

# Step 6 — confirm no require()
Select-String -Path "packages\game-engine\src\content" -Pattern "require(" -Recurse
# Expected: no output

# Step 7 — confirm no files outside scope
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
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files)
- [ ] No boardgame.io import in content files
      (confirmed with `Select-String`)
- [ ] No `.reduce()` in validation (confirmed with `Select-String`)
- [ ] Registry schemas not modified (confirmed with `git diff`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — content validation toolkit exists;
      designers can validate content without engine knowledge; D-0601 and
      D-0602 implemented
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why content validation is
      separate from registry Zod schemas (author-facing vs engine-facing);
      what semantic checks go beyond structural shape validation; how schemas
      reference canonical keyword unions
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-033 checked off with today's date
