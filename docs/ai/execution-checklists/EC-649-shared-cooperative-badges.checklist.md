# EC-649 — Shared Cooperative Badges (Execution Checklist)

**Source:** docs/ai/work-packets/WP-614-shared-cooperative-badges.md
**Layer:** Server (`apps/server/src/badges/**` + the competition issuance caller)

## Before Starting
- [ ] WP-105 + WP-613 on `origin/main`: `badge.{types,predicates,veteran,issuance}.ts`;
      `issueTier1BadgesForSubmission(...)` called from `competition.logic.ts`
      in-transaction, fire-and-forget; `TIER_1_BADGE_KEYS` = 9 (drift-pinned).
- [ ] `competitive_scores.{replay_hash, player_count, final_score, player_id}` exist;
      migration 013 `source_kind` allows `'competitive_history'` (NO migration needed).
- [ ] All co-op players share `replay_hash` (WP-338 server-derived); `CompetitiveScoreRecord.{replayHash, playerCount}` present.
- [ ] Fresh worktree off `origin/main` (`444341d7`); baseline clean; capture the SHA.
- [ ] Scope lock — EXACTLY 5 code files (2 new + 3 modified) per the WP. Any edit
      outside → STOP. (STATUS/DECISIONS/WORK_INDEX/mindmap = the separate SPEC commit.)
- [ ] Read D-1004 + the legendary-server + legendary-persistence skills.
- [ ] `pnpm -r build` 0; server suite green (DB suites `--test-concurrency=1`).

## Locked Values (do not re-derive)
- Key: `gameplay.shared.united-front`; label "United Front"; `sourceKind 'competitive_history'`; `source_ref` NULL.
- Qualify ⇔ `playerCount >= 2 && rows.length === playerCount && every(final_score < 0)`.
- Group query: `SELECT player_id, final_score FROM legendary.competitive_scores WHERE replay_hash = $1`.
- New function: `issueSharedMatchBadges(replayHash, playerCount, configVersion, database)` in `badge.shared.ts`.

## Guardrails
- **Shared, ungameable:** `playerCount >= 2` AND EVERY group row sub-PAR. Solo/1-player never qualifies.
- **Anti-volume / no-PvP / append-only (D-1004):** quality-gated; cooperative framing (table vs mastermind); reuse the existing multi-row INSERT + `ON CONFLICT DO NOTHING`; `source_kind 'competitive_history'`, `source_ref NULL`. NO migration, no new source_kind, no route, no `tier IN (2,3)`.
- **Last-submitter-awards-all:** evaluate the group on every submission; INSERT for ALL group player_ids only when complete + qualifying. Incomplete → no-op. Idempotent via `ON CONFLICT`.
- **Projection over immutable rows (D-5302):** read `competitive_scores` only; no replay re-exec, no score recompute; no state-hash surface.
- **Fire-and-forget:** call inside the caller's existing try/catch — a failure warns, never fails the submission.
- **Layer purity:** no runtime engine/`boardgame.io`/registry/preplan import; SQL server-side.
- **Drift:** `TIER_1_BADGE_KEYS` 9 → 10 with `BADGE_DEFINITIONS`; update the exact-count pin.
- **`// why:`** on the replay_hash-grouping choice + the completeness gate + the multi-player award.

## Files to Produce
- `apps/server/src/badges/badge.types.ts` — **modified** — key + definition; 9 → 10
- `apps/server/src/badges/badge.shared.ts` — **new** — `issueSharedMatchBadges`
- `apps/server/src/competition/competition.logic.ts` — **modified** — call the shared issuer (fire-and-forget)
- `apps/server/src/badges/badge.shared.test.ts` — **new** — group evaluation + multi-player award (mock DB)
- `apps/server/src/badges/badge.predicates.test.ts` — **modified** — drift 9 → 10

## After Completing
- [ ] `pnpm -r build` 0; server suite green (incl. the shared-badge tests; DB suites serialized).
- [ ] `TIER_1_BADGE_KEYS` = 10; drift test passes; `BADGE_DEFINITIONS` in lockstep.
- [ ] **Live-on-surface (D-24026):** a 2-player all-sub-PAR match shows "United Front" on both profiles.
- [ ] `git diff --name-only` — the `EC-649:` implementation commit is only the 5 files.
- [ ] STATUS.md updated; DECISIONS.md D-24425 Active; WORK_INDEX WP-614 `[x]`;
      mindmap `📝` → `✅` + `pnpm roadmap:counts:write`.

## Common Failure Smells (Optional)
- Badge fires on an incomplete group → missing the `rows.length === playerCount` gate.
- Badge fires solo → missing the `playerCount >= 2` gate.
- Only the submitter gets it → the INSERT didn't iterate all group player_ids.
- Duplicate-row error → you didn't reuse `ON CONFLICT DO NOTHING`.
- A migration in the diff → you added a source_kind instead of reusing `competitive_history`.
- Drift red → `TIER_1_BADGE_KEYS` / `BADGE_DEFINITIONS` / the count assertion diverged.
