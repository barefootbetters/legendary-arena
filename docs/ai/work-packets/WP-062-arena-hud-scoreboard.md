# WP-062 — Arena HUD & Scoreboard (Client Projection View)

**Status:** Ready
**Primary Layer:** Client UI (Vue 3 SPA — `apps/arena-client/`)
**Dependencies:** WP-061 (gameplay client bootstrap), WP-028 (UIState),
WP-029 (spectator view model — confirms HUD-visible subset), WP-048 (PAR
scoring — fields surfaced by the HUD)

---

## Session Context

WP-028 locked `UIState` as the sole engine→UI projection. WP-029 added
permission-filtered spectator views at the type level. WP-048 defined PAR
and the scoring fields whose live deltas the HUD surfaces. WP-061
(bootstrap) provides the Vue 3 SPA skeleton, the Pinia store holding the
current `UIState`, and committed fixtures for deterministic rendering.
This packet adds the first on-screen presentation of those projections: a
fixed (non-floating) HUD rendering turn/phase state, per-player zone
counts, shared counters (bystanders rescued, escapes, scheme twists,
mastermind tactics), and live PAR delta. No engine changes. No windowing.
No theming system.

---

## Goal

After this session, `apps/arena-client/` renders an `<ArenaHud />` Vue 3
component tree that subscribes to a `UIState` snapshot (Pinia store, from
WP-061) and displays: (1) a turn/phase/stage banner, (2) a per-player
panel showing the active player and zone counts from `UIPlayerState`,
(3) a shared-state scoreboard (bystanders rescued, escaped villains,
scheme twists, mastermind tactics remaining/defeated), (4) a live PAR
delta readout, and (5) an endgame summary panel driven by
`UIGameOverState`. The HUD never reads `G`, never imports from
`@legendary-arena/game-engine` runtime, and is fully testable against the
committed `UIState` fixtures from WP-061.

---

## Assumes

- WP-061 (gameplay client bootstrap) complete. Specifically:
  - `apps/arena-client/` is a working Vue 3 + Pinia + Vite SPA
  - `useUiStateStore()` exposes `snapshot: Ref<UIState | null>` and
    `setSnapshot(next)`
  - `loadUiStateFixture(name)` and at least three `UIState` fixtures
    (`mid-turn`, `endgame-win`, `endgame-loss`) are committed
- WP-028 complete: `UIState`, `UIPlayerState`, `UICityState`, `UIHQState`,
  `UIMastermindState`, `UISchemeState`, `UITurnEconomyState`,
  `UIGameOverState` are exported from `@legendary-arena/game-engine` as
  types
- WP-029 complete: spectator-filtered `UIState` shape is confirmed
  identical at the HUD-visible subset (no HUD-breaking gaps)
- WP-048 complete: scoring fields (at minimum `rawScore`, `parBaseline`,
  `finalScore`) are available on `UIGameOverState`, and any live-score
  field — if present during `phase === 'play'` — has a documented name
- `pnpm --filter @legendary-arena/arena-client build` exits 0
- `pnpm --filter @legendary-arena/arena-client test` exits 0

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — UI consumes
  projections only; no runtime engine import from a client app
- `docs/ai/ARCHITECTURE.md — MVP Gameplay Invariants` — `UIState` is the
  only state the UI sees
- `docs/01-VISION.md §Primary Goal 3 (Player Trust & Fairness)` — the HUD
  must display exactly what the engine reports; no derived or inferred
  values
- `docs/01-VISION.md §17 Accessibility & Inclusivity` — keyboard
  navigation, screen-reader labels, high-contrast mode, color-blind-safe
  indicators
- `docs/01-VISION.md §20–26 PAR scoring` — the HUD is the primary surface
  for PAR delta; presentation must preserve determinism (no interpolated
  or estimated values)
- `docs/01-VISION.md §Heroic Values in Scoring` — bystanders rescued is
  the strongest positive action; the HUD must visually emphasize it
  relative to penalty counters
- `docs/ai/DECISIONS.md D-0301` — UI consumes projections only
- `docs/ai/DECISIONS.md D-0302` — single UIState, multiple audiences
- `docs/ai/work-packets/WP-028-ui-state-contract-authoritative-view-model.md`
  — exact shape of every projection field
- `docs/ai/work-packets/WP-029-spectator-permissions-view-models.md` —
  HUD-visible subset equivalence
- `docs/ai/work-packets/WP-048-par-scenario-scoring-leaderboards.md` —
  PAR field names on `UIGameOverState`
- `docs/ai/work-packets/WP-061-gameplay-client-bootstrap.md` — the store
  and fixture conventions this packet relies on
- `apps/registry-viewer/CLAUDE.md` — prior-art Vue 3 SPA conventions used
  in this repo (Composition API, no barrel re-exports, flat component
  folder)
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 4 (no abbreviations),
  Rule 6 (`// why:` comments), Rule 13 (ESM only), Rule 14 (field names
  match the data contract verbatim — do NOT rename `bystandersRescued` to
  `rescued`, etc.)

---

## Preflight (Must Pass Before Coding)

WP-061 is the authoritative source for the client app's toolchain. This
packet inherits — never re-decides — the following choices already
locked by WP-061. Confirm each is in place before writing HUD code. Any
item below that returns a different answer than WP-061 is a **blocker**.

- **SFC transform pipeline:** the `node:test` + SFC transform pipeline
  WP-061 established must be in place and working. Do NOT invent a
  second transform for HUD component tests. Vitest, Jest, and Mocha
  are forbidden project-wide (lint §7, §12). If HUD tests require
  configuration not covered by WP-061's setup, raise a DECISIONS.md
  entry before coding.
- **Propagate WP-061's test-runner decision inline:** before writing
  HUD components, locate the `DECISIONS.md` entry WP-061 produced
  naming the exact SFC transform mechanism (loader hook, ESBuild/SWC
  register, pre-compile step, etc.) and paste a one-line summary into
  this packet's Session Context as an in-session amendment. Future
  readers should not have to cross-reference WP-061's commit history
  to know which transform this packet relied on.
- **Pinia store shape:** WP-061 exposes exactly one state field
  (`snapshot`) and one action (`setSnapshot`). This packet reads
  `store.snapshot` directly. It MUST NOT add getters, additional state,
  or additional actions to the store (that would violate WP-061's
  Scope Enforcement).
- **Fixture availability:** WP-061 committed `mid-turn.json`,
  `endgame-win.json`, `endgame-loss.json` under
  `apps/arena-client/src/fixtures/uiState/`, validated via
  `satisfies UIState` in `typed.ts`. HUD tests use those same fixtures
  through `loadUiStateFixture()` — do NOT duplicate fixtures or
  introduce new ones in this packet (new fixtures would need a WP of
  their own).
- **WP-048 scoring fields on `UIGameOverState`:** before rendering the
  PAR delta readout, confirm the exact field names
  (`rawScore`, `parBaseline`, `finalScore`, or any live-score field
  applicable during `phase === 'play'`) by reading the current engine
  source, not by assumption. If the field names differ from what this
  packet documents, stop and ask.
- **Spectator-HUD parity (WP-029):** confirm the HUD-visible subset of
  `UIState` is identical for `audience === 'player'` and
  `audience === 'spectator'` at the fields this HUD renders. If a field
  is hidden from spectators, the HUD must render the same em-dash
  fallback it uses for absent optional fields — do NOT special-case.

If any item returns a different answer than expected, **stop and ask**
before writing a single component.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never import `@legendary-arena/game-engine` at runtime from any file in
  `apps/arena-client/src/components/hud/` — `import type` only
- Never import `@legendary-arena/registry` at runtime from this packet's
  files
- Never mutate the `UIState` snapshot received from the store — treat as
  readonly in all components
- Never use `Math.random()`, `Date.now()`, or `performance.now()` in any
  HUD source file
- No database, network, or filesystem access from any component
- ESM only, Node v22+; `node:` prefix on built-ins
- Test files use `.test.ts` extension — tests run under the **same SFC
  transform pipeline WP-061 established**; this packet does not create
  or modify a second transform
- Full file contents for every new or modified file. No diffs, no
  snippets, no "show only the changed section" output.
- **Forbidden dependencies (lint §7):** no `axios`, no `node-fetch`
  (use Node's built-in `fetch`); no ORMs; no `Jest`, no `Vitest`, no
  `Mocha` — only `node:test`; no `passport`, no `auth0`, no `clerk`.
  Any new dependency requires a DECISIONS.md justification and the
  full updated `package.json` in the output.
- Do not modify WP-061 outputs (`src/stores/uiState.ts`, `src/main.ts`,
  `src/fixtures/`) unless a concrete reason is documented in
  DECISIONS.md and the Files Expected to Change list reflects the edit

**Packet-specific:**
- The HUD is **stateless** beyond local view state (panel collapsed flags,
  keyboard focus). All game data flows from the Pinia store.
- No computed value in the HUD may re-derive a field the engine already
  provides. If `UITurnEconomyState.availableAttack` exists, never compute
  it from `attack` minus spent amounts client-side.
- Every user-visible number must render an explicit `aria-label`
  reflecting the field name from `UIState` (SG-17).
- PAR delta renders **exactly** `UIGameOverState.finalScore` or the live
  equivalent — no rounding, no client-side formula, no "estimated"
  suffix. If the field is absent, render an em-dash, not zero.
- No `team` vocabulary anywhere. Use `player`, `activePlayer`,
  `playerColor`.
- No `.reduce()` in rendering logic — use `v-for` with explicit named
  `computed` accumulators.
- No registry HTTP calls from within HUD components — card display data
  arrives via `UIState` projections; fuller card lookup is a separate
  composable out of scope here.
- Color choices must pass WCAG AA contrast in both light and dark modes;
  indicator state must not rely on color alone (icon + color).
- The "bystanders rescued" counter must be visually prominent relative to
  penalty counters, per Vision §Heroic Values in Scoring.

**Session protocol:**
- If any `UIState` field is unclear or apparently missing, stop and ask
  before inventing a client-side fallback.

**Locked contract values:**

- **UIState top-level keys:** `game`, `players`, `city`, `hq`,
  `mastermind`, `scheme`, `economy`, `log`, `gameOver?`
- **UIPlayerState fields:** `playerId`, `deckCount`, `handCount`,
  `discardCount`, `inPlayCount`, `victoryCount`, `woundCount`
- **Shared scoreboard counters (surfaced via UIState):** bystanders
  rescued, escaped villains, scheme twists, mastermind tactics remaining,
  mastermind tactics defeated
- **Phase names:** `'lobby' | 'setup' | 'play' | 'end'`
- **TurnStage values:** `'start' | 'main' | 'cleanup'`

---

## Debuggability & Diagnostics

- Each HUD component accepts the relevant `UIState` sub-slice as a prop
  in addition to reading from the store, so test-only rendering with a
  fixture requires no store setup.
- Every component renders stable `data-testid` attributes on significant
  subtrees: `arena-hud-banner`, `arena-hud-player-panel-list`,
  `arena-hud-player-panel`, `arena-hud-scoreboard`, `arena-hud-par-delta`,
  `arena-hud-endgame`.
- No component reads `Date.now()`, `performance.now()`, `Math.random()`,
  or `window.location` for game-relevant state.
- **Deterministic visible output:** given an identical `UIState` fixture,
  rendered **visible text content and `aria-label`-ed elements** are
  stable across runs. Attribute ordering, Vue-internal comment nodes,
  and hydration markers are noise — not part of the determinism
  contract.
- **Sourcemaps:** inherit WP-061's sourcemap setup (dev + build). Do
  not disable sourcemaps to "reduce bundle size" in this packet.
- **HUD color tokens carry explicit contrast ratios:** every token
  defined or used by HUD components has a numeric contrast ratio
  documented inline (e.g., `/* 7.2:1 on --color-background */`). No
  "AA compliant" hand-wave. The color-blind-safe palette values must
  be committed with source references (WebAIM contrast checker or
  equivalent) in DECISIONS.md.
- **Reproducible bug reports:** when a HUD bug is reported, the report
  must be reproducible by opening `?fixture=<name>` in dev (from WP-061)
  or by loading the same fixture in a test file. No "works on my
  machine" debugging — if it cannot be reproduced from a fixture, the
  bug is in fixture coverage, not the HUD.

---

## Scope (In)

### A) HUD root
- `apps/arena-client/src/components/hud/ArenaHud.vue` — **new**
  - Composes: `<TurnPhaseBanner />`, `<SharedScoreboard />`,
    `<ParDeltaReadout />`, `<PlayerPanelList />`,
    `<EndgameSummary v-if="snapshot.gameOver" />`
  - Reads from `useUiStateStore()` only
  - Renders `null` when `snapshot === null`

### B) Turn / phase banner
- `apps/arena-client/src/components/hud/TurnPhaseBanner.vue` — **new**
  - Displays `snapshot.game.phase`, `snapshot.game.turn`,
    `snapshot.game.currentStage`, highlights
    `snapshot.game.activePlayerId`
  - `aria-live="polite"` on phase/stage changes
  - `// why:` comment on the aria-live choice

### C) Shared scoreboard
- `apps/arena-client/src/components/hud/SharedScoreboard.vue` — **new**
  - Four counters: bystanders rescued (visually emphasized), escaped
    villains, scheme twists, mastermind tactics (remaining and defeated
    rendered as two distinct numbers)
  - Counter labels match exact field names from `UIState`
  - `// why:` comment on the bystanders-rescued visual emphasis
    (Vision §Heroic Values in Scoring)

### D) PAR delta readout
- `apps/arena-client/src/components/hud/ParDeltaReadout.vue` — **new**
  - Renders `finalScore` if `snapshot.gameOver` is present, otherwise the
    live PAR-delta field specified by WP-048 (or em-dash if absent)
  - Sign convention: negative = under PAR (green + "▼" icon), positive =
    over PAR (amber + "▲" icon), zero = neutral
  - Never renders a computed or smoothed value
  - `// why:` comment: no client-side math permitted here

### E) Player panels
- `apps/arena-client/src/components/hud/PlayerPanelList.vue` — **new** —
  iterates `snapshot.players` with a stable `:key="player.playerId"`
- `apps/arena-client/src/components/hud/PlayerPanel.vue` — **new** —
  displays the seven `UIPlayerState` fields, highlights the active player
  via `aria-current="true"`

### F) Endgame summary
- `apps/arena-client/src/components/hud/EndgameSummary.vue` — **new**
  - Displays `UIGameOverState.outcome`, `reason`, and `scores` (if
    present)
  - Renders PAR baseline, raw score, and final score as three distinct
    labeled values

### G) Accessibility + color utility
- `apps/arena-client/src/components/hud/hudColors.ts` — **new**
  - Exports `playerColorStyles(playerId: string): { background: string;
    foreground: string; icon: string }`
  - Uses a fixed color-blind-safe palette; the icon differentiator is
    mandatory so color is never the sole signal

### H) Tests (`node:test` + jsdom, matching WP-061's test runner choice)
- `apps/arena-client/src/components/hud/ArenaHud.test.ts` — renders
  nothing when snapshot is null; renders all five subtrees when a full
  fixture is loaded; endgame subtree absent when `gameOver` is undefined
- `apps/arena-client/src/components/hud/SharedScoreboard.test.ts` —
  counters render exactly the values in the fixture, no rounding; the
  bystanders-rescued counter has a higher visual-weight class than penalty
  counters (assert via `data-emphasis="primary"` attribute or
  equivalent)
- `apps/arena-client/src/components/hud/ParDeltaReadout.test.ts` —
  negative, zero, positive, and missing-field branches each render the
  documented icon + aria-label; no computed/derived value ever appears
- `apps/arena-client/src/components/hud/PlayerPanel.test.ts` — the seven
  zone fields render; active player gets `aria-current="true"`
- `apps/arena-client/src/components/hud/TurnPhaseBanner.test.ts` — phase,
  turn, stage, and active-player highlight all render from the fixture
- Drift test: imports `UIState` as a type and assigns a full fixture to
  it — fails to typecheck if any locked field is renamed or dropped
  upstream

---

## Out of Scope

- Floating, draggable, or z-order-managed windows — permanently dropped
  (design decision — vision misalignment, see session memory)
- Theming system (team colors, arena branding, skinnable CSS) — deferred
  to a future monetization / cosmetic WP
- Spectator-specific HUD layout or permission filtering — future
  spectator-HUD WP (consumes WP-029 projection)
- Game log panel rendering — WP-064
- Replay stepping or inspector controls — WP-064
- Live networking / WebSocket wiring — belongs to a future client-runtime
  WP and WP-032 integration
- Real-time visual effects beyond a single CSS transition on counter
  change
- Card image rendering, tooltips, or registry lookups
- Any engine-side change. `packages/game-engine/**` must not be modified
- Refactors, cleanups, or "while I'm here" improvements

---

## Files Expected to Change

- `apps/arena-client/src/components/hud/ArenaHud.vue` — **new**
- `apps/arena-client/src/components/hud/TurnPhaseBanner.vue` — **new**
- `apps/arena-client/src/components/hud/SharedScoreboard.vue` — **new**
- `apps/arena-client/src/components/hud/ParDeltaReadout.vue` — **new**
- `apps/arena-client/src/components/hud/PlayerPanelList.vue` — **new**
- `apps/arena-client/src/components/hud/PlayerPanel.vue` — **new**
- `apps/arena-client/src/components/hud/EndgameSummary.vue` — **new**
- `apps/arena-client/src/components/hud/hudColors.ts` — **new**
- `apps/arena-client/src/components/hud/ArenaHud.test.ts` — **new**
- `apps/arena-client/src/components/hud/TurnPhaseBanner.test.ts` —
  **new**
- `apps/arena-client/src/components/hud/SharedScoreboard.test.ts` —
  **new**
- `apps/arena-client/src/components/hud/ParDeltaReadout.test.ts` —
  **new**
- `apps/arena-client/src/components/hud/PlayerPanel.test.ts` — **new**
- `apps/arena-client/src/App.vue` — **modified** — mount `<ArenaHud />`
  in place of (or alongside) the WP-061 `<BootstrapProbe />`
- `apps/arena-client/src/stores/uiState.ts` — **modified** only if this
  packet needs an additional read-side accessor that WP-061 did not
  expose. If any modification is made, document why in DECISIONS.md.
- `docs/ai/STATUS.md` — **modified** (governance update per DoD)
- `docs/ai/DECISIONS.md` — **modified** (governance update per DoD —
  contrast ratio sources, any deviation from WP-061 conventions)
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** (governance update
  per DoD)

No other files may be modified. `packages/game-engine/**`,
`packages/registry/**`, `apps/server/**`, and `apps/registry-viewer/**`
must be untouched.

---

## Acceptance Criteria

### Layer Boundary
- [ ] No file under `apps/arena-client/src/components/hud/` imports
      `@legendary-arena/game-engine` at runtime (only `import type`
      permitted; confirmed with `Select-String`)
- [ ] No file under `apps/arena-client/src/components/hud/` imports
      `@legendary-arena/registry`
- [ ] No file under `apps/arena-client/src/components/hud/` mutates any
      prop it receives

### Projection Fidelity
- [ ] Every number rendered in the HUD traces directly to a `UIState`
      field — no client-side arithmetic on game-relevant values
- [ ] PAR delta renders an em-dash when the field is absent; never a zero
- [ ] The "bystanders rescued" counter is visually prominent relative to
      penalty counters (documented style rule + asserted in a test)

### Accessibility (SG-17)
- [ ] Every counter has an explicit `aria-label` using the literal field
      name
- [ ] Active player indicator uses `aria-current="true"` and an icon, not
      color alone
- [ ] All text passes WCAG AA contrast in both light and dark modes
      (confirmed via automated tooling or manual check documented in
      DECISIONS.md)

### Determinism
- [ ] Given a fixture `UIState`, rendered **visible text and
      `aria-label`-ed elements** are stable across runs (snapshot test
      asserts textContent + a11y tree; it does NOT snapshot raw
      innerHTML).
- [ ] No component reads `Date.now()`, `performance.now()`,
      `Math.random()`, or `window.location` (confirmed with
      `Select-String`).

### Tests
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0
- [ ] Every HUD component has at least one rendering test
- [ ] No test imports `boardgame.io` or any engine runtime module

### Scope Enforcement
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `packages/game-engine/**` is untouched

---

## Verification Steps

```pwsh
# Step 1 — build
pnpm --filter @legendary-arena/arena-client build
# Expected: exits 0

# Step 2 — run all tests
pnpm --filter @legendary-arena/arena-client test
# Expected: all tests passing

# Step 3 — confirm no engine runtime import
Select-String -Path "apps/arena-client/src/components/hud" -Pattern "from '@legendary-arena/game-engine'" -Recurse | Where-Object { $_.Line -notmatch "import type" }
# Expected: no output

# Step 4 — confirm no wall-clock or RNG
Select-String -Path "apps/arena-client/src/components/hud" -Pattern "Math\.random|Date\.now|performance\.now" -Recurse
# Expected: no output

# Step 5 — confirm no .reduce in rendering
Select-String -Path "apps/arena-client/src/components/hud" -Pattern "\.reduce\(" -Recurse
# Expected: no output

# Step 6 — confirm no "team" vocabulary
Select-String -Path "apps/arena-client/src/components/hud" -Pattern "\bteam\b" -Recurse
# Expected: no output (Legendary is cooperative, not team-based)

# Step 7 — confirm engine package untouched
git diff --name-only packages/game-engine/
# Expected: no output

# Step 8 — confirm only expected files changed
git diff --name-only
# Expected: only files listed in ## Files Expected to Change
```

---

## Definition of Done

- [ ] Preflight items all resolved (SFC transform present, Pinia store
      shape matches WP-061, WP-061 fixtures loadable, WP-048 field names
      verified, spectator parity confirmed for rendered fields).
- [ ] All acceptance criteria above pass
- [ ] `pnpm --filter @legendary-arena/arena-client build` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0
- [ ] No runtime import of `@legendary-arena/game-engine` or registry in
      any HUD file
- [ ] No `Math.random`, `Date.now`, or `performance.now` in any HUD file
- [ ] No `team` vocabulary anywhere in HUD source
- [ ] `packages/game-engine/**` untouched
- [ ] No files outside `## Files Expected to Change` were modified
- [ ] `docs/ai/STATUS.md` updated — the arena client renders a full HUD
      driven by `UIState` fixtures; wiring to live match state remains
      open
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why PAR delta renders
      em-dash instead of zero when absent; the color-blind-safe palette
      choice; the "no client-side arithmetic on game values" rule; the
      bystanders-rescued emphasis rule
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-062 checked off with
      today's date
