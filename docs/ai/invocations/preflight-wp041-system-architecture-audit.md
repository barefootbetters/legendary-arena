# Pre-Flight — WP-041 System Architecture Definition & Authority Model

**Target Work Packet:** `WP-041`
**Title:** System Architecture Definition & Authority Model
**Previous WP Status:** WP-040 Complete (2026-04-23, commit `bd5bec0`)
**Pre-Flight Date:** 2026-04-23
**Invocation Stage:** Pre-Execution (Scope & Readiness)
**Repo-state anchor:** `main @ c203055` + uncommitted WP/EC tightening edits (docs-only; `git status` shows only `WP-041-…md`, `EC-041-…checklist.md`, `.claude/worktrees/`)

**Work Packet Class:** Contract-Only / Documentation (pure documentation review and certification pass; no types, no runtime, no code).

Per 01.4, the class requires: Dependency Check, Input Data Traceability, Structural Readiness, Scope Lock, Test Expectations, Risk Review, Vision Sanity Check. Runtime Readiness, Mutation Boundary Confirmation, and Dependency Contract Verification are **N/A** — this WP touches zero runtime surface.

---

## Pre-Flight Intent

Perform a pre-flight validation for WP-041.

- Not implementing.
- Not generating code.
- Validating that the certification pass is properly sequenced, scoped, and that its locked values match the actual state of `ARCHITECTURE.md` and `LegendaryGameState` in `packages/game-engine/src/types.ts`.

Verdict is binary (READY TO EXECUTE / DO NOT EXECUTE YET). Conditional READY is permitted if the scope-neutral PS-n actions below are resolved before session prompt generation.

---

## Reality-Check Gates

| # | Expected | Actual | Verdict |
|---|---|---|---|
| 1 | WP-040 governance close at `bd5bec0` | confirmed via `git log --oneline -15` (line 3: `bd5bec0 SPEC: close WP-040 / EC-040`) | PASS |
| 2 | WP-040 back-sync landed at `c203055` | confirmed (line 1) | PASS |
| 3 | DECISIONS.md exists, highest D-ID is plausible for 2026-04-23 | `grep "^### D-" docs/ai/DECISIONS.md \| tail -5` → last is **D-4004**; total count = 261 | PASS (but see Finding 2 — WP's "D-0001 through D-1102" claim is stale) |
| 4 | `packages/game-engine/src/versioning/versioning.check.ts` contains `EngineVersion = {1,0,0}` | confirmed at [versioning.check.ts:29-33](packages/game-engine/src/versioning/versioning.check.ts:29) | PASS — matches EC-041 locked stamp `Architecture Version: 1.0.0` |
| 5 | Working tree docs-only (no `packages/` or `apps/` diff) | `git status --porcelain` → only `WP-041-…md`, `EC-041-…checklist.md`, `.claude/worktrees/` | PASS |
| 6 | `ARCHITECTURE.md` exists with Sections 1-5, MVP Gameplay Invariants, Layer Boundary | `grep "^## " docs/ai/ARCHITECTURE.md` → 8 headings including `## Section 1` → `## Section 5`, `## MVP Gameplay Invariants (WP-010–WP-026)`, `## High-Level System Diagram` | PASS |
| 7 | `.claude/rules/*.md` cross-references ARCHITECTURE.md | confirmed (rules loaded in context; each names ARCHITECTURE.md as authority) | PASS |
| 8 | Engine test baseline clean | Per WP-040 v2 preflight gate 5 (2026-04-23): `444 / 110 / 0`; no engine files modified since | PASS-with-note (test baseline frozen at WP-040 certification; WP-041 does not touch engine) |
| 9 | EC-041 locked "19 G fields" matches `LegendaryGameState` Runtime-class fields | `grep "readonly\|^\s*\w" packages/game-engine/src/types.ts §LegendaryGameState` → **21 Runtime fields** (19 in EC + `selection` (WP-005B) + `activeScoringConfig?` (WP-067)); plus `matchConfiguration` (Class 2) | **FAIL — see Finding 1 below** |

---

## §1 — Dependency & Sequencing Check

| WP | Status | Notes |
|---|---|---|
| WP-040 | Complete | Closed at `bd5bec0` (2026-04-23); back-sync committed at `c203055` |
| WP-001 through WP-040 | Complete | All deliverables present per WORK_INDEX and commit history |

**Rule check:** All prerequisite work is complete. No Foundation Prompts pending. **PASS.**

---

## §2 — Vision Sanity Check

> WP-041 §Vision Alignment block is present (lines 181-201 of the current WP) and names clauses §7, §8, §13, §14, §15. Pre-flight re-verifies.

- [x] **Vision clauses touched by this WP** — §7, §8, §13, §14, §15 (integrity / fairness / replay-bearing surfaces).
- [x] **Conflict assertion** — `No conflict: this WP preserves all touched clauses.` WP-041 audits the authority chain and, per the recent EC tightening, explicitly positions `01-VISION.md` between `ARCHITECTURE.md` and `.claude/rules`, reinforcing (not redefining) vision authority.
- [x] **Non-Goal proximity** — `N/A — WP touches no monetization or competitive surface.` Documentation-only.
- [x] **Determinism preservation** — `N/A — WP touches no determinism-bearing surface.` No RNG, no scoring, no replay.
- [x] **WP `## Vision Alignment` section** — Present. Block is well-formed and cites clause numbers, not paraphrases.

**Verdict:** Vision Sanity Check **PASS**. No vision conflict. The WP strengthens vision authority by locking `01-VISION.md`'s position in the chain.

---

## §3 — Structural Readiness Check

- [x] `ARCHITECTURE.md` exists and is the authoritative input.
- [x] Section 3 (Persistence Boundaries) contains a Field Classification Reference table with the three data-class definitions (Class 1 Runtime, Class 2 Configuration, Class 3 Snapshot) at [ARCHITECTURE.md:620](docs/ai/ARCHITECTURE.md:620).
- [x] The table currently lists ~22 entries including `G`, `ctx`, and each G field. Most entries are present, **with one documented** gap: no row for `activeScoringConfig` (WP-067, outside the WP-001..WP-040 verification scope).
- [x] A Document override hierarchy block already exists at [ARCHITECTURE.md:8-16](docs/ai/ARCHITECTURE.md:8), but it names `00.1-master-coordination-prompt.md` as #1 and does **not** include `CLAUDE.md` or `01-VISION.md`. WP-041 §B authorizes updating this block (the "Authority Model section — add if missing" clause applies as an **update** rather than an **add** — the intent is the same: make the chain match the current authority model).
- [x] No version stamp currently exists at the top of `ARCHITECTURE.md`. WP-041 §C authorizes adding one. **PASS.**

---

## §4 — Scope Lock (Critical)

### WP-041 Is Allowed To

- **Modify:** `docs/ai/ARCHITECTURE.md`
  - Update the existing document override hierarchy to match current authority (add `CLAUDE.md` at top, add `01-VISION.md` between ARCHITECTURE.md and `.claude/rules`)
  - Add a version stamp (`Architecture Version: 1.0.0`, `Last Reviewed: 2026-04-23`, `Verified Against: WP-001 through WP-040`) at the top of the document
  - Add any missing Field Classification Reference entries **for G fields established by WP-002 through WP-026** (the bounded scope of WP-041 §Scope (In) §A)
  - Correct internal transcription / cross-reference errors discovered during audit
- **Modify:** `docs/ai/DECISIONS.md`
  - Record audit findings using only the three permitted entry types (Architecture Audit Finding / Resolved Transcription Inconsistency / Rules-Architecture Drift Log)
- **Modify:** `docs/ai/work-packets/WORK_INDEX.md`
  - Check off WP-041 with 2026-04-23
- **Modify:** `docs/ai/STATUS.md`
  - Record architecture formal review + version

### WP-041 Is Explicitly Not Allowed To

- Modify any file under `packages/**` or `apps/**`
- Modify any file under `.claude/rules/**` (drift is logged, not corrected)
- Introduce new layers, boundaries, or invariants
- Weaken or remove existing constraints
- Modify any Work Packet other than WORK_INDEX.md
- Add rows to the Field Classification table for fields established *after* WP-026 (i.e., `activeScoringConfig` from WP-067 is **out of scope** for this WP — it lives in a future audit packet or is handled by the relevant WP's own architecture update)
- Log trivial no-change confirmations to DECISIONS.md (only the three permitted entry types, per EC-041 §Files to Produce)

**Rule:** Anything not explicitly allowed is out of scope.

---

## §5 — Test Expectations (Locked Before Execution)

- **New tests:** 0. This WP is documentation-only; no test surface.
- **Existing test changes:** None expected. All 444 engine tests (and 110 integration) must continue to pass without modification.
- **Prior test baseline:** `444 / 110 / 0` engine; `596 / 0` repo (frozen at WP-040 certification).
- **Test boundaries:** No test files may be touched. `makeMockCtx`, `boardgame.io/testing` imports, and all test helpers are off-limits (consistent with scope lock).

**Rule:** Any attempt to add or modify tests in this session is a scope violation.

---

## §6 — Findings (Blocking & Non-Blocking)

### Finding 1 — EC-041 locked "exactly 19" undercounts actual Runtime G fields by **1** (BLOCKING)

**Evidence.** `LegendaryGameState` in [packages/game-engine/src/types.ts:375-509](packages/game-engine/src/types.ts:375) declares the following fields in order:

1. `matchConfiguration` — Class 2 (Configuration), not Runtime
2. `selection` — Runtime (introduced WP-005B)
3. `currentStage` — Runtime (WP-007B)
4. `playerZones` — Runtime (WP-006A)
5. `piles` — Runtime (WP-006B)
6. `messages` — Runtime (WP-009B)
7. `counters` — Runtime (WP-010)
8. `hookRegistry` — Runtime (WP-009B)
9. `villainDeck` — Runtime (WP-014)
10. `villainDeckCardTypes` — Runtime (WP-014)
11. `city` — Runtime (WP-015)
12. `hq` — Runtime (WP-015)
13. `ko` — Runtime (WP-017)
14. `attachedBystanders` — Runtime (WP-017)
15. `mastermind` — Runtime (WP-019)
16. `turnEconomy` — Runtime (WP-018)
17. `cardStats` — Runtime (WP-018)
18. `cardKeywords` — Runtime (WP-025)
19. `schemeSetupInstructions` — Runtime (WP-026)
20. `heroAbilityHooks` — Runtime (WP-021)
21. `lobby` — Runtime (WP-011)
22. `activeScoringConfig?` — Runtime (WP-067, out of WP-041's WP-001..WP-026 verification scope)

Of the 21 Runtime fields, **20** are within WP-041 §Scope (In) §A's bounded range (`WP-002 through WP-026`). EC-041's locked list names **19**. The missing field is **`selection` (WP-005B)**, which is already documented in `ARCHITECTURE.md` §3 at [ARCHITECTURE.md:636](docs/ai/ARCHITECTURE.md:636) as `Runtime | Match setup selection state; introduced WP-005B`.

**Impact.** The EC is the authoritative acceptance contract (per its own §Execution Authority). If the executing session strictly follows the EC's "Exactly 19" lock, it will **not** add a `selection` row (no-op because already present), but the EC's own completeness-audit discipline is falsified — the EC cannot be used to verify scope §A's "ALL G fields" requirement when the EC itself undercounts by 1.

**FIX (scope-neutral, WP/EC update):** Update EC-041 §Locked Values §Field Classification to lock **20** fields (add `selection` (WP-005B) between `playerZones` (WP-006A) and `piles` (WP-006B), numbered #1 with the rest renumbered). Update the "Exactly 19" count and the After Completing assertion to match. WP-041 §Scope (In) §A already names "ALL G fields established by WP-002 through WP-026" — the WP is correct; only the EC's explicit enumeration is short.

**Classification:** Scope-neutral (no architecture change; no runtime change; no new invariant). **PS-1 below.**

---

### Finding 2 — WP-041 Assumes block cites a stale DECISIONS.md range (NON-BLOCKING, advisory)

**Evidence.** WP-041 Assumes (after the recent duplicate-removal edit) still states:

> `docs/ai/DECISIONS.md` exists with all decisions D-0001 through D-1102

Actual DECISIONS.md contains 261 decisions; the highest D-ID is `D-4004` (live-ops / growth-governance). The range `D-0001 through D-1102` reflects the WP's authorship window (likely Phase 2-3 era) and has not been refreshed.

**Impact.** None for execution correctness — the Assumes block is a precondition check, and the condition "DECISIONS.md exists with the cited decisions" is trivially true (D-0001 through D-1102 are a subset of the actual content). But the stated upper bound is misleading to any reader who uses it to calibrate the audit's breadth.

**FIX (scope-neutral):** Update WP-041 Assumes to read `docs/ai/DECISIONS.md exists with all decisions D-0001 through D-4004 present` (or, preferably, `all decisions D-0001 through the current highest D-ID`). Scope §D's consistency audit is already supposed to "be consistent with every immutable decision" — the current language of the Assumes is a minor precondition mis-statement, not a scope issue.

**Classification:** Scope-neutral precondition correction. **PS-2 below.**

---

### Finding 3 — ARCHITECTURE.md existing override hierarchy is stale and will require update, not just addition (INFORMATIONAL)

**Evidence.** [ARCHITECTURE.md:8-16](docs/ai/ARCHITECTURE.md:8) currently contains:

```
Document override hierarchy (established in WP-001):
 1. docs/ai/REFERENCE/00.1-master-coordination-prompt.md — highest authority
 2. docs/ai/ARCHITECTURE.md (this file)
 3. Individual Work Packets
 4. Active conversation context
```

This block pre-dates both the promotion of `.claude/CLAUDE.md` to top authority and the introduction of `01-VISION.md` (referenced by WP-040 and P6-52 / P6-53 in 01.4). WP-041 §B authorizes adding an authority model section "if not already present" — but one **is** present; it is simply stale.

**Impact.** None if the executing session reads the §B mandate as "replace the stale hierarchy with the full chain including CLAUDE.md, ARCHITECTURE.md, 01-VISION.md, .claude/rules, WORK_INDEX, WPs, conversation." This is the intended behavior per the recent WP/EC tightening.

**FIX (no action required at pre-flight; confirmed in scope):** The executing session must treat §B as "update the existing block to match the current authority chain." The session prompt should include a transcription of the target chain to prevent interpretation drift. **No PS action required** — this is already captured by the recent EC §Locked Values edit.

**Classification:** Informational; executed in scope. No blocker.

---

### Finding 4 — ARCHITECTURE.md §3 Class column uses dual semantics (INFORMATIONAL, advisory)

**Evidence.** The Field Classification table at [ARCHITECTURE.md:622-653](docs/ai/ARCHITECTURE.md:622) uses mixed labels in the `Class` column:

- `Runtime` (e.g., `G.hookRegistry`, `G.cardStats`, `G.selection`)
- `Snapshot (as copy)` (e.g., `G.counters`, `G.messages`) — meaning: runtime value, copyable into a snapshot
- `Snapshot → count only` (e.g., `G.playerZones[*].*`) — meaning: runtime value, only counts copyable

EC-041's invariant "**All listed fields are Class 1 — Runtime (G)**" is consistent with the **authoritative location** reading (all are runtime-owned), but is **not** consistent with the column values as currently written. A reader comparing EC-041's assertion to ARCHITECTURE.md's table will find what looks like a contradiction (`G.counters` column says "Snapshot (as copy)", not "Runtime").

**Impact.** Low but real. The audit should either:
  (a) reconcile the column wording (e.g., split into two columns: `Authoritative Class` + `Snapshot Handling`), or
  (b) add a one-sentence clarification above the table: *"The Class column lists the authoritative class first; annotations like `Snapshot (as copy)` indicate how a runtime value may appear in a snapshot — the field itself is still Class 1 Runtime."*

Option (b) is lower-touch and satisfies the "no weakening, no removal, additions/corrections only" scope constraint.

**FIX (scope-neutral, session-authoring guardrail):** Session prompt should instruct the executing agent to prefer option (b) — add a clarifying sentence above the table — rather than restructuring the column. **No WP/EC update required.**

**Classification:** Session-prompt guidance, not a blocker. **PS-3 below** (captured for session-prompt authoring).

---

## §7 — Risk & Ambiguity Review

| Risk / Ambiguity | Impact | Mitigation | Decision / Pattern |
|---|---|---|---|
| EC "Exactly 19" lock conflicts with WP scope §A "ALL G fields WP-002..WP-026" | MEDIUM | Resolve PS-1 before session prompt; re-count to 20 | EC lock list is the authoritative count once corrected; WP §A §Scope language is preserved |
| Executing agent interprets §B as "add if missing" and duplicates the existing stale block | LOW-MEDIUM | Session prompt explicitly instructs "update existing block" per Finding 3 | §B language + EC Locked Value "Authority Hierarchy" block is already the target; Finding 3 FIX note is advisory |
| Executing agent adds a row for `activeScoringConfig` (out of scope) | LOW | Scope Lock above explicitly forbids rows outside WP-002..WP-026 range; `activeScoringConfig` is WP-067 | Hold the line — `activeScoringConfig` is for a later audit; not this WP |
| DECISIONS.md logging bloats with trivial confirmations | LOW | EC-041 §Files to Produce locks the three permitted entry types; "No trivial no-change confirmations" explicitly forbidden | Already captured in the recent EC tightening |
| Column semantic ambiguity in Section 3 table (Finding 4) | LOW | Session prompt guidance: prefer clarifying sentence over column restructure | Option (b) in Finding 4 |

**Locking rule:** All ambiguities resolved here are locked. The execution session must not revisit or reinterpret these decisions.

---

## §8 — Pre-Flight Verdict (Binary)

**READY TO EXECUTE — conditional on PS-1 and PS-2 resolution before session prompt generation.**

Justification:

1. **Dependency readiness:** WP-040 is complete (`bd5bec0`, 2026-04-23). All Phase 7 predecessors are in place. No Foundation Prompts pending.
2. **Contract fidelity:** Gates 1-8 all PASS. The one gate failure (Gate 9, the EC's "19" lock) is a **scope-neutral enumeration error** — the WP's actual intent (verify *all* G fields from WP-002..WP-026) is correct; only the EC's explicit count is short. PS-1 corrects this in-place.
3. **Scope lock clarity:** §4 above is unambiguous. No file outside `ARCHITECTURE.md` / `DECISIONS.md` / `WORK_INDEX.md` / `STATUS.md` may be touched. No runtime surface.
4. **Risks resolved:** All five risks in §7 have named mitigations or are captured as PS-n actions. None require architectural judgment calls in the executing session.
5. **Architectural boundary confidence:** High. This WP touches no engine, no registry, no server, no UI. Layer Boundary section of ARCHITECTURE.md is **the object of certification**, not a thing the WP could violate.
6. **Maintainability:** The WP strengthens long-term maintainability by locking the authority chain, stamping a version, and closing the "completeness" audit on the Field Classification table. No extension-seam concerns because there are no new seams.

### Mandatory Pre-Session Actions (PS-n)

- **PS-1 [BLOCKING]** — Update `docs/ai/execution-checklists/EC-041-architecture-audit.checklist.md` §Locked Values §Field Classification: add `selection` — WP-005B as item **#1** (or in the natural order corresponding to introduction order), renumber the rest, change the count from "19" to **20**, and update the After Completing row that asserts "Exactly 19 G-class fields" to "Exactly 20 G-class fields." Rationale: reconciles EC completeness-lock with WP §A's "ALL G fields" scope.

- **PS-2 [NON-BLOCKING BUT RECOMMENDED]** — Update `docs/ai/work-packets/WP-041-system-architecture-definition-authority-model.md` Assumes bullet from `docs/ai/DECISIONS.md exists with all decisions D-0001 through D-1102` to `docs/ai/DECISIONS.md exists with all decisions D-0001 through D-4004` (or equivalent "through current highest D-ID"). Rationale: refreshes stale precondition range.

- **PS-3 [SESSION-PROMPT GUARDRAIL, NOT WP/EC UPDATE]** — Session prompt must include instruction: (a) §B is an **update** of the existing hierarchy block at `ARCHITECTURE.md:8-16`, not an addition; (b) Finding 4's Class-column ambiguity is resolved by adding a clarifying sentence above the table, not by restructuring columns; (c) `activeScoringConfig` (WP-067) is **out of scope** and must not be added.

Once PS-1 and PS-2 land, the verdict flips from conditional to unconditional READY TO EXECUTE without a pre-flight re-run — scope does not change.

---

## §9 — Invocation Prompt Conformance Check (Pre-Generation)

Runs after PS-1 and PS-2 are applied. Re-verify before session prompt is generated:

- [ ] All EC locked values (corrected to 20 fields) are copied verbatim into the invocation prompt
- [ ] No new keywords, helpers, file paths, or timing rules appear only in the prompt
- [ ] File paths match the WP exactly (`docs/ai/ARCHITECTURE.md`, `docs/ai/DECISIONS.md`, `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`)
- [ ] No forbidden imports or behaviors introduced by wording changes (N/A — docs-only)
- [ ] The prompt does not resolve ambiguities that were not resolved in this pre-flight (PS-3 captures the three ambiguities; nothing else should appear)
- [ ] Contract names and field names in the prompt match `packages/game-engine/src/types.ts` verbatim (all 20 Runtime field names spelled exactly as in `LegendaryGameState`)

**Rule:** The invocation prompt is strictly a transcription + ordering artifact. If it requires interpretation, pre-flight is incomplete.

---

## §10 — Authorized Next Step

If and only if PS-1 and PS-2 are resolved:

> You are authorized to generate a **session execution prompt** for WP-041 to be saved as:
> `docs/ai/invocations/session-wp041-architecture-audit.md`

**Guard:** The session prompt must conform exactly to the scope, constraints, and decisions locked by this pre-flight. No new scope may be introduced. The session prompt must also carry PS-3 as session-authoring guardrails (plain language, not as new EC rows).

Once PS-1 and PS-2 are applied, log the resolution here in a follow-up `Pre-session actions — ALL RESOLVED (YYYY-MM-DD)` block, per 01.4 §Authorized Next Step template.

---

## §11 — Final Instruction

Pre-flight exists to prevent premature execution and scope drift.

This WP is a **certification pass, not a change pass** (as the recent WP-041 tightening makes explicit). The two blocking issues (PS-1, PS-2) are **internal consistency errors in the governance artifacts themselves** — not architectural concerns. They are the kind of drift this very WP was designed to catch; catching them at pre-flight is exactly the loop working as intended.

No execution until PS-1 lands. Then proceed to the copilot check immediately below.
