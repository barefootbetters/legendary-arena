# EC-045 — Connection Health Check Governance Alignment (Execution Checklist)

**Source:** docs/ai/work-packets/WP-045-connection-health-governance-alignment.md
**Layer:** Coordination / Execution Gate (Documentation)

**Execution Authority:**
This EC is the authoritative execution checklist for WP-045.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-045.

---

## Before Starting

- [ ] WP-001 complete: coordination system and REFERENCE docs established
- [ ] `docs/ai/REFERENCE/00.4-connection-health-check.md` exists (governed version)
- [ ] `docs/ai/ARCHITECTURE.md` exists with Layer Boundary section
- [ ] `.claude/rules/*.md` files exist
- [ ] `.claude/CLAUDE.md` exists with Lint Gate section
- [ ] `docs/ai/DECISIONS.md` exists

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-045.
If formatting, spelling, or ordering differs, the implementation is invalid.

- Foundation Prompts execution order: 00.4 -> 00.5 -> 01 -> 02
- Health check is a Foundation Prompt prerequisite, NOT a per-WP gate

---

## Guardrails

- No health checks may be added, removed, or weakened
- No modifications to `scripts/check-connections.mjs` or `scripts/Check-Env.ps1`
- No modifications to `.env.example`
- No modifications to `.claude/rules/*.md` or `ARCHITECTURE.md`
- Health check remains a REFERENCE document (reusable preflight gate)
- Health check scripts are server/ops layer — not game-engine or registry
- Do NOT merge into `.claude/rules/` — different purpose (preflight vs runtime)

---

## Required `// why:` Comments

- N/A — documentation-only packet

---

## Files to Produce

- `docs/ai/REFERENCE/00.4-connection-health-check.md` — **modified** — add subordination clause, Layer Boundary note, stop-on-failure gate

---

## After Completing

- [ ] Header contains subordination clause naming ARCHITECTURE.md and `.claude/rules/*.md`
- [ ] Header distinguishes health check (Foundation Prompt) from Lint Gate (per-WP)
- [ ] Layer Boundary note identifies server/ops layer; references `.claude/rules/server.md`
- [ ] Stop-on-failure gate names Foundation Prompts 00.5, 01, 02 as blocked on failure
- [ ] No existing health checks removed or weakened
- [ ] No scripts were modified
- [ ] No files outside scope were modified
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` updated
      (why REFERENCE, not WP; health check vs Lint Gate)
- [ ] `docs/ai/work-packets/WORK_INDEX.md`
      WP-045 checked off with date
