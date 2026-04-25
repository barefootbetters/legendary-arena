# Session Context — WP-053 (Competitive Score Submission & Verification)

> **Authored:** 2026-04-25 as a step-0 bridge from WP-052 closure
> (`fd769f1` Commit A + `cf4e111` SPEC close + `a8f81ff` BRANCHES.md
> housekeeping) to the WP-053 execution session. **Purpose:** capture
> the post-WP-052 reconciled state, surface two pre-execution drift
> items that EC-053 does not yet account for, and document the one
> hard prerequisite blocker so the next executor does not start a
> session against a known-blocked EC.
>
> **This file is not authoritative.** If conflict arises with
> `docs/ai/ARCHITECTURE.md`, `.claude/rules/*.md`, WP-053, or EC-053,
> those documents win. See §8 priority chain.
>
> **No execution is performed by reading this file.** WP-053 itself
> opens in a fresh Claude Code session per the One-Packet-Per-Session
> rule in `.claude/rules/work-packets.md`.

---

## 1. State on `main` (as of authoring)

`main` HEAD: **`a8f81ff`** (`INFRA: document retained topic branches in docs/ai/BRANCHES.md`).

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

## 2. Dependencies (all five are complete)

| Dep | Status | Surface used by WP-053 |
|---|---|---|
| WP-004 | Done 2026-04-09 | `apps/server/src/index.mjs` startup wiring exists; WP-053 does not modify it |
| WP-027 | Done 2026-04-14 | `replayGame`, `ReplayInput`, `computeStateHash` |
| WP-048 | Done 2026-04-17 (`c5f7ca4`) | `deriveScoringInputs`, `computeRawScore`, `computeFinalScore`, `buildScoreBreakdown`, `ScenarioScoringConfig` |
| WP-051 | Done 2026-04-23 (`ce3bffb`) | `checkParPublished` (returns fresh `{parValue, parVersion, source}` literal) |
| WP-052 | Done 2026-04-25 (`fd769f1`) | `AccountId` (NOT `PlayerId`), `PlayerIdentity` discriminated union, `isGuest` type guard, `findReplayOwnership`, `ReplayOwnershipRecord` |

All five dependencies are reachable on `main` at HEAD `a8f81ff`. The
runtime contract surface that WP-053 plans to consume exists.

---

## 3. Test & Build Baseline (LOCKED)

Captured against `main` at `a8f81ff`:

| Surface | Expected | Notes |
|---|---|---|
| `pnpm -r build` | exits 0 | All packages |
| `pnpm --filter @legendary-arena/game-engine test` | `513 / 115 / 0` | Unchanged since WP-052 |
| `pnpm --filter @legendary-arena/server test` | `31 / 5 / 0` (6 skipped when no test DB) | Achieved post-WP-052; the 6 skips are the DB-dependent identity / replayOwnership tests with locked reason `'requires test database'` |

WP-053's expected delta is +1 suite (`describe('competition logic (WP-053)', ...)`)
and +N tests (EC-053 calls for at least 9). Server total post-WP-053
will be at minimum `40 / 6 / 0` (with skips when no test DB).

---

## 4. Migration Numbering — Updated 2026-04-25 (WP-103 takes 006)

EC-053's `Files to Produce` line refers to the new migration as
`data/migrations/NNN_create_competitive_scores_table.sql`. With
WP-103 (Server-Side Replay Storage & Loader) drafted as the
predecessor (see §6), WP-103 takes migration **`006`** for
`legendary.replay_blobs`, and WP-053's `competitive_scores`
migration shifts to **`007`**.

Migration sequence after WP-103 + WP-053 land:

```
data/migrations/
  001_server_schema.sql                         (existing)
  002_seed_rules.sql                            (existing)
  003_game_sessions.sql                         (existing)
  004_create_players_table.sql                  (WP-052)
  005_create_replay_ownership_table.sql         (WP-052)
  006_create_replay_blobs_table.sql             (WP-103, planned)
  007_create_competitive_scores_table.sql       (WP-053, planned — was 006 before WP-103 drafting)
```

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

## 6. Hard Prerequisite Blocker — Resolved by WP-103

EC-053 §Before Starting line 21 (verbatim):

> Server has an existing replay loader by `replayHash`; storage
> implementation is out of scope for WP-053. If no loader exists,
> WP-053 is **BLOCKED** and must not proceed. A test-only mock
> satisfies test fixtures, not the prerequisite — the application
> must have a real loader at runtime; mocks may not be the way this
> gate is satisfied.

**Status update (2026-04-25): resolution decision = Option 1
(predecessor WP).** WP-103 — Server-Side Replay Storage & Loader —
has been drafted and registered in `WORK_INDEX.md` and `EC_INDEX.md`
to land the loader. WP-053 is now formally **BLOCKED on WP-103
execution** (WORK_INDEX row updated 2026-04-25 with this
dependency). Once WP-103 ships (`legendary.replay_blobs` table +
`storeReplay` / `loadReplay` server-side helpers in
`apps/server/src/replay/`), WP-053's §Before Starting line 21 can
be satisfied without re-scoping or re-interpreting the prerequisite.

**WP-103 surface (4 files, mirrors WP-052's clean shape):**

- `apps/server/src/replay/replay.types.ts` — re-exports
  `ReplayInput` from `@legendary-arena/game-engine` (type-only) and
  `DatabaseClient` from `../identity/identity.types.js`
- `apps/server/src/replay/replay.logic.ts` —
  `storeReplay(replayHash, replayInput, db): Promise<void>` (locked
  SQL `INSERT … ON CONFLICT (replay_hash) DO NOTHING`) +
  `loadReplay(replayHash, db): Promise<ReplayInput | null>` (deserialized
  by `pg`'s `jsonb` codec; no manual `JSON.parse`)
- `apps/server/src/replay/replay.logic.test.ts` — 5 tests in one
  describe block (1 pure + 4 DB-dependent)
- `data/migrations/006_create_replay_blobs_table.sql` —
  `legendary.replay_blobs (replay_hash text PRIMARY KEY,
  replay_input jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`

**Migration sequence shifts as a result:** WP-103 takes migration
`006`. WP-053's `competitive_scores` migration shifts to `007` (was
documented as `006` in this file's §4 before WP-103 was drafted).
See §4 below — that section is now stale and superseded by this
update.

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

WP-053 sessions cannot start until WP-103 is in main. See WP-103's
Files Expected to Change for the full content surface.

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

1. **Confirm WP-103 has landed on `main`.** Run
   `git log --oneline -- data/migrations/006_create_replay_blobs_table.sql`;
   non-empty output means WP-103 shipped and the §6 blocker is
   resolved. If empty, STOP — WP-103 must execute first; WP-053
   cannot start until then.
2. Run `pnpm -r build && pnpm -r test` against the current `main`
   to confirm the post-WP-103 baseline (engine `513/115/0`,
   server `36/6/0` with 10 skipped if no test DB). If it doesn't
   match, STOP — the environment has drifted since WP-103 closure.
3. Read this file's §5 and §6. The drift fixes in §5
   (`PlayerId → AccountId`) and the migration-number update from
   §4 (`006 → 007` for `competitive_scores`) must both land in the
   WP-053 A0 SPEC commit.
4. Draft A0 SPEC updates for EC-053:
   - Fix `PlayerId → AccountId` references at lines 19, 64, 123 per §5.1.
   - Add WP-103 to EC-053 §Before Starting (currently absent).
   - Update EC-053 §Files to Produce to `007_create_competitive_scores_table.sql`.
   - Confirm the `loadReplay` import boundary: WP-053's
     `competition.logic.ts` imports `loadReplay` from
     `../replay/replay.logic.js` (intra-server-layer dependency,
     allowed; mirrors WP-052 cross-directory pattern).
5. Land A0 SPEC on `main` per the WP-052 commit topology pattern.
6. Cut the WP-053 execution branch from `main` after A0 lands.
7. Stash unrelated WP-097 / WP-098 governance work-in-progress in
   the working tree (per §1) before staging anything for Commit A.
6. Mirror the WP-052 implementation patterns where applicable:
   `ext_id ↔ player_id` CTE inside SQL; `Result<T>` discriminated
   union for fallible operations; `// why:` comments at every
   non-obvious decision; `.test.ts` extension; locked
   `{ skip: 'requires test database' }` reason for DB-dependent
   tests; tests wrapped in exactly one `describe()` block.

The WP-052 post-mortem at
`docs/ai/post-mortems/01.6-WP-052-player-identity-replay-ownership.md`
documents the skip-pattern grep-gate reconciliation (§3.1) — the
WP-053 executor will encounter the same gate and should adopt the
same inline conditional options form
(`hasTestDatabase ? {} : { skip: 'requires test database' }`)
without rediscovering the asymmetry.
