# EC-372 — Mastermind Set-Gauntlet Boards, Server (Execution Checklist)

> Pairs with [WP-342](../work-packets/WP-342-mastermind-gauntlet-boards-server.md)
> (authoritative design) and D-24131 (design lock). WP wins on conflict.

## Before Starting

- [ ] Read WP-342 in full, then D-24131, then this file.
- [ ] Confirm baseline: `origin/main` @ `37c6929d`; `pnpm -r build` exits 0.
- [ ] Read `apps/server/src/competition/competition.logic.ts` steps 7–16 and
      `apps/server/src/legends/legends.publisher.ts` end to end before editing.

## Locked Values (do not re-derive)

- Migration DDL: `ALTER TABLE legendary.competitive_scores ADD COLUMN outcome text
  CHECK (outcome IN ('heroes-win','scheme-wins'))` — nullable, idempotent guard,
  file `data/migrations/026_add_outcome_to_competitive_scores.sql`.
- `CompetitiveScoreRecord` key-set lock amended **11 → 12 keys** (adds `outcome`)
  under D-24131 authority — update the EC-053 drift test (test #9) in the same
  change; `COMPETITIVE_OUTCOMES: readonly ['heroes-win','scheme-wins']` pinned to
  the union both directions.
- Outcome source: `evaluateEndgame(reduced.finalState)` (engine public surface,
  already-imported package) at a new step 14b in `submitCompetitiveScoreImpl`,
  BEFORE the step-15 INSERT; a `null` evaluation stores SQL `NULL` — outcome is
  supplementary provenance, never a rejection reason. No new rejection string.
- Gauntlet identity: one per (set `abbr` × mastermind `slug`), sets with ≥1 scheme
  only; legs = the set's scheme slugs; slugs are registry `slug` fields verbatim.
- Leg qualification: `outcome = 'heroes-win'` AND `ro.visibility IN
  ('link','public')` (same INNER JOIN discipline as `getGlobalTopLeaderboard`)
  AND `scoring_config_version === checkParPublished(scenario_key)
  ?.scoringConfig.scoringConfigVersion` (version + PAR-eligibility in application
  code via the SAME injected `LeaderboardDependencies.checkParPublished` — no new
  dependency seam). Scenario parsing: `split_part(scenario_key,'::',1)` = scheme,
  `'::',2` = mastermind.
- Standings: group by `player_id`; leg slot = lowest `final_score` per scheme
  slug; entries require a winning best on EVERY leg; `totalScore` = integer sum;
  `averageScoreCentis = Math.round((totalScore * 100) / legCount)`; order
  `totalScore ASC, handle ASC`; `handle` = `players.display_name` (the existing
  snapshot projection convention).
- Publishing: board files `legends/v1/gauntlet-<setAbbr>-<mastermindSlug>.json`
  written ONLY when `rowCount >= 1`; `legends/v1/gauntlet-index.json` ALWAYS
  written (every catalog gauntlet, `entryCount: 0` included); both written
  before `manifest.json` (D-14204 manifest-last preserved); manifest gains
  additive `gauntletBoards` (string[] actually written this run) +
  `gauntletIndex: 'gauntlet-index'` — ONLY when gauntlet deps are provided;
  `boards[]`/`schemaVersion` byte-compatible.
- Wiring: `server.mjs` builds `GauntletSetSummary[]` from
  `registry.listSets()` + `registry.getSet(abbr)` (plain data — the legends
  module keeps its no-registry-import lock) and returns it from `startServer()`;
  `index.mjs` threads it into `startLegendsPublisher`; the scheduler forwards an
  optional `gauntletCatalog` to `publishAllBoards`. Absent catalog ⇒ publisher
  behavior byte-identical to today (existing tests must pass unmodified).

## Guardrails

- `packages/game-engine/**` untouched (`git diff --name-only -- packages/game-engine` empty).
- No `boardgame.io` import and no registry import in any `legends/**` or
  `competition/**` file; the catalog arrives as plain data.
- No `.reduce()` in standings aggregation — `for...of` only; no wall-clock or
  randomness in `gauntlet.logic.ts` (see D-3701 for the forbidden-surface list).
- The INSERT stays write-once (D-5302): `outcome` is written at insert, never
  updated; the idempotency fast-path (step 4b) still never calls `reduceReplay`.
- Existing publisher/manifest assertions in `legends.publisher.test.ts` pass
  with their expected values unmodified (additive-only proof).
- Parameterized SQL only; DB-gated tests use the existing non-silent skip.

## Required `// why:` Comments

- Migration: why nullable + why legacy `NULL` never qualifies (D-24131 §3).
- Step 14b: why outcome derives from the reduced final `G` via the engine's pure
  endgame evaluation (faithful by construction; D-24131 §3) and why `null`
  stores `NULL` rather than rejecting.
- Version filter: why rows must match the currently-published
  `scoringConfigVersion` (VISION §22; D-24131 §5).
- Index emission: why zero-entry gauntlets appear in the index but get no board
  file (D-24131 §7 — "unclaimed" index UI without 100+ empty board files).

## Files to Produce

Per WP-342 §Files Expected to Change (10 files) **plus the execution addendum**
recorded in the WP: `apps/server/src/index.mjs` and
`apps/server/src/legends/legends.scheduler.ts` (catalog threading — the publisher
start site lives in `index.mjs`, discovered at EC draft). 12 files total; no
others.

## After Completing

- [ ] `pnpm -r build` exits 0; server no-DB suite green; DB-gated suites green
      against local `TEST_DATABASE_URL` with migration 026 applied.
- [ ] Governance close: WORK_INDEX check-off, D-24131 execution annotation,
      STATUS.md ("No user-observable change — infrastructure only"), EC_INDEX row.
- [ ] Deploy note: migration 026 PROD apply is operator-pending (024/025 pattern).

## Common Failure Smells

- Publisher tests failing on manifest shape ⇒ the additive fields leaked into
  the no-catalog path.
- Gauntlet entries for players with only losses ⇒ the `outcome` filter is on the
  wrong side of the best-per-leg reduction.
- A `scenario-*` board count change ⇒ gauntlet emission accidentally entered
  `buildBoardList` / `boards[]`.

## Rules

Commit prefix `EC-372:` for implementation commits; `SPEC:` for governance
(never `WP-342:`). Bug handling per `01.2-bug-handling-under-ec-mode.md`.
