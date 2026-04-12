# Pre-Flight Report — WP-014B (v3, Mode B Invariants Audit)

**Target Work Packet:** `WP-014B`
**Title:** Villain Deck Composition Rules & Registry Integration
**Previous WP Status:** WP-014A Complete (2026-04-11), WP-015A Complete (2026-04-11)
**Pre-Flight Date:** 2026-04-11
**Invocation Stage:** Pre-Execution (Scope & Readiness)
**Audit Mode:** **Mode B — Invariants Audit** (current mainline)

**Work Packet Class:** Behavior / State Mutation

---

## Pre-Flight Intent

Perform a pre-flight validation for WP-014B.
Not implementing. Not generating code. Validating readiness and constraints only.

If a blocking condition is found, pre-flight must return **NOT READY** and stop.

---

## Authority Chain (Read and Followed)

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md`
3. `docs/ai/work-packets/WP-014B-villain-deck-composition.md`
4. `docs/ai/DECISIONS.md` — entries D-1410 through D-1413

WP-014B intentionally has no execution checklist. The decisions are the
executable contract.

---

## Dependency & Sequencing Check

| WP | Status | Notes |
|---|---|---|
| WP-014A | Complete (2026-04-11) | Reveal pipeline, types, `VillainDeckState`, `RevealedCardType` |
| WP-015A | Complete (2026-04-11) | Stage gate + card-drop fix (patch on reveal pipeline) |

**Verdict:** All prerequisites satisfied.

---

## Structural Readiness Check

- [x] All prior WPs compile and tests pass — **build exits 0, 170 tests,
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
      satisfying `VillainDeckRegistryReader`
- [x] No architecture boundary violations: local structural interface,
      no `@legendary-arena/registry` import

---

## Established Patterns to Follow (Locked Precedents)

- Virtual card instancing pattern (henchmen, scheme twists, bystanders)
  with deterministic indexed ext_ids
- Lexical sort before shuffle for deterministic pre-shuffle ordering
- Registry data consumed via function parameter, never via module import
- `for...of` loops, not `.reduce()`
- Narrow test mocks that lack `listSets`/`getSet` produce empty deck
  gracefully

---

## Scope Lock (Critical)

### WP-014B Active Invariants

| # | Invariant | Status | Evidence |
|---|---|---|---|
| 1 | `buildVillainDeck` is pure (no I/O, no `Math.random()`) | PASS | Only uses `shuffleDeck`; grep: 0 `Math.random` matches |
| 2 | No `from '@legendary-arena/registry'` import | PASS | grep: 0 import matches |
| 3 | `VillainDeckRegistryReader` defined locally in game-engine | PASS | `setup.ts:89-96` — `listCards`, `listSets`, `getSet` |
| 4 | Structurally satisfied by real `CardRegistry` | PASS | Method signatures match |
| 5 | Narrow mocks return empty deck gracefully | PASS | `setup.ts:153-154` — `isVillainDeckRegistryReader` guard |
| 6 | `buildInitialGameState` calls `buildVillainDeck` | PASS | `buildInitialGameState.ts:149` |
| 7 | `G.villainDeck` + `G.villainDeckCardTypes` populated | PASS | `buildInitialGameState.ts:169-170` |
| 8 | Villain cards: `FlatCard.key` as ext_id, `'villain'` | PASS | `setup.ts:178-181` |
| 9 | Henchman: `henchman-{slug}-{NN}`, 10/group, `'henchman'` | PASS | `setup.ts:191-196`, `HENCHMAN_COPIES_PER_GROUP=10` |
| 10 | Scheme twists: `scheme-twist-{slug}-{NN}`, 8, `'scheme-twist'` | PASS | `setup.ts:204-209`, `SCHEME_TWIST_COUNT=8` |
| 11 | Bystanders: `bystander-villain-deck-{NN}`, `numPlayers`, `'bystander'` | PASS | `setup.ts:216-223` |
| 12 | Mastermind strikes: `tactic !== true`, `'mastermind-strike'` | PASS | `setup.ts:423` with `// why:` |
| 13 | Mastermind ext_id: `{setAbbr}-mastermind-{mmSlug}-{cardSlug}` | PASS | `setup.ts:234` |
| 14 | Lexical sort before shuffle | PASS | `setup.ts:243` |
| 15 | `shuffleDeck` for shuffle (deterministic) | PASS | `setup.ts:248` |
| 16 | No `.reduce()` in logic | PASS | grep: JSDoc only |
| 17 | No `require()` | PASS | grep: 0 matches |
| 18 | `buildVillainDeck` exported from `index.ts` | PASS | `index.ts:107` |
| 19 | `VillainDeckRegistryReader` exported from `index.ts` | PASS | `index.ts:108` |
| 20 | Config-to-registry mapping in `// why:` comments | PASS | 12 `// why:` comments in `setup.ts` covering all mappings |
| 21 | `_registry` renamed to `registry` in `buildInitialGameState` | PASS | `buildInitialGameState.ts:117` — `registry: CardRegistryReader` |
| 22 | D-1410 henchman convention implemented exactly | PASS | Zero-padded 2-digit index, hyphen-separated |
| 23 | D-1411 scheme twist convention implemented exactly | PASS | Scheme-scoped, zero-padded, 8 count |
| 24 | D-1412 count derivation: rules, not config | PASS | Constants + `numPlayers`, not `MatchSetupConfig` fields |
| 25 | D-1413 tactic field contract respected | PASS | `card.tactic !== true` with `// why:` |

### Tests (villainDeck.setup.test.ts): 10 tests

| # | Test | Status |
|---|---|---|
| 1 | Non-empty deck for valid config | PASS |
| 2 | Every card has cardTypes entry | PASS |
| 3 | Deck shuffled (order differs from sorted) | PASS |
| 4 | cardTypes keys = unique deck IDs (bijection) | PASS |
| 5 | Henchman: 10 copies, correct ext_id format | PASS |
| 6 | Scheme twists: 8 copies, correct ext_id format | PASS |
| 7 | Bystanders: count = numPlayers | PASS |
| 8 | Mastermind strikes: non-tactic only | PASS |
| 9 | JSON.stringify succeeds | PASS |
| 10 | All cardTypes values valid REVEALED_CARD_TYPES | PASS |

---

## Mutation Boundary Confirmation

- [x] `buildVillainDeck` is a pure function — returns new values, no G mutation
- [x] `buildInitialGameState` assigns result into G (framework-authorized setup)
- [x] No mutation outside setup context

---

## Risk & Ambiguity Review

| # | Risk | Impact | Mitigation | Status |
|---|---|---|---|---|
| 1 | D-1410-D-1413 not implemented correctly | Wrong deck composition | All 4 conventions verified against DECISIONS.md | Resolved |
| 2 | Registry import in game-engine | Architecture violation | Local `VillainDeckRegistryReader` interface | Resolved |
| 3 | Non-deterministic deck | Replay failure | Lexical sort + `shuffleDeck` | Resolved |
| 4 | Narrow mock crash | Test fragility | `isVillainDeckRegistryReader` guard returns empty deck | Resolved |

No unresolved risks.

---

## Pre-Flight Verdict

## READY TO EXECUTE

All 25 WP-014B invariants pass on the current mainline. The single dependency
(WP-014A) is complete. `buildVillainDeck` is a pure function correctly
implementing all 5 card type resolutions per D-1410 through D-1413. The
`VillainDeckRegistryReader` interface is defined locally with no registry
package imports. All 10 setup tests pass. Build clean. 170 total tests,
0 failures. No architectural boundary violations.

---

## Authorized Next Step

You are authorized to generate a **session execution prompt** for WP-014B
to be saved as:
`docs/ai/invocations/session-wp014b-villain-deck-composition-v3.md`
