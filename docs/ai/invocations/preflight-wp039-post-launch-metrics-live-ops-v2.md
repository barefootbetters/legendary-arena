# Pre-Flight v2 — WP-039 Post-Launch Metrics & Live Ops

**Target Work Packet:** `WP-039`
**Title:** Post-Launch Metrics & Live Ops (Path A rewrite)
**Previous WP Status:** WP-038 Complete (2026-04-22, commit `2134f33`)
**Pre-Flight Date:** 2026-04-23
**Invocation Stage:** Pre-Execution (Scope & Readiness, re-run after PS-1)
**Repo-state anchor:** `main @ ba2490e` + in-session PS-1 rewrite of WP-039 and EC-039

**Work Packet Class:** Contract-Only / Documentation-Only

Rationale: WP-039 under Path A produces **one** new document under `docs/ops/`. Zero TypeScript files. Zero new types. Zero re-exports. Zero test changes. Matches the WP-035 / WP-037 / WP-038 Docs-class Phase 7 precedent chain.

This is a **v2 pre-flight**. V1 (`preflight-wp039-post-launch-metrics-live-ops.md`) returned `DO NOT EXECUTE YET` with three blockers (duplicate type, severity contradiction, parallel container). PS-1 applied Path A to WP-039 and EC-039 to resolve all three. V2 verifies the rewrite.

Mandatory sections per class: Dependency & Sequencing Check, Input Data Traceability, Structural Readiness, Scope Lock, Test Expectations, Risk Review. Skipped: Runtime Readiness, Mutation Boundary. Included: Dependency Contract Verification (central to the v1 blockers), Code Category Boundary Check.

---

## Pre-Flight Intent

Perform a fresh pre-flight validation for WP-039 after the Path A rewrite.

- Not implementing.
- Not generating code.
- Validating readiness and constraints only.

Verdict is binary (READY / NOT READY).

---

## Authority Chain (Read in Order)

1. `.claude/CLAUDE.md` — read.
2. `docs/ai/ARCHITECTURE.md` — Layer Boundary, Architectural Principle #1 (Determinism) — read.
3. `docs/01-VISION.md` — §3, §5, §13, §14, §22, §24 — read. Clause titles verified.
4. `docs/03.1-DATA-SOURCES.md` — reviewed. WP-039 introduces no new input datasets.
5. `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` — `packages/game-engine/src/ops/` already engine category (D-3501); `docs/ops/` is a standard docs location.
6. `docs/ai/execution-checklists/EC-039-live-ops.checklist.md` — re-read post-rewrite (59 content lines, under the 60-cap).
7. `docs/ai/work-packets/WP-039-post-launch-metrics-live-ops.md` — re-read post-rewrite.
8. `docs/ops/INCIDENT_RESPONSE.md` — **now named in WP-039 Context (Read First) as AUTHORITATIVE**. Severity taxonomy P0-P3 remains as defined at lines 32-34.
9. `packages/game-engine/src/ops/ops.types.ts` — **now named in WP-039 Context (Read First) as AUTHORITATIVE**. `IncidentSeverity` and `OpsCounters` remain as defined at lines 40-84.

No authority conflicts found under the Path A scope.

---

## Vision Sanity Check

- **Vision clauses touched:** §3 (Player Trust & Fairness), §5 (Longevity & Expandability), §13 (Execution Checklist–Driven Development), §14 (Explicit Decisions, No Silent Drift), §22 (Deterministic & Reproducible Evaluation), §24 (Replay-Verified Competitive Integrity).
- **Conflict assertion:** `No conflict: this WP preserves all touched clauses.`
- **Non-Goal proximity:** `N/A — WP touches no monetization or competitive surface.`
- **Determinism preservation:** Confirmed. WP-039 reuses landed severity and counter surfaces — no new runtime logic, no new replay-affecting code.
- **WP `## Vision Alignment` section status:** Present and intact after rewrite.

**Vision Sanity Check: PASS.**

---

## Dependency & Sequencing Check

| WP | Status | Evidence |
|---|---|---|
| WP-034 Versioning | PASS | `packages/game-engine/src/versioning/` exports `CURRENT_DATA_VERSION`, `getCurrentEngineVersion`, etc. |
| WP-035 Release Process | PASS | `docs/ops/RELEASE_CHECKLIST.md`, `DEPLOYMENT_FLOW.md`, `INCIDENT_RESPONSE.md` present; `ops.types.ts` exports `IncidentSeverity`, `OpsCounters`, `DeploymentEnvironment` |
| WP-036 AI Simulation | PASS | `packages/game-engine/src/simulation/` present |
| WP-037 Public Beta | PASS | `docs/beta/`, `packages/game-engine/src/beta/` present |
| WP-038 Launch Readiness | PASS | WORK_INDEX.md:1373 marks complete at `2134f33` (2026-04-22) |

D-entries cited by WP-039 v2 all verified (em-dash encoding):

- D-0702 — Balance Changes Require Simulation
- D-0901 — Deterministic Metrics Only
- D-0902 — Rollback Is Always Possible
- D-1002 — Immutable Surfaces Are Protected
- D-3501 — `src/ops/` classified as engine

No sequencing blockers.

---

## Dependency Contract Verification

### V1 Finding 1 (Duplicate engine-wide severity type) — RESOLVED ✅

WP-039 v2 §Non-Negotiable Constraints explicitly states:

> **Reuse `IncidentSeverity` from `ops.types.ts`** — do not define `MetricPriority`, `MetricSeverity`, or any parallel `P0|P1|P2|P3` union type.

EC-039 v2 §Guardrails and §Common Failure Smells both enforce this. Scope Enforcement in WP-039 §Acceptance Criteria adds a grep guard:

> No new `MetricPriority`, `MetricSeverity`, `MetricCategory`, `MetricEntry`, or similar parallel types anywhere in the repo (confirmed with grep)

This is stronger than the absence of parallel types — it is an executable guard.

### V1 Finding 2 (Severity contradiction) — RESOLVED ✅

WP-039 v2 §Non-Negotiable Constraints explicitly states:

> **Severity semantics must match `docs/ops/INCIDENT_RESPONSE.md` exactly.** Replay desync is P1 (not P0). Any proposal to reclassify requires a new DECISIONS.md entry amending INCIDENT_RESPONSE.md *before* WP-039 can execute — not inside WP-039.

EC-039 v2 §Guardrails mirrors: "Replay desync is P1, full stop." The same-version vs cross-version split from prior tightening rounds is deleted.

Verification: WP-039 v2 does NOT re-assert a P0 classification for replay hash mismatches anywhere. The Locked Values table cites INCIDENT_RESPONSE.md:32-34 verbatim.

### V1 Finding 3 (Parallel metric container) — RESOLVED ✅

WP-039 v2 §Non-Negotiable Constraints:

> **Reuse `OpsCounters`** as the authoritative ops observability surface for invariant violations, rejected turns, replay failures, and migration failures. Do not define a parallel counter container.

The Locked Values section cites `OpsCounters.invariantViolations`, `rejectedTurns`, `replayFailures`, `migrationFailures` by field name from `ops.types.ts:40-49` — no new `MetricEntry` or similar type.

WP-039 v2 §A §4 (Framework doc §4 Observability Surface) requires the framework doc to cross-link to `OpsCounters` rather than redefine it.

### New check: Authority Chain gap that caused v1 drift — RESOLVED ✅

The v1 drift happened because earlier tightening passes didn't have `ops.types.ts` or `INCIDENT_RESPONSE.md` in the Context (Read First) list. WP-039 v2 §Context (Read First) now leads with:

> **`docs/ops/INCIDENT_RESPONSE.md` — AUTHORITATIVE for severity semantics.**
> **`packages/game-engine/src/ops/ops.types.ts` — AUTHORITATIVE for ops types.**

Both tagged AUTHORITATIVE in caps. Future sessions iterating on this WP will see the authorities before proposing changes.

---

## Input Data Traceability Check

- All non-user-generated inputs: N/A — WP-039 consumes no new data sources
- Storage location for each input: N/A
- Inspection path on incorrect behavior: N/A (doc-only)
- No implicit data: YES (prose only)
- Setup-time derived fields: YES (none introduced)

**Input Data Traceability: PASS.**

---

## Structural Readiness Check

- [x] All prior WPs compile and tests pass: 444/444 passing at baseline (verified this session)
- [x] No known EC violations remain open
- [x] **Required types exist and are exported — PASS (v1 blocker resolved):** WP-039 v2 uses no new types; it reuses `IncidentSeverity` and `OpsCounters` already exported at `index.ts:331-336`
- [x] **No naming or ownership conflicts — PASS (v1 blocker resolved):** no duplicate engine-wide types introduced
- [x] **No architectural boundary conflicts anticipated — PASS (v1 blocker resolved):** WP-039 v2 framework doc aligns with landed `docs/ops/INCIDENT_RESPONSE.md` severity semantics
- [x] Database / migrations: N/A
- [x] R2 data: N/A
- [x] G field subfields: N/A

**Structural Readiness: PASS.**

---

## Code Category Boundary Check

- [x] `docs/ops/LIVE_OPS_FRAMEWORK.md` is docs category; `docs/ops/` already exists as a documented docs location
- [x] No new directories created
- [x] No file blurs category boundaries

**Code Category: PASS.**

---

## Scope Lock

WP-039 v2 is permitted to:

- **Create:** `docs/ops/LIVE_OPS_FRAMEWORK.md` — §1 Purpose, §2 Foundational Constraints, §3 Severity Taxonomy (cross-link only), §4 Observability Surface (cross-link only), §5 Metric Label Conventions (organizational prose, NOT typed unions), §6 Data Collection Rules, §7 Live Ops Cadence, §8 Change Management, §9 Success Criteria, §10 Non-Goals, §11 Summary
- **Update:** `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md`, `docs/ai/work-packets/WORK_INDEX.md` (session-close governance)

WP-039 v2 is explicitly NOT allowed to:

- Create, modify, or delete any TypeScript file
- Re-export anything in `packages/game-engine/src/types.ts` or `packages/game-engine/src/index.ts`
- Define `MetricPriority`, `MetricSeverity`, `MetricCategory`, `MetricEntry`, or any parallel severity/counter type
- Modify `docs/ops/INCIDENT_RESPONSE.md`, `docs/ops/DEPLOYMENT_FLOW.md`, `docs/ops/RELEASE_CHECKLIST.md`, or `packages/game-engine/src/ops/ops.types.ts`
- Restate the P0-P3 severity table beyond a cross-link pointer to `INCIDENT_RESPONSE.md`
- Redefine the four `OpsCounters` fields beyond a cross-link pointer

**Scope Lock: LOCKED.**

---

## Test Expectations (Locked Before Execution)

- **0 new tests.** WP-039 v2 is documentation-only.
- **All 444 existing tests must continue to pass** (verified baseline: 444/444 at repo state `main @ ba2490e`).
- No `boardgame.io/testing` imports anywhere.
- No modifications to `makeMockCtx` or shared test helpers.
- Since no code changes, `pnpm test` delta must be exactly zero.

**Test Expectations: LOCKED.**

---

## Risk & Ambiguity Review

| # | Risk | Impact | Mitigation / Decision |
|---|---|---|---|
| R1 | Framework doc §5 "Metric Label Conventions" (four prose groupings) could drift toward becoming typed unions in a future WP | LOW | WP-039 §A §5 explicitly states: "These labels are organizational prose, not code constants." EC-039 §Common Failure Smells catches parallel types. Any future WP proposing to typify these must go through its own pre-flight and DECISIONS entry. |
| R2 | Framework doc might inadvertently duplicate content already in INCIDENT_RESPONSE.md, DEPLOYMENT_FLOW.md, or RELEASE_CHECKLIST.md | LOW | WP-039 §A §3 and §A §4 require cross-link-only. Acceptance Criteria explicitly checks that the severity table is NOT restated (grep verification). |
| R3 | Executing session could forget to update DECISIONS.md with the Path A design decision | LOW | WP-039 §Definition of Done explicitly requires: "new entry documenting Path A decision: reuse `IncidentSeverity` and `OpsCounters` rather than defining parallel types" |
| R4 | Framework doc cadence (daily/weekly/monthly) may not align with existing on-call rhythm documented elsewhere | LOW | If a conflict is found mid-execution, the executing session must stop and escalate per WP-039 §Non-Negotiable Constraints "Session protocol" |

No HIGH or MEDIUM risks. All v1 blockers resolved.

---

## Pre-Flight Verdict (Binary)

# READY TO EXECUTE

WP-039 v2 is properly sequenced, scoped, and ready for execution.

1. All three v1 blockers (duplicate severity type, severity contradiction, parallel container) are resolved by construction — WP-039 v2 reuses landed `IncidentSeverity` and `OpsCounters` and aligns with `INCIDENT_RESPONSE.md` severity semantics.
2. Contract fidelity is verified: the locked values cite `ops.types.ts:40-84` and `INCIDENT_RESPONSE.md:32-34` by file:line.
3. Scope lock is unambiguous: one `docs/ops/` file and three governance updates; no TypeScript, no re-exports.
4. Architectural boundary confidence is high: `docs/ops/` is a pre-classified docs location; no engine changes.
5. Risks are LOW and all have mitigations built into acceptance criteria or failure smells.
6. Maintainability is strong: the framework doc assumes an explicit cross-link pattern rather than re-deriving existing severity taxonomy — future changes to severity live in `INCIDENT_RESPONSE.md`, not in a fragmented parallel doc.

---

## Invocation Prompt Conformance Check (Pre-Generation)

- [x] All EC locked values align with WP-039 §Non-Negotiable Constraints
- [x] No new keywords, helpers, file paths, or timing rules appear only in the EC
- [x] File paths, extensions, and test locations match the WP exactly
- [x] No forbidden imports or behaviors are introduced by wording changes
- [x] EC resolves no ambiguities that are not resolved in this pre-flight
- [x] Contract names (`IncidentSeverity`, `OpsCounters`, `DeploymentEnvironment`) match the verified dependency code (`ops.types.ts:40-84`)
- [x] No helper call patterns are introduced (no code)

**Invocation Prompt Conformance: PASS.**

---

## Authorized Next Step

> You are authorized to run the copilot check (`01.7`) as step 1b, then generate a session execution prompt for WP-039 to be saved as:
> `docs/ai/invocations/session-wp039-post-launch-metrics-live-ops.md`

**Guard:** The session prompt must conform exactly to the scope, constraints, and decisions locked by this pre-flight. No new scope may be introduced. Copilot check must return CONFIRM before session prompt generation.

**Pre-session actions — ALL RESOLVED (2026-04-23):**

1. **PS-1:** Path A applied — WP-039 and EC-039 rewritten to drop parallel severity/metric types, align with `INCIDENT_RESPONSE.md` severity semantics, reuse `IncidentSeverity` and `OpsCounters`, and name those documents AUTHORITATIVE in Context (Read First).

No further pre-session actions required.

---

## Final Instruction

Pre-flight v2 confirms that the Path A rewrite resolves the three v1 blockers by construction. The WP is now shaped to **prevent** the failure modes that caused the drift — parallel types are grep-guarded, severity semantics are cross-linked rather than restated, and the authority chain now leads with the previously-missed authorities.

Copilot check (`01.7`) may proceed.
