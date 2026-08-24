# WP-598 — /coverage PAR Fidelity Panel (tiles + ranked table + per-scenario sweet-spot curve)

**Status:** Ready
**Primary Layer:** App (apps/dashboard) + build-time data bundle
**Dependencies:** WP-597 (PAR profile sweep + fidelity report), WP-596 (turn-distribution profile), WP-487/WP-259 (the /coverage build-bundle + composable precedent)
**User-Visible Surface:** dashboard (a new "PAR Fidelity" panel on dashboard.legendary-arena.com/coverage)

---

## Session Context

WP-597 committed the PAR sweep artifacts (`data/par/profile/v1/fidelity-report.json` + 128 per-scenario profiles) and rendered them only on the ewiki; WP-487/WP-259 established the dashboard's build-time-bundle → gitignored `src/data` → Zod/cast composable pattern that `/coverage` already uses — this packet renders the WP-597 data on `/coverage` using that exact pattern plus the existing `echarts` charting.

---

## Goal

After this session the operator `/coverage` page carries a new **PAR Fidelity**
panel that visualizes the WP-597 sweep: summary stat tiles (scenarios swept, %
winnable, too-easy vs unwinnable counts), a ranked **too-easy** table (win rate,
first-winning turn, monotone flag, stuck-at-cap), and — on clicking a row — an
expanded per-scenario **turns-vs-score sweet-spot curve** (median Raw Score with
a p25/p75 band, per turn). The WP-597 artifacts are bundled into the dashboard at
build time via the WP-487 pattern and read through a new Zod-free cast composable.
Everything is labeled a **fidelity diagnostic**, never competitive PAR.

---

## User-Visible Impact

An operator opening dashboard.legendary-arena.com/coverage sees, below the
existing Mechanic Coverage tables, a new PAR Fidelity panel: at-a-glance tiles
(e.g. "122/128 winnable"), a ranked list of the scenarios the current engine
makes too easy (Red Skull / Magneto legs at the top, Legacy Virus at the
bottom), and a click-to-expand curve showing how score evolves with game length
for any scenario. It is read-only diagnostic tooling for prioritizing
ability-coverage work.

---

## Assumes

- WP-597 complete on `main`: `data/par/profile/v1/fidelity-report.json` (128
  ranked scenarios + `skipped[]`) and 128 per-scenario profiles
  `data/par/profile/v1/<scenarioKey with :: → --, + → _>.json` are committed.
- `apps/dashboard` uses the build-bundle pattern: `scripts/build-coverage-ledger.mjs`
  / `build-effect-index.mjs` copy a root artifact into gitignored
  `apps/dashboard/src/data/`, read by a composable (`useCoverageLedger.ts` cast
  form; `useEffectIndex.ts` zod form). `apps/dashboard` has **no** local `zod`
  dependency (schemas come only via `@legendary-arena/registry/schema`).
- `apps/dashboard` charts on `echarts@^5.5.0` + `vue-echarts@^7.0.3` via
  `src/components/charts/BaseChart.vue`; `src/components/charts/SweepTrendChart.vue`
  is the line-chart reference (theme-color reading + `dashboard-theme-change`).
- CI job "Dashboard Gates" (`.github/workflows/ci.yml`) runs the `prebuild:*`
  scripts, `typecheck` (vue-tsc), `test:coverage` (thresholds lines 90 / branches
  80 / functions 88), `format:check`, `build`.
- `pnpm --filter @legendary-arena/dashboard build` exits 0 on `main`.

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

Before writing a single line:

- `apps/dashboard/src/pages/coverage/CoveragePage.vue` — read it entirely. The
  new panel appends a `<section>` reusing its scoped `.summary` / `.headline` /
  `.count-chip` / `.cov-table` / `.badge` classes and the `cov-<status>` color
  idiom; do not extract a new shared component for the tiles.
- `apps/dashboard/scripts/build-coverage-ledger.mjs` (+ `build-effect-index.mjs`)
  — the copy-root-artifact-into-src/data pattern to mirror: resolve REPO_ROOT,
  read the committed JSON, write into `src/data/`, **never throw** — write an
  empty stub with an `error` field on failure.
- `apps/dashboard/src/composables/useCoverageLedger.ts` — the cast-form composable
  (static import of the bundled JSON, `as unknown as T`, injectable
  `options?.ledger` for tests) to mirror.
- `apps/dashboard/src/components/charts/SweepTrendChart.vue` + `BaseChart.vue` —
  the ECharts line-chart reference: `readThemeColor` via `getComputedStyle`, the
  `dashboard-theme-change` `themeVersion` ref, and a `computed<EChartsOption>`.
- `apps/dashboard/scripts/check-generated-data.mjs` — the `GENERATED_DATA_FILES`
  guard a new bundle must be added to; `apps/dashboard/.gitignore` (explicit
  file list, not a wildcard); `apps/dashboard/package.json` (`prebuild:*` +
  `build` chain + `pretest*`).
- `.github/workflows/ci.yml` "Dashboard Gates" job — the `prebuild:*` step list to
  extend.
- `docs/ai/coverage/` is NOT the source here — the PAR source is
  `data/par/profile/v1/`. `wiki/par-simulation-calibration.md` explains the
  fidelity-diagnostic framing this panel must preserve.
- `docs/ai/DECISIONS.md` — D-24405 / D-24406 (the profile + sweep contracts),
  D-24292 / D-24035 (the /coverage bundle precedent); add D-24407.
- `docs/ai/REFERENCE/00.6-code-style.md` — Rules 4/6/8/9/11/13.
- `docs/01-VISION.md §20–26` — the calibration model this panel visualizes.

---

## Non-Negotiable Constraints

**Always apply — do not remove:**
- ESM only, Node v22+; `node:` prefix on built-ins; `.mjs` for the build script.
- No `Math.random()`; no new randomness — the panel renders committed data.
- Full file contents for every new or modified file — no diffs, no snippets.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`; no branching `.reduce()`.

**Packet-specific:**
- **App/client typecheck gate is mandatory** — `pnpm --filter @legendary-arena/dashboard
  typecheck` (vue-tsc --noEmit) MUST pass in Before-Starting and After-Completing.
  (`vite build` and `node:test`/tsx do not type-check.)
- The panel is **read-only**: it renders committed WP-597 data bundled at build
  time; it makes NO runtime fetch, adds NO `mocks.ts` entry, and touches NO
  server/API/engine code.
- The bundle build script **never throws** — on a missing/malformed source it
  writes an empty stub with an `error` field; the composable surfaces that error
  as an empty-but-legible panel (mirrors `useCoverageLedger`).
- Everything is labeled a **fidelity diagnostic**, not competitive PAR (a caption
  in the panel, mirroring the wiki framing) — it is never presented as a score.
- `apps/dashboard` gains **no** `zod` dependency — use a plain TS interface +
  cast (the `useCoverageLedger` form), not a new zod schema.
- The new `src/data/par-fidelity.json` bundle is **gitignored** and regenerated;
  it is added to `.gitignore` and `check-generated-data.mjs`, never committed.

**Session protocol:**
- If a dashboard component/composable/script API differs from this WP, STOP and
  surface it — never invent a dashboard or ECharts API.

**Locked contract values (do not re-derive):**
- **Source artifacts:** `data/par/profile/v1/fidelity-report.json` (fields per
  scenario: `scenarioKey`, `winRate`, `lossRate`, `minWinningTurn` (number|null),
  `monotoneImproving`, `stuckAtCapCount`, `binCount`, `sampleSize`, `tooEasyRank`;
  plus `generatedAt`, `sample`, `scenarioCount`, `skipped[]`) and the per-scenario
  profiles (`bins[]` = `{ turnCount, gameCount, medianRawScore, p25RawScore,
  p75RawScore, winRate, medianVictoryPoints }`; plus `winCount`, `lossCount`,
  `sampleSize`, `minWinningTurn`, `stuckAtCapCount`, `monotoneImproving`).
- **Report container key:** the 128 ranked rows live at `report.scenarios` (an
  array, already `tooEasyRank`-sorted); the report also carries `skippedCount` and
  `version` top-level (beyond the fields above). `useParFidelity` reads
  `report.scenarios` for its `rows`.
- **Cast tolerates extra fields:** the profiles also carry `authoritative`,
  `derived`, `scenarioKey`, `scoringConfigVersion`, `simulationPolicyVersion` at
  top level. The `as unknown as T` cast tolerates extras, so the `ParProfile` /
  `ParFidelityReport` interfaces declare only the consumed subset — omitting the
  rest is intentional, not an oversight.
- **scenarioKey → profile filename:** `scenarioKey.replaceAll('::','--').replaceAll('+','_') + '.json'`.
- **`medianRawScore` / p25 / p75 can be negative** — the chart y-axis must not
  assume ≥ 0 (lower is better).
- **Bundle shape** (the one combined file the build writes): `{ report: <the
  fidelity-report.json>, profiles: { [scenarioKey]: <the profile with bins[]> },
  error?: string }` — a single JSON keyed by scenarioKey so the panel needs no
  runtime filename derivation or 128 dynamic imports.

---

## Debuggability & Diagnostics

- Deterministic: the bundle is a byte-for-byte copy/merge of committed source;
  the panel renders it with no runtime state. Re-running the build is idempotent.
- The empty-stub path is observable — a missing source yields a panel that names
  the error, not a crash.
- No `G`, no engine state, no persistence — a client render of committed data.

---

## Scope (In)

### A) Build-time bundle — `apps/dashboard/scripts/build-par-fidelity.mjs` (new)
- Resolve `REPO_ROOT`, read `data/par/profile/v1/fidelity-report.json` and each
  per-scenario profile named by the scenarioKey transform, merge into the locked
  bundle shape, and write `apps/dashboard/src/data/par-fidelity.json`. Never
  throw — on any failure write `{ report: EMPTY_REPORT, profiles: {}, error }`.
- Mirror `build-coverage-ledger.mjs` structure + logging.

### B) Types — `apps/dashboard/src/types/parFidelity.ts` (new)
- Plain TS interfaces: `ParFidelityRow`, `ParFidelityReport`, `ParTurnBin`,
  `ParProfile`, `ParFidelityBundle`. No zod.

### C) Composable — `apps/dashboard/src/composables/useParFidelity.ts` (new)
- Static-import the bundle; cast to `ParFidelityBundle`; injectable
  `options?.bundle` for tests (mirror `useCoverageLedger`). Expose: the ranked
  `rows`, summary stats (`scenariosSwept`, `winnableCount`, `winnablePercent`,
  `tooEasyCount` (winRate ≥ a documented threshold), `unwinnableCount` (winRate
  0)), `getProfile(scenarioKey): ParProfile | null`, and the `error` string.
  Document the too-easy threshold inline with a `// why:`.

### D) Chart — a PURE option-builder + a thin wrapper (the `DrReadinessWidget` test precedent)
- **`apps/dashboard/src/components/charts/parSweetSpotOption.ts` (new)** — a PURE,
  exported `buildParSweetSpotOption(profile: ParProfile, colors: { line: string;
  band: string; axis: string; muted: string }): EChartsOption`. x = `turnCount`;
  a median-Raw-Score line series + a p25/p75 band (two bounding line series with a
  filled area between); y-axis allows negatives (NO `min: 0`); tooltip names turn,
  median, and game count. **This is where the test targets** — the dashboard test
  runner (`node --import tsx --test`) cannot load `.vue` files and the dashboard
  has no `@vue/test-utils`/`jsdom`, so the option logic MUST live in a pure `.ts`
  (the `DrReadinessWidget.test.ts` "test the data contract, not the mount" rule).
- **`apps/dashboard/src/components/charts/ParSweetSpotChart.vue` (new)** — a thin
  wrapper: props a `ParProfile`; resolve theme colors via `readThemeColor`
  (`getComputedStyle`) with the `dashboard-theme-change` `themeVersion` refresh
  (mirror `SweepTrendChart.vue`), pass them + the profile into
  `buildParSweetSpotOption`, and render through `BaseChart.vue`. No option logic of
  its own — it only resolves colors and delegates.

### E) Page — `apps/dashboard/src/pages/coverage/CoveragePage.vue` (modified)
- Append a `PAR Fidelity` `<section>`: a `.summary` tile row + a `.cov-table`
  ranked too-easy table (rank, scenario, win %, first-win turn, monotone, stuck)
  + a click-to-expand row that renders `ParSweetSpotChart` for the selected
  scenario's profile. Reuse the existing scoped classes. Add a one-line
  fidelity-diagnostic caption. On `error`, show the legible empty state.

### F) Wiring
- `apps/dashboard/package.json` — add `"prebuild:par"` and chain it into `build`;
  ensure the `pretest*` guard covers the new bundle.
- `apps/dashboard/.gitignore` — add `src/data/par-fidelity.json`.
- `apps/dashboard/scripts/check-generated-data.mjs` — add the `par-fidelity.json`
  entry with its `prebuild:par` remedy.
- `.github/workflows/ci.yml` "Dashboard Gates" — add a `prebuild:par` step before
  `typecheck`.

### G) Tests
- `apps/dashboard/src/composables/useParFidelity.test.ts` (new) — fixture-injected
  (`options.bundle`): rows ranked, summary stats correct, `getProfile` hit/miss,
  the `error`-stub path yields empty rows + the error string.
- `apps/dashboard/src/components/charts/parSweetSpotOption.test.ts` (new) — targets
  the PURE `buildParSweetSpotOption(fixtureProfile, fixtureColors)`: asserts the
  option has the median series + the p25/p75 band, a y-axis that is NOT `min: 0`
  (admits negatives), and the correct x-axis turn labels. No `.vue` mount, no
  test-utils. Meet the coverage thresholds.

---

## Out of Scope

- No change to the WP-597 sweep, the committed `data/par/profile/v1/**`, the
  engine, scoring, or any server/API code.
- No new route or nav entry — the panel is appended to the existing `/coverage`
  page.
- No runtime fetch / `mocks.ts` entry / live-mode toggle (build-time bundle path).
- No new npm dependency (echarts + vue-echarts already present; no zod added).
- No redesign of the existing Mechanic Coverage sections.

---

## Files Expected to Change

- `apps/dashboard/scripts/build-par-fidelity.mjs` — **new** — bundle builder.
- `apps/dashboard/src/types/parFidelity.ts` — **new** — TS interfaces.
- `apps/dashboard/src/composables/useParFidelity.ts` — **new** — cast composable.
- `apps/dashboard/src/components/charts/parSweetSpotOption.ts` — **new** — pure `buildParSweetSpotOption` (the testable option logic).
- `apps/dashboard/src/components/charts/ParSweetSpotChart.vue` — **new** — thin wrapper (resolve theme colors → `buildParSweetSpotOption` → `BaseChart`).
- `apps/dashboard/src/pages/coverage/CoveragePage.vue` — **modified** — the panel section.
- `apps/dashboard/package.json` — **modified** — `prebuild:par` + build chain.
- `apps/dashboard/.gitignore` — **modified** — the generated bundle.
- `apps/dashboard/scripts/check-generated-data.mjs` — **modified** — bundle guard entry.
- `.github/workflows/ci.yml` — **modified** — `prebuild:par` step in Dashboard Gates.
- `apps/dashboard/src/composables/useParFidelity.test.ts` — **new** — composable tests.
- `apps/dashboard/src/components/charts/parSweetSpotOption.test.ts` — **new** — pure option-builder tests.

No other **code** files may be modified (12 code files total).

**Governance / closeout docs (expected out-of-band edits, exempt from the
code-scope check):** `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24407 →
Active), `docs/ai/work-packets/WORK_INDEX.md` (WP-598 `[x]`),
`docs/ai/execution-checklists/EC_INDEX.md` (EC-633 → Done),
`docs/05-ROADMAP-MINDMAP.md` (`✅` + `roadmap:counts:write`).

---

## Vision Alignment

- **Vision clauses touched:** §20, §24, §26 (PAR scoring surface, competitive
  integrity, simulation-calibrated PAR) — a read-only operator render of the
  WP-597 diagnostic.
- **Conflict assertion:** No conflict: this WP renders existing derived data; it
  publishes no competitive PAR, changes no `parValue`, no scoring, no engine, and
  labels itself a fidelity diagnostic.
- **Non-Goal proximity check:** None of NG-1..7 crossed — an internal operator
  dashboard, not a paid/persuasive/pay-to-win player surface.
- **Determinism preservation:** No RNG, no engine path; the panel renders a
  deterministic build-time copy of committed data. (Vision §22 determinism is not
  affected — nothing here touches replay or scoring computation.)

---

## Acceptance Criteria

### Bundle + composable
- [ ] `pnpm --filter @legendary-arena/dashboard prebuild:par` writes
      `src/data/par-fidelity.json` in the locked bundle shape; a missing source
      yields the error stub, not a throw.
- [ ] `useParFidelity` (fixture-injected) returns ranked `rows`, correct summary
      stats, `getProfile` hit + null-miss, and surfaces the stub `error`.

### Chart + page
- [ ] The pure `buildParSweetSpotOption(profile, colors)` returns an
      `EChartsOption` with a median series + a p25/p75 band and a y-axis that
      admits negative values (unit-tested directly — no `.vue` mount).
- [ ] `/coverage` renders the PAR Fidelity tiles + ranked table; clicking a row
      expands that scenario's curve; the fidelity-diagnostic caption is present.

### Gates & scope
- [ ] `pnpm --filter @legendary-arena/dashboard typecheck` exits 0 (vue-tsc).
- [ ] `pnpm --filter @legendary-arena/dashboard test:coverage` passes the
      thresholds (lines 90 / branches 80 / functions 88).
- [ ] `pnpm --filter @legendary-arena/dashboard build` exits 0.
- [ ] `apps/dashboard` gains no `zod` dependency; no `mocks.ts` change (confirmed
      with `git diff`).
- [ ] No code files outside the 12 listed were modified; the only other changes
      are the governance/closeout docs (confirmed with `git diff --name-only`).

---

## Verification Steps

```pwsh
# Step 1 — bundle
pnpm --filter @legendary-arena/dashboard prebuild:par
# Expected: writes apps/dashboard/src/data/par-fidelity.json (report + profiles)

# Step 2 — typecheck (vue-tsc)
pnpm --filter @legendary-arena/dashboard typecheck
# Expected: exits 0

# Step 3 — tests with coverage thresholds
pnpm --filter @legendary-arena/dashboard test:coverage
# Expected: all pass; coverage thresholds met

# Step 4 — build
pnpm --filter @legendary-arena/dashboard build
# Expected: exits 0

# Step 5 — no zod added, no mocks change
Select-String -Path "apps\dashboard\package.json" -Pattern "\"zod\""
# Expected: no output
git diff --name-only apps/dashboard/src/services/mocks.ts
# Expected: no output

# Step 6 — scope
git diff --name-only
# Expected: the 12 listed code files + the governance/closeout docs, nothing else
```

---

## Definition of Done

This packet is complete when ALL of the following are true:

- [ ] **User-visible verification (D-24026):** the PAR Fidelity panel is confirmed
      live on the deployed dashboard.legendary-arena.com/coverage — tiles + ranked
      table render, and clicking a scenario expands its sweet-spot curve — with a
      screenshot or an observed-behavior note (tests + merge alone do not satisfy
      this).
- [ ] All acceptance criteria pass.
- [ ] `pnpm --filter @legendary-arena/dashboard typecheck` / `test:coverage` /
      `build` all exit 0.
- [ ] `.github/workflows/ci.yml` Dashboard Gates has the `prebuild:par` step.
- [ ] No `zod` added; no `mocks.ts` change; no code files outside the 12 listed
      (confirmed with `git diff --name-only`).
- [ ] `docs/ai/STATUS.md` updated — the PAR Fidelity panel + the top-of-ranking it
      surfaces.
- [ ] `docs/ai/DECISIONS.md` — D-24407 flipped to Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-598 checked off; `EC_INDEX.md`
      EC-633 → Done.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `✅` and `pnpm roadmap:counts:check` exits 0.

---

## Lint Gate Self-Review

00.3 lint self-review (all 21 sections resolved):

- **§1 Structure** — PASS. All required sections present and non-empty.
- **§2 Constraints** — PASS. Always-apply + packet-specific + session protocol +
  locked values; full file contents; cites 00.6.
- **§3 Assumes** — PASS. WP-597 data, the dashboard bundle pattern, echarts, and
  the CI gates listed.
- **§4 Context** — PASS. CoveragePage, the build scripts, useCoverageLedger,
  SweepTrendChart, check-generated-data, ci.yml, DECISIONS, 00.6, VISION cited.
- **§5 Files** — PASS. 12 code files + governance carve-out, each described.
- **§6 Naming** — PASS. Source field names (`winRate`, `minWinningTurn`,
  `medianRawScore`, etc.) match the WP-597 artifacts verbatim.
- **§7 Dependencies** — PASS. No new npm dep; echarts/vue-echarts present; no zod.
- **§8 Architecture** — PASS. App layer; read-only build-time bundle; no
  server/engine/persistence touch; frontend consumes bundled data (not R2/fetch).
- **§9 Windows** — PASS. Verification uses `pwsh` + `Select-String`.
- **§10 Env Vars** — N/A. None introduced.
- **§11 Authentication** — N/A. None touched.
- **§12 Test Quality** — PASS. `node:test`/vitest per the dashboard suite;
  fixture-injected; no network; coverage thresholds addressed.
- **§13 Verification** — PASS. Exact `pnpm --filter` commands with expected output.
- **§14 Acceptance** — PASS. Binary, observable, specific; aligned with scope.
- **§15 Definition of Done** — PASS. STATUS/DECISIONS/WORK_INDEX/EC_INDEX +
  scope-boundary + a live-on-surface item (surface = dashboard, D-24026).
- **§16 Code Style** — PASS. No premature abstraction (reuse CoveragePage scoped
  classes); explicit control flow; full names; `// why:` on the too-easy threshold.
- **§17 Vision Alignment** — PASS (triggered: scoring/PAR surface). Clauses
  §20/§24/§26 cited; determinism line present.
- **§18 Prose-vs-Grep** — PASS. Grep steps target `"zod"` / `mocks.ts`; no
  adjacent prose enumerates them as forbidden tokens.
- **§19 Bridge-vs-HEAD** — N/A. Not a repo-state-summarizing artifact.
- **§20 Funding Surface Gate** — N/A. No funding surface, nav affordance, or
  user-visible funding copy — an internal diagnostic panel.
- **§21 API Catalog** — N/A. No HTTP endpoint and no `apps/server/src/**`
  function touched; the data path is a build-time static bundle, not an API.
