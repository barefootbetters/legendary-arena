# EC-321 — Simulation Move-Dispatch Completeness for Interactive Resolve Moves
# Execution Checklist

**Source:** docs/ai/work-packets/WP-289-resolve-move-dispatch.md
**Layer:** Game Engine (`packages/game-engine/src/simulation`)
**Decisions:** D-24073 (sim MOVE_MAP must dispatch every SIMULATION_MOVE_NAMES move; missing = infinite within-turn loop)

---

## Before Starting

- [ ] `git status` — working tree clean; on a `claude/*` branch off `main` (`97e08a24`)
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 — record baseline count
- [ ] Confirm `resolveDrawOrEmpowered` is already in BOTH `MOVE_MAP`s (`simulation.runner.ts` + `par.aggregator.ts`) — the WP-286 precedent to mirror; else STOP
- [ ] Confirm `SIMULATION_MOVE_NAMES` (in `simulation/ai.legalMoves.ts`) lists all four resolve moves and is currently a module-local `const` — else STOP
- [ ] Confirm `resolveKoHeroChoice` / `resolveOptionalKoReward` / `resolveVictoryPileCardPick` are exported from their move files — else STOP
- [ ] Read WP-289 in full before touching a file

---

## Locked Values (do not re-derive)

| Name | Locked Value | Source |
|---|---|---|
| Moves to add to each MOVE_MAP | `resolveKoHeroChoice`, `resolveOptionalKoReward`, `resolveVictoryPileCardPick` | D-24073 |
| Already present (do NOT re-add) | `resolveDrawOrEmpowered` (WP-286) + the 8 base moves | WP-286 |
| Export from ai.legalMoves.ts | `SIMULATION_MOVE_NAMES` (add `export`, no logic change) | D-24073 |
| Runner key-set export | `SIMULATION_RUNNER_MOVE_NAMES` (= `Object.keys(MOVE_MAP)`) | D-24073 |
| Aggregator key-set export | `PAR_AGGREGATOR_MOVE_NAMES` (= `Object.keys(MOVE_MAP)`) | D-24073 |
| New test file | `simulation/simulation.moveDispatch.drift.test.ts` | D-24073 |
| Dispatch arrow shape | `(context, args) => resolveX(context as never, args as never)` | matches existing entries |

---

## Guardrails

1. **Reuse the existing move functions** — import + dispatch; never re-implement a resolve move.
2. **Both maps, identically** — `par.aggregator.ts` duplicates `MOVE_MAP` (RS-10 forbids it importing `simulation.runner.ts`); add the three to both.
3. **No logic change to `getLegalMoves`, the short-circuits, or any resolve move** — wiring only.
4. **Export key sets via `Object.keys(MOVE_MAP)`** — do not hand-maintain a parallel list (it would drift from the map it documents).
5. **The drift test must have a NEGATIVE assertion** — prove it FAILS for a phantom move name not in the maps, so the guard is real, not vacuous.
6. **Determinism: the added moves must be UNREACHED in the current sweep** — `sim:runtime-observed:check` must stay byte-current; a drift there means a move now fires that did not before — STOP and investigate (do NOT re-baseline).
7. **No `.reduce()`** in the dispatch or the test superset check — `for...of`.

---

## Required Implementation Order

1. `simulation/ai.legalMoves.ts` — add `export` to `SIMULATION_MOVE_NAMES` (drop the `void (0 as ...)` unused-silencer only if it becomes unused; otherwise leave it).
2. `simulation/simulation.runner.ts` — import the three resolve moves; add the three `MOVE_MAP` entries (beside the WP-286 `resolveDrawOrEmpowered` entry); add `export const SIMULATION_RUNNER_MOVE_NAMES = Object.keys(MOVE_MAP);`.
3. `simulation/par.aggregator.ts` — same three imports + entries + `export const PAR_AGGREGATOR_MOVE_NAMES = Object.keys(MOVE_MAP);`.
4. `simulation/simulation.moveDispatch.drift.test.ts` — the drift guard (positive superset + negative phantom + the two maps agree).
5. Run engine `test` + `tsc --noEmit`; then `sim:runtime-observed:check` (determinism).

**Checkpoint:** run `pnpm --filter @legendary-arena/game-engine test` after step 4; run `pnpm sim:runtime-observed:check` after step 5. Red → diagnose before continuing.

---

## Required `// why:` Comments

- each new `simulation.runner.ts` / `par.aggregator.ts` dispatch entry: `// why: WP-289 / D-24073 — getLegalMoves can short-circuit to this resolve move; a missing dispatch entry hangs the per-turn loop (maxTurns bounds turns, not move-steps)`
- the key-set exports: `// why: WP-289 / D-24073 — exposed for the move-dispatch drift guard (every SIMULATION_MOVE_NAMES move must be a key here)`
- `ai.legalMoves.ts` export: `// why: WP-289 / D-24073 — exported as the single source of truth the dispatch drift guard reads`

---

## Files to Produce

**New:**
- `packages/game-engine/src/simulation/simulation.moveDispatch.drift.test.ts`

**Modified:**
- `packages/game-engine/src/simulation/ai.legalMoves.ts`
- `packages/game-engine/src/simulation/simulation.runner.ts`
- `packages/game-engine/src/simulation/par.aggregator.ts`

**Governance (govern-close):** `docs/ai/DECISIONS.md` (D-24073 Active), `docs/ai/work-packets/WORK_INDEX.md` (WP-289 Done), `docs/ai/execution-checklists/EC_INDEX.md` (EC-321 Done), `docs/ai/STATUS.md`, `docs/05-ROADMAP-MINDMAP.md` (WP-289 node).

---

## Required Test Coverage

`simulation.moveDispatch.drift.test.ts` MUST include at minimum:

- [ ] `SIMULATION_RUNNER_MOVE_NAMES` is a superset of `SIMULATION_MOVE_NAMES` (every emittable move dispatchable in the runner)
- [ ] `PAR_AGGREGATOR_MOVE_NAMES` is a superset of `SIMULATION_MOVE_NAMES` (same for the PAR aggregator)
- [ ] the three target resolve moves are each present in both key sets (explicit membership)
- [ ] NEGATIVE: a phantom move name (`'__not_a_move__'`) is NOT in either key set — proves the superset check is non-vacuous
- [ ] the two map key sets agree with each other (same dispatch surface in both loops)

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` 0 + `test` green (≥ baseline + drift cases) + `tsc --noEmit` 0
- [ ] `pnpm sim:runtime-observed:check` 0 — artifact byte-current (the added moves are unreached; determinism preserved)
- [ ] `pnpm -r build` 0
- [ ] Spot-check: `git diff --name-only -- packages/game-engine` lists only the 4 `simulation/` files
- [ ] Spot-check: `resolveKoHeroChoice` / `resolveOptionalKoReward` / `resolveVictoryPileCardPick` each appear in both `MOVE_MAP`s
- [ ] Governance close — `SPEC:` commit with DECISIONS, WORK_INDEX, EC_INDEX, STATUS, mindmap

---

## Common Failure Smells

- **`sim:runtime-observed:check` drifts** — a pending choice that was previously skipped now resolves, changing the sweep trajectory. Investigate WHICH move now fires; do NOT re-baseline without understanding why (the WP's premise is they are unreached).
- **Drift test passes but is vacuous** — the negative phantom assertion is missing; without it a superset check over an empty/garbage set trivially "passes."
- **Only one map fixed** — `par.aggregator.ts` was forgotten; its loop still hangs latently. Both maps, always.
- **Hand-maintained key list** — someone wrote a literal array instead of `Object.keys(MOVE_MAP)`; it will drift from the map. Derive from the map.
