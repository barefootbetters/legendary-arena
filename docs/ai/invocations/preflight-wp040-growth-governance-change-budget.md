# Pre-Flight — WP-040 Growth Governance & Change Budget

**Target Work Packet:** `WP-040`
**Title:** Growth Governance & Change Budget
**Previous WP Status:** WP-039 Complete (2026-04-23, commit `ee5e1d5`)
**Pre-Flight Date:** 2026-04-23
**Invocation Stage:** Pre-Execution (Scope & Readiness)
**Repo-state anchor:** `main @ c861b24` (SPEC: tighten WP-040 + EC-040 + session-context — growth-governance pre-pre-flight refinements, 2026-04-23)

**Work Packet Class:** Contract-Only / Documentation + Types (no runtime logic, no `G` mutation, no `game.ts` wiring, no moves, no phases)

Rationale: WP-040 §Files Expected to Change locks a four-file set (one new `docs/governance/CHANGE_GOVERNANCE.md`, one new `packages/game-engine/src/governance/governance.types.ts`, two additive re-export edits in `types.ts` + `index.ts`). Zero new tests (per EC-040 test-count intent), zero move code, zero phase hooks, zero `G` mutation, zero runtime logic. Matches the WP-034 / WP-035 / WP-037 / WP-038 / WP-039 Docs-plus-Types Phase 7 precedent chain.

Mandatory sections per class: Dependency & Sequencing Check, Input Data Traceability, Structural Readiness, Scope Lock, Test Expectations, Risk Review. Skipped: Runtime Readiness (no runtime), Mutation Boundary (no mutation). Included: Dependency Contract Verification (load-bearing — D-3901 reuse discipline + P6-53 authority-surface enumeration), Code Category Boundary Check (PS-1 blocker — new `src/governance/` subdirectory).

---

## Pre-Flight Intent

Perform a pre-flight validation for WP-040.

- Not implementing.
- Not generating code.
- Validating readiness and constraints only.

Verdict is binary (READY TO EXECUTE / DO NOT EXECUTE YET).

---

## §9 Reality-Check Gates (from `session-context-wp040.md` §9)

All nine gates were executed before authoring began. Results:

| Gate | Command | Expected | Actual | Verdict |
|---|---|---|---|---|
| 1 | `git log --oneline -5 \| grep "ee5e1d5.*WP-039.*governance"` | one match | `ee5e1d5 SPEC: close WP-039 / EC-039 — live-ops framework governance` | PASS |
| 2 | `grep -nE "^### D-3901" docs/ai/DECISIONS.md` | one match | `8361:### D-3901 — Live Ops Reuses …` | PASS |
| 3 | `test -f docs/ops/LIVE_OPS_FRAMEWORK.md && grep -cE "^## " …` | True, 11 | exists, 11 | PASS |
| 4 | `grep -nE "^\| Done +\| 12" docs/ai/execution-checklists/EC_INDEX.md` | one match | `160:\| Done     \| 12    \|` | PASS |
| 5 | `pnpm --filter @legendary-arena/game-engine test` | 444 / 110 / 0 | tests 444, suites 110, pass 444, fail 0 | PASS |
| 6 | `pnpm -r test` | 596 / 0 | registry 13 + vue-sfc-loader 11 + game-engine 444 + server 6 + replay-producer 4 + preplan 52 + arena-client 66 = 596 / 0 fail | PASS |
| 7 | `git diff --name-only ee5e1d5..HEAD packages/ apps/` | empty | empty | PASS |
| 8 | `git status --short` | single `?? .claude/worktrees/` | drift — see note | PASS-with-note |
| 9 | `grep -nE "^\*\*P6-52:\|^\*\*P6-53:" docs/ai/REFERENCE/01.4-pre-flight-invocation.md` | two matches | `5292` + `5386` | PASS |

**Gate 8 note:** The working tree contains four unstaged modifications beyond `.claude/worktrees/`: `docs/00-INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/05-ROADMAP.md`, and `docs/ai/REFERENCE/01.4-pre-flight-invocation.md` (+194 lines appending P6-52 and P6-53 precedents). The 01.4 additions are the precedents the session-context bridge anchors to — they are physically present in the file (Gate 9 PASS) but not yet committed. None of the drift touches `packages/` or `apps/` (Gate 7 PASS), and the drift does not block WP-040 pre-flight authoring. Flag for post-execution cleanup — recommend committing the four doc mods as a SPEC-prefix governance-housekeeping commit before or alongside WP-040's Commit A0 pre-flight bundle.

All nine gates return expected output (with Gate 8 drift documented). Pre-flight authoring proceeds.

---

## Authority Chain (Read in Order)

1. `.claude/CLAUDE.md` — EC-mode, lint gate, commit discipline — read.
2. `docs/ai/ARCHITECTURE.md` — §Layer Boundary (Authoritative), §MVP Gameplay Invariants — read.
3. `docs/01-VISION.md` — §5 (Longevity & Expandability), §13 (Execution Checklist–Driven Development), §14 (Explicit Decisions, No Silent Drift), §22 (Deterministic & Reproducible Evaluation), §24 (Replay-Verified Competitive Integrity), Financial Sustainability — read. Clause titles verified.
4. `docs/03.1-DATA-SOURCES.md` — reviewed. WP-040 introduces no new input datasets.
5. `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` — **`packages/game-engine/src/governance/` is NOT yet classified** ([02-CODE-CATEGORIES.md:95-102](docs/ai/REFERENCE/02-CODE-CATEGORIES.md:95) lists `replay`, `ui`, `campaign`, `invariants`, `versioning`, `ops`). This is a pre-session blocker — see PS-1.
6. `docs/ai/execution-checklists/EC-040-growth-governance.checklist.md` — read (post c861b24 tightening).
7. `docs/ai/work-packets/WP-040-growth-governance-change-budget.md` — read (post c861b24 tightening).
8. **`docs/ai/session-context/session-context-wp040.md` — read. LOAD-BEARING. Bridge from WP-039 execution; §3 AUTHORITATIVE-surface enumeration, §4 D-3901 reuse discipline, §5 drafting-drift items, §6 new P6-52/P6-53 precedents, §7 expected three-commit topology, §9 reality-check gates.**
9. **`docs/ops/LIVE_OPS_FRAMEWORK.md` — read. AUTHORITATIVE for change-management allowed/forbidden matrix (§8). WP-040's five change categories must cross-link, not re-derive.**
10. **`packages/game-engine/src/ops/ops.types.ts` — read. AUTHORITATIVE for `IncidentSeverity`, `OpsCounters`, `DeploymentEnvironment`. No parallel severity/counter type admissible (D-3901).**
11. `docs/ops/INCIDENT_RESPONSE.md` — AUTHORITATIVE for P0/P1/P2/P3 semantics. Read.
12. `docs/ops/RELEASE_CHECKLIST.md` — AUTHORITATIVE for seven release gates. Read.
13. `docs/ops/DEPLOYMENT_FLOW.md` — AUTHORITATIVE for four-environment promotion + rollback. Read.
14. `packages/game-engine/src/versioning/*.ts` — AUTHORITATIVE for `EngineVersion`, `DataVersion`, `ContentVersion`, `VersionedArtifact<T>`, `checkCompatibility`, `migrateArtifact`, `stampArtifact`. WP-040's major-version-bump language must cite landed axes; no parallel version-axis union. Read.
15. `docs/ai/DECISIONS.md` — D-1001, D-1002, D-1003, D-0702, D-0801, D-3901 verified present (em-dash encoding at DECISIONS.md:346, 354, 362, 285, 310, 8361 respectively). Read.
16. `docs/ai/REFERENCE/01.4-pre-flight-invocation.md` — §Dependency Contract Verification, §Code Category Boundary Check, §P6-50 (proactive paraphrase loading), §P6-51 (DECISIONS.md placement lock), §P6-52 (meta-prose paraphrase discipline), §P6-53 (AUTHORITATIVE surface enumeration). Read.

Higher-authority documents win where they conflict with lower. **Four contract-verification blockers found — see Dependency Contract Verification section. No severity/counter-type collision (D-3901 reuse verification: all four proposed types are genuinely novel).**

---

## Vision Sanity Check (01.4 §Vision Sanity Check)

- **Vision clauses touched by this WP:** §5 (Longevity & Expandability), §13 (Execution Checklist–Driven Development), §14 (Explicit Decisions, No Silent Drift), §22 (Deterministic & Reproducible Evaluation), §24 (Replay-Verified Competitive Integrity), Financial Sustainability ("no margin, no mission" covenant).
- **Conflict assertion:** `No conflict: this WP preserves all touched clauses.` The five change categories (ENGINE | RULES | CONTENT | UI | OPS) and the five-surface immutable list (replay, RNG, scoring, invariants, endgame) directly enforce §22 and §24 — major-version gates on determinism-bearing surfaces prevent silent drift (§14). Per-release change budgets enforce sustainability (§5 Financial Sustainability).
- **Non-Goal proximity:** `N/A — WP touches no monetization or competitive surface directly, but structurally reinforces NG-1 (No Pay-to-Win) and NG-3 (No Content-Withholding) by requiring that no paid surface can request an ENGINE change without major-version governance.` WP-040 §Vision Alignment line 220-223 makes this claim explicit and pre-flight confirms it.
- **Determinism preservation:** `Confirmed.` WP-040 defines replay, RNG, scoring, invariants, and endgame as explicitly immutable surfaces requiring major-version bump + migration path + DECISIONS.md entry. No determinism-bearing path can drift via a content or UI release.
- **WP `## Vision Alignment` section status:** Present in WP-040 at §Vision Alignment (line 204-232). Clause citations match VISION.md. `## Vision Alignment` block requirement from `00.3 §17.1` is satisfied.

**Vision Sanity Check: PASS.**

---

## Dependency & Sequencing Check

| WP | Status | Evidence |
|---|---|---|
| WP-031 Engine Invariants | PASS | `packages/game-engine/src/invariants/` present; D-3101 classifies as engine ([02-CODE-CATEGORIES.md:98](docs/ai/REFERENCE/02-CODE-CATEGORIES.md:98)) |
| WP-034 Versioning | PASS | `packages/game-engine/src/versioning/` exports all three axes; D-3401 classifies as engine ([02-CODE-CATEGORIES.md:101](docs/ai/REFERENCE/02-CODE-CATEGORIES.md:101)) |
| WP-035 Release Process | PASS | `docs/ops/RELEASE_CHECKLIST.md`, `DEPLOYMENT_FLOW.md`, `INCIDENT_RESPONSE.md` present; D-3501 classifies `src/ops/` as engine ([02-CODE-CATEGORIES.md:102](docs/ai/REFERENCE/02-CODE-CATEGORIES.md:102)) |
| WP-036 AI Simulation | PASS (for RULES-category balance validation only) | `packages/game-engine/src/simulation/` present; WP-040 Assumes scopes this dependency to RULES changes only per c861b24 tightening |
| WP-039 Live Ops | PASS | `docs/ops/LIVE_OPS_FRAMEWORK.md` (11 top-level sections), D-3901 landed at DECISIONS.md:8361 |

All D-entries cited by WP-040 verified present in DECISIONS.md (em-dash encoding):

- D-0702 — Balance Changes Require Simulation (DECISIONS.md:285)
- D-0801 — Explicit Version Axes (DECISIONS.md:310)
- D-1001 — Growth Requires Explicit Change Budgets (DECISIONS.md:346)
- D-1002 — Immutable Surfaces Are Protected (DECISIONS.md:354)
- D-1003 — Content and UI Are Primary Growth Vectors (DECISIONS.md:362)
- D-3901 — Live Ops Reuses Existing `IncidentSeverity` and `OpsCounters` (DECISIONS.md:8361)

No sequencing blockers.

---

## Dependency Contract Verification

**CRITICAL SECTION — four blocking findings plus three pre-session actions.**

### D-3901 Reuse Verification (per session-context §4)

Pre-flight executed the grep trace required by the WP-039 D-3901 discipline:

| Proposed type | Grep | Result | Admissibility |
|---|---|---|---|
| `ChangeCategory = 'ENGINE' \| 'RULES' \| 'CONTENT' \| 'UI' \| 'OPS'` | `rg "ChangeCategory" packages/game-engine/src/` | No files found | **Admissible — genuinely novel.** Semantically distinct from `IncidentSeverity` (severity vs. classification) and `OpsCounters` (counter vs. category). Overlaps with the `ARCHITECTURE.md` §Layer Boundary partition; WP-040 §Scope (In) already plans to cross-link each category to its architectural layer in the produced doc. |
| `ChangeBudget { release, engine, rules, content, ui, ops }` | `rg "Budget" packages/game-engine/src/` | No files found | **Admissible — genuinely novel.** Semantically distinct from `OpsCounters` (cumulative observability counters vs. per-release allowances). No collision. |
| `ChangeClassification { id, category, description, versionImpact, immutableSurface? }` | `rg "ChangeClassification" packages/game-engine/src/` | No files found | **Admissible — genuinely novel.** Not severity-adjacent; `versionImpact: 'major' \| 'minor' \| 'patch' \| 'none'` is a version-axis tag aligned with D-0801, not a severity tier. |
| `immutableSurface?: 'replay' \| 'rng' \| 'scoring' \| 'invariants' \| 'endgame'` | `rg "ImmutableSurface\|immutableSurface" packages/game-engine/src/` | No files found | **Admissible — genuinely novel.** Not severity-adjacent — kind-of-change tag paraphrasing the immutable-surfaces list. Cross-links in the produced doc to `ARCHITECTURE.md §MVP Gameplay Invariants` for replay/invariants. |

**D-3901 reuse verification: PASS (4/4 genuinely novel).** Record in EC-040 §Locked Values under a "D-3901 reuse verification" subsection per session-context §4 binding requirement.

### Finding 1 (BLOCKER — §5.1 Path A) — "four metric categories" drift

WP-040:11 reads:
> *"WP-039 established live ops with four metric categories and cadence."*

**As-landed reality:** WP-039 shipped under Path A with **four organizational-prose labels** (System Health / Gameplay Stability / Balance Signals / UX Friction), not four typed categories. [LIVE_OPS_FRAMEWORK.md §5](docs/ops/LIVE_OPS_FRAMEWORK.md) states explicitly: *"They are NOT a typed union, NOT a parallel severity, NOT a code constant, and NOT enforced by any build step."*

The "four metric categories" phrasing sets up WP-040's reader to assume a typed-category precedent exists for `ChangeCategory`. No such precedent exists. WP-040 is introducing its **first** typed-category union in the `growth-governance` subsystem, which is a different kind of scope than paralleling §5's prose labels.

**Path A fix:** Rewrite WP-040:11 to:

> *"WP-039 established live ops with four organizational-prose metric labels (System Health / Gameplay Stability / Balance Signals / UX Friction) and a daily / weekly / monthly review cadence."*

This satisfies the "no parallel typed severity/category" discipline by making the distinction explicit in the WP text.

### Finding 2 (BLOCKER — §5.2 Path A) — D-3901 missing from Session Context + Context (Read First)

WP-040 §Session Context (lines 9-19) and §Assumes (lines 45-58) cite D-1001 / D-1002 / D-1003 as the governance authority triad. **D-3901 is not named anywhere in WP-040.** Pre-flight confirmed via grep: `grep -nE "D-3901" WP-040-…md` returns zero matches.

D-3901 landed at commit `ee5e1d5` (2026-04-23, same-day) and binds all future ops-adjacent WPs to a reuse-not-parallel discipline. The D-3901 binding extends explicitly to WP-040's type-definition scope per D-3901's "Scope of the authorization" clause:

> *"Applies to all ops observability work downstream of WP-039 … Does not authorize the introduction of any parallel severity or counter type anywhere in the repo."*

WP-040's four proposed types are genuinely novel (D-3901 reuse verification above), but the WP text does not cite D-3901 as a binding decision, making future readers unable to trace the reuse-verification discipline.

**Path A fix:**
1. Extend WP-040 §Session Context to name D-1001, D-1002, D-1003 **and inherits D-3901**.
2. Extend WP-040 §Context (Read First) to list D-3901 with a one-line description ("reuse discipline for ops observability — binding on WP-040's type definitions per §Scope of the authorization").

### Finding 3 (BLOCKER — §5.3 + P6-53 Path A) — Context (Read First) missing authority surfaces

WP-040 §Context (Read First) (lines 61-82) cites:
- `ARCHITECTURE.md` §MVP Gameplay Invariants, §Layer Boundary
- `DECISIONS.md` D-1001 / D-1002 / D-1003 / D-0801
- `00.6-code-style.md` Rule 4 + Rule 13

**It does not cite** the landed operational authority surfaces WP-040 touches, all of which are enumerated in session-context §3 with 12 AUTHORITATIVE markers:

| Surface | Role for WP-040 | In WP-040 §Context? |
|---|---|---|
| `docs/ops/LIVE_OPS_FRAMEWORK.md` §8 Change Management | Allowed/forbidden matrix WP-040 categories inherit | **MISSING** |
| `packages/game-engine/src/ops/ops.types.ts` | `IncidentSeverity`, `OpsCounters`, `DeploymentEnvironment` — no parallel types | **MISSING** |
| `docs/ops/INCIDENT_RESPONSE.md` | P0/P1/P2/P3 severity semantics | **MISSING** |
| `docs/ops/RELEASE_CHECKLIST.md` | Seven release gates — WP-040's OPS category consumes | **MISSING** |
| `docs/ops/DEPLOYMENT_FLOW.md` | Four-environment promotion + rollback — WP-040's OPS category cross-links | **MISSING** |
| `packages/game-engine/src/versioning/` | Three version axes + `VersionedArtifact<T>` — WP-040's major-version language cites | **MISSING** |
| `DECISIONS.md` D-0702 | Balance Changes Require Simulation — WP-040's RULES category inherits | **MISSING** |
| `DECISIONS.md` D-3901 | Reuse-not-parallel discipline — WP-040's type scope inherits | **MISSING** |

Per **P6-53** (session-context §6, [01.4:5386](docs/ai/REFERENCE/01.4-pre-flight-invocation.md:5386)):

> *"any WP whose scope touches an operational surface that already exists in the repo — a landed type, a landed document, a landed DECISIONS.md entry, a landed script, or a landed ops playbook — MUST enumerate each of those surfaces in §Context (Read First) with a caps-tagged **AUTHORITATIVE** marker."*

A surface mentioned in WP-040 §Scope (In) or §Non-Negotiable Constraints but absent from §Context (Read First) with the caps-tagged marker is a **pre-flight blocker per P6-53**.

**Path A fix:** Extend WP-040 §Context (Read First) to include the eight missing surfaces above with caps-tagged AUTHORITATIVE markers. Format per session-context §3 template:

> `` - `<path>` — **AUTHORITATIVE for <what>.** <one-sentence description of what the surface owns and what WP-040 must not re-derive.>``

Minimum additions (eight bullets, one per surface). EC-040 §Before Starting should also add one checkbox per AUTHORITATIVE surface re-read per P6-53's pre-flight-reviewer checklist guidance.

### Finding 4 (BLOCKER — §7 post-mortem gap) — Post-mortem doc missing from WP-040 §Files Expected to Change

WP-040 §Files Expected to Change (lines 238-246) locks four files:
- `docs/governance/CHANGE_GOVERNANCE.md` (new)
- `packages/game-engine/src/governance/governance.types.ts` (new)
- `packages/game-engine/src/types.ts` (modified)
- `packages/game-engine/src/index.ts` (modified)

And line 246 states: *"No other files may be modified."*

WP-040 likely triggers **three** of the `01.6-post-mortem-checklist.md` mandatory conditions:

1. **New long-lived abstraction document** (`docs/governance/CHANGE_GOVERNANCE.md` — the canonical change-classification contract all future releases inherit).
2. **New code-category directory** (`packages/game-engine/src/governance/` — a new engine subdirectory requires classification via D-4001, which itself mandates a post-mortem entry per D-2706/D-2801/D-3001/D-3101/D-3401/D-3501 chain).
3. **New type contracts consumed by future WPs** (`ChangeCategory`, `ChangeBudget`, `ChangeClassification` — all re-exported from `types.ts` + `index.ts`, forming public engine API).

WP-039 precedent landed its 01.6 post-mortem in Commit A alongside the EC content commit (`4b1cf5c`). WP-040's current §Files Expected to Change does **not** include `docs/ai/post-mortems/01.6-WP-040-growth-governance-change-budget.md`.

Session-context §7 (lines 367-381) presents two resolutions:
- **(a)** Extend WP-040 §Files Expected to Change to include the 01.6 post-mortem (Path A rewrite at pre-flight time).
- **(b)** Land the post-mortem in Commit B alongside governance-close docs with DECISIONS.md deviation entry.

**Precedent favors (a)** — WP-039 landed its post-mortem in Commit A, and the WP-039 post-mortem was treated as part of the execution-session scope, not governance close.

**Path A fix:** Extend WP-040 §Files Expected to Change to include `docs/ai/post-mortems/01.6-WP-040-growth-governance-change-budget.md` as a fifth Commit A file. EC-040 §Files to Produce should also be updated to match (currently locks four files plus three governance-close files; needs to become five files plus three governance-close files).

---

## Input Data Traceability Check

- [x] All non-user-generated inputs consumed by this WP are listed in `docs/03.1-DATA-SOURCES.md` — WP-040 consumes no input datasets. Types are metadata-only; produced doc is free prose.
- [x] The storage location for each input is known — N/A (no inputs).
- [x] It is possible to determine which data source(s) would need to be inspected if this WP's behavior is incorrect — N/A (no runtime behavior).
- [x] The WP does not introduce "implicit data" — types are explicit closed unions; budget template is reader-facing prose.
- [x] Any setup-time derived fields introduced or modified by this WP are listed under **Setup-Time Derived Data (In-Memory)** — N/A (no `G` mutation, no setup-time resolution).

**Verdict: PASS.**

---

## Structural Readiness Check (Types & Contracts)

- [x] All prior WPs compile and tests pass — verified via Gate 5 (engine 444/110/0) and Gate 6 (repo 596/0).
- [x] No known EC violations remain open — WORK_INDEX.md shows WP-039 complete at `ee5e1d5`; EC-039 Done at EC_INDEX.md. Prior ECs in scope (EC-031, EC-034, EC-035, EC-036, EC-037, EC-038) all Done per session-context §2.
- [x] Required types/contracts exist and are exported as referenced by WP-040 — `IncidentSeverity`, `OpsCounters`, `DeploymentEnvironment` present in `ops.types.ts`; `EngineVersion` / `DataVersion` / `ContentVersion` / `VersionedArtifact<T>` / `checkCompatibility` / `migrateArtifact` / `stampArtifact` present in `src/versioning/` (session-context §3).
- [x] No naming or ownership conflicts (no duplicate "engine-wide" types) — D-3901 reuse verification PASS (4/4 genuinely novel).
- [x] No architectural boundary conflicts anticipated at the contract level — WP-040 types are metadata-only (not in `LegendaryGameState`), not persisted, not transmitted in replay logs, not used to branch gameplay logic (WP-040 §Non-Negotiable Constraints lines 100-102 and EC-040 §Guardrails lines 72-76 both lock this).
- [x] If the WP touches database schemas or migrations — N/A (no DB, no migrations).
- [x] If the WP depends on R2 data — N/A (no R2).
- [x] If the WP reads data from G fields — N/A (no runtime G reads).

**Verdict: PASS.** Structural Readiness is clean. The four BLOCKERs are all at the §Context / §Files Expected level, not the type-contract level.

---

## Code Category Boundary Check

- [ ] **PS-1 BLOCKER:** `packages/game-engine/src/governance/` is NOT currently classified in [02-CODE-CATEGORIES.md](docs/ai/REFERENCE/02-CODE-CATEGORIES.md). Per P6-46 (WP-027/028/030/031/034/035 precedent — D-2706 / D-2801 / D-3001 / D-3101 / D-3401 / D-3501), every new `packages/game-engine/src/<subdir>/` requires a DECISIONS.md classification entry before execution. The next available D-number is **D-4001** (D-3901 is the most recent landed entry; 40xx range unused per session-context §2).
- [x] All new or modified files fall cleanly into one existing code category — once D-4001 lands classifying `src/governance/` as engine, the four files fall cleanly (docs/governance/ is under docs/ category, engine files under engine category once classified).
- [x] Each file's category permits all imports and mutations it uses — `governance.types.ts` is pure types (no imports beyond Node built-ins); `types.ts` + `index.ts` re-exports are additive.
- [x] No file blurs category boundaries — types file contains no runtime logic, no `boardgame.io` import, no registry import, no server import.

**PS-1 resolution required:** Author `D-4001 — packages/game-engine/src/governance/ Classified as Engine Category` under the D-2706 / D-2801 / D-3001 / D-3101 / D-3401 / D-3501 template:
- Cite purity (pure types only, no runtime logic).
- Cite no I/O, no `boardgame.io`, no registry, no server imports.
- Cite follow-all-engine-category-rules as rationale.
- Status: Immutable.
- `### D-4001` heading (regular hyphen is acceptable; em-dash encoding is a DECISIONS.md convention but WP-040 v1 pre-flight uses regular hyphens to match internal grep discipline).

D-4001 must land **before** EC-040 execution begins. Include as Commit A0 pre-flight bundle content (Path A rewrite).

---

## Pre-Session Actions (PS-#)

Per [01.4 §Authorized Next Step](docs/ai/REFERENCE/01.4-pre-flight-invocation.md:2031) "Pre-session actions — ALL RESOLVED" pattern, the following PS-# items must be resolved before the session prompt is generated.

### PS-1 — Create D-4001 classifying `packages/game-engine/src/governance/`

See §Code Category Boundary Check above. This is a mechanical resolution following the D-2706 / D-2801 / D-3001 / D-3101 / D-3401 / D-3501 template. Landed as part of Commit A0 pre-flight bundle.

### PS-2 — Lock P6-51 DECISIONS.md placement form before execution

WP-040 §Definition of Done line 347-349 requires:

> *"`docs/ai/DECISIONS.md` updated — at minimum: why five categories (maps to layer boundary); why content/UI are primary vectors (safest growth); what constitutes an immutable surface (replay, RNG, scoring, invariants)"*

Per [P6-51](docs/ai/REFERENCE/01.4-pre-flight-invocation.md:5204) (WP-035 precedent), the phrase "update DECISIONS.md with X" is ambiguous and must be locked before execution. Two valid forms:

- **Form (1):** Three discrete D-entries (D-4002 / D-4003 / D-4004) under the canonical Decision / Rationale / Implications / Alternatives / Status structure in DECISIONS.md.
- **Form (2):** Prose-in-produced-doc with D-entry back-pointers — the three rationales live as reader-facing prose in `docs/governance/CHANGE_GOVERNANCE.md` (its natural reader-facing home), with three short back-pointer D-entries in DECISIONS.md citing the relevant CHANGE_GOVERNANCE.md sections.

**Pre-flight recommendation: Form (2) with back-pointer D-4002 / D-4003 / D-4004.** Rationale: WP-040 produces a long-lived governance document (`CHANGE_GOVERNANCE.md`) where these three rationales naturally belong as reader-facing prose — matching the WP-035 D-3502 / D-3503 / D-3504 precedent where release-process rationales lived in `RELEASE_CHECKLIST.md` / `DEPLOYMENT_FLOW.md` with back-pointer D-entries. Form (1) would split the rationale between the governance doc (where the categories, vectors, and immutable-surface list are explained) and DECISIONS.md (a duplicate explanation), creating update-drift risk.

**PS-2 resolution:** Session prompt §Locked Values must state:
> *"DECISIONS.md placement: form (2) with three back-pointer D-entries — D-4002 cites `docs/governance/CHANGE_GOVERNANCE.md §Change Classification`; D-4003 cites `docs/governance/CHANGE_GOVERNANCE.md §Growth Vectors`; D-4004 cites `docs/governance/CHANGE_GOVERNANCE.md §Immutable Surfaces`."*

Each back-pointer D-entry must be a first-class DECISIONS.md entry with its own DECISIONS_INDEX row per P6-51 prevention clause.

### PS-3 — Lock P6-52 paraphrase-table for verification-step grep-guards

WP-040 §Verification Steps (lines 295-321) contain four literal-pattern greps:

1. `Select-String -Path "packages\game-engine\src\types.ts" -Pattern "ChangeCategory|ChangeBudget"` — Step 3, expects re-export lines only.
2. `git diff --name-only packages/game-engine/src/game.ts packages/game-engine/src/moves/ packages/game-engine/src/rules/` — Step 4, expects empty output.
3. `Select-String -Path "packages\game-engine\src\governance" -Pattern "require(" -Recurse` — Step 5, expects empty output.
4. `git diff --name-only` — Step 6, expects only allowlisted files.

Steps 1, 3, and 4 are not P6-52-class (Step 1 is a positive grep constrained to re-export lines; Step 3 targets CJS syntax not identifiers; Step 4 is a file-list diff). **Step 5 (`require(`) has nonzero P6-52 risk** — comments like "never use `require()`" would trip the grep. Though low risk (JSDoc/comments rarely reference `require(` with parens in an ESM-only project), precedent P6-50 (WP-035 execution) mandates proactive paraphrase-table loading in session-prompt §Locked Values for any WP whose EC includes a Verification Step with purity-style greps over new source files.

**PS-3 resolution:** Session prompt §Locked Values must include an "Authoring discipline for grep-guarded identifiers" subsection (P6-52 template) citing P6-52 by number, with a minimum paraphrase table:

| Forbidden identifier (Step 5 grep) | Approved paraphrase |
|---|---|
| `require(` | "the CJS require call" |
| `Math.random` | "non-engine RNG" (per P6-50 WP-035 precedent; relevant because governance types may explain what ENGINE-category RNG rules protect) |
| `Date.now` | "wall-clock helper" (per P6-50) |
| `boardgame.io` | "the game framework" (per P6-50 WP-035 precedent) |
| `@legendary-arena/registry` | "the registry package" (per P6-50) |
| `apps/server` | "the server layer" (per P6-50) |

Expand as needed if EC-040 introduces additional grep gates during Path A rewrite.

---

## Scope Lock (Critical)

### WP-040 Is Allowed To

- Create `docs/governance/CHANGE_GOVERNANCE.md` — change classification, immutable surfaces, change-budget template, growth vectors, review requirements by category.
- Create `packages/game-engine/src/governance/governance.types.ts` — `ChangeCategory`, `ChangeBudget`, `ChangeClassification` types; `// why:` comment stating *"change budgets prevent entropy during growth (D-1001)"* per EC-040 §Required `// why:` Comments.
- Modify `packages/game-engine/src/types.ts` — additive re-exports of the three governance types only.
- Modify `packages/game-engine/src/index.ts` — additive public-API exports of the three governance types only.
- Create `docs/ai/post-mortems/01.6-WP-040-growth-governance-change-budget.md` (Path A addition per Finding 4).
- Governance-close updates (Commit B only, per EC-040 §After Completing): `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (append D-4001 / D-4002 / D-4003 / D-4004), `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`.

### WP-040 Is Explicitly Not Allowed To

- No modification of prior contract files.
- No new gameplay systems.
- No `LegendaryGameState` additions — governance types are metadata only, never stored in `G`, never persisted to any database, never transmitted in replay logs, never used to branch runtime gameplay (WP-040 §Non-Negotiable Constraints + EC-040 §Guardrails).
- No engine gameplay modifications — `game.ts`, `moves/`, `rules/` must show empty `git diff --name-only` output per EC-040 §After Completing.
- No `require()` in any generated file (ESM-only project).
- No parallel severity type (D-3901 — pre-flight D-3901 reuse verification PASS).
- No parallel counter container (D-3901).
- No files outside the (now five-plus-four-Commit-B) allowlist.

### Locked File List (post-Path-A)

**Commit A (EC-040 execution, five files):**
- `docs/governance/CHANGE_GOVERNANCE.md` (new)
- `packages/game-engine/src/governance/governance.types.ts` (new)
- `packages/game-engine/src/types.ts` (modified — additive re-exports)
- `packages/game-engine/src/index.ts` (modified — additive re-exports)
- `docs/ai/post-mortems/01.6-WP-040-growth-governance-change-budget.md` (new — Path A addition)

**Commit B (SPEC governance close, four files):**
- `docs/ai/STATUS.md` (prepend canonical Phase 7 closure block)
- `docs/ai/DECISIONS.md` (append D-4001 / D-4002 / D-4003 / D-4004)
- `docs/ai/work-packets/WORK_INDEX.md` (WP-040 `[ ]` → `[x]` with date + commit hash)
- `docs/ai/execution-checklists/EC_INDEX.md` (EC-040 Draft → Done; counters 12→13 / 48→47)

**Commit A0 (SPEC pre-flight bundle, six files expected):**
- `docs/ai/invocations/preflight-wp040-growth-governance-change-budget.md` (this file, v1)
- `docs/ai/invocations/preflight-wp040-growth-governance-change-budget-v2.md` (v2 after Path A)
- `docs/ai/invocations/copilot-wp040-growth-governance-change-budget.md` (copilot 30-issue check per 01.7)
- `docs/ai/invocations/session-wp040-growth-governance-change-budget.md` (session prompt)
- `docs/ai/work-packets/WP-040-growth-governance-change-budget.md` (Path A rewrite resolving Findings 1-4)
- `docs/ai/execution-checklists/EC-040-growth-governance.checklist.md` (Path A rewrite adding D-4001 hard-block, fifth Commit A file, D-3901 reuse verification subsection)

Plus D-4001 added to `docs/ai/DECISIONS.md` as Commit A0 content (PS-1 resolution — the D-4001 entry must land with the pre-flight bundle, not wait for governance close).

---

## Test Expectations (Locked Before Execution)

- **New tests:** zero new tests. WP-040 is a type-definitions-plus-documentation WP; types are pure closed unions with no runtime behavior to test. Matches WP-034 / WP-035 / WP-039 Phase 7 Docs-class precedent.
- **Existing test changes:** none. `types.ts` and `index.ts` additive re-exports do not affect existing tests.
- **Prior test baseline:** all 444 engine tests + 596 repo-wide tests must continue to pass post-Commit-A (Gate 5 + Gate 6 expected results unchanged).
- **Test boundaries:** no `boardgame.io/testing` imports, no modifications to `makeMockCtx` or shared test helpers, no new logic in existing test files.
- **Defensive guards:** N/A — no runtime code paths introduced.

**Rule:** If the implementation discovers that tests ARE needed (e.g., a drift-detection test asserting `ChangeCategory` union matches a canonical `CHANGE_CATEGORIES` readonly array), the deviation must be raised during execution as a scope-question escalation per EC-mode — do not silently add tests.

Note: WP-040 §Locked Values does NOT pair `ChangeCategory` with a canonical `CHANGE_CATEGORIES` readonly array, and the EC-040 §Locked Values only locks the type literal. Per code-style Rule ("Canonical readonly arrays — drift-detection tests must assert arrays exactly match their union types"), the engine has a project-wide discipline of pairing unions with canonical arrays (`MATCH_PHASES`, `TURN_STAGES`, `CORE_MOVE_NAMES`, `RULE_TRIGGER_NAMES`, `RULE_EFFECT_TYPES`, `REVEALED_CARD_TYPES`, `BOARD_KEYWORDS`, `SCHEME_SETUP_TYPES`). `ChangeCategory` is not a runtime-typed union (it's metadata-only, never-stored-in-G), so the drift-detection discipline arguably does not apply — but the pre-flight flags this as a design decision the session prompt should confirm. Recommend EC-040 §Locked Values add a single sentence: *"No canonical `CHANGE_CATEGORIES` readonly array is required because `ChangeCategory` is metadata-only and never used to branch runtime gameplay (D-3901 reuse-verification clause 4 applies)."*

---

## Risk & Ambiguity Review

| # | Risk / Ambiguity | Impact | Mitigation | Decision / Pattern |
|---|---|---|---|---|
| RS-1 | `ChangeCategory` overlaps semantically with the `ARCHITECTURE.md` §Layer Boundary partition (ENGINE↔game-engine, CONTENT↔registry, OPS↔server+ops playbook; RULES is an engine sub-category; UI is a client concept). Is this a D-3901-reuse violation? | MEDIUM | D-3901 reuse verification clause 1 (session-context §4): verify the union does not duplicate a landed **type**. The Layer Boundary is documentation, not a typed union. `ChangeCategory` is genuinely novel at the type level. | **Admissible.** Cross-link each category to its architectural layer in the produced doc (already planned in WP-040 §Scope In). Record D-3901 reuse-verification PASS (4/4) in EC-040 §Locked Values under "D-3901 reuse verification" subsection. |
| RS-2 | `immutableSurface?: 'replay' \| 'rng' \| 'scoring' \| 'invariants' \| 'endgame'` — genuinely novel, but could drift over time as new immutable surfaces are discovered. Extension seam? | LOW | The optional field is a closed union — extending requires a new WP and pre-flight. The WP-040 produced doc (`CHANGE_GOVERNANCE.md §Immutable Surfaces`) is the natural drift-detection anchor; any new immutable surface requires updating both the union and the doc. | **Extension seam exists** — adding a new literal to the union is a closed-union expansion pattern matching the BOARD_KEYWORDS / SCHEME_SETUP_TYPES / REVEALED_CARD_TYPES precedent family. Document in EC-040 Locked Values that future expansion requires both union + doc updates. |
| RS-3 | P6-52 risk in `docs/governance/CHANGE_GOVERNANCE.md` — the produced doc will naturally discuss forbidden-category-creep scenarios (e.g., "do not introduce a parallel UIState-scope category"). If EC-040 Verification Steps include a literal-identifier grep over the produced doc, meta-prose could trip it. | LOW-MEDIUM | PS-3 paraphrase-table locks approved paraphrases. EC-040 §Verification Steps currently do not grep the produced doc for forbidden identifiers (Step 3 greps `types.ts`; Step 5 greps `src/governance/` for `require(`). | **No additional blocker.** Include PS-3 paraphrase-table in session prompt §Locked Values as prevention. If Path A rewrite of EC-040 adds a produced-doc grep gate, re-evaluate. |
| RS-4 | Post-mortem placement — Finding 4 recommends option (a) (post-mortem in Commit A) per WP-039 precedent. Option (b) (post-mortem in Commit B) was also raised in session-context §7. | LOW | Option (a) matches the most recent precedent (WP-039) and keeps the post-mortem in the same session as the execution that observed the patterns. Option (b) would require a DECISIONS.md deviation entry and is discouraged. | **Option (a) locked** — extend WP-040 + EC-040 to include the post-mortem in Commit A's five-file list. |
| RS-5 | WP-040 §Definition of Done line 350-351 requires `docs/ai/work-packets/WORK_INDEX.md` to have "WP-040 checked off with today's date" — but EC-040 §After Completing line 122 says the same. The date is "today" as of the execution session, not pre-flight — verify the date token is computed at execution time. | LOW | Execution session runs the WORK_INDEX.md edit as Commit B content. Date is `2026-MM-DD` per whatever day the execution runs. No pre-flight action. | **No action.** Execution session handles the date token. Pre-flight notes the execution date field is not hardcoded. |
| RS-6 | Gate 8 drift — four unstaged doc mods including +194 lines on 01.4 (P6-52 + P6-53 additions). The session-context §9 Gate 8 expected a single `?? .claude/worktrees/` line. | LOW | The drift is documentation-only, does not touch `packages/` or `apps/`, and the 01.4 additions are the precedents this pre-flight cites. All four doc mods are unrelated to WP-040 scope (01.4 P6-52/P6-53 are governance-infra updates; the other three are roadmap / index back-syncs). | **Flag for post-execution cleanup.** Recommend committing the four doc mods as a SPEC-prefix governance-housekeeping commit before WP-040 Commit A0 pre-flight bundle lands, or rolling them into Commit A0 under a clear commit-message separation. Do not let them drift further. |
| RS-7 | `docs/governance/` is a new top-level docs subdirectory. Existing `docs/ops/` subdirectory precedent exists (introduced by WP-035). Does `docs/governance/` require a DECISIONS.md classification entry analogous to D-3501? | LOW | D-3501 classified `packages/game-engine/src/ops/` (code category), not `docs/ops/` (docs category). Code-category rules live in 02-CODE-CATEGORIES.md; docs directories are not currently gated by a classification registry. Precedent: `docs/beta/` was introduced by WP-037 with no classification decision. | **No action required.** New `docs/<subdir>/` directories are not gated by 02-CODE-CATEGORIES.md. Only the `packages/game-engine/src/governance/` subdirectory requires D-4001 classification (PS-1). |
| RS-8 | The c861b24 tightening commit message says: *"Pre-flight scope deliberately preserved: session-context §5 drift items … and the post-mortem §Files-Expected gap remain pre-flight Path A findings. Fixing now would preempt the pre-flight v1 DO-NOT-EXECUTE-YET → v2 cycle the bridge anchors to."* — This is a deliberate pre-flight-exercise preservation. Does the intentional preservation change the verdict logic? | LOW | No. Pre-flight v1 is authored by an independent agent validating the as-committed WP-040 + EC-040 state. The findings are real findings (drift items that would affect execution if unresolved); the preservation signals the commit author expected v1 to discover them and land Path A in v2. | **No action required.** Pre-flight v1 returns DO NOT EXECUTE YET with Path A findings 1-4 and pre-session actions PS-1 / PS-2 / PS-3. v2 pre-flight is authored after Path A rewrite lands. |

No HIGH-impact risks. All MEDIUM-impact items are covered by PS-# or §Path A actions. All LOW-impact items are administrative or already handled by existing precedent.

---

## Pre-Flight Verdict (Binary)

**DO NOT EXECUTE YET.**

WP-040 has four Path A drafting-drift blockers and three pre-session actions that must be resolved before a session execution prompt may be generated:

1. **Finding 1** — "four metric categories" drift at WP-040:11 must be paraphrased to "four organizational-prose metric labels" to align with WP-039 Path A as-landed reality.
2. **Finding 2** — D-3901 must be named in WP-040 §Session Context "implements list" and §Context (Read First) as a binding decision inheriting the reuse-not-parallel discipline.
3. **Finding 3** — P6-53 blocker: WP-040 §Context (Read First) must enumerate all eight missing AUTHORITATIVE surfaces (LIVE_OPS_FRAMEWORK.md, ops.types.ts, INCIDENT_RESPONSE.md, RELEASE_CHECKLIST.md, DEPLOYMENT_FLOW.md, src/versioning/, D-0702, D-3901) with caps-tagged markers.
4. **Finding 4** — WP-040 §Files Expected to Change and EC-040 §Files to Produce must be extended to include `docs/ai/post-mortems/01.6-WP-040-growth-governance-change-budget.md` as a fifth Commit A file.
5. **PS-1** — D-4001 must be authored classifying `packages/game-engine/src/governance/` as engine category under the D-2706 / D-2801 / D-3001 / D-3101 / D-3401 / D-3501 template, and landed as part of the Commit A0 pre-flight bundle.
6. **PS-2** — Session prompt must lock DECISIONS.md placement form (2) with three back-pointer D-entries (D-4002 / D-4003 / D-4004) citing CHANGE_GOVERNANCE.md sections, per P6-51.
7. **PS-3** — Session prompt §Locked Values must include the P6-52 "Authoring discipline for grep-guarded identifiers" subsection with a paraphrase table covering Step 5 (`require(`) and the P6-50 canonical forbidden-token list.

D-3901 reuse verification: **PASS (4/4 genuinely novel)** — no severity/counter-type collision. All nine §9 reality gates: PASS (Gate 8 with documented drift). Structural Readiness: PASS. Code Category Boundary: BLOCKED on PS-1. Dependency & Sequencing: PASS. Vision Sanity Check: PASS.

The verdict is conditional on Findings 1-4 being resolved via a Path A rewrite of WP-040 + EC-040 landed in Commit A0, and PS-1 / PS-2 / PS-3 being resolved via D-4001 landing and session-prompt-§Locked-Values preparation. Once all seven items resolve, re-run pre-flight as v2. v2 is expected to return **READY TO EXECUTE** if and only if all seven items are resolved without introducing new scope.

---

## Invocation Prompt Conformance Check (Pre-Generation)

**Not applicable at v1.** This check applies only if the verdict is READY TO EXECUTE. v1 verdict is DO NOT EXECUTE YET; no session prompt may be generated from v1.

Deferred to pre-flight v2.

---

## Authorized Next Step

**Verdict is DO NOT EXECUTE YET. Session prompt generation is NOT authorized at v1.**

**Pre-session actions — required before v2:**

1. **Path A rewrite of WP-040** resolving Findings 1, 2, 3, 4. Concretely:
   - WP-040:11 paraphrase fix.
   - WP-040 §Session Context extend "implements" list to include D-3901 inheritance.
   - WP-040 §Context (Read First) extend with eight AUTHORITATIVE surface bullets per session-context §3 template.
   - WP-040 §Files Expected to Change extend to include post-mortem as fifth file.
2. **Path A rewrite of EC-040** resolving:
   - §Before Starting add "D-4001 exists" hard block (PS-1).
   - §Files to Produce extend to include post-mortem as fifth Commit A file (Finding 4).
   - §Locked Values add "D-3901 reuse verification" subsection (4/4 genuinely novel PASS).
   - §Locked Values add "No canonical `CHANGE_CATEGORIES` readonly array required because metadata-only" sentence (RS per Test Expectations note).
   - §After Completing aggregate-scope diff list grows from 4+3 to 5+3 (Finding 4).
3. **Author D-4001** in `docs/ai/DECISIONS.md` classifying `packages/game-engine/src/governance/` as engine category (PS-1). Use regular hyphen in heading (`### D-4001 — …`).
4. **Author v2 pre-flight** resolving all v1 findings and pre-session actions. Save as `docs/ai/invocations/preflight-wp040-growth-governance-change-budget-v2.md`.
5. **Author copilot check** per 01.7-copilot-check.md (30-issue scan, analogous to WP-038 / WP-039). Save as `docs/ai/invocations/copilot-wp040-growth-governance-change-budget.md`. Copilot check runs only after v2 returns READY TO EXECUTE.
6. **Author session prompt** with §Locked Values including:
   - P6-51 placement form (2) with three back-pointer D-entries (PS-2).
   - P6-52 paraphrase table citing P6-52 by number (PS-3).
   - P6-50 canonical forbidden-token list with approved paraphrases.
   - Explicit "01.5 NOT INVOKED" declaration per WP-030 precedent (Contract-Only WP, no runtime wiring).
   - Three-commit topology lock per session-context §7 (A0 SPEC bundle → A EC-040 content → B SPEC governance close).
   Save as `docs/ai/invocations/session-wp040-growth-governance-change-budget.md`.

**Optional housekeeping (recommend before Commit A0 lands):**

- Commit the four unstaged doc mods (Gate 8 drift) as a SPEC-prefix governance-housekeeping commit: `docs/00-INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/05-ROADMAP.md`, `docs/ai/REFERENCE/01.4-pre-flight-invocation.md` (+P6-52/P6-53 landed commit). This cleans the working tree before Commit A0 and ensures P6-52/P6-53 are first-class landed precedents rather than floating uncommitted content.

---

## Final Instruction

Pre-flight exists to **prevent premature execution and scope drift**.

v1 verdict: **DO NOT EXECUTE YET**.

Four Path A findings (1, 2, 3, 4) and three pre-session actions (PS-1, PS-2, PS-3) must resolve before session-prompt generation is authorized. All resolutions are tractable via documentation edits + one DECISIONS.md addition (D-4001) — no code changes, no scope expansion beyond what the WP already intends. This is the expected v1 → v2 cycle per the session-context bridge's anchor (session-context §5, §7, §9).

Proceed to Path A rewrite + v2 pre-flight. Do NOT generate a session execution prompt from v1.

---

*Pre-flight v1 authored 2026-04-23 at `main @ c861b24`. Author: WP-040 pre-flight session. Consumer: WP-040 Path A rewriter + v2 pre-flight author. v1 is disposable once v2 lands and returns READY TO EXECUTE.*
