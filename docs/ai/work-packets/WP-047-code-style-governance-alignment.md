# WP-047 — Code Style Reference Governance Alignment

**Status:** Ready
**Primary Layer:** Coordination / Reference Document
**Dependencies:** WP-001

---

## Session Context

WP-001 established the coordination system and REFERENCE docs. The governed
version of the code style standard (`docs/ai/REFERENCE/00.6-code-style.md`)
was created during the WP-001 review cycle and already contains all 15 rules
with code examples, the enforcement mapping to 00.3, and a change policy
requiring DECISIONS.md entries. However, it predates the `.claude/rules/*.md`
enforcement layer and the Layer Boundary section in ARCHITECTURE.md. This
packet aligns it with the current governance structure without changing any
rules.

---

## Goal

Update the governed code style reference to properly declare its authority
relationship to ARCHITECTURE.md and `.claude/rules/code-style.md`. After
this session:

- The document explicitly declares subordination to ARCHITECTURE.md and
  `.claude/rules/code-style.md`
- The document explicitly states that style rules never override architectural
  constraints or layer boundaries
- The relationship between the three code-style artifacts is documented:
  - `00.6-code-style.md` (REFERENCE) — descriptive rules with examples
  - `.claude/rules/code-style.md` — runtime enforcement during execution
  - `00.3 §16` — pre-execution WP quality gate
- No code style rules are added, removed, or weakened

---

## Assumes

- WP-001 complete: coordination system and REFERENCE docs established
- `docs/ai/REFERENCE/00.6-code-style.md` exists (governed version, 504 lines)
- `docs/ai/ARCHITECTURE.md` exists with Layer Boundary section
- `.claude/rules/code-style.md` exists
- `docs/ai/DECISIONS.md` exists

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md — "Layer Boundary (Authoritative)"` — code style
  rules must not redefine layer responsibilities or architectural constraints.
  If a style rule and an architectural rule conflict, the architectural rule wins.
- `.claude/rules/code-style.md` — the runtime enforcement companion. It
  distills 00.6 rules into enforceable constraints that Claude Code loads
  automatically. The REFERENCE document provides the examples and rationale;
  the rules file provides the enforcement. They must not contradict each other.
- `docs/ai/REFERENCE/00.6-code-style.md` — the governed version to be updated.
  Read the header and the enforcement mapping at the bottom before modifying.
- `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md §16` — the pre-execution
  quality gate that checks code style. §16 maps to 00.6 rules. WP-044 is
  aligning 00.3; this packet aligns 00.6.

---

## Non-Negotiable Constraints

**Applicable constraints:**
- This packet produces a **documentation update**, not TypeScript code
- No code style rules may be added, removed, or weakened
- No modifications to `.claude/rules/code-style.md` — that file is already
  aligned with 00.6
- No modifications to `ARCHITECTURE.md`
- No modifications to `00.3-prompt-lint-checklist.md` — that is WP-044
- The document remains a REFERENCE (descriptive with examples), not enforcement

**Packet-specific:**
- The header must include an "Authority & Scope" section declaring:
  - Subordination to ARCHITECTURE.md
  - Subordination to `.claude/rules/code-style.md` for enforcement
  - Style rules never override architecture or layer boundaries
- The relationship between the three code-style artifacts must be documented
- The existing enforcement mapping (00.3 §16 cross-references) must be preserved
- The existing change policy (DECISIONS.md entry required) must be preserved

**Session protocol:**
- If any existing rule appears to conflict with ARCHITECTURE.md or
  `.claude/rules/code-style.md`, flag it explicitly

---

## Scope (In)

### A) `docs/ai/REFERENCE/00.6-code-style.md` — modified

Update the governed code style reference with the following changes:

**Header update — replace the existing blockquote header with:**

```
> **REFERENCE DOCUMENT — Not an execution prompt. No output required.**
>
> **Authority & Scope:**
> This document is subordinate to:
> - `docs/ai/ARCHITECTURE.md` (system architecture and Layer Boundary)
> - `.claude/rules/code-style.md` (runtime enforcement during execution)
>
> Style rules never override architectural constraints or layer boundaries.
> If a style rule conflicts with ARCHITECTURE.md or `.claude/rules/*.md`,
> the higher-authority document wins.
>
> **Three code-style artifacts exist — they are complementary:**
> - `docs/ai/REFERENCE/00.6-code-style.md` (this file) — descriptive rules
>   with examples, rationale, and the enforcement mapping
> - `.claude/rules/code-style.md` — enforcement rules loaded by Claude Code
>   during execution
> - `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md §16` — pre-execution
>   quality gate for Work Packet output
>
> **Scope:** Defines code style rules for readability, clarity, and
> junior-developer maintainability. Does not define architecture, layer
> boundaries, persistence rules, or game logic.
>
> **Change policy:** Any modification to these rules requires a new entry in
> `docs/ai/DECISIONS.md` explaining the rationale.
```

All existing rules (1-15), code examples, enforcement mapping, and change
policy are preserved unchanged.

---

## Out of Scope

- **No new code style rules** — governance alignment only
- **No rule modifications** — existing rules 1-15 are preserved exactly
- **No `.claude/rules/code-style.md` modifications** — already aligned
- **No `00.3-prompt-lint-checklist.md` modifications** — that is WP-044
- **No `ARCHITECTURE.md` modifications**
- **No code changes**
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**

---

## Files Expected to Change

- `docs/ai/REFERENCE/00.6-code-style.md` — **modified** — replace header with
  Authority & Scope section including subordination and three-artifact
  relationship

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Subordination
- [ ] Header contains subordination clause naming ARCHITECTURE.md and
      `.claude/rules/code-style.md`
- [ ] Header states style rules never override architecture or layer boundaries

### Three-Artifact Relationship
- [ ] Header documents the three code-style artifacts (00.6, rules/code-style.md,
      00.3 §16) and their complementary roles

### Preservation
- [ ] All 15 rules (Rule 1 through Rule 15) are present and unchanged
- [ ] All code examples are preserved
- [ ] The enforcement mapping table (00.3 §16 cross-references) is preserved
- [ ] The change policy (DECISIONS.md entry required) is preserved

### No Rule Changes
- [ ] No existing rules were removed, weakened, or added

### Scope Enforcement
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — confirm subordination clause exists
Select-String -Path "docs\ai\REFERENCE\00.6-code-style.md" -Pattern "subordinate to"
# Expected: at least one match

# Step 2 — confirm ARCHITECTURE.md reference
Select-String -Path "docs\ai\REFERENCE\00.6-code-style.md" -Pattern "ARCHITECTURE\.md"
# Expected: at least one match

# Step 3 — confirm .claude/rules reference
Select-String -Path "docs\ai\REFERENCE\00.6-code-style.md" -Pattern "\.claude/rules/code-style\.md"
# Expected: at least one match

# Step 4 — confirm all 15 rules still exist
Select-String -Path "docs\ai\REFERENCE\00.6-code-style.md" -Pattern "^## Rule \d+"
# Expected: 15 matches (Rule 1 through Rule 15)

# Step 5 — confirm enforcement mapping preserved
Select-String -Path "docs\ai\REFERENCE\00.6-code-style.md" -Pattern "§16\.\d"
# Expected: multiple matches (enforcement mapping table)

# Step 6 — confirm change policy preserved
Select-String -Path "docs\ai\REFERENCE\00.6-code-style.md" -Pattern "DECISIONS\.md"
# Expected: at least one match

# Step 7 — confirm no files outside scope were changed
git diff --name-only
# Expected: only docs/ai/REFERENCE/00.6-code-style.md
```

---

## Definition of Done

> Claude Code must execute every verification command in `## Verification Steps`
> before checking any item below. Reading the code is not sufficient — run the
> commands.
>
> Every item must be true before this packet is considered complete.

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria above pass
- [ ] Subordination clause names ARCHITECTURE.md and `.claude/rules/code-style.md`
- [ ] Three-artifact relationship documented in header
- [ ] All 15 rules preserved (confirmed with `Select-String`)
- [ ] Enforcement mapping preserved (confirmed with `Select-String`)
- [ ] Change policy preserved (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — code style reference aligned with governance
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why the REFERENCE document
      is descriptive (with examples) while `.claude/rules/code-style.md` is
      enforcement (distilled constraints); why both exist and neither is redundant
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-047 checked off with today's date
