# EC-040 — Growth Governance & Change Budget (Execution Checklist)

**Source:** docs/ai/work-packets/WP-040-growth-governance-change-budget.md
**Layer:** Product Governance / Change Control

**Execution Authority:**
This EC is the authoritative execution checklist for WP-040.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-040.

---

## Before Starting

- [ ] WP-039 complete: live ops framework with metrics and cadence exists
- [ ] Release process with validation gates exists (WP-035)
- [ ] Versioning with three independent axes exists (WP-034)
- [ ] Engine invariants enforced (WP-031)
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-040.
If formatting, spelling, or ordering differs, the implementation is invalid.

- `ChangeCategory = 'ENGINE' | 'RULES' | 'CONTENT' | 'UI' | 'OPS'`
- `ChangeBudget = { release: string; engine: number; rules: number; content: number; ui: number; ops: number }`
- `ChangeClassification = { id: string; category: ChangeCategory; description: string; versionImpact: 'major' | 'minor' | 'patch' | 'none' }`
- ENGINE/RULES changes = major version impact
- CONTENT changes = content version impact
- UI changes = none (unless UIState changes)
- OPS changes = none
- Immutable surfaces (require major version): replay semantics, RNG behavior (`ctx.random.*`), scoring rules (`computeFinalScores`), engine invariants (WP-031), endgame conditions (`evaluateEndgame`)

---

## Guardrails

- Change classification is mandatory — no unclassified change ships
- Immutable surfaces require major version increment to change (D-1002)
- Content and UI are primary growth vectors (D-1003) — engine/rules carry heavy justification
- Change budgets are per-release — declared before development, expire at ship
- No engine modifications in this packet
- Governance types are metadata — never stored in `G`

---

## Required `// why:` Comments

- `governance.types.ts`: change budgets prevent entropy during growth (D-1001)

---

## Files to Produce

- `docs/governance/CHANGE_GOVERNANCE.md` — **new** — classification, immutable surfaces, budgets, vectors, reviews
- `packages/game-engine/src/governance/governance.types.ts` — **new** — ChangeCategory, ChangeBudget, ChangeClassification
- `packages/game-engine/src/types.ts` — **modified** — re-export governance types
- `packages/game-engine/src/index.ts` — **modified** — export governance types

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] Change governance doc exists with all sections
- [ ] Governance types not in `LegendaryGameState`
- [ ] No engine gameplay files modified (confirmed with `git diff`)
- [ ] `docs/ai/STATUS.md` updated
      (growth governance; change classification; D-1001, D-1002, D-1003)
- [ ] `docs/ai/DECISIONS.md` updated
      (five categories; content/UI as primary vectors; immutable surfaces)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-040 checked off with date
