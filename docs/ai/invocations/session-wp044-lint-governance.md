# Session Invocation — WP-044: Prompt Lint Governance Alignment

---

### Session Header

**Work Packet:** `WP-044`
**Title:** Prompt Lint Governance Alignment
**Work Packet Class:** Contract-Only (documentation only — no TypeScript)
**Pre-Flight:** `docs/ai/invocations/preflight-wp044-lint-governance.md` — READY
**Date:** 2026-04-10

---

### Session Intent

Execute WP-044 exactly as scoped. Add governance alignment (subordination
clauses, Layer Boundary cross-references, code-style companion references)
to `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`. Then update STATUS.md,
DECISIONS.md, and WORK_INDEX.md.

This is a **documentation-only** session. No TypeScript code is produced.

---

### Authority Chain (Read Before Starting)

Read these documents in order. If any conflict exists, higher-numbered
documents override lower-numbered ones:

1. `.claude/CLAUDE.md` — root coordination
2. `docs/ai/REFERENCE/00.1-master-coordination-prompt.md` — override hierarchy
3. `docs/ai/ARCHITECTURE.md` — **Section 1** ("Monorepo Package Boundaries",
   "Package Import Rules") and **Section 5** ("Package Dependency Rules")
4. `.claude/rules/architecture.md` — **"Layer Boundary (Authoritative)"**
   (line 123) — the synthesized enforcement view
5. `.claude/rules/code-style.md` — runtime enforcement of code style
6. `docs/ai/execution-checklists/EC-044-lint-governance.checklist.md`
7. `docs/ai/work-packets/WP-044-prompt-lint-governance-alignment.md`
8. `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` — the file being modified

---

### Locked Decisions (From Pre-Flight — Must Not Be Revisited)

#### Locked Decision 1 — Layer Boundary Cross-References

WP-044 references "Layer Boundary (Authoritative)". The authoritative heading
for that exact phrase is located in `.claude/rules/architecture.md` (line 123),
**not** in `docs/ai/ARCHITECTURE.md` as a single heading.

Therefore:
- Cross-references added by WP-044 must point to:
  - `.claude/rules/architecture.md` — "Layer Boundary (Authoritative)" for
    the synthesized enforcement view
  - `docs/ai/ARCHITECTURE.md` — Section 1 and Section 5 for the source material
- This decision is locked by pre-flight and must not be revisited.

#### Locked Decision 2 — Legacy Archive Path

The legacy (superseded) checklist lives at:
`docs/archive prompts-legendary-area-game/00.3-prompt-lint-checklist.md`

It is **not modified or deleted**. If referencing it, use this exact path.

#### Locked Decision 3 — Checklist Stays as REFERENCE

The checklist remains a REFERENCE document (reusable pre-execution quality
gate). It is **not** merged into `.claude/rules/`. The distinction:
- Checklist: gates Work Packet quality **before** execution
- `.claude/rules/*.md`: enforces constraints **during** execution

This decision must be recorded in DECISIONS.md.

---

### Locked Quantities (Hard Failure If Changed)

`docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` currently has:

| Metric | Current Count | Constraint |
|---|---|---|
| `##` section headers | 19 | Must remain exactly 19 |
| Numbered `§` sections | 16 (§1–§16) | Must remain exactly 16 |
| Checkbox items (`- [ ]`) | 139 | Must be **>= 139** after changes |

New governance notes are added as **prose** (paragraphs or blockquotes),
not checkboxes, to preserve the diff-verifiable checkbox baseline.

New checkbox items in §4 and §8 are allowed per WP-044 scope — the count
must be >= 139, not == 139.

---

### Scope — Hard Allowlist

#### Files Allowed to Change

| File | Action | What Changes |
|---|---|---|
| `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` | Modified | Subordination clause, §4/§8/§16 governance notes |
| `docs/ai/STATUS.md` | Updated | Prompt lint checklist aligned with governance |
| `docs/ai/DECISIONS.md` | Updated | Why checklist remains REFERENCE, not merged |
| `docs/ai/work-packets/WORK_INDEX.md` | Updated | WP-044 checked off with date |

#### Scope Enforcement (Hard)

- **No files under `packages/` or `apps/` may be modified.**
- **No `.claude/rules/*.md` files may be modified.**
- **No `docs/ai/ARCHITECTURE.md` modifications.**
- Any change outside the allowlist above is a **hard failure**.

---

### What WP-044 Must NOT Do

- No lint rules added, removed, or weakened
- No new `§` sections added to the checklist
- No existing checklist items reworded, split, or merged
- No "while I'm here" improvements or refactoring
- No TypeScript code produced
- No deletion of the legacy archive file
- No modifications to `.claude/rules/*.md` — those files are correct as-is

**Rule:** WP-044 may only codify and normalize existing governance
relationships. It must not invent new requirements or expand scope beyond
what already exists in `.claude/rules/*.md` and
`docs/ai/ARCHITECTURE.md`.

---

### Exact Changes to `00.3-prompt-lint-checklist.md`

#### Change 1 — Header Subordination Clause

After the existing `> **Relationship to 00.1:**` paragraph (line 17–19),
add a new paragraph inside the blockquote:

```markdown
>
> **Subordination:** This checklist is subordinate to:
> - `docs/ai/ARCHITECTURE.md` (system architecture — Section 1, Section 5)
> - `.claude/rules/*.md` (runtime enforcement during execution)
>
> The checklist gates Work Packet quality before execution.
> The `.claude/rules/*.md` files enforce constraints during execution.
> If this checklist conflicts with either authority, the checklist must be
> updated to match — not the other way around.
```

#### Change 2 — §4 Context References

After the existing `docs/ai/DECISIONS.md` check (line 95), add:

```markdown
- [ ] If the packet touches layer boundaries or package imports:
  - [ ] `docs/ai/ARCHITECTURE.md` Section 1 ("Monorepo Package Boundaries")
        and `.claude/rules/architecture.md` ("Layer Boundary (Authoritative)")
        are listed in Context
```

This adds new checkbox items (allowed — count goes up).

#### Change 3 — §8 Architectural Boundaries

After the `## §8 — Architectural Boundaries` heading (line 162), before
the `### Backend` subheading, add:

```markdown
> Architectural boundaries are authoritatively defined in
> `docs/ai/ARCHITECTURE.md` — Section 1 ("Monorepo Package Boundaries",
> "Package Import Rules") and Section 5 ("Package Dependency Rules").
> The synthesized enforcement view is in `.claude/rules/architecture.md`
> ("Layer Boundary (Authoritative)").
> Runtime enforcement is handled by `.claude/rules/*.md`.
> This section gates Work Packet quality — it does not redefine boundaries.

- [ ] The packet must not instruct Claude to add logic to a layer that
      violates the Layer Boundary defined in `.claude/rules/architecture.md`
```

This adds a prose note (no checkbox count change) and one new checkbox item.

#### Change 4 — §16 Code Style

After the `## §16 — Code Style (Human-Style / Junior Maintainability)`
heading (line 300), before the `Enforces the rules...` paragraph, add:

```markdown
> Code style rules are defined in `docs/ai/REFERENCE/00.6-code-style.md`.
> Runtime enforcement is handled by `.claude/rules/code-style.md`.
> This section gates Work Packet output quality.
```

This is prose only — no checkbox count change.

---

### Stop Conditions (Mandatory)

**STOP and report** if any of the following occur during execution:

- Any lint rule would need to be removed or weakened to proceed
- Any cross-reference would conflict with `.claude/CLAUDE.md` or
  `.claude/rules/architecture.md`
- Any locked count (§ sections or checkboxes) would decrease
- Any file outside the hard allowlist would need modification
- Any existing checklist item would need rewording

If a stop condition triggers, do not work around it. Report the issue
and wait for guidance.

---

### Verification Commands (Must Run Before Marking Complete)

```bash
# 1. Confirm subordination clause exists
grep -c "subordinate to" docs/ai/REFERENCE/00.3-prompt-lint-checklist.md
# Expected: >= 1

# 2. Confirm Layer Boundary reference in §8
grep -c "Layer Boundary" docs/ai/REFERENCE/00.3-prompt-lint-checklist.md
# Expected: >= 1

# 3. Confirm .claude/rules reference
grep -c "\.claude/rules" docs/ai/REFERENCE/00.3-prompt-lint-checklist.md
# Expected: >= 1

# 4. Count section headers (## only)
grep -c "^## " docs/ai/REFERENCE/00.3-prompt-lint-checklist.md
# Expected: 19

# 5. Count checkbox items
grep -c "^\s*- \[ \]" docs/ai/REFERENCE/00.3-prompt-lint-checklist.md
# Expected: >= 139 (was 139 before, new items in §4 and §8 increase it)

# 6. Confirm no files outside scope were changed
git diff --name-only
# Expected: only files listed in the hard allowlist above

# 7. Game engine tests still pass
cd packages/game-engine && pnpm test
# Expected: 72 tests passing, 0 failures
```

---

### Execution Order

1. Read the full `00.3-prompt-lint-checklist.md` (already in authority chain)
2. Apply Change 1 (header subordination clause)
3. Apply Change 2 (§4 Layer Boundary context check)
4. Apply Change 3 (§8 governance note + Layer Boundary violation check)
5. Apply Change 4 (§16 code style companion note)
6. Run all verification commands
7. Update `docs/ai/STATUS.md`
8. Update `docs/ai/DECISIONS.md` (why checklist stays REFERENCE)
9. Update `docs/ai/work-packets/WORK_INDEX.md` (WP-044 checked off)
10. Run `git diff --name-only` — confirm only allowlisted files changed

---

### Runtime Wiring Allowance

**Not applicable.** WP-044 is documentation-only. No TypeScript files are
created or modified. No new fields, types, moves, or phase hooks are
introduced. The conditions in
`docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md` are not met.

---

### Final Instruction

Execute the changes above **exactly as specified**. Do not add, remove,
or reword anything beyond what is listed in the "Exact Changes" section.
If uncertainty arises, stop and ask — do not guess.
