# Pre-Flight Invocation — WP-014A

---

### Pre-Flight Header

**Target Work Packet:** `WP-014A`
**Title:** Villain Reveal & Trigger Pipeline (Types + Move + Tests)
**Previous WP Status:** WP-013 Complete (2026-04-11)
**Pre-Flight Date:** 2026-04-11
**Invocation Stage:** Pre-Execution (Scope & Readiness)

**Work Packet Class:** Behavior / State Mutation
- Adds `villainDeck` and `villainDeckCardTypes` fields to `G`
- Implements `revealVillainCard` move that mutates `G` via Immer
- Wires into `game.ts` top-level moves
- Does NOT implement `buildVillainDeck` (deferred to WP-014B)

---

### Pre-Flight Intent

Perform a pre-flight validation for WP-014A.

- Not implementing.
- Not generating code.
- Validating readiness and constraints only.

If a blocking condition is found, pre-flight must return **NOT READY** and stop.

---

### Authority Chain (Must Read)

1. `.claude/CLAUDE.md` — EC-mode rules, bug handling, commit discipline
2. `docs/ai/ARCHITECTURE.md` — Layer boundaries, engine vs framework rules
3. `docs/ai/execution-checklists/EC-014A-villain-reveal-pipeline.checklist.md`
4. `docs/ai/work-packets/WP-014A-villain-reveal-pipeline.md`
5. Dependencies: WP-013, WP-009A/B (rule pipeline), WP-005B (shuffle),
   WP-008A/B (moves), WP-006A (zones)

All read and confirmed. No conflicts found.

---

### Dependency & Sequencing Check

| WP | Status | Notes |
|---|---|---|
| WP-013 | ✅ | Complete (2026-04-11) per WORK_INDEX.md |
| WP-009A | ✅ | `RuleTriggerName`, `RuleEffect`, `HookRegistry` exported |
| WP-009B | ✅ | `executeRuleHooks` and `applyRuleEffects` exported |
| WP-005B | ✅ | `shuffleDeck` exported; `makeMockCtx` exported |
| WP-008A | ✅ | `MoveResult`, `MoveError` exported |
| WP-008B | ✅ | `play` phase wired with 4 moves |
| WP-006A | ✅ | `CardExtId` exported |

All prerequisites complete. No blocking dependencies.

---

### Structural Readiness Check (Types & Contracts)

- [x] All prior WPs compile and tests pass — build exits 0; **130 tests pass, 0 fail**
- [x] No known EC violations remain open
- [x] Required types/contracts exist and are exported as referenced by WP-014A:
  - `RuleTriggerName`, `RuleEffect`, `HookRegistry` (ruleHooks.types.ts)
  - `executeRuleHooks` (ruleRuntime.execute.ts)
  - `applyRuleEffects` (ruleRuntime.effects.ts)
  - `CardExtId` (zones.types.ts)
  - `shuffleDeck` (shuffle.ts)
  - `makeMockCtx` (mockCtx.ts)
- [x] No naming or ownership conflicts — `VillainDeckState`, `RevealedCardType`,
      `REVEALED_CARD_TYPES` are new types not conflicting with existing exports
- [x] No architectural boundary conflicts anticipated — all new code lives in
      `packages/game-engine`; no registry imports

All YES. No blockers.

---

### Runtime Readiness Check (Mutation & Framework)

- [x] The expected runtime touchpoints are known:
  - `game.ts` — top-level `moves` extended to include `revealVillainCard`
  - `types.ts` — `LegendaryGameState` gains 2 new fields
  - `buildInitialGameState.ts` — 01.5 wiring for empty defaults
- [x] Framework context requirements are understood:
  - `ctx.random.Shuffle` via `shuffleDeck` (reshuffle only)
  - `ctx` passed to `executeRuleHooks` (opaque passthrough)
- [x] Existing test infrastructure can support required mocks — `makeMockCtx`
      reverses arrays (proving shuffle ran); no modifications needed
- [x] Runtime wiring allowance needs anticipated:
  - `buildInitialGameState.ts` — add empty-default villain deck fields
  - `game.test.ts` — update move-count assertion (4 -> 5, value-only)
- [x] No architecture boundary violations expected — no registry imports,
      classification lookup from `G` only

All YES. No blockers.

---

### Established Patterns to Follow (Locked Precedents)

- Inline mock contexts for tests requiring `ctx.random` — do NOT modify
  `makeMockCtx`
- Pure helpers return new values; moves assign into `G` under Immer
- `for...of` loops for iteration — no `.reduce()`
- Drift-detection tests for canonical arrays (same pattern as `TURN_STAGES`,
  `MATCH_PHASES`)
- Trigger emission reuses `executeRuleHooks` + `applyRuleEffects` pipeline
- Trigger tests use observable hooks in `G.hookRegistry` — no monkeypatching
- Move signature: `{ G, ctx }: MoveContext` destructured, returns `void`

No deviations anticipated.

---

### Scope Lock (Critical)

#### WP-014A Is Allowed To

- **Create:** `src/villainDeck/villainDeck.types.ts` — types + canonical array
- **Create:** `src/villainDeck/villainDeck.reveal.ts` — move implementation
- **Create:** `src/villainDeck/villainDeck.types.test.ts` — 2 tests
- **Create:** `src/villainDeck/villainDeck.reveal.test.ts` — 10 tests
- **Modify:** `src/game.ts` — add `revealVillainCard` to top-level moves
- **Modify:** `src/types.ts` — add 2 fields to `LegendaryGameState`
- **Modify:** `src/index.ts` — export new public API
- **Modify (01.5):** `src/setup/buildInitialGameState.ts` — empty defaults
- **Modify (01.5):** `src/game.test.ts` — move count 4 -> 5 (value-only)
- **Update:** governance docs (STATUS.md, DECISIONS.md, ARCHITECTURE.md, WORK_INDEX.md)

#### WP-014A Is Explicitly Not Allowed To

- No `buildVillainDeck` — deferred to WP-014B
- No deck composition logic, ext_id conventions, or card counts
- No City or HQ placement (WP-015)
- No bystander capture rules (WP-017)
- No Mastermind tactic reveal (WP-019)
- No registry imports in any new file
- No `Math.random()`, no `.reduce()`, no `require()`
- No modification of `makeMockCtx` or shared helpers
- No files outside the allowlist above

**Rule:** Anything not explicitly allowed is out of scope.

---

### Test Expectations (Locked Before Execution)

- **2 new tests** in `src/villainDeck/villainDeck.types.test.ts`:
  1. Drift: `REVEALED_CARD_TYPES` exactly matches the 5 canonical values
  2. `JSON.stringify` succeeds for a sample `VillainDeckState`
- **10 new tests** in `src/villainDeck/villainDeck.reveal.test.ts`:
  1-10 as specified in WP-014A §G, using mock deck fixtures
- **Prior test baseline:** All 130 existing tests must continue to pass
- **Existing test changes:** `game.test.ts` move-count assertion updated
  (4 -> 5) under 01.5 runtime wiring allowance — value-only, no new logic
- **Test boundaries:** No `boardgame.io` imports; no modifications to
  `makeMockCtx`; trigger tests use observable hooks, not spying

---

### Mutation Boundary Confirmation

- [x] `G` mutations occur only inside `revealVillainCard` (Immer context)
- [x] No mutation occurs in type files or helpers
- [x] `revealVillainCard` assigns new arrays to G fields (immutability by
      replacement)
- [x] No mutation occurs outside boardgame.io move context

No violations. No blockers.

---

### Risk & Ambiguity Review (Resolve Now, Lock for Execution)

#### Risk 1: Existing `game.test.ts` structural assertions

- **Risk:** Adding `revealVillainCard` to moves will change move count.
- **Impact:** Low — value-only assertion update.
- **Mitigation:** 01.5 allowance documented. No new test logic.
- **Decision:** Permitted. Value-only change (4 -> 5 moves).

#### Risk 2: `G.villainDeckCardTypes` serialization

- **Risk:** Must be a plain `Record<string, string>`.
- **Impact:** If non-serializable, `JSON.stringify(G)` fails.
- **Mitigation:** Types test verifies serialization. `RevealedCardType` is a
  string literal union — naturally serializable.
- **Decision:** Low risk. Tests enforce it.

#### Risk 3: Trigger name string matching

- **Risk:** Names must exactly match `RuleTriggerName` values.
- **Impact:** Mismatch silently prevents triggers from firing.
- **Mitigation:** EC-014A locks the exact names. Verified against
  `ruleHooks.types.ts`.
- **Decision:** Locked. No re-derivation permitted.

#### Risk 4: Empty deck as default state

- **Risk:** All existing tests run with empty villain deck after this change.
- **Impact:** None — existing tests don't interact with villain deck fields.
  The reveal move handles empty deck gracefully.
- **Mitigation:** WP-014A explicitly declares the pipeline must function with
  an empty deck. Tests verify this.
- **Decision:** No risk. Empty defaults are architecturally correct.

All risks mitigated. No unresolved ambiguities.

---

### Pre-Flight Verdict (Binary)

## READY TO EXECUTE

WP-014A is properly sequenced — its sole dependency WP-013 completed today
and all transitive dependencies are verified complete with exports confirmed.
The repo is green: build succeeds and all 130 tests pass. Scope boundaries
are clearly locked with a 9-file allowlist (4 new, 5 modified) and explicit
exclusion of `buildVillainDeck` (deferred to WP-014B). All locked values
(RevealedCardType slugs, trigger names, move signature, fail-closed
behaviour) are verified against existing source files and ARCHITECTURE.md.
The governing EC-014A exists and aligns with the WP specification. The
WP-014A/014B split is clean — reveal pipeline is independent of deck
construction.

---

### Authorized Next Step

> You are authorized to generate a **session execution prompt** for WP-014A
> to be saved as:
> `docs/ai/invocations/session-wp014a-villain-reveal-pipeline.md`

**Guard:** The session prompt **must conform exactly** to the scope,
constraints, and decisions locked by this pre-flight. No new scope may be
introduced. `buildVillainDeck` must not appear in the session prompt except
as an explicitly excluded item.
