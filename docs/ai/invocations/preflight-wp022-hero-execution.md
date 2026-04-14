# Pre-Flight Invocation — WP-022

---

### Pre-Flight Header

**Target Work Packet:** `WP-022`
**Title:** Execute Hero Keywords (Minimal MVP)
**Previous WP Status:** WP-021 Complete (2026-04-13)
**Pre-Flight Date:** 2026-04-13
**Invocation Stage:** Pre-Execution (Scope & Readiness)

**Work Packet Class:** Behavior / State Mutation
(implements behavior; mutates `G`; uses framework ctx indirectly)

All sections are mandatory for this class.

---

### Pre-Flight Intent

Perform a pre-flight validation for WP-022.

- Not implementing.
- Not generating code.
- Validating readiness and constraints only.

If a blocking condition is found, pre-flight must return **NOT READY** and stop.

---

### Authority Chain (Must Read)

Before making a verdict, these documents were read **in order**:

1. `.claude/CLAUDE.md` — EC-mode rules, commit discipline
2. `docs/ai/ARCHITECTURE.md` — layer boundaries, rule execution pipeline,
   move validation contract, zone mutation rules, determinism invariant
3. `docs/ai/execution-checklists/EC-022-hero-execution.checklist.md` —
   governing execution checklist
4. `docs/ai/work-packets/WP-022-execute-hero-keywords-minimal-mvp.md` —
   authoritative WP specification
5. Dependencies:
   - WP-021 contracts: `heroAbility.types.ts`, `heroKeywords.ts`
   - WP-018 economy: `economy.logic.ts` (`addResources`)
   - WP-017 KO: `ko.logic.ts` (`koCard`)
   - WP-008B moves: `coreMoves.impl.ts` (`drawCards`, `playCard`)
   - `docs/ai/REFERENCE/00.6-code-style.md`
   - `.claude/rules/game-engine.md`

No conflicts found between authority levels.

---

### Dependency & Sequencing Check

| WP | Status | Notes |
|---|---|---|
| WP-021 | ✅ Complete (2026-04-13) | `HeroAbilityHook`, `HeroKeyword`, `G.heroAbilityHooks` all exist and are tested |
| WP-018 | ✅ Complete | `addResources` exported from `economy.logic.ts` |
| WP-017 | ✅ Complete | `koCard` exported from `ko.logic.ts` |
| WP-008B | ✅ Complete | `drawCards` and `playCard` exported from `coreMoves.impl.ts` |
| WP-006A | ✅ Complete | `CardExtId` exported from `zones.types.ts` |
| WP-005B | ✅ Complete | `makeMockCtx` exported from `test/mockCtx.ts` |

All prerequisites are complete.

---

### Structural Readiness Check (Types & Contracts)

- [x] All prior WPs compile and tests pass: **build exits 0, 255 tests passing, 0 failures, 0 skipped**
- [x] No known EC violations remain open
- [x] Required types/contracts exist and are exported:
  - `HeroAbilityHook` — `rules/heroAbility.types.ts:31-49`
  - `HeroEffectDescriptor` — `rules/heroAbility.types.ts:75-78` (fields: `type: HeroKeyword`, `magnitude?: number`)
  - `HeroCondition` — `rules/heroAbility.types.ts:61-64`
  - `HeroKeyword` — `rules/heroKeywords.ts:26-34` (8 literals: `draw`, `attack`, `recruit`, `ko`, `rescue`, `wound`, `reveal`, `conditional`)
  - `HERO_KEYWORDS` — `rules/heroKeywords.ts:43-52` (canonical readonly array)
  - `getHooksForCard` — `rules/heroAbility.types.ts:134` (filter utility)
  - `addResources` — `economy/economy.logic.ts:281`
  - `koCard` — `board/ko.logic.ts:24`
  - `CardExtId` — `state/zones.types.ts`
  - `ShuffleProvider` — `setup/shuffle.ts:16-18`
- [x] No naming or ownership conflicts
- [x] No architectural boundary conflicts at the contract level

All YES. Structural readiness confirmed.

---

### Runtime Readiness Check (Mutation & Framework)

- [x] The expected runtime touchpoints are known:
  - `coreMoves.impl.ts` (`playCard` function) — sole integration point
  - New file `hero/heroEffects.execute.ts` — execution logic
- [x] Framework context requirements are understood:
  - `executeHeroEffects` uses `ctx: unknown` — no direct framework dependency
  - **RISK IDENTIFIED:** The `draw` keyword requires deck reshuffle, which
    needs `ctx.random.Shuffle` via `ShuffleProvider`. See Risk Review below.
- [x] Existing test infrastructure can support required mocks:
  - `makeMockCtx` provides `ShuffleProvider`-compatible context
  - No modification to shared helpers needed
- [x] Runtime wiring allowance needs: none anticipated (no changes to `game.ts`,
  no new moves, no phase hooks)
- [x] No architecture boundary violations expected:
  - `heroEffects.execute.ts` imports only engine-internal types and helpers
  - No `boardgame.io` import
  - No registry import

All YES. Runtime readiness confirmed (with risk mitigations below).

---

### Established Patterns to Follow (Locked Precedents)

The following patterns from prior WPs apply to WP-022:

1. **Pure helpers return new values; moves assign results into G under Immer.**
   - `addResources(economy, attack, recruit)` returns a new `TurnEconomy` — caller
     must assign `G.turnEconomy = addResources(...)`.
   - `koCard(koPile, cardId)` returns a new `CardExtId[]` — caller must assign
     the result to the appropriate KO pile field.
   - `moveCardFromZone(from, to, cardId)` returns `{ from, to }` — caller
     assigns both.
   - These are NOT void functions. WP-022 must not treat them as mutators.

2. **`ctx` passed directly where structurally compatible with narrower interfaces.**
   - `shuffleDeck(cards, context)` accepts `ShuffleProvider` — boardgame.io ctx
     is structurally compatible. WP-022 may narrow `ctx: unknown` to
     `ShuffleProvider` at the draw call site.

3. **Inline mock contexts for tests requiring framework features.**
   - `makeMockCtx` provides `random.Shuffle` (reverses arrays for determinism).
   - Do NOT modify `makeMockCtx`.

4. **No changes to locked helpers.**
   - `zoneOps.ts`, `shuffle.ts`, `economy.logic.ts`, `ko.logic.ts` are stable.

**No deviations from established patterns are anticipated.**

---

### Scope Lock (Critical)

#### WP-022 Is Allowed To

- **Create:** `packages/game-engine/src/hero/heroEffects.types.ts` — `HeroEffectResult` internal type (not stored in G)
- **Create:** `packages/game-engine/src/hero/heroEffects.execute.ts` — `executeHeroEffects` function
- **Create:** `packages/game-engine/src/hero/heroEffects.execute.test.ts` — 11 unit tests
- **Modify:** `packages/game-engine/src/moves/coreMoves.impl.ts` — add `executeHeroEffects` call inside `playCard`
- **Modify:** `packages/game-engine/src/types.ts` — re-export `HeroEffectResult` if needed for test access
- **Modify:** `packages/game-engine/src/index.ts` — export `executeHeroEffects`
- **Update:** `docs/ai/STATUS.md` — hero abilities now execute for 4 keywords
- **Update:** `docs/ai/DECISIONS.md` — decisions on MVP keyword subset, KO targeting, economy interaction
- **Update:** `docs/ai/work-packets/WORK_INDEX.md` — check off WP-022

#### WP-022 Is Explicitly Not Allowed To

- No modification of WP-021 contract files (`heroAbility.types.ts`, `heroKeywords.ts`)
- No modification of `game.ts` (no new moves, no phase hooks, no new wiring)
- No modification of shared test helpers (`makeMockCtx`, etc.)
- No modification of existing helpers (`zoneOps.ts`, `shuffle.ts`, `economy.logic.ts`, `ko.logic.ts`)
- No `boardgame.io` import in any new file
- No registry import in any new file
- No `.reduce()` in execution logic
- No `Math.random()`
- No conditional effect execution (deferred to WP-023)
- No new keywords beyond the 8 already in `HeroKeyword` union
- No target selection for KO (MVP: targets played card only)
- No persistence, database, server, or UI changes
- No touching files outside the allowlist above

**Rule:** Anything not explicitly allowed is out of scope.

---

### Test Expectations (Locked Before Execution)

- **New tests:** 11 tests in `packages/game-engine/src/hero/heroEffects.execute.test.ts`
  1. `'draw'` effect: player draws N cards
  2. `'attack'` effect: `turnEconomy.attack` increases by N
  3. `'recruit'` effect: `turnEconomy.recruit` increases by N
  4. `'ko'` effect: played card moves to KO pile
  5. Conditional hook: skipped, no G mutation (deep-equal snapshot)
  6. Unsupported keyword: skipped, no G mutation (deep-equal snapshot)
  7. Hook with undefined/empty `effects`: no mutation
  8. Invalid magnitude (undefined, NaN, negative, float): skipped, no mutation
  9. Multiple effects on one card: execute in descriptor array order
  10. Determinism: identical deep-cloned inputs produce identical G
  11. `JSON.stringify(G)` succeeds after execution
- **Existing test changes:** None expected. No existing test files should require
  modification. The `playCard` integration tests may already pass because
  `executeHeroEffects` is additive — if any existing test needs a value update,
  it must be documented and justified.
- **Prior test baseline:** 255 tests passing, 0 failures — all must continue to pass
- **Test boundaries:**
  - No `boardgame.io` imports in test files
  - No modifications to `makeMockCtx` or shared test helpers
  - Test files use `.test.ts` extension and `node:test` runner

---

### Mutation Boundary Confirmation

- [x] `G` mutations occur only inside the `playCard` move implementation
  (framework-authorized Immer context). `executeHeroEffects` is called from
  within `playCard`, so it operates under Immer's draft proxy.
- [x] No mutation occurs in standalone helpers or validators.
- [x] Helpers return new values; the execution function assigns results into `G`:
  - `G.turnEconomy = addResources(G.turnEconomy, N, 0)`
  - KO pile reassigned from `koCard()` return value
  - Player zone arrays reassigned from `moveCardFromZone()` return value
- [x] No mutation occurs outside the boardgame.io move context.

All confirmed. No violations.

---

### Risk & Ambiguity Review (Resolve Now, Lock for Execution)

#### Risk 1: `drawCards` is a move function, not a pure helper

**Risk:** WP-022 says "use existing helpers only" and lists `drawCards` as the
helper for the `'draw'` keyword. But `drawCards` is a full move function
(`coreMoves.impl.ts:33`) that takes `MoveContext`, performs args validation,
checks stage gating, and handles deck reshuffle via `ctx.random.Shuffle`.
It cannot be called from `executeHeroEffects(G, ctx: unknown, cardId)`.

**Impact:** HIGH. If the implementer tries to call `drawCards()` directly, it
will fail to compile (wrong parameter types) or require importing `MoveContext`
from boardgame.io.

**Mitigation:** The draw logic must be **extracted or inlined** within
`executeHeroEffects`. The core draw algorithm from `coreMoves.impl.ts:52-76`
is:
1. For each card to draw:
   - If deck empty and discard has cards: reshuffle discard into deck via
     `shuffleDeck(cards, context)` where `context` satisfies `ShuffleProvider`
   - If both empty: stop
   - Move top card from deck to hand via `moveCardFromZone`
2. Requires `ShuffleProvider` for reshuffle

**Decision (locked for execution):**
- `executeHeroEffects` must accept `ctx: unknown` but narrow it to
  `ShuffleProvider` at the draw call site (structurally compatible with
  boardgame.io ctx — established pattern from WP-005B/008B).
- The draw logic must be implemented inline within `executeHeroEffects` or
  extracted as a **new pure helper** (e.g., `drawCardsFromDeck` in
  `heroEffects.execute.ts` or `zoneOps.ts`). This helper:
  - Takes `(playerZones, count, shuffleContext: ShuffleProvider)`
  - Returns mutated zone state (or mutates under Immer draft)
  - Has no boardgame.io import
  - Has no stage gating (gating is the move's job, already done by `playCard`)
  - Uses existing `moveCardFromZone`, `moveAllCards`, `shuffleDeck`
- **Preferred approach:** Extract a `drawFromPlayerDeck` helper within
  `heroEffects.execute.ts` that reuses the same zone-ops primitives. This
  avoids modifying `zoneOps.ts` (out of scope) while keeping the draw logic
  testable.
- **Alternative:** If the implementer determines the draw logic is simple
  enough, inlining within the main execution function is acceptable provided
  it stays under 30 lines and uses zone-ops helpers only.

#### Risk 2: Economy duplication between WP-018 base stats and hero hooks

**Risk:** `playCard` currently calls `addResources(G.turnEconomy, heroAttack,
heroRecruit)` using `G.cardStats[cardId]` for base attack/recruit values
(line 112-116). WP-022 adds `executeHeroEffects` which also calls
`addResources` for `'attack'` and `'recruit'` keyword effects. If a hero
card has both base stats AND hook effects for the same resource, the player
gets double economy.

**Impact:** MEDIUM. Gameplay correctness issue. May be intentional (base stats
+ ability bonus) or a bug (hook replaces base stats).

**Mitigation:** This is a **design question**, not a code bug. The WP-022
packet explicitly states: "Do not remove or replace the existing `addResources`
call from WP-018. Hero hook economy is additive." This means hero cards CAN
have both base stats AND hook-granted economy.

**Decision (locked for execution):**
- WP-018 `addResources` call remains untouched in `playCard`.
- `executeHeroEffects` calls `addResources` additionally for hook effects.
- The interaction is documented in DECISIONS.md during execution.
- If testing reveals unexpected double-counting for specific cards, the
  implementer documents the finding but does NOT remove the WP-018 call.
  Resolution is deferred to a future WP if needed.

#### Risk 3: `ctx: unknown` narrowing for ShuffleProvider

**Risk:** Using `ctx: unknown` keeps the file free of boardgame.io imports,
but the draw keyword needs `ShuffleProvider.random.Shuffle`. Runtime narrowing
of `unknown` to `ShuffleProvider` requires a type assertion or structural
check.

**Impact:** LOW. `ShuffleProvider` is defined locally in
`setup/shuffle.ts:16-18` — no boardgame.io import needed.

**Decision (locked for execution):**
- Import `ShuffleProvider` from `../setup/shuffle.js` (engine-internal, no
  boardgame.io dependency).
- Cast `ctx as ShuffleProvider` at the draw call site with a `// why:` comment
  explaining that boardgame.io ctx is structurally compatible.
- This is the same pattern used in `villainDeck.reveal.ts` and
  `coreMoves.impl.ts` (established precedent).

#### Risk 4: `playerID` not available in `executeHeroEffects` signature

**Risk:** The current `executeHeroEffects(G, ctx, cardId)` signature does not
include `playerID`. But draw logic needs to know which player's zones to
modify, and economy logic needs the active player's `turnEconomy`.

**Impact:** HIGH. Without `playerID`, the function cannot determine whose
deck/hand to draw from.

**Decision (locked for execution):**
- Add `playerID: string` as a parameter:
  `executeHeroEffects(G: LegendaryGameState, ctx: unknown, playerID: string, cardId: CardExtId): void`
- The caller (`playCard`) already has `playerID` from `MoveContext` and passes
  it through.
- This does not introduce a boardgame.io import — `playerID` is a plain string.
- **WP-022 must be updated** to reflect the corrected signature before
  generating the session prompt.

#### Risk 5: KO pile field path ambiguity

**Risk:** WP-022 says `koCard(G.ko, cardId)`. But `koCard` helper signature is
`koCard(koPile: CardExtId[], cardId: CardExtId): CardExtId[]`. Need to confirm
the exact path to the KO pile in `G`.

**Impact:** LOW if path is confirmed; HIGH if path is wrong.

**Decision (locked for execution):**
- The implementer must verify the exact KO pile field path in
  `LegendaryGameState` before coding. Likely candidates: `G.piles.ko`,
  `G.ko`, or similar. Confirm by reading `types.ts`.
- The `koCard` helper returns a new array — result must be assigned back to
  the correct field.

#### Risk 6: Hook `effects` field is optional

**Risk:** `HeroAbilityHook.effects` is typed as `effects?: HeroEffectDescriptor[]`.
If execution doesn't check for `undefined`, it will crash with
`TypeError: Cannot read properties of undefined (reading 'length')`.

**Impact:** MEDIUM. Runtime crash in a move function (violates "moves never throw").

**Decision (locked for execution):**
- `executeHeroEffects` must check `hook.effects` before iterating.
- If `effects` is `undefined` or empty array: skip, no mutation, no error.
- Test #7 covers this case explicitly.

---

### Pre-Flight Verdict (Binary)

✅ **READY TO EXECUTE**

WP-022 is properly sequenced: all dependencies (WP-021, WP-018, WP-017,
WP-008B) are complete. The repo is green (build exits 0, 255 tests passing).
Scope boundaries are clear and the file allowlist is locked. Six risks were
identified and all have concrete mitigations locked for execution. The most
significant risk (Risk 1: `drawCards` is a move, not a helper) has a clear
resolution path using existing zone-ops primitives and `ShuffleProvider`.

All mandatory pre-session WP/EC updates have been applied (see Authorized
Next Step section for resolution log).

---

### Authorized Next Step

> You are authorized to generate a **session execution prompt** for WP-022
> to be saved as:
> `docs/ai/invocations/session-wp022-hero-execution.md`

**Guard:** The session prompt **must conform exactly** to the scope, constraints,
and decisions locked by this pre-flight. No new scope may be introduced.

**Pre-session actions — ALL RESOLVED (2026-04-13):**

1. ✅ WP-022 updated: `playerID: string` added to `executeHeroEffects` signature.
   Caller (`playCard`) passes `playerID` from `MoveContext`. Plain string, no
   boardgame.io import.
2. ✅ WP-022 updated: draw implementation strategy clarified. `drawCards` is a
   move function (takes `MoveContext`, performs validation/gating) — must NOT be
   called directly. Draw logic uses zone-ops primitives (`moveCardFromZone`,
   `moveAllCards`, `shuffleDeck` with `ctx as ShuffleProvider`). `ShuffleProvider`
   imported from engine-internal `setup/shuffle.js`.
3. ✅ WP-022 updated: KO pile field path verified and locked as `G.ko: CardExtId[]`
   (top-level field, confirmed at `types.ts:282`).
4. ✅ EC-022 updated: reflects all WP-022 changes including corrected signature,
   draw strategy, KO path, helper return patterns, `playCard` destructuring
   change to `{ G, playerID, ...context }`, and expanded failure smells.
5. ✅ WP-022 keyword table updated: draw column now references zone-ops primitives
   instead of `drawCards`. Economy/KO columns show exact call patterns with
   return value assignment.

All mandatory pre-session actions are complete. No re-run of pre-flight required —
these updates resolve the risks identified by this pre-flight without changing scope.

---

### Final Instruction

Pre-flight exists to **prevent premature execution and scope drift**.

This pre-flight identified 6 risks. All are mitigated with locked decisions.
All mandatory WP/EC updates have been applied. The verdict is **READY TO EXECUTE**.
