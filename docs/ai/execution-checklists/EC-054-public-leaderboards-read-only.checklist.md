# EC-054 — Public Leaderboards & Read-Only Web Access (Execution Checklist)

**Source:** docs/ai/work-packets/WP-054-public-leaderboards-read-only.md
**Layer:** Server / Read-Only Public Access

**Execution Authority:**
This EC is the authoritative execution checklist for WP-054.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-054.

---

## Before Starting

- [ ] WP-004 complete: server startup sequence exists (`apps/server/src/index.mjs`)
- [ ] WP-051 complete: `checkParPublished(scenarioKey)` exists and fails closed
- [ ] WP-052 complete: identity + replay ownership exist; `ReplayVisibility` type with `'private' | 'link' | 'public'`
- [ ] WP-053 complete: verified competitive records exist in `legendary.competitive_scores`
- [ ] `docs/13-REPLAYS-REFERENCE.md` §Community Scoreboard Integration read in full
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm test` exits 0

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-054.

- Read-only only: no INSERT, UPDATE, or DELETE in this packet
- Derived data only: output is a projection of verified competitive records
- Eligible visibility: `'link' | 'public'` — `'private'` replays never included
- Sort order: `final_score ASC, created_at ASC` — no alternative ordering permitted; time-based variants (DESC, "latest", "recent") explicitly forbidden
- Public-safe fields: `submissionId`, `scenarioKey`, `finalScore`, `rawScore`, `parVersion`, `scoringConfigVersion`, `createdAt`, `playerDisplayName`
- Never-expose fields: `playerId`, `email`, `authProvider`, `authProviderId`, `replayHash`, `stateHash`, `scoreBreakdown`
- PAR missing → empty results (fail closed, never partial or inferred)
- Rate limiting: stateless, IP/request-rate based only; never depends on authentication or identity
- `rank` is presentational only — computed at query time, never persisted, cached, or stored in any table or record

---

## Guardrails

- Public leaderboard logic is strictly read-only (SELECT queries only)
- Public leaderboards are views — truth originates in WP-053 verified records
- No engine imports in leaderboard code
- No imports from WP-053 submission logic — leaderboards query the database directly
- No new tables, materialized views, denormalized copies, or caches
- Fail closed universally: missing, inconsistent, or incomplete data → empty result or null
- Visibility enforced by reading `legendary.replay_ownership` directly — never inferred or assumed
- Deterministic ordering explicit in both code and SQL
- No authentication required for public viewing; no account inference
- `totalEligibleEntries` must be computed using the **same** visibility, scenario, and PAR constraints as the paginated query — no approximations, no `COUNT(*)` over an unfiltered universe
- Player display names come directly from `legendary.players.display_name`. Fallbacks (`"Anonymous"`, `playerId`-derived placeholders, hashed handles) are not permitted; an entry without a display name fails closed (excluded from results) rather than rendering a substitute
- WP-051, WP-052, WP-053 contract files must not be modified

---

## Required `// why:` Comments

- `PublicLeaderboardEntry`: only safe-to-expose fields; sensitive fields excluded to prevent identity leakage
- `ScenarioLeaderboard.totalEligibleEntries`: enables UI count without separate query
- Sort order: `final_score ASC, created_at ASC` is canonical and non-negotiable
- Visibility filter: `visibility IN ('link', 'public')` required; `private` excluded
- PAR check: missing PAR means empty public results, not best-effort
- `rank` computation: derived at query time only, not persisted; reflects **global** ordering within eligible results (i.e., `offset + i + 1`), never the index within the returned page
- `getPublicScoreBySubmissionId`: permalink access for sharing; respects visibility gate

---

## Files to Produce

- `apps/server/src/leaderboards/leaderboard.types.ts` — **new** — PublicLeaderboardEntry, ScenarioLeaderboard, LeaderboardQueryOptions
- `apps/server/src/leaderboards/leaderboard.logic.ts` — **new** — getScenarioLeaderboard, getPublicScoreBySubmissionId, listScenarioKeys
- `apps/server/src/leaderboards/leaderboard.logic.test.ts` — **new** — 8 tests

---

## After Completing

- [ ] `pnpm -r build` exits 0
- [ ] `pnpm test` exits 0 (DB tests may skip with reason)
- [ ] No leaderboard types in `packages/game-engine/src/`; no `boardgame.io`, `require()`, or SQL writes in `apps/server/src/leaderboards/` (Select-String confirms all)
- [ ] No sensitive fields (`playerId`, `email`, `replayHash`, `stateHash`, `scoreBreakdown`) in public types (Select-String confirms)
- [ ] Deterministic `ORDER BY final_score ASC, created_at ASC` present; visibility filter `IN ('link', 'public')` present
- [ ] Rate limiting is observable in code (explicit middleware or query guard) and stateless (no auth/identity dependency); a TODO comment, placeholder, or "to be added later" note does not satisfy this requirement
- [ ] No imports from `apps/server/src/competition/competition.logic.ts` in leaderboard code (confirmed with `Select-String "from .*competition\\.logic"` over `apps/server/src/leaderboards/`)
- [ ] WP-051, WP-052, WP-053 contract files unmodified; no files outside scope changed (`git diff` confirms)
- [ ] `STATUS.md` updated; `DECISIONS.md` updated (read-only access, verified-only scores, deterministic ordering, sensitive field stripping, PAR-empty fail-closed, no auth for public); `WORK_INDEX.md` WP-054 checked off

---

## Common Failure Smells

- INSERT/UPDATE/DELETE in leaderboard code → read-only contract violated
- Public response contains `playerId`, `email`, `replayHash`, `stateHash`, or `scoreBreakdown` → data leak
- Ordering differs from `final_score ASC, created_at ASC` → determinism violated
- Private replays appear in results → visibility gate missing or wrong join
- Scenario returns results without published PAR → fail-closed violated
- Leaderboard code imports scoring weights or WP-053 submission logic → authority/layering violation
- `ORDER BY final_score` without secondary `created_at ASC` → nondeterministic ordering under ties
- Ownership or visibility inferred without joining `legendary.replay_ownership` → trust boundary violation
- `totalEligibleEntries` does not match the visibility / PAR-filtered universe of entries (e.g., uses an unfiltered `COUNT(*)` while `entries[]` is filtered) → pagination integrity violation
- `rank` computed as the page-local index rather than the global position (`offset + i + 1`) → ranks become misleading on every page after the first
- Player display name rendered as `"Anonymous"`, a `playerId`-derived placeholder, or any other fallback when `legendary.players.display_name` is missing → identity-inference loophole; entries without a display name must fail closed instead
