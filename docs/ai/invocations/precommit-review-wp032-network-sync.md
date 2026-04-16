# Pre-Commit Review — WP-032 (Network Sync & Turn Validation)

**Role:** Pre-Commit Reviewer (Non-Implementing, Gatekeeper)
**Work Packet ID:** WP-032
**Status:** Implementation complete, pending commit
**Review Date:** 2026-04-15

---

## Executive Verdict

**Safe to commit as-is.**

WP-032 implements the intent validation contract exactly as specified by
EC-032 and the pre-flight-locked decisions. Four new engine-category files
introduce pure types and validation functions with no boardgame.io imports,
no G mutation, no lifecycle wiring, and no scope expansion. Two existing
files received strictly additive re-export/export lines. The test count
matches the locked expectation (358 -> 367, 94 -> 95 suites). All 9
verification grep gates pass. Governance documentation (DECISIONS, STATUS,
WORK_INDEX) is updated and consistent with the implementation.

---

## Review Axis Assessment

### 1. Scope Discipline — Pass

The WP creates exactly 4 new files and modifies exactly 2, matching the
EC-032 "Files to Produce" section. No logic beyond the declared scope.
No speculative additions. No convenience helpers. No runtime behavior
introduced — all functions are pure validators consumed only by the 9
new tests. The `01.5` runtime wiring allowance was correctly not invoked
(declared in session prompt, confirmed by post-mortem).

### 2. Contract & Type Correctness — Pass

`ClientTurnIntent` matches the EC-032 locked shape verbatim.
`IntentValidationResult` uses `code: IntentRejectionCode` (narrower than
the EC's `code: string` — this is a valid tightening, not a deviation).
`IntentRejectionCode` contains exactly the 5 locked codes.
`IntentValidationContext` was added during pre-flight (PS-2 back-sync)
and is consistent with the D-2801 local structural interface precedent.
`validateIntent` signature matches the pre-flight-locked 4-parameter form.
`detectDesync` signature matches WP-032 §C exactly.

### 3. Boundary Integrity — Pass

Framework boundary: zero boardgame.io imports in `src/network/` (grep
verified). Registry boundary: zero registry imports. Pure/mutation
separation: all functions return new object literals; no G field access
except through `computeStateHash`. Types file (`intent.types.ts`)
contains only type definitions and interfaces — no runtime logic.
Implementation files (`intent.validate.ts`, `desync.detect.ts`) contain
only pure functions.

### 4. Test Integrity — Pass

9 tests in 1 `describe` block matching the WP spec exactly. Tests cover
all 5 rejection codes, valid intent pass-through, desync with matching/
mismatching/absent hashes, and a non-mutation invariant (Test 9). Tests
use `buildInitialGameState` + `makeMockCtx` for G fixtures (same pattern
as `invariants.test.ts`) and plain object literals for
`IntentValidationContext`. No boardgame.io imports in the test file. No
over-testing — each test enforces exactly one contract property.

### 5. Runtime Boundary Check — Pass

**Runtime wiring allowance was not used.** The two modified files
(`types.ts`, `index.ts`) received strictly additive re-export/export
lines. No existing lines were modified. No new gameplay or branching
logic introduced. No files outside the WP allowlist were modified (the
governance document changes — DECISIONS.md, STATUS.md, WORK_INDEX.md,
EC-032, WP-032, 02-CODE-CATEGORIES.md — are pre-flight/copilot-check
artifacts, not WP code changes).

### 6. Governance & EC-Mode Alignment — Pass

D-3201 (network directory classification), D-3202 (engine-side
validation), D-3203 (additive to boardgame.io) all recorded in
DECISIONS.md with rationale. DECISIONS_INDEX.md updated. STATUS.md
reflects WP-032 completion. WORK_INDEX.md has WP-032 checked off with
date. EC-032 was updated during copilot check to reflect the pre-flight-
locked signature (FIX #4). All `// why:` comments required by EC-032
are present in the implementation files.

---

## Optional Pre-Commit Nits (Non-Blocking)

*No pre-commit nits identified.*

---

## Explicit Deferrals (Correctly NOT in This WP)

- **No transport implementation** — boardgame.io handles WebSocket/polling;
  WP-032 defines the intent contract only. Correctly deferred.
- **No server-side wiring** — `validateIntent` is not called from
  `apps/server/`. Server integration is a future WP. Correctly deferred.
- **No per-move args schema validation** — `MALFORMED_ARGS` performs
  structural checking only (rejects functions). Per-move schema validation
  delegated to existing `coreMoves.validate.ts` at move execution time.
  Correctly deferred per pre-flight RS-3.
- **No reconnection protocol** — out of scope per WP-032 §Out of Scope.
- **No rate limiting or abuse prevention** — server/ops concern. Correctly
  omitted.
- **No `INTENT_REJECTION_CODES` canonical array** — the 5-member union is
  sufficient. Drift-detection array deferred to a future WP if the set
  grows. Reasonable scoping.
- **No client-side validation** — validation is engine-side only per
  D-0401. Correctly omitted.

---

## Commit Hygiene Recommendations

- Commit message prefix: `EC-032:` per `01.3-commit-hygiene-under-ec-mode.md`
- Suggested message: `EC-032: implement intent validation and desync detection contract`
- Single commit covering all 4 new files, 2 modified files, and governance
  doc updates. The governance changes (pre-flight PS-1/PS-2, copilot FIX
  #4/#13) are logically part of the WP-032 execution and belong in the
  same commit.
