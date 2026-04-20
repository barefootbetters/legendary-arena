# Session Context — WP-035 (Release, Deployment & Ops Playbook)

> **Bridge artifact** produced by WP-034 step 8 (per `01.4 §Workflow
> Position`). Carries forward the WP-034 exit state + open pre-flight
> items + currently-active patterns for the WP-035 executor.
>
> **VERIFY AT SESSION START.** This file was written 2026-04-19
> immediately after WP-034 closed. If the WP-035 executor opens this
> file >3 days later, re-verify every test baseline + every dependency
> status against the current `WORK_INDEX.md` and a fresh `pnpm -r test`
> run before trusting any number below. The WP-034 session opened
> against a 3-day-old session-context that showed `engine 376 / 96`
> when the actual baseline was `engine 427 / 108` — no execution drift
> resulted (dependency chain was unchanged), but the staleness was
> real and is the explicit lesson encoded in the §"Verify First"
> opening below.

---

## Verify First (Pre-Pre-Flight Sanity Checks)

Before the WP-035 executor begins pre-flight proper, run these three
commands and confirm the outputs match this file. Any mismatch means
this bridge has gone stale and needs reconciliation against
`WORK_INDEX.md` (the authoritative source).

```pwsh
# Check 1 — current branch + HEAD (should be on the descendant of b36c840)
git log --oneline -1
# Expected at session start: b36c840 SPEC: close WP-034 / EC-034 governance
# (or any descendant if intervening SPEC commits have landed)

# Check 2 — repo-wide test baseline
pnpm -r test 2>&1 | grep -E "ℹ tests [0-9]+|ℹ pass [0-9]+|ℹ fail [0-9]+"
# Expected:
#   registry 3 / 3 / 0
#   vue-sfc-loader 11 / 11 / 0
#   game-engine 436 / 436 / 0      <-- locked engine baseline for WP-035
#   server 6 / 6 / 0
#   replay-producer 4 / 4 / 0
#   arena-client 66 / 66 / 0
# Total: 526 passing, 0 failing

# Check 3 — WP-034 dependencies (and WP-035's own dependency) all complete
grep -nE "^- \[x\] WP-(013|027|030|031|032|033|034)" docs/ai/work-packets/WORK_INDEX.md
# Expected: all seven WPs marked [x] with completion dates
```

If any check diverges, **STOP** and reconcile against `WORK_INDEX.md`
before generating the WP-035 pre-flight artifact.

---

## What WP-034 Shipped (WP-035's Direct Dependency)

WP-034 closed 2026-04-19 across three commits:

- **`c587f74` SPEC** — pre-flight bundle. Landed D-3401 in
  `DECISIONS.md` + `DECISIONS_INDEX.md`, added
  `packages/game-engine/src/versioning/` to the engine subdirectory
  list in `02-CODE-CATEGORIES.md`, and authored the session prompt
  at `docs/ai/invocations/session-wp034-versioning-save-migration.md`.
- **`5139817` EC-034** — code + 01.6 post-mortem. Five new files
  under `packages/game-engine/src/versioning/` (D-3401 engine
  category) plus additive re-exports in `types.ts` and `index.ts`.
  Engine 427 → 436 (+9 in one new
  `describe('versioning (WP-034)')` block); 108 → 109 suites.
  Repo-wide 517 → 526. Post-mortem at
  `docs/ai/post-mortems/01.6-WP-034-versioning-save-migration-strategy.md`;
  verdict WP COMPLETE.
- **`b36c840` SPEC** — governance close. Updated `STATUS.md`
  §Current State, flipped `WORK_INDEX.md` WP-034 to `[x]` with
  commit hash, flipped `EC_INDEX.md` EC-034 Draft → Done with
  hash + footer refresh.

### Engine surfaces now exported (WP-035 may consume any of these)

From `packages/game-engine/src/index.ts`:

```ts
// Versioning & save migration strategy (WP-034 / D-3401)
export type {
  EngineVersion,           // { major: number; minor: number; patch: number }
  DataVersion,             // { version: number }
  ContentVersion,          // { version: number } (optional on VersionedArtifact)
  VersionedArtifact,       // generic wrapper { engineVersion, dataVersion, contentVersion?, payload, savedAt }
  CompatibilityStatus,     // 'compatible' | 'migratable' | 'incompatible'
  CompatibilityResult,     // { status, message, migrations? }
} from './versioning/versioning.types.js';
export {
  CURRENT_DATA_VERSION,    // { version: 1 } at MVP
  checkCompatibility,      // pure decision function; never throws
  formatEngineVersion,     // EngineVersion -> "M.m.p" string
  getCurrentEngineVersion, // returns fresh { major: 1, minor: 0, patch: 0 }
} from './versioning/versioning.check.js';
export type { MigrationKey, MigrationFn } from './versioning/versioning.migrate.js';
export {
  migrateArtifact,         // forward-only; throws on no-path or downgrade
  migrationRegistry,       // Object.freeze({}) at MVP — long-lived seam
} from './versioning/versioning.migrate.js';
export { stampArtifact } from './versioning/versioning.stamp.js';
```

### Locked behavior worth quoting (WP-035's release-checklist gates likely consume these)

- `EngineVersion = { major: 1, minor: 0, patch: 0 }` is a hand-mirrored
  constant in `versioning.check.ts`. **Hand-mirror of
  `packages/game-engine/package.json` `version` field (`1.0.0`).**
  A future engine bump updates BOTH the constant and `package.json`
  atomically. Avoiding `import pkg from '../../package.json'`
  prevents `tsconfig` `resolveJsonModule` coupling. The single
  source of truth is the constant; `package.json` is the
  human-readable copy.
- `checkCompatibility` produces five locked full-sentence message
  templates (compatible / compatible-lower-minor / migratable /
  incompatible-no-path / incompatible-major / missing-stamp). The
  "missing-stamp" branch is the load-time fail-loud per D-0802 —
  WP-035's release-checklist "Version stamps are correct" gate
  could call `checkCompatibility` against the artifact's embedded
  stamp.
- `migrateArtifact` MAY throw — load-boundary exception per D-0802,
  identical rationale to `Game.setup()`'s throw. WP-035's "Migration
  tests pass if `dataVersion` changes" gate is the canonical
  consumer.
- `stampArtifact` reads the wall clock via `new Date().toISOString()`
  for the `savedAt` field. **Single permitted wall-clock read in
  the versioning subtree per D-3401 sub-rule.** WP-035's release
  artifacts that need a `releasedAt` timestamp can either call
  `stampArtifact` directly (recommended — single canonical embed
  site) OR mirror the `new Date().toISOString()` idiom with a
  matching `// why:` comment citing D-3401.

---

## WP-035 Scope Summary (from WP body — already ✅ Reviewed 2026-04-15)

**Title:** Release, Deployment & Ops Playbook
**Status:** Ready
**Primary Layer:** Operations / Release Engineering / Reliability
**Dependencies:** WP-034 (✅ landed at `5139817` 2026-04-19)
**EC:** EC-035 (Draft; will flip to Done at execution close)

**Six new files expected:**

- `docs/ops/RELEASE_CHECKLIST.md` — mandatory pre-release gate
- `docs/ops/DEPLOYMENT_FLOW.md` — environment promotion + rollback
- `docs/ops/INCIDENT_RESPONSE.md` — severity levels P0–P3
- `packages/game-engine/src/ops/ops.types.ts` — **new engine
  subdirectory** — `OpsCounters`, `DeploymentEnvironment`,
  `IncidentSeverity`
- `packages/game-engine/src/types.ts` — re-export ops types
- `packages/game-engine/src/index.ts` — export ops types

**WP-035 produces NO test files.** Definition of Done lists no test
count — the existing 436 engine tests must continue to pass
unchanged. Verification Step 1 (`pnpm --filter @legendary-arena/game-engine
build`) is the only build/test gate.

**Out of scope (explicit):** no CI/CD pipeline, no cloud provider
config, no logging stack selection, no alerting integrations, no
deployment scripts (WP-042's territory), no engine logic changes,
no persistence/database access.

---

## Pre-Flight Items WP-035 Must Resolve

### PS-1 (BLOCKING) — D-3501 classifying `packages/game-engine/src/ops/` as engine code category

WP-035 introduces `src/ops/` as the **8th** engine subdirectory
needing classification per the established pattern:

| Decision | WP | Subdirectory |
|---|---|---|
| D-2706 | WP-027 | `src/replay/` |
| D-2801 | WP-028 | `src/ui/` |
| D-3001 | WP-030 | `src/campaign/` |
| D-3101 | WP-031 | `src/invariants/` |
| D-3201 | WP-032 | `src/network/` |
| D-3301 | WP-033 | `src/content/` |
| D-3401 | WP-034 | `src/versioning/` |
| **D-3501** | **WP-035** | **`src/ops/`** ← to be created at pre-flight |

**Resolution path** (mirror WP-034's PS-1):

1. Author the D-3501 entry in `DECISIONS.md` between D-3401 and the
   Final Note. Cite the seven prior precedents and the engine-category
   invariants. Status: Immutable.
2. Add the D-3501 row to `DECISIONS_INDEX.md` under a new
   "Release, Deployment & Ops Playbook (WP-035)" section.
3. Append `packages/game-engine/src/ops/ (D-3501)` to the engine
   subdirectory list in `02-CODE-CATEGORIES.md`.
4. Bundle all three into the SPEC pre-flight commit alongside the
   WP-035 session prompt.

**Sub-rule consideration:** unlike D-3401 (which carved out
`new Date().toISOString()` for `savedAt` metadata), D-3501 likely
needs **no exceptions** — `ops.types.ts` is pure data definitions,
not load-boundary code. If pre-flight discovers a hidden wall-clock
need (e.g., `OpsCounters.lastResetAt` field), lock the carve-out at
pre-flight time, not in execution.

### RS-1 — `OpsCounters` runtime ownership

WP-035 §Non-Negotiable says "engine does not auto-heal — monitoring
is passive, humans decide actions" and "Operational counter types
are defined in the engine for monitoring but do not affect gameplay."

Pre-flight should lock the answer to: **where do `OpsCounters` live
at runtime?** Three options:

- **(a) Pure type, no runtime instance.** WP-035 ships only the
  `interface OpsCounters` definition; observability tooling (server
  layer, future ops dashboard) is responsible for construction and
  storage. The engine never reads or writes a counter. Cleanest;
  matches WP-035's "monitoring is passive" + "no engine logic
  changes" rules. **Recommended.**
- **(b) Module-level singleton in the engine.** A
  `currentOpsCounters: OpsCounters` instance lives in `ops.types.ts`
  or a sibling `ops.state.ts`, mutable from server hooks. Adds a
  side-effect surface to the engine — likely violates D-1232 (no
  state in shared modules; especially risky if the singleton ever
  ends up in `G`).
- **(c) Field on `G`.** Counters become part of runtime game state.
  Forbidden by D-4802-like reasoning (counters are non-gameplay
  ops state, not game state) and by `LegendaryGameState`
  9-field-locked-at-9-fields equivalents. **Explicitly out of
  scope for WP-035.**

Pre-flight default: **option (a)**. If WP-035 amendment surfaces a
need for (b), capture the rationale + a separate D-35NN entry.

### RS-2 — Test count expectation reconciliation

WP-035 §Acceptance Criteria has no `### Tests` section. EC-035
§After Completing says `pnpm --filter @legendary-arena/game-engine
test exits 0` (which the existing 436 tests satisfy without
additions). But:

- The existing **engine baseline 436 / 109** must hold post-WP-035
- No new `*.test.ts` file expected
- No suite count change expected

**Lock at pre-flight:** WP-035 produces **zero new tests**.
Verification Step (a new `### Tests` row in the WP-035 §Acceptance
Criteria authored at pre-flight) explicitly asserts engine count
**unchanged at 436 / 109 / 0 fail**. Add this as a post-flight
check to catch any accidental test-file leak.

### RS-3 — Empty `pnpm test` invocation in WP-035 verification (typo? or intentional?)

WP-035 §Verification Steps Step 1 says `pnpm --filter
@legendary-arena/game-engine build` — no separate test step. The
implied test-step is via the EC-035 §After Completing
`pnpm --filter @legendary-arena/game-engine test exits 0` row.
Pre-flight should explicitly add a test-run gate to the WP-035
verification steps for clarity (not an amendment — a one-line
addition to the session prompt's "Verification Steps" block,
matching the WP-034 / WP-064 pattern).

### RS-4 — `docs/ops/` directory creation

`docs/ops/` does not currently exist. WP-035 creates it implicitly
by writing the three new docs files there. Pre-flight should
confirm:

- `docs/ops/` is acceptable as a **new top-level docs subdirectory**
  (likely yes — `docs/ai/` and `docs/screenshots/` and `docs/devlog/`
  are precedents for top-level docs subdirectories). Doesn't need a
  D-entry — `docs/` is non-engine and non-shipped.
- No CLAUDE.md in `docs/ops/` is needed at MVP (WP-042 may add one
  later when it adds deployment-specific procedures).

---

## Currently-Active Patterns (Lessons from WP-034)

### P6-43 paraphrase discipline (load-bearing — verified at WP-034 first verification gate)

JSDoc / `// why:` comment text in new files MUST describe forbidden
APIs using **prose paraphrase**, not literal API names. The
verification grep gate matches both real calls AND documentation
strings containing the tokens.

**WP-035 specific applications:**

- `ops.types.ts` JSDoc / module header SHOULD NOT mention
  `boardgame.io`, `Math.random`, `Date.now`, `performance.now`,
  `@legendary-arena/registry`, or `apps/server` literally. Use
  paraphrase form: "the game framework", "non-engine RNG",
  "wall-clock helper", "high-resolution timing reads", "the
  registry package", "the server layer".
- The three `docs/ops/*.md` files DO mention `Date.now` legitimately
  in deployment-procedure rationale (e.g., "Don't read `Date.now`
  in production code paths"). The verification gate runs only
  against `packages/game-engine/src/ops/`, NOT against `docs/ops/`,
  so paraphrase discipline does NOT apply to the docs files. Verify
  the WP-035 verification grep paths in pre-flight.

### Session-context staleness — re-verify at session start

WP-034's session-context (written 2026-04-16) showed `engine 376 /
96`; actual baseline at execution time (2026-04-19) was `engine 427
/ 108`. Three days, +51 tests, +12 suites of drift. The execution
proceeded successfully because WP-034's dependencies (WP-013,
WP-027, WP-030, WP-033) were all unchanged by the intervening WPs
(WP-048, WP-067, WP-062, WP-079, WP-080, WP-063, WP-064), but the
staleness was real.

**Encoded in this file's §Verify First section above.** The WP-035
executor MUST run `pnpm -r test` and confirm `526 / 0 fail` at
session start before trusting the baselines below.

### Two- or three-commit topology is steady-state

WP-064 was 2 commits (Commit A: `EC-074:` code + post-mortem;
Commit B: `SPEC:` governance close). WP-034 was 3 commits (Commit
A0: `SPEC:` pre-flight bundle including D-3401 + 02-CODE-CATEGORIES
+ session prompt; Commit A: `EC-034:` code + post-mortem; Commit B:
`SPEC:` governance close).

**WP-035 will likely be 3 commits** (Commit A0 includes D-3501 +
02-CODE-CATEGORIES update + session prompt; same shape as WP-034).
Lock the topology choice at pre-flight.

### Empty migration registry forward-compatibility

WP-034's `migrationRegistry = Object.freeze({})` is the
long-lived seam. Future format changes append entries — never
mutate the empty MVP registry in place. WP-035's "Migration tests
pass if `dataVersion` changes" gate consumes the registry
indirectly through `migrateArtifact`. As long as WP-035 doesn't
bump `CURRENT_DATA_VERSION` (it shouldn't — it produces ops types,
not data shape changes), the empty registry is sufficient.

---

## Inherited Quarantine (Continues)

The following pre-existing dirty-tree state is OUT OF SCOPE for
WP-035 and **must be left untouched** per the established
cross-WP contamination discipline (P6-38 / P6-44 / WP-064
session-context advisory):

### Retained stashes (NEVER pop)

- `stash@{0}: On wp-062-arena-hud: pre-existing WP-068 + MOVE_LOG_FORMAT
  governance edits (quarantined during WP-062 commit)` — owned by
  the WP-068 / MOVE_LOG_FORMAT resolver
- `stash@{1}: On wp-068-preferences-foundation: dirty tree before
  wp-062 branch cut (pre-existing in-flight work + WP-068
  lessons-learned 01.4 additions)` — same owner

### EC-069 `<pending — gatekeeper session>` placeholder

The EC-069 row in `EC_INDEX.md` reads
`Executed 2026-04-18 at commit \`<pending — gatekeeper session>\`.`
The correct hash is `7eab3dc` (or the merge `3307b12`). Neither
WP-079, WP-080, WP-063, WP-064, nor WP-034 backfilled it (all five
explicitly deferred to avoid cross-WP contamination). **WP-035 MUST
NOT backfill this placeholder** — owned by a separate `SPEC:`
commit or the eventual WP-068 stash-pop resolution commit.

### `docs/ai/post-mortems/01.6-applyReplayStep.md` (still untracked)

WP-080 post-mortem artifact. Owned by a separate `SPEC:` commit
(not a WP-035 concern). **WP-035 MUST NOT stage this file.**

### Other untracked / modified files

- `M docs/ai/invocations/session-wp079-label-replay-harness-determinism-only.md`
  (WP-068 / MOVE_LOG resolver)
- `?? docs/ai/REFERENCE/01.3-ec-mode-commit-checklist.oneliner.md`
- `?? docs/ai/invocations/forensics-move-log-format.md`
- `?? docs/ai/invocations/session-wp048-par-scenario-scoring.md`
- `?? docs/ai/invocations/session-wp067-uistate-par-projection-and-progress-counters.md`
- `?? docs/ai/invocations/session-wp068-preferences-foundation.md`
- `?? docs/ai/session-context/session-context-forensics-move-log-format.md`
- `?? docs/ai/session-context/session-context-wp067.md`

**None are in WP-035 scope.** Stage by name only — never
`git add .` or `git add -A` (P6-27 / P6-44 discipline).

---

## Architectural Patterns Still in Effect

- **D-0801** (Explicit Version Axes) — WP-034 implements; WP-035's
  release checklist ("Version stamps are correct") consumes
- **D-0802** (Incompatible Data Fails Loudly) — WP-034 implements;
  WP-035's release checklist ("Migration tests pass") consumes
- **D-0902** (Rollback Is Always Possible) — WP-035 implements
- **D-0003** (Data Outlives Code) — WP-034 + WP-035 both implement
  facets
- **D-1002** (Immutable Surfaces Are Protected) — WP-035's
  "no hot-patching in prod" rule directly enforces
- **D-1232** (No `Set`/`Map` in G; data-only contracts) — applies
  to `OpsCounters` shape (must be JSON-serializable plain object)
- **D-1234** (Graceful degradation for unknown types) vs **D-0802**
  — WP-035's incident-response severity levels echo the load-time
  fail-loud hierarchy: P0 (rollback) maps to D-0802 fail-loud
  semantics; P3 (backlog) maps to D-1234 warn-and-continue
  semantics
- **D-3401** (versioning subdirectory engine classification) — WP-035
  must follow the pattern by adding D-3501 for `src/ops/`
- **All seven prior subdirectory-classification D-entries** —
  pattern is fully steady-state through eight precedents

---

## Files WP-035's Executor Will Need to Read

Before generating the WP-035 pre-flight artifact:

- `docs/ai/work-packets/WP-035-release-deployment-ops-playbook.md`
  — the authoritative WP spec (already ✅ Reviewed 2026-04-15;
  factually correct against just-shipped WP-034 — no amendments
  needed pre-flight unless RS-1/RS-2/RS-3 decisions surface)
- `docs/ai/execution-checklists/EC-035-release-ops.checklist.md`
  — the EC (Draft; will flip to Done at WP-035 close)
- `packages/game-engine/src/versioning/versioning.types.ts` — the
  `EngineVersion` / `VersionedArtifact<T>` types WP-035's release
  checklist gates depend on
- `packages/game-engine/src/versioning/versioning.check.ts` — the
  `checkCompatibility` function the release checklist consumes
- `docs/ai/ARCHITECTURE.md §Section 3` — three data classes (Class
  2 Configuration is what release artifacts contain)
- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` —
  server layer handles deployment wiring; engine never aware of
  environments
- `docs/ai/DECISIONS.md` — D-0902 (rollback), D-0801, D-0802,
  D-0602, D-3401 (last reference for the eighth-precedent pattern
  WP-035 follows for D-3501)
- `docs/ai/REFERENCE/02-CODE-CATEGORIES.md §engine` — the
  subdirectory list WP-035 appends `src/ops/` to (after D-3501
  lands)
- `docs/ai/REFERENCE/01.4-pre-flight-invocation.md §Established
  Patterns + §Precedent Log P6-43..P6-49` — the discipline rules
  WP-035 inherits

---

## Steps Completed for WP-034

For traceability — the WP-034 execution session covered:

0. Loaded `session-context-wp034.md` (was 3-day-stale; lesson
   encoded in this file's §Verify First)
1. Pre-flight (in-session inline; produced D-3401 + 02-CODE-CATEGORIES
   updates + session prompt under SPEC commit `c587f74`)
1b. Copilot check (skipped — Contract-Only WP per the steady-state
    pattern; lessons baked into the session prompt's Locked Values)
2. Session prompt at
   `docs/ai/invocations/session-wp034-versioning-save-migration.md`
   (committed in `c587f74`)
3. Execution (same session per user authorization; engine 427 →
   436, repo 517 → 526, 0 fail; one mid-execution refinement —
   P6-43 paraphrase pass on six JSDoc collisions caught at first
   verification gate run)
4. Post-mortem (in-session at
   `docs/ai/post-mortems/01.6-WP-034-versioning-save-migration-strategy.md`;
   verdict WP COMPLETE; zero fixes applied during post-mortem
   itself — all P6-43 fixes happened during execution before the
   gates were re-run)
5. Pre-commit review (NOT run in-session per P6-35 default —
   handed off to a separate gatekeeper session)
6. Commit A: `5139817 EC-034: add versioning subtree (...)` — 8
   files, +1283 insertions
7. Lessons learned (no new precedents added — P6-43..P6-49 already
   cover the discipline gaps WP-034 surfaced)
8. **This file** — `session-context-wp035.md`, the bridge to the
   next WP

Commit B: `b36c840 SPEC: close WP-034 / EC-034 governance` — 3
files, +142 insertions, -7 deletions.

---

## Run Pre-Flight for WP-035 Next

The WP-035 executor's first action is to run pre-flight against
the WP body + EC + this bridge file, resolving PS-1 (D-3501) +
RS-1 (OpsCounters runtime ownership) + RS-2 (test-count lock) +
RS-3 (verification-step test gate addition) + RS-4 (`docs/ops/`
top-level subdirectory acceptability) before generating the
session prompt.

Three commits expected (matching WP-034 topology):

- Commit A0 (`SPEC:`) — pre-flight bundle: D-3501 in DECISIONS.md +
  DECISIONS_INDEX.md + 02-CODE-CATEGORIES.md update + session
  prompt at
  `docs/ai/invocations/session-wp035-release-deployment-ops-playbook.md`
- Commit A (`EC-035:`) — code + 01.6 post-mortem (post-mortem
  required if D-3501 + new `OpsCounters` type qualify as new
  long-lived abstractions; likely yes)
- Commit B (`SPEC:`) — governance close: STATUS.md +
  WORK_INDEX.md + EC_INDEX.md
