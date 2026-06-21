# EC-305 — In-Play Coverage Metric ("% of In-Play Hollow Observations Resolved")

**Source:** docs/ai/work-packets/WP-274-inplay-coverage-metric.md
**Layer:** Dashboard (`apps/dashboard`) — a second `/coverage` headline metric + its
composable + a committed obs-baseline seed + a deliberate maintenance script. Self-contained
(no `@legendary-arena/*` import).
**No engine / registry / `docs/ai/coverage/**` / `data/cards/**` change.** Reads the existing
committed/build-copied coverage JSON only.
**Decision:** D-24050 (reserved at draft; landed at execution). Obs-weighted, ledger-gated
in-play hollow resolution metric.
**Stacks on WP-273 (#427) for the governance ledger only** — no code dependency; merge WP-273 first.

Authoritative execution contract for WP-274. Compliance is binary.

---

## Before Starting
- [ ] On the WP-273 branch (or `main` after #427 merges), clean. Baseline-green:
  `pnpm --filter @legendary-arena/dashboard lint` + `typecheck` + `test:coverage` +
  `format:check` + `build` all exit 0.
- [ ] Read `composables/useCoverageLedger.ts` (`executablePercent`, `buildMechanicDictionary`,
  `runtimeObservedByMechanic`, the injected-or-bundled pattern) + `.test.ts` (the injected-fixture
  pattern) + `pages/coverage/CoveragePage.vue` (the `.summary` headline slot) + `types/coverage.ts`.
- [ ] **MANDATORY SCAFFOLD (the RS-1 de-risk):** before locking, prototype `useInPlayCoverage`
  against the real bundled data and **observe**: the metric reads **0%** at the seed (all 15
  observed mechanics `unsupported`); a fixture flip of one mechanic to `executable` credits its
  peak (wall-crawl 23 → 14.1%); `totalObs == 0` → 0% (no NaN). Confirm the exact `test:coverage`
  thresholds the new file must hold and run `format:check` (prettier) — the dashboard CI runs a
  SUPERSET of build/test/typecheck (`project_dashboard_typecheck_drift`). Confirm the committed-seed
  placement (NOT gitignored) vs the gitignored build-copies. Fold any correction in-scope (`01.1`).

---

## Locked Values
- **WP:** WP-274. **EC:** EC-305. **Decision:** D-24050, reserved.
- **Metric (locked):** `peakObs[m] = max(committedBaseline[m] ?? 0, liveRuntimeObserved[m] ?? 0)`
  over `union(baseline, live)`; `resolved[m]` ⇔ the hero ledger's mechanic-level status is
  `executable` (via `useCoverageLedger`'s by-mechanic dictionary) — **NOT** a live-obs drop (the
  sweep is a sample). `totalObs = Σ peakObs`; `resolvedObs = Σ peakObs for resolved m`;
  `percentResolved = round(resolvedObs/totalObs*1000)/10`; `totalObs == 0` ⇒ 0%.
- **Composable:** `useInPlayCoverage(options?)` → `{ percentResolved, resolvedObs, totalObs, remaining }`
  (`remaining` = unresolved mechanics sorted by `peakObs` desc); injected-or-bundled (the
  `useCoverageLedger` pattern).
- **Committed seed:** `apps/dashboard/src/data/in-play-hollow-baseline.json` = `{ schemaVersion: 1,
  generatedAt, byMechanic: { <m>: { peakObs } } }`, seeded from the current `runtime-observed-hollows.json`
  (15 mechanics / 163 obs). **Committed (not gitignored).**
- **Maintenance script:** `apps/dashboard/scripts/build-in-play-baseline.mjs` — monotonic `max` merge
  of the committed `docs/ai/coverage/runtime-observed-hollows.json` into the committed baseline (adds
  new mechanics; never lowers); deterministic (stable key order; no `Date.now()`); run deliberately via
  `pnpm --filter @legendary-arena/dashboard build:in-play-baseline` (NOT in auto-`prebuild`/`build`).
- **Page copy (locked):** headline `{{ percentResolved }}%`, label `in-play hollows resolved`,
  sub `{{ resolvedObs }} / {{ totalObs }} observed in play`.
- **Commit message (execution):** `EC-305: in-play coverage metric — % of in-play hollow obs resolved (D-24050)`.

---

## Guardrails
- **Self-contained (HIGHEST RISK).** NO `@legendary-arena/*` import, no engine/registry import, no
  network call. `grep -rc "@legendary-arena" apps/dashboard/src/composables/useInPlayCoverage.ts` = 0.
- **Additive; existing surface byte-unchanged.** Do NOT touch `executablePercent`,
  `buildMechanicDictionary`, the existing `%-executable` headline, the chips, or the by-mechanic table.
  The new metric is a sibling card + a new composable.
- **Honest metric.** Resolution is ledger-gated (`executable`), NOT credited on a live-obs drop; the
  committed baseline keeps fixed mechanics' obs in the denominator so the % can't be inflated by
  vanished obs. The seed reads **0%** today (nothing observed is executable).
- **Committed seed, not a build-copy.** The baseline JSON is committed + statically imported; do NOT
  add it to the auto-`prebuild` copy chain (which would overwrite it).
- **The full dashboard CI gate set MUST stay green** — lint + typecheck + **test:coverage (thresholds)**
  + **format:check (repo-wide prettier — run `--write` first)** + build. New tests must hold coverage.
- **Dashboard layer only.** No engine / registry / `docs/ai/coverage/**` / `data/cards/**` change;
  no new repo artifact under `docs/ai/coverage/`.

---

## Required `// why:` Comments
- At the obs-weighting: the metric weights by runtime-observed in-play hollow count (player impact),
  not by mechanic count — unlike the `%-executable` headline (D-24050).
- At the ledger-gated resolution: a mechanic's obs count resolved iff its ledger status is `executable`,
  NOT iff its live obs dropped — the sweep is a sample, a 0-obs run ≠ a fix (D-24050).
- At `peakObs = max(baseline, live)`: the committed baseline preserves a fixed mechanic's obs after it
  vanishes from the live artifact; `max` with live auto-adds new mechanics to the denominator (D-24050).
- At the monotonic merge (the script): never lower a peak — the denominator is a high-water-mark (D-24050).

---

## Files to Produce
- `apps/dashboard/src/data/in-play-hollow-baseline.json` — **new (committed seed)**.
- `apps/dashboard/scripts/build-in-play-baseline.mjs` — **new** (monotonic maintenance).
- `apps/dashboard/src/types/coverage.ts` — **modified** (baseline + metric types).
- `apps/dashboard/src/composables/useInPlayCoverage.ts` — **new** (the metric).
- `apps/dashboard/src/composables/useInPlayCoverage.test.ts` — **new** (injected fixtures; holds coverage).
- `apps/dashboard/src/pages/coverage/CoveragePage.vue` — **modified** (the second headline card).
- `apps/dashboard/package.json` — **modified** (`build:in-play-baseline` script; NOT in auto-build).
- (NO engine/registry/`docs/ai/coverage/**`/`data/cards/**`; NO change to the existing `%-executable`
  headline / chips / by-mechanic table.)
- Governance: `STATUS.md`, `DECISIONS.md` (D-24050), `WORK_INDEX.md` (WP-274 ✅), `EC_INDEX.md`
  (EC-305 Done), `05-ROADMAP-MINDMAP.md`.

**Explicit non-change:** `packages/**`, `docs/ai/coverage/**`, `data/cards/**`, and the existing
`/coverage` headline / chips / by-mechanic table MUST be byte-unchanged.

---

## After Completing
- [ ] Five dashboard gates exit 0: `lint`, `typecheck`, `test:coverage`, `format:check`, `build`.
- [ ] `/coverage` renders the second metric (0% / 163 at the seed); the existing headline + table unchanged.
- [ ] `useInPlayCoverage` unit tests: 0%-at-seed, fixed-mechanic-credits-peak, new-live-mechanic-unresolved,
  `totalObs==0`→0%, `remaining` sorted; coverage thresholds held.
- [ ] `build-in-play-baseline.mjs` monotonic + deterministic; no-op on unchanged input.
- [ ] `grep -rc "@legendary-arena" .../useInPlayCoverage.ts` = 0; `git diff` empty for `packages/**`,
  `docs/ai/coverage/**`, `data/cards/**`.
- [ ] `node scripts/roadmap-counts.mjs --check` passes (WP-274 ✅).
- [ ] STATUS notes `User-Visible Surface = dashboard/coverage`; D-24026 live-verify pending post-deploy.

---

## Close Notes Required in PR / Commit Body
- The seed snapshot (15 mechanics / 163 obs) + the metric reading **0%** at baseline; the worked example
  (wall-crawl 23 → 14.1% once executable).
- Confirmation the five dashboard gates pass, the new composable is self-contained (no `@legendary-arena`),
  and the existing `%-executable` headline / by-mechanic table are byte-unchanged.

---

## Common Failure Smells
- A `@legendary-arena/*` import in the composable → the dashboard self-containment broke; remove it.
- The existing `%-executable` headline / `executablePercent` / by-mechanic table changed → out of scope; revert.
- The metric credits a mechanic whose live obs dropped to 0 but whose ledger status is still `unsupported`
  → resolution must be ledger-gated, not live-obs-gated; the sweep is a sample.
- The baseline JSON is gitignored (vanishes from the build) → it is a COMMITTED seed, not a build-copy.
- `format:check` red at PR-CI while local build/test/typecheck are green → run `prettier --write` (the
  dashboard CI is a superset; `project_dashboard_typecheck_drift`).
- `test:coverage` red → the new composable/script lacks enough tests to hold the thresholds.
