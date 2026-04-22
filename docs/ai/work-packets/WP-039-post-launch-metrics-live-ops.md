# WP-039 — Post-Launch Metrics & Live Ops

**Status:** Ready  
**Primary Layer:** Live Operations / Observability / System Stewardship  
**Dependencies:** WP-038

---

## Session Context

WP-038 defined the launch readiness checklist and post-launch guardrails
including the 72-hour change freeze. WP-035 established the ops playbook with
incident severity levels. WP-036 created AI simulation baselines. WP-031
enforced engine invariants. This packet defines the ongoing live operations
framework — how the game is operated after launch. Metrics are derived from
deterministic sources only (D-0901). Stability takes priority over growth.
This is not about chasing numbers — it's about maintaining trust.

---

## Goal

Define a post-launch live operations framework. After this session:

- Four metric categories are defined with clear priority: system health (P0),
  gameplay stability (P1), balance signals (P2), UX friction (P3)
- All metrics are derived from deterministic sources (final game state, turn
  log, replay data) — no client-side estimates, no sampling that breaks replay
  equivalence
- Data collection rules enforce version-tagging and deterministic derivation
- Alerting severity levels reuse WP-035 definitions with explicit response
  rules per level
- A live ops cadence is defined: daily health review, weekly baseline
  comparison, monthly balance evaluation
- Change management rules define what is allowed (validated content, simulated
  balance tweaks, semantic-preserving UI) and forbidden (unversioned rule
  changes, hot-patches, silent behavior changes)
- This packet produces **documentation and type definitions** — no engine
  modifications

---

## Assumes

- WP-038 complete. Specifically:
  - Successful GA launch (WP-038)
  - Ops playbook with rollback and incident response exists (WP-035)
  - Engine invariants enforced (WP-031)
  - Network authority model exists (WP-032)
  - AI simulation baselines established (WP-036)
  - Replay verification functional (WP-027)
  - Versioning with three axes exists (WP-034)
  - `pnpm --filter @legendary-arena/game-engine build` exits 0
  - `pnpm --filter @legendary-arena/game-engine test` exits 0
- `docs/ai/ARCHITECTURE.md` exists with "MVP Gameplay Invariants"
- `docs/ai/DECISIONS.md` exists with D-0901, D-0902

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md — "Layer Boundary (Authoritative)"` — live ops is
  an operations concern, external to the engine. Metrics are derived from
  engine output, never injected into the engine.
- `docs/ai/ARCHITECTURE.md — "MVP Gameplay Invariants"` — read "Moves &
  Determinism" and "Economy vs Scoring". All metrics must be derivable from
  deterministic game state.
- `docs/ai/DECISIONS.md` — read D-0901 (Deterministic Metrics Only). Live
  metrics must derive from replays and final state only.
- `docs/ai/DECISIONS.md` — read D-0902 (Rollback Is Always Possible). Live
  ops response rules must preserve rollback capability.
- `docs/ai/DECISIONS.md` — read D-0702 (Balance Changes Require Simulation).
  No balance changes based on live metrics alone — simulation must confirm.
- `docs/ops/RELEASE_CHECKLIST.md` (WP-035) — live ops uses the same release
  gates for any post-launch changes.
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 4 (no abbreviations),
  Rule 13 (ESM only).

---

## Non-Negotiable Constraints

**Packet-specific:**
- This packet produces **documentation and type definitions** — no engine
  gameplay logic
- All metrics are **derived from deterministic sources** — no client-side
  estimates, no sampling that breaks replay equivalence
- Every metric is **version-tagged** — unversioned metrics are discarded
- No balance changes without AI re-validation (D-0702)
- No unversioned hot-fixes — all changes go through release gates (WP-035)
- No rule changes without version increment (D-1002)
- The engine does not auto-heal — monitoring is passive, humans decide actions
- No engine modifications in this packet
- Metric types are metadata — never stored in `G`

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding

**Locked contract values:**

- **Four metric categories (priority order):**

  | Priority | Category | Scope | Anomaly = |
  |---|---|---|---|
  | P0 | System Health | Engine correctness | Critical — immediate action |
  | P1 | Gameplay Stability | Rules/content regression | Investigation |
  | P2 | Balance Signals | Strategy analysis | Queued for balance cycle |
  | P3 | UX Friction | Qualitative indicators | Backlogged |

---

## Scope (In)

### A) `docs/ops/LIVE_OPS_FRAMEWORK.md` — new

Comprehensive live operations document covering:

**Metrics Taxonomy:**
- P0 System Health: invariant violations, replay hash mismatches, migration
  failures, rejected turn rate — all per build version. Any non-zero invariant
  violations = P0 alert.
- P1 Gameplay Stability: game completion rate, average turns, scheme loss vs
  mastermind victory ratio, early abandon rate (≤ turn 3). Compared against
  beta baselines (WP-037) and AI simulation baselines (WP-036).
- P2 Balance Signals: win rate by hero/scheme, dominant action sequences, VP
  distribution skew, wound accumulation curves. No changes without AI
  re-validation.
- P3 UX Friction: rule clarification errors, invalid move frequency by phase,
  tutorial drop-off. Logged, never actioned in isolation.

**Data Collection Rules:**
- All metrics derived from: final game state, turn log, replay data
- No client-side estimates
- No sampling that breaks replay equivalence
- Every metric version-tagged
- No exceptions

**Alerting & Response Rules:**
- P0: immediate feature freeze, rollback if repeatable, root cause required
  before redeploy
- P1: disable affected features, patch only after deterministic validation
- P2: log and queue for balance cycle, no emergency changes
- P3: track trends, address in roadmap

**Live Ops Cadence:**
- Daily: review system health, confirm zero invariant violations
- Weekly: compare human metrics to AI baseline, review abandoned games
- Monthly: evaluate balance changes, plan next safe content update
- No ad-hoc changes outside cadence except P0/P1

**Change Management:**
- Allowed: content updates (validated via WP-033), balance tweaks (backed by
  WP-036 simulation), UI improvements that don't alter game semantics
- Forbidden: rule changes without version increment, hot-patches in prod,
  silent behavior changes

**Success Criteria:**
- Invariant violations at zero
- Replays stay trustworthy
- Balance metrics drift slowly and explainably
- Rollbacks never needed unexpectedly

### B) `src/ops/metrics.types.ts` — new

- `type MetricPriority = 'P0' | 'P1' | 'P2' | 'P3'`
- `type MetricCategory = 'systemHealth' | 'gameplayStability' | 'balanceSignals' | 'uxFriction'`
- `interface MetricEntry { category: MetricCategory; priority: MetricPriority; name: string; value: number; buildVersion: string; timestamp: string }`
- All types JSON-serializable — metadata, never stored in G
- `// why:` comment: metrics are derived from deterministic sources (D-0901);
  version-tagged for traceability

### C) `src/types.ts` — modified

- Re-export metrics types

### D) `src/index.ts` — modified

- Export metrics types

---

## Out of Scope

- **No metrics collection infrastructure** — types are defined; collection
  tooling is ops
- **No dashboard implementation** — conceptual dashboard views are documented
  but not built
- **No player retention funnels**
- **No monetization metrics**
- **No marketing analytics**
- **No social features**
- **No engine modifications**
- **No server changes**
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above

---

## Vision Alignment

> Per `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md §17`. Live ops is
> where post-launch drift becomes silent if metrics aren't deterministic.

**Vision clauses touched:** §3, §5, §13, §14, §22, §24

**Conflict assertion:** No conflict. Metrics are derived from
deterministic sources, version-tagged per D-0901, preserving §22 and §24.
"Hot-patches forbidden / validated content OK" enforces §14. The
"stability > growth" stance defends §5 and the Financial Sustainability
covenant by refusing growth-at-all-costs trade-offs.

**Non-Goal proximity:** Confirmed clear of NG-1..7. Metrics are
privacy-preserving and never tied to monetization triggers. No metric
informs paid-surface tuning (which would risk NG-6 dark patterns).

**Determinism preservation:** Confirmed. All metric categories — system
health (P0), gameplay stability (P1), balance signals (P2), UX friction
(P3) — derive from deterministic sources. Replay divergence is a P1
alert (§24). Alerting reuses WP-035 severity levels — no parallel
contract.

---

## Files Expected to Change

- `docs/ops/LIVE_OPS_FRAMEWORK.md` — **new** — complete live ops framework
- `packages/game-engine/src/ops/metrics.types.ts` — **new** — MetricPriority,
  MetricCategory, MetricEntry
- `packages/game-engine/src/types.ts` — **modified** — re-export metrics types
- `packages/game-engine/src/index.ts` — **modified** — export metrics types

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Metrics Taxonomy
- [ ] `docs/ops/LIVE_OPS_FRAMEWORK.md` exists with all sections
- [ ] Four metric categories defined with priority levels
- [ ] P0 metrics include: invariant violations, replay mismatches
- [ ] P1 metrics include: completion rate, turn count, abandon rate
- [ ] P2 metrics include: win rates, VP distribution
- [ ] P3 metrics include: invalid move frequency

### Data Collection Rules
- [ ] All metrics derived from deterministic sources (stated explicitly)
- [ ] Version-tagging required
- [ ] No client-side estimates

### Alerting & Response
- [ ] P0: immediate freeze + rollback
- [ ] P1: disable + patch after validation
- [ ] P2: queue for balance cycle
- [ ] P3: track trends

### Live Ops Cadence
- [ ] Daily, weekly, monthly cadence documented
- [ ] No ad-hoc changes except P0/P1

### Change Management
- [ ] Allowed changes listed with validation requirements
- [ ] Forbidden changes listed

### Metrics Types
- [ ] `MetricEntry` is JSON-serializable
- [ ] Types are NOT part of `LegendaryGameState`

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
# Step 1 — build after adding metrics types
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — confirm live ops doc exists
Test-Path "docs\ops\LIVE_OPS_FRAMEWORK.md"
# Expected: True

# Step 3 — confirm MetricEntry is not a field of LegendaryGameState
Select-String -Path "packages\game-engine\src\types.ts" -Pattern "MetricEntry"
# Expected: only re-export lines (e.g., `export { MetricEntry }`), never inside
# the LegendaryGameState interface definition. If MetricEntry appears as a field
# name inside LegendaryGameState, this step FAILS.

# Step 4 — confirm no engine gameplay files modified
git diff --name-only packages/game-engine/src/game.ts packages/game-engine/src/moves/ packages/game-engine/src/rules/
# Expected: no output

# Step 5 — confirm no require()
Select-String -Path "packages\game-engine\src\ops" -Pattern "require(" -Recurse
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
- [ ] Live ops framework doc exists with all sections
- [ ] Metrics types are metadata only (not in LegendaryGameState)
- [ ] No engine gameplay files modified (confirmed with `git diff`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — live ops framework defined; four metric
      categories with priority; data collection rules enforced; alerting and
      response rules documented; D-0901 implemented
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why metrics are derived
      from deterministic sources only (D-0901); why stability > growth; why
      no balance changes without simulation (D-0702)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-039 checked off with today's date
