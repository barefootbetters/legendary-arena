# EC-039 — Post-Launch Metrics & Live Ops (Execution Checklist)

**Source:** docs/ai/work-packets/WP-039-post-launch-metrics-live-ops.md
**Layer:** Operations / Observability

**Execution Authority:**
This EC is the authoritative execution checklist for WP-039.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-039.

---

## Before Starting

- [ ] WP-038 complete: successful GA launch
- [ ] Ops playbook with rollback and incident response exists (WP-035)
- [ ] AI simulation baselines established (WP-036)
- [ ] Versioning with three axes exists (WP-034)
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-039.
If formatting, spelling, or ordering differs, the implementation is invalid.

- `MetricPriority = 'P0' | 'P1' | 'P2' | 'P3'`
- `MetricCategory = 'systemHealth' | 'gameplayStability' | 'balanceSignals' | 'uxFriction'`
- `MetricEntry = { category: MetricCategory; priority: MetricPriority; name: string; value: number; buildVersion: string; timestamp: string }`
- P0 System Health: invariant violations, replay mismatches, migration failures, rejected turn rate
- P1 Gameplay Stability: completion rate, average turns, scheme/mastermind ratio, early abandon
- P2 Balance Signals: win rates, dominant actions, VP distribution, wound curves
- P3 UX Friction: rule clarification errors, invalid move frequency, tutorial drop-off
- Live ops cadence: daily health, weekly baseline comparison, monthly balance evaluation

---

## Guardrails

- All metrics derived from deterministic sources only (D-0901) — no client-side estimates
- Every metric version-tagged — unversioned metrics are discarded
- No balance changes without AI re-validation (D-0702)
- No unversioned hot-fixes — all changes go through release gates (WP-035)
- Engine does not auto-heal — monitoring is passive, humans decide
- Metric types are metadata — never stored in `G`
- No engine modifications in this packet

---

## Required `// why:` Comments

- `metrics.types.ts`: metrics derived from deterministic sources (D-0901); version-tagged for traceability

---

## Files to Produce

- `docs/ops/LIVE_OPS_FRAMEWORK.md` — **new** — metrics taxonomy, collection rules, alerting, cadence, change management
- `packages/game-engine/src/ops/metrics.types.ts` — **new** — MetricPriority, MetricCategory, MetricEntry
- `packages/game-engine/src/types.ts` — **modified** — re-export metrics types
- `packages/game-engine/src/index.ts` — **modified** — export metrics types

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] Live ops framework doc exists with all sections
- [ ] `MetricEntry` not in `LegendaryGameState`
- [ ] No engine gameplay files modified (confirmed with `git diff`)
- [ ] `docs/ai/STATUS.md` updated
      (live ops framework; four metric categories; D-0901)
- [ ] `docs/ai/DECISIONS.md` updated
      (deterministic sources only; stability > growth; no balance without simulation)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-039 checked off with date
