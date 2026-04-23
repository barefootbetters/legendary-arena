# Live Ops Framework — Post-Launch Operating Rhythm

**Status:** Authoritative (WP-039)
**Owner:** Live Operations / System Stewardship
**Related decisions:** D-0702 (Balance Changes Require Simulation),
D-0802 (Incompatible Data Fails Loudly), D-0901 (Deterministic Metrics
Only), D-0902 (Rollback Is Always Possible), D-1002 (Immutable Surfaces
Are Protected), D-1234 (Graceful Degradation for Unknown Types), D-3501
(Ops Metadata Code Category), D-3801 (Single Launch Authority), D-3802
(72-Hour Post-Launch Change Freeze), D-3803 (Launch Gates Inherit from
Beta Exit Gates)
**Companion documents:** `docs/ops/INCIDENT_RESPONSE.md` (authoritative
for severity semantics), `docs/ops/RELEASE_CHECKLIST.md` (release
gates), `docs/ops/DEPLOYMENT_FLOW.md` (promotion path),
`docs/ops/LAUNCH_READINESS.md` (pre-launch gates), `docs/ops/LAUNCH_DAY.md`
(launch-day procedure). Live-ops observability types live in
`packages/game-engine/src/ops/ops.types.ts` (`IncidentSeverity`,
`OpsCounters`, `DeploymentEnvironment`).

This document defines the **steady-state post-launch operating rhythm**
for Legendary Arena. It takes over from `LAUNCH_READINESS.md` and
`LAUNCH_DAY.md` once the 72-hour post-launch freeze (D-3802) closes and
operations enter steady state. It is a binary pass/fail discipline: each
success-criteria clause, cadence gate, and change-management rule below
has a measurable pass/fail form with a named source signal, and there is
no partial-compliance state.

The engine that runs at launch is the engine that runs in live ops —
there is no "live-ops mode," no "post-launch mode," and no parallel
severity or counter surface anywhere in `packages/game-engine/`.
Live-ops monitoring **observes** the engine; it never mutates it. The
engine does not auto-heal (per `INCIDENT_RESPONSE.md`); monitoring is
passive and human judgment governs every corrective action.

---

## 1. Purpose

Live ops exists to preserve engine correctness, gameplay stability,
determinism, and player trust after launch. Stability takes priority
over growth. Metrics preserve determinism, detect regressions, and
maintain trust — they are not a growth-tuning surface and they do not
inform paid-surface mechanics (see §10 Non-Goals).

The framework is built on four load-bearing assumptions:

1. **The engine is the source of truth.** Every metric is derived from
   deterministic engine output — final game state, turn log, replay
   data — per D-0901. No client-side estimate, no sampling path that
   breaks replay equivalence, and no metric that cannot be
   re-derived from replay data is admissible.
2. **Severity is already modeled.** The four-level severity taxonomy
   (`IncidentSeverity`) lives in
   `packages/game-engine/src/ops/ops.types.ts` and its semantics live
   in `docs/ops/INCIDENT_RESPONSE.md`. Live ops consumes both surfaces
   directly — there is no parallel severity taxonomy, no parallel
   severity semantic, and no severity restatement beyond a pointer.
3. **The counter surface is already modeled.** The four operational
   counters (`OpsCounters.invariantViolations`,
   `OpsCounters.rejectedTurns`, `OpsCounters.replayFailures`,
   `OpsCounters.migrationFailures`) live in the same `ops.types.ts`
   file. Live ops consumes this surface directly — there is no parallel
   counter container and no counter redefinition.
4. **Rollback capability is preserved.** D-0902 holds across the live-ops
   rhythm — every change landed under live ops must be roll-back-safe,
   and no live-ops decision may erode rollback capability.

---

## 2. Foundational Constraints

The following constraints bind every live-ops decision, cadence review,
and change proposal. Each is binary pass/fail with a named authority.

| # | Constraint | Authority |
|---|---|---|
| 2.1 | All metrics derived from deterministic engine output only | D-0901 |
| 2.2 | Rollback capability preserved across every change | D-0902 |
| 2.3 | Replay equivalence preserved across every sampling / derivation path | D-0901 + WP-027 |
| 2.4 | Stability over growth — live-ops decisions never trade invariant safety for growth signal | Vision §5 (Financial Sustainability) + §3 (Player Trust & Fairness) |
| 2.5 | No silent change — every live-ops change is versioned, justified, and audit-logged | D-1002 |
| 2.6 | Monitoring is passive — the engine does not auto-heal and no automated system decides corrective action | `INCIDENT_RESPONSE.md` §Purpose |
| 2.7 | Severity classification follows `INCIDENT_RESPONSE.md` exactly — no parallel taxonomy and no reclassification inside live ops | `INCIDENT_RESPONSE.md` §Severity Levels |
| 2.8 | Counter surface is `OpsCounters` as defined in `ops.types.ts` — no parallel counter container | `ops.types.ts` §OpsCounters + D-3501 |

Any proposal that conflicts with a row above is a governance change,
not a live-ops change, and must route through DECISIONS.md rather than
through the live-ops cadence.

---

## 3. Severity Taxonomy (Reference, Not Re-Derivation)

The four-level severity taxonomy — `IncidentSeverity = 'P0' | 'P1' |
'P2' | 'P3'` — is defined in `packages/game-engine/src/ops/ops.types.ts`
and its full semantics, examples, and required actions are defined in
`docs/ops/INCIDENT_RESPONSE.md` §Severity Levels. Live ops reuses the
same taxonomy verbatim — there is no parallel severity classification
anywhere in this framework.

**See `docs/ops/INCIDENT_RESPONSE.md` §Severity Levels for the P0 / P1
/ P2 / P3 table and required actions.** The severity-to-action mapping
is authoritative there; this document does not restate it.

The live-ops rhythm consumes the taxonomy as follows:

- **Replay desync is classified P1**, per `INCIDENT_RESPONSE.md:33`.
  There is no same-version vs. cross-version split inside live ops —
  any replay hash disagreement between two clients of the same match,
  or between a replay harness run and the hash recorded at match time,
  routes to the P1 action (freeze deployments; investigate; escalate
  to P0 if the current `prod` artifact is implicated).
- **P0 and P1 are immediate-action events** and drive the daily review
  cadence (§7).
- **P2 events are named-investigator events** and drive the weekly
  review cadence (§7).
- **P3 events are backlog events** and drive the monthly review cadence
  (§7).

Any proposal to introduce a new severity level, a new severity example,
or a new required action is an amendment to `INCIDENT_RESPONSE.md` and
requires a new DECISIONS.md entry — not a change inside live ops.

---

## 4. Observability Surface (Reference, Not Re-Derivation)

The four operational counters are defined in
`packages/game-engine/src/ops/ops.types.ts` as the `OpsCounters`
interface. Live ops reuses the same four fields verbatim — there is no
parallel counter container, no counter redefinition, and no live-ops
extension to the field set.

**See `packages/game-engine/src/ops/ops.types.ts` §OpsCounters for the
four-field interface and each field's definition.** The field set is
authoritative there; this document does not redefine it.

Field summary (one line per field, for reader orientation only — the
authoritative definitions live in `ops.types.ts`):

- `OpsCounters.invariantViolations` — total failures from
  `runAllInvariantChecks` (WP-031).
- `OpsCounters.rejectedTurns` — total intents rejected by
  `validateIntent`.
- `OpsCounters.replayFailures` — total failures from `verifyDeterminism`
  (WP-027).
- `OpsCounters.migrationFailures` — total failures from `migrateArtifact`
  (WP-034).

The server layer constructs, increments, and persists `OpsCounters`
instances (per D-3501). The engine never reads or writes a counter at
runtime. Live ops reads `OpsCounters` snapshots; it never writes them.

Any proposal to add a fifth counter, rename a counter, or change a
counter's semantic is a change to `ops.types.ts` and
`INCIDENT_RESPONSE.md` — not a change inside live ops.

---

## 5. Metric Label Conventions (Organizational Prose Only)

The four labels below are **organizational groupings** used to structure
human review attention. They are NOT a typed union, NOT a parallel
severity, NOT a code constant, and NOT enforced by any build step. Any
future proposal to typify them into a code-level union is a separate
pre-flight and requires its own DECISIONS.md entry.

### 5.1 System Health

Sourced from `OpsCounters`. Tracks the deterministic-substrate counters
that drive the P0 / P1 immediate-action events per
`INCIDENT_RESPONSE.md`. Human attention form: daily review of the four
counters for delta vs. the prior day (§7).

### 5.2 Gameplay Stability

Sourced from replay logs and final-state snapshots. Tracks completion
rate, average turn count, scheme-loss vs. mastermind-victory ratio, and
early-abandon rate. Every value is derived from a replay-reproducible
path per D-0901; any derivation that cannot be replay-re-derived is
invalid. Human attention form: weekly review against AI simulation
baselines (WP-036) and beta baselines (WP-037).

### 5.3 Balance Signals

Sourced from replay logs. Tracks win rate by hero, win rate by scheme,
dominant action sequences, victory-point distribution skew, and wound
accumulation curves. All derived deterministically from replay data.
Human attention form: monthly evaluation before planning the next
validated content or balance update.

### 5.4 UX Friction

Sourced from replay logs and support channels. Tracks invalid-move
frequency by phase (from `rejectedTurns` plus `validateIntent`
rejection codes), rule-clarification errors raised in support, and
tutorial drop-off. Human attention form: monthly evaluation alongside
Balance Signals.

### 5.5 Severity Applies Per Event, Not Per Label

The labels above organize **where a metric lives**. The severity of any
**event** surfaced by any label follows `INCIDENT_RESPONSE.md` directly
— a replay desync surfaced via `replayFailures` under §5.1 System
Health is P1; a rule-clarification backlog item surfaced via §5.4 UX
Friction is P3. A label does not imply a severity floor or ceiling.

---

## 6. Data Collection Rules

Every metric surfaced under §5 must satisfy every rule below. Each rule
is binary pass/fail.

| # | Rule | Pass condition |
|---|---|---|
| 6.1 | Deterministic source only | Metric is derived from final game state, turn log, or replay data per D-0901 |
| 6.2 | No client-side estimates | No value is computed on a client and transmitted back as authoritative |
| 6.3 | Replay-reproducible derivation | The metric's derivation function produces a byte-identical value when re-applied to the same replay bytes; derivations that cannot be replay-re-derived are invalid and must not be admitted |
| 6.4 | Version-tagged | Every metric value carries the engine build version (`EngineVersion` + `DataVersion` + `ContentVersion` where applicable) at which it was produced |
| 6.5 | Sampling preserves replay equivalence | No sampling path drops or re-orders replay-determining records |
| 6.6 | No nondeterministic input | No wall-clock read, no random source, and no I/O call participates in a metric's derivation path (see D-0901) |

Rule 6.6 cites D-0901 rather than enumerating forbidden runtime tokens,
per `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` §18 prose-vs-grep
discipline. The enumeration of forbidden tokens lives in
`.claude/rules/architecture.md` §Determinism, which is authoritative.

A metric that fails any of rows 6.1 through 6.6 is not admitted to the
live-ops surface. Rejection is binary — there is no "partial
admission" or "temporary admission pending follow-up."

---

## 7. Live Ops Cadence

Human review happens on a daily / weekly / monthly rhythm. Each cadence
row below is binary pass/fail and has a named input surface.

| Cadence | Review scope | Input surface | Output |
|---|---|---|---|
| Daily | `OpsCounters` delta since prior day; any new P0 or P1 incident | `OpsCounters` snapshot + incident records (4 required fields each per `INCIDENT_RESPONSE.md`) | Zero-incident attestation OR named-incident response (rollback for P0; deployment freeze for P1) |
| Weekly | Human metrics vs. AI simulation baselines (WP-036); human metrics vs. beta baselines (WP-037); abandoned-game review; open P2 triage status | Replay log aggregates + baseline artifacts from WP-036 / WP-037 | Baseline-conformance attestation OR named-deviation investigation ticket |
| Monthly | Balance Signals (§5.3) + UX Friction (§5.4) evaluation; planning for the next validated content or balance update | Replay log aggregates + support channel records | Next-release content/balance plan (validated per §8) OR hold-the-line attestation |

**Out-of-cadence review is permitted only for P0 or P1 incidents** per
the `INCIDENT_RESPONSE.md` on-call model (P0/P1 are immediate-action
events; P2 is a named-investigator event; P3 is backlog). P2 events do
not trigger out-of-cadence review; they are handled on the weekly
rhythm. P3 events do not trigger out-of-cadence review; they are
handled on the monthly rhythm.

---

## 8. Change Management

Every post-launch change is classified as allowed or forbidden per the
table below. Classification is binary — there is no "provisional" or
"emergency bypass" category inside this framework. Emergency responses
to P0 or P1 incidents route through `INCIDENT_RESPONSE.md` and
`DEPLOYMENT_FLOW.md` §Rollback, not through this change-management
surface.

### 8.1 Allowed Changes

| Change | Validation requirement | Authority |
|---|---|---|
| Content update (new cards, new scenarios) | Validated via WP-033 content validation; release-gate parity per D-3704 | `RELEASE_CHECKLIST.md` |
| Balance tweak (numeric constant on validated content) | AI simulation re-validation per D-0702 (`runSimulation` WP-036 output recorded pre-ship) | D-0702 + WP-036 |
| UI update that preserves gameplay semantics | No engine / rule / RNG / scoring / endgame surface touched; semantic-preservation attestation on the PR | D-1002 (immutable surfaces) |

### 8.2 Forbidden Changes

| Change | Why forbidden |
|---|---|
| Rule change without version increment | D-1002 — immutable surfaces are protected; rule changes require a major version |
| Unversioned hot-patch | `INCIDENT_RESPONSE.md` + D-1002 — every change goes through the release gates in `RELEASE_CHECKLIST.md` |
| Silent behavior change | D-1002 + 2.5 — every change is versioned, justified, and audit-logged |
| Change justified solely by live metrics | D-0702 — balance changes require simulation; live-metric deltas on their own do not authorize a ship |
| Auto-heal, auto-compare, or engine-side corrective action | `INCIDENT_RESPONSE.md` §Purpose — monitoring is passive and humans decide |
| Parallel severity taxonomy | Constraint 2.7 and §3 above — severity is defined in `INCIDENT_RESPONSE.md` only |
| Parallel counter container | Constraint 2.8 and §4 above — the counter surface is `OpsCounters` only |

A proposed change that maps to a forbidden row is rejected at the PR
boundary. Escalating to "override this rule in this one case" is not
permitted inside live ops — the rule's authority is `ARCHITECTURE.md`
plus the cited DECISIONS.md entry, and the override path is a new
DECISIONS.md entry, not an exception inside live ops.

---

## 9. Success Criteria

Live ops is succeeding iff every clause below holds. Each clause is
binary pass/fail with a named source signal.

| # | Success criterion | Source signal |
|---|---|---|
| 9.1 | `OpsCounters.invariantViolations` delta remains at zero across each daily review window | `OpsCounters` + WP-031 `runAllInvariantChecks` |
| 9.2 | Replays remain trustworthy across versions — `OpsCounters.replayFailures` delta at zero across each daily review window, and `verifyDeterminism` passes on every representative replay in the monitoring suite | `OpsCounters` + WP-027 `verifyDeterminism` |
| 9.3 | Balance metrics drift slowly and explainably — month-over-month delta on each §5.3 Balance Signal is bounded by the AI simulation baseline tolerance (WP-036) with a recorded justification for any signal that exits tolerance | WP-036 simulation output + replay log aggregates |
| 9.4 | Rollback capability is preserved — every landed change is roll-back-safe per D-0902 and the `DEPLOYMENT_FLOW.md` rollback preflight passes on the most recent production artifact | D-0902 + `DEPLOYMENT_FLOW.md` §Rollback |
| 9.5 | Emergency balance changes are avoided — the only rule changes shipped since the prior month's review are content updates or AI-simulation-validated balance tweaks per §8.1 | `RELEASE_CHECKLIST.md` history + D-0702 |
| 9.6 | Every incident record closed in the review window carries the four required fields per `INCIDENT_RESPONSE.md` §Every Incident Produces Four Fields | `INCIDENT_RESPONSE.md` §Every Incident Produces Four Fields |

Any single failing clause is a live-ops failure for that review window
and produces a named investigation per §7 (daily for 9.1, 9.2, 9.4, 9.6;
weekly for named deviations surfaced by 9.2, 9.3; monthly for 9.3, 9.5).

---

## 10. Non-Goals

The following are explicitly outside the live-ops framework. A proposal
that maps to a row below is rejected at the proposal boundary; it is
not a live-ops concern.

| # | Non-goal | Why excluded |
|---|---|---|
| 10.1 | Retention funnels, cohort-based engagement tuning | Vision §3 (Player Trust) + NG-1 / NG-6 — metrics do not inform monetization triggers or engagement tuning |
| 10.2 | Monetization analytics (paid-surface conversion, lifetime value, pricing ladders) | NG-6 dark-pattern exclusion — no metric feeds paid-surface mechanics |
| 10.3 | Marketing analytics (attribution, acquisition channel performance) | Not a correctness / determinism / trust surface |
| 10.4 | Automated behavior correction, engine auto-healing, auto-compare across environments | `INCIDENT_RESPONSE.md` §Purpose — monitoring is passive; humans classify and decide |
| 10.5 | Parallel severity taxonomy (see §3) | Constraint 2.7 — severity is defined in `INCIDENT_RESPONSE.md` only |
| 10.6 | Parallel counter container (see §4) | Constraint 2.8 — counter surface is `OpsCounters` only |
| 10.7 | Engine modifications driven by live metrics | §8.2 — no rule change without version increment; balance changes require AI simulation |
| 10.8 | Server, client, or registry modifications driven by live metrics | Same as 10.7 — change routes through `RELEASE_CHECKLIST.md` with validated input, not through live-metric observation |
| 10.9 | Metrics collection infrastructure implementation (agents, pipelines, dashboards) | Out of WP-039 scope — this framework describes what is observed; collection tooling is a future WP that consumes `OpsCounters` + `IncidentSeverity` |

---

## 11. Summary

Live ops is stewardship, not optimization. The rhythm above preserves
engine correctness, gameplay stability, determinism, and player trust
by consuming the already-landed authority surfaces — `IncidentSeverity`
and `OpsCounters` from `ops.types.ts`, the severity semantics in
`INCIDENT_RESPONSE.md`, the release gates in `RELEASE_CHECKLIST.md`,
and the promotion path in `DEPLOYMENT_FLOW.md` — without re-deriving,
duplicating, or contradicting any of them.

Metrics preserve determinism. Monitoring is passive. Humans classify,
decide, and act. Rollback capability is preserved across every change.
Stability takes priority over growth; the framework refuses
growth-at-all-costs trade-offs.

When a live-ops signal surprises the on-call engineer, the correct
response is to classify the event against `INCIDENT_RESPONSE.md`,
execute the required action (rollback for P0; deployment freeze for P1;
investigate for P2; backlog for P3), and write the four-field incident
record. The correct response is never to invent a new severity level,
a new counter, or a new exception path inside live ops.
