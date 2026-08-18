# WP-570 — Possibly-Undefined Index Access in Engine Tests (Game Engine tests)

**Status:** Drafted 2026-08-17
**EC:** [EC-605](../execution-checklists/EC-605-engine-test-possibly-undefined-indexing.checklist.md)
**Reserves:** D-24379
**Lane:** Standard two-session
**User-Visible Surface:** none — infrastructure
**Drafted off:** `origin/main` @ `a7c3f2b8`

---

## Goal

Drive the engine test-typecheck gate's largest remaining error class —
`noUncheckedIndexedAccess` violations, **209 errors across 12 files** — to zero.
Packet 3 of the WP-563 arc. Nothing user-visible ships; `dist` stays
byte-identical.

## Assumes

- **WP-563 / EC-598 / D-24372 (Done)** — shipped `tsconfig.test.json` and
  `typecheck:tests`. §3 (fix, never silence) and §2 (CI wiring deferred until
  zero) govern this packet unchanged.
- **WP-569 / EC-604 / D-24378 (Done)** — closed the `TS2345` class and left the
  gate at **498**. Its `dist` relaxation was one-time and specific; this packet
  adds no module, so WP-563's byte-identical invariant is **back in force**.
- `noUncheckedIndexedAccess` is on in the base `tsconfig.json` and stays on.
- The repo already uses `playerZones['0']!` as its index-access idiom in **44**
  engine test files.

## Context

**Why now.** With `TS2345` closed, `TS2532` (178) + `TS18048` (31) is the
largest class at **209 / 12 files**, and it is heavily concentrated:
`hero/heroEffects.execute.test.ts` alone carries **136**.

**The scaffold ran and it sized the packet honestly.** Every one of the 209 was
classified by reading its **source line**, not its message:

| Shape | Count |
|---|---|
| `playerZones[…]` index access | **154** |
| array index (`errors[0].field`, `faceDownCards[0].instanceId`) | 17 |
| already-bound variable (`player0.deckCount`) and other | 38 |

Then the dominant shape was mechanically rewritten in the single largest file:
**498 → 362 total, 209 → 73 class.** One file, one regex, 136 errors.

**Why `!` is not a suppression, which is the argument this packet turns on.**
D-24372 §3 bans `any`, `@ts-ignore` and `@ts-expect-error`. The non-null
assertion is a different kind of thing, and the difference is not stylistic:

- `@ts-ignore` / `@ts-expect-error` **delete a diagnostic** and leave the
  underlying claim unexamined. `any` **deletes the type**.
- `!` makes a **specific, narrow, checkable claim** — this index is populated —
  and the runtime still enforces it, because the expression is dereferenced
  either way and an undefined value throws.
- In a **test**, that claim is self-proving: the suite already passes while
  dereferencing these expressions unguarded
  (`gameState.playerZones['0'].hand.length`). If the value were undefined the
  test would already be throwing a TypeError.
- `!` is **erased at compile time** and `tsx` strips it, so the rewrite has
  **no runtime semantics whatsoever**. That is what makes a regex sweep
  acceptable here and would not make it acceptable for anything that changes
  emitted code.

This packet therefore makes an existing idiom consistent rather than
introducing a new escape hatch.

## Scope (In)

1. The **12 files** carrying the 209 errors, top three
   `hero/heroEffects.execute.test.ts` (136),
   `persistence/snapshot.create.test.ts` (17),
   `setup/buildInitialGameState.shape.test.ts` (13); the rest at 10 or fewer.
   Exact per-file counts are **re-derived at execution**.
2. Two fix idioms, applied by shape (see §Contract).
3. `WORK_INDEX.md` — refresh the WP-563 backlog inventory counts.

## Scope (Out)

- **Any non-test `src` file.** Including `src/test/mockCtx.ts` and last
  packet's `mockMoveContext.ts` — this packet adds no module.
- **The base `tsconfig.json`**, and specifically `noUncheckedIndexedAccess`.
  Relaxing the flag would delete the finding rather than address it.
- **Changing any assertion's subject or expected value.** This packet changes
  types, never test semantics.
- The missing-required-state-field class (`TS2739` / `TS2741`) and the ~90-error
  long tail.
- **Wiring the gate into CI.** D-24372 §2; the count is not zero.
- Relocating WP-569's loadout assertions to the builder seam (its own packet).
- Migrating the ~20 non-erroring mock helpers onto the shared builder.

## Files Expected to Change

| File | Change |
|---|---|
| `packages/game-engine/src/hero/heroEffects.execute.test.ts` | ~136 index accesses |
| `packages/game-engine/src/persistence/snapshot.create.test.ts` | ~17 |
| `packages/game-engine/src/setup/buildInitialGameState.shape.test.ts` | ~13 |
| `packages/game-engine/src/hero/__tests__/undercover.integration.test.ts` | ~10 |
| `packages/game-engine/src/content/content.validate.test.ts` | ~8 |
| `packages/game-engine/src/setup/buildCardDisplayData.test.ts` | ~7 |
| `packages/game-engine/src/moves/__tests__/sendUndercover.test.ts` | ~6 |
| *(5 further files at 4 or fewer)* | **re-derive the list at execution** |
| `docs/ai/work-packets/WORK_INDEX.md` | refresh backlog counts |

## Contract

**Locked — two idioms, chosen by shape.**

1. **Inline `!`** for a one-off index access:
   `gameState.playerZones['0']!.hand.length`. Matches the repo's existing idiom
   in 44 files.
2. **A single `assert.ok(value !== undefined, '<full sentence>')`** after
   binding, when an indexed value is bound to a variable and read repeatedly
   (`const player0 = snapshot.players[0]`). `assert.ok` narrows, so one
   assertion covers every later use — and it fails with an actionable message
   instead of a bare TypeError.

**Locked — `!` is permitted; `any` / `@ts-ignore` / `@ts-expect-error` are
not.** Per §Context and D-24379.

**Locked — `noUncheckedIndexedAccess` is never relaxed.** The flag is what
surfaced 209 unexamined index assumptions.

**Locked — type-only diff.** No assertion's subject or expected value changes.
A reviewer must be able to read the entire diff as type annotations.

**Locked — `dist` byte-identical.** Test files do not compile into `dist` and
this packet adds no module, so WP-563's invariant is back in force. A changed
`dist` file is a **STOP**.

## Acceptance Criteria

- **AC-1** — `typecheck:tests` reports **zero** `TS2532` and **zero**
  `TS18048`. Record the total before and after.
- **AC-2** — the engine suite is at or above its **2740** baseline, with **no
  test removed, renamed, skipped or weakened**. A regex over test source is
  exactly where a silent semantic change hides.
- **AC-3** — `pnpm -r build` exits 0 and the engine `dist` is **byte-identical**
  (744 files at `a7c3f2b8` + WP-569's 4 = **748**; hash before/after).
- **AC-4** — a grep confirms **zero** `any` / `@ts-ignore` / `@ts-expect-error`
  added anywhere in the diff.
- **AC-5** — `packages/game-engine/tsconfig.json` unchanged.
- **AC-6** — **zero** non-test files in the diff (stricter than WP-569: no new
  module).
- **AC-7** — both sentinel hashes unchanged.
- **AC-8** — **the diff is type-only.** Demonstrated, not asserted: a
  `git diff` filtered to remove `!` and `assert.ok(... !== undefined ...)`
  additions shows no change to any assertion's subject or expected value.
- **AC-9** — before/after counts recorded in the governance close and the
  `WORK_INDEX.md` backlog rows refreshed.

## Verification Steps

1. `pnpm -r build` → 0; confirm `dist` byte-identical.
2. `pnpm --filter @legendary-arena/game-engine typecheck:tests` → record total;
   confirm `TS2532` and `TS18048` are both 0.
3. `pnpm --filter @legendary-arena/game-engine test` → ≥ 2740, 0 fail.
4. **Run each touched file's suite immediately after sweeping it**, not just at
   the end — that is how a bad regex is caught while the blast radius is one
   file.
5. AC-8: review the filtered diff for semantic changes.
6. `pnpm -r --no-bail test` → no new failures.

## Definition of Done

- [x] AC-1..AC-9 demonstrated with observed output.
- [x] D-24379 landed **Active**.
- [x] `WORK_INDEX.md` `[x]` + refreshed backlog counts.
- [x] `EC_INDEX.md` `Done`; mindmap `✅`; `roadmap:counts:check` 0.
- [x] `STATUS.md` — before/after counts, and an explicit note that `dist` is
      byte-identical again (WP-569's relaxation was one-time and specific).

## Gate Verdicts (Drafting Session, 2026-08-17)

**Pre-flight (`01.4`): READY TO EXECUTE.** Hard-deps WP-563 and WP-569 are both
Done on `main` (`a7c3f2b8`); D-24372 and D-24378 are Active; the numbers landed
on `main` ahead of this body (PR #1511). Scope closed; no open design fork.

**Empirical scaffold: RUN.** All 209 errors classified by source line (154 /
17 / 38); the dominant shape mechanically rewritten in the largest file to
measure real yield — **498 → 362** gate, **209 → 73** class, from one file. The
scaffold also established the correctness argument (`!` is erased; the
expressions are already dereferenced unguarded), which is what licenses a regex
sweep at all.

**Copilot check (`01.7`): PASS** (1 RISK, FIXed in-place). Issue **7**
(mechanical change applied without a semantic check) fired — a regex over test
source can silently alter an assertion. FIXed by **AC-8**, which requires the
diff be demonstrated type-only, and by Verification Step 4, which runs each
file's suite as it is swept rather than once at the end.

## Lint Gate Self-Review

| § | Verdict | Note |
|---|---|---|
| 1 Goal user-visible | N/A → PASS | `none — infrastructure`; D-24026 inverts. |
| 2 Scope closed | PASS | 3-item In; Out names the tsconfig flag, other classes, CI wiring, non-test files, and two sibling follow-ups. |
| 3 Assumes cite sources | PASS | WP-563 + WP-569 with their D-entries; the 44-file idiom count measured. |
| 4 Files allowlist | PASS | 7 named + an explicitly re-derived tail. |
| 5 Contract explicit | PASS | Five locked rules, incl. the `!`-is-not-a-suppression basis. |
| 6 AC testable | PASS | 9 ACs; AC-8 is the semantic-safety proof. |
| 7 Layer boundary | PASS | Engine test surface only. |
| 8 Determinism | PASS | `!` is erased; no runtime semantics; AC-7 pins both hashes. |
| 9 Persistence | N/A | Nothing stored. |
| 10–12 Move / phase / zone | N/A | No such code changes. |
| 13 Canonical arrays | N/A | None touched. |
| 14 Naming | PASS | No new identifiers beyond bound locals. |
| 15 Error handling | PASS | The `assert.ok` idiom requires a full-sentence message. |
| 16 Test extension | PASS | AC-2 forbids removing, renaming, skipping or weakening any test. |
| 17 Vision | PASS | §14 observability / correctness; determinism line above. |
| 18 Dependencies complete | PASS | Both hard-deps Done. |
| 19 Lane eligibility | PASS | Two-session: 12 files, ~209 edits. |
| 20 Knobs | N/A | No `SAFE-KNOBS.md` surface. |
| 21 API catalog | N/A | No endpoint. |

**All 21 sections resolved.**

## Notes

**What the 209 actually represent.** Each is a place a test assumed an index
was populated without saying so. Most are correct assumptions — the suite
proves it — but they were never written down, which is exactly the drift the
gate exists to surface. Making them explicit is the deliverable, and the
`assert.ok` idiom is preferred wherever a value is read repeatedly precisely
because it converts an assumption into a stated, message-bearing check.

**After this packet, the arc's remaining backlog is:** missing required state
fields (`TS2739` / `TS2741`, ~195 / 55 files — the broad stale-fixture class,
and the one with a genuine finding inside it), the ~90-error long tail, and
then the CI wiring that the whole arc exists to enable.
