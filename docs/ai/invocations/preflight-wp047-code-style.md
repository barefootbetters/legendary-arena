# Pre-Flight Invocation — WP-047

---

### Pre-Flight Header

**Target Work Packet:** `WP-047`
**Title:** Code Style Reference Governance Alignment
**Previous WP Status:** WP-046 Complete (2026-04-10)
**Pre-Flight Date:** 2026-04-10
**Invocation Stage:** Pre-Execution (Scope & Readiness)

**Work Packet Class:** Contract-Only (documentation only — no TypeScript)

Required sections: Dependency Check, Structural Readiness, Scope Lock,
Test Expectations, Risk Review.
Skipped sections: Runtime Readiness Check, Mutation Boundary Confirmation.

---

### Pre-Flight Intent

Perform a pre-flight validation for WP-047.

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
4. `.claude/rules/code-style.md` — read (runtime enforcement companion — the
   enforcement counterpart to the REFERENCE document being updated)
5. `docs/ai/execution-checklists/EC-047-code-style.checklist.md` — read
6. `docs/ai/work-packets/WP-047-code-style-governance-alignment.md` — read
7. WP-001 (dependency) — confirmed complete in WORK_INDEX.md

No conflicts detected between authority chain documents.

---

### Dependency & Sequencing Check

| WP | Status | Notes |
|---|---|---|
| WP-001 | ✅ Complete (Reviewed) | Foundation & Coordination System. Established REFERENCE docs and coordination system. |

All prerequisites are met. WP-047 depends only on WP-001 (unlike WP-044/045/046
which formed a chain). No sequencing issues.

---

### Structural Readiness Check (Types & Contracts)

- [x] All prior WPs compile and tests pass (game-engine: 89 tests pass, 0 fail)
- [x] No known EC violations remain open
- [x] Required types/contracts exist:
  - `docs/ai/REFERENCE/00.6-code-style.md` exists (governed version,
    504 lines, 15 `## Rule` sections, 18 `§16.*` enforcement mapping entries,
    3 `DECISIONS.md` references, change policy present)
  - `docs/ai/ARCHITECTURE.md` exists with Layer Boundary section
  - `.claude/rules/code-style.md` exists (runtime enforcement companion)
  - `.claude/rules/architecture.md` exists with "Layer Boundary (Authoritative)"
    section
  - All 7 `.claude/rules/*.md` files exist
  - `.claude/CLAUDE.md` exists with Lint Gate section
  - `docs/ai/DECISIONS.md` exists (includes D-1401, D-1402, D-1403)
- [x] No naming or ownership conflicts
- [x] No architectural boundary conflicts anticipated

**Note:** The 00.6 document currently has **no subordination clause** and
**no "subordinate"** text anywhere. This is expected — WP-047 adds it.

All structural readiness checks pass.

---

### Established Patterns to Follow (Locked Precedents)

- Subordination clauses use the blockquote format established in WP-044's
  changes to 00.3 and reinforced by WP-045's changes to 00.4 and WP-046's
  changes to 00.5
- Governance notes use blockquote or paragraph format, not checkboxes
  (preserving the document's existing structure)
- Cross-references use relative paths and section names
- The document is a REFERENCE document — not a Work Packet deliverable,
  not a `.claude/rules/` file
- Unlike WP-044/045/046, this WP does not add a Layer Boundary note or
  Execution Gate section — 00.6 is a code style standard, not a Foundation
  Prompt prerequisite or execution gate
- The existing header is a blockquote that will be **replaced** (not appended
  to) per the WP scope — this is different from WP-044/045/046 which appended
  to existing blockquotes

No deviations from established patterns anticipated.

---

### Scope Lock (Critical)

#### WP-047 Is Allowed To

- **Modify:** `docs/ai/REFERENCE/00.6-code-style.md`:
  - Replace existing header blockquote with Authority & Scope section
  - Include subordination clause naming ARCHITECTURE.md and
    `.claude/rules/code-style.md`
  - Include statement that style rules never override architecture or
    layer boundaries
  - Document the three complementary code-style artifacts (00.6, rules/
    code-style.md, 00.3 §16)
  - Preserve scope statement, enforcement mapping reference, and change policy
- **Update:** `docs/ai/STATUS.md` — code style reference aligned with governance
- **Update:** `docs/ai/DECISIONS.md` — why REFERENCE is descriptive (with
  examples) while `.claude/rules/code-style.md` is enforcement (distilled
  constraints); why both exist and neither is redundant
- **Update:** `docs/ai/work-packets/WORK_INDEX.md` — WP-047 checked off

#### WP-047 Is Explicitly Not Allowed To

- No code style rules added, removed, or weakened (Rules 1-15 preserved)
- No code examples modified
- No enforcement mapping table modified
- No modifications to `.claude/rules/code-style.md` — already aligned
- No modifications to `docs/ai/ARCHITECTURE.md`
- No modifications to `00.3-prompt-lint-checklist.md` — that was WP-044
- No modifications to any file under `packages/` or `apps/`
- No TypeScript code produced
- No "while I'm here" improvements or refactoring of existing rules

**Rule:** Anything not explicitly allowed is out of scope.

---

### Test Expectations (Locked Before Execution)

- **New tests:** 0 — documentation-only packet
- **Existing test changes:** None expected
- **Prior test baseline:** game-engine 89 tests passing; all must continue to pass
- **Test boundaries:** No test files may be created or modified
- **Verification method:** `git diff --name-only` confirms only allowlisted
  files changed

---

### Risk & Ambiguity Review (Resolve Now, Lock for Execution)

#### Risk 1: Header replacement vs header append

- **Risk:** WP-044/045/046 appended governance text to existing blockquotes.
  WP-047 **replaces** the existing header blockquote entirely. The replacement
  must preserve the existing content semantics (scope, enforcement mapping
  reference, change policy) while adding the new governance declarations.
- **Impact:** If the replacement drops existing content (scope statement,
  enforcement mapping cross-reference, change policy), the document loses
  important information.
- **Mitigation:** The WP-047 replacement text in the WP's Scope section
  explicitly includes all three: scope ("Defines code style rules..."),
  enforcement mapping cross-reference ("Three code-style artifacts exist"),
  and change policy ("Any modification to these rules requires a new entry in
  DECISIONS.md"). Verify all three are present in the replacement text before
  applying.
- **Decision:** Use the exact replacement text from WP-047 Scope section.
  This decision is locked.

#### Risk 2: Subordination target differs from WP-044/045/046

- **Risk:** WP-044/045/046 declared subordination to `ARCHITECTURE.md` and
  `.claude/rules/*.md` (wildcard). WP-047 declares subordination to
  `ARCHITECTURE.md` and `.claude/rules/code-style.md` (specific file). This is
  intentional — 00.6 is the code style standard, and its enforcement counterpart
  is specifically `code-style.md`, not the entire rules directory.
- **Impact:** No negative impact — the specificity is correct and matches the
  document's purpose.
- **Mitigation:** The replacement text also includes the generic override
  statement: "If a style rule conflicts with ARCHITECTURE.md or
  `.claude/rules/*.md`, the higher-authority document wins." This covers the
  full rules directory for conflict resolution while naming the specific
  enforcement companion.
- **Decision:** Use `.claude/rules/code-style.md` (specific) for subordination,
  `.claude/rules/*.md` (wildcard) for the conflict resolution statement. This
  decision is locked.

#### Risk 3: No Layer Boundary note or Execution Gate

- **Risk:** WP-044/045/046 each added a Layer Boundary note and/or Execution
  Gate section. WP-047 does not — 00.6 is a code style standard, not a
  Foundation Prompt prerequisite or execution gate. A reviewer might expect
  these sections by pattern.
- **Impact:** None — the omission is correct. Code style is cross-cutting and
  does not belong to a specific layer. It is not part of the Foundation Prompt
  sequence.
- **Mitigation:** The scope statement in the replacement header explicitly says:
  "Does not define architecture, layer boundaries, persistence rules, or game
  logic." This clarifies the document's role.
- **Decision:** No Layer Boundary note or Execution Gate section. The scope
  statement handles the distinction. This decision is locked.

#### Risk 4: DECISIONS.md entry content

- **Risk:** The WP requires a DECISIONS.md entry explaining why the REFERENCE
  document (descriptive with examples) and `.claude/rules/code-style.md`
  (enforcement) both exist and are not redundant.
- **Impact:** If the rationale is not clear, future sessions might attempt to
  merge or deduplicate the two files.
- **Mitigation:** The decision entry must explain: 00.6 is the authoritative
  style standard with examples, rationale, and enforcement mapping — it serves
  as the human-readable reference and the source of truth for style decisions.
  `.claude/rules/code-style.md` distills these rules into enforceable constraints
  that Claude Code loads automatically during execution. 00.3 §16 checks WP
  output against these rules before execution. The three artifacts serve
  different audiences at different times. This parallels the REFERENCE vs rules
  distinction in D-1401/D-1402/D-1403.
- **Decision:** Include the three-artifact rationale in the DECISIONS.md entry.
  This decision is locked.

All risks have mitigations. No blocking issues.

---

### Pre-Flight Verdict (Binary)

**✅ READY TO EXECUTE**

WP-047 is properly sequenced — its sole dependency (WP-001) is complete. The
scope is cleanly bounded: a header replacement on a single reference document
plus routine governance doc updates. All prerequisite files exist (00.6 with
504 lines and 15 rules, ARCHITECTURE.md, `.claude/rules/code-style.md`,
DECISIONS.md with D-1401/D-1402/D-1403). The header replacement preserves all
existing content semantics (scope, enforcement mapping reference, change policy)
while adding subordination and three-artifact documentation. The subordination
target correctly names `.claude/rules/code-style.md` (specific) rather than the
wildcard, matching the document's purpose. No Layer Boundary note or Execution
Gate is needed — 00.6 is cross-cutting, not layer-specific or a Foundation
Prompt gate. No code style rules are added, removed, or weakened.

---

### Authorized Next Step

> You are authorized to generate a **session execution prompt** for WP-047
> to be saved as:
> `docs/ai/invocations/session-wp047-code-style.md`

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
