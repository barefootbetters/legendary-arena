# EC-598 — Engine Test-Typecheck Gate

**WP:** [WP-563](../work-packets/WP-563-engine-test-typecheck-gate.md)
**Layer:** Game Engine + repo tooling
**Lane:** Standard two-session
**Reserves:** D-24372

> The WP is the authoritative design document. If this EC and the WP
> conflict, the WP wins. Both are subordinate to `ARCHITECTURE.md` and
> `.claude/rules/*.md`.

---

## Before Starting

- [x] Clean tree on `origin/main`; `pnpm install`; `pnpm -r build` exits 0.
- [x] Record the engine test baseline count.
- [x] **Capture the `dist` state before any change** (a file listing +
      sizes, or a hash) — AC-2 requires proving the build output is
      byte-identical afterwards.
- [x] Read `packages/game-engine/tsconfig.json` — note the
      `src/**/*.test.ts` exclusion and the `rootDir` / `outDir` /
      `declaration` settings the new config must not disturb.
- [x] Read the WP-557 post-mortem §Notes item 1 — the origin of this packet.

## Locked Values

- New file: `packages/game-engine/tsconfig.test.json`, `extends: "./tsconfig.json"`,
  `noEmit: true`, include `src/**/*`, exclude only `node_modules` / `dist`.
- New script: `typecheck:tests` → `tsc -p tsconfig.test.json`.
- **CI wiring is DEFERRED** to the final cleanup packet — not added here.
- Draft-time scaffold baseline: **692 errors / 110 files**. Re-derive at
  execution; treat the draft numbers as orientation, not truth.
- In-scope fixes: the **drift-pin files** and the **`TS2304` missing-import
  class** only.

## Guardrails

1. **Fix the tests; never silence them.** Zero `any` casts, zero
   `@ts-ignore`, zero `@ts-expect-error` added anywhere in the diff. AC-4
   greps for all three.
2. **Never loosen the base tsconfig.** `strict`,
   `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess` stay as they are;
   `tsconfig.json` must not appear in the diff at all (AC-5).
3. **Never edit a non-test `src` file.** If a test only compiles once a
   production type is widened, the test is asserting something false — that
   is a finding to record, not a fix to apply (AC-6).
4. **The build must be untouched.** The new config is `noEmit` and additive;
   `pnpm -r build` output stays byte-identical (AC-2).
5. **Prove the pin, don't claim it.** AC-3 requires a mutation: rename a
   pinned field, watch the gate go red, restore. A gate nobody demonstrated
   is the same non-gate this packet exists to replace.
6. **Record what you do not fix.** Every remaining error class goes into the
   `WORK_INDEX.md` inventory with its observed count. Silent truncation reads
   as "covered everything".
7. **Do not wire CI.** ~600 known errors behind a required check blocks every
   unrelated PR. The wiring is the last packet's job, not this one's.

## Required Comments

- `// why:` (or a JSON comment / adjacent doc note) on `tsconfig.test.json`
  explaining that the base config excludes test files so nothing ever
  compiled them, and that this config is `noEmit` precisely so the shipped
  build is unaffected.
- `// why:` on the restored drift pins, stating that the `satisfies` now
  genuinely gates — and that until the full backlog clears, **new** engine
  drift pins should still be written as runtime assertions.

## Files to Produce

| File | Change |
|---|---|
| `packages/game-engine/tsconfig.test.json` | new |
| `packages/game-engine/package.json` | add `typecheck:tests` |
| `packages/game-engine/src/ui/uiState.types.drift.test.ts` | fix its errors |
| `packages/game-engine/src/ui/uiState.filter.test.ts` | add the missing `CardExtId` import |
| *(remaining `TS2304` files)* | **re-derive the list at execution** |
| `.claude/rules/code-style.md` | record the runtime-pin rule |
| `docs/ai/work-packets/WORK_INDEX.md` | follow-up inventory rows |

## After Completing

- [x] `WORK_INDEX.md` `[x]` **plus** the follow-up inventory (each remaining
      class, its count, its file concentration).
- [x] `EC_INDEX.md` `Done`; mindmap `✅`; counts 0.
- [x] **D-24372** Active.
- [x] `STATUS.md` — the before/after error count **and** an explicit line that
      CI wiring is deferred **by design**, so its absence is not read later as
      an oversight. `User-Visible Surface = none — infrastructure`, so the
      D-24026 gate inverts.

## Common Failure Smells

- **Reaching for `as any` on the first stubborn fixture.** That converts this
  packet into the problem it was written to solve.
- **"The base tsconfig is too strict for tests."** It is the same strictness
  the production code already meets. Loosening it hides real drift.
- **Widening a production type to make a test compile.** The test is wrong.
- **Wiring CI because "the script exists now."** Read Guardrail 7 again.
- **Claiming the gate works without the AC-3 mutation.** The entire premise of
  this packet is that an undemonstrated gate had been silently doing nothing
  for months.
- **Fixing 692 errors because the momentum is good.** The split is deliberate
  and operator-approved; the overflow is inventory, not scope.
