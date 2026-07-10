# WP-344 — Player-Count Gauntlet Boards: Player-Count Persistence + Roster-Keyed Standings + Publisher (Server)

**Status:** Drafted 2026-07-09 (design-locked by D-24134; EC pending — execution-prep is the next step)
**Primary Layer:** Server (`apps/server/**`) + one migration
**Dependencies:** D-24134 (design lock), WP-342 ✅ (outcome column + gauntlet read-layer + publisher), D-24131 (parent design), D-24119 arc / WP-333..WP-340 ✅ (write path + per-seat ownership), WP-142 ✅ (legends publisher), D-5301/D-5302 (verifier + immutability), DESIGN-RANKING (identity on `player_id`, never handle)
**EC:** pending (drafted at execution-prep)
**Baseline:** `origin/main` at `321e4f05` (2026-07-09)
**User-Visible Surface:** none — infrastructure (the payoff surface is WP-345, which renders the per-count boards and rosters; the snapshots this packet publishes are inert until then)
**Executes:** D-24134 §1–§5 (server half)

---

## Goal

Make the D-24134 per-player-count gauntlet standings exist as published R2
snapshots. After this session: (1) every new verified competitive score row
records the match **player count** (1–5), derived server-side from the
already-reduced replay; (2) the gauntlet read-layer aggregates **per player
count with roster-keyed entries** — a multiplayer entry belongs to the exact
team of authenticated accounts that cleared every leg together, and carries
every member's handle; (3) the WP-142 publisher emits the solo board under
the existing file name plus additive `-p<N>` boards (N = 2..5, lazily), and
the gauntlet index gains per-count entry counts and the per-gauntlet leg
list. No engine change, no HTTP endpoint change, no client change.

---

## Assumes

- **WP-342 is merged and live in code** (migration 026 may still be
  PROD-pending; tests run against the local `TEST_DATABASE_URL` with 026+027
  applied). `gauntlet.logic.ts` exports `buildGauntletCatalog` /
  `getGauntletStandings(definition, database, leaderboardDeps)` and the
  publisher emits gauntlet boards + `gauntlet-index.json`.
- **The reduced final state exposes the seat count.** `MatchReplayResult`
  is `{ finalState, stateHash, turnCount }` (no player count field);
  `LegendaryGameState.playerZones` is a per-player record, so the seat
  count is the key count of `reduced.finalState.playerZones`
  (`packages/game-engine/src/types.ts` — read, not imported anew; the
  submit pipeline already holds `reduced.finalState` at step 14b).
- **Ownership is one row per authenticated seat.**
  `legendary.replay_ownership` (migration 005) is keyed
  `UNIQUE (player_id, replay_hash)` with a `visibility` column;
  WP-335 capture calls `assignReplayOwnership` for each authenticated seat,
  so a fully-authenticated N-player match has exactly N ownership rows for
  its `replay_hash`. Existing lookups are single-row
  (`findReplayOwnership` = `LIMIT 1`); there is **no list-all-owners
  function yet** — this packet adds one.
- **`CompetitiveScoreRecord` carries a 12-key drift lock** documented in
  its JSDoc (`competition.types.ts`, amended 11→12 by D-24131); the lock is
  JSDoc + a compile-time type reference, not a runtime key-count test.
  Adding `playerCount` amends it to 13 keys under D-24134 authority.
- `pnpm -r build` exits 0 on `main`; the `apps/server` no-DB suite is
  green; DB-gated suites run serialized when `TEST_DATABASE_URL` is set
  (848/848 baseline per PR #630, plus WP-342's additions).

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `docs/ai/DECISIONS.md` — **D-24134** (the design lock this packet
  executes; read it in full), D-24131 (parent gauntlet design), D-24119..
  D-24128 (write-path arc), D-5301/D-5302, D-14204 (manifest-last),
  DESIGN-RANKING.
- `docs/ai/ARCHITECTURE.md` §Layer Boundary (Authoritative) +
  `.claude/rules/architecture.md` — server-layer work only; the engine is
  read, never modified.
- `docs/ai/REFERENCE/00.2-data-requirements.md` §8.1 — canonical field
  names; the gauntlet slug space derives from registry data keyed by the
  canonical ids, never re-slugified names (the WP-342 discipline).
- `docs/12-SCORING-REFERENCE.md` §Player Count Adjustment — the spec-level
  PAR term this packet's segmentation is honest about (context only; no
  scoring change here).
- `apps/server/src/legends/gauntlet.logic.ts` + `legends.types.ts` +
  `legends.publisher.ts` — the WP-342 surfaces this packet extends.
- `apps/server/src/competition/competition.logic.ts` (step 14b outcome
  derivation — the pattern the player-count derivation mirrors) +
  `competition.types.ts`.
- `apps/server/src/identity/replayOwnership.logic.ts` — the single-row
  lookups the new list-all-owners function sits beside.
- `data/migrations/026_add_outcome_to_competitive_scores.sql` — the
  idempotency pattern migration 027 copies.

---

## Scope (In)

- Migration `027`: nullable `player_count smallint` with a 1..5 CHECK on
  `legendary.competitive_scores`.
- Persist `player_count` at submission time, derived from the reduced
  final state's `playerZones` key count (mirrors the step-14b outcome
  derivation; write-once).
- `replayOwnership.logic.ts`: new `listReplayOwners(replayHash, database)`
  returning every owner (player id, handle/display name, visibility) of a
  replay hash.
- `gauntlet.logic.ts`: standings become per-(definition × playerCount) and
  roster-keyed per D-24134 §3 — replay-level dedupe, owner-count ==
  player_count gate, all-owners-visible gate, same-roster-across-all-legs
  aggregation, `players[]` on entries, tiebreak on joined roster handles.
- Publisher: solo board under the existing name; additive
  `gauntlet-<setAbbr>-<mastermindSlug>-p<N>.json` (N = 2..5) written only
  when ≥1 complete entry; index entries gain `entryCounts` + `legs`;
  manifest `gauntletBoards` lists whatever board files were written
  (manifest-last per D-14204 unchanged).
- Tests for all of the above (unit + DB-gated).

## Out of Scope

- **Any engine change** (`packages/game-engine/**`) — `playerZones` is
  read via the already-reduced state; `MatchReplayResult` is unchanged.
- **Any HTTP endpoint change** — no new routes; `api-endpoints.md`
  untouched.
- **The legends-board client** — WP-345 renders what this packet publishes.
- **The classic per-scenario leaderboards** (`leaderboard.logic.ts`,
  `PublicLeaderboardEntry`, `global-top` / `scenario-*` snapshots) — count
  segmentation there is explicitly not decided (D-24134 §Not decided).
- **Backfilling `player_count` for pre-existing rows** — legacy `NULL`
  rows never qualify on count-keyed boards (D-24134 §1); no data rewrite.
- **Preset compositions / lobby prefill / any arena-client or
  registry-viewer change** — the challenge link lands on an existing
  surface (WP-345 builds the link; nothing here).
- **Per-count PAR calibration** — named in D-24134 §7 as future work.

---

## Files Expected to Change

> 11 files — above the ~8 soft cap of 00.3 §5, accepted at draft time
> because 5 of the 11 are test files and 1 is a migration; the code surface
> is 5 files spanning one cohesive arc (persist the count → list the
> owners → aggregate per count → publish per count). Splitting would strand
> a column with no consumer (the WP-342 rationale, verbatim applicable).

1. `data/migrations/027_add_player_count_to_competitive_scores.sql` —
   **new** — `ALTER TABLE legendary.competitive_scores ADD COLUMN IF NOT
   EXISTS player_count smallint CHECK (player_count BETWEEN 1 AND 5)`;
   idempotent, mirrors migration 026's guard pattern.
2. `apps/server/src/competition/competition.types.ts` — **modified** —
   `CompetitiveScoreRecord` gains `playerCount: number | null`; the JSDoc
   key-lock list is amended 12 → 13 keys citing D-24134.
3. `apps/server/src/competition/competition.logic.ts` — **modified** — a
   step alongside the 14b outcome derivation computes the seat count from
   `reduced.finalState.playerZones` and the INSERT writes it; a
   defensively-missing record stores SQL NULL, never a rejection (the
   outcome-derivation posture).
4. `apps/server/src/competition/competition.logic.test.ts` — **modified**
   — DB-gated: a submitted solo replay persists `player_count = 1`; a
   two-seat fixture persists `2`; the record-shape reference reflects 13
   keys.
5. `apps/server/src/identity/replayOwnership.logic.ts` — **modified** —
   new `listReplayOwners(replayHash, database)`: all rows for the hash
   joined to `legendary.players` for display name; no LIMIT.
6. `apps/server/src/identity/replayOwnership.logic.test.ts` — **modified**
   — DB-gated: two-owner replay lists both; single-owner lists one;
   unknown hash lists none.
7. `apps/server/src/legends/gauntlet.logic.ts` — **modified** —
   `getGauntletStandings` gains a `playerCount` parameter and implements
   the D-24134 §3 roster aggregation (replay-level dedupe; owner-count
   gate; all-owners-visible gate; same-roster-per-leg fold; `players[]`).
8. `apps/server/src/legends/gauntlet.logic.test.ts` — **modified** — the
   DB-gated inclusion/exclusion matrix per Acceptance Criterion 5.
9. `apps/server/src/legends/legends.types.ts` — **modified** —
   `GauntletSnapshotEntry` gains `players: readonly string[]`;
   `GauntletIndexEntry` gains `entryCounts` (per-count complete-entry
   counts) and `legs: readonly { schemeSlug: string; schemeName: string }[]`.
10. `apps/server/src/legends/legends.publisher.ts` — **modified** — emits
    the solo board under the existing name plus lazy `-p<N>` boards;
    populates `entryCounts` + `legs` on index entries; `gauntletBoards`
    lists all written gauntlet files; manifest still written last.
11. `apps/server/src/legends/legends.publisher.test.ts` — **modified** —
    per-count emission paths; existing WP-142/WP-342 assertion values
    preserved unmodified.

Governance files (`DECISIONS.md` status note, `WORK_INDEX.md` check-off,
`STATUS.md` entry) are updated at close per the Definition of Done, not
listed above.

---

## Contract

Locked by **D-24134** — restated for execution convenience; DECISIONS.md
wins on any divergence.

- **Column.** `player_count smallint NULL CHECK (player_count BETWEEN 1
  AND 5)`; written once at insert (D-5302), derived server-side from the
  reduced final state's per-player record key count; never client-supplied;
  never updated. Legacy `NULL` never qualifies on count-keyed boards.
- **Board identity.** (set `abbr` × mastermind `slug` × playerCount 1..5).
  Solo board file name unchanged: `gauntlet-<setAbbr>-<mastermindSlug>.json`
  (redefined as the 1-player board); multiplayer files
  `gauntlet-<setAbbr>-<mastermindSlug>-p<N>.json` for N in 2..5, written
  only when ≥1 complete entry.
- **Qualifying replay (per leg, per count).** `outcome = 'heroes-win'`;
  `player_count = <boardCount>`; row's `scoring_config_version` equals the
  currently-published version for its `scenario_key` (VISION §22, the
  WP-342 `checkParPublished` reuse); the replay's `replay_ownership` owner
  count equals `player_count` (all seats authenticated); every owner's
  ownership visibility is `link` or `public`. Co-owner duplicate score
  rows are deduplicated at replay level (identical `final_score` by
  construction — D-5301 server recomputation).
- **Roster and entry.** Competitor = the sorted tuple of owner
  `player_id`s. The same roster must hold a qualifying best on **every**
  leg at that count. `totalScore` = integer sum of best-per-leg;
  `averageScoreCentis = Math.round(totalScore * 100 / legCount)`; rank
  `totalScore ASC`, tiebreak `players.join(',') ASC` (handle-ASC roster,
  so solo boards keep the WP-342 `handle ASC` behavior). Entry shape:
  `{ handle, rank, totalScore, legCount, averageScoreCentis, players }`
  with `players` = roster handles sorted ASC and `handle = players[0]`.
- **Index entry (additive).** `entryCounts: { 1: n1, 2: n2, 3: n3,
  4: n4, 5: n5 }` (complete-entry counts per player count; the exact
  TypeScript shape — record vs readonly tuple — is the executor's choice,
  locked at EC time); existing `entryCount` remains and equals the solo
  board's count; `legs: readonly { schemeSlug, schemeName }[]` in the
  set's scheme order from the catalog.
- **Identity discipline.** Aggregation keys on `player_id` tuples; handles
  attach via the read JOIN only (DESIGN-RANKING). No accountId, email, or
  ownership-visibility value appears in any snapshot.
- **Publisher ordering.** All gauntlet files (all counts) and the index
  are written before `manifest.json` (D-14204 preserved).

---

## Non-Negotiable Constraints

**Engine-wide:** ESM only, Node v22+. Human-style code — see
`docs/ai/REFERENCE/00.6-code-style.md` (full English names, `is/has/can`
booleans, JSDoc on every function, ≤30-line functions, `// why:` on
non-obvious decisions, full-sentence error messages). Full file contents
for every new or modified file — no diffs, no snippets, no "show only the
changed section". Test files `.test.ts` with `node:test` + `node:assert`
only; DB-dependent tests use the existing non-silent skip when
`TEST_DATABASE_URL` is unset. No new npm dependencies.

**Packet-specific:**
- `packages/game-engine/**` is read-only this session; the seat count is
  read off the already-reduced state object the pipeline holds — no new
  engine import, no `MatchReplayResult` change.
- No `boardgame.io` import in any touched file (the existing seams stand).
- No `Math.random()`, no wall-clock reads inside logic functions —
  `generatedAt` stays on the publisher's existing timestamp source.
- `.reduce()` is not used in the standings aggregation — explicit
  `for...of` per code-style rules.
- The `competitive_scores` INSERT remains write-once (D-5302);
  `player_count` is written at insert, never updated.
- Existing snapshot/manifest/index fields are byte-compatible: no field
  renamed, removed, or re-typed; additions are additive only; the deployed
  WP-343 SPA must render the new snapshots without modification.
- Existing `getGauntletStandings` callers are updated in the same change
  (the publisher is the only production caller); the solo call path must
  produce entries whose existing five fields match WP-342 semantics
  restricted to `player_count = 1`.
- SQL uses the existing `pg` pool patterns (parameterized queries only).
- **No new environment variables**; `.env.example` needs no edit.
- **No authentication change** (§11 N/A) — eligibility reads ownership
  rows that already exist; nothing new is required of the submitter.

**Session protocol:** stop and ask on any unclear item; if
`reduced.finalState.playerZones` proves not to be a reliable seat-count
source for any legacy artifact shape, STOP and reconcile against the
WP-334 reducer before writing the derivation.

**Locked contract values:** the Contract section above (D-24134); the
`player_count` 1..5 CHECK; board-file naming
`gauntlet-<setAbbr>-<mastermindSlug>-p<N>.json`; index field names
`entryCounts` / `legs`; entry field name `players`.

---

## Acceptance Criteria

1. Migration `027_add_player_count_to_competitive_scores.sql` exists, is
   idempotent (safe to re-run), and adds `player_count smallint NULL` with
   the 1..5 CHECK constraint.
2. A DB-gated test proves a submitted solo replay persists
   `player_count = 1` and a two-authenticated-seat fixture persists
   `player_count = 2` on the inserted row.
3. `CompetitiveScoreRecord` carries `playerCount: number | null`; the
   JSDoc key-lock reads 13 keys; the compile-time record reference in the
   test file reflects the new shape.
4. `listReplayOwners` (DB-gated): a replay with two ownership rows returns
   both owners with display names; one row returns one; an unknown hash
   returns an empty list.
5. `getGauntletStandings` per-count matrix (DB-gated): (a) a solo player
   with winning bests on all legs appears on the p1 board with correct
   totals; (b) a fixed two-account roster with winning bests on all legs
   appears on the p2 board with both handles in `players` (handle ASC);
   (c) a 2-player replay with only one ownership row (guest seat) never
   qualifies; (d) a roster missing one leg is absent; (e) two different
   rosters sharing a member produce two independent entries; (f) a
   `player_count` NULL row never qualifies on any count; (g) a
   non-current `scoring_config_version` row never qualifies; (h) a roster
   member with `private` ownership visibility excludes that roster's
   replay.
6. The publisher writes the solo board under the existing file name,
   writes `-p<N>` files only for counts with ≥1 complete entry, always
   writes `gauntlet-index.json` with `entryCounts` and `legs` on every
   entry, and writes `manifest.json` last with `gauntletBoards` listing
   exactly the gauntlet files written this cycle.
7. Existing publisher outputs are additive-compatible: prior
   `legends.publisher.test.ts` and `gauntlet.logic.test.ts` assertion
   values for the five WP-342 entry fields pass unmodified.
8. `git diff --name-only` shows only the 11 listed files (plus governance
   files per DoD).
9. `pnpm -r build` exits 0; the `apps/server` no-DB suite passes; DB-gated
   suites pass serialized against a local `TEST_DATABASE_URL` with
   migrations 026 + 027 applied.

---

## Verification Steps

```bash
# 1. Build everything (expect exit 0)
pnpm -r build

# 2. Server suite, no-DB portion (expect green; DB-gated tests report the
#    non-silent skip when TEST_DATABASE_URL is unset)
pnpm --filter @legendary-arena/server test

# 3. Apply migration 027 to the local test database, then run DB-gated
#    serialized (expect: player-count persistence + roster standings
#    matrix + owner-listing tests green)
#    PowerShell (the project shell):
#      psql $env:TEST_DATABASE_URL -f data/migrations/027_add_player_count_to_competitive_scores.sql
#      $env:TEST_DATABASE_URL = "<local legendary_arena URL from .env>"; pnpm --filter @legendary-arena/server test

# 4. Scope check (expect: exactly the 11 listed files + governance)
git diff --name-only

# 5. Engine untouched (expect: empty)
git diff --name-only -- packages/game-engine
```

Expected key outputs are stated inline; any red that reproduces on the
baseline commit is pre-existing and reported, not silently absorbed.

---

## Vision Alignment

**Vision clauses touched:** §20, §21, §22, §24, §26 (PAR-based scoring and
leaderboards); §3, §11 (player identity, ownership, visibility); NG-1.

**Conflict assertion:** No conflict: this WP preserves all touched clauses.
Count segmentation strengthens §22 (scores compare only within a player
count, matching the scoring spec's own player-count term); §24 is
preserved (only replay-verified rows qualify); rosters key on `player_id`
tuples with handles attached at read time per §3/§11 and DESIGN-RANKING,
and no handle is published without that member's link/public ownership
visibility; NG-1 is untouched (standings confer recognition only).

**Non-Goal proximity check:** none of NG-1..7 are crossed — no paid
surface, no persuasion surface, no gameplay-affecting reward; the
all-seats-authenticated rule gates board eligibility, not gameplay.

**Determinism preservation:** the change is deterministic and
replay-faithful (Vision §22): no engine code, no RNG, no replay or hash
change; `player_count` derives from the same reduced final state the
verifier already computes; aggregation is a pure function of stored rows
plus registry data.

## Funding Surface Gate

N/A — server-side aggregation and snapshot publishing only; no UI
surfaces, no user-visible copy, and no funding channels referenced
(§20.1 trigger surfaces absent).

## API Catalog (§21)

N/A — no HTTP endpoint is added, modified, removed, or re-statused, and no
catalog-recorded `Library-only` function changes; `listReplayOwners` and
the standings changes are publisher-internal wiring, not import surfaces
recorded in `api-endpoints.md`.

---

## User-Visible Impact

None — infrastructure. The payoff is named: this packet makes the D-24134
per-count, roster-keyed standings exist as published R2 artifacts so
WP-345 (legends-board per-count boards + rosters + challenge links) has
real data to render. STATUS.md entry must state "No user-observable
change — infrastructure only."

---

## Definition of Done

- [ ] All Acceptance Criteria pass (1–9 above).
- [ ] `docs/ai/STATUS.md` updated — states "No user-observable change —
      infrastructure only" and names WP-345 as the consumer.
- [ ] `docs/ai/DECISIONS.md` D-24134 annotated with the execution date and
      any execution-discovered addenda.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — this packet checked off with
      the standard close summary.
- [ ] No files outside `## Files Expected to Change` (plus the governance
      files above) were modified.
- [ ] Migration 027 applied to the production database is recorded as an
      operator-pending step (deploy note), mirroring the 026 pattern —
      and noted alongside the still-pending 026 apply if that has not
      happened by execution time.
