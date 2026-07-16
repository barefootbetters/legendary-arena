# WP-384 — Fixed-Hero-Pool Gauntlet Division: `team_key` Persistence + Backfill + Pool-Constrained Standings + Publisher (Server)

**Status:** Drafted 2026-07-16; **execution-ready 2026-07-16** (EC-413 drafted at execution-prep; session prompt written)
**Primary Layer:** Server (`apps/server/**`) + one migration + one operator script + the D-24187 carve-out doc edits
**Dependencies:** D-24187 (design lock), WP-344 ✅ (player_count column + roster-keyed per-count standings + publisher), WP-342 ✅ (gauntlet read-layer + publisher), D-24131 / D-24134 (parent designs), D-24119 arc / WP-333..WP-340 ✅ (write path + replay artifacts), D-24165 (PLAYER_COUNT_SETUP — the heroCount source), D-10014 (set-qualified id space), D-5301/D-5302 (verifier + immutability), DESIGN-RANKING (identity on `player_id`, never handle)
**EC:** [EC-413](../execution-checklists/EC-413-fixed-hero-pool-gauntlet-server.checklist.md) (drafted 2026-07-16 at execution-prep)
**Baseline:** `origin/main` at `fc8d53f3` (2026-07-16, execution-prep; drafted @ `9340236b`)
**User-Visible Surface:** none — infrastructure (the payoff surface is WP-385, which renders the fixed-pool division; the snapshots this packet publishes are inert until then)
**Executes:** D-24187 §1–§6 (server half)

> **Execution addendum (2026-07-16, EC-413 draft).** Five reconciliations
> against code reality, discovered while drafting the EC:
> (1) **The record key lock is 14 → 15, not 13 → 14** — WP-354 / D-24146
> added `isRankedEligible` after D-24134's 13; `competition.types.ts`
> already documents exactly 14 keys.
> (2) **One wiring file joins the list — 13 files total** (the WP-342/
> WP-344 wiring-addendum class): `gauntlet.logic.ts`'s module contract
> forbids a registry import, so the `heroCount + 2` budgets arrive as
> plain data injected by `server.mjs` from `PLAYER_COUNT_SETUP` at wiring
> time (the catalog-injection precedent), never re-typed literals.
> (3) **One query, both divisions** — `getGauntletStandings` keeps its
> single roster-joined query per gauntlet (`cs.team_key` added to the
> DISTINCT ON subquery + outer SELECT) and returns per-count
> `{ open, fixed }`; the publisher (sole production caller) updates in
> the same change. Open-division assertion VALUES pass unmodified;
> accessor updates for the new shape are mechanical.
> (4) **The backfill is a SQL jsonb extraction, not a Node reduction** —
> `bgio.replay_artifacts.initial_state->'G'->'matchConfiguration'->
> 'heroDeckIds'` joined on `replay_hash`; the SQL sort is byte-equivalent
> to the JS sort (lowercase slug charset), pinned by an equivalence test.
> (5) **The column sweep spans five read surfaces** in
> `competition.logic.ts` (row interface, `mapRowToRecord`, idempotency
> fast-path SELECT, by-hash SELECT, `listPlayerCompetitiveScores`, plus
> the INSERT/RETURNING chain) — the EC-376 missed-column lesson, encoded
> as a locked sweep list.

---

## Goal

Make the D-24187 fixed-hero-pool prestige division exist as published R2
snapshots. After this session: (1) every new verified competitive score row
records the **hero team identity** (`team_key` — the match's set-qualified
hero ids, sorted ASC, `+`-joined), derived server-side from the verifier's
already-reduced final state; (2) a one-time operator script backfills
`team_key` for existing rows from their stored replay artifacts, under the
D-24187 carve-out; (3) the gauntlet read-layer computes a **pool-constrained
standings** variant beside the open one — an entry qualifies only when some
assignment of one qualifying win per leg keeps the union of heroes within
the `heroCount + 2` budget; (4) the WP-142 publisher emits additive
`-fixed` (and `-fixed-p<N>`) board files lazily and the index gains
`fixedEntryCounts`. Open-division files, semantics, and entries are
byte-unchanged. No engine change, no HTTP endpoint change, no client change.

---

## Assumes

- **WP-344 is merged and live** (migration 027 applied). `gauntlet.logic.ts`
  exports `buildGauntletCatalog` / `getGauntletStandings(definition,
  database, leaderboardDeps)` returning `ReadonlyMap<playerCount,
  entries[]>` from one roster-joined query per gauntlet; the publisher emits
  per-count gauntlet boards + `gauntlet-index.json` with `entryCounts` +
  `legs`.
- **The reduced final state exposes the hero configuration.**
  `reduceMatchToFinalState` reproduces the live final `G`, and
  `G.matchConfiguration.heroDeckIds` (the 9-field composition lock,
  00.2 §8.1) carries the match's set-qualified hero ids (D-10014). The
  submit pipeline already holds `reduced.finalState` at the step that
  derives `outcome` (WP-342) and `player_count` (WP-344) — `team_key`
  derives at the same point from the same object.
- **Replay artifacts store `initialState`.** `bgio.replay_artifacts`
  (migration 025) rows carry `{ initialState, log }` keyed by
  `replay_hash`; `initialState.G.matchConfiguration.heroDeckIds` is the
  backfill source. The D-24187 carve-out (DECISIONS.md) authorizes this
  read for team-key derivation/backfill only.
- **`PLAYER_COUNT_SETUP` is importable by the server.**
  `@legendary-arena/registry` exports the D-24165 table (WP-370; also
  re-exported browser-safe by WP-372); `apps/server` may import `registry`
  per the Layer Boundary. `heroCount` per player count: 1 → 3, 2–4 → 5,
  5 → 6.
- **`CompetitiveScoreRecord` carries a 13-key drift lock** documented in
  its JSDoc (`competition.types.ts`, amended 12→13 by D-24134); the lock is
  JSDoc + a compile-time type reference. Adding `teamKey` amends it to 14
  keys under D-24187 authority.
- Migration numbering: `034` is the next free number at draft time (033 =
  WP-375's `match_bot_ally`). The executor re-checks `data/migrations/`
  and open PR branches before creating the file (the WP-375 placeholder-030
  lesson) and renumbers if taken.
- `pnpm -r build` exits 0 on `main`; the `apps/server` no-DB suite is
  green; DB-gated suites run serialized when `TEST_DATABASE_URL` is set.

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `docs/ai/DECISIONS.md` — **D-24187** (the design lock this packet
  executes; read it in full), D-24131 / D-24134 (parent gauntlet designs),
  D-24119..D-24128 (write-path arc + artifact store), D-24095 / D-24153 /
  D-24169 (the existing blob-read carve-outs the D-24187 clause sits
  beside), D-24165 (setup table), D-10014 (set-qualified ids),
  D-5301/D-5302, D-14204 (manifest-last), DESIGN-RANKING.
- `docs/ai/ARCHITECTURE.md` §Layer Boundary (Authoritative) +
  §Persistence Boundary + `.claude/rules/architecture.md` — this packet
  EDITS the Persistence Boundary carve-out text (D-24187) and must mirror
  it in the rules file (the D-24169 pattern).
- `docs/ai/REFERENCE/00.2-data-requirements.md` §8.1 — `heroDeckIds` is
  the canonical composition field name; ids are never re-slugified.
- `packages/game-engine/src/scoring/parScoring.keys.ts` — `buildTeamKey`
  (the sorted-`+`-join discipline the `team_key` value format follows;
  read for the format, applied to the set-qualified id space per D-24187
  §1).
- `packages/registry/src/playerCountSetup.ts` — `PLAYER_COUNT_SETUP`
  (the `heroCount` source for the pool budget).
- `apps/server/src/legends/gauntlet.logic.ts` + `legends.types.ts` +
  `legends.publisher.ts` — the WP-342/WP-344 surfaces this packet extends.
- `apps/server/src/competition/competition.logic.ts` (the WP-344
  `player_count` derivation — the pattern the `team_key` derivation sits
  beside) + `competition.types.ts`.
- `data/migrations/027_add_player_count_to_competitive_scores.sql` — the
  idempotency pattern migration 034 copies.
- `scripts/migrate.mjs` — how migrations reach production (auto-run on
  deploy); the backfill script is deliberately NOT a migration (it reads
  artifacts row-by-row and is operator-run).

---

## Scope (In)

- Migration `034`: nullable `team_key text` on
  `legendary.competitive_scores`.
- Persist `team_key` at submission time, derived from
  `reduced.finalState.matchConfiguration.heroDeckIds` (sorted ASC,
  `+`-joined, set-qualified ids exactly as configured — never
  re-slugified); write-once.
- `scripts/backfill-team-key.mjs`: operator-run, one-time, dry-run by
  default (`--write` to apply) — for each `competitive_scores` row with
  `team_key IS NULL`, read the matching `bgio.replay_artifacts` row's
  `initialState.G.matchConfiguration.heroDeckIds` and UPDATE the column;
  rows with no artifact are reported and left NULL.
- `gauntlet.logic.ts`: a fixed-division standings computation per D-24187
  §4–§5 — pool budget `heroCount + 2` from `PLAYER_COUNT_SETUP`;
  entry = an assignment of one qualifying win per leg whose hero-id union
  fits the budget; `totalScore` = minimum over pool-satisfying
  assignments; deterministic bounded search over the competitor's distinct
  `team_key`s with logged (never silent) truncation.
- `legends.types.ts`: fixed-board entries gain
  `heroPool: readonly string[]`; index entries gain `fixedEntryCounts`.
- Publisher: additive `gauntlet-<setAbbr>-<mastermindSlug>-fixed.json` +
  `…-fixed-p<N>.json` (N = 2..5), written only when ≥1 complete entry;
  index entries gain `fixedEntryCounts`; manifest `gauntletBoards` lists
  whatever was written (manifest-last per D-14204 unchanged).
- The D-24187 carve-out clause added to `docs/ai/ARCHITECTURE.md`
  §Persistence Boundary and mirrored in `.claude/rules/architecture.md`.
- Tests for all of the above (unit + DB-gated).

## Out of Scope

- **Any engine change** (`packages/game-engine/**`) — `buildTeamKey` is
  read for its format discipline; the value is computed server-side.
- **Any HTTP endpoint change** — no new routes; `api-endpoints.md`
  untouched.
- **The legends-board client** — WP-385 renders what this packet
  publishes.
- **Any change to open-division semantics** — the D-24131/D-24134
  standings, board files, entry shapes, and qualification rules are
  byte-unchanged; the fixed division is computed beside them, never
  instead of them.
- **The classic per-scenario leaderboards** — hero constraints there are
  explicitly not decided (D-24187 §Not decided).
- **Promoting fixed-pool to the sole entry rule** — D-24187 resolves the
  fork to parallel divisions; revisiting is a future D-entry.
- **A declared-pool UX** — pools are inferred from wins, never declared.
- **Per-count PAR calibration** — D-24134 §7 future work, unchanged.

---

## Files Expected to Change

> 12 files — above the ~8 soft cap of 00.3 §5, accepted at draft time
> because 4 of the 12 are test files, 1 is a migration, and 2 are the
> mandatory D-24187 carve-out doc edits (ARCHITECTURE.md + rules mirror,
> which must land in the impl commit); the code surface is 5 files
> spanning one cohesive arc (persist the team → backfill it → aggregate
> under the pool constraint → publish the division). Splitting would
> strand a column with no consumer (the WP-342/WP-344 rationale).

1. `data/migrations/034_add_team_key_to_competitive_scores.sql` — **new**
   — `ALTER TABLE legendary.competitive_scores ADD COLUMN IF NOT EXISTS
   team_key text`; idempotent, mirrors migration 027's guard pattern.
2. `apps/server/src/competition/competition.types.ts` — **modified** —
   `CompetitiveScoreRecord` gains `teamKey: string | null`; the JSDoc
   key-lock list is amended 13 → 14 keys citing D-24187.
3. `apps/server/src/competition/competition.logic.ts` — **modified** — a
   step beside the WP-344 player-count derivation computes `team_key`
   from `reduced.finalState.matchConfiguration.heroDeckIds` (sorted ASC,
   `+`-joined) and the INSERT writes it; a defensively-missing
   configuration stores SQL NULL, never a rejection (the outcome /
   player-count posture).
4. `apps/server/src/competition/competition.logic.test.ts` — **modified**
   — DB-gated: a submitted replay persists the expected sorted
   set-qualified `team_key` (pinned string); the record-shape reference
   reflects 14 keys.
5. `scripts/backfill-team-key.mjs` — **new** — operator-run backfill;
   dry-run default with a row-count report, `--write` applies; artifact
   missing → reported, row left NULL; idempotent (only touches
   `team_key IS NULL` rows).
6. `apps/server/src/legends/gauntlet.logic.ts` — **modified** — the
   fixed-division standings computation (pool budget from
   `PLAYER_COUNT_SETUP`; assignment search per D-24187 §4–§5).
7. `apps/server/src/legends/gauntlet.logic.test.ts` — **modified** — the
   DB-gated inclusion/exclusion matrix per Acceptance Criterion 5.
8. `apps/server/src/legends/legends.types.ts` — **modified** — fixed-board
   `GauntletSnapshotEntry` gains `heroPool: readonly string[]`;
   `GauntletIndexEntry` gains `fixedEntryCounts`.
9. `apps/server/src/legends/legends.publisher.ts` — **modified** — emits
   `-fixed` / `-fixed-p<N>` boards lazily; populates `fixedEntryCounts`;
   manifest still written last.
10. `apps/server/src/legends/legends.publisher.test.ts` — **modified** —
    fixed-board emission paths; existing WP-142/WP-342/WP-344 assertion
    values preserved unmodified.
11. `docs/ai/ARCHITECTURE.md` — **modified** — the D-24187 team-key
    carve-out clause added to §Persistence Boundary (beside D-24153 /
    D-24169).
12. `.claude/rules/architecture.md` — **modified** — the carve-out mirror
    (same clause, enforcement phrasing).

Governance files (`DECISIONS.md` status note, `WORK_INDEX.md` check-off,
`STATUS.md` entry) are updated at close per the Definition of Done, not
listed above.

---

## Contract

Locked by **D-24187** — restated for execution convenience; DECISIONS.md
wins on any divergence.

- **Column.** `team_key text NULL`; written once at insert (D-5302),
  derived server-side from the reduced final state's
  `matchConfiguration.heroDeckIds`; never client-supplied; never updated
  except by the one-time backfill (which only fills NULLs). Value format:
  the set-qualified hero ids (D-10014 `setAbbr/slug` space, exactly as
  configured — never re-slugified) sorted ASC, joined `+`.
- **NULL semantics.** A `team_key IS NULL` row never qualifies on any
  fixed-division board (the migration-026/027 NULL pattern); the backfill
  shrinks the NULL population but rows with no surviving artifact stay
  NULL and stay open-division-only.
- **Division identity.** One fixed board per existing gauntlet board:
  `gauntlet-<setAbbr>-<mastermindSlug>-fixed.json` (solo) and
  `gauntlet-<setAbbr>-<mastermindSlug>-fixed-p<N>.json` (N = 2..5),
  written only when ≥1 complete entry. The `-fixed` segment precedes
  `-p<N>`. Open-division file names and contents are byte-unchanged.
- **Pool budget.** Exactly `heroCount + 2`, player-count-relative from
  `PLAYER_COUNT_SETUP` (D-24165): 1p → 5, 2–4p → 7, 5p → 8. The
  qualification check is binary: the union of distinct hero ids across
  the entry's assignment has size ≤ the budget.
- **Qualifying assignment (per board).** One qualifying win per leg where
  every open-division rule holds unchanged (`outcome = 'heroes-win'`,
  current `scoring_config_version`, `player_count` = the board's count,
  both-sides-same-set, and at N ≥ 2 the D-24134 §3 roster rules: same
  account roster on every leg, owner count = player count, all owners
  link/public), each win has a non-NULL `team_key`, and the union
  constraint holds. `totalScore` = the minimum best-per-leg sum over
  pool-satisfying assignments; `averageScoreCentis` and ranking/tiebreak
  exactly as the open division.
- **Bounded search.** Deterministic; searches over the competitor's
  distinct `team_key`s per gauntlet; the exact algorithm and bound are
  the executor's choice locked at EC time; truncation (a competitor
  exceeding the bound) is logged, never silent.
- **Entry / index shape (additive).** Fixed-board entries carry
  `heroPool: readonly string[]` — the union of set-qualified hero ids
  across the chosen legs, sorted ASC. Index entries gain
  `fixedEntryCounts` (complete-entry count per player count 1..5; the
  `entryCounts` shape). Existing fields are byte-compatible; no field
  renamed, removed, or re-typed.
- **Carve-out.** The backfill's artifact read is authorized by D-24187
  §2 only for deriving/backfilling `team_key`; the ARCHITECTURE.md +
  rules-mirror edits land in this packet's impl commit.
- **Terminology.** The hero constraint is the **hero pool**; "roster"
  remains the D-24134 account dimension. Code identifiers follow this
  (`heroPool`, never `roster` for heroes).
- **Publisher ordering.** All gauntlet files (both divisions, all counts)
  and the index are written before `manifest.json` (D-14204 preserved).

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
- `packages/game-engine/**` is read-only this session; the team key is
  computed off the already-reduced state object the pipeline holds — no
  new engine import surface beyond what `competition.logic.ts` already
  uses.
- No `boardgame.io` import in any touched file (the existing seams stand).
- No `Math.random()`, no wall-clock reads inside logic functions —
  `generatedAt` stays on the publisher's existing timestamp source.
- `.reduce()` is not used in the standings aggregation or the assignment
  search — explicit `for...of` per code-style rules.
- The `competitive_scores` INSERT remains write-once (D-5302); the
  backfill UPDATEs only `team_key IS NULL` rows and no other column.
- The backfill script is read-only against `bgio.*` (SELECT only) and
  writes only `legendary.competitive_scores.team_key`; it is dry-run by
  default and idempotent.
- Existing snapshot/manifest/index fields are byte-compatible: additions
  are additive only; the deployed WP-345 SPA must render the new
  snapshots without modification (it ignores unknown fields).
- Open-division standings outputs are byte-identical for existing
  fixtures: prior `gauntlet.logic.test.ts` / `legends.publisher.test.ts`
  assertion values pass unmodified.
- SQL uses the existing `pg` pool patterns (parameterized queries only).
- **No new environment variables**; `.env.example` needs no edit.
- **No authentication change** (§11 N/A) — eligibility reads rows that
  already exist; nothing new is required of the submitter.

**Session protocol:** stop and ask on any unclear item; if
`matchConfiguration.heroDeckIds` proves absent or malformed on any legacy
artifact shape, the backfill reports and skips (never guesses); if the
assignment search cannot be kept deterministic within a reasonable bound,
STOP and reconcile against D-24187 §5 before shipping a heuristic.

**Locked contract values:** the Contract section above (D-24187); the
`team_key` sorted-`+`-join set-qualified format; the `heroCount + 2`
budget; board-file naming `…-fixed[-p<N>].json` with `-fixed` preceding
`-p<N>`; field names `heroPool` / `fixedEntryCounts`.

---

## Acceptance Criteria

1. Migration `034_add_team_key_to_competitive_scores.sql` exists, is
   idempotent (safe to re-run), and adds `team_key text NULL`.
2. A DB-gated test proves a submitted replay persists the expected
   `team_key` (pinned sorted set-qualified string) and that the value
   matches the fixture's `heroDeckIds` regardless of their configured
   order.
3. `CompetitiveScoreRecord` carries `teamKey: string | null`; the JSDoc
   key-lock reads 14 keys; the compile-time record reference in the test
   file reflects the new shape.
4. The backfill script in dry-run mode reports the NULL-row count and
   writes nothing; with `--write` it fills `team_key` for rows whose
   artifact exists, reports rows whose artifact is missing, and a second
   `--write` run is a no-op.
5. Fixed-division standings matrix (DB-gated): (a) a player whose wins on
   all legs share one 5-hero team appears with `heroPool` = those 5; (b) a
   player using 7 distinct heroes across legs on a 2–4p board qualifies
   (budget 7) and one using 8 does not; (c) the assignment search prefers
   a pool-satisfying combination over the unconstrained best when the
   unconstrained best blows the budget (pinned totals); (d) a NULL
   `team_key` row never participates; (e) open-division standings for the
   same fixtures are byte-identical to their WP-344 values; (f) at count
   2, the D-24134 roster rules still gate fixed entries (a guest seat
   voids); (g) solo budget is 5 (heroCount 3 + 2).
6. The publisher writes `-fixed` / `-fixed-p<N>` files only for boards
   with ≥1 complete entry, always writes `gauntlet-index.json` with
   `fixedEntryCounts` on every entry, and writes `manifest.json` last
   listing exactly the gauntlet files written this cycle.
7. Existing publisher outputs are additive-compatible: prior
   `legends.publisher.test.ts` and `gauntlet.logic.test.ts` assertion
   values pass unmodified.
8. The D-24187 carve-out clause is present in `docs/ai/ARCHITECTURE.md`
   §Persistence Boundary and mirrored in
   `.claude/rules/architecture.md`, scoped to team-key
   derivation/backfill only.
9. `git diff --name-only` shows only the 12 listed files (plus governance
   files per DoD).
10. `pnpm -r build` exits 0; the `apps/server` no-DB suite passes;
    DB-gated suites pass serialized against a local `TEST_DATABASE_URL`
    with migrations through 034 applied.

---

## Verification Steps

```bash
# 1. Build everything (expect exit 0)
pnpm -r build

# 2. Server suite, no-DB portion (expect green; DB-gated tests report the
#    non-silent skip when TEST_DATABASE_URL is unset)
pnpm --filter @legendary-arena/server test

# 3. Apply migration 034 to the local test database, then run DB-gated
#    serialized (expect: team-key persistence + fixed-division matrix +
#    publisher emission tests green)
#    PowerShell (the project shell):
#      psql $env:TEST_DATABASE_URL -f data/migrations/034_add_team_key_to_competitive_scores.sql
#      $env:TEST_DATABASE_URL = "<local legendary_arena URL from .env>"; pnpm --filter @legendary-arena/server test

# 4. Backfill dry-run against the local test database (expect: a report,
#    zero writes)
#    node --env-file=.env scripts/backfill-team-key.mjs

# 5. Scope check (expect: exactly the 12 listed files + governance)
git diff --name-only

# 6. Engine untouched (expect: empty)
git diff --name-only -- packages/game-engine
```

Expected key outputs are stated inline; any red that reproduces on the
baseline commit is pre-existing and reported, not silently absorbed.

---

## Vision Alignment

**Vision clauses touched:** §20, §21, §22, §24, §26 (PAR-based scoring and
leaderboards); §3, §11 (player identity, ownership, visibility); NG-1.

**Conflict assertion:** No conflict: this WP preserves all touched clauses.
The fixed-pool division deepens §20/§26 (standing earned by demonstrated
breadth of mastery, not per-leg counter-picking); §24 is preserved (only
replay-verified rows qualify, and `team_key` derives from the same
verified reduction); §22 is preserved (qualification still pins the
current `scoringConfigVersion`; no score math changes); identity stays on
`player_id` with handles attached at read time per §3/§11 and
DESIGN-RANKING; NG-1 is untouched (the division confers recognition only).

**Non-Goal proximity check:** none of NG-1..7 are crossed — no paid
surface, no persuasion surface, no gameplay-affecting reward; the pool
constraint gates board eligibility, not gameplay.

**Determinism preservation:** the change is deterministic and
replay-faithful (Vision §22): no engine code, no RNG, no replay or hash
change; `team_key` derives from the same reduced final state the verifier
already computes; the assignment search is a deterministic pure function
of stored rows plus registry data, with logged (never silent) bounds.

## Funding Surface Gate

N/A — server-side aggregation, one migration, one operator script, and
snapshot publishing only; no UI surfaces, no user-visible copy, and no
funding channels referenced (§20.1 trigger surfaces absent).

## API Catalog (§21)

N/A — no HTTP endpoint is added, modified, removed, or re-statused, and no
catalog-recorded `Library-only` function changes; the standings and
publisher changes are publisher-internal wiring, not import surfaces
recorded in `api-endpoints.md`.

---

## User-Visible Impact

None — infrastructure. The payoff is named: this packet makes the D-24187
fixed-hero-pool championship exist as published R2 artifacts so WP-385
(legends-board division toggle + hero-pool display) has real data to
render. STATUS.md entry must state "No user-observable change —
infrastructure only."

---

## Definition of Done

- [ ] All Acceptance Criteria pass (1–10 above).
- [ ] `docs/ai/STATUS.md` updated — states "No user-observable change —
      infrastructure only" and names WP-385 as the consumer.
- [ ] `docs/ai/DECISIONS.md` D-24187 annotated with the execution date and
      any execution-discovered addenda.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — this packet checked off with
      the standard close summary.
- [ ] No files outside `## Files Expected to Change` (plus the governance
      files above) were modified.
- [ ] Migration 034 reaches production automatically via `render.yaml`'s
      server buildCommand (`scripts/migrate.mjs` runs on every deploy).
      The close notes confirm the post-merge deploy succeeded and record
      whether the operator backfill has been run against production (the
      backfill is operator-run, not deploy-run — an unrun backfill is a
      named open item, not a silent gap).
