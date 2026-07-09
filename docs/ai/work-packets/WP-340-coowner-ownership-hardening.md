# WP-340 — Competitive Verifier Co-Owner Hardening (By-Account Ownership Lookup)

**Status:** Draft — Ready to execute (pending operator review)
**Primary Layer:** Server (`apps/server/**`)
**Dependencies:** WP-053 (`submitCompetitiveScoreImpl`, the flow being hardened), WP-052 (`findReplayOwnership`, `assignReplayOwnership`), WP-338/D-24126 (added `findReplayOwnershipForAccount` and flagged this follow-up)
**EC:** EC-370
**Baseline:** `origin/main` at `9342758c` (2026-07-08)
**User-Visible Surface:** none — infrastructure
**Reserves:** D-24128

---

## Goal

Fix a latent correctness bug in the shared competitive verifier
(`submitCompetitiveScoreImpl`, WP-053): its ownership check uses
`findReplayOwnership(replayHash)`, which is a `LIMIT 1` query with no `ORDER BY`
and returns an **arbitrary** owner row. A finished match with **two authenticated
seats** assigns ownership to BOTH accounts, so for such a match the LIMIT-1 row may
be the *other* player's — and a legitimate co-owner is mis-rejected `not_owner`
(step 3), or step 4 reads the wrong account's visibility. WP-338 routed its own
`submitCompetitiveScoreByMatchIdForRequest` flow around this via
`findReplayOwnershipForAccount`, but the shared impl it delegates to still uses the
LIMIT-1 lookup. This packet points the impl at the caller's own ownership row so a
2-authenticated-seat match scores correctly for either player, while preserving the
`replay_not_found` vs `not_owner` distinction.

---

## Assumes

- **WP-053 Done; WP-338 Done (D-24126 Active).** `submitCompetitiveScoreImpl`
  (`competition.logic.ts`) steps 2-3 today: `findReplayOwnership(replayHash)` → null
  ⇒ `replay_not_found`; then `ownership.accountId !== account.accountId` ⇒ `not_owner`;
  step 4 checks `ownership.visibility`.
- **`findReplayOwnershipForAccount(accountId, replayHash, database)` exists** (added by
  WP-338, `replayOwnership.logic.ts`): the caller's own ownership row by
  `(ext_id, replay_hash)`, or `null`. It is already imported into `competition.logic.ts`.
- **`findReplayOwnership` stays** as the existence probe (does ANY account own/hold this
  replay) so the reason distinction is preserved.
- `pnpm -r build` exits 0 on `main`; the `apps/server` suite passes its baseline.

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `apps/server/src/competition/competition.logic.ts` — `submitCompetitiveScoreImpl`
  steps 2-5 (the change site); it already imports `findReplayOwnership` +
  `findReplayOwnershipForAccount`.
- `apps/server/src/identity/replayOwnership.logic.ts` — `findReplayOwnership` (LIMIT 1),
  `findReplayOwnershipForAccount` (by-account).
- `docs/ai/DECISIONS.md` D-5301/5302/5304 (verifier contract), D-24126 (the flagged
  follow-up this packet resolves); `competition.logic.test.ts` (the ownership tests).

---

## Non-Negotiable Constraints

**Engine-wide:** ESM only, Node v22+. Human-style code (00.6). Moves N/A. Test files
`.test.ts`; `node:test`; DB-dependent tests use the non-silent skip. Full-sentence errors.

**Packet-specific:**
- **Step 2 becomes the caller's ownership lookup.** Replace
  `findReplayOwnership(replayHash)` with
  `findReplayOwnershipForAccount(account.accountId, replayHash, database)`. When it
  returns `null`, run `findReplayOwnership(replayHash)` as a **secondary existence
  probe** and return `replay_not_found` when it is also `null`, else `not_owner`. This
  preserves the exact reason contract (nothing captured ⇒ `replay_not_found`; captured
  but not the caller's ⇒ `not_owner`).
- **Step 3's separate `accountId` compare is removed** — the resolved `ownership` IS the
  caller's row, so the owner check is implicit.
- **Step 4 reads the CALLER's visibility** (the `ownership` row is now guaranteed the
  caller's) and step 5's `scenarioKey` comes from the same row.
- **No behavior change for the single-owner and non-owner cases** — the existing tests
  (`not_owner` for a stranger, the happy path, idempotency) keep their outcomes; only a
  2-authenticated-seat co-owner's outcome changes (now accepted instead of possibly
  `not_owner`).
- **The 16-step flow's remaining steps (idempotency fast-path, PAR, reduce, verify,
  score, insert) are byte-unchanged.** No engine edit, no `computeStateHash` change, no
  migration, no new npm dep, no `Math.random`. `pg.Pool` reused.

**Locked contract values:**
- Reasons unchanged: `replay_not_found` (no owner at all) / `not_owner` (owned, not by
  caller) / `visibility_not_eligible` (caller's row private) — same HTTP mapping.
- `submitCompetitiveScoreImpl` signature unchanged.

---

## Scope (In)

- `competition.logic.ts` — `submitCompetitiveScoreImpl` steps 2-4 rework (by-account
  primary lookup + secondary existence probe; remove the accountId compare; visibility
  from the caller's row).
- `competition.logic.test.ts` — add:
  - a **co-owner accepted** DB test (accounts A and B both own the replay, public
    visibility; submitting as B — the second-inserted owner the LIMIT-1 probe would not
    return — is accepted, `ok: true`, not `not_owner`), and
  - a **`replay_not_found`** DB test (submitting for a hash no account owns) covering the
    secondary-probe branch.
- `docs/ai/REFERENCE/api-endpoints.md` — a light Notes touch on the `POST
  /api/competition/scores` row (the owner check is by-account; co-owners of a
  multi-authenticated-seat match are each eligible). No request/response/status/auth
  change.

---

## Out of Scope

- **Any change to `findReplayOwnership` itself** — it stays as the existence probe; other
  callers (leaderboard reads, etc.) are unaffected.
- **Any change to reasons, the endpoint contract, the scoring math, capture, or reduction.**
- **The submit-by-matchId orchestration** (WP-338) — already correct; unchanged (it now
  agrees with the impl, both by-account).

---

## Files Expected to Change

- `apps/server/src/competition/competition.logic.ts` — **modified** — steps 2-4
- `apps/server/src/competition/competition.logic.test.ts` — **modified** — co-owner + not-found tests
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — Notes touch (§21 light)
- `docs/ai/work-packets/WP-340-coowner-ownership-hardening.md` — **new** — this file
- `docs/ai/execution-checklists/EC-370-coowner-ownership-hardening.checklist.md` — **new**
- `docs/ai/work-packets/WORK_INDEX.md` — **modified**
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified**
- `docs/ai/STATUS.md` — **modified** (execution)
- `docs/ai/DECISIONS.md` — **modified** (execution) — D-24128

No engine change; no migration.

---

## Acceptance Criteria

- [ ] Step 2 resolves the caller's ownership via `findReplayOwnershipForAccount`; `null` →
      a secondary `findReplayOwnership` probe returns `replay_not_found` (no owner) or
      `not_owner` (owned by someone else).
- [ ] The separate `ownership.accountId !== account.accountId` compare is gone; step 4
      reads the caller's own visibility.
- [ ] A 2-authenticated-seat co-owner (submitting as the non-first owner) is **accepted**,
      not `not_owner` (new DB test).
- [ ] Submitting for a replay no account owns returns `replay_not_found` (new DB test).
- [ ] The existing `not_owner`-for-a-stranger, happy-path, rawScore, and idempotency tests
      keep their outcomes; the WP-338 by-matchId tests still pass.
- [ ] Engine untouched (`git diff --name-only packages/` empty); no migration; the 16-step
      flow past step 4 is byte-unchanged.
- [ ] No files outside `## Files Expected to Change`.

---

## Verification Steps

```pwsh
pnpm -r build                                   # exits 0
pnpm --filter @legendary-arena/server test      # green (DB tests skip w/o TEST_DATABASE_URL)

# the impl uses the by-account lookup, not the LIMIT-1 row, for the owner check
Select-String -Path "apps\server\src\competition\competition.logic.ts" -Pattern "findReplayOwnershipForAccount"
# Expected: >= 1 (now used in submitCompetitiveScoreImpl)
git diff --name-only packages/                  # no output (engine untouched)
git diff --name-only                            # == Files Expected to Change
```

Locally set `TEST_DATABASE_URL` to the canonical `.env` `DATABASE_URL` to run the co-owner
+ not-found DB tests (clear `legendary.player_badges` before the aggressive `players` wipe,
per the WP-338 precedent).

---

## Vision Alignment

**Vision clauses touched:** §22/§24 — every eligible player of a competitive match can
record their score; a co-owner is no longer arbitrarily excluded. No integrity relaxation:
the server still re-reduces + hash-verifies (D-5301), and each account still submits its
own owned replay.

**Conflict assertion:** No conflict — a correctness fix that strengthens §22 coverage.

**Non-Goal proximity:** NG-1..7 — none crossed.

**Determinism preservation:** No RNG/engine change; scoring path untouched.

---

## Funding Surface Gate

**N/A** — server-side ownership-lookup correctness. No funding/nav surface. Authority:
WP-097, D-9701, D-9801.

---

## API Catalog Update (§21 — D-11804)

**Light touch (no contract change).** The `POST /api/competition/scores` request /
response / status / auth are unchanged; only the endpoint's owner-eligibility *semantics*
improve (co-owners of a multi-authenticated-seat match are each eligible). The row's Notes
are updated to say so in the impl commit; no `Status`/`Auth`/schema field changes, and no
catalogued library function signature changes (`findReplayOwnershipForAccount` was
catalogued by WP-338).

---

## Lint Gate Self-Review (00.3)

| § | Verdict | Notes |
|---|---------|-------|
| §1 Structure | PASS | All sections incl. Out of Scope (≥2) |
| §2 Constraints | PASS | Engine-wide + packet-specific + locked values; 00.6 |
| §3 Assumes | PASS | WP-053/338 + `findReplayOwnershipForAccount` existence explicit |
| §4 Context | PASS | competition.logic steps + replayOwnership + DECISIONS cited |
| §5 Output | PASS | 3 code/test/doc + governance; bounded; engine excluded |
| §6 Naming | PASS | `findReplayOwnershipForAccount`/`replay_not_found`/`not_owner` canonical |
| §7 Dependencies | PASS | No new npm dep; no migration; `pg.Pool` reused |
| §8 Boundaries | PASS | Server-only; engine untouched |
| §9 Windows | PASS | `Select-String` / `pnpm` |
| §10 Env | N/A | none |
| §11 Auth | PASS | Endpoint auth unchanged; owner semantics only |
| §12 Tests | PASS | `node:test`; new co-owner + not-found DB tests; existing outcomes preserved |
| §13 Commands | PASS | Exact `pnpm` + `Select-String` w/ expected output |
| §14 Acceptance | PASS | 7 binary items |
| §15 DoD | PASS | STATUS/DECISIONS/WORK_INDEX + scope-boundary + User-Visible Surface |
| §16 Code style | PASS | Small change; `// why:` on the by-account + secondary-probe rationale |
| §17 Vision | PASS | §22/§24 cited; determinism-preservation line present |
| §18 Prose-vs-grep | PASS | `findReplayOwnershipForAccount` ≥1 grep intended |
| §19 Bridge | N/A | no repo-state artifact |
| §20 Funding | N/A | justified |
| §21 API catalog | PASS | Light Notes touch; no contract change — stated + justified |

**Pre-flight self-verdict:** READY — surgical, well-scoped; the helper exists; the reason
contract is preserved via the secondary probe; the co-owner + not-found tests pin the fix.

**Copilot self-check:** PASS — server-only, engine untouched, contract unchanged, resolves
the D-24126 co-owner follow-up, User-Visible Surface `none — infrastructure`.

---

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/server test` exits 0 (co-owner + not-found tests green; existing outcomes preserved; DB-gated verified locally where feasible)
- [ ] `docs/ai/REFERENCE/api-endpoints.md` Notes touch in the impl commit
- [ ] `docs/ai/STATUS.md` updated — "No user-observable change — infrastructure only"; names the fix (co-owners of a 2-authenticated-seat match are each eligible)
- [ ] `docs/ai/DECISIONS.md` — D-24128 (`submitCompetitiveScoreImpl` uses the by-account ownership lookup; secondary existence probe preserves `replay_not_found` vs `not_owner`; resolves the D-24126 follow-up) Active
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-340 checked off with date
- [ ] No files outside `## Files Expected to Change`; engine untouched
