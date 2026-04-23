# EC-038 — Launch Readiness & Go-Live Checklist (Execution Checklist)

**Source:** docs/ai/work-packets/WP-038-launch-readiness-go-live-checklist.md
**Layer:** Operations / Launch Control

**Execution Authority:**
This EC is the authoritative execution checklist for WP-038.
Every clause must be satisfied exactly. Any unmet item is a failed
execution of WP-038. Partial compliance is not permitted.
Interpretation defaults to the strictest reading.

---

## Before Starting

All prerequisites must already be complete and verifiable.
No prerequisite may be satisfied in parallel with this EC.

- [ ] WP-037 complete — beta exit criteria defined and measurable
- [ ] WP-035 complete — release process with validation gates enforced
- [ ] WP-036 complete — AI simulation baseline established and recorded
- [ ] WP-034 complete — versioning and migration strategy exists
- [ ] WP-031 complete — all engine invariants enforced
- [ ] WP-027 complete — deterministic replay verification functional

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-038.
Any deviation in text, spelling, formatting, or ordering invalidates the execution.

- Four readiness gate categories: Engine & Determinism, Content & Balance, Beta Exit Criteria, Ops & Deployment
- Single launch authority — one person decides GO/NO-GO (not consensus); MAY NOT waive failing gates; MAY ONLY decide once all gates pass; exists to prevent deadlock, not to override invariants
- 72-hour post-launch change freeze — no feature releases during this window
- Freeze Exception Record required for any change during the freeze — triggering condition, proof of determinism, proof of backward compatibility, roll-forward safety analysis, launch authority approval timestamp
- Rollback triggers: invariant violation spike, replay hash divergence, migration failure, client desync
- Bugfix criteria during freeze: deterministic + backward compatible + roll-forward safe
- Soft-launch anomalies trigger PAUSE of traffic expansion; ROLLBACK only when a rollback-trigger condition is met
- Content or balance warnings MAY be accepted only if classified non-invariant, non-competitive, and non-exploitable, with justification recorded; acceptance does not waive future correction or downgrade monitoring priority
- Any unmet criterion = NO-GO

---

## Guardrails

- Documentation only — no engine code, no server code, no client/UI code
- No "launch mode" in the engine — bit-for-bit identical in beta and GA
- All gates are binary pass/fail — no scoring, no subjective language ("looks good", "acceptable")
- No feature ships "mostly ready"
- Rollback procedure must be tested in staging before launch
- Launch uses the same release gates as production (WP-035)

---

## Required `// why:` Comments

- None — this packet produces documentation only

---

## Files to Produce

- `docs/ops/LAUNCH_READINESS.md` — **new** — four gate categories; explicit binary pass/fail per gate; final GO/NO-GO verdict summary
- `docs/ops/LAUNCH_DAY.md` — **new** — build verification; soft-launch validation with explicit PAUSE vs ROLLBACK distinction; go-live signal; post-launch guardrails (freeze, Freeze Exception Record, rollback triggers)

---

## After Completing

- [ ] `LAUNCH_READINESS.md` exists and is complete
- [ ] `LAUNCH_DAY.md` exists and is complete
- [ ] All readiness gates are binary pass/fail
- [ ] Single launch authority model documented, including non-override clauses
- [ ] 72-hour change freeze and Freeze Exception Record requirements documented
- [ ] Rollback triggers defined and unambiguous; PAUSE vs ROLLBACK distinction present
- [ ] No engine, server, or client files modified (confirmed with `git diff`)
- [ ] `docs/ai/STATUS.md` updated — launch readiness checklist reference; go-live criteria; post-launch guardrails
- [ ] `docs/ai/DECISIONS.md` updated — single launch authority; 72-hour freeze policy; launch gates vs beta exit criteria
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-038 checked off with completion date
