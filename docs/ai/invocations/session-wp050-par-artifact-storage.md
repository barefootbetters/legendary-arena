# Session Prompt — WP-050 PAR Artifact Storage & Indexing

**Work Packet:** [docs/ai/work-packets/WP-050-par-artifact-storage.md](../work-packets/WP-050-par-artifact-storage.md) (amended 2026-04-23 per PS-3/4/5/6 findings)
**Execution Checklist:** [docs/ai/execution-checklists/EC-050-par-artifact-storage.checklist.md](../execution-checklists/EC-050-par-artifact-storage.checklist.md) (surgical update applied 2026-04-23 per PS-1 drift resolution)
**Session Context Bridge:** [docs/ai/session-context/session-context-wp050.md](../session-context/session-context-wp050.md)
**Pre-Flight Report:** [docs/ai/invocations/preflight-wp050-par-artifact-storage.md](preflight-wp050-par-artifact-storage.md)
**Pre-flight verdict:** READY TO EXECUTE once A0 bundle lands (PS-1 + PS-2 resolved via EC update + D-5001 carve-out).
**Commit prefix:** `EC-050:` on every code-changing commit; `SPEC:` on governance/pre-flight commits outside the allowlist; `WP-050:` is **forbidden** (commit-msg hook rejects per P6-36).
**WP Class:** Infrastructure & Verification / Tooling & Data. External consumer tooling. No engine gameplay changes. No `G` mutation from new files. No moves added. No phase hooks. No new `LegendaryGameState` fields. No `buildInitialGameState` shape change.
**Primary layer:** Game Engine (existing `packages/game-engine/src/simulation/` subdirectory, classified as `engine` category per D-3601; IO carve-out for `par.storage.ts` permitted by D-5001).

---

## Pre-Session Gates (Resolve Before Writing Any File)

1. **Commit-prefix confirmation.** `EC-050:` on code commits inside the allowlist; `SPEC:` on governance commits. `WP-050:` forbidden.

2. **Governance bundle A0 landed.** Confirm the A0 SPEC commit (expected hash TBD at A0 land time) is HEAD of `main` (or on the current branch). A0 contains:
   - `docs/ai/work-packets/WP-050-par-artifact-storage.md` (PS-3/4/5/6 applied)
   - `docs/ai/execution-checklists/EC-050-par-artifact-storage.checklist.md` (PS-1 drift resolved; 34-test count + dual source class content)
   - `docs/ai/DECISIONS.md` (D-5001 simulation-IO carve-out)
   - `docs/ai/invocations/preflight-wp050-par-artifact-storage.md`
   - `docs/ai/session-context/session-context-wp050.md`
   - This prompt

   If A0 is not landed, STOP — execution is blocked on pre-flight governance.

3. **Upstream dependency baseline.** Run:
   ```bash
   pnpm -r test
   ```
   Expect **623 tests / 125 suites / 0 fail** repo-wide:
   - registry `13 / 2 / 0`
   - vue-sfc-loader `11 / 0 / 0`
   - **game-engine `471 / 112 / 0` (MUST shift to `505 / 113 / 0` post-Commit A — exactly +34 tests, +1 suite)**
   - server `6 / 2 / 0`
   - replay-producer `4 / 2 / 0`
   - preplan `52 / 7 / 0`
   - arena-client `66 / 0 / 0`
   - Post-Commit A repo-wide: `657 / 126 / 0`.

   If the repo baseline diverges, STOP and reconcile before writing code.

4. **Upstream contract surface verification.** Before writing any file, grep-verify every dependency export at HEAD:

   ```bash
   grep -n "export interface ParSimulationResult"       packages/game-engine/src/simulation/par.aggregator.ts
   grep -n "export interface ParSimulationConfig"       packages/game-engine/src/simulation/par.aggregator.ts
   grep -n "export function generateScenarioPar"        packages/game-engine/src/simulation/par.aggregator.ts
   grep -n "export const AI_POLICY_TIERS"               packages/game-engine/src/simulation/ai.tiers.ts
   grep -n "export const AI_POLICY_TIER_DEFINITIONS"    packages/game-engine/src/simulation/ai.tiers.ts
   grep -n "export type ScenarioKey"                    packages/game-engine/src/scoring/parScoring.types.ts
   grep -n "export interface ParBaseline"               packages/game-engine/src/scoring/parScoring.types.ts
   grep -n "export interface ScenarioScoringConfig"     packages/game-engine/src/scoring/parScoring.types.ts
   grep -n "export function computeParScore"            packages/game-engine/src/scoring/parScoring.logic.ts
   grep -n "export interface CardRegistryReader"        packages/game-engine/src/matchSetup.validate.ts
   ```

   Each MUST return exactly one line. If any returns zero lines, STOP — the Assumes gate is violated.

5. **WP-036 / WP-048 / WP-049 contract files MUST be unchanged.** Before and after Commit A, run:
   ```bash
   git diff main -- packages/game-engine/src/simulation/ai.types.ts \
                    packages/game-engine/src/simulation/ai.random.ts \
                    packages/game-engine/src/simulation/ai.legalMoves.ts \
                    packages/game-engine/src/simulation/simulation.runner.ts \
                    packages/game-engine/src/simulation/simulation.test.ts \
                    packages/game-engine/src/simulation/ai.competent.ts \
                    packages/game-engine/src/simulation/ai.competent.test.ts \
                    packages/game-engine/src/simulation/ai.tiers.ts \
                    packages/game-engine/src/simulation/par.aggregator.ts \
                    packages/game-engine/src/simulation/par.aggregator.test.ts \
                    packages/game-engine/src/scoring/parScoring.types.ts \
                    packages/game-engine/src/scoring/parScoring.logic.ts \
                    packages/game-engine/src/scoring/parScoring.keys.ts \
                    packages/game-engine/src/scoring/scoring.types.ts \
                    packages/game-engine/src/scoring/scoring.logic.ts
   ```
   Expect **zero output**. Any modification to these files is a Hard Stop.

6. **Working-tree hygiene (P6-27).** `git status --short` should show only `?? .claude/worktrees/`. Stage by exact filename only — `git add .` / `-A` / `-u` are forbidden.

7. **Branch discipline.** Cut a fresh topic branch from main:
   ```bash
   git checkout -b wp-050-par-artifact-storage main
   ```

If any gate is unresolved, STOP.

---

## Runtime Wiring Allowance (01.5) — NOT INVOKED

WP-050 is purely additive tooling and touches **zero** engine contract surface:

| 01.5 Trigger Criterion | Applies to WP-050? | Justification |
|---|---|---|
| Adds a required field to `LegendaryGameState` or another shared type | **No** | No engine type modified. Zero new G fields. |
| Changes the shape of a return type produced by `buildInitialGameState` or similar setup orchestrators | **No** | `buildInitialGameState` never called in new files. |
| Adds a new move to `LegendaryGame.moves` that affects structural assertions in existing tests | **No** | Zero moves added. |
| Adds a new phase hook that alters the expected structural shape of gameplay initialization or test scaffolding | **No** | No phase hook. |

**Conclusion:** 01.5 is **NOT INVOKED**. If an unanticipated structural break appears mid-execution, **STOP and escalate** — do not force-fit.

**Lifecycle prohibition.** Functions introduced by WP-050 (`writeSeedParArtifact`, `writeSimulationParArtifact`, `readSeedParArtifact`, `readSimulationParArtifact`, `buildParIndex`, `lookupParFromIndex`, `resolveParForScenario`, `validateParStore`, `validateParStoreCoverage`, `computeArtifactHash`, `scenarioKeyToFilename`, `scenarioKeyToShard`, `sourceClassRoot`) MUST NOT be called from:
- `game.ts` or any `LegendaryGame.moves` entry
- Any phase hook (`onBegin`, `onEnd`, `endIf`, phase `onBegin`)
- Any file under `src/moves/`, `src/rules/`, `src/phases/`, `src/turn/`, `src/setup/`, `src/endgame/`, `src/economy/`, `src/zone*`, `src/ui/**`, `src/replay/**`, `src/invariants/**`
- Any file under `src/simulation/` OTHER than `par.storage.ts` and its test file

They are consumed by test files (inside `src/simulation/par.storage.test.ts`), future WP-051 (server publication gate), and content-authoring tooling only. (WP-028 lifecycle-prohibition precedent.)

---

## IO Carve-Out (D-5001) — CRITICAL

Per the new D-5001 entry landed in the A0 bundle, filesystem IO is permitted **only** in:
- `packages/game-engine/src/simulation/par.storage.ts` (new file in this WP)
- `packages/game-engine/src/simulation/par.storage.test.ts` (new test file in this WP)

Filesystem IO is **forbidden** in every other simulation file. The verification step below grep-confirms this:

```bash
grep -rnE "from ['\"]node:fs" packages/game-engine/src/simulation/ --include="*.ts" | grep -vE "(par\.storage\.ts|par\.storage\.test\.ts)"
# Expected: no output.
```

If the grep returns any line, a simulation file other than the two carve-out files is importing `node:fs` — layer violation. Stop and escalate.

Also forbidden in the simulation carve-out:
- `import * as fs from 'fs'` (must use `node:fs/promises` — PS-6 lock)
- `import { ... } from 'node:fs'` synchronous API in production code (tests may use sync; prod must not)
- `import ... from 'node:child_process'` / `node:net` / `node:http` / `node:https` / `node:dns` / any network or process-spawn API

Only `node:fs/promises`, `node:path`, `node:crypto`, and pure JS are permitted in `par.storage.ts`.

---

## Post-Mortem (01.6) — MANDATORY

Per [01.6-post-mortem-checklist.md](../REFERENCE/01.6-post-mortem-checklist.md). WP-050 triggers four mandatory conditions:

| 01.6 Trigger | Applies? | Justification |
|---|---|---|
| New long-lived abstraction | **Yes** | `ParArtifactSource` union + `PAR_ARTIFACT_SOURCES` canonical array + `ParIndex` + `ParResolution` + `ParArtifact` discriminated union anchor WP-051 + WP-054 downstream WPs. |
| New contract consumed by future WPs | **Yes** | WP-051 consumes `resolveParForScenario` + `validateParStoreCoverage` + `ParResolution`. Field names load-bearing. |
| New canonical readonly array | **Yes** | `PAR_ARTIFACT_SOURCES` + drift test. Same pattern as `AI_POLICY_TIERS` / `PENALTY_EVENT_TYPES` / `MATCH_PHASES`. |
| New filesystem carve-out | **Yes** | First simulation-category file to do IO. Post-mortem must document the carve-out boundary. |
| New setup artifact in `G` | No | Zero G involvement. |

**Post-mortem must cover (minimum):**

1. **Aliasing check.** `SeedParArtifact` and `SimulationParArtifact` returned from `readSeedParArtifact` / `readSimulationParArtifact` must be fresh objects (via `JSON.parse`). `writeSeedParArtifact` must NOT retain caller references after returning.
2. **JSON-roundtrip check.** Every artifact type (both source classes) survives `JSON.parse(JSON.stringify(artifact))` with structural equality — no functions, Maps, Sets, Dates, or class instances (D-4806 precedent). Test #33 or equivalent asserts this.
3. **`// why:` comment completeness.** Every EC-050 §Required `// why:` Comments item is present. Grep verification: `grep -c "// why:" packages/game-engine/src/simulation/par.storage.ts`.
4. **Determinism audit.** Write-same-input-twice produces byte-identical output (both source classes). Verified via the reproducibility tests (#9 sim, equivalent for seed).
5. **Per-source-class isolation audit.** Writing to `sim/` never modifies `seed/` and vice versa. Writing to `v2/` never modifies `v1/`. Tests #... assert isolation.
6. **Layer-boundary audit.** `grep -nE "from ['\"]boardgame\.io" packages/game-engine/src/simulation/par.storage.ts` returns zero. Same for `@legendary-arena/registry`. `grep -rnE "from ['\"]node:fs" packages/game-engine/src/simulation/ --include="*.ts" | grep -vE "par\.storage"` returns zero (D-5001 carve-out boundary).
7. **Hash integrity audit.** `computeArtifactHash` excludes the `artifactHash` field itself (self-hash exclusion). Verified by: compute hash, embed, recompute excluding field — must match.

**Post-mortem file path:** `docs/ai/post-mortems/01.6-WP-050-par-artifact-storage.md`. Template = `docs/ai/post-mortems/01.6-WP-049-par-simulation-engine.md`.

Post-mortem runs in the **same session** as Commit A execution, before Commit B (governance close). Fixes applied during post-mortem are strict in-allowlist refinements — they do NOT require 01.5 invocation.

---

## Authority Chain (Read in Order Before Writing)

1. [.claude/CLAUDE.md](../../../.claude/CLAUDE.md) — EC-mode, lint gate, commit discipline
2. [.claude/rules/architecture.md](../../../.claude/rules/architecture.md) — Layer Boundary (authoritative); engine may NOT import `boardgame.io`, registry, preplan, server, pg; IO prohibited in engine EXCEPT for D-5001 carve-out in `par.storage.ts`
3. [.claude/rules/game-engine.md](../../../.claude/rules/game-engine.md) — engine category rules; registry boundary; no `.reduce()`; no `Math.random()`
4. [.claude/rules/code-style.md](../../../.claude/rules/code-style.md) — ESM only, `.test.ts` extension, full-sentence error messages, no abbreviations, JSDoc required on every function
5. [docs/ai/ARCHITECTURE.md](../ARCHITECTURE.md) — §Layer Boundary; §Persistence Boundaries; §Debuggability & Diagnostics
6. [docs/ai/execution-checklists/EC-050-par-artifact-storage.checklist.md](../execution-checklists/EC-050-par-artifact-storage.checklist.md) — **primary execution authority** (Locked Values + Guardrails + Failure Semantics + Required `// why:` Comments + Files to Produce + After Completing + Common Failure Smells) — drifted pre-A0, updated in A0 bundle
7. [docs/ai/work-packets/WP-050-par-artifact-storage.md](../work-packets/WP-050-par-artifact-storage.md) — authoritative WP specification
8. [docs/ai/session-context/session-context-wp050.md](../session-context/session-context-wp050.md) — bridge from WP-049 closure; baselines; precedents
9. [docs/ai/invocations/preflight-wp050-par-artifact-storage.md](preflight-wp050-par-artifact-storage.md) — READY TO EXECUTE verdict; PS-1 through PS-6 resolved
10. [docs/ai/DECISIONS.md](../DECISIONS.md) — D-3601 (Simulation Code Category), D-4801..D-4806 (PAR scoring contracts), D-4901..D-4911 (WP-049 PAR calibration), **D-5001 (Simulation IO Carve-Out for par.storage.ts)** — new in A0 bundle
11. [docs/12-SCORING-REFERENCE.md](../../12-SCORING-REFERENCE.md) — three-phase PAR pipeline; WP-050 stores Phase 1 (seed) + Phase 2 (sim) artifacts
12. [docs/ai/REFERENCE/00.6-code-style.md](../REFERENCE/00.6-code-style.md) — human-facing style guide

**Implementation anchors (read before coding — paths verified at pre-flight time):**

13. [packages/game-engine/src/simulation/par.aggregator.ts](../../../packages/game-engine/src/simulation/par.aggregator.ts) — `ParSimulationResult` shape. WP-050 maps each field into `SimulationParArtifact`. **Immutable** (WP-049 contract).
14. [packages/game-engine/src/simulation/ai.tiers.ts](../../../packages/game-engine/src/simulation/ai.tiers.ts) — `AI_POLICY_TIER_DEFINITIONS`. Publishable-tier guard reads `.usedForPar === true` to find T2. **Immutable** (WP-049 contract).
15. [packages/game-engine/src/scoring/parScoring.types.ts](../../../packages/game-engine/src/scoring/parScoring.types.ts) — `ScenarioKey`, `ParBaseline`, `ScenarioScoringConfig`. **Immutable** (WP-048 contract).
16. [packages/game-engine/src/scoring/parScoring.logic.ts](../../../packages/game-engine/src/scoring/parScoring.logic.ts) — `computeParScore`. Called by `writeSeedParArtifact` to validate stored `parValue` against `parBaseline`. **Immutable** (WP-048 contract).

If any conflict, higher-authority documents win.

---

## Goal (Binary)

After this session, the game engine exposes the PAR artifact storage layer for both `seed` and `simulation` source classes. Specifically:

1. **`packages/game-engine/src/simulation/par.storage.ts`** exists with exported path helpers, artifact shapes, writers, readers, index builders, the cross-class resolver, validators, the hashing helper, the `ParAggregationError`-equivalent `ParStoreReadError` class, and the `PAR_ARTIFACT_SOURCES` canonical array. Uses `node:fs/promises`, `node:path`, `node:crypto`. No boardgame.io, no registry, no other external imports.
2. **`packages/game-engine/src/simulation/par.storage.test.ts`** exists with exactly **34** tests inside one `describe('PAR artifact storage (WP-050)', …)` block. Tests cover path helpers (6), simulation I/O (7), seed I/O (7), index build + lookup (4), cross-class resolver (5), store validation (4), hashing (1).
3. **`packages/game-engine/src/types.ts`** re-exports the PAR storage types (9 re-exports per WP-050 §B).
4. **`packages/game-engine/src/index.ts`** exports the public PAR storage API (14 function exports + `PAR_ARTIFACT_SOURCES` constant + typed re-exports per WP-050 §C).
5. **Engine baseline shift: 471 / 112 / 0 → 505 / 113 / 0.** Repo-wide: 623 → 657 tests; 125 → 126 suites. Zero existing tests modified.
6. **Governance closed:** `docs/ai/STATUS.md` records the PAR storage availability; `docs/ai/DECISIONS.md` records at minimum: dual source classes rationale, simulation-over-seed precedence rule, sharding strategy, sorted-key serialization, atomic index writes, overwrite refusal as immutability contract, `artifactHash` for tamper detection, file-based not database (new D-entries); `docs/ai/work-packets/WORK_INDEX.md` flips WP-050 `[ ]` → `[x]` with today's date + Commit A hash; `docs/ai/execution-checklists/EC_INDEX.md` flips EC-050 Draft → Done.

No engine gameplay changes. No server changes. No arena-client changes. No preplan changes. No `package.json` / `pnpm-lock.yaml` edits. No modifications to WP-036 / WP-048 / WP-049 contract files.

---

## Locked Values (Do Not Re-Derive)

All Locked Values below are copied from EC-050 (post-A0 update) + WP-050 §Non-Negotiable Constraints + pre-flight findings.

### Commit topology (three commits)

- **Commit A0 (`SPEC:`)** — pre-flight bundle. **Must land before execution.** Contains this prompt + preflight + session-context + WP-050 updates + EC-050 updates + D-5001.
- **Commit A (`EC-050:`)** — execution. Contains:
  - `packages/game-engine/src/simulation/par.storage.ts` (new)
  - `packages/game-engine/src/simulation/par.storage.test.ts` (new; 34 tests in 1 suite)
  - `packages/game-engine/src/types.ts` (re-exports)
  - `packages/game-engine/src/index.ts` (public API exports)
  - `docs/ai/DECISIONS.md` (new PAR storage decisions — see §Governance Decisions below)
- **Commit B (`SPEC:`)** — governance close. Contains:
  - `docs/ai/work-packets/WORK_INDEX.md` (WP-050 `[ ]` → `[x]` with date + Commit A hash)
  - `docs/ai/execution-checklists/EC_INDEX.md` (EC-050 Draft → Done)
  - `docs/ai/STATUS.md` (PAR storage availability)
  - `docs/ai/post-mortems/01.6-WP-050-par-artifact-storage.md` (post-mortem — new file)

### Storage layout (locked)

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

- Two source-class roots (`seed/` and `sim/`) version independently.
- Shard: **first two characters of the scheme slug** (first component of `ScenarioKey` before the first `::` delimiter).
- Filename: `ScenarioKey` with `::` → `--` and `+` → `_`, suffixed `.json`.
- PAR version directories (`v1/`, `v2/`, ...) are immutable once published, per source class. Seed versions and simulation versions are independent — `seed/v1` is unrelated to `sim/v1`.

### `ParArtifactSource` (locked)

```ts
export type ParArtifactSource = 'seed' | 'simulation';
export const PAR_ARTIFACT_SOURCES: readonly ParArtifactSource[] = [
  'seed', 'simulation',
] as const;
```

- Drift test (test #6): `PAR_ARTIFACT_SOURCES.length === 2` AND array matches union exactly.
- Canonical ordering: `['seed', 'simulation']`. Do not reorder — tests and docs depend on this.

### `sourceClassRoot` (locked — single authoritative helper)

```ts
export function sourceClassRoot(
  basePath: string,
  source: ParArtifactSource,
  parVersion: string,
): string {
  const dirname = source === 'seed' ? 'seed' : 'sim';
  return `${basePath}/${dirname}/${parVersion}`;
}
```

- Single place that names `seed` / `sim` directory strings. No other function may concatenate these strings — enforced by convention (no grep gate, but reviewers check).
- `// why:` one helper keeps the `seed/` vs `sim/` directory name locked; avoids typos like `simulation/` or `seeded/`.

### `SeedParArtifact` (locked shape — WP-050 §A verbatim)

```ts
export interface SeedParArtifact {
  readonly scenarioKey: ScenarioKey;
  readonly source: 'seed';
  readonly parBaseline: ParBaseline;
  readonly parValue: number;
  readonly scoring: {
    readonly scoringConfigVersion: number;
    readonly rawScoreSemanticsVersion: number;
  };
  readonly authoredAt: string;
  readonly authoredBy: string;
  readonly rationale: string;
  readonly artifactHash: string;
}
```

### `SimulationParArtifact` (locked shape)

```ts
export interface SimulationParArtifact {
  readonly scenarioKey: ScenarioKey;
  readonly source: 'simulation';
  readonly parValue: number;
  readonly percentileUsed: number;
  readonly sampleSize: number;
  readonly generatedAt: string;
  readonly simulation: {
    readonly policyTier: 'T2';
    readonly policyVersion: string;
    readonly seedSetHash: string;
  };
  readonly scoring: {
    readonly scoringConfigVersion: number;
    readonly rawScoreSemanticsVersion: number;
  };
  readonly artifactHash: string;
}
```

### `ParIndex` (locked shape — load-bearing for WP-051)

```ts
export interface ParIndex {
  readonly parVersion: string;
  readonly source: ParArtifactSource;
  readonly generatedAt: string;
  readonly scenarioCount: number;
  readonly scenarios: Readonly<Record<ScenarioKey, {
    readonly path: string;
    readonly parValue: number;
    readonly artifactHash: string;
  }>>;
}
```

- `source` field at the top is **redundant with the directory path but REQUIRED and validated**. Prevents silent cross-class file moves.
- `scenarios` map keys sorted alphabetically on write.
- Value-side `artifactHash` must exactly equal the artifact's internal `artifactHash`.
- Value-side `parValue` must exactly equal the artifact's `parValue`.

### `ParResolution` (locked — load-bearing for WP-051)

```ts
export interface ParResolution {
  readonly source: ParArtifactSource;
  readonly parValue: number;
  readonly path: string;
  readonly indexPath: string;
}
```

### `ParStoreReadError` (locked)

```ts
export class ParStoreReadError extends Error {
  readonly name = 'ParStoreReadError';
  constructor(message: string) {
    super(message);
  }
}
```

- Thrown only on malformed / truncated / hash-mismatched file reads. **Not** thrown on "file not found" — that case is expressed by `null` return.
- Error messages are full sentences per code-style Rule 11.

### Canonical serialization rules (locked)

- UTF-8 encoding
- JSON object keys sorted lexicographically (use a canonical serializer; do NOT rely on `JSON.stringify(obj, null, 2)` key order)
- No whitespace significance (final serializer output may use `\n` as record separator but keys must be sorted)
- No comments, no trailing commas
- Identical rules for both source classes

Recommended implementation: walk the object, produce a new object with sorted keys (recursively for nested objects), then `JSON.stringify(sortedObj)`. Or use a pure `canonicalJsonStringify` helper. Lock the choice in DECISIONS.md.

### `artifactHash` (locked)

```
artifactHash = 'sha256:' + toHex(sha256(canonicalJson(artifact \ { artifactHash })))
```

- SHA-256 via `node:crypto.createHash('sha256')`. Node built-in; no external crypto library.
- Self-hash **exclusion**: the hash is computed over the canonical JSON of the artifact **with `artifactHash` removed**. After hashing, `artifactHash` is embedded into the artifact, THEN the full (with-hash) artifact is written to disk.
- Any change to any non-`artifactHash` field produces a different hash.
- Missing `artifactHash` OR hash mismatch = artifact is corrupt and non-publishable. `validateParStore` flags this.
- `// why:` self-hash exclusion avoids circular dependency; without it, the hash would depend on itself.
- `// why:` `node:crypto` is a Node built-in, not an external dependency — D-3601's "no crypto libraries" rule was scoped to seed-set hashing (djb2 suffices there). SHA-256 for tamper detection is a distinct concern and uses the built-in module exclusively.

### Resolution rule (locked — `resolveParForScenario`)

For a given `ScenarioKey` + base path + PAR version:
1. Load `sim/{parVersion}/index.json`; if it contains `scenarioKey`, return `{ source: 'simulation', parValue, path, indexPath }`.
2. Else load `seed/{parVersion}/index.json`; if it contains `scenarioKey`, return `{ source: 'seed', parValue, path, indexPath }`.
3. Else return `null`.

- **Never silently falls through on IO errors.** Missing index files are treated as "class has no coverage" (step 2 proceeds). But truncated / malformed / hash-mismatched indices throw `ParStoreReadError`. Test #29 asserts this.
- The simulation-over-seed precedence rule is locked. Do NOT reorder. Do NOT allow the caller to override precedence (no optional `preferSource` parameter).
- `// why:` preferring simulation over seed matches the three-phase PAR derivation pipeline — seed gives day-one coverage; simulation supersedes it once calibrated. Both preserved on disk for historical leaderboard explainability.

### `writeSeedParArtifact` signature (locked — PS-5)

```ts
export async function writeSeedParArtifact(
  artifact: SeedParArtifact,
  scoringConfig: ScenarioScoringConfig,
  basePath: string,
  parVersion: string,
): Promise<string>;
```

- Caller provides the artifact **except** `artifactHash` (a caller-supplied hash is ignored — writer always computes).
- `scoringConfig` parameter required for `parValue` consistency validation.
- Returns the relative path of the written file.

### `writeSimulationParArtifact` signature (locked)

```ts
export async function writeSimulationParArtifact(
  result: ParSimulationResult,
  basePath: string,
  parVersion: string,
): Promise<string>;
```

- Builds a `SimulationParArtifact` from the `ParSimulationResult` + the `policyTier: 'T2'` guard + the locked `rawScoreSemanticsVersion` from config (caller-extracted).

### Overwrite refusal (locked)

Both writers **refuse overwrite**. If the target file already exists:
- Check with `fs.access` (or equivalent); if the file exists, throw an `Error` (not `ParStoreReadError` — that's read-only).
- Error message: full sentence naming the path + the rule ("PAR artifacts are immutable once written; create a new version directory instead of overwriting").
- No `fs.rm`, no `fs.truncate`, no `fs.rename`-over-existing anywhere in the writer code path.
- `// why:` immutability enforced at write time, not just convention.

### Atomic index write (locked)

`buildParIndex` writes the index file atomically:
1. Serialize index with sorted `scenarios` keys.
2. Write to temp file: `{indexPath}.tmp.{randomSuffix}` — but NOTE: "randomSuffix" must be deterministic or from a seeded source to preserve determinism guarantees. Alternative: `{indexPath}.tmp` + check-and-fail if the tmp file exists (then the caller retries). Lock choice in DECISIONS.md; prefer `fs.rename` over an existing `.tmp` file since the second write would overwrite an orphaned tmp — acceptable because the content is the same atomic-write target anyway.
3. Rename temp file to final path via `fs.rename`.
4. If the final file already exists AND the caller is regenerating the index from the same set of artifacts, `fs.rename` overwrite is acceptable at the final-name level (indices are not immutable artifacts — only the scenario artifact files are).

Wait — **correction**: `buildParIndex` may overwrite an existing `index.json` if the scenarios set changes (adding a new artifact). Indices are regenerable. What's immutable is **individual artifact files**, not the index. This is different from artifact overwrite semantics. Lock this distinction in DECISIONS.md.

- `// why:` atomic write prevents partial index reads during regeneration.
- `// why:` the index is NOT an immutable artifact; artifacts are immutable but indices are regenerated whenever the artifact set changes.

### Determinism (locked)

- Same `SeedParArtifact` input (excluding `artifactHash`) = byte-identical serialized file.
- Same `ParSimulationResult` input = byte-identical serialized file.
- Same set of artifacts per class × version = byte-identical `index.json`.
- Tests assert byte-identity via `await fs.readFile(path, 'utf8')` comparison (#9 sim, equivalent for seed and index).

### Failure semantics (per-function — locked, MUST match EC-050)

| Function | Throws? | Returns on invalid input |
|---|---|---|
| `scenarioKeyToFilename` | No | Pure transform; no validation |
| `scenarioKeyToShard` | No | Pure transform; no validation |
| `sourceClassRoot` | No | Pure path concat |
| `computeArtifactHash` | No | Pure hash |
| `writeSeedParArtifact` | **Yes** — `Error` on overwrite attempt, `Error` on parValue/parBaseline inconsistency | — |
| `writeSimulationParArtifact` | **Yes** — `Error` on overwrite attempt, `Error` on non-T2 `policyTier` | — |
| `readSeedParArtifact` | `ParStoreReadError` on malformed content only; returns `null` on file-not-found | `null` |
| `readSimulationParArtifact` | `ParStoreReadError` on malformed content only; returns `null` on file-not-found | `null` |
| `buildParIndex` | **Yes** — `Error` on directory-not-found, `ParStoreReadError` on any malformed artifact inside | — |
| `lookupParFromIndex` | No | `null` when scenario not in index |
| `resolveParForScenario` | `ParStoreReadError` on malformed index; never falls through silently | `null` when neither class covers |
| `validateParStore` | No | Structured `ParStoreValidationResult` with issues |
| `validateParStoreCoverage` | No | Structured `ParCoverageResult` |

Error messages are full sentences per code-style Rule 11.

---

## Hard Stops (Stop Immediately If Any Occur)

- Any `import ... from 'boardgame.io'` in any new file
- Any `import ... from '@legendary-arena/registry'` in any new file
- Any `import ... from 'node:fs'` (synchronous) or `import ... from 'node:net'` / `node:http` / `node:https` / `node:child_process` / `node:dns` in any new file
- Any `import ... from 'node:fs/promises'` OUTSIDE of `par.storage.ts` or `par.storage.test.ts` (D-5001 carve-out boundary)
- Any modification to WP-036 / WP-048 / WP-049 contract files (see §Pre-Session Gates step 5)
- Any `.reduce()` with branching
- Any `Math.random()` in any new file
- Any `require()` in any file
- Any modification to gameplay logic (moves, phases, hooks, rules, endgame, turn, villainDeck)
- Any modification to `game.ts`, `buildInitialGameState`, `buildUIState`, `filterUIStateForAudience`
- Any new G fields, moves, phases, stages, or trigger names
- Any modification to `FinalScoreSummary`, `ParSimulationResult`, `ParBaseline`, `ScenarioScoringConfig`, or any WP-036/WP-048/WP-049 type
- Any attempt to overwrite an existing artifact file (writers MUST refuse)
- Any test that reads artifact `parValue` by recomputing from baseline instead of reading the stored value
- Any `JSON.stringify` without canonical sorted-key serialization for artifact / index writes
- Any external crypto dependency (npm `crypto-js`, `sha.js`, etc.) — use `node:crypto` exclusively
- Any expansion of scope beyond WP-050 (no "while I'm here" improvements)

---

## AI Agent Warning (Strict)

PAR artifact storage is **persistent trust substrate**. It does NOT participate in live gameplay. AI is tooling, not gameplay (D-0701). Artifacts are immutable once published — every calibration update produces a new version directory (D-5001 + §26 PAR immutability).

**Do NOT:**
- Modify any gameplay logic, WP-036 / WP-048 / WP-049 contract files
- Use `Math.random()` in any new file
- Use external crypto libraries — only `node:crypto`
- Use `.reduce()` with branching
- Overwrite an existing artifact file under any circumstance (writers throw)
- Generate non-deterministic output (timestamps in filenames, random shards, unstable key orders)
- Access the filesystem from any simulation file OTHER than `par.storage.ts` / `par.storage.test.ts`
- Store `ParIndex`, `ParArtifact`, or any `node:fs` handle in `G`
- Call any storage function from `game.ts`, moves, phase hooks, or engine runtime code
- Use `fs.readFileSync` / `fs.writeFileSync` in production code (tests may; prod uses `node:fs/promises`)

**Instead:**
- Consume `ParSimulationResult` verbatim — every field name in WP-049's export is load-bearing
- Use `node:fs/promises` (await) for production IO
- Use `node:crypto.createHash('sha256')` for `artifactHash`
- Use `node:path.join` or template literals with forward slashes for path construction; normalize to POSIX forward-slash paths in stored `path` values
- Sort object keys recursively before serialization — the canonical serializer is an explicit helper function in `par.storage.ts`
- Refuse overwrite by checking existence first, then throwing with a full-sentence error
- Write indices atomically via temp-file + `fs.rename`
- Use `for...of` everywhere; never `.reduce()` with branching
- When reading an index, validate every entry's `artifactHash` matches the artifact's internal hash before returning success

---

## Implementation Tasks (Authoritative)

### A) Create `packages/game-engine/src/simulation/par.storage.ts` (new)

**Imports (allowed):**

```ts
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs/promises';
import { dirname, join, posix } from 'node:path';

import type { ScenarioKey, ParBaseline, ScenarioScoringConfig } from '../scoring/parScoring.types.js';
import type { ParSimulationResult } from './par.aggregator.js';
import type { AIPolicyTier } from './ai.tiers.js';

import { computeParScore } from '../scoring/parScoring.logic.js';
import { AI_POLICY_TIER_DEFINITIONS } from './ai.tiers.js';
```

**Forbidden imports:** `boardgame.io`, `@legendary-arena/registry`, `node:fs` (sync), `node:net`, `node:http`, `node:child_process`.

**Exports (functions):**

- `scenarioKeyToFilename(scenarioKey: ScenarioKey): string`
- `scenarioKeyToShard(scenarioKey: ScenarioKey): string`
- `sourceClassRoot(basePath: string, source: ParArtifactSource, parVersion: string): string`
- `computeArtifactHash(artifact: Record<string, unknown>): string`
- `writeSimulationParArtifact(result: ParSimulationResult, basePath: string, parVersion: string): Promise<string>`
- `readSimulationParArtifact(scenarioKey: ScenarioKey, basePath: string, parVersion: string): Promise<SimulationParArtifact | null>`
- `writeSeedParArtifact(artifact: SeedParArtifact, scoringConfig: ScenarioScoringConfig, basePath: string, parVersion: string): Promise<string>`
- `readSeedParArtifact(scenarioKey: ScenarioKey, basePath: string, parVersion: string): Promise<SeedParArtifact | null>`
- `buildParIndex(basePath: string, source: ParArtifactSource, parVersion: string): Promise<ParIndex>`
- `lookupParFromIndex(index: ParIndex, scenarioKey: ScenarioKey): { path: string; parValue: number } | null`
- `resolveParForScenario(scenarioKey: ScenarioKey, basePath: string, parVersion: string): Promise<ParResolution | null>`
- `validateParStore(basePath: string, source: ParArtifactSource, parVersion: string): Promise<ParStoreValidationResult>`
- `validateParStoreCoverage(basePath: string, parVersion: string, expectedScenarios: readonly ScenarioKey[]): Promise<ParCoverageResult>`

**Exports (types):**

- `ParArtifactSource`, `PAR_ARTIFACT_SOURCES`, `SeedParArtifact`, `SimulationParArtifact`, `ParArtifact`, `ParResolution`, `ParIndex`, `ParStorageConfig`, `ParStoreValidationResult`, `ParStoreValidationError`, `ParCoverageResult`, `ParStoreReadError`

**Internal helpers (do NOT export):**

- `canonicalJsonStringify(value: unknown): string` — recursively sorts object keys before stringifying; deterministic output.
- `ensureDirectoryExists(path: string): Promise<void>` — idempotent `mkdir -p` wrapper.
- `fileExists(path: string): Promise<boolean>` — wraps `access` + `ENOENT` catch.
- `buildSimulationArtifactFromResult(result: ParSimulationResult): SimulationParArtifact` — maps WP-049 result → artifact. Policy tier guard: looks up `AI_POLICY_TIER_DEFINITIONS` for the `usedForPar: true` entry and asserts its `tier === 'T2'`. If not, throws.
- `computeExpectedSeedParValue(parBaseline: ParBaseline, scoringConfig: ScenarioScoringConfig): number` — builds a synthetic `ScenarioScoringConfig` with the caller's baseline, calls `computeParScore`. Used by `writeSeedParArtifact` for consistency check.

**JSDoc "Forbidden behaviors" block** on every exported function. No caching, no memoization, no retained state. `computeArtifactHash` is pure; writers/readers perform IO.

### B) Create `packages/game-engine/src/simulation/par.storage.test.ts` (new — 34 tests)

Structure:

```ts
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  scenarioKeyToFilename,
  scenarioKeyToShard,
  sourceClassRoot,
  computeArtifactHash,
  writeSimulationParArtifact,
  readSimulationParArtifact,
  writeSeedParArtifact,
  readSeedParArtifact,
  buildParIndex,
  lookupParFromIndex,
  resolveParForScenario,
  validateParStore,
  validateParStoreCoverage,
  ParStoreReadError,
  PAR_ARTIFACT_SOURCES,
  type ParArtifactSource,
  type SeedParArtifact,
  type SimulationParArtifact,
  type ParIndex,
} from '../index.js';

describe('PAR artifact storage (WP-050)', () => {
  // Path helpers (6)
  test('scenarioKeyToFilename replaces :: with -- and + with _', () => { /* ... */ });
  test('scenarioKeyToFilename is deterministic (same key = same filename)', () => { /* ... */ });
  test('scenarioKeyToShard extracts first two chars of scheme slug', () => { /* ... */ });
  test('sourceClassRoot returns {basePath}/seed/{v} for source "seed"', () => { /* ... */ });
  test('sourceClassRoot returns {basePath}/sim/{v} for source "simulation"', () => { /* ... */ });
  test('PAR_ARTIFACT_SOURCES matches ParArtifactSource union (drift detection)', () => { /* ... */ });

  // Simulation artifact I/O (7)
  test('writeSimulationParArtifact creates file at sim/{v}/scenarios/{shard}/', async () => { /* ... */ });
  test('writeSimulationParArtifact produces sorted-key JSON (deterministic)', async () => { /* ... */ });
  test('writeSimulationParArtifact twice with identical input produces byte-identical file content', async () => { /* ... */ });
  test('writeSimulationParArtifact refuses overwrite (throws on existing file)', async () => { /* ... */ });
  test('readSimulationParArtifact returns the written artifact', async () => { /* ... */ });
  test('readSimulationParArtifact returns null for non-existent scenario', async () => { /* ... */ });
  test('written simulation artifact carries source: "simulation" verbatim', async () => { /* ... */ });

  // Seed artifact I/O (7)
  test('writeSeedParArtifact creates file at seed/{v}/scenarios/{shard}/', async () => { /* ... */ });
  test('writeSeedParArtifact embeds artifactHash even when caller omits it (hash computed by writer)', async () => { /* ... */ });
  test('writeSeedParArtifact refuses overwrite (throws on existing file)', async () => { /* ... */ });
  test('writeSeedParArtifact rejects artifact whose parValue disagrees with parBaseline under scoringConfig', async () => { /* ... */ });
  test('readSeedParArtifact returns the written artifact', async () => { /* ... */ });
  test('readSeedParArtifact returns null for non-existent scenario', async () => { /* ... */ });
  test('written seed artifact carries source: "seed" and all four parBaseline fields round-trip unchanged', async () => { /* ... */ });

  // Index building and lookup (4)
  test('buildParIndex("seed") and buildParIndex("simulation") build independent indices with correct source stamps', async () => { /* ... */ });
  test('index scenarios keys are sorted alphabetically (both classes)', async () => { /* ... */ });
  test('index includes artifactHash for each scenario', async () => { /* ... */ });
  test('lookupParFromIndex finds existing scenario; returns null otherwise', async () => { /* ... */ });

  // Cross-class resolver (5)
  test('resolveParForScenario returns sim when only sim exists', async () => { /* ... */ });
  test('resolveParForScenario returns seed when only seed exists', async () => { /* ... */ });
  test('resolveParForScenario returns sim when both exist (precedence rule)', async () => { /* ... */ });
  test('resolveParForScenario returns null when neither exists', async () => { /* ... */ });
  test('resolveParForScenario throws ParStoreReadError on malformed or truncated index (does not fall through)', async () => { /* ... */ });

  // Store validation (4)
  test('validateParStore("simulation") passes for a valid sim store', async () => { /* ... */ });
  test('validateParStore("simulation") flags non-T2 artifact as not publishable', async () => { /* ... */ });
  test('validateParStore("seed") flags artifact whose source field is "simulation" but lives under seed/', async () => { /* ... */ });
  test('validateParStoreCoverage reports seed-only, sim-covered, and missing scenarios; missingCount matches missing.length', async () => { /* ... */ });

  // Hashing (1)
  test('computeArtifactHash produces identical hash for different key insertion order; changes when any non-hash field changes', () => { /* ... */ });
});
```

Exactly **34 tests in 1 `describe` block** → +1 suite. Tests use `mkdtemp(join(tmpdir(), 'par-storage-'))` for isolation; every `describe`-level test cleans up via a `test.after` or inline `await rm(dir, { recursive: true })`.

### C) Modify `packages/game-engine/src/types.ts`

Append PAR storage type re-exports at the end of the file:

```ts
// why: PAR artifact storage types (WP-050) ship the immutable artifact
// + index layer. Pure types and the error class live in par.storage.ts.
// Re-exported here so consumers importing from './types.js' have access
// to the full PAR storage surface.
export type {
  ParArtifactSource,
  SeedParArtifact,
  SimulationParArtifact,
  ParArtifact,
  ParResolution,
  ParIndex,
  ParStorageConfig,
  ParStoreValidationResult,
  ParStoreValidationError,
  ParCoverageResult,
} from './simulation/par.storage.js';
```

Do NOT add any other modification. Do NOT reorder existing exports.

### D) Modify `packages/game-engine/src/index.ts`

Add the public PAR storage API:

```ts
// PAR artifact storage (WP-050 / D-5001)
export {
  scenarioKeyToFilename,
  scenarioKeyToShard,
  sourceClassRoot,
  computeArtifactHash,
  writeSimulationParArtifact,
  readSimulationParArtifact,
  writeSeedParArtifact,
  readSeedParArtifact,
  buildParIndex,
  lookupParFromIndex,
  resolveParForScenario,
  validateParStore,
  validateParStoreCoverage,
  ParStoreReadError,
  PAR_ARTIFACT_SOURCES,
} from './simulation/par.storage.js';
export type {
  ParArtifactSource,
  SeedParArtifact,
  SimulationParArtifact,
  ParArtifact,
  ParResolution,
  ParIndex,
  ParStorageConfig,
  ParStoreValidationResult,
  ParStoreValidationError,
  ParCoverageResult,
} from './simulation/par.storage.js';
```

Type re-exports also go through `types.ts` (task C); do NOT duplicate types across the two export surfaces beyond what the WP-049 pattern already does (some types appear in both — intentional).

### E) Modify `docs/ai/DECISIONS.md`

Append (new) decisions covering at minimum:

- **D-5002 — Two source classes (seed + simulation) instead of one mixed directory.** Why: Phase 1 content-authored seed PAR and Phase 2 simulation-calibrated PAR have different field shapes, different provenance requirements, and different immutability semantics; mixing them in one directory would force union-type reads everywhere and obscure which PAR a scenario is using.
- **D-5003 — Simulation-over-seed precedence is locked in a single resolver.** Why: allowing callers to encode their own precedence would produce inconsistent leaderboard gate behavior. `resolveParForScenario` is the only sanctioned cross-class reader.
- **D-5004 — File-based, not database.** Why: PAR artifacts are ship-once, read-many data. Filesystem layout works on local disk, R2/S3, or CDN without schema migration overhead. The layout is portable to any object store.
- **D-5005 — Sharding by scheme slug prefix (2 chars).** Why: prevents single-directory bloat at 10k–100k scenarios. Deterministic, no hash-based sharding (hash-based would hurt content addressability). The first two characters of the scheme slug provide reasonable spread without over-engineering.
- **D-5006 — Sorted-key JSON serialization for determinism.** Why: default `JSON.stringify` preserves insertion order, which is non-deterministic across code paths. A canonical sorted-key serializer is the correctness contract for "same input = same bytes".
- **D-5007 — Atomic index writes via temp + rename.** Why: a partial index read during a concurrent write would show a truncated or malformed file. Temp + rename makes index updates atomic at the filesystem level. Indices themselves are not immutable — they regenerate as artifacts are added.
- **D-5008 — Overwrite refusal as immutability enforcement.** Why: immutability as convention is fragile; enforcing it at the write layer (refuse to overwrite an existing artifact file) catches both accidental and intentional violations before they hit disk.
- **D-5009 — SHA-256 `artifactHash` via `node:crypto` for tamper detection.** Why: `node:crypto` is a Node built-in — not an external dependency. SHA-256 over canonical JSON gives a stable integrity proof; self-hash exclusion avoids circular dependency. D-3601's "no crypto libraries" rule was scoped to seed-set hashing where djb2 sufficed; tamper detection is a different concern.
- **D-5010 — Non-T2 policy tier guard on simulation artifacts.** Why: `AI_POLICY_TIER_DEFINITIONS` pins T2 as the only publishable tier. Writers reject non-T2 simulation inputs before disk writes — catches authoring errors at the earliest boundary.

Each decision gets a `D-NNNN` identifier. Check DECISIONS.md head for the next available ID (expected D-5002 and onward; D-5001 was used by the A0 bundle for the IO carve-out).

---

## Scope Lock (Authoritative)

### Commit A (EC-050) — exactly 5 files

- `packages/game-engine/src/simulation/par.storage.ts` — NEW
- `packages/game-engine/src/simulation/par.storage.test.ts` — NEW
- `packages/game-engine/src/types.ts` — MODIFIED (type re-exports only; no other changes)
- `packages/game-engine/src/index.ts` — MODIFIED (add public API exports; no other changes)
- `docs/ai/DECISIONS.md` — MODIFIED (new PAR storage decisions D-5002..D-5010)

### Commit B (SPEC) — exactly 4 files

- `docs/ai/work-packets/WORK_INDEX.md` — flip WP-050 `[ ]` → `[x]` with date + Commit A hash
- `docs/ai/execution-checklists/EC_INDEX.md` — flip EC-050 Draft → Done
- `docs/ai/STATUS.md` — record PAR storage availability
- `docs/ai/post-mortems/01.6-WP-050-par-artifact-storage.md` — NEW post-mortem file (mandatory per 01.6)

### Files explicitly forbidden to touch

- Any file under `packages/game-engine/src/` NOT listed above
- Any simulation file other than the two new ones (WP-036 + WP-049 contracts immutable)
- Any scoring file (WP-048 contracts immutable)
- Any engine gameplay / phase / turn / move / rule / endgame / UI / replay / invariants file
- `packages/game-engine/src/test/mockCtx.ts` — immutable shared helper
- `packages/game-engine/src/matchSetup.types.ts` / `matchSetup.validate.ts` — immutable upstream contract
- `packages/registry/**`, `packages/preplan/**`, `apps/**`
- `package.json`, `pnpm-lock.yaml`, `tsconfig*.json`, `.claude/rules/**`, `docs/ai/REFERENCE/**`

If the implementation uncovers a structural problem requiring any of these files, **STOP and escalate** — do not force-fit under 01.5 (NOT INVOKED).

---

## Verification Steps

Run after Commit A is drafted but BEFORE committing. All must pass.

### Build + test

```bash
pnpm --filter @legendary-arena/game-engine build
# Expected: exit 0

pnpm -r test
# Expected: exit 0; 657 tests / 126 suites / 0 fail total.
# game-engine specifically: 505 / 113 / 0.
```

### Layer-boundary grep gates

```bash
grep -nE "from ['\"]boardgame\.io" packages/game-engine/src/simulation/par.storage.ts packages/game-engine/src/simulation/par.storage.test.ts
# Expected: no output.

grep -nE "from ['\"]@legendary-arena/registry" packages/game-engine/src/simulation/par.storage.ts
# Expected: no output.

grep -nE "Math\.random" packages/game-engine/src/simulation/par.storage.ts packages/game-engine/src/simulation/par.storage.test.ts
# Expected: no output.

grep -nE "\.reduce\(" packages/game-engine/src/simulation/par.storage.ts
# Expected: no output (simple accumulation uses for...of).

grep -nE "require\(" packages/game-engine/src/simulation/par.storage.ts packages/game-engine/src/simulation/par.storage.test.ts
# Expected: no output.
```

### D-5001 carve-out boundary gate

```bash
grep -rnE "from ['\"]node:fs" packages/game-engine/src/simulation/ --include="*.ts" | grep -vE "(par\.storage\.ts|par\.storage\.test\.ts)"
# Expected: no output. (Filesystem IO confined to the two carve-out files.)
```

### Upstream contract integrity

```bash
git diff main -- packages/game-engine/src/simulation/ai.types.ts \
                 packages/game-engine/src/simulation/ai.random.ts \
                 packages/game-engine/src/simulation/ai.legalMoves.ts \
                 packages/game-engine/src/simulation/simulation.runner.ts \
                 packages/game-engine/src/simulation/simulation.test.ts \
                 packages/game-engine/src/simulation/ai.competent.ts \
                 packages/game-engine/src/simulation/ai.competent.test.ts \
                 packages/game-engine/src/simulation/ai.tiers.ts \
                 packages/game-engine/src/simulation/par.aggregator.ts \
                 packages/game-engine/src/simulation/par.aggregator.test.ts \
                 packages/game-engine/src/scoring/parScoring.types.ts \
                 packages/game-engine/src/scoring/parScoring.logic.ts \
                 packages/game-engine/src/scoring/parScoring.keys.ts
# Expected: no output.
```

### `// why:` comment completeness

```bash
grep -c "// why:" packages/game-engine/src/simulation/par.storage.ts
# Expected: >= 10 (sourceClassRoot, computeArtifactHash self-hash, overwrite refusal,
# sorted keys, atomic index, validateParStore no-repair, simulation-over-seed
# precedence, node:crypto vs external crypto, shard strategy, canonical serialization)
```

### Scope lock — only expected files changed

```bash
git diff --name-only main | sort
# Expected for Commit A (exactly 5 lines):
#   docs/ai/DECISIONS.md
#   packages/game-engine/src/index.ts
#   packages/game-engine/src/simulation/par.storage.test.ts
#   packages/game-engine/src/simulation/par.storage.ts
#   packages/game-engine/src/types.ts
```

### Suite count discipline (P6-54)

```bash
pnpm --filter @legendary-arena/game-engine test 2>&1 | grep "ℹ suites"
# Expected: "ℹ suites 113" — exactly +1 from baseline 112.
```

If the suite count is 112 or 114, the test file is missing or has an extra `describe()` wrapper.

### Deterministic serialization proof

Manual spot-check: run the byte-identity tests (#9 sim, equivalent for seed and index) and confirm the files on disk are truly byte-identical (`diff -q file1 file2` exits 0).

---

## Definition of Done

Every item below MUST be true before Commit A is committed:

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm -r test` exits 0 with `657 / 126 / 0` total; `505 / 113 / 0` for game-engine
- [ ] All 34 storage tests pass (6 path + 7 sim I/O + 7 seed I/O + 4 index + 5 resolver + 4 validation + 1 hashing)
- [ ] Every test file uses `.test.ts`
- [ ] No `boardgame.io` / `@legendary-arena/registry` imports in any new file
- [ ] No `Math.random()`, `.reduce()` with branching, or `require()` in any new file
- [ ] `node:fs` / `node:fs/promises` appears ONLY in `par.storage.ts` and `par.storage.test.ts` (D-5001 carve-out boundary)
- [ ] No engine gameplay / upstream contract files modified (git-diff-verified)
- [ ] `writeSeedParArtifact` signature includes `scoringConfig: ScenarioScoringConfig` parameter (PS-5)
- [ ] `writeSimulationParArtifact` and `writeSeedParArtifact` refuse overwrite (tests #10 and #16)
- [ ] `artifactHash` computed via `node:crypto` SHA-256 with self-hash exclusion (test #34)
- [ ] `resolveParForScenario` applies simulation-over-seed precedence (test #27)
- [ ] `PAR_ARTIFACT_SOURCES` drift test passes (test #6)
- [ ] `validateParStore('simulation')` flags non-T2 artifacts (test #31)
- [ ] Byte-identical serialization proven by `writeSimulationParArtifact` twice (test #9) and equivalent seed reproducibility
- [ ] `docs/ai/DECISIONS.md` contains D-5002 through D-5010 (9 new entries)
- [ ] Post-mortem written at `docs/ai/post-mortems/01.6-WP-050-par-artifact-storage.md` covering all 7 mandatory checks (pre-Commit B)
- [ ] Commit A subject line starts with `EC-050:`; Commit B subject line starts with `SPEC:`

---

## Final Instruction

WP-050 is the moment PAR becomes persistent — the substrate that WP-051 (server publication gate) and WP-054 (public leaderboards) depend on for their correctness claims. Every constraint in this prompt — the sorted-key canonical serialization, the SHA-256 tamper detection, the overwrite refusal as immutability enforcement, the locked `sim/` vs `seed/` directory names, the single-resolver precedence rule, the D-5001 IO carve-out boundary — exists to make PAR artifacts trustworthy enough to gate leaderboard entries. If any constraint feels tedious: re-read the pre-flight (§PS-2 carve-out rationale) and the Vision §26 PAR immutability clause. The tedium is the point.

If anything is unclear, STOP and ask. Do not guess.
