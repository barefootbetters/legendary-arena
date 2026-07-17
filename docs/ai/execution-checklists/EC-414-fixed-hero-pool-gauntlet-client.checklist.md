# EC-414 — Fixed-Hero-Pool Gauntlet Division: Division Toggle + Hero-Pool Display (Execution Checklist)

**Source:** docs/ai/work-packets/WP-385-fixed-hero-pool-gauntlet-client.md
**Layer:** Client (`apps/legends-board/**` only)

## Before Starting
- [ ] Fresh `claude/*` worktree/branch off current `origin/main`; `git status` clean; record the sha into WP §Baseline
- [ ] Fresh worktree → `pnpm install` + `pnpm -r build` exit 0 BEFORE any suite
- [ ] WORK_INDEX confirms **WP-384 Done** (the publisher emits `-fixed[-p<N>]` boards, `heroPool` on fixed entries, `fixedEntryCounts` on the index); else BLOCKED
- [ ] Baseline `pnpm --filter @legendary-arena/legends-board build` + `typecheck` + `test` all exit 0 / green
- [ ] **Scope lock:** exactly the 7 files under Files to Produce; anything else is a FAIL — surface as a blocker before touching

## Locked Values (do not re-derive)
- Board-name grammar (D-24187 §3): fixed solo = `<board>-fixed`; fixed count N = `<board>-fixed-p<N>` — **`-fixed` precedes `-p<N>`**; `parseHashRoute` (`^gauntlet-[a-z0-9-]+$`) already admits both — **byte-identical after this packet**
- **Suffix resolution (extends WP-345's `resolveBoardIndexEntry`):** direct lookup → strip end-anchored `-p[2-5]` (exactly one) → lookup → strip end-anchored `-fixed` (exactly one) → lookup — **in that order**; resolution only fires when the prior lookup misses (the WP-345 collision rule); `gauntlet-core-dr-doom-fixed-p2` → the `gauntlet-core-dr-doom` entry
- **Division = the route, not component state:** the active division derives from the routed board name via a pure `isFixedBoardName(boardName)` (strip `-p[2-5]`, then test the `-fixed` end); no ref/store holds division state
- **Fixed count tabs:** `buildFixedCountTabs(indexEntry)` mirrors `buildPlayerCountTabs` — counts 1..5, `boardName` = the fixed grammar above, claim state from `fixedEntryCounts`; **absent `fixedEntryCounts` (pre-WP-384 snapshot) → empty array** (no toggle, no fixed tabs — exact WP-345 rendering)
- **Division toggle (board panel):** two chips, Open | **Fixed-Pool**, rendered only when `fixedEntryCounts` exists; Open is default (the routed division is highlighted); a toggle chip links to its division's board at the ACTIVE player count only when that count is claimed there, else renders inline muted unclaimed state (never a link to an absent file); championship framing attaches to Fixed-Pool ("Championship" subtitle); the open board carries the feeder line ("Clear every leg with one hero pool to claim the fixed-pool championship")
- **Hero-pool display:** `formatHeroPool(heroPool)` = each id's slug WITHOUT the `setAbbr/` prefix, joined `" · "` (display shortening only — ids never re-slugified or reordered; the pool renders in published order, sorted ASC); missing/empty pool → `''` (empty cell, never a crash); the fixed board's table gains a Hero Pool column
- **Index fixed chips:** claimed fixed counts ONLY (`★1p` label form, linking to the fixed board); unclaimed fixed counts render NO chip on the index (noise control across 105 rows — the unclaimed fixed state lives on the board panel); entries without `fixedEntryCounts` render exactly the WP-345 chips
- **Type mirroring (additive, hand-mirrored, never imported):** `GauntletSnapshotEntry` gains OPTIONAL `heroPool?: readonly string[]` (the client's single entry type serves both divisions; the server's distinct `GauntletFixedSnapshotEntry` collapses into the optional field); `GauntletIndexEntry` gains OPTIONAL `fixedEntryCounts?: GauntletEntryCounts`
- **Unclaimed-guard extension (App.vue):** the WP-345 `isRoutedCountUnclaimed` consults the fixed tab set when the routed name is fixed (via a pure `findRoutedCountTab(indexEntry, boardName)` searching open then fixed tabs) — an unclaimed `-fixed[-p<N>]` deep link renders the open-championship state, never a 404 fetch
- Display format: the D-24135 signed one-decimal average + gold-under-PAR styling apply unchanged on fixed boards
- Zero-API invariant: the built bundle contains no server-API hostname; all fetches stay `legends/v1/*`

## Guardrails
- **No new npm dependency**; any `package.json` change is a FAIL
- No engine / registry / preplan / server import; no `pg`; no server API call; no cookies/localStorage (WP-143 posture)
- `parseHashRoute` and the kiosk/attract cycle are byte-identical (the cycle keeps exactly ONE gauntlet-index slide; fixed boards never cycle — D-24135)
- Existing open-division rendering (WP-343 + WP-345 populated/empty/old-snapshot states) is preserved — additive degradation, never a crash or blank cell
- §23(b) copy discipline: co-op/championship framing only; no player-vs-player terms
- Pure helpers carry the unit tests; components verify via `vue-tsc` + dev smoke (the WP-343/WP-345 posture — the SPA has no component mount harness)
- If the live `gauntlet-index.json` lacks `fixedEntryCounts` (WP-384 deployed but no publish cycle yet), develop against fixtures — the panel must degrade to WP-345 behavior on old snapshots

## Required `// why:` Comments
- `isFixedBoardName` / the resolution order: why `-p[2-5]` strips before `-fixed`, and why resolution fires only on lookup miss
- `buildFixedCountTabs` absent-`fixedEntryCounts` branch: the pre-WP-384 degrade
- the index fixed-chip claimed-only rule: noise control, where the unclaimed state lives instead
- `formatHeroPool`: display shortening only — ids never re-slugified
- the toggle's unclaimed inline state: never a link to an absent file

## Files to Produce
- `apps/legends-board/src/snapshots/snapshotClient.ts` — **modified** — additive optional mirrors (`heroPool`, `fixedEntryCounts`)
- `apps/legends-board/src/snapshots/snapshotClient.test.ts` — **modified** — fixture coverage (absent fields tolerated)
- `apps/legends-board/src/panels/gauntletDisplay.ts` — **modified** — `isFixedBoardName`, `buildFixedCountTabs`, `formatHeroPool`, `findRoutedCountTab`, the `resolveBoardIndexEntry` extension
- `apps/legends-board/src/panels/gauntletDisplay.test.ts` — **modified** — unit tables for all five (pinned strings, incl. the strip order)
- `apps/legends-board/src/panels/GauntletBoardPanel.vue` — **modified** — division toggle + Hero Pool column + championship subtitle + feeder line
- `apps/legends-board/src/panels/GauntletIndexPanel.vue` — **modified** — claimed-only fixed chips
- `apps/legends-board/src/App.vue` — **modified** — unclaimed-guard extension via `findRoutedCountTab`

## After Completing
- [ ] `pnpm --filter @legendary-arena/legends-board build` + `typecheck` + `test` all exit 0 / green
- [ ] Zero-API bundle grep against `dist/` (no `onrender` / server-API hostname; `cards.legendary-arena.com` only inside anchor hrefs)
- [ ] `git diff --name-only` = exactly the 7 files (+ governance); `parseHashRoute` byte-identical (`git diff -- apps/legends-board/src/router/` empty)
- [ ] Dev smoke (vite dev, fixture-driven): division toggle renders with Open active; a `-fixed` deep link renders (unclaimed championship state when empty); a fixture-populated fixed board shows the Hero Pool column
- [ ] **Live-on-surface verification (D-24026):** on deployed legends.legendary-arena.com — a gauntlet board shows the toggle and a `-fixed` deep link renders the unclaimed championship state (or populated board if data exists); operator-pending on the CF Pages deploy if not verifiable in-session
- [ ] `docs/ai/STATUS.md` updated with the user-visible change
- [ ] `docs/ai/DECISIONS.md` — D-24187 annotated (client half executed)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off; `EC_INDEX.md` EC-414 → Done
- [ ] `docs/05-ROADMAP-MINDMAP.md` WP-385 node 📝 → ✅ + `pnpm roadmap:counts:write` (do NOT skip)

## Common Failure Smells
- A fixed deep link showing "Data unavailable" means the unclaimed guard did not consult the fixed tab set — check `findRoutedCountTab`
- The toggle appearing on old snapshots means the `fixedEntryCounts` presence gate was skipped
- A `-fixed-p2` route resolving to no index entry means the strip order ran `-fixed` before `-p[2-5]`
- Hero-pool cells showing `setAbbr/slug` raw means `formatHeroPool` was bypassed in the template
