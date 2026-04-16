# Pre-Flight Invocation — WP-033

**Target Work Packet:** `WP-033`
**Title:** Content Authoring Toolkit
**Previous WP Status:** WP-032 Complete (2026-04-15, commit bcd1671, pushed to origin/main)
**Pre-Flight Date:** 2026-04-16
**Invocation Stage:** Pre-Execution (Scope & Readiness)

**Work Packet Class:** Contract-Only (types/contracts/tests only)

Rationale: WP-033 introduces declarative author-facing schemas
(`content.schemas.ts`), pure validation functions (`validateContent`,
`validateContentBatch`), structured result types (`ContentValidationResult`,
`ContentValidationError`), and tests. No `G` mutation, no phase hooks, no
moves added, no `game.ts` modification, no boardgame.io imports. Runs as a
pre-engine gate — outside the boardgame.io lifecycle entirely.

---

## Pre-Flight Intent

Perform a pre-flight validation for WP-033.

- Not implementing.
- Not generating code.
- Validating readiness and constraints only.

If a blocking condition is found, pre-flight must return **NOT READY** and
stop.

---

## Authority Chain (Read)

1. `.claude/CLAUDE.md` — EC-mode rules, bug handling, commit discipline
2. `docs/ai/ARCHITECTURE.md` — Layer boundaries, engine vs framework rules
3. `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` — directory-to-category map
4. `docs/ai/execution-checklists/EC-033-content-toolkit.checklist.md`
5. `docs/ai/work-packets/WP-033-content-authoring-toolkit.md`
6. Prior WP artifacts: WP-021 (hero keyword/ability contracts),
   WP-025 (board keywords), WP-026 (scheme setup instructions),
   WP-030 (scenario definitions), WP-031 (invariants), WP-003
   (registry schemas — immutable)

---

## Dependency & Sequencing Check

| WP | Status | Notes |
|---|---|---|
| WP-031 | PASS | Complete; 358/94/0 (per D-3103); extended by WP-032 to 367/95/0 |
| WP-032 | PASS | Complete (2026-04-15, bcd1671); 367/95/0 baseline; does NOT directly block WP-033 |
| WP-021 | PASS | `HeroAbilityHook`, `HeroCondition`, `HeroEffectDescriptor` exported from `rules/heroAbility.types.ts`; `HERO_KEYWORDS`, `HERO_ABILITY_TIMINGS` exported from `rules/heroKeywords.ts` |
| WP-025 | PASS | `BoardKeyword`, `BOARD_KEYWORDS` exported from `board/boardKeywords.types.ts` |
| WP-026 | PASS | `SchemeSetupInstruction`, `SchemeSetupType`, `SCHEME_SETUP_TYPES` exported from `scheme/schemeSetup.types.ts` |
| WP-030 | PASS | `ScenarioDefinition`, `ScenarioOutcome`, `ScenarioOutcomeCondition` exported from `campaign/campaign.types.ts` (split `victoryConditions`/`failureConditions` shape) |
| WP-003 | PASS | `packages/registry/src/schema.ts` exists with `HeroCardSchema`, `MastermindCardSchema`, `MastermindSchema`, `VillainCardSchema`, `VillainGroupSchema`, `SchemeSchema`, `SetDataSchema` — immutable per `.claude/rules/registry.md` |

All prerequisites complete.

---

## Dependency Contract Verification

- [x] **HERO_KEYWORDS membership verified:** `rules/heroKeywords.ts:43`
  declares `HERO_KEYWORDS: readonly HeroKeyword[]` as a canonical closed
  union with drift-detection tests. WP-033 schemas must reference this array
  directly — no re-derivation.

- [x] **HERO_ABILITY_TIMINGS membership verified:** `rules/heroKeywords.ts:81`.
  Used by hook consistency checks (EC-033 Files to Produce §C).

- [x] **BOARD_KEYWORDS membership verified:** `board/boardKeywords.types.ts:24`
  declares `BoardKeyword = 'patrol' | 'ambush' | 'guard'` with `BOARD_KEYWORDS`
  canonical array. Matches WP-033 scope.

- [x] **HeroAbilityHook / HeroCondition / HeroEffectDescriptor verified:**
  `rules/heroAbility.types.ts:31,61,75` — all three interfaces exported.
  Hook consistency checks (§B point 4) will reference these shapes.

- [x] **SchemeSetupInstruction verified:** `scheme/schemeSetup.types.ts:32`
  with `type: SchemeSetupType` (closed union) and canonical
  `SCHEME_SETUP_TYPES` array at line 43. Scheme schema cross-reference check
  (§B point 3) must use `SCHEME_SETUP_TYPES`.

- [x] **ScenarioDefinition shape verified:**
  `campaign/campaign.types.ts:66` declares `ScenarioDefinition` with optional
  `victoryConditions?: ScenarioOutcomeCondition[]` and
  `failureConditions?: ScenarioOutcomeCondition[]` (the split-array shape
  locked during WP-030 pre-flight per D-3001 lessons). WP-033 Scenario
  schema §A must validate the split shape, NOT a single `conditions` array.
  WP-033 line "aligns with ScenarioDefinition from WP-030" — OK as stated,
  but see RS-4.

- [x] **RULE_TRIGGER_NAMES / RULE_EFFECT_TYPES verified:**
  `rules/ruleHooks.types.ts:37,145`. Available if schemas need to reference
  them (not strictly required by WP-033 scope, but enumerated in session
  context).

- [x] **Registry schema immutability verified:**
  `.claude/rules/registry.md` declares `schema.ts`, `shared.ts`,
  `localRegistry.ts` immutable. EC-033 explicitly forbids modifying
  `packages/registry/src/schema.ts` — compliant with registry rules. No
  tension.

- [x] **Registry schema field matrix — author-facing vs engine-facing
  divergence acknowledged:** Registry schemas are permissive due to real
  data quirks (e.g., `HeroCardSchema.name` is optional because `anni` cards
  have only `slug + imageUrl`; `HeroCardSchema.cost` is
  `string | number | optional` per D-1204). WP-033 author-facing schemas
  are explicitly STRICTER (required name, team, hc, cost, attack, recruit,
  abilities per WP-033 §A). This divergence is intentional — author-facing
  validation catches incomplete authoring; registry loader tolerates
  historical data. See RS-1.

- [x] **`makeMockCtx` not required:** WP-033 is pure validation; no
  boardgame.io context needed. Tests use `node:test` + `node:assert` with
  plain object fixtures.

- [x] **D-0601, D-0602, D-0603 verified:** Cited in session context as the
  decisions WP-033 implements. Verify during pre-session check that they
  exist with those exact IDs in DECISIONS.md (or adjust references with a
  title-first pattern per WP-026/D-2601 / WP-028 precedent). See RS-6.

- [x] **WP-033 file paths verified:**
  - `packages/game-engine/src/content/content.schemas.ts` — directory does
    NOT exist yet (new). See **PS-1 (BLOCKING).**
  - `packages/game-engine/src/content/content.validate.ts` — new
  - `packages/game-engine/src/content/content.validate.test.ts` — new
  - `packages/game-engine/src/types.ts` — exists; additive re-exports only
  - `packages/game-engine/src/index.ts` — exists; additive exports only

- [x] **Function signatures — cross-reference context gap identified:**
  WP-033 §B declares `validateContent(content: unknown, contentType:
  string): ContentValidationResult`. §B point 3 requires cross-reference
  checks: "alwaysLeads references valid villain groups". The two-argument
  signature cannot know which villain group slugs are valid without an
  external context. See RS-3.

- [x] **EC-033 vs WP-033 consistency check:** EC-033 restates locked
  values from WP-033 verbatim. Content types list matches. Result/Error
  shapes match. File list matches. Guardrails match. Consistent. EC is
  subordinate to WP; no conflicts.

- [x] **No new `CoreMoveName` / `CORE_MOVE_NAMES` expansion:** WP-033 does
  not add moves. N/A.

- [x] **No framework API workarounds required:** Validation is pure; no
  `boardgame.io` imports needed anywhere in scope.

- [x] **Decision ID search accounts for em-dashes:** Will grep with both
  `D-0601` and `D‑0601` variants during RS-6 resolution (P6-2 precedent).

No field-name drift between WP text and canonical source files for the
types confirmed above. Outstanding items are listed as Pre-Session Actions
(PS-#) and Risk Statements (RS-#) below.

---

## Input Data Traceability Check

- [x] All non-user-generated inputs consumed by this WP are listed in
  `docs/03.1-DATA-SOURCES.md`: **N/A — WP-033 does not consume registry
  data at runtime.** Validation operates on caller-supplied `unknown`
  content. Schemas reference engine constants (`HERO_KEYWORDS`,
  `BOARD_KEYWORDS`) which are code, not data.
- [x] Storage location known: **code-only** — schemas live in
  `packages/game-engine/src/content/content.schemas.ts`.
- [x] Debuggability: a validation error identifies `contentType`,
  `contentId`, `field`, `message` — fully traceable without external data.
- [x] No implicit data: schemas enumerate values from canonical arrays
  only (`HERO_KEYWORDS`, `BOARD_KEYWORDS`, `SCHEME_SETUP_TYPES`,
  `HERO_ABILITY_TIMINGS`). No hardcoded literals that originate from
  external datasets.
- [x] No setup-time derived fields — WP-033 adds none.

All YES.

---

## Structural Readiness Check (Types & Contracts)

- [x] All prior WPs compile and tests pass: **367 tests, 95 suites, 0 fail
  (verified 2026-04-16 via `pnpm --filter @legendary-arena/game-engine
  test`); `pnpm --filter @legendary-arena/game-engine build` exits 0.**
- [x] No known EC violations remain open.
- [x] Required types/contracts exist and are exported as referenced by
  WP-033 — see Dependency Contract Verification.
- [x] No naming conflicts: `ContentValidationResult` and
  `ContentValidationError` do not collide with any existing export
  (grep-verified: only `MoveError`, `MatchSetupError`, `ZoneValidationError`,
  `IntentValidationResult`, `IntentValidationError` exist today — all
  distinct domains).
- [x] No architectural boundary conflicts at contract level, **conditional
  on PS-1 resolution**.
- [x] N/A — no DB schema / migrations in this WP.
- [x] N/A — WP-033 does not depend on R2 data at runtime.
- [x] N/A — WP-033 does not read `G` fields.

All YES, conditional on PS-1.

---

## Code Category Boundary Check

- [ ] All new or modified files fall cleanly into one existing code
  category: **FAIL — `packages/game-engine/src/content/` is not listed in
  `docs/ai/REFERENCE/02-CODE-CATEGORIES.md`.** The `engine` category
  currently enumerates: rules, hero, economy, board, turn, state, scoring,
  mastermind, villainDeck, replay (D-2706), ui (D-2801), campaign (D-3001),
  invariants (D-3101), network (D-3201). Content is absent.
- [x] Each file's category would permit all imports and mutations it uses
  (pure validation, no boardgame.io, no registry runtime imports, no I/O) —
  matches the `engine` category definition.
- [x] No file blurs category boundaries.
- [x] The directory must be classified under `engine` before execution.
  Document in DECISIONS.md as **D-3301 — Content Directory Classified as
  Engine Code Category**. Matches the D-2706 / D-2801 / D-3001 / D-3101 /
  D-3201 template.

**Blocking finding:** **PS-1** below.

---

## Established Patterns (Reuse, Do Not Reinvent)

Patterns WP-033 must follow (established by prior WPs):

- **Data-only declarative contracts (D-0603 / D-1232):** Schemas are pure
  data (Zod-style or plain object descriptors). No closures, functions,
  or classes in schema declarations. Aligns with "Data-only contracts in
  G, handler functions in ImplementationMap outside G" and
  "Representation Before Execution."
- **Structured result pattern:** `{ valid: true } | { valid: false; errors:
  ContentValidationError[] }` mirrors WP-032's `IntentValidationResult`
  discriminated union and WP-027's `DeterminismResult`. Consistent with
  D-1208 (MatchSetupError shape: `{ field, message }`) — WP-033 adds
  `contentType` and `contentId` for multi-content batch traceability.
- **Never throw (Rule 11 + D-1226):** All validation returns structured
  results. Full-sentence error messages. No silent swallows.
- **`for...of` over `.reduce()` (code-style Rule 8):** Validation logic
  must accumulate errors via explicit `for...of` loops. Verification step
  §Step 4 enforces this.
- **Caller-injected dependency arrays (WP-032 / P6-20 pattern):** For
  cross-reference checks that need the set of valid villain-group slugs or
  mastermind tactic counts, inject the valid set as a parameter rather
  than importing registry runtime. See RS-3.
- **Local structural interface for external types (D-2801 / D-1209):**
  If the validator needs a read-only view of the registry catalog for
  cross-references, define a `ContentValidationContext` local interface
  (e.g., `{ readonly validVillainGroupSlugs: ReadonlySet<string>;
  readonly validMastermindSlugs: ReadonlySet<string> }`) and accept it as
  a parameter. No registry package import.
- **Drift-detection test pattern (WP-007A/009A/014A/021):** If WP-033
  introduces a new canonical array (e.g., `CONTENT_TYPES`), add a
  drift-detection test asserting the array matches its union exactly. May
  not be required for WP-033 if `contentType` remains a plain string
  parameter.
- **Contract-Only WP — 01.5 NOT INVOKED (WP-030 precedent):** Per Phase 6
  §32. The session prompt must include an explicit "01.5 not invoked"
  declaration listing the four criteria and marking them absent (no new
  `LegendaryGameState` field, no `buildInitialGameState` shape change, no
  new `LegendaryGame.moves` entry, no new phase hook). See RS-5.
- **Semantic naming stability (WP-028 precedent):** Export names must not
  encode MVP assumptions (`Simple`, `Temp`, `V1`) or implementation
  details. `validateContent`, `validateContentBatch`,
  `ContentValidationResult`, `ContentValidationError` are all
  semantically stable.

No deviations from established patterns required.

---

## Maintainability & Upgrade Readiness

- [x] **Extension seam exists:** A `contentType: string` parameter + a
  dispatch map (`switch` on content type or a registry of
  `(content) => ValidationResult` handlers) provides the extension seam.
  Future WPs add new content types by adding cases without refactoring.
  Same pattern as WP-023 condition evaluators.
- [x] **Patch locality:** A bug fix in hero validation is localized to the
  hero case in `content.validate.ts`. A schema tightening is localized to
  `content.schemas.ts`. No cross-cutting change required.
- [x] **Fail-safe behavior:** Structural failures produce `{ valid: false;
  errors: [...] }` — never throw, never partial-mutate (the validator does
  not mutate at all, by contract).
- [x] **Deterministic reconstructability:** Validation is pure —
  `(content, contentType) => result` is a total function of its inputs.
  No runtime state read, no logging side effects, no hidden mutation.
- [x] **Backward-compatible test surface:** Validation is new code; no
  existing test mocks interact with it. Defensive guards not required.
- [x] **Semantic naming stability:** See pattern note above.

All YES.

---

## Scope Lock

### WP-033 Is Allowed To

- Create `packages/game-engine/src/content/content.schemas.ts` — pure
  declarative schemas (no runtime code)
- Create `packages/game-engine/src/content/content.validate.ts` —
  `validateContent`, `validateContentBatch` pure functions
- Create `packages/game-engine/src/content/content.validate.test.ts` —
  9 tests per WP-033 §E (see RS-2 for suite/wrapping lock)
- Modify `packages/game-engine/src/types.ts` — **additive re-exports only**
  for `ContentValidationResult`, `ContentValidationError`
- Modify `packages/game-engine/src/index.ts` — **additive exports only** for
  `validateContent`, `validateContentBatch`, `ContentValidationResult`,
  `ContentValidationError`
- Update `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md`,
  `docs/ai/work-packets/WORK_INDEX.md` per EC-033 "After Completing"
- Read (not modify): `rules/heroKeywords.ts`, `rules/heroAbility.types.ts`,
  `board/boardKeywords.types.ts`, `scheme/schemeSetup.types.ts`,
  `campaign/campaign.types.ts`, `rules/ruleHooks.types.ts`,
  `packages/registry/src/schema.ts`

### WP-033 Is Explicitly Not Allowed To

- Modify `packages/registry/src/schema.ts` (immutable per
  `.claude/rules/registry.md` and EC-033 explicit prohibition)
- Modify any file in `packages/registry/` (layer boundary — content
  validation lives in game-engine per EC-033 "Files to Produce")
- Import `boardgame.io` anywhere in `src/content/`
- Import `@legendary-arena/registry` anywhere in `src/content/` (engine
  category rule; use local structural interface + caller injection
  instead per D-2801 / D-1209 / WP-032 P6-20 precedent)
- Use `.reduce()` in validation logic (Rule 8)
- Use `require()` anywhere (ESM-only; Rule 13)
- Use `Math.random()`, `Date.now()`, or any randomness/time (pure
  validation)
- Throw from `validateContent` or `validateContentBatch` (structured
  result only — never throw)
- Add runtime code to schemas (schemas are declarative data)
- Invoke the 01.5 runtime-wiring allowance (Contract-Only WP; see RS-5)
- Touch `buildInitialGameState`, `game.ts`, `LegendaryGameState`, any
  move, any phase hook (01.5 criteria — all absent)
- Create a new directory besides `src/content/` (PS-1 classifies only
  that one)
- Expand `CoreMoveName` / `CORE_MOVE_NAMES` (N/A — no moves)
- Add files outside the five listed in EC-033 "Files to Produce"

**Rule:** Anything not explicitly allowed is out of scope.

---

## Test Expectations (Locked Before Execution)

- **New tests:** 9 in `packages/game-engine/src/content/content.validate.test.ts`
  per WP-033 §E:
  1. Valid hero card passes validation
  2. Hero card missing required field: fails with specific error
  3. Hero card with invalid keyword: fails with enum error
  4. Valid mastermind with tactics passes
  5. Mastermind with no tactic cards: fails
  6. Scheme with invalid setup instruction type: fails
  7. Cross-reference check: alwaysLeads referencing non-existent group: fails
  8. Batch validation aggregates errors from multiple items
  9. All error messages are full sentences (pattern check)
- **Existing test baseline:** all 367 existing tests must continue to pass
  unchanged. No structural assertion updates expected.
- **Expected final count:** 367 + 9 = **376 tests**.
- **Suite wrapping lock:** all 9 tests wrapped inside **one**
  `describe('validateContent / validateContentBatch (WP-033)')` block,
  producing **376 tests / 96 suites / 0 fail**. (WP-031 precedent P6-19:
  bare `test()` calls do not register as suites in `node:test`;
  explicit wrapping prevents 376/95 ambiguity.) See RS-2.
- **Test boundaries:**
  - No `boardgame.io` imports in test files.
  - No modifications to `makeMockCtx` or other shared test helpers.
  - No `boardgame.io/testing` imports.
  - No logic changes to any of the 367 existing tests.
  - Tests use `node:test` + `node:assert` only.
- **Defensive guards:** N/A — WP-033 introduces no `G` fields; no legacy
  mocks touched.

---

## Risk & Ambiguity Review (Resolve Now, Lock for Execution)

### PS-1 (BLOCKING) — Content directory requires code-category classification

- **Risk:** `packages/game-engine/src/content/` is a new directory with no
  entry in `02-CODE-CATEGORIES.md` and no DECISIONS.md classification.
  This matches the Phase 6 recurring pattern: D-2706 (replay), D-2801
  (ui), D-3001 (campaign), D-3101 (invariants), D-3201 (network).
- **Impact:** High (execution risk). Starting execution without
  classification establishes an unclassified directory precedent that
  drifts from the category model. The copilot check and pre-commit
  review will flag this.
- **Mitigation:** Create `D-3301 — Content Directory Classified as Engine
  Code Category` in DECISIONS.md before the session prompt is generated.
  Use the D-3201 template verbatim (Status: Immutable, cites purity, no
  I/O, no `boardgame.io` / no registry imports, follows all engine
  category rules). Update
  `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` §engine "Directories" list to
  append `packages/game-engine/src/content/ (D-3301)`.
- **Decision locked:** `src/content/` is classified under the `engine`
  code category.

### PS-2 (pre-session) — EC-033 signature back-sync

- **Risk:** EC-033 locks `ContentValidationError` shape as `{ contentType:
  string; contentId: string; field: string; message: string }`. WP-033 §B
  specifies `validateContent(content: unknown, contentType: string):
  ContentValidationResult`. Cross-reference checks (§B point 3) cannot be
  performed with only these two parameters — no way to know which villain
  group slugs / mastermind slugs are valid without a context set. See RS-3
  for resolution pattern.
- **Impact:** Medium (execution risk). Without resolving the signature
  gap during pre-flight, the executor discovers mid-implementation that
  either (a) cross-reference checks must be dropped from scope or (b)
  the signature must be widened with a `ContentValidationContext`
  parameter not listed in locked values.
- **Mitigation:** Lock the signature shape during pre-flight (RS-3) and
  back-sync the WP text + EC locked values before the session prompt is
  generated. Precedent: WP-030 `evaluateScenarioOutcome` split
  `victoryConditions`/`failureConditions` signature lock (P6-27 / §32).

### RS-1 — Author-facing vs registry-facing schema divergence

- **Risk:** Registry schemas (`packages/registry/src/schema.ts`) are
  intentionally permissive for real data quirks (e.g.,
  `HeroCardSchema.name` optional; `cost` accepts `string|number|optional`
  per D-1204; `attack`/`recruit` nullable/optional). WP-033 §A declares
  author-facing hero schemas require `name, slug, team, hc, cost, attack,
  recruit, abilities`. The divergence is intentional (author-facing is
  strict; registry is permissive for historical data), but the WP does
  not explicitly state this.
- **Impact:** Medium (execution risk). Without an explicit note, the
  executor may misinterpret the WP as wanting registry-identical schemas
  and produce permissive author-facing validators that don't catch
  authoring errors.
- **Mitigation:** Lock the guidance in the session prompt:
  *"WP-033 author-facing schemas are deliberately STRICTER than registry
  schemas. Registry schemas tolerate historical data quirks (per D-1204,
  D-1227, comments in schema.ts). Author-facing schemas catch incomplete
  authoring for NEW content — required fields, canonical enum values,
  no null for fields that authors must fill in. Do not relax WP-033
  §A requirements to match registry permissiveness."*
- **Decision locked:** Author-facing schemas are stricter than registry
  schemas by design. `content.schemas.ts` must not import from
  `packages/registry/src/schema.ts`.

### RS-2 — Test suite-wrapping lock

- **Risk:** WP-033 and EC-033 lock test count (9) but not suite count.
  WP-031 P6-19 precedent: bare `test()` calls don't register as suites in
  `node:test` — this was discovered mid-execution. Without a lock, the
  executor may produce 376/95 (bare tests) or 376/96 (one describe) or
  376/more (multiple describes), creating baseline ambiguity for WP-034.
- **Impact:** Low (governance only) — reversible but annoying.
- **Mitigation:** Lock to **one `describe('validateContent /
  validateContentBatch (WP-033)')` block wrapping all 9 tests. Final
  baseline = 376/96/0.** Document in session prompt Test Expectations.

### RS-3 — Cross-reference check signature gap

- **Risk:** WP-033 §B point 3 requires cross-reference checks
  ("alwaysLeads references valid villain groups") but the two-parameter
  signature `validateContent(content, contentType)` cannot know which
  groups are valid. Options:
  - (A) Drop cross-reference checks from scope — narrows WP-033 to
    within-content checks only (structural + enum + hook consistency).
    Renames test 7 to an within-content equivalent (e.g., mastermind
    missing `alwaysLeads` field).
  - (B) Widen signature to
    `validateContent(content, contentType, context?)` where `context` is
    a `ContentValidationContext` local interface with optional sets of
    valid slugs. When `context` is absent, skip cross-reference checks.
    Test 7 supplies a synthetic context.
  - (C) Require `validateContentBatch` as the only API for cross-reference
    checks — within a batch, the validator derives the set of valid
    slugs from the batch contents themselves. Test 7 becomes a batch
    test.
- **Impact:** Medium (execution risk). Without resolution, the executor
  is forced to invent one of these at implementation time without
  pre-flight authorization.
- **Selected:** Option B — Caller-Injected Validation Context
- **Mitigation:** Lock Option B. Pattern matches WP-032 P6-20
  (`validMoveNames: readonly string[]` injected) and D-2801 (local
  structural interface for framework ctx subset). The context parameter
  is `readonly` and optional; absence means "skip cross-reference
  checks." Back-sync WP-033 §B and EC-033 Locked Values to reflect the
  three-parameter signature.
- **Decision locked:** Option B. Signature becomes
  `validateContent(content: unknown, contentType: string,
  context?: ContentValidationContext): ContentValidationResult`.
  `ContentValidationContext` is a local structural interface:
  ```ts
  interface ContentValidationContext {
    readonly validVillainGroupSlugs?: ReadonlySet<string>
    readonly validMastermindSlugs?: ReadonlySet<string>
    readonly validSchemeSlugs?: ReadonlySet<string>
    readonly validHeroSlugs?: ReadonlySet<string>
  }
  ```
  `validateContentBatch(items: { content: unknown; contentType: string }[],
  context?: ContentValidationContext): ContentValidationResult` — same
  optional context. When absent, cross-reference checks are skipped
  silently (no error for absent reference data). The `ContentValidationContext`
  type is a companion type (WP-027 precedent) and must be added to
  EC-033 Locked Values during back-sync.

### RS-4 — ScenarioDefinition shape locked split

- **Risk:** WP-033 §A line "Scenario schema: aligns with
  `ScenarioDefinition` from WP-030." If the executor reads only WP-033
  and not campaign.types.ts, they may assume a single `conditions` array
  instead of the split `victoryConditions`/`failureConditions` shape
  (WP-030 P6-27 corrected the spec but an older mental model may drift).
- **Impact:** Low (governance only) — easily caught by type check but worth locking.
- **Mitigation:** Session prompt must cite the exact shape:
  `ScenarioDefinition` has `victoryConditions?: ScenarioOutcomeCondition[]`
  and `failureConditions?: ScenarioOutcomeCondition[]` — NOT `conditions`.
  `ScenarioOutcomeCondition` is a discriminated union at
  `campaign/campaign.types.ts:41` that content validators must reference
  for structural checks.
- **Decision locked:** Scenario schema validates the split
  `victoryConditions` / `failureConditions` shape.

### RS-5 — 01.5 runtime-wiring allowance NOT INVOKED

- **Risk:** Per WP-030 / P6-28 precedent, purely additive Contract-Only
  WPs must explicitly declare 01.5 not invoked in the session prompt.
  Without the explicit declaration, the executor may silently invoke the
  allowance as a loophole to touch off-allowlist files.
- **Impact:** Low (governance only) — flagged.
- **Mitigation:** Session prompt must include an explicit "§01.5 NOT
  INVOKED" section enumerating the four criteria and marking each absent:
  - No new `LegendaryGameState` field
  - No `buildInitialGameState` shape change
  - No new `LegendaryGame.moves` entry
  - No new phase hook
  Session prompt must also cite
  `01.5-runtime-wiring-allowance.md §Escalation`: *"It may not be cited
  retroactively in execution summaries or pre-commit reviews to justify
  undeclared changes."*
- **Decision locked:** 01.5 is not invoked. If the executor encounters
  an unanticipated structural break, they must stop and escalate.

### RS-6 — Decision ID references D-0601, D-0602, D-0603 must be verified

- **Risk:** WP-033 cites D-0601, D-0602, D-0603 as the decisions it
  implements. Per WP-026 / D-2601 / P6-9 precedent, referenced decision
  IDs may not exist yet. Grep must account for em-dash encoding (P6-2).
  `0274ac4` commit has been applied since WP-032, so numbering conventions
  may have shifted.
- **Impact:** Low (governance only). If decisions exist, no action. If
  they don't, either (a) create them during pre-session or (b) adopt
  title-first references.
- **Mitigation:** Pre-session action — grep DECISIONS.md for both
  `D-0601` / `D‑0601` (and 0602, 0603). If absent, either create them
  or convert EC-033 / WP-033 references to title-first (e.g., "Content
  Is Data, Not Code" decision).
- **Verification command:**
  ```pwsh
  Select-String -Path docs/ai/DECISIONS.md -Pattern "D[-‑]0601|D[-‑]0602|D[-‑]0603"
  ```
- **Decision locked:** Pre-session step runs before session prompt is
  generated. Result logged in Authorized Next Step.

### RS-7 — Henchmen schema source data gap (WP-026 precedent)

- **Risk:** `SetDataSchema.henchmen: z.array(z.unknown())` — henchmen are
  untyped in the registry. Per WP-014B / D-1410–D-1413, henchmen are
  "virtual cards" with ext_id format `henchman-{slug}-{NN}` that exist
  only in `G`, not the registry. WP-033 EC-033 locked values list
  "Henchmen" as a content type requiring a schema. But there is no
  registry precedent for what author-facing henchman content would look
  like.
- **Impact:** Medium (execution risk). Without pre-flight clarification,
  executor may invent a henchman schema shape with no data grounding
  (WP-026 precedent: "Scheme card data includes setup instruction
  metadata" was false — resolved by converting to safe-skip per D-2601).
- **Mitigation:** One of:
  - (A) Apply safe-skip (WP-026 / D-2601 pattern): ship a henchman
    schema with placeholder minimal shape (`{ name, slug, vp?, vAttack?
    }`) that mirrors `VillainCardSchema` — the closest registry analog —
    and document the gap in DECISIONS.md.
  - (B) Remove henchmen from WP-033 scope and defer to a future WP.
- **Mitigation (locked):** **Option A.** Henchman author-facing schema
  mirrors `VillainCardSchema`'s mandatory fields (name, slug, vp,
  vAttack, abilities) as a conservative starting point. A `// why:`
  comment notes that henchmen are virtual cards (per D-1410) and this
  schema covers the authoring fields only; runtime uses virtual ext_ids.
  Document in DECISIONS.md as part of D-3301 or as a companion decision.
- **Decision locked:** Henchman schema mirrors VillainCard shape for MVP.
  Gap documented.

### RS-8 — "Teams" enum has no canonical union

- **Risk:** WP-033 §A line: *"Schemas define allowed enums: hero keywords
  from `HERO_KEYWORDS`, board keywords from `BOARD_KEYWORDS`, hero
  classes, teams."* `HeroClassSchema` exists in `packages/registry/src/
  schema.ts`, but `team: z.string()` is a free-form string in
  `HeroSchema` — no canonical union exists in the engine or registry.
  Team names are data-driven across 40 sets (avengers, x-men, shield,
  etc.).
- **Impact:** Medium (execution risk). If the executor invents a
  `TEAMS` canonical union, it may not match the actual data, causing
  false-positive rejections (WP-023 D-2304 string-literal drift
  precedent).
- **Mitigation:** Author-facing team validation is **type check only**
  (must be non-empty string), not enum check, for MVP. Canonical teams
  union is deferred to a future WP that derives the union from registry
  data. Hero classes use `HeroClassSchema` (already canonical).
  `// why:` comment on team validation explaining the deferral.
- **Decision locked:** Team is validated as non-empty string; no enum
  check in MVP. Hero classes enum-checked against `HeroClassSchema`
  values (or a local re-declaration if importing the registry schema
  violates layer boundary — use the local re-declaration pattern).

### RS-9 — Hero class enum source crosses layer boundary

- **Risk:** `HeroClassSchema` lives in
  `packages/registry/src/schema.ts`. Importing it into
  `packages/game-engine/src/content/` would violate the engine layer
  boundary (engine cannot depend on registry per
  `02-CODE-CATEGORIES.md` and `.claude/rules/architecture.md`).
- **Impact:** Medium (execution risk). Without pre-flight clarification,
  executor may either (a) add a forbidden import, or (b) silently skip
  hero class validation.
- **Mitigation:** Re-declare the hero class canonical array locally in
  `packages/game-engine/src/content/content.schemas.ts` as
  `HERO_CLASSES: readonly string[] = ['tech', 'covert', 'strength',
  'ranged', 'instinct']` (the five canonical Legendary classes). Add a
  `// why:` comment that this mirrors `HeroClassSchema` in the registry
  and a drift-detection test must verify they match at build time
  (WP-007A / D-1244 pattern). OR, keep the check to "non-empty string"
  if the executor prefers to defer the enum to a future WP with the
  drift test. Lock the choice in session prompt.
- **Decision locked:** Re-declare `HERO_CLASSES` locally in
  `content.schemas.ts`. NO drift-detection test against registry schema
  for MVP (the registry schema is the loader's concern, not the engine's
  — the re-declaration is the engine's canonical source for content
  validation).

---

## Pre-Flight Verdict

**DO NOT EXECUTE YET**

**Blocking rationale:**

1. **PS-1 (BLOCKING):** `packages/game-engine/src/content/` is a new
   engine subdirectory that is not classified in
   `02-CODE-CATEGORIES.md`. Executing without classification would
   violate the Phase 6 code-category model and establish a
   precedent-breaking unclassified directory.
2. **PS-2 (pre-session required):** WP-033 requires cross-reference
   validation (§B point 3), but the currently stated two-parameter
   `validateContent(content, contentType)` signature cannot support those
   checks. The validator signature must be back-synced to the locked
   three-parameter form (RS-3 Option B) before a session prompt is
   generated.

All other risks (RS-1 through RS-9) are explicitly resolved and locked.
Once PS-1 and PS-2 are completed, the verdict converts to
**READY TO EXECUTE** without re-running pre-flight.

---

## Invocation Prompt Conformance Check (Pre-Generation)

Gated on PS-1 + PS-2 resolution. When those complete, confirm:

- [ ] All EC-033 locked values (including updated
  `ContentValidationContext` and three-parameter `validateContent`
  signature from RS-3) are copied verbatim into the session prompt
- [ ] No new keywords, helpers, file paths, or timing rules appear only
  in the session prompt
- [ ] File paths and test locations match WP-033 + EC-033 exactly
- [ ] No forbidden imports introduced by wording changes
- [ ] The session prompt does not resolve ambiguities that were not
  resolved in this pre-flight (RS-1..RS-9 must all be cited as locked
  decisions, not re-derived)
- [ ] Contract names (HERO_KEYWORDS, BOARD_KEYWORDS,
  SCHEME_SETUP_TYPES, HERO_ABILITY_TIMINGS,
  HERO_CLASSES) and field names match the verified dependency code
- [ ] Session prompt explicitly declares "§01.5 NOT INVOKED" (RS-5)
- [ ] Session prompt explicitly calls out test suite wrapping:
  376 tests / 96 suites / 0 fail (RS-2)
- [ ] Session prompt explicitly cites that `packages/registry/src/
  schema.ts` is immutable and not on the allowlist

---

## Authorized Next Step (Conditional)

Upon completion of **PS-1** and **PS-2**:

> You are authorized to generate the session execution prompt for **WP-033**
> and save it as
> `docs/ai/invocations/session-wp033-content-toolkit.md`.

### Guardrails (Must Be Enforced in Session Prompt)

- All resolved risks **RS-1 … RS-9** must be cited as **locked decisions**,
  not re-derived.
- §01.5 runtime-wiring allowance must be explicitly declared
  **NOT INVOKED** (criteria: no new `LegendaryGameState` field, no
  `buildInitialGameState` shape change, no new `LegendaryGame.moves`
  entry, no new phase hook — all absent).
- Test expectations must be restated verbatim:
  **376 tests / 96 suites / 0 fail** with a single
  `describe('validateContent / validateContentBatch (WP-033)')` wrapper
  (RS-2).
- `packages/registry/src/schema.ts` must be cited as **immutable** and
  explicitly excluded from the allowlist.
- WP-033 §B and EC-033 Locked Values must reflect the
  three-parameter validator signature and include
  `ContentValidationContext` as a companion type (PS-2 follow-through).
- No new scope, helpers, file paths, or canonical arrays may be
  introduced beyond those listed in EC-033 Files to Produce.

### Pre-Session Actions

```
**Pre-session actions — RESOLVED (2026-04-16):**

1. PS-1 (BLOCKING) — RESOLVED. D-3301 appended to DECISIONS.md after
   D-3201, using the D-3201 template verbatim (Decision / Rationale /
   Affected WPs / Introduced / Status fields).

2. PS-1 (BLOCKING) — RESOLVED. Appended
   `packages/game-engine/src/content/ (D-3301)` to
   `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` §engine "Directories"
   inline comma-separated list.

3. PS-2 — RESOLVED. WP-033 §B rewritten to the three-parameter
   `validateContent(content, contentType, context?)` signature;
   `validateContentBatch` parallel update; `ContentValidationContext`
   defined inline in §B and added to §Locked contract values.
   §C / §D re-export / export lists updated to include
   `ContentValidationContext`. §E test 7 rewritten to assert both
   failure with context and pass when context is omitted. EC-033
   Locked Values extended with the three-parameter signatures and
   `ContentValidationContext` shape. EC-033 Common Failure Smells
   extended with two new bullets (absent-context-is-not-error; no
   registry import for context population).

4. RS-6 — RESOLVED. Verified D-0601 (Content Is Data, Not Code),
   D-0602 (Invalid Content Cannot Reach Runtime), and D-0603
   (Representation Before Execution) all exist in DECISIONS.md at
   lines 172 / 180 / 188. They use em-dash IDs (`D‑0601` etc.) per
   P6-2 DECISIONS.md encoding convention. WP-033 / EC-033 references
   use regular-hyphen IDs which is the established cross-artifact
   pattern and does not require adjustment.

5. RS-7 — RESOLVED. D-3302 (Henchman Author-Facing Schema Mirrors
   VillainCard Shape) appended to DECISIONS.md after D-3301. Locks
   the henchman schema to the VillainCard-mirroring shape (name,
   slug, vp, vAttack, abilities) as a conservative MVP starting
   point, citing D-1410..D-1413 (virtual cards) and the WP-025 /
   WP-026 safe-extension precedent. Status: Immutable until
   superseded by a dedicated henchman authoring WP.

6. RS-8 / RS-9 — No DECISIONS.md entry required; both locks are
   session-prompt content only (team = non-empty string, HERO_CLASSES
   local re-declaration without drift test).

All six pre-session actions are RESOLVED. Proceed to step 1b
(copilot check per 01.7) or, if the copilot check is waived, to
step 2 (session-prompt generation).
```

**Verdict update:** All pre-session actions (PS-1, PS-2, RS-6, RS-7)
are resolved. Verdict: **READY TO EXECUTE.** Session-prompt generation
authorized per §Authorized Next Step.

If new blocking conditions appear during copilot check (step 1b),
**DO NOT EXECUTE**. Escalate.

---

## Final Instruction

Pre-flight exists to prevent premature execution and scope drift.

There is uncertainty around the signature of `validateContent` (RS-3) and
the code category classification of `src/content/` (PS-1). Both are
resolvable with small, well-precedented pre-session actions (D-3301
follows D-3201; three-parameter signature follows WP-032 P6-20 pattern).

Once those actions are applied, the WP is ready for execution under
EC-mode. No re-run of pre-flight is required — these updates resolve
identified risks without changing the overall scope (additive types,
pure validation, no runtime changes, no `G` mutation).

**Current verdict: DO NOT EXECUTE YET.** After PS-1 + PS-2: READY.
