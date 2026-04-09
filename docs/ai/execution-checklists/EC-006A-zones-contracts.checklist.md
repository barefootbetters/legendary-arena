# EC-006A — Player State & Zones Contracts (Execution Checklist)

**Source:** docs/ai/work-packets/WP-006A-player-state-zones-contracts.md
**Layer:** Game Engine / Contracts

**Execution Authority:**
This EC is the authoritative execution checklist for WP-006A.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-006A.

---

## Before Starting

- [ ] WP-005B complete: `LegendaryGameState` has `playerZones`, `selection`, global pile fields
- [ ] `buildInitialGameState` exists and produces a valid `G` (WP-005B)
- [ ] `makeMockCtx` exists in `src/test/mockCtx.ts` (WP-005B)
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-006A.
If formatting, spelling, or ordering differs, the implementation is invalid.

- `PlayerZones` — exactly 5 keys, all `Zone` = `CardExtId[]`:
  `deck` | `hand` | `discard` | `inPlay` | `victory`

- `GlobalPiles` — exactly 4 keys, all `Zone` = `CardExtId[]`:
  `bystanders` | `wounds` | `officers` | `sidekicks`

- `ZoneValidationError`: `{ field: string; message: string }` — NOT `MoveError`

- WP-008A `MoveError` (`{ code, message, path }`) must NOT be used or referenced here

- `type CardExtId = string` — stable `ext_id` reference

- `type Zone = CardExtId[]`

---

## Guardrails

- Zone contents are `CardExtId` strings only — no full card objects in any type definition
- Both validators return structured results — never throw
- `zones.validate.ts` must not import from `boardgame.io` — pure helper
- Validators check structural shape only — no registry lookups
- Align `LegendaryGameState` to use new canonical types — no duplicate zone definitions
- No `MoveError` reference in any zone file
- No card object fields (`imageUrl`, `slug`, `name`) in zone type definitions

---

## Required `// why:` Comments

- `zones.types.ts`: why zones use `ext_id` strings rather than full card objects
- Validators: why they return rather than throw
- `src/types.ts`: consolidation of `LegendaryGameState` with canonical types

---

## Files to Produce

- `packages/game-engine/src/state/zones.types.ts` — **new** — `CardExtId`, `Zone`, `PlayerZones`, `PlayerState`, `GlobalPiles`
- `packages/game-engine/src/state/zones.validate.ts` — **new** — `validateGameStateShape`, `validatePlayerStateShape`
- `packages/game-engine/src/types.ts` — **modified** — align `LegendaryGameState` to canonical types
- `packages/game-engine/src/index.ts` — **modified** — export new public contracts
- `packages/game-engine/src/state/zones.shape.test.ts` — **new** — 4 tests (`node:test`)

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] No `throw` in `zones.validate.ts`; no `boardgame.io` import in it
- [ ] No `MoveError` in any zone file
- [ ] `docs/ai/STATUS.md` updated — what zone contracts are now exported
- [ ] `docs/ai/DECISIONS.md` updated — why `ext_id` strings; why `{ field, message }` not `MoveError`; consolidation
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-006A checked off with date
