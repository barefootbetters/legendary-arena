# WP-040 — Growth Governance & Change Budget

**Status:** Ready  
**Primary Layer:** Product Governance / Change Control / Sustainable Growth  
**Dependencies:** WP-039

---

## Session Context

WP-039 established live ops with four metric categories and cadence. WP-035
defined the release process. WP-034 introduced versioning with three
independent axes. WP-031 enforced engine invariants. This packet defines the
governance framework for long-term growth — what is allowed to change, how
fast, and under what constraints. It prevents accidental architectural
regression via success. Every release has an explicit change budget; every
change is classified before it ships. This implements D-1001 (Growth Requires
Explicit Change Budgets), D-1002 (Immutable Surfaces Are Protected), and
D-1003 (Content and UI Are Primary Growth Vectors).

---

## Goal

Establish a formal growth governance framework. After this session:

- A change classification system categorizes every proposed change into exactly
  one of five categories: ENGINE, RULES, CONTENT, UI, OPS
- Each category has explicit constraints on what may change and what requires
  version increments
- Immutable surfaces are defined: replay semantics, RNG behavior, scoring
  rules, and engine invariants cannot change without a major version increment
- A change budget template exists for each release — declares allowed scope
  per category
- Primary growth vectors are identified: content and UI changes are encouraged;
  engine and rules changes require heavy justification
- This packet produces **documentation and type definitions** — no engine
  modifications

---

## Assumes

- WP-039 complete. Specifically:
  - Live ops framework exists with metrics and cadence (WP-039)
  - Release process with validation gates exists (WP-035)
  - Versioning with three independent axes exists (WP-034)
  - Engine invariants enforced (WP-031)
  - AI simulation baselines for balance validation (WP-036)
  - `pnpm --filter @legendary-arena/game-engine build` exits 0
  - `pnpm --filter @legendary-arena/game-engine test` exits 0
- `docs/ai/ARCHITECTURE.md` exists with "MVP Gameplay Invariants"
- `docs/ai/DECISIONS.md` exists with D-1001, D-1002, D-1003

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md — "MVP Gameplay Invariants"` — read all sections.
  These define what must remain true as the game grows. Growth governance
  protects these invariants.
- `docs/ai/ARCHITECTURE.md — "Layer Boundary (Authoritative)"` — change
  classification maps to layers: ENGINE = game-engine, RULES = game-engine
  rules, CONTENT = registry/data, UI = client, OPS = server/deployment.
- `docs/ai/DECISIONS.md` — read D-1001 (Growth Requires Explicit Change
  Budgets). Every release declares allowed change scope.
- `docs/ai/DECISIONS.md` — read D-1002 (Immutable Surfaces Are Protected).
  Replay semantics, rules, RNG behavior, and scoring cannot change without
  major version.
- `docs/ai/DECISIONS.md` — read D-1003 (Content and UI Are Primary Growth
  Vectors). Growth prioritizes content, onboarding, and UI — not engine or
  rules.
- `docs/ai/DECISIONS.md` — read D-0801 (Explicit Version Axes). Change
  classification determines which version axis is affected.
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 4 (no abbreviations),
  Rule 13 (ESM only).

---

## Non-Negotiable Constraints

**Packet-specific:**
- This packet produces **documentation and type definitions** — no engine
  gameplay logic
- Change classification is **mandatory** — no change ships without
  classification
- Immutable surfaces are **non-negotiable** — replay semantics, RNG behavior,
  scoring rules, engine invariants require major version increment to change
  (D-1002)
- Content and UI are the **primary growth vectors** (D-1003) — engine and
  rules changes carry heavy justification burden
- Change budgets are per-release — they expire when the release ships
- No engine modifications in this packet
- Classification types are metadata — never stored in `G`

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding

**Locked contract values:**

- **Five change categories:**

  | Category | Layer | Example changes | Version impact |
  |---|---|---|---|
  | ENGINE | game-engine core | Move contract, phase logic, invariants | Major |
  | RULES | game-engine rules | Hook behavior, keyword semantics, conditions | Major |
  | CONTENT | registry/data | New heroes, villains, schemes, sets | Content version |
  | UI | client | Layout, animations, display, onboarding | None (unless UIState changes) |
  | OPS | server/deployment | Infrastructure, monitoring, deployment | None |

- **Immutable surfaces (require major version):**
  Replay semantics, RNG behavior (`ctx.random.*`), scoring rules
  (`computeFinalScores`), engine invariants (WP-031), endgame conditions
  (`evaluateEndgame`)

---

## Scope (In)

### A) `docs/governance/CHANGE_GOVERNANCE.md` — new

Comprehensive change governance document covering:

**Change Classification System:**
- Five categories: ENGINE, RULES, CONTENT, UI, OPS
- Every proposed change classified into exactly one category before shipping
- Classification determines: review requirements, version impact, testing
  requirements, rollback complexity

**Immutable Surfaces:**
- Replay semantics — identical inputs must always produce identical outputs
- RNG behavior — `ctx.random.*` contracts cannot change
- Scoring rules — `computeFinalScores` contract cannot change
- Engine invariants — WP-031 categories cannot be weakened
- Endgame conditions — `evaluateEndgame` contract cannot change
- Any change to an immutable surface requires: major version increment,
  migration path, and explicit DECISIONS.md entry

**Change Budget Template:**
- Per-release budget declaring: number of ENGINE changes (usually 0), number
  of RULES changes (0 or 1 with simulation validation), number of CONTENT
  additions (uncapped but validated), number of UI changes (encouraged), number
  of OPS changes (as needed)
- Budget is declared before release development begins
- Overruns require explicit approval and DECISIONS.md entry

**Growth Vectors:**
- Primary (encouraged): CONTENT additions, UI improvements, OPS hardening
- Secondary (justified): RULES refinements with simulation backing
- Restricted (exceptional): ENGINE changes with architectural review
- Forbidden without major version: immutable surface changes

**Review Requirements by Category:**
- ENGINE: architecture review + DECISIONS.md + full replay verification
- RULES: simulation validation (WP-036) + DECISIONS.md
- CONTENT: content validation (WP-033) only
- UI: standard code review
- OPS: ops review + rollback test

### B) `src/governance/governance.types.ts` — new

- `type ChangeCategory = 'ENGINE' | 'RULES' | 'CONTENT' | 'UI' | 'OPS'`
- `interface ChangeBudget { release: string; engine: number; rules: number; content: number; ui: number; ops: number }`
- `interface ChangeClassification { id: string; category: ChangeCategory; description: string; versionImpact: 'major' | 'minor' | 'patch' | 'none' }`
- All types JSON-serializable — metadata, never stored in G
- `// why:` comment: change budgets prevent entropy during growth (D-1001)

### C) `src/types.ts` — modified

- Re-export governance types

### D) `src/index.ts` — modified

- Export governance types

---

## Out of Scope

- **No change tracking implementation** — types are defined; tracking tooling
  is ops
- **No automated budget enforcement** — budgets are declared and reviewed
  manually
- **No monetization governance**
- **No community contribution governance** — future concern
- **No engine modifications**
- **No server or UI changes**
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above

---

## Files Expected to Change

- `docs/governance/CHANGE_GOVERNANCE.md` — **new** — change classification,
  immutable surfaces, budgets, growth vectors, review requirements
- `packages/game-engine/src/governance/governance.types.ts` — **new** —
  ChangeCategory, ChangeBudget, ChangeClassification
- `packages/game-engine/src/types.ts` — **modified** — re-export governance
  types
- `packages/game-engine/src/index.ts` — **modified** — export governance types

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Change Classification
- [ ] `docs/governance/CHANGE_GOVERNANCE.md` exists with all sections
- [ ] Five categories defined: ENGINE, RULES, CONTENT, UI, OPS
- [ ] Each category has: version impact, review requirements, examples
- [ ] Classification is mandatory — no unclassified changes

### Immutable Surfaces
- [ ] Immutable surfaces listed: replay, RNG, scoring, invariants, endgame
- [ ] Major version required for immutable surface changes
- [ ] Migration path required for immutable surface changes

### Change Budget
- [ ] Budget template exists with per-category allowances
- [ ] Budget is per-release (declared before development)
- [ ] Overruns require explicit approval

### Growth Vectors
- [ ] Primary vectors: CONTENT, UI (encouraged)
- [ ] Restricted: ENGINE (exceptional)
- [ ] Forbidden without major version: immutable surfaces

### Governance Types
- [ ] `ChangeCategory` is a closed union of 5 values
- [ ] `ChangeBudget` has per-category numeric fields
- [ ] Types are NOT part of `LegendaryGameState`
- [ ] Types are JSON-serializable

### Build
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0

### Scope Enforcement
- [ ] No engine gameplay files modified
      (confirmed with `git diff --name-only`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — build after adding governance types
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — confirm governance doc exists
Test-Path "docs\governance\CHANGE_GOVERNANCE.md"
# Expected: True

# Step 3 — confirm governance types are not fields of LegendaryGameState
Select-String -Path "packages\game-engine\src\types.ts" -Pattern "ChangeCategory|ChangeBudget"
# Expected: only re-export lines (e.g., `export { ChangeCategory, ChangeBudget }`),
# never inside the LegendaryGameState interface definition. If either appears as a
# field name inside LegendaryGameState, this step FAILS.

# Step 4 — confirm no engine gameplay files modified
git diff --name-only packages/game-engine/src/game.ts packages/game-engine/src/moves/ packages/game-engine/src/rules/
# Expected: no output

# Step 5 — confirm no require()
Select-String -Path "packages\game-engine\src\governance" -Pattern "require(" -Recurse
# Expected: no output

# Step 6 — confirm no files outside scope
git diff --name-only
# Expected: only files listed in ## Files Expected to Change
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
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] Change governance doc exists with all sections
- [ ] Governance types are metadata only (not in LegendaryGameState)
- [ ] No engine gameplay files modified (confirmed with `git diff`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — growth governance framework defined;
      change classification mandatory; immutable surfaces protected; D-1001,
      D-1002, D-1003 implemented; this is the final Phase 7 governance packet
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why five categories (maps
      to layer boundary); why content/UI are primary vectors (safest growth);
      what constitutes an immutable surface (replay, RNG, scoring, invariants)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-040 checked off with today's date
