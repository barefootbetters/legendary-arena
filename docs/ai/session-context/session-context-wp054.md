# Session Context — WP-054 (Public Leaderboards & Read-Only Web Access)

> **Authored:** 2026-04-26 as a step-0 bridge from WP-053 closure
> (`56e8134` Commit A `EC-053:` + `26e122f` Commit B `SPEC:` governance
> close) and the WP-054 v1.2 → v1.3 A0 SPEC pass to the WP-054
> execution session. **Purpose:** capture the post-WP-053 reconciled
> state, document the four blocking pre-flight findings folded into
> the v1.3 A0 SPEC, and surface the locked test count, the lifecycle
> prohibition, the `replayHash` permalink decision, and the rate-
> limiting deferral so the executor does not start a session against a
> stale baseline.
>
> **Revised:** 2026-04-26 — post-A0-SPEC-commit + post-pre-flight +
> post-copilot-check reconciliation. The WP-054 v1.3 A0 SPEC bundle
> (this file + WP-054 v1.3 + EC-054 v1.3) landed on `main` via single
> `SPEC:` commit `f56a955`. Pre-flight (`01.4`) re-ran 2026-04-26
> against the v1.3 artifacts and returned **READY TO EXECUTE** — all
> four prior blockers (CV-1 PlayerId→AccountId, CV-2 checkParPublished
> shape/signature, SR-1 rate-limiting scope contradiction, Vision
> Sanity §17.2 block missing) resolved; all three non-blocking polish
> items (SR-2 replayHash permalink, SR-3 INNER JOIN defense-in-depth,
> drift-detection test #9 per copilot #11) folded in. Copilot check
> (`01.7`) re-ran 2026-04-26 against the post-A0 artifacts and
> returned **CONFIRM** with **30/30 PASS** — disposition CONFIRM,
> session prompt generation authorized. §1 main-HEAD reference, §6
> Steps 1 / 1b status, and §10 steps 1-3 are all updated below.
> Substantive guidance in §2-§5, §7-§9 unchanged — only the temporal
> framing reflects the post-A0 state.
>
> **This file is not authoritative.** If conflict arises with
> `docs/ai/ARCHITECTURE.md`, `.claude/rules/*.md`, WP-054, or EC-054,
> those documents win. See §7 priority chain.
>
> **No execution is performed by reading this file.** WP-054 itself
> opens in a fresh Claude Code session per the One-Packet-Per-Session
> rule in `.claude/rules/work-packets.md`.

---

## 1. State on `main` (as of authoring)

`main` HEAD at session-context original authoring: **`6c217b7`**
(`SPEC: WP-109 / EC-109 + roadmap back-sync — team affiliation draft
(3/4/5-player cohorts)`).

Post-A0-SPEC `main` HEAD (current): **`f56a955`** (`SPEC: WP-054 +
EC-054 v1.3 — fold post-WP-053 contract drift … + author session-
context-wp054 bridge`). The A0 SPEC bundle (this file + WP-054 v1.3
+ EC-054 v1.3) landed as a single `SPEC:` commit on 2026-04-26 per
the recommended commit topology in §10 step 1.

Recent landed history relevant to WP-054:

- **WP-053** — Competitive Score Submission & Verification — Done
  2026-04-26. Three commits: A0 SPEC `27d3004` (v1.5 — Vision
  Alignment block + migration slot 007 + IF NOT EXISTS), Commit A
  `EC-053:` `56e8134` (4 files: 3 `.ts` source/test + migration 007),
  Commit B `SPEC:` `26e122f` (governance close — STATUS + WORK_INDEX
  + EC_INDEX flips + 01.6 post-mortem + DECISIONS D-5301..D-5305
  inline). Server baseline shifted `38/6/0` → **`47/7/0`** (with 16
  skipped if no test DB); engine `522/116/0` unchanged. Post-mortem
  at
  `docs/ai/post-mortems/01.6-WP-053-competitive-score-submission-verification.md`.
- **WP-053a** — PAR Artifact Carries Full ScenarioScoringConfig —
  Done 2026-04-25 at `e5b9d15`. Extends `ParGateHit` to
  `{ parValue, parVersion, source, scoringConfig }` per **D-5306
  Option A**. WP-054 reads only `parValue` from the hit (presence
  check); the wider shape is inert here, but the v1.3 §Assumes line
  must reflect the actual shape so the implementer doesn't write
  `result.version` and silently get `undefined`.
- **WP-052** — Player Identity, Replay Ownership & Access Control —
  Done 2026-04-25 at `fd769f1`. **Critical naming change: server
  identity is `AccountId`, NOT `PlayerId`** (D-5201). The engine
  `PlayerId` (D-8701) is a deliberately distinct plain string in a
  different layer. WP-054 v1.2 referenced `PlayerId` in 6+ locations;
  v1.3 corrects all of them.
- **WP-103** — Server-Side Replay Storage & Loader — Done 2026-04-25
  at `fe7db3e`. Not consumed by WP-054 (read-only leaderboards have
  no use for the replay blob; WP-054 reads the hash from
  `legendary.competitive_scores`, not the blob).
- **WP-051** — PAR Publication & Server Gate Contract — Done
  2026-04-23 at `ce3bffb`. `apps/server/src/par/parGate.mjs:83`
  exports the bare 3-arg `checkParPublished(simulationIndex,
  seedIndex, scenarioKey)`; the bound 1-arg form
  `(scenarioKey) => ParGateHit | null` lives on the gate object
  returned by `createParGate(basePath, parVersion)`. WP-054 v1.2 had
  the signature wrong; v1.3 corrects the §Assumes line and
  introduces a `LeaderboardDependencies` injection seam (mirroring
  WP-053's `SubmissionDependencies` pattern at
  `apps/server/src/competition/competition.logic.ts:103-160`).
- **WP-004** — Server Bootstrap — Done 2026-04-09. Not modified by
  WP-054.

### Working tree at authoring time

The repo working tree carries unrelated work that is **not** part of
WP-054's scope:

- Modified (uncommitted): `docs/ai/DESIGN-RANKING.md`
- Untracked: `data/cards-combined.{json,md,txt}`,
  `scripts/Combine-CardData.ps1` (cross-repo card-data scratch — see
  the relevant memory note about the cards pipeline)

The WP-054 executor must **stash or otherwise hold these aside**
before cutting the WP-054 execution branch, exactly as WP-053 / WP-052
did. See WP-053's pre-session gate 8 for the `git stash push --
<filename>` pattern.

---

## 2. Dependencies (all six are complete)

| Dep | Status | Surface used by WP-054 |
|---|---|---|
| WP-004 | Done 2026-04-09 | `apps/server/src/index.mjs` startup wiring exists; WP-054 does not modify it |
| WP-051 | Done 2026-04-23 (`ce3bffb`) | `checkParPublished(simulationIndex, seedIndex, scenarioKey)` bare export + `createParGate(...)` bound 1-arg form |
| WP-052 | Done 2026-04-25 (`fd769f1`) | `AccountId` (NOT `PlayerId`), `ReplayVisibility`, `legendary.players.display_name`, `legendary.replay_ownership.visibility`, `DatabaseClient = pg.Pool` |
| WP-053a | Done 2026-04-25 (`e5b9d15`) | Extended `ParGateHit` shape `{ parValue, parVersion, source, scoringConfig }` per D-5306 Option A |
| WP-103 | Done 2026-04-25 (`fe7db3e`) | Not consumed by WP-054 (no replay blob loads in read-only leaderboard surface) |
| WP-053 | Done 2026-04-26 (`56e8134`) | `CompetitiveScoreRecord` (owner field `accountId: AccountId`, not `playerId`); `findCompetitiveScore`, `listPlayerCompetitiveScores`; `legendary.competitive_scores` migration 007; `DatabaseClient` re-export from `competition.types.ts:40` |

All six dependencies are reachable on `main` at HEAD `6c217b7`. The
runtime contract surface that WP-054 plans to consume exists and
matches the v1.3 §Assumes block.

---

## 3. Test & Build Baseline (LOCKED)

Captured against `main` at `6c217b7`:

| Surface | At `6c217b7` (current) | Target post-WP-054 | Notes |
|---|---|---|---|
| `pnpm -r build` | exits 0 | exits 0 | All packages |
| `pnpm --filter @legendary-arena/game-engine test` | `522 / 116 / 0` | `522 / 116 / 0` (unchanged) | WP-054 touches no engine code |
| `pnpm --filter @legendary-arena/server test` | `47 / 7 / 0` (16 skipped if no test DB) | **`55 / 8 / 0`** (+8 tests / +1 suite; 23 skipped if no test DB: 10 inherited + 6 WP-053 + 7 of WP-054's 8 DB tests) | Test 9 (drift-detection on `Object.keys(entry)`) is logic-pure and runs without DB; tests 1-8 are DB-dependent |

**Wrap-in-describe convention (locked):** all 9 WP-054 tests live
inside one `describe('leaderboard logic (WP-054)', …)` block. Bare
top-level `test()` calls would land at `55 / 7 / 0` instead of `55 / 8
/ 0` and fail the locked suite count. Per WP-031 / WP-053 precedent.

**Skip pattern (locked):** WP-054 tests 1-8 use the locked
WP-052 §3.1 inline conditional skip:
`hasTestDatabase ? {} : { skip: 'requires test database' }`. Never
silently omitted; never throws on missing DB. Test 9 always runs.

---

## 4. Migration Numbering — N/A

WP-054 introduces **no new migrations** (read-only WP). The
`data/migrations/` sequence remains:

```
data/migrations/
  001_server_schema.sql                         (existing)
  002_seed_rules.sql                            (existing)
  003_game_sessions.sql                         (existing)
  004_create_players_table.sql                  (WP-052)
  005_create_replay_ownership_table.sql         (WP-052)
  006_create_replay_blobs_table.sql             (WP-103)
  007_create_competitive_scores_table.sql       (WP-053)
  -- no new migration in WP-054 --
```

Future performance tuning (e.g., a `(scenario_key, final_score,
created_at)` index on `legendary.competitive_scores`) is explicitly
deferred to a separate WP — out of scope for WP-054 per pre-flight
Risk R-8 / WP-054 §Out of Scope.

---

## 5. Pre-Execution Drift Items (folded into v1.3 A0 SPEC)

Pre-flight 2026-04-26 surfaced four blocking items + three
non-blocking polish items. All seven are folded into the v1.3 A0 SPEC
pass. Recording them here so they don't get re-introduced during
execution.

### 5.1 `playerId` → `accountId` rename (D-5201) — RESOLVED in v1.3

WP-054 v1.2 referenced `PlayerId` / `playerId` in §Assumes line 70,
§Non-Negotiable Constraints lines 142 and 194, §Scope (In) §A
PublicLeaderboardEntry `// why:`, §Scope (In) §C test #8, §Acceptance
Criteria §Public Safety, and §Verification Step 7. All six locations
corrected to `AccountId` / `accountId` per **D-5201**, except SQL
column references (`legendary.players.player_id`,
`legendary.competitive_scores.player_id`) which remain `player_id`
(those are bigint FK columns, intentionally distinct from the
application-layer `accountId: AccountId` per WP-052/WP-053 precedent).

EC-054 received parallel updates across §Before Starting / §Locked
Values / §Guardrails / §After Completing / §Common Failure Smells.

### 5.2 `checkParPublished` shape and signature (D-5306 / WP-053a) — RESOLVED in v1.3

WP-054 v1.2 §Assumes line 67 said
`checkParPublished(scenarioKey)` returns `{ parValue, version }`. Wrong on two axes:

- **Signature:** the bare module export at `parGate.mjs:83` is 3-arg
  (`simulationIndex, seedIndex, scenarioKey`). The 1-arg curried form
  lives only on the gate object returned by `createParGate(...)` at
  `parGate.mjs:277`.
- **Return shape:** post-WP-053a (D-5306 Option A) the hit shape is
  `{ parValue, parVersion, source, scoringConfig }` — see
  `parGate.mjs:32-47` JSDoc typedef.

v1.3 corrects §Assumes and introduces a `LeaderboardDependencies`
injection seam in §Scope (In) §A so `getScenarioLeaderboard` consumes
the bound 1-arg form via `deps.checkParPublished(scenarioKey)` —
mirrors WP-053's `SubmissionDependencies` at
`apps/server/src/competition/competition.logic.ts:103-160`.
`PRODUCTION_DEPENDENCIES` defaults to fail-closed
(`checkParPublished: () => null`), so the helpers are safe to ship
before the request-handler WP wires the real bound gate.

### 5.3 Rate-limiting requirement vs file allowlist contradiction — RESOLVED in v1.3

WP-054 v1.2 §Non-Negotiable Constraints lines 149-153 and EC-054
§After Completing line 85 required rate limiting. The 3-file scope
(`leaderboards/{types,logic,logic.test}.ts`) had no place to put it
without expanding scope or violating the "no caching layer"
out-of-scope statement.

v1.3 resolution: defer rate limiting to the future request-handler WP
(parallels WP-053's lifecycle prohibition pattern at
[EC_INDEX.md row for EC-053](../execution-checklists/EC_INDEX.md)).
Added explicit `## Lifecycle Prohibition (Locked)` section in WP-054
v1.3 listing all forbidden caller surfaces. Added §Out of Scope line
"No HTTP endpoints, no rate limiting, no middleware". EC-054
§Guardrails carries the parallel "no transport / middleware"
guardrail with a `Select-String` enforcement gate in §After
Completing.

### 5.4 Missing `## Vision Alignment` block (lint §17 FAIL) — RESOLVED in v1.3

WP-054 v1.2 cited Vision Goal 18 + 24 inline under §Why This Packet
Matters but had no structured `## Vision Alignment` block. Per `00.3
§17.2` and 01.4 §Vision Sanity Check, this is a hard lint failure for
any WP touching scoring/leaderboards (§17.1 line 1) + replay
verification (§17.1 line 2) + player identity/visibility (§17.1
line 3).

v1.3 adds a structured `## Vision Alignment` block with explicit
clauses (§3, §11, §18, §20, §22, §23, §24), conflict assertion ("No
conflict"), non-goal proximity (NG-1..7 not crossed), determinism
preservation (deterministic sort, no caching), and a `## §20 — N/A`
declaration for the WP-098 Funding Surface Gate Trigger.

### 5.5 Permalink key choice — RESOLVED in v1.3 (recommendation accepted)

WP-054 v1.2 §B introduced `getPublicScoreBySubmissionId(submissionId:
number, …)`. Pre-flight SR-2 flagged the sequence-attack surface
(`/score/1`, `/2`, … leaks total submission count). The WP-052
identity rationale at `apps/server/src/identity/identity.types.ts:40`
explicitly cites *"UUID v4 avoids sequential ID enumeration attacks"*.

v1.3 renames the function to `getPublicScoreByReplayHash(replayHash:
string, …)` and:
- Moves `replayHash` from never-expose → public-safe (and adds a
  `// why:` documenting that exposure is consistent with the
  visibility model: only `link` / `public` visibility hashes ever
  appear in any leaderboard query)
- Moves `submissionId` from public-safe → never-expose (with
  sequence-attack rationale)
- Updates EC-054 §Common Failure Smells to flag any
  `getPublicScoreBySubmissionId` variant or `submissionId` URL string
  literal as a contract violation

### 5.6 Display-name fail-closed guard semantics — RESOLVED in v1.3

WP-054 v1.2 EC-054 line 53 required "fail closed (excluded from
results) rather than rendering a substitute" when display name is
missing. The schema makes the missing state structurally impossible
(`display_name text NOT NULL` per `004_create_players_table.sql:30`).

v1.3 rephrases the guardrail as defense-in-depth: use `INNER JOIN`
(not `LEFT JOIN ... COALESCE`), which fail-closes by SQL construction.
Added explicit `// why:` requirement to EC-054 §Required `// why:`
Comments documenting that the schema constraint is not the
load-bearing safety guard — the `INNER JOIN` is. Added EC-054
§Common Failure Smells line flagging `LEFT JOIN ... COALESCE` or
any display-name fallback as an identity-inference loophole.

### 5.7 Drift-detection test for `PublicLeaderboardEntry` keys — ADDED in v1.3

WP-054 v1.2 had 8 tests; only test #8 asserted the absence of
sensitive fields, and it didn't assert the exact key set. Copilot
finding #11 flagged this gap.

v1.3 adds test #9 (logic-pure, runs without DB):
`Object.keys(entry).sort()` MUST equal the locked 9-key set
`['createdAt','finalScore','parVersion','playerDisplayName','rank','rawScore','replayHash','scenarioKey','scoringConfigVersion']`.
Mirrors the WP-053 `CompetitiveScoreRecord` 11-key drift assertion at
`apps/server/src/competition/competition.types.ts:117-120`. Test
count `8 → 9`; suite count locked at `+1` (single
`describe('leaderboard logic (WP-054)', …)` block).

---

## 6. Workflow Position (per `01.4 §Work Packet Execution Workflow`)

| Step | Gate | Status |
|---|---|---|
| 0 | Session context | **DONE** — this file landed in the A0 SPEC commit `f56a955`. |
| 1 | Pre-flight (`01.4`) | **DONE 2026-04-26 — verdict: READY TO EXECUTE.** Initial pre-flight returned NOT READY for the four §5 blockers (CV-1, CV-2, SR-1, Vision Sanity); v1.3 A0 SPEC resolved all four; re-run against `f56a955` confirmed all dependencies green, all four blockers closed, all three non-blocking polish items folded in. |
| 1b | Copilot check (`01.7`) | **DONE 2026-04-26 — disposition: CONFIRM, 30/30 PASS.** Early-sanity-pass against v1.2 returned BLOCK with 10 RISKs (#4, #11, #12, #15, #16, #17, #21, #22, #27, #30); post-A0 re-run against `f56a955` cleared all 10 RISKs to PASS. Two non-blocking carry-forwards remain: EC_INDEX row for EC-054 (deferred to governance close, Commit B); index on `(scenario_key, final_score, created_at)` (deferred to future tuning WP). |
| 2 | Session prompt | **Pending — authorized.** Author at `docs/ai/invocations/session-wp054-public-leaderboards-read-only.md` citing `f56a955` as the A0 SPEC anchor, the locked test count (`55/8/0`), the `01.5 NOT INVOKED` declaration, and the pre-commit-review template integration per §9.7. |
| 3 | Execution | Pending — fresh Claude Code session against the session prompt. |
| 4 | Post-mortem | **MANDATORY per 01.6** for WP-054: new long-lived abstractions (`PublicLeaderboardEntry`, `ScenarioLeaderboard`, `LeaderboardQueryOptions`, `LeaderboardDependencies`); new contract surface consumed by future request-handler WP; new dependency-injection seam pattern (mirrors WP-053). Same trigger profile as WP-053. |
| 5 | Pre-commit review | Pending — separate session as needed. |
| 6 | Commit (A code, B governance) | Pending. Topology: A0 SPEC (this bundle) + Commit A `EC-054:` (3 files) + Commit B `SPEC:` (STATUS + WORK_INDEX flip + EC_INDEX row + 01.6 post-mortem). |
| 7 | Lessons learned | Pending. |
| 8 | Session context for next WP | Successor candidates: WP-055 (next in WORK_INDEX), or a future request-handler WP that wires WP-053 + WP-054 helpers into HTTP endpoints with rate limiting. |

---

## 7. Authority Chain

In conflict, higher-authority documents win:

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md`
3. `docs/01-VISION.md`
4. `.claude/rules/*.md` (architecture, code-style, work-packets,
   server, persistence, registry, game-engine)
5. `docs/ai/work-packets/WORK_INDEX.md`
6. `docs/ai/work-packets/WP-054-public-leaderboards-read-only.md` (v1.3)
7. `docs/ai/execution-checklists/EC-054-public-leaderboards-read-only.checklist.md`
8. This session-context file
9. Active conversation context (lowest)

---

## 8. Suggested First Actions for the WP-054 Executor

In strict order:

1. **Confirm `main` is at HEAD `6c217b7` or later, with the WP-054 v1.3
   A0 SPEC bundle landed.** Run
   `git log --oneline -- docs/ai/work-packets/WP-054-public-leaderboards-read-only.md`;
   expect at least one commit after `c33d42b`. If empty, the A0 SPEC
   has not landed yet — STOP.

2. **Confirm the post-WP-053 baseline.** Run
   `pnpm -r build && pnpm --filter @legendary-arena/server test &&
   pnpm --filter @legendary-arena/game-engine test`. Expect:
   - Build exits 0
   - Server: `47 / 7 / 0` (with 16 skipped if no test DB)
   - Engine: `522 / 116 / 0`
   If counts don't match, STOP — the environment has drifted since
   WP-053 closure or the test plan needs re-derivation.

3. **Read this file's §3 (test baseline), §5 (drift items resolved in
   v1.3), and §6 (workflow position).** Do not start implementation
   if any §5 item is still open in the WP/EC text — the v1.3 A0 SPEC
   should have folded them all in, but verify.

4. **Read the actual contract sources before writing a single line:**
   - `apps/server/src/competition/competition.types.ts` —
     `CompetitiveScoreRecord` (11 readonly fields, owner is
     `accountId: AccountId`)
   - `apps/server/src/competition/competition.logic.ts:103-160` —
     `SubmissionDependencies` injection seam pattern (template for
     `LeaderboardDependencies`)
   - `apps/server/src/identity/identity.types.ts` — `AccountId`,
     `DatabaseClient`
   - `apps/server/src/identity/replayOwnership.types.ts` —
     `ReplayVisibility`
   - `apps/server/src/par/parGate.mjs:32-59` — `ParGateHit` typedef
     and `ParGate` interface (1-arg bound form)
   - `data/migrations/004_create_players_table.sql` — confirm
     `display_name text NOT NULL`
   - `data/migrations/005_create_replay_ownership_table.sql` —
     confirm visibility column shape
   - `data/migrations/007_create_competitive_scores_table.sql` —
     confirm column names for the JOIN

5. **Stash unrelated working-tree changes** (DESIGN-RANKING.md +
   cards-combined scratch + Combine-CardData.ps1) before staging
   anything for Commit A. WP-053's pre-session gate 8 is the
   canonical precedent for this stash discipline.

6. **Mirror the WP-053 implementation patterns where applicable:**
   - `LeaderboardDependencies` injection seam mirrors
     `SubmissionDependencies`
   - `PRODUCTION_DEPENDENCIES` constant defaults to fail-closed
     (`checkParPublished: () => null`)
   - Inner-join CTE / SQL pattern with `ext_id ↔ player_id` mapping
     inside SQL (never expose bigint at TS surface)
   - `Result<T>`-style return values where applicable (though
     WP-054's reads are simple `T | null` since there is no
     fallible-with-reason path — every empty / null return is
     fail-closed by construction)
   - `// why:` comments at every non-obvious decision (the EC §Required
     `// why:` Comments list is the floor, not the ceiling)
   - `.test.ts` extension; locked
     `hasTestDatabase ? {} : { skip: 'requires test database' }` for
     DB-dependent tests; all 9 tests wrapped in exactly one `describe()`
     block

7. **Cite `docs/ai/prompts/PRE-COMMIT-REVIEW.template.md`** in the
   WP-054 session prompt's Authority Chain and add a Pre-Session Gate
   or §Authorized Next Step that runs the template between "all
   gates green" and "stage Commit A". Closes the structural gap that
   caused WP-103's retrospective review at `c8a2421`.

8. **Pre-screen `Select-String` Hard Stop greps for likely `// why:`
   comment substring collisions.** If any Hard Stop would match
   comment text containing forbidden literal substrings (e.g., a
   `// why: not playerId — see D-5201` comment trips the Step 7b
   `\bplayerId\b` grep), either reword the gate to anchor to actual
   code structure (e.g., property assignment `: playerId` /
   declaration `playerId:`) or rephrase the comment to avoid the
   literal substring. Per WP-031 / WP-103 carry-forward §3.1 / WP-053
   §11 lessons.

9. **Author the WP-054 session prompt** with explicit `01.5 NOT
   INVOKED` declaration: WP-054 is purely additive (zero
   `LegendaryGameState` field, zero `buildInitialGameState` shape
   change, zero new moves, zero new phase hooks; engine entirely
   untouched). Lifecycle prohibition makes the helpers library-only
   until the request-handler WP wires them.

10. **Commit topology at execution:**
    - A0 SPEC (this bundle: WP-054 v1.3 + EC-054 + this session-context
      file) — `SPEC:` prefix
    - Commit A `EC-054:` — 3 files (types + logic + test)
    - Commit B `SPEC:` — governance close: STATUS.md update,
      WORK_INDEX.md WP-054 `[ ]` → `[x]` with date, EC_INDEX.md EC-054
      row added, 01.6 post-mortem at
      `docs/ai/post-mortems/01.6-WP-054-public-leaderboards-read-only.md`,
      DECISIONS entries inline (replayHash permalink rationale, rate-
      limiting deferral, INNER JOIN defense-in-depth)

---

## 9. Lessons Carried Forward From WP-053 Execution (2026-04-26)

These observations surfaced during WP-053 execution and apply
directly to WP-054. The full WP-053 post-mortem is at
`docs/ai/post-mortems/01.6-WP-053-competitive-score-submission-verification.md`.

### 9.1 Dependency injection seam is the load-bearing testability surface

**Lesson:** WP-053's `SubmissionDependencies` seam at
`competition.logic.ts:103-160` is what enabled test #7 (idempotent
retry skips replay seams via spy injection — the D-5304 contract
proof). Without the seam, the test would have required a real
`loadReplay` + `replayGame` round-trip on every retry, defeating the
test's purpose.

**Implication for WP-054:** the `LeaderboardDependencies` seam is
similarly load-bearing for test #6 (PAR-missing → empty leaderboard).
Without DI, the test would need to mutate the real PAR index file or
shell out to `createParGate(...)` with a synthetic basePath — both
expensive and brittle. With DI, test #6 passes a stub
`checkParPublished: () => null` directly. **Make sure
`PRODUCTION_DEPENDENCIES` is exported** so consumers (the future
request-handler WP) can extend it via spread without re-deriving the
shape.

### 9.2 `xmax = 0` idiom is not relevant here, but ON CONFLICT idempotency-discipline lessons are

**Lesson:** WP-053 used the
`ON CONFLICT (player_id, replay_hash) DO UPDATE SET player_id =
legendary.competitive_scores.player_id RETURNING (xmax = 0) AS
was_inserted` pattern for race-safe idempotency. This required
careful reasoning about `xmax` semantics (visible row's deleting/
updating xact ID; 0 means no concurrent update).

**Implication for WP-054:** read-only WPs avoid the entire
idempotency-race surface. But the WP-053 lesson about **using actual
PostgreSQL semantics rather than reinventing** carries over: use SQL
features (`INNER JOIN`, `LIMIT/OFFSET`, `ORDER BY`) rather than
post-fetching and filtering / sorting in TypeScript. WP-054 §B locks
the SQL shape; do not re-fetch in TS.

### 9.3 Test-fixture validator pre-screen pattern

**Lesson (WP-053 §10.1 carry-forward from WP-053a):** test fixtures
that construct `ScenarioScoringConfig` instances must satisfy
`validateScoringConfig`'s structural invariants
(`bystanderReward > villainEscaped`, etc.). Pre-WP-053a this was
harmless because the validator wasn't run against embedded artifact
configs; WP-053a surfaced it as 3 mid-execution test failures.

**Implication for WP-054:** WP-054 does not construct
`ScenarioScoringConfig` instances at all (it only consumes them as
opaque payloads via the PAR gate seam). But the **lesson about
fixture invariants** generalizes: WP-054 test fixtures will
construct `CompetitiveScoreRecord`-shaped rows, `ReplayOwnershipRecord`-
shaped rows, and `PlayerAccount`-shaped rows. All three have locked
shapes (drift-detection tests in WP-052 and WP-053). Pre-flight or
the test author must verify that fixture construction passes any
applicable Zod / runtime validation; otherwise mid-execution drift
re-emerges.

### 9.4 Wrap-in-describe convention is non-negotiable for locked test counts

**Lesson:** WP-031 / WP-053 both locked test+suite count
(`pass / suites / fail`). Bare top-level `test()` calls do NOT
register as suites in `node:test`; the suite count only increments
per `describe()`. WP-031 originally produced `358 / 93 / 0` instead
of locked `358 / 94 / 0` and required a wrap-in-describe fix mid-
execution.

**Implication for WP-054:** all 9 WP-054 tests live in **one**
`describe('leaderboard logic (WP-054)', …)` block — locked at +1
suite. Drift-detection test #9 (the logic-pure one) must NOT live in
its own describe — it lives in the same block as tests 1-8 to keep
the suite delta at exactly +1.

### 9.5 INFRA hook fix for lowercase EC-### letter suffixes (active on `main`)

**Lesson:** the commit-msg hook regex was originally uppercase-only
(`[A-Z]?`); WP-053a's `EC-053a:` commit prefix was rejected. The fix
landed as `INFRA:` commit `fbbedb5` updating the regex to `[A-Za-z]?`.

**Implication for WP-054:** EC-054 has no letter suffix so this
doesn't matter. But if WP-054 ever spawns a sub-numbered follow-up
(EC-054a, EC-054A, etc.), both casings now work.

### 9.6 Mechanical-fixture-update calibration

**Lesson:** WP-053a's contract extension touched two existing test
files (`par.storage.test.ts` and `parGate.test.ts`) and required ~41
added lines of mechanical fixture updates. Centralized factories
absorbed most of the repetition.

**Implication for WP-054:** WP-054 modifies **zero** existing test
files (the EC explicitly forbids importing `competition.logic.ts`
and the WP modifies no shared factories). Mechanical-fixture-update
budget is 0. Any pressure to "just touch one existing test" is a
scope-creep signal — escalate.

### 9.7 Pre-commit-review template integration (WP-103 carry-forward)

**Lesson:** WP-103 closed without running the pre-commit-review
template; the retrospective review landed at `c8a2421` after-the-
fact. WP-053 picked this up and integrated the template into its
session prompt's Authority Chain.

**Implication for WP-054:** the session prompt for WP-054 must cite
`docs/ai/prompts/PRE-COMMIT-REVIEW.template.md` in its Authority
Chain and include a Pre-Session Gate or §Authorized Next Step that
runs the template between "all gates green" and "stage Commit A".
Same closing discipline as WP-053.

---

## 10. Recommended Next Action

Before any WP-054 execution branch is cut:

1. ✅ **DONE** — A0 SPEC commit `f56a955` landed on `main` 2026-04-26
   containing the v1.3 bundle (WP-054 v1.3 + EC-054 v1.3 + this
   session-context file). Three files, single `SPEC:` commit, hooks
   clean, unrelated working-tree files held aside per P6-27.

2. ✅ **DONE 2026-04-26** — Pre-flight (`01.4`) re-run on the v1.3
   artifacts at `f56a955`. Verdict: **READY TO EXECUTE.** All four
   prior blockers closed; baseline confirmed (engine `522/116/0`,
   server `47/7/0` with 16 skipped); all dependencies green.

3. ✅ **DONE 2026-04-26** — Copilot check (`01.7`) re-run on the
   post-A0 artifacts at `f56a955`. Disposition: **CONFIRM**, 30/30
   PASS. Session prompt generation authorized.

4. **NEXT STEP** — Author the WP-054 session prompt at
   `docs/ai/invocations/session-wp054-public-leaderboards-read-only.md`
   citing the v1.3 A0 SPEC commit hash (`f56a955`), the locked test
   count (`55/8/0`), the `01.5 NOT INVOKED` declaration, and the
   pre-commit-review integration per §9.7. Land it as a separate
   `SPEC:` commit (or fold it into the same SPEC commit as a future
   minor session-context revision; either works).

5. Cut the WP-054 execution branch from `main` after the session
   prompt lands.

6. Resume the §8 step 5+ sequence (stash unrelated WIP, mirror WP-053
   patterns, run the pre-commit-review template, etc.).
