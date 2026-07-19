# EC-427 — Supply-Floor Validation in the Builder (Execution Checklist)

**Source:** docs/ai/work-packets/WP-391-support-card-pools.md
**Layer:** Registry (+ Registry Viewer set-fill)

Operator-reported from production: a pooled loadout failed match creation with
HTTP 400 — *"The woundsCount field must be at least 30 … received 22."*

## Before Starting
- [ ] Read the engine rule first:
      `packages/game-engine/src/matchSetup.validate.ts:95-100`
      `COUNT_FIELD_MINIMUMS` (D-24032) — bystanders 30, wounds 30, officers 30,
      sidekicks 0. If those values have changed, re-derive; do not copy this EC
- [ ] Confirm the gap is still real: `setupContract.schema.ts` validates the
      four counts with `.int().nonnegative()` only, so the builder accepts
      documents the engine rejects. This predates support pools; pools only
      made it easy to hit by making the counts DERIVED
- [ ] Confirm the arithmetic that caused it: the registry holds **22** distinct
      wound cards and **18** officers. At one copy each, "Select all sets"
      yields 22 and 18 — both under the floor of 30
- [ ] `pnpm install` in the worktree; junctioned `node_modules` resolves to a
      stale `dist`
- [ ] Baselines: registry **145 pass / 17 suites**, viewer **147 pass**

## Locked Values (do not re-derive)
- `SUPPORT_COUNT_MINIMUMS` mirrors the engine exactly: `bystandersCount: 30`,
  `woundsCount: 30`, `officersCount: 30`, `sidekicksCount: 0`
- The values are **duplicated, not imported** — the registry package is
  browser-safe and must not take an engine dependency. A source-reading drift
  test pins them, mirroring the `MAX_TURNS_PER_GAME` precedent
- Top-up targets **exactly the minimum**, never above: `base = floor(min / n)`,
  remainder to the first `min % n` cards in ext_id order
- The floor message is the builder's own wording; it does NOT copy the engine's
  "Re-export the loadout from the Registry Viewer" tail, which is nonsense
  advice when you are already standing in the Registry Viewer

## Guardrails
- Validate in the registry mirror, NOT only in the viewer — the contract is
  what the server enforces, and a viewer-only check would drift the moment
  another consumer appeared
- Do NOT relax the engine floor to accommodate the card supply. The floor is a
  play-correctness rule (D-24032); the pile is allowed to repeat cards
- Top-up applies to SET-FILL only. Hand-editing copies stays exact — an author
  typing a number means it, and silently inflating it would be worse than an
  error message
- `sidekicksCount` has floor 0; do NOT top it up, and do not assume symmetry
  across the four kinds
- The count inputs stay disabled while a pool is set (EC-425); the floor error
  is therefore only reachable by hand-editing a pool-free count, which is
  exactly when the author can fix it

## Required `// why:` Comments
- `SUPPORT_COUNT_MINIMUMS`: why duplicated rather than imported; why the
  builder validates at all (HTTP 400 at match creation vs an inline error)
- The top-up block: the 22-wounds / 18-officers arithmetic that forced it, and
  that it is deterministic
- The drift test: why a plain substring beats a hand-built regex here

## Files to Produce
- `packages/registry/src/setupContract/setupContract.types.ts` — **modified** —
  `SUPPORT_COUNT_MINIMUMS`
- `packages/registry/src/setupContract/setupContract.schema.ts` — **modified** —
  `.min()` on the three floored counts
- `packages/registry/src/setupContract/index.ts` — **modified** — re-export
- `packages/registry/src/setupContract/setupContract.test.ts` — **modified** —
  floor case, no-floor case, engine drift test
- `apps/registry-viewer/src/components/LoadoutBuilder.vue` — **modified** —
  set-fill top-up

## After Completing
- [ ] `pnpm --filter @legendary-arena/registry test` exits 0 — **148 pass**,
      suite count still **17**
- [ ] `pnpm --filter registry-viewer typecheck` + `test` exit 0 — **147 pass**
- [ ] Live-on-surface (D-24026): "Select all sets" on wounds yields
      **22 cards / 30 copies**, officers **18 cards / 30 copies**; hand-typing
      22 into a pool-free woundsCount shows the floor error in the panel.
      **All three verified in dev**
- [ ] `EC_INDEX.md` flipped with date

## Common Failure Smells
- Match creation still 400s on a pooled loadout → the top-up ran but the
  document was exported before it, or a hand-edit re-lowered the count
- A pile is far above the floor → the top-up is multiplying rather than
  distributing; it must target exactly `min`
- Drift test passes against a changed engine → the substring check was
  loosened, or the engine file moved and the read silently returned stale text
- Sidekicks inflated to 30 → the top-up ignored the per-field floor of 0
