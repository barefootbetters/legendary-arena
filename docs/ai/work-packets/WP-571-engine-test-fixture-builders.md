# WP-571 — Engine Test Fixture Builders (Game Engine tests)

**Status:** Drafted 2026-08-17
**EC:** [EC-606](../execution-checklists/EC-606-engine-test-fixture-builders.checklist.md)
**Reserves:** D-24380
**Lane:** Standard two-session
**User-Visible Surface:** none — infrastructure
**Drafted off:** `origin/main` @ `9fac4060`

---

## Goal

Close the missing-required-state-field class — `TS2739` (113) + `TS2741` (82) =
**195 errors across 49 files** — by routing engine test fixtures through shared
builders instead of bare object literals. This is the class WP-563 named **the
finding, not the chore**: these tests construct **structurally invalid
`LegendaryGameState` values and pass**, and have for as long as the missing
fields have existed.

## Assumes

- **WP-563 / D-24372 (Done)** — the gate exists. §3 (fix, never silence) and §2
  (CI wiring deferred until zero) govern unchanged.
- **WP-569 / D-24378 (Done)** — established that shared engine test-support
  lives in a `src/test/` sibling module, and that its presence in `dist` is an
  accepted, enumerated cost. This packet applies that precedent rather than
  re-opening it.
- **WP-570 / D-24379 (Done)** — established the per-file sweep-then-verify
  discipline this packet reuses, and left the gate at **289**.
- The 4 deliberate narrow-registry sites in
  `buildInitialGameState.loadout.test.ts` are `TS2345`, a **different class**,
  and are a recorded finding (D-24378). Verified separate at draft time:
  `loadout.test.ts` does **not** appear among this class's 19
  `CardRegistryReader` sites.

## Context

**The 195 collapse to six types**, each with a fixed missing-field set —
measured, not estimated:

| Type | Errors | Missing fields |
|---|---|---|
| `PlayerZones` | 47 | `faceDownCards` |
| `CardStatEntry` | 32 | `fightCostMode`, `fightCostBase` |
| `MastermindState` | 28 | `strikePile`, `attachedBystanders` |
| `TurnEconomy` | 26 | `piercing`, `woundsDrawn` |
| `GlobalPiles` | 24 | `horrors` |
| `CardRegistryReader` | 19 | `listSets`, `getSet` |

That is 176; the remaining ~19 are UI-projection types (`UICityCard` and
siblings, ~16) and 3 one-offs.

**Why builders, and not 195 inline field additions.** This is the load-bearing
decision, and the evidence for it is unusually direct: **these did not
accumulate from one mistake.** `git log -S` at draft time dates `faceDownCards`
to **WP-282** and `horrors` to **WP-156** — separate packets, months apart —
and there are at least **six** such field-addition events. Every one added a
required field and left the fixtures structurally invalid, undetected because
nothing compiled them.

Adding the fields inline would make today's 195 errors go away and **restore
the exact preconditions for a seventh**. A builder that supplies canonical
defaults means the next required field is added in **one place** and every
fixture inherits it. That property — not tidiness — is why this packet exists
in this shape.

**This applies an operator decision rather than re-opening one.** WP-569 settled
that shared engine test-support belongs in a `src/test/` sibling module and that
its appearance in `dist` is an accepted, enumerated cost. The situation here is
the same and the multiplier is larger (49 files, far past the code-style
"abstract on the third copy" threshold).

## Scope (In)

1. **Six builders** under `packages/game-engine/src/test/`, one per incomplete
   type, each supplying the canonical default for **every** required field and
   accepting a partial override.
2. The **49 test files**, migrated from bare literals to the builders.
3. The ~19 residual sites (UI-projection types + 3 one-offs) — **re-derive the
   exact list at execution** and fix in the same idiom where a builder fits, or
   inline where it does not.
4. `WORK_INDEX.md` — refresh the WP-563 backlog counts.

## Scope (Out)

- **Widening or relaxing any production type** to accept a partial fixture. The
  fixtures are wrong; that is the entire finding. Same boundary D-24378 defends
  for `CardRegistryReader`.
- **The 4 deliberate narrow-registry `TS2345` sites** in
  `buildInitialGameState.loadout.test.ts` — different class, recorded finding,
  and their fix is relocating assertions to the builder seam.
- **The base `tsconfig.json`.**
- The ~90-error long tail (`TS2540`, `TS2322`, `TS2554`, and eleven smaller
  codes).
- **Wiring the gate into CI.** After this packet the gate is ~94 — still not
  zero. D-24372 §2.
- Changing any assertion's subject or expected value.

## Files Expected to Change

| File | Change |
|---|---|
| `packages/game-engine/src/test/` — six new builder modules | **new** |
| 49 engine test files | literals → builders |
| *(exact per-file list)* | **re-derive at execution** |
| `docs/ai/work-packets/WORK_INDEX.md` | refresh backlog counts |

## Contract

**Locked — one builder per incomplete type**, each supplying the canonical
default for every required field and accepting a partial override.

**Locked — defaults are READ from the production type and its setup code, never
invented.** A wrong default silently changes what dozens of tests assert. A
builder that lies is worse than the literals it replaces.

**Locked — the fixtures are wrong, never the types.** No production type is
widened, relaxed, or made optional to accept a partial fixture.

**Locked — the builder must be shown to earn its keep.** See AC-2.

**Locked — `dist` gains only the new `src/test/` modules**, enumerated
file-by-file. This is the WP-569 precedent, not WP-570's byte-identical rule.

## Acceptance Criteria

- **AC-1** — `typecheck:tests` reports **zero** `TS2739` and **zero** `TS2741`.
  Record the total before and after.
- **AC-2** — **the builder is proven to earn its keep, by mutation.** Add a new
  required field to one of the six types; confirm the break is **exactly one
  place** (that builder) and not 47; then revert. Without this the packet is
  195 inline edits wearing a helper's clothes, and nobody would know until the
  seventh field addition.
- **AC-3** — the engine suite is at or above **2740**, with no test removed,
  renamed, skipped or weakened.
- **AC-4** — `pnpm -r build` exits 0 and the engine `dist` delta is **exactly**
  the new `src/test/` modules, enumerated file-by-file. Any other changed file
  is a **STOP**.
- **AC-5** — a grep confirms **zero** `any` / `@ts-ignore` / `@ts-expect-error`
  added. *(Phrase the packet's own comments so they do not quote these tokens —
  WP-570 tripped its own grep on its documentation.)*
- **AC-6** — zero **production** `src` files in the diff. Only `src/test/`
  modules and `*.test.ts` files.
- **AC-7** — both sentinel hashes unchanged.
- **AC-8** — **no default was invented.** For each of the six types, the
  chosen default is cited to the production type or the setup code that
  produces it.
- **AC-9** — before/after counts recorded and the `WORK_INDEX.md` backlog rows
  refreshed.

## Verification Steps

1. `pnpm -r build` → 0; enumerate the `dist` delta.
2. `typecheck:tests` → record the total; confirm `TS2739` and `TS2741` are 0.
3. `pnpm --filter @legendary-arena/game-engine test` → ≥ 2740, 0 fail.
4. **Migrate one file, run its suite, then move on** — WP-570 proved this
   catches a bad sweep while the blast radius is one file.
5. AC-2 mutation: add a required field to one type, observe a single break,
   revert.
6. `pnpm -r --no-bail test` → no new failures.

## Definition of Done

- [ ] AC-1..AC-9 demonstrated with observed output.
- [ ] D-24380 landed **Active**.
- [ ] `WORK_INDEX.md` `[x]` + refreshed backlog counts.
- [ ] `EC_INDEX.md` `Done`; mindmap `✅`; `roadmap:counts:check` 0.
- [ ] `STATUS.md` — before/after counts, the `dist` delta stated explicitly,
      and the AC-2 mutation result recorded as the proof the class will not
      recur.

## Gate Verdicts (Drafting Session, 2026-08-17)

**Pre-flight (`01.4`): READY TO EXECUTE.** Hard-deps WP-563, WP-569 and WP-570
are all Done on `main` (`9fac4060`); D-24372, D-24378 and D-24379 Active;
numbers landed on `main` ahead of this body (PR #1514). The one design decision
— builders vs inline — is settled by the WP-569 precedent plus the recurrence
evidence, not deferred into execution.

**Empirical scaffold: RUN.** All 195 errors classified by target type and
missing-field set (six types = 176, UI types ~16, one-offs 3). `git log -S`
traced two of the six fields to their originating packets (WP-282, WP-156),
establishing the recurrence that decides the packet's shape. The 4 deliberate
narrow-registry sites were verified to be a **different class** and absent from
this class's file list.

**Copilot check (`01.7`): PASS** (1 RISK, FIXed in-place). Issue **19** (a new
abstraction justified by tidiness rather than by a property it provides) fired —
a fixture builder is exactly the shape that gets added because it looks cleaner
and then delivers nothing. FIXed by **AC-2**, which requires proving by mutation
that a new required field breaks one place instead of forty-seven.

## Lint Gate Self-Review

| § | Verdict | Note |
|---|---|---|
| 1 Goal user-visible | N/A → PASS | `none — infrastructure`; D-24026 inverts. |
| 2 Scope closed | PASS | 4-item In; Out names production types, the 4 deliberate sites, tsconfig, the tail, CI wiring. |
| 3 Assumes cite sources | PASS | Three landed WPs with their D-entries; the exclusion verified by measurement. |
| 4 Files allowlist | PASS | Six new modules + 49 files, list re-derived at execution. |
| 5 Contract explicit | PASS | Five locked rules, incl. defaults-are-read-not-invented. |
| 6 AC testable | PASS | 9 ACs; AC-2 is the earns-its-keep mutation, AC-8 pins default provenance. |
| 7 Layer boundary | PASS | Engine test surface + engine-internal test-support modules. |
| 8 Determinism | PASS | Test-only; AC-7 pins both hashes. |
| 9 Persistence | N/A | Nothing stored. |
| 10–12 Move / phase / zone | N/A | None touched. |
| 13 Canonical arrays | N/A | None added. |
| 14 Naming | PASS | Builders named for the type they build. |
| 15 Error handling | N/A | No runtime code. |
| 16 Test extension | PASS | AC-3 forbids removing, renaming, skipping or weakening any test. |
| 17 Vision | PASS | §14 observability / correctness; determinism line above. |
| 18 Dependencies complete | PASS | All three hard-deps Done. |
| 19 Lane eligibility | PASS | Two-session: 49 files and six new modules. |
| 20 Knobs | N/A | No `SAFE-KNOBS.md` surface. |
| 21 API catalog | N/A | No endpoint. |

**All 21 sections resolved.**

## Notes

**What "structurally invalid and passing" actually means here.** A test that
builds `PlayerZones` without `faceDownCards` is not exercising the type the
engine ships. It passes because nothing it asserts touches the missing field —
until a future change makes the engine read it, at which point the test's
fixture and the engine's expectation diverge silently. That is the drift the
gate was built to surface, and it is why this class was worth its own packet
rather than a sweep.

**The defaults are already written down — read them, do not invent them.** Each
of the six types documents its own default in its docblock, which is the AC-8
provenance:

| Type · field | Default | Cited from |
|---|---|---|
| `PlayerZones.faceDownCards` | `[]` | `readonly FaceDownCard[]`; empty at setup |
| `CardStatEntry.fightCostMode` | `'static'` | "All existing cards default to `'static'`. WP-214" |
| `CardStatEntry.fightCostBase` | `0` | "Always 0 for static" |
| `MastermindState.strikePile` | `[]` | "append-only"; empty at setup |
| `MastermindState.attachedBystanders` | `[]` | "append-only during strike resolution" |
| `TurnEconomy.piercing` | `0` | "No MVP producer — always 0 until a future hero ability WP" |
| `TurnEconomy.woundsDrawn` | `0` | "Reset to all zeros at the start of each player turn" |
| `GlobalPiles.horrors` | `[]` | `Zone` |
| `CardRegistryReader.listSets` / `.getSet` | `() => []` / `() => undefined` | WP-563 / WP-569 precedent |

**The boundary this packet defends has ALREADY been breached twice, and that is
the strongest argument for it.** Two production fields carry the comment
*"Optional on the G type so existing test fixtures compile without
modification"* — `MastermindState.gameText`
(`mastermind/mastermind.types.ts:51`) and a field in
`scheme/schemeState.types.ts:25`. In both cases a **production type was bent to
fit invalid fixtures**, because fixing the fixtures was expensive and nothing
forced the issue. That is exactly what D-24380 §4 now forbids, and it is why
the rule needed writing down rather than assuming. **Out of scope here** —
those two fields are already optional and shipped; re-tightening them is its
own packet with its own blast radius. They are recorded so the next reader
knows the pressure is real, not hypothetical.

**After this packet the gate is ~94** — the long tail (`TS2540` 20, `TS2322`
15, `TS2554` 12, `TS2339` 9, and eleven smaller codes), then the CI wiring the
whole arc exists to enable.
