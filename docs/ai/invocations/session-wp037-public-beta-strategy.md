# Session Prompt — WP-037 Public Beta Strategy

**Work Packet:** [docs/ai/work-packets/WP-037-public-beta-strategy.md](../work-packets/WP-037-public-beta-strategy.md)
**Execution Checklist:** [docs/ai/execution-checklists/EC-037-beta-strategy.checklist.md](../execution-checklists/EC-037-beta-strategy.checklist.md)
**Session Context Bridge:** *none produced for WP-037 — WP-036 step 8 did not emit `session-context-wp037.md`. Context is carried by this prompt, the pre-flight, the WORK_INDEX WP-036 close-row, and `docs/ai/session-context/session-context-wp036.md` (if re-read).*
**Commit prefix:** `EC-037:` on every code-changing commit; `SPEC:` on governance / doc-only commits; `WP-037:` is **forbidden** (commit-msg hook rejects per P6-36).
**Pre-flight verdict:** READY TO EXECUTE — WP-036 dependency green at `04c53c0`; D-3701 classification + `02-CODE-CATEGORIES.md` update landed in Commit A0 SPEC pre-flight bundle at `a4f5574` (2026-04-22); `00.3 §17` vision alignment gate landed at `0689406` (2026-04-22); WP-037's `## Vision Alignment` block added at `e5b0d67` (`SPEC: WP-037 add Vision Alignment block per §17 gate`) so a pre-flight re-run under current rules returns READY with the Vision Sanity Check (§Vision Sanity Check below) affirmed; engine baseline 444 / 110 / 0 fail; repo-wide baseline 596 / 0 fail. PS-1 (D-3701 directory classification), RS-1 (BetaFeedback metadata-only lock, never stored in `G`), RS-2 (test-count lock at 444 / 110 / 0 with zero new tests), RS-3 (expanded engine-isolation grep covering all existing engine subdirectories), RS-4 (01.5 NOT INVOKED declaration), RS-7 (`-SimpleMatch` require() grep), and **VS-1 (Vision Sanity Check block present in this prompt; WP-037 `## Vision Alignment` block present at `e5b0d67`)** all resolved in this prompt's Locked Values and Verification Steps.
**WP Class:** Contract-Only + Documentation (pure type definitions, two new strategy docs, additive re-exports; no `G` mutation, no `game.ts` wiring, no moves, no phase hooks, no new tests).
**Primary layer:** Release Strategy / User Feedback / Risk Management — engine-owned type surface at `packages/game-engine/src/beta/` + non-engine docs at `docs/beta/`.

---

## Pre-Session Gates (Resolve Before Writing Any File)

1. **Commit-prefix confirmation.** `EC-037:` on code, `SPEC:` on governance. Triple cross-referenced: WP-037 (§Definition of Done implicitly via EC-mode), EC-037 line 1, this prompt line 4. If anyone insists on `WP-037:`, STOP — the commit-msg hook rejects it per **P6-36**.

2. **Governance committed (P6-34).** Before the first engine-file edit, run `git log --oneline -5` and confirm the SPEC pre-flight commit landed **D-3701** in `docs/ai/DECISIONS.md` and the `packages/game-engine/src/beta/ (D-3701)` entry in `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` §engine subdirectory list. Expected head of list (or descendants):

   ```pwsh
   git log --oneline -5
   # Expected: a4f5574 SPEC: WP-037 PS-1 — D-3701 beta code category + 02-CODE-CATEGORIES update
   #           f739d7c INFRA: build registry package before viewer build
   #           915a2ca SPEC: close WP-066 / EC-066 governance (WORK_INDEX + EC_INDEX + post-mortem)
   #           9f400d8 EC-066: add registry viewer card image-to-data toggle
   #           62b68d1 SPEC: WP-066 copilot check + session execution prompt
   ```

   If unlanded, STOP — execution is blocked on the directory-classification precedent. D-3701 follows D-2706 / D-2801 / D-3001 / D-3101 / D-3201 / D-3301 / D-3401 / D-3501 / D-3601 — **nine prior precedents**, this is the tenth engine subdirectory. `DECISIONS.md` anticipated this slot at D-3501 line 5417 and D-3601 line 6378.

3. **Upstream dependency green at session base commit.** Run `pnpm --filter @legendary-arena/game-engine test` and `pnpm -r test`. Expect engine **444 passing / 110 suites / 0 failing** and repo-wide **596 passing / 0 failing** (registry 13 + vue-sfc-loader 11 + game-engine 444 + server 6 + replay-producer 4 + preplan 52 + arena-client 66 = 596). If the repo baseline diverges, STOP and reconcile against `WORK_INDEX.md`. Specifically confirm WP-036 closed at `04c53c0`:

   ```pwsh
   git log --oneline -10 | Select-String "04c53c0|4e340fd"
   # Expected: both hashes present (WP-036 code commit + SPEC pre-flight bundle)
   ```

4. **Working-tree hygiene.** `git status --short` will show inherited dirty-tree files from prior sessions (M `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`, M `docs/ai/REFERENCE/01.3-commit-hygiene-under-ec-mode.md`, M `docs/ai/REFERENCE/01.4-pre-flight-invocation.md`, M `docs/ai/work-packets/WP-039-post-launch-metrics-live-ops.md`, `??` `.claude/worktrees/`). **None of these are in WP-037 scope.** Retained stashes `stash@{0}` through `stash@{3}` are owned by prior-WP resolvers (WP-084/083 pre-branch-cut, WP-055 viewer quarantine, WP-062/068 MOVE_LOG_FORMAT, WP-068 lessons-learned) — **do NOT pop any of them**. Stage by exact filename only; never `git add .` / `git add -A` / `git add -u` (P6-27 / P6-44 discipline).

5. **Code-category classification confirmed (engine, NOT cli-producer-app, NOT client-app, NOT content, NOT preplan).** Open [docs/ai/REFERENCE/02-CODE-CATEGORIES.md](../REFERENCE/02-CODE-CATEGORIES.md) §`engine` and confirm the new `src/beta/` subdirectory entry was added by the SPEC pre-flight commit (D-3701, line 104). Engine category rules apply to `packages/game-engine/src/beta/`: no `boardgame.io` import, no `@legendary-arena/registry` import, no `apps/server/` import, no cross-subdirectory engine imports, no `Math.random()`, no `Date.now()` / `performance.now()` / `new Date()`, no I/O, no `.reduce()` with branching, no `require()`, no throwing. The two `docs/beta/*.md` files are **non-engine** (documentation at the repo-root `docs/` tree) — category rules do NOT apply to their prose.

If any gate is unresolved, STOP.

---

## Runtime Wiring Allowance (01.5) — NOT INVOKED

Per [docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md](../REFERENCE/01.5-runtime-wiring-allowance.md) §When to Include This Clause + §Escalation. WP-037 is purely additive engine work (new `src/beta/` subdirectory with three JSON-serializable type declarations) plus documentation. Each of the four 01.5 trigger criteria is enumerated below and marked absent:

| 01.5 Trigger Criterion | Applies to WP-037? | Justification |
|---|---|---|
| Adds a required field to `LegendaryGameState` or another shared type | **No** | `LegendaryGameState` is not modified. `BetaFeedback`, `BetaCohort`, `FeedbackCategory` are new standalone types; none extends, embeds into, or widens `LegendaryGameState`. Beta types are **metadata, never stored in G** (WP-037 §Non-Negotiable; EC-037 §Guardrails; D-3701 metadata-not-state rationale). |
| Changes the shape of a return type produced by `buildInitialGameState` or similar setup orchestrators | **No** | `buildInitialGameState` is unchanged. No setup orchestrator signature shifts. No `BetaFeedback` instance is constructed at match setup (runtime ownership lives in server/ops tooling per D-3701 sub-rule). |
| Adds a new move to `LegendaryGame.moves` that affects structural assertions in existing tests | **No** | No move is added, removed, or renamed. No move-map length assertion is altered. Engine baseline **444 / 110 / 0 fail** must hold unchanged (see Verification Steps). |
| Adds a new phase hook that alters the expected structural shape of gameplay initialization or test scaffolding | **No** | No phase hook is added. No `ctx.events.setPhase()` / `ctx.events.endTurn()` call is introduced. No existing test asserts against `src/beta/`. |

**Conclusion:** 01.5 is NOT INVOKED. The scope lock below applies without the allowance. Any file beyond the allowlist in §Files Expected to Change is a scope violation per **P6-27**, not a minor additive deviation — escalate to a pre-flight amendment rather than shipping it.

Per 01.5 §Escalation: *"It may not be cited retroactively in execution summaries or pre-commit reviews to justify undeclared changes."* If an unanticipated structural break appears mid-execution, STOP and escalate — do not force-fit.

---

## Copilot Check (01.7) — COMPLETED, VERDICT: CONFIRM

Per [docs/ai/REFERENCE/01.7-copilot-check.md](../REFERENCE/01.7-copilot-check.md) §When Copilot Check Is Required + §Discipline. WP-037 is **Contract-Only + Documentation**, for which 01.7 is *recommended but optional*. It is included here explicitly because the WP introduces a new engine subdirectory (`src/beta/`), a new canonical data shape (`BetaFeedback`) with seven locked fields, two closed literal unions (`BetaCohort`, `FeedbackCategory`), and two strategy docs that lock beta-pillar semantics for the lifetime of the project.

The 30-issue scan was applied to the union of this session prompt + WP-037 + EC-037 + the 2026-04-22 pre-flight (in-session, uncommitted). Summary verdicts below; any non-`PASS` finding is accompanied by a `FIX` folded directly into this prompt's Locked Values / Non-Negotiable Constraints / Verification Steps.

**Category 1 — Separation of Concerns & Boundaries**
- **#1 Engine vs UI / App Boundary Drift — PASS.** Beta types are metadata only; no engine logic modifies or reads them. Two beta docs live under `docs/beta/` (non-engine). WP-037 §Packet-specific ("Beta feedback types are metadata — never stored in G") and EC-037 §Guardrails lock the asymmetry.
- **#9 UI Re-implements Engine Logic — PASS.** Beta docs describe strategy / exit criteria; the engine emits no UI state for beta feedback. Beta users see the same `UIState` as production users (WP-037 §Packet-specific — "no special beta views beyond build ID display").
- **#16 Lifecycle Wiring Creep — PASS.** No `game.ts` edit, no move, no phase hook. §Files Expected to Change allowlist forbids it. 01.5 NOT INVOKED (above).
- **#29 Assumptions Leaking Across Layers — PASS.** WP-037 §Packet-specific: "No 'beta mode' in the engine — beta games run the same deterministic engine as production." The engine never reads a `BetaFeedback` instance; collection is a server/ops concern (D-3701 sub-rule, WP-037 Out of Scope).

**Category 2 — Determinism & Reproducibility**
- **#2 Non-Determinism Introduced by Convenience — PASS.** `beta.types.ts` is pure type definitions — no functions, no runtime code. No `Math.random()`, `Date.now()`, or `performance.now()` possible. Beta games run the same deterministic engine as production.
- **#8 No Single Debugging Truth Artifact — PASS.** Replay remains the canonical debugging artifact. `BetaFeedback.reproductionReplayId` is optional and references replay IDs (from WP-027 harness) — reinforcing replay as the debugging truth.
- **#23 Lack of Deterministic Ordering Guarantees — PASS.** `FeedbackCategory` and `BetaCohort` are closed ordered unions; the seven `BetaFeedback` fields have a locked field order (see Locked Values).

**Category 3 — Immutability & Mutation Discipline**
- **#3 Pure vs Immer Confusion — PASS.** No functions in scope. No `G` mutation.
- **#17 Hidden Mutation via Aliasing — PASS.** No runtime instance lives in the engine (D-3701 sub-rule). Future consumers (server layer, ops tooling) that construct `BetaFeedback` objects are outside WP-037 scope.

**Category 4 — Type Safety & Contract Integrity**
- **#4 Contract Drift Between Types, Tests, and Runtime — PASS.** EC-037 §Locked Values and this prompt's §Locked Values both copy the three type shapes verbatim. No drift-detection canonical array is required (the two closed unions have 3 and 5 members; a canonical-array seam is not proportionate per the 01.4 "Established Patterns" sizing rule — mirrors D-3501 rationale for the 4-member `DeploymentEnvironment` / `IncidentSeverity` unions).
- **#5 Optional Field Ambiguity — PASS.** `BetaFeedback.reproductionReplayId` is the sole optional field, declared with `?:` syntax. `exactOptionalPropertyTypes: true` compatibility: consumers construct the object conditionally (append `reproductionReplayId` only when present) rather than passing `undefined`. The WP-029 `preserveHandCards` conditional-assignment pattern applies if a consumer needs to build the object incrementally; however since WP-037 defines the type only (no constructor helpers), this risk is deferred to the future server-side collection WP.
- **#6 Undefined Merge Semantics — PASS.** No merging, overriding, or config-layering in scope.
- **#10 Stringly-Typed Outcomes — PASS.** Both union types (`BetaCohort`, `FeedbackCategory`) are closed literal unions. Consumers must exhaustively switch. `severity: 1 | 2 | 3` is a closed numeric union (not an arbitrary `number`).
- **#21 Type Widening at Boundaries — PASS.** No `string`, `any`, or `unknown`. Field types are primitives with narrow unions. `sessionId: string` and `buildVersion: string` are the only general-string fields — both are opaque identifiers whose narrow-typing is a future governance question (not an MVP concern for a Contract-Only WP).
- **#27 Weak Canonical Naming — PASS.** Field names are full English (`sessionId`, `buildVersion`, `category`, `description`, `severity`, `reproductionReplayId`) — no abbreviations (00.6 Rule 4). `BetaFeedback`, `BetaCohort`, `FeedbackCategory` match their prose usages in docs verbatim. EC-037 §Locked Values enforces verbatim copy.

**Category 5 — Persistence & Serialization**
- **#7 Persisting Runtime State — PASS.** Beta types never enter `G`. EC-037 §Guardrails: "Beta feedback types are metadata — never stored in `G`." WP-037 §Verification Step 3 greps `LegendaryGameState` for `BetaFeedback` and expects no match inside the interface definition.
- **#19 Weak JSON-Serializability — PASS.** All three types are plain objects / primitive unions — no `Map`, `Set`, `Date`, functions, or class instances. D-1232 holds. D-3701 Sub-rule: "no constants, no functions, no module-level state" in `beta.types.ts`.
- **#24 Mixed Persistence Concerns — PASS.** Beta feedback is transport metadata (server-side collection); production-identical engine state is Class 1 runtime (never persisted); beta release artifacts are Class 2 Configuration (same as production per WP-037 §Packet-specific "beta uses the same release gates as production"). Classes do not blur.

**Category 6 — Testing & Invariant Enforcement**
- **#11 Tests Validate Behavior, Not Invariants — PASS with FIX.** WP-037 produces **zero new tests** (RS-2 lock). The existing 444 engine tests must continue to pass unchanged — no invariant regression. **FIX:** §Verification Steps explicitly asserts engine count **unchanged at 444 / 110 / 0 fail** and repo-wide at **596 / 0** as post-flight checks (catches any accidental test-file leak).

**Category 7 — Scope & Execution Governance**
- **#12 Scope Creep — PASS.** §Files Expected to Change is a strict five-file allowlist. `git diff --name-only` is a required verification step. P6-27 is active.
- **#13 Unclassified Directories — PASS.** D-3701 classifies `src/beta/` before execution (landed at `a4f5574`). `docs/beta/` is non-engine; precedents (`docs/ops/`, `docs/ai/`, `docs/screenshots/`) confirm top-level docs subdirectories need no D-entry.
- **#30 Missing Pre-Session Governance Fixes — PASS.** PS-1 (D-3701) resolved at `a4f5574` before this session opens. RS-1 through RS-7 resolved in this prompt's Locked Values and Verification Steps.

**Category 8 — Extensibility & Future-Proofing**
- **#14 No Extension Seams — PASS.** `FeedbackCategory` is designed for future category additions via a new WP + matching `DECISIONS.md` entry (extension seam explicitly called out in D-3701 Implications). `BetaCohort` is closed at three cohorts intentionally (WP-037 §Locked contract values; adding a fourth cohort is a governance decision, not a silent code change). `severity: 1 | 2 | 3` allows future extension via union widening (governance event).
- **#28 No Upgrade or Deprecation Story — PASS.** Beta types are additive. No existing code assumes their absence. WP-037 is feedback-collection only; future WPs that persist feedback (WP-039 Live Ops Metrics) will introduce their own versioning governance.

**Category 9 — Documentation & Intent Clarity**
- **#15 Missing "Why" for Invariants — PASS.** `beta.types.ts` requires the `// why:` comment "feedback tied to build version for traceability; replay reference enables reproduction" per EC-037 line 65. See §Required `// why:` Comments below.
- **#20 Ambiguous Authority Chain — PASS.** §Authority Chain below lists the read order (CLAUDE.md > rules > ARCHITECTURE > DECISIONS > EC > WP > this prompt).
- **#26 Implicit Content Semantics — PASS.** Each feedback category and cohort locks a prose definition verbatim from WP-037 / EC-037. Exit-criteria categories lock measurable thresholds (binary pass/fail, bug counts, win-rate ranges).

**Category 10 — Error Handling & Failure Semantics**
- **#18 Outcome Evaluation Timing Ambiguity — PASS.** Beta exit criteria evaluate at beta-end (binary pass/fail per category, all must pass for exit). Beta feedback collection is continuous during beta (per cohort, per session). Runtime engine behavior is unchanged — no new timing concerns.
- **#22 Silent vs Loud Failure — PASS.** Unversioned feedback is discarded loudly (EC-037 §Guardrails: "Feedback tied to build version — unversioned feedback is discarded"). Beta exit criteria are binary pass/fail (loud). Replay reference is optional (soft — matches D-1234 graceful-degradation).

**Category 11 — Single Responsibility & Logic Clarity**
- **#25 Overloaded Function Responsibilities — PASS.** No functions in scope. Each of the two docs has a single responsibility (BETA_STRATEGY: cohorts + access + feedback model + phases; BETA_EXIT_CRITERIA: binary pass/fail criteria per category).

**Overall Judgment:** **PASS** — 30 issues scanned, 30 PASS (with one FIX folded into Verification Steps for #11). Pre-flight READY TO EXECUTE verdict stands. Session prompt generation is authorized.

**Disposition:** **CONFIRM** (not HOLD, not SUSPEND). No remediation blocks execution.

---

## Vision Sanity Check (01.4 §Vision Sanity Check)

Per [docs/ai/REFERENCE/01.4-pre-flight-invocation.md](../REFERENCE/01.4-pre-flight-invocation.md) §Vision Sanity Check and [docs/ai/REFERENCE/00.3-prompt-lint-checklist.md](../REFERENCE/00.3-prompt-lint-checklist.md) §17 (gate landed at `0689406`). Required for all WP classes. Clause numbers only — no paraphrases.

- **Vision clauses touched by this WP:** §3 (Player Trust & Fairness — beta runs the production engine bit-identically), §4 (Faithful Multiplayer Experience — beta validates multiplayer correctness including reconnection and late-joining), §5 (Longevity & Expandability — extension seams for cohorts and feedback categories are locked behind governance events), §13 (Execution Checklist-Driven Development), §14 (Explicit Decisions, No Silent Drift), §18 (Replayability & Spectation — `reproductionReplayId` reinforces replay as canonical reproducer; a dedicated passive-observer cohort validates spectator UX), §22 (Deterministic & Reproducible Evaluation), §24 (Replay-Verified Competitive Integrity — "all replay verifications pass" is a binary exit criterion), NG-1 (No Pay-to-Win), NG-3 (No Content Withheld for Competitive Advantage).
- **Conflict assertion:** `No conflict: this WP preserves all touched clauses.`
- **Non-Goal proximity (NG-1, NG-3):** The three beta cohorts (`'expert-tabletop'`, `'general-strategy'`, `'passive-observer'`) partition players **by expertise and role only — never by payer status, ownership, or future paid-tier intent.** The closed literal union is locked by EC-037 §Locked Values and WP-037 §Non-Negotiable Constraints; widening requires a new `DECISIONS.md` entry. Beta grants no mechanical edge — Out of Scope line "No monetization testing" (this prompt L532) holds. NG-1 and NG-3 are not crossed. NG-2, NG-4, NG-5, NG-6, and NG-7 are not triggered (no randomized purchases, no timers, no ads, no dark patterns, no apology-requiring monetization).
- **Determinism preservation (§22):** `packages/game-engine/src/beta/` is forbidden from `Math.random`, `Date.now`, `performance.now`, and `new Date()` (Non-Negotiable Constraints below) and from importing any engine gameplay subdirectory (engine-isolation grep in Verification Steps Step 10). Beta games therefore run the production engine bit-identically. Replay reproduction is preserved — `BetaFeedback.reproductionReplayId` references the WP-027 replay harness without perturbing it; beta feedback is metadata-not-state and never enters `G`. Replay-verified integrity (§24) is preserved end-to-end.
- **WP `## Vision Alignment` section status:** WP-037 now contains a `## Vision Alignment` block, added at `e5b0d67` (`SPEC: WP-037 add Vision Alignment block per §17 gate`). This session prompt's Vision Sanity Check affirms the block's contents hold at session start. A re-run pre-flight under current rules returns READY.

---

## Authority Chain (Read in Order Before Coding)

1. [.claude/CLAUDE.md](../../../.claude/CLAUDE.md) — EC-mode, lint gate, commit discipline
2. [.claude/rules/architecture.md](../../../.claude/rules/architecture.md) — Layer Boundary; engine code never imports `boardgame.io` in pure helpers, never imports registry, never imports server
3. [.claude/rules/code-style.md](../../../.claude/rules/code-style.md) — `.test.ts` extension (none added), ESM-only, `node:` prefix where needed (none expected), no abbreviations, full-sentence error messages (none expected — no runtime code)
4. [docs/01-VISION.md](../../01-VISION.md) — Primary Goals (#1-5), Secondary Goals (#6-19), Scoring & Skill Measurement (#20-26), Non-Goals (NG-1..7), Financial Sustainability. Authoritative for intent, fairness, identity, monetization, and longevity. ARCHITECTURE.md wins over 01-VISION.md only on layer-boundary questions. Per `00.3 §17` and `01.4 §Authority Chain` (gate landed at `0689406`).
5. [docs/ai/ARCHITECTURE.md](../ARCHITECTURE.md) §Section 3 — The Three Data Classes (beta feedback is transport metadata; `G` is Class 1 runtime and is never deployed; beta release artifacts are Class 2 Configuration — same as production)
6. [docs/ai/ARCHITECTURE.md](../ARCHITECTURE.md) §Layer Boundary (Authoritative) — server layer owns feedback collection wiring; engine is never aware of beta users
7. [docs/ai/ARCHITECTURE.md](../ARCHITECTURE.md) §MVP Gameplay Invariants — beta games run the same deterministic engine; "Moves & Determinism" applies verbatim
8. [docs/ai/REFERENCE/02-CODE-CATEGORIES.md](../REFERENCE/02-CODE-CATEGORIES.md) §`engine` — new `src/beta/` subdirectory must be in the engine list (D-3701, landed at `a4f5574`)
9. [docs/ai/execution-checklists/EC-037-beta-strategy.checklist.md](../execution-checklists/EC-037-beta-strategy.checklist.md) — primary execution authority (Locked Values + Guardrails + Required `// why:` Comments + Files to Produce)
10. [docs/ai/work-packets/WP-037-public-beta-strategy.md](../work-packets/WP-037-public-beta-strategy.md) — authoritative WP specification (now carries the `## Vision Alignment` block, added at `e5b0d67`)
11. [docs/ai/DECISIONS.md](../DECISIONS.md) — **D-0702** (Balance Changes Require Simulation — beta feedback informs balance; simulation validates), **D-0902** (Rollback Is Always Possible — applies to beta deployments), **D-1232** (JSON-serializable contracts), **D-3501** (immediate precedent for D-3701 — ops types as metadata-not-state), **D-3601** (simulation types — AI feedback pipeline complement), plus new **D-3701** (beta subdirectory classification) landed at `a4f5574`
12. [docs/ops/RELEASE_CHECKLIST.md](../../ops/RELEASE_CHECKLIST.md) — beta uses the same release gates as production (WP-035). No beta-specific shortcuts.
13. [packages/game-engine/src/index.ts](../../../packages/game-engine/src/index.ts) — the export surface WP-037 appends to (after the WP-036 simulation block)
14. [packages/game-engine/src/ops/ops.types.ts](../../../packages/game-engine/src/ops/ops.types.ts) — WP-035 reference for engine-category pure-type files (WP-037's `beta.types.ts` mirrors the module-header discipline and re-export pattern)
15. [packages/game-engine/src/simulation/ai.types.ts](../../../packages/game-engine/src/simulation/ai.types.ts) — WP-036 reference for engine-category pure-type files with narrow unions

If any of these conflict, higher-authority documents win.

---

## Goal (Binary)

After this session, Legendary Arena has a complete, auditable controlled-public-beta strategy plus the engine-side type surface for beta feedback metadata. Specifically:

1. **`docs/beta/BETA_STRATEGY.md` exists** as the beta strategy document. Contents: 4 primary objectives + 4 explicit non-goals; feature scope (included vs excluded) including full core loop, limited content set, replays + spectator enabled, and explicit exclusions (campaigns, save migration, experimental keywords); three user cohorts with signal targets; access control (invitation-only, hard user cap, unique build ID, opt-in diagnostics); structured feedback collection model tied to `BetaFeedback` shape; beta timeline (phases: closed alpha → invite beta → open beta); binary pass/fail exit criteria summary with pointer to `BETA_EXIT_CRITERIA.md`. Contents locked by WP-037 §Scope (A) below.
2. **`docs/beta/BETA_EXIT_CRITERIA.md` exists** with binary pass/fail criteria organized by category: Rules correctness (zero P0/P1 bugs in final 2 weeks; all replay verifications pass; no invariant violations detected); UX clarity (task completion rate above threshold for cohort 2; "confusion" feedback below threshold); Balance perception (human win rates within acceptable range of AI simulation predictions per D-0702); Stability (zero crashes in final week; rollback never triggered in final deployment). Each criterion is binary pass/fail with a measurable threshold. Exit requires ALL categories to pass. Contents locked by WP-037 §Scope (B).
3. **`packages/game-engine/src/beta/beta.types.ts` exists** as a new engine subdirectory classified under D-3701, exporting `BetaFeedback`, `BetaCohort`, `FeedbackCategory` with the locked shapes. All types are JSON-serializable plain objects / primitive unions. Module header carries the required `// why:` comment (see §Required `// why:` Comments below).
4. **`packages/game-engine/src/types.ts` re-exports** the three new beta types. No `LegendaryGameState` modification. No change to any other re-export block.
5. **`packages/game-engine/src/index.ts` exports** the three new beta types on the public API surface, appended after the WP-036 simulation block.
6. **Engine baseline unchanged: 444 tests / 110 suites / 0 fail.** Repo-wide 596 / 0 fail. WP-037 produces **zero new tests** (RS-2 lock) — beta types are pure data definitions with no runtime instance.
7. **D-3701 landed** (pre-flight Commit A0 at `a4f5574`) classifying `packages/game-engine/src/beta/` as engine code category. The tenth engine subdirectory precedent after D-2706 / D-2801 / D-3001 / D-3101 / D-3201 / D-3301 / D-3401 / D-3501 / D-3601.
8. **Beta objectives locked:** validate core loop, surface UX friction, detect edge-case bugs, measure difficulty perception vs AI metrics. Beta is a product experiment, not a marketing event (WP-037 §Session Context).
9. **Beta runs the same deterministic engine as production.** No "beta mode" anywhere. Same release gates (WP-035). Same rollback capabilities (D-0902).
10. **Engine does not know beta users exist.** The engine imports nothing from `docs/beta/`; beta feedback is pure metadata with no engine-side mutation surface; no runtime wiring between engine and feedback collection.

No registry changes. No server changes. No client changes. No new tests. No new npm dependencies.

---

## Locked Values (Do Not Re-Derive)

### Commit & governance prefixes
- **EC / commit prefix:** `EC-037:` on every code-changing commit; `SPEC:` on governance / doc-only commits; `WP-037:` is **forbidden** (commit-msg hook rejects per P6-36).
- **Commit topology (three commits, matching WP-035 / WP-036):**
  - **Commit A0 (`SPEC:`)** — pre-flight bundle: D-3701 in `DECISIONS.md` + `src/beta/` entry in `02-CODE-CATEGORIES.md` §engine. **Already landed at `a4f5574` (2026-04-22).** WP-037's `## Vision Alignment` block was subsequently added at `e5b0d67` (`SPEC: WP-037 add Vision Alignment block per §17 gate`). This session prompt itself is not yet committed; the user may choose to bundle it into a follow-up `SPEC:` commit or into Commit A.
  - **Commit A (`EC-037:`)** — code + 01.6 post-mortem: five files under §Files Expected to Change (2 new docs + 1 new type file + 2 modified re-exports) + `docs/ai/post-mortems/01.6-WP-037-public-beta-strategy.md`. **Commit body must include a `Vision: §3, §4, §5, §13, §14, §18, §22, §24, NG-1, NG-3` trailer per `docs/ai/REFERENCE/01.3-commit-hygiene-under-ec-mode.md §Vision Trailer` — WP-037 now carries a `## Vision Alignment` block, so the trailer is convention-required.**
  - **Commit B (`SPEC:`)** — governance close: `STATUS.md` + `WORK_INDEX.md` + `EC_INDEX.md` + `DECISIONS.md` (three new minor decisions per DoD: invitation-only signal quality, three-cohort signal targets, same release gates as production). **Commit body should repeat the same `Vision: §3, §4, §5, §13, §14, §18, §22, §24, NG-1, NG-3` trailer.**

### Type shapes (locked verbatim from EC-037 §Locked Values)

```ts
// beta.types.ts

export interface BetaFeedback {
  sessionId: string
  buildVersion: string
  category: 'rules' | 'ui' | 'balance' | 'performance' | 'confusion'
  description: string
  severity: 1 | 2 | 3
  reproductionReplayId?: string
}

export type BetaCohort = 'expert-tabletop' | 'general-strategy' | 'passive-observer'

export type FeedbackCategory = 'rules' | 'ui' | 'balance' | 'performance' | 'confusion'
```

- **Field order in `BetaFeedback` is locked:** `sessionId`, `buildVersion`, `category`, `description`, `severity`, `reproductionReplayId`. No alphabetization, no grouping, no renaming. Verbatim match to EC-037 §Locked Values.
- **`reproductionReplayId` is the ONLY optional field** (declared with `?:` syntax). All other six fields are required.
- **`severity: 1 | 2 | 3` is a closed numeric union** — not `number`. Three levels only. Widening to `1 | 2 | 3 | 4` is a governance event (new D-entry + doc update), not a silent code change.
- **`BetaCohort` union member order is locked:** `'expert-tabletop'`, `'general-strategy'`, `'passive-observer'` — matches the cohort ordering in WP-037 §Locked contract values (expert → general → passive signal sequence) and in `BETA_STRATEGY.md` cohort list.
- **`FeedbackCategory` union member order is locked:** `'rules'`, `'ui'`, `'balance'`, `'performance'`, `'confusion'` — matches the category ordering in WP-037 §Locked contract values and EC-037 §Locked Values.
- **`category` field in `BetaFeedback` uses the same five literal values as `FeedbackCategory`** — do NOT replace with `FeedbackCategory` in the interface definition; EC-037 §Locked Values copies the full union inline. This is a verbatim lock, not a DRY opportunity.
- **No abbreviations.** `sessionId` not `sessId`; `reproductionReplayId` not `reproReplayId`. Rule 4 of `00.6-code-style.md`.
- **All three types are JSON-serializable** — plain primitives + object literal + string/numeric unions. No `Map`, `Set`, `Date`, functions, class instances. D-1232 applies.

### Three beta cohorts (EC-037 §Locked Values + WP-037 §Locked contract values — verbatim)

1. **Expert tabletop players** — rules-aware, edge-case focused
2. **General strategy gamers** — UX, clarity, onboarding signal
3. **Passive observers** — spectator and replay usability

The cohort identifiers in the `BetaCohort` union (`'expert-tabletop'`, `'general-strategy'`, `'passive-observer'`) are the machine-readable names; the prose above is the signal-target description used in `BETA_STRATEGY.md`.

### Beta exit criteria categories (EC-037 §Locked Values — verbatim)

1. **Rules correctness**
2. **UX clarity**
3. **Balance perception**
4. **Stability**

All exit criteria are binary pass/fail. Exit decision requires ALL four categories to pass (no partial credit, no subjective override).

### Runtime ownership (RS-1 resolution)

**Metadata-only: no runtime instance in the engine.** WP-037 ships only the type definitions in `beta.types.ts`. **No runtime `BetaFeedback` instance is constructed anywhere in the engine.** Beta feedback collection (construction, transport, persistence) is a server/ops concern — explicitly Out of Scope per WP-037. The engine never reads or writes a `BetaFeedback` object. `LegendaryGameState` is NOT modified.

Rationale: matches WP-037 §Non-Negotiable ("Beta feedback types are metadata — never stored in G") and EC-037 §Guardrails verbatim. Mirrors D-3501 option (a) precedent for ops counters. A future WP that needs engine-side feedback buffering would require a separate D-entry and is explicitly out of scope here.

### Test-count lock (RS-2 resolution)

- **WP-037 produces zero new tests.** No `*.test.ts` file is added.
- **Engine count MUST remain 444 / 110 suites / 0 fail** after this WP lands.
- **Repo-wide count MUST remain 596 / 0 fail** after this WP lands.
- Any test file appearing under `packages/game-engine/src/beta/**/*.test.ts` is a scope violation — the engine baseline check will catch it.

### Engine-isolation grep (RS-3 resolution)

The git-diff audit covers all existing engine subdirectories plus `game.ts`, `buildInitialGameState.ts`, and setup-orchestrator-adjacent files. Ops precedent (WP-035 Step 11) and simulation precedent (WP-036 diff) are both covered. The full list: `moves/`, `rules/`, `setup/`, `turn/`, `state/`, `ui/`, `scoring/`, `endgame/`, `villainDeck/`, `board/`, `economy/`, `mastermind/`, `hero/`, `lobby/`, `persistence/`, `replay/`, `campaign/`, `invariants/`, `network/`, `content/`, `versioning/`, `ops/`, `simulation/`, plus `game.ts` and `matchSetup.*`. This covers the full engine surface except the new `src/beta/` directory and the two re-export files (`types.ts`, `index.ts`) which are inside the allowlist.

### `docs/beta/` directory (RS-4 resolution — also mirrors WP-035 RS-4)

- `docs/beta/` is a **new top-level docs subdirectory**, accepted without a new D-entry. Precedent: `docs/ops/` (WP-035), `docs/ai/`, `docs/screenshots/`, `docs/devlog/` all exist as top-level non-engine docs subdirectories without individual D-entries.
- **No `CLAUDE.md` in `docs/beta/` at MVP.** A future WP may add one later when beta-specific procedures accumulate.
- The two docs files are **rendered markdown** — not linted as engine code, not subject to paraphrase discipline (P6-43). `Math.random`, `boardgame.io`, etc. may appear in strategy rationale text without tripping the verification gates (which run against `packages/game-engine/src/beta/` only).

### D-3701 (pre-flight precondition — ALREADY LANDED)

Landed in Commit A0 SPEC pre-flight bundle at `a4f5574` (2026-04-22). Full entry in `DECISIONS.md` at line 6634:

- **Title:** `D-3701 — Beta Types Code Category`
- **Status:** Immutable
- **Content summary:** `packages/game-engine/src/beta/` is engine-category code. No `boardgame.io`, no registry, no server, no cross-subdirectory engine imports, no RNG, no wall-clock reads, no I/O. Mirrors the nine prior precedents (D-2706 / D-2801 / D-3001 / D-3101 / D-3201 / D-3301 / D-3401 / D-3501 / D-3601). No sub-rule carve-outs (unlike D-3401's `new Date().toISOString()` exception for `savedAt` metadata — `beta.types.ts` is pure types with no load-boundary wall-clock need). Sub-rule: no runtime `BetaFeedback` instance in the engine; construction, transport, and persistence live in `apps/server/` or future ops tooling.

---

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- Never `import` `boardgame.io` in any `src/beta/*.ts` file (verified via Grep with escaped dot: `from ['"]boardgame\.io`).
- Never `import` `@legendary-arena/registry` or anything under `apps/server/` or `apps/` from beta.
- Never `import` from `src/versioning/`, `src/replay/`, `src/campaign/`, `src/persistence/`, `src/content/`, `src/network/`, `src/invariants/`, `src/ui/`, `src/scoring/`, `src/moves/`, `src/rules/`, `src/setup/`, `src/turn/`, `src/state/`, `src/board/`, `src/economy/`, `src/mastermind/`, `src/hero/`, `src/lobby/`, `src/villainDeck/`, `src/endgame/`, `src/ops/`, `src/simulation/` inside `src/beta/`. Beta types are the leaf of the engine-export DAG; they depend on nothing engine-internal.
- Never use `Math.random()` — beta types are pure type definitions; no randomness possible (verified via Grep).
- Never use `Date.now()` or `performance.now()` — beta types have no load-boundary wall-clock need.
- Never use `new Date()` — same reason; no carve-out exists for beta.
- No I/O, no filesystem, no network, no env access in `src/beta/` (Verification grep for `node:fs`, `node:net`, `node:http`, `process.env`).
- ESM only; Node v22+. `node:` prefix on any Node built-in imports (none expected in production code).
- Test files use `.test.ts` extension — none expected in this WP (RS-2 lock).
- Full file contents for every new or modified file in the output. No diffs.
- Human-style code per [docs/ai/REFERENCE/00.6-code-style.md](../REFERENCE/00.6-code-style.md) — no abbreviations, JSDoc on every export, `// why:` on non-obvious code, no `import *`, no barrel re-exports, no default exports.
- **Forbidden dependencies (lint §7):** no `axios`, no `node-fetch`, no ORMs, no Jest / Vitest / Mocha (only `node:test`). **No new npm dependencies introduced by this packet.** `pnpm-lock.yaml` must NOT appear in the diff.

**Packet-specific (WP-037 §Non-Negotiable Constraints + EC-037 §Guardrails):**
- **This packet produces strategy documents and type definitions — not engine logic, not UI components.**
- **No "beta mode" in the engine** — beta games run the same deterministic engine as production.
- **No modifications to engine gameplay logic.**
- **Beta feedback types are metadata** — never stored in `G`. `BetaFeedback` must NOT appear as a field name anywhere inside `LegendaryGameState`.
- **Beta users see the same `UIState` as production users** — no special beta views beyond build ID display (which is a future UI WP concern, not WP-037).
- **Invitation-only access** — no anonymous sessions. Stated explicitly in `BETA_STRATEGY.md`.
- **Feedback is tied to build version** — unversioned feedback is discarded. `buildVersion: string` is a required field in `BetaFeedback`.
- **Beta exit criteria are binary pass/fail** — no subjective "feels ready". Each of the four categories must pass independently.
- **The beta uses the same release gates as production** (WP-035). No beta-specific shortcuts. Stated explicitly in `BETA_STRATEGY.md` §Access Control or §Release Process.
- **All rollback capabilities from WP-035 apply to beta deployments** (D-0902). Stated explicitly in `BETA_STRATEGY.md`.
- **No runtime code changes in this packet** — beta contracts and documentation only. No modification to `game.ts`, any move file, any phase hook, `buildInitialGameState`, or any existing test.

**Session protocol:**
- If the engine baseline diverges from 444 / 110 suites at session start, STOP — the WP-037 test-count lock depends on this.
- If any of D-0702 / D-0902 / D-1232 / D-3501 / D-3601 cannot be located in `DECISIONS.md` (em-dash form per P6-2), STOP — the WP's foundation is missing.
- If the SPEC pre-flight commit `a4f5574` did NOT land D-3701 + the `02-CODE-CATEGORIES.md` update, STOP — execution is blocked on the directory-classification precedent.
- If any contract, field name, or reference is unclear, STOP and ask before proceeding.

---

## Required `// why:` Comments

- **`beta.types.ts` module header** (at top, above the first export): per EC-037 line 65, verbatim: *"feedback tied to build version for traceability; replay reference enables reproduction."* This is the single mandatory `// why:` comment per EC-037. Expanded rationale (recommended but not required): *"`BetaFeedback` is metadata-not-state — it never enters `G`. Construction, transport, and persistence live in `apps/server/` or future ops tooling per D-3701 sub-rule. The engine never reads or writes a `BetaFeedback` instance at runtime."*
- **`beta.types.ts` above `BetaFeedback` interface** (recommended): *"All six required fields + one optional field. Field order is locked by EC-037 §Locked Values — do not alphabetize, group, or rename. D-1232 applies: plain-object shape, JSON-serializable, no `Map`/`Set`/`Date`/functions."*
- **`beta.types.ts` above `BetaCohort` union** (recommended): *"Three cohorts in signal-target order: expert-tabletop (rules-aware, edge-case focused), general-strategy (UX, clarity, onboarding), passive-observer (spectator and replay usability). Adding a fourth cohort requires a new D-entry and a coordinated documentation update."*
- **`beta.types.ts` above `FeedbackCategory` union** (recommended): *"Five categories matching the `BetaFeedback.category` field verbatim. Widening or reordering requires a new D-entry — this is a governance change, not a code change."*
- **`docs/beta/BETA_STRATEGY.md`** does NOT require `// why:` comments (markdown docs use prose rationale, not code comments). However, the doc MUST include explicit prose paragraphs for the three governance decisions WP-037 DoD requires: (a) why invitation-only (signal quality over volume); (b) why three cohorts (different signal targets); (c) why beta uses the same release gates as production (no shortcuts).
- **`docs/beta/BETA_EXIT_CRITERIA.md`** MUST include a "Why these criteria" or "Measurement methodology" section explaining the D-entry mapping for the Balance perception category: D-0702 (Balance Changes Require Simulation) — human win rates are compared against AI simulation predictions from WP-036's `runSimulation` output. The Stability category references D-0902 (Rollback Is Always Possible) implicitly via "rollback never triggered in final deployment" as a passing condition.

No `// why:` comment is required in `types.ts` or `index.ts` for the re-exports (they are additive wiring, not new semantics). Exactly mirrors the WP-035 and WP-036 re-export patterns.

---

## Files Expected to Change (Allowlist — P6-27 ENFORCED)

Any file beyond this list is a scope violation. STOP and escalate.

### New — beta documentation (under repo-root `docs/beta/`)

1. `docs/beta/BETA_STRATEGY.md` — **new**. Beta strategy document. Sections: (a) Objectives (4 primary + 4 non-goals); (b) Feature Scope (Included: full core loop, limited curated content set, replays enabled, spectator enabled; Excluded: campaigns, save migration, experimental keywords); (c) User Cohorts (the three locked cohorts with signal targets, verbatim from Locked Values); (d) Access Control (invitation-only with hard user cap, unique build ID, opt-in diagnostics); (e) Feedback Collection Model (references the `BetaFeedback` shape, tied to build version, optional replay reference); (f) Beta Timeline (phases: closed alpha → invite beta → open beta); (g) Exit Criteria Summary (pointer to `BETA_EXIT_CRITERIA.md`); (h) three prose rationale paragraphs for DoD decisions (invitation-only, three cohorts, same release gates).

2. `docs/beta/BETA_EXIT_CRITERIA.md` — **new**. Binary pass/fail criteria organized by category (verbatim from Locked Values): **Rules correctness** (zero P0/P1 bugs in final 2 weeks; all replay verifications pass; no invariant violations detected); **UX clarity** (task completion rate above threshold for cohort 2; "confusion" feedback below threshold); **Balance perception** (human win rates within acceptable range of AI simulation predictions per D-0702); **Stability** (zero crashes in final week; rollback never triggered in final deployment — D-0902; **multiplayer reconnection round-trips succeed in final week; late-joining semantics match spec; no desync incidents in final 2 weeks — per Vision §4**). Each criterion is binary pass/fail with measurable threshold. Exit requires ALL four categories to pass. Plus a "Why these criteria" or "Measurement methodology" section with D-0702, D-0902, and Vision §4 citations.

### New — engine code (classified under D-3701)

3. `packages/game-engine/src/beta/beta.types.ts` — **new**. Exports `BetaFeedback`, `BetaCohort`, `FeedbackCategory` per §Locked Values. Module header with the required `// why:` comment per §Required `// why:` Comments (and recommended inline comments above each type). JSDoc on every export. No runtime values — types only.

### Modified — engine wiring

4. `packages/game-engine/src/types.ts` — **modified**. Re-export `BetaFeedback`, `BetaCohort`, `FeedbackCategory` in a new block (append after the WP-036 simulation re-export block, under a `// Beta metadata (WP-037 / D-3701)` comment). **No `LegendaryGameState` modification.** **No modification to any pre-existing re-export.**
5. `packages/game-engine/src/index.ts` — **modified**. Public API surface: export the three new beta types from `./beta/beta.types.js` in a new block (append after the WP-036 simulation block, under a `// Beta metadata (WP-037 / D-3701)` comment). **No modification to any pre-existing export.**

### Modified — governance (Commit B; not Commit A)

- `docs/ai/STATUS.md` — **modified** per DoD. Prepend a WP-037 execution entry to §Current State: public beta strategy defined; cohorts, access control, feedback model, and exit criteria documented; D-3701 extends D-3601 precedent chain.
- `docs/ai/work-packets/WORK_INDEX.md` — **modified**. Flip WP-037 to `[x]` with today's date and a link to this prompt and the Commit A hash.
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified**. Flip EC-037 from Draft to Done with `Executed YYYY-MM-DD at commit <hash>`; refresh footer.
- `docs/ai/DECISIONS.md` — **modified** to add the three new minor decisions per WP-037 DoD (invitation-only signal quality; three-cohort signal targets; same release gates as production). These may be combined into a single `D-3702 — Beta Access and Cohort Rationale` entry or split into three adjacent D-entries; the WP-037 session executor picks the structure that best fits the body of each decision. `DECISIONS_INDEX.md` updates accordingly if that file is in use.

### Must remain UNTOUCHED

- `packages/game-engine/src/types.ts` `LegendaryGameState` shape and all pre-WP-037 re-exports (only the new Beta block is appended)
- `packages/game-engine/src/setup/buildInitialGameState.ts` (RS-1 — no runtime instance)
- `packages/game-engine/src/game.ts` (no move, no phase hook)
- All existing engine subdirectories (listed in Non-Negotiable Constraints above) — read-only
- `apps/`, `packages/registry/`, `packages/vue-sfc-loader/`, `packages/preplan/`
- `apps/arena-client/package.json`, `pnpm-lock.yaml` (no new deps)
- `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` (D-3701 entry already landed at `a4f5574`)
- `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`, `docs/ai/REFERENCE/01.3-commit-hygiene-under-ec-mode.md`, `docs/ai/REFERENCE/01.4-pre-flight-invocation.md` — inherited dirty-tree files, NOT in WP-037 scope
- `docs/ai/work-packets/WP-039-post-launch-metrics-live-ops.md` — inherited dirty-tree file, NOT in WP-037 scope
- All four retained stashes (`stash@{0}` through `stash@{3}`) — **NEVER pop**
- `docs/ops/RELEASE_CHECKLIST.md`, `docs/ops/DEPLOYMENT_FLOW.md`, `docs/ops/INCIDENT_RESPONSE.md` — WP-035 artifacts, read-only references

---

## Acceptance Criteria

### Layer Boundary (engine code only — `src/beta/`)
- [ ] No `boardgame.io` import in any `src/beta/*.ts` file (Grep returns no matches, pattern: `from ['"]boardgame\.io` — escaped dot per WP-031 / WP-033 P6-22 precedent).
- [ ] No `@legendary-arena/registry`, `apps/server`, or `apps/` import in `src/beta/` (Grep returns no matches).
- [ ] No import from any other `src/*/` subdirectory inside `src/beta/` (Grep returns no matches).
- [ ] No `Math.random`, `Date.now`, `performance.now`, or `new Date()` in `src/beta/` (Grep returns no matches).
- [ ] No `.reduce()` in `src/beta/` (Grep returns no matches; pattern: `\.reduce\(`).
- [ ] No I/O (Grep returns no matches for `node:fs`, `node:net`, `node:http`, `process.env`).
- [ ] No `require(` in `src/beta/` (Grep with `-SimpleMatch` per RS-7 returns no matches).

### Beta Types
- [ ] `BetaFeedback` defined with exactly seven fields in locked order: `sessionId` (string), `buildVersion` (string), `category` (five-member string union), `description` (string), `severity` (`1 | 2 | 3`), `reproductionReplayId` (optional string).
- [ ] `BetaCohort` is a closed union of exactly three values in locked order: `'expert-tabletop' | 'general-strategy' | 'passive-observer'`.
- [ ] `FeedbackCategory` is a closed union of exactly five values in locked order: `'rules' | 'ui' | 'balance' | 'performance' | 'confusion'`.
- [ ] All three types are JSON-serializable (plain primitives + object literal — no `Map`, `Set`, `Date`, functions, class instances).
- [ ] `types.ts` re-exports all three; `index.ts` exports all three.
- [ ] No runtime value exported from `beta.types.ts` — types only (RS-1 lock).
- [ ] `BetaFeedback` does NOT appear as a field name inside the `LegendaryGameState` interface definition (WP-037 Verification Step 3).

### Beta Strategy Doc
- [ ] `docs/beta/BETA_STRATEGY.md` exists with all eight sections listed in §Files Expected to Change.
- [ ] 4 primary objectives explicitly numbered.
- [ ] 4 explicit non-goals explicitly numbered.
- [ ] Three cohorts match the Locked Values verbatim (identifiers AND signal-target prose).
- [ ] Access control: invitation-only statement present; hard user cap statement present; unique build ID statement present; opt-in diagnostics statement present.
- [ ] Feedback collection references the `BetaFeedback` type by name.
- [ ] Three phases explicitly named: closed alpha → invite beta → open beta.
- [ ] Three prose rationale paragraphs present (invitation-only; three cohorts; same release gates).

### Beta Exit Criteria Doc
- [ ] `docs/beta/BETA_EXIT_CRITERIA.md` exists with all four categories (verbatim from Locked Values).
- [ ] Each criterion is binary pass/fail with a measurable threshold.
- [ ] "Exit requires ALL four categories to pass" statement is present and unambiguous.
- [ ] D-0702 cited in the Balance perception category.
- [ ] D-0902 referenced in the Stability category (implicit or explicit).
- [ ] "Why these criteria" or "Measurement methodology" section present.

### Build & Test Baselines
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0.
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0.
- [ ] Engine count **UNCHANGED at 444 / 110 / 0 fail** (RS-2 lock — WP-037 adds zero tests).
- [ ] `pnpm -r test` exits 0 with **596 passing, 0 failing** (unchanged).

### Scope Enforcement
- [ ] No files outside §Files Expected to Change were modified (`git diff --name-only`).
- [ ] All existing engine subdirectories clean per `git diff` (targeted grep in Verification Steps).
- [ ] `game.ts`, `buildInitialGameState.ts` clean per `git diff`.
- [ ] `apps/`, `packages/registry/`, `packages/vue-sfc-loader/`, `packages/preplan/` all clean.
- [ ] `pnpm-lock.yaml` absent from diff (no new dep).
- [ ] None of `stash@{0}` through `stash@{3}` popped. No inherited dirty-tree file staged. `.claude/worktrees/` untouched.

### Governance
- [ ] D-3701 present in `DECISIONS.md` (landed at `a4f5574`).
- [ ] `src/beta/ (D-3701)` entry present in `02-CODE-CATEGORIES.md` §engine (landed at `a4f5574`).
- [ ] `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md` updated per DoD (Commit B).
- [ ] Three new DoD decisions added to `DECISIONS.md` (Commit B) — invitation-only, three cohorts, same release gates.
- [ ] EC-037 flipped from Draft to Done with `Executed YYYY-MM-DD at commit <hash>` in `EC_INDEX.md` + footer refresh.

---

## Verification Steps (run in order)

```pwsh
# Step 1 — build
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — engine test count unchanged (RS-2 lock)
pnpm --filter @legendary-arena/game-engine test
# Expected: exits 0; 444 passing / 110 suites / 0 failing

# Step 3 — repo-wide regression
pnpm -r test
# Expected: 596 passing, 0 failing

# Step 4 — confirm beta docs exist
Test-Path "docs\beta\BETA_STRATEGY.md"
Test-Path "docs\beta\BETA_EXIT_CRITERIA.md"
# Expected: True, True

# Step 5 — confirm beta types exist and no forbidden imports (escaped-dot pattern per RS-3 + WP-031 P6-22)
Select-String -Path "packages\game-engine\src\beta" -Pattern "from ['""]boardgame\.io" -Recurse
Select-String -Path "packages\game-engine\src\beta" -Pattern "@legendary-arena/registry|apps/server|apps/" -Recurse
# Expected: no output for each

# Step 6 — confirm no non-determinism
Select-String -Path "packages\game-engine\src\beta" -Pattern "Math\.random|performance\.now|Date\.now|new Date\(" -Recurse
# Expected: no output

# Step 7 — confirm no cross-subdirectory engine imports from beta
Select-String -Path "packages\game-engine\src\beta" -Pattern "from '(\.\./)+(versioning|scoring|replay|campaign|persistence|content|network|invariants|ui|moves|rules|zones|setup|turn|state|board|economy|mastermind|hero|lobby|villainDeck|endgame|ops|simulation)/" -Recurse
# Expected: no output

# Step 8 — confirm no I/O
Select-String -Path "packages\game-engine\src\beta" -Pattern "node:fs|node:net|node:http|process\.env" -Recurse
# Expected: no output

# Step 9 — confirm no .reduce() and no require() (RS-7: use -SimpleMatch for require( to avoid regex-special-dot false-positives)
Select-String -Path "packages\game-engine\src\beta" -Pattern "\.reduce\(" -Recurse
Select-String -Path "packages\game-engine\src\beta" -SimpleMatch -Pattern "require(" -Recurse
# Expected: no output for each

# Step 10 — confirm no engine gameplay files modified (RS-3 expanded from WP-036's 10-dir set)
git diff --name-only packages/game-engine/src/game.ts packages/game-engine/src/moves/ packages/game-engine/src/rules/ packages/game-engine/src/setup/ packages/game-engine/src/turn/ packages/game-engine/src/state/ packages/game-engine/src/ui/ packages/game-engine/src/scoring/ packages/game-engine/src/endgame/ packages/game-engine/src/villainDeck/ packages/game-engine/src/board/ packages/game-engine/src/economy/ packages/game-engine/src/mastermind/ packages/game-engine/src/hero/ packages/game-engine/src/lobby/ packages/game-engine/src/persistence/ packages/game-engine/src/replay/ packages/game-engine/src/campaign/ packages/game-engine/src/invariants/ packages/game-engine/src/network/ packages/game-engine/src/content/ packages/game-engine/src/versioning/ packages/game-engine/src/ops/ packages/game-engine/src/simulation/
# Expected: no output

# Step 11 — confirm matchSetup files untouched
git diff --name-only packages/game-engine/src/matchSetup.types.ts packages/game-engine/src/matchSetup.validate.ts packages/game-engine/src/matchSetup.contracts.test.ts
# Expected: no output

# Step 12 — confirm BetaFeedback is not a field inside LegendaryGameState
Select-String -Path "packages\game-engine\src\types.ts" -Pattern "BetaFeedback"
# Expected: only re-export lines (e.g., `export { BetaFeedback }` or `export type { BetaFeedback }`), never inside
# the LegendaryGameState interface definition. If BetaFeedback appears as a field name inside
# LegendaryGameState, this step FAILS.

# Step 13 — confirm only expected files changed in Commit A
git diff --name-only
# Expected: only the 5 files in §Files Expected to Change (2 new docs + 1 new type file + types.ts + index.ts) plus the 01.6 post-mortem

# Step 14 — confirm pnpm-lock absent (no new deps)
git diff --name-only | Select-String "^pnpm-lock\.yaml$"
# Expected: no output

# Step 15 — confirm D-3701 landed (Commit A0 precondition at a4f5574)
Select-String -Path "docs\ai\DECISIONS.md" -Pattern "### D-3701"
Select-String -Path "docs\ai\REFERENCE\02-CODE-CATEGORIES.md" -Pattern "src/beta/"
# Expected: at least one match each

# Step 16 — confirm no test file leaked into src/beta/
Get-ChildItem -Path "packages\game-engine\src\beta" -Filter "*.test.ts" -Recurse
# Expected: no output (RS-2 lock: WP-037 produces zero tests)

# Step 17 — confirm inherited quarantine intact
git stash list
# Expected: all four stashes (stash@{0} through stash@{3}) still present

# Step 18 — confirm inherited dirty-tree files untouched (not staged, not modified beyond session start)
git diff --name-only --cached | Select-String "00\.3-prompt-lint|01\.3-commit-hygiene|01\.4-pre-flight|WP-039"
# Expected: no output (these files must NOT appear in the staged diff)
```

---

## Post-Mortem — MANDATORY (P6-35)

Per [docs/ai/REFERENCE/01.6-post-mortem-checklist.md](../REFERENCE/01.6-post-mortem-checklist.md). Two triggering criteria apply:

1. **New long-lived abstraction:** `BetaFeedback`, `BetaCohort`, and `FeedbackCategory` are the canonical beta-metadata surface going forward. The three shapes + the two beta docs will be referenced by WP-038 (launch readiness), WP-039 (post-launch metrics / live ops), future feedback-collection WPs, and every subsequent beta cycle. Lock the shapes + prose at MVP.
2. **New code-category directory:** `packages/game-engine/src/beta/` is the 10th engine subdirectory needing classification (D-3701). Same pattern as D-2706 / D-2801 / D-3001 / D-3101 / D-3201 / D-3301 / D-3401 / D-3501 / D-3601.

Run the formal 10-section 01.6 output, save at `docs/ai/post-mortems/01.6-WP-037-public-beta-strategy.md`, and stage into Commit A. Required section coverage: (1) Summary; (2) What changed; (3) New contracts / abstractions; (4) Scope-lock adherence; (5) Pre-flight RS-# dispositions; (6) Post-mortem findings (aliasing, hidden-coupling, `// why:` gaps); (7) Pattern precedents extended; (8) Reality-reconciliation findings; (9) Lessons learned (feeding 01.4 template); (10) Fixes applied during post-mortem.

---

## Definition of Done

- [ ] Pre-Session Gates #1–#5 all resolved.
- [ ] 01.5 NOT INVOKED block (above) re-read — confirm no 01.5 criterion has flipped.
- [ ] Copilot Check (§01.7 section above) verdict CONFIRM re-read and honored during execution.
- [ ] All Acceptance Criteria above pass.
- [ ] All Verification Steps return expected output.
- [ ] No `boardgame.io`, registry, server, or cross-subdirectory engine import in any new file.
- [ ] No wall-clock / `Math.random` / `Date.now` / `performance.now` / `new Date()` in `src/beta/`.
- [ ] No `.reduce()`. No I/O. No `require()`.
- [ ] Engine count **unchanged at 444 / 110 / 0 fail**; repo-wide **596 / 0 fail**.
- [ ] Required `// why:` comment present at `beta.types.ts` module header (EC-037 line 65 verbatim).
- [ ] Beta strategy doc contains all eight sections and three DoD rationale paragraphs.
- [ ] Beta exit criteria doc contains all four categories with binary thresholds and D-0702 / D-0902 citations.
- [ ] `BetaFeedback` not a field of `LegendaryGameState` (Verification Step 12).
- [ ] `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md` updated in Commit B.
- [ ] Three new minor decisions added to `DECISIONS.md` (Commit B).
- [ ] EC-037 Draft → Done with commit hash + footer refresh.
- [ ] Commit A0 uses `SPEC:` prefix (pre-flight bundle, landed at `a4f5574`); Commit A uses `EC-037:` prefix; Commit B uses `SPEC:` prefix.
- [ ] **01.6 post-mortem complete (MANDATORY per P6-35)** — formal 10-section output at `docs/ai/post-mortems/01.6-WP-037-public-beta-strategy.md`, in-session, staged into Commit A.
- [ ] All four inherited stashes intact; no inherited dirty-tree files staged; `.claude/worktrees/` untouched.

---

## Out of Scope (Explicit)

- **No beta infrastructure** (servers, access control implementation, invitation issuer, opt-in diagnostics backend) — this packet defines strategy, not infrastructure.
- **No feedback collection backend** — `BetaFeedback` is a type; collection is a server/ops concern.
- **No "beta mode" in the engine** — beta games run the same deterministic engine.
- **No content selection logic** — curated content set is chosen by hand.
- **No matchmaking** — beta uses manual match creation.
- **No monetization testing.**
- **No scaling or load testing.**
- **No engine gameplay changes** — beta types are metadata, not gameplay. No move, phase hook, rule, or setup change.
- **No UI components** — beta users see the same `UIState` as production users; build ID display (if any) is a future UI WP concern.
- **No server changes.**
- **No persistence / database access.**
- **No new tests** (RS-2 lock).
- **No runtime `BetaFeedback` instance anywhere in the engine** (RS-1 lock).
- **No new npm dependencies.**
- **No modification to any pre-existing engine subdirectory, any pre-existing re-export, any pre-existing test, or any governance document beyond the five files in §Files Expected to Change (Commit A) plus the four files in the governance list (Commit B).**
- **No pop of any retained stash** (`stash@{0}` through `stash@{3}`).
- **No touch of any inherited dirty-tree file** (`00.3-prompt-lint-checklist.md`, `01.3-commit-hygiene-under-ec-mode.md`, `01.4-pre-flight-invocation.md`, `WP-039-post-launch-metrics-live-ops.md`) — these belong to separate sessions.
- Refactors, cleanups, or "while I'm here" improvements are out of scope unless explicitly listed in §Files Expected to Change above.

---

## Final Instruction

Execute exactly this scope. No synthesis, no scope expansion, no "helpful" additions. If any required modification cannot be classified as within the WP-037 allowlist, STOP and escalate rather than force-fitting. **P6-27 is active.** The 01.7 Copilot Check verdict CONFIRM above presumes the Locked Values and Non-Negotiable Constraints are honored literally — any deviation during execution re-opens the scan.

When finished: run all verification steps, capture output, run the mandatory 01.6 post-mortem, then commit per the established three-commit pattern (Commit A0: `SPEC:` pre-flight bundle — already landed at `a4f5574`; Commit A: `EC-037:` code + post-mortem; Commit B: `SPEC:` governance close + three minor DoD decisions).
