# EC-608 — UI-Projection Fixture Builders

**WP:** [WP-573](../work-packets/WP-573-ui-projection-fixture-builders.md)
**Layer:** Game Engine (test surface + UI-projection builders)
**Lane:** Standard two-session
**Reserves:** D-24382

> The WP is the authoritative design document. If this EC and the WP
> conflict, the WP wins. Both are subordinate to `ARCHITECTURE.md` and
> `.claude/rules/*.md`.

---

## Before Starting

- [ ] Clean tree off `origin/main`; `pnpm install`; `pnpm -r build` exits 0.
- [ ] Capture engine `dist` hashes and the test baseline.
- [ ] **Re-derive the residual.** Draft-time: **17 errors / 3 files** —
      `ai.competent.test.ts` 12, `simulation.test.ts` 4, `par.storage.test.ts` 1.
- [ ] **Read the UI-projection types before writing a single default** —
      `ui/uiState.types.ts` and the `buildUIState` code that populates them.
- [ ] Read D-24380, D-24381, and WP-572's SCOPE AMENDED section.

## Locked Values

- Five builders: `UICityCard`, `UICityState`, `UIMastermindState`,
  `UISchemeState`, `UITurnEconomyState`. Plus one `SeedParArtifact` site.
- Builders live beside `src/test/fixtureBuilders.ts`.
- Migration: checker-driven (`checker.getContextualType`), **exact** type-name
  match so `Record<string, T>` parents are excluded.
- **CI wiring stays DEFERRED** (D-24372 §2).

## Guardrails

1. **Defaults are READ from the production type, never invented.** A wrong
   default silently changes what the simulation tests assert.
2. **The fixtures are wrong, never the types.** No production type is widened,
   relaxed, or made optional (D-24380, D-24381).
3. **The proof is the AC-1 mutation, never a falling error count.** WP-571 cut
   its class 88% and delivered no property; WP-572's mutation proved the
   difference (D-24381 §3).
4. **Grep type names EXACTLY when verifying.** `TurnEconomy` matches
   `UITurnEconomyState` case-insensitively and misled WP-572's mutation read.
   **This packet works on the colliding types, so the trap is live.**
5. **Migrate one file, run its suite, move on.** Three files — there is no
   excuse for a blind sweep here.
6. **Keep the deliberately-narrow skip-list.** A fixture that proves a guard
   FIRES must stay incomplete; not every diagnostic is a defect.
7. **Zero `any` and zero suppression pragmas.** Phrase your own comments so they
   do not quote those token names — WP-570 tripped its own grep on its docs.

## Required Comments

- A `// why:` on each builder naming the production type it mirrors and where
  its defaults were read from, and stating that a new required field is added
  here **once** rather than at every fixture (D-24380 §2).

## Files to Produce

| File | Change |
|---|---|
| UI-projection builders under `src/test/` | new |
| `src/simulation/ai.competent.test.ts` | ~12 |
| `src/simulation/simulation.test.ts` | ~4 |
| `src/simulation/par.storage.test.ts` | ~1 |
| `docs/ai/work-packets/WORK_INDEX.md` | refresh counts |

## After Completing

- [ ] `WORK_INDEX.md` `[x]` + refreshed backlog counts — and note that **the
      arc's fixture work is complete**, leaving only the long tail before CI
      wiring.
- [ ] `EC_INDEX.md` `Done`; mindmap `✅`; `roadmap:counts:check` 0.
- [ ] **D-24382** Active.
- [ ] `STATUS.md` — before/after counts and **the AC-1 mutation result**.
      `User-Visible Surface = none — infrastructure`; D-24026 inverts.

## Common Failure Smells

- **Shipping five builders because the pattern is familiar, without running the
  mutation.** That is the abstraction-by-consistency trap; AC-1 is the answer.
- **Inventing a UI default.** `escapedPile: []` is probably right; `display` on
  `UIMastermindState` probably is not. Read `buildUIState`.
- **A case-insensitive grep while verifying.** See Guardrail 4 — it already
  cost one misread in this arc.
- **Completing a deliberately-narrow fixture** because it looks like the same
  shape.
