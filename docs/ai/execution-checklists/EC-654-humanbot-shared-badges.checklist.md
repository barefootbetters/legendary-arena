# EC-654 — Human+Bot Matches Earn Shared Badges (Execution Checklist)

**Source:** docs/ai/work-packets/WP-619-humanbot-shared-badges.md
**Layer:** Server (`apps/server/src/badges/**` + the competition issuance caller)

## Before Starting
- [ ] WP-614/615 on `origin/main`: `issueSharedMatchBadges(replayHash, playerCount,
      configVersion, database)` gates on `rows.length === playerCount`; awards
      united-front (+ trio/quartet/quintet by `playerCount`) to the group.
- [ ] WP-617 on `origin/main`: the by-matchId caller reads the roster
      (`readSeatAccounts(matchId)` → `[{playerId: seat, accountId}]`) and threads
      `submitterSeatId` via `SubmissionDependencies`.
- [ ] Fresh worktree off `origin/main`; baseline clean; capture the SHA.
- [ ] Scope lock — EXACTLY 3 code files: `badge.shared.ts`, `competition.logic.ts`,
      `badge.shared.test.ts`. Any edit outside → STOP.
- [ ] `pnpm -r build` 0; server suite green.

## Locked Values (do not re-derive)
- New param `humanSeatCount: number | null` on `issueSharedMatchBadges` (last position).
- Completeness gate: `rows.length === (humanSeatCount ?? playerCount)`.
- `humanSeatCount = roster.length` (authenticated seats), reusing the WP-617 roster read.

## Guardrails
- **Only the completeness gate changes.** `playerCount >= 2` (table size incl bots)
  stays; the tiers still key on `playerCount`; the all-sub-PAR check + the multi-row
  INSERT + `ON CONFLICT DO NOTHING` are unchanged.
- **Reuse the WP-617 roster read** — derive `humanSeatCount = roster.length` from the
  same `readSeatAccounts` call; do NOT add a second roster read.
- **Fail-safe.** A roster read error → `humanSeatCount = null` → the gate falls back
  to `playerCount` (the by-hash path too). Never fails the submission (fire-and-forget).
- **No migration, no new source_kind, no route.** Read-only over immutable rows; no hash surface.
- **`// why:`** on the human-vs-total-seat completeness rule.

## Files to Produce
- `apps/server/src/badges/badge.shared.ts` — **modified** — `humanSeatCount` param + gate
- `apps/server/src/competition/competition.logic.ts` — **modified** — derive + thread `humanSeatCount`
- `apps/server/src/badges/badge.shared.test.ts` — **modified** — human+bot completeness cases

## After Completing
- [ ] `pnpm -r build` 0; server suite green (incl. the human+bot tests).
- [ ] **Live-on-surface (D-24026):** a human+bot co-op sub-PAR win earns the human United Front (and the size tier).
- [ ] `git diff --name-only` — the `EC-654:` implementation commit is only the 3 files.
- [ ] STATUS.md updated; DECISIONS.md D-24430 Active; WORK_INDEX WP-619 `[x]`;
      mindmap `📝` → `✅` + `pnpm roadmap:counts:write`.

## Common Failure Smells (Optional)
- A 2-human match awards on one submission → the gate used `humanSeatCount` wrong (it must be the human count, not 1).
- A solo (playerCount 1) match awards → the `< 2` table guard was removed.
- A second roster read added → reuse the WP-617 one.
- A migration in the diff → no schema change is needed.
