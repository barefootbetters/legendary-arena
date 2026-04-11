# Pre-Flight Invocation — WP-044

---

### Pre-Flight Header

**Target Work Packet:** `WP-044`
**Title:** Prompt Lint Governance Alignment
**Previous WP Status:** WP-001 Complete (Reviewed)
**Pre-Flight Date:** 2026-04-10
**Invocation Stage:** Pre-Execution (Scope & Readiness)

**Work Packet Class:** Contract-Only (types/contracts/tests only)

Required sections: Dependency Check, Structural Readiness, Scope Lock,
Test Expectations, Risk Review.
Skipped sections: Runtime Readiness Check, Mutation Boundary Confirmation.

---

### Pre-Flight Intent

Perform a pre-flight validation for WP-044.

- Not implementing.
- Not generating code.
- Validating readiness and constraints only.

If a blocking condition is found, pre-flight must return **NOT READY** and stop.

---

### Authority Chain (Must Read)

1. `.claude/CLAUDE.md` — read (EC-mode rules, bug handling, commit discipline)
2. `docs/ai/ARCHITECTURE.md` — read (layer boundaries, package import rules)
3. `.claude/rules/architecture.md` — read (Layer Boundary section, enforcement)
4. `docs/ai/execution-checklists/EC-044-lint-governance.checklist.md` — read
5. `docs/ai/work-packets/WP-044-prompt-lint-governance-alignment.md` — read
6. WP-001 (dependency) — confirmed complete in WORK_INDEX.md

No conflicts detected between authority chain documents.

---

### Dependency & Sequencing Check

| WP | Status | Notes |
|---|---|---|
| WP-001 | ✅ Complete (Reviewed) | Foundation & Coordination System. Established REFERENCE docs and coordination system. |

All prerequisites are met.

---

### Structural Readiness Check (Types & Contracts)

- [x] All prior WPs compile and tests pass (game-engine: 72 tests pass, 0 fail)
- [x] No known EC violations remain open
- [x] Required types/contracts exist:
  - `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` exists (governed version,
    16 sections, 139 checkbox items)
  - `docs/ai/ARCHITECTURE.md` exists with Package Import Rules (Section 1) and
    Package Dependency Rules (Section 5)
  - `.claude/rules/architecture.md` exists with "Layer Boundary (Authoritative)" section
  - `.claude/rules/code-style.md` exists
  - All 7 `.claude/rules/*.md` files exist: architecture, game-engine, server,
    registry, persistence, code-style, work-packets
  - `docs/ai/DECISIONS.md` exists
- [x] No naming or ownership conflicts
- [x] No architectural boundary conflicts anticipated

All structural readiness checks pass.

---

### Established Patterns to Follow (Locked Precedents)

- Subordination clauses use the format established in `.claude/rules/*.md` and
  `docs/ai/REFERENCE/01.4-pre-flight-invocation.md` (numbered list of authorities)
- Notes within checklist sections use blockquote or paragraph format, not
  checkboxes (preserving checkbox count for diff verification)
- Cross-references use relative paths and section names
- The checklist is a REFERENCE document — not a Work Packet deliverable,
  not a `.claude/rules/` file

No deviations from established patterns anticipated.

---

### Scope Lock (Critical)

#### WP-044 Is Allowed To

- **Modify:** `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`:
  - Add subordination clause to header naming ARCHITECTURE.md and `.claude/rules/*.md`
  - Add Layer Boundary reference check to §4 (Context References)
  - Add Layer Boundary authoritative note to §8 (Architectural Boundaries)
  - Add Layer Boundary violation check to §8
  - Add code style alignment note to §16 (Code Style)
- **Update:** `docs/ai/STATUS.md` — prompt lint checklist aligned with governance
- **Update:** `docs/ai/DECISIONS.md` — why checklist remains REFERENCE, not merged
- **Update:** `docs/ai/work-packets/WORK_INDEX.md` — WP-044 checked off

#### WP-044 Is Explicitly Not Allowed To

- No lint rules added, removed, or weakened
- No modifications to `.claude/rules/*.md` — those files are correct as-is
- No modifications to `docs/ai/ARCHITECTURE.md`
- No modifications to any file under `packages/` or `apps/`
- No deletion of the legacy `docs/archive prompts-legendary-area-game/00.3-prompt-lint-checklist.md`
- No TypeScript code produced
- No "while I'm here" improvements or refactoring of existing checklist items

**Rule:** Anything not explicitly allowed is out of scope.

---

### Test Expectations (Locked Before Execution)

- **New tests:** 0 — documentation-only packet
- **Existing test changes:** None expected
- **Prior test baseline:** game-engine 72 tests passing; all must continue to pass
- **Test boundaries:** No test files may be created or modified
- **Verification method:** Checkbox count in 00.3 must be >= 139 after changes
  (current count). New governance notes are added as prose, not checkboxes, to
  preserve the diff-verifiable checkbox count.

---

### Risk & Ambiguity Review (Resolve Now, Lock for Execution)

#### Risk 1: "Layer Boundary (Authoritative)" section name location

- **Risk:** WP-044 references `docs/ai/ARCHITECTURE.md — "Layer Boundary
  (Authoritative)"` in multiple places. However, the section with that exact
  heading lives in `.claude/rules/architecture.md` (line 123), not in
  `docs/ai/ARCHITECTURE.md` directly. ARCHITECTURE.md covers layer concepts
  across Section 1 (Package Boundaries, Import Rules) and Section 5 (Package
  Dependency Rules) but does not have a section titled "Layer Boundary".
- **Impact:** The execution session may reference a non-existent section header
  in ARCHITECTURE.md. Readers of the checklist would not find the named section.
- **Mitigation:** Cross-references in the checklist should use the correct
  locations:
  - For the authoritative layer boundary definition: reference both
    `docs/ai/ARCHITECTURE.md` (Section 1 "Monorepo Package Boundaries" and
    "Package Import Rules") and `.claude/rules/architecture.md` ("Layer
    Boundary (Authoritative)")
  - The `.claude/rules/architecture.md` file explicitly states it is "derived
    from and subordinate to `docs/ai/ARCHITECTURE.md`", so ARCHITECTURE.md
    remains the ultimate authority
- **Decision:** Use the wording from WP-044 but adjust the cross-reference to
  point to the actual section locations. Reference `.claude/rules/architecture.md`
  "Layer Boundary (Authoritative)" for the synthesized enforcement view, and
  `ARCHITECTURE.md` Section 1 / Section 5 for the source material.

#### Risk 2: Checkbox count preservation

- **Risk:** WP-044 adds checks to §4 and §8 (two new checkbox items). The
  acceptance criteria say "no existing checklist items were removed or weakened
  (confirmed by diffing line counts of checkboxes)". Adding new checkboxes is
  expected and allowed — the count must be >= 139, not == 139.
- **Impact:** None if understood correctly. The verification step counts checkboxes
  and expects the count to be >= current.
- **Mitigation:** The execution session should record the before/after checkbox
  count explicitly.
- **Decision:** New checkbox items in §4 and §8 are allowed per WP-044 scope.
  Governance notes in §8 and §16 are prose, not checkboxes.

#### Risk 3: Legacy 00.3 archive path

- **Risk:** WP-044 references `docs/prompts-legendary-area-game/00.3-prompt-lint-checklist.md`
  but the legacy files are archived at `docs/archive prompts-legendary-area-game/`.
- **Impact:** Minimal — the legacy file is not modified. The only reference is
  in the WP-044 context section noting it is superseded.
- **Mitigation:** Use the correct archive path if referencing the legacy file.
- **Decision:** Legacy file is at
  `docs/archive prompts-legendary-area-game/00.3-prompt-lint-checklist.md`.
  It is not modified or deleted.

All risks have mitigations. No blocking issues.

---

### Pre-Flight Verdict (Binary)

**✅ READY TO EXECUTE**

WP-044 is properly sequenced — its sole dependency (WP-001) is complete. The
scope is cleanly bounded: governance alignment additions to a single reference
document plus routine governance doc updates. All prerequisite files exist
(00.3, ARCHITECTURE.md, all 7 `.claude/rules/*.md` files). The one
cross-reference ambiguity (Layer Boundary section location) is resolved above
with clear guidance for the execution session. No lint rules are added,
removed, or weakened — only subordination and cross-reference notes.

---

### Authorized Next Step

> You are authorized to generate a **session execution prompt** for WP-044
> to be saved as:
> `docs/ai/invocations/session-wp044-lint-governance.md`

**Guard:** The session prompt **must conform exactly** to the scope, constraints,
and decisions locked by this pre-flight. No new scope may be introduced.

If the verdict is **DO NOT EXECUTE YET**, stop. Do not generate a session
prompt.

---

### Final Instruction

Pre-flight exists to **prevent premature execution and scope drift**.

If there is uncertainty, missing context, or unresolved ambiguity:

**DO NOT PROCEED TO EXECUTION.**

Escalate, clarify, or split the WP instead.
