# Post-Mortem — WP-033 (Content Authoring Toolkit)

---

### 0. Metadata

- **Work Packet:** WP-033
- **Title:** Content Authoring Toolkit
- **Execution Date:** 2026-04-16
- **EC Used:** EC-033
- **Pre-Flight Date:** 2026-04-16
- **Test Baseline:** 367/95/0 -> 376/96/0

---

### 1. Binary Health Check (Absolute)

- [x] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [x] `pnpm --filter @legendary-arena/game-engine test` exits 0
  (376 tests, 96 suites, 0 fail)
- [x] Correct number of new tests added (9, matches WP spec exactly)
- [x] No existing test files modified
- [x] No scope expansion occurred during execution
- [x] EC acceptance criteria all pass (all 9 verification steps green)

All YES. Proceeding.

---

### 2. Scope & Allowlist Audit

**Modified files (from `git diff --name-only`):**

Code files:
- `packages/game-engine/src/types.ts` — allowlisted (additive re-exports)
- `packages/game-engine/src/index.ts` — allowlisted (additive exports)

Governance files:
- `docs/ai/STATUS.md` — WP-033 entry added
- `docs/ai/DECISIONS.md` — D-3303 added (author-facing vs registry
  schemas; semantic check list; canonical-keyword-union reference pattern)
- `docs/ai/work-packets/WORK_INDEX.md` — WP-033 checked off 2026-04-16

**New files (untracked):**
- `packages/game-engine/src/content/content.schemas.ts` — allowlisted
- `packages/game-engine/src/content/content.validate.ts` — allowlisted
- `packages/game-engine/src/content/content.validate.test.ts` — allowlisted
- `docs/ai/invocations/postmortem-wp033-content-toolkit.md` — this file

- [x] Only allowlisted files modified
- [x] No contract files modified (types.ts and index.ts are additive only)
- [x] No "while I'm here" refactors
- [x] No formatting-only or cleanup-only edits
- [x] No new files outside WP scope (governance artifacts are expected)

---

### 3. Boundary Integrity Check

#### Framework Boundaries

- [x] No `boardgame.io` imports in any content file — verified via
  `grep -rn "from ['\"]boardgame\.io" packages/game-engine/src/content/`
  (no matches)
- [x] No framework context leaking — `ContentValidationContext` is a
  local structural interface with 4 optional `ReadonlySet<string>`
  fields; no `Ctx` import
- [x] No lifecycle coupling — `validateContent` and `validateContentBatch`
  are NOT wired into `game.ts`, moves, phase hooks, setup builders, or
  rule hook executors. Consumed only by tests.

#### Registry / IO Boundaries

- [x] No `@legendary-arena/registry` imports — verified via
  `grep -rn "from ['\"]@legendary-arena/registry" packages/game-engine/src/content/`
  (no matches). The content category re-declares `HERO_CLASSES` locally
  (RS-9) and re-declares the henchman shape locally (D-3302) rather than
  importing.
- [x] No filesystem, network, or persistence access
- [x] No `require()`, no `Math.random()`, no `Date.now()`, no
  `performance.now()`

#### Code Category Compliance

- [x] All 3 new files in `src/content/` — classified as engine category
  per D-3301
- [x] No setup-time code in content directory (all pure validation)
- [x] No runtime code in `content.schemas.ts` (descriptor objects only)

---

### 4. Representation & Determinism Audit

- [x] `ContentSchemaDescriptor` is data-only and JSON-serializable —
  five readonly array/object fields of primitives only. No functions,
  closures, Maps, Sets, Dates, or classes.
- [x] Schema constants (`HERO_CARD_SCHEMA`, `VILLAIN_CARD_SCHEMA`, etc.)
  are `as const` — module-level immutable literals.
- [x] `ContentValidationError` and `ContentValidationResult` are
  data-only — primitives only.
- [x] `ContentValidationContext` uses `ReadonlySet<string>` — this is
  a runtime call-site parameter only; documented explicitly as
  forbidden from `G`, persistence, snapshots, or wire payloads
  (D-1232 forbids `Set` in `G`). If a future caller needs to cross a
  serialization boundary, they must convert to `readonly string[]` at
  the boundary.
- [x] `validateContent` is deterministic — same
  `(content, contentType, context?)` always produces the same result.
  No hidden state, no caching, no memoization. Stage ordering is
  fixed (accept-list → structural → enum → cross-reference → hook
  consistency).
- [x] `validateContentBatch` is deterministic — iterates items in
  array order; forwards identical `context` to every per-item call.
- [x] No module-level mutable state — no `let` or mutable `const` at
  module scope in any content file.
- [x] Unknown/future values: unknown `contentType` produces a single
  locked error shape (copilot RISK #10 / #21 resolution); unknown
  enum values produce full-sentence enum errors listing the allowed
  set.

---

### 5. Mutation, Aliasing, & Reference Safety

- [x] No mutation occurs on any input — `validateContent` and
  `validateContentBatch` only read their inputs. The internal `errors`
  array is allocated fresh at the top of each call.
- [x] No helpers mutate `G` or `ctx` — these validators do not receive
  `G` or `ctx` at all.
- [x] Pure functions confirmed: all exported and internal helpers
  (`isPlainRecord`, `getContentId`, `humanLabel`, `getSchemaDescriptor`,
  `pushError`, `runStructuralChecks`, `runEnumChecks`,
  `runCrossReferenceChecks`, `runHookConsistencyChecks`,
  `validateContent`, `validateContentBatch`) are pure.

**Aliasing trace:**

- Schema constants exported from `content.schemas.ts` are `as const`
  module-level literals. The validator reads their fields but never
  assigns to them. `ContentSchemaDescriptor` fields are declared
  `readonly` / `Readonly<...>`, so TypeScript prevents writes
  statically.
- `validateContent` never returns a reference to any input object.
  Success path returns a fresh `{ valid: true }` literal. Failure path
  returns `{ valid: false, errors }` where `errors` is allocated at
  the top of the function call.
- `validateContentBatch` allocates its own `allErrors` array and
  pushes copies of individual `ContentValidationError` objects onto
  it. The per-item error objects are themselves fresh literals
  created by `pushError` (line: `errors.push({ contentType, contentId,
  field, message })`).
- No schema object is ever aliased into a mutable `G` field — the
  validator does not touch `G`.

**Verdict:** No aliasing risk. All returned objects are fresh literals
containing only primitive values. Schema constants are `readonly` /
`as const`; authored input objects are only read.

---

### 6. Hidden-Coupling Detection

- [x] No engine internals exposed — `validateContent` takes `unknown`
  content and a string `contentType`; it does not accept `G`, `ctx`,
  or any engine-internal type.
- [x] `ACCEPTED_CONTENT_TYPES` is intentionally closed (6 members).
  No unintentional widening.
- [x] No implicit knowledge of content authoring tools — the
  validator is consumed by tests and future tools via the standard
  `index.ts` export.
- [x] Ordering assumption is explicit and documented (JSDoc lists the
  5 validation stages in order).
- [x] No dependency on non-exported functions — internal helpers
  (`isPlainRecord`, `humanLabel`, etc.) are module-local; externally
  consumed symbols are exported explicitly from `index.ts`.
- [x] Cross-reference data is caller-injected via
  `ContentValidationContext` — the engine category never reaches into
  the registry to populate it (D-3301 honored).

---

### 7. Test Adequacy Review

- [x] Tests fail if boundaries are violated:
  - Test 1 (valid hero): fails if schema becomes stricter without cause.
  - Test 2 (missing team): fails if structural stage stops reporting
    missing required fields.
  - Test 3 (invalid keyword): fails if enum stage stops checking
    `HERO_KEYWORDS`.
  - Test 4/5 (mastermind tactics): fails if tactic-presence check is
    removed.
  - Test 6 (scheme setup type): fails if enum stage stops checking
    `SCHEME_SETUP_TYPES`.
  - Test 7 (cross-reference with/without context): fails if the
    context-absent skip logic regresses or the context-present check
    is removed.
  - Test 8 (batch aggregation): fails if a single invalid item
    short-circuits the batch.
  - Test 9 (full-sentence + unknown-contentType): fails if messages
    lose their sentence form, or if unknown `contentType` silently
    passes.
- [x] Determinism tested implicitly — every test calls the validator
  and asserts a specific result; deterministic behavior is required
  for the assertions to hold.
- [x] Serialization: all returned `ContentValidationResult` and
  `ContentValidationError` objects contain only primitive fields —
  they are trivially JSON-serializable.
- [x] Non-mutation: the validators return fresh literals; no test
  retains an alias to an input that could be mutated out-of-band.
- [x] Tests do NOT depend on unrelated engine behavior — no
  `buildInitialGameState`, no `makeMockCtx`, no registry fixtures. All
  test data is inline synthetic.
- [x] No tests weakened — all assertions are strict.

---

### 8. Aliasing / Purity / Context-Absent Audits (Required by §After Execution)

- [x] **Aliasing audit:** no schema object returned by
  `content.schemas.ts` is a reference to a mutable `G` field.
  Schemas are module-level `as const` constants; the validator
  reads them but never writes. No `G` field is ever passed into
  these modules.
- [x] **Purity audit:** `validateContent` and `validateContentBatch`
  do not mutate any input parameter. Verified by code inspection:
  every write path is to a local `errors` / `allErrors` array
  allocated fresh at call time. Inputs are only read via property
  access and `Array.isArray` / `Object.keys`.
- [x] **Context-absent behavior audit:** when `context` is
  `undefined`, the cross-reference stage short-circuits at the top
  of `runCrossReferenceChecks` (`if (context === undefined) return;`)
  and no error is produced. Test 7 explicitly verifies this.

No post-mortem fixes required.

---

### 9. Documentation & Governance Updates

- [x] **DECISIONS.md** — D-3303 added: author-facing-vs-registry
  rationale, semantic check list (structural / enum / cross-reference
  / hook consistency), canonical-keyword-union reference pattern,
  lifecycle isolation.
- [x] **ARCHITECTURE.md** — No update needed. WP-033 does not change
  architectural boundaries — it adds a pre-engine gate module within
  the existing engine layer. The Layer Boundary section already
  covers the engine's role.
- [x] **STATUS.md** — WP-033 entry added with full description.
- [x] **WORK_INDEX.md** — WP-033 checked off with 2026-04-16 date.

---

### 10. Forward-Safety Questions

- [x] **Survives future refactors?** YES. `validateContent` has no
  knowledge of specific content instances, no boardgame.io import,
  no `G` access. Adding a new hero keyword requires only updating
  `HERO_KEYWORDS`; the validator picks it up automatically.
- [x] **Replay/debugging can reconstruct?** YES. Validation is a pure
  function of `(content, contentType, context?)`. Given the same
  inputs, it produces the same result. Each error entry identifies
  the content by `contentId` and the failing `field`.
- [x] **Removing upstream data fails safely?** YES. If a canonical
  array (e.g., `HERO_KEYWORDS`) were removed, TypeScript would catch
  the broken import at compile time.
- [x] **Cannot influence gameplay unintentionally?** YES. Content
  validation is NOT wired into the boardgame.io lifecycle. It is
  consumed only by tests and future content-authoring tools.
- [x] **Contract stable for future WPs?** YES. `ContentValidationResult`,
  `ContentValidationError`, and `ContentValidationContext` are
  data-only types with locked shapes. `validateContent` has a stable
  3-parameter signature; `validateContentBatch` has a stable
  2-parameter signature. Future authoring WPs can tighten per-type
  schemas without breaking the public API.

All YES.

---

### 11. Final Post-Mortem Verdict

- [x] **WP COMPLETE** — execution is correct, safe, and durable

**Notes / Follow-ups:**

- One minor mid-execution fix: the initial docstring in
  `content.validate.ts` used the literal string `.reduce()` when
  listing constraints, which produced a false-positive on
  verification step 5 (`grep -rn "\.reduce(" packages/game-engine/src/content/`).
  Rephrased the docstring to read "no use of array reduce" so the
  grep cleanly returns empty. No behavior change.
- One mid-execution fix: a `Record<string, readonly string[]>`
  indexed access in `runEnumChecks` triggered
  `strictNoUncheckedIndexedAccess` (`allowed` possibly undefined).
  Added a guard (`if (allowed === undefined) continue`). No behavior
  change — `Object.keys` only returns defined keys anyway.

**Fixes applied during post-mortem:**

- None. No aliasing, coupling, or boundary issues discovered. All
  implementation files pass inspection without modification.
