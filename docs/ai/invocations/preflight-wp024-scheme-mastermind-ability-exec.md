# Pre-Flight: WP-024 — Scheme & Mastermind Ability Execution

---

### Pre-Flight Header

**Target Work Packet:** `WP-024`
**Title:** Scheme & Mastermind Ability Execution
**Previous WP Status:** WP-023 Complete (2026-04-13)
**Pre-Flight Date:** 2026-04-13
**Invocation Stage:** Pre-Execution (Scope & Readiness)

**Work Packet Class:** Behavior / State Mutation
- Implements scheme twist and mastermind strike handler functions
- Modifies `buildDefaultHookDefinitions` to use correct triggers
- Registers handlers in `ImplementationMap` (runtime-only, outside G)
- Effects mutate G via existing `applyRuleEffects` pipeline

---

### Pre-Flight Intent

Perform a pre-flight validation for WP-024.

- Not implementing.
- Not generating code.
- Validating readiness and constraints only.

If a blocking condition is found, pre-flight must return **NOT READY** and stop.

---

### Authority Chain (Must Read)

1. `.claude/CLAUDE.md` — read. EC-mode rules, commit discipline confirmed.
2. `docs/ai/ARCHITECTURE.md` — read. Rule Execution Pipeline (Section 4),
   Endgame & Counters, Registry & Runtime Boundary confirmed.
3. `docs/03.1-DATA-SOURCES.md` — read. G.mastermind listed as setup-time
   derived from registry. No dedicated scheme ability source; ability data
   flows through registry card JSON at setup time.
4. `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` — read. `src/rules/` = `engine`
   category. `src/setup/` = `setup` category. Both confirmed compatible with
   WP-024 file placements.
5. `docs/ai/execution-checklists/EC-024-scheme-ability-exec.checklist.md` — read.
6. `docs/ai/work-packets/WP-024-scheme-mastermind-ability-execution.md` — read.

No conflicts found between authority documents.

---

### Dependency & Sequencing Check

| WP | Status | Notes |
|---|---|---|
| WP-023 | **PASS** | Complete (2026-04-13), 281 tests passing |
| WP-009A | **PASS** | Contract types (`RuleTriggerName`, `RuleEffect`, `HookDefinition`) verified in code |
| WP-009B | **PASS** | `executeRuleHooks`, `applyRuleEffects`, `ImplementationMap`, `buildDefaultHookDefinitions` all exist |
| WP-010 | **PASS** | `ENDGAME_CONDITIONS.SCHEME_LOSS = 'schemeLoss'` verified in `endgame.types.ts` |
| WP-014 | **PASS** | `villainDeck.reveal.ts` emits `'onSchemeTwistRevealed'` and `'onMastermindStrikeRevealed'` triggers |
| WP-019 | **PASS** | `MastermindState` type exported from `mastermind.types.ts` |

All prerequisites are complete. No blocker.

---

### Dependency Contract Verification

- [x] **Type/field names match exactly** — `RuleTriggerName`, `RuleEffect`,
  `HookDefinition`, `ImplementationMap`, `ENDGAME_CONDITIONS.SCHEME_LOSS` all
  verified against actual source files. All names in WP-024 match the code.

- [x] **Function signatures compatible** — `executeRuleHooks(gameState, ctx,
  triggerName, payload, registry, implementationMap): RuleEffect[]` confirmed.
  Handler signature `(gameState: LegendaryGameState, ctx: unknown, payload:
  unknown) => RuleEffect[]` matches `ImplementationMap` value type.

- [x] **Move classification correct** — WP-024 adds no new moves. Handlers
  are `ImplementationMap` entries, not moves.

- [x] **Field paths in G verified** — `G.hookRegistry: HookDefinition[]`
  confirmed in `types.ts`. `G.counters: Record<string, number>` confirmed.
  `G.messages: string[]` confirmed. No new G fields added.

- [x] **Helper return patterns understood** — Handlers return `RuleEffect[]`.
  `applyRuleEffects` applies them to G. No void-mutator confusion.

- [x] **Optional fields identified** — No new optional fields. Existing
  `G.hookRegistry` is always populated at setup time.

- [x] **Data source identity verified** — Scheme/mastermind ability data
  flows from registry card JSON through setup-time resolution. No new data
  files loaded.

- [x] **TypeScript types accommodate real data** — No new card data types
  consumed. Handlers use `CardExtId` strings and counters.

- [x] **Schema-engine alignment verified** — No schema changes in this WP.

- [x] **Handler ownership is explicit** — WP-024 explicitly states handlers
  live in `ImplementationMap` outside G. Data-only `HookDefinition` entries
  live in `G.hookRegistry`.

- [x] **Persistence classification clear** — No new G fields. `hookRegistry`
  is setup-only (excluded from snapshots per WP-013).

- [x] **WP scope pre-validated against ARCHITECTURE.md** — Handlers use the
  existing two-step pipeline. No new execution engine. Scheme-loss mediated
  through counters. All verified against ARCHITECTURE.md Section 4.

- [x] **Framework API workarounds documented** — No new framework
  workarounds needed.

- [x] **New types defined in contract files** — No new types. Uses existing
  `RuleEffect`, `HookDefinition`, `ImplementationMap`.

- [x] **Immutable file designations respected** — `ruleHooks.types.ts`
  (WP-009A contract) will not be modified unless a new effect type is needed.
  WP-024 uses existing effect types.

- [x] **Cross-service identifiers use ext_id** — `sourceId` in
  `HookDefinition` uses `config.schemeId` and `config.mastermindId`, both
  ext_id strings.

- [x] **Locked value string literals match actual code** — Verified against
  source:
  - `ENDGAME_CONDITIONS.SCHEME_LOSS` = `'schemeLoss'` (endgame.types.ts:38)
  - `'onSchemeTwistRevealed'` (ruleHooks.types.ts:26, villainDeck.reveal.ts)
  - `'onMastermindStrikeRevealed'` (ruleHooks.types.ts:27, villainDeck.reveal.ts)
  - Effect types `'queueMessage'`, `'modifyCounter'`, `'drawCards'`,
    `'discardHand'` (ruleHooks.types.ts:133-137)
  - `HookDefinition.kind` values `'scheme'` | `'mastermind'` (ruleHooks.types.ts:166)

- [x] **Runtime data availability verified** — Handlers need:
  - `G.counters` for scheme twist counting and scheme-loss → exists
  - `G.messages` for queue messages → exists
  - `payload.cardId` from trigger emission → confirmed in
    `villainDeck.reveal.ts` (payload is `{ cardId }`)
  - No team/class/stat data needed (unlike WP-023). Handlers produce
    effects based on counter thresholds, not card attributes.

**No contract drift found. All names, signatures, and field paths verified.**

---

### Input Data Traceability Check

- [x] All non-user-generated inputs listed in `docs/03.1-DATA-SOURCES.md` —
  YES. G.mastermind (WP-019) listed as setup-time derived.
- [x] Storage location known — YES. Registry card JSON on local filesystem,
  resolved at setup time into G.
- [x] Data source inspectable if behavior incorrect — YES. Trace:
  registry JSON → setup → G.hookRegistry + ImplementationMap → trigger →
  effects → G.counters.
- [x] No implicit data — YES. Scheme twist threshold is the only
  hardcoded value (MVP simplification). Documented as explicit MVP constant.
- [x] Setup-time derived fields listed — YES. G.hookRegistry already listed.
  No new derived fields.

No NO answers.

---

### Structural Readiness Check

- [x] All prior WPs compile and tests pass — YES. Build exits 0. 281 tests
  pass, 0 fail.
- [x] No known EC violations remain open — YES.
- [x] Required types/contracts exist and exported — YES. All verified above.
- [x] No naming or ownership conflicts — YES.
- [x] No architectural boundary conflicts anticipated — YES.
- [x] Database/migration check — N/A (no database changes).
- [x] R2 data check — N/A (no R2 data consumption).
- [x] G field subfields verified — YES. `G.counters` is
  `Record<string, number>` — counters can be added dynamically.
  `G.hookRegistry` is `HookDefinition[]` — shape verified.

All YES. No blockers.

---

### Runtime Readiness Check

- [x] Runtime touchpoints known — `ruleRuntime.impl.ts` (modify
  `buildDefaultHookDefinitions` and `DEFAULT_IMPLEMENTATION_MAP`), new
  handler files in `src/rules/`.
- [x] Framework context requirements understood — Handlers receive
  `ctx: unknown`. No `ctx.events.*` or `ctx.random.*` needed in handlers.
  Effects are applied by `applyRuleEffects`, not handlers.
- [x] Test infrastructure supports required mocks — YES. `makeMockCtx`
  provides minimal context. Handlers receive `ctx: unknown` so any object
  works.
- [x] No runtime wiring allowance needed — Modifying `ruleRuntime.impl.ts`
  is within the WP's scope (replacing stubs with real handlers).
- [x] No architecture boundary violations expected — Handlers are pure
  engine code in `src/rules/`. No boardgame.io imports.
- [x] Integration point code read and confirmed —
  `villainDeck.reveal.ts` calls `executeRuleHooks(G, ctx,
  'onSchemeTwistRevealed', { cardId }, G.hookRegistry,
  DEFAULT_IMPLEMENTATION_MAP)`. The `DEFAULT_IMPLEMENTATION_MAP` is
  imported from `ruleRuntime.impl.ts`. Adding new handler entries to this
  map is the integration point.
- [x] Stage gating — N/A. No new moves added. Handlers fire via trigger
  emission inside `revealVillainCard`, which already has stage gating.
- [x] Multi-step mutation ordering — N/A. Handlers return effects; they
  don't perform multi-step mutations.
- [x] Registry data flow — Correct. Scheme/mastermind identity comes from
  `config.schemeId` / `config.mastermindId` at setup time. No runtime
  registry access.
- [x] Phase transitions — N/A. No `ctx.events.setPhase()` calls.
- [x] Simultaneous conditions — Loss-before-victory evaluation order is
  already handled by `evaluateEndgame` (WP-010). Scheme-loss counter
  increments feed into the existing evaluation.
- [x] Degradation for unknown types — Existing `applyRuleEffects` handles
  unknown effect types with warn-and-continue. No new degradation path
  needed.

All YES. No blockers.

---

### Established Patterns to Follow

1. **Two-step declarative + deterministic execution** — Handlers return
   `RuleEffect[]`, `applyRuleEffects` mutates G. (WP-009B)
2. **Data-only contracts in G, handler functions in ImplementationMap** —
   `HookDefinition` in G, handler functions in `DEFAULT_IMPLEMENTATION_MAP`.
   (WP-009A/009B, D-1232)
3. **Graceful degradation for unknown types** — Unknown effect types warn
   via `G.messages` and continue. (WP-009B, D-1234)
4. **Endgame counters, not direct calls** — Scheme-loss is mediated
   through `G.counters[ENDGAME_CONDITIONS.SCHEME_LOSS]`. (WP-010, D-1235)
5. **Fail-closed vs silent no-op** — Missing or unexpected data produces
   deterministic message in `G.messages`. (WP-014A/016 pattern)
6. **`ctx: unknown` with local narrowing** — Handlers receive
   `ctx: unknown`, no boardgame.io import needed. (WP-022 precedent)

No deviations from established patterns.

---

### Maintainability & Upgrade Readiness

- [x] **Extension seam exists** — New scheme/mastermind-specific handlers
  are added to `ImplementationMap` by hook id. Future schemes/masterminds
  with unique abilities are added by writing new handler functions and
  mapping them to new hook ids. The `ImplementationMap` keyed-by-id pattern
  is the extension seam.
- [x] **Patch locality** — A bug in scheme twist handling would be fixed
  in `schemeHandlers.ts` only. A bug in mastermind strike handling would be
  fixed in `mastermindHandlers.ts` only. 1 file per fix.
- [x] **Fail-safe behavior** — Handlers return `RuleEffect[]`. If a handler
  produces wrong effects, `applyRuleEffects` applies them deterministically
  but no invariant cascade occurs. Unknown effects warn and continue.
- [x] **Deterministic reconstructability** — Given identical
  `G.hookRegistry` and `ImplementationMap`, identical trigger sequences
  produce identical effects. No hidden state.
- [x] **Backward-compatible test surface** — New handlers don't affect
  existing test mocks. The existing `defaultSchemeImplementation` and
  `defaultMastermindImplementation` stubs will be replaced, but their
  test assertions (exact message strings from WP-009B) will need updating.
  This is expected and documented below.
- [x] **Semantic naming stability** — `schemeTwistHandler` and
  `mastermindStrikeHandler` are semantically stable names. No MVP-prefix or
  implementation-detail encoding.

All YES. No concerns.

---

### Code Category Boundary Check

- [x] `src/rules/schemeHandlers.ts` — **engine** category. Pure handler,
  no boardgame.io, no I/O. Correct.
- [x] `src/rules/mastermindHandlers.ts` — **engine** category. Pure
  handler, no boardgame.io, no I/O. Correct.
- [x] `src/rules/ruleRuntime.impl.ts` — **engine** category. Existing
  file, modifications within category bounds. Correct.
- [x] `src/index.ts` — Package exports. Correct.
- [x] `src/rules/schemeHandlers.test.ts` — **test** category. Correct.
- [x] `src/rules/mastermindHandlers.test.ts` — **test** category. Correct.

No boundary violations.

---

### Scope Lock (Critical)

#### WP-024 Is Allowed To

- **Create:** `src/rules/schemeHandlers.ts` — scheme twist handler function
  (engine category, no boardgame.io imports)
- **Create:** `src/rules/mastermindHandlers.ts` — mastermind strike handler
  function (engine category, no boardgame.io imports)
- **Modify:** `src/rules/ruleRuntime.impl.ts` — replace stub handlers with
  real implementations, update trigger arrays in `buildDefaultHookDefinitions`,
  update `DEFAULT_IMPLEMENTATION_MAP` to reference new handlers
- **Modify:** `src/index.ts` — export `schemeTwistHandler`,
  `mastermindStrikeHandler`
- **Create:** `src/rules/schemeHandlers.test.ts` — 6 tests
- **Create:** `src/rules/mastermindHandlers.test.ts` — 4 tests
- Update governance docs (STATUS.md, DECISIONS.md, WORK_INDEX.md)

#### WP-024 Is Explicitly Not Allowed To

- No modification of `ruleHooks.types.ts` (WP-009A contract) unless adding
  a new effect type with DECISIONS.md entry
- No modification of `villainDeck.reveal.ts` (WP-014 reveal pipeline)
- No new moves
- No new phases, stages, or trigger names
- No new effect types unless justified in DECISIONS.md
- No runtime registry access
- No `boardgame.io` imports in handler files
- No `.reduce()` in handlers
- No `Math.random()` or nondeterminism
- No functions stored in G
- No persistence / database access
- No server or UI changes
- No files outside scope list

---

### Test Expectations (Locked Before Execution)

- **New tests:** 10 total
  - 6 in `src/rules/schemeHandlers.test.ts`
  - 4 in `src/rules/mastermindHandlers.test.ts`
- **Existing test changes:** WP-009B integration tests in
  `ruleRuntime.integration.test.ts` assert exact message strings from the
  stub handlers (`'Scheme: turn started.'`, `'Mastermind: turn ended.'`).
  These will need updating because the stubs are being replaced with real
  handlers that respond to different triggers. This is an expected
  consequence of replacing stubs, not scope creep. The trigger arrays
  also change (`onTurnStart` → `onSchemeTwistRevealed`, `onTurnEnd` →
  `onMastermindStrikeRevealed`), so tests that fire those specific triggers
  may need assertion updates.
- **Prior test baseline:** 281 tests passing. All must continue to pass
  (after expected assertion updates for stub replacement).
- **Test boundaries:** No boardgame.io imports. No modifications to
  `makeMockCtx`. Tests use `node:test` and `node:assert` only.
- **Defensive guards:** Handlers receive `ctx: unknown` — any test mock
  works. No new G fields to guard against.

---

### Mutation Boundary Confirmation

- [x] G mutations occur only inside `applyRuleEffects` (framework-
  authorized via the reveal pipeline's move context) — YES.
- [x] No mutation occurs in handlers — YES. Handlers return `RuleEffect[]`.
- [x] Handlers return new values; `applyRuleEffects` applies them — YES.
- [x] No mutation outside boardgame.io move context — YES. The full chain
  is: `revealVillainCard` (move) → `executeRuleHooks` (collect) →
  `applyRuleEffects` (apply). All within move context.

No violations.

---

### Risk & Ambiguity Review

#### Risk 1: File Path Mismatch Between WP-024 and Actual Codebase

**Risk:** WP-024 says to create/modify `src/setup/buildDefaultHookDefinitions.ts`
and `src/setup/buildImplementationMap.ts`. These files do not exist.
`buildDefaultHookDefinitions` and `DEFAULT_IMPLEMENTATION_MAP` both live in
`src/rules/ruleRuntime.impl.ts`.

**Impact:** MEDIUM — Executing the WP literally would create duplicate files
in wrong locations.

**Mitigation:** The WP and EC must be corrected before execution. The correct
file to modify is `packages/game-engine/src/rules/ruleRuntime.impl.ts`. The
"Files Expected to Change" section must list `ruleRuntime.impl.ts` instead of
the non-existent `setup/` files.

**Decision:** Correct WP-024 and EC-024 file paths before execution. This is
a WP text error, not a scope change — the intent (modify hook definitions and
implementation map) is unchanged.

#### Risk 2: WP-009B Integration Test Assertion Updates

**Risk:** Replacing stub handlers changes the behavior that WP-009B integration
tests assert against. Specifically, `defaultSchemeImplementation` returns
`'Scheme: turn started.'` and `defaultMastermindImplementation` returns
`'Mastermind: turn ended.'` — integration tests may assert these exact strings.

**Impact:** LOW — Test updates are value-only (new message strings), not logic
changes. This is the expected consequence of replacing MVP stubs.

**Mitigation:** During execution, verify which integration tests reference the
stub messages and update assertion values. Document in DECISIONS.md that stub
replacement is expected to update integration test assertions.

**Decision:** Integration test assertion updates are authorized as part of
stub replacement. No new test logic; values only.

#### Risk 3: Scheme Twist Threshold — Hardcoded MVP Value

**Risk:** WP-024 says scheme twist at threshold triggers scheme-loss. The
threshold value is not specified. This is an MVP simplification — real
schemes have varying thresholds based on scheme text.

**Impact:** LOW — MVP constant is acceptable. Future WP will parameterize
per-scheme thresholds.

**Mitigation:** Use a clearly named constant (e.g., `MVP_SCHEME_TWIST_THRESHOLD`)
with a `// why:` comment explaining it's a placeholder. Value should be
reasonable (e.g., 7 twists = loss per standard Legendary rules for most schemes).

**Decision:** Hardcode a reasonable MVP threshold constant with `// why:`
comment. Future WP parameterizes per-scheme.

#### Risk 4: Mastermind Strike "Each Player Gains 1 Wound" — Effect Type

**Risk:** WP-024 says mastermind strike MVP: each player gains 1 wound. The
existing effect types are `queueMessage`, `modifyCounter`, `drawCards`,
`discardHand`. None of these directly model "gain a wound" (moving a card
from `G.piles.wounds` to a player's discard pile).

**Impact:** MEDIUM — The handler may need to model wound-gain as a
`modifyCounter` effect on a wound counter (tracking only) + `queueMessage`
rather than actual card movement. Or a new effect type may be needed.

**Mitigation:** For MVP, the strike handler can produce `modifyCounter` effects
(tracking wound counts) + `queueMessage` effects. Actual card-movement wound
effects require a new `'gainWound'` effect type — which would require a
DECISIONS.md entry and update to `ruleHooks.types.ts` (WP-009A contract).

**Decision:** MVP strike handler produces `modifyCounter` + `queueMessage`
effects only. No new effect type. Actual wound card movement is deferred to
a future WP that adds wound-gain as an effect type. This follows the same
safe-skip pattern as WP-023: implement the structure, defer the full behavior.
Document in DECISIONS.md.

**All risks resolved. No blocking issues remain.**

---

### Pre-Flight Verdict

## **READY TO EXECUTE** (Conditional)

WP-024 is properly sequenced — all dependencies are complete (WP-023 finished
today, 281 tests passing, build green). All contract names, function signatures,
type shapes, and locked value string literals have been verified against actual
source code with zero drift found. The scope is well-defined and uses the
existing `executeRuleHooks` → `applyRuleEffects` pipeline with no new execution
engine. The `ImplementationMap` pattern, counter-mediated endgame, and
two-step effect pipeline are all established precedents with clear extension
seams.

**Conditional on the following mandatory corrections before execution:**

1. **WP-024 file path correction:** Replace references to
   `src/setup/buildDefaultHookDefinitions.ts` and
   `src/setup/buildImplementationMap.ts` with
   `src/rules/ruleRuntime.impl.ts` in both the WP and EC.
2. **EC-024 file path correction:** Update "Files to Produce" section to
   list `ruleRuntime.impl.ts` instead of the non-existent `setup/` files.
3. **WP-024 "Files Expected to Change":** Replace the two `setup/` entries
   with `packages/game-engine/src/rules/ruleRuntime.impl.ts — modified`.

---

### Invocation Prompt Conformance Check (Pre-Generation)

- [x] All EC locked values will be copied verbatim — verified above
- [x] No new keywords, helpers, or file paths beyond WP/EC — only file
  path corrections (from non-existent paths to actual paths)
- [x] File paths match corrected WP
- [x] No forbidden imports or behaviors introduced
- [x] No unresolved ambiguities introduced
- [x] Contract names match verified dependency code
- [x] Handler call patterns reflect actual signatures

Prompt is a transcription artifact. No interpretation needed.

---

### Authorized Next Step

> You are authorized to generate a **session execution prompt** for WP-024
> to be saved as:
> `docs/ai/invocations/session-wp024-scheme-mastermind-ability-exec.md`

**Guard:** The session prompt must conform exactly to the scope, constraints,
and decisions locked by this pre-flight. No new scope may be introduced.

**Pre-session actions — ALL RESOLVED (2026-04-13):**

1. Corrected WP-024 file paths: replaced `src/setup/buildDefaultHookDefinitions.ts`
   and `src/setup/buildImplementationMap.ts` with `src/rules/ruleRuntime.impl.ts`
   in both Scope (In) section C/D and "Files Expected to Change".
2. Corrected EC-024 "Files to Produce" section with actual file path
   (`ruleRuntime.impl.ts` instead of two non-existent `setup/` files).
3. DECISIONS.md entry pending (will be added during execution).

All mandatory pre-session actions are complete. No re-run of pre-flight
required — these updates resolve risks identified by this pre-flight
without changing scope.
