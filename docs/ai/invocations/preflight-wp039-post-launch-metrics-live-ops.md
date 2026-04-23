# Pre-Flight — WP-039 Post-Launch Metrics & Live Ops

**Target Work Packet:** `WP-039`
**Title:** Post-Launch Metrics & Live Ops
**Previous WP Status:** WP-038 Complete (2026-04-22, commit `2134f33`)
**Pre-Flight Date:** 2026-04-23
**Invocation Stage:** Pre-Execution (Scope & Readiness)
**Repo-state anchor:** `main @ ba2490e` (WP-085 mindmap back-sync)

**Work Packet Class:** Contract-Only / Documentation-Only

Rationale: WP-039 (as currently scoped) produces one new doc under `docs/ops/`, one new types file under `packages/game-engine/src/ops/`, and two re-export updates. It ships zero new tests, zero move code, zero phase hooks, zero `G` mutation, zero `game.ts` wiring. Matches the WP-035 / WP-037 / WP-038 Docs-class Phase 7 precedent chain.

Mandatory sections per class: Dependency & Sequencing Check, Input Data Traceability, Structural Readiness, Scope Lock, Test Expectations, Risk Review. Skipped: Runtime Readiness, Mutation Boundary. Included: Dependency Contract Verification (load-bearing for this WP due to pre-existing ops types), Code Category Boundary Check.

---

## Pre-Flight Intent

Perform a pre-flight validation for WP-039.

- Not implementing.
- Not generating code.
- Validating readiness and constraints only.

Verdict is binary (READY / NOT READY).

---

## Authority Chain (Read in Order)

1. `.claude/CLAUDE.md` — EC-mode, lint gate, commit discipline — read.
2. `docs/ai/ARCHITECTURE.md` — Layer Boundary, Architectural Principle #1 (Determinism) — read.
3. `docs/01-VISION.md` — §3 (Trust & Fairness), §5 (Longevity), §13, §14, §22, §24 — read. Clause titles verified.
4. `docs/03.1-DATA-SOURCES.md` — reviewed. WP-039 introduces no new input datasets.
5. `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` — `packages/game-engine/src/ops/` already classified as engine category per D-3501 (line 102).
6. `docs/ai/execution-checklists/EC-039-live-ops.checklist.md` — read (post iterative tightening this session).
7. `docs/ai/work-packets/WP-039-post-launch-metrics-live-ops.md` — read (post iterative tightening this session).
8. **`docs/ops/INCIDENT_RESPONSE.md` — read. LOAD-BEARING. Contains the pre-existing severity taxonomy (P0/P1/P2/P3).**
9. **`packages/game-engine/src/ops/ops.types.ts` — read. LOAD-BEARING. Contains pre-existing `IncidentSeverity` and `OpsCounters` types.**

Higher-authority documents win where they conflict with lower. **Three conflicts found — see Structural Readiness and Risk Review sections.**

---

## Vision Sanity Check (01.4 §Vision Sanity Check)

- **Vision clauses touched by this WP:** §3 (Player Trust & Fairness), §5 (Longevity & Expandability), §13 (Execution Checklist–Driven Development), §14 (Explicit Decisions, No Silent Drift), §22 (Deterministic & Reproducible Evaluation), §24 (Replay-Verified Competitive Integrity).
- **Conflict assertion:** `No conflict: this WP preserves all touched clauses.`
- **Non-Goal proximity:** `N/A — WP touches no monetization or competitive surface.`
- **Determinism preservation:** WP-039 does not introduce runtime logic. All metrics derive from existing deterministic surfaces (turn log, replay data, final state). Replay equivalence is explicitly preserved per D-0901.
- **WP `## Vision Alignment` section status:** Present in WP-039 at §Vision Alignment. Clause citations match VISION.md.

**Vision Sanity Check: PASS.**

---

## Dependency & Sequencing Check

| WP | Status | Evidence |
|---|---|---|
| WP-034 Versioning | PASS | `packages/game-engine/src/versioning/` exports `CURRENT_DATA_VERSION`, `getCurrentEngineVersion`, etc. ([index.ts:313-329](packages/game-engine/src/index.ts:313)) |
| WP-035 Release Process | PASS | `docs/ops/RELEASE_CHECKLIST.md`, `DEPLOYMENT_FLOW.md`, `INCIDENT_RESPONSE.md` present |
| WP-036 AI Simulation | PASS | `packages/game-engine/src/simulation/` present |
| WP-037 Public Beta | PASS | `docs/beta/`, `packages/game-engine/src/beta/` present |
| WP-038 Launch Readiness | PASS | `docs/ops/LAUNCH_READINESS.md`, `LAUNCH_DAY.md` present; WORK_INDEX:1373 marks complete at `2134f33` (2026-04-22) |

All D-entries cited by WP-039 verified present in DECISIONS.md (em-dash encoding):

- D-0702 — Balance Changes Require Simulation (DECISIONS.md:285)
- D-0901 — Deterministic Metrics Only (DECISIONS.md:328)
- D-0902 — Rollback Is Always Possible (DECISIONS.md:336)
- D-1002 — Immutable Surfaces Are Protected (DECISIONS.md:354)
- D-3501 — `packages/game-engine/src/ops/` classified as engine (DECISIONS.md:5341)

No sequencing blockers.

---

## Dependency Contract Verification

**CRITICAL SECTION — three blocking findings.**

### Finding 1 (BLOCKER) — Duplicate engine-wide severity type

WP-039 §B proposes:

```ts
type MetricPriority = 'P0' | 'P1' | 'P2' | 'P3';
```

An identical union is already exported from the `ops` directory:

```ts
// packages/game-engine/src/ops/ops.types.ts:84
export type IncidentSeverity = 'P0' | 'P1' | 'P2' | 'P3';
```

Re-exported at [index.ts:331-336](packages/game-engine/src/index.ts:331). Same directory (`src/ops/`), same semantic space (severity classification for ops observability), same union shape.

**Structural Readiness Check #3 fails:** *"No naming or ownership conflicts (no duplicate 'engine-wide' types)"* ([01.4:601](docs/ai/REFERENCE/01.4-pre-flight-invocation.md:601)).

### Finding 2 (BLOCKER) — Direct contradiction with INCIDENT_RESPONSE.md severity semantics

Pre-existing landed doc [INCIDENT_RESPONSE.md:32-34](docs/ops/INCIDENT_RESPONSE.md:32) classifies:

| Level | Incident | Action |
|---|---|---|
| P0 | Corrupted game state | Immediate rollback |
| **P1** | **Replay desync** | **Freeze deployments** |
| P2 | Invalid turn spikes | Investigate |
| P3 | Content lint warnings | Backlog |

WP-039 (after this session's terminology-fix edits) classifies:
- "Same-version replay hash mismatches" as **P0 invariant-violation subtype**
- "Cross-version replay divergence" as P1

**Direct semantic contradiction.** The same observable event (replay verification failure) receives different severity under the two documents. [INCIDENT_RESPONSE.md:71-75](docs/ops/INCIDENT_RESPONSE.md:71) already documents the rationale for the P1 classification: *"P1 is the engine's canonical 'something subtle is broken, stop shipping' signal."*

The terminology-fix was a well-intended improvement when the conflict with INCIDENT_RESPONSE.md was not visible. The landed doc is higher-authority and already answered this question.

### Finding 3 (BLOCKER) — Parallel metric container

[ops.types.ts:40-49](packages/game-engine/src/ops/ops.types.ts:40) already models the four cumulative ops counters:

```ts
export interface OpsCounters {
  readonly invariantViolations: number;
  readonly rejectedTurns: number;
  readonly replayFailures: number;
  readonly migrationFailures: number;
}
```

WP-039's P0 System Health list (invariant violations, rejected turn rate, replay mismatches, migration failures) is exactly this set of four metrics. WP-039's `MetricEntry` envelope would be a parallel representation of the same observability surface.

**Structural Readiness Check #3 fails again:** parallel engine-wide container for an already-modeled concern.

---

## Input Data Traceability Check

- All non-user-generated inputs: YES (none consumed — metrics derive from existing deterministic surfaces)
- Storage location for each input: YES (turn log, replay data, final state — all in-memory in `G` at runtime, never persisted)
- Inspection path on incorrect behavior: YES (replay files on disk; `G` snapshots in server)
- No implicit data: YES
- Setup-time derived fields: YES (none introduced)

**Input Data Traceability: PASS** (contingent on WP-039 remaining metadata-only; if future collection infrastructure is added, [03.1-DATA-SOURCES.md](docs/03.1-DATA-SOURCES.md) must register it).

---

## Structural Readiness Check

- [x] All prior WPs compile and tests pass: 444/444 passing at baseline
- [x] No known EC violations remain open
- [ ] **Required types exist and are exported — FAIL:** `MetricPriority` collides with exported `IncidentSeverity`; `MetricEntry` collides with exported `OpsCounters`
- [ ] **No naming or ownership conflicts — FAIL:** duplicate engine-wide types in same directory
- [ ] **No architectural boundary conflicts anticipated — FAIL:** WP-039 framework doc contradicts landed `docs/ops/INCIDENT_RESPONSE.md` severity semantics
- [x] Database / migrations: N/A
- [x] R2 data: N/A
- [x] G field subfields: N/A (metadata only)

**Structural Readiness: FAIL (three NO answers).** Per [01.4:614](docs/ai/REFERENCE/01.4-pre-flight-invocation.md:614): *"Any NO must be explained. If any answer is NO, pre-flight is NOT READY."*

---

## Code Category Boundary Check

- [x] `packages/game-engine/src/ops/` is engine category (D-3501)
- [x] `docs/ops/LIVE_OPS_FRAMEWORK.md` is docs category; `docs/ops/` already exists
- [x] No file blurs category boundaries

**Code Category: PASS.** The duplicate-type issue is not a category problem — it's a uniqueness problem within an approved category.

---

## Scope Lock — Current WP-039 (blocked)

Scope as currently written:

- Create: `docs/ops/LIVE_OPS_FRAMEWORK.md`
- Create: `packages/game-engine/src/ops/metrics.types.ts` (with `MetricPriority`, `MetricCategory`, `MetricEntry`)
- Modify: `packages/game-engine/src/types.ts` (re-export)
- Modify: `packages/game-engine/src/index.ts` (re-export)

**Scope Lock: UNAPPROVED** — resolution path required before execution.

---

## Test Expectations (Locked Before Execution)

- 0 new tests (Contract-Only / Documentation-Only)
- All 444 existing tests must continue to pass
- No `boardgame.io/testing` imports
- No `makeMockCtx` modifications
- `MetricEntry` (or replacement type) must be JSON-serializable and not stored in `G`

Test expectations are valid; however, no test guards the duplicate-type risk because the WP has not accounted for it. If Path A resolution is applied, test expectations update to: *no new types that duplicate `IncidentSeverity` or `OpsCounters`*.

---

## Risk & Ambiguity Review

| # | Risk | Impact | Mitigation / Decision |
|---|---|---|---|
| R1 | `MetricPriority` duplicates `IncidentSeverity` | HIGH | Drop `MetricPriority`; reuse `IncidentSeverity` |
| R2 | `MetricEntry` duplicates `OpsCounters` observability surface | HIGH | Reshape `MetricEntry` as label+value envelope that references `IncidentSeverity`; or drop entirely and treat framework doc as documentation of `OpsCounters` + cadence |
| R3 | WP-039 "same-version replay hash = P0" contradicts INCIDENT_RESPONSE.md "replay desync = P1" | HIGH | Drop the same-version/cross-version split; align with landed doc — replay desync is P1, full stop. If the same-version P0 semantics is believed correct, it requires a new DECISIONS.md entry amending INCIDENT_RESPONSE.md before WP-039 can ship |
| R4 | Framework doc may duplicate content in INCIDENT_RESPONSE.md, DEPLOYMENT_FLOW.md, RELEASE_CHECKLIST.md | MEDIUM | Re-scope `LIVE_OPS_FRAMEWORK.md` to cadence + cross-link existing ops docs, rather than re-derive severity taxonomy |
| R5 | `MetricCategory` ('systemHealth' / 'gameplayStability' / 'balanceSignals' / 'uxFriction') has no pre-existing collision | LOW | Retain as framework-doc convention labels; it is not obviously needed as an engine-level union type if metric collection infrastructure is out of scope |

All risks resolved via Path A (see Verdict section). Path A locks for execution.

---

## Pre-Flight Verdict (Binary)

# DO NOT EXECUTE YET

Three blocking findings:

1. `MetricPriority` duplicates pre-existing `IncidentSeverity` in the same directory (Structural Readiness #3 violation).
2. WP-039 severity rules contradict landed `docs/ops/INCIDENT_RESPONSE.md` (replay desync already classified P1, WP-039 says same-version mismatch is P0).
3. `MetricEntry` creates parallel container for the four metrics already modeled by `OpsCounters`.

All three are authority-chain violations: WP-039 was tightened this session without reading the pre-existing `src/ops/` contract or the landed incident-response doc. Fixing them is a scope narrowing, not a scope expansion.

---

## Authorized Next Step

**Pre-session actions — REQUIRED (to be resolved before re-preflight):**

1. **PS-1:** Rewrite WP-039 and EC-039 under Path A. Specifically:
   - Drop `MetricPriority`, `MetricCategory`, `MetricEntry` as new types. Reuse `IncidentSeverity` from `ops.types.ts` where severity is needed.
   - Reshape WP-039 §B to either (a) no new type file at all, or (b) a thin `MetricLabel` envelope that references `IncidentSeverity` and has no P0/P1/P2/P3 parallel union. Strongly prefer (a) for MVP.
   - Align WP-039 severity semantics with INCIDENT_RESPONSE.md: replay desync = P1, full stop. Drop the same-version vs cross-version split. If the finer classification is genuinely desired, file a separate DECISIONS.md entry amending INCIDENT_RESPONSE.md first.
   - Re-scope `LIVE_OPS_FRAMEWORK.md` to focus on: cadence, change management, success criteria, non-goals, and cross-links to INCIDENT_RESPONSE.md + DEPLOYMENT_FLOW.md + RELEASE_CHECKLIST.md for the severity taxonomy (do not re-derive).

2. **PS-2:** Once PS-1 is applied, re-run pre-flight (this artifact is a fresh pass, not an amendment — per [01.4:127](docs/ai/REFERENCE/01.4-pre-flight-invocation.md:127): *"if resolution changes scope, step 1 must be re-run before step 1b"*).

**Guard:** No session execution prompt may be generated until PS-1 is applied and a fresh preflight returns READY TO EXECUTE.

---

## Final Instruction

Pre-flight exists to prevent premature execution and scope drift.

This pre-flight caught a case of drift against unread authority docs. The three tightening passes this session were internally coherent but architecturally uninformed — the fix is scope narrowing, not a new design.

**DO NOT PROCEED TO EXECUTION.** Apply PS-1, re-run pre-flight.
