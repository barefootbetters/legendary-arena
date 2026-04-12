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
- [ ] WP-015 complete: `G.city`, `G.hq` exist; `pushVillainIntoCity` exported
- [ ] `G.piles.bystanders` and `G.piles.wounds` exist as `CardExtId[]` (WP-006B)
- [ ] `G.playerZones[*].victory` and `G.playerZones[*].discard` exist (WP-006A)
- [ ] `ENDGAME_CONDITIONS` exists in `endgame.types.ts` (WP-010)
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0

---

## Locked Values (do not re-derive)

- `GlobalPiles` keys: `bystanders` | `wounds` | `officers` | `sidekicks`
- `PlayerZones` keys: `deck` | `hand` | `discard` | `inPlay` | `victory`
- New `LegendaryGameState` fields:
  - `ko: CardExtId[]`
  - `attachedBystanders: Record<CardExtId, CardExtId[]>`
- Wounds go to player `discard`; bystanders go to player `victory`
- Supply pile convention: top-of-pile is `pile[0]` (remove from front deterministically)

---

## Guardrails (Hard Stops)

- All new zone operations are **pure helpers**:
  - No boardgame.io import in `ko.logic.ts`, `wounds.logic.ts`, `bystanders.logic.ts`
- `G.attachedBystanders` is a plain object (`Record`), not Map/Set
- Bystander attachment MVP: exactly 1 bystander per villain/henchman entering City
- `gainWound` does nothing if `G.piles.wounds` is empty -- deterministic no-op
- `koCard` is destination-only: it appends to KO and never searches/removes from source zones
- No `.reduce()` in any zone operation
- WP-015 contract files (`city.types.ts`, `city.logic.ts`) must NOT be modified
- `G.piles.bystanders` and `G.piles.wounds` are consumed, not re-created
- Escape-causes-wound logic must live in a move layer (`villainDeck.reveal.ts`), not in `city.logic.ts`

---

## Required `// why:` Comments (Mandatory)

- 1-bystander-per-villain: MVP simplification from full Legendary rules
- Escape-causes-wound: MVP rule linking escapes to player penalty
- `koCard`: KO is a one-way destination; cards never recovered in MVP
- `gainWound` empty pile: no wound to give; deterministic
- Escape handling location: why escape penalty is implemented in `villainDeck.reveal.ts` (move has G + ctx.currentPlayer; helpers remain pure)

---

## Files to Produce (Exhaustive)

### New (pure helpers)
- `src/board/ko.logic.ts` -- **new** -- `koCard` helper (destination-only append)
- `src/board/wounds.logic.ts` -- **new** -- `gainWound` helper (pile[0] -> discard)
- `src/board/bystanders.logic.ts` -- **new** -- `attachBystanderToVillain`, `awardAttachedBystanders`, `resolveEscapedBystanders`

### Modified (moves)
- `src/villainDeck/villainDeck.reveal.ts` -- **modified**
  - attach bystander after villain/henchman enters City
  - on escape (escapedCard != null): apply wound to ctx.currentPlayer
  - on escape: resolve any attached bystanders for the escaped card (delete mapping entry, return bystanders to supply)
- `src/moves/fightVillain.ts` -- **modified**
  - after removing villain and placing it in victory: award attached bystanders to player victory and delete mapping entry

### Modified (state + exports)
- `src/types.ts` -- **modified** -- add `ko`, `attachedBystanders`
- `src/index.ts` -- **modified** -- export new helpers

### Tests (22 new total)
- `src/board/ko.logic.test.ts` -- **new** -- 3 tests
- `src/board/wounds.logic.test.ts` -- **new** -- 4 tests
- `src/board/bystanders.logic.test.ts` -- **new** -- 8 tests
- `src/board/escape-wound.integration.test.ts` -- **new** -- 7 tests

---

## Test Requirements (Locked)

### ko.logic.test.ts -- 3 tests
1) appends card to KO pile
2) returns new array (no mutation)
3) JSON.stringify succeeds

### wounds.logic.test.ts -- 4 tests
1) moves one wound from pile[0] to discard
2) empty pile = no-op
3) returns new arrays
4) JSON.stringify succeeds

### bystanders.logic.test.ts -- 8 tests
1) attach takes top bystander (pile[0] convention)
2) attach removes from pile and adds to mapping
3) attach empty pile = no-op
4) award moves attached bystanders to victory
5) award deletes mapping entry
6) award with no entry = no-op
7) resolveEscapedBystanders returns bystanders to supply pile and removes mapping
8) JSON.stringify succeeds for all returned structures

### escape-wound.integration.test.ts -- 7 tests
1) escape triggers wound gain for current player
2) escape with empty wounds pile = no wound, no error
3) JSON.stringify(G) succeeds after escape + wound
4) on villain City entry: one bystander attached from G.piles.bystanders
5) on defeat (via fightVillain): attached bystanders move to player victory and mapping entry removed
6) empty bystander pile on City entry: no attachment, no error
7) escape with attached bystanders: bystanders returned to supply pile, mapping entry removed, no bystander leak

---

## Common Failure Smells (Optional)

- `G.attachedBystanders` uses Map or Set instead of plain Record
  -> JSON serialization will fail
- `gainWound` throws when wounds pile is empty
  -> deterministic no-op contract violated
- Pure helpers import boardgame.io
  -> layer boundary violated
- Escape wound logic placed in `city.logic.ts` instead of `villainDeck.reveal.ts`
  -> pure helper boundary violated; city.logic.ts must not know about G, ctx, or messages

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] No boardgame.io import in pure helper files
- [ ] No `.reduce()` in new files
- [ ] WP-015 contract files not modified (`git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated (KO, wounds, bystander capture exist)
- [ ] `docs/ai/DECISIONS.md` updated (1 bystander per villain simplified; escape causes wound; `G.attachedBystanders` is plain object not Map; escaped bystanders return to supply; pile[0] top-of-pile convention)
- [ ] `docs/ai/ARCHITECTURE.md` updated (`G.ko` and `G.attachedBystanders` in Field Classification table)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-017 checked off with date
