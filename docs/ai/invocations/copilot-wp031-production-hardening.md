# Copilot Check — WP-031 Production Hardening & Engine Invariants

**Date:** 2026-04-15
**Pre-flight verdict under review:** READY TO EXECUTE (2026-04-15, conditional on PS-1 + PS-2 — both resolved 2026-04-15 via `D-3101` and `D-3102`)
**Inputs reviewed:**
- EC: [docs/ai/execution-checklists/EC-031-production-hardening.checklist.md](docs/ai/execution-checklists/EC-031-production-hardening.checklist.md)
- WP: [docs/ai/work-packets/WP-031-production-hardening-engine-invariants.md](docs/ai/work-packets/WP-031-production-hardening-engine-invariants.md)
- Pre-flight: [docs/ai/invocations/preflight-wp031-production-hardening.md](docs/ai/invocations/preflight-wp031-production-hardening.md)
- Pre-session decisions: [D-3101](docs/ai/DECISIONS.md:3090) + [D-3102](docs/ai/DECISIONS.md:3134)

**Reviewer anchors loaded:** `ARCHITECTURE.md`, `.claude/rules/architecture.md`, `.claude/rules/code-style.md`, `.claude/rules/work-packets.md`, `.claude/rules/game-engine.md`, `DECISIONS.md`, `02-CODE-CATEGORIES.md`, `00.2-data-requirements.md`, `00.6-code-style.md`.

---

## Overall Judgment

**HOLD** → **CONFIRM** after two scope-neutral FIXes are applied in place (see §Applied In-Place Fixes below).

Scanned all 30 issues. **28 PASS, 2 RISK**. Neither RISK would cause architectural or determinism damage if execution proceeded, but both are preventable and cheap to lock before code exists. The two RISKs are in Category 2 (Determinism: iteration order for `Record<string, …>` scans) and Category 4 (Contract Integrity: missing canonical `INVARIANT_CATEGORIES` drift-detection array). Both fit Legendary Arena's established patterns (`for...of Object.keys(...).sort()` for deterministic iteration; canonical array + union drift-detection tests across `MATCH_PHASES`, `TURN_STAGES`, `REVEALED_CARD_TYPES`, `BOARD_KEYWORDS`, `SCHEME_SETUP_TYPES`, `PERSISTENCE_CLASSES`). FIXes are applied to the pre-flight's Authorized Next Step / Invocation Prompt Conformance sections below — no pre-flight re-run required, scope unchanged.

---

## Findings

### Category 1 — Separation of Concerns & Boundaries

**1. Engine vs UI / App Boundary Drift — PASS**
WP-031 §Non-Negotiable Constraints bans `boardgame.io` imports in `src/invariants/`. EC-031 verification step 3 enforces it via `Select-String`. D-3101 classifies the directory as engine category and explicitly cites "does not import boardgame.io or registry packages". WP §Out of Scope forbids UI / server / persistence changes. Runtime wiring is confined to `game.ts` (already a framework-boundary file) via `runAllInvariantChecks` import only.

**9. UI Re-implements or Re-interprets Engine Logic — PASS**
WP-031 does not touch UI. Security/Visibility invariant checks (the only UI-adjacent category) are explicitly deferred in WP §Out of Scope. Pre-flight §Maintainability notes the 5th category slot is reserved for future extension — no UI logic is replicated in WP-031.

**16. Lifecycle Wiring Creep — PASS**
Pre-flight RS-3 → D-3102 locks Option B (setup-only wiring). Per-move wiring is deferred to a follow-up WP. Pre-flight §Scope Lock "Not Allowed" list explicitly forbids wiring individual check functions into any lifecycle position other than `runAllInvariantChecks` in `game.ts` setup return. 01.5 IS INVOKED with enumerated files (`game.ts`, `types.ts`, `index.ts`) — no freestyle wiring permitted.

**29. Assumptions Leaking Across Layers — PASS**
Pre-flight RS-2 locks local structural `InvariantCheckContext` interface (following WP-028 `UIBuildContext` D-2801 precedent) so `src/invariants/` never imports `boardgame.io` `Ctx`. The wiring site in `game.ts` is the sole place ctx fields are read and adapted. One-directional knowledge preserved: engine → invariants (data), invariants → engine (types only).

---

### Category 2 — Determinism & Reproducibility

**2. Non-Determinism Introduced by Convenience — PASS**
WP §Non-Negotiable Constraints: "invariant checks involve no randomness". Check functions are pure reads of `G`; no time, no I/O, no environment access. `assertInvariant` throws synchronously. `checkSerializationRoundtrip` uses `JSON.stringify` / `JSON.parse` which are deterministic per ECMAScript spec for JSON-valid objects.

**8. No Single Debugging Truth Artifact — PASS**
Replay remains the canonical debugging truth (D-0201, D-2702). `InvariantViolationError` carries `category + message` so a post-mortem inspection of a thrown error reconstructs the failure without logs. Pre-flight §Maintainability §Deterministic reconstructability locks this.

**23. Lack of Deterministic Ordering Guarantees — RISK**
Several check functions will scan `Record<string, …>` values: `checkZoneArrayTypes(G)` iterates `G.playerZones`; `checkCountersAreFinite(G)` and `checkCountersUseConstants(G)` iterate `G.counters`; `checkNoCardInMultipleZones(G)` iterates zones across all players; `checkZoneCountsNonNegative(G)` similarly; `checkNoFunctionsInG(G)` performs a deep scan. Because `runAllInvariantChecks` fails fast on the **first** violation, non-deterministic iteration order over `Object.keys(...)` could make the error message identify a different offending key on different runs against the same broken `G`. That breaks determinism of the diagnostic, even though the throw/pass outcome is stable.

ECMAScript `Object.keys()` iteration order is well-defined for string keys (insertion order), but insertion order in a `Record<string, …>` built across multiple moves is not stable across replay variants — a playerZones record built from `{ '0': …, '1': … }` is fine, but zone-level records and counter maps grow dynamically.

> **FIX (scope-neutral):** Session prompt must lock deterministic iteration for every check function that scans a `Record<string, …>` and may throw on a specific key: iterate `Object.keys(record).sort()` (or an equivalent explicit sort) before applying check logic. This guarantees that given a broken `G`, every run identifies the same offending key in the error message. Add a one-line `// why:` comment citing "deterministic error reproducibility" at each sort site. This is purely additive to the existing locked check list — no new functions, no new tests. Applies to: `checkZoneArrayTypes`, `checkCountersAreFinite`, `checkCountersUseConstants`, `checkNoCardInMultipleZones`, `checkZoneCountsNonNegative`, `checkNoFunctionsInG`.

---

### Category 3 — Immutability & Mutation Discipline

**3. Confusion Between Pure Functions and Immer Mutation — PASS**
EC §Guardrails: "All check functions are pure — read G, return boolean or throw, no I/O, no mutations". WP §Non-Negotiable Constraints reinforces. `runAllInvariantChecks` returns `void` and contains no Immer draft handling — it's called outside the move lifecycle (setup return). No mutation confusion is possible.

**17. Hidden Mutation via Aliasing — PASS**
Pre-flight §Dependency Contract Verification: "Projection aliasing — N/A. runAllInvariantChecks returns void. No derived projections, no returned references to mutable G fields." Check functions return void or throw; no object returns at all. Aliasing risk cannot materialize.

---

### Category 4 — Type Safety & Contract Integrity

**4. Contract Drift Between Types, Tests, and Runtime — RISK**
WP-031 defines `InvariantCategory` as a 5-value string union but does **not** define a canonical readonly array `INVARIANT_CATEGORIES` and does **not** require a drift-detection test asserting the array matches the union type. This breaks the precedent established by WP-007A (`MATCH_PHASES`, `TURN_STAGES`), WP-009A (`RULE_TRIGGER_NAMES`, `RULE_EFFECT_TYPES`), WP-014A (`REVEALED_CARD_TYPES`), WP-021 (`HERO_KEYWORDS`), WP-025 (`BOARD_KEYWORDS`), WP-026 (`SCHEME_SETUP_TYPES`), WP-013 (`PERSISTENCE_CLASSES`) — every major union added to the engine has a matching canonical array with a dedicated drift-detection test. `.claude/rules/code-style.md §Drift Detection` codifies this as an Invariant: "Adding a new phase, stage, move, trigger, effect, or card type requires updating BOTH" — the phrase "or card type" generalizes to any closed union that lives in the engine's public API surface. `InvariantCategory` fits the pattern.

Without a canonical array, a future WP could add `'performance'` as a 6th category in the union and forget to update downstream consumers (orchestrator, tests, EC locked values). The drift would be silent until a specific code path happened to construct a violation of the new category.

> **FIX (scope-neutral):** Session prompt must lock:
>
> 1. `invariants.types.ts` exports a canonical readonly array immediately below the `InvariantCategory` union:
>    ```ts
>    export const INVARIANT_CATEGORIES: readonly InvariantCategory[] = [
>      'structural',
>      'gameRules',
>      'determinism',
>      'security',
>      'lifecycle',
>    ] as const;
>    ```
> 2. Drift-detection assertion is **folded into Test 1** ("Valid `G` passes all invariant checks") as a `assert.deepStrictEqual(INVARIANT_CATEGORIES, ['structural', 'gameRules', 'determinism', 'security', 'lifecycle'])` pre-assertion. This keeps the test count at 10 (preserving the locked baseline 348 → 358) while adding the drift-detection safety net. The combined test becomes "contract: array matches union AND valid `G` passes all checks".
> 3. Pre-flight §Scope Lock adds `INVARIANT_CATEGORIES` to the "Allowed to create" list in `invariants.types.ts`.
> 4. `types.ts` and `index.ts` re-export the canonical array alongside the `InvariantCategory` type.
>
> This is purely additive (one new const, one `assert.deepStrictEqual` call, two re-export lines). Test count unchanged. Scope lock unchanged in intent — the new const is a natural consequence of the existing union lock.

**5. Optional Field Ambiguity (`exactOptionalPropertyTypes`) — PASS**
`InvariantViolation` has `context?: Record<string, unknown>` and `InvariantCheckContext` has `readonly phase?: string; readonly turn?: number`. At the setup wiring site in `game.ts`, both fields are always available (phase and turn are live in boardgame.io setup context), so construction uses concrete values — no inline ternaries that return `undefined`. Tests pass plain object literals. WP-029 precedent (`preserveHandCards` conditional assignment) does not apply because no branch produces `undefined`. The optional modifiers exist for future flexibility, not for nullable runtime construction.

**6. Undefined Merge Semantics (Replace vs Append) — PASS**
N/A. WP-031 has no merge operations, no overrides, no config replacement. Invariant checks observe; they do not combine.

**10. Stringly-Typed Outcomes and Results — PASS**
`InvariantCategory` is a discriminated 5-value union. `InvariantViolation.category` is typed, not free-string. `assertInvariant`'s category parameter is typed. Check functions pass literal narrowings into the union — compile-time enforced. With the #4 FIX applied (canonical array + drift test), stringly-typed drift is mechanically prevented.

**21. Type Widening at Boundaries — PASS**
`assertInvariant(condition: boolean, category: InvariantCategory, message: string): void` — no widening. `runAllInvariantChecks(G: LegendaryGameState, invariantContext: InvariantCheckContext): void` — no `any`/`unknown`. Check functions take `G: LegendaryGameState` directly. Zone checks use `CardExtId` strings (already a named alias, not raw `string`). `InvariantViolation.context?: Record<string, unknown>` is the only `unknown` and it is scoped to an optional diagnostic bag — not a data-flow boundary.

**27. Weak Canonical Naming Discipline — PASS**
Function names are full English words (`checkCitySize`, `checkNoCardInMultipleZones`, `checkSerializationRoundtrip`, `checkCountersAreFinite`). Type names are unabbreviated (`InvariantCategory`, `InvariantViolation`, `InvariantViolationError`, `InvariantCheckContext`). Category values are noun-form camelCase (`structural`, `gameRules`, `determinism`, `security`, `lifecycle`). No `V1`, `Simple`, `Temp`, `Tmp`, `Mgr`, `Cfg`, `Ctx` (other than the framework-mandated `ctx` inside `game.ts`). Pre-flight §Maintainability §Semantic naming stability locks this.

---

### Category 5 — Persistence & Serialization

**7. Persisting Runtime State by Accident — PASS**
WP-031 adds **zero** fields to `LegendaryGameState`. Invariant checks observe; they do not extend `G`. Pre-flight explicitly verifies "Persistence classification — N/A. WP-031 adds NO fields to LegendaryGameState". No snapshot changes. No new DB columns. `checkGIsSerializable` enforces serializability as a positive invariant — the enforcement flows the correct direction.

**19. Weak JSON-Serializability Guarantees — PASS**
Three distinct checks enforce this: `checkGIsSerializable` (structural: roundtrip operation succeeds), `checkSerializationRoundtrip` (determinism: roundtrip is identity-preserving per RS-7), and `checkNoFunctionsInG` (deep scan for function values). Tests 1, 3, 8 exercise these. `ImplementationMap` is already kept outside `G` by WP-009B — WP-031 does not regress this.

**24. Mixed Persistence Concerns — PASS**
No new persistence. No snapshot schema changes. No `MatchSetupConfig` changes. Invariant checks observe runtime-only state. D-3102 locks wiring to setup return path — no per-move snapshot coupling.

---

### Category 6 — Testing & Invariant Enforcement

**11. Tests Validate Behavior, Not Invariants — PASS**
WP-031 is, by construction, an invariant-enforcement packet. The 10 locked tests are structured as **contract enforcement** per WP-028 precedent: Tests 2–5 assert specific violations throw with the correct category; Tests 9–10 assert gameplay conditions do NOT throw (negative invariant tests per D-0102 clarification); Tests 1, 6, 7, 8 cover the happy path and `assertInvariant` contract. Pre-flight §Test Expectations explicitly states "Tests 9 and 10 are contract enforcement tests — they must not be weakened if they fail. If they fail, the invariant definition is wrong and the check function must be corrected." No boardgame.io/testing imports. Baseline 348 → 358 locked. `makeMockCtx` used for G construction; plain object literals for `InvariantCheckContext`.

---

### Category 7 — Scope & Execution Governance

**12. Scope Creep During "Small" Packets — PASS**
Pre-flight §Scope Lock enumerates every allowed file and lists 19 "Not Allowed" items. EC §Files to Produce lists all 11 files. WP-031 §Files Expected to Change restricts to the same set. Verification step 8 uses `git diff --name-only` to enforce. Pre-flight RS-6 excludes the 6 pre-existing untracked files explicitly. "Anything not explicitly allowed is out of scope" cited. Attack surface is locked.

**13. Unclassified Directories and Ownership Ambiguity — PASS**
PS-1 raised during pre-flight; D-3101 written and committed to `DECISIONS.md` before session prompt generation. `src/invariants/` now classified as engine category with the rationale matching the D-2706 / D-2801 / D-3001 template. Classification is Immutable.

**30. Missing Pre-Session Governance Fixes — PASS**
PS-1 (D-3101) and PS-2 (D-3102) both explicitly logged in pre-flight §Authorized Next Step as blocking. Both resolved 2026-04-15 before this copilot check. Resolution pattern matches WP-030's PS-1 workflow. Nothing outstanding.

---

### Category 8 — Extensibility & Future-Proofing

**14. No Extension Seams for Future Growth — PASS**
Pre-flight §Maintainability §Extension seam documents the growth path: adding a new check under an existing category requires one new import + one new call inside `runAllInvariantChecks`; adding a new category requires updating the union, the canonical array (after #4 FIX), the orchestrator, and one new check file. The Security category is reserved in the union but deferred in implementation — the slot exists, a future WP fills it without refactoring. `InvariantCheckContext` is deliberately minimal so future WPs can widen it additively (add `currentPlayer`, `matchPhase`, etc.) without breaking existing callers.

**28. No Upgrade or Deprecation Story — PASS**
WP-031 is purely additive: no field removals, no type renames, no data migrations, no breaking changes to existing APIs. `LegendaryGameState` unchanged. `MatchSetupConfig` unchanged. `ReplayInput` unchanged. D-3102 explicitly notes that a follow-up WP may expand wiring into the move lifecycle — but WP-031's setup-only wiring remains Immutable regardless, so the follow-up is purely additive too.

---

### Category 9 — Documentation & Intent Clarity

**15. Missing "Why" for Invariants and Boundaries — PASS**
EC §Required `// why:` Comments enumerates 4 mandatory comment locations: each invariant check (what it prevents), `assertInvariant` (D-0102 fail-fast rationale), five-categories rationale (ambiguity prevention), and `runAllInvariantChecks` ordering (fail-fast rationale). Pre-flight RS-4 and RS-7 add two more (narrowing rationale for `checkCountersUseConstants`, category distinction for `checkGIsSerializable` vs `checkSerializationRoundtrip`). With the #23 FIX applied, a 7th location is added (sort rationale for determinism). Decision trail recorded in D-0102, D-3101, D-3102.

**20. Ambiguous Authority Chain — PASS**
Pre-flight §Authority Chain lists 10 documents in explicit order. WP-031 implicitly inherits CLAUDE.md → ARCHITECTURE.md → rules → WP hierarchy. D-3101 / D-3102 cite D-2706 / D-2801 / D-3001 for classification precedent and D-0102 for throwing-convention precedent — authority chain traced at each hop.

**26. Implicit Content Semantics — PASS**
RS-4 (`checkCountersUseConstants`), RS-5 (throwing-convention coverage), RS-7 (serialization check distinction), and D-3102 all convert implicit semantics to locked text. EC Common Failure Smells list calls out the "gameplay condition flagged as invariant" anti-pattern. Five categories have single-sentence definitions in WP §Locked contract values. Nothing is "understood by convention" — everything is written down.

---

### Category 10 — Error Handling & Failure Semantics

**18. Outcome Evaluation Timing Ambiguity — PASS**
D-3102 locks a single evaluation point: `Game.setup()` return path. No move-lifecycle evaluation. No turn-boundary evaluation. No phase-transition evaluation. The single canonical moment for invariant evaluation eliminates timing ambiguity. Future WPs that add per-move wiring must introduce their own decision with explicit timing — D-3102 does not delegate timing choices to implementers.

**22. Silent Failure vs Loud Failure Decisions Made Late — PASS**
D-0102 (with clarification) is cited throughout. Loud failure: structural corruption → `assertInvariant` throws. Silent failure: gameplay conditions (insufficient attack, empty pile) → move returns void. Tests 9 and 10 specifically assert the silent-failure path is NOT triggered by the invariant pipeline. EC Common Failure Smells lists "Gameplay condition flagged as invariant" as the canonical anti-pattern. Full-sentence error messages enforced by Rule 11. `.claude/rules/game-engine.md §Throwing Convention` table covered by the Game.setup() throw-allowed row per pre-flight RS-5.

---

### Category 11 — Single Responsibility & Logic Clarity

**25. Overloaded Function Responsibilities — PASS**
`assertInvariant` does one thing (assert + throw). Each check function asserts one invariant (`checkCitySize`, `checkZoneArrayTypes`, etc. — naming reflects single responsibility). `runAllInvariantChecks` orchestrates only — it calls the check functions in order and contains no inline check logic. Pre-flight §Dependency Contract Verification: "No gameplay logic changes — invariant checks observe, they do not alter behavior". Move validation contract is untouched (invariant wiring lives in setup return, not move bodies).

---

## Mandatory Governance Follow-ups

- `DECISIONS.md` entry: **D-3101 + D-3102** already written (2026-04-15). No additional entries required.
- `02-CODE-CATEGORIES.md` update: Deferred. `src/invariants/` classification lives in D-3101 per the D-2706 / D-2801 / D-3001 precedent (none of those directories are listed in `02-CODE-CATEGORIES.md` either — the DECISIONS.md file is the authoritative registry for these new subdirectories). A future consolidation WP may migrate the registry, but that is out of scope.
- `.claude/rules/*.md` update: **None required**. The existing `.claude/rules/game-engine.md §Throwing Convention` table already covers the `assertInvariant` throw case under the "Game.setup() may throw" row (pre-flight RS-5). No new rule exception needed for WP-031's setup-only scope.
- `WORK_INDEX.md` update: deferred to WP-031 Definition of Done (post-execution checkoff).

---

## Applied In-Place Fixes (scope-neutral — no pre-flight re-run)

Both RISK findings are resolved by additive session-prompt locks. The pre-flight artifact is updated below to carry these locks into session prompt generation. Scope is unchanged; no new files, no new functions, no test-count change.

### FIX for Finding #23 (Deterministic Ordering)

**Pre-flight §Invocation Prompt Conformance Check additional lock:**

- Session prompt must lock: every check function that iterates a `Record<string, …>` and may throw on a specific key uses `Object.keys(record).sort()` (or an equivalent explicit sort) before applying check logic. Affected functions: `checkZoneArrayTypes`, `checkCountersAreFinite`, `checkCountersUseConstants`, `checkNoCardInMultipleZones`, `checkZoneCountsNonNegative`, `checkNoFunctionsInG`. Each sort site requires a `// why:` comment: "deterministic error reproducibility — fail-fast must identify the same offending key on every run".

### FIX for Finding #4 (Canonical Array Drift Detection)

**Pre-flight §Scope Lock "Allowed to create" update:**

- `invariants.types.ts` additionally exports `INVARIANT_CATEGORIES: readonly InvariantCategory[] = ['structural', 'gameRules', 'determinism', 'security', 'lifecycle'] as const;` immediately below the `InvariantCategory` union. Order must match the union exactly.
- `types.ts` additionally re-exports `INVARIANT_CATEGORIES` alongside `InvariantCategory`.
- `index.ts` additionally exports `INVARIANT_CATEGORIES` in the invariants API block.

**Pre-flight §Test Expectations update:**

- Test 1 is re-scoped from "Valid `G` passes all invariant checks (no throw)" to "Canonical `INVARIANT_CATEGORIES` array matches `InvariantCategory` union AND valid `G` passes all invariant checks (no throw)". The test implementation adds one `assert.deepStrictEqual(INVARIANT_CATEGORIES, ['structural', 'gameRules', 'determinism', 'security', 'lifecycle'])` as a pre-assertion before the check-runner call. Test count remains **10** (baseline 348 → 358 unchanged).

Both FIXes will be mirrored into the pre-flight's §Authorized Next Step section so that session prompt generation inherits them without ambiguity.

---

## Pre-Flight Verdict Disposition

- [ ] CONFIRM — Pre-flight READY TO EXECUTE verdict stands. Session prompt generation authorized.
- [ ] HOLD → CONFIRM (after FIXes applied to pre-flight) — original disposition, now superseded by the 2026-04-15 mid-execution re-run below.
- [ ] SUSPEND — Pre-flight verdict suspended.

**Effective disposition:** Originally HOLD → CONFIRM with two scope-neutral FIXes; after session prompt was generated and execution began, the executor halted at implementation task §D and surfaced three additional pre-flight holes (RS-9 / RS-10 / RS-11). See §Re-Run 2026-04-15 below for the updated disposition.

---

## Re-Run 2026-04-15 (Mid-Execution)

**Trigger:** Executor halted at WP-031 §Implementation Task D before writing any code and escalated per the session prompt's "STOP and escalate when the check cannot be confidently classified" rule. User authorized Option 1 (fungible-exclusion cross-zone semantics) via WP-031 spec amendment + new DECISIONS.md entry, and instructed a re-run of pre-flight and copilot check.

**Inputs re-reviewed (delta from original):**
- WP-031 §Amendments A-031-01 / A-031-02 / A-031-03 (2026-04-15)
- New [D-3103](../DECISIONS.md) — Card Uniqueness Invariant Scope (Fungible Token Exclusion)
- Pre-flight §RS-9 / RS-10 / RS-11 + PS-3 (mid-execution additions, 2026-04-15)
- Engine source re-verified: `packages/game-engine/src/setup/buildInitialGameState.ts`, `packages/game-engine/src/setup/pilesInit.ts`, `packages/game-engine/src/setup/playerInit.ts`, `packages/game-engine/src/state/zones.types.ts`, `packages/game-engine/tsconfig.json`

### New Findings (31, 32, 33)

#### Category 2 — Determinism & Reproducibility (re-scan)

**31. `CardExtId` Fungibility Conflict with Literal "No Card in Multiple Zones" Check — RISK → PASS after amendment**

Original WP-031 §D item 1 specified a literal Set-based cross-zone dedup for every CardExtId. During execution, the executor verified that:

- `buildStartingDeckCards` pushes 8 copies of `'starting-shield-agent'` and 4 copies of `'starting-shield-trooper'` into every player's deck (source: `buildInitialGameState.ts:79` under `STARTING_AGENTS_COUNT = 8`).
- `createPileCards` fills `G.piles.bystanders` with N copies of `'pile-bystander'`, `G.piles.wounds` with N copies of `'pile-wound'`, `G.piles.officers` with N copies of `'pile-shield-officer'`, and `G.piles.sidekicks` with N copies of `'pile-sidekick'` (source: `pilesInit.ts:40`).
- `CardExtId` in `zones.types.ts:23` is declared as a type alias `export type CardExtId = string;` with no per-instance semantics in the surrounding documentation. The comment at `zones.types.ts:12-16` explicitly motivates storing **type-level** ext_id strings instead of per-instance objects to keep G compact and serializable.

Running the literal check on `buildInitialGameState`'s output would throw `InvariantViolationError` on the first pile entry and fail every existing test routed through `LegendaryGame.setup()` — regressing the 348-test baseline that WP-031 was required to preserve.

Neither the pre-flight (original RS-1 through RS-8) nor this copilot check's original 30-issue scan caught this conflict. The scan treated `checkNoCardInMultipleZones` as a black-box specification without cross-referencing the actual setup-layer behavior that produces valid G states. Both artifacts should, on future runs, include a "re-verify against concrete setup-layer output" step for any invariant that scans runtime state produced by an existing builder.

> **FIX (user-authorized, mid-execution):** WP-031 §Amendments A-031-01 locks fungible-exclusion cross-zone semantics for `checkNoCardInMultipleZones`. The fungible set is the six well-known CardExtId strings owned by `buildInitialGameState.ts` / `pilesInit.ts`. All other CardExtIds (villain cards, henchmen, scheme twists, virtual bystanders, mastermind strikes/tactics, future hero-deck entries) are scanned cross-zone; if the same string appears in two distinct zone names, the invariant fires. See [D-3103](../DECISIONS.md) for the full rationale, trade-off acknowledgement, and forward-compatibility note. Implementation contract is specified in A-031-01 items 1–5.
>
> **Scope impact:** Zero. File list unchanged (same 11 files). Test count unchanged (still +10). Wiring decision unchanged (still D-3102 Option B setup-only). Category taxonomy unchanged (still 5 categories). The amendment narrows one check function's semantics and retargets one test injection. Pre-flight RS-9 captures the blocker; Amendment A-031-01 captures the resolution; D-3103 captures the decision.

#### Category 4 — Type Safety & Contract Integrity (re-scan)

**32. `PlayerZones.victoryPile` Field Name Drift — RISK → PASS after amendment**

Original WP-031 §C item 2 (`checkZoneArrayTypes`) and §D item 1 (`checkNoCardInMultipleZones`) list the zones to scan as `deck, hand, discard, inPlay, victoryPile`. The canonical `PlayerZones` interface at `packages/game-engine/src/state/zones.types.ts:49` declares `victory: Zone`. There is **no** `victoryPile` field in the engine.

This is a drafting typo in the WP spec that would produce `undefined` at runtime for every player zone read via `G.playerZones['0'].victoryPile`, spuriously firing `checkZoneArrayTypes` on every valid G. The original 30-issue scan missed it because Finding #27 ("Weak Canonical Naming Discipline") only checked whether names were abbreviated, not whether they matched the canonical field names declared in engine type files.

> **FIX (mid-execution):** WP-031 §Amendments A-031-02 locks the canonical field name as `victory` across all WP-031 check spec locations and tests. Executor uses `victory` in the implementation. No engine type change. No test-fixture renames (existing tests already use `victory`).
>
> **Scope impact:** Zero. One-word typo correction. Pre-flight RS-10 captures the delta.

#### Category 2 — Determinism & Reproducibility (re-scan, cont.)

**33. `InvariantCheckContext` Runtime-Undefined at Lifecycle Checks — RISK → PASS after amendment**

Pre-flight RS-2 locked `InvariantCheckContext` as `readonly phase?: string; readonly turn?: number;` (no `| undefined`). `packages/game-engine/tsconfig.json` sets `exactOptionalPropertyTypes: true`.

The wiring-site literal `{ phase: context.ctx.phase, turn: context.ctx.turn }` type-checks cleanly because boardgame.io Ctx declares `phase: string` and `turn: number` (non-null). Both are assignable to the optional fields.

At runtime, however, the existing `game.test.ts` and other tests cast `makeMockCtx()` via `mockContext as Parameters<NonNullable<typeof LegendaryGame.setup>>[0]`. `makeMockCtx` only sets `ctx.numPlayers` — `ctx.phase` and `ctx.turn` are absent. So at runtime, `context.ctx.phase` is `undefined` even though the compiler sees `string`. The lifecycle check functions (`checkValidPhase`, `checkTurnCounterMonotonic`) must handle this or they will produce confusing errors when they try to compare `undefined` against the canonical arrays.

The original 30-issue scan missed this because Finding #5 ("Optional Field Ambiguity") reasoned only about the compile-time type of the interface fields, not about runtime values at mock-cast call sites.

> **FIX (mid-execution):** WP-031 §Amendments A-031-03 locks the parameter types on `checkValidPhase` as `string | undefined` (not `string`) and on `checkTurnCounterMonotonic` parameters as `number | undefined`. Each function short-circuits with a `// why:` comment when the field is `undefined`. No change to `InvariantCheckContext` itself. No change to the wiring-site literal. No change to any test fixture.
>
> **Scope impact:** Zero. Pure signature refinement on two check functions. Pre-flight RS-11 captures the delta.

### Re-Run Verdict

- **28/30 → 28/30 PASS** (originals unchanged)
- **3 new findings added: 31, 32, 33 — all RISK → PASS after amendment**
- **Net: 31/33 PASS, 0 RISK after WP-031 spec amendment + D-3103**

### Mandatory Governance Follow-ups (Re-Run Delta)

- `DECISIONS.md` entry: **D-3103** written 2026-04-15 mid-execution. Locks fungible-exclusion cross-zone semantics for `checkNoCardInMultipleZones`. No other DECISIONS.md changes required.
- WP-031 spec: **Amendments A-031-01 / A-031-02 / A-031-03** appended to §Amendments section. Original §Scope (In), §Files Expected to Change, §Acceptance Criteria, and §Definition of Done unchanged except for the Multi-Zone Card Check acceptance bullet (retargeted to "non-fungible" per A-031-01).
- Pre-flight: **RS-9 / RS-10 / RS-11** appended, **PS-3** added to §Authorized Next Step, §Pre-Flight Verdict updated.
- `.claude/rules/*.md`: No changes required. The fungible-exclusion semantics do not introduce a new throwing convention or layer boundary.
- `WORK_INDEX.md`: deferred to WP-031 Definition of Done (post-execution checkoff) — unchanged.
- 02-CODE-CATEGORIES.md: not required — D-3103 is a semantic refinement, not a directory classification.

### Re-Run Disposition

- [x] **CONFIRM** — Pre-flight verdict upgraded to READY TO EXECUTE (re-run) with RS-9 / RS-10 / RS-11 resolved via WP-031 §Amendments A-031-01 / A-031-02 / A-031-03 and DECISIONS.md D-3103. Execution may resume from WP-031 §Implementation Task A without restarting the session.

**Effective disposition (post re-run):** CONFIRM. Scope unchanged. File list unchanged. Test count unchanged. Three check-function signatures and one check-function body were narrowed; no files added or removed. Executor proceeds to implement §A through §K using the amended semantics.
