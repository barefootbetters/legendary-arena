# EC-313 — WP-282 Session 1: Face-Down Zone Architecture + Core Moves

**Status:** Drafted 2026-06-23  
**WP:** [WP-282](../work-packets/WP-282-undercover-face-down-zone.md)  
**Session Focus:** Game Engine layer only  
**Scope:** Add `faceDownCards` zone, three moves, determinism rule  

---

## Locked Values (Do Not Change)

| Item | Value | Authority |
|------|-------|-----------|
| Reserved Decision Prefix | D-24059, D-24060, D-24061 | WP-282 §Reserved Decisions |
| Zone Type Name | `FaceDownCard[]` | WP-282 §Technical Design |
| Zone Owner Field | `ownerPlayerId: string` | D-24059 |
| Move 1 Name | `sendUndercover` | WP-282 §Session 1 |
| Move 2 Name | `playFromUndercover` | WP-282 §Session 1 |
| Move 3 Helper | `lookAtUndercover` (test-only, no G mutation) | WP-282 §Session 1 |
| Zone Initialization | Empty array per player at setup | WP-282 §Acceptance Criteria |
| Identity Storage | Deterministic; display randomized per render | D-24060 |
| Test Count Minimum | 30+ new tests | WP-282 §Acceptance Criteria |
| Sentinel Hash | Must be unchanged (zone is transparent to final state) | WP-282 §Acceptance Criteria |

---

## Implementation Checklist

### Zone Type & Initialization
- [ ] Add `interface FaceDownCard { cardId: CardExtId; ownerPlayerId: string; }` to `packages/game-engine/src/zones.ts`
- [ ] Add `faceDownCards: readonly FaceDownCard[]` to `PlayerZones` interface
- [ ] Initialize `faceDownCards: []` per player in `Game.setup()` (via `buildInitialGameState`)
- [ ] Verify initialization in `game.test.ts` (setup assertion)

### Moves: `sendUndercover`
- [ ] Add move `sendUndercover({ cardId, sourceZone })` to `packages/game-engine/src/moves/`
- [ ] Validate: source zone exists and contains the card
  - [ ] Return silently if `sourceZone` is not one of `hand | hq | revealed`
  - [ ] Return silently if card not found in source zone
- [ ] Mutation: remove card from source zone, add `{ cardId, ownerPlayerId: ctx.currentPlayer }` to `G.playerZones[ctx.currentPlayer].faceDownCards`
- [ ] Return `void` (no throw)
- [ ] Register in `Game.moves` object

### Moves: `playFromUndercover`
- [ ] Add move `playFromUndercover({ cardId })` to `packages/game-engine/src/moves/`
- [ ] Validate: `cardId` exists in current player's face-down store
  - [ ] Return silently if card not found
- [ ] Mutation: remove card from face-down store, play card as if drawn (via existing `playCard` logic or new minimal wrapper)
- [ ] Return `void` (no throw)
- [ ] Register in `Game.moves` object

### Moves: `lookAtUndercover` (Helper — No G Mutation)
- [ ] Add helper function `lookAtUndercover(G, ctx, cardId): string` to `packages/game-engine/src/helpers/`
- [ ] Returns: the real `CardExtId` (for test assertions)
- [ ] No G mutation, no UI side-effect
- [ ] Do NOT register as a boardgame.io move

### Determinism Rule (Load-Bearing)
- [ ] Document in `DECISIONS.md` (D-24060):
  - Identity stored: `FaceDownCard.cardId` is the real CardExtId
  - Display randomized: UI generates "Undercover Card A", "Undercover Card B" on render
  - Randomization is per-render (same seed/path = same display string)
  - Opponent projection: never exposes real identity
- [ ] No code change required for determinism (stored identity is inherently deterministic)

### Tests (30+ new)
- [ ] Create `packages/game-engine/src/moves/__tests__/sendUndercover.test.ts`:
  - [ ] Setup: faceDownCards initialized empty
  - [ ] Send from hand: card removed from hand, added to face-down with ownerPlayerId
  - [ ] Send from hq: card removed from HQ, added to face-down
  - [ ] Send from revealed: card removed from revealed, added to face-down
  - [ ] Silent return: invalid source zone
  - [ ] Silent return: card not in source zone
  - [ ] Multi-player: each player has separate face-down store
  - [ ] Opponent cannot see the real card (projection test)
  - (8+ tests)

- [ ] Create `packages/game-engine/src/moves/__tests__/playFromUndercover.test.ts`:
  - [ ] Play from face-down: card removed from face-down, hand receives it (or plays immediately)
  - [ ] Silent return: card not in face-down store
  - [ ] Identity correct: played card is the stored identity, not a random card
  - [ ] Multi-copy scenario: multiple copies in face-down, playing one removes exactly one
  - (4+ tests)

- [ ] Create `packages/game-engine/src/helpers/__tests__/lookAtUndercover.test.ts`:
  - [ ] Returns correct CardExtId for stored card
  - [ ] No G mutation (snapshot before/after identical)
  - (2+ tests)

- [ ] Create integration test `packages/game-engine/src/__tests__/faceDownZone.integration.test.ts`:
  - [ ] Full flow: send 3 cards from different zones, play one, verify final state
  - [ ] Determinism: same seed produces same face-down sequence (identity unchanged, display varies)
  - [ ] Opponent projection: opponent UIState never sees real card identities
  - [ ] Rewind: facing down then undoing moves restores state correctly
  - (8+ tests)

- [ ] Add drift-detection test to `game.test.ts`:
  - [ ] Move registry assertion: verify `sendUndercover` and `playFromUndercover` are registered
  - [ ] Total move count: 26 → 28 (was 26 at WP-281)

### Engine Test Baseline
- [ ] Run full test suite: `pnpm test` (from `packages/game-engine/`)
- [ ] Capture baseline: 376 → ~406 tests (30+ new)
- [ ] Verify: all tests pass, no regressions

### Sentinel Hash / Determinism
- [ ] Run determinism check: replay with same seed, verify final state hash unchanged
- [ ] Verify: face-down zone is transparent to sentinel (state hash computed before face-down was added, should not change)

### Code Style Compliance
- [ ] No `Math.random()` anywhere (only `ctx.random.*`)
- [ ] No `try/catch` in moves (return silently instead)
- [ ] Comments: `// why:` on every `ctx.events.setPhase()` and `ctx.events.endTurn()` (N/A here)
- [ ] No `.reduce()` in zone operations

### Layer Boundary Compliance
- [ ] **Only** in `packages/game-engine/src/` (no server, no dashboard changes)
- [ ] No imports from `registry`, `preplan`, `server`, or `apps/*`
- [ ] No boardgame.io imports in helpers (moves may import `Ctx` type)

---

## Merge Checklist (Before Commit)

- [ ] Tests pass: `pnpm test` (0 failures)
- [ ] Typecheck passes: `pnpm -r typecheck`
- [ ] No style drift: visually verify no commented-out code, no `TODO`s without context
- [ ] DECISIONS.md updated with D-24059 / D-24060 / D-24061
- [ ] No orphaned code: every helper is either tested or registered as a move

---

## Expected Artifacts

After this session completes:

**Files Created/Modified:**
- `packages/game-engine/src/zones.ts` (add `FaceDownCard` interface, `faceDownCards` zone)
- `packages/game-engine/src/moves/sendUndercover.ts` (new)
- `packages/game-engine/src/moves/playFromUndercover.ts` (new)
- `packages/game-engine/src/helpers/lookAtUndercover.ts` (new)
- `packages/game-engine/src/__tests__/game.test.ts` (update move count, add faceDownCards setup assert)
- `packages/game-engine/src/moves/__tests__/sendUndercover.test.ts` (new, 8+ tests)
- `packages/game-engine/src/moves/__tests__/playFromUndercover.test.ts` (new, 4+ tests)
- `packages/game-engine/src/helpers/__tests__/lookAtUndercover.test.ts` (new, 2+ tests)
- `packages/game-engine/src/__tests__/faceDownZone.integration.test.ts` (new, 8+ tests)
- `docs/ai/DECISIONS.md` (add D-24059 / D-24060 / D-24061 entries)

**Commit Message Format:**
```
EC-313: Face-down zone architecture + sendUndercover / playFromUndercover moves

- Add FaceDownCard zone type to G.playerZones (per-player, deterministic identity)
- Add sendUndercover move (from hand/HQ/revealed, Move Validation Contract)
- Add playFromUndercover move (retrieve & play, Move Validation Contract)
- Add lookAtUndercover helper (debug-only, no G mutation)
- 30+ new tests: setup, send from 3 sources, play, identity contract, determinism
- Reserve D-24059 / D-24060 / D-24061 (per-player zone, stored-identity rule, no UI Session 1)

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```

---

## Governance Close (After Session 1 Lands)

Once this session's PR is merged:
- Update WP-282 status: `Drafting` → `Session 1 Complete`
- Update EC-313 status: `Drafted` → `Done`
- Update EC-314 status: `Drafted` → `Ready for Session 2`
- Update WORK_INDEX.md: WP-282 line changes to `Session 1 Complete, EC-313 Done, EC-314 Ready`

---

## See Also

- [WP-282](../work-packets/WP-282-undercover-face-down-zone.md) (parent work packet)
- [EC-314](EC-314-wp282-session2-keyword-integration.md) (Session 2: keyword + parser)
- [D-24059, D-24060, D-24061](../DECISIONS.md) (locked decisions)
