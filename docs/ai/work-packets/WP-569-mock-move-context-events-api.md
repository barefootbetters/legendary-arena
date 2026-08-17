# WP-569 — Mock Move-Context `EventsAPI` / `RandomAPI` Completion (Game Engine tests)

**Status:** Drafted 2026-08-17
**EC:** [EC-604](../execution-checklists/EC-604-mock-move-context-events-api.checklist.md)
**Reserves:** D-24378
**Lane:** Standard two-session
**User-Visible Surface:** none — infrastructure
**Drafted off:** `origin/main` @ `9b4a0e02`

---

## Goal

Drive the engine test-typecheck gate's largest error code — `TS2345`, **180
errors across 17 files** — to zero, by giving the engine's mock move contexts
a complete boardgame.io plugin-API surface. This is packet 2 of the WP-563 arc.
Nothing user-visible ships; the deliverable is that the gate's biggest class
stops being a wall between the repo and a CI-wired typecheck.

## Assumes

- **WP-563 / EC-598 / D-24372 (Done 2026-08-17, `9b4a0e02`)** — shipped
  `packages/game-engine/tsconfig.test.json` and the `typecheck:tests` script,
  and inventoried the 674 remaining errors. D-24372 §3 (fix the tests, never
  silence them) and §2 (CI wiring deferred until zero) both govern this packet.
- `.claude/rules/architecture.md §Phase & Turn Transitions` — the engine
  changes phase only via `ctx.events.setPhase()` and turn only via
  `ctx.events.endTurn()`. Verified still true at draft time: a grep of all
  non-test engine source finds `events.endTurn` ×47 and `events.setPhase` ×9,
  and **zero** uses of `endPhase` / `endStage` / `pass` / `setActivePlayers` /
  `setStage`.
- `.claude/rules/architecture.md §Determinism` — all randomness via
  `ctx.random.*`. Verified: non-test engine source uses `random.Shuffle` ×65
  and no other `RandomAPI` member.
- boardgame.io ^0.50.0 is locked, so the `EventsAPI` / `RandomAPI` / `LogAPI`
  member lists below are stable for this packet's lifetime.

## Context

**Why now.** WP-563 proved the engine's test files had never been compiled and
left a sized backlog. `TS2345` is its largest single code, and the WP-563 close
named it the best next packet.

**The scaffold ran and it corrected the draft-time story twice.** This packet's
own reservation predicted "159 errors are ONE root cause — an incomplete
`events` object — and the fix is ~17 literal edits." Running the gate with
`--noErrorTruncation` showed something more useful:

1. **The failures are LAYERED, not single.** `tsc` reports only the first
   incompatible property. Completing `events` in a mock does not reduce the
   error count at all — it changes the message, revealing that `random` is
   `{ Shuffle }` against a `RandomAPI` requiring `D4 / D6 / D10 / D12 / D20 /
   Die / Number / Shuffle`. A fix that stops at `events` looks like it
   accomplished nothing. **Anyone executing this must complete the whole
   plugin-API surface per mock before reading the count as a signal.**
2. **The sizing is far better than the error count implies.** Observed:
   completing `events` **and** `random` in **two** helper literals in **two**
   files moved the gate **674 → 606**. Sixty-eight errors cleared by two edits,
   because the errors are *call sites* of per-file helpers. The `MoveContext`
   sub-class is **159 errors across 11 files** (not 17 — 17 is the file count
   for the whole `TS2345` code, and the reservation conflated the two).

**Why a shared helper, and the packaging fact behind the decision.**
`src/test/mockCtx.ts` already exists and **ships in `dist`** — the base
`tsconfig.json` excludes only `src/**/*.test.ts`, so everything under
`src/test/` compiles into the published package. That is not an accident to be
cleaned up here: `src/replay/replay.execute.ts` and
`src/replay/buildSnapshotSequence.ts` **import `makeMockCtx` at runtime**, using
its reverse-shuffle as the replay pipeline's deterministic RNG, with a `// why:`
comment saying exactly that. So `src/test/` is production-reachable, and
excluding it from the build would break replay.

Given that, a new sibling file under `src/test/` is consistent with existing
practice rather than a new pattern, and `.claude/rules/code-style.md`
("duplicate first, abstract only when a third copy appears") actively favours it
at eleven copies. **Operator decision 2026-08-17:** ship the shared helper as a
new `src/test/mockMoveContext.ts`; accept that `dist` gains exactly one known
file; do **not** touch `mockCtx.ts` (replay-reachable) and do **not** change the
base `tsconfig.json`. The alternative — completing all eleven literals in place
for a byte-identical `dist` — was considered and rejected as ~200 lines of
duplication that a future boardgame.io bump would force someone to edit eleven
times.

## Scope (In)

1. `packages/game-engine/src/test/mockMoveContext.ts` — **new**. One
   `makeMockMoveContext(gameState, overrides?)` returning a complete
   `FnContext<LegendaryGameState> & { playerID }`: full `EventsAPI`, full
   `RandomAPI`, `LogAPI`, and the `ctx` metadata the existing per-file helpers
   build.
2. The **11 test files** whose local mock helper produces the `MoveContext`
   sub-class — each local helper delegates to the shared builder:
   `villainDeck.reveal.test.ts` (48), `fightVillain.test.ts` (24),
   `recruitHero.test.ts` (23), `economy.integration.test.ts` (12),
   `fightMastermind.test.ts` (11), `villainDeck.city.integration.test.ts` (10),
   `dodgeCard.test.ts` (8), `__tests__/sendUndercover.test.ts` (8),
   `escape-wound.integration.test.ts` (6),
   `hero/__tests__/undercover.integration.test.ts` (5),
   `__tests__/playFromUndercover.test.ts` (4).
3. The remaining **21 `TS2345`** errors, so the whole code reaches zero:
   14 `SetupContext` → `UIBuildContext` (12 in `uiState.build.progress.test.ts`,
   2 in `uiState.filter.test.ts`), 5 stale `{ listCards }` registry mocks
   missing `listSets` / `getSet`, 1 `EffectNode | undefined`, and 1
   `hook.keywords.includes('spectrum')`.
4. `WORK_INDEX.md` — refresh the WP-563 backlog inventory rows, whose counts
   this packet moves.

## Scope (Out)

- **Any non-test `src` file**, including `src/test/mockCtx.ts`. It is
  replay-reachable production code; this packet adds a sibling, never edits it.
- **The base `tsconfig.json`.** Not loosened, not re-scoped, absent from the diff.
- **Migrating the other ~20 per-file mock helpers** that do *not* currently
  error. Tempting while the shared builder is fresh, and out of scope: it would
  turn a targeted fix into a 30-file sweep with no gate signal to confirm it.
- **Every other error class** — the possibly-undefined, missing-state-field and
  long-tail classes stay inventoried.
- **Wiring the gate into CI.** D-24372 §2; the count is not zero yet.
- Any `any`, `@ts-ignore`, or `@ts-expect-error`.

## Files Expected to Change

| File | Change |
|---|---|
| `packages/game-engine/src/test/mockMoveContext.ts` | **new** — the shared builder |
| the 11 test files listed in §Scope (In) item 2 | local helper delegates to the builder |
| `packages/game-engine/src/ui/uiState.build.progress.test.ts` | 12 `UIBuildContext` + 3 `TS2540` sites |
| `packages/game-engine/src/ui/uiState.filter.test.ts` | 2 `UIBuildContext` sites |
| *(the 5 registry-mock + 1 `EffectNode` + 1 `spectrum` sites)* | **re-derive the exact list at execution** |
| `docs/ai/work-packets/WORK_INDEX.md` | refresh the backlog inventory counts |

## Contract

**Locked — the five forbidden events THROW, they do not no-op.** `endPhase`,
`endStage`, `pass`, `setActivePlayers`, `setStage` are exactly the `EventsAPI`
members `.claude/rules/architecture.md` forbids the engine from calling, and
the draft-time grep confirms it calls none of them. Stubbing them to throw makes
the completed type surface double as a runtime assertion of that rule. A no-op
stub would satisfy the compiler while leaving a violation silent — the failure
mode D-24372 exists to stop.

**Locked — the unused `RandomAPI` members THROW for the same reason.** The
engine uses `Shuffle` only. `D4` / `D6` / `D10` / `D12` / `D20` / `Die` /
`Number` throw.

**Locked — `Shuffle` keeps the reverse-shuffle semantics.** The shared builder
takes its `Shuffle` from `makeMockCtx`, whose documented reversal proves the
shuffle path actually executed. Changing it would silently weaken every test
that depends on that property.

**Locked — the shared builder lives at `src/test/mockMoveContext.ts` and
`mockCtx.ts` is not edited.** Per §Context; `mockCtx.ts` is imported by the
replay pipeline at runtime.

**Locked — production types are out of bounds.** A test that only compiles once
a production type widens is asserting something false: record it as a finding,
do not apply the widening.

## Acceptance Criteria

- **AC-1** — `pnpm --filter @legendary-arena/game-engine typecheck:tests`
  reports **zero `TS2345`** errors. The total is expected to fall but not to
  zero; record both numbers.
- **AC-2** — **The throwing stubs are proven to bite.** A test calls one of the
  five forbidden events (and one forbidden `RandomAPI` member) through the
  shared builder and asserts it throws. Without this, the stubs are decoration
  and the packet repeats WP-563's undemonstrated-gate failure.
- **AC-3** — `pnpm -r build` exits 0 and the engine `dist` differs from before
  by **exactly** the `mockMoveContext.{js,d.ts,js.map,d.ts.map}` additions —
  enumerated file-by-file, not asserted. No other `dist` file changes.
- **AC-4** — a grep confirms **zero** `any` / `@ts-ignore` / `@ts-expect-error`
  added anywhere in the diff.
- **AC-5** — `packages/game-engine/tsconfig.json` is unchanged
  (`git diff --name-only` empty for it).
- **AC-6** — the only non-`*.test.ts` file in the diff is the new
  `src/test/mockMoveContext.ts`. `src/test/mockCtx.ts` is **not** in the diff.
- **AC-7** — the engine test suite passes at or above its 2734 baseline (the
  AC-2 tests add to it; no test is removed or weakened).
- **AC-8** — both sentinel hashes unchanged. `mockCtx.ts` is untouched and the
  replay pipeline's RNG is therefore identical; if either hash moves, **STOP** —
  something production-reachable was edited.
- **AC-9** — the before/after `typecheck:tests` count is recorded in the
  governance close, and the `WORK_INDEX.md` backlog rows are updated to match.
- **AC-10** — the layered-failure finding is recorded in D-24378, so the next
  executor does not read "completing `events` changed nothing" as a dead end.

## Verification Steps

1. `pnpm -r build` → 0; enumerate the `dist` delta and confirm it is exactly the
   four `mockMoveContext.*` files.
2. `pnpm --filter @legendary-arena/game-engine typecheck:tests` → record the
   total; confirm `grep -c "error TS2345"` is **0**.
3. `pnpm --filter @legendary-arena/game-engine test` → ≥ 2734, 0 fail.
4. AC-2: run the forbidden-event and forbidden-random tests; confirm they pass
   by observing the throw (and that deleting the throw makes them fail).
5. `git diff` greps for `any` / `@ts-ignore` / `@ts-expect-error` → none.
6. `pnpm -r --no-bail test` → no new failures in any package.

## Definition of Done

- [ ] AC-1..AC-10 demonstrated with observed output.
- [ ] D-24378 landed **Active**.
- [ ] `WORK_INDEX.md` `[x]` + refreshed backlog inventory counts.
- [ ] `EC_INDEX.md` `Done`; mindmap `✅`; `roadmap:counts:check` 0.
- [ ] `STATUS.md` — before/after error counts, the `dist` delta stated
      explicitly (it is NOT byte-identical this time, by design), and a
      restatement that CI wiring remains deferred.

## Gate Verdicts (Drafting Session, 2026-08-17)

**Pre-flight (`01.4`): READY TO EXECUTE.** Hard-dep WP-563 is Done and on
`main` at `9b4a0e02`; D-24372 is Active; the reserved numbers landed on `main`
ahead of this body (PR #1506). Scope is closed and the one design fork was
settled by the operator before drafting completed, not deferred into execution.

**Empirical scaffold: RUN — and it corrected the packet twice.** Observed
`674 → 606` from two helper literals in two files; discovered the layered
`events` → `random` failure mode that makes a partial fix read as a no-op; and
corrected the reservation's "17 files" to **11** for the `MoveContext`
sub-class. It also surfaced the packaging fact (`src/test/` ships in `dist`;
replay imports `makeMockCtx` at runtime) that decided the shared-helper
location. None of this was reachable by reasoning about the error list.

**Copilot check (`01.7`): PASS** (1 RISK, FIXed in-place). Issue **11** (tests
validate behavior, not invariants) fired: a packet whose whole content is
"complete a type surface" can ship stubs nobody ever executes, exactly the
undemonstrated-gate failure WP-563 was written to end. FIXed by **AC-2**, which
requires the throwing stubs to be proven by a test that observes the throw.

## Lint Gate Self-Review

| § | Verdict | Note |
|---|---|---|
| 1 Goal user-visible | N/A → PASS | `none — infrastructure`; D-24026 inverts and STATUS says so. |
| 2 Scope closed | PASS | 4-item In; Out names `mockCtx.ts`, the base tsconfig, the 20 non-erroring helpers, other classes, CI wiring, suppressions. |
| 3 Assumes cite sources | PASS | WP-563/D-24372 + two architecture rules, each verified by grep at draft time. |
| 4 Files allowlist | PASS | Fixed rows + an explicitly re-derived tail list. |
| 5 Contract explicit | PASS | Five locked rules, incl. the operator-settled helper location. |
| 6 AC testable | PASS | 10 ACs; AC-2 proves the stubs, AC-3 enumerates the `dist` delta. |
| 7 Layer boundary | PASS | Engine test surface only; one new engine-internal test-support file. |
| 8 Determinism | PASS | `mockCtx.ts` untouched, so the replay RNG is identical; AC-8 makes a hash move a STOP. |
| 9 Persistence | N/A | Nothing stored. |
| 10–12 Move / phase / zone | N/A | No move, phase, or zone code changes. |
| 13 Canonical arrays | N/A | None added. |
| 14 Naming | PASS | `makeMockMoveContext` mirrors the existing `makeMockCtx`. |
| 15 Error handling | PASS | The throwing stubs carry full-sentence messages naming the forbidden call. |
| 16 Test extension | PASS | Tests are completed and strengthened; AC-7 forbids removing any. |
| 17 Vision | PASS | §14 observability / correctness; determinism line above. |
| 18 Dependencies complete | PASS | WP-563 Done on `main`. |
| 19 Lane eligibility | PASS | Two-session: 14+ files and a new shared test-support module. |
| 20 Knobs | N/A | No `SAFE-KNOBS.md` surface. |
| 21 API catalog | N/A | No endpoint, no library-only export change. |

**All 21 sections resolved.**

## Notes

**For the WP-563 backlog rows, after this packet lands.** The `TS2345` row
closes. The remaining classes are unchanged in kind but their counts must be
re-derived, not copied — WP-563 observed 703 → 674 and this packet moves it
again.

**Deliberately deferred, and worth its own small packet:** migrating the ~20
per-file mock helpers that do *not* currently error onto the shared builder.
Doing it here would be a 30-file sweep with no gate signal to confirm
correctness; doing it never leaves two idioms in one suite.

**Small finding, fixed in passing (§Scope In item 3).** One test asserts
`!hook.keywords.includes('spectrum')` — semantically correct (Spectrum is a
condition, not a keyword) but unrepresentable, because `HeroKeyword` makes
`'spectrum'` an illegal argument to `.includes`. The type system will not let
the test ask the question it is trying to ask. Fix it without a cast.
