# WP-274 — In-Play Coverage Metric: "% of In-Play Hollow Observations Resolved" (Dashboard)

> **Status:** DRAFT — pending review (do not execute until reviewed per
> `.claude/rules/work-packets.md` Review Gate).
> **Reserves:** D-24050.
> **Paired EC:** EC-305.
> **Stacks on:** WP-273 / EC-304 (#427, the wall-crawl keyword) — for the **governance
> ledger only** (the WP-274 rows sit after WP-273's). No code dependency: this metric
> works against any state of the engine. WP-273 should merge first; rebase WP-274 onto
> `main` after.
> **Depends on:** WP-259 / EC-280 (the `/coverage` page + `useCoverageLedger`), WP-265
> (the `runtime-observed-hollows.json` sweep), WP-253 (the hero ledger `executable`
> status) — all landed.

---

## Goal

After this session, the `/coverage` page carries a second headline metric beside the
existing "**X% hero mechanics executable**": "**Y% of in-play hollow observations
resolved**". The existing metric counts *mechanics* equally — a mechanic that bites a
player on every turn weighs the same as one that never fires — and it is a worst-case
rollup that shows `0%` movement until a whole mechanic is perfect. The new metric
weights by **runtime-observed in-play impact**: each unsupported mechanic contributes
its observed-in-play hollow count (`runtime-observed-hollows.json` `byMechanic[m].hitCount`),
and a mechanic counts as **resolved** when it becomes `executable` in the hero ledger.
So fixing a high-frequency hollow (dodge 37×, wall-crawl 23×, undercover 20×) moves the
needle proportionally, and the number answers the operator's real question — *"how much
of what actually breaks games in play have we fixed?"* — instead of *"what fraction of
the long-tail mechanic list is perfect?"*. Today the metric reads **0%** (0 of 163
observed obs resolved — nothing observed in play is executable yet); when wall-crawl
(WP-273) lands it reads **14.1%** (23 of 163).

**Why this matters.** The grind's targeting is driven off `/coverage`'s runtime-observed
ranking (fix the mechanics that bite players, by obs count). This metric makes that
progress *visible and honest*: it rises when a high-impact mechanic lands and stays flat
when a never-observed long-tail mechanic does — the incentive the existing `%-executable`
number gets backwards.

---

## The metric (locked definition — D-24050)

For each mechanic `m` ever observed hollow in play:

- `peakObs[m] = max(committedBaseline[m] ?? 0, liveRuntimeObserved[m] ?? 0)` — the
  high-water-mark of its in-play hollow count. The **committed baseline** preserves the
  obs of mechanics that have since been *fixed* (a fixed mechanic stops producing
  hollows, so it **vanishes from the live artifact** — without the baseline its obs would
  silently leave the denominator and inflate the percentage). The **live artifact** auto-
  adds any newly-observed mechanic to the denominator (`peak = max(0, live)`), so a new
  hollow can never be silently excluded.
- `resolved[m]` ⇔ the hero ledger's **mechanic-level status is `executable`** (looked up
  from `useCoverageLedger`'s by-mechanic dictionary). **Resolution is gated on the ledger,
  NOT on a drop in live obs** — the sweep is a *sample, not a census* (a mechanic's obs can
  fall to 0 because it wasn't sampled this run, not because it was fixed), so crediting a
  live-obs drop would over-state. The ledger is the source of truth for "does this execute".

Then:

```
totalObs    = Σ peakObs[m]                      over union(baseline, live)
resolvedObs = Σ peakObs[m]   for m where resolved[m]
percentResolved = round(resolvedObs / totalObs * 1000) / 10     (1 decimal; 0 when totalObs == 0)
```

This is the same shape as the existing `executablePercent` (executable / total), but
**obs-weighted** instead of mechanic-counted. Conservative by design: a partially-
implemented mechanic (some cards executable, some not — the ledger rolls it up
`unsupported`) counts as **not yet resolved**, which is honest (it still bites players on
its unresolved cards). The grind's keyword targets are all-or-nothing (recognizing a
keyword flips all its cards together), so they resolve cleanly.

---

## Assumes

> **Drafting baseline (01.0a Step 2):** drafted against the WP-273 draft branch
> `claude/wp273-wall-crawl` @ `c6531cf7` (= `origin/main` @ `04c36ba2` + WP-273's SPEC
> draft), stacked for governance-ledger continuity. Supersession check (`ls *inplay*
> *in-play*`, slug grep) returned no collision. Next-free numbers (accounting for WP-273's
> in-flight WP-273/EC-304/D-24049 reservation): **WP-274, EC-305, D-24050**.

- **WP-259 complete.** The `/coverage` page (`apps/dashboard/src/pages/coverage/CoveragePage.vue`)
  + `useCoverageLedger` (`apps/dashboard/src/composables/useCoverageLedger.ts`) render the
  `%-executable` headline (`executablePercent`), the by-mechanic worklist
  (`buildMechanicDictionary`), and the runtime-observed overlay (`runtimeObservedByMechanic`).
  The composable already exposes both the ledger summary/mechanics AND the live
  runtime-observed `byMechanic` join — the new composable reuses them.
- **The data flow is established.** `apps/dashboard/scripts/build-coverage-ledger.mjs`
  (a `prebuild` step) copies the committed `docs/ai/coverage/{hero-mechanic-ledger,
  runtime-observed-hollows}.json` into gitignored `apps/dashboard/src/data/*.json` that the
  composables statically import. The dashboard is **self-contained** (no `@legendary-arena/*`
  runtime imports).
- **WP-265 complete.** `runtime-observed-hollows.json` carries `byMechanic[m] = { hitCount,
  lastSeenTurn, byReason, examples }`; the current artifact = **15 mechanics / 163 obs**
  (dodge 37, wall-crawl 23, undercover 20, moonlight 18, conqueror 12, shatter 10, sunlight
  10, bridge 9, coordinate 7, investigate 5, cyber-mod 4, unleash 4, size-changing 2, ambush
  1, artifact 1) — the seed denominator.
- `pnpm --filter @legendary-arena/dashboard lint` + `typecheck` + `test:coverage` +
  `format:check` + `build` all exit 0 on the base.

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `apps/dashboard/src/pages/coverage/CoveragePage.vue` — the page; the `.summary` headline
  section is where the new metric card slots in (beside `percentExecutable`).
- `apps/dashboard/src/composables/useCoverageLedger.ts` — `executablePercent` (the shape to
  mirror), `buildMechanicDictionary` (the by-mechanic status the new composable reads),
  `runtimeObservedByMechanic` (the live obs join), the injected-or-bundled pattern.
- `apps/dashboard/src/composables/useCoverageLedger.test.ts` — the `node:test` injected-fixture
  pattern the new composable's test mirrors (no real file load in tests).
- `apps/dashboard/src/types/coverage.ts` — `LedgerStatus`, `RuntimeObservedHollows`; the new
  baseline + metric types append here.
- `apps/dashboard/scripts/build-coverage-ledger.mjs` — the prebuild-copy precedent.
- `apps/dashboard/docs/code-checks-and-balances.md` — the dashboard CI gate set (lint +
  typecheck + **test:coverage** thresholds + **format:check** + build) the WP must keep green.
- `.claude/rules/code-style.md`; the dashboard's own composable conventions.

---

## Non-Negotiable Constraints

**Dashboard-wide (always apply):**
- Full file contents for every new/modified file. Diffs/snippets forbidden.
- The dashboard is **self-contained** — **no `@legendary-arena/*` import, no engine/registry
  import, no network call**. The metric reads only committed/build-copied JSON + the existing
  composables.
- Vue 3 `<script setup>` + TS strict (`noUncheckedIndexedAccess` — use `.entries()` / explicit
  guards); `node:test` `.test.ts`; named imports; descriptive names; `// why:` on non-obvious
  decisions.
- **The full dashboard CI gate set MUST stay green:** `lint`, `typecheck`, **`test:coverage`
  (the committed thresholds — the new composable needs enough unit tests to hold them)**,
  **`format:check` (repo-wide prettier — run `prettier --write` before committing)**, `build`.
  (See `project_dashboard_typecheck_drift` — these are a SUPERSET of build/test/typecheck and
  bite at PR-CI even when those three are locally green.)

**Packet-specific:**
- **Obs-weighted, ledger-gated (the locked metric).** `peakObs = max(baseline, live)` per
  mechanic; `resolved` ⇔ ledger mechanic-status `executable`; never credit a live-obs drop
  (sampling variance). Compute exactly per §The metric.
- **The baseline is a committed seed, not a build-copy.** `apps/dashboard/src/data/
  in-play-hollow-baseline.json` is **committed** (NOT gitignored, unlike the build-copies in
  the same dir) and statically imported. It is the frozen obs denominator for fixed mechanics.
  Seeded with the current 15-mechanic / 163-obs snapshot (all `unsupported` today ⇒ 0% resolved).
- **Additive only.** Do NOT change the existing `%-executable` headline, `executablePercent`,
  `buildMechanicDictionary`, or the by-mechanic table. The new metric is a sibling card +
  a new composable.
- **Dashboard layer only.** No engine / registry / `docs/ai/coverage/**` / `data/cards/**`
  change. No new repo artifact under `docs/ai/coverage/`.

**Locked Values:**
- Composable: `useInPlayCoverage(options?)` in `apps/dashboard/src/composables/useInPlayCoverage.ts`,
  returning `{ percentResolved, resolvedObs, totalObs, remaining }` (the same injected-or-bundled
  pattern as `useCoverageLedger`). `remaining` = the unresolved mechanics sorted by `peakObs`
  descending (the prioritized worklist; reuses the existing by-mechanic statuses).
- Committed seed: `apps/dashboard/src/data/in-play-hollow-baseline.json` =
  `{ schemaVersion: 1, generatedAt: <ISO>, byMechanic: { <mechanic>: { peakObs: <int> }, … } }`,
  seeded from the current `runtime-observed-hollows.json` `byMechanic[m].hitCount`.
- Update script: `apps/dashboard/scripts/build-in-play-baseline.mjs` — monotonically merges the
  committed `docs/ai/coverage/runtime-observed-hollows.json` into the committed baseline
  (`peakObs = max(prior, current)`; adds new mechanics; **never lowers**); run **deliberately**
  (`pnpm --filter @legendary-arena/dashboard build:in-play-baseline`), NOT in the auto-`prebuild`
  (it writes a committed file). Deterministic (stable key sort; `generatedAt` from a fixed
  sentinel or the artifact's own provenance, never `Date.now()`).
- Metric label (locked copy): headline `{{ percentResolved }}%`, label `in-play hollows
  resolved`, sub `{{ resolvedObs }} / {{ totalObs }} observed in play`.

---

## Scope (In)

### A) `apps/dashboard/src/data/in-play-hollow-baseline.json` — **new (committed seed)**
The frozen `{ mechanic: { peakObs } }` denominator, seeded with the current 15-mechanic /
163-obs snapshot. Committed (not gitignored).

### B) `apps/dashboard/scripts/build-in-play-baseline.mjs` — **new**
The deliberate monotonic-merge maintenance script (above). Mirrors `build-coverage-ledger.mjs`'s
read/validate/write discipline; never lowers a peak; deterministic.

### C) `apps/dashboard/src/types/coverage.ts` — **modified**
Append `InPlayHollowBaseline` (`{ schemaVersion, generatedAt, byMechanic: Record<string,
{ peakObs: number }> }`) + `InPlayCoverageMetric` (the composable return shape) + a drift entry
if a closed array is introduced.

### D) `apps/dashboard/src/composables/useInPlayCoverage.ts` — **new**
The join + computation per §The metric: `peakObs = max(baseline, live)` over union; `resolved`
⇔ ledger mechanic-status `executable`; `percentResolved`, `resolvedObs`, `totalObs`, `remaining`.
Injected-or-bundled (the `useCoverageLedger` pattern), so the test injects fixtures.

### E) `apps/dashboard/src/composables/useInPlayCoverage.test.ts` — **new**
`node:test` injected fixtures: 0% at seed (nothing executable); a fixed mechanic (vanished from
live, present in baseline, ledger executable) credits its peak; a new live mechanic (not in
baseline) enters the denominator as unresolved; `totalObs == 0` → 0% (no divide-by-zero);
`remaining` sorted by peak desc. **Enough cases to hold the dashboard `test:coverage` thresholds.**

### F) `apps/dashboard/src/pages/coverage/CoveragePage.vue` — **modified**
Add the second headline metric card in `.summary` beside `percentExecutable` (the locked copy);
no change to the existing headline / chips / by-mechanic table.

### G) `apps/dashboard/package.json` — **modified**
Add the `build:in-play-baseline` script (the deliberate maintenance run); **do NOT** add it to
the auto-`build`/`prebuild` chain (it writes a committed file).

---

## Out of Scope
- **Changing the existing `%-executable` headline** or any current `/coverage` element.
- **Auto-maintaining the baseline in CI.** v1 re-seeds deliberately via the script; the
  composable self-corrects for new live mechanics (union/max), and the page surfaces a count
  if live mechanics are missing from the baseline (a re-seed prompt). A CI freshness gate for
  the baseline is a named follow-up, not v1.
- **Per-card obs attribution / partial-mechanic credit.** The metric is mechanic-level
  (ledger-gated); per-card weighting is a follow-up.
- **Any engine / registry / `docs/ai/coverage/**` / `data/cards/**` change**, and any new repo
  artifact. Dashboard-only.

---

## Files Expected to Change
- `apps/dashboard/src/data/in-play-hollow-baseline.json` — **new (committed seed)**.
- `apps/dashboard/scripts/build-in-play-baseline.mjs` — **new**.
- `apps/dashboard/src/types/coverage.ts` — **modified**.
- `apps/dashboard/src/composables/useInPlayCoverage.ts` — **new**.
- `apps/dashboard/src/composables/useInPlayCoverage.test.ts` — **new**.
- `apps/dashboard/src/pages/coverage/CoveragePage.vue` — **modified**.
- `apps/dashboard/package.json` — **modified** (the `build:in-play-baseline` script).
- Governance: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24050), `docs/ai/work-packets/WORK_INDEX.md`
  (WP-274 `[x]`), `docs/ai/execution-checklists/EC_INDEX.md` (EC-305 → Done),
  `docs/05-ROADMAP-MINDMAP.md` (WP-274 ✅).

**Total: 7 dashboard + 5 governance.** Single layer (dashboard). No engine/registry/data change.

---

## Vision Alignment
**Vision clauses touched:** §10/§10a (coverage tooling), §22 (determinism — the metric is a pure
deterministic computation; the maintenance script is deterministic, no `Date.now()`/RNG/network).
**No conflict.** Internal operator analytics; no gameplay, no card data, no scoring. NG-1..7: none crossed.

## Funding Surface Gate
**N/A — justified.** Internal operator dashboard; no funding affordance/copy/channel.

## API Catalog (§21)
**N/A — justified.** No `apps/server` HTTP endpoint or `Library-only` function; a dashboard
composable + page only.

---

## Acceptance Criteria

> **Binary — PASS requires ALL TRUE.**

1. `/coverage` renders a second headline metric "**Y% in-play hollows resolved · resolvedObs /
   totalObs observed in play**" beside the existing `%-executable`; the existing headline / chips /
   by-mechanic table are byte-unchanged.
2. `useInPlayCoverage` computes `percentResolved` per §The metric: `peakObs = max(baseline, live)`
   over union(baseline, live); `resolvedObs` sums peaks for ledger-`executable` mechanics;
   `percentResolved = round(resolvedObs/totalObs*1000)/10`; `totalObs == 0` ⇒ 0% (no NaN/divide-by-zero).
3. On the committed seed (all 15 observed mechanics `unsupported`), the metric reads **0%** (0 / 163).
   A unit test that injects a fixture with one observed mechanic flipped `executable` reads its peak
   as resolved (e.g. wall-crawl 23 → 23/163 = 14.1%).
4. `build-in-play-baseline.mjs` monotonically merges the live artifact into the committed baseline
   (`max`, never lowers, adds new mechanics), is deterministic (stable order, no `Date.now()`), and
   re-running it on unchanged input is a no-op.
5. The full dashboard CI gate set passes: `pnpm --filter @legendary-arena/dashboard lint` +
   `typecheck` + `test:coverage` + `format:check` + `build` all exit 0; the new composable's tests
   hold the coverage thresholds.
6. `git diff --name-only` lists exactly the `## Files Expected to Change`; no `@legendary-arena/*`
   import, no engine/registry/`docs/ai/coverage/**`/`data/cards/**` change.

---

## Verification Steps

```bash
pnpm --filter @legendary-arena/dashboard test:coverage   # BASELINE — record; exits 0
# implement
pnpm --filter @legendary-arena/dashboard lint
pnpm --filter @legendary-arena/dashboard typecheck
pnpm --filter @legendary-arena/dashboard test:coverage   # holds thresholds with the new tests
pnpm --filter @legendary-arena/dashboard format:check     # prettier clean (run --write first)
pnpm --filter @legendary-arena/dashboard build            # exits 0
grep -rc "@legendary-arena" apps/dashboard/src/composables/useInPlayCoverage.ts   # 0 (self-contained)
node apps/dashboard/scripts/build-in-play-baseline.mjs && git diff --stat apps/dashboard/src/data/in-play-hollow-baseline.json   # no-op on unchanged input
git diff --name-only -- packages/ docs/ai/coverage/ data/cards/   # empty
```

---

## Definition of Done
- [ ] All Acceptance Criteria (1–6) pass.
- [ ] The five dashboard CI gates (lint/typecheck/test:coverage/format:check/build) exit 0.
- [ ] `docs/ai/DECISIONS.md` D-24050 Reserved → Active; `STATUS.md` updated; `WORK_INDEX.md` WP-274
      `[x]`; `EC_INDEX.md` EC-305 → Done; `05-ROADMAP-MINDMAP.md` WP-274 ✅; `roadmap-counts --check` green.
- [ ] No files outside `## Files Expected to Change` modified.
- [ ] `User-Visible Surface = dashboard.legendary-arena.com/coverage` — the new "in-play hollows
      resolved" metric renders on the deployed page (D-24026 live-verify, post-deploy; reads 0% until
      a high-impact mechanic lands, then moves — e.g. 14.1% once WP-273 wall-crawl ships).

---

## Pre-Flight & Copilot Verdicts (01.0a Step 5)

Gate order pre-flight → copilot → lint, against the WP-273 draft branch `c6531cf7`
(= `origin/main` @ `04c36ba2` + WP-273 governance).

- **Pre-flight (01.4): READY TO EXECUTE (2026-06-21).** Class: **Dashboard / Read-Only Analytics**
  (a pure derived metric + a deterministic maintenance script; no engine, no gameplay, no mutation).
  Contract fidelity verified against source (per the dashboard scoping pass): `useCoverageLedger`
  exposes the by-mechanic statuses + the live `runtimeObservedByMechanic` join the new composable
  reuses (`useCoverageLedger.ts`); `runtime-observed-hollows.json` `byMechanic[m].hitCount` is the
  obs source (15 mechanics / 163 obs); the build-copy + static-import + injected-fixture-test pattern
  is the `build-coverage-ledger.mjs` / `useCoverageLedger.test.ts` precedent. Deps WP-259/265/253 ✅.
  Scope is a closed allowlist (dashboard only). **One RS — RS-1 (clarifying, non-blocking):** the
  exact `test:coverage` thresholds the new composable must hit, the `format:check` prettier pass, and
  the committed-seed-vs-gitignored-build-copy placement are scaffold-confirmed at execution (run the
  five gates before close — `project_dashboard_typecheck_drift`). Verdict READY.
- **Copilot check (01.7): PASS (2026-06-21) — CONFIRM.** Boundary (dashboard self-contained; no
  `@legendary-arena/*` import; additive — the existing headline untouched). Determinism (#2/#23 — a
  pure derived metric; the maintenance script is deterministic, no `Date.now()`/RNG). Honest-metric
  (#22 — ledger-gated, not credited on sampling-variance live-obs drops; the committed baseline keeps
  fixed mechanics in the denominator so the % can't be inflated by vanished obs). Scope creep (#12/#30
  — the existing metric/table untouched; auto-baseline-CI-gate + per-card weighting explicitly
  deferred). The review-surfaced risk (the dashboard coverage/format gates) is captured as RS-1 and
  routed to the execution gate run. No RISK/BLOCK.

---

## Lint Gate Self-Review (`00.3`)

**Verdict: PASS** — all 21 sections resolved (PASS or justified N/A); Final Gate clear.

- **§1 Structure / §2 Constraints / §3 Assumes / §4 Context:** PASS — all required sections present +
  non-empty; ≥3 Out-of-Scope exclusions; the dashboard-wide block forbids `@legendary-arena/*` imports +
  cites the CI gate set; each dependency + the exact composable/data/test surfaces cited; the genuine
  open item is flagged RS-1.
- **§5 Files:** PASS — 7 dashboard + 5 governance, each marked (new/modified/committed-seed); single
  layer; explicit non-change list (engine/registry/coverage-artifacts/data).
- **§6 Naming:** PASS — `useInPlayCoverage` / `InPlayHollowBaseline` / `peakObs` / `percentResolved` /
  `resolvedObs` / `totalObs` consistent with `executablePercent` / `runtimeObservedByMechanic`.
- **§7 Dependencies / §8 Architecture:** PASS — no new npm dep; dashboard layer only, self-contained
  (no engine import), additive, no persistence/determinism-of-gameplay surface (a pure derived metric).
- **§9–§11 (Windows/Env/Auth):** N/A — Node built-ins in the script; no env/auth surface.
- **§12 Tests:** PASS — `node:test` injected fixtures (the `useCoverageLedger.test.ts` pattern); the
  cases hold the dashboard `test:coverage` thresholds.
- **§13 Verification / §14 Acceptance / §15 Definition of Done:** PASS — exact `pnpm`/`grep`/`node`
  commands; 6 binary criteria; DoD includes the five dashboard gates + STATUS/DECISIONS/indices/mindmap
  + §15.1 `User-Visible Surface = dashboard/coverage` with the D-24026 live-verify item.
- **§16 Code Style:** PASS — `// why:` on the obs-weighting + the ledger-gated-resolution + the
  monotonic-never-lower merge; named imports; no `.reduce()` with branching; small functions.
- **§17 Vision:** TRIGGERED (§10/§10a coverage tooling, §22 determinism) — `## Vision Alignment` present
  with clause numbers + no-conflict + determinism line.
- **§18 Prose-vs-Grep:** PASS — the `grep` verification targets a source file (`@legendary-arena` import
  check), not this WP's prose.
- **§19 Bridge-vs-HEAD:** N/A. **§20 Funding / §21 API Catalog:** N/A with justification (internal
  dashboard; no funding surface; no server endpoint).

Verdict: **PASS** — all 21 sections resolved; Final Gate clear. Execution remains gated on RS-1
(the five dashboard CI gates green after the new tests + a prettier pass) and the seed reading 0%
honestly at baseline.
