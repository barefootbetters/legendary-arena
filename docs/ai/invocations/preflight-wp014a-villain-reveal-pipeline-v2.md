# Pre-Flight Report — WP-014A (v2, Mode B Invariants Audit)

**Target Work Packet:** `WP-014A`
**Title:** Villain Reveal & Trigger Pipeline (Types + Move + Tests)
**Previous WP Status:** WP-013 Complete (2026-04-11)
**Pre-Flight Date:** 2026-04-11
**Invocation Stage:** Pre-Execution (Scope & Readiness)
**Audit Mode:** **Mode B — Invariants Audit** (validates WP-014A invariants
that must still hold on the current mainline; treats WP-014B/WP-015
supersessions as intentionally replaced)

**Work Packet Class:** Behavior / State Mutation

---

## Pre-Flight Intent

Perform a pre-flight validation for WP-014A.

- Not implementing.
- Not generating code.
- Validating readiness and constraints only.

If a blocking condition is found, pre-flight must return **NOT READY** and stop.

---

## Authority Chain (Read and Followed)

1. `.claude/CLAUDE.md` -- EC-mode rules, bug handling, commit discipline
2. `docs/ai/ARCHITECTURE.md` -- Layer boundaries, engine vs framework rules
3. `docs/ai/execution-checklists/EC-014A-villain-reveal-pipeline.checklist.md`
4. `docs/ai/work-packets/WP-014A-villain-reveal-pipeline.md`
5. Dependencies: WP-013 (complete), WP-009A/B (complete), WP-005B (complete),
   WP-008B (complete)

---

## Dependency & Sequencing Check

| WP | Status | Notes |
|---|---|---|
| WP-013 | Complete (2026-04-11) | Persistence boundaries, ARCHITECTURE.md |
| WP-009A | Complete | `RuleTriggerName`, `RuleEffect`, `HookDefinition` |
| WP-009B | Complete | `executeRuleHooks`, `applyRuleEffects` |
| WP-005B | Complete | `shuffleDeck`, `makeMockCtx` |
| WP-007B / WP-008B | Complete | play phase wired with core moves |

**Verdict:** All prerequisites satisfied.

---

## Structural Readiness Check

- [x] All prior WPs compile and tests pass -- **build exits 0, 170 tests,
      0 failures**
- [x] No known EC violations remain open
- [x] Required types/contracts exist and are exported:
  - `RuleTriggerName`, `RuleEffect`, `HookDefinition` (ruleHooks.types.ts)
  - `executeRuleHooks` (ruleRuntime.execute.ts)
  - `applyRuleEffects` (ruleRuntime.effects.ts)
  - `CardExtId` (zones.types.ts)
  - `shuffleDeck` (shuffle.ts)
  - `makeMockCtx` (mockCtx.ts)
  - `MoveResult`, `MoveError` (coreMoves.types.ts)
- [x] No naming or ownership conflicts
- [x] No architectural boundary conflicts at contract level

---

## Runtime Readiness Check

- [x] Runtime touchpoints known: `game.ts` (moves map),
      `buildInitialGameState.ts` (setup), `villainDeck.reveal.ts` (move)
- [x] Framework context requirements understood: `ctx.random.Shuffle` via
      `shuffleDeck`; `ctx` passed to `executeRuleHooks`
- [x] Test infrastructure supports mocks: `makeMockCtx` reverses arrays
- [x] Runtime wiring allowance (01.5) applicable for `buildInitialGameState`
- [x] No architecture boundary violations expected

---

## Established Patterns to Follow (Locked Precedents)

- Inline mock contexts for tests (do NOT modify shared helpers)
- Passing `ctx` directly where structurally compatible with `ShuffleProvider`
- Pure helpers return new values; moves assign results into `G` under Immer
- Mutating `G` occurs only inside move implementations or framework contexts
- No changes to locked helpers unless WP explicitly authorizes

No deviations from established patterns anticipated.

---

## Supersession Awareness (Mode B)

The following WP-014A behaviors have been intentionally superseded by later
packets. Per WP-014A "Supersession Awareness", these are NOT blockers:

### Superseded by WP-014B

- `buildInitialGameState` empty defaults -- replaced by real
  `buildVillainDeck` call

### Superseded by WP-015

- Villain/henchman discard routing -- replaced by City routing (D-1408)
- Tests referencing `city`/`hq` fields in mock G -- required by current
  `LegendaryGameState` shape

### Superseded by WP-015A

- Stage gating and malformed city card-drop fix now present

---

## Scope Lock (Critical)

### WP-014A Active Invariants (Must Hold)

| # | Invariant | Status | Evidence |
|---|---|---|---|
| 1 | `RevealedCardType` = 5 values, hyphens not underscores | PASS | villainDeck.types.ts:28-33 |
| 2 | `REVEALED_CARD_TYPES` canonical array matches union | PASS | villainDeck.types.ts:41-47 + drift test |
| 3 | `VillainDeckState` = `{ deck: CardExtId[]; discard: CardExtId[] }` | PASS | villainDeck.types.ts:59-64 |
| 4 | `G.villainDeckCardTypes` classification design comment | PASS | villainDeck.types.ts:70-74 |
| 5 | `LegendaryGameState` has `villainDeck` + `villainDeckCardTypes` | PASS | types.ts:223-225 |
| 6 | No `@legendary-arena/registry` import in reveal or types | PASS | grep: 0 matches |
| 7 | Top-of-deck = `deck[0]`; draw from front | PASS | villainDeck.reveal.ts:68 |
| 8 | `onCardRevealed` always with `{ cardId, cardTypeSlug }` | PASS | villainDeck.reveal.ts:128-135 |
| 9 | `onSchemeTwistRevealed` only for `scheme-twist` | PASS | villainDeck.reveal.ts:142-155 |
| 10 | `onMastermindStrikeRevealed` only for `mastermind-strike` | PASS | villainDeck.reveal.ts:157-170 |
| 11 | Trigger emission via `executeRuleHooks` (no inline effects) | PASS | pipeline uses WP-009B |
| 12 | Fail-closed on missing cardType | PASS | villainDeck.reveal.ts:80-85 |
| 13 | Reshuffle: empty deck + non-empty discard | PASS | villainDeck.reveal.ts:58-65 |
| 14 | Empty deck + empty discard: message, no changes | PASS | villainDeck.reveal.ts:51-56 |
| 15 | `JSON.stringify(G)` succeeds after reveal | PASS | test passing |
| 16 | Stage gating: early-return unless `start` | PASS | villainDeck.reveal.ts:43-45 (WP-015A) |
| 17 | No `Math.random()`, `.reduce()`, `require()` | PASS | grep: 0 matches |
| 18 | `revealVillainCard` NOT in `CoreMoveName`/`CORE_MOVE_NAMES`/`MOVE_ALLOWED_STAGES` | PASS | grep: 0 matches in villainDeck/ |
| 19 | All `// why:` comments present | PASS | 6 in reveal.ts, 1 in types.ts |
| 20 | Deck removal deferred until destination confirmed | PASS | WP-015A fix; city path at :104, non-city at :121 |

### WP-014A Is Explicitly Not Allowed To

- No `buildVillainDeck` (WP-014B scope) -- N/A (already exists via 014B)
- No `Math.random()` -- PASS
- No `.reduce()` in logic -- PASS
- No `require()` -- PASS
- No `boardgame.io` imports in test files -- tests use `makeMockCtx`

---

## Test Expectations (Current State)

**Types tests** (`villainDeck.types.test.ts`): 2 tests
1. `REVEALED_CARD_TYPES` drift: 5 locked values -- PASS
2. `JSON.stringify` for `VillainDeckState` -- PASS

**Reveal tests** (`villainDeck.reveal.test.ts`): 11 tests
1. Draw from `deck[0]` -- PASS
2. Revealed villain card goes to City (supersedes original discard) -- PASS
3. `onCardRevealed` fires with correct payload -- PASS
4. `onSchemeTwistRevealed` fires for scheme-twist -- PASS
5. `onSchemeTwistRevealed` does NOT fire for villain -- PASS
6. `onMastermindStrikeRevealed` fires for mastermind-strike -- PASS
7. Empty deck + non-empty discard: reshuffles -- PASS
8. Empty deck + empty discard: message, no changes -- PASS
9. `JSON.stringify(G)` after reveal -- PASS
10. Missing cardType: fail-closed -- PASS
11. Stage gating: no-op when not `start` -- PASS (WP-015A)

**City integration tests** (`villainDeck.city.integration.test.ts`): 8 tests
All passing, including malformed city deck-preservation test (WP-015A).

**Baseline:** 170 tests, 0 failures.

---

## Mutation Boundary Confirmation

- [x] `G` mutations occur only inside `revealVillainCard` (framework-authorized)
- [x] No mutation in helpers or validators
- [x] Helpers return new values; move assigns results into `G`
- [x] No mutation outside boardgame.io move context

---

## Risk & Ambiguity Review

| # | Risk | Impact | Mitigation | Status |
|---|---|---|---|---|
| 1 | Stage gating was missing | Move could fire in wrong stage | WP-015A added gate | Resolved |
| 2 | Malformed city dropped card | Card silently lost | WP-015A deferred deck removal | Resolved |
| 3 | ImplementationMap mutation in tests | Test fragility | Contained in try/finally; acceptable for MVP | Accepted |
| 4 | WP-014B/015 supersession confusion | False pre-flight blockers | Supersession Awareness section added to WP/EC | Resolved |

No unresolved risks.

---

## Pre-Flight Verdict

## READY TO EXECUTE

**Justification:**

All 20 WP-014A active invariants pass on the current mainline. Dependencies
are complete (WP-013, WP-009A/B, WP-005B, WP-008B). The scope lock is clear
with superseded behaviors explicitly documented. The two correctness bugs
identified in the previous pre-flight (stage gating, malformed city card-drop)
have been resolved by WP-015A. All 170 tests pass. No architectural boundary
violations. No registry imports in engine move/type files. All required
`// why:` comments present.

---

## Authorized Next Step

You are authorized to generate a **session execution prompt** for WP-014A
to be saved as:
`docs/ai/invocations/session-wp014a-villain-reveal-pipeline-v2.md`

**Guard:** The session prompt must conform exactly to the scope, constraints,
and decisions locked by this pre-flight. No new scope may be introduced.
