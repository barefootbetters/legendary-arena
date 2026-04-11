# Session Invocation — WP-047: Code Style Reference Governance Alignment

---

### Session Header

**Work Packet:** `WP-047`
**Title:** Code Style Reference Governance Alignment
**Work Packet Class:** Contract-Only (documentation only — no TypeScript)
**Pre-Flight:** `docs/ai/invocations/preflight-wp047-code-style.md` — READY
**Date:** 2026-04-10

---

### Session Intent

Execute WP-047 exactly as scoped. Replace the header blockquote in
`docs/ai/REFERENCE/00.6-code-style.md` with an Authority & Scope section
that declares subordination, documents the three complementary code-style
artifacts, and preserves the existing scope statement, enforcement mapping
reference, and change policy. Then update STATUS.md, DECISIONS.md, and
WORK_INDEX.md.

This is a **documentation-only** session. No TypeScript code is produced.
No scripts are modified. No code style rules are added, removed, or weakened.

---

### Authority Chain (Read Before Starting)

Read these documents in order. If any conflict exists, higher-numbered
documents override lower-numbered ones:

1. `.claude/CLAUDE.md` — root coordination, Lint Gate section (line 69)
2. `docs/ai/REFERENCE/00.1-master-coordination-prompt.md` — override hierarchy
3. `docs/ai/ARCHITECTURE.md` — **Section 1** ("Monorepo Package Boundaries",
   "Package Import Rules") and **Section 5** ("Package Dependency Rules")
4. `.claude/rules/architecture.md` — **"Layer Boundary (Authoritative)"**
   (line 123) — the synthesized enforcement view
5. `.claude/rules/code-style.md` — the runtime enforcement companion to the
   document being modified
6. `docs/ai/execution-checklists/EC-047-code-style.checklist.md`
7. `docs/ai/work-packets/WP-047-code-style-governance-alignment.md`
8. `docs/ai/REFERENCE/00.6-code-style.md` — the file being modified

---

### Locked Decisions (From Pre-Flight — Must Not Be Revisited)

#### Locked Decision 1 — Header Replacement (Not Append)

WP-044/045/046 appended governance text to existing blockquotes. WP-047
**replaces** the existing header blockquote entirely. The replacement must
preserve the existing content semantics (scope statement, enforcement
mapping cross-reference, change policy) while adding subordination and
three-artifact documentation.

The exact replacement text is specified in the "Exact Changes" section
below. This decision is locked.

#### Locked Decision 2 — Subordination Target Is Specific

WP-047 declares subordination to `docs/ai/ARCHITECTURE.md` and
`.claude/rules/code-style.md` (specific file), not the wildcard
`.claude/rules/*.md`. This is intentional — 00.6 is the code style
standard, and its enforcement counterpart is specifically `code-style.md`.

The conflict resolution statement uses the wildcard: "If a style rule
conflicts with ARCHITECTURE.md or `.claude/rules/*.md`, the
higher-authority document wins." This covers the full rules directory for
override purposes.

This decision is locked.

#### Locked Decision 3 — No Layer Boundary Note or Execution Gate

Unlike WP-044/045/046, WP-047 does not add a Layer Boundary note or
Execution Gate section. 00.6 is a cross-cutting code style standard — it
is not layer-specific and is not part of the Foundation Prompt sequence.
The scope statement in the replacement header explicitly says: "Does not
define architecture, layer boundaries, persistence rules, or game logic."

This decision is locked.

#### Locked Decision 4 — Three-Artifact Relationship

The three complementary code-style artifacts are:
- `docs/ai/REFERENCE/00.6-code-style.md` (this file) — descriptive rules
  with examples, rationale, and the enforcement mapping
- `.claude/rules/code-style.md` — enforcement rules loaded by Claude Code
  during execution
- `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md §16` — pre-execution
  quality gate for Work Packet output

This relationship must be documented in the replacement header exactly as
specified. This decision is locked.

#### Locked Decision 5 — DECISIONS.md Entry Content

The DECISIONS.md entry must explain why the REFERENCE document (descriptive
with examples) and `.claude/rules/code-style.md` (enforcement) both exist
and are not redundant. The rationale: 00.6 serves as the human-readable
reference and source of truth for style decisions; `.claude/rules/code-style.md`
distills these into enforceable constraints loaded automatically; 00.3 §16
checks WP output before execution. Three artifacts, three audiences, three
times. This parallels D-1401/D-1402/D-1403.

This decision is locked.

---

### Locked Quantities (Hard Failure If Changed)

`docs/ai/REFERENCE/00.6-code-style.md` currently has:

| Metric | Current Count | Constraint |
|---|---|---|
| `## Rule` sections | 15 | Must be **exactly 15** after changes (Rules 1-15 preserved) |
| `§16.*` enforcement mapping entries | 18 | Must be **exactly 18** after changes |
| `DECISIONS.md` references | 3 | Must be **>= 3** after changes (change policy preserved) |
| Total lines | 504 | Header replacement may change line count; rules must not |

The header blockquote (lines 3-16) is replaced. Everything from line 18
onward (`---` separator, `## Purpose`, all 15 rules, enforcement mapping,
change policy) must be preserved exactly.

---

### Scope — Hard Allowlist

#### Files Allowed to Change

| File | Action | What Changes |
|---|---|---|
| `docs/ai/REFERENCE/00.6-code-style.md` | Modified | Header blockquote replaced with Authority & Scope section |
| `docs/ai/STATUS.md` | Updated | Code style reference aligned with governance |
| `docs/ai/DECISIONS.md` | Updated | Why REFERENCE is descriptive while rules file is enforcement; three-artifact relationship |
| `docs/ai/work-packets/WORK_INDEX.md` | Updated | WP-047 checked off with date |

#### Scope Enforcement (Hard)

- **No files under `packages/` or `apps/` may be modified.**
- **No `.claude/rules/*.md` files may be modified.**
- **No `docs/ai/ARCHITECTURE.md` modifications.**
- **No `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` modifications.**
- **No `scripts/` files may be modified.**
- Any change outside the allowlist above is a **hard failure**.

---

### What WP-047 Must NOT Do

- No code style rules added, removed, or weakened (Rules 1-15 preserved)
- No code examples modified
- No enforcement mapping table modified
- No `.claude/rules/code-style.md` modifications
- No `00.3-prompt-lint-checklist.md` modifications
- No existing document content below the header reworded, split, or merged
- No "while I'm here" improvements or refactoring
- No TypeScript code produced
- No modifications to `.claude/rules/*.md`

**Rule:** WP-047 may only codify the governance relationship in the header.
It must not invent new requirements or expand scope beyond what already
exists in the authority chain.

---

### Exact Changes to `00.6-code-style.md`

#### Change 1 — Replace Header Blockquote

Replace the existing header blockquote (lines 3-16):

```markdown
> **REFERENCE DOCUMENT — Not an execution prompt. No output required.**
>
> **Scope:** This document defines the code style rules enforced across all
> Work Packets and execution prompts in this project. When a rule here conflicts
> with a rule in a specific Work Packet, the Work Packet wins for that session.
> Otherwise, all generated code must satisfy every rule below.
>
> **Relationship to coordination system:** See the enforcement mapping at the
> bottom of this document — each rule is cross-referenced to the 00.3 lint
> checklist section that enforces it. When 00.3 §16 and this document conflict,
> update both together.
>
> **Change policy:** Any modification to these rules requires a new entry in
> `docs/ai/DECISIONS.md` explaining the rationale.
```

With:

```markdown
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

**Important:** Only the blockquote content changes. The `---` separator on
line 18 and everything after it (`## Purpose`, all 15 rules, enforcement
mapping, change policy table) must remain exactly as-is.

---

### Stop Conditions (Mandatory)

**STOP and report** if any of the following occur during execution:

- Any existing rule (Rules 1-15) would need to be modified
- Any code example would need to be changed
- Any enforcement mapping entry would need to be updated
- Any cross-reference would conflict with `.claude/CLAUDE.md` or
  `.claude/rules/architecture.md`
- Any file outside the hard allowlist would need modification
- Any existing document section below the header would need rewording

If a stop condition triggers, do not work around it. Report the issue
and wait for guidance.

---

### Verification Commands (Must Run Before Marking Complete)

```bash
# 1. Confirm subordination clause exists
grep -c "subordinate to" docs/ai/REFERENCE/00.6-code-style.md
# Expected: >= 1

# 2. Confirm ARCHITECTURE.md reference in header
grep -c "ARCHITECTURE\.md" docs/ai/REFERENCE/00.6-code-style.md
# Expected: >= 1

# 3. Confirm .claude/rules/code-style.md reference
grep -c "\.claude/rules/code-style\.md" docs/ai/REFERENCE/00.6-code-style.md
# Expected: >= 1

# 4. Confirm three-artifact documentation
grep -c "three code-style artifacts" docs/ai/REFERENCE/00.6-code-style.md
# Expected: >= 1 (case-insensitive match acceptable)

# 5. Confirm style-never-overrides statement
grep -c "never override" docs/ai/REFERENCE/00.6-code-style.md
# Expected: >= 1

# 6. Confirm all 15 rules still exist
grep -c "^## Rule " docs/ai/REFERENCE/00.6-code-style.md
# Expected: 15

# 7. Confirm enforcement mapping preserved
grep -c "§16\." docs/ai/REFERENCE/00.6-code-style.md
# Expected: 18

# 8. Confirm change policy preserved
grep -c "DECISIONS\.md" docs/ai/REFERENCE/00.6-code-style.md
# Expected: >= 3

# 9. Confirm no .claude/rules files were modified
git diff --name-only .claude/rules/
# Expected: no output

# 10. Confirm no files outside scope were changed
git diff --name-only
# Expected: only files listed in the hard allowlist above

# 11. Game engine tests still pass
cd packages/game-engine && pnpm test
# Expected: 89 tests passing, 0 failures
```

---

### Execution Order

1. Read the full `00.6-code-style.md` (already in authority chain)
2. Apply Change 1 (replace header blockquote with Authority & Scope section)
3. Run all verification commands
4. Update `docs/ai/STATUS.md`
5. Update `docs/ai/DECISIONS.md` (why REFERENCE is descriptive while rules
   file is enforcement; three-artifact relationship; parallels D-1401/D-1402/
   D-1403)
6. Update `docs/ai/work-packets/WORK_INDEX.md` (WP-047 checked off)
7. Run `git diff --name-only` — confirm only allowlisted files changed

---

### Runtime Wiring Allowance

**Not applicable.** WP-047 is documentation-only. No TypeScript files are
created or modified. No new fields, types, moves, or phase hooks are
introduced. The conditions in
`docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md` are not met.

---

### Final Instruction

Execute the changes above **exactly as specified**. Do not add, remove,
or reword anything beyond what is listed in the "Exact Changes" section.
If uncertainty arises, stop and ask — do not guess.
