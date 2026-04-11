# Pre-Flight Invocation — WP-046

---

### Pre-Flight Header

**Target Work Packet:** `WP-046`
**Title:** R2 Validation Governance Alignment
**Previous WP Status:** WP-045 Complete (2026-04-10)
**Pre-Flight Date:** 2026-04-10
**Invocation Stage:** Pre-Execution (Scope & Readiness)

**Work Packet Class:** Contract-Only (documentation only — no TypeScript)

Required sections: Dependency Check, Structural Readiness, Scope Lock,
Test Expectations, Risk Review.
Skipped sections: Runtime Readiness Check, Mutation Boundary Confirmation.

---

### Pre-Flight Intent

Perform a pre-flight validation for WP-046.

- Not implementing.
- Not generating code.
- Validating readiness and constraints only.

If a blocking condition is found, pre-flight must return **NOT READY** and stop.

---

### Authority Chain (Must Read)

1. `.claude/CLAUDE.md` — read (EC-mode rules, Lint Gate section, bug handling,
   commit discipline)
2. `docs/ai/ARCHITECTURE.md` — read (layer boundaries, package import rules)
3. `.claude/rules/architecture.md` — read (Layer Boundary section, enforcement)
4. `.claude/rules/registry.md` — read (registry-layer governance — R2 validation
   validates the same data the registry loads)
5. `docs/ai/execution-checklists/EC-046-r2-validation.checklist.md` — read
6. `docs/ai/work-packets/WP-046-r2-validation-governance-alignment.md` — read
7. WP-001 (dependency) — confirmed complete in WORK_INDEX.md
8. WP-045 (dependency) — confirmed complete in WORK_INDEX.md (2026-04-10)

No conflicts detected between authority chain documents.

---

### Dependency & Sequencing Check

| WP | Status | Notes |
|---|---|---|
| WP-001 | ✅ Complete (Reviewed) | Foundation & Coordination System. Established REFERENCE docs and coordination system. |
| WP-045 | ✅ Complete (2026-04-10) | Connection Health Check Governance Alignment. 00.4 aligned with governance layer. |

All prerequisites are met.

---

### Structural Readiness Check (Types & Contracts)

- [x] All prior WPs compile and tests pass (game-engine: 89 tests pass, 0 fail)
- [x] No known EC violations remain open
- [x] Required types/contracts exist:
  - `docs/ai/REFERENCE/00.5-validation.md` exists (governed version,
    14 `##` sections, full execution prompt producing `scripts/validate-r2.mjs`
    + `package.json` script entry)
  - `docs/ai/ARCHITECTURE.md` exists with Section 1 ("Monorepo Package
    Boundaries", "Package Import Rules") and Section 5 ("Package Dependency Rules")
  - `.claude/rules/architecture.md` exists with "Layer Boundary (Authoritative)"
    section (line 123)
  - `.claude/rules/registry.md` exists (registry-layer governance)
  - All 7 `.claude/rules/*.md` files exist
  - `.claude/CLAUDE.md` exists with Lint Gate section (line 69)
  - `docs/ai/DECISIONS.md` exists (includes D-1401 and D-1402)
- [x] No naming or ownership conflicts
- [x] No architectural boundary conflicts anticipated

**Note:** The 00.5 document currently has **no subordination clause** and
**no "subordinate"** text anywhere. This is expected — WP-046 adds it.

All structural readiness checks pass.

---

### Established Patterns to Follow (Locked Precedents)

- Subordination clauses use the blockquote format established in WP-044's
  changes to 00.3 and reinforced by WP-045's changes to 00.4
- Governance notes use blockquote or paragraph format, not checkboxes
  (preserving the document's existing structure)
- Cross-references use relative paths and section names
- The document is a REFERENCE document — not a Work Packet deliverable,
  not a `.claude/rules/` file
- The Layer Boundary cross-reference pattern from WP-044/WP-045 is reused:
  cite `.claude/rules/architecture.md` "Layer Boundary (Authoritative)"
  for the synthesized enforcement view and `ARCHITECTURE.md` Section 1 /
  Section 5 for the source material
- The "health check vs Lint Gate" distinction pattern from WP-045 is reused
  for the "R2 validation vs Lint Gate" distinction
- The Execution Gate section pattern from WP-045 (explicit stop-on-failure
  with named Foundation Prompts) is reused

No deviations from established patterns anticipated.

---

### Scope Lock (Critical)

#### WP-046 Is Allowed To

- **Modify:** `docs/ai/REFERENCE/00.5-validation.md`:
  - Add subordination clause to header naming ARCHITECTURE.md and
    `.claude/rules/*.md`
  - Add note distinguishing R2 validation (Foundation Prompt prerequisite)
    from Lint Gate (per-WP gate)
  - Add Layer Boundary note identifying document as registry/data-layer
    validation
  - Add reference to `.claude/rules/registry.md` for data shape conventions
  - Add cross-reference to WP-042 distinguishing reusable preflight script
    from operational deployment checklists
  - Add explicit stop-on-failure execution gate section
- **Update:** `docs/ai/STATUS.md` — R2 validation gate aligned with
  governance layer
- **Update:** `docs/ai/DECISIONS.md` — why validation gate remains REFERENCE;
  distinction from WP-042; position in Foundation Prompts sequence
- **Update:** `docs/ai/work-packets/WORK_INDEX.md` — WP-046 checked off

#### WP-046 Is Explicitly Not Allowed To

- No validation checks added, removed, or weakened
- No modifications to `scripts/validate-r2.mjs`
- No modifications to `packages/registry/`
- No modifications to `.claude/rules/*.md`
- No modifications to `docs/ai/ARCHITECTURE.md`
- No modifications to any file under `packages/` or `apps/`
- No TypeScript code produced
- No "while I'm here" improvements or refactoring of existing document content

**Rule:** Anything not explicitly allowed is out of scope.

---

### Test Expectations (Locked Before Execution)

- **New tests:** 0 — documentation-only packet
- **Existing test changes:** None expected
- **Prior test baseline:** game-engine 89 tests passing; all must continue to pass
- **Test boundaries:** No test files may be created or modified
- **Verification method:** `git diff --name-only` confirms only allowlisted
  files changed; `git diff --name-only scripts/` confirms no scripts modified

---

### Risk & Ambiguity Review (Resolve Now, Lock for Execution)

#### Risk 1: "Layer Boundary" section location (inherited from WP-044/WP-045)

- **Risk:** The same cross-reference ambiguity from WP-044 and WP-045 applies:
  the "Layer Boundary (Authoritative)" heading lives in
  `.claude/rules/architecture.md` (line 123), not in `docs/ai/ARCHITECTURE.md`.
- **Impact:** Readers could look for the named section in the wrong document.
- **Mitigation:** Reuse the locked decision from WP-044/WP-045 pre-flights:
  reference both `docs/ai/ARCHITECTURE.md` (Section 1 and Section 5) and
  `.claude/rules/architecture.md` ("Layer Boundary (Authoritative)").
- **Decision:** Use the same cross-reference pattern. This decision is locked.

#### Risk 2: Existing document structure preservation

- **Risk:** The 00.5 document is a full execution prompt (14 `##` sections)
  with four validation phases, scripts, deliverables, and acceptance criteria.
  Adding governance notes must not disrupt existing content.
- **Impact:** If governance additions break the document structure, it becomes
  harder to use as an execution prompt if the Foundation Prompt ever needs to
  be re-run.
- **Mitigation:** Add the subordination clause to the existing header blockquote.
  Add the Layer Boundary note as a new blockquote after the header. Add the
  WP-042 distinction as a note. Add the Execution Gate as a new `##` section
  at the end. Do not modify any existing section content.
- **Decision:** Governance additions are appended/inserted; existing content is
  not modified. The section count will increase by 1 (new Execution Gate section):
  14 → 15.

#### Risk 3: R2 validation vs Lint Gate confusion

- **Risk:** Same pattern as WP-045 Risk 3. If the governance notes are not
  explicit about the distinction between R2 validation (Foundation Prompt gate)
  and Lint Gate (per-WP gate), future sessions may confuse the two.
- **Impact:** A session might skip R2 validation or run it per-WP when it only
  needs to run once.
- **Mitigation:** The subordination clause must explicitly name both gates and
  their distinct roles, following the exact pattern from WP-045.
- **Decision:** Include the distinction in the subordination clause text as
  specified in WP-046 Scope. This parallels D-1402.

#### Risk 4: Layer classification difference from WP-045

- **Risk:** WP-045 classified 00.4 as server/ops layer tooling. WP-046 classifies
  00.5 as registry/data-layer validation. The layer attribution must reference
  the correct `.claude/rules/` file: `registry.md` for 00.5, not `server.md`.
- **Impact:** If the wrong rules file is referenced, future governance
  cross-references would be misleading.
- **Mitigation:** The Layer Boundary note must reference `.claude/rules/registry.md`
  (not `server.md`). The 00.5 script validates R2 card data — the same data the
  registry package loads. Although the script lives in `scripts/` (outside
  `packages/registry/`), its concern is data validation, not server wiring.
- **Decision:** Reference `.claude/rules/registry.md` for data shape conventions.
  This decision is locked.

#### Risk 5: Warnings vs errors distinction

- **Risk:** WP-046 and EC-046 require an explicit distinction between warnings
  (do not block execution) and errors (block execution). WP-045 had no such
  distinction — all health check failures blocked. The Execution Gate section
  for 00.5 must include this nuance.
- **Impact:** Without the distinction, a session might treat warnings as blocking
  (overly conservative) or errors as non-blocking (dangerous).
- **Mitigation:** The Execution Gate section must state: "Warnings alone do not
  block execution. Errors do." This matches the 00.5 document's existing exit
  code semantics (exit 0 on warnings-only, exit 1 on errors).
- **Decision:** Include the warnings/errors distinction in the Execution Gate.
  This decision is locked.

All risks have mitigations. No blocking issues.

---

### Pre-Flight Verdict (Binary)

**✅ READY TO EXECUTE**

WP-046 is properly sequenced — both dependencies (WP-001 and WP-045) are
complete. The scope is cleanly bounded: governance alignment additions to a
single reference document plus routine governance doc updates. All prerequisite
files exist (00.5, ARCHITECTURE.md, all 7 `.claude/rules/*.md` files, CLAUDE.md
with Lint Gate section, DECISIONS.md with D-1402). The Layer Boundary
cross-reference ambiguity is resolved by reusing the locked decision from
WP-044/WP-045. The R2 validation vs Lint Gate distinction follows the same
pattern established by D-1402. The layer classification correctly attributes
00.5 to registry/data layer (referencing `registry.md`, not `server.md`). The
warnings vs errors distinction is locked and matches the existing exit code
semantics in the 00.5 document. No validation checks are added, removed, or
weakened.

---

### Authorized Next Step

> You are authorized to generate a **session execution prompt** for WP-046
> to be saved as:
> `docs/ai/invocations/session-wp046-r2-validation.md`

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
