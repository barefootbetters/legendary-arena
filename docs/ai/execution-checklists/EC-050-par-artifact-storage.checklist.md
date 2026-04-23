# EC-050 — PAR Artifact Storage & Indexing (Execution Checklist)

**Source:** docs/ai/work-packets/WP-050-par-artifact-storage.md
**Layer:** Tooling / Data (Out-of-Band) — filesystem IO permitted under D-5001 carve-out (`par.storage.ts` only)

## Before Starting
- [ ] WP-049 complete — `ParSimulationResult`, `generateScenarioPar`, `createCompetentHeuristicPolicy`, `AI_POLICY_TIERS`, `AI_POLICY_TIER_DEFINITIONS` exist; merged to `main` at `956306c`
- [ ] WP-048 complete — `ScenarioKey`, `ParBaseline`, `ScenarioScoringConfig`, `computeParScore`, `buildScenarioKey`, `PENALTY_EVENT_TYPES` exist
- [ ] D-5001 DECISIONS entry landed (IO carve-out permitting `node:fs/promises` in `par.storage.ts` only)
- [ ] ScenarioKey format understood: `{scheme}::{mastermind}::{sorted-villains-joined-by-+}` (plain string type alias, not a branded type)
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (baseline 471/112/0 game-engine; 623/125/0 repo-wide)

## Locked Values (do not re-derive)

### Dual source-class storage layout
- `ParArtifactSource = 'seed' | 'simulation'` — closed union, drift-pinned against `PAR_ARTIFACT_SOURCES: readonly ParArtifactSource[] = ['seed', 'simulation']`
- Two independent class roots: `data/par/seed/{version}/` and `data/par/sim/{version}/`
- Per-class storage layout: `{class-root}/index.json` + `{class-root}/scenarios/{shard}/{filename}.json`
- Seed versions and simulation versions are independent — `seed/v1` is unrelated to `sim/v1`
- `sourceClassRoot(basePath, source, parVersion)` is the single authoritative helper; no other function concatenates `seed/` or `sim/` directory names

### Path conventions (identical across both source classes)
- Shard: **first two characters of the scheme slug** (first component of ScenarioKey before first `::`)
- Filename: ScenarioKey with `::` replaced by `--`, `+` replaced by `_`, suffixed `.json`
- PAR version directories (`v1/`, `v2/`, ...) are immutable once published, per source class
- Calibration updates create new version directories, never in-place edits

### Serialization and hashing
- JSON serialization uses **canonical sorted-key** order for bit-for-bit determinism (default `JSON.stringify` key order is non-deterministic)
- UTF-8 encoding; no whitespace significance; no comments; no trailing commas
- Index keys (`scenarios` map) sorted alphabetically on write; index written atomically (temp file + `fs.rename`)
- `artifactHash` is `sha256:` + hex of SHA-256 computed over canonical JSON **excluding the `artifactHash` field itself** (self-hash exclusion)
- SHA-256 via `node:crypto.createHash('sha256')` — Node built-in, NOT an external crypto library (D-3601's "no crypto libraries in simulation" was scoped to seed-set hashing; tamper detection uses `node:crypto` as a Node-built-in exception with `// why:` citation)
- Artifacts missing `artifactHash` or with invalid hash are **corrupt and non-publishable**
- `artifactHash` stored both inside the artifact (self-hash) AND in the index (cross-verification)

### Immutability contract
- PAR artifacts are **write-once, never overwritten** — `writeSeedParArtifact` and `writeSimulationParArtifact` both **refuse overwrite** (throw `Error` on existing file)
- No `fs.rm`, `fs.truncate`, or `fs.rename`-over-existing-artifact anywhere in writer code paths
- Indices are NOT immutable — they regenerate when the artifact set changes. Only individual artifact files are immutable.

### Source-class precedence (cross-class resolver)
- `resolveParForScenario` applies **simulation-over-seed** precedence: sim artifact wins when both exist
- Precedence is locked in a single resolver; no caller-override, no optional `preferSource` parameter
- Missing index files are treated as "class has no coverage" (proceed to next class)
- Truncated or malformed indices throw `ParStoreReadError` — never fall through silently

### Writer signatures (locked)
- `writeSimulationParArtifact(result: ParSimulationResult, basePath: string, parVersion: string): Promise<string>`
- `writeSeedParArtifact(artifact: SeedParArtifact, scoringConfig: ScenarioScoringConfig, basePath: string, parVersion: string): Promise<string>` — **four parameters** (the second parameter `scoringConfig` required for `parValue` / `parBaseline` consistency check at write time)
- Both writers return the relative path of the written file

### Filesystem API lock
- `node:fs/promises` is the only filesystem API permitted in production code (`par.storage.ts`)
- `node:fs` synchronous API is forbidden in production; tests MAY use sync API if it simplifies setup
- `node:path` permitted for path construction; normalize to POSIX forward-slash in stored `path` values
- No `node:net`, `node:http`, `node:https`, `node:child_process`, `node:dns`, or any other Node built-in that performs network / process IO

### Policy tier guard (simulation artifacts only)
- `SimulationParArtifact.simulation.policyTier` must equal `'T2'` for publishable artifacts
- Guard derived from `AI_POLICY_TIER_DEFINITIONS` — the single entry with `usedForPar: true` (drift-pinned by WP-049 test #12)
- `writeSimulationParArtifact` rejects inputs whose policy tier is not T2 (tests #31 or equivalent)

### Seed artifact consistency guard
- `writeSeedParArtifact` validates `parValue === computeParScore(scenarioScoringConfigWithBaseline)` for the referenced scoring config version; rejects inconsistent artifacts at write time
- Stored `parValue` must be recomputable from the stored `parBaseline` + scoring config — drift between the two is a publication-blocking error

### Test count lock (WP-050 §D)
- **Exactly 34 tests** inside one `describe('PAR artifact storage (WP-050)', …)` block:
  - 6 path helpers (`scenarioKeyToFilename`, `scenarioKeyToShard`, `sourceClassRoot` for seed + sim, `PAR_ARTIFACT_SOURCES` drift)
  - 7 simulation artifact I/O (write-creates-file, sorted JSON, byte-identity, overwrite refusal, read round-trip, null-on-missing, source-field verbatim)
  - 7 seed artifact I/O (write-creates-file, writer-embeds-hash, overwrite refusal, parValue/parBaseline consistency rejection, read round-trip, null-on-missing, parBaseline round-trip)
  - 4 index build + lookup (per-class builds with correct source stamps, sorted keys, artifactHash embedded, lookupParFromIndex hit/miss)
  - 5 cross-class resolver (sim-only, seed-only, both-precedence, neither, malformed-index throws)
  - 4 store validation (valid sim store, non-T2 flag, cross-class source mismatch, coverage reporter)
  - 1 hashing (canonicalization + any-field-change)

## Guardrails
- No database required — filesystem layout works on local disk, R2/S3, CDN
- No engine gameplay files modified; engine must not import PAR storage files
- No WP-049 or WP-048 contract files modified
- Server reads index for pre-release gate; does not write artifacts
- `validateParStore` is read-only — reports failures, never silently repairs data
- Non-T2 artifacts are valid for analysis and validation, but must be excluded from publishable PAR sets
- Index is the canonical oracle for PAR existence within its class; server must not probe artifact files directly
- `resolveParForScenario` is the only sanctioned cross-class reader — callers must not encode their own precedence
- No boardgame.io imports, no `Math.random()`, no `.reduce()` with branching
- No in-place modification of existing artifact files under any version directory
- **D-5001 carve-out boundary:** filesystem IO permitted ONLY in `par.storage.ts` and `par.storage.test.ts`. Enforced by grep gate in verification steps. No other simulation file may import `node:fs` or `node:fs/promises`.

## Required `// why:` Comments

### Path and layout
- `par.storage.ts` `scenarioKeyToFilename`: `::` and `+` are valid in ScenarioKey but problematic on some filesystems
- `par.storage.ts` `scenarioKeyToShard`: sharding prevents single-directory bloat at 10k–100k scenarios
- `par.storage.ts` `sourceClassRoot`: single authoritative helper keeps `seed/` vs `sim/` directory names locked; avoids typos like `simulation/` or `seeded/` creeping in

### Hashing
- `par.storage.ts` `computeArtifactHash` self-hash exclusion: avoids circular dependency where the hash would depend on itself
- `par.storage.ts` SHA-256 via `node:crypto`: Node built-in, not external crypto library — D-3601's "no crypto libraries in simulation" was scoped to seed-set hashing where djb2 sufficed; tamper detection is a distinct concern using a Node-built-in module

### Writers
- `par.storage.ts` `writeSimulationParArtifact` overwrite refusal: immutability enforced at write time, not just convention
- `par.storage.ts` `writeSimulationParArtifact` sorted keys: ensures bit-for-bit reproducibility across runs and machines
- `par.storage.ts` `writeSimulationParArtifact` policy tier guard: `AI_POLICY_TIER_DEFINITIONS` pins T2 as the only publishable tier; reject non-T2 at the earliest boundary
- `par.storage.ts` `writeSeedParArtifact` overwrite refusal: identical immutability rule across both source classes
- `par.storage.ts` `writeSeedParArtifact` consistency guard: stored `parValue` must be recomputable from `parBaseline` + scoring config; drift is a publication blocker
- `par.storage.ts` `writeSeedParArtifact` hash always computed by writer: caller-supplied hashes ignored to prevent drift between baseline and hash

### Index and resolver
- `par.storage.ts` `buildParIndex` atomic write: temp-file + `fs.rename` prevents partial index reads during concurrent regeneration
- `par.storage.ts` `buildParIndex` indices not immutable: indices regenerate when the artifact set changes; only individual artifact files are write-once
- `par.storage.ts` `resolveParForScenario` simulation-over-seed precedence: locked in a single resolver per §26 PAR derivation pipeline; preserves seed artifacts on disk for historical leaderboard explainability
- `par.storage.ts` `resolveParForScenario` no silent fall-through on malformed indices: truncated / hash-mismatched indices throw `ParStoreReadError` to surface store corruption loudly

### Validator
- `par.storage.ts` `validateParStore` no-repair: silent repair would undermine the trust surface; validator reports all failures and is read-only
- `par.storage.ts` `validateParStoreCoverage` cross-class report: answers "do we have PAR for every scenario we plan to ship?" in one call so WP-051's pre-release gate has a single oracle

### Layer boundary
- `par.storage.ts` top-of-file `// why:` block: D-5001 carve-out — filesystem IO permitted here and only here within the simulation category; every other simulation file remains IO-free per D-3601

## Files to Produce
- `src/simulation/par.storage.ts` — **new** — seed + sim writers/readers, index builders, cross-class resolver, validators, hashing, path helpers, `ParStoreReadError` class, `PAR_ARTIFACT_SOURCES` canonical array (13 function exports + 1 class + 1 constant + 9 type exports)
- `src/types.ts` — **modified** — re-export 9 PAR storage types: `ParArtifactSource`, `SeedParArtifact`, `SimulationParArtifact`, `ParArtifact`, `ParResolution`, `ParIndex`, `ParStorageConfig`, `ParStoreValidationResult`, `ParCoverageResult` (plus `ParStoreValidationError`)
- `src/index.ts` — **modified** — export the full storage API (13 functions + `ParStoreReadError` class + `PAR_ARTIFACT_SOURCES` constant + type re-exports)
- `src/simulation/par.storage.test.ts` — **new** — exactly **34 tests** in 1 describe block (+1 suite)

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 — game-engine 505/113/0 (+34 tests / +1 suite); repo-wide 657/126/0
- [ ] No `boardgame.io` / `@legendary-arena/registry` / `Math.random` imports in new files (grep)
- [ ] No `.reduce()` with branching in new files (grep)
- [ ] No `require()` in new files (grep)
- [ ] D-5001 carve-out boundary grep gate passes: `grep -rnE "from ['\"]node:fs" packages/game-engine/src/simulation/ --include="*.ts" | grep -vE "(par\.storage\.ts|par\.storage\.test\.ts)"` returns no output
- [ ] No engine or upstream contract files modified (git diff zero output on WP-036 + WP-048 + WP-049 files)
- [ ] `validateParStore` executed in CI prior to publishing or deploying PAR artifacts — never at server runtime
- [ ] `docs/ai/STATUS.md` updated — dual source-class storage availability, `resolveParForScenario` as single oracle, pre-release gate enforceable via per-class index + coverage validator
- [ ] `docs/ai/DECISIONS.md` updated with D-5002..D-5010 (9 new entries): dual source classes rationale, simulation-over-seed precedence, file-based not database, sharding by scheme prefix, sorted-key serialization, atomic index writes, overwrite refusal as immutability, SHA-256 `artifactHash` for tamper detection, non-T2 policy tier guard
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-050 checked off with today's date + Commit A hash
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` has EC-050 flipped Draft → Done
- [ ] Post-mortem written at `docs/ai/post-mortems/01.6-WP-050-par-artifact-storage.md` covering the 7 mandatory items (aliasing, JSON-roundtrip, `// why:` completeness, determinism, per-class isolation, layer-boundary + carve-out audit, hash integrity)

## Common Failure Smells
- Artifact file modified in place instead of creating new version — immutability violation
- `writeSimulationParArtifact` or `writeSeedParArtifact` silently overwrites existing file — must fail loudly
- JSON with unsorted keys (relying on default `JSON.stringify`) — non-deterministic serialization
- ScenarioKey in filename using `::` or `+` directly — filesystem-unsafe characters
- Index written non-atomically — risk of partial reads during regeneration
- Index missing an artifact file (completeness) or pointing to missing file (exclusivity)
- Index `parValue` differs from artifact `parValue` — integrity failure
- Index `artifactHash` doesn't match recomputed hash — silent file tampering
- Artifact `scenarioKey` doesn't match its filename — identity drift
- Artifact's `source` field says `'simulation'` but the file lives under `seed/` (or vice versa) — cross-class corruption
- Validator "fixes" data instead of failing loudly — silent corruption risk
- Engine runtime code importing `par.storage` — layer boundary violation
- Any simulation file other than `par.storage.ts` / `par.storage.test.ts` importing `node:fs` or `node:fs/promises` — D-5001 carve-out boundary violation
- Writer calling `fs.rm` / `fs.truncate` / `fs.rename`-over-existing to "fix" an overwrite failure — violates immutability contract
- Rebuilding index produces different JSON for same artifact set — non-deterministic ordering or serialization
- Writing to `v2` modifies files under `v1` — version isolation violation
- Writing to `sim/` modifies anything under `seed/` or vice versa — class isolation violation
- `resolveParForScenario` falling through silently on a malformed index instead of throwing `ParStoreReadError`
- `resolveParForScenario` allowing caller to override simulation-over-seed precedence (adding an optional `preferSource` parameter) — precedence is locked
- `writeSimulationParArtifact` accepting non-T2 `policyTier` without rejection — policy tier guard missing
- `writeSeedParArtifact` accepting mismatched `parValue` vs `parBaseline` without rejection — consistency guard missing
- `writeSeedParArtifact` trusting a caller-supplied `artifactHash` — writer must always compute
- `writeSeedParArtifact` signature missing the `scoringConfig` parameter — cannot validate consistency
- External crypto dependency (`crypto-js`, `sha.js`, etc.) imported — `node:crypto` is the only permitted SHA-256 source
- Synchronous filesystem API (`readFileSync` / `writeFileSync`) in `par.storage.ts` production code — `node:fs/promises` is the production lock
- `ParSimulationResult` fields consumed with renamed shapes (e.g., `seedSetHash` → `seedHash`) — WP-049 field names are load-bearing; renames force WP-049 amendment
- `SimulationParArtifact.simulation.policyTier` written as anything other than the string literal `'T2'` — guard drift
