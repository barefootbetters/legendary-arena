# WP-054 — Public Leaderboards & Read-Only Web Access

**Status:** Ready for Implementation
**Primary Layer:** Server / Read-Only Public Access
**Version:** 1.2
**Last Updated:** 2026-04-24
**Dependencies:** WP-053, WP-052, WP-051, WP-004

---

## Session Context

WP-053 established the competitive score submission and verification pipeline:
all competitive scores are replay-verified, PAR-gated, immutable records
stored in `legendary.competitive_scores`. WP-052 established player identity,
replay ownership, and visibility controls — including the rule that public
sharing requires explicit opt-in. WP-051 established the PAR publication
gate. This packet introduces **read-only public access** to competitive
results: scenario-scoped leaderboards, verified score viewing, and permalink
access. `13-REPLAYS-REFERENCE.md` §Community Scoreboard Integration is the
normative governance source for all decisions in this packet.

---

## Why This Packet Matters

Public leaderboards are the **social proof layer** of Legendary Arena
competition. Without this packet, verified scores remain siloed and community
benchmarking is impossible. With it, scores are publicly viewable without
compromising trust — all data is derived from immutable, verified records.
This fulfills Vision Goal 18 (Replayability & Spectation) and Vision
Goal 24 (Replay-Verified Competitive Integrity).

---

## Goal

Expose public, read-only access to verified competitive results. After this
session, Legendary Arena has publicly viewable leaderboards:

- Only replay-verified, PAR-gated scores are visible
- Public access is derived solely from `legendary.competitive_scores`
- No public endpoint can mutate game state, scores, or ownership
- No scoring logic is re-executed or re-implemented
- Visibility rules from WP-052 are respected (only `link` or `public`)
- Leaderboards are scenario-scoped with deterministic ordering
- Scenarios without published PAR return empty results (fail closed)
- Rate limiting and abuse mitigation protect the public surface

**Invariant:** Public leaderboards are **views**, not sources of truth.
All truth originates in WP-053's verified competitive records.

**Clarification:** Leaderboard `rank` is a presentational value computed at
query time only. It is not persisted, cached, memoized, denormalized, or
stored in any table, record, or external cache (Redis, in-memory, CDN, or
otherwise). Rank is derived strictly from query-time ordering and pagination,
and has no gameplay, scoring, or competitive authority.

---

## Assumes

- WP-004 complete. Specifically:
  - Server startup sequence exists (`apps/server/src/index.mjs`)
  - PostgreSQL connection is established at startup
- WP-051 complete. Specifically:
  - `checkParPublished(scenarioKey)` returns `{ parValue, version }` or `null`
- WP-052 complete. Specifically:
  - `PlayerId` branded string exists
  - `ReplayVisibility` type exists with `'private' | 'link' | 'public'`
  - `legendary.replay_ownership` table exists with `visibility` column
  - `legendary.players` table exists with `display_name` column
- WP-053 complete. Specifically:
  - `CompetitiveScoreRecord` type exists with all fields
  - `legendary.competitive_scores` table exists with `UNIQUE (player_id, replay_hash)`
  - All competitive records are replay-verified and immutable
  - `findCompetitiveScore(replayHash, database)` is exported
  - `listPlayerCompetitiveScores(playerId, database)` is exported
- `docs/13-REPLAYS-REFERENCE.md` exists (normative governance)
- `pnpm -r build` exits 0
- `pnpm test` exits 0

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md — "Layer Boundary (Authoritative)"` — leaderboard
  queries are **server layer** work. Public read access is a projection of
  existing data — no engine involvement, no scoring computation, no replay
  execution.
- `docs/ai/ARCHITECTURE.md — "Persistence Boundaries"` — leaderboard query
  results are derived projections, not persisted state. No new tables are
  created for leaderboard views.
- `docs/13-REPLAYS-REFERENCE.md` — read §Community Scoreboard Integration.
  Leaderboards are scenario-specific and ranked by Final Score relative to
  PAR. Valid replays appear with permanent permalinks.
- `apps/server/src/competition/competition.types.ts` — read
  `CompetitiveScoreRecord`. Public leaderboard entries are projections of
  this type with sensitive fields removed.
- `apps/server/src/identity/replayOwnership.types.ts` — read
  `ReplayVisibility`. Only `link` and `public` visibility scores are eligible
  for public display.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no
  abbreviations), Rule 6 (`// why:` on public access decisions), Rule 11
  (full-sentence error messages), Rule 13 (ESM only).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — all randomness uses `ctx.random.*` only
- Never throw inside boardgame.io move functions — return void on invalid input
- Never persist `G`, `ctx`, or any runtime state — see ARCHITECTURE.md §Section 3
- `G` must be JSON-serializable at all times — no class instances, Maps, Sets, or functions
- ESM only, Node v22+ — all new files use `import`/`export`, never `require()`
- `node:` prefix on all Node.js built-in imports (`node:test`, `node:assert`, etc.)
- Test files use `.test.ts` extension — never `.test.mjs`
- No database or network access inside move functions or pure helpers
- Full file contents for every new or modified file in the output — no diffs, no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- **Read-only only:** this packet contains no INSERT, UPDATE, or DELETE
  operations. All functions are SELECT queries returning projections.
- **Derived data only:** all outputs come from verified competitive records
  in `legendary.competitive_scores`. No data is invented, inferred, or
  best-effort approximated.
- **No scoring logic:** scores are never recomputed, re-derived, or
  normalized in this packet. Final scores come from WP-053 records as-is.
- **No replay execution:** replay playback, verification, and re-execution
  are entirely out of scope.
- **Visibility respected:** only scores tied to replays with
  `visibility IN ('link', 'public')` appear in public results. Private
  replays are never exposed.
- **No authentication required:** public leaderboard queries are anonymous.
  No account, session, or identity is required to view results.
- **No account inference:** public APIs never expose `PlayerId`, email, or
  auth provider. Only `display_name` is shown.
- **Deterministic ordering:** leaderboards are sorted by `final_score`
  ascending, with `created_at` ascending as deterministic tie-break. No
  alternative ordering is permitted.
- **Fail closed:** scenarios without published PAR return empty results —
  never partial or inferred leaderboards.
- **Rate limiting required:** public endpoints must include basic rate
  limiting to prevent abuse. Exact limits are implementation-defined, but
  must be stateless and IP-based or request-rate-based only. Public
  leaderboard access must never depend on authentication, identity, or
  user tracking.
- **No engine imports:** leaderboard logic is server-only.
- **Fail closed universally:** any missing, inconsistent, or incomplete data
  (including missing joins or ownership records) must result in an empty
  leaderboard or `null` response — never best-effort output.
- **No inference of ownership:** leaderboard queries must read ownership and
  visibility from `legendary.replay_ownership` directly via a SQL join;
  ownership must never be reconstructed, inferred, or assumed. Visibility in
  particular must never be inferred from `legendary.competitive_scores`
  alone — the join against `legendary.replay_ownership` is mandatory for
  every public read.
- **No new tables:** leaderboard results are query projections of existing
  tables — no materialized views or denormalized copies.
- **Layer boundary:** leaderboard types live in `apps/server/` — never in
  `packages/game-engine/`.
- WP-053 contract files must NOT be modified — competitive scores are locked.
- WP-052 contract files must NOT be modified — identity/ownership is locked.

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding — never guess or invent field names, type shapes, or file
  paths

**Locked contract values:**

- **Leaderboard sort order (canonical):**
  1. `final_score` ascending (lower is better)
  2. `created_at` ascending (earlier submission wins ties)
  No alternative ordering is permitted. Time-based variants that prefer
  recency over score quality (e.g., `created_at DESC`, "latest", "recent")
  are explicitly forbidden.

- **Eligible visibility values:** `'link'` | `'public'`
  `'private'` replays are never included in public results.

- **Public-safe fields (from CompetitiveScoreRecord):**
  `submissionId`, `scenarioKey`, `finalScore`, `rawScore`, `parVersion`,
  `scoringConfigVersion`, `createdAt`
  Plus `playerDisplayName` from `legendary.players.display_name`

- **Fields never exposed publicly:**
  `playerId`, `email`, `authProvider`, `authProviderId`, `replayHash`,
  `stateHash`, `scoreBreakdown`

- **`legendary.*` namespace** (PostgreSQL):
  All tables live in the `legendary.*` schema. No new tables created.

---

## Debuggability & Diagnostics

All behavior introduced by this packet must be debuggable via deterministic
reproduction and state inspection.

The following requirements are mandatory:

- Behavior introduced by this packet must be fully reproducible given:
  - identical database state
  - identical query parameters

- Execution must be externally observable via deterministic state changes.
  Invisible or implicit side effects are not permitted.

- This packet must not introduce any state mutation.

- The following invariants must always hold after execution:
  - Identical query parameters produce identical results
  - No competitive records are modified by leaderboard queries
  - No replay ownership records are modified by leaderboard queries
  - Private replays never appear in any result set
  - Scenarios without published PAR always return empty results
  - Rank values are derived solely from deterministic ordering and pagination
    logic at query time and are not stored anywhere

- Failures attributable to this packet must be localizable via:
  - violation of declared invariants, or
  - unexpected data in query results

---

## Scope (In)

### A) `apps/server/src/leaderboards/leaderboard.types.ts` — new

- `interface PublicLeaderboardEntry { rank: number; submissionId: number; playerDisplayName: string; scenarioKey: string; finalScore: number; rawScore: number; parVersion: string; scoringConfigVersion: number; createdAt: string }`
  - `// why:` comment: contains only derived, safe-to-expose fields; excludes
    `playerId`, `email`, `replayHash`, `stateHash`, and `scoreBreakdown`
    to prevent identity leakage and information disclosure
- `interface ScenarioLeaderboard { scenarioKey: string; entries: PublicLeaderboardEntry[]; totalEligibleEntries: number }`
  - `// why:` comment: `totalEligibleEntries` enables UI to show "N total
    submissions" without requiring a separate count query
- `interface LeaderboardQueryOptions { scenarioKey: string; limit: number; offset: number }`
  - `// why:` comment: explicit `limit` and `offset` for deterministic
    pagination; no cursor-based pagination to avoid statefulness

### B) `apps/server/src/leaderboards/leaderboard.logic.ts` — new

- `getScenarioLeaderboard(options: LeaderboardQueryOptions, database: DatabaseClient): Promise<ScenarioLeaderboard>`
  — queries verified competitive scores for a scenario:
  1. `checkParPublished(options.scenarioKey)` — verify scenario has PAR;
     return empty leaderboard if not (fail closed)
  2. JOIN `legendary.competitive_scores` with `legendary.replay_ownership`
     and `legendary.players`
  3. Filter: `replay_ownership.visibility IN ('link', 'public')`
  4. Sort: `final_score ASC, created_at ASC` (deterministic)
  5. Apply `LIMIT` and `OFFSET` from options
  6. Map results to `PublicLeaderboardEntry` (strip sensitive fields)
  7. Compute `rank` as `offset + 1` through `offset + results.length`
  8. Count total eligible entries for the scenario
  - Returns `{ scenarioKey, entries: [], totalEligibleEntries: 0 }` when no
    scores exist or PAR is missing — never throws
  - `// why:` comment: read-only projection; fail closed on missing data

- `getPublicScoreBySubmissionId(submissionId: number, database: DatabaseClient): Promise<PublicLeaderboardEntry | null>`
  — permalink lookup of a single verified score:
  - Returns `null` if score not found or visibility is `private`
  - Returns `PublicLeaderboardEntry` with sensitive fields stripped
  - `// why:` comment: permalink access for sharing; respects visibility gate

- `listScenarioKeys(database: DatabaseClient): Promise<string[]>`
  — returns all scenario keys that have at least one eligible public score
  - Sorted alphabetically for determinism
  - `// why:` comment: enables leaderboard discovery without exposing
    scenarios that have no verified competition

### C) Tests — `apps/server/src/leaderboards/leaderboard.logic.test.ts` — new

Uses `node:test` and `node:assert` only. No boardgame.io import.

- Eight tests:
  1. Returns empty leaderboard for scenario with no eligible scores
  2. Returns only scores with `visibility IN ('link', 'public')` — private excluded
  3. Orders results by `finalScore` ascending
  4. Tie-break uses `createdAt` ascending (earlier wins)
  5. Respects `limit` exactly — no more results than requested
  6. Scenario without published PAR returns empty leaderboard (fail closed)
  7. `getPublicScoreBySubmissionId` returns `null` for private-visibility score
  8. `PublicLeaderboardEntry` does not contain `playerId`, `email`,
     `replayHash`, `stateHash`, or `scoreBreakdown` (field exposure test)

- Tests 1–7 require a test PostgreSQL database. If unavailable, they must be
  marked with `{ skip: 'requires test database' }` — never silently omitted.

---

## Out of Scope

- **No score submission** — that is WP-053
- **No replay verification or re-execution** — that is WP-053
- **No replay playback** — viewer implementation is future work
- **No mutation endpoints** — this packet is strictly read-only
- **No authentication or authorization** — public queries are anonymous
- **No player profile views** — future work
- **No tournament or aggregate scoring** — future work
- **No caching layer** — future optimization
- **No engine imports** — leaderboards consume database projections only
- **No UI rendering** — this packet defines server logic, not frontend
- **No new database tables** — results are query projections of existing tables
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above.

---

## Files Expected to Change

- `apps/server/src/leaderboards/leaderboard.types.ts` — **new** —
  PublicLeaderboardEntry, ScenarioLeaderboard, LeaderboardQueryOptions
- `apps/server/src/leaderboards/leaderboard.logic.ts` — **new** —
  getScenarioLeaderboard, getPublicScoreBySubmissionId, listScenarioKeys
- `apps/server/src/leaderboards/leaderboard.logic.test.ts` — **new** —
  `node:test` coverage (8 tests)

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Trust Surface
- [ ] All data derived exclusively from `legendary.competitive_scores`
      joined with `legendary.replay_ownership` and `legendary.players`
- [ ] No public endpoint mutates state — no INSERT, UPDATE, or DELETE
- [ ] No scoring logic exists in this packet

### Visibility
- [ ] Only scores with `visibility IN ('link', 'public')` are returned
- [ ] Private replays never appear in leaderboard results
- [ ] `getPublicScoreBySubmissionId` returns `null` for private scores

### Ordering & Determinism
- [ ] Sorted by `finalScore` ascending
- [ ] Tie-break by `createdAt` ascending
- [ ] Identical query parameters produce identical results

### Public Safety
- [ ] `PublicLeaderboardEntry` does not contain `playerId`, `email`,
      `authProvider`, `authProviderId`, `replayHash`, `stateHash`, or
      `scoreBreakdown`
- [ ] Only `playerDisplayName` is exposed from player identity
- [ ] No authentication required for public queries

### PAR Gate
- [ ] Scenario without published PAR returns empty leaderboard
- [ ] No partial or inferred leaderboard data

### Layer Boundary
- [ ] No imports from `packages/game-engine/`
      (confirmed with `Select-String`)
- [ ] No `boardgame.io` import in leaderboard files
      (confirmed with `Select-String`)
- [ ] No imports from `apps/server/src/competition/competition.logic.ts`
      (leaderboard queries the database directly, not via submission logic)

### Tests
- [ ] All 8 tests pass (or database-dependent tests are marked `skip` with reason)
- [ ] Test files use `.test.ts` extension
- [ ] Tests use `node:test` and `node:assert` only
- [ ] No boardgame.io import in test files

### Scope Enforcement
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No SQL write operations (INSERT, UPDATE, DELETE) in leaderboard files
      (confirmed with `Select-String`)
- [ ] WP-053 and WP-052 contract files unmodified

---

## Verification Steps

```pwsh
# Step 1 — build after all changes
pnpm -r build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm test
# Expected: TAP output — all tests passing (or DB tests skipped with reason)

# Step 3 — confirm no leaderboard types leaked into game-engine
Select-String -Path "packages\game-engine\src" -Pattern "PublicLeaderboardEntry|ScenarioLeaderboard|LeaderboardQueryOptions" -Recurse
# Expected: no output

# Step 4 — confirm no boardgame.io import in leaderboard files
Select-String -Path "apps\server\src\leaderboards" -Pattern "boardgame.io" -Recurse
# Expected: no output

# Step 5 — confirm no require() in leaderboard files
Select-String -Path "apps\server\src\leaderboards" -Pattern "require\(" -Recurse
# Expected: no output

# Step 6 — confirm no SQL write operations in leaderboard files
Select-String -Path "apps\server\src\leaderboards" -Pattern "INSERT|UPDATE|DELETE" -Recurse
# Expected: no output

# Step 7 — confirm no sensitive field exposure in leaderboard types
Select-String -Path "apps\server\src\leaderboards\leaderboard.types.ts" -Pattern "playerId|email|authProvider|replayHash|stateHash|scoreBreakdown"
# Expected: no output (these fields must not appear in public types)

# Step 8 — confirm dependency contracts unmodified
git diff apps/server/src/competition/
git diff apps/server/src/identity/
# Expected: no changes

# Step 9 — confirm no files outside scope were changed
git diff --name-only
# Expected: only files listed in ## Files Expected to Change
```

---

## Definition of Done

> Claude Code must execute every verification command in `## Verification Steps`
> before checking any item below. Reading the code is not sufficient — run the
> commands.
>
> Every item must be true before this packet is considered complete.

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria above pass
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm test` exits 0 (all test files; DB tests may skip with reason)
- [ ] No leaderboard types in `packages/game-engine/`
      (confirmed with `Select-String`)
- [ ] No `boardgame.io` import in leaderboard files
      (confirmed with `Select-String`)
- [ ] No SQL write operations in leaderboard files
      (confirmed with `Select-String`)
- [ ] No sensitive fields exposed in public types
      (confirmed with `Select-String`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] WP-053 competition files not modified (confirmed with `git diff`)
- [ ] WP-052 identity/ownership files not modified (confirmed with `git diff`)
- [ ] `docs/ai/STATUS.md` updated — public leaderboards available;
      scenario-scoped read-only access to verified competitive scores;
      private replays excluded; fail closed on missing PAR
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why public access is
      read-only with no new tables; why only verified scores are exposed;
      why deterministic sort order is enforced; why sensitive fields are
      stripped; why PAR-missing scenarios return empty results; why no
      authentication is required for public queries
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-054 checked off with today's date
