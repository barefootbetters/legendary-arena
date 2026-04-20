# WP-064 — Game Log & Replay Inspector

**Status:** Ready
**Primary Layer:** Client UI (Vue 3 SPA — `apps/arena-client/`)
**Dependencies:** WP-061 (gameplay client bootstrap), WP-063 (replay
snapshot producer — defines `ReplaySnapshotSequence`), WP-028 (UIState),
WP-027 (replay verification harness — consumed indirectly via WP-063).
WP-062 (Arena HUD) is optional but recommended so this packet's components
slot next to the HUD components.
**EC:** EC-074 (to be drafted; next free slot following the EC-061 →
EC-067, EC-066 → EC-068, EC-062 → EC-069, EC-063 → EC-071, EC-080 →
EC-072, EC-079 → EC-073 retargeting precedent).
**Commit prefix:** `EC-074:` (never `WP-064:` — `.githooks/commit-msg`
rejects `WP-###:` per P6-36).

---

> **Amendment 2026-04-19 (SPEC):** WP-063 / EC-071 executed at commit
> `97560b1` (+ `b1ad8e5` SPEC governance). Several items in the
> sections below were assumed at draft time and can now be locked to
> hard facts. The executing session SHOULD NOT re-excavate these;
> each amendment is inline in the relevant section below and carries
> the same `Amendment 2026-04-19 (SPEC)` marker. Summary of what is
> now locked:
>
> 1. `ReplaySnapshotSequence` is exported at
>    `packages/game-engine/src/index.ts:217` (barrel block labelled
>    `// Replay snapshot sequence (WP-063)`). Source file lives at
>    `packages/game-engine/src/replay/replaySnapshot.types.ts`.
> 2. The WP-063 golden sample is at
>    `apps/replay-producer/samples/three-turn-sample.sequence.json`
>    (NOT `apps/arena-client/src/fixtures/replay/` as §Assumes below
>    originally implied). That golden is 4 snapshots, insufficient
>    for WP-064's §F fixture — WP-064 regenerates its own fixture via
>    the WP-063 CLI with a new inputs file.
> 3. `UIState.log` is `string[]` (not `readonly string[]` as §Locked
>    contract values below claims). The UI treats it as read-only
>    semantically per WP-028; the readonly wording is a lint of the
>    spec, not the type.
> 4. The WP-061 SFC transform mechanism is
>    `@legendary-arena/vue-sfc-loader` (WP-065), registered via
>    `node --import @legendary-arena/vue-sfc-loader/register`. WP-064
>    tests inherit this pipeline verbatim.
> 5. Sourcemap inheritance (WP-064 §Non-Negotiable Constraints) means
>    "inherit Vite's defaults" — NOT the
>    `process.setSourceMapsEnabled(true)` pattern WP-063 used at its
>    CLI entry. That WP-063 pattern solves a Windows `NODE_OPTIONS`
>    cross-env problem specific to node-CLI entrypoints; Vite's
>    client build already emits sourcemaps.
> 6. "Phase transition" in §F is **semantically unreachable** via the
>    WP-063 producer because `applyReplayStep`'s `events.setPhase` is
>    a no-op per D-0205 determinism-only semantics. WP-064's §F must
>    re-scope to **stage** transitions (`G.currentStage` via the
>    `advanceStage` move, which the replay MOVE_MAP supports) plus
>    log growth via unknown-move records (which push a warning to
>    `G.messages` → `UIState.log` per
>    `replay.execute.ts:162–166`). See §F amendment for the locked
>    fixture-generation path.
> 7. No keyboard focus-management prior art exists in WP-061 or
>    WP-062 (confirmed via arena-client component review). WP-064 IS
>    the first repo precedent — lock `tabindex="0"` + listeners-on-root
>    as a new D-entry (e.g., D-64NN) during WP-064 execution.
> 8. Consumer-side `version === 1` assertion wording is WP-064's DoD
>    per D-6303. Template (mirrors WP-063 CLI pattern): `Replay file
>    <source> field "version" must be the literal 1; received
>    <value>.` EC-074 locks this string verbatim.
> 9. New precedents P6-43 (JSDoc + grep collision), P6-44
>    (pnpm-lock.yaml as implicit allowlist for workspace-package
>    additions), and P6-45 (execution-surfaced D-entry pattern for
>    WP-literal vs upstream-canonical conflicts) are now in 01.4.
>    P6-43 and P6-44 apply to WP-064 execution; see §Verification
>    Steps amendment.

---

## Session Context

WP-027 proved games are deterministically reproducible given a seed and
ordered inputs. WP-028 locked `UIState` as the read-only projection the UI
consumes. WP-061 (client bootstrap) provides the Vue 3 skeleton, the Pinia
store for `UIState`, and fixtures. WP-063 (replay snapshot producer) adds
the engine-side CLI that wraps WP-027 and emits `ReplaySnapshotSequence`
JSON artifacts, and exports the `ReplaySnapshotSequence` type as part of
`@legendary-arena/game-engine`. This packet adds the first post-match
inspection surface: a scrollable live-log viewer that renders
`UIState.log`, plus a replay-stepper that consumes a `ReplaySnapshotSequence`
produced by WP-063 and lets the user scrub, step, and jump. The
replay-stepper never regenerates state client-side — it consumes snapshots
produced by WP-063, preserving the Layer Boundary.

---

## Goal

After this session, `apps/arena-client/` exposes:

- `<GameLogPanel />` — renders `snapshot.log` as a scrollable, virtualized
  list with stable line keys and `aria-live="polite"` on new entries.
- `<ReplayInspector />` — given a `ReplaySnapshotSequence` (array of
  `UIState`), provides keyboard- and button-driven controls to step
  forward, step backward, jump to first, jump to last, and scrub via a
  range input. The current snapshot is applied to the store, which means
  every other UI component (including the HUD from WP-062, if present) is
  automatically driven by the replay position.
- `<ReplayFileLoader />` — a file-input component that parses a JSON
  `ReplaySnapshotSequence` from disk (developer/tester convenience) and
  hands it to the inspector. No network fetch. No server round-trip.
- A committed fixture replay (`src/fixtures/replay/three-turn-sample.json`)
  of 6–12 `UIState` snapshots used by tests.
- Full keyboard operation: `←` / `→` step, `Home` / `End` jump,
  `Space` toggle auto-play (optional, gated behind a feature flag if
  implementing adds scope).
- A `node:test` + jsdom test run covering step, scrub, jump, and the
  empty-log / empty-replay edge cases.

No playback timing animation beyond CSS transitions. No server or
persistence. No production of replay snapshots — that is a separate future
packet that will wrap WP-027 in a CLI or server utility.

---

## Assumes

- WP-061 (gameplay client bootstrap) complete. Specifically:
  - `apps/arena-client/` is a working Vue 3 + Pinia + Vite SPA.
  - `useUiStateStore()` exposes `snapshot` and `setSnapshot`.
  - `loadUiStateFixture(name)` and committed fixtures exist.
- WP-063 (replay snapshot producer) complete. Specifically:
  - `@legendary-arena/game-engine` exports type
    `ReplaySnapshotSequence` from
    `packages/game-engine/src/replay/replaySnapshot.types.ts`.
  - The WP-063 producer CLI (`apps/replay-producer/`) and at least
    one golden sample triplet
    (`apps/replay-producer/samples/three-turn-sample.{inputs,sequence,cmd}`)
    are committed. **Amendment 2026-04-19 (SPEC):** the original
    wording here claimed a sample was committed under
    `apps/arena-client/src/fixtures/replay/` — that is incorrect.
    WP-063 committed its golden under `apps/replay-producer/samples/`
    only. WP-064 generates a NEW fixture under
    `apps/arena-client/src/fixtures/replay/` via the WP-063 CLI (see
    §F Fixture below for the locked generation path).
- WP-028 complete: `UIState` and all sub-types are type-exported.
- WP-027 complete: a replay harness exists (wrapped by WP-063).
- `pnpm --filter @legendary-arena/arena-client build` and `test` exit 0.

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — the client
  may not invoke the engine at runtime. The replay inspector consumes
  pre-produced snapshots; it does not reconstruct them client-side.
- `docs/ai/work-packets/WP-063-replay-snapshot-producer.md` — defines
  the `ReplaySnapshotSequence` shape this packet consumes and the CLI that
  produces artifacts. Read before deciding any structural assumption about
  the sequence.
- `docs/ai/work-packets/WP-027-determinism-replay-verification-harness.md`
  — the harness WP-063 wraps. Read only to understand the determinism
  guarantees that make replay stepping meaningful, not to invoke.
- `docs/ai/work-packets/WP-028-ui-state-contract-authoritative-view-model.md`
  — `UIState.log: string[]` is the field rendered by `<GameLogPanel />`.
- `docs/01-VISION.md §18 Replayability & Spectation` — every game is
  automatically saved as a replayable, shareable log; replays are perfectly
  faithful to the original game. This packet is the first client-side
  surface that honors that promise.
- `docs/01-VISION.md §17 Accessibility & Inclusivity` — full keyboard
  operation and screen-reader support are required.
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 4 (no abbreviations; use
  `snapshot` not `snap`, `sequence` not `seq`), Rule 6 (`// why:` comments),
  Rule 8 (no `.reduce()` in rendering logic), Rule 13 (ESM only).
- `apps/arena-client/src/stores/uiState.ts` (from WP-061) — the
  `setSnapshot` action the replay inspector calls on index changes.

---

## Preflight (Must Pass Before Coding)

This packet inherits WP-061's client toolchain and depends on WP-063
for the `ReplaySnapshotSequence` type. Each item below is a **blocker**.

- **WP-061 toolchain present:** `node:test` runner, SFC transform,
  Pinia store shape (one state field `snapshot`, one action
  `setSnapshot`), fixture loader. Do NOT reinvent or second-guess.
  Vitest, Jest, and Mocha are forbidden project-wide (lint §7, §12).
- **Propagate WP-061's test-runner decision inline:** before writing
  inspector components, locate the `DECISIONS.md` entry WP-061
  produced naming the exact SFC transform mechanism (loader hook,
  ESBuild/SWC register, pre-compile step, etc.) and paste a one-line
  summary into this packet's Session Context as an in-session
  amendment. Future readers should not have to cross-reference
  WP-061's commit history to know which transform this packet relied
  on.

  > **Amendment 2026-04-19 (SPEC):** this item is PRE-RESOLVED.
  > WP-061 adopted `@legendary-arena/vue-sfc-loader` (WP-065,
  > `packages/vue-sfc-loader/`), registered via `node --import
  > @legendary-arena/vue-sfc-loader/register`. The arena-client test
  > script is
  > `node --import tsx --import @legendary-arena/vue-sfc-loader/register --test src/**/*.test.ts`
  > (see `apps/arena-client/package.json`). WP-062 / WP-067 confirmed
  > the loader remains stable. **P6-30 / P6-40 apply:** any non-leaf
  > SFC (one that registers child components OR references template
  > bindings beyond `defineProps` / `defineEmits`) MUST use the
  > `defineComponent({ setup() { return {...} } })` form under this
  > loader. Leaf SFCs (props-only templates) may use `<script setup>`.
  > WP-064's executing session does NOT need to open WP-061's commit
  > history — this line is the summary the original preflight asked
  > for.
- **WP-063 engine type exported:** confirm
  `import type { ReplaySnapshotSequence } from '@legendary-arena/game-engine'`
  resolves in the arena-client package. If the type has not been
  exported from `packages/game-engine/src/index.ts`, WP-063 is
  incomplete and this packet is BLOCKED — do NOT redefine the type
  locally.
- **WP-063 sample artifact present:** confirm
  `apps/replay-producer/samples/three-turn-sample.sequence.json` exists
  and was produced by the WP-063 CLI (not hand-authored). The file this
  packet commits under `apps/arena-client/src/fixtures/replay/` must
  come from the WP-063 CLI with the command recorded alongside.
- **`UIState.log` shape unchanged:** confirm it is still
  `readonly string[]` per WP-028. If the shape has drifted (e.g.,
  objects with timestamps), stop and ask — do not invent a renderer.
- **Keyboard event handling prior art:** confirm whether WP-061 or
  WP-062 established a focus-management pattern. If so, match it. If
  not, the inspector root is `tabindex="0"` and keyboard listeners
  mount on the root (documented with a `// why:` comment).

  > **Amendment 2026-04-19 (SPEC):** this item is PRE-RESOLVED.
  > Review of WP-061 bootstrap (`<BootstrapProbe />`) and WP-062 HUD
  > components (`<ArenaHud />`, `<TurnPhaseBanner />`,
  > `<SharedScoreboard />`, `<ParDeltaReadout />`,
  > `<PlayerPanelList />`, `<PlayerPanel />`, `<EndgameSummary />`)
  > confirmed: **no keyboard focus-management pattern exists yet**.
  > All WP-062 HUD components are passive display surfaces with
  > `aria-label`s and `aria-live`/`aria-current` attributes only —
  > none carry `tabindex` or keyboard event handlers. WP-064 IS the
  > first client component to introduce keyboard-driven interaction.
  > The fallback path becomes the locked pattern: `tabindex="0"` on
  > the inspector root, keyboard listeners mounted on the root, with
  > a `// why:` comment documenting the focus order. WP-064 MUST lock
  > this as a new D-entry (e.g., D-64NN "Keyboard focus pattern for
  > stepper-style interactive components") so future WPs with
  > keyboard controls inherit it rather than re-derive.

If any item is unknown, **stop and ask**.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never import `@legendary-arena/game-engine` at runtime — `import type`
  only.
- Never import `@legendary-arena/registry` at runtime.
- Never import `boardgame.io` anywhere in `apps/arena-client/`.
- Never use `Math.random()`, `Date.now()`, or `performance.now()` in any
  file that affects snapshot selection or log rendering.
- ESM only, Node v22+; `node:` prefix on built-in imports in tests.
- Test files use `.test.ts` extension — tests run under the **same SFC
  transform pipeline WP-061 established**; this packet does not create
  or modify a second transform.
- Full file contents for every new or modified file in the output.
  No diffs, no snippets, no "show only the changed section" output.
- **Forbidden dependencies (lint §7):** no `axios`, no `node-fetch`
  (use Node's built-in `fetch`); no ORMs; no `Jest`, no `Vitest`, no
  `Mocha` — only `node:test`; no `passport`, no `auth0`, no `clerk`.
  Any new dependency requires a DECISIONS.md justification and the
  full updated `package.json` in the output.
- Do not modify WP-061 outputs (`src/stores/uiState.ts`, `src/main.ts`,
  `src/fixtures/uiState/`) unless a concrete reason is documented in
  DECISIONS.md and reflected in Files Expected to Change.
- Sourcemaps: inherit WP-061's sourcemap setup (dev + build).

  > **Amendment 2026-04-19 (SPEC):** "inherit WP-061's setup" means
  > inherit Vite's defaults (Vite dev server + `build.sourcemap`
  > option) as configured in
  > `apps/arena-client/vite.config.ts`/`package.json`. **Do NOT copy
  > WP-063's `process.setSourceMapsEnabled(true)` pattern** from
  > `apps/replay-producer/src/cli.ts` — that is a node-CLI-specific
  > answer addressing Windows `NODE_OPTIONS=--enable-source-maps`
  > cross-env hostility, and applies only to the `cli-producer-app`
  > category (D-6301). WP-064 is `client-app`; sourcemaps are a Vite
  > concern, not a node-entrypoint concern.

**Packet-specific:**
- `<ReplayInspector />` **never** computes a `UIState` from moves — it
  only selects an index into a pre-produced `ReplaySnapshotSequence` and
  calls `setSnapshot`. Verify with a source-level `Select-String` for any
  references to moves, hooks, or engine logic.
- `<GameLogPanel />` renders `snapshot.log` verbatim. It does not
  reformat, reinterpret, or filter log entries. Log entries are authored
  by the engine; the client is not a second interpretation layer.
- `<ReplayInspector />` state (current index, playback flag) lives inside
  the component, not in the global store. Derived position is local view
  state; the global store always reflects the currently selected
  `UIState`.
- Auto-play (if implemented) uses `requestAnimationFrame` or a
  user-configurable interval from a prop; never a hard-coded
  `setInterval`. If adding this pushes scope past one session, gate it
  behind a `ReplayInspectorProps.enableAutoPlay: boolean` default `false`
  and defer.
- The file loader uses the browser `File` API only. No `fetch`, no
  XHR, no node `fs` outside tests. Errors produce a full-sentence
  user-visible message (not an alert, not a console.error swallowed).
- No `.reduce()` in rendering or navigation logic.
- All interactive elements have explicit `aria-label` and full keyboard
  support; focus order is documented in a `// why:` comment on the
  inspector's root element.

**Session protocol:**
- If `UIState.log` does not exist or is not a `string[]` as of current
  `main`, stop and ask the human — do not invent a shape.
- `ReplaySnapshotSequence` is defined by WP-063 and exported as a type
  from `@legendary-arena/game-engine`. This packet imports it with
  `import type` only. Do NOT redefine or extend it locally.

**Locked contract values:**
- **`UIState.log` shape:** `string[]` (per WP-028 source at
  `packages/game-engine/src/ui/uiState.types.ts:40`). **Amendment
  2026-04-19 (SPEC):** the original wording "readonly string[]" is a
  lint of the spec, not the compile-time type. The array IS mutable
  at the TypeScript level; WP-028 enforces non-mutation semantically
  ("UI consumes projections only" — D-0301). WP-064's AC keeps
  "Does not mutate `snapshot.log`" but does not assert `readonly` at
  compile time.
- **`ReplaySnapshotSequence` shape:** defined by WP-063 in
  `packages/game-engine/src/replay/replaySnapshot.types.ts`. This packet
  consumes the type as-is. Ordering is determined exclusively by array
  position in `snapshots` — the client never reads timing metadata for
  ordering decisions.
- **Amendment 2026-04-19 (SPEC) — Consumer-side `version === 1`
  assertion (D-6303):** `parseReplayJson` (§Scope A) MUST assert
  `version === 1` and throw a full-sentence `Error` on any other
  value. EC-074 locks the exact message template to:
  `Replay file <source> field "version" must be the literal 1;
  received <JSON.stringify(value)>.` where `<source>` is the
  filename passed into the parser or the literal string
  `"in-memory"` when no filename is available. This template mirrors
  the WP-063 CLI error at
  `apps/replay-producer/src/cli.ts:93` verbatim so operator
  diagnostic wording is consistent across the producer and
  consumer.

---

## Debuggability & Diagnostics

- **Deterministic visible output:** given an identical
  `ReplaySnapshotSequence` and an identical user input sequence (keys
  / clicks), the rendered **visible text content, `aria-label`-ed
  elements, and current index readout** are stable across runs.
  Attribute order and Vue-internal markers are out of scope.
- **Stable test IDs on every control:** the inspector exposes
  `data-testid` on `replay-step-prev`, `replay-step-next`,
  `replay-jump-first`, `replay-jump-last`, `replay-scrub`,
  `replay-position` (the index readout).
- **Stable log-line addressing:** `<GameLogPanel />` exposes
  `data-testid="game-log-panel"`; each log line carries
  `data-testid="game-log-line"` plus a `data-index` attribute matching
  its source-array index. `data-index` is how a bug report names the
  offending line.
- **No `console.*` in production paths:** any diagnostic is a rendered
  message (`role="alert"` for errors, `role="status"` for neutral
  state). Console logs are permitted only in dev-only code paths
  guarded by `import.meta.env.DEV`.
- **Fixture reproducibility:** every bug report against this inspector
  must cite the exact replay file (or committed fixture name) plus the
  current index. Bugs that cannot be reproduced from a named fixture
  at a named index are fixture-coverage gaps, not inspector bugs.
- **Replay-load error surface:** `parseReplayJson` error messages name
  both the input (filename or "in-memory") and the missing/invalid
  field — e.g., `Replay file "my-run.json" is missing required field
  "snapshots".` Identical pattern to WP-061's fixture loader.
- **Keyboard focus diagnostics:** the inspector root has
  `tabindex="0"` (or inherits focus via an interactive child). A
  `// why:` comment documents the focus order so screen-reader users
  can navigate deterministically.

---

## Scope (In)

### A) Replay loader

- `apps/arena-client/src/replay/loadReplay.ts` — **new**:
  - `import type { ReplaySnapshotSequence } from '@legendary-arena/game-engine'`
  - `parseReplayJson(raw: string, source?: string): ReplaySnapshotSequence`
    — throws a full-sentence `Error` on invalid version, missing
    `snapshots`, or empty array. The optional `source` parameter names
    the origin (filename or the literal `"in-memory"`) for
    error-message context.
  - `// why:` comment: invalid replay files must fail loudly, not
    silently render an empty inspector.
  - `// why:` comment: the `ReplaySnapshotSequence` type is imported from
    the engine (defined by WP-063) — never redefined client-side.

  > **Amendment 2026-04-19 (SPEC) — Locked error-message templates.**
  > Per D-6303 and the §Locked contract values amendment above, the
  > parser emits these exact full-sentence strings:
  >
  > - Invalid version:
  >   `Replay file <source> field "version" must be the literal 1;
  >   received <JSON.stringify(value)>.`
  > - Missing `snapshots`:
  >   `Replay file <source> is missing required field "snapshots".`
  > - Empty `snapshots`:
  >   `Replay file <source> field "snapshots" must contain at least
  >   one UIState; received an empty array.`
  >
  > `<source>` resolves to the `source` arg or the literal
  > `"in-memory"` fallback. These templates mirror the WP-063 CLI
  > wording convention verbatim so operator tooling produced by the
  > CLI (stderr) and the consumer (in-browser alert region) agree on
  > diagnostic phrasing.

### C) Game log panel

- `apps/arena-client/src/components/log/GameLogPanel.vue` — **new**:
  - Reads `snapshot.log` from the store.
  - Renders each entry in a `<li>` with a stable `:key` (the line index
    is acceptable because the engine log is append-only within a match;
    document this in a `// why:` comment).
  - Virtualization is optional; if implemented use a simple windowed
    render, not a library dependency, unless the repo already has one.
  - `aria-live="polite"` on the list; the empty state is a
    `role="status"` region with the message "Game log is empty."
  - Scoped styles only.

### D) Replay inspector

- `apps/arena-client/src/components/replay/ReplayInspector.vue` — **new**:
  - Props: `sequence: ReplaySnapshotSequence`,
    `initialIndex?: number` (default 0), `enableAutoPlay?: boolean`
    (default `false`).
  - Local state: `currentIndex: Ref<number>`, `isPlaying: Ref<boolean>`.
  - On mount and on `currentIndex` change: calls
    `useUiStateStore().setSnapshot(sequence.snapshots[currentIndex])`.
  - Controls: first / prev / next / last buttons, a range input bound to
    `currentIndex`, and a numeric readout `index + 1 / total`.
  - Keyboard: `←` prev, `→` next, `Home` first, `End` last. Handlers
    mount on the component's root element; a `// why:` comment documents
    why the root is focusable.
  - Emits no events — the store is the side channel.

  > **Amendment 2026-04-19 (SPEC) — Authoring form.**
  > `<ReplayInspector />` is a **non-leaf SFC** under the
  > `@legendary-arena/vue-sfc-loader` pipeline: it registers child
  > components (the buttons, the range input, and likely
  > `<GameLogPanel />` when composed into a container view) AND
  > references template bindings beyond `defineProps` / `defineEmits`
  > (e.g., `currentIndex`, event handlers, `isPlaying`). Per
  > P6-30 / P6-40, it MUST use the
  > `defineComponent({ setup() { return {...} } })` authoring form,
  > with child components registered via the `components: {...}`
  > option. `<script setup>` will fail under
  > `vue-sfc-loader`'s separate-compile pipeline when the template
  > references anything beyond props — this is the same failure mode
  > WP-062's `<ArenaHud />` / `<PlayerPanel />` /
  > `<PlayerPanelList />` / `<ParDeltaReadout />` /
  > `<EndgameSummary />` hit. `<GameLogPanel />` and
  > `<ReplayFileLoader />` (§C and §E below) may stay in
  > `<script setup>` if their templates reference only props-and-emits
  > bindings; pre-flight verifies per-SFC.

### E) Replay file loader

- `apps/arena-client/src/components/replay/ReplayFileLoader.vue` — **new**:
  - Renders a labeled `<input type="file" accept=".json,application/json">`.
  - On file selection, reads text via `File.text()`, parses via
    `parseReplayJson`, and emits a `loaded` event with the parsed
    sequence.
  - Parse errors render a `role="alert"` message inline. No `alert()`.

### F) Fixture

- `apps/arena-client/src/fixtures/replay/three-turn-sample.json` —
  **new**. A valid `ReplaySnapshotSequence` produced by the WP-063 CLI
  against a deterministic match with between 6 and 12 snapshots, each a
  complete `UIState`. The sequence must include at least one **stage**
  transition and one log-growth step (see Amendment below). Do NOT
  hand-author this file — generate it via the WP-063 producer so it
  remains byte-identical to what real replays will look like. Commit
  the generator command line in a sibling `three-turn-sample.cmd.txt`
  for reproducibility.
- `apps/arena-client/src/fixtures/replay/index.ts` — **new**. Exports
  `loadReplayFixture(name: 'three-turn-sample'):
  ReplaySnapshotSequence`. Imports the type from the engine.

  > **Amendment 2026-04-19 (SPEC) — Fixture requirement re-scoped
  > from "phase transition" to "stage transition."** The original
  > "at least one phase transition" bar is **unreachable via the
  > WP-063 producer** because `applyReplayStep`
  > (`packages/game-engine/src/replay/replay.execute.ts`) enforces
  > `events.setPhase: () => {}` (no-op) per the D-0205
  > determinism-only harness contract. No `ReplaySnapshotSequence`
  > produced today can carry a `snapshot.game.phase` change.
  >
  > **Stage transitions ARE reachable.** The replay MOVE_MAP includes
  > `advanceStage`, which calls `advanceTurnStage` and updates
  > `G.currentStage` (`start` → `main` → `cleanup`), which WP-028's
  > `buildUIState` projects into `snapshot.game.currentStage`. A
  > `ReplayMove` with `moveName: 'advanceStage'` therefore produces a
  > visible stage delta between adjacent snapshots.
  >
  > **Log growth IS reachable** via the unknown-move warning path:
  > `applyReplayStep` pushes
  > `Replay warning: unknown move name "<X>" — skipped.` to
  > `gameState.messages` for any move name not in MOVE_MAP
  > (`replay.execute.ts:162–166`). WP-028's `buildUIState` projects
  > `gameState.messages` into `snapshot.log` verbatim
  > (`uiState.build.ts:272`), so an unknown-move record produces a
  > new log entry deterministically, with no registry footprint.
  >
  > **Locked fixture-generation path for WP-064.** Author the inputs
  > file at `apps/arena-client/src/fixtures/replay/three-turn-sample.inputs.json`
  > (kept sibling to the sequence for auditability), mix
  > `advanceStage` moves (stage deltas) with a handful of unknown-move
  > records (log growth), target 6–12 total moves, run the WP-063
  > CLI against it, commit the produced `three-turn-sample.json` and
  > the `three-turn-sample.cmd.txt` invocation. The empty-list
  > registry reader the WP-063 CLI bundles is sufficient — matches
  > the `replay.execute.test.ts` / `replay.verify.test.ts`
  > precedent and avoids importing `@legendary-arena/registry` at
  > runtime.
  >
  > **WP-064's §G Tests must assert stage-transition wording, not
  > phase-transition wording.** Any test that checks
  > `fixture.snapshots[i].game.currentStage !==
  > fixture.snapshots[i+1].game.currentStage` is the correct form;
  > asserting `snapshot.game.phase` diversity will fail vacuously.

### G) Tests

- `apps/arena-client/src/replay/loadReplay.test.ts` — **new**:
  - Parses the committed fixture successfully.
  - Throws with a full-sentence message when `version !== 1`.
  - Throws when `snapshots` is missing.
  - Throws when `snapshots` is empty.
- `apps/arena-client/src/components/log/GameLogPanel.test.ts` — **new**:
  - Empty `snapshot.log` renders the status message.
  - Non-empty log renders one `<li>` per entry in order.
  - List has `aria-live="polite"`.
- `apps/arena-client/src/components/replay/ReplayInspector.test.ts` —
  **new**:
  - Mounting with the sample fixture sets `snapshot` to
    `sequence.snapshots[0]`.
  - Clicking `next` advances the store to index 1.
  - Scrubbing to the last index sets the store to the last snapshot.
  - Pressing `End` jumps to last; `Home` jumps to first.
  - Stepping past the last index clamps (does not wrap).
- `apps/arena-client/src/components/replay/ReplayFileLoader.test.ts` —
  **new**:
  - Selecting a valid JSON file emits the `loaded` event with the parsed
    sequence.
  - Selecting an invalid JSON file renders the alert region and does not
    emit.

---

## Out of Scope

- Producing replay files from a real match — that is a future packet that
  will wrap WP-027 in a CLI or server utility and produce
  `ReplaySnapshotSequence` artifacts.
- Any server-side or storage integration (Cloudflare R2, DB) — future
  packet.
- Any editing of replay content — replays are immutable by vision (§24).
- Sharing, export, or download UI — future packet.
- Spectator-specific inspector layout — future packet (spectator HUD)
  may extend the inspector or wrap it.
- Scoring overlays beyond what is already present in `UIState` — PAR
  and final-score rendering live in the HUD (WP-062).
- Any change to `UIState` shape — this packet is a consumer, not a
  contract change.
- Refactors, cleanups, or "while I'm here" improvements.

---

## Files Expected to Change

- `apps/arena-client/src/replay/loadReplay.ts` — **new**
- `apps/arena-client/src/replay/loadReplay.test.ts` — **new**
- `apps/arena-client/src/components/log/GameLogPanel.vue` — **new**
- `apps/arena-client/src/components/log/GameLogPanel.test.ts` — **new**
- `apps/arena-client/src/components/replay/ReplayInspector.vue` — **new**
- `apps/arena-client/src/components/replay/ReplayInspector.test.ts` —
  **new**
- `apps/arena-client/src/components/replay/ReplayFileLoader.vue` — **new**
- `apps/arena-client/src/components/replay/ReplayFileLoader.test.ts` —
  **new**
- `apps/arena-client/src/fixtures/replay/three-turn-sample.json` — **new**
- `apps/arena-client/src/fixtures/replay/index.ts` — **new**

Additionally (governance updates per DoD):

- `docs/ai/STATUS.md` — **modified**
- `docs/ai/DECISIONS.md` — **modified** (at minimum: why the client
  never regenerates `UIState` from moves; chosen shape and source of
  `ReplaySnapshotSequence`; auto-play deferral decision if gated;
  keyboard focus-management choice)
- `docs/ai/work-packets/WORK_INDEX.md` — **modified**

No other files may be modified. `packages/game-engine/**`,
`packages/registry/**`, `apps/server/**`, and `apps/registry-viewer/**`
must be untouched. The `src/stores/` directory from WP-061 must be
untouched unless a concrete reason is documented in DECISIONS.md.

---

## Acceptance Criteria

### Layer Boundary
- [ ] No runtime import of `@legendary-arena/game-engine` in any file
      under `apps/arena-client/src/replay/` or `components/log/` or
      `components/replay/` (only `import type` permitted). Confirmed with
      `Select-String`.
- [ ] No import of `@legendary-arena/registry` or `boardgame.io` in any
      file under those paths. Confirmed with `Select-String`.
- [ ] No reference to engine runtime symbols (move names, hook names,
      rule constants) in replay or log source files.

### Log Panel
- [ ] Renders the empty-state status when `snapshot.log` is `[]`.
- [ ] Renders exactly one `<li>` per entry, in source order.
- [ ] List element carries `aria-live="polite"`.
- [ ] Does not mutate `snapshot.log`.

### Replay Inspector
- [ ] Mount with a valid sequence sets the store snapshot to
      `snapshots[initialIndex ?? 0]`.
- [ ] Next / prev / first / last advance the store snapshot correctly.
- [ ] Stepping past the end clamps (does not wrap or throw).
- [ ] Range input scrub updates the store snapshot.
- [ ] Keyboard controls (`←`, `→`, `Home`, `End`) work.
- [ ] Every control has an explicit `aria-label`.

### Replay File Loader
- [ ] Valid JSON file emits `loaded` with a typed
      `ReplaySnapshotSequence`.
- [ ] Invalid JSON renders a `role="alert"` region and does not emit.
- [ ] Uses `File.text()`; no `fetch`, no `fs` in production code.

### Determinism
- [ ] Given an identical input sequence and identical replay fixture,
      the rendered **visible text, `aria-label`-ed elements, and index
      readout** are stable across runs (snapshot test asserts
      textContent + a11y tree; it does NOT snapshot raw innerHTML).
- [ ] No `Math.random`, `Date.now`, or `performance.now` in any new
      file (confirmed with `Select-String`).

### Tests
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0.
- [ ] Every component and helper in Scope (In) has at least one test.

### Scope Enforcement
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`).
- [ ] `packages/game-engine/**`, `packages/registry/**`, `apps/server/**`,
      `apps/registry-viewer/**` are untouched.

---

## Verification Steps

```pwsh
# Step 1 — build and test
pnpm --filter @legendary-arena/arena-client build
pnpm --filter @legendary-arena/arena-client typecheck
pnpm --filter @legendary-arena/arena-client test
# Expected: all exit 0

# Step 2 — confirm no engine runtime import
Select-String -Path "apps/arena-client/src/replay" -Pattern "from '@legendary-arena/game-engine'" -Recurse | Where-Object { $_.Line -notmatch "import type" }
Select-String -Path "apps/arena-client/src/components/log" -Pattern "from '@legendary-arena/game-engine'" -Recurse | Where-Object { $_.Line -notmatch "import type" }
Select-String -Path "apps/arena-client/src/components/replay" -Pattern "from '@legendary-arena/game-engine'" -Recurse | Where-Object { $_.Line -notmatch "import type" }
# Expected: no output

# Step 3 — confirm no registry or boardgame.io import in new files
Select-String -Path "apps/arena-client/src/replay", "apps/arena-client/src/components/log", "apps/arena-client/src/components/replay" -Pattern "@legendary-arena/registry|boardgame.io" -Recurse
# Expected: no output

# Step 4 — confirm no wall-clock or RNG
Select-String -Path "apps/arena-client/src/replay", "apps/arena-client/src/components/log", "apps/arena-client/src/components/replay" -Pattern "Math\.random|Date\.now|performance\.now" -Recurse
# Expected: no output

# Step 5 — confirm no .reduce in rendering
Select-String -Path "apps/arena-client/src/components/log", "apps/arena-client/src/components/replay" -Pattern "\.reduce\(" -Recurse
# Expected: no output

# Step 6 — confirm engine/server packages untouched
git diff --name-only packages/game-engine/ packages/registry/ apps/server/ apps/registry-viewer/
# Expected: no output

# Step 7 — confirm only expected files changed
git diff --name-only
# Expected: only files listed in ## Files Expected to Change

# Step 8 — P6-44 pnpm-lock discipline (new workspace packages only)
# WP-064 adds NO new workspace package (first cli-producer-app /
# client-app / shared-lib). pnpm-lock.yaml should be absent from the
# diff. If it appears, a new devDep was silently added — investigate
# before staging (likely violates §Non-Negotiable Constraints line
# "Any new dependency requires a DECISIONS.md justification").
git diff --name-only | Select-String "^pnpm-lock\.yaml$"
# Expected: no output
```

> **Amendment 2026-04-19 (SPEC) — P6-43 JSDoc-paraphrase discipline
> for Step 4.** `Select-String -Pattern "Math\.random|Date\.now|performance\.now"`
> in Step 4 matches JSDoc / comment text, not just live calls. If a
> new file's JSDoc describes what the file does NOT do using the
> literal API names (e.g., "no `Math.random`, no `Date.now`"), the
> grep returns a false-positive match. Per P6-43, WP-064's JSDoc
> MUST use paraphrase form ("no non-engine RNG", "no wall-clock
> reads", "no timing shortcuts") so the purity grep remains
> unambiguous. See the WP-063 post-mortem §10 for the same fix
> applied to `buildSnapshotSequence.ts`.

---

## Definition of Done

- [ ] Preflight items all resolved (WP-061 toolchain present, WP-063
      type exported, WP-063 sample artifact present, `UIState.log`
      shape unchanged, keyboard focus prior art decided).
- [ ] All acceptance criteria above pass.
- [ ] `pnpm --filter @legendary-arena/arena-client build` exits 0.
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0.
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0.
- [ ] No runtime import of engine, registry, or boardgame.io in any new
      file.
- [ ] No wall-clock or `Math.random` in any new file.
- [ ] `packages/game-engine/**`, `packages/registry/**`, `apps/server/**`,
      and `apps/registry-viewer/**` untouched.
- [ ] `docs/ai/STATUS.md` updated — the client now has a game-log panel
      and a replay inspector that consume committed snapshots; no live
      match or replay production wiring yet.
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why the client never
      regenerates `UIState` from moves (Layer Boundary); chosen shape of
      `ReplaySnapshotSequence`; decision to defer auto-play if gated.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-064 checked off with
      today's date and a note linking this file, and dependencies on
      WP-061, WP-063, WP-028, and WP-027 are recorded.
