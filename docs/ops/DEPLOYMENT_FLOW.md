# Deployment Flow — Environments, Promotion, Rollback

**Purpose:** Define the four deployment environments, the sequential
promotion rules between them, the no-hot-patching rule for production,
and the rollback strategy that makes every deployment reversible without
data loss (D-0902).

This document is the authority for how a versioned release artifact
(produced per `RELEASE_CHECKLIST.md`) moves from development onto live
player traffic. CI/CD tooling, cloud-provider specifics, and the actual
deployment scripts are out of scope — this document defines the
**process**; WP-042 provides the per-environment **procedures**.

---

## The Four Environments

The four environments are ordered. Promotion only moves right, one step
at a time. The ordering is locked by the typed contract
`DeploymentEnvironment = 'dev' | 'test' | 'staging' | 'prod'` exported
from `packages/game-engine/src/ops/ops.types.ts` — adding a fifth
environment is a governance change, not a code change.

| Environment | Purpose                                       |
|-------------|-----------------------------------------------|
| `dev`       | Engine & content development                  |
| `test`      | Full validation, replay, migration checks     |
| `staging`   | Production-identical dry run                  |
| `prod`      | Live players                                  |

### `dev` — engine & content development

The author's local machine or a personal branch deployment. No player
traffic ever reaches `dev`. Data persisted in `dev` is not migrated
forward; rebuild from scratch when `dataVersion` bumps.

### `test` — full validation, replay, migration checks

The first shared environment. Runs the full `RELEASE_CHECKLIST.md` gate
suite on every build. Player traffic never reaches `test`; synthetic
fixtures and replay suites provide coverage.

### `staging` — production-identical dry run

Configuration, data shape, and deployment topology mirror production
exactly. The only differences allowed are (a) the player population
(synthetic testers instead of real players) and (b) any provider-level
test-mode flags that do not alter engine behavior. If a change works in
`staging`, it should work in `prod`; when it does not, the delta is a
bug in the `staging` parity, not a new class of deployment risk.

### `prod` — live players

The live environment. Every artifact deployed here is immutable (see
"Why no hot-patching" below). The only way to change behavior in `prod`
is to deploy a new versioned artifact that has passed every prior gate.

---

## Promotion Rules

Promotion is **sequential**: `dev` → `test` → `staging` → `prod`.
Skipping a step is forbidden — a change that has not run through every
prior environment is not a candidate for the next one. The sequential
rule exists because each environment tests a different aspect of the
release (see "Purpose" column above); skipping one means deploying
untested behavior.

Each promotion step is **atomic**: either the new artifact is fully
deployed and the old one is retired, or the old one remains fully in
place. There is no partial promotion, no half-deployed state, and no
"fleet rollout" that leaves some players on the new artifact and some
on the old one. Atomicity is a precondition for the deterministic
rollback rule below — rollback of a half-deployed state is not
well-defined.

### `dev` → `test` — automated on build success

- **Trigger:** a commit lands on the release branch.
- **Gate:** `RELEASE_CHECKLIST.md` Gate 1 (all engine tests pass)
  implicitly, because the build step fails if any test fails.
- **Human approval:** not required.
- **Artifact:** the build output is stamped by `stampArtifact` and
  uploaded to the `test` environment's artifact store.

### `test` → `staging` — manual gate after full validation

- **Trigger:** a human signs off after the full
  `RELEASE_CHECKLIST.md` runs against the artifact in `test`.
- **Gate:** all seven gates in `RELEASE_CHECKLIST.md` evaluate to
  pass. Warnings are allowed; errors block the promotion.
- **Human approval:** required. A second human reviews the release
  notes (Gate 7) and signs off on the migration path (Gate 4) if
  `dataVersion` bumped.
- **Artifact:** the same stamped artifact that passed `test` is
  promoted. No rebuild, no re-stamp, no re-test — the artifact is
  byte-identical across environments.

### `staging` → `prod` — manual gate after smoke tests + replay verification

- **Trigger:** a human signs off after smoke tests and replay
  verification complete in `staging`.
- **Gate:** smoke tests pass (a reduced in-environment end-to-end
  suite that exercises match creation, a representative game flow,
  and rollback preflight). Replay verification on a
  `staging`-generated replay matches its `test`-generated counterpart
  bit-for-bit.
- **Human approval:** required. The same human may not sign both
  `test → staging` and `staging → prod` for the same release; a
  second reviewer enforces a four-eyes audit trail.
- **Artifact:** the same stamped artifact promoted through the prior
  two steps. Identity is preserved all the way from `test` to `prod`.

---

## No Hot-Patching In Prod

**Rule:** production receives **only** versioned artifact deployments.
Ad-hoc edits to a running `prod` process, manual patches to a running
container, side-loaded configuration changes, and "just-this-once" SQL
fixes are all forbidden. If production behavior needs to change, the
change is authored, stamped, and promoted through the full
`dev → test → staging → prod` path.

### Why no hot-patching

The no-hot-patching rule enforces D-1002 (Immutable Surfaces Are
Protected) at the deployment boundary, and WP-035 §Packet-specific
restates this as an architectural invariant of the ops playbook. Three
reasons:

- **Determinism of rollback.** D-0902 guarantees that every deployment
  is reversible. "Reversible to what" is only well-defined if the
  thing being reversed is a named, stamped artifact. A hot-patch is
  by definition unstamped — there is no prior artifact to revert to
  without reconstructing the pre-patch state from memory.
- **Audit trail.** Every production change must be traceable to an
  artifact, a `VersionedArtifact` stamp, a release note, and a human
  sign-off (see `RELEASE_CHECKLIST.md` Gate 7). A hot-patch bypasses
  all four.
- **Identity of staging.** `staging` is a production-identical dry run.
  If production accepts a hot-patch that `staging` never saw, the
  parity guarantee is broken and the entire promotion path loses its
  meaning for the next release.

The correct response to "we need to change prod behavior right now" is
one of two things:
1. Roll back to the previous known-good artifact (D-0902). This is the
   path for broken production deployments.
2. Author, gate, and promote a new versioned artifact as quickly as the
   release checklist allows. This is the path for new behavior that
   production needs.

There is no third option.

---

## Rollback

Every deployment has a tested rollback path. This is the concrete
realization of D-0902 (Rollback Is Always Possible) at the deployment
boundary.

### Rollback Triggers

Any of the following triggers an immediate rollback decision; the
rollback itself runs through the steps in "Rollback Rules" below. All
four correspond to fail-loud load-boundary failures per D-0802 —
treating them as rollback-grade events rather than soft warnings is
intentional.

- **Invariant violation.** `runAllInvariantChecks` reports any violation
  in production traffic. The engine has detected a state shape that
  contradicts a locked invariant.
- **Replay hash mismatch.** A replay of a production match no longer
  produces the same state hash it produced at record time. Determinism
  has been lost; the current deployment is producing non-reproducible
  games.
- **Migration failure.** `migrateArtifact` throws when applied to a
  persisted artifact that should be migratable. The `DataVersion` bump
  in the current release has a broken migration path.
- **Desync incidents.** Two clients of the same match, both on the
  current production artifact, disagree about state after the same
  ordered moves. See `INCIDENT_RESPONSE.md` P1 — replay desync.

Any of these fires a P0 or P1 per `INCIDENT_RESPONSE.md`; all of them
require rollback preflight to begin immediately.

### Rollback Rules

All rules below are non-negotiable. A rollback that violates any of
them is not a rollback — it is a second deployment with rollback
framing.

- **Revert engine and content together.** The engine and content
  bundle are versioned on independent axes (D-0801) but deployed
  together. Rolling back only the engine leaves `contentVersion`
  ahead of what the older engine knows how to interpret; rolling back
  only the content leaves the new engine running against a content
  shape it no longer expects. Always revert both to the last known-
  good artifact pair.
- **Never roll `dataVersion` forward during rollback.** Rollback
  re-applies a **prior** artifact. If the live artifact's
  `dataVersion` is higher than the rollback target's, persisted
  player state that was migrated forward under the broken release is
  not eligible for the rollback target — it must be quarantined and
  re-migrated once a fixed release is available. Forward-rolling
  `dataVersion` "to match" violates the forward-only migration
  discipline of WP-034.
- **Re-apply the last known-good artifact.** The rollback target is
  always the most recent `prod` artifact that passed every gate in
  `RELEASE_CHECKLIST.md` and ran without producing any of the
  rollback triggers above. Not "the last release," not "yesterday's
  build" — the last known-good.
- **No data loss.** Rollback must complete without losing any player
  state that was valid under the rollback target's `dataVersion`.
  State that was only valid under the broken release's higher
  `dataVersion` is quarantined, not discarded. Players whose state
  is quarantined receive an explanation; their saved state is
  preserved until a fixed forward release restores compatibility.

### Rollback completes atomically

Like promotion, rollback is atomic. Either the rollback target is
fully in place and the broken artifact is fully retired, or the
broken artifact is still fully in place and the rollback is treated
as failed. A half-rolled-back state is a P0 incident — declare it,
abandon the rollback attempt, and reinstate the broken artifact while
the rollback failure is triaged.

---

## Relationship to WP-042

This document defines the **process** of deployment. WP-042
(Deployment Checklists) provides the per-environment **procedure**
artifacts that implement this process:

- environment-specific configuration references;
- provider-specific deployment runbooks;
- smoke-test manifests for each environment;
- rollback preflight checklists.

WP-042 is unblocked by WP-035 and this document; any future changes to
the process live here, and any future changes to the per-environment
procedures live in WP-042's artifacts.
