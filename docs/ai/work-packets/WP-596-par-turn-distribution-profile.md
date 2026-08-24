# WP-596 — PAR Turn-Distribution Profile (the empirical sweet-spot curve)

**Status:** Ready
**Primary Layer:** Game Engine / Simulation + Persistence (derived-artifact carve-out)
**Dependencies:** WP-049 (PAR simulation engine), WP-050 (PAR artifact storage), WP-048 (Raw Score formula)
**User-Visible Surface:** none — infrastructure (a derived observability artifact + engine seam; the render surface is a deferred follow-up)

---

## Session Context

WP-049 built the PAR Monte-Carlo pipeline (`generateScenarioPar`, the internal
`simulateOneGame` loop, the T2 competent policy) and WP-050 locked the immutable,
SHA-256-hashed `seed` / `simulation` PAR artifact layout; this packet adds a
per-turn *distribution* observability layer on top of that same per-game loop
without changing either the `parValue` it produces or the hashed PAR artifact.

---

## Goal

After this session `@legendary-arena/game-engine` can, for a single scenario,
emit one row per simulated game (`generateScenarioParSamples`) and aggregate
those rows into a per-turn "sweet-spot" profile — for each turn-count at which
games ended: the game count, the median / p25 / p75 Raw Score, the win rate,
and the median victory points, plus scenario-level totals (sample size,
stuck-at-cap count, win / loss counts, minimum winning turn, and a
`monotoneImproving` fidelity flag). The profile is persisted as a **separate,
derived, non-authoritative artifact**, never inside the immutable hashed PAR
artifact. `generateScenarioPar`'s returned `parValue` is byte-identical to its
pre-refactor value — the refactor adds observability, it never changes
calibration.

---

## User-Visible Impact

None — infrastructure. No user-observable change; this packet's payoff is a
derived per-scenario distribution artifact and the engine seam that produces it,
which a later follow-up WP renders on `/coverage` or the scoring wiki and a sweep
uses to rank degenerate ("too-easy") scenarios. A monotone-improving profile at
near-100% win rate is a difficulty-fidelity diagnostic, not a player-facing
feature.

---

## Assumes

- WP-049 complete. Specifically:
  - `packages/game-engine/src/simulation/par.aggregator.ts` exports
    `generateScenarioPar`, `ParSimulationConfig`, `ParSimulationResult`, and
    contains the internal `simulateOneGame` per-game loop (WP-049).
  - `packages/game-engine/src/scoring/parScoring.logic.ts` exports
    `computeRawScore` (WP-048).
  - `packages/game-engine/src/endgame/endgame.evaluate.ts` exports
    `evaluateEndgame` returning `EndgameResult | null` with
    `outcome: 'heroes-win' | 'scheme-wins' | 'tie'` (WP-010 family).
- WP-050 complete. Specifically:
  - `packages/game-engine/src/simulation/par.storage.ts` exports
    `scenarioKeyToFilename` and the SHA-256 artifact write/index helpers, and
    holds the D-5001 filesystem-IO carve-out for this one file (+ its test).
- `pnpm --filter @legendary-arena/game-engine build` exits 0 on `main`.
- `pnpm --filter @legendary-arena/game-engine test` exits 0 on `main`.
- `docs/ai/DECISIONS.md` and `docs/ai/ARCHITECTURE.md` exist.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Persistence Boundaries` and `.claude/rules/architecture.md
  §Persistence Boundary (Cross-Layer)` — read the "snapshots are derived records,
  never live state" rule and the boardgame.io-store exemption prose. The profile
  artifact is a **derived record**; it must obey the same never-a-save-game,
  never-a-competitive-input discipline.
- `.claude/rules/architecture.md §Import Rules` — `game-engine` imports Node
  built-ins only; simulation files must not import `boardgame.io`, `registry`,
  `server`, or any `apps/*`. The D-5001 IO carve-out for `par.storage.ts` is the
  sole filesystem exception.
- `packages/game-engine/src/simulation/par.aggregator.ts` — read it entirely.
  `generateScenarioPar` (the loop this packet refactors), the internal
  `simulateOneGame` (returns `{ finalState, turnCount }`), the internal
  `deriveScoringInputsFromFinalState`, and the RS-10 duplicated-PRNG scope lock
  must all be preserved unchanged in behavior.
- `packages/game-engine/src/simulation/par.storage.ts` — read it entirely before
  adding the profile write/read; match its versioned-directory + canonical-JSON
  conventions and the D-5001 carve-out comment style.
- `packages/game-engine/src/scoring/parScoring.logic.ts §computeRawScore` — the
  formula the samples are scored with; do not re-derive it.
- `wiki/par-simulation-calibration.md` — the calibration model this profile
  visualizes, and the "PAR on today's engine is a baseline for a different,
  easier game" caveat the `monotoneImproving` flag operationalizes.
- `docs/ai/REFERENCE/00.2-data-requirements.md` — confirm any field name that
  overlaps the canonical set (`victoryPoints`, `rounds`) before naming a profile
  field.
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 4 (no abbreviations), Rule 6
  (`// why:`), Rule 8 (no `.reduce()` with branching), Rule 9 (`node:` prefix),
  Rule 11 (full-sentence errors), Rule 13 (ESM only).
- `docs/ai/DECISIONS.md` — scan D-4801..D-4806, D-5001, D-3601/D-3604 (simulation
  IO + PRNG rules) and D-24242 (seed PAR) before adding D-24405.
- `docs/01-VISION.md §26` and `§20–25` — the PAR determination model and
  competitive-integrity clauses this WP must preserve (see `## Vision Alignment`).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — all simulation randomness stays on the existing
  seeded `mulberry32` PRNG domains (D-3604); this packet adds no new randomness.
- Never persist `G`, `ctx`, or any runtime state — the profile stores derived
  aggregates only (counts, medians, quartiles), never zone contents or `G`.
- `G` must remain JSON-serializable at all times — this packet does not add any
  `G` field, so `finalStateHash` / `PRE_WP080_HASH` stay byte-identical.
- ESM only, Node v22+ — `import`/`export`, never `require()`.
- `node:` prefix on all Node.js built-in imports.
- Test files use `.test.ts` — never `.test.mjs`.
- No database or network access; the only filesystem IO is inside
  `par.storage.ts` under the existing D-5001 carve-out.
- Full file contents for every new or modified file — no diffs, no snippets.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.

**Packet-specific:**
- `generateScenarioPar`'s returned `parValue` MUST be byte-identical before and
  after the refactor — a regression test pins this. The refactor routes the
  existing per-seed loop through `generateScenarioParSamples` and rebuilds the
  `rawScores` array from `samples.map(sample => sample.rawScore)`; it changes no
  seed, no policy, no scoring call, no percentile.
- The profile is a **separate derived artifact**. It MUST NOT be added to the
  `ParSimulationResult` type, the hashed PAR artifact body, or the PAR index —
  those are WP-050 locked contracts. A B-packet must not modify an A-packet
  contract file's shape.
- The profile is **never** a competitive input, never read back into gameplay,
  never a save-game — it is a diagnostic derived record (persistence-boundary:
  derived record, not state).
- No `.reduce()` with branching in the aggregation — use explicit `for...of`
  loops with descriptive variables (median/quartile computation on sorted copies).
- Simulation files (`par.aggregator.ts`, `par.profile.ts`) must not import
  `boardgame.io`; filesystem IO lives only in `par.storage.ts`.

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask before
  proceeding — never guess field names, type shapes, or file paths.

**Locked contract values (do not re-derive):**
- **`PAR_PERCENTILE_DEFAULT = 55`** (par.aggregator.ts) — the profile does not
  change the percentile; it exposes the full per-turn distribution the percentile
  is drawn from.
- **`EndgameOutcome`** = `'heroes-win' | 'scheme-wins' | 'tie'` (endgame.types.ts).
  The `PerGameSample.outcome` union adds `'unresolved'` for a game that hit the
  turn/move safety cap (`evaluateEndgame` returned `null`).
- **`MatchSetupConfig` fields** (9, locked): `schemeId`, `mastermindId`,
  `villainGroupIds`, `henchmanGroupIds`, `heroDeckIds`, `bystandersCount`,
  `woundsCount`, `officersCount`, `sidekicksCount`.
- **Reference scenario for the WP's worked example** (documentation only, not a
  committed artifact): `midtown-bank-robbery::magneto::brotherhood`, 1 player.

---

## Debuggability & Diagnostics

- The profile is fully reproducible: identical `(baseSeed, simulationCount,
  setupConfig, scoringConfig)` produces byte-identical samples and therefore a
  byte-identical profile (a determinism test pins this).
- Every aggregate is externally observable and independently recomputable from
  the `PerGameSample[]` rows — no hidden state.
- This packet mutates no `G` state and adds no `G` field; runtime state remains
  JSON-serializable and the endgame hashes are unaffected.
- Failures localize to two surfaces only: the aggregation math (unit-tested
  against a hand-built sample array with known medians) or the profile
  write/read round-trip (unit-tested against a temp directory).

---

## Scope (In)

### A) Per-game sample seam — `par.aggregator.ts` (modified)
- Add an exported interface `PerGameSample` with fields: `turnCount: number`,
  `rawScore: number`, `victoryPoints: number`, `bystandersRescued: number`,
  `schemeTwistCount: number`, `escapes: number`,
  `outcome: 'heroes-win' | 'scheme-wins' | 'tie' | 'unresolved'`.
  `schemeTwistCount` uses the canonical `G.counters.schemeTwistCount` name (not a
  new synonym); source it from `finalState.counters.schemeTwistCount ?? 0`
  (equal to `inputs.penaltyEventCounts.schemeTwistNegative` per D-24340).
- Add an exported function
  `generateScenarioParSamples(config: ParSimulationConfig, registry:
  CardRegistryReader): PerGameSample[]` that runs the identical per-seed loop
  (`generateSeedSet` → `createCompetentHeuristicPolicy` → `simulateOneGame` →
  `deriveScoringInputsFromFinalState` → `computeRawScore`) and additionally reads
  `evaluateEndgame(finalState)` for the `outcome` (`null` → `'unresolved'`, the
  safety-cap game). Map `victoryPoints` / `bystandersRescued` / `escapes` from
  the derived `inputs`, and `schemeTwistCount` from
  `finalState.counters.schemeTwistCount ?? 0` — the same counter read
  `deriveScoringInputsFromFinalState` uses, so the sample stays symmetric with the
  live score.
- Refactor `generateScenarioPar` to call `generateScenarioParSamples` internally
  and build its `rawScores` array from the returned samples — no other change to
  its body, its result shape, or its `parValue`.
- Add `// why:` on `generateScenarioParSamples` explaining it reuses the WP-049
  loop so the emitted rows are the exact games `generateScenarioPar` scores.

### B) Profile aggregation — `par.profile.ts` (new)
- Export `ParTurnBin` (`turnCount`, `gameCount`, `medianRawScore`,
  `p25RawScore`, `p75RawScore`, `winRate`, `medianVictoryPoints`) and
  `ParTurnDistributionProfile` (`scenarioKey`, `sampleSize`, `winCount`,
  `lossCount`, `stuckAtCapCount`, `minWinningTurn: number | null`,
  `monotoneImproving: boolean`, `bins: ParTurnBin[]`,
  `simulationPolicyVersion`, `scoringConfigVersion`).
- Export `aggregateTurnDistributionProfile(scenarioKey: ScenarioKey, samples:
  PerGameSample[], simulationPolicyVersion: string, scoringConfigVersion:
  number): ParTurnDistributionProfile`. Bins exclude `outcome === 'unresolved'`
  games (counted in `stuckAtCapCount`); `bins` sorted ascending by `turnCount`.
- `monotoneImproving` = the median Raw Score is non-increasing (lower = better)
  across bins with `gameCount >= PROFILE_MIN_BIN_SIZE` — the fidelity signal.
  Vacuous case: fewer than 2 qualifying bins ⇒ `monotoneImproving` is `true`
  (nothing contradicts monotonicity); a test pins this.
- Nearest-rank median/quartile on sorted copies via explicit `for` loops (no
  `.reduce()` with branching). Add `// why:` on `monotoneImproving` naming it a
  difficulty-fidelity signal, not a strategy guide (the calibration-wiki caveat).
- Export `PROFILE_MIN_BIN_SIZE` (the minimum `gameCount` for a bin to count
  toward the monotone check).

### C) Profile persistence — `par.storage.ts` (modified)
- Add `writeParProfileArtifact(profile, basePath, version)` and
  `readParProfileArtifact(scenarioKey, basePath, version)` writing to a
  **separate** `<basePath>/profile/<version>/<scenarioKeyToFilename>` tree —
  never the `seed` / `simulation` PAR trees, never the PAR index.
- The profile artifact is canonical-JSON (sorted keys) and carries an explicit
  `"derived": true` / `"authoritative": false` marker so no future reader mistakes
  it for a PAR baseline. Reuse `scenarioKeyToFilename`.
- `writeParProfileArtifact` **overwrites** an existing profile — the profile is a
  regenerable derived artifact. Do NOT copy the PAR artifact's lock-on-exist
  behavior (that immutability is for the hashed competitive baseline, not for a
  derived diagnostic).
- Add `// why:` noting the profile is a derived, non-authoritative record under
  the same D-5001 IO carve-out, deliberately separate from the immutable PAR
  artifact (D-24405).

### D) Tests
- `par.profile.test.ts` (new, `node:test`): aggregation over a hand-built
  `PerGameSample[]` with known medians/quartiles/win-rate; `bins` sorted and
  exclude `unresolved`; `monotoneImproving` true for a strictly-improving fixture,
  false for a peaked fixture, and true (vacuously) for a fixture with fewer than 2
  qualifying bins; `stuckAtCapCount` / `minWinningTurn` correct (and `null` when no
  win); `JSON.parse(JSON.stringify(profile))` round-trips equal.
- `par.aggregator.test.ts` (modified): `generateScenarioParSamples` returns
  exactly `simulationCount` rows against the existing mock registry; and a
  **regression pin** — `generateScenarioPar(config).parValue` equals a **hardcoded
  numeric literal** captured from `main` before the refactor for the fixed test
  config (`generatedAtOverride`-pinned). A self-comparison or in-test re-run of
  `generateScenarioPar` does NOT satisfy the pin — the literal is the oracle.
- `par.storage.test.ts` (modified): write-then-read a profile to a temp dir
  round-trips; the profile lands under `profile/<version>/`, not the PAR trees; and
  a second write overwrites the first (regenerable — no lock-on-exist).
- No test imports `boardgame.io`; all use `node:test` + `node:assert`.

### E) Public surface — `index.ts` (modified)
- Re-export `generateScenarioParSamples`, `PerGameSample`,
  `aggregateTurnDistributionProfile`, `ParTurnDistributionProfile`, `ParTurnBin`,
  and the profile storage read/write from the engine barrel (and `/setup` for the
  storage writers, matching where the PAR storage writers are exported).

---

## Out of Scope

- No rendering surface — the `/coverage` panel, the scoring-wiki figure, and any
  dashboard/chart work are a **separate follow-up WP**.
- No cross-scenario sweep — batch-generating profiles for all scenarios and
  ranking the "too-easy" ones is the follow-up WP; this packet ships the
  per-scenario functions + storage + tests only.
- No change to `ParSimulationResult`, the hashed PAR artifact body, the PAR
  index, or `computeRawScore` / `computeParScore` — all locked A-packet contracts.
- No new `G` field, no change to `finalStateHash` / `PRE_WP080_HASH`, no
  persistence of `G`.
- No change to the T2 policy, the seed derivation, or the percentile selection.
- Refactors or "while I'm here" cleanups beyond the `generateScenarioPar` routing
  change are out of scope.

---

## Files Expected to Change

- `packages/game-engine/src/simulation/par.aggregator.ts` — **modified** — add
  `PerGameSample` + `generateScenarioParSamples`; route `generateScenarioPar`
  through it (parValue unchanged).
- `packages/game-engine/src/simulation/par.profile.ts` — **new** — profile types
  + `aggregateTurnDistributionProfile` + `PROFILE_MIN_BIN_SIZE`.
- `packages/game-engine/src/simulation/par.storage.ts` — **modified** — derived
  profile write/read to a separate `profile/<version>/` tree.
- `packages/game-engine/src/index.ts` — **modified** — re-export the new public
  surface.
- `packages/game-engine/src/simulation/par.profile.test.ts` — **new** —
  `node:test` aggregation + round-trip coverage.
- `packages/game-engine/src/simulation/par.aggregator.test.ts` — **modified** —
  samples-count test + parValue-unchanged regression pin.
- `packages/game-engine/src/simulation/par.storage.test.ts` — **modified** —
  profile write/read round-trip to a temp dir.

No other **code** files may be modified.

**Governance / closeout docs (expected out-of-band edits, exempt from the
code-scope `git diff --name-only` check):** `docs/ai/STATUS.md`,
`docs/ai/DECISIONS.md` (flip D-24405 to Active), `docs/ai/work-packets/WORK_INDEX.md`
(check off WP-596), `docs/ai/execution-checklists/EC_INDEX.md` (flip EC-631 to
Done), `docs/05-ROADMAP-MINDMAP.md` (flip the node glyph to `✅` +
`roadmap:counts:write`). These are the standard closeout edits the Definition of
Done mandates; they are NOT scope violations.

---

## Vision Alignment

- **Vision clauses touched:** §20, §22, §24, §26 (PAR scoring, deterministic
  replay-faithful measurement, competitive integrity, simulation-calibrated PAR).
- **Conflict assertion:** No conflict: this WP preserves all touched clauses. It
  adds a derived observability layer over the existing PAR simulation and does
  not alter the `parValue`, the percentile rule, the hashed PAR artifact, or any
  competitive input.
- **Non-Goal proximity check:** None of NG-1..7 are crossed — the profile is an
  internal diagnostic, not a paid, persuasive, or pay-to-win surface, and it is
  never a competitive score input.
- **Determinism preservation:** The change is deterministic and replay-faithful.
  `generateScenarioParSamples` runs the identical seeded per-game loop
  (`mulberry32` two-domain PRNG, D-3604); identical inputs yield byte-identical
  samples and profile. No `Math.random()`, no wall-clock read enters the samples
  or the profile (the only timestamp is the storage layer's existing pattern).
  `generateScenarioPar`'s `parValue` is regression-pinned byte-identical.

---

## Acceptance Criteria

### A) Per-game sample seam
- [ ] `par.aggregator.ts` exports `PerGameSample` with exactly 7 fields:
      `turnCount`, `rawScore`, `victoryPoints`, `bystandersRescued`,
      `schemeTwistCount`, `escapes`, `outcome`.
- [ ] `generateScenarioParSamples(config, registry)` returns an array of length
      exactly `config.simulationCount`.
- [ ] `generateScenarioPar(config).parValue` is unchanged by the refactor — a
      regression test asserts it equals a **hardcoded numeric literal** captured
      from `main` before the refactor (not a self-comparison / in-test re-run).

### B) Profile aggregation
- [ ] `aggregateTurnDistributionProfile` returns `bins` sorted ascending by
      `turnCount`, excluding `outcome === 'unresolved'` games.
- [ ] `stuckAtCapCount` equals the number of `unresolved` samples; `winCount` +
      `lossCount` + tie-count + `stuckAtCapCount` equals `sampleSize`.
- [ ] `monotoneImproving` is `true` for a strictly-improving fixture, `false`
      for a peaked fixture, and `true` (vacuously) for a fixture with fewer than 2
      qualifying bins.
- [ ] `minWinningTurn` equals the smallest `turnCount` among `heroes-win`
      samples, or `null` when there are none.

### C) Profile persistence
- [ ] A written profile lands under `<basePath>/profile/<version>/`, not the
      `seed` or `simulation` trees, and carries `authoritative: false`.
- [ ] `readParProfileArtifact` round-trips a written profile to structural
      equality.
- [ ] A second `writeParProfileArtifact` for the same scenario overwrites the
      first (no lock-on-exist — the profile is regenerable).

### Tests & scope
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all files).
- [ ] `JSON.parse(JSON.stringify(profile))` equals the profile (round-trip).
- [ ] No new or modified simulation file imports `boardgame.io` (confirmed with
      `Select-String`).
- [ ] No `Math.random` in any new or modified file (confirmed with `Select-String`).
- [ ] No **code** files outside the 7 listed in `## Files Expected to Change` were
      modified; the only other changes are the governance/closeout docs named there
      (STATUS / DECISIONS / WORK_INDEX / EC_INDEX / ROADMAP-MINDMAP) — confirmed with
      `git diff --name-only`.

---

## Verification Steps

```pwsh
# Step 1 — build after all changes
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm no boardgame.io import in the simulation aggregation files
Select-String -Path "packages\game-engine\src\simulation\par.aggregator.ts","packages\game-engine\src\simulation\par.profile.ts" -Pattern "boardgame.io"
# Expected: no output

# Step 4 — confirm no Math.random in new/modified files
Select-String -Path "packages\game-engine\src\simulation\par.profile.ts","packages\game-engine\src\simulation\par.aggregator.ts" -Pattern "Math.random"
# Expected: no output

# Step 5 — confirm the profile artifact is written to a separate tree
Select-String -Path "packages\game-engine\src\simulation\par.storage.ts" -Pattern "profile/"
# Expected: at least one match (the profile/<version>/ path)

# Step 6 — confirm no files outside scope were changed
git diff --name-only
# Expected: the 7 code files in ## Files Expected to Change, plus the
# governance/closeout docs (STATUS.md, DECISIONS.md, WORK_INDEX.md,
# EC_INDEX.md, 05-ROADMAP-MINDMAP.md) — and nothing else
```

---

## Definition of Done

This packet is complete when ALL of the following are true:

- [ ] **User-visible verification:** the surface is `none — infrastructure`, so
      `docs/ai/STATUS.md` states plainly **"No user-observable change —
      infrastructure only"** with the payoff named (a derived per-scenario
      turn-distribution artifact + the engine seam a later WP renders and sweeps).
- [ ] All acceptance criteria above pass.
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0.
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files).
- [ ] `generateScenarioPar` `parValue` regression pin passes (byte-identical).
- [ ] No `boardgame.io` import in `par.aggregator.ts` / `par.profile.ts`
      (confirmed with `Select-String`).
- [ ] No `Math.random` in any new or modified file (confirmed with `Select-String`).
- [ ] No **code** files outside the 7 listed in `## Files Expected to Change` were
      modified; the only other changes are the governance/closeout docs named there
      (STATUS / DECISIONS / WORK_INDEX / EC_INDEX / ROADMAP-MINDMAP) — confirmed with
      `git diff --name-only`.
- [ ] `docs/ai/STATUS.md` updated — the new derived profile capability + engine
      seam; the render surface + sweep are named as the deferred follow-up.
- [ ] `docs/ai/DECISIONS.md` updated — D-24405 flipped to Active
      (post-execution): the derived-non-authoritative profile artifact, the
      parValue-unchanged refactor pin, and the monotone-improving fidelity signal.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-596 checked off with today's date.
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` has the EC-631 row flipped to Done.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node flipped to `✅` and `pnpm
      roadmap:counts:check` exits 0.

---

## Lint Gate Self-Review

00.3 lint self-review (all 21 sections resolved):

- **§1 Structure** — PASS. All required sections present and non-empty.
- **§2 Non-Negotiable Constraints** — PASS. Engine-wide + packet-specific +
  session protocol + locked values present; full file contents required; diffs
  forbidden; cites 00.6.
- **§3 Assumes** — PASS. Every dependency WP, file export, and build/test state
  listed.
- **§4 Context** — PASS. ARCHITECTURE.md persistence section, .claude/rules
  import rules, 00.2, 00.6, DECISIONS all cited by section.
- **§5 Files Expected to Change** — PASS. 7 files, each new/modified with a
  one-line description; bounded; no ambiguous output language.
- **§6 Naming** — PASS. `victoryPoints`, `schemeTwistCount` (canonical
  `G.counters` name), MatchSetupConfig fields match canonical spelling; no
  invented field names.
- **§7 Dependency Discipline** — PASS. No new npm dependency; `node:test` only.
- **§8 Architectural Boundaries** — PASS. Derived record, not live state; no `G`
  persisted; simulation files import no `boardgame.io`; IO only under D-5001.
- **§9 Windows Compatibility** — PASS. Verification uses `pwsh` + `Select-String`.
- **§10 Env Vars** — N/A. No environment variables introduced.
- **§11 Authentication** — N/A. No authentication surface touched.
- **§12 Test Quality** — PASS. `node:test` + `node:assert`; no boardgame.io;
  determinism/round-trip tests included.
- **§13 Verification Steps** — PASS. Exact `pnpm` commands with expected output.
- **§14 Acceptance Criteria** — PASS. Binary, observable, specific; aligned with
  scope.
- **§15 Definition of Done** — PASS. STATUS.md / DECISIONS.md / WORK_INDEX.md +
  scope-boundary check present; `none — infrastructure` DoD path used per §15.1.
- **§16 Code Style** — PASS. No premature abstraction; explicit `for...of` (no
  branching `.reduce()`); full names; small functions; `// why:` required.
- **§17 Vision Alignment** — PASS (triggered: scoring/PAR/simulation). See
  `## Vision Alignment`; clauses §20/§22/§24/§26 cited; determinism line present.
- **§18 Prose-vs-Grep** — PASS. Grep steps target `boardgame.io` / `Math.random`
  / `profile/`; no adjacent prose enumerates those tokens verbatim outside the
  grep intent.
- **§19 Bridge-vs-HEAD** — N/A. This WP is not a repo-state-summarizing artifact.
- **§20 Funding Surface Gate** — N/A. No funding surfaces, navigation
  affordances, or user-visible funding copy; engine + derived-artifact only.
- **§21 API Catalog** — N/A. No HTTP endpoint added/modified/removed and no
  `apps/server/src/**` library function touched; the render surface is deferred.
