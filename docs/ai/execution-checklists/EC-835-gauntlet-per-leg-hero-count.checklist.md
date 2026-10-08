# EC-835 — Gauntlet per-leg hero count and per-gauntlet pool budget (WP-798)

**WP:** WP-798 · **Reserves:** D-24671 · **Layer:** Server (gauntlet wiring + logic) + arena-client + blog tooling

Authoritative execution contract for WP-798. Subordinate to ARCHITECTURE.md and `.claude/rules/*`. If this EC and
WP-798 disagree, WP-798 wins. Compliance is binary.

## Before Starting

- [ ] Target file set = WP-798 §Files Expected to Change exactly; touching any other file is STOP.
- [ ] The WP-798 / EC-835 / D-24671 reservation is on `origin/main`, and `pnpm ledger:numbers:check` exits 0.
- [ ] `pnpm -r build` exits 0. Record the per-package `pnpm -r --no-bail test` before-counts and the arena-client
      typecheck result.
- [ ] At baseline: `server.mjs` builds `heroPoolBudgets[n] = setupRow.heroCount + 2` and injects
      `heroCount: setupRow.heroCount`; `gauntletRunProgress.logic.ts` sets `hasFullPicks: pickCount ===
      inputs.heroCount`. If either differs, STOP and report.

## Locked Values

- `server.mjs` imports `resolveEffectiveHeroCount` from `@legendary-arena/registry/playerCountSetup` and builds
  `legHeroCountsByScheme: Map<string, Record<number, number>>`, keyed `${setAbbr}/${schemeSlug}`, value
  ``{ n: resolveEffectiveHeroCount(`${setAbbr}/${schemeSlug}`, n, PLAYER_COUNT_SETUP[n].heroCount) }`` for n = 1..5,
  over every gauntlet set summary's schemes. Passed as the 5th argument of `buildGauntletCatalog`.
- `GauntletLeg.heroCountByPlayerCount?: Readonly<Record<number, number>>` (optional), stamped from the map.
- Budget when both maps are supplied: `heroPoolBudgets[n] = max(passedBudget[n] - 2, max over legs of
  leg.heroCountByPlayerCount[n]) + 2`, for each `n` in the passed `heroPoolBudgets`; otherwise the passed map unchanged.
- A leg with no `heroCountByPlayerCount[n]` contributes nothing (the base) to the inner max; budgets are finite
  integers ≥ the passed value, never `NaN`. The rule lives in one non-exported pure helper that returns a fresh object.
- JSDoc: the view's `heroCount` is the BASE count (gating/hints read `legs[].heroCount`); the leg's `heroCount` is its
  required pick from `resolveEffectiveHeroCount` (server types and client mirror).
- `GauntletRunLegProgress.heroCount: number` (REQUIRED, server type and client mirror) =
  `leg.heroCountByPlayerCount?.[run.playerCount] ?? inputs.heroCount`; `hasFullPicks = pickCount === leg heroCount`.
- The view's run-level `heroCount` stays the base count; `budget` stays `inputs.poolBudget`.
- Hint: `Enter a full hero pick ({{ leg.heroCount }} heroes) and save to enable Play this leg.`
- Expected Core budgets 8 / 8 / 8 / 8 / 8; a set with no overridden leg 5 / 7 / 7 / 7 / 8 (STOP if different).
- `renderBudgetTable(setAbbr, schemes)`: five rows (1–5, no collapsed 2–4 row); columns `Players | Base heroes |
  Largest leg | Fixed-Pool budget`; cites D-24187 §4 / D-24671.
- API catalog progress-GET row replaced whole; Authorizing WP appends `WP-798 / D-24671 (per-leg hero count,
  per-gauntlet budget)`.

## Guardrails

1. `gauntlet.logic.ts`, `gauntletTruth.logic.ts`, `gauntletRunProgress.logic.ts` never import the registry; counts
   arrive as injected plain data.
2. No module re-encodes a scheme hero count; every per-leg count comes from `resolveEffectiveHeroCount`.
3. Back compatible: without the 5th argument, definitions are byte-identical; a leg without a count falls back to
   the base.
4. The budget never drops below `base + 2`; the fixed division's existence condition (a budget for that count) is
   unchanged.
5. No CODE edit to `gauntletTruth.logic.ts`, `gauntletRun.logic.ts`, `gauntletRun.routes.ts`, `legends.publisher.ts`,
   `competition.logic.ts`, the pack format, engine or registry. STOP if needed.
6. Existing tests pass unedited except the ONE pre-flight-recorded edit: the `legs()` helper in
   `gauntletRunProgress.logic.test.ts` (:218–232) adds `heroCount` to each built leg (type-only; no assertion change),
   named in the `Tests-changed:` trailer. Anything else is STOP-and-report.
7. `buildGauntletCatalog` never mutates `heroPoolBudgets` or any input map; each definition gets its own freshly
   built budgets object.

## Required Comments (`// why:`)

- `server.mjs` counts map: wiring computes counts with the registry resolver so the logic layer stays registry-free
  (D-24671 §5).
- The budget rule: `max(base, largest leg) + 2` — the pool must hold the largest team, never shrinks (D-24671 §2,
  amending D-24187 §4).
- The `?? inputs.heroCount` fallback: definitions built without per-leg counts keep today's behaviour.
- The `passedBudget - 2` base recovery assumes the wiring's `heroCount + 2` map (D-24187 §4).
- `scripts/gauntlet-post-block.mjs` `renderBudgetTable`: a deliberate second copy of the `max(base, largest leg) + 2`
  rule (duplicate-first); the canonical site is the budget helper in `gauntlet.logic.ts` (D-24671 §2); the script
  cannot import the server's TS logic.
- The profile hint: the count is per leg because legs' schemes differ.

## Files to Produce

Exactly the WP-798 §Files Expected to Change allowlist.

## After Completing

- `git grep -n "@legendary-arena/registry"` over the three logic modules: no output.
- `node scripts/gauntlet-post-block.mjs core magneto` → budget 8×5; `dkcy apocalypse` → 5/7/7/7/8; the scratch
  real-data catalog check (core 8×5, every other set 5/7/7/7/8; Secret Invasion / Civil War leg counts as
  WP-798 Verification) recorded. STOP if different.
- Revert proofs 5/5: per-leg `hasFullPicks` count; the `max(…) + 2` budget; the never-shrink `max(base, …)` (fixture:
  a set whose every leg is 4 at 2p keeps 7, not 6); the leg-count stamp; (e) a fresh per-definition budgets object (the shared-object fixture fails in place).
- `pnpm -r build`; `pnpm -r --no-bail test` 0 failures (before/after counts per package); arena-client typecheck 0.
- `docs/ai/REFERENCE/api-endpoints.md` progress-GET row replaced whole (D-11804); `wiki/leaderboard.md` budget wording.
- Live-on-surface verification (D-24026), after BOTH the Render and Pages deploys: a 2-player Core run shows 6 on
  Secret Invasion and 4 on Civil War, launches Secret Invasion with 6 heroes, and shows the 8 budget. Record the
  matchId in STATUS.md.
- `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` D-24671 → Active (the six points, "Amends D-24187 §4 and
  D-24265" lead-in), plus the two back-pointers under D-24187 and D-24265 (WP-798 DoD wording).
- WORK_INDEX WP-798 `[x]` with date; EC_INDEX EC-835 → Done; mindmap 📝 → ✅, then `pnpm roadmap:counts:write` and
  `pnpm roadmap:counts:check` exit 0.

## Common Failure Smells

- Every gauntlet's budget becomes 8: the max was taken across sets, not per set.
- A 2-player Core budget of 7: the Secret Invasion leg count was not stamped, or the map key lacks the set prefix.
- The hint still says 5 on Secret Invasion: the client reads `run.heroCount`, not `leg.heroCount`.
- Existing `gauntlet.logic.test.ts` budget assertions fail: the new rule ran without the 5th argument.
