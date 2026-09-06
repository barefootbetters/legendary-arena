# EC-688 — Sweep Health Rate = Anomaly-Free Rate (Execution Checklist)

**Source:** docs/ai/work-packets/WP-349-sweep-health-anomaly-free-rate.md
**Layer:** Client (`apps/dashboard`)

## Before Starting
- [ ] **WP-235 shipped:** `apps/dashboard/src/composables/useSweepHealth.ts` exports `SWEEP_HEALTHY_ANOMALY_KEY` + `computeSweepHealthRate`, and the three consumers `pages/pipeline/PipelinePage.vue`, `composables/useAgentPipeline.ts`, `composables/useSweepTrend.ts` call the shared helper. If false, STOP: abort and report.
- [ ] The sweep anomaly taxonomy is the closed 4-class set (WP-195 / D-19502) and the only key space on live data (the server rejects out-of-set keys with 400, WP-209).
- [ ] Exact scope lock (any edit outside = FAIL; surface first): `composables/useSweepHealth.ts`, `services/sweepHealthMocks.ts`, `composables/useSweepHealth.test.ts`, `composables/useAgentPipeline.test.ts`, `composables/useSweepTrend.test.ts`, plus governance (STATUS / DECISIONS / WORK_INDEX / EC_INDEX / ROADMAP-MINDMAP). **The three runtime consumers are NOT edited** — they correct through the helper.
- [ ] `pnpm --filter @legendary-arena/dashboard typecheck` exits 0, `pnpm --filter @legendary-arena/dashboard test` exits 0, `pnpm -r build` exits 0 (record the baseline).

## Locked Values (do not re-derive)
- Closed anomaly taxonomy: `'endgame-reached'` | `'not-endgame'` | `'escaped-villain-cap'` | `'fatal'`.
- Genuine-anomaly (unhealthy) classes: `'fatal'`, `'escaped-villain-cap'` — as `SWEEP_ANOMALY_HEALTH_KEYS = ['fatal', 'escaped-villain-cap'] as const`.
- Health rate = `(cellCount − Σ genuine-anomaly-counts) / cellCount`; `'endgame-reached'` and `'not-endgame'` are healthy/opaque.
- Guards: `cellCount <= 0` → `null` (never `NaN`); a missing / non-finite / negative key count reads as 0; the rate is clamped to `[0, 1]`.

## Guardrails
- The formula stays the SINGLE source of truth in `computeSweepHealthRate` — do NOT add a second health definition at any consumer; `PipelinePage.vue`, `useAgentPipeline.ts`, `useSweepTrend.ts` are NOT edited.
- Name ONLY the two genuine-anomaly literals. Do NOT import `SweepAnomalyClass` or any `@legendary-arena/game-engine` symbol (App-layer display change, no engine coupling).
- Leave `healthRate`, `healthRateSparkline`, and the opaque all-keys `totalAnomalySparkline` (D-20703) UNCHANGED.
- Sum the two keys with an explicit `for...of` loop — no `.reduce()` with branching (code-style Rule 8).
- MOCK fixtures seed the two anomaly keys to a small varied fraction (~2–30% of `cellCount`) so MOCK-mode rate varies in ~`[0.70, 0.98]`, strictly `< 1.0` and `> 0.0`; the LIVE path is untouched.

## Required `// why:` Comments
- The `SWEEP_ANOMALY_HEALTH_KEYS` constant: cites D-24141 (supersedes the D-23503 `endgame-reached` healthy class), the empirical no-terminal-endgame finding, and the D-20703 named-key discipline.
- The `[0, 1]` clamp: MOCK fixtures may violate the closed-taxonomy `sum === cellCount` invariant; the clamp keeps a valid fraction and never feeds a negative to the trend axis.
- The MOCK seed inversion: from naming the healthy class to seeding the two anomaly classes.

## Files to Produce
- `apps/dashboard/src/composables/useSweepHealth.ts` — **modified** — swap the healthy-key constant for the two-anomaly-key array + rewrite the formula.
- `apps/dashboard/src/services/sweepHealthMocks.ts` — **modified** — seed anomaly keys so the MOCK rate varies below 100%.
- `apps/dashboard/src/composables/useSweepHealth.test.ts` — **modified** — re-pin rate cases + import.
- `apps/dashboard/src/composables/useAgentPipeline.test.ts` — **modified** — re-pin the three Architect rate fixtures.
- `apps/dashboard/src/composables/useSweepTrend.test.ts` — **modified** — re-pin per-point rate expectations.
- `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24141 Active; D-23503 metric superseded), `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — governance.

## After Completing
- [ ] `pnpm --filter @legendary-arena/dashboard typecheck` exits 0 — the load-bearing gate (`vue-tsc --noEmit`; has drifted silently before).
- [ ] `pnpm --filter @legendary-arena/dashboard test` exits 0; `pnpm -r build` exits 0.
- [ ] No engine coupling: `Select-String -Path apps\dashboard\src\composables\useSweepHealth.ts -Pattern "SweepAnomalyClass|@legendary-arena/game-engine"` → no output.
- [ ] Consumers untouched: `git diff --name-only` does NOT show `PipelinePage.vue` / `useAgentPipeline.ts` / `useSweepTrend.ts` (their `.test.ts` may appear); the full diff = exactly the scope lock.
- [ ] **Live-on-surface (D-24026):** after deploy, `dashboard.legendary-arena.com → Pipeline` — the sweep-health chip reads a real value (100% on clean nightly/weekly, not 0%) and the trend renders a non-zero line; evidence captured against a deploy-confirmed SHA. Green tests do NOT satisfy this.
- [ ] `docs/ai/STATUS.md` updated — the health rate is now the anomaly-free rate; what an operator sees differently.
- [ ] `docs/ai/DECISIONS.md` — **D-24141 Active**; the **D-23503** Status line notes its metric is superseded by D-24141.
- [ ] `WORK_INDEX.md` + `EC_INDEX.md` flipped with date; mindmap node `📝`→`✅` + `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0.

## Common Failure Smells
- The Pipeline chip still reads 0% / a flat trend → the two-anomaly-key array was inverted (subtracting the healthy classes) or a consumer was edited instead of the helper.
- `vue-tsc` red on `main` after merge → the typecheck gate was skipped; build + test do not typecheck SFCs.
- MOCK rate reads exactly 1.0 → the mock seed did not populate `fatal` / `escaped-villain-cap`.
