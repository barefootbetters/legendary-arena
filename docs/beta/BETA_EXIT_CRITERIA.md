# Beta Exit Criteria

**Status:** Authoritative (WP-037)
**Owner:** Release / Product
**Related decisions:** D-0702 (Balance Changes Require Simulation),
D-0902 (Rollback Is Always Possible), D-3701 (Beta Types Code Category)
**Related contracts:** `packages/game-engine/src/beta/beta.types.ts`
**Strategy document:** `docs/beta/BETA_STRATEGY.md`

The beta exit criteria are **binary pass/fail**. There is no subjective
"feels ready" override, no partial credit, and no category-by-category
promotion. **Exit requires ALL four categories to pass.** Each criterion
within a category is itself binary pass/fail with a measurable
threshold. A single failing criterion within a category fails that
category; a single failing category fails the entire beta exit gate.

The measurement window for every criterion below is the **open beta
phase only**, evaluated at beta-end. Closed-alpha data is excluded
(per `BETA_STRATEGY.md` §6). The "final week" and "final 2 weeks"
observation ranges refer to the terminal calendar week / terminal
calendar 2-weeks of open beta.

---

## Categories

### 1. Rules correctness

Rules correctness measures defect volume and determinism adherence
against the engine's authoritative behavior.

| # | Criterion | Measurable threshold | Source signal |
|---|---|---|---|
| 1.1 | Zero P0 / P1 bugs in the final 2 weeks of open beta | `BetaFeedback` records with `severity: 1` and a triage classification of P0 or P1, filtered to `category: 'rules'`, count equals **0** across the final 14 calendar days | `BetaFeedback` (triaged) |
| 1.2 | All replay verifications pass | `verifyDeterminism` (WP-027) returns a passing `DeterminismResult` for every replay submitted during open beta (**100%** pass rate) | WP-027 replay harness output |
| 1.3 | No invariant violations detected | `runAllInvariantChecks` (WP-031) reports zero violations across the full open-beta sample (`OpsCounters.invariantViolations` delta from open-beta start equals **0**) | `OpsCounters` (D-3501) + invariant API |

Category 1 passes iff all three criteria pass.

### 2. UX clarity

UX clarity measures whether general-strategy participants can complete
the intended gameplay flow and whether confusion-tagged feedback stays
within an acceptable ceiling.

| # | Criterion | Measurable threshold | Source signal |
|---|---|---|---|
| 2.1 | Task-completion rate for cohort 2 above threshold | General-strategy participants (`BetaCohort: 'general-strategy'`) who finish a full match (setup through endgame evaluation) on first attempt is **≥ 80%** of invited general-strategy participants who accepted and launched at least one session | Session telemetry + invitation acceptance log |
| 2.2 | "Confusion" feedback volume below threshold | `BetaFeedback` records with `category: 'confusion'` submitted during the final 2 weeks, per-participant average, is **≤ 2** across all cohorts | `BetaFeedback` (direct) |

Category 2 passes iff both criteria pass.

### 3. Balance perception

Balance perception compares observed human outcomes to the AI simulation
baseline established by WP-036. Per D-0702, balance changes require
simulation validation; the beta exit gate uses simulation as the
predictive baseline against which human play is measured.

| # | Criterion | Measurable threshold | Source signal |
|---|---|---|---|
| 3.1 | Human win rates within acceptable range of AI simulation predictions | For each scheme × mastermind pair in the curated content set, observed human win rate during open beta must fall within **± 10 percentage points** of the `SimulationResult.winRate` produced by `runSimulation` (WP-036) for the same pair at matching player count | Human match telemetry + `runSimulation` output |
| 3.2 | No systemic "balance" feedback spike | `BetaFeedback` records with `category: 'balance'` and `severity: 1` submitted during the final 2 weeks, aggregated per scheme × mastermind pair, is **≤ 3** for every pair in the curated set | `BetaFeedback` (triaged) |

Category 3 passes iff both criteria pass.

Why D-0702 is the anchor: D-0702 (Balance Changes Require Simulation)
locks simulation as the **predictive baseline** for balance questions.
Beta feedback informs balance decisions, but simulation validates them.
Criterion 3.1 operationalizes that principle by making simulation the
reference distribution against which human win rates are compared — not
the other way around.

### 4. Stability

Stability measures crash-free operation and release-process health
during the terminal window of the beta.

| # | Criterion | Measurable threshold | Source signal |
|---|---|---|---|
| 4.1 | Zero crashes in the final week | Server-process and client-process crash count across all beta sessions during the final 7 calendar days equals **0** | Opt-in diagnostics (per `BETA_STRATEGY.md` §4) |
| 4.2 | Rollback never triggered in the final deployment | The final open-beta build runs to beta-end without a rollback per `docs/ops/DEPLOYMENT_FLOW.md` (D-0902) | Release / deployment log |
| 4.3 | Multiplayer reconnection round-trips succeed in the final week | Every reconnection attempt recorded by the network layer during the final 7 calendar days completes successfully (**100%** reconnection success rate) | Network-layer telemetry |
| 4.4 | Late-joining semantics match spec | Every late-join event during the final 2 weeks results in the joining client observing the same authoritative `UIState` projection as in-session players, verified via audience-filtered view comparison (**100%** match rate) | `filterUIStateForAudience` audit |
| 4.5 | No desync incidents in the final 2 weeks | `detectDesync` (WP-032) reports zero desync events during the final 14 calendar days (`OpsCounters.replayFailures` delta remains **0**) | `detectDesync` + `OpsCounters` |

Category 4 passes iff all five criteria pass. Criteria 4.3, 4.4, and
4.5 operationalize Vision §4 (Faithful Multiplayer Experience —
multiplayer validation includes reconnection and late-joining) as
binary pass/fail gates.

---

## Why These Criteria (Measurement Methodology)

The four categories mirror the four risk surfaces the beta is
specifically designed to surface: the rule engine, the UX surface, the
balance baseline, and the operational / release surface. Each category
maps to an independent signal path so that passing one does not
compensate for failing another.

- **Rules correctness** anchors to the engine's authoritative behavior:
  `verifyDeterminism` (WP-027) and `runAllInvariantChecks` (WP-031) are
  deterministic reproducers. A failing replay or a non-zero invariant
  count is an unambiguous, non-subjective fail signal. `BetaFeedback`
  supplies the human-reported P0 / P1 defect count as a complementary
  signal that reproducers may miss (e.g., misleading rule text, missing
  UI affordance for a legal move).
- **UX clarity** anchors to task-completion rate (cohort 2) and
  confusion-tagged feedback volume. The 80% completion threshold for
  `'general-strategy'` participants reflects the cohort's signal target
  (UX, clarity, onboarding per `BETA_STRATEGY.md` §3). The per-participant
  confusion-feedback ceiling (≤ 2) keeps UX noise bounded across cohorts
  and prevents a single participant's feedback storm from skewing the
  category.
- **Balance perception** anchors to D-0702. Simulation is the
  predictive baseline; human play is the validation signal. The ± 10pp
  band accommodates the statistical variance expected at beta-sample
  sizes while still catching the kind of systemic mis-tuning that would
  fail a broader audience at production.
- **Stability** anchors to D-0902 and Vision §4. Rollback-never-triggered
  is a binary operational signal that confirms the release pipeline held
  through the terminal window. The three multiplayer criteria (4.3,
  4.4, 4.5) operationalize the faithful-multiplayer vision clause as
  binary gates, not aspirational goals.

Measurement source discipline: every criterion above cites a **specific
source signal** — `BetaFeedback` records, `OpsCounters` deltas, WP-027
replay harness output, `runSimulation` output, or deployment logs. No
criterion relies on subjective judgment or unattributed anecdote. The
exit gate is **re-runnable**: given the same signals, two independent
reviewers must reach the same pass/fail verdict for every criterion.

---

## Overall Exit Verdict

```
exit(rules, ux, balance, stability) =
  rules.pass AND ux.pass AND balance.pass AND stability.pass
```

Any `false` short-circuits the exit decision to `false`. There is no
weighting, no partial credit, and no category substitution.

---

## Related Documents

- `docs/beta/BETA_STRATEGY.md` — beta objectives, cohorts, access
  control, feedback model, timeline, and exit summary.
- `docs/ops/RELEASE_CHECKLIST.md` — release gates shared with
  production.
- `docs/ops/DEPLOYMENT_FLOW.md` — deployment promotion path and
  rollback procedure (D-0902).
- `docs/ops/INCIDENT_RESPONSE.md` — severity mapping used by beta
  triage.
- `packages/game-engine/src/beta/beta.types.ts` — `BetaFeedback`,
  `BetaCohort`, `FeedbackCategory` contracts.
- `docs/ai/DECISIONS.md` — D-0702 (balance-changes-require-simulation),
  D-0902 (rollback-is-always-possible), D-3701 (beta types code
  category).
- `docs/01-VISION.md` — §4 (faithful multiplayer experience), §22
  (deterministic and reproducible evaluation), §24 (replay-verified
  competitive integrity).
