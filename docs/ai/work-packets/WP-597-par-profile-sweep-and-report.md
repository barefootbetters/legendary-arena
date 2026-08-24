# WP-597 — PAR Profile Sweep + Too-Easy Fidelity Report + Scoring-Wiki Render

**Status:** Ready
**Primary Layer:** Shared Tooling (authoring-time script) + committed data + ewiki content
**Dependencies:** WP-596 (turn-distribution profile), WP-422 (seed-PAR generator + scenario enumeration), WP-049/050 (PAR simulation + storage)
**User-Visible Surface:** wiki (a new section on the scoring/PAR calibration ewiki page; the sweep itself and its committed artifacts are operator-facing tooling)

---

## Session Context

WP-596 shipped the per-scenario turn-distribution profile (`generateScenarioParSamples` + `aggregateTurnDistributionProfile` + `writeParProfileArtifact`, all on `main`) and explicitly deferred the cross-scenario sweep and render; WP-422's `scripts/generate-seed-par.mjs` already enumerates the active gauntlet season scenarios (`enumerateScenarios`, exported) — this packet composes those two into a sweep + a ranked fidelity report + a wiki render.

---

## Goal

After this session the repo has a Shared-Tooling sweep, `scripts/generate-par-profiles.mjs`, that runs the WP-596 profile pipeline across every active-season scenario, persists each profile under `data/par/profile/v1/`, and emits a committed, ranked **fidelity report** (`fidelity-report.json` + `fidelity-report.md`) that sorts scenarios by a *too-easy* signal — `monotoneImproving` plus a high overall win rate plus a low minimum winning turn. The report is the prioritization list for the ability-coverage work: it names, with real numbers, which scenarios the current (under-built) engine makes too easy. The scoring/PAR calibration ewiki page gains a section documenting the empirical curve, the sweep, and the real ranking.

---

## User-Visible Impact

A developer/operator reading the PAR calibration page on the ewiki
(`ewiki.legendary-arena.com`) sees a new section explaining the empirical
turns-vs-score profile and a ranked table of which scenarios the engine
currently under-implements (too-easy), derived from a real sweep. No
play/cards/dashboard surface changes. The sweep and its committed artifacts are
operator tooling, not an end-player feature; everything produced is an explicit
**diagnostic**, never a published competitive PAR.

---

## Assumes

- WP-596 complete on `main`. Specifically:
  - `@legendary-arena/game-engine` exports `generateScenarioParSamples`,
    `aggregateTurnDistributionProfile`, `PROFILE_MIN_BIN_SIZE`, and the types
    `PerGameSample` / `ParTurnDistributionProfile`.
  - `@legendary-arena/game-engine/setup` exports `writeParProfileArtifact`,
    `readParProfileArtifact`, and `loadScoringConfigForScenario`.
  - `@legendary-arena/game-engine` exports `PAR_PERCENTILE_DEFAULT` and
    `buildScenarioKey`; `@legendary-arena/registry/playerCountSetup` exports
    `resolveEffectiveHeroCount` (3-arg: `schemeId, numPlayers, baseHeroCount`) and
    `getPlayerCountSetup`.
- WP-422 complete: `scripts/generate-seed-par.mjs` exports `enumerateScenarios`
  and reads `data/gauntlet-configs.json` via `validateGauntletConfigs`. It also
  wrote the committed per-scenario `data/scoring-configs/<key>.json` surface
  (the `scoringConfig` source this sweep loads — 128 configs for the active season).
- `@legendary-arena/registry` exports `createRegistryFromLocalFiles`
  (`{ metadataDir, cardsDir }`); `@legendary-arena/registry/gauntletConfigs`
  exports `getGauntletConfig(setAbbr, mastermindSlug, schemeSlug, playerCount)`,
  which returns `{ villainGroupIds, henchmanGroupIds }` scaled per player count
  (or `undefined` when the leg/setup is absent).
- `data/cards` + `data/metadata` are present (the local-fs registry inputs), and
  the fixed hero pool (locked value below) resolves to real set-qualified hero
  ext_ids in `data/cards`.
- `pnpm -r build` exits 0 on `main` (the sweep imports built `dist`).

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `scripts/generate-seed-par.mjs` — read it entirely. Reuse `enumerateScenarios`
  and mirror its committed-data delivery model, canonical-JSON writing, and
  fixed-timestamp determinism discipline. Do not modify it.
- `packages/game-engine/src/simulation/par.aggregator.ts §generateScenarioParSamples`
  and `par.profile.ts §aggregateTurnDistributionProfile` (WP-596) — the pipeline
  this sweep drives; do not modify them.
- `packages/game-engine/src/simulation/par.storage.ts §writeParProfileArtifact`
  — the profile writer (writes to `profile/<version>/`, overwrites).
- `packages/game-engine/src/simulation/par.aggregator.ts §ParSimulationConfig`
  (the 10-field wrapper `generateScenarioParSamples` takes) and
  `§generateScenarioParSamples` — the exact input contract; the sweep assembles
  this wrapper, not a bare `MatchSetupConfig`.
- `packages/game-engine/src/scoring/scoringConfigLoader.ts` — `loadScoringConfigForScenario`;
  and `data/scoring-configs/*.json` — the committed `ScenarioScoringConfig` surface.
- `packages/registry/src/gauntletConfigs.ts §getGauntletConfig`
  and `packages/registry/src/playerCountSetup.ts §resolveEffectiveHeroCount` /
  `§getPlayerCountSetup` — the henchman-composition and scheme-aware hero-count
  sources (both in the **registry** package, reached via its `/gauntletConfigs`
  and `/playerCountSetup` subpaths).
- `wiki/par-simulation-calibration.md` — the page this WP adds a section to; read
  the "Why simulation, not a formula" and "Phase 1 / Prerequisite" sections so
  the new section is consistent with the "a baseline for a different, easier
  game" caveat this report operationalizes.
- `.claude/rules/architecture.md §Layer Boundary` (Shared Tooling row) — the
  sweep is authoring-time tooling that MAY import the engine + registry, but is
  never on the runtime path and never imported by production code.
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 4 (no abbreviations), Rule 6
  (`// why:`), Rule 8 (no branching `.reduce()`), Rule 9 (`node:` prefix), Rule
  11 (full-sentence errors), Rule 13 (ESM only).
- `docs/ai/DECISIONS.md` — D-24405 (the profile contract), D-24242 (seed PAR
  delivery model), D-5001 (simulation IO carve-out); add D-24406.
- `docs/01-VISION.md §26` and `§20–25` — the calibration model this diagnostic
  serves (see `## Vision Alignment`).

---

## Non-Negotiable Constraints

**Always apply — do not remove:**
- ESM only, Node v22+ — `import`/`export`, `.mjs`, never `require()`.
- `node:` prefix on all Node built-in imports.
- No `Math.random()` anywhere — the games are deterministic via the WP-049 seeded
  PRNG (`baseSeed`); the sweep introduces no randomness of its own.
- The sweep is **authoring-time Shared Tooling** — it MAY import
  `@legendary-arena/game-engine`, `@legendary-arena/game-engine/setup`, and
  `@legendary-arena/registry`; it MUST NOT be imported by any runtime/production
  code, and it changes no engine, server, or app runtime source.
- Full file contents for every new or modified file — no diffs, no snippets.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.

**Packet-specific:**
- The sweep MUST NOT modify `generate-seed-par.mjs`, any `packages/game-engine`
  source, or any PAR seed/sim artifact — it only READS the enumeration + engine
  API and WRITES to `data/par/profile/` (never `data/par/seed` or `data/par/sim`).
- Every produced artifact is a **diagnostic**: `derived: true` /
  `authoritative: false` on profiles (via `writeParProfileArtifact`), and the
  report explicitly labels itself non-competitive. Nothing here is published as a
  calibrated PAR or read by the server gate.
- A per-scenario failure (bad setup, engine error) MUST be caught, recorded in
  the report's `skipped` list with the reason, and MUST NOT abort the sweep.
- Determinism: a re-run with the same `--sample` and season inputs produces a
  byte-identical report (fixed timestamps, sorted keys, canonical JSON) — the
  same discipline as `generate-seed-par.mjs`.
- No `.reduce()` with branching; explicit `for...of`.

**Session protocol:**
- If a contract, field name, or the setup-composition shape is unclear, stop and
  ask — never guess field names or invent a registry API.

**Locked contract values (do not re-derive):**
- **`MatchSetupConfig` fields** (9): `schemeId`, `mastermindId`,
  `villainGroupIds`, `henchmanGroupIds`, `heroDeckIds`, `bystandersCount`,
  `woundsCount`, `officersCount`, `sidekicksCount`.
- **Profile artifact tree:** `data/par/profile/<version>/` (WP-596 / D-24405) —
  separate from `data/par/seed/` and `data/par/sim/`.
- **`PROFILE_MIN_BIN_SIZE`** and the profile fields come from WP-596 — the sweep
  consumes them, never redefines them.
- **Fixed hero pool** (the documented diagnostic loadout, sliced per scenario to
  `resolveEffectiveHeroCount`): `core/spider-man`, `core/hulk`, `core/wolverine`,
  `core/black-widow`, `core/cyclops`, `core/iron-man` — 6 core heroes, enough for
  the Secret Invasion 6-hero override. (Execution verifies each id resolves in
  `data/cards`; a scheme needing >6 is recorded as a skip, not a crash.)
- **`ParSimulationConfig` non-setup fields:** `percentile` = `PAR_PERCENTILE_DEFAULT`
  (55, imported), `simulationPolicyVersion` = `'CompetentHeuristic/v1'`,
  `scoringConfigVersion` = the loaded config's version, `baseSeed` =
  `` `par-profile-${scenarioKey}` ``. `scoringConfig` is LOADED via
  `loadScoringConfigForScenario` — never re-derived.
- **Coverage caveat (intended, not a gap to fix):** `enumerateScenarios`'
  representative `playerCount ∈ {1,2,3,5}` — no 4-player scenario is measured, and
  a 3-villain leg is measured only at 3p. This mirrors the seed-PAR approximation
  (WP-422) and is stated in the report + wiki, not silently dropped.

---

## Debuggability & Diagnostics

- The sweep is fully reproducible: identical season inputs + `--sample` yield a
  byte-identical report and byte-identical profiles (seeded games, fixed
  timestamps, canonical JSON).
- Every ranked row is independently recomputable from its persisted profile.
- The sweep writes no `G`, mutates no engine state, and touches only
  `data/par/profile/`; failures localize to a named scenario in the `skipped`
  list.
- Progress is logged per scenario (scenario key, games run, outcome mix) so a
  long run is observable, not a black box.

---

## Scope (In)

### A) The sweep script — `scripts/generate-par-profiles.mjs` (new, Shared Tooling)
- CLI: `node scripts/generate-par-profiles.mjs [--version v1] [--sample 200] [--limit N] [--base-seed <s>]`.
  - `--sample` = games per scenario (default 200). `--limit` caps the scenario
    count for a smoke run. `--version` = the `profile/<version>/` directory.
  - **Volume note:** the active season is ~128 scenarios; the committed run
    (`--sample 200`) is ~25k full-engine games (~15–40 min) plus a byte-identical
    re-run for the determinism check. Execution MAY lower the committed `--sample`
    (e.g. 150) if wall-clock is a concern — the too-easy signal is robust to
    sample size; record the sample used in the report.
- Steps:
  1. `createRegistryFromLocalFiles({ metadataDir: 'data/metadata', cardsDir: 'data/cards' })` once.
  2. `enumerateScenarios(validateGauntletConfigs(...))` (reuse WP-422). Each row is
     `{ scenarioKey, mastermindExtId, schemeExtId, villainExtIds, playerCount }`
     — **villains only** (no henchmen, no heroes); `playerCount ∈ {1,2,3,5}`.
  3. For each scenario, assemble a full **`ParSimulationConfig`** (the 10-field
     wrapper `generateScenarioParSamples` requires — NOT a bare `MatchSetupConfig`,
     which is only its `setupConfig` sub-field):
     - `setupConfig` (the 9-field `MatchSetupConfig`):
       - `schemeId` = `schemeExtId`, `mastermindId` = `mastermindExtId`,
         `villainGroupIds` = `villainExtIds` (from the enumeration).
       - `henchmanGroupIds` = the scaled henchman groups from
         `getGauntletConfig(setAbbr, mastermindSlug, schemeSlug, playerCount)`
         (`@legendary-arena/registry/gauntletConfigs`), which returns
         `{ villainGroupIds, henchmanGroupIds }` sliced per player count (or
         `undefined` → skip the scenario). The enumeration exposes no henchmen, so
         split the set-qualified `mastermindExtId` / `schemeExtId` into
         `setAbbr` + slug (e.g. `core/magneto` → `core`, `magneto`) to call it.
         (Fallback if a leg is missing: re-walk `data/gauntlet-configs.json`
         matched by `buildScenarioKey`; do NOT widen `enumerateScenarios`.)
       - `heroDeckIds` = the FIXED hero pool (locked value below) sliced to
         `resolveEffectiveHeroCount(schemeExtId, playerCount, getPlayerCountSetup(playerCount).heroCount)`
         (both from `@legendary-arena/registry/playerCountSetup`) — the 3-arg form
         passing the base `heroCount`, so scheme overrides (Secret Invasion 6,
         Super Hero Civil War 4-at-2p) get the correct count instead of the raw
         base.
       - supply counts: `bystandersCount: 30, woundsCount: 30, officersCount: 30, sidekicksCount: 12`.
     - `scenarioKey` = from the enumeration; `playerCount` = from the enumeration.
     - `simulationCount` = `--sample`.
     - `baseSeed` = `` `par-profile-${scenarioKey}` `` (deterministic, per-scenario).
     - `percentile` = `PAR_PERCENTILE_DEFAULT` (55, imported — not re-typed).
     - `scoringConfig` = `loadScoringConfigForScenario(scenarioKey, 'data/scoring-configs')`
       (`@legendary-arena/game-engine/setup`) — the committed 128-config surface
       `generate-seed-par.mjs` already wrote. Do NOT re-derive it (the private
       `buildScoringConfig` is scope-locked); the loaded config shapes the
       per-game `computeRawScore` and must match the seed-PAR scale.
     - `simulationPolicyVersion` = `'CompetentHeuristic/v1'`;
       `scoringConfigVersion` = the loaded config's `scoringConfigVersion`.
     - `generatedAtOverride` is omitted — samples carry no timestamp, so it is
       not needed for determinism here.
  4. Run `generateScenarioParSamples(parSimulationConfig, registry)` (wrapped in
     try/catch), `aggregateTurnDistributionProfile(...)`, `writeParProfileArtifact(...)`.
  5. Accumulate a report row per scenario.
- Add `// why:` on: the fixed hero pool + `resolveEffectiveHeroCount` (isolates
  mastermind/scheme/villain difficulty from the hero choice, and honors scheme
  hero-count overrides); the `loadScoringConfigForScenario` source (keeps the
  diagnostic on the seed-PAR scale, no re-derivation); and the per-scenario
  try/catch skip (assembling a valid `ParSimulationConfig` for arbitrary season
  content is NEW work with no `generate-seed-par` precedent — the skip is
  load-bearing, not defensive garnish).

### B) The ranked fidelity report — pure helpers in the same script
- A **locked comparator** producing the too-easy order (most-too-easy first),
  applied to the report rows:
  1. `monotoneImproving === true` before `false`;
  2. then higher overall `winRate` first;
  3. then lower `minWinningTurn` first (`null` — no win — sorts LAST, least
     too-easy);
  4. tie-break by `scenarioKey` ascending (stable, deterministic).
  Overall `winRate = winCount / (winCount + lossCount)` — resolved games only,
  `stuckAtCapCount` excluded; when `winCount + lossCount === 0`, `winRate = 0`.
  Assign each row a 1-based `tooEasyRank` from this order. The comparator is a
  fixed rule (not a scalar the executor invents) so it cannot collapse and is
  unit-testable.
- Write `data/par/profile/<version>/fidelity-report.json` (canonical JSON:
  ranked `scenarios[]` with `scenarioKey`, `sampleSize`, `winRate`,
  `lossRate`, `minWinningTurn`, `monotoneImproving`, `stuckAtCapCount`,
  `tooEasyRank`; plus `skipped[]` with reasons; plus a fixed `generatedAt` and
  `sample`).
- Write `data/par/profile/<version>/fidelity-report.md` — a human-readable ranked
  table (top too-easy scenarios first) for direct reading + copy into the wiki.

### C) Scoring-wiki render — `wiki/par-simulation-calibration.md` (modified)
- Add a section (e.g., "Empirical turn-distribution profile & the too-easy
  diagnostic") documenting: what a profile is, the sweep that produces the
  ranking, how to read the fidelity report, the real top-of-ranking results from
  this run, and the explicit framing that this is a **fidelity diagnostic**, not
  a calibrated PAR (tying back to the page's "different, easier game" caveat).
  Cross-link the WP-596 profile contract.

### D) Tests — `scripts/generate-par-profiles.test.ts` (new, `node:test`)
- Unit-test the **pure helpers** only (no full sweep run in CI): the
  `ParSimulationConfig` assembler for a known enumeration row + a stub
  scoring-config produces a wrapper with a valid 9-field `setupConfig` sub-object
  AND all required wrapper fields populated (`scoringConfig`, `percentile`,
  `baseSeed`, `simulationPolicyVersion`, `scoringConfigVersion`); the locked
  comparator orders a hand-built set of rows correctly (monotone before
  non-monotone; higher winRate first; lower minWinningTurn first; `null`
  minWinningTurn last; scenarioKey tie-break); and the report serializer produces
  canonical, round-trip-stable JSON. Pull the pure helpers out of the IO path so
  they are importable without running the sweep. No live registry, no full sweep,
  no `generateScenarioParSamples` call in CI.

---

## Out of Scope

- **No dashboard `/coverage` Vue panel** — the interactive visual render is a
  heavier, separate follow-up WP; this WP's render is the ewiki section.
- No change to `generate-seed-par.mjs`, any `packages/game-engine` source, the
  PAR seed/sim artifacts, the PAR index, or the server PAR gate.
- No publishing of profiles/report as competitive PAR — diagnostic only.
- No AI-strengthening (the reason the engine is too easy is out of scope; this WP
  only *measures* it).
- No new engine mechanic, no `G` change, no runtime code.

---

## Files Expected to Change

- `scripts/generate-par-profiles.mjs` — **new** — the sweep + report generator.
- `scripts/generate-par-profiles.test.ts` — **new** — `node:test` for the pure
  helpers.
- `data/par/profile/v1/**` — **new** — the per-scenario profile artifacts +
  `fidelity-report.json` + `fidelity-report.md` (committed diagnostic data).
- `wiki/par-simulation-calibration.md` — **modified** — the render section.

No other **code** files may be modified.

**Governance / closeout docs (expected out-of-band edits, exempt from the
code-scope check):** `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24406 →
Active), `docs/ai/work-packets/WORK_INDEX.md` (WP-597 `[x]`),
`docs/ai/execution-checklists/EC_INDEX.md` (EC-632 → Done),
`docs/05-ROADMAP-MINDMAP.md` (`✅` + `roadmap:counts:write`).

---

## Vision Alignment

- **Vision clauses touched:** §20, §22, §24, §26 (PAR scoring, deterministic
  replay-faithful measurement, competitive integrity, simulation-calibrated PAR).
- **Conflict assertion:** No conflict: this WP preserves all touched clauses. It
  produces a *diagnostic* over the existing simulation; it publishes no
  competitive PAR, alters no `parValue`, and touches no competitive input. It
  reinforces §26 by measuring where the engine is not yet rules-faithful enough to
  trust calibration.
- **Non-Goal proximity check:** None of NG-1..7 crossed — an internal fidelity
  diagnostic, not a paid/persuasive/pay-to-win surface.
- **Determinism preservation:** The sweep is deterministic and replay-faithful —
  it drives the WP-049 seeded per-game loop, adds no `Math.random()`, and writes
  canonical JSON with fixed timestamps so a re-run is byte-identical.

---

## Acceptance Criteria

### A) Sweep
- [ ] `node scripts/generate-par-profiles.mjs --limit 2 --sample 20` runs to
      completion, writes 2 profiles under `data/par/profile/v1/`, and a report.
- [ ] A scenario whose setup build or simulation throws is recorded in the
      report's `skipped[]` with a reason and does NOT abort the sweep.
- [ ] Profiles are written via `writeParProfileArtifact` (carry
      `derived: true` / `authoritative: false`); nothing is written under
      `data/par/seed/` or `data/par/sim/`.

### B) Report
- [ ] `fidelity-report.json` lists `scenarios[]` ordered most-too-easy first
      (`tooEasyRank` ascending, rank 1 = most too-easy), each with the documented
      fields, plus `skipped[]`.
- [ ] The too-easy comparator ranks a monotone + high-win-rate row above a
      non-monotone / low-win-rate row (unit-tested).
- [ ] `fidelity-report.md` renders a ranked human-readable table.
- [ ] Re-running with the same inputs produces a byte-identical report.

### C) Wiki
- [ ] `wiki/par-simulation-calibration.md` has a new section documenting the
      profile, the sweep, and the real ranking, explicitly framed as a fidelity
      diagnostic (not calibrated PAR); `pnpm run wiki-viewer:check-links` passes.

### Tests & scope
- [ ] `scripts/generate-par-profiles.test.ts` passes under `node:test`.
- [ ] No `Math.random` in the new script (confirmed with `Select-String`).
- [ ] No `packages/game-engine` source or `generate-seed-par.mjs` modified
      (confirmed with `git diff --name-only`).

---

## Verification Steps

```pwsh
# Step 1 — build (the sweep imports built dist)
pnpm -r build
# Expected: exits 0

# Step 2 — smoke run (bounded)
node scripts/generate-par-profiles.mjs --limit 2 --sample 20
# Expected: writes 2 profiles + fidelity-report.json/.md under data/par/profile/v1

# Step 3 — full run (commit the artifacts)
node scripts/generate-par-profiles.mjs --sample 200
# Expected: one profile per season scenario + the ranked report; skips recorded, no abort

# Step 4 — script unit tests
node --test scripts/generate-par-profiles.test.ts
# Expected: all pass

# Step 5 — determinism (re-run diffs clean)
node scripts/generate-par-profiles.mjs --sample 200; git diff --stat data/par/profile/v1/fidelity-report.json
# Expected: no diff (byte-identical re-run)

# Step 6 — no Math.random in the sweep
Select-String -Path "scripts\generate-par-profiles.mjs" -Pattern "Math.random"
# Expected: no output

# Step 7 — wiki link check
pnpm run wiki-viewer:check-links
# Expected: link-integrity check passes

# Step 8 — scope
git diff --name-only
# Expected: the scope files + data/par/profile/v1/** + the governance/closeout docs
```

---

## Definition of Done

This packet is complete when ALL of the following are true:

- [ ] **User-visible verification:** the new section is confirmed live on the
      deployed scoring/PAR calibration ewiki page (or, if the deploy is gated, the
      ungated `*.onrender.com` fallback per the ewiki deploy note), with the
      ranked table rendering.
- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` exits 0; `node --test scripts/generate-par-profiles.test.ts` passes.
- [ ] The full sweep ran and its artifacts (`data/par/profile/v1/**` incl. the
      report) are committed; a re-run diffs clean (determinism).
- [ ] No `packages/game-engine` source or `generate-seed-par.mjs` modified
      (confirmed with `git diff`).
- [ ] No `Math.random` in the new script (confirmed with `Select-String`).
- [ ] `docs/ai/STATUS.md` updated — the sweep + fidelity report capability and the
      real top-of-ranking finding; the dashboard render named as the deferred next.
- [ ] `docs/ai/DECISIONS.md` — D-24406 flipped to Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-597 checked off; `EC_INDEX.md`
      EC-632 → Done.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `✅` and `pnpm roadmap:counts:check` exits 0.

---

## Lint Gate Self-Review

00.3 lint self-review (all 21 sections resolved):

- **§1 Structure** — PASS. All required sections present and non-empty.
- **§2 Constraints** — PASS. Always-apply + packet-specific + session protocol +
  locked values; full file contents required; diffs forbidden; cites 00.6.
- **§3 Assumes** — PASS. WP-596/422/049/050 deps, exact exports, registry API,
  data inputs, build state listed.
- **§4 Context** — PASS. generate-seed-par.mjs, WP-596 sources, calibration wiki,
  architecture Shared-Tooling row, 00.6, DECISIONS all cited.
- **§5 Files** — PASS. New script + test + committed data + wiki, each described;
  bounded; no ambiguous output language.
- **§6 Naming** — PASS. MatchSetupConfig fields + profile fields match canonical
  spelling; no invented names.
- **§7 Dependencies** — PASS. No new npm dependency; `node:test` only.
- **§8 Architecture** — PASS. Shared Tooling — authoring-time only, never runtime;
  writes only `data/par/profile/`; no engine/G change.
- **§9 Windows** — PASS. Verification uses `pwsh` + `Select-String`.
- **§10 Env Vars** — N/A. None introduced.
- **§11 Authentication** — N/A. None touched.
- **§12 Test Quality** — PASS. `node:test`; pure-helper unit tests; no network/DB.
- **§13 Verification** — PASS. Exact `pnpm` / `node` commands with expected output.
- **§14 Acceptance** — PASS. Binary, observable, specific; aligned with scope.
- **§15 Definition of Done** — PASS. STATUS/DECISIONS/WORK_INDEX/EC_INDEX +
  scope-boundary + live-on-surface (wiki) present.
- **§16 Code Style** — PASS. No premature abstraction; explicit `for...of`; full
  names; small functions; `// why:` required.
- **§17 Vision Alignment** — PASS (triggered: scoring/PAR/simulation). See the
  block; clauses §20/§22/§24/§26 cited; determinism line present.
- **§18 Prose-vs-Grep** — PASS. Grep steps target `Math.random`; no adjacent prose
  enumerates it outside the grep intent.
- **§19 Bridge-vs-HEAD** — N/A. Not a repo-state-summarizing artifact (the report
  summarizes a sim run, not commit history).
- **§20 Funding Surface Gate** — N/A. No funding surfaces, nav affordances, or
  user-visible funding copy — a diagnostic tool + wiki doc.
- **§21 API Catalog** — N/A. No HTTP endpoint and no `apps/server/src/**` library
  function touched; the render is the ewiki, not an API.
