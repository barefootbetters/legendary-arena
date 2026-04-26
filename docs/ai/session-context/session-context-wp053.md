# Session Context — WP-053 (Competitive Score Submission & Verification)

> **Authored:** 2026-04-25 as a step-0 bridge from WP-052 closure
> (`fd769f1` Commit A + `cf4e111` SPEC close + `a8f81ff` BRANCHES.md
> housekeeping) to the WP-053 execution session. **Purpose:** capture
> the post-WP-052 reconciled state, surface two pre-execution drift
> items that EC-053 does not yet account for, and document the one
> hard prerequisite blocker so the next executor does not start a
> session against a known-blocked EC.
>
> **Revised:** 2026-04-25 — post-WP-103 + post-WP-053a-A0-SPEC
> reconciliation. WP-103 (Server-Side Replay Storage & Loader)
> landed on `main` via fast-forward 2026-04-25 with three commits
> (`fe7db3e` Commit A `EC-111:` + `f74d180` Commit B `SPEC:` +
> `c8a2421` `SPEC:` retrospective pre-commit review). The §6
> "Hard Prerequisite Blocker — Resolved by WP-103" status flipped
> from prophetic to literally true. D-5306 was resolved 2026-04-25
> as Option A (PAR artifact carries full `ScenarioScoringConfig`);
> the WP-053a A0 SPEC bundle landed at `1734475` introducing a new
> hard prerequisite that supersedes the WP-103-only blocker. WP-053
> is now BLOCKED on WP-053a's execution rather than on WP-103. §1
> main-HEAD reference, §4 migration numbering, §6 prerequisite
> status, and §pre-flight Step 1 / Step 5 are all updated below.
> Substantive guidance unchanged — only the temporal framing and
> the new prerequisite chain.
>
> **Revised:** 2026-04-25 — post-WP-053a-execution reconciliation.
> WP-053a (PAR Artifact Carries Full `ScenarioScoringConfig`) executed
> 2026-04-25 with three commits on the `wp-053a-par-artifact-scoring-config`
> topic branch, fast-forwarded into `main`: `fbbedb5` (`INFRA:` —
> commit-msg hook now accepts lowercase letter suffix in EC-### prefix
> + lookup, unblocking `EC-053a:` commits), `e5b9d15` (Commit A
> `EC-053a:` — eleven files extending PAR artifact + index + gate
> end-to-end with `scoringConfig: ScenarioScoringConfig`; D-5306b
> inline materialization preserves D-5103 fs-free gate; engine
> baseline `513/115/0` → `522/116/0` and server `36/6/0` → `38/6/0`
> per the PS-5 lock), `d896690` (Commit B `SPEC:` governance close
> — STATUS / WORK_INDEX / EC_INDEX flips + 01.6 post-mortem covering
> all 14 mandatory audits + pre-commit review artifact). D-5306
> status flipped from "Active" to "Active — landed at `e5b9d15`".
> WP-053 is now **UNBLOCKED**: `submitCompetitiveScore` can source
> `scoringConfig` directly from `checkParPublished(scenarioKey).scoringConfig`,
> making the WP-053 flow step 12 (`computeParScore(config) === parValue`)
> defense-in-depth rather than a primary safety net. §1 main-HEAD
> reference and §6 prerequisite status are updated below.
> Substantive WP-053 guidance unchanged — only the prerequisite
> chain reflects WP-053a's actual landing.
>
> **Revised:** 2026-04-25 — post-WP-053-+-EC-053-surgical-revision
> reconciliation. WP-053 (Version 1.3 → **1.4**) and EC-053 were
> surgically revised in the working tree on 2026-04-25 to (a) fold
> all §5.1 drift items in-place, (b) correct three additional drift
> items not surfaced in the original §5 list, and (c) propagate the
> WP-053a / D-5306 Option A reframing from §Assumes into §Locked
> contract values, the §Flow numbered steps, the migration `// why:`
> comments, the §Acceptance Criteria, and the §Verification Steps.
> The header `Dependencies` line now lists WP-103 + WP-053a
> explicitly (was missing both). EC-053 received parallel updates
> across §Before Starting / §Locked Values / §Guardrails / §After
> Completing / §Common Failure Smells. **The revisions are
> uncommitted in the working tree as of this revision.** They are
> A0 SPEC scope per §9 step 4–5 and should land before any WP-053
> execution branch is cut. Full inventory of changes — and the two
> pre-existing lint gaps surfaced but **not** addressed in this
> revision pass — recorded in new §11 below. §5 is preserved
> verbatim as the historical drift record; §11 supersedes §5 for
> items now reconciled.
>
> **This file is not authoritative.** If conflict arises with
> `docs/ai/ARCHITECTURE.md`, `.claude/rules/*.md`, WP-053, or EC-053,
> those documents win. See §8 priority chain.
>
> **No execution is performed by reading this file.** WP-053 itself
> opens in a fresh Claude Code session per the One-Packet-Per-Session
> rule in `.claude/rules/work-packets.md`.

---

## 1. State on `main` (as of authoring + revisions)

`main` HEAD at session-context original authoring: **`a8f81ff`** (`INFRA: document retained topic branches in docs/ai/BRANCHES.md`).

Post-WP-103 + post-WP-053a-A0-SPEC `main` HEAD (intermediate): **`49ee0be`** (`SPEC: WP-053 + EC-053 — fold WP-103 + WP-053a as explicit prerequisites in §Assumes / §Before Starting`).

Post-WP-053a-execution `main` HEAD (current): **`d896690`** (`SPEC: WP-053a / EC-053a governance close — D-5306 marked landed; post-mortem; STATUS / WORK_INDEX / EC_INDEX flips`). Intermediate landed commits relevant to WP-053, in chronological order:

- WP-103 (Replay Storage & Loader) Commit A `EC-111:` at `fe7db3e` (2026-04-25)
- WP-103 Commit B `SPEC:` governance close at `f74d180` (2026-04-25)
- WP-103 retrospective pre-commit review `SPEC:` at `c8a2421` (2026-04-25)
- WP-053a A0 SPEC bundle at `1734475` (2026-04-25; introduces D-5306 / D-5306a-d and the WP-053a packet draft)
- WP-053a A0 amendment `SPEC: eafe0ee` (2026-04-25; PS-1..PS-5 corrections per pre-flight)
- WP-053 / EC-053 prerequisite folds `SPEC:` at `49ee0be` (2026-04-25)
- WP-053a `INFRA:` hook fix at `fbbedb5` (2026-04-25; commit-msg accepts lowercase EC-### letter suffix)
- WP-053a Commit A `EC-053a:` at `e5b9d15` (2026-04-25; eleven-file contract extension end-to-end across the PAR pipeline)
- WP-053a Commit B `SPEC:` governance close at `d896690` (2026-04-25; this is the new main HEAD)

Recent landed history relevant to WP-053:

- **WP-052** — Player Identity, Replay Ownership & Access Control —
  Done 2026-04-25. Three commits: `17604ca` (A0 SPEC pre-flight
  resolution bundle — D-5201/5202/5203), `fd769f1` (Commit A `EC-052:`
  — eight files: `apps/server/src/identity/{identity,replayOwnership}.{types,logic,logic.test}.ts`
  + `data/migrations/00{4,5}_*.sql`), `cf4e111` (Commit B `SPEC:`
  governance close — STATUS + WORK_INDEX flip + EC_INDEX row + 01.6
  post-mortem). Server baseline `19/3/0` → `31/5/0` (with 6 skipped
  when `TEST_DATABASE_URL` is unset). Engine baseline `513/115/0`
  unchanged. **Critical naming change: the server-side type is
  `AccountId`, not `PlayerId`.** The engine retains `PlayerId` as a
  plain `string` seat alias (D-8701, `packages/game-engine/src/types.ts:352`);
  the server-side branded identity is `AccountId` (D-5201). They are
  distinct types in distinct layers and must never be imported across
  the boundary. **EC-053 was authored before D-5201 landed and still
  references `PlayerId` for the WP-052 contract** — see §5 below.
- **WP-051** — PAR Publication & Server Gate Contract — Done
  2026-04-23 at `ce3bffb`. `apps/server/src/par/parGate.{mjs,test.ts}`
  exports `checkParPublished(simulationIndex, seedIndex, scenarioKey)`
  + `createParGate(basePath, parVersion)`. Returns fresh literal
  `{parValue, parVersion, source}` on hit; `null` on absent /
  fail-closed. WP-051's contract surface is what EC-053's
  `Before Starting` checklist line 4 expects.
- **WP-048** — PAR Scenario Scoring & Leaderboards — Done 2026-04-17
  at `c5f7ca4`. `deriveScoringInputs`, `computeRawScore`,
  `computeFinalScore`, `buildScoreBreakdown`, `ScenarioScoringConfig`
  exported from `@legendary-arena/game-engine`. EC-053 §Locked Values
  cites these signatures verbatim.
- **WP-027** — Determinism & Replay Verification Harness — Done
  2026-04-14. `ReplayInput`, `replayGame`, `computeStateHash` exported.
- **WP-004** — Server Bootstrap — Done 2026-04-09. `apps/server/src/index.mjs`
  exists.

### Working tree at authoring time

The repo working tree carries unrelated WP-097 / WP-098 governance
work-in-progress that has **not** been committed and is **not** part
of WP-053's scope:

- Modified (uncommitted):
  `docs/ai/work-packets/WORK_INDEX.md` (WP-097 + WP-098 row drafts),
  `docs/ai/execution-checklists/EC_INDEX.md` (EC-097 + EC-098 row
  drafts), `docs/ai/DESIGN-RANKING.md`.
- Untracked: `docs/TOURNAMENT-FUNDING.md`,
  `docs/ai/work-packets/WP-09{7,8}-*.md`,
  `docs/ai/execution-checklists/EC-09{7,8}-*.checklist.md`.

These are an unrelated parallel workstream (tournament-funding
governance + funding-surface gate trigger). The WP-053 executor must
**stash or otherwise hold these aside** before cutting the WP-053
execution branch, exactly as the WP-052 session did. See the WP-052
session prompt's pre-session gates §8 for the `git stash push --
<filename>` pattern that worked cleanly.

---

## 2. Dependencies (all seven are complete)

| Dep | Status | Surface used by WP-053 |
|---|---|---|
| WP-004 | Done 2026-04-09 | `apps/server/src/index.mjs` startup wiring exists; WP-053 does not modify it |
| WP-027 | Done 2026-04-14 | `replayGame`, `ReplayInput`, `computeStateHash` |
| WP-048 | Done 2026-04-17 (`c5f7ca4`) | `deriveScoringInputs`, `computeRawScore`, `computeFinalScore`, `buildScoreBreakdown`, `ScenarioScoringConfig` |
| WP-051 | Done 2026-04-23 (`ce3bffb`) | `checkParPublished` (returns fresh literal — see WP-053a row for the post-extension shape) |
| WP-052 | Done 2026-04-25 (`fd769f1`) | `AccountId` (NOT `PlayerId`), `PlayerIdentity` discriminated union, `isGuest` type guard, `findReplayOwnership`, `ReplayOwnershipRecord` |
| WP-103 | Done 2026-04-25 (`fe7db3e`) | `loadReplay(replayHash, db): Promise<ReplayInput \| null>` — server-layer hash-indexed read against `legendary.replay_blobs`; satisfies EC-053 §Before Starting line 21 prerequisite |
| WP-053a | Done 2026-04-25 (`e5b9d15`) | Extended `ParGateHit` return shape `{ parValue, parVersion, source, scoringConfig }` from `checkParPublished` — `scoringConfig` is the authoritative `ScenarioScoringConfig` for `submitCompetitiveScore`; D-5306 Option A is in production effect |

All seven dependencies are reachable on `main` at HEAD `5b8fa9e`. The
runtime contract surface that WP-053 plans to consume exists.

---

## 3. Test & Build Baseline (LOCKED)

Originally captured against `main` at `a8f81ff` (pre-WP-103). **Updated 2026-04-25** for the post-WP-103 + post-WP-053a-A0-SPEC state:

| Surface | At a8f81ff (original) | At c8a2421 (post-WP-103) | At 5b8fa9e (post-WP-053a, actual) | Notes |
|---|---|---|---|---|
| `pnpm -r build` | exits 0 | exits 0 | exits 0 | All packages |
| `pnpm --filter @legendary-arena/game-engine test` | `513 / 115 / 0` | `513 / 115 / 0` (unchanged) | `522 / 116 / 0` (+9 tests / +1 suite from WP-053a — PS-5 lock honored exactly) | WP-053a added 4 `scoringConfigLoader` tests + 3 `par.storage` extensions + 2 `par.aggregator.test.ts` extensions; the par.* extensions landed inside existing describes (no suite delta); the new `scoringConfigLoader.test.ts` wraps its 4 tests in a fresh top-level `describe('scoringConfigLoader (WP-053a)', …)` block (+1 suite). |
| `pnpm --filter @legendary-arena/server test` | `31 / 5 / 0` (6 skipped when no test DB) | `36 / 6 / 0` (10 skipped when no test DB) | `38 / 6 / 0` (10 skipped — WP-053a added 2 `parGate.test.ts` tests in the existing suite) | Pre-WP-053 baseline shifted twice |

WP-053's pre-flight session (run before D-5306 was resolved) locked
WP-053's own delta as **+9 tests / +1 suite** (`describe('competition
logic (WP-053)', ...)`), giving a post-WP-053 server total of
`45 / 7 / 0` *if Option B had been chosen*. **Under Option A
(D-5306 resolved 2026-04-25), the +9/+1 figure may need
re-derivation**: WP-053's flow step 12 (`computeParScore(config) ===
parValue`) becomes defense-in-depth rather than a primary safety
net, so some of the locked tests (notably any that exercised the
config / PAR drift-catch path) may collapse or change shape. The
WP-053 pre-flight session must re-walk the locked test plan against
the post-WP-053a state before committing to a final baseline target.

Projected post-WP-053 server total under Option A (best estimate
pending pre-flight re-walk): `47 / 7 / 0` (+9 tests / +1 suite from
the post-WP-053a baseline of `38 / 6 / 0`). This is the same +9/+1
delta the pre-flight locked, applied to the new starting line. If
the pre-flight re-walk reduces the count (likely — drift-catch
tests may collapse), the post-WP-053 total drops correspondingly.

---

## 4. Migration Numbering — Updated 2026-04-25 (WP-103 took 006; landed at fe7db3e)

EC-053's `Files to Produce` line refers to the new migration as
`data/migrations/NNN_create_competitive_scores_table.sql`. With
WP-103 (Server-Side Replay Storage & Loader) landed as the
predecessor on 2026-04-25 (see §6), WP-103 took migration **`006`**
for `legendary.replay_blobs`, and WP-053's `competitive_scores`
migration shifts to **`007`**.

Migration sequence post-WP-103 (current state on `main`) +
projected after WP-053 lands:

```
data/migrations/
  001_server_schema.sql                         (existing)
  002_seed_rules.sql                            (existing)
  003_game_sessions.sql                         (existing)
  004_create_players_table.sql                  (WP-052, landed)
  005_create_replay_ownership_table.sql         (WP-052, landed)
  006_create_replay_blobs_table.sql             (WP-103, landed 2026-04-25 at fe7db3e)
  007_create_competitive_scores_table.sql       (WP-053, planned — was 006 before WP-103 took 006)
```

WP-053a (PAR Artifact Carries Full ScenarioScoringConfig — the
new D-5306 / Option A predecessor between WP-103 and WP-053) does
**not** land a new migration. Its scope is engine + server PAR
contract extension only (see §6 and the WP-053a packet body).
Migration `007` is therefore still WP-053's even after WP-053a
lands.

The WP-053 executor must update EC-053 §Files to Produce at A0
SPEC time to reflect `007` (not `NNN` and not `006`).

---

## 5. Pre-Execution Drift Items (must be reconciled before WP-053 starts)

EC-053 was authored before WP-052's pre-flight resolution bundle
(D-5201) landed. Two drift items in EC-053 need to be reconciled —
either by an A0 SPEC commit that updates EC-053 in place, or by
explicit clauses in the WP-053 session prompt that override the
stale EC text. Per the One-Packet-Per-Session rule, an A0 commit is
the cleaner path because it keeps EC-053 self-consistent with main.

### 5.1 EC-053 references `PlayerId` for the WP-052 contract — must read `AccountId`

Locations in `docs/ai/execution-checklists/EC-053-competitive-score-submission.checklist.md`:

- **Line 19** (Before Starting): `WP-052 complete: `PlayerId`,
  `PlayerIdentity` (discriminated union), `isGuest` type guard, …`
  → **Update to `AccountId`** per D-5201. The engine `PlayerId`
  (`packages/game-engine/src/types.ts:352`, plain `string` per
  D-8701) is a different type in a different layer and is NOT what
  EC-053 means here.
- **Line 64** (Guardrails): `… only `PlayerId` (after guest
  rejection) is stored on the record` → **Update to `AccountId`**.
  This is the field that lands on `legendary.competitive_scores.player_id`'s
  application-side handle (the table column is `player_id` bigint
  FK, but the application maps it from / to `AccountId` via
  `legendary.players.ext_id` — same pattern WP-052 uses for
  `legendary.replay_ownership`).
- **Line 36** (Locked Values): `submitCompetitiveScore` signature
  `(identity: PlayerIdentity, replayHash: string, database)` —
  **No change needed**. `PlayerIdentity` is the discriminated union
  exported from `apps/server/src/identity/identity.types.ts`; that
  name is unchanged.
- **Line 123** (Common Failure Smells): `submitCompetitiveScore
  accepts `PlayerId` instead of `PlayerIdentity` →` — **Ambiguous
  post-WP-052**. The smell is "accepts a non-union type when it
  should accept the union". Update to `AccountId` (the server-side
  branded identity); engine `PlayerId` would never be a candidate
  here because it never enters `apps/server/src/competition/`.

### 5.2 WP-053 record schema — `player_id` column FK target

EC-053 calls for `UNIQUE (player_id, replay_hash)` on
`legendary.competitive_scores`. WP-052 established the precedent
that `legendary.replay_ownership.player_id` is a **bigint FK** to
`legendary.players(player_id)`, and the application layer never
exposes the bigint. WP-053 should follow the same pattern:

- Application layer accepts `AccountId` (`ext_id`) as input.
- Inside the `submitCompetitiveScore` SQL, resolve `ext_id →
  player_id` via a CTE (same shape as
  `apps/server/src/identity/replayOwnership.logic.ts:assignReplayOwnership`).
- The `competitive_scores.player_id` column is a `bigint NOT NULL
  REFERENCES legendary.players(player_id)`.
- Read paths join back to `legendary.players` to surface
  `ext_id → AccountId` on returned `CompetitiveScoreRecord`.

This is not a drift item per se — EC-053 §Locked Values already says
`legendary.*` namespace + `bigserial` PKs — but it does mean the
WP-053 author should **read WP-052's `replayOwnership.logic.ts` as
the precedent template** rather than re-deriving the `ext_id ↔
player_id` mapping pattern.

---

## 6. Hard Prerequisite Blockers — WP-103 Resolved (landed 2026-04-25); WP-053a Resolved (landed 2026-04-25)

EC-053 §Before Starting line 21 (original verbatim text):

> Server has an existing replay loader by `replayHash`; storage
> implementation is out of scope for WP-053. If no loader exists,
> WP-053 is **BLOCKED** and must not proceed. A test-only mock
> satisfies test fixtures, not the prerequisite — the application
> must have a real loader at runtime; mocks may not be the way this
> gate is satisfied.

### 6.1 Original Blocker — RESOLVED 2026-04-25 by WP-103

**Status (2026-04-25): RESOLVED.** WP-103 — Server-Side Replay
Storage & Loader — landed on `main` via fast-forward 2026-04-25 as
three commits:

- `fe7db3e` Commit A `EC-111:` — `apps/server/src/replay/{replay.types,replay.logic,replay.logic.test}.ts` + `data/migrations/006_create_replay_blobs_table.sql`
- `f74d180` Commit B `SPEC:` — governance close (DECISIONS D-10302 + D-10303 + STATUS + WORK_INDEX flip + EC_INDEX flip + 01.6 post-mortem)
- `c8a2421` `SPEC:` — retrospective pre-commit review artifact at `docs/ai/reviews/pre-commit-review-wp103-ec111.md`

EC-053 §Before Starting was updated by `49ee0be` (`SPEC: WP-053 +
EC-053 — fold WP-103 + WP-053a as explicit prerequisites`) to cite
WP-103's `loadReplay` directly. The original §Before Starting line 21
is preserved in spirit — a test-only mock still does not satisfy the
prerequisite; the application must use the real `loadReplay` at
runtime.

### 6.2 New Blocker — WP-053a (D-5306 Option A) — RESOLVED 2026-04-25

**Status (2026-04-25): RESOLVED.** WP-053a executed 2026-04-25 with
three commits on the `wp-053a-par-artifact-scoring-config` topic
branch, fast-forwarded into `main`:

- `fbbedb5` `INFRA:` — commit-msg hook accepts lowercase EC-### letter
  suffix (`[A-Za-z]?` + `find -iname`), unblocking `EC-053a:` commits
- `e5b9d15` Commit A `EC-053a:` — eleven-file end-to-end PAR contract
  extension across `data/scoring-configs/` (README + canonical example
  JSON), `packages/game-engine/src/scoring/scoringConfigLoader.{ts,test.ts}`,
  `packages/game-engine/src/simulation/par.{storage,storage.test,aggregator.test}.ts`,
  `packages/game-engine/src/index.ts`, and
  `apps/server/src/par/parGate.{mjs,test.ts}`. Vision trailer
  `Vision: §3, §22, §24` per WP-053a §Vision Alignment.
- `d896690` Commit B `SPEC:` — governance close (DECISIONS D-5306
  status flip + STATUS + WORK_INDEX flip + EC_INDEX flip + 01.6
  post-mortem covering all 14 mandatory audits + pre-commit review
  artifact at `docs/ai/reviews/pre-commit-review-wp053a-ec053a.md`)

D-5306 was resolved 2026-04-25 as Option A: `ScenarioScoringConfig` is
bundled into the PAR publication and flows to the server through
`checkParPublished`'s extended return shape
`{ parValue, parVersion, source, scoringConfig }`, making config / PAR
drift structurally impossible. The contract is **in production effect
on `main` as of `e5b9d15`**.

WP-053a (PAR Artifact Carries Full ScenarioScoringConfig) is the
predecessor packet that delivers Option A across the PAR pipeline
(artifact shape extension + index inline materialization + server
gate return-shape extension + on-disk authoring origin at
`data/scoring-configs/` + engine loader). Its A0 SPEC bundle landed
on `main` at `1734475` on 2026-04-25, introducing:

- The WP-053a packet draft at `docs/ai/work-packets/WP-053a-par-artifact-scoring-config.md`
- DECISIONS entries D-5306 + D-5306a (configs live in `data/scoring-configs/`) + D-5306b (inline materialization for fs-free gate) + D-5306c (`SeedParArtifact.parBaseline` retained one cycle) + D-5306d (`competitive_scores` retains both `par_version` and `scoring_config_version` columns as audit redundancy)
- WP-053a row in `WORK_INDEX.md` (Phase Server, before WP-053)
- EC-053a placeholder row in `EC_INDEX.md` (Draft status)

WP-053 is now formally **UNBLOCKED**: WP-053a shipped at `e5b9d15`
on 2026-04-25, EC-053 §Before Starting line for WP-053a is satisfied
by the `scoringConfig` field returned by `checkParPublished`, which
is the authoritative source of `ScenarioScoringConfig` for WP-053's
`submitCompetitiveScore` flow. Both prerequisites (WP-103's
`loadReplay` and WP-053a's extended `ParGateHit`) are landed.

**Implication for the locked WP-053 9-step flow:** under Option A
(now landed), WP-053's flow step 12 (`computeParScore(config) === parValue`)
becomes defense-in-depth rather than a primary safety net — drift
between `scoringConfig` and `parValue` is structurally impossible
because both flow from the same PAR artifact. The WP-053 pre-flight
session locked the 9-step flow before D-5306 resolved; under Option
A, the flow needs re-walking. Some locked tests (notably any
exercising the config / PAR drift-catch path) may collapse or
change shape. See §3's projected post-WP-053 baseline note.

**WP-053a surface as landed (10 files in Commit A `e5b9d15`):**

- `data/scoring-configs/README.md` + canonical example JSON file —
  the D-5306a authoring origin
- `packages/game-engine/src/scoring/scoringConfigLoader.ts` (new) +
  `scoringConfigLoader.test.ts` (new, 4 tests in fresh
  `describe('scoringConfigLoader (WP-053a)', …)` block — drives the
  +1 suite delta in the engine baseline)
- `packages/game-engine/src/simulation/par.storage.ts` — extended
  shapes (`SeedParArtifact.scoringConfig`, `SimulationParArtifact.scoringConfig`,
  `ParIndex.scenarios[key].scoringConfig` per D-5306b inline
  materialization), extended `validateParStore` with three new
  errorTypes (`'scoring_config_invalid'`,
  `'scoring_config_version_mismatch'`,
  `'par_baseline_redundancy_drift'` — D-5306c one-cycle audit),
  extended `writeSimulationParArtifact` with `scoringConfig` as 3rd
  positional parameter (PS-3 mirroring `writeSeedParArtifact`'s
  precedent), extended `buildParIndex` to materialize `scoringConfig`
  from each artifact into the index entry
- `packages/game-engine/src/simulation/par.storage.test.ts` — +3
  validator tests + mechanical fixture updates (centralized factory
  weights updated so embedded configs satisfy
  `validateScoringConfig`'s structural invariants now that the
  validator runs against them)
- `packages/game-engine/src/simulation/par.aggregator.test.ts` — +2
  integration tests (writer embeds verbatim; writer throws on version
  mismatch). par.aggregator.ts itself UNCHANGED per PS-3 — the
  field already existed at `par.aggregator.ts:136`.
- `packages/game-engine/src/index.ts` — exports
  `loadScoringConfigForScenario` + `loadAllScoringConfigs`
- `apps/server/src/par/parGate.mjs` — extended `ParGateHit` JSDoc
  typedef + `checkParPublished` returns `scoringConfig` from index
  entry + `createParGate` hard-throws on missing-config index entry
  (defense-in-depth behind the engine's `isParIndexShape` shape
  validator, which catches first in practice). D-5103 fs-free
  invariant preserved.
- `apps/server/src/par/parGate.test.ts` — +2 tests + mechanical
  fixture updates including a new `createTestScoringConfig` factory.

**WP-103 surface as landed (4 files, mirrors WP-052's clean shape):**

- `apps/server/src/replay/replay.types.ts` — re-exports
  `ReplayInput` from `@legendary-arena/game-engine` (type-only) and
  `DatabaseClient` from `../identity/identity.types.js`
- `apps/server/src/replay/replay.logic.ts` —
  `storeReplay(replayHash, replayInput, db): Promise<void>` (locked
  SQL `INSERT … ON CONFLICT (replay_hash) DO NOTHING`) +
  `loadReplay(replayHash, db): Promise<ReplayInput | null>` (deserialized
  by `pg`'s `jsonb` codec; no manual JSON deserialization)
- `apps/server/src/replay/replay.logic.test.ts` — 5 tests in one
  describe block (1 pure + 4 DB-dependent)
- `data/migrations/006_create_replay_blobs_table.sql` —
  `legendary.replay_blobs (replay_hash text PRIMARY KEY,
  replay_input jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`

**Migration sequence as a result:** WP-103 took migration `006`.
WP-053's `competitive_scores` migration shifts to `007` (was
documented as `006` in this file's §4 before WP-103 took 006).
See §4 above for the updated migration sequence.

**Decision rationale (paths not taken):**

- **Option 2 (re-scope WP-053):** rejected — would blur WP-053's
  "submission + verification" surface with "blob storage", expand
  the file allowlist, and force the post-mortem to defend storage
  backend + writer + reader + verification + idempotency in one
  audit pass. The WP-052 post-mortem's clean shape (12 distinct
  audits over a focused 8-file Commit A) is the precedent we want
  to preserve, not violate.
- **Option 3 (re-interpret as a thin reader of producer output):**
  rejected after `apps/replay-producer/` investigation — the
  producer is a CLI that writes a `ReplaySnapshotSequence` to a
  user-supplied `--out` path, **not** keyed by `replayHash`, and
  it produces a *sequence*, not the `ReplayInput` shape that
  EC-053 needs. Reusing the producer would require either a key
  scheme retrofit (non-trivial) or a hash-to-path lookup table
  (a smaller WP than WP-103 in name only). Option 1's predecessor
  WP is cleaner.

**Both prerequisites are now on `main`:** WP-103 (replay loader,
landed at `fe7db3e`) and WP-053a (extended `ParGateHit` with
`scoringConfig` per D-5306 / Option A, landed at `e5b9d15`). WP-053
sessions may now start.

---

## 7. Workflow Position (per `01.4 §Work Packet Execution Workflow`)

| Step | Gate | Status |
|---|---|---|
| 0 | Session context | **This file (DONE).** |
| 1 | Pre-flight (`01.4`) | **Pending** — must address §6 blocker first; until §6 resolves, the pre-flight cannot honestly verify EC-053 §Before Starting line 21. |
| 1b | Copilot check (`01.7`) | Pending — runs after §6 + pre-flight clear. |
| 2 | Session prompt | Pending — author after pre-flight + copilot reach READY-TO-EXECUTE / CONFIRM. |
| 3 | Execution | Pending — fresh Claude Code session against the session prompt. |
| 4 | Post-mortem | **MANDATORY per 01.6** for WP-053: new long-lived abstractions (`CompetitiveScoreRecord`, `SubmissionResult`, `SUBMISSION_REJECTION_REASONS`); new contract consumed by WP-054; new canonical readonly array; new persistence surface (`legendary.competitive_scores`). Same trigger profile as WP-052. |
| 5 | Pre-commit review | Pending — separate session as needed. |
| 6 | Commit (A code, B governance) | Pending. |
| 7 | Lessons learned | Pending. |
| 8 | Session context for next WP | **WP-054** is the natural successor — Public Leaderboards & Read-Only Web Access. Authoring a `session-context-wp054.md` after WP-053 close is the recommended bridging convention. |

---

## 8. Authority Chain

In conflict, higher-authority documents win:

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md`
3. `docs/01-VISION.md`
4. `.claude/rules/*.md` (architecture, code-style, work-packets,
   server, persistence, registry, game-engine)
5. `docs/ai/work-packets/WORK_INDEX.md`
6. `docs/ai/work-packets/WP-053-competitive-score-submission-verification.md`
7. `docs/ai/execution-checklists/EC-053-competitive-score-submission.checklist.md`
   *(but read §5 of this file first — EC-053 has known drift against
   D-5201 / WP-052)*
8. This session-context file
9. Active conversation context (lowest)

---

## 9. Suggested First Actions for the WP-053 Executor

In strict order:

1. **Confirm WP-103 is on `main` (verified 2026-04-25 at `c8a2421`).**
   Run `git log --oneline -- data/migrations/006_create_replay_blobs_table.sql`;
   expect at least three commits including `fe7db3e`. If empty or
   missing the WP-103 commits, STOP — the environment has drifted
   from the post-WP-103 baseline established by `c8a2421`.
1b. **Confirm WP-053a has landed on `main`.** Run
   `grep -n "scoringConfig" apps/server/src/par/parGate.mjs`;
   expect at least three matches (typedef, return shape, gate
   construction guard). If zero matches, STOP — WP-053a must
   execute first; WP-053 cannot start until then. Also run
   `git log --oneline -- packages/game-engine/src/scoring/scoringConfigLoader.ts`
   and expect at least one commit. If empty, WP-053a has not landed
   yet.
2. Run `pnpm -r build && pnpm -r test` against the current `main`
   to confirm the post-WP-053a baseline (engine **`522/116/0`** per
   the PS-5 lock — fresh top-level `describe('scoringConfigLoader
   (WP-053a)', …)` block; server `38/6/0` with 10 skipped if no
   test DB — see §3 for the full table). If it doesn't match, STOP — the
   environment has drifted since WP-053a closure or the test plan
   needs re-derivation.
3. Read this file's §3 (re-derive test count under Option A if
   needed), §5 (drift items), and §6 (resolved + pending
   blockers). The drift fixes in §5 (`PlayerId → AccountId`) and
   the migration-number update from §4 (`006 → 007` for
   `competitive_scores`) must both land in the WP-053 A0 SPEC
   commit. The §3 test plan re-walk under Option A may shift
   WP-053's locked +9/+1 figure — that is also A0 SPEC scope.
4. Draft A0 SPEC updates for EC-053:
   - Fix `PlayerId → AccountId` references at lines 19, 64, 123 per §5.1.
   - WP-103 + WP-053a §Before Starting prerequisites already added by
     `49ee0be` (separate SPEC commit on 2026-04-25); verify they
     are still present and accurate.
   - Update EC-053 §Files to Produce to `007_create_competitive_scores_table.sql`.
   - Confirm the `loadReplay` import boundary: WP-053's
     `competition.logic.ts` imports `loadReplay` from
     `../replay/replay.logic.js` (intra-server-layer dependency,
     allowed; mirrors WP-052 cross-directory pattern).
   - Confirm the `checkParPublished` import boundary: WP-053's
     `competition.logic.ts` consumes `scoringConfig` from
     `checkParPublished(scenarioKey).scoringConfig`; no separate
     config catalog import is permitted (per D-5306 Option A,
     server is enforcer, never derives — extends to *which config
     applies*).
   - Re-walk WP-053 §B's 9-step submission flow under Option A:
     flow step 12 (`computeParScore(config) === parValue`) becomes
     defense-in-depth; some locked tests may collapse.
5. Land A0 SPEC on `main` per the WP-052 commit topology pattern.
6. Cut the WP-053 execution branch from `main` after A0 lands.
7. Stash unrelated WP-097 / WP-098 / WP-101 governance
   work-in-progress in the working tree (per §1) before staging
   anything for Commit A. The WP-103 session's Pre-Session Gate 8
   is the canonical precedent for this stash discipline.
8. Mirror the WP-052 implementation patterns where applicable:
   `ext_id ↔ player_id` CTE inside SQL; `Result<T>` discriminated
   union for fallible operations; `// why:` comments at every
   non-obvious decision; `.test.ts` extension; locked
   `{ skip: 'requires test database' }` reason for DB-dependent
   tests; tests wrapped in exactly one `describe()` block.
9. Cite `docs/ai/prompts/PRE-COMMIT-REVIEW.template.md` in the
   WP-053 session prompt's Authority Chain and add a Pre-Session
   Gate or §Authorized Next Step that runs the template between
   "all gates green" and "stage Commit A". This closes the
   structural gap that caused WP-103's retrospective review at
   `c8a2421`. See `docs/ai/post-mortems/01.6-WP-103-replay-storage-loader.md`
   §3 for the carry-forward rationale.
10. Pre-screen Hard Stop greps for likely `// why:` comment
    substring collisions (WP-103 carry-forward §3.1) — if any Hard
    Stop would match comment text containing forbidden literal
    substrings, either reword the gate to anchor to actual code
    structure or explicitly note that comments must avoid the
    literal substring.

The WP-052 post-mortem at
`docs/ai/post-mortems/01.6-WP-052-player-identity-replay-ownership.md`
documents the skip-pattern grep-gate reconciliation (§3.1) — the
WP-053 executor will encounter the same gate and should adopt the
same inline conditional options form
(`hasTestDatabase ? {} : { skip: 'requires test database' }`)
without rediscovering the asymmetry.

---

## 10. Lessons Carried Forward From WP-053a Execution (2026-04-25)

These observations surfaced during WP-053a execution and apply
directly to WP-053. The full WP-053a post-mortem is at
`docs/ai/post-mortems/01.6-WP-053a-par-artifact-scoring-config.md`;
this section extracts the items WP-053's executor most needs.

### 10.1 Pre-screen every `ScenarioScoringConfig` test fixture against `validateScoringConfig`

**Lesson:** the pre-existing `createTestScoringConfig` factory in
`packages/game-engine/src/simulation/par.storage.test.ts` had
`bystanderReward: 50, villainEscaped: 300` — violating WP-048's
structural invariant `bystanderReward > villainEscaped`. Pre-WP-053a
this was harmless because `validateScoringConfig` was never run
against embedded artifact configs; WP-053a's new `validateParStore`
extension ran the validator on every embedded config and surfaced
the under-spec as **three test failures mid-execution**. The fix
was a one-line factory weight bump (`bystanderReward: 50 → 400`).

**Implication for WP-053:** `submitCompetitiveScore` will likely be
tested against fixture `ScenarioScoringConfig` instances (one per
scenario under test). Two reuse paths are available, both already
validator-clean on `main` post-WP-053a:

- `packages/game-engine/src/simulation/par.storage.test.ts`'s
  `createTestScoringConfig(scenarioKey, parBaseline)` factory —
  the corrected WP-053a version with `bystanderReward: 400`.
- `packages/game-engine/src/simulation/par.aggregator.test.ts`'s
  `createTestScoringConfig()` factory at line 71 — also valid
  (uses `bystanderReward: 200, villainEscaped: 100`).
- `data/scoring-configs/test-scheme-par--test-mastermind-par--test-villain-group-par.json`
  — the canonical authoring-origin example file from WP-053a.

If WP-053 authors a new factory, **call `validateScoringConfig` on
the output as part of the test setup** to catch under-spec early.
The structural invariants are: `bystanderReward > villainEscaped`,
`bystanderLost > villainEscaped`, `bystanderLost > bystanderReward`,
plus all four `parBaseline` fields ≥ 0 and `scoringConfigVersion > 0`
and every `PenaltyEventType` key present with positive weight.

### 10.2 Layered defense pattern for fail-closed contracts

**Lesson:** WP-053a added a `assertEveryScenarioHasScoringConfig`
guard inside `createParGate` that hard-throws when any index entry
lacks `scoringConfig`. In practice this guard is **structurally
redundant** with the engine's `isParIndexShape` validator, which
catches the same condition first via `loadParIndex`'s shape check.
The shape validator surfaces the failure as graceful per-class
degradation (`handleParLoadError` warn-logs and degrades to
zero-coverage); the gate-side guard then sees `null` and skips. The
layered defense is preserved as belt-and-suspenders for any future
code path that constructs a `ParIndex` programmatically and bypasses
the shape validator.

**Implication for WP-053:** if `submitCompetitiveScore` adds any
fail-closed guards (e.g., "submission rejected if `scoringConfig`
is missing"), be aware that `checkParPublished` already returns
`null` for any scenario whose class degraded due to malformed
input. The submission code can rely on `checkParPublished(scenarioKey)
=== null` as the terminal check; a separate "config missing on hit"
guard inside `submitCompetitiveScore` would be triple-redundant.
The WP-053a precedent is to keep the guard anyway as
defense-in-depth — small cost, no behavior change in normal
operation.

### 10.3 INFRA hook fix for lowercase EC-### letter suffixes (now active on `main`)

**Lesson:** the commit-msg hook regex was originally uppercase-only
(`[A-Z]?`) and the EC file lookup used case-sensitive `find -name`.
WP-053a's `EC-053a:` (lowercase `a`) commit prefix was rejected at
both rules. The fix landed as `INFRA:` commit `fbbedb5` updating
the regex to `[A-Za-z]?` and switching to `find -iname`.

**Implication for WP-053:** EC-053 has no letter suffix so this
doesn't directly matter. But if WP-053 ever spawns a sub-numbered
follow-up (EC-053b, EC-053A, etc.), both casings now work
identically. No further hook work needed.

### 10.4 Mechanical-fixture-update calibration

**Lesson:** WP-053a's contract extension touched two existing test
files (`par.storage.test.ts` and `parGate.test.ts`); the mechanical
fixture-update diff was **41 added lines mentioning `scoringConfig`**
across the two files, including the +5 net-new tests. Centralized
factories (`createTestScoringConfig`, `buildSimScoringConfig`,
`createEntry`) absorbed most of the repetition; without them the
per-call-site fixture updates would have been ~3-4× larger.

**Implication for WP-053:** if WP-053 extends any existing test
file (`parGate.test.ts` for new submission paths,
`replay.logic.test.ts` for new join-with-replay queries, etc.),
expect ~10-30 fixture-update lines per affected test file even for
small contract extensions. Pre-budget that into the WP-053
pre-flight session's expected-blast-radius estimate.

---

## 11. Post-2026-04-25 WP-053 + EC-053 Surgical Revision Pass

This section supersedes §5 for items now reconciled and documents
three additional drift items that the original §5 did not surface.
Authored 2026-04-25 in the working tree; uncommitted at write time.

### 11.1 Inventory of changes landed in the working tree

WP-053 (`docs/ai/work-packets/WP-053-competitive-score-submission-verification.md`)
revised from **Version 1.3 → 1.4**:

| Locus | Change |
|---|---|
| Header `Dependencies` line | Added `WP-103, WP-053a`. Was previously inconsistent with §Assumes (which already listed both). |
| §Assumes — WP-048 `deriveScoringInputs` | Signature corrected to `(replayResult, gameState: LegendaryGameState)` per **D-4801**. The pre-revision text claimed a `gameLog: GameMessage[]` second parameter — no such parameter exists in the engine codebase. See §11.3 below. |
| §Assumes — WP-051 PAR gate | Marked baseline `{ parValue, version }` as superseded for WP-053 by the WP-053a-extended shape. |
| §Assumes — WP-052 | `PlayerId` → `AccountId` per **D-5201**. `ReplayOwnershipRecord` shape made explicit (owner field is `accountId: AccountId`, not `playerId`). |
| §Assumes — WP-053a | Marked as the **effective contract** for WP-053; the four fields actually consumed by the algorithm (`parValue`, `parVersion`, `scoringConfig`) called out; `source` flagged as audit-only. Step 12 reframed inline as defense-in-depth per D-5306 Option A. |
| §Non-Negotiable Constraints — Identity | `PlayerId` → `AccountId`. |
| §Locked contract values — Scoring signatures | `gameLog: GameMessage[]` removed; `gameState: LegendaryGameState` substituted; D-4801 cited inline. |
| §Locked contract values — PAR gate | Restructured into two sub-bullets: `Baseline (WP-051)` and `Effective for WP-053 (post-WP-053a)`. The effective shape `{ parValue, parVersion, source, scoringConfig }` is now stated verbatim in the locked-values section (was only in §Assumes pre-revision). |
| §Locked contract values — Identity | `PlayerId` → `AccountId` with D-5201 citation. |
| §A `CompetitiveScoreRecord` | Owner field renamed `playerId: PlayerId` → `accountId: AccountId`. New `// why:` comment documenting the SQL-vs-TS persistence-boundary mapping (SQL column stays `player_id bigint REFERENCES legendary.players(player_id)` per WP-052's `replay_ownership` precedent; TS field is `accountId: AccountId` mapped to `legendary.players.ext_id`). |
| §B `submitCompetitiveScore` flow | Eight substantive changes — see §11.2 below for the full diff narrative. |
| §B `listPlayerCompetitiveScores` | Parameter renamed `playerId: PlayerId` → `accountId: AccountId`. |
| §C migration `// why:` comments | Two additions: (1) explicit rationale for the redundant `replay_hash` / `state_hash` columns ("equality is asserted at write time, not inferred at read time"); (2) explicit rationale for the SQL-bigint / TS-AccountId boundary mapping. |
| §D test #1 wording | Clarified to "replay **exists but is not owned by** the submitting account" — disambiguates from the `replay_not_found` rejection path (step 2 of the flow). Coverage gap for `replay_not_found` documented inline; deferred to a follow-up coverage WP rather than expanding WP-053's locked 9-test count. |
| §D test #7 wording | Now requires verifying via injected dependency spies that `loadReplay` and `replayGame` are **not** called on the idempotent-retry path. |
| §AC PAR Gate group | Idempotency-fast-path-precondition AC added; `scoringConfig` flow AC added; defense-in-depth framing applied. |
| §AC Identity & Eligibility group | All `PlayerId` references → `AccountId`. New AC asserting ownership comparison uses `ownershipRecord.accountId === identity.accountId`. |
| §AC Immutability & Idempotency group | New AC: idempotent retry returns existing record without `loadReplay` call. New AC: race-condition path on `(player_id, replay_hash)` UNIQUE violation (`23505`) treated as idempotent success. |
| §Verification Steps | Two new steps: **Step 10** greps for any UPDATE path under `apps/server/src` (`updateCompetitive*` symbols, `UPDATE legendary.competitive_scores`); **Step 11** greps for any `gameLog` / `GameMessage[]` reference under `apps/server/src/competition` (must return zero matches per D-4801). Existing scope-enforcement step renumbered to Step 12. |

EC-053 (`docs/ai/execution-checklists/EC-053-competitive-score-submission.checklist.md`)
parallel updates:

| Locus | Change |
|---|---|
| §Before Starting line for WP-048 | `deriveScoringInputs` verify-grep targets `gameState: LegendaryGameState` (not `gameLog`); D-4801 cited. |
| §Before Starting line for WP-052 | Adds explicit verify-grep for `AccountId` export presence and `PlayerId` export absence; D-5201 cited. Reframes the WP-052 dependency around `accountId: AccountId` — including in `ReplayOwnershipRecord`. |
| §Locked Values — `submitCompetitiveScore` | `identity.playerId` → `identity.accountId`; D-5201 cited. |
| §Locked Values — `ReplayOwnershipRecord` | Explicit statement that owner field is `accountId: AccountId`, used in flow step 3. |
| §Locked Values — Scoring contract | `deriveScoringInputs(replayResult, replayResult.finalState)` locked verbatim; D-4801 cited; "any reference to `gameLog` is a contract violation" added. |
| §Locked Values — Published PAR | `scoringConfig` returned by the gate is the value passed to `computeRawScore` / `computeParScore` / `buildScoreBreakdown` (per WP-053a). |
| §Locked Values — Defense-in-depth | Step 12 reframing applied; D-5306 Option A cited as authority. |
| §Locked Values — Idempotent retry | Now states that `loadReplay` and `replayGame` are not called on retry; race-condition path on `23505` documented; flow step 4b placement called out. |
| §Locked Values — Scoring signatures | `gameLog` removed; per-D-4801 framing applied. |
| §Guardrails | PAR equality reframed as defense-in-depth / corruption-detection, not the primary drift safety net. |
| §After Completing | Three new pre-merge gates added: (1) no UPDATE path for competitive scores; (2) no `gameLog` / `GameMessage[]` reference in competition code; (3) no `PlayerId` / `playerId` references except `// why:` prose citing D-5201. Each gate ships with the exact `Select-String` invocation. |
| §Common Failure Smells | Three new smells added: (1) code references `PlayerId` or `ownershipRecord.playerId` (stale post-D-5201); (2) `deriveScoringInputs` called with a `gameLog` / `GameMessage[]` argument (wrong signature); (3) idempotent-retry path calls `loadReplay` or `replayGame` before the existence check (fast-path mis-placement). |

### 11.2 §B Flow — eight substantive changes

The pre-revision flow had 15 steps (1–15). The post-revision flow
has 16 steps (1–4, 4b, 5–15) with eight substantive changes:

1. **Step 1 enhanced.** The `isGuest(identity)` early-rejection guard
   now explicitly notes that after this guard `identity` narrows to
   `PlayerAccount` and `identity.accountId` is available — closes
   the type-narrowing question that made step 3 ambiguous.
2. **Step 3 corrected.** `ownershipRecord.playerId === identity.playerId`
   → `ownershipRecord.accountId === identity.accountId`. Resolves §5.1.
3. **Step 4b inserted (new — idempotency fast-path).** Looks up
   existing competitive record by `(accountId, replayHash)` and
   short-circuits before any PAR-gate I/O or replay load.
   Implementation choice between SQL JOIN vs two-query lookup left
   to the implementer. Inline `// why:` documents that PAR is
   monotonic per WP-051, so re-checking PAR for an existing record
   is wasted work.
4. **Step 5 sourced.** "Extract `scenarioKey` from ownership record"
   → "Extract `scenarioKey` from `ownershipRecord.scenarioKey` (the
   literal field name on `ReplayOwnershipRecord` per WP-052) — do
   not re-derive from the replay". Closes a guess-the-field-name
   trap.
5. **Step 6 shape corrected.** Returns `{ parValue, parVersion, source,
   scoringConfig }` per WP-053a (was `{ parValue, version }`). Algorithm
   consumes `parValue` / `parVersion` / `scoringConfig`; `source` is
   audit-only.
6. **Step 7 named.** Explicitly invokes `loadReplay(replayHash, database)`
   from WP-103 and treats `null` as `replay_verification_failed`
   (closes a "what if the ownership record exists but the blob is
   missing?" question).
7. **Step 10 corrected.** `deriveScoringInputs(replayResult, gameLog)`
   → `deriveScoringInputs(replayResult, replayResult.finalState)`.
   Resolves §11.3.
8. **Step 12 reframed.** "Drift guard" framing replaced with
   "defense-in-depth / corruption detection" framing per D-5306
   Option A. The check is preserved (mismatch still → `replay_verification_failed`)
   but the rationale is now consistent with §Assumes. The post-step-15
   `// why:` comment block was also updated.

A new tail subsection on `submitCompetitiveScore` documents the
post-step-4b race-condition handling: if step 4b's existence check
loses a race, the INSERT raises `UNIQUE (player_id, replay_hash)`
(`23505`); application logic re-reads the row and returns `{ ok:
true, wasExisting: true }`. Never re-throws; never re-executes.

### 11.3 Three drift items NOT surfaced in original §5 — now resolved

The original §5 (authored 2026-04-25 pre-execution) caught the
`PlayerId → AccountId` rename from D-5201 but did not surface three
other drift items. All three are now resolved in the working-tree
revision; recording them here so they don't get re-introduced
during execution.

#### 11.3.1 `deriveScoringInputs` second parameter is `gameState`, not `gameLog`

The pre-revision WP-053 documented `deriveScoringInputs(replayResult,
gameLog: GameMessage[])` in three places: §Assumes, §Locked contract
values, and §B flow step 10. The actual engine signature at
`packages/game-engine/src/scoring/parScoring.logic.ts:51` is:

```ts
export function deriveScoringInputs(
  replayResult: ReplayResult,
  gameState: LegendaryGameState,
): ScoringInputs
```

Per D-4801, the function reads G state directly and has **no event-log
dependency**. The function header literally states *"there is no
structured event log dependency (D-4801)"*. There is no
`GameMessage[]` type to obtain.

Pre-revision risk: the implementer would either (a) get blocked
trying to find the (nonexistent) `gameLog` field on `ReplayResult`,
or (b) invent it and produce code that fails type-check immediately.
The session protocol explicitly forbids guessing field names — but
the WP itself was the source of the wrong name.

Post-revision: `deriveScoringInputs(replayResult, replayResult.finalState)`
is locked across §Assumes, §Locked contract values, and §B flow
step 10. EC-053 §Locked Values carries the same correction with a
verify-grep and a "any reference to `gameLog` in implementation is
a contract violation" callout. Verification Step 11 in WP-053 and
the corresponding §After Completing gate in EC-053 enforce zero
`gameLog` / `GameMessage[]` matches in `apps/server/src/competition`.

#### 11.3.2 `checkParPublished` shape inconsistency between §Assumes and §Locked / §Flow

The pre-revision WP-053 was internally inconsistent on the
`checkParPublished` return shape:

- §Assumes (post-WP-053a-execution revision): `{ parValue, parVersion, source, scoringConfig }`
- §Locked contract values (pre-WP-053a baseline language preserved): `{ parValue, version }`
- §B flow step 6 (pre-WP-053a baseline language preserved): `{ parValue, version }`
- §A `CompetitiveScoreRecord` field: `parVersion: string` (consistent with WP-053a)

The drift originated in the previous revision pass: §Assumes was
updated to reflect WP-053a's `e5b9d15` landing, but §Locked and §B
flow were not propagated. Pre-revision risk: the implementer would
either (a) follow §Locked / §B and miss the `scoringConfig` field
entirely (forcing a separate config-catalog import that violates
WP-053a's "server doesn't derive which config applies" boundary),
or (b) follow §Assumes and produce code inconsistent with the
locked-values section that the lint gate is supposed to enforce.

Post-revision: §Locked carries both shapes explicitly — "Baseline
(WP-051)" and "Effective for WP-053 (post-WP-053a, commit
`e5b9d15`)" — making the supersession audit-trail explicit. §B
flow step 6 returns the post-WP-053a shape verbatim.

#### 11.3.3 Idempotency fast-path described in narrative but not in numbered flow

The pre-revision WP-053 §B documented the idempotency contract in
post-numbered-flow narrative ("Idempotent: if `(player_id, replay_hash)`
already exists, returns ... without re-executing the replay"), but
the numbered steps proceeded directly through ownership / visibility
/ PAR gate / replay load / re-execution before the INSERT. An
implementer reading the steps top-to-bottom would re-execute the
replay before checking for an existing record — wasted compute, and
ambiguous on whether re-execution is allowed at all on the retry
path.

Pre-revision risk: the implementer would naturally place the
existence check at the `INSERT` site (relying on `ON CONFLICT (...)
DO NOTHING` + `RETURNING`), which technically satisfies the
idempotency contract but loads the replay blob and runs `replayGame`
on every retry — a real cost on a hot path.

Post-revision: a new step 4b sits between visibility check and
scenario-key extraction, short-circuiting the entire replay-load /
re-execution / scoring branch when an existing record is found. The
inline `// why:` documents the placement rationale (PAR is monotonic;
re-validating PAR on retry is wasted work). Test #7 now requires
verifying via dependency spies that `loadReplay` and `replayGame`
are **not** called on the idempotent-retry path. EC-053's §Common
Failure Smells calls out fast-path mis-placement explicitly.

### 11.4 Pre-existing lint gaps surfaced — NOT addressed in this revision

Two §17 / §20 lint-checklist gaps surfaced during the lint
self-walkthrough on the post-revision WP-053. **Both predate this
revision pass.** They are recorded here so the next executor or a
future cleanup-pass author has a known starting point.

- **§17 Vision Alignment block missing as a structured section.**
  WP-053 cites Vision Goal 22 (Deterministic Scoring) and Vision
  Goal 24 (Replay-Verified Competitive Integrity) inline under
  §"Why This Packet Matters", but does not present a structured
  `## Vision Alignment` block with explicit clause-numbered list +
  conflict assertion + non-goal proximity check + determinism-
  preservation line as §17.2 requires. Lint §17 trigger surfaces
  applicable: scoring (§17.1 line 1), replays (§17.1 line 2),
  player identity (§17.1 line 3), determinism (§17.1 line 5).

- **§20 Funding Surface Gate N/A not declared.** WP-098's §20
  trigger requires every server-touching WP to either declare
  applicability and run the gate, or declare N/A with a one-line
  justification. WP-053 is N/A by construction (no payment surface,
  no donation/subscription/tournament-funding affordance — it is a
  competition-enforcement pipeline) but the declaration is missing.

Recommended disposition: fold both into a single small SPEC-only
revision pass (Version 1.4 → 1.5) before WP-053 execution, alongside
any other §17 / §20 lint cleanup that surfaces. Out of scope for
the current revision because (a) the current revision was tightly
scoped to drift / consistency corrections, and (b) the §17 / §20
additions are structural-template work that benefits from running
as its own focused pass.

### 11.5 Recommended next action

Before any WP-053 execution branch is cut:

1. Land an A0 SPEC commit on `main` containing the WP-053 + EC-053
   surgical revisions documented in §11.1. Suggested commit
   message: `SPEC: WP-053 + EC-053 v1.4 — fold post-WP-053a
   contract drift (gameLog→gameState per D-4801, PlayerId→AccountId
   per D-5201, idempotency fast-path step 4b, defense-in-depth
   reframe) + add no-UPDATE / no-gameLog verification gates`.
2. (Optional) Land a follow-up SPEC commit addressing §11.4's
   pre-existing §17 / §20 lint gaps (Version 1.4 → 1.5). May be
   bundled into the same A0 SPEC commit if the executor prefers a
   single round-trip; either way works.
3. Cut the WP-053 execution branch from `main` after A0 lands.
4. Resume the §9 step 5+ sequence (stash unrelated WIP, mirror
   WP-052 patterns, run the pre-commit-review template, etc.)

§9's existing step 4 wording is partially superseded by §11 — the
`PlayerId → AccountId` and migration-number drift it lists is now
resolved in the working tree, awaiting commit. Re-read §9 step 4
in light of §11.1's full inventory before authoring the A0 SPEC
commit.
