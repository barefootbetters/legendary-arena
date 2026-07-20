# EC-435 — Canonical Villain & Henchmen Loadouts for Gauntlet Qualification (Execution Checklist)

**Source:** docs/ai/work-packets/WP-395-gauntlet-canonical-villain-loadouts.md
**Layer:** Cross-cutting (Registry + Server + Persistence + legends-board)

## Before Starting

- `pnpm -r build` exits 0
- `pnpm -r test` exits 0
- `pnpm --filter @legendary-arena/legends-board typecheck` exits 0 — REQUIRED (vite/esbuild and tsx do NOT type-check)
- `data/par` absent and `data/scoring-configs/` holds only README + the test fixture (no PAR published)
- Scope lock — ONLY these files may be created or modified:
  `scripts/generate-gauntlet-loadouts.mjs`; `package.json`;
  `packages/registry/{package.json,src/index.ts,src/gauntletLoadouts.ts,src/gauntletLoadouts.generated.ts,src/gauntletLoadouts.test.ts}`;
  `data/migrations/035_add_henchman_key_to_competitive_scores.sql`;
  `apps/server/src/competition/{competition.logic.ts,competition.types.ts,competition.logic.test.ts}`;
  `apps/server/src/legends/{gauntlet.logic.ts,gauntlet.logic.test.ts,legends.types.ts,legends.publisher.ts}`;
  `apps/server/src/server.mjs`;
  `apps/legends-board/src/snapshots/snapshotClient.ts`;
  `apps/legends-board/src/panels/{gauntletDisplay.ts,gauntletDisplay.test.ts,GauntletBoardPanel.vue,GauntletIndexPanel.vue}`;
  governance (`docs/ai/DECISIONS.md`, `docs/ai/STATUS.md`, `docs/ai/work-packets/{WORK_INDEX.md,WP-395-*.md}`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/execution-checklists/{EC_INDEX.md,EC-435-*.checklist.md}`).
  Anything outside this list is a FAIL, not a judgment call.

## Locked Values (do not re-derive)

- Menu size: **3** configurations per mastermind (D-24199). 110 masterminds → **330 loadouts**.
- Fill rule: **core-fallback** — printed `alwaysLeads` anchors first, then the mastermind's own set, then the `core` / `co2e` pool (D-24199).
- Qualifying sets: a set with **at least one scheme** (D-24131 §1) — 39 sets, 110 masterminds.
- Slot sizing comes from `PLAYER_COUNT_SETUP`; never re-typed as literals in the predicate.
- Distinct ScenarioKeys implied: **6,354** (p1 697, p2 1,853, p3 1,897, p4 1,897, p5 1,907). NOT 1,917 — that figure assumed one villain set across all counts, which `PLAYER_COUNT_SETUP` forbids.
- `ScenarioKey` format is **unchanged**: `{schemeSlug}::{mastermindSlug}::{sorted-villainGroupSlugs-joined-by-+}`.
- `henchman_key` format: set-qualified ids, sorted ASC, joined `+` (mirrors `team_key`, D-24187 §1).
- `CompetitiveScoreRecord` key lock moves **15 → 16** keys (adds `henchmanKey`).
- Migration number: **035**, nullable column, `ADD COLUMN IF NOT EXISTS`, **no backfill script**.

## Guardrails

- `gauntlet.logic.ts` must NOT import the registry — approved loadouts arrive as plain data on `GauntletDefinition`, exactly like `heroPoolBudgets` (WP-384 precedent).
- The menu is **generated, never hand-typed**; a typed copy rots on the next set change.
- A definition with no `approvedLoadouts` keeps pre-WP-395 semantics; a count with an **empty** menu fails closed (qualifies nobody).
- A NULL `henchman_key` never qualifies once a menu is configured.
- Non-conforming replays are rejected **silently**, like every other clause — and the board plus the challenge link must publish the requirement (the D-24186 / D-24190 failure class).
- Casual match setup is untouched. No restriction may reach `matchGate.routes.ts` or the builder's own validation.
- Drift tests must be non-vacuous: assert the generated table against `PLAYER_COUNT_SETUP` and include a negative case.

## Required `// why:` Comments

- `gauntletLoadouts.ts` — why the villain comparison is lossy (bare slugs) while henchmen are exact (set-qualified).
- `gauntlet.logic.ts` — why clause (g) exists; why an empty per-count menu fails closed; why NULL `henchman_key` never qualifies.
- `competition.logic.ts` — why step 14e derives `henchman_key` (henchmen are absent from `ScenarioKey`).
- `server.mjs` — why the projection happens at wiring time (the predicate's registry lock).
- `gauntletDisplay.ts` — why the challenge link now pins villains and henchmen, and why omitting the loadout reproduces the pre-WP-395 URL.
- Migration 035 — why nullable, why no backfill, why no CHECK constraint.

## Files to Produce

See the Scope lock above — that list is the file set, declared up front.

## After Completing

- `pnpm -r build` exits 0
- `pnpm -r test` exits 0 (registry, server, legends-board suites all green)
- `pnpm --filter @legendary-arena/legends-board typecheck` exits 0
- `pnpm gauntlet:loadouts:check` exits 0 (generated menu is current)
- `docs/ai/STATUS.md` updated
- `docs/ai/DECISIONS.md` — D-24199 annotated with the settled menu size, the fill rule, the corrected 6,354 figure, and the `henchman_key` persistence expansion
- `docs/ai/work-packets/WORK_INDEX.md` checked off with date
- `docs/05-ROADMAP-MINDMAP.md` — WP-395 node glyph `📝` → `✅`, then `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0
- Live-on-surface verification — REQUIRED (`User-Visible Surface = legends.legendary-arena.com`); boards fill only once PAR is published, so verify the published `gauntlet-index.json` carries `approvedLoadouts` and the rendered board shows the requirement

## Common Failure Smells

- Editing `gauntletLoadouts.generated.ts` by hand instead of rerunning the generator.
- Comparing villain groups as set-qualified ids — the ScenarioKey segment carries bare slugs, so the match silently never fires.
- Treating an absent menu and an empty menu the same; the first is unconstrained, the second fails closed.
- Adding the requirement to the predicate but not to the board or the link.
