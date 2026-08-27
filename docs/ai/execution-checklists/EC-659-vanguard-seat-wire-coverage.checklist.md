# EC-659 — Vanguard seat-wire end-to-end coverage (Execution Checklist)

**Source:** docs/ai/work-packets/WP-624-vanguard-seat-wire-coverage.md
**Layer:** Server — test-coverage only (`apps/server/src/competition/**` tests)

## Before Starting
- [ ] WP-617 on `origin/main`: `submitCompetitiveScoreByMatchIdForRequest` resolves
      `submitterSeatId` from `readSeatAccounts` and threads it → Vanguard.
- [ ] WP-619 on `origin/main`: the same block derives `humanSeatCount = roster.length`
      → `issueSharedMatchBadges` completeness gate.
- [ ] Baseline `origin/main` `7263e4be`; worktree clean; capture the SHA.
- [ ] Scope lock — EXACTLY 1 file: `competition.logic.test.ts`. Any other edit → STOP.
- [ ] A local Postgres reachable via `TEST_DATABASE_URL` (else the new tests skip).
- [ ] `pnpm --filter @legendary-arena/game-engine build && ...registry build` 0.

## Locked Values (do not re-derive)
- Badge keys asserted verbatim: `gameplay.team.vanguard`, `gameplay.shared.united-front`.
- Crafted split: seat 0 victory `['tac-1','tac-2']`, seat 1 `['tac-3']`,
  `mastermind.tacticsDefeated = ['tac-1','tac-2','tac-3']` → max 2 > min 1, standout seat 0.
- Self-contained COMPLETE `ScenarioScoringConfig` — `parBaseline` MUST include
  `schemeTwistsPar` + `bystandersLostPar` (else `computeParScore` = NaN → step-12
  `replay_verification_failed`). This run: no penalties, 15 team VP → raw −150, par 90,
  final −240 (sub-PAR → both seats qualify for united-front).
- Fixture reuses `WP338_SETUP_DATA` + `InitializeGame` (a real, fully-populated G);
  metadata `{"gameover":{"winner":"0"},"players":{"0":{},"1":{}}}` (seatCount 2).

## Guardrails
- **No production change** — `competition.logic.ts` and every non-test file stay
  byte-identical. The wire is already correct; this only proves it.
- **Genuine split, not injected** — the per-seat `mastermindTacticsDefeated` is
  computed by the real engine `deriveScoringInputs` over the reduced state; the seat
  is resolved by the real `readSeatAccounts`. Nothing in the badge layer is stubbed.
- **Frozen state** — `InitializeGame`'s G is deep-frozen; mutate a `structuredClone`,
  never the original.
- **Scoped teardown only** — every DELETE is keyed by `match_id` / `replay_hash` /
  `ext_id = ANY(seedEmails)`. NEVER an unscoped `DELETE FROM legendary.players`
  (the WP-053 block's pattern) — a shared local DB carries real dev rows.
- **Idempotent seed** — pre-purge the deterministic `wp624-*@example.test` accounts
  (dependents first) so a crashed run never blocks a rerun on the unique-auth INSERT.
- **DB-gated** — `{ skip: hasTestDatabase ? false : 'requires test database' }`,
  matching every sibling DB test.
- **`// why:`** on the injected-split rationale, the frozen-state clone, the
  human+bot `humanSeatCount != playerCount` case, and the idempotent purge.

## Files to Produce
- `apps/server/src/competition/competition.logic.test.ts` — **modified** — one new
  `describe` (2 tests + helpers) + add `AccountId` to the identity-types import.

## After Completing
- [ ] Live DB: `--test-name-pattern="Vanguard . shared seat wire"` → 2 pass / 0 fail.
- [ ] No DB: the file runs 6 pass / 25 skipped / 0 fail (the 2 new tests skip).
- [ ] **Mutation evidence:** `submitterSeatId = null` fails both; only
      `humanSeatCount = null` fails only the human+bot test; production reverted byte-clean.
- [ ] `git diff --name-only` on the `EC-659:` commit is exactly the one test file.
- [ ] STATUS.md updated; WORK_INDEX WP-624 `[x]`; EC_INDEX EC-659 Complete;
      mindmap `📝` → `✅` + `pnpm roadmap:counts:write`. No D-entry (no design decision).

## Common Failure Smells (Optional)
- `replay_verification_failed` on the happy path → the config's `parBaseline` is
  missing `schemeTwistsPar` / `bystandersLostPar` (NaN parScore) — use the complete config.
- `Cannot assign to read only property 'victory'` → mutate a `structuredClone`, not the frozen G.
- `createPlayerAccount` returns `ok:false` on rerun → a prior crash leaked the
  deterministic accounts; the idempotent pre-purge fixes it.
- united-front never lands in the human+bot test → capture assigns ownership only to
  authenticated seats; the bot seat has no `match_seat_accounts` row by design (roster 1).
- The dev DB loses rows → an unscoped players DELETE leaked in; all teardown must be scoped.
