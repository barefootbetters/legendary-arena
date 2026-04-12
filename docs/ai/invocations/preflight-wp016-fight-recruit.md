# Pre-Flight — WP-016: Fight First, Then Recruit (Minimal MVP)

**Target Work Packet:** `WP-016`
**Title:** Fight First, Then Recruit (Minimal MVP)
**Previous WP Status:** WP-015 Complete (2026-04-11)
**Pre-Flight Date:** 2026-04-11
**Invocation Stage:** Pre-Execution (Scope & Readiness)

**Work Packet Class:** Behavior / State Mutation

---

### Pre-Flight Intent

Perform a pre-flight validation for WP-016.

- Not implementing.
- Not generating code.
- Validating readiness and constraints only.

---

### Authority Chain (Read)

1. `.claude/CLAUDE.md` — EC-mode rules, commit discipline
2. `docs/ai/ARCHITECTURE.md` — layer boundaries, move validation contract,
   canonical reveal → fight → side-effect ordering
3. `docs/ai/execution-checklists/EC-016-fight-recruit.checklist.md`
4. `docs/ai/work-packets/WP-016-fight-then-recruit-minimal-mvp.md`
5. Dependencies: WP-015 (City/HQ zones), WP-008A (move contracts)

---

### Dependency & Sequencing Check

| WP | Status | Notes |
|---|---|---|
| WP-015 | ✅ Complete (2026-04-11) | City/HQ zones, push/escape logic, `G.city`/`G.hq` exist |
| WP-008A | ✅ Complete | `MoveResult`, `MoveError`, `CoreMoveName`, `MOVE_ALLOWED_STAGES`, `isMoveAllowedInStage` exist |
| WP-008B | ✅ Complete | `drawCards`, `playCard`, `endTurn` move implementations exist |
| WP-014A | ✅ Complete | `revealVillainCard` registered in `game.ts` moves |

All prerequisites are complete.

---

### Structural Readiness Check (Types & Contracts)

- [x] All prior WPs compile and tests pass (169 pass, 0 fail)
- [x] No known EC violations remain open
- [x] Required types/contracts exist and are exported:
  - `CityZone`, `HqZone` from `city.types.ts`
  - `MoveResult`, `MoveError` from `coreMoves.types.ts`
  - `G.currentStage` as `'start' | 'main' | 'cleanup'` (for internal gating)
  - `CardExtId` from `zones.types.ts`
  - `LegendaryGameState` with `city`, `hq`, `playerZones`
- [ ] **CONFLICT: `CoreMoveName` type vs contract lock** — see Risk #1 below
- [x] No architectural boundary conflicts anticipated at the contract level

**One issue identified — see Risk & Ambiguity Review.**

---

### Runtime Readiness Check (Mutation & Framework)

- [x] Runtime touchpoints known: `game.ts` (register moves), `coreMoves.gating.ts`
  (add gating entries), new move files
- [x] Framework context requirements understood: moves receive
  `FnContext<LegendaryGameState> & { playerID }` with `G`, `ctx`, `events`
- [x] Existing test infrastructure supports mocks — `makeMockCtx` provides
  `SetupContext`; move tests use inline mock contexts with `ctx.currentPlayer`
  (same pattern as `villainDeck.reveal.test.ts`)
- [x] Runtime wiring allowance: `game.test.ts` may need move count assertion
  update (5 → 7) under 01.5
- [x] No architecture boundary violations expected — fight and recruit are
  engine-layer moves operating on `G.city` and `G.hq`

---

### Established Patterns to Follow (Locked Precedents)

- Move implementations follow the three-step contract (validate args, check
  stage gate, mutate G) — same as `drawCards`, `playCard`, `endTurn`
- Moves return `void`, never throw — invalid input returns early
- `revealVillainCard` precedent: registered directly in `game.ts` `moves`
  with its own stage gating inside the move body (not via `MOVE_ALLOWED_STAGES`)
- Inline mock contexts for move tests (not `makeMockCtx`, which is for setup)
- Pure helpers return new values; moves assign results into `G` under Immer

---

### Scope Lock (Critical)

#### WP-016 Is Allowed To

- Create: `src/moves/fightVillain.ts` — fight move (framework ctx allowed)
- Create: `src/moves/recruitHero.ts` — recruit move (framework ctx allowed)
- Create: `src/moves/fightVillain.test.ts` — 7 unit tests
- Create: `src/moves/recruitHero.test.ts` — 7 unit tests
- Modify: `src/game.ts` — register `fightVillain` and `recruitHero` in play
  phase moves
- Modify: `src/index.ts` — export new moves
- Modify: `src/moves/coreMoves.gating.test.ts` — update drift-detection test
- Modify (01.5): `src/game.test.ts` — update move count assertion if needed
- Update: governance docs (STATUS, DECISIONS, WORK_INDEX)

#### WP-016 Is Explicitly Not Allowed To

- No modification of WP-015 contract files (`city.types.ts`, `city.logic.ts`)
- No modification of WP-008A contract files (`coreMoves.types.ts`,
  `coreMoves.validate.ts`, `coreMoves.gating.ts`)
- No expansion of `CoreMoveName`, `CORE_MOVE_NAMES`, or `MOVE_ALLOWED_STAGES`
- No attack/recruit point checking (WP-018)
- No bystander rescue or cleanup (WP-017)
- No card text effects (WP-022)
- No escape handling in fightVillain
- No `Math.random()`
- No `.reduce()`
- No `throw` in move files
- No `boardgame.io` imports in test files
- No modification of `makeMockCtx`
- `fightVillain` must not read or mutate `G.hq`
- `fightVillain` must not inspect `G.attachedBystanders`

---

### Test Expectations (Locked Before Execution)

- 7 new tests in `src/moves/fightVillain.test.ts` (valid fight, victory
  placement, invalid index, null space, wrong stage, JSON serialization,
  idempotence)
- 7 new tests in `src/moves/recruitHero.test.ts` (valid recruit, discard
  placement, invalid index, null slot, wrong stage, JSON serialization,
  idempotence)
- `src/game.test.ts` may require move count assertion update (01.5 wiring)
- `coreMoves.gating.test.ts` is NOT modified (non-core move pattern)
- All 169 existing tests must continue to pass
- No `boardgame.io` imports in test files
- No modifications to `makeMockCtx`

---

### Mutation Boundary Confirmation

- [x] `G` mutations occur only inside `fightVillain` and `recruitHero` move
  implementations (framework-authorized via boardgame.io Immer context)
- [x] No mutation in helpers or validators — city space set to null and card
  appended to player zone are direct Immer mutations inside moves
- [x] No mutation outside the boardgame.io move context

---

### Risk & Ambiguity Review (Resolve Now, Lock for Execution)

#### Risk #1: `CoreMoveName` type expansion vs contract lock (BLOCKING → RESOLVED)

**Risk:** WP-016 originally said to add `fightVillain` and `recruitHero` to
`CORE_MOVE_NAMES` and `MOVE_ALLOWED_STAGES`, but also said `coreMoves.types.ts`
must NOT be modified. These cannot both be true.

**Impact:** Would require widening `CoreMoveName` union, which violates the
contract lock.

**Resolution:** Treat `fightVillain` and `recruitHero` as **non-core moves**
that gate internally via `G.currentStage === 'main'` — the same pattern
established by `revealVillainCard` (WP-014A). No modification to
`CoreMoveName`, `CORE_MOVE_NAMES`, or `MOVE_ALLOWED_STAGES`. WP-016 and
EC-016 have been updated to reflect this resolution. ARCHITECTURE.md now
documents the non-core gating pattern explicitly.

**Decision:** Locked for execution. Non-core moves gate internally.

#### Risk #2: cityIndex/hqIndex validation — finite integer check

**Risk:** JS allows `city[-1]`, `city[1.5]`, `city[NaN]` as property
lookups that return `undefined` rather than failing.

**Impact:** Could silently pass validation if only checking `!== null`.

**Mitigation:** WP-016 (as updated) explicitly requires `cityIndex` and
`hqIndex` to be finite integers in 0-4. Implementation must validate:
`Number.isInteger(index) && index >= 0 && index <= 4`.

**Decision:** Locked for execution.

#### Risk #3: `revealVillainCard` gating precedent (RESOLVED — adopted)

**Risk:** `revealVillainCard` (WP-014A) does its stage gating inside the
move body rather than via `MOVE_ALLOWED_STAGES`. Which pattern should
WP-016 follow?

**Resolution:** WP-016 follows the `revealVillainCard` precedent — internal
gating via `G.currentStage === 'main'`. This is now documented in
ARCHITECTURE.md as the canonical pattern for non-core moves.
`MOVE_ALLOWED_STAGES` applies only to the three original `CoreMoveName`
moves.

**Decision:** Locked for execution. Internal gating for non-core moves.

#### Risk #4: `game.test.ts` move count assertion

**Risk:** `game.test.ts` asserts a specific number of moves (currently 5:
drawCards, playCard, endTurn, advanceStage, revealVillainCard). Adding
2 more moves requires updating this to 7.

**Impact:** Test failure if not updated.

**Mitigation:** 01.5 wiring allowance. Value-only update, no new logic.

**Decision:** Locked for execution.

---

### Pre-Flight Verdict (Binary)

✅ **READY TO EXECUTE**

WP-016 is properly sequenced — all dependencies (WP-015, WP-008A/B, WP-014A)
are complete, build passes, and all 169 tests pass. The blocking issue
(CoreMoveName expansion vs contract lock) is cleanly resolved by treating
`fightVillain` and `recruitHero` as non-core moves with internal gating,
following the `revealVillainCard` precedent. No core contract files are
modified. Scope boundaries are clear: fight and recruit are simple move
primitives with no economy, no bystander logic, and no escape handling. The
fight-first policy is documented, not enforced. The canonical ordering
diagram in ARCHITECTURE.md confirms WP-016's fight flow does not conflict
with WP-015 reveal or WP-017 side-effects.

---

### Authorized Next Step

You are authorized to generate a **session execution prompt** for WP-016
to be saved as:
`docs/ai/invocations/session-wp016-fight-recruit.md`

**Guard:** The session prompt must conform exactly to the scope, constraints,
and decisions locked by this pre-flight. No new scope may be introduced.

The session prompt must include the Risk #1 resolution: `fightVillain` and
`recruitHero` are non-core moves with internal gating. No modification to
`coreMoves.types.ts`, `coreMoves.gating.ts`, or `coreMoves.validate.ts`.
