# WP-053a — PAR Artifact Carries Full `ScenarioScoringConfig` (Predecessor to WP-053)

**Status:** Drafted 2026-04-25; A0 SPEC bundle landing this WP + D-5306 + D-5306a/b/c/d
**Phase:** Server / PAR Contract Extension
**Hard-deps:** WP-048 (`ScenarioScoringConfig` type locked) + WP-049 (PAR aggregator) + WP-050 (PAR artifact storage) + WP-051 (server gate)
**Blocks:** WP-053
**Layer:** Engine + Server (PAR artifact format end-to-end)
**WP Class:** Contract extension — adds one field to a load-bearing artifact shape and threads it through the aggregator, storage validator, index, and server gate. Adds zero new gameplay logic.

> **Naming note:** Suffix `-a` follows the WP-007A / WP-007B precedent. Alternative numbering (a fresh number, e.g., WP-058) is acceptable if this should not present as a "split" of WP-053. Either way, this packet **must land before WP-053**.

---

## Why This Packet Matters

D-5306 chose Option A: bundle `ScenarioScoringConfig` into the PAR publication so config and PAR are structurally one unit, making drift between them impossible. WP-053's `submitCompetitiveScore` will consume `scoringConfig` directly from `checkParPublished` rather than from a separate catalog. This packet lands the contract change so WP-053 can execute.

**Without WP-053a:** WP-053 must pick Option B (server-loaded config catalog) and accept structural drift surface caught at flow step 12. Acceptable but suboptimal.

**With WP-053a:** WP-053's flow step 12 (`computeParScore(config) === parValue`) becomes defense-in-depth rather than a primary safety net. `parVersion` and `scoringConfigVersion` collapse to one truth (or stay redundant-by-design per D-5306d). "Server is enforcer, never derives" extends to *which config to use*, not just *how to compute*.

---

## Goal

After this session:

- Every PAR artifact (`SeedParArtifact` + `SimulationParArtifact`) carries the full `ScenarioScoringConfig` it was authored / calibrated against, validated structurally at write time.
- The `ParIndex` (loaded into the gate at server startup) carries the full config inline per scenario — preserving the gate's fs-free runtime invariant (D-5103).
- `checkParPublished(scenarioKey)` returns `{ parValue, parVersion, source, scoringConfig }`. The new field is non-optional; gates loaded from indices missing it fail closed at startup with a structured error.
- A new on-disk source `data/scoring-configs/<scenario_key>.json` is the canonical authoring origin for `ScenarioScoringConfig` instances. The PAR aggregator (seed + simulation) reads this directory and embeds the config into each artifact it produces.
- `validateParStore` is extended to verify (a) every artifact carries a structurally valid `scoringConfig` per `validateScoringConfig`, and (b) `scoringConfig.scoringConfigVersion === artifact.scoring.scoringConfigVersion` (no internal drift within an artifact).

**Invariant:** PAR is a publication of `(scenarioKey, parValue, scoringConfig)` as one unit. There is no path where any of the three exists without the other two.

---

## Assumes

- WP-049 complete — PAR simulation aggregator produces `ParSimulationResult`.
- WP-050 complete — PAR artifact storage with `SeedParArtifact` + `SimulationParArtifact` shapes; `validateParStore` exists.
- WP-051 complete — server gate `checkParPublished` returns `ParGateHit | null`.
- WP-048 complete — `ScenarioScoringConfig` type exported; `validateScoringConfig` exists.
- `pnpm -r build` exits 0; `pnpm test` exits 0 at the post-WP-103 baseline (engine `513/115/0`, server `36/6/0`).

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

- [packages/game-engine/src/simulation/par.storage.ts](../../../packages/game-engine/src/simulation/par.storage.ts) lines 75–156 — `SeedParArtifact`, `SimulationParArtifact`, `ParIndex` shapes.
- [packages/game-engine/src/scoring/parScoring.types.ts](../../../packages/game-engine/src/scoring/parScoring.types.ts) lines 145–166 — `ScenarioScoringConfig` interface (D-4805 self-contained).
- [apps/server/src/par/parGate.mjs](../../../apps/server/src/par/parGate.mjs) lines 30–52 — `ParGateHit` typedef + `ParGate` API (D-5103 fs-free at request time).
- [docs/ai/DECISIONS.md](../DECISIONS.md) — D-4805 (config self-contained), D-5001 (engine owns PAR validation), D-5101 (sim-over-seed precedence), D-5103 (fs-free gate), D-5306 (this packet's resolution), D-5306a/b/c/d (sub-decisions).
- [docs/12-SCORING-REFERENCE.md](../../12-SCORING-REFERENCE.md) — scoring formula and PAR model.
- [docs/13-REPLAYS-REFERENCE.md](../../13-REPLAYS-REFERENCE.md) §Community Scoreboard Integration — server is enforcer, never derives.

---

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- No `Math.random()` / `Date.now()` / wall-clock reads in any pure function.
- No `boardgame.io` import in scoring or PAR files.
- Pure helpers must remain pure; aggregator side-effects are limited to file writes when invoked from authoring CLIs.

**Packet-specific:**
- The gate must remain **fs-free at request time** (D-5103). Any new field on `ParIndex.scenarios[key]` must be loaded once at startup, never queried from disk during a `checkParPublished` call.
- The new `data/scoring-configs/<scenario_key>.json` source must be **load-once at aggregator/authoring time**, not at gate runtime. The server gate consumes the config exclusively via the in-memory `ParIndex` it received from the engine's loader.
- `validateScoringConfig` is the **sole structural validator** for embedded configs. Re-implementing validation in this packet is forbidden.
- Existing artifact files on disk (if any) must be regenerated, not migrated in place. PAR data is not yet present in `data/par/` (verified at session start), so this is a clean slate.

**Layer boundary:**
- `apps/server/src/par/parGate.mjs` may not gain knowledge of where configs live on disk. Configs flow into the gate only through the `ParIndex` produced by `loadParIndex` (engine).
- The engine may not import `apps/server/`. The new `data/scoring-configs/` directory is read by engine code; the server only sees the validated, in-memory result.

---

## Scope (In)

### A) `data/scoring-configs/<scenario_key>.json` — new directory + initial seed files

- One JSON file per scenario currently authored in the seed PAR set.
- Structurally a serialized `ScenarioScoringConfig`. Keys are alphabetically sorted on write (determinism contract — mirrors `ParIndex.scenarios` ordering).
- Initial content: at minimum, one example file per scenario covered by today's seed PAR authoring. If no seed scenarios exist yet, a single representative example is sufficient — the file proves the loader works; production files land as scenarios are authored.
- `// why:` documented in a sibling `data/scoring-configs/README.md`: this directory is the single authoring origin for `ScenarioScoringConfig`; PAR aggregator and seed artifact authoring scripts read from here; consumers (server gate, WP-053) never read from here directly — they get configs through PAR artifacts.

### B) `packages/game-engine/src/scoring/scoringConfigLoader.ts` — new

- `loadScoringConfigForScenario(scenarioKey: ScenarioKey, basePath: string): ScenarioScoringConfig` — pure function that reads `<basePath>/<scenario_key>.json`, parses, and validates via `validateScoringConfig`. Throws on parse failure or validation failure (this is authoring-time / startup-time code; throwing is appropriate, mirrors `Game.setup()` precedent).
- `loadAllScoringConfigs(basePath: string): Record<ScenarioKey, ScenarioScoringConfig>` — directory scan + per-file load + return frozen map.
- No `boardgame.io` import. Uses `node:fs/promises` and `node:path` only.
- Belongs to the engine layer because the PAR aggregator (engine) is the primary consumer.

### C) PAR artifact shape extensions — `packages/game-engine/src/simulation/par.storage.ts`

- `SeedParArtifact` gains `readonly scoringConfig: ScenarioScoringConfig`. The existing `parBaseline` field becomes structurally redundant with `scoringConfig.parBaseline` — the locked decision (D-5306c) is to **keep both for one cycle** (audit redundancy) with a `// why:` noting the equality invariant; a future cleanup WP collapses them.
- `SimulationParArtifact` gains `readonly scoringConfig: ScenarioScoringConfig`. No prior redundancy to manage.
- Both gain a structural invariant validated at write time: `scoringConfig.scoringConfigVersion === scoring.scoringConfigVersion`.

### D) `ParIndex` extension — same file

- `ParIndex.scenarios[key]` gains `readonly scoringConfig: ScenarioScoringConfig` per D-5306b. The full config is materialized into the index at index-build time so the gate can return it without a second filesystem hit.
- The index `artifactHash` continues to cover the artifact's full content including `scoringConfig`.

### E) PAR aggregator extensions — `packages/game-engine/src/simulation/par.aggregator.ts`

- `ParSimulationConfig` gains `readonly scoringConfig: ScenarioScoringConfig` as a required input. Today the aggregator implicitly knows the config via `scoringConfigVersion`; under WP-053a it receives the full object from the caller (the authoring CLI).
- The aggregator embeds `scoringConfig` into the output `SimulationParArtifact` verbatim.
- Invariant added: `scoringConfig.scoringConfigVersion === <output>.scoring.scoringConfigVersion`.

### F) Validator extensions — `packages/game-engine/src/simulation/par.storage.ts` (`validateParStore` / friends)

- `validateParStore` gains a check: every artifact carries a `scoringConfig`; `validateScoringConfig(artifact.scoringConfig)` returns ok; the version-equality invariant holds.
- Errors emit as `ParStoreValidationError` with an `errorType` of `'scoring_config_invalid'` or `'scoring_config_version_mismatch'`.
- Per D-5306c (one cycle), an additional check verifies `parBaseline === scoringConfig.parBaseline` for `SeedParArtifact`; mismatch emits `errorType: 'par_baseline_redundancy_drift'`.

### G) Gate extension — `apps/server/src/par/parGate.mjs`

- `ParGateHit` typedef gains `scoringConfig: ScenarioScoringConfig` (non-optional).
- `checkParPublished(simulationIndex, seedIndex, scenarioKey)` returns `{ parValue, parVersion, source, scoringConfig }` — sourced from the index's per-scenario entry.
- The gate constructor (`createParGate`) verifies at startup that every scenario in both indices has a non-null `scoringConfig`; missing configs fail closed (gate construction throws) — consistent with the existing fail-closed posture.

### H) Tests

| File | Tests | Notes |
|---|---|---|
| `packages/game-engine/src/scoring/scoringConfigLoader.test.ts` (new) | 4 | loads valid file; throws on missing file; throws on invalid JSON; throws on invalid config (delegates to `validateScoringConfig`) |
| `packages/game-engine/src/simulation/par.storage.test.ts` (extend existing) | +3 | `validateParStore` rejects artifact missing `scoringConfig`; rejects version mismatch; accepts valid extended artifact |
| `packages/game-engine/src/simulation/par.aggregator.test.ts` (extend existing) | +2 | aggregator embeds the input config verbatim; aggregator throws on version mismatch between input config and pipeline scoringConfigVersion |
| `apps/server/src/par/parGate.test.ts` (extend existing) | +2 | `checkParPublished` returns `scoringConfig` on hits; gate construction fails closed when an index entry is missing `scoringConfig` |
| `apps/server/src/par/parGate.test.ts` (existing tests) | unchanged | every existing test fixture must be updated to include `scoringConfig` in the synthetic indices it constructs — this is mechanical fixture extension, not behavior change |

Total new tests: 4 + 3 + 2 + 2 = **+11 tests across 4 files**, with mechanical updates to existing fixtures in `parGate.test.ts` and (likely) `par.storage.test.ts` / `par.aggregator.test.ts`.

---

## Out of Scope

- WP-053 itself (this is the predecessor that unblocks it).
- Removing the redundant `parBaseline` field from `SeedParArtifact` — kept for one cycle per D-5306c with a `// why:`; future cleanup WP collapses.
- HTTP / API surface for PAR publication.
- Authoring CLI changes beyond what's needed to plumb the new aggregator parameter (no new commands, no new output formats).
- GDPR / retention concerns for `data/scoring-configs/` (configs are public game-design data, not user data).
- Any change to `ScenarioScoringConfig` shape itself — the type is locked at WP-048.

---

## Files Expected to Change

```
data/scoring-configs/                                  (new directory)
data/scoring-configs/README.md                         (new)
data/scoring-configs/<scenario_key>.json               (new — at least one example file)

packages/game-engine/src/scoring/scoringConfigLoader.ts       (new)
packages/game-engine/src/scoring/scoringConfigLoader.test.ts  (new)

packages/game-engine/src/simulation/par.storage.ts            (modified — artifact + index shape)
packages/game-engine/src/simulation/par.storage.test.ts       (modified — +3 tests)
packages/game-engine/src/simulation/par.aggregator.ts         (modified — config input + embed)
packages/game-engine/src/simulation/par.aggregator.test.ts    (modified — +2 tests)
packages/game-engine/src/index.ts                             (modified — export new symbols)

apps/server/src/par/parGate.mjs                               (modified — ParGateHit shape + gate construction guard)
apps/server/src/par/parGate.test.ts                           (modified — +2 tests + fixture updates)
```

**Files explicitly forbidden to touch:**
- `packages/game-engine/src/scoring/parScoring.types.ts` (`ScenarioScoringConfig` is locked at WP-048)
- `packages/game-engine/src/scoring/parScoring.logic.ts` (scoring functions are locked)
- `apps/server/src/replay/**` (WP-103 surface — locked)
- `apps/server/src/identity/**` (WP-052 surface — locked)
- `packages/game-engine/src/replay/**` (WP-027 surface — locked)
- All other engine packages, all UI apps, all migrations.

---

## Acceptance Criteria

### Trust Surface
- [ ] `checkParPublished(scenarioKey)` returns `{ parValue, parVersion, source, scoringConfig }` on hit; `null` on miss
- [ ] Every published PAR artifact carries a structurally valid `scoringConfig`
- [ ] `scoringConfig.scoringConfigVersion === artifact.scoring.scoringConfigVersion` (structural invariant; checked at validation time)
- [ ] Gate construction fails closed if any index entry is missing `scoringConfig`

### Layer Boundary
- [ ] `apps/server/src/par/parGate.mjs` does not import `node:fs` (fs-free at request time preserved)
- [ ] `apps/server/src/par/parGate.mjs` does not import from `packages/game-engine/src/scoring/scoringConfigLoader.ts` (server consumes config only through the loaded index)
- [ ] `packages/game-engine/src/scoring/scoringConfigLoader.ts` does not import `boardgame.io` or any `apps/server/**`

### Drift Detection
- [ ] `validateParStore` rejects artifacts missing `scoringConfig` with `errorType: 'scoring_config_invalid'`
- [ ] `validateParStore` rejects artifacts where `scoringConfig.scoringConfigVersion !== scoring.scoringConfigVersion` with `errorType: 'scoring_config_version_mismatch'`
- [ ] `validateParStore` rejects `SeedParArtifact` where `parBaseline !== scoringConfig.parBaseline` with `errorType: 'par_baseline_redundancy_drift'` (D-5306c one-cycle audit)
- [ ] Drift-detection test pins the locked error type strings against their union

### Tests
- [ ] Engine baseline shifts `513 / 115 / 0` → `520 / 115 / 0` (+7 tests, +0 suites if all new tests land in existing describe blocks; +N suites if new files need new top-level describes)
- [ ] Server baseline shifts `36 / 6 / 0` → `38 / 6 / 0` (+2 tests in `parGate.test.ts`'s existing describe; +0 suites)
- [ ] Mechanical fixture updates to existing tests do not change pass/fail counts
- [ ] All new tests use `node:test` and `node:assert/strict`
- [ ] Test extension `.test.ts` (never `.test.mjs`)

### Scope Enforcement
- [ ] `git diff main -- packages/game-engine/src/scoring/parScoring.types.ts` empty (WP-048 contract locked)
- [ ] `git diff main -- packages/game-engine/src/scoring/parScoring.logic.ts` empty (scoring functions locked)
- [ ] `git diff main -- apps/server/src/replay/ apps/server/src/identity/ apps/server/src/server.mjs apps/server/src/index.mjs` empty
- [ ] `git diff main -- data/migrations/` empty (no migrations in this packet)
- [ ] No new npm dependencies

---

## Vision Alignment

- **§3 (Player Trust & Fairness)** — PAR publication is the unit of versioning; config and `parValue` cannot drift apart structurally. Competitive scoring derives from a single authoritative artifact.
- **§22 (Determinism)** — `scoringConfig` is embedded in the PAR artifact (immutable, content-hashed). Replay verification at WP-053 step 12 becomes a defense-in-depth tautology rather than a primary drift catch.
- **§24 (Replay-Verified Competitive Integrity)** — server is enforcer, never derives — extends to *which config applies*, not just *how to compute*.

NG-1..7: none crossed. PAR is a determinism / fairness substrate, not a monetization or behavioral surface.

---

## Verification Steps

```bash
# Engine + server build clean
pnpm -r build
# Expected: exits 0

# Engine tests
pnpm --filter @legendary-arena/game-engine test
# Expected: 520 / 115 / 0 (or +N suites if new files land outside existing describes)

# Server tests
pnpm --filter @legendary-arena/server test
# Expected: 38 / 6 / 0 (with skips matching pre-WP-053a baseline)

# Layer boundary — gate stays fs-free
grep -nE "from ['\"]node:fs|require\(['\"]node:fs" apps/server/src/par/parGate.mjs
# Expected: zero lines

# Layer boundary — server doesn't import the loader
grep -nE "scoringConfigLoader" apps/server/src/par/parGate.mjs apps/server/src/par/parGate.test.ts
# Expected: zero lines

# Contract surface — checkParPublished returns scoringConfig
grep -nE "scoringConfig" apps/server/src/par/parGate.mjs
# Expected: at least 3 matches (typedef, return, gate construction guard)

# WP-048 contract locked
git diff main -- packages/game-engine/src/scoring/parScoring.types.ts packages/game-engine/src/scoring/parScoring.logic.ts
# Expected: empty

# WP-103 / WP-052 surfaces locked
git diff main -- apps/server/src/replay/ apps/server/src/identity/
# Expected: empty
```

---

## Definition of Done

- All acceptance criteria pass
- All verification steps pass
- 01.6 post-mortem written (mandatory: new contract surface consumed by WP-053; new long-lived abstraction `scoringConfigLoader`; new on-disk authoring source `data/scoring-configs/`)
- D-5306 entry in `docs/ai/DECISIONS.md` is marked **landed** (i.e., its Status block is updated from "Active" to reflect post-execution state)
- D-5306a (configs live in `data/scoring-configs/`) and D-5306b (artifact + index inline embedding for fs-free gate) entries verified consistent with execution outcome
- WP-053's `## Assumes` section already cites WP-053a as a prerequisite (landed via separate SPEC commit during this A0 SPEC bundle phase)
- EC-053 §Before Starting already adds WP-053a alongside WP-103 (landed via the same SPEC commit; mirrors the WP-103 EC-053 update pattern)
- Vision trailer `Vision: §3, §22, §24` on Commit A
- Commit prefix `EC-053a:` on Commit A; `SPEC:` on Commit B (governance close)

---

## Estimated Scope

- **Files to produce / modify:** ~10 (3 new, 7 modified)
- **New tests:** +11 (across 4 files)
- **Test baseline shifts:** engine `+7`, server `+2`
- **Risk:** Medium. The artifact shape change is structurally bounded but touches three layers (aggregator, storage, gate). Existing test fixtures need mechanical updates. The fs-free invariant on the gate is the single highest-risk constraint — easy to violate accidentally if the loader leaks across the layer.
- **Estimated session length:** 1 execution session, comparable to WP-103.

---

## Key Sub-Decisions (Locked at A0 SPEC)

These were settled in the WP-053a A0 SPEC bundle and are now load-bearing:

1. **D-5306a — `ScenarioScoringConfig` instances live in `data/scoring-configs/<scenario_key>.json`.** One file per scenario; alphabetical key ordering on write. PAR aggregator (engine) reads from here at authoring time and embeds into every artifact it produces. Server gate never reads this directory; configs flow exclusively through the in-memory `ParIndex` loaded at startup.

2. **D-5306b — Config reaches the fs-free server gate via inline materialization into `ParIndex.scenarios[key].scoringConfig`** at index-build time. The gate returns it without a second filesystem hit. D-5103 fs-free invariant preserved.

3. **D-5306c — `SeedParArtifact.parBaseline` retained for one cycle post-WP-053a** despite being structurally redundant with `scoringConfig.parBaseline`. A `// why:` comment notes the equality invariant; `validateParStore` enforces equality with `errorType: 'par_baseline_redundancy_drift'`. A future cleanup WP collapses the redundancy.

4. **D-5306d — `competitive_scores` schema retains both `par_version` and `scoring_config_version` columns** despite Option A making them structurally equal. Audit redundancy; ~4 bytes per row; no `CHECK` constraint (would prevent forensic recording of drift if the invariant broke). Reviewable in a future audit-log / analytics WP.

---

## Notes for the Pre-Flight Session

A few things worth surfacing in WP-053a's pre-flight session:

- **WP-049 / WP-050 status check.** Verify both are at `[x] Done` in `WORK_INDEX.md` before starting. If either is still in flux, WP-053a inherits that instability.

- **Authoring CLI changes.** The PAR aggregator (WP-049) is invoked by some authoring CLI. If that CLI's input format changes (it now needs a `scoringConfig` argument or a path to the configs directory), capture it explicitly in §Files Expected to Change. Pre-flight should grep for the CLI invocation site.

- **Test fixture blast radius.** Existing `parGate.test.ts` and `par.storage.test.ts` tests construct synthetic indices / artifacts inline. Every such fixture needs `scoringConfig` added. This is mechanical but tedious. The post-mortem should include a count of fixture-update lines so future similar packets have a calibrated estimate.

- **Hard-Stop grep gate discipline (WP-103 carry-forward).** Pre-flight should pre-screen any proposed Hard Stop greps for likely `// why:` comment substring collisions. The WP-103 retrospective post-mortem §3.1 records this lesson; WP-053a's session prompt should fold it in.

- **`PRE-COMMIT-REVIEW.template.md` citation (WP-103 carry-forward).** Pre-flight should verify WP-053a's session prompt cites this template in its Authority Chain and adds a Pre-Session Gate or §Authorized Next Step that runs it between "all gates green" and "stage Commit A". The WP-103 retrospective review §Commit Hygiene Recommendations records this lesson.

- **EC numbering.** The EC for this WP is `EC-053a` per the placeholder slot in `EC_INDEX.md`. If a filename collision with a future EC-053a (e.g., a different work item) emerges, retarget per the WP-068 ↔ EC-070 / WP-082 ↔ EC-107 / WP-103 ↔ EC-111 precedent.
