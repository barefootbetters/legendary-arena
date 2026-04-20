# Release Checklist — Mandatory Pre-Release Gate

**Purpose:** Every release must pass this checklist before promotion from
`dev` onto the promotion path. Each item is **binary pass/fail**. If any
gate fails, the release is **blocked** — there is no "partial release,"
no "ship with a known warning," and no "fix it in prod." Release artifacts
are immutable once published (see `DEPLOYMENT_FLOW.md` — "Why no
hot-patching").

This checklist implements D-0902 (Rollback Is Always Possible) at the
release boundary by ensuring every published artifact is one that the
full migration + replay + invariant pipeline has already accepted.

---

## Scope

Applies to every versioned release artifact produced by the engine or the
content authoring pipeline — namely:

- Versioned engine build (the `@legendary-arena/game-engine` package at a
  specific `EngineVersion`).
- Versioned content bundle (card + scenario + scheme definitions at a
  specific `ContentVersion`).
- Migration bundle (the `migrationRegistry` snapshot valid for the
  current `DataVersion`).
- Machine-generated validation report (`validateContent` output + replay
  verification output + migration-test output bundled as one immutable
  file per release).

Every release artifact carries a `VersionedArtifact<T>` stamp with
`engineVersion`, `dataVersion`, optional `contentVersion`, payload, and
`savedAt`. Unstamped artifacts fail the load boundary (D-0802) and are
refused at boot — catching this at release time is strictly cheaper than
catching it at deployment time.

---

## Gates (binary pass/fail)

All gates below must evaluate to **pass**. Any gate that evaluates to
**fail** blocks the release. No partial credit, no warnings-as-passes.

### Gate 1 — All engine tests pass

- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0.
- [ ] Reported count matches or exceeds the locked baseline recorded in
      the previous release's artifact.
- [ ] No test suite is skipped, no test is marked `.only`, no test emits
      `todo` at release time.

**Fail handling:** a single red test blocks the release. Do not `--grep`
around it. Fix the test, re-run the full suite, re-check this gate.

### Gate 2 — Content validation passes with zero errors

- [ ] `validateContent` returns zero `ContentValidationError` entries
      across the entire release content bundle.
- [ ] `validateContentBatch` reports zero failing cards.
- [ ] Warnings are permitted and tracked in the release notes; errors
      are not.

**Fail handling:** Per D-0602 (Invalid Content Cannot Reach Runtime),
content errors are non-negotiable. Zero-error policy is a MANDATORY
gate, not a warning tolerance. Remove or repair the offending content
and re-run this gate before attempting release again.

**Canonical verification procedure:** the R2 / card-data side of this
gate is performed by the checklist at
[`docs/ai/deployment/r2-data-checklist.md`](../ai/deployment/r2-data-checklist.md)
§A.1 (validation script usage, local + R2 modes, five-phase pipeline).

### Gate 3 — Replay verification passes

- [ ] `verifyDeterminism` returns `{ deterministic: true }` for every
      representative replay in the release's replay-verification suite.
- [ ] The replay suite covers at least one full match per registered
      scenario at the current `ContentVersion`.
- [ ] The replay state hashes produced by `computeStateHash` match
      across three independent `replayGame` runs of each replay.

**Fail handling:** A determinism failure is an invariant violation under
the engine contract (`ARCHITECTURE.md` §Architectural Principles #1).
Block the release and triage via `INCIDENT_RESPONSE.md` as a P1
(replay desync) even though no player has been impacted yet.

### Gate 4 — Migration tests pass if `dataVersion` changes

- [ ] If the release bumps `CURRENT_DATA_VERSION`, every registered
      migration from the previous `dataVersion` to the new one executes
      without throwing.
- [ ] `migrateArtifact` produces an artifact that passes Gate 3 (replay
      verification) after migration.
- [ ] No forward-only migration is attempted in reverse (the registry
      refuses the operation per WP-034 `versioning.migrate.ts`).
- [ ] If `dataVersion` is unchanged, this gate is **not applicable**;
      mark it "n/a" in the release notes.

**Fail handling:** A failing migration gate blocks the release outright.
The `DataVersion` bump is held until the failing migration path is
repaired. Do not ship a new `dataVersion` with a broken migration — per
D-0802, incompatible data fails loudly at load, which would manifest as
every player's save being refused at boot.

### Gate 5 — UI contract unchanged or versioned

- [ ] The `UIState` top-level shape has not silently diverged from its
      canonical definition in `packages/game-engine/src/ui/uiState.types.ts`.
- [ ] Any intentional change to the UI contract is accompanied by a
      version bump on the appropriate axis (typically `EngineVersion`
      minor or major, depending on compatibility impact).
- [ ] The three fixture payloads under `apps/arena-client` still parse
      against the current `UIState` shape.

**Fail handling:** Silent `UIState` drift becomes a production replay
parsing failure later. Block the release and either revert the drift or
land the matching version bump before re-running this gate.

### Gate 6 — Version stamps are correct

- [ ] Every release artifact is stamped by `stampArtifact` (not hand-
      constructed).
- [ ] `EngineVersion` matches the engine build being released.
- [ ] `DataVersion` matches the `CURRENT_DATA_VERSION` constant for the
      release.
- [ ] `ContentVersion` matches the content bundle being released (or is
      omitted for artifacts with no content payload).
- [ ] `checkCompatibility` returns `'compatible'` when invoked against
      the stamped artifact using the engine being released.
- [ ] `savedAt` is a valid ISO 8601 UTC timestamp produced by
      `stampArtifact`.

**Fail handling:** Per D-0801, the three version axes evolve on
independent cadences; mis-stamped artifacts confuse the load-boundary
compatibility decision. Repair the stamp via `stampArtifact` and re-run
Gates 3 and 4 against the re-stamped artifact.

### Gate 7 — Release notes authored

- [ ] A release-notes document exists for this release, authored by a
      human and committed before the artifact is published.
- [ ] Release notes enumerate: shipped features, breaking changes, any
      `dataVersion`/`contentVersion` bumps, known warnings carried
      forward from Gates 1–6.
- [ ] Rollback instructions are either present verbatim or linked from
      `DEPLOYMENT_FLOW.md` §Rollback Rules.

**Fail handling:** No release notes, no release. Release notes are part
of the audit trail that makes rollback decisions tractable under
incident pressure.

---

## Why these gates

Each gate exists to prevent a specific failure mode that has been
observed or anticipated in the architectural decision log. The rationale
below traces the gate back to its governing D-entry so future authors
can extend the checklist without re-deriving the principle.

- **Gate 1 (all tests pass)** enforces the determinism and state
  invariants locked by `ARCHITECTURE.md` §Architectural Principles #1.
  A failing test is a concrete statement that some invariant is
  currently broken; shipping past one means shipping a broken
  invariant.
- **Gate 2 (content validation zero errors)** implements D-0602 —
  *Invalid Content Cannot Reach Runtime*. The engine assumes content
  has already passed validation; there is no engine-side defense-in-
  depth for malformed content. Zero errors is not a target; it is a
  precondition for the engine's correctness argument.
- **Gate 3 (replay verification)** enforces the determinism guarantee
  on which the network-authority model (WP-032) and the audit trail
  (WP-027) both rest. A non-deterministic replay is a silent state
  divergence waiting to surface as desync under live play.
- **Gate 4 (migration tests)** implements D-0801 (Explicit Version
  Axes) and D-0802 (Incompatible Data Fails Loudly) at release time.
  A `DataVersion` bump without a working migration means every player's
  saved artifact is refused at the next boot — catching this before
  shipping is strictly cheaper than catching it after.
- **Gate 5 (UI contract stability)** prevents silent schema drift
  between the engine and the client. The UI is a projection, not a
  source of truth (`ARCHITECTURE.md` §Architectural Principles #2);
  but the projection contract is still a versioned public surface.
- **Gate 6 (version stamps)** makes the entire load boundary load-
  bearing. Without a correct `VersionedArtifact` stamp,
  `checkCompatibility` cannot decide compatible vs. migratable vs.
  incompatible, and the fail-loud behavior of D-0802 cannot fire.
- **Gate 7 (release notes)** preserves the audit trail needed to make
  rollback decisions under D-0902 when an incident lands. Without
  human-authored notes, the "what changed, why, and how to revert"
  question becomes guesswork under pressure — the opposite of the
  deterministic debuggability the architecture insists on.

---

## When this checklist runs

- **After** every engine or content change landed on the release
  branch.
- **Before** any environment promotion listed in `DEPLOYMENT_FLOW.md`
  (dev → test promotion is automated on build success, which implicitly
  includes Gate 1; the remaining gates are required before promoting
  from test onward).
- The checklist is the pre-promotion gate, not the post-promotion
  smoke-test. Smoke tests are described in `DEPLOYMENT_FLOW.md`.

## Relationship to runtime invariant checks

Release-time gates (this document) and runtime invariant checks
(`runAllInvariantChecks`, WP-031) are complementary, not redundant.
Release gates catch problems **before** the artifact reaches any
environment; runtime invariants catch problems **during** a live match
if an assumption is violated mid-play. A well-run release never fires a
runtime invariant in production — but the runtime invariant is the
final line of defense when a release gate misses something.

Database-schema verification — the structural companion to runtime
invariant checks at the persistence boundary — is performed by the
checklist at
[`docs/ai/deployment/postgresql-checklist.md`](../ai/deployment/postgresql-checklist.md)
§B.7 before promotion onto the release path.
