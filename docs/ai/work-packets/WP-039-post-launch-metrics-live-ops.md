# WP-039 — Post-Launch Metrics & Live Ops

**Status:** Ready  
**Primary Layer:** Live Operations / Observability / System Stewardship  
**Dependencies:** WP-035, WP-038

---

## Session Context

WP-035 established the ops playbook, the `OpsCounters` counter surface
([packages/game-engine/src/ops/ops.types.ts:40](packages/game-engine/src/ops/ops.types.ts:40)), the
`IncidentSeverity` severity taxonomy
([ops.types.ts:84](packages/game-engine/src/ops/ops.types.ts:84)), and the landed
severity-response doc `docs/ops/INCIDENT_RESPONSE.md` (P0 corrupted state →
rollback; P1 replay desync → freeze; P2 invalid turn spikes → investigate; P3
content lint warnings → backlog). WP-036 created AI simulation baselines.
WP-037 established beta baselines. WP-038 defined the launch readiness
checklist and post-launch guardrails. WP-031 enforced engine invariants.

This packet defines the **steady-state live-ops rhythm** — the cadence,
change-management gates, and success criteria that sit on top of the
already-landed ops machinery. It does **not** introduce new severity
taxonomies, parallel counter containers, or duplicate severity
classifications. The existing `IncidentSeverity` and `OpsCounters` types
are authoritative.

Metrics are derived from deterministic sources only (D-0901). Stability
takes priority over growth. This is not about chasing numbers — it's
about maintaining trust.

---

## Goal

Define the post-launch live-operations rhythm. After this session:

- A single new document — `docs/ops/LIVE_OPS_FRAMEWORK.md` — exists
- The framework doc **reuses** the landed severity taxonomy from
  `docs/ops/INCIDENT_RESPONSE.md` (P0/P1/P2/P3 as already defined) and the
  landed `OpsCounters` counter surface — no parallel definitions
- A live-ops cadence is defined: daily health review, weekly baseline
  review, monthly balance evaluation
- Change-management rules define what is allowed (validated content,
  simulated balance tweaks, semantic-preserving UI) and forbidden
  (unversioned rule changes, hot-patches, silent behavior changes)
- Success criteria are documented: invariants at zero, replays trustworthy,
  balance drift slow, rollback always possible
- Explicit non-goals are documented: retention funnels, monetization
  analytics, marketing metrics, auto-healing
- This packet produces **documentation only** — zero engine code, zero
  new types, zero re-exports

---

## Assumes

- WP-035 complete. Specifically:
  - `packages/game-engine/src/ops/ops.types.ts` exports `OpsCounters`,
    `DeploymentEnvironment`, `IncidentSeverity`
  - `docs/ops/INCIDENT_RESPONSE.md` defines the P0/P1/P2/P3 severity
    taxonomy and response actions
  - `docs/ops/DEPLOYMENT_FLOW.md` defines the dev→test→staging→prod
    promotion path
  - `docs/ops/RELEASE_CHECKLIST.md` defines release gates
- WP-036 complete — AI simulation baselines established
- WP-037 complete — beta baselines established (`docs/beta/`)
- WP-038 complete — launch readiness checklist and go-live guardrails
- WP-031 complete — engine invariants enforced
- WP-032 complete — network authority model exists
- WP-027 complete — replay verification functional
- WP-034 complete — versioning with three axes exists
- `pnpm --filter @legendary-arena/game-engine build` exits 0
- `pnpm --filter @legendary-arena/game-engine test` exits 0
- `docs/ai/ARCHITECTURE.md` exists with "MVP Gameplay Invariants"
- `docs/ai/DECISIONS.md` exists with D-0702, D-0901, D-0902, D-1002, D-3501

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- **`docs/ops/INCIDENT_RESPONSE.md` — AUTHORITATIVE for severity semantics.**
  The P0/P1/P2/P3 taxonomy, response actions, and rationale (D-0802 vs
  D-1234 ladder explanation) are **already defined here**. The framework
  doc must not re-derive or contradict this taxonomy.
- **`packages/game-engine/src/ops/ops.types.ts` — AUTHORITATIVE for ops
  types.** `IncidentSeverity` and `OpsCounters` already exist and are
  exported from `@legendary-arena/game-engine`. Do not introduce parallel
  types.
- `docs/ops/DEPLOYMENT_FLOW.md` — promotion path; the framework doc
  references but does not duplicate.
- `docs/ops/RELEASE_CHECKLIST.md` — release gates; the framework doc
  references for change-management.
- `docs/ops/LAUNCH_READINESS.md`, `docs/ops/LAUNCH_DAY.md` — WP-038
  outputs; the framework doc takes over once launch is behind us.
- `docs/ai/ARCHITECTURE.md — "Layer Boundary (Authoritative)"` — live
  ops is an operations concern, external to the engine. Metrics are
  derived from engine output, never injected into the engine.
- `docs/ai/DECISIONS.md` — D-0901 (Deterministic Metrics Only), D-0902
  (Rollback Is Always Possible), D-0702 (Balance Changes Require
  Simulation), D-1002 (Immutable Surfaces Are Protected), D-3501
  (`src/ops/` classification).
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 4 (no abbreviations),
  Rule 13 (ESM only).

---

## Non-Negotiable Constraints

**Packet-specific:**
- This packet produces **documentation only** — zero TypeScript files
  added, modified, or moved
- **Reuse `IncidentSeverity` from `ops.types.ts`** — do not define
  `MetricPriority`, `MetricSeverity`, or any parallel `P0|P1|P2|P3`
  union type. The existing type is authoritative.
- **Reuse `OpsCounters`** as the authoritative ops observability surface
  for invariant violations, rejected turns, replay failures, and
  migration failures. Do not define a parallel counter container.
- **Severity semantics must match `docs/ops/INCIDENT_RESPONSE.md`
  exactly.** Replay desync is P1 (not P0). Any proposal to reclassify
  requires a new DECISIONS.md entry amending INCIDENT_RESPONSE.md
  *before* WP-039 can execute — not inside WP-039.
- All metrics referenced in the framework doc are **derived from
  deterministic sources** — no client-side estimates, no sampling that
  breaks replay equivalence (D-0901)
- No balance changes without AI re-validation (D-0702)
- No unversioned hot-fixes — all changes go through release gates (WP-035)
- No rule changes without version increment (D-1002)
- The engine does not auto-heal — monitoring is passive, humans decide

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the
  human before proceeding
- If an apparent gap in `INCIDENT_RESPONSE.md` or `ops.types.ts` is
  discovered mid-execution, stop and escalate — do not fill the gap inside
  WP-039

**Locked contract values:**

Severity taxonomy (verbatim from `INCIDENT_RESPONSE.md:32-34`):

| Level | Incident | Action |
|---|---|---|
| P0 | Corrupted game state | Immediate rollback |
| P1 | Replay desync | Freeze deployments |
| P2 | Invalid turn spikes | Investigate |
| P3 | Content lint warnings | Backlog |

Counter surface (verbatim from `ops.types.ts:40-49`):

| Field | Type | Meaning |
|---|---|---|
| `invariantViolations` | `readonly number` | Total failures from `runAllInvariantChecks` |
| `rejectedTurns` | `readonly number` | Total turn intents rejected by `validateIntent` |
| `replayFailures` | `readonly number` | Total failures from `verifyDeterminism` |
| `migrationFailures` | `readonly number` | Total failures from `migrateArtifact` |

These values are NOT re-derived or re-interpreted in the framework doc.

---

## Scope (In)

### A) `docs/ops/LIVE_OPS_FRAMEWORK.md` — new

A steady-state live-ops rhythm document covering:

**§1 Purpose.** Live ops exists to preserve engine correctness, gameplay
stability, determinism, and player trust after launch. Stability takes
priority over growth.

**§2 Foundational Constraints.** Deterministic metrics only (D-0901);
replay equivalence preserved; rollback always possible (D-0902);
stability over growth; no silent change.

**§3 Severity Taxonomy (Reference, Not Re-derivation).** Cross-link to
`INCIDENT_RESPONSE.md` for the P0/P1/P2/P3 definitions. Do **not**
restate the severity table beyond a "see INCIDENT_RESPONSE.md" pointer.
Include one paragraph establishing that live-ops metrics use the
**same** severity levels as incident response — no parallel taxonomy.

**§4 Observability Surface (Reference).** Cross-link to `OpsCounters`
in `ops.types.ts`. The four counters (`invariantViolations`,
`rejectedTurns`, `replayFailures`, `migrationFailures`) are the
authoritative ops observability surface. Do not redefine them.

**§5 Metric Label Conventions.** Four review-cadence groupings used for
organizing human attention (NOT a typed union, NOT a parallel severity):
- *System Health* — invariant violations, rejected turns, replay
  failures, migration failures. Sourced from `OpsCounters`.
- *Gameplay Stability* — completion rate, average turn count,
  scheme-loss vs mastermind-victory ratio, early-abandon rate.
  Sourced from replay logs and final-state snapshots.
- *Balance Signals* — win rate by hero/scheme, dominant action
  sequences, VP distribution skew, wound accumulation curves.
  Sourced from replay logs.
- *UX Friction* — invalid move frequency by phase, rule clarification
  errors, tutorial drop-off. Sourced from replay logs and support
  channels.

These labels are organizational prose, not code constants. Severity for
any event in any group follows `INCIDENT_RESPONSE.md` directly.

**§6 Data Collection Rules.**
- All metrics derived from: final game state, turn log, replay data
- No client-side estimates; no sampling that breaks replay equivalence
- Metric derivations must be exactly reproducible from replay data —
  transformations that cannot be replay-re-derived are invalid
- Every metric value is version-tagged with engine build version

**§7 Live Ops Cadence.**
- Daily: review `OpsCounters` for P0/P1 incidents; confirm zero
  invariant violations
- Weekly: compare human metrics against AI simulation baselines
  (WP-036) and beta baselines (WP-037); review abandoned games
- Monthly: evaluate balance signals; plan next validated content or
  balance update
- Exceptions outside cadence are permitted only for P0/P1 incidents

**§8 Change Management.**
- **Allowed:** content updates validated via WP-033; balance tweaks
  validated by AI simulation (WP-036); UI updates that preserve
  gameplay semantics
- **Forbidden:** rule changes without version increment (D-1002);
  unversioned hot-patches; silent behavior changes; changes justified
  solely by live metrics

**§9 Success Criteria.**
- Invariant violations remain at zero
- Replays remain trustworthy across versions
- Balance metrics drift slowly and explainably
- Rollback capability is preserved (D-0902)
- Emergency balance changes are avoided

**§10 Non-Goals.**
- Retention funnels, monetization analytics, marketing metrics
- Automated behavior correction, engine auto-healing
- Parallel severity taxonomy (see §3)
- Parallel counter containers (see §4)
- Engine or server modifications

**§11 Summary.** Live ops are stewardship, not optimization. Metrics
preserve determinism, detect regressions, and maintain trust. Human
judgment governs all actions.

---

## Out of Scope

- **No new TypeScript files.** Zero source code added, modified, or
  deleted. `metrics.types.ts` is explicitly out of scope (pre-flight
  found this would duplicate existing types).
- **No re-exports in `types.ts` or `index.ts`.** The existing ops
  types are already exported from `index.ts:331-336`.
- **No parallel severity or counter types.** See Non-Negotiable
  Constraints.
- **No metrics collection infrastructure** — the framework doc
  describes what is observed; collection tooling is a follow-up WP
- **No dashboard implementation**
- **No player retention funnels**
- **No monetization metrics**
- **No marketing analytics**
- **No social features**
- **No engine modifications**
- **No server changes**
- **No modifications to `INCIDENT_RESPONSE.md`, `ops.types.ts`, or any
  other landed artifact.** If gaps are found, stop and escalate.
- Refactors, cleanups, or "while I'm here" improvements are
  **out of scope**

---

## Vision Alignment

> Per `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md §17`. Live ops is
> where post-launch drift becomes silent if metrics aren't deterministic.

**Vision clauses touched:** §3, §5, §13, §14, §22, §24

**Conflict assertion:** No conflict. Metrics are derived from
deterministic sources (D-0901), preserving §22 and §24. "Hot-patches
forbidden / validated content OK" enforces §14. The "stability > growth"
stance defends §5 and the Financial Sustainability covenant by refusing
growth-at-all-costs trade-offs.

**Non-Goal proximity:** Confirmed clear of NG-1..7. Metrics are
privacy-preserving and never tied to monetization triggers. No metric
informs paid-surface tuning (which would risk NG-6 dark patterns).

**Determinism preservation:** Confirmed. All metric groupings derive
from deterministic sources. Severity follows the landed
`INCIDENT_RESPONSE.md` taxonomy exactly — replay desync is P1, no
parallel contract. Alerting reuses the WP-035 `IncidentSeverity` type —
no parallel contract.

---

## Files Expected to Change

- `docs/ops/LIVE_OPS_FRAMEWORK.md` — **new** — live-ops rhythm document

No other files may be modified. Specifically:

- `packages/game-engine/src/ops/**` — **NOT MODIFIED** (existing types
  are authoritative)
- `packages/game-engine/src/types.ts` — **NOT MODIFIED**
- `packages/game-engine/src/index.ts` — **NOT MODIFIED**
- `docs/ops/INCIDENT_RESPONSE.md` — **NOT MODIFIED**
- `docs/ops/DEPLOYMENT_FLOW.md` — **NOT MODIFIED**
- `docs/ops/RELEASE_CHECKLIST.md` — **NOT MODIFIED**

Governance updates (STATUS.md, DECISIONS.md, WORK_INDEX.md) are
session-close artifacts, not in the main file list.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Framework Document
- [ ] `docs/ops/LIVE_OPS_FRAMEWORK.md` exists with sections §1–§11 as
      described in Scope (In)
- [ ] Framework doc cross-links to `INCIDENT_RESPONSE.md` for severity
      taxonomy (does NOT restate the P0/P1/P2/P3 table beyond a
      reference pointer)
- [ ] Framework doc cross-links to `OpsCounters` in `ops.types.ts` for
      the authoritative observability surface (does NOT redefine the
      four counter fields)
- [ ] Replay desync is classified as **P1** in the framework doc
      (matches `INCIDENT_RESPONSE.md:33`)
- [ ] Metric label conventions (§5) are prose organizational groupings,
      NOT typed unions or code constants

### Data Collection Rules
- [ ] All metrics derived from deterministic sources (stated explicitly)
- [ ] Version-tagging required
- [ ] No client-side estimates
- [ ] Metric derivations stated to be exactly reproducible from replay
      data; non-replay-derivable transformations explicitly invalid

### Live Ops Cadence
- [ ] Daily, weekly, monthly cadence documented
- [ ] No ad-hoc changes outside cadence except P0/P1

### Change Management
- [ ] Allowed changes listed with validation requirements
- [ ] Forbidden changes listed (including "changes justified solely by
      live metrics" as forbidden)

### Scope Enforcement (Critical)
- [ ] No TypeScript files added, modified, or deleted
      (confirmed with `git diff --name-only`)
- [ ] No modifications to `ops.types.ts`, `INCIDENT_RESPONSE.md`,
      `DEPLOYMENT_FLOW.md`, or `RELEASE_CHECKLIST.md`
      (confirmed with `git diff --name-only`)
- [ ] No new `MetricPriority`, `MetricSeverity`, `MetricCategory`,
      `MetricEntry`, or similar parallel types anywhere in the repo
      (confirmed with grep)
- [ ] No files outside `## Files Expected to Change` + governance
      (STATUS/DECISIONS/WORK_INDEX) were modified
      (confirmed with `git diff --name-only`)

### Build & Test Baseline
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` — all baseline
      tests continue to pass, no regression (baseline recorded at
      pre-flight v2 2026-04-23 was 444/444; if repo state advances
      before execution, the executing session records the new baseline
      in STATUS.md rather than editing this WP)

---

## Verification Steps

```pwsh
# Step 1 — baseline build and test (must be green before and after)
pnpm --filter @legendary-arena/game-engine build
pnpm --filter @legendary-arena/game-engine test
# Expected: build exits 0; tests 444/444 pass

# Step 2 — confirm live ops doc exists with expected sections
Test-Path "docs\ops\LIVE_OPS_FRAMEWORK.md"
# Expected: True
Select-String -Path "docs\ops\LIVE_OPS_FRAMEWORK.md" -Pattern "^## "
# Expected: §1..§11 headings present

# Step 3 — confirm no TypeScript files were modified
git diff --name-only | Select-String -Pattern "\.ts$|\.mts$|\.cts$"
# Expected: no output

# Step 4 — confirm no new parallel severity/metric types anywhere
Select-String -Path "packages\game-engine\src" -Pattern "MetricPriority|MetricSeverity|MetricCategory|MetricEntry" -Recurse
# Expected: no output

# Step 5 — confirm INCIDENT_RESPONSE.md and ops.types.ts are untouched
git diff --name-only docs/ops/INCIDENT_RESPONSE.md packages/game-engine/src/ops/ops.types.ts
# Expected: no output

# Step 6 — confirm framework doc references existing authorities
Select-String -Path "docs\ops\LIVE_OPS_FRAMEWORK.md" -Pattern "INCIDENT_RESPONSE.md|OpsCounters|IncidentSeverity"
# Expected: at least one match each

# Step 7 — confirm replay desync is P1 in framework doc
Select-String -Path "docs\ops\LIVE_OPS_FRAMEWORK.md" -Pattern "replay.*P1|P1.*replay"
# Expected: at least one match

# Step 8 — confirm no files outside scope
git diff --name-only
# Expected: only docs/ops/LIVE_OPS_FRAMEWORK.md and governance files
# (STATUS.md, DECISIONS.md, WORK_INDEX.md)
```

---

## Definition of Done

> Claude Code must execute every verification command in `## Verification Steps`
> before checking any item below. Reading the doc is not sufficient — run the
> commands.
>
> Every item must be true before this packet is considered complete.

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria above pass
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` — all baseline
      tests pass, no regression (pre-flight v2 2026-04-23 recorded
      444/444; executing session re-records current baseline in
      STATUS.md if repo advanced)
- [ ] Live ops framework doc exists with sections §1–§11
- [ ] Framework doc reuses `IncidentSeverity` and `OpsCounters` by
      reference (does not define parallel types)
- [ ] Replay desync classified as P1 in framework doc (matches
      `INCIDENT_RESPONSE.md`)
- [ ] No TypeScript files modified (confirmed with `git diff`)
- [ ] No parallel `MetricPriority`/`MetricEntry`/etc. types introduced
      (confirmed with grep)
- [ ] No modifications to `INCIDENT_RESPONSE.md` or `ops.types.ts`
      (confirmed with `git diff`)
- [ ] No files outside `## Files Expected to Change` + governance were
      modified (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — live ops framework defined;
      cadence and change-management documented; severity taxonomy
      reused from `INCIDENT_RESPONSE.md`; D-0901 reinforced
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: entry documenting
      that live ops reuses `IncidentSeverity` and `OpsCounters` rather
      than defining parallel types (this is the key design decision of
      WP-039 under Path A); entry or cross-reference to D-0901, D-0902,
      D-0702, D-1002 as the governing authorities
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-039 checked off with
      today's date
