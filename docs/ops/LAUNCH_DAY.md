# Launch Day — Procedure, Soft Launch, Go-Live, Post-Launch Guardrails

**Status:** Authoritative (WP-038)
**Owner:** Release / Launch Authority
**Related decisions:** D-0802 (Incompatible Data Fails Loudly),
D-0902 (Rollback Is Always Possible), D-3501 (Ops Metadata), D-3701
(Beta Types Code Category), D-3704 (Beta Uses the Same Release Gates
as Production), D-3801 (Single Launch Authority), D-3802 (72-Hour
Post-Launch Change Freeze), D-3803 (Launch Gates Inherit from Beta
Exit Gates)
**Companion document:** `docs/ops/LAUNCH_READINESS.md`
**Promotion path:** `docs/ops/DEPLOYMENT_FLOW.md`
**Severity ladder:** `docs/ops/INCIDENT_RESPONSE.md`
**Release checklist:** `docs/ops/RELEASE_CHECKLIST.md`

This document defines the launch-day timeline that runs **after** the
launch authority has recorded a GO verdict per
`LAUNCH_READINESS.md` §2.3. A NO-GO verdict halts the timeline before
T-1h. There is no path through this document that bypasses a failing
readiness gate.

The launch artifact runs the same engine, against the same release
checklist, on the same `dev → test → staging → prod` promotion path
as every prior beta build (D-3704). Launch day is a deployment event
under existing procedures; it is not a new pipeline.

---

## 1. Timeline Overview

| Phase | Window | Purpose | Authority |
|---|---|---|---|
| Final Build Verification | T-1h | Confirm artifact identity and version stamps | Launch authority + ops on-call |
| Soft Launch Window | T-0 | Limited-traffic exposure with anomaly monitoring | Launch authority + ops on-call |
| Go-Live Signal | T-0 + first clean session | Promote from soft launch to full traffic | Launch authority |
| Post-Launch Guardrails | T+0 to T+72h | Stability observation window with hard change freeze | Launch authority + ops on-call |

The four phases run sequentially. **No phase may begin before the
prior phase concludes successfully.** If any phase produces a
rollback-trigger condition, the timeline halts and the rollback
procedure in `DEPLOYMENT_FLOW.md` §Rollback executes.

---

## 2. Final Build Verification (T-1h)

T-1h begins one hour before the recorded T-0 deployment window. The
purpose of T-1h is to confirm that the artifact about to be deployed
is byte-identical to the artifact the launch readiness review
approved, and that all version stamps match.

### 2.1 Build hash matches release artifact

- [ ] The `EngineVersion`, `DataVersion`, and `ContentVersion`
      triple stamped on the launch artifact (per `stampArtifact`,
      WP-034) matches the triple recorded in the launch authority's
      decision record (`LAUNCH_READINESS.md` §2.3).
- [ ] The build hash of the launch artifact matches the build hash
      that passed every gate in `RELEASE_CHECKLIST.md` Gates 1
      through 7.
- [ ] The artifact promoted from `staging` to `prod` is byte-
      identical to the artifact that ran in `staging` per
      `DEPLOYMENT_FLOW.md` §Promotion Rules. No rebuild, no
      re-stamp, no re-test.

### 2.2 Content version locked

- [ ] The `ContentVersion` of the launch content bundle matches the
      bundle that passed `validateContent` with zero errors in
      `LAUNCH_READINESS.md` §1.2.1.
- [ ] No content fix landed between launch readiness sign-off and
      T-1h. If a content fix would have been required, the launch
      authority issues a NO-GO and the launch is re-scheduled
      against a new readiness review against the corrected bundle.

### 2.3 Migrations are no-ops for fresh installs

- [ ] If the launch artifact bumps `CURRENT_DATA_VERSION`, every
      registered migration from the prior `dataVersion` to the new
      one has been verified against `RELEASE_CHECKLIST.md` Gate 4
      and produces a forward-compatible artifact.
- [ ] For fresh installs (no prior persisted artifact), the
      migration registry is consulted but no migration runs; the
      first `buildInitialGameState` call seeds state at the launch
      `dataVersion` directly.
- [ ] If `dataVersion` is unchanged, this gate is **n/a** with a
      one-sentence justification recorded in the deployment log.

**Fail handling:** Any unchecked item in §2.1 / §2.2 / §2.3 halts
the launch at T-1h. The launch authority records a NO-GO update
against the prior GO verdict, names the failing item, and either
rolls the rectification into a new release artifact or postpones
the launch window. There is no path that proceeds past T-1h with
an unverified version stamp.

---

## 3. Soft Launch Window (T-0)

T-0 begins the soft launch. The purpose of the soft launch is to
expose the launch artifact to a limited subset of production
traffic while the operational counters from `OpsCounters` (D-3501)
are observed continuously, before opening the full traffic
distribution.

### 3.1 Initial traffic exposure

- [ ] Initial launch routes a limited fraction of production
      traffic to the launch artifact. The remainder of traffic
      continues to route to the prior production artifact.
- [ ] The traffic split percentage is recorded in the launch
      readiness review record before T-0.
- [ ] No automated expansion. Traffic expansion happens only after
      the Go-Live Signal in §4 fires and the launch authority
      explicitly approves the next expansion step.

### 3.2 Continuous monitoring

The following signals are monitored continuously across the soft
launch window. Each signal has a defined thresholds-and-action
mapping anchored to the `INCIDENT_RESPONSE.md` severity ladder.

| Signal | Threshold | Action on threshold breach |
|---|---|---|
| Invariant violations (`OpsCounters.invariantViolations` delta) | Any non-zero delta | P0 — declare immediately; PAUSE traffic expansion; evaluate against rollback triggers in §6 |
| Rejected turns (`OpsCounters.rejectedTurns` delta vs. soft-launch baseline) | Order-of-magnitude jump above baseline | P2 — investigate; PAUSE traffic expansion until cause is identified |
| Replay failures (`OpsCounters.replayFailures` delta) | Any non-zero delta | P1 — declare immediately; freeze deployments per `INCIDENT_RESPONSE.md` P1; PAUSE traffic expansion |
| Session aborts (server-side abnormal termination) | Order-of-magnitude jump above baseline | P2 — investigate; PAUSE traffic expansion |

### 3.3 PAUSE versus ROLLBACK distinction

This distinction is non-negotiable and is the central operational
discipline of the soft launch window:

- **PAUSE** halts traffic expansion. The current traffic split is
  frozen; no new traffic is routed to the launch artifact, and no
  traffic is routed away from it. PAUSE is the correct response to
  an **anomaly** — a signal that warrants investigation but has
  not yet been classified as a rollback trigger. PAUSE preserves
  the soft launch state while the anomaly is analyzed.
- **ROLLBACK** retires the launch artifact and reinstates the
  prior production artifact per `DEPLOYMENT_FLOW.md` §Rollback
  Rules. ROLLBACK is the correct response **only when one of the
  rollback trigger conditions in §6 is met**. ROLLBACK is atomic
  — partial rollback is not a rollback; it is a P0 incident per
  `DEPLOYMENT_FLOW.md` §Rollback completes atomically.

The two are distinct events with distinct authority requirements.
**An anomaly is not a rollback trigger.** PAUSE happens first;
ROLLBACK happens only if analysis under PAUSE identifies a §6
trigger.

### 3.4 Required: analysis concludes before resumption

- [ ] If PAUSE was declared, no traffic expansion may resume until
      the analysis under PAUSE has concluded with one of three
      verdicts: (a) the anomaly is benign — resume; (b) the anomaly
      is a §6 rollback trigger — execute ROLLBACK; (c) the anomaly
      is investigation-grade but not rollback-grade — record the
      finding, hold at the current traffic split, escalate to
      named-investigator triage per `INCIDENT_RESPONSE.md` P2.
- [ ] No "watch and see" resumption. Resumption requires an
      explicit verdict.

---

## 4. Go-Live Signal (T-0 + first clean session)

The Go-Live Signal is the binary criterion that promotes the launch
from the soft launch window to broader traffic distribution. Only
the launch authority may declare Go-Live; the signal itself is
binary pass/fail.

### 4.1 Signal criteria

All three criteria must hold to declare Go-Live:

1. **First clean session completes.** A complete match — setup
   through endgame evaluation — runs on the launch artifact in
   production traffic without producing any of the §6 rollback
   triggers and without producing a P0 or P1 per
   `INCIDENT_RESPONSE.md`.
2. **Replay of that session matches live view.** The replay of
   the first-clean-session, replayed via `replayGame` (WP-027),
   produces a state hash that matches the `computeStateHash`
   recorded at session-end. The audience-filtered `UIState`
   projection produced by `buildUIState` (WP-028) during replay
   matches the projection produced during live play, byte-
   identical after canonical serialization.
3. **Monitoring shows zero critical alerts.** No P0 or P1 alert
   from the signals enumerated in §3.2 has fired between T-0 and
   the moment of the Go-Live evaluation.

### 4.2 Declaration

When all three criteria hold, the launch authority records the
Go-Live declaration with:

- The Go-Live timestamp (UTC, ISO 8601).
- The `sessionId` of the first clean session (per `BetaFeedback`
  field-naming convention; `sessionId` here references the
  match-level identifier the server layer assigns).
- The state hash of the first clean session (post-`computeStateHash`
  output).
- A statement that all three §4.1 criteria hold.

After Go-Live, traffic expansion proceeds in launch-authority-
approved steps. Each expansion step re-evaluates §3.2 monitoring
against the new traffic level before the next expansion is
approved.

### 4.3 No silent Go-Live

A launch may not "drift into Go-Live" by leaving the soft launch
window open without a recorded declaration. If the soft launch
window passes its planned duration without a recorded Go-Live, the
launch authority records either Go-Live (if §4.1 holds) or a NO-GO
update (if it does not) — not both, never neither.

---

## 5. Post-Launch Guardrails (T+0 to T+72h)

The 72-hour post-launch window is a **stability observation
window**. The window begins at the recorded Go-Live timestamp and
ends 72 hours later. During the window, the launch artifact is
under elevated monitoring, and the change freeze in §5.2 is hard.

### 5.1 Why 72 hours

D-3802 records the rationale formally. In short:

- Live-launch anomalies frequently take time to surface — they
  appear after the artifact has been exposed to enough player
  hours to exercise rare content combinations or rare network
  conditions. A 72-hour window is calibrated to give the most
  common slow-surfacing failure modes time to appear before the
  stability claim solidifies.
- Hot-fixing during the observation window introduces determinism
  drift that breaks the audit trail D-0902 depends on. Every
  change shipped during T+0 to T+72h would otherwise need its own
  mini-readiness review against a baseline that has not yet
  stabilized — the observation window's whole purpose is to
  produce a stable baseline.
- The Freeze Exception Record (§5.4) makes any necessary
  exception auditable, so the freeze is not absolute in pathological
  cases — but the burden of proof is on the exception, not on
  the freeze.

### 5.2 The 72-hour change freeze

For 72 hours from the recorded Go-Live timestamp, **no feature
releases ship to production**. Specifically:

- [ ] No `dev → test → staging → prod` promotion of any artifact
      that adds, removes, or alters a feature surface (engine
      moves, phase hooks, UI affordances, content cards, scoring,
      RNG behavior, replay format, validation rules).
- [ ] No content republish that adds, removes, or modifies any
      card or scenario.
- [ ] No configuration change that alters runtime behavior of the
      launch artifact.

The freeze does **not** cover read-only operational surfaces
(monitoring dashboards, alert thresholds, on-call rotations) —
those may be tuned without consuming the freeze exception path,
provided they do not affect engine behavior or player experience.

### 5.3 Bugfix criteria during freeze

A bugfix during the freeze is permitted only if **all** of the
following hold:

1. **Deterministic.** The fix preserves the engine's determinism
   contract per `ARCHITECTURE.md` §Architectural Principles #1
   and the runtime invariants enforced by WP-031. Replay of any
   pre-fix session must continue to produce byte-identical state
   hashes after the fix is applied (per `verifyDeterminism`).
2. **Backward compatible.** The fix does not bump
   `CURRENT_DATA_VERSION` and does not alter the `UIState`
   contract (per `RELEASE_CHECKLIST.md` Gates 4 and 5). Any
   persisted artifact written by the pre-fix engine must continue
   to load under the post-fix engine without migration.
3. **Roll-forward safe.** The fix can be rolled forward into the
   next non-freeze release without conflict; specifically, the
   next non-freeze release may include the fix verbatim or may
   supersede it, but it may not require a re-revert of the fix
   to land.

A fix that fails any of (1) / (2) / (3) is **not eligible for
freeze-window deployment** under any circumstance — even with a
Freeze Exception Record. The Freeze Exception Record authorizes
the timing of an eligible fix, not the eligibility itself.

### 5.4 Freeze Exception Record

Any change that ships during the freeze requires a written Freeze
Exception Record with the following five fields. All five fields
are required; an incomplete record is not authorization to ship.

1. **Triggering condition.** The specific operational signal,
   incident, or defect that requires a freeze-window deployment
   rather than waiting for T+72h. References the
   `INCIDENT_RESPONSE.md` severity, the source signal, and the
   timestamp at which the trigger fired.
2. **Proof of determinism.** Concrete evidence that the fix
   preserves the engine's determinism contract — typically the
   `verifyDeterminism` output for a representative pre-fix replay
   re-run against the post-fix engine.
3. **Proof of backward compatibility.** Concrete evidence that
   the fix does not bump `dataVersion` and does not alter the
   `UIState` contract — typically the `RELEASE_CHECKLIST.md`
   Gate 4 and Gate 5 outputs against the post-fix artifact.
4. **Roll-forward safety analysis.** A short written analysis
   explaining how the fix interacts with the next planned
   non-freeze release: whether the fix is preserved verbatim,
   superseded, or absorbed, and how the next release's release
   notes will reference this exception.
5. **Launch authority approval timestamp.** The UTC ISO 8601
   timestamp at which the launch authority recorded approval of
   this exception, with the launch authority's name. The launch
   authority MAY NOT delegate this approval; consensus voting is
   forbidden here for the same reasons it is forbidden in
   `LAUNCH_READINESS.md` §2.

The Freeze Exception Record is part of the audit trail and is
preserved indefinitely. A T+0 to T+72h window with zero exception
records is the expected case; one exception is acceptable under a
fully-justified record; multiple exceptions in the same window is
a signal that the launch readiness review missed something and
should be reviewed in the post-launch retrospective.

### 5.5 Elevated monitoring cadence and alert sensitivity

For T+0 to T+72h, the operational monitoring surface runs at
elevated sensitivity:

- **Invariant violations.** Continuous monitoring; any non-zero
  delta on `OpsCounters.invariantViolations` produces an immediate
  P0 page per `INCIDENT_RESPONSE.md`. No batching, no debouncing.
- **Replay divergence.** Treated as P1. Any `verifyDeterminism`
  failure, `detectDesync` event, or state-hash mismatch on a
  production replay is a P1 freeze-deployments event per
  `INCIDENT_RESPONSE.md`.
- **Balance anomalies.** Logged but **not hot-fixed** during the
  freeze. Balance signals collected during T+0 to T+72h feed the
  post-launch retrospective and the WP-039 live-ops cadence; they
  do not consume the freeze exception path.

After T+72h, monitoring sensitivity returns to the baseline
defined for steady-state operations (ownership transfers from the
launch authority to the WP-039 live-ops cadence at that moment).

### 5.6 Rollback triggers

The following four conditions are **rollback triggers**, named
verbatim: invariant violation spike, replay hash divergence,
migration failure, client desync. Each trigger immediately
escalates the launch state from the post-launch observation window
to the rollback procedure in `DEPLOYMENT_FLOW.md` §Rollback. The
launch authority MAY NOT "watch and wait" on a trigger; the trigger
fires and rollback preflight begins immediately per
`INCIDENT_RESPONSE.md`.

- **Invariant violation spike.** `OpsCounters.invariantViolations`
  delta jumps non-zero during the observation window. P0 per
  `INCIDENT_RESPONSE.md`. Maps to the deployment-boundary fail-
  loud semantics anchored by D-0802 — corrupted game state in
  production is the runtime equivalent of incompatible persisted
  data refused at load.
- **Replay hash divergence.** A production replay no longer
  produces the same state hash it produced at record time. P1
  per `INCIDENT_RESPONSE.md`; escalates to P0 if the divergence
  is reproducible against the current production artifact.
  Determinism has been lost; the audit trail D-0902 depends on
  is broken until determinism is re-established.
- **Migration failure.** `migrateArtifact` throws when applied to
  a persisted artifact that should be migratable (per WP-034).
  The `dataVersion` bump in the launch release has a broken
  migration path; every player whose artifact requires migration
  is locked out at load until the migration is fixed.
- **Client desync.** Two clients of the same match, both on the
  current launch artifact, disagree about state after the same
  ordered moves. Detected by `detectDesync` (WP-032). P1 per
  `INCIDENT_RESPONSE.md`; escalates to P0 if reproducible.

When any rollback trigger fires, the rollback procedure in
`DEPLOYMENT_FLOW.md` §Rollback Rules executes against the most
recent known-good `prod` artifact, atomically, with no data loss.
The atomic rollback rule from `DEPLOYMENT_FLOW.md` §Rollback
completes atomically applies verbatim — a half-rolled-back state
is a P0 incident.

---

## 6. Closing the Launch

The launch closes at T+72h with one of two outcomes:

- **Stable launch.** No rollback triggers fired during the
  observation window; the change freeze held; any Freeze Exception
  Records ship a complete five-field justification. Ownership
  transfers to the WP-039 live-ops cadence.
- **Rollback executed.** A rollback trigger fired during the
  observation window; rollback completed atomically per
  `DEPLOYMENT_FLOW.md` §Rollback Rules. The launch is recorded
  as rolled back; the next launch attempt requires a new launch
  readiness review against a corrected artifact.

Either outcome produces a launch-day post-mortem authored against
`INCIDENT_RESPONSE.md` §Every Incident Produces Four Fields, even
for a stable launch (the four fields for a stable launch are
recorded as `n/a` with a one-sentence justification per field).

---

## 7. What This Document Is Not

- **Not a launch readiness review.** Pre-launch gates and the
  GO / NO-GO decision live in `docs/ops/LAUNCH_READINESS.md`. A
  NO-GO verdict halts this document before T-1h.
- **Not a per-environment runbook.** Per-environment promotion
  procedures live in WP-042 (Deployment Checklists).
- **Not a steady-state ops manual.** Post-T+72h ownership
  transfers to WP-039 (Post-Launch Metrics & Live Ops).
- **Not a marketing or communications timeline.** Marketing
  events (announcements, press, store listings) are out of scope
  here; they may align with this timeline, but they do not gate
  any phase in this document.
- **Not a substitute for the release checklist.** Every artifact
  reaching T-1h has already passed `RELEASE_CHECKLIST.md` Gates
  1 through 7 — there is no T-1h gate that re-derives that
  output.
