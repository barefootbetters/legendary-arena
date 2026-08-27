# WP-624 — Vanguard seat-wire end-to-end coverage (by-matchId → Vanguard / shared-badge)

**Status:** Done
**Primary Layer:** Server — test-coverage only (`apps/server/src/competition/**` tests)
**Dependencies:** WP-617 / D-24428 (`gameplay.team.vanguard`, the badge under test), WP-619 / D-24430 (`humanSeatCount` shared-badge completeness gate), WP-338 (`submitCompetitiveScoreByMatchIdForRequest`, the caller under test), WP-336 (faithful reducer-replay path), WP-335 (on-demand capture)
**User-Visible Surface:** none (regression test coverage; no production behaviour change)

> Baseline: `origin/main` at commit `7263e4be` (EC-658: Danger meter names the converted enemy — Killbots / Skrulls (WP-623), #1682).

---

## Session Context

WP-617 wired the Vanguard badge and WP-619 wired the shared-badge human-seat
completeness gate. Both wires live in the same block of
`submitCompetitiveScoreByMatchIdForRequest` (`competition.logic.ts`), which reads
the match roster once (`readSeatAccounts(matchId)`) and derives from it BOTH:

- `submitterSeatId = roster.find(entry => entry.accountId === account.accountId)?.playerId ?? null`
  — the caller's own bgio seat, threaded to the Vanguard badge's per-seat tactic read.
- `humanSeatCount = roster.length` — threaded to the shared-badge completeness gate.

The issuance→INSERT step is unit-tested with an **injected** `submitterSeatId` and
an **injected** `perPlayer[]` split (`badge.issuance.test.ts`, the "WP-617:
the tactic-standout submitter earns Vanguard" case). But nothing exercised the REAL
by-matchId caller's roster read end-to-end: the existing WP-338 DB tests seed a
roster over a **no-tactic** replay fixture (`manufactureWp338Artifact` runs only
setup moves), so the reduced final state's `perPlayer` has no genuine ≥2-seat
mastermind-tactic split and Vanguard never actually fires in those tests.

This is the **"injected seam hides missing wiring"** pattern (the WP-560
shipped-dead-music precedent). If `readSeatAccounts`'s row shape or the caller's
`.find()` drifts, `submitterSeatId` silently nulls out and Vanguard stops firing on
the real path with **no test failure**. The same read feeds `humanSeatCount`, so a
drift there silently reverts the WP-619 human+bot completeness gate to `playerCount`.

---

## Goal

Add DB-gated tests that drive the REAL `submitCompetitiveScoreByMatchIdForRequest`
over a genuine 2-seat terminal replay whose reduced final state carries a real
per-seat mastermind-tactic split (seat 0 defeats strictly more than seat 1), and
assert the badge rows that actually land in `legendary.player_badges`:

1. the standout seat-0 owner earns `gameplay.team.vanguard`; the non-standout
   seat-1 owner does not (the WP-617 `submitterSeatId` wire), and
2. a 1-human + 1-bot table earns `gameplay.shared.united-front` at a single human
   submission — proving the WP-619 `humanSeatCount` wire (completeness at 1 human
   row when `humanSeatCount = 1 != playerCount = 2`).

Nothing about the seat split or the roster read is injected — the split is derived
by the real engine `deriveScoringInputs` over the reduced state, and the seat is
resolved by the real `readSeatAccounts`.

---

## User-Visible Impact

None. Regression coverage only; no production code changes.

---

## Assumes

- WP-617 on `main`: `submitCompetitiveScoreByMatchIdForRequest` resolves
  `submitterSeatId` from `readSeatAccounts` and threads it through
  `submitCompetitiveScoreForRequest` → `submitCompetitiveScoreImpl` →
  `issueTier1BadgesForSubmission` → `evaluatePerRunBadges` → `isEligibleVanguard` →
  `INSERT ... 'gameplay.team.vanguard'`.
- WP-619 on `main`: the same block derives `humanSeatCount = roster.length` and
  threads it to `issueSharedMatchBadges`, whose completeness gate awaits
  `rows.length === (humanSeatCount ?? playerCount)`.
- WP-616 on `main`: `deriveScoringInputs` classifies each victory-pile card id that
  appears in `mastermind.tacticsDefeated` (and is not villain/henchman/bystander)
  as that seat's `mastermindTacticsDefeated`.
- WP-336/WP-335: the by-matchId flow captures on-demand from `bgio.matches` and
  reduces via `reduceMatchToFinalState` (empty log → the persisted `initialState.G`
  verbatim).
- A local test Postgres is reachable via `TEST_DATABASE_URL`; the file's DB-gated
  tests skip (`requires test database`) when it is unset, exactly like every
  sibling DB test.

---

## Scope (In)

- `apps/server/src/competition/competition.logic.test.ts` — add ONE new
  `describe` block with two DB-gated tests + their fixture/seed/teardown helpers,
  and add `AccountId` to the existing identity-types import.

## Scope (Out)

- No production code change. The WP-617/WP-619 wiring is already correct and
  field-aligned; this packet only proves it end-to-end.
- No new migration, no new badge, no hash surface, no engine change.
- **Not** repairing the pre-existing stale-fixture rot in the same file: the shared
  `TEST_SCORING_CONFIG.parBaseline` is missing `schemeTwistsPar` /
  `bystandersLostPar` (required since WP-591 / D-24400), so `computeParScore` over
  it yields `NaN` and every DB-gated test that uses it currently rejects with
  `replay_verification_failed` against a live DB. This packet's new tests use a
  **self-contained complete** config and are unaffected; the shared-fixture repair
  is flagged separately (out of scope here — a distinct test-correctness concern).

---

## Files Expected to Change

- `apps/server/src/competition/competition.logic.test.ts` — **modified** (test only)

---

## Contract

No API/data/UI contract change. The test asserts the existing, unchanged contract:
a co-op tactic standout earns `gameplay.team.vanguard`; a human+bot table earns
`gameplay.shared.united-front` once every human seat has submitted.

---

## Acceptance Criteria

- [x] A DB-gated test seeds a genuine 2-seat terminal replay artifact (crafted
      `initialState.G` with seat 0 victory pile `['tac-1','tac-2']`, seat 1
      `['tac-3']`, `mastermind.tacticsDefeated = ['tac-1','tac-2','tac-3']`; empty
      move log), submits via `submitCompetitiveScoreByMatchIdForRequest` as the
      seat-0 owner, and asserts a `gameplay.team.vanguard` row lands for that player.
- [x] The same test submits as the seat-1 owner (non-standout) and asserts NO
      `gameplay.team.vanguard` row for that player.
- [x] A second DB-gated test (1 human + 1 bot; `humanSeatCount = 1`,
      `playerCount = 2`) asserts `gameplay.shared.united-front` lands after the
      single human submission — the WP-619 human-count pin.
- [x] Both tests skip cleanly with `requires test database` when
      `TEST_DATABASE_URL` is unset; teardown is fully scoped (never an unscoped
      `DELETE FROM legendary.players`).
- [x] No production file changes; `git diff --name-only` on the implementation
      commit is exactly the one test file.

---

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine build && pnpm --filter @legendary-arena/registry build`.
2. With `TEST_DATABASE_URL` pointed at a local Postgres, from `apps/server`:
   `node --import tsx --test --test-concurrency=1 --test-name-pattern="Vanguard . shared seat wire" "src/competition/competition.logic.test.ts"` → 2 pass, 0 fail.
3. **Mutation check (evidence the tests catch the drift):** set
   `submitterSeatId = null` in `competition.logic.ts` → both tests fail on the
   Vanguard assertion; restore, set only `humanSeatCount = null` → test 1 stays
   green, test 2 fails on the united-front assertion; restore. (Recorded below.)
4. Without `TEST_DATABASE_URL`: the file runs 6 pass / 25 skipped / 0 fail — the two
   new tests skip like every sibling DB test.

---

## Definition of Done

- [x] The two DB-gated tests exist, pass against a live DB, and skip without one.
- [x] Mutation-tested: breaking `submitterSeatId` fails both; breaking only
      `humanSeatCount` fails only the human+bot test — each wire independently pinned.
- [x] Production code unchanged (byte-clean `competition.logic.ts`).
- [x] WORK_INDEX WP-624 row, EC_INDEX EC-659 row, mindmap `📝`→`✅` node,
      `roadmap:counts:check` clean.

---

## Lint Gate Self-Review (00.3)

All 21 sections resolved. Highlights / N-A justifications:

- **§ Scope closed enumeration** — PASS: exactly one test file; Scope (Out) is explicit.
- **§ Determinism / persistence / hash** — N/A: no production or engine change; the
  crafted `initialState.G` reduces deterministically (empty log → verbatim G).
- **§ API catalog (§21 / D-11804)** — N/A: no endpoint or `Library-only` surface change.
- **§ Layer boundary** — PASS: the test lives in the server layer and imports only
  server-layer siblings + engine read-only helpers already imported by the file.
- **§ Canonical arrays / drift** — N/A: no union/array touched.
- **§ Locked values** — PASS: badge keys `gameplay.team.vanguard` /
  `gameplay.shared.united-front` are asserted, not redefined.
- **§ Empirical scaffold (validation-tightening)** — N/A (no new validation), but the
  stronger empirical bar is met anyway: the tests were **run** against a live DB and
  **mutation-tested** to prove they fail when the wire breaks.

**Pre-flight:** READY TO EXECUTE — dependencies (WP-617, WP-619, WP-338, WP-336) are
on `main`; scope is a single additive test file; empirical run + mutation evidence
on record. **Copilot self-review:** PASS — test-only, additive, no contract/hash/
migration surface; the one risk (a false-green test) is retired by the recorded
mutation check.
