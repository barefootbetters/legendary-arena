# WP-044 — Prompt Lint Governance Alignment

**Status:** Complete
**Primary Layer:** Coordination / Quality Gate
**Dependencies:** WP-001

---

## Session Context

WP-001 established the coordination system and REFERENCE docs. The governed
version of the prompt lint checklist (`docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`)
was created as part of the WP-001 review cycle and already uses Work Packet
terminology. However, it predates the `.claude/rules/*.md` enforcement layer
and the Layer Boundary section in ARCHITECTURE.md. This packet aligns the
checklist with the current governance structure without changing its role
as a reusable quality gate.

---

## Goal

Update the governed prompt lint checklist to properly reference the authority
hierarchy, Layer Boundary, and `.claude/rules/*.md` enforcement layer. After
this session:

- The checklist explicitly declares subordination to ARCHITECTURE.md and
  `.claude/rules/*.md`
- §8 (Architectural Boundaries) references the Layer Boundary as authoritative
  and notes that `.claude/rules/*.md` handles runtime enforcement
- §16 (Code Style) references `.claude/rules/code-style.md` as the enforcement
  companion
- The legacy prompt version (`docs/prompts-legendary-area-game/00.3-prompt-lint-checklist.md`)
  is documented as superseded
- No lint rules are added, removed, or weakened

---

## Assumes

- WP-001 complete: coordination system and REFERENCE docs established
- `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` exists (governed version)
- `docs/ai/ARCHITECTURE.md` exists with Layer Boundary section
- `.claude/rules/*.md` files exist (architecture.md, game-engine.md, server.md,
  registry.md, persistence.md, code-style.md, work-packets.md)
- `docs/ai/DECISIONS.md` exists

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md — "Layer Boundary (Authoritative)"` — the canonical
  reference for layer responsibilities. The checklist's §8 must reference this
  section rather than re-encoding its own version of architectural boundaries.
- `.claude/rules/architecture.md` — the enforcement layer that Claude Code loads
  automatically. The checklist and the rules files must not contradict each other.
  Where both address the same concern (e.g., no `Math.random()`, G serialization),
  the checklist gates the Work Packet quality; the rules file enforces during
  execution.
- `.claude/rules/code-style.md` — enforces 00.6 code style rules. The checklist's
  §16 is a pre-execution check; the rules file is a runtime enforcement. They
  must align, not duplicate.
- `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` — the governed version to
  be updated. Read it entirely before modifying.
- `docs/prompts-legendary-area-game/00.3-prompt-lint-checklist.md` — the legacy
  version. It is superseded. Do NOT port content from it that conflicts with the
  governed version.

---

## Non-Negotiable Constraints

**Applicable constraints:**
- This packet produces a **documentation update**, not TypeScript code
- No lint rules may be added, removed, or weakened
- No modifications to `packages/` or `apps/`
- No modifications to `.claude/rules/*.md` — those files are correct as-is
- The checklist remains a REFERENCE document (reusable quality gate), not a
  Work Packet deliverable

**Packet-specific:**
- The checklist must explicitly state it **cannot override** ARCHITECTURE.md
  or `.claude/rules/*.md`
- §8 (Architectural Boundaries) must reference the Layer Boundary section by
  name and note that `.claude/rules/*.md` handles runtime enforcement
- §16 (Code Style) must reference `.claude/rules/code-style.md` as the
  companion enforcement file
- The header must include a subordination clause similar to the `.claude/rules/`
  files
- Do NOT merge the checklist into `.claude/rules/` — they serve different
  purposes (pre-execution gate vs runtime enforcement)

**Session protocol:**
- If any existing checklist item appears to conflict with ARCHITECTURE.md or
  `.claude/rules/*.md`, flag it explicitly — do not silently modify or remove it

---

## Scope (In)

### A) `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` — modified

Update the governed checklist with the following changes:

**Header update:**
- Add a subordination clause after the existing header blockquote:
  ```
  This checklist is subordinate to:
  - `docs/ai/ARCHITECTURE.md` (system architecture and Layer Boundary)
  - `.claude/rules/*.md` (runtime enforcement during execution)
  
  The checklist gates Work Packet quality before execution.
  The `.claude/rules/*.md` files enforce constraints during execution.
  If this checklist conflicts with either authority, it must be updated
  to match — not the other way around.
  ```

**§4 — Context References:**
- Add a check: if the packet touches layer boundaries or package imports,
  ARCHITECTURE.md "Layer Boundary (Authoritative)" must be listed in Context

**§8 — Architectural Boundaries:**
- Add a note at the top of §8:
  ```
  Architectural boundaries are authoritatively defined in
  `docs/ai/ARCHITECTURE.md — "Layer Boundary (Authoritative)"`.
  Runtime enforcement is handled by `.claude/rules/*.md`.
  This section gates Work Packet quality — it does not redefine boundaries.
  ```
- Add a check: the packet must not instruct Claude to add logic to a layer
  that violates the Layer Boundary

**§16 — Code Style:**
- Add a note at the top of §16:
  ```
  Code style rules are defined in `docs/ai/REFERENCE/00.6-code-style.md`.
  Runtime enforcement is handled by `.claude/rules/code-style.md`.
  This section gates Work Packet output quality.
  ```

### B) No other files modified

The legacy version at `docs/prompts-legendary-area-game/00.3-prompt-lint-checklist.md`
is NOT modified or deleted — it remains as historical reference. The governed
version supersedes it.

---

## Out of Scope

- **No new lint rules** — this packet adds governance alignment, not new checks
- **No modifications to `.claude/rules/*.md`** — those files are already aligned
- **No modifications to `ARCHITECTURE.md`** — the Layer Boundary section is
  already complete
- **No deletion of the legacy 00.3** — it remains as historical reference
- **No code changes** — this is a documentation-only packet
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**

---

## Files Expected to Change

- `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` — **modified** — add
  subordination clause, Layer Boundary references in §4/§8/§16

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Subordination
- [ ] Header contains a subordination clause naming ARCHITECTURE.md and
      `.claude/rules/*.md` as authorities
- [ ] Header states that conflicts must be resolved by updating the checklist,
      not the authorities

### Layer Boundary References
- [ ] §4 includes a check for Layer Boundary reference when packets touch
      layer boundaries
- [ ] §8 opens with a note naming the Layer Boundary as authoritative and
      `.claude/rules/*.md` as runtime enforcement
- [ ] §8 includes a check that packets must not violate the Layer Boundary

### Code Style Alignment
- [ ] §16 opens with a note naming `00.6-code-style.md` and
      `.claude/rules/code-style.md`

### No Rule Changes
- [ ] No existing checklist items were removed or weakened
      (confirmed by diffing line counts of checkboxes)
- [ ] No new lint rules were added (only governance notes)

### Scope Enforcement
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — confirm subordination clause exists
Select-String -Path "docs\ai\REFERENCE\00.3-prompt-lint-checklist.md" -Pattern "subordinate to"
# Expected: at least one match

# Step 2 — confirm Layer Boundary reference in §8
Select-String -Path "docs\ai\REFERENCE\00.3-prompt-lint-checklist.md" -Pattern "Layer Boundary"
# Expected: at least one match

# Step 3 — confirm .claude/rules reference
Select-String -Path "docs\ai\REFERENCE\00.3-prompt-lint-checklist.md" -Pattern "\.claude/rules"
# Expected: at least one match

# Step 4 — confirm no checklist items were removed (checkbox count)
Select-String -Path "docs\ai\REFERENCE\00.3-prompt-lint-checklist.md" -Pattern "^\s*-\s*\[ \]" | Measure-Object
# Expected: count >= current count (no items removed)

# Step 5 — confirm no files outside scope were changed
git diff --name-only
# Expected: only docs/ai/REFERENCE/00.3-prompt-lint-checklist.md
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
- [ ] Subordination clause names ARCHITECTURE.md and `.claude/rules/*.md`
- [ ] §8 references Layer Boundary by name
- [ ] §16 references `.claude/rules/code-style.md`
- [ ] No existing lint rules were removed or weakened
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — prompt lint checklist aligned with
      governance layer
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why the checklist remains
      a REFERENCE document (reusable gate) rather than being merged into
      `.claude/rules/`; relationship between pre-execution gating (checklist)
      and runtime enforcement (rules files)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-044 checked off with today's date
