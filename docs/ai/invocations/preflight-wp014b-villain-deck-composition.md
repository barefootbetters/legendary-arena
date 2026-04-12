# Pre-Flight Invocation — WP-014B

---

### Pre-Flight Header

**Target Work Packet:** `WP-014B`
**Title:** Villain Deck Composition Rules & Registry Integration
**Previous WP Status:** WP-014A Complete (2026-04-11)
**Pre-Flight Date:** 2026-04-11
**Invocation Stage:** Pre-Execution (Scope & Readiness)

**Work Packet Class:** Behavior / State Mutation
- Implements `buildVillainDeck` which populates `G.villainDeck` and
  `G.villainDeckCardTypes` with real data from registry resolution
- Replaces empty defaults added by WP-014A
- Wires into `buildInitialGameState` via the existing `_registry` parameter
- No EC — decisions in DECISIONS.md D-1410 through D-1413 are the contract

---

### Pre-Flight Intent

Perform a pre-flight validation for WP-014B.

- Not implementing.
- Not generating code.
- Validating readiness and constraints only.

If a blocking condition is found, pre-flight must return **NOT READY** and stop.

---

### Authority Chain (Must Read)

1. `.claude/CLAUDE.md` — EC-mode rules, bug handling, commit discipline
2. `docs/ai/ARCHITECTURE.md` — Layer boundaries, Villain Deck Authority
   Boundary, Registry Access Rule
3. `docs/ai/work-packets/WP-014B-villain-deck-composition.md` — The
   authoritative WP specification
4. `DECISIONS.md` D-1410 through D-1413 — The adopted conventions (these
   serve as the execution contract in lieu of an EC)
5. Dependencies: WP-014A (reveal pipeline + types)

All read and confirmed. No conflicts found.

---

### Dependency & Sequencing Check

| WP | Status | Notes |
|---|---|---|
| WP-014A | ✅ | Complete (2026-04-11). `RevealedCardType`, `VillainDeckState`, `REVEALED_CARD_TYPES` exported. `revealVillainCard` wired. Empty defaults in `buildInitialGameState`. 142 tests passing. Committed as `a1c4ee2`. |
| WP-005B | ✅ | `shuffleDeck` and `ShuffleProvider` exported. `makeMockCtx` exported. |

All prerequisites complete. No blocking dependencies.

---

### Structural Readiness Check (Types & Contracts)

- [x] All prior WPs compile and tests pass — build exits 0; **142 tests pass, 0 fail**
- [x] No known EC violations remain open
- [x] Required types/contracts from WP-014A exist and are exported:
  - `RevealedCardType`, `REVEALED_CARD_TYPES`, `VillainDeckState`
  - `CardExtId` (zones.types.ts)
  - `shuffleDeck`, `ShuffleProvider` (shuffle.ts)
  - `makeMockCtx` (mockCtx.ts)
  - `MatchSetupConfig` (matchSetup.types.ts)
- [x] `buildInitialGameState` has `_registry` parameter (underscore, currently
      unused) and empty villain deck defaults ready to be replaced
- [x] `CardRegistry` interface in registry package exposes `listSets()`,
      `getSet(abbr)`, `listCards()` — all needed for `VillainDeckRegistryReader`
- [x] `SetDataSchema` has `henchmen: z.array(z.unknown())`, `masterminds:
      z.array(MastermindSchema)`, `villains: z.array(VillainGroupSchema)`,
      `schemes: z.array(SchemeSchema)` — all traversable at setup time
- [x] `MastermindCardSchema` has `tactic: z.boolean().optional()` — the
      strike identification contract (D-1413)
- [x] Henchman data shape confirmed from `data/cards/core.json`:
      `{ id, name, slug, imageUrl, abilities }` — `slug` is present for mapping
- [x] DECISIONS.md D-1410 through D-1413 are all Status: Accepted
- [x] No naming or ownership conflicts anticipated

All YES. No blockers.

---

### Runtime Readiness Check (Mutation & Framework)

- [x] The expected runtime touchpoints are known:
  - `buildInitialGameState.ts` — replace empty defaults with
    `buildVillainDeck` call; rename `_registry` to `registry`
  - `index.ts` — export `buildVillainDeck` and `VillainDeckRegistryReader`
- [x] Framework context requirements are understood:
  - `context.random.Shuffle` via `shuffleDeck` (deck shuffle at end)
  - `context.ctx.numPlayers` for bystander count derivation
- [x] Existing test infrastructure supports required mocks — `makeMockCtx`
      provides deterministic shuffle (reversal); mock registry objects can be
      constructed inline without shared helper modification
- [x] No runtime wiring allowance (01.5) needed — `buildInitialGameState.ts`
      is in the WP-014B allowlist directly
- [x] No architecture boundary violations expected — `buildVillainDeck`
      receives registry as a function argument (setup-time only); no module-
      scope registry imports; `VillainDeckRegistryReader` defined locally

All YES. No blockers.

---

### Established Patterns to Follow (Locked Precedents)

- `buildVillainDeck` receives registry as a function argument (same pattern
  as `buildInitialGameState` receiving `_registry`)
- `VillainDeckRegistryReader` is a locally-defined structural interface (same
  pattern as `CardRegistryReader` in `matchSetup.validate.ts`)
- Prefer `listCards()` for villain card ext_ids (FlatCard.key is the canonical
  format); use `getSet()` only for henchmen, schemes, and masterminds
- Pure setup functions return new values; `buildInitialGameState` assigns
  results into the returned state object
- Pre-shuffle deck must be sorted lexically for deterministic input ordering
- `for...of` loops for iteration — no `.reduce()`
- `shuffleDeck` for all randomness — never `Math.random()`
- `makeMockCtx` reverses arrays (proves shuffle ran) — no modifications
- Test files use `.test.ts`, `node:test`, `node:assert` — no boardgame.io
- Config-to-registry mapping must be 1:1 (config ID -> SetData entity slug)

No deviations anticipated.

---

### Scope Lock (Critical)

#### WP-014B Is Allowed To

- **Create:** `src/villainDeck/villainDeck.setup.ts` — `buildVillainDeck`,
  `VillainDeckRegistryReader` interface, count constants, local structural types
- **Create:** `src/villainDeck/villainDeck.setup.test.ts` — 10+ tests
- **Modify:** `src/setup/buildInitialGameState.ts` — replace empty defaults
  with `buildVillainDeck` call; rename `_registry` to `registry`
- **Modify:** `src/index.ts` — export `buildVillainDeck`,
  `VillainDeckRegistryReader`
- **Update:** governance docs (STATUS.md, ARCHITECTURE.md, WORK_INDEX.md)

#### WP-014B Is Explicitly Not Allowed To

- No reveal pipeline changes (WP-014A is committed and locked)
- No modification of `villainDeck.types.ts` or `villainDeck.reveal.ts`
- No modification of WP-014A test files
- No new moves, triggers, or effects
- No City or HQ placement (WP-015)
- No registry set JSON file modifications (virtual cards, not real entries)
- No `@legendary-arena/registry` module-scope imports
- No `Math.random()`, no `.reduce()`, no `require()`
- No modification of `makeMockCtx` or shared test helpers
- No persistence or database logic

**Rule:** Anything not explicitly allowed is out of scope.

---

### Test Expectations (Locked Before Execution)

- **10+ new tests** in `src/villainDeck/villainDeck.setup.test.ts`:
  1. Non-empty deck for valid config
  2. Every deck card has a cardTypes entry
  3. Deck is shuffled (makeMockCtx reversal)
  4. cardTypes keys subset of unique deck IDs and vice versa
  5. Henchman copies: correct count (10/group), correct ext_id format
  6. Scheme twist copies: correct count (8), correct ext_id format
  7. Bystander copies: count matches numPlayers
  8. Mastermind strikes: only non-tactic cards included
  9. JSON.stringify succeeds (serialization proof)
  10. All cardTypes values are valid REVEALED_CARD_TYPES members
- **Prior test baseline:** All existing tests must continue to pass.
  No pre-existing test failures are permitted.
- **Existing test changes:** `buildInitialGameState` shape tests may need
  assertion updates if they check for empty villain deck fields — these
  are value-only updates driven by the new real data, not new logic
- **Test boundaries:** No boardgame.io imports; no makeMockCtx modifications

---

### Mutation Boundary Confirmation

- [x] `G` mutations occur only inside `buildInitialGameState` (setup context)
- [x] `buildVillainDeck` is a pure function — returns new values, does not
      mutate inputs
- [x] No mutation occurs in the `VillainDeckRegistryReader` interface or
      any structural type helpers
- [x] No mutation occurs outside the setup context

No violations. No blockers.

---

### Risk & Ambiguity Review (Resolve Now, Lock for Execution)

#### Risk 1: Bystander ext_id convention not fully resolved in D-1412

- **Risk:** D-1412 locks the count (1 per player) but does not specify the
  ext_id format. The WP lists two options: indexed `bystander-villain-deck-{index}`
  or reuse `BYSTANDER_EXT_ID` with duplicates.
- **Impact:** Medium — must be decided before implementation.
- **Mitigation:** Phase 1 of the session confirms or resolves this. The WP
  explicitly documents this as a Phase 1 task, not a blocker.
- **Decision:** Resolve in Phase 1. Recommendation: indexed format for
  replay targeting consistency. If chosen, amend D-1412.

#### Risk 2: Config-to-registry slug mapping conventions

- **Risk:** The exact mapping from `config.villainGroupIds` / `henchmanGroupIds` /
  `schemeId` / `mastermindId` to `SetData` entity slugs is not formally documented.
- **Impact:** Medium — wrong mapping silently produces incorrect or empty decks.
- **Mitigation:** Phase 1 requires reading actual card data, verifying each
  mapping is 1:1 (config ID -> `SetData.*.slug`), and writing a mapping
  statement. If any mapping is not 1:1, the session must STOP.
- **Decision:** Resolve in Phase 1 with a required mapping statement before code.

#### Risk 3: Henchman group data is `z.unknown()`

- **Risk:** `SetData.henchmen` is `z.array(z.unknown())`. The adapter must
  cast or structurally validate entries at runtime.
- **Impact:** Low — data shape confirmed (`{ id, name, slug, imageUrl, abilities }`
  from `data/cards/core.json`), but it's untyped in the schema.
- **Mitigation:** Define a minimal structural type locally and validate at
  setup time. Fail with a clear error if the shape doesn't match.
  Setup-time code may throw (per game-engine rules).
- **Decision:** Low risk. Structural validation at setup time.

#### Risk 4: Existing shape tests for buildInitialGameState

- **Risk:** `buildInitialGameState.shape.test.ts` may have assertions that
  check for empty villain deck arrays and would need updating.
- **Impact:** Low — value-only assertion updates.
- **Mitigation:** Check test file during implementation. Changes are structural
  updates driven by new real data, not new logic.
- **Decision:** Permitted as value-only updates. Document in execution summary.

#### Risk 5: Registry load order may affect deck composition

- **Risk:** `listCards()` and `getSet()` return order may vary depending on
  which sets are loaded and in what order.
- **Impact:** Medium — non-deterministic pre-shuffle ordering would break
  replay determinism even with a deterministic shuffle.
- **Mitigation:** WP-014B requires lexical sorting of the combined deck
  before calling `shuffleDeck`. This is documented in the WP implementation
  section (step 6).
- **Decision:** Locked. Pre-shuffle lexical sort is mandatory.

All risks mitigated. One open decision (bystander ext_id format) resolved in
Phase 1 by design.

---

### Pre-Flight Verdict (Binary)

## READY TO EXECUTE

WP-014B is properly sequenced — WP-014A completed and committed (`a1c4ee2`)
with 142 tests passing, all types and reveal pipeline in place, and empty
defaults ready to be replaced. The repo is green. All four unlocking decisions
(D-1410 through D-1413) are accepted in DECISIONS.md. The scope boundary is
clear: 4 files (2 new, 2 modified), no reveal pipeline changes, no new moves.
One open decision (bystander ext_id format) is resolved in Phase 1 by design
— this is documented in the WP, not a blocker. Registry data shapes are
verified and traversable. Pre-shuffle determinism is guaranteed via mandatory
lexical sorting. The `VillainDeckRegistryReader` pattern is consistent with
the established `CardRegistryReader` precedent.

---

### Authorized Next Step

> You are authorized to generate a **session execution prompt** for WP-014B
> to be saved as:
> `docs/ai/invocations/session-wp014b-villain-deck-composition.md`

**Guard:** The session prompt must conform exactly to the scope, constraints,
and decisions locked by this pre-flight and by DECISIONS.md D-1410 through
D-1413. No new scope may be introduced. The reveal pipeline must not be
modified. Config-to-slug mapping must be verified before code is written.
Pre-shuffle lexical sort is mandatory.
