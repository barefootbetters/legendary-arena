# EC-040 — Growth Governance & Change Budget (Execution Checklist)

**Source:** docs/ai/work-packets/WP-040-growth-governance-change-budget.md
**Layer:** Product Governance / Change Control

---

## Execution Authority

This Execution Checklist is the **authoritative execution contract** for WP-040.

All items are **mandatory and literal**.
No interpretation, substitution, or semantic equivalence is permitted.

Failure to satisfy **any single item** below constitutes a failed execution of WP-040.

---

## Before Starting (Hard Blocks)

Execution MUST NOT BEGIN unless all items below are true.

- [ ] WP-039 complete — live ops framework with metrics and cadence exists
- [ ] Release process with validation gates exists (WP-035)
- [ ] Versioning with three independent axes exists (WP-034)
- [ ] Engine invariants enforced (WP-031)
- [ ] `docs/ai/DECISIONS.md` exists and contains D-1001, D-1002, D-1003
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0

If any item fails, STOP. Do not proceed.

---

## Locked Values (Do Not Re-derive)

All items below MUST be copied **verbatim** from WP-040.
Any deviation in spelling, casing, ordering, or structure — **even if meaning appears identical** — FAILS this EC.

### Types

- `ChangeCategory = 'ENGINE' | 'RULES' | 'CONTENT' | 'UI' | 'OPS'`
- `ChangeBudget = { release: string; engine: number; rules: number; content: number; ui: number; ops: number }`
- `ChangeClassification = { id: string; category: ChangeCategory; description: string; versionImpact: 'major' | 'minor' | 'patch' | 'none'; immutableSurface?: 'replay' | 'rng' | 'scoring' | 'invariants' | 'endgame' }`

### Version Impact Rules

- ENGINE changes → **major version**
- RULES changes → **major version** (affects replay determinism and scoring semantics)
- CONTENT changes → **content version**
- UI changes → **none** (unless UIState changes)
- OPS changes → **none**

### Immutable Surfaces (Major Version Required)

- Replay semantics
- RNG behavior (`ctx.random.*`)
- Scoring rules (`computeFinalScores`)
- Engine invariants (WP-031)
- Endgame conditions (`evaluateEndgame`)

---

## Guardrails (Non-Negotiable)

- Change classification is mandatory — **no unclassified change may ship**
- Every proposed change is classified into **exactly one** of the five categories — no hybrids, no "miscellaneous", no split ownership
- Immutable surfaces may not change without a **major version** (D-1002)
- Content and UI are the **primary growth vectors** (D-1003); ENGINE and RULES changes carry a heavy justification burden
- Change budgets are **per-release** — declared before development, expire at ship
- RULES change budget: **0 by default; at most 1 per release and only with simulation validation**
- **No engine gameplay modifications** in this packet
- Governance types are **out-of-band metadata** only:
  - Never stored in `LegendaryGameState`
  - Never persisted to any database
  - Never transmitted in replay logs
  - Never used to branch runtime gameplay behavior

Violation of any guardrail FAILS this EC.

---

## Required `// why:` Comments

The comment below MUST appear in `governance.types.ts` exactly as specified.

- `governance.types.ts` includes a `// why:` comment stating:
  > change budgets prevent entropy during growth (D-1001)

Omission, paraphrase, or relocation FAILS this EC.

---

## Files to Produce (Exact Set)

Only the files listed below may be created or modified during EC-040 execution (Commit A content). Governance-close updates (Commit B) are listed separately in **## After Completing**.

- `docs/governance/CHANGE_GOVERNANCE.md` — **new** — classification, immutable surfaces, budgets, growth vectors, review requirements
- `packages/game-engine/src/governance/governance.types.ts` — **new** — `ChangeCategory`, `ChangeBudget`, `ChangeClassification`
- `packages/game-engine/src/types.ts` — **modified** — re-export governance types only
- `packages/game-engine/src/index.ts` — **modified** — export governance types

Any additional file change in Commit A FAILS this EC.

---

## After Completing (Binary Verification)

All checks below MUST pass.

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `docs/governance/CHANGE_GOVERNANCE.md` exists and contains all required sections
- [ ] Governance types are NOT fields of `LegendaryGameState`
- [ ] `git diff --name-only packages/game-engine/src/game.ts packages/game-engine/src/moves/ packages/game-engine/src/rules/` → **empty output** (no engine gameplay files modified)
- [ ] Aggregate working-tree diff across all WP-040 commits is limited to EXACTLY:
  - The four content files in **## Files to Produce** above, plus
  - `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md`, and `docs/ai/work-packets/WORK_INDEX.md` (governance-close only).

  Any additional path returned by `git diff --name-only` FAILS this EC.
- [ ] `docs/ai/STATUS.md` updated with the canonical Phase 7 closure language:
      *"Phase 7 complete: Growth governance enforced. Change classification mandatory. Immutable surfaces protected. D-1001 / D-1002 / D-1003 fully implemented."*
- [ ] `docs/ai/DECISIONS.md` updated (five categories; content/UI as primary vectors; immutable surface definition)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` shows WP-040 checked off with date

---

## Execution Verdict

WP-040 is considered **successfully executed** only when **all** items above pass.

Partial completion is not permitted.
