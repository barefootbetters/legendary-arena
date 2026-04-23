WP-036 and WP-048 are complete (commits `04c53c0` and `c5f7ca4`). WP-049
(PAR Simulation Engine) is drafted, `✅ Reviewed`, and both WP and EC-049
underwent a surgical tightening pass this session (uncommitted). Key
context for WP-049:

- Repo test baseline: **re-measure at pre-flight start** with
  `pnpm -r test`. The wp048 bridge cited 409 as of 2026-04-17, but
  WP-061/WP-062/WP-067/WP-082/WP-083 have landed since then; do not
  reuse that number. Record the fresh baseline in the pre-flight doc.
  WP-049 must not regress it.
- WP-049 dependencies (WP-036, WP-048) are both ✅ Complete. WP-036
  landed `AIPolicy`, `createRandomPolicy`, `getLegalMoves`,
  `runSimulation`, `SimulationConfig`, `SimulationResult`. WP-048
  landed `ScenarioScoringConfig`, `ScoringInputs`, `ScoreBreakdown`,
  `computeRawScore`, `buildScenarioKey`, `PENALTY_EVENT_TYPES`,
  `validateScoringConfig`, and `ParBaseline`.
- WP-049 gates WP-050 (PAR Artifact Storage) and WP-051 (PAR
  Publication / Server Gate). The sequenced PAR chain is
  `WP-049 → WP-050 → WP-051`.

Uncommitted spec edits from the preceding editing session (must be
committed before WP-049 execution starts):

- `docs/ai/work-packets/WP-049-par-simulation-engine.md` — surgical
  tightening pass (see §"Spec hardening" below).
- `docs/ai/execution-checklists/EC-049-par-simulation-engine.checklist.md`
  — aligned with the WP-049 changes.
- `docs/ai/work-packets/WP-050-par-artifact-storage.md` — scope
  expanded to cover two artifact source classes (see §"Downstream
  consumer constraints" below). This does not modify WP-049's contract,
  but it locks field names WP-049 must emit.

Standard move: commit all three under a `SPEC:` prefix before running
the WP-049 pre-flight. Starting WP-049 on a dirty working tree forces
the executor to re-navigate precise staging.

Spec hardening in WP-049 + EC-049 (applied this session, not yet
committed):

1. **Percentile contract is fully specified.**
   `aggregateParFromSimulation(rawScores, percentile)` uses
   **nearest-rank** on the ascending-sorted array
   (`rankIndex = ceil((p/100) * N) - 1`, clamped), returns an
   **integer** in Raw Score units, and **throws** `ParAggregationError`
   on invalid input (empty array or percentile outside `[0, 100]`).
   No float interpolation. Tests assert `throws`, not "rejects".

2. **Provenance fields are explicit config inputs.**
   `ParSimulationConfig` now carries `simulationPolicyVersion` (string,
   e.g. `'CompetentHeuristic/v1'`), `scoringConfigVersion` (number),
   and an optional `generatedAtOverride` (ISO string). All three are
   copied verbatim into `ParSimulationResult`. This closes the
   provenance audit gap without modifying WP-036 or WP-048 contracts.

3. **Reproducibility surface is explicit.**
   Byte-identical `ParSimulationResult` is guaranteed when `(scenario,
   setupConfig, seedSet, simulationPolicyVersion, scoringConfigVersion,
   generatedAtOverride)` are identical. Without
   `generatedAtOverride`, `generatedAt` may differ run-to-run;
   reproducibility tests must inject it. A test (#15) enforces this.

4. **Raw Score ordering rule is locked: lower = stronger play.**
   Tier-ordering validation and PAR percentile selection both depend
   on this. Promoted to an explicit Locked Value in both WP and EC.

5. **Legal move conformance rule is locked.**
   A T2 `ClientTurnIntent` must match one of the provided
   `LegalMove[]` **exactly** (moveType + required payload). "Almost
   matching" payloads are invalid.

6. **Tie-break RNG isolation is locked (D-3604).**
   Policy-level tie-breaking RNG must derive only from the policy
   seed and must not share state with run-level shuffle RNG.

7. **Validation split is locked.**
   `aggregateParFromSimulation` throws. `validateParResult` returns a
   structured `ParValidationResult` and never throws. Multimodality
   "smell test" is a deterministic fixed-bin histogram (20 bins;
   ≥2 peaks each ≥20% of max bin count, separated by ≥2 bins). No
   external scenario-difficulty metadata is consulted.

8. **Aggregator test count is now 17** (was 16). Test #15 is the
   byte-identical reproducibility test with injected override;
   test #16 is the explicit "provenance copied verbatim" check.

9. **Docs included in scope.** `docs/ai/STATUS.md`,
   `docs/ai/DECISIONS.md`, and `docs/ai/work-packets/WORK_INDEX.md`
   are now listed under "Files Expected to Change" for WP-049, fixing
   the prior docs-vs-scope contradiction. Pre-flight's diff-scope
   check must allow these three.

Downstream consumer constraints (load-bearing — WP-050 expanded scope
this session locks these names):

- WP-050 now covers **two artifact source classes**: `seed`
  (content-authored) and `simulation` (WP-049 output). WP-049 does
  not author seed artifacts; it produces the values WP-050 wraps into
  a `SimulationParArtifact`. Field mapping WP-050 will consume from
  `ParSimulationResult`:
    - `parValue` — integer in Raw Score units (NOT centesimal; the
      EC-049 tightening removed the earlier "centesimal" wording in
      favor of "integer in Raw Score units"). The value must be the
      nearest-rank percentile of the distribution.
    - `percentileUsed` — the percentile actually applied (default 55).
    - `sampleSize` — N (≥ 500).
    - `generatedAt` — ISO string.
    - `seedSetHash` — canonical hash of the exact seed list.
    - `simulationPolicyVersion` — copied from config.
    - `scoringConfigVersion` — copied from config.
- WP-050 treats `T2` as the only publishable simulation policy tier.
  WP-049 must export `AI_POLICY_TIERS` with only T2 flagged
  `usedForPar: true` (already in WP-049 scope item C).
- Renaming any of these fields during WP-049 execution will force
  WP-050 rework. If a rename is necessary, stop and record it in
  `DECISIONS.md` before proceeding; WP-050's spec edits will need a
  follow-up amendment.

Architectural patterns still in effect (brief — full rationale in
DECISIONS.md and `.claude/rules/architecture.md`):

- D-0701 — AI is tooling, not gameplay. T2 receives filtered
  `UIState` only; never direct `G` access, never hidden state.
- D-0702 — Balance changes require simulation; PAR measures scenario
  difficulty before hero selection. Hero pool for simulation is
  neutral / non-optimized.
- D-3604 — Two-domain PRNG: run-level shuffle RNG and policy-level
  decision RNG never share state. Enforced in WP-049 via the
  explicit tie-break isolation clause.
- Engine isolation: WP-049 files live in
  `packages/game-engine/src/simulation/` (same layer as WP-036).
  The simulation layer must NOT import boardgame.io, `Math.random()`,
  or any `.reduce()` with branching. WP-036 and WP-048 contract
  files must NOT be modified.
- Scoring formula invariance: Raw Scores during simulation are
  computed via the same `computeRawScore` as live games. No
  simulation-specific scoring logic.

Seed PAR data does not yet exist on disk. There are zero concrete
`ScenarioScoringConfig` instances authored in the repo — only test
fixtures in `parScoring.logic.test.ts` and `uiState.build.par.test.ts`.
WP-049 does not author seed PAR (content work); but simulation PAR
will be the first live PAR data in the repo unless content authoring
gets ahead. Not a WP-049 blocker — flagged for awareness.

Files WP-049's executor will need to read before coding:

- `docs/ai/work-packets/WP-049-par-simulation-engine.md` — the
  authoritative WP spec (including this session's tightening edits
  once committed).
- `docs/ai/execution-checklists/EC-049-par-simulation-engine.checklist.md`
  — the authoritative execution contract; every item must pass.
- `docs/ai/work-packets/WP-050-par-artifact-storage.md` — not a
  dependency for execution, but WP-050 locks the field names
  WP-049 must emit. Skim §"Required `simulation` artifact fields"
  and §"Locked contract values".
- `packages/game-engine/src/simulation/ai.types.ts` — `AIPolicy`,
  `LegalMove`, `SimulationConfig`, `SimulationResult`. T2 policy
  must conform to `AIPolicy` exactly.
- `packages/game-engine/src/simulation/ai.random.ts` — T0 baseline
  policy, the shape T2 must match.
- `packages/game-engine/src/simulation/simulation.runner.ts` —
  `runSimulation` contract, used by `generateScenarioPar`.
- `packages/game-engine/src/scoring/parScoring.types.ts` —
  `ScenarioScoringConfig`, `ScoringInputs`, `ScoreBreakdown`,
  `ParBaseline`.
- `packages/game-engine/src/scoring/parScoring.logic.ts` —
  `computeRawScore`, `buildScoreBreakdown`, `validateScoringConfig`.
- `docs/12-SCORING-REFERENCE.md` — three-phase PAR derivation
  pipeline. WP-049 implements Phase 2.
- `docs/ai/DECISIONS.md` — D-0701, D-0702, D-3604 (see above).
- `.claude/rules/architecture.md` §"Engine Owns Truth" and
  §"Layer Boundary" — enforcement rules for the simulation layer.

Relevant precedent log entries (from
`docs/ai/REFERENCE/01.4-pre-flight-invocation.md`):

- P6-29 — execution-time empirical smoke test for version-sensitive
  external dependencies. Likely N/A (WP-049 introduces no new npm
  dep), but confirm at pre-flight.
- Precedents introduced during WP-036 execution (2026-04-21) are
  the most relevant prior art for WP-049 — read the WP-036
  invocation log and session post-mortem for any precedents
  specific to the simulation layer that should carry forward.

Pre-flight must-resolve items (surfaced during the spec-tightening
session 2026-04-23):

1. **Commit spec edits first.** WP-049, EC-049, and WP-050 all
   carry uncommitted changes from the 2026-04-23 tightening
   session. Run `git status` — if any of these three files still
   show as modified, commit them under `SPEC:` before starting the
   pre-flight copilot check. Do not bundle them into the WP-049
   execution commit.

2. **Re-measure the test baseline.** Do not reuse the 2026-04-17
   count from the WP-048 bridge. Run `pnpm -r test` at pre-flight
   start; record the fresh baseline; assert WP-049 does not
   regress it.

3. **Confirm WP-036 / WP-048 contract surfaces unchanged since
   close.** WP-049's `Assumes` list is long. Before pre-flight
   READY TO EXECUTE, verify with `git log -- packages/game-engine/src/simulation/`
   and `git log -- packages/game-engine/src/scoring/` that no
   amendments have landed since commits `04c53c0` / `c5f7ca4`
   that would invalidate any assumption.

4. **Verify the new docs-in-scope claim.** WP-049's "Files
   Expected to Change" now includes three docs files. The
   pre-flight's scope-enforcement lint check must treat those
   three paths as in-scope, not as silent-scope creep.

Steps completed for the 2026-04-23 spec-tightening session (no WP
execution occurred):

0: Review pass on WP-049, EC-049, WP-050 at the user's request.
1: Surgical edits applied to WP-049 (nearest-rank percentile, throws
   contract, explicit provenance fields, `generatedAtOverride`,
   Raw Score ordering rule, legal-move conformance, tie-break RNG
   isolation, docs-in-scope fix, test count 16 → 17).
2: EC-049 aligned with WP-049 (same scope).
3: WP-050 expanded to cover two artifact source classes (`seed` and
   `simulation`) with a single `resolveParForScenario` resolver
   applying the simulation-over-seed precedence rule. Test count
   21 → 34.
4: This bridge written.

Run pre-flight for WP-049 next, after committing the spec edits
above and resolving items #1–#4.
