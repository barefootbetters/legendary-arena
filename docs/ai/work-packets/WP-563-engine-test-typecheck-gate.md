# WP-563 — Engine Test-Typecheck Gate (Game Engine / CI)

**Status:** Drafted 2026-08-17
**EC:** [EC-598](../execution-checklists/EC-598-engine-test-typecheck-gate.checklist.md)
**Reserves:** D-24372
**Lane:** Standard two-session
**User-Visible Surface:** none — infrastructure
**Drafted off:** `origin/main` @ `16d3fa77`

---

## Goal

Make the engine's type-level drift pins actually gate. `packages/game-engine`
test files have **never been compiled**: `tsconfig.json` excludes
`src/**/*.test.ts`, the package has only `build` and `test` scripts, and `tsx`
transpiles without checking. Every `satisfies`-based "compile-time drift pin"
in the suite is therefore documentation — including pins whose comments
explicitly promise compile-time enforcement. This packet adds the gate, fixes
the highest-value slice of what it surfaces, and records the rest as scoped
follow-ups rather than suppressing it.

## Assumes

- **WP-557 / EC-592** — discovered this gap, worked around it locally with a
  runtime keyset assertion, and named the general fix as its first post-mortem
  follow-up. This is that follow-up.
- `packages/game-engine/tsconfig.json` excludes `src/**/*.test.ts` and emits
  declarations to `dist` via `rootDir`/`outDir`.
- The repo's other apps (`arena-client`, `registry-viewer`, `dashboard`)
  already carry real `typecheck` scripts that CI runs — the gap is
  engine-specific.

## Context

**Why this exists.** During WP-557 I extended the `UIProgressCounters` drift
pin and checked whether its `satisfies` actually enforced anything. It does
not. The comment above it claims a rename "fails this `satisfies` check at
compile time"; nothing compiles the file. The same is true of the
`UIParBreakdown` pin beside it. WP-557 shipped a **runtime** keyset assertion
as a local workaround and deliberately left the general case alone, because a
tsconfig + CI change was well outside that packet's allowlist.

**The scaffold was mandatory and it changed the packet.** The blast radius was
unknown *by construction* — nobody had ever compiled these files. An observed
run against a `tsconfig.test.json` produced:

| | Observed |
|---|---|
| Total errors | **692** |
| Files affected | **110** |
| Files with ≤ 2 errors | **59** |
| Errors in drift-pin files | **2** |

Breakdown by class:

| Class | Count | What it actually is |
|---|---|---|
| `TS2739` / `TS2741` missing properties | **197** | Tests building `LegendaryGameState` without required fields — `horrors`, `faceDownCards`, `strikePile`, `attachedBystanders` |
| `TS2345` argument not assignable | **159** | One root cause: the mock ctx vs boardgame.io's `DefaultPluginAPIs`, concentrated in 2 files |
| `TS2532` / `TS18048` possibly undefined | **209** | `noUncheckedIndexedAccess` on test indexing; only **10** files |
| `TS2304` cannot find name | **27** | Missing imports — e.g. `CardExtId` in `uiState.filter.test.ts`, making the annotation silently `any` |

**The 197 is the finding, not the chore.** Those tests have been constructing
**structurally invalid game states** and passing, for as long as the fields
have existed. That is precisely the drift the absent gate was supposed to
catch, and it is the strongest argument for the gate existing at all.

**Why the scope is split (operator-approved 2026-08-17).** 692 fixes in one
packet is the shape of change that produces exactly the `any`-casts D-24372
forbids. This packet ships the mechanism plus the slice that restores the
protection WP-557 flagged; the remainder lands as scoped follow-ups by error
class. **The gate is deliberately NOT wired into CI here** — a red required
check on `main` with ~600 known errors blocks every unrelated PR. CI wiring
lands with the final cleanup packet, when the count is zero.

## Scope (In)

1. `packages/game-engine/tsconfig.test.json` — **new**. Extends the base,
   drops the `src/**/*.test.ts` exclusion, sets `noEmit`. The shipped build's
   `rootDir` / `outDir` / `declaration` output is untouched.
2. `packages/game-engine/package.json` — a `typecheck:tests` script running it.
3. **Fix the drift-pin files** (2 errors) — the protection WP-557 flagged.
4. **Fix the `TS2304` missing-import class** (27 errors) — each one is an
   annotation that silently degrades to `any`, so these are latent defects
   rather than noise.
5. `docs/ai/REFERENCE/00.6-code-style.md` **or** `.claude/rules/code-style.md`
   — record that engine drift pins must be **runtime** assertions until the
   gate is green, so nobody writes another `satisfies` believing it gates.
6. A follow-up inventory in `WORK_INDEX.md`: the remaining classes as named,
   sized, unreserved packets.

## Scope (Out)

- **Wiring the gate into CI.** Deferred to the final cleanup packet, by design.
- **The other ~663 errors.** Recorded, not fixed, not suppressed.
- **Any non-test `src/**/*.ts` file.** If a *production* type must change to
  satisfy a test, that is a signal the test is asserting something wrong —
  STOP and re-scope rather than edit production types.
- Any change to the base `tsconfig.json`, and specifically any loosening of
  `strict`, `exactOptionalPropertyTypes`, or `noUncheckedIndexedAccess`.
- Any `any` cast, `@ts-ignore`, or `@ts-expect-error` added to silence an error.

## Files Expected to Change

| File | Change |
|---|---|
| `packages/game-engine/tsconfig.test.json` | **new** |
| `packages/game-engine/package.json` | add `typecheck:tests` |
| `packages/game-engine/src/ui/uiState.types.drift.test.ts` | fix its 2 errors |
| `packages/game-engine/src/ui/uiState.filter.test.ts` | add the missing `CardExtId` import |
| *(other `TS2304` files as the scaffold lists them)* | add missing imports |
| `.claude/rules/code-style.md` | record the runtime-pin rule |
| `docs/ai/work-packets/WORK_INDEX.md` | the follow-up inventory |

**The exact `TS2304` file list is re-derived at execution** from a fresh run —
the draft-time list is 4 days' drift away from being wrong.

## Contract

**Locked — the config is additive and emits nothing.** `tsconfig.test.json`
extends the base and sets `noEmit: true`. `pnpm -r build` output must be
**byte-identical** afterward.

**Locked — fix the tests, never silence them (D-24372 §3).** No `any`, no
`@ts-ignore`, no `@ts-expect-error`, no base-tsconfig loosening. If an error
cannot be fixed inside a test file, it is recorded as a follow-up, not
suppressed.

**Locked — production types are out of bounds.** A test that only compiles if
a production type is widened is asserting something false; that is a finding,
not a fix.

**Locked — CI wiring is deferred.** The script exists and runs locally; the
required-check wiring lands when the count reaches zero.

## Acceptance Criteria

- **AC-1** — `pnpm --filter @legendary-arena/game-engine typecheck:tests` runs
  and reports errors (it is expected to be non-zero at this stage; the packet
  ships the *mechanism*, not a green gate).
- **AC-2** — `pnpm -r build` exits 0 and its `dist` output is **byte-identical**
  to before (the new config is `noEmit` and additive).
- **AC-3** — the drift-pin files compile clean: a rename of a pinned field now
  **fails the gate**, demonstrated by a mutation (rename → red → restore).
- **AC-4** — every `TS2304` in scope is fixed by adding the real import, and a
  grep confirms **zero** `any` / `@ts-ignore` / `@ts-expect-error` added
  anywhere in the diff.
- **AC-5** — the base `tsconfig.json` is **unchanged**
  (`git diff --name-only -- packages/game-engine/tsconfig.json` empty).
- **AC-6** — zero non-test `src/**/*.ts` files in the diff.
- **AC-7** — the engine test suite still passes at its baseline count.
- **AC-8** — both sentinel hashes unchanged (tooling-only change).
- **AC-9** — the error count **before and after** is recorded in the
  governance close, so the remaining backlog is a number, not a vibe.
- **AC-10** — the follow-up inventory names each remaining class with its
  observed count and file concentration.

## Verification Steps

1. `pnpm -r build` → 0; confirm `dist` unchanged.
2. `pnpm --filter @legendary-arena/game-engine typecheck:tests` → record the
   count.
3. `pnpm --filter @legendary-arena/game-engine test` → baseline count.
4. AC-3 mutation: rename a pinned field, confirm the gate goes red, restore.
5. `git diff` greps for `any` / `@ts-ignore` / `@ts-expect-error` → none.
6. `pnpm -r --no-bail test` → no new failures.

## Definition of Done

- [ ] AC-1..AC-10 demonstrated with observed output.
- [ ] D-24372 landed **Active**.
- [ ] `WORK_INDEX.md` `[x]` + the follow-up inventory rows.
- [ ] `EC_INDEX.md` `Done`; mindmap `✅`; counts 0.
- [ ] `STATUS.md` — the before/after error count, and the explicit note that
      CI wiring is deferred **by design** so nobody reads its absence as an
      oversight.

## Gate Verdicts (Drafting Session, 2026-08-17)

**Pre-flight (`01.4`): READY TO EXECUTE.** Artifact:
`docs/ai/invocations/preflight-wp563-engine-test-typecheck.md`.

**Empirical scaffold: RUN — MANDATORY for this class, and it re-scoped the
packet.** The blast radius was unknown by construction. Observed **692 errors
across 110 files**; the full-fix packet the reservation originally implied was
abandoned in favour of mechanism + high-value slice + recorded inventory,
which is D-24372 §4 operating as written. Operator approved the split
2026-08-17.

**Copilot check (`01.7`): PASS** (1 RISK, FIXed in-place). Artifact:
`docs/ai/invocations/copilot-wp563-engine-test-typecheck.md`. Issue **11**
(tests validate behavior, not invariants) fired on a packet whose entire
subject is a non-functioning invariant gate: shipping a script that nobody
runs would reproduce the very problem. FIXed by **AC-3**, which mutation-tests
the restored pin red→green rather than asserting the gate "works".

## Lint Gate Self-Review

| § | Verdict | Note |
|---|---|---|
| 1 Goal user-visible | N/A → PASS | `none — infrastructure`; the D-24026 gate inverts and STATUS says so. |
| 2 Scope closed | PASS | 6-item In; Out names CI wiring, the other ~663 errors, production types, tsconfig loosening, and suppression. |
| 3 Assumes cite sources | PASS | WP-557's post-mortem is the origin and is cited. |
| 4 Files allowlist | PASS | Fixed rows + an explicitly re-derived `TS2304` list. |
| 5 Contract explicit | PASS | Four locked rules. |
| 6 AC testable | PASS | 10 ACs; AC-3 is a mutation test, AC-9 records a number. |
| 7 Layer boundary | PASS | Engine + repo tooling only. |
| 8 Determinism | PASS | Tooling-only; AC-8 pins both hashes. |
| 9 Persistence | N/A | Nothing stored. |
| 10–12 Move / phase / zone | N/A | None touched. |
| 13 Canonical arrays | N/A | None added. |
| 14 Naming | PASS | `typecheck:tests` mirrors the existing `typecheck` convention. |
| 15 Error handling | N/A | No runtime code. |
| 16 Test extension | PASS | Tests are **fixed**, never weakened — the whole point. |
| 17 Vision | PASS | §14 observability / correctness. |
| 18 Dependencies complete | PASS | WP-557 Done. |
| 19 Lane eligibility | PASS | Two-session: a new build-config surface and a multi-file fix set. |
| 20 Knobs | N/A | No `SAFE-KNOBS.md` surface. |
| 21 API catalog | N/A | No endpoint. |

**All 21 sections resolved.**

## Notes

The remaining backlog, for the follow-up inventory:

| Class | Count | Concentration |
|---|---|---|
| Missing required state fields | ~197 | broad — the stale-fixture class |
| Mock ctx vs `DefaultPluginAPIs` | ~159 | **2 files** (`heroEffects.execute.test.ts`, `villainDeck.reveal.test.ts`) — likely one shared fix |
| Possibly-undefined indexing | ~209 | **10 files** |

The middle row is the best next packet: 159 errors concentrated in two files
behind what looks like a single mock-typing root cause.
