# WP-572 — AST-Aware Fixture Migration (Game Engine tests + tooling)

**Status:** Drafted 2026-08-17
**EC:** [EC-607](../execution-checklists/EC-607-ast-aware-fixture-migration.checklist.md)
**Reserves:** D-24381
**Lane:** Standard two-session
**User-Visible Surface:** none — infrastructure
**Drafted off:** `origin/main` @ `755d4016`

---

## Goal

Finish what WP-571 started, as a **tooling** packet rather than another sweep:
route **every** engine fixture of the six required-field types through its
builder — including the ones no error points at — and prove it by re-running
WP-571's mutation and requiring **exactly one** break.

## Assumes

- **WP-571 / D-24380 (Done, scope amended)** — shipped six builders, routed 176
  literals, gate **289 → 134**, class **195 → 23**. Its AC-1 and AC-2 were
  **not met**, deliberately recorded as unmet, and this packet is the recorded
  follow-up.
- **D-24378 (Active)** and its second instance — deliberately-narrow registry
  mocks prove reader guards fire; completing them silences the behaviour under
  test.
- `typescript` is already a devDependency of `packages/game-engine`. **No new
  dependency is added.**

## Context

**WP-571 measured its own failure precisely, and this packet exists because of
what it measured — not because the work was left half-done out of fatigue.**

Two independent findings:

1. **An error-driven migration structurally cannot see already-complete
   literals.** WP-571's AC-2 mutation (a new required field on `PlayerZones`)
   broke **six** places, not one: `setup/playerInit.ts` (production, correct)
   plus five test sites whose literals were already complete and so were never
   routed.
2. **A regex cannot distinguish a value literal from a type annotation.** A
   first codemod hit type annotations and emitted syntax errors across 102
   files; a second, aimed at already-complete literals, broke 18 tests because
   `{ deck:` also matches non-`PlayerZones` shapes and the added keys failed
   deep-equality assertions. Both reverted.

**The premise of this packet was scaffolded, not inherited** — the lesson WP-571
paid for. A TypeScript compiler-API probe over `tsconfig.test.json`, using
`checker.getContextualType` on every `ObjectLiteralExpression`, resolves the six
target types precisely **and distinguishes `Record<string, PlayerZones>` (the
parent map) from `PlayerZones` (the element)** — exactly the precision regex
lacked. Measured program-wide:

| | |
|---|---|
| Literals of the six types | **230** |
| Files | **59** |
| Already routed through a builder (WP-571) | **173** |
| **Not yet routed** | **57** |

Those 57 are precisely the already-complete literals behind WP-571's six-way
mutation break.

## Scope (In)

1. A migration script driven by `checker.getContextualType`, matching the six
   type names **exactly** so `Record<string, T>` parents are excluded.
2. The **57 unrouted literals** across the affected files.
3. Builders for the residual types the census does not cover — the ~19
   UI-projection errors (`UICityCard` and siblings) and the two simulation ctx
   literals. **Re-derive the exact list at execution.**
4. `WORK_INDEX.md` — refresh the WP-563 backlog counts.

## Scope (Out)

- **The deliberately-narrow registry mocks.** They must **stay incomplete and
  erroring**: they prove reader guards fire, and completing them silences the
  behaviour under test (D-24378, and its second instance in
  `ui/uiState.build.test.ts`). The migration carries an explicit **skip-list**.
- **Widening or relaxing any production type.**
- The ~90-error long tail.
- **Wiring the gate into CI** — D-24372 §2; not until zero.
- Changing any assertion's subject or expected value.

## Files Expected to Change

| File | Change |
|---|---|
| a migration script (scratch or `scripts/`, executor's call) | new |
| the unrouted-literal files (~59 minus fully-routed) | literals → builders |
| new builder modules for residual types | new |
| `docs/ai/work-packets/WORK_INDEX.md` | refresh backlog counts |

## Contract

**Locked — the type checker is the oracle, never a source pattern.** Match the
six type names exactly via `checker.getContextualType`; `Record<string, T>` is
not `T`.

**Locked — idempotent, and guarded on the NODE.** Skip a literal that already
carries a builder spread. Guard on the AST node, not the source line — WP-570
shipped a line-level guard bug where one line carried two indexes.

**Locked — an explicit skip-list for deliberately-narrow fixtures.** Not every
diagnostic is a defect.

**Locked — the proof is a mutation, not a count.** See AC-1.

## Acceptance Criteria

- **AC-1** — **the packet's reason to exist.** Re-run WP-571's AC-2 mutation:
  add a required field to one of the six types and confirm **exactly ONE**
  break — the production builder. Anything more means the migration is
  incomplete and the packet has **not** delivered. Repeat for a second type.
- **AC-2** — `typecheck:tests`: the missing-required-state-field class reaches
  **zero except the documented skip-list**, and the skip-list is enumerated with
  its reason.
- **AC-3** — engine suite at or above its baseline, no test removed, renamed,
  skipped or weakened.
- **AC-4** — `pnpm -r build` exits 0; the `dist` delta is exactly any new
  builder modules, enumerated. Any other changed file is a **STOP**.
- **AC-5** — zero `any` / suppression pragmas added. *(Phrase the packet's own
  comments so they do not quote those tokens — WP-570 tripped its own grep.)*
- **AC-6** — zero **production** `src` files in the diff.
- **AC-7** — both sentinel hashes unchanged.
- **AC-8** — before/after counts recorded; backlog rows refreshed.

## Verification Steps

1. Run the census probe first and record the starting numbers.
2. Migrate, **running each file's suite as it is migrated** (EC-606 guardrail 4
   — violated once at real cost).
3. AC-1 mutation on two different types.
4. `pnpm -r build`; enumerate the `dist` delta.
5. `pnpm -r --no-bail test`.

## Definition of Done

- [x] AC-1..AC-8 demonstrated with observed output.
- [x] D-24381 landed **Active**.
- [x] `WORK_INDEX.md` `[x]` + refreshed backlog counts.
- [x] `EC_INDEX.md` `Done`; mindmap `✅`; `roadmap:counts:check` 0.
- [x] `STATUS.md` — before/after counts, **the AC-1 mutation result** as the
      proof the class cannot recur, and the enumerated skip-list.

## Gate Verdicts (Drafting Session, 2026-08-17)

**Pre-flight (`01.4`): READY TO EXECUTE.** Hard-dep WP-571 Done on `main`;
D-24378 and D-24380 Active; numbers reserved ahead of this body (PR #1517).

**Empirical scaffold: RUN, and it is the whole reason this packet is
credible.** WP-571 failed by inheriting an untested premise. This one probed
first: `checker.getContextualType` resolves all six types, distinguishes
`Record<string, T>` from `T`, and yields a census of 230 / 59 / 173 routed / 57
not. A first probe returned **zero** — a bug in the probe's own path filter,
found and fixed before drafting rather than discovered at execution.

**Copilot check (`01.7`): PASS** (1 RISK, FIXed in-place). Issue **11** (tests
validate behaviour, not invariants) fired: a migration packet can report a
falling error count while leaving the property undelivered — precisely WP-571's
outcome. FIXed by **AC-1**, which makes a *mutation* the acceptance and
explicitly rejects a count as evidence.

## Lint Gate Self-Review

| § | Verdict | Note |
|---|---|---|
| 1 Goal user-visible | N/A → PASS | `none — infrastructure`; D-24026 inverts. |
| 2 Scope closed | PASS | 4-item In; Out names the skip-list, production types, tail, CI wiring. |
| 3 Assumes cite sources | PASS | WP-571 + D-24378/24380; `typescript` already a devDep. |
| 4 Files allowlist | PASS | Script + census-derived files, re-derived at execution. |
| 5 Contract explicit | PASS | Four locked rules incl. node-level idempotence. |
| 6 AC testable | PASS | AC-1 is a mutation on two types and rejects counts as proof. |
| 7 Layer boundary | PASS | Engine test surface + engine-internal test support. |
| 8 Determinism | PASS | Test-only; AC-7 pins both hashes. |
| 9 Persistence | N/A | Nothing stored. |
| 10–12 Move / phase / zone | N/A | None touched. |
| 13 Canonical arrays | N/A | None added. |
| 14 Naming | PASS | Builders named for the type they build. |
| 15 Error handling | N/A | No runtime code. |
| 16 Test extension | PASS | AC-3 forbids removing or weakening any test. |
| 17 Vision | PASS | §14 observability / correctness; determinism line above. |
| 18 Dependencies complete | PASS | WP-571 Done. |
| 19 Lane eligibility | PASS | Two-session: 59 files and a migration tool. |
| 20 Knobs | N/A | None. |
| 21 API catalog | N/A | No endpoint. |

**All 21 sections resolved.**


---

## SCOPE AMENDED AT EXECUTION (2026-08-17) — read before the ACs above

**Operator decision: close this packet on AC-1 and spin the UI-projection family
into its own packet.** **AC-2 as written was NOT met** and is recorded as unmet,
never quietly relaxed.

**AC-1 — the packet's reason to exist — IS MET, on both required types.** Adding
a new required field now breaks **exactly one place**:

| Mutation | Breaks |
|---|---|
| `PlayerZones` + `quarantine` | `src/setup/playerInit.ts` (production) |
| `TurnEconomy` + `overkill` | `src/economy/economy.logic.ts` (production) |

**Zero test sites in either case.** WP-571's equivalent mutation broke six. The
property the builder arc exists for now holds for the six-type family, and it is
proven by mutation rather than inferred from a falling error count — which
D-24381 §3 explicitly rejects as evidence.

**AC-2 (class → zero except the skip-list): NOT MET.** 18 errors remain — **16
UI-projection literals** across five types (`UICityCard` 8,
`UITurnEconomyState` / `UISchemeState` / `UIMastermindState` / `UICityState` at
2 each), 1 `SeedParArtifact`, and the 1 intentional skip-list entry. The UI
family is a **different family** from the six this packet targeted: different
types, different module, and its own builder set. It is split into its own
packet rather than absorbed here.

**Delivered and verified:** census reproduced the draft figure exactly (230
literals / 173 already routed / 1 skip-listed / **56 migrated**); gate
**134 → 126**; class **23 → 18**; engine suite **2740 / 2740**; `dist`
**byte-identical** (752 files); **zero** non-test files in the diff; **zero**
suppressions. The skip-list worked as designed — `ui/uiState.build.test.ts`'s
deliberately-narrow registry mock stays erroring, because completing it silences
the reader guard the test exists to prove fires.

**One measurement error, recorded because the shape recurs:** a case-insensitive
grep for `TurnEconomy` also matched `UITurnEconomyState`, briefly making
mutation 2 look like it broke two test sites. It had not — those were
pre-existing UI residuals. Re-measured with an exact type match before anything
was claimed. **When a type name is a prefix of another, grep exactly.**

## Notes

**Why the mutation is the acceptance and the count is not.** WP-571 reduced the
class by 88% and still did not deliver the property, because the property is
conditional on migration *completeness*. A falling error count is compatible
with a builder that absorbs nothing. Only the mutation distinguishes them, and
D-24380's clause 2 was amended to say exactly this.

**After this packet** the arc has only the ~90-error long tail before the CI
wiring the whole arc exists to enable.
