# EC-037 — Public Beta Strategy (Execution Checklist)

**Source:** docs/ai/work-packets/WP-037-public-beta-strategy.md
**Layer:** Release Strategy / Documentation

**Execution Authority:**
This EC is the authoritative execution checklist for WP-037.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-037.

---

## Before Starting

- [ ] WP-036 complete: AI simulation framework exists for balance comparison
- [ ] Release process with validation gates exists (WP-035)
- [ ] Versioning with three axes exists (WP-034)
- [ ] Replay verification harness exists (WP-027)
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-037.
If formatting, spelling, or ordering differs, the implementation is invalid.

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

- `type BetaCohort = 'expert-tabletop' | 'general-strategy' | 'passive-observer'`
- `type FeedbackCategory = 'rules' | 'ui' | 'balance' | 'performance' | 'confusion'`
- **Three beta cohorts:**
  1. Expert tabletop players -- rules-aware, edge-case focused
  2. General strategy gamers -- UX, clarity, onboarding signal
  3. Passive observers -- spectator and replay usability
- **Beta exit criteria categories:** Rules correctness, UX clarity, balance perception, stability
- All exit criteria are binary pass/fail

---

## Guardrails

- Strategy documents and type definitions only -- no engine logic
- No "beta mode" in the engine -- beta runs the same deterministic engine
- Beta feedback types are metadata -- never stored in `G`
- Invitation-only access -- no anonymous sessions
- Feedback tied to build version -- unversioned feedback is discarded
- Beta uses same release gates as production (WP-035) -- no shortcuts
- All rollback capabilities from WP-035 apply to beta deployments

---

## Required `// why:` Comments

- `beta.types.ts`: feedback tied to build version for traceability; replay reference enables reproduction

---

## Files to Produce

- `docs/beta/BETA_STRATEGY.md` -- **new** -- objectives, cohorts, access, feedback, exit criteria
- `docs/beta/BETA_EXIT_CRITERIA.md` -- **new** -- binary pass/fail criteria per category
- `packages/game-engine/src/beta/beta.types.ts` -- **new** -- BetaFeedback, BetaCohort, FeedbackCategory
- `packages/game-engine/src/types.ts` -- **modified** -- re-export beta types
- `packages/game-engine/src/index.ts` -- **modified** -- export beta types

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] Beta strategy and exit criteria docs exist
- [ ] `BetaFeedback` not in `LegendaryGameState`
- [ ] No engine gameplay files modified (confirmed with `git diff`)
- [ ] `docs/ai/STATUS.md` updated (beta strategy; cohorts; feedback model; exit criteria)
- [ ] `docs/ai/DECISIONS.md` updated (invitation-only; three cohorts; same release gates)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-037 checked off with date
