# EC-038 — Launch Readiness & Go-Live Checklist (Execution Checklist)

**Source:** docs/ai/work-packets/WP-038-launch-readiness-go-live-checklist.md
**Layer:** Operations / Launch Control

**Execution Authority:**
This EC is the authoritative execution checklist for WP-038.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-038.

---

## Before Starting

- [ ] WP-037 complete: beta exit criteria defined and measurable
- [ ] Release process with validation gates exists (WP-035)
- [ ] AI simulation baseline established (WP-036)
- [ ] Versioning and migration strategy exists (WP-034)
- [ ] All engine invariants enforced (WP-031)
- [ ] Replay verification functional (WP-027)

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-038.
If formatting, spelling, or ordering differs, the implementation is invalid.

- Four readiness gate categories: Engine & Determinism, Content & Balance, Beta Exit Criteria, Ops & Deployment
- Single launch authority — one person decides GO/NO-GO, not consensus
- 72-hour post-launch change freeze — no feature releases during this window
- Rollback triggers: invariant violation spike, replay hash divergence, migration failure, client desync
- Bugfix criteria during freeze: deterministic + backward compatible + roll-forward safe
- Any single gate failure = NO-GO

---

## Guardrails

- Documentation only — no engine, server, or UI code
- No "launch mode" in the engine — identical in beta and GA
- All gates are binary pass/fail — no subjective "looks good"
- No feature ships "mostly ready"
- Rollback must be tested in staging before launch
- Launch uses same release gates as production (WP-035)

---

## Required `// why:` Comments

- None — this packet produces documentation only

---

## Files to Produce

- `docs/ops/LAUNCH_READINESS.md` — **new** — 4 gate categories with binary pass/fail
- `docs/ops/LAUNCH_DAY.md` — **new** — build verification, soft launch, go-live signal, post-launch guardrails

---

## After Completing

- [ ] Launch readiness and launch day docs exist
- [ ] All readiness gates are binary pass/fail
- [ ] Single launch authority model documented
- [ ] 72-hour change freeze documented
- [ ] Rollback triggers defined
- [ ] No engine or server files modified (confirmed with `git diff`)
- [ ] `docs/ai/STATUS.md` updated
      (launch readiness checklist; go-live criteria; post-launch guardrails)
- [ ] `docs/ai/DECISIONS.md` updated
      (single authority; 72h freeze; launch gates vs beta exit criteria)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-038 checked off with date
