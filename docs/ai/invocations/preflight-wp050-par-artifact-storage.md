# Pre-Flight Invocation — WP-050

---

### Pre-Flight Header

**Target Work Packet:** `WP-050`
**Title:** PAR Artifact Storage & Indexing
**Previous WP Status:**
- WP-049 Complete (Commit A `021555e`, Commit B `956306c`, merged to `main`)
- WP-048 Complete (Commit `2587bbb`, SPEC `c5f7ca4`)
**Pre-Flight Date:** 2026-04-23
**Invocation Stage:** Pre-Execution (Scope & Readiness)
**Inputs loaded:**
- Session context: `docs/ai/session-context/session-context-wp050.md`
- Reference: `docs/ai/REFERENCE/01.4-pre-flight-invocation.md`
- Reference: `docs/ai/REFERENCE/01.7-copilot-check.md`

**Work Packet Class:** Infrastructure & Verification / Tooling & Data

WP-050 introduces PAR artifact storage — the persistent substrate
that turns WP-049's in-memory `ParSimulationResult` into immutable,
content-addressed JSON artifacts. Two source classes: `seed` (Phase 1
content-authored baselines) and `simulation` (Phase 2 WP-049 output).
New code (a) runs outside the boardgame.io lifecycle — no move, no
phase hook, no `G` mutation; (b) performs filesystem IO to read/write
artifacts and indices; (c) exports a cross-class resolver applying
the simulation-over-seed precedence rule. This matches the
"Infrastructure & Verification / Tooling" class defined by `01.4`.

---

### Pre-Flight Intent

Perform a pre-flight validation for WP-050.

- Not implementing.
- Not generating code.
- Validating readiness and constraints only.

If a blocking condition is found, pre-flight must return **NOT READY**
and stop.

---

### Authority Chain (Must Read)

1. `.claude/CLAUDE.md` — EC-mode rules, lint gate, execution checklists
2. `docs/ai/ARCHITECTURE.md` — Layer Boundary (Simulation lives in
   engine category via D-3601; but WP-050 wants filesystem IO — see
   PS-2 below for resolution)
3. `docs/01-VISION.md` — §3, §22, §24, §26; NG-1/NG-7
4. `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` — `src/simulation/`
   classified as engine category via D-3601
5. `docs/ai/execution-checklists/EC-050-par-artifact-storage.
   checklist.md` (**drifted vs WP-050 — PS-1 below**)
6. `docs/ai/work-packets/WP-050-par-artifact-storage.md`
7. `docs/ai/DECISIONS.md` — D-3601, D-4801–D-4806 (WP-048 contract),
   D-4901..D-4911 (WP-049 calibration decisions)

On conflict, higher-authority documents win.

---

### Vision Sanity Check

- **Vision clauses touched:** §3 (Trust & Fairness), §22
  (Deterministic Evaluation), §24 (Auditable Records), §26 (PAR
  derivation & immutability); NG-1 (No Pay-to-Win); NG-7 (No
  Persuasion Surfaces).
- **Conflict assertion:** No conflict. Content-addressed by
  `ScenarioKey` with deterministic sorted-key JSON gives bit-for-bit
  reproducibility (§22). PAR version directories (`v1/`, `v2/`) are
  immutable once published; calibration updates create new versions
  — preserves "Once declared, PAR baselines are immutable for the
  purpose of competition" (§26). SHA-256 `artifactHash` stored in
  both the artifact and the index gives tamper detection (§24).
- **Non-Goal proximity:** Clear. PAR artifacts are reproducible data
  files; no user-facing monetization path can alter a published
  PAR. T2-only simulation artifacts (policy tier guard) prevent
  weak or over-strong policies from defining PAR (§26).
- **Determinism preservation:** STRONG. Deterministic JSON
  serialization (UTF-8, lexicographic key sort, no whitespace
  significance) is the correctness contract. Same input = same
  bytes. No timestamp, no host metadata, no nondeterministic field
  ordering in serialized output.
- **WP `## Vision Alignment` block:** Present in WP-050 §Vision
  Alignment (lines 555–577). Cites §3, §22, §24, §26, NG-1, NG-7.

---

### Dependency & Sequencing Check

| WP | Required Artifacts | Status | Notes |
|---|---|---|---|
| WP-049 | `ParSimulationResult`, `generateScenarioPar`, `createCompetentHeuristicPolicy`, `AI_POLICY_TIERS`, `AI_POLICY_TIER_DEFINITIONS` | ✅ Complete | Commit A `021555e` + Commit B `956306c`. Verified via `git log --oneline -5` and `grep -n "^export" packages/game-engine/src/index.ts \| grep -E "Par\|AI_POLICY"`. |
| WP-048 | `ScenarioKey`, `ParBaseline`, `ScenarioScoringConfig`, `computeRawScore`, `computeParScore`, `buildScenarioKey`, `PENALTY_EVENT_TYPES`, `validateScoringConfig` | ✅ Complete | Commit `2587bbb` + SPEC `c5f7ca4`. `parScoring.types.ts` + `parScoring.logic.ts` + `parScoring.keys.ts` present. |

**No Foundation Prompt impact:** WP-050 introduces no env vars, R2
data contract change, database schema, or server wiring. WP-050
writes to the local filesystem under `data/par/`; the CDN/R2
deployment is out of scope (it's ops). FP-00.4/00.5/01/02
assumptions remain valid.

**Verdict:** all prerequisite WPs are complete.

---

### Dependency Contract Verification

Every dependency name used by WP-050 cross-checked against source
files at HEAD `956306c`.

#### WP-049 surface

Verification commands (run at pre-flight):
```bash
grep -n "export interface ParSimulationResult" packages/game-engine/src/simulation/par.aggregator.ts
grep -n "export interface ParSimulationConfig" packages/game-engine/src/simulation/par.aggregator.ts
grep -n "export function generateScenarioPar" packages/game-engine/src/simulation/par.aggregator.ts
grep -n "export { AI_POLICY_TIERS" packages/game-engine/src/simulation/ai.tiers.ts
grep -n "export const AI_POLICY_TIER_DEFINITIONS" packages/game-engine/src/simulation/ai.tiers.ts
```

All must return exactly one line. Confirmed at pre-flight authoring
time — all five exports present.

- [x] `ParSimulationResult` — 13 locked fields (`scenarioKey`,
      `parValue`, `percentileUsed`, `sampleSize`, `seedSetHash`,
      `rawScoreDistribution`, `needsMoreSamples`, `seedParDelta`,
      `simulationPolicyVersion`, `scoringConfigVersion`,
      `generatedAt`). Every field survives `JSON.parse(JSON.
      stringify(result))` (WP-049 test #15). WP-050 reads these
      into `SimulationParArtifact` fields; no renames.
- [x] `generateScenarioPar(config, registry): ParSimulationResult`
      — pure function. WP-050 does NOT call it — WP-050's
      `writeSimulationParArtifact` takes an already-produced
      `ParSimulationResult` as input.
- [x] `AI_POLICY_TIER_DEFINITIONS` — exactly one entry has
      `usedForPar: true`, and it's T2. WP-050's "policy tier guard"
      check (§A line 419) asserts `policyTier === 'T2'` for
      publishable artifacts; `AI_POLICY_TIER_DEFINITIONS` is the
      drift-pinned source of truth for which tier is publishable.

#### WP-048 surface

- [x] `ScenarioKey = string` (alias at `parScoring.types.ts:24`) —
      **PS-3 below:** WP-050 describes it as a "branded type alias"
      but it's a plain alias. Non-blocking wording fix.
- [x] `ParBaseline { roundsPar, bystandersPar, victoryPointsPar,
      escapesPar }` — four non-negative integer fields at
      `parScoring.types.ts:124-133`. `SeedParArtifact.parBaseline`
      carries this verbatim; WP-050 §A line 314 names the field
      correctly.
- [x] `buildScenarioKey(scheme, mastermind, villains): ScenarioKey`
      — at `parScoring.keys.ts:30`. WP-050 does NOT call it —
      `ScenarioKey` values are passed in by callers or read from
      artifact content.
- [x] `computeParScore(config: ScenarioScoringConfig): number` —
      at `parScoring.logic.ts:196`. **Required by WP-050 §A test
      #17** (`writeSeedParArtifact` rejects `parValue` that
      disagrees with `parBaseline`). WP-050 §A line 351 says
      "caller supplies the scoring config separately at write
      time" — PS-5 below flags that the writer signature must
      include a `scoringConfig` parameter.
- [x] `ScenarioScoringConfig` — full shape including
      `scoringConfigVersion`, consumed via import, never
      modified.

#### Code category classification

- [x] `src/simulation/` classified as engine category via D-3601.
      WP-050 adds filesystem IO to this category — **PS-2 below**
      blocks until carve-out DECISIONS entry lands.

#### Decision-ID sanity check

- [x] D-3601 present (Simulation Code Category).
- [x] D-4801..D-4806 present (WP-048 contract invariants).
- [x] D-4901..D-4911 present (WP-049 PAR calibration decisions,
      appended at Commit A `021555e`).
- [x] Em-dash encoding risk — no em-dash `D‑` variants found in
      any target D-entry; searched with `grep -P "D\x{2011}"
      docs/ai/DECISIONS.md` — zero hits.

---

### Input Data Traceability Check

- [x] All non-user-generated inputs listed in
      `docs/03.1-DATA-SOURCES.md` — **YES** (WP-050 consumes
      `ParSimulationResult` + `SeedParArtifact` shape, both
      derived from `ScenarioScoringConfig` which is already a
      listed data source). WP-050 does not introduce a new
      external data source.
- [x] Storage locations known — **YES** (local filesystem under
      `data/par/`; layout works on R2/S3/CDN by design; deployment
      is out of scope).
- [x] Debuggable if behavior is wrong — **YES** (deterministic
      from `SeedParArtifact` or `ParSimulationResult` input;
      SHA-256 `artifactHash` is the canonical integrity check).
- [x] No implicit data — **YES** (all inputs are explicit function
      parameters; no magic paths, no environment lookups).
- [x] Setup-time derived data — **N/A** (WP-050 adds no runtime
      fields to `G`).

---

### Structural Readiness Check (Types & Contracts)

- [x] All prior WPs compile and tests pass — **YES**.
      Baseline captured 2026-04-23 via `pnpm -r test`:

      | Package | Tests | Suites | Pass | Fail |
      |---|---:|---:|---:|---:|
      | packages/registry          | 13  | 2   | 13  | 0 |
      | packages/vue-sfc-loader    | 11  | 0   | 11  | 0 |
      | **packages/game-engine**   | **471** | **112** | **471** | **0** |
      | apps/server                | 6   | 2   | 6   | 0 |
      | apps/replay-producer       | 4   | 2   | 4   | 0 |
      | packages/preplan           | 52  | 7   | 52  | 0 |
      | apps/arena-client          | 66  | 0   | 66  | 0 |
      | **Total**                  | **623** | **125** | **623** | **0** |

      WP-050 must not regress this baseline. Expected shift after
      WP-050 Commit A: engine **+34 tests / +1 suite** (471 → 505
      / 112 → 113), repo-wide 623 → 657 / 125 → 126.

- [x] No known EC violations remain open — **PARTIAL**. EC-050
      has documentation drift vs WP-050 (PS-1 below). No *code*
      violations; all WP-049 / WP-048 tests pass.
- [x] Required types/contracts exist and are exported — **YES**
      (all WP-049 and WP-048 surfaces verified above).
- [x] No naming/ownership conflicts — **YES**. WP-050 exports
      `writeSimulationParArtifact`, `readSimulationParArtifact`,
      `writeSeedParArtifact`, `readSeedParArtifact`,
      `buildParIndex`, `lookupParFromIndex`,
      `resolveParForScenario`, `validateParStore`,
      `validateParStoreCoverage`, `computeArtifactHash`,
      `scenarioKeyToFilename`, `scenarioKeyToShard`,
      `sourceClassRoot`, `PAR_ARTIFACT_SOURCES`, plus the types
      `ParArtifactSource`, `SeedParArtifact`,
      `SimulationParArtifact`, `ParArtifact`, `ParResolution`,
      `ParIndex`, `ParStorageConfig`, `ParStoreValidationResult`,
      `ParStoreValidationError`, `ParCoverageResult`,
      `ParStoreReadError`. Grep at HEAD confirmed no collisions.
- [x] No architectural boundary conflicts anticipated — **BLOCKED
      by PS-2** (filesystem IO in engine-category directory).
      Resolution required before execution.

No `NO` answers at the structural layer, but **PS-2 raises a
pre-flight BLOCKER** that must resolve before WP-050 proceeds.

---

### Runtime Readiness Check

WP-050 is **Infrastructure & Verification / Tooling** class. The
storage helpers do not mutate `G`, do not wire into `game.ts`,
`LegendaryGame.moves`, or phase hooks. They do touch the
filesystem. Runtime concerns are:

- [x] Expected runtime touchpoints known — **YES**. Storage
      utilities are called from tooling (future CLI that authors
      seed artifacts; future CI pipeline that runs
      `generateScenarioPar` + `writeSimulationParArtifact`;
      WP-051 will call `resolveParForScenario` at publication
      gate time). No wiring into `game.ts`, `LegendaryGame.moves`,
      or phase hooks.
- [x] Framework context requirements understood — **YES**.
      Storage functions take plain parameters (`basePath`,
      `parVersion`, `scenarioKey`, etc.) and return data or
      write files. No `ctx`, no `G`, no boardgame.io seam.
- [x] No runtime wiring allowance (01.5) required — **CONFIRMED**.
      WP-050 meets **zero** of the four 01.5 triggers:
        - No new field in `LegendaryGameState` (verified — WP-050
          §Out of Scope line 546 "No engine modifications").
        - No change to `buildInitialGameState` return shape.
        - No new `LegendaryGame.moves` entry.
        - No new phase hook.
      01.5 is **NOT INVOKED**. Any unanticipated structural break
      mid-execution must trigger STOP + escalate, not force-fit.

---

### 01.6 Post-Mortem Triggers

| Trigger | Applies? | Rationale |
|---|---|---|
| New long-lived abstraction | **Yes** | `ParArtifactSource` union + `PAR_ARTIFACT_SOURCES` canonical array + `ParIndex` + `ParResolution` + `ParArtifact` discriminated union anchor WP-051 (server gate) and WP-054 (public leaderboards). |
| New contract consumed by future WPs | **Yes** | WP-051 consumes `resolveParForScenario` + `validateParStoreCoverage` + `ParResolution`. Field names are load-bearing. |
| New canonical readonly array | **Yes** | `PAR_ARTIFACT_SOURCES` follows `AI_POLICY_TIERS` / `PENALTY_EVENT_TYPES` / `MATCH_PHASES` drift-pin pattern. |
| New setup artifact in `G` | No | Zero G involvement. |
| New filesystem surface | **Yes (implicit)** | First simulation-category file to do IO. If PS-2 Option A adopted, post-mortem must document the carve-out boundary. |

**Post-mortem file path:** `docs/ai/post-mortems/01.6-WP-050-par-
artifact-storage.md`. Template = WP-049 post-mortem at `docs/ai/
post-mortems/01.6-WP-049-par-simulation-engine.md`.

Mandatory post-mortem items (minimum):
1. Aliasing check — artifact writers must not retain caller
   references; deserialized artifacts must be fresh objects.
2. JSON-roundtrip check — every artifact must survive
   `JSON.parse(JSON.stringify(artifact))` with structural
   equality (D-4806 precedent).
3. `// why:` comment completeness — EC-050 §Required comments
   updated with the dual-source-class `// why:` items.
4. Determinism audit — write-same-input-twice produces
   byte-identical output; verified via a reproducibility test.
5. Per-source-class isolation audit — writing to `sim/` never
   modifies `seed/` and vice versa.
6. Layer-boundary audit — `grep -nE "from ['\"]boardgame\.io"
   packages/game-engine/src/simulation/par.storage.ts` returns
   no output; same for `@legendary-arena/registry`. Filesystem
   IO uses `node:fs/promises` only.
7. Carve-out boundary check (only if PS-2 Option A adopted) —
   confirm IO is confined to `par.storage.ts` and its test; no
   IO leaks into `ai.competent.ts` / `par.aggregator.ts` /
   `ai.tiers.ts` / `ai.random.ts` / `ai.legalMoves.ts` /
   `simulation.runner.ts`.

---

### Copilot Check (01.7)

Run `docs/ai/REFERENCE/01.7-copilot-check.md` at A0 commit time
with these as the focus questions:

1. Does PS-1's EC-050 surgical update cover all four drift sites
   (test count, re-export list, Locked Values, Required `// why:`
   Comments)?
2. Does PS-2's DECISIONS entry (if Option A) name a specific
   path pattern that permits IO, and explicitly re-confirm the
   IO prohibition in every other simulation file?
3. Does the session prompt lock the 34-test count, suite count
   (+1), and per-function failure semantics table?
4. Does the session prompt name the exact set of WP-049 +
   WP-048 fields consumed and mark them as load-bearing for
   WP-051?
5. Does the session prompt forbid all ways of bypassing the
   overwrite-refusal guards (including no `fs.rm`, no
   `fs.truncate`, no `fs.rename`-over-existing, etc.)?

Final verdict expected: **CONFIRM** once PS-1 and PS-2 resolve
via the A0 bundle.

---

### Pre-Flight Findings

#### PS-1 — BLOCKING — EC-050 drift vs WP-050

**Finding:** EC-050 was not updated alongside the 2026-04-23 WP-050
expansion to dual source classes. Specific drift:

| EC-050 current | WP-050 authoritative | Action |
|---|---|---|
| §Files to Produce: "21 tests" | §D: **34 tests** | Update count and test-group breakdown |
| §Files to Produce re-exports: `ParIndex`, `ParStorageConfig`, `ParStoreValidationResult` (3) | §B: 9 re-exports including source-class types | Update re-export list |
| §Locked Values: single `data/par/{version}/` layout | §Non-Negotiable: dual `data/par/{seed,sim}/{version}/` layout | Update path locks |
| §Required `// why:` Comments: 7 items, none mention seed/sim split | §A/B: additional `// why:` for `sourceClassRoot`, simulation-over-seed precedence, per-class overwrite refusal, seed artifact baseline validator | Add missing items |
| §Common Failure Smells: 13 items, none mention cross-class violations | §A: cross-class `source` mismatch, silent fall-through in resolver, T2-only policy tier guard | Add missing items |

**Resolution:** Apply surgical EC-050 update in the A0 SPEC
bundle before WP-050 execution starts. Structural parity between
WP-050 and EC-050 is a lint-gate item per `docs/ai/REFERENCE/
00.3-prompt-lint-checklist.md`. WP-049's A0 bundle at `67927f1`
applied the same kind of EC+WP alignment pass — precedent set.

**Verdict:** BLOCKING until A0 bundle lands.

#### PS-2 — BLOCKING — Filesystem IO in engine-category directory

**Finding:** WP-050 places filesystem IO
(`writeSeedParArtifact`, `writeSimulationParArtifact`,
`buildParIndex`, `readSeedParArtifact`,
`readSimulationParArtifact`) inside
`packages/game-engine/src/simulation/par.storage.ts`.
`.claude/rules/architecture.md` Game Engine Layer section says
engine code must NEVER "Query PostgreSQL, HTTP, filesystem, or
environment". D-3601 classifies `src/simulation/` as engine
category. No existing simulation-category file does IO — WP-049
was strictly memory-only.

**Three resolution options:**

- **Option A — Narrow carve-out via new D-entry D-5001.** Add a
  DECISIONS entry explicitly permitting filesystem IO in
  `src/simulation/par.storage.ts` (and any future
  `src/simulation/*.storage.ts`), while **re-confirming** the IO
  prohibition in all other simulation files. Add a
  layer-boundary test (or grep gate in verification steps) that
  enforces "IO only in `par.storage*.ts`". Backs WP-050's own
  framing ("PAR artifact storage is tooling/data, not engine or
  server"). Least disruptive.

- **Option B — Move storage to new `@legendary-arena/par-storage`
  package.** Follows the `vue-sfc-loader` Shared Tooling
  precedent. Clean layer separation. Adds a pnpm workspace
  change, new `package.json`, new `tsconfig.json`, new
  `src/index.ts`, new test runner wiring. Would require WP-050
  §Files Expected to Change to be rewritten to span two
  packages. Significantly higher scope.

- **Option C — Move storage to `apps/par-storage-tooling/` or
  similar.** Classifies storage as an app. Breaks WP-050's
  "engine isolation" framing ("storage lives alongside
  simulation"). Requires WP-050 rewrite.

**Recommendation:** **Option A**. WP-050 as written matches
Option A. The carve-out is genuinely narrow (two storage
filenames matching `*.storage.ts`). The new D-5001 entry
preserves the "no IO in simulation runtime" invariant while
permitting IO in the named storage file. Adding a verification
grep (`grep -rnE "from ['\"]node:fs" packages/game-engine/src/
simulation/ --include="*.ts" | grep -vE
"(par\.storage\.ts|par\.storage\.test\.ts)"` must return zero
output) pins the carve-out to its stated boundary.

**Resolution:** Apply D-5001 entry + WP-050 §Non-Negotiable
Constraints update + EC-050 update in the A0 SPEC bundle.

**Verdict:** BLOCKING until A0 bundle lands.

#### PS-3 — Non-blocking — `ScenarioKey` wording

**Finding:** WP-050 §Assumes line 78 says `ScenarioKey` is "a
branded type alias". At `parScoring.types.ts:24`, the actual
declaration is `export type ScenarioKey = string` — a plain
alias, not a branded type (TypeScript does not enforce branding
without an explicit branding tag).

**Impact:** None on implementation. WP-050's code uses
`ScenarioKey` identically either way.

**Resolution:** Reword "branded type alias" to "string type
alias" in the A0 bundle WP-050 update. No other change.

#### PS-4 — Non-blocking — SHA-256 via `node:crypto`

**Finding:** WP-050 §A line 397 specifies
`computeArtifactHash` as SHA-256. Node's built-in `node:crypto`
module provides SHA-256 via `createHash('sha256')`. D-3601 /
the WP-049 session prompt says "no crypto libraries in
simulation" — that language was scoped to *seed-set hashing*
where `djb2` sufficed. SHA-256 for tamper detection is a
different concern (cryptographic integrity, not random number
derivation).

**Impact:** `node:crypto` is a Node built-in, not an external
npm dependency. No package.json change. Meets the "no external
crypto library" rule verbatim.

**Resolution:** Add a `// why:` item to EC-050 §Required
Comments mandating a citation in `computeArtifactHash` that
distinguishes `node:crypto` (Node built-in, acceptable) from
external crypto libraries (forbidden). Add the citation to
WP-050 §A line 397 for clarity. No architectural change.

#### PS-5 — Non-blocking — `writeSeedParArtifact` needs `scoringConfig`

**Finding:** WP-050 §A line 351 says "Validates: `parBaseline`
has all four required non-negative integer fields; `parValue`
equals `computeParValueFromBaseline(parBaseline, weights)` for
the referenced scoring config version (caller supplies the
scoring config separately at write time — see guard below)."
But the `writeSeedParArtifact` signature in §A line 343 is
`(artifact: SeedParArtifact, basePath: string, parVersion:
string): string` — no `scoringConfig` parameter.

**Impact:** The writer cannot run the consistency check
without access to a `ScenarioScoringConfig`. Either the
signature needs a fourth parameter, or the check moves to a
separate helper.

**Resolution:** Update WP-050 §A line 343 signature to
`writeSeedParArtifact(artifact: SeedParArtifact,
scoringConfig: ScenarioScoringConfig, basePath: string,
parVersion: string): string`. Update EC-050 §Files to
Produce accordingly.

#### PS-6 — Non-blocking — `node:fs/promises` vs `node:fs`

**Finding:** WP-050 does not specify `node:fs/promises` vs
`node:fs` for filesystem IO. Test files use `node:test` sync
API; tests may be easier with synchronous `node:fs`. Production
code probably wants `node:fs/promises` for non-blocking IO.

**Impact:** Style and API consistency question. Either works.

**Resolution:** Lock `node:fs/promises` for the writer/reader
API (matches modern Node idiom, works well with the test
runner). Tests can use either. Add to WP-050 §Non-Negotiable
Constraints + EC-050 §Locked Values.

---

### Findings Summary

| ID | Severity | Surface | Resolution Path |
|---|---|---|---|
| PS-1 | BLOCKING | EC-050 drift | Surgical EC update in A0 bundle |
| PS-2 | BLOCKING | IO in engine category | D-5001 carve-out + EC/WP updates in A0 bundle |
| PS-3 | Non-blocking | WP wording | One-line fix in A0 bundle |
| PS-4 | Non-blocking | Crypto library rule clarification | `// why:` citation + EC item in A0 bundle |
| PS-5 | Non-blocking | Writer signature | Signature update in A0 bundle |
| PS-6 | Non-blocking | `node:fs` vs `node:fs/promises` | Lock `node:fs/promises`, add to EC |

Two BLOCKERS must resolve in the A0 SPEC bundle before the
session execution prompt can be run. All six findings have
concrete resolution paths. No finding requires a WP-050
rewrite or a scope expansion beyond the A0 bundle.

---

### Verdict

**🟡 NOT READY until A0 SPEC bundle lands.**

A0 SPEC bundle must apply, in a single commit:

1. **EC-050 surgical update** — resolves PS-1 (align test count,
   re-export list, Locked Values, Required Comments, Failure
   Smells with WP-050).
2. **WP-050 updates** — resolve PS-3 (`ScenarioKey` wording),
   PS-4 (SHA-256 rationale), PS-5 (`writeSeedParArtifact`
   signature), PS-6 (`node:fs/promises` lock). Apply
   PS-2-related `// why:` for the IO carve-out.
3. **DECISIONS.md entry D-5001** — resolves PS-2 (narrow
   carve-out permitting IO in `par.storage.ts` only, with
   re-confirmation of IO prohibition elsewhere in simulation).
4. **Session execution prompt** — `session-wp050-par-artifact-
   storage.md` — drafted alongside the other A0 items in the
   same commit so the executor has everything it needs in one
   shot.

Once the A0 SPEC bundle lands, re-run this pre-flight's
**Copilot Check** focus questions. Expected final verdict:
**✅ READY TO EXECUTE**.

If a new finding surfaces during copilot check, add a PS-N and
resolve in a follow-up A0b SPEC commit before execution.
