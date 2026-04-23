# EC-039 — Post-Launch Metrics & Live Ops (Execution Checklist)

**Source:** docs/ai/work-packets/WP-039-post-launch-metrics-live-ops.md
**Layer:** Operations / Documentation

**Execution Authority:**
This EC is the authoritative execution checklist for WP-039.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-039.

---

## Before Starting

- [ ] WP-035 complete: `ops/ops.types.ts` exports `IncidentSeverity`, `OpsCounters`, `DeploymentEnvironment`; `docs/ops/INCIDENT_RESPONSE.md` defines severity semantics
- [ ] WP-038 complete: successful GA launch (WORK_INDEX.md:1373, commit 2134f33)
- [ ] AI simulation baselines established (WP-036)
- [ ] Beta baselines established (WP-037)
- [ ] Versioning with three axes exists (WP-034)
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` — 444/444 pass

---

## Locked Values (do not re-derive)

Severity taxonomy — **copy verbatim from `docs/ops/INCIDENT_RESPONSE.md:32-34`**. Do NOT re-type.

- P0 = Corrupted game state → Immediate rollback
- P1 = Replay desync → Freeze deployments
- P2 = Invalid turn spikes → Investigate
- P3 = Content lint warnings → Backlog

Counter surface — **reference `packages/game-engine/src/ops/ops.types.ts:40-49`**. Do NOT redefine.

- `OpsCounters.invariantViolations`
- `OpsCounters.rejectedTurns`
- `OpsCounters.replayFailures`
- `OpsCounters.migrationFailures`

Authoritative types already exported from `@legendary-arena/game-engine` — **reuse, do not parallel**: `IncidentSeverity = 'P0' | 'P1' | 'P2' | 'P3'`, `OpsCounters`, `DeploymentEnvironment`.

Metric label conventions (organizational prose only — NOT typed unions): System Health, Gameplay Stability, Balance Signals, UX Friction.

Cadence: daily health review, weekly baseline review, monthly balance evaluation.

---

## Guardrails

- **No new TypeScript files. Zero.** WP-039 is documentation-only under Path A.
- **Do not define `MetricPriority`, `MetricSeverity`, `MetricCategory`, `MetricEntry`, or any similar type.** Pre-existing `IncidentSeverity` and `OpsCounters` are authoritative.
- **Do not restate the P0/P1/P2/P3 severity table beyond a cross-link pointer.** `docs/ops/INCIDENT_RESPONSE.md` is authoritative.
- **Do not modify `INCIDENT_RESPONSE.md`, `ops.types.ts`, `DEPLOYMENT_FLOW.md`, or `RELEASE_CHECKLIST.md`.** If gaps are found, stop and escalate.
- Replay desync is **P1**, full stop. Any finer classification requires a new DECISIONS.md entry amending `INCIDENT_RESPONSE.md` *before* WP-039 can execute — not inside WP-039.
- All metrics derived from deterministic sources only (D-0901) — no client-side estimates
- Metric derivations must be exactly reproducible from replay data
- No balance changes without AI re-validation (D-0702)
- No unversioned hot-fixes — all changes go through release gates (WP-035)
- Engine does not auto-heal — monitoring is passive, humans decide

---

## Required `// why:` Comments

- None — no TypeScript files are added or modified.

---

## Files to Produce

- `docs/ops/LIVE_OPS_FRAMEWORK.md` — **new** — §1–§11 as per WP-039 Scope A

Governance updates (STATUS.md, DECISIONS.md, WORK_INDEX.md) are session-close artifacts.

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` — 444/444 pass (no regression)
- [ ] Live ops framework doc exists with sections §1–§11
- [ ] Framework doc cross-links to `INCIDENT_RESPONSE.md` for severity taxonomy (not restated)
- [ ] Framework doc cross-links to `OpsCounters` in `ops.types.ts` (not redefined)
- [ ] Replay desync classified as P1 in framework doc
- [ ] No TypeScript files modified (`git diff --name-only | grep '\.ts$'` returns empty)
- [ ] No parallel types introduced (`grep -r "MetricPriority\|MetricSeverity\|MetricCategory\|MetricEntry" packages/` returns empty)
- [ ] No modifications to `INCIDENT_RESPONSE.md` or `ops.types.ts` (`git diff --name-only` on those paths returns empty)
- [ ] No files outside scope + governance modified (`git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated (live ops framework defined; severity reused from INCIDENT_RESPONSE.md)
- [ ] `docs/ai/DECISIONS.md` updated (new entry documenting Path A decision: reuse `IncidentSeverity` and `OpsCounters` rather than defining parallel types)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-039 checked off with date

---

## Common Failure Smells

- A new `MetricPriority` / `MetricSeverity` / `MetricCategory` / `MetricEntry` type anywhere → BLOCKING violation; Path A forbids parallel types. Delete and reference `IncidentSeverity` / `OpsCounters` instead.
- Framework doc restating the P0/P1/P2/P3 severity table in full → duplication risk; replace with "see `INCIDENT_RESPONSE.md` §Severity Levels".
- Framework doc classifying replay desync as P0, or splitting same-version vs cross-version → contradicts landed `INCIDENT_RESPONSE.md`. Delete the classification; cite the landed doc.
- Any `.ts` file in `git diff --name-only` → Path A is documentation-only; scope breach.
- Framework doc introducing its own counter fields parallel to `OpsCounters` → duplication; reference the existing type.
- "Auto-heal", "auto-compare", or client-side metric generation phrasing in the framework doc → D-0901 violation; monitoring must remain passive.
- Mentions of retention funnels, monetization analytics, or marketing metrics outside the §10 Non-Goals list → scope creep; move to §10 or delete.
