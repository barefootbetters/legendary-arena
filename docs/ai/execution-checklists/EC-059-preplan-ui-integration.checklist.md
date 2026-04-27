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
- [ ] **`createPrePlan` parameter list confirmed.** Open
      `packages/preplan/src/preplanSandbox.ts:37-41` and confirm the
      signature is exactly `createPrePlan(snapshot:
      PlayerStateSnapshot, prePlanId: string, prngSeed: number):
      PrePlan` — three positional parameters. The v1 `PrePlanContext`
      object-shape was discarded after pre-flight CV-1; the WP v2
      passes `prePlanId` and `prngSeed` as top-level args fields and
      forwards them positionally. If the signature has drifted (a
      fourth parameter, a renamed parameter, or a different return
      type), **STOP and revise WP-059 §C + the §D drift sentinel
      before proceeding**.
- [ ] **Baseline green.** `pnpm --filter @legendary-arena/arena-client
      typecheck` exits 0; `pnpm --filter @legendary-arena/arena-client
      test` exits 0; `pnpm --filter @legendary-arena/preplan build`
      exits 0; `pnpm --filter @legendary-arena/preplan test` exits 0;
      `pnpm -r test` exits 0. **Record both
      `PRE_ARENA_CLIENT_COUNT`** (arena-client filter total) **and
      `PRE_COUNT`** (`pnpm -r test` total) — the §After Completing
      arithmetic checks depend on both. Hard-coded baselines drift;
      capture against current `HEAD`.
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
- **`PREPLAN_STATUS_VALUES` members (exact strings, in canonical
  array order verified against
  `packages/preplan/src/preplanStatus.ts:15`):** `'active'`,
  `'invalidated'`, `'consumed'`
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
  `sampleDisruptionResultWithCardFixture`,
  `samplePlayerStateSnapshotFixture` (the v1
  `samplePrePlanContextFixture` was replaced per CV-1 — no
  `PrePlanContext` type exists in v2; the v2 sixth fixture is the
  `withCard` notification variant that exercises the optional
  `affectedCardExtId` render path)
- **`preplanLifecycle.ts` exports (exactly two; both runtime, no
  type exports):** `startPrePlanForActiveViewer` (runtime),
  `applyDisruptionToStore` (runtime). The v1 `PrePlanContext` type
  was dropped per CV-1 — `createPrePlan` takes positional scalars,
  not a context object.
- **Preplan runtime symbols actually invoked in this WP (exact):**
  `createPrePlan` (from `startPrePlanForActiveViewer` in the
  lifecycle adapter). **Nothing else.** `invalidatePrePlan` is
  **NOT** called by any file in this WP — the store's
  `recordDisruption` consumes `result.invalidatedPlan` directly from
  the `DisruptionPipelineResult`, which the future middleware will
  populate by calling `executeDisruptionPipeline`. Per CV-2:
  invalidation has already happened inside the pipeline; calling
  `invalidatePrePlan` again from the store would either return
  `null` or duplicate work. `executeDisruptionPipeline` is also
  **NOT** called by any file in this WP — its result type is
  consumed at the type level only.
- **`DisruptionNotification` field names (exact, verified against
  `packages/preplan/src/disruption.types.ts:57-72`):** `prePlanId`,
  `affectedPlayerId`, `sourcePlayerId`, `message`,
  `affectedCardExtId?`. **No `cause` field. No `targetCard`
  field.** The v1 spec used both `cause` and `targetCard`; both
  were fictional. Verification in §J's drift sentinels and the
  `<PrePlanNotification />` template's class selectors must use
  the actual field names.
- **`PrePlan` field names that this WP relies on (exact, verified
  against `packages/preplan/src/preplan.types.ts:29-116`):**
  `prePlanId`, `revision`, `playerId`, `appliesToTurn`, `status`,
  `baseStateFingerprint`, `sandboxState`, `revealLedger`,
  `planSteps`, `invalidationReason?`. The v1 spec used
  `createdAtTurn`, which does not exist; v2 uses `appliesToTurn`
  (= `snapshot.currentTurn + 1` per `preplanSandbox.ts:52`).
- **`DisruptionPipelineResult` field names (exact):**
  `invalidatedPlan`, `sourceRestoration`, `notification`,
  `requiresImmediateNotification` (typed as the literal `true`).
  The v1 spec used `restoration` and `isValid`; both were wrong.

---

## Guardrails

- **`usePreplanStore` is the only write path to `current`.** Within
  the store, `startPlan`, `consumePlan`, `recordDisruption`, and
  `clearPlan` are all valid writers. The lifecycle adapter
  `applyDisruptionToStore` is the only **disruption-driven** seam:
  components never call `recordDisruption` directly; disruption
  events flow through `applyDisruptionToStore`. Components never
  mutate store state — reads use `storeToRefs`.
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
- **No `store.$subscribe` registration** in new production code.
  Plan-existence privacy depends on not broadcasting state.
  Verification Step 9 enforces (greps `apps\arena-client\src` with
  `-Exclude "*.test.ts"`; test files MAY reference `$subscribe` to
  assert non-registration — see `preplanLifecycle.test.ts §D #6`).
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
  createPrePlan's parameter list drifts (WP-057 adds, removes,
  renames, or reorders any of the three positional parameters..."
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
  (`startPrePlanForActiveViewer`, `applyDisruptionToStore`); no type
  exports (the v1 `PrePlanContext` was dropped per CV-1)
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
- `apps/arena-client/src/fixtures/preplan/index.test.ts` — 3 drift
  tests (`PREPLAN_STATUS_VALUES` shape +
  `DisruptionNotification` field-set in two variants)

**Test-count lock:** exactly **34 new runtime tests**, distributed as
**13 (store) + 7 (lifecycle) + 5 (notification) + 6 (step list) + 3
(drift)**. The compile-time drift sentinel at the top of
`preplanLifecycle.test.ts` is not counted. Each test file wrapped in
exactly one top-level `describe(…, () => { … })` block. This is the
single source of truth for the test count — if another number
appears anywhere in the EC or session output, treat the discrepancy
as a drafting bug and reconcile against this line. (V1 had 32 tests;
v2 added two `DisruptionNotification` field-set drift sentinels to
§J after pre-flight Copilot Issue 27 RISK fix folded into PS-1.)

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
      **Record `PRE_ARENA_CLIENT_COUNT` before changes (in §Before
      Starting baseline-green) and `POST_ARENA_CLIENT_COUNT` after.**
      Strict arithmetic:
      `POST_ARENA_CLIENT_COUNT - PRE_ARENA_CLIENT_COUNT === 34`. Any
      delta mismatch must be explained (parallel session landed
      arena-client tests during execution, harness glob missed a new
      file, etc.) and reconciled before proceeding. Do NOT "fix" the
      count by deleting, renaming, or reclassifying tests.
- [ ] `pnpm -r test` exits 0. **Record `POST_COUNT`.** Assert:
      `POST_COUNT - PRE_COUNT === 34` (strict equality). If the delta
      is not 34, STOP — either a test regressed elsewhere or a test
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
- **Drift sentinel typecheck failure (`Type 'true' is not assignable
  to type 'never'`) at the top of `preplanLifecycle.test.ts`** →
  `createPrePlan`'s parameter list changed since the v2 spec was
  authored. STOP, read `packages/preplan/src/preplanSandbox.ts:37-41`
  for the new shape, revise WP-059 §C + the §D sentinel block + the
  EC `createPrePlan` parameter-list-confirmed item, and re-baseline
  the WP body **before committing any code**. Do NOT relax the
  sentinel's tuple type to make it pass — the point of the sentinel
  is to force the spec update first.
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
  `createPrePlan`, `PREPLAN_STATUS_VALUES`, `PrePlanStatusValue`
  live in preplan. `UIState` lives in game-engine (type-only).
  Note: `invalidatePrePlan` is a preplan export but is **not**
  invoked by any v2 WP-059 file — if a runtime import of
  `invalidatePrePlan` shows up, the executor mistakenly reverted to
  the v1 `recordDisruption` design that called the helper directly.
  Per CV-2, the v2 store reads `result.invalidatedPlan` instead.
- **Step 13 `git diff --name-only` shows
  `packages/game-engine/...`** → a test harness edit slipped into
  the engine package. STOP. WP-087 is running there in parallel;
  even a trivial edit is a merge-conflict risk. Revert and reopen
  the change under a different WP.
- **`POST_COUNT - PRE_COUNT !== 34`** → either a parallel session
  landed commits with new tests (common when WP-087 commits during
  this session — re-run `pnpm -r test` against `HEAD` and re-baseline)
  or one of your new tests silently failed to register. Run the
  arena-client filter alone to isolate. (V1 expected delta was 32;
  v2 is 34 — two additional `DisruptionNotification` field-set drift
  sentinels were folded into §J.)
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
