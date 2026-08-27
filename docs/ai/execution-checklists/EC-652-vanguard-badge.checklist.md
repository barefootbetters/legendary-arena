# EC-652 — Vanguard Badge (Execution Checklist)

**Source:** docs/ai/work-packets/WP-617-vanguard-badge.md
**Layer:** Server (`apps/server/src/badges/**` + the competition issuance caller)

## Before Starting
- [ ] WP-616 on `origin/main`: `ScoreBreakdown.inputs.perPlayer[]` carries
      `mastermindTacticsDefeated` per seat (sorted by seat id, optional).
- [ ] WP-105/WP-613 badge modules: `issueTier1BadgesForSubmission(..., playerCount)`
      + `evaluatePerRunBadges(breakdown, playerCount)`; `TIER_1_BADGE_KEYS` = 13.
- [ ] `apps/server/src/match/seatAccount.logic` reads authenticated seats as
      `[{ playerId: seat, accountId }]`; the submission has `matchId` + the
      submitter's `accountId` at the badge-issuance point.
- [ ] Fresh worktree off `origin/main` (`7c5f62d7`); baseline clean; capture the SHA.
- [ ] Scope lock — EXACTLY 6 code files (4 src + 2 test). Any edit outside → STOP.
- [ ] Read D-24427 + D-1004 + the legendary-server / legendary-persistence skills.
- [ ] `pnpm -r build` 0; server suite green (badge tests use a mock DatabaseClient).

## Locked Values (do not re-derive)
- Key `gameplay.team.vanguard`, label "Vanguard", `sourceKind 'competitive_score'`.
- Eligibility ⇔ `playerCount >= 2 && perPlayer.length >= 2 && submitterSeat found &&
  submitterCount === max(counts) && max >= 1 && max > min(counts)`, where
  `counts = perPlayer.map(mastermindTacticsDefeated)`.
- `TIER_1_BADGE_KEYS` 13 → 14.

## Guardrails
- **Self-award only** — issue to the SUBMITTER's own `player_id` via the existing
  per-run INSERT (`source_ref` = scoreId); never another account.
- **Strict-standout gate** — an even split (`max === min`), a non-max submitter, a
  zero max, a solo match, a missing `perPlayer`, or a missing submitter seat → no award.
- **Anti-volume / no-PvP / append-only** — skill-gated; cooperative framing; reuse
  the INSERT + `ON CONFLICT DO NOTHING`. NO migration, no new source_kind/route/table.
- **Read-only over immutable data** — reads the deserialized `ScoreBreakdown` + the
  seat roster; no recompute, no replay re-exec; no hash surface.
- **Fail-safe seat resolution** — a roster read error / unresolved seat → no-award
  inside the existing fire-and-forget badge try/catch (never fails the submission).
- **Drift** — `TIER_1_BADGE_KEYS` 13 → 14 with `BADGE_DEFINITIONS`; update the count pin.
- **`// why:`** on the strict-standout rule + the seat-resolution join.

## Files to Produce
- `apps/server/src/badges/badge.types.ts` — **modified** — key + definition; 13 → 14
- `apps/server/src/badges/badge.predicates.ts` — **modified** — `isEligibleVanguard` + `evaluatePerRunBadges(…, submitterSeatId)`
- `apps/server/src/badges/badge.issuance.ts` — **modified** — thread `submitterSeatId`
- `apps/server/src/competition/competition.logic.ts` — **modified** — resolve + pass the submitter's seat
- `apps/server/src/badges/badge.predicates.test.ts` — **modified** — Vanguard predicate + drift 13 → 14
- `apps/server/src/badges/badge.issuance.test.ts` — **modified** — thread arg + Vanguard issuance case

## After Completing
- [ ] `pnpm -r build` 0; server suite green (incl. Vanguard tests).
- [ ] `TIER_1_BADGE_KEYS` = 14; drift passes; `BADGE_DEFINITIONS` in lockstep.
- [ ] **Live-on-surface (D-24026):** in a co-op match, the top tactic-defeater's
      profile shows "Vanguard"; the others' do not.
- [ ] `git diff --name-only` — the `EC-652:` implementation commit is only the 6 files.
- [ ] STATUS.md updated; DECISIONS.md D-24428 Active; WORK_INDEX WP-617 `[x]`;
      mindmap `📝` → `✅` + `pnpm roadmap:counts:write`.

## Common Failure Smells (Optional)
- Vanguard fires on an even split → missing the `max > min` guard.
- Vanguard fires solo → missing the `playerCount >= 2` guard.
- Awarded to the wrong account → you didn't self-award (or resolved the wrong seat).
- Every existing issuance test breaks → thread the new `submitterSeatId` arg (the WP-613 precedent).
- A migration in the diff → the badge reuses `competitive_score`; no schema change.
