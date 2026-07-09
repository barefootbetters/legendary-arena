# EC-370 — Competitive Verifier Co-Owner Hardening (By-Account Ownership Lookup) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-340-coowner-ownership-hardening.md
**Layer:** Server (`apps/server/**`) — engine NOT modified, no migration

## Before Starting
- [ ] WP-053 + WP-338 Done; `pnpm -r build` 0; capture the `apps/server` baseline (which DB tests skip w/o `TEST_DATABASE_URL`)
- [ ] Read `submitCompetitiveScoreImpl` steps 2-5 — confirm it imports BOTH `findReplayOwnership` and `findReplayOwnershipForAccount` (WP-338 added the import)
- [ ] Target file set == the WP `Files Expected to Change` allowlist

## The Bug (what you are fixing)
`findReplayOwnership(replayHash)` is `LIMIT 1` with no `ORDER BY` → an ARBITRARY owner row. A 2-authenticated-seat match owns TWO rows for one `replay_hash`, so step 3's `ownership.accountId !== account.accountId` can mis-reject a legitimate co-owner as `not_owner`, and step 4 can read the wrong account's visibility. WP-338's by-matchId flow already uses `findReplayOwnershipForAccount`; this makes the shared impl agree.

## The Fix (exact shape)
Replace step 2-3 with:
```
// step 2 — the CALLER's ownership (by-account, D-24128).
const ownership = await findReplayOwnershipForAccount(account.accountId, replayHash, database);
if (ownership === null) {
  // Distinguish "no owner at all" from "owned, but not the caller's".
  const anyOwnership = await findReplayOwnership(replayHash, database);
  return { ok: false, reason: anyOwnership === null ? 'replay_not_found' : 'not_owner' };
}
// step 3 — owner check is implicit: `ownership` IS the caller's row (compare removed).
```
- step 4: `ownership.visibility` (now the caller's row) → `visibility_not_eligible` if `'private'`. UNCHANGED otherwise.
- step 5: `ownership.scenarioKey` (caller's row).

## Locked Values (do not re-derive)
- Reason contract unchanged: `replay_not_found` (no owner) / `not_owner` (owned, not caller) / `visibility_not_eligible` (caller private)
- `submitCompetitiveScoreImpl` signature unchanged
- `findReplayOwnership` stays (existence probe); do NOT edit it
- Reserves D-24128

## Guardrails
- The 16-step flow from step 4b (idempotency fast-path) onward is BYTE-UNCHANGED — only steps 2-4 change
- Do NOT edit `findReplayOwnership` (other callers depend on it); do NOT add an `ORDER BY` there
- No engine edit; no `computeStateHash`/reduction change; no migration; no new npm dep; `pg.Pool` reused
- Preserve the `replay_not_found` vs `not_owner` distinction via the secondary probe — do NOT collapse both to one reason

## Required `// why:` Comments
- `competition.logic.ts` step 2 by-account lookup: why the caller's own row (a multi-authenticated-seat match owns 2 rows; `findReplayOwnership`'s LIMIT-1 could return the other player's → co-owner mis-reject; D-24128)
- `competition.logic.ts` secondary probe: why a second `findReplayOwnership` call on the null branch (to keep `replay_not_found` distinct from `not_owner`)

## Files to Produce
- `apps/server/src/competition/competition.logic.ts` — **modified** — steps 2-4
- `apps/server/src/competition/competition.logic.test.ts` — **modified** — co-owner-accepted + `replay_not_found` DB tests
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — light Notes touch (owner check is by-account; co-owners eligible)
- `docs/ai/DECISIONS.md` — **modified** — D-24128
- `docs/ai/STATUS.md` — **modified**
- `docs/ai/work-packets/WORK_INDEX.md` — **modified**

## After Completing
- [ ] `pnpm -r build` 0
- [ ] `pnpm --filter @legendary-arena/server test` 0 — new co-owner-accepted + `replay_not_found` tests green; the existing `not_owner`-for-a-stranger / happy / rawScore / idempotency + the WP-338 by-matchId tests unchanged in outcome
- [ ] Grep: `findReplayOwnershipForAccount` present in `competition.logic.ts`; the `ownership.accountId !==` compare is gone
- [ ] `git diff --name-only packages/` empty (engine untouched); no `data/migrations/` file
- [ ] `api-endpoints.md` Notes touch applied
- [ ] `docs/ai/STATUS.md` states "No user-observable change — infrastructure only" (+ the co-owner fix)
- [ ] `docs/ai/DECISIONS.md` D-24128 Active
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date
- [ ] `git diff --name-only` == allowlist

## Common Failure Smells (Optional)
- A submit for a truly-unknown replay returns `not_owner` instead of `replay_not_found` → the secondary existence probe is missing / inverted
- The existing stranger test flips outcome → you removed the secondary probe (a stranger must still get `not_owner`, not `replay_not_found`)
- The co-owner test passes on OLD code too → you submitted as the FIRST-inserted owner (LIMIT-1 returns it); submit as the SECOND owner so the fix is actually exercised
- Local DB run FK-faults on `players` delete → clear `legendary.player_badges` first (WP-338 precedent)
