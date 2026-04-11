# Session Invocation — WP-046: R2 Validation Governance Alignment

---

### Session Header

**Work Packet:** `WP-046`
**Title:** R2 Validation Governance Alignment
**Work Packet Class:** Contract-Only (documentation only — no TypeScript)
**Pre-Flight:** `docs/ai/invocations/preflight-wp046-r2-validation.md` — READY
**Date:** 2026-04-10

---

### Session Intent

Execute WP-046 exactly as scoped. Add governance alignment (subordination
clause, Layer Boundary note, WP-042 distinction, Execution Gate with
warnings vs errors) to `docs/ai/REFERENCE/00.5-validation.md`. Then update
STATUS.md, DECISIONS.md, and WORK_INDEX.md.

This is a **documentation-only** session. No TypeScript code is produced.
No scripts are modified.

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
5. `.claude/rules/registry.md` — registry-layer governance (R2 validation
   validates the same data the registry loads)
6. `docs/ai/execution-checklists/EC-046-r2-validation.checklist.md`
7. `docs/ai/work-packets/WP-046-r2-validation-governance-alignment.md`
8. `docs/ai/REFERENCE/00.5-validation.md` — the file being modified

---

### Locked Decisions (From Pre-Flight — Must Not Be Revisited)

#### Locked Decision 1 — Layer Boundary Cross-References (Inherited from WP-044/WP-045)

The "Layer Boundary (Authoritative)" heading lives in
`.claude/rules/architecture.md` (line 123), **not** in
`docs/ai/ARCHITECTURE.md` as a single heading.

Therefore:
- Cross-references added by WP-046 must point to:
  - `.claude/rules/architecture.md` — "Layer Boundary (Authoritative)" for
    the synthesized enforcement view
  - `docs/ai/ARCHITECTURE.md` — Section 1 and Section 5 for the source material
- This decision is locked by pre-flight and must not be revisited.

#### Locked Decision 2 — R2 Validation vs Lint Gate Distinction

The two gates serve different purposes at different times:

| Gate | Document | Scope | When |
|---|---|---|---|
| R2 Validation | `00.5-validation.md` | Foundation Prompt prerequisite | Runs **once** after 00.4, before 01 and 02 |
| Lint Gate | `00.3-prompt-lint-checklist.md` | Per-WP quality gate | Runs **before each** WP execution |

The R2 validation is **not** a per-WP gate. The Lint Gate is **not** a
Foundation Prompt prerequisite. They must not be confused.

#### Locked Decision 3 — Foundation Prompt Execution Order

The locked execution order is: `00.4 -> 00.5 -> 01 -> 02`

If 00.5 fails (error-level), Foundation Prompts 01 and 02 and all Work
Packets that depend on R2 data are BLOCKED. Warnings alone do not block.

#### Locked Decision 4 — R2 Validation Remains as REFERENCE

The R2 validation document remains a REFERENCE document (reusable Foundation
Prompt gate). It is **not** merged into `.claude/rules/`. The distinction:
- R2 validation: Foundation Prompt prerequisite (runs once, produces script)
- `.claude/rules/*.md`: runtime enforcement (loaded automatically by Claude Code)

This decision must be recorded in DECISIONS.md.

#### Locked Decision 5 — Layer Attribution Uses registry.md, Not server.md

The 00.5 document validates R2 card data — the same data the registry
package loads. Although the script lives in `scripts/` (outside
`packages/registry/`), its concern is data validation, not server wiring.
The Layer Boundary note must reference `.claude/rules/registry.md` for
data shape conventions, not `.claude/rules/server.md`.

#### Locked Decision 6 — Warnings vs Errors Distinction

The Execution Gate for 00.5 must explicitly state that warnings alone do
not block execution; only errors block. This matches the existing exit
code semantics in 00.5 (exit 0 on warnings-only, exit 1 on errors).
WP-045's Execution Gate had no such distinction because all health check
failures blocked unconditionally.

---

### Locked Quantities (Hard Failure If Changed)

`docs/ai/REFERENCE/00.5-validation.md` currently has:

| Metric | Current Count | Constraint |
|---|---|---|
| `##` section headers | 14 | Must be **14 or 15** after changes (new Execution Gate section allowed) |

Governance notes are added as **prose** (blockquotes or paragraphs). The
existing document structure, scripts, acceptance criteria, and verification
steps must not be altered.

---

### Scope — Hard Allowlist

#### Files Allowed to Change

| File | Action | What Changes |
|---|---|---|
| `docs/ai/REFERENCE/00.5-validation.md` | Modified | Subordination clause, Layer Boundary note, WP-042 distinction, Execution Gate section |
| `docs/ai/STATUS.md` | Updated | R2 validation gate aligned with governance |
| `docs/ai/DECISIONS.md` | Updated | Why validation gate remains REFERENCE; distinction from WP-042; sequence position |
| `docs/ai/work-packets/WORK_INDEX.md` | Updated | WP-046 checked off with date |

#### Scope Enforcement (Hard)

- **No files under `packages/` or `apps/` may be modified.**
- **No `.claude/rules/*.md` files may be modified.**
- **No `docs/ai/ARCHITECTURE.md` modifications.**
- **No `scripts/` files may be modified** (`validate-r2.mjs`).
- **No `.env.example` modifications.**
- Any change outside the allowlist above is a **hard failure**.

---

### What WP-046 Must NOT Do

- No validation checks added, removed, or weakened
- No script modifications
- No registry package changes
- No existing document content reworded, split, or merged
- No "while I'm here" improvements or refactoring
- No TypeScript code produced
- No modifications to `.claude/rules/*.md`

**Rule:** WP-046 may only codify and normalize existing governance
relationships. It must not invent new requirements or expand scope beyond
what already exists in the authority chain.

---

### Exact Changes to `00.5-validation.md`

#### Change 1 — Header Subordination Clause

After the existing `> **Relationship to coordination system:**` paragraph
(line 13–16), add new paragraphs inside the blockquote:

```markdown
>
> **Subordination:** This document is subordinate to:
> - `docs/ai/ARCHITECTURE.md` (system architecture — Section 1, Section 5)
> - `.claude/rules/*.md` (runtime enforcement during execution)
>
> This R2 validation gate is a **Foundation Prompt prerequisite** — it runs
> after 00.4 (connection health) and before Foundation Prompts 01 and 02.
> It is not a per-WP gate (that role belongs to the Prompt Lint Checklist,
> `00.3`).
>
> If this validation gate fails (error-level), Foundation Prompts 01 and 02
> and all Work Packets that depend on R2 data are BLOCKED until failures
> are resolved. Warnings alone do not block execution.
>
> If this document conflicts with ARCHITECTURE.md or `.claude/rules/*.md`,
> this document must be updated to match — not the other way around.
```

#### Change 2 — Layer Boundary Note

After the `---` separator following the header blockquote (line 18), before
`## Goal` (line 20), add:

```markdown
> **Layer Boundary:** This document validates registry-layer data (R2 card
> JSON, metadata, images). It does not touch game-engine logic, server
> startup, or game state. Per `.claude/rules/architecture.md`
> ("Layer Boundary (Authoritative)"), R2 data validation is a
> registry/data-layer concern. Validation script changes are informed by
> `.claude/rules/registry.md` for data shape conventions.

> **Distinction from WP-042:** This validation gate is a reusable preflight
> script (Foundation Prompt 00.5). For operational deployment checklists
> (uploading sets, re-seeding), see WP-042.

---
```

#### Change 3 — Execution Gate Section

After `## Hard Constraints` (the last existing section, line 417+), add a
new section at the end of the document:

```markdown
---

## Execution Gate

This R2 validation is a hard gate in the Foundation Prompt sequence.

If any error-level check fails:
- Do NOT proceed to Foundation Prompt 01 (Render.com Backend Setup)
- Do NOT proceed to Foundation Prompt 02 (Database Migrations)
- Do NOT execute any Work Packet that depends on R2 data
- Fix the data issue, re-run validation, and confirm exit code 0

Warnings alone do not block execution. Errors do.

Partial or "best effort" execution is not acceptable. The Foundation Prompt
sequence is: `00.4 -> 00.5 -> 01 -> 02`. Each step depends on the prior
step completing successfully.
```

---

### Stop Conditions (Mandatory)

**STOP and report** if any of the following occur during execution:

- Any existing validation check content would need to be removed or weakened
- Any cross-reference would conflict with `.claude/CLAUDE.md` or
  `.claude/rules/architecture.md`
- Any script file would need modification
- Any file outside the hard allowlist would need modification
- Any existing document section would need rewording

If a stop condition triggers, do not work around it. Report the issue
and wait for guidance.

---

### Verification Commands (Must Run Before Marking Complete)

```bash
# 1. Confirm subordination clause exists
grep -c "subordinate to" docs/ai/REFERENCE/00.5-validation.md
# Expected: >= 1

# 2. Confirm Layer Boundary reference
grep -c "Layer Boundary" docs/ai/REFERENCE/00.5-validation.md
# Expected: >= 1

# 3. Confirm .claude/rules reference
grep -c "\.claude/rules" docs/ai/REFERENCE/00.5-validation.md
# Expected: >= 1

# 4. Confirm stop-on-failure gate
grep -c "Do NOT proceed" docs/ai/REFERENCE/00.5-validation.md
# Expected: >= 1

# 5. Confirm warnings vs errors distinction
grep -c "Warnings alone" docs/ai/REFERENCE/00.5-validation.md
# Expected: >= 1

# 6. Confirm WP-042 cross-reference
grep -c "WP-042" docs/ai/REFERENCE/00.5-validation.md
# Expected: >= 1

# 7. Confirm Foundation Prompt vs Lint Gate distinction
grep -c "per-WP gate" docs/ai/REFERENCE/00.5-validation.md
# Expected: >= 1

# 8. Count section headers
grep -c "^## " docs/ai/REFERENCE/00.5-validation.md
# Expected: 15 (was 14, +1 Execution Gate)

# 9. Confirm no scripts were modified
git diff --name-only scripts/
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

1. Read the full `00.5-validation.md` (already in authority chain)
2. Apply Change 1 (header subordination clause)
3. Apply Change 2 (Layer Boundary note and WP-042 distinction after header)
4. Apply Change 3 (Execution Gate section at end)
5. Run all verification commands
6. Update `docs/ai/STATUS.md`
7. Update `docs/ai/DECISIONS.md` (why validation gate stays REFERENCE;
   distinction from WP-042; position in Foundation Prompts sequence)
8. Update `docs/ai/work-packets/WORK_INDEX.md` (WP-046 checked off)
9. Run `git diff --name-only` — confirm only allowlisted files changed

---

### Runtime Wiring Allowance

**Not applicable.** WP-046 is documentation-only. No TypeScript files are
created or modified. No new fields, types, moves, or phase hooks are
introduced. The conditions in
`docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md` are not met.

---

### Final Instruction

Execute the changes above **exactly as specified**. Do not add, remove,
or reword anything beyond what is listed in the "Exact Changes" section.
If uncertainty arises, stop and ask — do not guess.
