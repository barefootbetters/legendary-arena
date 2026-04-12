# Pre-Flight Report — WP-014B (v2, Mode B Invariants Audit)

**Target Work Packet:** `WP-014B`
**Title:** Villain Deck Composition Rules & Registry Integration
**Previous WP Status:** WP-014A Complete (2026-04-11)
**Pre-Flight Date:** 2026-04-11
**Invocation Stage:** Pre-Execution (Scope & Readiness)
**Audit Mode:** **Mode B — Invariants Audit** (current mainline)

**Work Packet Class:** Behavior / State Mutation

---

## Pre-Flight Intent

Perform a pre-flight validation for WP-014B.
Not implementing. Validating readiness and constraints only.

---

## Authority Chain (Read and Followed)

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md`
3. `docs/ai/work-packets/WP-014B-villain-deck-composition.md`
4. DECISIONS.md entries D-1410 through D-1413

WP-014B intentionally has no execution checklist (see WP-014B rationale).

---

## Dependency & Sequencing Check

| WP | Status | Notes |
|---|---|---|
| WP-014A | Complete (2026-04-11) | Reveal pipeline, types, `VillainDeckState`, `RevealedCardType` |

**Verdict:** All prerequisites satisfied.

---

## Structural Readiness Check

- [x] All prior WPs compile and tests pass -- **build exits 0, 170 tests,
      0 failures**
- [x] No known EC violations remain open
- [x] Required types/contracts exist:
  - `RevealedCardType`, `VillainDeckState`, `REVEALED_CARD_TYPES` (WP-014A)
  - `CardExtId` (WP-006A)
  - `MatchSetupConfig` (WP-005A)
  - `SetupContext` (WP-005B)
  - `shuffleDeck` (WP-005B)
  - `makeMockCtx` (WP-005B)
- [x] No naming or ownership conflicts
- [x] No architectural boundary conflicts

---

## Runtime Readiness Check

- [x] Runtime touchpoints known: `buildInitialGameState.ts` (calls
      `buildVillainDeck`), `villainDeck.setup.ts` (pure function)
- [x] Setup context provides `ctx.numPlayers` and `random.Shuffle`
- [x] Test infrastructure supports mocks: `makeMockCtx` + mock registry
- [x] No architecture boundary violations: `buildVillainDeck` uses
      `VillainDeckRegistryReader` (local structural interface), not registry
      package imports

---

## Scope Lock (Critical)

### WP-014B Active Invariants (Must Hold)

| # | Invariant | Status | Evidence |
|---|---|---|---|
| 1 | `buildVillainDeck` is pure (no I/O, no `Math.random()`) | PASS | Only uses `shuffleDeck` for randomness |
| 2 | No `@legendary-arena/registry` import | PASS | grep: only in JSDoc comments |
| 3 | `VillainDeckRegistryReader` defined locally in game-engine | PASS | villainDeck.setup.ts:89-96 |
| 4 | `VillainDeckRegistryReader` structurally satisfied by real `CardRegistry` | PASS | listCards, listSets, getSet methods |
| 5 | `buildInitialGameState` calls `buildVillainDeck` | PASS | buildInitialGameState.ts:149 |
| 6 | `G.villainDeck` + `G.villainDeckCardTypes` populated with real data | PASS | buildInitialGameState.ts:169-170 |
| 7 | Henchman: 10 copies per group, ext_id `henchman-{slug}-{00-09}` | PASS | setup.ts:191-196 + test |
| 8 | Scheme twists: 8 copies, ext_id `scheme-twist-{slug}-{00-07}` | PASS | setup.ts:204-209 + test |
| 9 | Bystanders: count = `numPlayers`, ext_id `bystander-villain-deck-{NN}` | PASS | setup.ts:216-223 + test |
| 10 | Mastermind strikes: `tactic !== true` filter | PASS | setup.ts:423 with `// why:` |
| 11 | Mastermind ext_id: `{setAbbr}-mastermind-{slug}-{cardSlug}` | PASS | setup.ts:234 |
| 12 | Lexical sort before shuffle for determinism | PASS | setup.ts:243 |
| 13 | `shuffleDeck` used for shuffle (not `Math.random()`) | PASS | setup.ts:248 |
| 14 | No `.reduce()` in logic | PASS | grep: only in JSDoc |
| 15 | All cardTypes values are valid `REVEALED_CARD_TYPES` members | PASS | test passing |
| 16 | `JSON.stringify` succeeds for result | PASS | test passing |
| 17 | `buildVillainDeck` exported from `index.ts` | PASS | index.ts:107 |
| 18 | `VillainDeckRegistryReader` exported from `index.ts` | PASS | index.ts:108 |
| 19 | Config-to-registry mapping documented in `// why:` comments | PASS | setup.ts:162, 188, 201, 228 |
| 20 | Narrow registry mock returns empty deck gracefully | PASS | setup.ts:153-154 |

### Prohibitions

- No `Math.random()` -- PASS
- No `.reduce()` in logic -- PASS
- No `require()` -- PASS
- No `@legendary-arena/registry` import -- PASS

---

## Test Expectations (Current State)

**Setup tests** (`villainDeck.setup.test.ts`): 10 tests
1. Non-empty deck for valid config -- PASS
2. Every card has cardTypes entry -- PASS
3. Deck is shuffled (order differs from sorted) -- PASS
4. cardTypes keys = unique deck IDs -- PASS
5. Henchman: 10 copies, correct ext_id format -- PASS
6. Scheme twists: 8 copies, correct ext_id format -- PASS
7. Bystanders: count = numPlayers -- PASS
8. Mastermind strikes: non-tactic only -- PASS
9. JSON.stringify succeeds -- PASS
10. All cardTypes values valid -- PASS

**Baseline:** 170 tests, 0 failures.

---

## Risk & Ambiguity Review

No unresolved risks. All four registry data gaps (D-1410 through D-1413)
are resolved and implemented.

---

## Pre-Flight Verdict

## READY TO EXECUTE

**Justification:**

All 20 WP-014B invariants pass on the current mainline. The single
dependency (WP-014A) is complete. `buildVillainDeck` is a pure function
that correctly resolves all 5 card types from registry data using the
conventions locked in D-1410 through D-1413. The `VillainDeckRegistryReader`
interface is defined locally in game-engine with no registry package imports.
All 10 setup tests pass. Build clean. No architectural boundary violations.

---

## Authorized Next Step

You are authorized to generate a **session execution prompt** for WP-014B
to be saved as:
`docs/ai/invocations/session-wp014b-villain-deck-composition-v2.md`
