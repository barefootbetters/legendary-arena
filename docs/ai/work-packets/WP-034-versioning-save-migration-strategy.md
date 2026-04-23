# WP-034 — Versioning & Save Migration Strategy

**Status:** Complete  
**Primary Layer:** Engine Evolution / Persistence / Backward Compatibility  
**Dependencies:** WP-033

---

## Session Context

WP-027 proved deterministic replay from `ReplayInput`. WP-030 introduced
campaign state as external, versioned data. WP-031 enforced engine invariants.
WP-033 established content validation as a pre-engine gate. This packet
defines how persisted artifacts (replays, campaign state, content definitions)
evolve across engine versions without silent breakage. Three independent
version axes ensure that engine changes, data format changes, and content
changes are tracked and migrated independently. This implements D-0003
(Data Outlives Code), D-0801 (Explicit Version Axes), and D-0802
(Incompatible Data Fails Loudly).

---

## Goal

Establish a formal, deterministic versioning and migration strategy. After
this session:

- Three independent version axes exist: engine version (semver), data version
  (integer), and content version (integer)
- Every persisted artifact embeds its version at save time
- A compatibility checker determines whether an artifact is loadable by the
  current engine version
- Migration functions transform old data formats into current ones —
  deterministically and testably
- Incompatible versions that cannot be migrated fail loudly with full-sentence
  error messages
- The engine never guesses what old data means

---

## Assumes

- WP-033 complete. Specifically:
  - `packages/game-engine/src/replay/replay.types.ts` exports `ReplayInput`
    (WP-027)
  - `packages/game-engine/src/campaign/campaign.types.ts` exports
    `CampaignState`, `ScenarioDefinition` (WP-030)
  - `packages/game-engine/src/persistence/persistence.types.ts` exports
    `MatchSnapshot`, `PersistableMatchConfig` (WP-013)
  - `packages/game-engine/src/content/content.validate.ts` exports
    `validateContent` (WP-033)
  - `packages/game-engine/src/test/mockCtx.ts` exports `makeMockCtx` (WP-005B)
  - `pnpm --filter @legendary-arena/game-engine build` exits 0
  - `pnpm --filter @legendary-arena/game-engine test` exits 0
- `docs/ai/ARCHITECTURE.md` exists with "MVP Gameplay Invariants" and
  Persistence Boundaries (Section 3)
- `docs/ai/DECISIONS.md` exists with D-0003, D-0801, D-0802

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Section 3` — read "The Three Data Classes".
  Class 2 (Configuration) and Class 3 (Snapshot) are the data classes that
  may be persisted and therefore require versioning. Class 1 (Runtime) is
  never persisted and does not need version stamps.
- `docs/ai/ARCHITECTURE.md — "MVP Gameplay Invariants"` — read all sections.
  Versioning protects the invariants documented there — replay determinism,
  zone serialization, counter semantics.
- `docs/ai/DECISIONS.md` — read D-0003 (Data Outlives Code), D-0801 (Explicit
  Version Axes), D-0802 (Incompatible Data Fails Loudly). These govern this
  packet.
- `docs/ai/DECISIONS.md` — read D-1002 (Immutable Surfaces Are Protected).
  Replay semantics, rules, RNG behavior, and scoring cannot change without
  a major engine version increment.
- `docs/ai/ARCHITECTURE.md — "Layer Boundary (Authoritative)"` — versioning
  logic is game-engine layer. Migration functions are pure. Persistence
  storage is application/server layer.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no
  abbreviations), Rule 6 (`// why:` on version axes independence and on
  fail-loud behavior), Rule 8 (no `.reduce()`), Rule 11 (full-sentence
  error messages for incompatible versions), Rule 13 (ESM only).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — versioning involves no randomness
- ESM only, Node v22+ — all new files use `import`/`export`, never `require()`
- `node:` prefix on all Node.js built-in imports (`node:test`, `node:assert`,
  etc.)
- Test files use `.test.ts` extension — never `.test.mjs`
- No database or network access in versioning logic
- Full file contents for every new or modified file in the output — no diffs,
  no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- Three version axes are **independent** — an engine version bump does not
  require a data version bump unless the data format changes
- Version stamps are embedded in persisted artifacts at save time — never
  reconstructed or inferred at load time
- Migration functions are **pure and deterministic** — same input version +
  data always produces same output
- **Incompatible versions fail loudly** — `checkCompatibility` returns a
  structured result; if incompatible and unmigratable, loading is rejected
  with a full-sentence error message (D-0802)
- The engine **never guesses** — if the version is absent or unrecognized,
  loading fails
- Migrations are **forward-only** — no downgrade support in MVP
- Version types are **data-only** and JSON-serializable
- No `.reduce()` in migration logic — use `for...of`
- Tests use plain mocks — no `boardgame.io` imports

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding

**Locked contract values:**

- **Three version axes:**
  ```ts
  interface EngineVersion {
    major: number
    minor: number
    patch: number
  }

  interface DataVersion {
    version: number  // incremented on format changes
  }

  interface ContentVersion {
    version: number  // incremented on content schema changes
  }
  ```

- **VersionedArtifact wrapper:**
  ```ts
  interface VersionedArtifact<T> {
    engineVersion: EngineVersion
    dataVersion: DataVersion
    contentVersion?: ContentVersion
    payload: T
    savedAt: string  // ISO 8601
  }
  ```

---

## Scope (In)

### A) `src/versioning/versioning.types.ts` — new

- `EngineVersion`, `DataVersion`, `ContentVersion` — independent version types
- `VersionedArtifact<T>` — generic wrapper embedding version stamps
- `type CompatibilityStatus = 'compatible' | 'migratable' | 'incompatible'`
- `interface CompatibilityResult { status: CompatibilityStatus; message: string; migrations?: string[] }`
- `// why:` comment: three axes are independent per D-0801; version stamps
  embedded at save time, never inferred

### B) `src/versioning/versioning.check.ts` — new

- `checkCompatibility(artifactVersion: EngineVersion, currentVersion: EngineVersion): CompatibilityResult`
  — pure function:
  - Same major + same or lower minor: `compatible`
  - Same major + higher minor with migration path: `migratable`
  - Different major or no migration path: `incompatible`
  - Returns full-sentence message explaining the result
  - `// why:` comment: major version change = breaking; minor = migratable;
    patch = always compatible

- `getCurrentEngineVersion(): EngineVersion`
  — returns the current engine version (constant)

### C) `src/versioning/versioning.migrate.ts` — new

- `migrateArtifact<T>(artifact: VersionedArtifact<T>, targetVersion: EngineVersion): VersionedArtifact<T>`
  — pure function:
  - Looks up migration functions by source -> target version
  - Applies migrations in sequence (forward-only)
  - Updates version stamps in the artifact
  - If no migration path exists: throws (this is correct — an unmigratable
    artifact is an error, not a gameplay condition)
  - `// why:` comment: migrations are explicit and deterministic (D-0003)

- Migration registry: `Record<string, (payload: unknown) => unknown>` keyed
  by `"fromVersion->toVersion"` strings
  - MVP: empty or minimal — migrations will be added as versions change

### D) `src/versioning/versioning.stamp.ts` — new

- `stampArtifact<T>(payload: T, contentVersion?: ContentVersion): VersionedArtifact<T>`
  — attaches current engine version, data version, optional content version,
  and ISO 8601 timestamp
  - Pure function
  - `// why:` comment: stamps embedded at save time — never reconstructed

### E) `src/types.ts` — modified

- Re-export versioning types

### F) `src/index.ts` — modified

- Export versioning types, check, migrate, stamp functions

### G) Tests — `src/versioning/versioning.test.ts` — new

- Uses `node:test` and `node:assert` only; no boardgame.io import
- Nine tests:
  1. Same version: `compatible`
  2. Same major, lower minor: `compatible`
  3. Same major, higher minor with migration: `migratable`
  4. Different major: `incompatible`
  5. Missing version stamp: rejected (fail loud)
  6. `stampArtifact` embeds correct engine version and timestamp
  7. `migrateArtifact` applies forward-only migration
  8. `migrateArtifact` with no migration path: throws
  9. All version types JSON-serializable (stringify roundtrip)

---

## Out of Scope

- **No actual migrations** — MVP migration registry is empty or minimal;
  migrations are added as versions change in future packets
- **No downgrade support** — migrations are forward-only
- **No persistence storage engine** — versioning defines stamps and checks;
  storage is application/server layer
- **No version negotiation protocol** — future networking concern
- **No UI for version warnings**
- **No database access**
- **No server changes**
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above

---

## Files Expected to Change

- `packages/game-engine/src/versioning/versioning.types.ts` — **new** —
  EngineVersion, DataVersion, ContentVersion, VersionedArtifact,
  CompatibilityResult
- `packages/game-engine/src/versioning/versioning.check.ts` — **new** —
  checkCompatibility, getCurrentEngineVersion
- `packages/game-engine/src/versioning/versioning.migrate.ts` — **new** —
  migrateArtifact, migration registry
- `packages/game-engine/src/versioning/versioning.stamp.ts` — **new** —
  stampArtifact
- `packages/game-engine/src/types.ts` — **modified** — re-export versioning
  types
- `packages/game-engine/src/index.ts` — **modified** — export versioning API
- `packages/game-engine/src/versioning/versioning.test.ts` — **new** — tests

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Version Types
- [ ] Three independent version axes defined (engine, data, content)
- [ ] `VersionedArtifact<T>` embeds all three + timestamp
- [ ] All types JSON-serializable

### Compatibility Checking
- [ ] Same major version: `compatible` or `migratable`
- [ ] Different major: `incompatible`
- [ ] Full-sentence result messages
- [ ] Missing version stamp: rejected

### Migration
- [ ] Forward-only — no downgrade
- [ ] Pure and deterministic
- [ ] No migration path: throws (correct — unmigratable is an error)
- [ ] Migration registry structure exists (may be empty for MVP)

### Stamping
- [ ] `stampArtifact` embeds current engine version + timestamp
- [ ] Stamps are embedded at creation time, never inferred

### Pure Functions
- [ ] All versioning files have no boardgame.io import
      (confirmed with `Select-String`)
- [ ] No `.reduce()` in versioning logic
      (confirmed with `Select-String`)

### Tests
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files)
- [ ] Tests cover: compatible, migratable, incompatible, missing version,
      migration forward-only, stamp correctness
- [ ] All test files use `.test.ts`; no boardgame.io import

### Scope Enforcement
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — build after adding versioning
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm no boardgame.io import in versioning files
Select-String -Path "packages\game-engine\src\versioning" -Pattern "boardgame.io" -Recurse
# Expected: no output

# Step 4 — confirm no .reduce()
Select-String -Path "packages\game-engine\src\versioning" -Pattern "\.reduce\(" -Recurse
# Expected: no output

# Step 5 — confirm version types are JSON-serializable (test exists)
Select-String -Path "packages\game-engine\src\versioning\versioning.test.ts" -Pattern "JSON.stringify"
# Expected: at least one match

# Step 6 — confirm no require()
Select-String -Path "packages\game-engine\src\versioning" -Pattern "require(" -Recurse
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
- [ ] No boardgame.io import in versioning files
      (confirmed with `Select-String`)
- [ ] No `.reduce()` in versioning (confirmed with `Select-String`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — versioning strategy exists; three
      independent version axes; compatibility checking and migration framework
      in place; D-0003, D-0801, D-0802 implemented
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why three axes are
      independent; why migrations are forward-only; what constitutes a major
      vs minor version change; relationship between D-1002 (immutable surfaces)
      and major version requirements
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-034 checked off with today's date
