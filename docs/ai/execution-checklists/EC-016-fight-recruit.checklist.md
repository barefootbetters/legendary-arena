# EC-016 — Fight First, Then Recruit (Execution Checklist)

**Source:** docs/ai/work-packets/WP-016-fight-then-recruit-minimal-mvp.md
**Layer:** Game Engine / Core Actions

**Execution Authority:**
This EC is the authoritative execution checklist for WP-016.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-016.

---

## Before Starting

- [ ] WP-015 complete: `G.city`, `G.hq` exist as 5-tuples; `CityZone`, `HqZone` exported
- [ ] `isMoveAllowedInStage`, `MOVE_ALLOWED_STAGES` exist in `coreMoves.gating.ts` (WP-008A)
- [ ] `MoveResult`, `MoveError` exist in `coreMoves.types.ts` (WP-008A)
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-016.
If formatting, spelling, or ordering differs, the implementation is invalid.

- `MoveError` shape (reused from WP-008A): `{ code: string; message: string; path: string }`
- `TurnStage` values: `'start'` | `'main'` | `'cleanup'`
- `PlayerZones` keys: `deck` | `hand` | `discard` | `inPlay` | `victory`
- New stage gating entries:
  `fightVillain: ['main']` -- fighting during action window
  `recruitHero: ['main']` -- recruiting during action window
- Fight places defeated villain in player's `victory` zone
- Recruit places hero in player's `discard` zone

---

## Guardrails

- Both moves follow three-step validation contract: validate args, check stage gate, mutate G
- Fight-first is a **policy** -- engine does NOT reject recruit when fight is available
- MVP: no attack/recruit point checking -- WP-018 adds economy
- MVP: no card text effects on fight or recruit -- WP-022 adds keywords
- MVP: no bystander rescue on villain defeat -- WP-017 adds that
- WP-015 contract files (`city.types.ts`) must NOT be modified
- WP-008A contract files (`coreMoves.types.ts`, `coreMoves.validate.ts`) must NOT be modified

---

## Required `// why:` Comments

- `fightVillain`: MVP has no attack point check; WP-018 adds economy
- `recruitHero`: MVP has no recruit point check; WP-018 adds economy
- `MOVE_ALLOWED_STAGES` entries: fighting/recruiting happens during action window
- Fight-first ordering policy: documented preference, not hard lockout

---

## Files to Produce

- `src/moves/fightVillain.ts` -- **new** -- fight move implementation
- `src/moves/recruitHero.ts` -- **new** -- recruit move implementation
- `src/moves/coreMoves.gating.ts` -- **modified** -- add to `MOVE_ALLOWED_STAGES` and `CORE_MOVE_NAMES`
- `src/game.ts` -- **modified** -- register new moves in play phase
- `src/index.ts` -- **modified** -- export new moves
- `src/moves/fightVillain.test.ts` -- **new** -- 6 tests
- `src/moves/recruitHero.test.ts` -- **new** -- 6 tests
- `src/moves/coreMoves.gating.test.ts` -- **modified** -- update drift-detection

---

## Common Failure Smells (Optional)

- Engine rejects recruit when a fight target exists
  -> fight-first is policy not lockout; both valid in `main` stage
- Move throws instead of returning void on invalid input
  -> move validation contract violated
- Attack/recruit point validation added
  -> scope creep; WP-018 owns economy

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] No `throw` in `fightVillain.ts` or `recruitHero.ts`
- [ ] WP-015 and WP-008A contract files not modified (`git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated (fight and recruit moves exist; fight-first is documented policy)
- [ ] `docs/ai/DECISIONS.md` updated (fight-first is policy not lockout; MVP has no resource checking; recruit places in discard not hand)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-016 checked off with date
