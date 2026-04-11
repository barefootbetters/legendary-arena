# WP-050 — PAR Artifact Storage & Indexing

**Status:** Draft
**Primary Layer:** Tooling / Data (Out-of-Band)
**Dependencies:** WP-049, WP-048

---

## Session Context

WP-049 established the PAR simulation engine — `generateScenarioPar` produces
a `ParSimulationResult` containing the calibrated PAR value, distribution
statistics, seed set hash, and versioning metadata. WP-048 established
`ScenarioKey` as the canonical scenario identity string. This packet defines
**how PAR results are stored, indexed, versioned, and accessed** once generated.
It closes the loop from simulation to enforcement: WP-049 produces PAR data,
WP-050 persists it as immutable artifacts, and the server uses the index to
enforce the pre-release PAR gate.

This packet does NOT modify the game engine, the scoring formula, the simulation
engine, or the server. It produces data files and utility functions for writing
and reading them.

PAR artifacts are **canonical data, not derived runtime state**. They are
immutable trust surfaces — once published, never overwritten.

---

## Goal

Introduce PAR artifact storage with deterministic, versioned, content-addressed
file layout. After this session:

- `writeParArtifact` writes a `ParSimulationResult` to a deterministic file path
  derived from `ScenarioKey`
- `buildParIndex` scans all artifacts in a PAR version directory and produces
  a sorted `index.json` manifest
- `lookupParFromIndex` checks whether PAR exists for a given `ScenarioKey` and
  returns the PAR value without loading the full artifact
- Storage layout is sharded by key prefix for filesystem scalability
- PAR version directories (`v1/`, `v2/`, ...) are immutable once published
- Calibration updates produce new version directories, never in-place edits
- Determinism guarantee: re-running WP-049 with identical inputs and writing
  via `writeParArtifact` produces bit-for-bit identical JSON
- The index is the canonical oracle for PAR existence; the server must not
  infer existence by probing artifact files directly

---

## Assumes

- WP-049 complete. Specifically:
  - `ParSimulationResult` is an exported type with all required fields
    (parValue, percentileUsed, sampleSize, seedSetHash, rawScoreDistribution,
    needsMoreSamples, scoringConfigVersion, generatedAt)
  - `generateScenarioPar` exists and produces `ParSimulationResult`
- WP-048 complete. Specifically:
  - `ScenarioKey` is a branded type alias with locked format:
    `{schemeSlug}::{mastermindSlug}::{sorted-villainGroupSlugs-joined-by-+}`
  - `buildScenarioKey` exists and produces stable, sorted keys
- `pnpm --filter @legendary-arena/game-engine build` exits 0
- `pnpm --filter @legendary-arena/game-engine test` exits 0

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/12-SCORING-REFERENCE.md — "Scenario PAR Definition & Derivation"` —
  read the calibration invariants. PAR artifacts must be immutable. Calibration
  never changes the scoring formula — only PAR values and difficulty ratings.
  Existing leaderboard entries keep their original `scoringConfigVersion`.
- `docs/ai/ARCHITECTURE.md — "Layer Boundary (Authoritative)"` — PAR artifact
  storage is tooling/data, not engine or server. The engine must NOT import
  PAR storage files. The server reads the index to enforce the pre-release
  gate but does not write artifacts.
- `docs/ai/ARCHITECTURE.md — "Persistence Boundaries"` — `ParSimulationResult`
  is informational output of simulation tooling. It is not `G`, not
  `MatchSnapshot`, and not part of the engine's runtime state.
- `packages/game-engine/src/scoring/parScoring.types.ts` — read `ScenarioKey`
  format. File paths are derived from `ScenarioKey` — the key format is locked.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no abbreviations),
  Rule 6 (`// why:` on immutability and sharding decisions), Rule 13 (ESM only).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- ESM only, Node v22+ — all new files use `import`/`export`, never `require()`
- `node:` prefix on all Node.js built-in imports
- Test files use `.test.ts` extension — never `.test.mjs`
- Full file contents for every new or modified file — no diffs, no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- **Immutability is non-negotiable:** PAR artifacts are write-once. Updates
  create new version directories, never in-place edits. Historical artifacts
  remain intact forever.
- **Determinism:** given identical `ParSimulationResult` input, `writeParArtifact`
  produces bit-for-bit identical JSON (sorted keys, stable serialization).
  Filesystem traversal order must never affect serialization or index ordering;
  all ordering must be explicit and sorted in code.
- **Content-addressed (by identity):** file paths are derived deterministically
  from `ScenarioKey` (not from the hash). No UUIDs, no timestamps in paths,
  no random components.
- **No database required:** storage uses the local filesystem. The layout must
  also work on R2/S3/CDN without modification.
- **Engine isolation:** no engine gameplay files modified. PAR storage utilities
  live in `packages/game-engine/src/simulation/` alongside the simulation
  tooling (same layer).
- **Server boundary:** the server reads `index.json` to enforce the pre-release
  PAR gate. Writing artifacts is a tooling concern, not a server concern.
- WP-049 contract files must NOT be modified
- WP-048 contract files must NOT be modified
- No `.reduce()` for accumulation with branching — use `for...of`
- No `Math.random()` — no randomness in storage logic

**Locked contract values:**

- **Storage layout:**
  ```
  data/par/
    v1/
      index.json
      scenarios/
        {shard}/
          {scenarioKeySlug}.json
  ```

- **Shard derivation:** first two characters of the scheme slug from the
  `ScenarioKey`. The scheme slug is the first component of the ScenarioKey
  (before the first `::` delimiter).
  Example: `midtown-bank-robbery::red-skull::...` → shard `mi/`

- **Filename derivation:** `ScenarioKey` with `::` replaced by `--` and `+`
  replaced by `_` (filesystem-safe), suffixed with `.json`
  Example: `midtown-bank-robbery::red-skull::hydra+masters-of-evil`
  → `midtown-bank-robbery--red-skull--hydra_masters-of-evil.json`

- **PAR version directories:** `v1/`, `v2/`, etc. A new version is created
  when the artifact schema, required fields, or stored value semantics change.
  Version directories are immutable once published.

- **Canonical serialization rules (non-negotiable):**
  - UTF-8 encoding
  - JSON object keys sorted lexicographically
  - No whitespace significance (use canonical serializer)
  - No comments, no trailing commas

- **Artifact hash computation (locked):**
  `artifactHash` is `sha256:` + hex of SHA-256 computed over the canonical JSON
  serialization of the artifact **excluding the `artifactHash` field itself**.
  The hash is stored both inside the artifact (self-hash) and in the index
  (cross-verification). Any change to any other field produces a different hash.
  Artifacts missing `artifactHash` or with an invalid hash are **corrupt and
  non-publishable**.

- **Required artifact fields (minimum):**
  - `scenarioKey` — must exactly match filename
  - `parValue` — centesimal integer
  - `percentileUsed`
  - `sampleSize`
  - `generatedAt`
  - `simulation.policyTier` — must be `T2` for publishable PAR
  - `simulation.seedSetHash`
  - `scoring.scoringConfigVersion`
  - `scoring.rawScoreSemanticsVersion`
  - `artifactHash` — computed as specified above

- **Index shape:**
  ```json
  {
    "parVersion": "v1",
    "generatedAt": "<ISO 8601>",
    "scenarioCount": 42,
    "scenarios": {
      "<ScenarioKey>": {
        "path": "<shard>/<filename>.json",
        "parValue": 26800,
        "artifactHash": "sha256:<hex>"
      }
    }
  }
  ```
  Index keys are sorted alphabetically. Index is regenerated atomically.
  Index `artifactHash` must exactly equal the artifact's internal `artifactHash`.
  Index `parValue` must exactly match the artifact's `parValue`.
  Any mismatch halts publication.

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding

---

## Scope (In)

### A) `src/simulation/par.storage.ts` — new

- `scenarioKeyToFilename(scenarioKey: ScenarioKey): string`
  — converts ScenarioKey to filesystem-safe filename
  - Replaces `::` with `--`, `+` with `_`, appends `.json`
  - Deterministic and reversible
  - `// why:` comment: ScenarioKey uses `::` and `+` which are valid in keys
    but problematic on some filesystems

- `scenarioKeyToShard(scenarioKey: ScenarioKey): string`
  — extracts first two characters of the scheme slug for directory sharding
  - `// why:` comment: sharding prevents single-directory bloat at scale
    (10k-100k scenarios)

- `writeParArtifact(result: ParSimulationResult, basePath: string, parVersion: string): string`
  — writes a PAR artifact to the correct sharded path
  - Creates shard directory if needed
  - Computes `artifactHash` via `computeArtifactHash` and embeds it in the
    artifact before writing (self-hash)
  - **Refuses overwrite:** if the file already exists, fails loudly with an
    error — never silently overwrites
  - Serializes with sorted keys using canonical serialization for deterministic
    output
  - Returns the relative path of the written file
  - `// why:` comment: sorted keys ensure bit-for-bit reproducibility;
    overwrite refusal enforces immutability as a trust surface

- `readParArtifact(scenarioKey: ScenarioKey, basePath: string, parVersion: string): ParSimulationResult | null`
  — reads a PAR artifact by ScenarioKey, returns null if not found

- `buildParIndex(basePath: string, parVersion: string): ParIndex`
  — scans all artifact files in a version directory
  - Produces sorted index with scenario count
  - Atomic: writes to temp file then renames
  - `// why:` comment: atomic write prevents partial index reads

- `lookupParFromIndex(index: ParIndex, scenarioKey: ScenarioKey): { path: string; parValue: number } | null`
  — checks if PAR exists for a ScenarioKey without loading the full artifact
  - Used by the server for the pre-release gate

- `computeArtifactHash(artifact: Record<string, unknown>): string`
  — computes SHA-256 hash of the artifact object, **excluding the `artifactHash`
    field itself**, using canonical serialization (sorted keys, no whitespace)
  - Returns `sha256:<hex>` string
  - Used both as self-hash inside the artifact and for index cross-verification
  - `// why:` comment: hash mismatch catches silent file edits — immutability
    enforced by content addressing, not just convention; self-hash exclusion
    avoids circular dependency

- `validateParStore(basePath: string, parVersion: string): ParStoreValidationResult`
  — validates the entire PAR store for a version directory:
  - **Completeness:** every artifact file has a corresponding index entry
  - **Exclusivity:** every index entry points to an existing artifact file
  - **parValue match:** index parValue equals artifact parValue
  - **scenarioKey integrity:** artifact's scenarioKey matches its filename
  - **Hash integrity:** index artifactHash matches recomputed hash of file
  - **Duplicate detection:** no duplicate scenarioKeys across files
  - **Policy tier guard:** artifacts with policyTier != T2 flagged as not
    publishable
  - **No silent repair:** reports all failures, never fixes data
  - Returns structured result with per-scenario pass/fail detail
  - `// why:` comment: validator is a read-only audit tool — silent repair
    would undermine the trust surface

- `interface ParIndex { parVersion: string; generatedAt: string; scenarioCount: number; scenarios: Record<ScenarioKey, { path: string; parValue: number; artifactHash: string }> }`

- `interface ParStorageConfig { basePath: string; parVersion: string }`

- `interface ParStoreValidationResult { isValid: boolean; scenariosChecked: number; errors: ParStoreValidationError[] }`

- `interface ParStoreValidationError { scenarioKey: ScenarioKey; errorType: string; message: string }`

- Pure utility functions, no boardgame.io import, no engine import

### B) `src/types.ts` — modified

- Re-export `ParIndex`, `ParStorageConfig`, `ParStoreValidationResult`

### C) `src/index.ts` — modified

- Export: `writeParArtifact`, `readParArtifact`, `buildParIndex`,
  `lookupParFromIndex`, `validateParStore`, `computeArtifactHash`,
  `scenarioKeyToFilename`, `scenarioKeyToShard`

### D) Tests — `src/simulation/par.storage.test.ts` — new

- Uses `node:test` and `node:assert` only; no boardgame.io import
- Twenty-one tests:
  1. `scenarioKeyToFilename` replaces `::` with `--` and `+` with `_`
  2. `scenarioKeyToFilename` is deterministic (same key = same filename)
  3. `scenarioKeyToShard` extracts first two chars of scheme slug
  4. `writeParArtifact` creates file at correct sharded path
  5. `writeParArtifact` produces sorted JSON (deterministic serialization)
  6. `writeParArtifact` twice with identical input produces identical file content
  7. `writeParArtifact` refuses overwrite — fails loudly if file already exists
  8. `readParArtifact` returns written artifact
  9. `readParArtifact` returns null for non-existent scenario
  10. `buildParIndex` produces sorted index with correct scenario count
  11. `buildParIndex` includes artifactHash for each scenario
  12. `lookupParFromIndex` finds existing scenario
  13. `lookupParFromIndex` returns null for missing scenario
  14. Index `scenarios` keys are sorted alphabetically
  15. `validateParStore` passes for valid store (all artifacts in index, all
      index entries have files, parValues match, hashes match)
  16. `validateParStore` fails when index is missing an artifact (completeness)
  17. `validateParStore` fails when index entry has no file (exclusivity)
  18. `validateParStore` fails when index parValue differs from artifact
  19. `validateParStore` fails when artifact scenarioKey doesn't match filename
  20. `validateParStore` flags non-T2 artifact as not publishable (valid for
      analysis, excluded from publishable PAR sets)
  21. `computeArtifactHash` produces identical hash for objects with identical
      data but different key insertion order (canonicalization guarantee)

---

## Out of Scope

- **No database ingestion** — artifacts are files, not database records
- **No server modifications** — the server reads index.json but that wiring
  is a server-layer concern, not this packet
- **No engine modifications** — PAR storage is tooling
- **No UI for browsing PAR data**
- **No post-release recalibration pipeline** (Phase 3)
- **No CDN deployment** — the layout supports it but deployment is ops
- **No WP-049 or WP-048 contract modifications**
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**

---

## Files Expected to Change

- `packages/game-engine/src/simulation/par.storage.ts` — **new** —
  writeParArtifact, readParArtifact, buildParIndex, lookupParFromIndex,
  scenarioKeyToFilename, scenarioKeyToShard
- `packages/game-engine/src/types.ts` — **modified** — re-export storage types
- `packages/game-engine/src/index.ts` — **modified** — export storage API
- `packages/game-engine/src/simulation/par.storage.test.ts` — **new** —
  21 tests

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Storage Layout
- [ ] `writeParArtifact` creates files at sharded paths under `data/par/{version}/scenarios/`
- [ ] Shard derived from first two characters of scheme slug
- [ ] Filename derived deterministically from ScenarioKey

### Immutability
- [ ] Writing the same artifact twice produces bit-for-bit identical JSON
- [ ] JSON serialization uses sorted keys
- [ ] `writeParArtifact` refuses overwrite — fails loudly if file exists
- [ ] Writing to v2 does not modify v1 files (version isolation)

### Index
- [ ] `buildParIndex` produces sorted index with correct `scenarioCount`
- [ ] Index keys are sorted alphabetically
- [ ] Index includes `artifactHash` (SHA-256) for each scenario
- [ ] `lookupParFromIndex` returns PAR value without loading full artifact
- [ ] `lookupParFromIndex` returns null for missing scenarios

### Store Validation
- [ ] `validateParStore` confirms completeness (every file in index)
- [ ] `validateParStore` confirms exclusivity (every index entry has a file)
- [ ] `validateParStore` confirms parValue match (index == artifact)
- [ ] `validateParStore` confirms scenarioKey matches filename
- [ ] `validateParStore` confirms hash integrity (artifactHash == recomputed)
- [ ] `validateParStore` flags non-T2 artifacts as not publishable
- [ ] `validateParStore` never silently repairs data — reports only

### Determinism
- [ ] Same `ParSimulationResult` input = same file content
- [ ] Same set of artifacts = same index content

### Engine Isolation
- [ ] No engine gameplay files modified (confirmed with `git diff`)
- [ ] No WP-049 contract files modified (confirmed with `git diff`)
- [ ] No WP-048 contract files modified (confirmed with `git diff`)
- [ ] No boardgame.io imports in new files (confirmed with `Select-String`)
- [ ] No `Math.random()` in new files (confirmed with `Select-String`)

### Tests
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files)
- [ ] All 20 storage tests pass
- [ ] All test files use `.test.ts`; no boardgame.io import

### Scope Enforcement
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — build
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0

# Step 2 — run all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: all tests passing, 0 failing

# Step 3 — no boardgame.io import in storage files
Select-String -Path "packages\game-engine\src\simulation\par.storage.ts" -Pattern "boardgame.io"
# Expected: no output

# Step 4 — no Math.random
Select-String -Path "packages\game-engine\src\simulation\par.storage.ts" -Pattern "Math.random"
# Expected: no output

# Step 5 — no engine gameplay modifications
git diff --name-only packages/game-engine/src/game.ts packages/game-engine/src/moves/ packages/game-engine/src/rules/ packages/game-engine/src/scoring/
# Expected: no output

# Step 6 — no WP-049 contract modifications
git diff packages/game-engine/src/simulation/ai.competent.ts
git diff packages/game-engine/src/simulation/par.aggregator.ts
git diff packages/game-engine/src/simulation/ai.tiers.ts
# Expected: no output

# Step 7 — no require()
Select-String -Path "packages\game-engine\src\simulation\par.storage.ts" -Pattern "require("
# Expected: no output

# Step 8 — no files outside scope
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
- [ ] No boardgame.io imports in storage files (confirmed with `Select-String`)
- [ ] No `Math.random()` in storage (confirmed with `Select-String`)
- [ ] No engine or upstream contract files modified
      (confirmed with `git diff --name-only`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — PAR artifact storage exists; immutable
      versioned layout under `data/par/`; pre-release gate enforceable via
      index lookup
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why file-based not database;
      why sharding by scheme prefix; why sorted-key serialization for
      determinism; why atomic index writes; immutability as trust surface
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-050 checked off with today's date
