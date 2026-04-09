# EC-046 — R2 Validation Governance Alignment (Execution Checklist)

**Source:** docs/ai/work-packets/WP-046-r2-validation-governance-alignment.md
**Layer:** Coordination / Execution Gate (Documentation)

**Execution Authority:**
This EC is the authoritative execution checklist for WP-046.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-046.

---

## Before Starting

- [ ] WP-001 complete: coordination system and REFERENCE docs established
- [ ] WP-045 complete or in-progress: connection health check governance aligned
- [ ] `docs/ai/REFERENCE/00.5-validation.md` exists (governed version)
- [ ] `docs/ai/ARCHITECTURE.md` exists with Layer Boundary section
- [ ] `.claude/rules/*.md` files exist
- [ ] `docs/ai/DECISIONS.md` exists

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-046.
If formatting, spelling, or ordering differs, the implementation is invalid.

- Foundation Prompts execution order: 00.4 -> 00.5 -> 01 -> 02
- R2 validation is a Foundation Prompt prerequisite, NOT a per-WP gate
- Warnings alone do not block execution; errors do

---

## Guardrails

- No validation checks may be added, removed, or weakened
- No modifications to `scripts/validate-r2.mjs`
- No modifications to `packages/registry/`
- No modifications to `.claude/rules/*.md` or `ARCHITECTURE.md`
- Validation gate remains a REFERENCE document (reusable preflight gate)
- R2 validation is a registry/data-layer concern — not game-engine or server logic
- Distinction from WP-042: 00.5 is reusable preflight; WP-042 is deployment procedures

---

## Required `// why:` Comments

- N/A — documentation-only packet

---

## Files to Produce

- `docs/ai/REFERENCE/00.5-validation.md` — **modified** — add subordination clause, Layer Boundary note, WP-042 distinction, stop-on-failure gate

---

## After Completing

- [ ] Header contains subordination clause naming ARCHITECTURE.md and `.claude/rules/*.md`
- [ ] Header distinguishes 00.5 (Foundation Prompt) from Lint Gate (per-WP)
- [ ] Layer Boundary note identifies registry/data layer; references `.claude/rules/registry.md`
- [ ] Stop-on-failure gate names Foundation Prompts 01, 02 as blocked on error
- [ ] Warnings vs errors distinction is explicit
- [ ] WP-042 cross-reference present
- [ ] No existing validation checks removed or weakened
- [ ] No scripts or registry files were modified
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` updated
      (why REFERENCE; distinction from WP-042; sequence position)
- [ ] `docs/ai/work-packets/WORK_INDEX.md`
      WP-046 checked off with date
