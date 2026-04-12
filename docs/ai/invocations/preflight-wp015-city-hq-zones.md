# Pre-Flight Invocation — WP-015

---

### Pre-Flight Header

**Target Work Packet:** `WP-015`
**Title:** City & HQ Zones (Villain Movement + Escapes)
**Previous WP Status:** WP-014A Complete (2026-04-11), WP-014B Complete (2026-04-11)
**Pre-Flight Date:** 2026-04-11
**Invocation Stage:** Pre-Execution (Scope & Readiness)

**Work Packet Class:** Behavior / State Mutation
- Adds `G.city` (5-tuple) and `G.hq` (5-tuple) to `LegendaryGameState`
- Modifies `revealVillainCard` to route villain/henchman cards to City
- Implements `pushVillainIntoCity` as a pure helper
- Wires escape counter via `ENDGAME_CONDITIONS.ESCAPED_VILLAINS`

---

### Pre-Flight Intent

Perform a pre-flight validation for WP-015.

- Not implementing.
- Not generating code.
- Validating readiness and constraints only.

If a blocking condition is found, pre-flight must return **NOT READY** and stop.

---

### Authority Chain (Must Read)

1. `.claude/CLAUDE.md` — EC-mode rules, bug handling, commit discipline
2. `docs/ai/ARCHITECTURE.md` — Layer boundaries, Zone Mutation Rules,
   RevealedCardType Conventions, Villain Deck Authority Boundary
3. `docs/ai/execution-checklists/EC-015-city-zones.checklist.md` — Governing EC
4. `docs/ai/work-packets/WP-015-city-hq-zones-villain-movement.md` — The
   authoritative WP specification
5. Dependencies: WP-014A (reveal pipeline), WP-014B (deck composition),
   WP-010 (ENDGAME_CONDITIONS), WP-009B (rule pipeline)

All read and confirmed. No conflicts found.

---

### Dependency & Sequencing Check

| WP | Status | Notes |
|---|---|---|
| WP-014A | ✅ | Complete (2026-04-11). `revealVillainCard` exported, discard routing at line 136. |
| WP-014B | ✅ | Complete (2026-04-11). `buildVillainDeck` populates `G.villainDeck` and `G.villainDeckCardTypes` with real data. |
| WP-010 | ✅ | `ENDGAME_CONDITIONS.ESCAPED_VILLAINS` exported from `endgame.types.ts`. |
| WP-009B | ✅ | `executeRuleHooks` and `applyRuleEffects` exported. |
| WP-006A | ✅ | `CardExtId` exported. |
| WP-008A | ✅ | `MoveError` exported (needed for `validateCityShape`). |
| WP-005B | ✅ | `makeMockCtx` exported. |

All prerequisites complete. No blocking dependencies.

---

### Structural Readiness Check (Types & Contracts)

- [x] All prior WPs compile and tests pass — build exits 0; **152 tests pass, 0 fail**
- [x] No known EC violations remain open
- [x] Required types/contracts exist and are exported:
  - `revealVillainCard` (villainDeck.reveal.ts, line 38)
  - `RevealedCardType`, `REVEALED_CARD_TYPES`, `VillainDeckState` (villainDeck.types.ts)
  - `ENDGAME_CONDITIONS` with `ESCAPED_VILLAINS` key (endgame.types.ts)
  - `CardExtId` (zones.types.ts)
  - `MoveError` (coreMoves.types.ts)
  - `makeMockCtx` (mockCtx.ts)
- [x] `LegendaryGameState` does NOT yet have `city` or `hq` fields — clean slate
- [x] `src/board/` directory does NOT exist yet — no naming conflicts
- [x] Discard routing in `revealVillainCard` is at line 136:
      `G.villainDeck.discard = [...G.villainDeck.discard, cardId]`
      — this is the line WP-015 modifies for villain/henchman City routing
- [x] EC-015 exists and aligns with WP specification
- [x] No naming or ownership conflicts anticipated

All YES. No blockers.

---

### Runtime Readiness Check (Mutation & Framework)

- [x] The expected runtime touchpoints are known:
  - `villainDeck.reveal.ts` — modify discard routing to City for
    villain/henchman types; preserve existing routing for other types
  - `buildInitialGameState.ts` — initialize `G.city` and `G.hq`
  - `types.ts` — add `city: CityZone` and `hq: HqZone` to
    `LegendaryGameState`
- [x] Framework context requirements are understood:
  - No new framework context needed — `pushVillainIntoCity` is pure
  - `ENDGAME_CONDITIONS.ESCAPED_VILLAINS` for escape counting
- [x] Existing test infrastructure supports required mocks — `makeMockCtx`
      provides deterministic shuffle; mock G states can include `city` and
      `hq` fields
- [x] Runtime wiring allowance: `buildInitialGameState.ts` is in the WP-015
      allowlist (not an 01.5 exception)
- [x] No architecture boundary violations expected — City/HQ logic is
      game-engine layer only; `pushVillainIntoCity` is a pure helper with
      no boardgame.io imports

All YES. No blockers.

---

### Established Patterns to Follow (Locked Precedents)

- Pure helpers (`pushVillainIntoCity`, `initializeCity`, `initializeHq`)
  return new values; move code assigns results into `G` under Immer
- `for...of` loops for iteration — no `.reduce()`
- Zone helpers have no boardgame.io imports (same pattern as `zoneOps.ts`)
- Escape counter uses `ENDGAME_CONDITIONS` constants — never string literals
- 5-tuple types enforce fixed board layout at the type level
- Drift-detection and shape validation follow existing patterns
  (`validateGameStateShape`, `validateCityShape`)
- `// why:` comments on all non-obvious design decisions
- City placement occurs before rule effects so hooks observe post-placement
  state

No deviations anticipated.

---

### Scope Lock (Critical)

#### WP-015 Is Allowed To

- **Create:** `src/board/city.types.ts` — `CityZone`, `HqZone`, `CitySpace`, `HqSlot`
- **Create:** `src/board/city.logic.ts` — `pushVillainIntoCity`, `initializeCity`, `initializeHq`
- **Create:** `src/board/city.validate.ts` — `validateCityShape`
- **Create:** `src/board/city.logic.test.ts` — 7+ city push unit tests
- **Create:** `src/villainDeck/villainDeck.city.integration.test.ts` — 8 integration tests
- **Modify:** `src/villainDeck/villainDeck.reveal.ts` — route villain/henchman to City
- **Modify:** `src/setup/buildInitialGameState.ts` — initialize `G.city` and `G.hq`
- **Modify:** `src/types.ts` — add `city` and `hq` to `LegendaryGameState`
- **Modify:** `src/index.ts` — export new public API
- **Update:** governance docs (STATUS.md, DECISIONS.md, ARCHITECTURE.md, WORK_INDEX.md)

#### WP-015 Is Explicitly Not Allowed To

- No fight / attack / recruit mechanics (WP-016)
- No KO pile (WP-017)
- No bystander capture rules (WP-017) — bystanders go to discard + message
- No HQ purchase logic (WP-016) — HQ initialized but immutable
- No mastermind tactics resolution (WP-019)
- No modification of `villainDeck.types.ts` (WP-014A contract, locked)
- No `@legendary-arena/registry` imports
- No `Math.random()`, no `.reduce()` in city logic, no `require()`
- No boardgame.io imports in pure helpers (`city.logic.ts`, `city.types.ts`)
- No persistence or database logic
- No server or UI changes

**Rule:** Anything not explicitly allowed is out of scope.

---

### Test Expectations (Locked Before Execution)

- **7+ new tests** in `src/board/city.logic.test.ts`:
  1. Push places card at space 0 of empty city
  2. Push shifts existing cards forward
  3. Push with all 5 spaces full: space 4 card escapes
  4. Escaped card returned as `escapedCard`; non-escape returns null
  5. Escape identity: `escapedCard === oldCity[4]`
  6. City remains 5-element tuple after push
  7. JSON.stringify succeeds after push
  8. `initializeCity()` returns all nulls
- **8 new tests** in `src/villainDeck/villainDeck.city.integration.test.ts`:
  1. Villain reveal places card in `G.city[0]`
  2. Henchman reveal places card in `G.city[0]`
  3. Scheme-twist does NOT modify `G.city`
  4. Mastermind-strike does NOT modify `G.city`
  5. Escape increments `G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS]`
  6. JSON.stringify(G) succeeds after reveal + city placement
  7. `G.hq` remains unchanged after villain reveals
  8. Malformed `G.city` causes safe failure
- **Prior test baseline:** All 152 existing tests must continue to pass
- **Existing test changes:** WP-014A reveal tests may need minor updates if
  they assert discard routing for villain/henchman cards — those cards now
  go to City instead. These would be structural assertion updates reflecting
  the new routing, documented in the execution summary.
- **Test boundaries:** No boardgame.io imports; no makeMockCtx modifications

---

### Mutation Boundary Confirmation

- [x] `G` mutations occur only inside `revealVillainCard` (Immer move context)
      and `buildInitialGameState` (setup context)
- [x] `pushVillainIntoCity` is a pure function — returns new tuple, does not
      mutate inputs
- [x] `initializeCity` and `initializeHq` are pure factories
- [x] No mutation occurs outside authorized contexts

No violations. No blockers.

---

### Risk & Ambiguity Review (Resolve Now, Lock for Execution)

#### Risk 1: WP-014A reveal tests may break on routing change

- **Risk:** WP-014A reveal tests assert that villain/henchman cards go to
  discard. WP-015 changes this routing — villain/henchman now go to City.
  Tests 1-2 in `villainDeck.reveal.test.ts` assert discard placement.
- **Impact:** Medium — tests will fail until updated.
- **Mitigation:** The WP-014A test file IS modifiable by WP-015 (it's not
  in the "explicitly forbidden" list — only `villainDeck.types.ts` is locked).
  Update affected test assertions to expect City placement instead of discard.
  These are structural assertion updates reflecting new routing behaviour,
  not new test logic.
- **Decision:** Permitted. Document as structural test updates in execution
  summary. The mock G states in reveal tests will need `city` and `hq` fields.

#### Risk 2: Ordering of City placement vs rule effects

- **Risk:** The WP specifies City placement occurs BEFORE rule effects so
  hooks observe post-placement state. This is a contractual ordering.
- **Impact:** High if violated — rule hooks would see pre-placement state.
- **Mitigation:** The implementation must insert City placement logic after
  step 4 (type lookup) but before step 5 (trigger emission) in the reveal
  pipeline. The WP is explicit about this.
- **Decision:** Locked. Implementation must follow the WP ordering exactly.

#### Risk 3: `revealVillainCard` currently uses `DEFAULT_IMPLEMENTATION_MAP`

- **Risk:** The reveal function imports `DEFAULT_IMPLEMENTATION_MAP` at
  module scope. WP-015 adds `pushVillainIntoCity` and `ENDGAME_CONDITIONS`
  imports. The function is growing — risk of exceeding the 30-line guideline.
- **Impact:** Low — the function can be structured with helper calls.
- **Mitigation:** Use named helper functions for City routing logic. Keep
  `revealVillainCard` as the orchestrator.
- **Decision:** Low risk. Code style permits extracted helpers.

#### Risk 4: HQ immutability enforcement

- **Risk:** WP-015 initializes `G.hq` but no move may mutate it. Tests must
  verify immutability.
- **Impact:** Low — the integration test (test 7) asserts `G.hq` remains null.
- **Mitigation:** No code path in WP-015 touches `G.hq` after initialization.
- **Decision:** Low risk. Test enforces it.

All risks mitigated. No unresolved ambiguities.

---

### Pre-Flight Verdict (Binary)

## READY TO EXECUTE

WP-015 is properly sequenced — WP-014A and WP-014B are both complete and
committed (142 + 10 = 152 tests passing). The repo is green: build succeeds.
All structural prerequisites are verified: `revealVillainCard` with discard
routing at line 136, `ENDGAME_CONDITIONS.ESCAPED_VILLAINS`, `MoveError` for
validation, and `makeMockCtx` for tests. The `src/board/` directory and
`G.city`/`G.hq` fields don't exist yet — clean slate. EC-015 exists and
aligns with the WP. Scope boundaries are clear: 5 new files, 4 modified
files, no fight/recruit/KO/bystander-capture mechanics. The one significant
risk (WP-014A test breakage from routing change) is anticipated and permitted
as structural assertion updates.

---

### Authorized Next Step

> You are authorized to generate a **session execution prompt** for WP-015
> to be saved as:
> `docs/ai/invocations/session-wp015-city-hq-zones.md`

**Guard:** The session prompt must conform exactly to the scope, constraints,
and decisions locked by this pre-flight and EC-015. No new scope may be
introduced. `villainDeck.types.ts` must not be modified. HQ must remain
immutable after initialization.
