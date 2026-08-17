# EC-604 — Mock Move-Context `EventsAPI` / `RandomAPI` Completion

**WP:** [WP-569](../work-packets/WP-569-mock-move-context-events-api.md)
**Layer:** Game Engine (test surface + one new test-support module)
**Lane:** Standard two-session
**Reserves:** D-24378

> The WP is the authoritative design document. If this EC and the WP
> conflict, the WP wins. Both are subordinate to `ARCHITECTURE.md` and
> `.claude/rules/*.md`.

---

## Before Starting

- [x] Clean tree off `origin/main`; `pnpm install`; `pnpm -r build` exits 0.
- [x] **Capture the engine `dist` state** (file list + sha256). AC-3 requires
      proving the delta is EXACTLY the four `mockMoveContext.*` files.
- [x] Record the engine test baseline (2734 / 0 at `9b4a0e02`).
- [x] **Re-derive the error inventory.** Run
      `pnpm --filter @legendary-arena/game-engine typecheck:tests` and record
      the total and the `TS2345` count. Draft-time numbers are orientation.
- [x] Read WP-563 / D-24372 §2–§4 — this packet inherits its rules verbatim.

## Locked Values

- New file: `packages/game-engine/src/test/mockMoveContext.ts`, exporting
  `makeMockMoveContext`. **Operator decision 2026-08-17** — do NOT put it in
  `mockCtx.ts` and do NOT change the base `tsconfig.json`.
- Forbidden `EventsAPI` members (stub to **throw**): `endPhase`, `endStage`,
  `pass`, `setActivePlayers`, `setStage`.
- Forbidden `RandomAPI` members (stub to **throw**): `D4`, `D6`, `D10`, `D12`,
  `D20`, `Die`, `Number`.
- Permitted and real: `endTurn`, `setPhase`, `endGame`, `Shuffle`,
  `log.setMetadata`. `Shuffle` comes from `makeMockCtx` — the reverse-shuffle
  semantics are load-bearing and must not change.
- The `MoveContext` sub-class is **159 errors / 11 files**; the whole `TS2345`
  code is **180 / 17**. Both go to zero.
- Draft-time gate baseline: **674 total**, of which 180 are `TS2345`.
- **CI wiring stays DEFERRED** (D-24372 §2). Not added here.

## Guardrails

1. **Complete the WHOLE plugin-API surface per mock before reading the count.**
   Failures are LAYERED — `tsc` reports only the first bad property, so fixing
   `events` alone leaves the count unchanged and looks like a no-op. It is not;
   `random` is next. Observed at draft time: `events` alone → 674 (no change);
   `events` + `random` on two files → 606.
2. **Fix the tests; never silence them.** Zero `any`, `@ts-ignore`,
   `@ts-expect-error` anywhere in the diff (AC-4 greps all three). Avoid
   `as never` / `as unknown` gymnastics on the overloaded `RandomAPI` members —
   type the builder's return as the real context type and let contextual typing
   supply the overloads.
3. **Never edit a non-test `src` file — including `src/test/mockCtx.ts`.** It
   is imported at RUNTIME by `src/replay/replay.execute.ts` and
   `src/replay/buildSnapshotSequence.ts`, which use its reverse-shuffle as the
   replay pipeline's RNG. Editing it puts a determinism-bearing path in a
   test-typing packet. Add the sibling; leave it alone.
4. **Never loosen the base tsconfig.** `strict`, `exactOptionalPropertyTypes`,
   `noUncheckedIndexedAccess` stay; `tsconfig.json` must not appear in the diff.
5. **Never widen a production type to make a test compile.** That test is
   asserting something false — record it as a finding, do not apply the fix.
6. **Prove the stubs bite (AC-2).** Ship a test that calls a forbidden event and
   a forbidden `RandomAPI` member and asserts the throw. A stub nobody executed
   is the undemonstrated gate WP-563 exists to end.
7. **The `dist` delta is enumerated, not asserted.** This packet DOES change
   `dist` — by exactly four `mockMoveContext.*` files. Any fifth changed file
   means something production-reachable was edited: STOP.
8. **Do not migrate the ~20 non-erroring mock helpers.** Explicit non-goal — a
   30-file sweep with no gate signal. It is the next packet.

## Required Comments

- `// why:` on `mockMoveContext.ts` stating that the throwing stubs are the
  `EventsAPI` / `RandomAPI` members `.claude/rules/architecture.md` forbids the
  engine from calling (verified: non-test source uses only `endTurn` ×47,
  `setPhase` ×9, `random.Shuffle` ×65), so the completed type surface doubles
  as a runtime assertion of that rule rather than merely satisfying `tsc`.
- `// why:` on the `Shuffle` pass-through, stating that the reverse-shuffle
  semantics are inherited from `makeMockCtx` deliberately — an identity shuffle
  would let a test pass even if the shuffle step were skipped.
- `// why:` on this file living beside `mockCtx.ts` rather than inside it —
  `mockCtx.ts` is replay-reachable production code.

## Files to Produce

| File | Change |
|---|---|
| `packages/game-engine/src/test/mockMoveContext.ts` | new — shared builder |
| the 11 `MoveContext` test files (WP §Scope In item 2) | delegate to the builder |
| `packages/game-engine/src/ui/uiState.build.progress.test.ts` | `UIBuildContext` + `TS2540` sites |
| `packages/game-engine/src/ui/uiState.filter.test.ts` | 2 `UIBuildContext` sites |
| *(registry-mock / `EffectNode` / `spectrum` sites)* | **re-derive at execution** |
| `docs/ai/work-packets/WORK_INDEX.md` | refresh WP-563 backlog counts |

## After Completing

- [x] `WORK_INDEX.md` `[x]` **plus** refreshed backlog inventory counts (the
      `TS2345` row closes; re-derive the others, never copy them forward).
- [x] `EC_INDEX.md` `Done`; mindmap `✅`; `roadmap:counts:check` 0.
- [x] **D-24378** Active, carrying the layered-failure finding.
- [x] `STATUS.md` — before/after totals, the `TS2345` count reaching zero, and
      the `dist` delta stated **explicitly** (NOT byte-identical this time, by
      design — say so, or a later reader will read it as a regression against
      WP-563's invariant). Restate that CI wiring stays deferred.
      `User-Visible Surface = none — infrastructure`, so D-24026 inverts.

## Common Failure Smells

- **Reading the error count after fixing only `events` and concluding the
  premise was wrong.** It is layered. Finish `random` before you judge.
- **Reaching for `as any` / `as never` on the overloaded `RandomAPI` members.**
  The overloads are the reason the naive object literal fails; type the return
  properly instead.
- **Editing `mockCtx.ts` because the shared code "obviously belongs" there.**
  It ships in `dist` and the replay pipeline imports it at runtime.
- **Stubbing the forbidden events as no-ops.** Compiles, asserts nothing, and
  silently permits the exact architecture violation the mock could have caught.
- **Migrating every mock helper while the builder is fresh.** Out of scope; no
  gate signal confirms the non-erroring ones.
- **Claiming `dist` is byte-identical.** It is not, by design. Enumerate the
  four added files.
