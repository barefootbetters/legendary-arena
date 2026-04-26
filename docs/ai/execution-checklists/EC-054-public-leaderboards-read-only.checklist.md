# EC-054 — Public Leaderboards & Read-Only Web Access (Execution Checklist)

**Source:** docs/ai/work-packets/WP-054-public-leaderboards-read-only.md (v1.3)
**Layer:** Server / Read-Only Public Access

**Execution Authority:**
This EC is the authoritative execution checklist for WP-054.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-054.

---

## Before Starting

- [ ] WP-004 complete: server startup sequence exists (`apps/server/src/index.mjs`)
- [ ] WP-051 complete: `checkParPublished(simulationIndex, seedIndex, scenarioKey)` exists at `apps/server/src/par/parGate.mjs:83` and `createParGate(...)` returns a gate object whose `.checkParPublished(scenarioKey)` is the bound 1-arg form WP-054 consumes via `LeaderboardDependencies`
- [ ] WP-053a complete: `ParGateHit` has shape `{ parValue, parVersion, source, scoringConfig }` per **D-5306 Option A** (verify-grep: `Select-String -Path apps\server\src\par\parGate.mjs -Pattern scoringConfig` returns ≥3 matches)
- [ ] WP-052 complete: identity + replay ownership exist; `AccountId` (NOT `PlayerId`) per **D-5201**; `ReplayVisibility` type with `'private' | 'link' | 'public'`; `legendary.players.display_name text NOT NULL`; verify-grep: `Select-String -Path apps\server\src\identity\identity.types.ts -Pattern "AccountId"` returns matches AND `Select-String -Path apps\server\src\identity\identity.types.ts -Pattern "\bPlayerId\b"` returns no matches
- [ ] WP-053 complete: verified competitive records exist in `legendary.competitive_scores`; `CompetitiveScoreRecord.accountId: AccountId` (NOT `playerId: PlayerId`) at `apps/server/src/competition/competition.types.ts:140-152`
- [ ] `docs/13-REPLAYS-REFERENCE.md` §Community Scoreboard Integration read in full
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm test` exits 0 — engine `522/116/0`, server `47/7/0` (with 16 skipped if no test DB)

---

## Locked Values (do not re-derive)

All items below must match WP-054 §Locked contract values verbatim.

- Read-only only: no INSERT, UPDATE, or DELETE in this packet
- Derived data only: output is a projection of verified competitive records
- Eligible visibility: `'link' | 'public'` — `'private'` replays never included
- Sort order: `final_score ASC, created_at ASC` — no alternative ordering permitted; time-based variants (DESC, "latest", "recent") explicitly forbidden
- **Public-safe fields (8 + 1 derived):** `replayHash`, `scenarioKey`, `finalScore`, `rawScore`, `parVersion`, `scoringConfigVersion`, `createdAt`, `playerDisplayName` + presentational `rank`
- **Never-expose fields (7):** `submissionId` (sequence-attack surface), `accountId` (D-5201 identity-correlation handle), `email`, `authProvider`, `authProviderId`, `stateHash` (equals `replayHash` by construction; defensive omission), `scoreBreakdown` (owner-only)
- **Permalink key:** `replayHash` (cryptographic SHA-256, unguessable) — never `submissionId` (sequential `bigserial`, enables enumeration)
- PAR missing → empty results (fail closed, never partial or inferred)
- `rank` is presentational only — computed at query time, never persisted, cached, or stored in any table or record
- `LeaderboardDependencies.checkParPublished` is the bound 1-arg form `(scenarioKey: string) => ParGateHit | null` injected via the `deps` parameter; mirrors WP-053's `SubmissionDependencies` pattern

---

## Guardrails

- Public leaderboard logic is strictly read-only (SELECT queries only)
- Public leaderboards are views — truth originates in WP-053 verified records
- No engine runtime imports in leaderboard code; type-only `import type { ScenarioScoringConfig } from '@legendary-arena/game-engine'` is the **only** permitted engine reference (mirrors WP-053 `competition.types.ts` precedent)
- No imports from WP-053 submission logic — leaderboards query the database directly
- No new tables, materialized views, denormalized copies, indexes, or caches
- Fail closed universally: missing, inconsistent, or incomplete data → empty result or null
- Visibility enforced by reading `legendary.replay_ownership` directly via `INNER JOIN` — never inferred or assumed
- Display-name handling: use `INNER JOIN` against `legendary.players`; an entry without a display name is structurally impossible (`display_name text NOT NULL` per `004_create_players_table.sql:30`), but the `INNER JOIN` is the load-bearing read-side guard. **Fallbacks (`"Anonymous"`, `accountId`-derived placeholders, hashed handles, `LEFT JOIN ... COALESCE`) are not permitted** — the `INNER JOIN` excludes any row where the join fails, fail-closed by construction
- Deterministic ordering explicit in both code and SQL
- No authentication required for public viewing; no account inference
- `totalEligibleEntries` must be computed using the **same** visibility, scenario, and PAR constraints as the paginated query — no approximations, no `COUNT(*)` over an unfiltered universe
- Permalink lookup uses `replayHash` only — `getPublicScoreByReplayHash(replayHash, db)`, never a `getPublicScoreBySubmissionId` variant
- WP-051, WP-052, WP-053, WP-053a contract files must not be modified
- **Lifecycle prohibition:** none of the three helpers are called from `game.ts`, phase hooks, `server.mjs`, `index.mjs`, `apps/arena-client/`, `apps/replay-producer/`, `apps/registry-viewer/`, or any `packages/**` package — mirrors WP-053's lock
- **No transport, no middleware, no rate limiting:** the future request-handler WP owns HTTP exposure, CORS, content-type negotiation, and stateless IP-based rate limiting. WP-054 ships as a library surface only — `Select-String` for `express|fastify|middleware|rate-?limit|throttle` returns no matches

---

## Required `// why:` Comments

- `PublicLeaderboardEntry`: only safe-to-expose fields; sensitive fields excluded to prevent identity leakage; lists the 7 never-expose names verbatim
- `PublicLeaderboardEntry.replayHash`: cryptographic permalink key; unguessable; consistent with the visibility model (any replay whose hash is exposed has been opted into `link` or `public`)
- `ScenarioLeaderboard.totalEligibleEntries`: enables UI count without separate query
- `ScenarioLeaderboard.entries`: marked `readonly`; freshly constructed array of fresh literals on every call; no aliasing with internal cache, request-scoped buffer, or query result row (mirrors `apps/server/src/par/parGate.mjs:92-106` aliasing guard)
- `LeaderboardDependencies`: dependency injection seam; production callers pass bound `createParGate(...).checkParPublished`; tests pass inline stubs; mirrors WP-053 `SubmissionDependencies`
- Sort order: `final_score ASC, created_at ASC` is canonical and non-negotiable
- Visibility filter: `visibility IN ('link', 'public')` required; `private` excluded
- PAR check: missing PAR means empty public results, not best-effort
- `rank` computation: derived at query time only, not persisted; reflects **global** ordering within eligible results (`offset + i + 1`), never the index within the returned page
- `getPublicScoreByReplayHash`: permalink access for sharing; respects visibility gate; uses `replayHash` (cryptographic) rather than `submissionId` (sequential, enumerable) — cites the WP-052 UUID-v4 enumeration-attack rationale at `apps/server/src/identity/identity.types.ts:40` as precedent
- Display-name `INNER JOIN`: defense-in-depth read-side guard; the schema's `display_name text NOT NULL` makes the missing-name state structurally impossible, but the `INNER JOIN` is the load-bearing safety constraint, not the schema (mirrors the WP-053 layered-defense pattern at `competition.logic.ts` step 12 / D-5306 Option A)

---

## Files to Produce

- `apps/server/src/leaderboards/leaderboard.types.ts` — **new** — `PublicLeaderboardEntry`, `ScenarioLeaderboard`, `LeaderboardQueryOptions`, `LeaderboardDependencies`
- `apps/server/src/leaderboards/leaderboard.logic.ts` — **new** — `getScenarioLeaderboard`, `getPublicScoreByReplayHash`, `listScenarioKeys`, `PRODUCTION_DEPENDENCIES`
- `apps/server/src/leaderboards/leaderboard.logic.test.ts` — **new** — 9 tests in one `describe('leaderboard logic (WP-054)', …)` block (1 logic-pure + 8 DB-dependent)

---

## After Completing

- [ ] `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/server test` exits 0 — server baseline `47/7/0` → **`55/8/0`** (+8 tests / +1 suite); when no test DB: pass=48, skip=23 (10 inherited + 6 WP-053 + 7 of WP-054's 8 DB tests)
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 — engine baseline `522/116/0` unchanged
- [ ] No leaderboard types in `packages/game-engine/src/`; no `boardgame.io` runtime import, no `require()`, no SQL writes in `apps/server/src/leaderboards/` (Select-String confirms all)
- [ ] Type-only `import type { ScenarioScoringConfig }` from `@legendary-arena/game-engine` is the only engine reference (Select-String for `from .['"]@legendary-arena/game-engine` returns matches only on `import type` lines)
- [ ] No never-expose fields (`submissionId`, `accountId`, `email`, `authProvider`, `stateHash`, `scoreBreakdown`) appear in public types (Select-String confirms)
- [ ] No stale `playerId` references (D-5201): `Select-String -Path apps\server\src\leaderboards -Pattern "\bplayerId\b" -Recurse` returns no matches
- [ ] Drift-detection test #9 passes: `Object.keys(entry).sort()` equals `['createdAt','finalScore','parVersion','playerDisplayName','rank','rawScore','replayHash','scenarioKey','scoringConfigVersion']` exactly (9 keys)
- [ ] Deterministic `ORDER BY final_score ASC, created_at ASC` present; visibility filter `IN ('link', 'public')` present; `INNER JOIN` (not `LEFT JOIN`) on every join
- [ ] No transport / middleware / rate-limiting dependencies: `Select-String -Path apps\server\src\leaderboards -Pattern "express|fastify|middleware|rate-?limit|throttle" -Recurse` returns no matches
- [ ] `getPublicScoreByReplayHash` accepts `replayHash: string`; no `getPublicScoreBySubmissionId` variant exists in any file under `apps/server/src/leaderboards/`
- [ ] No imports from `apps/server/src/competition/competition.logic.ts` in leaderboard code (`Select-String -Pattern "from .['\"].*competition\\.logic"` over `apps/server/src/leaderboards/`)
- [ ] WP-051, WP-052, WP-053, WP-053a contract files unmodified; no files outside scope changed (`git diff` confirms)
- [ ] `STATUS.md` updated; `DECISIONS.md` updated (read-only access, verified-only scores, deterministic ordering, sensitive field stripping, PAR-empty fail-closed, no auth for public, `replayHash` permalink rationale, rate-limiting deferral); `WORK_INDEX.md` WP-054 checked off; `EC_INDEX.md` EC-054 row added

---

## Common Failure Smells

- INSERT/UPDATE/DELETE in leaderboard code → read-only contract violated
- Public response contains any of the 7 never-expose fields (`submissionId`, `accountId`, `email`, `authProvider`, `authProviderId`, `stateHash`, `scoreBreakdown`) → data leak / D-5201 violation. `replayHash` is intentionally public-safe per §Locked Values (cryptographic permalink key) and is NOT in the never-expose set.
- Code references `playerId` or `record.playerId` in TS/JS (the SQL column `legendary.competitive_scores.player_id` lives in the JOIN clause only — any TS identifier `playerId` is stale post-D-5201)
- `getPublicScoreBySubmissionId` exists or `submissionId` appears in any URL-shaped string literal → sequence-attack surface; use `replayHash` permalinks
- `checkParPublished` consumed via direct module import rather than `deps.checkParPublished` injection → bypasses WP-053 dependency seam pattern; tests cannot stub PAR outcomes
- `checkParPublished` called with the wrong arity (1-arg bare module call instead of bound 1-arg gate call, or 3-arg call without index objects) → `parGate.mjs:83` is 3-arg (`simulationIndex, seedIndex, scenarioKey`); the 1-arg form lives only on `createParGate(...)` return
- `ParGateHit` destructured as `{ parValue, version }` instead of `{ parValue, parVersion, source, scoringConfig }` → stale pre-WP-053a shape; D-5306 Option A
- Ordering differs from `final_score ASC, created_at ASC` → determinism violated
- Private replays appear in results → visibility gate missing or wrong join
- Scenario returns results without published PAR → fail-closed violated
- Leaderboard code imports scoring weights or WP-053 submission logic → authority/layering violation
- `ORDER BY final_score` without secondary `created_at ASC` → nondeterministic ordering under ties
- Ownership or visibility inferred without joining `legendary.replay_ownership` → trust boundary violation
- `LEFT JOIN ... COALESCE(display_name, 'Anonymous')` or any display-name fallback → identity-inference loophole; use `INNER JOIN` (which fail-closes by construction)
- `totalEligibleEntries` does not match the visibility / PAR-filtered universe of entries (e.g., uses an unfiltered `COUNT(*)` while `entries[]` is filtered) → pagination integrity violation
- `rank` computed as the page-local index rather than the global position (`offset + i + 1`) → ranks become misleading on every page after the first
- Drift-detection test #9 absent or asserts a stale key set → contract enforcement gap
- `entries[]` returned as a direct reference to a query-result array or held buffer → aliasing risk; consumers can mutate state through the projection
- HTTP / middleware / rate-limiting dependency in leaderboard code → lifecycle prohibition violated; defer to future request-handler WP
- Engine runtime import (anything from `@legendary-arena/game-engine` other than `import type { ScenarioScoringConfig }`) → layer boundary violation
