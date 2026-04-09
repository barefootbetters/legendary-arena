# WP-038 — Launch Readiness & Go-Live Checklist

**Status:** Ready  
**Primary Layer:** Launch Control / Risk Elimination / Final Validation  
**Dependencies:** WP-037

---

## Session Context

WP-035 established the release process with validation gates and rollback.
WP-036 introduced AI simulation for balance validation. WP-037 defined the
public beta strategy with structured feedback and exit criteria. This packet
provides the single authoritative go-live checklist that determines whether
Legendary Arena may transition from public beta to general availability (GA).
If any check fails, launch is blocked. A single launch authority makes the
GO/NO-GO decision. An immediate 72-hour post-launch change freeze ensures
stability.

---

## Goal

Provide a single authoritative go-live checklist and post-launch safeguards.
After this session:

- Pre-launch readiness gates are defined across four categories: engine &
  determinism, content & balance, beta exit criteria, and ops & deployment
- A launch day checklist defines final build verification, soft launch window
  monitoring, and go-live signal criteria
- Post-launch guardrails define a 72-hour change freeze, elevated monitoring,
  and rollback triggers
- A single launch authority model is defined — one accountable owner, not
  consensus voting
- All gates are binary pass/fail — no "mostly ready"
- This packet produces **documentation only** — no engine modifications

---

## Assumes

- WP-037 complete. Specifically:
  - Public beta executed and evaluated (WP-037)
  - Beta exit criteria defined and measurable (WP-037)
  - Release process with validation gates exists (WP-035)
  - AI simulation baseline established (WP-036)
  - Versioning and migration strategy exists (WP-034)
  - All engine invariants enforced (WP-031)
  - Replay verification functional (WP-027)
  - `pnpm --filter @legendary-arena/game-engine build` exits 0
  - `pnpm --filter @legendary-arena/game-engine test` exits 0
- `docs/ai/ARCHITECTURE.md` exists with "MVP Gameplay Invariants"
- `docs/ai/DECISIONS.md` exists with D-0902 (Rollback Is Always Possible)

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md — "Layer Boundary (Authoritative)"` — launch
  readiness is an operations concern. The engine runs identically before and
  after launch — no "launch mode" exists.
- `docs/ai/ARCHITECTURE.md — "MVP Gameplay Invariants"` — read all sections.
  The launch checklist validates that every MVP invariant holds in the
  production build.
- `docs/ai/DECISIONS.md` — read D-0902 (Rollback Is Always Possible). Every
  launch deployment must have a tested rollback path.
- `docs/ai/DECISIONS.md` — read D-0802 (Incompatible Data Fails Loudly).
  Launch build must pass compatibility checks against all existing data.
- `docs/ops/RELEASE_CHECKLIST.md` (WP-035) — the launch uses the same release
  gates. The go-live checklist adds launch-specific gates on top.
- `docs/beta/BETA_EXIT_CRITERIA.md` (WP-037) — all beta exit criteria must
  pass before launch readiness review begins.
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 13 (ESM only).

---

## Non-Negotiable Constraints

**Packet-specific:**
- This packet produces **documentation only** — no engine, server, or UI code
- No "launch mode" in the engine — the engine is identical in beta and GA
- All gates are **binary pass/fail** — no subjective "looks good"
- **Single launch authority** — one person makes the GO/NO-GO decision
- No feature ships "mostly ready" — all readiness gates must pass
- Post-launch change freeze is **72 hours** — no feature releases during this
  window
- Bugfixes during change freeze must be: deterministic, backward compatible,
  and roll-forward safe
- Rollback triggers are defined — immediate rollback on invariant violation
  spike, replay hash divergence, migration failure, or client desync
- No engine modifications in this packet

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding

---

## Scope (In)

### A) `docs/ops/LAUNCH_READINESS.md` — new

Pre-launch readiness gates organized in four categories:

**Engine & Determinism:**
- No invariant violations in last beta build (WP-031)
- Replay hash stability verified at scale (WP-027)
- Network turn validation clean under load (WP-032)
- Deterministic UI projections match replay playback (WP-028/029)
- Any failure = NO-GO

**Content & Balance:**
- All content passes validation with zero errors (WP-033)
- No unresolved balance warnings from AI simulation (WP-036)
- No dominant strategy exceeding defined thresholds
- Beta balance feedback reconciled with simulation data
- Warnings require documented acceptance

**Beta Exit Criteria:**
- All WP-037 exit criteria satisfied
- No open P0/P1 issues
- UX confusion reports below agreed baseline
- Kill switch exercised successfully
- Partial completion = NO-GO

**Ops & Deployment:**
- Release checklist completed (WP-035)
- Rollback executed successfully in staging
- Migration tested forward
- Monitoring dashboards live and verified
- No manual prod changes permitted

### B) `docs/ops/LAUNCH_DAY.md` — new

Launch day procedures:

**Final Build Verification (T-1h):**
- Confirm build hash matches release artifact
- Confirm content version locked
- Confirm migrations are no-ops for fresh installs

**Soft Launch Window (T-0):**
- Initial launch to limited traffic
- Monitor: invariant violations, rejected turns, replay failures, session
  aborts
- Any anomaly pauses rollout

**Go-Live Signal:**
- First clean session completes
- Replay of that session matches live view
- Monitoring shows zero critical alerts

**Post-Launch Guardrails (T+0 to T+72h):**
- 72-hour change freeze — no feature releases
- Elevated monitoring: invariant violations continuous, replay divergence = P1,
  balance anomalies logged but not hot-fixed
- Bugfixes only if deterministic + backward compatible + roll-forward safe
- Immediate rollback triggers: invariant violation spike, replay hash
  divergence, migration failure, client desync

### C) Launch Authority Model

- Single launch authority: one accountable decision owner
- Required sign-offs before GO/NO-GO: engine integrity, replay determinism,
  content safety, operations readiness
- No consensus voting — one person decides
- Decision is documented with timestamp and rationale

---

## Out of Scope

- **No launch infrastructure setup** — servers, CDN, DNS are ops tasks
  outside this packet
- **No marketing or communications plan**
- **No post-launch feature roadmap** — WP-039/040 handle live ops and growth
- **No engine modifications**
- **No server or UI changes**
- **No monitoring implementation** — dashboards are ops tooling, defined in
  WP-035
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above

---

## Files Expected to Change

- `docs/ops/LAUNCH_READINESS.md` — **new** — pre-launch readiness gates
- `docs/ops/LAUNCH_DAY.md` — **new** — launch day checklist and post-launch
  guardrails

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Readiness Gates
- [ ] `docs/ops/LAUNCH_READINESS.md` exists with 4 gate categories
- [ ] Engine & Determinism gates reference WP-027, 028, 029, 031, 032
- [ ] Content & Balance gates reference WP-033, 036
- [ ] Beta Exit gates reference WP-037
- [ ] Ops & Deployment gates reference WP-035
- [ ] All gates are binary pass/fail
- [ ] Any single gate failure = NO-GO

### Launch Day
- [ ] `docs/ops/LAUNCH_DAY.md` exists
- [ ] Final build verification checklist present
- [ ] Soft launch window with monitoring metrics
- [ ] Go-live signal criteria defined
- [ ] 72-hour change freeze documented
- [ ] Rollback triggers listed

### Launch Authority
- [ ] Single launch authority model documented
- [ ] Required sign-offs listed
- [ ] No consensus voting — one decision owner

### Scope Enforcement
- [ ] No engine files modified
- [ ] No server files modified
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — confirm launch docs exist
Test-Path "docs\ops\LAUNCH_READINESS.md"
# Expected: True

Test-Path "docs\ops\LAUNCH_DAY.md"
# Expected: True

# Step 2 — confirm no engine or server files modified
git diff --name-only packages/ apps/
# Expected: no output

# Step 3 — confirm no files outside scope
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
- [ ] Launch readiness and launch day docs exist
- [ ] All readiness gates are binary pass/fail
- [ ] Single launch authority model documented
- [ ] 72-hour post-launch change freeze documented
- [ ] Rollback triggers defined
- [ ] No engine or server files modified (confirmed with `git diff`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — launch readiness checklist exists; go-live
      criteria defined; post-launch guardrails established
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why single launch authority
      (accountability over consensus); why 72-hour change freeze (stability
      observation); relationship between launch gates and beta exit criteria
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-038 checked off with today's date
