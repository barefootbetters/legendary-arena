# EC-047 — Code Style Reference Governance Alignment (Execution Checklist)

**Source:** docs/ai/work-packets/WP-047-code-style-governance-alignment.md
**Layer:** Coordination / Reference Document (Documentation)

**Execution Authority:**
This EC is the authoritative execution checklist for WP-047.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-047.

---

## Before Starting

- [ ] WP-001 complete: coordination system and REFERENCE docs established
- [ ] `docs/ai/REFERENCE/00.6-code-style.md` exists (governed version, 15 rules)
- [ ] `docs/ai/ARCHITECTURE.md` exists with Layer Boundary section
- [ ] `.claude/rules/code-style.md` exists
- [ ] `docs/ai/DECISIONS.md` exists

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-047.
If formatting, spelling, or ordering differs, the implementation is invalid.

- Three complementary code-style artifacts:
  - `docs/ai/REFERENCE/00.6-code-style.md` — descriptive rules with examples
  - `.claude/rules/code-style.md` — runtime enforcement during execution
  - `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md section 16` — pre-execution WP quality gate

---

## Guardrails

- No code style rules may be added, removed, or weakened
- All 15 existing rules (Rule 1 through Rule 15) must be preserved exactly
- All code examples must be preserved
- Enforcement mapping table (00.3 section 16 cross-references) must be preserved
- Change policy (DECISIONS.md entry required) must be preserved
- No modifications to `.claude/rules/code-style.md` — already aligned
- No modifications to `ARCHITECTURE.md` or `00.3-prompt-lint-checklist.md`
- Style rules never override architecture or layer boundaries

---

## Required `// why:` Comments

- N/A — documentation-only packet

---

## Files to Produce

- `docs/ai/REFERENCE/00.6-code-style.md` — **modified** — replace header with Authority & Scope section including subordination and three-artifact relationship

---

## After Completing

- [ ] Header contains subordination clause naming ARCHITECTURE.md and `.claude/rules/code-style.md`
- [ ] Header states style rules never override architecture or layer boundaries
- [ ] Three-artifact relationship documented in header
- [ ] All 15 rules present and unchanged
- [ ] Enforcement mapping table preserved
- [ ] Change policy preserved
- [ ] No files outside scope were modified
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` updated
      (why REFERENCE is descriptive while rules file is enforcement)
- [ ] `docs/ai/work-packets/WORK_INDEX.md`
      WP-047 checked off with date
