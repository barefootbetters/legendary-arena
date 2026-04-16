# Copilot Check — WP-032 (Network Sync & Turn Validation)

**Date:** 2026-04-15
**Pre-flight verdict under review:** READY TO EXECUTE (2026-04-15)
**Inputs reviewed:**
- EC: docs/ai/execution-checklists/EC-032-network-sync.checklist.md
- WP: docs/ai/work-packets/WP-032-network-sync-turn-validation.md
- Pre-flight: docs/ai/invocations/preflight-wp032-network-sync.md

---

## Overall Judgment

**CONFIRM**

The pre-flight verdict stands. WP-032 is a Contract-Only packet introducing
pure types and validation functions with no `G` mutation, no framework
imports, no lifecycle wiring, and no persistence. All 30 issues scan clean
or resolve to rapid PASS. Three findings require minor scope-neutral fixes
(#4 EC signature drift, #13 code-category registry update, #27 naming
alignment). None affect scope, test count, file allowlist, or architectural
boundaries. The pre-flight already resolved the two highest-risk items
(RS-2 move-name injection, RS-1 local structural interface) and both
pre-session actions (PS-1 D-3201 classification, PS-2 WP back-sync) are
complete.

---

## Findings

### Category 1: Separation of Concerns & Boundaries

**#1 — PASS.** Engine/UI boundary explicitly maintained. All network files
are engine-category with no UI imports. EC-032 Guardrails: "All validation
is engine-side only — clients never validate their own intents." Pre-flight
scope lock forbids server file modification. D-3201 classifies `src/network/`
as engine code category.

**#9 — PASS.** UI re-implementation prevented. WP-032 defines the canonical
intent submission format. EC-032: "clients never validate their own intents."
D-0401 (Clients Submit Intents, Not Outcomes) is cited and verified in
pre-flight.

**#16 — PASS.** Lifecycle wiring creep prevented. Pre-flight explicitly
declares "01.5 IS NOT INVOKED" with all four conditions enumerated as
ABSENT. Scope lock: "No modification of `game.ts` or any move
implementation." No phase hooks, no moves added.

**#29 — PASS.** Cross-layer assumption prevented. `validateIntent` uses a
local structural interface (`IntentValidationContext`) instead of importing
boardgame.io's `Ctx`. The caller injects `validMoveNames` rather than the
validator assuming knowledge of registered moves.

### Category 2: Determinism & Reproducibility

**#2 — PASS.** No randomness introduced. Validation is a pure function of
`(intent, G, context, validMoveNames)`. No `Math.random()`, no `Date.now()`,
no locale-dependent behavior. EC-032 Guardrails: "no `.reduce()` in
validation; no boardgame.io import in network files."

**#8 — PASS.** Debugging truth preserved. Validation results are structured
(`IntentValidationResult`) with machine-readable `code` and human-readable
`reason`. Desync detection uses `computeStateHash` which is the existing
deterministic replay hash. All validation paths are reproducible from
inputs alone.

**#23 — PASS.** Ordering is not relevant. Validation checks are sequential
(player -> turn -> move name -> args -> desync) with explicit short-circuit.
No object iteration order dependency.

### Category 3: Immutability & Mutation Discipline

**#3 — PASS.** No Immer mutation confusion possible. WP-032 introduces no
moves, no `G` mutations. `validateIntent` and `detectDesync` are pure
functions that read `G` without modification. EC-032 Guardrails: "Validation
never mutates G — intents validated before moves execute." Test 9 enforces
non-mutation via deep equality check.

**#17 — PASS.** Hidden mutation via aliasing not possible. `validateIntent`
returns a new `IntentValidationResult` object literal. `detectDesync`
returns a new `{ desynced, engineHash }` object. Neither returns references
to `G` fields.

### Category 4: Type Safety & Contract Integrity

**#4 — RISK.** EC-032 Locked Values section still shows the original
`validateIntent` signature with `G: LegendaryGameState, ctx: Ctx` but
pre-flight locked `(intent, gameState, context: IntentValidationContext,
validMoveNames: readonly string[])`. WP-032 has been back-synced (PS-2)
but EC-032 has not.
**FIX #4:** Update EC-032 §Locked Values to add the `IntentValidationContext`
interface shape and note the `validMoveNames` parameter. Also update the
`validateIntent` signature reference in EC-032 §Files to Produce if it
appears there. This is a scope-neutral documentation fix.

**#5 — PASS.** `ClientTurnIntent.clientStateHash` is declared `optional`
(`clientStateHash?: string`). Both WP-032 and EC-032 explicitly handle the
undefined case: "If `clientHash` is undefined: `desynced: false`" and test
8 covers this path.

**#6 — PASS.** No merge semantics involved. `IntentValidationResult` is a
discriminated union (`valid: true` vs `valid: false`). No merging,
overriding, or appending behavior.

**#10 — PASS.** No stringly-typed outcomes. `IntentRejectionCode` is a
named 5-member string literal union. Pre-flight RS-2 noted this follows
the WP-030 precedent (named union for related function parameters).
`IntentValidationResult.code` is typed as `string` in the locked shape —
see note below.

> **Observation on `IntentValidationResult.code: string`:** The locked
> shape uses `code: string` rather than `code: IntentRejectionCode`. This
> is technically wider than necessary but does NOT rise to RISK because
> (a) the WP explicitly defines `IntentRejectionCode` as a named type,
> (b) the implementation will naturally use the named type for the `code`
> field in the rejection branch, and (c) the `valid: false` discriminant
> already narrows the result. If the session prompt uses
> `code: IntentRejectionCode` in the implementation, it is consistent with
> the WP intent without contradicting the EC locked shape (string is a
> supertype). No fix needed.

**#21 — PASS.** Type widening controlled. `intent.move.name` is `string`
(correct — transport-agnostic, no import of move types). `intent.move.args`
is `unknown` (correct — transport receives arbitrary JSON). `playerId` and
`matchId` are `string`. These are intentionally wide at the transport
boundary. Validation narrows them.

**#27 — PASS.** Naming discipline maintained. Field names (`matchId`,
`playerId`, `turnNumber`, `clientStateHash`) are full English words with no
abbreviations. `IntentValidationContext` follows the established
`UIBuildContext` naming pattern. `validMoveNames` is descriptive.

### Category 5: Persistence & Serialization

**#7 — PASS.** No persistence introduced. WP-032 adds no `G` fields, no
database access, no snapshots. `ClientTurnIntent` is explicitly declared
"data-only, JSON-serializable — no functions" in both EC and WP.

**#19 — PASS.** JSON-serializability guaranteed. `ClientTurnIntent` contains
only `string`, `number`, and `unknown` (for args). EC Guardrails:
"ClientTurnIntent is data-only, JSON-serializable — no functions."
`MALFORMED_ARGS` check at MVP validates args is not a function and is
JSON-serializable (pre-flight RS-3).

**#24 — PASS.** No persistence concerns. WP-032 is purely runtime
validation. No config, no snapshots, no storage.

### Category 6: Testing & Invariant Enforcement

**#11 — PASS.** Tests enforce invariants, not just behavior. Test 9
("Validation does not mutate G") is an invariant test. Tests 2-5 enforce
the rejection code contract. Test 6-8 enforce the desync detection
contract. Pre-flight locks test count at 367/95/0.

### Category 7: Scope & Execution Governance

**#12 — PASS.** Scope creep explicitly prevented. EC-032 Verification Step
9: `git diff --name-only` confirms only allowlisted files modified. Pre-
flight scope lock: "Anything not explicitly allowed is out of scope."
Forbidden list is explicit and comprehensive.

**#13 — PASS (after PS-1).** Directory classification resolved. D-3201
created during pre-flight, classifying `src/network/` as engine category.
Added to DECISIONS_INDEX.md. However, `02-CODE-CATEGORIES.md` itself has
not been updated with the new directory listing.
**FIX #13:** Add `packages/game-engine/src/network/` to the `engine`
category directory list in `docs/ai/REFERENCE/02-CODE-CATEGORIES.md`. This
is a scope-neutral governance fix consistent with D-3201.

**#30 — PASS.** Pre-session governance fixes completed. PS-1 (D-3201) and
PS-2 (WP back-sync) both resolved and logged in the pre-flight's
"Authorized Next Step" section with dates.

### Category 8: Extensibility & Future-Proofing

**#14 — PASS.** Extension seam exists. `IntentRejectionCode` is a named
union — future rejection codes add to the union and `validateIntent` logic.
`validMoveNames` parameter injection means the validator does not need
modification when new moves are added. Pre-flight Maintainability check
confirms.

**#28 — PASS.** No upgrade/deprecation concern. `ClientTurnIntent` is a
new contract with no prior version. No migration needed. The shape is
transport-agnostic and boardgame.io-version-independent.

### Category 9: Documentation & Intent Clarity

**#15 — PASS.** `// why:` comments explicitly required. EC-032 §Required
`// why:` Comments lists 4 categories: ClientTurnIntent rationale, each
rejection code, detectDesync D-0402 reference, and validation vs
boardgame.io turn order relationship.

**#20 — PASS.** Authority chain clear. Pre-flight cites authority hierarchy.
EC-032 references WP-032 as source. WP-032 cites D-0401, D-0402, and
ARCHITECTURE.md sections.

**#26 — PASS.** Content semantics locked. `IntentValidationResult` uses a
discriminated union with `valid: true | false`. Rejection includes both
machine-readable `code` and human-readable `reason`. No implicit or
convention-based meaning.

### Category 10: Error Handling & Failure Semantics

**#18 — PASS.** Evaluation timing is clear. Intent validation runs BEFORE
move execution. EC-032: "intents validated before moves execute." No
ambiguity about lifecycle timing.

**#22 — PASS.** Failure semantics locked. EC-032 Guardrails: "Validation
produces structured rejection results — never throws." Pre-flight scope
lock: "No `throw` in validation logic — structured results only." EC
Verification Step 5 greps for `throw` in `intent.validate.ts`. This
follows the established convention: moves never throw, validators return
structured results.

### Category 11: Single Responsibility & Logic Clarity

**#25 — PASS.** Functions have single responsibilities. `validateIntent`
validates intents (5 sequential checks). `detectDesync` detects desync
(hash comparison). `computeStateHash` computes hashes (existing, not
modified). No function does merging + validation + mutation.

---

## Mandatory Governance Follow-ups

1. **EC-032 signature update (FIX #4):** Update EC-032 to reflect the
   pre-flight-locked `validateIntent` signature with
   `IntentValidationContext` and `validMoveNames` parameters. Add the
   `IntentValidationContext` interface shape to EC-032 §Locked Values.

2. **02-CODE-CATEGORIES.md update (FIX #13):** Add
   `packages/game-engine/src/network/` to the `engine` category directory
   list, consistent with D-3201.

---

## Pre-Flight Verdict Disposition

- [x] **CONFIRM** — Pre-flight READY TO EXECUTE verdict stands. Session
      prompt generation authorized. Two scope-neutral governance fixes
      (#4, #13) should be applied before or during session prompt
      generation. Neither changes scope, test count, file allowlist, or
      architectural boundaries.
- [ ] HOLD
- [ ] SUSPEND
