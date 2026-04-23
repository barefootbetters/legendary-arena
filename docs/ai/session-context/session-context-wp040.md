# Session Context — WP-040 Growth Governance & Change Budget

Bridge from the WP-039 execution session (2026-04-23, `ee5e1d5`) to the
WP-040 executor. Carries forward the repo-state anchor, the WP-039
three-commit topology, the landed contract surfaces WP-040 consumes,
the D-3901 reuse discipline that binds WP-040's type-definition scope,
the two new precedents (P6-52, P6-53) that surfaced during WP-039, and
a small set of WP-040 drafting-drift items that must be corrected at
pre-flight time before any authoring pass begins.

**This document is NOT a pre-flight.** It is the input to the WP-040
pre-flight. Author `docs/ai/invocations/preflight-wp040-*.md` separately
once WP-040 + EC-040 have been re-read in full. Based on the WP-039
precedent (three-commit topology: A0 SPEC pre-flight bundle → A EC-040
content → B SPEC governance close), the WP-040 executor should expect
to produce a SPEC pre-flight bundle before any EC-040 code commit lands.
Whether that bundle contains D-entries (form 1 per P6-51) or prose in a
produced doc with back-pointer D-entries (form 2 per P6-51) is a
pre-flight-time decision documented in this bridge's §7.

---

## 1. Repo-State Anchor (verified 2026-04-23 at session close)

### Branch topology

- **`main`** @ `ee5e1d5` — session tip; no push performed (local only).
- No topic branch cut during WP-039 execution; all three commits landed
  directly on `main`. The WP-040 executor should cut
  `wp-040-growth-governance` fresh from `main` HEAD:

```bash
git checkout -b wp-040-growth-governance main
```

### Commits landed this session (oldest first)

- **`9e7d9bd` `SPEC:`** — WP-039 pre-flight bundle (Commit A0). Six
  files: v1 preflight, v2 preflight, copilot check, session prompt,
  and Path A rewrites of WP-039 + EC-039. Landed before the execution
  session opened.
- **`4b1cf5c` `EC-039:`** — WP-039 execution (Commit A). Two files:
  `docs/ops/LIVE_OPS_FRAMEWORK.md` (11 top-level sections) +
  `docs/ai/post-mortems/01.6-WP-039-post-launch-metrics-live-ops.md`
  (14 sections). Zero code diff; zero test diff.
- **`ee5e1d5` `SPEC:`** — WP-039 governance close (Commit B). Four
  files: STATUS.md + WORK_INDEX.md (WP-039 `[ ]` → `[x]`) + EC_INDEX.md
  (EC-039 Draft → Done, Done counter 11 → 12) + DECISIONS.md (append
  D-3901).

### Baselines (verified pre- and post-Commit-A)

- `pnpm --filter @legendary-arena/game-engine test` — **444 / 110 / 0**
  (unchanged across all three commits).
- `pnpm -r test` — **596 / 0** (registry 13 + vue-sfc-loader 11 +
  game-engine 444 + server 6 + replay-producer 4 + preplan 52 +
  arena-client 66 = 596).
- `git diff --name-only packages/ apps/` — empty output
  post-Commit-A (documentation-only).

### Working tree at session close

- Only dirty item: `?? .claude/worktrees/` (inherited untracked
  directory; never staged at any WP-039 commit; persists across
  sessions). The WP-040 executor will inherit the same item and must
  apply stage-by-exact-filename discipline (P6-27 / P6-44) — never
  `git add .`, `git add -A`, or `git add -u`.

### Quarantine / stash state

- No new stashes created during WP-039 execution.
- No prior stashes were popped.

---

## 2. WP-039 Execution Summary — What WP-040 Inherits

WP-039 landed the steady-state post-launch live-operations rhythm as a
single new strategy document. The bundle reuses the landed
`IncidentSeverity` and `OpsCounters` surfaces from
`packages/game-engine/src/ops/ops.types.ts` (WP-035 / D-3501) and the
severity semantics in `docs/ops/INCIDENT_RESPONSE.md` by cross-linking
rather than restating. Path A resolved three v1 pre-flight blockers by
construction (see §4).

### New surfaces WP-040 may consume

| Surface | Role for WP-040 |
|---|---|
| `docs/ops/LIVE_OPS_FRAMEWORK.md` | **Direct input for WP-040 §Scope.** §8 Change Management already defines the allowed / forbidden matrix (allowed: validated content via WP-033, AI-simulation-validated balance tweaks via D-0702/WP-036, semantic-preserving UI updates via D-1002; forbidden: rule changes without version increment, unversioned hot-patches, silent behavior changes, changes-justified-solely-by-live-metrics, auto-heal, parallel severity taxonomy, parallel counter container). WP-040's five change categories (ENGINE / RULES / CONTENT / UI / OPS) must cross-link to §8 rather than re-derive the allowed/forbidden rows. |
| `docs/ai/DECISIONS.md` D-3901 | **Binding design constraint.** Live Ops Reuses Existing `IncidentSeverity` and `OpsCounters` Rather Than Parallel Types. WP-040's type definitions (if any) inherit the same reuse discipline — see §4 below. |
| `docs/ai/post-mortems/01.6-WP-039-post-launch-metrics-live-ops.md` | **Pattern reference.** §7.2 hidden-coupling check and §8 pattern precedents (strategy-document pattern, binary pass/fail gate enumeration, reuse-over-parallel-type) are directly transferable to WP-040 authoring. |

### Inherited governance state

- `EC_INDEX.md` summary counters: Done **12** / Draft **48** / Blocked
  **0** / Total **60**. WP-040's governance close (Commit B) will flip
  these to Done 13 / Draft 47 when EC-040 moves Draft → Done.
- `WORK_INDEX.md` contains `[ ] WP-040 — Growth Governance & Change
  Budget ✅ Reviewed` at line 1436 with dependency `WP-039` noted; the
  dependency is now satisfied (WP-039 complete at `4b1cf5c`).
- Next available D-number: **D-4001** (D-3901 is the most recent
  landed entry; the 40xx range is unused). WP-040's DECISIONS.md
  entries should start at D-4001 regardless of whether the WP-040
  pre-flight chooses P6-51 form 1 (discrete D-entries) or form 2
  (prose-in-produced-doc with back-pointer D-entries).

---

## 3. Authority Surfaces WP-040 MUST Name in Context (Read First)

Per **P6-53** (new precedent landed in WP-039; see §6 below),
WP-040's pre-flight MUST enumerate every pre-existing authority
surface it touches with a caps-tagged **AUTHORITATIVE** marker. The
minimum list for WP-040, based on its §Scope (five change categories
mapping to five architectural layers plus a change-budget discipline),
is:

| Surface | AUTHORITATIVE for | Why WP-040 must not re-derive |
|---|---|---|
| `docs/ops/LIVE_OPS_FRAMEWORK.md` §8 Change Management | Allowed / forbidden change matrix | WP-040's five change categories inherit §8's rows verbatim; any re-statement risks divergence |
| `packages/game-engine/src/ops/ops.types.ts` | `IncidentSeverity`, `OpsCounters`, `DeploymentEnvironment` | WP-040's severity-relevant category classifications must cross-link; no parallel severity type |
| `docs/ops/INCIDENT_RESPONSE.md` | P0/P1/P2/P3 severity semantics | WP-040 must not re-define severity; if change categories map to severity tiers, cross-link only |
| `docs/ops/RELEASE_CHECKLIST.md` | Seven release gates | WP-040's change budget discipline consumes the release gates; no parallel gate list |
| `docs/ops/DEPLOYMENT_FLOW.md` | Four-environment promotion path + rollback procedure | WP-040's OPS change category cross-links; no parallel deployment-flow restatement |
| `packages/game-engine/src/versioning/` | Three version axes (`EngineVersion`, `DataVersion`, `ContentVersion`), `VersionedArtifact<T>`, `checkCompatibility`, `migrateArtifact`, `stampArtifact` | WP-040's major-version-bump language must cite landed axes; no parallel version-axis union |
| `docs/ai/DECISIONS.md` D-1001 / D-1002 / D-1003 | Growth governance authority triad | Already cited in WP-040 draft §Context; retain as AUTHORITATIVE |
| `docs/ai/DECISIONS.md` D-0702 | Balance Changes Require Simulation | WP-040's RULES change category inherits D-0702 validation requirement |
| `docs/ai/DECISIONS.md` D-0801 | Explicit Version Axes | Already cited in WP-040 draft §Context; retain as AUTHORITATIVE |
| `docs/ai/DECISIONS.md` D-3901 | Reuse-not-parallel discipline for ops observability | WP-040's type-definition scope (if any) must cite D-3901 as binding |
| `docs/ai/ARCHITECTURE.md` §MVP Gameplay Invariants | Immutable engine invariants | Already cited in WP-040 draft §Context; retain as AUTHORITATIVE |
| `docs/ai/ARCHITECTURE.md` §Layer Boundary (Authoritative) | Five-layer partition (Registry / Game Engine / Pre-Planning / Server / Persistence) | WP-040's five change categories map to layer classifications; cross-link, don't re-derive |

A surface mentioned in WP-040 §Scope (In) or §Non-Negotiable
Constraints but absent from the AUTHORITATIVE Context (Read First)
list is a **pre-flight blocker** per P6-53. The pre-flight reviewer
should verify the list is complete before issuing READY.

---

## 4. D-3901 Reuse Discipline — Binding on WP-040

D-3901 (landed at `ee5e1d5`) records the Path A discipline:
*"Live Ops Reuses Existing `IncidentSeverity` and `OpsCounters`
Rather Than Parallel Types."* The scope of the authorization
explicitly extends beyond WP-039:

> **Scope of the authorization:** Applies to all ops observability
> work downstream of WP-039 — including the future metrics collection
> infrastructure WP explicitly deferred in `LIVE_OPS_FRAMEWORK.md`
> §10.9. Does not authorize the introduction of any parallel severity
> or counter type anywhere in the repo.

WP-040's `ChangeCategory` scope (the five-category union ENGINE /
RULES / CONTENT / UI / OPS) does not duplicate any landed type —
`IncidentSeverity` has different semantics (severity of an incident,
not category of a change) and `OpsCounters` has a different role
(counter observability, not change classification). So WP-040 may
introduce `ChangeCategory` as a new typed union without violating
D-3901.

**But** WP-040's pre-flight must explicitly verify each proposed type
against the landed authority surfaces enumerated in §3 above and
record the verification in §Locked Values. Specifically:

1. **`ChangeCategory = 'ENGINE' | 'RULES' | 'CONTENT' | 'UI' | 'OPS'`** —
   verify this is genuinely novel and does not overlap with (a) the
   four-layer partition in `ARCHITECTURE.md §Layer Boundary`
   (ENGINE ↔ `packages/game-engine`, CONTENT ↔ `packages/registry`,
   OPS ↔ `apps/server` + ops playbook; RULES is a sub-category of
   ENGINE; UI is a client concept). If WP-040's `ChangeCategory` is
   a rewording of the layer partition, **reuse the partition
   discipline** rather than paralleling it — e.g., by cross-linking
   each category to its architectural layer in the produced doc.
2. **`ChangeBudget` / `ReleaseBudget` / similar container type** —
   verify against `OpsCounters` (different role — counters vs.
   budgets) and against any existing release-gate container in
   `packages/game-engine/src/ops/` (confirm via pre-flight `grep -r
   "Budget" packages/game-engine/src/` before proposing). If no
   collision exists, the new type is admissible.
3. **Severity-adjacent fields** (e.g., `changeRisk: 'high' | 'medium'
   | 'low'` or `requiresMajorVersion: boolean`) — if any field
   inherits severity-like semantics, it must cross-link to
   `IncidentSeverity` via commentary (not type-level inheritance) to
   satisfy D-3901's "no parallel severity type" rule.
4. **`ChangeClassification.immutableSurface?: 'replay' | 'rng' |
   'scoring' | 'invariants' | 'endgame'`** — WP-040 §Scope (In) B now
   locks an optional literal-union field on `ChangeClassification`
   identifying which immutable surface a change touches. This is NOT
   severity-adjacent — it is a kind-of-change tag paraphrasing the
   immutable-surfaces list in WP-040 §Non-Negotiable Constraints.
   Verify via pre-flight `grep -rE "ImmutableSurface|immutableSurface"
   packages/game-engine/src/` that no landed union of the same shape
   exists. Cross-link in the produced doc to `ARCHITECTURE.md §MVP
   Gameplay Invariants` (replay, invariants) and note the deliberate
   non-overlap with `IncidentSeverity` (severity of an incident, not
   surface of a change). Admissible as genuinely novel pending the
   grep; record the verification in §Locked Values.

The pre-flight §Locked Values should include a subsection titled
"D-3901 reuse verification" listing each proposed new type with a
binary pass/fail on the "does not duplicate a landed surface" check.

---

## 5. Known WP-040 Drafting Drift — Correct at Pre-Flight

The current WP-040 draft has **three** factual drift items against the
as-landed state of the repo after WP-039. Each is a pre-flight Path A
tightening opportunity (analogous to the WP-039 Path A rewrite).
None of these is a blocker — all are correctable with surgical text
edits at pre-flight time.

### 5.1 "WP-039 established live ops with four metric categories"

**Current draft (WP-040 §Session Context, line 11):**
> *"WP-039 established live ops with four metric categories and
> cadence."*

**As-landed reality:** WP-039 landed under Path A produced **four
organizational-prose labels** (System Health / Gameplay Stability /
Balance Signals / UX Friction), not four typed categories.
`LIVE_OPS_FRAMEWORK.md` §5 states explicitly: *"They are NOT a typed
union, NOT a parallel severity, NOT a code constant, and NOT enforced
by any build step."*

**Pre-flight fix:** paraphrase to *"WP-039 established live ops with
four organizational-prose metric labels (System Health / Gameplay
Stability / Balance Signals / UX Friction) and a daily / weekly /
monthly review cadence."* The distinction matters because WP-040
introducing `ChangeCategory` as a typed union is a different kind of
scope than paralleling §5's prose labels.

### 5.2 "Implements D-1001, D-1002, and D-1003"

**Current draft (WP-040 §Session Context, lines 17-19):** lists
D-1001 / D-1002 / D-1003 as the governance authority triad.

**As-landed reality:** the WP-040 draft predates D-3901. D-3901
landed 2026-04-23 and explicitly binds all future ops-adjacent WPs
to a reuse-not-parallel discipline. WP-040's Context (Read First)
must add D-3901 as a binding decision (not merely a reference).

**Pre-flight fix:** extend the "implements" list in §Session Context
to name D-1001, D-1002, D-1003 **and inherits D-3901**. The
AUTHORITATIVE Context (Read First) list (§3 above) already names
D-3901; the §Session Context drift is a paraphrase issue, not a
missing authority.

### 5.3 Context (Read First) missing five landed ops surfaces

**Current draft (WP-040 §Context (Read First), lines 59-82):** cites
`ARCHITECTURE.md`, `DECISIONS.md` D-1001/1002/1003/0801, and
`00.6-code-style.md`. Does not cite `LIVE_OPS_FRAMEWORK.md`,
`ops.types.ts`, `INCIDENT_RESPONSE.md`, `RELEASE_CHECKLIST.md`, or
`DEPLOYMENT_FLOW.md` — all of which WP-040 §Scope touches (the five
change categories inherit the ops-playbook authority chain).

**Pre-flight fix:** extend Context (Read First) per §3 above with
each ops surface tagged **AUTHORITATIVE**. This satisfies the new
P6-53 discipline (see §6 below) and prevents the same
authority-chain gap class that produced the v1 WP-039 Path A
rewrite.

---

## 6. New Precedents Worth Citing (Landed in WP-039)

Two new precedents landed in
`docs/ai/REFERENCE/01.4-pre-flight-invocation.md` at the WP-039
governance-close commit. Both are directly applicable to WP-040
pre-flight authoring.

### P6-52 — Meta-prose containing a grep-guarded identifier trips the guard

WP-040's pre-flight will almost certainly include verification-step
greps guarding against parallel types (since WP-040 is documented as
"Documentation + type definitions only" in `WORK_INDEX.md:1438`).
The WP-040 authoring pass will face the same impulse the WP-039
authoring pass faced — to mention a forbidden identifier by name
inside prose arguing against it. Per P6-52, the pre-flight Locked
Values should include a subsection titled *"Authoring discipline for
grep-guarded identifiers"* with the canonical paraphrase table. A
minimum template:

```
## Authoring discipline for grep-guarded identifiers

The identifiers listed in Verification Step N (`ForbiddenName1`,
`ForbiddenName2`, ...) MUST NOT appear in the produced document
under any circumstance — including meta-prose arguing against them,
parenthetical examples showing what not to introduce, or footnotes
recording prior pre-flight rejections. Paraphrase each identifier
to a descriptive noun phrase per the table below.

| Forbidden identifier | Paraphrase |
|---|---|
| `ForbiddenName1` | `<descriptive noun phrase>` |
| `ForbiddenName2` | `<descriptive noun phrase>` |
```

The paraphrase table preempts authorial impulse and prevents
mid-execution Path A pressure.

### P6-53 — Context (Read First) enumerates every pre-existing authority surface with caps-tagged AUTHORITATIVE

WP-040's pre-flight MUST cite P6-53 explicitly in §Locked Values and
verify that every surface in §3 above appears in WP-040's Context
(Read First) with a caps-tagged AUTHORITATIVE marker. The pre-flight
reviewer's §Authority Chain re-read confirmation checklist should
include one checkbox per AUTHORITATIVE surface — e.g., *"[ ]
`LIVE_OPS_FRAMEWORK.md` §8 Change Management re-read in full before
authoring pass begins."*

---

## 7. Pre-Flight Bundle Expected Shape

Based on the WP-039 precedent and the WP-040 scope signal in
`WORK_INDEX.md:1436-1445` ("Documentation + type definitions only"),
the WP-040 pre-flight bundle should produce a three-commit topology
analogous to WP-039:

### Commit A0 (SPEC) — Pre-flight bundle (expected 2–6 files)

- `docs/ai/invocations/preflight-wp040-growth-governance-change-budget.md`
  (v1) — the initial pre-flight run. If READY, single v1 is
  sufficient; if DO NOT EXECUTE YET with Path A findings, author
  a v2.
- `docs/ai/invocations/preflight-wp040-growth-governance-change-budget-v2.md`
  (only if v1 returns DO NOT EXECUTE YET).
- `docs/ai/invocations/copilot-wp040-growth-governance-change-budget.md`
  (copilot check, 30-issue scan analogous to WP-038 / WP-039).
- `docs/ai/invocations/session-wp040-growth-governance-change-budget.md`
  (the session prompt).
- `docs/ai/work-packets/WP-040-growth-governance-change-budget.md`
  (Path A rewrite if v1 found blockers; otherwise untouched).
- `docs/ai/execution-checklists/EC-040-growth-governance.checklist.md`
  (new if missing, or Path A rewrite if v1 found blockers).

Commit-A0 subject: `SPEC: WP-040 pre-flight bundle — <v1-only or v1+v2> + copilot check + <Path A tightening if applicable>`.

### Commit A (EC-040) — Execution (4 files locked per WP-040 §Files Expected to Change)

WP-040 (Status: Ready) now locks the file list; the speculative
documentation-only vs. types+docs branching is resolved — WP-040 ships
**both** produced documentation and type definitions. The four locked
files are:

- `docs/governance/CHANGE_GOVERNANCE.md` — **new** — change
  classification, immutable surfaces, budgets, growth vectors, review
  requirements (not `CHANGE_BUDGET.md`; not under `docs/ops/`).
- `packages/game-engine/src/governance/governance.types.ts` — **new** —
  `ChangeCategory`, `ChangeBudget`, `ChangeClassification` (the
  filename is `governance.types.ts`, not `change-budget.types.ts`;
  the subdirectory `src/governance/` is the locked location, not
  `src/ops/`).
- `packages/game-engine/src/types.ts` — **modified** — additive
  re-exports of the three governance types.
- `packages/game-engine/src/index.ts` — **modified** — additive
  public-API exports of the three governance types.

WP-040 §Files Expected to Change also states *"No other files may be
modified"* — a hard constraint during EC-040 execution.

**Post-mortem gap (pre-flight-resolvable):** WP-040's current §Files
Expected to Change does NOT list
`docs/ai/post-mortems/01.6-WP-040-growth-governance-change-budget.md`,
even though all three post-mortem triggers are likely present (new
long-lived abstraction document, new code-category directory
`src/governance/`, new type contracts consumed by future WPs). The
WP-039 precedent landed its 01.6 post-mortem in Commit A (EC-039) at
`4b1cf5c`. The pre-flight v1 should resolve one of:

- (a) Extend WP-040 §Files Expected to Change to include the 01.6
      post-mortem (Path A rewrite of WP-040 in the pre-flight bundle).
- (b) Land the post-mortem in Commit B alongside the governance-close
      docs and explicitly document the deviation in DECISIONS.md.

Precedent favors (a); a Path A rewrite of WP-040 at pre-flight time
is the cleaner resolution.

Commit-A subject: `EC-040: <one-line execution summary>`.

### Commit B (SPEC) — Governance close (4 files)

- `docs/ai/STATUS.md` — prepend WP-040 / EC-040 current-state block
  using the canonical Phase 7 closure language locked by WP-040's
  §Definition of Done: *"Phase 7 complete: Growth governance enforced.
  Change classification mandatory. Immutable surfaces protected.
  D-1001 / D-1002 / D-1003 fully implemented."* This is the final
  Phase 7 governance packet.
- `docs/ai/work-packets/WORK_INDEX.md` — WP-040 `[ ]` → `[x]` with
  2026-MM-DD date and commit hash.
- `docs/ai/execution-checklists/EC_INDEX.md` — EC-040 Draft → Done;
  Done counter 12 → 13; Draft counter 48 → 47.
- `docs/ai/DECISIONS.md` — append zero or more D-entries per P6-51:
  - Form 1 (discrete D-entries): if WP-040 introduces novel decisions
    not captured in D-1001 / D-1002 / D-1003, land them as D-4001 /
    D-4002 / etc.
  - Form 2 (prose-in-produced-doc with back-pointer D-entries): if
    WP-040's change-budget template lives as reader-facing prose in
    a produced doc, land D-4001 as a back-pointer citing the
    produced doc's relevant section.
  - Pick one form per rationale at pre-flight; do not leave the
    choice to the executing session (P6-51).

Commit-B subject: `SPEC: close WP-040 / EC-040 — growth governance &
change budget`.

### Vision trailer (all commits)

`Vision: §3, §5, §13, §14` is the minimum set (same as WP-039). WP-040
may additionally touch §22 / §24 if the change-budget discipline
intersects determinism or replay concerns — verify against
`docs/01-VISION.md` clause titles at pre-flight time (§Vision Sanity
Check per 01.4).

---

## 8. Carry-Forward State

### Still open (not blocked by WP-039 close)

- **WP-042.1** — deferred PostgreSQL seeding sections per D-4201;
  unblocks when Foundation Prompt 03 is revived. Not a WP-040
  dependency.
- **Future metrics collection infrastructure WP** — explicitly
  deferred by `LIVE_OPS_FRAMEWORK.md` §10.9 and cited in D-3901's
  "Scope of the authorization" clause. Will be a downstream WP after
  WP-040 and is not a WP-040 scope item.
- **`.claude/worktrees/`** untracked directory — inherited across
  sessions; never staged at any commit. WP-040 must apply the same
  stage-by-exact-filename discipline.

### Closed by WP-039 — no WP-040 action required

- v1 → v2 pre-flight Path A drift class (three blockers resolved by
  construction at commit `9e7d9bd`).
- `MetricPriority` / `MetricSeverity` / `MetricCategory` /
  `MetricEntry` parallel type class (all four forbidden forever per
  D-3901; P6-52 enforces the authoring discipline).
- Severity-semantic contradiction with `INCIDENT_RESPONSE.md:33`
  (replay desync P1 full stop; no same-version vs. cross-version
  split anywhere in the repo).

---

## 9. Reality Checks the WP-040 Executor Should Verify

Before opening the WP-040 pre-flight, the executor should run the
following reality checks and record the output in the pre-flight's
§Pre-Session Gates:

```bash
# Gate 1 — confirm WP-039 governance close landed
git log --oneline -5 | grep "ee5e1d5.*WP-039.*governance"
# Expected: one match

# Gate 2 — confirm D-3901 present in DECISIONS.md
grep -nE "^### D-3901" docs/ai/DECISIONS.md
# Expected: one match

# Gate 3 — confirm LIVE_OPS_FRAMEWORK.md is at the expected state
test -f docs/ops/LIVE_OPS_FRAMEWORK.md && grep -cE "^## " docs/ops/LIVE_OPS_FRAMEWORK.md
# Expected: True, 11

# Gate 4 — confirm EC_INDEX.md Done counter
grep -nE "^\| Done +\| 12" docs/ai/execution-checklists/EC_INDEX.md
# Expected: one match

# Gate 5 — confirm engine baseline unchanged since WP-039 close
pnpm --filter @legendary-arena/game-engine test
# Expected: 444 / 110 / 0

# Gate 6 — confirm repo-wide baseline unchanged since WP-039 close
pnpm -r test
# Expected: 596 / 0

# Gate 7 — confirm no engine / server / client diff since WP-039 close
git diff --name-only ee5e1d5..HEAD packages/ apps/
# Expected: empty output (no work landed between WP-039 close and
# WP-040 session open). If non-empty, the pre-flight must reconcile
# the intervening work before WP-040 proceeds.

# Gate 8 — confirm .claude/worktrees/ still the only untracked item
git status --short
# Expected: single line `?? .claude/worktrees/`

# Gate 9 — confirm P6-52 and P6-53 present in 01.4
grep -nE "^\*\*P6-52:|^\*\*P6-53:" docs/ai/REFERENCE/01.4-pre-flight-invocation.md
# Expected: two matches
```

Any gate failure is a WP-040 pre-flight blocker. Do not begin
pre-flight authoring until all nine gates return expected output.

---

## 10. Next-Session Handoff Checklist

- [ ] Cut `wp-040-growth-governance` from `main` @ `ee5e1d5`.
- [ ] Run §9 Gates 1–9; record output.
- [ ] Re-read WP-040 + EC-040 in full.
- [ ] Re-read the §3 AUTHORITATIVE list (12 surfaces minimum).
- [ ] Re-read the §5 drafting-drift items.
- [ ] Re-read P6-52 and P6-53 in
      `docs/ai/REFERENCE/01.4-pre-flight-invocation.md`.
- [ ] Author `docs/ai/invocations/preflight-wp040-growth-governance-change-budget.md`
      (v1). Apply Path A paraphrases per §5 above; enumerate all
      §3 AUTHORITATIVE surfaces in WP-040's Context (Read First);
      include the P6-52 paraphrase-table and P6-53 compliance
      confirmation in §Locked Values.
- [ ] If v1 returns DO NOT EXECUTE YET, author v2 with the Path A
      fix recorded and re-run. If v1 returns READY, proceed.
- [ ] Author copilot-wp040 check (30-issue scan analogous to WP-038
      / WP-039).
- [ ] Author session-wp040 prompt locking the three-commit topology
      per §7 above.
- [ ] Author Path A rewrites of WP-040 + EC-040 if v1 findings
      require them.
- [ ] Land Commit A0 SPEC pre-flight bundle.
- [ ] Execute Commit A EC-040.
- [ ] Land Commit B SPEC governance close.
- [ ] Archive this bridge as "consumed by WP-040 execution" once
      Commit B lands.

---

*Session-context bridge authored 2026-04-23 at `main @ ee5e1d5`. Author
is the WP-039 execution session; reader is the WP-040 executor. This
bridge is disposable — once WP-040 Commit B lands, the bridge can be
retained as a historical record or deleted; the load-bearing content
(authority surfaces, reuse discipline, precedents) lives in
`LIVE_OPS_FRAMEWORK.md`, D-3901, and `01.4-pre-flight-invocation.md`
P6-52 / P6-53 respectively, all of which outlast this file.*
