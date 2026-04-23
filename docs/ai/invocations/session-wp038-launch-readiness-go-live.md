# Session Prompt — WP-038 Launch Readiness & Go-Live Checklist

**Work Packet:** [docs/ai/work-packets/WP-038-launch-readiness-go-live-checklist.md](../work-packets/WP-038-launch-readiness-go-live-checklist.md)
**Execution Checklist:** [docs/ai/execution-checklists/EC-038-launch-readiness.checklist.md](../execution-checklists/EC-038-launch-readiness.checklist.md)
**Pre-Flight:** [docs/ai/invocations/preflight-wp038-launch-readiness-go-live.md](preflight-wp038-launch-readiness-go-live.md)
**Copilot Check:** [docs/ai/invocations/copilot-wp038-launch-readiness-go-live.md](copilot-wp038-launch-readiness-go-live.md)
**Session Context Bridge:** [docs/ai/session-context/session-context-wp038.md](../session-context/session-context-wp038.md) (consumption-frozen)
**Commit prefix:** `EC-038:` on content commit; `SPEC:` on governance / pre-flight bundle / post-mortem-only commits; `WP-038:` is **forbidden** (commit-msg hook rejects per P6-36).
**Pre-flight verdict:** READY TO EXECUTE — PS-1 + PS-2 resolved at `3e26bb7`; upstream dependencies WP-027/028/029/031/032/033/034/035/036/037 all PASS; repo-wide baseline 596 passing / 0 failing; WP-038 `## Vision Alignment` block present at line 226 with canonical clause titles.
**WP Class:** Contract-Only + Documentation (two new strategy docs under `docs/ops/`, governance-document updates, no engine code, no runtime behavior, no new tests).
**Primary layer:** Launch Control / Risk Elimination / Final Validation — documentation only; `docs/ops/` is Docs category.

---

## Pre-Session Gates (Resolve Before Writing Any File)

1. **Commit-prefix confirmation.** `EC-038:` on content commit; `SPEC:` on governance / pre-flight bundle / post-mortem-only commits. Triple cross-referenced: WP-038 (§Definition of Done implicitly via EC-mode), EC-038 line 1, this prompt. If anyone insists on `WP-038:`, STOP — the commit-msg hook rejects it per **P6-36**.

2. **Governance committed.** Before the first content edit, run `git log --oneline -5` and confirm:

   ```bash
   git log --oneline -5
   # Expected: <SPEC pre-flight bundle hash>
   #           3e26bb7 SPEC: tighten WP-038 + EC-038 launch-readiness contract and correct §5 Vision citation
   #           8e0fe77 SPEC: session-context-wp038.md second reconciliation + Freeze Note
   #           f3e59b2 SPEC: codify prose-vs-grep (§18) and bridge-vs-HEAD (§19) rules
   #           95ce057 SPEC: close WP-085 Post-WP-085 Follow-ups (vacuous memory-file item)
   ```

   If the SPEC pre-flight bundle (this prompt + pre-flight + copilot check) is not yet committed, commit it as `SPEC: WP-038 pre-flight bundle — preflight + session prompt + copilot check` FIRST, then proceed with the EC-038 content commit.

3. **Upstream dependency green at session base commit.** Run `pnpm --filter @legendary-arena/game-engine test` and `pnpm -r test`. Expect engine **444 passing / 110 suites / 0 failing** and repo-wide **596 passing / 0 failing** (registry 13 + vue-sfc-loader 11 + game-engine 444 + server 6 + replay-producer 4 + preplan 52 + arena-client 66 = 596). If the repo baseline diverges, STOP and reconcile against `WORK_INDEX.md`.

4. **Working-tree hygiene.** `git status --short` at session start shows inherited dirty-tree items that are **NOT** in WP-038 scope and must not be staged:
   - ` M docs/ai/DECISIONS.md` — contains D-6601 (WP-066 post-execution clarification, parallel work item; SAFE to leave unstaged).
   - ` M docs/ai/work-packets/WP-066-registry-viewer-data-toggle.md` — post-execution clarification appendix (parallel work; SAFE to leave unstaged).
   - `?? .claude/worktrees/` — Claude Code worktree scaffolding; pre-existing.

   **CRITICAL:** Stage-by-exact-filename per **P6-27 / P6-44**. `git add .` / `git add -A` / `git add -u` are **forbidden** — they would sweep unrelated work into the WP-038 commits. This executor does **NOT** commit the DECISIONS.md D-6601 change or the WP-066 appendix as part of WP-038. WP-038's own DECISIONS.md edits (D-3801/3802/3803) must be added to the same file WITHOUT touching the existing D-6601 content; verify each commit's diff before staging.

5. **Retained stashes `stash@{0}` through `stash@{3}` are off-limits.** Do NOT pop any. They are owned by prior-WP resolvers (WP-084/083 pre-branch-cut, WP-055 viewer quarantine, WP-062/068 MOVE_LOG_FORMAT, WP-068 lessons-learned).

6. **Code-category classification confirmed.** Both new files live under `docs/ops/` (Docs category). Precedents: `docs/ops/RELEASE_CHECKLIST.md`, `docs/ops/DEPLOYMENT_FLOW.md`, `docs/ops/INCIDENT_RESPONSE.md` (all from WP-035). No D-entry classification required.

If any gate is unresolved, STOP.

---

## Runtime Wiring Allowance (01.5) — NOT INVOKED

Per [docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md](../REFERENCE/01.5-runtime-wiring-allowance.md) §When to Include This Clause + §Escalation. WP-038 is purely documentation + governance. Each of the four 01.5 trigger criteria is enumerated below and marked absent:

| 01.5 Trigger Criterion | Applies to WP-038? | Justification |
|---|---|---|
| Adds a required field to `LegendaryGameState` or another shared type | **No** | Zero engine code changes. |
| Changes the shape of a return type produced by `buildInitialGameState` or similar setup orchestrators | **No** | No engine modification. |
| Adds a new move to `LegendaryGame.moves` that affects structural assertions in existing tests | **No** | No move added. |
| Adds a new phase hook that alters the expected structural shape of gameplay initialization or test scaffolding | **No** | No phase hook added. |

**Conclusion:** 01.5 is NOT INVOKED. The scope lock applies without the allowance. Any file beyond the allowlist in §Files Expected to Change is a scope violation per **P6-27**, not a minor additive deviation — escalate to a pre-flight amendment rather than shipping it.

Per 01.5 §Escalation: *"It may not be cited retroactively in execution summaries or pre-commit reviews to justify undeclared changes."* If an unanticipated structural break appears mid-execution, STOP and escalate — do not force-fit.

---

## Copilot Check (01.7) — COMPLETED, VERDICT: CONFIRM

See [docs/ai/invocations/copilot-wp038-launch-readiness-go-live.md](copilot-wp038-launch-readiness-go-live.md) for the full 30-issue scan. Overall Judgment: **PASS** — 30 issues scanned; disposition **CONFIRM**. Pre-flight READY TO EXECUTE verdict stands. Session prompt generation is authorized.

---

## Vision Sanity Check (01.4 §Vision Sanity Check)

Per [docs/ai/REFERENCE/01.4-pre-flight-invocation.md](../REFERENCE/01.4-pre-flight-invocation.md) §Vision Sanity Check and [docs/ai/REFERENCE/00.3-prompt-lint-checklist.md](../REFERENCE/00.3-prompt-lint-checklist.md) §17. Clause titles verified against `docs/01-VISION.md` headers:

- **Vision clauses touched by this WP:** §3 (Player Trust & Fairness), §5 (Longevity & Expandability), §13 (Execution Checklist–Driven Development), §14 (Explicit Decisions, No Silent Drift), §18 (Replayability & Spectation), §22 (Deterministic & Reproducible Evaluation), §24 (Replay-Verified Competitive Integrity), NG-1 (Pay-to-Win or Power Purchases), NG-3 (Content Withheld for Competitive Advantage).
- **Conflict assertion:** `No conflict: this WP preserves all touched clauses.`
- **Non-Goal proximity:** WP-038 is documentation-only launch readiness. NG-1 and NG-3 are not crossed — launch readiness asserts (not mutates) the invariants underpinning them.
- **Determinism preservation:** WP-038 introduces no runtime behavior. Launch gates assert continued satisfaction of existing determinism invariants.
- **WP `## Vision Alignment` section status:** Present at line 226 of `WP-038-launch-readiness-go-live-checklist.md`. Block contents hold at session start.

---

## Authority Chain (Read in Order Before Writing)

1. [.claude/CLAUDE.md](../../../.claude/CLAUDE.md) — EC-mode, lint gate, commit discipline
2. [.claude/rules/architecture.md](../../../.claude/rules/architecture.md) — Layer Boundary; no engine code touched in WP-038
3. [.claude/rules/code-style.md](../../../.claude/rules/code-style.md) — no code in scope; prose style applies to the two new docs
4. [docs/01-VISION.md](../../01-VISION.md) — Primary Goals (#1-5), Secondary Goals (#6-19), Non-Goals (NG-1..7). Per `00.3 §17` and `01.4 §Authority Chain`.
5. [docs/ai/ARCHITECTURE.md](../ARCHITECTURE.md) §MVP Gameplay Invariants — launch readiness validates that these continue to hold
6. [docs/ai/ARCHITECTURE.md](../ARCHITECTURE.md) §Section 3 Persistence Classes — release artifacts are Class 2 Configuration
7. [docs/ai/execution-checklists/EC-038-launch-readiness.checklist.md](../execution-checklists/EC-038-launch-readiness.checklist.md) — primary execution authority (Locked Values + Guardrails + Files to Produce + After Completing)
8. [docs/ai/work-packets/WP-038-launch-readiness-go-live-checklist.md](../work-packets/WP-038-launch-readiness-go-live-checklist.md) — authoritative WP specification, now carries `## Vision Alignment` block
9. [docs/ai/DECISIONS.md](../DECISIONS.md) — **D‑0702** (Balance Changes Require Simulation), **D‑0802** (Incompatible Data Fails Loudly), **D‑0902** (Rollback Is Always Possible), **D-3704** (Beta Uses Same Release Gates as Production — direct input to WP-038 "beta exit → go-live" logic)
10. [docs/beta/BETA_EXIT_CRITERIA.md](../../beta/BETA_EXIT_CRITERIA.md) — beta exit gate evidence source (WP-037); cite directly as WP-038's beta-exit category input
11. [docs/beta/BETA_STRATEGY.md](../../beta/BETA_STRATEGY.md) — strategy-doc-pair template WP-038 reuses for launch docs
12. [docs/ops/RELEASE_CHECKLIST.md](../../ops/RELEASE_CHECKLIST.md) — launch uses the same release gates (WP-035)
13. [docs/ops/DEPLOYMENT_FLOW.md](../../ops/DEPLOYMENT_FLOW.md) — WP-035 deployment reference
14. [docs/ops/INCIDENT_RESPONSE.md](../../ops/INCIDENT_RESPONSE.md) — WP-035 rollback-trigger reference

If any of these conflict, higher-authority documents win.

---

## Goal (Binary)

After this session, Legendary Arena has a complete, auditable launch-readiness specification and live-launch playbook. Specifically:

1. **`docs/ops/LAUNCH_READINESS.md` exists** with four readiness gate categories: Engine & Determinism, Content & Balance, Beta Exit Criteria, Ops & Deployment. Each gate is binary pass/fail with measurable source signals per criterion. A final GO/NO-GO verdict summary section locks the aggregation rule: any single gate failure = NO-GO. Content locked by WP-038 §Scope (A) and the PS-1 tightening (Content/Balance warning-acceptance criteria, Beta Exit "Any unmet criterion = NO-GO").
2. **`docs/ops/LAUNCH_DAY.md` exists** with: Final Build Verification (T-1h), Soft Launch Window (T-0) with explicit PAUSE-vs-ROLLBACK distinction, Go-Live Signal criteria, and Post-Launch Guardrails (T+0 to T+72h) including the 72-hour change freeze, Freeze Exception Record (5 required fields: triggering condition, proof of determinism, proof of backward compatibility, roll-forward safety analysis, launch authority approval timestamp), and rollback triggers (invariant violation spike, replay hash divergence, migration failure, client desync). Content locked by WP-038 §Scope (B) and the PS-1 tightening.
3. **Single Launch Authority model documented** in `LAUNCH_READINESS.md` (or as a dedicated section). Non-override clauses enforced: the launch authority MAY NOT waive failing readiness gates; MAY ONLY decide GO or NO-GO once all gates pass; exists to prevent deadlock, not to override invariants. Required sign-offs before GO/NO-GO: engine integrity, replay determinism, content safety, operations readiness. Decision documented with timestamp and rationale. No consensus voting. Content locked by WP-038 §Scope (C) and the PS-1 tightening.
4. **`docs/ai/post-mortems/01.6-WP-038-launch-readiness-go-live.md` exists** per the 01.6 MANDATORY trigger (two new long-lived abstraction documents). Follows the WP-037 01.6 structure (12 sections including Fixes Applied During Post-Mortem).
5. **Three DECISIONS.md entries landed at Commit B:** D-3801 (single launch authority — accountability over consensus), D-3802 (72-hour change freeze — stability observation window), D-3803 (launch gates inherit from beta exit gates — derives from D-3704). Each entry follows the **Decision / Why / Implications** structure of prior entries (D-3702/3/4).
6. **Engine baseline unchanged: 444 tests / 110 suites / 0 fail.** Repo-wide 596 / 0 fail. WP-038 produces **zero new tests**.
7. **No code in any package.** No engine, server, or client file modified. `git diff --name-only packages/ apps/` returns zero output.
8. **The engine has no "launch mode."** Beta and GA are bit-for-bit identical. Launch readiness gates observe; they do not mutate.
9. **All gates are binary pass/fail** — no scoring, no subjective language.
10. **72-hour post-launch change freeze is hard.** Exceptions require the Freeze Exception Record.

No registry changes. No server changes. No client changes. No new tests. No new npm dependencies.

---

## Locked Values (Do Not Re-Derive)

### Commit & governance prefixes
- **EC / commit prefix:** `EC-038:` on content commit; `SPEC:` on governance / pre-flight bundle / post-mortem-only commits; `WP-038:` is **forbidden** (commit-msg hook rejects per P6-36).
- **Commit topology (three commits):**
  - **Commit A0 (`SPEC:`)** — pre-flight bundle: this session prompt + the pre-flight artifact + the copilot check. **Commit subject:** `SPEC: WP-038 pre-flight bundle — preflight + session prompt + copilot check`.
  - **Commit A (`EC-038:`)** — content + 01.6 post-mortem: two new docs + post-mortem. **Commit body must include a `Vision: §3, §5, §13, §14, §18, §22, §24, NG-1, NG-3` trailer** per [docs/ai/REFERENCE/01.3-commit-hygiene-under-ec-mode.md §Vision Trailer](../REFERENCE/01.3-commit-hygiene-under-ec-mode.md).
  - **Commit B (`SPEC:`)** — governance close: `STATUS.md` + `WORK_INDEX.md` + `EC_INDEX.md` + `DECISIONS.md` (D-3801 / D-3802 / D-3803). Commit body repeats the `Vision:` trailer.

### Four readiness gate categories (verbatim from WP-038 §Scope (A))

1. **Engine & Determinism** — invariant-violation baseline (WP-031), replay hash stability at scale (WP-027), network turn validation under load (WP-032), deterministic UI projection parity (WP-028/029). Any failure = NO-GO.
2. **Content & Balance** — content validation zero-errors (WP-033), no unresolved AI-simulation balance warnings (WP-036), no dominant strategy exceeding defined thresholds, beta balance feedback reconciled with simulation data. Warnings MAY be accepted only if classified non-invariant, non-competitive, and non-exploitable, with recorded justification; acceptance does not waive future correction or downgrade post-launch monitoring priority.
3. **Beta Exit Criteria** — all WP-037 exit criteria satisfied, no open P0/P1 issues, UX confusion reports below agreed baseline, kill switch exercised successfully. Any unmet criterion = NO-GO.
4. **Ops & Deployment** — release checklist completed (WP-035), rollback executed successfully in staging, migration tested forward, monitoring dashboards live and verified, no manual prod changes permitted.

### Launch day procedures (verbatim from WP-038 §Scope (B))

- **Final Build Verification (T-1h):** confirm build hash matches release artifact; confirm content version locked; confirm migrations are no-ops for fresh installs.
- **Soft Launch Window (T-0):** initial launch to limited traffic; monitor invariant violations, rejected turns, replay failures, session aborts. **PAUSE** traffic expansion on anomaly; **ROLLBACK** only when a rollback-trigger condition is met. If paused, analysis must conclude before proceeding to GO-LIVE or ROLLBACK.
- **Go-Live Signal:** first clean session completes; replay of that session matches live view; monitoring shows zero critical alerts.
- **Post-Launch Guardrails (T+0 to T+72h):** 72-hour change freeze (no feature releases); elevated monitoring cadence and alert sensitivity (invariant violations continuous, replay divergence = P1, balance anomalies logged but not hot-fixed); bugfixes only if deterministic + backward compatible + roll-forward safe; any change requires a written Freeze Exception Record (triggering condition, proof of determinism, proof of backward compatibility, roll-forward safety analysis, launch authority approval timestamp); rollback triggers: invariant violation spike, replay hash divergence, migration failure, client desync.

### Launch Authority Model (verbatim from WP-038 §Scope (C))

- Single launch authority — one accountable decision owner.
- MAY NOT waive failing readiness gates.
- MAY ONLY decide GO or NO-GO once all gates pass.
- Authority exists to prevent deadlock, not to override invariants.
- Required sign-offs before GO/NO-GO: engine integrity, replay determinism, content safety, operations readiness.
- No consensus voting — one person decides.
- Decision documented with timestamp and rationale.

### Expected DECISIONS.md entries (Commit B)

Three new entries, authored in the **### D-NNNN — Title** + **Decision:** / **Why:** / **Implications:** structure of D-3702/3/4:

- **D-3801 — Single Launch Authority Is Accountable, Not Consensus.** Rationale: accountability dissolves when spread across a committee; a single owner prevents deadlock; the authority cannot override invariants because WP-038's readiness gates are binary pass/fail and the authority MAY ONLY decide GO or NO-GO once all gates pass.
- **D-3802 — 72-Hour Post-Launch Change Freeze Is a Stability Observation Window.** Rationale: live-launch anomalies take time to surface; hot-fixing during observation introduces determinism drift; the Freeze Exception Record's 5 fields make any exception auditable; bugfix criteria (deterministic + backward compatible + roll-forward safe) preserve replay verifiability.
- **D-3803 — Launch Gates Inherit from Beta Exit Gates (via D-3704).** Rationale: D-3704 established that beta uses the same release gates as production; WP-038 formalizes this as the launch checklist consuming BETA_EXIT_CRITERIA.md as its Beta Exit category input; no parallel pipeline is built.

### Prose-vs-grep discipline (§18) — MANDATORY for launch docs

Per [docs/ai/REFERENCE/00.3-prompt-lint-checklist.md §18](../REFERENCE/00.3-prompt-lint-checklist.md) (codified at `f3e59b2`). When LAUNCH_READINESS.md or LAUNCH_DAY.md references engine-determinism requirements or forbidden runtime behaviors, **cite D-entries rather than enumerate literal tokens**. The WP-037 `beta.types.ts` §10 precedent applies:

- **Instead of:** "the engine must never call `Math.random()`, `Date.now()`, `performance.now()`, or `new Date()`"
- **Prefer:** "the engine preserves determinism per ARCHITECTURE.md §MVP Gameplay Invariants and D-3704 release-gate parity"

Violations surface as Final Gate row 33 FAIL on the next `scripts/audit/vision/run-all.mjs` run.

### Subjective-language forbidden list

The two launch docs may not contain (case-insensitive): "looks good", "looks great", "acceptable", "mostly ready", "good enough", "should be fine", "probably". Binary pass/fail only. Verification Step 5 below greps for these and requires zero hits.

---

## Required `// why:` Comments

- **None.** WP-038 produces documentation only; no code, no runtime mutation, no framework calls.

---

## Files Expected to Change (Allowlist — 7 files)

| File | New/Modify | Owner |
|---|---|---|
| `docs/ops/LAUNCH_READINESS.md` | **new** | Commit A |
| `docs/ops/LAUNCH_DAY.md` | **new** | Commit A |
| `docs/ai/post-mortems/01.6-WP-038-launch-readiness-go-live.md` | **new** | Commit A |
| `docs/ai/STATUS.md` | modify | Commit B |
| `docs/ai/DECISIONS.md` | modify (append D-3801, D-3802, D-3803) | Commit B |
| `docs/ai/work-packets/WORK_INDEX.md` | modify (WP-038 close line) | Commit B |
| `docs/ai/execution-checklists/EC_INDEX.md` | modify (EC-038 Draft → Done) | Commit B |

**No other files may be modified.** Any file outside this allowlist is a scope violation — escalate, do not force-fit.

Parallel work items in the working tree (D-6601 in DECISIONS.md; WP-066 appendix) **must NOT be included** in any WP-038 commit. At each `git add`, pass exact filenames; at each commit, confirm `git diff --cached --name-only` matches the allowlist exactly.

---

## Strategy-Doc-Pair Template (Reuse)

The `BETA_STRATEGY.md` + `BETA_EXIT_CRITERIA.md` pair (WP-037) establishes the shape WP-038 reuses:

- **Strategy document:** objectives + scope + prose rationale + rollout model.
- **Exit-criteria document:** binary pass/fail per category + measurable thresholds + source signals per criterion.

For WP-038 the mapping is:
- `LAUNCH_READINESS.md` — strategy-style, organized by the four categories. Includes pre-launch gates + launch authority model + go/no-go decision rule.
- `LAUNCH_DAY.md` — procedural, organized by timeline (T-1h, T-0, T+0 to T+72h). Includes soft-launch PAUSE vs ROLLBACK, go-live signal, freeze, Freeze Exception Record, rollback triggers.

Both documents must cite their source signals inline (e.g., "Engine invariants — validated by `runAllInvariantChecks` from WP-031" — no raw token lists per §18).

---

## Verification Steps

Execute each before checking any Acceptance Criteria in EC-038.

```bash
# Step 1 — confirm the two launch docs exist
test -f docs/ops/LAUNCH_READINESS.md && echo "LAUNCH_READINESS present"
test -f docs/ops/LAUNCH_DAY.md && echo "LAUNCH_DAY present"

# Step 2 — confirm no engine, server, or client files modified
git diff --name-only packages/ apps/
# Expected: no output

# Step 3 — confirm only allowlist files are touched
git diff --name-only
# Expected: only files in §Files Expected to Change

# Step 4 — confirm four gate categories present in LAUNCH_READINESS.md
grep -c "^## " docs/ops/LAUNCH_READINESS.md
# Expected: >= 4 (four category sections plus any top-level wrapper sections)

grep -E "^## .*(Engine|Determinism|Content|Balance|Beta Exit|Ops|Deployment)" docs/ops/LAUNCH_READINESS.md
# Expected: four category headings matching WP-038 §Scope (A)

# Step 5 — subjective-language grep (must return zero hits)
grep -iE "looks good|looks great|mostly ready|good enough|should be fine|probably" docs/ops/LAUNCH_READINESS.md docs/ops/LAUNCH_DAY.md
# Expected: no output (binary pass/fail only; "acceptable" permitted only in the locked
# Content/Balance warning-acceptance clause per EC-038 Locked Values)

# Step 6 — 72h freeze + Freeze Exception Record present in LAUNCH_DAY.md
grep -E "72.{0,5}hour|Freeze Exception Record" docs/ops/LAUNCH_DAY.md
# Expected: multiple hits covering the freeze window and the 5-field record

# Step 7 — PAUSE vs ROLLBACK distinction present
grep -E "PAUSE|ROLLBACK" docs/ops/LAUNCH_DAY.md
# Expected: explicit distinction language present

# Step 8 — rollback triggers listed verbatim
grep -E "invariant violation spike|replay hash divergence|migration failure|client desync" docs/ops/LAUNCH_DAY.md
# Expected: all four triggers present

# Step 9 — launch authority non-override clauses present
grep -E "MAY NOT waive|MAY ONLY decide|prevent deadlock" docs/ops/LAUNCH_READINESS.md
# Expected: all three non-override clauses present

# Step 10 — prose-vs-grep discipline (§18) — no forbidden-token enumeration in launch docs
grep -E "Math\.random|Date\.now|performance\.now|new Date\(\)" docs/ops/LAUNCH_READINESS.md docs/ops/LAUNCH_DAY.md
# Expected: no output (cite D-entries instead per §18)

# Step 11 — test baselines unchanged
pnpm --filter @legendary-arena/game-engine test
# Expected: 444 passing / 110 suites / 0 failing

pnpm -r test
# Expected: 596 passing / 0 failing repo-wide

# Step 12 — three new DECISIONS.md entries present at Commit B
grep -nE "^### D-380[123]" docs/ai/DECISIONS.md
# Expected: three entries (D-3801, D-3802, D-3803)

# Step 13 — WP-038 checked off in WORK_INDEX at Commit B
grep -nE "\[x\] WP-038" docs/ai/work-packets/WORK_INDEX.md
# Expected: one match with 2026-04-22 date

# Step 14 — EC-038 moved to Done in EC_INDEX at Commit B
grep -nE "EC-038.*Done" docs/ai/execution-checklists/EC_INDEX.md
# Expected: one match
```

---

## Execution Sequence (Hard-Locked)

1. **Pre-flight bundle commit (SPEC).** Stage the three pre-flight-bundle files (this prompt + pre-flight + copilot check) by exact filename. Commit as `SPEC: WP-038 pre-flight bundle — preflight + session prompt + copilot check`. Include the Vision trailer.
2. **Content authoring.** Write `docs/ops/LAUNCH_READINESS.md`, then `docs/ops/LAUNCH_DAY.md`. Follow the strategy-doc-pair template. Apply §18 prose-vs-grep discipline throughout. Use binary pass/fail language only.
3. **Run Verification Steps 1-10** on the two new docs. All must pass before proceeding.
4. **01.6 post-mortem.** Author `docs/ai/post-mortems/01.6-WP-038-launch-readiness-go-live.md`. Cover: risks surfaced, fixes applied during post-mortem (if any in-allowlist refinements), lifecycle isolation (not applicable), aliasing (not applicable), extension seam status, follow-up WP pointers (WP-039 Post-Launch Metrics consumes WP-038's four-category structure).
5. **Content commit (EC-038).** Stage the three new files (two launch docs + post-mortem) by exact filename. Commit as `EC-038: ship launch readiness and go-live checklist` with the Vision trailer.
6. **Run Verification Steps 11** (test baselines) against the content commit. Must be 444/110/0 and 596/0.
7. **Governance close.** Update `STATUS.md` (launch readiness checklist exists; go-live criteria defined; post-launch guardrails established). Update `WORK_INDEX.md` (check off WP-038 with 2026-04-22 date). Update `EC_INDEX.md` (EC-038 Draft → Done; increment Done counter). Append three new entries to `DECISIONS.md` (D-3801, D-3802, D-3803) per §Locked Values.
8. **Governance commit (SPEC).** Stage the four governance files by exact filename. Commit as `SPEC: close WP-038 / EC-038 — launch readiness and go-live checklist governance` with the Vision trailer.
9. **Run Verification Steps 12-14** against the governance commit.

If any step fails, STOP and raise as a pre-commit review finding — do not continue.

---

## Definition of Done

All of the following must hold:

- [ ] All Acceptance Criteria in WP-038 pass (binary pass/fail per item).
- [ ] All After Completing items in EC-038 pass.
- [ ] All Verification Steps above return expected output.
- [ ] `git diff --cached --name-only` at each commit matches the allowlist exactly.
- [ ] Test baseline unchanged (444/110/0; 596/0).
- [ ] No engine, server, or client files modified.
- [ ] WP-038 checked off in WORK_INDEX.md with 2026-04-22 date.
- [ ] EC-038 moved to Done in EC_INDEX.md.
- [ ] D-3801, D-3802, D-3803 landed in DECISIONS.md.
- [ ] STATUS.md updated.
- [ ] 01.6 post-mortem authored and committed.
- [ ] All three commits land on `main` (no push required by this session).

---

## Session Context Bridge Acknowledgment

The session-context-wp038 bridge is consumption-frozen per its §Freeze Note. This session prompt consumes the bridge's repo-state anchor, dirty-tree map (flagged RS-6 / RS-7), quarantine state, upstream contract surface, and established precedents. The bridge's Vision-block line number claim (190) is stale post-PS-1 (actual: 226) — this is a §19 bridge-vs-HEAD drift event acknowledged and accepted by the executor. No further reconciliation required.

---

*Session prompt authored 2026-04-22 against `main @ 3e26bb7` as the second artifact in the WP-038 pre-flight bundle. Pre-flight verdict READY; copilot check disposition CONFIRM. Next step: commit the SPEC pre-flight bundle, then execute Commit A (EC-038 content), then Commit B (SPEC governance close).*
