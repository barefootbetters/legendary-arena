# WP-050 — PAR Artifact Storage & Indexing

**Status:** Draft
**Primary Layer:** Tooling / Data (Out-of-Band)
**Dependencies:** WP-049, WP-048

---

## Session Context

WP-049 established the PAR simulation engine — `generateScenarioPar` produces
a `ParSimulationResult` containing the calibrated PAR value, distribution
statistics, seed set hash, and versioning metadata. WP-048 established
`ScenarioKey` as the canonical scenario identity string and `ParBaseline` as
the four-field baseline struct consumed by `computeParScore`. This packet
defines **how PAR results are stored, indexed, versioned, and accessed** once
generated. It closes the loop from authoring / simulation to enforcement: PAR
data is persisted as immutable artifacts, and the server uses the index to
enforce the pre-release PAR gate.

This packet covers **two artifact source classes**:

- **`seed`** — content-authored Phase 1 baseline per [docs/12-SCORING-REFERENCE.md](../../12-SCORING-REFERENCE.md).
  Hand-maintained per scenario; gives day-one leaderboard coverage before
  simulation runs. Required until a `simulation` artifact exists for the
  same `ScenarioKey`.
- **`simulation`** — Phase 2 calibrated output from WP-049
  (`ParSimulationResult`). Once present for a `ScenarioKey`, it overrides
  the seed artifact at resolve time.

This packet does NOT modify the game engine, the scoring formula, the simulation
engine, or the server. It produces data files and utility functions for writing
and reading them.

PAR artifacts are **canonical data, not derived runtime state**. They are
immutable trust surfaces — once published, never overwritten, regardless of
source class.

---

## Goal

Introduce PAR artifact storage with deterministic, versioned, content-addressed
file layout. After this session:

- `writeSeedParArtifact` writes a content-authored `SeedParArtifact` to a
  deterministic path under `data/par/seed/{version}/`
- `writeSimulationParArtifact` writes a `ParSimulationResult`-derived artifact
  to a deterministic path under `data/par/sim/{version}/`
- `buildParIndex` scans all artifacts in a source-class version directory and
  produces a sorted `index.json` manifest (one index per class × version)
- `lookupParFromIndex` checks whether PAR exists in a single index (class +
  version) and returns the PAR value without loading the full artifact
- `resolveParForScenario` returns the effective PAR for a `ScenarioKey` using
  the **simulation-over-seed preference rule**: sim artifact if present, else
  seed artifact, else null
- Storage layout is sharded by key prefix for filesystem scalability
- PAR version directories (`v1/`, `v2/`, ...) are immutable once published,
  per source class
- Calibration or re-authoring updates produce new version directories, never
  in-place edits
- Determinism guarantee: writing an artifact from identical inputs produces
  bit-for-bit identical JSON
- The index is the canonical oracle for PAR existence within its class; the
  server must not infer existence by probing artifact files directly

---

## Assumes

- WP-049 complete. Specifically:
  - `ParSimulationResult` is an exported type with all required fields
    (parValue, percentileUsed, sampleSize, seedSetHash, rawScoreDistribution,
    needsMoreSamples, scoringConfigVersion, generatedAt)
  - `generateScenarioPar` exists and produces `ParSimulationResult`
- WP-048 complete. Specifically:
  - `ScenarioKey` is a string type alias (plain `export type ScenarioKey
    = string`, not a branded type — TypeScript does not enforce
    branding without an explicit branding tag) with locked format:
    `{schemeSlug}::{mastermindSlug}::{sorted-villainGroupSlugs-joined-by-+}`
  - `buildScenarioKey` exists and produces stable, sorted keys
  - `ParBaseline` interface is exported with fields `roundsPar`,
    `bystandersPar`, `victoryPointsPar`, `escapesPar` (all non-negative
    integers). Seed artifacts carry a `ParBaseline` verbatim so that
    downstream consumers can populate `ScenarioScoringConfig.parBaseline`
    directly.
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
- **Filesystem API lock (PS-6):** production code in `par.storage.ts`
  uses `node:fs/promises` exclusively — never `node:fs` synchronous
  API. Tests may use sync API when it simplifies setup/teardown.
  No `node:net`, `node:http`, `node:https`, `node:child_process`,
  or `node:dns` imports anywhere in new files.

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
  tooling (same layer). Filesystem IO is permitted ONLY in `par.storage.ts`
  and `par.storage.test.ts` per **D-5001** (simulation IO carve-out,
  PAR-pipeline-specific and non-precedential). Every other simulation file
  remains IO-free per D-3601. The carve-out boundary is grep-enforced in
  `## Verification Steps`.
- **Server boundary:** the server reads `index.json` to enforce the pre-release
  PAR gate. Writing artifacts is a tooling concern, not a server concern.
- WP-049 contract files must NOT be modified
- WP-048 contract files must NOT be modified
- No `.reduce()` for accumulation with branching — use `for...of`
- No `Math.random()` — no randomness in storage logic

**Locked contract values:**

- **Artifact source taxonomy (locked):**
  - `ParArtifactSource = 'seed' | 'simulation'`
  - `PAR_ARTIFACT_SOURCES: readonly ParArtifactSource[] = ['seed', 'simulation']`
    — canonical array with drift-detection test (mirrors WP-048 pattern for
    `PENALTY_EVENT_TYPES`)
  - `// why:` the enum is fixed; no third source exists in this packet.
    Phase 3 post-release refinement (if/when introduced) will be a new WP.

- **Storage layout:**
  ```
  data/par/
    seed/
      v1/
        index.json
        scenarios/
          {shard}/
            {scenarioKeySlug}.json
    sim/
      v1/
        index.json
        scenarios/
          {shard}/
            {scenarioKeySlug}.json
  ```
  The two source-class roots (`seed/` and `sim/`) version independently.
  A scenario may have a `seed` artifact and no `sim` artifact, a `sim`
  artifact and no `seed` artifact, or both. When both exist, the `sim`
  artifact wins at resolve time.

- **Shard derivation:** first two characters of the scheme slug from the
  `ScenarioKey`. The scheme slug is the first component of the ScenarioKey
  (before the first `::` delimiter). Identical rule across both source
  classes.
  Example: `midtown-bank-robbery::red-skull::...` → shard `mi/`

- **Filename derivation:** `ScenarioKey` with `::` replaced by `--` and `+`
  replaced by `_` (filesystem-safe), suffixed with `.json`. Identical rule
  across both source classes.
  Example: `midtown-bank-robbery::red-skull::hydra+masters-of-evil`
  → `midtown-bank-robbery--red-skull--hydra_masters-of-evil.json`

- **PAR version directories:** `v1/`, `v2/`, etc. per source class. A new
  version is created when the artifact schema, required fields, or stored
  value semantics change for that class. Version directories are immutable
  once published. Seed versions and simulation versions are independent —
  `seed/v1` is unrelated to `sim/v1`.

- **Canonical serialization rules (non-negotiable):**
  - UTF-8 encoding
  - JSON object keys sorted lexicographically
  - No whitespace significance (use canonical serializer)
  - No comments, no trailing commas
  - Identical rules for both source classes

- **Artifact hash computation (locked):**
  `artifactHash` is `sha256:` + hex of SHA-256 computed over the canonical JSON
  serialization of the artifact **excluding the `artifactHash` field itself**.
  The hash is stored both inside the artifact (self-hash) and in the index
  (cross-verification). Any change to any other field produces a different hash.
  Artifacts missing `artifactHash` or with an invalid hash are **corrupt and
  non-publishable**. Identical rule for both source classes.
  - SHA-256 implementation: `node:crypto.createHash('sha256')` — **Node
    built-in, NOT an external crypto library** (PS-4). D-3601's "no
    crypto libraries in simulation" rule was scoped to seed-set hashing
    where djb2 sufficed. SHA-256 tamper detection is a distinct
    concern; `node:crypto` is a Node built-in and carries no
    package.json impact. External crypto libraries (`crypto-js`,
    `sha.js`, etc.) remain forbidden.
  - `// why:` required above `computeArtifactHash` citing the
    distinction between seed-set hashing (djb2) and tamper detection
    (SHA-256 via Node built-in).

- **Required `simulation` artifact fields:**
  - `scenarioKey` — must exactly match filename
  - `source` — must equal `'simulation'`
  - `parValue` — integer in Raw Score units
  - `percentileUsed`
  - `sampleSize`
  - `generatedAt`
  - `simulation.policyTier` — must be `T2` for publishable PAR
  - `simulation.policyVersion` — e.g. `'CompetentHeuristic/v1'`
  - `simulation.seedSetHash`
  - `scoring.scoringConfigVersion`
  - `scoring.rawScoreSemanticsVersion`
  - `artifactHash` — computed as specified above

- **Required `seed` artifact fields:**
  - `scenarioKey` — must exactly match filename
  - `source` — must equal `'seed'`
  - `parBaseline` — full `ParBaseline` struct (all four integer fields)
    exactly as defined in WP-048 / `parScoring.types.ts`
  - `parValue` — integer in Raw Score units; must equal
    `computeParScore(scoringConfig with parBaseline=this.parBaseline)` for
    the referenced scoring config version. Stored explicitly so the index
    can answer "what PAR does this scenario have?" without recomputing.
  - `scoring.scoringConfigVersion` — integer version pin
  - `scoring.rawScoreSemanticsVersion` — integer version pin
  - `authoredAt` — ISO 8601 timestamp
  - `authoredBy` — free-text author identifier (not validated beyond
    non-empty)
  - `rationale` — free-text rationale for this baseline (not validated
    beyond non-empty); shown in review tooling
  - `artifactHash` — computed as specified above
  - Notably absent (vs simulation): no `percentileUsed`, no `sampleSize`,
    no `seedSetHash`, no `policyTier`, no `policyVersion`

- **Index shape (per source class × version):**
  ```json
  {
    "parVersion": "v1",
    "source": "seed",
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
  The `source` field at the top of the index is redundant with the directory
  path but is required (and validated) so that an index file cannot be moved
  or renamed into the wrong class silently.
  Index keys are sorted alphabetically. Index is regenerated atomically.
  Index `artifactHash` must exactly equal the artifact's internal `artifactHash`.
  Index `parValue` must exactly match the artifact's `parValue`.
  Any mismatch halts publication.

- **Resolution rule (locked):** for a given `ScenarioKey`:
  1. If a `sim` artifact exists at the requested version, return it with
     `source: 'simulation'`.
  2. Else if a `seed` artifact exists at the requested version, return it
     with `source: 'seed'`.
  3. Else return null.
  - `// why:` preferring simulation over seed matches the three-phase PAR
    derivation pipeline in [docs/12-SCORING-REFERENCE.md](../../12-SCORING-REFERENCE.md)
    — seed gives day-one coverage; simulation supersedes it once calibrated.
    Both are preserved on disk so historical leaderboard entries pinned to
    the seed-era `scoringConfigVersion` remain explainable.

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding

---

## Scope (In)

### A) `src/simulation/par.storage.ts` — new

#### Path helpers (identical across both source classes)

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

- `sourceClassRoot(basePath: string, source: ParArtifactSource, parVersion: string): string`
  — returns `{basePath}/seed/{parVersion}` or `{basePath}/sim/{parVersion}`
    depending on `source`
  - Single authoritative helper — no other function constructs class roots
    by string concatenation
  - `// why:` one helper keeps the `seed/` vs `sim/` directory name locked;
    avoids typos like `simulation/` or `seeded/` creeping in

#### Artifact shapes

- `interface SeedParArtifact { scenarioKey: ScenarioKey; source: 'seed'; parBaseline: ParBaseline; parValue: number; scoring: { scoringConfigVersion: number; rawScoreSemanticsVersion: number }; authoredAt: string; authoredBy: string; rationale: string; artifactHash: string }`

- `interface SimulationParArtifact { scenarioKey: ScenarioKey; source: 'simulation'; parValue: number; percentileUsed: number; sampleSize: number; generatedAt: string; simulation: { policyTier: 'T2'; policyVersion: string; seedSetHash: string }; scoring: { scoringConfigVersion: number; rawScoreSemanticsVersion: number }; artifactHash: string }`

- `type ParArtifact = SeedParArtifact | SimulationParArtifact`
  — discriminated union on `source`; consumers narrow with a type guard

#### Simulation artifact writers/readers

- `writeSimulationParArtifact(result: ParSimulationResult, basePath: string, parVersion: string): string`
  — builds a `SimulationParArtifact` from a `ParSimulationResult`, writes it
    to the correct sharded path under `sim/{parVersion}/`
  - Creates shard directory if needed
  - Computes `artifactHash` via `computeArtifactHash` and embeds it in the
    artifact before writing (self-hash)
  - **Refuses overwrite:** if the file already exists, fails loudly with an
    error — never silently overwrites
  - Serializes with sorted keys using canonical serialization for deterministic
    output
  - Returns the relative path of the written file
  - `// why:` sorted keys ensure bit-for-bit reproducibility; overwrite
    refusal enforces immutability as a trust surface

- `readSimulationParArtifact(scenarioKey: ScenarioKey, basePath: string, parVersion: string): SimulationParArtifact | null`
  — reads a simulation artifact by ScenarioKey, returns null if not found

#### Seed artifact writers/readers

- `writeSeedParArtifact(artifact: SeedParArtifact, scoringConfig: ScenarioScoringConfig, basePath: string, parVersion: string): Promise<string>`
  — writes a content-authored `SeedParArtifact` to the correct sharded path
    under `seed/{parVersion}/`
  - **Four-parameter signature** (PS-5 resolution): the second parameter
    `scoringConfig` is required so the writer can run the
    `parValue` / `parBaseline` consistency check at write time by calling
    `computeParScore` against a config constructed from the caller's
    `parBaseline`. Without the parameter, the writer cannot validate
    the stored `parValue` against its baseline.
  - Caller provides the fully-populated artifact **except** `artifactHash`,
    which is computed and embedded by this function (never trust a
    pre-computed hash from the caller — prevents drift).
  - **Refuses overwrite:** identical rule to simulation writer.
  - Validates: `parBaseline` has all four required non-negative integer
    fields; stored `parValue` equals `computeParScore` applied to the
    caller-supplied `scoringConfig` with `parBaseline` substituted from
    the artifact. Rejects the write on any mismatch with a full-sentence
    error.
  - Serializes with the same canonical serialization rules.
  - Returns the relative path of the written file.
  - `// why:` authoring-time validation prevents silently publishing a seed
    PAR whose stored `parValue` disagrees with its `parBaseline` under the
    referenced scoring config version.

- `readSeedParArtifact(scenarioKey: ScenarioKey, basePath: string, parVersion: string): SeedParArtifact | null`
  — reads a seed artifact by ScenarioKey, returns null if not found

#### Index building and lookup

- `buildParIndex(basePath: string, source: ParArtifactSource, parVersion: string): ParIndex`
  — scans all artifact files in `{basePath}/{source-class-root}/{parVersion}/`
  - Produces sorted index with scenario count and the `source` stamp
  - Atomic: writes to temp file then renames
  - One call builds one index; build both classes by calling twice.
  - `// why:` atomic write prevents partial index reads; per-class indices
    keep the two source classes independently auditable

- `lookupParFromIndex(index: ParIndex, scenarioKey: ScenarioKey): { path: string; parValue: number } | null`
  — checks if PAR exists in **this single index** for a ScenarioKey without
    loading the full artifact. Does not cross classes — callers that want
    class-agnostic lookup use `resolveParForScenario`.

#### Cross-class resolver (the simulation-over-seed rule)

- `resolveParForScenario(scenarioKey: ScenarioKey, basePath: string, parVersion: string): ParResolution | null`
  — applies the locked resolution rule:
  1. Load `sim/{parVersion}/index.json`; if it contains `scenarioKey`,
     return `{ source: 'simulation', parValue, path }`.
  2. Else load `seed/{parVersion}/index.json`; if it contains `scenarioKey`,
     return `{ source: 'seed', parValue, path }`.
  3. Else return null.
  - **Never falls through silently on I/O errors** — missing indices are
    treated as "class has no coverage"; truncated or malformed indices
    must throw `ParStoreReadError`.
  - `// why:` single resolver is the only sanctioned way the server and
    tooling obtain effective PAR — prevents ad-hoc readers from encoding
    their own precedence order

- `interface ParResolution { source: ParArtifactSource; parValue: number; path: string; indexPath: string }`

#### Hashing

- `computeArtifactHash(artifact: Record<string, unknown>): string`
  — computes SHA-256 hash of the artifact object, **excluding the `artifactHash`
    field itself**, using canonical serialization (sorted keys, no whitespace)
  - Returns `sha256:<hex>` string
  - Used both as self-hash inside the artifact and for index cross-verification
  - Identical rule for both source classes
  - `// why:` hash mismatch catches silent file edits — immutability
    enforced by content addressing, not just convention; self-hash exclusion
    avoids circular dependency

#### Store validation

- `validateParStore(basePath: string, source: ParArtifactSource, parVersion: string): ParStoreValidationResult`
  — validates a single store (one source class × one version):
  - **Completeness:** every artifact file has a corresponding index entry
  - **Exclusivity:** every index entry points to an existing artifact file
  - **parValue match:** index parValue equals artifact parValue
  - **scenarioKey integrity:** artifact's scenarioKey matches its filename
  - **source integrity:** artifact's `source` field matches the class root
    it lives under (a `source: 'simulation'` file under `seed/` is an error)
  - **Hash integrity:** index artifactHash matches recomputed hash of file
  - **Duplicate detection:** no duplicate scenarioKeys across files
  - **Policy tier guard (simulation only):** artifacts with `policyTier != 'T2'`
    flagged as not publishable
  - **Seed baseline guard (seed only):** `parBaseline` has all four required
    non-negative integer fields; stored `parValue` is consistent with the
    baseline under the referenced scoring config version
  - **No silent repair:** reports all failures, never fixes data
  - Returns structured result with per-scenario pass/fail detail
  - `// why:` validator is a read-only audit tool — silent repair would
    undermine the trust surface

- `validateParStoreCoverage(basePath: string, parVersion: string, expectedScenarios: readonly ScenarioKey[]): ParCoverageResult`
  — cross-class coverage report:
  - For each expected `ScenarioKey`, reports which classes carry an artifact
    (`seed`, `simulation`, both, neither)
  - Flags any key in `expectedScenarios` with neither — these are
    publication-blocking gaps
  - Does not alter precedence rules; purely observational
  - `// why:` answers "do we have PAR for every scenario we plan to ship?"
    in one call, so the pre-release gate (WP-051) has a single oracle

#### Types re-exported from this module

- `interface ParIndex { parVersion: string; source: ParArtifactSource; generatedAt: string; scenarioCount: number; scenarios: Record<ScenarioKey, { path: string; parValue: number; artifactHash: string }> }`

- `interface ParStorageConfig { basePath: string; source: ParArtifactSource; parVersion: string }`

- `interface ParStoreValidationResult { isValid: boolean; source: ParArtifactSource; scenariosChecked: number; errors: ParStoreValidationError[] }`

- `interface ParStoreValidationError { scenarioKey: ScenarioKey; errorType: string; message: string }`

- `interface ParCoverageResult { expectedCount: number; bothCount: number; simulationOnlyCount: number; seedOnlyCount: number; missingCount: number; missing: readonly ScenarioKey[]; seedOnly: readonly ScenarioKey[] }`

- `class ParStoreReadError extends Error` — thrown on malformed or
  truncated index/artifact reads (not on "file not found", which is
  expressed by `null` return)

- Pure utility functions, no boardgame.io import, no engine import

### B) `src/types.ts` — modified

- Re-export `ParArtifactSource`, `PAR_ARTIFACT_SOURCES`, `SeedParArtifact`,
  `SimulationParArtifact`, `ParArtifact`, `ParResolution`, `ParIndex`,
  `ParStorageConfig`, `ParStoreValidationResult`, `ParCoverageResult`,
  `ParStoreReadError`

### C) `src/index.ts` — modified

- Export: `writeSimulationParArtifact`, `readSimulationParArtifact`,
  `writeSeedParArtifact`, `readSeedParArtifact`, `buildParIndex`,
  `lookupParFromIndex`, `resolveParForScenario`, `validateParStore`,
  `validateParStoreCoverage`, `computeArtifactHash`,
  `scenarioKeyToFilename`, `scenarioKeyToShard`, `sourceClassRoot`,
  `PAR_ARTIFACT_SOURCES`

### D) Tests — `src/simulation/par.storage.test.ts` — new

- Uses `node:test` and `node:assert` only; no boardgame.io import
- Thirty-four tests:

  **Path helpers**
  1. `scenarioKeyToFilename` replaces `::` with `--` and `+` with `_`
  2. `scenarioKeyToFilename` is deterministic (same key = same filename)
  3. `scenarioKeyToShard` extracts first two chars of scheme slug
  4. `sourceClassRoot` returns `{basePath}/seed/{v}` for source `'seed'`
  5. `sourceClassRoot` returns `{basePath}/sim/{v}` for source `'simulation'`
  6. `PAR_ARTIFACT_SOURCES` matches `ParArtifactSource` union (drift detection)

  **Simulation artifact I/O**
  7. `writeSimulationParArtifact` creates file at `sim/{v}/scenarios/{shard}/`
  8. `writeSimulationParArtifact` produces sorted JSON (deterministic)
  9. `writeSimulationParArtifact` twice with identical input produces
     byte-identical file content
  10. `writeSimulationParArtifact` refuses overwrite — throws, does not
      silently overwrite
  11. `readSimulationParArtifact` returns the written artifact
  12. `readSimulationParArtifact` returns null for non-existent scenario
  13. Written simulation artifact carries `source: 'simulation'` verbatim

  **Seed artifact I/O**
  14. `writeSeedParArtifact` creates file at `seed/{v}/scenarios/{shard}/`
  15. `writeSeedParArtifact` embeds `artifactHash` even when caller omits it
      (hash is always computed by the writer, never trusted from input)
  16. `writeSeedParArtifact` refuses overwrite — throws, does not silently
      overwrite
  17. `writeSeedParArtifact` rejects an artifact whose `parValue` disagrees
      with `parBaseline` under the referenced scoring config
  18. `readSeedParArtifact` returns the written artifact
  19. `readSeedParArtifact` returns null for non-existent scenario
  20. Written seed artifact carries `source: 'seed'` verbatim and all four
      `parBaseline` fields round-trip unchanged

  **Index building & lookup**
  21. `buildParIndex('seed')` and `buildParIndex('simulation')` build
      independent indices with correct `source` stamps
  22. Index `scenarios` keys are sorted alphabetically (both classes)
  23. Index includes `artifactHash` for each scenario
  24. `lookupParFromIndex` finds existing scenario; returns null otherwise

  **Cross-class resolver**
  25. `resolveParForScenario` returns sim when only sim exists
  26. `resolveParForScenario` returns seed when only seed exists
  27. `resolveParForScenario` returns sim when both exist (preference rule)
  28. `resolveParForScenario` returns null when neither exists
  29. `resolveParForScenario` throws `ParStoreReadError` on a truncated or
      malformed index, instead of silently falling through

  **Validation**
  30. `validateParStore('simulation')` passes for a valid sim store
  31. `validateParStore('simulation')` flags non-T2 artifact as not
      publishable
  32. `validateParStore('seed')` flags an artifact whose `source` field is
      `'simulation'` but lives under `seed/` (cross-class file)
  33. `validateParStoreCoverage` reports seed-only, sim-covered, and
      missing scenarios; `missingCount` matches `missing.length`

  **Hashing**
  34. `computeArtifactHash` produces identical hash for objects with
      identical data but different key insertion order (canonicalization
      guarantee); changes when any non-hash field changes

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

## Vision Alignment

> Per `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md §17`. PAR artifacts
> are the substrate the server gate (WP-051) and leaderboards (WP-054)
> depend on — must be immutable and bit-reproducible.

**Vision clauses touched:** §3, §22, §24, §26

**Conflict assertion:** No conflict. Content-addressed by ScenarioKey
with deterministic sorted-key JSON gives bit-for-bit reproducibility
(§22). PAR version directories (`v1/`, `v2/`) are immutable once
published; calibration updates create new versions, never in-place
edits — preserving "Once declared, PAR baselines are immutable for the
purpose of competition" (§26).

**Non-Goal proximity:** N/A — backing store, no user-facing or paid
surface.

**Determinism preservation:** STRONG. Deterministic JSON serialization
is the entire correctness contract of this WP. Two implementations of
the storage layer must produce byte-identical outputs from the same
input. No timestamp, no host metadata, no nondeterministic field
ordering.

---

## Files Expected to Change

**Code:**

- `packages/game-engine/src/simulation/par.storage.ts` — **new** — seed + sim
  artifact writers/readers, index building, cross-class resolver, validators,
  hashing, path helpers
- `packages/game-engine/src/types.ts` — **modified** — re-export storage types
  (both source classes, resolver, coverage result)
- `packages/game-engine/src/index.ts` — **modified** — export storage API
  (both source classes, resolver, coverage validator)
- `packages/game-engine/src/simulation/par.storage.test.ts` — **new** —
  34 tests

**Docs (required by Definition of Done):**

- `docs/ai/STATUS.md` — **modified**
- `docs/ai/DECISIONS.md` — **modified**
- `docs/ai/work-packets/WORK_INDEX.md` — **modified**

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Source Taxonomy
- [ ] `PAR_ARTIFACT_SOURCES` matches `ParArtifactSource` union (drift detection)
- [ ] `sourceClassRoot` is the only place `seed/` and `sim/` directory names
      appear — no other function concatenates them

### Storage Layout
- [ ] `writeSimulationParArtifact` creates files under
      `data/par/sim/{version}/scenarios/{shard}/`
- [ ] `writeSeedParArtifact` creates files under
      `data/par/seed/{version}/scenarios/{shard}/`
- [ ] Shard derived from first two characters of scheme slug (both classes)
- [ ] Filename derived deterministically from ScenarioKey (both classes)

### Immutability
- [ ] Writing the same simulation artifact twice produces byte-identical JSON
- [ ] Writing the same seed artifact twice produces byte-identical JSON
- [ ] JSON serialization uses sorted keys in both classes
- [ ] `writeSimulationParArtifact` refuses overwrite — throws on existing file
- [ ] `writeSeedParArtifact` refuses overwrite — throws on existing file
- [ ] Writing to `sim/v2` does not modify `sim/v1` (version isolation)
- [ ] Writing to `seed/v2` does not modify `seed/v1` (version isolation)
- [ ] Writing to `sim/` does not modify `seed/` and vice versa (class
      isolation)

### Seed artifact integrity
- [ ] `writeSeedParArtifact` computes `artifactHash` itself; caller-supplied
      hashes (if any) are ignored
- [ ] `writeSeedParArtifact` rejects an artifact whose `parValue` disagrees
      with `parBaseline` under the referenced scoring config version
- [ ] All four `parBaseline` fields round-trip unchanged through write/read

### Index
- [ ] `buildParIndex(source)` produces one sorted index per (source, version)
      with correct `scenarioCount` and correct `source` field
- [ ] Index keys are sorted alphabetically (both classes)
- [ ] Index includes `artifactHash` (SHA-256) for each scenario (both classes)
- [ ] `lookupParFromIndex` returns PAR value without loading full artifact
- [ ] `lookupParFromIndex` returns null for missing scenarios
- [ ] `lookupParFromIndex` does not cross classes — a key present only in
      sim is invisible to a seed-index lookup and vice versa

### Cross-class resolver
- [ ] `resolveParForScenario` returns `source: 'simulation'` when a sim
      artifact exists (preference rule)
- [ ] `resolveParForScenario` returns `source: 'seed'` when only seed exists
- [ ] `resolveParForScenario` returns null when neither class covers the
      scenario
- [ ] `resolveParForScenario` throws `ParStoreReadError` on malformed or
      truncated indices; does not fall through silently

### Store Validation
- [ ] `validateParStore` confirms completeness (every file in index)
- [ ] `validateParStore` confirms exclusivity (every index entry has a file)
- [ ] `validateParStore` confirms parValue match (index == artifact)
- [ ] `validateParStore` confirms scenarioKey matches filename
- [ ] `validateParStore` confirms hash integrity (artifactHash == recomputed)
- [ ] `validateParStore` confirms source integrity (`source` field matches
      class root)
- [ ] `validateParStore('simulation')` flags non-T2 artifacts as not
      publishable
- [ ] `validateParStore('seed')` validates `parBaseline` completeness and
      consistency with stored `parValue`
- [ ] `validateParStore` never silently repairs data — reports only
- [ ] `validateParStoreCoverage` reports per-class coverage and missing
      scenarios against an expected list

### Determinism
- [ ] Same `ParSimulationResult` input = same sim file content
- [ ] Same `SeedParArtifact` input = same seed file content
- [ ] Same set of artifacts per class = same index content

### Engine Isolation
- [ ] No engine gameplay files modified (confirmed with `git diff`)
- [ ] No WP-049 contract files modified (confirmed with `git diff`)
- [ ] No WP-048 contract files modified (confirmed with `git diff`)
- [ ] No boardgame.io imports in new files (confirmed with `Select-String`)
- [ ] No `Math.random()` in new files (confirmed with `Select-String`)

### Tests
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files)
- [ ] All 34 storage tests pass
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

# Step 8 — only expected files changed (sorted for easy diffing)
git diff --name-only | Sort-Object
# Expected: exactly the files listed in ## Files Expected to Change
# (par.storage.ts + types.ts + index.ts + par.storage.test.ts +
#  docs/ai/STATUS.md + docs/ai/DECISIONS.md +
#  docs/ai/work-packets/WORK_INDEX.md), nothing else
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
- [ ] `docs/ai/STATUS.md` updated — PAR artifact storage exists for both
      `seed` and `simulation` source classes; immutable versioned layout
      under `data/par/{seed,sim}/`; `resolveParForScenario` is the single
      oracle consumers use to obtain effective PAR; pre-release gate
      enforceable via per-class index lookup plus coverage validator
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why two source classes
      (seed vs simulation) instead of one mixed dir; why simulation-over-seed
      precedence is locked in a single resolver; why file-based not database;
      why sharding by scheme prefix; why sorted-key serialization for
      determinism; why atomic index writes; immutability as trust surface
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-050 checked off with today's date
