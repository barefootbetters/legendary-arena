# Beta Strategy

**Status:** Authoritative (WP-037)
**Owner:** Release / Product
**Related decisions:** D-0702 (Balance Changes Require Simulation),
D-0902 (Rollback Is Always Possible), D-3501 (Ops Metadata), D-3601
(Simulation Types), D-3701 (Beta Types Code Category)
**Related contracts:** `packages/game-engine/src/beta/beta.types.ts`
**Related procedure:** `docs/ops/RELEASE_CHECKLIST.md`
**Exit gate:** `docs/beta/BETA_EXIT_CRITERIA.md`

The controlled public beta is a **product experiment**, not a marketing
event. Its purpose is to validate real-world gameplay, capture structured
feedback, and contain the blast radius of bugs while preserving
determinism, data integrity, and player trust. This document defines the
beta's objectives, scope, cohorts, access model, feedback collection
model, phased timeline, and exit criteria summary.

Beta games run the **same deterministic engine** as production. There is
no "beta mode" anywhere in the engine. Beta uses the **same release
gates** as production (WP-035) and inherits all **rollback capabilities**
(D-0902) from the production release process.

---

## 1. Objectives

### Primary objectives

1. **Validate the core loop under real-world conditions.** Confirm that
   the authoritative engine, network model, UI, and replay pipeline
   together deliver a complete, deterministic match across the
   heterogeneous environments real players use.
2. **Surface UX friction before open launch.** Identify onboarding,
   clarity, readability, and interaction-flow gaps that unit tests and
   AI simulation cannot expose.
3. **Detect edge-case bugs not reachable by automated testing.** Capture
   rule-interaction defects, rare content combinations, reconnection
   edge cases, and late-joining semantics that only human play uncovers.
4. **Measure difficulty perception against AI simulation predictions.**
   Compare observed human win rates and match-length distributions
   against the AI-driven balance baseline from WP-036 (`runSimulation`)
   to validate D-0702's simulation-first balance discipline.

### Explicit non-goals

1. **Not a marketing event.** The beta is not promoted externally as a
   launch, preview, or early-access purchase.
2. **Not a scale or load test.** Participant counts are hard-capped
   well below production capacity; performance data is incidental, not
   authoritative.
3. **Not a monetization experiment.** No purchases, paid tiers, paid
   cohort gating, or ownership-linked content variation exist in beta
   (Vision NG-1, NG-3).
4. **Not a content balance sweep for unreleased sets.** The curated
   content set is frozen for the beta window; balance changes driven by
   beta signal are planned post-beta and re-validated by simulation
   before shipping.

---

## 2. Feature Scope

### Included

- **Full core loop.** Setup, turn flow, villain reveal, City/HQ
  interactions, mastermind tactic resolution, endgame evaluation, and
  final scoring all run unmodified.
- **Curated content set.** A hand-selected subset of schemes,
  masterminds, villain groups, henchman groups, and hero decks chosen
  to exercise the largest cross-section of rule interactions within a
  bounded content surface.
- **Replays.** The WP-027 replay harness is enabled end-to-end.
  Participants can export replays; downstream feedback reviewers can
  reproduce reported symptoms deterministically.
- **Spectator view.** The WP-029 audience-filtered UI state pipeline is
  enabled. A dedicated passive-observer cohort validates spectator and
  replay usability (Vision §18).
- **Multiplayer reconnection and late-joining.** Real multiplayer
  sessions exercise reconnection round-trips and late-joining semantics
  per Vision §4; exit criteria measure these explicitly.

### Excluded

- **Campaigns.** Campaign framework (WP-030) is shipped but not enabled
  for beta participants. Multi-scenario progression is out of beta
  scope.
- **Save migration.** Save/load and cross-version migration (WP-034)
  are not exercised. Beta sessions run within a single engine version;
  saved artifacts are not expected to carry forward.
- **Experimental keywords.** Any hero, villain, or board keyword not
  yet content-locked is excluded from the curated content set.

---

## 3. User Cohorts

Three cohorts partition beta participants by **expertise and role only
— never by payer status, ownership, or paid-tier intent** (Vision NG-1,
NG-3). The cohort identifiers match the `BetaCohort` closed literal
union in `packages/game-engine/src/beta/beta.types.ts` verbatim. Adding
a fourth cohort requires a new `DECISIONS.md` entry.

1. **Expert tabletop players** (`'expert-tabletop'`) — rules-aware,
   edge-case focused. Signal target: rules-interaction defects,
   tabletop-semantic drift, trigger-ordering anomalies, content
   combinations unlikely to surface in general play.
2. **General strategy gamers** (`'general-strategy'`) — UX, clarity,
   onboarding signal. Signal target: new-player task-completion rate,
   tooltip and rule-text comprehension, UI-affordance legibility, and
   "confusion" feedback volume.
3. **Passive observers** (`'passive-observer'`) — spectator and replay
   usability. Signal target: replay scrubbing, spectator view clarity,
   audience-filter correctness (no leaked hidden information), and
   late-joining a live match.

Why three cohorts (rationale paragraph): the three cohorts capture
**mutually distinct signal targets** that cannot be collapsed into a
single "beta participant" pool without losing fidelity. Expert players
find defects general players never trigger; general players find UX
friction experts have long internalized past; passive observers
validate an entirely different UI surface (spectator) that active
players never see. Sampling all three in parallel produces balanced
feedback across the engine, UI, and replay pillars simultaneously; a
single-cohort beta would leave at least one pillar unverified.

---

## 4. Access Control

- **Invitation-only.** No anonymous sessions. Every participant has a
  personally issued invitation tied to their beta account. Walk-up
  access is not supported.
- **Hard user cap.** Total concurrent participants across all cohorts
  are capped at a pre-committed ceiling chosen to stay well below
  production capacity. The cap is a numeric ceiling decided and
  recorded by the release owner at beta-start; it is not tunable
  mid-beta without a new release cycle.
- **Unique build ID.** Beta participants run a dedicated build whose
  engine+data+content version triple (`EngineVersion`, `DataVersion`,
  `ContentVersion` per WP-034) is distinct from both the current
  production build and prior beta builds. Every `BetaFeedback.buildVersion`
  field must match the issued beta build; feedback tied to any other
  build is discarded.
- **Opt-in diagnostics.** Participants opt in to diagnostic telemetry
  (performance counters, invariant-violation reports, replay uploads)
  at invitation acceptance. Diagnostics are never enabled silently; a
  participant who declines telemetry remains a valid beta user and
  submits feedback manually only.

Why invitation-only (rationale paragraph): invitation-only access
prioritizes **signal quality over volume**. The beta's primary
deliverable is structured, attributable feedback from known cohorts,
not a broad reach. An open-access beta would flood the feedback
collection pipeline with low-attribution noise, dilute cohort-level
signal, and make balance-perception measurement (objective 4) impossible
to compare against the AI simulation baseline. Limiting access also
keeps the beta inside the production release cadence, so every beta
deployment remains rollbackable (D-0902) and subject to the same
validation gates as production.

Why the same release gates as production (rationale paragraph): the
beta is **not a shortcut** around the production release checklist
(WP-035, `docs/ops/RELEASE_CHECKLIST.md`). Every beta build passes the
full validation sequence — build-green, test-green, invariant checks,
replay verification, and versioning stamp — before deployment, and is
rolled back through the same procedure (D-0902) if any operational
counter (`OpsCounters`, D-3501) trips a threshold. Using the
production gates for beta guarantees that any defect the beta surfaces
is a defect the same pipeline could have caught in production, and
that any remediation shipped to beta is directly portable to
production without re-validation.

---

## 5. Feedback Collection Model

Structured beta feedback uses the `BetaFeedback` contract defined in
`packages/game-engine/src/beta/beta.types.ts`:

```ts
interface BetaFeedback {
  sessionId: string;
  buildVersion: string;
  category: 'rules' | 'ui' | 'balance' | 'performance' | 'confusion';
  description: string;
  severity: 1 | 2 | 3;
  reproductionReplayId?: string;
}
```

Field semantics (locked by EC-037 §Locked Values; do not rename,
abbreviate, or reorder):

- `sessionId` — opaque identifier for the gameplay session that
  produced the feedback. Allows multiple feedback records to be
  correlated to the same match.
- `buildVersion` — the engine+data+content version triple the feedback
  was captured against. **Required.** Unversioned feedback is
  discarded.
- `category` — one of five closed literal values (`rules`, `ui`,
  `balance`, `performance`, `confusion`). Matches the `FeedbackCategory`
  union verbatim.
- `description` — human-authored text describing the observed behavior
  or concern.
- `severity` — `1` (highest urgency), `2`, or `3` (lowest). Closed
  numeric union. Widening to a fourth level is a governance event.
- `reproductionReplayId` — **optional.** References a WP-027 replay
  harness ID when the participant captured one. When present, enables
  deterministic reproduction of the reported symptom.

**Metadata-not-state.** `BetaFeedback` is never stored in `G`. The
engine neither constructs nor reads instances. Collection, transport,
and persistence are server-layer / ops-tooling concerns (D-3701
sub-rule). `BetaFeedback` does not appear as a field of
`LegendaryGameState`.

Feedback review cadence, triage severity mapping, and routing to the
appropriate engineering owner are operational concerns documented in
`docs/ops/INCIDENT_RESPONSE.md` (severity model) and the beta-review
playbook (post-beta retrospective artifact, not in WP-037 scope).

---

## 6. Beta Timeline (Phases)

The beta runs in three sequential phases. Promotion from one phase to
the next is gated by the same validation pipeline as a production
deployment (WP-035).

1. **Closed alpha.** A small internal-plus-trusted-partner cohort runs
   against the frozen curated content set to validate that the
   controlled-beta build ships in a fundamentally playable state
   before external invitations go out. Feedback is captured but exit
   criteria are not evaluated at this phase.
2. **Invite beta.** External invitations are issued to all three
   cohorts (`expert-tabletop`, `general-strategy`, `passive-observer`)
   against the hard user cap. Feedback collection runs continuously;
   exit criteria begin evaluating at invite-beta start.
3. **Open beta.** Remaining invitation slots (if any) are released to
   a broader pool while the cohort mix stabilizes. Exit criteria
   continue evaluating; promotion to production is gated on the
   binary pass/fail evaluation in `docs/beta/BETA_EXIT_CRITERIA.md`.

The beta window is measured against two fixed observation ranges used
by the exit criteria: the **final week** (zero crashes, rollback never
triggered) and the **final 2 weeks** (zero P0/P1 bugs, no desync
incidents, no invariant violations). Both ranges align with the open
beta phase only; closed-alpha data is excluded from exit-criteria
evaluation.

---

## 7. Exit Criteria Summary

Exit from the beta is **binary pass/fail** per category. The four
categories are:

1. **Rules correctness** — defect volume and replay-verification
   success.
2. **UX clarity** — task-completion rate (cohort 2) and confusion
   feedback volume.
3. **Balance perception** — observed human win rates vs AI simulation
   predictions (D-0702).
4. **Stability** — crash count and rollback history (D-0902).

**Exit requires ALL four categories to pass.** Partial passes do not
promote. The full threshold table, measurement methodology, and the
multiplayer reconnection + desync criteria (Vision §4) are defined in
`docs/beta/BETA_EXIT_CRITERIA.md` — the authoritative exit gate.

---

## 8. Related Documents

- `docs/beta/BETA_EXIT_CRITERIA.md` — binary exit gate.
- `docs/ops/RELEASE_CHECKLIST.md` — release gates (beta uses the same
  gates as production, no shortcuts).
- `docs/ops/DEPLOYMENT_FLOW.md` — `dev → test → staging → prod`
  sequential promotion path (beta deploys through the same flow).
- `docs/ops/INCIDENT_RESPONSE.md` — severity mapping (P0/P1/P2/P3) used
  by beta incident triage.
- `packages/game-engine/src/beta/beta.types.ts` — `BetaFeedback`,
  `BetaCohort`, `FeedbackCategory` contracts (D-3701).
- `docs/ai/DECISIONS.md` — D-0702, D-0902, D-3501, D-3601, D-3701.
- `docs/01-VISION.md` — §3 (player trust and fairness), §4 (faithful
  multiplayer experience), §5 (longevity and expandability), §18
  (replayability and spectation), §22 (deterministic and reproducible
  evaluation), §24 (replay-verified competitive integrity), NG-1 (no
  pay-to-win), NG-3 (no content withheld for competitive advantage).
