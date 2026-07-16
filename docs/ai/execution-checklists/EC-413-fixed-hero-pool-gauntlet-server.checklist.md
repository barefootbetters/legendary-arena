# EC-413 — Fixed-Hero-Pool Gauntlet Division: team_key + Backfill + Pool-Constrained Standings + Publisher (Execution Checklist)

**Source:** docs/ai/work-packets/WP-384-fixed-hero-pool-gauntlet-server.md
**Layer:** Server (`apps/server/**`) + one migration + one operator script + carve-out doc edits

## Before Starting
- [ ] Fresh `claude/*` worktree/branch off current `origin/main`; `git status` clean; record the sha into WP §Baseline
- [ ] Fresh worktree → `pnpm install` + `pnpm -r build` exit 0 BEFORE any suite (stale dist = false green/red)
- [ ] Baseline `pnpm --filter @legendary-arena/server test` green (no-DB portion; DB-gated self-skip non-silently)
- [ ] WORK_INDEX confirms Done: WP-344, WP-342, D-24119 arc (WP-333..340), WP-370/D-24165; else BLOCKED
- [ ] Migration number **034** still free — re-check `data/migrations/` AND open PR branches (the WP-375 placeholder-030 lesson); renumber if taken
- [ ] Local `TEST_DATABASE_URL` migrations current through 033 (`pnpm check` probes currency)
- [ ] **Scope lock:** exactly the 13 files under Files to Produce; anything else is a FAIL — surface as a blocker before touching

## Locked Values (do not re-derive)
- `team_key text NULL` — value = the match's set-qualified hero ids (D-10014 `setAbbr/slug`, exactly as configured, never re-slugified) **sorted ASC, joined `+`**; written once at insert; backfill fills NULLs only; NULL never qualifies on any fixed board
- Derivation site: **step 14d** beside the WP-344 step 14c (`competition.logic.ts:774-786`); source = `(reduced.finalState as LegendaryGameState).matchConfiguration.heroDeckIds`; missing/empty → SQL NULL, never a rejection
- INSERT gains `team_key` as **$13**; record key lock amends **14 → 15 keys** (JSDoc + compile-time reference; NOT 13→14 — WP-354/D-24146 already added `isRankedEligible`)
- **Column sweep (the EC-376 missed-column lesson) — ALL five surfaces in `competition.logic.ts`:** the row interface (~:219), `mapRowToRecord` (~:251), the idempotency fast-path SELECT (~:278), the by-hash SELECT (~:549), `listPlayerCompetitiveScores` (~:581), plus the INSERT column list + RETURNING + final SELECT (~:819-838)
- Pool budgets (exactly `heroCount + 2`, D-24165): `{1: 5, 2: 7, 3: 7, 4: 7, 5: 8}` — **injected as plain data by `server.mjs`** from `PLAYER_COUNT_SETUP` at wiring time (the catalog-injection precedent); NEVER re-typed literals inside `gauntlet.logic.ts`, NEVER a registry import there
- Board names: `gauntlet-<setAbbr>-<mastermindSlug>-fixed` (solo) / `…-fixed-p<N>` (N=2..5); **`-fixed` precedes `-p<N>`**; lazy (≥1 complete entry only)
- `getGauntletStandings` keeps ONE roster-joined query per gauntlet — `cs.team_key` added to both the DISTINCT ON subquery and the outer SELECT; return shape becomes per-count `{ open: GauntletSnapshotEntry[]; fixed: GauntletFixedSnapshotEntry[] }`; publisher (sole production caller) updated in the same change
- Fixed qualification = every open-division rule unchanged (heroes-win, current scoringConfigVersion, count match, roster size/visibility) AND non-NULL `team_key` AND the pool constraint
- **Search (locked algorithm):** per (count × roster): best score per (leg × team_key); enumerate non-empty subsets of the roster's distinct team_keys; subset feasible when |union of hero ids| ≤ budget; candidate win qualifies for a leg when its team's heroes ⊆ the subset's union; entry total = min over feasible subsets of Σ per-leg min; exact optimum, deterministic
- **Cap:** > **12** distinct team_keys per (roster × count × gauntlet) → keep the 12 with the lowest best-single-leg score (tiebreak `team_key` ASC), `console.warn` naming gauntlet + roster — truncation is logged, never silent (D-24187 §5)
- `heroPool` = union of the winning assignment's chosen teams' hero ids, sorted ASC; tie across assignments → lexicographically smallest joined `heroPool` string
- Entry/index fields (additive, property order fixed for deterministic JSON): fixed entries = open entry fields + `heroPool: readonly string[]`; `GauntletIndexEntry` gains `fixedEntryCounts` (the `GauntletEntryCounts` shape)
- Backfill (`scripts/backfill-team-key.mjs`): dry-run default, `--write` applies; **SQL jsonb extraction** — `initial_state->'G'->'matchConfiguration'->'heroDeckIds'` from `bgio.replay_artifacts` joined on `replay_hash`; artifact missing → reported, left NULL; idempotent (`team_key IS NULL` rows only); writes ONLY that column
- Manifest written last (D-14204); `gauntletBoards` = all gauntlet files written this cycle, sorted; migration 034 = idempotent `ADD COLUMN IF NOT EXISTS` (the 027 guard pattern)

## Guardrails
- `packages/game-engine/**` read-only; `gauntlet.logic.ts` module contract holds: NO engine/registry/preplan/UI import — budgets and catalog arrive as plain data
- Open-division standings are **semantically untouched**: existing test assertion VALUES pass unmodified (accessor updates for the `{ open, fixed }` shape are mechanical only); a shifted open value = FAIL, investigate
- Backfill SQL sort must byte-match the JS derivation sort — hero ids are lowercase `[a-z0-9/-]` slugs so C-collation and JS code-unit sort agree; pin an equivalence test (same fixture through both paths → identical `team_key`)
- No `.reduce()` in the fold or search; no `Math.random()`; no wall-clock reads in logic (publisher timestamp source unchanged)
- The D-24187 carve-out clause lands in `docs/ai/ARCHITECTURE.md §Persistence Boundary` + `.claude/rules/architecture.md` mirror **in the impl commit** (the D-24169 pattern) — scoped to team-key derivation/backfill only
- Snapshot compatibility is additive-only: no field renamed/removed/re-typed; the deployed WP-345 SPA renders new snapshots unmodified (unknown fields ignored)
- SQL via the existing `pg` pool patterns, parameterized only; the backfill is SELECT-only against `bgio.*`
- If `matchConfiguration.heroDeckIds` is absent/malformed on any legacy artifact: report and skip (never guess); if the search cannot stay deterministic within the cap, STOP and reconcile against D-24187 §5

## Required `// why:` Comments
- step 14d: server-authoritative derivation from the verified reduction; NULL posture mirrors 14b/14c
- `server.mjs` budget injection: why plain data, not a registry import in `gauntlet.logic.ts`
- the subset search: cap value, drop rule, and the logged-truncation requirement
- backfill SQL: why the jsonb sort is byte-equivalent to the JS sort (slug charset)
- migration 034: idempotency guard mirrors 027

## Files to Produce
- `data/migrations/034_add_team_key_to_competitive_scores.sql` — **new**
- `apps/server/src/competition/competition.types.ts` — **modified** — `teamKey: string | null`; key lock 14→15 citing D-24187
- `apps/server/src/competition/competition.logic.ts` — **modified** — step 14d + $13 + the five-surface column sweep
- `apps/server/src/competition/competition.logic.test.ts` — **modified** — pinned team_key persistence (order-independence asserted); 15-key reference
- `scripts/backfill-team-key.mjs` — **new** — dry-run default; report + `--write`; idempotent
- `apps/server/src/legends/gauntlet.logic.ts` — **modified** — `{ open, fixed }` per count; subset search; injected budgets
- `apps/server/src/legends/gauntlet.logic.test.ts` — **modified** — WP AC-5 matrix (pool fits/blows budget; constrained-vs-unconstrained pinned totals; NULL team_key inert; open values byte-identical; roster rules still gate; solo budget 5)
- `apps/server/src/legends/legends.types.ts` — **modified** — `GauntletFixedSnapshotEntry` (`heroPool`) + `fixedEntryCounts`
- `apps/server/src/legends/legends.publisher.ts` — **modified** — lazy fixed-board emission + `fixedEntryCounts`; manifest-last unchanged
- `apps/server/src/legends/legends.publisher.test.ts` — **modified** — fixed emission paths; prior assertion values unmodified
- `apps/server/src/server.mjs` — **modified** — budget injection from `PLAYER_COUNT_SETUP` (wiring only)
- `docs/ai/ARCHITECTURE.md` — **modified** — D-24187 team-key carve-out clause
- `.claude/rules/architecture.md` — **modified** — carve-out mirror

## After Completing
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/server test` green (no-DB); DB-gated serialized green with 034 applied (`psql` apply, then `TEST_DATABASE_URL` run)
- [ ] Backfill dry-run against the local test DB: reports counts, writes nothing; `--write` then a second `--write` = no-op
- [ ] `git diff --name-only` = exactly the 13 files (+ governance); `git diff --name-only -- packages/game-engine` = empty
- [ ] Carve-out clause present in BOTH `docs/ai/ARCHITECTURE.md` and `.claude/rules/architecture.md`
- [ ] `docs/ai/STATUS.md` — "No user-observable change — infrastructure only"; names WP-385 as consumer
- [ ] `docs/ai/DECISIONS.md` — D-24187 annotated with execution date + addenda
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date; `EC_INDEX.md` EC-413 → Done
- [ ] `docs/05-ROADMAP-MINDMAP.md` WP-384 node 📝 → ✅ + `pnpm roadmap:counts:write` (do NOT skip)
- [ ] Post-merge: deploy runs migration 034 automatically; the production backfill run is recorded (or named as an open operator item — never silent)

## Common Failure Smells
- A by-hash read returning `teamKey: undefined` means a SELECT surface was missed in the column sweep (the exact EC-376 recurrence)
- Backfilled and submission-time `team_key` differing for one replay means the SQL/JS sort diverged — check the equivalence test first
- Shifted open-division totals mean the fold was refactored instead of extended — the open path must be byte-equivalent
- A registry import inside `gauntlet.logic.ts` means the budget injection was bypassed — the module header forbids it
- A fixed entry whose `heroPool` exceeds the budget means the feasibility check ran on the subset union instead of enforcing chosen-team ⊆ union
