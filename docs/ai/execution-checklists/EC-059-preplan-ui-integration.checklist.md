# EC-059 — Pre-Plan UI Integration (Store, Notification, Step Display) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-059-preplan-ui-integration.md
**Layer:** Client — `apps/arena-client/**`, consuming `packages/preplan/**`

> **EC numbering note:** EC-059 slot was free at draft time (2026-04-23).
> Commit prefix for WP-059 execution is `EC-059:`.

---

## Before Starting

- [ ] **WP-028 complete.** `UIState.game.activePlayerId: string` is
      exported from `@legendary-arena/game-engine` and present in the
      projection `useUiStateStore().snapshot` produces.
- [ ] **WP-056/057/058 complete.** `@legendary-arena/preplan` exports
      (verify via `packages/preplan/src/index.ts`): `createPrePlan`,
      `invalidatePrePlan`, `executeDisruptionPipeline`,
      `PREPLAN_STATUS_VALUES`, `PrePlanStatusValue` (type), `PrePlan`
      (type), `DisruptionNotification` (type),
      `DisruptionPipelineResult` (type), `PlayerStateSnapshot` (type).
- [ ] **WP-061/062/064/065 complete.** `apps/arena-client/` has
      `useUiStateStore()` in `src/stores/uiState.ts`, the
      fixture-driven component-test pattern under
      `src/components/hud/`, and runs `.vue` tests via
      `@legendary-arena/vue-sfc-loader/register`.
- [ ] **`createPrePlan` second-parameter shape confirmed.** Open
      `packages/preplan/src/preplanSandbox.ts` and read the exact type
      of the second parameter. If it requires fields beyond
      `{ turn: number; playerId: string }`, **STOP and revise WP-059
      §C.1 (`PrePlanContext`) before proceeding**. Do not widen
      `PrePlanContext` to include `G`, zones, or RNG state.
- [ ] **Baseline green.** `pnpm --filter @legendary-arena/arena-client
      typecheck` exits 0; `pnpm --filter @legendary-arena/arena-client
      test` exits 0; `pnpm --filter @legendary-arena/preplan build`
      exits 0; `pnpm --filter @legendary-arena/preplan test` exits 0;
      `pnpm -r test` exits 0. **Record `PRE_COUNT`** (the `pnpm -r
      test` total) — the §After Completing arithmetic check depends
      on it.
- [ ] **D-5901 slot is unclaimed** in `docs/ai/DECISIONS.md`
      (verified via `Select-String -Path docs\ai\DECISIONS.md -Pattern
      "^## D-5901"` → no match). If claimed, STOP and pick the next
      free 59xx slot, updating every `D-5901` reference across the
      WP, EC, ARCHITECTURE.md, and `.claude/rules/architecture.md` in
      lockstep.
- [ ] **ARCHITECTURE.md still forbids runtime preplan import from
      arena-client** (verified via the current Layer Boundary row
      listing `preplan` under "Must NOT import"). If already
      permitted, note this as a pre-landed carve-out and still write
      D-5901 to DECISIONS.md as the closed-loop record.
- [ ] **WP-087 session coordination.** A parallel session is running
      WP-087 on branch `wp-087-engine-type-hardening`. WP-059
      execution must NOT touch `packages/game-engine/**`. Verify
      branch before starting.
- [ ] **Pinia test isolation confirmed.** Executor confirms
      familiarity with the `setActivePinia(createPinia())` pattern
      in `node:test` suites. Every store-instantiating test must
      create a fresh Pinia root in a `beforeEach` hook — reusing a
      module-level store across tests is the #1 source of
      nondeterministic store test failures under this harness.

---

## Locked Values (do not re-derive)

- **Store id (exact string):** `'preplan'`
- **Store state keys (exact strings, exactly two):** `current`,
  `lastNotification`
- **Store action names (exact strings, exactly five):** `startPlan`,
  `consumePlan`, `recordDisruption`, `dismissNotification`,
  `clearPlan`
- **Store getter name (exact string):** `isActive`
- **`PREPLAN_STATUS_VALUES` members (exact strings, order from
  WP-057):** `'active'`, `'consumed'`, `'invalidated'`
- **`<PrePlanNotification />` accessibility attributes (verbatim):**
  `role="alert"`, `aria-live="assertive"`
- **Empty-state literal (exact string, verbatim in `<PrePlanStepList
  />`):** `"No plan is active."`
- **`startPlan` error message substring (verbatim):** `"Cannot start
  a plan while another plan is active"`
- **New DECISIONS.md entry id:** `D-5901` —
  "apps/arena-client runtime imports of `@legendary-arena/preplan`
  are permitted"
- **Component file paths (exact):**
  `apps/arena-client/src/components/preplan/PrePlanNotification.vue`,
  `apps/arena-client/src/components/preplan/PrePlanStepList.vue`
- **Store file path (exact):**
  `apps/arena-client/src/stores/preplan.ts`
- **Lifecycle adapter file path (exact):**
  `apps/arena-client/src/preplan/preplanLifecycle.ts`
- **Fixture named exports (exact, exactly six):**
  `activePrePlanFixture`, `consumedPrePlanFixture`,
  `invalidatedPrePlanFixture`, `sampleDisruptionResultFixture`,
  `samplePlayerStateSnapshotFixture`,
  `samplePrePlanContextFixture`
- **`preplanLifecycle.ts` runtime exports (exact, exactly three; the
  third is a type):** `startPrePlanForActiveViewer`,
  `applyDisruptionToStore`, `PrePlanContext`
- **Preplan runtime symbols actually invoked in this WP (exact):**
  `createPrePlan` (from the adapter), `invalidatePrePlan` (from the
  store's `recordDisruption`). **Nothing else.**
  `executeDisruptionPipeline` is **NOT** called by any file in this
  WP — its result type is type-only.

---

## Guardrails

- **`usePreplanStore` is the only write path to `current`.** Components
  never call `recordDisruption` directly; disruption events flow
  through `applyDisruptionToStore`. Components never mutate store
  state — reads use `storeToRefs`.
- **Last notification wins — no queue.** `recordDisruption` overwrites
  `lastNotification` unconditionally. No array, no Set, no ring
  buffer. Test §D #7 enforces this.
- **No engine runtime imports.** Files in this WP import
  `@legendary-arena/game-engine` via `import type` only — never
  `import { ... }`. Verification Step 5 enforces.
- **No wall-clock, no randomness, no persistence.** No `Math.random`,
  `Date.now`, `performance.now`, `new Date(`, `localStorage`,
  `sessionStorage`, `document.cookie`, `fetch(`, `XMLHttpRequest`
  anywhere under `apps/arena-client/src/stores/preplan.ts`,
  `apps/arena-client/src/preplan/**`, or
  `apps/arena-client/src/components/preplan/**`. Verification Steps
  6 and 8 enforce.
- **No `.reduce()` with branching** anywhere in new code.
  Verification Step 7 enforces.
- **No `store.$subscribe` registration** in new code. Plan-existence
  privacy depends on not broadcasting state. Verification Step 9
  enforces.
- **Prose-vs-grep discipline (lint §18).** JSDoc and block comments
  in new files must NOT enumerate forbidden tokens verbatim. Cite
  D-5901 or the governing source by reference. Literal-string-scoped
  greps in Verification Steps 4/5/6/7/8 will false-positive on
  verbatim prose.
- **ARCHITECTURE.md and `.claude/rules/architecture.md` must be
  updated in lockstep.** The Layer Boundary row for
  `apps/arena-client` is edited in both files with identical
  content; D-5901 cross-reference paragraph is added under the
  ARCHITECTURE.md table only.
- **Scope enforcement (P6-27).** `packages/game-engine/**`,
  `packages/registry/**`, `packages/preplan/**`,
  `packages/vue-sfc-loader/**`, `apps/server/**`, and
  `apps/registry-viewer/**` are untouched. Any file outside
  `## Files Expected to Change` is a scope violation — STOP and
  escalate to a pre-flight amendment.
- **Compile-time drift sentinel is mandatory.** The top of
  `preplanLifecycle.test.ts` contains the
  `Parameters<typeof createPrePlan>[1]` assignment exactly as
  specified in WP-059 §D. This is how future drift in `createPrePlan`
  is caught at compile time.
- **No UX flow is finalized here.** Absence of auto-regeneration
  after disruption, turn-start auto-consumption watchers, gesture
  UI (draw/play/recruit), and registry-backed card-name display is
  **intentional** per WP-059 §Out of Scope. These are not deficiencies
  to be "fixed during execution" — they depend on contracts
  (private-projection, live-mutation transport) that do not yet
  exist. Well-meaning over-implementation is a scope violation
  under P6-27.

---

## Required `// why:` Comments (verbatim from WP-059)

- **`apps/arena-client/src/stores/preplan.ts` — module header JSDoc:**
  the two invariant blocks (write-invariants + notification-overwrite
  invariant) verbatim from WP-059 §A.
- **`apps/arena-client/src/stores/preplan.ts` — on the Options API
  choice:** "the Pinia Options API shape is used instead of the Setup
  API because this store has a small, fixed surface — matching
  WP-061's precedent (`src/stores/uiState.ts`) keeps the two stores
  grep-symmetric for future maintainers."
- **`apps/arena-client/src/stores/preplan.ts` — on `consumePlan`:**
  the multi-line block verbatim from WP-059 §A starting with "there
  is no preplan-package helper for the 'consumed' transition..."
- **`apps/arena-client/src/stores/preplan.ts` — on `startPlan`'s
  throw:** "throws rather than silently replacing — a second active
  plan is almost certainly a caller bug. One active plan at a time
  is the lifecycle invariant from WP-056 + DESIGN-PREPLANNING §11."
- **`apps/arena-client/src/preplan/preplanLifecycle.ts` — on
  `applyDisruptionToStore`:** the multi-line block verbatim from
  WP-059 §C starting with "this adapter is the single named
  integration seam..."
- **`apps/arena-client/src/preplan/preplanLifecycle.test.ts` — on the
  compile-time drift sentinel at file top:** the comment verbatim
  from WP-059 §D starting with "compile-time drift sentinel. If
  `createPrePlan`'s second parameter shape drifts..."
- **`apps/arena-client/src/components/preplan/PrePlanStepList.vue`
  — at top of `<script setup>`:** the block verbatim from WP-059 §G
  starting with "components must never mutate plan state directly..."
- **`apps/arena-client/src/components/preplan/PrePlanNotification.vue`
  — in component header:** cite D-5901 for the
  `aria-live="assertive"` divergence from WP-064's `"polite"`. Do
  NOT restate "polite" or "assertive" in enumerated-forbidden-token
  form — cite the decision.

---

## Files to Produce

### New — client code
- `apps/arena-client/src/stores/preplan.ts` — Pinia Options-API store
- `apps/arena-client/src/preplan/preplanLifecycle.ts` — two adapters
  (`startPrePlanForActiveViewer`, `applyDisruptionToStore`) + exported
  `PrePlanContext` type
- `apps/arena-client/src/components/preplan/PrePlanNotification.vue`
  — disruption banner (`role="alert"`, `aria-live="assertive"`)
- `apps/arena-client/src/components/preplan/PrePlanStepList.vue` —
  passive plan-step reference display
- `apps/arena-client/src/fixtures/preplan/index.ts` — six named
  fixtures

### New — tests
- `apps/arena-client/src/stores/preplan.test.ts` — 13 tests
- `apps/arena-client/src/preplan/preplanLifecycle.test.ts` — 7 tests
  + 1 compile-time drift sentinel at file top (no runtime assertion)
- `apps/arena-client/src/components/preplan/PrePlanNotification.test.ts`
  — 5 tests
- `apps/arena-client/src/components/preplan/PrePlanStepList.test.ts`
  — 6 tests (including explicit negative: no status paragraph when
  status is `'active'`)
- `apps/arena-client/src/fixtures/preplan/index.test.ts` — 1 drift
  test for `PREPLAN_STATUS_VALUES`

**Test-count lock:** exactly **32 new runtime tests**, distributed as
**13 (store) + 7 (lifecycle) + 5 (notification) + 6 (step list) + 1
(drift)**. The compile-time drift sentinel at the top of
`preplanLifecycle.test.ts` is not counted. Each test file wrapped in
exactly one top-level `describe(…, () => { … })` block. This is the
single source of truth for the test count — if another number
appears anywhere in the EC or session output, treat the discrepancy
as a drafting bug and reconcile against this line.

### Modified — client wiring
- `apps/arena-client/package.json` — add
  `@legendary-arena/preplan: "workspace:*"` to `dependencies`.
  **No other changes.** Do not move `@legendary-arena/game-engine`
  between sections — it stays in `devDependencies` (type-only
  imports).

### Modified — governance (lockstep)
- `docs/ai/ARCHITECTURE.md` — Layer Boundary row for
  `apps/arena-client` (remove `preplan` from "Must NOT import",
  add it to "May import" with `(runtime — per D-5901)`
  annotation); D-5901 cross-reference paragraph immediately below
  the table
- `.claude/rules/architecture.md` — identical edit to the
  corresponding Import Rules table row; no new prose under the
  table (cross-reference lives in ARCHITECTURE.md only)
- `docs/ai/DECISIONS.md` — new **D-5901** entry with Context /
  Decision / Why subsections per WP-059 §N
- `docs/ai/STATUS.md` — dated paragraph per DoD
- `docs/ai/work-packets/WORK_INDEX.md` — change the WP-059 leading
  checkbox from `[ ]` to `[x]` and append the execution date
  (`YYYY-MM-DD`) and commit SHA to the title line, matching the
  style of the immediately preceding executed WP (WP-058 precedent:
  `✅ Reviewed — Executed 2026-04-20 at commit bae70e7` — omit
  `✅ Reviewed` until a reviewer assigns it separately; use
  `Executed YYYY-MM-DD at commit <sha>` only). Keep the `Notes:`
  block unchanged. Do not reorder entries or touch surrounding WPs.

**Untouched (grep to verify at commit time):**
`packages/game-engine/**`, `packages/registry/**`,
`packages/preplan/**`, `packages/vue-sfc-loader/**`,
`apps/server/**`, `apps/registry-viewer/**`. `git diff --name-only`
must match the above exactly — nothing more, nothing less.

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0.
      **Record `POST_ARENA_CLIENT_COUNT`.** The arena-client baseline
      pre-WP-059 is 13 tests (from WP-061/062/064/067). Expected:
      `POST_ARENA_CLIENT_COUNT >= 45` (13 + 32). Strict arithmetic:
      `POST_ARENA_CLIENT_COUNT - 13 === 32`. Any overage must be
      justifiable as strengthening declared test intent.
- [ ] `pnpm -r test` exits 0. **Record `POST_COUNT`.** Assert:
      `POST_COUNT - PRE_COUNT === 32` (strict equality). If the delta
      is not 32, STOP — either a test regressed elsewhere or a test
      was silently skipped. **Do NOT "fix" the count by deleting,
      renaming, or reclassifying tests; locate the discrepancy
      first.** Common causes: parallel-session commits landed new
      tests during execution (re-baseline `PRE_COUNT` against
      current `HEAD`), or a new test file was not picked up by the
      harness glob `src/**/*.test.ts` (check file extension and
      path).
- [ ] All 13 Verification Steps in WP-059 §Verification Steps exit
      with the expected output (no matches for Steps 4/5/6/7/8/9/11;
      at least one match for Steps 10/12; `git diff --name-only`
      matches the Files to Produce list exactly for Step 13).
- [ ] DECISIONS.md records **D-5901** with Context / Decision / Why
      subsections exactly as specified in WP-059 §N.
- [ ] ARCHITECTURE.md and `.claude/rules/architecture.md` are edited
      in lockstep — `git diff` of the two Layer Boundary rows shows
      identical column content.
- [ ] STATUS.md updated — dated paragraph naming the new store,
      components, and the deferred wiring (live-mutation middleware,
      speculative gesture UI).
- [ ] WORK_INDEX.md: WP-059 entry converted from `[ ]` to `[x]` with
      execution date and commit SHA; Pre-Planning chain-diagram line
      updated if warranted (otherwise leave "drafted 2026-04-23 —
      ready to execute" as-is until a follow-up session lands the
      diagram update).
- [ ] **01.6 post-mortem MANDATORY** per P6-28 — criteria met: (1)
      new contract surface (`usePreplanStore` shape + lifecycle
      adapter signatures) consumed by future WPs; (2) new long-lived
      abstraction (client-local advisory-state pattern that future
      client features may follow). Artifact lands at
      `docs/ai/post-mortems/01.6-WP-059-preplan-ui-integration.md`
      (project convention per EC-066 / EC-068 precedent — do not use
      a `PM-NNN-*.md` variant).

---

## Common Failure Smells

- **`TypeError: Cannot read properties of null (reading 'status')`
  in store tests** → a test called an action without `createPinia()
  .use(…)` or without `setActivePinia(createPinia())` in `beforeEach`.
  Every `node:test` suite that instantiates a store must create a
  fresh Pinia root first.
- **`Property 'setup' does not exist on type 'PrePlanContext'` at
  compile time** → the drift sentinel caught a real change in
  `createPrePlan`'s signature since this WP was drafted. STOP,
  revise WP-059 §C.1, and re-baseline the EC **before committing
  any code**. Do NOT widen `PrePlanContext` to shut the error up
  and do NOT land a partial commit with a stale WP — the point of
  the sentinel is to force the spec update first.
- **`lastNotification` retains the first fixture after two
  `applyDisruptionToStore` calls** → the store action branched on
  `lastNotification === null` before overwriting. The overwrite is
  unconditional; remove the guard.
- **`$subscribe` grep returns a match in new code** → the adapter
  or a component wired a subscription. Remove it. Subscriptions are
  the future middleware's job, not this WP's.
- **Step 5 grep (runtime `game-engine` imports) returns matches in
  `preplanLifecycle.ts`** → a runtime symbol was imported from
  `@legendary-arena/game-engine` instead of `@legendary-arena/preplan`
  (easy to confuse when both package names share the prefix).
  `createPrePlan`, `invalidatePrePlan`, `PREPLAN_STATUS_VALUES`
  live in preplan. `UIState` lives in game-engine (type-only).
- **Step 13 `git diff --name-only` shows
  `packages/game-engine/...`** → a test harness edit slipped into
  the engine package. STOP. WP-087 is running there in parallel;
  even a trivial edit is a merge-conflict risk. Revert and reopen
  the change under a different WP.
- **`POST_COUNT - PRE_COUNT !== 32`** → either a parallel session
  landed commits with new tests (common when WP-087 commits during
  this session — re-run `pnpm -r test` against `HEAD` and re-baseline)
  or one of your new tests silently failed to register. Run the
  arena-client filter alone to isolate.
- **Status-paragraph test (§H #3) passes incorrectly when the
  template renders the paragraph on active plans** → the `v-if` was
  written as `v-if="current"` instead of
  `v-if="current && current.status !== 'active'"`. The paragraph is
  terminal-state-only.
- **ARCHITECTURE.md row edit leaves a dangling `preplan,` in the
  "Must NOT import" column** → comma / spacing artifact from
  deleting just one entry. Re-check the row's comma placement;
  `.claude/rules/architecture.md` must match byte-for-byte on the
  row content.
- **Lint §18 false positive on Verification Step 4** → a new JSDoc
  or `// why:` comment restated `boardgame.io` verbatim. Soften the
  prose to cite ARCHITECTURE.md §Pre-Planning Layer or D-5901 by
  reference (per the Prose-vs-grep guardrail).
