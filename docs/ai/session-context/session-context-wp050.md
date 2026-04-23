WP-049 is complete. WP-050 (PAR Artifact Storage & Indexing) is the
next packet in the PAR chain: WP-049 → WP-050 → WP-051 → WP-054.
Key context for WP-050:

- Repo test baseline at HEAD (`956306c`, 2026-04-23):
    | Package | Tests | Suites | Pass | Fail |
    |---|---:|---:|---:|---:|
    | packages/registry          | 13  | 2   | 13  | 0 |
    | packages/vue-sfc-loader    | 11  | 0   | 11  | 0 |
    | packages/game-engine       | 471 | 112 | 471 | 0 |
    | apps/server                | 6   | 2   | 6   | 0 |
    | apps/replay-producer       | 4   | 2   | 4   | 0 |
    | packages/preplan           | 52  | 7   | 52  | 0 |
    | apps/arena-client          | 66  | 0   | 66  | 0 |
    | **Total**                  | **623** | **125** | **623** | **0** |

  WP-050 must not regress this baseline. Re-measure at pre-flight
  start with `pnpm -r test`.

- WP-050 dependencies are both ✅ Complete.
  - **WP-049** (Commit A `021555e`, Commit B `956306c`): shipped
    `ParSimulationResult`, `generateScenarioPar`,
    `createCompetentHeuristicPolicy`, `AI_POLICY_TIERS`
    (`['T0', 'T1', 'T2', 'T3', 'T4']`),
    `AI_POLICY_TIER_DEFINITIONS` with exactly one `usedForPar: true`
    entry (T2). D-4901..D-4911 record the PAR calibration decisions.
  - **WP-048** (Commit `2587bbb`, SPEC `c5f7ca4`): shipped
    `ScenarioKey` (string alias, `{scheme}::{mastermind}::{sorted-
    villains-joined-by-+}` format), `buildScenarioKey`, `ParBaseline`
    (4 fields: `roundsPar`, `bystandersPar`, `victoryPointsPar`,
    `escapesPar`), `ScenarioScoringConfig` with `parBaseline` +
    `scoringConfigVersion`, `computeRawScore`, `computeParScore`,
    `PENALTY_EVENT_TYPES` canonical array.

- **WP-050 field-name consumer list from WP-049 (verified at main
  `956306c`, load-bearing — do NOT rename during WP-050 execution):**
    - `parValue` — integer in Raw Score units (not centesimal; lower =
      stronger play)
    - `percentileUsed` — integer, config.percentile copied verbatim
    - `sampleSize` — integer, equals config.simulationCount (invariant
      asserted in generateScenarioPar)
    - `generatedAt` — ISO 8601 string; deterministic when
      config.generatedAtOverride supplied
    - `seedSetHash` — `djb2-<hex>` string from
      `computeSeedSetHash(generateSeedSet(baseSeed, count))`
    - `simulationPolicyVersion` — string (e.g.
      `'CompetentHeuristic/v1'`), config verbatim
    - `scoringConfigVersion` — integer, config verbatim
    - `scenarioKey` — ScenarioKey string, copied from config
    - `rawScoreDistribution` — fresh object literal with 8 number
      fields (`min`, `p25`, `median`, `p55`, `p75`, `max`,
      `standardDeviation`, `interquartileRange`)
    - `needsMoreSamples` — boolean derived from module-level
      `IQR_THRESHOLD = 2000` + `STDEV_THRESHOLD = 1500`
    - `seedParDelta` — `parValue - computeParScore(scoringConfig)`

  All 11 fields survive `JSON.parse(JSON.stringify(result))` with
  structural equality (test #15 asserts this).

- **WP-050 spec status at session start:**
    - WP-050 file is ✅ Reviewed at 772 lines. Dual source-class spec
      (seed + simulation) landed in the 2026-04-23 pre-WP-049 spec
      tightening pass (reference: session-context-wp049.md §Downstream
      consumer constraints).
    - **EC-050 drift:** EC-050 was not updated alongside WP-050
      during that session. The EC is at 78 lines and reflects the
      pre-expansion shape:
        - §Files to Produce line 53 says "21 tests"; WP-050 §D
          specifies **34 tests** (dual source-class coverage: 6 path
          helpers + 7 simulation I/O + 7 seed I/O + 4 index/lookup +
          5 cross-class resolver + 4 store validation + 1 hashing)
        - §Files to Produce §line 51 says re-export "ParIndex,
          ParStorageConfig, ParStoreValidationResult"; WP-050 §B
          specifies nine re-exports including `ParArtifactSource`,
          `PAR_ARTIFACT_SOURCES`, `SeedParArtifact`,
          `SimulationParArtifact`, `ParArtifact`, `ParResolution`,
          `ParCoverageResult`, `ParStoreReadError`
        - §Locked Values and §Common Failure Smells do not mention
          the two source classes, the `sourceClassRoot` helper, the
          simulation-over-seed precedence rule, or
          `resolveParForScenario`
        - §Required `// why:` Comments list is incomplete vs WP-050's
          locked comments
    - **Resolution path:** pre-flight must flag this as PS-1
      (BLOCKING — documentation drift between authoritative WP and
      its authoritative EC). Proposed fix: EC-050 surgical update
      applied in the A0 SPEC bundle before WP-050 execution starts.
      Standard move — WP-049's A0 bundle at `67927f1` applied the
      same kind of EC+WP alignment pass.

- **Architectural finding that pre-flight must resolve (PS-2):**
  WP-050 places filesystem IO (`writeSeedParArtifact`,
  `writeSimulationParArtifact`, `buildParIndex`, `readSeedParArtifact`,
  `readSimulationParArtifact`) inside `packages/game-engine/src/
  simulation/par.storage.ts`. But `.claude/rules/architecture.md`
  Game Engine Layer says engine code must NEVER "Query PostgreSQL,
  HTTP, filesystem, or environment", and D-3601 classifies
  `src/simulation/` as engine category. WP-049 complied by doing
  zero IO in the aggregator. WP-050 is the first case where
  simulation-category code wants filesystem IO.

  Three options:
    - **Option A — New D-entry permitting IO in a narrow
      `src/simulation/par.storage.*` carve-out.** Least disruptive;
      aligns with WP-050's scope as written. Needs explicit
      language in DECISIONS.md distinguishing simulation **tooling
      with IO** (storage helpers, out-of-band) from simulation
      **runtime** (policy, aggregator, legal-move, runner — IO-free).
    - **Option B — Move storage to a new package
      `@legendary-arena/par-storage`.** Cleaner layer separation;
      follows the `vue-sfc-loader` Shared Tooling precedent. More
      scope — pnpm workspace change, new package.json, new tsconfig,
      new test runner wiring. Would require a WP-050 rewrite.
    - **Option C — Move storage to `apps/par-storage-tooling/` or
      similar.** Classifies storage as an app, not a package.
      Breaks WP-050's "engine isolation" framing; requires WP-050
      rewrite.

  Pre-flight must recommend one option. My read: **Option A** is the
  least invasive and matches WP-050's own framing ("storage is
  tooling/data, not engine"). Option A needs a DECISIONS entry
  added to Commit A0's bundle (the new D-entry, e.g. D-5001).

- **Other pre-flight findings likely to surface:**
    - **PS-3 (non-blocking):** `ScenarioKey` is `export type
      ScenarioKey = string` in `parScoring.types.ts:24` — a plain
      alias, not a branded type. WP-050 line 77 says "`ScenarioKey`
      is a branded type alias" — wording mismatch. Doesn't affect
      implementation; flag and proceed.
    - **PS-4 (non-blocking):** `computeArtifactHash` must use
      SHA-256. Node built-in `node:crypto` provides this without any
      external dependency. D-3601's "no crypto libraries in
      simulation" rule was scoped to seed-set hashing in WP-049
      (where djb2 sufficed). SHA-256 for tamper detection needs a
      `// why:` citation explaining why `node:crypto` (a Node
      built-in, not an external library) is acceptable here while
      the seed-set hash stays djb2.
    - **PS-5 (non-blocking):** WP-050 test #17 specifies
      "`writeSeedParArtifact` rejects an artifact whose `parValue`
      disagrees with `parBaseline` under the referenced scoring
      config". This requires `computeParScore` (WP-048) to be
      called at write time with a `ScenarioScoringConfig`. The
      caller must provide the config; WP-050 §A line 351 says
      "caller supplies the scoring config separately at write time
      — see guard below". Ensure the writer signature includes a
      `scoringConfig` parameter or a thin `weights + parBaseline
      → expected parValue` helper.

- **Downstream consumer constraints (WP-051 will consume these
  names from WP-050; renames force WP-051 rework):**
    - `ParArtifactSource` union (`'seed' | 'simulation'`)
    - `PAR_ARTIFACT_SOURCES` canonical array (drift test required)
    - `ParIndex` shape (`parVersion`, `source`, `generatedAt`,
      `scenarioCount`, `scenarios: Record<ScenarioKey, { path,
      parValue, artifactHash }>`)
    - `resolveParForScenario` signature
      `(scenarioKey, basePath, parVersion): ParResolution | null`
    - `ParResolution` shape (`source`, `parValue`, `path`,
      `indexPath`)
    - `ParCoverageResult` shape for pre-release gate
    - `validateParStore` / `validateParStoreCoverage` signatures
    - `ParStoreReadError` class

  Renaming any of these during WP-050 execution forces WP-051
  amendment. If a rename is necessary mid-execution, stop and
  record in DECISIONS.md before proceeding.

- Architectural patterns still in effect (brief — full rationale in
  DECISIONS.md and `.claude/rules/architecture.md`):
    - D-0701 — AI is tooling, not gameplay.
    - D-0702 — Balance changes require simulation; PAR is the
      authoritative difficulty baseline for leaderboards.
    - D-3601 — Simulation category; `src/simulation/**` is engine
      category but out-of-band from gameplay lifecycle. PS-2 above
      expands scope if Option A wins.
    - D-3604 — Two-domain PRNG (inherited from WP-049).
    - D-4901..D-4911 — PAR calibration decisions from WP-049; WP-050
      consumes but does not modify.
    - Engine isolation: WP-050 files live next to WP-049 files in
      `src/simulation/`. Must NOT import boardgame.io, must NOT
      import `@legendary-arena/registry`, must NOT modify WP-036 /
      WP-048 / WP-049 contract files. Filesystem IO — permitted
      under PS-2 Option A if adopted; otherwise blocked.

- Seed PAR data does not yet exist on disk. WP-050 produces the
  writer; WP-050 does not author any seed artifacts (content work).
  Post-WP-050, seed authoring will be a separate content task —
  typically via a CLI script or tooling app using the writer
  exported from WP-050. Flagged for awareness; not a WP-050
  blocker.

- Files WP-050's executor will need to read before coding:
    - `docs/ai/work-packets/WP-050-par-artifact-storage.md` — the
      authoritative WP spec (772 lines).
    - `docs/ai/execution-checklists/EC-050-par-artifact-storage.
      checklist.md` — authoritative execution contract. Surgical
      update applied in A0 bundle to resolve PS-1 drift.
    - `docs/ai/work-packets/WP-051-par-publication-gate.md` (if
      exists) — downstream consumer whose field names WP-050 must
      emit. Check for existence at pre-flight; document as
      speculative if absent.
    - `packages/game-engine/src/scoring/parScoring.types.ts` —
      `ScenarioKey` + `ParBaseline` definitions.
    - `packages/game-engine/src/scoring/parScoring.logic.ts` —
      `computeParScore` for seed-artifact parValue validation.
    - `packages/game-engine/src/simulation/par.aggregator.ts` —
      `ParSimulationResult` definition. Simulation artifact maps
      from result fields.
    - `packages/game-engine/src/simulation/ai.tiers.ts` —
      `AI_POLICY_TIER_DEFINITIONS`; `policyTier: 'T2'` constraint.
    - `docs/12-SCORING-REFERENCE.md` — three-phase PAR pipeline.
      WP-050 is Phase 1 (seed) + Phase 2 (sim) storage.
    - `.claude/rules/architecture.md` §Layer Boundary — PS-2
      filesystem-IO question lives here.
    - `docs/ai/DECISIONS.md` — D-3601 scope, D-4801..D-4806 (WP-048
      contract immutability), D-4901..D-4911 (WP-049 PAR decisions).

- Relevant precedent log entries (from
  `docs/ai/REFERENCE/01.4-pre-flight-invocation.md`):
    - P6-27 — staging by exact filename; never `git add .` / `-A`.
    - P6-29 — execution-time empirical smoke for version-sensitive
      deps. Likely N/A (WP-050 adds no new npm dep; uses
      `node:crypto` + `node:fs/promises` only).
    - P6-36 — commit prefix `EC-050:` on code; `SPEC:` on governance;
      never `WP-050:`.
    - P6-54 — suite count discipline (one `describe()` wrapper per
      test file; +N suites = +N wrappers).

- Pre-flight must-resolve items (summarized above):
    1. **PS-1 BLOCKING — EC-050 drift (21 → 34 tests, missing
       dual-source-class content).** Resolve in A0 bundle with
       surgical EC-050 update.
    2. **PS-2 BLOCKING — Filesystem IO layer question.** Recommend
       Option A (narrow carve-out + new D-entry D-5001) in A0
       bundle.
    3. **PS-3 non-blocking — `ScenarioKey` wording.** Document,
       proceed.
    4. **PS-4 non-blocking — SHA-256 via `node:crypto`.** Document,
       add `// why:` requirement to EC-050.
    5. **PS-5 non-blocking — `writeSeedParArtifact` signature needs
       `scoringConfig` parameter.** Confirm in A0 bundle; update
       WP-050 §A signature if missing.

Run pre-flight for WP-050 next. If PS-1 and PS-2 resolve cleanly,
pre-flight verdict should be READY TO EXECUTE — but only after the
A0 bundle lands the EC update and the D-5001 (or alternative)
decision entry.
