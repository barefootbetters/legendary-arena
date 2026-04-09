# EC-044 — Prompt Lint Governance Alignment (Execution Checklist)

**Source:** docs/ai/work-packets/WP-044-prompt-lint-governance-alignment.md
**Layer:** Coordination / Quality Gate (Documentation)

**Execution Authority:**
This EC is the authoritative execution checklist for WP-044.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-044.

---

## Before Starting

- [ ] WP-001 complete: coordination system and REFERENCE docs established
- [ ] `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` exists (governed version)
- [ ] `docs/ai/ARCHITECTURE.md` exists with Layer Boundary section
- [ ] `.claude/rules/*.md` files exist (architecture, game-engine, server, registry, persistence, code-style, work-packets)
- [ ] `docs/ai/DECISIONS.md` exists

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-044.
If formatting, spelling, or ordering differs, the implementation is invalid.

- N/A — no contract values; governance alignment only

---

## Guardrails

- No lint rules may be added, removed, or weakened
- No modifications to `.claude/rules/*.md` — those files are correct as-is
- No modifications to `ARCHITECTURE.md`
- No modifications to `packages/` or `apps/`
- Checklist remains a REFERENCE document (reusable quality gate) — do NOT merge into `.claude/rules/`
- If an existing checklist item conflicts with ARCHITECTURE.md or `.claude/rules/*.md`, flag it — do not silently modify or remove

---

## Required `// why:` Comments

- N/A — documentation-only packet

---

## Files to Produce

- `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` — **modified** — add subordination clause, Layer Boundary references in sections 4, 8, and 16

---

## After Completing

- [ ] Header contains subordination clause naming ARCHITECTURE.md and `.claude/rules/*.md`
- [ ] Header states conflicts resolved by updating checklist, not authorities
- [ ] Section 4 includes Layer Boundary reference check
- [ ] Section 8 opens with Layer Boundary as authoritative, `.claude/rules/*.md` as runtime enforcement
- [ ] Section 16 opens with note naming `00.6-code-style.md` and `.claude/rules/code-style.md`
- [ ] No existing checklist items removed or weakened (checkbox count preserved)
- [ ] No files outside scope were modified
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` updated
      (why checklist stays as REFERENCE, not merged into rules)
- [ ] `docs/ai/work-packets/WORK_INDEX.md`
      WP-044 checked off with date
