# WP-037 — Public Beta Strategy

**Status:** Ready  
**Primary Layer:** Release Strategy / User Feedback / Risk Management  
**Dependencies:** WP-036

---

## Session Context

WP-035 established the release process with validation gates and rollback.
WP-036 introduced AI playtesting for balance validation. WP-032 defined the
authoritative network model. WP-034 established versioning and migration.
This packet designs a controlled public beta that validates real-world gameplay,
captures structured feedback, and contains the blast radius of bugs — while
preserving determinism, data integrity, and player trust. The beta is a product
experiment, not a marketing event. This packet produces **strategy documents
and type definitions**, not engine logic.

---

## Goal

Design a controlled public beta strategy. After this session:

- Beta objectives are defined: validate core loop, surface UX friction, detect
  edge-case bugs, measure difficulty perception vs AI metrics
- Feature scope is locked: full core loop, limited content set, replays and
  spectator enabled; campaigns, save migration, and experimental keywords
  excluded
- Three user cohorts are defined: expert tabletop players, general strategy
  gamers, passive observers
- Access control: invitation-only, hard user cap, unique build ID, opt-in
  diagnostics
- Structured feedback collection: `BetaFeedback` type tied to build version
  with optional replay reference
- Beta exit criteria are binary pass/fail
- All documentation is strategy-level — no engine modifications

---

## Assumes

- WP-036 complete. Specifically:
  - Release process exists with validation gates (WP-035)
  - AI simulation framework exists for balance comparison (WP-036)
  - Authoritative network model exists (WP-032)
  - Versioning with three axes exists (WP-034)
  - Replay verification harness exists (WP-027)
  - UIState and audience-filtered views exist (WP-028/029)
  - `pnpm --filter @legendary-arena/game-engine build` exits 0
  - `pnpm --filter @legendary-arena/game-engine test` exits 0
- `docs/ai/ARCHITECTURE.md` exists with "MVP Gameplay Invariants"
- `docs/ai/DECISIONS.md` exists

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md — "Layer Boundary (Authoritative)"` — the beta
  strategy is an operations/product concern. It does not modify the engine,
  registry, or server gameplay logic. Beta-specific types (feedback, cohorts)
  are metadata, not game state.
- `docs/ai/ARCHITECTURE.md — "MVP Gameplay Invariants"` — read "Moves &
  Determinism". Beta games run the same deterministic engine. No special
  "beta mode" in the engine.
- `docs/ai/DECISIONS.md` — read D-0702 (Balance Changes Require Simulation).
  Beta feedback informs balance decisions; simulation validates them.
- `docs/ai/DECISIONS.md` — read D-0902 (Rollback Is Always Possible). Beta
  deployments must be rollbackable.
- `docs/ops/RELEASE_CHECKLIST.md` — the beta uses the same release gates
  as production. No beta-specific shortcuts.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no
  abbreviations), Rule 13 (ESM only).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- ESM only, Node v22+
- `node:` prefix on all Node.js built-in imports
- Test files use `.test.ts` extension — never `.test.mjs`
- Full file contents for every new or modified file in the output — no diffs,
  no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- This packet produces **strategy documents and type definitions** — not
  engine logic, not UI components
- No "beta mode" in the engine — beta games run the same deterministic engine
  as production
- No modifications to engine gameplay logic
- Beta feedback types are **metadata** — never stored in `G`
- Beta users see the same `UIState` as production users — no special beta
  views beyond build ID display
- Invitation-only access — no anonymous sessions
- Feedback is tied to build version — unversioned feedback is discarded
- Beta exit criteria are binary pass/fail — no subjective "feels ready"
- The beta uses the same release gates as production (WP-035)
- All rollback capabilities from WP-035 apply to beta deployments

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding

**Locked contract values:**

- **BetaFeedback shape:**
  ```ts
  interface BetaFeedback {
    sessionId: string
    buildVersion: string
    category: 'rules' | 'ui' | 'balance' | 'performance' | 'confusion'
    description: string
    severity: 1 | 2 | 3
    reproductionReplayId?: string
  }
  ```

- **Three beta cohorts:**
  1. Expert tabletop players — rules-aware, edge-case focused
  2. General strategy gamers — UX, clarity, onboarding signal
  3. Passive observers — spectator and replay usability

- **Beta exit criteria categories:**
  Rules correctness, UX clarity, balance perception, stability

---

## Scope (In)

### A) `docs/beta/BETA_STRATEGY.md` — new

- Beta objectives (4 primary, 4 explicit non-goals)
- Feature scope: included vs excluded
- User cohorts: 3 cohorts with signal targets
- Access control: invitation-only, hard cap, build ID, opt-in diagnostics
- Feedback collection model: structured `BetaFeedback` format
- Beta timeline: phases (closed alpha -> invite beta -> open beta)
- Exit criteria: binary pass/fail per category

### B) `docs/beta/BETA_EXIT_CRITERIA.md` — new

- Criteria organized by category:
  - **Rules correctness**: zero P0/P1 bugs in final 2 weeks; all replay
    verifications pass; no invariant violations detected
  - **UX clarity**: task completion rate above threshold for cohort 2;
    "confusion" feedback below threshold
  - **Balance perception**: human win rates within acceptable range of AI
    simulation predictions
  - **Stability**: zero crashes in final week; rollback never triggered in
    final deployment
- Each criterion is binary pass/fail with measurable threshold
- Exit decision requires ALL categories to pass

### C) `src/beta/beta.types.ts` — new

- `interface BetaFeedback` — structured feedback as specified in locked values
- `type BetaCohort = 'expert-tabletop' | 'general-strategy' | 'passive-observer'`
- `type FeedbackCategory = 'rules' | 'ui' | 'balance' | 'performance' | 'confusion'`
- All types JSON-serializable — metadata, never stored in G
- `// why:` comment: feedback is tied to build version for traceability;
  replay reference enables reproduction

### D) `src/types.ts` — modified

- Re-export beta types

### E) `src/index.ts` — modified

- Export beta types

---

## Out of Scope

- **No beta infrastructure** (servers, access control implementation) — this
  packet defines strategy, not infrastructure
- **No feedback collection backend** — `BetaFeedback` is a type; collection
  is a server/ops concern
- **No "beta mode" in the engine** — beta games run normal engine
- **No content selection logic** — curated content set is chosen by hand
- **No matchmaking** — beta uses manual match creation
- **No monetization testing**
- **No scaling or load testing**
- **No engine modifications**
- **No UI components**
- **No server changes**
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above

---

## Files Expected to Change

- `docs/beta/BETA_STRATEGY.md` — **new** — beta strategy document
- `docs/beta/BETA_EXIT_CRITERIA.md` — **new** — binary exit criteria
- `packages/game-engine/src/beta/beta.types.ts` — **new** — BetaFeedback,
  BetaCohort, FeedbackCategory types
- `packages/game-engine/src/types.ts` — **modified** — re-export beta types
- `packages/game-engine/src/index.ts` — **modified** — export beta types

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Strategy Document
- [ ] `docs/beta/BETA_STRATEGY.md` exists with all sections
- [ ] Objectives clearly stated (4 primary, 4 non-goals)
- [ ] Feature scope: included and excluded lists
- [ ] Three cohorts defined with signal targets
- [ ] Access control: invitation-only, build ID, opt-in

### Exit Criteria
- [ ] `docs/beta/BETA_EXIT_CRITERIA.md` exists
- [ ] All criteria are binary pass/fail with thresholds
- [ ] Exit requires ALL categories to pass

### Beta Types
- [ ] `BetaFeedback` is JSON-serializable
- [ ] Feedback references build version (required field)
- [ ] Replay reference is optional
- [ ] Types are NOT part of `LegendaryGameState`

### Engine Isolation
- [ ] No engine gameplay files modified
      (confirmed with `git diff --name-only`)
- [ ] No "beta mode" logic in engine
- [ ] Beta types are metadata only

### Build
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0

### Scope Enforcement
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — build after adding beta types
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — confirm beta docs exist
Test-Path "docs\beta\BETA_STRATEGY.md"
# Expected: True

Test-Path "docs\beta\BETA_EXIT_CRITERIA.md"
# Expected: True

# Step 3 — confirm BetaFeedback is not a field of LegendaryGameState
Select-String -Path "packages\game-engine\src\types.ts" -Pattern "BetaFeedback"
# Expected: only re-export lines (e.g., `export { BetaFeedback }`), never inside
# the LegendaryGameState interface definition. If BetaFeedback appears as a field
# name inside LegendaryGameState, this step FAILS.

# Step 4 — confirm no engine gameplay files modified
git diff --name-only packages/game-engine/src/game.ts packages/game-engine/src/moves/ packages/game-engine/src/rules/
# Expected: no output

# Step 5 — confirm no require()
Select-String -Path "packages\game-engine\src\beta" -Pattern "require(" -Recurse
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
- [ ] Beta strategy and exit criteria docs exist
- [ ] Beta types are metadata only (not in LegendaryGameState)
- [ ] No engine gameplay files modified (confirmed with `git diff`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — public beta strategy defined; cohorts,
      access control, feedback model, and exit criteria documented
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why invitation-only (signal
      quality over volume); why three cohorts (different signal targets); why
      beta uses same release gates as production (no shortcuts)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-037 checked off with today's date
