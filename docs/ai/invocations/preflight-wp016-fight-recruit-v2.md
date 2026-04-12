# Pre-Flight Report — WP-016 (Pre-Execution)

**Target Work Packet:** `WP-016`
**Title:** Fight First, Then Recruit (Minimal MVP)
**Previous WP Status:** WP-015 Complete (2026-04-11), WP-015A Complete (2026-04-11)
**Pre-Flight Date:** 2026-04-11
**Invocation Stage:** Pre-Execution (Scope & Readiness)

**Work Packet Class:** Behavior / State Mutation

---

## Pre-Flight Intent

Perform a pre-flight validation for WP-016.
Not implementing. Validating readiness and constraints only.

WP-016 has **not been implemented yet**. This is a genuine pre-execution
gate, not a Mode B audit.

---

## Authority Chain (Read and Followed)

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md`
3. `docs/ai/execution-checklists/EC-016-fight-recruit.checklist.md`
4. `docs/ai/work-packets/WP-016-fight-then-recruit-minimal-mvp.md`

---

## Dependency & Sequencing Check

| WP | Status | Notes |
|---|---|---|
| WP-015 | Complete (2026-04-11) | `G.city`, `G.hq` as 5-tuples; `CityZone`, `HqZone` exported |
| WP-015A | Complete (2026-04-11) | Stage gating + card-drop fix in reveal |
| WP-008A | Complete | `MoveResult`, `MoveError` in `coreMoves.types.ts` |
| WP-007A | Complete | `G.currentStage` as `TurnStage` (`start`/`main`/`cleanup`) |
| WP-006A | Complete | `CardExtId` in `zones.types.ts` |
| WP-005B | Complete | `makeMockCtx` in `test/mockCtx.ts` |

**Verdict:** All prerequisites satisfied.

---

## Structural Readiness Check

- [x] All prior WPs compile and tests pass — **build exits 0, 170 tests,
      0 failures**
- [x] No known EC violations remain open
- [x] Required types/contracts exist:
  - `CityZone`, `HqZone` (`board/city.types.ts`)
  - `G.city` and `G.hq` on `LegendaryGameState` (`types.ts:231,236`)
  - `MoveResult`, `MoveError` (`coreMoves.types.ts`)
  - `CardExtId` (`zones.types.ts`)
  - `PlayerZones.victory` (`zones.types.ts:49`)
  - `PlayerZones.discard` (`zones.types.ts`)
  - `G.currentStage` as `TurnStage` (`types.ts:185`)
  - `makeMockCtx` (`test/mockCtx.ts`)
- [x] No naming or ownership conflicts
- [x] No architectural boundary conflicts anticipated

---

## Runtime Readiness Check

- [x] Runtime touchpoints known: `game.ts` (register moves), new
      `fightVillain.ts` and `recruitHero.ts`
- [x] Framework context: `ctx.currentPlayer` for player zone access
- [x] Non-core move pattern understood: internal stage gating, same as
      `revealVillainCard` precedent (WP-014A/EC-014A)
- [x] No 01.5 wiring allowance anticipated (new files only + game.ts/
      index.ts registration which is explicitly in scope)
- [x] No architecture boundary violations expected

---

## Established Patterns to Follow (Locked Precedents)

- Three-step validation contract: validate args -> check stage gate ->
  mutate G (WP-008A)
- Non-core internal stage gating: `if (G.currentStage !== 'main') return;`
  as first check after arg validation (WP-014A pattern)
- Moves never throw; return void on invalid input
- Zone mutations via explicit assignment (not `.reduce()`)
- `// why:` comments on all non-obvious decisions

---

## Scope Lock (Critical)

### WP-016 Is Allowed To

| Action | File | Purpose |
|---|---|---|
| Create | `src/moves/fightVillain.ts` | Fight move implementation |
| Create | `src/moves/recruitHero.ts` | Recruit move implementation |
| Create | `src/moves/fightVillain.test.ts` | Fight tests (7) |
| Create | `src/moves/recruitHero.test.ts` | Recruit tests (7) |
| Modify | `src/game.ts` | Register moves in play phase |
| Modify | `src/index.ts` | Export new moves |

### WP-016 Is Explicitly Not Allowed To

- No modification of `coreMoves.types.ts`, `coreMoves.validate.ts`,
  `coreMoves.gating.ts` (WP-008A contracts)
- No modification of `city.types.ts` (WP-015 contract)
- No modification of `villainDeck.types.ts` (WP-014 contract)
- No addition to `CoreMoveName`, `CORE_MOVE_NAMES`, `MOVE_ALLOWED_STAGES`
- No attack/recruit point economy (WP-018)
- No card text effects (WP-022)
- No bystander rescue or `G.attachedBystanders` access (WP-017)
- No KO pile (WP-017)
- No mastermind fight (WP-019)
- No HQ refill after recruit (WP-018+)
- No hard lockout of recruit-before-fight
- No `Math.random()`, `.reduce()`, `require()`, `throw`

---

## Test Expectations (Locked Before Execution)

**`fightVillain.test.ts`:** 7 tests
1. Removes card from `G.city[cityIndex]`
2. Card appears in player's `victory` zone
3. Invalid `cityIndex` (out of range): no mutation
4. Empty city space (null): no mutation
5. Wrong stage (`start`): no mutation
6. `JSON.stringify(G)` succeeds after fight
7. Idempotence: second call on same index = no-op

**`recruitHero.test.ts`:** 7 tests
1. Removes card from `G.hq[hqIndex]`
2. Card appears in player's `discard` zone
3. Invalid `hqIndex` (out of range): no mutation
4. Empty HQ slot (null): no mutation
5. Wrong stage (`cleanup`): no mutation
6. `JSON.stringify(G)` succeeds after recruit
7. Idempotence: second call on same index = no-op

**Prior baseline:** 170 tests must continue to pass.
**No boardgame.io imports** in test files.

---

## Mutation Boundary Confirmation

- [x] `G` mutations occur only inside `fightVillain` and `recruitHero`
      (framework-authorized move context)
- [x] `fightVillain` mutates only `G.city[cityIndex]` (to null) and
      `G.playerZones[player].victory` (push) and `G.messages` (push)
- [x] `recruitHero` mutates only `G.hq[hqIndex]` (to null) and
      `G.playerZones[player].discard` (push) and `G.messages` (push)
- [x] No cross-zone side effects (fight doesn't touch HQ, recruit
      doesn't touch City)

---

## Risk & Ambiguity Review

| # | Risk | Impact | Mitigation | Decision |
|---|---|---|---|---|
| 1 | Move signature mismatch with boardgame.io 0.50.x | Moves won't fire | Use `MoveContext` type from game.ts; match `revealVillainCard` pattern | Follow existing pattern |
| 2 | `ctx.currentPlayer` availability | Can't place in correct player zones | boardgame.io provides this in move context; all existing moves use it | Locked |
| 3 | Fight-first policy confusion | Engine might enforce ordering | Policy is documented, not enforced. Both moves valid in `main` simultaneously | Locked per D-1602 |
| 4 | game.test.ts move-count assertion | Test breaks when moves added | 01.5 wiring: update structural assertion (5 -> 7 moves) | Eligible under 01.5 |

**Risk 4 detail:** The existing `game.test.ts` asserts exactly 5 moves.
Adding `fightVillain` and `recruitHero` will require updating this
assertion to 7. This is a structural assertion update eligible under
01.5 runtime wiring allowance — value-only change, no new logic.

---

## Pre-Flight Verdict

## READY TO EXECUTE

All dependencies are complete (WP-015, WP-008A, WP-007A, WP-006A, WP-005B).
Required types and contracts exist (`CityZone`, `HqZone`, `MoveError`,
`PlayerZones.victory`, `G.currentStage`). The scope lock is clear with 6
allowed files and explicit prohibitions on contract modification. The non-core
move gating pattern is established (WP-014A precedent). Test expectations
are locked at 7 per move. Build clean, 170 tests passing.

One anticipated 01.5 wiring change: `game.test.ts` move-count assertion
update (5 -> 7).

---

## Authorized Next Step

You are authorized to generate a **session execution prompt** for WP-016
to be saved as:
`docs/ai/invocations/session-wp016-fight-recruit-v2.md`
