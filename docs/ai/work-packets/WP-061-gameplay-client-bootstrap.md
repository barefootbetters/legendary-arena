# WP-061 — Gameplay Client Bootstrap

**Status:** Complete
**Primary Layer:** Client UI (new Vue 3 SPA)
**Execution Checklist:** `docs/ai/execution-checklists/EC-067-gameplay-client-bootstrap.checklist.md`
**Commit prefix:** `EC-067:` (not `EC-061:` — the `EC-061` slot is
historically bound to the registry-viewer Rules Glossary panel
shipped in commit `1b923a4`. WP-061 uses EC-067, the next free
slot in the shared 060+ range.)
**Dependencies:** WP-028 (UIState — types only), WP-065 (Vue SFC Test
Transform Pipeline — provides the shared loader that makes `.vue`
component tests runnable under `node:test`)

---

## Session Context

WP-028 locked `UIState` as the sole engine→UI projection; WP-029 added
spectator-filtered views; WP-048 extended the projection with PAR scoring
fields. No client application consumes these contracts yet —
`apps/registry-viewer/` is a separate SPA for card browsing and does not
render match state. This packet creates the minimum viable
`apps/arena-client/` skeleton (Vue 3 + Vite + Pinia + TypeScript) plus a
typed `UIState` store and a committed set of fixtures, so every subsequent
UI packet (Arena HUD, spectator HUD, log/replay inspector, lobby) can be
built and tested against frozen projection snapshots without engine wiring.

---

## Goal

After this session, `apps/arena-client/` is a buildable, testable Vue 3 SPA
that exposes:

- A Pinia store `useUiStateStore()` with a single typed state field
  `snapshot: UIState | null` and one action `setSnapshot(next)`.
- A dev-only fixture loader `loadUiStateFixture(name)` that reads committed
  JSON from `src/fixtures/uiState/` and calls `setSnapshot`.
- At least three fixtures: `mid-turn.json`, `endgame-win.json`,
  `endgame-loss.json`, each validating at the type level against `UIState`.
- A single smoke-test component `<BootstrapProbe />` that displays
  `snapshot.game.phase` when a snapshot is loaded, and renders an "empty"
  message when `snapshot === null`.
- A `node:test` + jsdom test run that loads a fixture, mounts the probe,
  and asserts the phase value renders.
- `pnpm --filter @legendary-arena/arena-client build` and `test` both
  exiting 0.

No HUD, no scoreboard, no networking, no routing beyond a single placeholder
route. This packet is strictly plumbing.

---

## Assumes

- WP-028 complete. Specifically:
  - `@legendary-arena/game-engine` exports `UIState`, `UIPlayerState`,
    `UICityState`, `UIHQState`, `UIMastermindState`, `UISchemeState`,
    `UITurnEconomyState`, `UIGameOverState` as types.
- WP-065 complete. Specifically:
  - `@legendary-arena/vue-sfc-loader` is a private package published
    inside the monorepo. Its `exports` map publishes **only** the
    `./register` subpath; `.` and `./loader` are intentionally not
    exposed (removed during WP-065 post-mortem to honor the 9-file
    allowlist). WP-061 consumes the package solely via
    `@legendary-arena/vue-sfc-loader/register` — do not attempt to
    import `compileVue` directly.
  - Running a Node process with
    `--import @legendary-arena/vue-sfc-loader/register` makes `.vue`
    imports work under `node:test`, with sourcemaps that point at
    `.vue` files.
  - WP-065 tests exit 0 on `main`.
  - WP-065 execution observed pnpm resolving `vue@3.5.30` against
    the `^3.4.27` peerDep pin (D-6502). WP-061's
    `apps/arena-client/package.json` pins `vue@^3.4.27` for
    consistency; pnpm may resolve the same 3.5.x minor. The jsdom
    global-injection boilerplate required by `@vue/test-utils.mount()`
    (see §Scope (In) G and §Non-Negotiable Constraints) is
    Vue-3.5.x-specific behavior — if a future WP bumps the pin, the
    jsdom globals list may need to be re-verified.
- `apps/registry-viewer/` exists as prior-art Vue 3 SPA in this repo and
  follows the repo's ESM + Composition API conventions.
- `pnpm -r build` and `pnpm -r test` exit 0 on `main`.
- `docs/ai/DECISIONS.md` exists.

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — client apps
  may consume engine **types only** at runtime. No engine runtime import
  is permitted from `apps/arena-client/`.
- `docs/ai/ARCHITECTURE.md §Persistence Boundary (Cross-Layer)` — `G` is
  runtime-only. Fixtures in this packet represent `UIState`, not `G`.
- `apps/registry-viewer/CLAUDE.md` — the canonical Vue 3 SPA layout in this
  repo. Mirror its conventions (Composition API, no barrel re-exports, flat
  `components/` folder, Vite build) unless a written reason to diverge.
- `apps/registry-viewer/HISTORY-modern-master-strike.md` — prior-art notes
  on what not to repeat from the earlier viewer.
- `docs/ai/work-packets/WP-028-ui-state-contract-authoritative-view-model.md`
  — exact field shapes every fixture must satisfy.
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 4 (no abbreviations), Rule
  9 (`node:` prefix), Rule 13 (ESM only), Rule 14 (field names match the
  data contract — fixtures must use engine field names verbatim).
- `docs/01-VISION.md §17 Accessibility & Inclusivity` — even the probe
  component renders with an explicit `aria-label`. Accessibility is
  established in bootstrap, not retrofitted later.

---

## Preflight (Must Pass Before Coding)

Before scaffolding `apps/arena-client/`, confirm repo prior-art so this
packet does not invent a new toolchain mid-session. Each item below is a
**blocker** if the answer is unknown — resolve it first.

- **Test runner is locked to `node:test` + `node:assert` only** per
  lint checklist §7 and §12, and `.claude/rules/code-style.md`. Vitest,
  Jest, and Mocha are **forbidden** project-wide — do NOT propose them
  as an alternative. **There is no prior client-app test precedent in
  `apps/registry-viewer/`** (verified during WP-065 execution: zero
  `.test.*` files, no `test` script in its `package.json`). WP-061
  **establishes** the client-app `node:test` + SFC-transform
  precedent; do not search for one that does not exist.
- **SFC test transform comes from WP-065.** This packet's `test`
  script invokes Node directly with two `--import` flags in fixed
  order: `node --import tsx --import
  @legendary-arena/vue-sfc-loader/register --test src/**/*.test.ts`.
  This matches the precedent set by
  `packages/game-engine/package.json:19`,
  `packages/registry/package.json:19`, and
  `apps/server/package.json:10` (all use direct `--import tsx`
  flags in their test scripts). **Do NOT** introduce `cross-env`,
  `NODE_OPTIONS` in scripts, or any other wrapper — direct CLI
  flags inside the `"test"` string work cross-platform without
  new dependencies. Do NOT create a second transform pipeline; do
  NOT copy WP-065's loader into this package; do NOT modify
  `packages/vue-sfc-loader/**`. If running a WP-065 test fixture
  (`hello.vue`) through `node:test` fails here, WP-065 is broken
  and must be fixed there — not patched here.
- **Code-category classification for `apps/arena-client/` (PS-#
  candidate).** Per `01.4` §Precedent Log P6-26 (new lesson from
  WP-065), any new top-level workspace package needs a category row
  in `docs/ai/REFERENCE/02-CODE-CATEGORIES.md`. Verify that
  `apps/arena-client/` is covered by an existing `apps/*`-wide row;
  if it is not, resolve as **PS-1** by adding a new
  `D-NNNN — Client app classification for apps/arena-client/` entry
  to `DECISIONS.md` and the matching `02-CODE-CATEGORIES.md` row
  **before** session-prompt generation. Precedent: D-6501 (Shared
  Tooling classification for `packages/vue-sfc-loader/`).
- **TypeScript config prior art:** the repo does not ship a
  `tsconfig.base.json`; each package/app owns its own tsconfig.
  `resolveJsonModule: true` is therefore enabled **only in this
  app's `apps/arena-client/tsconfig.json`** — no repo-wide change is
  proposed. The Zod-fallback branch is dropped; `satisfies UIState`
  is the only fixture-validation strategy.
- **Workspace packaging prior art:** confirm how other apps are named
  (`@legendary-arena/*` scope — `apps/registry-viewer/package.json:2`
  uses `"name": "registry-viewer"` without the scope; WP-061 adopts
  the scoped form `@legendary-arena/arena-client` for consistency
  with `@legendary-arena/game-engine` and
  `@legendary-arena/vue-sfc-loader`), marked (`private: true`), and
  filtered via pnpm (`pnpm --filter @legendary-arena/<name>`).
- **Vue routing convention:** `apps/registry-viewer/` does not use
  `vue-router`. This packet **omits routing entirely** (no "maybe
  router" branch).
- **Sourcemap convention:** `apps/registry-viewer/vite.config.ts`
  is the only prior art. WP-061 ships dev sourcemaps (Vite default)
  and enables `build.sourcemap: true` to make first-time bootstrap
  failures diagnosable; revisit in a future packet once the app
  grows.

If any of these items is unknown or cannot be answered by reading
`apps/registry-viewer/` + repo root config, **stop and ask** before
writing a single file.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never import `@legendary-arena/game-engine` at runtime from any file in
  `apps/arena-client/` — `import type` only.
- Never import `@legendary-arena/registry` at runtime from the bootstrap —
  card display is out of scope here.
- Never use `Math.random()`, `Date.now()`, `performance.now()`, or any wall
  clock in files that touch `UIState` or fixtures.
- Never persist `UIState` — the store holds the current snapshot only; no
  localStorage, sessionStorage, IndexedDB, or cookies.
- ESM only, Node v22+. `node:` prefix on all Node built-in imports in tests
  and tooling.
- Test files use `.test.ts` extension — never `.test.mjs`.
- Full file contents for every new or modified file in the output. No
  diffs, no snippets, no "show only the changed section" output.
- **Forbidden dependencies (lint §7):** no `axios`, no `node-fetch`
  (use Node's built-in `fetch` if HTTP is ever needed); no ORMs (N/A
  here — no DB access); no `Jest`, no `Vitest`, no `Mocha` — the only
  permitted test runner is `node:test`; no `passport`, no `auth0`, no
  `clerk`. Any new dependency must be justified with a DECISIONS.md
  entry and the full updated `package.json` checked in.

**Packet-specific:**
- `UIState` is imported as a **type**: `import type { UIState } from
  '@legendary-arena/game-engine'`. Verify with `Select-String`.
- The Pinia store exposes exactly **one state field** (`snapshot`) and
  exactly **one action** (`setSnapshot`). No getters. No additional
  state. No additional actions. (Pinia terminology: "actions" mutate
  state; there is no "mutations" concept as in Vuex. This packet uses
  "action" consistently.) Derived view-state belongs to future UI
  packets.
- Fixtures are committed JSON files. Each fixture is imported through a
  typed TS module that applies `satisfies UIState` at the import site
  (Scope (In) §C covers the concrete file). A bare `as UIState` cast is
  forbidden — it would silently mask drift. If `resolveJsonModule` is
  not enabled repo-wide (see Preflight), stop and either enable it or
  document the chosen runtime validator in DECISIONS.md before writing
  any fixture code.
- The `<BootstrapProbe />` component renders only `snapshot.game.phase`
  and a fallback "no snapshot loaded" message. It is a wiring probe, not a
  feature.
- No router beyond a single placeholder route mounted at `/`. No
  `vue-router` guard logic, no auth, no redirects.
- No CSS framework beyond a minimal reset and a single global stylesheet
  establishing base font, color tokens, and focus-ring defaults. Component
  styling is scoped.
- Tests use `node:test` + `node:assert` + `@vue/test-utils` + `jsdom`.
  No Jest. No Vitest. No Mocha. (Lint §7, §12 — project-wide rule.)
  The `.vue` SFC transform pipeline is provided by WP-065
  (`@legendary-arena/vue-sfc-loader`); this packet's `test` script
  uses **direct `--import` CLI flags** (no `NODE_OPTIONS`, no
  `cross-env`): `node --import tsx --import
  @legendary-arena/vue-sfc-loader/register --test
  src/**/*.test.ts`. Matches the precedent set by
  `packages/game-engine`, `packages/registry`, and `apps/server`.
  If SFC tests fail to run, the fault lies in WP-065 — do not
  patch around it in this packet.
- **jsdom + `@vue/test-utils.mount()` setup boilerplate is
  load-bearing.** Under Vue 3.5.x + Node 22+ (WP-065's observed
  environment), `@vue/runtime-dom.resolveRootNamespace` probes
  `SVGElement` during `app.mount()`; a plain assignment
  `globalThis.navigator = dom.window.navigator` throws
  `TypeError: Cannot set property navigator of #<Object> which
  has only a getter`. Every component test that calls `mount()`
  imports a shared `src/testing/jsdom-setup.ts` helper that
  injects `HTMLElement`, `Element`, `Node`, `SVGElement`,
  `MathMLElement`, and assigns `navigator` via
  `Object.defineProperty(globalThis, 'navigator', { value, writable:
  true, configurable: true })`. Precedent: WP-065
  `packages/vue-sfc-loader/src/loader.test.ts` driver.
- **Optional `UIState` fields are OMITTED from fixture JSON**, not
  emitted as `null` or `undefined`. The repo's strict tsconfig has
  `exactOptionalPropertyTypes: true` (verified in
  `packages/game-engine/tsconfig.json:8` and inherited by this
  app's tsconfig). Under that flag, `{ gameOver: null }` is not
  assignable to `{ gameOver?: UIGameOverState }` — the field must
  be absent for `satisfies UIState` to hold. JSON cannot represent
  `undefined`, so **omit** is the only correct form. Precedent:
  WP-065 Locked Decision 11 (`compileVue` return-object
  construction) and WP-029 `preserveHandCards`.

**Session protocol:**
- If `apps/registry-viewer/` uses a test runner that is not `node:test`,
  stop and ask the human which runner to use. Do not silently diverge.
- If the shape of a fixture conflicts with `UIState`, stop and ask — do
  not invent fields.

**Locked contract values:**
- **UIState top-level keys:** `game`, `players`, `city`, `hq`, `mastermind`,
  `scheme`, `economy`, `log`, `gameOver?`.
- **Phase names:** `'lobby' | 'setup' | 'play' | 'end'`.
- **TurnStage values:** `'start' | 'main' | 'cleanup'`.

---

## Debuggability & Diagnostics

- **Deterministic visible output:** given the same fixture input, the
  rendered **visible text content and `aria-label`-ed elements** are
  stable across runs. No time, RNG, or non-deterministic ordering is
  permitted in rendering logic. (Attribute ordering, hydration markers,
  and Vue-internal comment nodes are explicitly out of the determinism
  contract — they are noise, not signal.)
- **No wall clock or randomness:** no component reads `Date.now()`,
  `performance.now()`, `Math.random()`, or any other non-deterministic
  source.
- **Store is inspectable:** the store exposes `snapshot` directly; no
  hidden caching layer, no memoized selectors. A future packet may add
  those explicitly when justified.
- **Fixture loader fails loudly:** the loader logs nothing in the happy
  path. Failures to read, parse, or type-validate a fixture produce a
  thrown `Error` with a full-sentence message that names both the
  fixture file (e.g., `'mid-turn.json'`) and the failure cause (e.g.,
  missing top-level key `players`).
- **Dev-only URL fixture selector:** when `import.meta.env.DEV === true`
  **and** a `?fixture=<name>` query parameter is present (`mid-turn` |
  `endgame-win` | `endgame-loss`), `main.ts` calls
  `loadUiStateFixture(name)` and populates the store before mounting.
  In production builds (`import.meta.env.DEV === false`), this behavior
  is compiled out via a dead-code-eliminated `if` branch guarded by the
  env check. Makes reproducible debugging a shareable URL:
  `http://localhost:5173/?fixture=mid-turn`. No UI dropdown, no extra
  component — strict plumbing only.
- **Sourcemaps:** dev always ships sourcemaps (Vite default). Build
  sourcemaps are enabled in `vite.config.ts` (`build.sourcemap: true`)
  so that first-time bootstrap failures are diagnosable; this can be
  revisited in a future packet once the app grows.
- **Explicit color tokens with documented contrast:** the base CSS
  defines named tokens with known-good contrast ratios, documented
  inline as comments (e.g., `--color-foreground: #111;` with
  `/* contrast 18.1:1 on --color-background #f9f9f9 */`). No hand-waved
  "AA compliant" claim — the ratios are written down.

---

## Scope (In)

### A) Package scaffold

- `apps/arena-client/package.json` — **new**. Name
  `@legendary-arena/arena-client`. Scripts: `dev`, `build`, `preview`,
  `test`, `typecheck`. Mark `private: true`. The `test` script uses
  direct `--import` CLI flags (no `NODE_OPTIONS`, no `cross-env`):
  `node --import tsx --import
  @legendary-arena/vue-sfc-loader/register --test
  src/**/*.test.ts`. Add `@legendary-arena/vue-sfc-loader` as a
  `devDependency` with `workspace:*` (never `dependencies` —
  anti-production-bundle rule). Pin `vue@^3.4.27` to match
  `apps/registry-viewer/` and the vue-sfc-loader peerDep pin
  (D-6502). No Jest, Vitest, or Mocha. No `cross-env`.
- `apps/arena-client/tsconfig.json` — **new**. Strict mode
  (`strict: true`, `exactOptionalPropertyTypes: true`,
  `noUncheckedIndexedAccess: true` — matching
  `packages/game-engine/tsconfig.json`). `resolveJsonModule: true`
  so the typed-fixture strategy in §C compiles. No repo-wide
  `tsconfig.base.json` exists; this file is self-contained.
- `apps/arena-client/vite.config.ts` — **new**. Vue plugin +
  `build.sourcemap: true`. No custom middleware.
- `apps/arena-client/index.html` — **new**. Single mount point `<div
  id="app">`. `<title>Legendary Arena</title>`.
- `apps/arena-client/src/main.ts` — **new**. Creates app, installs Pinia,
  mounts. **No routing** (preflight confirmed `apps/registry-viewer/`
  does not use `vue-router`). Includes the **dev-only `?fixture=` bootstrap**:
  before `app.mount()`, a single `if (import.meta.env.DEV)` branch parses
  `window.location.search`, validates the `fixture` name against the
  three known fixture names, and calls `loadUiStateFixture(name)` +
  `store.setSnapshot(...)`. The `if` branch is dead-code eliminated in
  production builds. `// why:` comment on the dev-branch explaining that
  URL-based fixture selection is the team's reproducible-bug-report
  mechanism. The dev branch also contains the dedicated DCE marker
  string `'__WP061_DEV_FIXTURE_HARNESS__'` (inside a
  `console.debug(...)` call or an assigned `const __marker = ...`)
  so the production-build verification grep targets this unique
  token rather than the fixture names (which survive minification
  through the JSON imports regardless of the dev branch). See
  §Acceptance Criteria §Dev Fixture Harness.

### B) Store

- `apps/arena-client/src/stores/uiState.ts` — **new**:
  - `import type { UIState } from '@legendary-arena/game-engine'`
  - Use `defineStore` (Options API shape preferred for clarity):
    - `state: (): { snapshot: UIState | null } => ({ snapshot: null })`
      — the return-type annotation on the `state` factory gives Pinia
      the typed shape without a `null as ...` cast.
    - `actions: { setSnapshot(next: UIState | null) { this.snapshot = next } }`
    - No `getters`.
  - Consumers read `store.snapshot` as plain reactive state — do NOT
    wrap it in `Ref<>` manually. Pinia reactivity is automatic via the
    `storeToRefs` helper (or template access) at the call site.
  - `// why:` comment: the store holds the current projection only;
    derived view state is future packets' responsibility.
  - `// why:` comment on the Options-API choice (if diverging from
    `apps/registry-viewer/` prior art): a single state field and a
    single action is easier to reason about in Options shape than Setup
    shape.

### C) Fixtures

- `apps/arena-client/src/fixtures/uiState/mid-turn.json` — **new**. Full,
  valid `UIState` mid-match: phase `'play'`, stage `'main'`, at least two
  players, non-empty city and HQ, scheme twist count > 0. **Omit the
  `gameOver` key entirely** (do not emit `"gameOver": null`) — see
  `exactOptionalPropertyTypes` note under Non-Negotiable Constraints.
- `apps/arena-client/src/fixtures/uiState/endgame-win.json` — **new**.
  Phase `'end'`, `gameOver.outcome === 'win'`, scores present.
- `apps/arena-client/src/fixtures/uiState/endgame-loss.json` — **new**.
  Phase `'end'`, `gameOver.outcome === 'loss'`, scores present.
- `apps/arena-client/src/fixtures/uiState/typed.ts` — **new**. The
  fixture type-guard layer:
  - `import type { UIState } from '@legendary-arena/game-engine'`
  - `import midTurnJson from './mid-turn.json'`
  - `import endgameWinJson from './endgame-win.json'`
  - `import endgameLossJson from './endgame-loss.json'`
  - Exports `export const midTurn = midTurnJson satisfies UIState;`
    (and the same for the other two). `satisfies` checks structural
    compatibility **without widening** the literal type — fixture drift
    becomes a compile error, not a runtime mystery.
  - `// why:` comment: `satisfies UIState` (never `as UIState`). A bare
    cast would mask drift; `satisfies` enforces the contract at the
    import site.
  - Requires `resolveJsonModule: true` in the nearest `tsconfig.json`
    (see Preflight).
- `apps/arena-client/src/fixtures/uiState/index.ts` — **new**. A single
  canonical loader that works in both Vite and test environments:
  - `import { midTurn, endgameWin, endgameLoss } from './typed'`
  - `export function loadUiStateFixture(name: FixtureName): UIState`
    where `FixtureName = 'mid-turn' | 'endgame-win' | 'endgame-loss'`
  - Implementation is a simple `switch` over the typed-module imports.
    **Do NOT branch on environment** (no `fs/promises` vs Vite
    `import` fork). The typed module provides a single code path.
  - Unknown `name` throws an `Error` with a full-sentence message
    listing the valid names.

### D) Probe component

- `apps/arena-client/src/components/BootstrapProbe.vue` — **new**:
  - Script-setup Composition API.
  - Reads `snapshot` from the store.
  - When `snapshot === null`, renders `<p aria-label="no snapshot
    loaded">No UIState loaded.</p>`.
  - Otherwise, renders `<p aria-label="current game phase">Phase: {{
    snapshot.game.phase }}</p>`.
  - `// why:` comment: this component is a wiring probe only; real HUD
    components arrive in the next UI packet.

### E) App root

- `apps/arena-client/src/App.vue` — **new**. Mounts `<BootstrapProbe />`.
  No additional markup beyond a `<main>` wrapper.

### F) Base styles

- `apps/arena-client/src/styles/base.css` — **new**. Minimal reset,
  `:root` color tokens (at least `--color-foreground`, `--color-background`,
  `--color-focus-ring`), base font stack, focus-ring styles. WCAG AA contrast
  for default token values in both `prefers-color-scheme: light` and
  `dark`. No component styling.

### G) Tests

- `apps/arena-client/src/testing/jsdom-setup.ts` — **new**. A single
  side-effect module that installs the jsdom globals
  `@vue/test-utils.mount()` needs under Vue 3.5.x + Node 22+.
  Exports nothing; callers `import './testing/jsdom-setup.ts'` at
  the top of any test file that mounts components. Injects
  `HTMLElement`, `Element`, `Node`, `SVGElement`, `MathMLElement`
  from `new JSDOM(...)`; assigns `navigator` via
  `Object.defineProperty(globalThis, 'navigator', { value, writable:
  true, configurable: true })` because Node 22+ makes
  `globalThis.navigator` a read-only getter. `// why:` comment on
  each global-injection block citing WP-065
  `packages/vue-sfc-loader/src/loader.test.ts` as the originating
  precedent.
- `apps/arena-client/src/stores/uiState.test.ts` — **new**:
  - `setSnapshot(fixture)` updates `snapshot`.
  - `setSnapshot(null)` clears it.
  - No `mount()` call — store tests do not need jsdom.
- `apps/arena-client/src/fixtures/uiState/index.test.ts` — **new**:
  - Each of the three fixtures loads and contains all required
    top-level `UIState` keys.
  - `endgame-win.json` has `gameOver.outcome === 'win'`.
  - `endgame-loss.json` has `gameOver.outcome === 'loss'`.
  - `mid-turn.json` has no `gameOver` **key** (tests `'gameOver'
    in fixture` is `false`, not `fixture.gameOver === undefined`).
- `apps/arena-client/src/components/BootstrapProbe.test.ts` — **new**:
  - First import: `import './testing/jsdom-setup.ts'` (load-bearing).
  - With no snapshot, renders the empty-state message.
  - With the `mid-turn` fixture loaded, renders a phase value matching the
    fixture.

---

## Out of Scope

- No HUD, scoreboard, player panels, or any match-specific UI — that is
  WP-062 (Arena HUD).
- No spectator-specific views — future spectator HUD WP.
- No log/replay inspector — WP-064.
- No replay snapshot production — WP-063.
- No lobby, match setup, or matchmaking UI — future WP.
- No networking: no WebSocket client, no boardgame.io client binding, no
  REST calls.
- No auth flow, no session handling, no cookies.
- No theming system beyond the base CSS tokens. No cosmetic skin support.
- No card images, tooltips, or registry access.
- No changes to `packages/game-engine/**`, `packages/registry/**`,
  `apps/server/**`, or `apps/registry-viewer/**`.
- Refactors, cleanups, or "while I'm here" improvements are out of scope
  unless explicitly listed in Scope (In).

---

## Files Expected to Change

- `apps/arena-client/package.json` — **new**
- `apps/arena-client/tsconfig.json` — **new**
- `apps/arena-client/vite.config.ts` — **new**
- `apps/arena-client/index.html` — **new**
- `apps/arena-client/src/main.ts` — **new**
- `apps/arena-client/src/App.vue` — **new**
- `apps/arena-client/src/stores/uiState.ts` — **new**
- `apps/arena-client/src/stores/uiState.test.ts` — **new**
- `apps/arena-client/src/fixtures/uiState/index.ts` — **new**
- `apps/arena-client/src/fixtures/uiState/index.test.ts` — **new**
- `apps/arena-client/src/fixtures/uiState/typed.ts` — **new** (imports
  each JSON fixture and applies `satisfies UIState`)
- `apps/arena-client/src/fixtures/uiState/mid-turn.json` — **new**
- `apps/arena-client/src/fixtures/uiState/endgame-win.json` — **new**
- `apps/arena-client/src/fixtures/uiState/endgame-loss.json` — **new**
- `apps/arena-client/src/components/BootstrapProbe.vue` — **new**
- `apps/arena-client/src/components/BootstrapProbe.test.ts` — **new**
- `apps/arena-client/src/testing/jsdom-setup.ts` — **new**
- `apps/arena-client/src/styles/base.css` — **new**
- Root `pnpm-workspace.yaml` — **modified** only if the new package is not
  already covered by an existing glob
- `docs/ai/STATUS.md` — **modified** (governance update per DoD)
- `docs/ai/DECISIONS.md` — **modified** (governance update per DoD)
- `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` — **modified** only if the
  Preflight PS-# resolution determines a new category row is needed
  for `apps/arena-client/`; any such modification requires a matching
  `D-NNNN` entry in `DECISIONS.md` per the P6-26 precedent (D-6501
  lineage)
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** (governance update
  per DoD)

No other files may be modified. `packages/game-engine/**`,
`packages/registry/**`, `packages/vue-sfc-loader/**`, `apps/server/**`,
and `apps/registry-viewer/**` must be untouched. **Per `01.4`
§Precedent Log P6-27 (new lesson from WP-065), any file beyond this
list is a scope violation, not a "minor additive deviation." If
execution discovers that a file genuinely outside this list is
required, stop and escalate to a pre-flight amendment (WP-031
A-031-01 precedent) rather than shipping it and minimizing it in the
execution summary.**

---

## Acceptance Criteria

### Scaffold
- [ ] `apps/arena-client/package.json` declares name
      `@legendary-arena/arena-client` and scripts `dev`, `build`,
      `preview`, `test`, `typecheck`.
- [ ] `pnpm --filter @legendary-arena/arena-client build` exits 0.
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0.
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0.

### Layer Boundary
- [ ] No runtime import of `@legendary-arena/game-engine` anywhere in
      `apps/arena-client/src/` (only `import type` permitted). Confirmed
      with `Select-String`.
- [ ] No import of `@legendary-arena/registry` anywhere in
      `apps/arena-client/src/`. Confirmed with `Select-String`.
- [ ] No import of `boardgame.io` anywhere in `apps/arena-client/src/`.
      Confirmed with `Select-String`.
- [ ] No `Math.random`, `Date.now`, or `performance.now` anywhere in
      `apps/arena-client/src/`. Confirmed with `Select-String`.

### Store
- [ ] `useUiStateStore()` exposes exactly one state field (`snapshot`)
      and exactly one action (`setSnapshot`). No getters. No additional
      state or actions.
- [ ] `snapshot` is typed as `UIState | null`.
- [ ] No source file wraps `snapshot` in `Ref<>` at the consumer side
      (confirmed by code review — Pinia reactivity is used as-is).

### Fixtures
- [ ] `fixtures/uiState/typed.ts` exists and applies
      `satisfies UIState` to each imported JSON fixture (confirmed with
      `Select-String` for `satisfies UIState` and absence of
      `as UIState`).
- [ ] No file in `fixtures/uiState/` contains a bare
      `as UIState` cast (confirmed with `Select-String`).
- [ ] All three fixtures compile (typecheck passes with
      `resolveJsonModule`).
- [ ] `endgame-win.json` and `endgame-loss.json` both include a `gameOver`
      block with the expected outcome.
- [ ] `mid-turn.json` does NOT contain a `gameOver` key at all
      (optional UIState fields are omitted under
      `exactOptionalPropertyTypes: true`; `"gameOver": null` fails
      `satisfies UIState`). Confirm via
      `Select-String -Path "apps/arena-client/src/fixtures/uiState/mid-turn.json" -Pattern "gameOver"`
      returning no matches.
- [ ] `loadUiStateFixture` has a single code path (no environment
      branching between Vite and Node).

### Probe
- [ ] `<BootstrapProbe />` renders the empty-state message when `snapshot
      === null`.
- [ ] `<BootstrapProbe />` renders the phase value when a fixture is
      loaded.
- [ ] Both states include explicit `aria-label` attributes.

### Dev Fixture Harness
- [ ] `main.ts` contains exactly one `if (import.meta.env.DEV)` branch
      that parses `?fixture=` from `window.location.search`.
- [ ] Unknown `fixture` names in the query string do NOT populate the
      store (silent no-op; no throw — invalid query strings must not
      crash dev).
- [ ] The dev branch contains the dedicated DCE marker string
      `'__WP061_DEV_FIXTURE_HARNESS__'` (inside a `console.debug`
      call or a `// why:` comment content accessible to the
      minifier — e.g., `const __marker = '__WP061_DEV_FIXTURE_HARNESS__';`).
      This marker is the target of the DCE verification grep.
      **Do NOT grep for the fixture names themselves** — the
      fixture JSON imports survive minification regardless of
      the dev branch, so name-grepping produces false positives.
- [ ] The dev branch is dead-code eliminated in production builds:
      `Select-String -Path "apps/arena-client/dist" -Pattern "__WP061_DEV_FIXTURE_HARNESS__" -Recurse`
      returns no matches.

### Base Styles & Accessibility
- [ ] `base.css` defines `--color-foreground`, `--color-background`,
      `--color-focus-ring` with explicit contrast ratio comments
      (numeric, not "AA compliant").
- [ ] Both light and dark `prefers-color-scheme` blocks define the same
      token set with their own documented ratios.

### Scope Enforcement
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`).
- [ ] `packages/game-engine/**` is untouched.

---

## Verification Steps

```pwsh
# Step 1 — install and build
pnpm install
pnpm --filter @legendary-arena/arena-client build
# Expected: exits 0

# Step 2 — typecheck
pnpm --filter @legendary-arena/arena-client typecheck
# Expected: exits 0

# Step 3 — run tests
pnpm --filter @legendary-arena/arena-client test
# Expected: all tests passing

# Step 4 — confirm no engine runtime import
Select-String -Path "apps/arena-client/src" -Pattern "from '@legendary-arena/game-engine'" -Recurse | Where-Object { $_.Line -notmatch "import type" }
# Expected: no output

# Step 5 — confirm no registry or boardgame.io import
Select-String -Path "apps/arena-client/src" -Pattern "@legendary-arena/registry|boardgame.io" -Recurse
# Expected: no output

# Step 6 — confirm no wall-clock or RNG
Select-String -Path "apps/arena-client/src" -Pattern "Math\.random|Date\.now|performance\.now" -Recurse
# Expected: no output

# Step 7 — confirm no bare `as UIState` cast in fixtures (only `satisfies`)
Select-String -Path "apps/arena-client/src/fixtures/uiState" -Pattern "as UIState" -Recurse
# Expected: no output

# Step 8 — confirm typed.ts uses `satisfies UIState`
Select-String -Path "apps/arena-client/src/fixtures/uiState/typed.ts" -Pattern "satisfies UIState"
# Expected: at least three matches (one per fixture)

# Step 9 — confirm dev fixture harness is behind import.meta.env.DEV
Select-String -Path "apps/arena-client/src/main.ts" -Pattern "import\.meta\.env\.DEV"
# Expected: at least one match

# Step 10 — confirm mid-turn fixture omits gameOver key
Select-String -Path "apps/arena-client/src/fixtures/uiState/mid-turn.json" -Pattern "gameOver"
# Expected: no output (optional UIState fields are omitted, not set to null)

# Step 11 — confirm DCE marker exists in dev source
Select-String -Path "apps/arena-client/src/main.ts" -Pattern "__WP061_DEV_FIXTURE_HARNESS__"
# Expected: at least one match

# Step 12 — confirm DCE marker is stripped from production build
pnpm --filter @legendary-arena/arena-client build
Select-String -Path "apps/arena-client/dist" -Pattern "__WP061_DEV_FIXTURE_HARNESS__" -Recurse
# Expected: no output (dev branch is dead-code eliminated)

# Step 13 — confirm jsdom-setup.ts is imported by every component test
Select-String -Path "apps/arena-client/src/components" -Pattern "from '.+/testing/jsdom-setup" -Recurse
# Expected: at least one match per *.test.ts that calls mount()

# Step 14 — confirm engine, server, registry-viewer, and vue-sfc-loader untouched
git diff --name-only packages/game-engine/ packages/registry/ packages/vue-sfc-loader/ apps/server/ apps/registry-viewer/
# Expected: no output

# Step 15 — confirm only expected files changed
git diff --name-only
# Expected: only files listed in ## Files Expected to Change
```

---

## Definition of Done

- [ ] Preflight section items all resolved (test runner, TS JSON
      typing, workspace naming, routing convention, sourcemap convention).
- [ ] All acceptance criteria above pass.
- [ ] `pnpm --filter @legendary-arena/arena-client build` exits 0.
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0.
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0.
- [ ] No runtime import of `@legendary-arena/game-engine`, registry, or
      `boardgame.io` in `apps/arena-client/`.
- [ ] No wall-clock or `Math.random` use in `apps/arena-client/`.
- [ ] No `as UIState` cast in `fixtures/uiState/` — only `satisfies`.
- [ ] Dev-only `?fixture=` harness is behind `import.meta.env.DEV` and
      is stripped from production builds.
- [ ] `packages/game-engine/**`, `packages/registry/**`, `apps/server/**`,
      `apps/registry-viewer/**` untouched.
- [ ] `docs/ai/STATUS.md` updated — a Vue 3 client skeleton now exists
      and consumes committed `UIState` fixtures; no live match wiring yet.
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: chosen test runner +
      SFC transform (match or diverge from `apps/registry-viewer/`);
      fixture validation approach (`satisfies` + `resolveJsonModule` vs
      Zod fallback); decision to omit routing in the bootstrap; decision
      to enable build sourcemaps.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-061 checked off with
      today's date and a note linking this file.
- [ ] Commit uses the `EC-067:` prefix (NOT `EC-061:` — that slot is
      historically bound to the registry-viewer Rules Glossary
      panel). See `docs/ai/execution-checklists/EC-067-gameplay-client-bootstrap.checklist.md`.
- [ ] **01.6 post-mortem is MANDATORY for this WP.** Three triggering
      criteria apply per `01.6` §When Post-Mortem Is Required: (1)
      new contract consumed by future WPs (`useUiStateStore()`
      shape, `loadUiStateFixture` signature, `FixtureName` union,
      dev `?fixture=` URL convention); (2) new long-lived
      abstraction (the UI store pattern every subsequent UI WP
      inherits); (3) new code category directory
      (`apps/arena-client/` as the first gameplay client app).
      Precedent: WP-065 P6-28. The session prompt generated for
      this WP **must not** soften post-mortem to "recommended" —
      01.6's mandatoriness rules override session-prompt language.
- [ ] **Session prompt includes `### Runtime Wiring Allowance — NOT
      INVOKED`** section with the four 01.5 trigger criteria
      enumerated and marked absent, citing 01.5 §Escalation.
      Precedent: WP-030 / WP-065 P6-10. WP-061 is purely additive
      at the engine layer (no new `LegendaryGameState` field, no
      `buildInitialGameState` shape change, no new
      `LegendaryGame.moves` entry, no new phase hook) so the
      declaration is factual and bounds the scope lock.
- [ ] If PS-# code-category resolution was required during
      pre-flight (per P6-26 / the Preflight bullet above), a
      `D-NNNN — Client app classification for apps/arena-client/`
      entry exists in `DECISIONS.md` and a matching row exists in
      `02-CODE-CATEGORIES.md`.
