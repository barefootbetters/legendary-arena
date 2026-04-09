# WP-046 — R2 Validation Governance Alignment

**Status:** Ready
**Primary Layer:** Coordination / Execution Gate
**Dependencies:** WP-001, WP-045

---

## Session Context

WP-001 established the coordination system and REFERENCE docs. WP-045 aligned
the connection health check (00.4) with the governance layer. The governed
version of the R2 validation gate (`docs/ai/REFERENCE/00.5-validation.md`)
was created as part of the Foundation Prompts and already produces a diagnostic
script (`scripts/validate-r2.mjs`) that validates R2 registry, metadata, images,
and cross-set slugs. However, it predates the `.claude/rules/*.md` enforcement
layer, the Layer Boundary section in ARCHITECTURE.md, and the Lint Gate in
CLAUDE.md. This packet aligns it with the current governance structure without
changing its role as a reusable preflight validation gate.

---

## Goal

Update the governed R2 validation gate to properly reference the authority
hierarchy, Layer Boundary, and `.claude/rules/*.md` enforcement layer. After
this session:

- The validation gate explicitly declares subordination to ARCHITECTURE.md
- The validation gate explicitly states it is a registry/data-layer concern
  per the Layer Boundary (it validates R2 data, not game-engine or server logic)
- The validation gate notes that `.claude/rules/registry.md` governs registry
  modifications if any validation logic changes are needed
- The relationship to the Foundation Prompts sequence is documented
  (00.4 -> 00.5 -> 01 -> 02), with explicit stop-on-failure semantics
- The distinction from WP-042 (deployment checklists) is noted: 00.5 is a
  reusable preflight script; WP-042 documents operational deployment procedures
- No validation checks are added, removed, or weakened

---

## Assumes

- WP-001 complete: coordination system and REFERENCE docs established
- WP-045 complete or in-progress: connection health check governance aligned
- `docs/ai/REFERENCE/00.5-validation.md` exists (governed version)
- `docs/ai/ARCHITECTURE.md` exists with Layer Boundary section
- `.claude/rules/*.md` files exist
- `docs/ai/DECISIONS.md` exists

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md — "Layer Boundary (Authoritative)"` — the R2
  validation script validates registry-layer data. It does not touch
  game-engine logic, server startup, or game state.
- `.claude/rules/registry.md` — governs registry package modifications. The
  validation script lives outside `packages/registry/` (in `scripts/`) but
  validates the same data the registry loads. Cross-reference for consistency.
- `.claude/CLAUDE.md — "Lint Gate"` — the Lint Gate applies to Work Packet
  actions. The R2 validation is a Foundation Prompt — a different gate in the
  execution sequence.
- `docs/ai/REFERENCE/00.5-validation.md` — the governed version to be updated.
  Read it entirely before modifying.
- `docs/ai/work-packets/WORK_INDEX.md — Foundation Prompts table` — confirms
  00.5 runs after 00.4, before 01 and 02.

---

## Non-Negotiable Constraints

**Applicable constraints:**
- This packet produces a **documentation update**, not TypeScript code
- No validation checks may be added, removed, or weakened
- No modifications to `scripts/validate-r2.mjs`
- No modifications to `packages/registry/`
- No modifications to `.claude/rules/*.md`
- No modifications to `ARCHITECTURE.md`
- The validation gate remains a REFERENCE document (reusable preflight gate)

**Packet-specific:**
- The validation gate must explicitly state it **cannot override** ARCHITECTURE.md
  or `.claude/rules/*.md`
- The header must include a subordination clause
- The Layer Boundary must be referenced: R2 validation is a registry/data-layer
  concern, not game-engine or server logic
- The Foundation Prompts execution order (00.4 -> 00.5 -> 01 -> 02) must be
  noted with explicit stop-on-failure semantics
- The distinction from WP-042 must be noted: 00.5 is a reusable preflight
  script; WP-042 documents operational deployment procedures

**Session protocol:**
- If any existing validation check appears to conflict with ARCHITECTURE.md
  or `.claude/rules/*.md`, flag it explicitly

---

## Scope (In)

### A) `docs/ai/REFERENCE/00.5-validation.md` — modified

Update the governed validation gate with the following changes:

**Header update:**
- Add a subordination clause after the existing header blockquote:
  ```
  This document is subordinate to:
  - `docs/ai/ARCHITECTURE.md` (system architecture and Layer Boundary)
  - `.claude/rules/*.md` (runtime enforcement during execution)

  The R2 validation gate is a **Foundation Prompt prerequisite** — it runs
  after 00.4 (connection health) and before Foundation Prompts 01 and 02.
  It is not a per-WP gate (that role belongs to the Prompt Lint Checklist).

  If this validation gate fails, Foundation Prompts 01 and 02 are BLOCKED
  until failures are resolved.
  ```

**Layer Boundary note:**
- Add a note near the top:
  ```
  Layer Boundary: This document validates registry-layer data (R2 card JSON,
  metadata, images). It does not touch game-engine logic, server startup,
  or game state. Validation script changes are informed by
  `.claude/rules/registry.md` for data shape conventions.
  ```

**Distinction from WP-042:**
- Add a note:
  ```
  This validation gate is a reusable preflight script (Foundation Prompt 00.5).
  For operational deployment checklists (uploading sets, re-seeding), see WP-042.
  ```

**Stop-on-failure semantics:**
- If not already explicit, add at the end:
  ```
  ## Execution Gate

  This validation is a hard gate. If any error-level check fails:
  - Do NOT proceed to Foundation Prompt 01
  - Do NOT proceed to Foundation Prompt 02
  - Do NOT execute any Work Packet that depends on R2 data
  - Fix the data issue, re-run validation, confirm exit code 0

  Warnings alone do not block execution. Errors do.
  ```

---

## Out of Scope

- **No new validation checks** — governance alignment only
- **No script modifications** — `validate-r2.mjs` is not changed
- **No registry package changes** — `packages/registry/` is not changed
- **No `.claude/rules/*.md` modifications**
- **No `ARCHITECTURE.md` modifications**
- **No deployment procedure content** — that is WP-042
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**

---

## Files Expected to Change

- `docs/ai/REFERENCE/00.5-validation.md` — **modified** — add subordination
  clause, Layer Boundary note, WP-042 distinction, stop-on-failure gate

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Subordination
- [ ] Header contains a subordination clause naming ARCHITECTURE.md and
      `.claude/rules/*.md`
- [ ] Header distinguishes 00.5 (Foundation Prompt prerequisite) from the
      Lint Gate (per-WP gate)

### Layer Boundary
- [ ] Document contains a Layer Boundary note identifying it as registry/data
      layer validation
- [ ] Document references `.claude/rules/registry.md` for data shape conventions

### Execution Gate
- [ ] Document contains explicit stop-on-failure semantics
- [ ] Stop conditions name Foundation Prompts 01 and 02 as blocked on failure
- [ ] Warnings vs errors distinction is explicit (warnings don't block)

### Cross-References
- [ ] Distinction from WP-042 is documented

### No Check Changes
- [ ] No existing validation checks were removed or weakened
- [ ] No new validation checks were added

### Scope Enforcement
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — confirm subordination clause exists
Select-String -Path "docs\ai\REFERENCE\00.5-validation.md" -Pattern "subordinate to"
# Expected: at least one match

# Step 2 — confirm Layer Boundary reference
Select-String -Path "docs\ai\REFERENCE\00.5-validation.md" -Pattern "Layer Boundary|registry.*layer"
# Expected: at least one match

# Step 3 — confirm .claude/rules reference
Select-String -Path "docs\ai\REFERENCE\00.5-validation.md" -Pattern "\.claude/rules"
# Expected: at least one match

# Step 4 — confirm stop-on-failure gate
Select-String -Path "docs\ai\REFERENCE\00.5-validation.md" -Pattern "BLOCKED|Do NOT proceed"
# Expected: at least one match

# Step 5 — confirm WP-042 cross-reference
Select-String -Path "docs\ai\REFERENCE\00.5-validation.md" -Pattern "WP-042"
# Expected: at least one match

# Step 6 — confirm no scripts were modified
git diff --name-only scripts/
# Expected: no output

# Step 7 — confirm no files outside scope were changed
git diff --name-only
# Expected: only docs/ai/REFERENCE/00.5-validation.md
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
- [ ] Layer Boundary note identifies registry/data layer
- [ ] Stop-on-failure gate is explicit with warnings vs errors distinction
- [ ] WP-042 cross-reference present
- [ ] No existing validation checks were removed or weakened
- [ ] No scripts were modified
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — R2 validation gate aligned with governance
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why the validation gate
      remains a REFERENCE document; distinction from WP-042 deployment
      checklists; position in the Foundation Prompts sequence
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-046 checked off with today's date
