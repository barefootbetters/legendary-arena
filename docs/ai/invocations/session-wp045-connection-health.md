# Session Invocation — WP-045: Connection Health Check Governance Alignment

---

### Session Header

**Work Packet:** `WP-045`
**Title:** Connection Health Check Governance Alignment
**Work Packet Class:** Contract-Only (documentation only — no TypeScript)
**Pre-Flight:** `docs/ai/invocations/preflight-wp045-connection-health.md` — READY
**Date:** 2026-04-10

---

### Session Intent

Execute WP-045 exactly as scoped. Add governance alignment (subordination
clause, Layer Boundary note, Foundation Prompt vs Lint Gate distinction,
stop-on-failure execution gate) to
`docs/ai/REFERENCE/00.4-connection-health-check.md`. Then update STATUS.md,
DECISIONS.md, and WORK_INDEX.md.

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
5. `.claude/rules/server.md` — server-layer governance (health check scripts
   are server/ops layer tooling)
6. `docs/ai/execution-checklists/EC-045-connection-health.checklist.md`
7. `docs/ai/work-packets/WP-045-connection-health-governance-alignment.md`
8. `docs/ai/REFERENCE/00.4-connection-health-check.md` — the file being modified

---

### Locked Decisions (From Pre-Flight — Must Not Be Revisited)

#### Locked Decision 1 — Layer Boundary Cross-References (Inherited from WP-044)

The "Layer Boundary (Authoritative)" heading lives in
`.claude/rules/architecture.md` (line 123), **not** in
`docs/ai/ARCHITECTURE.md` as a single heading.

Therefore:
- Cross-references added by WP-045 must point to:
  - `.claude/rules/architecture.md` — "Layer Boundary (Authoritative)" for
    the synthesized enforcement view
  - `docs/ai/ARCHITECTURE.md` — Section 1 and Section 5 for the source material
- This decision is locked by pre-flight and must not be revisited.

#### Locked Decision 2 — Health Check vs Lint Gate Distinction

The two gates serve different purposes at different times:

| Gate | Document | Scope | When |
|---|---|---|---|
| Health Check | `00.4-connection-health-check.md` | Foundation Prompt prerequisite | Runs **once** before WP execution begins |
| Lint Gate | `00.3-prompt-lint-checklist.md` | Per-WP quality gate | Runs **before each** WP execution |

The health check is **not** a per-WP gate. The Lint Gate is **not** a
Foundation Prompt prerequisite. They must not be confused.

#### Locked Decision 3 — Foundation Prompt Execution Order

The locked execution order is: `00.4 -> 00.5 -> 01 -> 02`

If 00.4 fails, all subsequent Foundation Prompts and all Work Packets are
BLOCKED. This is a hard gate, not best-effort.

#### Locked Decision 4 — Health Check Remains as REFERENCE

The health check document remains a REFERENCE document (reusable Foundation
Prompt gate). It is **not** merged into `.claude/rules/`. The distinction:
- Health check: Foundation Prompt prerequisite (runs once, produces scripts)
- `.claude/rules/*.md`: runtime enforcement (loaded automatically by Claude Code)

This decision must be recorded in DECISIONS.md.

---

### Locked Quantities (Hard Failure If Changed)

`docs/ai/REFERENCE/00.4-connection-health-check.md` currently has:

| Metric | Current Count | Constraint |
|---|---|---|
| `##` section headers | 18 | Must be **18 or 19** after changes (new Execution Gate section allowed) |

Governance notes are added as **prose** (blockquotes or paragraphs). The
existing document structure, scripts, acceptance criteria, and verification
steps must not be altered.

---

### Scope — Hard Allowlist

#### Files Allowed to Change

| File | Action | What Changes |
|---|---|---|
| `docs/ai/REFERENCE/00.4-connection-health-check.md` | Modified | Subordination clause, Layer Boundary note, Execution Gate section |
| `docs/ai/STATUS.md` | Updated | Connection health check aligned with governance |
| `docs/ai/DECISIONS.md` | Updated | Why health check remains REFERENCE; health check vs Lint Gate |
| `docs/ai/work-packets/WORK_INDEX.md` | Updated | WP-045 checked off with date |

#### Scope Enforcement (Hard)

- **No files under `packages/` or `apps/` may be modified.**
- **No `.claude/rules/*.md` files may be modified.**
- **No `docs/ai/ARCHITECTURE.md` modifications.**
- **No `scripts/` files may be modified** (`check-connections.mjs`,
  `Check-Env.ps1`).
- **No `.env.example` modifications.**
- Any change outside the allowlist above is a **hard failure**.

---

### What WP-045 Must NOT Do

- No health checks added, removed, or weakened
- No script modifications
- No `.env.example` changes
- No existing document content reworded, split, or merged
- No "while I'm here" improvements or refactoring
- No TypeScript code produced
- No modifications to `.claude/rules/*.md`

**Rule:** WP-045 may only codify and normalize existing governance
relationships. It must not invent new requirements or expand scope beyond
what already exists in the authority chain.

---

### Exact Changes to `00.4-connection-health-check.md`

#### Change 1 — Header Subordination Clause

After the existing `> **Relationship to coordination system:**` paragraph
(line 14–17), add new paragraphs inside the blockquote:

```markdown
>
> **Subordination:** This document is subordinate to:
> - `docs/ai/ARCHITECTURE.md` (system architecture — Section 1, Section 5)
> - `.claude/rules/*.md` (runtime enforcement during execution)
>
> This health check is a **Foundation Prompt prerequisite** — it runs before
> any Work Packet execution begins. It is not a per-WP gate (that role
> belongs to the Prompt Lint Checklist, `00.3`).
>
> If this health check fails, all subsequent Foundation Prompts (00.5, 01, 02)
> and all Work Packets are BLOCKED until failures are resolved.
>
> If this document conflicts with ARCHITECTURE.md or `.claude/rules/*.md`,
> this document must be updated to match — not the other way around.
```

#### Change 2 — Layer Boundary Note

After the `---` separator following the header blockquote (line 19), before
`## Goal` (line 21), add:

```markdown
> **Layer Boundary:** This document produces server/ops developer tooling.
> It does not touch game-engine logic, registry internals, or game state.
> Per `.claude/rules/architecture.md` ("Layer Boundary (Authoritative)"),
> health check scripts belong to the server/ops layer. Future script
> modifications are governed by `.claude/rules/server.md`.

---
```

#### Change 3 — Execution Gate Section

After `## Hard Constraints` (the last existing section, line 638+), add a
new section at the end of the document:

```markdown
---

## Execution Gate

This health check is a hard gate in the Foundation Prompt sequence.

If any check fails:
- Do NOT proceed to Foundation Prompt 00.5 (R2 Data & Image Validation)
- Do NOT proceed to Foundation Prompt 01 (Render.com Backend Setup)
- Do NOT proceed to Foundation Prompt 02 (Database Migrations)
- Do NOT execute any Work Packet

Fix the failure first, re-run the health check, and confirm all checks pass.

Partial or "best effort" execution is not acceptable. The Foundation Prompt
sequence is: `00.4 -> 00.5 -> 01 -> 02`. Each step depends on the prior
step completing successfully.
```

---

### Stop Conditions (Mandatory)

**STOP and report** if any of the following occur during execution:

- Any existing health check content would need to be removed or weakened
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
grep -c "subordinate to" docs/ai/REFERENCE/00.4-connection-health-check.md
# Expected: >= 1

# 2. Confirm Layer Boundary reference
grep -c "Layer Boundary" docs/ai/REFERENCE/00.4-connection-health-check.md
# Expected: >= 1

# 3. Confirm .claude/rules reference
grep -c "\.claude/rules" docs/ai/REFERENCE/00.4-connection-health-check.md
# Expected: >= 1

# 4. Confirm stop-on-failure gate
grep -c "Do NOT proceed" docs/ai/REFERENCE/00.4-connection-health-check.md
# Expected: >= 1

# 5. Confirm Foundation Prompt vs Lint Gate distinction
grep -c "per-WP gate" docs/ai/REFERENCE/00.4-connection-health-check.md
# Expected: >= 1

# 6. Count section headers
grep -c "^## " docs/ai/REFERENCE/00.4-connection-health-check.md
# Expected: 19 (was 18, +1 Execution Gate)

# 7. Confirm no scripts were modified
git diff --name-only scripts/
# Expected: no output

# 8. Confirm no files outside scope were changed
git diff --name-only
# Expected: only files listed in the hard allowlist above

# 9. Game engine tests still pass
cd packages/game-engine && pnpm test
# Expected: 89 tests passing, 0 failures
```

---

### Execution Order

1. Read the full `00.4-connection-health-check.md` (already in authority chain)
2. Apply Change 1 (header subordination clause)
3. Apply Change 2 (Layer Boundary note after header)
4. Apply Change 3 (Execution Gate section at end)
5. Run all verification commands
6. Update `docs/ai/STATUS.md`
7. Update `docs/ai/DECISIONS.md` (why health check stays REFERENCE;
   health check vs Lint Gate distinction)
8. Update `docs/ai/work-packets/WORK_INDEX.md` (WP-045 checked off)
9. Run `git diff --name-only` — confirm only allowlisted files changed

---

### Runtime Wiring Allowance

**Not applicable.** WP-045 is documentation-only. No TypeScript files are
created or modified. No new fields, types, moves, or phase hooks are
introduced. The conditions in
`docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md` are not met.

---

### Final Instruction

Execute the changes above **exactly as specified**. Do not add, remove,
or reword anything beyond what is listed in the "Exact Changes" section.
If uncertainty arises, stop and ask — do not guess.
