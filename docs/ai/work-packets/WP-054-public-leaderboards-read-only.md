# WP-054 — Public Leaderboards & Read-Only Web Access

**Status:** Ready for Implementation
**Primary Layer:** Server / Read-Only Public Access
**Version:** 1.3
**Last Updated:** 2026-04-26
**Dependencies:** WP-053, WP-053a, WP-052, WP-051, WP-103, WP-004

---

## Session Context

WP-053 (Done 2026-04-26 at `56e8134`) established the competitive score
submission and verification pipeline: all competitive scores are
replay-verified, PAR-gated, immutable records stored in
`legendary.competitive_scores`. WP-052 (Done 2026-04-25 at `fd769f1`)
established player identity (`AccountId` per **D-5201**, NOT `PlayerId`),
replay ownership, and visibility controls — including the rule that
public sharing requires explicit opt-in. WP-053a (Done 2026-04-25 at
`e5b9d15`) extended the PAR gate to carry `scoringConfig` per **D-5306
Option A**, changing `checkParPublished`'s return shape to
`{ parValue, parVersion, source, scoringConfig }`. WP-051 established
the PAR publication gate. WP-103 (Done 2026-04-25 at `fe7db3e`)
established server-side replay storage; this packet does not consume it
directly (read-only leaderboards have no use for the replay blob).

This packet introduces **read-only public access** to competitive
results: scenario-scoped leaderboards, verified score viewing, and
permalink access via `replayHash`. `13-REPLAYS-REFERENCE.md` §Community
Scoreboard Integration is the normative governance source for all
decisions in this packet.

---

## Why This Packet Matters

Public leaderboards are the **social proof layer** of Legendary Arena
competition. Without this packet, verified scores remain siloed and
community benchmarking is impossible. With it, scores are publicly
viewable without compromising trust — all data is derived from
immutable, verified records. This fulfills Vision Goal 23 (Competitive
Leaderboards & Submission), Vision Goal 18 (Replayability &
Spectation), and Vision Goal 24 (Replay-Verified Competitive
Integrity).

---

## Vision Alignment

> Required by `00.3 §17.1` — this WP touches scoring/leaderboards
> (Vision §20-26, §22, §23, §24), replays/replay verification
> (§18, §22, §24), and player identity/visibility (§3, §11). This
> block is the lint gate; the §Vision Sanity Check at pre-flight time
> verifies it against the implementation plan.

**Vision clauses touched:**
`§3 (Player Trust & Fairness), §11 (Stateless Client Philosophy),
§18 (Replayability & Spectation), §20 (PAR-Based Scenario Scoring),
§22 (Deterministic & Reproducible Evaluation), §23 (Competitive
Leaderboards & Submission), §24 (Replay-Verified Competitive
Integrity)`

**Conflict assertion:** No conflict — this WP preserves all touched
clauses. Public leaderboards are projections of WP-053's verified,
replay-anchored, PAR-gated records; no scoring logic is duplicated; no
identity correlation surface is introduced; sort order is deterministic
and replay-faithful.

**Non-Goal proximity (NG-1..7):** none crossed. There is no monetization
surface (NG-1, NG-2, NG-3, NG-7), no gameplay-affecting affordance
(NG-1), no time-pressure or FOMO mechanic (NG-4), no advertising
(NG-5), no dark-pattern UX (NG-6). The only public surface is a
read-only projection of already-eligible (`link` / `public`
visibility) verified records.

**Determinism preservation:** identical query parameters produce
identical results (sort order `final_score ASC, created_at ASC` is
total under `UNIQUE (player_id, replay_hash)`); no caching, no
memoization, no time-windowed aggregation; the public surface is
a pure deterministic view over the source of truth.

**Funding Surface Gate (`00.3 §20`):** **N/A — this WP introduces no
payment, donation, subscription, supporter-tier, or tournament-funding
surface.** Per `01-VISION.md §Financial Sustainability`, monetization
must never alter competitive integrity; this WP is read-only over a
non-monetized competitive surface and cannot be a monetization vector
by construction.

---

## Goal

Expose public, read-only access to verified competitive results. After
this session, Legendary Arena has publicly viewable leaderboards:

- Only replay-verified, PAR-gated scores are visible
- Public access is derived solely from `legendary.competitive_scores`
- No public function can mutate game state, scores, or ownership
- No scoring logic is re-executed or re-implemented
- Visibility rules from WP-052 are respected (only `link` or `public`)
- Leaderboards are scenario-scoped with deterministic ordering
- Scenarios without published PAR return empty results (fail closed)
- Permalinks are keyed on `replayHash` (cryptographic, unguessable)
  — never on `submissionId` (sequence-attack surface)

**Invariant:** Public leaderboards are **views**, not sources of truth.
All truth originates in WP-053's verified competitive records.

**Clarification:** Leaderboard `rank` is a presentational value computed
at query time only. It is not persisted, cached, memoized,
denormalized, or stored in any table, record, or external cache (Redis,
in-memory, CDN, or otherwise). Rank is derived strictly from query-time
ordering and pagination, and has no gameplay, scoring, or competitive
authority.

---

## Lifecycle Prohibition (Locked)

> Mirrors WP-053's lifecycle prohibition pattern — same rationale.

None of the three leaderboard helpers
(`getScenarioLeaderboard`, `getPublicScoreByReplayHash`,
`listScenarioKeys`) are called from `apps/server/src/index.mjs`,
`apps/server/src/server.mjs`, `packages/game-engine/**` (`game.ts`,
phase hooks, moves), `apps/arena-client/**`, `apps/replay-producer/**`,
`apps/registry-viewer/**`, or any package boundary in this packet's
scope. The future request-handler WP that publishes these helpers as
HTTP endpoints will own:

- Rate limiting (stateless, IP-based middleware) — explicitly
  **deferred** out of WP-054 per pre-flight SR-1 disposition
- Bound `parGate` injection from server startup
- HTTP serialization, content-type negotiation, and CORS
- Cache-control headers (the helpers themselves never cache)

Until that wiring lands, the helpers exist as a library surface only —
unit-tested and importable, but not network-reachable. This is the same
shape WP-053 locked for `submitCompetitiveScore` ([EC_INDEX.md row for
EC-053](../execution-checklists/EC_INDEX.md)).

---

## Assumes

- WP-004 complete. Specifically:
  - Server startup sequence exists (`apps/server/src/index.mjs`)
  - PostgreSQL connection is established at startup
- WP-051 complete. Specifically:
  - `checkParPublished(simulationIndex, seedIndex, scenarioKey)` is
    the bare module export at `apps/server/src/par/parGate.mjs`; the
    1-arg curried form `(scenarioKey) => ParGateHit | null` lives on
    the gate object returned by `createParGate(basePath, parVersion)`.
    `getScenarioLeaderboard` consumes the bound 1-arg form via a
    `LeaderboardDependencies` injection seam (mirrors WP-053's
    `SubmissionDependencies` pattern at
    `apps/server/src/competition/competition.logic.ts:103-160`).
- WP-053a complete. Specifically:
  - `ParGateHit` returns `{ parValue: number; parVersion: string;
    source: 'simulation' | 'seed'; scoringConfig: ScenarioScoringConfig }`
    on hit; `null` on miss. WP-054 reads only `parValue` (presence
    check); the wider shape is inert here. Per **D-5306 Option A**.
- WP-052 complete. Specifically:
  - `AccountId` branded string exists (`apps/server/src/identity/identity.types.ts:47`).
    Per **D-5201**, the server-side identity is `AccountId`, NOT
    `PlayerId`; the engine `PlayerId` (D-8701) is a deliberately
    distinct plain string in a different layer and must never be
    imported into `apps/server/`.
  - `ReplayVisibility` type exists with `'private' | 'link' | 'public'`
    (`apps/server/src/identity/replayOwnership.types.ts:29`)
  - `legendary.replay_ownership` table exists with `visibility` column
    defaulting to `'private'`
  - `legendary.players` table exists with `display_name text NOT NULL`
- WP-053 complete. Specifically:
  - `CompetitiveScoreRecord` type exists with **11 readonly fields**;
    the owner field is `accountId: AccountId` (NOT `playerId`).
    Reference: `apps/server/src/competition/competition.types.ts:140-152`.
  - `legendary.competitive_scores` table exists with
    `UNIQUE (player_id, replay_hash)` and `submission_id bigserial PRIMARY KEY`
  - All competitive records are replay-verified and immutable
  - `findCompetitiveScore(replayHash, database)` is exported
    (`apps/server/src/competition/competition.logic.ts:294`)
  - `listPlayerCompetitiveScores(accountId, database)` is exported
    (`apps/server/src/competition/competition.logic.ts:321`) — note
    parameter is `accountId`, not `playerId`
  - `DatabaseClient = pg.Pool` is re-exported by
    `apps/server/src/competition/competition.types.ts:40` and originates
    in `apps/server/src/identity/identity.types.ts:33`
- `docs/13-REPLAYS-REFERENCE.md` exists (normative governance)
- `pnpm -r build` exits 0
- `pnpm test` exits 0 with the post-WP-053 baselines (engine `522/116/0`,
  server `47/7/0` with 16 skipped if no test DB)

If any of the above is false, this packet is **BLOCKED** and must not
proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md — "Layer Boundary (Authoritative)"` —
  leaderboard queries are **server layer** work. Public read access is
  a projection of existing data — no engine involvement, no scoring
  computation, no replay execution.
- `docs/ai/ARCHITECTURE.md — "Persistence Boundaries"` — leaderboard
  query results are derived projections, not persisted state. No new
  tables are created for leaderboard views.
- `docs/13-REPLAYS-REFERENCE.md` — read §Community Scoreboard
  Integration. Leaderboards are scenario-specific and ranked by Final
  Score relative to PAR. Valid replays appear with permanent
  permalinks (keyed on `replayHash`).
- `apps/server/src/competition/competition.types.ts` — read
  `CompetitiveScoreRecord`. Public leaderboard entries are projections
  of this type with sensitive fields removed. Owner field is
  `accountId: AccountId` — never `playerId`.
- `apps/server/src/competition/competition.logic.ts` — read the
  `SubmissionDependencies` injection seam (lines 103-160) as the
  template for `LeaderboardDependencies`.
- `apps/server/src/identity/replayOwnership.types.ts` — read
  `ReplayVisibility`. Only `link` and `public` visibility scores are
  eligible for public display.
- `apps/server/src/identity/identity.types.ts` — read `AccountId`,
  `DatabaseClient` (re-exported `pg.Pool`).
- `apps/server/src/par/parGate.mjs` — read the JSDoc typedef
  `ParGateHit` (lines 32-47) and the `ParGate` interface (lines 49-59)
  to confirm the bound 1-arg curry that `LeaderboardDependencies`
  injects.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no
  abbreviations), Rule 6 (`// why:` on public access decisions), Rule
  11 (full-sentence error messages), Rule 13 (ESM only).
- `docs/ai/DECISIONS.md` — D-5201 (server identity is `AccountId`),
  D-5306 Option A (`scoringConfig` flows from PAR artifact), D-8701
  (engine `PlayerId` is plain string — distinct from server
  `AccountId`).

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
- **Derived data only:** all outputs come from verified competitive
  records in `legendary.competitive_scores`. No data is invented,
  inferred, or best-effort approximated.
- **No scoring logic:** scores are never recomputed, re-derived, or
  normalized in this packet. Final scores come from WP-053 records as-is.
- **No replay execution:** replay playback, verification, and
  re-execution are entirely out of scope.
- **Visibility respected:** only scores tied to replays with
  `visibility IN ('link', 'public')` appear in public results. Private
  replays are never exposed.
- **No authentication required:** public leaderboard queries are
  anonymous. No account, session, or identity is required to view
  results.
- **No account inference:** public APIs never expose `AccountId`
  (D-5201), `submission_id` (sequence-attack surface), email, auth
  provider, or any identity-correlation handle. Only `playerDisplayName`
  is shown.
- **Permalinks use `replayHash`:** the cryptographic state hash
  (SHA-256 from WP-027's `computeStateHash`) is the public natural
  key for single-score lookup. `submissionId` is internal-only —
  exposing it via URL would leak total submission count and enable
  enumeration (parallels the WP-052 UUID-v4 rationale at
  `apps/server/src/identity/identity.types.ts:40`).
- **Deterministic ordering:** leaderboards are sorted by `final_score`
  ascending, with `created_at` ascending as deterministic tie-break. No
  alternative ordering is permitted.
- **Fail closed:** scenarios without published PAR return empty results
  — never partial or inferred leaderboards.
- **No engine imports:** leaderboard logic is server-only.
- **Fail closed universally:** any missing, inconsistent, or
  incomplete data (including missing joins, missing ownership records,
  missing display name) must result in an empty leaderboard or `null`
  response — never best-effort output.
- **No inference of ownership:** leaderboard queries must read
  ownership and visibility from `legendary.replay_ownership` directly
  via a SQL join; ownership must never be reconstructed, inferred, or
  assumed. Visibility in particular must never be inferred from
  `legendary.competitive_scores` alone — the join against
  `legendary.replay_ownership` is mandatory for every public read.
- **No new tables:** leaderboard results are query projections of
  existing tables — no materialized views or denormalized copies, no
  new indexes (index optimization deferred to a future tuning WP).
- **Layer boundary:** leaderboard types live in `apps/server/` — never
  in `packages/game-engine/`.
- **No projection aliasing:** every returned array on
  `ScenarioLeaderboard.entries[]` is a freshly constructed array of
  freshly constructed `PublicLeaderboardEntry` literals — no shared
  reference with any internal cache, request-scoped buffer, or query
  result row. This is structurally true by construction (rows are
  mapped one-by-one) but called out explicitly per pre-flight Risk
  R-5 / copilot finding #17.
- WP-053 contract files must NOT be modified — competitive scores are locked.
- WP-053a contract files must NOT be modified — PAR artifact shape is locked.
- WP-052 contract files must NOT be modified — identity/ownership is locked.
- WP-051 contract files must NOT be modified — PAR gate shape is locked.

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask
  the human before proceeding — never guess or invent field names,
  type shapes, or file paths.

**Locked contract values:**

- **Leaderboard sort order (canonical):**
  1. `final_score` ascending (lower is better)
  2. `created_at` ascending (earlier submission wins ties)
  No alternative ordering is permitted. Time-based variants that
  prefer recency over score quality (e.g., `created_at DESC`,
  "latest", "recent") are explicitly forbidden.

- **Eligible visibility values:** `'link'` | `'public'`
  `'private'` replays are never included in public results.

- **Public-safe fields (8 from CompetitiveScoreRecord + 1 derived):**
  `replayHash`, `scenarioKey`, `finalScore`, `rawScore`, `parVersion`,
  `scoringConfigVersion`, `createdAt`, plus `playerDisplayName` from
  `legendary.players.display_name`. Plus presentational `rank` (not
  from the source record).

- **Fields never exposed publicly (7):**
  `submissionId` (sequence-attack surface), `accountId` (identity
  correlation handle, D-5201), `email`, `authProvider`,
  `authProviderId`, `stateHash` (equals `replayHash` by construction
  per WP-053 §step-9; defensive omission), `scoreBreakdown` (full
  scoring breakdown is owner-only).

- **`legendary.*` namespace** (PostgreSQL):
  All tables live in the `legendary.*` schema. No new tables created.

---

## Debuggability & Diagnostics

All behavior introduced by this packet must be debuggable via
deterministic reproduction and state inspection.

The following requirements are mandatory:

- Behavior introduced by this packet must be fully reproducible given:
  - identical database state
  - identical query parameters
  - identical injected `parGate` (deterministic for a given startup
    state)

- Execution must be externally observable via deterministic state
  changes. Invisible or implicit side effects are not permitted.

- This packet must not introduce any state mutation.

- The following invariants must always hold after execution:
  - Identical query parameters produce identical results
  - No competitive records are modified by leaderboard queries
  - No replay ownership records are modified by leaderboard queries
  - Private replays never appear in any result set
  - Scenarios without published PAR always return empty results
  - Rank values are derived solely from deterministic ordering and
    pagination logic at query time and are not stored anywhere

- Failures attributable to this packet must be localizable via:
  - violation of declared invariants, or
  - unexpected data in query results

---

## Scope (In)

### A) `apps/server/src/leaderboards/leaderboard.types.ts` — new

- `interface PublicLeaderboardEntry { rank: number; replayHash: string; playerDisplayName: string; scenarioKey: string; finalScore: number; rawScore: number; parVersion: string; scoringConfigVersion: number; createdAt: string }`
  - `// why:` comment: contains only derived, safe-to-expose fields;
    excludes `submissionId` (sequence-attack surface), `accountId`
    (D-5201 identity-correlation handle), `email`, `authProvider`,
    `authProviderId`, `stateHash`, and `scoreBreakdown` to prevent
    identity leakage and information disclosure
  - `// why:` comment on `replayHash` field: cryptographic permalink
    key — unguessable, deterministic, and consistent with the
    visibility model (any replay whose hash is exposed has already
    been opted into `link` or `public` visibility)
- `interface ScenarioLeaderboard { scenarioKey: string; entries: readonly PublicLeaderboardEntry[]; totalEligibleEntries: number }`
  - `// why:` comment: `totalEligibleEntries` enables UI to show "N
    total submissions" without requiring a separate count query
  - `// why:` comment on `entries`: marked `readonly` — every call
    returns a freshly constructed array of fresh literals; no
    aliasing with any internal cache, request-scoped buffer, or
    query result row (per pre-flight Risk R-5 / copilot finding #17,
    mirrors `apps/server/src/par/parGate.mjs:92-106` aliasing guard)
- `interface LeaderboardQueryOptions { scenarioKey: string; limit: number; offset: number }`
  - `// why:` comment: explicit `limit` and `offset` for deterministic
    pagination; no cursor-based pagination to avoid statefulness
- `interface LeaderboardDependencies { checkParPublished: (scenarioKey: string) => ParGateHit | null }`
  - `// why:` comment: dependency injection seam — production callers
    pass the bound 1-arg form from `createParGate(...)`; tests pass
    in-line stubs. Mirrors WP-053's `SubmissionDependencies` at
    `apps/server/src/competition/competition.logic.ts:103-160`
  - Local re-statement of `ParGateHit` shape (mirrors
    `apps/server/src/competition/competition.logic.ts:103-108`):
    `{ readonly parValue: number; readonly parVersion: string; readonly source: 'simulation' | 'seed'; readonly scoringConfig: ScenarioScoringConfig }`.
    `ScenarioScoringConfig` imported as type-only from
    `@legendary-arena/game-engine`.

### B) `apps/server/src/leaderboards/leaderboard.logic.ts` — new

- `getScenarioLeaderboard(options: LeaderboardQueryOptions, database: DatabaseClient, deps?: LeaderboardDependencies): Promise<ScenarioLeaderboard>`
  — queries verified competitive scores for a scenario:
  1. Default `deps` to a `PRODUCTION_DEPENDENCIES` constant that
     fail-closes (`checkParPublished: () => null`) — same fail-closed
     default as WP-053's `PRODUCTION_DEPENDENCIES`. Production wiring
     supplies the real bound gate via the future request-handler WP.
  2. `deps.checkParPublished(options.scenarioKey)` — verify scenario
     has PAR; return empty leaderboard if `null` (fail closed)
  3. JOIN `legendary.competitive_scores` with `legendary.replay_ownership`
     and `legendary.players` (`INNER JOIN` on every join — no `LEFT
     JOIN`; missing rows mean fail-closed exclusion, not substitution)
  4. Filter: `replay_ownership.visibility IN ('link', 'public')`
  5. Sort: `final_score ASC, created_at ASC` (deterministic)
  6. Apply `LIMIT` and `OFFSET` from options
  7. Map results to fresh `PublicLeaderboardEntry` literals (strip
     sensitive fields; one fresh literal per row)
  8. Compute `rank` as `offset + i + 1` for each entry (global
     position within eligible results, NOT page-local index)
  9. Count total eligible entries for the scenario using the **same**
     visibility, scenario, and PAR constraints as the paginated query
     (no unfiltered `COUNT(*)`)
  - Returns `{ scenarioKey, entries: [], totalEligibleEntries: 0 }`
    when no scores exist or PAR is missing — never throws
  - `// why:` comment: read-only projection; fail closed on missing
    data; defense-in-depth `INNER JOIN` ensures missing display name
    or missing ownership row excludes the entry rather than
    substituting a placeholder (the schema makes both states
    structurally impossible — `display_name text NOT NULL` and
    application-layer ownership requirement — but the read-side
    `INNER JOIN` is the load-bearing safety guard, not the schema
    constraint)

- `getPublicScoreByReplayHash(replayHash: string, database: DatabaseClient): Promise<PublicLeaderboardEntry | null>`
  — permalink lookup of a single verified score by cryptographic
  state hash:
  - Returns `null` if score not found, ownership row missing,
    visibility is `'private'`, or display name missing
  - Returns `PublicLeaderboardEntry` with sensitive fields stripped
    and `rank: 0` (rank is meaningless for a single-score lookup —
    the field exists for type uniformity; consumers ignore it)
  - `// why:` comment: permalink access for sharing; respects
    visibility gate; uses `replayHash` (cryptographic, unguessable)
    rather than `submissionId` (sequence-attack surface)

- `listScenarioKeys(database: DatabaseClient): Promise<string[]>`
  — returns all scenario keys that have at least one eligible public
  score (visibility filter applied — does NOT depend on
  `checkParPublished`, which is per-scenario; the future request
  handler may filter further at presentation time)
  - Sorted alphabetically for determinism
  - `// why:` comment: enables leaderboard discovery without exposing
    scenarios that have no verified competition

### C) Tests — `apps/server/src/leaderboards/leaderboard.logic.test.ts` — new

Uses `node:test` and `node:assert` only. No boardgame.io import.

All 9 tests live in **one** `describe('leaderboard logic (WP-054)', ...)`
block (mirrors WP-053's wrap-in-describe convention; +1 suite delta).

- Nine tests:
  1. Returns empty leaderboard for scenario with no eligible scores
  2. Returns only scores with `visibility IN ('link', 'public')` —
     private excluded
  3. Orders results by `finalScore` ascending
  4. Tie-break uses `createdAt` ascending (earlier wins)
  5. Respects `limit` exactly — no more results than requested;
     `rank` values reflect global position (`offset + i + 1`), not
     page-local index
  6. Scenario without published PAR returns empty leaderboard (fail
     closed) — `deps.checkParPublished` returns `null`
  7. `getPublicScoreByReplayHash` returns `null` for
     private-visibility score
  8. `PublicLeaderboardEntry` field-exposure assertion: the entry
     contains exactly the 9 public-safe keys and **none** of the 7
     never-expose keys (`submissionId`, `accountId`, `email`,
     `authProvider`, `authProviderId`, `stateHash`, `scoreBreakdown`).
     `replayHash` IS present (it is public-safe per §Locked contract
     values; the v1.2 inclusion of `replayHash` in the never-expose
     list was corrected in v1.3 per pre-flight SR-2 disposition).
  9. **Drift detection (logic-pure, runs without DB):**
     `Object.keys(entry).sort()` MUST equal
     `['createdAt','finalScore','parVersion','playerDisplayName',
     'rank','rawScore','replayHash','scenarioKey','scoringConfigVersion']`
     — exactly 9 keys; mirrors the WP-053
     `CompetitiveScoreRecord` 11-key drift assertion at
     `apps/server/src/competition/competition.types.ts:117-120`.
     This test is the contract-enforcement guarantee that future
     field additions cannot silently slip through (per copilot
     finding #11)

- Tests 1–8 require a test PostgreSQL database. If unavailable, they
  must be marked with the locked WP-052 §3.1 inline conditional skip
  pattern: `hasTestDatabase ? {} : { skip: 'requires test database' }`
  — never silently omitted. Test 9 is logic-pure (constructs an entry
  literal and asserts the key set) and runs without DB.

---

## Out of Scope

- **No score submission** — that is WP-053
- **No replay verification or re-execution** — that is WP-053
- **No replay playback** — viewer implementation is future work
- **No mutation paths** — this packet is strictly read-only
- **No authentication or authorization** — public queries are anonymous
- **No player profile views** — future work (WP-102 draft, see
  `docs/ai/work-packets/WORK_INDEX.md`)
- **No tournament or aggregate scoring** — future work
- **No caching layer** — future optimization
- **No engine imports** — leaderboards consume database projections only
- **No UI rendering** — this packet defines server logic, not frontend
- **No new database tables** — results are query projections of
  existing tables
- **No new indexes** — index tuning for `(scenario_key, final_score,
  created_at)` deferred to a future performance WP per pre-flight Risk
  R-8
- **No HTTP endpoints, no rate limiting, no middleware** — the future
  request-handler WP owns the public surface and its rate-limiting,
  CORS, and content-type negotiation. WP-054 ships as a library
  surface only (per §Lifecycle Prohibition above).
- Refactors, cleanups, or "while I'm here" improvements are **out of
  scope** unless explicitly listed in Scope (In) above.

---

## Files Expected to Change

- `apps/server/src/leaderboards/leaderboard.types.ts` — **new** —
  `PublicLeaderboardEntry`, `ScenarioLeaderboard`,
  `LeaderboardQueryOptions`, `LeaderboardDependencies`
- `apps/server/src/leaderboards/leaderboard.logic.ts` — **new** —
  `getScenarioLeaderboard`, `getPublicScoreByReplayHash`,
  `listScenarioKeys`, `PRODUCTION_DEPENDENCIES`
- `apps/server/src/leaderboards/leaderboard.logic.test.ts` — **new** —
  `node:test` coverage (9 tests, 1 logic-pure + 8 DB-dependent)

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Trust Surface
- [ ] All data derived exclusively from `legendary.competitive_scores`
      joined with `legendary.replay_ownership` and `legendary.players`
      via `INNER JOIN` (no `LEFT JOIN`)
- [ ] No public function mutates state — no INSERT, UPDATE, or DELETE
- [ ] No scoring logic exists in this packet

### Visibility
- [ ] Only scores with `visibility IN ('link', 'public')` are returned
- [ ] Private replays never appear in leaderboard results
- [ ] `getPublicScoreByReplayHash` returns `null` for private scores

### Ordering & Determinism
- [ ] Sorted by `finalScore` ascending
- [ ] Tie-break by `createdAt` ascending
- [ ] Identical query parameters produce identical results
- [ ] `rank` reflects global position (`offset + i + 1`), not
      page-local index

### Public Safety
- [ ] `PublicLeaderboardEntry` does not contain `submissionId`,
      `accountId`, `email`, `authProvider`, `authProviderId`,
      `stateHash`, or `scoreBreakdown`
- [ ] `Object.keys(entry).sort()` equals the locked 9-key set
      (drift-detection test #9)
- [ ] Only `playerDisplayName` is exposed from player identity
- [ ] Permalinks use `replayHash` (cryptographic) — never
      `submissionId` (sequential)
- [ ] No authentication required for public queries

### PAR Gate
- [ ] Scenario without published PAR returns empty leaderboard
- [ ] No partial or inferred leaderboard data
- [ ] `checkParPublished` is consumed via injected `deps`, not via
      direct module import

### Lifecycle Prohibition
- [ ] None of the three helpers are called from `game.ts`, phase
      hooks, `server.mjs`, `index.mjs`, `apps/arena-client/`,
      `apps/replay-producer/`, `apps/registry-viewer/`, or any
      `packages/**` package (mirrors WP-053 lock)

### Layer Boundary
- [ ] No imports from `packages/game-engine/` runtime code; type-only
      `import type { ScenarioScoringConfig }` from
      `@legendary-arena/game-engine` is permitted (mirrors WP-053
      `competition.types.ts` precedent)
- [ ] No `boardgame.io` import in leaderboard files
- [ ] No imports from `apps/server/src/competition/competition.logic.ts`
      (leaderboard queries the database directly, not via submission
      logic)

### Tests
- [ ] All 9 tests pass (test 9 logic-pure; tests 1-8 marked
      `{ skip: 'requires test database' }` when no DB)
- [ ] Test files use `.test.ts` extension
- [ ] Tests use `node:test` and `node:assert` only
- [ ] No boardgame.io import in test files
- [ ] All 9 tests live inside one `describe('leaderboard logic (WP-054)', …)`
      block (server baseline `47/7/0` → `55/8/0`; +8 tests / +1 suite)

### Aliasing
- [ ] `ScenarioLeaderboard.entries` is a freshly constructed array
      of freshly constructed `PublicLeaderboardEntry` literals — no
      shared reference with any internal cache or query result row
- [ ] `entries` typed as `readonly PublicLeaderboardEntry[]`

### Scope Enforcement
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] No `require()` in any generated file
- [ ] No SQL write operations (INSERT, UPDATE, DELETE) in leaderboard files
- [ ] No HTTP, middleware, rate-limiting, or transport concerns in
      leaderboard files (confirmed by absence of `express`, `fastify`,
      `http`, `request`, `response`, `middleware` imports)
- [ ] WP-053 / WP-053a / WP-052 / WP-051 contract files unmodified

---

## Verification Steps

```pwsh
# Step 1 — build after all changes
pnpm -r build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm --filter "@legendary-arena/server" test
pnpm --filter "@legendary-arena/game-engine" test
# Expected: server 55/8/0 (with 7 of 8 DB-tests skipped → pass=48, skip=23
# when no test DB); engine 522/116/0 unchanged

# Step 3 — confirm no leaderboard types leaked into game-engine
Select-String -Path "packages\game-engine\src" -Pattern "PublicLeaderboardEntry|ScenarioLeaderboard|LeaderboardQueryOptions|LeaderboardDependencies" -Recurse
# Expected: no output

# Step 4 — confirm no boardgame.io import in leaderboard files
Select-String -Path "apps\server\src\leaderboards" -Pattern "from .['\"]boardgame\.io" -Recurse
# Expected: no output

# Step 5 — confirm no require() in leaderboard files
Select-String -Path "apps\server\src\leaderboards" -Pattern "require\(" -Recurse
# Expected: no output

# Step 6 — confirm no SQL write operations in leaderboard files
Select-String -Path "apps\server\src\leaderboards" -Pattern "INSERT |UPDATE |DELETE " -Recurse
# Expected: no output

# Step 7 — confirm no never-expose field exposure in leaderboard types
Select-String -Path "apps\server\src\leaderboards\leaderboard.types.ts" -Pattern "submissionId|accountId|email|authProvider|stateHash|scoreBreakdown"
# Expected: no output (these fields must not appear in public types)

# Step 7b — confirm no stale `playerId` references (D-5201 enforcement)
Select-String -Path "apps\server\src\leaderboards" -Pattern "\bplayerId\b" -Recurse
# Expected: no output (server identity is AccountId per D-5201; the SQL
# column `player_id` lives in the JOIN clause, not in identifier names —
# any TS or JS `playerId` usage is stale drift and a contract violation)

# Step 8 — confirm no transport / middleware / rate-limiting deps
Select-String -Path "apps\server\src\leaderboards" -Pattern "express|fastify|middleware|rate-?limit|throttle" -Recurse
# Expected: no output (per Lifecycle Prohibition — transport is the
# future request-handler WP's responsibility)

# Step 9 — confirm no import from competition.logic.ts (leaderboard
# queries the database directly, not via submission logic)
Select-String -Path "apps\server\src\leaderboards" -Pattern "from .['\"].*competition\.logic" -Recurse
# Expected: no output

# Step 10 — confirm dependency contracts unmodified
git diff apps/server/src/competition/
git diff apps/server/src/identity/
git diff apps/server/src/par/
# Expected: no changes

# Step 11 — confirm no files outside scope were changed
git diff --name-only
# Expected: only files listed in ## Files Expected to Change
```

---

## Definition of Done

> Claude Code must execute every verification command in
> `## Verification Steps` before checking any item below. Reading the
> code is not sufficient — run the commands.
>
> Every item must be true before this packet is considered complete.

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria above pass
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/server test` exits 0
      (server baseline `47/7/0` → `55/8/0`; with 7 of the 8 DB tests
      marked skip if no test DB → pass=48, skip=23)
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
      (engine baseline `522/116/0` unchanged)
- [ ] No leaderboard types in `packages/game-engine/`
- [ ] No `boardgame.io` runtime import in leaderboard files (type-only
      `ScenarioScoringConfig` import permitted; engine type-only
      mirroring WP-053 precedent)
- [ ] No SQL write operations in leaderboard files
- [ ] No never-expose fields exposed in public types
- [ ] No stale `playerId` references (D-5201 enforcement)
- [ ] No transport / middleware / rate-limiting dependencies
- [ ] No `require()` in any generated file
- [ ] No files outside `## Files Expected to Change` were modified
- [ ] WP-053 / WP-053a / WP-052 / WP-051 contract files not modified
- [ ] `docs/ai/STATUS.md` updated — public leaderboards available
      (library surface only; HTTP wiring deferred); scenario-scoped
      read-only access to verified competitive scores; private replays
      excluded; fail closed on missing PAR; permalinks keyed on
      `replayHash`
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why public access
      is read-only with no new tables; why only verified scores are
      exposed; why deterministic sort order is enforced; why sensitive
      fields are stripped; why PAR-missing scenarios return empty
      results; why no authentication is required for public queries;
      why permalinks use `replayHash` not `submissionId`; why rate
      limiting is deferred to the future request-handler WP
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-054 checked off with
      today's date
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` has an EC-054 row
      added at governance close
