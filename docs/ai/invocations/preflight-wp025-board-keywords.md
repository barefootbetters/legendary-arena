# Pre-Flight — WP-025: Keywords: Patrol, Ambush, Guard

---

## Pre-Flight Header

**Target Work Packet:** `WP-025`
**Title:** Keywords: Patrol, Ambush, Guard
**Previous WP Status:** WP-024 Complete (2026-04-13)
**Pre-Flight Date:** 2026-04-13
**Invocation Stage:** Pre-Execution (Scope & Readiness)

**Work Packet Class:** Behavior / State Mutation
(Adds `G.cardKeywords`, modifies `fightVillain` validation and reveal pipeline)

---

## Pre-Flight Intent

Perform a pre-flight validation for WP-025.

- Not implementing.
- Not generating code.
- Validating readiness and constraints only.

---

## Authority Chain (Confirmed Read)

1. `.claude/CLAUDE.md` — EC-mode rules confirmed
2. `docs/ai/ARCHITECTURE.md` — layer boundaries, registry boundary confirmed
3. `docs/03.1-DATA-SOURCES.md` — setup-time derived data section exists
4. `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` — referenced
5. `docs/ai/execution-checklists/EC-025-board-keywords.checklist.md` — read in full
6. `docs/ai/work-packets/WP-025-keywords-patrol-ambush-guard.md` — read in full
7. Prior WP dependencies verified against actual source files

---

## Dependency & Sequencing Check

| WP | Status | Notes |
|---|---|---|
| WP-024 | **PASS** | Complete (2026-04-13) per WORK_INDEX.md |

**Build:** `pnpm --filter @legendary-arena/game-engine build` exits 0
**Tests:** 291 tests, 0 failures, 80 suites

All prerequisites met.

---

## Dependency Contract Verification

### Verified Contracts (all PASS)

- [x] **`CityZone`** — exists in `city.types.ts`, type `[CitySpace, CitySpace, CitySpace, CitySpace, CitySpace]` (5-tuple of `CardExtId | null`)
- [x] **`pushVillainIntoCity`** — exists in `city.logic.ts`, places card at index 0, shifts right toward escape at index 4
- [x] **`fightVillain`** — exists in `fightVillain.ts`, signature `({G, ctx}: MoveContext, {cityIndex}: FightVillainArgs): void`, three-step validation contract preserved
- [x] **`getAvailableAttack`** — exists in `economy.logic.ts`, signature `(economy: TurnEconomy): number`
- [x] **`gainWound`** — exists in `wounds.logic.ts`, signature `(woundsPile: CardExtId[], playerDiscard: CardExtId[]): GainWoundResult`, pure helper returning new arrays
- [x] **`G.villainDeckCardTypes`** — exists in `LegendaryGameState` as `Record<CardExtId, RevealedCardType>`
- [x] **`G.cardStats`** — exists in `LegendaryGameState` as `Record<CardExtId, CardStatEntry>` with fields `{attack, recruit, cost, fightCost}`
- [x] **`applyRuleEffects`** — exists in `ruleRuntime.effects.ts`, signature `(gameState: LegendaryGameState, ctx: unknown, effects: RuleEffect[]): LegendaryGameState`
- [x] **`CardExtId`** — exists in `zones.types.ts` as `type CardExtId = string`
- [x] **`makeMockCtx`** — exists in `test/mockCtx.ts`, signature `(overrides?: MockCtxOverrides): SetupContext`
- [x] **`RuleEffect`** — exists in `ruleHooks.types.ts`: `'queueMessage' | 'modifyCounter' | 'drawCards' | 'discardHand'`
- [x] **City indexing convention:** space 0 = entry, space 4 = escape edge. Higher index = closer to escape. Confirmed in `pushVillainIntoCity`.
- [x] **WP file paths verified** — all files listed in "Files Expected to Change" exist (for modified files) or target valid directories (for new files)
- [x] **Persistence classification clear** — `G.cardKeywords` is Runtime class (in G, never persisted), same as `G.villainDeckCardTypes` and `G.cardStats`
- [x] **New types in dedicated contract file** — `boardKeywords.types.ts` (new file) for `BoardKeyword` and `BOARD_KEYWORDS`
- [x] **Cross-service identifiers** — uses `CardExtId` strings only
- [x] **Immutable file designations** — WP-015 `city.types.ts` is listed as immutable; WP-025 correctly forbids modification

### Findings Requiring WP Correction

#### FINDING 1 — Ambush RuleEffect Type Gap (WP correction required)

**Problem:** WP-025 scope B specifies `getAmbushEffects(cardId, cardKeywords): RuleEffect[]`
applied via `applyRuleEffects` (scope E). However, no `gainWound` RuleEffect type exists.
Current `RuleEffect` types: `queueMessage`, `modifyCounter`, `drawCards`, `discardHand`.

The MVP Ambush effect ("each player gains 1 wound") requires calling `gainWound()` for
each player, which is a pure helper — not a RuleEffect type.

**Precedent:** Escape wounds in `villainDeck.reveal.ts` (lines 124-137) already call
`gainWound` directly inline — NOT through the RuleEffect pipeline.

**Resolution (follows WP-024 D-2403 safe-skip pattern):**
Ambush wound gain must be implemented **inline** in `villainDeck.reveal.ts`, same pattern
as escape wounds. The `getAmbushEffects` function should be redesigned as:

- `hasAmbush(cardId, cardKeywords): boolean` — returns whether card has Ambush
- Inline wound logic in reveal pipeline calls `gainWound` for each player
- Emit `queueMessage` effects via `applyRuleEffects` for observability

**WP scope B correction:** Replace `getAmbushEffects(...): RuleEffect[]` with
`hasAmbush(...): boolean`. Document in DECISIONS.md: Ambush wound gain is inline
(not RuleEffect) because `gainWound` is not a RuleEffect type. Future WP may
add `gainWound` to the RuleEffect union and migrate to pipeline.

**WP scope E correction:** Replace "apply via `applyRuleEffects`" with inline
wound logic calling `gainWound` per player, plus `G.messages.push()` for observability.

#### FINDING 2 — Keyword Data Availability in Registry

**Problem:** WP-025 Assumes section states "Card data includes keyword information
in ability text or structured metadata." Investigation reveals:

- **Ambush:** 304 occurrences across all sets. Identifiable by `"Ambush:"` prefix in
  ability text strings. Data available for extraction.
- **Patrol:** 4 occurrences, BUT these are NOT the generic "fight cost +1" keyword
  described by WP-025. They are set-specific Secret Wars Vol 2 mechanics
  (`[keyword:Patrol the Bank]`, `[keyword:Patrol the Sewers]`). Semantically different.
- **Guard:** Zero occurrences in any card data.

No structured keyword metadata exists in the registry schema (`VillainCardSchema`,
`HenchmanCardSchema`). Keywords only appear in ability text strings.

**Resolution (follows WP-023 safe-skip precedent D-2302):**
- `buildCardKeywords` extracts Ambush from ability text (`"Ambush:"` prefix detection)
- Patrol and Guard keywords produce empty results (no matching cards in data)
- All three keyword mechanics are fully implemented and tested with synthetic data
- Tests manually construct `G.cardKeywords` entries with patrol/guard to prove
  mechanics work
- DECISIONS.md documents: Patrol and Guard have no data source yet; mechanics exist
  but are dormant until a future WP adds structured keyword data or manual card
  classification

**Not blocking.** The mechanics are code-complete and tested. Data availability for
Patrol/Guard is a known gap, not an implementation gap.

#### FINDING 3 — `buildCardKeywords` Registry Parameter Convention

**Problem:** WP scope C specifies `buildCardKeywords(registry: CardRegistry, ...)`.
Established convention (per `buildCardStats`, `buildVillainDeck`) uses
`registry: unknown` with local structural interface and runtime type guard.

**Resolution:** Minor WP wording correction. Use `registry: unknown` with a
`CardKeywordsRegistryReader` local interface (same pattern as
`CardStatsRegistryReader` in `economy.logic.ts`). Runtime type guard for graceful
degradation with narrow test mocks.

---

## Input Data Traceability Check

- [x] All non-user-generated inputs consumed by this WP are listed in
  `docs/03.1-DATA-SOURCES.md` — villain/henchman card data from registry
- [x] Storage location known — R2 card JSON files, loaded via registry
- [x] Incorrect behavior traceable — check card JSON ability text parsing
- [x] No implicit data — keyword identification is explicit (ability text parsing)
- [x] Setup-time derived field `G.cardKeywords` will be added to
  `docs/03.1-DATA-SOURCES.md` post-execution (noted in EC after-completing)

All YES.

---

## Structural Readiness Check

- [x] All prior WPs compile and tests pass (291 tests, 0 failures)
- [x] No known EC violations remain open
- [x] Required types/contracts exist and are exported as verified above
- [x] No naming or ownership conflicts
- [x] No architectural boundary conflicts anticipated
- [x] N/A — no database migrations
- [x] N/A — no R2 data dependency for build
- [x] G fields verified: `cardStats` has `fightCost`, `turnEconomy` exists,
  `city` is `CityZone`, `piles.wounds` is `CardExtId[]`, `playerZones`
  is `Record<string, PlayerZones>`

All PASS.

---

## Runtime Readiness Check

- [x] Runtime touchpoints known: `fightVillain.ts` (Guard + Patrol validation),
  `villainDeck.reveal.ts` (Ambush on City entry), `buildInitialGameState.ts`
  (setup wiring), `types.ts` (G field), `index.ts` (exports)
- [x] Framework context requirements understood: `fightVillain` receives `{G, ctx}`,
  reveal receives `{G, ctx, ...context}` including `random`
- [x] Test infrastructure supports required mocks: `makeMockCtx` available,
  no modifications needed
- [x] No 01.5 runtime wiring allowance needed (no existing tests assert
  keyword-related behavior)
- [x] No architecture boundary violations expected — all keyword logic in engine layer
- [x] Integration points read and confirmed:
  - `fightVillain`: Guard check fits after `cityIndex` validation (line 43-51),
    before `requiredFightCost` computation (line 60); Patrol modifier adds to
    `requiredFightCost` before the `availableAttack < requiredFightCost` check
  - `villainDeck.reveal.ts`: Ambush insertion point is after City placement
    (line 112 `G.city = pushResult.city`) and before bystander attachment (line 158)
- [x] No new moves added — no stage gating changes needed
- [x] Multi-step mutation ordering: Ambush wound gain uses same pattern as
  escape wounds (check pile length, call `gainWound`, assign results)
- [x] Registry data flows through setup-time resolution (`buildCardKeywords`)
  into `G.cardKeywords` — no runtime registry access
- [x] No phase transitions involved
- [x] No simultaneous condition evaluation
- [x] Unknown keyword degradation: N/A (closed union, no unknown types possible)

All PASS.

---

## Established Patterns to Follow

- Setup-time registry resolution into G fields (WP-014B/018/021 precedent)
- `registry: unknown` with local structural interface + runtime type guard (WP-014B/018)
- Inline wound logic (escape wound pattern in `villainDeck.reveal.ts` lines 124-137)
- Drift-detection test for canonical array + union (WP-007A/009A/014A/021)
- Fail-closed handling (missing keywords = no effect, not crash)
- `for...of` loops, no `.reduce()` (project-wide convention)
- `// why:` comments on non-obvious behavior (code style rule 6)
- Safe-skip placeholder for data gaps (WP-023 precedent D-2302)

---

## Maintainability & Upgrade Readiness

- [x] **Extension seam exists:** `BoardKeyword` union + `BOARD_KEYWORDS` canonical
  array. Adding a new keyword (e.g., `'teleport'`) = add to union + array + add
  handler in `boardKeywords.logic.ts` + add case in reveal/fight integration. No
  refactoring required.
- [x] **Patch locality:** keyword logic localized to `boardKeywords.logic.ts` (pure
  helpers) + integration points in `fightVillain.ts` and `villainDeck.reveal.ts`.
  Bug fix = 1-2 files.
- [x] **Fail-safe behavior:** missing keywords = no effect. Guard check on
  non-existent card = `false`. Patrol modifier for non-Patrol card = `0`.
  Ambush check for non-Ambush card = `false`. No partial mutation.
- [x] **Deterministic reconstructability:** keyword behavior visible via
  `G.messages` entries and `G.cardKeywords` static lookup. No hidden state.
- [x] **Backward-compatible test surface:** `G.cardKeywords` will be `undefined`
  in pre-WP-025 test mocks. `fightVillain` and reveal pipeline must guard against
  `undefined` cardKeywords (default to empty = no keywords = no blocking/modifier).
- [x] **Semantic naming stability:** `BoardKeyword`, `BOARD_KEYWORDS`,
  `hasAmbush`, `isGuardBlocking`, `getPatrolModifier` — no MVP assumptions
  in names. `buildCardKeywords` follows established naming (`buildCardStats`,
  `buildVillainDeck`).

All PASS.

---

## Code Category Boundary Check

| File | Category | Imports | Mutations | Status |
|---|---|---|---|---|
| `boardKeywords.types.ts` | engine (types) | none | none | OK |
| `boardKeywords.logic.ts` | engine (pure helper) | no boardgame.io | no G mutation | OK |
| `buildCardKeywords.ts` | setup | no boardgame.io | none (returns data) | OK |
| `fightVillain.ts` | moves | boardgame.io (existing) | G mutation (existing) | OK |
| `villainDeck.reveal.ts` | moves | boardgame.io (existing) | G mutation (existing) | OK |
| `buildInitialGameState.ts` | setup | no boardgame.io (existing) | none (returns data) | OK |
| `types.ts` | engine (types) | none | none | OK |
| `index.ts` | engine (barrel) | re-exports | none | OK |
| `*.test.ts` | test | node:test, node:assert | none | OK |

No boundary violations.

---

## Scope Lock (Critical)

### WP-025 Is Allowed To

- Create: `src/board/boardKeywords.types.ts` — `BoardKeyword` union, `BOARD_KEYWORDS` array
- Create: `src/board/boardKeywords.logic.ts` — pure keyword helpers (no boardgame.io)
- Create: `src/setup/buildCardKeywords.ts` — setup-time keyword resolution
- Modify: `src/moves/fightVillain.ts` — add Guard blocking + Patrol cost modifier
  to step 1 validation
- Modify: `src/villainDeck/villainDeck.reveal.ts` — add Ambush check after City
  placement, call `gainWound` inline for each player
- Modify: `src/setup/buildInitialGameState.ts` — call `buildCardKeywords`, store in G
- Modify: `src/types.ts` — add `cardKeywords` field to `LegendaryGameState`
- Modify: `src/index.ts` — add exports
- Create: `src/board/boardKeywords.logic.test.ts` — unit tests (9 tests)
- Create: `src/board/boardKeywords.integration.test.ts` — integration tests (5 tests)
- Update: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md`, `docs/ai/ARCHITECTURE.md`,
  `docs/ai/work-packets/WORK_INDEX.md`

### WP-025 Is Explicitly Not Allowed To

- Modify `city.types.ts` (WP-015 immutable)
- Modify `ruleHooks.types.ts` (no new RuleEffect types)
- Modify `RULE_EFFECT_TYPES` or `RuleEffect` union
- Add new RuleEffect types
- Expand `CoreMoveName` / `CORE_MOVE_NAMES`
- Import `@legendary-arena/registry` in move or helper files
- Import `boardgame.io` in `boardKeywords.logic.ts` or `buildCardKeywords.ts`
- Use `.reduce()` anywhere
- Use `Math.random()`
- Add keyword stacking logic
- Add keyword interaction with hero abilities
- Add scheme-specific keyword modifications (WP-026)
- Add any UI, persistence, server, or database code
- Modify `makeMockCtx` or other shared test helpers

---

## Test Expectations (Locked)

- 9 new unit tests in `src/board/boardKeywords.logic.test.ts`
- 5 new integration tests in `src/board/boardKeywords.integration.test.ts`
- All 291 existing tests must continue to pass
- No existing test changes expected (no prior tests assert keyword behavior)
- Guard against `undefined` `G.cardKeywords` in new code integrated into
  existing moves (pre-WP-025 test mocks lack the field)
- No boardgame.io imports in test files
- No modifications to `makeMockCtx` or other shared test helpers
- Test files use `.test.ts` extension and `node:test` runner

---

## Mutation Boundary Confirmation

- [x] `G` mutations occur only inside move implementations (`fightVillain`,
  `revealVillainCard`) — framework-authorized
- [x] No mutation occurs in helpers (`boardKeywords.logic.ts` is pure)
- [x] Helpers return new values; moves assign results into G
  (e.g., `gainWound` returns `{woundsPile, playerDiscard}`, move assigns
  both back to G)
- [x] No mutation outside boardgame.io move context

All PASS.

---

## Risk & Ambiguity Review

### Risk 1 — Ambush RuleEffect Type Gap
- **Impact:** HIGH — wrong architecture for Ambush if not corrected
- **Mitigation:** WP correction required (see Finding 1). Use inline `gainWound`
  pattern, not RuleEffect pipeline. Locked for execution.
- **Decision:** Ambush wounds are inline (same as escape wounds). `hasAmbush()` boolean
  helper replaces `getAmbushEffects(): RuleEffect[]`.

### Risk 2 — Patrol/Guard Data Unavailability
- **Impact:** LOW — mechanics work, just no cards trigger them
- **Mitigation:** Safe-skip per WP-023 precedent. `buildCardKeywords` extracts
  Ambush from ability text. Patrol/Guard produce empty results. All tested with
  synthetic data. DECISIONS.md documents gap.
- **Decision:** Accepted. Mechanics are code-complete. Data classification is a
  future WP concern.

### Risk 3 — Ambush "each player" iteration
- **Impact:** LOW — needs explicit player iteration pattern
- **Mitigation:** Use `Object.keys(G.playerZones)` with `for...of` loop. Call
  `gainWound` for each player. Same pattern as existing wound logic but
  iterated. Locked for execution.
- **Decision:** Iterate `Object.keys(G.playerZones)`, call `gainWound` per player.

### Risk 4 — Pre-WP-025 test mock compatibility
- **Impact:** MEDIUM — existing test mocks lack `G.cardKeywords`
- **Mitigation:** Guard `G.cardKeywords` access with `?? {}` or optional chaining.
  If undefined, treat as no keywords (no Guard blocking, no Patrol modifier, no Ambush).
  This preserves all 291 existing tests.
- **Decision:** Defensive access pattern. Locked for execution.

### Risk 5 — `buildCardKeywords` registry parameter type
- **Impact:** LOW — minor convention mismatch
- **Mitigation:** WP correction to use `registry: unknown` with local structural
  interface per established convention.
- **Decision:** Follow `buildCardStats` pattern.

### Risk 6 — Ambush ability text parsing reliability
- **Impact:** LOW — "Ambush:" prefix is consistent across all 304 occurrences
- **Mitigation:** Simple `startsWith('Ambush')` check on ability strings. Robust
  against all observed data patterns. If edge cases exist, they produce false
  negatives (no Ambush = no effect = safe failure).
- **Decision:** Parse `"Ambush"` prefix from ability text. Locked for execution.

---

## Pre-Flight Verdict

### **READY TO EXECUTE** (conditional on WP corrections below)

WP-025 is properly sequenced (WP-024 complete), the repo is green (291/291 tests,
build clean), and all dependency contracts are verified against actual source code.
Layer boundaries are respected — keyword logic stays in the engine, no registry
imports in moves, no persistence. The extension seam (union + canonical array) follows
established patterns from WP-007A/009A/014A/021.

Three WP corrections are required before the session execution prompt can be generated:

1. **Scope B/E: Ambush architecture** — Replace `getAmbushEffects(): RuleEffect[]` +
   `applyRuleEffects` with `hasAmbush(): boolean` + inline `gainWound` per player.
   No `gainWound` RuleEffect type exists; inline wound logic matches the escape wound
   precedent in `villainDeck.reveal.ts`.

2. **Scope C: Registry parameter** — Change `registry: CardRegistry` to
   `registry: unknown` with local structural interface and runtime type guard per
   `buildCardStats` convention.

3. **Assumes section: Data availability clarification** — Note that Ambush is
   extractable from ability text, but Patrol and Guard have no data source (safe-skip
   pattern applies; mechanics dormant until data classification exists).

---

## Invocation Prompt Conformance Check

Completed 2026-04-13 against `docs/ai/invocations/session-wp025-board-keywords.md`.

- [x] All EC locked values copied verbatim (`BoardKeyword` union, `BOARD_KEYWORDS`,
  `G.cardKeywords`, MVP keyword effects table)
- [x] `hasAmbush` used throughout (not `getAmbushEffects`) — `getAmbushEffects` only
  appears in the "Do NOT" warning section as a forbidden pattern
- [x] Inline wound logic specified (not `applyRuleEffects`) in scope E
- [x] `registry: unknown` used (not `CardRegistry`) — `CardRegistry` only appears
  in structural interface `// why:` comments
- [x] Safe-skip documentation for Patrol/Guard data gap included in locked
  decisions and implementation tasks
- [x] File paths, extensions, and test locations match WP exactly
- [x] No forbidden imports introduced by wording changes
- [x] Contract names and field names match verified dependency code
- [x] Helper call patterns reflect actual signatures (pure helpers return values,
  moves assign into G)
- [x] No ambiguities resolved in prompt that were not resolved in pre-flight

---

## Authorized Next Step

Conditional authorization: apply the three WP corrections listed above, then
generate a session execution prompt saved as:
`docs/ai/invocations/session-wp025-board-keywords.md`

The session prompt must conform exactly to the scope, constraints, and decisions
locked by this pre-flight. No new scope may be introduced.

**Pre-session actions — ALL RESOLVED (2026-04-13):**

1. WP-025 scope B: Replaced `getAmbushEffects(): RuleEffect[]` with
   `hasAmbush(): boolean` — wound gain is inline, not RuleEffect pipeline
2. WP-025 scope E: Replaced `applyRuleEffects` with inline `gainWound` per
   player + `G.messages` for observability (escape wound precedent)
3. WP-025 scope C: Changed `registry: CardRegistry` to `registry: unknown`
   with local structural interface + runtime type guard (buildCardStats pattern)
4. WP-025 Assumes: Added keyword data availability clarification — Ambush
   extractable from ability text, Patrol/Guard have no data source (safe-skip)
5. EC-025: Updated Ambush guardrail and `// why:` requirements to reflect
   inline wound architecture and data availability gap
6. WP-025 scope H: Updated exports to use `hasAmbush` instead of `getAmbushEffects`
7. WP-025 unit tests: Updated test descriptions for `hasAmbush`
8. WP-025 Non-Negotiable Constraints: Updated Ambush timing note

All mandatory pre-session actions are complete. No re-run of pre-flight
required — these updates resolve risks identified by this pre-flight
without changing scope.
