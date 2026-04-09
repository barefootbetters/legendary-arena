# EC-017 — KO, Wounds & Bystander Capture (Execution Checklist)

**Source:** docs/ai/work-packets/WP-017-ko-wounds-bystanders-minimal-mvp.md
**Layer:** Game Engine / Zones + Effects

**Execution Authority:**
This EC is the authoritative execution checklist for WP-017.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-017.

---

## Before Starting

- [ ] WP-016 complete: `fightVillain`, `recruitHero` exist and wired into play phase
- [ ] `G.city`, `G.hq` exist; `pushVillainIntoCity` exported (WP-015)
- [ ] `G.piles.bystanders` and `G.piles.wounds` exist as `CardExtId[]` (WP-006B)
- [ ] `G.playerZones[*].victory` and `G.playerZones[*].discard` exist (WP-006A)
- [ ] `ENDGAME_CONDITIONS` exists in `endgame.types.ts` (WP-010)
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-017.
If formatting, spelling, or ordering differs, the implementation is invalid.

- `GlobalPiles` keys: `bystanders` | `wounds` | `officers` | `sidekicks`
- `PlayerZones` keys: `deck` | `hand` | `discard` | `inPlay` | `victory`
- New `LegendaryGameState` fields:
  `ko: CardExtId[]`
  `attachedBystanders: Record<CardExtId, CardExtId[]>`
- Wounds go to player `discard`; bystanders go to player `victory`

---

## Guardrails

- All new zone operations are pure helpers -- no boardgame.io import in `ko.logic.ts`, `wounds.logic.ts`, `bystanders.logic.ts`
- `G.attachedBystanders` is plain object (`Record`) -- not Map or Set
- Bystander attachment MVP: exactly 1 bystander per villain/henchman entering City
- `gainWound` does nothing if `G.piles.wounds` is empty -- deterministic no-op
- `koCard` does nothing if card not found -- deterministic no-op
- No `.reduce()` in any zone operation
- WP-015 contract files (`city.types.ts`) must NOT be modified
- `G.piles.bystanders` and `G.piles.wounds` are consumed, not re-created

---

## Required `// why:` Comments

- 1-bystander-per-villain: MVP simplification from full Legendary rules
- Escape-causes-wound: MVP rule linking escapes to player penalty
- `koCard`: KO is a one-way destination; cards never recovered in MVP
- `gainWound` empty pile: no wound to give; deterministic

---

## Files to Produce

- `src/board/ko.logic.ts` -- **new** -- `koCard` helper
- `src/board/wounds.logic.ts` -- **new** -- `gainWound` helper
- `src/board/bystanders.logic.ts` -- **new** -- `attachBystanderToVillain`, `awardAttachedBystanders`
- `src/villainDeck/villainDeck.reveal.ts` -- **modified** -- attach bystander on City entry
- `src/moves/fightVillain.ts` -- **modified** -- award bystanders on defeat
- `src/board/city.logic.ts` -- **modified** -- escape triggers wound gain
- `src/types.ts` -- **modified** -- add `ko`, `attachedBystanders`
- `src/index.ts` -- **modified** -- export new helpers
- `src/board/ko.logic.test.ts` -- **new** -- 3 tests
- `src/board/wounds.logic.test.ts` -- **new** -- 4 tests
- `src/board/bystanders.logic.test.ts` -- **new** -- 6 tests
- `src/board/escape-wound.integration.test.ts` -- **new** -- 3 tests

---

## Common Failure Smells (Optional)

- `G.attachedBystanders` uses Map or Set instead of plain Record
  -> JSON serialization will fail
- `gainWound` throws when wounds pile is empty
  -> deterministic no-op contract violated
- Pure helpers import boardgame.io
  -> layer boundary violated

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] No boardgame.io import in pure helper files
- [ ] No `.reduce()` in new files
- [ ] WP-015 contract files not modified (`git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated (KO, wounds, bystander capture exist)
- [ ] `docs/ai/DECISIONS.md` updated (1 bystander per villain simplified; escape causes wound; `G.attachedBystanders` is plain object not Map)
- [ ] `docs/ai/ARCHITECTURE.md` updated (`G.ko` and `G.attachedBystanders` in Field Classification table)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-017 checked off with date
