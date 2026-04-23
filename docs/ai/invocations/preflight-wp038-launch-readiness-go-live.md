# Pre-Flight — WP-038 Launch Readiness & Go-Live Checklist

**Target Work Packet:** `WP-038`
**Title:** Launch Readiness & Go-Live Checklist
**Previous WP Status:** WP-037 Complete (2026-04-22, `160d9b9` + `ee099c5`)
**Pre-Flight Date:** 2026-04-22
**Invocation Stage:** Pre-Execution (Scope & Readiness)
**Repo-state anchor:** `main @ 3e26bb7` (pre-session PS-1 + PS-2 tightening commit landed on top of `8e0fe77`)

**Work Packet Class:** Contract-Only / Documentation-Only

Rationale: WP-038 produces two new strategy documents under `docs/ops/` and three governance-document updates (`STATUS.md`, `DECISIONS.md`, `WORK_INDEX.md`). It ships **zero new tests**, **zero engine code**, **zero server code**, **zero client code**. It does not mutate `G`, does not wire into `game.ts`, does not add moves or phase hooks, does not add fields to `LegendaryGameState`, and does not change `buildInitialGameState` shape. It matches the WP-035 / WP-037 Docs-class Phase 7 precedent chain.

Mandatory sections per class: Dependency & Sequencing Check, Input Data Traceability, Structural Readiness, Scope Lock, Test Expectations, Risk Review. Skipped: Runtime Readiness, Mutation Boundary. Included lightly: Dependency Contract Verification, Code Category Boundary Check, Maintainability & Upgrade Readiness, Invocation Prompt Conformance Check.

---

## Pre-Flight Intent

Perform a pre-flight validation for WP-038.

- Not implementing.
- Not generating code.
- Validating readiness and constraints only.

Verdict is binary (READY / NOT READY). Pre-session actions PS-1 + PS-2 resolved at `3e26bb7` before this pre-flight artifact was committed.

---

## Authority Chain (Read in Order)

1. `.claude/CLAUDE.md` — EC-mode, lint gate, commit discipline — read.
2. `docs/ai/ARCHITECTURE.md` — Layer Boundary (Authoritative), "MVP Gameplay Invariants", §Section 3 Persistence Classes — read.
3. `docs/01-VISION.md` — Primary Goals (#1-5), Secondary Goals (#6-19), Scoring & Skill Measurement (#20-26), Non-Goals (NG-1..7) — read. §5 clause verified as "Longevity & Expandability".
4. `docs/03.1-DATA-SOURCES.md` — N/A: WP-038 consumes no input datasets.
5. `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` — N/A: `docs/ops/` is already a documented docs location; no new engine subdirectory.
6. `docs/ai/execution-checklists/EC-038-launch-readiness.checklist.md` — read. Locked values copied verbatim from WP-038 after the PS-1 tightening.
7. `docs/ai/work-packets/WP-038-launch-readiness-go-live-checklist.md` — read. `## Vision Alignment` block present at line 226 (was line 190 at bridge authoring; PS-1 tightening shifted it).
8. `docs/ai/session-context/session-context-wp038.md` — read. Bridge is consumption-frozen; this pre-flight is its consumer.

Higher-authority documents win where they conflict with lower. No conflicts were found.

---

## Vision Sanity Check (01.4 §Vision Sanity Check)

Per `00.3 §17` (gate landed at `0689406`) and `00.3 §17.2` no-paraphrase discipline. Clause titles are verified against `docs/01-VISION.md` headers:

- **Vision clauses touched by this WP:** §3 (Player Trust & Fairness), §5 (Longevity & Expandability), §13 (Execution Checklist–Driven Development), §14 (Explicit Decisions, No Silent Drift), §18 (Replayability & Spectation), §22 (Deterministic & Reproducible Evaluation), §24 (Replay-Verified Competitive Integrity), NG-1 (Pay-to-Win or Power Purchases), NG-3 (Content Withheld for Competitive Advantage).
- **Conflict assertion:** `No conflict: this WP preserves all touched clauses.`
- **Non-Goal proximity:** WP-038 is documentation-only launch readiness. It does not introduce monetization surfaces, cosmetic scarcity, leaderboard policies, identity mechanisms, or competitive-advantage content gating. NG-1 and NG-3 are not crossed — launch readiness asserts, not mutates, the invariants underpinning them. NG-2 / NG-4..7 are not triggered.
- **Determinism preservation:** WP-038 introduces no runtime behavior, no replay-affecting code, no numerical logic. Launch readiness gates assert the continued satisfaction of existing determinism invariants (e.g., replay hash stability, invariant violation spikes) rather than redefining them. Replay, determinism, and content-balance gates cited in the checklist validate — not replace — locked invariants.
- **WP `## Vision Alignment` section status:** Present at line 226 of `WP-038-launch-readiness-go-live-checklist.md`. Landed at `485d0d0`; paraphrase corrections (PS-2) landed at `3e26bb7`. The block's clause citations now match canonical VISION.md titles verbatim.

---

## Dependency & Sequencing Check

All prerequisites verified present and complete at `3e26bb7`:

| WP | Status | Evidence |
|---|---|---|
| WP-027 Replay Verification | PASS | `packages/game-engine/src/replay/replay.verify.ts` exists; `verifyDeterminism`, `DeterminismResult` exported |
| WP-028 UI Projection | PASS | cited by WP-038 §Engine gate; WORK_INDEX closed |
| WP-029 Replay Playback Consistency | PASS | cited; WORK_INDEX closed |
| WP-031 Engine Invariants | PASS | `packages/game-engine/src/invariants/` has 8 files (`runAllChecks`, 4 check modules, types, tests) |
| WP-032 Network Turn Validation | PASS | cited; WORK_INDEX closed |
| WP-033 Content Validation | PASS | cited; WORK_INDEX closed |
| WP-034 Versioning & Migration | PASS | `packages/game-engine/src/versioning/` has 5 files |
| WP-035 Release Process & Ops | PASS | `docs/ops/RELEASE_CHECKLIST.md`, `DEPLOYMENT_FLOW.md`, `INCIDENT_RESPONSE.md` present |
| WP-036 AI Balance Simulation | PASS | `packages/game-engine/src/simulation/simulation.runner.ts` exists |
| WP-037 Public Beta | PASS | `docs/beta/BETA_STRATEGY.md` + `BETA_EXIT_CRITERIA.md` present; `packages/game-engine/src/beta/beta.types.ts` exports `BetaFeedback`, `BetaCohort`, `FeedbackCategory` |

Transitive dependency `WP-042` (R2 / PostgreSQL deployment checklists) verified: `docs/ai/deployment/r2-data-checklist.md` + `postgresql-checklist.md` present.

All D-entries cited by WP-038 verified:

- D-0702 (Balance Changes Require Simulation) — `DECISIONS.md:285` (em-dash `D‑0702`)
- D-0802 (Incompatible Data Fails Loudly) — `DECISIONS.md:318` (em-dash)
- D-0902 (Rollback Is Always Possible) — `DECISIONS.md:336` (em-dash)
- D-3702 / D-3703 / D-3704 — WP-037 governance close entries
- D-8501 — WP-085 queued-instrument anchor

No sequencing blockers.

---

## Dependency Contract Verification

Documentation-only WP — no types imported, no function signatures consumed, no setup-time derived fields introduced. The WP cites WPs and D-entries as prose references. All cited entries verify present.

*Note on encoding:* DECISIONS.md uses em-dashes (`D‑0702`) in headings; grep for regular hyphen (`D-0702`) returns zero. Per WP-028 precedent (decision ID encoding mismatch risk), searches performed by title keyword as fallback.

---

## Input Data Traceability Check

N/A across the board. WP-038 produces prose gates in `docs/ops/LAUNCH_READINESS.md` and `docs/ops/LAUNCH_DAY.md`. No R2, no PostgreSQL, no card JSON, no registry data consumed. No setup-time derived fields introduced.

---

## Structural Readiness Check (Types & Contracts)

- Prior WPs compile and tests pass: **YES** (baseline carried from session-context `596 passing / 0 failing` at `8b84587`; forward-verified against `3e26bb7` at session open).
- No open EC violations: **YES** (EC-038 Draft in EC_INDEX line 145; no prior violations).
- Required types/contracts exist as referenced: **YES** (Documentation-only; no types introduced).
- No naming/ownership conflicts: **YES**.
- No architectural boundary conflicts: **YES** — `docs/ops/` is Docs category.

---

## Runtime Readiness Check / Mutation Boundary Confirmation

**SKIPPED** — Work Packet Class is Contract-Only / Documentation-Only. No runtime code produced. No `G` mutation.

---

## 01.5 Runtime Wiring Allowance — NOT INVOKED

Per `docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md` §When to Include This Clause + §Escalation. WP-038 produces only prose gates in `docs/ops/`. Each of the four 01.5 trigger criteria is enumerated and marked absent:

| 01.5 Trigger Criterion | Applies to WP-038? | Justification |
|---|---|---|
| Adds a required field to `LegendaryGameState` or another shared type | **No** | Zero engine code changes. |
| Changes the shape of a return type produced by `buildInitialGameState` or similar setup orchestrators | **No** | No engine modification. |
| Adds a new move to `LegendaryGame.moves` that affects structural assertions in existing tests | **No** | No move added. |
| Adds a new phase hook that alters the expected structural shape of gameplay initialization or test scaffolding | **No** | No phase hook added. |

**Conclusion:** 01.5 is NOT INVOKED. The scope lock applies without the allowance. Per 01.5 §Escalation, the allowance may not be cited retroactively — any unanticipated structural break mid-execution requires STOP + escalation, not force-fit.

---

## 01.6 Post-Mortem Trigger Evaluation — MANDATORY

WP-038 introduces two new long-lived abstraction documents (`docs/ops/LAUNCH_READINESS.md` and `docs/ops/LAUNCH_DAY.md`) that are canonical references for the lifetime of the project, consumed by WP-039 (Post-Launch Metrics & Live Ops) per WORK_INDEX dependency chain. The 01.6 "long-lived abstractions" trigger applies — post-mortem is mandatory at `docs/ai/post-mortems/01.6-WP-038-launch-readiness-go-live.md`, following the WP-037 precedent.

---

## Code Category Boundary Check

- Both output files live under `docs/ops/` — Docs category. Prior precedents: `RELEASE_CHECKLIST.md`, `DEPLOYMENT_FLOW.md`, `INCIDENT_RESPONSE.md` already populate this tree (WP-035).
- No new `packages/game-engine/src/<dir>/` introduced → no D-entry classification required.

---

## Scope Lock

### WP-038 Is Allowed To

- **Create:** `docs/ops/LAUNCH_READINESS.md` — four readiness gate categories (Engine & Determinism, Content & Balance, Beta Exit, Ops & Deployment), explicit binary pass/fail per gate, final GO/NO-GO verdict summary.
- **Create:** `docs/ops/LAUNCH_DAY.md` — final build verification (T-1h), soft launch window (T-0) with explicit PAUSE-vs-ROLLBACK distinction, go-live signal, post-launch guardrails (T+0 to T+72h) including 72h freeze, Freeze Exception Record requirements (5 fields), rollback triggers.
- **Modify (governance only):** `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`.
- **Create (01.6):** `docs/ai/post-mortems/01.6-WP-038-launch-readiness-go-live.md`.

### WP-038 Is Explicitly Not Allowed To

- Modify any file under `packages/` or `apps/`.
- Introduce a "launch mode" anywhere in the engine.
- Soften binary pass/fail gates to subjective language ("looks good", "mostly ready", "acceptable").
- Waive or relax the 72-hour freeze, the Freeze Exception Record, or the PAUSE-vs-ROLLBACK distinction in the produced artifacts.
- Modify prior contract files (`beta.types.ts`, `replay.verify.ts`, `ops.types.ts`, etc.).
- Expand `CoreMoveName` or any canonical array.
- Invoke 01.5 retroactively.
- Touch any file not in the allowlist below.

### Allowlist (Final, 7 files)

| File | New/Modify | Source |
|---|---|---|
| `docs/ops/LAUNCH_READINESS.md` | new | EC-038 §Files to Produce |
| `docs/ops/LAUNCH_DAY.md` | new | EC-038 §Files to Produce |
| `docs/ai/STATUS.md` | modify | WP-038 DoD |
| `docs/ai/DECISIONS.md` | modify | WP-038 DoD (new entries: single launch authority, 72h freeze, launch gates vs beta exit) |
| `docs/ai/work-packets/WORK_INDEX.md` | modify | WP-038 DoD |
| `docs/ai/execution-checklists/EC_INDEX.md` | modify | EC-038 Phase 7 Draft → Done |
| `docs/ai/post-mortems/01.6-WP-038-launch-readiness-go-live.md` | new | 01.6 MANDATORY |

Any additional file modification is out of scope.

---

## Test Expectations (Locked Before Execution)

- **New tests:** 0.
- **Existing test baseline (at session open):** 596 passing / 0 failing repo-wide; engine 444 / 110 / 0.
- **Expected baseline after WP-038:** unchanged at 596 / 0 — matches RS-2 zero-new-tests pattern from WP-035 / WP-037.
- **Forbidden:** no modifications to `makeMockCtx`, no `boardgame.io/testing` imports, no new `.test.ts` files, no logic in existing test files.

---

## Maintainability & Upgrade Readiness (Senior Review)

- **Extension seam exists:** YES — the four-category structure is an extension seam; WP-039 (Post-Launch Metrics & Live Ops) will extend `LAUNCH_READINESS.md` with live-ops criteria by adding a new category section, not rewriting existing ones.
- **Patch locality:** YES — a future correction to a single gate is a one-section edit in one of two files.
- **Fail-safe behavior:** N/A for prose documents; but the documents themselves mandate fail-safe runtime behavior (binary pass/fail, PAUSE vs ROLLBACK, Freeze Exception Record).
- **Deterministic reconstructability:** N/A for prose.
- **Backward-compatible test surface:** N/A (zero new tests).
- **Semantic naming stability:** YES — `LAUNCH_READINESS.md`, `LAUNCH_DAY.md` are project-lifetime stable names.

---

## Risk & Ambiguity Review

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| RS-1 | §18 prose-vs-grep discipline (codified at SPEC `f3e59b2`): the two launch docs will list forbidden engine behaviors. Enumerating tokens (`Math.random`, `Date.now`, `new Date()`, `launch mode`) in prose risks Final Gate row 33 FAIL on the next `run-all.mjs` audit. | MEDIUM | Cite D-entries and WP references instead of literal token strings. The WP-037 `beta.types.ts` §10 precedent applies verbatim: replace token lists with "per D-3704 determinism invariants" or "per ARCHITECTURE.md §MVP Gameplay Invariants". Lock in session prompt. |
| RS-2 | Commit prefix discipline: P6-36 rejects `WP-038:`; the commit-msg hook rejects per the hook's Rule 2. | LOW | Session prompt mandates `EC-038:` on content commit, `SPEC:` on governance / pre-flight bundle / post-mortem-only commits. |
| RS-3 | DECISIONS.md entries for this WP: WP-038 DoD requires three minimum (single launch authority, 72h freeze, launch gates vs beta exit). Next available slot is D-3801+. | MEDIUM | Session prompt lists expected slots: D-3801 (single launch authority — accountability over consensus), D-3802 (72-hour freeze — stability observation), D-3803 (launch gates inherit beta exit gates — derives from D-3704). Each entry authored with **Why:** and **How to apply:** structure per the user's memory-system discipline for feedback/project memories. |
| RS-4 | Bridge-vs-HEAD §19 drift event already observed: session-context-wp038 Vision block line cited as 190; actual line is 226 after PS-1 tightening. | LOW | Pre-flight acknowledges the drift; bridge is consumption-frozen; no further reconciliation needed. |
| RS-5 | Three-commit topology: the pre-flight bundle (this artifact + session prompt + copilot check) must land as a SPEC commit before the EC-038 content commit. | LOW | Session prompt locks topology: Commit A0 (SPEC, this bundle) → Commit A (`EC-038:` content + post-mortem) → Commit B (SPEC governance close). |
| RS-6 | Unstaged parallel work in the working tree (D-6601 + WP-066 appendix) is unrelated to WP-038 scope but could accidentally be swept into a commit via `git add -A`. | LOW | Session prompt mandates stage-by-exact-filename per P6-27 / P6-44; pre-commit review verifies `git diff --cached --name-only` matches the allowlist exactly. |
| RS-7 | Uncommitted working-tree changes at session start (D-6601 + WP-066 appendix) may have `git status` return non-worktrees-only output. | LOW | Session prompt flags this state; executor lists the files, does not touch them, and confirms none are staged at each commit boundary. |
| RS-8 | WP-039 (downstream consumer) will expect the four-category structure. If WP-038 reshapes to three or five categories mid-execution, WP-039 re-work follows. | LOW | Session prompt hard-locks the four categories to match WP-038 §Scope (In) structure; the PS-1 tightening already hardened this. |
| RS-9 | The two launch docs must use binary pass/fail language only — no scoring, no subjective adjectives. EC-038 §Guardrails after PS-1 tightens this ("no scoring, no subjective language \"looks good\", \"acceptable\""). | MEDIUM | Session prompt cites EC-038 §Guardrails verbatim and adds a verification step: grep for subjective adjectives in the two new docs and require zero hits. |
| RS-10 | 01.6 post-mortem coverage — mandatory per the "new long-lived abstraction documents" trigger. | LOW | Post-mortem authored in the same session as content commit, before Commit A. |

All risks have mitigations locked into the session prompt Locked Values / Verification Steps.

---

## Pre-Flight Verdict (Binary)

**READY TO EXECUTE** — Pre-session actions PS-1 and PS-2 resolved at `3e26bb7` before this verdict.

Justification: All ten prerequisite WPs verified complete with artifacts present on disk. All cited D-entries verified present. The WP-038 + EC-038 contract is hardened by the PS-1 tightening (Freeze Exception Record, PAUSE-vs-ROLLBACK, non-override authority clauses, strict-reading interpretation default). The WP-038 §Vision Alignment block carries canonical clause titles after PS-2 correction. Scope lock is a 7-file allowlist; 01.5 NOT INVOKED; 01.6 MANDATORY; zero new tests; baseline held at 596 / 0. Maintainability and extension seams are locked. All risks RS-1 through RS-10 have scope-neutral mitigations folded into the session prompt.

---

## Pre-Session Actions — ALL RESOLVED (2026-04-22)

1. **PS-1** — Commit the uncommitted WP-038 + EC-038 tightening edits (`+80 / -35`) as a SPEC commit. **Resolved at `3e26bb7`** ("SPEC: tighten WP-038 + EC-038 launch-readiness contract and correct §5 Vision citation"). The edits add the §Referenced Work Packets block, Freeze Exception Record (5 fields), PAUSE-vs-ROLLBACK distinction, non-override authority clauses, strict-reading interpretation default, and split per-file DoD items.
2. **PS-2** — Correct the WP-038 §Vision Alignment §5 citation from "Operational Transparency" (not in VISION.md) to "Longevity & Expandability" (canonical §5 title at VISION.md:59). Also tightened paraphrases on §3, §13, §14, §18, §22, §24, NG-1, NG-3 to canonical titles. **Resolved at `3e26bb7`** (same commit as PS-1).

All mandatory pre-session actions are complete. No re-run of pre-flight required — these updates resolve risks identified by this pre-flight without changing scope.

---

## Invocation Prompt Conformance Check (Pre-Generation)

Confirmed against the WP-038 session execution prompt authored adjacent to this pre-flight:

- All EC-038 locked values are copied verbatim into the session prompt.
- No new keywords, helpers, file paths, or timing rules appear only in the prompt.
- File paths and scope match the WP exactly.
- No forbidden imports or behaviors introduced by wording changes.
- The prompt resolves no ambiguities that were not resolved here.
- Contract names and field names match the verified dependency code.

The session prompt is a transcription + ordering artifact only. No interpretation is required.

---

## Authorized Next Step

> You are authorized to generate a **session execution prompt** for WP-038 as:
> `docs/ai/invocations/session-wp038-launch-readiness-go-live.md`

**Guard:** The session prompt **must conform exactly** to the scope, constraints, and decisions locked by this pre-flight. No new scope may be introduced.

The next commit on `main` will be the SPEC pre-flight bundle containing this artifact + the session prompt + the copilot check. The session executor then commits `EC-038:` content + 01.6 post-mortem (Commit A), followed by `SPEC:` governance close (Commit B).

---

*Pre-flight authored 2026-04-22 against `main @ 3e26bb7`. PS-1 and PS-2 resolved in that same commit. Next workflow step: 01.7 Copilot Check, followed by session prompt generation.*
