# WP-349 — Sweep Health Rate = Anomaly-Free Rate (fix the structural 0% left by the D-23503 `endgame-reached` healthy-class)

**Status:** Ready
**Primary Layer:** Client (`apps/dashboard`)
**Dependencies:** WP-235 (D-23503 healthy-class constant + `computeSweepHealthRate`), WP-234 (weekly full-corpus sweep), WP-209/195 (sweep anomaly taxonomy)
**User-Visible Surface:** dashboard.legendary-arena.com

> **Operator-visible metric fix.** The Pipeline page sweep health chip reads a
> hard **0%** on every real run; the trend chart is a flat zero line. Observable
> on the deployed dashboard, so D-24026 applies.

---

## Session Context

WP-235 (D-23503) made `SWEEP_HEALTHY_ANOMALY_KEY = 'endgame-reached'` the single
"healthy class" and defined `computeSweepHealthRate(run) = endgame-reached / cellCount`
as the sole health-rate source of truth (consumed by `PipelinePage.vue`, the
`useAgentPipeline.ts` Architect-lane trigger, and the `useSweepTrend.ts` chart).
That review pass fixed one degenerate formula (`sum(all keys)/cellCount ≡ 0`) but
replaced it with another that is **also ≡ 0 on live data** — because no bot ever
reaches a terminal endgame in these matchups (see Goal), the `endgame-reached`
count is always 0.

---

## Goal

Redefine the one health-rate helper so the dashboard reports a **meaningful**
operator signal. `computeSweepHealthRate` becomes the **anomaly-free rate** —
the fraction of swept cells that ran **without a genuine anomaly** —
`(cellCount − Σ genuine-anomaly-counts) / cellCount`, where the genuine-anomaly
classes are `'fatal'` (the engine threw) and `'escaped-villain-cap'` (villains
escaped past the cap on a terminal game). `'not-endgame'` (hit the 200-turn cap
without a terminal win/loss) is the expected norm and counts as healthy. Every
consumer of the shared helper (`PipelinePage.vue` chip, `useAgentPipeline.ts`
Architect trigger, `useSweepTrend.ts` chart) corrects automatically — they call
the helper unchanged. After this WP the nightly and weekly sweeps report **100%**
health (0 anomalies on clean runs) and the rate drops below 100% **only** when a
real `fatal` / `escaped-villain-cap` anomaly appears.

**Why the policy is not the fix (empirical):** running the committed 4-cell
nightly fixture under `--policy heuristic` (the competent T2 AI, WP-049) yields
`endgameReached=false` on all four cells with `moveCount ≈ 2000` (the 200-turn
cap), `winner=null` — identical to `--policy random`. No policy reaches a
terminal endgame in these scheme × mastermind matchups within the turn cap, so
`endgame-reached / cellCount` is structurally 0 for **any** policy. The fix must
redefine the metric, not swap the policy.

---

## User-Visible Impact

An operator on **dashboard.legendary-arena.com → Pipeline** sees the sweep health
chip read a true value (**100%** on today's clean nightly/weekly runs) instead of
a misleading red **0%**, and the health-rate trend chart shows a real line at the
top of the `[0,1]` axis that will visibly dip if a scheme × mastermind combination
ever crashes the engine (`fatal`) or lets villains escape the cap
(`escaped-villain-cap`). The Architect-lane `< 0.8` escalation stops firing on
every run for a non-signal.

---

## Assumes

- WP-235 shipped: `apps/dashboard/src/composables/useSweepHealth.ts` exports
  `SWEEP_HEALTHY_ANOMALY_KEY` and `computeSweepHealthRate`, and these three sites
  consume the helper: `pages/pipeline/PipelinePage.vue`,
  `composables/useAgentPipeline.ts`, `composables/useSweepTrend.ts`.
- The sweep anomaly taxonomy is the closed 4-class set (WP-195 / D-19502):
  `'endgame-reached'`, `'not-endgame'`, `'escaped-villain-cap'`, `'fatal'`; the
  server validator rejects any out-of-set key with `400` (WP-209), so the four
  literals are the complete key space on live data.
- `apps/dashboard` test runner is `node --import tsx --test src/**/*.test.ts`
  (`node:test` + `node:assert/strict`).
- `pnpm --filter @legendary-arena/dashboard test` / `typecheck` (`vue-tsc --noEmit`)
  / `pnpm -r build` currently exit 0.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — confirms this is an
  App-layer display change: the dashboard consumes read-only projections and adds
  **no** engine import. The change must not name `SweepAnomalyClass` or import
  from `@legendary-arena/game-engine`.
- `docs/ai/DECISIONS.md` — read **D-23503** (the healthy-class constant this WP
  supersedes), **D-20703** (opaque anomaly-key posture — this WP keeps the same
  narrow named-key exception, inverted to name the anomaly keys), **D-19502**
  (closed 4-class taxonomy), and the new **D-24141** reserved below. Scan for
  related sweep entries (D-23501/D-23502/D-23801/D-23802).
- `apps/dashboard/src/composables/useSweepHealth.ts` — read entirely; this is the
  single site changed. Preserve the `healthRate` / `healthRateSparkline`
  projections, the 0-cell → `null` guard, and the opaque all-keys
  `totalAnomalySparkline` (D-20703) **unchanged**.
- `apps/dashboard/src/services/sweepHealthMocks.ts` — read the anomaly-seeding
  block (it currently forces `endgame-reached` high so the MOCK rate varies).
- `apps/dashboard/src/composables/useAgentPipeline.test.ts`,
  `useSweepHealth.test.ts`, `useSweepTrend.test.ts` — read the rate fixtures and
  assertions that must be re-pinned to anomaly-free semantics.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no abbreviations),
  Rule 6 (`// why:` comments), Rule 8 (no `.reduce()` with branching — use
  `for...of`), Rule 13 (ESM only), Rule 14 (field names match the data contract).

---

## Non-Negotiable Constraints

**Always apply (do not remove):**
- Full file contents for every new or modified file in the output — **no diffs,
  no snippets, no "show only the changed section"**.
- ESM only, Node v22+ — `import`/`export`, never `require()`; `node:` prefix on
  built-in imports in tests (`node:test`, `node:assert/strict`).
- Test files use `.test.ts`; `node:test` + `node:assert/strict` only — no
  `boardgame.io`, no network, no database, no Vitest/Jest/Mocha.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md` — explicit
  `for...of`, no `.reduce()` with branching, descriptive names, `// why:` on
  non-obvious decisions.

**Packet-specific:**
- The health formula stays the **single** source of truth in
  `computeSweepHealthRate`. Do **not** add a second health definition at any
  consumer; `PipelinePage.vue`, `useAgentPipeline.ts`, and `useSweepTrend.ts`
  call the helper and must not be edited to name anomaly keys themselves.
- Name **only** the two genuine-anomaly string literals (`'fatal'`,
  `'escaped-villain-cap'`). Do **not** import `SweepAnomalyClass` or any engine
  symbol; `'endgame-reached'` and `'not-endgame'` stay unnamed/opaque; the
  opaque all-keys `totalAnomalySparkline` (D-20703) is unchanged.
- Preserve the guards: 0-cell run → `null` (never `NaN`); a missing / non-finite
  / negative key count reads as 0 anomalies; the returned rate is clamped to
  `[0, 1]`.
- MOCK fixtures must seed the two anomaly keys so the MOCK-mode rate is varied and
  below 100% (mirrors the prior "endgame-reached ~70–98%" behavior, inverted);
  the LIVE path is untouched.

**Session protocol:** if any field name, taxonomy key, or consumer contract is
unclear, stop and ask — never guess or invent key names, type shapes, or file
paths.

**Locked contract values (verbatim — do not re-derive):**
- Closed anomaly taxonomy (WP-195 / D-19502):
  `'endgame-reached'` | `'not-endgame'` | `'escaped-villain-cap'` | `'fatal'`.
- Genuine-anomaly (unhealthy) classes for the health rate:
  `'fatal'`, `'escaped-villain-cap'`.

---

## Vision Alignment

- **Vision clauses touched:** §22 (determinism / replay-faithfulness — the sweep
  is simulation-derived), §24 (measurement surfaces). The health rate is an
  **operator dashboard** display metric, not player scoring / PAR / a leaderboard.
- **Conflict assertion:** `No conflict: this WP preserves all touched clauses.`
  It changes a display-formula projection only; no engine, simulation, scoring,
  or replay code changes.
- **Non-Goal proximity:** none of NG-1..7 are crossed — no monetization,
  persuasion, or competitive surface; the dashboard is an internal operator tool.
- **Determinism preservation:** `computeSweepHealthRate` remains a **pure,
  deterministic** function of the sweep payload (`cellCount`, `anomalyCounts`) —
  no wall-clock, no RNG, no I/O — so identical payloads always produce identical
  rates.

## Funding Surface Gate

§20 **N/A** — this WP touches no funding surface: no global-nav / registry-viewer
/ profile funding affordance, no tournament funding channel, and no user-visible
"donate/support" copy. It is an operator-dashboard display-metric fix.

## API Catalog (§21)

§21 **N/A** — no HTTP endpoint is added, modified, removed, or re-statused, and
no `apps/server/src/**` library function changes. `GET /api/sweep/latest` (WP-209)
is consumed byte-unchanged; the change is entirely client-side projection.

---

## Reserves

- **D-24141** — the sweep **health rate** is the **anomaly-free rate**
  `(cellCount − Σ genuine-anomaly-counts) / cellCount` over the genuine-anomaly
  classes `'fatal'` + `'escaped-villain-cap'`; **supersedes** the D-23503
  `endgame-reached` healthy-class definition, which was structurally unreachable
  (no policy reaches a terminal endgame in the sweep matchups within the 200-turn
  cap) and pinned the live rate at 0%. Keeps the D-20703 narrow named-key
  exception, inverted from naming the healthy class to naming the two anomaly
  classes; no `SweepAnomalyClass` import. D-23503's cadence/trend and
  single-source-of-truth-helper decisions remain in force — only its healthy-class
  *definition* is superseded.

---

## Scope (In)

### A) `apps/dashboard/src/composables/useSweepHealth.ts` — modified
- Replace the export `SWEEP_HEALTHY_ANOMALY_KEY = 'endgame-reached'` with a
  readonly array of the two genuine-anomaly classes:
  `export const SWEEP_ANOMALY_HEALTH_KEYS = ['fatal', 'escaped-villain-cap'] as const;`
  with a `// why:` citing **D-24141** (and that it supersedes the D-23503 healthy
  class), the empirical no-endgame finding, and the D-20703 named-key discipline.
- Rewrite `computeSweepHealthRate(run: SweepRunSummary): number | null`:
  - `run.cellCount <= 0` → `return null;` (unchanged guard; never `NaN`).
  - Sum the counts at the two anomaly keys with an explicit `for...of` loop; each
    key read with a `typeof === 'number' && Number.isFinite(...) && >= 0` guard →
    absent/malformed reads as 0.
  - `const rate = (run.cellCount − anomalousCount) / run.cellCount;`
  - Clamp to `[0, 1]` with a `// why:` (MOCK fixtures may violate the
    closed-taxonomy `sum === cellCount` invariant; clamp keeps a valid fraction
    and never feeds a negative to the trend axis).
- Leave `healthRate`, `healthRateSparkline`, `totalAnomalySparkline`, and every
  other projection **unchanged** (they consume the helper).

### B) `apps/dashboard/src/services/sweepHealthMocks.ts` — modified
- Replace the `SWEEP_HEALTHY_ANOMALY_KEY` import with `SWEEP_ANOMALY_HEALTH_KEYS`.
- Instead of forcing `endgame-reached` to ~70–98% of cells, seed the two anomaly
  keys (`fatal`, `escaped-villain-cap`) to a **small varied** fraction (target a
  combined ~2–30% of `cellCount`) so the MOCK-mode anomaly-free rate varies across
  ~`[0.70, 0.98]` and stays below 100%. `// why:` documenting the inversion.

### C) Tests — modified
- `apps/dashboard/src/composables/useSweepHealth.test.ts` — update the import
  (drop `SWEEP_HEALTHY_ANOMALY_KEY`, add `SWEEP_ANOMALY_HEALTH_KEYS`); re-pin the
  rate cases to anomaly-free semantics: anomaly-free fraction for a run with known
  `fatal`/`escaped-villain-cap` counts; a run with **zero** anomaly keys → `1.0`;
  a non-numeric/negative anomaly count → treated as 0 → still healthy; 0-cell run
  → `null`; anomaly count exceeding `cellCount` → clamped to `0`; the `healthRate`
  / `healthRateSparkline` projections reflect the new formula.
- `apps/dashboard/src/composables/useAgentPipeline.test.ts` — re-pin the three
  Architect health-item / escalation fixtures to carry `fatal` + `escaped-villain-cap`
  counts producing the SAME intended rates the assertions expect (e.g. 30 / 10 / 40
  anomalous over 100 cells → 0.70 / 0.90 / 0.60), so the `< 0.8` escalation
  behavior is asserted against real anomaly-free rates.
- `apps/dashboard/src/composables/useSweepTrend.test.ts` — re-pin any per-point
  `healthRate` expectations that were computed from `endgame-reached` fixtures to
  the anomaly-free values for the same fixtures.

---

## Out of Scope

- **No policy change** to `sweep-submit.mjs` / `sweep-nightly.yml` /
  `sweep-weekly.yml` — the empirical finding (heuristic also 0% endgame) rules a
  policy swap out; that is not this WP.
- **No engine / server / registry / migration change** — no edit to the anomaly
  taxonomy, `sweep.analyze.ts`, `GET /api/sweep/latest`, or any `packages/**`.
- **No new health definition at any consumer** — `PipelinePage.vue`,
  `useAgentPipeline.ts`, and `useSweepTrend.ts` are **not** edited; they call the
  shared helper and correct automatically.
- **No chip / chart re-design** — the "reframe the summary chip as an anomaly
  breakdown" option is explicitly not taken here (larger UX WP if ever wanted).
- Refactors, cleanups, or "while I'm here" improvements are out of scope unless
  listed in Scope (In).

---

## Files Expected to Change

- `apps/dashboard/src/composables/useSweepHealth.ts` — **modified** — swap the
  healthy-key constant for the two-anomaly-key array + rewrite the formula.
- `apps/dashboard/src/services/sweepHealthMocks.ts` — **modified** — seed the
  anomaly keys so the MOCK rate varies below 100%.
- `apps/dashboard/src/composables/useSweepHealth.test.ts` — **modified** — re-pin
  rate cases + import.
- `apps/dashboard/src/composables/useAgentPipeline.test.ts` — **modified** — re-pin
  the three Architect rate fixtures.
- `apps/dashboard/src/composables/useSweepTrend.test.ts` — **modified** — re-pin
  per-point rate expectations.
- `docs/ai/STATUS.md` / `docs/ai/DECISIONS.md` (D-24141; D-23503 metric
  superseded) / `docs/ai/work-packets/WORK_INDEX.md` / `docs/ai/execution-checklists/EC_INDEX.md`
  / `docs/05-ROADMAP-MINDMAP.md` — **modified** — governance.

No other files may be modified.

---

## Acceptance Criteria

- [ ] `useSweepHealth.ts` exports `SWEEP_ANOMALY_HEALTH_KEYS` equal to exactly
      `['fatal', 'escaped-villain-cap']`; `SWEEP_HEALTHY_ANOMALY_KEY` is removed.
- [ ] `computeSweepHealthRate` returns `(cellCount − fatal − escaped-villain-cap) /
      cellCount` for a populated run; `1.0` for a run with no anomaly keys; `null`
      for a 0-cell run; `0` when anomalies exceed `cellCount` (clamp).
- [ ] A missing / non-finite / negative anomaly-key count is read as 0 anomalies.
- [ ] No `SweepAnomalyClass` import and no `@legendary-arena/game-engine` import
      in `useSweepHealth.ts` (confirmed with `Select-String`).
- [ ] `PipelinePage.vue`, `useAgentPipeline.ts`, `useSweepTrend.ts` are unchanged
      (confirmed with `git diff --name-only`).
- [ ] MOCK-mode `mockSweepHealth` produces a varied per-run rate strictly below
      1.0 and above 0.0 (asserted in a test).
- [ ] `pnpm --filter @legendary-arena/dashboard test` exits 0 (all files).
- [ ] `pnpm --filter @legendary-arena/dashboard typecheck` (`vue-tsc --noEmit`)
      exits 0 with no new error vs the clean baseline.
- [ ] `pnpm -r build` exits 0.
- [ ] No files outside `## Files Expected to Change` were modified (confirmed with
      `git diff --name-only`).

---

## Verification Steps

```pwsh
# Step 1 — build after all changes
pnpm -r build
# Expected: exits 0

# Step 2 — run all dashboard tests
pnpm --filter @legendary-arena/dashboard test
# Expected: node:test TAP — all passing, 0 failing (re-pinned rate cases green)

# Step 3 — typecheck gate (has drifted silently before — explicit DoD gate)
pnpm --filter @legendary-arena/dashboard typecheck
# Expected: vue-tsc --noEmit exits 0, no new error vs baseline

# Step 4 — no engine coupling in the health helper
Select-String -Path "apps\dashboard\src\composables\useSweepHealth.ts" -Pattern "SweepAnomalyClass|@legendary-arena/game-engine"
# Expected: no output

# Step 5 — the two anomaly-key literals are named exactly once, in the helper
Select-String -Path "apps\dashboard\src\composables\useSweepHealth.ts" -Pattern "SWEEP_ANOMALY_HEALTH_KEYS"
# Expected: the export declaration + its use in computeSweepHealthRate

# Step 6 — consumers untouched
git diff --name-only
# Expected: only files in ## Files Expected to Change — NOT PipelinePage.vue,
# useAgentPipeline.ts, or useSweepTrend.ts (their .test.ts files may appear)
```

---

## Definition of Done

- [ ] **User-visible verification (D-24026):** after deploy, on
      dashboard.legendary-arena.com → Pipeline, the sweep health chip reads a real
      value (100% on the current clean nightly/weekly runs, not 0%) and the
      health-rate trend renders a non-zero line. Evidence captured (screenshot or
      observed value against a deploy-confirmed SHA). Green tests alone do NOT
      satisfy this item.
- [ ] All acceptance criteria pass.
- [ ] `pnpm --filter @legendary-arena/dashboard test` / `typecheck` + `pnpm -r build`
      exit 0.
- [ ] No `SweepAnomalyClass` / engine import in `useSweepHealth.ts` (confirmed with
      `Select-String`).
- [ ] No files outside `## Files Expected to Change` modified (confirmed with
      `git diff --name-only`).
- [ ] `docs/ai/STATUS.md` updated — the sweep health rate is now the anomaly-free
      rate; what an operator sees differently.
- [ ] `docs/ai/DECISIONS.md` updated — **D-24141** Active; **D-23503** Status line
      notes its metric is superseded by D-24141.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-349 checked off with today's date.

---

## Lane note (D-24028)

Standard lane — a production operator-dashboard metric fix — but tightly scoped:
one formula site + its MOCK seed + three test re-pins; every runtime consumer
corrects through the shared helper with no edit.
