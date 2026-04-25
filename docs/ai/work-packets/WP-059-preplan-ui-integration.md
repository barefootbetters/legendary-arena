# WP-059 — Pre-Plan UI Integration (Store, Notification, Step Display)

**Status:** Draft
**Primary Layer:** Client / Pre-Planning Integration (`apps/arena-client/**`, consuming `packages/preplan/**`)
**Dependencies:** WP-028 (UIState contract), WP-056 (PrePlan state model), WP-057 (sandbox + speculative ops), WP-058 (disruption pipeline), WP-061 (arena-client bootstrap), WP-065 (Vue SFC test transform)

---

## Session Context

WP-056/057/058 shipped the non-authoritative `@legendary-arena/preplan`
package with a complete client-consumable surface (`createPrePlan`,
speculative operations, `executeDisruptionPipeline`) and three status
values (`'active' | 'consumed' | 'invalidated'`). WP-061 created
`apps/arena-client/` on Vue 3 + Vite + Pinia, exposing
`useUiStateStore()` as the sole projection surface. WP-062 / WP-064
added fixture-driven HUD and replay-inspector components. WP-059 is
the first packet that wires the preplan package into the arena client:
a second Pinia store for client-local speculative state, a
disruption-notification banner, a passive plan-step display, and the
lifecycle adapters that connect them. Live boardgame.io client
middleware that observes real mutations to trigger
`executeDisruptionPipeline` is **out of scope** here — that depends on
the live-match transport landing in WP-090. This packet ships the
store, components, and pure adapters against test fixtures so the
wiring surface is frozen and junior-maintainable before the transport
arrives.

---

## Goal

After this session, `apps/arena-client/` can host, display, and invalidate
a player's pre-plan entirely client-side. Specifically:

1. A new Pinia store `usePreplanStore()` holds exactly two state fields
   (`current: PrePlan | null`, `lastNotification: DisruptionNotification
   | null`) and exposes five actions (`startPlan`, `consumePlan`,
   `recordDisruption`, `dismissNotification`, `clearPlan`) and one
   getter (`isActive`).
2. A pure lifecycle adapter module
   (`apps/arena-client/src/preplan/preplanLifecycle.ts`) wraps
   `createPrePlan` (WP-057) behind `startPrePlanForActiveViewer` and
   freezes the disruption integration seam behind
   `applyDisruptionToStore`. Both functions are pure given their store
   argument and input data; neither performs I/O.
   `applyDisruptionToStore` consumes a `DisruptionPipelineResult`
   produced elsewhere (future live-mutation middleware), but does not
   invoke the disruption pipeline itself in this WP.
3. Two Vue 3 components:
   - `<PrePlanNotification />` renders the current
     `DisruptionNotification` in an `aria-live="assertive"` region with
     a dismiss button, or nothing when `lastNotification` is `null`.
   - `<PrePlanStepList />` renders `current.planSteps` as a passive
     ordered reference list, or an empty-state message when no plan
     exists. These components are shipped and verified in isolation
     via fixture-driven tests; mounting them into the main
     `<ArenaHud />` surface is deferred until live transport /
     middleware exists.
4. A reusable fixture module
   (`apps/arena-client/src/fixtures/preplan/index.ts`) exports six
   named fixtures: three `PrePlan` variants
   (active / consumed / invalidated), one `DisruptionPipelineResult`
   (invalid, with a populated `DisruptionNotification`), and supporting
   `PlayerStateSnapshot` and `PrePlanContext` fixtures for deterministic
   rendering and store / adapter tests. (Authoritative list in §I.)
5. `apps/arena-client/package.json` lists `@legendary-arena/preplan`
   under `dependencies` (promoted from absent). Two preplan runtime
   symbols are actually invoked from new code in this WP —
   `createPrePlan` (in the lifecycle adapter) and `invalidatePrePlan`
   (in the store's `recordDisruption` action).
   `executeDisruptionPipeline` is **not invoked** by WP-059; its
   result type (`DisruptionPipelineResult`) is consumed as the input
   to `applyDisruptionToStore` at the type level only, and the actual
   invocation will come from the future live-mutation middleware that
   WP-090 unblocks. The dependency promotion covers both current
   runtime use and the frozen import surface that middleware will
   reuse.
6. `docs/ai/ARCHITECTURE.md` §Layer Boundary and
   `.claude/rules/architecture.md` are updated to permit
   `apps/arena-client` to runtime-import `@legendary-arena/preplan`,
   recorded under new entry **D-5901**.

Speculative draw/play/recruit UI gestures, live-mutation detection
middleware, cross-turn plan regeneration flows, and the ARIA live-region
contract's final design are explicitly deferred to a follow-up WP
(tentative slot WP-091; see §Out of Scope).

---

## Assumes

- WP-028 complete. `UIState` is the only engine→UI projection; the viewer
  obtains it via `useUiStateStore().snapshot`.
- WP-056 complete. `@legendary-arena/preplan` exports types `PrePlan`,
  `PrePlanSandboxState`, `RevealRecord`, `PrePlanStep`, and the
  canonical array `PREPLAN_STATUS_VALUES` with union
  `PrePlanStatusValue = 'active' | 'consumed' | 'invalidated'`.
- WP-057 complete. `@legendary-arena/preplan` exports runtime
  `createPrePlan(playerStateSnapshot, ctx): PrePlan` and speculative
  operations that return `null` when `plan.status !== 'active'`.
- WP-058 complete. `@legendary-arena/preplan` exports runtime
  `executeDisruptionPipeline(plan, mutation): DisruptionPipelineResult`
  and the type `DisruptionNotification { message: string; cause:
  string; targetCard?: CardExtId }`. `DisruptionPipelineResult.notification`
  is always populated; `requiresImmediateNotification: true` is a
  data-level contract.
- WP-061 complete (commit `2e68530`). `apps/arena-client/` has a Pinia
  root, a single store module at `src/stores/uiState.ts`, and a test
  harness that runs `.vue` files via
  `@legendary-arena/vue-sfc-loader/register`.
- WP-062 complete. `<ArenaHud />` and its children demonstrate the
  fixture-driven component-test pattern under
  `apps/arena-client/src/components/hud/`.
- WP-064 complete. `<GameLogPanel />` demonstrates the
  `aria-live="polite"` idiom currently in the codebase; WP-059 adopts
  `aria-live="assertive"` for disruption (see §Non-Negotiable
  Constraints).
- WP-065 complete. `@legendary-arena/vue-sfc-loader` is the test-time
  SFC transform; no other transform is introduced.
- `pnpm --filter @legendary-arena/arena-client typecheck` exits 0 at
  `HEAD`.
- `pnpm --filter @legendary-arena/arena-client test` exits 0 at `HEAD`.
- `pnpm --filter @legendary-arena/preplan build` exits 0 at `HEAD`.
- `pnpm --filter @legendary-arena/preplan test` exits 0 at `HEAD`.
- `docs/ai/ARCHITECTURE.md`, `.claude/rules/architecture.md`,
  `docs/ai/DECISIONS.md`, `docs/ai/STATUS.md`, and
  `docs/ai/work-packets/WORK_INDEX.md` exist.

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` (lines ~180–220)
  — authoritative layer table. Row `apps/arena-client` currently lists
  `preplan` under "must not import"; this WP updates it. Pre-planning
  subsection documents the type-only + read-only rule that preplan
  respects toward the engine; this WP does not weaken that rule.
- `docs/ai/ARCHITECTURE.md §Pre-Planning Layer (Non-Authoritative, Per-Client)`
  — confirms preplan is designed for client-local runtime consumption.
  This is the foundation for the §D-5901 carve-out.
- `docs/ai/DESIGN-PREPLANNING.md §11 "Implementation Work Packets" →
  "Guidance for the Future WP-059 Author"` — the five integration
  concerns (notification delivery timing, invalidated-plan interaction
  gate, regeneration after disruption, turn-start consumption, multiple
  rapid disruptions) plus the plan-existence privacy implicit
  requirement. §Non-Negotiable Constraints maps each concern to a
  concrete packet-specific rule.
- `docs/ai/DESIGN-CONSTRAINTS-PREPLANNING.md` — the twelve derived
  design constraints. Constraint #3 (ledger-sole rewind) and Constraint
  #7 (`requiresImmediateNotification` is data-level) are the two most
  relevant to §Scope (In) §C.
- `docs/ai/DECISIONS.md` — scan for `D-56`, `D-57`, `D-58` entries.
  WP-059 adds one new entry (**D-5901**) carving out the
  `arena-client → preplan` runtime import path. No prior decision is
  overturned.
- `docs/ai/work-packets/WP-028-ui-state-contract-authoritative-view-model.md`
  — `UIState.game.activePlayerId` is the field future client wiring
  will observe for turn-based lifecycle events; WP-059 does **not**
  yet gate `startPrePlanForActiveViewer` on turn state. The adapter
  signature in §C does not accept `UIState`; the caller decides when
  to invoke. "Active viewer" in this packet means "a viewer with a
  valid `UIState` snapshot and derived `PrePlanContext`" — turn
  gating is deferred to the live-middleware follow-up WP.
- `docs/ai/work-packets/WP-056-preplan-state-model.md` — `PrePlan` shape
  and the three status values.
- `docs/ai/work-packets/WP-057-preplan-sandbox-execution.md` §Scope (In)
  §A — `createPrePlan` signature.
- `docs/ai/work-packets/WP-058-preplan-disruption-pipeline.md` §Scope
  (In) §D — `executeDisruptionPipeline` signature and
  `DisruptionPipelineResult` shape.
- `docs/ai/work-packets/WP-061-gameplay-client-bootstrap.md` §Scope (In)
  — `useUiStateStore` pattern and the two-key Options-API convention.
- `docs/ai/work-packets/WP-062-arena-hud-scoreboard.md` §Scope (In) — the
  component layout and test-fixture pattern (one `describe` per file;
  one fixture per scenario).
- `docs/ai/work-packets/WP-064-log-replay-inspector.md` §Scope (In) — the
  `aria-live="polite"` idiom as precedent; WP-059 diverges to
  `aria-live="assertive"` for disruption with rationale in §Non-Negotiable
  Constraints.
- `docs/ai/work-packets/WP-065-vue-sfc-test-transform.md` — the test
  transform registration line that `apps/arena-client/package.json`
  invokes.
- `docs/ai/REFERENCE/00.2-data-requirements.md §8.1` — confirms setup
  payload field names. WP-059 does not touch setup payload shapes, but
  `PrePlan.playerId: string` must match the `playerId` convention used
  in `UIState.players[*].playerId` and `UIState.game.activePlayerId`
  verbatim.
- `docs/ai/REFERENCE/00.1-master-coordination-prompt.md` — non-negotiable
  constraints: no DB queries in client code; all randomness is
  client-local PRNG (not `Math.random`); `// why:` comments on
  non-obvious decisions.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no
  abbreviations), Rule 6 (`// why:` comments), Rule 9 (`node:` prefix
  on Node built-ins in tests), Rule 11 (full-sentence error messages),
  Rule 13 (ESM only).
- `.claude/rules/architecture.md` §Layer Overview and the import-rules
  table — mirrors ARCHITECTURE.md §Layer Boundary. This packet updates
  both files in lockstep.
- `.claude/rules/code-style.md` — no `.reduce()` with branching; boolean
  names start with `is`/`has`/`can`; small functions (<30 lines).
- `apps/arena-client/src/stores/uiState.ts` — the exact Pinia Options-API
  shape (state function + actions object) that `usePreplanStore()` must
  mirror.
- `apps/arena-client/src/fixtures/uiState/index.ts` — the fixture module
  pattern (named exports; JSON files loaded lazily).
- `apps/arena-client/src/components/hud/PlayerPanel.vue` and
  `PlayerPanel.test.ts` — the component + co-located test pattern.
- `packages/preplan/src/index.ts` — the exact public API surface
  available to the client.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- **Human-style code** per `docs/ai/REFERENCE/00.6-code-style.md` (no
  abbreviations; full-word names; JSDoc on every function; `// why:`
  comments on non-obvious code; full-sentence error messages; no
  `import *`; no barrel re-exports; no premature abstraction).
  Junior-developer readability is the bar.
- Never persist `PrePlan`, `DisruptionPipelineResult`, the Pinia store
  state, or any speculative substrate to localStorage, sessionStorage,
  IndexedDB, cookies, or a server endpoint. Client-local per-session
  only.
- `G` and `ctx` are engine concepts and must not appear anywhere under
  `apps/arena-client/src/`. The client calls preplan functions with
  client-side `PlayerStateSnapshot` and a client-side `ctx` stand-in
  only — see §C.
- Never use `Math.random()` anywhere under `apps/arena-client/src/`.
  Client-side speculative RNG, if needed, flows through
  `generateSpeculativeSeed()` / `createSpeculativePrng()` from
  `@legendary-arena/preplan`. (This WP does not actually invoke these;
  speculative draw UI is deferred. The rule still applies.)
- No wall-clock reads (`Date.now()`, `new Date()`, `performance.now()`)
  in any component, store, or adapter. Fixture timestamps are string
  literals.
- `PrePlan`, `DisruptionPipelineResult`, and all store state remain
  JSON-serializable at all times — no class instances, Maps, Sets, or
  functions placed into store state.
- ESM only, Node v22+. `node:` prefix on all Node built-in imports in
  test files (`node:test`, `node:assert`, `node:fs`).
- Test files use `.test.ts` extension — never `.test.mjs`.
- Full file contents for every new or modified file in the output — no
  diffs, no snippets, no "update this section" language.
- **Forbidden dependencies (lint §7):** no `axios`, no `node-fetch`, no
  ORMs, no Jest, no Vitest, no Mocha (tests use `node:test` via the
  WP-061 harness); no `passport`, no `auth0`, no `clerk`. No new npm
  dependencies introduced by this packet outside the one workspace
  promotion (`@legendary-arena/preplan` moves from absent to
  `dependencies`).

**Packet-specific:**
- `usePreplanStore()` uses the Pinia Options API with exactly two
  top-level state keys (`current`, `lastNotification`) and exactly five
  actions (`startPlan`, `consumePlan`, `recordDisruption`,
  `dismissNotification`, `clearPlan`) plus one getter (`isActive`). No
  selectors, no cached computeds, no history array. A future WP may
  add these; this packet freezes the minimal surface.
- `recordDisruption(result: DisruptionPipelineResult)` must:
  1. Set `lastNotification = result.notification` unconditionally.
  2. Only mutate `current` when `current !== null` AND
     `current.status === 'active'` AND
     `result.isValid === false`. In that case, set
     `current = invalidatePrePlan(current, reason)` using the preplan
     export — not by setting `status` directly. (WP-058 owns the
     transition.)
- The lifecycle adapter `applyDisruptionToStore` is the ONLY path that
  writes to `current` after `startPlan`. Components never write
  `current` directly; they never invoke `invalidatePrePlan` directly.
- Every call to `ctx.events.setPhase()` or `ctx.events.endTurn()` — there
  should be zero such calls in this WP because all work is client-side,
  but if one appears it must have a `// why:` comment. Executor must
  grep for these under `apps/arena-client/src/` and confirm zero
  matches.
- `<PrePlanNotification />` uses `aria-live="assertive"` and
  `role="alert"`. **Why this diverges from WP-064's `"polite"`:** a
  disruption means the viewer's planned actions are now invalid;
  screen readers must interrupt the current utterance so the viewer
  does not continue reading a plan that no longer applies. Cite
  **D-5901** in the component's JSDoc header.
- `<PrePlanStepList />` renders steps in the order they appear in
  `current.planSteps`. No sorting, filtering, or de-duplication. If
  `current === null`, render an empty-state paragraph with the literal
  string `"No plan is active."`.
- Plan existence is never broadcast. No store state is sent to the
  server. No opponent-visible indicator (loading dot, "thinking" badge,
  etc.) is created by this WP. Plan privacy is an invariant.
- The store must not expose the raw `PlayerStateSnapshot` used to build
  the plan. `createPrePlan` consumes the snapshot and returns `PrePlan`;
  the snapshot itself is never stored.
- No `.reduce()` anywhere. Step iteration uses `for...of` with
  descriptive variable names.
- No TypeScript `any` in production code. Test fixtures may use
  `satisfies` + concrete literal types.
- `@legendary-arena/preplan` is imported via named imports only — never
  `import * as preplan`.
- **Prose-vs-grep discipline (lint §18):** JSDoc and block comments in
  files introduced by this WP must not enumerate forbidden tokens
  (`boardgame.io`, `Math.random`, `Date.now`, `performance.now`,
  `new Date(`, `localStorage`, `sessionStorage`, `document.cookie`)
  verbatim. When prose needs to document a prohibition, cite the
  governing source (e.g., `"see ARCHITECTURE.md §Pre-Planning Layer"`,
  `"see D-5901"`, or `"see D-3701 for the full forbidden-token list"`)
  rather than restating the token string. Verification Steps 4, 5, 6,
  7, and 8 all use literal-string-scoped greps under
  `apps/arena-client/src/**`; verbatim token prose inside new files
  would cause false-positive matches.

**Session protocol:**
- If `@legendary-arena/preplan` package exports have drifted from what
  §Assumes lists (verify at pre-flight by reading
  `packages/preplan/src/index.ts` and running
  `pnpm --filter @legendary-arena/preplan build`), stop and update the
  packet before proceeding.
- If the ARCHITECTURE.md §Layer Boundary table row for
  `apps/arena-client` has been modified between now and execution to
  already permit `preplan`, D-5901 becomes redundant; record that the
  carve-out was pre-landed and skip the ARCHITECTURE.md /
  `.claude/rules/architecture.md` edits, but still write D-5901 to
  DECISIONS.md as the closed-loop record of WP-059's intended change.
- If a reviewer objects to a separate `usePreplanStore` and requests
  `UIState` extension instead, stop — the engine is non-authoritative
  over preplan by design and the separation is architectural. Open a
  DECISIONS.md discussion before proceeding.
- If `UIState.game.activePlayerId` is the wrong field (check against
  `packages/game-engine/src/ui/uiState.types.ts` at pre-flight —
  current code has this exact field), stop and revise §C.

**Locked contract values:**
- `usePreplanStore` state keys (exact strings): `current`,
  `lastNotification`
- `usePreplanStore` action names (exact strings): `startPlan`,
  `consumePlan`, `recordDisruption`, `dismissNotification`, `clearPlan`
- `usePreplanStore` getter name (exact string): `isActive`
- `PREPLAN_STATUS_VALUES` members (exact strings, from WP-057):
  `'active'`, `'consumed'`, `'invalidated'`
- `<PrePlanNotification />` accessibility attributes:
  `role="alert"`, `aria-live="assertive"`
- Component file locations (exact paths):
  `apps/arena-client/src/components/preplan/PrePlanNotification.vue`,
  `apps/arena-client/src/components/preplan/PrePlanStepList.vue`
- Empty-state literal string (exact): `"No plan is active."`
- New DECISIONS.md entry id: **D-5901**
  (title: "apps/arena-client runtime imports of
  `@legendary-arena/preplan` are permitted")

---

## Debuggability & Diagnostics

- **Determinism:** `startPrePlanForActiveViewer(args)` is pure (signature
  per §C: `args: { snapshot; ctx; store }`). Given identical `snapshot`
  and `ctx`, it produces identical `PrePlan` written into the store.
  `applyDisruptionToStore(args)` (signature: `args: { store; result }`)
  is pure given the store reference and input — it reads `current.status`
  and writes exactly `current` and/or `lastNotification` based on the
  two rules in §Non-Negotiable Constraints. Two tests assert these
  determinism properties explicitly.
- **No hidden state:** the Pinia store holds only the two documented
  keys. No module-level caches, no memoized selectors, no derived-state
  Maps. `isActive` is a pure getter derived from `current`.
- **Externally observable:** every store mutation is reachable through
  one of the five actions. Tests assert that each action produces the
  documented state transition and that no other key is mutated.
- **Type-level drift detection:** a drift test imports
  `PrePlanStatusValue` from `@legendary-arena/preplan` and asserts a
  literal fixture `satisfies { [S in PrePlanStatusValue]: number }`
  has exactly three keys. A renamed or added status value breaks
  typecheck before runtime logic has to catch it.
- **Replay inspection:** the store is a single snapshot of the current
  plan. A follow-up WP may add step-level history; today the current
  plan plus the last notification are sufficient to reconstruct the
  viewer's current advisory context.
- **Plan-existence privacy — externally observable:** a test asserts
  that the preplan store has no `subscribe` listener registered that
  sends state to any network or external target. (Pinia supports
  `store.$subscribe`; this WP does not register any subscription.)

---

## Scope (In)

### A) `apps/arena-client/src/stores/preplan.ts` — **new**

- Pinia Options-API store registered under id `'preplan'`.
- State type alias `PreplanStoreState { current: PrePlan | null;
  lastNotification: DisruptionNotification | null }`.
- Module-level JSDoc header must include the following two
  invariant blocks verbatim (modulo prose-vs-grep guard — cite D-5901
  rather than restating any forbidden token):

  ```
  /**
   * Pinia store for client-local pre-planning state.
   *
   * Write invariants (relied on by future middleware, e.g., the
   * disruption detector WP-090 will add):
   *   - `current` is written ONLY by `startPlan`, `consumePlan`,
   *     `recordDisruption`, and `clearPlan`.
   *   - `lastNotification` is written ONLY by `recordDisruption`,
   *     `dismissNotification`, and `clearPlan`.
   *   - External callers route disruption events through
   *     `applyDisruptionToStore` in `preplanLifecycle.ts`, never by
   *     calling `recordDisruption` directly from component code.
   *   - Components never mutate the store; they read through
   *     `storeToRefs` and invoke actions.
   *
   * Notification-overwrite invariant:
   *   - `lastNotification` retains only the most recent disruption.
   *     Earlier notifications are intentionally dropped; disruption
   *     invalidates the viewer's advisory state, so a queue would
   *     present stale causal context. A future WP adds an aria-live
   *     log surface if audit is needed — not a queue.
   */
  ```

- Actions:
  - `startPlan(plan: PrePlan): void` — sets `current = plan`. Does not
    touch `lastNotification`. Throws a full-sentence `Error` with
    message `"Cannot start a plan while another plan is active; call
    clearPlan or consumePlan first."` if `current !== null` AND
    `current.status === 'active'`.
  - `consumePlan(): void` — when `current !== null` AND
    `current.status === 'active'`, sets `current` to a new `PrePlan`
    object with `status: 'consumed'` and the same other fields. When
    `current` is `null` or already `'consumed'` / `'invalidated'`,
    do nothing. Required `// why:` comment (verbatim):

    ```
    // why: there is no preplan-package helper for the 'consumed'
    // transition — the transition is client-observed and
    // non-authoritative, so we construct a new PrePlan object
    // explicitly. Construction (vs. in-place mutation) preserves
    // JSON serializability and avoids aliasing shared references
    // that may have been captured by components via storeToRefs.
    // The action is idempotent: calling it on a null, already-
    // consumed, or already-invalidated plan is a no-op.
    ```
  - `recordDisruption(result: DisruptionPipelineResult): void` — sets
    `lastNotification = result.notification` unconditionally
    (overwriting — see the notification-overwrite invariant in the
    module header); when `current !== null` AND
    `current.status === 'active'` AND `result.isValid === false`,
    replaces `current` with `invalidatePrePlan(current, reason)`
    (importing `invalidatePrePlan` from `@legendary-arena/preplan`).
    `reason` is constructed inline from `result.notification.cause`
    as a plain string — structured restoration data
    (`result.restoration`) is intentionally ignored at this layer
    (restoration application is out of scope per §Out of Scope;
    future middleware owns it). No-op on `current` when it is
    already non-active; `lastNotification` is still set so the UI
    can display causal context.
  - `dismissNotification(): void` — sets `lastNotification = null`.
    Does not touch `current`.
  - `clearPlan(): void` — sets `current = null` and
    `lastNotification = null`.
- Getter `isActive(): boolean` — `current !== null && current.status
  === 'active'`.
- JSDoc on the store, every action, and the getter.
- `// why:` comment on the Options-vs-Setup API decision citing
  WP-061's precedent.
- `// why:` comment on `startPlan`'s throw citing the "one active plan
  at a time" invariant from WP-056 / DESIGN-PREPLANNING §11.

### B) `apps/arena-client/src/stores/preplan.test.ts` — **new**

`node:test` tests (one top-level `describe('usePreplanStore', …)`):
1. Initial state has `current === null` and `lastNotification === null`.
2. `startPlan(fixturePlan)` sets `current === fixturePlan`.
3. `startPlan` throws when called a second time with an active plan
   already present; error message contains the literal substring
   `"Cannot start a plan while another plan is active"`.
4. `consumePlan()` on an active plan sets `current.status === 'consumed'`
   and preserves every other `PrePlan` field (deep-equal check of
   `planSteps`, `sandboxState`, `revealLedger`, `playerId`,
   `baseStateFingerprint`, `createdAtTurn`, `revision`).
5. `consumePlan()` when `current === null` is a no-op.
6. `consumePlan()` on an already-`'invalidated'` plan is a no-op.
7. `recordDisruption(fixtureInvalidResult)` sets `lastNotification`
   to the fixture's notification.
8. `recordDisruption(fixtureInvalidResult)` on an active plan sets
   `current.status === 'invalidated'`.
9. `recordDisruption` on an already-`'invalidated'` plan still updates
   `lastNotification` but leaves `current.status === 'invalidated'`.
10. `dismissNotification()` sets `lastNotification === null` and does
    not touch `current`.
11. `clearPlan()` sets both `current === null` and
    `lastNotification === null`.
12. `isActive` is `false` when `current === null`, `false` when
    `current.status === 'consumed'`, `false` when `current.status ===
    'invalidated'`, and `true` only when `current.status === 'active'`.
13. Determinism: calling `startPlan` with the same fixture twice (after
    `clearPlan` in between) produces byte-equal store state (via
    `JSON.stringify(store.$state)`).

Test file is wrapped in one `describe` block. Uses `node:test`,
`node:assert`, `createPinia`, and the preplan fixtures from §F. Does
not import from `boardgame.io`.

### C) `apps/arena-client/src/preplan/preplanLifecycle.ts` — **new**

Two pure adapter functions:

- `startPrePlanForActiveViewer(args: { snapshot: PlayerStateSnapshot;
  ctx: PrePlanContext; store: ReturnType<typeof usePreplanStore> }):
  void`
  - Calls `createPrePlan(snapshot, ctx)` from
    `@legendary-arena/preplan`.
  - Calls `store.startPlan(plan)` with the result.
  - No return value; errors propagate from `createPrePlan` or
    `startPlan`.
  - JSDoc documents each parameter, the side effect, and the fact that
    the function does not read the engine's `G` or `ctx` objects; the
    `PrePlanContext` is a minimal client-side stand-in defined in
    §C.1 below.
- `applyDisruptionToStore(args: { store: ReturnType<typeof
  usePreplanStore>; result: DisruptionPipelineResult }): void`
  - Calls `store.recordDisruption(result)`. Nothing else.
  - Required `// why:` comment (verbatim):

    ```
    // why: this adapter is the single named integration seam
    // between mutation detection (future middleware) and the
    // preplan store. The body is intentionally trivial — the
    // value is the name, not the behavior. Keeping it thin
    // preserves testability and freezes the call surface before
    // WP-090 lands so middleware can be written against a stable
    // function identifier. See DESIGN-PREPLANNING §11
    // "Notification delivery timing".
    ```

#### C.1) `PrePlanContext` type alias

Define and export inside the same file:

```
/**
 * Client-local stand-in for the narrow subset of engine `ctx` that
 * `createPrePlan` reads. The field names mirror the engine's ctx
 * shape that WP-057 consumes, but the values are supplied by the
 * client from UIState-observable data.
 */
export type PrePlanContext = {
  readonly turn: number;
  readonly playerId: string;
};
```

Pre-flight must verify the exact shape `createPrePlan` requires by
reading `packages/preplan/src/preplanSandbox.ts`. If it requires more
than `{ turn, playerId }`, extend `PrePlanContext` to match — but do
NOT widen it to include `G`, zones, or RNG state. If the required
shape is strictly smaller, narrow `PrePlanContext` accordingly. Update
the WP body + `MatchSetupConfig` — no wait, `MatchSetupConfig` is
unrelated — update only `PrePlanContext` and the test fixtures.

### D) `apps/arena-client/src/preplan/preplanLifecycle.test.ts` — **new**

Compile-time drift sentinel at the top of the file, above the
`describe` block:

```
// why: compile-time drift sentinel. If `createPrePlan`'s second
// parameter shape drifts (WP-057 adds or renames a required field),
// this assignment fails typecheck before any runtime test has to
// catch it. Zero runtime cost — the variable is type-only.
const _assertPrePlanContextShape: Parameters<typeof createPrePlan>[1] =
  {} as PrePlanContext;
void _assertPrePlanContextShape;
```

Then `node:test` tests (one top-level `describe`):
1. `startPrePlanForActiveViewer` with a fixture snapshot + fixture ctx
   + fresh store produces a store whose `current !== null` and
   `current.status === 'active'`.
2. `startPrePlanForActiveViewer` called twice in a row (same store)
   throws on the second call — the error from `usePreplanStore.startPlan`
   propagates.
3. `applyDisruptionToStore` with a fresh store (no current plan) +
   a fixture invalid-result updates `store.lastNotification` and
   leaves `store.current === null`.
4. `applyDisruptionToStore` with an active plan + invalid result
   transitions `store.current.status` to `'invalidated'` and sets
   `store.lastNotification` to the fixture's notification.
5. Determinism: two runs of `startPrePlanForActiveViewer` against the
   same snapshot + ctx + fresh store produce byte-equal `store.$state`
   (via `JSON.stringify`). This validates `createPrePlan`'s purity
   downstream of the adapter.
6. Privacy: after `startPrePlanForActiveViewer`, the store's
   `$state.current.sandboxState` exists but is never broadcast —
   checked by asserting `store.$subscribe` has not been called (no
   listener registered). The adapter must not wire any subscription.
7. Notification overwrite: calling `applyDisruptionToStore` twice in a
   row with two distinct invalid-result fixtures leaves
   `store.lastNotification` equal to the **second** fixture's
   notification; the first is dropped, not queued. This test locks
   the notification-overwrite invariant from the store JSDoc header.

### E) `apps/arena-client/src/components/preplan/PrePlanNotification.vue` — **new**

- Vue 3 Composition API single-file component.
- `<script setup lang="ts">` reads `usePreplanStore()` and a
  `storeToRefs` of `lastNotification`.
- Template:
  - When `lastNotification === null`: renders nothing (empty
    `<template>`).
  - Otherwise: renders a `<div role="alert" aria-live="assertive"
    class="preplan-notification">` containing:
    - `<p class="preplan-notification__message">{{
      lastNotification.message }}</p>`
    - `<p class="preplan-notification__cause">{{
      lastNotification.cause }}</p>`
    - When `lastNotification.targetCard` is present: `<p
      class="preplan-notification__card">{{ lastNotification.targetCard
      }}</p>`. Rendering the raw `CardExtId` string is sufficient for
      MVP; a future WP (registry-client access) may replace it with a
      display-name lookup.
    - `<button type="button" class="preplan-notification__dismiss"
      @click="dismiss">Dismiss</button>`
  - `dismiss` calls `store.dismissNotification()`.
- `<style scoped>` defines the four class selectors. Colors match
  `apps/arena-client/src/components/hud/hudColors.ts` tokens if any
  apply; otherwise literal hex values are used and a `// why:` comment
  flags that hudColors does not cover alert surfaces.
- JSDoc-equivalent `<!-- @fileoverview -->` block explains the
  component's role and cites D-5901 for the `aria-live="assertive"`
  divergence from WP-064.

### F) `apps/arena-client/src/components/preplan/PrePlanNotification.test.ts` — **new**

`node:test` tests using `@vue/test-utils` `mount` (already a dev dep
per WP-061):
1. When `lastNotification === null`, the mounted component renders no
   `role="alert"` element.
2. When `lastNotification` is a fixture with `message`, `cause`, and
   no `targetCard`, the component renders the `message`, the `cause`,
   and no `.preplan-notification__card` element.
3. When `lastNotification.targetCard` is present, the component
   renders the `.preplan-notification__card` element with the literal
   `CardExtId` string.
4. Clicking the dismiss button calls `store.dismissNotification` and
   `lastNotification` becomes `null`; the component re-renders to
   empty.
5. The root alert element has `role="alert"` and
   `aria-live="assertive"`.

### G) `apps/arena-client/src/components/preplan/PrePlanStepList.vue` — **new**

- Vue 3 Composition API SFC.
- `<script setup lang="ts">` reads `useUiStateStore()` and
  `usePreplanStore()` and derives two refs via `storeToRefs`:
  `current` from preplan, `snapshot` from uiState (snapshot is
  optional, used only for the header `"Plan for player <id>"`).
- Required `// why:` comment at the top of the `<script setup>` block
  (verbatim):

  ```
  // why: components must never mutate plan state directly. All
  // transitions route through the preplan store's actions, and
  // disruption events specifically route through
  // applyDisruptionToStore in preplanLifecycle.ts. Reads are
  // through storeToRefs so reactivity is preserved without exposing
  // a mutation handle.
  ```
- Template:
  - When `current === null`: renders `<p
    class="preplan-step-list__empty">No plan is active.</p>`.
  - Otherwise: renders a `<section class="preplan-step-list">`
    containing:
    - `<h3 class="preplan-step-list__header">Plan for player {{
      current.playerId }}</h3>`
    - `<ol class="preplan-step-list__steps">` with one `<li>` per
      `current.planSteps` entry, keyed by step index. Each `<li>`
      renders `{{ step.intent }}: {{ step.description }}`.
    - When `current.status === 'consumed'` or `'invalidated'`: a
      `<p class="preplan-step-list__status">Plan {{ current.status
      }}.</p>` paragraph.
- `<style scoped>` defines the four class selectors.
- No sorting, filtering, or transformation of `planSteps`.

### H) `apps/arena-client/src/components/preplan/PrePlanStepList.test.ts` — **new**

`node:test` tests:
1. Empty state: `current === null` renders the literal
   `"No plan is active."`.
2. Active plan with two steps renders an `<ol>` with exactly two
   `<li>` elements, in order, each containing the step's `intent`
   and `description`.
3. Active plan renders **no** `.preplan-step-list__status` element
   (explicit negative assertion — the status-paragraph is visible
   only in the two terminal states).
4. Consumed plan renders the status-paragraph with text containing
   the substring `"consumed"`.
5. Invalidated plan renders the status-paragraph with text containing
   the substring `"invalidated"`.
6. `planSteps` order is preserved — a three-step fixture with
   intentionally reversed-alphabet descriptions is rendered in
   insertion order, not alphabetical.

### I) `apps/arena-client/src/fixtures/preplan/index.ts` — **new**

Exports four named fixtures:
- `activePrePlanFixture: PrePlan` — two plan steps, one speculative
  draw reveal recorded in `revealLedger`, status `'active'`,
  `revision: 1`, `createdAtTurn: 3`, `playerId: 'player-0'`.
- `consumedPrePlanFixture: PrePlan` — same as active but status
  `'consumed'`.
- `invalidatedPrePlanFixture: PrePlan` — same as active but status
  `'invalidated'`.
- `sampleDisruptionResultFixture: DisruptionPipelineResult` — with
  `isValid: false`, `requiresImmediateNotification: true`, a
  `DisruptionNotification` containing a non-empty `message`, `cause`,
  and a `targetCard: CardExtId` value (literal `'hero:IRONMAN_01'` or
  whatever format the registry tests use). `restoration` is an empty
  array (acceptable per WP-058's contract).
- `samplePlayerStateSnapshotFixture: PlayerStateSnapshot` and
  `samplePrePlanContextFixture: PrePlanContext` — supporting fixtures
  for the lifecycle tests.

All fixture values are string and number literals; no imports of
runtime functions, no invocation of `createPrePlan`. Every fixture
satisfies its type via a `satisfies` clause.

### J) `apps/arena-client/src/fixtures/preplan/index.test.ts` — **new**

Single drift-detection test:
- `PREPLAN_STATUS_VALUES` (imported from `@legendary-arena/preplan`)
  has exactly three members: `'active'`, `'consumed'`, `'invalidated'`,
  in that order. A literal fixture `{ active: 1, consumed: 1,
  invalidated: 1 } satisfies { [K in PrePlanStatusValue]: number }`
  is asserted to have exactly three keys (via `Object.keys(...).length
  === 3`). This test fails typecheck or runtime if WP-056/057's
  status surface drifts.
- `// why:` comment: failure here means a status value was added to
  the union without updating the canonical array, or vice versa, and
  a corresponding UI surface likely also needs updates.

### K) `apps/arena-client/package.json` — **modified**

- Add `@legendary-arena/preplan: "workspace:*"` to `dependencies`
  (promotion from absent; runtime imports are required for
  `createPrePlan` and `invalidatePrePlan` to be bundled). The
  `DisruptionPipelineResult` type consumed by the adapter is
  type-only; `executeDisruptionPipeline` is not invoked by any
  WP-059 file, but shares the same package entry point that the
  future live-mutation middleware will consume.
- `@legendary-arena/game-engine` stays in `devDependencies`
  unchanged — all engine imports in this WP are type-only.
- No other fields change. `scripts.test` command is unchanged.

### L) `docs/ai/ARCHITECTURE.md` — **modified**

In the Layer Boundary table, update the `apps/arena-client (WP-061+)`
row:
- **Current "Must NOT import"** column contains: `game-engine
  (runtime), registry (runtime), preplan, server, pg, vue-sfc-loader
  at runtime`
- **New "Must NOT import"** column: `game-engine (runtime), registry
  (runtime), server, pg, vue-sfc-loader at runtime` — remove
  `preplan` from the list.
- **New "May import"** column additionally lists: `@legendary-arena/preplan
  (runtime — per D-5901)`.
- No other row is modified.
- Add a one-paragraph note immediately below the table that cross-
  references D-5901: *"As of WP-059 (D-5901), `apps/arena-client` may
  runtime-import `@legendary-arena/preplan`. This exception is
  confined to the arena client; no other app or package may
  runtime-import preplan. The preplan package itself remains
  non-authoritative and read-only toward the engine."*

### M) `.claude/rules/architecture.md` — **modified**

In the Import Rules table (Layer Overview section), perform the same
two-column edit as §L on the `apps/arena-client` row. The table in
this file is derived from ARCHITECTURE.md and must match.

### N) `docs/ai/DECISIONS.md` — **modified**

Add a new entry **D-5901** (use the next available 59xx slot — verify
at pre-flight that 5901 is unused; if taken, use the next free 59xx
slot and update every reference above):

```
## D-5901 — apps/arena-client runtime imports of @legendary-arena/preplan are permitted

**Context:** WP-059 wires pre-planning state into the arena client.
Runtime functions (`createPrePlan`, `invalidatePrePlan`,
`executeDisruptionPipeline`) must be callable from the client for
the integration to exist. The prior layer table forbade it, dating
from when WP-059 was deferred.

**Decision:** `apps/arena-client` may runtime-import
`@legendary-arena/preplan`. No other package or app gains this
right. The preplan package's non-authoritative, read-only-toward-
engine nature is unchanged.

**Why a separate package rather than folding preplan into the
client:** preplan ships types and pure logic that are testable
without a DOM or a framework. Keeping it as a package preserves that
testability and leaves the door open for a second client (spectator,
mobile, CLI) to consume the same surface.

**Why not extend UIState:** UIState is the authoritative engine
projection. PrePlan is client-side advisory. Mixing them would
violate the Layer Boundary; a separate Pinia store is the clean
split.
```

### O) `docs/ai/STATUS.md` — **modified**

Append a paragraph under a dated heading describing: a second Pinia
store now holds client-local pre-plan state; the arena client can
display disruption notifications and passive plan-step references
against fixtures; live boardgame.io mutation-detection middleware
remains a follow-up once WP-090 lands.

### P) `docs/ai/work-packets/WORK_INDEX.md` — **modified**

- Replace the deferred-block paragraph at current line ~1633 (read the
  current file at pre-flight to get the exact line) with a proper
  WP-059 entry immediately after WP-058, following the established
  format of surrounding entries (one leading bullet with `[ ]`, a
  `Dependencies:` line, a `Notes:` block, a `Session Context:` link if
  applicable, and a blank line).
- Update the Pre-Planning chain diagram near the bottom of
  WORK_INDEX.md to replace `WP-059 (deferred — needs WP-028 + UI
  framework decision)` with `WP-059 → (future WP: live-mutation
  middleware)`.
- Execution-status transitions (flipping `[ ]` → `[x]`, recording the
  date and SHA, etc.) are owned by the associated EC, not by this
  WP — see `EC-059-preplan-ui-integration.checklist.md` §After
  Completing.

---

## Out of Scope

- **Speculative draw / play / recruit UI gestures.** These require
  per-player private projections of deck, hand, HQ, and shared piles
  that `UIState` does not currently expose (zones are count-only with
  the single `handCards?` exception). A follow-up WP must introduce a
  private-projection contract before speculative gestures can be wired.
- **Live boardgame.io client middleware that detects real G mutations
  and invokes `executeDisruptionPipeline`.** Depends on the live-match
  transport from WP-090 / WP-091; out of scope here.
- **Plan regeneration after disruption (auto-flow).** The store
  supports `clearPlan` + a new `startPlan`, but the UI flow that
  prompts the viewer to replan after dismissing a notification is a
  follow-up concern (ties into gesture UI).
- **Turn-start auto-consumption.** When the viewer's turn begins, the
  store supports `consumePlan()`, but the watcher that calls it in
  response to `UIState.game.activePlayerId` change is deferred —
  it depends on the same live-snapshot-push as disruption detection.
- **Multi-turn planning** and **plan history**. Out of scope per
  DESIGN-PREPLANNING §13.
- **Plan replay / export / spectatorship.** Out of scope per
  DESIGN-PREPLANNING §13 and Vision NG-1..7 proximity check.
- **Registry-backed card-name display in the notification.** Target
  cards render as raw `CardExtId` strings for MVP. A registry-client
  access WP will replace the raw string with a display name.
- **Persisting plan state across a reload.** Plans are ephemeral and
  tied to the current session. No localStorage, no server storage.
- **Server-side gating or broadcast suppression.** Plan privacy is
  enforced by the absence of a broadcast surface, not by server
  policy. The server never sees plan state, so there is nothing to
  suppress.
- **Changes to `UIState`, `buildUIState`, or any engine code under
  `packages/game-engine/**`.** This packet touches the client + preplan
  consumer only.
- **Changes to `packages/preplan/**`.** This packet consumes the
  package; it does not modify it.
- **Refactors, cleanups, or "while I'm here" improvements** to
  WP-061/062/064 components, stores, or fixtures unless listed in
  §Scope (In).

---

## Files Expected to Change

- `apps/arena-client/src/stores/preplan.ts` — **new** — Pinia store
- `apps/arena-client/src/stores/preplan.test.ts` — **new** — store
  unit tests (13 cases in one `describe`)
- `apps/arena-client/src/preplan/preplanLifecycle.ts` — **new** —
  two pure adapters + `PrePlanContext` type
- `apps/arena-client/src/preplan/preplanLifecycle.test.ts` — **new** —
  adapter tests (7 cases) plus one compile-time drift sentinel at
  file top
- `apps/arena-client/src/components/preplan/PrePlanNotification.vue`
  — **new** — disruption banner SFC (`role="alert"`,
  `aria-live="assertive"`)
- `apps/arena-client/src/components/preplan/PrePlanNotification.test.ts`
  — **new** — component tests (5 cases)
- `apps/arena-client/src/components/preplan/PrePlanStepList.vue` —
  **new** — passive plan-step reference SFC
- `apps/arena-client/src/components/preplan/PrePlanStepList.test.ts`
  — **new** — component tests (6 cases)
- `apps/arena-client/src/fixtures/preplan/index.ts` — **new** — 6
  named fixtures
- `apps/arena-client/src/fixtures/preplan/index.test.ts` — **new** —
  drift-detection test for `PREPLAN_STATUS_VALUES`
- `apps/arena-client/package.json` — **modified** — promote
  `@legendary-arena/preplan` to `dependencies`
- `docs/ai/ARCHITECTURE.md` — **modified** — update Layer Boundary
  row for `apps/arena-client`; add D-5901 cross-reference paragraph
- `.claude/rules/architecture.md` — **modified** — mirror the
  ARCHITECTURE.md edit
- `docs/ai/DECISIONS.md` — **modified** — add D-5901 entry
- `docs/ai/STATUS.md` — **modified** — governance update
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — replace
  deferred-block with real WP-059 entry and update the Pre-Planning
  chain diagram

No other files may be modified.
`packages/game-engine/**`, `packages/registry/**`, `packages/preplan/**`,
`packages/vue-sfc-loader/**`, `apps/server/**`, and
`apps/registry-viewer/**` must be untouched.

---

## Acceptance Criteria

### Store
- [ ] `apps/arena-client/src/stores/preplan.ts` exports
      `usePreplanStore` as the only named export
- [ ] The store registers under Pinia id `'preplan'` (exact string)
- [ ] Store state has exactly two keys: `current`, `lastNotification`
      (confirmed via `Object.keys(store.$state).length === 2` in a test)
- [ ] Five actions exist with exact names: `startPlan`, `consumePlan`,
      `recordDisruption`, `dismissNotification`, `clearPlan`
- [ ] Getter `isActive` exists and returns `boolean`
- [ ] `startPlan` throws a full-sentence error when called on an
      already-active plan; message contains the substring `"Cannot
      start a plan while another plan is active"`
- [ ] `recordDisruption` on an active plan transitions
      `current.status` to `'invalidated'` via `invalidatePrePlan`
- [ ] No import of `boardgame.io` in the store file (confirmed via
      `Select-String`)
- [ ] No `Math.random`, `Date.now`, `performance.now`, or `new Date(`
      in the store file (confirmed via `Select-String`)

### Lifecycle adapter
- [ ] `preplanLifecycle.ts` exports exactly two runtime named exports
      (`startPrePlanForActiveViewer`, `applyDisruptionToStore`) and one
      type export (`PrePlanContext`)
- [ ] `startPrePlanForActiveViewer` invokes `createPrePlan` and
      `store.startPlan` exactly once each per call (verified by test
      counters)
- [ ] `applyDisruptionToStore` invokes `store.recordDisruption` and
      nothing else (verified by store-state assertions)
- [ ] No `store.$subscribe` listener is registered anywhere under
      `apps/arena-client/src/preplan/` (confirmed via
      `Select-String` for `\$subscribe`)

### Components
- [ ] `PrePlanNotification.vue` renders nothing when
      `lastNotification === null`
- [ ] `PrePlanNotification.vue` root element has
      `role="alert"` and `aria-live="assertive"` (exact strings)
- [ ] `PrePlanNotification.vue` dismiss button calls
      `store.dismissNotification`
- [ ] `PrePlanStepList.vue` renders exactly the literal `"No plan is
      active."` when `current === null`
- [ ] `PrePlanStepList.vue` renders one `<li>` per step, in order,
      for an active plan
- [ ] `PrePlanStepList.vue` shows the status paragraph only when
      `current.status` is `'consumed'` or `'invalidated'`

### Fixtures & drift
- [ ] Fixture module exports six named fixtures (see §I)
- [ ] Every fixture uses `satisfies` against its preplan type
- [ ] `PREPLAN_STATUS_VALUES` drift test passes and fails deterministically
      if the canonical array drifts

### Layer boundary & governance
- [ ] `apps/arena-client/package.json` lists
      `@legendary-arena/preplan: "workspace:*"` under `dependencies`
- [ ] `docs/ai/ARCHITECTURE.md` Layer Boundary row for
      `apps/arena-client` no longer lists `preplan` in "Must NOT
      import"; lists it in "May import" with the `(runtime — per
      D-5901)` annotation
- [ ] `.claude/rules/architecture.md` mirrors the ARCHITECTURE.md edit
      verbatim
- [ ] `docs/ai/DECISIONS.md` contains entry D-5901 with the exact
      title from §Locked contract values
- [ ] `docs/ai/work-packets/WORK_INDEX.md` no longer contains the
      literal string `"WP-059 (Pre-Plan UI Integration) is deferred"`

### Purity, determinism, privacy
- [ ] No `Math.random`, `Date.now`, `performance.now`, or `new Date(`
      anywhere under `apps/arena-client/src/stores/preplan.ts`,
      `apps/arena-client/src/preplan/**`, or
      `apps/arena-client/src/components/preplan/**`
- [ ] No `.reduce(` anywhere under
      `apps/arena-client/src/stores/preplan.ts`,
      `apps/arena-client/src/preplan/**`, or
      `apps/arena-client/src/components/preplan/**`
- [ ] No import of `boardgame.io` under any file introduced by this
      WP
- [ ] No import from `@legendary-arena/game-engine` at runtime in the
      preplan store or components — only `import type` (confirmed via
      `Select-String`)
- [ ] No network call, localStorage access, or cookie access in any
      file introduced by this WP (confirmed via `Select-String` for
      `localStorage`, `sessionStorage`, `document.cookie`, `fetch(`,
      `XMLHttpRequest`)
- [ ] `store.$subscribe` is not called anywhere in new code
      (confirmed via `Select-String`)

### Tests
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0
- [ ] New test files contribute at minimum: 13 store tests, 7
      lifecycle tests, 5 notification tests, 6 step-list tests, 1
      drift test (**32 new tests total**), plus one compile-time
      drift sentinel in `preplanLifecycle.test.ts` that has no
      runtime assertion
- [ ] `pnpm -r test` exits 0 (no regressions elsewhere)

### Scope enforcement
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `packages/game-engine/**`, `packages/registry/**`,
      `packages/preplan/**`, `packages/vue-sfc-loader/**`,
      `apps/server/**`, and `apps/registry-viewer/**` are untouched

---

## Verification Steps

```pwsh
# Step 1 — typecheck the arena client after changes
pnpm --filter @legendary-arena/arena-client typecheck
# Expected: exits 0, no TypeScript errors

# Step 2 — run arena-client tests
pnpm --filter @legendary-arena/arena-client test
# Expected: all tests pass; count includes at least 32 new tests
# introduced by this packet (13 store + 7 lifecycle + 5 notification
# + 6 step-list + 1 drift = 32; one compile-time drift sentinel in
# preplanLifecycle.test.ts has no runtime assertion and is not counted)

# Step 3 — run the full repo test suite (regression check)
pnpm -r test
# Expected: no regressions in game-engine, registry, preplan,
# vue-sfc-loader, server, or registry-viewer

# Step 4 — confirm no boardgame.io import anywhere in the new files
Select-String -Path "apps\arena-client\src\stores\preplan.ts" -Pattern "boardgame\.io"
Select-String -Path "apps\arena-client\src\preplan" -Pattern "boardgame\.io" -Recurse
Select-String -Path "apps\arena-client\src\components\preplan" -Pattern "boardgame\.io" -Recurse
# Expected: no output from any of the three commands

# Step 5 — confirm no runtime import of game-engine in preplan store,
# adapter, or components (only `import type` is allowed)
Select-String -Path "apps\arena-client\src\stores\preplan.ts" -Pattern "^import\s+\{" | Select-String -Pattern "@legendary-arena/game-engine"
Select-String -Path "apps\arena-client\src\preplan" -Pattern "^import\s+\{" -Recurse | Select-String -Pattern "@legendary-arena/game-engine"
Select-String -Path "apps\arena-client\src\components\preplan" -Pattern "^import\s+\{" -Recurse | Select-String -Pattern "@legendary-arena/game-engine"
# Expected: no output — only `import type { ... } from
# '@legendary-arena/game-engine'` is permitted

# Step 6 — confirm no wall-clock reads or randomness in new code
Select-String -Path "apps\arena-client\src\stores\preplan.ts" -Pattern "Math\.random|Date\.now|performance\.now|new Date\("
Select-String -Path "apps\arena-client\src\preplan" -Pattern "Math\.random|Date\.now|performance\.now|new Date\(" -Recurse
Select-String -Path "apps\arena-client\src\components\preplan" -Pattern "Math\.random|Date\.now|performance\.now|new Date\(" -Recurse
# Expected: no output from any of the three commands

# Step 7 — confirm no .reduce() in new code (00.6 Rule 8)
Select-String -Path "apps\arena-client\src\stores\preplan.ts" -Pattern "\.reduce\("
Select-String -Path "apps\arena-client\src\preplan" -Pattern "\.reduce\(" -Recurse
Select-String -Path "apps\arena-client\src\components\preplan" -Pattern "\.reduce\(" -Recurse
# Expected: no output from any of the three commands

# Step 8 — confirm no persistence API usage in new code
Select-String -Path "apps\arena-client\src\stores\preplan.ts" -Pattern "localStorage|sessionStorage|document\.cookie"
Select-String -Path "apps\arena-client\src\preplan" -Pattern "localStorage|sessionStorage|document\.cookie" -Recurse
Select-String -Path "apps\arena-client\src\components\preplan" -Pattern "localStorage|sessionStorage|document\.cookie" -Recurse
# Expected: no output from any of the three commands

# Step 9 — confirm no `$subscribe` listener registered
Select-String -Path "apps\arena-client\src" -Pattern "\$subscribe" -Recurse
# Expected: no output (no new subscribers introduced; if a pre-existing
# match appears, confirm it was present at HEAD before this WP and was
# not introduced by this packet)

# Step 10 — confirm D-5901 is in DECISIONS.md
Select-String -Path "docs\ai\DECISIONS.md" -Pattern "^## D-5901"
# Expected: exactly one match

# Step 11 — confirm the deferred block was removed from WORK_INDEX.md
Select-String -Path "docs\ai\work-packets\WORK_INDEX.md" -Pattern "WP-059 \(Pre-Plan UI Integration\) is deferred"
# Expected: no output

# Step 12 — confirm Layer Boundary row was updated (table rows can wrap)
Select-String -Path "docs\ai\ARCHITECTURE.md" -Pattern "apps/arena-client" -Context 0,8
# Expected: within the captured row context, `preplan` is absent from
# "Must NOT import" and present in "May import" with the D-5901
# annotation. Pattern matches the row label only; the captured
# trailing context is what carries the verification evidence.

# Step 13 — confirm no files outside the expected set were modified
git diff --name-only
# Expected: only files listed in ## Files Expected to Change
```

---

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0
- [ ] `pnpm -r test` exits 0 (no regressions)
- [ ] No new npm dependency introduced — only the workspace promotion
      of `@legendary-arena/preplan` to `dependencies`
- [ ] No `Math.random`, `Date.now`, `performance.now`, or `new Date(`
      under any file introduced by this WP (confirmed via
      `Select-String`)
- [ ] No `.reduce(` under any file introduced by this WP
- [ ] No `boardgame.io` import under any file introduced by this WP
- [ ] No runtime import of `@legendary-arena/game-engine` under the
      new preplan store, adapter, or components (only `import type`)
- [ ] `packages/game-engine/**`, `packages/registry/**`,
      `packages/preplan/**`, `packages/vue-sfc-loader/**`,
      `apps/server/**`, and `apps/registry-viewer/**` untouched
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/ARCHITECTURE.md` Layer Boundary row for
      `apps/arena-client` updated; cross-reference paragraph naming
      D-5901 present immediately below the table
- [ ] `.claude/rules/architecture.md` Import Rules table mirrors the
      ARCHITECTURE.md change
- [ ] `docs/ai/DECISIONS.md` contains the new D-5901 entry with its
      Context / Decision / Why sections populated
- [ ] `docs/ai/STATUS.md` updated — the arena client now owns a
      preplan store, disruption notification, and passive plan-step
      display; live middleware wiring remains a future WP
- [ ] `docs/ai/work-packets/WORK_INDEX.md` updated — WP-059 is
      recorded as a ready packet (not deferred) with its
      dependencies, notes, and chain-diagram position; deferred-block
      text removed
- [ ] Commit prefix uses `EC-059:` per the associated Execution
      Checklist at
      `docs/ai/execution-checklists/EC-059-preplan-ui-integration.checklist.md`
      (slot confirmed free 2026-04-23). If the slot was claimed
      between draft and execution, re-lint both files and pick the
      next free EC-NNN slot, updating every `EC-059` reference in
      lockstep.
- [ ] A 01.4 pre-flight pass is run before execution per `.claude/CLAUDE.md`
      mandatory-EC rule; if WP-059 gets its own execution checklist
      (EC-059 if free, otherwise next open slot), the EC file is
      created before execution begins
- [ ] 01.6 post-mortem is produced after execution per P6-28 — the
      store contract, adapter signatures, and component DOM shape are
      consumed by future WPs (speculative gesture UI, live-middleware
      wiring)

---

## Downstream Unblock

After this WP lands:

- **Follow-up WP (speculative gesture UI)** — can consume
  `usePreplanStore` and the lifecycle adapter; its remaining blocker is
  the private-projection contract (deck / hand / HQ / shared piles
  from the viewer's perspective).
- **WP-090 / live-match transport** — when it ships, a middleware
  module can call `applyDisruptionToStore` from `preplanLifecycle`
  upon detecting a disruption-eligible mutation. The store contract
  is frozen by this WP so the middleware can be written
  independently.
- **DESIGN-PREPLANNING.md §11** should be updated in a governance
  sweep after this WP lands — the "deferred" paragraph becomes
  "implemented in WP-059" with a link to this packet.

---

## Vision Alignment

**Vision clauses touched:** §3 (fairness; no info leakage), §4
(multiplayer pacing), §17 (accessibility), §22 (determinism), NG-1,
NG-2, NG-3, NG-4, NG-5, NG-6, NG-7.

**Conflict assertion:** No conflict. This WP preserves all touched
clauses.

**§3 (fairness) preservation:** Plan existence is not broadcast. The
store is entirely client-local. No action in §Scope (In) writes plan
state to the server, localStorage, sessionStorage, cookies, or any
network endpoint. Opponents cannot observe whether the viewer is
pre-planning, has planned, or has been disrupted. Verification Step 8
enforces this at the code level.

**§4 (multiplayer pacing) preservation:** Pre-planning is the direct
vehicle for §4. The store enables waiting-player interaction without
blocking the active turn; the notification layer surfaces disruptions
without adding latency to any other player's experience. No
synchronous handshake, no server round-trip.

**§17 (accessibility) preservation:** `PrePlanNotification` uses
`role="alert"` and `aria-live="assertive"`. The divergence from
WP-064's `aria-live="polite"` is documented in D-5901 and in the
component's header comment — a disruption invalidates the viewer's
current plan, so an assertive interruption is correct. Dismissal is a
keyboard-accessible `<button type="button">`.

**§22 (determinism) preservation:** The engine's authoritative state
is untouched by this WP. `PrePlan` state is entirely non-authoritative
and client-local; it cannot affect replay reproducibility. No
`Math.random`, no wall-clock, no network — verified at Steps 6 and 8.
The lifecycle adapter invokes `createPrePlan` (WP-057), which is
itself pure per WP-057's acceptance tests, so determinism is
preserved end-to-end from snapshot to store.

**Non-Goal proximity check (NG-1..7):**
- NG-1 (no paid persuasive mechanics): pre-planning is free,
  voluntary, and non-persuasive. No paid surfaces are introduced.
- NG-2 (no FOMO / manufactured urgency): the notification dismisses
  cleanly; no countdown, no penalty for dismissing.
- NG-3 (no competitive advantage for paid cosmetics): pre-planning is
  not a cosmetic surface. No cosmetic fields introduced.
- NG-4 (no dark patterns): the dismiss button is the only call to
  action; no manipulative phrasing.
- NG-5 (no data sale): plan state is never transmitted.
- NG-6 (no ads): no ad surfaces introduced.
- NG-7 (no tracking): no telemetry or analytics calls introduced.

None of NG-1..7 are crossed.

**Determinism preservation line:** the change preserves engine
determinism and is replay-faithful. The engine is authoritative over
replay; preplan is non-authoritative and client-local per
DESIGN-PREPLANNING.md §Architecture Principles. This WP cannot
affect replay output.
