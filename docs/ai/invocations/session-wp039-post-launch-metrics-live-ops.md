# Session Prompt — WP-039 Post-Launch Metrics & Live Ops

**Work Packet:** [docs/ai/work-packets/WP-039-post-launch-metrics-live-ops.md](../work-packets/WP-039-post-launch-metrics-live-ops.md)
**Execution Checklist:** [docs/ai/execution-checklists/EC-039-live-ops.checklist.md](../execution-checklists/EC-039-live-ops.checklist.md)
**Pre-Flight v1 (DO NOT EXECUTE YET):** [docs/ai/invocations/preflight-wp039-post-launch-metrics-live-ops.md](preflight-wp039-post-launch-metrics-live-ops.md)
**Pre-Flight v2 (READY TO EXECUTE):** [docs/ai/invocations/preflight-wp039-post-launch-metrics-live-ops-v2.md](preflight-wp039-post-launch-metrics-live-ops-v2.md)
**Copilot Check (CONFIRM):** [docs/ai/invocations/copilot-wp039-post-launch-metrics-live-ops.md](copilot-wp039-post-launch-metrics-live-ops.md)
**Commit prefix:** `EC-039:` on content commit; `SPEC:` on pre-flight bundle and governance close commits; `WP-039:` is **forbidden** (commit-msg hook rejects per P6-36).
**Pre-flight verdict:** READY TO EXECUTE (v2) — three v1 blockers resolved by Path A; copilot check CONFIRM (29/30 PASS, 1 minor RISK with scope-neutral FIX folded into WP-039).
**WP Class:** Contract-Only / Documentation-Only — **one** new document under `docs/ops/`. Zero TypeScript. Zero new types. Zero re-exports. Zero test changes.
**Primary layer:** Live Operations / Observability / System Stewardship — documentation only; `docs/ops/` is Docs category.

---

## Pre-Session Gates (Resolve Before Writing Any File)

1. **Commit-prefix confirmation.** `EC-039:` on content commit; `SPEC:` on pre-flight bundle and governance close. If anyone insists on `WP-039:`, STOP — the commit-msg hook rejects it per **P6-36**.

2. **Governance committed.** The pre-flight bundle (this prompt + v1 preflight + v2 preflight + copilot check + the Path A rewrites of WP-039 and EC-039) must land as the first commit of this session. Subject:
   `SPEC: WP-039 pre-flight bundle — v1 + v2 preflights, copilot check, Path A tightening`

3. **Upstream dependency green at session base commit.** Run `pnpm --filter @legendary-arena/game-engine test`. Expected engine baseline: **444 passing / 110 suites / 0 failing** (recorded at pre-flight v2 on 2026-04-23). Also run `pnpm -r test` for repo-wide baseline — **record the current number in STATUS.md** (the repo may have advanced since the v2 pre-flight; if so, use the current number, do not edit this prompt).

4. **Working-tree hygiene.** At session start `git status --short` should show:
   - ` M docs/ai/work-packets/WP-039-post-launch-metrics-live-ops.md` — Path A rewrite (belongs to Commit A0)
   - ` M docs/ai/execution-checklists/EC-039-live-ops.checklist.md` — Path A rewrite (belongs to Commit A0)
   - `?? docs/ai/invocations/preflight-wp039-post-launch-metrics-live-ops.md` — v1 preflight (belongs to Commit A0)
   - `?? docs/ai/invocations/preflight-wp039-post-launch-metrics-live-ops-v2.md` — v2 preflight (belongs to Commit A0)
   - `?? docs/ai/invocations/copilot-wp039-post-launch-metrics-live-ops.md` — copilot check (belongs to Commit A0)
   - `?? docs/ai/invocations/session-wp039-post-launch-metrics-live-ops.md` — this prompt (belongs to Commit A0)
   - `?? .claude/worktrees/` — inherited; do **NOT** stage

   **CRITICAL:** Stage-by-exact-filename per **P6-27 / P6-44**. `git add .` / `git add -A` / `git add -u` are **forbidden** — they would sweep `.claude/worktrees/` into the commit.

5. **Code-category classification confirmed.** The one new content file lives under `docs/ops/` (Docs category). Precedents: `docs/ops/LAUNCH_READINESS.md`, `docs/ops/LAUNCH_DAY.md` (WP-038); `docs/ops/RELEASE_CHECKLIST.md`, `docs/ops/DEPLOYMENT_FLOW.md`, `docs/ops/INCIDENT_RESPONSE.md` (WP-035). No D-entry classification required.

6. **Authority-chain re-read confirmation.** Before writing `LIVE_OPS_FRAMEWORK.md`, the executor must re-read:
   - [docs/ops/INCIDENT_RESPONSE.md](../../ops/INCIDENT_RESPONSE.md) — **AUTHORITATIVE for P0/P1/P2/P3 severity semantics**
   - [packages/game-engine/src/ops/ops.types.ts](../../../packages/game-engine/src/ops/ops.types.ts) — **AUTHORITATIVE for `IncidentSeverity`, `OpsCounters`, `DeploymentEnvironment` types**

   These were **absent** from Context (Read First) in earlier WP-039 iterations, which caused the v1 drift. Re-read before writing to prevent recurrence.

If any gate is unresolved, STOP.

---

## Runtime Wiring Allowance (01.5) — NOT INVOKED

Per [docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md](../REFERENCE/01.5-runtime-wiring-allowance.md) §When to Include This Clause. WP-039 under Path A is purely documentation. Each of the four 01.5 trigger criteria is enumerated below and marked absent:

| 01.5 Trigger Criterion | Applies to WP-039? | Justification |
|---|---|---|
| Adds a required field to `LegendaryGameState` or another shared type | **No** | Zero TypeScript file modifications. |
| Changes the shape of a return type produced by `buildInitialGameState` or similar setup orchestrators | **No** | No engine modification. |
| Adds a new move to `LegendaryGame.moves` that affects structural assertions in existing tests | **No** | No move added. |
| Adds a new phase hook that alters the expected structural shape of gameplay initialization or test scaffolding | **No** | No phase hook added. |

**Conclusion:** 01.5 is **NOT INVOKED**. The scope lock applies without the allowance. Any file beyond the allowlist in §Files Expected to Change is a scope violation per **P6-27**, not a minor additive deviation — escalate to a pre-flight amendment rather than shipping it.

Per 01.5 §Escalation: *"It may not be cited retroactively in execution summaries or pre-commit reviews to justify undeclared changes."* If an unanticipated structural break appears mid-execution, STOP and escalate — do not force-fit.

---

## Copilot Check (01.7) — COMPLETED, VERDICT: CONFIRM

See [docs/ai/invocations/copilot-wp039-post-launch-metrics-live-ops.md](copilot-wp039-post-launch-metrics-live-ops.md) for the full 30-issue scan. Overall Judgment: **PASS** — 29 PASS, 1 RISK (Issue 11, test baseline phrasing) with a scope-neutral FIX already folded into WP-039 §Verification Steps and §Definition of Done, 0 BLOCK. Disposition **CONFIRM**. Session prompt generation authorized.

---

## Vision Sanity Check (01.4 §Vision Sanity Check)

Clause titles verified against `docs/01-VISION.md` headers:

- **Vision clauses touched by this WP:** §3 (Player Trust & Fairness), §5 (Longevity & Expandability), §13 (Execution Checklist–Driven Development), §14 (Explicit Decisions, No Silent Drift), §22 (Deterministic & Reproducible Evaluation), §24 (Replay-Verified Competitive Integrity).
- **Conflict assertion:** `No conflict: this WP preserves all touched clauses.`
- **Non-Goal proximity:** `N/A — WP touches no monetization or competitive surface.`
- **Determinism preservation:** WP-039 introduces no runtime behavior. The live-ops framework reuses landed `IncidentSeverity` and `OpsCounters`; all metric derivation is deterministic per D-0901.
- **WP `## Vision Alignment` section status:** Present in WP-039, intact post-Path-A rewrite.

---

## Authority Chain (Read in Order Before Writing)

1. [.claude/CLAUDE.md](../../../.claude/CLAUDE.md) — EC-mode, lint gate, commit discipline
2. [.claude/rules/architecture.md](../../../.claude/rules/architecture.md) — Layer Boundary; no engine code touched in WP-039
3. [.claude/rules/code-style.md](../../../.claude/rules/code-style.md) — no code in scope; prose style applies to the new doc
4. [docs/01-VISION.md](../../01-VISION.md) — Primary Goals (#1-5), Non-Goals (NG-1..7). Per `00.3 §17` and `01.4 §Authority Chain`.
5. [docs/ai/ARCHITECTURE.md](../ARCHITECTURE.md) §MVP Gameplay Invariants — live ops preserves these invariants
6. [docs/ops/INCIDENT_RESPONSE.md](../../ops/INCIDENT_RESPONSE.md) — **AUTHORITATIVE for severity taxonomy.** P0/P1/P2/P3 defined at lines 32-34.
7. [packages/game-engine/src/ops/ops.types.ts](../../../packages/game-engine/src/ops/ops.types.ts) — **AUTHORITATIVE for ops types.** `IncidentSeverity` (line 84), `OpsCounters` (lines 40-49), `DeploymentEnvironment` (line 65).
8. [docs/ops/DEPLOYMENT_FLOW.md](../../ops/DEPLOYMENT_FLOW.md) — promotion path reference
9. [docs/ops/RELEASE_CHECKLIST.md](../../ops/RELEASE_CHECKLIST.md) — release gates reference
10. [docs/ops/LAUNCH_READINESS.md](../../ops/LAUNCH_READINESS.md), [docs/ops/LAUNCH_DAY.md](../../ops/LAUNCH_DAY.md) — WP-038 outputs; framework doc takes over post-launch
11. [docs/ai/execution-checklists/EC-039-live-ops.checklist.md](../execution-checklists/EC-039-live-ops.checklist.md) — primary execution authority
12. [docs/ai/work-packets/WP-039-post-launch-metrics-live-ops.md](../work-packets/WP-039-post-launch-metrics-live-ops.md) — authoritative WP specification
13. [docs/ai/DECISIONS.md](../DECISIONS.md) — **D‑0702**, **D‑0901**, **D‑0902**, **D‑1002**, **D‑3501**

If any of these conflict, higher-authority documents win.

---

## Goal (Binary)

After this session:

1. **`docs/ops/LIVE_OPS_FRAMEWORK.md` exists** with sections §1–§11 per WP-039 §Scope (In) A.
2. **The framework doc reuses landed authorities.** Severity taxonomy is cross-linked to `INCIDENT_RESPONSE.md` (not restated). The four ops counters are referenced by name from `OpsCounters` (not redefined). The `IncidentSeverity` union is used for all severity references (no parallel `MetricPriority` / `MetricSeverity` type exists anywhere).
3. **Replay desync is classified P1** in the framework doc — matches `INCIDENT_RESPONSE.md:33` exactly. No same-version vs cross-version split.
4. **Metric label conventions** (§5) are prose organizational groupings, NOT typed unions or code constants.
5. **Zero TypeScript files modified.** `git diff --name-only | grep '\.ts$'` returns empty.
6. **Zero parallel types introduced.** `grep -rE "MetricPriority|MetricSeverity|MetricCategory|MetricEntry" packages/` returns empty.
7. **Engine baseline unchanged:** 444 passing / 110 suites / 0 failing (as recorded at pre-flight v2 2026-04-23; current baseline re-recorded in STATUS.md if the repo has advanced).
8. **01.6 post-mortem exists** at `docs/ai/post-mortems/01.6-WP-039-post-launch-metrics-live-ops.md` per the 01.6 MANDATORY trigger (one new long-lived abstraction document).
9. **One new DECISIONS.md entry landed at Commit B:** documenting the Path A decision — live ops reuses `IncidentSeverity` and `OpsCounters` rather than defining parallel types, with the v1 drift as precedent.

No registry changes. No server changes. No client changes. No new tests. No new npm dependencies.

---

## Locked Values (Do Not Re-Derive)

### Commit topology (three commits)

- **Commit A0 (`SPEC:`)** — pre-flight bundle: this session prompt + v1 preflight + v2 preflight + copilot check + Path A rewrites of WP-039 and EC-039. **Commit subject:** `SPEC: WP-039 pre-flight bundle — v1 + v2 preflights, copilot check, Path A tightening`.
- **Commit A (`EC-039:`)** — content + 01.6 post-mortem: `LIVE_OPS_FRAMEWORK.md` + post-mortem. **Commit body must include a `Vision: §3, §5, §13, §14, §22, §24` trailer** per [docs/ai/REFERENCE/01.3-commit-hygiene-under-ec-mode.md §Vision Trailer](../REFERENCE/01.3-commit-hygiene-under-ec-mode.md).
- **Commit B (`SPEC:`)** — governance close: `STATUS.md` + `WORK_INDEX.md` + `EC_INDEX.md` + `DECISIONS.md` (new entry). Commit body repeats the `Vision:` trailer.

### Severity taxonomy (DO NOT restate beyond cross-link pointer)

The framework doc §3 must **reference** `INCIDENT_RESPONSE.md:32-34` for the P0/P1/P2/P3 table. Do NOT copy the table in full. A single-line summary pointer is the maximum permitted restatement.

| Level | Incident | Action |
|---|---|---|
| P0 | Corrupted game state | Immediate rollback |
| P1 | Replay desync | Freeze deployments |
| P2 | Invalid turn spikes | Investigate |
| P3 | Content lint warnings | Backlog |

(This table is in THIS SESSION PROMPT for the executor's convenience — do not copy it into `LIVE_OPS_FRAMEWORK.md`.)

### Counter surface (DO NOT redefine)

The framework doc §4 must **reference** `packages/game-engine/src/ops/ops.types.ts:40-49` for `OpsCounters`. Do NOT redefine the four fields. A cross-link pointer + one-line summary is the maximum permitted restatement.

`OpsCounters` fields: `invariantViolations`, `rejectedTurns`, `replayFailures`, `migrationFailures`. (Listed here for executor convenience only.)

### Authoritative types (reuse, never parallel)

- `IncidentSeverity = 'P0' | 'P1' | 'P2' | 'P3'` — reuse from `ops.types.ts:84`
- `OpsCounters` — reuse from `ops.types.ts:40-49`
- `DeploymentEnvironment = 'dev' | 'test' | 'staging' | 'prod'` — reuse from `ops.types.ts:65`

**Forbidden parallel types (grep-guarded):** `MetricPriority`, `MetricSeverity`, `MetricCategory`, `MetricEntry`, or any similar name. Verification Step 6 below greps for these and requires zero hits.

### Framework doc §5 metric label conventions (organizational prose, NOT typed unions)

The four labels below are **prose groupings** for organizing human review cadence. They are NOT code constants, NOT typed unions, NOT enforced by any build step. Any future proposal to typify them must go through its own pre-flight and DECISIONS.md entry.

- **System Health** — sourced from `OpsCounters`
- **Gameplay Stability** — sourced from replay logs and final-state snapshots
- **Balance Signals** — sourced from replay logs
- **UX Friction** — sourced from replay logs and support channels

### Live Ops Cadence (from WP-039 §Scope A §7)

- **Daily:** review `OpsCounters` for P0/P1 incidents; confirm zero invariant violations
- **Weekly:** compare human metrics against AI simulation baselines (WP-036) and beta baselines (WP-037); review abandoned games
- **Monthly:** evaluate balance signals; plan next validated content or balance update
- **Exceptions outside cadence:** permitted only for P0/P1 incidents

### Expected DECISIONS.md entry (Commit B)

One new entry, authored in the **### D-NNNN — Title** + **Decision:** / **Why:** / **Implications:** structure. The executor picks the next available D-number (check DECISIONS.md tail). Title: *"Live Ops Reuses Existing `IncidentSeverity` and `OpsCounters` Rather Than Parallel Types"*.

**Decision:** WP-039 rejected the introduction of parallel severity and counter types (`MetricPriority`, `MetricEntry`) in favor of reusing the landed `IncidentSeverity` and `OpsCounters` from `ops.types.ts` (D-3501). The live-ops framework doc cross-links to these types and to `INCIDENT_RESPONSE.md` for severity semantics.

**Why:** Pre-flight v1 discovered three blocking findings — duplicate engine-wide severity type, severity-semantic contradiction with landed `INCIDENT_RESPONSE.md`, and parallel metric container alongside `OpsCounters`. All three stemmed from earlier WP-039 iterations not naming the pre-existing ops types or the incident-response doc as authoritative. Path A resolves all three by construction. Adding parallel types would have required a parallel severity taxonomy and silently divergent severity semantics — a `// why:` commentable drift class that is expensive to unwind later.

**Implications:** All future ops observability surfaces (metrics, alerts, dashboards) reference `IncidentSeverity` and `OpsCounters` directly. Any proposal to introduce a new severity level, new counter field, or new severity semantic is an amendment to `INCIDENT_RESPONSE.md` or `ops.types.ts` — not a parallel WP. The authority chain for live-ops work now explicitly names `docs/ops/INCIDENT_RESPONSE.md` and `packages/game-engine/src/ops/ops.types.ts` in Context (Read First).

### Prose discipline for the framework doc

- **Binary pass/fail language only** on success criteria and change-management gates.
- **Forbidden subjective phrases** (case-insensitive): "looks good", "looks great", "acceptable" (except in specifically locked clauses), "mostly ready", "good enough", "should be fine", "probably". Verification Step 7 greps for these and requires zero hits.
- **No token enumeration for determinism.** Cite D-entries (D-0901, D-0902) rather than listing `Math.random`, `Date.now`, etc. Per `00.3 §18` prose-vs-grep discipline.

---

## Required `// why:` Comments

- **None.** WP-039 produces documentation only; no code, no runtime mutation, no framework calls.

---

## Files Expected to Change (Allowlist — 10 files across 3 commits)

| File | New/Modify | Owner |
|---|---|---|
| `docs/ai/work-packets/WP-039-post-launch-metrics-live-ops.md` | modify (Path A rewrite) | Commit A0 |
| `docs/ai/execution-checklists/EC-039-live-ops.checklist.md` | modify (Path A rewrite) | Commit A0 |
| `docs/ai/invocations/preflight-wp039-post-launch-metrics-live-ops.md` | **new** (v1) | Commit A0 |
| `docs/ai/invocations/preflight-wp039-post-launch-metrics-live-ops-v2.md` | **new** (v2) | Commit A0 |
| `docs/ai/invocations/copilot-wp039-post-launch-metrics-live-ops.md` | **new** | Commit A0 |
| `docs/ai/invocations/session-wp039-post-launch-metrics-live-ops.md` | **new** (this prompt) | Commit A0 |
| `docs/ops/LIVE_OPS_FRAMEWORK.md` | **new** | Commit A |
| `docs/ai/post-mortems/01.6-WP-039-post-launch-metrics-live-ops.md` | **new** | Commit A |
| `docs/ai/STATUS.md` | modify | Commit B |
| `docs/ai/DECISIONS.md` | modify (append one new entry) | Commit B |
| `docs/ai/work-packets/WORK_INDEX.md` | modify (WP-039 close line) | Commit B |
| `docs/ai/execution-checklists/EC_INDEX.md` | modify (EC-039 Draft → Done) | Commit B |

**No other files may be modified.** Any file outside this allowlist is a scope violation — escalate, do not force-fit.

At each `git add`, pass exact filenames. At each commit, confirm `git diff --cached --name-only` matches the allowlist exactly. `.claude/worktrees/` must NOT be staged.

---

## Verification Steps

Execute each before checking any Acceptance Criteria in EC-039.

```bash
# Step 1 — confirm the framework doc exists with expected sections
test -f docs/ops/LIVE_OPS_FRAMEWORK.md && echo "LIVE_OPS_FRAMEWORK present"
grep -cE "^## " docs/ops/LIVE_OPS_FRAMEWORK.md
# Expected: >= 11 (§1..§11 headings)

# Step 2 — confirm no TypeScript files modified
git diff --name-only | grep -E "\.ts$|\.mts$|\.cts$"
# Expected: no output

# Step 3 — confirm no engine, server, or client code files modified
git diff --name-only packages/ apps/
# Expected: no output

# Step 4 — confirm only allowlist files are touched
git diff --name-only
# Expected: only files in §Files Expected to Change

# Step 5 — confirm no new parallel severity/metric types anywhere
grep -rE "MetricPriority|MetricSeverity|MetricCategory|MetricEntry" packages/ docs/ops/LIVE_OPS_FRAMEWORK.md
# Expected: no output

# Step 6 — confirm INCIDENT_RESPONSE.md and ops.types.ts are UNTOUCHED
git diff --name-only docs/ops/INCIDENT_RESPONSE.md packages/game-engine/src/ops/ops.types.ts
# Expected: no output

# Step 7 — confirm framework doc cross-links to existing authorities
grep -E "INCIDENT_RESPONSE\.md|OpsCounters|IncidentSeverity" docs/ops/LIVE_OPS_FRAMEWORK.md
# Expected: at least one match each for the three identifiers

# Step 8 — confirm replay desync classified as P1 in framework doc
grep -iE "replay.*P1|P1.*replay|replay desync" docs/ops/LIVE_OPS_FRAMEWORK.md
# Expected: at least one match aligning replay desync with P1

# Step 9 — confirm framework doc does NOT restate the P0-P3 severity table in full
grep -c "Immediate rollback" docs/ops/LIVE_OPS_FRAMEWORK.md
# Expected: 0 or 1 (a one-line summary pointer is permitted; full restatement is not)

# Step 10 — subjective-language grep (must return zero hits)
grep -iE "looks good|looks great|mostly ready|good enough|should be fine|probably" docs/ops/LIVE_OPS_FRAMEWORK.md
# Expected: no output

# Step 11 — prose-vs-grep discipline (§18): no forbidden-token enumeration
grep -E "Math\.random|Date\.now|performance\.now|new Date\(\)" docs/ops/LIVE_OPS_FRAMEWORK.md
# Expected: no output (cite D-entries instead per §18)

# Step 12 — test baselines unchanged
pnpm --filter @legendary-arena/game-engine test
# Expected: 444 passing / 110 suites / 0 failing (baseline from pre-flight v2 2026-04-23;
# if repo state has advanced, use current baseline and record in STATUS.md)

pnpm -r test
# Expected: no failures; record current repo-wide count in STATUS.md

# Step 13 — new DECISIONS.md entry present at Commit B
grep -nE "^### D-[0-9]+.*Live Ops.*Reuses.*Existing" docs/ai/DECISIONS.md
# Expected: one match

# Step 14 — WP-039 checked off in WORK_INDEX at Commit B
grep -nE "\[x\] WP-039" docs/ai/work-packets/WORK_INDEX.md
# Expected: one match with today's date

# Step 15 — EC-039 moved to Done in EC_INDEX at Commit B
grep -nE "EC-039.*Done" docs/ai/execution-checklists/EC_INDEX.md
# Expected: one match
```

---

## Execution Sequence (Hard-Locked)

1. **Pre-flight bundle commit (SPEC).** Stage the six bundle files (this prompt, v1 preflight, v2 preflight, copilot check, modified WP-039, modified EC-039) by exact filename. Commit as `SPEC: WP-039 pre-flight bundle — v1 + v2 preflights, copilot check, Path A tightening` with the Vision trailer.

2. **Content authoring — `LIVE_OPS_FRAMEWORK.md`.** Write the framework doc with §1–§11 per WP-039 §Scope (A). Apply §18 prose-vs-grep discipline. Cross-link severity taxonomy to `INCIDENT_RESPONSE.md` (do not restate). Cross-link counter fields to `OpsCounters` (do not redefine). Use binary pass/fail language for success criteria. Replay desync classified P1, full stop.

3. **Run Verification Steps 1–11** against the framework doc. All must pass.

4. **01.6 post-mortem.** Author `docs/ai/post-mortems/01.6-WP-039-post-launch-metrics-live-ops.md`. Required coverage:
   - **Risks surfaced** — v1 pre-flight caught three blockers (duplicate type, severity contradiction, parallel container); Path A resolved all three.
   - **Lessons learned** — authority-chain completeness is load-bearing; `INCIDENT_RESPONSE.md` and `ops.types.ts` absence from Context (Read First) caused the v1 drift; caps-tagged AUTHORITATIVE callouts in WP-039 v2 §Context prevent recurrence.
   - **Lifecycle isolation** — N/A (no code).
   - **Aliasing** — N/A (no code).
   - **Extension seam status** — framework doc §5 Metric Label Conventions uses prose groupings, not typed unions — any future typify proposal needs its own pre-flight.
   - **Follow-up WP pointers** — metrics collection infrastructure (explicitly out of scope per WP-039 §Out of Scope) is a future WP consumer of `OpsCounters` + `IncidentSeverity`.

5. **Content commit (EC-039).** Stage the two new files (framework doc + post-mortem) by exact filename. Commit as `EC-039: ship live-ops framework (Path A — reuse IncidentSeverity and OpsCounters)` with the Vision trailer.

6. **Run Verification Step 12** (test baselines) against the content commit. Must be 444/110/0 engine; repo-wide number recorded.

7. **Governance close.** Update `STATUS.md` (live ops framework exists; severity reused from `INCIDENT_RESPONSE.md`; `OpsCounters` reused from `ops.types.ts`; record current engine + repo-wide test baselines). Update `WORK_INDEX.md` (check off WP-039 with today's date). Update `EC_INDEX.md` (EC-039 Draft → Done; increment Done counter). Append one new entry to `DECISIONS.md` per §Locked Values — Title: *"Live Ops Reuses Existing `IncidentSeverity` and `OpsCounters` Rather Than Parallel Types"*.

8. **Governance commit (SPEC).** Stage the four governance files by exact filename. Commit as `SPEC: close WP-039 / EC-039 — live-ops framework governance` with the Vision trailer.

9. **Run Verification Steps 13–15** against the governance commit.

If any step fails, STOP and raise as a pre-commit review finding — do not continue.

---

## Definition of Done

All of the following must hold:

- [ ] All Acceptance Criteria in WP-039 pass (binary pass/fail per item).
- [ ] All After Completing items in EC-039 pass.
- [ ] All Verification Steps above return expected output.
- [ ] `git diff --cached --name-only` at each commit matches the allowlist exactly.
- [ ] Test baselines recorded: engine 444/110/0; repo-wide current count logged in STATUS.md.
- [ ] No TypeScript files modified.
- [ ] No parallel severity/metric types introduced (grep-verified).
- [ ] No modifications to `INCIDENT_RESPONSE.md` or `ops.types.ts` (git-diff-verified).
- [ ] Framework doc cross-links (not restates) `INCIDENT_RESPONSE.md` severity table and `OpsCounters` fields.
- [ ] Replay desync classified P1 in framework doc.
- [ ] Framework doc §5 metric label conventions are prose groupings, not typed unions.
- [ ] No subjective-language or forbidden-token enumeration in framework doc.
- [ ] WP-039 checked off in WORK_INDEX.md with today's date.
- [ ] EC-039 moved to Done in EC_INDEX.md.
- [ ] New DECISIONS.md entry landed (*"Live Ops Reuses Existing `IncidentSeverity` and `OpsCounters`…"*).
- [ ] STATUS.md updated.
- [ ] 01.6 post-mortem authored and committed.
- [ ] All three commits land on `main` (no push required by this session).

---

*Session prompt authored 2026-04-23 against `main @ ba2490e` as the fifth artifact in the WP-039 pre-flight bundle (after v1 preflight, Path A tightening of WP-039 + EC-039, v2 preflight, and copilot check). Pre-flight v2 verdict READY; copilot check disposition CONFIRM with Issue 11 FIX already folded into WP-039 §Build & Test Baseline. Next step: commit the SPEC pre-flight bundle, then execute Commit A (EC-039 content), then Commit B (SPEC governance close) in a **new Claude Code session** per 01.4:128.*
