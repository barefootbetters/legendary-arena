# WP-035 — Release, Deployment & Ops Playbook

**Status:** Ready  
**Primary Layer:** Operations / Release Engineering / Reliability  
**Dependencies:** WP-034

---

## Session Context

WP-031 enforced engine invariants with fail-fast behavior. WP-032 defined
the network authority model. WP-033 provided content validation tooling.
WP-034 established versioning with three independent axes and migration
strategy. This packet converts Legendary Arena from "production-ready" to
"production-operated" by defining the release process, deployment environments,
validation gates, rollback strategy, and incident response. This implements
D-0902 (Rollback Is Always Possible) and establishes the operational framework
that WP-042 (Deployment Checklists) provides specific procedures for.

---

## Goal

Define a repeatable, safe, and auditable release process. After this session:

- Release artifacts are defined: versioned engine build, content bundle,
  migration bundle, and machine-generated validation report — all immutable
  once published
- Four deployment environments exist: dev, test, staging, prod — with explicit
  promotion rules
- A mandatory release checklist gates every release — blocked if any step fails
- A rollback strategy ensures every deployment can be reverted without data loss
- An incident response playbook defines severity levels and required actions
- Operational monitoring counters are defined (invariant violations, rejected
  turns, replay failures, migration failures)

---

## Assumes

- WP-034 complete. Specifically:
  - `packages/game-engine/src/versioning/versioning.types.ts` exports
    `EngineVersion`, `VersionedArtifact` (WP-034)
  - `packages/game-engine/src/versioning/versioning.check.ts` exports
    `checkCompatibility` (WP-034)
  - `packages/game-engine/src/invariants/runAllChecks.ts` exports
    `runAllInvariantChecks` (WP-031)
  - `packages/game-engine/src/network/intent.validate.ts` exports
    `validateIntent` (WP-032)
  - `packages/game-engine/src/content/content.validate.ts` exports
    `validateContent` (WP-033)
  - `packages/game-engine/src/replay/replay.verify.ts` exports
    `verifyDeterminism` (WP-027)
  - `pnpm --filter @legendary-arena/game-engine build` exits 0
  - `pnpm --filter @legendary-arena/game-engine test` exits 0
- `docs/ai/ARCHITECTURE.md` exists with "MVP Gameplay Invariants"
- `docs/ai/DECISIONS.md` exists with D-0902

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md — "Layer Boundary (Authoritative)"` — the server
  layer handles deployment wiring. The engine is never aware of environments
  or deployment. Release artifacts are produced from the engine + content;
  deployment is an ops concern.
- `docs/ai/ARCHITECTURE.md §Section 3` — read "The Three Data Classes".
  Release artifacts contain Class 2 (Configuration) data. Class 1 (Runtime)
  is never deployed — it is constructed at match time.
- `docs/ai/DECISIONS.md` — read D-0902 (Rollback Is Always Possible). Every
  deployment must have a tested rollback path.
- `docs/ai/DECISIONS.md` — read D-0801 (Explicit Version Axes) and D-0802
  (Incompatible Data Fails Loudly). Release validation uses these guarantees.
- `docs/ai/DECISIONS.md` — read D-0602 (Invalid Content Cannot Reach Runtime).
  The release checklist enforces this for production.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no
  abbreviations), Rule 6 (`// why:` on validation gates and rollback triggers),
  Rule 13 (ESM only).

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
- This packet produces **documentation and type definitions** — not deployment
  scripts or CI/CD pipelines
- Release artifacts are **immutable once published** — no hot-patching in prod
- Every release is **gated by validation** — release is blocked if any gate
  fails
- Every deployment has a **tested rollback path** (D-0902) — rollback must
  complete without data loss
- No hot-patching in production — only versioned artifact deployments
- Environment promotion is sequential: dev -> test -> staging -> prod
- The engine does not auto-heal — monitoring is passive, humans decide actions
- No runtime code changes in this packet — ops contracts and documentation only
- Operational counter types are defined in the engine for monitoring but do
  not affect gameplay

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding

**Locked contract values:**

- **Four deployment environments:**

  | Environment | Purpose |
  |---|---|
  | `dev` | Engine & content development |
  | `test` | Full validation, replay, migration checks |
  | `staging` | Production-identical dry run |
  | `prod` | Live players |

- **Incident severity levels:**

  | Level | Example | Action |
  |---|---|---|
  | P0 | Corrupted game state | Immediate rollback |
  | P1 | Replay desync | Freeze deployments |
  | P2 | Invalid turn spikes | Investigate |
  | P3 | Content lint warnings | Backlog |

---

## Scope (In)

### A) `docs/ops/RELEASE_CHECKLIST.md` — new

- Mandatory pre-release checklist:
  - All engine tests pass (`pnpm test`)
  - Content validation passes with zero errors (`validateContent`)
  - Replay verification passes (`verifyDeterminism`)
  - Migration tests pass if `dataVersion` changes
  - UI contract unchanged or versioned
  - Version stamps are correct (`EngineVersion`, `DataVersion`, `ContentVersion`)
  - Release notes authored
- Release is **blocked** if any step fails
- Each item is binary pass/fail

### B) `docs/ops/DEPLOYMENT_FLOW.md` — new

- Environment promotion rules:
  - dev -> test: automated on build success
  - test -> staging: manual gate after full validation
  - staging -> prod: manual gate after smoke tests + replay verification
- Each promotion step is atomic
- No hot-patching — only versioned artifacts deployed
- Rollback triggers: invariant violation, replay hash mismatch, migration
  failure, desync incidents
- Rollback rules: revert engine + content together; never roll back
  `dataVersion` forward; re-apply last known good artifact; must complete
  without data loss

### C) `docs/ops/INCIDENT_RESPONSE.md` — new

- Severity levels (P0-P3) with examples and required actions
- Every incident produces: root cause, invariant violated (if applicable),
  version implicated, corrective action
- P0/P1 require immediate action; P2/P3 are backlogged

### D) `src/ops/ops.types.ts` — new

- `interface OpsCounters { invariantViolations: number; rejectedTurns: number; replayFailures: number; migrationFailures: number }`
- `type DeploymentEnvironment = 'dev' | 'test' | 'staging' | 'prod'`
- `type IncidentSeverity = 'P0' | 'P1' | 'P2' | 'P3'`
- All types are data-only, JSON-serializable
- `// why:` comment: counters are for passive monitoring; engine does not
  auto-heal

### E) `src/types.ts` — modified

- Re-export ops types

### F) `src/index.ts` — modified

- Export ops types

---

## Out of Scope

- **No CI/CD pipeline implementation** — this packet defines the process,
  not the tooling (GitHub Actions, Render webhooks, etc.)
- **No cloud provider configuration** — environment model is provider-agnostic
- **No logging stack selection** — monitoring counters are defined; collection
  is ops tooling
- **No alerting integrations** — monitoring is passive in MVP
- **No deployment scripts** — WP-042 provides specific deployment checklists
- **No engine logic changes** — ops types are metadata, not gameplay
- **No persistence / database access**
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above

---

## Files Expected to Change

- `docs/ops/RELEASE_CHECKLIST.md` — **new** — mandatory release gate
- `docs/ops/DEPLOYMENT_FLOW.md` — **new** — environment promotion and rollback
- `docs/ops/INCIDENT_RESPONSE.md` — **new** — severity levels and procedures
- `packages/game-engine/src/ops/ops.types.ts` — **new** — OpsCounters,
  DeploymentEnvironment, IncidentSeverity
- `packages/game-engine/src/types.ts` — **modified** — re-export ops types
- `packages/game-engine/src/index.ts` — **modified** — export ops types

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Release Checklist
- [ ] `docs/ops/RELEASE_CHECKLIST.md` exists with all gate items
- [ ] Every gate item is binary pass/fail
- [ ] Release is blocked if any gate fails

### Deployment Flow
- [ ] `docs/ops/DEPLOYMENT_FLOW.md` exists with 4 environments
- [ ] Promotion is sequential: dev -> test -> staging -> prod
- [ ] No hot-patching rule is explicit
- [ ] Rollback triggers documented
- [ ] Rollback rules: revert together, no data loss

### Incident Response
- [ ] `docs/ops/INCIDENT_RESPONSE.md` exists with P0-P3 levels
- [ ] Each level has: example, required action
- [ ] Incident output requirements documented

### Ops Types
- [ ] `OpsCounters` defined with 4 counter fields
- [ ] `DeploymentEnvironment` is a closed union of 4 values
- [ ] `IncidentSeverity` is a closed union of 4 values
- [ ] All types JSON-serializable

### Build
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0

### Scope Enforcement
- [ ] No engine logic modified (game.ts, moves, rules)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — build after adding ops types
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — confirm ops docs exist
Test-Path "docs\ops\RELEASE_CHECKLIST.md"
# Expected: True

Test-Path "docs\ops\DEPLOYMENT_FLOW.md"
# Expected: True

Test-Path "docs\ops\INCIDENT_RESPONSE.md"
# Expected: True

# Step 3 — confirm no engine logic modified
git diff --name-only packages/game-engine/src/game.ts packages/game-engine/src/moves/ packages/game-engine/src/rules/
# Expected: no output

# Step 4 — confirm no require()
Select-String -Path "packages\game-engine\src\ops" -Pattern "require(" -Recurse
# Expected: no output

# Step 5 — confirm no files outside scope
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
- [ ] All three ops docs exist with required content
- [ ] Ops types are JSON-serializable
- [ ] No engine logic modified (confirmed with `git diff`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — release process defined; deployment
      environments established; rollback strategy documented; D-0902
      implemented; WP-042 is unblocked for specific deployment checklists
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why four environments
      (dev/test/staging/prod); why no hot-patching in prod; relationship
      between release validation gates and engine invariant checks (WP-031)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-035 checked off with today's date
