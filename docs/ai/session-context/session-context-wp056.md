# Session Context — WP-056 Pre-Planning State Model & Lifecycle

Bridge from WP-055 execution (Phase 6 successor work, 2026-04-20) to the
WP-056 executor. Carries baselines, quarantine state, the inherited
dirty-tree map, discipline precedents from the WP-034 → WP-035 →
WP-042 → WP-055 closure sequence, and WP-056-specific pre-flight
considerations.

---

## Baselines (WP-055 closed at commit `211516d`)

- **Registry package:** `13 tests / 2 suites / 0 failing` (was 3/1/0
  pre-WP-055; +10 tests in the `theme schema (WP-055)` describe block).
- **Engine package:** `436 tests / 109 suites / 0 failing` — unchanged
  since the end of Phase 6 (WP-034 / WP-035 / WP-042 / WP-055 all held
  this baseline).
- **Repo-wide:** `536 passing / 0 failing` — sum of registry 13 +
  vue-sfc-loader 11 + game-engine 436 + server 6 + replay-producer 4 +
  arena-client 66.
- **HEAD:** commit `211516d` on branch `wp-064-log-replay-inspector`.

**WP-056 test-count expectation (not a lock yet, confirm at pre-flight):**
WP-056 is a **types-only WP** per the spec §G — all exports are
`export type`, no runtime code. Expected baseline shift:

- **New `packages/preplan/` package with 0 tests** (types-only; no
  `.test.ts` file required). A drift-detection smoke test (tsc-only
  compilation check) may be added at pre-flight if the gatekeeper wants
  a suite-level presence assertion.
- **Registry package:** `13 / 2 / 0` unchanged.
- **Engine package:** `436 / 109 / 0` **unchanged** (WP-056 touches
  zero engine code).
- **Repo-wide:** `536 / 0` unchanged.

RS-2-style lock should state explicitly that WP-056 adds zero tests
and every other package's baseline must hold.

---

## Quarantine state — do NOT disturb

All three stashes from prior sessions remain intact and MUST NOT be
popped during WP-056 execution:

- **`stash@{0}`** — `wp-055-quarantine-viewer`. Holds
  `apps/registry-viewer/src/lib/themeClient.ts` +
  `apps/registry-viewer/CLAUDE.md` v1→v2 viewer edits. Owned by a
  follow-up viewer-domain commit that post-dates WP-055. Unrelated to
  WP-056.
- **`stash@{1}`** — WP-068 / MOVE_LOG_FORMAT governance edits
  (quarantined during WP-062 commit). Unrelated to WP-056.
- **`stash@{2}`** — pre-WP-062 dirty tree (in-flight work +
  WP-068 lessons-learned 01.4 additions). Unrelated to WP-056.

---

## Inherited dirty-tree state — do NOT stage under WP-056

Running `git status --short` at session start will show these items.
None of them are in WP-056's scope. Quarantine them or leave them
untracked; **never** `git add .` / `git add -A` (P6-27 discipline).

- `M docs/ai/invocations/session-wp079-label-replay-harness-determinism-only.md`
- `?? .claude/worktrees/` — runtime state from the `spawn_task` chips
  spawned during WP-055 closeout (build-pipeline cleanup task). Do NOT
  commit this directory.
- `?? docs/ai/REFERENCE/01.3-ec-mode-commit-checklist.oneliner.md`
- `?? docs/ai/invocations/forensics-move-log-format.md`
- `?? docs/ai/invocations/session-wp048-par-scenario-scoring.md`
- `?? docs/ai/invocations/session-wp067-uistate-par-projection-and-progress-counters.md`
- `?? docs/ai/invocations/session-wp068-preferences-foundation.md`
- `?? docs/ai/post-mortems/01.6-applyReplayStep.md`
- `?? docs/ai/session-context/session-context-forensics-move-log-format.md`
- `?? docs/ai/session-context/session-context-wp067.md`

If `.claude/worktrees/` contains an actively-running worktree from the
build-pipeline cleanup session, **do not touch it** — it's the
parallel session spawned via the chip. WP-056 and the build-pipeline
cleanup are independent and may land in any order.

---

## Parallel session in flight

A separate Claude Code session was spawned during WP-055 closeout to
address a stale registry build pipeline (`normalize-cards.ts` +
`build-dist.mjs` import non-existent schema symbols from pre-WP-003
days). That session runs in its own worktree (see
`.claude/worktrees/` if present) and will eventually land its own
WP on the main branch — likely as a new registry-hygiene WP or
`R-EC-*` entry.

**Relevance to WP-056:** none. The build-pipeline cleanup touches
`packages/registry/scripts/` and `packages/registry/package.json`
`scripts` section. WP-056 touches `packages/preplan/` (new package)
and `pnpm-workspace.yaml` (adding the new package). Zero file
overlap, zero dependency order. If both sessions try to merge
simultaneously, resolve the workspace file conflict in favor of
whichever lands first; the other session will rebase.

---

## What already exists — do NOT recreate

WP-056 is the **first WP in the pre-planning chain** (WP-056 → WP-057 →
WP-058; WP-059 deferred). The design is locked before WP-056 begins
execution. Read these before writing any code:

### Design documents (locked)

- `docs/ai/DESIGN-PREPLANNING.md` — approved pre-planning architecture.
  Sections: overview, sandbox model, rewind semantics, notification
  design, WP-059 deferral rationale.
- `docs/ai/DESIGN-CONSTRAINTS-PREPLANNING.md` — 12 design constraints.
  WP-056 enforces constraints #1 (explicit representation), #2
  (advisory / non-binding), #3 (full rewind capability), #9 (no
  information leakage), #10 (single-turn scope). Constraints #4, #6,
  #7, #8, #11, #12 are enforced by WP-057 and WP-058 — the WP-056
  pre-flight must NOT pull scope forward.

### Upstream contracts (locked — do NOT modify)

- **WP-006A (`packages/game-engine/src/zones.types.ts`)** — locks
  `CardExtId = string` (named type alias), `PlayerZones`,
  `GlobalPiles`, `PlayerState`. The `PrePlanSandboxState` type in
  WP-056 §C mirrors `PlayerZones` (`hand`, `deck`, `discard`,
  `inPlay`) plus `counters: Record<string, number>` but intentionally
  **omits `victory`** — victory pile is not player-visible during
  normal play. Confirm at pre-flight this omission is intentional.
- **WP-008B (`packages/game-engine/src/moves/`)** — locks the three
  core move names (`drawCards`, `playCard`, `endTurn`) and stage
  gating. `PrePlanStep.intent` in WP-056 §E uses move-like strings
  (`'playCard'`, `'recruitHero'`, `'fightVillain'`, `'useEffect'`,
  plus `| string` for extensibility) — these are **not** the same
  union as `CORE_MOVE_NAMES` and that's deliberate (pre-planning
  intents are descriptive, not executable).

### Conventions already locked by WORK_INDEX.md for WP-056

From `docs/ai/work-packets/WORK_INDEX.md §Conventions Established
Across WPs` (lines 1424-1426):

- Pre-planning state lives in `packages/preplan/` — never in
  `packages/game-engine/` (non-authoritative, per-client).
  Source: `DESIGN-PREPLANNING.md §3`.
- Reveal ledger is the sole authority for rewind — sandbox inspection
  during rewind is invalid. Source:
  `DESIGN-CONSTRAINTS-PREPLANNING.md #3`.
- Full rewind to clean hand is the baseline — partial plan survival is
  a future optimization. Source:
  `DESIGN-CONSTRAINTS-PREPLANNING.md #3`.

These are settled. Do not re-debate. The WP-056 session prompt should
cite them and move on.

### Architectural pre-blessings

- **`docs/ai/ARCHITECTURE.md`** §Layer Boundary (Authoritative) already
  lists `packages/preplan/**` as a layer (row: "Pre-Planning |
  `packages/preplan/**` | Speculative planning for waiting players
  (non-authoritative) | `DESIGN-PREPLANNING.md`"). The layer is
  pre-documented; WP-056 physically instantiates it.
- **`.claude/rules/architecture.md`** §Layer Overview has the same
  row and §Import Rules (Quick Reference) table locks the
  preplan package's import matrix: "`game-engine` (types only),
  Node built-ins | MUST NOT import `game-engine` (runtime),
  `registry`, `server`, any `apps/*`, `pg`, `boardgame.io`".
- **No new D-entry required** for the layer itself — it's already
  codified. D-entries MAY be authored during WP-056 execution if
  novel decisions surface, but the lifecycle semantics, ledger
  authority, and single-turn scope are already captured in the
  existing design docs and WORK_INDEX conventions.

---

## What WP-056 must create (per spec §Scope (In))

- `packages/preplan/package.json` — pnpm workspace package
  (`@legendary-arena/preplan`; ESM-only; `type: "module"`;
  `@legendary-arena/game-engine` as a type-only peer dep).
- `packages/preplan/tsconfig.json` — matches the registry /
  game-engine tsconfig pattern (NodeNext module resolution,
  `ES2022` target, strict mode with
  `exactOptionalPropertyTypes: true` and
  `noUncheckedIndexedAccess: true`).
- `packages/preplan/src/preplan.types.ts` — the four public types:
  `PrePlan`, `PrePlanSandboxState`, `RevealRecord`, `PrePlanStep`.
  All JSDoc lifecycle invariants inline (no separate `.md` file
  inside `src/`).
- `packages/preplan/src/index.ts` — type-only re-exports of all
  four types.
- `pnpm-workspace.yaml` — **modify**: the current file uses a
  glob pattern `"packages/*"` so the new package is auto-picked
  up; verify `pnpm install` recognizes it. If the glob already
  covers it, NO modification to `pnpm-workspace.yaml` is required
  — pre-flight must check. (Observed 2026-04-20:
  `pnpm-workspace.yaml` contains `packages: ["packages/*",
  "apps/*"]` — the glob already covers `packages/preplan/`, so
  the WP-056 spec §Files Expected to Change table is
  **incorrect** to list `pnpm-workspace.yaml` as "modify". The
  pre-flight should correct this in the allowlist.)

---

## Discipline precedents to carry into the WP-056 pre-flight

These precedents were locked during Phase 6 (WP-034 / WP-035 /
WP-042) and validated by WP-055. Each is citable by its precedent
ID in `01.4-pre-flight-invocation.md`.

### Reality-reconciliation at pre-flight (WP-042 §8 → WP-055 §8)

Before locking any **Locked Value** in the WP-056 session prompt —
type names, file paths, test-count baselines, workspace glob
behavior — **grep the actual source files** to confirm the name
exists and matches. WP-055 caught a token-paraphrase drift during
verification Step 4 (a literal `packages/game-engine/src/...`
reference inside a `// why:` comment) that a pre-flight grep
could have prevented. For WP-056 specifically, cross-check:

- `packages/game-engine/src/zones.types.ts` — confirm the type names
  the preplan types reference (`CardExtId`). Confirm `CardExtId` is
  exported from the engine's public surface (`index.ts`) — if not,
  adjust the preplan import to wherever the engine actually exports
  it from.
- `pnpm-workspace.yaml` — confirm the glob pattern already covers
  `packages/preplan/` (it does, per 2026-04-20 observation). Update
  the spec allowlist if the pre-flight confirms no modification is
  needed.
- `packages/registry/tsconfig.json` and
  `packages/game-engine/tsconfig.json` — confirm the tsconfig pattern
  the preplan tsconfig should mirror. The registry tsconfig is a
  known-good reference (NodeNext, ES2022, strict + extras).

### Three-commit topology (proven across WP-034 / WP-035 / WP-042 /
WP-055)

Every Phase-6-successor WP should close with this topology:

1. **Commit A0 (`SPEC:`)** — pre-flight bundle: new EC-056 (to be
   authored — no EC-056 exists yet) + EC_INDEX row + WP-056 spec
   amendments (e.g., `pnpm-workspace.yaml` allowlist correction) +
   session invocation prompt + session context (this file) if not
   already committed.
2. **Commit A (`EC-056:`)** — execution: files in the allowlist
   (`packages/preplan/*` new files) + any D-entries authored during
   execution + 01.6 post-mortem.
3. **Commit B (`SPEC:`)** — governance close: `STATUS.md` +
   `WORK_INDEX.md` (WP-056 `[x]` with date + commit hash) +
   `EC_INDEX.md` (EC-056 status Draft → Done) + any
   `DECISIONS_INDEX.md` entries if D-entries were authored in
   Commit A.

The commit-msg hook enforces the prefixes; `WP-056:` as a commit
prefix is **forbidden** per P6-36. Use `EC-056:` for code-changing
commits and `SPEC:` for governance / pre-flight.

### 01.5 Runtime Wiring Allowance — NOT INVOKED for WP-056

WP-056 adds **new types and a new package**; it does not modify
`LegendaryGameState`, `LegendaryGame.moves`, or any other engine-wide
shared contract. All four 01.5 trigger criteria are absent:

- No required field added to `LegendaryGameState` or any shared
  engine type.
- No shape change to `buildInitialGameState`-class orchestrators.
- No new move added to `LegendaryGame.moves`.
- No new phase hook added.

State the **NOT INVOKED** verdict explicitly in the session prompt
per P6-51 form-(1) precedent.

### 01.6 Post-Mortem — MANDATORY for WP-056

Three triggers fire (any one alone would mandate 01.6):

1. **New long-lived abstraction.** `PrePlan` (and
   `PrePlanSandboxState`, `RevealRecord`, `PrePlanStep`) is the
   canonical pre-planning contract for the lifetime of the project.
2. **New contract consumed by future WPs.** WP-057 (sandbox
   execution) and WP-058 (disruption pipeline) will both import
   these types.
3. **New code-category directory.** `packages/preplan/` is a new
   top-level package that requires the D-NNNN code-category
   classification pattern introduced by D-3401 (WP-034) and
   D-3501 (WP-035). If the pre-flight confirms `packages/preplan/`
   is not already classified in `02-CODE-CATEGORIES.md`, a new
   D-entry (tentatively `D-5601`) must be authored in Commit A
   classifying it as the "Pre-Planning" category with the import
   restrictions from ARCHITECTURE.md §Pre-Planning Layer.

Formal 10-section audit at
`docs/ai/post-mortems/01.6-WP-056-preplan-state-model.md`, staged
into Commit A.

### Paraphrase discipline (P6-50)

The JSDoc comments in `preplan.types.ts` must avoid accidentally
referring to engine runtime concepts by name (`G`, `ctx`,
`LegendaryGameState`, `LegendaryGame`, `boardgame.io`) — the
preplan package does not know the engine's runtime shape; it only
knows a few type aliases (`CardExtId`). The existing `// why:`
comments in `packages/registry/src/schema.ts` and
`packages/registry/src/theme.schema.ts` (WP-055) are the model:
they describe data concerns only and do not reach across the
layer boundary in prose.

Verification greps to include in the session prompt:

- `grep -rE "from ['\"]boardgame\.io" packages/preplan/` — zero
  hits.
- `grep -rE "from ['\"]@legendary-arena/game-engine['\"]\s*;?\s*$" packages/preplan/` —
  any hit must be `import type` only; `grep` for the bare import
  form should return zero.
- `grep -r "Math.random" packages/preplan/` — zero hits (speculative
  PRNG belongs to WP-057, not WP-056).
- `grep -r "require(" packages/preplan/` — zero hits (ESM only).

### Forbidden staging patterns (P6-27 / P6-44)

- Never `git add .` / `git add -A`.
- Stage by name only.
- Never `--no-verify`; never `--no-gpg-sign`.
- `pnpm-lock.yaml` MUST NOT change if `package.json` is not modified.
  WP-056 adds a new `packages/preplan/package.json` (new file, not
  modify) — if `pnpm install` regenerates `pnpm-lock.yaml`, that
  regeneration IS in scope for WP-056's allowlist; confirm at
  pre-flight.

---

## Open questions for the WP-056 pre-flight session

These surfaced while preparing this bridge; resolve them at
pre-flight rather than at execution:

1. **`pnpm-workspace.yaml` allowlist correction.** The spec §Files
   Expected to Change lists `pnpm-workspace.yaml` as "modify", but
   the current workspace file uses a `packages/*` glob that already
   covers `packages/preplan/`. If no edit is needed, remove the
   file from the allowlist; if an `allowBuilds` or similar entry is
   needed, confirm the exact edit shape.
2. **`pnpm-lock.yaml` regeneration scope.** Adding a new package
   triggers a lockfile update on `pnpm install`. Is that in scope
   for WP-056's Commit A, or does it require a separate
   `SPEC:` bump? P6-44 says the lockfile MUST NOT change when
   `package.json` is not modified — but WP-056 adds a new
   `package.json`. Pre-flight should state the expected lockfile
   delta (likely a new `importers.packages/preplan` block) and
   stage it under the allowlist.
3. **`CardExtId` import path.** The spec §B code shows
   `import type { CardExtId } from '@legendary-arena/game-engine';`
   — confirm this is what the engine's public surface
   (`packages/game-engine/src/index.ts`) currently exports. If
   `CardExtId` is only exported from a deeper path (e.g.,
   `.../zones.types.js`), the import in `preplan.types.ts` should
   match. Pre-flight should grep and lock.
4. **Package category in `02-CODE-CATEGORIES.md`.** Confirm
   `packages/preplan/` is NOT already classified. If it isn't,
   authoring a new D-entry (e.g., `D-5601`) classifying it is in
   scope for Commit A. If a classification already exists, cite
   it in the session prompt's Pre-Session Gates instead of
   authoring a new entry.
5. **Tsconfig pattern choice.** Should `packages/preplan/tsconfig.json`
   inherit from a shared base (if one exists at the monorepo root),
   or duplicate the registry / game-engine pattern? Check for a
   root `tsconfig.base.json` at pre-flight and decide.
6. **Test file presence.** The spec §G says "Type-only exports. No
   runtime code in this WP." No test file is listed in §Files
   Expected to Change. Confirm at pre-flight whether a drift-
   detection smoke test (tsc-only compile check with no assertions)
   should be added anyway for suite-count presence. If YES, add
   one file to the allowlist. If NO, state the zero-test baseline
   explicitly in the session prompt (RS-2-style).
7. **Single-file vs multi-file type split.** The spec §B / §C / §D /
   §E all point to `preplan.types.ts` (single file with four type
   sections). Confirm this is the intended final shape rather than
   splitting into per-type files. The existing
   `packages/registry/src/theme.schema.ts` (WP-055) bundles five
   schemas in one file — precedent supports the single-file
   approach.

---

## Copilot Check (01.7) recommendation

Per `docs/ai/REFERENCE/01.7-copilot-check.md §When Copilot Check Is
Required`, 01.7 is **recommended but optional** for types-only WPs.
Run it for WP-056 because:

- WP-056 introduces a new long-lived abstraction (`PrePlan`).
- WP-056 introduces a new code-category directory
  (`packages/preplan/`).
- Two future WPs (WP-057, WP-058) will consume this contract, so
  the aliasing / leak / coupling risks compound if the types are
  wrong.

Expected verdict after pre-flight tightening: **CONFIRM**. If 01.7
returns RISK, fold the FIXes into the WP spec before writing the
session prompt (the WP-055 FIX #17 + FIX #22 pattern).

---

## Final reminders

- **Phase 6 is closed.** No mid-WP-056 retro-editing of Phase-6
  artifacts (WP-034 / WP-035 / WP-042 / WP-055 are all `[x]`).
- **`packages/preplan/` is non-authoritative.** The package owns
  no game state; everything it produces is advisory. Any pressure
  during execution to add a write path to `G` is an architecture
  violation per ARCHITECTURE.md §Pre-Planning Layer — stop and
  escalate.
- **Types only.** WP-056 has zero runtime executable code. All
  "functions" in the spec are JSDoc contracts, not function
  declarations. If a reviewer's instinct is "add a helper" or
  "add a factory," that belongs to WP-057.
- **Full rewind baseline.** The reveal ledger is the sole rewind
  authority. If execution surfaces pressure to add partial-plan-
  survival optimizations, that is explicitly out of scope per
  `DESIGN-CONSTRAINTS-PREPLANNING.md #3`.
- **Single-turn scope.** `appliesToTurn = ctx.turn + 1` is a hard
  invariant. Future multi-turn planning proposals are out of scope
  (and will likely be rejected by design-doc review).
- **Three-commit topology + 01.6 MANDATORY + 01.5 NOT INVOKED** —
  call all three out in the session prompt per WP-055 precedent.
- **Parallel build-pipeline cleanup session may still be in flight.**
  If it merges first, rebase WP-056 onto it (no conflicts expected
  — different files). If WP-056 merges first, the cleanup session
  rebases. Neither session has a hard ordering dependency on the
  other.
