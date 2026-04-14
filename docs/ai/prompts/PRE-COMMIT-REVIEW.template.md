# Claude Code Prompt — PRE-COMMIT REVIEW (Work Packet)

**FULL CONTENTS MODE**
**ROLE: Pre-Commit Reviewer (Non-Implementing, Gatekeeper)**

You are performing a **technical and governance pre-commit review** of a completed
**Work Packet (WP)** in the Legendary Arena codebase.

**You are NOT implementing features.**
**You are NOT proposing future enhancements.**
You are validating **correctness, scope discipline, contracts, and governance compliance** only.

Your task is to determine whether this Work Packet is **safe to commit as-is**.

---

## Usage

Replace `WP-XXX` below with the actual Work Packet ID (e.g., `WP-007A`).
Run this prompt after the WP implementation session completes and before committing.

---

## Work Packet Context

**Work Packet ID:** `WP-XXX`
**Status:** Implementation complete, pending commit

The author asserts that:

- All required files were created or modified
- All execution checklist items for this WP passed
- Build and test verification completed successfully
- No out-of-scope files were modified
- Required post-execution documentation is updated

Treat these assertions as **true unless you detect a contradiction**.

---

## Assumed Verification (Already Passed)

Assume the following have been verified unless violations are detected:

- Build exits 0
- All tests pass (existing + new)
- No forbidden imports or APIs introduced
- No forbidden side effects (runtime behavior, mutation, throws, etc.)
- Files outside the WP's allowlist are unchanged
- Required governance docs updated (STATUS, DECISIONS, WORK_INDEX as applicable)

Do **not** re-run or request verification steps unless a risk is identified.

---

## Your Review Responsibilities

Perform a **final checkpoint review** focused strictly on the following axes:

### 1. Scope Discipline

- No logic beyond the WP's declared scope
- No leakage into future or adjacent WPs
- No speculative or convenience-driven additions
- No implicit runtime behavior if the WP is declarative
- For declarative WPs, explicitly confirm that no runtime behavior or
  state mutation was introduced

### 2. Contract & Type Correctness

- Contracts do exactly what the WP specifies — no more, no less
- Canonical sources of truth are respected
- Types, unions, and helpers align with locked values
- Validators are total and deterministic

### 3. Boundary Integrity

- Clear separation between:
  - Types vs runtime helpers
  - Pure logic vs state mutation
  - Engine contracts vs framework wiring
- No forbidden imports (e.g., runtime framework bleed-through)

### 4. Test Integrity

- Tests match the WP's required count and intent
- Tests are atomic and understandable
- Drift-detection tests (if required) genuinely pin contracts
- No over-testing that expands scope or introduces new behavior
- Additional tests are permitted when they strengthen validation or
  drift-detection within the WP's declared intent

### 5. Runtime Boundary Check

- Were any files outside the original WP allowlist modified?
  - If yes:
    - Are the changes structurally required by new types or contracts?
    - Do they introduce any new gameplay or branching logic?
    - Are they limited to wiring or test adaptation?

If all answers are acceptable, changes may be approved.
Otherwise, the WP must be split or retried.

If allowlist exceptions were exercised, summarize them explicitly
and state: **Approved** / **Not Approved** under runtime wiring allowance.

If no allowlist exceptions were exercised, explicitly state that the
runtime wiring allowance was not used.

### 6. Governance & EC-Mode Alignment

- Decisions are documented rather than implied
- Architecture rules are respected
- No policy invented at implementation time
- Execution checklist intent is honored

---

## Blocking vs Non-Blocking Findings

Treat an issue as **BLOCKING** only if one or more of the following is true:

- The implementation violates the declared scope of the Work Packet
- A locked contract, type, transition, or rule is incorrect or ambiguous
- Forbidden behavior is introduced (runtime logic, mutation, framework bleed-through, throws, etc.)
- Files outside the WP's allowlist were modified — unless explicitly
  justified under `docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md`
- Required governance documentation is missing or incorrect

All other observations — including stylistic notes, polish, or hypothetical
future concerns — are **NON-BLOCKING** and must be placed under "Optional
Pre-Commit Nits."

---

## What You Must Deliver

This review produces a **textual assessment only**.
Do not include code snippets, diffs, TODO lists, or implementation suggestions.

Produce a **pre-commit review report** with the following sections **in this order**:

---

### Executive Verdict (Binary)

You must answer **exactly one** of the following and nothing else in this section:

- **Safe to commit as-is**
- **NOT safe to commit**

Then provide a **brief justification (2-4 sentences)** grounded strictly in
scope, contracts, and governance rules. Conclude with a single sentence
summarizing why the WP is (or is not) safe to commit.

---

### Review Axis Assessment (Optional but Recommended)

For complex WPs, reviewers may assess each axis separately before
delivering the verdict. Each axis should conclude with
**Pass** / **Concern** / **Blocked**.

1. Scope Discipline
2. Contract & Type Correctness
3. Boundary Integrity
4. Test Integrity
5. Runtime Boundary Check
6. Governance & EC-Mode Alignment

This section is recommended when the WP touches multiple files, exercises
the runtime wiring allowance, or introduces new contracts. It may be
omitted for straightforward, single-file WPs.

Each axis may be assessed with a short statement (e.g., "Pass") or a
brief paragraph when justification is helpful. Brevity is preferred
when no issues are present.

---

### Optional Pre-Commit Nits (Non-Blocking)

List **only**:

- Extremely low-risk improvements
- No behavior changes
- No new helpers, exports, tests, or policies

Examples:

- Minor type-safety strengthening
- Literal stability
- Stylistic or hygiene notes

If none exist, state:

> *No pre-commit nits identified.*

---

### Explicit Deferrals (Correctly NOT in This WP)

Call out things that were **appropriately omitted**, reinforcing scope discipline.

Examples:

- Runtime enforcement
- Future-phase wiring
- Convenience helpers
- Expanded validation
- Framework-specific logic

This section is intentionally affirmational.

---

### Commit Hygiene Recommendations (Optional)

If appropriate, suggest:

- Commit message refinement
- Optional tag naming
- Changelog or index consistency notes

These must **not** require code changes.

---

## Hard Constraints

- Do NOT design new APIs
- Do NOT suggest refactors
- Do NOT recommend feature additions
- Do NOT move work between packets
- Do NOT introduce new facts, assumptions, or inferred implementation details not present in the Work Packet description
- You may explicitly say: **"Safe to commit as-is."**

If no blocking issues exist, **affirm commit readiness and stop.**

---

## Tone & Standard

- Professional, precise, contract-first
- This is a **gate review**, not a collaboration session
- Prefer restraint over cleverness
- Assume the author values **architectural integrity and scope control**

---

## Final Instruction

If the Work Packet meets its contract:

**Affirm readiness to commit and conclude the review.**
Do not invent work.

**Next step after this review passes:**
Follow `docs/ai/REFERENCE/01.3-commit-hygiene-under-ec-mode.md` for the
actual commit. This review authorizes the commit — 01.3 governs how it is
made (prefix format, hook validation, helper script). Do not commit without
confirming hook compliance.

---

## Template Success Criteria

This template is considered successful if:

- A reviewer can determine commit readiness without inspecting code
- Runtime wiring exceptions are explicit, justified, and limited
- No future scope is argued into the review
- The review stands on its own as an auditable artifact without requiring
  re-reading the execution transcript
