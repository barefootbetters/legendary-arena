# Pre-Commit Review — WP-053a / EC-053a

**Work Packet ID:** WP-053a
**EC ID:** EC-053a
**Reviewer:** Claude Code (self-review under EC-mode pre-commit gate)
**Date:** 2026-04-25
**Branch:** `wp-053a-par-artifact-scoring-config`

---

## Executive Verdict (Binary)

**Safe to commit as-is.**

The implementation extends the PAR artifact format end-to-end so that
`ScenarioScoringConfig` flows from publication through `checkParPublished`
as one atomic tuple, exactly as WP-053a §Goal and EC-053a §Locked Values
specify. All eleven files in the EC §Files to Produce allowlist were
modified or added; no file outside the allowlist has any diff against
`main`. Test counts match the PS-5 lock exactly (engine `522/116/0`,
server `38/6/0`); zero forbidden APIs landed; the D-5103 fs-free gate
invariant is preserved by direct grep verification. The packet is
ready for the two-commit topology defined in EC-053a §Commit topology.

---

## Review Axis Assessment

### 1. Scope Discipline — **Pass**

Every modified file appears in EC-053a §Files to Produce. `git diff
--name-only main` shows exactly the eleven expected files (six modified,
five new — README + example JSON + scoringConfigLoader.ts +
scoringConfigLoader.test.ts + the directory). No engine gameplay file,
no replay file, no identity file, no migration, no UI app, no
boardgame.io wiring file appears in the diff. PS-3's "aggregator
UNCHANGED" lock is honored: `git diff main -- packages/game-engine/src/
simulation/par.aggregator.ts` returns empty. The aggregator's existing
`ParSimulationConfig.scoringConfig` field (already on `main` per
pre-flight Finding 3.5) remains the input contract; the new sim-side
embed plumbing lives in `par.storage.ts`'s writer signature change, not
in the aggregator.

### 2. Contract & Type Correctness — **Pass**

- `loadScoringConfigForScenario` and `loadAllScoringConfigs` match the
  PS-2 signatures verbatim: async, return `Promise<…>`, throw on parse
  / validation failure.
- `SeedParArtifact`, `SimulationParArtifact`, and `ParIndex.scenarios[key]`
  each gain `readonly scoringConfig: ScenarioScoringConfig` per the
  locked verbatim shapes.
- `writeSimulationParArtifact(result, scoringConfig, basePath, parVersion)`
  takes `scoringConfig` as the third positional parameter, mirroring the
  existing `writeSeedParArtifact` four-param precedent (PS-3 lock).
- The three locked validator error type strings —
  `'scoring_config_invalid'`, `'scoring_config_version_mismatch'`,
  `'par_baseline_redundancy_drift'` — appear verbatim in the validator
  and the union test.
- `ParGateHit` JSDoc typedef gains `scoringConfig: ScenarioScoringConfig`
  as a non-optional fourth field; `checkParPublished` returns the
  matching four-field shape.
- `validateScoringConfig` is the SOLE structural validator — no
  re-implementation; the loader and validator both call through it.

### 3. Boundary Integrity — **Pass**

Direct grep verification confirms:

- `apps/server/src/par/parGate.mjs` does not import `node:fs` or any
  filesystem API (D-5103 fs-free invariant preserved).
- `apps/server/src/par/parGate.{mjs,test.ts}` do not import
  `scoringConfigLoader` (server consumes config exclusively through the
  in-memory index per D-5306b).
- `packages/game-engine/src/scoring/scoringConfigLoader.ts`,
  `packages/game-engine/src/simulation/par.storage.ts`, and
  `packages/game-engine/src/simulation/par.aggregator.ts` do not import
  `@legendary-arena/server` or `apps/server/**` (engine-to-server
  forbidden).
- No new `boardgame.io` import in any new file.
- No `Math.random` / `Date.now` / `require()` in any new file.
- The loader's namespace imports for `node:fs/promises` and `node:path`
  let Vite's externalization handle them as empty namespaces in browser
  builds; tree-shaking eliminates the unused module from arena-client's
  bundle while preserving full functionality in Node-side consumers.

### 4. Test Integrity — **Pass**

Test counts match the PS-5 lock byte-for-byte:

- Engine: `522 / 116 / 0` (baseline `513 / 115 / 0` plus +9 tests
  / +1 suite — +4 in the new `scoringConfigLoader.test.ts` wrapped in
  a fresh top-level `describe('scoringConfigLoader (WP-053a)', …)`
  block, +3 in `par.storage.test.ts`'s existing describe, +2 in
  `par.aggregator.test.ts`'s existing describe).
- Server: `38 / 6 / 0` (with 10 skipped under no-test-DB) — baseline
  `36 / 6 / 0` plus +2 tests in `parGate.test.ts`'s existing describe.

Tests are atomic and exercise the locked invariants:

- The 4 loader tests cover valid load, missing file, invalid JSON,
  validator rejection.
- The +3 par.storage.test.ts tests pin each new `errorType` string
  against its expected emission path.
- The +2 par.aggregator.test.ts tests verify verbatim embed and
  version-mismatch rejection through the writer.
- The +2 parGate.test.ts tests verify the `scoringConfig` return field
  on hits and the no-partially-armed-state contract.

Existing test fixtures were updated mechanically to include
`scoringConfig` on synthetic `SeedParArtifact` / `SimulationParArtifact` /
`ParIndex` shapes; no existing test was deleted or weakened. The
`createTestScoringConfig` factory in `par.storage.test.ts` had its
weights updated (bystanderReward: 50 → 400) so the embedded configs
satisfy `validateScoringConfig`'s structural invariants now that the
validator runs against them — pre-WP-053a the validator was never
called on these fixtures, so the under-spec'd factory worked
incidentally.

### 5. Runtime Boundary Check — **Pass (no allowlist exceptions)**

The 01.5 runtime wiring allowance was **NOT INVOKED** (declared up-front
in the session prompt and held throughout execution). Every modified
file appears in the EC-053a §Files to Produce allowlist:

- `data/scoring-configs/README.md` — new
- `data/scoring-configs/test-scheme-par--test-mastermind-par--test-villain-group-par.json` — new
- `packages/game-engine/src/scoring/scoringConfigLoader.ts` — new
- `packages/game-engine/src/scoring/scoringConfigLoader.test.ts` — new
- `packages/game-engine/src/simulation/par.storage.ts` — modified
- `packages/game-engine/src/simulation/par.storage.test.ts` — modified
- `packages/game-engine/src/simulation/par.aggregator.test.ts` — modified
  (par.aggregator.ts itself unchanged per PS-3)
- `packages/game-engine/src/index.ts` — modified (new exports)
- `apps/server/src/par/parGate.mjs` — modified
- `apps/server/src/par/parGate.test.ts` — modified

No file under `packages/registry/`, `packages/preplan/`,
`packages/vue-sfc-loader/`, `apps/arena-client/`, `apps/replay-producer/`,
`apps/registry-viewer/`, `apps/server/src/{server.mjs,index.mjs,rules/,
replay/,identity/,game/,scripts/}`, `apps/server/package.json`,
`data/migrations/`, `pnpm-lock.yaml`, root `package.json`, or
`tsconfig*.json` was modified.

### 6. Governance & EC-Mode Alignment — **Pass**

- D-5306, D-5306a, D-5306b, D-5306c, D-5306d are landed in
  `docs/ai/DECISIONS.md` (verified pre-execution).
- The A0 SPEC bundle landed at `eafe0ee`.
- EC-053a (`fec82fd`) is the primary execution authority and was
  consulted at every decision point.
- WP-053a (`c9ddbd1` post-tightening) is the design authority.
- Commit prefix discipline confirmed: Commit A will use `EC-053a:` per
  the commit-msg hook's allowed prefixes; `WP-053a:` is forbidden by
  the hook (P6-36).
- The unrelated WP-097/098/101 governance WIP was stashed pre-execution
  (Pre-Session Gate 13) and remains stashed; the topic branch
  `wp-053a-par-artifact-scoring-config` was cut from `main` after the
  stash (Pre-Session Gate 14).
- WP-103 §3.1 carry-forward pre-screen passed: no `// why:` comment
  text matches a Hard Stop grep substring (verified manually against
  the locked grep set; the `apps/server/**` mention in
  `scoringConfigLoader.ts` head comment uses backtick + asterisk
  bracketing and does not match the literal `from "apps/server"`
  grep pattern).
- WP-103 §3.2 carry-forward verified: the
  `skip: 'requires test database'` count remains unchanged from
  baseline (parGate.test.ts: 0; replay.logic.test.ts: 4).

---

## Optional Pre-Commit Nits (Non-Blocking)

- The loader uses namespace imports (`import * as fsPromises from
  'node:fs/promises'`) instead of named imports specifically to avoid a
  Vite browser-bundle bundling failure when arena-client transitively
  imports through the engine barrel. The pattern is documented in a
  `// why:` comment at the import site. A more architecturally clean
  long-term fix would be to expose the loader via a dedicated subpath
  in the engine package's `package.json#exports` so browser bundlers
  never see it; that cleanup is out of scope for WP-053a and would
  modify `packages/game-engine/package.json`, not in the EC allowlist.

- The gate's `assertEveryScenarioHasScoringConfig` guard is defense-
  in-depth: in practice the engine's `isParIndexShape` validator
  catches missing `scoringConfig` first, surfacing the failure as
  graceful per-class degradation rather than as the gate's own
  hard-throw. The +2 parGate.test.ts test for the no-partially-armed-
  state contract verifies the end-to-end behavior (zero coverage for
  the offending class) rather than the specific layer that catches.
  The post-mortem documents this layered defense.

---

## Explicit Deferrals (Correctly NOT in This WP)

- **WP-053 (`submitCompetitiveScore`):** the consumer of the new
  contract; lands separately. WP-053a is the predecessor that delivers
  D-5306 by extending the artifact format end-to-end.
- **`SeedParArtifact.parBaseline` removal:** retained one cycle per
  D-5306c with a `// why:` comment at the field site and a validator
  check (`'par_baseline_redundancy_drift'`) enforcing
  `parBaseline === scoringConfig.parBaseline`. A future cleanup WP
  collapses the redundancy.
- **HTTP / API surface for PAR publication:** out of scope per
  WP-053a §Out of Scope.
- **Authoring CLI changes:** the PAR aggregator (`generateScenarioPar`)
  is exported but has no production caller today (verified via
  Pre-Session Gate 11 grep). The future PAR-publishing CLI WP will
  pass `config.scoringConfig` through to `writeSimulationParArtifact`
  per the writer's new signature; that wiring is out of scope here.
- **`ScenarioScoringConfig` shape changes:** the type is locked at
  WP-048; WP-053a embeds the existing shape verbatim and does not
  modify the type definition.
- **`competitive_scores` schema simplification:** D-5306d retains both
  `par_version` and `scoring_config_version` as audit redundancy under
  Option A; the column-level review is informational and lands at
  WP-053, not WP-053a.
- **`Object.freeze()` defense-in-depth on returned configs:** the
  post-mortem's audit #4 documents this as a future option not
  implemented; the readonly TypeScript typing on `ScenarioScoringConfig`
  is the contract-level protection, with the post-mortem grep audit
  verifying no consumer mutates configs in-place.

---

## Commit Hygiene Recommendations

- **Commit A subject prefix:** `EC-053a:` (NOT `WP-053a:` — the
  commit-msg hook rejects `WP-NNN:` per P6-36).
- **Commit A subject body:** present-tense summary covering the
  contract extension end-to-end, e.g., "extend PAR artifact +
  validator + index + gate to carry full ScenarioScoringConfig".
- **Vision trailer on Commit A:** `Vision: §3, §22, §24` per the
  WP-053a §Vision Alignment section.
- **Commit B subject prefix:** `SPEC:` for the governance close
  (post-mortem + STATUS + WORK_INDEX + EC_INDEX + DECISIONS).
- **Stage by exact filename** only — `git add .` / `-A` / `-u` are
  forbidden per P6-27 / P6-44.
- **Pop the stashed WP-097/098/101 governance WIP** after Commit B
  lands (Pre-Session Gate 13 promised this rollback).

---

## Final Statement

WP-053a meets every locked value in EC-053a, every Acceptance Criterion
in the WP, and every Hard Stop discipline declared in the session
prompt. The implementation is contract-first, layer-respecting, and
deterministic. **Safe to commit as-is.**
