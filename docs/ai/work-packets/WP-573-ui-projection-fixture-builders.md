# WP-573 — UI-Projection Fixture Builders (Game Engine tests)

**Status:** Drafted 2026-08-17
**EC:** [EC-608](../execution-checklists/EC-608-ui-projection-fixture-builders.checklist.md)
**Reserves:** D-24382
**Lane:** Standard two-session
**User-Visible Surface:** none — infrastructure
**Drafted off:** `origin/main` @ `eba94293`

---

## Goal

Close the **last** fixture family in the WP-563 arc — the UI-projection types
WP-572 deliberately split out — using the mechanism the previous two packets
built and proved. After this, only the ~90-error long tail stands between the
arc and the CI wiring it exists to enable.

## Assumes

- **WP-571 / D-24380 (Done, scope amended)** — built the six builders and the
  read-the-default-from-the-production-type rule.
- **WP-572 / D-24381 (Done on AC-1, UI family split)** — proved the
  checker-driven migration (zero syntax errors, against a regex's 102 broken
  files) and proved the property by **mutation**: a new required field breaks
  exactly one place.
- `typescript` is already a devDependency; `src/test/fixtureBuilders.ts` exists.

## Context

**This is the smallest packet of the arc, and deliberately so.** The residual is
**17 errors across three files**, all in the simulation harness — because the UI
projections are only fixtured there:

| File | Errors |
|---|---|
| `simulation/ai.competent.test.ts` | 12 |
| `simulation/simulation.test.ts` | 4 |
| `simulation/par.storage.test.ts` | 1 |

By type: `UICityCard` **8**; `UITurnEconomyState`, `UISchemeState`,
`UIMastermindState`, `UICityState` **2 each**; plus one `SeedParArtifact`.

Compare WP-571 (49 files) and WP-572 (56 sites across the tree). **Nothing here
is novel** — the packet exists to finish a family, not to decide anything.

**Why the acceptance is still a mutation and not a count.** WP-571 reduced its
class by 88% and delivered **no property at all**; WP-572's mutation is what
proved the difference. D-24381 §3 makes that explicit, and this packet inherits
it unchanged.

## Scope (In)

1. **Five builders** — `UICityCard`, `UICityState`, `UIMastermindState`,
   `UISchemeState`, `UITurnEconomyState` — each supplying the canonical default
   for every required field, **read** from `ui/uiState.types.ts` and the
   `buildUIState` code that populates it.
2. The **three files**, migrated by the checker-driven pass.
3. The one `SeedParArtifact` site — inline if a builder does not fit.
4. `WORK_INDEX.md` — refresh the WP-563 backlog counts.

## Scope (Out)

- **Widening or relaxing any production type.** The fixtures are wrong
  (D-24380, D-24381).
- **The deliberately-narrow skip-list fixtures** — they must stay erroring.
- The ~90-error long tail.
- **Wiring the gate into CI** — D-24372 §2; not until zero.
- Changing any assertion's subject or expected value.

## Files Expected to Change

| File | Change |
|---|---|
| `packages/game-engine/src/test/` — UI-projection builders | new |
| `src/simulation/ai.competent.test.ts` | ~12 |
| `src/simulation/simulation.test.ts` | ~4 |
| `src/simulation/par.storage.test.ts` | ~1 |
| `docs/ai/work-packets/WORK_INDEX.md` | refresh counts |

**Re-derive the exact list at execution.**

## Contract

**Locked — defaults are READ from the production type, never invented.** A
wrong default silently changes what the simulation tests assert.

**Locked — the fixtures are wrong, never the types.**

**Locked — checker-driven migration**, exact type-name match so
`Record<string, T>` parents are excluded.

**Locked — the proof is a mutation, not a count** (D-24381 §3).

## Acceptance Criteria

- **AC-1** — **the mutation.** Add a required field to a UI-projection type and
  confirm **exactly ONE** break. A falling error count is **not** evidence.
- **AC-2** — `typecheck:tests`: the UI-projection errors reach **zero**; record
  the total before and after.
- **AC-3** — engine suite at or above baseline; no test removed, renamed,
  skipped or weakened.
- **AC-4** — `pnpm -r build` exits 0; the `dist` delta is exactly the new
  builder module(s), enumerated. Any other changed file is a **STOP**.
- **AC-5** — zero `any` / suppression pragmas added. *(Phrase the packet's own
  comments so they do not quote those tokens — WP-570 tripped its own grep.)*
- **AC-6** — zero **production** `src` files in the diff.
- **AC-7** — both sentinel hashes unchanged.
- **AC-8** — before/after counts recorded; backlog rows refreshed.

## Verification Steps

1. Run the census/probe first; record starting numbers.
2. Migrate, **running each file's suite as it is migrated**.
3. AC-1 mutation. **Grep the type name EXACTLY** — see §Notes.
4. `pnpm -r build`; enumerate the `dist` delta.
5. `pnpm -r --no-bail test`.

## Definition of Done

- [x] AC-1..AC-8 demonstrated with observed output.
- [x] D-24382 landed **Active**.
- [x] `WORK_INDEX.md` `[x]` + refreshed backlog counts.
- [x] `EC_INDEX.md` `Done`; mindmap `✅`; `roadmap:counts:check` 0.
- [x] `STATUS.md` — before/after counts and **the AC-1 mutation result**.

## Gate Verdicts (Drafting Session, 2026-08-17)

**Pre-flight (`01.4`): READY TO EXECUTE.** Hard-deps WP-571 and WP-572 Done on
`main`; D-24380 and D-24381 Active; numbers reserved ahead of this body
(PR #1519).

**Empirical scaffold: RUN.** The residual was measured from WP-572's own
post-execution typecheck output — 17 errors, three files, five types plus one
`SeedParArtifact` — not estimated. The mechanism was proved by WP-572 in the
same repo, so this packet inherits a *demonstrated* premise rather than an
assumed one.

**Copilot check (`01.7`): PASS** (1 RISK, FIXed in-place). Issue **19** (a new
abstraction justified by consistency rather than by a property) fired — five
more builders for 17 errors is exactly the shape that gets waved through.
FIXed by **AC-1**, which is the same mutation acceptance the family's earlier
packets had to satisfy.

## Lint Gate Self-Review

| § | Verdict | Note |
|---|---|---|
| 1 Goal user-visible | N/A → PASS | `none — infrastructure`; D-24026 inverts. |
| 2 Scope closed | PASS | 4-item In; Out names production types, the skip-list, the tail, CI wiring. |
| 3 Assumes cite sources | PASS | WP-571/WP-572 with their D-entries. |
| 4 Files allowlist | PASS | Three files + builders, re-derived at execution. |
| 5 Contract explicit | PASS | Four locked rules. |
| 6 AC testable | PASS | AC-1 is a mutation and rejects counts as proof. |
| 7 Layer boundary | PASS | Engine test surface + engine-internal test support. |
| 8 Determinism | PASS | Test-only; AC-7 pins both hashes. |
| 9 Persistence | N/A | Nothing stored. |
| 10–12 Move / phase / zone | N/A | None touched. |
| 13 Canonical arrays | N/A | None added. |
| 14 Naming | PASS | Builders named for the type they build. |
| 15 Error handling | N/A | No runtime code. |
| 16 Test extension | PASS | AC-3 forbids removing or weakening any test. |
| 17 Vision | PASS | §14 observability / correctness; determinism line above. |
| 18 Dependencies complete | PASS | Both hard-deps Done. |
| 19 Lane eligibility | PASS | Two-session, consistent with the arc; the PAR-adjacent file keeps it out of the lightweight lane. |
| 20 Knobs | N/A | None. |
| 21 API catalog | N/A | No endpoint. |

**All 21 sections resolved.**

## Notes

**Grep type names EXACTLY when verifying the mutation.** During WP-572 a
case-insensitive grep for `TurnEconomy` also matched `UITurnEconomyState`,
briefly misreading two pre-existing residuals as new breaks. This packet works
on the very types that collide, so the trap is live here. It is the same class
of self-inflicted false signal as WP-570's documentation tripping its own
suppression grep.

**After this packet the arc's fixture work is complete.** What remains is the
~90-error long tail (`TS2540` 20, `TS2322` 15, `TS2554` 12, `TS2339` 9, and
eleven smaller codes) and then the CI wiring — the thing every packet in this
arc has been deferring, by design, since D-24372 §2.
