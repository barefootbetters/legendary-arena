# EC-035 — Release, Deployment & Ops Playbook (Execution Checklist)

**Source:** docs/ai/work-packets/WP-035-release-deployment-ops-playbook.md
**Layer:** Operations / Release Engineering

**Execution Authority:**
This EC is the authoritative execution checklist for WP-035.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-035.

---

## Before Starting

- [ ] WP-034 complete: `EngineVersion`, `VersionedArtifact`, `checkCompatibility` exported
- [ ] `runAllInvariantChecks` exported (WP-031)
- [ ] `validateIntent` exported (WP-032)
- [ ] `validateContent` exported (WP-033)
- [ ] `verifyDeterminism` exported (WP-027)
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-035.
If formatting, spelling, or ordering differs, the implementation is invalid.

- Four environments: `dev` | `test` | `staging` | `prod`
- Promotion order: dev -> test -> staging -> prod (sequential, never skip)
- `OpsCounters = { invariantViolations: number; rejectedTurns: number; replayFailures: number; migrationFailures: number }`
- `DeploymentEnvironment = 'dev' | 'test' | 'staging' | 'prod'`
- `IncidentSeverity = 'P0' | 'P1' | 'P2' | 'P3'`
- P0: Corrupted game state -> Immediate rollback
- P1: Replay desync -> Freeze deployments
- P2: Invalid turn spikes -> Investigate
- P3: Content lint warnings -> Backlog

---

## Guardrails

- Release artifacts are immutable once published — no hot-patching in prod
- Every release gated by validation — blocked if any gate fails
- Every deployment has a tested rollback path (D-0902) — no data loss
- Engine does not auto-heal — monitoring is passive, humans decide
- No runtime code changes — ops contracts and documentation only
- Ops types are metadata — never stored in `G`
- No engine gameplay logic modified

---

## Required `// why:` Comments

- `ops.types.ts`: counters are for passive monitoring; engine does not auto-heal

---

## Files to Produce

- `docs/ops/RELEASE_CHECKLIST.md` — **new** — mandatory release gate
- `docs/ops/DEPLOYMENT_FLOW.md` — **new** — environment promotion and rollback
- `docs/ops/INCIDENT_RESPONSE.md` — **new** — severity levels and procedures
- `packages/game-engine/src/ops/ops.types.ts` — **new** — OpsCounters, DeploymentEnvironment, IncidentSeverity
- `packages/game-engine/src/types.ts` — **modified** — re-export ops types
- `packages/game-engine/src/index.ts` — **modified** — export ops types

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] All three ops docs exist with required content
- [ ] No engine logic modified (confirmed with `git diff`)
- [ ] `docs/ai/STATUS.md` updated
      (release process; deployment environments; rollback; D-0902)
- [ ] `docs/ai/DECISIONS.md` updated
      (four environments; no hot-patching; release gates vs invariant checks)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-035 checked off with date
