# EC-605 — Possibly-Undefined Index Access in Engine Tests

**WP:** [WP-570](../work-packets/WP-570-engine-test-possibly-undefined-indexing.md)
**Layer:** Game Engine (test surface only)
**Lane:** Standard two-session
**Reserves:** D-24379

> The WP is the authoritative design document. If this EC and the WP
> conflict, the WP wins. Both are subordinate to `ARCHITECTURE.md` and
> `.claude/rules/*.md`.

---

## Before Starting

- [x] Clean tree off `origin/main`; `pnpm install`; `pnpm -r build` exits 0.
- [x] **Capture the engine `dist` hashes.** AC-3 requires byte-identical —
      unlike WP-569, this packet adds no module.
- [x] Record the engine test baseline (**2740 / 0** at `a7c3f2b8`).
- [x] **Re-derive the inventory.** Draft-time: **498 total, 209 in class
      (`TS2532` 178 + `TS18048` 31) across 12 files.** Orientation, not truth.
- [x] Read D-24372 §2–§3 and D-24379 — this packet inherits both.

## Locked Values

- Two idioms, chosen by shape:
  - **inline `!`** for a one-off index access (`playerZones['0']!.hand`);
  - **`assert.ok(value !== undefined, '<full sentence>')`** once after binding,
    when an indexed value is bound and read repeatedly.
- `!` is **permitted**; `any` / `@ts-ignore` / `@ts-expect-error` are **not**.
- `noUncheckedIndexedAccess` **stays on**. Never relaxed.
- Draft-time shape split: **154** `playerZones[…]`, **17** array-index, **38**
  bound-variable/other.
- **CI wiring stays DEFERRED** (D-24372 §2).

## Guardrails

1. **The diff is TYPE-ONLY.** No assertion's subject or expected value changes.
   A reviewer must be able to read the whole diff as type annotations. AC-8
   requires demonstrating this, not claiming it.
2. **Run each file's suite immediately after sweeping it** — not once at the
   end. A regex over test source is exactly where a silent semantic change
   hides, and per-file runs keep the blast radius to one file.
3. **Fix the tests; never silence them.** Zero `any` / `@ts-ignore` /
   `@ts-expect-error` (AC-4 greps all three). `!` is not in that set — see
   D-24379 for why the distinction is real and not stylistic.
4. **Never loosen the base tsconfig**, and specifically never drop
   `noUncheckedIndexedAccess`. Turning the flag off would delete the finding
   rather than address it.
5. **Never edit a non-test file.** AC-6 pins **zero** — stricter than WP-569,
   which added one module. `mockCtx.ts` and `mockMoveContext.ts` are both out.
6. **`dist` must be byte-identical.** WP-569's relaxation was one-time and
   specific to the module it added. A changed `dist` file here is a **STOP**.
7. **Prefer `assert.ok` over `!` wherever a value is read repeatedly.** The
   packet's point is converting silent assumptions into stated ones; a
   message-bearing assertion does that, a `!` only satisfies the compiler.
8. **No test removed, renamed, skipped or weakened** (AC-2). The suite must
   come out at or above 2740.

## Required Comments

- No blanket `// why:` per `!` — that would bury the diff. Instead, **one**
  `// why:` at the first swept site in each file, stating that `!` is a
  type-level narrowing with no runtime semantics, that the expression is
  dereferenced either way so an undefined value would already throw, and that
  D-24379 governs the idiom.
- A `// why:` on any `assert.ok(... !== undefined ...)` that is NOT obvious
  from its message, explaining what makes the index guaranteed populated.

## Files to Produce

| File | Change |
|---|---|
| `src/hero/heroEffects.execute.test.ts` | ~136 index accesses |
| `src/persistence/snapshot.create.test.ts` | ~17 |
| `src/setup/buildInitialGameState.shape.test.ts` | ~13 |
| `src/hero/__tests__/undercover.integration.test.ts` | ~10 |
| `src/content/content.validate.test.ts` | ~8 |
| `src/setup/buildCardDisplayData.test.ts` | ~7 |
| `src/moves/__tests__/sendUndercover.test.ts` | ~6 |
| *(5 further files at ≤ 4)* | **re-derive at execution** |
| `docs/ai/work-packets/WORK_INDEX.md` | refresh backlog counts |

## After Completing

- [x] `WORK_INDEX.md` `[x]` **plus** refreshed backlog counts (this class
      closes; re-derive the others, never copy them forward — they have now
      moved three times).
- [x] `EC_INDEX.md` `Done`; mindmap `✅`; `roadmap:counts:check` 0.
- [x] **D-24379** Active.
- [x] `STATUS.md` — before/after counts, `TS2532`/`TS18048` at zero, and an
      explicit note that **`dist` is byte-identical again** (WP-569's
      relaxation was one-time), plus the standing CI-wiring deferral.
      `User-Visible Surface = none — infrastructure`, so D-24026 inverts.

## Common Failure Smells

- **Sweeping all 12 files, then running the suite once.** When something
  breaks you have 209 edits to bisect. Sweep, run, commit-worthy, next file.
- **Reaching for `@ts-expect-error` on the awkward residual sites.** The 38
  bound-variable cases are exactly where that temptation peaks; they are the
  `assert.ok` idiom's home ground.
- **Turning off `noUncheckedIndexedAccess` "just for tests".** That is not a
  smaller version of this packet, it is the opposite of it.
- **Letting a regex touch an expected value.** `errors[0].field` → `errors[0]!.field`
  is in scope; changing what `field` is compared against is not.
- **Claiming the diff is type-only without filtering it** (AC-8).
- **Adding a module because the shared-helper habit is fresh from WP-569.**
  AC-6 pins zero non-test files here.
