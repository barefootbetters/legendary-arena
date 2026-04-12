# Pre-Flight Report — WP-015 + WP-015A (Mode B Invariants Audit)

**Target Work Packets:** `WP-015` + `WP-015A`
**Title:** City & HQ Zones (Villain Movement + Escapes) + Reveal Safety Fixes
**Previous WP Status:** WP-014A Complete, WP-014B Complete
**Pre-Flight Date:** 2026-04-11
**Invocation Stage:** Pre-Execution (Scope & Readiness)
**Audit Mode:** **Mode B — Invariants Audit** (current mainline)

**Work Packet Class:** Behavior / State Mutation (both packets)

---

## Pre-Flight Intent

Perform a combined pre-flight validation for WP-015 and WP-015A.
Not implementing. Validating readiness and constraints only.

---

## Authority Chain (Read and Followed)

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md`
3. `docs/ai/execution-checklists/EC-015-city-zones.checklist.md`
4. `docs/ai/work-packets/WP-015-city-hq-zones-villain-movement.md`
5. `docs/ai/work-packets/WP-015A-reveal-safety-fixes.md`

---

## Dependency & Sequencing Check

| WP | Status | Notes |
|---|---|---|
| WP-014A | Complete (2026-04-11) | Reveal pipeline, types, `VillainDeckState` |
| WP-014B | Complete (2026-04-11) | `buildVillainDeck`, real deck composition |
| WP-015 (for 015A) | Complete (2026-04-11) | City routing present |

**Verdict:** All prerequisites satisfied.

---

## Structural Readiness Check

- [x] Build exits 0, **170 tests, 0 failures**
- [x] No known EC violations
- [x] Required contracts exist: `revealVillainCard`, `RevealedCardType`,
      `G.villainDeckCardTypes`, `ENDGAME_CONDITIONS.ESCAPED_VILLAINS`,
      `executeRuleHooks`, `applyRuleEffects`, `CardExtId`, `MoveError`
- [x] No naming or ownership conflicts
- [x] No architectural boundary conflicts

---

## Runtime Readiness Check

- [x] Runtime touchpoints known: `city.types.ts`, `city.logic.ts`,
      `city.validate.ts` (new), `villainDeck.reveal.ts` (modified),
      `buildInitialGameState.ts` (modified), `types.ts` (modified)
- [x] No framework access needed in city helpers (pure functions)
- [x] Test infrastructure: `makeMockCtx` + `initializeCity`/`initializeHq`
- [x] No architecture boundary violations

---

## WP-015 Active Invariants

| # | Invariant | Status | Evidence |
|---|---|---|---|
| 1 | `CityZone` = fixed 5-tuple of `CitySpace` | **PASS** | `city.types.ts:29` |
| 2 | `CitySpace = CardExtId \| null` | **PASS** | `city.types.ts:21` |
| 3 | `HqZone` = fixed 5-tuple of `HqSlot` | **PASS** | `city.types.ts:47` |
| 4 | `HqSlot = CardExtId \| null` | **PASS** | `city.types.ts:39` |
| 5 | `// why:` on 5-tuple design | **PASS** | `city.types.ts:17-18` and `:35-36` |
| 6 | `pushVillainIntoCity` is pure (no boardgame.io) | **PASS** | grep: 0 boardgame.io imports in `src/board/` |
| 7 | Push inserts at space 0, shifts toward space 4 | **PASS** | `city.logic.ts:52-58` |
| 8 | Space 4 card escapes | **PASS** | `city.logic.ts:48` |
| 9 | Escaped card = `oldCity[4]`, never new card | **PASS** | test at `city.logic.test.ts:70-87` |
| 10 | City remains length 5 after push | **PASS** | test at `city.logic.test.ts:89-101` |
| 11 | No `.reduce()` in city logic | **PASS** | grep: comments only |
| 12 | `// why:` on shift direction | **PASS** | `city.logic.ts:50` |
| 13 | Escape uses `ENDGAME_CONDITIONS.ESCAPED_VILLAINS` constant | **PASS** | `reveal.ts:113-114` — no string literal |
| 14 | Escape message appended to `G.messages` | **PASS** | `reveal.ts:115-117` |
| 15 | Villain/henchman -> City (not discard) | **PASS** | `reveal.ts:94-118`, test at `city.integration.test.ts:119-161` |
| 16 | Scheme-twist/mastermind-strike -> trigger only (no City) | **PASS** | tests at `city.integration.test.ts:164-206` |
| 17 | Bystander -> discard + message (MVP) | **PASS** | `reveal.ts:180-185` with `// why:` |
| 18 | City placement before trigger emission | **PASS** | `reveal.ts:87-122` (step 4) before step 5 (`:124`) |
| 19 | `validateCityShape` validates 5-element array of string\|null | **PASS** | `city.validate.ts:35-73` |
| 20 | No `@legendary-arena/registry` in board files | **PASS** | grep: 0 matches |
| 21 | No `Math.random()` in board files | **PASS** | grep: 0 matches |
| 22 | No `require()` in board files | **PASS** | grep: 0 matches |
| 23 | `G.city` and `G.hq` on `LegendaryGameState` | **PASS** | `types.ts:231,236` |
| 24 | `initializeCity()` and `initializeHq()` in setup | **PASS** | `buildInitialGameState.ts:171-174` |
| 25 | `// why:` on HQ empty at init | **PASS** | `city.logic.ts:85` |
| 26 | HQ not mutated after init in WP-015 | **PASS** | test `city.integration.test.ts:248-272` |
| 27 | `villainDeck.types.ts` not modified by WP-015 | **PASS** | no diff |
| 28 | All types/functions exported from `index.ts` | **PASS** | `index.ts:109-113` |

### WP-015 Tests

| # | Test File | Count | Status |
|---|---|---|---|
| 29 | `city.logic.test.ts` — push unit tests | 9 (7 push + init city + init hq) | **PASS** |
| 30 | `city.integration.test.ts` — reveal routing | 8 | **PASS** |
| 31 | All use `node:test`/`node:assert`, no boardgame.io | **PASS** | grep: 0 import matches |

---

## WP-015A Active Invariants

| # | Invariant | Status | Evidence |
|---|---|---|---|
| 32 | Stage gate: early-return unless `G.currentStage === 'start'` | **PASS** | `reveal.ts:43-45` |
| 33 | Stage gate is first line, no side effects on mismatch | **PASS** | silent return, no messages |
| 34 | `// why:` on stage gate | **PASS** | `reveal.ts:44` |
| 35 | Deck removal deferred until destination confirmed | **PASS** | city path `:104`, non-city `:121` |
| 36 | Malformed city: card stays in deck, no counter, message | **PASS** | `reveal.ts:96-101`, test `:274-310` |
| 37 | `// why:` on deferred deck removal | **PASS** | `reveal.ts:91-93` |

### WP-015A Tests

| # | Test | Status |
|---|---|---|
| 38 | Stage gating no-op (`reveal.test.ts:453-484`) | **PASS** |
| 39 | Malformed city deck preservation (`city.integration.test.ts:274-310`) | **PASS** |

---

## Risk & Ambiguity Review

No unresolved risks. All city routing, escape counting, and safety fixes
validated.

---

## Pre-Flight Verdict

## READY TO EXECUTE

All 39 invariants pass (28 WP-015 + 8 WP-015A + 3 test meta). Build clean,
170 tests, 0 failures. City and HQ types are correct 5-tuples. Push logic
is pure with correct shift semantics. Escape counter uses the constant.
Routing rules match the locked values. Stage gating and deferred deck
removal are in place. No architectural boundary violations.

---

## Authorized Next Step

You are authorized to generate a **session execution prompt** for WP-015
+ WP-015A to be saved as:
`docs/ai/invocations/session-wp015-city-hq-zones-v2.md`
