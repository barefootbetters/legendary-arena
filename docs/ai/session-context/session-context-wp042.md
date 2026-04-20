# Session Context — WP-042 (Deployment Checklists — Data, Database & Infrastructure)

> **Bridge artifact** produced by WP-035 step 8 (per `01.4 §Workflow
> Position`). Carries forward the WP-035 exit state + open pre-flight
> items + currently-active patterns for the WP-042 executor.
>
> **VERIFY AT SESSION START.** This file was written 2026-04-19
> immediately after WP-035 closed. If the WP-042 executor opens this
> file >3 days later, re-verify every test baseline + every dependency
> status against the current `WORK_INDEX.md` and a fresh `pnpm -r test`
> run before trusting any number below. Cross-session staleness is
> real — WP-034's session-context (written 2026-04-16) showed
> `engine 376 / 96` when the actual baseline at execution time
> (2026-04-19) was `engine 427 / 108`. Verify first, trust second.

---

## Verify First (Pre-Pre-Flight Sanity Checks)

Before the WP-042 executor begins pre-flight proper, run these three
commands and confirm the outputs match this file. Any mismatch means
this bridge has gone stale and needs reconciliation against
`WORK_INDEX.md` (the authoritative source).

```pwsh
# Check 1 — current branch + HEAD (should be on a descendant of 913f0b3)
git log --oneline -1
# Expected at session start: 913f0b3 SPEC: add P6-50 + P6-51 precedents to 01.4 from WP-035 execution
# (or any descendant if intervening SPEC / INFRA commits have landed)

# Check 2 — repo-wide test baseline
pnpm -r test 2>&1 | grep -E "ℹ tests [0-9]+|ℹ pass [0-9]+|ℹ fail [0-9]+"
# Expected:
#   registry 3 / 3 / 0
#   vue-sfc-loader 11 / 11 / 0
#   game-engine 436 / 436 / 0      <-- locked engine baseline for WP-042
#   server 6 / 6 / 0
#   replay-producer 4 / 4 / 0
#   arena-client 66 / 66 / 0
# Total: 526 passing, 0 failing (unchanged from WP-035 close)

# Check 3 — WP-035 and upstream dependencies all complete
grep -nE "^- \[x\] WP-(013|027|030|031|032|033|034|035)" docs/ai/work-packets/WORK_INDEX.md
# Expected: all eight WPs marked [x] with completion dates
```

If any check diverges, **STOP** and reconcile against `WORK_INDEX.md`
before generating the WP-042 pre-flight artifact.

---

## What WP-035 Shipped (WP-042's Direct Dependency)

WP-035 closed 2026-04-19 across five commits (not three — the
pre-commit review surfaced two non-blocking nits that produced
follow-up SPEC commits inside the WP-035 window):

- **`4b6b60b` SPEC** — pre-flight bundle. Landed D-3501 in
  `DECISIONS.md` + `DECISIONS_INDEX.md`, added
  `packages/game-engine/src/ops/` to the engine subdirectory list
  in `02-CODE-CATEGORIES.md`, and authored the session prompt at
  `docs/ai/invocations/session-wp035-release-deployment-ops-playbook.md`.
- **`d5935b5` EC-035** — code + 01.6 post-mortem. Six files (3 new
  ops docs under `docs/ops/`, 1 new engine type file at
  `packages/game-engine/src/ops/ops.types.ts` under D-3501, 2
  additive re-exports in `types.ts` / `index.ts`) plus the
  mandatory post-mortem at
  `docs/ai/post-mortems/01.6-WP-035-release-deployment-ops-playbook.md`.
  Engine baseline **unchanged at 436 / 109 / 0 fail** (RS-2 lock —
  zero new tests); repo-wide **526 / 0 fail**. 01.6 verdict WP
  COMPLETE with zero mid-execution fixes (the pre-flight
  paraphrase-discipline Locked Value prevented the P6-43 collision
  class — the first empirical demonstration of P6-50 prevention).
- **`546b784` SPEC** — governance close. Updated `STATUS.md`
  §Current State, flipped `WORK_INDEX.md` WP-035 to `[x]` with
  commit hash, flipped `EC_INDEX.md` EC-035 Draft → Done with hash
  + footer refresh.
- **`a9f6c1a` SPEC** — pre-commit review Nit 1 follow-up. Added
  D-3502 (four environments), D-3503 (no hot-patching in prod),
  and D-3504 (release gates ↔ runtime invariants are
  complementary) as back-pointer D-entries to satisfy the WP-035
  DoD literally. The authoritative rationale prose remains in the
  three `docs/ops/*.md` documents; the D-entries exist for
  citation resolution and grep-based audits.
- **`913f0b3` SPEC** — P6-50 + P6-51 precedents added to 01.4
  lessons-learned capture. P6-50 is P6-43's prevention side
  (pre-load paraphrase tables into Locked Values); P6-51 resolves
  the "update DECISIONS.md" DoD wording ambiguity (pre-flight must
  pick form (1) discrete D-entry or form (2) prose-in-produced-doc
  with back-pointer before execution).

### Engine surfaces now exported (WP-042 may consume any of these)

From `packages/game-engine/src/index.ts`:

```ts
// Ops metadata (WP-035 / D-3501)
export type {
  OpsCounters,            // { invariantViolations, rejectedTurns, replayFailures, migrationFailures }
  DeploymentEnvironment,  // 'dev' | 'test' | 'staging' | 'prod'
  IncidentSeverity,       // 'P0' | 'P1' | 'P2' | 'P3'
} from './ops/ops.types.js';
```

Plus everything the WP-035 bridge carried forward from WP-034's
versioning subtree (`EngineVersion`, `VersionedArtifact<T>`,
`checkCompatibility`, `migrateArtifact`, `stampArtifact`,
`CURRENT_DATA_VERSION`, `migrationRegistry`). All stable; none
modified by WP-035.

### Locked behavior worth quoting (WP-042's checklist procedures likely reference these)

- **Four deployment environments in sequential promotion order**
  (`dev` → `test` → `staging` → `prod`). Locked by D-3502 and the
  `DeploymentEnvironment` typed union. WP-042's PostgreSQL and R2
  checklists run *per environment* — the ordering matters because
  `staging` must have completed before `prod` verification begins.
- **No hot-patching in prod.** Locked by D-3503 and
  `docs/ops/DEPLOYMENT_FLOW.md` §Why No Hot-Patching. WP-042's
  checklists are **read-only verifications**, not mutation
  scripts. Any WP-042 procedure that surfaces a production defect
  routes through D-0902 rollback or a fast-track versioned-
  artifact release — never through a live infrastructure edit.
- **Release gates and runtime invariants are complementary.**
  Locked by D-3504. WP-042's checklists are **release-time gates**
  (per `docs/ops/RELEASE_CHECKLIST.md` Gate 2: "Content validation
  passes with zero errors" and Gate 3: "Replay verification
  passes"). They catch deployment-readiness problems *before* any
  environment promotion. They do NOT replace the engine's runtime
  invariants (WP-031).
- **Four incident severity levels (P0–P3).** Locked by the
  `IncidentSeverity` typed union and
  `docs/ops/INCIDENT_RESPONSE.md`. WP-042's checklists may cite
  these in their failure-handling sections (e.g., "if lookup table
  count mismatches, this is a P0 — block promotion until
  resolved").
- **OpsCounters is a pure type with no runtime instance.** RS-1
  option (a) from WP-035. If WP-042 needs to count infrastructure-
  verification failures, those counts live in the server layer or
  in ops tooling, NOT in engine code. The engine never constructs
  or reads an `OpsCounters` instance.

---

## WP-042 Scope Summary (from WP body — already ✅ Reviewed)

**Title:** Deployment Checklists (Data, Database & Infrastructure)
**Status:** Ready
**Primary Layer:** Server / Operations
**Dependencies:** WP-035 (✅ landed at `d5935b5` 2026-04-19)
**EC:** EC-042 (Draft; will flip to Done at execution close)

**Three files expected (per WP-042 §Files Expected to Change):**

- `docs/ai/deployment/r2-data-checklist.md` — new — R2 data and
  image verification checklist (sections A.1–A.7)
- `docs/ai/deployment/postgresql-checklist.md` — new — PostgreSQL
  migration and seeding checklist (sections B.1–B.8)
- `docs/ai/ARCHITECTURE.md` — modified — one-line cross-reference
  to deployment checklists in Server Startup Sequence subsection

**WP-042 produces NO test files.** EC-042 §After Completing lists
documentation-only verification (file existence + grep-based layer-
boundary checks + `git diff --name-only` scope enforcement). Verify
engine count **UNCHANGED at 436 / 109 / 0 fail**; repo-wide
**UNCHANGED at 526 / 0 fail**.

**Out of scope (explicit):** no Konva.js / canvas / UI checklists
(legacy 00.2b Checklist C), no modifications to
`packages/game-engine/`, `packages/registry/src/`, or
`apps/server/src/`, no new scripts or automation, no Render.com
deployment configuration changes.

---

## Pre-Flight Items WP-042 Must Resolve

### PS-1 (BLOCKING) — Ops-doc directory-placement reconciliation (`docs/ops/` vs `docs/ai/deployment/`)

**Status:** open — this bridge surfaces the question; WP-042
pre-flight must resolve it.

WP-035 placed its three operational-playbook documents at the
repo-top-level `docs/ops/` path (RS-4 resolution in the WP-035
session prompt: "`docs/ops/` is a new top-level docs subdirectory,
accepted without a new D-entry; precedent: `docs/ai/`,
`docs/screenshots/`, `docs/devlog/` all exist as top-level docs
subdirectories"). WP-042's current WP body and EC both specify
`docs/ai/deployment/` — one level deeper, under `docs/ai/`.

Three options for the WP-042 executor:

- **(a) Honor the WP-042 spec as-written.** Ship checklists at
  `docs/ai/deployment/r2-data-checklist.md` and
  `docs/ai/deployment/postgresql-checklist.md`. Accept the
  divergence from `docs/ops/`. The two directories serve different
  audiences (operational process vs infrastructure-verification
  runbooks); the split is defensible, just not uniform.
  **Advantage:** no WP-042 amendment needed; the WP ships as
  specified.
  **Disadvantage:** future readers navigating "where do I find
  deployment stuff?" will need to check both roots.
- **(b) Consolidate under `docs/ops/`.** Ship checklists at
  `docs/ops/r2-data-checklist.md` and
  `docs/ops/postgresql-checklist.md` (or
  `docs/ops/deployment/r2-data-checklist.md` if a subfolder is
  desired). Requires a WP-042 pre-flight amendment (SPEC commit
  before execution) updating the WP body's §Files Expected to
  Change and the EC's §Files to Produce.
  **Advantage:** single operational-docs root; `RELEASE_CHECKLIST.md`
  and `DEPLOYMENT_FLOW.md` can cross-reference the WP-042
  checklists by sibling path.
  **Disadvantage:** requires the WP-042 executor to author a
  pre-flight SPEC commit before the EC-042 execution, similar to
  WP-035's `4b6b60b` pre-flight bundle.
- **(c) Move WP-035's ops docs under `docs/ai/ops/` to match
  WP-042's `docs/ai/deployment/` pattern.** Rejected — WP-035 has
  already shipped at `docs/ops/` and the files are referenced by
  the D-entries that landed in `a9f6c1a`. Moving them now would
  break those citations and require a follow-up SPEC commit to
  re-anchor them. Cost exceeds benefit.

**Default recommendation:** (a) honor the WP-042 spec as-written.
The divergence is real but shallow; adding a cross-reference from
`docs/ops/RELEASE_CHECKLIST.md` §Gate 2 and §Gate 3 to the WP-042
checklists during WP-042 execution restores navigability without
restructuring either tree. If the WP-042 executor chooses (b) at
pre-flight, they must amend both the WP body and the EC before
the EC-042 execution session opens.

### PS-2 — Cross-reference `docs/ops/RELEASE_CHECKLIST.md` from WP-042 outputs

WP-035's `RELEASE_CHECKLIST.md` Gate 2 ("Content validation passes
with zero errors") and Gate 3 ("Replay verification passes") are
the process-level gates. WP-042's checklists (`r2-data-checklist.md`
and `postgresql-checklist.md`) are the per-infrastructure
verification runbooks those gates invoke. The two should
cross-reference each other bidirectionally:

- WP-042's new checklists should open with a sentence like
  *"This checklist is invoked by `docs/ops/RELEASE_CHECKLIST.md`
  Gate 2 (content validation) and Gate 3 (replay verification).
  A failing item here blocks release promotion per the release
  checklist's binary pass/fail contract."*
- `docs/ops/RELEASE_CHECKLIST.md` Gate 2 and Gate 3 should gain a
  one-line back-pointer to the WP-042 checklists (a mid-execution
  in-allowlist refinement — touching a WP-035 output during WP-042
  execution is acceptable because it's a cross-reference addition,
  not a semantic change; lands under `EC-042:` prefix).

**Lock at pre-flight:** WP-042 executor decides whether the back-
pointer edit to `docs/ops/RELEASE_CHECKLIST.md` is in-scope for
the EC-042 commit or a separate SPEC follow-up. Default: in-scope
for EC-042 (it's a minor cross-reference addition, not a release-
process change).

### PS-3 (BLOCKING if chosen) — `docs/ai/deployment/` directory classification

If PS-1 resolution is (a) or (b) lands `docs/ai/deployment/` for
the first time, the WP-042 executor must decide whether this new
top-level docs subdirectory needs a D-entry.

WP-035's RS-4 precedent: **no D-entry required** for new top-level
`docs/` subdirectories (cited `docs/ai/`, `docs/screenshots/`,
`docs/devlog/` as precedents without D-entries). WP-042 can follow
this pattern: `docs/ai/deployment/` is non-engine, non-shipped
documentation; the directory-classification D-entry discipline
(D-2706 through D-3501) applies only to new `packages/game-engine/
src/*/` subdirectories.

**Default at pre-flight:** no new D-entry for
`docs/ai/deployment/`. Matches the WP-035 / RS-4 precedent.

### PS-4 (BLOCKING) — `scripts/seed-from-r2.mjs` is missing from the repo

**Status:** open — surfaced by precondition verification on
2026-04-19 after WP-035 close, BEFORE any WP-042 pre-flight session.
Must be resolved before EC-042 can execute.

WP-042 §Assumes line 45 reads *"`scripts/migrate.mjs` and
`scripts/seed-from-r2.mjs` exist (Foundation Prompt 01/02)"* and
EC-042 §Before Starting line 19 repeats the same. WP-042's
PostgreSQL checklist body references `pnpm seed` in §B.3 (Lookup
table seeding) and §B.8 (Re-seeding procedure) — both presumably
invoke `scripts/seed-from-r2.mjs` via the `seed` npm script.

Verification at 2026-04-19 after WP-035 close:

```pwsh
test -f scripts/seed-from-r2.mjs
# Actual: MISSING
test -f scripts/migrate.mjs
# Actual: exists
```

Only `scripts/migrate.mjs` is present. The seed script is absent.
A WP-042 executor following the current WP body would hit this at
the first `pnpm seed` reference and have no way to write a working
checklist — the `B.3` and `B.8` sections lock specific CLI
invocations against a nonexistent script.

**Resolution options:**

- **(a) Archaeology — confirm the script was renamed.** Check
  `git log --all --diff-filter=D -- scripts/seed-from-r2.mjs` and
  `grep -rn "seed-from-r2\|seed:r2\|\"seed\":" --include=package.json`
  to see if the script lives under a different name. If yes, amend
  WP-042 §Assumes + EC-042 §Before Starting + WP-042 §Locked Values
  + the checklist body's `pnpm seed` references to match reality.
  Lands as a pre-flight SPEC commit before execution.
- **(b) Prerequisite WP — the script was never created.** If
  `seed-from-r2.mjs` is a Foundation Prompt deliverable that was
  deferred, WP-042 is BLOCKED until a separate prerequisite WP
  creates it. This would be a new WP (e.g., WP-041-seed-script) or
  a Foundation Prompt backfill, not an in-session WP-042 fix.
- **(c) Scope reduction — WP-042 ships without `B.3`/`B.8`.** If
  the seed workflow is genuinely out of scope for MVP, amend
  WP-042 to remove the sections that reference `pnpm seed` and
  ship only the migration + R2 parts. Lands as a pre-flight SPEC
  commit.
- **(d) Script creation in-scope — WP-042 ships the seed script
  itself.** Rejected at first pass. WP-042 §Non-Negotiable line 87
  says "No modification to `packages/registry/src/`" and the
  broader intent is documentation-only. Adding a new `.mjs`
  script under `scripts/` would pull WP-042 from Documentation
  class into Code-and-Documentation class, changing the commit
  topology (EC-042: code + docs instead of SPEC:-style doc-only).
  Revisitable only if (a)/(b)/(c) all fail to resolve.

**Default recommendation:** run archaeology first (option (a)). The
most likely explanation is that `seed-from-r2.mjs` was refactored
or renamed (matching the WP-079/WP-080 pattern of in-flight script
refactors) and WP-042's assumes block simply drifted. If
archaeology surfaces a renamed script, option (a) ships
immediately. If it surfaces nothing, escalate to (b) or (c) at
pre-flight.

### PS-5 (BLOCKING) — Migration filenames diverge from WP-042's locked list

**Status:** open — surfaced by precondition verification on
2026-04-19 after WP-035 close, BEFORE any WP-042 pre-flight session.
Must be resolved before EC-042 can execute.

WP-042 §Locked contract values line 119–122 reads:

> **Migration files (execution order by filename):**
> `001_initial_schema.sql` | `002_seed_base_set.sql` |
> `003_add_game_sessions.sql` | `004_upsert_indexes.sql` |
> `005_lobby_columns.sql`

EC-042 §Locked Values line 31 repeats the same five filenames.

Verification at 2026-04-19 after WP-035 close:

```pwsh
ls data/migrations/*.sql
# Actual:
#   data/migrations/001_server_schema.sql
#   data/migrations/002_seed_rules.sql
#   data/migrations/003_game_sessions.sql
```

| WP-042 locked filename | Actual on disk |
|---|---|
| `001_initial_schema.sql` | `001_server_schema.sql` |
| `002_seed_base_set.sql` | `002_seed_rules.sql` |
| `003_add_game_sessions.sql` | `003_game_sessions.sql` |
| `004_upsert_indexes.sql` | **does not exist** |
| `005_lobby_columns.sql` | **does not exist** |

All three present migrations have diverging filenames; two locked
migrations (004, 005) do not exist on disk at all. A WP-042
checklist authored against the locked names would fail its own
verification at `B.2 — Migration execution` the first time a
reader tries to match the list against the filesystem.

**Resolution options:**

- **(a) Update WP-042 §Locked Values to match reality.** Drop
  `004_upsert_indexes.sql` and `005_lobby_columns.sql` entirely;
  rename `001_initial_schema.sql` → `001_server_schema.sql`,
  `002_seed_base_set.sql` → `002_seed_rules.sql`,
  `003_add_game_sessions.sql` → `003_game_sessions.sql`. Lands as
  a pre-flight SPEC commit. Simplest option, but forecloses on
  the possibility that 004/005 are planned future migrations whose
  filenames were drafted into WP-042 preemptively.
- **(b) Split "current" vs "future" migration lists.** Amend
  WP-042 §Locked Values to split the list into (1) current-on-
  disk (three files, corrected names) and (2) planned-future
  (`004_upsert_indexes.sql`, `005_lobby_columns.sql`) marked as
  "to be added by separate WP before ship." The checklist's §B.2
  then becomes "verify the current three migrations execute; the
  checklist MUST be re-verified after any planned-future
  migration lands." Preserves the design intent.
- **(c) Git archaeology on `data/migrations/`.** Check
  `git log --all --follow data/migrations/` to see whether any of
  the WP-042 locked names ever existed and were subsequently
  renamed. If `git log` shows a `002_seed_base_set.sql` that was
  renamed to `002_seed_rules.sql` (for example), update WP-042 to
  match current reality AND note the rename in the amendment's
  rationale. Similar for 004 / 005 — if a commit added them and
  a later commit deleted them, the amendment should explain why.
  This is a more thorough version of (a) — same outcome, better
  audit trail.
- **(d) Revert repo to match WP-042.** Rejected. WP-042 is a
  documentation-only packet; rewriting shipped migration SQL to
  match a paper specification inverts the normal direction of
  cause and effect. Reality wins over specification when the
  specification was drafted against a snapshot that no longer
  holds.

**Default recommendation:** run (c) first (git archaeology) to
understand the divergence history, then land an amendment per
option (a) or (b) depending on what archaeology surfaces. If 004
and 005 were never drafted as real SQL, option (a) ships
immediately. If they were planned-but-never-landed, option (b)
preserves the intent.

**Lookup table counts are a separate question.** WP-042 §Locked
Values also locks row counts (`legendary.sets` = 40,
`legendary.card_types` = 37, `legendary.teams` = 25,
`legendary.hero_classes` = 5, `legendary.icons` = 7,
`legendary.rarities` = 3). These are database contents, not files;
verification requires a live PostgreSQL connection with the
migrations run. The WP-042 executor should confirm these counts
against a seeded test database before trusting the locked values
— they may have drifted for the same reason the migration
filenames did. If drift is confirmed, fold into the PS-5
resolution amendment.

### RS-1 — Render.com coverage

WP-042's Session Context claims it covers "three infrastructure
pillars: Cloudflare R2 card data, PostgreSQL database, and
Render.com hosting." But WP-042 §Scope (In) only enumerates (A)
R2 and (B) PostgreSQL — no (C) Render.com. The R2 checklist does
cover R2 bucket configuration (A.6), and the PostgreSQL checklist
covers migration execution (B.2), but neither covers Render-
specific concerns (environment variable provisioning, service
health check configuration, deploy hook setup, cold-start behavior).

Three options:

- **(a) Accept the divergence.** WP-042 ships R2 + PostgreSQL only;
  Render coverage is deferred to a future WP-042.1 or subsumed by
  WP-035's `DEPLOYMENT_FLOW.md` §Environment-specific configuration
  (currently generic).
- **(b) Add a Render checklist.** WP-042 ships a third file
  (`docs/ai/deployment/render-checklist.md` or
  `docs/ops/render-checklist.md` depending on PS-1 resolution).
  Requires WP-042 amendment to §Files Expected to Change and EC-042
  §Files to Produce.
- **(c) Fold Render coverage into the R2 and PostgreSQL
  checklists.** Environment-variable provisioning goes into the
  PostgreSQL checklist (it depends on `DATABASE_URL`); service-
  health check + deploy-hook goes into the R2 checklist (it depends
  on `R2_BASE_URL`). Not recommended — dilutes the per-pillar
  focus.

**Default at pre-flight:** (a) accept the divergence. Render-
specific procedures are small enough to live as footnotes in the
existing two checklists (e.g., "`DATABASE_URL` is provisioned by
Render per the service's environment configuration — see Render
console → Environment").

### RS-2 — Test count expectation lock

WP-042 §Acceptance Criteria has no `### Tests` section. EC-042
§After Completing also has no test-count row. The implied
expectation is that WP-042 ships zero new tests and the repo-wide
baseline **526 / 0 fail** holds unchanged.

**Lock at pre-flight:** WP-042 produces **zero new tests**. Add an
explicit post-flight check in the session prompt's §Verification
Steps asserting engine **436 / 109 / 0 fail** and repo-wide
**526 / 0 fail** — both UNCHANGED. Matches the WP-035 RS-2 pattern
(session prompt explicitly locks the test-count so an accidental
`.test.ts` leak is caught by the verification gate).

### RS-3 — Fixtures and environment-variable discipline

WP-042's checklists reference `DATABASE_URL`, `R2_BASE_URL`,
`CARDS_DIR`, `SKIP_IMAGES`, `IMAGE_DELAY_MS`, `EXPECTED_DB_NAME`
as environment variables. These must be documented as
**verification inputs** (what the checklist reads), not as
**configuration instructions** (what the operator sets). The
checklist is audit-time read-only; any script that writes
environment variables or modifies Render config is out of scope
per WP-042 §Out of Scope.

**Lock at pre-flight:** session prompt's §Locked Values enumerates
every environment variable the checklists reference, with a
one-sentence description of what the checklist expects to read
from each. Any environment-variable assignment, export, or
provisioning step is explicitly forbidden.

---

## Currently-Active Patterns (Lessons from WP-035)

### P6-50 (NEW as of 2026-04-19 — from WP-035 execution)

**Pre-flight Locked Values that pre-load grep-discipline rules
prevent mid-execution fixes — P6-43's prevention side.** Empirical
evidence: WP-034 hit six P6-43 collisions at its first
verification gate run; WP-035 pre-loaded the paraphrase-discipline
table into its session prompt's §Locked Values and hit zero.

**WP-042 specific applications:**

- WP-042's EC has purity-style greps (`Select-String` for `Konva`,
  `canvas`, `boardLayout`, `CARD_TINT`, `game-engine`,
  `boardgame.io`, `LegendaryGame`, `ctx.`). The WP-042 session
  prompt's §Locked Values MUST enumerate these forbidden tokens
  alongside approved paraphrases ("UI canvas library", "the game
  framework", "the engine package", "the game-state context") so
  the executing session uses paraphrase form on the first pass.
- The R2 and PostgreSQL checklists describe what the deployment
  does NOT contain ("no game logic," "no engine internals," "no
  UI rendering") — this is the exact "not X, not Y" negative-
  description pattern that P6-43 warns about. Apply P6-50
  proactively: every such sentence uses paraphrase form, not
  literal API names.

### P6-51 (NEW as of 2026-04-19 — from WP-035 pre-commit review)

**DoD wording "update DECISIONS.md with rationale for X" requires
pre-flight placement lock (form (1) discrete D-entry vs form (2)
prose-in-produced-doc with back-pointer).** WP-042's §DoD reads
*"`docs/ai/DECISIONS.md` updated — at minimum: why legacy 00.2b
Checklist C (Konva.js canvas) was excluded (UI implementation is
not a deployment concern per Layer Boundary); why checklists are
documentation not code."*

**Lock at pre-flight:** for each rationale the DoD calls out,
pick form (1) or form (2) explicitly.

- **"Why Konva.js excluded":** form (2) recommended. The WP-042
  checklists themselves are the natural home ("This checklist
  does not cover UI rendering. Per Layer Boundary (see
  ARCHITECTURE.md), UI is a separate concern; Konva.js-specific
  deployment procedures, if ever needed, belong in a future
  UI-layer WP."). Session prompt's §Locked Values should state:
  "DECISIONS.md placement for Konva.js exclusion: form (2) with
  back-pointer D-entry citing `docs/ai/deployment/r2-data-checklist.md`
  §Scope (or wherever the checklist enumerates what it excludes)."
  The D-entry is a short back-pointer (D-4201 or similar), not
  a new full rationale.
- **"Why checklists are documentation not code":** form (1)
  recommended. This is a cross-WP Layer Boundary statement
  (WP-042's checklists + WP-035's `docs/ops/*.md` + future
  WP-079's ops docs all share this property). Deserves a discrete
  D-entry — e.g., D-4202 or D-4203 — rather than being buried in
  one checklist's §Scope. Session prompt's §Locked Values should
  state: "DECISIONS.md placement for documentation-not-code:
  form (1) discrete D-entry."

### P6-43 + P6-50 together

**Paraphrase discipline for WP-042:** the executing session must
use paraphrase form on the first pass over every new file. The
EC-042 Verification Steps grep for specific tokens (`Konva`,
`canvas`, `boardLayout`, `CARD_TINT`, `game-engine`,
`boardgame.io`, `LegendaryGame`, `ctx.`); JSDoc, module headers,
prose explanations, and negative-description sentences must
describe these APIs in paraphrase form ("the UI canvas library",
"the game framework", "the engine package", "the game-state
context") rather than by literal name.

### P6-27 / P6-44 (inherited from WP-034, confirmed by WP-035)

**Stage by name only; never `git add .` or `git add -A`.**
WP-035's execution session discovered ~70 pre-existing dirty-tree
files at execution time that were not listed in Pre-Session Gate
#4's inherited-files enumeration (content/themes/*.json +
apps/registry-viewer/src/lib/themeClient.ts — a separate in-flight
session's work). The P6-27 / P6-44 discipline of staging by
explicit path prevented accidental inclusion. WP-042's executor
must do the same; the Pre-Session Gate enumeration is advisory,
not exhaustive.

### Session-context staleness — re-verify at session start

Encoded in this file's §Verify First section above. The WP-042
executor MUST run `pnpm -r test` and confirm `526 / 0 fail` at
session start before trusting the baselines below. Cross-session
drift is real; treat the bridge as a snapshot that requires
verification.

### Three-commit topology is steady-state; follow-up SPECs extend it

WP-035 shipped across five commits (3 base + 2 post-review follow-
ups):

- Commit A0 (`SPEC:`) pre-flight bundle
- Commit A (`EC-XXX:`) code + post-mortem
- Commit B (`SPEC:`) governance close (STATUS + WORK_INDEX + EC_INDEX)
- (Optional) Commit C (`SPEC:`) DoD back-pointer D-entries if
  pre-commit review surfaces a placement nit
- (Optional) Commit D (`SPEC:`) 01.4 precedent log additions if
  lessons-learned captures new precedents

**WP-042 will likely be 3 commits at minimum** (matching the
base topology). If the pre-commit review surfaces a nit (likely
around the PS-1 directory placement), expect a 4th or 5th commit.
Lock the topology estimate at pre-flight.

### Empty migration registry forward-compatibility

WP-034's `migrationRegistry = Object.freeze({})` is the long-lived
seam. WP-042's PostgreSQL migration checklist (`B.2 — Migration
execution`) is database migrations, NOT engine data-format
migrations — distinct concerns sharing the word "migration."
WP-042 must not reference `migrationRegistry` or `migrateArtifact`
in its PostgreSQL checklist; the SQL migrations are a separate
pipeline owned by `data/migrations/*.sql` + `scripts/migrate.mjs`.

---

## Inherited Quarantine (Continues)

The following pre-existing dirty-tree state is OUT OF SCOPE for
WP-042 and **must be left untouched** per the established
cross-WP contamination discipline (P6-27 / P6-38 / P6-44):

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
WP-079, WP-080, WP-063, WP-064, WP-034, nor WP-035 backfilled it
(all six explicitly deferred to avoid cross-WP contamination).
**WP-042 MUST NOT backfill this placeholder** — owned by a
separate `SPEC:` commit or the eventual WP-068 stash-pop
resolution commit.

### `docs/ai/post-mortems/01.6-applyReplayStep.md` (still untracked)

WP-080 post-mortem artifact. Owned by a separate `SPEC:` commit
(not a WP-042 concern). **WP-042 MUST NOT stage this file.**

### Content theme JSON edits + registry-viewer changes (observed during WP-035 execution)

Present at WP-035 execution time but not enumerated in WP-035's
Pre-Session Gate #4 inherited-files list. Appears to be in-flight
work from a separate session (music-theme metadata additions +
themeClient.ts updates). Status at WP-042 session start: unknown
— may still be dirty, may have been committed by another session.
The WP-042 executor should verify via `git status --short` and
leave untouched whatever remains.

### Other untracked / modified files (inherited from WP-035 Pre-Session Gate #4)

- `M docs/ai/invocations/session-wp079-label-replay-harness-determinism-only.md`
  (WP-068 / MOVE_LOG resolver)
- `?? docs/ai/REFERENCE/01.3-ec-mode-commit-checklist.oneliner.md`
- `?? docs/ai/invocations/forensics-move-log-format.md`
- `?? docs/ai/invocations/session-wp048-par-scenario-scoring.md`
- `?? docs/ai/invocations/session-wp067-uistate-par-projection-and-progress-counters.md`
- `?? docs/ai/invocations/session-wp068-preferences-foundation.md`
- `?? docs/ai/session-context/session-context-forensics-move-log-format.md`
- `?? docs/ai/session-context/session-context-wp067.md`

**None are in WP-042 scope.** Stage by name only — never
`git add .` or `git add -A` (P6-27 / P6-44 discipline). The
WP-042 executor should add this session-context file itself
(`session-context-wp042.md`) to the list when running
`git status --short` at session start.

---

## Architectural Patterns Still in Effect

- **D-0801** (Explicit Version Axes) — WP-034 implements; WP-042's
  checklists do NOT version themselves (they are operational docs,
  not persisted data)
- **D-0802** (Incompatible Data Fails Loudly) — WP-034 + WP-035
  implement; WP-042's checklists inherit the fail-loud semantics
  at the infrastructure verification layer (a failing lookup-table
  count blocks promotion loudly, binary pass/fail)
- **D-0902** (Rollback Is Always Possible) — WP-035 implements at
  the deployment boundary; WP-042's checklists should cite D-0902
  when describing what happens if a checklist item fails post-
  deployment (route to rollback, not to hot-patching per D-3503)
- **D-1002** (Immutable Surfaces Are Protected) — WP-035
  implements via the no-hot-patching rule (D-3503); WP-042's
  checklists are read-only audits, never mutation scripts — this
  is the same invariant applied one layer deeper
- **D-1234** (Graceful degradation for unknown types) vs
  **D-0802** — WP-035's incident-severity ladder (P0–P3) maps the
  two; WP-042's checklists should cite the ladder when describing
  failure severity (e.g., "missing lookup table = P0 rollback; row-
  count mismatch within tolerance = P2 investigate")
- **D-3401** (versioning subdirectory engine classification)
- **D-3501** (ops subdirectory engine classification)
- **D-3502** (four deployment environments — NEW 2026-04-19)
- **D-3503** (no hot-patching in prod — NEW 2026-04-19)
- **D-3504** (release gates ↔ runtime invariants complementary —
  NEW 2026-04-19)
- **All eight prior subdirectory-classification D-entries** —
  pattern is fully steady-state through D-3501

---

## Files WP-042's Executor Will Need to Read

Before generating the WP-042 pre-flight artifact:

- `docs/ai/work-packets/WP-042-deployment-checklists.md`
  — the authoritative WP spec (already ✅ Reviewed; factually
  correct against just-shipped WP-035; amendments may be needed
  at pre-flight if PS-1 resolution is (b))
- `docs/ai/execution-checklists/EC-042-deployment-checklists.checklist.md`
  — the EC (Draft; will flip to Done at WP-042 close)
- `docs/ops/RELEASE_CHECKLIST.md` — the process-level gate
  document WP-042's checklists are invoked by (Gate 2, Gate 3)
- `docs/ops/DEPLOYMENT_FLOW.md` — the promotion + rollback process
  WP-042's checklists run within
- `docs/ops/INCIDENT_RESPONSE.md` — the severity ladder WP-042's
  checklists may cite for failure handling
- `packages/game-engine/src/ops/ops.types.ts` — the typed union
  (`DeploymentEnvironment`) defining the environments WP-042's
  checklists run against
- `docs/prompts-legendary-area-game/00.2b-deployment-checklists.md`
  — the legacy source document; sections A (R2) and B
  (PostgreSQL) are in scope; section C (Konva.js canvas) is OUT
  of scope per WP-042 §Out of Scope
- `docs/ai/REFERENCE/00.2-data-requirements.md §4` — what belongs
  in PostgreSQL vs R2 (the canonical split WP-042's checklists
  verify)
- `docs/ai/ARCHITECTURE.md §Section 1 + §Section 2 + §Section 3
  + §Layer Boundary (Authoritative)` — deployment is a server/ops
  concern; WP-042 must not encode engine or UI concerns
- `docs/ai/DECISIONS.md` — D-3501 through D-3504 for the WP-035
  context; D-0602 / D-0801 / D-0802 / D-0902 / D-1002 for cross-
  references the checklists may cite
- `docs/ai/REFERENCE/02-CODE-CATEGORIES.md §engine` — confirms
  `src/ops/` is classified (D-3501); if PS-3 resolution is "new
  D-entry for `docs/ai/deployment/`," the category list may need
  extending
- `docs/ai/REFERENCE/01.4-pre-flight-invocation.md §Established
  Patterns + §Precedent Log P6-43..P6-51` — the discipline rules
  WP-042 inherits, including the newly-added P6-50 and P6-51
- `packages/registry/scripts/validate.ts` — the validation script
  WP-042's R2 checklist §A.1 documents the usage of (not the
  implementation)
- `data/migrations/*.sql` — the migration files WP-042's
  PostgreSQL checklist §B.2 documents the execution of
- `scripts/migrate.mjs` and `scripts/seed-from-r2.mjs` — the
  migration and seeding scripts WP-042's PostgreSQL checklist §B.2
  and §B.3 document the usage of

---

## Steps Completed for WP-035

For traceability — the WP-035 execution session covered:

0. Loaded `session-context-wp035.md` (stale-check clean; baseline
   matched)
1. Pre-flight (SPEC commit `4b6b60b` — D-3501 + 02-CODE-CATEGORIES
   update + session prompt)
1b. Copilot check (in-line in session prompt per 01.7 Contract-Only
    pattern; verdict CONFIRM)
2. Session prompt at
   `docs/ai/invocations/session-wp035-release-deployment-ops-playbook.md`
   (committed in `4b6b60b`)
3. Execution (same session per authorization; engine 436→436, repo
   526→526, 0 fail; zero mid-execution refinements — P6-50 prevention
   in action)
4. Post-mortem (in-session at
   `docs/ai/post-mortems/01.6-WP-035-release-deployment-ops-playbook.md`;
   verdict WP COMPLETE; zero fixes applied)
5. Pre-commit review (separate gatekeeper session per P6-35 default;
   surfaced two non-blocking nits)
6. Commit A: `d5935b5 EC-035: add ops types subtree +
   release/deploy/incident docs` — 7 files, +1083 insertions
6b. Commit B: `546b784 SPEC: close WP-035 / EC-035 governance
    (STATUS + WORK_INDEX + EC_INDEX)` — 3 files, +119 / -5
6c. Commit C (Nit 1 follow-up): `a9f6c1a SPEC: WP-035 DoD back-
    pointer D-entries (D-3502 / D-3503 / D-3504)` — 2 files, +276
7. Lessons learned: `913f0b3 SPEC: add P6-50 + P6-51 precedents to
   01.4 from WP-035 execution` — 1 file, +155
8. **This file** — `session-context-wp042.md`, the bridge to the
   next WP

---

## Run Pre-Flight for WP-042 Next

The WP-042 executor's first action is to run pre-flight against
the WP body + EC + this bridge file, resolving PS-1 (`docs/ops/`
vs `docs/ai/deployment/` placement) + PS-2 (`RELEASE_CHECKLIST.md`
cross-reference scope) + PS-3 (new-directory D-entry — likely no)
+ **PS-4 (BLOCKING — `scripts/seed-from-r2.mjs` missing from repo)**
+ **PS-5 (BLOCKING — migration filenames diverge from WP-042 locked
list; 004 and 005 don't exist on disk)** + RS-1 (Render.com
coverage) + RS-2 (test-count lock) + RS-3 (environment-variable
documentation discipline) before generating the session prompt.

**PS-4 and PS-5 are BLOCKING prerequisites.** They were surfaced
by precondition verification immediately after WP-035 close
(2026-04-19); they are not speculative. Either the WP-042 body is
correct and the repo is behind, or the repo is ahead and the WP-042
body is stale. Resolution options are enumerated above; the
pre-flight session must pick one per blocker and land a pre-flight
SPEC amendment commit before the EC-042 execution session opens.

Do NOT attempt to execute WP-042 against its current locked values
— the locked migration filenames and the missing seed script would
produce a WP whose own verification steps fail against the repo.

At minimum three commits expected (matching the steady-state
topology); if the pre-commit review surfaces a nit, expect a
4th or 5th commit:

- Commit A0 (`SPEC:`) — pre-flight bundle (session prompt + any
  WP-042 / EC-042 amendments required by PS-1 resolution + any
  new D-entry if PS-3 resolves that way)
- Commit A (`EC-042:`) — code + 01.6 post-mortem (post-mortem
  required if the two new documentation files qualify as new
  long-lived abstractions; likely yes — they will be referenced
  by every future deployment + by WP-035's process docs for the
  project's lifetime)
- Commit B (`SPEC:`) — governance close (STATUS.md +
  WORK_INDEX.md + EC_INDEX.md)
- (Conditional) Commit C (`SPEC:`) — post-review nit follow-ups
- (Conditional) Commit D (`SPEC:`) — 01.4 precedent log additions
  if execution surfaces new patterns worth capturing
