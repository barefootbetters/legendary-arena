# EC-607 — AST-Aware Fixture Migration

**WP:** [WP-572](../work-packets/WP-572-ast-aware-fixture-migration.md)
**Layer:** Game Engine (test surface + migration tooling)
**Lane:** Standard two-session
**Reserves:** D-24381

> The WP is the authoritative design document. If this EC and the WP
> conflict, the WP wins. Both are subordinate to `ARCHITECTURE.md` and
> `.claude/rules/*.md`.

---

## Before Starting

- [ ] Clean tree off `origin/main`; `pnpm install`; `pnpm -r build` exits 0.
- [ ] Capture engine `dist` hashes and the test baseline.
- [ ] **Run the census probe FIRST** and record its numbers. Draft-time:
      **230 literals / 59 files / 173 routed / 57 to route.**
- [ ] Read WP-571's SCOPE AMENDED section — it explains why this packet exists.
- [ ] Read D-24378, D-24380 and D-24381.

## Locked Values

- Oracle: `checker.getContextualType` on each `ObjectLiteralExpression`, over
  `tsconfig.test.json`'s file list. `typescript` is already a devDependency.
- Six target type names, matched **exactly**: `PlayerZones`, `GlobalPiles`,
  `TurnEconomy`, `CardStatEntry`, `MastermindState`, `CardRegistryReader`.
  `Record<string, T>` is **not** `T`.
- Builders: `src/test/fixtureBuilders.ts` (WP-571).
- **CI wiring stays DEFERRED** (D-24372 §2).

## Guardrails

1. **The type checker is the oracle; never pattern-match source.** WP-571 proved
   a regex hits type annotations (syntax errors across 102 files) and cannot see
   already-complete literals (18 tests broken by a second attempt). Both were
   reverted at real cost.
2. **Idempotence is guarded on the NODE, not the line.** Skip a literal whose
   properties already include a builder spread. WP-570 shipped a line-level
   guard bug where one line carried two indexes; do not repeat its shape.
3. **Maintain an explicit skip-list for deliberately-narrow fixtures.** They
   must stay incomplete and erroring — they prove reader guards fire, and
   completing them silences the behaviour under test (D-24378 and its second
   instance in `ui/uiState.build.test.ts`). **Not every diagnostic is a defect.**
4. **Migrate one file, run its suite, move on.** EC-606 guardrail 4, violated
   once at the cost of a full revert.
5. **Never widen a production type**; never change an assertion's subject or
   expected value.
6. **Zero `any` and zero suppression pragmas.** Phrase your own comments so they
   do not quote those token names — WP-570 tripped its own grep on its docs.
7. **A falling error count is NOT evidence.** Only the AC-1 mutation is.

## Required Comments

- A `// why:` on the migration script stating that it is checker-driven because
  regex provably cannot distinguish a value literal from a type annotation, and
  cannot see already-complete literals (D-24381 §1–2).
- A `// why:` on the skip-list naming what each entry proves and what completing
  it would silence.

## Files to Produce

| File | Change |
|---|---|
| migration script | new (scratch or `scripts/` — executor's call) |
| unrouted-literal test files | literals → builders |
| new builder modules for residual types | new |
| `docs/ai/work-packets/WORK_INDEX.md` | refresh backlog counts |

## After Completing

- [ ] `WORK_INDEX.md` `[x]` + refreshed counts (re-derive; they have moved five
      times).
- [ ] `EC_INDEX.md` `Done`; mindmap `✅`; `roadmap:counts:check` 0.
- [ ] **D-24381** Active.
- [ ] `STATUS.md` — before/after counts, **the AC-1 mutation result** as the
      proof the class cannot recur, and the enumerated skip-list with reasons.
      `User-Visible Surface = none — infrastructure`; D-24026 inverts.

## Common Failure Smells

- **Reporting a reduced error count as success.** That is exactly what WP-571
  did and it had not delivered the property. Run the mutation.
- **Treating every remaining diagnostic as a defect.** The skip-list entries are
  load-bearing tests.
- **Sweeping all files then running the suite once.** You will have dozens of
  edits to bisect.
- **Reaching for a cast on a stubborn narrow fixture.** `as unknown as` is a
  suppression in all but name; WP-569 and WP-571 both refused it.
- **Matching `Record<string, PlayerZones>` as `PlayerZones`.** The parent map is
  not the element; the checker distinguishes them and so must the script.
