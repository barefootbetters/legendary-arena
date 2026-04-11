# Pre-Flight Invocation — WP-045

---

### Pre-Flight Header

**Target Work Packet:** `WP-045`
**Title:** Connection Health Check Governance Alignment
**Previous WP Status:** WP-044 Complete (2026-04-10)
**Pre-Flight Date:** 2026-04-10
**Invocation Stage:** Pre-Execution (Scope & Readiness)

**Work Packet Class:** Contract-Only (types/contracts/tests only)

Required sections: Dependency Check, Structural Readiness, Scope Lock,
Test Expectations, Risk Review.
Skipped sections: Runtime Readiness Check, Mutation Boundary Confirmation.

---

### Pre-Flight Intent

Perform a pre-flight validation for WP-045.

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
4. `.claude/rules/server.md` — read (server-layer governance — health check
   scripts are server/ops layer tooling)
5. `docs/ai/execution-checklists/EC-045-connection-health.checklist.md` — read
6. `docs/ai/work-packets/WP-045-connection-health-governance-alignment.md` — read
7. WP-001 (dependency) — confirmed complete in WORK_INDEX.md

No conflicts detected between authority chain documents.

---

### Dependency & Sequencing Check

| WP | Status | Notes |
|---|---|---|
| WP-001 | ✅ Complete (Reviewed) | Foundation & Coordination System. Established REFERENCE docs and coordination system. |

All prerequisites are met.

---

### Structural Readiness Check (Types & Contracts)

- [x] All prior WPs compile and tests pass (game-engine: 89 tests pass, 0 fail)
- [x] No known EC violations remain open
- [x] Required types/contracts exist:
  - `docs/ai/REFERENCE/00.4-connection-health-check.md` exists (governed version,
    18 `##` sections, full execution prompt producing two scripts + `.env.example`)
  - `docs/ai/ARCHITECTURE.md` exists with Section 1 ("Monorepo Package
    Boundaries", "Package Import Rules") and Section 5 ("Package Dependency Rules")
  - `.claude/rules/architecture.md` exists with "Layer Boundary (Authoritative)"
    section (line 123)
  - `.claude/rules/server.md` exists (server-layer governance)
  - All 7 `.claude/rules/*.md` files exist
  - `.claude/CLAUDE.md` exists with Lint Gate section (line 69)
  - `docs/ai/DECISIONS.md` exists
- [x] No naming or ownership conflicts
- [x] No architectural boundary conflicts anticipated

**Note:** The 00.4 document currently has **no subordination clause** and
**no "subordinate"** text anywhere. This is expected — WP-045 adds it.

All structural readiness checks pass.

---

### Established Patterns to Follow (Locked Precedents)

- Subordination clauses use the blockquote format established in WP-044's
  changes to 00.3 and in `.claude/rules/*.md` files
- Governance notes use blockquote or paragraph format, not checkboxes
  (preserving the document's existing structure)
- Cross-references use relative paths and section names
- The document is a REFERENCE document — not a Work Packet deliverable,
  not a `.claude/rules/` file
- The Layer Boundary cross-reference pattern from WP-044 pre-flight is
  reused: cite `.claude/rules/architecture.md` "Layer Boundary
  (Authoritative)" for the synthesized enforcement view and
  `ARCHITECTURE.md` Section 1 / Section 5 for the source material

No deviations from established patterns anticipated.

---

### Scope Lock (Critical)

#### WP-045 Is Allowed To

- **Modify:** `docs/ai/REFERENCE/00.4-connection-health-check.md`:
  - Add subordination clause to header naming ARCHITECTURE.md and
    `.claude/rules/*.md`
  - Add note distinguishing health check (Foundation Prompt prerequisite)
    from Lint Gate (per-WP gate)
  - Add Layer Boundary note identifying document as server/ops layer tooling
  - Add reference to `.claude/rules/server.md` for script governance
  - Add explicit stop-on-failure execution gate section
- **Update:** `docs/ai/STATUS.md` — connection health check aligned with
  governance layer
- **Update:** `docs/ai/DECISIONS.md` — why health check remains REFERENCE;
  distinction between health check gate (Foundation Prompts) and Lint Gate
  (Work Packets)
- **Update:** `docs/ai/work-packets/WORK_INDEX.md` — WP-045 checked off

#### WP-045 Is Explicitly Not Allowed To

- No health checks added, removed, or weakened
- No modifications to `scripts/check-connections.mjs` or `scripts/Check-Env.ps1`
- No modifications to `.env.example`
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

#### Risk 1: "Layer Boundary" section location (inherited from WP-044)

- **Risk:** WP-045 references `docs/ai/ARCHITECTURE.md — "Layer Boundary
  (Authoritative)"` in the Context section. However, as established in the
  WP-044 pre-flight, that exact heading lives in `.claude/rules/architecture.md`
  (line 123), not in `docs/ai/ARCHITECTURE.md` directly.
- **Impact:** Same as WP-044 — readers could look for the named section in the
  wrong document.
- **Mitigation:** Reuse the locked decision from WP-044 pre-flight:
  - For the authoritative layer boundary definition: reference both
    `docs/ai/ARCHITECTURE.md` (Section 1 and Section 5) and
    `.claude/rules/architecture.md` ("Layer Boundary (Authoritative)")
  - `.claude/rules/architecture.md` is derived from and subordinate to
    `docs/ai/ARCHITECTURE.md`, so ARCHITECTURE.md remains the ultimate authority
- **Decision:** Use the same cross-reference pattern established in WP-044.
  This decision is locked.

#### Risk 2: Existing document structure preservation

- **Risk:** The 00.4 document is a full execution prompt (28KB, 18 `##` sections)
  with scripts, deliverables, and acceptance criteria. Adding governance notes
  must not disrupt the existing content.
- **Impact:** If governance additions break the document structure, it becomes
  harder to use as an execution prompt if the Foundation Prompt ever needs to
  be re-run.
- **Mitigation:** Add the subordination clause to the existing header blockquote.
  Add the Layer Boundary note as a new paragraph after the header. Add the
  Execution Gate as a new `##` section at the end, before Definition of Done
  (or after Hard Constraints). Do not modify any existing section content.
- **Decision:** Governance additions are appended/inserted; existing content is
  not modified. The section count will increase by 1 (new Execution Gate section).

#### Risk 3: Health check vs Lint Gate confusion

- **Risk:** EC-045 locked value states "Health check is a Foundation Prompt
  prerequisite, NOT a per-WP gate." The `.claude/CLAUDE.md` Lint Gate section
  describes the per-WP gate. If the health check governance notes are not
  explicit about this distinction, future sessions may confuse the two gates.
- **Impact:** A session might skip health checks thinking the Lint Gate covers
  them, or run health checks per-WP when they only need to run once.
- **Mitigation:** The subordination clause must explicitly name both gates and
  their distinct roles:
  - Health check: Foundation Prompt prerequisite (runs once before WP execution)
  - Lint Gate (00.3): per-WP quality gate (runs before each WP)
- **Decision:** Include the distinction in the subordination clause text as
  specified in WP-045 Scope.

All risks have mitigations. No blocking issues.

---

### Pre-Flight Verdict (Binary)

**✅ READY TO EXECUTE**

WP-045 is properly sequenced — its sole dependency (WP-001) is complete. The
scope is cleanly bounded: governance alignment additions to a single reference
document plus routine governance doc updates. All prerequisite files exist
(00.4, ARCHITECTURE.md, all 7 `.claude/rules/*.md` files, CLAUDE.md with Lint
Gate section). The Layer Boundary cross-reference ambiguity is resolved by
reusing the locked decision from WP-044 pre-flight. The health check vs Lint
Gate distinction is clearly defined in the WP scope text. No health checks are
added, removed, or weakened — only subordination, Layer Boundary, and
stop-on-failure notes.

---

### Authorized Next Step

> You are authorized to generate a **session execution prompt** for WP-045
> to be saved as:
> `docs/ai/invocations/session-wp045-connection-health.md`

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
