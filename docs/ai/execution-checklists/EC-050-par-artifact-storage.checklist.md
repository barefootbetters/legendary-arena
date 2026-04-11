# EC-050 — PAR Artifact Storage & Indexing (Execution Checklist)

**Source:** docs/ai/work-packets/WP-050-par-artifact-storage.md
**Layer:** Tooling / Data (Out-of-Band)

## Before Starting
- [ ] WP-049 complete — `ParSimulationResult`, `generateScenarioPar` exist
- [ ] WP-048 complete — `ScenarioKey`, `buildScenarioKey` exist
- [ ] ScenarioKey format understood: `{scheme}::{mastermind}::{sorted-villains-joined-by-+}`
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0

## Locked Values (do not re-derive)
- Storage layout: `data/par/{version}/index.json` + `data/par/{version}/scenarios/{shard}/{filename}.json`
- Shard: first two characters of scheme slug from ScenarioKey
- Filename: ScenarioKey with `::` replaced by `--`, `+` replaced by `_`, suffixed `.json`
- PAR version directories (`v1/`, `v2/`, ...) are immutable once published
- Calibration updates create new version directories, never in-place edits
- `writeParArtifact` must refuse overwrite — fails loudly if file already exists
- JSON serialization uses sorted keys for bit-for-bit determinism
- Index keys sorted alphabetically; index written atomically (temp + rename)
- Index includes `artifactHash` (SHA-256) per scenario for tamper detection
- `artifactHash` computed over canonical JSON excluding the `artifactHash` field itself (self-hash exclusion)
- Canonical serialization: UTF-8, lexicographic key sort, no whitespace significance
- `artifactHash` stored both inside the artifact (self-hash) and in the index (cross-verification)
- Artifacts missing `artifactHash` or with invalid hash are corrupt and non-publishable
- PAR artifacts are immutable trust surfaces — write-once, never overwritten

## Guardrails
- No database required — filesystem layout works on local disk, R2/S3, CDN
- No engine gameplay files modified; engine must not import PAR storage files
- No WP-049 or WP-048 contract files modified
- Server reads index for pre-release gate; does not write artifacts
- `validateParStore` is read-only — reports failures, never silently repairs data
- Non-T2 artifacts are valid for analysis and validation, but must be excluded from publishable PAR sets
- Index is the canonical oracle for PAR existence — server must not probe artifact files directly
- No boardgame.io imports, no `Math.random()`, no `.reduce()` with branching
- No in-place modification of existing artifact files under any version directory

## Required `// why:` Comments
- `par.storage.ts` scenarioKeyToFilename: `::` and `+` are problematic on some filesystems
- `par.storage.ts` scenarioKeyToShard: sharding prevents single-directory bloat at scale
- `par.storage.ts` computeArtifactHash self-hash exclusion: avoids circular dependency
- `par.storage.ts` writeParArtifact overwrite refusal: immutability enforced at write time, not just convention
- `par.storage.ts` writeParArtifact sorted keys: ensures bit-for-bit reproducibility
- `par.storage.ts` buildParIndex atomic write: prevents partial index reads
- `par.storage.ts` validateParStore no-repair: silent repair undermines the trust surface

## Files to Produce
- `src/simulation/par.storage.ts` — **new** — write, read, index, lookup, validate, hash, key-to-filename, key-to-shard
- `src/types.ts` — **modified** — re-export ParIndex, ParStorageConfig, ParStoreValidationResult
- `src/index.ts` — **modified** — export storage API
- `src/simulation/par.storage.test.ts` — **new** — 21 tests

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] No boardgame.io/Math.random in storage files (Select-String)
- [ ] No engine or upstream contract files modified (git diff)
- [ ] `docs/ai/STATUS.md` updated
- [ ] `validateParStore` executed in CI prior to publishing or deploying PAR artifacts — never at server runtime
- [ ] `docs/ai/DECISIONS.md` updated (file-based not database, sharding, sorted-key serialization, atomic index, artifactHash for tamper detection, overwrite refusal, immutability as trust surface)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date

## Common Failure Smells
- Artifact file modified in place instead of creating new version — immutability violation
- `writeParArtifact` silently overwrites existing file — must fail loudly
- JSON with unsorted keys — non-deterministic serialization
- ScenarioKey in filename using `::` or `+` directly — filesystem-unsafe characters
- Index written non-atomically — risk of partial reads
- Index missing an artifact file (completeness) or pointing to missing file (exclusivity)
- Index parValue differs from artifact parValue — integrity failure
- Artifact scenarioKey doesn't match its filename — identity drift
- Index artifactHash doesn't match recomputed hash — silent file tampering
- Validator "fixes" data instead of failing loudly — silent corruption risk
- Engine code importing par.storage — layer boundary violation
- Rebuilding index produces different JSON for same artifact set — non-deterministic ordering or serialization
- Writing to v2 modifies files under v1 — version isolation violation
