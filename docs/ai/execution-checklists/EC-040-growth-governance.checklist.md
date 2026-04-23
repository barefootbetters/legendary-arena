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
- [ ] `docs/ai/DECISIONS.md` contains D-3901 (reuse-not-parallel discipline
      binding on this packet's type definitions)
- [ ] `docs/ai/DECISIONS.md` contains **D-4001** classifying
      `packages/game-engine/src/governance/` as engine code category
      (PS-1 resolution; landed as part of the Commit A0 pre-flight bundle
      alongside this EC; D-2706 / D-2801 / D-3001 / D-3101 / D-3401 /
      D-3501 template)
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` reports 444 / 110 /
      0 (engine baseline unchanged since WP-039 close)

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

### D-3901 Reuse Verification (Binding)

Each proposed new type must pass the D-3901 reuse-verification check before
execution. Verification was run at pre-flight v1 (2026-04-23) and all four
types returned **genuinely novel** (4/4 PASS) against
`packages/game-engine/src/`:

| Type | Grep over `packages/game-engine/src/` | Result |
|---|---|---|
| `ChangeCategory` | `rg "ChangeCategory"` | No files found — genuinely novel |
| `ChangeBudget` | `rg "Budget"` | No files found — genuinely novel |
| `ChangeClassification` | `rg "ChangeClassification"` | No files found — genuinely novel |
| `immutableSurface?: 'replay'\|'rng'\|'scoring'\|'invariants'\|'endgame'` | `rg "ImmutableSurface\|immutableSurface"` | No files found — genuinely novel |

No canonical `CHANGE_CATEGORIES` readonly array is required because
`ChangeCategory` is metadata-only and never used to branch runtime
gameplay — the drift-detection discipline for canonical arrays applies only
to runtime-typed unions consumed by `G`, moves, or rule hooks. D-3901
reuse-verification clause 4 applies.

Any future addition to any of these four types (new category, new budget
field, new classification field, new immutable surface literal) requires a
fresh D-3901 reuse-verification run + a new D-entry in `docs/ai/DECISIONS.md`.

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
- `docs/ai/post-mortems/01.6-WP-040-growth-governance-change-budget.md` — **new** — post-mortem landed in Commit A alongside execution content, per the WP-039 Commit-A precedent (`4b1cf5c`); triggered by new-long-lived-abstraction-document + new-code-category-directory + new-type-contracts conditions

Any additional file change in Commit A FAILS this EC.

---

## After Completing (Binary Verification)

All checks below MUST pass.

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` reports **444 / 110 / 0** (baseline unchanged; no new tests, no regressions)
- [ ] `pnpm -r test` reports **596 / 0** across all packages (baseline unchanged)
- [ ] `docs/governance/CHANGE_GOVERNANCE.md` exists and contains all required sections
- [ ] Governance types are NOT fields of `LegendaryGameState`
- [ ] `git diff --name-only packages/game-engine/src/game.ts packages/game-engine/src/moves/ packages/game-engine/src/rules/` → **empty output** (no engine gameplay files modified)
- [ ] Aggregate working-tree diff across all WP-040 commits is limited to EXACTLY:
  - The **five** content files in **## Files to Produce** above (four governance-content files plus the post-mortem), plus
  - `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md`, `docs/ai/DECISIONS_INDEX.md`, `docs/ai/work-packets/WORK_INDEX.md`, and `docs/ai/execution-checklists/EC_INDEX.md` (governance-close only).

  Any additional path returned by `git diff --name-only` FAILS this EC.
- [ ] `docs/ai/STATUS.md` updated with the canonical Phase 7 closure language:
      *"Phase 7 complete: Growth governance enforced. Change classification mandatory. Immutable surfaces protected. D-1001 / D-1002 / D-1003 fully implemented."*
- [ ] `docs/ai/DECISIONS.md` updated — P6-51 placement **form (2)** (prose-in-produced-doc with D-entry back-pointers). Three back-pointer D-entries land in Commit B:
  - **D-4002** — back-pointer citing `docs/governance/CHANGE_GOVERNANCE.md §Change Classification` (five categories, layer-boundary mapping rationale)
  - **D-4003** — back-pointer citing `docs/governance/CHANGE_GOVERNANCE.md §Growth Vectors` (content/UI as primary vectors rationale)
  - **D-4004** — back-pointer citing `docs/governance/CHANGE_GOVERNANCE.md §Immutable Surfaces` (replay / RNG / scoring / invariants / endgame definition rationale)

  Each back-pointer D-entry is a first-class `docs/ai/DECISIONS.md` entry with its own `docs/ai/DECISIONS_INDEX.md` row per P6-51 prevention clause. **D-4001** (PS-1) lands earlier with the Commit A0 pre-flight bundle, not in Commit B.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` shows WP-040 checked off with date
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` shows EC-040 moved Draft → Done; Done counter 12 → 13; Draft counter 48 → 47

---

## Execution Verdict

WP-040 is considered **successfully executed** only when **all** items above pass.

Partial completion is not permitted.
