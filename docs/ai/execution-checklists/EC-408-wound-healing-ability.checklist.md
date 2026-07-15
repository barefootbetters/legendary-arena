# EC-408 — Wound "Healing" Ability (Execution Checklist)

**Source:** docs/ai/work-packets/WP-379-wound-healing-ability.md
**Layer:** Game Engine

## Before Starting
- [ ] Baseline: `origin/main` at `dbc69b01` (or later); working tree clean, synced.
- [ ] `WOUND_EXT_ID = 'pile-wound'` exists in `setup/pilesInit.ts`; `koCard` in `board/ko.logic.ts`.
- [ ] `LegendaryGameState` (`types.ts`) has `ko: CardExtId[]` + optional `hasDrawnThisTurn?`.
- [ ] `fightVillain.ts` / `recruitHero.ts` / `fightMastermind.ts` follow the `main`-gate + `hasPending*` cluster + Step-3 pattern.
- [ ] `game.test.ts` move-set drift test currently lists the move set without `healWounds`.
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] Scope lock — EXACT target files = the `Files to Produce` list below. Any file outside it (except regenerated fixtures) is a FAIL; surface it as a blocker, do not improvise.

## Locked Values (do not re-derive)
- Wound ext_id: `WOUND_EXT_ID = 'pile-wound'` — **import it**, never the string literal.
- KO helper: `koCard(koPile: CardExtId[], cardId: CardExtId): CardExtId[]` → destination `G.ko`.
- Stage gate value: `'main'` (`TURN_STAGES`: `'start'` | `'main'` | `'cleanup'`).
- New flags: `hasActedThisTurn?: boolean`, `hasHealedThisTurn?: boolean` (optional; mirror `hasDrawnThisTurn?`).
- Move registration: `healWounds: { move: healWounds, client: false }` (D-10008).
- PlayerZones keys: `deck` | `hand` | `discard` | `inPlay` | `victory` | `faceDownCards`.

## Guardrails
- Moves never throw; return `void` on any invalid/blocked input. Only `Game.setup()` may throw.
- `healWounds` order: `main`-gate → block-all `hasPending*` cluster (copy verbatim from `fightVillain`) → `hasActedThisTurn` precondition → mutate. Creates NO pending state.
- `hasActedThisTurn` is structural, NOT economy-derived — a 0-cost fight/recruit still sets it.
- Partition the hand with an explicit `for...of` loop — no `.reduce()`, no `.filter()` in the zone op.
- KO is permanent: Wounds go to `G.ko` only — never back to `G.wounds`, never to discard.
- `fightVillain` / `recruitHero` / `fightMastermind` change by EXACTLY two lines each (reverse-lock guard + `hasActedThisTurn = true`) — no other edit.
- No `Math.random`, no `ctx.random.*`, no DB/network/fs. `G` stays JSON-serializable.
- Sentinel/golden fixtures: if a pinned hash shifts, re-pin via the canonical record tool — NEVER hand-edit; investigate WHY before regenerating.

## Required `// why:` Comments
- `healWounds` stage gate: main-window action, mirrors fightVillain.
- `healWounds` `hasActedThisTurn` precondition: rule + D-24179 (no heal after acting).
- `healWounds` empty-hand guard: deterministic no-op.
- Reverse-lock guard in all three fight/recruit moves: rule + D-24180 (no fight/recruit after heal).
- `hasActedThisTurn = true` in all three moves: D-24180.
- `game.ts` flag resets in `onBegin`: once-per-turn allowance refreshes.

## Files to Produce
- `packages/game-engine/src/moves/healWounds.ts` — **new** — move + `hasHealedThisTurn` predicate
- `packages/game-engine/src/moves/healWounds.test.ts` — **new** — `node:test` coverage
- `packages/game-engine/src/types.ts` — **modified** — two optional flags
- `packages/game-engine/src/setup/buildInitialGameState.ts` — **modified** — init both `false`
- `packages/game-engine/src/game.ts` — **modified** — register move + reset flags in `onBegin`
- `packages/game-engine/src/moves/fightVillain.ts` — **modified** — reverse lock + set flag
- `packages/game-engine/src/moves/recruitHero.ts` — **modified** — reverse lock + set flag
- `packages/game-engine/src/moves/fightMastermind.ts` — **modified** — reverse lock + set flag
- `packages/game-engine/src/game.test.ts` — **modified** — drift test: add `healWounds`, bump count
- (conditional) sentinel/golden fixtures under `packages/game-engine/src/test/fixtures/` — **regenerated** only if a pinned hash shifts

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] `Select-String` gates pass: no `throw` / no `boardgame.io/testing` / no `'pile-wound'` literal in `healWounds.ts`; no `Math.random` in engine src.
- [ ] Live-on-surface verification — N/A; STATUS.md states "No user-observable change — infrastructure only" (surface = `none — infrastructure`).
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` updated — land D-24179 + D-24180 (Active, post-execution)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-379 checked off with date
- [ ] `git diff --name-only` shows only the allowlist (+ regenerated fixtures)

## Common Failure Smells
- `healWounds` still heals after a fight → the reverse gate reads the wrong flag, or `hasActedThisTurn` is economy-derived (0-cost action missed).
- Drift test red on move count → `healWounds` added to the array but not the `it(...)` description string (or vice versa).
- Sentinel replay red → new G flags shifted the pinned hash; re-record, do not hand-edit.
- `JSON.stringify(G)` throws in a test → a non-serializable value leaked into a flag (must be a plain boolean).
