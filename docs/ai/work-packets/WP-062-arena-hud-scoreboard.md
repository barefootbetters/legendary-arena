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

- WP-061 (gameplay client bootstrap) complete (commit 2e68530 on main).
  Specifically:
  - `apps/arena-client/` is a working Vue 3 + Pinia + Vite SPA
  - `useUiStateStore()` returns a Pinia Options API store instance where
    `snapshot: UIState | null` is a **reactive state field** (NOT a `Ref`)
    and `setSnapshot(next: UIState | null)` is the single action.
    **Correct access patterns inside components:**
    - Template auto-unwrap: `store.snapshot.game.phase` (works directly).
    - Script-side Ref wrapping: `const { snapshot } = storeToRefs(store)`
      then `snapshot.value` in script scope.
    - Plain destructuring `const { snapshot } = store` **breaks reactivity**
      — do not use. (An earlier draft of this WP said
      `snapshot: Ref<UIState | null>`; that was wrong and has been
      corrected here per WP-061 execution.)
  - `loadUiStateFixture(name)` and three `UIState` fixtures (`mid-turn`,
    `endgame-win`, `endgame-loss`) are committed; `isFixtureName(candidate)`
    is a type guard over the `FixtureName` union
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

> **Blocking findings propagated from WP-061 execution (2026-04-17).**
> The four items marked **BLOCKER (WP-061 session)** below must be
> resolved by explicit pre-flight action before this WP can return
> READY. They were discovered when the WP-061 executor audited the
> WP-062 spec against actual engine surface and committed code. Do
> not skip them — each one will cause WP-062 to stall mid-session.
>
> 1. **BLOCKER — WP-048 dependency unsatisfied.** WP-062 lists WP-048
>    (PAR Scenario Scoring & Leaderboards) as a dependency. WP-048 is
>    still Draft (WORK_INDEX.md:736). Pre-flight returns BLOCKED until
>    WP-048 ships, OR this WP is descoped to drop the PAR-delta readout
>    (§Scope (In) D and related tests).
> 2. **BLOCKER — WP-048 explicitly produces no UI projection.**
>    WP-048 §Out of Scope states "No UI changes — scoring produces data,
>    not display." WP-048 emits `ScoreBreakdown.{rawScore, parScore,
>    finalScore}` inside `LeaderboardEntry`, NOT on `UIGameOverState`.
>    Therefore even after WP-048 ships, this WP cannot consume its
>    fields directly. A missing intermediate WP ("Project ScoreBreakdown
>    + live progress counters into `UIState` / `UIGameOverState`") must
>    be drafted and executed between WP-048 and this one.
> 3. **BLOCKER — Several asserted field names do not exist in today's
>    engine.** `bystandersRescued`, `escapedVillains`, `schemeTwists`,
>    `mastermindTacticsRemaining`, `mastermindTacticsDefeated`,
>    `finalScore`, `parBaseline`, `rawScore` — none of these appear on
>    any current UIState sub-type. Closest siblings under different
>    names: `UISchemeState.twistCount`, `UIMastermindState.tacticsRemaining`,
>    `UIMastermindState.tacticsDefeated`, `FinalScoreSummary.winner`,
>    `PlayerScoreBreakdown.totalVP`. `bystandersRescued` and
>    `escapedVillains` have no engine home at all. Pre-flight must either
>    (a) rewrite the aria-label assertions to match the actual engine
>    names, or (b) depend on the intermediate UIState-extension WP in #2.
> 4. **BLOCKER — `base.css` is not in §Files Expected to Change, but
>    HUD colour tokens require extension.** `base.css` defines
>    `--color-foreground`, `--color-background`, `--color-focus-ring`
>    only (per D-6515). The HUD needs tokens for emphasis, penalty,
>    active-player highlight, PAR-delta positive / negative — see §H)
>    below. Pre-flight must either (a) add
>    `apps/arena-client/src/styles/base.css` to §Files Expected to
>    Change with a DECISIONS.md justification, or (b) explicitly route
>    HUD tokens through scoped `<style>` blocks in each component (loses
>    `prefers-color-scheme` discipline across the HUD as a whole).
>
> **Additional WP-061 lessons that apply to this WP** (non-blocking but
> execution-critical — see `docs/ai/REFERENCE/01.4-pre-flight-invocation.md`
> §Precedent Log for details):
>
> - **P6-30** — `ArenaHud.vue` has setup-scope bindings
>   (`storeToRefs(store).snapshot`) in its template AND ships with a
>   `node:test` test. Under `@legendary-arena/vue-sfc-loader`'s
>   separate-compile pipeline (`inlineTemplate: false`), `<script setup>`
>   top-level bindings are not exposed on the template's `_ctx`.
>   **`ArenaHud.vue` MUST use the
>   `defineComponent({ setup() { return { … } } })` form**, not
>   `<script setup>` sugar. The six props-only subcomponents
>   (TurnPhaseBanner, SharedScoreboard, ParDeltaReadout, PlayerPanelList,
>   PlayerPanel, EndgameSummary) may freely use `<script setup>` — props
>   reach `_ctx` via `$props` (proven by WP-065's `hello.vue` fixture).
>   See D-6512.
> - **P6-31** — DCE-marker absence checks in WPs that enable sourcemaps
>   must target `dist/assets/*.js`, not `dist/**`. If this WP adds any
>   new dev-only URL harness with a DCE marker, the Step 12 verification
>   command must use the narrower glob from the start. See D-6513.
> - **jsdom-setup import path** — WP-061's `BootstrapProbe.test.ts` at
>   `src/components/*.test.ts` imports `'../testing/jsdom-setup'`
>   (1 level up). WP-062 HUD tests at `src/components/hud/*.test.ts`
>   must import `'../../testing/jsdom-setup'` (2 levels up). Every
>   `mount()`-using HUD test must have this import as its **first
>   line** — load-bearing because `@vue/runtime-dom.resolveRootNamespace`
>   probes `SVGElement` at `app.mount()` under Vue 3.5.x (resolved
>   against the `^3.4.27` peer pin).
> - **Test script composition** — inherit WP-061's unchanged:
>   `node --import tsx --import @legendary-arena/vue-sfc-loader/register
>   --test src/**/*.test.ts` (D-6517). The glob already covers
>   `src/components/hud/*.test.ts`. No `NODE_OPTIONS`, no `cross-env`.
> - **EC slot** — EC-062 may be historically bound (the 060-series has
>   this risk; EC-061 was bound to the registry-viewer Rules Glossary
>   panel and WP-061 therefore used EC-067). Pre-flight must choose the
>   slot explicitly and triple-cross-reference WP header + EC header +
>   commit lineage, following the WP-061 / EC-067 precedent.

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
- **Container / presenter split (strict):** only `<ArenaHud />` reads from
  `useUiStateStore()`. Every subcomponent (`<TurnPhaseBanner />`,
  `<SharedScoreboard />`, `<ParDeltaReadout />`, `<PlayerPanelList />`,
  `<PlayerPanel />`, `<EndgameSummary />`) receives its relevant
  `UIState` sub-slice **exclusively via props** and MUST NOT import
  `useUiStateStore` or any Pinia store module. A subcomponent that
  reads the store is a contract violation. This keeps tests
  trivial-to-set-up (pass a fixture slice as a prop, no store needed)
  and makes spectator-HUD reuse straightforward later.
- **No client-side arithmetic or aggregation whatsoever on game values:**
  no HUD component may sum, subtract, normalize, smooth, average,
  count, or otherwise combine multiple `UIState` numeric fields into a
  new game-relevant value. If a combined value is needed, it must be
  supplied by the engine projection in `UIState`. `.reduce()` is
  banned, but so is a hand-written loop or a `+` between two projected
  numbers in a `computed`. The only permitted "computation" is reading
  a single field and mapping it to a display string (including sign
  choice for PAR delta).
- **Every user-visible number's `aria-label` is the literal `UIState`
  field name**, verbatim — e.g., `aria-label="bystandersRescued"`, NOT
  `aria-label="Bystanders rescued"` or any paraphrase. Screen-reader
  output must be deterministic across builds and testable against
  exact strings. Visible display text may be human-readable
  (`"Bystanders rescued: 4"`), but the `aria-label` is the
  data-contract name.
- **PAR delta semantics, explicit by phase:**
  - If `snapshot.game.phase === 'end'` and `snapshot.gameOver` is
    present: render `snapshot.gameOver.finalScore` exactly.
  - If `snapshot.game.phase !== 'end'` and the live PAR-delta field
    specified by WP-048 is present on `UIState` (or
    `UIGameOverState.preview`, whichever WP-048 specifies): render
    that field exactly.
  - If the applicable field is absent: render an em-dash (`—`),
    never zero. Zero is a valid engine value and must not be
    synthesized client-side.
  - The HUD must never compute, infer, smooth, or animate toward a
    PAR-delta value. The exact field name is read **verbatim from
    WP-048** at Preflight; if unclear, stop and ask.
- No `team` vocabulary anywhere. Use `player`, `activePlayer`,
  `playerColor`.
- No registry HTTP calls from within HUD components — card display data
  arrives via `UIState` projections; fuller card lookup is a separate
  composable out of scope here.
- Color choices must pass WCAG AA contrast in both light and dark modes;
  indicator state must not rely on color alone (icon + color).
- **Visual emphasis uses `data-emphasis`, not CSS class names:** the
  bystanders-rescued counter renders with `data-emphasis="primary"`;
  all penalty counters (escaped villains, scheme twists, mastermind
  tactics) render with `data-emphasis="secondary"`. Tests assert
  attribute presence, not class tokens. Styling hangs off the
  attribute selector so refactors or theming cannot regress the
  emphasis contract.

**Session protocol:**
- If any `UIState` field is unclear or apparently missing, stop and ask
  before inventing a client-side fallback.
- If WP-065's Vue SFC test transform is not proven (its tests failing,
  or `@legendary-arena/vue-sfc-loader` not installed in
  `apps/arena-client/`), **STOP immediately**. This packet creates 6+
  SFC component test files; inventing a transform mid-session burns a
  session and produces inconsistent tooling. Fix WP-065 first.
- If any subcomponent would need to read from the store to render
  correctly, STOP — that is a sign the prop contract is wrong or a
  field is missing from `UIState`. Do not silently import the store
  as a workaround.

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

- **Props-only subcomponents, one container:** `<ArenaHud />` is the
  sole store consumer; every subcomponent receives its `UIState`
  sub-slice exclusively as a prop. Test-only rendering therefore
  requires no store setup — construct a fixture slice, pass it as a
  prop, assert. This is the same pattern as the container/presenter
  split used by most well-tested Vue apps.
- Every component renders stable `data-testid` attributes on significant
  subtrees: `arena-hud-banner`, `arena-hud-player-panel-list`,
  `arena-hud-player-panel`, `arena-hud-scoreboard`, `arena-hud-par-delta`,
  `arena-hud-endgame`.
- **Emphasis is structural, not stylistic:** emphasized counters carry
  `data-emphasis="primary"`; penalty counters carry
  `data-emphasis="secondary"`. CSS selectors key off the attribute.
  Tests assert attribute presence, not class or style tokens.
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

### A) HUD root (the sole store consumer)
- `apps/arena-client/src/components/hud/ArenaHud.vue` — **new**
  - **Only** this component imports `useUiStateStore()`. No other HUD
    component may.
  - Composes: `<TurnPhaseBanner :game="snapshot.game" />`,
    `<SharedScoreboard :scheme="snapshot.scheme"
    :mastermind="snapshot.mastermind" />`,
    `<ParDeltaReadout :phase="snapshot.game.phase"
    :gameOver="snapshot.gameOver"
    :live="snapshot[<livePARField>]" />`,
    `<PlayerPanelList :players="snapshot.players"
    :activePlayerId="snapshot.game.activePlayerId" />`,
    `<EndgameSummary v-if="snapshot.gameOver"
    :gameOver="snapshot.gameOver" />`.
  - Renders `null` when `snapshot === null`.
  - `// why:` comment on the single-store-consumer pattern
    (container/presenter split).

### B) Turn / phase banner (props-only)
- `apps/arena-client/src/components/hud/TurnPhaseBanner.vue` — **new**
  - Props: `game: UIState['game']`.
  - Displays `game.phase`, `game.turn`, `game.currentStage`; highlights
    `game.activePlayerId`.
  - `aria-live="polite"` on phase/stage changes.
  - `// why:` comment on the aria-live choice.
  - MUST NOT import `useUiStateStore`.

### C) Shared scoreboard (props-only)
- `apps/arena-client/src/components/hud/SharedScoreboard.vue` — **new**
  - Props: `scheme: UISchemeState`, `mastermind: UIMastermindState`
    (plus whichever sub-slice exposes `bystandersRescued` and
    `escapedVillains` per WP-028 — confirm verbatim in Preflight).
  - Four counters, each rendered in a single element carrying the
    literal field name as `aria-label`:
    - `bystandersRescued` — `data-emphasis="primary"`
    - `escapedVillains` — `data-emphasis="secondary"`
    - `schemeTwists` — `data-emphasis="secondary"`
    - `mastermindTacticsRemaining` + `mastermindTacticsDefeated` —
      rendered as two distinct numbers, both `data-emphasis="secondary"`
  - Counter labels match exact field names from `UIState` verbatim.
  - MUST NOT aggregate or sum any fields (no `remaining + defeated`,
    no "total tactics" number).
  - MUST NOT import `useUiStateStore`.
  - `// why:` comment on the bystanders-rescued emphasis tying back
    to Vision §Heroic Values in Scoring.
  - `// why:` comment on the `data-emphasis` attribute contract.

### D) PAR delta readout (props-only, phase-aware)
- `apps/arena-client/src/components/hud/ParDeltaReadout.vue` — **new**
  - Props: `phase: UIState['game']['phase']`,
    `gameOver: UIGameOverState | undefined`,
    `live: number | undefined` (the live PAR delta sourced from the
    exact WP-048 field — name and location confirmed at Preflight).
  - Rendering rules, evaluated in order:
    1. If `phase === 'end'` and `gameOver` is defined: render
       `gameOver.finalScore` exactly.
    2. Else if `live !== undefined`: render `live` exactly.
    3. Else: render `—` (em-dash). Never render zero as a fallback.
  - Sign convention: negative = under PAR (green + `▼` icon), positive
    = over PAR (amber + `▲` icon), zero = neutral (no arrow).
  - The icon is always accompanied by text (color never the sole
    signal; `aria-label` uses the literal field name).
  - Never computes, smooths, animates, or infers a value.
  - MUST NOT import `useUiStateStore`.
  - `// why:` comment: no client-side math permitted here; em-dash vs
    zero is load-bearing — zero is a valid engine value.

### E) Player panels (props-only)
- `apps/arena-client/src/components/hud/PlayerPanelList.vue` — **new**
  - Props: `players: readonly UIPlayerState[]`,
    `activePlayerId: string`.
  - Iterates with `:key="player.playerId"`.
  - MUST NOT import `useUiStateStore`.
- `apps/arena-client/src/components/hud/PlayerPanel.vue` — **new**
  - Props: `player: UIPlayerState`, `isActive: boolean`.
  - Displays the seven `UIPlayerState` fields, each with an
    `aria-label` matching the literal field name.
  - Applies `aria-current="true"` when `isActive`.
  - MUST NOT import `useUiStateStore`.

### F) Endgame summary (props-only)
- `apps/arena-client/src/components/hud/EndgameSummary.vue` — **new**
  - Props: `gameOver: UIGameOverState`.
  - Displays `gameOver.outcome`, `gameOver.reason`, and
    `gameOver.scores` (if present).
  - Renders `parBaseline`, `rawScore`, `finalScore` as three distinct
    labeled values, each with its literal field-name `aria-label`.
  - MUST NOT import `useUiStateStore`.

### G) Accessibility + color utility
- `apps/arena-client/src/components/hud/hudColors.ts` — **new**
  - Exports `playerColorStyles(playerId: string): { background: string;
    foreground: string; icon: string }`
  - Uses a fixed color-blind-safe palette; the icon differentiator is
    mandatory so color is never the sole signal

### H) Tests (`node:test` + jsdom, using WP-065's SFC transform)
- `apps/arena-client/src/components/hud/ArenaHud.test.ts` — is the
  **only** HUD test that sets up a Pinia store. Verifies: renders
  nothing when snapshot is null; renders all five subtrees when a full
  fixture is loaded; endgame subtree absent when `gameOver` is
  undefined; asserts the other subcomponents receive the expected
  sub-slices via props.
- `apps/arena-client/src/components/hud/SharedScoreboard.test.ts` —
  mounted with a props object (no store). Counters render exactly the
  values passed in, no rounding. Asserts:
  - `[data-emphasis="primary"]` is present exactly once (on bystanders
    rescued).
  - `[data-emphasis="secondary"]` is present on every penalty counter.
  - Every counter carries the literal-field-name `aria-label`
    (`bystandersRescued`, `escapedVillains`, `schemeTwists`,
    `mastermindTacticsRemaining`, `mastermindTacticsDefeated`).
- `apps/arena-client/src/components/hud/ParDeltaReadout.test.ts` —
  mounted with a props object. Four branch tests:
  - `phase='end'` + `gameOver.finalScore=-3` → renders `-3` with the
    `▼` icon and green styling.
  - `phase='play'` + `live=0` → renders `0` with no arrow icon (zero
    is neutral and must not be em-dashed).
  - `phase='play'` + `live=undefined` → renders em-dash and no arrow.
  - `phase='end'` + `gameOver=undefined` → renders em-dash.
  - Each assertion checks literal rendered text; no computed/derived
    value ever appears.
- `apps/arena-client/src/components/hud/PlayerPanel.test.ts` — mounted
  with a props object. The seven zone fields render with literal
  field-name `aria-label`s; active player gets `aria-current="true"`
  when `isActive` is true and absent otherwise.
- `apps/arena-client/src/components/hud/TurnPhaseBanner.test.ts` —
  mounted with a props object. Phase, turn, stage, and active-player
  highlight all render from the passed-in `game` slice; `aria-live`
  present on the phase/stage region.
- Drift test: imports `UIState` as a type and assigns a full fixture to
  it via `satisfies UIState` — fails to typecheck if any locked field
  is renamed or dropped upstream.

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

### Container / Presenter Split
- [ ] Only `apps/arena-client/src/components/hud/ArenaHud.vue` imports
      `useUiStateStore` (confirmed with `Select-String`: grep for the
      store import across the HUD directory; exactly one match, in
      `ArenaHud.vue`).
- [ ] Every subcomponent's render output depends only on its declared
      props — manually verified by code review + fixture-driven tests
      that mount subcomponents without a Pinia plugin.

### Projection Fidelity
- [ ] Every number rendered in the HUD traces directly to a single
      `UIState` field — no client-side arithmetic, aggregation,
      summing, smoothing, or averaging of game values (confirmed by
      `Select-String` for `+` operator inside `<script>` blocks of
      `.vue` files + code review).
- [ ] PAR delta renders an em-dash when the field is absent; never
      a zero. Zero is rendered when the engine says zero.
- [ ] The "bystanders rescued" counter carries `data-emphasis="primary"`
      exactly once; all four penalty counters carry
      `data-emphasis="secondary"` (asserted in tests).

### Accessibility (SG-17)
- [ ] Every counter has an explicit `aria-label` equal to the literal
      `UIState` field name — verbatim, no paraphrasing
      (`aria-label="bystandersRescued"`, not
      `aria-label="Bystanders rescued"`). Asserted in tests against
      exact strings.
- [ ] Active player indicator uses `aria-current="true"` and an icon,
      not color alone.
- [ ] All text passes WCAG AA contrast in both light and dark modes
      (confirmed via automated tooling or manual check documented in
      DECISIONS.md with numeric ratios).

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
Select-String -Path "apps\arena-client\src\components\hud" -Pattern "\bteam\b" -Recurse
# Expected: no output (Legendary is cooperative, not team-based)

# Step 7 — confirm ONLY ArenaHud.vue imports the store
Select-String -Path "apps\arena-client\src\components\hud" -Pattern "useUiStateStore" -Recurse
# Expected: matches only in ArenaHud.vue; any other file matching is a contract violation

# Step 8 — confirm data-emphasis attribute is used
Select-String -Path "apps\arena-client\src\components\hud\SharedScoreboard.vue" -Pattern "data-emphasis"
# Expected: at least five matches (primary + four secondary)

# Step 9 — confirm literal field-name aria-labels (no paraphrasing)
Select-String -Path "apps\arena-client\src\components\hud" -Pattern "aria-label=`"bystandersRescued`"|aria-label=`"escapedVillains`"|aria-label=`"schemeTwists`"" -Recurse
# Expected: at least three matches; no matches for paraphrased labels like "Bystanders rescued"

# Step 10 — confirm engine package untouched
git diff --name-only packages/game-engine/
# Expected: no output

# Step 11 — confirm only expected files changed
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
- [ ] Only `ArenaHud.vue` imports `useUiStateStore` (container/presenter
      split enforced)
- [ ] `data-emphasis="primary"` appears exactly once in
      `SharedScoreboard.vue` (bystanders rescued); `data-emphasis="secondary"`
      on every penalty counter
- [ ] `aria-label` values are literal `UIState` field names, not
      paraphrases
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
