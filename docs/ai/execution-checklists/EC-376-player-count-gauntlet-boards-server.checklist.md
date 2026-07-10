# EC-376 — Player-Count Gauntlet Boards, Server (Execution Checklist)

> Pairs with [WP-344](../work-packets/WP-344-player-count-gauntlet-boards-server.md)
> (authoritative design) and D-24134 (design lock). WP wins on conflict.

## Before Starting

- [ ] Read WP-344 in full, then D-24134, then this file.
- [ ] Confirm baseline: `origin/main` @ `1d162584`; `pnpm -r build` exits 0.
- [ ] Read `gauntlet.logic.ts`, `legends.publisher.ts` (gauntlet section), and
      `competition.logic.ts` steps 9–15 end to end before editing.

## Locked Values (do not re-derive)

- Migration DDL: `ALTER TABLE legendary.competitive_scores ADD COLUMN IF NOT
  EXISTS player_count smallint CHECK (player_count BETWEEN 1 AND 5)` —
  nullable, idempotent, file
  `data/migrations/027_add_player_count_to_competitive_scores.sql`.
- Player-count source: `Object.keys(reduced.finalState.playerZones).length` at
  a new step 14c in `submitCompetitiveScoreImpl` (mirrors step 14b's outcome
  posture); a value outside 1..5 stores SQL `NULL`, never a rejection. No new
  rejection string. Never client-supplied. `MatchReplayResult` unchanged.
- `CompetitiveScoreRecord` key-set lock amended **12 → 13 keys** (adds
  `playerCount: number | null`) under D-24134 authority — JSDoc list updated;
  every SELECT/RETURNING in `competition.logic.ts` gains the column.
- `listReplayOwners(replayHash, database)` in `replayOwnership.logic.ts`
  returns `{ playerId: string; displayName: string; visibility }[]` for ALL
  owners (no LIMIT), joined to `legendary.players` for `display_name`.
- Qualifying replay (per leg, per count): `outcome = 'heroes-win'` AND
  `player_count` NOT NULL AND owner count from `replay_ownership` EQUALS
  `player_count` AND every owner's visibility ∈ (`link`,`public`) AND
  `scoring_config_version === checkParPublished(scenario_key)
  ?.scoringConfig.scoringConfigVersion`. Replay-level dedupe: co-owner score
  rows share `replay_hash` with identical scores — `SELECT DISTINCT ON
  (replay_hash)` (subquery, `ORDER BY replay_hash`) then JOIN ownership.
- **EC-draft reconciliation (recorded as WP addendum):**
  `getGauntletStandings(definition, database, leaderboardDeps)` returns
  `ReadonlyMap<number, GauntletSnapshotEntry[]>` keyed by player count — ONE
  query per gauntlet (105/cycle, not 525) instead of the WP's per-count
  parameter; semantics identical. `GauntletSetSummary.schemeSlugs` becomes
  `schemes: { slug, name }[]` and `GauntletDefinition.legSchemeSlugs` becomes
  `legs: { schemeSlug, schemeName }[]` (names needed for the index `legs`
  lock); producer is `server.mjs` (12th file, the WP-342 wiring-addendum
  class); `index.mjs`/scheduler unchanged (type flows through).
- Roster identity: key = owner `player_id`s stringified, sorted, joined `','`;
  `players` = owner display names sorted ASC (code-unit); `handle` =
  `players[0]`; the SAME roster must hold the best on every leg; rank
  `totalScore ASC`, tiebreak `players.join(',') ASC`.
- Board naming: solo = `gauntlet-<setAbbr>-<mastermindSlug>.json` (existing
  name, now the 1-player board); counts 2..5 = `…-p<N>.json`; any count's file
  written ONLY when ≥1 complete entry.
- Index entry additive fields (after `board`, fixed property order):
  `entryCounts: { '1': n, '2': n, '3': n, '4': n, '5': n }` and
  `legs: { schemeSlug, schemeName }[]` in catalog leg order; existing
  `entryCount` = the solo count.
- Manifest: `gauntletBoards` lists every gauntlet file written this run
  (including `-p<N>`), sorted ASC; manifest-last (D-14204) preserved.

## Guardrails

- `packages/game-engine/**` untouched; no `boardgame.io` or registry import in
  any touched `legends/**`, `competition/**`, `identity/**` file.
- No `.reduce()` in the aggregation — `for...of` only; no wall-clock or
  randomness in `gauntlet.logic.ts` (see D-3701 for the forbidden list).
- INSERT stays write-once (D-5302): `player_count` written at insert, never
  updated; idempotency fast-path (step 4b) still never calls `reduceReplay`.
- Existing WP-142 publisher assertions and the no-catalog manifest path pass
  with expected values unmodified; solo-path standings semantics equal WP-342
  restricted to `player_count = 1`.
- No handle, accountId, or visibility value beyond `players[]` display names
  reaches any snapshot; a `private` owner excludes the whole replay.
- Parameterized SQL only; DB-gated tests keep the non-silent skip and run
  serialized (`--test-concurrency=1`).

## Required `// why:` Comments

- Migration: why nullable + why legacy `NULL` never qualifies (D-24134 §1).
- Step 14c: why the seat count derives from the reduced final `G`'s per-player
  record and why out-of-range stores `NULL` (D-24134 §1).
- Roster gate: why owner count must equal `player_count` (all seats
  authenticated — D-24134 §3) and why every owner must be link/public.
- DISTINCT ON: why co-owner duplicate rows collapse at replay level.

## Files to Produce

Per WP-344 §Files Expected to Change (11 files) **plus the execution
addendum**: `apps/server/src/server.mjs` (summary shape gains scheme names).
12 files total; no others.

## After Completing

- [ ] `pnpm -r build` 0; server no-DB suite green; DB-gated suites green
      serialized with migrations 026+027 applied to `TEST_DATABASE_URL`.
- [ ] Governance close: WORK_INDEX check-off, D-24134 execution annotation,
      STATUS.md ("No user-observable change — infrastructure only"), EC_INDEX
      row.
- [ ] Post-merge: migration 027 auto-applies via the Render migrate step;
      confirm the deploy succeeded and the live `gauntlet-index.json` gains
      `entryCounts` + `legs` (the WP-344 live evidence).

## Common Failure Smells

- Two entries for one duo ⇒ roster key built from handles instead of
  player_ids, or dedupe ran after the fold.
- A guest-carried win on a board ⇒ owner-count gate compared against roster
  size instead of the row's `player_count`.
- Publisher writes `-p<N>` files for empty counts ⇒ the ≥1-entry rule applied
  only to the solo board.

## Rules

Commit prefix `EC-376:` for implementation commits; `SPEC:` for governance
(never `WP-344:`). Bug handling per `01.2-bug-handling-under-ec-mode.md`.
