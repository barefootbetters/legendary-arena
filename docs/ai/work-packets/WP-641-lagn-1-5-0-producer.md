# WP-641 — Result-LAGN 1.5.0 Producer: Battle Plan + Report Card (Writer Flip)

**Status:** Ready
**Primary Layer:** Server (`apps/server`) + the LAGN contract package (`packages/lagn-spec`, the writer flip)
**Dependencies:** WP-640 ✅ / D-24452 (the LAGN 1.5.0 reader contract — the `battle_plan` + `result.score` blocks this emits), WP-406 ✅ / D-24216 (the result-LAGN producer + 1.4.0 writer flip this extends), WP-635 ✅ (the `legendary.battle_plan` table + `readBattlePlan`), WP-583..591 ✅ + WP-335 ✅ (the `competitive_scores` rows + the `matchId → replay_hash` mapping)
**User-Visible Surface:** none directly — infrastructure (a completed match's result-LAGN now carries the Battle Plan + report card; consumers like the Hall of Legends match view / the download control render whatever the producer emits). The observable payoff is a richer downloaded `.lagn.json`.
**Baseline:** `origin/main` @ `a0236f5c` (draft worktree checkout point; the reserve-only ledger commit lands on top)

## Goal

The producer that gives WP-640's 1.5.0 reader contract a concrete emitter, and
the writer flip that activates it. `GET /api/match/:matchId/result-lagn` now
emits WP-640's two blocks for a completed match: `battle_plan` (the team's
3-phase plan) and `result.score` (the report card — raw/par/final scores, the
frozen grade band, and the scoring/par versions). `LAGN_VERSION` flips
`1.4.0 → 1.5.0` (so both LAGN emitters stamp 1.5.0). Both new reads are
domain-table reads; nothing scores or verifies from the emitted blocks — they
are descriptive, exactly like `players` / `result` today.

## Context

### The consumer story (mirrors WP-406)

A completed match already yields a result-LAGN (setup + `players[]` + `result` +
`scoring_profile`). This WP adds the two things the whole Battle-Plan / report-card
arc exists to make portable: the team's plan and their scorecard. Both are
**descriptive**: competitive credit stays `matchId → bgio blob → re-reduce →
re-verify hash → AccountId`, server-side (D-5301 / D-24126) — wiring either block
back as an input would reopen that trust hole.

### The score is match-level (design-load-bearing)

`raw_score` / `par_score` / `final_score` / `grade` are **match-level** — identical
across every seat's `competitive_scores` row (the score runs on the whole reduced
final `G`; only the VP/contribution split is per-player, and that split is
display-only, D-4803 / `PlayerScoringContribution`). So the producer reads **any
one** score row for the match (`findCompetitiveScore(replayHash)` LIMIT 1); it does
NOT pick a seat. An **unscored / casual** match has no `competitive_scores` row —
`result.score` is then **omitted** (the honest-partial posture, like a handleless
seat omitted from `players`).

### The grade is computed at write time (frozen)

`grade` is not stored anywhere — it is banded by `gradeForFinalScore(finalScore)`
(`@legendary-arena/game-engine`, the runtime-safe `.` surface the server already
imports). The producer computes it fresh from the row's `final_score` and stamps
it — a frozen snapshot of the operator-tunable bands as they stood at emit time.

## Assumes

- WP-640 ✅ on `main`: `packages/lagn-spec` already declares `LAGN_VERSION_1_5_0`,
  the `battle_plan` + `result.score` schema, the ordinal 1.5.0 gate, and the
  registered-but-unreachable `migrate_1_4_0_to_1_5_0` hop. `LAGN_VERSION` is still
  `LAGN_VERSION_1_4_0`.
- WP-406 ✅: `buildResultMatchLagn` (`matchLagn.logic.ts:497`) is pure construction;
  the route (`matchLagn.routes.ts`) does the reads and injects them via the
  `MatchLagnLogic` test seam; the endpoint is guest-readable, `404 match_not_finished`
  until `metadata.gameover`.
- WP-635 ✅: `readBattlePlan(matchId, database)` (`battlePlan.persistence.ts:119`)
  returns `{ preBattle, battleAdjustments, postBattle, … } | null`.
- WP-335/583..591 ✅: `readReplayHashByMatchId(matchId, db)` (`matchReplay.logic.ts`)
  maps `matchId → replay_hash` from `bgio.replay_artifacts`; `findCompetitiveScore(replayHash, db)`
  (`competition.logic.ts:631`) returns a `CompetitiveScoreRecord` (`rawScore`,
  `finalScore`, `scoreBreakdown` [with `parScore`], `parVersion`, `scoringConfigVersion`).
- `gradeForFinalScore` is exported from `@legendary-arena/game-engine` (`index.ts:244`).

If any of the above is false, this packet is **BLOCKED** and must not proceed.

## Scope (In)

### A) Writer flip (`packages/lagn-spec`)
1. `validator.ts:74` — `LAGN_VERSION = LAGN_VERSION_1_4_0` → `LAGN_VERSION_1_5_0`
   (+ its doc-comment). `package.json:3` — `"version": "1.4.0"` → `"1.5.0"` (the
   EC-422 manifest lockstep, same commit). No `migrate.ts` change — the flip makes
   the 1.0.0→1.5.0 chain reachable on its own.
2. `validator.test.ts` — re-pin the writer-version + migration-target assertions the
   flip moves (the WP-406 pattern; scaffold to measure the exact set — the writer
   pins at ~L651/935/1168/1433/1590 and the migration-target cases at
   ~L738/763/1098/1245/1440/1564 all shift from 1.4.0 to 1.5.0). This is a
   validation-tightening/flip change → **scaffold-first**.

### B) Producer (`apps/server`)
3. `matchLagn.logic.ts` — `buildResultMatchLagn` grows two optional params:
   `battlePlan?: BattlePlan` and `score?: ResultScore` (pure construction, like
   `players` / `result`). `result.score` is set **only when `result` is emitted**
   (the schema nests it; `result.outcome` is required, and the endpoint only runs
   for finished matches). Add a pure `toResultScore(record)` mapper:
   `{ raw_score: record.rawScore, par_score: record.scoreBreakdown.parScore,
   final_score: record.finalScore, grade: gradeForFinalScore(record.finalScore),
   scoring_config_version: record.scoringConfigVersion, par_version: record.parVersion }`;
   and a pure `toBattlePlanBlock(record)` (omit the whole block when the row is
   `null` or all three phases empty).
4. `matchLagn.routes.ts` — the `result-lagn` handler reads, after the existing
   gates: `readBattlePlan(matchId)` → `toBattlePlanBlock`; `readReplayHashByMatchId(matchId)`
   → `findCompetitiveScore(replayHash)` → `toResultScore` (both omitted on a null
   read). Pass both into `buildResultMatchLagn`. The three new reads join the
   `MatchLagnLogic` injection seam. The setup `/lagn` endpoint is unchanged in code
   (it just now stamps 1.5.0 via the flipped constant). Also refresh the
   `buildResultMatchLagn` JSDoc in `matchLagn.logic.ts` (its "1.4.0 as of WP-406"
   stamp note) to 1.5.0 — it goes stale on the flip, alongside the `validator.ts`
   comment.
5. `matchLagn.logic.test.ts` + a DB-gated case — the mappers + a finished, scored
   match emits both blocks (assert `Number.isInteger` on the three emitted score
   fields — the schema's `.int()` is load-bearing); an unscored match omits
   `result.score`; a match with no battle-plan row omits `battle_plan`.
6. `matchLagn.routes.test.ts` — the `logicSeam` mock literal grows the three new
   `MatchLagnLogic` members (`readBattlePlan` / `readReplayHashByMatchId` /
   `findCompetitiveScore`), defaulting to `null` so existing result-lagn cases still
   emit no `battle_plan` / `result.score`. (A mechanical companion of the seam change
   — the interface gaining required members won't compile against the old mock.)

### C) API catalog (D-11804 — §21 TRIGGERED, THREE rows)
7. `docs/ai/REFERENCE/api-endpoints.md` — whole-row replace (D-11804):
   - `GET /api/match/:matchId/result-lagn` (row ~263): response now `LAGN 1.5.0`
     + optional `battle_plan` + optional `result.score`; note the two new
     domain-table reads (`legendary.battle_plan`, `legendary.competitive_scores`
     via the `replay_hash` mapping) — **no new blob carve-out**.
   - `GET /api/match/:matchId/lagn` (row ~262): the stamped `lagn_version` moves
     `1.4.0 → 1.5.0` (it emits `LAGN_VERSION`); no other change.
   - `POST /api/me/loadouts` (row ~166): the "the server's own LAGN write value
     stays 1.4.0 (WP-640 is reader-only)" sentence is now stale — update it to
     "1.5.0 as of WP-641".

## Scope (Out)

- **No new LAGN schema.** WP-640 owns the 1.5.0 shape; this emits it.
- **No new bgio blob carve-out.** `battle_plan` + `competitive_scores` are
  domain-table reads; `replay_hash` is the blessed D-24187 artifacts surface. The
  existing composition (D-24153) + gameover (D-24169) blob reads are unchanged.
- **Non-authoritative.** Nothing scores/credits/ranks/verifies from the emitted
  blocks. No submission-flow change; `competitive_scores` is read, never written.
- **No client change** (the Hall of Legends view / download control already render
  whatever the producer emits; a richer render is a separate WP if wanted).
- **No `?lagn=` share-link change** — `battle_plan` rides the server-emitted
  result-LAGN only.

## Files Expected to Change

- `packages/lagn-spec/src/validator.ts` — **modified** — `LAGN_VERSION` → `LAGN_VERSION_1_5_0` + doc comment
- `packages/lagn-spec/package.json` — **modified** — version `1.4.0` → `1.5.0` (EC-422 lockstep, same commit)
- `packages/lagn-spec/src/validator.test.ts` — **modified** — re-pin the writer-version + migration-target assertions
- `apps/server/src/match/matchLagn.logic.ts` — **modified** — `buildResultMatchLagn` +2 params; `toResultScore` + `toBattlePlanBlock` mappers; `gradeForFinalScore` import
- `apps/server/src/match/matchLagn.routes.ts` — **modified** — read battle_plan + score in the result-lagn handler; extend the `MatchLagnLogic` seam
- `apps/server/src/match/matchLagn.logic.test.ts` — **modified** — mapper + emit tests (scored/unscored/no-plan; integer-invariant assertion) (+ DB-gated)
- `apps/server/src/match/matchLagn.routes.test.ts` — **modified** — the `logicSeam` mock grows the three new seam members (default `null`)
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — THREE rows replaced WHOLE (D-11804): result-lagn, `/lagn` setup, loadouts note

No other files may be modified beyond the governance close-out (DECISIONS.md — D-24453 Active; STATUS.md; WORK_INDEX.md; EC_INDEX.md; ROADMAP-MINDMAP.md).

## Contract

- `GET /api/match/:matchId/result-lagn` → a **LAGN 1.5.0** document. Optional
  `battle_plan?: { pre_battle?, battle_adjustments?, post_battle? }` from
  `legendary.battle_plan` (omitted when absent/empty). Optional `result.score?:
  { raw_score, par_score, final_score, grade, scoring_config_version, par_version }`
  from the match's `competitive_scores` row (omitted for an unscored match), with
  `grade = gradeForFinalScore(final_score)` computed at emit time.
- `result.score` rides **only** when `result` (with its required `outcome`) rides.
- The score is match-level (any one row); nothing is credited per-seat.
- Guest-readable (a finished match's result is public). §21 TRIGGERED (three rows).

## Acceptance Criteria

- **AC-1** — A finished, **scored** match's result-LAGN carries `result.score` with all six fields; `grade` equals `gradeForFinalScore(final_score)`; `par_score` = the row's `score_breakdown.parScore`; the three score fields are integers (`Number.isInteger` — the schema's `.int()` is load-bearing).
- **AC-2** — A finished **unscored/casual** match (no `competitive_scores` row) omits `result.score` entirely; the rest of the document is unchanged.
- **AC-3** — A match with a `battle_plan` row emits `battle_plan` with the non-null phases; a match with no row (or all phases empty) omits the block.
- **AC-4** — The emitted document `validate()`s (the existing single validate call) as a 1.5.0 document.
- **AC-5** — `LAGN_VERSION` is `1.5.0`; `package.json` version is `1.5.0` (same commit); the `/lagn` setup emitter now stamps 1.5.0.
- **AC-6** — `migrateToCurrent` now walks a 1.0.0 document to 1.5.0 (the chain is reachable); a 1.5.0 input is unchanged (`applied: []`). The re-pinned validator.test.ts is green.
- **AC-7** — No `competitive_scores` write; no submission-flow change; the only new reads are the two domain tables (+ the `replay_hash` mapping). Select-String: no blob read added beyond the existing composition/gameover.
- **AC-8** — `api-endpoints.md` three rows replaced WHOLE (D-11804): result-lagn (1.5.0 + two blocks), `/lagn` (1.5.0 stamp), loadouts (stale note fixed).

## Verification Steps

```pwsh
pnpm -r build                                            # exits 0
pnpm --filter @legendary-arena/lagn test                 # 0 fail (re-pinned writer/migration)
pnpm --filter @legendary-arena/server test               # 0 fail (mappers + emit)
node --test --test-concurrency=1 apps/server/src/match/matchLagn.logic.test.ts   # DB-gated emit
Select-String -Path apps/server/src/match/matchLagn.logic.ts -Pattern "gradeForFinalScore|readBattlePlan|competitive"  # present
git diff --name-only origin/main                         # matches §Files Expected to Change
```

## Empirical Scaffold (REQUIRED — RUN, not reasoned)

The writer flip moves a set of validator.test.ts assertions (writer-version +
migration-target) whose exact membership must be **measured, not reasoned** (the
WP-406 precedent: "the flip breaks N tests all in validator.test.ts"; WP-640 added
more 1.5.0 pins). Before READY, flip `LAGN_VERSION` on a throwaway branch, run
`pnpm --filter @legendary-arena/lagn test`, and record the exact failing set; fold
each into scope. A `READY` reached by reasoning the blast radius is invalid for
this class.

## Vision Alignment

`00.3 §17.1` **TRIGGERED** — the producer emits `result.score` (scores + a grade
band), a **scoring surface** (surface-touch, not authority).

- **Clauses touched:** `§20–26` (Scoring & Skill Measurement), `§3` (Trust &
  Fairness), `NG-1` (No Pay-to-Win).
- **Conflict assertion:** **No conflict — this WP preserves all touched clauses.**
- **Non-Goal proximity:** `NG-1..NG-7` not crossed. The emitted blocks are
  **descriptive, read-only, non-authoritative** — nothing scores/credits/ranks/verifies
  from them; competitive credit stays `matchId → bgio blob → re-reduce → re-verify
  → AccountId` (D-5301 / D-24126). No pay-gate, no balance change.
- **Determinism preservation (required — scoring surface):** the producer **reads**
  `competitive_scores` (never writes it), computes `grade` as a **frozen snapshot**
  via `gradeForFinalScore`, and re-executes nothing — no RNG, no clock branch, zero
  replay-verification impact. `finalStateHash` / the submission/credit pipeline are
  untouched.

## Lint Gate Self-Review (`00.3`, 21 sections)

- §1 PASS (sections; Out-of-Scope closed). §2 PASS (packet-specific; `00.6`). §3 PASS (deps incl. WP-640/406/635/583-591 ✅ + BLOCKED clause). §4 PASS (Context: consumer story, match-level-score + frozen-grade rationale). §5 PASS (8-file allowlist + governance close; incl. `matchLagn.routes.test.ts` — the forced companion of the seam change). §6 PASS (field sourcing locked verbatim; grade computed, par_score from jsonb, par_version from column — all verified in research). §7 PASS (no new dependency; `gradeForFinalScore` is an existing runtime-safe export). §8 PASS (`pnpm` block). §9 PASS (cross-package writer-flip + server producer; the WP-406 shape). §10 PASS (layer: server reads domain tables + the game-engine `.` surface; lagn-spec constant flip). §11 PASS (determinism — see Vision Alignment; reads only, no re-execution). §12 PASS (persistence — domain-table reads, NO new blob carve-out; `competitive_scores` read never written). §13 N/A. §14 PASS (field names → 00.2 / the LAGN schema). §15 PASS (full-sentence errors reused from WP-406). §16 PASS (server + lagn-spec tests; DB-gated serialized; **scaffold-first** for the flip). §17 **TRIGGERED — PASS** (§17.1 scoring surface — see `## Vision Alignment`). §18 PASS (D-24453 reserved; Active at execution). §19 PASS (deps shipped). §20 PASS (one WP; the closing packet of the arc). §21 **TRIGGERED — PASS** (D-11804: three rows replaced WHOLE — result-lagn + `/lagn` + loadouts note).

## Definition of Done

- [ ] AC-1..AC-8 demonstrated with observed output in the session log
- [ ] `pnpm -r build` 0; `pnpm --filter @legendary-arena/lagn test` + `@legendary-arena/server test` 0 fail (counts recorded); DB-gated emit test passes locally
- [ ] Empirical scaffold result recorded (the exact re-pinned validator.test.ts set)
- [ ] `package.json` version = `1.5.0` in the SAME commit as the `LAGN_VERSION` flip (EC-422)
- [ ] No `competitive_scores` write; no new blob read (Select-String); `git diff --name-only` = the allowlist + governance close
- [ ] **create D-24453 Active** in `DECISIONS.md`: writer flip, the two domain-table reads, frozen grade, descriptive/non-authoritative, no new carve-out, guest-readable
- [ ] `api-endpoints.md` three rows replaced WHOLE (D-11804)
- [ ] `docs/ai/STATUS.md` updated
- [ ] WORK_INDEX `[x]`; EC_INDEX `Done`; mindmap `📝 → ✅`; `roadmap:counts:check` exits 0
