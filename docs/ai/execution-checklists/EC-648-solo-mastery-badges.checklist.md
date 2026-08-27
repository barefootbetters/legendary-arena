# EC-648 — Solo Mastery Badges (Execution Checklist)

**Source:** docs/ai/work-packets/WP-613-solo-mastery-badges.md
**Layer:** Server (`apps/server/src/badges/**` + the competition issuance caller)

## Before Starting
- [ ] WP-105 on `origin/main`: `badge.{types,predicates,veteran,issuance}.ts` +
      migration 013; `TIER_1_BADGE_KEYS` (7) drift-pinned in `badge.predicates.test.ts`.
- [ ] `issueTier1BadgesForSubmission(playerId, scoreId, breakdown, scenarioKey,
      configVersion, database)` called from `competition.logic.ts` in-transaction;
      `evaluatePerRunBadges(breakdown)` pure; `evaluateHistoryBadges` runs
      `COUNT(DISTINCT scenario_key) WHERE player_id=$1 AND final_score<0`.
- [ ] `competitive_scores.player_count` (D-24134) + `CompetitiveScoreRecord.playerCount` exist.
- [ ] Fresh worktree off `origin/main` (`3143b8b8`); baseline clean; capture the SHA.
- [ ] Scope lock — EXACTLY 7 code files (5 src + 2 test) per the WP. Any edit
      outside → STOP. (STATUS/DECISIONS/WORK_INDEX/mindmap = the separate SPEC commit.)
- [ ] Read D-1004 (anti-volume / no-PvP / append-only) + the legendary-server + legendary-persistence skills.
- [ ] `pnpm -r build` 0; server suite green (DB suites at `--test-concurrency=1`).

## Locked Values (do not re-derive)
- Keys: `gameplay.solo.lone-defender` (per-run, `competitive_score`),
  `gameplay.solo.solitaire-master` (history, `competitive_history`).
- `lone-defender` ⇔ `playerCount === 1 && breakdown.finalScore < 0`.
- `solitaire-master` ⇔ `COUNT(DISTINCT scenario_key WHERE final_score < 0 AND player_count = 1) >= 5`.
- `SOLITAIRE_MASTER_THRESHOLD = 5` (mirrors `MULTIVERSE_MASTERY_THRESHOLD`).
- Labels: "Lone Defender" / "Solitaire Master". `TIER_1_BADGE_KEYS` 7 → 9.

## Guardrails
- **Anti-volume (D-1004 / §25):** quality-gated (`lone-defender`) + breadth-gated
  (`solitaire-master`, distinct scenarios). NEVER a count of solo games played.
- **No-PvP framing (§23b):** solo = alone vs the mastermind. No head-to-head copy.
- **`playerCount === 1` is solo;** `null` is NOT solo (per-run predicate false; the
  history query filters `player_count = 1`).
- **Append-only, reuse the existing INSERT** + `ON CONFLICT DO NOTHING`. No UPDATE,
  no new table, no `/badges/*` route, no `tier IN (2,3)`.
- **Layer purity:** `badge.predicates.ts` keeps its type-only game-engine import;
  SQL stays in the server; no runtime engine/registry/preplan/boardgame.io import.
- **Drift pin:** `TIER_1_BADGE_KEYS` and `BADGE_DEFINITIONS` move together; the
  exact-count drift test updates 7 → 9.
- **`// why:` comments** on the `null`-count-is-not-solo choice and the solo query filter.

## Files to Produce
- `apps/server/src/badges/badge.types.ts` — **modified** — 2 keys + definitions; 7 → 9
- `apps/server/src/badges/badge.predicates.ts` — **modified** — `isEligibleLoneDefender` + `evaluatePerRunBadges(breakdown, playerCount)`
- `apps/server/src/badges/badge.veteran.ts` — **modified** — solo breadth query + threshold
- `apps/server/src/badges/badge.issuance.ts` — **modified** — thread `playerCount`
- `apps/server/src/competition/competition.logic.ts` — **modified** — pass `playerCount`
- `apps/server/src/badges/badge.predicates.test.ts` — **modified** — solo per-run + drift 7 → 9
- `apps/server/src/badges/badge.veteran.test.ts` — **modified** — solo breadth boundary

## After Completing
- [ ] `pnpm -r build` 0; server suite green (incl. the new solo tests; DB suites serialized).
- [ ] `TIER_1_BADGE_KEYS` = 9; drift test passes; `BADGE_DEFINITIONS` in lockstep.
- [ ] **Live-on-surface (D-24026):** a solo sub-PAR run's profile shows "Lone
      Defender"; 5 distinct solo sub-PAR scenarios shows "Solitaire Master".
- [ ] `git diff --name-only` — the `EC-648:` implementation commit is only the 7 files.
- [ ] STATUS.md updated; DECISIONS.md D-24424 Active; WORK_INDEX WP-613 `[x]`;
      mindmap `📝` → `✅` + `pnpm roadmap:counts:write`.

## Common Failure Smells (Optional)
- Solo badge fires for a multi-player run → the predicate didn't gate `playerCount === 1`.
- `solitaire-master` advanced by a full-table run → the query is missing `player_count = 1`.
- Drift test red → `TIER_1_BADGE_KEYS` / `BADGE_DEFINITIONS` / the count assertion diverged.
- An 8th file in the diff → scope breach (or you re-cataloged an endpoint that doesn't exist).
- A `null` player_count awarded a solo badge → the not-solo guard is missing.
