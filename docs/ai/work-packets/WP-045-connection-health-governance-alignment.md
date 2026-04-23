# WP-045 — Connection Health Check Governance Alignment

**Status:** Complete
**Primary Layer:** Coordination / Execution Gate
**Dependencies:** WP-001

---

## Session Context

WP-001 established the coordination system and REFERENCE docs. The governed
version of the connection health check (`docs/ai/REFERENCE/00.4-connection-health-check.md`)
was created as part of the Foundation Prompts and already produces two scripts
(`scripts/check-connections.mjs` and `scripts/Check-Env.ps1`) plus a definitive
`.env.example`. However, it predates the `.claude/rules/*.md` enforcement layer,
the Layer Boundary section in ARCHITECTURE.md, and the Lint Gate in CLAUDE.md.
This packet aligns it with the current governance structure without changing
its role as a reusable preflight gate.

---

## Goal

Update the governed connection health check to properly reference the authority
hierarchy, Layer Boundary, and `.claude/rules/*.md` enforcement layer. After
this session:

- The health check explicitly declares subordination to ARCHITECTURE.md
- The health check explicitly states it is a server/ops concern per the
  Layer Boundary (it does not touch game-engine logic)
- The health check notes that `.claude/rules/server.md` governs server-layer
  modifications if any script changes are needed
- The relationship to the Lint Gate in `.claude/CLAUDE.md` is documented
  (the health check is a Foundation Prompt prerequisite, not a per-WP gate)
- Failure conditions are explicit: if the health check fails, execution of
  Foundation Prompts 00.5, 01, and 02 is blocked
- No health checks are added, removed, or weakened

---

## Assumes

- WP-001 complete: coordination system and REFERENCE docs established
- `docs/ai/REFERENCE/00.4-connection-health-check.md` exists (governed version)
- `docs/ai/ARCHITECTURE.md` exists with Layer Boundary section
- `.claude/rules/*.md` files exist
- `.claude/CLAUDE.md` exists with Lint Gate section
- `docs/ai/DECISIONS.md` exists

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md — "Layer Boundary (Authoritative)"` — the health
  check scripts live in the server/ops layer. They are developer tooling, not
  game logic. They must not touch `packages/game-engine/` or
  `packages/registry/src/`.
- `.claude/rules/server.md` — if any health check script modifications are
  needed in the future, server rules govern. This packet does not modify
  scripts but should cross-reference server rules.
- `.claude/CLAUDE.md — "Lint Gate"` — the Lint Gate applies to Work Packet
  actions. The health check is a Foundation Prompt prerequisite — a different
  enforcement mechanism. The two must not be confused.
- `docs/ai/REFERENCE/00.4-connection-health-check.md` — the governed version
  to be updated. Read it entirely before modifying.
- `docs/ai/work-packets/WORK_INDEX.md — Foundation Prompts table` — confirms
  00.4 runs first, before 00.5, 01, and 02. Failure blocks all subsequent
  Foundation Prompts.

---

## Non-Negotiable Constraints

**Applicable constraints:**
- This packet produces a **documentation update**, not TypeScript code
- No health checks may be added, removed, or weakened
- No modifications to `scripts/check-connections.mjs` or `scripts/Check-Env.ps1`
- No modifications to `.claude/rules/*.md`
- No modifications to `ARCHITECTURE.md`
- The health check remains a REFERENCE document (reusable preflight gate)

**Packet-specific:**
- The health check must explicitly state it **cannot override** ARCHITECTURE.md
  or `.claude/rules/*.md`
- The header must include a subordination clause
- The Layer Boundary must be referenced: health check scripts are server/ops
  layer, not game-engine or registry
- The Foundation Prompts execution order (00.4 -> 00.5 -> 01 -> 02) must be
  noted with explicit stop-on-failure semantics
- Do NOT merge the health check into `.claude/rules/` — they serve different
  purposes

**Session protocol:**
- If any existing health check item appears to conflict with ARCHITECTURE.md
  or `.claude/rules/*.md`, flag it explicitly

---

## Scope (In)

### A) `docs/ai/REFERENCE/00.4-connection-health-check.md` — modified

Update the governed health check with the following changes:

**Header update:**
- Add a subordination clause after the existing header blockquote:
  ```
  This document is subordinate to:
  - `docs/ai/ARCHITECTURE.md` (system architecture and Layer Boundary)
  - `.claude/rules/*.md` (runtime enforcement during execution)

  The health check is a **Foundation Prompt prerequisite** — it runs before
  any Work Packet execution begins. It is not a per-WP gate (that role
  belongs to the Prompt Lint Checklist, `00.3`).

  If this health check fails, all subsequent Foundation Prompts (00.5, 01, 02)
  and all Work Packets are BLOCKED until failures are resolved.
  ```

**Layer Boundary note:**
- Add a note near the top (after the header):
  ```
  Layer Boundary: This document produces server/ops developer tooling.
  It does not touch game-engine logic, registry internals, or game state.
  Script modifications are governed by `.claude/rules/server.md`.
  ```

**Stop-on-failure semantics:**
- If not already explicit, add at the end of the document:
  ```
  ## Execution Gate

  This health check is a hard gate. If any check fails:
  - Do NOT proceed to Foundation Prompt 00.5
  - Do NOT proceed to Foundation Prompt 01 or 02
  - Do NOT execute any Work Packet
  - Fix the failure first, re-run the health check, confirm all pass

  Partial or "best effort" execution is not acceptable.
  ```

---

## Out of Scope

- **No new health checks** — this packet adds governance alignment, not checks
- **No script modifications** — `check-connections.mjs` and `Check-Env.ps1`
  are not changed
- **No `.env.example` changes** — the definitive version is already produced
- **No modifications to `.claude/rules/*.md`**
- **No modifications to `ARCHITECTURE.md`**
- **No code changes** — documentation-only packet
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**

---

## Files Expected to Change

- `docs/ai/REFERENCE/00.4-connection-health-check.md` — **modified** — add
  subordination clause, Layer Boundary note, stop-on-failure gate

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Subordination
- [ ] Header contains a subordination clause naming ARCHITECTURE.md and
      `.claude/rules/*.md`
- [ ] Header distinguishes the health check (Foundation Prompt prerequisite)
      from the Lint Gate (per-WP gate)

### Layer Boundary
- [ ] Document contains a Layer Boundary note identifying it as server/ops
      layer tooling
- [ ] Document references `.claude/rules/server.md` for script governance

### Execution Gate
- [ ] Document contains explicit stop-on-failure semantics
- [ ] Stop conditions name Foundation Prompts 00.5, 01, 02 as blocked on failure

### No Check Changes
- [ ] No existing health check items were removed or weakened
- [ ] No new health checks were added

### Scope Enforcement
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — confirm subordination clause exists
Select-String -Path "docs\ai\REFERENCE\00.4-connection-health-check.md" -Pattern "subordinate to"
# Expected: at least one match

# Step 2 — confirm Layer Boundary reference
Select-String -Path "docs\ai\REFERENCE\00.4-connection-health-check.md" -Pattern "Layer Boundary|server/ops"
# Expected: at least one match

# Step 3 — confirm .claude/rules reference
Select-String -Path "docs\ai\REFERENCE\00.4-connection-health-check.md" -Pattern "\.claude/rules"
# Expected: at least one match

# Step 4 — confirm stop-on-failure gate
Select-String -Path "docs\ai\REFERENCE\00.4-connection-health-check.md" -Pattern "BLOCKED|Do NOT proceed"
# Expected: at least one match

# Step 5 — confirm no scripts were modified
git diff --name-only scripts/
# Expected: no output

# Step 6 — confirm no files outside scope were changed
git diff --name-only
# Expected: only docs/ai/REFERENCE/00.4-connection-health-check.md
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
- [ ] Layer Boundary note identifies server/ops layer
- [ ] Stop-on-failure gate is explicit
- [ ] No existing health checks were removed or weakened
- [ ] No scripts were modified
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — connection health check aligned with
      governance layer
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why the health check
      remains a REFERENCE document (reusable Foundation Prompt gate) rather
      than a Work Packet; distinction between the health check gate
      (Foundation Prompts) and the Lint Gate (Work Packets)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-045 checked off with today's date
