# Copilot Check — WP-041 System Architecture Definition & Authority Model

**Date:** 2026-04-23
**Pre-flight verdict under review:** READY TO EXECUTE — conditional on PS-1 and PS-2 (per [preflight-wp041-system-architecture-audit.md §8](docs/ai/invocations/preflight-wp041-system-architecture-audit.md))
**Inputs reviewed:**
- EC: [docs/ai/execution-checklists/EC-041-architecture-audit.checklist.md](docs/ai/execution-checklists/EC-041-architecture-audit.checklist.md)
- WP: [docs/ai/work-packets/WP-041-system-architecture-definition-authority-model.md](docs/ai/work-packets/WP-041-system-architecture-definition-authority-model.md)
- Pre-flight: [docs/ai/invocations/preflight-wp041-system-architecture-audit.md](docs/ai/invocations/preflight-wp041-system-architecture-audit.md)
- Related anchors: [ARCHITECTURE.md](docs/ai/ARCHITECTURE.md), [.claude/rules/architecture.md](.claude/rules/architecture.md), [.claude/rules/code-style.md](.claude/rules/code-style.md), [.claude/rules/work-packets.md](.claude/rules/work-packets.md), [packages/game-engine/src/types.ts](packages/game-engine/src/types.ts), [REFERENCE/02-CODE-CATEGORIES.md](docs/ai/REFERENCE/02-CODE-CATEGORIES.md)

**Work Packet Class:** Contract-Only / Documentation. The copilot check is **recommended but optional** for Contract-Only per 01.7 §When Copilot Check Is Required; running it anyway per user request and the WP-038 / WP-039 / WP-040 Phase 7 precedent.

---

## Overall Judgment

**PASS.**

WP-041 is a documentation-only certification pass that touches no runtime surface, no engine code, no tests, no persistence boundary — so the majority of the 30 failure modes collapse to immediate PASS or N/A (PASS by non-applicability). Three categories produce RISK findings, all of which are **already captured as PS-1, PS-2, or PS-3 in the pre-flight**. One additional minor RISK surfaces (Issue 23 — field ordering in the EC locked list) and is resolved by a scope-neutral session-prompt guardrail (PS-4 below). No finding would cause architectural or determinism damage if execution proceeded after PS-1 and PS-2 are applied. The pre-flight verdict stands; disposition is **CONFIRM** subject to the four PS actions landing (three already in pre-flight + PS-4 added here).

---

## Findings

Grouped by the 30-issue category structure from 01.7. Every issue is scanned; PASS verdicts are listed with one-sentence justification so a reviewer can audit completeness.

### Category 1 — Separation of Concerns & Boundaries

1. **Issue 1 (Engine vs UI / App Boundary Drift) — PASS.** WP-041 §Out of Scope forbids any engine / server / registry / UI change; EC-041 §After Completing asserts `git diff --name-only packages/ apps/` must be empty. No boundary touched.

2. **Issue 9 (UI Re-implements or Re-interprets Engine Logic) — PASS.** N/A — no UI surface. The WP certifies the existing layer-boundary statements that prohibit this exact failure mode.

3. **Issue 16 (Lifecycle Wiring Creep) — PASS.** N/A — no `game.ts`, no moves, no phases, no runtime wiring.

4. **Issue 29 (Assumptions Leaking Across Layers) — PASS.** WP-041 §Context (Read First) names the five-layer partition and anchors to [ARCHITECTURE.md §Layer Boundary](docs/ai/ARCHITECTURE.md). The certification pass **strengthens** the one-directional knowledge rules by locking the authority chain.

### Category 2 — Determinism & Reproducibility

5. **Issue 2 (Non-Determinism Introduced by Convenience) — PASS.** N/A — no runtime logic, no randomness, no time source.

6. **Issue 8 (No Single Debugging Truth Artifact) — PASS.** N/A for documentation. The WP preserves the existing replay-is-canonical doctrine by not touching it.

7. **Issue 23 (Lack of Deterministic Ordering Guarantees) — RISK.** EC-041 §Locked Values §Field Classification currently enumerates **19 fields in a specific order**, and the pre-flight PS-1 directs the addition of `selection` (WP-005B). Without an explicit "add at position N" rule, the executing agent could insert `selection` anywhere in the list, producing a locked list that orders differently from (a) introduction order, (b) `LegendaryGameState` declaration order in [types.ts:375](packages/game-engine/src/types.ts:375), or (c) current ARCHITECTURE.md §3 table order. Future consistency audits would then have no canonical ordering to compare against.

    **FIX (PS-4, scope-neutral, session-prompt guardrail):** Session prompt must lock **introduction order** as the canonical ordering for the EC list. `selection` enters at position #2 (between `playerZones` WP-006A and `piles` WP-006B would violate introduction order; the correct slot is **immediately after `playerZones` and before `piles`** only if introduction order matches — **but `selection` was introduced in WP-005B, which is before WP-006A (`playerZones`)**. Therefore `selection` lands at position **#1**, with `playerZones` becoming #2 and all subsequent fields shifted by one.

    Alternative canonical orderings (by WP ID, by `LegendaryGameState` declaration order) would each produce a different sequence. The session prompt must state which ordering is authoritative before execution begins. Recommended: **introduction order (WP-ID ascending, ties broken by appearance order inside the same WP).** This matches the existing EC shape.

### Category 3 — Immutability & Mutation Discipline

8. **Issue 3 (Confusion Between Pure Functions and Immer Mutation) — PASS.** N/A — no functions introduced.

9. **Issue 17 (Hidden Mutation via Aliasing) — PASS.** N/A — no data structures returned from functions.

### Category 4 — Type Safety & Contract Integrity

10. **Issue 4 (Contract Drift Between Types, Tests, and Runtime) — RISK.** EC-041's "Exactly **19**" count conflicts with `LegendaryGameState`'s actual **20** Runtime-class fields in the WP-002..WP-026 verification range. Pre-flight Finding 1 captures this; PS-1 resolves it by updating the EC to "Exactly 20" and adding `selection`.

    **FIX:** Already captured as **PS-1** in pre-flight §8. No additional action here.

11. **Issue 5 (Optional Field Ambiguity) — PASS.** N/A — no TypeScript types introduced by this WP.

12. **Issue 6 (Undefined Merge Semantics Replace vs Append) — PASS.** N/A — no merge logic.

13. **Issue 10 (Stringly-Typed Outcomes and Results) — PASS.** N/A — no runtime string literals. The WP certifies the existing canonical-array + union-type discipline (`MATCH_PHASES`, `TURN_STAGES`, etc.) without adding to it.

14. **Issue 21 (Type Widening at Boundaries) — PASS.** N/A — no types introduced.

15. **Issue 27 (Weak Canonical Naming Discipline) — PASS.** Field names in the EC lock list (after PS-1) match `LegendaryGameState` declarations verbatim — [`selection`](packages/game-engine/src/types.ts:383), [`playerZones`](packages/game-engine/src/types.ts:397), [`piles`](packages/game-engine/src/types.ts:403), etc. No abbreviations, no near-synonyms. This is the canonical source.

### Category 5 — Persistence & Serialization

16. **Issue 7 (Persisting Runtime State by Accident) — PASS.** The WP **strengthens** the runtime/configuration/snapshot taxonomy by closing the Field Classification completeness audit. Scope explicitly forbids weakening.

17. **Issue 19 (Weak JSON-Serializability Guarantees) — PASS.** N/A — no code changes. The `hookRegistry` is data-only discipline + `ImplementationMap` outside G discipline are both preserved.

18. **Issue 24 (Mixed Persistence Concerns) — RISK.** [ARCHITECTURE.md §3 Field Classification Reference](docs/ai/ARCHITECTURE.md:620) uses mixed labels in the `Class` column — `Runtime`, `Snapshot (as copy)`, `Snapshot → count only` — conflating "authoritative class" with "snapshot-handling rule." EC-041's invariant "All 20 fields are Class 1 Runtime" is consistent with the authoritative-class reading but superficially conflicts with the column values. Pre-flight Finding 4 captures this.

    **FIX:** Already captured as **PS-3** in pre-flight §8 (session prompt guardrail: add a single clarifying sentence above the table; do not restructure columns). No additional action here.

### Category 6 — Testing & Invariant Enforcement

19. **Issue 11 (Tests Validate Behavior Not Invariants) — PASS.** N/A — no tests in scope. The WP preserves the existing drift-detection discipline (canonical arrays asserted equal to union types) without touching it.

### Category 7 — Scope & Execution Governance

20. **Issue 12 (Scope Creep During Small Packets) — PASS.** WP-041 §Files Expected to Change locks exactly `docs/ai/ARCHITECTURE.md` and `docs/ai/DECISIONS.md`; EC-041 §After Completing locks `git diff --name-only packages/ apps/` and `git diff --name-only .claude/rules/` must both be empty. The "Anything not explicitly allowed is out of scope" rule is cited in the pre-flight §4 Scope Lock and in WP-041 §Out of Scope. `activeScoringConfig` (WP-067) is explicitly held out-of-range.

21. **Issue 13 (Unclassified Directories and Ownership Ambiguity) — PASS.** N/A — no new directories; no new files outside the two allowed documentation paths. `02-CODE-CATEGORIES.md` registry is not touched.

22. **Issue 30 (Missing Pre-Session Governance Fixes) — RISK, mitigated.** Without the pre-flight, the EC's "Exactly 19" vs. actual 20 would have been discovered at execution time. The pre-flight caught it and enumerated PS-1, PS-2, PS-3 (and this copilot check adds PS-4). Disposition: CONFIRM after all four PS actions land.

    **FIX:** PS-1, PS-2, PS-3 already in pre-flight; PS-4 added above. No additional fix required beyond tracking.

### Category 8 — Extensibility & Future-Proofing

23. **Issue 14 (No Extension Seams for Future Growth) — PASS.** N/A — this is a certification pass, not a feature. The WP explicitly forbids introducing new invariants ("certification pass, not a change justification" per WP-041 §Session Context).

24. **Issue 28 (No Upgrade or Deprecation Story) — PASS.** The version stamp (`Architecture Version: 1.0.0`) is the upgrade surface. The EC-locked format (exact match on `Architecture Version: 1.0.0`) prevents silent format drift. The stamp's value matches [CURRENT_ENGINE_VERSION_VALUE at versioning.check.ts:29](packages/game-engine/src/versioning/versioning.check.ts:29), so architecture and engine versions are intentionally synchronized at 1.0.0.

### Category 9 — Documentation & Intent Clarity

25. **Issue 15 (Missing "Why" for Invariants and Boundaries) — PASS.** WP-041 §B explicitly requires documenting the **relationship** between ARCHITECTURE.md and `.claude/rules/*.md` (ARCHITECTURE.md wins on conflict — this is the "why"), and between ARCHITECTURE.md and DECISIONS.md (DECISIONS.md records rationale; ARCHITECTURE.md encodes the result). The WP's own Session Context also states the "why" for the certification pass itself ("not a change justification"). Adequate.

26. **Issue 20 (Ambiguous Authority Chain) — PASS.** **This is the WP's central work.** EC-041 §Locked Values §Authority Hierarchy locks the chain as a fenced code block:

    ```
    CLAUDE.md
    ARCHITECTURE.md
    01-VISION.md
    .claude/rules/*.md
    WORK_INDEX.md
    Work Packets (WP-*)
    Conversation / Chat
    ```

    `01-VISION.md` position is explicitly fixed and not re-derived elsewhere. The chain matches the 01.4 preflight authority hierarchy and the recent 01.7 §Legendary Arena Anchors list. Strongest possible PASS.

27. **Issue 26 (Implicit Content Semantics) — RISK.** The Section 3 Class column semantics (Issue 24 above) are a species of this — meaning is implied by convention rather than written. Same FIX as Issue 24: captured as PS-3.

    **FIX:** Same as Issue 24 — PS-3 in pre-flight. No additional action.

### Category 10 — Error Handling & Failure Semantics

28. **Issue 18 (Outcome Evaluation Timing Ambiguity) — PASS.** N/A — no outcome evaluation surface. The WP preserves the existing `evaluateEndgame` + stage-transition-locked-in-`turnPhases.logic.ts` discipline.

29. **Issue 22 (Silent Failure vs Loud Failure Decisions Made Late) — PASS.** N/A — no runtime, no error handling. The WP preserves `moves never throw; only Game.setup() may throw; unknown effects warn and continue` by not touching it.

### Category 11 — Single Responsibility & Logic Clarity

30. **Issue 25 (Overloaded Function Responsibilities) — PASS.** N/A — no functions introduced.

---

## Mandatory Governance Follow-ups

All four are scope-neutral — none change the WP allowlist, move a mutation boundary, or introduce a new contract.

- **PS-1 (pre-flight §8, BLOCKING):** EC-041 locked field count → **20** with `selection` (WP-005B) added. Re-count and re-number.
- **PS-2 (pre-flight §8, NON-BLOCKING):** WP-041 Assumes → `D-0001 through D-4004` (or equivalent current upper bound).
- **PS-3 (pre-flight §8, session-prompt guardrail):** Session prompt carries three instructions — §B is an update, not an addition; Finding 4 resolution is a clarifying sentence, not a column restructure; `activeScoringConfig` (WP-067) is out of scope.
- **PS-4 (added by this copilot check, session-prompt guardrail):** Session prompt must state **introduction order (WP-ID ascending)** as the canonical ordering for the EC Field Classification locked list, placing `selection` at position **#1** and shifting all subsequent entries by one.

No new DECISIONS.md entry is required — these are corrections to in-flight governance artifacts, not new architectural decisions. If WP-041 execution surfaces material audit findings during the consistency pass (its §D Consistency Audit scope), those will be logged to DECISIONS.md at execution time using the three permitted entry types already locked in EC-041 §Files to Produce.

No `02-CODE-CATEGORIES.md` update required — no new code directory.

No `.claude/rules/*.md` update required — rules drift is logged during execution under the three permitted DECISIONS.md entry types; rules files are not modified in this packet.

No `WORK_INDEX.md` pre-session update required — the WP-041 Done row is checked off **during** execution per standard Definition-of-Done ritual.

---

## Pre-Flight Verdict Disposition

- [ ] **CONFIRM** — Pre-flight READY TO EXECUTE verdict stands. Session prompt generation authorized.
- [x] **HOLD** — Apply PS-1 and PS-2 in-place (modify WP-041 and EC-041 as specified), re-run copilot check to confirm clean PASS, then CONFIRM. No pre-flight re-run required (scope unchanged — PS-1 corrects a count, PS-2 refreshes a precondition range, PS-3/PS-4 are session-prompt-authoring guardrails that do not alter WP or EC content).
- [ ] **SUSPEND** — Not required. No fix changes the WP allowlist, the mutation boundary (there is none), or introduces a new contract.

**Sequencing:** PS-1 and PS-2 are edits to the WP and EC files already flagged as the only in-scope deliverables of WP-041 itself — they are "cleanup of the instructions before executing the instructions." They do not count as "executing the WP"; they are pre-session governance corrections per 01.7 §Discipline ("Governance fixes … are explicitly permitted and expected as remediation"). Once PS-1 and PS-2 are applied, the user may elect either to run a lightweight copilot-check re-pass (seconds) or to proceed directly to session-prompt generation with PS-3 and PS-4 included as prompt-level guardrails.

---

## Final Note

This copilot check confirms the pre-flight's core finding: **WP-041 is doing what it was designed to do — catching governance drift — and is itself being caught by the same loop.** The EC's "Exactly 19" was wrong *in exactly the way* a certification pass should catch. The pre-flight caught it before execution; the copilot check confirms no deeper structural drift. Once PS-1 + PS-2 land, WP-041 is ready for a clean execution session.
